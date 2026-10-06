import mongoose from "mongoose";
import { wialonApiCall, withWialonSession } from "../utils/wialonClient.js";

export const CLOSED_STATUSES = ["cerrada", "cerrada (e)", "finalizada"];
const RESOURCE_FLAGS = 0x0400 | 0x01; // notifications + basic
const UNIT_FLAGS = 0x01;
const SEARCH_LIMIT = 1000;
const CANDIDATES_PER_TYPE = 80;

export const CANONICAL_TYPES = [
  { key: "gps_no_posiciona", label: "GPS no posiciona", triggerType: "outage", pattern: /GPS\s*NO\s*POSICIONA/i },
  { key: "desvio_de_ruta", label: "Desvío de ruta", triggerType: "geozone", pattern: /DESV[IÍ]O\s*DE\s*RUTA/i },
  { key: "estadia_dentro", label: "Estadía dentro de georuta", triggerType: "geozone", pattern: /ESTAD[IÍ]A\s*DENTRO/i },
  { key: "estadia_fuera", label: "Estadía fuera de georuta", triggerType: "geozone", pattern: /ESTAD[IÍ]A\s*FUERA/i },
];

const pruneEnabled = () => String(process.env.WIALON_PRUNE_ORPHAN_UNITS ?? "true").toLowerCase() !== "false";

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

async function fetchResources(sid) {
  const res = await wialonApiCall(
    "core/search_items",
    {
      spec: { itemsType: "avl_resource", propName: "*", propValueMask: "*", sortType: "sys_name" },
      force: 1,
      flags: RESOURCE_FLAGS,
      from: 0,
      to: SEARCH_LIMIT,
    },
    sid
  );
  if (res.error || !res.items) throw new Error(`Wialon resource search error: ${res.error || "no items"}`);
  return res.items;
}

async function fetchUnitMap(sid) {
  const res = await wialonApiCall(
    "core/search_items",
    {
      spec: { itemsType: "avl_unit", propName: "*", propValueMask: "*", sortType: "sys_name" },
      force: 1,
      flags: UNIT_FLAGS,
      from: 0,
      to: SEARCH_LIMIT,
    },
    sid
  );
  const map = {};
  if (!res.error && res.items) for (const u of res.items) map[String(u.id)] = u.nm || `Unit ${u.id}`;
  return map;
}

// `core/search_items` is the slow part of the catalog (3-4s round trip). The
// whole processed snapshot is read-only, so it is reused for a short window and
// a cache hit opens no Wialon session at all. Set WIALON_CATALOG_CACHE_MS=0 to
// disable the cache.
let catalogSnapshot = null;
let catalogSnapshotPending = null;
let catalogGeneration = 0;
const snapshotTtlMs = () => Number(process.env.WIALON_CATALOG_CACHE_MS ?? 60000);

async function buildSnapshot(sid) {
  const [resources, unitMap] = await Promise.all([fetchResources(sid), fetchUnitMap(sid)]);
  const all = flattenNotifications(resources);
  return { unitMap, all, orphanInfo: await getOrphanUnitIds(all) };
}

async function getCatalogSnapshot() {
  const ttl = snapshotTtlMs();
  if (ttl > 0 && catalogSnapshot && Date.now() - catalogSnapshot.at < ttl) return catalogSnapshot;
  // Concurrent wizard reads share one Wialon round trip instead of stacking them.
  if (catalogSnapshotPending) return catalogSnapshotPending;

  const generation = catalogGeneration;
  const pending = withWialonSession(buildSnapshot)
    .then((snap) => {
      const stamped = { ...snap, at: Date.now() };
      if (ttl > 0 && generation === catalogGeneration) catalogSnapshot = stamped;
      return stamped;
    })
    .finally(() => {
      if (catalogSnapshotPending === pending) catalogSnapshotPending = null;
    });

  catalogSnapshotPending = pending;
  return pending;
}

/** Call after writing to Wialon so the next catalog read is not stale. */
export function invalidateCatalogCache() {
  catalogSnapshot = null;
  catalogGeneration += 1;
  listSnapshot = null;
  listGeneration += 1;
}

function flattenNotifications(resources) {
  const out = [];
  for (const r of resources) {
    const unf = r.unf;
    if (!unf || typeof unf !== "object") continue;
    for (const [nid, n] of Object.entries(unf)) {
      if (!n || n.error) continue;
      out.push({
        resourceId: r.id,
        resourceName: r.nm || "",
        notifId: Number(nid),
        name: n.n || "Sin nombre",
        triggerType: n.trg || "unknown",
        enabled: !(n.fl & 0x2),
        units: (n.un || []).map(Number),
        raw: n,
      });
    }
  }
  return out;
}

/**
 * Units referenced by any notification of a non-deleted, non-closed bitácora.
 * Those are the only ones we consider "in use" when pruning orphans.
 */
export async function getUnitsInUse() {
  const set = new Set();
  try {
    const col = mongoose.connection.db.collection("bitacoras");
    const docs = await col
      .find(
        { deleted: { $ne: true }, status: { $nin: CLOSED_STATUSES } },
        { projection: { "transportes.gpsUnits.wialonId": 1 } }
      )
      .toArray();
    for (const d of docs) {
      for (const t of d.transportes || []) {
        for (const u of t.gpsUnits || []) {
          if (u && u.wialonId != null && String(u.wialonId).trim() !== "") set.add(String(u.wialonId).trim());
        }
      }
    }
  } catch (e) {
    // Fail safe: if Mongo is unreachable we cannot tell what is in use, so we prune nothing.
    console.error("getUnitsInUse failed, pruning disabled for this run:", e.message);
    return { set: new Set(), ok: false };
  }
  return { set, ok: true };
}

async function getOrphanUnitIds(allNotifications) {
  if (!pruneEnabled()) return { set: new Set(), ok: true, prunedEnabled: false };
  const { set: inUse, ok } = await getUnitsInUse();
  if (!ok) return { set: new Set(), ok: false, prunedEnabled: false };
  const orphans = new Set();
  for (const n of allNotifications) {
    for (const u of n.units) {
      const key = String(u);
      if (!inUse.has(key)) orphans.add(key);
    }
  }
  return { set: orphans, ok: true, prunedEnabled: true };
}

function rankCandidates(candidates, hint, knownResources) {
  const h = norm(hint);
  return candidates.sort((a, b) => {
    // Wialon only accepts a unit inside a resource it is reachable from, and the
    // API never tells us that upfront. Resources that already hold one of the
    // selected GPS are proven to work, so float them to the top.
    if (knownResources && knownResources.size) {
      const ak = knownResources.has(a.resourceId) ? 1 : 0;
      const bk = knownResources.has(b.resourceId) ? 1 : 0;
      if (ak !== bk) return bk - ak;
    }
    if (h) {
      const am = norm(a.name).includes(h) ? 1 : 0;
      const bm = norm(b.name).includes(h) ? 1 : 0;
      if (am !== bm) return bm - am;
    }
    const af = a.units.length === 0 ? 1 : 0;
    const bf = b.units.length === 0 ? 1 : 0;
    if (af !== bf) return bf - af;
    return a.notifId - b.notifId;
  });
}

/**
 * Catalog shown in the wizard's GPS step.
 *  - unitStatus: which of the selected GPS units actually exist in Wialon
 *  - linked:     notifications already covering at least one selected unit
 *  - canonical:  free (or fully orphaned) candidates for the 4 canonical alert types
 */
export async function getCatalog({ unitIds = [], hint = "", q = "" } = {}) {
  const wanted = [...new Set(unitIds.map(String).filter(Boolean))];

  // The wizard only searches from 2 characters on. Below that we return the
  // groups and their counts without the candidate payload, so the first paint
  // is cheap and the dropdowns stay empty until the user actually types.
  const qNorm = norm(q);
  const lite = qNorm.length < 2;

  const { unitMap, all, orphanInfo } = await getCatalogSnapshot();

  const wantedSet = new Set(wanted);
  const unitStatus = wanted.map((id) => ({
    id,
    exists: Object.prototype.hasOwnProperty.call(unitMap, id),
    name: unitMap[id] || null,
  }));

  const linked = all
    .filter((n) => n.units.some((u) => wantedSet.has(String(u))))
    .map((n) => ({
      resourceId: n.resourceId,
      resourceName: n.resourceName,
      notifId: n.notifId,
      name: n.name,
      triggerType: n.triggerType,
      enabled: n.enabled,
      unitCount: n.units.length,
      units: n.units.map(String),
    }));

  const knownResources = new Set(linked.map((n) => n.resourceId));
  const canonical = CANONICAL_TYPES.map((t) => {
    let pool = all.filter(
      (n) =>
        n.triggerType === t.triggerType &&
        t.pattern.test(n.name) &&
        !n.units.some((u) => wantedSet.has(String(u))) &&
        (n.units.length === 0 || n.units.every((u) => orphanInfo.set.has(String(u))))
    );
    if (qNorm) pool = pool.filter((n) => norm(n.name).includes(qNorm));
    const ranked = lite ? pool : rankCandidates(pool, hint, knownResources);
    return {
      key: t.key,
      label: t.label,
      triggerType: t.triggerType,
      total: pool.length,
      searched: !lite,
      candidates: lite
        ? []
        : ranked.slice(0, CANDIDATES_PER_TYPE).map((n) => ({
            resourceId: n.resourceId,
            resourceName: n.resourceName,
            notifId: n.notifId,
            name: n.name,
            enabled: n.enabled,
            unitCount: n.units.length,
          })),
    };
  });

  return {
    units: unitStatus,
    linked,
    canonical,
    lite,
    pruneEnabled: orphanInfo.prunedEnabled,
    candidatesPerType: CANDIDATES_PER_TYPE,
  };
}

const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
};

// Rebuilds a full `update` payload. `get_notification_data` returns read-only
// fields (ac, ct, mt) and derived trigger fields (expression, conditions) that
// `update_notification` does not accept.
function buildUpdatePayload(itemId, notif, newUnits) {
  return {
    itemId,
    id: notif.id,
    callMode: "update",
    ...pick(notif, ["n", "txt", "ta", "td", "ma", "mmtd", "cdt", "mast", "mpst", "cp", "fl", "tz", "la", "d"]),
    un: newUnits.map(Number),
    sch: notif.sch ? pick(notif.sch, ["f1", "f2", "t1", "t2", "m", "y", "w"]) : undefined,
    ctrl_sch: notif.ctrl_sch ? pick(notif.ctrl_sch, ["f1", "f2", "t1", "t2", "m", "y", "w"]) : undefined,
    trg: notif.trg ? { t: notif.trg.t, p: notif.trg.p || {} } : undefined,
    act: Array.isArray(notif.act)
      ? notif.act.map((a) => (typeof a === "string" ? { t: a, p: {} } : { t: a.t, p: a.p || {} }))
      : undefined,
  };
}

/**
 * Unit ids actually stored by a `resource/update_notification` call.
 * The service answers `[id, notif]` (some builds answer `[notif]`), so fall
 * back to a fresh read when neither shape carries `un`. Returns null on doubt.
 */
async function readBackUnits(sid, itemId, notifId, upd) {
  const pickUn = (o) => (o && Array.isArray(o.un) ? o.un.map(String) : null);

  if (Array.isArray(upd)) {
    const fromResp = pickUn(upd[1]) || pickUn(upd[0]);
    if (fromResp) return fromResp;
  } else {
    const fromResp = pickUn(upd);
    if (fromResp) return fromResp;
  }

  const r = await wialonApiCall("resource/get_notification_data", { itemId, col: [notifId] }, sid);
  const n = Array.isArray(r) ? r[0] : r;
  return pickUn(n);
}

/**
 * selections: [{ resourceId, notifId, action: "link" | "unlink" }]
 *  - link:   add every unitId to `un`, prune orphan units, then enable
 *  - unlink: remove every unitId from `un` (never disables the notification)
 */
export async function applySelections({ unitIds = [], selections = [] } = {}) {
  const wanted = [...new Set(unitIds.map(String).filter(Boolean))];
  const wantedSet = new Set(wanted);
  const results = { applied: [], failed: [], pruned: [], prunedEnabled: false, skippedUnits: [] };

  if (!wanted.length || !selections.length) return results;

  await withWialonSession(async (sid) => {
    const resources = await fetchResources(sid);
    const unitMap = await fetchUnitMap(sid);
    results.skippedUnits = wanted.filter((id) => !Object.prototype.hasOwnProperty.call(unitMap, id));
    // Never write an id Wialon does not know: a GPS that is missing in Wialon is
    // reported through `skippedUnits` and simply left out of the notification.
    const validWanted = wanted.filter((id) => Object.prototype.hasOwnProperty.call(unitMap, id));
    const validWantedSet = new Set(validWanted);
    const all = flattenNotifications(resources);
    const orphanInfo = await getOrphanUnitIds(all);
    results.prunedEnabled = orphanInfo.prunedEnabled;

    const index = new Map(all.map((n) => [`${n.resourceId}_${n.notifId}`, n]));

    for (const sel of selections) {
      const key = `${sel.resourceId}_${sel.notifId}`;
      const summary = { resourceId: Number(sel.resourceId), notifId: Number(sel.notifId), action: sel.action };
      // None of the selected GPS exists in Wialon: the wizard already warned
      // about it, so omit this write instead of failing or inventing an id.
      if (sel.action === "link" && !validWanted.length) continue;
      try {
        const cached = index.get(key);
        if (!cached) throw new Error("Notification not found in resource");

        const resp = await wialonApiCall(
          "resource/get_notification_data",
          { itemId: Number(sel.resourceId), col: [Number(sel.notifId)] },
          sid
        );
        if (resp.error) throw new Error(`get_notification_data: ${resp.error}`);
        const notif = Array.isArray(resp) && resp[0] ? resp[0] : null;
        if (!notif) throw new Error("Notification not found");

        const before = (notif.un || []).map(Number);
        const beforeSet = new Set(before.map(String));
        let next;

        if (sel.action === "link") {
          const kept = before.filter((u) => !orphanInfo.set.has(String(u)));
          const pruned = before.filter(
            (u) => orphanInfo.set.has(String(u)) && !validWantedSet.has(String(u))
          );
          if (pruned.length) results.pruned.push({ ...summary, unitIds: pruned.map(String) });
          next = [...new Set([...kept, ...validWanted.map(Number)])];
        } else {
          next = before.filter((u) => !wantedSet.has(String(u)));
        }

        const changed = next.length !== before.length || next.some((u) => !beforeSet.has(String(u)));
        if (changed) {
          const upd = await wialonApiCall(
            "resource/update_notification",
            buildUpdatePayload(Number(sel.resourceId), notif, next),
            sid
          );
          if (upd.error) throw new Error(`update_notification: ${upd.error}`);

          // Wialon answers 200 but silently drops units that are not reachable
          // from the notification's resource, so confirm the write landed.
          // Only meaningful for "link": unlinking removes ids on purpose.
          if (sel.action === "link") {
            const landed = await readBackUnits(sid, Number(sel.resourceId), Number(sel.notifId), upd);
            const missing = landed === null ? [] : validWanted.filter((u) => !landed.includes(u));
            if (missing.length) {
              results.failed.push({
                ...summary,
                error: `${missing.join(", ")} → "${cached.resourceName || sel.resourceId}": sin acceso al recurso (otorgarlo en Wialon).`,
              });
              continue;
            }
          }
        }

        if (sel.action === "link" && !cached.enabled) {
          const en = await wialonApiCall(
            "resource/update_notification",
            { itemId: Number(sel.resourceId), id: Number(sel.notifId), callMode: "enable", e: 1 },
            sid
          );
          if (en.error) throw new Error(`enable: ${en.error}`);
        }

        results.applied.push({ ...summary, units: next.map(String), changed });
      } catch (e) {
        results.failed.push({ ...summary, error: e.message });
      }
    }
  });

  return results;
}

/**
 * Unit↔notification bindings still needed by any open (non-deleted, non-closed) bitácora.
 * Keys: `${unitId}_${resourceId}_${notifId}`.
 */
async function getOpenUnitNotifKeys() {
  const keys = new Set();
  try {
    const col = mongoose.connection.db.collection("bitacoras");
    const docs = await col
      .find(
        { deleted: { $ne: true }, status: { $nin: CLOSED_STATUSES } },
        {
          projection: {
            "transportes.gpsUnits.wialonId": 1,
            "transportes.notificaciones.resourceId": 1,
            "transportes.notificaciones.notifId": 1,
          },
        }
      )
      .toArray();
    for (const d of docs) {
      for (const t of d.transportes || []) {
        const unitIds = (t.gpsUnits || [])
          .map((u) => (u?.wialonId != null ? String(u.wialonId).trim() : ""))
          .filter(Boolean);
        for (const n of t.notificaciones || []) {
          if (n?.resourceId == null || n?.notifId == null) continue;
          for (const uid of unitIds) {
            keys.add(`${uid}_${n.resourceId}_${n.notifId}`);
          }
        }
      }
    }
    return { keys, ok: true };
  } catch (e) {
    console.error("getOpenUnitNotifKeys failed:", e.message);
    return { keys: new Set(), ok: false };
  }
}

/**
 * Unlink GPS units of a bitácora from its selected Wialon notifications.
 * Keeps Mongo `transportes.notificaciones` as history; only removes unit IDs
 * from Wialon notification `un` arrays (never disables the rule).
 *
 * Skips any unit↔notification pair still required by another open bitácora
 * (shared GPS across trips).
 */
export async function unlinkBitacoraNotifications(bitacora) {
  // Collect unit↔notif bindings for this bitácora (transporte-local pairs).
  const bindings = []; // { unitId, resourceId, notifId }
  const seenBinding = new Set();

  for (const t of bitacora?.transportes || []) {
    const unitIds = [];
    for (const u of t.gpsUnits || []) {
      const id = u?.wialonId != null ? String(u.wialonId).trim() : "";
      if (id) unitIds.push(id);
    }
    for (const n of t.notificaciones || []) {
      if (n?.resourceId == null || n?.notifId == null) continue;
      for (const unitId of unitIds) {
        const key = `${unitId}_${n.resourceId}_${n.notifId}`;
        if (seenBinding.has(key)) continue;
        seenBinding.add(key);
        bindings.push({
          unitId,
          resourceId: Number(n.resourceId),
          notifId: Number(n.notifId),
        });
      }
    }
  }

  if (!bindings.length) {
    return { applied: [], failed: [], pruned: [], prunedEnabled: false, skippedUnits: [], skippedShared: [] };
  }

  // After close/delete this bitácora is already excluded from "open", so any
  // remaining keys belong to other open trips that still need the binding.
  const { keys: stillNeeded, ok } = await getOpenUnitNotifKeys();
  const skippedShared = [];
  const toUnlink = [];
  for (const b of bindings) {
    const key = `${b.unitId}_${b.resourceId}_${b.notifId}`;
    if (ok && stillNeeded.has(key)) {
      skippedShared.push(b);
      continue;
    }
    toUnlink.push(b);
  }

  if (!toUnlink.length) {
    return {
      applied: [],
      failed: [],
      pruned: [],
      prunedEnabled: false,
      skippedUnits: [],
      skippedShared,
    };
  }

  // Group by notification so each Wialon update only removes the units that
  // are safe to drop from that specific rule.
  const byNotif = new Map();
  for (const b of toUnlink) {
    const nk = `${b.resourceId}_${b.notifId}`;
    if (!byNotif.has(nk)) {
      byNotif.set(nk, {
        resourceId: b.resourceId,
        notifId: b.notifId,
        unitIds: new Set(),
      });
    }
    byNotif.get(nk).unitIds.add(b.unitId);
  }

  const merged = { applied: [], failed: [], pruned: [], prunedEnabled: false, skippedUnits: [], skippedShared };
  for (const group of byNotif.values()) {
    const part = await applySelections({
      unitIds: [...group.unitIds],
      selections: [{ resourceId: group.resourceId, notifId: group.notifId, action: "unlink" }],
    });
    merged.applied.push(...(part.applied || []));
    merged.failed.push(...(part.failed || []));
    merged.pruned.push(...(part.pruned || []));
    merged.skippedUnits.push(...(part.skippedUnits || []));
    if (part.prunedEnabled) merged.prunedEnabled = true;
  }
  return merged;
}

// Alerts panel list. Separate from the wizard snapshot: it needs geofence names
// (heavy), so the wizard catalog stays on the lighter flags.
const LIST_RESOURCE_FLAGS = 0x0400 | 0x0800 | 0x1000 | 0x01;
const ACTION_LABELS = {
  notify_popup: "Popup",
  notify_email: "Email",
  notify_sms: "SMS",
  notify_command: "Comando",
  notify_http: "HTTP",
  notify_event: "Evento",
  notify_mobile: "Móvil",
  notify_telegram: "Telegram",
  notify_whatsapp: "WhatsApp",
  exec_command: "Ejecutar comando",
  message: "Notificación en línea",
  mobile_apps: "Notificación móvil",
  email: "Email",
  sms: "SMS",
};

let listSnapshot = null;
let listSnapshotPending = null;
let listGeneration = 0;

async function fetchListResources(sid) {
  const res = await wialonApiCall(
    "core/search_items",
    {
      spec: { itemsType: "avl_resource", propName: "*", propValueMask: "*", sortType: "sys_name" },
      force: 1,
      flags: LIST_RESOURCE_FLAGS,
      from: 0,
      to: SEARCH_LIMIT,
    },
    sid
  );
  if (res.error || !res.items) throw new Error(`Wialon resource search error: ${res.error || "no items"}`);
  return res.items;
}

function describeAction(action) {
  const type = typeof action === "string" ? action : action?.t || "";
  const p = action?.p || {};
  switch (type) {
    case "notify_email":
    case "email":
      return `Enviar email a: ${p.email || p.email_to || "N/A"}`;
    case "notify_popup":
      return "Mostrar notificación en ventana emergente";
    case "notify_mobile":
    case "mobile_apps":
      return "Enviar notificación a aplicación móvil";
    case "notify_sms":
    case "sms":
      return `Enviar SMS a: ${p.phones || p.sms_to || "N/A"}`;
    case "notify_command":
    case "exec_command":
      return `Ejecutar comando: ${p.c || p.command_name || "N/A"}`;
    case "notify_http":
      return `Petición HTTP a: ${p.u || p.url || "URL"}`;
    case "notify_event":
      return "Registrar evento en la unidad";
    case "notify_telegram":
      return "Enviar mensaje a Telegram";
    case "notify_whatsapp":
      return "Enviar mensaje a WhatsApp";
    case "message":
      if (typeof action === "string" || !p.message) return "Mostrar notificación en ventana emergente";
      return `Mensaje: ${p.message}`;
    default: {
      const label = ACTION_LABELS[type];
      if (label) return label;
      return type.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    }
  }
}

function buildListRows(resources, unitMap) {
  const geofenceMap = {};
  for (const resItem of resources) {
    if (resItem.zl && typeof resItem.zl === "object") {
      for (const [zid, z] of Object.entries(resItem.zl)) {
        geofenceMap[zid] = z.n || `Geozona ${zid}`;
      }
    }
  }

  const rows = [];
  for (const resItem of resources) {
    const unf = resItem.unf;
    if (!unf || typeof unf !== "object") continue;
    for (const [nid, n] of Object.entries(unf)) {
      if (!n || n.error) continue;
      const units = n.un || [];
      const unitNames = units.map((id) => unitMap[String(id)] || `ID: ${id}`);
      const rawActions = n.act || [];
      const actionLabels = rawActions
        .map((a) => {
          if (typeof a === "string") return ACTION_LABELS[a] || a;
          if (a && a.t) return ACTION_LABELS[a.t] || a.t;
          return null;
        })
        .filter(Boolean);

      let description = n.d || "";
      if (!description && n.p) {
        if (Array.isArray(n.p.geos) && n.p.geos.length > 0) {
          const names = n.p.geos.map((id) => geofenceMap[id] || `ID: ${id}`);
          const checkType = n.p.type === 0 ? "Fuera de" : "Dentro de";
          description = `${checkType}: ${names.join(", ")}`;
        }
        if (n.trg === "speed") {
          const speedInfo = `Velocidad: ${n.p.min || 0} a ${n.p.max || "∞"} km/h`;
          description = description ? `${description} (${speedInfo})` : speedInfo;
        } else if (n.trg === "sensor_value") {
          const sensorInfo = `Sensor: ${n.p.s || "N/A"} (${n.p.min || 0} a ${n.p.max || "∞"})`;
          description = description ? `${description} (${sensorInfo})` : sensorInfo;
        } else if (n.trg === "alarm") {
          description = description ? `${description} (Alarma)` : "Alarma / Botón de pánico";
        } else if (n.trg === "digital_input") {
          const diInfo = `Entrada digital: ${n.p.in || "N/A"}`;
          description = description ? `${description} (${diInfo})` : diInfo;
        } else if (n.trg === "outage") {
          description = "Pérdida de conexión";
        }
      }
      if (!description || description === "—") {
        const isGenericText = !n.txt || n.txt === "%UNIT% %NOTIFICATION%";
        description = n.n || (!isGenericText ? n.txt : "—");
      }

      rows.push({
        _key: `${resItem.id}_${nid}`,
        id: parseInt(nid, 10),
        resourceId: resItem.id,
        name: n.n || "Sin nombre",
        triggerType: n.trg || "unknown",
        text: n.txt || "",
        description: description || "—",
        units,
        unitNames,
        enabled: !(n.fl & 0x2),
        alarmCount: n.ac || 0,
        createdAt: n.ct,
        resourceName: resItem.nm || "—",
        actions: rawActions,
        actionLabels,
        actionDescriptions: rawActions.map(describeAction),
      });
    }
  }
  return rows;
}

async function getListSnapshot() {
  const ttl = snapshotTtlMs();
  if (ttl > 0 && listSnapshot && Date.now() - listSnapshot.at < ttl) return listSnapshot.rows;
  if (listSnapshotPending) return listSnapshotPending;

  const generation = listGeneration;
  const pending = withWialonSession(async (sid) => {
    const [resources, unitMap] = await Promise.all([fetchListResources(sid), fetchUnitMap(sid)]);
    return buildListRows(resources, unitMap);
  })
    .then((rows) => {
      if (ttl > 0 && generation === listGeneration) listSnapshot = { rows, at: Date.now() };
      return rows;
    })
    .finally(() => {
      if (listSnapshotPending === pending) listSnapshotPending = null;
    });

  listSnapshotPending = pending;
  return pending;
}

async function attachActiveBitacoras(rows) {
  const allUnitIdsRaw = [...new Set(rows.flatMap((n) => n.units || []).map(String))];
  const allUnitIdsNum = allUnitIdsRaw.map(Number).filter((n) => !Number.isNaN(n));
  const allUnitIds = [...allUnitIdsRaw, ...allUnitIdsNum];
  const unitActivityMap = {};

  if (allUnitIds.length > 0) {
    const col = mongoose.connection.db.collection("bitacoras");
    const activeBits = await col
      .find(
        {
          deleted: { $ne: true },
          status: { $nin: CLOSED_STATUSES },
          "transportes.gpsUnits.wialonId": { $in: allUnitIds },
        },
        {
          projection: {
            _id: 1,
            bitacora_id: 1,
            cliente: 1,
            status: 1,
            edited: 1,
            "transportes.id": 1,
            "transportes.gpsUnits.wialonId": 1,
            "transportes.gpsUnits.name": 1,
            "transportes.tracto.placa": 1,
            "transportes.tracto.eco": 1,
            "transportes.remolque.placa": 1,
            "transportes.remolque.eco": 1,
          },
        }
      )
      .toArray();

    for (const bit of activeBits) {
      for (const t of bit.transportes || []) {
        for (const g of t.gpsUnits || []) {
          if (g?.wialonId == null) continue;
          const wid = String(g.wialonId);
          const hit = {
            _id: bit._id?.toString?.() || String(bit._id),
            bitacora_id: bit.bitacora_id,
            cliente: bit.cliente,
            status: bit.status,
            edited: bit.edited || false,
            transporteId: t.id,
            unitName: g.name || null,
            wialonId: wid,
            placa: t.tracto?.placa || t.remolque?.placa || null,
            eco: t.tracto?.eco || t.remolque?.eco || null,
          };
          // Index both raw and numeric-normalized forms so Wialon integer IDs match.
          const keys = new Set([wid]);
          const n = Number(wid);
          if (!Number.isNaN(n)) keys.add(String(n));
          for (const k of keys) {
            if (!unitActivityMap[k]) unitActivityMap[k] = [];
            unitActivityMap[k].push(hit);
          }
        }
      }
    }
  }

  return rows.map((n) => {
    const matches = [];
    for (const uid of n.units || []) {
      const hits = unitActivityMap[String(uid)];
      if (hits) matches.push(...hits);
    }
    const seen = new Set();
    const activeBitacoras = matches.filter((m) => {
      const k = `${m.bitacora_id}_${m.transporteId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { ...n, activeBitacoras };
  });
}

const LAST_TRIGGER_LOOKBACK_SEC = 30 * 24 * 3600;
const LAST_TRIGGER_CONCURRENCY = 3;
const EMPTY_TRIGGER = {
  lastTriggeredAt: null,
  lastTriggerUnitId: null,
  lastTriggerUnitName: null,
  lastTriggerText: null,
};

/**
 * Primary: resource/get_notifications_log (when the account supports it).
 * Fallback: resource messages (email_notification / p.notification) — works on this host.
 */
async function fetchLastTriggerFromLog(sid, resourceId, notifId) {
  const now = Math.floor(Date.now() / 1000);
  const logData = await wialonApiCall(
    "resource/get_notifications_log",
    {
      itemId: Number(resourceId),
      col: [Number(notifId)],
      from: now - LAST_TRIGGER_LOOKBACK_SEC,
      to: now,
    },
    sid
  );
  if (!logData || logData.error) return null;

  const key = String(notifId);
  let entries = [];
  if (logData[key] && Array.isArray(logData[key].log)) entries = logData[key].log;
  else if (logData[notifId] && Array.isArray(logData[notifId].log)) entries = logData[notifId].log;
  else {
    const firstKey = Object.keys(logData).find((k) => logData[k] && Array.isArray(logData[k].log));
    if (firstKey) entries = logData[firstKey].log;
  }
  if (!entries.length) return { ...EMPTY_TRIGGER };

  let latest = entries[0];
  for (const e of entries) {
    if (Number(e.t || e.tm || 0) > Number(latest.t || latest.tm || 0)) latest = e;
  }
  const unitId = latest.u != null && Number(latest.u) > 0 ? String(latest.u) : null;
  return {
    lastTriggeredAt: Number(latest.t || latest.tm || 0) || null,
    lastTriggerUnitId: unitId,
    lastTriggerUnitName: latest.unit_name || (unitId ? `ID: ${unitId}` : null),
    lastTriggerText: latest.txt || null,
  };
}

/**
 * Load recent resource messages once and index the latest fire per notification name.
 * Message shape: { t, p: { notification, unit, ... } }
 */
async function loadResourceTriggerIndex(sid, resourceId) {
  const now = Math.floor(Date.now() / 1000);
  const messagesData = await wialonApiCall(
    "messages/load_interval",
    {
      itemId: Number(resourceId),
      timeFrom: now - LAST_TRIGGER_LOOKBACK_SEC,
      timeTo: now,
      flags: 0,
      flagsMask: 0,
      loadCount: 5000,
    },
    sid
  );
  const index = new Map(); // notifName -> { t, unitName, text }
  if (!messagesData || messagesData.error || !Array.isArray(messagesData.messages)) return index;

  for (const m of messagesData.messages) {
    const name = m?.p?.notification;
    if (!name) continue;
    const t = Number(m.t || 0);
    if (!t) continue;
    const prev = index.get(name);
    if (prev && prev.t >= t) continue;
    index.set(name, {
      t,
      unitName: m.p.unit || null,
      text: m.p.notification || null,
    });
  }
  return index;
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Attach last-trigger fields to each row (scoped lists only — N is small).
 * Batches the message fallback by resource so N alerts on one resource share one fetch.
 */
async function enrichWithLastTriggers(rows) {
  if (!rows.length) return rows;

  return withWialonSession(async (sid) => {
    // 1) Try the dedicated log API per notification (fast when supported).
    const fromLog = await mapPool(rows, LAST_TRIGGER_CONCURRENCY, async (row) => {
      try {
        return await fetchLastTriggerFromLog(sid, row.resourceId, row.id);
      } catch {
        return null;
      }
    });

    // 2) For rows the log API can't serve, batch-load resource messages by resourceId.
    const needFallback = [];
    for (let i = 0; i < rows.length; i++) {
      if (fromLog[i] == null) needFallback.push(i);
    }

    const resourceIds = [
      ...new Set(needFallback.map((i) => Number(rows[i].resourceId)).filter(Boolean)),
    ];
    const resourceIndexes = new Map();
    await mapPool(resourceIds, LAST_TRIGGER_CONCURRENCY, async (resourceId) => {
      try {
        resourceIndexes.set(resourceId, await loadResourceTriggerIndex(sid, resourceId));
      } catch (err) {
        console.warn(`[wialon-last-trigger] messages fallback failed for ${resourceId}:`, err.message);
        resourceIndexes.set(resourceId, new Map());
      }
    });

    return rows.map((row, i) => {
      if (fromLog[i]) return { ...row, ...fromLog[i] };
      const idx = resourceIndexes.get(Number(row.resourceId));
      const hit = idx?.get(row.name);
      if (!hit) return { ...row, ...EMPTY_TRIGGER };
      return {
        ...row,
        lastTriggeredAt: hit.t,
        lastTriggerUnitId: null,
        lastTriggerUnitName: hit.unitName,
        lastTriggerText: hit.text,
      };
    });
  });
}

/**
 * Rows for the alerts panel. The Wialon payload is cached; bitácora links are
 * looked up on every call. `unitIds` keeps only notifications covering those GPS.
 * Pass `includeLastTrigger: true` (with unitIds) to attach last fire timestamps.
 */
export async function listNotifications({ unitIds = [], includeLastTrigger = false } = {}) {
  const rows = await getListSnapshot();
  const wanted = new Set(unitIds.map(String).filter(Boolean));
  const scoped = wanted.size
    ? rows.filter((n) => (n.units || []).some((u) => wanted.has(String(u))))
    : rows;
  const withBits = await attachActiveBitacoras(scoped);

  // Only enrich scoped lists (bitácora tab ~4 alerts). Global page skips this.
  if (includeLastTrigger && wanted.size > 0 && withBits.length > 0) {
    return enrichWithLastTriggers(withBits);
  }
  return withBits;
}

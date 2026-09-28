import mongoose from "mongoose";
import { wialonApiCall, withWialonSession } from "../utils/wialonClient.js";

const CLOSED_STATUSES = ["cerrada", "cerrada (e)", "finalizada"];
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

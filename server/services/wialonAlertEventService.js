import mongoose from "mongoose";
import Bitacora from "../models/Bitacora.js";
import EventType from "../models/EventType.js";
import WialonAlertProcessed from "../models/WialonAlertProcessed.js";
import { wialonApiCall, wialonLogout, getWialonToken } from "../utils/wialonClient.js";
import { CLOSED_STATUSES } from "./wialonNotificationService.js";

const LOOKBACK_SEC = Math.max(0, parseInt(process.env.WIALON_ALERT_EVENT_LOOKBACK_SEC || "120", 10));
const LOG_WINDOW_SEC = Math.max(LOOKBACK_SEC, 300);
const GIS_GEOCODE_FLAGS = 1255211008;

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

// Keep in sync with client/src/utils/wialonUtils.js PATTERN_TARGETS.
const PATTERN_TARGETS = [
  { test: (n) => n.includes("gpsnoposiciona") || n === "gpsoff", prefer: "Gps no posiciona" },
  { test: (n) => n.includes("desvioderuta"), prefer: "Desvió de ruta" },
  {
    test: (n) => n.includes("estadia") && n.includes("fuera"),
    prefer: "Estadia no Autorizada",
  },
  {
    test: (n) => n.includes("estadia") && n.includes("dentro") && n.includes("noautorizada"),
    prefer: "Estadia no Autorizada",
  },
  {
    test: (n) => n.includes("estadia") && n.includes("dentro"),
    prefer: "Estadia Autorizada",
  },
  { test: (n) => n.includes("estadianoautorizada"), prefer: "Estadia no Autorizada" },
  { test: (n) => n.includes("estadiaautorizada"), prefer: "Estadia Autorizada" },
];

function similarity(a, b) {
  const n1 = norm(a);
  const n2 = norm(b);
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1;
  if (n1.includes(n2)) return 0.8 + 0.2 * (n2.length / n1.length);
  if (n2.includes(n1)) return 0.8 + 0.2 * (n1.length / n2.length);
  return 0;
}

function findEventTypeByName(eventTypes, preferredName) {
  if (!preferredName) return null;
  const target = norm(preferredName);
  const exact = eventTypes.filter((et) => norm(et.evento) === target);
  if (exact.length) return exact.sort((a, b) => a.evento.length - b.evento.length)[0];
  const soft = eventTypes.filter((et) => {
    const n = norm(et.evento);
    return n === target || n.startsWith(target);
  });
  if (soft.length) return soft.sort((a, b) => a.evento.length - b.evento.length)[0];
  return null;
}

function findBestEventMatch(wialonName, eventTypes) {
  if (!wialonName || !eventTypes?.length) return null;
  const nAlert = norm(wialonName);

  for (const rule of PATTERN_TARGETS) {
    if (!rule.test(nAlert)) continue;
    const preferred = typeof rule.prefer === "function" ? rule.prefer(nAlert) : rule.prefer;
    const match = findEventTypeByName(eventTypes, preferred);
    if (match) return match;
  }

  let best = null;
  let score = 0;
  for (const et of eventTypes) {
    const s = similarity(wialonName, et.evento);
    if (s > score || (s === score && best && et.evento.length < best.evento.length)) {
      score = s;
      best = et;
    }
  }
  return best && score >= 0.7 ? best : null;
}

function unitKeyVariants(id) {
  const s = String(id ?? "").trim();
  if (!s) return [];
  const out = new Set([s]);
  const n = Number(s);
  if (!Number.isNaN(n)) out.add(String(n));
  return [...out];
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 60) return `Hace ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

function formatPosTime(ts) {
  if (!ts) return "";
  return new Date(Number(ts) * 1000).toLocaleString("es-MX");
}

async function reverseGeocode(session, lon, lat) {
  const base = session?.gisGeocodeUrl;
  const uid = session?.uid;
  if (!base || !uid || !Number.isFinite(lon) || !Number.isFinite(lat)) return "";
  try {
    const url = new URL("/gis_geocode", base.endsWith("/") ? base : `${base}/`);
    url.searchParams.set("coords", JSON.stringify([{ lon, lat }]));
    url.searchParams.set("flags", String(GIS_GEOCODE_FLAGS));
    url.searchParams.set("uid", String(uid));
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return "";
    const data = await res.json();
    if (Array.isArray(data) && data[0]) {
      return Array.isArray(data[0]) ? data[0].join(", ") : String(data[0]);
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * Last known GPS for a Wialon unit (same fields the client Auto-evento uses).
 * Uses core/search_item flags: base (1) + last message/position (0x400 = 1024).
 */
async function fetchUnitGpsSnapshot(session, unitId, { triggeredAt = 0 } = {}) {
  const empty = {
    ubicacion: "",
    duracion: "",
    ultimo_posicionamiento: formatPosTime(triggeredAt),
    velocidad: "",
    coordenadas: "",
  };
  const id = Number(unitId);
  if (!id || Number.isNaN(id) || !session?.sid) return empty;

  try {
    const res = await wialonApiCall(
      "core/search_item",
      { id, flags: 0x00000001 | 0x00000400 },
      session.sid
    );
    if (res?.error) {
      console.warn(`[wialon-alert-events] search_item error ${res.error} for unit ${unitId}`);
      return empty;
    }
    const item = res?.item || res;
    const pos = item?.pos || item?.lmsg?.pos || null;
    if (!pos || (pos.y == null && pos.x == null)) return empty;

    const lat = Number(pos.y);
    const lon = Number(pos.x);
    const posTs = Number(pos.t) || Number(triggeredAt) || 0;
    const nowSec = Math.floor(Date.now() / 1000);

    let ubicacion = typeof pos.l === "string" ? pos.l : "";
    if (!ubicacion && Number.isFinite(lat) && Number.isFinite(lon)) {
      ubicacion = await reverseGeocode(session, lon, lat);
    }

    return {
      ubicacion: ubicacion || "",
      duracion: posTs ? formatDuration(Math.max(0, nowSec - posTs)) : "",
      ultimo_posicionamiento: formatPosTime(posTs || triggeredAt),
      velocidad: pos.s != null ? pos.s : "",
      coordenadas:
        Number.isFinite(lat) && Number.isFinite(lon) ? `${lat}, ${lon}` : "",
    };
  } catch (err) {
    console.warn(`[wialon-alert-events] GPS fetch failed for unit ${unitId}:`, err.message);
    return empty;
  }
}

/**
 * Open bitácoras that have at least one linked Wialon notification + GPS unit.
 * Returns bindings ready for log matching.
 */
async function loadOpenBindings() {
  const col = mongoose.connection.db.collection("bitacoras");
  const docs = await col
    .find(
      {
        deleted: { $ne: true },
        status: { $nin: CLOSED_STATUSES },
        "transportes.notificaciones.0": { $exists: true },
        "transportes.gpsUnits.0": { $exists: true },
      },
      {
        projection: {
          _id: 1,
          bitacora_id: 1,
          status: 1,
          transportes: 1,
        },
      }
    )
    .toArray();

  // notifKey -> { resourceId, notifId, name, unitToTargets: Map<unitId, [{bitacoraId, transporte}]> }
  const notifs = new Map();

  for (const bit of docs) {
    for (const t of bit.transportes || []) {
      const units = (t.gpsUnits || [])
        .map((u) => (u?.wialonId != null ? String(u.wialonId).trim() : ""))
        .filter(Boolean);
      if (!units.length) continue;

      for (const n of t.notificaciones || []) {
        if (n?.resourceId == null || n?.notifId == null) continue;
        const nk = `${n.resourceId}_${n.notifId}`;
        if (!notifs.has(nk)) {
          notifs.set(nk, {
            resourceId: Number(n.resourceId),
            notifId: Number(n.notifId),
            name: n.name || "",
            unitToTargets: new Map(),
          });
        }
        const entry = notifs.get(nk);
        if (!entry.name && n.name) entry.name = n.name;

        for (const uid of units) {
          for (const variant of unitKeyVariants(uid)) {
            if (!entry.unitToTargets.has(variant)) entry.unitToTargets.set(variant, []);
            entry.unitToTargets.get(variant).push({
              bitacoraMongoId: bit._id,
              bitacora_id: bit.bitacora_id,
              transporte: t,
            });
          }
        }
      }
    }
  }

  return [...notifs.values()];
}

async function fetchNotifLog(sid, resourceId, notifId, from, to) {
  const logData = await wialonApiCall(
    "resource/get_notifications_log",
    {
      itemId: Number(resourceId),
      col: [Number(notifId)],
      from: Number(from),
      to: Number(to),
    },
    sid
  );

  if (!logData || logData.error) return [];

  const key = String(notifId);
  let entries = [];
  if (logData[key] && Array.isArray(logData[key].log)) {
    entries = logData[key].log;
  } else if (logData[notifId] && Array.isArray(logData[notifId].log)) {
    entries = logData[notifId].log;
  } else {
    const firstKey = Object.keys(logData).find((k) => logData[k] && Array.isArray(logData[k].log));
    if (firstKey) entries = logData[firstKey].log;
  }

  return entries.map((e) => ({
    t: Number(e.t || e.tm || 0),
    u: e.u != null ? String(e.u) : e.unit_name != null ? String(e.unit_name) : "",
    txt: e.txt || "",
  }));
}

async function createEventFromAlert({
  session,
  bitacoraMongoId,
  transporte,
  eventType,
  notifName,
  unitId,
  triggeredAt,
  resourceId,
  notifId,
}) {
  const bitacora = await Bitacora.findOne({
    _id: bitacoraMongoId,
    deleted: { $ne: true },
    status: { $nin: CLOSED_STATUSES },
  });
  if (!bitacora) return { created: false, reason: "bitacora_closed" };

  const liveT =
    (bitacora.transportes || []).find((t) => String(t.id) === String(transporte.id)) || transporte;

  const descripcion = `Alerta Wialon: ${notifName}`;
  const dedupKey = `${bitacoraMongoId}_${resourceId}_${notifId}_${unitId}_${triggeredAt}`;

  try {
    await WialonAlertProcessed.create({
      dedupKey,
      bitacoraId: bitacoraMongoId,
      resourceId: Number(resourceId),
      notifId: Number(notifId),
      unitId: String(unitId),
      triggeredAt,
      eventNombre: eventType.evento,
    });
  } catch (err) {
    if (err?.code === 11000) return { created: false, reason: "duplicate" };
    throw err;
  }

  // Also skip if an identical auto-event was already saved in the last few minutes
  // (covers restarts before the processed doc was written in older versions).
  const recentDup = (bitacora.eventos || []).some((ev) => {
    if (ev.descripcion !== descripcion) return false;
    if (ev.nombre !== eventType.evento) return false;
    const ageMs = Math.abs(Date.now() - new Date(ev.createdAt || 0).getTime());
    return ageMs < 5 * 60 * 1000;
  });
  if (recentDup) return { created: false, reason: "recent_duplicate" };

  const lastIdx = bitacora.eventos.length - 1;
  if (lastIdx >= 0) {
    const prev = bitacora.eventos[lastIdx];
    const elapsed = Date.now() - new Date(prev.createdAt).getTime();
    const windowMs = (prev.frecuencia || 0) * 60000;
    prev.isFrecuenciaMet = elapsed <= windowMs;
    bitacora.markModified("eventos");
  }

  const gpsUnit =
    (liveT.gpsUnits || []).find((g) => unitKeyVariants(g.wialonId).includes(String(unitId))) ||
    (liveT.gpsUnits || [])[0] ||
    { wialonId: String(unitId), name: `GPS ${unitId}` };

  const gpsData = await fetchUnitGpsSnapshot(session, unitId || gpsUnit.wialonId, { triggeredAt });

  const transportePayload = {
    ...(typeof liveT.toObject === "function" ? liveT.toObject() : { ...liveT }),
    registro: { ...gpsData },
    gpsData: [
      {
        wialonId: gpsUnit.wialonId,
        name: gpsUnit.name,
        data: { ...gpsData },
      },
    ],
  };

  bitacora.eventos.push({
    nombre: eventType.evento,
    descripcion,
    registrado_por: "Sistema Wialon",
    frecuencia: 10,
    transportes: [transportePayload],
  });

  await bitacora.save();
  return {
    created: true,
    bitacora_id: bitacora.bitacora_id,
    evento: eventType.evento,
    hasGps: Boolean(gpsData.coordenadas),
  };
}

/**
 * Poll Wialon notification logs for linked open bitácoras and auto-create events.
 * Safe to call on an interval; skips history older than the lookback window.
 */
export async function processTriggeredAlerts() {
  const summary = { notifs: 0, logEntries: 0, created: 0, skipped: 0, failed: 0 };

  if (!process.env.WIALON_API_TOKEN) {
    return { ...summary, skipped: 1, reason: "no_token" };
  }

  const bindings = await loadOpenBindings();
  summary.notifs = bindings.length;
  if (!bindings.length) return summary;

  const eventTypes = await EventType.find({}).lean();
  const now = Math.floor(Date.now() / 1000);
  const from = now - LOG_WINDOW_SEC;

  // Full login (not just sid): GIS reverse-geocode needs user id + gis_geocode host.
  const login = await wialonApiCall("token/login", { token: getWialonToken() });
  if (login?.error || !login?.eid) {
    throw new Error(`Wialon auth error: ${login?.error || "no session"}`);
  }
  const session = {
    sid: login.eid,
    uid: login.user?.id,
    gisGeocodeUrl: login.gis_geocode || "https://geocode-maps.wialon.us",
  };

  try {
    for (const binding of bindings) {
      const eventType = findBestEventMatch(binding.name, eventTypes);
      if (!eventType) {
        summary.skipped += 1;
        continue;
      }

      let entries = [];
      try {
        entries = await fetchNotifLog(session.sid, binding.resourceId, binding.notifId, from, now);
      } catch (err) {
        console.error(
          `[wialon-alert-events] log fetch failed for ${binding.resourceId}/${binding.notifId}:`,
          err.message
        );
        summary.failed += 1;
        continue;
      }

      const minTs = now - LOOKBACK_SEC;
      for (const entry of entries) {
        if (!entry.t || entry.t < minTs) continue;
        summary.logEntries += 1;

        const unitVariants = unitKeyVariants(entry.u);
        let targets = [];
        for (const v of unitVariants) {
          const hits = binding.unitToTargets.get(v);
          if (hits?.length) targets.push(...hits);
        }
        // Dedup targets by bitacora+transporte
        const seen = new Set();
        targets = targets.filter((t) => {
          const k = `${t.bitacoraMongoId}_${t.transporte?.id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        if (!targets.length) {
          summary.skipped += 1;
          continue;
        }

        for (const target of targets) {
          try {
            const result = await createEventFromAlert({
              session,
              bitacoraMongoId: target.bitacoraMongoId,
              transporte: target.transporte,
              eventType,
              notifName: binding.name || eventType.evento,
              unitId: entry.u || unitVariants[0],
              triggeredAt: entry.t,
              resourceId: binding.resourceId,
              notifId: binding.notifId,
            });
            if (result.created) {
              summary.created += 1;
              console.log(
                `[wialon-alert-events] created "${result.evento}" on ${result.bitacora_id} (unit ${entry.u}${result.hasGps ? ", gps ok" : ", gps empty"})`
              );
            } else {
              summary.skipped += 1;
            }
          } catch (err) {
            summary.failed += 1;
            console.error("[wialon-alert-events] create failed:", err.message);
          }
        }
      }
    }
  } finally {
    await wialonLogout(session.sid);
  }

  return summary;
}

export default { processTriggeredAlerts };

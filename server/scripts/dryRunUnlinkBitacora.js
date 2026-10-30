/**
 * Read-only dry-run: show which GPS would be kept vs unlinked for a bitácora.
 *
 * Usage:
 *   node server/scripts/dryRunUnlinkBitacora.js 16628
 *   node server/scripts/dryRunUnlinkBitacora.js 016628
 *
 * Does NOT write to Mongo or Wialon. Re-evaluates other non-cerrada bitácoras
 * at execution time. Requires authorization before any real unlink.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import {
  collectBitacoraNotifBindings,
  getGpsUnitsKeptByOtherBitacoras,
  planUnlinkBindings,
  isStatusCerrada,
} from "../services/wialonNotificationService.js";

dotenv.config();

const target = String(process.argv[2] || "").trim();
if (!target) {
  console.error("Usage: node server/scripts/dryRunUnlinkBitacora.js <bitacora_id>");
  process.exit(1);
}

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGO_URI not configured");
  process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const col = mongoose.connection.db.collection("bitacoras");

const padded = target.replace(/^0+/, "") || "0";
const candidates = [
  target,
  target.padStart(6, "0"),
  padded,
  padded.padStart(6, "0"),
];

const bit = await col.findOne({
  $or: [
    { bitacora_id: { $in: [...new Set(candidates)] } },
    { bitacora_id: { $regex: new RegExp(`${padded}$`) } },
  ],
});

if (!bit) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        error: "bitacora_not_found_in_this_database",
        searched: [...new Set(candidates)],
        database: mongoose.connection.db.databaseName,
        note:
          "Case 16628 was not in the Prueba DB during investigation; run this against the DB that holds the bitácora. Do not unlink in production without explicit authorization.",
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
  process.exit(2);
}

const bindings = collectBitacoraNotifBindings(bit);
const { unitIds: keptUnits, ok } = await getGpsUnitsKeptByOtherBitacoras(bit._id);
const plan = planUnlinkBindings(bindings, keptUnits, ok);

const unitMeta = new Map();
for (const t of bit.transportes || []) {
  for (const u of t.gpsUnits || []) {
    if (u?.wialonId != null) unitMeta.set(String(u.wialonId).trim(), u.name || null);
  }
}

const summarize = (rows) => {
  const byUnit = new Map();
  for (const b of rows) {
    if (!byUnit.has(b.unitId)) {
      byUnit.set(b.unitId, {
        unitId: b.unitId,
        name: unitMeta.get(b.unitId) || null,
        notifications: [],
      });
    }
    byUnit.get(b.unitId).notifications.push({
      resourceId: b.resourceId,
      notifId: b.notifId,
    });
  }
  return [...byUnit.values()];
};

console.log(
  JSON.stringify(
    {
      ok: true,
      dryRun: true,
      database: mongoose.connection.db.databaseName,
      bitacora_id: bit.bitacora_id,
      _id: String(bit._id),
      status: bit.status,
      statusIsCerrada: isStatusCerrada(bit.status),
      deleted: bit.deleted === true,
      lookupOk: ok,
      wouldKeep: summarize(plan.skippedShared).map((u) => ({
        ...u,
        reason: "related_to_another_bitacora_with_status_neq_cerrada",
      })),
      wouldUnlink: summarize(plan.toUnlink).map((u) => ({
        ...u,
        reason: "no_other_non_cerrada_bitacora_for_this_gps",
      })),
      error: plan.error || null,
      warning:
        "This is a dry-run only. Re-run immediately before any authorized write; other bitácoras may change. Do not execute production unlinks without explicit approval.",
    },
    null,
    2
  )
);

await mongoose.disconnect();

import mongoose from "mongoose";

/**
 * Dedup store for auto-created bitácora events from Wialon notification triggers.
 * Unique on dedupKey so the same log entry is never applied twice.
 */
const schema = new mongoose.Schema(
  {
    dedupKey: { type: String, required: true, unique: true, index: true },
    bitacoraId: { type: mongoose.Schema.Types.ObjectId, ref: "Bitacora" },
    resourceId: Number,
    notifId: Number,
    unitId: String,
    triggeredAt: Number,
    eventNombre: String,
  },
  { timestamps: true }
);

// TTL: drop processed keys after 30 days so the collection stays bounded.
schema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

export default mongoose.model("WialonAlertProcessed", schema);

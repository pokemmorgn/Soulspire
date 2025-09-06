import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * AfkSession = trace des périodes "AFK" (utile pour analytics/anti-cheat).
 * Pour le proto, on ne l'utilise pas pour le calcul (c'est AfkState.tick/claim),
 * mais on le garde "à la AFK Arena" pour start/heartbeat/stop.
 */

export type AfkSessionStatus = "running" | "ended";

export interface IAfkSession extends Document {
  playerId: string; // ← CHANGÉ de Types.ObjectId à string
  deviceId?: string | null;
  source: "idle" | "offline";     // "idle": app ouverte mais inactif ; "offline": app fermée
  status: AfkSessionStatus;

  startedAt: Date;
  lastHeartbeatAt: Date;
  endedAt?: Date | null;
}

const AfkSessionSchema = new Schema<IAfkSession>({
playerId: {
  type: String,
  required: true,
  index: true,
},
  deviceId: { type: String, default: null },
  source: { type: String, enum: ["idle", "offline"], default: "idle", index: true },
  status: { type: String, enum: ["running", "ended"], default: "running", index: true },

  startedAt: { type: Date, required: true, default: () => new Date() },
  lastHeartbeatAt: { type: Date, required: true, default: () => new Date(), index: true },
  endedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: "afk_sessions",
});

// Index combinés utiles pour fermer les sessions orphelines
AfkSessionSchema.index({ playerId: 1, status: 1 });
AfkSessionSchema.index({ status: 1, lastHeartbeatAt: -1 });

export default mongoose.model<IAfkSession>("AfkSession", AfkSessionSchema);

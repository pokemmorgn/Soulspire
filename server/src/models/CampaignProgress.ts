// models/CampaignProgress.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ILevelStar {
  levelIndex: number;
  stars: number;         // 0..3 par ex. si tu fais un scoring
  bestTimeMs?: number;
}

export interface ICampaignProgress extends Document {
  playerId: string;
  serverId: string;      // ✅ progression par serveur
  worldId: number;       // monde concerné
  highestLevelCleared: number; // plus haut niveau battu (ex: 7 => accès au 8)
  starsByLevel: ILevelStar[];
}

const campaignProgressSchema = new Schema<ICampaignProgress>({
  playerId: { type: String, required: true, index: true },
  serverId: { type: String, required: true, match: /^S\d+$/, index: true },
  worldId: { type: Number, required: true, index: true },
  highestLevelCleared: { type: Number, default: 0 },
  starsByLevel: [{
    levelIndex: { type: Number, required: true },
    stars: { type: Number, min: 0, max: 3, default: 0 },
    bestTimeMs: { type: Number, min: 0 }
  }]
}, { timestamps: true, collection: "campaign_progress" });

campaignProgressSchema.index({ playerId: 1, serverId: 1, worldId: 1 }, { unique: true });

export default mongoose.model<ICampaignProgress>("CampaignProgress", campaignProgressSchema);

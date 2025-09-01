// models/CampaignWorld.ts
import mongoose, { Schema, Document } from "mongoose";

export type Elem = "Fire"|"Water"|"Wind"|"Electric"|"Light"|"Dark";
export type EnemyType = "normal"|"elite"|"boss";

export interface ILevelRewards {
  experience: number;
  gold: number;
  items?: string[];
  fragments?: { heroId: string; quantity: number }[];
}

export interface ILevelModifiers {
  elementalAura?: Elem;
  atkBuffPct?: number; // 0.10 = +10% ATK
  defBuffPct?: number; // 0.10 = +10% DEF
}

export interface ILevelConfig {
  levelIndex: number;            // 1..levelCount
  name: string;
  enemyType?: EnemyType;         // override (sinon auto: 5/10/15 = elite, 14/16/20 = boss...)
  enemyCount?: number;           // override (défaut: normal=3, elite=2, boss=1)
  difficultyMultiplier?: number; // ex: 1.0, 1.06, 1.12...
  staminaCost?: number;          // si tu gères de l’endurance
  rewards?: ILevelRewards;
  enemyPoolTags?: string[];      // filtre de pool d’ennemis (ex: ["forest","beast"])
  modifiers?: ILevelModifiers;   // auras, buffs globaux, etc.
}

export interface ICampaignWorld extends Document {
  worldId: number;                            // identifiant global du monde
  name: string;
  description?: string;
  mapTheme?: string;
  levelCount: number;
  minPlayerLevel: number;                     // ✅ exigence : niveau mini pour entrer dans ce monde
  recommendedPower?: number;
  elementBias?: Elem[];
  levels: ILevelConfig[];
}

const levelSchema = new Schema<ILevelConfig>({
  levelIndex: { type: Number, required: true },
  name: { type: String, required: true },
  enemyType: { type: String, enum: ["normal","elite","boss"] },
  enemyCount: { type: Number, min: 1 },
  difficultyMultiplier: { type: Number, min: 0.1, default: 1.0 },
  staminaCost: { type: Number, min: 0, default: 6 },
  rewards: {
    experience: { type: Number, default: 50 },
    gold: { type: Number, default: 30 },
    items: [{ type: String }],
    fragments: [{ heroId: String, quantity: { type: Number, min: 1 } }]
  },
  enemyPoolTags: [{ type: String }],
  modifiers: {
    elementalAura: { type: String, enum: ["Fire","Water","Wind","Electric","Light","Dark"] },
    atkBuffPct: { type: Number, min: 0, max: 1 },
    defBuffPct: { type: Number, min: 0, max: 1 }
  }
});

const campaignWorldSchema = new Schema<ICampaignWorld>({
  worldId: { type: Number, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: String,
  mapTheme: String,
  levelCount: { type: Number, required: true, min: 1 },
  minPlayerLevel: { type: Number, required: true, min: 1 }, // ✅
  recommendedPower: { type: Number, default: 100 },
  elementBias: [{ type: String, enum: ["Fire","Water","Wind","Electric","Light","Dark"] }],
  levels: { type: [levelSchema], default: [] }
}, { timestamps: true, collection: "campaign_worlds" });

export default mongoose.model<ICampaignWorld>("CampaignWorld", campaignWorldSchema);

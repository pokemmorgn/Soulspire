// models/CampaignWorld.ts
import mongoose, { Schema, Document } from "mongoose";

export type Elem = "Fire"|"Water"|"Wind"|"Electric"|"Light"|"Dark";
export type EnemyType = "normal"|"elite"|"boss";

// ✨ NOUVEAU : Configuration des monstres pour un niveau
export interface ILevelMonsterConfig {
  monsterId: string;        // "MON_fire_goblin" ou "BOSS_shadow_dragon"
  count?: number;           // Nombre de ce monstre (défaut: 1)
  position?: number;        // Position spécifique (1-5) si besoin
  levelOverride?: number;   // Override du niveau du monstre
  starsOverride?: number;   // Override des étoiles (défaut: 3)
}

// ✨ NOUVEAU : Configuration auto-génération si monsters est vide
export interface ILevelAutoGenerate {
  useWorldPool: boolean;    // Utiliser defaultMonsterPool du monde
  count: number;            // Nombre de monstres à générer
  enemyType: "normal" | "elite" | "boss";
}

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
  monsters?: ILevelMonsterConfig[];
  autoGenerate?: ILevelAutoGenerate;
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
  defaultMonsterPool?: string[];
  levels: ILevelConfig[];
}

const levelSchema = new Schema<ILevelConfig>({
  levelIndex: { type: Number, required: true },
  name: { type: String, required: true },
  monsters: [{
    monsterId: { type: String, required: true },
    count: { type: Number, min: 1, default: 1 },
    position: { type: Number, min: 1, max: 5 },
    levelOverride: { type: Number, min: 1 },
    starsOverride: { type: Number, min: 1, max: 6 }
  }],
  autoGenerate: {
    useWorldPool: { type: Boolean, default: true },
    count: { type: Number, min: 1, default: 3 },
    enemyType: { type: String, enum: ["normal","elite","boss"], default: "normal" }
  },
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
  defaultMonsterPool: [{ type: String }],
  levels: { type: [levelSchema], default: [] }
}, { timestamps: true, collection: "campaign_worlds" });

export default mongoose.model<ICampaignWorld>("CampaignWorld", campaignWorldSchema);

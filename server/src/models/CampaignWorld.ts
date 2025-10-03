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
//  Configuration d'une vague de monstres
export interface IWaveConfig {
  waveNumber: number;                   // Numéro de la vague (1, 2, 3...)
  monsters: ILevelMonsterConfig[];      // Monstres de cette vague
  autoGenerate?: ILevelAutoGenerate;    // Génération auto alternative
  delay: number;                        // Délai avant spawn (ms) - défaut: 3000
  isBossWave?: boolean;                 // true si vague de boss
  waveRewards?: ILevelRewards;          // Récompenses spécifiques à cette vague (optionnel)
}

//  Configuration des récompenses de vagues
export interface IWaveRewardsConfig {
  perWave: ILevelRewards;               // Récompenses distribuées après chaque vague
  finalWave: ILevelRewards;             // Bonus final si toutes les vagues sont terminées
  totalIfAllCompleted?: ILevelRewards;  // Récompenses totales alternatives (override)
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
  waves?: IWaveConfig[];                // Configuration des vagues (si undefined = combat classique)
  waveRewards?: IWaveRewardsConfig;     // Récompenses par vague (si waves est défini)
  enableWaves?: boolean;                // Active le système de vagues auto (false par défaut)
  autoWaveCount?: number;               // Nombre de vagues auto (défaut selon enemyType)
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
  },
  waves: [{
    waveNumber: { type: Number, required: true, min: 1 },
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
    delay: { type: Number, min: 0, default: 3000 },
    isBossWave: { type: Boolean, default: false },
    waveRewards: {
      experience: { type: Number, default: 0 },
      gold: { type: Number, default: 0 },
      items: [{ type: String }],
      fragments: [{ heroId: String, quantity: { type: Number, min: 1 } }]
    }
  }],
  
  waveRewards: {
    perWave: {
      experience: { type: Number, default: 0 },
      gold: { type: Number, default: 0 },
      items: [{ type: String }],
      fragments: [{ heroId: String, quantity: { type: Number, min: 1 } }]
    },
    finalWave: {
      experience: { type: Number, default: 0 },
      gold: { type: Number, default: 0 },
      items: [{ type: String }],
      fragments: [{ heroId: String, quantity: { type: Number, min: 1 } }]
    },
    totalIfAllCompleted: {
      experience: { type: Number, default: 0 },
      gold: { type: Number, default: 0 },
      items: [{ type: String }],
      fragments: [{ heroId: String, quantity: { type: Number, min: 1 } }]
    }
  },
  
  enableWaves: { type: Boolean, default: false },
  autoWaveCount: { type: Number, min: 1, max: 10, default: 3 }
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

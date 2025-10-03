// server/src/models/Monster.ts
import mongoose, { Document, Schema } from "mongoose";
import { IdGenerator } from "../utils/idGenerator";

/**
 * 👹 MODÈLE MONSTER - Inspiré d'AFK Arena
 * 
 * Dans AFK Arena, les monstres ont:
 * - Des factions (comme Maulers, Wilders, Graveborn, etc.)
 * - Des rôles de combat (Tank, Warrior, Mage, Ranger, Support)
 * - Des apparences thématiques par monde
 * - Des boss uniques avec mechanics spéciales
 */

// Types d'éléments (correspondent aux héros)
export type MonsterElement = "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";

// Types de monstres
export type MonsterType = "normal" | "elite" | "boss";

// Rôles de combat
export type MonsterRole = "Tank" | "DPS Melee" | "DPS Ranged" | "Support";

// Raretés (pour scaling des stats)
export type MonsterRarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";

// Thèmes visuels (AFK Arena style: forest, desert, undead, etc.)
export type VisualTheme = 
  | "forest"        // Créatures forestières (gobelins, loups, ents)
  | "beast"         // Bêtes sauvages (ours, tigres, dragons mineurs)
  | "undead"        // Morts-vivants (squelettes, zombies, liches)
  | "demon"         // Démons (imps, démons majeurs)
  | "elemental"     // Élémentaires purs (feu, eau, vent, etc.)
  | "construct"     // Golems, automates magiques
  | "celestial"     // Créatures lumineuses, anges corrompus
  | "shadow"        // Créatures d'ombre, assassins
  | "dragon"        // Dragons et drakes
  | "giant"         // Géants, trolls, ogres
  | "insect"        // Créatures insectoïdes
  | "aquatic"       // Créatures marines
  | "corrupted";    // Versions corrompues de créatures normales

// Interface pour les sorts équipés (comme les héros)
interface IMonsterSpells {
  spell1?: { id: string; level: number };
  spell2?: { id: string; level: number };
  spell3?: { id: string; level: number };
  ultimate: { id: string; level: number };
  passive?: { id: string; level: number };
}

// Interface pour les mechanics spéciales des boss
interface IBossMechanics {
  enrageAtHpPercent?: number;        // Boss enrage à X% HP
  summonMinionsAt?: number[];        // Invoque des adds à [75%, 50%, 25%] HP
  phaseTransitions?: number[];       // Change de phase à [66%, 33%] HP
  specialAbilities?: string[];       // Capacités uniques ["fire_rain", "shield_phase"]
  immunities?: string[];             // Immunités ["stun", "freeze"]
  weaknesses?: string[];             // Faiblesses ["fire_damage", "magic_damage"]
}

// Interface pour le loot (ce que drop le monstre)
interface IMonsterLoot {
  guaranteed?: {                     // Loot garanti
    gold: { min: number; max: number };
    experience: number;
  };
  possibleDrops?: {                  // Loot possible
    itemId: string;
    dropRate: number;                // 0.0 à 1.0
  }[];
  fragmentDrops?: {                  // Fragments de héros
    heroId: string;
    quantity: number;
    dropRate: number;
  }[];
}

// Document principal
export interface IMonsterDocument extends Document {
  _id: string;
  monsterId: string;                 // MON_fire_goblin, BOSS_shadow_dragon
  name: string;                      // "Fire Goblin", "Shadow Dragon"
  displayName?: string;              // Nom affiché (peut être traduit)
  description?: string;              // Description lore
  
  // Classification
  type: MonsterType;                 // normal, elite, boss
  element: MonsterElement;           // Fire, Water, etc.
  role: MonsterRole;                 // Tank, DPS, Support
  rarity: MonsterRarity;             // Common, Rare, Epic, Legendary, Mythic
  
  // Visuel et thématique
  visualTheme: VisualTheme;          // forest, undead, demon, etc.
  spriteId?: string;                 // ID du sprite pour Unity
  animationSet?: string;             // Set d'animations (idle, attack, death)
  
  // Stats de base (niveau 1, 1 étoile)
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    crit: number;
    critDamage: number;
    critResist: number;
    dodge: number;
    accuracy: number;
    vitesse: number;
    moral: number;
    reductionCooldown: number;
    healthleech: number;
    healingBonus: number;
    shieldBonus: number;
    energyRegen: number;
  };
  
  // Sorts et capacités
  spells: IMonsterSpells;
  
  // Mechanics spéciales (surtout pour les boss)
  bossMechanics?: IBossMechanics;
  
  // Apparition (dans quels mondes/niveaux)
  worldTags: number[];               // [1, 2, 3] = apparaît dans mondes 1-3
  minWorldLevel?: number;            // Niveau de monde minimum
  maxWorldLevel?: number;            // Niveau de monde maximum
  
  // Loot
  loot?: IMonsterLoot;
  
  // Flags
  isUnique?: boolean;                // Vrai pour les boss uniques
  isSummonable?: boolean;            // Peut être invoqué par d'autres monstres
  canSummon?: boolean;               // Peut invoquer d'autres monstres
  
  // Métadonnées
  createdAt?: Date;
  updatedAt?: Date;
  
  // Méthodes
  getStatsAtLevel(level: number, stars?: number): any;
  getRarityMultiplier(): number;
  getElementAdvantage(targetElement: string): number;
  getAllSpells(): Array<{ slot: string; id: string; level: number }>;
  isBoss(): boolean;
  isElite(): boolean;
  canAppearInWorld(worldId: number): boolean;
}

// Schéma Mongoose
const monsterSchema = new Schema<IMonsterDocument>({
  _id: {
    type: String,
    required: true,
    default: () => `MON_${IdGenerator.generateCompactUUID().slice(0, 8)}`
  },
  monsterId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  // Classification
  type: {
    type: String,
    enum: ["normal", "elite", "boss"],
    required: true,
    default: "normal",
    index: true
  },
  element: {
    type: String,
    enum: ["Fire", "Water", "Wind", "Electric", "Light", "Dark"],
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ["Tank", "DPS Melee", "DPS Ranged", "Support"],
    required: true,
    index: true
  },
  rarity: {
    type: String,
    enum: ["Common", "Rare", "Epic", "Legendary", "Mythic"],
    required: true,
    default: "Common"
  },
  
  // Visuel
  visualTheme: {
    type: String,
    enum: [
      "forest", "beast", "undead", "demon", "elemental",
      "construct", "celestial", "shadow", "dragon", "giant",
      "insect", "aquatic", "corrupted"
    ],
    required: true,
    index: true
  },
  spriteId: String,
  animationSet: String,
  
  // Stats de base
  baseStats: {
    hp: { type: Number, required: true, min: 100, max: 20000 },
    atk: { type: Number, required: true, min: 10, max: 4000 },
    def: { type: Number, required: true, min: 10, max: 2000 },
    
    crit: { type: Number, required: true, min: 0, max: 100, default: 5 },
    critDamage: { type: Number, required: true, min: 0, default: 50 },
    critResist: { type: Number, required: true, min: 0, max: 100, default: 0 },
    dodge: { type: Number, required: true, min: 0, max: 100, default: 0 },
    accuracy: { type: Number, required: true, min: 0, max: 100, default: 0 },
    
    vitesse: { type: Number, required: true, min: 50, max: 200, default: 80 },
    moral: { type: Number, required: true, min: 30, max: 200, default: 60 },
    reductionCooldown: { type: Number, required: true, min: 0, max: 50, default: 0 },
    healthleech: { type: Number, required: true, min: 0, max: 100, default: 0 },
    
    healingBonus: { type: Number, required: true, min: 0, default: 0 },
    shieldBonus: { type: Number, required: true, min: 0, default: 0 },
    energyRegen: { type: Number, required: true, min: 0, default: 10 }
  },
  
  // Sorts
  spells: {
    spell1: {
      id: { type: String },
      level: { type: Number, default: 1, min: 1, max: 10 }
    },
    spell2: {
      id: { type: String },
      level: { type: Number, default: 1, min: 1, max: 10 }
    },
    spell3: {
      id: { type: String },
      level: { type: Number, default: 1, min: 1, max: 10 }
    },
    ultimate: {
      id: { type: String, required: true },
      level: { type: Number, default: 1, min: 1, max: 5 }
    },
    passive: {
      id: { type: String },
      level: { type: Number, default: 1, min: 1, max: 5 }
    }
  },
  
  // Boss mechanics
  bossMechanics: {
    enrageAtHpPercent: { type: Number, min: 0, max: 100 },
    summonMinionsAt: [{ type: Number, min: 0, max: 100 }],
    phaseTransitions: [{ type: Number, min: 0, max: 100 }],
    specialAbilities: [{ type: String }],
    immunities: [{ type: String }],
    weaknesses: [{ type: String }]
  },
  
  // Apparition
  worldTags: {
    type: [{ type: Number, min: 1, max: 20 }],
    required: true,
    default: []
  },
  minWorldLevel: { type: Number, min: 1, max: 20 },
  maxWorldLevel: { type: Number, min: 1, max: 20 },
  
  // Loot
  loot: {
    guaranteed: {
      gold: {
        min: { type: Number, min: 0, default: 10 },
        max: { type: Number, min: 0, default: 50 }
      },
      experience: { type: Number, min: 0, default: 20 }
    },
    possibleDrops: [{
      itemId: { type: String, required: true },
      dropRate: { type: Number, min: 0, max: 1, required: true }
    }],
    fragmentDrops: [{
      heroId: { type: String, required: true },
      quantity: { type: Number, min: 1, required: true },
      dropRate: { type: Number, min: 0, max: 1, required: true }
    }]
  },
  
  // Flags
  isUnique: { type: Boolean, default: false, index: true },
  isSummonable: { type: Boolean, default: false },
  canSummon: { type: Boolean, default: false }
  
}, {
  timestamps: true,
  collection: "monsters"
});

// Index composés pour requêtes optimisées
monsterSchema.index({ type: 1, element: 1 });
monsterSchema.index({ visualTheme: 1, worldTags: 1 });
monsterSchema.index({ type: 1, worldTags: 1 });
monsterSchema.index({ element: 1, role: 1 });

// ═══════════════════════════════════════════════════════════════════
// MÉTHODES D'INSTANCE
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculer les stats à un niveau et étoiles donnés
 */
monsterSchema.methods.getStatsAtLevel = function(level: number = 1, stars: number = 3) {
  const levelMul = 1 + (level - 1) * 0.08;
  const starMul = 1 + (stars - 1) * 0.15;
  const mul = levelMul * starMul;
  const b = this.baseStats;
  
  // Cap helper
  const cap = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const scalePercent = (base: number, factor: number, capMax = 100) => cap(base * factor, 0, capMax);
  
  return {
    hp: Math.floor(b.hp * mul),
    maxHp: Math.floor(b.hp * mul),
    atk: Math.floor(b.atk * mul),
    def: Math.floor(b.def * mul),
    
    crit: scalePercent(b.crit, 1 + (mul - 1) * 0.2),
    critDamage: Math.floor(b.critDamage * (1 + (mul - 1) * 0.15)),
    critResist: scalePercent(b.critResist, 1 + (mul - 1) * 0.2),
    dodge: scalePercent(b.dodge, 1 + (mul - 1) * 0.2),
    accuracy: scalePercent(b.accuracy, 1 + (mul - 1) * 0.2),
    
    vitesse: Math.floor(b.vitesse * (1 + (mul - 1) * 0.5)),
    speed: Math.floor(b.vitesse * (1 + (mul - 1) * 0.5)),
    moral: Math.floor(b.moral * (1 + (mul - 1) * 0.3)),
    reductionCooldown: cap(Math.floor(b.reductionCooldown * (1 + (level - 1) * 0.01)), 0, 50),
    healthleech: scalePercent(b.healthleech, 1 + (mul - 1) * 0.2),
    
    healingBonus: Math.floor(b.healingBonus * (1 + (mul - 1) * 0.2)),
    shieldBonus: Math.floor(b.shieldBonus * (1 + (mul - 1) * 0.2)),
    energyRegen: Math.floor(b.energyRegen * (1 + (mul - 1) * 0.15)),
    
    // Stats supplémentaires pour compatibilité BattleEngine
    defMagique: Math.floor(b.def * mul * 0.8),
    intelligence: Math.floor(70 * mul),
    force: Math.floor(80 * mul),
    precision: Math.floor(75 * mul),
    esquive: Math.floor(50 * mul),
    magicResistance: Math.floor((b.def * mul * 0.8 + 70 * mul * 0.3) / 10),
    energyGeneration: Math.floor(10 + (b.moral * mul / 8)),
    criticalChance: Math.min(50, Math.floor(5 + b.vitesse * mul / 10))
  };
};

/**
 * Obtenir le multiplicateur de rareté
 */
monsterSchema.methods.getRarityMultiplier = function(): number {
  const multipliers: Record<MonsterRarity, number> = {
    Common: 1.0,
    Rare: 1.25,
    Epic: 1.5,
    Legendary: 2.0,
    Mythic: 2.5
  };
  return multipliers[this.rarity as MonsterRarity] || 1.0;
};

/**
 * Obtenir l'avantage élémentaire contre une cible
 */
monsterSchema.methods.getElementAdvantage = function(targetElement: string): number {
  const advantages: Record<string, string[]> = {
    Fire: ["Wind"],
    Water: ["Fire"],
    Wind: ["Electric"],
    Electric: ["Water"],
    Light: ["Dark"],
    Dark: ["Light"]
  };
  
  if (advantages[this.element]?.includes(targetElement)) return 1.5;
  if (advantages[targetElement]?.includes(this.element)) return 0.75;
  return 1.0;
};

/**
 * Récupérer tous les sorts
 */
monsterSchema.methods.getAllSpells = function(): Array<{ slot: string; id: string; level: number }> {
  const out: Array<{ slot: string; id: string; level: number }> = [];
  const s = this.spells;
  
  if (s.spell1?.id) out.push({ slot: "spell1", id: s.spell1.id, level: s.spell1.level });
  if (s.spell2?.id) out.push({ slot: "spell2", id: s.spell2.id, level: s.spell2.level });
  if (s.spell3?.id) out.push({ slot: "spell3", id: s.spell3.id, level: s.spell3.level });
  if (s.ultimate?.id) out.push({ slot: "ultimate", id: s.ultimate.id, level: s.ultimate.level });
  if (s.passive?.id) out.push({ slot: "passive", id: s.passive.id, level: s.passive.level });
  
  return out;
};

/**
 * Est-ce un boss ?
 */
monsterSchema.methods.isBoss = function(): boolean {
  return this.type === "boss";
};

/**
 * Est-ce un elite ?
 */
monsterSchema.methods.isElite = function(): boolean {
  return this.type === "elite";
};

/**
 * Peut apparaître dans ce monde ?
 */
monsterSchema.methods.canAppearInWorld = function(worldId: number): boolean {
  // Vérifier worldTags
  if (this.worldTags.length > 0 && !this.worldTags.includes(worldId)) {
    return false;
  }
  
  // Vérifier min/max
  if (this.minWorldLevel && worldId < this.minWorldLevel) return false;
  if (this.maxWorldLevel && worldId > this.maxWorldLevel) return false;
  
  return true;
};

// ═══════════════════════════════════════════════════════════════════
// MÉTHODES STATIQUES
// ═══════════════════════════════════════════════════════════════════

/**
 * Trouver des monstres pour un monde donné
 */
monsterSchema.statics.findForWorld = function(
  worldId: number,
  type?: MonsterType,
  element?: MonsterElement
) {
  const query: any = {
    $or: [
      { worldTags: worldId },
      { worldTags: { $size: 0 } } // Monstres génériques (apparaissent partout)
    ]
  };
  
  if (type) query.type = type;
  if (element) query.element = element;
  
  // Filtrer par min/max world level
  query.$and = [
    { $or: [{ minWorldLevel: { $exists: false } }, { minWorldLevel: { $lte: worldId } }] },
    { $or: [{ maxWorldLevel: { $exists: false } }, { maxWorldLevel: { $gte: worldId } }] }
  ];
  
  return this.find(query);
};

/**
 * Trouver par thématique visuelle
 */
monsterSchema.statics.findByTheme = function(visualTheme: VisualTheme, type?: MonsterType) {
  const query: any = { visualTheme };
  if (type) query.type = type;
  return this.find(query);
};

/**
 * Trouver des boss uniques
 */
monsterSchema.statics.findUniqueBosses = function() {
  return this.find({ type: "boss", isUnique: true });
};

/**
 * Sample aléatoire de monstres pour un monde
 */
monsterSchema.statics.sampleForWorld = async function(
  worldId: number,
  count: number,
  type?: MonsterType,
  element?: MonsterElement
) {
  const query: any = {
    $or: [
      { worldTags: worldId },
      { worldTags: { $size: 0 } }
    ]
  };
  
  if (type) query.type = type;
  if (element) query.element = element;
  
  query.$and = [
    { $or: [{ minWorldLevel: { $exists: false } }, { minWorldLevel: { $lte: worldId } }] },
    { $or: [{ maxWorldLevel: { $exists: false } }, { maxWorldLevel: { $gte: worldId } }] }
  ];
  
  return this.aggregate([
    { $match: query },
    { $sample: { size: count } }
  ]);
};

// Pré-save: Valider et nettoyer
monsterSchema.pre("save", function(next) {
  // Auto-générer displayName si manquant
  if (!this.displayName) {
    this.displayName = this.name;
  }
  
  // Valider worldTags
  if (this.worldTags.length === 0) {
    console.warn(`⚠️ Monster ${this.monsterId} has no worldTags - will appear in all worlds`);
  }
  
  // Ultimate par défaut si manquant
  if (!this.spells.ultimate?.id) {
    const defaultUltimates: Record<string, string> = {
      Fire: "fire_storm",
      Water: "tidal_wave",
      Wind: "tornado",
      Electric: "lightning_strike",
      Light: "divine_light",
      Dark: "shadow_realm"
    };
    this.spells.ultimate = {
      id: defaultUltimates[this.element] || "basic_ultimate",
      level: 1
    };
  }
  
  // Boss doit avoir des mechanics
  if (this.type === "boss" && !this.bossMechanics) {
    console.warn(`⚠️ Boss ${this.monsterId} has no bossMechanics defined`);
  }
  
  next();
});

export default mongoose.model<IMonsterDocument>("Monster", monsterSchema);

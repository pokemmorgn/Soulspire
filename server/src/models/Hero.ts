import mongoose, { Document, Schema } from "mongoose";
import { IHero } from "../types/index";

// Interface pour les sorts équipés
interface IHeroSpells {
  spell1?: { id: string; level: number };
  spell2?: { id: string; level: number };
  spell3?: { id: string; level: number };
  ultimate: { id: string; level: number };
  passive?: { id: string; level: number };
}

interface IHeroDocument extends Document {
  name: string;
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  rarity: "Common" | "Rare" | "Epic" | "Legendary";

  // === Nouveau bloc de stats, aligné sur IItemStats ===
  baseStats: {
    // Base
    hp: number;
    atk: number;
    def: number;

    // Avancées (en % sauf précision du contraire)
    crit: number;        // %
    critDamage: number;  // %
    critResist: number;  // %
    dodge: number;       // %
    accuracy: number;    // %

    // Spécialisées
    vitesse: number;           // valeur plate
    moral: number;             // valeur plate (impacte l’énergie)
    reductionCooldown: number; // % (cap 50)
    healthleech: number;       // %

    // Bonus spéciaux
    healingBonus: number; // %
    shieldBonus: number;  // %
    energyRegen: number;  // valeur plate
  };

  // Système de sorts
  spells: IHeroSpells;

  // Méthodes
  getStatsAtLevel(level: number, stars?: number): any;
  getRarityMultiplier(): number;
  getElementAdvantage(targetElement: string): number;
  getEffectiveCooldown(baseCooldown: number): number;
  getEnergyGeneration(): number;
  getAllSpells(): Array<{ slot: string; id: string; level: number }>;
  getSpell(spellSlot: string): { id: string; level: number } | null;
  setSpell(spellSlot: string, spellId: string, level?: number): void;
  upgradeSpell(spellSlot: string, newLevel: number): boolean;
}

const heroSchema = new Schema<IHeroDocument>({
  name: { type: String, required: true, trim: true, unique: true },
  role: { type: String, enum: ["Tank", "DPS Melee", "DPS Ranged", "Support"], required: true },
  element: { type: String, enum: ["Fire", "Water", "Wind", "Electric", "Light", "Dark"], required: true },
  rarity: { type: String, enum: ["Common", "Rare", "Epic", "Legendary"], required: true },

  // === Nouveau bloc de stats ===
  baseStats: {
    // Base
    hp: { type: Number, required: true, min: 100, max: 15000 },
    atk: { type: Number, required: true, min: 10, max: 3000 },
    def: { type: Number, required: true, min: 10, max: 1500 },

    // Avancées
    crit: { type: Number, required: true, min: 0, max: 100, default: 5 },
    critDamage: { type: Number, required: true, min: 0, default: 50 },
    critResist: { type: Number, required: true, min: 0, max: 100, default: 0 },
    dodge: { type: Number, required: true, min: 0, max: 100, default: 0 },
    accuracy: { type: Number, required: true, min: 0, max: 100, default: 0 },

    // Spécialisées
    vitesse: {
      type: Number,
      required: true,
      min: 50,
      max: 200,
      default: function (this: IHeroDocument) {
        const speedByRole: Record<IHeroDocument["role"], number> = {
          "Tank": 70,
          "DPS Melee": 90,
          "DPS Ranged": 85,
          "Support": 80,
        };
        return speedByRole[this.role] ?? 80;
      },
    },
    moral: {
      type: Number,
      required: true,
      min: 30,
      max: 200,
      default: function (this: IHeroDocument) {
        const moralByRarity: Record<IHeroDocument["rarity"], number> = {
          "Common": 50,
          "Rare": 65,
          "Epic": 80,
          "Legendary": 100,
        };
        return moralByRarity[this.rarity] ?? 60;
      },
    },
    reductionCooldown: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
      default: function (this: IHeroDocument) {
        const cooldownByRarity: Record<IHeroDocument["rarity"], number> = {
          "Common": 0,
          "Rare": 5,
          "Epic": 10,
          "Legendary": 15,
        };
        return cooldownByRarity[this.rarity] ?? 0;
      },
    },
    healthleech: { type: Number, required: true, min: 0, max: 100, default: 0 },

    // Bonus spéciaux
    healingBonus: { type: Number, required: true, min: 0, default: 0 },
    shieldBonus: { type: Number, required: true, min: 0, default: 0 },
    energyRegen: { type: Number, required: true, min: 0, default: 10 },
  },

  // Système de sorts
  spells: {
    spell1: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 10 } },
    spell2: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 10 } },
    spell3: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 10 } },
    ultimate: { id: { type: String, required: true }, level: { type: Number, default: 1, min: 1, max: 5 } },
    passive: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 5 } },
  },
}, {
  timestamps: true,
  collection: 'heroes'
});

// Index
heroSchema.index({ rarity: 1 });
heroSchema.index({ role: 1 });
heroSchema.index({ element: 1 });
heroSchema.index({ "spells.ultimate.id": 1 });

// Statics inchangés
heroSchema.statics.getDropRates = function () {
  return { Common: 50, Rare: 30, Epic: 15, Legendary: 5 };
};

heroSchema.statics.getRandomRarity = function (): string {
  const rand = Math.random() * 100;
  if (rand < 50) return "Common";
  if (rand < 80) return "Rare";
  if (rand < 95) return "Epic";
  return "Legendary";
};

// === Helpers de scaling
function cap(val: number, minVal: number, maxVal: number) {
  return Math.max(minVal, Math.min(maxVal, val));
}
function scalePercent(base: number, factor: number, capMax = 100) {
  // factor ~ intensité du scaling relatif à finalMultiplier
  return cap(base * factor, 0, capMax);
}

// Méthodes d'instance
heroSchema.methods.getStatsAtLevel = function (level: number, stars: number = 1) {
  const levelMultiplier = 1 + (level - 1) * 0.08;   // +8%/lvl
  const starMultiplier = 1 + (stars - 1) * 0.15;    // +15%/star
  const finalMultiplier = levelMultiplier * starMultiplier;

  const b = this.baseStats;

  return {
    // Base (scaling plein)
    hp: Math.floor(b.hp * finalMultiplier),
    atk: Math.floor(b.atk * finalMultiplier),
    def: Math.floor(b.def * finalMultiplier),

    // Avancées (scaling modéré via facteur 20% du multiplicateur)
    crit: scalePercent(b.crit, 1 + (finalMultiplier - 1) * 0.2),
    critDamage: Math.floor(b.critDamage * (1 + (finalMultiplier - 1) * 0.15)),
    critResist: scalePercent(b.critResist, 1 + (finalMultiplier - 1) * 0.2),
    dodge: scalePercent(b.dodge, 1 + (finalMultiplier - 1) * 0.2),
    accuracy: scalePercent(b.accuracy, 1 + (finalMultiplier - 1) * 0.2),

    // Spécialisées
    vitesse: Math.floor(b.vitesse * (1 + (finalMultiplier - 1) * 0.5)), // scaling doux
    moral: Math.floor(b.moral * (1 + (finalMultiplier - 1) * 0.3)),
    reductionCooldown: cap(Math.floor(b.reductionCooldown * (1 + (level - 1) * 0.01)), 0, 50),
    healthleech: scalePercent(b.healthleech, 1 + (finalMultiplier - 1) * 0.2),

    // Bonus spéciaux
    healingBonus: Math.floor(b.healingBonus * (1 + (finalMultiplier - 1) * 0.2)),
    shieldBonus: Math.floor(b.shieldBonus * (1 + (finalMultiplier - 1) * 0.2)),
    energyRegen: Math.floor(b.energyRegen * (1 + (finalMultiplier - 1) * 0.15)),
  };
};

heroSchema.methods.getRarityMultiplier = function (): number {
  const multipliers: Record<string, number> = { Common: 1, Rare: 1.25, Epic: 1.5, Legendary: 2 };
  return multipliers[this.rarity as string] || 1;
};

heroSchema.methods.getElementAdvantage = function (targetElement: string): number {
  const advantages: Record<string, string[]> = {
    Fire: ["Wind"], Water: ["Fire"], Wind: ["Electric"], Electric: ["Water"], Light: ["Dark"], Dark: ["Light"]
  };
  if (advantages[this.element]?.includes(targetElement)) return 1.5;
  if (advantages[targetElement]?.includes(this.element)) return 0.75;
  return 1;
};

heroSchema.methods.getEffectiveCooldown = function (baseCooldown: number): number {
  const reductionPercent = this.baseStats.reductionCooldown / 100;
  return Math.max(1, Math.ceil(baseCooldown * (1 - reductionPercent)));
};

heroSchema.methods.getEnergyGeneration = function (): number {
  // base 10 + moral/10 + bonus plat
  return Math.floor(10 + (this.baseStats.moral / 10) + (this.baseStats.energyRegen || 0));
};

// Spells utils
heroSchema.methods.getAllSpells = function (): Array<{ slot: string; id: string; level: number }> {
  const result: Array<{ slot: string; id: string; level: number }> = [];
  if (this.spells.spell1?.id) result.push({ slot: "spell1", id: this.spells.spell1.id, level: this.spells.spell1.level });
  if (this.spells.spell2?.id) result.push({ slot: "spell2", id: this.spells.spell2.id, level: this.spells.spell2.level });
  if (this.spells.spell3?.id) result.push({ slot: "spell3", id: this.spells.spell3.id, level: this.spells.spell3.level });
  if (this.spells.ultimate?.id) result.push({ slot: "ultimate", id: this.spells.ultimate.id, level: this.spells.ultimate.level });
  if (this.spells.passive?.id) result.push({ slot: "passive", id: this.spells.passive.id, level: this.spells.passive.level });
  return result;
};

heroSchema.methods.getSpell = function (spellSlot: string): { id: string; level: number } | null {
  const s = this.spells[spellSlot as keyof IHeroSpells] as any;
  return s && s.id ? { id: s.id, level: s.level } : null;
};

heroSchema.methods.setSpell = function (spellSlot: string, spellId: string, level: number = 1): void {
  const s = this.spells[spellSlot as keyof IHeroSpells] as any;
  if (!s) {
    (this.spells as any)[spellSlot] = { id: spellId, level };
  } else {
    s.id = spellId;
    s.level = level;
  }
};

heroSchema.methods.upgradeSpell = function (spellSlot: string, newLevel: number): boolean {
  const s = this.spells[spellSlot as keyof IHeroSpells] as any;
  if (!s || !s.id) return false;
  const maxLevel = (spellSlot === "ultimate" || spellSlot === "passive") ? 5 : 10;
  if (newLevel > maxLevel || newLevel <= s.level) return false;
  s.level = newLevel;
  return true;
};

// Pré-save pour cohérence
heroSchema.pre('save', function (next) {
  // Ultimate par défaut si manquant
  if (!this.spells.ultimate || !this.spells.ultimate.id) {
    const defaultUltimates: Record<IHeroDocument["element"], string> = {
      Fire: "fire_storm",
      Water: "tidal_wave",
      Wind: "tornado",
      Electric: "lightning_strike",
      Light: "divine_light",
      Dark: "shadow_realm"
    };
    this.spells.ultimate = { id: defaultUltimates[this.element] || "basic_ultimate", level: 1 };
  }

  // Clamp RC
  if (this.baseStats.reductionCooldown > 50) this.baseStats.reductionCooldown = 50;
  if (this.baseStats.reductionCooldown < 0) this.baseStats.reductionCooldown = 0;

  // Clamp pourcentages
  this.baseStats.crit = cap(this.baseStats.crit, 0, 100);
  this.baseStats.critResist = cap(this.baseStats.critResist, 0, 100);
  this.baseStats.dodge = cap(this.baseStats.dodge, 0, 100);
  this.baseStats.accuracy = cap(this.baseStats.accuracy, 0, 100);
  this.baseStats.healthleech = cap(this.baseStats.healthleech, 0, 100);

  next();
});

export default mongoose.model<IHeroDocument>("Hero", heroSchema);

import mongoose, { Document, Schema, Model } from "mongoose";

type Role = "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
type Element = "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
type Rarity = "Common" | "Rare" | "Epic" | "Legendary";
type SkillType = "Heal" | "Buff" | "AoE" | "Control" | "Damage";

export interface IComputedStats {
  hp: number;
  def: number;
  mdef: number;       // Défense magique
  spd: number;        // Vitesse (Vit)
  int: number;        // Intelligence
  str: number;        // Force
  morale: number;     // Moral (énergie / ressource)
  cdr: number;        // Réduction de cooldown (0.0 - 0.5 par défaut cap)
}

export interface IHeroDocument extends Document {
  name: string;
  role: Role;
  element: Element;
  rarity: Rarity;
  baseStats: {
    hp: number;
    def: number;
    mdef: number;
    spd: number;
    int: number;
    str: number;
    morale: number;
    cdr: number; // exprimé en fraction (ex: 0.1 = 10%)
  };
  skill: {
    name: string;
    description: string;
    type: SkillType;
  };

  getStatsAtLevel(level: number, stars?: number): IComputedStats;
  getRarityMultiplier(): number;
  getElementAdvantage(targetElement: string): number;
}

interface IHeroModel extends Model<IHeroDocument> {
  getDropRates(): Record<Rarity, number>;
  getRandomRarity(): Rarity;
}

const heroSchema = new Schema<IHeroDocument, IHeroModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ["Tank", "DPS Melee", "DPS Ranged", "Support"],
      required: true,
    },
    element: {
      type: String,
      enum: ["Fire", "Water", "Wind", "Electric", "Light", "Dark"],
      required: true,
    },
    rarity: {
      type: String,
      enum: ["Common", "Rare", "Epic", "Legendary"],
      required: true,
    },

    // Nouvelles stats de base
    baseStats: {
      hp: { type: Number, required: true, min: 100, max: 100000 },
      def: { type: Number, required: true, min: 10, max: 5000 },
      mdef: { type: Number, required: true, min: 10, max: 5000 },
      spd: { type: Number, required: true, min: 10, max: 1000 },   // Vit
      int: { type: Number, required: true, min: 10, max: 5000 },
      str: { type: Number, required: true, min: 10, max: 5000 },
      morale: { type: Number, required: true, min: 0, max: 1000 }, // jauge ressource
      cdr: { type: Number, required: true, min: 0, max: 0.9 },     // 0.0=0%  /  0.4=40%...
    },

    // Compétence signature
    skill: {
      name: { type: String, required: true, trim: true },
      description: { type: String, required: true, maxlength: 500 },
      type: {
        type: String,
        enum: ["Heal", "Buff", "AoE", "Control", "Damage"],
        required: true,
      },
    },
  },
  {
    timestamps: true,
    collection: "heroes",
  }
);

// Index usuels
heroSchema.index({ rarity: 1 });
heroSchema.index({ role: 1 });
heroSchema.index({ element: 1 });
// heroSchema.index({ name: 1 });

// ---------- Statics (drop rates) ----------
heroSchema.statics.getDropRates = function () {
  return {
    Common: 50,
    Rare: 30,
    Epic: 15,
    Legendary: 5,
  } as Record<Rarity, number>;
};

heroSchema.statics.getRandomRarity = function (): Rarity {
  const rand = Math.random() * 100;
  if (rand < 50) return "Common";
  if (rand < 80) return "Rare";
  if (rand < 95) return "Epic";
  return "Legendary";
};

// ---------- Helpers (non exposés) ----------
/**
 * Courbes de croissance par rôle (par niveau)
 * Valeurs = augmentation par niveau (ex: 0.08 = +8% par niveau)
 * Ces taux s’appliquent EN PLUS d’un multiplicateur par étoiles.
 */
const ROLE_LEVEL_GROWTH: Record<
  Role,
  { hp: number; def: number; mdef: number; spd: number; int: number; str: number; morale: number; cdr: number }
> = {
  Tank: {
    hp: 0.10,
    def: 0.09,
    mdef: 0.06,
    spd: 0.03,
    int: 0.03,
    str: 0.05,
    morale: 0.04,
    cdr: 0.01, // légère amélioration
  },
  "DPS Melee": {
    hp: 0.06,
    def: 0.05,
    mdef: 0.04,
    spd: 0.07,
    int: 0.04,
    str: 0.10, // focus force
    morale: 0.04,
    cdr: 0.015,
  },
  "DPS Ranged": {
    hp: 0.05,
    def: 0.04,
    mdef: 0.05,
    spd: 0.08,
    int: 0.10, // focus intelligence
    str: 0.04,
    morale: 0.05,
    cdr: 0.02,
  },
  Support: {
    hp: 0.06,
    def: 0.05,
    mdef: 0.08,
    spd: 0.06,
    int: 0.08,
    str: 0.03,
    morale: 0.08, // bons gains de ressource
    cdr: 0.025,   // meilleure cdr par niveau
  },
};

/** Multiplicateur par rareté (global) */
const RARITY_MULTIPLIER: Record<Rarity, number> = {
  Common: 1,
  Rare: 1.25,
  Epic: 1.5,
  Legendary: 2,
};

/** Cap par défaut de la réduction de cooldown totale */
const CDR_CAP = 0.5; // 50%

/** Arrondi safe (cdr conservé à 3 décimales, autres stats à l'entier) */
function normalizeStats(s: IComputedStats): IComputedStats {
  return {
    hp: Math.max(1, Math.floor(s.hp)),
    def: Math.max(0, Math.floor(s.def)),
    mdef: Math.max(0, Math.floor(s.mdef)),
    spd: Math.max(1, Math.floor(s.spd)),
    int: Math.max(0, Math.floor(s.int)),
    str: Math.max(0, Math.floor(s.str)),
    morale: Math.max(0, Math.floor(s.morale)),
    cdr: Math.max(0, Math.min(Number(s.cdr.toFixed(3)), CDR_CAP)),
  };
}

// ---------- Instance Methods ----------
heroSchema.methods.getStatsAtLevel = function (
  level: number,
  stars: number = 1
): IComputedStats {
  const lvl = Math.max(1, Math.floor(level));
  const st = Math.max(1, Math.floor(stars));

  // multiplicateur global étoiles (même logique que ta version)
  const starMul = 1 + (st - 1) * 0.2;

  // multiplicateur par rareté (global)
  const rarityMul = RARITY_MULTIPLIER[this.rarity as Rarity] || 1;

  // taux de croissance par rôle
  const growth = ROLE_LEVEL_GROWTH[this.role as Role];

  // Pour chaque stat, on applique:
  // base * (1 + (lvl-1)*growthStat) * starMul * rarityMul
  const L = Math.max(0, lvl - 1); // niveaux supplémentaires
  const b = this.baseStats;

  const scaled: IComputedStats = {
    hp: b.hp * (1 + L * growth.hp) * starMul * rarityMul,
    def: b.def * (1 + L * growth.def) * starMul * rarityMul,
    mdef: b.mdef * (1 + L * growth.mdef) * starMul * rarityMul,
    spd: b.spd * (1 + L * growth.spd) * starMul * rarityMul,
    int: b.int * (1 + L * growth.int) * starMul * rarityMul,
    str: b.str * (1 + L * growth.str) * starMul * rarityMul,
    morale: b.morale * (1 + L * growth.morale) * starMul * rarityMul,
    // La CDR est additive sur la base, puis capée
    cdr: b.cdr + L * growth.cdr,
  };

  // cap CDR et normaliser les nombres
  if (scaled.cdr > CDR_CAP) scaled.cdr = CDR_CAP;

  return normalizeStats(scaled);
};

heroSchema.methods.getRarityMultiplier = function (): number {
  return RARITY_MULTIPLIER[this.rarity as Rarity] || 1;
};

heroSchema.methods.getElementAdvantage = function (targetElement: string): number {
  const advantages: { [key in Element]: Element[] } = {
    Fire: ["Wind"],
    Water: ["Fire"],
    Wind: ["Electric"],
    Electric: ["Water"],
    Light: ["Dark"],
    Dark: ["Light"],
  };

  const selfEl = this.element as Element;
  const targetEl = targetElement as Element;

  if (advantages[selfEl]?.includes(targetEl)) return 1.5;
  if (advantages[targetEl as Element]?.includes(selfEl)) return 0.75;
  return 1;
};

export default mongoose.model<IHeroDocument, IHeroModel>("Hero", heroSchema);

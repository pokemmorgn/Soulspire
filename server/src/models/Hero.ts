import mongoose, { Document, Schema } from "mongoose";

// Interface pour les sorts équipés
interface IHeroSpells {
  spell1?: { id: string; level: number };
  spell2?: { id: string; level: number };
  spell3?: { id: string; level: number };
  ultimate: { id: string; level: number };
  passive?: { id: string; level: number };
}

export interface IHeroDocument extends Document {
  name: string;
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  rarity: "Common" | "Rare" | "Epic" | "Legendary";

  // Stats alignées sur IItemStats
  baseStats: {
    hp: number; atk: number; def: number;
    crit: number; critDamage: number; critResist: number; dodge: number; accuracy: number;
    vitesse: number; moral: number; reductionCooldown: number; healthleech: number;
    healingBonus: number; shieldBonus: number; energyRegen: number;
  };

  spells: IHeroSpells;

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

  // === Stats ===
  baseStats: {
    hp:  { type: Number, required: true, min: 100, max: 15000 },
    atk: { type: Number, required: true, min: 10,  max: 3000 },
    def: { type: Number, required: true, min: 10,  max: 1500 },

    crit:       { type: Number, required: true, min: 0, max: 100, default: 5 },
    critDamage: { type: Number, required: true, min: 0,           default: 50 },
    critResist: { type: Number, required: true, min: 0, max: 100, default: 0 },
    dodge:      { type: Number, required: true, min: 0, max: 100, default: 0 },
    accuracy:   { type: Number, required: true, min: 0, max: 100, default: 0 },

    vitesse: {
      type: Number, required: true, min: 50, max: 200,
      default: function (this: IHeroDocument) {
        const byRole: Record<IHeroDocument["role"], number> =
          { Tank: 70, "DPS Melee": 90, "DPS Ranged": 85, Support: 80 };
        return byRole[this.role] ?? 80;
      }
    },
    moral: {
      type: Number, required: true, min: 30, max: 200,
      default: function (this: IHeroDocument) {
        const byRarity: Record<IHeroDocument["rarity"], number> =
          { Common: 50, Rare: 65, Epic: 80, Legendary: 100 };
        return byRarity[this.rarity] ?? 60;
      }
    },
    reductionCooldown: {
      type: Number, required: true, min: 0, max: 50,
      default: function (this: IHeroDocument) {
        const byRarity: Record<IHeroDocument["rarity"], number> =
          { Common: 0, Rare: 5, Epic: 10, Legendary: 15 };
        return byRarity[this.rarity] ?? 0;
      }
    },
    healthleech: { type: Number, required: true, min: 0, max: 100, default: 0 },

    healingBonus: { type: Number, required: true, min: 0, default: 0 },
    shieldBonus:  { type: Number, required: true, min: 0, default: 0 },
    energyRegen:  { type: Number, required: true, min: 0, default: 10 },
  },

  // === Sorts ===
  spells: {
    spell1:   { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 10 } },
    spell2:   { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 10 } },
    spell3:   { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 10 } },
    ultimate: { id: { type: String, required: true }, level: { type: Number, default: 1, min: 1, max: 5 } },
    passive:  { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 5 } },
  },
}, { timestamps: true, collection: "heroes" });

// Index
heroSchema.index({ rarity: 1 });
heroSchema.index({ role: 1 });
heroSchema.index({ element: 1 });
heroSchema.index({ "spells.ultimate.id": 1 });

// Utils
function cap(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function scalePercent(base: number, factor: number, capMax = 100) { return cap(base * factor, 0, capMax); }

// Méthodes
heroSchema.methods.getStatsAtLevel = function (level: number, stars: number = 1) {
  const levelMul = 1 + (level - 1) * 0.08;
  const starMul  = 1 + (stars - 1) * 0.15;
  const mul = levelMul * starMul;
  const b = this.baseStats;

  return {
    hp:  Math.floor(b.hp  * mul),
    atk: Math.floor(b.atk * mul),
    def: Math.floor(b.def * mul),

    crit:        scalePercent(b.crit,       1 + (mul - 1) * 0.2),
    critDamage:  Math.floor(b.critDamage *  (1 + (mul - 1) * 0.15)),
    critResist:  scalePercent(b.critResist, 1 + (mul - 1) * 0.2),
    dodge:       scalePercent(b.dodge,      1 + (mul - 1) * 0.2),
    accuracy:    scalePercent(b.accuracy,   1 + (mul - 1) * 0.2),

    vitesse: Math.floor(b.vitesse * (1 + (mul - 1) * 0.5)),
    moral:   Math.floor(b.moral   * (1 + (mul - 1) * 0.3)),
    reductionCooldown: cap(Math.floor(b.reductionCooldown * (1 + (level - 1) * 0.01)), 0, 50),
    healthleech:       scalePercent(b.healthleech, 1 + (mul - 1) * 0.2),

    healingBonus: Math.floor(b.healingBonus * (1 + (mul - 1) * 0.2)),
    shieldBonus:  Math.floor(b.shieldBonus  * (1 + (mul - 1) * 0.2)),
    energyRegen:  Math.floor(b.energyRegen  * (1 + (mul - 1) * 0.15)),
  };
};

heroSchema.methods.getRarityMultiplier = function () {
  return ({ Common: 1, Rare: 1.25, Epic: 1.5, Legendary: 2 } as Record<string, number>)[this.rarity] || 1;
};

heroSchema.methods.getElementAdvantage = function (target: string) {
  const adv: Record<string, string[]> = {
    Fire: ["Wind"], Water: ["Fire"], Wind: ["Electric"],
    Electric: ["Water"], Light: ["Dark"], Dark: ["Light"]
  };
  if (adv[this.element]?.includes(target)) return 1.5;
  if (adv[target]?.includes(this.element)) return 0.75;
  return 1;
};

heroSchema.methods.getEffectiveCooldown = function (baseCd: number) {
  const r = this.baseStats.reductionCooldown / 100;
  return Math.max(1, Math.ceil(baseCd * (1 - r)));
};

heroSchema.methods.getEnergyGeneration = function () {
  return Math.floor(10 + (this.baseStats.moral / 10) + (this.baseStats.energyRegen || 0));
};

heroSchema.methods.getAllSpells = function () {
  const out: Array<{ slot: string; id: string; level: number }> = [];
  const s = this.spells;
  if (s.spell1?.id) out.push({ slot: "spell1", id: s.spell1.id, level: s.spell1.level });
  if (s.spell2?.id) out.push({ slot: "spell2", id: s.spell2.id, level: s.spell2.level });
  if (s.spell3?.id) out.push({ slot: "spell3", id: s.spell3.id, level: s.spell3.level });
  if (s.ultimate?.id) out.push({ slot: "ultimate", id: s.ultimate.id, level: s.ultimate.level });
  if (s.passive?.id) out.push({ slot: "passive", id: s.passive.id, level: s.passive.level });
  return out;
};

heroSchema.methods.getSpell = function (slot: string) {
  const s: any = this.spells[slot as keyof IHeroSpells];
  return s?.id ? { id: s.id, level: s.level } : null;
};

heroSchema.methods.setSpell = function (slot: string, id: string, level = 1) {
  const s: any = this.spells[slot as keyof IHeroSpells];
  if (!s) (this.spells as any)[slot] = { id, level };
  else { s.id = id; s.level = level; }
};

heroSchema.methods.upgradeSpell = function (slot: string, newLevel: number) {
  const s: any = this.spells[slot as keyof IHeroSpells];
  if (!s?.id) return false;
  const max = (slot === "ultimate" || slot === "passive") ? 5 : 10;
  if (newLevel > max || newLevel <= s.level) return false;
  s.level = newLevel; return true;
};

// Pré-save (cohérence & clamps)
heroSchema.pre("save", function (next) {
  this.baseStats.reductionCooldown = cap(this.baseStats.reductionCooldown, 0, 50);
  this.baseStats.crit        = cap(this.baseStats.crit, 0, 100);
  this.baseStats.critResist  = cap(this.baseStats.critResist, 0, 100);
  this.baseStats.dodge       = cap(this.baseStats.dodge, 0, 100);
  this.baseStats.accuracy    = cap(this.baseStats.accuracy, 0, 100);
  this.baseStats.healthleech = cap(this.baseStats.healthleech, 0, 100);

  // Ultimate par défaut si manquant
  if (!this.spells.ultimate?.id) {
    const defaults: Record<IHeroDocument["element"], string> = {
      Fire: "fire_storm", Water: "tidal_wave", Wind: "tornado",
      Electric: "lightning_strike", Light: "divine_light", Dark: "shadow_realm"
    };
    this.spells.ultimate = { id: defaults[this.element] || "basic_ultimate", level: 1 };
  }

  next();
});

export default mongoose.model<IHeroDocument>("Hero", heroSchema);

// server/src/models/Hero.ts
import mongoose, { Document, Schema } from "mongoose";
import { getHeroSpellDefinition, getInitialSpells } from '../data/heroSpellDefinitions';

// Interface pour les sorts équipés - NOUVELLE STRUCTURE
interface IHeroSpells {
  active1?: { id: string; level: number };
  active2?: { id: string; level: number };
  active3?: { id: string; level: number };
  ultimate?: { id: string; level: number };
  passive?: { id: string; level: number };
}

// Interface pour l'équipement
interface IHeroEquipment {
  weapon?: string;
  helmet?: string;
  armor?: string;
  boots?: string;
  gloves?: string;
  accessory?: string;
}

export interface IHeroDocument extends Document {
  name: string;
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";

  baseStats: {
    hp: number; atk: number; def: number;
    crit: number; critDamage: number; critResist: number; dodge: number; accuracy: number;
    vitesse: number; moral: number; reductionCooldown: number; healthleech: number;
    healingBonus: number; shieldBonus: number; energyRegen: number;
  };

  spells: IHeroSpells;
  equipment: IHeroEquipment;

  // Méthodes
  getStatsAtLevel(level: number, stars?: number, includeEquipment?: boolean): any;
  getEquipmentStats(playerId?: string): Promise<any>;
  getTotalStats(level: number, stars: number, playerId: string): Promise<any>;
  getSetBonuses(playerId: string): Promise<any>;
  getRarityMultiplier(): number;
  getElementAdvantage(targetElement: string): number;
  getEffectiveCooldown(baseCooldown: number): number;
  getEnergyGeneration(): number;
  getAllSpells(): Array<{ slot: string; id: string; level: number }>;
  getSpell(spellSlot: string): { id: string; level: number } | null;
  setSpell(spellSlot: string, spellId: string, level?: number): void;
  upgradeSpell(spellSlot: string, newLevel: number): boolean;
  calculateSpellStats(spellSlot: string, level: number): any;
}

const heroSchema = new Schema<IHeroDocument>({
  name: { type: String, required: true, trim: true, unique: true },
  role: { type: String, enum: ["Tank", "DPS Melee", "DPS Ranged", "Support"], required: true },
  element: { type: String, enum: ["Fire", "Water", "Wind", "Electric", "Light", "Dark"], required: true },
  rarity: { type: String, enum: ["Common", "Rare", "Epic", "Legendary", "Mythic"], required: true },

  // Stats
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
          { Common: 50, Rare: 65, Epic: 80, Legendary: 100, Mythic: 120 };
        return byRarity[this.rarity] ?? 60;
      }
    },
    reductionCooldown: {
      type: Number, required: true, min: 0, max: 50,
      default: function (this: IHeroDocument) {
        const byRarity: Record<IHeroDocument["rarity"], number> =
         { Common: 0, Rare: 5, Epic: 10, Legendary: 15, Mythic: 20 };
        return byRarity[this.rarity] ?? 0;
      }
    },
    healthleech: { type: Number, required: true, min: 0, max: 100, default: 0 },

    healingBonus: { type: Number, required: true, min: 0, default: 0 },
    shieldBonus:  { type: Number, required: true, min: 0, default: 0 },
    energyRegen:  { type: Number, required: true, min: 0, default: 10 },
  },

  // Sorts - NOUVELLE STRUCTURE
  spells: {
    active1:  { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 12 } },
    active2:  { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 12 } },
    active3:  { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 12 } },
    ultimate: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 10 } },
    passive:  { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 12 } },
  },

  // Équipement
  equipment: {
    weapon:    { type: String, ref: 'Inventory' },
    helmet:    { type: String, ref: 'Inventory' },
    armor:     { type: String, ref: 'Inventory' },
    boots:     { type: String, ref: 'Inventory' },
    gloves:    { type: String, ref: 'Inventory' },
    accessory: { type: String, ref: 'Inventory' }
  }
}, { timestamps: true, collection: "heroes" });

// Index - MISE À JOUR
heroSchema.index({ rarity: 1 });
heroSchema.index({ role: 1 });
heroSchema.index({ element: 1 });
heroSchema.index({ "spells.active1.id": 1 });
heroSchema.index({ "spells.active2.id": 1 });
heroSchema.index({ "spells.active3.id": 1 });
heroSchema.index({ "spells.ultimate.id": 1 });
heroSchema.index({ "spells.passive.id": 1 });
heroSchema.index({ "equipment.weapon": 1 });
heroSchema.index({ "equipment.helmet": 1 });
heroSchema.index({ "equipment.armor": 1 });

// Utils
function cap(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function scalePercent(base: number, factor: number, capMax = 100) { return cap(base * factor, 0, capMax); }

// Méthode getStatsAtLevel
heroSchema.methods.getStatsAtLevel = function (level: number, stars: number = 1, includeEquipment: boolean = false) {
  const levelMul = 1 + (level - 1) * 0.08;
  const starMul  = 1 + (stars - 1) * 0.15;
  const mul = levelMul * starMul;
  const b = this.baseStats;

  const baseStats = {
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

  if (!includeEquipment) {
    return baseStats;
  }

  console.warn("Pour inclure l'équipement, utilisez getTotalStats() qui est async");
  return baseStats;
};

// Méthode getEquipmentStats
heroSchema.methods.getEquipmentStats = async function (playerId?: string): Promise<any> {
  try {
    if (!playerId) {
      console.warn("PlayerId requis pour calculer les stats d'équipement");
      return this.getEmptyStats();
    }

    const Inventory = mongoose.model('Inventory');
    const Item = mongoose.model('Item');
    
    const inventory = await Inventory.findOne({ playerId });
    if (!inventory) {
      return this.getEmptyStats();
    }

    const totalEquipmentStats = this.getEmptyStats();
    const equippedItems = [];

    const slots = ['weapon', 'helmet', 'armor', 'boots', 'gloves', 'accessory'];
    
    for (const slot of slots) {
      const instanceId = this.equipment[slot];
      if (!instanceId) continue;

      const ownedItem = inventory.getItem(instanceId);
      if (!ownedItem) continue;

      const itemData = await Item.findOne({ itemId: ownedItem.itemId });
      if (!itemData) continue;

      const itemStats = itemData.getStatsAtLevel(ownedItem.level);
      const enhancementMultiplier = 1 + (ownedItem.enhancement * 0.05);
      
      this.addStats(totalEquipmentStats, itemStats, enhancementMultiplier);
      
      equippedItems.push({
        slot,
        instanceId,
        itemId: ownedItem.itemId,
        name: itemData.name,
        level: ownedItem.level,
        enhancement: ownedItem.enhancement,
        stats: itemStats
      });
    }

    return {
      stats: totalEquipmentStats,
      equippedItems,
      setsBonus: await this.getSetBonuses(playerId)
    };

  } catch (error: any) {
    console.error("Erreur getEquipmentStats:", error);
    return this.getEmptyStats();
  }
};

// Méthode getTotalStats
heroSchema.methods.getTotalStats = async function (level: number, stars: number, playerId: string): Promise<any> {
  try {
    const heroStats = this.getStatsAtLevel(level, stars, false);
    const equipmentData = await this.getEquipmentStats(playerId);
    const equipmentStats = equipmentData.stats;
    const setsBonuses = equipmentData.setsBonus;

    const totalStats = { ...heroStats };
    this.addStats(totalStats, equipmentStats);
    this.addStats(totalStats, setsBonuses);

    totalStats.crit = Math.min(100, totalStats.crit);
    totalStats.critResist = Math.min(100, totalStats.critResist);
    totalStats.dodge = Math.min(100, totalStats.dodge);
    totalStats.accuracy = Math.min(100, totalStats.accuracy);
    totalStats.healthleech = Math.min(100, totalStats.healthleech);
    totalStats.reductionCooldown = Math.min(50, totalStats.reductionCooldown);

    return {
      totalStats,
      breakdown: {
        hero: heroStats,
        equipment: equipmentStats,
        sets: setsBonuses
      },
      equippedItems: equipmentData.equippedItems,
      power: this.calculatePower(totalStats)
    };

  } catch (error: any) {
    console.error("Erreur getTotalStats:", error);
    return {
      totalStats: this.getStatsAtLevel(level, stars, false),
      breakdown: { hero: this.getStatsAtLevel(level, stars, false), equipment: {}, sets: {} },
      equippedItems: [],
      power: 0
    };
  }
};

// Méthode getSetBonuses
heroSchema.methods.getSetBonuses = async function (playerId: string): Promise<any> {
  try {
    const Inventory = mongoose.model('Inventory');
    const Item = mongoose.model('Item');
    
    const inventory = await Inventory.findOne({ playerId });
    if (!inventory) return this.getEmptyStats();

    const equippedSets = new Map<string, number>();
    const slots = ['weapon', 'helmet', 'armor', 'boots', 'gloves', 'accessory'];
    
    for (const slot of slots) {
      const instanceId = this.equipment[slot];
      if (!instanceId) continue;

      const ownedItem = inventory.getItem(instanceId);
      if (!ownedItem) continue;

      const itemData = await Item.findOne({ itemId: ownedItem.itemId });
      if (!itemData || !itemData.equipmentSet?.setId) continue;

      const setId = itemData.equipmentSet.setId;
      equippedSets.set(setId, (equippedSets.get(setId) || 0) + 1);
    }

    const totalSetBonus = this.getEmptyStats();
    const activeSets = [];

    for (const [setId, piecesCount] of equippedSets) {
      if (piecesCount >= 2) {
        const setBonus = this.calculateSetBonus(setId, piecesCount);
        this.addStats(totalSetBonus, setBonus);
        
        activeSets.push({
          setId,
          piecesCount,
          bonus: setBonus
        });
      }
    }

    return {
      ...totalSetBonus,
      activeSets
    };

  } catch (error: any) {
    console.error("Erreur getSetBonuses:", error);
    return this.getEmptyStats();
  }
};

// Méthodes utilitaires
heroSchema.methods.getEmptyStats = function () {
  return {
    hp: 0, atk: 0, def: 0,
    crit: 0, critDamage: 0, critResist: 0, dodge: 0, accuracy: 0,
    vitesse: 0, moral: 0, reductionCooldown: 0, healthleech: 0,
    healingBonus: 0, shieldBonus: 0, energyRegen: 0
  };
};

heroSchema.methods.addStats = function (target: any, source: any, multiplier: number = 1) {
  const statKeys = ['hp', 'atk', 'def', 'crit', 'critDamage', 'critResist', 'dodge', 'accuracy',
                    'vitesse', 'moral', 'reductionCooldown', 'healthleech', 'healingBonus', 'shieldBonus', 'energyRegen'];
  
  for (const key of statKeys) {
    if (source[key] && typeof source[key] === 'number') {
      target[key] = (target[key] || 0) + Math.floor(source[key] * multiplier);
    }
  }
};

heroSchema.methods.calculateSetBonus = function (setId: string, piecesCount: number) {
  const baseBonuses: Record<number, any> = {
    2: { hp: 500, atk: 50 },
    4: { hp: 1200, atk: 120, crit: 5 },
    6: { hp: 2500, atk: 250, crit: 10, critDamage: 25 }
  };

  const bonus = this.getEmptyStats();
  
  for (let pieces = 2; pieces <= piecesCount && pieces <= 6; pieces += 2) {
    if (baseBonuses[pieces]) {
      this.addStats(bonus, baseBonuses[pieces]);
    }
  }

  return bonus;
};

heroSchema.methods.calculatePower = function (stats: any): number {
  return Math.floor(
    stats.atk * 1.0 + 
    stats.def * 1.5 + 
    stats.hp / 10 + 
    stats.vitesse * 0.5 + 
    stats.crit * 2 + 
    stats.critDamage * 0.1
  );
};

// Méthodes existantes
heroSchema.methods.getRarityMultiplier = function () {
  return ({ 
    Common: 1, 
    Rare: 1.25, 
    Epic: 1.5, 
    Legendary: 2,
    Mythic: 2.5
  } as Record<string, number>)[this.rarity] || 1;
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

// MÉTHODES DE SORTS - MISE À JOUR
heroSchema.methods.getAllSpells = function () {
  const out: Array<{ slot: string; id: string; level: number }> = [];
  const s = this.spells;
  if (s.active1?.id) out.push({ slot: "active1", id: s.active1.id, level: s.active1.level });
  if (s.active2?.id) out.push({ slot: "active2", id: s.active2.id, level: s.active2.level });
  if (s.active3?.id) out.push({ slot: "active3", id: s.active3.id, level: s.active3.level });
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
  const max = (slot === "ultimate") ? 10 : 12;
  if (newLevel > max || newLevel <= s.level) return false;
  s.level = newLevel; 
  return true;
};
// Méthode calculateSpellStats
heroSchema.methods.calculateSpellStats = function (spellSlot: string, level: number) {
  const spell = this.getSpell(spellSlot);
  
  if (!spell || !spell.id) {
    return {
      damage: 0,
      healing: 0,
      cooldown: 3,
      duration: 0,
      energyCost: 20,
      effect: "",
      additionalEffects: {}
    };
  }

  try {
    // Importer la fonction depuis heroSpellDefinitions
    const { getSpellStats } = require('../data/heroSpellDefinitions');
    
    // Obtenir les stats du sort
    const spellStats = getSpellStats(spell.id, level, this.rarity);
    
    return spellStats;
  } catch (error) {
    console.error(`❌ Erreur calculateSpellStats pour ${spell.id}:`, error);
    
    // Fallback avec des valeurs génériques
    const levelScaling = 1 + (level - 1) * 0.1;
    
    return {
      damage: Math.floor(50 * levelScaling),
      healing: Math.floor(40 * levelScaling),
      cooldown: Math.max(1, 5 - Math.floor(level / 3)),
      duration: 2,
      energyCost: Math.max(10, 20 - level),
      effect: spell.id,
      additionalEffects: {
        note: "Using fallback stats"
      }
    };
  }
};

// Pré-save hook - MISE À JOUR
// Pré-save hook - MISE À JOUR
heroSchema.pre("save", function (next) {
  // Clamp des stats
  this.baseStats.reductionCooldown = cap(this.baseStats.reductionCooldown, 0, 50);
  this.baseStats.crit        = cap(this.baseStats.crit, 0, 100);
  this.baseStats.critResist  = cap(this.baseStats.critResist, 0, 100);
  this.baseStats.dodge       = cap(this.baseStats.dodge, 0, 100);
  this.baseStats.accuracy    = cap(this.baseStats.accuracy, 0, 100);
  this.baseStats.healthleech = cap(this.baseStats.healthleech, 0, 100);

  // Initialiser les sorts selon heroSpellDefinitions
  const heroId = this.name.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
  
  console.log(`🔍 Pre-save hook for: ${this.name}, heroId: ${heroId}`);
  
  try {
    const spellDefinition = getHeroSpellDefinition(heroId);
    
    console.log(`🔍 Spell definition found:`, spellDefinition);
    
    if (spellDefinition) {
      const initialSpells = getInitialSpells(heroId, this.rarity);
      
      console.log(`🔍 Initial spells:`, JSON.stringify(initialSpells));
      
      // Active1 - toujours remplacer
      if (initialSpells.active1) {
        this.spells.active1 = initialSpells.active1;
        console.log(`✅ Set active1:`, initialSpells.active1);
      }
      
      // Active2 - toujours remplacer
      if (initialSpells.active2) {
        this.spells.active2 = initialSpells.active2;
        console.log(`✅ Set active2:`, initialSpells.active2);
      }
      
      // Active3 - toujours remplacer
      if (initialSpells.active3) {
        this.spells.active3 = initialSpells.active3;
        console.log(`✅ Set active3:`, initialSpells.active3);
      }
      
      // Ultimate - toujours remplacer
      if (initialSpells.ultimate) {
        this.spells.ultimate = initialSpells.ultimate;
        console.log(`✅ Set ultimate:`, initialSpells.ultimate);
      }
      
      // Passive - toujours remplacer
      if (initialSpells.passive) {
        this.spells.passive = initialSpells.passive;
        console.log(`✅ Set passive:`, initialSpells.passive);
      }
    } else {
      console.warn(`⚠️ Aucune définition de sorts pour: ${this.name} (${heroId})`);
    }
  } catch (error) {
    console.error(`❌ Erreur initialisation sorts pour ${this.name}:`, error);
  }

  // Initialiser l'équipement
  if (!this.equipment) {
    this.equipment = {};
  }

  next();
});

export default mongoose.model<IHeroDocument>("Hero", heroSchema);






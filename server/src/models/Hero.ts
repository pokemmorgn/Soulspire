// server/src/models/Hero.ts
import mongoose, { Document, Schema } from "mongoose";
import { getHeroSpellDefinition, getInitialSpells, getUnlockedSpells, isSpellUnlocked, getSpellStats } from '../data/heroSpellDefinitions';

// Interface pour les sorts équipés - NOUVEAU SYSTÈME PAR NIVEAU
interface IHeroSpells {
  level1?: { id: string; level: number };   // Sort niveau 1 (obligatoire)
  level11?: { id: string; level: number };  // Sort niveau 11 (optionnel)
  level41?: { id: string; level: number };  // Sort niveau 41 (optionnel)
  level81?: { id: string; level: number };  // Sort niveau 81 (optionnel)
  level121?: { id: string; level: number }; // Sort niveau 121 (futur)
  level151?: { id: string; level: number }; // Sort niveau 151 (futur)
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

  // Méthodes existantes
  getStatsAtLevel(level: number, stars?: number, includeEquipment?: boolean): any;
  getEquipmentStats(playerId?: string): Promise<any>;
  getTotalStats(level: number, stars: number, playerId: string): Promise<any>;
  getSetBonuses(playerId: string): Promise<any>;
  getRarityMultiplier(): number;
  getElementAdvantage(targetElement: string): number;
  getEffectiveCooldown(baseCooldown: number): number;
  getEnergyGeneration(): number;
  
  // NOUVELLES MÉTHODES POUR LE SYSTÈME PAR NIVEAU
  getAllSpellsByLevel(): Array<{ slot: string; id: string; level: number; unlockLevel: number }>;
  getSpellByLevel(spellLevel: number): { id: string; level: number } | null;
  setSpellByLevel(spellLevel: number, spellId: string, level?: number): void;
  upgradeSpellByLevel(spellLevel: number, newLevel: number): boolean;
  getUnlockedSpellsForHeroLevel(heroLevel: number): Array<{ slot: string; id: string; level: number; unlockLevel: number }>;
  getNextSpellUnlockForHeroLevel(heroLevel: number): { nextLevel: number; spellId: string; levelsRemaining: number } | null;
  isSpellUnlockedForHeroLevel(heroLevel: number, spellLevel: number): boolean;
  calculateSpellStatsByLevel(spellLevel: number, spellLevelValue: number): any;
  getSpellProgressSummary(heroLevel: number): any;
  
  // MÉTHODES DE COMPATIBILITÉ ANCIEN SYSTÈME (deprecated)
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

  // Sorts - NOUVEAU SYSTÈME PAR NIVEAU
  spells: {
    level1:  { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 12 } },
    level11: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 12 } },
    level41: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 12 } },
    level81: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 10 } },
    level121: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 10 } },
    level151: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 10 } },
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

// Index - MISE À JOUR POUR NOUVEAU SYSTÈME
heroSchema.index({ rarity: 1 });
heroSchema.index({ role: 1 });
heroSchema.index({ element: 1 });
heroSchema.index({ "spells.level1.id": 1 });
heroSchema.index({ "spells.level11.id": 1 });
heroSchema.index({ "spells.level41.id": 1 });
heroSchema.index({ "spells.level81.id": 1 });
heroSchema.index({ "spells.level121.id": 1 });
heroSchema.index({ "spells.level151.id": 1 });
heroSchema.index({ "equipment.weapon": 1 });
heroSchema.index({ "equipment.helmet": 1 });
heroSchema.index({ "equipment.armor": 1 });

// Utils
function cap(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function scalePercent(base: number, factor: number, capMax = 100) { return cap(base * factor, 0, capMax); }

// Méthode getStatsAtLevel (inchangée)
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

// Méthodes d'équipement (inchangées)
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

// Méthodes utilitaires (inchangées)
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

// Méthodes existantes (inchangées)
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

// ===============================================
// NOUVELLES MÉTHODES POUR LE SYSTÈME PAR NIVEAU
// ===============================================

/**
 * Obtient tous les sorts du héros avec leurs niveaux de déblocage
 */
heroSchema.methods.getAllSpellsByLevel = function () {
  const out: Array<{ slot: string; id: string; level: number; unlockLevel: number }> = [];
  const s = this.spells;
  
  if (s.level1?.id) out.push({ slot: "level1", id: s.level1.id, level: s.level1.level, unlockLevel: 1 });
  if (s.level11?.id) out.push({ slot: "level11", id: s.level11.id, level: s.level11.level, unlockLevel: 11 });
  if (s.level41?.id) out.push({ slot: "level41", id: s.level41.id, level: s.level41.level, unlockLevel: 41 });
  if (s.level81?.id) out.push({ slot: "level81", id: s.level81.id, level: s.level81.level, unlockLevel: 81 });
  if (s.level121?.id) out.push({ slot: "level121", id: s.level121.id, level: s.level121.level, unlockLevel: 121 });
  if (s.level151?.id) out.push({ slot: "level151", id: s.level151.id, level: s.level151.level, unlockLevel: 151 });
  
  return out;
};

/**
 * Obtient un sort spécifique par niveau de déblocage
 */
heroSchema.methods.getSpellByLevel = function (spellLevel: number) {
  const slotName = `level${spellLevel}` as keyof IHeroSpells;
  const s: any = this.spells[slotName];
  return s?.id ? { id: s.id, level: s.level } : null;
};

/**
 * Définit un sort à un niveau de déblocage spécifique
 */
heroSchema.methods.setSpellByLevel = function (spellLevel: number, id: string, level = 1) {
  const slotName = `level${spellLevel}` as keyof IHeroSpells;
  const s: any = this.spells[slotName];
  if (!s) (this.spells as any)[slotName] = { id, level };
  else { s.id = id; s.level = level; }
};

/**
 * Améliore un sort à un niveau de déblocage spécifique
 */
heroSchema.methods.upgradeSpellByLevel = function (spellLevel: number, newLevel: number) {
  const slotName = `level${spellLevel}` as keyof IHeroSpells;
  const s: any = this.spells[slotName];
  if (!s?.id) return false;
  
  const max = (spellLevel >= 81) ? 10 : 12; // Sorts ultimes max niveau 10, autres max 12
  if (newLevel > max || newLevel <= s.level) return false;
  
  s.level = newLevel; 
  return true;
};

/**
 * Obtient les sorts débloqués selon le niveau du héros
 */
heroSchema.methods.getUnlockedSpellsForHeroLevel = function (heroLevel: number) {
  const heroId = this.name.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
  const unlockedSpells = getUnlockedSpells(heroId, heroLevel);
  
  // Ajouter les niveaux actuels des sorts depuis la base
  return unlockedSpells.map(spell => {
    const currentSpell = this.getSpellByLevel(spell.level);
    return {
      slot: spell.slot,
      id: spell.spellId,
      level: currentSpell?.level || 1,
      unlockLevel: spell.level
    };
  });
};

/**
 * Obtient le prochain sort à débloquer selon le niveau du héros
 */
heroSchema.methods.getNextSpellUnlockForHeroLevel = function (heroLevel: number) {
  const heroId = this.name.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
  
  try {
    const { getNextSpellUnlock } = require('../data/heroSpellDefinitions');
    return getNextSpellUnlock(heroId, heroLevel);
  } catch (error) {
    console.error(`❌ Erreur getNextSpellUnlockForHeroLevel pour ${heroId}:`, error);
    return null;
  }
};

/**
 * Vérifie si un sort est débloqué selon le niveau du héros
 */
heroSchema.methods.isSpellUnlockedForHeroLevel = function (heroLevel: number, spellLevel: number) {
  const heroId = this.name.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
  const slotName = `level${spellLevel}`;
  return isSpellUnlocked(heroId, heroLevel, slotName);
};

/**
 * Calcule les stats d'un sort par niveau de déblocage
 */
heroSchema.methods.calculateSpellStatsByLevel = function (spellLevel: number, spellLevelValue: number) {
  const spell = this.getSpellByLevel(spellLevel);
  
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
    return getSpellStats(spell.id, spellLevelValue, this.rarity);
  } catch (error) {
    console.error(`❌ Erreur calculateSpellStatsByLevel pour ${spell.id}:`, error);
    
    // Fallback avec des valeurs génériques
    const levelScaling = 1 + (spellLevelValue - 1) * 0.1;
    
    return {
      damage: Math.floor(50 * levelScaling),
      healing: Math.floor(40 * levelScaling),
      cooldown: Math.max(1, 5 - Math.floor(spellLevelValue / 3)),
      duration: 2,
      energyCost: Math.max(10, 20 - spellLevelValue),
      effect: spell.id,
      additionalEffects: {
        note: "Using fallback stats"
      }
    };
  }
};

/**
 * Obtient un résumé complet de la progression des sorts
 */
heroSchema.methods.getSpellProgressSummary = function (heroLevel: number) {
  const heroId = this.name.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
  
  try {
    const { getHeroSpellSummary } = require('../data/heroSpellDefinitions');
    const summary = getHeroSpellSummary(heroId, heroLevel);
    
    if (!summary) {
      return {
        heroInfo: {
          heroId,
          name: this.name,
          element: this.element,
          role: this.role,
          rarity: this.rarity
        },
        spellProgress: {
          currentLevel: heroLevel,
          unlockedSpells: [],
          nextUnlock: null,
          missingSpells: [],
          progressPercentage: 0,
          totalSpells: 0,
          unlockedCount: 0
        }
      };
    }
    
    return summary;
  } catch (error) {
    console.error(`❌ Erreur getSpellProgressSummary pour ${heroId}:`, error);
    return null;
  }
};

// ===============================================
// MÉTHODES DE COMPATIBILITÉ ANCIEN SYSTÈME (deprecated)
// ===============================================

/**
 * @deprecated - Utilisez getAllSpellsByLevel() à la place
 */
heroSchema.methods.getAllSpells = function () {
  console.warn("⚠️ getAllSpells() est deprecated, utilisez getAllSpellsByLevel()");
  return this.getAllSpellsByLevel().map((spell: any) => ({
    slot: spell.slot,
    id: spell.id,
    level: spell.level
  }));
};

/**
 * @deprecated - Utilisez getSpellByLevel() à la place
 */
heroSchema.methods.getSpell = function (spellSlot: string) {
  console.warn("⚠️ getSpell() est deprecated, utilisez getSpellByLevel()");
  
  // Conversion des anciens slots vers les nouveaux
  const slotMapping: Record<string, number> = {
    "active1": 1,
    "active2": 11,
    "active3": 41,
    "ultimate": 81,
    "passive": 41
  };
  
  const spellLevel = slotMapping[spellSlot];
  if (!spellLevel) return null;
  
  return this.getSpellByLevel(spellLevel);
};

/**
 * @deprecated - Utilisez setSpellByLevel() à la place
 */
heroSchema.methods.setSpell = function (spellSlot: string, id: string, level = 1) {
  console.warn("⚠️ setSpell() est deprecated, utilisez setSpellByLevel()");
  
  // Conversion des anciens slots vers les nouveaux
  const slotMapping: Record<string, number> = {
    "active1": 1,
    "active2": 11,
    "active3": 41,
    "ultimate": 81,
    "passive": 41
  };
  
  const spellLevel = slotMapping[spellSlot];
  if (!spellLevel) return;
  
  this.setSpellByLevel(spellLevel, id, level);
};

/**
 * @deprecated - Utilisez upgradeSpellByLevel() à la place
 */
heroSchema.methods.upgradeSpell = function (spellSlot: string, newLevel: number) {
  console.warn("⚠️ upgradeSpell() est deprecated, utilisez upgradeSpellByLevel()");
  
  // Conversion des anciens slots vers les nouveaux
  const slotMapping: Record<string, number> = {
    "active1": 1,
    "active2": 11,
    "active3": 41,
    "ultimate": 81,
    "passive": 41
  };
  
  const spellLevel = slotMapping[spellSlot];
  if (!spellLevel) return false;
  
  return this.upgradeSpellByLevel(spellLevel, newLevel);
};

/**
 * @deprecated - Utilisez calculateSpellStatsByLevel() à la place
 */
heroSchema.methods.calculateSpellStats = function (spellSlot: string, level: number) {
  console.warn("⚠️ calculateSpellStats() est deprecated, utilisez calculateSpellStatsByLevel()");
  
  // Conversion des anciens slots vers les nouveaux
  const slotMapping: Record<string, number> = {
    "active1": 1,
    "active2": 11,
    "active3": 41,
    "ultimate": 81,
    "passive": 41
  };
  
  const spellLevel = slotMapping[spellSlot];
  if (!spellLevel) {
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
  
  return this.calculateSpellStatsByLevel(spellLevel, level);
};

// ===============================================
// PRÉ-SAVE HOOK - MISE À JOUR NOUVEAU SYSTÈME
// ===============================================

heroSchema.pre("save", function (next) {
  // Clamp des stats
  this.baseStats.reductionCooldown = cap(this.baseStats.reductionCooldown, 0, 50);
  this.baseStats.crit        = cap(this.baseStats.crit, 0, 100);
  this.baseStats.critResist  = cap(this.baseStats.critResist, 0, 100);
  this.baseStats.dodge       = cap(this.baseStats.dodge, 0, 100);
  this.baseStats.accuracy    = cap(this.baseStats.accuracy, 0, 100);
  this.baseStats.healthleech = cap(this.baseStats.healthleech, 0, 100);

  // Initialiser les sorts selon heroSpellDefinitions - NOUVEAU SYSTÈME
  const heroId = this.name.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
  
  console.log(`🔍 Pre-save hook for: ${this.name}, heroId: ${heroId}`);
  
  try {
    const spellDefinition = getHeroSpellDefinition(heroId);
    
    console.log(`🔍 Spell definition found:`, spellDefinition);
    
    if (spellDefinition) {
      const initialSpells = getInitialSpells(heroId, this.rarity);
      
      console.log(`🔍 Initial spells:`, JSON.stringify(initialSpells));
      
      // Level 1 - toujours présent
      if (initialSpells.level1) {
        this.spells.level1 = initialSpells.level1;
        console.log(`✅ Set level1:`, initialSpells.level1);
      }
      
      // Level 11 - si défini
      if (initialSpells.level11) {
        this.spells.level11 = initialSpells.level11;
        console.log(`✅ Set level11:`, initialSpells.level11);
      }
      
      // Level 41 - si défini
      if (initialSpells.level41) {
        this.spells.level41 = initialSpells.level41;
        console.log(`✅ Set level41:`, initialSpells.level41);
      }
      
      // Level 81 - si défini
      if (initialSpells.level81) {
        this.spells.level81 = initialSpells.level81;
        console.log(`✅ Set level81:`, initialSpells.level81);
      }
      
      // Level 121 - si défini
      if (initialSpells.level121) {
        this.spells.level121 = initialSpells.level121;
        console.log(`✅ Set level121:`, initialSpells.level121);
      }
      
      // Level 151 - si défini
      if (initialSpells.level151) {
        this.spells.level151 = initialSpells.level151;
        console.log(`✅ Set level151:`, initialSpells.level151);
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

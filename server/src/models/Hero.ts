import mongoose, { Document, Schema } from "mongoose";

// Interface pour les sorts équipés
interface IHeroSpells {
  spell1?: { id: string; level: number };
  spell2?: { id: string; level: number };
  ultimate: { id: string; level: number };
  passive1?: { id: string; level: number };
  passive2?: { id: string; level: number };
  passive3?: { id: string; level: number };
}

// ✅ NOUVELLE INTERFACE pour l'équipement
interface IHeroEquipment {
  weapon?: string;      // instanceId de l'item équipé
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

  // Stats alignées sur IItemStats
  baseStats: {
    hp: number; atk: number; def: number;
    crit: number; critDamage: number; critResist: number; dodge: number; accuracy: number;
    vitesse: number; moral: number; reductionCooldown: number; healthleech: number;
    healingBonus: number; shieldBonus: number; energyRegen: number;
  };

  spells: IHeroSpells;
  
  // ✅ NOUVEAU: Équipement du héros
  equipment: IHeroEquipment;

  // ✅ NOUVELLES MÉTHODES pour l'équipement
  getStatsAtLevel(level: number, stars?: number, includeEquipment?: boolean): any;
  getEquipmentStats(playerId?: string): Promise<any>;
  getTotalStats(level: number, stars: number, playerId: string): Promise<any>;
  getSetBonuses(playerId: string): Promise<any>;
  
  // Méthodes existantes
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
  rarity: { type: String, enum: ["Common", "Rare", "Epic", "Legendary", "Mythic"], required: true },

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

  // === Sorts ===
  spells: {
    spell1:   { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 12 } },
    spell2:   { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 12 } },
    ultimate: { id: { type: String, required: true }, level: { type: Number, default: 1, min: 1, max: 10 } },
    passive1: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 12 } },
    passive2: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 12 } },
    passive3: { id: { type: String }, level: { type: Number, default: 1, min: 1, max: 12 } },
  }

  // ✅ NOUVEAU: Équipement
  equipment: {
    weapon:    { type: String, ref: 'Inventory' },  // instanceId de l'item équipé
    helmet:    { type: String, ref: 'Inventory' },
    armor:     { type: String, ref: 'Inventory' },
    boots:     { type: String, ref: 'Inventory' },
    gloves:    { type: String, ref: 'Inventory' },
    accessory: { type: String, ref: 'Inventory' }
  }
}, { timestamps: true, collection: "heroes" });

// Index
heroSchema.index({ rarity: 1 });
heroSchema.index({ role: 1 });
heroSchema.index({ element: 1 });
heroSchema.index({ "spells.ultimate.id": 1 });
// ✅ NOUVEAUX INDEX pour l'équipement
heroSchema.index({ "equipment.weapon": 1 });
heroSchema.index({ "equipment.helmet": 1 });
heroSchema.index({ "equipment.armor": 1 });
heroSchema.index({ "spells.passive1.id": 1 });
heroSchema.index({ "spells.passive2.id": 1 });
heroSchema.index({ "spells.passive3.id": 1 });

// Utils
function cap(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function scalePercent(base: number, factor: number, capMax = 100) { return cap(base * factor, 0, capMax); }

// ✅ MÉTHODE MODIFIÉE: getStatsAtLevel avec équipement optionnel
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

  // ✅ Si pas d'équipement demandé, retourner les stats de base
  if (!includeEquipment) {
    return baseStats;
  }

  // ✅ Si équipement demandé, il faut utiliser la méthode async getTotalStats
  console.warn("Pour inclure l'équipement, utilisez getTotalStats() qui est async");
  return baseStats;
};

// ✅ NOUVELLE MÉTHODE: Récupérer les stats de l'équipement
heroSchema.methods.getEquipmentStats = async function (playerId?: string): Promise<any> {
  try {
    // Si pas de playerId fourni, on ne peut pas récupérer l'inventaire
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

    // ✅ Parcourir chaque slot d'équipement
    const slots = ['weapon', 'helmet', 'armor', 'boots', 'gloves', 'accessory'];
    
    for (const slot of slots) {
      const instanceId = this.equipment[slot];
      if (!instanceId) continue;

      // Trouver l'item dans l'inventaire
      const ownedItem = inventory.getItem(instanceId);
      if (!ownedItem) continue;

      // Récupérer les données de base de l'item
      const itemData = await Item.findOne({ itemId: ownedItem.itemId });
      if (!itemData) continue;

      // Calculer les stats de cet item à son niveau actuel
      const itemStats = itemData.getStatsAtLevel(ownedItem.level);
      
      // Appliquer le bonus d'amélioration (+0 à +15)
      const enhancementMultiplier = 1 + (ownedItem.enhancement * 0.05); // +5% par niveau d'amélioration
      
      // Additionner les stats
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

// ✅ NOUVELLE MÉTHODE: Stats totales (héros + équipement)
heroSchema.methods.getTotalStats = async function (level: number, stars: number, playerId: string): Promise<any> {
  try {
    // Stats de base du héros
    const heroStats = this.getStatsAtLevel(level, stars, false);
    
    // Stats de l'équipement
    const equipmentData = await this.getEquipmentStats(playerId);
    const equipmentStats = equipmentData.stats;
    const setsBonuses = equipmentData.setsBonus;

    // Combiner toutes les stats
    const totalStats = { ...heroStats };
    this.addStats(totalStats, equipmentStats);
    this.addStats(totalStats, setsBonuses);

    // Appliquer les caps
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
    // Retourner au moins les stats de base en cas d'erreur
    return {
      totalStats: this.getStatsAtLevel(level, stars, false),
      breakdown: { hero: this.getStatsAtLevel(level, stars, false), equipment: {}, sets: {} },
      equippedItems: [],
      power: 0
    };
  }
};

// ✅ NOUVELLE MÉTHODE: Calculer les bonus de sets
heroSchema.methods.getSetBonuses = async function (playerId: string): Promise<any> {
  try {
    const Inventory = mongoose.model('Inventory');
    const Item = mongoose.model('Item');
    
    const inventory = await Inventory.findOne({ playerId });
    if (!inventory) return this.getEmptyStats();

    const equippedSets = new Map<string, number>(); // setId -> nombre de pièces équipées
    
    // Compter les pièces de set équipées
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

    // Calculer les bonus de sets
    const totalSetBonus = this.getEmptyStats();
    const activeSets = [];

    for (const [setId, piecesCount] of equippedSets) {
      if (piecesCount >= 2) {
        // ✅ TODO: Récupérer les vrais bonus de sets depuis une base de données
        // Pour l'instant, bonus basique selon le nombre de pièces
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

// ✅ MÉTHODES UTILITAIRES privées

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
  // ✅ Bonus de sets basiques (à remplacer par une vraie base de données)
  const baseBonuses: Record<number, any> = {
    2: { hp: 500, atk: 50 },      // 2 pièces
    4: { hp: 1200, atk: 120, crit: 5 },  // 4 pièces  
    6: { hp: 2500, atk: 250, crit: 10, critDamage: 25 }  // 6 pièces
  };

  const bonus = this.getEmptyStats();
  
  // Appliquer les bonus selon le nombre de pièces
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

// === MÉTHODES EXISTANTES (inchangées) ===

heroSchema.methods.getRarityMultiplier = function () {
  return ({ 
    Common: 1, 
    Rare: 1.25, 
    Epic: 1.5, 
    Legendary: 2,
    Mythic: 2.5  // ✅ NOUVEAU: Mythic x2.5
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

heroSchema.methods.getAllSpells = function () {
  const out: Array<{ slot: string; id: string; level: number }> = [];
  const s = this.spells;
  if (s.spell1?.id) out.push({ slot: "spell1", id: s.spell1.id, level: s.spell1.level });
  if (s.spell2?.id) out.push({ slot: "spell2", id: s.spell2.id, level: s.spell2.level });
  if (s.ultimate?.id) out.push({ slot: "ultimate", id: s.ultimate.id, level: s.ultimate.level });
  if (s.passive1?.id) out.push({ slot: "passive1", id: s.passive1.id, level: s.passive1.level });
  if (s.passive2?.id) out.push({ slot: "passive2", id: s.passive2.id, level: s.passive2.level });
  if (s.passive3?.id) out.push({ slot: "passive3", id: s.passive3.id, level: s.passive3.level });
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

  // ✅ NOUVEAU: Initialiser l'équipement s'il n'existe pas
  if (!this.equipment) {
    this.equipment = {};
  }

  next();
});

export default mongoose.model<IHeroDocument>("Hero", heroSchema);




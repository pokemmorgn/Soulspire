import mongoose, { Document, Schema, Model } from "mongoose";
import { ForgeModuleBase, IForgeResourceCost, IForgeOperationResult, IForgeModuleConfig } from "./ForgeCore";

// === INTERFACES SPÉCIFIQUES AU REFORGE ===

interface IForgeSlotConfig {
  slot: string;
  availableStats: string[];
  minStats: number;
  maxStats: number;
  maxLockedStats: number; // Maximum 3 comme AFK Arena
}

interface IReforgeResult {
  newStats: { [stat: string]: number };
  cost: IForgeResourceCost;
  lockedStats: string[];
  reforgeCount: number;
}

interface IReforgeHistory {
  playerId: string;
  reforgeDate: Date;
  previousStats: { [stat: string]: number };
  newStats: { [stat: string]: number };
  lockedStats: string[];
  cost: IForgeResourceCost;
}

interface IReforgeConfig extends IForgeModuleConfig {
  slotConfigs: IForgeSlotConfig[];
  lockMultipliers: number[];
  qualityMultipliers: { [rarity: string]: number };
  statRanges: {
    [rarity: string]: {
      [stat: string]: { min: number; max: number };
    };
  };
}

// === DOCUMENT MONGOOSE POUR LE REFORGE ===

interface IForgeReforgeDocument extends Document {
  configId: string;
  name: string;
  description: string;
  isActive: boolean;
  config: IReforgeConfig;
  totalReforges: number;
  totalGoldSpent: number;
  totalGemsSpent: number;
  
  calculateReforgePreview(itemId: string, currentStats: { [stat: string]: number }, lockedStats: string[], itemRarity: string, equipmentSlot: string): IReforgeResult;
  executeReforge(playerId: string, itemInstanceId: string, lockedStats: string[]): Promise<IReforgeResult>;
  getReforgeHistory(itemInstanceId: string): IReforgeHistory[];
  calculateReforgeCost(rarity: string, lockedStats: string[], reforgeCount: number): any;
  generateNewStats(equipmentSlot: string, rarity: string, lockedStats: string[], currentStats: any): any;
  validateLockedStats(equipmentSlot: string, lockedStats: string[]): boolean;
  calculateCurrentItemStats(baseItem: any, ownedItem: any): any;
  getItemReforgePreview(playerId: string, itemInstanceId: string, lockedStats: string[]): Promise<IReforgeResult>;
}

// === CONFIGURATION PAR DÉFAUT AFK ARENA STYLE ===

const DEFAULT_REFORGE_CONFIG: IReforgeConfig = {
  enabled: true,
  baseGoldCost: 2000,  // Plus cher comme AFK Arena
  baseGemCost: 100,
  materialRequirements: {
    "Common": { "reforge_stone": 2 },
    "Rare": { "reforge_stone": 3, "magic_dust": 1 },
    "Epic": { "reforge_stone": 5, "magic_dust": 2 },
    "Legendary": { "reforge_stone": 8, "magic_dust": 3, "mystic_scroll": 1 },
    "Mythic": { "reforge_stone": 12, "magic_dust": 5, "mystic_scroll": 2 },
    "Ascended": { "reforge_stone": 20, "magic_dust": 8, "mystic_scroll": 3, "celestial_essence": 1 }
  },
  slotConfigs: [
    { 
      slot: "Weapon", 
      availableStats: ["atk", "crit", "critDamage", "accuracy", "healthleech"], 
      minStats: 2, 
      maxStats: 4,
      maxLockedStats: 3  // Maximum 3 locks comme AFK Arena
    },
    { 
      slot: "Armor", 
      availableStats: ["hp", "def", "critResist", "dodge", "shieldBonus"], 
      minStats: 2, 
      maxStats: 4,
      maxLockedStats: 3
    },
    { 
      slot: "Helmet", 
      availableStats: ["hp", "def", "moral", "energyRegen", "healingBonus"], 
      minStats: 2, 
      maxStats: 3,
      maxLockedStats: 2  // Moins de stats = moins de locks
    },
    { 
      slot: "Boots", 
      availableStats: ["hp", "vitesse", "dodge", "energyRegen"], 
      minStats: 2, 
      maxStats: 3,
      maxLockedStats: 2
    },
    { 
      slot: "Gloves", 
      availableStats: ["atk", "crit", "accuracy", "critDamage"], 
      minStats: 2, 
      maxStats: 3,
      maxLockedStats: 2
    },
    { 
      slot: "Accessory", 
      availableStats: ["hp", "atk", "crit", "healingBonus", "reductionCooldown"], 
      minStats: 2, 
      maxStats: 4,
      maxLockedStats: 3
    }
  ],
  lockMultipliers: [1, 1.5, 3, 6], // Plus agressif : 0, 1, 2, 3 locks
  qualityMultipliers: {
    "Common": 1, 
    "Rare": 2, 
    "Epic": 4, 
    "Legendary": 8, 
    "Mythic": 16, 
    "Ascended": 32  // Progression plus agressive
  },
  statRanges: {
    "Common": {
      "hp": { min: 50, max: 150 }, "atk": { min: 20, max: 60 }, "def": { min: 10, max: 30 },
      "crit": { min: 2, max: 8 }, "critDamage": { min: 10, max: 30 }, "critResist": { min: 5, max: 15 },
      "dodge": { min: 2, max: 10 }, "accuracy": { min: 5, max: 15 }, "vitesse": { min: 3, max: 12 },
      "moral": { min: 5, max: 20 }, "reductionCooldown": { min: 1, max: 5 }, "healthleech": { min: 2, max: 8 },
      "healingBonus": { min: 5, max: 15 }, "shieldBonus": { min: 5, max: 15 }, "energyRegen": { min: 2, max: 8 }
    },
    "Rare": {
      "hp": { min: 100, max: 300 }, "atk": { min: 40, max: 120 }, "def": { min: 20, max: 60 },
      "crit": { min: 5, max: 15 }, "critDamage": { min: 20, max: 50 }, "critResist": { min: 10, max: 25 },
      "dodge": { min: 5, max: 18 }, "accuracy": { min: 10, max: 25 }, "vitesse": { min: 8, max: 25 },
      "moral": { min: 10, max: 35 }, "reductionCooldown": { min: 2, max: 8 }, "healthleech": { min: 5, max: 15 },
      "healingBonus": { min: 10, max: 25 }, "shieldBonus": { min: 10, max: 25 }, "energyRegen": { min: 5, max: 15 }
    },
    "Epic": {
      "hp": { min: 200, max: 500 }, "atk": { min: 80, max: 200 }, "def": { min: 40, max: 100 },
      "crit": { min: 10, max: 25 }, "critDamage": { min: 40, max: 80 }, "critResist": { min: 20, max: 40 },
      "dodge": { min: 10, max: 30 }, "accuracy": { min: 20, max: 40 }, "vitesse": { min: 15, max: 40 },
      "moral": { min: 20, max: 50 }, "reductionCooldown": { min: 5, max: 15 }, "healthleech": { min: 10, max: 25 },
      "healingBonus": { min: 20, max: 40 }, "shieldBonus": { min: 20, max: 40 }, "energyRegen": { min: 10, max: 25 }
    },
    "Legendary": {
      "hp": { min: 400, max: 800 }, "atk": { min: 160, max: 320 }, "def": { min: 80, max: 160 },
      "crit": { min: 20, max: 40 }, "critDamage": { min: 80, max: 150 }, "critResist": { min: 40, max: 70 },
      "dodge": { min: 20, max: 45 }, "accuracy": { min: 40, max: 70 }, "vitesse": { min: 30, max: 60 },
      "moral": { min: 40, max: 80 }, "reductionCooldown": { min: 10, max: 25 }, "healthleech": { min: 20, max: 40 },
      "healingBonus": { min: 40, max: 70 }, "shieldBonus": { min: 40, max: 70 }, "energyRegen": { min: 20, max: 40 }
    },
    "Mythic": {
      "hp": { min: 600, max: 1200 }, "atk": { min: 240, max: 480 }, "def": { min: 120, max: 240 },
      "crit": { min: 30, max: 55 }, "critDamage": { min: 120, max: 200 }, "critResist": { min: 60, max: 90 },
      "dodge": { min: 30, max: 60 }, "accuracy": { min: 60, max: 90 }, "vitesse": { min: 45, max: 80 },
      "moral": { min: 60, max: 100 }, "reductionCooldown": { min: 15, max: 35 }, "healthleech": { min: 30, max: 55 },
      "healingBonus": { min: 60, max: 90 }, "shieldBonus": { min: 60, max: 90 }, "energyRegen": { min: 30, max: 55 }
    },
    "Ascended": {
      "hp": { min: 1000, max: 2000 }, "atk": { min: 400, max: 800 }, "def": { min: 200, max: 400 },
      "crit": { min: 45, max: 70 }, "critDamage": { min: 180, max: 300 }, "critResist": { min: 80, max: 120 },
      "dodge": { min: 45, max: 80 }, "accuracy": { min: 80, max: 120 }, "vitesse": { min: 60, max: 100 },
      "moral": { min: 80, max: 140 }, "reductionCooldown": { min: 25, max: 50 }, "healthleech": { min: 45, max: 70 },
      "healingBonus": { min: 80, max: 120 }, "shieldBonus": { min: 80, max: 120 }, "energyRegen": { min: 45, max: 70 }
    }
  }
};

// === SCHÉMAS MONGOOSE ===

const reforgeHistorySchema = new Schema<IReforgeHistory>({
  playerId: { type: String, required: true },
  reforgeDate: { type: Date, default: Date.now },
  previousStats: { type: Map, of: Number, required: true },
  newStats: { type: Map, of: Number, required: true },
  lockedStats: [{ type: String }],
  cost: {
    gold: { type: Number, default: 0 },
    gems: { type: Number, default: 0 },
    materials: { type: Map, of: Number }
  }
}, { _id: false });

const forgeSlotConfigSchema = new Schema<IForgeSlotConfig>({
  slot: { type: String, required: true },
  availableStats: [{ type: String, required: true }],
  minStats: { type: Number, required: true, min: 1 },
  maxStats: { type: Number, required: true, min: 1 },
  maxLockedStats: { type: Number, required: true, min: 0, max: 3 } // Maximum 3 comme AFK Arena
}, { _id: false });

const reforgeConfigSchema = new Schema<IReforgeConfig>({
  enabled: { type: Boolean, default: true },
  baseGoldCost: { type: Number, required: true, min: 0 },
  baseGemCost: { type: Number, required: true, min: 0 },
  materialRequirements: { type: Map, of: { type: Map, of: Number } },
  slotConfigs: [forgeSlotConfigSchema],
  lockMultipliers: [{ type: Number, required: true, min: 1 }],
  qualityMultipliers: { type: Map, of: Number },
  statRanges: { 
    type: Map, 
    of: { 
      type: Map, 
      of: {
        min: { type: Number, required: true },
        max: { type: Number, required: true }
      }
    }
  }
}, { _id: false });

const forgeReforgeSchema = new Schema<IForgeReforgeDocument>({
  configId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  config: { type: reforgeConfigSchema, required: true },
  totalReforges: { type: Number, default: 0, min: 0 },
  totalGoldSpent: { type: Number, default: 0, min: 0 },
  totalGemsSpent: { type: Number, default: 0, min: 0 }
}, {
  timestamps: true,
  collection: 'forge_reforge'
});

// === INDEX ===
forgeReforgeSchema.index({ configId: 1 });
forgeReforgeSchema.index({ isActive: 1 });

// === MÉTHODES STATIQUES ===
forgeReforgeSchema.statics.getActiveReforge = function() {
  return this.findOne({ isActive: true });
};

forgeReforgeSchema.statics.createDefaultReforge = function() {
  return new this({
    configId: "default_reforge",
    name: "Equipment Reforge - AFK Arena Style",
    description: "Reforge equipment stats with locked stat system (max 3 locks)",
    config: DEFAULT_REFORGE_CONFIG
  });
};

// === MÉTHODES D'INSTANCE ===

forgeReforgeSchema.methods.calculateReforgeCost = function(rarity: string, lockedStats: string[], reforgeCount: number = 0): any {
  const baseGold = this.config.baseGoldCost;
  const baseGems = this.config.baseGemCost;
  const qualityMultiplier = this.config.qualityMultipliers.get ? 
    this.config.qualityMultipliers.get(rarity) : 
    this.config.qualityMultipliers[rarity] || 1;
  const lockCount = Math.min(lockedStats.length, 3); // Maximum 3 locks
  const lockMultiplier = this.config.lockMultipliers[Math.min(lockCount, this.config.lockMultipliers.length - 1)];
  const reforgeMultiplier = 1 + (reforgeCount * 0.05); // Moins agressif que l'ancienne version
  
  const finalGoldCost = Math.floor(baseGold * qualityMultiplier * lockMultiplier * reforgeMultiplier);
  const finalGemCost = Math.floor(baseGems * qualityMultiplier * lockMultiplier * reforgeMultiplier);
  
  const materialCosts: { [materialId: string]: number } = {};
  const rarityMaterials = this.config.materialRequirements?.get ? 
    this.config.materialRequirements.get(rarity) : 
    this.config.materialRequirements?.[rarity];
    
  if (rarityMaterials) {
    const materialsEntries = rarityMaterials instanceof Map ? 
      rarityMaterials.entries() : 
      Object.entries(rarityMaterials);
      
    for (const [materialId, baseAmount] of materialsEntries) {
      materialCosts[materialId] = Math.floor((baseAmount as number) * Math.max(1, lockMultiplier * 0.8));
    }
  }
  
  return {
    gold: finalGoldCost,
    gems: finalGemCost,
    materials: materialCosts,
    multipliers: {
      quality: qualityMultiplier,
      locks: lockMultiplier,
      reforge: reforgeMultiplier
    }
  };
};

forgeReforgeSchema.methods.validateLockedStats = function(equipmentSlot: string, lockedStats: string[]): boolean {
  const slotConfig = this.config.slotConfigs.find((config: IForgeSlotConfig) => config.slot === equipmentSlot);
  if (!slotConfig) return false;
  
  const validLockedStats = lockedStats.filter(stat => 
    !stat.startsWith('$') && !stat.startsWith('_') && stat !== 'isNew'
  );
  
  // Vérifier le maximum de locks autorisés pour ce slot
  if (validLockedStats.length > slotConfig.maxLockedStats) {
    return false;
  }
  
  return validLockedStats.every((stat: string) => slotConfig.availableStats.includes(stat));
};

forgeReforgeSchema.methods.generateNewStats = function(equipmentSlot: string, rarity: string, lockedStats: string[], currentStats: any): any {
  const slotConfig = this.config.slotConfigs.find((config: IForgeSlotConfig) => config.slot === equipmentSlot);
  if (!slotConfig) throw new Error(`No configuration found for slot: ${equipmentSlot}`);
  
  const statRanges = this.config.statRanges.get ? 
    this.config.statRanges.get(rarity) : 
    this.config.statRanges[rarity];
    
  if (!statRanges) throw new Error(`No stat ranges found for rarity: ${rarity}`);
  
  const newStats: { [stat: string]: number } = {};
  const validLockedStats = lockedStats.filter(stat => 
    !stat.startsWith('$') && !stat.startsWith('_') && stat !== 'isNew' && slotConfig.availableStats.includes(stat)
  ).slice(0, slotConfig.maxLockedStats); // Forcer le maximum
  
  // Conserver les stats lockées
  validLockedStats.forEach((stat: string) => {
    if (typeof currentStats[stat] === 'number' && !isNaN(currentStats[stat])) {
      newStats[stat] = currentStats[stat];
    }
  });
  
  // Générer nouvelles stats - système AFK Arena style
  const totalStats = Math.floor(Math.random() * (slotConfig.maxStats - slotConfig.minStats + 1)) + slotConfig.minStats;
  const availableStats = slotConfig.availableStats.filter((stat: string) => !validLockedStats.includes(stat));
  const newStatsNeeded = Math.max(0, totalStats - validLockedStats.length);
  const statsToGenerate = Math.min(newStatsNeeded, availableStats.length);
  
  // Système de weighted selection comme AFK Arena (stats principales plus probables)
  const statWeights: { [stat: string]: number } = {
    "hp": 3, "atk": 3, "def": 2, // Stats principales
    "crit": 2, "critDamage": 2,
    "dodge": 1, "accuracy": 1, "vitesse": 1, // Stats secondaires
    "moral": 1, "reductionCooldown": 1, "healthleech": 1,
    "healingBonus": 1, "shieldBonus": 1, "energyRegen": 1
  };
  
  const selectedStats: string[] = [];
  const weightedStats = availableStats.map(stat => ({ 
    stat, 
    weight: statWeights[stat] || 1,
    random: Math.random() * (statWeights[stat] || 1)
  })).sort((a, b) => b.random - a.random);
  
  for (let i = 0; i < statsToGenerate && i < weightedStats.length; i++) {
    selectedStats.push(weightedStats[i].stat);
  }
  
  selectedStats.forEach((stat: string) => {
    const range = statRanges.get ? statRanges.get(stat) : statRanges[stat];
    if (range) {
      // Distribution normal-ish pour favoriser les valeurs moyennes-hautes
      const random1 = Math.random();
      const random2 = Math.random();
      const normalRandom = Math.max(random1, random2); // Biais vers les hautes valeurs
      
      const value = Math.floor(range.min + (range.max - range.min) * normalRandom);
      newStats[stat] = value;
    }
  });
  
  return newStats;
};

forgeReforgeSchema.methods.calculateReforgePreview = function(itemId: string, currentStats: { [stat: string]: number }, lockedStats: string[], itemRarity: string, equipmentSlot: string): IReforgeResult {
  if (!this.validateLockedStats(equipmentSlot, lockedStats)) {
    throw new Error("Invalid locked stats for this equipment slot");
  }
  
  const newStats = this.generateNewStats(equipmentSlot, itemRarity, lockedStats, currentStats);
  const cost = this.calculateReforgeCost(itemRarity, lockedStats, 0);
  
  return {
    newStats,
    cost,
    lockedStats: [...lockedStats].slice(0, 3), // Forcer max 3
    reforgeCount: 0
  };
};

forgeReforgeSchema.methods.calculateCurrentItemStats = function(baseItem: any, ownedItem: any): any {
  const currentStats: any = {};
  
  // Stats de base
  if (baseItem.baseStats) {
    for (const [stat, value] of Object.entries(baseItem.baseStats)) {
      if (typeof value === 'number' && !isNaN(value) && !stat.startsWith('$') && !stat.startsWith('_') && value > 0) {
        currentStats[stat] = value;
      }
    }
  }
  
  // Stats par niveau
  if (baseItem.statsPerLevel && ownedItem.level > 1) {
    for (const [stat, increment] of Object.entries(baseItem.statsPerLevel)) {
      if (typeof increment === 'number' && !isNaN(increment) && !stat.startsWith('$') && !stat.startsWith('_') && increment > 0) {
        const levelBonus = increment * (ownedItem.level - 1);
        currentStats[stat] = (currentStats[stat] || 0) + levelBonus;
      }
    }
  }
  
  // Enhancement
  if (ownedItem.enhancement && ownedItem.enhancement > 0) {
    const enhancementMultiplier = 1 + (ownedItem.enhancement * 0.1);
    for (const stat in currentStats) {
      if (typeof currentStats[stat] === 'number' && !isNaN(currentStats[stat])) {
        currentStats[stat] = Math.floor(currentStats[stat] * enhancementMultiplier);
      }
    }
  }
  
  // Stats reforged (prioritaires)
  if (ownedItem.reforgedStats) {
    const reforgedStats: any = {};
    for (const [stat, value] of Object.entries(ownedItem.reforgedStats)) {
      if (typeof value === 'number' && !isNaN(value) && !stat.startsWith('$') && !stat.startsWith('_')) {
        reforgedStats[stat] = value;
      }
    }
    if (Object.keys(reforgedStats).length > 0) {
      return reforgedStats;
    }
  }
  
  // Nettoyer les stats finales
  const cleanStats: any = {};
  for (const [stat, value] of Object.entries(currentStats)) {
    if (typeof value === 'number' && !isNaN(value) && value >= 0 && !stat.startsWith('$') && !stat.startsWith('_')) {
      cleanStats[stat] = Math.floor(value);
    }
  }
  
  return cleanStats;
};

// Reste des méthodes identiques...
forgeReforgeSchema.methods.executeReforge = async function(playerId: string, itemInstanceId: string, lockedStats: string[]): Promise<IReforgeResult> {
  const Player = mongoose.model('Player');
  const Inventory = mongoose.model('Inventory'); 
  const Item = mongoose.model('Item');

  // Forcer max 3 locked stats
  const validLockedStats = lockedStats.slice(0, 3);

  const [player, inventory] = await Promise.all([
    Player.findById(playerId),
    Inventory.findOne({ playerId })
  ]);

  if (!player) throw new Error("Player not found");
  if (!inventory) throw new Error("Inventory not found");

  const ownedItem = inventory.getItem(itemInstanceId);
  if (!ownedItem) throw new Error("Item not found in inventory");

  const baseItem = await Item.findOne({ itemId: ownedItem.itemId });
  if (!baseItem) throw new Error("Base item not found");
  
  if (baseItem.category !== "Equipment") {
    throw new Error("Only equipment can be reforged");
  }

  const currentStats = this.calculateCurrentItemStats(baseItem, ownedItem);
  const reforgeCount = ownedItem.equipmentData?.upgradeHistory?.length || 0;
  const cost = this.calculateReforgeCost(baseItem.rarity, validLockedStats, reforgeCount);
  
  if (!player.canAfford(cost)) {
    throw new Error("Cannot afford reforge cost");
  }
  
  // Vérifier les matériaux
  if (cost.materials && Object.keys(cost.materials).length > 0) {
    for (const [materialId, requiredAmount] of Object.entries(cost.materials)) {
      if (!inventory.hasItem(materialId, requiredAmount)) {
        throw new Error(`Insufficient material: ${materialId}`);
      }
    }
  }

  const newStats = this.generateNewStats(baseItem.equipmentSlot, baseItem.rarity, validLockedStats, currentStats);

  // Dépenser les ressources
  await player.spendCurrency(cost);
  
  if (cost.materials) {
    for (const [materialId, amount] of Object.entries(cost.materials)) {
      const materialItem = inventory.storage.craftingMaterials.find((item: any) => item.itemId === materialId);
      if (materialItem) {
        await inventory.removeItem(materialItem.instanceId, amount);
      }
    }
  }

  // Mettre à jour l'objet
  if (!ownedItem.equipmentData) {
    ownedItem.equipmentData = {
      durability: 100,
      socketedGems: [],
      upgradeHistory: []
    };
  }

  ownedItem.equipmentData.upgradeHistory.push(new Date());
  (ownedItem as any).reforgedStats = newStats;

  await Promise.all([player.save(), inventory.save()]);

  // Mettre à jour les statistiques
  this.totalReforges += 1;
  this.totalGoldSpent += cost.gold;
  this.totalGemsSpent += cost.gems;
  await this.save();

  return {
    newStats,
    cost,
    lockedStats: validLockedStats,
    reforgeCount: reforgeCount + 1
  };
};

forgeReforgeSchema.methods.getReforgeHistory = function(itemInstanceId: string): IReforgeHistory[] {
  return [];
};

forgeReforgeSchema.methods.getItemReforgePreview = async function(playerId: string, itemInstanceId: string, lockedStats: string[]): Promise<IReforgeResult> {
  const Inventory = mongoose.model('Inventory');
  const Item = mongoose.model('Item');

  // Forcer max 3 locked stats
  const validLockedStats = lockedStats.slice(0, 3);

  const inventory = await Inventory.findOne({ playerId });
  if (!inventory) throw new Error("Inventory not found");

  const ownedItem = inventory.getItem(itemInstanceId);
  if (!ownedItem) throw new Error("Item not found in inventory");

  const baseItem = await Item.findOne({ itemId: ownedItem.itemId });
  if (!baseItem) throw new Error("Base item not found");

  if (baseItem.category !== "Equipment") {
    throw new Error("Only equipment can be reforged");
  }

  const currentStats = this.calculateCurrentItemStats(baseItem, ownedItem);
  
  return this.calculateReforgePreview(ownedItem.itemId, currentStats, validLockedStats, baseItem.rarity, baseItem.equipmentSlot);
};

// === VALIDATION AVANT SAUVEGARDE ===
forgeReforgeSchema.pre('save', function(next) {
  if (!this.config || !this.config.slotConfigs || this.config.slotConfigs.length === 0) {
    return next(new Error("FORGE_SLOT_CONFIGURATIONS_REQUIRED"));
  }
  
  if (!this.config.baseGoldCost || this.config.baseGoldCost < 0 || !this.config.baseGemCost || this.config.baseGemCost < 0) {
    return next(new Error("INVALID_BASE_COSTS_CONFIGURATION"));
  }
  
  if (!this.config.lockMultipliers || this.config.lockMultipliers.length < 4) {
    return next(new Error("LOCK_MULTIPLIERS_INSUFFICIENT_ENTRIES"));
  }
  
  const invalidMultipliers = this.config.lockMultipliers.filter(mult => mult < 1);
  if (invalidMultipliers.length > 0) {
    return next(new Error("LOCK_MULTIPLIERS_MUST_BE_POSITIVE"));
  }
  
  // Valider que chaque slot a un maxLockedStats <= 3
  const invalidSlots = this.config.slotConfigs.filter(slot => slot.maxLockedStats > 3);
  if (invalidSlots.length > 0) {
    return next(new Error("MAX_LOCKED_STATS_EXCEEDS_LIMIT"));
  }
  
  next();
});

// === CRÉATION ET EXPORT DU MODÈLE ===
const ForgeReforge = mongoose.model<IForgeReforgeDocument>("ForgeReforge", forgeReforgeSchema);

// === CLASSE SERVICE POUR LE REFORGE ===

export class ForgeReforgeService extends ForgeModuleBase {
  private reforgeDocument: IForgeReforgeDocument | null = null;

  constructor(playerId: string, config: IForgeModuleConfig) {
    super(playerId, config);
  }

  getModuleName(): string {
    return "reforge";
  }

  async initialize(): Promise<void> {
    this.reforgeDocument = await ForgeReforge.findOne({ isActive: true });
    
    if (!this.reforgeDocument) {
      this.reforgeDocument = new ForgeReforge({
        configId: "default_reforge",
        name: "Equipment Reforge - AFK Arena Style",
        description: "Reforge equipment stats with locked stat system (max 3 locks)",
        config: DEFAULT_REFORGE_CONFIG
      });
      await this.reforgeDocument.save();
    }
  }

  async getReforgePreview(itemInstanceId: string, lockedStats: string[]): Promise<IReforgeResult> {
    if (!this.isEnabled()) {
      throw new Error("Reforge module is disabled");
    }

    if (!await this.checkPlayerLevelRestrictions()) {
      throw new Error("Player level restrictions not met");
    }

    if (!this.reforgeDocument) {
      await this.initialize();
    }

    if (!this.reforgeDocument) {
      throw new Error("Failed to initialize reforge document");
    }

    // Forcer max 3 locked stats
    const validLockedStats = lockedStats.slice(0, 3);

    return await this.reforgeDocument.getItemReforgePreview(this.playerId, itemInstanceId, validLockedStats);
  }

  async executeReforge(itemInstanceId: string, lockedStats: string[]): Promise<IForgeOperationResult> {
    if (!this.isEnabled()) {
      return {
        success: false,
        cost: { gold: 0, gems: 0 },
        message: "Reforge module is disabled"
      };
    }

    if (!await this.checkPlayerLevelRestrictions()) {
      return {
        success: false,
        cost: { gold: 0, gems: 0 },
        message: "Player level restrictions not met"
      };
    }

    // Validation du nombre de locked stats
    if (lockedStats.length > 3) {
      return {
        success: false,
        cost: { gold: 0, gems: 0 },
        message: "Maximum 3 stats can be locked (AFK Arena limit)"
      };
    }

    if (!this.reforgeDocument) {
      await this.initialize();
    }

    if (!this.reforgeDocument) {
      return {
        success: false,
        cost: { gold: 0, gems: 0 },
        message: "Failed to initialize reforge system"
      };
    }

    try {
      // Forcer max 3 locked stats
      const validLockedStats = lockedStats.slice(0, 3);
      const result = await this.reforgeDocument.executeReforge(this.playerId, itemInstanceId, validLockedStats);
      
      await this.updateStats(result.cost, true);
      await this.logOperation("reforge", itemInstanceId, result.cost, true, {
        lockedStats: validLockedStats,
        newStats: result.newStats,
        reforgeCount: result.reforgeCount
      });

      return {
        success: true,
        cost: result.cost,
        message: `Reforge completed successfully (${validLockedStats.length}/3 stats locked)`,
        data: result
      };
    } catch (error: any) {
      await this.updateStats({ gold: 0, gems: 0 }, false);
      await this.logOperation("reforge", itemInstanceId, { gold: 0, gems: 0 }, false, {
        error: error.message,
        lockedStats
      });

      return {
        success: false,
        cost: { gold: 0, gems: 0 },
        message: error.message
      };
    }
  }

  async getAvailableStats(equipmentSlot: string): Promise<string[]> {
    if (!this.reforgeDocument) {
      await this.initialize();
    }

    if (!this.reforgeDocument) {
      throw new Error("Failed to initialize reforge document");
    }

    const slotConfig = this.reforgeDocument.config.slotConfigs.find(config => config.slot === equipmentSlot);
    return slotConfig ? slotConfig.availableStats : [];
  }

  async getMaxLockedStats(equipmentSlot: string): Promise<number> {
    if (!this.reforgeDocument) {
      await this.initialize();
    }

    if (!this.reforgeDocument) {
      throw new Error("Failed to initialize reforge document");
    }

    const slotConfig = this.reforgeDocument.config.slotConfigs.find(config => config.slot === equipmentSlot);
    return slotConfig ? slotConfig.maxLockedStats : 3;
  }

  async getStatRanges(rarity: string): Promise<{ [stat: string]: { min: number; max: number } }> {
    if (!this.reforgeDocument) {
      await this.initialize();
    }

    if (!this.reforgeDocument) {
      throw new Error("Failed to initialize reforge document");
    }

    const statRanges = this.reforgeDocument.config.statRanges;
    let ranges: any;

    if (statRanges instanceof Map) {
      ranges = statRanges.get(rarity);
    } else {
      ranges = (statRanges as any)[rarity];
    }

    if (!ranges) return {};

    const result: { [stat: string]: { min: number; max: number } } = {};
    
    if (ranges instanceof Map) {
      for (const [stat, range] of ranges.entries()) {
        result[stat] = range;
      }
    } else {
      Object.assign(result, ranges);
    }

    return result;
  }

  async getLockMultipliers(): Promise<number[]> {
    if (!this.reforgeDocument) {
      await this.initialize();
    }

    if (!this.reforgeDocument) {
      throw new Error("Failed to initialize reforge document");
    }

    return [...this.reforgeDocument.config.lockMultipliers];
  }
}

export { IReforgeResult, IForgeReforgeDocument, DEFAULT_REFORGE_CONFIG };
export default ForgeReforge;

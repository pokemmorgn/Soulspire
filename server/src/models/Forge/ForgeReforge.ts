import mongoose, { Document, Schema } from "mongoose";
import { ForgeModuleBase, IForgeResourceCost, IForgeOperationResult, IForgeModuleConfig } from "./ForgeCore";

// === INTERFACES SPÉCIFIQUES AU REFORGE ===

interface IForgeSlotConfig {
  slot: string;
  availableStats: string[];
  minStats: number;
  maxStats: number;
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

// === CONFIGURATION PAR DÉFAUT ===

const DEFAULT_REFORGE_CONFIG: IReforgeConfig = {
  enabled: true,
  baseGoldCost: 1000,
  baseGemCost: 50,
  materialRequirements: {
    "Common": { "iron_ore": 2 },
    "Rare": { "magic_crystal": 1 },
    "Epic": { "dragon_scale": 1 },
    "Legendary": { "awakening_stone": 1 }
  },
  slotConfigs: [
    { slot: "Weapon", availableStats: ["atk", "crit", "critDamage", "accuracy", "healthleech"], minStats: 3, maxStats: 5 },
    { slot: "Armor", availableStats: ["hp", "def", "critResist", "dodge", "shieldBonus"], minStats: 3, maxStats: 5 },
    { slot: "Helmet", availableStats: ["hp", "def", "moral", "energyRegen", "healingBonus"], minStats: 3, maxStats: 4 },
    { slot: "Boots", availableStats: ["hp", "vitesse", "dodge", "energyRegen"], minStats: 2, maxStats: 4 },
    { slot: "Gloves", availableStats: ["atk", "crit", "accuracy", "critDamage"], minStats: 2, maxStats: 4 },
    { slot: "Accessory", availableStats: ["hp", "atk", "crit", "healingBonus", "reductionCooldown"], minStats: 3, maxStats: 4 }
  ],
  lockMultipliers: [1, 1, 2, 4, 8],
  qualityMultipliers: {
    "Common": 1, "Rare": 1.5, "Epic": 2.5, "Legendary": 4, "Mythic": 7, "Ascended": 12
  },
  statRanges: {
    "Common": {
      "hp": { min: 10, max: 50 }, "atk": { min: 5, max: 25 }, "def": { min: 3, max: 15 },
      "crit": { min: 1, max: 8 }, "critDamage": { min: 5, max: 25 }, "critResist": { min: 2, max: 10 },
      "dodge": { min: 1, max: 8 }, "accuracy": { min: 2, max: 12 }, "vitesse": { min: 1, max: 10 },
      "moral": { min: 2, max: 15 }, "reductionCooldown": { min: 1, max: 5 }, "healthleech": { min: 1, max: 8 },
      "healingBonus": { min: 2, max: 12 }, "shieldBonus": { min: 2, max: 10 }, "energyRegen": { min: 1, max: 5 }
    },
    "Rare": {
      "hp": { min: 30, max: 100 }, "atk": { min: 15, max: 50 }, "def": { min: 8, max: 30 },
      "crit": { min: 3, max: 15 }, "critDamage": { min: 10, max: 40 }, "critResist": { min: 5, max: 20 },
      "dodge": { min: 3, max: 15 }, "accuracy": { min: 5, max: 20 }, "vitesse": { min: 3, max: 20 },
      "moral": { min: 5, max: 25 }, "reductionCooldown": { min: 2, max: 8 }, "healthleech": { min: 2, max: 12 },
      "healingBonus": { min: 5, max: 20 }, "shieldBonus": { min: 5, max: 18 }, "energyRegen": { min: 2, max: 10 }
    },
    "Epic": {
      "hp": { min: 80, max: 200 }, "atk": { min: 40, max: 100 }, "def": { min: 20, max: 60 },
      "crit": { min: 8, max: 25 }, "critDamage": { min: 20, max: 80 }, "critResist": { min: 10, max: 35 },
      "dodge": { min: 8, max: 25 }, "accuracy": { min: 10, max: 35 }, "vitesse": { min: 8, max: 35 },
      "moral": { min: 10, max: 40 }, "reductionCooldown": { min: 3, max: 12 }, "healthleech": { min: 5, max: 20 },
      "healingBonus": { min: 10, max: 35 }, "shieldBonus": { min: 10, max: 30 }, "energyRegen": { min: 5, max: 18 }
    },
    "Legendary": {
      "hp": { min: 150, max: 400 }, "atk": { min: 80, max: 200 }, "def": { min: 40, max: 120 },
      "crit": { min: 15, max: 40 }, "critDamage": { min: 40, max: 150 }, "critResist": { min: 20, max: 60 },
      "dodge": { min: 15, max: 40 }, "accuracy": { min: 20, max: 60 }, "vitesse": { min: 15, max: 60 },
      "moral": { min: 20, max: 80 }, "reductionCooldown": { min: 5, max: 20 }, "healthleech": { min: 10, max: 35 },
      "healingBonus": { min: 20, max: 60 }, "shieldBonus": { min: 20, max: 50 }, "energyRegen": { min: 10, max: 30 }
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
  maxStats: { type: Number, required: true, min: 1 }
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
    name: "Equipment Reforge",
    description: "Reforge equipment stats with locked stat system",
    config: DEFAULT_REFORGE_CONFIG
  });
};

// === MÉTHODES D'INSTANCE ===

forgeReforgeSchema.methods.calculateReforgeCost = function(rarity: string, lockedStats: string[], reforgeCount: number = 0): any {
  const baseGold = this.config.baseGoldCost;
  const baseGems = this.config.baseGemCost;
  const qualityMultiplier = this.config.qualityMultipliers.get(rarity) || 1;
  const lockCount = lockedStats.length;
  const lockMultiplier = this.config.lockMultipliers[Math.min(lockCount, this.config.lockMultipliers.length - 1)];
  const reforgeMultiplier = 1 + (reforgeCount * 0.1);
  
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
      materialCosts[materialId] = Math.floor((baseAmount as number) * lockMultiplier);
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
    !stat.startsWith(') && !stat.startsWith('_') && stat !== 'isNew'
  );
  
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
    !stat.startsWith(') && !stat.startsWith('_') && stat !== 'isNew' && slotConfig.availableStats.includes(stat)
  );
  
  // Conserver les stats lockées
  validLockedStats.forEach((stat: string) => {
    if (typeof currentStats[stat] === 'number' && !isNaN(currentStats[stat])) {
      newStats[stat] = currentStats[stat];
    }
  });
  
  // Générer de nouvelles stats
  const totalStats = Math.floor(Math.random() * (slotConfig.maxStats - slotConfig.minStats + 1)) + slotConfig.minStats;
  const availableStats = slotConfig.availableStats.filter((stat: string) => !validLockedStats.includes(stat));
  const newStatsNeeded = totalStats - validLockedStats.length;
  const statsToGenerate = Math.min(newStatsNeeded, availableStats.length);
  
  const shuffled = [...availableStats].sort(() => 0.5 - Math.random());
  const selectedStats = shuffled.slice(0, statsToGenerate);
  
  selectedStats.forEach((stat: string) => {
    const range = statRanges.get ? statRanges.get(stat) : statRanges[stat];
    if (range) {
      const value = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
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
    lockedStats: [...lockedStats],
    reforgeCount: 0
  };
};

forgeReforgeSchema.methods.calculateCurrentItemStats = function(baseItem: any, ownedItem: any): any {
  const currentStats: any = {};
  
  // Stats de base
  if (baseItem.baseStats) {
    for (const [stat, value] of Object.entries(baseItem.baseStats)) {
      if (typeof value === 'number' && !isNaN(value) && !stat.startsWith(') && !stat.startsWith('_') && value > 0) {
        currentStats[stat] = value;
      }
    }
  }
  
  // Stats par niveau
  if (baseItem.statsPerLevel && ownedItem.level > 1) {
    for (const [stat, increment] of Object.entries(baseItem.statsPerLevel)) {
      if (typeof increment === 'number' && !isNaN(increment) && !stat.startsWith(') && !stat.startsWith('_') && increment > 0) {
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
      if (typeof value === 'number' && !isNaN(value) && !stat.startsWith(') && !stat.startsWith('_')) {
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
    if (typeof value === 'number' && !isNaN(value) && value >= 0 && !stat.startsWith(') && !stat.startsWith('_')) {
      cleanStats[stat] = Math.floor(value);
    }
  }
  
  return cleanStats;
};

forgeReforgeSchema.methods.executeReforge = async function(playerId: string, itemInstanceId: string, lockedStats: string[]): Promise<IReforgeResult> {
  const Player = mongoose.model('Player');
  const Inventory = mongoose.model('Inventory'); 
  const Item = mongoose.model('Item');

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
  const cost = this.calculateReforgeCost(baseItem.rarity, lockedStats, reforgeCount);
  
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

  const newStats = this.generateNewStats(baseItem.equipmentSlot, baseItem.rarity, lockedStats, currentStats);

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
    lockedStats: [...lockedStats],
    reforgeCount: reforgeCount + 1
  };
};

forgeReforgeSchema.methods.getReforgeHistory = function(itemInstanceId: string): IReforgeHistory[] {
  return [];
};

forgeReforgeSchema.methods.getItemReforgePreview = async function(playerId: string, itemInstanceId: string, lockedStats: string[]): Promise<IReforgeResult> {
  const Inventory = mongoose.model('Inventory');
  const Item = mongoose.model('Item');

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
  
  return this.calculateReforgePreview(ownedItem.itemId, currentStats, lockedStats, baseItem.rarity, baseItem.equipmentSlot);
};

// === VALIDATION AVANT SAUVEGARDE ===
forgeReforgeSchema.pre('save', function(next) {
  if (!this.config || !this.config.slotConfigs || this.config.slotConfigs.length === 0) {
    return next(new Error("Forge must have slot configurations"));
  }
  
  if (!this.config.baseGoldCost || this.config.baseGoldCost < 0 || !this.config.baseGemCost || this.config.baseGemCost < 0) {
    return next(new Error("Invalid base costs configuration"));
  }
  
  if (!this.config.lockMultipliers || this.config.lockMultipliers.length < 5) {
    return next(new Error("Lock multipliers must have at least 5 entries"));
  }
  
  const invalidMultipliers = this.config.lockMultipliers.filter(mult => mult < 1);
  if (invalidMultipliers.length > 0) {
    return next(new Error("All lock multipliers must be >= 1"));
  }
  
  next();
});

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
    this.reforgeDocument = await ForgeReforge.getActiveReforge();
    if (!this.reforgeDocument) {
      this.reforgeDocument = ForgeReforge.createDefaultReforge();
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

    return await this.reforgeDocument!.getItemReforgePreview(this.playerId, itemInstanceId, lockedStats);
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

    if (!this.reforgeDocument) {
      await this.initialize();
    }

    try {
      const result = await this.reforgeDocument!.executeReforge(this.playerId, itemInstanceId, lockedStats);
      
      await this.updateStats(result.cost, true);
      await this.logOperation("reforge", itemInstanceId, result.cost, true, {
        lockedStats,
        newStats: result.newStats,
        reforgeCount: result.reforgeCount
      });

      return {
        success: true,
        cost: result.cost,
        message: "Reforge completed successfully",
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

    const slotConfig = this.reforgeDocument!.config.slotConfigs.find(config => config.slot === equipmentSlot);
    return slotConfig ? slotConfig.availableStats : [];
  }

  async getStatRanges(rarity: string): Promise<{ [stat: string]: { min: number; max: number } }> {
    if (!this.reforgeDocument) {
      await this.initialize();
    }

    const ranges = this.reforgeDocument!.config.statRanges.get ? 
      this.reforgeDocument!.config.statRanges.get(rarity) :
      this.reforgeDocument!.config.statRanges[rarity];

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
}

// === EXPORT DU MODÈLE MONGOOSE ===
const ForgeReforge = mongoose.model<IForgeReforgeDocument>("ForgeReforge", forgeReforgeSchema);

export { IReforgeResult, IForgeReforgeDocument, DEFAULT_REFORGE_CONFIG };
export default ForgeReforge;

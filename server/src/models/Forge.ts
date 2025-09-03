// Générer les nouvelles stats
  const newStats = this.generateNewStats(
    baseItem.equipmentSlot, 
    baseItem.rarity, 
    lockedStats, 
    currentStats
  );

  // Effectuer la transaction
  await player.spendCurrency(cost);import mongoose, { Document, Schema } from "mongoose";

// === INTERFACES ===

// Configuration des stats disponibles par slot d'équipement
interface IForgeSlotConfig {
  slot: string;
  availableStats: string[];
  minStats: number;
  maxStats: number;
}

// Résultat d'un reforge (preview ou final)
interface IReforgeResult {
  newStats: { [stat: string]: number };
  cost: {
    gold: number;
    gems: number;
    materials?: { [materialId: string]: number };
  };
  lockedStats: string[];
  reforgeCount: number;
}

// Historique des reforges d'un objet
interface IReforgeHistory {
  playerId: string;
  reforgeDate: Date;
  previousStats: { [stat: string]: number };
  newStats: { [stat: string]: number };
  lockedStats: string[];
  cost: { gold: number; gems: number };
}

// Configuration principale de la forge
interface IForgeConfig {
  slotConfigs: IForgeSlotConfig[];
  baseCosts: {
    gold: number;
    gems: number;
    materialCosts?: { [rarity: string]: { [materialId: string]: number } };
  };
  lockMultipliers: number[]; // [0 locks, 1 lock, 2 locks, 3 locks, 4+ locks]
  qualityMultipliers: { [rarity: string]: number };
  statRanges: {
    [rarity: string]: {
      [stat: string]: { min: number; max: number };
    };
  };
}

// Document principal de la forge
interface IForgeDocument extends Document {
  configId: string;
  name: string;
  description: string;
  isActive: boolean;
  
  // Configuration globale
  config: IForgeConfig;
  
  // Stats des reforges globales (pour analytics)
  totalReforges: number;
  totalGoldSpent: number;
  totalGemsSpent: number;
  
  // Méthodes
  calculateReforgePreview(
    itemId: string, 
    currentStats: { [stat: string]: number },
    lockedStats: string[],
    itemRarity: string,
    equipmentSlot: string
  ): IReforgeResult;
  
  executeReforge(
    playerId: string,
    itemInstanceId: string,
    lockedStats: string[]
  ): Promise<IReforgeResult>;
  
  getReforgeHistory(itemInstanceId: string): IReforgeHistory[];
  calculateReforgeCost(rarity: string, lockedStats: string[], reforgeCount: number): any;
  generateNewStats(equipmentSlot: string, rarity: string, lockedStats: string[], currentStats: any): any;
  validateLockedStats(equipmentSlot: string, lockedStats: string[]): boolean;
}

// === CONFIGURATION PAR DÉFAUT ===

const DEFAULT_FORGE_CONFIG: IForgeConfig = {
  slotConfigs: [
    {
      slot: "Weapon",
      availableStats: ["atk", "crit", "critDamage", "accuracy", "healthleech"],
      minStats: 3,
      maxStats: 5
    },
    {
      slot: "Armor", 
      availableStats: ["hp", "def", "critResist", "dodge", "shieldBonus"],
      minStats: 3,
      maxStats: 5
    },
    {
      slot: "Helmet",
      availableStats: ["hp", "def", "moral", "energyRegen", "healingBonus"],
      minStats: 3,
      maxStats: 4
    },
    {
      slot: "Boots",
      availableStats: ["hp", "vitesse", "dodge", "energyRegen"],
      minStats: 2,
      maxStats: 4
    },
    {
      slot: "Gloves", 
      availableStats: ["atk", "crit", "accuracy", "critDamage"],
      minStats: 2,
      maxStats: 4
    },
    {
      slot: "Accessory",
      availableStats: ["hp", "atk", "crit", "healingBonus", "reductionCooldown"],
      minStats: 3,
      maxStats: 4
    }
  ],
  
  baseCosts: {
    gold: 1000,
    gems: 50,
    materialCosts: {
      "Common": { "iron_ore": 5 },
      "Rare": { "magic_crystal": 2 },
      "Epic": { "dragon_scale": 1 },
      "Legendary": { "awakening_stone": 1 }
    }
  },
  
  lockMultipliers: [1, 1, 2, 4, 8], // 0, 1, 2, 3, 4+ locks
  
  qualityMultipliers: {
    "Common": 1,
    "Rare": 1.5,
    "Epic": 2.5, 
    "Legendary": 4,
    "Mythic": 7,
    "Ascended": 12
  },
  
  statRanges: {
    "Common": {
      "hp": { min: 10, max: 50 },
      "atk": { min: 5, max: 25 },
      "def": { min: 3, max: 15 },
      "crit": { min: 1, max: 8 },
      "critDamage": { min: 5, max: 25 },
      "critResist": { min: 2, max: 10 },
      "dodge": { min: 1, max: 8 },
      "accuracy": { min: 2, max: 12 },
      "vitesse": { min: 1, max: 10 },
      "moral": { min: 2, max: 15 },
      "reductionCooldown": { min: 1, max: 5 },
      "healthleech": { min: 1, max: 8 },
      "healingBonus": { min: 2, max: 12 },
      "shieldBonus": { min: 2, max: 10 },
      "energyRegen": { min: 1, max: 5 }
    },
    "Rare": {
      "hp": { min: 30, max: 100 },
      "atk": { min: 15, max: 50 },
      "def": { min: 8, max: 30 },
      "crit": { min: 3, max: 15 },
      "critDamage": { min: 10, max: 40 },
      "critResist": { min: 5, max: 20 },
      "dodge": { min: 3, max: 15 },
      "accuracy": { min: 5, max: 20 },
      "vitesse": { min: 3, max: 20 },
      "moral": { min: 5, max: 25 },
      "reductionCooldown": { min: 2, max: 8 },
      "healthleech": { min: 2, max: 12 },
      "healingBonus": { min: 5, max: 20 },
      "shieldBonus": { min: 5, max: 18 },
      "energyRegen": { min: 2, max: 10 }
    },
    "Epic": {
      "hp": { min: 80, max: 200 },
      "atk": { min: 40, max: 100 },
      "def": { min: 20, max: 60 },
      "crit": { min: 8, max: 25 },
      "critDamage": { min: 20, max: 80 },
      "critResist": { min: 10, max: 35 },
      "dodge": { min: 8, max: 25 },
      "accuracy": { min: 10, max: 35 },
      "vitesse": { min: 8, max: 35 },
      "moral": { min: 10, max: 40 },
      "reductionCooldown": { min: 3, max: 12 },
      "healthleech": { min: 5, max: 20 },
      "healingBonus": { min: 10, max: 35 },
      "shieldBonus": { min: 10, max: 30 },
      "energyRegen": { min: 5, max: 18 }
    },
    "Legendary": {
      "hp": { min: 150, max: 400 },
      "atk": { min: 80, max: 200 },
      "def": { min: 40, max: 120 },
      "crit": { min: 15, max: 40 },
      "critDamage": { min: 40, max: 150 },
      "critResist": { min: 20, max: 60 },
      "dodge": { min: 15, max: 40 },
      "accuracy": { min: 20, max: 60 },
      "vitesse": { min: 15, max: 60 },
      "moral": { min: 20, max: 80 },
      "reductionCooldown": { min: 5, max: 20 },
      "healthleech": { min: 10, max: 35 },
      "healingBonus": { min: 20, max: 60 },
      "shieldBonus": { min: 20, max: 50 },
      "energyRegen": { min: 10, max: 30 }
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
    gems: { type: Number, default: 0 }
  }
}, { _id: false });

const forgeSlotConfigSchema = new Schema<IForgeSlotConfig>({
  slot: { type: String, required: true },
  availableStats: [{ type: String, required: true }],
  minStats: { type: Number, required: true, min: 1 },
  maxStats: { type: Number, required: true, min: 1 }
}, { _id: false });

const forgeConfigSchema = new Schema<IForgeConfig>({
  slotConfigs: [forgeSlotConfigSchema],
  baseCosts: {
    gold: { type: Number, required: true, min: 0 },
    gems: { type: Number, required: true, min: 0 },
    materialCosts: { type: Map, of: { type: Map, of: Number } }
  },
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

const forgeSchema = new Schema<IForgeDocument>({
  configId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  
  config: { type: forgeConfigSchema, required: true },
  
  // Analytics
  totalReforges: { type: Number, default: 0, min: 0 },
  totalGoldSpent: { type: Number, default: 0, min: 0 },
  totalGemsSpent: { type: Number, default: 0, min: 0 }
}, {
  timestamps: true,
  collection: 'forges'
});

// === INDEX ===
forgeSchema.index({ configId: 1 });
forgeSchema.index({ isActive: 1 });

// === MÉTHODES STATIQUES ===

// Obtenir la configuration de forge active
forgeSchema.statics.getActiveForge = function() {
  return this.findOne({ isActive: true });
};

// Créer la configuration par défaut
forgeSchema.statics.createDefaultForge = function() {
  return new this({
    configId: "default_forge",
    name: "Equipment Forge",
    description: "Reforge equipment stats with locked stat system",
    config: DEFAULT_FORGE_CONFIG
  });
};

// === MÉTHODES D'INSTANCE ===

// Calculer le coût d'un reforge
forgeSchema.methods.calculateReforgeCost = function(
  rarity: string, 
  lockedStats: string[], 
  reforgeCount: number = 0
): any {
  const baseGold = this.config.baseCosts.gold;
  const baseGems = this.config.baseCosts.gems;
  
  // Multiplicateur qualité
  const qualityMultiplier = this.config.qualityMultipliers.get(rarity) || 1;
  
  // Multiplicateur locks
  const lockCount = lockedStats.length;
  const lockMultiplier = this.config.lockMultipliers[Math.min(lockCount, this.config.lockMultipliers.length - 1)];
  
  // Multiplicateur nombre de reforges (coût croissant)
  const reforgeMultiplier = 1 + (reforgeCount * 0.1);
  
  const finalGoldCost = Math.floor(baseGold * qualityMultiplier * lockMultiplier * reforgeMultiplier);
  const finalGemCost = Math.floor(baseGems * qualityMultiplier * lockMultiplier * reforgeMultiplier);
  
  // Matériaux si configurés
  const materialCosts: { [materialId: string]: number } = {};
  const rarityMaterials = this.config.baseCosts.materialCosts?.get(rarity);
  if (rarityMaterials) {
    for (const [materialId, baseAmount] of rarityMaterials.entries()) {
      materialCosts[materialId] = Math.floor(baseAmount * lockMultiplier);
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

// Valider que les stats lockées sont valides pour ce slot
forgeSchema.methods.validateLockedStats = function(equipmentSlot: string, lockedStats: string[]): boolean {
  const slotConfig = this.config.slotConfigs.find(config => config.slot === equipmentSlot);
  if (!slotConfig) return false;
  
  return lockedStats.every(stat => slotConfig.availableStats.includes(stat));
};

// Générer de nouvelles stats pour le reforge
forgeSchema.methods.generateNewStats = function(
  equipmentSlot: string, 
  rarity: string, 
  lockedStats: string[], 
  currentStats: any
): any {
  const slotConfig = this.config.slotConfigs.find(config => config.slot === equipmentSlot);
  if (!slotConfig) throw new Error(`No configuration found for slot: ${equipmentSlot}`);
  
  const statRanges = this.config.statRanges.get(rarity);
  if (!statRanges) throw new Error(`No stat ranges found for rarity: ${rarity}`);
  
  const newStats: { [stat: string]: number } = {};
  
  // Conserver les stats lockées
  lockedStats.forEach(stat => {
    if (currentStats[stat] !== undefined) {
      newStats[stat] = currentStats[stat];
    }
  });
  
  // Déterminer combien de stats au total (entre min et max)
  const totalStats = Math.floor(Math.random() * (slotConfig.maxStats - slotConfig.minStats + 1)) + slotConfig.minStats;
  
  // Stats disponibles (sans les lockées)
  const availableStats = slotConfig.availableStats.filter(stat => !lockedStats.includes(stat));
  
  // Calculer combien de nouvelles stats générer
  const newStatsNeeded = totalStats - lockedStats.length;
  const statsToGenerate = Math.min(newStatsNeeded, availableStats.length);
  
  // Sélectionner aléatoirement les nouvelles stats
  const shuffled = [...availableStats].sort(() => 0.5 - Math.random());
  const selectedStats = shuffled.slice(0, statsToGenerate);
  
  // Générer les valeurs pour chaque stat
  selectedStats.forEach(stat => {
    const range = statRanges.get(stat);
    if (range) {
      const value = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      newStats[stat] = value;
    }
  });
  
  return newStats;
};

// Calculer un preview du reforge (sans l'exécuter)
forgeSchema.methods.calculateReforgePreview = function(
  itemId: string,
  currentStats: { [stat: string]: number },
  lockedStats: string[],
  itemRarity: string,
  equipmentSlot: string
): IReforgeResult {
  // Valider les stats lockées
  if (!this.validateLockedStats(equipmentSlot, lockedStats)) {
    throw new Error("Invalid locked stats for this equipment slot");
  }
  
  // Générer de nouvelles stats
  const newStats = this.generateNewStats(equipmentSlot, itemRarity, lockedStats, currentStats);
  
  // Calculer le coût (reforgeCount = 0 pour le preview)
  const cost = this.calculateReforgeCost(itemRarity, lockedStats, 0);
  
  return {
    newStats,
    cost,
    lockedStats: [...lockedStats],
    reforgeCount: 0
  };
};

// Exécuter un reforge réel (nécessite l'intégration avec Inventory)
forgeSchema.methods.executeReforge = async function(
  playerId: string,
  itemInstanceId: string,
  lockedStats: string[]
): Promise<IReforgeResult> {
  // Cette méthode nécessiterait l'intégration avec les modèles Player et Inventory
  // Pour l'instant, on retourne un placeholder
  throw new Error("executeReforge requires integration with Player and Inventory models");
};

// Obtenir l'historique des reforges d'un objet
forgeSchema.methods.getReforgeHistory = function(itemInstanceId: string): IReforgeHistory[] {
  // Cette méthode nécessiterait un système de tracking séparé
  // Pour l'instant, on retourne un tableau vide
  return [];
};

// Validation avant sauvegarde
forgeSchema.pre('save', function(next) {
  // Valider la configuration
  if (!this.config || !this.config.slotConfigs || this.config.slotConfigs.length === 0) {
    return next(new Error("Forge must have slot configurations"));
  }
  
  if (!this.config.baseCosts || this.config.baseCosts.gold < 0 || this.config.baseCosts.gems < 0) {
    return next(new Error("Invalid base costs configuration"));
  }
  
  if (!this.config.lockMultipliers || this.config.lockMultipliers.length < 5) {
    return next(new Error("Lock multipliers must have at least 5 entries"));
  }
  
  // Valider que tous les multiplicateurs sont >= 1
  const invalidMultipliers = this.config.lockMultipliers.filter(mult => mult < 1);
  if (invalidMultipliers.length > 0) {
    return next(new Error("All lock multipliers must be >= 1"));
  }
  
  next();
});

export default mongoose.model<IForgeDocument>("Forge", forgeSchema);

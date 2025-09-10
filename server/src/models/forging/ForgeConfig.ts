import { Schema, model, Document } from 'mongoose';
import { IdGenerator } from '../../utils/idGenerator';

// === INTERFACES ===

export interface IForgeModuleConfig {
  enabled: boolean;
  baseGoldCost: number;
  baseGemCost: number;
  
  // Material requirements par rareté
  materialRequirements: Map<string, Map<string, number>>; // rarity -> materialId -> quantity
  
  // Restrictions de niveau joueur
  levelRestrictions: {
    minPlayerLevel: number;
    maxPlayerLevel?: number;
  };
  
  // Cooldowns et limites
  limits: {
    dailyLimit?: number;
    cooldownMs?: number;
    maxConcurrentOperations?: number;
  };
  
  // Configuration spécifique par module
  moduleSpecific: any;
}

export interface IEnhancementConfig extends IForgeModuleConfig {
  moduleSpecific: {
    maxLevel: number;
    baseSuccessRates: Map<number, number>; // level -> success rate
    pitySystem: {
      enabled: boolean;
      threshold: number;
      increasePerFail: number;
      maxBonus: number;
      resetLevels: number[];
    };
    guaranteedLevels: number[];
    costMultipliers: {
      exponentialFactor: number;
      rarityMultipliers: Map<string, number>;
    };
  };
}

export interface IReforgeConfig extends IForgeModuleConfig {
  moduleSpecific: {
    maxLockedStats: number;
    lockMultipliers: number[]; // [1, 1.5, 3, 6] pour 0, 1, 2, 3 locks
    slotConfigurations: Map<string, {
      availableStats: string[];
      minStats: number;
      maxStats: number;
      statWeights: Map<string, number>; // stat -> probability weight
    }>;
    statRanges: Map<string, Map<string, { min: number; max: number }>>; // rarity -> stat -> range
    qualityMultipliers: Map<string, number>; // rarity -> multiplier
  };
}

export interface IFusionConfig extends IForgeModuleConfig {
  moduleSpecific: {
    requiredItems: number;
    maxFusionRarity: string;
    rarityProgression: Map<string, string>; // current -> next rarity
    rarityMultipliers: Map<string, number>; // rarity -> stat multiplier
    conservationRules: {
      levelMethod: 'highest' | 'average' | 'sum';
      enhancementMethod: 'highest' | 'average' | 'sum';
    };
  };
}

export interface ITierUpgradeConfig extends IForgeModuleConfig {
  moduleSpecific: {
    maxTier: number;
    tierMultipliers: Map<number, number>; // tier -> stat multiplier
    costMultipliers: Map<number, number>; // tier -> cost multiplier
    rarityLimits: Map<string, number>; // rarity -> max tier allowed
    materialScaling: {
      exponentialFactor: number;
      rarityFactors: Map<string, number>;
    };
  };
}

export interface IForgeConfigDocument extends Document {
  configId: string;
  configName: string;
  description: string;
  version: string;
  isActive: boolean;
  
  // Configurations par module
  reforgeConfig: IReforgeConfig;
  enhancementConfig: IEnhancementConfig;
  fusionConfig: IFusionConfig;
  tierUpgradeConfig: ITierUpgradeConfig;
  
  // Configuration globale
  globalSettings: {
    maintenanceMode: boolean;
    emergencyDisable: boolean;
    maxOperationsPerSecond: number;
    logLevel: 'none' | 'errors' | 'all';
    enableAnalytics: boolean;
    enableNotifications: boolean;
  };
  
  // Événements spéciaux
  events: Array<{
    eventId: string;
    eventName: string;
    description: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    effects: {
      successRateBonus?: number; // +10% success rate
      costReduction?: number; // -20% cost
      materialBonus?: number; // +50% materials returned on fail
      experienceBonus?: number; // +100% XP
      freeOperations?: number; // X free operations per day
    };
    affectedModules: string[];
  }>;
  
  // A/B Testing
  experiments: Array<{
    experimentId: string;
    name: string;
    description: string;
    isActive: boolean;
    trafficPercentage: number; // 0-100%
    variants: Array<{
      variantId: string;
      name: string;
      configOverrides: any; // Partial config changes
      weight: number; // Relative weight for variant selection
    }>;
    metrics: string[]; // Metrics to track for this experiment
  }>;
  
  // Métadonnées
  createdBy: string;
  lastModifiedBy: string;
  appliedDate: Date;
  rollbackConfigId?: string; // Pour rollback rapide
  changeLog: Array<{
    timestamp: Date;
    author: string;
    changes: string[];
    reason: string;
  }>;
}

// === SCHEMA MONGOOSE ===

const forgeModuleConfigSchema = new Schema({
  enabled: { type: Boolean, required: true, default: true },
  baseGoldCost: { type: Number, required: true, min: 0 },
  baseGemCost: { type: Number, required: true, min: 0 },
  materialRequirements: { 
    type: Map, 
    of: { type: Map, of: Number } 
  },
  levelRestrictions: {
    minPlayerLevel: { type: Number, required: true, min: 1 },
    maxPlayerLevel: { type: Number, min: 1 }
  },
  limits: {
    dailyLimit: { type: Number, min: 1 },
    cooldownMs: { type: Number, min: 0 },
    maxConcurrentOperations: { type: Number, min: 1, default: 1 }
  },
  moduleSpecific: { type: Schema.Types.Mixed, required: true }
}, { _id: false });

const eventSchema = new Schema({
  eventId: { 
    type: String, 
    required: true,
    default: () => IdGenerator.generateEventId()
  },
  eventName: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  effects: {
    successRateBonus: { type: Number, min: 0, max: 100 },
    costReduction: { type: Number, min: 0, max: 90 },
    materialBonus: { type: Number, min: 0, max: 200 },
    experienceBonus: { type: Number, min: 0, max: 500 },
    freeOperations: { type: Number, min: 0, max: 50 }
  },
  affectedModules: [{ 
    type: String, 
    enum: ['reforge', 'enhancement', 'fusion', 'tierUpgrade', 'all'] 
  }]
}, { _id: false });

const experimentSchema = new Schema({
  experimentId: { 
    type: String, 
    required: true,
    default: () => IdGenerator.generateUUID()
  },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500 },
  isActive: { type: Boolean, default: false },
  trafficPercentage: { type: Number, required: true, min: 0, max: 100 },
  variants: [{
    variantId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    configOverrides: { type: Schema.Types.Mixed },
    weight: { type: Number, required: true, min: 0, default: 1 }
  }],
  metrics: [{ type: String, trim: true }]
}, { _id: false });

const changeLogSchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  author: { type: String, required: true, trim: true },
  changes: [{ type: String, trim: true }],
  reason: { type: String, trim: true, maxlength: 255 }
}, { _id: false });

const forgeConfigSchema = new Schema<IForgeConfigDocument>({
  configId: {
    type: String,
    required: true,
    unique: true,
    default: () => `FORGE_CONFIG_${IdGenerator.generateCompactUUID()}`
  },
  
  configName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  version: {
    type: String,
    required: true,
    match: /^\d+\.\d+\.\d+$/,
    default: '1.0.0'
  },
  
  isActive: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },
  
  // Module configurations
  reforgeConfig: forgeModuleConfigSchema,
  enhancementConfig: forgeModuleConfigSchema,
  fusionConfig: forgeModuleConfigSchema,
  tierUpgradeConfig: forgeModuleConfigSchema,
  
  // Global settings
  globalSettings: {
    maintenanceMode: { type: Boolean, default: false },
    emergencyDisable: { type: Boolean, default: false },
    maxOperationsPerSecond: { type: Number, min: 1, max: 1000, default: 100 },
    logLevel: { 
      type: String, 
      enum: ['none', 'errors', 'all'], 
      default: 'errors' 
    },
    enableAnalytics: { type: Boolean, default: true },
    enableNotifications: { type: Boolean, default: true }
  },
  
  // Events
  events: [eventSchema],
  
  // A/B Testing
  experiments: [experimentSchema],
  
  // Metadata
  createdBy: { 
    type: String, 
    required: true, 
    trim: true,
    default: 'system' 
  },
  
  lastModifiedBy: { 
    type: String, 
    required: true, 
    trim: true,
    default: 'system'
  },
  
  appliedDate: { 
    type: Date, 
    default: Date.now 
  },
  
  rollbackConfigId: { 
    type: String,
    match: /^FORGE_CONFIG_[a-f0-9]{32}$/i
  },
  
  changeLog: [changeLogSchema]
  
}, {
  timestamps: true,
  collection: 'forge_configs'
});

// === INDEX POUR PERFORMANCE ===

forgeConfigSchema.index({ configId: 1 }, { unique: true });
forgeConfigSchema.index({ isActive: 1 });
forgeConfigSchema.index({ version: 1 });
forgeConfigSchema.index({ appliedDate: -1 });
forgeConfigSchema.index({ 'events.isActive': 1, 'events.startDate': 1, 'events.endDate': 1 });
forgeConfigSchema.index({ 'experiments.isActive': 1 });

// Ensure only one active config
forgeConfigSchema.index({ isActive: 1 }, { 
  unique: true, 
  partialFilterExpression: { isActive: true } 
});

// === MÉTHODES STATIQUES ===

forgeConfigSchema.statics.getActiveConfig = function() {
  return this.findOne({ isActive: true }).lean();
};

forgeConfigSchema.statics.createNewVersion = async function(
  baseConfigId: string, 
  updates: any, 
  author: string, 
  reason: string
) {
  const baseConfig = await this.findOne({ configId: baseConfigId });
  if (!baseConfig) {
    throw new Error('BASE_CONFIG_NOT_FOUND');
  }
  
  // Parse version and increment
  const [major, minor, patch] = baseConfig.version.split('.').map(Number);
  const newVersion = `${major}.${minor}.${patch + 1}`;
  
  // Create new config
  const newConfig = new this({
    ...baseConfig.toObject(),
    _id: undefined,
    configId: `FORGE_CONFIG_${IdGenerator.generateCompactUUID()}`,
    version: newVersion,
    isActive: false,
    ...updates,
    createdBy: author,
    lastModifiedBy: author,
    appliedDate: new Date(),
    rollbackConfigId: baseConfigId,
    changeLog: [
      ...baseConfig.changeLog,
      {
        timestamp: new Date(),
        author,
        changes: Object.keys(updates),
        reason
      }
    ]
  });
  
  return await newConfig.save();
};

forgeConfigSchema.statics.activateConfig = async function(configId: string, author: string) {
  // Start transaction to ensure atomicity
  const session = await this.db.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Deactivate current active config
      await this.updateMany({ isActive: true }, { 
        isActive: false,
        lastModifiedBy: author
      }, { session });
      
      // Activate new config
      const result = await this.updateOne(
        { configId }, 
        { 
          isActive: true,
          appliedDate: new Date(),
          lastModifiedBy: author,
          $push: {
            changeLog: {
              timestamp: new Date(),
              author,
              changes: ['activated'],
              reason: 'Config activation'
            }
          }
        }, 
        { session }
      );
      
      if (result.matchedCount === 0) {
        throw new Error('CONFIG_NOT_FOUND');
      }
    });
  } finally {
    await session.endSession();
  }
  
  return await this.findOne({ configId }).lean();
};

forgeConfigSchema.statics.getActiveEvents = function() {
  const now = new Date();
  
  return this.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$events' },
    { 
      $match: { 
        'events.isActive': true,
        'events.startDate': { $lte: now },
        'events.endDate': { $gte: now }
      } 
    },
    { $replaceRoot: { newRoot: '$events' } }
  ]);
};

forgeConfigSchema.statics.getActiveExperiments = function(trafficPercentage: number) {
  return this.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$experiments' },
    { 
      $match: { 
        'experiments.isActive': true,
        'experiments.trafficPercentage': { $gte: trafficPercentage }
      } 
    },
    { $replaceRoot: { newRoot: '$experiments' } }
  ]);
};

forgeConfigSchema.statics.rollbackToConfig = async function(targetConfigId: string, author: string, reason: string) {
  const targetConfig = await this.findOne({ configId: targetConfigId });
  if (!targetConfig) {
    throw new Error('ROLLBACK_TARGET_NOT_FOUND');
  }
  
  return await this.activateConfig(targetConfigId, author);
};

// === MÉTHODES D'INSTANCE ===

forgeConfigSchema.methods.getModuleConfig = function(moduleName: 'reforge' | 'enhancement' | 'fusion' | 'tierUpgrade') {
  const configMap = {
    reforge: this.reforgeConfig,
    enhancement: this.enhancementConfig,
    fusion: this.fusionConfig,
    tierUpgrade: this.tierUpgradeConfig
  };
  
  return configMap[moduleName];
};

forgeConfigSchema.methods.isModuleEnabled = function(moduleName: 'reforge' | 'enhancement' | 'fusion' | 'tierUpgrade'): boolean {
  if (this.globalSettings.maintenanceMode || this.globalSettings.emergencyDisable) {
    return false;
  }
  
  const moduleConfig = this.getModuleConfig(moduleName);
  return moduleConfig?.enabled ?? false;
};

forgeConfigSchema.methods.getEffectiveConfig = function(moduleName: string, playerId?: string): any {
  let baseConfig = this.getModuleConfig(moduleName as any);
  if (!baseConfig) return null;
  
  // Apply active events
  const now = new Date();
  const activeEvents = this.events.filter(event => 
    event.isActive && 
    event.startDate <= now && 
    event.endDate >= now &&
    (event.affectedModules.includes(moduleName) || event.affectedModules.includes('all'))
  );
  
  // Apply event effects
  let effectiveConfig = JSON.parse(JSON.stringify(baseConfig));
  
  activeEvents.forEach(event => {
    if (event.effects.costReduction) {
      effectiveConfig.baseGoldCost = Math.floor(effectiveConfig.baseGoldCost * (1 - event.effects.costReduction / 100));
      effectiveConfig.baseGemCost = Math.floor(effectiveConfig.baseGemCost * (1 - event.effects.costReduction / 100));
    }
    
    if (event.effects.successRateBonus && effectiveConfig.moduleSpecific?.baseSuccessRates) {
      // Apply success rate bonus to enhancement
      for (const [level, rate] of effectiveConfig.moduleSpecific.baseSuccessRates.entries()) {
        effectiveConfig.moduleSpecific.baseSuccessRates.set(level, Math.min(1.0, rate * (1 + event.effects.successRateBonus / 100)));
      }
    }
  });
  
  // Apply A/B test variants if playerId provided
  if (playerId) {
    const playerHash = this.hashPlayerId(playerId);
    const activeExperiments = this.experiments.filter(exp => 
      exp.isActive && 
      (playerHash % 100) < exp.trafficPercentage
    );
    
    activeExperiments.forEach(experiment => {
      const variant = this.selectVariant(experiment, playerId);
      if (variant && variant.configOverrides) {
        Object.assign(effectiveConfig, variant.configOverrides);
      }
    });
  }
  
  return effectiveConfig;
};

forgeConfigSchema.methods.hashPlayerId = function(playerId: string): number {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    const char = playerId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

forgeConfigSchema.methods.selectVariant = function(experiment: any, playerId: string) {
  const playerHash = this.hashPlayerId(playerId + experiment.experimentId);
  const totalWeight = experiment.variants.reduce((sum: number, v: any) => sum + v.weight, 0);
  
  if (totalWeight === 0) return experiment.variants[0];
  
  const threshold = playerHash % totalWeight;
  let currentWeight = 0;
  
  for (const variant of experiment.variants) {
    currentWeight += variant.weight;
    if (threshold < currentWeight) {
      return variant;
    }
  }
  
  return experiment.variants[0];
};

forgeConfigSchema.methods.addChangeLogEntry = function(author: string, changes: string[], reason: string) {
  this.changeLog.push({
    timestamp: new Date(),
    author,
    changes,
    reason
  });
  
  this.lastModifiedBy = author;
};

forgeConfigSchema.methods.validateConfiguration = function(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate module configs
  const modules = ['reforgeConfig', 'enhancementConfig', 'fusionConfig', 'tierUpgradeConfig'] as const;
  
  modules.forEach(moduleName => {
    const config = this[moduleName];
    
    if (!config) {
      errors.push(`${moduleName} is required`);
      return;
    }
    
    if (config.baseGoldCost < 0) {
      errors.push(`${moduleName}.baseGoldCost must be non-negative`);
    }
    
    if (config.baseGemCost < 0) {
      errors.push(`${moduleName}.baseGemCost must be non-negative`);
    }
    
    if (config.levelRestrictions.minPlayerLevel < 1) {
      errors.push(`${moduleName}.levelRestrictions.minPlayerLevel must be at least 1`);
    }
  });
  
  // Validate events
  this.events.forEach((event, index) => {
    if (event.startDate >= event.endDate) {
      errors.push(`Event ${index}: startDate must be before endDate`);
    }
    
    if (event.effects.successRateBonus && (event.effects.successRateBonus < 0 || event.effects.successRateBonus > 100)) {
      errors.push(`Event ${index}: successRateBonus must be between 0-100`);
    }
  });
  
  // Validate experiments
  this.experiments.forEach((experiment, index) => {
    if (experiment.trafficPercentage < 0 || experiment.trafficPercentage > 100) {
      errors.push(`Experiment ${index}: trafficPercentage must be between 0-100`);
    }
    
    const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight === 0) {
      errors.push(`Experiment ${index}: variants must have total weight > 0`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// === VALIDATION AVANT SAUVEGARDE ===

forgeConfigSchema.pre('save', function(next) {
  // Validate configuration inline to avoid method binding issues
  const errors: string[] = [];
  
  // Validate module configs
  const modules = ['reforgeConfig', 'enhancementConfig', 'fusionConfig', 'tierUpgradeConfig'] as const;
  
  modules.forEach(moduleName => {
    const config = (this as any)[moduleName];
    
    if (!config) {
      errors.push(`${moduleName} is required`);
      return;
    }
    
    if (config.baseGoldCost < 0) {
      errors.push(`${moduleName}.baseGoldCost must be non-negative`);
    }
    
    if (config.baseGemCost < 0) {
      errors.push(`${moduleName}.baseGemCost must be non-negative`);
    }
    
    if (config.levelRestrictions.minPlayerLevel < 1) {
      errors.push(`${moduleName}.levelRestrictions.minPlayerLevel must be at least 1`);
    }
  });
  
  // Validate events
  this.events.forEach((event: any, index: number) => {
    if (event.startDate >= event.endDate) {
      errors.push(`Event ${index}: startDate must be before endDate`);
    }
    
    if (event.effects.successRateBonus && (event.effects.successRateBonus < 0 || event.effects.successRateBonus > 100)) {
      errors.push(`Event ${index}: successRateBonus must be between 0-100`);
    }
  });
  
  // Validate experiments
  this.experiments.forEach((experiment: any, index: number) => {
    if (experiment.trafficPercentage < 0 || experiment.trafficPercentage > 100) {
      errors.push(`Experiment ${index}: trafficPercentage must be between 0-100`);
    }
    
    const totalWeight = experiment.variants.reduce((sum: number, v: any) => sum + v.weight, 0);
    if (totalWeight === 0) {
      errors.push(`Experiment ${index}: variants must have total weight > 0`);
    }
  });
  
  // Check if validation passed
  if (errors.length > 0) {
    return next(new Error(`CONFIG_VALIDATION_FAILED: ${errors.join(', ')}`));
  }
  
  // Ensure version format
  if (!/^\d+\.\d+\.\d+$/.test(this.version)) {
    return next(new Error('INVALID_VERSION_FORMAT'));
  }
  
  // Limit changelog entries (keep last 50)
  if (this.changeLog.length > 50) {
    this.changeLog = this.changeLog.slice(-50);
  }
  
  next();
});

// === MIDDLEWARE POST-SAVE ===

forgeConfigSchema.post('save', function(doc) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ForgeConfig] Config saved: ${doc.configId} v${doc.version} (active: ${doc.isActive})`);
  }
});

// === EXPORT MODEL ===

export const ForgeConfig = model<IForgeConfigDocument>('ForgeConfig', forgeConfigSchema);
export default ForgeConfig;

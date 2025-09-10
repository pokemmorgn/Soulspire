import { Schema, model, Document } from 'mongoose';
import { IdGenerator } from '../../utils/idGenerator';

// === INTERFACES SIMPLES ===

export interface ISimpleForgeConfig {
  // Reforge
  reforge: {
    enabled: boolean;
    baseGoldCost: number;
    baseGemCost: number;
    maxLockedStats: number;
    lockMultipliers: number[]; // [1, 1.5, 3, 6]
  };
  
  // Enhancement  
  enhancement: {
    enabled: boolean;
    baseGoldCost: number;
    baseGemCost: number;
    maxLevel: number;
    baseSuccessRates: { [level: string]: number };
    pityThreshold: number;
    pityIncrease: number;
    pityMax: number;
  };
  
  // Fusion
  fusion: {
    enabled: boolean;
    baseGoldCost: number;
    baseGemCost: number;
    requiredItems: number;
    maxRarity: string;
  };
  
  // Tier Upgrade
  tierUpgrade: {
    enabled: boolean;
    baseGoldCost: number;
    baseGemCost: number;
    maxTier: number;
    tierMultipliers: { [tier: string]: number };
  };
}

export interface IForgeConfigDocument extends Document {
  configId: string;
  configName: string;
  version: string;
  isActive: boolean;
  
  // Configuration simple
  config: ISimpleForgeConfig;
  
  // Settings globaux
  globalSettings: {
    maintenanceMode: boolean;
    emergencyDisable: boolean;
    logLevel: string;
  };
  
  // Événements actifs (simplifié)
  activeEvents: Array<{
    eventName: string;
    startDate: Date;
    endDate: Date;
    costReduction: number; // 0-50 (%)
    successRateBonus: number; // 0-25 (%)
    affectedModules: string[];
  }>;
  
  // Métadonnées
  createdBy: string;
  lastModifiedBy: string;
  appliedDate: Date;
}

// === SCHEMA MONGOOSE SIMPLE ===

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
    maxlength: 100
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
  
  // Configuration principale
  config: {
    // Reforge config
    reforge: {
      enabled: { type: Boolean, default: true },
      baseGoldCost: { type: Number, default: 2000, min: 0 },
      baseGemCost: { type: Number, default: 100, min: 0 },
      maxLockedStats: { type: Number, default: 3, min: 0, max: 3 },
      lockMultipliers: [{ type: Number, default: 1 }]
    },
    
    // Enhancement config
    enhancement: {
      enabled: { type: Boolean, default: true },
      baseGoldCost: { type: Number, default: 1000, min: 0 },
      baseGemCost: { type: Number, default: 50, min: 0 },
      maxLevel: { type: Number, default: 30, min: 1, max: 30 },
      baseSuccessRates: { type: Map, of: Number },
      pityThreshold: { type: Number, default: 10, min: 1 },
      pityIncrease: { type: Number, default: 0.05, min: 0 },
      pityMax: { type: Number, default: 0.7, min: 0, max: 1 }
    },
    
    // Fusion config
    fusion: {
      enabled: { type: Boolean, default: true },
      baseGoldCost: { type: Number, default: 5000, min: 0 },
      baseGemCost: { type: Number, default: 200, min: 0 },
      requiredItems: { type: Number, default: 3, min: 1 },
      maxRarity: { type: String, default: 'Mythic' }
    },
    
    // Tier Upgrade config
    tierUpgrade: {
      enabled: { type: Boolean, default: true },
      baseGoldCost: { type: Number, default: 10000, min: 0 },
      baseGemCost: { type: Number, default: 500, min: 0 },
      maxTier: { type: Number, default: 5, min: 1, max: 5 },
      tierMultipliers: { type: Map, of: Number }
    }
  },
  
  // Global settings
  globalSettings: {
    maintenanceMode: { type: Boolean, default: false },
    emergencyDisable: { type: Boolean, default: false },
    logLevel: { 
      type: String, 
      enum: ['none', 'errors', 'all'], 
      default: 'errors' 
    }
  },
  
  // Événements (simplifié)
  activeEvents: [{
    eventName: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    costReduction: { type: Number, default: 0, min: 0, max: 50 },
    successRateBonus: { type: Number, default: 0, min: 0, max: 25 },
    affectedModules: [{ type: String }]
  }],
  
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
  }
  
}, {
  timestamps: true,
  collection: 'forge_configs'
});

// === INDEX SIMPLES ===

forgeConfigSchema.index({ configId: 1 }, { unique: true });
forgeConfigSchema.index({ isActive: 1 });
forgeConfigSchema.index({ appliedDate: -1 });

// Ensure only one active config
forgeConfigSchema.index({ isActive: 1 }, { 
  unique: true, 
  partialFilterExpression: { isActive: true } 
});

// === MÉTHODES STATIQUES SIMPLES ===

forgeConfigSchema.statics.getActiveConfig = function() {
  return this.findOne({ isActive: true }).lean();
};

forgeConfigSchema.statics.createDefaultConfig = async function() {
  // Configuration par défaut AFK Arena style
  const defaultConfig = new this({
    configName: 'Default Forge Configuration',
    version: '1.0.0',
    isActive: true,
    config: {
      reforge: {
        enabled: true,
        baseGoldCost: 2000,
        baseGemCost: 100,
        maxLockedStats: 3,
        lockMultipliers: [1, 1.5, 3, 6]
      },
      enhancement: {
        enabled: true,
        baseGoldCost: 1000,
        baseGemCost: 50,
        maxLevel: 30,
        baseSuccessRates: new Map([
          ['0-5', 1.0],
          ['6-10', 0.9],
          ['11-15', 0.7],
          ['16-20', 0.5],
          ['21-25', 0.25],
          ['26-30', 0.1]
        ]),
        pityThreshold: 10,
        pityIncrease: 0.05,
        pityMax: 0.7
      },
      fusion: {
        enabled: true,
        baseGoldCost: 5000,
        baseGemCost: 200,
        requiredItems: 3,
        maxRarity: 'Mythic'
      },
      tierUpgrade: {
        enabled: true,
        baseGoldCost: 10000,
        baseGemCost: 500,
        maxTier: 5,
        tierMultipliers: new Map([
          ['1', 1.0],
          ['2', 1.25],
          ['3', 1.60],
          ['4', 2.10],
          ['5', 2.80]
        ])
      }
    },
    globalSettings: {
      maintenanceMode: false,
      emergencyDisable: false,
      logLevel: 'errors'
    },
    activeEvents: [],
    createdBy: 'system',
    lastModifiedBy: 'system'
  });
  
  return await defaultConfig.save();
};

forgeConfigSchema.statics.activateConfig = async function(configId: string, author: string) {
  const session = await this.db.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Deactivate all configs
      await this.updateMany({ isActive: true }, { 
        isActive: false,
        lastModifiedBy: author
      }, { session });
      
      // Activate the target config
      const result = await this.updateOne(
        { configId }, 
        { 
          isActive: true,
          appliedDate: new Date(),
          lastModifiedBy: author
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
    { $unwind: '$activeEvents' },
    { 
      $match: { 
        'activeEvents.startDate': { $lte: now },
        'activeEvents.endDate': { $gte: now }
      } 
    },
    { $replaceRoot: { newRoot: '$activeEvents' } }
  ]);
};

// === MÉTHODES D'INSTANCE SIMPLES ===

forgeConfigSchema.methods.isModuleEnabled = function(moduleName: string): boolean {
  if (this.globalSettings.maintenanceMode || this.globalSettings.emergencyDisable) {
    return false;
  }
  
  const moduleConfig = this.config[moduleName as keyof ISimpleForgeConfig];
  return moduleConfig?.enabled ?? false;
};

forgeConfigSchema.methods.getModuleConfig = function(moduleName: string) {
  return this.config[moduleName as keyof ISimpleForgeConfig];
};

forgeConfigSchema.methods.getEffectiveConfig = function(moduleName: string) {
  let baseConfig = this.getModuleConfig(moduleName);
  if (!baseConfig) return null;
  
  // Apply active events
  const now = new Date();
  const activeEvents = this.activeEvents.filter((event: any) => 
    event.startDate <= now && 
    event.endDate >= now &&
    (event.affectedModules.includes(moduleName) || event.affectedModules.includes('all'))
  );
  
  // Clone base config
  let effectiveConfig = JSON.parse(JSON.stringify(baseConfig));
  
  // Apply event effects
  activeEvents.forEach((event: any) => {
    if (event.costReduction > 0) {
      effectiveConfig.baseGoldCost = Math.floor(effectiveConfig.baseGoldCost * (1 - event.costReduction / 100));
      effectiveConfig.baseGemCost = Math.floor(effectiveConfig.baseGemCost * (1 - event.costReduction / 100));
    }
    
    if (event.successRateBonus > 0 && effectiveConfig.baseSuccessRates) {
      // Apply success rate bonus for enhancement
      for (const [range, rate] of Object.entries(effectiveConfig.baseSuccessRates)) {
        (effectiveConfig.baseSuccessRates as any)[range] = Math.min(1.0, (rate as number) * (1 + event.successRateBonus / 100));
      }
    }
  });
  
  return effectiveConfig;
};

// === VALIDATION SIMPLE ===

forgeConfigSchema.pre('save', function(next) {
  // Basic validation
  if (!/^\d+\.\d+\.\d+$/.test(this.version)) {
    return next(new Error('INVALID_VERSION_FORMAT'));
  }
  
  // Validate event dates
  for (const event of this.activeEvents) {
    if (event.startDate >= event.endDate) {
      return next(new Error('INVALID_EVENT_DATES'));
    }
  }
  
  next();
});

// === MIDDLEWARE ===

forgeConfigSchema.post('save', function(doc) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ForgeConfig] Config saved: ${doc.configId} v${doc.version} (active: ${doc.isActive})`);
  }
});

// === EXPORT MODEL ===

export const ForgeConfig = model<IForgeConfigDocument>('ForgeConfig', forgeConfigSchema);
export default ForgeConfig;

import { Schema, model, Document, Types } from 'mongoose';
import { IdGenerator } from '../../utils/idGenerator';

// === INTERFACES ===

export interface IForgeOperationCost {
  gold: number;
  gems: number;
  paidGems?: number;
  materials?: Map<string, number>;
}

export interface IForgeOperationResult {
  success: boolean;
  data?: any;
  errorCode?: string;
  errorMessage?: string;
}

export interface IForgeOperationDocument extends Document {
  operationId: string;
  playerId: string;
  operationType: 'reforge' | 'enhancement' | 'fusion' | 'tierUpgrade';
  
  // Item concerné
  itemInstanceId: string;
  itemId: string; // Pour analytics même si l'item est supprimé
  itemName: string;
  itemRarity: string;
  
  // Coût de l'opération
  cost: IForgeOperationCost;
  
  // Données avant opération
  beforeData: {
    level?: number;
    enhancement?: number;
    tier?: number;
    stats?: Map<string, number>;
    reforgedStats?: Map<string, number>;
    enhancementPity?: number;
  };
  
  // Résultat de l'opération
  result: IForgeOperationResult;
  
  // Données après opération (si succès)
  afterData?: {
    level?: number;
    enhancement?: number;
    tier?: number;
    stats?: Map<string, number>;
    reforgedStats?: Map<string, number>;
    enhancementPity?: number;
  };
  
  // Métadonnées
  operationContext: {
    lockedStats?: string[]; // Pour reforge
    usedGuarantee?: boolean; // Pour enhancement
    consumedItems?: string[]; // Pour fusion
    targetTier?: number; // Pour tier upgrade
  };
  
  // Temps et performance
  timestamp: Date;
  executionTimeMs: number;
  
  // Pour analytics
  playerLevel: number;
  playerPowerScore?: number;
  sessionId?: string;
  clientVersion?: string;
}

// === SCHEMA MONGOOSE ===

const forgeOperationSchema = new Schema<IForgeOperationDocument>({
  operationId: {
    type: String,
    required: true,
    unique: true,
    default: () => IdGenerator.generateEventId() // EVENT_uuid format
  },
  
  playerId: {
    type: String,
    required: true,
    index: true,
    match: /^PLAYER_[a-f0-9]{32}$/i
  },
  
  operationType: {
    type: String,
    required: true,
    enum: ['reforge', 'enhancement', 'fusion', 'tierUpgrade'],
    index: true
  },
  
  // Item data
  itemInstanceId: {
    type: String,
    required: true,
    index: true
  },
  
  itemId: {
    type: String,
    required: true,
    index: true
  },
  
  itemName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  itemRarity: {
    type: String,
    required: true,
    enum: ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Ascended'],
    index: true
  },
  
  // Cost structure
  cost: {
    gold: { type: Number, required: true, min: 0 },
    gems: { type: Number, required: true, min: 0 },
    paidGems: { type: Number, min: 0 },
    materials: { type: Map, of: Number }
  },
  
  // Before operation state
  beforeData: {
    level: { type: Number, min: 1 },
    enhancement: { type: Number, min: 0, max: 30 },
    tier: { type: Number, min: 1, max: 5 },
    stats: { type: Map, of: Number },
    reforgedStats: { type: Map, of: Number },
    enhancementPity: { type: Number, min: 0 }
  },
  
  // Operation result
  result: {
    success: { type: Boolean, required: true, index: true },
    data: { type: Schema.Types.Mixed },
    errorCode: { type: String, trim: true },
    errorMessage: { type: String, trim: true, maxlength: 255 }
  },
  
  // After operation state (only if success)
  afterData: {
    level: { type: Number, min: 1 },
    enhancement: { type: Number, min: 0, max: 30 },
    tier: { type: Number, min: 1, max: 5 },
    stats: { type: Map, of: Number },
    reforgedStats: { type: Map, of: Number },
    enhancementPity: { type: Number, min: 0 }
  },
  
  // Operation context
  operationContext: {
    lockedStats: [{ type: String, maxlength: 50 }],
    usedGuarantee: { type: Boolean },
    consumedItems: [{ type: String }],
    targetTier: { type: Number, min: 2, max: 5 }
  },
  
  // Performance & timing
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  
  executionTimeMs: {
    type: Number,
    required: true,
    min: 0,
    max: 30000 // Max 30 secondes pour une opération
  },
  
  // Analytics data
  playerLevel: {
    type: Number,
    required: true,
    min: 1,
    index: true
  },
  
  playerPowerScore: {
    type: Number,
    min: 0
  },
  
  sessionId: {
    type: String,
    match: /^SESS_\d+_[a-f0-9]{8}$/i
  },
  
  clientVersion: {
    type: String,
    trim: true,
    maxlength: 20
  }
  
}, {
  timestamps: true,
  collection: 'forge_operations'
});

// === INDEX COMPOSITES POUR PERFORMANCE ===

// Analytics queries
forgeOperationSchema.index({ playerId: 1, timestamp: -1 });
forgeOperationSchema.index({ operationType: 1, timestamp: -1 });
forgeOperationSchema.index({ itemRarity: 1, operationType: 1 });
forgeOperationSchema.index({ 'result.success': 1, operationType: 1 });

// Time-based queries
forgeOperationSchema.index({ timestamp: -1 });
forgeOperationSchema.index({ playerId: 1, operationType: 1, timestamp: -1 });

// Item tracking
forgeOperationSchema.index({ itemInstanceId: 1, timestamp: -1 });
forgeOperationSchema.index({ itemId: 1, operationType: 1 });

// === MÉTHODES STATIQUES ===

forgeOperationSchema.statics.getPlayerOperations = function(
  playerId: string, 
  options: {
    operationType?: string;
    limit?: number;
    offset?: number;
    fromDate?: Date;
    toDate?: Date;
    successOnly?: boolean;
  } = {}
) {
  const query: any = { playerId };
  
  if (options.operationType) {
    query.operationType = options.operationType;
  }
  
  if (options.fromDate || options.toDate) {
    query.timestamp = {};
    if (options.fromDate) query.timestamp.$gte = options.fromDate;
    if (options.toDate) query.timestamp.$lte = options.toDate;
  }
  
  if (options.successOnly) {
    query['result.success'] = true;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 50)
    .skip(options.offset || 0)
    .lean();
};

forgeOperationSchema.statics.getPlayerStats = async function(playerId: string) {
  const pipeline = [
    { $match: { playerId } },
    {
      $group: {
        _id: '$operationType',
        totalOperations: { $sum: 1 },
        successfulOperations: { $sum: { $cond: ['$result.success', 1, 0] } },
        totalGoldSpent: { $sum: '$cost.gold' },
        totalGemsSpent: { $sum: '$cost.gems' },
        totalPaidGemsSpent: { $sum: '$cost.paidGems' },
        avgExecutionTime: { $avg: '$executionTimeMs' },
        lastOperation: { $max: '$timestamp' }
      }
    }
  ];
  
  const results = await this.aggregate(pipeline);
  
  // Transform to object format
  const stats: any = {};
  results.forEach((result: any) => {
    const successRate = result.totalOperations > 0 ? 
      (result.successfulOperations / result.totalOperations) * 100 : 0;
      
    stats[result._id] = {
      totalOperations: result.totalOperations,
      successfulOperations: result.successfulOperations,
      successRate: Math.round(successRate * 100) / 100,
      totalGoldSpent: result.totalGoldSpent,
      totalGemsSpent: result.totalGemsSpent,
      totalPaidGemsSpent: result.totalPaidGemsSpent || 0,
      avgExecutionTime: Math.round(result.avgExecutionTime),
      lastOperation: result.lastOperation
    };
  });
  
  return stats;
};

forgeOperationSchema.statics.getItemHistory = function(itemInstanceId: string) {
  return this.find({ itemInstanceId })
    .sort({ timestamp: 1 })
    .lean();
};

forgeOperationSchema.statics.getGlobalStats = async function(timeRange: { from: Date; to: Date }) {
  const pipeline = [
    { $match: { timestamp: { $gte: timeRange.from, $lte: timeRange.to } } },
    {
      $group: {
        _id: null,
        totalOperations: { $sum: 1 },
        successfulOperations: { $sum: { $cond: ['$result.success', 1, 0] } },
        totalGoldSpent: { $sum: '$cost.gold' },
        totalGemsSpent: { $sum: '$cost.gems' },
        uniquePlayers: { $addToSet: '$playerId' },
        operationsByType: {
          $push: {
            type: '$operationType',
            success: '$result.success'
          }
        }
      }
    }
  ];
  
  const [globalStats] = await this.aggregate(pipeline);
  
  if (!globalStats) {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      successRate: 0,
      totalGoldSpent: 0,
      totalGemsSpent: 0,
      uniquePlayers: 0,
      operationsByType: {}
    };
  }
  
  // Process operations by type
  const operationsByType: any = {};
  globalStats.operationsByType.forEach((op: any) => {
    if (!operationsByType[op.type]) {
      operationsByType[op.type] = { total: 0, successful: 0 };
    }
    operationsByType[op.type].total++;
    if (op.success) operationsByType[op.type].successful++;
  });
  
  // Calculate success rates
  Object.keys(operationsByType).forEach(type => {
    const typeStats = operationsByType[type];
    typeStats.successRate = typeStats.total > 0 ? 
      Math.round((typeStats.successful / typeStats.total) * 10000) / 100 : 0;
  });
  
  const successRate = globalStats.totalOperations > 0 ? 
    Math.round((globalStats.successfulOperations / globalStats.totalOperations) * 10000) / 100 : 0;
  
  return {
    totalOperations: globalStats.totalOperations,
    successfulOperations: globalStats.successfulOperations,
    successRate,
    totalGoldSpent: globalStats.totalGoldSpent,
    totalGemsSpent: globalStats.totalGemsSpent,
    uniquePlayers: globalStats.uniquePlayers.length,
    operationsByType
  };
};

// === MÉTHODES D'INSTANCE ===

forgeOperationSchema.methods.calculatePowerGain = function() {
  if (!this.result.success || !this.beforeData.stats || !this.afterData?.stats) {
    return 0;
  }
  
  const beforePower = this.calculatePowerScore(this.beforeData.stats);
  const afterPower = this.calculatePowerScore(this.afterData.stats);
  
  return afterPower - beforePower;
};

forgeOperationSchema.methods.calculatePowerScore = function(stats: Map<string, number> | any) {
  if (!stats) return 0;
  
  const statValues = stats instanceof Map ? Array.from(stats.values()) : Object.values(stats);
  return statValues.reduce((total: number, value: any) => {
    return total + (typeof value === 'number' ? value : 0);
  }, 0);
};

forgeOperationSchema.methods.toAnalyticsData = function() {
  return {
    operationId: this.operationId,
    playerId: this.playerId,
    operationType: this.operationType,
    itemRarity: this.itemRarity,
    success: this.result.success,
    costGold: this.cost.gold,
    costGems: this.cost.gems,
    powerGain: this.calculatePowerGain(),
    executionTime: this.executionTimeMs,
    timestamp: this.timestamp,
    playerLevel: this.playerLevel
  };
};

// === VALIDATION AVANT SAUVEGARDE ===

forgeOperationSchema.pre('save', function(next) {
  // Validation des données cohérentes
  if (this.result.success && this.operationType === 'enhancement') {
    const beforeEnhancement = this.beforeData.enhancement || 0;
    const afterEnhancement = this.afterData?.enhancement || 0;
    
    if (afterEnhancement <= beforeEnhancement) {
      return next(new Error('INVALID_ENHANCEMENT_PROGRESSION'));
    }
    
    if (afterEnhancement > 30) {
      return next(new Error('ENHANCEMENT_EXCEEDS_MAXIMUM'));
    }
  }
  
  if (this.result.success && this.operationType === 'tierUpgrade') {
    const beforeTier = this.beforeData.tier || 1;
    const afterTier = this.afterData?.tier || 1;
    
    if (afterTier <= beforeTier) {
      return next(new Error('INVALID_TIER_PROGRESSION'));
    }
    
    if (afterTier > 5) {
      return next(new Error('TIER_EXCEEDS_MAXIMUM'));
    }
  }
  
  // Validation des coûts
  if (this.cost.gold < 0 || this.cost.gems < 0) {
    return next(new Error('INVALID_NEGATIVE_COST'));
  }
  
  // Validation temps d'exécution
  if (this.executionTimeMs < 0 || this.executionTimeMs > 30000) {
    return next(new Error('INVALID_EXECUTION_TIME'));
  }
  
  next();
});

// === MIDDLEWARE POST-SAVE ===

forgeOperationSchema.post('save', function(doc) {
  // Log pour monitoring en dev
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ForgeOperation] ${doc.operationType} saved: ${doc.operationId} (${doc.result.success ? 'SUCCESS' : 'FAILED'})`);
  }
});

// === EXPORT MODEL ===

export const ForgeOperation = model<IForgeOperationDocument>('ForgeOperation', forgeOperationSchema);
export default ForgeOperation;

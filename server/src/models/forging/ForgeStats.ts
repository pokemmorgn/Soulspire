import { Schema, model, Document } from 'mongoose';
import { IdGenerator } from '../../utils/idGenerator';

// === INTERFACES ===

export interface IModuleStats {
  totalOperations: number;
  successfulOperations: number;
  totalGoldSpent: number;
  totalGemsSpent: number;
  totalPaidGemsSpent: number;
  successRate: number;
  lastOperation: Date | null;
  
  // Stats spécifiques par module
  moduleSpecific: {
    // Enhancement
    maxEnhancementReached?: number;
    totalPityTriggers?: number;
    guaranteedEnhancementsUsed?: number;
    enhancementMilestones?: number[]; // [10, 20, 30] pour les +10, +20, +30 atteints
    
    // Reforge
    totalStatLocks?: number;
    maxStatLocksUsed?: number;
    perfectRolls?: number; // Nombre de reforges avec tous les stats max
    
    // Fusion
    totalItemsFused?: number;
    highestRarityCreated?: string;
    uniqueItemsFused?: string[]; // Liste des itemIds uniques fusionnés
    
    // Tier Upgrade
    maxTierReached?: number;
    totalTierLevelsGained?: number;
    maxTierItems?: number; // Nombre d'items au tier max
  };
}

export interface IForgeAchievements {
  // Achievement IDs unlocked
  unlockedAchievements: string[];
  
  // Achievement progress
  achievementProgress: Map<string, number>;
  
  // Milestones atteints
  milestones: {
    totalOperations: number[];     // [100, 500, 1000, 5000]
    goldSpent: number[];          // [10000, 50000, 100000]
    perfectItems: number[];       // [1, 5, 10] items avec stats parfaites
    powerGained: number[];        // [1000, 5000, 10000] power total gagné
    streaks: number[];            // [5, 10, 20] succès consécutifs
  };
  
  // Records personnels
  records: {
    longestSuccessStreak: number;
    highestSinglePowerGain: number;
    mostExpensiveOperation: number; // en gold
    fastestOperation: number; // en ms
    luckiestDay: { date: Date; operations: number }; // Jour avec le plus de succès
  };
}

export interface IForgeStatsDocument extends Document {
  statsId: string;
  playerId: string;
  
  // Stats globales
  globalStats: {
    totalOperations: number;
    totalSuccessful: number;
    totalGoldSpent: number;
    totalGemsSpent: number;
    totalPaidGemsSpent: number;
    totalPowerGained: number;
    globalSuccessRate: number;
    favoriteModule: string; // Module le plus utilisé
    firstForgeDate: Date;
    lastForgeDate: Date;
  };
  
  // Stats par module
  moduleStats: {
    reforge: IModuleStats;
    enhancement: IModuleStats;
    fusion: IModuleStats;
    tierUpgrade: IModuleStats;
  };
  
  // Achievements et milestones
  achievements: IForgeAchievements;
  
  // Streaks et patterns
  streaks: {
    currentSuccessStreak: number;
    currentFailStreak: number;
    bestSuccessStreak: number;
    worstFailStreak: number;
    lastStreakUpdate: Date;
  };
  
  // Analytics temporelles
  dailyStats: Map<string, {  // Key: YYYY-MM-DD
    operations: number;
    successful: number;
    goldSpent: number;
    gemsSpent: number;
    powerGained: number;
  }>;
  
  // Preferences et settings
  preferences: {
    autoLockBestStats: boolean;
    preferredEnhancementStrategy: 'conservative' | 'aggressive' | 'balanced';
    enableNotifications: boolean;
    showDetailedResults: boolean;
    autoSellFailedItems: boolean;
  };
  
  // Cache pour performance
  cachedData: {
    lastCalculated: Date;
    totalItemsForged: number;
    averageDailyOperations: number;
    efficiencyScore: number; // 0-100 basé sur power/gold ratio
    playerRanking?: {
      globalRank: number;
      serverRank: number;
      lastRankUpdate: Date;
    };
  };
}

// === SCHEMA MONGOOSE ===

const moduleStatsSchema = new Schema({
  totalOperations: { type: Number, default: 0, min: 0 },
  successfulOperations: { type: Number, default: 0, min: 0 },
  totalGoldSpent: { type: Number, default: 0, min: 0 },
  totalGemsSpent: { type: Number, default: 0, min: 0 },
  totalPaidGemsSpent: { type: Number, default: 0, min: 0 },
  successRate: { type: Number, default: 0, min: 0, max: 100 },
  lastOperation: { type: Date, default: null },
  
  moduleSpecific: {
    // Enhancement specific
    maxEnhancementReached: { type: Number, min: 0, max: 30 },
    totalPityTriggers: { type: Number, default: 0, min: 0 },
    guaranteedEnhancementsUsed: { type: Number, default: 0, min: 0 },
    enhancementMilestones: [{ type: Number, min: 0, max: 30 }],
    
    // Reforge specific
    totalStatLocks: { type: Number, default: 0, min: 0 },
    maxStatLocksUsed: { type: Number, min: 0, max: 3 },
    perfectRolls: { type: Number, default: 0, min: 0 },
    
    // Fusion specific
    totalItemsFused: { type: Number, default: 0, min: 0 },
    highestRarityCreated: { 
      type: String, 
      enum: ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'] 
    },
    uniqueItemsFused: [{ type: String }],
    
    // Tier Upgrade specific
    maxTierReached: { type: Number, min: 1, max: 5 },
    totalTierLevelsGained: { type: Number, default: 0, min: 0 },
    maxTierItems: { type: Number, default: 0, min: 0 }
  }
}, { _id: false });

const forgeStatsSchema = new Schema<IForgeStatsDocument>({
  statsId: {
    type: String,
    required: true,
    unique: true,
    default: () => IdGenerator.generateUUID()
  },
  
  playerId: {
    type: String,
    required: true,
    unique: true,
    match: /^PLAYER_[a-f0-9]{32}$/i,
    index: true
  },
  
  // Global stats
  globalStats: {
    totalOperations: { type: Number, default: 0, min: 0 },
    totalSuccessful: { type: Number, default: 0, min: 0 },
    totalGoldSpent: { type: Number, default: 0, min: 0 },
    totalGemsSpent: { type: Number, default: 0, min: 0 },
    totalPaidGemsSpent: { type: Number, default: 0, min: 0 },
    totalPowerGained: { type: Number, default: 0 },
    globalSuccessRate: { type: Number, default: 0, min: 0, max: 100 },
    favoriteModule: { 
      type: String, 
      enum: ['reforge', 'enhancement', 'fusion', 'tierUpgrade', 'none'], 
      default: 'none' 
    },
    firstForgeDate: { type: Date, default: Date.now },
    lastForgeDate: { type: Date, default: Date.now }
  },
  
  // Module-specific stats
  moduleStats: {
    reforge: moduleStatsSchema,
    enhancement: moduleStatsSchema,
    fusion: moduleStatsSchema,
    tierUpgrade: moduleStatsSchema
  },
  
  // Achievements
  achievements: {
    unlockedAchievements: [{ type: String, trim: true }],
    achievementProgress: { type: Map, of: Number },
    milestones: {
      totalOperations: [{ type: Number, min: 0 }],
      goldSpent: [{ type: Number, min: 0 }],
      perfectItems: [{ type: Number, min: 0 }],
      powerGained: [{ type: Number, min: 0 }],
      streaks: [{ type: Number, min: 0 }]
    },
    records: {
      longestSuccessStreak: { type: Number, default: 0, min: 0 },
      highestSinglePowerGain: { type: Number, default: 0, min: 0 },
      mostExpensiveOperation: { type: Number, default: 0, min: 0 },
      fastestOperation: { type: Number, default: 999999, min: 0 },
      luckiestDay: {
        date: { type: Date, default: Date.now },
        operations: { type: Number, default: 0, min: 0 }
      }
    }
  },
  
  // Streaks
  streaks: {
    currentSuccessStreak: { type: Number, default: 0, min: 0 },
    currentFailStreak: { type: Number, default: 0, min: 0 },
    bestSuccessStreak: { type: Number, default: 0, min: 0 },
    worstFailStreak: { type: Number, default: 0, min: 0 },
    lastStreakUpdate: { type: Date, default: Date.now }
  },
  
  // Daily stats for analytics
  dailyStats: {
    type: Map,
    of: {
      operations: { type: Number, default: 0, min: 0 },
      successful: { type: Number, default: 0, min: 0 },
      goldSpent: { type: Number, default: 0, min: 0 },
      gemsSpent: { type: Number, default: 0, min: 0 },
      powerGained: { type: Number, default: 0 }
    }
  },
  
  // Player preferences
  preferences: {
    autoLockBestStats: { type: Boolean, default: false },
    preferredEnhancementStrategy: { 
      type: String, 
      enum: ['conservative', 'aggressive', 'balanced'], 
      default: 'balanced' 
    },
    enableNotifications: { type: Boolean, default: true },
    showDetailedResults: { type: Boolean, default: true },
    autoSellFailedItems: { type: Boolean, default: false }
  },
  
  // Cache data
  cachedData: {
    lastCalculated: { type: Date, default: Date.now },
    totalItemsForged: { type: Number, default: 0, min: 0 },
    averageDailyOperations: { type: Number, default: 0, min: 0 },
    efficiencyScore: { type: Number, default: 0, min: 0, max: 100 },
    playerRanking: {
      globalRank: { type: Number, min: 1 },
      serverRank: { type: Number, min: 1 },
      lastRankUpdate: { type: Date }
    }
  }
  
}, {
  timestamps: true,
  collection: 'forge_stats'
});

// === INDEX POUR PERFORMANCE ===

forgeStatsSchema.index({ playerId: 1 }, { unique: true });
forgeStatsSchema.index({ 'globalStats.totalOperations': -1 });
forgeStatsSchema.index({ 'globalStats.totalPowerGained': -1 });
forgeStatsSchema.index({ 'globalStats.lastForgeDate': -1 });
forgeStatsSchema.index({ 'cachedData.efficiencyScore': -1 });

// === MÉTHODES STATIQUES ===

forgeStatsSchema.statics.getOrCreatePlayerStats = async function(playerId: string) {
  let stats = await this.findOne({ playerId });
  
  if (!stats) {
    stats = new this({
      playerId,
      globalStats: {
        firstForgeDate: new Date(),
        lastForgeDate: new Date()
      }
    });
    await stats.save();
  }
  
  return stats;
};

forgeStatsSchema.statics.getLeaderboard = function(
  metric: 'totalOperations' | 'totalPowerGained' | 'efficiencyScore' | 'successRate',
  limit: number = 50
) {
  let sortField: string;
  
  switch (metric) {
    case 'totalOperations':
      sortField = 'globalStats.totalOperations';
      break;
    case 'totalPowerGained':
      sortField = 'globalStats.totalPowerGained';
      break;
    case 'efficiencyScore':
      sortField = 'cachedData.efficiencyScore';
      break;
    case 'successRate':
      sortField = 'globalStats.globalSuccessRate';
      break;
    default:
      sortField = 'globalStats.totalOperations';
  }
  
  return this.find({})
    .sort({ [sortField]: -1 })
    .limit(limit)
    .select('playerId globalStats.totalOperations globalStats.totalPowerGained globalStats.globalSuccessRate cachedData.efficiencyScore')
    .lean();
};

forgeStatsSchema.statics.getAchievementLeaders = function(achievementId: string, limit: number = 10) {
  return this.find({ 
    'achievements.unlockedAchievements': achievementId 
  })
    .sort({ 'globalStats.totalOperations': -1 })
    .limit(limit)
    .select('playerId globalStats achievements.unlockedAchievements')
    .lean();
};

// === MÉTHODES D'INSTANCE ===

forgeStatsSchema.methods.updateWithOperation = function(operationData: {
  operationType: 'reforge' | 'enhancement' | 'fusion' | 'tierUpgrade';
  success: boolean;
  goldSpent: number;
  gemsSpent: number;
  paidGemsSpent?: number;
  powerGain: number;
  executionTime: number;
  moduleSpecificData?: any;
}) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const now = new Date();
  
  // Update global stats
  this.globalStats.totalOperations += 1;
  this.globalStats.totalGoldSpent += operationData.goldSpent;
  this.globalStats.totalGemsSpent += operationData.gemsSpent;
  this.globalStats.totalPaidGemsSpent += operationData.paidGemsSpent || 0;
  this.globalStats.totalPowerGained += operationData.powerGain;
  this.globalStats.lastForgeDate = now;
  
  if (operationData.success) {
    this.globalStats.totalSuccessful += 1;
  }
  
  // Recalculate global success rate
  this.globalStats.globalSuccessRate = this.globalStats.totalOperations > 0 ? 
    Math.round((this.globalStats.totalSuccessful / this.globalStats.totalOperations) * 10000) / 100 : 0;
  
  // Update module stats
  const moduleStats = this.moduleStats[operationData.operationType];
  moduleStats.totalOperations += 1;
  moduleStats.totalGoldSpent += operationData.goldSpent;
  moduleStats.totalGemsSpent += operationData.gemsSpent;
  moduleStats.totalPaidGemsSpent += operationData.paidGemsSpent || 0;
  moduleStats.lastOperation = now;
  
  if (operationData.success) {
    moduleStats.successfulOperations += 1;
  }
  
  // Recalculate module success rate
  moduleStats.successRate = moduleStats.totalOperations > 0 ? 
    Math.round((moduleStats.successfulOperations / moduleStats.totalOperations) * 10000) / 100 : 0;
  
  // Update module-specific data
  if (operationData.moduleSpecificData) {
    Object.assign(moduleStats.moduleSpecific, operationData.moduleSpecificData);
  }
  
  // Update streaks
  if (operationData.success) {
    this.streaks.currentSuccessStreak += 1;
    this.streaks.currentFailStreak = 0;
    
    if (this.streaks.currentSuccessStreak > this.streaks.bestSuccessStreak) {
      this.streaks.bestSuccessStreak = this.streaks.currentSuccessStreak;
    }
  } else {
    this.streaks.currentFailStreak += 1;
    this.streaks.currentSuccessStreak = 0;
    
    if (this.streaks.currentFailStreak > this.streaks.worstFailStreak) {
      this.streaks.worstFailStreak = this.streaks.currentFailStreak;
    }
  }
  
  this.streaks.lastStreakUpdate = now;
  
  // Update daily stats
  if (!this.dailyStats.has(today)) {
    this.dailyStats.set(today, {
      operations: 0,
      successful: 0,
      goldSpent: 0,
      gemsSpent: 0,
      powerGained: 0
    });
  }
  
  const todayStats = this.dailyStats.get(today)!;
  todayStats.operations += 1;
  todayStats.goldSpent += operationData.goldSpent;
  todayStats.gemsSpent += operationData.gemsSpent;
  todayStats.powerGained += operationData.powerGain;
  
  if (operationData.success) {
    todayStats.successful += 1;
  }
  
  this.dailyStats.set(today, todayStats);
  
  // Update records
  if (operationData.powerGain > this.achievements.records.highestSinglePowerGain) {
    this.achievements.records.highestSinglePowerGain = operationData.powerGain;
  }
  
  if (operationData.goldSpent > this.achievements.records.mostExpensiveOperation) {
    this.achievements.records.mostExpensiveOperation = operationData.goldSpent;
  }
  
  if (operationData.executionTime < this.achievements.records.fastestOperation) {
    this.achievements.records.fastestOperation = operationData.executionTime;
  }
  
  if (this.streaks.currentSuccessStreak > this.achievements.records.longestSuccessStreak) {
    this.achievements.records.longestSuccessStreak = this.streaks.currentSuccessStreak;
  }
  
  // Check luckiest day
  if (todayStats.operations > this.achievements.records.luckiestDay.operations) {
    this.achievements.records.luckiestDay = {
      date: now,
      operations: todayStats.operations
    };
  }
  
  // Update favorite module
  const operationsByModule = Object.entries(this.moduleStats).map(([name, stats]) => ({
    name,
    operations: (stats as IModuleStats).totalOperations
  }));
  
  operationsByModule.sort((a, b) => b.operations - a.operations);
  this.globalStats.favoriteModule = operationsByModule[0]?.operations > 0 ? 
    operationsByModule[0].name as any : 'none';
};

forgeStatsSchema.methods.calculateEfficiencyScore = function(): number {
  if (this.globalStats.totalGoldSpent === 0) return 0;
  
  const powerPerGold = this.globalStats.totalPowerGained / this.globalStats.totalGoldSpent;
  const successRate = this.globalStats.globalSuccessRate;
  
  // Score basé sur power/gold ratio et success rate
  const efficiency = Math.min(100, (powerPerGold * 10) + (successRate * 0.5));
  
  return Math.round(efficiency * 100) / 100;
};

forgeStatsSchema.methods.updateCache = function() {
  this.cachedData.lastCalculated = new Date();
  this.cachedData.totalItemsForged = this.moduleStats.fusion.moduleSpecific.totalItemsFused || 0;
  this.cachedData.efficiencyScore = this.calculateEfficiencyScore();
  
  // Calculate average daily operations
  const daysActive = Math.max(1, Math.ceil(
    (Date.now() - this.globalStats.firstForgeDate.getTime()) / (1000 * 60 * 60 * 24)
  ));
  this.cachedData.averageDailyOperations = Math.round(this.globalStats.totalOperations / daysActive * 100) / 100;
};

forgeStatsSchema.methods.checkAchievements = function(): string[] {
  const newAchievements: string[] = [];
  
  // Check milestones
  const milestoneChecks = [
    { type: 'totalOperations', current: this.globalStats.totalOperations, milestones: [100, 500, 1000, 5000, 10000] },
    { type: 'goldSpent', current: this.globalStats.totalGoldSpent, milestones: [10000, 50000, 100000, 500000] },
    { type: 'powerGained', current: this.globalStats.totalPowerGained, milestones: [1000, 5000, 10000, 50000] },
    { type: 'streak', current: this.streaks.bestSuccessStreak, milestones: [5, 10, 20, 50] }
  ];
  
  milestoneChecks.forEach(check => {
    check.milestones.forEach(milestone => {
      const achievementId = `${check.type}_${milestone}`;
      if (check.current >= milestone && !this.achievements.unlockedAchievements.includes(achievementId)) {
        this.achievements.unlockedAchievements.push(achievementId);
        this.achievements.milestones[check.type as keyof typeof this.achievements.milestones].push(milestone);
        newAchievements.push(achievementId);
      }
    });
  });
  
  return newAchievements;
};

// === VALIDATION ===

forgeStatsSchema.pre('save', function(next) {
  // Ensure success rates are between 0-100
  if (this.globalStats.globalSuccessRate < 0 || this.globalStats.globalSuccessRate > 100) {
    return next(new Error('INVALID_GLOBAL_SUCCESS_RATE'));
  }
  
  // Validate module success rates
  const modules = ['reforge', 'enhancement', 'fusion', 'tierUpgrade'] as const;
  for (const module of modules) {
    const rate = this.moduleStats[module].successRate;
    if (rate < 0 || rate > 100) {
      return next(new Error(`INVALID_${module.toUpperCase()}_SUCCESS_RATE`));
    }
  }
  
  // Update cache before saving (call the method directly)
  const daysActive = Math.max(1, Math.ceil(
    (Date.now() - this.globalStats.firstForgeDate.getTime()) / (1000 * 60 * 60 * 24)
  ));
  
  this.cachedData.lastCalculated = new Date();
  this.cachedData.totalItemsForged = this.moduleStats.fusion.moduleSpecific.totalItemsFused || 0;
  this.cachedData.averageDailyOperations = Math.round(this.globalStats.totalOperations / daysActive * 100) / 100;
  
  // Calculate efficiency score inline
  if (this.globalStats.totalGoldSpent > 0) {
    const powerPerGold = this.globalStats.totalPowerGained / this.globalStats.totalGoldSpent;
    const successRate = this.globalStats.globalSuccessRate;
    const efficiency = Math.min(100, (powerPerGold * 10) + (successRate * 0.5));
    this.cachedData.efficiencyScore = Math.round(efficiency * 100) / 100;
  } else {
    this.cachedData.efficiencyScore = 0;
  }
  
  next();
});

// === EXPORT MODEL ===

export const ForgeStats = model<IForgeStatsDocument>('ForgeStats', forgeStatsSchema);
export default ForgeStats;

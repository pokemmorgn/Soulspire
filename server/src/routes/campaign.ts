import mongoose, { Document, Schema, Types } from "mongoose";

// === INTERFACES ÉTENDUES AVEC TRACKING ÉCHECS ===

export interface ILevelStar {
  levelIndex: number;
  stars: number;
  bestTimeMs?: number;
  clearedAt: Date;
  difficulty?: "Normal" | "Hard" | "Nightmare";
}

export interface IFailureRecord {
  levelIndex: number;
  difficulty: "Normal" | "Hard" | "Nightmare";
  failedAt: Date;
  reason?: 'timeout' | 'team_wiped' | 'insufficient_damage' | 'player_quit';
  battleDuration?: number;
  playerPowerAtFailure?: number;
}

export interface IDifficultyProgress {
  difficulty: "Normal" | "Hard" | "Nightmare";
  highestLevelCleared: number;
  starsByLevel: ILevelStar[];
  isCompleted: boolean;
  completedAt?: Date;
  
  // 🔥 NOUVEAU : Tracking des échecs par difficulté
  failureHistory: IFailureRecord[];
  consecutiveFailures: number;
  lastFailureAt?: Date;
  totalFailures: number;
}

export interface ICampaignProgress extends Document {
  playerId: string;
  serverId: string;
  worldId: number;
  
  // Progression principale (Normal)
  highestLevelCleared: number;
  starsByLevel: ILevelStar[];
  
  // Progression par difficulté (nouveau système)
  progressByDifficulty: IDifficultyProgress[];
  
  // Stats globales
  totalStarsEarned: number;
  totalTimeSpent: number;
  
  // 🔥 NOUVEAU : Tracking global des échecs pour ce monde
  globalFailureStats: {
    totalFailures: number;
    failuresByLevel: Map<number, number>;
    worstLevel: {
      levelIndex: number;
      difficulty: string;
      failures: number;
    } | null;
    lastStuckCheck?: Date;
    isCurrentlyStuck: boolean;
    stuckSince?: Date;
  };
  
  // Méthodes
  updateDifficultyProgress(
    difficulty: "Normal" | "Hard" | "Nightmare",
    levelIndex: number,
    starsEarned: number,
    battleDuration: number,
    totalLevelsInWorld: number
  ): void;
  
  getHighestLevelForDifficulty(difficulty: "Normal" | "Hard" | "Nightmare"): number;
  
  // 🔥 NOUVELLES MÉTHODES pour tracking échecs
  recordFailure(
    levelIndex: number,
    difficulty: "Normal" | "Hard" | "Nightmare",
    reason?: string,
    battleDuration?: number,
    playerPower?: number
  ): void;
  
  getFailureCount(levelIndex: number, difficulty: "Normal" | "Hard" | "Nightmare"): number;
  getConsecutiveFailures(levelIndex: number, difficulty: "Normal" | "Hard" | "Nightmare"): number;
  isPlayerStuck(threshold?: number): boolean;
  getStuckAnalysis(): {
    isStuck: boolean;
    stuckLevel: { levelIndex: number; difficulty: string } | null;
    failureCount: number;
    suggestions: string[];
    stuckDuration: number;
  };
  
  resetFailureStreak(levelIndex: number, difficulty: "Normal" | "Hard" | "Nightmare"): void;
}

// === SCHÉMAS ===

const levelStarSchema = new Schema<ILevelStar>({
  levelIndex: { type: Number, required: true, min: 1 },
  stars: { type: Number, required: true, min: 0, max: 3 },
  bestTimeMs: { type: Number, min: 0 },
  clearedAt: { type: Date, required: true, default: Date.now },
  difficulty: { type: String, enum: ["Normal", "Hard", "Nightmare"], default: "Normal" }
}, { _id: false });

const failureRecordSchema = new Schema<IFailureRecord>({
  levelIndex: { type: Number, required: true, min: 1 },
  difficulty: { type: String, enum: ["Normal", "Hard", "Nightmare"], required: true },
  failedAt: { type: Date, required: true, default: Date.now },
  reason: { type: String, enum: ['timeout', 'team_wiped', 'insufficient_damage', 'player_quit'] },
  battleDuration: { type: Number, min: 0 },
  playerPowerAtFailure: { type: Number, min: 0 }
}, { _id: false });

const difficultyProgressSchema = new Schema<IDifficultyProgress>({
  difficulty: { type: String, enum: ["Normal", "Hard", "Nightmare"], required: true },
  highestLevelCleared: { type: Number, default: 0, min: 0 },
  starsByLevel: [levelStarSchema],
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
  
  // 🔥 NOUVEAU : Tracking échecs
  failureHistory: { type: [failureRecordSchema], default: [] },
  consecutiveFailures: { type: Number, default: 0, min: 0 },
  lastFailureAt: { type: Date },
  totalFailures: { type: Number, default: 0, min: 0 }
}, { _id: false });

const campaignProgressSchema = new Schema<ICampaignProgress>({
  playerId: { type: String, required: true, index: true },
  serverId: { type: String, required: true, index: true },
  worldId: { type: Number, required: true, min: 1, index: true },
  
  // Progression principale
  highestLevelCleared: { type: Number, default: 0, min: 0 },
  starsByLevel: [levelStarSchema],
  
  // Progression par difficulté
  progressByDifficulty: {
    type: [difficultyProgressSchema],
    default: () => [{
      difficulty: "Normal",
      highestLevelCleared: 0,
      starsByLevel: [],
      isCompleted: false,
      failureHistory: [],
      consecutiveFailures: 0,
      totalFailures: 0
    }]
  },
  
  // Stats globales
  totalStarsEarned: { type: Number, default: 0, min: 0 },
  totalTimeSpent: { type: Number, default: 0, min: 0 },
  
  // 🔥 NOUVEAU : Stats globales des échecs
  globalFailureStats: {
    totalFailures: { type: Number, default: 0, min: 0 },
    failuresByLevel: { type: Map, of: Number, default: new Map() },
    worstLevel: {
      type: {
        levelIndex: { type: Number, required: true },
        difficulty: { type: String, required: true },
        failures: { type: Number, required: true }
      },
      default: null
    },
    lastStuckCheck: { type: Date },
    isCurrentlyStuck: { type: Boolean, default: false },
    stuckSince: { type: Date }
  }
}, {
  timestamps: true,
  collection: "campaign_progress"
});

// === INDEX ===
campaignProgressSchema.index({ playerId: 1, serverId: 1, worldId: 1 }, { unique: true });
campaignProgressSchema.index({ "globalFailureStats.isCurrentlyStuck": 1 });
campaignProgressSchema.index({ "globalFailureStats.lastStuckCheck": 1 });

// === MÉTHODES EXISTANTES (CONSERVÉES) ===

campaignProgressSchema.methods.updateDifficultyProgress = function(
  difficulty: "Normal" | "Hard" | "Nightmare",
  levelIndex: number,
  starsEarned: number,
  battleDuration: number,
  totalLevelsInWorld: number
): void {
  // Trouver ou créer la progression pour cette difficulté
  let diffProgress = this.progressByDifficulty.find((p: IDifficultyProgress) => p.difficulty === difficulty);
  
  if (!diffProgress) {
    diffProgress = {
      difficulty,
      highestLevelCleared: 0,
      starsByLevel: [],
      isCompleted: false,
      failureHistory: [],
      consecutiveFailures: 0,
      totalFailures: 0
    };
    this.progressByDifficulty.push(diffProgress);
  }
  
  // Mettre à jour le niveau le plus haut
  if (levelIndex > diffProgress.highestLevelCleared) {
    diffProgress.highestLevelCleared = levelIndex;
  }
  
  // Mettre à jour les étoiles pour ce niveau
  const existingStar = diffProgress.starsByLevel.find((s: ILevelStar) => s.levelIndex === levelIndex);
  
  if (existingStar) {
    if (starsEarned > existingStar.stars) {
      existingStar.stars = starsEarned;
      existingStar.clearedAt = new Date();
      existingStar.difficulty = difficulty;
    }
  } else {
    diffProgress.starsByLevel.push({
      levelIndex,
      stars: starsEarned,
      clearedAt: new Date(),
      difficulty
    });
  }
  
  // 🔥 NOUVEAU : Reset les échecs consécutifs en cas de victoire
  this.resetFailureStreak(levelIndex, difficulty);
  
  // Vérifier si cette difficulté est complétée
  if (levelIndex === totalLevelsInWorld) {
    diffProgress.isCompleted = true;
    diffProgress.completedAt = new Date();
  }
  
  // Mettre à jour les stats principales pour Normal
  if (difficulty === "Normal") {
    this.highestLevelCleared = Math.max(this.highestLevelCleared, levelIndex);
    
    const existingMainStar = this.starsByLevel.find((s: ILevelStar) => s.levelIndex === levelIndex);
    if (existingMainStar) {
      if (starsEarned > existingMainStar.stars) {
        existingMainStar.stars = starsEarned;
        existingMainStar.clearedAt = new Date();
      }
    } else {
      this.starsByLevel.push({
        levelIndex,
        stars: starsEarned,
        clearedAt: new Date()
      });
    }
  }
  
  // Recalculer le total d'étoiles
  this.totalStarsEarned = this.starsByLevel.reduce((sum: number, star: ILevelStar) => sum + star.stars, 0);
};

campaignProgressSchema.methods.getHighestLevelForDifficulty = function(
  difficulty: "Normal" | "Hard" | "Nightmare"
): number {
  if (difficulty === "Normal") {
    return this.highestLevelCleared;
  }
  
  const diffProgress = this.progressByDifficulty.find((p: IDifficultyProgress) => p.difficulty === difficulty);
  return diffProgress ? diffProgress.highestLevelCleared : 0;
};

// === 🔥 NOUVELLES MÉTHODES POUR TRACKING ÉCHECS ===

campaignProgressSchema.methods.recordFailure = function(
  levelIndex: number,
  difficulty: "Normal" | "Hard" | "Nightmare",
  reason?: string,
  battleDuration?: number,
  playerPower?: number
): void {
  // Trouver ou créer la progression pour cette difficulté
  let diffProgress = this.progressByDifficulty.find((p: IDifficultyProgress) => p.difficulty === difficulty);
  
  if (!diffProgress) {
    diffProgress = {
      difficulty,
      highestLevelCleared: 0,
      starsByLevel: [],
      isCompleted: false,
      failureHistory: [],
      consecutiveFailures: 0,
      totalFailures: 0
    };
    this.progressByDifficulty.push(diffProgress);
  }
  
  const failureRecord: IFailureRecord = {
    levelIndex,
    difficulty,
    failedAt: new Date(),
    reason: reason as any,
    battleDuration,
    playerPowerAtFailure: playerPower
  };
  
  // Ajouter à l'historique des échecs (garder seulement les 20 derniers)
  diffProgress.failureHistory.push(failureRecord);
  if (diffProgress.failureHistory.length > 20) {
    diffProgress.failureHistory.shift();
  }
  
  // Incrémenter les compteurs
  diffProgress.totalFailures++;
  diffProgress.consecutiveFailures++;
  diffProgress.lastFailureAt = new Date();
  
  // Mettre à jour les stats globales
  this.globalFailureStats.totalFailures++;
  
  // Mettre à jour les échecs par niveau
  const currentLevelFailures = this.globalFailureStats.failuresByLevel.get(levelIndex) || 0;
  this.globalFailureStats.failuresByLevel.set(levelIndex, currentLevelFailures + 1);
  
  // Mettre à jour le pire niveau
  const newFailureCount = currentLevelFailures + 1;
  if (!this.globalFailureStats.worstLevel || newFailureCount > this.globalFailureStats.worstLevel.failures) {
    this.globalFailureStats.worstLevel = {
      levelIndex,
      difficulty,
      failures: newFailureCount
    };
  }
  
  // Détecter si le joueur est bloqué (3+ échecs consécutifs)
  if (diffProgress.consecutiveFailures >= 3 && !this.globalFailureStats.isCurrentlyStuck) {
    this.globalFailureStats.isCurrentlyStuck = true;
    this.globalFailureStats.stuckSince = new Date();
  }
};

campaignProgressSchema.methods.getFailureCount = function(
  levelIndex: number,
  difficulty: "Normal" | "Hard" | "Nightmare"
): number {
  const diffProgress = this.progressByDifficulty.find((p: IDifficultyProgress) => p.difficulty === difficulty);
  if (!diffProgress) return 0;
  
  return diffProgress.failureHistory.filter((f: IFailureRecord) => f.levelIndex === levelIndex).length;
};

campaignProgressSchema.methods.getConsecutiveFailures = function(
  levelIndex: number,
  difficulty: "Normal" | "Hard" | "Nightmare"
): number {
  const diffProgress = this.progressByDifficulty.find((p: IDifficultyProgress) => p.difficulty === difficulty);
  if (!diffProgress) return 0;
  
  // Vérifier si les derniers échecs sont sur ce niveau
  const recentFailures = diffProgress.failureHistory
    .slice(-5) // Derniers 5 échecs
    .filter((f: IFailureRecord) => f.levelIndex === levelIndex && f.difficulty === difficulty);
  
  // Compter les échecs consécutifs depuis la fin
  let consecutive = 0;
  for (let i = diffProgress.failureHistory.length - 1; i >= 0; i--) {
    const failure = diffProgress.failureHistory[i];
    if (failure.levelIndex === levelIndex && failure.difficulty === difficulty) {
      consecutive++;
    } else {
      break;
    }
  }
  
  return consecutive;
};

campaignProgressSchema.methods.isPlayerStuck = function(threshold: number = 3): boolean {
  return this.globalFailureStats.isCurrentlyStuck && 
         this.globalFailureStats.worstLevel && 
         this.globalFailureStats.worstLevel.failures >= threshold;
};

campaignProgressSchema.methods.getStuckAnalysis = function(): {
  isStuck: boolean;
  stuckLevel: { levelIndex: number; difficulty: string } | null;
  failureCount: number;
  suggestions: string[];
  stuckDuration: number;
} {
  const isStuck = this.isPlayerStuck();
  const worstLevel = this.globalFailureStats.worstLevel;
  const stuckDuration = this.globalFailureStats.stuckSince ? 
    Date.now() - this.globalFailureStats.stuckSince.getTime() : 0;
  
  const suggestions: string[] = [];
  
  if (isStuck && worstLevel) {
    // Analyser les raisons des échecs récents
    const diffProgress = this.progressByDifficulty.find((p: IDifficultyProgress) => p.difficulty === worstLevel.difficulty);
    const recentFailures = diffProgress?.failureHistory.slice(-5) || [];
    
    const reasonCounts = recentFailures.reduce((acc: Record<string, number>, failure: IFailureRecord) => {
      if (failure.reason) {
        acc[failure.reason] = (acc[failure.reason] || 0) + 1;
      }
      return acc;
    }, {});
    
    // Suggestions basées sur les raisons d'échec
    if (reasonCounts['team_wiped'] >= 2) {
      suggestions.push('Your team is being defeated too easily. Consider upgrading hero levels or equipment.');
    }
    if (reasonCounts['insufficient_damage'] >= 2) {
      suggestions.push('You are not dealing enough damage. Upgrade weapons or change team formation.');
    }
    if (reasonCounts['timeout'] >= 2) {
      suggestions.push('Battles are taking too long. Focus on DPS heroes or better strategy.');
    }
    
    // Suggestions générales
    if (worstLevel.failures >= 5) {
      suggestions.push('Consider trying an easier difficulty first to gain resources.');
      suggestions.push('Check if you can unlock new heroes or upgrade existing ones.');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('Try adjusting your team formation or strategy.');
      suggestions.push('Consider farming previous levels for experience and equipment.');
    }
  }
  
  return {
    isStuck,
    stuckLevel: worstLevel ? { levelIndex: worstLevel.levelIndex, difficulty: worstLevel.difficulty } : null,
    failureCount: worstLevel?.failures || 0,
    suggestions,
    stuckDuration
  };
};

campaignProgressSchema.methods.resetFailureStreak = function(
  levelIndex: number,
  difficulty: "Normal" | "Hard" | "Nightmare"
): void {
  const diffProgress = this.progressByDifficulty.find((p: IDifficultyProgress) => p.difficulty === difficulty);
  if (diffProgress) {
    // Vérifier si les derniers échecs étaient sur ce niveau
    const lastFailures = diffProgress.failureHistory.slice(-3);
    const allOnSameLevel = lastFailures.every((f: IFailureRecord) => 
      f.levelIndex === levelIndex && f.difficulty === difficulty
    );
    
    if (allOnSameLevel) {
      diffProgress.consecutiveFailures = 0;
      this.globalFailureStats.isCurrentlyStuck = false;
      this.globalFailureStats.stuckSince = undefined;
    }
  }
};

// === MÉTHODES STATIQUES ===

campaignProgressSchema.statics.hasPlayerCompletedAllWorlds = async function(
  playerId: string,
  serverId: string,
  difficulty: "Normal" | "Hard" | "Nightmare",
  totalWorlds: number
): Promise<boolean> {
  const completedWorlds = await this.countDocuments({
    playerId,
    serverId,
    [`progressByDifficulty.difficulty`]: difficulty,
    [`progressByDifficulty.isCompleted`]: true
  });
  
  return completedWorlds >= totalWorlds;
};

// === MÉTHODES STATIQUES NOUVELLES POUR ANALYTICS ===

campaignProgressSchema.statics.getStuckPlayers = async function(
  serverId?: string,
  threshold: number = 3
) {
  const matchStage: any = {
    "globalFailureStats.isCurrentlyStuck": true,
    "globalFailureStats.worstLevel.failures": { $gte: threshold }
  };
  
  if (serverId) {
    matchStage.serverId = serverId;
  }
  
  return await this.find(matchStage)
    .select("playerId serverId worldId globalFailureStats")
    .sort({ "globalFailureStats.stuckSince": 1 });
};

campaignProgressSchema.statics.getFailureStatistics = async function(serverId?: string) {
  const matchStage = serverId ? { serverId } : {};
  
  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$worldId",
        totalFailures: { $sum: "$globalFailureStats.totalFailures" },
        stuckPlayers: { $sum: { $cond: ["$globalFailureStats.isCurrentlyStuck", 1, 0] } },
        playersInWorld: { $sum: 1 },
        averageFailuresPerPlayer: { $avg: "$globalFailureStats.totalFailures" }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

const CampaignProgress = mongoose.model<ICampaignProgress>("CampaignProgress", campaignProgressSchema);

export default CampaignProgress;

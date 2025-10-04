// server/src/models/PlayerAchievement.ts
import mongoose, { Document, Schema } from "mongoose";

/**
 * Progression d'un critère individuel pour un joueur
 */
export interface IPlayerAchievementProgress {
  criteriaIndex: number;
  currentValue: number;
  targetValue: number;
  completed: boolean;
}

/**
 * Interface pour les méthodes d'instance
 */
interface IPlayerAchievementMethods {
  checkCompletion(): boolean;
  calculateProgressPercentage(): number;
  updateCriteriaProgress(criteriaIndex: number, newValue: number): boolean;
}

/**
 * Interface pour les méthodes statiques
 */
interface IPlayerAchievementModel extends mongoose.Model<IPlayerAchievement, {}, IPlayerAchievementMethods> {
  getPlayerAchievements(
    playerId: string,
    serverId: string,
    filters?: {
      completed?: boolean;
      claimed?: boolean;
      category?: string;
    }
  ): Promise<IPlayerAchievement[]>;
  
  getUnclaimedRewards(playerId: string, serverId: string): Promise<IPlayerAchievement[]>;
  
  getLeaderboard(achievementId: string, serverId: string, limit?: number): Promise<IPlayerAchievement[]>;
  
  getOrCreate(
    playerId: string,
    serverId: string,
    achievementId: string,
    initialProgress: IPlayerAchievementProgress[]
  ): Promise<IPlayerAchievement>;
  
  updateRanks(achievementId: string, serverId: string): Promise<number>;
}

/**
 * Document PlayerAchievement
 */
export interface IPlayerAchievement extends Document, IPlayerAchievementMethods {
  playerId: string;
  serverId: string;
  achievementId: string;
  
  progress: IPlayerAchievementProgress[];
  
  isCompleted: boolean;
  completedAt?: Date;
  
  currentRank?: number;
  currentScore?: number;
  lastRankUpdate?: Date;
  
  rewardsClaimed: boolean;
  claimedAt?: Date;
  
  notified: boolean;
  notifiedAt?: Date;
  
  progressPercentage?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const playerAchievementProgressSchema = new Schema({
  criteriaIndex: {
    type: Number,
    required: true,
    min: 0
  },
  currentValue: {
    type: Number,
    default: 0,
    min: 0
  },
  targetValue: {
    type: Number,
    required: true,
    min: 0
  },
  completed: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const playerAchievementSchema = new Schema<IPlayerAchievement, IPlayerAchievementModel, IPlayerAchievementMethods>({
  playerId: {
    type: String,
    required: true,
    index: true
  },
  
  serverId: {
    type: String,
    required: true,
    index: true
  },
  
  achievementId: {
    type: String,
    required: true,
    index: true
  },
  
  progress: {
    type: [playerAchievementProgressSchema],
    default: []
  },
  
  isCompleted: {
    type: Boolean,
    default: false,
    index: true
  },
  
  completedAt: {
    type: Date
  },
  
  currentRank: {
    type: Number,
    min: 1
  },
  
  currentScore: {
    type: Number,
    default: 0
  },
  
  lastRankUpdate: {
    type: Date
  },
  
  rewardsClaimed: {
    type: Boolean,
    default: false,
    index: true
  },
  
  claimedAt: {
    type: Date
  },
  
  notified: {
    type: Boolean,
    default: false
  },
  
  notifiedAt: {
    type: Date
  },
  
  progressPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
  
}, {
  timestamps: true,
  collection: "player_achievements"
});

// Index composés
playerAchievementSchema.index({ playerId: 1, serverId: 1, achievementId: 1 }, { unique: true });
playerAchievementSchema.index({ playerId: 1, isCompleted: 1 });
playerAchievementSchema.index({ playerId: 1, rewardsClaimed: 1 });
playerAchievementSchema.index({ achievementId: 1, isCompleted: 1 });
playerAchievementSchema.index({ achievementId: 1, currentScore: -1 });
playerAchievementSchema.index({ serverId: 1, achievementId: 1, currentScore: -1 });

// Méthodes d'instance

playerAchievementSchema.method('checkCompletion', function checkCompletion(): boolean {
  if (this.progress.length === 0) return false;
  
  return this.progress.every((p: IPlayerAchievementProgress) => p.completed);
});

playerAchievementSchema.method('calculateProgressPercentage', function calculateProgressPercentage(): number {
  if (this.progress.length === 0) return 0;
  
  const totalProgress = this.progress.reduce((sum: number, p: IPlayerAchievementProgress) => {
    const criteriaProgress = Math.min(100, (p.currentValue / p.targetValue) * 100);
    return sum + criteriaProgress;
  }, 0);
  
  return Math.floor(totalProgress / this.progress.length);
});

playerAchievementSchema.method('updateCriteriaProgress', function updateCriteriaProgress(
  criteriaIndex: number, 
  newValue: number
): boolean {
  const criteria = this.progress.find((p: IPlayerAchievementProgress) => p.criteriaIndex === criteriaIndex);
  
  if (!criteria) return false;
  
  criteria.currentValue = newValue;
  criteria.completed = newValue >= criteria.targetValue;
  
  this.progressPercentage = this.calculateProgressPercentage();
  
  if (this.checkCompletion() && !this.isCompleted) {
    this.isCompleted = true;
    this.completedAt = new Date();
    return true;
  }
  
  return false;
});

// Middleware pre-save
playerAchievementSchema.pre('save', function(next) {
  if (this.isModified('progress')) {
    this.progressPercentage = this.calculateProgressPercentage();
  }
  
  if (this.isModified('progress') || this.isModified('isCompleted')) {
    const allCompleted = this.checkCompletion();
    
    if (allCompleted && !this.isCompleted) {
      this.isCompleted = true;
      this.completedAt = new Date();
    }
  }
  
  next();
});

// Méthodes statiques

playerAchievementSchema.static('getPlayerAchievements', function getPlayerAchievements(
  playerId: string,
  serverId: string,
  filters?: {
    completed?: boolean;
    claimed?: boolean;
    category?: string;
  }
) {
  const query: any = { playerId, serverId };
  
  if (filters?.completed !== undefined) {
    query.isCompleted = filters.completed;
  }
  
  if (filters?.claimed !== undefined) {
    query.rewardsClaimed = filters.claimed;
  }
  
  return this.find(query)
    .populate('achievementId')
    .sort({ completedAt: -1, progressPercentage: -1 });
});

playerAchievementSchema.static('getUnclaimedRewards', function getUnclaimedRewards(
  playerId: string,
  serverId: string
) {
  return this.find({
    playerId,
    serverId,
    isCompleted: true,
    rewardsClaimed: false
  }).populate('achievementId');
});

playerAchievementSchema.static('getLeaderboard', function getLeaderboard(
  achievementId: string,
  serverId: string,
  limit: number = 100
) {
  return this.find({
    achievementId,
    serverId,
    currentScore: { $gt: 0 }
  })
    .sort({ currentScore: -1, completedAt: 1 })
    .limit(limit)
    .populate('playerId', 'displayName level vipLevel');
});

playerAchievementSchema.static('getOrCreate', async function getOrCreate(
  playerId: string,
  serverId: string,
  achievementId: string,
  initialProgress: IPlayerAchievementProgress[]
) {
  let playerAchievement = await this.findOne({
    playerId,
    serverId,
    achievementId
  });
  
  if (!playerAchievement) {
    playerAchievement = new this({
      playerId,
      serverId,
      achievementId,
      progress: initialProgress,
      isCompleted: false,
      rewardsClaimed: false,
      notified: false,
      progressPercentage: 0
    });
    
    await playerAchievement.save();
  }
  
  return playerAchievement;
});

playerAchievementSchema.static('updateRanks', async function updateRanks(
  achievementId: string,
  serverId: string
) {
  const leaderboard = await this.find({
    achievementId,
    serverId,
    currentScore: { $gt: 0 }
  }).sort({ currentScore: -1, completedAt: 1 });
  
  const updates = leaderboard.map((entry: any, index: number) => ({
    updateOne: {
      filter: { _id: entry._id },
      update: { 
        currentRank: index + 1,
        lastRankUpdate: new Date()
      }
    }
  }));
  
  if (updates.length > 0) {
    await this.bulkWrite(updates);
  }
  
  return updates.length;
});

export default mongoose.model<IPlayerAchievement, IPlayerAchievementModel>("PlayerAchievement", playerAchievementSchema);

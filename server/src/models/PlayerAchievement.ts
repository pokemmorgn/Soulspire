// server/src/models/PlayerAchievement.ts
import mongoose, { Document, Schema } from "mongoose";

/**
 * Progression d'un critère individuel pour un joueur
 */
export interface IPlayerAchievementProgress {
  criteriaIndex: number;           // Index du critère dans Achievement.criteria[]
  currentValue: number;            // Valeur actuelle du joueur
  targetValue: number;             // Valeur cible à atteindre
  completed: boolean;              // Ce critère est-il complété ?
}

/**
 * Document PlayerAchievement
 * Représente la progression d'un joueur sur un achievement spécifique
 */
export interface IPlayerAchievement extends Document {
  playerId: string;
  serverId: string;
  achievementId: string;
  
  // Progression par critère
  progress: IPlayerAchievementProgress[];
  
  // État global
  isCompleted: boolean;
  completedAt?: Date;
  
  // Pour les leaderboards
  currentRank?: number;            // Position actuelle dans le classement
  currentScore?: number;           // Score actuel (pour tri)
  lastRankUpdate?: Date;           // Dernière mise à jour du rang
  
  // Gestion des récompenses
  rewardsClaimed: boolean;
  claimedAt?: Date;
  
  // Notifications
  notified: boolean;               // Notification de déblocage envoyée
  notifiedAt?: Date;
  
  // Statistiques
  progressPercentage?: number;     // Pourcentage global de complétion
  
  // Métadonnées
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

const playerAchievementSchema = new Schema<IPlayerAchievement>({
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

// Index composés pour requêtes optimisées
playerAchievementSchema.index({ playerId: 1, serverId: 1, achievementId: 1 }, { unique: true });
playerAchievementSchema.index({ playerId: 1, isCompleted: 1 });
playerAchievementSchema.index({ playerId: 1, rewardsClaimed: 1 });
playerAchievementSchema.index({ achievementId: 1, isCompleted: 1 });
playerAchievementSchema.index({ achievementId: 1, currentScore: -1 }); // Pour leaderboards (tri DESC)
playerAchievementSchema.index({ serverId: 1, achievementId: 1, currentScore: -1 }); // Leaderboard serveur

// Méthodes d'instance

/**
 * Vérifier si tous les critères sont complétés
 */
playerAchievementSchema.methods.checkCompletion = function(): boolean {
  if (this.progress.length === 0) return false;
  
  return this.progress.every((p: IPlayerAchievementProgress) => p.completed);
};

/**
 * Calculer le pourcentage de progression global
 */
playerAchievementSchema.methods.calculateProgressPercentage = function(): number {
  if (this.progress.length === 0) return 0;
  
  const totalProgress = this.progress.reduce((sum: number, p: IPlayerAchievementProgress) => {
    const criteriaProgress = Math.min(100, (p.currentValue / p.targetValue) * 100);
    return sum + criteriaProgress;
  }, 0);
  
  return Math.floor(totalProgress / this.progress.length);
};

/**
 * Mettre à jour la progression d'un critère
 */
playerAchievementSchema.methods.updateCriteriaProgress = function(
  criteriaIndex: number, 
  newValue: number
): boolean {
  const criteria = this.progress.find((p: IPlayerAchievementProgress) => p.criteriaIndex === criteriaIndex);
  
  if (!criteria) return false;
  
  criteria.currentValue = newValue;
  criteria.completed = newValue >= criteria.targetValue;
  
  // Recalculer le pourcentage global
  this.progressPercentage = this.calculateProgressPercentage();
  
  // Vérifier si l'achievement est maintenant complété
  if (this.checkCompletion() && !this.isCompleted) {
    this.isCompleted = true;
    this.completedAt = new Date();
    return true; // Nouveau déblocage
  }
  
  return false; // Pas encore débloqué
};

// Middleware pre-save
playerAchievementSchema.pre('save', function(next) {
  // Auto-calculer le pourcentage de progression
  if (this.isModified('progress')) {
    this.progressPercentage = this.calculateProgressPercentage();
  }
  
  // Valider que isCompleted correspond bien aux critères
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

/**
 * Obtenir tous les achievements d'un joueur
 */
playerAchievementSchema.statics.getPlayerAchievements = function(
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
};

/**
 * Obtenir les achievements non réclamés
 */
playerAchievementSchema.statics.getUnclaimedRewards = function(
  playerId: string,
  serverId: string
) {
  return this.find({
    playerId,
    serverId,
    isCompleted: true,
    rewardsClaimed: false
  }).populate('achievementId');
};

/**
 * Obtenir le leaderboard pour un achievement
 */
playerAchievementSchema.statics.getLeaderboard = function(
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
};

/**
 * Obtenir ou créer un PlayerAchievement
 */
playerAchievementSchema.statics.getOrCreate = async function(
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
};

/**
 * Mettre à jour le rang d'un joueur dans un leaderboard
 */
playerAchievementSchema.statics.updateRanks = async function(
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
};

export default mongoose.model<IPlayerAchievement>("PlayerAchievement", playerAchievementSchema);

// server/src/models/DailyRewards.ts
import mongoose, { Document, Schema } from "mongoose";
import { IdGenerator } from "../utils/idGenerator";
// 🔥 IMPORT CONFIG CENTRALISÉE
import * as DailyRewardsConfig from "../config/DailyRewardsConfig";

// === INTERFACES ===

export interface IDailyRewardItem {
  type: "gold" | "gems" | "tickets" | "hero_fragment" | "material" | "item";
  itemId?: string;
  quantity: number;
  rarity?: "Common" | "Rare" | "Epic" | "Legendary";
}

export interface IDailyRewardClaim {
  day: number; // 1-30
  claimDate: Date;
  rewards: IDailyRewardItem[];
  vipBonus: number; // Multiplicateur VIP appliqué
  streakBonus: number; // Bonus de streak appliqué
  totalValue: number; // Valeur estimée
}

export interface IDailyRewardsDocument extends Document {
  playerId: string;
  serverId: string;
  
  // Progression actuelle
  currentStreak: number; // Nombre de jours consécutifs
  longestStreak: number; // Record du joueur
  currentDay: number; // Jour actuel dans le cycle (1-30)
  
  // Dates importantes
  lastClaimDate: Date; // Dernière réclamation
  streakStartDate: Date; // Début du streak actuel
  nextResetDate: Date; // Prochaine réinitialisation (minuit)
  
  // Historique
  claimHistory: IDailyRewardClaim[];
  totalClaims: number;
  totalRewardsValue: number;
  
  // Statistiques
  consecutiveMissedDays: number; // Jours ratés de suite (reset streak si >= 2)
  totalMissedDays: number;
  monthlyClaimsCount: number; // Claims ce mois-ci
  lastMonthReset: Date; // Dernier reset mensuel
  
  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
  
  // === MÉTHODES D'INSTANCE ===
  canClaimToday(): boolean;
  claimDailyReward(vipLevel: number): Promise<IDailyRewardClaim>;
  calculateRewards(day: number, vipLevel: number): IDailyRewardItem[];
  getNextReward(): { day: number; rewards: IDailyRewardItem[] };
  checkAndResetStreak(): Promise<boolean>;
  getStreakBonus(): number;
  getClaimStatus(): {
    canClaim: boolean;
    timeUntilNext: number;
    currentStreak: number;
    nextDay: number;
    missedToday: boolean;
  };
}

// === SCHÉMAS ===

const dailyRewardItemSchema = new Schema<IDailyRewardItem>({
  type: {
    type: String,
    required: true,
    enum: ["gold", "gems", "tickets", "hero_fragment", "material", "item"]
  },
  itemId: {
    type: String,
    required: function() {
      return ["hero_fragment", "material", "item"].includes(this.type);
    }
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  rarity: {
    type: String,
    enum: ["Common", "Rare", "Epic", "Legendary"]
  }
}, { _id: false });

const dailyRewardClaimSchema = new Schema<IDailyRewardClaim>({
  day: {
    type: Number,
    required: true,
    min: 1,
    max: 30
  },
  claimDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  rewards: [dailyRewardItemSchema],
  vipBonus: {
    type: Number,
    default: 1.0,
    min: 1.0
  },
  streakBonus: {
    type: Number,
    default: 1.0,
    min: 1.0
  },
  totalValue: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const dailyRewardsSchema = new Schema<IDailyRewardsDocument>({
  playerId: {
    type: String,
    required: true,
    index: true
  },
  serverId: {
    type: String,
    required: true,
    match: /^S\d+$/,
    index: true
  },
  
  // Progression
  currentStreak: {
    type: Number,
    default: 0,
    min: 0
  },
  longestStreak: {
    type: Number,
    default: 0,
    min: 0
  },
  currentDay: {
    type: Number,
    default: 1,
    min: 1,
    max: 30
  },
  
  // Dates
  lastClaimDate: {
    type: Date,
    default: null
  },
  streakStartDate: {
    type: Date,
    default: Date.now
  },
  nextResetDate: {
    type: Date,
    required: true,
    default: function() {
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      return tomorrow;
    }
  },
  
  // Historique
  claimHistory: {
    type: [dailyRewardClaimSchema],
    default: []
  },
  totalClaims: {
    type: Number,
    default: 0,
    min: 0
  },
  totalRewardsValue: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Statistiques
  consecutiveMissedDays: {
    type: Number,
    default: 0,
    min: 0
  },
  totalMissedDays: {
    type: Number,
    default: 0,
    min: 0
  },
  monthlyClaimsCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastMonthReset: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'daily_rewards'
});

// === INDEX ===
dailyRewardsSchema.index({ playerId: 1, serverId: 1 }, { unique: true });
dailyRewardsSchema.index({ lastClaimDate: 1 });
dailyRewardsSchema.index({ currentStreak: -1 });
dailyRewardsSchema.index({ nextResetDate: 1 });

// === MIDDLEWARE ===
dailyRewardsSchema.pre('save', function(next) {
  // Mettre à jour le record de streak
  if (this.currentStreak > this.longestStreak) {
    this.longestStreak = this.currentStreak;
  }
  
  // Garder seulement les 90 derniers claims dans l'historique
  if (this.claimHistory.length > 90) {
    this.claimHistory = this.claimHistory.slice(-90);
  }
  
  next();
});

// === MÉTHODES D'INSTANCE ===

// Vérifier si peut claim aujourd'hui
dailyRewardsSchema.methods.canClaimToday = function(): boolean {
  const now = new Date();
  
  // Pas encore de claim
  if (!this.lastClaimDate) {
    return true;
  }
  
  const lastClaim = new Date(this.lastClaimDate);
  
  // Vérifier si on est un jour différent
  const isSameDay = 
    lastClaim.getDate() === now.getDate() &&
    lastClaim.getMonth() === now.getMonth() &&
    lastClaim.getFullYear() === now.getFullYear();
  
  return !isSameDay;
};

// Calculer les récompenses pour un jour donné
dailyRewardsSchema.methods.calculateRewards = function(
  day: number, 
  vipLevel: number
): IDailyRewardItem[] {
  // 🔥 UTILISER LA CONFIG EXTERNE
  const DailyRewardsConfig = require('../config/DailyRewardsConfig');
  const dayConfig = DailyRewardsConfig.getDayConfig(day);
  
  if (!dayConfig) {
    console.warn(`⚠️ No config found for day ${day}, using day 1 as fallback`);
    const fallback = DailyRewardsConfig.getDayConfig(1);
    return fallback ? [...fallback.rewards] : [];
  }
  
  // Copier les récompenses de base
  const baseRewards = dayConfig.rewards.map(r => ({ ...r }));
  
  // Appliquer le bonus VIP (multiplicateur sur toutes les quantités)
  const vipMultiplier = 1.0 + (vipLevel * DailyRewardsConfig.config.vipBonusPerLevel);
  
  baseRewards.forEach(reward => {
    reward.quantity = Math.floor(reward.quantity * vipMultiplier);
  });
  
  return baseRewards;
};

// Réclamer les récompenses quotidiennes
dailyRewardsSchema.methods.claimDailyReward = async function(
  vipLevel: number
): Promise<IDailyRewardClaim> {
  if (!this.canClaimToday()) {
    throw new Error("Daily reward already claimed today");
  }
  
  // Vérifier si le streak doit être reset
  await this.checkAndResetStreak();
  
  // Incrémenter le streak
  this.currentStreak += 1;
  
  // Calculer les récompenses
  const baseRewards = this.calculateRewards(this.currentDay, vipLevel);
  
  // Appliquer le bonus de streak
  const streakBonus = this.getStreakBonus();
  const finalRewards = baseRewards.map(reward => ({
    ...reward,
    quantity: Math.floor(reward.quantity * streakBonus)
  }));
  
  // Calculer la valeur totale
  let totalValue = 0;
  finalRewards.forEach(reward => {
    switch (reward.type) {
      case "gold":
        totalValue += reward.quantity * 0.001;
        break;
      case "gems":
        totalValue += reward.quantity * 1;
        break;
      case "tickets":
        totalValue += reward.quantity * 5;
        break;
      case "hero_fragment":
        totalValue += reward.quantity * 2;
        break;
      case "material":
        totalValue += reward.quantity * 10;
        break;
    }
  });
  
  // Créer l'entrée de claim
  const claim: IDailyRewardClaim = {
    day: this.currentDay,
    claimDate: new Date(),
    rewards: finalRewards,
    vipBonus: 1.0 + (vipLevel * 0.1),
    streakBonus: streakBonus,
    totalValue: Math.round(totalValue)
  };
  
  // Mettre à jour l'état
  this.lastClaimDate = new Date();
  this.claimHistory.push(claim);
  this.totalClaims += 1;
  this.totalRewardsValue += claim.totalValue;
  this.consecutiveMissedDays = 0;
  this.monthlyClaimsCount += 1;
  
  // Incrémenter le jour (cycle de 1-30)
  this.currentDay = this.currentDay >= 30 ? 1 : this.currentDay + 1;
  
  // Mettre à jour la prochaine reset date
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  this.nextResetDate = tomorrow;
  
  await this.save();
  
  return claim;
};

// Obtenir le bonus de streak
dailyRewardsSchema.methods.getStreakBonus = function(): number {
  // 🔥 UTILISER LA CONFIG EXTERNE
  const DailyRewardsConfig = require('../config/DailyRewardsConfig');
  return DailyRewardsConfig.getStreakMultiplier(this.currentStreak);
};

// Vérifier et reset le streak si nécessaire
dailyRewardsSchema.methods.checkAndResetStreak = async function(): Promise<boolean> {
  if (!this.lastClaimDate) {
    return false; // Première connexion
  }
  
  const now = new Date();
  const lastClaim = new Date(this.lastClaimDate);
  
  // Calculer les jours écoulés
  const diffTime = now.getTime() - lastClaim.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Si plus d'un jour s'est écoulé
  if (diffDays > 1) {
    const missedDays = diffDays - 1;
    this.consecutiveMissedDays += missedDays;
    this.totalMissedDays += missedDays;
    
    // Reset le streak si 2 jours ou plus ratés
    if (missedDays >= 2) {
      console.log(`⚠️ Streak reset pour ${this.playerId}: ${missedDays} jours ratés`);
      this.currentStreak = 0;
      this.currentDay = 1;
      this.streakStartDate = now;
      return true;
    }
  }
  
  return false;
};

// Obtenir la prochaine récompense
dailyRewardsSchema.methods.getNextReward = function(): { 
  day: number; 
  rewards: IDailyRewardItem[] 
} {
  const nextDay = this.canClaimToday() ? this.currentDay : this.currentDay + 1;
  const normalizedDay = nextDay > 30 ? 1 : nextDay;
  
  return {
    day: normalizedDay,
    rewards: this.calculateRewards(normalizedDay, 0) // Sans bonus VIP pour preview
  };
};

// Obtenir le statut de claim
dailyRewardsSchema.methods.getClaimStatus = function() {
  const now = new Date();
  const canClaim = this.canClaimToday();
  
  let timeUntilNext = 0;
  if (!canClaim) {
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    timeUntilNext = tomorrow.getTime() - now.getTime();
  }
  
  const lastClaim = this.lastClaimDate ? new Date(this.lastClaimDate) : null;
  let missedToday = false;
  
  if (lastClaim) {
    const diffTime = now.getTime() - lastClaim.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    missedToday = diffDays > 0 && !canClaim;
  }
  
  return {
    canClaim,
    timeUntilNext,
    currentStreak: this.currentStreak,
    nextDay: canClaim ? this.currentDay : (this.currentDay >= 30 ? 1 : this.currentDay + 1),
    missedToday
  };
};

// === MÉTHODES STATIQUES ===

dailyRewardsSchema.statics.getOrCreate = async function(playerId: string, serverId: string) {
  let dailyRewards = await this.findOne({ playerId, serverId });
  
  if (!dailyRewards) {
    dailyRewards = new this({
      playerId,
      serverId,
      currentStreak: 0,
      currentDay: 1,
      streakStartDate: new Date()
    });
    await dailyRewards.save();
    console.log(`✅ Daily rewards créé pour ${playerId}`);
  }
  
  return dailyRewards;
};

// Obtenir les meilleurs streaks du serveur
dailyRewardsSchema.statics.getTopStreaks = async function(serverId: string, limit: number = 50) {
  return this.find({ serverId })
    .sort({ currentStreak: -1, longestStreak: -1 })
    .limit(limit)
    .select('playerId currentStreak longestStreak totalClaims lastClaimDate')
    .lean();
};

// Statistiques du serveur
dailyRewardsSchema.statics.getServerStats = async function(serverId: string) {
  const stats = await this.aggregate([
    { $match: { serverId } },
    { $group: {
      _id: null,
      totalPlayers: { $sum: 1 },
      avgStreak: { $avg: "$currentStreak" },
      maxStreak: { $max: "$currentStreak" },
      totalClaims: { $sum: "$totalClaims" },
      totalRewardsValue: { $sum: "$totalRewardsValue" },
      avgClaimsPerPlayer: { $avg: "$totalClaims" }
    }}
  ]);
  
  return stats[0] || {
    totalPlayers: 0,
    avgStreak: 0,
    maxStreak: 0,
    totalClaims: 0,
    totalRewardsValue: 0,
    avgClaimsPerPlayer: 0
  };
};

// Nettoyer les joueurs inactifs (> 90 jours)
dailyRewardsSchema.statics.cleanupInactive = async function(daysInactive: number = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
  
  const result = await this.deleteMany({
    lastClaimDate: { $lt: cutoffDate }
  });
  
  console.log(`🧹 ${result.deletedCount} daily rewards inactifs supprimés`);
  return result.deletedCount;
};

export default mongoose.model<IDailyRewardsDocument>("DailyRewards", dailyRewardsSchema);

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IVipRewardItem {
  type: "currency" | "material" | "hero" | "item";
  currencyType?: "gold" | "gems" | "tickets";
  materialId?: string;
  heroId?: string;
  itemId?: string;
  quantity: number;
  rarity?: string;
}

export interface IVipDailyRewards extends Document {
  playerId: string;
  serverId: string;
  vipLevel: number;
  rewardDate: string; // YYYY-MM-DD format
  rewards: IVipRewardItem[];
  totalValue: number; // Valeur totale estimée des récompenses
  isClaimed: boolean;
  claimedAt?: Date;
  claimStreak: number; // Série de jours consécutifs
  missedDays: number; // Jours manqués ce mois-ci
  bonusMultiplier: number; // Multiplicateur pour streaks
  deviceInfo?: {
    platform: "ios" | "android" | "web";
    deviceId?: string;
    ipAddress?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Méthodes d'instance
  claim(deviceInfo?: any): Promise<{ success: boolean; rewards: IVipRewardItem[]; streakBonus?: number }>;
  calculateRewardValue(): number;
  isExpired(): boolean;
  getDaysUntilExpiry(): number;
  getStreakBonus(): number;
}

export interface IVipDailyRewardsModel extends Model<IVipDailyRewards> {
  generateDailyRewards(playerId: string, serverId: string, vipLevel: number, date?: string): Promise<IVipDailyRewards>;
  calculateCurrentStreak(playerId: string, serverId: string, currentDate: string): Promise<{ currentStreak: number; missedThisMonth: number }>;
  generateRewardsByLevel(vipLevel: number): IVipRewardItem[];
  getClaimableRewards(playerId: string, serverId: string, maxDays?: number): Promise<IVipDailyRewards[]>;
  getPlayerClaimStats(playerId: string, serverId: string, days?: number): Promise<any>;
  getServerClaimStats(serverId: string, days?: number): Promise<any>;
  cleanupExpiredRewards(): Promise<{ deletedCount: number; message: string }>;
  getTopStreakPlayers(serverId: string, limit?: number): Promise<any[]>;
}

const vipRewardItemSchema = new Schema<IVipRewardItem>({
  type: {
    type: String,
    required: true,
    enum: ["currency", "material", "hero", "item"]
  },
  currencyType: {
    type: String,
    enum: ["gold", "gems", "tickets"],
    required: function() { return this.type === "currency"; }
  },
  materialId: {
    type: String,
    required: function() { return this.type === "material"; }
  },
  heroId: {
    type: String,
    required: function() { return this.type === "hero"; }
  },
  itemId: {
    type: String,
    required: function() { return this.type === "item"; }
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  rarity: {
    type: String,
    enum: ["Common", "Rare", "Epic", "Legendary", "Mythic"],
    default: null
  }
});

const vipDailyRewardsSchema = new Schema<IVipDailyRewards>({
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
  vipLevel: {
    type: Number,
    required: true,
    min: 0,
    max: 50
  },
  rewardDate: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/ // YYYY-MM-DD format
  },
  rewards: [vipRewardItemSchema],
  totalValue: {
    type: Number,
    default: 0,
    min: 0
  },
  isClaimed: {
    type: Boolean,
    default: false
  },
  claimedAt: {
    type: Date,
    default: null
  },
  claimStreak: {
    type: Number,
    default: 0,
    min: 0
  },
  missedDays: {
    type: Number,
    default: 0,
    min: 0
  },
  bonusMultiplier: {
    type: Number,
    default: 1.0,
    min: 1.0,
    max: 3.0
  },
  deviceInfo: {
    platform: {
      type: String,
      enum: ["ios", "android", "web"],
      default: "web"
    },
    deviceId: { type: String, default: null },
    ipAddress: { type: String, default: null },
    default: null
  }
}, {
  timestamps: true,
  collection: 'vip_daily_rewards'
});

// Index composé unique pour éviter les doublons
vipDailyRewardsSchema.index({ playerId: 1, serverId: 1, rewardDate: 1 }, { unique: true });
vipDailyRewardsSchema.index({ rewardDate: 1 });
vipDailyRewardsSchema.index({ isClaimed: 1, rewardDate: 1 });
vipDailyRewardsSchema.index({ vipLevel: 1 });
vipDailyRewardsSchema.index({ claimStreak: -1 });
vipDailyRewardsSchema.index({ totalValue: -1 });

// === MÉTHODES D'INSTANCE ===

// Réclamer les récompenses
vipDailyRewardsSchema.methods.claim = async function(
  deviceInfo?: any
): Promise<{ success: boolean; rewards: IVipRewardItem[]; streakBonus?: number }> {
  if (this.isClaimed) {
    throw new Error("Rewards already claimed for this date");
  }
  
  if (this.isExpired()) {
    throw new Error("Rewards have expired");
  }
  
  this.isClaimed = true;
  this.claimedAt = new Date();
  
  if (deviceInfo) {
    this.deviceInfo = deviceInfo;
  }
  
  // Appliquer le bonus de streak si applicable
  const streakBonus = this.getStreakBonus();
  let finalRewards = [...this.rewards];
  
  if (streakBonus > 1.0) {
  finalRewards = finalRewards.map((reward: IVipRewardItem) => ({
    type: reward.type,
    currencyType: reward.currencyType,
    materialId: reward.materialId,
    heroId: reward.heroId,
    itemId: reward.itemId,
    quantity: Math.floor(reward.quantity * streakBonus),
    rarity: reward.rarity
  } as IVipRewardItem));
  }
  
  await this.save();
  
  return {
    success: true,
    rewards: finalRewards,
    streakBonus: streakBonus > 1.0 ? streakBonus : undefined
  };
};

// Calculer la valeur totale des récompenses
vipDailyRewardsSchema.methods.calculateRewardValue = function(): number {
  let totalValue = 0;
  
  this.rewards.forEach((reward: IVipRewardItem) => {
    switch (reward.type) {
      case "currency":
        if (reward.currencyType === "gold") totalValue += reward.quantity * 0.001; // 1000 gold = 1 point
        if (reward.currencyType === "gems") totalValue += reward.quantity * 1; // 1 gem = 1 point
        if (reward.currencyType === "tickets") totalValue += reward.quantity * 5; // 1 ticket = 5 points
        break;
      case "material":
        totalValue += reward.quantity * 10; // Materials have base value
        break;
      case "hero":
        const rarityValues = { "Common": 50, "Rare": 100, "Epic": 500, "Legendary": 1000, "Mythic": 2000 };
        totalValue += (rarityValues[reward.rarity as keyof typeof rarityValues] || 100) * reward.quantity;
        break;
      case "item":
        totalValue += reward.quantity * 25; // Items have base value
        break;
    }
  });
  
  return Math.round(totalValue);
};

// Vérifier si les récompenses ont expiré
vipDailyRewardsSchema.methods.isExpired = function(): boolean {
  const rewardDate = new Date(this.rewardDate + "T00:00:00.000Z");
  const expiryDate = new Date(rewardDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 jours pour réclamer
  return new Date() > expiryDate;
};

// Obtenir les jours restants avant expiration
vipDailyRewardsSchema.methods.getDaysUntilExpiry = function(): number {
  const rewardDate = new Date(this.rewardDate + "T00:00:00.000Z");
  const expiryDate = new Date(rewardDate.getTime() + (7 * 24 * 60 * 60 * 1000));
  const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, daysLeft);
};

// Calculer le bonus de streak
vipDailyRewardsSchema.methods.getStreakBonus = function(): number {
  if (this.claimStreak >= 30) return 2.0; // 30+ jours = 100% bonus
  if (this.claimStreak >= 14) return 1.5; // 14+ jours = 50% bonus
  if (this.claimStreak >= 7) return 1.25; // 7+ jours = 25% bonus
  if (this.claimStreak >= 3) return 1.1; // 3+ jours = 10% bonus
  return 1.0; // Pas de bonus
};

// === MÉTHODES STATIQUES ===

// Générer les récompenses par niveau VIP
vipDailyRewardsSchema.statics.generateRewardsByLevel = function(vipLevel: number): IVipRewardItem[] {
  const rewards: IVipRewardItem[] = [];
  
  // Récompenses de base (or)
  rewards.push({
    type: "currency",
    currencyType: "gold",
    quantity: 1000 + (vipLevel * 500)
  });
  
  // Gems (à partir de VIP 1)
  if (vipLevel >= 1) {
    rewards.push({
      type: "currency",
      currencyType: "gems",
      quantity: 10 + (vipLevel * 5)
    });
  }
  
  // Tickets (à partir de VIP 2)
  if (vipLevel >= 2) {
    rewards.push({
      type: "currency",
      currencyType: "tickets",
      quantity: Math.floor(vipLevel / 2)
    });
  }
  
  // Matériaux basés sur le niveau VIP
  if (vipLevel >= 2) {
    rewards.push({
      type: "material",
      materialId: "fusion_crystal",
      quantity: 5 + vipLevel
    });
  }
  
  if (vipLevel >= 4) {
    rewards.push({
      type: "material",
      materialId: "elemental_essence",
      quantity: 2 + Math.floor(vipLevel / 2)
    });
  }
  
  if (vipLevel >= 6) {
    rewards.push({
      type: "material",
      materialId: "ascension_stone",
      quantity: 1 + Math.floor(vipLevel / 3)
    });
  }
  
  if (vipLevel >= 8) {
    rewards.push({
      type: "material",
      materialId: "divine_crystal",
      quantity: Math.floor(vipLevel / 4)
    });
  }
  
  if (vipLevel >= 10) {
    rewards.push({
      type: "material",
      materialId: "stellar_essence",
      quantity: Math.floor(vipLevel / 5)
    });
  }
  
  if (vipLevel >= 12) {
    rewards.push({
      type: "material",
      materialId: "cosmic_shard",
      quantity: Math.floor(vipLevel / 6)
    });
  }
  
  // Récompenses spéciales pour les très hauts niveaux VIP
  if (vipLevel >= 15) {
    rewards.push({
      type: "hero",
      heroId: "daily_vip_selector",
      quantity: 1,
      rarity: "Epic"
    });
  }
  
  return rewards;
};

// Calculer le streak actuel d'un joueur
vipDailyRewardsSchema.statics.calculateCurrentStreak = async function(
  playerId: string,
  serverId: string,
  currentDate: string
): Promise<{ currentStreak: number; missedThisMonth: number }> {
  const recentRewards = await this.find({
    playerId,
    serverId,
    rewardDate: { $lte: currentDate }
  }).sort({ rewardDate: -1 }).limit(60); // Derniers 60 jours
  
  let currentStreak = 0;
  let missedThisMonth = 0;
  const currentMonth = currentDate.substring(0, 7); // YYYY-MM
  
  // Calculer le streak en partant de la date actuelle
  const currentDateObj = new Date(currentDate);
  for (let i = 0; i < 30; i++) { // Vérifier jusqu'à 30 jours en arrière
    const checkDate = new Date(currentDateObj.getTime() - (i * 24 * 60 * 60 * 1000));
    const checkDateStr = checkDate.toISOString().split('T')[0];
    
    if (checkDateStr >= currentDate) continue; // Ne pas compter le jour actuel
    
    const dayReward = recentRewards.find((r: IVipDailyRewards) => r.rewardDate === checkDateStr);
    
    if (dayReward && dayReward.isClaimed) {
      currentStreak++;
    } else {
      break; // Streak cassé
    }
  }
  
  // Compter les jours manqués ce mois-ci
  recentRewards.forEach((reward: IVipDailyRewards) => {
    if (reward.rewardDate.startsWith(currentMonth) && !reward.isClaimed) {
      missedThisMonth++;
    }
  });
  
  return { currentStreak, missedThisMonth };
};

// Générer les récompenses quotidiennes pour un joueur
vipDailyRewardsSchema.statics.generateDailyRewards = async function(
  playerId: string,
  serverId: string,
  vipLevel: number,
  date?: string
): Promise<IVipDailyRewards> {
  const rewardDate = date || new Date().toISOString().split('T')[0];
  
  // Vérifier si les récompenses existent déjà
  const existing = await this.findOne({ playerId, serverId, rewardDate });
  if (existing) {
    return existing;
  }
  
  // Calculer le streak actuel
const streakInfo = await (this.schema.statics as any).calculateCurrentStreak.call(this, playerId, serverId, rewardDate);
  
  // Générer les récompenses basées sur le niveau VIP
const rewards = (this.schema.statics as any).generateRewardsByLevel(vipLevel);
  
  // Créer l'entrée de récompenses
  const dailyRewards = new this({
    playerId,
    serverId,
    vipLevel,
    rewardDate,
    rewards,
    totalValue: 0, // Sera calculé automatiquement
    claimStreak: streakInfo.currentStreak,
    missedDays: streakInfo.missedThisMonth,
    bonusMultiplier: 1.0
  });
  
  // Calculer la valeur totale
  dailyRewards.totalValue = dailyRewards.calculateRewardValue();
  
  await dailyRewards.save();
  return dailyRewards;
};

// Obtenir les récompenses réclamables pour un joueur
vipDailyRewardsSchema.statics.getClaimableRewards = async function(
  playerId: string,
  serverId: string,
  maxDays: number = 7
): Promise<IVipDailyRewards[]> {
  const startDate = new Date(Date.now() - (maxDays * 24 * 60 * 60 * 1000));
  const startDateStr = startDate.toISOString().split('T')[0];
  
  return this.find({
    playerId,
    serverId,
    rewardDate: { $gte: startDateStr },
    isClaimed: false
  }).sort({ rewardDate: 1 });
};

// Obtenir les statistiques de réclamation d'un joueur
vipDailyRewardsSchema.statics.getPlayerClaimStats = async function(
  playerId: string,
  serverId: string,
  days: number = 30
) {
  const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
  const startDateStr = startDate.toISOString().split('T')[0];
  
  const stats = await this.aggregate([
    { $match: { 
      playerId, 
      serverId, 
      rewardDate: { $gte: startDateStr } 
    }},
    { $group: {
      _id: null,
      totalDays: { $sum: 1 },
      claimedDays: { $sum: { $cond: ["$isClaimed", 1, 0] } },
      totalValue: { $sum: "$totalValue" },
      claimedValue: { $sum: { $cond: ["$isClaimed", "$totalValue", 0] } },
      maxStreak: { $max: "$claimStreak" },
      avgClaimStreak: { $avg: "$claimStreak" }
    }}
  ]);
  
  const result = stats[0] || {
    totalDays: 0,
    claimedDays: 0,
    totalValue: 0,
    claimedValue: 0,
    maxStreak: 0,
    avgClaimStreak: 0
  };
  
  result.claimRate = result.totalDays > 0 ? (result.claimedDays / result.totalDays) * 100 : 0;
  result.missedDays = result.totalDays - result.claimedDays;
  result.missedValue = result.totalValue - result.claimedValue;
  
  return result;
};

// Obtenir les statistiques du serveur
vipDailyRewardsSchema.statics.getServerClaimStats = async function(
  serverId: string,
  days: number = 30
) {
  const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
  const startDateStr = startDate.toISOString().split('T')[0];
  
  const stats = await this.aggregate([
    { $match: { 
      serverId, 
      rewardDate: { $gte: startDateStr } 
    }},
    { $group: {
      _id: null,
      totalRewards: { $sum: 1 },
      claimedRewards: { $sum: { $cond: ["$isClaimed", 1, 0] } },
      uniquePlayers: { $addToSet: "$playerId" },
      totalValueDistributed: { $sum: { $cond: ["$isClaimed", "$totalValue", 0] } },
      avgStreakLength: { $avg: "$claimStreak" },
      maxStreakLength: { $max: "$claimStreak" }
    }},
    { $addFields: {
      uniquePlayersCount: { $size: "$uniquePlayers" },
      claimRate: { $divide: ["$claimedRewards", "$totalRewards"] }
    }}
  ]);
  
  return stats[0] || {
    totalRewards: 0,
    claimedRewards: 0,
    uniquePlayersCount: 0,
    totalValueDistributed: 0,
    claimRate: 0,
    avgStreakLength: 0,
    maxStreakLength: 0
  };
};

// Nettoyer les récompenses expirées
vipDailyRewardsSchema.statics.cleanupExpiredRewards = async function() {
  const expiredDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
  const expiredDateStr = expiredDate.toISOString().split('T')[0];
  
  const result = await this.deleteMany({
    rewardDate: { $lt: expiredDateStr },
    isClaimed: false
  });
  
  return {
    deletedCount: result.deletedCount || 0,
    message: `Cleaned up ${result.deletedCount || 0} expired unclaimed rewards`
  };
};

// Obtenir les top claimers par streak
vipDailyRewardsSchema.statics.getTopStreakPlayers = async function(
  serverId: string,
  limit: number = 50
) {
  return this.aggregate([
    { $match: { serverId } },
    { $group: {
      _id: "$playerId",
      maxStreak: { $max: "$claimStreak" },
      totalClaimed: { $sum: { $cond: ["$isClaimed", 1, 0] } },
      totalValue: { $sum: { $cond: ["$isClaimed", "$totalValue", 0] } },
      currentVipLevel: { $last: "$vipLevel" }
    }},
    { $sort: { maxStreak: -1, totalClaimed: -1 } },
    { $limit: limit },
    { $lookup: {
      from: "players",
      localField: "_id",
      foreignField: "_id",
      as: "playerInfo"
    }},
    { $addFields: {
      playerName: { $arrayElemAt: ["$playerInfo.username", 0] }
    }},
    { $project: {
      playerId: "$_id",
      playerName: 1,
      maxStreak: 1,
      totalClaimed: 1,
      totalValue: 1,
      currentVipLevel: 1
    }}
  ]);
};

export default mongoose.model<IVipDailyRewards, IVipDailyRewardsModel>("VipDailyRewards", vipDailyRewardsSchema);

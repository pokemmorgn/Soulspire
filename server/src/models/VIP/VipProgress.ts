import mongoose, { Document, Schema } from "mongoose";

export interface IVipPurchase {
  amount: number;
  expGained: number;
  purchaseDate: Date;
  transactionId?: string;
}

export interface IVipDailyReward {
  date: string; // YYYY-MM-DD format
  claimed: boolean;
  claimedAt?: Date;
  rewards: {
    gold: number;
    gems: number;
    tickets: number;
    materials: Map<string, number>;
  };
}

export interface IVipProgress extends Document {
  playerId: string;
  serverId: string;
  currentLevel: number;
  currentExp: number;
  totalExpSpent: number;
  purchaseHistory: IVipPurchase[];
  dailyRewards: IVipDailyReward[];
  lastDailyRewardDate: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Méthodes
  addExp(amount: number, transactionId?: string): Promise<{ leveledUp: boolean; newLevel: number; oldLevel: number }>;
  claimDailyReward(): Promise<{ success: boolean; rewards?: any; reason?: string }>;
  canClaimDailyReward(): boolean;
  calculateLevel(): number;
  getLevelBenefits(): any[];
  getNextLevelInfo(): { level: number; expRequired: number; benefits: any[] } | null;
  getTotalPurchases(): number;
  getRecentPurchases(limit?: number): IVipPurchase[];
}

const vipPurchaseSchema = new Schema({
  amount: { type: Number, required: true, min: 1 },
  expGained: { type: Number, required: true, min: 1 },
  purchaseDate: { type: Date, default: Date.now },
  transactionId: { type: String, default: null }
});

const vipDailyRewardSchema = new Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  claimed: { type: Boolean, default: false },
  claimedAt: { type: Date, default: null },
  rewards: {
    gold: { type: Number, default: 0 },
    gems: { type: Number, default: 0 },
    tickets: { type: Number, default: 0 },
    materials: { type: Map, of: Number, default: new Map() }
  }
});

const vipProgressSchema = new Schema<IVipProgress>({
  playerId: { 
    type: String, 
    required: true,
    index: true
  },
  serverId: { 
    type: String, 
    required: true,
    match: /^S\d+$/
  },
  currentLevel: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 15
  },
  currentExp: { 
    type: Number, 
    default: 0,
    min: 0
  },
  totalExpSpent: { 
    type: Number, 
    default: 0,
    min: 0
  },
  purchaseHistory: [vipPurchaseSchema],
  dailyRewards: [vipDailyRewardSchema],
  lastDailyRewardDate: { 
    type: Date, 
    default: null 
  }
}, {
  timestamps: true,
  collection: 'vip_progress'
});

// Index composé pour recherche rapide
vipProgressSchema.index({ playerId: 1, serverId: 1 }, { unique: true });
vipProgressSchema.index({ currentLevel: -1 });
vipProgressSchema.index({ totalExpSpent: -1 });
vipProgressSchema.index({ 'purchaseHistory.purchaseDate': -1 });

// Configuration des niveaux VIP (importée du service)
const VIP_LEVELS = [
  { level: 0, totalExpRequired: 0, benefits: [] },
  { level: 1, totalExpRequired: 100, benefits: ["battle_speed_2x", "shop_discount_5"] },
  { level: 2, totalExpRequired: 300, benefits: ["max_stamina_120", "shop_discount_8", "afk_bonus_10"] },
  { level: 3, totalExpRequired: 600, benefits: ["max_stamina_140", "shop_discount_10", "afk_bonus_15", "fast_rewards_2h"] },
  { level: 4, totalExpRequired: 1100, benefits: ["max_stamina_160", "shop_discount_12", "afk_bonus_20", "fast_rewards_4h"] },
  { level: 5, totalExpRequired: 1800, benefits: ["battle_speed_3x", "max_stamina_180", "shop_discount_15", "afk_bonus_25", "auto_battle"] },
  { level: 6, totalExpRequired: 2800, benefits: ["max_stamina_200", "shop_discount_18", "afk_bonus_30", "skip_battle"] },
  { level: 7, totalExpRequired: 4100, benefits: ["max_stamina_220", "shop_discount_20", "afk_bonus_35", "vip_shop", "formation_slots_5"] },
  { level: 8, totalExpRequired: 5800, benefits: ["max_stamina_250", "shop_discount_22", "afk_bonus_40", "exclusive_summons", "bonus_exp_20"] },
  { level: 9, totalExpRequired: 8000, benefits: ["max_stamina_280", "shop_discount_25", "afk_bonus_45", "bonus_gold_25", "daily_dungeon_2"] },
  { level: 10, totalExpRequired: 11000, benefits: ["max_stamina_300", "shop_discount_28", "afk_bonus_50", "bonus_gold_30", "bonus_exp_30"] },
  { level: 11, totalExpRequired: 15000, benefits: ["max_stamina_350", "shop_discount_30", "afk_bonus_60", "bonus_gold_40", "chat_privileges"] },
  { level: 12, totalExpRequired: 20500, benefits: ["max_stamina_400", "shop_discount_35", "afk_bonus_70", "bonus_gold_50"] },
  { level: 13, totalExpRequired: 28000, benefits: ["max_stamina_450", "shop_discount_40", "afk_bonus_80", "bonus_gold_60"] },
  { level: 14, totalExpRequired: 38000, benefits: ["max_stamina_500", "shop_discount_45", "afk_bonus_100", "bonus_gold_80"] },
  { level: 15, totalExpRequired: 53000, benefits: ["max_stamina_600", "shop_discount_50", "afk_bonus_150", "bonus_gold_100"] }
];

// === MÉTHODES DU MODÈLE ===

// Ajouter de l'expérience VIP
vipProgressSchema.methods.addExp = async function(
  amount: number, 
  transactionId?: string
): Promise<{ leveledUp: boolean; newLevel: number; oldLevel: number }> {
  const oldLevel = this.currentLevel;
  
  this.currentExp += amount;
  this.totalExpSpent += amount;
  
  // Ajouter à l'historique
  this.purchaseHistory.push({
    amount,
    expGained: amount,
    purchaseDate: new Date(),
    transactionId
  });
  
  // Recalculer le niveau
  const newLevel = this.calculateLevel();
  const leveledUp = newLevel > oldLevel;
  
  if (leveledUp) {
    this.currentLevel = newLevel;
  }
  
  await this.save();
  
  return { leveledUp, newLevel, oldLevel };
};

// Réclamer les récompenses quotidiennes
vipProgressSchema.methods.claimDailyReward = async function(): Promise<{ success: boolean; rewards?: any; reason?: string }> {
  if (!this.canClaimDailyReward()) {
    return { 
      success: false, 
      reason: "Daily reward already claimed or VIP level too low" 
    };
  }
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const rewards = this.calculateDailyRewards();
  
  // Ajouter aux récompenses quotidiennes
  this.dailyRewards.push({
    date: today,
    claimed: true,
    claimedAt: new Date(),
    rewards
  });
  
  this.lastDailyRewardDate = new Date();
  await this.save();
  
  return { success: true, rewards };
};

// Vérifier si peut réclamer les récompenses quotidiennes
vipProgressSchema.methods.canClaimDailyReward = function(): boolean {
  if (this.currentLevel === 0) return false;
  
  const today = new Date().toISOString().split('T')[0];
  const todayReward = this.dailyRewards.find(r => r.date === today);
  
  return !todayReward || !todayReward.claimed;
};

// Calculer le niveau basé sur l'expérience
vipProgressSchema.methods.calculateLevel = function(): number {
  for (let i = VIP_LEVELS.length - 1; i >= 0; i--) {
    if (this.currentExp >= VIP_LEVELS[i].totalExpRequired) {
      return i;
    }
  }
  return 0;
};

// Obtenir les bénéfices du niveau actuel
vipProgressSchema.methods.getLevelBenefits = function(): any[] {
  const levelConfig = VIP_LEVELS[this.currentLevel];
  return levelConfig ? levelConfig.benefits : [];
};

// Obtenir les infos du prochain niveau
vipProgressSchema.methods.getNextLevelInfo = function(): { level: number; expRequired: number; benefits: any[] } | null {
  const nextLevel = this.currentLevel + 1;
  if (nextLevel >= VIP_LEVELS.length) return null;
  
  const nextLevelConfig = VIP_LEVELS[nextLevel];
  return {
    level: nextLevel,
    expRequired: nextLevelConfig.totalExpRequired - this.currentExp,
    benefits: nextLevelConfig.benefits
  };
};

// Obtenir le total des achats
vipProgressSchema.methods.getTotalPurchases = function(): number {
  return this.purchaseHistory.reduce((sum, purchase) => sum + purchase.amount, 0);
};

// Obtenir les achats récents
vipProgressSchema.methods.getRecentPurchases = function(limit: number = 10): IVipPurchase[] {
  return this.purchaseHistory
    .sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime())
    .slice(0, limit);
};

// Calculer les récompenses quotidiennes basées sur le niveau
vipProgressSchema.methods.calculateDailyRewards = function() {
  const level = this.currentLevel;
  const baseRewards = {
    gold: 1000 + (level * 500),
    gems: 10 + (level * 5),
    tickets: Math.floor(level / 2),
    materials: new Map()
  };
  
  // Matériaux basés sur le niveau VIP
  if (level >= 2) baseRewards.materials.set("fusion_crystal", 5 + level);
  if (level >= 4) baseRewards.materials.set("elemental_essence", 2 + Math.floor(level / 2));
  if (level >= 6) baseRewards.materials.set("ascension_stone", 1 + Math.floor(level / 3));
  if (level >= 8) baseRewards.materials.set("divine_crystal", Math.floor(level / 4));
  if (level >= 10) baseRewards.materials.set("stellar_essence", Math.floor(level / 5));
  if (level >= 12) baseRewards.materials.set("cosmic_shard", Math.floor(level / 6));
  
  return baseRewards;
};

// === MÉTHODES STATIQUES ===

// Créer ou récupérer la progression VIP d'un joueur
vipProgressSchema.statics.getOrCreateProgress = async function(playerId: string, serverId: string) {
  let progress = await this.findOne({ playerId, serverId });
  
  if (!progress) {
    progress = new this({
      playerId,
      serverId,
      currentLevel: 0,
      currentExp: 0,
      totalExpSpent: 0,
      purchaseHistory: [],
      dailyRewards: [],
      lastDailyRewardDate: null
    });
    await progress.save();
  }
  
  return progress;
};

// Obtenir le classement VIP du serveur
vipProgressSchema.statics.getServerLeaderboard = async function(serverId: string, limit: number = 50) {
  return this.find({ serverId })
    .sort({ currentLevel: -1, totalExpSpent: -1 })
    .limit(limit)
    .populate("playerId", "username")
    .select("playerId currentLevel totalExpSpent");
};

// Obtenir les statistiques VIP du serveur
vipProgressSchema.statics.getServerStats = async function(serverId: string) {
  const stats = await this.aggregate([
    { $match: { serverId } },
    { $group: {
      _id: "$currentLevel",
      playerCount: { $sum: 1 },
      avgExp: { $avg: "$totalExpSpent" },
      totalExp: { $sum: "$totalExpSpent" }
    }},
    { $sort: { _id: 1 } }
  ]);
  
  const totalPlayers = stats.reduce((sum, stat) => sum + stat.playerCount, 0);
  const totalExpSpent = stats.reduce((sum, stat) => sum + stat.totalExp, 0);
  
  return {
    totalPlayers,
    totalExpSpent,
    averageVipLevel: totalPlayers > 0 ? 
      stats.reduce((sum, stat) => sum + (stat._id * stat.playerCount), 0) / totalPlayers : 0,
    vipDistribution: stats,
    topVipLevel: Math.max(...stats.map(s => s._id), 0)
  };
};

export default mongoose.model<IVipProgress>("VipProgress", vipProgressSchema);

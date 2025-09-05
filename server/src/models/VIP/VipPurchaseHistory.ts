import mongoose, { Document, Schema } from "mongoose";

export interface IVipPurchaseHistory extends Document {
  playerId: string;
  serverId: string;
  transactionId: string;
  purchaseType: "vip_exp" | "vip_package" | "admin_grant";
  paidGemsSpent: number;
  vipExpGained: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  packageData?: {
    packageId: string;
    packageName: string;
    bonusItems: Array<{
      type: string;
      itemId?: string;
      quantity: number;
    }>;
  };
  deviceInfo?: {
    platform: "ios" | "android" | "web";
    deviceId?: string;
    userAgent?: string;
  };
  paymentInfo?: {
    method: "google_play" | "app_store" | "web_payment" | "admin";
    currency: string;
    amount: number;
    exchangeRate?: number;
  };
  ipAddress?: string;
  purchaseDate: Date;
  isRefunded: boolean;
  refundDate?: Date;
  refundReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Méthodes
  markAsRefunded(reason: string): Promise<void>;
  calculateValue(): { gemValue: number; expValue: number; totalValue: number };
  isLargeSpender(): boolean;
  getDaysFromPurchase(): number;
}

const vipPurchaseHistorySchema = new Schema<IVipPurchaseHistory>({
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
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  purchaseType: {
    type: String,
    required: true,
    enum: ["vip_exp", "vip_package", "admin_grant"],
    default: "vip_exp"
  },
  paidGemsSpent: {
    type: Number,
    required: true,
    min: 0
  },
  vipExpGained: {
    type: Number,
    required: true,
    min: 1
  },
  levelBefore: {
    type: Number,
    required: true,
    min: 0,
    max: 50
  },
  levelAfter: {
    type: Number,
    required: true,
    min: 0,
    max: 50
  },
  leveledUp: {
    type: Boolean,
    default: false
  },
  packageData: {
    packageId: { type: String, default: null },
    packageName: { type: String, default: null },
    bonusItems: [{
      type: { type: String, required: true },
      itemId: { type: String, default: null },
      quantity: { type: Number, required: true, min: 1 }
    }]
  },
  deviceInfo: {
    platform: { 
      type: String, 
      enum: ["ios", "android", "web"],
      default: "web"
    },
    deviceId: { type: String, default: null },
    userAgent: { type: String, default: null }
  },
  paymentInfo: {
    method: {
      type: String,
      enum: ["google_play", "app_store", "web_payment", "admin"],
      default: "admin"
    },
    currency: { type: String, default: "USD" },
    amount: { type: Number, min: 0, default: 0 },
    exchangeRate: { type: Number, min: 0, default: 1 }
  },
  ipAddress: {
    type: String,
    default: null,
    match: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
  },
  purchaseDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  isRefunded: {
    type: Boolean,
    default: false
  },
  refundDate: {
    type: Date,
    default: null
  },
  refundReason: {
    type: String,
    maxlength: 500,
    default: null
  },
  notes: {
    type: String,
    maxlength: 1000,
    default: null
  }
}, {
  timestamps: true,
  collection: 'vip_purchase_history'
});

// Index composés pour performance
vipPurchaseHistorySchema.index({ playerId: 1, serverId: 1 });
vipPurchaseHistorySchema.index({ playerId: 1, purchaseDate: -1 });
vipPurchaseHistorySchema.index({ serverId: 1, purchaseDate: -1 });
vipPurchaseHistorySchema.index({ leveledUp: 1, purchaseDate: -1 });
vipPurchaseHistorySchema.index({ paidGemsSpent: -1 });
vipPurchaseHistorySchema.index({ isRefunded: 1 });
vipPurchaseHistorySchema.index({ "paymentInfo.method": 1 });
vipPurchaseHistorySchema.index({ "deviceInfo.platform": 1 });

// === MÉTHODES DU MODÈLE ===

// Marquer comme remboursé
vipPurchaseHistorySchema.methods.markAsRefunded = async function(reason: string): Promise<void> {
  this.isRefunded = true;
  this.refundDate = new Date();
  this.refundReason = reason;
  await this.save();
};

// Calculer la valeur de l'achat
vipPurchaseHistorySchema.methods.calculateValue = function(): { gemValue: number; expValue: number; totalValue: number } {
  const gemValue = this.paidGemsSpent;
  const expValue = this.vipExpGained;
  const totalValue = gemValue; // 1:1 ratio gems = exp = value
  
  return { gemValue, expValue, totalValue };
};

// Vérifier si c'est un gros acheteur
vipPurchaseHistorySchema.methods.isLargeSpender = function(): boolean {
  return this.paidGemsSpent >= 1000; // 1000+ gems = large spender
};

// Obtenir les jours depuis l'achat
vipPurchaseHistorySchema.methods.getDaysFromPurchase = function(): number {
  const now = new Date();
  const diffTime = now.getTime() - this.purchaseDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// === MÉTHODES STATIQUES ===

// Créer un nouvel achat VIP
vipPurchaseHistorySchema.statics.recordPurchase = async function(purchaseData: {
  playerId: string;
  serverId: string;
  transactionId: string;
  paidGemsSpent: number;
  vipExpGained: number;
  levelBefore: number;
  levelAfter: number;
  purchaseType?: string;
  deviceInfo?: any;
  paymentInfo?: any;
  ipAddress?: string;
  notes?: string;
}) {
  const purchase = new this({
    ...purchaseData,
    leveledUp: purchaseData.levelAfter > purchaseData.levelBefore,
    purchaseDate: new Date()
  });
  
  await purchase.save();
  return purchase;
};

// Obtenir l'historique d'un joueur
vipPurchaseHistorySchema.statics.getPlayerHistory = async function(
  playerId: string, 
  serverId: string, 
  options: { limit?: number; offset?: number; includeRefunded?: boolean } = {}
) {
  const { limit = 20, offset = 0, includeRefunded = true } = options;
  
  const query: any = { playerId, serverId };
  if (!includeRefunded) {
    query.isRefunded = false;
  }
  
  return this.find(query)
    .sort({ purchaseDate: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
};

// Obtenir les statistiques d'un joueur
vipPurchaseHistorySchema.statics.getPlayerStats = async function(playerId: string, serverId: string) {
  const stats = await this.aggregate([
    { $match: { playerId, serverId, isRefunded: false } },
    { $group: {
      _id: null,
      totalPurchases: { $sum: 1 },
      totalGemsSpent: { $sum: "$paidGemsSpent" },
      totalExpGained: { $sum: "$vipExpGained" },
      totalLevelUps: { $sum: { $cond: ["$leveledUp", 1, 0] } },
      firstPurchase: { $min: "$purchaseDate" },
      lastPurchase: { $max: "$purchaseDate" },
      largestPurchase: { $max: "$paidGemsSpent" },
      avgPurchaseSize: { $avg: "$paidGemsSpent" }
    }}
  ]);
  
  const result = stats[0] || {
    totalPurchases: 0,
    totalGemsSpent: 0,
    totalExpGained: 0,
    totalLevelUps: 0,
    firstPurchase: null,
    lastPurchase: null,
    largestPurchase: 0,
    avgPurchaseSize: 0
  };
  
  // Calculer des métriques additionnelles
  if (result.firstPurchase && result.lastPurchase) {
    const daysSinceFirst = Math.floor((Date.now() - result.firstPurchase.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceLast = Math.floor((Date.now() - result.lastPurchase.getTime()) / (1000 * 60 * 60 * 24));
    
    result.daysSinceFirstPurchase = daysSinceFirst;
    result.daysSinceLastPurchase = daysSinceLast;
    result.avgPurchaseFrequency = daysSinceFirst > 0 ? result.totalPurchases / daysSinceFirst : 0;
  }
  
  return result;
};

// Obtenir les statistiques du serveur
vipPurchaseHistorySchema.statics.getServerStats = async function(
  serverId: string, 
  timeframe: "daily" | "weekly" | "monthly" | "all" = "all"
) {
  let dateFilter = {};
  const now = new Date();
  
  switch (timeframe) {
    case "daily":
      dateFilter = { purchaseDate: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } };
      break;
    case "weekly":
      dateFilter = { purchaseDate: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
      break;
    case "monthly":
      dateFilter = { purchaseDate: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
      break;
  }
  
  const stats = await this.aggregate([
    { $match: { serverId, isRefunded: false, ...dateFilter } },
    { $group: {
      _id: null,
      totalPurchases: { $sum: 1 },
      totalRevenue: { $sum: "$paidGemsSpent" },
      uniqueSpenders: { $addToSet: "$playerId" },
      totalLevelUps: { $sum: { $cond: ["$leveledUp", 1, 0] } },
      avgPurchaseSize: { $avg: "$paidGemsSpent" },
      largestPurchase: { $max: "$paidGemsSpent" }
    }},
    { $addFields: {
      uniqueSpendersCount: { $size: "$uniqueSpenders" }
    }}
  ]);
  
  return stats[0] || {
    totalPurchases: 0,
    totalRevenue: 0,
    uniqueSpendersCount: 0,
    totalLevelUps: 0,
    avgPurchaseSize: 0,
    largestPurchase: 0
  };
};

// Obtenir les top spenders
vipPurchaseHistorySchema.statics.getTopSpenders = async function(
  serverId: string, 
  limit: number = 50, 
  timeframe: "daily" | "weekly" | "monthly" | "all" = "all"
) {
  let dateFilter = {};
  const now = new Date();
  
  switch (timeframe) {
    case "daily":
      dateFilter = { purchaseDate: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } };
      break;
    case "weekly":
      dateFilter = { purchaseDate: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
      break;
    case "monthly":
      dateFilter = { purchaseDate: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
      break;
  }
  
  return this.aggregate([
    { $match: { serverId, isRefunded: false, ...dateFilter } },
    { $group: {
      _id: "$playerId",
      totalSpent: { $sum: "$paidGemsSpent" },
      totalPurchases: { $sum: 1 },
      totalLevelUps: { $sum: { $cond: ["$leveledUp", 1, 0] } },
      firstPurchase: { $min: "$purchaseDate" },
      lastPurchase: { $max: "$purchaseDate" },
      largestSinglePurchase: { $max: "$paidGemsSpent" }
    }},
    { $sort: { totalSpent: -1 } },
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
      totalSpent: 1,
      totalPurchases: 1,
      totalLevelUps: 1,
      firstPurchase: 1,
      lastPurchase: 1,
      largestSinglePurchase: 1,
      avgPurchaseSize: { $divide: ["$totalSpent", "$totalPurchases"] }
    }}
  ]);
};

// Obtenir les tendances d'achat
vipPurchaseHistorySchema.statics.getPurchaseTrends = async function(
  serverId: string, 
  days: number = 30
) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { 
      serverId, 
      isRefunded: false, 
      purchaseDate: { $gte: startDate } 
    }},
    { $group: {
      _id: {
        year: { $year: "$purchaseDate" },
        month: { $month: "$purchaseDate" },
        day: { $dayOfMonth: "$purchaseDate" }
      },
      dailyRevenue: { $sum: "$paidGemsSpent" },
      dailyPurchases: { $sum: 1 },
      dailySpenders: { $addToSet: "$playerId" },
      dailyLevelUps: { $sum: { $cond: ["$leveledUp", 1, 0] } }
    }},
    { $addFields: {
      date: { $dateFromParts: {
        year: "$_id.year",
        month: "$_id.month",
        day: "$_id.day"
      }},
      uniqueSpenders: { $size: "$dailySpenders" }
    }},
    { $sort: { date: 1 } },
    { $project: {
      _id: 0,
      date: 1,
      dailyRevenue: 1,
      dailyPurchases: 1,
      uniqueSpenders: 1,
      dailyLevelUps: 1,
      avgPurchaseSize: { $divide: ["$dailyRevenue", "$dailyPurchases"] }
    }}
  ]);
};

// Analyser les patterns d'achat
vipPurchaseHistorySchema.statics.analyzePurchasePatterns = async function(serverId: string) {
  const patterns = await this.aggregate([
    { $match: { serverId, isRefunded: false } },
    { $group: {
      _id: {
        hour: { $hour: "$purchaseDate" },
        dayOfWeek: { $dayOfWeek: "$purchaseDate" },
        platform: "$deviceInfo.platform"
      },
      count: { $sum: 1 },
      totalRevenue: { $sum: "$paidGemsSpent" },
      avgPurchaseSize: { $avg: "$paidGemsSpent" }
    }},
    { $sort: { count: -1 } }
  ]);
  
  // Grouper les résultats par catégorie
  const byHour = patterns.filter(p => p._id.hour !== null).map(p => ({
    hour: p._id.hour,
    purchases: p.count,
    revenue: p.totalRevenue,
    avgSize: p.avgPurchaseSize
  }));
  
  const byDayOfWeek = patterns.filter(p => p._id.dayOfWeek !== null).map(p => ({
    dayOfWeek: p._id.dayOfWeek, // 1=Sunday, 2=Monday, etc.
    purchases: p.count,
    revenue: p.totalRevenue,
    avgSize: p.avgPurchaseSize
  }));
  
  const byPlatform = patterns.filter(p => p._id.platform !== null).map(p => ({
    platform: p._id.platform,
    purchases: p.count,
    revenue: p.totalRevenue,
    avgSize: p.avgPurchaseSize
  }));
  
  return { byHour, byDayOfWeek, byPlatform };
};

// Détecter les achats frauduleux potentiels
vipPurchaseHistorySchema.statics.detectFraudulentPurchases = async function(serverId: string) {
  const suspiciousPurchases = await this.aggregate([
    { $match: { serverId, isRefunded: false } },
    { $group: {
      _id: "$playerId",
      totalPurchases: { $sum: 1 },
      totalSpent: { $sum: "$paidGemsSpent" },
      purchases: { $push: {
        transactionId: "$transactionId",
        amount: "$paidGemsSpent",
        date: "$purchaseDate",
        ipAddress: "$ipAddress",
        deviceId: "$deviceInfo.deviceId"
      }}
    }},
    { $match: {
      $or: [
        { totalSpent: { $gte: 10000 } }, // Large spenders
        { totalPurchases: { $gte: 20 } } // Frequent purchasers
      ]
    }},
    { $sort: { totalSpent: -1 } }
  ]);
  
  return suspiciousPurchases;
};

export default mongoose.model<IVipPurchaseHistory>("VipPurchaseHistory", vipPurchaseHistorySchema);

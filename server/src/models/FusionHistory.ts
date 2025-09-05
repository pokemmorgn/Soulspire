import mongoose, { Document, Schema } from "mongoose";

export interface IConsumedHero {
  heroId: string;
  heroName: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Ascended";
  role: "copy" | "food";
}

export interface IFusionCost {
  gold: number;
  materials: Map<string, number>;
}

export interface IFusionHistoryDocument extends Document {
  playerId: string;
  serverId: string;
  mainHeroId: string;
  mainHeroName: string;
  fromRarity: "Common" | "Rare" | "Epic" | "Legendary" | "Ascended";
  fromStars: number;
  toRarity: "Common" | "Rare" | "Epic" | "Legendary" | "Ascended";
  toStars: number;
  consumedHeroes: IConsumedHero[];
  cost: IFusionCost;
  powerGained: number;
  fusionType: "rarity_upgrade" | "star_upgrade";
  success: boolean;
  timestamp: Date;

  getTotalConsumedHeroes(): number;
  getTotalMaterialsCost(): number;
  getEfficiency(): number;
  getFusionSummary(): string;
}

const consumedHeroSchema = new Schema<IConsumedHero>({
  heroId: { 
    type: String, 
    required: true 
  },
  heroName: { 
    type: String, 
    required: true,
    trim: true
  },
  rarity: { 
    type: String, 
    enum: ["Common", "Rare", "Epic", "Legendary", "Ascended"],
    required: true 
  },
  role: { 
    type: String, 
    enum: ["copy", "food"],
    required: true 
  }
});

const fusionCostSchema = new Schema<IFusionCost>({
  gold: { 
    type: Number, 
    required: true,
    min: 0
  },
  materials: { 
    type: Map, 
    of: Number,
    default: new Map()
  }
});

const fusionHistorySchema = new Schema<IFusionHistoryDocument>({
  playerId: { 
    type: String,
    required: true,
    index: true
  },
  serverId: { 
    type: String,
    required: true,
    match: /^S\d+$/,
    default: "S1"
  },
  mainHeroId: { 
    type: String,
    required: true
  },
  mainHeroName: { 
    type: String,
    required: true,
    trim: true
  },
  fromRarity: { 
    type: String, 
    enum: ["Common", "Rare", "Epic", "Legendary", "Ascended"],
    required: true 
  },
  fromStars: { 
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  toRarity: { 
    type: String, 
    enum: ["Common", "Rare", "Epic", "Legendary", "Ascended"],
    required: true 
  },
  toStars: { 
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  consumedHeroes: {
    type: [consumedHeroSchema],
    required: true,
    validate: {
      validator: function(heroes: IConsumedHero[]) {
        return heroes.length > 0;
      },
      message: "At least one hero must be consumed for fusion"
    }
  },
  cost: {
    type: fusionCostSchema,
    required: true
  },
  powerGained: { 
    type: Number,
    required: true,
    min: 0
  },
  fusionType: { 
    type: String, 
    enum: ["rarity_upgrade", "star_upgrade"],
    required: true
  },
  success: { 
    type: Boolean,
    default: true
  },
  timestamp: { 
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'fusion_history'
});

// Index composés pour optimiser les requêtes
fusionHistorySchema.index({ playerId: 1, serverId: 1 });
fusionHistorySchema.index({ playerId: 1, timestamp: -1 });
fusionHistorySchema.index({ mainHeroId: 1, timestamp: -1 });
fusionHistorySchema.index({ toRarity: 1, toStars: 1 });
fusionHistorySchema.index({ fusionType: 1, timestamp: -1 });

// Méthodes d'instance
fusionHistorySchema.methods.getTotalConsumedHeroes = function(): number {
  return this.consumedHeroes.length;
};

fusionHistorySchema.methods.getTotalMaterialsCost = function(): number {
  const materials = this.cost.materials;
  if (!materials || materials.size === 0) return 0;
  
  return Array.from(materials.values()).reduce((sum: number, quantity: number) => sum + quantity, 0);
};

fusionHistorySchema.methods.getEfficiency = function(): number {
  const totalCost = this.cost.gold + (this.getTotalMaterialsCost() * 100);
  return totalCost > 0 ? Math.round(this.powerGained / totalCost * 1000) / 1000 : 0;
};

fusionHistorySchema.methods.getFusionSummary = function(): string {
  const fromLevel = this.fromStars > 0 ? `${this.fromRarity} ${this.fromStars}★` : this.fromRarity;
  const toLevel = this.toStars > 0 ? `${this.toRarity} ${this.toStars}★` : this.toRarity;
  return `${this.mainHeroName}: ${fromLevel} → ${toLevel} (+${this.powerGained} power)`;
};

// Méthodes statiques
fusionHistorySchema.statics.getPlayerFusionHistory = function(
  playerId: string, 
  serverId: string, 
  limit: number = 50,
  fusionType?: string
) {
  const query: any = { playerId, serverId };
  if (fusionType) {
    query.fusionType = fusionType;
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

fusionHistorySchema.statics.getPlayerFusionStats = function(playerId: string, serverId: string) {
  return this.aggregate([
    { $match: { playerId, serverId, success: true } },
    {
      $group: {
        _id: {
          toRarity: "$toRarity",
          toStars: "$toStars"
        },
        count: { $sum: 1 },
        totalPowerGained: { $sum: "$powerGained" },
        totalGoldSpent: { $sum: "$cost.gold" },
        avgEfficiency: { $avg: { $divide: ["$powerGained", { $add: ["$cost.gold", 1] }] } }
      }
    },
    { $sort: { "_id.toRarity": 1, "_id.toStars": 1 } }
  ]);
};

fusionHistorySchema.statics.getHeroFusionHistory = function(
  playerId: string,
  serverId: string,
  mainHeroId: string,
  limit: number = 20
) {
  return this.find({ playerId, serverId, mainHeroId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

fusionHistorySchema.statics.getTopFusionsByPower = function(
  playerId: string,
  serverId: string,
  limit: number = 10
) {
  return this.find({ playerId, serverId, success: true })
    .sort({ powerGained: -1 })
    .limit(limit)
    .lean();
};

fusionHistorySchema.statics.getFusionTrends = function(
  playerId: string,
  serverId: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    { 
      $match: { 
        playerId, 
        serverId, 
        success: true,
        timestamp: { $gte: startDate }
      } 
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
        },
        fusionsCount: { $sum: 1 },
        totalPowerGained: { $sum: "$powerGained" },
        totalGoldSpent: { $sum: "$cost.gold" },
        rarityUpgrades: {
          $sum: { $cond: [{ $eq: ["$fusionType", "rarity_upgrade"] }, 1, 0] }
        },
        starUpgrades: {
          $sum: { $cond: [{ $eq: ["$fusionType", "star_upgrade"] }, 1, 0] }
        }
      }
    },
    { $sort: { "_id": 1 } }
  ]);
};

fusionHistorySchema.statics.getServerFusionLeaderboard = function(
  serverId: string,
  limit: number = 100,
  timeframe: "daily" | "weekly" | "monthly" | "all" = "all"
) {
  let matchQuery: any = { serverId, success: true };
  
  if (timeframe !== "all") {
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case "daily":
        startDate.setDate(now.getDate() - 1);
        break;
      case "weekly":
        startDate.setDate(now.getDate() - 7);
        break;
      case "monthly":
        startDate.setMonth(now.getMonth() - 1);
        break;
    }
    
    matchQuery.timestamp = { $gte: startDate };
  }

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$playerId",
        totalFusions: { $sum: 1 },
        totalPowerGained: { $sum: "$powerGained" },
        totalGoldSpent: { $sum: "$cost.gold" },
        ascendedCount: {
          $sum: { $cond: [{ $eq: ["$toRarity", "Ascended"] }, 1, 0] }
        },
        maxStarAchieved: { $max: "$toStars" },
        lastFusion: { $max: "$timestamp" }
      }
    },
    { $sort: { totalPowerGained: -1 } },
    { $limit: limit }
  ]);
};

// Pre-save middleware pour calculer automatiquement le type de fusion
fusionHistorySchema.pre("save", function(next) {
  if (this.fromRarity !== this.toRarity) {
    this.fusionType = "rarity_upgrade";
  } else if (this.fromStars !== this.toStars) {
    this.fusionType = "star_upgrade";
  }
  next();
});

// Virtual pour affichage formaté
fusionHistorySchema.virtual("displayLevel").get(function() {
  const stars = this.toStars > 0 ? ` ${this.toStars}★` : "";
  return `${this.toRarity}${stars}`;
});

// Méthode pour nettoyer l'historique ancien (optionnel)
fusionHistorySchema.statics.cleanOldHistory = function(daysToKeep: number = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  return this.deleteMany({ timestamp: { $lt: cutoffDate } });
};

export default mongoose.model<IFusionHistoryDocument>("FusionHistory", fusionHistorySchema);

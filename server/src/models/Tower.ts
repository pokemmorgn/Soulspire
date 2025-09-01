import mongoose, { Document, Schema } from "mongoose";

// Interface pour un étage de tour
export interface ITowerFloor {
  floor: number;
  enemyConfig: {
    baseLevel: number;
    enemyCount: number;
    bossFloor: boolean; // Tous les 10 étages
    specialRules?: string[]; // ["no_healing", "double_speed", etc.]
  };
  rewards: {
    baseGold: number;
    baseExp: number;
    dropItems?: {
      itemType: "equipment" | "fragment" | "material";
      itemId?: string;
      quantity: number;
      dropRate: number; // 0-1
    }[];
    firstClearBonus?: {
      gold: number;
      gems?: number;
      items?: string[];
    };
  };
  difficultyMultiplier: number; // Augmente avec l'étage
}

// Interface pour la progression d'un joueur dans la tour
export interface ITowerProgress {
  _id?: string;
  playerId: string;
  serverId: string;
  
  // Progression
  currentFloor: number;
  highestFloor: number;
  totalClears: number;
  
  // Statistiques
  stats: {
    totalDamageDealt: number;
    totalBattlesWon: number;
    totalTimeSpent: number; // en millisecondes
    averageFloorTime: number;
    longestStreak: number; // étages consécutifs sans défaite
  };
  
  // Récompenses accumulées
  rewards: {
    totalGoldEarned: number;
    totalExpGained: number;
    itemsObtained: string[];
  };
  
  // État actuel
  currentRun: {
    startFloor: number;
    currentFloor: number;
    isActive: boolean;
    startTime?: Date;
    heroTeam: string[]; // IDs des héros utilisés
    consumablesUsed: number;
  };
  
  // Historique des runs
  runHistory: {
    runId: string;
    startFloor: number;
    endFloor: number;
    result: "completed" | "defeated" | "abandoned";
    duration: number;
    rewardsEarned: {
      gold: number;
      exp: number;
      items: string[];
    };
    completedAt: Date;
  }[];
}

// Interface pour le classement de la tour
export interface ITowerRanking {
  _id?: string;
  serverId: string;
  season: string; // "2025-09", format YYYY-MM
  
  rankings: {
    playerId: string;
    playerName: string;
    highestFloor: number;
    totalClears: number;
    lastClearTime: Date;
    rank: number;
  }[];
  
  seasonStart: Date;
  seasonEnd: Date;
  isActive: boolean;
}

interface ITowerProgressDocument extends Document {
  playerId: string;
  serverId: string;
  currentFloor: number;
  highestFloor: number;
  totalClears: number;
  stats: {
    totalDamageDealt: number;
    totalBattlesWon: number;
    totalTimeSpent: number;
    averageFloorTime: number;
    longestStreak: number;
  };
  rewards: {
    totalGoldEarned: number;
    totalExpGained: number;
    itemsObtained: string[];
  };
  currentRun: {
    startFloor: number;
    currentFloor: number;
    isActive: boolean;
    startTime?: Date;
    heroTeam: string[];
    consumablesUsed: number;
  };
  runHistory: {
    runId: string;
    startFloor: number;
    endFloor: number;
    result: "completed" | "defeated" | "abandoned";
    duration: number;
    rewardsEarned: {
      gold: number;
      exp: number;
      items: string[];
    };
    completedAt: Date;
  }[];
  
  // Méthodes d'instance
  startNewRun(startFloor: number, heroTeam: string[]): void;
  completeFloor(floorRewards: any): Promise<ITowerProgressDocument>;
  endRun(result: "completed" | "defeated" | "abandoned"): Promise<ITowerProgressDocument>;
  getPlayerRank(serverId: string): Promise<number>;
}

interface ITowerRankingDocument extends Document {
  serverId: string;
  season: string;
  rankings: {
    playerId: string;
    playerName: string;
    highestFloor: number;
    totalClears: number;
    lastClearTime: Date;
    rank: number;
  }[];
  seasonStart: Date;
  seasonEnd: Date;
  isActive: boolean;
  
  // Méthodes d'instance
  updatePlayerRank(playerId: string, playerName: string, highestFloor: number, totalClears: number): Promise<ITowerRankingDocument>;
  calculateRanks(): Promise<ITowerRankingDocument>;
}

// Schéma TowerProgress
const towerProgressSchema = new Schema<ITowerProgressDocument>({
  playerId: { 
    type: String, 
    required: true 
  },
  serverId: { 
    type: String,
    required: true,
    match: /^S\d+$/
  },
  
  currentFloor: { 
    type: Number, 
    default: 1,
    min: 1
  },
  highestFloor: { 
    type: Number, 
    default: 1,
    min: 1
  },
  totalClears: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  stats: {
    totalDamageDealt: { type: Number, default: 0 },
    totalBattlesWon: { type: Number, default: 0 },
    totalTimeSpent: { type: Number, default: 0 },
    averageFloorTime: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 }
  },
  
  rewards: {
    totalGoldEarned: { type: Number, default: 0 },
    totalExpGained: { type: Number, default: 0 },
    itemsObtained: [{ type: String }]
  },
  
  currentRun: {
    startFloor: { type: Number, default: 1 },
    currentFloor: { type: Number, default: 1 },
    isActive: { type: Boolean, default: false },
    startTime: { type: Date },
    heroTeam: [{ type: String }],
    consumablesUsed: { type: Number, default: 0 }
  },
  
  runHistory: [{
    runId: { type: String, required: true },
    startFloor: { type: Number, required: true },
    endFloor: { type: Number, required: true },
    result: { 
      type: String, 
      enum: ["completed", "defeated", "abandoned"],
      required: true 
    },
    duration: { type: Number, required: true }, // millisecondes
    rewardsEarned: {
      gold: { type: Number, default: 0 },
      exp: { type: Number, default: 0 },
      items: [{ type: String }]
    },
    completedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
  collection: 'towerprogress'
});

// Schéma TowerRanking
const towerRankingSchema = new Schema<ITowerRankingDocument>({
  serverId: { 
    type: String,
    required: true,
    match: /^S\d+$/
  },
  season: { 
    type: String, 
    required: true,
    match: /^\d{4}-\d{2}$/
  },
  
  rankings: [{
    playerId: { type: String, required: true },
    playerName: { type: String, required: true },
    highestFloor: { type: Number, required: true, min: 1 },
    totalClears: { type: Number, required: true, min: 0 },
    lastClearTime: { type: Date, required: true },
    rank: { type: Number, required: true, min: 1 }
  }],
  
  seasonStart: { type: Date, required: true },
  seasonEnd: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  collection: 'towerrankings'
});

// Index pour optimiser les requêtes
towerProgressSchema.index({ playerId: 1, serverId: 1 }, { unique: true });
towerProgressSchema.index({ serverId: 1, highestFloor: -1 });
towerProgressSchema.index({ serverId: 1, currentFloor: -1 });

towerRankingSchema.index({ serverId: 1, season: 1 }, { unique: true });
towerRankingSchema.index({ serverId: 1, isActive: 1 });

// Méthodes statiques TowerProgress
towerProgressSchema.statics.getServerLeaderboard = function(serverId: string, limit: number = 100) {
  return this.find({ serverId })
    .sort({ highestFloor: -1, totalClears: -1 })
    .limit(limit)
    .populate('playerId', 'username');
};

towerProgressSchema.statics.getPlayerProgress = function(playerId: string, serverId: string) {
  return this.findOne({ playerId, serverId });
};

// Méthodes d'instance TowerProgress
towerProgressSchema.methods.startNewRun = function(startFloor: number, heroTeam: string[]) {
  this.currentRun = {
    startFloor: startFloor,
    currentFloor: startFloor,
    isActive: true,
    startTime: new Date(),
    heroTeam: heroTeam,
    consumablesUsed: 0
  };
  
  console.log(`🗼 ${this.playerId} démarre un run étage ${startFloor}`);
};

towerProgressSchema.methods.completeFloor = function(floorRewards: any) {
  // Mettre à jour la progression
  this.currentRun.currentFloor += 1;
  this.currentFloor = this.currentRun.currentFloor;
  
  if (this.currentFloor > this.highestFloor) {
    this.highestFloor = this.currentFloor;
  }
  
  this.totalClears += 1;
  
  // Ajouter les récompenses
  this.rewards.totalGoldEarned += floorRewards.gold || 0;
  this.rewards.totalExpGained += floorRewards.exp || 0;
  if (floorRewards.items) {
    this.rewards.itemsObtained.push(...floorRewards.items);
  }
  
  return this.save();
};

towerProgressSchema.methods.endRun = function(result: "completed" | "defeated" | "abandoned") {
  if (!this.currentRun.isActive) return this.save();
  
  const duration = this.currentRun.startTime ? 
    Date.now() - this.currentRun.startTime.getTime() : 0;
  
  // Ajouter à l'historique
  const runRecord = {
    runId: new mongoose.Types.ObjectId().toString(),
    startFloor: this.currentRun.startFloor,
    endFloor: this.currentRun.currentFloor - 1,
    result: result,
    duration: duration,
    rewardsEarned: {
      gold: 0, // À calculer selon les étages complétés
      exp: 0,
      items: []
    },
    completedAt: new Date()
  };
  
  this.runHistory.push(runRecord);
  
  // Réinitialiser le run actuel
  this.currentRun.isActive = false;
  this.currentRun.startTime = undefined;
  
  // Mettre à jour les statistiques
  this.stats.totalTimeSpent += duration;
  if (this.runHistory.length > 0) {
    this.stats.averageFloorTime = this.stats.totalTimeSpent / this.totalClears;
  }
  
  console.log(`🏁 Run terminé: ${result}, étages ${runRecord.startFloor}-${runRecord.endFloor}`);
  
  return this.save();
};

towerProgressSchema.methods.getPlayerRank = async function(serverId: string): Promise<number> {
  const Model = this.constructor as any;
  const playersAbove = await Model.countDocuments({
    serverId: serverId,
    $or: [
      { highestFloor: { $gt: this.highestFloor } },
      { 
        highestFloor: this.highestFloor,
        totalClears: { $gt: this.totalClears }
      }
    ]
  });
  
  return playersAbove + 1;
};

// Méthodes d'instance TowerRanking
towerRankingSchema.methods.updatePlayerRank = function(
  playerId: string, 
  playerName: string, 
  highestFloor: number, 
  totalClears: number
) {
  const existingIndex = this.rankings.findIndex((r: any) => r.playerId === playerId);
  
  const playerRank = {
    playerId,
    playerName,
    highestFloor,
    totalClears,
    lastClearTime: new Date(),
    rank: 1 // Sera recalculé
  };
  
  if (existingIndex >= 0) {
    this.rankings[existingIndex] = playerRank;
  } else {
    this.rankings.push(playerRank);
  }
  
  return this.calculateRanks();
};

towerRankingSchema.methods.calculateRanks = function() {
  // Trier par étage puis par nombre de clears
  this.rankings.sort((a: any, b: any) => {
    if (b.highestFloor !== a.highestFloor) {
      return b.highestFloor - a.highestFloor;
    }
    return b.totalClears - a.totalClears;
  });
  
  // Assigner les rangs
  this.rankings.forEach((ranking: any, index: number) => {
    ranking.rank = index + 1;
  });
  
  return this.save();
};

// Configuration des étages (statique)
export class TowerFloorConfig {
  static getFloorConfig(floor: number): ITowerFloor {
    const isBossFloor = floor % 10 === 0;
    const difficultyTier = Math.floor((floor - 1) / 10); // 0, 1, 2, 3...
    
    return {
      floor: floor,
      enemyConfig: {
        baseLevel: Math.min(100, 5 + floor * 2),
        enemyCount: isBossFloor ? 1 : Math.min(4, 2 + Math.floor(floor / 20)),
        bossFloor: isBossFloor,
        specialRules: this.getSpecialRules(floor)
      },
      rewards: {
        baseGold: 50 + floor * 10,
        baseExp: 25 + floor * 5,
        dropItems: this.getFloorDrops(floor),
        firstClearBonus: isBossFloor ? {
          gold: 500 + floor * 50,
          gems: Math.floor(floor / 10),
          items: [`boss_reward_${Math.floor(floor / 10)}`]
        } : undefined
      },
      difficultyMultiplier: 1 + (floor - 1) * 0.05
    };
  }
  
  private static getSpecialRules(floor: number): string[] {
    const rules = [];
    if (floor >= 25 && floor % 5 === 0) rules.push("increased_speed");
    if (floor >= 50 && floor % 10 === 0) rules.push("no_healing");
    if (floor >= 100 && floor % 20 === 0) rules.push("double_damage");
    return rules;
  }
  
  private static getFloorDrops(floor: number) {
    const drops = [];
    
    // Drop d'équipement rare tous les 5 étages
    if (floor % 5 === 0) {
      drops.push({
        itemType: "equipment" as const,
        quantity: 1,
        dropRate: 0.3
      });
    }
    
    // Fragments de héros tous les 10 étages
    if (floor % 10 === 0) {
      drops.push({
        itemType: "fragment" as const,
        quantity: 5,
        dropRate: 0.5
      });
    }
    
    return drops;
  }
}

export const TowerProgress = mongoose.model<ITowerProgressDocument>("TowerProgress", towerProgressSchema);
export const TowerRanking = mongoose.model<ITowerRankingDocument>("TowerRanking", towerRankingSchema);

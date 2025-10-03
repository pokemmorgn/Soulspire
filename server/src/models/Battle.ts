import mongoose, { Document, Schema } from "mongoose";

export interface IBattleParticipant {
  heroId: string;
  name: string;
  position: number;  // ✅ NOUVEAU : Position dans la formation (1-5)
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
  level: number;
  stars: number;
  
  stats: {
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    speed: number;
  };
  
  currentHp: number;
  energy: number;
  status: {
    alive: boolean;
    buffs: string[];
    debuffs: string[];
  };
}

export interface IBattleAction {
  turn: number;
  waveNumber?: number;
  actionType: "attack" | "skill" | "ultimate" | "passive";
  actorId: string;
  actorName: string;
  targetIds: string[];
  
  damage?: number;
  healing?: number;
  energyGain?: number;
  energyCost?: number;
  
  buffsApplied?: string[];
  debuffsApplied?: string[];
  
  critical: boolean;
  elementalAdvantage?: number;
  
  participantsAfter: {
    [heroId: string]: {
      currentHp: number;
      energy: number;
      buffs: string[];
      debuffs: string[];
      alive: boolean;
    };
  };
}

export interface IWaveData {
  totalWaves: number;                    // Nombre total de vagues
  completedWaves: number;                // Vagues terminées
  currentWave: number;                   // Vague en cours
  waveRewards: {                         // Récompenses par vague
    waveNumber: number;
    rewards: {
      experience: number;
      gold: number;
      items?: string[];
      fragments?: { heroId: string; quantity: number }[];
    };
  }[];
  playerStatePerWave?: {                 // État de l'équipe à la fin de chaque vague
    waveNumber: number;
    heroes: {
      heroId: string;
      currentHp: number;
      energy: number;
      alive: boolean;
    }[];
  }[];
}

export interface IBattleOptions {
  mode: "auto" | "manual";
  speed: 1 | 2 | 3;
  playerVipLevel?: number;
}

export interface IBattleResult {
  victory: boolean;
  winnerTeam: "player" | "enemy";
  totalTurns: number;
  battleDuration: number;
  
  rewards: {
    experience: number;
    gold: number;
    items?: string[];
    fragments?: { heroId: string; quantity: number }[];
  };
  
  stats: {
    totalDamageDealt: number;
    totalHealingDone: number;
    criticalHits: number;
    ultimatesUsed: number;
  };
}

interface IBattleDocument extends Document {
  serverId: string;
  playerId: string;
  battleType: "campaign" | "arena" | "dungeon" | "raid";
  
  playerTeam: IBattleParticipant[];
  enemyTeam: IBattleParticipant[];
  
  actions: IBattleAction[];
  result: IBattleResult;
  battleOptions: IBattleOptions;
  
  battleStarted: Date;
  battleEnded?: Date;
  status: "preparing" | "ongoing" | "completed" | "abandoned";
  
  context?: {
    worldId?: number;
    levelId?: number;
    difficulty?: "Normal" | "Hard" | "Nightmare";
    enemyType?: "normal" | "elite" | "boss";
  };
  waveData?: IWaveData;
  addAction(action: IBattleAction): Promise<IBattleDocument>;
  completeBattle(result: IBattleResult): Promise<IBattleDocument>;
  getBattleReplay(): any;
}

const participantSchema = new Schema<IBattleParticipant>({
  heroId: { type: String, required: true },
  name: { type: String, required: true },
  position: { type: Number, required: true, min: 1, max: 5 },  // ✅ NOUVEAU
  role: { 
    type: String, 
    enum: ["Tank", "DPS Melee", "DPS Ranged", "Support"],
    required: true 
  },
  element: { 
    type: String, 
    enum: ["Fire", "Water", "Wind", "Electric", "Light", "Dark"],
    required: true 
  },
  rarity: { 
    type: String, 
    enum: ["Common", "Rare", "Epic", "Legendary", "Mythic"],
    required: true 
  },
  level: { type: Number, required: true, min: 1, max: 100 },
  stars: { type: Number, required: true, min: 1, max: 6 },
  
  stats: {
    hp: { type: Number, required: true },
    maxHp: { type: Number, required: true },
    atk: { type: Number, required: true },
    def: { type: Number, required: true },
    speed: { type: Number, required: true }
  },
  
  currentHp: { type: Number, required: true },
  energy: { type: Number, default: 0, min: 0, max: 100 },
  status: {
    alive: { type: Boolean, default: true },
    buffs: [{ type: String }],
    debuffs: [{ type: String }]
  }
});

const actionSchema = new Schema<IBattleAction>({
  turn: { type: Number, required: true },
  actionType: { 
    type: String, 
    enum: ["attack", "skill", "ultimate", "passive"],
    required: true 
  },
  actorId: { type: String, required: true },
  actorName: { type: String, required: true },
  targetIds: [{ type: String, required: true }],
  
  damage: { type: Number, min: 0 },
  healing: { type: Number, min: 0 },
  energyGain: { type: Number, min: 0 },
  energyCost: { type: Number, min: 0 },
  
  buffsApplied: [{ type: String }],
  debuffsApplied: [{ type: String }],
  
  critical: { type: Boolean, default: false },
  elementalAdvantage: { type: Number, default: 1.0 },
  
  participantsAfter: {
    type: Map,
    of: {
      currentHp: { type: Number, required: true },
      energy: { type: Number, required: true },
      buffs: [{ type: String }],
      debuffs: [{ type: String }],
      alive: { type: Boolean, required: true }
    }
  }
});

const battleOptionsSchema = new Schema<IBattleOptions>({
  mode: { 
    type: String, 
    enum: ["auto", "manual"],
    required: true,
    default: "auto"
  },
  speed: { 
    type: Number, 
    enum: [1, 2, 3],
    required: true,
    default: 1
  },
  playerVipLevel: { type: Number, min: 0, max: 15, default: 0 }
});

const battleSchema = new Schema<IBattleDocument>({
  serverId: { 
    type: String,
    required: true,
    match: /^S\d+$/,
    default: "S1"
  },
  playerId: { type: String, required: true },
  battleType: { 
    type: String, 
    enum: ["campaign", "arena", "dungeon", "raid"],
    required: true 
  },
  
  playerTeam: [participantSchema],
  enemyTeam: [participantSchema],
  
  actions: [actionSchema],
  
  battleOptions: {
    type: battleOptionsSchema,
    required: true,
    default: { mode: "auto", speed: 1, playerVipLevel: 0 }
  },
  
  result: {
    victory: { type: Boolean, required: true },
    winnerTeam: { 
      type: String, 
      enum: ["player", "enemy"],
      required: true 
    },
    totalTurns: { type: Number, required: true },
    battleDuration: { type: Number, required: true },
    
    rewards: {
      experience: { type: Number, default: 0 },
      gold: { type: Number, default: 0 },
      items: [{ type: String }],
      fragments: [{
        heroId: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 }
      }]
    },
    
    stats: {
      totalDamageDealt: { type: Number, default: 0 },
      totalHealingDone: { type: Number, default: 0 },
      criticalHits: { type: Number, default: 0 },
      ultimatesUsed: { type: Number, default: 0 }
    }
  },
  
  battleStarted: { type: Date, default: Date.now },
  battleEnded: { type: Date },
  status: { 
    type: String, 
    enum: ["preparing", "ongoing", "completed", "abandoned"],
    default: "preparing"
  },
  
  context: {
    worldId: { type: Number, min: 1 },
    levelId: { type: Number, min: 1 },
    difficulty: { 
      type: String, 
      enum: ["Normal", "Hard", "Nightmare"]
    },
    enemyType: { 
      type: String, 
      enum: ["normal", "elite", "boss"]
    }
  }
},   waveData: {
    totalWaves: { type: Number, min: 1 },
    completedWaves: { type: Number, min: 0 },
    currentWave: { type: Number, min: 1 },
    waveRewards: [{
      waveNumber: { type: Number, required: true, min: 1 },
      rewards: {
        experience: { type: Number, default: 0 },
        gold: { type: Number, default: 0 },
        items: [{ type: String }],
        fragments: [{
          heroId: { type: String, required: true },
          quantity: { type: Number, required: true, min: 1 }
        }]
      }
    }],
    playerStatePerWave: [{
      waveNumber: { type: Number, required: true, min: 1 },
      heroes: [{
        heroId: { type: String, required: true },
        currentHp: { type: Number, required: true },
        energy: { type: Number, required: true },
        alive: { type: Boolean, required: true }
      }]
    }]
  }
}, {
  timestamps: true,
  collection: 'battles'
});

battleSchema.index({ playerId: 1 });
battleSchema.index({ battleType: 1 });
battleSchema.index({ status: 1 });
battleSchema.index({ createdAt: -1 });
battleSchema.index({ "context.worldId": 1, "context.levelId": 1 });
battleSchema.index({ "battleOptions.mode": 1 });
battleSchema.index({ "battleOptions.speed": 1 });

battleSchema.statics.getPlayerBattleHistory = function(playerId: string, limit: number = 50) {
  return this.find({ playerId, status: "completed" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("battleType result context battleOptions createdAt battleDuration");
};

battleSchema.statics.getPlayerStats = function(playerId: string) {
  return this.aggregate([
    { $match: { playerId, status: "completed" } },
    { $group: {
      _id: null,
      totalBattles: { $sum: 1 },
      victories: { $sum: { $cond: ["$result.victory", 1, 0] } },
      totalDamage: { $sum: "$result.stats.totalDamageDealt" },
      totalHealing: { $sum: "$result.stats.totalHealingDone" },
      criticalHits: { $sum: "$result.stats.criticalHits" },
      ultimatesUsed: { $sum: "$result.stats.ultimatesUsed" }
    }},
    { $addFields: {
      winRate: { $divide: ["$victories", "$totalBattles"] },
      avgDamagePerBattle: { $divide: ["$totalDamage", "$totalBattles"] }
    }}
  ]);
};

battleSchema.methods.addAction = function(action: IBattleAction) {
  this.actions.push(action);
  this.status = "ongoing";
  return this.save();
};

battleSchema.methods.completeBattle = function(result: IBattleResult) {
  this.result = result;
  this.status = "completed";
  this.battleEnded = new Date();
  return this.save();
};

battleSchema.methods.getBattleReplay = function() {
  return {
    battleId: this._id,
    playerTeam: this.playerTeam,
    enemyTeam: this.enemyTeam,
    actions: this.actions,
    result: this.result,
    battleOptions: this.battleOptions,
    duration: this.battleEnded?.getTime() - this.battleStarted.getTime() || 0
  };
};

export default mongoose.model<IBattleDocument>("Battle", battleSchema);

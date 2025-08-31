import mongoose, { Document, Schema } from "mongoose";

// Interface pour les participants du combat
export interface IBattleParticipant {
  heroId: string;
  name: string;
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  level: number;
  stars: number;
  
  // Stats de combat calculées
  stats: {
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    speed: number; // Détermine l'ordre d'action
  };
  
  // État du combat
  currentHp: number;
  energy: number; // 0-100, ultimate à 100
  status: {
    alive: boolean;
    buffs: string[]; // ["attack_boost", "defense_up", etc.]
    debuffs: string[]; // ["burn", "poison", "stun", etc.]
  };
}

// Interface pour une action de combat
export interface IBattleAction {
  turn: number;
  actionType: "attack" | "skill" | "ultimate" | "passive";
  actorId: string;
  actorName: string;
  targetIds: string[]; // Peut cibler plusieurs ennemis
  
  // Détails de l'action
  damage?: number;
  healing?: number;
  energyGain?: number;
  energyCost?: number;
  
  // Effets appliqués
  buffsApplied?: string[];
  debuffsApplied?: string[];
  
  // Résultat
  critical: boolean;
  elementalAdvantage?: number; // 1.0 = normal, 1.5 = avantagé, 0.75 = désavantagé
  
  // État après l'action
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

// Interface pour le résultat du combat
export interface IBattleResult {
  victory: boolean;
  winnerTeam: "player" | "enemy";
  totalTurns: number;
  battleDuration: number; // en millisecondes
  
  // Récompenses
  rewards: {
    experience: number;
    gold: number;
    items?: string[];
    fragments?: { heroId: string; quantity: number }[];
  };
  
  // Statistiques
  stats: {
    totalDamageDealt: number;
    totalHealingDone: number;
    criticalHits: number;
    ultimatesUsed: number;
  };
}

// Interface principale du document Battle
interface IBattleDocument extends Document {
  serverId: string;
  playerId: string;
  battleType: "campaign" | "arena" | "dungeon" | "raid";
  
  // Configuration du combat
  playerTeam: IBattleParticipant[];
  enemyTeam: IBattleParticipant[];
  
  // Déroulement du combat
  actions: IBattleAction[];
  result: IBattleResult;
  
  // Métadonnées
  battleStarted: Date;
  battleEnded?: Date;
  status: "preparing" | "ongoing" | "completed" | "abandoned";
  
  // Contexte (pour campagne/dungeon)
  context?: {
    worldId?: number;
    levelId?: number;
    difficulty?: "Normal" | "Hard" | "Nightmare";
    enemyType?: "normal" | "elite" | "boss";
  };

  // Méthodes d'instance
  addAction(action: IBattleAction): Promise<IBattleDocument>;
  completeBattle(result: IBattleResult): Promise<IBattleDocument>;
  getBattleReplay(): any;
}

// Schéma pour les participants
const participantSchema = new Schema<IBattleParticipant>({
  heroId: { type: String, required: true },
  name: { type: String, required: true },
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
    enum: ["Common", "Rare", "Epic", "Legendary"],
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

// Schéma pour les actions de combat
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

// Schéma principal Battle
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
}, {
  timestamps: true,
  collection: 'battles'
});

// Index pour optimiser les requêtes
battleSchema.index({ playerId: 1 });
battleSchema.index({ battleType: 1 });
battleSchema.index({ status: 1 });
battleSchema.index({ createdAt: -1 });
battleSchema.index({ "context.worldId": 1, "context.levelId": 1 });

// Méthodes statiques
battleSchema.statics.getPlayerBattleHistory = function(playerId: string, limit: number = 50) {
  return this.find({ playerId, status: "completed" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("battleType result context createdAt battleDuration");
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

// Méthodes d'instance
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
    duration: this.battleDuration || (this.battleEnded?.getTime() - this.battleStarted.getTime()) || 0
  };
};

export default mongoose.model<IBattleDocument>("Battle", battleSchema);

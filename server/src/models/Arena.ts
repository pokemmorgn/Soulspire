// server/src/models/Arena.ts

import mongoose, { Document, Schema } from "mongoose";
import { IdGenerator } from "../utils/idGenerator";
import {
  ArenaLeague,
  ArenaMatchType,
  ArenaSeasonStatus,
  IArenaPlayer,
  IArenaMatch,
  IArenaSeason,
  IArenaFormation,
  IArenaRewards,
  IArenaMatchPlayer,
  IArenaSeasonRanking
} from "../types/ArenaTypes";

// ===== INTERFACES POUR MONGOOSE =====

export interface IArenaPlayerDocument extends Document, IArenaPlayer {
  _id: string;
  
  // Méthodes d'instance
  updateRank(newRank: number): Promise<IArenaPlayerDocument>;
  addPoints(points: number): Promise<{ newPoints: number; newLeague: ArenaLeague; promoted: boolean; relegated: boolean }>;
  canStartMatch(): { allowed: boolean; reason?: string; cooldownEnds?: Date };
  setDefensiveFormation(formation: IArenaFormation): Promise<IArenaPlayerDocument>;
  addOffensiveFormation(formation: IArenaFormation): Promise<IArenaPlayerDocument>;
  claimDailyRewards(): Promise<{ rewards: any; success: boolean }>;
  resetDaily(): Promise<IArenaPlayerDocument>;
  getStats(): any;
  promoteToLeague(newLeague: ArenaLeague): Promise<IArenaPlayerDocument>;
  relegateToLeague(newLeague: ArenaLeague): Promise<IArenaPlayerDocument>;
}

export interface IArenaMatchDocument extends Document, IArenaMatch {
  _id: string;
}

export interface IArenaSeasonDocument extends Document, IArenaSeason {
  _id: string;
  
  // Méthodes d'instance
  isActive(): boolean;
  isEnding(): boolean;
  daysRemaining(): number;
  addParticipant(playerId: string): Promise<IArenaSeasonDocument>;
  recordMatch(matchId: string): Promise<IArenaSeasonDocument>;
  endSeason(): Promise<IArenaSeasonRanking[]>;
}

// ===== SCHÉMAS SECONDAIRES =====

const arenaFormationSchema = new Schema<IArenaFormation>({
  formationId: {
    type: String,
    required: true,
    default: () => IdGenerator.generateFormationId()
  },
  name: {
    type: String,
    required: true,
    maxlength: 50
  },
  heroSlots: [{
    slot: { type: Number, required: true, min: 1, max: 9 },
    heroId: { type: String, required: true },
    level: { type: Number, required: true, min: 1, max: 500 },
    stars: { type: Number, required: true, min: 1, max: 6 },
    power: { type: Number, required: true, min: 0 }
  }],
  totalPower: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: false
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  winRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const arenaRewardsSchema = new Schema<IArenaRewards>({
  winner: {
    arenaPoints: { type: Number, required: true },
    gold: { type: Number, default: 0, min: 0 },
    experience: { type: Number, default: 0, min: 0 },
    seasonTokens: { type: Number, default: 0, min: 0 },
    items: [{ type: String }]
  },
  loser: {
    arenaPoints: { type: Number, required: true },
    gold: { type: Number, default: 0, min: 0 },
    experience: { type: Number, default: 0, min: 0 },
    seasonTokens: { type: Number, default: 0, min: 0 }
  }
}, { _id: false });

const arenaMatchPlayerSchema = new Schema<IArenaMatchPlayer>({
  playerId: { type: String, required: true },
  playerName: { type: String, required: true },
  level: { type: Number, required: true, min: 1 },
  league: { 
    type: String, 
    enum: Object.values(ArenaLeague),
    required: true 
  },
  arenaPoints: { type: Number, required: true, min: 0 },
  rank: { type: Number, required: true, min: 1 },
  formation: { type: arenaFormationSchema, required: true },
  teamPower: { type: Number, required: true, min: 0 }
}, { _id: false });

const seasonRankingSchema = new Schema<IArenaSeasonRanking>({
  playerId: { type: String, required: true },
  playerName: { type: String, required: true },
  finalRank: { type: Number, required: true, min: 1 },
  finalLeague: { 
    type: String, 
    enum: Object.values(ArenaLeague),
    required: true 
  },
  finalPoints: { type: Number, required: true, min: 0 },
  totalWins: { type: Number, default: 0, min: 0 },
  totalLosses: { type: Number, default: 0, min: 0 },
  bestWinStreak: { type: Number, default: 0, min: 0 },
  rewardsClaimed: { type: Boolean, default: false }
}, { _id: false });

// ===== SCHÉMA PRINCIPAL ARENA PLAYER =====

const arenaPlayerSchema = new Schema<IArenaPlayerDocument>({
  _id: {
    type: String,
    required: true,
    default: () => IdGenerator.generateUUID()
  },
  playerId: {
    type: String,
    required: true,
    ref: 'Player'
  },
  serverId: {
    type: String,
    required: true,
    match: /^S\d+$/
  },
  
  // PROGRESSION ACTUELLE
  currentLeague: {
    type: String,
    enum: Object.values(ArenaLeague),
    default: ArenaLeague.BRONZE
  },
  arenaPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  currentRank: {
    type: Number,
    default: 999999,
    min: 1
  },
  highestRank: {
    type: Number,
    default: 999999,
    min: 1
  },
  
  // SAISON ACTUELLE
  seasonId: {
    type: String,
    required: true
  },
  seasonWins: {
    type: Number,
    default: 0,
    min: 0
  },
  seasonLosses: {
    type: Number,
    default: 0,
    min: 0
  },
  seasonWinStreak: {
    type: Number,
    default: 0,
    min: 0
  },
  seasonBestWinStreak: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // FORMATIONS
  defensiveFormation: {
    type: arenaFormationSchema,
    required: true
  },
  offensiveFormations: {
    type: [arenaFormationSchema],
    default: [],
    validate: {
      validator: function(formations: IArenaFormation[]) {
        return formations.length <= 5; // Max 5 formations offensives
      },
      message: "Maximum 5 offensive formations allowed"
    }
  },
  
  // LIMITATIONS ET COOLDOWNS
  dailyMatchesUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  lastMatchAt: {
    type: Date,
    default: Date.now
  },
  lastRewardClaimedAt: {
    type: Date,
    default: Date.now
  },
  
  // HISTORIQUE
  totalMatches: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWins: {
    type: Number,
    default: 0,
    min: 0
  },
  totalLosses: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // RÉCOMPENSES
  unclaimedDailyRewards: {
    type: Boolean,
    default: false
  },
  seasonTokens: {
    type: Number,
    default: 0,
    min: 0
  },
  lifetimeSeasonTokens: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // MÉTADONNÉES
  firstArenaMatchAt: { type: Date },
  lastPromotionAt: { type: Date },
  lastRelegationAt: { type: Date }
}, {
  timestamps: true,
  collection: 'arena_players'
});

// ===== SCHÉMA ARENA MATCH =====

const arenaMatchSchema = new Schema<IArenaMatchDocument>({
  _id: {
    type: String,
    required: true,
    default: () => IdGenerator.generateUUID()
  },
  matchId: {
    type: String,
    required: true,
    unique: true,
    default: function() { return this._id; }
  },
  serverId: {
    type: String,
    required: true,
    match: /^S\d+$/
  },
  seasonId: {
    type: String,
    required: true
  },
  
  // PARTICIPANTS
  attackerId: {
    type: String,
    required: true,
    ref: 'Player'
  },
  defenderId: {
    type: String,
    required: true,
    ref: 'Player'
  },
  attackerData: {
    type: arenaMatchPlayerSchema,
    required: true
  },
  defenderData: {
    type: arenaMatchPlayerSchema,
    required: true
  },
  
  // DÉTAILS DU COMBAT
  matchType: {
    type: String,
    enum: Object.values(ArenaMatchType),
    default: ArenaMatchType.RANKED
  },
  battleId: {
    type: String,
    required: true,
    ref: 'Battle'
  },
  battleResult: {
    victory: { type: Boolean, required: true },
    winnerTeam: { type: String, enum: ["player", "enemy"], required: true },
    totalTurns: { type: Number, required: true, min: 0 },
    battleDuration: { type: Number, required: true, min: 0 },
    rewards: {
      experience: { type: Number, default: 0 },
      gold: { type: Number, default: 0 },
      items: [{ type: String }],
      fragments: [{ type: String }]
    },
    stats: {
      totalDamageDealt: { type: Number, default: 0 },
      totalHealingDone: { type: Number, default: 0 },
      criticalHits: { type: Number, default: 0 },
      ultimatesUsed: { type: Number, default: 0 }
    }
  },
  
  // PROGRESSION
  pointsExchanged: {
    type: Number,
    required: true
  },
  attackerPointsBefore: {
    type: Number,
    required: true,
    min: 0
  },
  attackerPointsAfter: {
    type: Number,
    required: true,
    min: 0
  },
  defenderPointsBefore: {
    type: Number,
    required: true,
    min: 0
  },
  defenderPointsAfter: {
    type: Number,
    required: true,
    min: 0
  },
  
  // RÉCOMPENSES
  rewards: {
    type: arenaRewardsSchema,
    required: true
  },
  
  // MÉTADONNÉES
  duration: {
    type: Number,
    required: true,
    min: 0
  },
  isRevenge: {
    type: Boolean,
    default: false
  },
  originalMatchId: {
    type: String,
    ref: 'ArenaMatch'
  }
}, {
  timestamps: true,
  collection: 'arena_matches'
});

// ===== SCHÉMA ARENA SEASON =====

const arenaSeasonSchema = new Schema<IArenaSeasonDocument>({
  _id: {
    type: String,
    required: true,
    default: () => IdGenerator.generateUUID()
  },
  seasonId: {
    type: String,
    required: true,
    unique: true,
    default: function() { return this._id; }
  },
  serverId: {
    type: String,
    required: true,
    match: /^S\d+$/
  },
  seasonNumber: {
    type: Number,
    required: true,
    min: 1
  },
  
  // CALENDRIER
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(ArenaSeasonStatus),
    default: ArenaSeasonStatus.ACTIVE
  },
  
  // RÉCOMPENSES SPÉCIALES
  seasonTheme: {
    type: String,
    required: true,
    maxlength: 100
  },
  exclusiveRewards: {
    [ArenaLeague.BRONZE]: {
      title: { type: String, default: "Bronze Warrior" },
      avatar: { type: String, default: "bronze_avatar" },
      items: [{ type: String }],
      seasonTokens: { type: Number, default: 100 }
    },
    [ArenaLeague.SILVER]: {
      title: { type: String, default: "Silver Guardian" },
      avatar: { type: String, default: "silver_avatar" },
      items: [{ type: String }],
      seasonTokens: { type: Number, default: 250 }
    },
    [ArenaLeague.GOLD]: {
      title: { type: String, default: "Gold Champion" },
      avatar: { type: String, default: "gold_avatar" },
      items: [{ type: String }],
      seasonTokens: { type: Number, default: 500 }
    },
    [ArenaLeague.DIAMOND]: {
      title: { type: String, default: "Diamond Elite" },
      avatar: { type: String, default: "diamond_avatar" },
      items: [{ type: String }],
      seasonTokens: { type: Number, default: 1000 }
    },
    [ArenaLeague.MASTER]: {
      title: { type: String, default: "Arena Master" },
      avatar: { type: String, default: "master_avatar" },
      items: [{ type: String }],
      seasonTokens: { type: Number, default: 2000 }
    },
    [ArenaLeague.LEGENDARY]: {
      title: { type: String, default: "Legendary Hero" },
      avatar: { type: String, default: "legendary_avatar" },
      items: [{ type: String }],
      seasonTokens: { type: Number, default: 5000 }
    }
  },
  
  // STATISTIQUES
  totalParticipants: {
    type: Number,
    default: 0,
    min: 0
  },
  totalMatches: {
    type: Number,
    default: 0,
    min: 0
  },
  averageMatchesPerPlayer: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // CLASSEMENTS FINAUX
  finalRankings: {
    type: [seasonRankingSchema],
    default: []
  }
}, {
  timestamps: true,
  collection: 'arena_seasons'
});

// ===== INDEX OPTIMISÉS =====

// Index pour ArenaPlayer
arenaPlayerSchema.index({ playerId: 1, serverId: 1 }, { unique: true });

// 🔥 NOUVEAUX INDEX CRITIQUES POUR PERFORMANCE
// Index principal pour recherche d'adversaires (LE PLUS IMPORTANT)
arenaPlayerSchema.index({ 
  serverId: 1, 
  currentLeague: 1, 
  arenaPoints: -1,
  playerId: 1
}, { 
  name: "arena_matchmaking_primary",
  background: true
});

// Index pour classements temps réel
arenaPlayerSchema.index({ 
  serverId: 1, 
  arenaPoints: -1, 
  seasonWins: -1,
  seasonWinStreak: -1
}, {
  name: "arena_leaderboard",
  background: true
});

// Index pour recherche par rang
arenaPlayerSchema.index({ 
  serverId: 1, 
  currentRank: 1 
}, {
  name: "arena_by_rank",
  background: true
});

// Index pour filtres de matchmaking
arenaPlayerSchema.index({ 
  serverId: 1,
  currentLeague: 1,
  "defensiveFormation.totalPower": 1,
  arenaPoints: -1
}, {
  name: "arena_power_matchmaking",
  background: true
});

// Index pour saison et récompenses
arenaPlayerSchema.index({ 
  seasonId: 1, 
  seasonWins: -1,
  arenaPoints: -1
}, {
  name: "arena_season_ranking",
  background: true
});

// Index pour cooldowns et limitations
arenaPlayerSchema.index({ 
  serverId: 1,
  lastMatchAt: -1,
  dailyMatchesUsed: 1
}, {
  name: "arena_cooldowns",
  background: true
});

// Index pour récompenses non réclamées
arenaPlayerSchema.index({ 
  serverId: 1,
  unclaimedDailyRewards: 1 
}, {
  name: "arena_unclaimed_rewards",
  background: true
});

// Index pour ArenaMatch
arenaMatchSchema.index({ matchId: 1 }, { unique: true });

// 🔥 NOUVEAUX INDEX POUR HISTORIQUE DES MATCHS
// Index pour historique attaquant
arenaMatchSchema.index({ 
  serverId: 1, 
  attackerId: 1, 
  createdAt: -1 
}, {
  name: "arena_attacker_history",
  background: true
});

// Index pour historique défenseur
arenaMatchSchema.index({ 
  serverId: 1, 
  defenderId: 1, 
  createdAt: -1 
}, {
  name: "arena_defender_history",
  background: true
});

// Index pour combats de vengeance
arenaMatchSchema.index({ 
  serverId: 1,
  defenderId: 1,
  isRevenge: 1,
  createdAt: -1
}, {
  name: "arena_revenge_matches",
  background: true
});

// Index pour statistiques de combat
arenaMatchSchema.index({ 
  serverId: 1,
  seasonId: 1,
  "battleResult.victory": 1,
  createdAt: -1
}, {
  name: "arena_battle_stats",
  background: true
});

// Index pour recherche par battle ID
arenaMatchSchema.index({ 
  battleId: 1,
  serverId: 1
}, {
  name: "arena_battle_lookup",
  background: true
});

// Index pour ArenaSeason
arenaSeasonSchema.index({ seasonId: 1 }, { unique: true });
arenaSeasonSchema.index({ 
  serverId: 1, 
  status: 1,
  startDate: -1
}, {
  name: "arena_season_active",
  background: true
});

arenaSeasonSchema.index({ 
  serverId: 1,
  seasonNumber: -1 
}, {
  name: "arena_season_history",
  background: true
});

// ===== MÉTHODES STATIQUES =====

// ArenaPlayer statics
arenaPlayerSchema.statics.findByPlayer = function(playerId: string, serverId: string) {
  return this.findOne({ playerId, serverId });
};

arenaPlayerSchema.statics.getLeaderboard = function(serverId: string, league?: ArenaLeague, limit: number = 100) {
  const query: any = { serverId };
  if (league) query.currentLeague = league;
  
  return this.find(query)
    .sort({ arenaPoints: -1, seasonWins: -1 })
    .limit(limit)
    .populate('playerId', 'displayName level');
};

arenaPlayerSchema.statics.findOpponents = function(
  playerId: string, 
  serverId: string, 
  league: ArenaLeague,
  limit: number = 10
) {
  return this.find({
    serverId,
    playerId: { $ne: playerId },
    currentLeague: league
  })
    .sort({ arenaPoints: -1 })
    .limit(limit)
    .populate('playerId', 'displayName level lastSeenAt');
};

// ArenaMatch statics
arenaMatchSchema.statics.getPlayerHistory = function(playerId: string, serverId: string, limit: number = 20) {
  return this.find({
    serverId,
    $or: [{ attackerId: playerId }, { defenderId: playerId }]
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

arenaMatchSchema.statics.getRevengeMatches = function(playerId: string, serverId: string) {
  return this.find({
    serverId,
    defenderId: playerId,
    'battleResult.victory': false,
    isRevenge: false,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Dernières 24h
  });
};

// ArenaSeason statics
arenaSeasonSchema.statics.getCurrentSeason = function(serverId: string) {
  return this.findOne({
    serverId,
    status: ArenaSeasonStatus.ACTIVE
  });
};

arenaSeasonSchema.statics.getPreviousSeasons = function(serverId: string, limit: number = 5) {
  return this.find({
    serverId,
    status: ArenaSeasonStatus.ENDED
  })
    .sort({ seasonNumber: -1 })
    .limit(limit);
};

// ===== MÉTHODES D'INSTANCE =====

// ArenaPlayer methods
arenaPlayerSchema.methods.updateRank = function(newRank: number) {
  if (newRank < this.highestRank) {
    this.highestRank = newRank;
  }
  this.currentRank = newRank;
  return this.save();
};

arenaPlayerSchema.methods.addPoints = function(points: number) {
  const oldPoints = this.arenaPoints;
  const oldLeague = this.currentLeague;
  
  this.arenaPoints = Math.max(0, this.arenaPoints + points);
  
  // Déterminer la nouvelle ligue
  const newLeague = this.determineLeague(this.arenaPoints);
  const promoted = newLeague !== oldLeague && this.getLeagueRank(newLeague) > this.getLeagueRank(oldLeague);
  const relegated = newLeague !== oldLeague && this.getLeagueRank(newLeague) < this.getLeagueRank(oldLeague);
  
  if (promoted) {
    this.currentLeague = newLeague;
    this.lastPromotionAt = new Date();
  } else if (relegated) {
    this.currentLeague = newLeague;
    this.lastRelegationAt = new Date();
  }
  
  return this.save().then(() => ({
    newPoints: this.arenaPoints,
    newLeague: this.currentLeague,
    promoted,
    relegated
  }));
};

arenaPlayerSchema.methods.canStartMatch = function() {
  const now = new Date();
  const cooldown = 5 * 60 * 1000; // 5 minutes entre chaque combat
  const timeSinceLastMatch = now.getTime() - this.lastMatchAt.getTime();
  
  if (timeSinceLastMatch < cooldown) {
    return {
      allowed: false,
      reason: "Match cooldown active",
      cooldownEnds: new Date(this.lastMatchAt.getTime() + cooldown)
    };
  }
  
  // Vérifier limite quotidienne (dépend de la ligue)
  const maxDaily = this.getMaxDailyMatches();
  if (this.dailyMatchesUsed >= maxDaily) {
    return {
      allowed: false,
      reason: "Daily match limit reached",
      cooldownEnds: this.getNextDailyReset()
    };
  }
  
  return { allowed: true };
};

arenaPlayerSchema.methods.setDefensiveFormation = function(formation: IArenaFormation) {
  this.defensiveFormation = formation;
  return this.save();
};

arenaPlayerSchema.methods.addOffensiveFormation = function(formation: IArenaFormation) {
  if (this.offensiveFormations.length >= 5) {
    this.offensiveFormations.shift(); // Retire la plus ancienne
  }
  this.offensiveFormations.push(formation);
  return this.save();
};

arenaPlayerSchema.methods.claimDailyRewards = function() {
  if (!this.unclaimedDailyRewards) {
    return Promise.resolve({ rewards: null, success: false });
  }
  
  const rewards = this.calculateDailyRewards();
  this.unclaimedDailyRewards = false;
  this.lastRewardClaimedAt = new Date();
  
  return this.save().then(() => ({ rewards, success: true }));
};

arenaPlayerSchema.methods.resetDaily = function() {
  this.dailyMatchesUsed = 0;
  this.unclaimedDailyRewards = true;
  return this.save();
};

arenaPlayerSchema.methods.getStats = function() {
  const totalGames = this.totalWins + this.totalLosses;
  const winRate = totalGames > 0 ? (this.totalWins / totalGames) * 100 : 0;
  const seasonGames = this.seasonWins + this.seasonLosses;
  const seasonWinRate = seasonGames > 0 ? (this.seasonWins / seasonGames) * 100 : 0;
  
  return {
    currentLeague: this.currentLeague,
    currentRank: this.currentRank,
    arenaPoints: this.arenaPoints,
    seasonWins: this.seasonWins,
    seasonLosses: this.seasonLosses,
    seasonWinRate: Math.round(seasonWinRate * 100) / 100,
    seasonWinStreak: this.seasonWinStreak,
    totalWins: this.totalWins,
    totalLosses: this.totalLosses,
    totalWinRate: Math.round(winRate * 100) / 100,
    seasonTokens: this.seasonTokens,
    lifetimeTokens: this.lifetimeSeasonTokens,
    dailyMatchesRemaining: this.getMaxDailyMatches() - this.dailyMatchesUsed,
    defensivePower: this.defensiveFormation.totalPower
  };
};

// Méthodes utilitaires privées
arenaPlayerSchema.methods.determineLeague = function(points: number): ArenaLeague {
  if (points >= 5000) return ArenaLeague.LEGENDARY;
  if (points >= 4000) return ArenaLeague.MASTER;
  if (points >= 3000) return ArenaLeague.DIAMOND;
  if (points >= 2000) return ArenaLeague.GOLD;
  if (points >= 1000) return ArenaLeague.SILVER;
  return ArenaLeague.BRONZE;
};

arenaPlayerSchema.methods.getLeagueRank = function(league: ArenaLeague): number {
  const ranks = {
    [ArenaLeague.BRONZE]: 1,
    [ArenaLeague.SILVER]: 2,
    [ArenaLeague.GOLD]: 3,
    [ArenaLeague.DIAMOND]: 4,
    [ArenaLeague.MASTER]: 5,
    [ArenaLeague.LEGENDARY]: 6
  };
  return ranks[league];
};

arenaPlayerSchema.methods.getMaxDailyMatches = function(): number {
  const limits: Record<ArenaLeague, number> = {
    [ArenaLeague.BRONZE]: 10,
    [ArenaLeague.SILVER]: 12,
    [ArenaLeague.GOLD]: 15,
    [ArenaLeague.DIAMOND]: 18,
    [ArenaLeague.MASTER]: 20,
    [ArenaLeague.LEGENDARY]: 25
  };
  return limits[this.currentLeague as ArenaLeague] || 10;
};

arenaPlayerSchema.methods.calculateDailyRewards = function() {
  const currentLeague = this.currentLeague as ArenaLeague;
  const rewards: Record<ArenaLeague, { gold: number; gems: number; seasonTokens: number }> = {
    [ArenaLeague.BRONZE]: { gold: 100, gems: 5, seasonTokens: 10 },
    [ArenaLeague.SILVER]: { gold: 200, gems: 10, seasonTokens: 20 },
    [ArenaLeague.GOLD]: { gold: 300, gems: 15, seasonTokens: 30 },
    [ArenaLeague.DIAMOND]: { gold: 500, gems: 25, seasonTokens: 50 },
    [ArenaLeague.MASTER]: { gold: 750, gems: 40, seasonTokens: 75 },
    [ArenaLeague.LEGENDARY]: { gold: 1000, gems: 60, seasonTokens: 100 }
  };
  return rewards[currentLeague] || rewards[ArenaLeague.BRONZE];
};

arenaPlayerSchema.methods.getNextDailyReset = function(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
};

// ArenaSeason methods
arenaSeasonSchema.methods.isActive = function() {
  return this.status === ArenaSeasonStatus.ACTIVE;
};

arenaSeasonSchema.methods.isEnding = function() {
  const daysLeft = this.daysRemaining();
  return daysLeft <= 7 && this.status === ArenaSeasonStatus.ACTIVE;
};

arenaSeasonSchema.methods.daysRemaining = function() {
  const now = new Date();
  const diffTime = this.endDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

arenaSeasonSchema.methods.addParticipant = function(playerId: string) {
  this.totalParticipants += 1;
  return this.save();
};

arenaSeasonSchema.methods.recordMatch = function(matchId: string) {
  this.totalMatches += 1;
  if (this.totalParticipants > 0) {
    this.averageMatchesPerPlayer = this.totalMatches / this.totalParticipants;
  }
  return this.save();
};

// ===== EXPORT DES MODÈLES =====

export const ArenaPlayer = mongoose.model<IArenaPlayerDocument>("ArenaPlayer", arenaPlayerSchema);
export const ArenaMatch = mongoose.model<IArenaMatchDocument>("ArenaMatch", arenaMatchSchema);
export const ArenaSeason = mongoose.model<IArenaSeasonDocument>("ArenaSeason", arenaSeasonSchema);

export default {
  ArenaPlayer,
  ArenaMatch,
  ArenaSeason
};

// server/src/types/ArenaTypes.ts

/**
 * SYSTÈME D'ARÈNE PVP - TYPES ET INTERFACES
 * Inspiré d'AFK Arena avec ligues, saisons, et récompenses
 */

import { IBattleParticipant, IBattleResult } from "../models/Battle";

// ===== ÉNUMÉRATIONS =====

export enum ArenaLeague {
  BRONZE = "Bronze",
  SILVER = "Silver", 
  GOLD = "Gold",
  DIAMOND = "Diamond",
  MASTER = "Master",
  LEGENDARY = "Legendary"
}

export enum ArenaMatchType {
  RANKED = "ranked",           // Combat classé normal
  REVENGE = "revenge",         // Combat de vengeance
  PRACTICE = "practice"        // Combat d'entraînement (sans coût)
}

export enum ArenaSeasonStatus {
  ACTIVE = "active",
  ENDING = "ending",           // Derniers jours de saison
  ENDED = "ended",
  PREPARING = "preparing"      // Nouvelle saison en préparation
}

// ===== INTERFACES PRINCIPALES =====

/**
 * Configuration d'une ligue d'arène
 */
export interface ArenaLeagueConfig {
  league: ArenaLeague;
  minPoints: number;
  maxPoints: number;
  promotionThreshold: number;   // Points nécessaires pour monter
  relegationThreshold: number;  // Points en dessous desquels on descend
  dailyReward: {
    gold: number;
    gems: number;
    tickets: number;
    seasonTokens: number;       // Monnaie spéciale arène
  };
  seasonEndReward: {
    gold: number;
    gems: number;
    exclusiveItems: string[];   // IDs d'objets exclusifs
    seasonTokens: number;
  };
  matchCost: {
    tickets: number;            // Coût en tickets d'arène
    gold?: number;              // Coût optionnel en or
  };
  victoriesForPromotion: number; // Victoires consécutives requises pour monter
  maxDailyMatches: number;      // Limite quotidienne de combats
}

/**
 * Données d'arène pour un joueur
 */
export interface IArenaPlayer {
  playerId: string;
  serverId: string;
  
  // PROGRESSION ACTUELLE
  currentLeague: ArenaLeague;
  arenaPoints: number;
  currentRank: number;          // Rang dans la ligue
  highestRank: number;          // Meilleur rang historique
  
  // SAISON ACTUELLE
  seasonId: string;
  seasonWins: number;
  seasonLosses: number;
  seasonWinStreak: number;      // Série de victoires actuelles
  seasonBestWinStreak: number;  // Meilleure série de la saison
  
  // FORMATIONS DÉFENSIVES
  defensiveFormation: IArenaFormation;
  offensiveFormations: IArenaFormation[]; // Formations pour attaquer
  
  // LIMITATIONS ET COOLDOWNS
  dailyMatchesUsed: number;
  lastMatchAt: Date;
  lastRewardClaimedAt: Date;
  
  // HISTORIQUE
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  
  // RÉCOMPENSES
  unclaimedDailyRewards: boolean;
  seasonTokens: number;         // Monnaie d'arène accumulée
  lifetimeSeasonTokens: number; // Total historique
  
  // MÉTADONNÉES
  firstArenaMatchAt?: Date;
  lastPromotionAt?: Date;
  lastRelegationAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Formation d'arène avec métadonnées
 */
export interface IArenaFormation {
  formationId: string;
  name: string;
  heroSlots: Array<{
    slot: number;               // Position 1-9
    heroId: string;
    level: number;
    stars: number;
    power: number;              // Puissance calculée du héros
  }>;
  totalPower: number;           // Puissance totale de la formation
  isActive: boolean;            // Formation actuellement utilisée
  lastUsedAt: Date;
  winRate?: number;             // Taux de victoire avec cette formation
  createdAt: Date;
}

/**
 * Match d'arène complet
 */
export interface IArenaMatch {
  matchId: string;
  serverId: string;
  seasonId: string;
  
  // PARTICIPANTS
  attackerId: string;
  defenderId: string;
  attackerData: IArenaMatchPlayer;
  defenderData: IArenaMatchPlayer;
  
  // DÉTAILS DU COMBAT
  matchType: ArenaMatchType;
  battleId: string;             // Référence au combat dans Battle collection
  battleResult: IBattleResult;
  
  // PROGRESSION
  pointsExchanged: number;      // Points gagnés/perdus
  attackerPointsBefore: number;
  attackerPointsAfter: number;
  defenderPointsBefore: number;
  defenderPointsAfter: number;
  
  // RÉCOMPENSES
  rewards: IArenaRewards;
  
  // MÉTADONNÉES
  duration: number;             // Durée en millisecondes
  createdAt: Date;
  isRevenge: boolean;           // Combat de vengeance
  originalMatchId?: string;     // Si c'est une vengeance
}

/**
 * Données d'un joueur dans un match
 */
export interface IArenaMatchPlayer {
  playerId: string;
  playerName: string;
  level: number;
  league: ArenaLeague;
  arenaPoints: number;
  rank: number;
  formation: IArenaFormation;
  teamPower: number;
}

/**
 * Récompenses d'un match d'arène
 */
export interface IArenaRewards {
  winner: {
    arenaPoints: number;
    gold: number;
    experience: number;
    seasonTokens: number;
    items?: string[];
  };
  loser: {
    arenaPoints: number;        // Généralement négatif
    gold: number;               // Compensation minime
    experience: number;         // XP réduite
    seasonTokens: number;       // Tokens réduits
  };
}

/**
 * Saison d'arène
 */
export interface IArenaSeason {
  seasonId: string;
  serverId: string;
  seasonNumber: number;
  
  // CALENDRIER
  startDate: Date;
  endDate: Date;
  status: ArenaSeasonStatus;
  
  // RÉCOMPENSES SPÉCIALES
  seasonTheme: string;          // Thème de la saison
  exclusiveRewards: {
    [key in ArenaLeague]: {
      title: string;            // Titre exclusif
      avatar: string;           // Avatar exclusif
      items: string[];          // Objets exclusifs
      seasonTokens: number;
    };
  };
  
  // STATISTIQUES
  totalParticipants: number;
  totalMatches: number;
  averageMatchesPerPlayer: number;
  
  // CLASSEMENTS FINAUX (sauvegardés en fin de saison)
  finalRankings?: IArenaSeasonRanking[];
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Classement final d'une saison
 */
export interface IArenaSeasonRanking {
  playerId: string;
  playerName: string;
  finalRank: number;
  finalLeague: ArenaLeague;
  finalPoints: number;
  totalWins: number;
  totalLosses: number;
  bestWinStreak: number;
  rewardsClaimed: boolean;
}

/**
 * Adversaire potentiel dans l'arène
 */
export interface IArenaOpponent {
  playerId: string;
  playerName: string;
  level: number;
  league: ArenaLeague;
  arenaPoints: number;
  rank: number;
  defensiveFormation: IArenaFormation;
  winRate: number;              // Taux de victoire général
  lastSeenAt: Date;
  isOnline: boolean;
  canAttack: boolean;           // Vérifie cooldowns et limitations
  estimatedDifficulty: "easy" | "medium" | "hard"; // Difficulté estimée
  pointsGainOnWin: number;      // Points gagnés si victoire
  pointsLostOnDefeat: number;   // Points perdus si défaite
}

/**
 * Recherche d'adversaires avec filtres
 */
export interface IArenaOpponentSearch {
  playerId: string;
  serverId: string;
  filters: {
    league?: ArenaLeague;
    minPower?: number;
    maxPower?: number;
    difficulty?: "easy" | "medium" | "hard";
    excludeRecent?: boolean;    // Exclure adversaires récents
    onlineOnly?: boolean;
  };
  limit: number;
}

/**
 * Statistiques d'arène d'un joueur
 */
export interface IArenaPlayerStats {
  // PROGRESSION ACTUELLE
  currentLeague: ArenaLeague;
  currentRank: number;
  arenaPoints: number;
  
  // SAISON ACTUELLE
  seasonWins: number;
  seasonLosses: number;
  seasonWinRate: number;
  seasonWinStreak: number;
  
  // HISTORIQUE GLOBAL
  totalSeasons: number;
  totalWins: number;
  totalLosses: number;
  totalWinRate: number;
  bestRankEver: number;
  bestLeagueEver: ArenaLeague;
  
  // FORMATIONS
  defensivePower: number;
  bestOffensivePower: number;
  formationsCount: number;
  
  // RÉCOMPENSES
  seasonTokens: number;
  lifetimeTokens: number;
  unclaimedRewards: boolean;
  
  // ACTIVITÉ
  lastMatchAt: Date;
  dailyMatchesRemaining: number;
  averageMatchDuration: number;
}

/**
 * Classement d'arène pour affichage
 */
export interface IArenaLeaderboard {
  serverId: string;
  league: ArenaLeague;
  seasonId: string;
  rankings: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    level: number;
    arenaPoints: number;
    wins: number;
    losses: number;
    winRate: number;
    winStreak: number;
    defensivePower: number;
    lastMatchAt: Date;
  }>;
  totalPlayers: number;
  lastUpdated: Date;
}

/**
 * Configuration globale de l'arène
 */
export interface IArenaConfig {
  // SYSTÈME DE POINTS
  pointCalculation: {
    basePointsPerWin: number;
    basePointsPerLoss: number;
    rankDifferenceMultiplier: number; // Multiplicateur basé sur différence de rang
    leagueBonusMultiplier: number;    // Bonus selon la ligue
  };
  
  // LIMITATIONS
  cooldowns: {
    betweenMatches: number;       // Secondes entre chaque combat
    revengeWindow: number;        // Temps pour se venger (heures)
    dailyRewardClaim: number;     // Heures entre réclamations
  };
  
  // SAISONS
  seasonDuration: number;         // Durée d'une saison en jours
  preSeasonDuration: number;      // Jours de préparation entre saisons
  
  // RECHERCHE D'ADVERSAIRES
  opponentSearch: {
    maxRankDifference: number;    // Différence de rang max
    maxPowerDifference: number;   // Différence de puissance max (%)
    searchRadius: number;         // Nombre d'adversaires retournés
    excludeRecentHours: number;   // Heures avant de revoir le même adversaire
  };
}

// ===== TYPES DE RÉPONSE API =====

export interface ArenaServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    timestamp: Date;
    serverId: string;
    seasonId?: string;
  };
}

export interface ArenaMatchResponse extends ArenaServiceResponse {
  data: {
    match: IArenaMatch;
    newRank: number;
    newPoints: number;
    newLeague: ArenaLeague;
    rewards: IArenaRewards;
    promotionInfo?: {
      promoted: boolean;
      newLeague: ArenaLeague;
      bonusRewards?: any;
    };
  };
}

export interface ArenaOpponentsResponse extends ArenaServiceResponse {
  data: {
    opponents: IArenaOpponent[];
    searchCriteria: IArenaOpponentSearch;
    playerInfo: {
      currentRank: number;
      currentPoints: number;
      dailyMatchesRemaining: number;
    };
  };
}

export interface ArenaLeaderboardResponse extends ArenaServiceResponse {
  data: IArenaLeaderboard;
}

export interface ArenaStatsResponse extends ArenaServiceResponse {
  data: IArenaPlayerStats;
}

// ===== ÉVÉNEMENTS D'ARÈNE =====

export interface ArenaEvent {
  type: "match_completed" | "promotion" | "relegation" | "season_end" | "daily_reward";
  playerId: string;
  serverId: string;
  data: any;
  timestamp: Date;
}

export interface ArenaPromotionEvent extends ArenaEvent {
  type: "promotion";
  data: {
    fromLeague: ArenaLeague;
    toLeague: ArenaLeague;
    newRank: number;
    bonusRewards: any;
  };
}

export interface ArenaMatchEvent extends ArenaEvent {
  type: "match_completed";
  data: {
    matchId: string;
    result: "win" | "loss";
    pointsChange: number;
    newRank: number;
    opponentName: string;
  };
}

// ===== VALIDATION ET UTILITAIRES =====

export interface ArenaValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

export interface ArenaMatchmaking {
  playerId: string;
  eligibleOpponents: IArenaOpponent[];
  recommendedOpponent: IArenaOpponent;
  difficulty: "easy" | "medium" | "hard";
  estimatedWinChance: number;
}

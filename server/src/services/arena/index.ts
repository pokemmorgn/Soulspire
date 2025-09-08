// server/src/services/arena/index.ts

/**
 * SYSTÈME D'ARÈNE PVP COMPLET
 * Export unifié de tous les modules d'arène
 * 
 * Architecture modulaire :
 * - ArenaCore : Fonctionnalités de base (initialisation, combat simple)
 * - ArenaMatchmaking : Recherche d'adversaires avancée
 * - ArenaCombat : Système de combat sophistiqué
 * - ArenaSeasons : Gestion des saisons et cycles
 * - ArenaRewards : Système de récompenses complet
 */

// ===== IMPORTS DES MODULES =====
export { ArenaCore } from "./ArenaCore";
export { ArenaMatchmaking } from "./ArenaMatchmaking";
export { ArenaCombat } from "./ArenaCombat";
export { ArenaSeasons } from "./ArenaSeasons";
export { ArenaRewards } from "./ArenaRewards";

// ===== CLASSE UNIFIÉE ARENA SERVICE =====

import { ArenaCore } from "./ArenaCore";
import { ArenaMatchmaking } from "./ArenaMatchmaking";
import { ArenaCombat } from "./ArenaCombat";
import { ArenaSeasons } from "./ArenaSeasons";
import { ArenaRewards } from "./ArenaRewards";
import {
  ArenaLeague,
  ArenaMatchType,
  IArenaOpponentSearch,
  ArenaServiceResponse,
  ArenaMatchResponse,
  ArenaOpponentsResponse,
  ArenaStatsResponse,
  ArenaLeaderboardResponse
} from "../../types/ArenaTypes";
import { IBattleOptions } from "../BattleEngine";

/**
 * SERVICE PRINCIPAL D'ARÈNE - FAÇADE UNIFIÉE
 * Point d'entrée unique pour toutes les fonctionnalités d'arène
 */
export class ArenaService {

  // ===== INITIALISATION ET GESTION DE BASE =====

  /**
   * Initialiser un joueur dans l'arène
   */
  static async initializePlayer(playerId: string, serverId: string) {
    return ArenaCore.initializePlayer(playerId, serverId);
  }

  /**
   * Obtenir les statistiques d'un joueur
   */
  static async getPlayerStats(playerId: string, serverId: string) {
    const { ArenaCache } = await import('./ArenaCache');
    return ArenaCache.getPlayerStats(playerId, serverId);
  }

  // ===== RECHERCHE D'ADVERSAIRES =====

  /**
   * Recherche d'adversaires simple (ArenaCore)
   */
  static async findSimpleOpponents(playerId: string, serverId: string, limit?: number) {
    return ArenaCore.findSimpleOpponents(playerId, serverId, limit);
  }

  /**
   * Recherche d'adversaires avancée (ArenaMatchmaking)
   */
  static async findAdvancedOpponents(
    playerId: string, 
    serverId: string, 
    options?: Partial<IArenaOpponentSearch>
  ) {
    return ArenaMatchmaking.findAdvancedOpponents(playerId, serverId, options);
  }

  /**
   * Recherche par difficulté
   */
  static async findOpponentsByDifficulty(
    playerId: string,
    serverId: string,
    difficulty: "easy" | "medium" | "hard",
    limit?: number
  ) {
    return ArenaMatchmaking.findOpponentsByDifficulty(playerId, serverId, difficulty, limit);
  }

  /**
   * Recherche joueurs en ligne
   */
  static async findOnlineOpponents(playerId: string, serverId: string, limit?: number) {
    return ArenaMatchmaking.findOnlineOpponents(playerId, serverId, limit);
  }

  /**
   * Recherche par ligue
   */
  static async findOpponentsByLeague(
    playerId: string,
    serverId: string,
    league: ArenaLeague,
    limit?: number
  ) {
    return ArenaMatchmaking.findOpponentsByLeague(playerId, serverId, league, limit);
  }

  /**
   * Obtenir un adversaire recommandé
   */
  static async getRecommendedOpponent(playerId: string, serverId: string) {
    return ArenaMatchmaking.getRecommendedOpponent(playerId, serverId);
  }

  /**
   * Statistiques de matchmaking
   */
  static async getMatchmakingStats(serverId: string) {
    return ArenaMatchmaking.getMatchmakingStats(serverId);
  }

  // ===== SYSTÈME DE COMBAT =====

  /**
   * Combat simple (ArenaCore)
   */
  static async startSimpleMatch(
    attackerId: string,
    serverId: string,
    defenderId: string,
    battleOptions?: IBattleOptions
  ) {
    return ArenaCore.startSimpleMatch(attackerId, serverId, defenderId, battleOptions);
  }

  /**
   * Combat avancé (ArenaCombat)
   */
  static async startAdvancedMatch(
    attackerId: string,
    serverId: string,
    defenderId: string,
    matchType?: ArenaMatchType,
    battleOptions?: IBattleOptions
  ) {
    return ArenaCombat.startAdvancedMatch(attackerId, serverId, defenderId, matchType, battleOptions);
  }

  /**
   * Combat de vengeance
   */
  static async startRevengeMatch(
    attackerId: string,
    serverId: string,
    originalMatchId: string,
    battleOptions?: IBattleOptions
  ) {
    return ArenaCombat.startRevengeMatch(attackerId, serverId, originalMatchId, battleOptions);
  }

  /**
   * Simuler un combat
   */
  static async simulateMatch(attackerId: string, serverId: string, defenderId: string) {
    return ArenaCombat.simulateMatch(attackerId, serverId, defenderId);
  }

  /**
   * Abandonner un combat
   */
  static async forfeitMatch(battleId: string, playerId: string, serverId: string) {
    return ArenaCombat.forfeitMatch(battleId, playerId, serverId);
  }

  /**
   * Historique des combats
   */
  static async getMatchHistory(playerId: string, serverId: string, limit?: number) {
    return ArenaCombat.getPlayerMatchHistory(playerId, serverId, limit);
  }

  /**
   * Combats de vengeance disponibles
   */
  static async getAvailableRevengeMatches(playerId: string, serverId: string) {
    return ArenaCombat.getAvailableRevengeMatches(playerId, serverId);
  }

  /**
   * Statistiques de combat
   */
  static async getPlayerCombatStats(playerId: string, serverId: string) {
    return ArenaCombat.getPlayerCombatStats(playerId, serverId);
  }

  // ===== GESTION DES SAISONS =====

  /**
   * Obtenir la saison actuelle
   */
  static async getCurrentSeason(serverId: string) {
    return ArenaSeasons.getCurrentSeason(serverId);
  }

  /**
   * Historique des saisons
   */
  static async getSeasonHistory(serverId: string, limit?: number) {
    return ArenaSeasons.getSeasonHistory(serverId, limit);
  }

  /**
   * Statistiques d'une saison
   */
  static async getSeasonStats(serverId: string, seasonId: string) {
    return ArenaSeasons.getSeasonStats(serverId, seasonId);
  }

  /**
   * Classement de la saison actuelle
   */
    static async getCurrentSeasonLeaderboard(
      serverId: string,
      league?: ArenaLeague,
      limit?: number
    ) {
      const { ArenaCache } = await import('./ArenaCache');
      return ArenaCache.getLeaderboard(serverId, league, limit);
    }

  /**
   * Forcer la fin d'une saison (admin)
   */
  static async forceEndSeason(serverId: string, reason?: string) {
    return ArenaSeasons.forceEndSeason(serverId, reason);
  }

  /**
   * Maintenance quotidienne des saisons
   */
  static async performSeasonMaintenance(serverId: string) {
    return ArenaSeasons.performDailyMaintenance(serverId);
  }

  // ===== SYSTÈME DE RÉCOMPENSES =====

  /**
   * Réclamer récompenses quotidiennes
   */
  static async claimDailyRewards(playerId: string, serverId: string) {
    return ArenaRewards.claimDailyRewards(playerId, serverId);
  }

  /**
   * Aperçu récompenses quotidiennes
   */
  static async getDailyRewardsPreview(playerId: string, serverId: string) {
    return ArenaRewards.getDailyRewardsPreview(playerId, serverId);
  }

  /**
   * Réclamer récompenses hebdomadaires
   */
  static async claimWeeklyRewards(playerId: string, serverId: string) {
    return ArenaRewards.claimWeeklyRewards(playerId, serverId);
  }

  /**
   * Réclamer récompenses de fin de saison
   */
  static async claimSeasonEndRewards(playerId: string, serverId: string, seasonId: string) {
    return ArenaRewards.claimSeasonEndRewards(playerId, serverId, seasonId);
  }

  /**
   * Résumé de toutes les récompenses
   */
  static async getRewardsSummary(playerId: string, serverId: string) {
    return ArenaRewards.getRewardsSummary(playerId, serverId);
  }

  /**
   * Activer/désactiver événements spéciaux (admin)
   */
  static async toggleSpecialEvent(
    eventType: "doubleRewards" | "bonusWeekend",
    enabled: boolean
  ) {
    return ArenaRewards.toggleSpecialEvent(eventType, enabled);
  }

  /**
   * Reset quotidien des récompenses
   */
  static async performDailyRewardsReset(serverId: string) {
    return ArenaRewards.performDailyReset(serverId);
  }

  // ===== MÉTHODES UTILITAIRES ET DE MAINTENANCE =====

  /**
   * Maintenance complète du système d'arène (quotidienne)
   */
  static async performDailyMaintenance(serverId: string): Promise<ArenaServiceResponse> {
    try {
      console.log(`🔧 Maintenance quotidienne complète de l'arène pour ${serverId}`);

      const results = await Promise.allSettled([
        ArenaRewards.performDailyReset(serverId),
        ArenaSeasons.performDailyMaintenance(serverId)
      ]);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0) {
        console.warn(`⚠️ ${failed} tâches de maintenance ont échoué sur ${results.length}`);
      }

      return {
        success: failed === 0,
        data: {
          tasksCompleted: successful,
          tasksFailed: failed,
          results: results.map((r, index) => ({
            task: index === 0 ? 'rewards_reset' : 'season_maintenance',
            status: r.status,
            error: r.status === 'rejected' ? r.reason : null
          }))
        },
        message: `Daily maintenance completed: ${successful}/${results.length} tasks successful`
      };

    } catch (error: any) {
      console.error("❌ Erreur performDailyMaintenance:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtenir un aperçu complet du système d'arène pour un joueur
   */
  static async getPlayerArenaOverview(playerId: string, serverId: string): Promise<ArenaServiceResponse> {
    const { ArenaCache } = await import('./ArenaCache');
    return ArenaCache.getPlayerOverview(playerId, serverId);
  }

  /**
   * Obtenir les statistiques globales du serveur
   */
  static async getServerArenaStats(serverId: string): Promise<ArenaServiceResponse> {
    try {
      const [matchmakingStats, seasonStats, currentSeason] = await Promise.allSettled([
        this.getMatchmakingStats(serverId),
        this.getCurrentSeasonLeaderboard(serverId, undefined, 10),
        this.getCurrentSeason(serverId)
      ]);

      const serverStats = {
        matchmaking: matchmakingStats.status === 'fulfilled' ? matchmakingStats.value.data : null,
        topPlayers: seasonStats.status === 'fulfilled' ? seasonStats.value.data?.leaderboard : [],
        currentSeason: currentSeason.status === 'fulfilled' ? currentSeason.value : null,
        lastUpdated: new Date()
      };

      return {
        success: true,
        data: serverStats,
        message: "Server arena statistics retrieved successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur getServerArenaStats:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// ===== EXPORT PAR DÉFAUT =====
export default ArenaService;

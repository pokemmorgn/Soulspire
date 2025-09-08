// server/src/services/arena/ArenaRewards.ts

import Player from "../../models/Player";
import { ArenaPlayer, ArenaSeason } from "../../models/Arena";
import { NotificationService } from "../NotificationService";
import {
  ArenaLeague,
  ArenaSeasonStatus,
  ArenaServiceResponse
} from "../../types/ArenaTypes";

/**
 * SERVICE DE RÉCOMPENSES D'ARÈNE
 * Gestion complète des récompenses quotidiennes, hebdomadaires et saisonnières
 */
export class ArenaRewards {

  // ===== CONFIGURATION RÉCOMPENSES =====
  
  private static readonly REWARDS_CONFIG = {
    dailyReset: {
      hour: 0,                    // Heure de reset quotidien (UTC)
      minute: 0
    },
    weeklyReset: {
      day: 1,                     // Lundi = 1
      hour: 0
    },
    streakBonuses: {
      login: [1.0, 1.1, 1.2, 1.5, 2.0],     // Bonus connexion 1-5 jours
      victory: [1.0, 1.2, 1.5, 2.0, 3.0]    // Bonus victoires consécutives
    },
    specialEvents: {
      doubleRewards: false,
      bonusWeekend: true,
      seasonEndBonus: 2.0
    }
  };

  // ===== RÉCOMPENSES QUOTIDIENNES =====

  /**
   * Réclamer les récompenses quotidiennes d'arène
   */
  public static async claimDailyRewards(
    playerId: string, 
    serverId: string
  ): Promise<ArenaServiceResponse> {
    try {
      console.log(`💰 Réclamation récompenses quotidiennes pour ${playerId} sur ${serverId}`);

      const arenaPlayer = await ArenaPlayer.findOne({ playerId, serverId });
      if (!arenaPlayer) {
        return { success: false, error: "Player not found in arena" };
      }

      // Vérifier si des récompenses sont disponibles
      if (!arenaPlayer.unclaimedDailyRewards) {
        return { 
          success: false, 
          error: "No daily rewards available to claim",
          data: { nextResetAt: this.getNextDailyReset() }
        };
      }

      // Vérifier le cooldown
      const timeSinceLastClaim = Date.now() - arenaPlayer.lastRewardClaimedAt.getTime();
      const dailyCooldown = 20 * 60 * 60 * 1000; // 20 heures minimum
      
      if (timeSinceLastClaim < dailyCooldown) {
        const remainingTime = dailyCooldown - timeSinceLastClaim;
        return { 
          success: false, 
          error: "Daily reward cooldown active",
          data: { 
            cooldownEndsAt: new Date(Date.now() + remainingTime),
            hoursRemaining: Math.ceil(remainingTime / (60 * 60 * 1000))
          }
        };
      }

      // Calculer les récompenses
      const baseRewards = this.calculateBaseDailyRewards(arenaPlayer.currentLeague);
      const bonusMultiplier = await this.calculateDailyBonusMultiplier(playerId, serverId);
      const finalRewards = this.applyBonusMultiplier(baseRewards, bonusMultiplier);

      // Appliquer les récompenses au joueur
      const player = await Player.findOne({ _id: playerId, serverId });
      if (player) {
        player.gold += finalRewards.gold;
        player.gems += finalRewards.gems;
        await player.save();
      }

      // Mettre à jour l'arène player
      arenaPlayer.seasonTokens += finalRewards.seasonTokens;
      arenaPlayer.lifetimeSeasonTokens += finalRewards.seasonTokens;
      arenaPlayer.unclaimedDailyRewards = false;
      arenaPlayer.lastRewardClaimedAt = new Date();
      await arenaPlayer.save();

      console.log(`✅ Récompenses quotidiennes réclamées: ${JSON.stringify(finalRewards)}`);

      // Notification
      await NotificationService.sendProgressUpdate(
        playerId,
        serverId,
        {
          milestone: "Récompenses quotidiennes réclamées",
          newFeatures: finalRewards.bonusMultiplier > 1 ? [`Bonus x${finalRewards.bonusMultiplier.toFixed(1)}`] : undefined
        }
      );

      return {
        success: true,
        data: {
          rewards: finalRewards,
          nextResetAt: this.getNextDailyReset(),
          streakInfo: bonusMultiplier.streakInfo
        },
        message: "Daily rewards claimed successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur claimDailyRewards:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtenir les récompenses quotidiennes disponibles (preview)
   */
  public static async getDailyRewardsPreview(
    playerId: string,
    serverId: string
  ): Promise<ArenaServiceResponse> {
    try {
      const arenaPlayer = await ArenaPlayer.findOne({ playerId, serverId });
      if (!arenaPlayer) {
        return { success: false, error: "Player not found in arena" };
      }

      const baseRewards = this.calculateBaseDailyRewards(arenaPlayer.currentLeague);
      const bonusMultiplier = await this.calculateDailyBonusMultiplier(playerId, serverId);
      const finalRewards = this.applyBonusMultiplier(baseRewards, bonusMultiplier);

      const timeSinceLastClaim = Date.now() - arenaPlayer.lastRewardClaimedAt.getTime();
      const canClaim = arenaPlayer.unclaimedDailyRewards && timeSinceLastClaim >= (20 * 60 * 60 * 1000);

      return {
        success: true,
        data: {
          rewards: finalRewards,
          canClaim,
          nextResetAt: this.getNextDailyReset(),
          cooldownEndsAt: canClaim ? null : new Date(arenaPlayer.lastRewardClaimedAt.getTime() + 20 * 60 * 60 * 1000),
          streakInfo: bonusMultiplier.streakInfo
        },
        message: "Daily rewards preview retrieved"
      };

    } catch (error: any) {
      console.error("❌ Erreur getDailyRewardsPreview:", error);
      return { success: false, error: error.message };
    }
  }

  // ===== RÉCOMPENSES HEBDOMADAIRES =====

  /**
   * Réclamer les récompenses hebdomadaires d'arène
   */
  public static async claimWeeklyRewards(
    playerId: string,
    serverId: string
  ): Promise<ArenaServiceResponse> {
    try {
      console.log(`🏆 Réclamation récompenses hebdomadaires pour ${playerId} sur ${serverId}`);

      const arenaPlayer = await ArenaPlayer.findOne({ playerId, serverId });
      if (!arenaPlayer) {
        return { success: false, error: "Player not found in arena" };
      }

      // Vérifier l'éligibilité (au moins 5 matchs dans la semaine)
      const weeklyStats = await this.getWeeklyStats(playerId, serverId);
      if (weeklyStats.matchesPlayed < 5) {
        return {
          success: false,
          error: "Minimum 5 matches required for weekly rewards",
          data: {
            matchesPlayed: weeklyStats.matchesPlayed,
            matchesRequired: 5
          }
        };
      }

      // Vérifier si déjà réclamé cette semaine
      const lastWeeklyReset = this.getLastWeeklyReset();
      if (arenaPlayer.lastRewardClaimedAt > lastWeeklyReset) {
        return {
          success: false,
          error: "Weekly rewards already claimed this week",
          data: { nextResetAt: this.getNextWeeklyReset() }
        };
      }

      // Calculer les récompenses hebdomadaires
      const weeklyRewards = this.calculateWeeklyRewards(arenaPlayer.currentLeague, weeklyStats);

      // Appliquer les récompenses
      const player = await Player.findOne({ _id: playerId, serverId });
      if (player) {
        player.gold += weeklyRewards.gold;
        player.gems += weeklyRewards.gems;
        await player.save();
      }

      arenaPlayer.seasonTokens += weeklyRewards.seasonTokens;
      arenaPlayer.lifetimeSeasonTokens += weeklyRewards.seasonTokens;
      await arenaPlayer.save();

      console.log(`✅ Récompenses hebdomadaires réclamées: ${JSON.stringify(weeklyRewards)}`);

      return {
        success: true,
        data: {
          rewards: weeklyRewards,
          weeklyStats,
          nextResetAt: this.getNextWeeklyReset()
        },
        message: "Weekly rewards claimed successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur claimWeeklyRewards:", error);
      return { success: false, error: error.message };
    }
  }

  // ===== RÉCOMPENSES DE FIN DE SAISON =====

  /**
   * Réclamer les récompenses de fin de saison
   */
  public static async claimSeasonEndRewards(
    playerId: string,
    serverId: string,
    seasonId: string
  ): Promise<ArenaServiceResponse> {
    try {
      console.log(`🎯 Réclamation récompenses fin de saison ${seasonId} pour ${playerId}`);

      // Vérifier que la saison est terminée
      const season = await ArenaSeason.findOne({ serverId, seasonId });
      if (!season || season.status !== ArenaSeasonStatus.ENDED) {
        return { success: false, error: "Season not found or not ended" };
      }

      // Trouver le classement du joueur
      const playerRanking = season.finalRankings?.find(
        (ranking: any) => ranking.playerId === playerId
      );

      if (!playerRanking) {
        return { success: false, error: "Player not found in season rankings" };
      }

      if (playerRanking.rewardsClaimed) {
        return { success: false, error: "Season rewards already claimed" };
      }

      // Calculer les récompenses de fin de saison
      const seasonRewards = this.calculateSeasonEndRewards(
        playerRanking.finalLeague,
        playerRanking.finalRank,
        season.totalParticipants,
        season.seasonNumber
      );

      // Appliquer les récompenses
      const [player, arenaPlayer] = await Promise.all([
        Player.findOne({ _id: playerId, serverId }),
        ArenaPlayer.findOne({ playerId, serverId })
      ]);

      if (player && arenaPlayer) {
        player.gold += seasonRewards.gold;
        player.gems += seasonRewards.gems;
        arenaPlayer.seasonTokens += seasonRewards.seasonTokens;
        arenaPlayer.lifetimeSeasonTokens += seasonRewards.seasonTokens;
        
        await Promise.all([player.save(), arenaPlayer.save()]);
      }

      // Marquer comme réclamé
      playerRanking.rewardsClaimed = true;
      await season.save();

      console.log(`✅ Récompenses fin de saison réclamées: ${JSON.stringify(seasonRewards)}`);

      // Notification spéciale
      await NotificationService.notifyMajorMilestone(
        playerId,
        serverId,
        `Récompenses Saison ${season.seasonNumber}`,
        `Rang final: #${playerRanking.finalRank} en ${playerRanking.finalLeague}. ` +
        `Récompenses: ${seasonRewards.gold} or, ${seasonRewards.gems} gems`
      );

      return {
        success: true,
        data: {
          rewards: seasonRewards,
          ranking: playerRanking,
          seasonInfo: {
            number: season.seasonNumber,
            theme: season.seasonTheme,
            totalParticipants: season.totalParticipants
          }
        },
        message: "Season end rewards claimed successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur claimSeasonEndRewards:", error);
      return { success: false, error: error.message };
    }
  }

  // ===== MÉTHODES DE CALCUL =====

  /**
   * Calculer les récompenses quotidiennes de base
   */
  private static calculateBaseDailyRewards(league: ArenaLeague) {
    const baseRewards = {
      [ArenaLeague.BRONZE]: { gold: 100, gems: 5, seasonTokens: 10 },
      [ArenaLeague.SILVER]: { gold: 200, gems: 10, seasonTokens: 20 },
      [ArenaLeague.GOLD]: { gold: 300, gems: 15, seasonTokens: 30 },
      [ArenaLeague.DIAMOND]: { gold: 500, gems: 25, seasonTokens: 50 },
      [ArenaLeague.MASTER]: { gold: 750, gems: 40, seasonTokens: 75 },
      [ArenaLeague.LEGENDARY]: { gold: 1000, gems: 60, seasonTokens: 100 }
    };

    return baseRewards[league] || baseRewards[ArenaLeague.BRONZE];
  }

  /**
   * Calculer le multiplicateur de bonus quotidien
   */
  private static async calculateDailyBonusMultiplier(playerId: string, serverId: string) {
    try {
      const arenaPlayer = await ArenaPlayer.findOne({ playerId, serverId });
      if (!arenaPlayer) {
        return { multiplier: 1.0, streakInfo: { type: "none", value: 0 } };
      }

      let multiplier = 1.0;
      let streakInfo = { type: "none", value: 0 };

      // Bonus série de victoires
      if (arenaPlayer.seasonWinStreak >= 10) {
        multiplier *= 2.0;
        streakInfo = { type: "win_streak", value: arenaPlayer.seasonWinStreak };
      } else if (arenaPlayer.seasonWinStreak >= 5) {
        multiplier *= 1.5;
        streakInfo = { type: "win_streak", value: arenaPlayer.seasonWinStreak };
      }

      // Bonus weekend (samedi-dimanche)
      const now = new Date();
      const dayOfWeek = now.getDay();
      if (this.REWARDS_CONFIG.specialEvents.bonusWeekend && (dayOfWeek === 0 || dayOfWeek === 6)) {
        multiplier *= 1.3;
        streakInfo = { type: "weekend_bonus", value: 1.3 };
      }

      // Bonus événement double récompenses
      if (this.REWARDS_CONFIG.specialEvents.doubleRewards) {
        multiplier *= 2.0;
        streakInfo = { type: "double_event", value: 2.0 };
      }

      return { multiplier, streakInfo };

    } catch (error) {
      console.error("❌ Erreur calculateDailyBonusMultiplier:", error);
      return { multiplier: 1.0, streakInfo: { type: "error", value: 0 } };
    }
  }

  /**
   * Appliquer un multiplicateur de bonus aux récompenses
   */
  private static applyBonusMultiplier(baseRewards: any, bonusData: any) {
    return {
      gold: Math.floor(baseRewards.gold * bonusData.multiplier),
      gems: Math.floor(baseRewards.gems * bonusData.multiplier),
      seasonTokens: Math.floor(baseRewards.seasonTokens * bonusData.multiplier),
      bonusMultiplier: bonusData.multiplier,
      streakInfo: bonusData.streakInfo
    };
  }

  /**
   * Calculer les récompenses hebdomadaires
   */
  private static calculateWeeklyRewards(league: ArenaLeague, weeklyStats: any) {
    const baseWeeklyRewards = {
      [ArenaLeague.BRONZE]: { gold: 500, gems: 25, seasonTokens: 50 },
      [ArenaLeague.SILVER]: { gold: 750, gems: 40, seasonTokens: 75 },
      [ArenaLeague.GOLD]: { gold: 1000, gems: 60, seasonTokens: 100 },
      [ArenaLeague.DIAMOND]: { gold: 1500, gems: 100, seasonTokens: 150 },
      [ArenaLeague.MASTER]: { gold: 2000, gems: 150, seasonTokens: 200 },
      [ArenaLeague.LEGENDARY]: { gold: 3000, gems: 250, seasonTokens: 300 }
    };

    const base = baseWeeklyRewards[league] || baseWeeklyRewards[ArenaLeague.BRONZE];
    
    // Bonus de performance
    const winRateBonus = weeklyStats.winRate > 70 ? 1.5 : weeklyStats.winRate > 50 ? 1.2 : 1.0;
    const activityBonus = weeklyStats.matchesPlayed > 15 ? 1.3 : weeklyStats.matchesPlayed > 10 ? 1.1 : 1.0;

    return {
      gold: Math.floor(base.gold * winRateBonus * activityBonus),
      gems: Math.floor(base.gems * winRateBonus * activityBonus),
      seasonTokens: Math.floor(base.seasonTokens * winRateBonus * activityBonus),
      bonuses: {
        winRate: winRateBonus,
        activity: activityBonus
      }
    };
  }

  /**
   * Calculer les récompenses de fin de saison
   */
  private static calculateSeasonEndRewards(
    finalLeague: ArenaLeague,
    finalRank: number,
    totalParticipants: number,
    seasonNumber: number
  ) {
    const baseSeasonRewards = {
      [ArenaLeague.BRONZE]: { gold: 1000, gems: 50, seasonTokens: 200 },
      [ArenaLeague.SILVER]: { gold: 2000, gems: 100, seasonTokens: 400 },
      [ArenaLeague.GOLD]: { gold: 4000, gems: 200, seasonTokens: 800 },
      [ArenaLeague.DIAMOND]: { gold: 8000, gems: 400, seasonTokens: 1600 },
      [ArenaLeague.MASTER]: { gold: 15000, gems: 800, seasonTokens: 3000 },
      [ArenaLeague.LEGENDARY]: { gold: 30000, gems: 1500, seasonTokens: 6000 }
    };

    const base = baseSeasonRewards[finalLeague] || baseSeasonRewards[ArenaLeague.BRONZE];
    
    // Bonus de rang
    const percentile = (totalParticipants - finalRank + 1) / totalParticipants;
    let rankBonus = 1.0;
    if (percentile >= 0.95) rankBonus = 3.0;      // Top 5%
    else if (percentile >= 0.90) rankBonus = 2.5; // Top 10%
    else if (percentile >= 0.75) rankBonus = 2.0; // Top 25%
    else if (percentile >= 0.50) rankBonus = 1.5; // Top 50%

    // Bonus progression saison
    const seasonBonus = 1 + (seasonNumber - 1) * 0.1;

    return {
      gold: Math.floor(base.gold * rankBonus * seasonBonus),
      gems: Math.floor(base.gems * rankBonus * seasonBonus),
      seasonTokens: Math.floor(base.seasonTokens * rankBonus * seasonBonus),
      bonuses: {
        rank: rankBonus,
        season: seasonBonus,
        percentile: Math.round(percentile * 100)
      }
    };
  }

  // ===== STATISTIQUES ET UTILITAIRES =====

  /**
   * Obtenir les statistiques hebdomadaires d'un joueur
   */
  private static async getWeeklyStats(playerId: string, serverId: string) {
    try {
      const weekStart = this.getLastWeeklyReset();
      
      // Pour le moment, simuler les stats hebdomadaires
      // Dans une vraie implémentation, il faudrait compter les matches de la semaine
      const arenaPlayer = await ArenaPlayer.findOne({ playerId, serverId });
      if (!arenaPlayer) {
        return { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0 };
      }

      // Simulation basée sur l'activité récente
      const estimatedWeeklyMatches = Math.min(20, Math.max(0, arenaPlayer.dailyMatchesUsed * 7));
      const estimatedWins = Math.floor(estimatedWeeklyMatches * (arenaPlayer.seasonWins / Math.max(1, arenaPlayer.seasonWins + arenaPlayer.seasonLosses)));
      
      return {
        matchesPlayed: estimatedWeeklyMatches,
        wins: estimatedWins,
        losses: estimatedWeeklyMatches - estimatedWins,
        winRate: estimatedWeeklyMatches > 0 ? Math.round((estimatedWins / estimatedWeeklyMatches) * 100) : 0
      };

    } catch (error) {
      console.error("❌ Erreur getWeeklyStats:", error);
      return { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0 };
    }
  }

  /**
   * Obtenir la prochaine réinitialisation quotidienne
   */
  private static getNextDailyReset(): Date {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(this.REWARDS_CONFIG.dailyReset.hour, this.REWARDS_CONFIG.dailyReset.minute, 0, 0);
    return tomorrow;
  }

  /**
   * Obtenir la dernière réinitialisation hebdomadaire
   */
  private static getLastWeeklyReset(): Date {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysToMonday = (dayOfWeek + 6) % 7; // Lundi = 0
    
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - daysToMonday);
    lastMonday.setUTCHours(this.REWARDS_CONFIG.weeklyReset.hour, 0, 0, 0);
    
    return lastMonday;
  }

  /**
   * Obtenir la prochaine réinitialisation hebdomadaire
   */
  private static getNextWeeklyReset(): Date {
    const lastReset = this.getLastWeeklyReset();
    const nextReset = new Date(lastReset);
    nextReset.setUTCDate(lastReset.getUTCDate() + 7);
    return nextReset;
  }

  // ===== MÉTHODES PUBLIQUES ADDITIONNELLES =====

  /**
   * Effectuer le reset quotidien pour tous les joueurs d'un serveur
   */
  public static async performDailyReset(serverId: string): Promise<ArenaServiceResponse> {
    try {
      console.log(`🌅 Reset quotidien des récompenses d'arène pour ${serverId}`);

      const updateResult = await ArenaPlayer.updateMany(
        { serverId },
        {
          $set: {
            dailyMatchesUsed: 0,
            unclaimedDailyRewards: true
          }
        }
      );

      console.log(`✅ Reset quotidien terminé pour ${updateResult.modifiedCount} joueurs sur ${serverId}`);

      return {
        success: true,
        data: {
          playersReset: updateResult.modifiedCount,
          resetTime: new Date()
        },
        message: "Daily reset completed successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur performDailyReset:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtenir un résumé de toutes les récompenses disponibles
   */
  public static async getRewardsSummary(
    playerId: string,
    serverId: string
  ): Promise<ArenaServiceResponse> {
    try {
      const [dailyPreview, arenaPlayer] = await Promise.all([
        this.getDailyRewardsPreview(playerId, serverId),
        ArenaPlayer.findOne({ playerId, serverId })
      ]);

      if (!arenaPlayer) {
        return { success: false, error: "Player not found in arena" };
      }

      const weeklyStats = await this.getWeeklyStats(playerId, serverId);
      const canClaimWeekly = weeklyStats.matchesPlayed >= 5 && 
                            arenaPlayer.lastRewardClaimedAt <= this.getLastWeeklyReset();

      // Vérifier les récompenses de saisons terminées non réclamées
      const unclaimedSeasons = await ArenaSeason.find({
        serverId,
        status: ArenaSeasonStatus.ENDED,
        'finalRankings.playerId': playerId,
        'finalRankings.rewardsClaimed': false
      }).select('seasonId seasonNumber seasonTheme finalRankings');

      const summary = {
        daily: dailyPreview.success ? dailyPreview.data : null,
        weekly: {
          available: canClaimWeekly,
          requirements: { matchesNeeded: Math.max(0, 5 - weeklyStats.matchesPlayed) },
          stats: weeklyStats,
          nextReset: this.getNextWeeklyReset()
        },
        seasonEnd: unclaimedSeasons.map(season => {
          const playerRanking = season.finalRankings?.find((r: any) => r.playerId === playerId);
          return {
            seasonId: season.seasonId,
            seasonNumber: season.seasonNumber,
            theme: season.seasonTheme,
            finalRank: playerRanking?.finalRank,
            finalLeague: playerRanking?.finalLeague
          };
        }),
        currentTokens: arenaPlayer.seasonTokens,
        lifetimeTokens: arenaPlayer.lifetimeSeasonTokens
      };

      return {
        success: true,
        data: summary,
        message: "Rewards summary retrieved successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur getRewardsSummary:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Activer/désactiver les événements spéciaux (admin)
   */
  public static async toggleSpecialEvent(
    eventType: "doubleRewards" | "bonusWeekend",
    enabled: boolean
  ): Promise<ArenaServiceResponse> {
    try {
      this.REWARDS_CONFIG.specialEvents[eventType] = enabled;
      
      console.log(`🎉 Événement ${eventType} ${enabled ? 'activé' : 'désactivé'}`);

      return {
        success: true,
        data: {
          eventType,
          enabled,
          currentEvents: this.REWARDS_CONFIG.specialEvents
        },
        message: `Special event ${eventType} ${enabled ? 'enabled' : 'disabled'}`
      };

    } catch (error: any) {
      console.error("❌ Erreur toggleSpecialEvent:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

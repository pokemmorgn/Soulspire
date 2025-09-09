// server/src/services/arena/ArenaSeasons.ts

import Player from "../../models/Player";
import { ArenaPlayer, ArenaSeason } from "../../models/Arena";
import { NotificationService } from "../NotificationService";
import {
  ArenaLeague,
  ArenaSeasonStatus,
  IArenaSeason,
  IArenaSeasonRanking,
  ArenaServiceResponse
} from "../../types/ArenaTypes";

/**
 * SERVICE DE GESTION DES SAISONS D'ARÈNE
 * Création, fin, récompenses et cycles saisonniers automatiques
 */
export class ArenaSeasons {

  // ===== CONFIGURATION SAISONS =====
  
  private static readonly SEASON_CONFIG = {
    duration: 30,                   // Durée d'une saison en jours
    preSeasonDuration: 3,           // Jours de préparation entre saisons
    maxSeasons: 100,                // Nombre maximum de saisons à garder
    resetHour: 0,                   // Heure de reset quotidien (UTC)
    themes: [
      "Arena Legends",
      "Champions Rising", 
      "Masters of Combat",
      "Elite Warriors",
      "Legendary Heroes",
      "Ultimate Clash",
      "Supreme Battle",
      "Eternal Glory"
    ]
  };

  // ===== GESTION DES SAISONS ACTIVES =====

  /**
   * Obtenir la saison actuelle ou en créer une nouvelle
   */
   public static async getCurrentSeason(serverId: string): Promise<IArenaSeason | null> {
    const { ArenaCache } = await import('./ArenaCache');
    return ArenaCache.getSeasonData(serverId);
  }

  /**
   * Obtenir l'historique des saisons
   */
  public static async getSeasonHistory(
    serverId: string, 
    limit: number = 10
  ): Promise<ArenaServiceResponse<IArenaSeason[]>> {
    try {
      const seasons = await ArenaSeason.find({ serverId })
        .sort({ seasonNumber: -1 })
        .limit(limit)
        .lean();

      return {
        success: true,
        data: seasons,
        message: `Retrieved ${seasons.length} seasons history`
      };

    } catch (error: any) {
      console.error("❌ Erreur getSeasonHistory:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtenir les statistiques d'une saison spécifique
   */
  public static async getSeasonStats(
    serverId: string, 
    seasonId: string
  ): Promise<ArenaServiceResponse> {
    try {
      const season = await ArenaSeason.findOne({ serverId, seasonId });
      if (!season) {
        return { success: false, error: "Season not found" };
      }

      // Calculer les statistiques
      const participants = await ArenaPlayer.countDocuments({ 
        serverId, 
        seasonId 
      });

      const leagueDistribution = await ArenaPlayer.aggregate([
        { $match: { serverId, seasonId } },
        { $group: { _id: "$currentLeague", count: { $sum: 1 } } }
      ]);

      const topPlayers = await ArenaPlayer.find({ serverId, seasonId })
        .sort({ arenaPoints: -1 })
        .limit(10)
        .populate('playerId', 'displayName level')
        .lean();

      const stats = {
        season: season.toObject(),
        participants,
        leagueDistribution: leagueDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        topPlayers: topPlayers.map((player, index) => ({
          rank: index + 1,
          playerId: player.playerId,
          playerName: (player.playerId as any)?.displayName || "Unknown",
          league: player.currentLeague,
          points: player.arenaPoints,
          wins: player.seasonWins,
          losses: player.seasonLosses
        })),
        isActive: season.status === ArenaSeasonStatus.ACTIVE,
        daysRemaining: season.daysRemaining(),
        averageMatchesPerPlayer: participants > 0 ? season.totalMatches / participants : 0
      };

      return {
        success: true,
        data: stats,
        message: "Season statistics retrieved successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur getSeasonStats:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===== CRÉATION ET FIN DE SAISONS =====

  /**
   * Créer une nouvelle saison
   */
  private static async createNewSeason(serverId: string): Promise<any> {
    try {
      // Obtenir le numéro de la nouvelle saison
      const lastSeason = await ArenaSeason.findOne({ serverId })
        .sort({ seasonNumber: -1 })
        .select('seasonNumber');
      
      const newSeasonNumber = lastSeason ? lastSeason.seasonNumber + 1 : 1;

      // Calculer les dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + this.SEASON_CONFIG.duration);

      // Choisir un thème
      const theme = this.SEASON_CONFIG.themes[
        (newSeasonNumber - 1) % this.SEASON_CONFIG.themes.length
      ];

      // Créer la nouvelle saison
      const newSeason = new ArenaSeason({
        serverId,
        seasonNumber: newSeasonNumber,
        startDate,
        endDate,
        status: ArenaSeasonStatus.ACTIVE,
        seasonTheme: `Season ${newSeasonNumber}: ${theme}`,
        totalParticipants: 0,
        totalMatches: 0,
        averageMatchesPerPlayer: 0,
        exclusiveRewards: this.generateSeasonRewards(newSeasonNumber),
        finalRankings: []
      });

      await newSeason.save();

      // Notifier tous les joueurs actifs de la nouvelle saison
      await this.notifyNewSeason(serverId, newSeason);

      console.log(`✅ Nouvelle saison ${newSeasonNumber} créée pour ${serverId}: "${newSeason.seasonTheme}"`);

      return newSeason;

    } catch (error: any) {
      console.error("❌ Erreur createNewSeason:", error);
      throw error;
    }
  }

  /**
   * Terminer la saison actuelle
   */
  private static async endCurrentSeason(season: any): Promise<void> {
    try {
      console.log(`🏁 Fin de saison ${season.seasonNumber} sur ${season.serverId}`);

      // Marquer la saison comme terminée
      season.status = ArenaSeasonStatus.ENDED;
      
      // Générer les classements finaux
      const finalRankings = await this.generateFinalRankings(season.serverId, season.seasonId);
      season.finalRankings = finalRankings;
      
      // Calculer les statistiques finales
      season.totalParticipants = finalRankings.length;
      if (season.totalParticipants > 0) {
        season.averageMatchesPerPlayer = season.totalMatches / season.totalParticipants;
      }
      
      await season.save();

      // Distribuer les récompenses de fin de saison
      await this.distributeSeasonEndRewards(season);

      // Réinitialiser les données saisonnières des joueurs
      await this.resetPlayerSeasonData(season.serverId, season.seasonId);

      // Nettoyer les anciennes saisons si nécessaire
      await this.cleanupOldSeasons(season.serverId);

      console.log(`✅ Saison ${season.seasonNumber} terminée avec ${finalRankings.length} participants`);

    } catch (error) {
      console.error("❌ Erreur endCurrentSeason:", error);
    }
  }

  /**
   * Forcer la fin d'une saison (admin)
   */
  public static async forceEndSeason(
    serverId: string, 
    reason: string = "Administrative action"
  ): Promise<ArenaServiceResponse> {
    try {
      const currentSeason = await ArenaSeason.findOne({ 
        serverId, 
        status: ArenaSeasonStatus.ACTIVE 
      });

      if (!currentSeason) {
        return { success: false, error: "No active season to end" };
      }

      console.log(`🛑 Fin forcée de saison ${currentSeason.seasonNumber} sur ${serverId}: ${reason}`);

      await this.endCurrentSeason(currentSeason);

      return {
        success: true,
        data: {
          endedSeason: currentSeason.seasonNumber,
          reason,
          participantsCount: currentSeason.finalRankings?.length || 0
        },
        message: "Season forcefully ended"
      };

    } catch (error: any) {
      console.error("❌ Erreur forceEndSeason:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===== RÉCOMPENSES ET CLASSEMENTS =====

  /**
   * Générer les classements finaux d'une saison
   */
  private static async generateFinalRankings(
    serverId: string, 
    seasonId: string
  ): Promise<IArenaSeasonRanking[]> {
    try {
      const arenaPlayers = await ArenaPlayer.find({ serverId, seasonId })
        .sort({ arenaPoints: -1, seasonWins: -1, seasonWinStreak: -1 })
        .populate('playerId', 'displayName')
        .lean();

      return arenaPlayers.map((player, index) => ({
        playerId: player.playerId,
        playerName: (player.playerId as any)?.displayName || "Unknown Player",
        finalRank: index + 1,
        finalLeague: player.currentLeague,
        finalPoints: player.arenaPoints,
        totalWins: player.seasonWins,
        totalLosses: player.seasonLosses,
        bestWinStreak: player.seasonBestWinStreak,
        rewardsClaimed: false
      }));

    } catch (error: any) {
      console.error("❌ Erreur generateFinalRankings:", error);
      return [];
    }
  }

  /**
   * Distribuer les récompenses de fin de saison
   */
  private static async distributeSeasonEndRewards(season: any): Promise<void> {
    try {
      console.log(`🎁 Distribution des récompenses de fin de saison ${season.seasonNumber}`);

      for (const ranking of season.finalRankings) {
        try {
          // Obtenir les récompenses selon la ligue finale
          const rewards = season.exclusiveRewards[ranking.finalLeague];
          if (!rewards) continue;

          // Calculer les bonus selon le rang final
          const rankBonus = this.calculateRankBonus(ranking.finalRank, season.totalParticipants);
          const finalRewards = {
            gold: Math.floor(rewards.seasonTokens * 10 * rankBonus), // Conversion tokens en or
            gems: Math.floor((rewards.seasonTokens / 10) * rankBonus),
            seasonTokens: Math.floor(rewards.seasonTokens * rankBonus),
            title: rewards.title,
            avatar: rewards.avatar
          };

          // Appliquer les récompenses
          const [player, arenaPlayer] = await Promise.all([
            Player.findOne({ _id: ranking.playerId, serverId: season.serverId }),
            ArenaPlayer.findOne({ playerId: ranking.playerId, serverId: season.serverId })
          ]);
          
          if (player && arenaPlayer) {
            player.gold += finalRewards.gold;
            player.gems += finalRewards.gems;
            arenaPlayer.seasonTokens += finalRewards.seasonTokens;
            arenaPlayer.lifetimeSeasonTokens += finalRewards.seasonTokens;
            
            await Promise.all([player.save(), arenaPlayer.save()]);

            // Notification de récompenses
            await NotificationService.notifyMajorMilestone(
              ranking.playerId,
              season.serverId,
              `Fin de saison ${season.seasonNumber}`,
              `Rang final: #${ranking.finalRank} en ${ranking.finalLeague}. ` +
              `Récompenses: ${finalRewards.gold} or, ${finalRewards.gems} gems, ${finalRewards.seasonTokens} tokens`
            );

            ranking.rewardsClaimed = true;
          }

        } catch (error) {
          console.error(`❌ Erreur distribution récompenses pour ${ranking.playerId}:`, error);
        }
      }

      console.log(`✅ Récompenses distribuées à ${season.finalRankings.length} joueurs`);

    } catch (error) {
      console.error("❌ Erreur distributeSeasonEndRewards:", error);
    }
  }

  /**
   * Réinitialiser les données saisonnières des joueurs
   */
  private static async resetPlayerSeasonData(serverId: string, oldSeasonId: string): Promise<void> {
    try {
      console.log(`🔄 Reset des données saisonnières pour ${serverId}`);

      // Obtenir la nouvelle saison (qui devrait être créée à ce moment)
      const newSeason = await ArenaSeason.findOne({ 
        serverId, 
        status: ArenaSeasonStatus.ACTIVE 
      });

      if (!newSeason) {
        console.error("❌ Aucune nouvelle saison trouvée pour le reset");
        return;
      }

      // Réinitialiser toutes les données saisonnières
      await ArenaPlayer.updateMany(
        { serverId, seasonId: oldSeasonId },
        {
          $set: {
            seasonId: newSeason.seasonId,
            seasonWins: 0,
            seasonLosses: 0,
            seasonWinStreak: 0,
            seasonBestWinStreak: 0,
            dailyMatchesUsed: 0,
            unclaimedDailyRewards: true,
            lastRewardClaimedAt: new Date()
          }
        }
      );

      console.log(`✅ Données saisonnières réinitialisées pour ${serverId}`);

    } catch (error) {
      console.error("❌ Erreur resetPlayerSeasonData:", error);
    }
  }

  // ===== UTILITAIRES =====

  /**
   * Générer les récompenses spéciales d'une saison
   */
  private static generateSeasonRewards(seasonNumber: number) {
    const baseMultiplier = 1 + (seasonNumber - 1) * 0.1; // Augmentation de 10% par saison

    return {
      [ArenaLeague.BRONZE]: {
        title: `Season ${seasonNumber} Bronze Warrior`,
        avatar: `bronze_s${seasonNumber}_avatar`,
        items: [`bronze_s${seasonNumber}_chest`],
        seasonTokens: Math.floor(100 * baseMultiplier)
      },
      [ArenaLeague.SILVER]: {
        title: `Season ${seasonNumber} Silver Guardian`,
        avatar: `silver_s${seasonNumber}_avatar`,
        items: [`silver_s${seasonNumber}_chest`, `silver_s${seasonNumber}_weapon`],
        seasonTokens: Math.floor(250 * baseMultiplier)
      },
      [ArenaLeague.GOLD]: {
        title: `Season ${seasonNumber} Gold Champion`,
        avatar: `gold_s${seasonNumber}_avatar`,
        items: [`gold_s${seasonNumber}_chest`, `gold_s${seasonNumber}_weapon`, `gold_s${seasonNumber}_armor`],
        seasonTokens: Math.floor(500 * baseMultiplier)
      },
      [ArenaLeague.DIAMOND]: {
        title: `Season ${seasonNumber} Diamond Elite`,
        avatar: `diamond_s${seasonNumber}_avatar`,
        items: [`diamond_s${seasonNumber}_chest`, `diamond_s${seasonNumber}_weapon`, `diamond_s${seasonNumber}_armor`],
        seasonTokens: Math.floor(1000 * baseMultiplier)
      },
      [ArenaLeague.MASTER]: {
        title: `Season ${seasonNumber} Arena Master`,
        avatar: `master_s${seasonNumber}_avatar`,
        items: [`master_s${seasonNumber}_chest`, `master_s${seasonNumber}_legendary_weapon`],
        seasonTokens: Math.floor(2000 * baseMultiplier)
      },
      [ArenaLeague.LEGENDARY]: {
        title: `Season ${seasonNumber} Legendary Hero`,
        avatar: `legendary_s${seasonNumber}_avatar`,
        items: [`legendary_s${seasonNumber}_chest`, `legendary_s${seasonNumber}_mythic_weapon`, `legendary_s${seasonNumber}_crown`],
        seasonTokens: Math.floor(5000 * baseMultiplier)
      }
    };
  }

  /**
   * Calculer le bonus de rang pour les récompenses
   */
  private static calculateRankBonus(rank: number, totalParticipants: number): number {
    if (totalParticipants === 0) return 1;
    
    const percentile = (totalParticipants - rank + 1) / totalParticipants;
    
    if (percentile >= 0.95) return 2.0;      // Top 5%
    if (percentile >= 0.90) return 1.8;      // Top 10%
    if (percentile >= 0.75) return 1.5;      // Top 25%
    if (percentile >= 0.50) return 1.2;      // Top 50%
    return 1.0;                              // Reste
  }

  /**
   * Notifier tous les joueurs d'une nouvelle saison
   */
  private static async notifyNewSeason(serverId: string, season: any): Promise<void> {
    try {
      // Notification système pour tous les joueurs du serveur
      await NotificationService.sendSystemNotification(
        serverId,
        `🆕 ${season.seasonTheme}`,
        `Une nouvelle saison d'arène a commencé ! Participez aux combats pour gagner des récompenses exclusives. ` +
        `Durée: ${this.SEASON_CONFIG.duration} jours.`,
        "high"
      );
      
      // 🔌 Notification WebSocket temps réel
      try {
        const { WebSocketArena } = await import('../websocket/WebSocketArena');
        WebSocketArena.notifyNewSeason(serverId, {
          seasonNumber: season.seasonNumber,
          theme: season.seasonTheme,
          startDate: season.startDate,
          endDate: season.endDate,
          exclusiveRewards: Object.keys(season.exclusiveRewards)
        });
      } catch (error) {
        console.error('⚠️ Erreur WebSocket new season:', error);
      }
      
      console.log(`📢 Notification nouvelle saison envoyée aux joueurs de ${serverId}`);

    } catch (error) {
      console.error("❌ Erreur notifyNewSeason:", error);
    }
  }

  /**
   * Nettoyer les anciennes saisons
   */
  private static async cleanupOldSeasons(serverId: string): Promise<void> {
    try {
      const seasonCount = await ArenaSeason.countDocuments({ serverId });
      
      if (seasonCount > this.SEASON_CONFIG.maxSeasons) {
        const seasonsToDelete = seasonCount - this.SEASON_CONFIG.maxSeasons;
        
        const oldSeasons = await ArenaSeason.find({ serverId })
          .sort({ seasonNumber: 1 })
          .limit(seasonsToDelete)
          .select('_id seasonNumber');

        for (const season of oldSeasons) {
          await ArenaSeason.findByIdAndDelete(season._id);
          console.log(`🗑️ Ancienne saison ${season.seasonNumber} supprimée`);
        }

        console.log(`✅ ${seasonsToDelete} anciennes saisons nettoyées`);
      }

    } catch (error) {
      console.error("❌ Erreur cleanupOldSeasons:", error);
    }
  }

  // ===== MÉTHODES PUBLIQUES ADDITIONNELLES =====

  /**
   * Obtenir le classement en temps réel d'une saison
   */
  public static async getCurrentSeasonLeaderboard(
    serverId: string,
    league?: ArenaLeague,
    limit: number = 50
  ): Promise<ArenaServiceResponse> {
    const { ArenaCache } = await import('./ArenaCache');
    return ArenaCache.getLeaderboard(serverId, league, limit);
  }

  /**
   * Effectuer la maintenance quotidienne des saisons
   */
  public static async performDailyMaintenance(serverId: string): Promise<ArenaServiceResponse> {
    try {
      console.log(`🔧 Maintenance quotidienne des saisons pour ${serverId}`);

      const currentSeason = await ArenaSeason.findOne({ 
        serverId, 
        status: { $in: [ArenaSeasonStatus.ACTIVE, ArenaSeasonStatus.ENDING] }
      });

      if (!currentSeason) {
        console.log(`ℹ️ Aucune saison active pour ${serverId}, création d'une nouvelle`);
        await this.createNewSeason(serverId);
        return {
          success: true,
          data: { action: "new_season_created" },
          message: "New season created during maintenance"
        };
      }

      const daysRemaining = currentSeason.daysRemaining();
      
      if (daysRemaining <= 0) {
        console.log(`⏰ Saison ${currentSeason.seasonNumber} expirée, fin automatique`);
        await this.endCurrentSeason(currentSeason);
        await this.createNewSeason(serverId);
        return {
          success: true,
          data: { 
            action: "season_ended_and_new_created",
            endedSeason: currentSeason.seasonNumber
          },
          message: "Season ended and new season created"
        };
      }

      if (daysRemaining <= 7 && currentSeason.status === ArenaSeasonStatus.ACTIVE) {
        currentSeason.status = ArenaSeasonStatus.ENDING;
        await currentSeason.save();
        
        // Notifier les joueurs de la fin proche
        await NotificationService.sendSystemNotification(
          serverId,
          "⏰ Fin de saison proche",
          `La saison ${currentSeason.seasonNumber} se termine dans ${daysRemaining} jours ! ` +
          `Participez aux derniers combats pour améliorer votre classement.`,
          "normal"
        );

        return {
          success: true,
          data: { 
            action: "season_ending_warning",
            daysRemaining
          },
          message: "Season ending warning sent"
        };
      }

      return {
        success: true,
        data: { 
          action: "no_action_required",
          daysRemaining
        },
        message: "Daily maintenance completed"
      };

    } catch (error: any) {
      console.error("❌ Erreur performDailyMaintenance:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

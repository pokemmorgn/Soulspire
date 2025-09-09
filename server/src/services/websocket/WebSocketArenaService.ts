// server/src/services/websocket/WebSocketArenaService.ts
import { WebSocketService } from '../WebSocketService';

/**
 * SERVICE WEBSOCKET SPÉCIALISÉ POUR L'ARÈNE
 * Toutes les notifications temps réel liées au système d'arène PVP
 */
export class WebSocketArenaService {
  
  // ===== NOTIFICATIONS DE COMBAT =====

  /**
   * Notifier le résultat d'un combat d'arène
   */
  public static notifyMatchResult(
    playerId: string,
    matchResult: {
      victory: boolean;
      newRank: number;
      newPoints: number;
      newLeague: string;
      pointsChange: number;
      opponentName: string;
      duration: number;
      rewards: any;
    }
  ): void {
    WebSocketService.sendToPlayer(playerId, 'arena:match_result', {
      type: 'match_result',
      ...matchResult,
      animation: matchResult.victory ? 'victory' : 'defeat'
    });

    console.log(`⚔️ Match result sent to ${playerId}: ${matchResult.victory ? 'Victory' : 'Defeat'}`);
  }

  /**
   * Notifier qu'on a été attaqué en défense
   */
  public static notifyDefenseAttacked(
    defenderId: string,
    attackData: {
      attackerName: string;
      result: 'victory' | 'defeat';
      pointsChange: number;
      newRank: number;
      revengeAvailable: boolean;
      matchId: string;
    }
  ): void {
    WebSocketService.sendToPlayer(defenderId, 'arena:defense_attacked', {
      type: 'defense_result',
      ...attackData,
      priority: 'normal'
    });

    console.log(`🛡️ Defense result sent to ${defenderId}: ${attackData.result} vs ${attackData.attackerName}`);
  }

  /**
   * Notifier qu'un combat commence (pour spectateurs)
   */
  public static notifyMatchStarted(
    serverId: string,
    matchData: {
      attackerName: string;
      defenderName: string;
      attackerLeague: string;
      defenderLeague: string;
      matchId: string;
      estimatedDuration?: number;
    }
  ): void {
    WebSocketService.broadcastToServer(serverId, 'arena:match_started', {
      type: 'match_started',
      ...matchData
    });

    console.log(`⚔️ Match started notification: ${matchData.attackerName} vs ${matchData.defenderName}`);
  }

  /**
   * Notifier abandon de combat
   */
  public static notifyMatchForfeited(
    playerId: string,
    forfeitData: {
      matchId: string;
      penaltyPoints: number;
      reason: string;
    }
  ): void {
    WebSocketService.sendToPlayer(playerId, 'arena:match_forfeited', {
      type: 'match_forfeited',
      ...forfeitData,
      animation: 'forfeit'
    });

    console.log(`🏳️ Match forfeit notification sent to ${playerId}`);
  }

  // ===== NOTIFICATIONS DE PROGRESSION =====

  /**
   * Notifier une promotion/relégation
   */
  public static notifyPromotion(
    playerId: string,
    promotionData: {
      promoted: boolean;
      newLeague: string;
      oldLeague: string;
      newRank: number;
      bonusRewards?: any;
    }
  ): void {
    WebSocketService.sendToPlayer(playerId, 'arena:promotion', {
      type: promotionData.promoted ? 'promotion' : 'relegation',
      ...promotionData,
      animation: promotionData.promoted ? 'promotion_celebration' : 'relegation_sad'
    });

    console.log(`🎉 ${promotionData.promoted ? 'Promotion' : 'Relegation'} sent to ${playerId}: ${promotionData.oldLeague} → ${promotionData.newLeague}`);
  }

  /**
   * Notifier changement de rang en temps réel
   */
  public static notifyRankChanged(
    playerId: string,
    rankData: {
      oldRank: number;
      newRank: number;
      league: string;
      pointsChange: number;
    }
  ): void {
    const improved = rankData.newRank < rankData.oldRank;
    
    WebSocketService.sendToPlayer(playerId, 'arena:rank_changed', {
      type: 'rank_changed',
      ...rankData,
      improved,
      animation: improved ? 'rank_up' : 'rank_down'
    });

    console.log(`📊 Rank change sent to ${playerId}: #${rankData.oldRank} → #${rankData.newRank}`);
  }

  // ===== NOTIFICATIONS DE RÉCOMPENSES =====

  /**
   * Notifier récompenses quotidiennes réclamées
   */
  public static notifyDailyRewardsClaimed(
    playerId: string,
    rewardsData: {
      gold: number;
      gems: number;
      seasonTokens: number;
      bonusMultiplier?: number;
      streakInfo?: any;
    }
  ): void {
    WebSocketService.sendToPlayer(playerId, 'arena:daily_rewards_claimed', {
      type: 'daily_rewards_claimed',
      ...rewardsData,
      animation: rewardsData.bonusMultiplier && rewardsData.bonusMultiplier > 1 ? 'bonus_celebration' : 'normal_reward'
    });

    console.log(`💰 Daily rewards notification sent to ${playerId}: ${rewardsData.gold} gold, ${rewardsData.gems} gems`);
  }

  /**
   * Notifier récompenses hebdomadaires réclamées
   */
  public static notifyWeeklyRewardsClaimed(
    playerId: string,
    rewardsData: {
      gold: number;
      gems: number;
      seasonTokens: number;
      weeklyStats: any;
      bonuses?: any;
    }
  ): void {
    WebSocketService.sendToPlayer(playerId, 'arena:weekly_rewards_claimed', {
      type: 'weekly_rewards_claimed',
      ...rewardsData,
      animation: 'weekly_celebration'
    });

    console.log(`🏆 Weekly rewards notification sent to ${playerId}`);
  }

  /**
   * Notifier récompenses de fin de saison réclamées
   */
  public static notifySeasonEndRewardsClaimed(
    playerId: string,
    rewardsData: {
      seasonNumber: number;
      finalRank: number;
      finalLeague: string;
      rewards: any;
      title?: string;
      avatar?: string;
    }
  ): void {
    WebSocketService.sendToPlayer(playerId, 'arena:season_end_rewards_claimed', {
      type: 'season_end_rewards_claimed',
      ...rewardsData,
      animation: 'season_reward_celebration'
    });

    console.log(`🎯 Season end rewards notification sent to ${playerId} for season ${rewardsData.seasonNumber}`);
  }

  // ===== NOTIFICATIONS DE SAISON =====

  /**
   * Notifier nouvelle saison d'arène (broadcast serveur)
   */
  public static notifyNewSeason(
    serverId: string,
    seasonData: {
      seasonNumber: number;
      theme: string;
      startDate: Date;
      endDate: Date;
      exclusiveRewards: string[];
    }
  ): void {
    WebSocketService.broadcastToServer(serverId, 'arena:new_season', {
      type: 'new_season',
      ...seasonData,
      animation: 'season_celebration'
    });

    console.log(`🎭 New season notification sent to server ${serverId}: Season ${seasonData.seasonNumber}`);
  }

  /**
   * Notifier fin de saison imminente (broadcast)
   */
  public static notifySeasonEnding(
    serverId: string,
    seasonData: {
      seasonNumber: number;
      daysRemaining: number;
      hoursRemaining?: number;
    }
  ): void {
    WebSocketService.broadcastToServer(serverId, 'arena:season_ending_warning', {
      type: 'season_ending_warning',
      ...seasonData,
      priority: 'high',
      animation: 'countdown'
    });

    console.log(`⏰ Season ending warning sent to server ${serverId}: ${seasonData.daysRemaining} days left`);
  }

  /**
   * Notifier fin de saison et calcul des récompenses
   */
  public static notifySeasonEnded(
    serverId: string,
    seasonData: {
      endedSeasonNumber: number;
      newSeasonNumber: number;
      participantsCount: number;
    }
  ): void {
    WebSocketService.broadcastToServer(serverId, 'arena:season_ended', {
      type: 'season_ended',
      ...seasonData,
      animation: 'season_transition'
    });

    console.log(`🏁 Season ended notification sent to server ${serverId}: S${seasonData.endedSeasonNumber} → S${seasonData.newSeasonNumber}`);
  }

  // ===== NOTIFICATIONS DE CLASSEMENT =====

  /**
   * Notifier mise à jour des classements (broadcast)
   */
  public static notifyLeaderboardUpdate(
    serverId: string,
    updateData: {
      topChanges: Array<{
        playerId: string;
        playerName: string;
        newRank: number;
        oldRank: number;
      }>;
      league?: string;
    }
  ): void {
    WebSocketService.broadcastToServer(serverId, 'arena:leaderboard_update', {
      type: 'leaderboard_update',
      ...updateData
    });

    console.log(`📊 Leaderboard update sent to server ${serverId}`);
  }

  /**
   * Notifier qu'un joueur entre dans le TOP 10
   */
  public static notifyTopRankAchieved(
    playerId: string,
    serverId: string,
    rankData: {
      newRank: number;
      league: string;
      isPersonalBest: boolean;
    }
  ): void {
    // Notification personnelle
    WebSocketService.sendToPlayer(playerId, 'arena:top_rank_achieved', {
      type: 'top_rank_achieved',
      ...rankData,
      animation: 'top_rank_celebration'
    });

    // Si TOP 3, broadcast au serveur
    if (rankData.newRank <= 3) {
      WebSocketService.broadcastToServer(serverId, 'arena:top_rank_announcement', {
        type: 'top_rank_announcement',
        playerId,
        rank: rankData.newRank,
        league: rankData.league
      });
    }

    console.log(`🏆 Top rank achievement sent to ${playerId}: Rank #${rankData.newRank} in ${rankData.league}`);
  }

  // ===== NOTIFICATIONS D'ACTIVITÉ =====

  /**
   * Notifier qu'un joueur rejoint l'arène (première fois)
   */
  public static notifyPlayerJoinedArena(
    playerId: string,
    serverId: string,
    playerData: {
      playerName: string;
      level: number;
      startingLeague: string;
    }
  ): void {
    WebSocketService.sendToPlayer(playerId, 'arena:welcome', {
      type: 'arena_welcome',
      ...playerData,
      animation: 'welcome_to_arena'
    });

    console.log(`🏟️ Arena welcome sent to ${playerId}`);
  }

  /**
   * Notifier formation défensive mise à jour
   */
  public static notifyFormationUpdated(
    playerId: string,
    formationData: {
      formationName: string;
      totalPower: number;
      heroCount: number;
      powerIncrease?: number;
    }
  ): void {
    WebSocketService.sendToPlayer(playerId, 'arena:formation_updated', {
      type: 'formation_updated',
      ...formationData,
      animation: formationData.powerIncrease && formationData.powerIncrease > 0 ? 'power_boost' : 'formation_change'
    });

    console.log(`⚔️ Formation update sent to ${playerId}: ${formationData.totalPower} power`);
  }

  // ===== UTILITAIRES =====

  /**
   * Envoyer notification d'erreur d'arène
   */
  public static notifyArenaError(
    playerId: string,
    errorData: {
      action: string;
      error: string;
      code?: string;
      retryAllowed?: boolean;
    }
  ): void {
    WebSocketService.sendToPlayer(playerId, 'arena:error', {
      type: 'arena_error',
      ...errorData,
      priority: 'high'
    });

    console.log(`❌ Arena error sent to ${playerId}: ${errorData.action} - ${errorData.error}`);
  }

  /**
   * Notifier maintenance d'arène
   */
  public static notifyArenaMaintenance(
    serverId: string,
    maintenanceData: {
      type: 'daily_reset' | 'season_maintenance' | 'emergency';
      message: string;
      estimatedDuration?: number;
    }
  ): void {
    WebSocketService.broadcastToServer(serverId, 'arena:maintenance', {
      type: 'arena_maintenance',
      ...maintenanceData,
      priority: 'high'
    });

    console.log(`🔧 Arena maintenance notification sent to server ${serverId}: ${maintenanceData.type}`);
  }
}

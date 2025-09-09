// server/src/services/websocket/WebSocketArena.ts
import { Server as SocketIOServer } from 'socket.io';

/**
 * SERVICE WEBSOCKET SPÉCIALISÉ ARÈNE
 * Toutes les notifications temps réel liées à l'arène PvP
 */
export class WebSocketArena {
  private static io: SocketIOServer | null = null;

  // ===== INITIALISATION =====

  /**
   * Initialiser avec l'instance Socket.IO principale
   */
  public static initialize(socketInstance: SocketIOServer): void {
    this.io = socketInstance;
    console.log('✅ WebSocketArena initialized');
  }

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
    if (!this.io) {
      console.warn('⚠️ WebSocketArena not initialized');
      return;
    }

    this.io.to(`player:${playerId}`).emit('arena:match_result', {
      type: 'match_result',
      data: matchResult,
      timestamp: new Date(),
      animation: matchResult.victory ? 'victory' : 'defeat'
    });

    console.log(`⚔️ Arena match result sent to ${playerId}: ${matchResult.victory ? 'Victory' : 'Defeat'}`);
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
    if (!this.io) return;

    this.io.to(`player:${defenderId}`).emit('arena:defense_attacked', {
      type: 'defense_result',
      data: attackData,
      timestamp: new Date(),
      priority: 'normal'
    });

    console.log(`🛡️ Defense result sent to ${defenderId}: ${attackData.result} vs ${attackData.attackerName}`);
  }

  /**
   * Notifier qu'un combat commence (pour les spectateurs)
   */
  public static notifyMatchStarted(
    serverId: string,
    matchData: {
      attackerName: string;
      defenderName: string;
      attackerLeague: string;
      defenderLeague: string;
      matchId: string;
      estimatedDuration: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`arena:${serverId}`).emit('arena:match_started', {
      type: 'match_started',
      data: matchData,
      timestamp: new Date()
    });

    console.log(`⚔️ Match started: ${matchData.attackerName} vs ${matchData.defenderName} on ${serverId}`);
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
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('arena:promotion', {
      type: promotionData.promoted ? 'promotion' : 'relegation',
      data: promotionData,
      timestamp: new Date(),
      animation: promotionData.promoted ? 'promotion_celebration' : 'relegation_sad'
    });

    console.log(`🎉 ${promotionData.promoted ? 'Promotion' : 'Relegation'} sent to ${playerId}: ${promotionData.oldLeague} → ${promotionData.newLeague}`);
  }

  /**
   * Notifier mise à jour des classements (broadcast)
   */
  public static notifyLeaderboardUpdate(
    serverId: string,
    topChanges: Array<{
      playerId: string;
      playerName: string;
      newRank: number;
      oldRank: number;
    }>
  ): void {
    if (!this.io) return;

    this.io.to(`arena:${serverId}`).emit('arena:leaderboard_update', {
      type: 'leaderboard_update',
      data: { topChanges },
      timestamp: new Date()
    });

    console.log(`📊 Leaderboard update sent to arena room ${serverId} (${topChanges.length} changes)`);
  }

  // ===== NOTIFICATIONS DE SAISONS =====

  /**
   * Notifier une nouvelle saison d'arène (broadcast serveur)
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
    if (!this.io) return;

    this.io.to(`arena:${serverId}`).emit('arena:new_season', {
      type: 'new_season',
      data: seasonData,
      timestamp: new Date(),
      animation: 'season_celebration'
    });

    console.log(`🎭 New season notification sent to arena room ${serverId}: Season ${seasonData.seasonNumber}`);
  }

  /**
   * Notifier fin de saison imminente (broadcast)
   */
  public static notifySeasonEnding(
    serverId: string,
    seasonData: {
      seasonNumber: number;
      daysRemaining: number;
      theme: string;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`arena:${serverId}`).emit('arena:season_ending_warning', {
      type: 'season_ending_warning',
      data: seasonData,
      timestamp: new Date(),
      priority: 'high',
      animation: 'countdown'
    });

    console.log(`⏰ Season ending warning sent to arena room ${serverId}: ${seasonData.daysRemaining} days left`);
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
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('arena:daily_rewards_claimed', {
      type: 'daily_rewards_claimed',
      data: rewardsData,
      timestamp: new Date(),
      animation: rewardsData.bonusMultiplier && rewardsData.bonusMultiplier > 1 ? 'bonus_celebration' : 'normal_reward'
    });

    console.log(`💰 Arena daily rewards sent to ${playerId}: ${rewardsData.gold} gold, ${rewardsData.gems} gems`);
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
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('arena:weekly_rewards_claimed', {
      type: 'weekly_rewards_claimed',
      data: rewardsData,
      timestamp: new Date(),
      animation: 'weekly_celebration'
    });

    console.log(`🏆 Arena weekly rewards sent to ${playerId}: ${rewardsData.gold} gold`);
  }

  /**
   * Notifier récompenses de fin de saison
   */
  public static notifySeasonEndRewards(
    playerId: string,
    rewardsData: {
      seasonNumber: number;
      finalRank: number;
      finalLeague: string;
      rewards: {
        gold: number;
        gems: number;
        seasonTokens: number;
        exclusiveItems: string[];
      };
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('arena:season_end_rewards', {
      type: 'season_end_rewards',
      data: rewardsData,
      timestamp: new Date(),
      animation: 'season_rewards_celebration'
    });

    console.log(`🎯 Season end rewards sent to ${playerId}: Rank #${rewardsData.finalRank} in ${rewardsData.finalLeague}`);
  }

  // ===== NOTIFICATIONS SPÉCIALES =====

  /**
   * Notifier qu'un joueur a atteint le top 10
   */
  public static notifyTopRankAchieved(
    playerId: string,
    serverId: string,
    rankData: {
      newRank: number;
      league: string;
      isNewRecord: boolean;
    }
  ): void {
    if (!this.io) return;

    // Notification personnelle
    this.io.to(`player:${playerId}`).emit('arena:top_rank_achieved', {
      type: 'top_rank_achieved',
      data: rankData,
      timestamp: new Date(),
      animation: 'elite_celebration'
    });

    // Si top 5, notification à tout le serveur
    if (rankData.newRank <= 5) {
      this.io.to(`arena:${serverId}`).emit('arena:elite_player_announcement', {
        type: 'elite_player_announcement',
        data: {
          playerId,
          rank: rankData.newRank,
          league: rankData.league
        },
        timestamp: new Date()
      });

      console.log(`👑 Elite rank announcement: Player ${playerId} reached rank #${rankData.newRank} on ${serverId}`);
    }
  }

  /**
   * Notifier activation d'événement spécial (double récompenses, etc.)
   */
  public static notifySpecialEvent(
    serverId: string,
    eventData: {
      eventType: 'double_rewards' | 'bonus_weekend' | 'free_matches';
      duration: number; // en heures
      description: string;
      bonusMultiplier?: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`arena:${serverId}`).emit('arena:special_event_active', {
      type: 'special_event_active',
      data: eventData,
      timestamp: new Date(),
      priority: 'high',
      animation: 'event_celebration'
    });

    console.log(`🎉 Special event notification sent to ${serverId}: ${eventData.eventType} for ${eventData.duration}h`);
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Vérifier si le service est disponible
   */
  public static isAvailable(): boolean {
    return this.io !== null;
  }

  /**
   * Obtenir le nombre de joueurs connectés dans les rooms d'arène
   */
  public static getArenaRoomStats(serverId: string): { playersInArena: number; totalConnected: number } {
    if (!this.io) return { playersInArena: 0, totalConnected: 0 };

    try {
      const arenaRoom = this.io.sockets.adapter.rooms.get(`arena:${serverId}`);
      const serverRoom = this.io.sockets.adapter.rooms.get(`server:${serverId}`);

      return {
        playersInArena: arenaRoom ? arenaRoom.size : 0,
        totalConnected: serverRoom ? serverRoom.size : 0
      };
    } catch (error) {
      console.error('❌ Erreur getArenaRoomStats:', error);
      return { playersInArena: 0, totalConnected: 0 };
    }
  }

  /**
   * Broadcast message personnalisé à tous les joueurs d'arène d'un serveur
   */
  public static broadcastToArena(
    serverId: string,
    event: string,
    data: any,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): void {
    if (!this.io) return;

    this.io.to(`arena:${serverId}`).emit(event, {
      data,
      timestamp: new Date(),
      priority
    });

    console.log(`📢 Arena broadcast sent to ${serverId}: ${event}`);
  }
}

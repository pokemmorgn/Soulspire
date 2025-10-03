// server/src/services/websocket/WebSocketBestiary.ts
import { Server as SocketIOServer } from 'socket.io';

/**
 * SERVICE WEBSOCKET SPÉCIALISÉ BESTIAIRE
 * Toutes les notifications temps réel liées au système de Bestiaire
 */
export class WebSocketBestiary {
  private static io: SocketIOServer | null = null;

  // ===== INITIALISATION =====

  /**
   * Initialiser avec l'instance Socket.IO principale
   */
  public static initialize(socketInstance: SocketIOServer): void {
    this.io = socketInstance;
    console.log('✅ WebSocketBestiary initialized');
  }

  // ===== NOTIFICATIONS DE DÉCOUVERTE =====

  /**
   * Notifier découverte d'un nouveau monstre
   */
  public static notifyDiscovery(
    playerId: string,
    discoveryData: {
      monsterId: string;
      monsterName: string;
      monsterType: 'normal' | 'elite' | 'boss';
      element: string;
      rewards: Array<{
        type: string;
        amount: number;
      }>;
    }
  ): void {
    if (!this.io) {
      console.warn('⚠️ WebSocketBestiary not initialized');
      return;
    }

    this.io.to(`player:${playerId}`).emit('bestiary:discovery', {
      type: 'monster_discovered',
      data: discoveryData,
      timestamp: new Date(),
      animation: discoveryData.monsterType === 'boss' ? 'boss_discovery' : 'monster_discovery'
    });

    console.log(`📖 Monster discovered: ${discoveryData.monsterName} (${discoveryData.monsterType}) by ${playerId}`);
  }

  /**
   * Notifier progression de niveau (Novice/Veteran/Master)
   */
  public static notifyLevelUp(
    playerId: string,
    levelUpData: {
      monsterId: string;
      monsterName: string;
      previousLevel: string;
      newLevel: string;
      rewards: Array<{
        type: string;
        amount?: number;
        identifier?: string;
        description?: string;
      }>;
      unlockedFeatures?: string[];
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('bestiary:level_up', {
      type: 'bestiary_level_up',
      data: levelUpData,
      timestamp: new Date(),
      animation: levelUpData.newLevel === 'Master' ? 'master_achievement' : 'level_up'
    });

    console.log(`📈 Bestiary level up: ${levelUpData.monsterName} → ${levelUpData.newLevel} for ${playerId}`);
  }

  // ===== NOTIFICATIONS DE RÉCOMPENSES =====

  /**
   * Notifier récompense de complétion réclamée
   */
  public static notifyRewardClaimed(
    playerId: string,
    rewardData: {
      rewardId: string;
      rewardType: 'type_completion' | 'element_completion' | 'full_completion';
      rewards: {
        gems?: number;
        gold?: number;
        title?: string;
        bonus?: string;
      };
      completionPercentage: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('bestiary:reward_claimed', {
      type: 'reward_claimed',
      data: rewardData,
      timestamp: new Date(),
      animation: rewardData.rewardType === 'full_completion' ? 'legendary_reward' : 'reward_claim'
    });

    console.log(`🎁 Bestiary reward claimed: ${rewardData.rewardId} by ${playerId}`);
  }

  /**
   * Notifier complétion d'un groupe (type/élément)
   */
  public static notifyGroupCompletion(
    playerId: string,
    completionData: {
      groupType: 'type' | 'element';
      groupName: string;
      totalMonsters: number;
      completionPercentage: number;
      rewards: any;
      bonusUnlocked?: string;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('bestiary:group_completion', {
      type: 'group_completion',
      data: completionData,
      timestamp: new Date(),
      animation: 'group_complete',
      priority: 'high'
    });

    console.log(`🏆 Group completed: ${completionData.groupName} (${completionData.groupType}) by ${playerId}`);
  }

  /**
   * Notifier complétion totale du bestiaire (100%)
   */
  public static notifyFullCompletion(
    playerId: string,
    serverId: string,
    completionData: {
      playerId: string;
      playerName: string;
      completionTime: Date;
      totalMonsters: number;
      rewards: {
        gems: number;
        title: string;
        avatar?: string;
      };
    }
  ): void {
    if (!this.io) return;

    // Notification personnelle
    this.io.to(`player:${playerId}`).emit('bestiary:full_completion', {
      type: 'full_completion',
      data: completionData,
      timestamp: new Date(),
      animation: 'legendary_achievement',
      priority: 'critical'
    });

    // Broadcast au serveur pour célébrer
    this.io.to(`server:${serverId}`).emit('bestiary:player_completed', {
      type: 'player_completed_bestiary',
      data: {
        playerId: completionData.playerId,
        playerName: completionData.playerName,
        completionTime: completionData.completionTime
      },
      timestamp: new Date(),
      animation: 'server_celebration'
    });

    console.log(`🎊 BESTIARY COMPLETED! ${completionData.playerName} on ${serverId}`);
  }

  // ===== NOTIFICATIONS DE LEADERBOARD =====

  /**
   * Notifier mise à jour du leaderboard
   */
  public static notifyLeaderboardUpdate(
    serverId: string,
    leaderboardData: {
      topCollectors: Array<{
        playerId: string;
        playerName: string;
        totalDiscovered: number;
        totalMastered: number;
      }>;
      changes: Array<{
        playerId: string;
        oldRank: number;
        newRank: number;
      }>;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`server:${serverId}`).emit('bestiary:leaderboard_update', {
      type: 'leaderboard_update',
      data: leaderboardData,
      timestamp: new Date()
    });

    console.log(`📊 Bestiary leaderboard updated on ${serverId}: ${leaderboardData.changes.length} changes`);
  }

  /**
   * Notifier nouveau record personnel
   */
  public static notifyPersonalRecord(
    playerId: string,
    recordData: {
      recordType: 'fastest_kill' | 'most_defeated' | 'discovery_streak';
      monsterName?: string;
      value: number;
      previousValue: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('bestiary:personal_record', {
      type: 'personal_record',
      data: recordData,
      timestamp: new Date(),
      animation: 'record_celebration'
    });

    console.log(`🏅 Personal record: ${recordData.recordType} for ${playerId}`);
  }

  // ===== NOTIFICATIONS DE STATISTIQUES =====

  /**
   * Notifier statistiques de combat mises à jour
   */
  public static notifyStatsUpdate(
    playerId: string,
    statsData: {
      monsterId: string;
      monsterName: string;
      newStats: {
        timesDefeated: number;
        fastestKillTime?: number;
        totalDamageDealt: number;
      };
    }
  ): void {
    if (!this.io) return;

    // Notification discrète (pas d'animation)
    this.io.to(`player:${playerId}`).emit('bestiary:stats_update', {
      type: 'stats_update',
      data: statsData,
      timestamp: new Date()
    });
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Vérifier si le service est disponible
   */
  public static isAvailable(): boolean {
    return this.io !== null;
  }

  /**
   * Obtenir le nombre de joueurs dans les rooms Bestiaire
   */
  public static getBestiaryRoomStats(serverId: string): { playersInBestiary: number; totalConnected: number } {
    if (!this.io) return { playersInBestiary: 0, totalConnected: 0 };

    try {
      const bestiaryRoom = this.io.sockets.adapter.rooms.get(`bestiary:${serverId}`);
      const serverRoom = this.io.sockets.adapter.rooms.get(`server:${serverId}`);

      return {
        playersInBestiary: bestiaryRoom ? bestiaryRoom.size : 0,
        totalConnected: serverRoom ? serverRoom.size : 0
      };
    } catch (error) {
      console.error('❌ Erreur getBestiaryRoomStats:', error);
      return { playersInBestiary: 0, totalConnected: 0 };
    }
  }

  /**
   * Broadcast message personnalisé à tous les joueurs Bestiaire d'un serveur
   */
  public static broadcastToBestiary(
    serverId: string,
    event: string,
    data: any,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): void {
    if (!this.io) return;

    this.io.to(`bestiary:${serverId}`).emit(event, {
      data,
      timestamp: new Date(),
      priority
    });

    console.log(`📢 Bestiary broadcast sent to ${serverId}: ${event}`);
  }
}

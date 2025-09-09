// server/src/services/websocket/WebSocketAFK.ts
import { Server as SocketIOServer } from 'socket.io';

/**
 * SERVICE WEBSOCKET SPÉCIALISÉ AFK
 * Toutes les notifications temps réel liées au système AFK
 */
export class WebSocketAFK {
  private static io: SocketIOServer | null = null;

  // ===== INITIALISATION =====

  /**
   * Initialiser avec l'instance Socket.IO principale
   */
  public static initialize(socketInstance: SocketIOServer): void {
    this.io = socketInstance;
    console.log('✅ WebSocketAFK initialized');
  }

  // ===== NOTIFICATIONS DE FARMING =====

  /**
   * Notifier que le farming automatique a commencé
   */
  public static notifyFarmingStarted(
    playerId: string,
    farmingData: {
      location: string;
      expectedDuration: number;
      estimatedRewards: any;
      farmingType: 'progression' | 'materials' | 'fragments';
    }
  ): void {
    if (!this.io) {
      console.warn('⚠️ WebSocketAFK not initialized');
      return;
    }

    this.io.to(`player:${playerId}`).emit('afk:farming_started', {
      type: 'farming_started',
      data: farmingData,
      timestamp: new Date(),
      animation: 'farming_begin'
    });

    console.log(`🌾 AFK farming started for ${playerId}: ${farmingData.location} (${farmingData.farmingType})`);
  }

  /**
   * Notifier que le farming est terminé avec récompenses
   */
  public static notifyFarmingCompleted(
    playerId: string,
    completionData: {
      duration: number;
      location: string;
      rewards: {
        gold: number;
        exp: number;
        gems?: number;
        materials?: Record<string, number>;
        fragments?: Record<string, number>;
      };
      items?: string[];
      efficiency: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('afk:farming_completed', {
      type: 'farming_completed',
      data: completionData,
      timestamp: new Date(),
      animation: 'farming_success'
    });

    console.log(`✅ AFK farming completed for ${playerId}: ${completionData.duration}ms at ${completionData.location}`);
  }

  /**
   * Notifier la progression du farming en temps réel
   */
  public static notifyFarmingProgress(
    playerId: string,
    progressData: {
      elapsed: number;
      totalDuration: number;
      currentRewards: any;
      progressPercentage: number;
      location: string;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('afk:farming_progress', {
      type: 'farming_progress',
      data: progressData,
      timestamp: new Date()
    });

    // Pas de log pour éviter le spam, seulement aux jalons
    if (progressData.progressPercentage % 25 === 0) {
      console.log(`📈 AFK farming progress for ${playerId}: ${progressData.progressPercentage}% at ${progressData.location}`);
    }
  }

  /**
   * Notifier qu'un meilleur spot de farming a été trouvé
   */
  public static notifyOptimalLocationFound(
    playerId: string,
    locationData: {
      newLocation: string;
      oldLocation: string;
      efficiencyImprovement: number;
      recommendedReasons: string[];
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('afk:optimal_location_found', {
      type: 'optimal_location_found',
      data: locationData,
      timestamp: new Date(),
      animation: 'location_discovery'
    });

    console.log(`🎯 Optimal location found for ${playerId}: ${locationData.newLocation} (+${locationData.efficiencyImprovement}% efficiency)`);
  }

  // ===== NOTIFICATIONS DE RÉCOMPENSES =====

  /**
   * Notifier que les récompenses hors ligne ont été réclamées
   */
  public static notifyOfflineRewardsClaimed(
    playerId: string,
    rewardsData: {
      offlineTime: number;
      totalRewards: {
        gold: number;
        exp: number;
        gems: number;
        materials: Record<string, number>;
        fragments: Record<string, number>;
      };
      bonusMultiplier: number;
      cappedAt: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('afk:offline_rewards_claimed', {
      type: 'offline_rewards_claimed',
      data: rewardsData,
      timestamp: new Date(),
      animation: rewardsData.bonusMultiplier > 1 ? 'bonus_celebration' : 'normal_claim'
    });

    console.log(`💰 Offline rewards claimed by ${playerId}: ${Math.floor(rewardsData.offlineTime / 3600000)}h offline`);
  }

  /**
   * Notifier que de nouvelles récompenses idle sont disponibles
   */
  public static notifyIdleRewardsAvailable(
    playerId: string,
    availableData: {
      pendingRewards: any;
      timeAccumulated: number;
      canClaim: boolean;
      timeUntilCap: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('afk:idle_rewards_available', {
      type: 'idle_rewards_available',
      data: availableData,
      timestamp: new Date(),
      priority: availableData.timeUntilCap < 3600 ? 'high' : 'normal'
    });

    console.log(`⏰ Idle rewards available for ${playerId}: ${Math.floor(availableData.timeAccumulated / 60)}min accumulated`);
  }

  /**
   * Notifier l'activation d'un bonus de récompenses
   */
  public static notifyBonusRewardsActivated(
    playerId: string,
    bonusData: {
      bonusType: 'double' | 'triple' | 'vip' | 'event';
      multiplier: number;
      duration: number;
      source: string;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('afk:bonus_rewards_activated', {
      type: 'bonus_rewards_activated',
      data: bonusData,
      timestamp: new Date(),
      animation: 'bonus_activation'
    });

    console.log(`🚀 Bonus rewards activated for ${playerId}: x${bonusData.multiplier} from ${bonusData.source}`);
  }

  // ===== NOTIFICATIONS D'OPTIMISATION =====

  /**
   * Notifier que la formation a été auto-optimisée
   */
  public static notifyFormationOptimized(
    playerId: string,
    optimizationData: {
      oldFormation: any;
      newFormation: any;
      powerIncrease: number;
      optimizedFor: 'damage' | 'survival' | 'balanced';
      changes: string[];
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('afk:formation_optimized', {
      type: 'formation_optimized',
      data: optimizationData,
      timestamp: new Date(),
      animation: 'formation_change'
    });

    console.log(`⚔️ Formation optimized for ${playerId}: +${optimizationData.powerIncrease}% power (${optimizationData.optimizedFor})`);
  }

  /**
   * Notifier que l'équipement a été amélioré automatiquement
   */
  public static notifyEquipmentUpgraded(
    playerId: string,
    upgradeData: {
      itemsUpgraded: Array<{
        itemId: string;
        oldLevel: number;
        newLevel: number;
        powerGain: number;
      }>;
      totalCost: number;
      totalPowerGain: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('afk:equipment_upgraded', {
      type: 'equipment_upgraded',
      data: upgradeData,
      timestamp: new Date(),
      animation: 'equipment_shine'
    });

    console.log(`🔧 Equipment auto-upgraded for ${playerId}: ${upgradeData.itemsUpgraded.length} items, +${upgradeData.totalPowerGain} power`);
  }

  /**
   * Notifier que le joueur est bloqué avec recommandations
   */
  public static notifyProgressStuck(
    playerId: string,
    stuckData: {
      currentStage: string;
      timeStuck: number;
      recommendations: Array<{
        type: 'upgrade' | 'formation' | 'ascension';
        description: string;
        priority: 'low' | 'medium' | 'high';
        cost?: number;
      }>;
      canAutoFix: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('afk:progress_stuck', {
      type: 'progress_stuck',
      data: stuckData,
      timestamp: new Date(),
      animation: 'stuck_warning',
      priority: 'high'
    });

    console.log(`⚠️ Progress stuck notification for ${playerId}: ${Math.floor(stuckData.timeStuck / 3600000)}h at ${stuckData.currentStage}`);
  }

  // ===== NOTIFICATIONS D'ÉVÉNEMENTS SPÉCIAUX =====

  /**
   * Notifier l'activation d'un événement double XP
   */
  public static notifyDoubleExpEvent(
    serverId: string,
    eventData: {
      eventType: 'double_exp' | 'double_gold' | 'double_drops';
      duration: number;
      description: string;
      multiplier: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`afk:${serverId}`).emit('afk:double_exp_event', {
      type: 'double_exp_event',
      data: eventData,
      timestamp: new Date(),
      animation: 'event_celebration',
      priority: 'high'
    });

    console.log(`🎉 Double EXP event started on ${serverId}: x${eventData.multiplier} for ${eventData.duration}h`);
  }

  /**
   * Notifier un drop rare pendant le farming
   */
  public static notifyRareDrop(
    playerId: string,
    dropData: {
      itemName: string;
      itemRarity: 'rare' | 'epic' | 'legendary';
      location: string;
      dropChance: number;
      itemValue: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('afk:rare_drop', {
      type: 'rare_drop',
      data: dropData,
      timestamp: new Date(),
      animation: dropData.itemRarity === 'legendary' ? 'legendary_drop' : 'rare_drop'
    });

    console.log(`💎 Rare drop for ${playerId}: ${dropData.itemName} (${dropData.itemRarity}) at ${dropData.location}`);
  }

  /**
   * Notifier qu'un palier important a été atteint
   */
  public static notifyMilestoneReached(
    playerId: string,
    milestoneData: {
      milestoneType: 'level' | 'world' | 'power' | 'time_played';
      value: number;
      description: string;
      rewards: any;
      isSpecial: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('afk:milestone_reached', {
      type: 'milestone_reached',
      data: milestoneData,
      timestamp: new Date(),
      animation: milestoneData.isSpecial ? 'special_milestone' : 'milestone_celebration'
    });

    console.log(`🏆 Milestone reached by ${playerId}: ${milestoneData.description} (${milestoneData.milestoneType}: ${milestoneData.value})`);
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Vérifier si le service est disponible
   */
  public static isAvailable(): boolean {
    return this.io !== null;
  }

  /**
   * Obtenir le nombre de joueurs connectés dans les rooms AFK
   */
  public static getAfkRoomStats(serverId: string): { playersInAfk: number; totalConnected: number } {
    if (!this.io) return { playersInAfk: 0, totalConnected: 0 };

    try {
      const afkRoom = this.io.sockets.adapter.rooms.get(`afk:${serverId}`);
      const serverRoom = this.io.sockets.adapter.rooms.get(`server:${serverId}`);

      return {
        playersInAfk: afkRoom ? afkRoom.size : 0,
        totalConnected: serverRoom ? serverRoom.size : 0
      };
    } catch (error) {
      console.error('❌ Erreur getAfkRoomStats:', error);
      return { playersInAfk: 0, totalConnected: 0 };
    }
  }

  /**
   * Broadcast message personnalisé à tous les joueurs AFK d'un serveur
   */
  public static broadcastToAfk(
    serverId: string,
    event: string,
    data: any,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): void {
    if (!this.io) return;

    this.io.to(`afk:${serverId}`).emit(event, {
      data,
      timestamp: new Date(),
      priority
    });

    console.log(`📢 AFK broadcast sent to ${serverId}: ${event}`);
  }
}

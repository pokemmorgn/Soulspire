// server/src/services/websocket/WebSocketCampaign.ts
import { Server as SocketIOServer } from 'socket.io';

/**
 * SERVICE WEBSOCKET SPÉCIALISÉ CAMPAGNE
 * Toutes les notifications temps réel liées au système de campagne
 */
export class WebSocketCampaign {
  private static io: SocketIOServer | null = null;

  // ===== INITIALISATION =====

  /**
   * Initialiser avec l'instance Socket.IO principale
   */
  public static initialize(socketInstance: SocketIOServer): void {
    this.io = socketInstance;
    console.log('✅ WebSocketCampaign initialized');
  }

  // ===== NOTIFICATIONS DE COMBAT =====

  /**
   * Notifier le début d'un combat de campagne
   */
  public static notifyBattleStarted(
    playerId: string,
    battleData: {
      worldId: number;
      levelIndex: number;
      difficulty: 'Normal' | 'Hard' | 'Nightmare';
      worldName: string;
      levelName: string;
      enemyType: 'normal' | 'elite' | 'boss';
      estimatedDuration: number;
      staminaCost: number;
    }
  ): void {
    if (!this.io) {
      console.warn('⚠️ WebSocketCampaign not initialized');
      return;
    }

    this.io.to(`player:${playerId}`).emit('campaign:battle_started', {
      type: 'battle_started',
      data: battleData,
      timestamp: new Date(),
      animation: battleData.enemyType === 'boss' ? 'boss_battle_begin' : 'battle_begin'
    });

    console.log(`⚔️ Campaign battle started for ${playerId}: ${battleData.worldId}-${battleData.levelIndex} (${battleData.difficulty})`);
  }

  /**
   * Notifier le résultat d'un combat de campagne
   */
  public static notifyBattleCompleted(
    playerId: string,
    battleResult: {
      worldId: number;
      levelIndex: number;
      difficulty: string;
      victory: boolean;
      starsEarned: number;
      rewards: {
        experience: number;
        gold: number;
        items: string[];
        fragments: any[];
      };
      battleStats: {
        duration: number;
        totalTurns: number;
        damageDealt: number;
        criticalHits: number;
      };
      progression: {
        newLevelUnlocked: boolean;
        newWorldUnlocked: boolean;
        playerLevelUp: boolean;
        newPlayerLevel?: number;
      };
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:battle_completed', {
      type: 'battle_completed',
      data: battleResult,
      timestamp: new Date(),
      animation: battleResult.victory ? 
        (battleResult.starsEarned === 3 ? 'perfect_victory' : 'victory') : 
        'defeat'
    });

    console.log(`✅ Campaign battle completed for ${playerId}: ${battleResult.victory ? 'Victory' : 'Defeat'} (${battleResult.starsEarned} stars)`);
  }

  /**
   * Notifier la progression du combat en temps réel
   */
  public static notifyBattleProgress(
    playerId: string,
    progressData: {
      currentTurn: number;
      totalTurns: number;
      playerHealth: number;
      enemyHealth: number;
      recentAction: string;
      criticalHit: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:battle_progress', {
      type: 'battle_progress',
      data: progressData,
      timestamp: new Date()
    });

    // Log seulement pour les actions importantes
    if (progressData.criticalHit) {
      console.log(`💥 Critical hit in campaign battle for ${playerId}: ${progressData.recentAction}`);
    }
  }

  // ===== NOTIFICATIONS DE PROGRESSION =====

  /**
   * Notifier qu'un nouveau niveau a été débloqué
   */
  public static notifyLevelUnlocked(
    playerId: string,
    unlockData: {
      worldId: number;
      levelIndex: number;
      worldName: string;
      levelName: string;
      difficulty: string;
      rewards: any;
      isLastLevel: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:level_unlocked', {
      type: 'level_unlocked',
      data: unlockData,
      timestamp: new Date(),
      animation: unlockData.isLastLevel ? 'world_completion' : 'level_unlock'
    });

    console.log(`🔓 Level unlocked for ${playerId}: ${unlockData.worldId}-${unlockData.levelIndex} (${unlockData.difficulty})`);
  }

  /**
   * Notifier qu'un nouveau monde a été débloqué
   */
  public static notifyWorldUnlocked(
    playerId: string,
    worldData: {
      worldId: number;
      worldName: string;
      description: string;
      mapTheme: string;
      levelCount: number;
      recommendedPower: number;
      elementBias: string[];
      unlockedBy: {
        playerLevel: number;
        previousWorld?: number;
      };
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:world_unlocked', {
      type: 'world_unlocked',
      data: worldData,
      timestamp: new Date(),
      animation: 'world_discovery'
    });

    console.log(`🌍 New world unlocked for ${playerId}: ${worldData.worldName} (World ${worldData.worldId})`);
  }

  /**
   * Notifier qu'une nouvelle difficulté a été débloquée
   */
  public static notifyDifficultyUnlocked(
    playerId: string,
    difficultyData: {
      difficulty: 'Hard' | 'Nightmare';
      unlockedBy: string;
      description: string;
      bonusRewards: {
        experienceMultiplier: number;
        goldMultiplier: number;
        exclusiveItems: string[];
      };
      accessibleWorlds: number[];
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:difficulty_unlocked', {
      type: 'difficulty_unlocked',
      data: difficultyData,
      timestamp: new Date(),
      animation: difficultyData.difficulty === 'Nightmare' ? 'nightmare_unlock' : 'hard_unlock'
    });

    console.log(`🔥 Difficulty ${difficultyData.difficulty} unlocked for ${playerId}`);
  }

  /**
   * Notifier le gain d'étoiles et jalons
   */
  public static notifyStarMilestone(
    playerId: string,
    milestoneData: {
      worldId: number;
      worldName: string;
      currentStars: number;
      maxStars: number;
      milestone: number;
      rewards: any;
      isWorldCompleted: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:star_milestone', {
      type: 'star_milestone',
      data: milestoneData,
      timestamp: new Date(),
      animation: milestoneData.isWorldCompleted ? 'world_mastery' : 'star_milestone'
    });

    console.log(`⭐ Star milestone for ${playerId}: ${milestoneData.currentStars}/${milestoneData.maxStars} in World ${milestoneData.worldId}`);
  }

  // ===== NOTIFICATIONS DE RÉCOMPENSES =====

  /**
   * Notifier les récompenses de premier passage
   */
  public static notifyFirstClearRewards(
    playerId: string,
    rewardsData: {
      worldId: number;
      levelIndex: number;
      difficulty: string;
      rewards: {
        experience: number;
        gold: number;
        gems?: number;
        items: string[];
        fragments: any[];
      };
      bonusRewards: any[];
      isSpecialLevel: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:first_clear_rewards', {
      type: 'first_clear_rewards',
      data: rewardsData,
      timestamp: new Date(),
      animation: rewardsData.isSpecialLevel ? 'special_rewards' : 'first_clear_celebration'
    });

    console.log(`🎁 First clear rewards for ${playerId}: ${rewardsData.worldId}-${rewardsData.levelIndex} (${rewardsData.difficulty})`);
  }

  /**
   * Notifier les récompenses de perfectionnement (3 étoiles)
   */
  public static notifyPerfectClearRewards(
    playerId: string,
    perfectData: {
      worldId: number;
      levelIndex: number;
      difficulty: string;
      perfectRewards: any;
      achievementUnlocked?: string;
      perfectCount: number;
      totalLevels: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:perfect_clear_rewards', {
      type: 'perfect_clear_rewards',
      data: perfectData,
      timestamp: new Date(),
      animation: 'perfect_mastery'
    });

    console.log(`🌟 Perfect clear for ${playerId}: ${perfectData.worldId}-${perfectData.levelIndex} (${perfectData.perfectCount}/${perfectData.totalLevels})`);
  }

  /**
   * Notifier les récompenses de complétion de monde
   */
  public static notifyWorldCompletionRewards(
    playerId: string,
    completionData: {
      worldId: number;
      worldName: string;
      difficulty: string;
      completionRewards: any;
      totalStars: number;
      maxStars: number;
      completionPercentage: number;
      nextWorldUnlocked?: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:world_completion_rewards', {
      type: 'world_completion_rewards',
      data: completionData,
      timestamp: new Date(),
      animation: 'world_completion_celebration'
    });

    console.log(`🏆 World ${completionData.worldId} completed by ${playerId} on ${completionData.difficulty} (${completionData.totalStars}/${completionData.maxStars} stars)`);
  }

  // ===== NOTIFICATIONS D'ÉVÉNEMENTS SPÉCIAUX =====

  /**
   * Notifier l'activation d'un événement campagne (double XP, etc.)
   */
  public static notifyCampaignEvent(
    serverId: string,
    eventData: {
      eventType: 'double_exp' | 'double_gold' | 'double_drops' | 'free_stamina';
      duration: number;
      description: string;
      multiplier?: number;
      affectedWorlds?: number[];
    }
  ): void {
    if (!this.io) return;

    this.io.to(`campaign:${serverId}`).emit('campaign:event_active', {
      type: 'campaign_event_active',
      data: eventData,
      timestamp: new Date(),
      animation: 'event_celebration',
      priority: 'high'
    });

    console.log(`🎉 Campaign event started on ${serverId}: ${eventData.eventType} for ${eventData.duration}h`);
  }

  /**
   * Notifier un drop rare spécial
   */
  public static notifyRareDrop(
    playerId: string,
    dropData: {
      worldId: number;
      levelIndex: number;
      itemName: string;
      itemRarity: 'rare' | 'epic' | 'legendary';
      dropChance: number;
      isFirstTime: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:rare_drop', {
      type: 'rare_drop',
      data: dropData,
      timestamp: new Date(),
      animation: dropData.itemRarity === 'legendary' ? 'legendary_drop' : 'rare_drop'
    });

    console.log(`💎 Rare drop for ${playerId}: ${dropData.itemName} (${dropData.itemRarity}) in ${dropData.worldId}-${dropData.levelIndex}`);
  }

  /**
   * Notifier une performance exceptionnelle
   */
  public static notifyExceptionalPerformance(
    playerId: string,
    performanceData: {
      worldId: number;
      levelIndex: number;
      achievement: 'speed_run' | 'no_damage' | 'critical_master' | 'perfect_combo';
      description: string;
      bonusRewards: any;
      newRecord?: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:exceptional_performance', {
      type: 'exceptional_performance',
      data: performanceData,
      timestamp: new Date(),
      animation: performanceData.newRecord ? 'new_record' : 'exceptional_performance'
    });

    console.log(`🏅 Exceptional performance by ${playerId}: ${performanceData.achievement} in ${performanceData.worldId}-${performanceData.levelIndex}`);
  }

  // ===== NOTIFICATIONS RECOMMANDATIONS =====

  /**
   * Notifier des recommandations intelligentes
   */
  public static notifySmartRecommendation(
    playerId: string,
    recommendationData: {
      type: 'team_upgrade' | 'difficulty_switch' | 'retry_strategy' | 'farming_suggestion';
      title: string;
      description: string;
      actionSuggestion: string;
      currentContext: {
        worldId: number;
        levelIndex: number;
        difficulty: string;
        recentFailures: number;
      };
      priority: 'low' | 'medium' | 'high';
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:smart_recommendation', {
      type: 'smart_recommendation',
      data: recommendationData,
      timestamp: new Date(),
      priority: recommendationData.priority
    });

    console.log(`💡 Smart recommendation for ${playerId}: ${recommendationData.type} (${recommendationData.priority} priority)`);
  }

  /**
   * Notifier qu'un joueur est bloqué avec suggestions
   */
  public static notifyProgressBlocked(
    playerId: string,
    blockedData: {
      worldId: number;
      levelIndex: number;
      difficulty: string;
      failureCount: number;
      blockedTime: number;
      suggestions: Array<{
        type: 'level_heroes' | 'upgrade_equipment' | 'change_formation' | 'lower_difficulty';
        description: string;
        cost?: number;
        effectiveness: number;
      }>;
      canAutoResolve: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('campaign:progress_blocked', {
      type: 'progress_blocked',
      data: blockedData,
      timestamp: new Date(),
      animation: 'progress_stuck',
      priority: 'high'
    });

    console.log(`⚠️ Progress blocked for ${playerId}: ${blockedData.worldId}-${blockedData.levelIndex} (${blockedData.failureCount} failures)`);
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Vérifier si le service est disponible
   */
  public static isAvailable(): boolean {
    return this.io !== null;
  }

  /**
   * Obtenir le nombre de joueurs connectés dans les rooms de campagne
   */
  public static getCampaignRoomStats(serverId: string): { playersInCampaign: number; totalConnected: number } {
    if (!this.io) return { playersInCampaign: 0, totalConnected: 0 };

    try {
      const campaignRoom = this.io.sockets.adapter.rooms.get(`campaign:${serverId}`);
      const serverRoom = this.io.sockets.adapter.rooms.get(`server:${serverId}`);

      return {
        playersInCampaign: campaignRoom ? campaignRoom.size : 0,
        totalConnected: serverRoom ? serverRoom.size : 0
      };
    } catch (error) {
      console.error('❌ Erreur getCampaignRoomStats:', error);
      return { playersInCampaign: 0, totalConnected: 0 };
    }
  }

  /**
   * Broadcast message personnalisé à tous les joueurs de campagne d'un serveur
   */
  public static broadcastToCampaign(
    serverId: string,
    event: string,
    data: any,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): void {
    if (!this.io) return;

    this.io.to(`campaign:${serverId}`).emit(event, {
      data,
      timestamp: new Date(),
      priority
    });

    console.log(`📢 Campaign broadcast sent to ${serverId}: ${event}`);
  }

  /**
   * Notifier un groupe de joueurs d'un événement de campagne
   */
  public static notifyPlayersGroup(
    playerIds: string[],
    event: string,
    data: any
  ): void {
    if (!this.io || playerIds.length === 0) return;

    playerIds.forEach(playerId => {
      this.io!.to(`player:${playerId}`).emit(event, {
        data,
        timestamp: new Date()
      });
    });

    console.log(`👥 Group notification sent to ${playerIds.length} players: ${event}`);
  }
}

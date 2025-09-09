// server/src/services/websocket/WebSocketGacha.ts
import { Server as SocketIOServer } from 'socket.io';

/**
 * SERVICE WEBSOCKET SPÉCIALISÉ GACHA
 * Toutes les notifications temps réel liées au système de gacha
 */
export class WebSocketGacha {
  private static io: SocketIOServer | null = null;

  // ===== INITIALISATION =====

  /**
   * Initialiser avec l'instance Socket.IO principale
   */
  public static initialize(socketInstance: SocketIOServer): void {
    this.io = socketInstance;
    console.log('✅ WebSocketGacha initialized');
  }

  // ===== NOTIFICATIONS DE PULLS =====

  /**
   * Notifier le résultat d'un pull simple
   */
  public static notifyPullResult(
    playerId: string,
    pullResult: {
      hero: {
        id: string;
        name: string;
        rarity: string;
        element: string;
        role: string;
      };
      isNew: boolean;
      fragmentsGained: number;
      isFocus: boolean;
      bannerId: string;
      bannerName: string;
      cost: { gems?: number; tickets?: number };
      pullNumber: number;
    }
  ): void {
    if (!this.io) {
      console.warn('⚠️ WebSocketGacha not initialized');
      return;
    }

    const animation = this.getPullAnimation(pullResult.hero.rarity, pullResult.isFocus, pullResult.isNew);

    this.io.to(`player:${playerId}`).emit('gacha:pull_result', {
      type: 'pull_result',
      data: pullResult,
      timestamp: new Date(),
      animation,
      sound: this.getPullSound(pullResult.hero.rarity)
    });

    console.log(`🎰 Pull result sent to ${playerId}: ${pullResult.hero.name} (${pullResult.hero.rarity}) from ${pullResult.bannerName}`);
  }

  /**
   * Notifier le résultat d'un multi-pull (10x)
   */
  public static notifyMultiPullResult(
    playerId: string,
    multiPullResult: {
      bannerId: string;
      bannerName: string;
      heroes: Array<{
        hero: any;
        rarity: string;
        isNew: boolean;
        fragmentsGained: number;
        isFocus: boolean;
      }>;
      summary: {
        legendary: number;
        epic: number;
        rare: number;
        common: number;
        newHeroes: number;
        totalFragments: number;
        focusHeroes: number;
      };
      cost: { gems?: number; tickets?: number };
      specialEffects: {
        hasPityBreak: boolean;
        hasMultipleLegendary: boolean;
        perfectPull: boolean; // 10x avec que des Epic+
      };
    }
  ): void {
    if (!this.io) return;

    const animation = this.getMultiPullAnimation(multiPullResult.summary, multiPullResult.specialEffects);

    this.io.to(`player:${playerId}`).emit('gacha:multi_pull_result', {
      type: 'multi_pull_result',
      data: multiPullResult,
      timestamp: new Date(),
      animation,
      sound: this.getMultiPullSound(multiPullResult.summary.legendary, multiPullResult.specialEffects)
    });

    console.log(`🎰🎰 Multi-pull result sent to ${playerId}: ${multiPullResult.heroes.length} heroes from ${multiPullResult.bannerName} (${multiPullResult.summary.legendary}L/${multiPullResult.summary.epic}E)`);
  }

  /**
   * Notifier animation de pull en cours
   */
  public static notifyPullStarted(
    playerId: string,
    pullData: {
      bannerId: string;
      bannerName: string;
      pullType: 'single' | 'multi';
      cost: { gems?: number; tickets?: number };
      anticipatedDuration: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('gacha:pull_started', {
      type: 'pull_started',
      data: pullData,
      timestamp: new Date(),
      animation: pullData.pullType === 'multi' ? 'multi_pull_animation' : 'single_pull_animation'
    });

    console.log(`🎲 Pull started for ${playerId}: ${pullData.pullType} on ${pullData.bannerName}`);
  }

  // ===== NOTIFICATIONS DE DROPS RARES =====

  /**
   * Notifier un drop légendaire spectaculaire
   */
  public static notifyLegendaryDrop(
    playerId: string,
    serverId: string,
    legendaryData: {
      hero: {
        id: string;
        name: string;
        rarity: string;
        element: string;
        role: string;
      };
      bannerId: string;
      bannerName: string;
      isFirstTime: boolean;
      isFocus: boolean;
      pullsSinceLast: number;
      totalLegendaryCount: number;
      dropRate: number;
    }
  ): void {
    if (!this.io) return;

    // Notification personnelle avec animation spéciale
    this.io.to(`player:${playerId}`).emit('gacha:legendary_drop', {
      type: 'legendary_drop',
      data: legendaryData,
      timestamp: new Date(),
      animation: legendaryData.isFocus ? 'focus_legendary_celebration' : 'legendary_celebration',
      sound: 'legendary_fanfare',
      priority: 'high'
    });

    // Si c'est un héros focus ou très rare, annoncer au serveur
    if (legendaryData.isFocus || legendaryData.dropRate < 1) {
      this.io.to(`gacha:${serverId}`).emit('gacha:rare_legendary_announcement', {
        type: 'rare_legendary_announcement',
        data: {
          playerName: `Player_${playerId.slice(-4)}`, // Masquer ID complet
          heroName: legendaryData.hero.name,
          bannerName: legendaryData.bannerName,
          isUltraRare: legendaryData.dropRate < 0.5
        },
        timestamp: new Date(),
        animation: 'server_celebration'
      });

      console.log(`👑 Rare legendary announcement for server ${serverId}: ${legendaryData.hero.name} (${legendaryData.dropRate}% rate)`);
    }

    console.log(`🌟 Legendary drop sent to ${playerId}: ${legendaryData.hero.name} after ${legendaryData.pullsSinceLast} pulls`);
  }

  /**
   * Notifier streak de chance exceptionnelle
   */
  public static notifyLuckyStreak(
    playerId: string,
    streakData: {
      consecutiveRareDrops: number;
      streakType: 'epic_streak' | 'legendary_streak' | 'focus_streak';
      recentHeroes: string[];
      probability: number;
      bonusReward?: any;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('gacha:lucky_streak', {
      type: 'lucky_streak',
      data: streakData,
      timestamp: new Date(),
      animation: 'lucky_streak_celebration',
      sound: 'streak_success'
    });

    console.log(`🍀 Lucky streak notification for ${playerId}: ${streakData.consecutiveRareDrops}x ${streakData.streakType} (${streakData.probability}% chance)`);
  }

  /**
   * Notifier drop d'un héros ultra-rare ou limité
   */
  public static notifyUltraRareDrop(
    playerId: string,
    serverId: string,
    ultraRareData: {
      hero: any;
      rarity: 'mythic' | 'celestial' | 'limited_exclusive';
      bannerId: string;
      globalDropCount: number;
      serverFirstDrop: boolean;
      dropRate: number;
    }
  ): void {
    if (!this.io) return;

    // Notification personnelle
    this.io.to(`player:${playerId}`).emit('gacha:ultra_rare_drop', {
      type: 'ultra_rare_drop',
      data: ultraRareData,
      timestamp: new Date(),
      animation: 'ultra_rare_celebration',
      sound: 'mythic_fanfare'
    });

    // Announcement global serveur pour les drops ultra-rares
    this.io.to(`gacha:${serverId}`).emit('gacha:ultra_rare_global_announcement', {
      type: 'ultra_rare_global_announcement',
      data: {
        heroName: ultraRareData.hero.name,
        rarity: ultraRareData.rarity,
        globalCount: ultraRareData.globalDropCount,
        isServerFirst: ultraRareData.serverFirstDrop
      },
      timestamp: new Date(),
      animation: 'global_celebration'
    });

    console.log(`💫 Ultra-rare drop for ${playerId}: ${ultraRareData.hero.name} (${ultraRareData.rarity}) - Server first: ${ultraRareData.serverFirstDrop}`);
  }

  // ===== NOTIFICATIONS SYSTÈME PITY =====

  /**
   * Notifier progression du système pity
   */
  public static notifyPityProgress(
    playerId: string,
    pityData: {
      bannerId: string;
      bannerName: string;
      currentPulls: number;
      pityThreshold: number;
      pullsRemaining: number;
      pityType: 'legendary' | 'epic';
      progressPercentage: number;
      isSharedPity: boolean;
    }
  ): void {
    if (!this.io) return;

    // Ne notifier que si on approche du pity (derniers 10 pulls)
    if (pityData.pullsRemaining <= 10) {
      this.io.to(`player:${playerId}`).emit('gacha:pity_progress', {
        type: 'pity_progress',
        data: pityData,
        timestamp: new Date(),
        animation: pityData.pullsRemaining <= 3 ? 'pity_imminent' : 'pity_approaching',
        priority: pityData.pullsRemaining <= 3 ? 'high' : 'normal'
      });

      console.log(`📊 Pity progress for ${playerId}: ${pityData.pullsRemaining} pulls until ${pityData.pityType} guarantee on ${pityData.bannerName}`);
    }
  }

  /**
   * Notifier que le pity a été atteint/reset
   */
  public static notifyPityTriggered(
    playerId: string,
    pityResult: {
      bannerId: string;
      bannerName: string;
      pityType: 'legendary' | 'epic';
      guaranteedHero: any;
      pullsToTrigger: number;
      newPityCount: number;
      bonusRewards?: any;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('gacha:pity_triggered', {
      type: 'pity_triggered',
      data: pityResult,
      timestamp: new Date(),
      animation: 'pity_guarantee_celebration',
      sound: 'pity_success'
    });

    console.log(`🎯 Pity triggered for ${playerId}: ${pityResult.pityType} guarantee after ${pityResult.pullsToTrigger} pulls on ${pityResult.bannerName}`);
  }

  /**
   * Notifier recommandation liée au pity
   */
  public static notifyPityRecommendation(
    playerId: string,
    recommendation: {
      type: 'save_for_pity' | 'pull_now_pity_close' | 'switch_banner_better_pity';
      bannerId: string;
      bannerName: string;
      reason: string;
      pullsFromPity: number;
      resourcesNeeded: { gems?: number; tickets?: number };
      priority: 'low' | 'medium' | 'high';
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('gacha:pity_recommendation', {
      type: 'pity_recommendation',
      data: recommendation,
      timestamp: new Date(),
      priority: recommendation.priority
    });

    console.log(`💡 Pity recommendation for ${playerId}: ${recommendation.type} on ${recommendation.bannerName} (${recommendation.priority} priority)`);
  }

  // ===== NOTIFICATIONS D'ÉVÉNEMENTS GACHA =====

  /**
   * Notifier activation d'événement rate-up
   */
  public static notifyRateUpEvent(
    serverId: string,
    eventData: {
      eventType: 'rate_up' | 'double_legendary' | 'guaranteed_focus';
      bannerId: string;
      bannerName: string;
      duration: number; // en heures
      focusHeroes: string[];
      bonusMultiplier: number;
      description: string;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`gacha:${serverId}`).emit('gacha:rate_up_event', {
      type: 'rate_up_event',
      data: eventData,
      timestamp: new Date(),
      animation: 'rate_up_celebration',
      sound: 'event_fanfare',
      priority: 'high'
    });

    console.log(`🚀 Rate-up event started on ${serverId}: ${eventData.eventType} for ${eventData.bannerName} (x${eventData.bonusMultiplier}, ${eventData.duration}h)`);
  }

  /**
   * Notifier événement pulls gratuits
   */
  public static notifyFreePullsEvent(
    serverId: string,
    freeEventData: {
      eventName: string;
      bannerId: string;
      bannerName: string;
      freePullsCount: number;
      duration: number;
      restrictions?: string[];
      specialRewards?: any;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`gacha:${serverId}`).emit('gacha:free_pulls_event', {
      type: 'free_pulls_event',
      data: freeEventData,
      timestamp: new Date(),
      animation: 'free_pulls_celebration',
      priority: 'high'
    });

    console.log(`🎁 Free pulls event started on ${serverId}: ${freeEventData.freePullsCount} free pulls on ${freeEventData.bannerName}`);
  }

  /**
   * Notifier activation bannière limitée spéciale
   */
  public static notifySpecialBannerLive(
    serverId: string,
    bannerData: {
      bannerId: string;
      bannerName: string;
      bannerType: 'limited' | 'anniversary' | 'collaboration';
      exclusiveHeroes: string[];
      duration: number;
      specialMechanics?: string[];
      guaranteedRewards?: any;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`gacha:${serverId}`).emit('gacha:special_banner_live', {
      type: 'special_banner_live',
      data: bannerData,
      timestamp: new Date(),
      animation: bannerData.bannerType === 'anniversary' ? 'anniversary_celebration' : 'special_banner_reveal',
      sound: 'banner_fanfare',
      priority: 'high'
    });

    console.log(`🌟 Special banner live on ${serverId}: ${bannerData.bannerName} (${bannerData.bannerType}) with ${bannerData.exclusiveHeroes.length} exclusive heroes`);
  }

  // ===== NOTIFICATIONS DE COLLECTION =====

  /**
   * Notifier qu'un nouveau héros a été obtenu pour la première fois
   */
  public static notifyNewHeroObtained(
    playerId: string,
    newHeroData: {
      hero: any;
      bannerId: string;
      bannerName: string;
      collectionProgress: {
        totalHeroes: number;
        ownedHeroes: number;
        completionPercentage: number;
      };
      rarityMilestone?: {
        rarity: string;
        count: number;
        milestone: number;
        rewards?: any;
      };
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('gacha:new_hero_obtained', {
      type: 'new_hero_obtained',
      data: newHeroData,
      timestamp: new Date(),
      animation: 'new_hero_celebration',
      sound: 'collection_success'
    });

    console.log(`📚 New hero obtained by ${playerId}: ${newHeroData.hero.name} (Collection: ${newHeroData.collectionProgress.ownedHeroes}/${newHeroData.collectionProgress.totalHeroes})`);
  }

  /**
   * Notifier complétion d'une collection spéciale
   */
  public static notifyCollectionCompleted(
    playerId: string,
    collectionData: {
      collectionType: 'element' | 'role' | 'rarity' | 'banner_exclusive';
      collectionName: string;
      completedHeroes: string[];
      completionRewards: any;
      isServerFirst?: boolean;
      nextCollection?: string;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('gacha:collection_completed', {
      type: 'collection_completed',
      data: collectionData,
      timestamp: new Date(),
      animation: collectionData.isServerFirst ? 'server_first_collection' : 'collection_mastery',
      sound: 'collection_complete'
    });

    console.log(`🏆 Collection completed by ${playerId}: ${collectionData.collectionName} (${collectionData.completedHeroes.length} heroes)`);
  }

  /**
   * Notifier jalons de collection
   */
  public static notifyCollectionMilestone(
    playerId: string,
    milestoneData: {
      milestoneType: '50_heroes' | '100_heroes' | 'all_legendary' | 'all_elements';
      currentCount: number;
      targetCount: number;
      description: string;
      rewards: any;
      nextMilestone?: string;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('gacha:collection_milestone', {
      type: 'collection_milestone',
      data: milestoneData,
      timestamp: new Date(),
      animation: 'milestone_celebration'
    });

    console.log(`🎯 Collection milestone for ${playerId}: ${milestoneData.description} (${milestoneData.currentCount}/${milestoneData.targetCount})`);
  }

  // ===== NOTIFICATIONS DE RECOMMANDATIONS =====

  /**
   * Notifier recommandations intelligentes de pull
   */
  public static notifySmartRecommendation(
    playerId: string,
    recommendation: {
      type: 'save_resources' | 'pull_now_optimal' | 'switch_banner' | 'wait_for_event';
      title: string;
      description: string;
      reasoning: string[];
      suggestedAction: string;
      bannerId?: string;
      resourceImpact: {
        gemsNeeded?: number;
        ticketsNeeded?: number;
        expectedReward?: string;
      };
      priority: 'low' | 'medium' | 'high';
      timeRelevant: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('gacha:smart_recommendation', {
      type: 'smart_recommendation',
      data: recommendation,
      timestamp: new Date(),
      priority: recommendation.priority,
      timeRelevant: recommendation.timeRelevant
    });

    console.log(`💡 Smart gacha recommendation for ${playerId}: ${recommendation.type} (${recommendation.priority} priority)`);
  }

  /**
   * Notifier optimisation de ressources
   */
  public static notifyResourceOptimization(
    playerId: string,
    optimizationData: {
      currentResources: { gems: number; tickets: number };
      suggestedAllocation: {
        bannerId: string;
        bannerName: string;
        recommendedPulls: number;
        expectedLegendary: number;
        expectedNew: number;
      }[];
      efficiencyScore: number;
      reasoning: string;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('gacha:resource_optimization', {
      type: 'resource_optimization',
      data: optimizationData,
      timestamp: new Date(),
      priority: 'medium'
    });

    console.log(`📊 Resource optimization for ${playerId}: ${optimizationData.efficiencyScore}% efficiency across ${optimizationData.suggestedAllocation.length} banners`);
  }

  // ===== MÉTHODES UTILITAIRES PRIVÉES =====

  /**
   * Déterminer l'animation selon la rareté et le contexte
   */
  private static getPullAnimation(rarity: string, isFocus: boolean, isNew: boolean): string {
    if (rarity === 'Legendary') {
      if (isFocus) return 'legendary_focus_spectacular';
      if (isNew) return 'legendary_new_celebration';
      return 'legendary_standard';
    }
    if (rarity === 'Epic') {
      if (isFocus) return 'epic_focus_enhanced';
      if (isNew) return 'epic_new_sparkle';
      return 'epic_standard';
    }
    if (isNew) return 'new_hero_glow';
    return 'standard_pull';
  }

  /**
   * Déterminer l'animation multi-pull selon les résultats
   */
  private static getMultiPullAnimation(summary: any, effects: any): string {
    if (effects.perfectPull) return 'perfect_multi_spectacular';
    if (effects.hasMultipleLegendary) return 'multi_legendary_celebration';
    if (effects.hasPityBreak) return 'pity_break_celebration';
    if (summary.legendary > 0) return 'multi_legendary_standard';
    if (summary.epic >= 3) return 'multi_epic_good';
    return 'multi_standard';
  }

  /**
   * Déterminer le son selon la rareté
   */
  private static getPullSound(rarity: string): string {
    const sounds: Record<string, string> = {
      'Legendary': 'legendary_chime',
      'Epic': 'epic_bell',
      'Rare': 'rare_ding',
      'Common': 'common_pop'
    };
    return sounds[rarity] || 'common_pop';
  }

  /**
   * Déterminer le son multi-pull selon les résultats
   */
  private static getMultiPullSound(legendaryCount: number, effects: any): string {
    if (effects.perfectPull) return 'perfect_multi_symphony';
    if (effects.hasMultipleLegendary) return 'multi_legendary_fanfare';
    if (legendaryCount > 0) return 'legendary_celebration';
    return 'multi_standard_chime';
  }

  // ===== MÉTHODES UTILITAIRES PUBLIQUES =====

  /**
   * Vérifier si le service est disponible
   */
  public static isAvailable(): boolean {
    return this.io !== null;
  }

  /**
   * Obtenir le nombre de joueurs connectés dans les rooms gacha
   */
  public static getGachaRoomStats(serverId: string): { playersInGacha: number; totalConnected: number } {
    if (!this.io) return { playersInGacha: 0, totalConnected: 0 };

    try {
      const gachaRoom = this.io.sockets.adapter.rooms.get(`gacha:${serverId}`);
      const serverRoom = this.io.sockets.adapter.rooms.get(`server:${serverId}`);

      return {
        playersInGacha: gachaRoom ? gachaRoom.size : 0,
        totalConnected: serverRoom ? serverRoom.size : 0
      };
    } catch (error) {
      console.error('❌ Erreur getGachaRoomStats:', error);
      return { playersInGacha: 0, totalConnected: 0 };
    }
  }

  /**
   * Broadcast message personnalisé à tous les joueurs gacha d'un serveur
   */
  public static broadcastToGacha(
    serverId: string,
    event: string,
    data: any,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): void {
    if (!this.io) return;

    this.io.to(`gacha:${serverId}`).emit(event, {
      data,
      timestamp: new Date(),
      priority
    });

    console.log(`📢 Gacha broadcast sent to ${serverId}: ${event}`);
  }

  /**
   * Notifier un groupe de joueurs d'un événement gacha
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

    console.log(`👥 Gacha group notification sent to ${playerIds.length} players: ${event}`);
  }

  /**
   * Statistiques globales du système gacha
   */
  public static getGlobalGachaStats(): {
    totalRooms: number;
    totalPlayers: number;
    averagePlayersPerRoom: number;
  } {
    if (!this.io) return { totalRooms: 0, totalPlayers: 0, averagePlayersPerRoom: 0 };

    try {
      const rooms = Array.from(this.io.sockets.adapter.rooms.keys())
        .filter(room => room.startsWith('gacha:'));
      
      const totalPlayers = rooms.reduce((sum, room) => {
        const roomSize = this.io!.sockets.adapter.rooms.get(room)?.size || 0;
        return sum + roomSize;
      }, 0);

      return {
        totalRooms: rooms.length,
        totalPlayers,
        averagePlayersPerRoom: rooms.length > 0 ? Math.round(totalPlayers / rooms.length) : 0
      };
    } catch (error) {
      console.error('❌ Erreur getGlobalGachaStats:', error);
      return { totalRooms: 0, totalPlayers: 0, averagePlayersPerRoom: 0 };
    }
  }
}

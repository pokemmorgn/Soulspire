// server/src/services/websocket/WebSocketForge.ts
import { Server as SocketIOServer } from 'socket.io';

/**
 * SERVICE WEBSOCKET SPÉCIALISÉ FORGE
 * Toutes les notifications temps réel liées au système de forge
 */
export class WebSocketForge {
  private static io: SocketIOServer | null = null;

  // ===== INITIALISATION =====

  /**
   * Initialiser avec l'instance Socket.IO principale
   */
  public static initialize(socketInstance: SocketIOServer): void {
    this.io = socketInstance;
    console.log('✅ WebSocketForge initialized');
  }

  // ===== NOTIFICATIONS DE REFORGE =====

  /**
   * Notifier le résultat d'un reforge
   */
  public static notifyReforgeResult(
    playerId: string,
    reforgeData: {
      itemInstanceId: string;
      itemName: string;
      success: boolean;
      lockedStats: string[];
      oldStats: Record<string, number>;
      newStats: Record<string, number>;
      cost: {
        gold: number;
        gems: number;
        materials: Record<string, number>;
      };
      reforgeCount: number;
      improvements: Array<{
        stat: string;
        oldValue: number;
        newValue: number;
        improvement: number;
      }>;
      powerChange: number;
    }
  ): void {
    if (!this.io) {
      console.warn('⚠️ WebSocketForge not initialized');
      return;
    }

    this.io.to(`player:${playerId}`).emit('forge:reforge_result', {
      type: 'reforge_result',
      data: reforgeData,
      timestamp: new Date(),
      animation: reforgeData.success ? 'reforge_success' : 'reforge_failure',
      sound: reforgeData.success ? 'reforge_chime' : 'reforge_fail'
    });

    console.log(`🔨 Reforge result sent to ${playerId}: ${reforgeData.itemName} ${reforgeData.success ? 'SUCCESS' : 'FAILED'} (${reforgeData.lockedStats.length} locked)`);
  }

  /**
   * Notifier le preview d'un reforge avant exécution
   */
  public static notifyReforgePreview(
    playerId: string,
    previewData: {
      itemInstanceId: string;
      itemName: string;
      currentStats: Record<string, number>;
      previewStats: Record<string, number>;
      lockedStats: string[];
      cost: Record<string, number>;
      potentialImprovements: Array<{
        stat: string;
        currentValue: number;
        minPossible: number;
        maxPossible: number;
        improvementChance: number;
      }>;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('forge:reforge_preview', {
      type: 'reforge_preview',
      data: previewData,
      timestamp: new Date(),
      animation: 'reforge_simulation'
    });

    console.log(`👁️ Reforge preview sent to ${playerId}: ${previewData.itemName} with ${previewData.lockedStats.length} locked stats`);
  }

  // ===== NOTIFICATIONS D'ENHANCEMENT =====

  /**
   * Notifier le résultat d'un enhancement
   */
  public static notifyEnhancementResult(
    playerId: string,
    enhancementData: {
      itemInstanceId: string;
      itemName: string;
      success: boolean;
      previousLevel: number;
      newLevel: number;
      cost: Record<string, number>;
      pityInfo: {
        currentPity: number;
        pityTriggered: boolean;
        nextGuarantee: number;
      };
      statsImprovement: {
        oldPowerScore: number;
        newPowerScore: number;
        powerIncrease: number;
        statChanges: Record<string, { old: number; new: number }>;
      };
      guaranteeUsed: boolean;
      specialEffects?: string[];
    }
  ): void {
    if (!this.io) return;

    let animation = 'enhancement_standard';
    let sound = 'enhancement_success';
    let priority: 'low' | 'normal' | 'high' = 'normal';

    if (!enhancementData.success) {
      animation = 'enhancement_failure';
      sound = 'enhancement_fail';
    } else if (enhancementData.pityInfo.pityTriggered) {
      animation = 'enhancement_pity_success';
      sound = 'pity_trigger_fanfare';
      priority = 'high';
    } else if (enhancementData.guaranteeUsed) {
      animation = 'enhancement_guaranteed';
      sound = 'guaranteed_success';
    } else if (enhancementData.newLevel % 10 === 0) {
      animation = 'enhancement_milestone';
      sound = 'milestone_achievement';
      priority = 'high';
    }

    this.io.to(`player:${playerId}`).emit('forge:enhancement_result', {
      type: 'enhancement_result',
      data: enhancementData,
      timestamp: new Date(),
      animation,
      sound,
      priority
    });

    console.log(`⬆️ Enhancement result sent to ${playerId}: ${enhancementData.itemName} ${enhancementData.previousLevel}→${enhancementData.newLevel} ${enhancementData.success ? 'SUCCESS' : 'FAILED'}`);
  }

  /**
   * Notifier progression du système pity pour enhancement
   */
  public static notifyEnhancementPityProgress(
    playerId: string,
    pityData: {
      itemInstanceId: string;
      itemName: string;
      currentFailures: number;
      pityThreshold: number;
      failuresUntilGuarantee: number;
      nextLevel: number;
      pityResetLevel?: number;
      recommendAction: 'continue' | 'use_guarantee' | 'wait';
    }
  ): void {
    if (!this.io) return;

    // Ne notifier que si on approche de la garantie
    if (pityData.failuresUntilGuarantee <= 3) {
      this.io.to(`player:${playerId}`).emit('forge:enhancement_pity_progress', {
        type: 'enhancement_pity_progress',
        data: pityData,
        timestamp: new Date(),
        animation: pityData.failuresUntilGuarantee === 0 ? 'pity_ready' : 'pity_approaching',
        priority: pityData.failuresUntilGuarantee <= 1 ? 'high' : 'medium'
      });

      console.log(`🎯 Enhancement pity progress for ${playerId}: ${pityData.failuresUntilGuarantee} failures until guarantee for ${pityData.itemName}`);
    }
  }

  // ===== NOTIFICATIONS DE FUSION =====

  /**
   * Notifier le résultat d'une fusion
   */
  public static notifyFusionResult(
    playerId: string,
    fusionData: {
      success: boolean;
      consumedItems: Array<{
        instanceId: string;
        name: string;
        level: number;
        enhancement: number;
      }>;
      newItem?: {
        instanceId: string;
        name: string;
        rarity: string;
        level: number;
        enhancement: number;
        powerScore: number;
      };
      cost: Record<string, number>;
      rarityUpgrade: {
        oldRarity: string;
        newRarity: string;
        rarityMultiplier: number;
      };
      statsComparison: {
        oldTotalPower: number;
        newPowerScore: number;
        powerIncrease: number;
      };
    }
  ): void {
    if (!this.io) return;

    const animation = fusionData.success ? 
      (fusionData.rarityUpgrade.newRarity === 'Mythic' ? 'fusion_mythic_success' : 'fusion_success') :
      'fusion_failure';

    const sound = fusionData.success ?
      (fusionData.rarityUpgrade.newRarity === 'Mythic' ? 'mythic_fusion_fanfare' : 'fusion_success_chime') :
      'fusion_fail';

    this.io.to(`player:${playerId}`).emit('forge:fusion_result', {
      type: 'fusion_result',
      data: fusionData,
      timestamp: new Date(),
      animation,
      sound,
      priority: fusionData.rarityUpgrade.newRarity === 'Mythic' ? 'high' : 'normal'
    });

    if (fusionData.success && fusionData.newItem) {
      console.log(`⚗️ Fusion result sent to ${playerId}: 3x ${fusionData.rarityUpgrade.oldRarity} → ${fusionData.newItem.name} (${fusionData.rarityUpgrade.newRarity}) +${fusionData.statsComparison.powerIncrease} power`);
    } else {
      console.log(`❌ Fusion failed for ${playerId}: insufficient items or resources`);
    }
  }

  /**
   * Notifier opportunités de fusion disponibles
   */
  public static notifyFusionOpportunities(
    playerId: string,
    opportunitiesData: {
      availableFusions: Array<{
        itemId: string;
        itemName: string;
        rarity: string;
        availableCount: number;
        possibleFusions: number;
        targetRarity: string;
        estimatedPowerGain: number;
        fusionCost: Record<string, number>;
      }>;
      totalOpportunities: number;
      recommendedFusion?: string;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('forge:fusion_opportunities', {
      type: 'fusion_opportunities',
      data: opportunitiesData,
      timestamp: new Date(),
      priority: opportunitiesData.totalOpportunities > 3 ? 'medium' : 'low'
    });

    console.log(`🔄 Fusion opportunities sent to ${playerId}: ${opportunitiesData.totalOpportunities} possible fusions available`);
  }

  // ===== NOTIFICATIONS DE TIER UPGRADE =====

  /**
   * Notifier le résultat d'un tier upgrade
   */
  public static notifyTierUpgradeResult(
    playerId: string,
    upgradeData: {
      success: boolean;
      itemInstanceId: string;
      itemName: string;
      previousTier: number;
      newTier: number;
      cost: Record<string, number>;
      tierMultiplier: number;
      statsImprovement: {
        oldStats: Record<string, number>;
        newStats: Record<string, number>;
        powerIncrease: number;
      };
      maxTierReached: boolean;
      unlockedFeatures?: string[];
    }
  ): void {
    if (!this.io) return;

    let animation = 'tier_upgrade_success';
    let sound = 'tier_upgrade_chime';
    let priority: 'low' | 'normal' | 'high' = 'normal';

    if (!upgradeData.success) {
      animation = 'tier_upgrade_failure';
      sound = 'upgrade_fail';
    } else if (upgradeData.maxTierReached) {
      animation = 'tier_max_achievement';
      sound = 'max_tier_fanfare';
      priority = 'high';
    } else if (upgradeData.newTier >= 4) {
      animation = 'tier_high_celebration';
      sound = 'high_tier_success';
      priority = 'high';
    }

    this.io.to(`player:${playerId}`).emit('forge:tier_upgrade_result', {
      type: 'tier_upgrade_result',
      data: upgradeData,
      timestamp: new Date(),
      animation,
      sound,
      priority
    });

    console.log(`⭐ Tier upgrade result sent to ${playerId}: ${upgradeData.itemName} T${upgradeData.previousTier}→T${upgradeData.newTier} ${upgradeData.success ? 'SUCCESS' : 'FAILED'} (x${upgradeData.tierMultiplier} multiplier)`);
  }

  /**
   * Notifier coût total pour maximiser un item
   */
  public static notifyMaxTierCostAnalysis(
    playerId: string,
    costData: {
      itemInstanceId: string;
      itemName: string;
      currentTier: number;
      maxTier: number;
      totalUpgradeCost: {
        gold: number;
        gems: number;
        materials: Record<string, number>;
      };
      upgradeSteps: Array<{
        fromTier: number;
        toTier: number;
        cost: Record<string, number>;
        multiplierGain: number;
      }>;
      canAfford: boolean;
      missingResources?: Record<string, number>;
      recommendation: 'upgrade_now' | 'save_more' | 'upgrade_partially';
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('forge:max_tier_cost_analysis', {
      type: 'max_tier_cost_analysis',
      data: costData,
      timestamp: new Date(),
      priority: costData.canAfford ? 'medium' : 'low'
    });

    console.log(`📊 Max tier cost analysis sent to ${playerId}: ${costData.itemName} T${costData.currentTier}→T${costData.maxTier} (${costData.canAfford ? 'AFFORDABLE' : 'TOO EXPENSIVE'})`);
  }

  // ===== NOTIFICATIONS GÉNÉRALES DE FORGE =====

  /**
   * Notifier recommandations intelligentes de forge
   */
  public static notifyForgeRecommendations(
    playerId: string,
    recommendations: {
      playerPowerScore: number;
      playerLevel: number;
      recommendations: Array<{
        type: 'enhancement' | 'reforge' | 'fusion' | 'tier_upgrade';
        priority: 'low' | 'medium' | 'high';
        itemInstanceId: string;
        itemName: string;
        reasoning: string;
        expectedBenefit: string;
        cost: Record<string, number>;
        powerGainEstimate: number;
      }>;
      resourceOptimization: {
        currentResources: Record<string, number>;
        optimalSpendingPlan: Array<{
          operation: string;
          itemName: string;
          cost: Record<string, number>;
          expectedReturn: number;
        }>;
        efficiencyScore: number;
      };
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('forge:recommendations', {
      type: 'forge_recommendations',
      data: recommendations,
      timestamp: new Date(),
      priority: 'medium'
    });

    console.log(`💡 Forge recommendations sent to ${playerId}: ${recommendations.recommendations.length} suggestions (efficiency: ${recommendations.resourceOptimization.efficiencyScore}%)`);
  }

  /**
   * Notifier batch operation terminée
   */
  public static notifyBatchOperationCompleted(
    playerId: string,
    batchData: {
      operationType: string;
      totalOperations: number;
      successfulOperations: number;
      totalCost: Record<string, number>;
      results: Array<{
        itemName: string;
        success: boolean;
        result: string;
      }>;
      totalPowerGain: number;
      duration: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('forge:batch_completed', {
      type: 'batch_operation_completed',
      data: batchData,
      timestamp: new Date(),
      animation: 'batch_completion',
      sound: 'batch_success_chime'
    });

    console.log(`🔄 Batch operation completed for ${playerId}: ${batchData.successfulOperations}/${batchData.totalOperations} ${batchData.operationType} operations succeeded (+${batchData.totalPowerGain} total power)`);
  }

  /**
   * Notifier événement forge spécial
   */
  public static notifyForgeEvent(
    serverId: string,
    eventData: {
      eventType: 'double_success' | 'reduced_costs' | 'bonus_materials' | 'free_reforges';
      eventName: string;
      description: string;
      duration: number; // en heures
      bonusMultiplier?: number;
      affectedOperations: string[];
      specialRewards?: Record<string, any>;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`forge:${serverId}`).emit('forge:special_event', {
      type: 'forge_special_event',
      data: eventData,
      timestamp: new Date(),
      animation: 'forge_event_celebration',
      sound: 'event_fanfare',
      priority: 'high'
    });

    console.log(`🎉 Forge event started on ${serverId}: ${eventData.eventName} for ${eventData.duration}h affecting ${eventData.affectedOperations.join(', ')}`);
  }

  /**
   * Notifier milestone de forge atteint
   */
  public static notifyForgeMilestone(
    playerId: string,
    milestoneData: {
      milestoneType: 'total_operations' | 'power_gained' | 'resources_spent' | 'perfect_items';
      milestoneName: string;
      currentValue: number;
      targetValue: number;
      rewards: Record<string, any>;
      nextMilestone?: {
        name: string;
        target: number;
        reward: string;
      };
      isSpecialAchievement: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('forge:milestone_reached', {
      type: 'forge_milestone',
      data: milestoneData,
      timestamp: new Date(),
      animation: milestoneData.isSpecialAchievement ? 'special_achievement' : 'milestone_celebration',
      sound: milestoneData.isSpecialAchievement ? 'achievement_fanfare' : 'milestone_chime'
    });

    console.log(`🏆 Forge milestone reached by ${playerId}: ${milestoneData.milestoneName} (${milestoneData.currentValue}/${milestoneData.targetValue})`);
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Vérifier si le service est disponible
   */
  public static isAvailable(): boolean {
    return this.io !== null;
  }

  /**
   * Obtenir les statistiques des rooms forge
   */
  public static getForgeRoomStats(serverId: string): { playersInForge: number; totalConnected: number } {
    if (!this.io) return { playersInForge: 0, totalConnected: 0 };

    try {
      const forgeRoom = this.io.sockets.adapter.rooms.get(`forge:${serverId}`);
      const serverRoom = this.io.sockets.adapter.rooms.get(`server:${serverId}`);

      return {
        playersInForge: forgeRoom ? forgeRoom.size : 0,
        totalConnected: serverRoom ? serverRoom.size : 0
      };
    } catch (error) {
      console.error('❌ Erreur getForgeRoomStats:', error);
      return { playersInForge: 0, totalConnected: 0 };
    }
  }

  /**
   * Broadcast message à tous les joueurs forge d'un serveur
   */
  public static broadcastToForge(
    serverId: string,
    event: string,
    data: any,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): void {
    if (!this.io) return;

    this.io.to(`forge:${serverId}`).emit(event, {
      data,
      timestamp: new Date(),
      priority
    });

    console.log(`📢 Forge broadcast sent to ${serverId}: ${event}`);
  }

  /**
   * Notifier un groupe de joueurs d'un événement forge
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

    console.log(`👥 Forge group notification sent to ${playerIds.length} players: ${event}`);
  }

  /**
   * Statistiques globales du système forge WebSocket
   */
  public static getGlobalForgeStats(): {
    totalRooms: number;
    totalPlayers: number;
    averagePlayersPerRoom: number;
  } {
    if (!this.io) return { totalRooms: 0, totalPlayers: 0, averagePlayersPerRoom: 0 };

    try {
      const rooms = Array.from(this.io.sockets.adapter.rooms.keys())
        .filter(room => room.startsWith('forge:'));
      
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
      console.error('❌ Erreur getGlobalForgeStats:', error);
      return { totalRooms: 0, totalPlayers: 0, averagePlayersPerRoom: 0 };
    }
  }
}

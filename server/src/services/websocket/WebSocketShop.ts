// server/src/services/websocket/WebSocketShop.ts
import { Server as SocketIOServer } from 'socket.io';

/**
 * SERVICE WEBSOCKET SPÉCIALISÉ SHOP
 * Toutes les notifications temps réel liées au système de boutiques
 */
export class WebSocketShop {
  private static io: SocketIOServer | null = null;

  // ===== INITIALISATION =====

  /**
   * Initialiser avec l'instance Socket.IO principale
   */
  public static initialize(socketInstance: SocketIOServer): void {
    this.io = socketInstance;
    console.log('✅ WebSocketShop initialized');
  }

  // ===== NOTIFICATIONS D'ACHAT =====

  /**
   * Notifier le succès d'un achat
   */
  public static notifyPurchaseSuccess(
    playerId: string,
    purchaseData: {
      shopType: string;
      itemName: string;
      quantity: number;
      cost: Record<string, number>;
      rewards: Array<{
        type: string;
        itemId?: string;
        quantity: number;
      }>;
      remainingStock?: number;
      playerResources: {
        gold: number;
        gems: number;
        paidGems: number;
        tickets: number;
      };
    }
  ): void {
    if (!this.io) {
      console.warn('⚠️ WebSocketShop not initialized');
      return;
    }

    this.io.to(`player:${playerId}`).emit('shop:purchase_success', {
      type: 'purchase_success',
      data: purchaseData,
      timestamp: new Date(),
      animation: this.getPurchaseAnimation(purchaseData.rewards),
      sound: this.getPurchaseSound(purchaseData.cost)
    });

    console.log(`🛒 Purchase success sent to ${playerId}: ${purchaseData.itemName} x${purchaseData.quantity} from ${purchaseData.shopType}`);
  }

  /**
   * Notifier l'échec d'un achat
   */
  public static notifyPurchaseFailure(
    playerId: string,
    failureData: {
      shopType: string;
      itemName: string;
      reason: string;
      code: string;
      requiredResources?: Record<string, number>;
      playerResources?: Record<string, number>;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('shop:purchase_failure', {
      type: 'purchase_failure',
      data: failureData,
      timestamp: new Date(),
      animation: 'purchase_denied',
      sound: 'error_sound'
    });

    console.log(`❌ Purchase failure sent to ${playerId}: ${failureData.reason} for ${failureData.itemName}`);
  }

  /**
   * Notifier achat de bundle spécial avec animation améliorée
   */
  public static notifyBundlePurchase(
    playerId: string,
    bundleData: {
      shopType: string;
      bundleName: string;
      bundleItems: Array<{
        type: string;
        name: string;
        quantity: number;
        rarity?: string;
      }>;
      totalValue: number;
      discount: number;
      cost: Record<string, number>;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('shop:bundle_purchase', {
      type: 'bundle_purchase',
      data: bundleData,
      timestamp: new Date(),
      animation: 'bundle_celebration',
      sound: 'bundle_fanfare'
    });

    console.log(`📦 Bundle purchase sent to ${playerId}: ${bundleData.bundleName} (${bundleData.discount}% off)`);
  }

  // ===== NOTIFICATIONS DE BOUTIQUES =====

  /**
   * Notifier refresh/reset d'une boutique
   */
  public static notifyShopRefreshed(
    playerId: string,
    refreshData: {
      shopType: string;
      shopName: string;
      newItemsCount: number;
      refreshCost?: Record<string, number>;
      freeRefreshUsed: boolean;
      remainingFreeRefresh?: number;
      featuredItems?: string[];
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('shop:refreshed', {
      type: 'shop_refreshed',
      data: refreshData,
      timestamp: new Date(),
      animation: refreshData.freeRefreshUsed ? 'free_refresh' : 'paid_refresh'
    });

    console.log(`🔄 Shop refresh sent to ${playerId}: ${refreshData.shopType} with ${refreshData.newItemsCount} new items`);
  }

  /**
   * Notifier reset automatique d'une boutique (broadcast serveur)
   */
  public static notifyShopAutoReset(
    serverId: string,
    resetData: {
      shopType: string;
      shopName: string;
      resetTime: Date;
      newItemsCount: number;
      specialOffers?: Array<{
        itemName: string;
        discount: number;
        rarity: string;
      }>;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`shop:${serverId}`).emit('shop:auto_reset', {
      type: 'shop_auto_reset',
      data: resetData,
      timestamp: new Date(),
      animation: 'shop_renewal',
      priority: 'medium'
    });

    console.log(`🏪 Shop auto-reset notification sent to ${serverId}: ${resetData.shopType} renewed with ${resetData.newItemsCount} items`);
  }

    /**
   * Notifier reset global de boutique (broadcast serveur)
   */
  public static notifyGlobalShopReset(resetData: {
    shopType: string;
    shopName: string;
    newItemsCount: number;
    resetTime: Date;
  }): void {
    if (!this.io) return;
  
    this.io.emit('shop:global_reset', {
      type: 'global_shop_reset',
      data: resetData,
      timestamp: new Date(),
      animation: 'shop_renewal',
      priority: 'high'
    });
  
    console.log(`🌍 Global shop reset: ${resetData.shopType} with ${resetData.newItemsCount} items`);
  }
  
  /**
   * Notifier nouvelle boutique disponible
   */
  public static notifyNewShopAvailable(
    playerId: string,
    shopData: {
      shopType: string;
      shopName: string;
      levelRequirement: number;
      description: string;
      featuredItems: string[];
      accessReason: 'level_unlock' | 'vip_unlock' | 'event_unlock';
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('shop:new_available', {
      type: 'new_shop_available',
      data: shopData,
      timestamp: new Date(),
      animation: 'shop_unlock',
      sound: 'unlock_chime',
      priority: 'high'
    });

    console.log(`🆕 New shop available sent to ${playerId}: ${shopData.shopType} unlocked via ${shopData.accessReason}`);
  }

  // ===== NOTIFICATIONS D'OFFRES SPÉCIALES =====

  /**
   * Notifier offre flash limitée
   */
  public static notifyFlashOffer(
    playerId: string,
    offerData: {
      itemName: string;
      originalPrice: Record<string, number>;
      flashPrice: Record<string, number>;
      discount: number;
      timeRemaining: number; // en secondes
      stock: number;
      rarity: string;
      isPersonalized: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('shop:flash_offer', {
      type: 'flash_offer',
      data: offerData,
      timestamp: new Date(),
      animation: 'flash_deal',
      sound: 'urgent_notification',
      priority: 'high'
    });

    console.log(`⚡ Flash offer sent to ${playerId}: ${offerData.itemName} (${offerData.discount}% off, ${offerData.timeRemaining}s left)`);
  }

  /**
   * Notifier offre personnalisée basée sur le gameplay
   */
  public static notifyPersonalizedOffer(
    playerId: string,
    personalizedData: {
      offerType: 'hero_fragments' | 'power_boost' | 'progression_help' | 'resource_pack';
      title: string;
      description: string;
      items: Array<{
        type: string;
        name: string;
        quantity: number;
        reason: string; // Pourquoi cet item est recommandé
      }>;
      originalValue: number;
      offerPrice: Record<string, number>;
      discount: number;
      validUntil: Date;
      playerContext: {
        currentLevel: number;
        stuckAt?: string;
        neededItems?: string[];
      };
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('shop:personalized_offer', {
      type: 'personalized_offer',
      data: personalizedData,
      timestamp: new Date(),
      animation: 'personalized_recommendation',
      sound: 'gentle_chime'
    });

    console.log(`🎯 Personalized offer sent to ${playerId}: ${personalizedData.offerType} (${personalizedData.discount}% off)`);
  }

  /**
   * Notifier événement boutique spécial (broadcast serveur)
   */
  public static notifyShopEvent(
    serverId: string,
    eventData: {
      eventType: 'double_discount' | 'free_refresh_day' | 'premium_weekend' | 'vip_bonus';
      eventName: string;
      description: string;
      duration: number; // en heures
      affectedShops: string[];
      bonusMultiplier?: number;
      specialRewards?: string[];
    }
  ): void {
    if (!this.io) return;

    this.io.to(`shop:${serverId}`).emit('shop:special_event', {
      type: 'shop_special_event',
      data: eventData,
      timestamp: new Date(),
      animation: 'shop_celebration',
      sound: 'event_fanfare',
      priority: 'high'
    });

    console.log(`🎉 Shop event started on ${serverId}: ${eventData.eventName} for ${eventData.duration}h affecting ${eventData.affectedShops.join(', ')}`);
  }

  // ===== NOTIFICATIONS DE STOCK ET DISPONIBILITÉ =====

  /**
   * Notifier stock faible sur un item populaire
   */
  public static notifyLowStock(
    playerId: string,
    stockData: {
      shopType: string;
      itemName: string;
      currentStock: number;
      maxStock: number;
      popularity: 'high' | 'medium' | 'low';
      priceHistory?: Array<{
        date: Date;
        price: number;
      }>;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('shop:low_stock', {
      type: 'low_stock_warning',
      data: stockData,
      timestamp: new Date(),
      animation: 'stock_warning',
      priority: stockData.currentStock <= 1 ? 'high' : 'medium'
    });

    console.log(`⚠️ Low stock warning sent to ${playerId}: ${stockData.itemName} (${stockData.currentStock}/${stockData.maxStock} left)`);
  }

  /**
   * Notifier item sold out
   */
  public static notifyItemSoldOut(
    serverId: string,
    soldOutData: {
      shopType: string;
      itemName: string;
      lastBuyer?: string; // Masqué pour privacy
      selloutTime: number; // Temps pour vendre tout le stock
      wasPopular: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`shop:${serverId}`).emit('shop:item_sold_out', {
      type: 'item_sold_out',
      data: soldOutData,
      timestamp: new Date(),
      animation: 'sold_out'
    });

    console.log(`🚫 Item sold out on ${serverId}: ${soldOutData.itemName} from ${soldOutData.shopType} (${soldOutData.selloutTime}ms to sell out)`);
  }

  /**
   * Notifier restock d'un item populaire
   */
  public static notifyItemRestocked(
    playerId: string,
    restockData: {
      shopType: string;
      itemName: string;
      newStock: number;
      wasWaitlisted: boolean;
      estimatedDemand: 'high' | 'medium' | 'low';
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('shop:item_restocked', {
      type: 'item_restocked',
      data: restockData,
      timestamp: new Date(),
      animation: 'restock_notification',
      sound: 'restock_chime'
    });

    console.log(`📦 Item restocked notification sent to ${playerId}: ${restockData.itemName} (${restockData.newStock} units, demand: ${restockData.estimatedDemand})`);
  }

  // ===== NOTIFICATIONS DE RECOMMANDATIONS =====

  /**
   * Notifier recommandation d'achat intelligente
   */
  public static notifySmartRecommendation(
    playerId: string,
    recommendation: {
      type: 'upgrade_opportunity' | 'value_deal' | 'progress_helper' | 'collection_complete';
      title: string;
      description: string;
      recommendedItem: {
        shopType: string;
        itemName: string;
        currentPrice: Record<string, number>;
        valueScore: number; // 0-100
        urgency: 'low' | 'medium' | 'high';
      };
      reasoning: string[];
      playerContext: {
        currentGoal?: string;
        blockedAt?: string;
        resources: Record<string, number>;
      };
      timeRelevant: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('shop:smart_recommendation', {
      type: 'smart_recommendation',
      data: recommendation,
      timestamp: new Date(),
      priority: recommendation.recommendedItem.urgency,
      timeRelevant: recommendation.timeRelevant
    });

    console.log(`💡 Smart recommendation sent to ${playerId}: ${recommendation.type} - ${recommendation.recommendedItem.itemName} (value: ${recommendation.recommendedItem.valueScore}/100)`);
  }

  /**
   * Notifier optimisation budget/ressources
   */
  public static notifyBudgetOptimization(
    playerId: string,
    budgetData: {
      currentResources: Record<string, number>;
      suggestedPurchases: Array<{
        shopType: string;
        itemName: string;
        cost: Record<string, number>;
        expectedBenefit: string;
        priority: number;
      }>;
      totalOptimalSpending: Record<string, number>;
      projectedGains: {
        powerIncrease: number;
        progressSpeedup: string;
        longTermValue: number;
      };
      budgetEfficiency: number; // 0-100
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('shop:budget_optimization', {
      type: 'budget_optimization',
      data: budgetData,
      timestamp: new Date(),
      priority: 'medium'
    });

    console.log(`💰 Budget optimization sent to ${playerId}: ${budgetData.suggestedPurchases.length} suggestions, ${budgetData.budgetEfficiency}% efficiency`);
  }

  // ===== MÉTHODES UTILITAIRES PRIVÉES =====

  /**
   * Déterminer l'animation d'achat selon les récompenses
   */
  private static getPurchaseAnimation(rewards: Array<{ type: string; quantity: number }>): string {
    const hasRareItems = rewards.some(r => r.type === 'Hero' || r.type === 'Fragment');
    const hasMultipleItems = rewards.length > 1;
    const hasLargeQuantity = rewards.some(r => r.quantity >= 10);

    if (hasRareItems) return 'rare_purchase_celebration';
    if (hasMultipleItems) return 'multi_item_purchase';
    if (hasLargeQuantity) return 'bulk_purchase';
    return 'standard_purchase';
  }

  /**
   * Déterminer le son d'achat selon le coût
   */
  private static getPurchaseSound(cost: Record<string, number>): string {
    if (cost.paidGems && cost.paidGems > 0) return 'premium_purchase';
    if (cost.gems && cost.gems >= 1000) return 'expensive_purchase';
    if (cost.gold && cost.gold >= 10000) return 'bulk_purchase';
    return 'standard_purchase';
  }

  // ===== MÉTHODES UTILITAIRES PUBLIQUES =====

  /**
   * Vérifier si le service est disponible
   */
  public static isAvailable(): boolean {
    return this.io !== null;
  }

  /**
   * Obtenir le nombre de joueurs connectés dans les rooms shop
   */
  public static getShopRoomStats(serverId: string): { playersInShop: number; totalConnected: number } {
    if (!this.io) return { playersInShop: 0, totalConnected: 0 };

    try {
      const shopRoom = this.io.sockets.adapter.rooms.get(`shop:${serverId}`);
      const serverRoom = this.io.sockets.adapter.rooms.get(`server:${serverId}`);

      return {
        playersInShop: shopRoom ? shopRoom.size : 0,
        totalConnected: serverRoom ? serverRoom.size : 0
      };
    } catch (error) {
      console.error('❌ Erreur getShopRoomStats:', error);
      return { playersInShop: 0, totalConnected: 0 };
    }
  }

  /**
   * Broadcast message personnalisé à tous les joueurs shop d'un serveur
   */
  public static broadcastToShop(
    serverId: string,
    event: string,
    data: any,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): void {
    if (!this.io) return;

    this.io.to(`shop:${serverId}`).emit(event, {
      data,
      timestamp: new Date(),
      priority
    });

    console.log(`📢 Shop broadcast sent to ${serverId}: ${event}`);
  }

  /**
   * Notifier un groupe de joueurs d'un événement boutique
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

    console.log(`👥 Shop group notification sent to ${playerIds.length} players: ${event}`);
  }

  /**
   * Statistiques globales du système shop WebSocket
   */
  public static getGlobalShopStats(): {
    totalRooms: number;
    totalPlayers: number;
    averagePlayersPerRoom: number;
  } {
    if (!this.io) return { totalRooms: 0, totalPlayers: 0, averagePlayersPerRoom: 0 };

    try {
      const rooms = Array.from(this.io.sockets.adapter.rooms.keys())
        .filter(room => room.startsWith('shop:'));
      
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
      console.error('❌ Erreur getGlobalShopStats:', error);
      return { totalRooms: 0, totalPlayers: 0, averagePlayersPerRoom: 0 };
    }
  }
}

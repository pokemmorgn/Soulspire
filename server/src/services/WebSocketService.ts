// server/src/services/WebSocketService.ts
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import Player from '../models/Player';
import { WebSocketArena } from './websocket/WebSocketArena';
import { WebSocketAFK } from './websocket/WebSocketAFK';
import { WebSocketCampaign } from './websocket/WebSocketCampaign';
import { WebSocketGacha } from './websocket/WebSocketGacha';
import { WebSocketShop } from './websocket/WebSocketShop';
/**
 * SERVICE WEBSOCKET GLOBAL
 * Point d'entrée principal qui délègue aux modules spécialisés
 */
export class WebSocketService {
  private static io: SocketIOServer | null = null;
  private static connectedPlayers = new Map<string, {
    socketId: string;
    playerId: string;
    serverId: string;
    connectedAt: Date;
  }>();

  // ===== INITIALISATION =====

  /**
   * Initialiser le serveur WebSocket
   */
  public static initialize(httpServer: HttpServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST"]
      },
      path: '/socket.io'
    });

    // Middleware d'authentification
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const player = await Player.findOne({ _id: decoded.userId, serverId: decoded.serverId });
        
        if (!player) {
          return next(new Error('Player not found'));
        }

        // Attacher les infos du joueur au socket
        (socket as any).playerId = decoded.userId;
        (socket as any).serverId = decoded.serverId;
        (socket as any).playerName = player.displayName;

        next();
      } catch (error) {
        console.error('❌ WebSocket auth error:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Gestionnaire de connexions
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    // Initialiser les modules spécialisés
    WebSocketArena.initialize(this.io);
    WebSocketAFK.initialize(this.io);
    WebSocketCampaign.initialize(this.io);
    WebSocketGacha.initialize(this.io);
    WebSocketShop.initialize(this.io);
    console.log('✅ WebSocket Server initialized with specialized modules');
  }

  /**
   * Gérer les nouvelles connexions
   */
  private static handleConnection(socket: any): void {
    const playerId = socket.playerId;
    const serverId = socket.serverId;
    const playerName = socket.playerName;

    console.log(`🔌 WebSocket connected: ${playerName} (${playerId}) on ${serverId}`);

    // Enregistrer la connexion
    this.connectedPlayers.set(playerId, {
      socketId: socket.id,
      playerId,
      serverId,
      connectedAt: new Date()
    });

    // Rejoindre les rooms appropriées
    socket.join(`server:${serverId}`);           // Room du serveur
    socket.join(`player:${playerId}`);           // Room personnelle
    socket.join(`arena:${serverId}`);            // Room arène du serveur

    // Message de bienvenue
    socket.emit('connection:success', {
      message: `Welcome ${playerName}!`,
      serverId,
      connectedPlayers: this.getServerPlayerCount(serverId)
    });

    // Notifier aux autres joueurs du serveur
    socket.to(`server:${serverId}`).emit('player:online', {
      playerId,
      playerName
    });

    // Gestionnaires d'événements spécialisés
    this.setupEventHandlers(socket);

    // Gestion de la déconnexion
    socket.on('disconnect', (reason: string) => {
      console.log(`🔌 WebSocket disconnected: ${playerName} (${reason})`);
      
      this.connectedPlayers.delete(playerId);
      
      // Notifier aux autres
      socket.to(`server:${serverId}`).emit('player:offline', {
        playerId,
        playerName
      });
    });
  }

  /**
   * Configurer les gestionnaires d'événements spécialisés
   */
  private static setupEventHandlers(socket: any): void {
    // Événements Arena
    socket.on('arena:join_room', () => {
      socket.join(`arena:${socket.serverId}`);
      console.log(`🏟️ ${socket.playerName} joined arena room`);
    });

    socket.on('arena:leave_room', () => {
      socket.leave(`arena:${socket.serverId}`);
      console.log(`🚪 ${socket.playerName} left arena room`);
    });
    
    // Événements AFK
    socket.on('afk:join_room', () => {
      socket.join(`afk:${socket.serverId}`);
      console.log(`💤 ${socket.playerName} joined AFK room`);
    });

    socket.on('afk:leave_room', () => {
      socket.leave(`afk:${socket.serverId}`);
      console.log(`🚪 ${socket.playerName} left AFK room`);
    });

    // Événements Campaign
    socket.on('campaign:join_room', () => {
      socket.join(`campaign:${socket.serverId}`);
      console.log(`🗡️ ${socket.playerName} joined Campaign room`);
    });

    socket.on('campaign:leave_room', () => {
      socket.leave(`campaign:${socket.serverId}`);
      console.log(`🚪 ${socket.playerName} left Campaign room`);
    });

    // Événements Gacha
    socket.on('gacha:join_room', () => {
      socket.join(`gacha:${socket.serverId}`);
      console.log(`🎰 ${socket.playerName} joined Gacha room`);
    });
    
    socket.on('gacha:leave_room', () => {
      socket.leave(`gacha:${socket.serverId}`);
      console.log(`🚪 ${socket.playerName} left Gacha room`);
    });
    
    socket.on('gacha:subscribe_banner', (data: { bannerId: string }) => {
      socket.join(`banner:${data.bannerId}`);
      console.log(`🎲 ${socket.playerName} subscribed to banner ${data.bannerId}`);
    });
    
    socket.on('gacha:unsubscribe_banner', (data: { bannerId: string }) => {
      socket.leave(`banner:${data.bannerId}`);
      console.log(`🚪 ${socket.playerName} unsubscribed from banner ${data.bannerId}`);
    });
    // Événements Shop - AJOUTER CETTE SECTION
    socket.on('shop:join_room', () => {
      socket.join(`shop:${socket.serverId}`);
      console.log(`🛒 ${socket.playerName} joined Shop room`);
    });
    
    socket.on('shop:leave_room', () => {
      socket.leave(`shop:${socket.serverId}`);
      console.log(`🚪 ${socket.playerName} left Shop room`);
    });
    
    socket.on('shop:subscribe_type', (data: { shopType: string }) => {
      socket.join(`shop:${data.shopType}:${socket.serverId}`);
      console.log(`🏪 ${socket.playerName} subscribed to ${data.shopType} shop`);
    });
    
    socket.on('shop:unsubscribe_type', (data: { shopType: string }) => {
      socket.leave(`shop:${data.shopType}:${socket.serverId}`);
      console.log(`🚪 ${socket.playerName} unsubscribed from ${data.shopType} shop`);
    });
    // Événements génériques
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });


    // TODO: Ajouter d'autres gestionnaires pour AFK, Campaign, etc.
  }

  // ===== MÉTHODES ARÈNE (DÉLÉGATION) =====

  /**
   * Notifier le résultat d'un combat d'arène
   */
  public static notifyArenaMatchResult(playerId: string, matchResult: any): void {
    WebSocketArena.notifyMatchResult(playerId, matchResult);
  }

  /**
   * Notifier qu'on a été attaqué en défense
   */
  public static notifyArenaDefenseAttacked(defenderId: string, attackData: any): void {
    WebSocketArena.notifyDefenseAttacked(defenderId, attackData);
  }

  /**
   * Notifier une promotion/relégation
   */
  public static notifyArenaPromotion(playerId: string, promotionData: any): void {
    WebSocketArena.notifyPromotion(playerId, promotionData);
  }

  /**
   * Notifier une nouvelle saison d'arène (broadcast serveur)
   */
  public static notifyArenaNewSeason(serverId: string, seasonData: any): void {
    WebSocketArena.notifyNewSeason(serverId, seasonData);
  }

  /**
   * Notifier mise à jour des classements (broadcast)
   */
  public static notifyArenaLeaderboardUpdate(serverId: string, topChanges: any[]): void {
    WebSocketArena.notifyLeaderboardUpdate(serverId, topChanges);
  }

    // ===== MÉTHODES AFK (DÉLÉGATION) =====

  /**
   * Notifier que le farming automatique a commencé
   */
  public static notifyAfkFarmingStarted(playerId: string, farmingData: any): void {
    WebSocketAFK.notifyFarmingStarted(playerId, farmingData);
  }

  /**
   * Notifier que le farming est terminé avec récompenses
   */
  public static notifyAfkFarmingCompleted(playerId: string, completionData: any): void {
    WebSocketAFK.notifyFarmingCompleted(playerId, completionData);
  }

  /**
   * Notifier la progression du farming en temps réel
   */
  public static notifyAfkFarmingProgress(playerId: string, progressData: any): void {
    WebSocketAFK.notifyFarmingProgress(playerId, progressData);
  }

  /**
   * Notifier qu'un meilleur spot de farming a été trouvé
   */
  public static notifyAfkOptimalLocationFound(playerId: string, locationData: any): void {
    WebSocketAFK.notifyOptimalLocationFound(playerId, locationData);
  }

  /**
   * Notifier que les récompenses hors ligne ont été réclamées
   */
  public static notifyAfkOfflineRewardsClaimed(playerId: string, rewardsData: any): void {
    WebSocketAFK.notifyOfflineRewardsClaimed(playerId, rewardsData);
  }

  /**
   * Notifier que de nouvelles récompenses idle sont disponibles
   */
  public static notifyAfkIdleRewardsAvailable(playerId: string, availableData: any): void {
    WebSocketAFK.notifyIdleRewardsAvailable(playerId, availableData);
  }

  /**
   * Notifier l'activation d'un bonus de récompenses
   */
  public static notifyAfkBonusRewardsActivated(playerId: string, bonusData: any): void {
    WebSocketAFK.notifyBonusRewardsActivated(playerId, bonusData);
  }

  /**
   * Notifier que la formation a été auto-optimisée
   */
  public static notifyAfkFormationOptimized(playerId: string, optimizationData: any): void {
    WebSocketAFK.notifyFormationOptimized(playerId, optimizationData);
  }

  /**
   * Notifier que l'équipement a été amélioré automatiquement
   */
  public static notifyAfkEquipmentUpgraded(playerId: string, upgradeData: any): void {
    WebSocketAFK.notifyEquipmentUpgraded(playerId, upgradeData);
  }

  /**
   * Notifier que le joueur est bloqué avec recommandations
   */
  public static notifyAfkProgressStuck(playerId: string, stuckData: any): void {
    WebSocketAFK.notifyProgressStuck(playerId, stuckData);
  }

  /**
   * Notifier l'activation d'un événement double XP (broadcast serveur)
   */
  public static notifyAfkDoubleExpEvent(serverId: string, eventData: any): void {
    WebSocketAFK.notifyDoubleExpEvent(serverId, eventData);
  }

  /**
   * Notifier un drop rare pendant le farming
   */
  public static notifyAfkRareDrop(playerId: string, dropData: any): void {
    WebSocketAFK.notifyRareDrop(playerId, dropData);
  }

  /**
   * Notifier qu'un palier important a été atteint
   */
  public static notifyAfkMilestoneReached(playerId: string, milestoneData: any): void {
    WebSocketAFK.notifyMilestoneReached(playerId, milestoneData);
  }  
    // ===== MÉTHODES CAMPAIGN (DÉLÉGATION) =====

  /**
   * Notifier le début d'un combat de campagne
   */
  public static notifyCampaignBattleStarted(playerId: string, battleData: any): void {
    WebSocketCampaign.notifyBattleStarted(playerId, battleData);
  }

  /**
   * Notifier le résultat d'un combat de campagne
   */
  public static notifyCampaignBattleCompleted(playerId: string, battleResult: any): void {
    WebSocketCampaign.notifyBattleCompleted(playerId, battleResult);
  }

  /**
   * Notifier la progression du combat en temps réel
   */
  public static notifyCampaignBattleProgress(playerId: string, progressData: any): void {
    WebSocketCampaign.notifyBattleProgress(playerId, progressData);
  }

  /**
   * Notifier qu'un nouveau niveau a été débloqué
   */
  public static notifyCampaignLevelUnlocked(playerId: string, unlockData: any): void {
    WebSocketCampaign.notifyLevelUnlocked(playerId, unlockData);
  }

  /**
   * Notifier qu'un nouveau monde a été débloqué
   */
  public static notifyCampaignWorldUnlocked(playerId: string, worldData: any): void {
    WebSocketCampaign.notifyWorldUnlocked(playerId, worldData);
  }

  /**
   * Notifier qu'une nouvelle difficulté a été débloquée
   */
  public static notifyCampaignDifficultyUnlocked(playerId: string, difficultyData: any): void {
    WebSocketCampaign.notifyDifficultyUnlocked(playerId, difficultyData);
  }

  /**
   * Notifier le gain d'étoiles et jalons
   */
  public static notifyCampaignStarMilestone(playerId: string, milestoneData: any): void {
    WebSocketCampaign.notifyStarMilestone(playerId, milestoneData);
  }

  /**
   * Notifier les récompenses de premier passage
   */
  public static notifyCampaignFirstClearRewards(playerId: string, rewardsData: any): void {
    WebSocketCampaign.notifyFirstClearRewards(playerId, rewardsData);
  }

  /**
   * Notifier les récompenses de perfectionnement (3 étoiles)
   */
  public static notifyCampaignPerfectClearRewards(playerId: string, perfectData: any): void {
    WebSocketCampaign.notifyPerfectClearRewards(playerId, perfectData);
  }

  /**
   * Notifier les récompenses de complétion de monde
   */
  public static notifyCampaignWorldCompletionRewards(playerId: string, completionData: any): void {
    WebSocketCampaign.notifyWorldCompletionRewards(playerId, completionData);
  }

  /**
   * Notifier l'activation d'un événement campagne (broadcast serveur)
   */
  public static notifyCampaignEvent(serverId: string, eventData: any): void {
    WebSocketCampaign.notifyCampaignEvent(serverId, eventData);
  }

  /**
   * Notifier un drop rare spécial
   */
  public static notifyCampaignRareDrop(playerId: string, dropData: any): void {
    WebSocketCampaign.notifyRareDrop(playerId, dropData);
  }

  /**
   * Notifier une performance exceptionnelle
   */
  public static notifyCampaignExceptionalPerformance(playerId: string, performanceData: any): void {
    WebSocketCampaign.notifyExceptionalPerformance(playerId, performanceData);
  }

  /**
   * Notifier des recommandations intelligentes
   */
  public static notifyCampaignSmartRecommendation(playerId: string, recommendationData: any): void {
    WebSocketCampaign.notifySmartRecommendation(playerId, recommendationData);
  }

  /**
   * Notifier qu'un joueur est bloqué avec suggestions
   */
  public static notifyCampaignProgressBlocked(playerId: string, blockedData: any): void {
    WebSocketCampaign.notifyProgressBlocked(playerId, blockedData);
  }
  // ===== MÉTHODES GACHA (DÉLÉGATION) =====

/**
 * Notifier le résultat d'un pull simple
 */
public static notifyGachaPullResult(playerId: string, pullData: any): void {
  WebSocketGacha.notifyPullResult(playerId, pullData);
}

/**
 * Notifier le résultat d'un multi-pull
 */
public static notifyGachaMultiPullResult(playerId: string, multiPullData: any): void {
  WebSocketGacha.notifyMultiPullResult(playerId, multiPullData);
}

/**
 * Notifier un drop légendaire
 */
public static notifyGachaLegendaryDrop(playerId: string, serverId: string, legendaryData: any): void {
  WebSocketGacha.notifyLegendaryDrop(playerId, serverId, legendaryData);
}

/**
 * Notifier progression du pity
 */
public static notifyGachaPityProgress(playerId: string, pityData: any): void {
  WebSocketGacha.notifyPityProgress(playerId, pityData);
}

/**
 * Notifier que le pity a été triggé
 */
public static notifyGachaPityTriggered(playerId: string, pityResult: any): void {
  WebSocketGacha.notifyPityTriggered(playerId, pityResult);
}

/**
 * Notifier streak de chance
 */
public static notifyGachaLuckyStreak(playerId: string, streakData: any): void {
  WebSocketGacha.notifyLuckyStreak(playerId, streakData);
}

/**
 * Notifier drop ultra-rare
 */
public static notifyGachaUltraRareDrop(playerId: string, serverId: string, ultraRareData: any): void {
  WebSocketGacha.notifyUltraRareDrop(playerId, serverId, ultraRareData);
}

/**
 * Notifier événement rate-up (broadcast serveur)
 */
public static notifyGachaRateUpEvent(serverId: string, eventData: any): void {
  WebSocketGacha.notifyRateUpEvent(serverId, eventData);
}

/**
 * Notifier événement pulls gratuits (broadcast serveur)
 */
public static notifyGachaFreePullsEvent(serverId: string, eventData: any): void {
  WebSocketGacha.notifyFreePullsEvent(serverId, eventData);
}

/**
 * Notifier bannière spéciale (broadcast serveur)
 */
public static notifyGachaSpecialBanner(serverId: string, bannerData: any): void {
  WebSocketGacha.notifySpecialBannerLive(serverId, bannerData);
}

/**
 * Notifier nouveau héros obtenu
 */
public static notifyGachaNewHeroObtained(playerId: string, newHeroData: any): void {
  WebSocketGacha.notifyNewHeroObtained(playerId, newHeroData);
}

/**
 * Notifier collection complétée
 */
public static notifyGachaCollectionCompleted(playerId: string, collectionData: any): void {
  WebSocketGacha.notifyCollectionCompleted(playerId, collectionData);
}

/**
 * Notifier recommandation intelligente
 */
public static notifyGachaSmartRecommendation(playerId: string, recommendation: any): void {
  WebSocketGacha.notifySmartRecommendation(playerId, recommendation);
}

/**
 * Notifier optimisation des ressources
 */
public static notifyGachaResourceOptimization(playerId: string, optimizationData: any): void {
  WebSocketGacha.notifyResourceOptimization(playerId, optimizationData);
}

  // ===== MÉTHODES SHOP (DÉLÉGATION) =====

/**
 * Notifier succès d'achat
 */
public static notifyShopPurchaseSuccess(playerId: string, purchaseData: any): void {
  WebSocketShop.notifyPurchaseSuccess(playerId, purchaseData);
}

/**
 * Notifier échec d'achat  
 */
public static notifyShopPurchaseFailure(playerId: string, failureData: any): void {
  WebSocketShop.notifyPurchaseFailure(playerId, failureData);
}

/**
 * Notifier refresh de boutique
 */
public static notifyShopRefreshed(playerId: string, refreshData: any): void {
  WebSocketShop.notifyShopRefreshed(playerId, refreshData);
}

/**
 * Notifier reset automatique de boutique (broadcast serveur)
 */
public static notifyShopAutoReset(serverId: string, resetData: any): void {
  WebSocketShop.notifyShopAutoReset(serverId, resetData);
}
/**
 * Notifier reset global de boutique
 */
public static notifyGlobalShopReset(resetData: {
  shopType: string;
  shopName: string;
  newItemsCount: number;
  resetTime: Date;
}): void {
  WebSocketShop.notifyGlobalShopReset(resetData);
}
/**
 * Notifier nouvelle boutique disponible
 */
public static notifyNewShopAvailable(playerId: string, shopData: any): void {
  WebSocketShop.notifyNewShopAvailable(playerId, shopData);
}

/**
 * Notifier offre flash limitée
 */
public static notifyFlashOffer(playerId: string, offerData: any): void {
  WebSocketShop.notifyFlashOffer(playerId, offerData);
}

/**
 * Notifier événement boutique spécial (broadcast serveur)
 */
public static notifyShopEvent(serverId: string, eventData: any): void {
  WebSocketShop.notifyShopEvent(serverId, eventData);
}

/**
 * Notifier recommandation intelligente
 */
public static notifyShopSmartRecommendation(playerId: string, recommendation: any): void {
  WebSocketShop.notifySmartRecommendation(playerId, recommendation);
}
  
  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Vérifier si un joueur est connecté
   */
  public static isPlayerConnected(playerId: string): boolean {
    return this.connectedPlayers.has(playerId);
  }

  /**
   * Obtenir le nombre de joueurs connectés sur un serveur
   */
  private static getServerPlayerCount(serverId: string): number {
    let count = 0;
    for (const connection of this.connectedPlayers.values()) {
      if (connection.serverId === serverId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Envoyer un message personnalisé à un joueur
   */
  public static sendToPlayer(playerId: string, event: string, data: any): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit(event, {
      data,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast à tous les joueurs d'un serveur
   */
  public static broadcastToServer(serverId: string, event: string, data: any): void {
    if (!this.io) return;

    this.io.to(`server:${serverId}`).emit(event, {
      data,
      timestamp: new Date()
    });
  }

  /**
   * Obtenir les statistiques des connexions
   */
  public static getConnectionStats(): any {
    const connectionsByServer: Record<string, number> = {};
    
    for (const connection of this.connectedPlayers.values()) {
      connectionsByServer[connection.serverId] = (connectionsByServer[connection.serverId] || 0) + 1;
    }

    return {
      totalConnections: this.connectedPlayers.size,
      connectionsByServer,
      isActive: this.io !== null,
      modules: {
        arena: WebSocketArena.isAvailable(),
        afk: WebSocketAFK.isAvailable(),
        campaign: WebSocketCampaign.isAvailable(),
        gacha: WebSocketGacha.isAvailable(),
        shop: WebSocketShop.isAvailable()
        // TODO: Ajouter d'autres modules
      }
    };
  }

  /**
   * Fermer le serveur WebSocket
   */
  public static close(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
      this.connectedPlayers.clear();
      console.log('🔌 WebSocket Server closed');
    }
  }
}

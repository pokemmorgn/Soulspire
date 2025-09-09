// server/src/services/WebSocketService.ts
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import Player from '../models/Player';
import { WebSocketArena } from './websocket/WebSocketArena';
import { WebSocketAFK } from './websocket/WebSocketAFK';
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
        afk: WebSocketAFK.isAvailable()
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

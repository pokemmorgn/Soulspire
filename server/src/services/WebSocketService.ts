// server/src/services/WebSocketService.ts
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import Player from '../models/Player';

/**
 * SERVICE WEBSOCKET GLOBAL
 * Commence par l'arène, extensible pour tous les services
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

    console.log('✅ WebSocket Server initialized');
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

    // Gestionnaires d'événements
    socket.on('arena:join_room', () => {
      socket.join(`arena:${serverId}`);
      console.log(`🏟️ ${playerName} joined arena room`);
    });

    socket.on('arena:leave_room', () => {
      socket.leave(`arena:${serverId}`);
      console.log(`🚪 ${playerName} left arena room`);
    });

    // Ping/Pong pour maintenir la connexion
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

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

  // ===== MÉTHODES ARÈNE =====

  /**
   * Notifier le résultat d'un combat d'arène
   */
  public static notifyArenaMatchResult(
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
    if (!this.io) return;

    const connection = this.connectedPlayers.get(playerId);
    if (!connection) {
      console.log(`⚠️ Player ${playerId} not connected for match result`);
      return;
    }

    this.io.to(`player:${playerId}`).emit('arena:match_result', {
      type: 'match_result',
      data: matchResult,
      timestamp: new Date(),
      animation: matchResult.victory ? 'victory' : 'defeat'
    });

    console.log(`⚔️ Match result sent to ${playerId}: ${matchResult.victory ? 'Victory' : 'Defeat'}`);
  }

  /**
   * Notifier une promotion/relégation
   */
  public static notifyArenaPromotion(
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

    const connection = this.connectedPlayers.get(playerId);
    if (!connection) return;

    this.io.to(`player:${playerId}`).emit('arena:promotion', {
      type: promotionData.promoted ? 'promotion' : 'relegation',
      data: promotionData,
      timestamp: new Date(),
      animation: promotionData.promoted ? 'promotion_celebration' : 'relegation_sad'
    });

    console.log(`🎉 ${promotionData.promoted ? 'Promotion' : 'Relegation'} sent to ${playerId}: ${promotionData.oldLeague} → ${promotionData.newLeague}`);
  }

  /**
   * Notifier qu'on a été attaqué en défense
   */
  public static notifyArenaDefenseAttacked(
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

    const connection = this.connectedPlayers.get(defenderId);
    if (!connection) return;

    this.io.to(`player:${defenderId}`).emit('arena:defense_attacked', {
      type: 'defense_result',
      data: attackData,
      timestamp: new Date(),
      priority: 'normal'
    });

    console.log(`🛡️ Defense result sent to ${defenderId}: ${attackData.result} vs ${attackData.attackerName}`);
  }

  /**
   * Notifier une nouvelle saison d'arène (broadcast serveur)
   */
  public static notifyArenaNewSeason(
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

    const playerCount = this.getServerPlayerCount(serverId);
    console.log(`🎭 New season notification sent to ${playerCount} players on ${serverId}`);
  }

  /**
   * Notifier mise à jour des classements (broadcast)
   */
  public static notifyArenaLeaderboardUpdate(
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

    console.log(`📊 Leaderboard update sent to arena room ${serverId}`);
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
  public static sendToPlayer(
    playerId: string,
    event: string,
    data: any
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit(event, {
      data,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast à tous les joueurs d'un serveur
   */
  public static broadcastToServer(
    serverId: string,
    event: string,
    data: any
  ): void {
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
      isActive: this.io !== null
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

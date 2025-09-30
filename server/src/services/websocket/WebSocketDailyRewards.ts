// server/src/services/websocket/WebSocketDailyRewards.ts

import { Server as SocketIOServer } from 'socket.io';

/**
 * MODULE WEBSOCKET - DAILY REWARDS
 * Gère les notifications temps réel pour les récompenses quotidiennes
 */
export class WebSocketDailyRewards {
  private static io: SocketIOServer | null = null;

  // ===== INITIALISATION =====

  /**
   * Initialiser le module WebSocket Daily Rewards
   */
  public static initialize(io: SocketIOServer): void {
    this.io = io;
    console.log('✅ WebSocket Daily Rewards module initialized');
  }

  /**
   * Vérifier si le module est disponible
   */
  public static isAvailable(): boolean {
    return this.io !== null;
  }

  // ===== ÉVÉNEMENTS CÔTÉ CLIENT → SERVEUR =====

  /**
   * Configurer les gestionnaires d'événements pour un socket
   */
  public static setupSocketHandlers(socket: any): void {
    // S'abonner aux notifications daily rewards
    socket.on('daily_rewards:subscribe', () => {
      socket.join(`daily_rewards:${socket.serverId}`);
      console.log(`🎁 ${socket.playerName} subscribed to daily rewards`);
      
      socket.emit('daily_rewards:subscribed', {
        success: true,
        message: 'Successfully subscribed to daily rewards notifications'
      });
    });

    // Se désabonner des notifications
    socket.on('daily_rewards:unsubscribe', () => {
      socket.leave(`daily_rewards:${socket.serverId}`);
      console.log(`🚪 ${socket.playerName} unsubscribed from daily rewards`);
      
      socket.emit('daily_rewards:unsubscribed', {
        success: true,
        message: 'Successfully unsubscribed from daily rewards notifications'
      });
    });

    // Ping pour vérifier la connexion
    socket.on('daily_rewards:ping', () => {
      socket.emit('daily_rewards:pong', {
        timestamp: Date.now(),
        status: 'connected'
      });
    });
  }

  // ===== ÉVÉNEMENTS CÔTÉ SERVEUR → CLIENT =====

  /**
   * Notifier qu'une récompense quotidienne a été réclamée
   */
  public static notifyRewardClaimed(playerId: string, claimData: {
    day: number;
    rewards: any[];
    streakBonus: number;
    currentStreak: number;
    totalValue: number;
    dayTitle?: string;
    isSpecial?: boolean;
  }): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('daily_rewards:claimed', {
      success: true,
      label: 'DAILY_REWARD_CLAIMED', // "Daily reward claimed!"
      data: claimData,
      timestamp: new Date()
    });

    console.log(`🎁 Notified ${playerId}: Daily reward day ${claimData.day} claimed (streak: ${claimData.currentStreak})`);
  }

  /**
   * Notifier qu'une nouvelle récompense est disponible
   */
  public static notifyRewardAvailable(playerId: string, availableData: {
    canClaim: boolean;
    nextDay: number;
    currentStreak: number;
    estimatedValue: number;
    dayTitle?: string;
    isSpecial?: boolean;
  }): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('daily_rewards:available', {
      label: 'DAILY_REWARD_AVAILABLE', // "New daily reward available!"
      data: availableData,
      timestamp: new Date()
    });

    console.log(`🎁 Notified ${playerId}: Daily reward available for day ${availableData.nextDay}`);
  }

  /**
   * Notifier qu'un milestone de streak a été atteint
   */
  public static notifyStreakMilestone(playerId: string, milestoneData: {
    streak: number;
    milestoneLabel: string;
    bonusRewards: any;
    nextMilestone?: number;
  }): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('daily_rewards:milestone', {
      label: 'DAILY_REWARD_MILESTONE_ACHIEVED', // "Streak milestone achieved!"
      data: milestoneData,
      timestamp: new Date()
    });

    console.log(`🏆 Notified ${playerId}: Streak milestone ${milestoneData.streak} days achieved`);
  }

  /**
   * Notifier qu'un streak a été perdu/reset
   */
  public static notifyStreakReset(playerId: string, resetData: {
    previousStreak: number;
    reason: 'missed_days' | 'manual_reset';
    missedDays: number;
    canRecover?: boolean;
  }): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('daily_rewards:streak_reset', {
      label: 'DAILY_REWARD_STREAK_RESET', // "Your streak has been reset"
      data: resetData,
      timestamp: new Date()
    });

    console.log(`⚠️ Notified ${playerId}: Streak reset (was ${resetData.previousStreak} days)`);
  }

  /**
   * Notifier un rappel avant expiration de la récompense quotidienne
   */
  public static notifyRewardReminder(playerId: string, reminderData: {
    hoursLeft: number;
    nextDay: number;
    currentStreak: number;
    willLoseStreak: boolean;
    estimatedValue: number;
  }): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('daily_rewards:reminder', {
      label: 'DAILY_REWARD_REMINDER', // "Don't forget to claim your daily reward!"
      data: reminderData,
      timestamp: new Date()
    });

    console.log(`⏰ Notified ${playerId}: Reminder to claim reward (${reminderData.hoursLeft}h left)`);
  }

  /**
   * Notifier un événement spécial daily rewards (broadcast serveur)
   */
  public static notifySpecialEvent(serverId: string, eventData: {
    eventType: 'double_rewards' | 'bonus_streak' | 'special_day';
    eventName: string;
    description: string;
    durationHours: number;
    bonusMultiplier?: number;
    affectedDays?: number[];
  }): void {
    if (!this.io) return;

    this.io.to(`daily_rewards:${serverId}`).emit('daily_rewards:special_event', {
      label: 'DAILY_REWARD_SPECIAL_EVENT', // "Special daily rewards event active!"
      data: eventData,
      timestamp: new Date()
    });

    console.log(`🎉 Broadcast to ${serverId}: Daily rewards special event "${eventData.eventName}"`);
  }

  /**
   * Notifier une mise à jour de la configuration des récompenses
   */
  public static notifyConfigUpdate(serverId: string, updateData: {
    updateType: 'rewards_adjusted' | 'new_milestones' | 'bonus_active';
    message: string;
    affectedDays?: number[];
  }): void {
    if (!this.io) return;

    this.io.to(`daily_rewards:${serverId}`).emit('daily_rewards:config_updated', {
      label: 'DAILY_REWARD_CONFIG_UPDATED', // "Daily rewards updated!"
      data: updateData,
      timestamp: new Date()
    });

    console.log(`🔄 Broadcast to ${serverId}: Daily rewards config updated`);
  }

  /**
   * Notifier le statut actuel à un joueur (lors de la connexion)
   */
  public static notifyCurrentStatus(playerId: string, statusData: {
    canClaim: boolean;
    currentDay: number;
    currentStreak: number;
    longestStreak: number;
    timeUntilNext: number;
    nextReward: any;
  }): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('daily_rewards:status', {
      label: 'DAILY_REWARD_STATUS', // "Daily rewards status"
      data: statusData,
      timestamp: new Date()
    });

    console.log(`📊 Sent daily rewards status to ${playerId}`);
  }

  /**
   * Notifier un classement/leaderboard update (broadcast serveur)
   */
  public static notifyLeaderboardUpdate(serverId: string, leaderboardData: {
    topPlayers: Array<{
      playerId: string;
      playerName: string;
      currentStreak: number;
      rank: number;
    }>;
    updateReason: 'new_leader' | 'milestone_reached' | 'scheduled_update';
  }): void {
    if (!this.io) return;

    this.io.to(`daily_rewards:${serverId}`).emit('daily_rewards:leaderboard_update', {
      label: 'DAILY_REWARD_LEADERBOARD_UPDATED', // "Streak leaderboard updated"
      data: leaderboardData,
      timestamp: new Date()
    });

    console.log(`🏆 Broadcast to ${serverId}: Daily rewards leaderboard updated`);
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Envoyer un message personnalisé à un joueur
   */
  public static sendCustomNotification(playerId: string, notification: {
    type: 'info' | 'warning' | 'success' | 'error';
    label: string;
    message: string;
    data?: any;
  }): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('daily_rewards:notification', {
      ...notification,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast personnalisé à un serveur
   */
  public static broadcastToServer(serverId: string, event: string, data: any): void {
    if (!this.io) return;

    this.io.to(`daily_rewards:${serverId}`).emit(event, {
      data,
      timestamp: new Date()
    });
  }

  /**
   * Obtenir les statistiques du module
   */
  public static getModuleStats(): {
    isActive: boolean;
    activeConnections: number;
  } {
    return {
      isActive: this.io !== null,
      activeConnections: this.io?.sockets.sockets.size || 0
    };
  }
}

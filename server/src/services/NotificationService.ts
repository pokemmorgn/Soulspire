// src/services/NotificationService.ts
import Player from "../models/Player";
import { FeatureUnlockService, FeatureUnlock } from "./FeatureUnlockService";

export interface Notification {
  id: string;
  type: "feature_unlock" | "level_up" | "world_complete" | "achievement" | "system";
  title: string;
  message: string;
  iconUrl?: string;
  actionUrl?: string;
  priority: "low" | "normal" | "high" | "urgent";
  timestamp: Date;
  isRead: boolean;
  metadata?: Record<string, any>;
}

export interface ProgressUpdate {
  level?: number;
  world?: number;
  newFeatures?: string[];
  achievementUnlocked?: string;
  milestone?: string;
}

export class NotificationService {
  
  // === NOTIFICATIONS DE DÉBLOCAGE ===
  
  /**
   * Notifier le déblocage d'une feature
   */
  public static async notifyFeatureUnlock(
    playerId: string, 
    serverId: string, 
    featureId: string
  ): Promise<void> {
    try {
      const feature = FeatureUnlockService.getFeatureConfig(featureId);
      if (!feature) {
        console.warn(`Feature ${featureId} not found for notification`);
        return;
      }

      const notification: Notification = {
        id: `feature_${featureId}_${Date.now()}`,
        type: "feature_unlock",
        title: "🎉 Nouvelle fonctionnalité débloquée !",
        message: `${feature.name} est maintenant disponible ! ${feature.description}`,
        iconUrl: feature.iconUrl || this.getFeatureIcon(featureId),
        actionUrl: this.getFeatureActionUrl(featureId),
        priority: feature.isCore ? "high" : "normal",
        timestamp: new Date(),
        isRead: false,
        metadata: {
          featureId,
          category: feature.category,
          condition: feature.condition
        }
      };

      await this.saveNotification(playerId, serverId, notification);
      console.log(`🔔 Feature unlock notification sent: ${featureId} to ${playerId}`);
      
    } catch (error) {
      console.error("Error sending feature unlock notification:", error);
    }
  }

  /**
   * Vérifier et notifier tous les nouveaux déblocages
   */
  public static async checkAndNotifyNewUnlocks(
    playerId: string, 
    serverId: string, 
    previousLevel: number,
    previousWorld: number
  ): Promise<string[]> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) return [];

      const currentLevel = player.level || 1;
      const currentWorld = player.world || 1;
      
      // Récupérer toutes les features actuellement débloquées
      const unlockedFeatures = await FeatureUnlockService.getUnlockedFeatures(playerId, serverId);
      const newUnlocks: string[] = [];

      // Vérifier chaque feature pour voir si elle vient d'être débloquée
      for (const feature of unlockedFeatures) {
        const wasUnlockedBefore = this.wasFeatureUnlockedBefore(
          feature, 
          previousLevel, 
          previousWorld
        );
        
        if (!wasUnlockedBefore) {
          await this.notifyFeatureUnlock(playerId, serverId, feature.featureId);
          newUnlocks.push(feature.featureId);
        }
      }

      return newUnlocks;
      
    } catch (error) {
      console.error("Error checking new unlocks:", error);
      return [];
    }
  }

  /**
   * Notifier une mise à jour de progression
   */
  public static async sendProgressUpdate(
    playerId: string,
    serverId: string,
    update: ProgressUpdate
  ): Promise<void> {
    try {
      let title = "📈 Progression mise à jour";
      let message = "";

      if (update.level) {
        message += `Niveau ${update.level} atteint ! `;
      }
      
      if (update.world) {
        message += `Monde ${update.world} débloqué ! `;
      }

      if (update.newFeatures && update.newFeatures.length > 0) {
        const featureNames = update.newFeatures
          .map(id => FeatureUnlockService.getFeatureConfig(id)?.name || id)
          .join(", ");
        message += `Nouvelles fonctionnalités : ${featureNames}`;
      }

      if (update.milestone) {
        title = "🏆 Étape importante !";
        message = update.milestone;
      }

      const notification: Notification = {
        id: `progress_${Date.now()}`,
        type: update.level ? "level_up" : update.world ? "world_complete" : "system",
        title,
        message: message.trim(),
        priority: "normal",
        timestamp: new Date(),
        isRead: false,
        metadata: update
      };

      await this.saveNotification(playerId, serverId, notification);
      
    } catch (error) {
      console.error("Error sending progress update:", error);
    }
  }

  // === GESTION DES NOTIFICATIONS ===

  /**
   * Récupérer les notifications d'un joueur
   */
  public static async getPlayerNotifications(
    playerId: string,
    serverId: string,
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) return [];

      let notifications = (player as any).notifications || [];
      
      if (unreadOnly) {
        notifications = notifications.filter((n: Notification) => !n.isRead);
      }

      return notifications
        .sort((a: Notification, b: Notification) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
        
    } catch (error) {
      console.error("Error getting player notifications:", error);
      return [];
    }
  }

  /**
   * Marquer des notifications comme lues
   */
  public static async markNotificationsAsRead(
    playerId: string,
    serverId: string,
    notificationIds: string[]
  ): Promise<boolean> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) return false;

      const notifications = (player as any).notifications || [];
      let updated = false;

      notifications.forEach((notification: Notification) => {
        if (notificationIds.includes(notification.id) && !notification.isRead) {
          notification.isRead = true;
          updated = true;
        }
      });

      if (updated) {
        (player as any).notifications = notifications;
        await player.save();
      }

      return updated;
      
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      return false;
    }
  }

  /**
   * Obtenir le nombre de notifications non lues
   */
  public static async getUnreadCount(playerId: string, serverId: string): Promise<number> {
    try {
      const notifications = await this.getPlayerNotifications(playerId, serverId, 100, true);
      return notifications.length;
      
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }

  // === MÉTHODES UTILITAIRES ===

  /**
   * Sauvegarder une notification
   */
  private static async saveNotification(
    playerId: string,
    serverId: string,
    notification: Notification
  ): Promise<void> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) return;

      if (!(player as any).notifications) {
        (player as any).notifications = [];
      }

      (player as any).notifications.push(notification);

      // Garder seulement les 50 dernières notifications
      if ((player as any).notifications.length > 50) {
        (player as any).notifications = (player as any).notifications.slice(-50);
      }

      await player.save();
      
    } catch (error) {
      console.error("Error saving notification:", error);
    }
  }

  /**
   * Vérifier si une feature était débloquée avant
   */
  private static wasFeatureUnlockedBefore(
    feature: FeatureUnlock,
    previousLevel: number,
    previousWorld: number
  ): boolean {
    switch (feature.condition.type) {
      case "level":
        return previousLevel >= feature.condition.value;
      case "world":
        return previousWorld >= feature.condition.value;
      default:
        return false;
    }
  }

  /**
   * Obtenir l'icône d'une feature
   */
  private static getFeatureIcon(featureId: string): string {
    const icons: Record<string, string> = {
      "gacha": "🎰",
      "tower": "🗼", 
      "arena": "⚔️",
      "hero_upgrade": "⭐",
      "formations": "🎯",
      "shop_basic": "🛒",
      "shop_premium": "💎",
      "vip_rewards": "👑",
      "bounty_board": "📋",
      "campaign_hard": "🔥",
      "campaign_nightmare": "💀"
    };
    return icons[featureId] || "🎮";
  }

  /**
   * Obtenir l'URL d'action d'une feature
   */
  private static getFeatureActionUrl(featureId: string): string {
    const urls: Record<string, string> = {
      "gacha": "/gacha",
      "tower": "/tower",
      "arena": "/battle/arena",
      "hero_upgrade": "/heroes/upgrade",
      "formations": "/player/formation",
      "shop_basic": "/shop",
      "shop_premium": "/shop/premium",
      "vip_rewards": "/vip",
      "bounty_board": "/missions"
    };
    return urls[featureId] || "/";
  }

  // === NOTIFICATIONS SPÉCIALES ===

  /**
   * Notification de premier déblocage important
   */
  public static async notifyMajorMilestone(
    playerId: string,
    serverId: string,
    milestone: string,
    description: string
  ): Promise<void> {
    const notification: Notification = {
      id: `milestone_${Date.now()}`,
      type: "achievement",
      title: "🏆 Étape majeure atteinte !",
      message: `${milestone}: ${description}`,
      priority: "urgent",
      timestamp: new Date(),
      isRead: false,
      metadata: { milestone, type: "major" }
    };

    await this.saveNotification(playerId, serverId, notification);
  }

  /**
   * Notification système (maintenance, événements, etc.)
   */
  public static async sendSystemNotification(
    serverId: string | "ALL",
    title: string,
    message: string,
    priority: "low" | "normal" | "high" | "urgent" = "normal"
  ): Promise<void> {
    try {
      const filter = serverId === "ALL" ? {} : { serverId };
      const players = await Player.find(filter).select('_id serverId');

      const notification: Notification = {
        id: `system_${Date.now()}`,
        type: "system",
        title,
        message,
        priority,
        timestamp: new Date(),
        isRead: false,
        metadata: { isSystem: true, scope: serverId }
      };

      // Envoyer à tous les joueurs concernés
      for (const player of players) {
        await this.saveNotification(player._id.toString(), player.serverId, notification);
      }

      console.log(`📢 System notification sent to ${players.length} players on ${serverId}`);
      
    } catch (error) {
      console.error("Error sending system notification:", error);
    }
  }
}

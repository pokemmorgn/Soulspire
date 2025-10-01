// server/src/services/FreePullService.ts

import Player from "../models/Player";
import Banner from "../models/Banner";
import { IFreePullConfig } from "../models/Banner";

export interface FreePullStatus {
  bannerId: string;
  bannerName: string;
  isEnabled: boolean;
  pullsAvailable: number;
  pullsUsed: number;
  resetType: string;
  nextResetAt: Date;
  timeUntilReset: number; // en secondes
  labelKey: string; // ✅ NOUVEAU : Clé i18n pour le statut
}

export class FreePullService {
  
  /**
   * Calculer la prochaine date de reset selon le type
   */
  static calculateNextResetDate(resetType: "daily" | "weekly" | "monthly" | "never"): Date {
    const now = new Date();
    const nextReset = new Date(now);
    
    switch (resetType) {
      case "daily":
        // Prochain minuit
        nextReset.setDate(nextReset.getDate() + 1);
        nextReset.setHours(0, 0, 0, 0);
        break;
        
      case "weekly":
        // Prochain lundi à minuit
        const daysUntilMonday = (8 - nextReset.getDay()) % 7 || 7;
        nextReset.setDate(nextReset.getDate() + daysUntilMonday);
        nextReset.setHours(0, 0, 0, 0);
        break;
        
      case "monthly":
        // Premier jour du mois prochain à minuit
        nextReset.setMonth(nextReset.getMonth() + 1, 1);
        nextReset.setHours(0, 0, 0, 0);
        break;
        
      case "never":
        // Date très lointaine (10 ans)
        nextReset.setFullYear(nextReset.getFullYear() + 10);
        break;
    }
    
    return nextReset;
  }
  
  /**
   * Obtenir le label i18n pour le reset type
   */
  static getResetTypeLabel(resetType: string): string {
    const labelMap: { [key: string]: string } = {
      "daily": "FREE_PULL_RESET_DAILY",
      "weekly": "FREE_PULL_RESET_WEEKLY",
      "monthly": "FREE_PULL_RESET_MONTHLY",
      "never": "FREE_PULL_RESET_NEVER"
    };
    
    return labelMap[resetType] || "FREE_PULL_RESET_UNKNOWN";
  }
  
  /**
   * Initialiser les pulls gratuits pour un joueur sur une bannière
   */
  static async initializeFreePullsForPlayer(
    playerId: string,
    bannerId: string,
    config: IFreePullConfig
  ): Promise<void> {
    try {
      if (!config.enabled) {
        console.log(`⏭️ Free pulls not enabled for banner ${bannerId}, skipping initialization`);
        return;
      }
      
      const player = await Player.findById(playerId);
      if (!player) {
        throw new Error("Player not found");
      }
      
      // Vérifier si déjà initialisé
      const existing = player.getFreePullTracker(bannerId);
      if (existing) {
        console.log(`✅ Free pulls already initialized for player ${playerId} on banner ${bannerId}`);
        return;
      }
      
      // Calculer la prochaine date de reset
      const nextResetAt = this.calculateNextResetDate(config.resetType);
      
      // Initialiser
      await player.initializeFreePulls(bannerId, config.pullsPerReset, nextResetAt);
      
      console.log(`🎁 Initialized ${config.pullsPerReset} free pull(s) for player ${playerId} on banner ${bannerId} (reset: ${config.resetType})`);
      
    } catch (error: any) {
      console.error("❌ Error initializeFreePullsForPlayer:", error);
      throw error;
    }
  }
  
  /**
   * Obtenir le statut des pulls gratuits pour toutes les bannières d'un joueur
   */
  static async getFreePullsStatus(
    playerId: string,
    serverId: string
  ): Promise<FreePullStatus[]> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }
      
      // Récupérer toutes les bannières actives avec pulls gratuits
      const banners = await Banner.find({
        isActive: true,
        isVisible: true,
        "freePullConfig.enabled": true,
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      });
      
      const statuses: FreePullStatus[] = [];
      
      for (const banner of banners) {
        const config = banner.freePullConfig;
        
        if (!config || !config.enabled) continue;
        
        // Vérifier les dates de début/fin si définies
        const now = new Date();
        if (config.startsAt && now < config.startsAt) continue;
        if (config.endsAt && now > config.endsAt) continue;
        
        // Initialiser si nécessaire
        let tracker = player.getFreePullTracker(banner.bannerId);
        if (!tracker) {
          await this.initializeFreePullsForPlayer(playerId, banner.bannerId, config);
          tracker = player.getFreePullTracker(banner.bannerId);
        }
        
        // Vérifier si doit être reset
        if (tracker && tracker.nextResetAt <= now) {
          const nextResetAt = this.calculateNextResetDate(config.resetType);
          await player.resetFreePulls(banner.bannerId, config.pullsPerReset, nextResetAt);
          tracker = player.getFreePullTracker(banner.bannerId);
        }
        
        if (tracker) {
          const timeUntilReset = Math.max(0, Math.floor((tracker.nextResetAt.getTime() - now.getTime()) / 1000));
          
          statuses.push({
            bannerId: banner.bannerId,
            bannerName: banner.name,
            isEnabled: true,
            pullsAvailable: tracker.pullsAvailable,
            pullsUsed: tracker.pullsUsed,
            resetType: config.resetType,
            nextResetAt: tracker.nextResetAt,
            timeUntilReset,
            labelKey: this.getResetTypeLabel(config.resetType) // ✅ NOUVEAU
          });
        }
      }
      
      return statuses;
      
    } catch (error: any) {
      console.error("❌ Error getFreePullsStatus:", error);
      throw error;
    }
  }
  
  /**
   * Obtenir le statut des pulls gratuits pour une bannière spécifique
   */
  static async getFreePullStatusForBanner(
    playerId: string,
    serverId: string,
    bannerId: string
  ): Promise<FreePullStatus | null> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }
      
      const banner = await Banner.findOne({
        bannerId,
        isActive: true,
        isVisible: true,
        "freePullConfig.enabled": true,
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      });
      
      if (!banner || !banner.freePullConfig || !banner.freePullConfig.enabled) {
        return null;
      }
      
      const config = banner.freePullConfig;
      const now = new Date();
      
      // Vérifier les dates de début/fin
      if (config.startsAt && now < config.startsAt) return null;
      if (config.endsAt && now > config.endsAt) return null;
      
      // Initialiser si nécessaire
      let tracker = player.getFreePullTracker(bannerId);
      if (!tracker) {
        await this.initializeFreePullsForPlayer(playerId, bannerId, config);
        tracker = player.getFreePullTracker(bannerId);
      }
      
      // Vérifier si doit être reset
      if (tracker && tracker.nextResetAt <= now) {
        const nextResetAt = this.calculateNextResetDate(config.resetType);
        await player.resetFreePulls(bannerId, config.pullsPerReset, nextResetAt);
        tracker = player.getFreePullTracker(bannerId);
      }
      
      if (!tracker) return null;
      
      const timeUntilReset = Math.max(0, Math.floor((tracker.nextResetAt.getTime() - now.getTime()) / 1000));
      
      return {
        bannerId: banner.bannerId,
        bannerName: banner.name,
        isEnabled: true,
        pullsAvailable: tracker.pullsAvailable,
        pullsUsed: tracker.pullsUsed,
        resetType: config.resetType,
        nextResetAt: tracker.nextResetAt,
        timeUntilReset,
        labelKey: this.getResetTypeLabel(config.resetType) // ✅ NOUVEAU
      };
      
    } catch (error: any) {
      console.error("❌ Error getFreePullStatusForBanner:", error);
      throw error;
    }
  }
  
  /**
   * Vérifier si un joueur peut utiliser un pull gratuit sur une bannière
   */
  static async canUseFreePull(
    playerId: string,
    serverId: string,
    bannerId: string,
    count: number = 1
  ): Promise<{ canUse: boolean; labelKey?: string; params?: any }> {
    try {
      const status = await this.getFreePullStatusForBanner(playerId, serverId, bannerId);
      
      if (!status) {
        return { 
          canUse: false, 
          labelKey: "FREE_PULL_NOT_AVAILABLE"
        };
      }
      
      if (status.pullsAvailable < count) {
        return { 
          canUse: false, 
          labelKey: "FREE_PULL_INSUFFICIENT",
          params: {
            available: status.pullsAvailable,
            required: count
          }
        };
      }
      
      return { canUse: true };
      
    } catch (error: any) {
      console.error("❌ Error canUseFreePull:", error);
      return { 
        canUse: false, 
        labelKey: "FREE_PULL_ERROR",
        params: { error: error.message }
      };
    }
  }
  
  /**
   * Utiliser un pull gratuit
   */
  static async useFreePull(
    playerId: string,
    serverId: string,
    bannerId: string,
    count: number = 1
  ): Promise<{ success: boolean; labelKey?: string; params?: any }> {
    try {
      // Vérifier si peut utiliser
      const canUse = await this.canUseFreePull(playerId, serverId, bannerId, count);
      
      if (!canUse.canUse) {
        return { 
          success: false, 
          labelKey: canUse.labelKey,
          params: canUse.params
        };
      }
      
      // Utiliser
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return { 
          success: false, 
          labelKey: "PLAYER_NOT_FOUND"
        };
      }
      
      const used = await player.useFreePull(bannerId, count);
      
      if (!used) {
        return { 
          success: false, 
          labelKey: "FREE_PULL_USE_FAILED"
        };
      }
      
      console.log(`🎁 Player ${playerId} used ${count} free pull(s) on banner ${bannerId}`);
      
      return { 
        success: true,
        labelKey: "FREE_PULL_SUCCESS",
        params: { count }
      };
      
    } catch (error: any) {
      console.error("❌ Error useFreePull:", error);
      return { 
        success: false, 
        labelKey: "FREE_PULL_ERROR",
        params: { error: error.message }
      };
    }
  }
  
  /**
   * Reset manuel des pulls gratuits pour tous les joueurs d'une bannière (admin)
   */
  static async resetFreePullsForAllPlayers(
    serverId: string,
    bannerId: string
  ): Promise<{ playersReset: number; labelKey: string }> {
    try {
      console.log(`🔄 Starting free pulls reset for all players on banner ${bannerId}...`);
      
      const banner = await Banner.findOne({ bannerId });
      if (!banner || !banner.freePullConfig || !banner.freePullConfig.enabled) {
        return {
          playersReset: 0,
          labelKey: "FREE_PULL_BANNER_NOT_FOUND"
        };
      }
      
      const config = banner.freePullConfig;
      const nextResetAt = this.calculateNextResetDate(config.resetType);
      
      // Trouver tous les joueurs avec tracker pour cette bannière
      const players = await Player.find({
        serverId,
        "freePulls.bannerId": bannerId
      });
      
      let count = 0;
      
      for (const player of players) {
        await player.resetFreePulls(bannerId, config.pullsPerReset, nextResetAt);
        count++;
      }
      
      console.log(`✅ Reset ${count} players' free pulls on banner ${bannerId}`);
      
      return { 
        playersReset: count,
        labelKey: "FREE_PULL_RESET_SUCCESS"
      };
      
    } catch (error: any) {
      console.error("❌ Error resetFreePullsForAllPlayers:", error);
      throw error;
    }
  }
}

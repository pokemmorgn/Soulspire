// server/src/services/DailyRewardsService.ts

import DailyRewards, { IDailyRewardItem, IDailyRewardClaim } from "../models/DailyRewards";
import Player from "../models/Player";
import { VipService } from "./VipService";
import { MailService } from "./MailService";
import { InventoryService } from "./InventoryService";
import { MissionService } from "./MissionService";
import { EventService } from "./EventService";
import { WebSocketService } from "./WebSocketService";
import { DAILY_REWARDS_CONFIG, getDayConfig } from "../config/DailyRewardsConfig";

// === TYPES DE RÉSULTATS ===

export interface DailyRewardClaimResult {
  success: boolean;
  claim?: IDailyRewardClaim;
  appliedRewards?: {
    gold: number;
    gems: number;
    tickets: number;
    items: Array<{ itemId: string; quantity: number }>;
  };
  streakInfo?: {
    currentStreak: number;
    streakBonus: number;
    streakTier: string;
    nextMilestone?: number;
  };
  error?: string;
  code?: string;
}

export interface DailyRewardStatusResult {
  success: boolean;
  status?: {
    canClaim: boolean;
    timeUntilNext: number;
    currentDay: number;
    nextDay: number;
    currentStreak: number;
    longestStreak: number;
    streakTier: string;
    streakMultiplier: number;
    missedToday: boolean;
    totalClaims: number;
  };
  nextReward?: {
    day: number;
    title?: string;
    isSpecial?: boolean;
    rewards: IDailyRewardItem[];
    estimatedValue: number;
  };
  playerInfo?: {
    vipLevel: number;
    vipBonus: number;
  };
  error?: string;
}

export interface DailyRewardPreviewResult {
  success: boolean;
  preview?: Array<{
    day: number;
    title: string;
    isSpecial: boolean;
    rewards: IDailyRewardItem[];
    baseValue: number;
    vipBonusValue: number;
    streakBonusValue?: number;
  }>;
  error?: string;
}

export class DailyRewardsService {

  // ===== RÉCLAMER LES RÉCOMPENSES QUOTIDIENNES =====

  /**
   * Réclamer les récompenses quotidiennes pour un joueur
   */
  public static async claimDailyReward(
    playerId: string,
    serverId: string
  ): Promise<DailyRewardClaimResult> {
    try {
      console.log(`🎁 Réclamation daily rewards pour ${playerId} sur ${serverId}`);

      // 1. Vérifier que le joueur existe
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return { success: false, error: "PLAYER_NOT_FOUND", code: "PLAYER_NOT_FOUND" }; // "Player not found"
      }

      // 2. Récupérer ou créer les daily rewards
      const dailyRewards = await (DailyRewards as any).getOrCreate(playerId, serverId);

      // 3. Vérifier si peut claim aujourd'hui
      if (!dailyRewards.canClaimToday()) {
        const status = dailyRewards.getClaimStatus();
        return {
          success: false,
          error: "DAILY_REWARD_ALREADY_CLAIMED", // "Daily reward already claimed today"
          code: "ALREADY_CLAIMED_TODAY",
          streakInfo: {
            currentStreak: status.currentStreak,
            streakBonus: status.streakMultiplier,
            streakTier: status.streakTier,
            nextMilestone: this.getNextStreakMilestone(status.currentStreak)
          }
        };
      }

      // 4. Obtenir le niveau VIP du joueur
      const vipLevel = await VipService.getPlayerVipLevel(playerId, serverId);

      // 5. Réclamer les récompenses
      const claim = await dailyRewards.claimDailyReward(vipLevel);

      // 6. Appliquer les récompenses au joueur
      const appliedRewards = await this.applyRewardsToPlayer(player, claim.rewards, serverId);

      // 7. Sauvegarder le joueur
      await player.save();

      // 8. Mettre à jour les missions et événements
      await this.updateProgressTracking(playerId, serverId, claim);

      // 9. Envoyer une notification
      await this.sendClaimNotification(playerId, serverId, claim, dailyRewards.currentStreak);

      // 10. Vérifier les milestones de streak
      await this.checkStreakMilestones(playerId, serverId, dailyRewards.currentStreak);

      console.log(`✅ Daily rewards jour ${claim.day} réclamé pour ${player.displayName} (streak: ${dailyRewards.currentStreak})`);

      return {
        success: true,
        claim,
        appliedRewards,
        streakInfo: {
          currentStreak: dailyRewards.currentStreak,
          streakBonus: claim.streakBonus,
          streakTier: dailyRewards.getClaimStatus().streakTier,
          nextMilestone: this.getNextStreakMilestone(dailyRewards.currentStreak)
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur claimDailyReward:", error);
      return { success: false, error: error.message, code: "CLAIM_FAILED" };
    }
  }

  // ===== OBTENIR LE STATUT DES DAILY REWARDS =====

  /**
   * Obtenir le statut actuel des daily rewards d'un joueur
   */
  public static async getDailyRewardStatus(
    playerId: string,
    serverId: string
  ): Promise<DailyRewardStatusResult> {
    try {
      // 1. Vérifier que le joueur existe
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return { success: false, error: "PLAYER_NOT_FOUND" }; // "Player not found"
      }

      // 2. Récupérer ou créer les daily rewards
      const dailyRewards = await (DailyRewards as any).getOrCreate(playerId, serverId);

      // 3. Obtenir le statut
      const claimStatus = dailyRewards.getClaimStatus();

      // 4. Obtenir la prochaine récompense
      const nextReward = dailyRewards.getNextReward();

      // 5. Calculer la valeur estimée avec VIP
      const vipLevel = await VipService.getPlayerVipLevel(playerId, serverId);
      const vipBonus = 1.0 + (vipLevel * DAILY_REWARDS_CONFIG.vipBonusPerLevel);
      
      const estimatedValue = this.calculateRewardValue(nextReward.rewards) * vipBonus;

      // 6. Info VIP
      const playerInfo = {
        vipLevel,
        vipBonus
      };

      return {
        success: true,
        status: {
          canClaim: claimStatus.canClaim,
          timeUntilNext: claimStatus.timeUntilNext,
          currentDay: dailyRewards.currentDay,
          nextDay: claimStatus.nextDay,
          currentStreak: claimStatus.currentStreak,
          longestStreak: dailyRewards.longestStreak,
          streakTier: claimStatus.streakTier,
          streakMultiplier: claimStatus.streakMultiplier,
          missedToday: claimStatus.missedToday,
          totalClaims: dailyRewards.totalClaims
        },
        nextReward: {
          day: nextReward.day,
          title: nextReward.title,
          isSpecial: nextReward.isSpecial,
          rewards: nextReward.rewards,
          estimatedValue: Math.round(estimatedValue)
        },
        playerInfo
      };

    } catch (error: any) {
      console.error("❌ Erreur getDailyRewardStatus:", error);
      return { success: false, error: error.message };
    }
  }

  // ===== PREVIEW DES PROCHAINES RÉCOMPENSES =====

  /**
   * Obtenir un aperçu des X prochains jours de récompenses
   */
  public static async getRewardsPreview(
    playerId: string,
    serverId: string,
    daysAhead: number = 7
  ): Promise<DailyRewardPreviewResult> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return { success: false, error: "PLAYER_NOT_FOUND" }; // "Player not found"
      }

      const dailyRewards = await (DailyRewards as any).getOrCreate(playerId, serverId);
      const vipLevel = await VipService.getPlayerVipLevel(playerId, serverId);
      const vipBonus = 1.0 + (vipLevel * DAILY_REWARDS_CONFIG.vipBonusPerLevel);

      const preview = [];
      let currentDay = dailyRewards.canClaimToday() ? dailyRewards.currentDay : dailyRewards.currentDay + 1;

      for (let i = 0; i < daysAhead; i++) {
        const day = ((currentDay + i - 1) % DAILY_REWARDS_CONFIG.cycleDays) + 1;
        const dayConfig = getDayConfig(day);
        
        if (dayConfig) {
          const baseRewards = dailyRewards.calculateRewards(day, 0);
          const vipRewards = dailyRewards.calculateRewards(day, vipLevel);
          
          const baseValue = this.calculateRewardValue(baseRewards);
          const vipBonusValue = this.calculateRewardValue(vipRewards);

          preview.push({
            day,
            title: dayConfig.title,
            isSpecial: dayConfig.isSpecial || false,
            rewards: vipRewards,
            baseValue: Math.round(baseValue),
            vipBonusValue: Math.round(vipBonusValue),
            streakBonusValue: dailyRewards.currentStreak >= 7 ? Math.round(vipBonusValue * dailyRewards.getStreakBonus()) : undefined
          });
        }
      }

      return {
        success: true,
        preview
      };

    } catch (error: any) {
      console.error("❌ Erreur getRewardsPreview:", error);
      return { success: false, error: error.message };
    }
  }

  // ===== MÉTHODES UTILITAIRES PRIVÉES =====

  /**
   * Appliquer les récompenses au joueur
   */
  private static async applyRewardsToPlayer(
    player: any,
    rewards: IDailyRewardItem[],
    serverId: string
  ) {
    const appliedRewards = {
      gold: 0,
      gems: 0,
      tickets: 0,
      items: [] as Array<{ itemId: string; quantity: number }>
    };

    for (const reward of rewards) {
      switch (reward.type) {
        case "gold":
          player.gold += reward.quantity;
          appliedRewards.gold += reward.quantity;
          break;

        case "gems":
          player.gems += reward.quantity;
          appliedRewards.gems += reward.quantity;
          break;

        case "tickets":
          player.tickets += reward.quantity;
          appliedRewards.tickets += reward.quantity;
          break;

        case "hero_fragment":
          if (reward.itemId) {
            const current = player.fragments.get(reward.itemId) || 0;
            player.fragments.set(reward.itemId, current + reward.quantity);
            appliedRewards.items.push({ itemId: reward.itemId, quantity: reward.quantity });
          }
          break;

        case "material":
          if (reward.itemId) {
            const current = player.materials.get(reward.itemId) || 0;
            player.materials.set(reward.itemId, current + reward.quantity);
            appliedRewards.items.push({ itemId: reward.itemId, quantity: reward.quantity });
          }
          break;

        case "item":
          if (reward.itemId) {
            // Ajouter via InventoryService
            await InventoryService.addItem(player._id, reward.itemId, reward.quantity, 1, 0, serverId);
            appliedRewards.items.push({ itemId: reward.itemId, quantity: reward.quantity });
          }
          break;
      }
    }

    return appliedRewards;
  }

  /**
   * Calculer la valeur estimée des récompenses
   */
  private static calculateRewardValue(rewards: IDailyRewardItem[]): number {
    let totalValue = 0;

    rewards.forEach(reward => {
      switch (reward.type) {
        case "gold":
          totalValue += reward.quantity * 0.001;
          break;
        case "gems":
          totalValue += reward.quantity * 1;
          break;
        case "tickets":
          totalValue += reward.quantity * 10;
          break;
        case "hero_fragment":
          totalValue += reward.quantity * 2;
          break;
        case "material":
          totalValue += reward.quantity * 5;
          break;
        case "item":
          totalValue += reward.quantity * 50;
          break;
      }
    });

    return totalValue;
  }

  /**
   * Obtenir le prochain milestone de streak
   */
  private static getNextStreakMilestone(currentStreak: number): number | undefined {
    const milestones = [7, 14, 30];
    return milestones.find(m => m > currentStreak);
  }

  /**
   * Envoyer notification de claim
   */
  private static async sendClaimNotification(
    playerId: string,
    serverId: string,
    claim: IDailyRewardClaim,
    currentStreak: number
  ): Promise<void> {
    try {
      // WebSocket notification temps réel
      WebSocketService.sendToPlayer(playerId, 'daily_rewards:claimed', {
        day: claim.day,
        rewards: claim.rewards,
        streakBonus: claim.streakBonus,
        currentStreak,
        totalValue: claim.totalValue
      });

      // Si jour spécial, envoyer aussi par mail
      const dayConfig = getDayConfig(claim.day);
      if (dayConfig?.isSpecial) {
        await MailService.sendToPlayer(playerId, serverId, {
          title: "DAILY_REWARD_SPECIAL_DAY_TITLE", // "🎉 {dayTitle}"
          content: "DAILY_REWARD_SPECIAL_DAY_CONTENT", // "Félicitations ! Vous avez atteint le {dayTitle} !\n\nContinuez votre streak pour encore plus de récompenses !"
          category: "reward",
          senderName: "Daily Rewards System",
          priority: "high",
          expiresInDays: 7
        });
      }

    } catch (error) {
      console.error("⚠️ Erreur notification daily rewards:", error);
    }
  }

  /**
   * Vérifier les milestones de streak et envoyer récompenses bonus
   */
  private static async checkStreakMilestones(
    playerId: string,
    serverId: string,
    currentStreak: number
  ): Promise<void> {
    try {
      const milestones = [7, 14, 30];
      
      if (milestones.includes(currentStreak)) {
        // Envoyer une récompense bonus par mail
        const bonusRewards: any = {
          gold: currentStreak * 1000,
          gems: currentStreak * 10
        };

        await MailService.sendRewardMail(
          playerId,
          serverId,
          bonusRewards,
          "DAILY_REWARD_MILESTONE_REASON", // "{streak} jours de connexion consécutive !"
          "reward"
        );

        // Notification WebSocket
        WebSocketService.sendToPlayer(playerId, 'daily_rewards:milestone', {
          streak: currentStreak,
          milestoneLabel: "DAILY_REWARD_MILESTONE_ACHIEVED", // "{streak} jours"
          bonusRewards
        });

        console.log(`🏆 Milestone ${currentStreak} jours atteint pour ${playerId}`);
      }

    } catch (error) {
      console.error("⚠️ Erreur vérification milestones:", error);
    }
  }

  /**
   * Mettre à jour les missions et événements
   */
  private static async updateProgressTracking(
    playerId: string,
    serverId: string,
    claim: IDailyRewardClaim
  ): Promise<void> {
    try {
      await Promise.all([
        // Mission: comptabiliser comme connexion quotidienne
        MissionService.updateProgress(
          playerId,
          serverId,
          "login", // Type de mission valide
          1,
          { day: claim.day, streak: claim.streakBonus, type: "daily_reward" }
        ),
        // Événement: comptabiliser comme activité de collecte
        EventService.updatePlayerProgress(
          playerId,
          serverId,
          "login_days", // Type d'événement valide
          1,
          { type: "daily_reward", day: claim.day }
        )
      ]);

    } catch (error) {
      console.error("⚠️ Erreur mise à jour progression daily rewards:", error);
    }
  }

  // ===== MÉTHODES D'ADMINISTRATION =====

  /**
   * Reset quotidien automatique (appelé par SchedulerService)
   */
  public static async performDailyReset(): Promise<{
    success: boolean;
    processed: number;
    errors: number;
  }> {
    try {
      console.log("🌅 Début du reset quotidien des Daily Rewards...");

      const allRewards = await DailyRewards.find({});
      let processed = 0;
      let errors = 0;

      for (const reward of allRewards) {
        try {
          // Vérifier si le joueur a raté son claim
          if (reward.lastClaimDate) {
            const now = new Date();
            const lastClaim = new Date(reward.lastClaimDate);
            const diffDays = Math.floor((now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays > 0 && !reward.canClaimToday()) {
              // Joueur a raté un jour
              await this.handleMissedDay(reward.playerId, reward.serverId);
            }
          }

          // Mettre à jour nextResetDate
          const tomorrow = new Date();
          tomorrow.setHours(24, 0, 0, 0);
          reward.nextResetDate = tomorrow;
          await reward.save();

          processed++;

        } catch (error) {
          console.error(`❌ Erreur reset pour ${reward.playerId}:`, error);
          errors++;
        }
      }

      console.log(`✅ Reset quotidien terminé: ${processed} joueurs, ${errors} erreurs`);

      return { success: true, processed, errors };

    } catch (error: any) {
      console.error("❌ Erreur performDailyReset:", error);
      return { success: false, processed: 0, errors: 1 };
    }
  }

  /**
   * Gérer un jour raté
   */
  private static async handleMissedDay(playerId: string, serverId: string): Promise<void> {
    try {
      if (!DAILY_REWARDS_CONFIG.sendMailOnMissed) {
        return;
      }

      // Envoyer un mail de rappel
      await MailService.sendToPlayer(playerId, serverId, {
        title: "DAILY_REWARD_MISSED_TITLE", // "⏰ Vous avez manqué votre récompense quotidienne !"
        content: "DAILY_REWARD_MISSED_CONTENT", // "N'oubliez pas de vous connecter tous les jours pour maintenir votre série et obtenir des bonus !"
        category: "system",
        senderName: "Daily Rewards System",
        priority: "normal",
        expiresInDays: 1
      });

    } catch (error) {
      console.error("⚠️ Erreur handleMissedDay:", error);
    }
  }

  /**
   * Obtenir les statistiques globales
   */
  public static async getGlobalStats(serverId?: string) {
    try {
      const query = serverId ? { serverId } : {};
      
      const stats = await DailyRewards.aggregate([
        { $match: query },
        { $group: {
          _id: null,
          totalPlayers: { $sum: 1 },
          avgStreak: { $avg: "$currentStreak" },
          maxStreak: { $max: "$currentStreak" },
          totalClaims: { $sum: "$totalClaims" },
          totalValue: { $sum: "$totalRewardsValue" },
          activePlayers: {
            $sum: {
              $cond: [
                { $gte: ["$lastClaimDate", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          }
        }}
      ]);

      return {
        success: true,
        stats: stats[0] || {
          totalPlayers: 0,
          avgStreak: 0,
          maxStreak: 0,
          totalClaims: 0,
          totalValue: 0,
          activePlayers: 0
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getGlobalStats:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtenir le leaderboard des streaks
   */
  public static async getStreakLeaderboard(serverId: string, limit: number = 50) {
    try {
      const topStreaks = await (DailyRewards as any).getTopStreaks(serverId, limit);

      // Enrichir avec les noms des joueurs
      const enrichedLeaderboard = await Promise.all(
        topStreaks.map(async (entry: any) => {
          const player = await Player.findById(entry.playerId).select('displayName level');
          return {
            playerId: entry.playerId,
            playerName: player?.displayName || "Unknown",
            playerLevel: player?.level || 1,
            currentStreak: entry.currentStreak,
            longestStreak: entry.longestStreak,
            totalClaims: entry.totalClaims,
            lastClaimDate: entry.lastClaimDate
          };
        })
      );

      return {
        success: true,
        leaderboard: enrichedLeaderboard
      };

    } catch (error: any) {
      console.error("❌ Erreur getStreakLeaderboard:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Nettoyer les joueurs inactifs
   */
  public static async cleanupInactive(daysInactive: number = 90) {
    try {
      const deletedCount = await (DailyRewards as any).cleanupInactive(daysInactive);
      
      return {
        success: true,
        deletedCount,
        message: `${deletedCount} daily rewards inactifs supprimés`
      };

    } catch (error: any) {
      console.error("❌ Erreur cleanupInactive:", error);
      return { success: false, error: error.message };
    }
  }
}

export default DailyRewardsService;

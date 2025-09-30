import VipProgress from "../models/VIP/VipProgress";
import VipConfiguration from "../models/VIP/VipConfiguration";
import VipDailyRewards from "../models/VIP/VipDailyRewards";
import VipPurchaseHistory from "../models/VIP/VipPurchaseHistory";
import Player from "../models/Player";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";

export interface VipPurchaseResult {
  success: boolean;
  vipExpGained?: number;
  newVipLevel?: number;
  leveledUp?: boolean;
  levelUpRewards?: any;
  totalVipExp?: number;
  currentVipLevel?: number;
  playerResources?: {
    gems: number;
    paidGems: number;
    gold: number;
  };
  error?: string;
  code?: string;
}

export interface VipStatusResult {
  success: boolean;
  vipStatus?: {
    currentLevel: number;
    currentTitle: string;
    currentExp: number;
    totalExpRequired: number;
    activeBenefits: any[];
    progressToNext?: {
      nextLevel: number;
      nextTitle: string;
      expRequired: number;
      progressPercent: number;
      nextLevelBenefits: any[];
    };
    dailyRewards?: {
      canClaim: boolean;
      rewards: any;
      claimedToday: boolean;
      timeRemaining?: Date;
    };
  };
  playerResources?: {
    gems: number;
    paidGems: number;
    gold: number;
  };
  error?: string;
}

export interface VipDailyRewardResult {
  success: boolean;
  message?: string;
  rewards?: any;
  streakBonus?: number;
  playerResources?: {
    gold: number;
    gems: number;
    tickets: number;
  };
  code?: string;
}

export class VipService {

  // === ACHETER DE L'EXPÉRIENCE VIP ===
  public static async purchaseVipExp(
    playerId: string,
    serverId: string,
    paidGemsAmount: number
  ): Promise<VipPurchaseResult> {
    try {
      console.log(`💎 Achat VIP EXP: ${paidGemsAmount} gems payantes pour ${playerId}`);

      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      // Vérifier que le joueur a assez de gems payantes
      if (player.paidGems < paidGemsAmount) {
        return { 
          success: false, 
          error: `Insufficient paid gems. Required: ${paidGemsAmount}, Available: ${player.paidGems}`, 
          code: "INSUFFICIENT_PAID_GEMS" 
        };
      }

      // Obtenir ou créer la progression VIP
      const vipProgress = await (VipProgress as any).getOrCreateProgress(playerId, serverId);
      const oldLevel = vipProgress.currentLevel;

      // Déduire les gems payantes
      player.paidGems -= paidGemsAmount;
      await player.save();

      // Ajouter l'expérience VIP (1:1 ratio)
      const transactionId = `vip_purchase_${Date.now()}_${playerId}`;
      const levelResult = await vipProgress.addExp(paidGemsAmount, transactionId);

      // Enregistrer l'achat dans l'historique
      await (VipPurchaseHistory as any).recordPurchase({
        playerId,
        serverId,
        transactionId,
        paidGemsSpent: paidGemsAmount,
        vipExpGained: paidGemsAmount,
        levelBefore: oldLevel,
        levelAfter: levelResult.newLevel,
        purchaseType: "vip_exp"
      });

      // Mettre à jour les missions et événements
      await this.updateProgressTracking(playerId, serverId, paidGemsAmount, levelResult.leveledUp);

      if (levelResult.leveledUp) {
        console.log(`🎉 ${player.displayName} atteint VIP ${levelResult.newLevel}!`);
      }

      return {
        success: true,
        vipExpGained: paidGemsAmount,
        newVipLevel: levelResult.newLevel,
        leveledUp: levelResult.leveledUp,
        totalVipExp: vipProgress.currentExp,
        currentVipLevel: vipProgress.currentLevel,
        playerResources: {
          gems: player.gems,
          paidGems: player.paidGems,
          gold: player.gold
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur purchaseVipExp:", error);
      return { success: false, error: error.message, code: "PURCHASE_FAILED" };
    }
  }

  // === RÉCUPÉRER LE STATUT VIP DU JOUEUR ===
  public static async getPlayerVipStatus(playerId: string, serverId: string): Promise<VipStatusResult> {
    try {
      const [player, vipProgress] = await Promise.all([
        Player.findOne({ _id: playerId, serverId }),
        (VipProgress as any).getOrCreateProgress(playerId, serverId)
      ]);

      if (!player) {
        return { success: false, error: "Player not found" };
      }

      // Récupérer la configuration du niveau actuel
      const currentLevelConfig = await (VipConfiguration as any).getLevel(vipProgress.currentLevel);
      if (!currentLevelConfig) {
        return { success: false, error: "VIP configuration not found" };
      }

      // Récupérer les bénéfices actifs
      const activeBenefits = currentLevelConfig.benefits;

      // Calculer la progression vers le prochain niveau
      let progressToNext = undefined;
      const nextLevelConfig = await (VipConfiguration as any).getNextLevelInfo(vipProgress.currentLevel);
      if (nextLevelConfig) {
        const expRequired = nextLevelConfig.totalExpRequired - vipProgress.currentExp;
        const progressPercent = Math.max(0, Math.min(100, 
          ((vipProgress.currentExp - currentLevelConfig.totalExpRequired) / nextLevelConfig.requiredExp) * 100
        ));

        progressToNext = {
          nextLevel: nextLevelConfig.level,
          nextTitle: nextLevelConfig.title,
          expRequired,
          progressPercent: Math.round(progressPercent),
          nextLevelBenefits: nextLevelConfig.benefits
        };
      }

      // Vérifier les récompenses quotidiennes VIP
      const dailyRewards = await this.checkDailyRewards(playerId, serverId, vipProgress.currentLevel);

      return {
        success: true,
        vipStatus: {
          currentLevel: vipProgress.currentLevel,
          currentTitle: currentLevelConfig.title,
          currentExp: vipProgress.currentExp,
          totalExpRequired: currentLevelConfig.totalExpRequired,
          activeBenefits,
          progressToNext,
          dailyRewards
        },
        playerResources: {
          gems: player.gems,
          paidGems: player.paidGems,
          gold: player.gold
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerVipStatus:", error);
      return { success: false, error: error.message };
    }
  }

  // === RÉCLAMER LES RÉCOMPENSES QUOTIDIENNES VIP ===
  public static async claimVipDailyRewards(
    playerId: string, 
    serverId: string
  ): Promise<VipDailyRewardResult> {
    try {
      console.log(`🎁 Réclamation récompenses VIP quotidiennes pour ${playerId}`);

      const [player, vipProgress] = await Promise.all([
        Player.findOne({ _id: playerId, serverId }),
        (VipProgress as any).getOrCreateProgress(playerId, serverId)
      ]);

      if (!player) {
        return { success: false, message: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      if (vipProgress.currentLevel === 0) {
        return { success: false, message: "VIP level 0 has no daily rewards", code: "NO_VIP_REWARDS" };
      }

      // Générer ou récupérer les récompenses du jour
      const today = new Date().toISOString().split('T')[0];
      const dailyReward = await (VipDailyRewards as any).generateDailyRewards(
        playerId, 
        serverId, 
        vipProgress.currentLevel, 
        today
      );

      if (dailyReward.isClaimed) {
        return { 
          success: false, 
          message: "Daily VIP rewards already claimed", 
          code: "ALREADY_CLAIMED" 
        };
      }

      // Réclamer les récompenses
      const claimResult = await dailyReward.claim({
        platform: "web", // TODO: Détecter la vraie plateforme
        deviceId: null,
        ipAddress: null
      });

      // Appliquer les récompenses au joueur
      for (const reward of claimResult.rewards) {
        await this.applyRewardToPlayer(player, reward);
      }

      await player.save();

      console.log(`✅ Récompenses VIP ${vipProgress.currentLevel} réclamées pour ${player.displayName}`);

      return {
        success: true,
        message: "VIP daily rewards claimed successfully",
        rewards: claimResult.rewards,
        streakBonus: claimResult.streakBonus,
        playerResources: {
          gold: player.gold,
          gems: player.gems,
          tickets: player.tickets
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur claimVipDailyRewards:", error);
      return { success: false, message: error.message, code: "CLAIM_FAILED" };
    }
  }

  // === MÉTHODES UTILITAIRES POUR D'AUTRES SERVICES ===

  // Obtenir le niveau VIP d'un joueur
  public static async getPlayerVipLevel(playerId: string, serverId: string): Promise<number> {
    try {
      // 🔥 FIX: Chercher d'abord dans Player.vipLevel
      const player = await Player.findOne({ _id: playerId, serverId }).select('vipLevel');
      if (player && typeof player.vipLevel === 'number') {
        return player.vipLevel;
      }
      
      // Fallback: chercher dans VipProgress si pas dans Player
      const vipProgress = await VipProgress.findOne({ playerId, serverId });
      return vipProgress ? vipProgress.currentLevel : 0;
    } catch (error) {
      console.error("❌ Erreur getPlayerVipLevel:", error);
      return 0;
    }
  }

  // Vérifier si un joueur a un bénéfice spécifique
  public static async hasVipBenefit(playerId: string, serverId: string, benefitType: string): Promise<boolean> {
    try {
      const vipLevel = await this.getPlayerVipLevel(playerId, serverId);
      const config = await (VipConfiguration as any).getLevel(vipLevel);
      return config ? config.hasBenefit(benefitType) : false;
    } catch (error) {
      console.error("❌ Erreur hasVipBenefit:", error);
      return false;
    }
  }

  // Obtenir la valeur d'un bénéfice VIP
  public static async getVipBenefitValue(
    playerId: string, 
    serverId: string, 
    benefitType: string
  ): Promise<number | boolean | string | null> {
    try {
      const vipLevel = await this.getPlayerVipLevel(playerId, serverId);
      const config = await (VipConfiguration as any).getLevel(vipLevel);
      return config ? config.getBenefitValue(benefitType) : null;
    } catch (error) {
      console.error("❌ Erreur getVipBenefitValue:", error);
      return null;
    }
  }

  // Calculer le bonus AFK pour un joueur
  public static async getAfkRewardsMultiplier(playerId: string, serverId: string): Promise<number> {
    const multiplier = await this.getVipBenefitValue(playerId, serverId, "afk_rewards");
    return typeof multiplier === "number" ? multiplier : 1.0;
  }

  // Calculer le prix avec remise VIP
  public static async calculateVipPrice(
    playerId: string, 
    serverId: string, 
    originalPrice: number
  ): Promise<number> {
    const discount = await this.getVipBenefitValue(playerId, serverId, "shop_discount");
    if (typeof discount === "number" && discount > 0) {
      const discountAmount = Math.floor(originalPrice * discount / 100);
      return Math.max(1, originalPrice - discountAmount);
    }
    return originalPrice;
  }

  // Obtenir la vitesse de combat maximum
  public static async getMaxBattleSpeed(playerId: string, serverId: string): Promise<number> {
    const speed = await this.getVipBenefitValue(playerId, serverId, "battle_speed");
    return typeof speed === "number" ? speed : 1;
  }

  // === MÉTHODES D'ADMINISTRATION ===

  // Donner de l'EXP VIP gratuitement (admin)
  public static async grantVipExp(
    playerId: string,
    serverId: string,
    expAmount: number,
    reason: string = "Admin Grant"
  ) {
    try {
      const vipProgress = await (VipProgress as any).getOrCreateProgress(playerId, serverId);
      const oldLevel = vipProgress.currentLevel;

      const transactionId = `admin_grant_${Date.now()}_${playerId}`;
      const result = await vipProgress.addExp(expAmount, transactionId);

      // Enregistrer dans l'historique
      await (VipPurchaseHistory as any).recordPurchase({
        playerId,
        serverId,
        transactionId,
        paidGemsSpent: 0,
        vipExpGained: expAmount,
        levelBefore: oldLevel,
        levelAfter: result.newLevel,
        purchaseType: "admin_grant",
        notes: reason
      });

      console.log(`👑 ${expAmount} VIP EXP accordé à ${playerId} (${reason})`);

      return {
        success: true,
        message: "VIP EXP granted successfully",
        expGained: expAmount,
        oldLevel,
        newLevel: result.newLevel,
        leveledUp: result.leveledUp
      };

    } catch (error: any) {
      console.error("❌ Erreur grantVipExp:", error);
      throw error;
    }
  }

  // Obtenir les statistiques VIP du serveur
  public static async getServerVipStats(serverId: string) {
    try {
      const [progressStats, rewardStats, purchaseStats] = await Promise.all([
        (VipProgress as any).getServerStats(serverId),
        (VipDailyRewards as any).getServerClaimStats(serverId),
        (VipPurchaseHistory as any).getServerStats(serverId)
      ]);

      return {
        success: true,
        serverId,
        stats: {
          progression: progressStats,
          dailyRewards: rewardStats,
          purchases: purchaseStats
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getServerVipStats:", error);
      throw error;
    }
  }

  // === MÉTHODES PRIVÉES ===

  // Vérifier les récompenses quotidiennes
  private static async checkDailyRewards(playerId: string, serverId: string, vipLevel: number) {
    if (vipLevel === 0) {
      return {
        canClaim: false,
        rewards: {},
        claimedToday: true
      };
    }

    const today = new Date().toISOString().split('T')[0];
    const dailyReward = await VipDailyRewards.findOne({ 
      playerId, 
      serverId, 
      rewardDate: today 
    });

    if (!dailyReward) {
      // Générer les récompenses du jour
      const newReward = await (VipDailyRewards as any).generateDailyRewards(playerId, serverId, vipLevel, today);
      return {
        canClaim: true,
        rewards: newReward.rewards,
        claimedToday: false
      };
    }

    return {
      canClaim: !dailyReward.isClaimed,
      rewards: dailyReward.rewards,
      claimedToday: dailyReward.isClaimed,
      timeRemaining: dailyReward.isExpired() ? undefined : new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  // Appliquer une récompense au joueur
  private static async applyRewardToPlayer(player: any, reward: any) {
    switch (reward.type) {
      case "currency":
        switch (reward.currencyType) {
          case "gold":
            player.gold += reward.quantity;
            break;
          case "gems":
            player.gems += reward.quantity;
            break;
          case "tickets":
            player.tickets += reward.quantity;
            break;
        }
        break;

      case "material":
        if (reward.materialId) {
          const current = player.materials.get(reward.materialId) || 0;
          player.materials.set(reward.materialId, current + reward.quantity);
        }
        break;

      case "hero":
        if (reward.heroId) {
          // TODO: Logique d'ajout de héros
          console.log(`🦸 Héros VIP reçu: ${reward.heroId}`);
        }
        break;

      case "item":
        if (reward.itemId) {
          // TODO: Logique d'ajout d'objet via InventoryService
          console.log(`📦 Objet VIP reçu: ${reward.itemId}`);
        }
        break;
    }
  }

  // Mettre à jour les missions et événements
  private static async updateProgressTracking(
    playerId: string,
    serverId: string,
    vipExpGained: number,
    leveledUp: boolean
  ) {
    try {
      await Promise.all([
        MissionService.updateProgress(
          playerId,
          serverId,
          "gold_spent",
          vipExpGained,
          { type: "vip_purchase", leveledUp }
        ),
        EventService.updatePlayerProgress(
          playerId,
          serverId,
          "gold_spent",
          vipExpGained,
          { 
            itemType: "vip_experience",
            leveledUp,
            vipExpGained
          }
        )
      ]);

      console.log(`📊 Progression VIP mise à jour: ${vipExpGained} EXP, level up: ${leveledUp}`);
    } catch (error) {
      console.error("⚠️ Erreur mise à jour progression VIP:", error);
    }
  }
}

export default VipService;

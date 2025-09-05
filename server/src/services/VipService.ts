import Player from "../models/Player";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";

export interface VipBenefit {
  type: "battle_speed" | "daily_rewards" | "shop_discount" | "max_stamina" | "stamina_regen" | 
        "afk_rewards" | "fast_rewards" | "hero_slots" | "formation_slots" | "auto_battle" |
        "skip_battle" | "vip_shop" | "exclusive_summons" | "bonus_exp" | "bonus_gold" |
        "chat_privileges" | "daily_dungeon" | "weekly_dungeon";
  value: number | boolean | string;
  description: string;
}

export interface VipLevel {
  level: number;
  requiredExp: number;
  totalExpRequired: number;
  benefits: VipBenefit[];
  title: string;
  iconUrl?: string;
  unlockRewards?: {
    gold?: number;
    gems?: number;
    heroes?: string[];
    materials?: Record<string, number>;
  };
}

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

export interface VipDailyRewards {
  canClaim: boolean;
  rewards: {
    gold: number;
    gems: number;
    tickets: number;
    materials: Record<string, number>;
  };
  claimedToday: boolean;
  nextClaimTime?: Date;
}

export class VipService {
  
  // Configuration des niveaux VIP (inspiré AFK Arena)
  private static readonly VIP_LEVELS: VipLevel[] = [
    {
      level: 0,
      requiredExp: 0,
      totalExpRequired: 0,
      title: "Adventurer",
      benefits: [
        { type: "battle_speed", value: 1, description: "Normal battle speed" },
        { type: "daily_rewards", value: true, description: "Basic daily rewards" }
      ]
    },
    {
      level: 1,
      requiredExp: 100,
      totalExpRequired: 100,
      title: "Supporter",
      benefits: [
        { type: "battle_speed", value: 2, description: "2x battle speed unlocked" },
        { type: "daily_rewards", value: true, description: "VIP daily rewards" },
        { type: "shop_discount", value: 5, description: "5% shop discount" }
      ],
      unlockRewards: { gold: 5000, gems: 100 }
    },
    {
      level: 2,
      requiredExp: 200,
      totalExpRequired: 300,
      title: "Patron",
      benefits: [
        { type: "battle_speed", value: 2, description: "2x battle speed" },
        { type: "max_stamina", value: 120, description: "+20 max stamina" },
        { type: "shop_discount", value: 8, description: "8% shop discount" },
        { type: "afk_rewards", value: 1.1, description: "10% bonus AFK rewards" }
      ],
      unlockRewards: { gold: 10000, gems: 200 }
    },
    {
      level: 3,
      requiredExp: 300,
      totalExpRequired: 600,
      title: "Benefactor",
      benefits: [
        { type: "battle_speed", value: 2, description: "2x battle speed" },
        { type: "max_stamina", value: 140, description: "+40 max stamina" },
        { type: "shop_discount", value: 10, description: "10% shop discount" },
        { type: "afk_rewards", value: 1.15, description: "15% bonus AFK rewards" },
        { type: "fast_rewards", value: 2, description: "2h fast rewards unlocked" }
      ],
      unlockRewards: { gold: 20000, gems: 300 }
    },
    {
      level: 4,
      requiredExp: 500,
      totalExpRequired: 1100,
      title: "Sponsor",
      benefits: [
        { type: "battle_speed", value: 2, description: "2x battle speed" },
        { type: "max_stamina", value: 160, description: "+60 max stamina" },
        { type: "shop_discount", value: 12, description: "12% shop discount" },
        { type: "afk_rewards", value: 1.2, description: "20% bonus AFK rewards" },
        { type: "fast_rewards", value: 4, description: "4h fast rewards" },
        { type: "hero_slots", value: 220, description: "+20 hero inventory slots" }
      ],
      unlockRewards: { gold: 35000, gems: 500 }
    },
    {
      level: 5,
      requiredExp: 700,
      totalExpRequired: 1800,
      title: "Guardian",
      benefits: [
        { type: "battle_speed", value: 3, description: "3x battle speed unlocked" },
        { type: "max_stamina", value: 180, description: "+80 max stamina" },
        { type: "shop_discount", value: 15, description: "15% shop discount" },
        { type: "afk_rewards", value: 1.25, description: "25% bonus AFK rewards" },
        { type: "fast_rewards", value: 8, description: "8h fast rewards" },
        { type: "hero_slots", value: 240, description: "+40 hero inventory slots" },
        { type: "auto_battle", value: true, description: "Auto-battle in campaign" }
      ],
      unlockRewards: { gold: 50000, gems: 800, heroes: ["epic_hero_selector"] }
    },
    {
      level: 6,
      requiredExp: 1000,
      totalExpRequired: 2800,
      title: "Elite Patron",
      benefits: [
        { type: "battle_speed", value: 3, description: "3x battle speed" },
        { type: "max_stamina", value: 200, description: "+100 max stamina" },
        { type: "shop_discount", value: 18, description: "18% shop discount" },
        { type: "afk_rewards", value: 1.3, description: "30% bonus AFK rewards" },
        { type: "fast_rewards", value: 12, description: "12h fast rewards" },
        { type: "hero_slots", value: 260, description: "+60 hero inventory slots" },
        { type: "auto_battle", value: true, description: "Auto-battle enabled" },
        { type: "skip_battle", value: true, description: "Skip battle animation" }
      ],
      unlockRewards: { gold: 75000, gems: 1200 }
    },
    {
      level: 7,
      requiredExp: 1300,
      totalExpRequired: 4100,
      title: "Royal Supporter",
      benefits: [
        { type: "battle_speed", value: 3, description: "3x battle speed" },
        { type: "max_stamina", value: 220, description: "+120 max stamina" },
        { type: "shop_discount", value: 20, description: "20% shop discount" },
        { type: "afk_rewards", value: 1.35, description: "35% bonus AFK rewards" },
        { type: "fast_rewards", value: 24, description: "24h fast rewards" },
        { type: "hero_slots", value: 280, description: "+80 hero inventory slots" },
        { type: "vip_shop", value: true, description: "VIP exclusive shop access" },
        { type: "formation_slots", value: 5, description: "5 formation presets" }
      ],
      unlockRewards: { gold: 100000, gems: 1500 }
    },
    {
      level: 8,
      requiredExp: 1700,
      totalExpRequired: 5800,
      title: "Noble",
      benefits: [
        { type: "battle_speed", value: 3, description: "3x battle speed" },
        { type: "max_stamina", value: 250, description: "+150 max stamina" },
        { type: "shop_discount", value: 22, description: "22% shop discount" },
        { type: "afk_rewards", value: 1.4, description: "40% bonus AFK rewards" },
        { type: "fast_rewards", value: 24, description: "24h fast rewards" },
        { type: "hero_slots", value: 300, description: "+100 hero inventory slots" },
        { type: "vip_shop", value: true, description: "VIP shop access" },
        { type: "exclusive_summons", value: true, description: "VIP summon banners" },
        { type: "bonus_exp", value: 1.2, description: "20% bonus hero EXP" }
      ],
      unlockRewards: { gold: 150000, gems: 2000, heroes: ["legendary_hero_selector"] }
    },
    {
      level: 9,
      requiredExp: 2200,
      totalExpRequired: 8000,
      title: "Lord",
      benefits: [
        { type: "battle_speed", value: 3, description: "3x battle speed" },
        { type: "max_stamina", value: 280, description: "+180 max stamina" },
        { type: "shop_discount", value: 25, description: "25% shop discount" },
        { type: "afk_rewards", value: 1.45, description: "45% bonus AFK rewards" },
        { type: "fast_rewards", value: 24, description: "24h fast rewards" },
        { type: "hero_slots", value: 350, description: "+150 hero inventory slots" },
        { type: "bonus_gold", value: 1.25, description: "25% bonus gold from all sources" },
        { type: "daily_dungeon", value: 2, description: "Extra daily dungeon attempts" }
      ],
      unlockRewards: { gold: 200000, gems: 2500 }
    },
    {
      level: 10,
      requiredExp: 3000,
      totalExpRequired: 11000,
      title: "Duke",
      benefits: [
        { type: "battle_speed", value: 3, description: "3x battle speed" },
        { type: "max_stamina", value: 300, description: "+200 max stamina" },
        { type: "shop_discount", value: 28, description: "28% shop discount" },
        { type: "afk_rewards", value: 1.5, description: "50% bonus AFK rewards" },
        { type: "fast_rewards", value: 24, description: "24h fast rewards" },
        { type: "hero_slots", value: 400, description: "+200 hero inventory slots" },
        { type: "bonus_gold", value: 1.3, description: "30% bonus gold" },
        { type: "bonus_exp", value: 1.3, description: "30% bonus hero EXP" },
        { type: "weekly_dungeon", value: 1, description: "Weekly exclusive dungeon access" }
      ],
      unlockRewards: { gold: 300000, gems: 3000, heroes: ["ascended_hero_selector"] }
    },
    {
      level: 11,
      requiredExp: 4000,
      totalExpRequired: 15000,
      title: "Archduke",
      benefits: [
        { type: "battle_speed", value: 3, description: "3x battle speed" },
        { type: "max_stamina", value: 350, description: "+250 max stamina" },
        { type: "shop_discount", value: 30, description: "30% shop discount" },
        { type: "afk_rewards", value: 1.6, description: "60% bonus AFK rewards" },
        { type: "bonus_gold", value: 1.4, description: "40% bonus gold" },
        { type: "bonus_exp", value: 1.4, description: "40% bonus hero EXP" },
        { type: "chat_privileges", value: true, description: "VIP chat privileges & emotes" }
      ],
      unlockRewards: { gold: 500000, gems: 4000 }
    },
    {
      level: 12,
      requiredExp: 5500,
      totalExpRequired: 20500,
      title: "Prince",
      benefits: [
        { type: "battle_speed", value: 3, description: "3x battle speed" },
        { type: "max_stamina", value: 400, description: "+300 max stamina" },
        { type: "shop_discount", value: 35, description: "35% shop discount" },
        { type: "afk_rewards", value: 1.7, description: "70% bonus AFK rewards" },
        { type: "bonus_gold", value: 1.5, description: "50% bonus gold" },
        { type: "bonus_exp", value: 1.5, description: "50% bonus hero EXP" }
      ],
      unlockRewards: { gold: 750000, gems: 5000 }
    },
    {
      level: 13,
      requiredExp: 7500,
      totalExpRequired: 28000,
      title: "King",
      benefits: [
        { type: "battle_speed", value: 3, description: "3x battle speed" },
        { type: "max_stamina", value: 450, description: "+350 max stamina" },
        { type: "shop_discount", value: 40, description: "40% shop discount" },
        { type: "afk_rewards", value: 1.8, description: "80% bonus AFK rewards" },
        { type: "bonus_gold", value: 1.6, description: "60% bonus gold" },
        { type: "bonus_exp", value: 1.6, description: "60% bonus hero EXP" }
      ],
      unlockRewards: { gold: 1000000, gems: 6000 }
    },
    {
      level: 14,
      requiredExp: 10000,
      totalExpRequired: 38000,
      title: "Emperor",
      benefits: [
        { type: "battle_speed", value: 3, description: "3x battle speed" },
        { type: "max_stamina", value: 500, description: "+400 max stamina" },
        { type: "shop_discount", value: 45, description: "45% shop discount" },
        { type: "afk_rewards", value: 2.0, description: "100% bonus AFK rewards" },
        { type: "bonus_gold", value: 1.8, description: "80% bonus gold" },
        { type: "bonus_exp", value: 1.8, description: "80% bonus hero EXP" }
      ],
      unlockRewards: { gold: 1500000, gems: 8000, heroes: ["mythic_hero_selector"] }
    },
    {
      level: 15,
      requiredExp: 15000,
      totalExpRequired: 53000,
      title: "Divine Ruler",
      benefits: [
        { type: "battle_speed", value: 3, description: "3x battle speed" },
        { type: "max_stamina", value: 600, description: "+500 max stamina" },
        { type: "shop_discount", value: 50, description: "50% shop discount" },
        { type: "afk_rewards", value: 2.5, description: "150% bonus AFK rewards" },
        { type: "bonus_gold", value: 2.0, description: "100% bonus gold" },
        { type: "bonus_exp", value: 2.0, description: "100% bonus hero EXP" }
      ],
      unlockRewards: { gold: 2000000, gems: 10000, heroes: ["divine_hero_selector"] }
    }
  ];

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

      // Calculer l'EXP VIP gagné (1:1 ratio avec paid gems)
      const vipExpGained = paidGemsAmount;
      const oldVipLevel = player.vipLevel;
      const oldVipExp = player.vipExperience;

      // Déduire les gems payantes et ajouter l'EXP VIP
      player.paidGems -= paidGemsAmount;
      player.vipExperience += vipExpGained;

      // Calculer le nouveau niveau VIP
      const newVipLevel = this.calculateVipLevel(player.vipExperience);
      const leveledUp = newVipLevel > oldVipLevel;

      let levelUpRewards = null;
      if (leveledUp) {
        player.vipLevel = newVipLevel;
        
        // Appliquer les récompenses de niveau VIP
        levelUpRewards = await this.applyVipLevelUpRewards(player, oldVipLevel, newVipLevel);
        
        console.log(`🎉 ${player.username} atteint VIP ${newVipLevel}!`);
      }

      await player.save();

      // Mettre à jour les missions et événements
      await this.updateProgressTracking(playerId, serverId, vipExpGained, leveledUp);

      return {
        success: true,
        vipExpGained,
        newVipLevel: player.vipLevel,
        leveledUp,
        levelUpRewards,
        totalVipExp: player.vipExperience,
        currentVipLevel: player.vipLevel,
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
  public static async getPlayerVipStatus(playerId: string, serverId: string) {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const currentVipLevel = player.vipLevel;
      const currentVipExp = player.vipExperience;
      const currentLevelConfig = this.VIP_LEVELS[currentVipLevel];
      const nextLevelConfig = this.VIP_LEVELS[currentVipLevel + 1];

      // Calculer la progression vers le prochain niveau
      let progressToNext = null;
      if (nextLevelConfig) {
        const expForNext = nextLevelConfig.totalExpRequired - currentVipExp;
        const progressPercent = Math.max(0, Math.min(100, 
          ((currentVipExp - currentLevelConfig.totalExpRequired) / nextLevelConfig.requiredExp) * 100
        ));

        progressToNext = {
          nextLevel: nextLevelConfig.level,
          nextTitle: nextLevelConfig.title,
          expRequired: expForNext,
          progressPercent: Math.round(progressPercent),
          nextLevelBenefits: nextLevelConfig.benefits,
          nextLevelRewards: nextLevelConfig.unlockRewards
        };
      }

      // Calculer les bénéfices actifs
      const activeBenefits = this.getActiveBenefits(currentVipLevel);

      // Vérifier les récompenses quotidiennes VIP
      const dailyRewards = await this.getVipDailyRewards(player);

      return {
        success: true,
        vipStatus: {
          currentLevel: currentVipLevel,
          currentTitle: currentLevelConfig.title,
          currentExp: currentVipExp,
          totalExpRequired: currentLevelConfig.totalExpRequired,
          activeBenefits,
          progressToNext,
          dailyRewards,
          iconUrl: currentLevelConfig.iconUrl
        },
        playerResources: {
          gems: player.gems,
          paidGems: player.paidGems,
          gold: player.gold
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerVipStatus:", error);
      throw error;
    }
  }

  // === RÉCLAMER LES RÉCOMPENSES QUOTIDIENNES VIP ===
  public static async claimVipDailyRewards(playerId: string, serverId: string) {
    try {
      console.log(`🎁 Réclamation récompenses VIP quotidiennes pour ${playerId}`);

      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const dailyRewards = await this.getVipDailyRewards(player);
      if (!dailyRewards.canClaim) {
        return {
          success: false,
          message: "Daily VIP rewards already claimed or not available",
          code: "ALREADY_CLAIMED"
        };
      }

      // Appliquer les récompenses
      player.gold += dailyRewards.rewards.gold;
      player.gems += dailyRewards.rewards.gems;
      player.tickets += dailyRewards.rewards.tickets;

      // Ajouter les matériaux
      Object.entries(dailyRewards.rewards.materials).forEach(([materialId, quantity]) => {
        const current = player.materials.get(materialId) || 0;
        player.materials.set(materialId, current + quantity);
      });

      // Marquer comme réclamé aujourd'hui (ici on devrait utiliser un système de suivi)
      // Pour simplifier, on utilise lastSeenAt comme référence
      player.lastSeenAt = new Date();
      await player.save();

      console.log(`✅ Récompenses VIP ${player.vipLevel} réclamées pour ${player.username}`);

      return {
        success: true,
        message: "VIP daily rewards claimed successfully",
        rewards: dailyRewards.rewards,
        playerResources: {
          gold: player.gold,
          gems: player.gems,
          tickets: player.tickets
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur claimVipDailyRewards:", error);
      throw error;
    }
  }

  // === OBTENIR LES BÉNÉFICES POUR UN NIVEAU VIP ===
  public static getVipBenefits(vipLevel: number): VipBenefit[] {
    if (vipLevel < 0 || vipLevel >= this.VIP_LEVELS.length) {
      return this.VIP_LEVELS[0].benefits;
    }
    return this.VIP_LEVELS[vipLevel].benefits;
  }

  // === VÉRIFIER SI UN JOUEUR A UN BÉNÉFICE SPÉCIFIQUE ===
  public static hasVipBenefit(vipLevel: number, benefitType: string): boolean {
    const benefits = this.getVipBenefits(vipLevel);
    return benefits.some(benefit => benefit.type === benefitType);
  }

  // === OBTENIR LA VALEUR D'UN BÉNÉFICE SPÉCIFIQUE ===
  public static getVipBenefitValue(vipLevel: number, benefitType: string): number | boolean | string | null {
    const benefits = this.getVipBenefits(vipLevel);
    const benefit = benefits.find(b => b.type === benefitType);
    return benefit ? benefit.value : null;
  }

  // === OBTENIR LA RÉDUCTION BOUTIQUE VIP ===
  public static getShopDiscount(vipLevel: number): number {
    const discountValue = this.getVipBenefitValue(vipLevel, "shop_discount");
    return typeof discountValue === "number" ? discountValue : 0;
  }

  // === OBTENIR LE MULTIPLICATEUR AFK ===
  public static getAfkRewardsMultiplier(vipLevel: number): number {
    const multiplier = this.getVipBenefitValue(vipLevel, "afk_rewards");
    return typeof multiplier === "number" ? multiplier : 1.0;
  }

  // === OBTENIR LA VITESSE DE COMBAT MAXIMUM ===
  public static getMaxBattleSpeed(vipLevel: number): number {
    const speed = this.getVipBenefitValue(vipLevel, "battle_speed");
    return typeof speed === "number" ? speed : 1;
  }

  // === OBTENIR TOUTES LES INFORMATIONS VIP ===
  public static getAllVipLevels() {
    return {
      success: true,
      vipLevels: this.VIP_LEVELS.map(level => ({
        level: level.level,
        title: level.title,
        requiredExp: level.requiredExp,
        totalExpRequired: level.totalExpRequired,
        benefits: level.benefits,
        unlockRewards: level.unlockRewards,
        iconUrl: level.iconUrl
      })),
      vipSystem: {
        maxLevel: this.VIP_LEVELS.length - 1,
        expSource: "Paid Gems (1:1 ratio)",
        resetFrequency: "Never (permanent)",
        dailyRewardsClaim: "Once per day"
      }
    };
  }

  // === CALCULER LES STATISTIQUES VIP DU SERVEUR ===
  public static async getServerVipStats(serverId: string) {
    try {
      const stats = await Player.aggregate([
        { $match: { serverId } },
        { $group: {
          _id: "$vipLevel",
          playerCount: { $sum: 1 },
          avgVipExp: { $avg: "$vipExperience" },
          totalVipExp: { $sum: "$vipExperience" }
        }},
        { $sort: { _id: 1 } }
      ]);

      const totalPlayers = stats.reduce((sum, stat) => sum + stat.playerCount, 0);
      const totalVipExpSpent = stats.reduce((sum, stat) => sum + stat.totalVipExp, 0);

      return {
        success: true,
        serverId,
        stats: {
          totalPlayers,
          totalVipExpSpent,
          averageVipLevel: totalPlayers > 0 ? stats.reduce((sum, stat) => sum + (stat._id * stat.playerCount), 0) / totalPlayers : 0,
          vipDistribution: stats.map(stat => ({
            vipLevel: stat._id,
            playerCount: stat.playerCount,
            percentage: Math.round((stat.playerCount / totalPlayers) * 100),
            title: this.VIP_LEVELS[stat._id]?.title || "Unknown"
          })),
          topVipLevel: Math.max(...stats.map(s => s._id))
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getServerVipStats:", error);
      throw error;
    }
  }

  // === MÉTHODES PRIVÉES ===

  // Calculer le niveau VIP basé sur l'expérience
  private static calculateVipLevel(vipExperience: number): number {
    for (let i = this.VIP_LEVELS.length - 1; i >= 0; i--) {
      if (vipExperience >= this.VIP_LEVELS[i].totalExpRequired) {
        return i;
      }
    }
    return 0;
  }

  // Obtenir les bénéfices actifs pour un niveau
  private static getActiveBenefits(vipLevel: number): VipBenefit[] {
    if (vipLevel < 0 || vipLevel >= this.VIP_LEVELS.length) {
      return [];
    }
    return this.VIP_LEVELS[vipLevel].benefits;
  }

  // Appliquer les récompenses de niveau VIP
  private static async applyVipLevelUpRewards(player: any, oldLevel: number, newLevel: number) {
    const totalRewards = {
      gold: 0,
      gems: 0,
      heroes: [] as string[],
      materials: {} as Record<string, number>
    };

    // Appliquer les récompenses de tous les niveaux manqués
    for (let level = oldLevel + 1; level <= newLevel; level++) {
      const levelConfig = this.VIP_LEVELS[level];
      if (levelConfig?.unlockRewards) {
        const rewards = levelConfig.unlockRewards;
        
        if (rewards.gold) {
          player.gold += rewards.gold;
          totalRewards.gold += rewards.gold;
        }
        
        if (rewards.gems) {
          player.gems += rewards.gems;
          totalRewards.gems += rewards.gems;
        }
        
        if (rewards.heroes) {
          totalRewards.heroes.push(...rewards.heroes);
        }
        
        if (rewards.materials) {
          Object.entries(rewards.materials).forEach(([materialId, quantity]) => {
            const current = player.materials.get(materialId) || 0;
            player.materials.set(materialId, current + quantity);
            totalRewards.materials[materialId] = (totalRewards.materials[materialId] || 0) + quantity;
          });
        }
      }
    }

    return totalRewards;
  }

  // Obtenir les récompenses quotidiennes VIP
  private static async getVipDailyRewards(player: any): Promise<VipDailyRewards> {
    const vipLevel = player.vipLevel;
    
    if (vipLevel === 0) {
      return {
        canClaim: false,
        rewards: { gold: 0, gems: 0, tickets: 0, materials: {} },
        claimedToday: true
      };
    }

    // Calculer les récompenses basées sur le niveau VIP
    const baseRewards = {
      gold: 1000 + (vipLevel * 500),
      gems: 10 + (vipLevel * 5),
      tickets: Math.floor(vipLevel / 2),
      materials: this.getVipDailyMaterials(vipLevel)
    };

    // Vérifier si déjà réclamé aujourd'hui (simplifié avec lastSeenAt)
    const today = new Date();
    const lastSeen = player.lastSeenAt || new Date(0);
    const sameDay = today.toDateString() === lastSeen.toDateString();

    return {
      canClaim: !sameDay,
      rewards: baseRewards,
      claimedToday: sameDay,
      nextClaimTime: sameDay ? new Date(today.getTime() + 24 * 60 * 60 * 1000) : undefined
    };
  }

  // Obtenir les matériaux quotidiens VIP
  private static getVipDailyMaterials(vipLevel: number): Record<string, number> {
    const materials: Record<string, number> = {};
    
    if (vipLevel >= 2) materials["fusion_crystal"] = 5 + vipLevel;
    if (vipLevel >= 4) materials["elemental_essence"] = 2 + Math.floor(vipLevel / 2);
    if (vipLevel >= 6) materials["ascension_stone"] = 1 + Math.floor(vipLevel / 3);
    if (vipLevel >= 8) materials["divine_crystal"] = Math.floor(vipLevel / 4);
    if (vipLevel >= 10) materials["stellar_essence"] = Math.floor(vipLevel / 5);
    if (vipLevel >= 12) materials["cosmic_shard"] = Math.floor(vipLevel / 6);
    
    return materials;
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
          vipExpGained, // Les gems payantes comptent comme "dépense"
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

  // === MÉTHODES D'ASSISTANCE POUR D'AUTRES SERVICES ===

  // Calculer le bonus AFK pour un joueur
  public static calculateAfkBonus(baseReward: number, vipLevel: number): number {
    const multiplier = this.getAfkRewardsMultiplier(vipLevel);
    return Math.floor(baseReward * multiplier);
  }

  // Calculer le prix avec remise VIP
  public static calculateVipPrice(originalPrice: number, vipLevel: number): number {
    const discount = this.getShopDiscount(vipLevel);
    const discountAmount = Math.floor(originalPrice * discount / 100);
    return Math.max(1, originalPrice - discountAmount);
  }

  // Vérifier l'accès à une fonctionnalité VIP
  public static hasVipAccess(vipLevel: number, requiredLevel: number): boolean {
    return vipLevel >= requiredLevel;
  }

  // Obtenir le multiplicateur d'expérience VIP
  public static getExpMultiplier(vipLevel: number): number {
    const multiplier = this.getVipBenefitValue(vipLevel, "bonus_exp");
    return typeof multiplier === "number" ? multiplier : 1.0;
  }

  // Obtenir le multiplicateur d'or VIP
  public static getGoldMultiplier(vipLevel: number): number {
    const multiplier = this.getVipBenefitValue(vipLevel, "bonus_gold");
    return typeof multiplier === "number" ? multiplier : 1.0;
  }

  // Obtenir la stamina maximum VIP
  public static getMaxStamina(vipLevel: number, baseStamina: number = 100): number {
    const maxStamina = this.getVipBenefitValue(vipLevel, "max_stamina");
    return typeof maxStamina === "number" ? maxStamina : baseStamina;
  }

  // Obtenir les heures de fast rewards
  public static getFastRewardHours(vipLevel: number): number {
    const hours = this.getVipBenefitValue(vipLevel, "fast_rewards");
    return typeof hours === "number" ? hours : 0;
  }

  // Vérifier l'accès à l'auto-battle
  public static hasAutoBattle(vipLevel: number): boolean {
    return this.hasVipBenefit(vipLevel, "auto_battle");
  }

  // Vérifier l'accès au skip battle
  public static hasSkipBattle(vipLevel: number): boolean {
    return this.hasVipBenefit(vipLevel, "skip_battle");
  }

  // Vérifier l'accès à la boutique VIP
  public static hasVipShopAccess(vipLevel: number): boolean {
    return this.hasVipBenefit(vipLevel, "vip_shop");
  }

  // Obtenir le nombre de slots de formation
  public static getFormationSlots(vipLevel: number, baseSlots: number = 3): number {
    const slots = this.getVipBenefitValue(vipLevel, "formation_slots");
    return typeof slots === "number" ? slots : baseSlots;
  }

  // Obtenir les tentatives de donjon supplémentaires
  public static getExtraDungeonAttempts(vipLevel: number): number {
    const daily = this.getVipBenefitValue(vipLevel, "daily_dungeon");
    return typeof daily === "number" ? daily : 0;
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
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const oldLevel = player.vipLevel;
      player.vipExperience += expAmount;
      
      const newLevel = this.calculateVipLevel(player.vipExperience);
      if (newLevel > oldLevel) {
        player.vipLevel = newLevel;
        await this.applyVipLevelUpRewards(player, oldLevel, newLevel);
      }

      await player.save();

      console.log(`👑 ${expAmount} VIP EXP accordé à ${player.username} (${reason})`);

      return {
        success: true,
        message: "VIP EXP granted successfully",
        expGained: expAmount,
        oldLevel,
        newLevel: player.vipLevel,
        leveledUp: newLevel > oldLevel
      };

    } catch (error: any) {
      console.error("❌ Erreur grantVipExp:", error);
      throw error;
    }
  }

  // Changer le niveau VIP directement (admin)
  public static async setVipLevel(
    playerId: string,
    serverId: string,
    targetLevel: number,
    reason: string = "Admin Set"
  ) {
    try {
      if (targetLevel < 0 || targetLevel >= this.VIP_LEVELS.length) {
        throw new Error(`Invalid VIP level. Must be between 0 and ${this.VIP_LEVELS.length - 1}`);
      }

      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const oldLevel = player.vipLevel;
      player.vipLevel = targetLevel;
      player.vipExperience = this.VIP_LEVELS[targetLevel].totalExpRequired;

      if (targetLevel > oldLevel) {
        await this.applyVipLevelUpRewards(player, oldLevel, targetLevel);
      }

      await player.save();

      console.log(`👑 Niveau VIP de ${player.username} défini à ${targetLevel} (${reason})`);

      return {
        success: true,
        message: "VIP level set successfully",
        oldLevel,
        newLevel: targetLevel,
        reason
      };

    } catch (error: any) {
      console.error("❌ Erreur setVipLevel:", error);
      throw error;
    }
  }

  // Simuler un achat VIP pour tester
  public static simulateVipPurchase(
    currentExp: number,
    currentLevel: number,
    purchaseAmount: number
  ) {
    const newExp = currentExp + purchaseAmount;
    const newLevel = this.calculateVipLevel(newExp);
    
    let totalRewards = { 
      gold: 0, 
      gems: 0, 
      heroes: [] as string[], 
      materials: {} as Record<string, number> 
    };
    
    if (newLevel > currentLevel) {
      for (let level = currentLevel + 1; level <= newLevel; level++) {
        const rewards = this.VIP_LEVELS[level]?.unlockRewards;
        if (rewards) {
          if (rewards.gold) totalRewards.gold += rewards.gold;
          if (rewards.gems) totalRewards.gems += rewards.gems;
          if (rewards.heroes) totalRewards.heroes.push(...rewards.heroes);
          if (rewards.materials) {
            Object.entries(rewards.materials).forEach(([id, qty]) => {
              totalRewards.materials[id] = (totalRewards.materials[id] || 0) + qty;
            });
          }
        }
      }
    }

    return {
      currentExp,
      newExp,
      expGained: purchaseAmount,
      currentLevel,
      newLevel,
      leveledUp: newLevel > currentLevel,
      levelsGained: newLevel - currentLevel,
      totalRewards,
      nextLevelInfo: this.VIP_LEVELS[newLevel + 1] ? {
        level: newLevel + 1,
        title: this.VIP_LEVELS[newLevel + 1].title,
        expRequired: this.VIP_LEVELS[newLevel + 1].totalExpRequired - newExp
      } : null
    };
  }

  // Obtenir un résumé des achats VIP recommandés
  public static getVipPurchaseRecommendations(currentLevel: number, currentExp: number) {
    const recommendations = [];
    
    // Recommandations pour atteindre les paliers importants
    const importantLevels = [1, 3, 5, 7, 10, 12, 15];
    
    for (const targetLevel of importantLevels) {
      if (targetLevel > currentLevel && targetLevel < this.VIP_LEVELS.length) {
        const expNeeded = this.VIP_LEVELS[targetLevel].totalExpRequired - currentExp;
        if (expNeeded > 0) {
          recommendations.push({
            targetLevel,
            title: this.VIP_LEVELS[targetLevel].title,
            expNeeded,
            cost: expNeeded, // 1:1 avec paid gems
            keyBenefits: this.VIP_LEVELS[targetLevel].benefits
              .filter(b => ["battle_speed", "afk_rewards", "vip_shop", "auto_battle"].includes(b.type))
              .slice(0, 3),
            unlockRewards: this.VIP_LEVELS[targetLevel].unlockRewards,
            priority: targetLevel <= 5 ? "high" : targetLevel <= 10 ? "medium" : "low"
          });
        }
      }
    }

    return {
      success: true,
      currentStatus: {
        level: currentLevel,
        title: this.VIP_LEVELS[currentLevel].title,
        exp: currentExp
      },
      recommendations: recommendations.slice(0, 5) // Top 5 recommandations
    };
  }
}

export default VipService;

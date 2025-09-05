import Player from "../models/Player";
import AfkState from "../models/AfkState";
import { VipService } from "./VipService";
import { AfkRewardsService, AfkReward } from "./AfkRewardsService";

export interface FastRewardsCost {
  hours: number;
  gemsCost: number;
  discountPercent: number; // Réduction VIP
  originalCost: number;
}

export interface FastRewardsResult {
  success: boolean;
  hours: number;
  gemsCost: number;
  rewards: AfkReward[];
  totalValue: number;
  playerUpdates: {
    gold: number;
    gems: number;
    tickets: number;
    materialsAdded: Record<string, number>;
    fragmentsAdded: Record<string, number>;
  };
  dailyUsage: {
    usedHours: number;
    remainingHours: number;
    maxDailyHours: number;
  };
  error?: string;
  code?: string;
}

export interface DailyFastRewardsUsage {
  playerId: string;
  date: string; // YYYY-MM-DD
  hoursUsed: number;
  totalGemsCost: number;
  totalRewards: AfkReward[];
}

export class FastRewardsService {

  // === CONFIGURATION FAST REWARDS ===
  
  private static readonly BASE_CONFIG = {
    // Coût de base par heure (en gems)
    BASE_GEMS_PER_HOUR: 20,
    
    // Maximum d'heures par jour
    MAX_DAILY_HOURS: 12,
    
    // Réductions VIP (% de réduction)
    VIP_DISCOUNTS: {
      0: 0,   // Pas de VIP = prix plein
      1: 5,   // VIP 1 = -5%
      2: 10,  // VIP 2 = -10%
      3: 15,  // VIP 3 = -15%
      4: 20,  // VIP 4 = -20%
      5: 25,  // VIP 5 = -25%
      6: 30,  // VIP 6 = -30%
      7: 35,  // VIP 7 = -35%
      8: 40,  // VIP 8 = -40%
      9: 45,  // VIP 9 = -45%
      10: 50, // VIP 10+ = -50%
    },
    
    // Maximum VIP pour discount
    MAX_VIP_DISCOUNT: 50,
    
    // Tranches de prix dégressives
    VOLUME_DISCOUNTS: [
      { minHours: 1, maxHours: 2, discount: 0 },    // 1-2h: prix normal
      { minHours: 3, maxHours: 5, discount: 5 },    // 3-5h: -5%
      { minHours: 6, maxHours: 8, discount: 10 },   // 6-8h: -10%
      { minHours: 9, maxHours: 12, discount: 15 },  // 9-12h: -15%
    ]
  };

  // === CALCULER LE COÛT DES FAST REWARDS ===
  
  public static async calculateFastRewardsCost(
    playerId: string, 
    hours: number
  ): Promise<FastRewardsCost> {
    try {
      // Validation des heures
      if (hours < 1 || hours > this.BASE_CONFIG.MAX_DAILY_HOURS) {
        throw new Error(`Hours must be between 1 and ${this.BASE_CONFIG.MAX_DAILY_HOURS}`);
      }

      // Obtenir le niveau VIP
      const player = await Player.findById(playerId).select("vipLevel serverId");
      if (!player) {
        throw new Error("Player not found");
      }

      const vipLevel = player.vipLevel || 0;

      // Coût de base
      const baseCost = hours * this.BASE_CONFIG.BASE_GEMS_PER_HOUR;

      // Réduction VIP
      const vipDiscountPercent = Math.min(
        this.BASE_CONFIG.VIP_DISCOUNTS[Math.min(vipLevel, 10)] || 0,
        this.BASE_CONFIG.MAX_VIP_DISCOUNT
      );

      // Réduction volume (pour achats groupés)
      const volumeDiscount = this.getVolumeDiscount(hours);

      // Réduction totale (VIP + Volume, mais max 70%)
      const totalDiscountPercent = Math.min(vipDiscountPercent + volumeDiscount, 70);

      // Prix final
      const finalCost = Math.ceil(baseCost * (1 - totalDiscountPercent / 100));

      return {
        hours,
        gemsCost: finalCost,
        discountPercent: totalDiscountPercent,
        originalCost: baseCost
      };

    } catch (error: any) {
      console.error("❌ Erreur calculateFastRewardsCost:", error);
      throw error;
    }
  }

  // === UTILISER FAST REWARDS ===
  
  public static async useFastRewards(
    playerId: string, 
    hours: number
  ): Promise<FastRewardsResult> {
    try {
      console.log(`⚡ Fast Rewards: ${hours}h pour ${playerId}`);

      // 1. Vérifications préliminaires
      const player = await Player.findById(playerId);
      if (!player) {
        return { 
          success: false, 
          hours: 0, 
          gemsCost: 0, 
          rewards: [], 
          totalValue: 0, 
          playerUpdates: this.getEmptyPlayerUpdates(),
          dailyUsage: await this.getDailyUsage(playerId),
          error: "Player not found", 
          code: "PLAYER_NOT_FOUND" 
        };
      }

      // 2. Vérifier usage quotidien
      const dailyUsage = await this.getDailyUsage(playerId);
      if (dailyUsage.usedHours + hours > dailyUsage.maxDailyHours) {
        return {
          success: false,
          hours: 0,
          gemsCost: 0,
          rewards: [],
          totalValue: 0,
          playerUpdates: this.getEmptyPlayerUpdates(),
          dailyUsage,
          error: `Daily limit exceeded. You can only use ${dailyUsage.remainingHours} more hours today.`,
          code: "DAILY_LIMIT_EXCEEDED"
        };
      }

      // 3. Calculer le coût
      const costInfo = await this.calculateFastRewardsCost(playerId, hours);

      // 4. Vérifier que le joueur a assez de gems
      if (player.gems < costInfo.gemsCost) {
        return {
          success: false,
          hours: 0,
          gemsCost: costInfo.gemsCost,
          rewards: [],
          totalValue: 0,
          playerUpdates: this.getEmptyPlayerUpdates(),
          dailyUsage,
          error: `Insufficient gems. Required: ${costInfo.gemsCost}, Available: ${player.gems}`,
          code: "INSUFFICIENT_GEMS"
        };
      }

      // 5. Calculer les récompenses pour la durée demandée
      const rewards = await AfkRewardsService.calculateRewardsForDuration(playerId, hours * 60); // en minutes

      // 6. Déduire les gems
      player.gems -= costInfo.gemsCost;

      // 7. Appliquer les récompenses au joueur
      const playerUpdates = this.getEmptyPlayerUpdates();
      playerUpdates.gems = -costInfo.gemsCost; // Gems dépensées (négatif)

      for (const reward of rewards) {
        switch (reward.type) {
          case "currency":
            switch (reward.currencyType) {
              case "gold":
                player.gold += reward.quantity;
                playerUpdates.gold += reward.quantity;
                break;
              case "gems":
                player.gems += reward.quantity;
                playerUpdates.gems += reward.quantity;
                break;
              case "tickets":
                player.tickets += reward.quantity;
                playerUpdates.tickets += reward.quantity;
                break;
            }
            break;

          case "material":
            if (reward.materialId) {
              const current = player.materials.get(reward.materialId) || 0;
              player.materials.set(reward.materialId, current + reward.quantity);
              playerUpdates.materialsAdded[reward.materialId] = reward.quantity;
            }
            break;

          case "fragment":
            if (reward.fragmentId) {
              const current = player.fragments.get(reward.fragmentId) || 0;
              player.fragments.set(reward.fragmentId, current + reward.quantity);
              playerUpdates.fragmentsAdded[reward.fragmentId] = reward.quantity;
            }
            break;
        }
      }

      // 8. Sauvegarder le joueur
      await player.save();

      // 9. Enregistrer l'usage quotidien
      await this.recordDailyUsage(playerId, hours, costInfo.gemsCost, rewards);

      // 10. Calculer la valeur totale
      const totalValue = this.calculateRewardsValue(rewards);

      console.log(`✅ Fast Rewards ${hours}h utilisé: ${costInfo.gemsCost} gems → ${rewards.length} récompenses`);

      return {
        success: true,
        hours,
        gemsCost: costInfo.gemsCost,
        rewards,
        totalValue,
        playerUpdates,
        dailyUsage: await this.getDailyUsage(playerId) // Usage mis à jour
      };

    } catch (error: any) {
      console.error("❌ Erreur useFastRewards:", error);
      return {
        success: false,
        hours: 0,
        gemsCost: 0,
        rewards: [],
        totalValue: 0,
        playerUpdates: this.getEmptyPlayerUpdates(),
        dailyUsage: await this.getDailyUsage(playerId),
        error: error.message,
        code: "FAST_REWARDS_FAILED"
      };
    }
  }

  // === OBTENIR LES OPTIONS FAST REWARDS (POUR L'UI) ===
  
  public static async getFastRewardsOptions(playerId: string): Promise<{
    success: boolean;
    options: FastRewardsCost[];
    dailyUsage: {
      usedHours: number;
      remainingHours: number;
      maxDailyHours: number;
    };
    playerGems: number;
    error?: string;
  }> {
    try {
      const player = await Player.findById(playerId).select("gems");
      if (!player) {
        return { 
          success: false, 
          options: [], 
          dailyUsage: { usedHours: 0, remainingHours: 0, maxDailyHours: 0 },
          playerGems: 0,
          error: "Player not found" 
        };
      }

      const dailyUsage = await this.getDailyUsage(playerId);
      const availableHours = dailyUsage.remainingHours;

      // Générer les options (1h, 2h, 4h, 6h, 8h, 12h)
      const hourOptions = [1, 2, 4, 6, 8, 12].filter(h => h <= availableHours);
      
      const options: FastRewardsCost[] = [];
      for (const hours of hourOptions) {
        const cost = await this.calculateFastRewardsCost(playerId, hours);
        options.push(cost);
      }

      return {
        success: true,
        options,
        dailyUsage,
        playerGems: player.gems
      };

    } catch (error: any) {
      console.error("❌ Erreur getFastRewardsOptions:", error);
      return {
        success: false,
        options: [],
        dailyUsage: { usedHours: 0, remainingHours: 0, maxDailyHours: 0 },
        playerGems: 0,
        error: error.message
      };
    }
  }

  // === PRÉVISUALISER LES RÉCOMPENSES ===
  
  public static async previewFastRewards(
    playerId: string, 
    hours: number
  ): Promise<{
    success: boolean;
    cost: FastRewardsCost;
    rewards: AfkReward[];
    totalValue: number;
    canAfford: boolean;
    error?: string;
  }> {
    try {
      const [player, costInfo, rewards] = await Promise.all([
        Player.findById(playerId).select("gems"),
        this.calculateFastRewardsCost(playerId, hours),
        AfkRewardsService.calculateRewardsForDuration(playerId, hours * 60)
      ]);

      if (!player) {
        return { 
          success: false, 
          cost: { hours: 0, gemsCost: 0, discountPercent: 0, originalCost: 0 },
          rewards: [], 
          totalValue: 0,
          canAfford: false,
          error: "Player not found" 
        };
      }

      const totalValue = this.calculateRewardsValue(rewards);
      const canAfford = player.gems >= costInfo.gemsCost;

      return {
        success: true,
        cost: costInfo,
        rewards,
        totalValue,
        canAfford
      };

    } catch (error: any) {
      console.error("❌ Erreur previewFastRewards:", error);
      return {
        success: false,
        cost: { hours: 0, gemsCost: 0, discountPercent: 0, originalCost: 0 },
        rewards: [],
        totalValue: 0,
        canAfford: false,
        error: error.message
      };
    }
  }

  // === MÉTHODES UTILITAIRES PRIVÉES ===

  private static getVolumeDiscount(hours: number): number {
    for (const tier of this.BASE_CONFIG.VOLUME_DISCOUNTS) {
      if (hours >= tier.minHours && hours <= tier.maxHours) {
        return tier.discount;
      }
    }
    return 0;
  }

  private static getEmptyPlayerUpdates() {
    return {
      gold: 0,
      gems: 0,
      tickets: 0,
      materialsAdded: {} as Record<string, number>,
      fragmentsAdded: {} as Record<string, number>
    };
  }

  private static calculateRewardsValue(rewards: AfkReward[]): number {
    let totalValue = 0;
    
    rewards.forEach(reward => {
      switch (reward.type) {
        case "currency":
          if (reward.currencyType === "gold") totalValue += reward.quantity * 0.001;
          else if (reward.currencyType === "gems") totalValue += reward.quantity * 1;
          else if (reward.currencyType === "tickets") totalValue += reward.quantity * 5;
          break;
        case "material":
          totalValue += reward.quantity * 2;
          break;
        case "fragment":
          totalValue += reward.quantity * 10;
          break;
        case "item":
          totalValue += reward.quantity * 25;
          break;
      }
    });
    
    return Math.round(totalValue);
  }

  // === GESTION USAGE QUOTIDIEN ===

  private static async getDailyUsage(playerId: string): Promise<{
    usedHours: number;
    remainingHours: number;
    maxDailyHours: number;
  }> {
    try {
      // Pour le prototype, on stocke dans AfkState
      const afkState = await AfkState.findOne({ playerId });
      const today = new Date().toISOString().slice(0, 10);
      
      // Si pas d'état AFK ou jour différent, reset
      if (!afkState || afkState.todayKey !== today) {
        return {
          usedHours: 0,
          remainingHours: this.BASE_CONFIG.MAX_DAILY_HOURS,
          maxDailyHours: this.BASE_CONFIG.MAX_DAILY_HOURS
        };
      }

      // Récupérer usage du jour (on utilise un champ custom)
      const usedHours = (afkState as any).todayFastRewardsHours || 0;
      
      return {
        usedHours,
        remainingHours: Math.max(0, this.BASE_CONFIG.MAX_DAILY_HOURS - usedHours),
        maxDailyHours: this.BASE_CONFIG.MAX_DAILY_HOURS
      };

    } catch (error) {
      console.error("❌ Erreur getDailyUsage:", error);
      return {
        usedHours: 0,
        remainingHours: this.BASE_CONFIG.MAX_DAILY_HOURS,
        maxDailyHours: this.BASE_CONFIG.MAX_DAILY_HOURS
      };
    }
  }

  private static async recordDailyUsage(
    playerId: string, 
    hours: number, 
    gemsCost: number, 
    rewards: AfkReward[]
  ): Promise<void> {
    try {
      const afkState = await AfkState.findOne({ playerId });
      if (!afkState) return;

      const today = new Date().toISOString().slice(0, 10);
      
      // Reset si nouveau jour
      if (afkState.todayKey !== today) {
        afkState.todayKey = today;
        (afkState as any).todayFastRewardsHours = 0;
        (afkState as any).todayFastRewardsGems = 0;
      }

      // Mettre à jour usage
      (afkState as any).todayFastRewardsHours = ((afkState as any).todayFastRewardsHours || 0) + hours;
      (afkState as any).todayFastRewardsGems = ((afkState as any).todayFastRewardsGems || 0) + gemsCost;

      await afkState.save();

    } catch (error) {
      console.error("❌ Erreur recordDailyUsage:", error);
    }
  }

  // === STATISTIQUES ADMIN ===

  public static async getFastRewardsStats(serverId?: string): Promise<{
    totalUsers: number;
    totalHoursUsed: number;
    totalGemsSpent: number;
    avgHoursPerUser: number;
    avgGemsPerUser: number;
    topSpenders: Array<{
      playerId: string;
      playerName: string;
      hoursUsed: number;
      gemsSpent: number;
    }>;
  }> {
    try {
      // Pour le prototype, on utilise les données d'AfkState
      // Dans une vraie implémentation, on aurait une collection dédiée
      
      const matchCondition = serverId ? { serverId } : {};
      const afkStates = await AfkState.find(matchCondition);
      
      let totalUsers = 0;
      let totalHoursUsed = 0;
      let totalGemsSpent = 0;
      
      const userStats: Array<{
        playerId: string;
        hoursUsed: number;
        gemsSpent: number;
      }> = [];

      afkStates.forEach(state => {
        const hoursUsed = (state as any).todayFastRewardsHours || 0;
        const gemsSpent = (state as any).todayFastRewardsGems || 0;
        
        if (hoursUsed > 0) {
          totalUsers++;
          totalHoursUsed += hoursUsed;
          totalGemsSpent += gemsSpent;
          
          userStats.push({
            playerId: state.playerId.toString(),
            hoursUsed,
            gemsSpent
          });
        }
      });

      // Top spenders
      const topSpenders = userStats
        .sort((a, b) => b.gemsSpent - a.gemsSpent)
        .slice(0, 10)
        .map(stat => ({
          playerId: stat.playerId,
          playerName: "Unknown", // TODO: Lookup player name
          hoursUsed: stat.hoursUsed,
          gemsSpent: stat.gemsSpent
        }));

      return {
        totalUsers,
        totalHoursUsed,
        totalGemsSpent,
        avgHoursPerUser: totalUsers > 0 ? Math.round(totalHoursUsed / totalUsers * 100) / 100 : 0,
        avgGemsPerUser: totalUsers > 0 ? Math.round(totalGemsSpent / totalUsers) : 0,
        topSpenders
      };

    } catch (error: any) {
      console.error("❌ Erreur getFastRewardsStats:", error);
      return {
        totalUsers: 0,
        totalHoursUsed: 0,
        totalGemsSpent: 0,
        avgHoursPerUser: 0,
        avgGemsPerUser: 0,
        topSpenders: []
      };
    }
  }
}

export default FastRewardsService;

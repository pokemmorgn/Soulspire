import Player from "../models/Player";
import AfkState from "../models/AfkState";
import AfkServiceEnhanced from "./AfkService";
import { VipService } from "./VipService";
import { AfkRewardsService } from "./AfkRewardsService";

/**
 * Fast Rewards Service - Système d'accélération AFK comme AFK Arena
 * Permet de "skip" du temps AFK contre des gems selon le niveau VIP
 */

export interface FastRewardOption {
  duration: number;        // Durée en secondes (2h, 4h, 8h, 12h)
  durationLabel: string;   // "2h", "4h", etc.
  gemsCost: number;        // Coût en gems
  rewards: any[];          // Récompenses qu'il obtiendrait
  totalValue: number;      // Valeur totale des récompenses
  available: boolean;      // Si le joueur peut l'utiliser
  vipRequired?: number;    // Niveau VIP requis (si applicable)
}

export interface FastRewardResult {
  success: boolean;
  message: string;
  rewards?: any[];
  totalValue?: number;
  gemsSpent?: number;
  playerResources?: {
    gold: number;
    gems: number;
    tickets: number;
    materialsAdded: Record<string, number>;
    fragmentsAdded: Record<string, number>;
  };
  error?: string;
  code?: string;
}

export class FastRewardsService {

  // Configuration des Fast Rewards selon VIP
  private static readonly FAST_REWARD_CONFIGS = [
    // 2 heures - Disponible pour tous
    {
      duration: 2 * 3600,
      durationLabel: "2h",
      baseGemsCost: 50,
      vipRequired: 0
    },
    // 4 heures - VIP 2+
    {
      duration: 4 * 3600,
      durationLabel: "4h", 
      baseGemsCost: 90,
      vipRequired: 2
    },
    // 8 heures - VIP 5+
    {
      duration: 8 * 3600,
      durationLabel: "8h",
      baseGemsCost: 160,
      vipRequired: 5
    },
    // 12 heures - VIP 8+
    {
      duration: 12 * 3600,
      durationLabel: "12h",
      baseGemsCost: 220,
      vipRequired: 8
    },
    // 24 heures - VIP 12+
    {
      duration: 24 * 3600,
      durationLabel: "24h",
      baseGemsCost: 400,
      vipRequired: 12
    }
  ];

  /**
   * Obtenir les options Fast Rewards disponibles pour un joueur
   */
  public static async getAvailableFastRewards(playerId: string): Promise<{
    success: boolean;
    options: FastRewardOption[];
    currentVipLevel: number;
    error?: string;
  }> {
    try {
      const [player, vipLevel] = await Promise.all([
        Player.findById(playerId).select("serverId gems"),
        VipService.getPlayerVipLevel(playerId, player?.serverId || "S1")
      ]);

      if (!player) {
        return { success: false, options: [], currentVipLevel: 0, error: "Player not found" };
      }

      const options: FastRewardOption[] = [];

      for (const config of this.FAST_REWARD_CONFIGS) {
        const available = vipLevel >= config.vipRequired;
        
        // Calculer le coût avec remise VIP
        const discountedCost = await VipService.calculateVipPrice(
          playerId, 
          player.serverId, 
          config.baseGemsCost
        );

        // Simuler les récompenses pour cette durée
        let rewards: any[] = [];
        let totalValue = 0;

        if (available) {
          try {
            const simulation = await AfkRewardsService.simulateAfkGains(
              playerId, 
              config.duration / 3600 // Convertir en heures
            );
            rewards = simulation.rewards;
            totalValue = simulation.totalValue;
          } catch (error) {
            console.error(`Erreur simulation ${config.durationLabel}:`, error);
          }
        }

        options.push({
          duration: config.duration,
          durationLabel: config.durationLabel,
          gemsCost: discountedCost,
          rewards,
          totalValue,
          available,
          ...(config.vipRequired > 0 && { vipRequired: config.vipRequired })
        });
      }

      return {
        success: true,
        options,
        currentVipLevel: vipLevel
      };

    } catch (error: any) {
      console.error("❌ Erreur getAvailableFastRewards:", error);
      return { 
        success: false, 
        options: [], 
        currentVipLevel: 0, 
        error: error.message 
      };
    }
  }

  /**
   * Utiliser Fast Rewards pour une durée spécifique
   */
  public static async useFastReward(
    playerId: string, 
    durationLabel: string
  ): Promise<FastRewardResult> {
    try {
      console.log(`⚡ Fast Reward ${durationLabel} pour ${playerId}`);

      // Vérifier la configuration demandée
      const config = this.FAST_REWARD_CONFIGS.find(c => c.durationLabel === durationLabel);
      if (!config) {
        return {
          success: false,
          message: "Invalid duration",
          code: "INVALID_DURATION"
        };
      }

      // Récupérer le joueur et vérifier ses ressources
      const [player, vipLevel] = await Promise.all([
        Player.findById(playerId),
        VipService.getPlayerVipLevel(playerId, "S1") // TODO: Récupérer vrai serverId
      ]);

      if (!player) {
        return {
          success: false,
          message: "Player not found",
          code: "PLAYER_NOT_FOUND"
        };
      }

      // Vérifier le niveau VIP requis
      if (vipLevel < config.vipRequired) {
        return {
          success: false,
          message: `VIP ${config.vipRequired} required`,
          code: "INSUFFICIENT_VIP_LEVEL"
        };
      }

      // Calculer le coût avec remise VIP
      const gemsCost = await VipService.calculateVipPrice(
        playerId, 
        player.serverId, 
        config.baseGemsCost
      );

      // Vérifier que le joueur a assez de gems
      if (player.gems < gemsCost) {
        return {
          success: false,
          message: `Insufficient gems. Required: ${gemsCost}, Available: ${player.gems}`,
          code: "INSUFFICIENT_GEMS"
        };
      }

      // Vérifier qu'il n'a pas déjà atteint le cap d'accumulation
      const afkSummary = await AfkServiceEnhanced.getSummaryEnhanced(playerId, true);
      
      const remainingCapSeconds = afkSummary.maxAccrualSeconds - afkSummary.accumulatedSinceClaimSec;
      if (remainingCapSeconds <= 0) {
        return {
          success: false,
          message: "AFK rewards already at maximum capacity. Please claim first.",
          code: "AFK_CAP_REACHED"
        };
      }

      // Limiter la durée au cap restant
      const effectiveDuration = Math.min(config.duration, remainingCapSeconds);
      const effectiveHours = effectiveDuration / 3600;

      // Calculer les récompenses pour la durée effective
      const simulation = await AfkRewardsService.simulateAfkGains(playerId, effectiveHours);

      // Déduire les gems
      player.gems -= gemsCost;

      // Simuler l'avancement du temps AFK
      const afkState = await AfkState.findOne({ playerId });
      if (afkState) {
        // Avancer le temps artificiellement
        if (afkState.lastTickAt) {
          afkState.lastTickAt = new Date(afkState.lastTickAt.getTime() - effectiveDuration * 1000);
        }
        
        // Faire le tick pour générer les récompenses
        if (afkState.useEnhancedRewards) {
          await afkState.tickEnhanced(new Date());
        } else {
          afkState.tick(new Date());
        }
        
        await afkState.save();
      }

      await player.save();

      // Préparer le résultat
      const playerUpdates = {
        gold: 0,
        gems: player.gems,
        tickets: 0,
        materialsAdded: {} as Record<string, number>,
        fragmentsAdded: {} as Record<string, number>
      };

      console.log(`✅ Fast Reward ${durationLabel} utilisé: ${gemsCost} gems → ${simulation.totalValue} valeur`);

      return {
        success: true,
        message: `Fast reward ${durationLabel} applied successfully`,
        rewards: simulation.rewards,
        totalValue: simulation.totalValue,
        gemsSpent: gemsCost,
        playerResources: playerUpdates
      };

    } catch (error: any) {
      console.error("❌ Erreur useFastReward:", error);
      return {
        success: false,
        message: "Fast reward failed",
        error: error.message,
        code: "FAST_REWARD_FAILED"
      };
    }
  }

  /**
   * Calculer l'efficacité d'un Fast Reward (gems spent vs value gained)
   */
  public static async calculateFastRewardEfficiency(
    playerId: string, 
    durationLabel: string
  ): Promise<{
    success: boolean;
    efficiency: {
      gemsCost: number;
      rewardValue: number;
      efficiency: number; // ratio value/cost
      recommendation: "excellent" | "good" | "fair" | "poor";
    };
    error?: string;
  }> {
    try {
      const config = this.FAST_REWARD_CONFIGS.find(c => c.durationLabel === durationLabel);
      if (!config) {
        return { success: false, efficiency: { gemsCost: 0, rewardValue: 0, efficiency: 0, recommendation: "poor" }, error: "Invalid duration" };
      }

      const player = await Player.findById(playerId).select("serverId");
      if (!player) {
        return { success: false, efficiency: { gemsCost: 0, rewardValue: 0, efficiency: 0, recommendation: "poor" }, error: "Player not found" };
      }

      // Calculer le coût avec remise VIP
      const gemsCost = await VipService.calculateVipPrice(
        playerId, 
        player.serverId, 
        config.baseGemsCost
      );

      // Simuler les récompenses
      const simulation = await AfkRewardsService.simulateAfkGains(
        playerId, 
        config.duration / 3600
      );

      const efficiency = simulation.totalValue / gemsCost;
      
      let recommendation: "excellent" | "good" | "fair" | "poor";
      if (efficiency >= 100) recommendation = "excellent";      // 100+ value per gem
      else if (efficiency >= 50) recommendation = "good";       // 50+ value per gem
      else if (efficiency >= 20) recommendation = "fair";       // 20+ value per gem
      else recommendation = "poor";                            // < 20 value per gem

      return {
        success: true,
        efficiency: {
          gemsCost,
          rewardValue: simulation.totalValue,
          efficiency: Math.round(efficiency * 100) / 100,
          recommendation
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur calculateFastRewardEfficiency:", error);
      return { 
        success: false, 
        efficiency: { gemsCost: 0, rewardValue: 0, efficiency: 0, recommendation: "poor" }, 
        error: error.message 
      };
    }
  }

  /**
   * Obtenir les statistiques d'usage des Fast Rewards
   */
  public static async getFastRewardStats(serverId?: string): Promise<{
    totalUsage: number;
    totalGemsSpent: number;
    mostPopularDuration: string;
    averageVipLevel: number;
    usageByDuration: Record<string, number>;
  }> {
    try {
      // Pour l'instant, retourner des stats mockées
      // TODO: Implémenter un système de tracking des Fast Rewards
      
      return {
        totalUsage: 0,
        totalGemsSpent: 0,
        mostPopularDuration: "2h",
        averageVipLevel: 0,
        usageByDuration: {
          "2h": 0,
          "4h": 0,
          "8h": 0,
          "12h": 0,
          "24h": 0
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getFastRewardStats:", error);
      return {
        totalUsage: 0,
        totalGemsSpent: 0,
        mostPopularDuration: "2h",
        averageVipLevel: 0,
        usageByDuration: {}
      };
    }
  }

  /**
   * Vérifier si un joueur peut utiliser Fast Rewards
   */
  public static async canUseFastReward(playerId: string): Promise<{
    canUse: boolean;
    reason?: string;
    nextAvailableIn?: number; // secondes
  }> {
    try {
      const afkSummary = await AfkServiceEnhanced.getSummaryEnhanced(playerId, false);
      
      // Vérifier si déjà au cap
      const remainingCapSeconds = afkSummary.maxAccrualSeconds - afkSummary.accumulatedSinceClaimSec;
      
      if (remainingCapSeconds <= 0) {
        return {
          canUse: false,
          reason: "AFK rewards at maximum capacity. Please claim first."
        };
      }

      // Vérifier si le système Enhanced est activé (recommandé pour Fast Rewards)
      if (!afkSummary.useEnhancedRewards && afkSummary.canUpgrade) {
        return {
          canUse: true, // Peut utiliser, mais recommandation d'upgrade
          reason: "Enhanced AFK system recommended for better Fast Reward value"
        };
      }

      return { canUse: true };

    } catch (error: any) {
      console.error("❌ Erreur canUseFastReward:", error);
      return {
        canUse: false,
        reason: "Error checking Fast Reward availability"
      };
    }
  }
}

export default FastRewardsService;

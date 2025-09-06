import { Router, Request, Response } from "express";
import { FastRewardsService } from "../services/FastRewardsService";
import { VipService } from "../services/VipService";
import AfkServiceEnhanced from "../services/AfkService";

// Extend the Request interface localement pour ce fichier
interface AuthenticatedRequest extends Request {
  user?: { id: string; serverId: string };
}

const router = Router();

/** Auth middleware */
const requireAuth = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (!req.user?.id) return res.status(401).json({ success: false, error: "Unauthenticated" });
  next();
};

/**
 * GET /fast-rewards - Obtenir les options Fast Rewards disponibles
 */
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: playerId } = req.user!;

    console.log(`⚡ Récupération Fast Rewards pour ${playerId}`);

    // Vérifier si le joueur peut utiliser Fast Rewards
    const eligibility = await FastRewardsService.canUseFastReward(playerId);
    
    // Récupérer les options disponibles
    const options = await FastRewardsService.getAvailableFastRewards(playerId);

    // Récupérer le statut AFK actuel
    const afkSummary = await AfkServiceEnhanced.getSummaryEnhanced(playerId, false);

    res.json({
      success: true,
      data: {
        canUseFastRewards: eligibility.canUse,
        reason: eligibility.reason,
        nextAvailableIn: eligibility.nextAvailableIn,
        
        // Options Fast Rewards
        options: options.options,
        currentVipLevel: options.currentVipLevel,
        
        // Contexte AFK
        afkContext: {
          pendingGold: afkSummary.pendingGold,
          pendingRewards: afkSummary.pendingRewards,
          totalValue: afkSummary.totalValue,
          accumulatedTime: afkSummary.accumulatedSinceClaimSec,
          maxAccrualTime: afkSummary.maxAccrualSeconds,
          remainingCapacity: Math.max(0, afkSummary.maxAccrualSeconds - afkSummary.accumulatedSinceClaimSec),
          useEnhancedRewards: afkSummary.useEnhancedRewards
        },
        
        // Recommandations
        recommendations: {
          bestValue: options.options.find(opt => opt.available)?.durationLabel || null,
          upgradeAdvice: !afkSummary.useEnhancedRewards && afkSummary.canUpgrade ? 
            "Upgrade to Enhanced AFK for better Fast Reward value" : null
        }
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur GET /fast-rewards:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /fast-rewards/use - Utiliser Fast Rewards
 */
router.post("/use", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: playerId } = req.user!;
    const { duration } = req.body;

    if (!duration || typeof duration !== "string") {
      return res.status(400).json({ 
        success: false, 
        error: "Duration is required (e.g., '2h', '4h', '8h', '12h', '24h')" 
      });
    }

    console.log(`⚡ Utilisation Fast Reward ${duration} pour ${playerId}`);

    // Utiliser Fast Reward
    const result = await FastRewardsService.useFastReward(playerId, duration);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
        code: result.code
      });
    }

    // Récupérer le nouvel état AFK
    const newAfkSummary = await AfkServiceEnhanced.getSummaryEnhanced(playerId, true);

    res.json({
      success: true,
      message: result.message,
      data: {
        // Récompenses obtenues
        rewards: result.rewards,
        totalValue: result.totalValue,
        gemsSpent: result.gemsSpent,
        
        // État des ressources du joueur
        playerResources: result.playerResources,
        
        // Nouvel état AFK
        newAfkState: {
          pendingGold: newAfkSummary.pendingGold,
          pendingRewards: newAfkSummary.pendingRewards,
          totalValue: newAfkSummary.totalValue,
          accumulatedTime: newAfkSummary.accumulatedSinceClaimSec,
          remainingCapacity: Math.max(0, newAfkSummary.maxAccrualSeconds - newAfkSummary.accumulatedSinceClaimSec)
        }
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur POST /fast-rewards/use:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /fast-rewards/efficiency/:duration - Calculer l'efficacité d'un Fast Reward
 */
router.get("/efficiency/:duration", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: playerId } = req.user!;
    const { duration } = req.params;

    console.log(`📊 Calcul efficacité Fast Reward ${duration} pour ${playerId}`);

    const efficiency = await FastRewardsService.calculateFastRewardEfficiency(playerId, duration);

    if (!efficiency.success) {
      return res.status(400).json({
        success: false,
        error: efficiency.error
      });
    }

    res.json({
      success: true,
      data: {
        duration,
        efficiency: efficiency.efficiency,
        analysis: {
          gemsCost: efficiency.efficiency.gemsCost,
          rewardValue: efficiency.efficiency.rewardValue,
          valuePerGem: Math.round((efficiency.efficiency.rewardValue / efficiency.efficiency.gemsCost) * 100) / 100,
          recommendation: efficiency.efficiency.recommendation,
          
          // Contexte d'évaluation
          evaluation: {
            isWorthIt: efficiency.efficiency.recommendation === "excellent" || efficiency.efficiency.recommendation === "good",
            description: getEfficiencyDescription(efficiency.efficiency.recommendation),
            compareToOtherOptions: "Check other durations for better value"
          }
        }
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur GET /fast-rewards/efficiency:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /fast-rewards/simulate/:duration - Simuler les gains d'un Fast Reward
 */
router.get("/simulate/:duration", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: playerId } = req.user!;
    const { duration } = req.params;

    console.log(`🔮 Simulation Fast Reward ${duration} pour ${playerId}`);

    // Récupérer les options pour vérifier la validité
    const options = await FastRewardsService.getAvailableFastRewards(playerId);
    const option = options.options.find(opt => opt.durationLabel === duration);

    if (!option) {
      return res.status(400).json({
        success: false,
        error: `Invalid duration: ${duration}. Available: ${options.options.map(o => o.durationLabel).join(", ")}`
      });
    }

    if (!option.available) {
      return res.status(400).json({
        success: false,
        error: `Duration ${duration} not available. ${option.vipRequired ? `Requires VIP ${option.vipRequired}` : "Unknown reason"}`
      });
    }

    // Récupérer l'état AFK actuel
    const currentAfkState = await AfkServiceEnhanced.getSummaryEnhanced(playerId, false);

    res.json({
      success: true,
      data: {
        duration,
        simulation: {
          // Coût
          gemsCost: option.gemsCost,
          
          // Gains simulés
          rewards: option.rewards,
          totalValue: option.totalValue,
          
          // Comparaison avec attente naturelle
          comparison: {
            fastRewardValue: option.totalValue,
            timeToGetNaturally: calculateNaturalTimeNeeded(option.totalValue, currentAfkState),
            timeSaved: duration
          },
          
          // Impact sur l'état AFK
          afkImpact: {
            currentAccumulated: currentAfkState.accumulatedSinceClaimSec,
            afterFastReward: Math.min(
              currentAfkState.maxAccrualSeconds,
              currentAfkState.accumulatedSinceClaimSec + durationToSeconds(duration)
            ),
            remainingCapacity: Math.max(0, 
              currentAfkState.maxAccrualSeconds - currentAfkState.accumulatedSinceClaimSec - durationToSeconds(duration)
            )
          }
        }
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur GET /fast-rewards/simulate:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /fast-rewards/stats - Statistiques d'utilisation Fast Rewards
 */
router.get("/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { serverId } = req.user!;

    console.log(`📈 Statistiques Fast Rewards pour serveur ${serverId}`);

    const stats = await FastRewardsService.getFastRewardStats(serverId);

    res.json({
      success: true,
      data: {
        serverStats: stats,
        summary: {
          totalUsage: stats.totalUsage,
          totalGemsSpent: stats.totalGemsSpent,
          avgGemsPerUse: stats.totalUsage > 0 ? Math.round(stats.totalGemsSpent / stats.totalUsage) : 0,
          mostPopularDuration: stats.mostPopularDuration,
          avgPlayerVipLevel: stats.averageVipLevel
        },
        usageDistribution: stats.usageByDuration,
        insights: {
          recommendation: stats.mostPopularDuration,
          vipTrend: stats.averageVipLevel > 5 ? "High VIP usage" : "Mixed VIP levels",
          economicImpact: `${stats.totalGemsSpent.toLocaleString()} gems circulated`
        }
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur GET /fast-rewards/stats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /fast-rewards/vip-benefits - Bénéfices VIP pour Fast Rewards
 */
router.get("/vip-benefits", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: playerId, serverId } = req.user!;

    console.log(`👑 Bénéfices VIP Fast Rewards pour ${playerId}`);

    // Récupérer le niveau VIP actuel
    const currentVipLevel = await VipService.getPlayerVipLevel(playerId, serverId);

    // Simuler les bénéfices à différents niveaux VIP
    const vipBenefits = [];

    for (let vipLevel = 0; vipLevel <= 15; vipLevel++) {
      const duration = "4h"; // Duration standard pour comparaison
      
      // Simuler le coût avec ce niveau VIP
      const originalCost = 90; // Coût de base 4h
      const discountedCost = await calculateVipPrice(originalCost, vipLevel);
      const discount = Math.round(((originalCost - discountedCost) / originalCost) * 100);

      vipBenefits.push({
        vipLevel,
        isCurrent: vipLevel === currentVipLevel,
        benefits: {
          costReduction: discount,
          originalCost,
          discountedCost,
          maxDuration: getMaxDurationForVip(vipLevel),
          specialFeatures: getVipSpecialFeatures(vipLevel)
        }
      });
    }

    res.json({
      success: true,
      data: {
        currentVipLevel,
        vipBenefits,
        recommendations: {
          nextVipTarget: currentVipLevel < 15 ? currentVipLevel + 1 : null,
          nextBenefit: getNextVipBenefit(currentVipLevel),
          costSavingsAtNextLevel: calculateNextLevelSavings(currentVipLevel)
        }
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur GET /fast-rewards/vip-benefits:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// === MÉTHODES UTILITAIRES (maintenant en dehors de la classe) ===

function getEfficiencyDescription(recommendation: string): string {
  switch (recommendation) {
    case "excellent": return "Excellent value! Highly recommended.";
    case "good": return "Good value, worth considering.";
    case "fair": return "Fair value, acceptable if needed.";
    case "poor": return "Poor value, consider other options.";
    default: return "Unknown efficiency rating.";
  }
}

function calculateNaturalTimeNeeded(value: number, afkState: any): string {
  const goldPerMinute = afkState.baseGoldPerMinute;
  const minutesNeeded = value / (goldPerMinute * 0.001); // Conversion value to minutes
  
  if (minutesNeeded < 60) return `${Math.round(minutesNeeded)}m`;
  if (minutesNeeded < 1440) return `${Math.round(minutesNeeded / 60)}h`;
  return `${Math.round(minutesNeeded / 1440)}d`;
}

function durationToSeconds(duration: string): number {
  const hours = parseInt(duration.replace('h', ''));
  return hours * 3600;
}

async function calculateVipPrice(originalPrice: number, vipLevel: number): Promise<number> {
  // Simulation simple des remises VIP
  const discounts: { [key: number]: number } = {
    0: 0, 2: 5, 5: 10, 8: 15, 12: 20, 15: 25
  };
  
  let discount = 0;
  for (const [level, disc] of Object.entries(discounts)) {
    if (vipLevel >= parseInt(level)) discount = disc;
  }
  
  return Math.max(1, Math.floor(originalPrice * (1 - discount / 100)));
}

function getMaxDurationForVip(vipLevel: number): string {
  if (vipLevel >= 12) return "24h";
  if (vipLevel >= 8) return "12h";
  if (vipLevel >= 5) return "8h";
  if (vipLevel >= 2) return "4h";
  return "2h";
}

function getVipSpecialFeatures(vipLevel: number): string[] {
  const features = [];
  if (vipLevel >= 2) features.push("4h Fast Rewards");
  if (vipLevel >= 5) features.push("8h Fast Rewards", "10% cost reduction");
  if (vipLevel >= 8) features.push("12h Fast Rewards", "15% cost reduction");
  if (vipLevel >= 12) features.push("24h Fast Rewards", "20% cost reduction");
  if (vipLevel >= 15) features.push("25% cost reduction", "Premium efficiency");
  return features;
}

function getNextVipBenefit(currentVip: number): string | null {
  if (currentVip < 2) return "Unlock 4h Fast Rewards at VIP 2";
  if (currentVip < 5) return "Unlock 8h + 10% discount at VIP 5";
  if (currentVip < 8) return "Unlock 12h + 15% discount at VIP 8";
  if (currentVip < 12) return "Unlock 24h + 20% discount at VIP 12";
  if (currentVip < 15) return "Maximum 25% discount at VIP 15";
  return null;
}

function calculateNextLevelSavings(currentVip: number): number {
  const currentDiscount = currentVip >= 15 ? 25 : currentVip >= 12 ? 20 : currentVip >= 8 ? 15 : currentVip >= 5 ? 10 : currentVip >= 2 ? 5 : 0;
  const nextDiscount = currentVip >= 15 ? 25 : currentVip >= 12 ? 25 : currentVip >= 8 ? 20 : currentVip >= 5 ? 15 : currentVip >= 2 ? 10 : 5;
  
  return nextDiscount - currentDiscount;
}

export default router;

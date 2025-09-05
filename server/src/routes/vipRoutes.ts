// src/routes/vipRoutes.ts
import { Router, Request, Response } from "express";
import { VipService } from "../services/VipService";
import { authMiddleware } from "../middleware/authMiddleware";
import { validateRequest } from "../middleware/validateRequest";
import { body, param, query } from "express-validator";

const router = Router();

// Middleware d'authentification pour toutes les routes VIP
router.use(authMiddleware);

// === ROUTES PRINCIPALES VIP ===

/**
 * GET /api/vip/status
 * Récupérer le statut VIP complet du joueur
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const playerId = req.user?.playerId;
    const serverId = req.user?.serverId || "S1";

    if (!playerId) {
      return res.status(401).json({
        success: false,
        error: "Player ID required",
        code: "UNAUTHORIZED"
      });
    }

    const result = await VipService.getPlayerVipStatus(playerId, serverId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    console.error("❌ Erreur GET /vip/status:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

/**
 * POST /api/vip/purchase
 * Acheter de l'expérience VIP avec des gems payantes
 */
router.post("/purchase", [
  body("paidGemsAmount")
    .isInt({ min: 1, max: 100000 })
    .withMessage("Amount must be between 1 and 100000"),
  validateRequest
], async (req: Request, res: Response) => {
  try {
    const playerId = req.user?.playerId;
    const serverId = req.user?.serverId || "S1";
    const { paidGemsAmount } = req.body;

    if (!playerId) {
      return res.status(401).json({
        success: false,
        error: "Player ID required",
        code: "UNAUTHORIZED"
      });
    }

    const result = await VipService.purchaseVipExp(playerId, serverId, paidGemsAmount);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    console.error("❌ Erreur POST /vip/purchase:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

/**
 * POST /api/vip/daily-rewards/claim
 * Réclamer les récompenses quotidiennes VIP
 */
router.post("/daily-rewards/claim", async (req: Request, res: Response) => {
  try {
    const playerId = req.user?.playerId;
    const serverId = req.user?.serverId || "S1";

    if (!playerId) {
      return res.status(401).json({
        success: false,
        error: "Player ID required",
        code: "UNAUTHORIZED"
      });
    }

    const result = await VipService.claimVipDailyRewards(playerId, serverId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    console.error("❌ Erreur POST /vip/daily-rewards/claim:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

// === ROUTES UTILITAIRES VIP ===

/**
 * GET /api/vip/level
 * Obtenir uniquement le niveau VIP du joueur (route rapide)
 */
router.get("/level", async (req: Request, res: Response) => {
  try {
    const playerId = req.user?.playerId;
    const serverId = req.user?.serverId || "S1";

    if (!playerId) {
      return res.status(401).json({
        success: false,
        error: "Player ID required",
        code: "UNAUTHORIZED"
      });
    }

    const vipLevel = await VipService.getPlayerVipLevel(playerId, serverId);

    res.json({
      success: true,
      vipLevel,
      playerId,
      serverId
    });
  } catch (error: any) {
    console.error("❌ Erreur GET /vip/level:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

/**
 * GET /api/vip/benefits/:benefitType
 * Vérifier si le joueur a un bénéfice spécifique
 */
router.get("/benefits/:benefitType", [
  param("benefitType").isString().notEmpty(),
  validateRequest
], async (req: Request, res: Response) => {
  try {
    const playerId = req.user?.playerId;
    const serverId = req.user?.serverId || "S1";
    const { benefitType } = req.params;

    if (!playerId) {
      return res.status(401).json({
        success: false,
        error: "Player ID required",
        code: "UNAUTHORIZED"
      });
    }

    const [hasBenefit, benefitValue] = await Promise.all([
      VipService.hasVipBenefit(playerId, serverId, benefitType),
      VipService.getVipBenefitValue(playerId, serverId, benefitType)
    ]);

    res.json({
      success: true,
      benefitType,
      hasBenefit,
      value: benefitValue,
      playerId,
      serverId
    });
  } catch (error: any) {
    console.error("❌ Erreur GET /vip/benefits:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

/**
 * GET /api/vip/shop-price
 * Calculer le prix avec remise VIP
 */
router.get("/shop-price", [
  query("originalPrice")
    .isInt({ min: 1 })
    .withMessage("Original price must be a positive integer"),
  validateRequest
], async (req: Request, res: Response) => {
  try {
    const playerId = req.user?.playerId;
    const serverId = req.user?.serverId || "S1";
    const originalPrice = parseInt(req.query.originalPrice as string);

    if (!playerId) {
      return res.status(401).json({
        success: false,
        error: "Player ID required",
        code: "UNAUTHORIZED"
      });
    }

    const [finalPrice, discount] = await Promise.all([
      VipService.calculateVipPrice(playerId, serverId, originalPrice),
      VipService.getVipBenefitValue(playerId, serverId, "shop_discount")
    ]);

    const savings = originalPrice - finalPrice;
    const discountPercent = typeof discount === "number" ? discount : 0;

    res.json({
      success: true,
      originalPrice,
      finalPrice,
      savings,
      discountPercent,
      playerId,
      serverId
    });
  } catch (error: any) {
    console.error("❌ Erreur GET /vip/shop-price:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

/**
 * GET /api/vip/battle-speed
 * Obtenir la vitesse de combat maximum du joueur
 */
router.get("/battle-speed", async (req: Request, res: Response) => {
  try {
    const playerId = req.user?.playerId;
    const serverId = req.user?.serverId || "S1";

    if (!playerId) {
      return res.status(401).json({
        success: false,
        error: "Player ID required",
        code: "UNAUTHORIZED"
      });
    }

    const maxSpeed = await VipService.getMaxBattleSpeed(playerId, serverId);

    res.json({
      success: true,
      maxBattleSpeed: maxSpeed,
      playerId,
      serverId
    });
  } catch (error: any) {
    console.error("❌ Erreur GET /vip/battle-speed:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

/**
 * GET /api/vip/afk-multiplier
 * Obtenir le multiplicateur de récompenses AFK
 */
router.get("/afk-multiplier", async (req: Request, res: Response) => {
  try {
    const playerId = req.user?.playerId;
    const serverId = req.user?.serverId || "S1";

    if (!playerId) {
      return res.status(401).json({
        success: false,
        error: "Player ID required",
        code: "UNAUTHORIZED"
      });
    }

    const multiplier = await VipService.getAfkRewardsMultiplier(playerId, serverId);

    res.json({
      success: true,
      afkMultiplier: multiplier,
      playerId,
      serverId
    });
  } catch (error: any) {
    console.error("❌ Erreur GET /vip/afk-multiplier:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

// === ROUTES D'ADMINISTRATION ===

/**
 * POST /api/vip/admin/grant-exp
 * Donner de l'EXP VIP gratuitement (admin seulement)
 */
router.post("/admin/grant-exp", [
  body("targetPlayerId").isString().notEmpty(),
  body("expAmount").isInt({ min: 1, max: 100000 }),
  body("reason").optional().isString(),
  validateRequest
], async (req: Request, res: Response) => {
  try {
    const adminPlayerId = req.user?.playerId;
    const isAdmin = req.user?.isAdmin; // TODO: Implémenter la vérification admin
    const serverId = req.user?.serverId || "S1";
    const { targetPlayerId, expAmount, reason } = req.body;

    if (!adminPlayerId || !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
        code: "FORBIDDEN"
      });
    }

    const result = await VipService.grantVipExp(
      targetPlayerId,
      serverId,
      expAmount,
      reason || `Admin grant by ${adminPlayerId}`
    );

    res.json(result);
  } catch (error: any) {
    console.error("❌ Erreur POST /vip/admin/grant-exp:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

/**
 * GET /api/vip/admin/server-stats
 * Obtenir les statistiques VIP du serveur (admin seulement)
 */
router.get("/admin/server-stats", async (req: Request, res: Response) => {
  try {
    const adminPlayerId = req.user?.playerId;
    const isAdmin = req.user?.isAdmin; // TODO: Implémenter la vérification admin
    const serverId = req.user?.serverId || "S1";

    if (!adminPlayerId || !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
        code: "FORBIDDEN"
      });
    }

    const stats = await VipService.getServerVipStats(serverId);

    res.json(stats);
  } catch (error: any) {
    console.error("❌ Erreur GET /vip/admin/server-stats:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

// === ROUTES DE DEBUG/TEST ===

/**
 * GET /api/vip/debug/all-benefits
 * Lister tous les bénéfices VIP du joueur (debug)
 */
router.get("/debug/all-benefits", async (req: Request, res: Response) => {
  try {
    const playerId = req.user?.playerId;
    const serverId = req.user?.serverId || "S1";

    if (!playerId) {
      return res.status(401).json({
        success: false,
        error: "Player ID required",
        code: "UNAUTHORIZED"
      });
    }

    const benefitTypes = [
      "battle_speed", "daily_rewards", "shop_discount", "max_stamina", 
      "stamina_regen", "afk_rewards", "fast_rewards", "hero_slots", 
      "formation_slots", "auto_battle", "skip_battle", "vip_shop", 
      "exclusive_summons", "bonus_exp", "bonus_gold", "chat_privileges"
    ];

    const benefits: any = {};
    for (const benefitType of benefitTypes) {
      const [hasBenefit, value] = await Promise.all([
        VipService.hasVipBenefit(playerId, serverId, benefitType),
        VipService.getVipBenefitValue(playerId, serverId, benefitType)
      ]);
      
      benefits[benefitType] = {
        has: hasBenefit,
        value: value
      };
    }

    res.json({
      success: true,
      playerId,
      serverId,
      vipLevel: await VipService.getPlayerVipLevel(playerId, serverId),
      benefits
    });
  } catch (error: any) {
    console.error("❌ Erreur GET /vip/debug/all-benefits:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

export default router;

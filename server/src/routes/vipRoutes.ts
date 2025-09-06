// src/routes/vipRoutes.ts
import { Router, Request, Response } from "express";
import { VipService } from "../services/VipService";
import authMiddleware from "../middleware/authMiddleware";
import { requireFeature } from "../middleware/featureMiddleware";
import Joi from "joi";

const router = Router();

// Schémas de validation avec Joi (comme dans vos autres routes)
const purchaseVipExpSchema = Joi.object({
  paidGemsAmount: Joi.number().integer().min(1).max(100000).required()
});

const benefitTypeSchema = Joi.object({
  benefitType: Joi.string().required()
});

const shopPriceSchema = Joi.object({
  originalPrice: Joi.number().integer().min(1).required()
});

const grantExpSchema = Joi.object({
  targetPlayerId: Joi.string().required(),
  expAmount: Joi.number().integer().min(1).max(100000).required(),
  reason: Joi.string().optional()
});

// Fonction d'aide pour la validation
const validateSchema = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: any) => {
    const { error } = schema.validate(req.body.paidGemsAmount ? req.body : { ...req.body, ...req.params, ...req.query });
    if (error) {
      return res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
    }
    next();
  };
};

// Middleware d'authentification pour toutes les routes VIP
router.use(authMiddleware);

// === ROUTES PRINCIPALES VIP ===

/**
 * GET /api/vip/status
 * Récupérer le statut VIP complet du joueur
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const playerId = req.userId!; // Utilise req.userId comme dans battle.ts
    const serverId = req.serverId || "S1"; // Utilise req.serverId comme dans battle.ts

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
router.post("/purchase", validateSchema(purchaseVipExpSchema), authMiddleware, requireFeature("vip_rewards"), async (req: Request, res: Response) => {
  try {
    const playerId = req.userId!;
    const serverId = req.serverId || "S1";
    const { paidGemsAmount } = req.body;

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
router.post("/daily-rewards/claim", authMiddleware, requireFeature("vip_rewards"), async (req: Request, res: Response) => {
  try {
    const playerId = req.userId!;
    const serverId = req.serverId || "S1";

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
    const playerId = req.userId!;
    const serverId = req.serverId || "S1";

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
router.get("/benefits/:benefitType", async (req: Request, res: Response) => {
  try {
    const playerId = req.userId!;
    const serverId = req.serverId || "S1";
    const { benefitType } = req.params;

    if (!benefitType) {
      return res.status(400).json({
        success: false,
        error: "Benefit type is required",
        code: "VALIDATION_ERROR"
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
router.get("/shop-price", async (req: Request, res: Response) => {
  try {
    const playerId = req.userId!;
    const serverId = req.serverId || "S1";
    const originalPrice = parseInt(req.query.originalPrice as string);

    if (!originalPrice || originalPrice < 1) {
      return res.status(400).json({
        success: false,
        error: "Original price must be a positive integer",
        code: "VALIDATION_ERROR"
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
    const playerId = req.userId!;
    const serverId = req.serverId || "S1";

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
    const playerId = req.userId!;
    const serverId = req.serverId || "S1";

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

// === ROUTES DE DEBUG/TEST ===

/**
 * GET /api/vip/debug/all-benefits
 * Lister tous les bénéfices VIP du joueur (debug)
 */
router.get("/debug/all-benefits", async (req: Request, res: Response) => {
  try {
    const playerId = req.userId!;
    const serverId = req.serverId || "S1";

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

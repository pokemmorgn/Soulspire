// server/src/routes/dailyRewards.ts

import express, { Request, Response } from "express";
import authMiddleware from "../middleware/authMiddleware";
import rateLimit from "express-rate-limit";
import { DailyRewardsService } from "../services/DailyRewardsService";

const router = express.Router();

// ===== RATE LIMITING =====

// Rate limit pour claim (éviter le spam)
const claimLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Max 5 tentatives par minute
  message: {
    success: false,
    error: "DAILY_REWARD_RATE_LIMIT", // "Too many claim attempts. Please wait."
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `daily_claim_${req.userId}_${req.serverId}`;
  }
});

// Rate limit général pour les autres endpoints
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 requêtes par minute
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED", // "Too many requests. Please slow down."
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `daily_general_${req.userId}_${req.serverId}`;
  }
});

// ===== ENDPOINTS JOUEUR =====

/**
 * @route   POST /api/daily-rewards/claim
 * @desc    Réclamer les récompenses quotidiennes
 * @access  Private
 */
router.post("/claim", authMiddleware, claimLimiter, async (req: Request, res: Response) => {
  try {
    const playerId = req.userId!;
    const serverId = req.serverId!;

    console.log(`🎁 POST /api/daily-rewards/claim - Player: ${playerId}, Server: ${serverId}`);

    const result = await DailyRewardsService.claimDailyReward(playerId, serverId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur POST /api/daily-rewards/claim:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR", // "Failed to claim daily reward"
      code: "CLAIM_FAILED"
    });
  }
});

/**
 * @route   GET /api/daily-rewards/status
 * @desc    Obtenir le statut actuel des daily rewards
 * @access  Private
 */
router.get("/status", authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  try {
    const playerId = req.userId!;
    const serverId = req.serverId!;

    console.log(`📊 GET /api/daily-rewards/status - Player: ${playerId}, Server: ${serverId}`);

    const result = await DailyRewardsService.getDailyRewardStatus(playerId, serverId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur GET /api/daily-rewards/status:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR", // "Failed to get daily reward status"
    });
  }
});

/**
 * @route   GET /api/daily-rewards/preview
 * @desc    Obtenir un aperçu des prochains jours de récompenses
 * @access  Private
 */
router.get("/preview", authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  try {
    const playerId = req.userId!;
    const serverId = req.serverId!;
    const daysAhead = parseInt(req.query.days as string) || 7;

    // Valider daysAhead
    if (daysAhead < 1 || daysAhead > 30) {
      return res.status(400).json({
        success: false,
        error: "INVALID_DAYS_PARAMETER", // "Days parameter must be between 1 and 30"
        code: "INVALID_PARAMETER"
      });
    }

    console.log(`👁️ GET /api/daily-rewards/preview - Player: ${playerId}, Days: ${daysAhead}`);

    const result = await DailyRewardsService.getRewardsPreview(playerId, serverId, daysAhead);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur GET /api/daily-rewards/preview:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR", // "Failed to get rewards preview"
    });
  }
});

/**
 * @route   GET /api/daily-rewards/leaderboard
 * @desc    Obtenir le leaderboard des streaks
 * @access  Private
 */
router.get("/leaderboard", authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  try {
    const serverId = req.serverId!;
    const limit = parseInt(req.query.limit as string) || 50;

    // Valider limit
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: "INVALID_LIMIT_PARAMETER", // "Limit must be between 1 and 100"
        code: "INVALID_PARAMETER"
      });
    }

    console.log(`🏆 GET /api/daily-rewards/leaderboard - Server: ${serverId}, Limit: ${limit}`);

    const result = await DailyRewardsService.getStreakLeaderboard(serverId, limit);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur GET /api/daily-rewards/leaderboard:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR", // "Failed to get leaderboard"
    });
  }
});

// ===== ENDPOINTS ADMIN =====

/**
 * @route   GET /api/daily-rewards/admin/stats
 * @desc    Obtenir les statistiques globales
 * @access  Private (Admin only - TODO: Add admin middleware)
 */
router.get("/admin/stats", authMiddleware, async (req: Request, res: Response) => {
  try {
    const serverId = req.query.serverId as string | undefined;

    console.log(`📊 GET /api/daily-rewards/admin/stats - Server: ${serverId || "ALL"}`);

    const result = await DailyRewardsService.getGlobalStats(serverId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur GET /api/daily-rewards/admin/stats:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR", // "Failed to get stats"
    });
  }
});

/**
 * @route   POST /api/daily-rewards/admin/reset
 * @desc    Déclencher manuellement le reset quotidien
 * @access  Private (Admin only - TODO: Add admin middleware)
 */
router.post("/admin/reset", authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`🔄 POST /api/daily-rewards/admin/reset - Manual reset triggered`);

    const result = await DailyRewardsService.performDailyReset();

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur POST /api/daily-rewards/admin/reset:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR", // "Failed to perform reset"
    });
  }
});

/**
 * @route   POST /api/daily-rewards/admin/cleanup
 * @desc    Nettoyer les daily rewards inactifs
 * @access  Private (Admin only - TODO: Add admin middleware)
 */
router.post("/admin/cleanup", authMiddleware, async (req: Request, res: Response) => {
  try {
    const daysInactive = parseInt(req.body.daysInactive) || 90;

    // Valider daysInactive
    if (daysInactive < 30 || daysInactive > 365) {
      return res.status(400).json({
        success: false,
        error: "INVALID_DAYS_PARAMETER", // "Days must be between 30 and 365"
        code: "INVALID_PARAMETER"
      });
    }

    console.log(`🧹 POST /api/daily-rewards/admin/cleanup - Days inactive: ${daysInactive}`);

    const result = await DailyRewardsService.cleanupInactive(daysInactive);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur POST /api/daily-rewards/admin/cleanup:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR", // "Failed to cleanup inactive rewards"
    });
  }
});

// ===== HEALTH CHECK =====

/**
 * @route   GET /api/daily-rewards/health
 * @desc    Vérifier la santé du système de daily rewards
 * @access  Public
 */
router.get("/health", async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "DailyRewards"
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      error: error.message
    });
  }
});

export default router;

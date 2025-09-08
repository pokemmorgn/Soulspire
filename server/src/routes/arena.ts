// server/src/routes/arena.ts

import express, { Request, Response } from "express";
import Joi from "joi";
import { ArenaService } from "../services/arena";
import { ArenaLeague, ArenaMatchType } from "../types/ArenaTypes";
import authMiddleware from "../middleware/authMiddleware";
import { requireFeature } from "../middleware/featureMiddleware";
import { 
  arenaMatchLimit, 
  arenaSearchLimit, 
  arenaRewardsLimit, 
  arenaGeneralLimit 
} from "../middleware/arenaRateLimit";

const router = express.Router();

// 🔒 Rate limiting général pour toutes les routes d'arène
router.use(arenaGeneralLimit);

// ===== SCHÉMAS DE VALIDATION =====

const battleOptionsSchema = Joi.object({
  mode: Joi.string().valid("auto", "manual").default("auto"),
  speed: Joi.number().valid(1, 2, 3).default(1)
});

const opponentSearchSchema = Joi.object({
  league: Joi.string().valid(...Object.values(ArenaLeague)).optional(),
  difficulty: Joi.string().valid("easy", "medium", "hard").optional(),
  onlineOnly: Joi.boolean().default(false),
  excludeRecent: Joi.boolean().default(true),
  minPower: Joi.number().min(0).optional(),
  maxPower: Joi.number().min(0).optional(),
  limit: Joi.number().min(1).max(20).default(10)
});

const matchSchema = Joi.object({
  defenderId: Joi.string().required(),
  matchType: Joi.string().valid(...Object.values(ArenaMatchType)).default("ranked"),
  battleOptions: battleOptionsSchema.default({ mode: "auto", speed: 1 })
});

const revengeMatchSchema = Joi.object({
  originalMatchId: Joi.string().required(),
  battleOptions: battleOptionsSchema.default({ mode: "auto", speed: 1 })
});

const leaderboardSchema = Joi.object({
  league: Joi.string().valid(...Object.values(ArenaLeague)).optional(),
  limit: Joi.number().min(1).max(100).default(50)
});

const historySchema = Joi.object({
  limit: Joi.number().min(1).max(50).default(20)
});

const seasonRewardsSchema = Joi.object({
  seasonId: Joi.string().required()
});

// ===== ROUTES D'INITIALISATION =====

/**
 * POST /api/arena/initialize
 * Initialiser un joueur dans l'arène
 */
router.post("/initialize", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`🏟️ Initialisation arène: ${req.userId} sur ${req.serverId}`);

    const result = await ArenaService.initializePlayer(req.userId!, req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        player: result.data,
        meta: result.meta
      });
    } else {
      res.status(400).json({
        error: result.error,
        code: "ARENA_INIT_FAILED"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /initialize:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "ARENA_INIT_ERROR"
    });
  }
});

/**
 * GET /api/arena/overview
 * Aperçu complet du système d'arène pour un joueur
 */
router.get("/overview", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ArenaService.getPlayerArenaOverview(req.userId!, req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(404).json({
        error: result.error,
        code: "ARENA_OVERVIEW_FAILED"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /overview:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "ARENA_OVERVIEW_ERROR"
    });
  }
});

// ===== ROUTES DE STATISTIQUES =====

/**
 * GET /api/arena/stats
 * Statistiques détaillées du joueur
 */
router.get("/stats", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ArenaService.getPlayerStats(req.userId!, req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        stats: result.data,
        meta: result.meta
      });
    } else {
      res.status(404).json({
        error: result.error,
        code: "ARENA_STATS_NOT_FOUND"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /stats:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "ARENA_STATS_ERROR"
    });
  }
});

/**
 * GET /api/arena/combat-stats
 * Statistiques de combat du joueur
 */
router.get("/combat-stats", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ArenaService.getPlayerCombatStats(req.userId!, req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        combatStats: result.data,
        message: result.message
      });
    } else {
      res.status(404).json({
        error: result.error,
        code: "COMBAT_STATS_NOT_FOUND"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /combat-stats:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "COMBAT_STATS_ERROR"
    });
  }
});

// ===== ROUTES DE RECHERCHE D'ADVERSAIRES =====

/**
 * GET /api/arena/opponents
 * Recherche d'adversaires avec filtres
 */
router.get("/opponents", authMiddleware, arenaSearchLimit, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = opponentSearchSchema.validate(req.query);
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    console.log(`🎯 Recherche adversaires: ${req.userId} avec filtres:`, value);

    const result = await ArenaService.findAdvancedOpponents(req.userId!, req.serverId!, {
      filters: {
        league: value.league,
        difficulty: value.difficulty,
        onlineOnly: value.onlineOnly,
        excludeRecent: value.excludeRecent,
        minPower: value.minPower,
        maxPower: value.maxPower
      },
      limit: value.limit
    });

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        meta: result.meta
      });
    } else {
      res.status(400).json({
        error: result.error,
        code: "OPPONENTS_SEARCH_FAILED",
        data: result.data
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /opponents:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "OPPONENTS_SEARCH_ERROR"
    });
  }
});

/**
 * GET /api/arena/opponents/recommended
 * Obtenir un adversaire recommandé
 */
router.get("/opponents/recommended", authMiddleware, arenaSearchLimit, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ArenaService.getRecommendedOpponent(req.userId!, req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        opponent: result.opponent,
        message: "Recommended opponent found"
      });
    } else {
      res.status(404).json({
        error: result.reason,
        code: "NO_RECOMMENDED_OPPONENT"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /opponents/recommended:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "RECOMMENDED_OPPONENT_ERROR"
    });
  }
});

/**
 * GET /api/arena/opponents/online
 * Recherche adversaires en ligne seulement
 */
router.get("/opponents/online", authMiddleware, arenaSearchLimit, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 8, 20);

    const result = await ArenaService.findOnlineOpponents(req.userId!, req.serverId!, limit);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: "Online opponents found"
      });
    } else {
      res.status(400).json({
        error: result.error,
        code: "ONLINE_OPPONENTS_FAILED"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /opponents/online:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "ONLINE_OPPONENTS_ERROR"
    });
  }
});

// ===== ROUTES DE COMBAT =====

/**
 * POST /api/arena/match
 * Démarrer un combat d'arène
 */
router.post("/match", authMiddleware, arenaMatchLimit, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = matchSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    console.log(`⚔️ Combat d'arène: ${req.userId} vs ${value.defenderId} (${value.matchType})`);

    const result = await ArenaService.startAdvancedMatch(
      req.userId!,
      req.serverId!,
      value.defenderId,
      value.matchType,
      value.battleOptions
    );

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message,
        meta: result.meta
      });
    } else {
      res.status(400).json({
        error: result.error,
        code: "ARENA_MATCH_FAILED"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /match:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "ARENA_MATCH_ERROR"
    });
  }
});

/**
 * POST /api/arena/match/revenge
 * Combat de vengeance
 */
router.post("/match/revenge", authMiddleware, arenaMatchLimit, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = revengeMatchSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    console.log(`🔥 Combat de vengeance: ${req.userId} pour match ${value.originalMatchId}`);

    const result = await ArenaService.startRevengeMatch(
      req.userId!,
      req.serverId!,
      value.originalMatchId,
      value.battleOptions
    );

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message,
        meta: result.meta
      });
    } else {
      res.status(400).json({
        error: result.error,
        code: "REVENGE_MATCH_FAILED"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /match/revenge:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "REVENGE_MATCH_ERROR"
    });
  }
});

/**
 * POST /api/arena/match/simulate
 * Simuler un combat
 */
router.post("/match/simulate", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { defenderId } = req.body;

    if (!defenderId) {
      res.status(400).json({
        error: "Defender ID is required",
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const result = await ArenaService.simulateMatch(req.userId!, req.serverId!, defenderId);

    if (result.success) {
      res.json({
        success: true,
        simulation: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        error: result.error,
        code: "MATCH_SIMULATION_FAILED"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /match/simulate:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "MATCH_SIMULATION_ERROR"
    });
  }
});

/**
 * POST /api/arena/match/:battleId/forfeit
 * Abandonner un combat
 */
router.post("/match/:battleId/forfeit", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { battleId } = req.params;

    if (!battleId) {
      res.status(400).json({
        error: "Battle ID is required",
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const result = await ArenaService.forfeitMatch(battleId, req.userId!, req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        error: result.error,
        code: "MATCH_FORFEIT_FAILED"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /match/forfeit:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "MATCH_FORFEIT_ERROR"
    });
  }
});

// ===== ROUTES D'HISTORIQUE ET VENGEANCE =====

/**
 * GET /api/arena/history
 * Historique des combats
 */
router.get("/history", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = historySchema.validate(req.query);
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const result = await ArenaService.getMatchHistory(req.userId!, req.serverId!, value.limit);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(404).json({
        error: result.error,
        code: "MATCH_HISTORY_NOT_FOUND"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /history:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "MATCH_HISTORY_ERROR"
    });
  }
});

/**
 * GET /api/arena/revenge
 * Combats de vengeance disponibles
 */
router.get("/revenge", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ArenaService.getAvailableRevengeMatches(req.userId!, req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(404).json({
        error: result.error,
        code: "REVENGE_MATCHES_NOT_FOUND"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /revenge:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "REVENGE_MATCHES_ERROR"
    });
  }
});

// ===== ROUTES DE CLASSEMENTS =====

/**
 * GET /api/arena/leaderboard
 * Classement de la saison actuelle
 */
router.get("/leaderboard", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = leaderboardSchema.validate(req.query);
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const result = await ArenaService.getCurrentSeasonLeaderboard(
      req.serverId!,
      value.league,
      value.limit
    );

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(404).json({
        error: result.error,
        code: "LEADERBOARD_NOT_FOUND"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /leaderboard:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "LEADERBOARD_ERROR"
    });
  }
});

// ===== ROUTES DE SAISONS =====

/**
 * GET /api/arena/season/current
 * Saison actuelle
 */
router.get("/season/current", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const season = await ArenaService.getCurrentSeason(req.serverId!);

    if (season) {
      res.json({
        success: true,
        season,
        message: "Current season retrieved"
      });
    } else {
      res.status(404).json({
        error: "No active season found",
        code: "SEASON_NOT_FOUND"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /season/current:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "SEASON_ERROR"
    });
  }
});

/**
 * GET /api/arena/season/history
 * Historique des saisons
 */
router.get("/season/history", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);

    const result = await ArenaService.getSeasonHistory(req.serverId!, limit);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(404).json({
        error: result.error,
        code: "SEASON_HISTORY_NOT_FOUND"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /season/history:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "SEASON_HISTORY_ERROR"
    });
  }
});

/**
 * GET /api/arena/season/:seasonId/stats
 * Statistiques d'une saison spécifique
 */
router.get("/season/:seasonId/stats", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { seasonId } = req.params;

    const result = await ArenaService.getSeasonStats(req.serverId!, seasonId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(404).json({
        error: result.error,
        code: "SEASON_STATS_NOT_FOUND"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /season/stats:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "SEASON_STATS_ERROR"
    });
  }
});

// ===== ROUTES DE RÉCOMPENSES =====

/**
 * GET /api/arena/rewards
 * Résumé de toutes les récompenses
 */
router.get("/rewards", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ArenaService.getRewardsSummary(req.userId!, req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(404).json({
        error: result.error,
        code: "REWARDS_SUMMARY_NOT_FOUND"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /rewards:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "REWARDS_SUMMARY_ERROR"
    });
  }
});

/**
 * POST /api/arena/rewards/daily/claim
 * Réclamer récompenses quotidiennes
 */
router.post("/rewards/daily/claim", authMiddleware, arenaRewardsLimit, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`💰 Réclamation récompenses quotidiennes: ${req.userId} sur ${req.serverId}`);

    const result = await ArenaService.claimDailyRewards(req.userId!, req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        error: result.error,
        code: "DAILY_REWARDS_CLAIM_FAILED",
        data: result.data
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /rewards/daily/claim:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "DAILY_REWARDS_CLAIM_ERROR"
    });
  }
});

/**
 * GET /api/arena/rewards/daily/preview
 * Aperçu récompenses quotidiennes
 */
router.get("/rewards/daily/preview", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ArenaService.getDailyRewardsPreview(req.userId!, req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(404).json({
        error: result.error,
        code: "DAILY_REWARDS_PREVIEW_FAILED"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /rewards/daily/preview:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "DAILY_REWARDS_PREVIEW_ERROR"
    });
  }
});

/**
 * POST /api/arena/rewards/weekly/claim
 * Réclamer récompenses hebdomadaires
 */
router.post("/rewards/weekly/claim", authMiddleware, arenaRewardsLimit, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`🏆 Réclamation récompenses hebdomadaires: ${req.userId} sur ${req.serverId}`);

    const result = await ArenaService.claimWeeklyRewards(req.userId!, req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        error: result.error,
        code: "WEEKLY_REWARDS_CLAIM_FAILED",
        data: result.data
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /rewards/weekly/claim:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "WEEKLY_REWARDS_CLAIM_ERROR"
    });
  }
});

/**
 * POST /api/arena/rewards/season/claim
 * Réclamer récompenses de fin de saison
 */
router.post("/rewards/season/claim", authMiddleware, arenaRewardsLimit, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = seasonRewardsSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    console.log(`🎯 Réclamation récompenses saison ${value.seasonId}: ${req.userId} sur ${req.serverId}`);

    const result = await ArenaService.claimSeasonEndRewards(req.userId!, req.serverId!, value.seasonId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        error: result.error,
        code: "SEASON_REWARDS_CLAIM_FAILED"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /rewards/season/claim:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "SEASON_REWARDS_CLAIM_ERROR"
    });
  }
});

// ===== ROUTES D'ADMINISTRATION =====

/**
 * GET /api/arena/server/stats
 * Statistiques globales du serveur (admin)
 */
router.get("/server/stats", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ArenaService.getServerArenaStats(req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(404).json({
        error: result.error,
        code: "SERVER_STATS_NOT_FOUND"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /server/stats:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "SERVER_STATS_ERROR"
    });
  }
});

/**
 * GET /api/arena/matchmaking/stats
 * Statistiques de matchmaking
 */
router.get("/matchmaking/stats", authMiddleware, requireFeature("arena"), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ArenaService.getMatchmakingStats(req.serverId!);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: "Matchmaking statistics retrieved"
      });
    } else {
      res.status(404).json({
        error: result.error,
        code: "MATCHMAKING_STATS_NOT_FOUND"
      });
    }

  } catch (error: any) {
    console.error("❌ Erreur route /matchmaking/stats:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "MATCHMAKING_STATS_ERROR"
    });
  }
});

export default router;

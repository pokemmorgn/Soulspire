import { Router, Request, Response } from "express";
import { LeaderboardService } from "../services/LeaderboardService";
import authMiddleware from "../middleware/authMiddleware";
import touchLastSeen from "../middleware/touchLastSeen";

const router = Router();

// Middleware pour toutes les routes (authentification + touch last seen)
router.use(authMiddleware);
router.use(touchLastSeen);

// === CLASSEMENTS PAR SERVEUR ===

/**
 * GET /api/leaderboard/power/:serverId
 * Classement par puissance totale sur un serveur
 */
router.get("/power/:serverId", async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const playerId = req.query.playerId as string;

    if (limit > 100) {
      return res.status(400).json({
        success: false,
        error: "Limit cannot exceed 100",
        code: "LIMIT_TOO_HIGH"
      });
    }

    const result = await LeaderboardService.getPowerLeaderboard(serverId, limit, playerId);
    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur power leaderboard:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch power leaderboard",
      code: "POWER_LEADERBOARD_ERROR"
    });
  }
});

/**
 * GET /api/leaderboard/tower/:serverId
 * Classement de la tour sur un serveur
 */
router.get("/tower/:serverId", async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const playerId = req.query.playerId as string;

    const result = await LeaderboardService.getTowerLeaderboard(serverId, limit, playerId);
    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur tower leaderboard:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch tower leaderboard",
      code: "TOWER_LEADERBOARD_ERROR"
    });
  }
});

/**
 * GET /api/leaderboard/campaign/:serverId
 * Classement de progression campagne sur un serveur
 */
router.get("/campaign/:serverId", async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const playerId = req.query.playerId as string;

    const result = await LeaderboardService.getCampaignLeaderboard(serverId, limit, playerId);
    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur campaign leaderboard:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch campaign leaderboard",
      code: "CAMPAIGN_LEADERBOARD_ERROR"
    });
  }
});

/**
 * GET /api/leaderboard/afk/:serverId
 * Classement des gains AFK sur un serveur
 */
router.get("/afk/:serverId", async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const playerId = req.query.playerId as string;
    const period = (req.query.period as "daily" | "weekly" | "total") || "daily";

    if (!["daily", "weekly", "total"].includes(period)) {
      return res.status(400).json({
        success: false,
        error: "Period must be 'daily', 'weekly', or 'total'",
        code: "INVALID_PERIOD"
      });
    }

    const result = await LeaderboardService.getAfkLeaderboard(serverId, limit, playerId, period);
    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur afk leaderboard:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch AFK leaderboard",
      code: "AFK_LEADERBOARD_ERROR"
    });
  }
});

/**
 * GET /api/leaderboard/level/:serverId
 * Classement par niveau joueur sur un serveur
 */
router.get("/level/:serverId", async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const playerId = req.query.playerId as string;

    const result = await LeaderboardService.getLevelLeaderboard(serverId, limit, playerId);
    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur level leaderboard:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch level leaderboard",
      code: "LEVEL_LEADERBOARD_ERROR"
    });
  }
});

// === CLASSEMENTS GLOBAUX (CROSS-SERVER) ===

/**
 * GET /api/leaderboard/global/:type
 * Classements globaux tous serveurs confondus
 */
router.get("/global/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!["power", "tower", "level"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "Type must be 'power', 'tower', or 'level'",
        code: "INVALID_GLOBAL_TYPE"
      });
    }

    if (limit > 200) {
      return res.status(400).json({
        success: false,
        error: "Global leaderboard limit cannot exceed 200",
        code: "GLOBAL_LIMIT_TOO_HIGH"
      });
    }

    const result = await LeaderboardService.getGlobalLeaderboard(
      type as "power" | "tower" | "level", 
      limit
    );
    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur global leaderboard:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch global leaderboard",
      code: "GLOBAL_LEADERBOARD_ERROR"
    });
  }
});

// === RÉSUMÉ JOUEUR ===

/**
 * GET /api/leaderboard/player/:playerId/:serverId
 * Résumé de tous les classements pour un joueur spécifique
 */
router.get("/player/:playerId/:serverId", async (req: Request, res: Response) => {
  try {
    const { playerId, serverId } = req.params;

    const result = await LeaderboardService.getPlayerRankingSummary(playerId, serverId);
    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur player ranking summary:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch player ranking summary",
      code: "PLAYER_RANKING_ERROR"
    });
  }
});

/**
 * GET /api/leaderboard/my-ranks/:serverId
 * Résumé des classements pour le joueur connecté
 */
router.get("/my-ranks/:serverId", async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const playerId = (req as any).user.playerId;

    if (!playerId) {
      return res.status(401).json({
        success: false,
        error: "Player ID not found in token",
        code: "PLAYER_ID_MISSING"
      });
    }

    const result = await LeaderboardService.getPlayerRankingSummary(playerId, serverId);
    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur my ranks:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch your rankings",
      code: "MY_RANKS_ERROR"
    });
  }
});

// === ROUTES D'ADMINISTRATION ===

/**
 * POST /api/leaderboard/admin/precompute/:serverId
 * Précomputer les classements d'un serveur (optimisation)
 */
router.post("/admin/precompute/:serverId", async (req: Request, res: Response) => {
  try {
    // TODO: Ajouter vérification admin
    const { serverId } = req.params;

    const result = await LeaderboardService.precomputeLeaderboards(serverId);
    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur precompute leaderboards:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to precompute leaderboards",
      code: "PRECOMPUTE_ERROR"
    });
  }
});

/**
 * GET /api/leaderboard/admin/stats/:serverId
 * Statistiques des classements d'un serveur
 */
router.get("/admin/stats/:serverId", async (req: Request, res: Response) => {
  try {
    // TODO: Ajouter vérification admin
    const { serverId } = req.params;

    const result = await LeaderboardService.getLeaderboardStats(serverId);
    res.json(result);

  } catch (error: any) {
    console.error("❌ Erreur leaderboard stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch leaderboard stats",
      code: "LEADERBOARD_STATS_ERROR"
    });
  }
});

// === ROUTES UTILITAIRES ===

/**
 * GET /api/leaderboard/types
 * Liste des types de classements disponibles
 */
router.get("/types", async (req: Request, res: Response) => {
  try {
    const leaderboardTypes = {
      server: [
        {
          type: "power",
          name: "Power Ranking",
          description: "Total power based on heroes and level",
          endpoint: "/power/:serverId"
        },
        {
          type: "tower",
          name: "Tower Progress",
          description: "Highest floor reached in tower",
          endpoint: "/tower/:serverId"
        },
        {
          type: "campaign",
          name: "Campaign Progress",
          description: "World progression and stars earned",
          endpoint: "/campaign/:serverId"
        },
        {
          type: "afk",
          name: "AFK Gains",
          description: "Gold earned through AFK farming",
          endpoint: "/afk/:serverId"
        },
        {
          type: "level",
          name: "Player Level",
          description: "Player level ranking",
          endpoint: "/level/:serverId"
        }
      ],
      global: [
        {
          type: "power",
          name: "Global Power",
          description: "Cross-server power ranking",
          endpoint: "/global/power"
        },
        {
          type: "tower",
          name: "Global Tower",
          description: "Cross-server tower ranking",
          endpoint: "/global/tower"
        },
        {
          type: "level",
          name: "Global Level",
          description: "Cross-server level ranking",
          endpoint: "/global/level"
        }
      ]
    };

    res.json({
      success: true,
      leaderboardTypes,
      totalTypes: leaderboardTypes.server.length + leaderboardTypes.global.length
    });

  } catch (error: any) {
    console.error("❌ Erreur leaderboard types:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch leaderboard types",
      code: "LEADERBOARD_TYPES_ERROR"
    });
  }
});

/**
 * GET /api/leaderboard/server-list
 * Liste des serveurs avec statistiques de classement
 */
router.get("/server-list", async (req: Request, res: Response) => {
  try {
    // TODO: Implémenter récupération liste serveurs avec stats
    // Pour l'instant, retour simple
    
    res.json({
      success: true,
      message: "Server list with leaderboard stats - to be implemented",
      servers: []
    });

  } catch (error: any) {
    console.error("❌ Erreur server list:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch server list",
      code: "SERVER_LIST_ERROR"
    });
  }
});

export default router;

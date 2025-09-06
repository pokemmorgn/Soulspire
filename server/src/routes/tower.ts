import express, { Request, Response } from "express";
import Joi from "joi";
import { TowerService } from "../services/TowerService";
import authMiddleware from "../middleware/authMiddleware";
import { requireFeature } from "../middleware/featureMiddleware";
const router = express.Router();

// Schémas de validation
const startRunSchema = Joi.object({
  heroTeam: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .max(4)
    .required()
    .messages({
      'array.min': 'At least 1 hero is required',
      'array.max': 'Maximum 4 heroes allowed',
      'any.required': 'Hero team is required'
    })
});

const leaderboardSchema = Joi.object({
  limit: Joi.number().min(1).max(100).default(50)
});

// === DÉMARRER UN RUN DE TOUR ===
router.post("/start", authMiddleware, requireFeature("tower"), async (req: Request, res: Response): Promise<void> => {

  try {
    const { error } = startRunSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { heroTeam } = req.body;
    
    console.log(`🗼 ${req.userId} démarre un run tour avec ${heroTeam.length} héros`);

    const result = await TowerService.startTowerRun(
      req.userId!,
      req.serverId!,
      heroTeam
    );

    if (!result.success) {
      res.status(400).json({ 
        error: result.message,
        code: "TOWER_START_FAILED",
        currentRun: result.currentRun
      });
      return;
    }

    res.json({
      message: result.message,
      currentRun: result.currentRun,
      startFloor: result.startFloor,
      highestFloor: result.highestFloor
    });

  } catch (err: any) {
    console.error("Start tower run error:", err);
    
    if (err.message === "Player not found on this server") {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }
    
    if (err.message.includes("Invalid team size")) {
      res.status(400).json({ 
        error: err.message,
        code: "INVALID_TEAM_SIZE"
      });
      return;
    }
    
    if (err.message.includes("not owned")) {
      res.status(400).json({ 
        error: "Some heroes are not owned by the player",
        code: "HEROES_NOT_OWNED"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "TOWER_START_FAILED"
    });
  }
});

// === COMBATTRE L'ÉTAGE ACTUEL ===
router.post("/fight", authMiddleware, requireFeature("tower"), async (req: Request, res: Response): Promise<void> => {

  try {
    console.log(`⚔️ ${req.userId} combat d'étage tour`);

    const result = await TowerService.fightFloor(
      req.userId!,
      req.serverId!
    );

    res.json({
      message: result.victory ? "Floor cleared successfully!" : "Floor battle completed",
      victory: result.victory,
      currentFloor: result.currentFloor,
      finalFloor: result.finalFloor,
      rewards: result.rewards,
      specialReward: result.specialReward,
      battleResult: {
        totalTurns: result.battleResult.totalTurns,
        battleDuration: result.battleResult.battleDuration,
        stats: result.battleResult.stats
      },
      nextFloorAvailable: result.nextFloorAvailable,
      runCompleted: result.runCompleted,
      totalRewards: result.totalRewards
    });

  } catch (err: any) {
    console.error("Tower fight error:", err);
    
    if (err.message === "No active tower run found") {
      res.status(400).json({ 
        error: "No active tower run found. Start a new run first.",
        code: "NO_ACTIVE_RUN"
      });
      return;
    }
    
    if (err.message === "Player not found") {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "TOWER_FIGHT_FAILED"
    });
  }
});

// === ABANDONNER LE RUN ACTUEL ===
router.post("/abandon", authMiddleware, requireFeature("tower"), async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`🚪 ${req.userId} abandonne son run tour`);

    const result = await TowerService.abandonRun(
      req.userId!,
      req.serverId!
    );

    res.json({
      message: result.message,
      finalFloor: result.finalFloor,
      rewards: result.rewards
    });

  } catch (err: any) {
    console.error("Tower abandon error:", err);
    
    if (err.message === "No active tower run found") {
      res.status(400).json({ 
        error: "No active tower run to abandon",
        code: "NO_ACTIVE_RUN"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "TOWER_ABANDON_FAILED"
    });
  }
});

// === RÉCUPÉRER LA PROGRESSION DU JOUEUR ===
router.get("/progress", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const progress = await TowerService.getPlayerProgress(
      req.userId!,
      req.serverId!
    );

    if (!progress.hasProgress) {
      res.json({
        message: "No tower progress found",
        hasProgress: false,
        suggestion: "Start your first tower run to begin!"
      });
      return;
    }

    res.json({
      message: "Tower progress retrieved successfully",
      hasProgress: true,
      currentFloor: progress.currentFloor,
      highestFloor: progress.highestFloor,
      totalClears: progress.totalClears,
      currentRun: progress.currentRun,
      stats: progress.stats,
      rewards: progress.rewards,
      recentRuns: progress.runHistory,
      playerRank: progress.playerRank
    });

  } catch (err) {
    console.error("Get tower progress error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_TOWER_PROGRESS_FAILED"
    });
  }
});

// === CLASSEMENT DU SERVEUR ===
router.get("/leaderboard", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = leaderboardSchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { limit } = req.query;
    const limitNum = parseInt(limit as string) || 50;

    const result = await TowerService.getServerLeaderboard(req.serverId!, limitNum);

    res.json({
      message: "Tower leaderboard retrieved successfully",
      leaderboard: result.leaderboard,
      serverInfo: result.serverInfo,
      playerCount: result.leaderboard.length
    });

  } catch (err) {
    console.error("Get tower leaderboard error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_TOWER_LEADERBOARD_FAILED"
    });
  }
});

// === STATISTIQUES GLOBALES DE LA TOUR ===
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await TowerService.getTowerStats(req.serverId!);

    res.json({
      message: "Tower statistics retrieved successfully",
      serverId: stats.serverId,
      globalStats: {
        totalPlayers: stats.stats.totalPlayers,
        averageFloor: stats.stats.averageFloor,
        highestFloor: stats.stats.maxFloor,
        totalClears: stats.stats.totalClears
      }
    });

  } catch (err) {
    console.error("Get tower stats error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_TOWER_STATS_FAILED"
    });
  }
});

// === INFORMATIONS SUR UN ÉTAGE SPÉCIFIQUE ===
router.get("/floor/:floorNumber", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const floorNumber = parseInt(req.params.floorNumber);
    
    if (isNaN(floorNumber) || floorNumber < 1 || floorNumber > 1000) {
      res.status(400).json({ 
        error: "Invalid floor number (1-1000)",
        code: "INVALID_FLOOR_NUMBER"
      });
      return;
    }

    // Utiliser la configuration statique des étages
    const { TowerFloorConfig } = await import("../models/Tower");
    const floorConfig = TowerFloorConfig.getFloorConfig(floorNumber);

    res.json({
      message: "Floor information retrieved successfully",
      floor: floorNumber,
      config: {
        isBossFloor: floorConfig.enemyConfig.bossFloor,
        enemyCount: floorConfig.enemyConfig.enemyCount,
        enemyLevel: floorConfig.enemyConfig.baseLevel,
        specialRules: floorConfig.enemyConfig.specialRules || [],
        rewards: {
          baseGold: floorConfig.rewards.baseGold,
          baseExp: floorConfig.rewards.baseExp,
          dropItems: floorConfig.rewards.dropItems || [],
          firstClearBonus: floorConfig.rewards.firstClearBonus
        },
        difficultyMultiplier: floorConfig.difficultyMultiplier
      }
    });

  } catch (err) {
    console.error("Get floor info error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_FLOOR_INFO_FAILED"
    });
  }
});

// === ROUTE DE TEST (développement uniquement) ===
router.post("/test", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV === "production") {
      res.status(404).json({ error: "Not available in production" });
      return;
    }

    console.log(`🧪 Test tour pour ${req.userId}`);

    // Simuler un combat rapide avec héros par défaut
    const testHeroes = ["hero1", "hero2", "hero3"]; // IDs factices pour le test
    
    // Démarrer un run de test
    const startResult = await TowerService.startTowerRun(
      req.userId!,
      req.serverId!,
      testHeroes
    );

    if (!startResult.success) {
      res.json({
        message: "Test tower run failed to start",
        error: startResult.message,
        note: "This is a test endpoint - make sure you have heroes equipped"
      });
      return;
    }

    res.json({
      message: "Test tower run started successfully",
      testData: {
        startFloor: startResult.startFloor,
        currentRun: startResult.currentRun
      },
      note: "Use POST /api/tower/fight to test combat",
      availableEndpoints: [
        "POST /api/tower/fight - Combat test",
        "GET /api/tower/progress - Voir progression",
        "POST /api/tower/abandon - Abandonner le test"
      ]
    });

  } catch (err: any) {
    console.error("Test tower error:", err);
    res.status(500).json({ 
      error: err.message,
      code: "TEST_TOWER_FAILED"
    });
  }
});

export default router;

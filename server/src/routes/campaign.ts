import express, { Request, Response } from "express";
import Joi from "joi";
import { CampaignService } from "../services/CampaignService";
import authMiddleware from "../middleware/authMiddleware";
import { requireFeature } from "../middleware/featureMiddleware";
import { FeatureUnlockService } from "../services/FeatureUnlockService";
const router = express.Router();

// Schémas de validation
const worldFilterSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(50).default(20)
});

const worldDetailsSchema = Joi.object({
  worldId: Joi.number().min(1).required()
});

const battleSchema = Joi.object({
  worldId: Joi.number().min(1).required(),
  levelIndex: Joi.number().min(1).required(),
  difficulty: Joi.string().valid("Normal", "Hard", "Nightmare").default("Normal")
});

const createWorldSchema = Joi.object({
  worldId: Joi.number().min(1).required(),
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).optional(),
  mapTheme: Joi.string().max(50).optional(),
  levelCount: Joi.number().min(1).max(50).required(),
  minPlayerLevel: Joi.number().min(1).required(),
  recommendedPower: Joi.number().min(0).optional(),
  elementBias: Joi.array().items(
    Joi.string().valid("Fire", "Water", "Wind", "Electric", "Light", "Dark")
  ).optional(),
  levels: Joi.array().items(
    Joi.object({
      levelIndex: Joi.number().min(1).required(),
      name: Joi.string().required(),
      enemyType: Joi.string().valid("normal", "elite", "boss").optional(),
      enemyCount: Joi.number().min(1).max(5).optional(),
      difficultyMultiplier: Joi.number().min(0.1).max(10).optional(),
      staminaCost: Joi.number().min(1).max(20).optional(),
      rewards: Joi.object({
        experience: Joi.number().min(0).optional(),
        gold: Joi.number().min(0).optional(),
        items: Joi.array().items(Joi.string()).optional(),
        fragments: Joi.array().items(
          Joi.object({
            heroId: Joi.string().required(),
            quantity: Joi.number().min(1).required()
          })
        ).optional()
      }).optional()
    })
  ).optional()
});

// === GET ALL CAMPAIGN WORLDS ===
router.get("/worlds", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = worldFilterSchema.validate(req.query);
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    console.log("🗺️ Récupération de tous les mondes de campagne");

    const result = await CampaignService.getAllWorlds();

    res.json({
      message: "Campaign worlds retrieved successfully",
      worlds: result.worlds,
      totalWorlds: result.totalWorlds
    });

  } catch (err: any) {
    console.error("Get campaign worlds error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "GET_CAMPAIGN_WORLDS_FAILED"
    });
  }
});

// === GET PLAYER CAMPAIGN DATA ===
router.get("/progress", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`🎯 Récupération données campagne pour ${req.userId}`);

    const result = await CampaignService.getPlayerCampaignData(req.userId!, req.serverId!);

    res.json({
      message: "Player campaign data retrieved successfully",
      playerLevel: result.playerLevel,
      campaignData: result.campaignData,
      globalStats: result.globalStats
    });

  } catch (err: any) {
    console.error("Get player campaign data error:", err);
    
    if (err.message === "Player not found on this server") {
      res.status(404).json({
        error: "Player not found on this server",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      code: "GET_PLAYER_CAMPAIGN_DATA_FAILED"
    });
  }
});

// === GET WORLD DETAILS ===
router.get("/worlds/:worldId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = worldDetailsSchema.validate({ worldId: parseInt(req.params.worldId) });
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const worldId = parseInt(req.params.worldId);
    console.log(`🏰 Récupération détails monde ${worldId} pour ${req.userId}`);

    const result = await CampaignService.getWorldDetails(worldId, req.userId!, req.serverId!);

    if (!result.success) {
      res.status(403).json({
        error: result.message,
        code: "WORLD_LOCKED",
        requirements: (result as any).requirements
      });
      return;
    }

    res.json({
      message: "World details retrieved successfully",
      world: result.world,
      playerProgress: result.playerProgress
    });

  } catch (err: any) {
    console.error("Get world details error:", err);
    
    if (err.message === "World not found") {
      res.status(404).json({
        error: "World not found",
        code: "WORLD_NOT_FOUND"
      });
      return;
    }

    if (err.message === "Player not found on this server") {
      res.status(404).json({
        error: "Player not found on this server",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      code: "GET_WORLD_DETAILS_FAILED"
    });
  }
});

// === START CAMPAIGN BATTLE ===
router.post("/battle", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = battleSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { worldId, levelIndex, difficulty } = req.body;
    
    // Protection pour les difficultés avancées
    if (difficulty === "Hard") {
      try {
        await FeatureUnlockService.validateFeatureAccess(req.userId!, req.serverId!, "campaign_hard");
      } catch (error: any) {
        res.status(403).json({
          error: error.message,
          code: "FEATURE_LOCKED",
          featureId: "campaign_hard"
        });
        return;
      }
    }
    
    if (difficulty === "Nightmare") {
      try {
        await FeatureUnlockService.validateFeatureAccess(req.userId!, req.serverId!, "campaign_nightmare");
      } catch (error: any) {
        res.status(403).json({
          error: error.message,
          code: "FEATURE_LOCKED",
          featureId: "campaign_nightmare"
        });
        return;
      }
    }
    
    console.log(`⚔️ ${req.userId} démarre combat: Monde ${worldId}, Niveau ${levelIndex}, ${difficulty}`);

    // Vérifier d'abord si le joueur peut jouer ce niveau
    const canPlay = await CampaignService.canPlayerPlayLevel(
      req.userId!,
      req.serverId!,
      worldId,
      levelIndex,
      difficulty
    );

    if (!canPlay.allowed) {
      res.status(403).json({
        error: canPlay.reason,
        code: "LEVEL_LOCKED"
      });
      return;
    }

    // Démarrer le combat
    const battleResult = await CampaignService.startCampaignBattle(
      req.userId!,
      req.serverId!,
      worldId,
      levelIndex,
      difficulty
    );

    res.json({
      message: "Campaign battle completed",
      battleResult: battleResult.battleResult,
      worldId: battleResult.worldId,
      levelIndex: battleResult.levelIndex,
      difficulty: battleResult.difficulty
    });

  } catch (err: any) {
    console.error("Campaign battle error:", err);
    
    if (err.message === "Player not found on this server") {
      res.status(404).json({
        error: "Player not found on this server",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }
    
    if (err.message === "World not found") {
      res.status(404).json({
        error: "World not found",
        code: "WORLD_NOT_FOUND"
      });
      return;
    }
    
    if (err.message === "Level not found") {
      res.status(404).json({
        error: "Level not found in this world",
        code: "LEVEL_NOT_FOUND"
      });
      return;
    }

    if (err.message === "No equipped heroes found") {
      res.status(400).json({
        error: "You must equip at least one hero before battle",
        code: "NO_EQUIPPED_HEROES"
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      code: "CAMPAIGN_BATTLE_FAILED"
    });
  }
});

// === CHECK LEVEL ACCESS ===
router.get("/worlds/:worldId/levels/:levelIndex/access", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const worldId = parseInt(req.params.worldId);
    const levelIndex = parseInt(req.params.levelIndex);
    const difficulty = (req.query.difficulty as string) || "Normal";

    if (!worldId || !levelIndex) {
      res.status(400).json({
        error: "Invalid worldId or levelIndex",
        code: "INVALID_PARAMETERS"
      });
      return;
    }

    if (!["Normal", "Hard", "Nightmare"].includes(difficulty)) {
      res.status(400).json({
        error: "Invalid difficulty. Must be Normal, Hard, or Nightmare",
        code: "INVALID_DIFFICULTY"
      });
      return;
    }

    console.log(`🔒 Vérification accès niveau ${worldId}-${levelIndex} (${difficulty}) pour ${req.userId}`);

    const canPlay = await CampaignService.canPlayerPlayLevel(
      req.userId!,
      req.serverId!,
      worldId,
      levelIndex,
      difficulty as "Normal" | "Hard" | "Nightmare"
    );

    res.json({
      message: "Level access checked",
      worldId,
      levelIndex,
      difficulty,
      canPlay: canPlay.allowed,
      reason: canPlay.reason || null
    });

  } catch (err: any) {
    console.error("Check level access error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "CHECK_LEVEL_ACCESS_FAILED"
    });
  }
});

// === GET CAMPAIGN STATISTICS ===
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const serverId = req.query.global === "true" ? undefined : req.serverId!;
    
    console.log(`📊 Récupération stats campagne pour serveur ${serverId || "ALL"}`);

    const stats = await CampaignService.getCampaignStats(serverId);

    res.json({
      message: "Campaign statistics retrieved successfully",
      stats: stats.worldStats,
      serverId: stats.serverId
    });

  } catch (err: any) {
    console.error("Get campaign stats error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "GET_CAMPAIGN_STATS_FAILED"
    });
  }
});

// === GET DIFFICULTY UNLOCK STATUS ===
router.get("/difficulties", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`🔓 Vérification difficultés débloquées pour ${req.userId}`);

    // Vérifier chaque difficulté
    const [normalCompleted, hardCompleted] = await Promise.all([
      CampaignService.hasPlayerCompletedCampaign(req.userId!, req.serverId!, "Normal"),
      CampaignService.hasPlayerCompletedCampaign(req.userId!, req.serverId!, "Hard")
    ]);

    const difficultyStatus = {
      Normal: {
        unlocked: true,
        completed: normalCompleted,
        description: "Standard difficulty"
      },
      Hard: {
        unlocked: normalCompleted,
        completed: hardCompleted,
        description: normalCompleted ? 
          "Unlocked! Higher enemy stats" : 
          "Complete the entire campaign on Normal to unlock"
      },
      Nightmare: {
        unlocked: hardCompleted,
        completed: false, // TODO: Implémenter si nécessaire
        description: hardCompleted ? 
          "Unlocked! Maximum challenge" : 
          "Complete the entire campaign on Hard to unlock"
      }
    };

    res.json({
      message: "Difficulty status retrieved successfully",
      difficulties: difficultyStatus,
      summary: {
        availableDifficulties: Object.keys(difficultyStatus).filter(
          key => (difficultyStatus as any)[key].unlocked
        ),
        nextUnlock: !normalCompleted ? "Hard" : !hardCompleted ? "Nightmare" : null
      }
    });

  } catch (err: any) {
    console.error("Get difficulty status error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "GET_DIFFICULTY_STATUS_FAILED"
    });
  }
});

// === ADMIN ROUTES ===

// CREATE NEW WORLD (Admin only)
router.post("/admin/worlds", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    
    const { error } = createWorldSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    console.log(`🏗️ Création nouveau monde par ${req.userId}`);

    const result = await CampaignService.createWorld(req.body);

    res.status(201).json({
      message: "World created successfully",
      world: result.world
    });

  } catch (err: any) {
    console.error("Create world error:", err);
    
    if (err.code === 11000) {
      res.status(400).json({
        error: "World with this ID already exists",
        code: "WORLD_ALREADY_EXISTS"
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      code: "CREATE_WORLD_FAILED"
    });
  }
});

// GET SERVER CAMPAIGN STATISTICS (Admin)
router.get("/admin/stats/:serverId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    
    const { serverId } = req.params;
    
    if (!serverId.match(/^S\d+$/)) {
      res.status(400).json({
        error: "Invalid server ID format",
        code: "INVALID_SERVER_ID"
      });
      return;
    }

    console.log(`📈 Stats admin campagne serveur ${serverId}`);

    const stats = await CampaignService.getCampaignStats(serverId);

    res.json({
      message: "Server campaign statistics retrieved",
      serverId,
      stats: stats.worldStats
    });

  } catch (err: any) {
    console.error("Get server campaign stats error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "GET_SERVER_CAMPAIGN_STATS_FAILED"
    });
  }
});

// === QUICK ACCESS ROUTES ===

// GET NEXT AVAILABLE LEVEL
router.get("/next", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`➡️ Récupération prochain niveau pour ${req.userId}`);

    const campaignData = await CampaignService.getPlayerCampaignData(req.userId!, req.serverId!);
    
    // Trouver le prochain niveau disponible
    let nextLevel = null;
    
    for (const world of campaignData.campaignData) {
      if (world.isUnlocked && world.nextLevelAvailable) {
        nextLevel = {
          worldId: world.worldId,
          worldName: world.name,
          levelIndex: world.nextLevelAvailable,
          difficulty: "Normal",
          recommendedPower: world.recommendedPower,
          elementBias: world.elementBias
        };
        break;
      }
    }

    if (!nextLevel) {
      res.json({
        message: "No next level available",
        hasNextLevel: false,
        suggestion: "All available content completed!"
      });
      return;
    }

    res.json({
      message: "Next level found",
      hasNextLevel: true,
      nextLevel
    });

  } catch (err: any) {
    console.error("Get next level error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "GET_NEXT_LEVEL_FAILED"
    });
  }
});

// QUICK BATTLE (Next available level)
router.post("/quick-battle", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`⚡ Combat rapide campagne pour ${req.userId}`);

    const campaignData = await CampaignService.getPlayerCampaignData(req.userId!, req.serverId!);
    
    // Trouver le prochain niveau
    let nextLevel = null;
    for (const world of campaignData.campaignData) {
      if (world.isUnlocked && world.nextLevelAvailable) {
        nextLevel = {
          worldId: world.worldId,
          levelIndex: world.nextLevelAvailable
        };
        break;
      }
    }

    if (!nextLevel) {
      res.status(400).json({
        error: "No level available for quick battle",
        code: "NO_LEVEL_AVAILABLE"
      });
      return;
    }

    // Démarrer le combat
    const battleResult = await CampaignService.startCampaignBattle(
      req.userId!,
      req.serverId!,
      nextLevel.worldId,
      nextLevel.levelIndex,
      "Normal"
    );

    res.json({
      message: "Quick campaign battle completed",
      battleResult: battleResult.battleResult,
      level: {
        worldId: nextLevel.worldId,
        levelIndex: nextLevel.levelIndex,
        difficulty: "Normal"
      }
    });

  } catch (err: any) {
    console.error("Quick campaign battle error:", err);
    
    if (err.message === "No equipped heroes found") {
      res.status(400).json({
        error: "Please equip at least one hero first",
        code: "NO_EQUIPPED_HEROES",
        suggestion: "Use POST /api/heroes/equip to equip a hero"
      });
      return;
    }

    res.status(500).json({
      error: "Quick campaign battle failed",
      code: "QUICK_CAMPAIGN_BATTLE_FAILED"
    });
  }
});

export default router;

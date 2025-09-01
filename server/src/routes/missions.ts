import express, { Request, Response } from "express";
import Joi from "joi";
import { MissionService } from "../services/MissionService";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// Schémas de validation
const claimRewardsSchema = Joi.object({
  missionId: Joi.string().required().messages({
    'any.required': 'Mission ID is required'
  })
});

const forceResetSchema = Joi.object({
  resetType: Joi.string().valid("daily", "weekly", "both").required()
});

const createTemplateSchema = Joi.object({
  missionId: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).required(),
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(300).required(),
  type: Joi.string().valid("daily", "weekly", "achievement").required(),
  category: Joi.string().valid("battle", "progression", "collection", "social", "login").required(),
  condition: Joi.object({
    type: Joi.string().valid("battle_wins", "tower_floors", "gacha_pulls", "login", "gold_spent", "level_reached", "heroes_owned", "daily_missions_completed").required(),
    targetValue: Joi.number().min(1).required(),
    battleConditions: Joi.object({
      battleType: Joi.string().valid("campaign", "arena", "tower"),
      difficulty: Joi.string().valid("Normal", "Hard", "Nightmare"),
      winRequired: Joi.boolean().default(true),
      minWorld: Joi.number().min(1)
    }),
    heroConditions: Joi.object({
      rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary"),
      minLevel: Joi.number().min(1).max(100),
      minStars: Joi.number().min(1).max(6)
    })
  }).required(),
  rewards: Joi.array().items(
    Joi.object({
      type: Joi.string().valid("currency", "hero", "equipment", "material", "fragment", "ticket", "title").required(),
      quantity: Joi.number().min(1).required(),
      currencyType: Joi.string().valid("gold", "gems", "paidGems", "tickets"),
      heroId: Joi.string(),
      materialId: Joi.string(),
      fragmentHeroId: Joi.string()
    })
  ).min(1).required(),
  minPlayerLevel: Joi.number().min(1).default(1),
  maxPlayerLevel: Joi.number().min(1),
  priority: Joi.number().min(1).max(10).default(5),
  spawnWeight: Joi.number().min(1).max(100).default(50)
});

const statsQuerySchema = Joi.object({
  serverId: Joi.string().pattern(/^S\d+$/)
});

// === RÉCUPÉRER LES MISSIONS DU JOUEUR ===
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`🎯 ${req.userId} récupère ses missions sur serveur ${req.serverId}`);

    const result = await MissionService.getPlayerMissions(
      req.userId!,
      req.serverId!
    );

    res.json({
      message: "Player missions retrieved successfully",
      missions: result.missions,
      stats: result.stats,
      progress: result.progress,
      timeRemaining: result.timeRemaining,
      serverInfo: {
        serverId: req.serverId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (err: any) {
    console.error("Get player missions error:", err);
    
    if (err.message === "Player not found") {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_MISSIONS_FAILED"
    });
  }
});

// === INITIALISER LES MISSIONS D'UN JOUEUR ===
router.post("/initialize", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`🎯 Initialisation missions pour ${req.userId}`);

    const result = await MissionService.initializePlayerMissions(
      req.userId!,
      req.serverId!
    );

    if (result.existing) {
      res.json({
        message: result.message,
        existing: true,
        note: "Player missions were already initialized"
      });
      return;
    }

    res.status(201).json({
      message: result.message,
      existing: false,
      missionCounts: {
        daily: result.dailyCount,
        weekly: result.weeklyCount,
        achievements: result.achievementCount
      }
    });

  } catch (err: any) {
    console.error("Initialize missions error:", err);
    
    if (err.message === "Player not found") {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "INITIALIZE_MISSIONS_FAILED"
    });
  }
});

// === RÉCLAMER LES RÉCOMPENSES D'UNE MISSION ===
router.post("/claim", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = claimRewardsSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { missionId } = req.body;
    
    console.log(`🎁 ${req.userId} réclame récompenses mission ${missionId}`);

    const result = await MissionService.claimMissionRewards(
      req.userId!,
      req.serverId!,
      missionId
    );

    if (!result.success) {
      res.status(400).json({ 
        error: result.message,
        code: "CLAIM_FAILED",
        reason: result.reason
      });
      return;
    }

    res.json({
      message: result.message,
      rewards: result.rewards,
      missionId: result.missionId,
      summary: {
        rewardsCount: result.rewards.length,
        totalValue: result.rewards.reduce((sum: number, r: any) => sum + r.quantity, 0)
      }
    });

  } catch (err: any) {
    console.error("Claim mission rewards error:", err);
    
    if (err.message === "Player missions not found") {
      res.status(404).json({ 
        error: "Player missions not found. Initialize missions first.",
        code: "MISSIONS_NOT_FOUND"
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
      code: "CLAIM_REWARDS_FAILED"
    });
  }
});

// === RÉCLAMER TOUTES LES RÉCOMPENSES DISPONIBLES ===
router.post("/claim-all", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`🎁 ${req.userId} réclame toutes les récompenses disponibles`);

    const result = await MissionService.claimAllAvailableRewards(
      req.userId!,
      req.serverId!
    );

    res.json({
      message: result.message,
      claimedMissions: result.claimedMissions,
      details: result.details,
      summary: {
        totalMissions: result.claimedMissions,
        totalRewards: result.details.reduce((sum: number, mission: any) => sum + mission.rewards.length, 0)
      }
    });

  } catch (err: any) {
    console.error("Claim all rewards error:", err);
    
    if (err.message === "Player missions not found") {
      res.status(404).json({ 
        error: "Player missions not found",
        code: "MISSIONS_NOT_FOUND"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "CLAIM_ALL_REWARDS_FAILED"
    });
  }
});

// === RÉCUPÉRER LES STATISTIQUES DES MISSIONS ===
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // Pour l'instant, utiliser le serverId de la requête
    const targetServerId = req.serverId!;

    const result = await MissionService.getMissionStats(targetServerId);

    res.json({
      message: "Mission statistics retrieved successfully",
      serverId: result.serverId,
      stats: result.stats,
      serverScope: targetServerId === "ALL" ? "Global" : `Server ${targetServerId}`
    });

  } catch (err) {
    console.error("Get mission stats error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_MISSION_STATS_FAILED"
    });
  }
});

// === ROUTES ADMIN (TODO: Ajouter middleware admin) ===

// Créer un template de mission
router.post("/admin/templates", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Vérifier les droits admin
    
    const { error } = createTemplateSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const result = await MissionService.createMissionTemplate(req.body);

    res.status(201).json({
      message: result.message,
      template: {
        missionId: result.template.missionId,
        name: result.template.name,
        type: result.template.type,
        category: result.template.category
      }
    });

  } catch (err: any) {
    console.error("Create mission template error:", err);
    
    if (err.code === 11000) { // Duplicate missionId
      res.status(400).json({ 
        error: "Mission ID already exists",
        code: "DUPLICATE_MISSION_ID"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "CREATE_TEMPLATE_FAILED"
    });
  }
});

// Forcer le reset des missions (admin/test)
router.post("/admin/force-reset", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Vérifier les droits admin ou mode développement
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({ 
        error: "Force reset not available in production",
        code: "NOT_AVAILABLE_IN_PRODUCTION"
      });
      return;
    }
    
    const { error } = forceResetSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { resetType } = req.body;
    
    console.log(`🔄 ${req.userId} force le reset ${resetType}`);

    const result = await MissionService.forceResetMissions(
      req.userId!,
      req.serverId!,
      resetType
    );

    res.json({
      message: result.message,
      resetType: result.resetType,
      note: "This is a development/admin feature"
    });

  } catch (err: any) {
    console.error("Force reset missions error:", err);
    
    if (err.message === "Player missions not found") {
      res.status(404).json({ 
        error: "Player missions not found",
        code: "MISSIONS_NOT_FOUND"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "FORCE_RESET_FAILED"
    });
  }
});

// Récupérer les templates de missions (admin)
router.get("/admin/templates", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Vérifier les droits admin
    
    const type = req.query.type as string;
    const category = req.query.category as string;
    
    // Import dynamique pour éviter les dépendances circulaires
    const { MissionTemplate } = await import("../models/Missions");
    
    let filter: any = { isActive: true };
    if (type) filter.type = type;
    if (category) filter.category = category;

    const templates = await MissionTemplate.find(filter)
      .sort({ type: 1, priority: -1 })
      .select("missionId name description type category condition rewards priority spawnWeight minPlayerLevel maxPlayerLevel");

    res.json({
      message: "Mission templates retrieved successfully",
      templates,
      count: templates.length,
      filters: { type, category }
    });

  } catch (err) {
    console.error("Get mission templates error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_TEMPLATES_FAILED"
    });
  }
});

// === ROUTE DE TEST (développement uniquement) ===
router.post("/test/progress", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV === "production") {
      res.status(404).json({ error: "Not available in production" });
      return;
    }

    console.log(`🧪 Test progression missions pour ${req.userId}`);

    // Tester différents types de progression
    const testResults = [];

    const progressTypes = [
      { type: "battle_wins", value: 2, data: { battleType: "campaign", victory: true } },
      { type: "tower_floors", value: 3 },
      { type: "gacha_pulls", value: 5 },
      { type: "login", value: 1 },
      { type: "gold_spent", value: 1000 }
    ];

    for (const test of progressTypes) {
      const result = await MissionService.updateProgress(
        req.userId!,
        req.serverId!,
        test.type as any,
        test.value,
        test.data
      );
      testResults.push({
        type: test.type,
        value: test.value,
        result
      });
    }

    res.json({
      message: "Mission progress test completed",
      results: testResults,
      summary: {
        totalTests: testResults.length,
        completedMissions: testResults.reduce((sum, r) => sum + r.result.completedMissions.length, 0)
      },
      note: "This is a test endpoint for development"
    });

  } catch (err: any) {
    console.error("Test mission progress error:", err);
    res.status(500).json({ 
      error: err.message,
      code: "TEST_MISSION_PROGRESS_FAILED"
    });
  }
});

// === ROUTE D'INFORMATION SUR LES TYPES DE MISSIONS ===
router.get("/info/types", async (req: Request, res: Response): Promise<void> => {
  try {
    const missionInfo = {
      types: {
        daily: {
          name: "Daily Missions",
          description: "Reset every day at midnight UTC",
          duration: "24 hours",
          typical_count: "3-5 missions",
          examples: ["Win 3 campaign battles", "Use 5 summon tickets", "Climb 2 tower floors"]
        },
        weekly: {
          name: "Weekly Missions",
          description: "Reset every Monday at midnight UTC",
          duration: "7 days",
          typical_count: "2-3 missions",
          examples: ["Complete 20 daily missions", "Reach tower floor 25", "Win 50 battles total"]
        },
        achievement: {
          name: "Achievements",
          description: "Permanent goals that never reset",
          duration: "Permanent",
          typical_count: "Many available",
          examples: ["Reach player level 50", "Own 30 different heroes", "Complete World 10"]
        }
      },
      categories: {
        battle: "Combat-related missions",
        progression: "Player advancement missions",
        collection: "Gacha and item collection missions",
        social: "Future social features",
        login: "Daily connection missions"
      },
      reward_types: {
        currency: "Gold, Gems, Paid Gems, Tickets",
        hero: "Specific heroes",
        fragment: "Hero fragments for summoning/upgrading",
        material: "Crafting and upgrade materials",
        equipment: "Weapons, armor, accessories",
        title: "Cosmetic titles"
      }
    };

    res.json({
      message: "Mission system information",
      info: missionInfo,
      api_endpoints: {
        get_missions: "GET /api/missions",
        claim_rewards: "POST /api/missions/claim",
        claim_all: "POST /api/missions/claim-all",
        stats: "GET /api/missions/stats"
      }
    });

  } catch (err) {
    console.error("Get mission info error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_MISSION_INFO_FAILED"
    });
  }
});

export default router;

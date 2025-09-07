import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import serverMiddleware from "../middleware/serverMiddleware";
import { HeroFusionService } from "../services/HeroFusionService";

const router = express.Router();

// ✅ CORRECTION: Ajouter serverMiddleware
router.use(serverMiddleware);

const fusionPreviewSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
});

const fusionExecuteSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
  requirements: Joi.object({
    mainHero: Joi.string().required(),
    copies: Joi.array().items(Joi.string()).required(),
    foodHeroes: Joi.array().items(Joi.string()).required(),
    materials: Joi.object().pattern(Joi.string(), Joi.number().min(0)).required(),
    gold: Joi.number().min(0).required(),
  }).required(),
});

const fusionHistorySchema = Joi.object({
  limit: Joi.number().min(1).max(100).default(20),
  fusionType: Joi.string().valid("rarity_upgrade", "star_upgrade").optional(),
});

const leaderboardSchema = Joi.object({
  timeframe: Joi.string().valid("daily", "weekly", "monthly", "all").default("weekly"),
  limit: Joi.number().min(1).max(100).default(50),
});

router.get("/preview/:heroInstanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = fusionPreviewSchema.validate(req.params);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId } = req.params;
    // ✅ CORRECTION: Utiliser accountId et serverId du middleware
    const accountId = req.userId!;
    const serverId = req.serverId!;

    const preview = await HeroFusionService.getFusionPreview(
      accountId,
      serverId,
      heroInstanceId
    );

    res.json({
      message: "Fusion preview retrieved successfully",
      serverId,
      ...preview
    });
  } catch (err) {
    console.error("Get fusion preview error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_FUSION_PREVIEW_FAILED" });
  }
});

router.post("/execute", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = fusionExecuteSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId, requirements } = req.body;
    // ✅ CORRECTION: Utiliser accountId et serverId du middleware
    const accountId = req.userId!;
    const serverId = req.serverId!;

    const result = await HeroFusionService.fuseHero(
      accountId,
      serverId,
      heroInstanceId,
      requirements
    );

    if (!result.success) {
      res.status(400).json({ 
        error: result.error, 
        code: result.code || "FUSION_FAILED" 
      });
      return;
    }

    res.json({
      message: "Hero fusion completed successfully",
      serverId,
      ...result
    });
  } catch (err) {
    console.error("Execute fusion error:", err);
    res.status(500).json({ error: "Internal server error", code: "FUSION_EXECUTION_FAILED" });
  }
});

router.get("/fusable", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser accountId et serverId du middleware
    const accountId = req.userId!;
    const serverId = req.serverId!;

    const result = await HeroFusionService.getFusableHeroes(
      accountId,
      serverId
    );

    res.json({
      message: "Fusable heroes retrieved successfully",
      serverId,
      ...result
    });
  } catch (err) {
    console.error("Get fusable heroes error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_FUSABLE_HEROES_FAILED" });
  }
});

router.get("/history", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = fusionHistorySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { limit } = req.query as any;
    // ✅ CORRECTION: Utiliser accountId et serverId du middleware
    const accountId = req.userId!;
    const serverId = req.serverId!;

    const result = await HeroFusionService.getFusionHistory(
      accountId,
      serverId,
      parseInt(limit) || 20
    );

    res.json({
      message: "Fusion history retrieved successfully",
      serverId,
      ...result
    });
  } catch (err) {
    console.error("Get fusion history error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_FUSION_HISTORY_FAILED" });
  }
});

router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser accountId et serverId du middleware
    const accountId = req.userId!;
    const serverId = req.serverId!;

    const result = await HeroFusionService.getFusionStats(
      accountId,
      serverId
    );

    res.json({
      message: "Fusion stats retrieved successfully",
      serverId,
      ...result
    });
  } catch (err) {
    console.error("Get fusion stats error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_FUSION_STATS_FAILED" });
  }
});

router.get("/path/:targetHeroId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetHeroId } = req.params;
    // ✅ CORRECTION: Utiliser accountId et serverId du middleware
    const accountId = req.userId!;
    const serverId = req.serverId!;

    const result = await HeroFusionService.getOptimalFusionPath(
      accountId,
      serverId,
      targetHeroId
    );

    res.json({
      message: "Optimal fusion path calculated successfully",
      serverId,
      ...result
    });
  } catch (err) {
    console.error("Get fusion path error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_FUSION_PATH_FAILED" });
  }
});

router.get("/analytics", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser accountId et serverId du middleware
    const accountId = req.userId!;
    const serverId = req.serverId!;

    const result = await HeroFusionService.getPlayerFusionAnalytics(
      accountId,
      serverId
    );

    res.json({
      message: "Fusion analytics retrieved successfully",
      serverId,
      ...result
    });
  } catch (err) {
    console.error("Get fusion analytics error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_FUSION_ANALYTICS_FAILED" });
  }
});

router.get("/hero-history/:heroId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { heroId } = req.params;
    // ✅ CORRECTION: Utiliser accountId et serverId du middleware
    const accountId = req.userId!;
    const serverId = req.serverId!;

    const result = await HeroFusionService.getHeroSpecificHistory(
      accountId,
      serverId,
      heroId
    );

    res.json({
      message: "Hero fusion history retrieved successfully",
      serverId,
      ...result
    });
  } catch (err) {
    console.error("Get hero fusion history error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_HERO_HISTORY_FAILED" });
  }
});

router.get("/leaderboard", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = leaderboardSchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    // ✅ CORRECTION: Utiliser serverId du middleware
    const serverId = req.serverId!;
    const { timeframe, limit } = req.query as any;

    const result = await HeroFusionService.getServerFusionLeaderboard(
      serverId,
      timeframe || "weekly",
      parseInt(limit) || 50
    );

    res.json({
      message: "Fusion leaderboard retrieved successfully",
      serverId,
      ...result
    });
  } catch (err) {
    console.error("Get fusion leaderboard error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_FUSION_LEADERBOARD_FAILED" });
  }
});

router.post("/simulate", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const simulationSchema = Joi.object({
      heroBaseStats: Joi.object({
        hp: Joi.number().required(),
        atk: Joi.number().required(),
        def: Joi.number().required(),
        crit: Joi.number().default(5),
        critDamage: Joi.number().default(50),
        vitesse: Joi.number().default(80),
        moral: Joi.number().default(60),
      }).required(),
      currentLevel: Joi.number().min(1).max(100).required(),
      fromRarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary", "Ascended").required(),
      fromStars: Joi.number().min(0).max(5).required(),
      toRarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary", "Ascended").required(),
      toStars: Joi.number().min(0).max(5).required(),
    });

    const { error } = simulationSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { 
      heroBaseStats, 
      currentLevel, 
      fromRarity, 
      fromStars, 
      toRarity, 
      toStars 
    } = req.body;

    const simulation = HeroFusionService.simulateFusion(
      heroBaseStats,
      currentLevel,
      fromRarity,
      fromStars,
      toRarity,
      toStars
    );

    res.json({
      message: "Fusion simulation completed successfully",
      serverId: req.serverId,
      simulation
    });
  } catch (err) {
    console.error("Fusion simulation error:", err);
    res.status(500).json({ error: "Internal server error", code: "FUSION_SIMULATION_FAILED" });
  }
});

router.post("/cost-calculator", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const costSchema = Joi.object({
      fromRarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary", "Ascended").required(),
      fromStars: Joi.number().min(0).max(5).required(),
      toRarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary", "Ascended").required(),
      toStars: Joi.number().min(0).max(5).required(),
    });

    const { error } = costSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { fromRarity, fromStars, toRarity, toStars } = req.body;

    const totalCost = HeroFusionService.calculateFullAscensionCost(
      fromRarity,
      fromStars,
      toRarity,
      toStars
    );

    res.json({
      message: "Ascension cost calculated successfully",
      serverId: req.serverId,
      from: `${fromRarity} ${fromStars}★`,
      to: `${toRarity} ${toStars}★`,
      totalCost,
      breakdown: {
        goldPerStep: Math.floor(totalCost.gold / Math.max(1, Object.keys(totalCost.materials).length)),
        materialsRequired: Object.keys(totalCost.materials).length,
        totalHeroesNeeded: totalCost.heroesNeeded.copies + totalCost.heroesNeeded.food
      }
    });
  } catch (err) {
    console.error("Cost calculation error:", err);
    res.status(500).json({ error: "Internal server error", code: "COST_CALCULATION_FAILED" });
  }
});

export default router;

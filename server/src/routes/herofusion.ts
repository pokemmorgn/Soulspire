import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import { HeroFusionService } from "../services/HeroFusionService";

const router = express.Router();

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

router.get("/preview/:heroInstanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = fusionPreviewSchema.validate(req.params);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId } = req.params;
    const serverId = req.headers['x-server-id'] as string || "S1";

    const preview = await HeroFusionService.getFusionPreview(
      req.userId!,
      serverId,
      heroInstanceId
    );

    res.json({
      message: "Fusion preview retrieved successfully",
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
    const serverId = req.headers['x-server-id'] as string || "S1";

    const result = await HeroFusionService.fuseHero(
      req.userId!,
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
      ...result
    });
  } catch (err) {
    console.error("Execute fusion error:", err);
    res.status(500).json({ error: "Internal server error", code: "FUSION_EXECUTION_FAILED" });
  }
});

router.get("/fusable", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const serverId = req.headers['x-server-id'] as string || "S1";

    const result = await HeroFusionService.getFusableHeroes(
      req.userId!,
      serverId
    );

    res.json({
      message: "Fusable heroes retrieved successfully",
      ...result
    });
  } catch (err) {
    console.error("Get fusable heroes error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_FUSABLE_HEROES_FAILED" });
  }
});

router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const serverId = req.headers['x-server-id'] as string || "S1";

    const result = await HeroFusionService.getFusionStats(
      req.userId!,
      serverId
    );

    res.json({
      message: "Fusion stats retrieved successfully",
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
    const serverId = req.headers['x-server-id'] as string || "S1";

    const result = await HeroFusionService.getOptimalFusionPath(
      req.userId!,
      serverId,
      targetHeroId
    );

    res.json({
      message: "Optimal fusion path calculated successfully",
      ...result
    });
  } catch (err) {
    console.error("Get fusion path error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_FUSION_PATH_FAILED" });
  }
});

export default router;

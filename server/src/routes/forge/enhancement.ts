import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../../middleware/authMiddleware";
import ForgeEnhancement from "../../models/Forge/ForgeEnhancement";
import { IForgeModuleConfig } from "../../models/Forge/ForgeCore";

const router = express.Router();

// Validation schemas
const costQuerySchema = Joi.object({
  usePaidGems: Joi.boolean().optional()
});

const attemptBodySchema = Joi.object({
  instanceId: Joi.string().required(),
  usePaidGemsToGuarantee: Joi.boolean().optional()
});

// Default config for the enhancement module (can be replaced by a real config loader)
const enhancementConfig: IForgeModuleConfig = {
  enabled: true,
  baseGoldCost: 100,
  baseGemCost: 0,
  materialRequirements: undefined,
  levelRestrictions: {
    minPlayerLevel: 1
  }
};

/**
 * GET /forge/enhancement/cost/:instanceId
 * Query:
 *  - usePaidGems (optional boolean) : include guaranteed paid gems cost in the result
 */
router.get("/cost/:instanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = costQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { instanceId } = req.params;
    const usePaidGems = value.usePaidGems === true;

    if (!req.userId) {
      res.status(401).json({ error: "User not authenticated", code: "USER_NOT_AUTHENTICATED" });
      return;
    }

    const enhancer = new ForgeEnhancement(req.userId, enhancementConfig);

    const cost = await enhancer.getEnhancementCost(instanceId, { usePaidGemsToGuarantee: usePaidGems });
    if (!cost) {
      res.status(400).json({ error: "Unable to compute enhancement cost (item missing, max level reached or invalid)", code: "COST_COMPUTE_FAILED" });
      return;
    }

    res.json({
      message: "Enhancement cost retrieved",
      instanceId,
      cost
    });
  } catch (err: any) {
    console.error("Get enhancement cost error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_ENHANCEMENT_COST_FAILED" });
  }
});

/**
 * POST /forge/enhancement/attempt
 * Body:
 *  - instanceId (string) required
 *  - usePaidGemsToGuarantee (boolean) optional
 */
router.post("/attempt", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = attemptBodySchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { instanceId, usePaidGemsToGuarantee = false } = value;

    if (!req.userId) {
      res.status(401).json({ error: "User not authenticated", code: "USER_NOT_AUTHENTICATED" });
      return;
    }

    const enhancer = new ForgeEnhancement(req.userId, enhancementConfig);

    const result = await enhancer.attemptEnhance(instanceId, { usePaidGemsToGuarantee });

    // On échec côté logique métier (ex: insufficient resources), renvoyer 400 pour indiquer requête invalide
    if (!result.success) {
      res.status(400).json({
        message: "Enhancement attempt failed",
        error: result.message,
        code: "ENHANCEMENT_FAILED",
        cost: result.cost,
        data: result.data
      });
      return;
    }

    // Succès
    res.json({
      message: "Enhancement attempt successful",
      cost: result.cost,
      data: result.data
    });
  } catch (err: any) {
    console.error("Enhancement attempt error:", err);
    res.status(500).json({ error: "Internal server error", code: "ENHANCEMENT_ATTEMPT_FAILED" });
  }
});

export default router;

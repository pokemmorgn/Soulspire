import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import { createForgeService, handleForgeError, validateForgeParams } from "../models/Forge/index";

const router = express.Router();

// === SCHÉMAS DE VALIDATION ===

const reforgePreviewSchema = Joi.object({
  itemInstanceId: Joi.string().required(),
  lockedStats: Joi.array().items(Joi.string()).max(3).default([])
});

const executeReforgeSchema = Joi.object({
  itemInstanceId: Joi.string().required(),
  lockedStats: Joi.array().items(Joi.string()).max(3).default([])
});

const getStatsForSlotSchema = Joi.object({
  equipmentSlot: Joi.string().valid("Weapon", "Helmet", "Armor", "Boots", "Gloves", "Accessory").required()
});

const getStatRangesSchema = Joi.object({
  rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended").required()
});

// === GET REFORGE PREVIEW ===
router.post("/preview", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = reforgePreviewSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemInstanceId, lockedStats } = req.body;

    // Validation des paramètres de forge
    const paramValidation = validateForgeParams({ itemInstanceId, lockedStats }, 'reforge');
    if (!paramValidation.valid) {
      res.status(400).json({
        error: paramValidation.error,
        code: "INVALID_PARAMETERS"
      });
      return;
    }

    const forgeService = createForgeService(req.userId!);

    // Vérifier que le module reforge est activé
    if (!forgeService.isModuleEnabled('reforge')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "reforge"
      });
      return;
    }

    const preview = await forgeService.getReforgePreview(itemInstanceId, lockedStats);

    res.json({
      message: "REFORGE_PREVIEW_SUCCESS",
      preview: {
        itemInstanceId,
        lockedStats: preview.lockedStats,
        newStats: preview.newStats,
        cost: preview.cost,
        reforgeCount: preview.reforgeCount
      }
    });

  } catch (err: any) {
    console.error("Reforge preview error:", err);
    const errorResponse = handleForgeError(err, "reforge_preview");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === EXECUTE REFORGE ===
router.post("/execute", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = executeReforgeSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemInstanceId, lockedStats } = req.body;

    // Validation des paramètres de forge
    const paramValidation = validateForgeParams({ itemInstanceId, lockedStats }, 'reforge');
    if (!paramValidation.valid) {
      res.status(400).json({
        error: paramValidation.error,
        code: "INVALID_PARAMETERS"
      });
      return;
    }

    const forgeService = createForgeService(req.userId!);

    // Vérifier que le module reforge est activé
    if (!forgeService.isModuleEnabled('reforge')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "reforge"
      });
      return;
    }

    const result = await forgeService.executeReforge(itemInstanceId, lockedStats);

    if (result.success) {
      res.json({
        message: result.message,
        success: true,
        result: {
          itemInstanceId,
          cost: result.cost,
          newStats: result.data?.newStats,
          lockedStats: result.data?.lockedStats,
          reforgeCount: result.data?.reforgeCount
        }
      });
    } else {
      res.status(400).json({
        error: result.message,
        code: "REFORGE_FAILED",
        success: false,
        cost: result.cost,
        data: result.data
      });
    }

  } catch (err: any) {
    console.error("Execute reforge error:", err);
    const errorResponse = handleForgeError(err, "execute_reforge");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET AVAILABLE STATS FOR SLOT ===
router.get("/stats/:equipmentSlot", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = getStatsForSlotSchema.validate(req.params);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { equipmentSlot } = req.params;
    const forgeService = createForgeService(req.userId!);

    // Vérifier que le module reforge est activé
    if (!forgeService.isModuleEnabled('reforge')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "reforge"
      });
      return;
    }

    const [availableStats, maxLockedStats] = await Promise.all([
      forgeService.getAvailableStatsForSlot(equipmentSlot),
      forgeService.getMaxLockedStatsForSlot(equipmentSlot)
    ]);

    res.json({
      message: "AVAILABLE_STATS_RETRIEVED",
      equipmentSlot,
      availableStats,
      maxLockedStats,
      totalStats: availableStats.length
    });

  } catch (err: any) {
    console.error("Get available stats error:", err);
    const errorResponse = handleForgeError(err, "get_available_stats");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET STAT RANGES BY RARITY ===
router.get("/ranges/:rarity", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = getStatRangesSchema.validate(req.params);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { rarity } = req.params;
    const forgeService = createForgeService(req.userId!);

    // Vérifier que le module reforge est activé
    if (!forgeService.isModuleEnabled('reforge')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "reforge"
      });
      return;
    }

    const statRanges = await forgeService.getStatRangesByRarity(rarity);

    res.json({
      message: "STAT_RANGES_RETRIEVED",
      rarity,
      statRanges,
      totalStats: Object.keys(statRanges).length
    });

  } catch (err: any) {
    console.error("Get stat ranges error:", err);
    const errorResponse = handleForgeError(err, "get_stat_ranges");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET REFORGE COST (PREVIEW WITHOUT GENERATION) ===
router.post("/cost", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = reforgePreviewSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemInstanceId, lockedStats } = req.body;

    const forgeService = createForgeService(req.userId!);

    // Vérifier que le module reforge est activé
    if (!forgeService.isModuleEnabled('reforge')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "reforge"
      });
      return;
    }

    const preview = await forgeService.getReforgePreview(itemInstanceId, lockedStats);

    res.json({
      message: "REFORGE_COST_RETRIEVED",
      itemInstanceId,
      lockedStatsCount: lockedStats.length,
      maxLockedStats: 3,
      cost: preview.cost,
      multipliers: preview.cost.multipliers || {}
    });

  } catch (err: any) {
    console.error("Get reforge cost error:", err);
    const errorResponse = handleForgeError(err, "get_reforge_cost");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET REFORGE INFO ===
router.get("/info", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('reforge')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "reforge"
      });
      return;
    }

    const status = await forgeService.getForgeStatus();

    res.json({
      message: "REFORGE_INFO_RETRIEVED",
      reforgeInfo: {
        enabled: status.modules.reforge.enabled,
        availableOperations: status.modules.reforge.availableOperations,
        stats: status.modules.reforge.stats,
        maxLockedStats: 3,
        equipmentSlots: ["Weapon", "Helmet", "Armor", "Boots", "Gloves", "Accessory"],
        rarities: ["Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended"]
      },
      playerResources: status.playerResources
    });

  } catch (err: any) {
    console.error("Get reforge info error:", err);
    const errorResponse = handleForgeError(err, "get_reforge_info");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

export default router;

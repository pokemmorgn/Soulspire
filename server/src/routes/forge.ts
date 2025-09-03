import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import { createForgeService, handleForgeError, validateForgeParams } from "../models/Forge/index";

const router = express.Router();

// === SCHÉMAS DE VALIDATION ===

const batchOperationSchema = Joi.object({
  operations: Joi.array().items(Joi.object({
    type: Joi.string().valid('reforge', 'enhancement', 'fusion', 'tierUpgrade').required(),
    itemInstanceId: Joi.string().required(),
    parameters: Joi.object().optional()
  })).min(1).max(10).required()
});

const moduleConfigSchema = Joi.object({
  moduleName: Joi.string().valid('reforge', 'enhancement', 'fusion', 'tierUpgrade').required(),
  enabled: Joi.boolean().optional(),
  baseGoldCost: Joi.number().min(0).optional(),
  baseGemCost: Joi.number().min(0).optional(),
  materialRequirements: Joi.object().optional(),
  levelRestrictions: Joi.object({
    minPlayerLevel: Joi.number().min(1).optional(),
    maxPlayerLevel: Joi.number().min(1).optional()
  }).optional()
});

// === GET FORGE STATUS (GLOBAL) ===
router.get("/status", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const forgeService = createForgeService(req.userId!);
    const status = await forgeService.getForgeStatus();

    res.json({
      message: "FORGE_STATUS_RETRIEVED",
      status,
      gameConstants: {
        maxEnhancementLevel: 30,
        maxTier: 5,
        maxLockedStats: 3,
        fusionRequiredItems: 3,
        rarities: ["Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended"],
        equipmentSlots: ["Weapon", "Helmet", "Armor", "Boots", "Gloves", "Accessory"]
      }
    });

  } catch (err: any) {
    console.error("Get forge status error:", err);
    const errorResponse = handleForgeError(err, "get_forge_status");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET ALL MODULE STATS ===
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const forgeService = createForgeService(req.userId!);
    const moduleStats = await forgeService.getAllModuleStats();

    res.json({
      message: "ALL_MODULE_STATS_RETRIEVED",
      moduleStats,
      totalModules: Object.keys(moduleStats).length
    });

  } catch (err: any) {
    console.error("Get all module stats error:", err);
    const errorResponse = handleForgeError(err, "get_all_module_stats");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === CALCULATE BATCH OPERATION COST ===
router.post("/batch/cost", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = batchOperationSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { operations } = req.body;

    const forgeService = createForgeService(req.userId!);

    // Vérifier que tous les modules requis sont activés
    const requiredModules = [...new Set(operations.map((op: any) => op.type))] as string[];
    const disabledModules = requiredModules.filter((module: string) => 
      !forgeService.isModuleEnabled(module as 'reforge' | 'enhancement' | 'fusion' | 'tierUpgrade')
    );

    if (disabledModules.length > 0) {
      res.status(403).json({
        error: "SOME_FORGE_MODULES_DISABLED",
        code: "MODULES_DISABLED",
        disabledModules
      });
      return;
    }

    const totalCost = await forgeService.calculateBatchOperationCost(operations);

    res.json({
      message: "BATCH_OPERATION_COST_CALCULATED",
      operations: operations.map((op: any) => ({
        type: op.type,
        itemInstanceId: op.itemInstanceId
      })),
      totalOperations: operations.length,
      totalCost,
      estimatedTime: `${operations.length * 2}s` // Approximation
    });

  } catch (err: any) {
    console.error("Calculate batch cost error:", err);
    const errorResponse = handleForgeError(err, "calculate_batch_cost");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET FORGE CONFIGURATION ===
router.get("/config", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const forgeService = createForgeService(req.userId!);

    // Récupérer la configuration actuelle de tous les modules
    const config = {
      reforge: {
        enabled: forgeService.isModuleEnabled('reforge'),
        baseGoldCost: 2000,
        baseGemCost: 100,
        maxLockedStats: 3,
        levelRestrictions: { minPlayerLevel: 10 }
      },
      enhancement: {
        enabled: forgeService.isModuleEnabled('enhancement'),
        baseGoldCost: 1000,
        baseGemCost: 50,
        maxLevel: 30,
        levelRestrictions: { minPlayerLevel: 5 }
      },
      fusion: {
        enabled: forgeService.isModuleEnabled('fusion'),
        baseGoldCost: 5000,
        baseGemCost: 200,
        requiredItems: 3,
        maxRarity: "Mythic",
        levelRestrictions: { minPlayerLevel: 15 }
      },
      tierUpgrade: {
        enabled: forgeService.isModuleEnabled('tierUpgrade'),
        baseGoldCost: 10000,
        baseGemCost: 500,
        maxTier: 5,
        levelRestrictions: { minPlayerLevel: 20 }
      }
    };

    res.json({
      message: "FORGE_CONFIG_RETRIEVED",
      config,
      lastUpdated: new Date().toISOString()
    });

  } catch (err: any) {
    console.error("Get forge config error:", err);
    const errorResponse = handleForgeError(err, "get_forge_config");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === UPDATE MODULE CONFIGURATION (ADMIN) ===
router.put("/config", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    const { error } = moduleConfigSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { moduleName, ...configUpdates } = req.body;

    const forgeService = createForgeService(req.userId!);
    forgeService.updateModuleConfig(moduleName as any, configUpdates);

    res.json({
      message: "MODULE_CONFIG_UPDATED",
      moduleName,
      updatedFields: Object.keys(configUpdates),
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error("Update module config error:", err);
    const errorResponse = handleForgeError(err, "update_module_config");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET PLAYER FORGE HISTORY (LIMITED) ===
router.get("/history", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const operationType = req.query.type as string;

    // Note: Cette route retournerait normalement des données depuis une collection de logs
    // Pour l'instant, on retourne une structure vide
    const mockHistory = {
      operations: [],
      pagination: {
        limit,
        offset,
        total: 0,
        hasMore: false
      },
      filters: {
        operationType: operationType || "all"
      }
    };

    res.json({
      message: "FORGE_HISTORY_RETRIEVED",
      history: mockHistory
    });

  } catch (err: any) {
    console.error("Get forge history error:", err);
    const errorResponse = handleForgeError(err, "get_forge_history");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET FORGE RECOMMENDATIONS ===
router.get("/recommendations", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const forgeService = createForgeService(req.userId!);
    const status = await forgeService.getForgeStatus();

    const recommendations = [];

    // Recommandations basées sur l'inventaire et les ressources
    if (status.playerResources.gold < 10000) {
      recommendations.push({
        type: "warning",
        category: "resources",
        message: "LOW_GOLD_WARNING",
        priority: "medium",
        suggestion: "CONSIDER_FARMING_GOLD"
      });
    }

    if (status.inventory.enhanceableItems > 10) {
      recommendations.push({
        type: "suggestion",
        category: "enhancement",
        message: "MANY_ENHANCEABLE_ITEMS",
        priority: "low",
        suggestion: "CONSIDER_BATCH_ENHANCEMENT"
      });
    }

    if (status.inventory.fusableItems > 5) {
      recommendations.push({
        type: "suggestion",
        category: "fusion",
        message: "FUSION_OPPORTUNITIES_AVAILABLE",
        priority: "medium",
        suggestion: "CHECK_FUSION_RECIPES"
      });
    }

    if (status.playerResources.gems > 5000) {
      recommendations.push({
        type: "suggestion",
        category: "enhancement",
        message: "HIGH_GEM_COUNT",
        priority: "low",
        suggestion: "CONSIDER_GUARANTEED_ENHANCEMENTS"
      });
    }

    res.json({
      message: "FORGE_RECOMMENDATIONS_RETRIEVED",
      recommendations,
      totalRecommendations: recommendations.length,
      categories: ["resources", "enhancement", "fusion", "tierUpgrade", "reforge"],
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error("Get forge recommendations error:", err);
    const errorResponse = handleForgeError(err, "get_forge_recommendations");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET FORGE ANALYTICS (SUMMARY) ===
router.get("/analytics", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const forgeService = createForgeService(req.userId!);
    const [status, moduleStats] = await Promise.all([
      forgeService.getForgeStatus(),
      forgeService.getAllModuleStats()
    ]);

    // Calculer des métriques analytiques
    const analytics = {
      overview: {
        totalOperationsAvailable: Object.values(status.modules).reduce((sum, module) => 
          sum + (module.availableOperations || 0), 0),
        enabledModules: Object.values(status.modules).filter(module => module.enabled).length,
        totalModules: Object.keys(status.modules).length
      },
      resources: {
        totalWorth: status.playerResources.gold + (status.playerResources.gems * 10) + (status.playerResources.paidGems * 20),
        goldRatio: status.playerResources.gold / Math.max(status.playerResources.gems, 1),
        canAffordOperations: {
          reforge: Math.floor(status.playerResources.gold / 2000),
          enhancement: Math.floor(status.playerResources.gold / 1000),
          fusion: Math.floor(status.playerResources.gold / 5000),
          tierUpgrade: Math.floor(status.playerResources.gold / 10000)
        }
      },
      inventory: {
        totalProcessableItems: Object.values(status.inventory).reduce((sum, count) => sum + count, 0),
        itemDistribution: {
          reforge: ((status.inventory.reforgeableItems / Math.max(status.inventory.reforgeableItems + status.inventory.enhanceableItems + status.inventory.fusableItems + status.inventory.upgradeableItems, 1)) * 100).toFixed(1) + "%",
          enhancement: ((status.inventory.enhanceableItems / Math.max(status.inventory.reforgeableItems + status.inventory.enhanceableItems + status.inventory.fusableItems + status.inventory.upgradeableItems, 1)) * 100).toFixed(1) + "%",
          fusion: ((status.inventory.fusableItems / Math.max(status.inventory.reforgeableItems + status.inventory.enhanceableItems + status.inventory.fusableItems + status.inventory.upgradeableItems, 1)) * 100).toFixed(1) + "%",
          tierUpgrade: ((status.inventory.upgradeableItems / Math.max(status.inventory.reforgeableItems + status.inventory.enhanceableItems + status.inventory.fusableItems + status.inventory.upgradeableItems, 1)) * 100).toFixed(1) + "%"
        }
      },
      performance: moduleStats
    };

    res.json({
      message: "FORGE_ANALYTICS_RETRIEVED",
      analytics,
      generatedAt: new Date().toISOString(),
      playerId: status.playerId
    });

  } catch (err: any) {
    console.error("Get forge analytics error:", err);
    const errorResponse = handleForgeError(err, "get_forge_analytics");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === HEALTH CHECK ===
router.get("/health", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const forgeService = createForgeService(req.userId!);
    
    // Vérifications de santé basiques
    const healthChecks = {
      moduleInitialization: true,
      playerAccess: false,
      inventoryAccess: false,
      databaseConnection: true
    };

    try {
      const player = await (forgeService as any).getPlayer();
      healthChecks.playerAccess = !!player;
    } catch (err) {
      healthChecks.playerAccess = false;
    }

    try {
      const inventory = await (forgeService as any).getInventory();
      healthChecks.inventoryAccess = !!inventory;
    } catch (err) {
      healthChecks.inventoryAccess = false;
    }

    const allHealthy = Object.values(healthChecks).every(check => check === true);
    const status = allHealthy ? "healthy" : "degraded";

    res.status(allHealthy ? 200 : 503).json({
      message: "FORGE_HEALTH_CHECK_COMPLETED",
      status,
      checks: healthChecks,
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });

  } catch (err: any) {
    console.error("Forge health check error:", err);
    res.status(503).json({
      message: "FORGE_HEALTH_CHECK_FAILED",
      status: "unhealthy",
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

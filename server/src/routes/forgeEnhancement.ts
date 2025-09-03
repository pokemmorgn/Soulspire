import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import { createForgeService, handleForgeError, validateForgeParams } from "../models/Forge/index";

const router = express.Router();

// === SCHÉMAS DE VALIDATION ===

const enhancementCostSchema = Joi.object({
  itemInstanceId: Joi.string().required(),
  usePaidGemsToGuarantee: Joi.boolean().default(false)
});

const executeEnhancementSchema = Joi.object({
  itemInstanceId: Joi.string().required(),
  usePaidGemsToGuarantee: Joi.boolean().default(false)
});

// === GET ENHANCEMENT COST ===
router.post("/cost", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = enhancementCostSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemInstanceId, usePaidGemsToGuarantee } = req.body;

    // Validation des paramètres de forge
    const paramValidation = validateForgeParams({ itemInstanceId }, 'enhancement');
    if (!paramValidation.valid) {
      res.status(400).json({
        error: paramValidation.error,
        code: "INVALID_PARAMETERS"
      });
      return;
    }

    const forgeService = createForgeService(req.userId!);

    // Vérifier que le module enhancement est activé
    if (!forgeService.isModuleEnabled('enhancement')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "enhancement"
      });
      return;
    }

    const cost = await forgeService.getEnhancementCost(itemInstanceId, usePaidGemsToGuarantee);

    res.json({
      message: "ENHANCEMENT_COST_RETRIEVED",
      itemInstanceId,
      usePaidGemsToGuarantee,
      cost,
      maxEnhancementLevel: 30
    });

  } catch (err: any) {
    console.error("Enhancement cost error:", err);
    const errorResponse = handleForgeError(err, "get_enhancement_cost");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === EXECUTE ENHANCEMENT ===
router.post("/execute", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = executeEnhancementSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemInstanceId, usePaidGemsToGuarantee } = req.body;

    // Validation des paramètres de forge
    const paramValidation = validateForgeParams({ itemInstanceId }, 'enhancement');
    if (!paramValidation.valid) {
      res.status(400).json({
        error: paramValidation.error,
        code: "INVALID_PARAMETERS"
      });
      return;
    }

    const forgeService = createForgeService(req.userId!);

    // Vérifier que le module enhancement est activé
    if (!forgeService.isModuleEnabled('enhancement')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "enhancement"
      });
      return;
    }

    const result = await forgeService.executeEnhancement(itemInstanceId, usePaidGemsToGuarantee);

    if (result.success) {
      res.json({
        message: result.message,
        success: true,
        result: {
          itemInstanceId,
          cost: result.cost,
          previousLevel: result.data?.previousLevel,
          newLevel: result.data?.newLevel,
          newStats: result.data?.newStats,
          pity: result.data?.pity,
          guaranteeUsed: result.data?.guaranteeUsed,
          pityGuaranteeTriggered: result.data?.pityGuaranteeTriggered,
          additionalMessages: result.data?.additionalMessages || []
        }
      });
    } else {
      res.status(400).json({
        error: result.message,
        code: "ENHANCEMENT_FAILED",
        success: false,
        cost: result.cost,
        data: result.data
      });
    }

  } catch (err: any) {
    console.error("Execute enhancement error:", err);
    const errorResponse = handleForgeError(err, "execute_enhancement");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET ENHANCEMENT INFO FOR ITEM ===
router.get("/info/:itemInstanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemInstanceId } = req.params;

    if (!itemInstanceId) {
      res.status(400).json({
        error: "ITEM_INSTANCE_ID_REQUIRED",
        code: "INVALID_PARAMETERS"
      });
      return;
    }

    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('enhancement')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "enhancement"
      });
      return;
    }

    // Obtenir les coûts avec et sans garantie
    const [regularCost, guaranteedCost] = await Promise.all([
      forgeService.getEnhancementCost(itemInstanceId, false),
      forgeService.getEnhancementCost(itemInstanceId, true)
    ]);

    res.json({
      message: "ENHANCEMENT_INFO_RETRIEVED",
      itemInstanceId,
      costs: {
        regular: regularCost,
        guaranteed: guaranteedCost
      },
      limits: {
        maxEnhancementLevel: 30,
        pityResetLevels: [10, 20, 30],
        guaranteedLevels: [10, 20, 30]
      }
    });

  } catch (err: any) {
    console.error("Get enhancement info error:", err);
    const errorResponse = handleForgeError(err, "get_enhancement_info");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET ENHANCEMENT SIMULATOR (MULTIPLE ATTEMPTS) ===
router.post("/simulate", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const simulateSchema = Joi.object({
      itemInstanceId: Joi.string().required(),
      targetLevel: Joi.number().min(1).max(30).required(),
      usePaidGemsToGuarantee: Joi.boolean().default(false),
      simulationCount: Joi.number().min(1).max(100).default(10)
    });

    const { error } = simulateSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemInstanceId, targetLevel, usePaidGemsToGuarantee, simulationCount } = req.body;

    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('enhancement')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "enhancement"
      });
      return;
    }

    // Simuler le coût total pour atteindre le niveau cible
    const simulations = [];
    let totalGold = 0;
    let totalGems = 0;
    let totalPaidGems = 0;
    const materialTotals: { [key: string]: number } = {};

    for (let i = 0; i < simulationCount; i++) {
      try {
        // Pour la simulation, on calcule le coût de chaque niveau jusqu'au target
        let simulationGold = 0;
        let simulationGems = 0;
        let simulationPaidGems = 0;
        const simulationMaterials: { [key: string]: number } = {};

        // Approximation : calculer le coût pour chaque niveau
        for (let level = 1; level < targetLevel; level++) {
          const cost = await forgeService.getEnhancementCost(itemInstanceId, usePaidGemsToGuarantee);
          
          simulationGold += cost.gold;
          simulationGems += cost.gems;
          if ((cost as any).paidGems) simulationPaidGems += (cost as any).paidGems;

          if (cost.materials) {
            for (const [materialId, amount] of Object.entries(cost.materials)) {
              simulationMaterials[materialId] = (simulationMaterials[materialId] || 0) + amount;
            }
          }
        }

        simulations.push({
          gold: simulationGold,
          gems: simulationGems,
          paidGems: simulationPaidGems,
          materials: simulationMaterials
        });

        totalGold += simulationGold;
        totalGems += simulationGems;
        totalPaidGems += simulationPaidGems;

        for (const [materialId, amount] of Object.entries(simulationMaterials)) {
          materialTotals[materialId] = (materialTotals[materialId] || 0) + amount;
        }
      } catch (simErr) {
        // Ignorer les erreurs de simulation individuelle
      }
    }

    res.json({
      message: "ENHANCEMENT_SIMULATION_COMPLETED",
      simulation: {
        itemInstanceId,
        targetLevel,
        usePaidGemsToGuarantee,
        simulationCount,
        averageCost: {
          gold: Math.floor(totalGold / simulationCount),
          gems: Math.floor(totalGems / simulationCount),
          paidGems: Math.floor(totalPaidGems / simulationCount),
          materials: Object.fromEntries(
            Object.entries(materialTotals).map(([id, total]) => [id, Math.floor(total / simulationCount)])
          )
        },
        totalEstimatedCost: {
          gold: totalGold,
          gems: totalGems,
          paidGems: totalPaidGems,
          materials: materialTotals
        }
      }
    });

  } catch (err: any) {
    console.error("Enhancement simulation error:", err);
    const errorResponse = handleForgeError(err, "enhancement_simulation");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET ENHANCEMENT STATISTICS ===
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('enhancement')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "enhancement"
      });
      return;
    }

    const status = await forgeService.getForgeStatus();

    res.json({
      message: "ENHANCEMENT_STATS_RETRIEVED",
      enhancementStats: {
        enabled: status.modules.enhancement.enabled,
        availableOperations: status.modules.enhancement.availableOperations,
        maxLevel: status.modules.enhancement.maxLevel,
        stats: status.modules.enhancement.stats
      },
      gameConstants: {
        maxEnhancementLevel: 30,
        pityResetLevels: [10, 20, 30],
        guaranteedLevels: [10, 20, 30],
        baseSuccessRates: {
          "0-5": 100,
          "6-10": 90,
          "11-15": 70,
          "16-20": 50,
          "21-25": 25,
          "26-29": 10
        }
      },
      playerResources: status.playerResources
    });

  } catch (err: any) {
    console.error("Get enhancement stats error:", err);
    const errorResponse = handleForgeError(err, "get_enhancement_stats");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET ENHANCEABLE ITEMS ===
router.get("/items", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const rarityFilter = req.query.rarity as string;
    const maxLevelFilter = req.query.maxLevel ? parseInt(req.query.maxLevel as string) : undefined;

    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('enhancement')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "enhancement"
      });
      return;
    }

    // Obtenir l'inventaire et filtrer les items enhanceables
    const inventory = await (forgeService as any).getInventory();
    if (!inventory) {
      res.status(404).json({
        error: "INVENTORY_NOT_FOUND",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    const enhanceableItems: any[] = [];
    const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];

    for (const category of equipmentCategories) {
      const items = inventory.storage[category] || [];
      
      for (const ownedItem of items) {
        const currentEnhancement = ownedItem.enhancement || 0;
        
        // Filtrer par niveau max si spécifié
        if (maxLevelFilter && currentEnhancement >= maxLevelFilter) continue;
        
        // Filtrer par rareté si spécifiée (nécessiterait une requête Item)
        if (currentEnhancement < 30) {
          enhanceableItems.push({
            instanceId: ownedItem.instanceId,
            itemId: ownedItem.itemId,
            level: ownedItem.level || 1,
            enhancement: currentEnhancement,
            canEnhance: currentEnhancement < 30,
            nextLevel: currentEnhancement + 1
          });
        }
      }
    }

    // Trier par niveau d'enhancement (plus bas d'abord)
    enhanceableItems.sort((a, b) => a.enhancement - b.enhancement);

    res.json({
      message: "ENHANCEABLE_ITEMS_RETRIEVED",
      filters: {
        rarity: rarityFilter || "all",
        maxLevel: maxLevelFilter || 30
      },
      items: enhanceableItems,
      totalItems: enhanceableItems.length,
      maxEnhancementLevel: 30
    });

  } catch (err: any) {
    console.error("Get enhanceable items error:", err);
    const errorResponse = handleForgeError(err, "get_enhanceable_items");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

export default router;

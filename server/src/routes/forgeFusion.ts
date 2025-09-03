import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import { createForgeService, handleForgeError, validateForgeParams } from "../models/Forge/index";

const router = express.Router();

// === SCHÉMAS DE VALIDATION ===

const fusionCostSchema = Joi.object({
  itemInstanceId: Joi.string().required()
});

const executeFusionSchema = Joi.object({
  itemInstanceIds: Joi.array().items(Joi.string()).length(3).required()
});

const getFusableItemsSchema = Joi.object({
  rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary").optional()
});

const getPossibleFusionsSchema = Joi.object({
  itemId: Joi.string().required(),
  rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary").required()
});

// === GET FUSION COST ===
router.post("/cost", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = fusionCostSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemInstanceId } = req.body;

    const forgeService = createForgeService(req.userId!);

    // Vérifier que le module fusion est activé
    if (!forgeService.isModuleEnabled('fusion')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "fusion"
      });
      return;
    }

    const cost = await forgeService.getFusionCost(itemInstanceId);

    res.json({
      message: "FUSION_COST_RETRIEVED",
      itemInstanceId,
      requiredItems: 3,
      cost,
      maxFusionRarity: "Mythic"
    });

  } catch (err: any) {
    console.error("Fusion cost error:", err);
    const errorResponse = handleForgeError(err, "get_fusion_cost");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === EXECUTE FUSION ===
router.post("/execute", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = executeFusionSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemInstanceIds } = req.body;

    // Validation des paramètres de forge
    const paramValidation = validateForgeParams({ itemInstanceIds }, 'fusion');
    if (!paramValidation.valid) {
      res.status(400).json({
        error: paramValidation.error,
        code: "INVALID_PARAMETERS"
      });
      return;
    }

    const forgeService = createForgeService(req.userId!);

    // Vérifier que le module fusion est activé
    if (!forgeService.isModuleEnabled('fusion')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "fusion"
      });
      return;
    }

    const result = await forgeService.executeFusion(itemInstanceIds);

    if (result.success) {
      res.json({
        message: result.message,
        success: true,
        result: {
          consumedItems: itemInstanceIds,
          cost: result.cost,
          newInstance: result.data?.newInstance,
          newInstanceId: result.data?.newInstanceId,
          previousRarity: result.data?.previousRarity,
          newRarity: result.data?.newRarity,
          conservedLevel: result.data?.conservedLevel,
          conservedEnhancement: result.data?.conservedEnhancement,
          computedStats: result.data?.computedStats,
          rarityMultiplier: result.data?.rarityMultiplier
        }
      });
    } else {
      res.status(400).json({
        error: result.message,
        code: "FUSION_FAILED",
        success: false,
        cost: result.cost,
        data: result.data
      });
    }

  } catch (err: any) {
    console.error("Execute fusion error:", err);
    const errorResponse = handleForgeError(err, "execute_fusion");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET FUSABLE ITEMS ===
router.get("/items", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = getFusableItemsSchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { rarity } = req.query;

    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('fusion')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "fusion"
      });
      return;
    }

    const fusableItems = await forgeService.getFusableItems(rarity as string);

    res.json({
      message: "FUSABLE_ITEMS_RETRIEVED",
      filter: {
        rarity: rarity || "all"
      },
      items: fusableItems,
      totalGroups: fusableItems.length,
      requiredItemsPerFusion: 3,
      maxFusionRarity: "Mythic",
      fusableRarities: ["Common", "Rare", "Epic", "Legendary"]
    });

  } catch (err: any) {
    console.error("Get fusable items error:", err);
    const errorResponse = handleForgeError(err, "get_fusable_items");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET POSSIBLE FUSIONS COUNT ===
router.post("/count", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = getPossibleFusionsSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemId, rarity } = req.body;

    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('fusion')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "fusion"
      });
      return;
    }

    const possibleFusions = await forgeService.getPossibleFusionsCount(itemId, rarity);

    res.json({
      message: "POSSIBLE_FUSIONS_COUNT_RETRIEVED",
      itemId,
      rarity,
      possibleFusions,
      requiredItemsPerFusion: 3,
      totalItemsNeeded: possibleFusions * 3
    });

  } catch (err: any) {
    console.error("Get possible fusions count error:", err);
    const errorResponse = handleForgeError(err, "get_possible_fusions_count");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET FUSION INFO ===
router.get("/info", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('fusion')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "fusion"
      });
      return;
    }

    const status = await forgeService.getForgeStatus();

    res.json({
      message: "FUSION_INFO_RETRIEVED",
      fusionInfo: {
        enabled: status.modules.fusion.enabled,
        availableOperations: status.modules.fusion.availableOperations,
        requiredItems: status.modules.fusion.requiredItems,
        stats: status.modules.fusion.stats
      },
      gameConstants: {
        requiredItemsPerFusion: 3,
        maxFusionRarity: "Mythic",
        fusableRarities: ["Common", "Rare", "Epic", "Legendary"],
        rarityProgression: {
          "Common": "Rare",
          "Rare": "Epic", 
          "Epic": "Legendary",
          "Legendary": "Mythic"
        },
        rarityMultipliers: {
          "Common": 1,
          "Rare": 1.3,
          "Epic": 1.8,
          "Legendary": 2.5,
          "Mythic": 3.5
        }
      },
      playerResources: status.playerResources
    });

  } catch (err: any) {
    console.error("Get fusion info error:", err);
    const errorResponse = handleForgeError(err, "get_fusion_info");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET FUSION PREVIEW ===
router.post("/preview", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = executeFusionSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemInstanceIds } = req.body;

    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('fusion')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "fusion"
      });
      return;
    }

    // Calculer le coût sans exécuter
    const cost = await forgeService.getFusionCost(itemInstanceIds[0]);

    // Simuler le résultat (sans modifier les items)
    const inventory = await (forgeService as any).getInventory();
    if (!inventory) {
      res.status(404).json({
        error: "INVENTORY_NOT_FOUND",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    // Récupérer les items pour preview
    const items = [];
    for (const instanceId of itemInstanceIds) {
      const item = inventory.getItem(instanceId);
      if (item) items.push(item);
    }

    if (items.length !== 3) {
      res.status(400).json({
        error: "FUSION_REQUIRES_EXACTLY_THREE_ITEMS",
        code: "INVALID_FUSION_REQUIREMENTS"
      });
      return;
    }

    // Calculer les valeurs conservées
    const conservedLevel = Math.ceil(items.reduce((sum, item) => sum + (item.level || 1), 0) / items.length);
    const conservedEnhancement = Math.max(...items.map(item => item.enhancement || 0));

    res.json({
      message: "FUSION_PREVIEW_SUCCESS",
      preview: {
        consumedItems: itemInstanceIds,
        itemCount: items.length,
        cost,
        conservedLevel,
        conservedEnhancement,
        requirementsCheck: {
          sameItemId: true, // À vérifier réellement
          sameRarity: true, // À vérifier réellement
          correctQuantity: items.length === 3
        }
      }
    });

  } catch (err: any) {
    console.error("Fusion preview error:", err);
    const errorResponse = handleForgeError(err, "fusion_preview");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET FUSION RECIPES ===
router.get("/recipes", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('fusion')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "fusion"
      });
      return;
    }

    // Obtenir tous les items fusionnables groupés par type
    const fusableItems = await forgeService.getFusableItems();

    // Transformer en "recettes" avec informations détaillées
    const recipes = [];
    for (const fusableGroup of fusableItems) {
      const possibleFusions = await forgeService.getPossibleFusionsCount(fusableGroup.itemId, fusableGroup.rarity);
      
      if (possibleFusions > 0) {
        // Calculer la rareté cible
        const rarityOrder = ["Common", "Rare", "Epic", "Legendary", "Mythic"];
        const currentIndex = rarityOrder.indexOf(fusableGroup.rarity);
        const targetRarity = currentIndex >= 0 && currentIndex < rarityOrder.length - 1 ? 
          rarityOrder[currentIndex + 1] : null;

        if (targetRarity) {
          recipes.push({
            itemId: fusableGroup.itemId,
            itemName: fusableGroup.name,
            currentRarity: fusableGroup.rarity,
            targetRarity,
            availableItems: fusableGroup.count,
            possibleFusions,
            requiredItems: 3
          });
        }
      }
    }

    res.json({
      message: "FUSION_RECIPES_RETRIEVED",
      recipes,
      totalRecipes: recipes.length,
      requiredItemsPerFusion: 3
    });

  } catch (err: any) {
    console.error("Get fusion recipes error:", err);
    const errorResponse = handleForgeError(err, "get_fusion_recipes");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

export default router;

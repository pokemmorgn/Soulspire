import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import { createForgeService, handleForgeError, validateForgeParams } from "../models/Forge/index";

const router = express.Router();

// === SCHÉMAS DE VALIDATION ===

const tierUpgradeCostSchema = Joi.object({
  itemInstanceId: Joi.string().required(),
  targetTier: Joi.number().min(2).max(5).optional()
});

const executeTierUpgradeSchema = Joi.object({
  itemInstanceId: Joi.string().required(),
  targetTier: Joi.number().min(2).max(5).optional()
});

const getUpgradableItemsSchema = Joi.object({
  rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended").optional()
});

const getTotalCostSchema = Joi.object({
  itemInstanceId: Joi.string().required()
});

// === GET TIER UPGRADE COST ===
router.post("/cost", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = tierUpgradeCostSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemInstanceId, targetTier } = req.body;

    // Validation des paramètres de forge
    const paramValidation = validateForgeParams({ itemInstanceId, targetTier }, 'tierUpgrade');
    if (!paramValidation.valid) {
      res.status(400).json({
        error: paramValidation.error,
        code: "INVALID_PARAMETERS"
      });
      return;
    }

    const forgeService = createForgeService(req.userId!);

    // Vérifier que le module tierUpgrade est activé
    if (!forgeService.isModuleEnabled('tierUpgrade')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "tierUpgrade"
      });
      return;
    }

    const cost = await forgeService.getTierUpgradeCost(itemInstanceId, targetTier);

    res.json({
      message: "TIER_UPGRADE_COST_RETRIEVED",
      itemInstanceId,
      targetTier: targetTier || "next",
      maxTier: 5,
      cost
    });

  } catch (err: any) {
    console.error("Tier upgrade cost error:", err);
    const errorResponse = handleForgeError(err, "get_tier_upgrade_cost");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === EXECUTE TIER UPGRADE ===
router.post("/execute", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = executeTierUpgradeSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemInstanceId, targetTier } = req.body;

    // Validation des paramètres de forge
    const paramValidation = validateForgeParams({ itemInstanceId, targetTier }, 'tierUpgrade');
    if (!paramValidation.valid) {
      res.status(400).json({
        error: paramValidation.error,
        code: "INVALID_PARAMETERS"
      });
      return;
    }

    const forgeService = createForgeService(req.userId!);

    // Vérifier que le module tierUpgrade est activé
    if (!forgeService.isModuleEnabled('tierUpgrade')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "tierUpgrade"
      });
      return;
    }

    const result = await forgeService.executeTierUpgrade(itemInstanceId, targetTier);

    if (result.success) {
      res.json({
        message: result.message,
        success: true,
        result: {
          itemInstanceId: result.data?.instanceId,
          cost: result.cost,
          previousTier: result.data?.previousTier,
          newTier: result.data?.newTier,
          tierMultiplier: result.data?.tierMultiplier,
          computedStats: result.data?.computedStats,
          maxTierReached: result.data?.maxTierReached
        }
      });
    } else {
      res.status(400).json({
        error: result.message,
        code: "TIER_UPGRADE_FAILED",
        success: false,
        cost: result.cost,
        data: result.data
      });
    }

  } catch (err: any) {
    console.error("Execute tier upgrade error:", err);
    const errorResponse = handleForgeError(err, "execute_tier_upgrade");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET UPGRADABLE ITEMS ===
router.get("/items", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = getUpgradableItemsSchema.validate(req.query);
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

    if (!forgeService.isModuleEnabled('tierUpgrade')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "tierUpgrade"
      });
      return;
    }

    const upgradableItems = await forgeService.getUpgradableItems(rarity as string);

    res.json({
      message: "UPGRADABLE_ITEMS_RETRIEVED",
      filter: {
        rarity: rarity || "all"
      },
      items: upgradableItems,
      totalItems: upgradableItems.length,
      maxTier: 5,
      tierLimits: {
        "Common": 2,
        "Rare": 3,
        "Epic": 4,
        "Legendary": 5,
        "Mythic": 5,
        "Ascended": 5
      }
    });

  } catch (err: any) {
    console.error("Get upgradable items error:", err);
    const errorResponse = handleForgeError(err, "get_upgradable_items");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET TOTAL UPGRADE COST TO MAX ===
router.post("/cost/total", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = getTotalCostSchema.validate(req.body);
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

    if (!forgeService.isModuleEnabled('tierUpgrade')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "tierUpgrade"
      });
      return;
    }

    const totalCost = await forgeService.getTotalUpgradeCostToMax(itemInstanceId);

    res.json({
      message: "TOTAL_UPGRADE_COST_RETRIEVED",
      itemInstanceId,
      totalCost: {
        gold: totalCost.totalGold,
        gems: totalCost.totalGems,
        materials: totalCost.totalMaterials
      },
      upgradeSteps: totalCost.steps,
      totalSteps: totalCost.steps.length
    });

  } catch (err: any) {
    console.error("Get total upgrade cost error:", err);
    const errorResponse = handleForgeError(err, "get_total_upgrade_cost");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET TIER UPGRADE INFO ===
router.get("/info", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('tierUpgrade')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "tierUpgrade"
      });
      return;
    }

    const status = await forgeService.getForgeStatus();

    res.json({
      message: "TIER_UPGRADE_INFO_RETRIEVED",
      tierUpgradeInfo: {
        enabled: status.modules.tierUpgrade.enabled,
        availableOperations: status.modules.tierUpgrade.availableOperations,
        maxTier: status.modules.tierUpgrade.maxTier,
        stats: status.modules.tierUpgrade.stats
      },
      gameConstants: {
        maxTier: 5,
        tierMultipliers: {
          1: 1.0,
          2: 1.25,
          3: 1.60,
          4: 2.10,
          5: 2.80
        },
        tierLimitsByRarity: {
          "Common": 2,
          "Rare": 3,
          "Epic": 4,
          "Legendary": 5,
          "Mythic": 5,
          "Ascended": 5
        },
        costMultipliers: {
          1: 1,
          2: 3,
          3: 8,
          4: 20,
          5: 50
        }
      },
      playerResources: status.playerResources
    });

  } catch (err: any) {
    console.error("Get tier upgrade info error:", err);
    const errorResponse = handleForgeError(err, "get_tier_upgrade_info");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET TIER UPGRADE PREVIEW ===
router.post("/preview", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = tierUpgradeCostSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { itemInstanceId, targetTier } = req.body;

    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('tierUpgrade')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "tierUpgrade"
      });
      return;
    }

    // Obtenir le coût et les informations sur l'item
    const cost = await forgeService.getTierUpgradeCost(itemInstanceId, targetTier);

    // Récupérer les informations de l'item pour le preview
    const inventory = await (forgeService as any).getInventory();
    if (!inventory) {
      res.status(404).json({
        error: "INVENTORY_NOT_FOUND",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    const ownedItem = inventory.getItem(itemInstanceId);
    if (!ownedItem) {
      res.status(404).json({
        error: "ITEM_NOT_FOUND_IN_INVENTORY",
        code: "ITEM_NOT_FOUND"
      });
      return;
    }

    // Calculer le tier actuel
    const currentTier = (ownedItem as any).tier || 1;
    const nextTier = targetTier || currentTier + 1;

    // Calculer les multiplicateurs
    const tierMultipliers: { [tier: number]: number } = {
      1: 1.0, 2: 1.25, 3: 1.60, 4: 2.10, 5: 2.80
    };

    const currentMultiplier = tierMultipliers[currentTier] || 1.0;
    const newMultiplier = tierMultipliers[nextTier] || 1.0;

    res.json({
      message: "TIER_UPGRADE_PREVIEW_SUCCESS",
      preview: {
        itemInstanceId,
        currentTier,
        targetTier: nextTier,
        cost,
        multipliers: {
          current: currentMultiplier,
          new: newMultiplier,
          improvement: ((newMultiplier / currentMultiplier - 1) * 100).toFixed(1) + "%"
        },
        canUpgrade: nextTier <= 5 && nextTier > currentTier
      }
    });

  } catch (err: any) {
    console.error("Tier upgrade preview error:", err);
    const errorResponse = handleForgeError(err, "tier_upgrade_preview");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// === GET TIER UPGRADE MATERIALS ===
router.get("/materials/:rarity/:targetTier", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const materialsSchema = Joi.object({
      rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended").required(),
      targetTier: Joi.number().min(2).max(5).required()
    });

    const { error } = materialsSchema.validate(req.params);
    if (error) {
      res.status(400).json({ 
        error: "VALIDATION_ERROR",
        code: "VALIDATION_ERROR",
        details: error.details[0].message
      });
      return;
    }

    const { rarity, targetTier } = req.params;

    const forgeService = createForgeService(req.userId!);

    if (!forgeService.isModuleEnabled('tierUpgrade')) {
      res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: "tierUpgrade"
      });
      return;
    }

    // Simuler les matériaux requis (approximation basée sur les constantes)
    const tierMaterials: { [tier: number]: { [materialId: string]: number } } = {
      2: { "tier_stone": 5, "enhancement_dust": 10 },
      3: { "tier_stone": 10, "enhancement_dust": 20, "rare_crystal": 3 },
      4: { "tier_stone": 20, "enhancement_dust": 40, "rare_crystal": 8, "epic_essence": 2 },
      5: { "tier_stone": 40, "enhancement_dust": 80, "rare_crystal": 20, "epic_essence": 5, "legendary_core": 1 }
    };

    const rarityMaterials: { [rarity: string]: { [materialId: string]: number } } = {
      "Rare": { "silver_thread": 2 },
      "Epic": { "golden_thread": 3, "mystic_ore": 1 },
      "Legendary": { "platinum_thread": 4, "mystic_ore": 2, "divine_shard": 1 },
      "Mythic": { "mythic_thread": 5, "divine_shard": 2, "celestial_essence": 1 },
      "Ascended": { "ascended_thread": 8, "celestial_essence": 2, "primordial_fragment": 1 }
    };

    const baseMaterials = tierMaterials[parseInt(targetTier)] || {};
    const additionalMaterials = rarityMaterials[rarity] || {};

    const allMaterials = { ...baseMaterials, ...additionalMaterials };

    // Appliquer le scaling de tier
    const tierNum = parseInt(targetTier);
    const scalingFactor = Math.pow(1.5, tierNum - 2);
    const scaledMaterials: { [materialId: string]: number } = {};

    for (const [materialId, amount] of Object.entries(allMaterials)) {
      scaledMaterials[materialId] = Math.ceil(amount * scalingFactor);
    }

    res.json({
      message: "TIER_UPGRADE_MATERIALS_RETRIEVED",
      rarity,
      targetTier: parseInt(targetTier),
      materials: scaledMaterials,
      scalingFactor: scalingFactor.toFixed(2)
    });

  } catch (err: any) {
    console.error("Get tier upgrade materials error:", err);
    const errorResponse = handleForgeError(err, "get_tier_upgrade_materials");
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

export default router;

import express, { Request, Response } from "express";
import Joi from "joi";
import Forge from "../models/Forge";
import Player from "../models/Player";
import Inventory from "../models/Inventory";
import Item from "../models/Item";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// === SCHÉMAS DE VALIDATION ===

const reforgePreviewSchema = Joi.object({
  itemInstanceId: Joi.string().required(),
  lockedStats: Joi.array().items(Joi.string()).max(4).default([])
});

const executeReforgeSchema = Joi.object({
  itemInstanceId: Joi.string().required(),
  lockedStats: Joi.array().items(Joi.string()).max(4).default([]),
  confirmCost: Joi.boolean().default(false) // Pour confirmer que le joueur accepte le coût
});

const forgeConfigSchema = Joi.object({
  configId: Joi.string().required(),
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  isActive: Joi.boolean().default(true)
});

// === GET FORGE STATUS ===
router.get("/status", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    // Récupérer la forge active
    const forge = await (Forge as any).getActiveForge();
    if (!forge) {
      res.status(404).json({ 
        error: "No active forge configuration found",
        code: "FORGE_NOT_ACTIVE"
      });
      return;
    }

    // Récupérer les stats du joueur
    const [player, inventory] = await Promise.all([
      Player.findById(req.userId).select("gold gems paidGems level vipLevel"),
      Inventory.findOne({ playerId: req.userId }).select("maxCapacity")
    ]);

    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    // Compter les objets reforgeables dans l'inventaire
    let reforgeableItems = 0;
    if (inventory) {
      const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
      equipmentCategories.forEach(category => {
        const items = inventory.storage[category as keyof typeof inventory.storage] as any[];
        if (Array.isArray(items)) {
          reforgeableItems += items.length;
        }
      });
    }

    res.json({
      message: "Forge status retrieved successfully",
      forge: {
        configId: forge.configId,
        name: forge.name,
        description: forge.description,
        isActive: forge.isActive,
        totalReforges: forge.totalReforges,
        totalGoldSpent: forge.totalGoldSpent,
        totalGemsSpent: forge.totalGemsSpent
      },
      player: {
        resources: {
          gold: player.gold,
          gems: player.gems,
          paidGems: player.paidGems
        },
        level: player.level,
        vipLevel: player.vipLevel || 0
      },
      inventory: {
        reforgeableItems,
        maxCapacity: inventory?.maxCapacity || 200
      },
      costs: {
        baseCosts: forge.config.baseCosts,
        lockMultipliers: forge.config.lockMultipliers,
        qualityMultipliers: Object.fromEntries(forge.config.qualityMultipliers)
      }
    });
  } catch (err) {
    console.error("Get forge status error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_FORGE_STATUS_FAILED"
    });
  }
});

// === GET REFORGE PREVIEW ===
router.post("/preview", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { error } = reforgePreviewSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { itemInstanceId, lockedStats } = req.body;

    // Récupérer la forge active
    const forge = await (Forge as any).getActiveForge();
    if (!forge) {
      res.status(404).json({ 
        error: "No active forge found",
        code: "FORGE_NOT_ACTIVE"
      });
      return;
    }

    // Obtenir le preview
    const preview = await forge.getItemReforgePreview(req.userId, itemInstanceId, lockedStats);

    // Récupérer les données de l'objet pour l'affichage
    const [inventory, player] = await Promise.all([
      Inventory.findOne({ playerId: req.userId }),
      Player.findById(req.userId).select("gold gems paidGems")
    ]);

    if (!inventory || !player) {
      res.status(404).json({ 
        error: "Player or inventory not found",
        code: "DATA_NOT_FOUND"
      });
      return;
    }

    const ownedItem = inventory.getItem(itemInstanceId);
    const baseItem = await Item.findOne({ itemId: ownedItem?.itemId });

    // Calculer si le joueur peut se permettre le reforge
    const canAfford = player.canAfford(preview.cost);
    
    // Vérifier les matériaux si nécessaire
    let hasMaterials = true;
    const missingMaterials: string[] = [];
    
    if (preview.cost.materials) {
      for (const [materialId, requiredAmount] of Object.entries(preview.cost.materials)) {
        if (!inventory.hasItem(materialId, requiredAmount)) {
          hasMaterials = false;
          missingMaterials.push(materialId);
        }
      }
    }

    res.json({
      message: "Reforge preview calculated successfully",
      preview: {
        ...preview,
        canAfford,
        hasMaterials,
        missingMaterials
      },
      item: {
        instanceId: ownedItem?.instanceId,
        itemId: ownedItem?.itemId,
        name: baseItem?.name,
        level: ownedItem?.level,
        enhancement: ownedItem?.enhancement,
        rarity: baseItem?.rarity,
        equipmentSlot: baseItem?.equipmentSlot,
        currentReforges: ownedItem?.equipmentData?.upgradeHistory?.length || 0
      },
      playerResources: {
        gold: player.gold,
        gems: player.gems,
        paidGems: player.paidGems
      }
    });
  } catch (err: any) {
    console.error("Get reforge preview error:", err);
    res.status(500).json({ 
      error: err.message || "Internal server error",
      code: "GET_PREVIEW_FAILED"
    });
  }
});

// === EXECUTE REFORGE ===
router.post("/execute", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { error } = executeReforgeSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { itemInstanceId, lockedStats, confirmCost } = req.body;

    if (!confirmCost) {
      res.status(400).json({ 
        error: "Cost confirmation required",
        code: "COST_NOT_CONFIRMED"
      });
      return;
    }

    // Récupérer la forge active
    const forge = await (Forge as any).getActiveForge();
    if (!forge) {
      res.status(404).json({ 
        error: "No active forge found",
        code: "FORGE_NOT_ACTIVE"
      });
      return;
    }

    // Sauvegarder les stats avant reforge (pour l'historique)
    const inventory = await Inventory.findOne({ playerId: req.userId });
    const ownedItem = inventory?.getItem(itemInstanceId);
    const baseItem = await Item.findOne({ itemId: ownedItem?.itemId });
    
    if (!ownedItem || !baseItem) {
      res.status(404).json({ 
        error: "Item not found",
        code: "ITEM_NOT_FOUND"
      });
      return;
    }

    const previousStats = forge.calculateCurrentItemStats(baseItem, ownedItem);

    // Exécuter le reforge
    const result = await forge.executeReforge(req.userId, itemInstanceId, lockedStats);

    // Récupérer les données mises à jour
    const [updatedPlayer, updatedInventory] = await Promise.all([
      Player.findById(req.userId).select("gold gems paidGems"),
      Inventory.findOne({ playerId: req.userId })
    ]);

    const updatedOwnedItem = updatedInventory?.getItem(itemInstanceId);

    res.json({
      message: "Reforge executed successfully",
      result: {
        ...result,
        previousStats,
        improvement: this.calculateStatImprovement(previousStats, result.newStats)
      },
      item: {
        instanceId: updatedOwnedItem?.instanceId,
        itemId: updatedOwnedItem?.itemId,
        name: baseItem.name,
        level: updatedOwnedItem?.level,
        enhancement: updatedOwnedItem?.enhancement,
        rarity: baseItem.rarity,
        totalReforges: result.reforgeCount
      },
      playerResources: {
        gold: updatedPlayer?.gold,
        gems: updatedPlayer?.gems,
        paidGems: updatedPlayer?.paidGems
      }
    });
  } catch (err: any) {
    console.error("Execute reforge error:", err);
    res.status(500).json({ 
      error: err.message || "Internal server error",
      code: "EXECUTE_REFORGE_FAILED"
    });
  }
});

// === GET AVAILABLE STATS FOR SLOT ===
router.get("/stats/:equipmentSlot", async (req: Request, res: Response): Promise<void> => {
  try {
    const { equipmentSlot } = req.params;

    const forge = await (Forge as any).getActiveForge();
    if (!forge) {
      res.status(404).json({ 
        error: "No active forge found",
        code: "FORGE_NOT_ACTIVE"
      });
      return;
    }

    const slotConfig = forge.config.slotConfigs.find((config: any) => config.slot === equipmentSlot);
    if (!slotConfig) {
      res.status(404).json({ 
        error: `No configuration found for equipment slot: ${equipmentSlot}`,
        code: "SLOT_CONFIG_NOT_FOUND"
      });
      return;
    }

    // Récupérer les ranges de stats par rareté
    const statRangesByRarity: any = {};
    for (const [rarity, ranges] of forge.config.statRanges.entries()) {
      statRangesByRarity[rarity] = {};
      slotConfig.availableStats.forEach((stat: string) => {
        const range = ranges.get(stat);
        if (range) {
          statRangesByRarity[rarity][stat] = range;
        }
      });
    }

    res.json({
      message: `Available stats for ${equipmentSlot} retrieved successfully`,
      equipmentSlot,
      availableStats: slotConfig.availableStats,
      minStats: slotConfig.minStats,
      maxStats: slotConfig.maxStats,
      statRangesByRarity
    });
  } catch (err) {
    console.error("Get available stats error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_STATS_FAILED"
    });
  }
});

// === GET REFORGE COST CALCULATOR ===
router.post("/cost-calculator", async (req: Request, res: Response): Promise<void> => {
  try {
    const { rarity, lockedStats, reforgeCount } = req.body;

    if (!rarity || !Array.isArray(lockedStats)) {
      res.status(400).json({ 
        error: "Invalid parameters. Rarity and lockedStats array required",
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const forge = await (Forge as any).getActiveForge();
    if (!forge) {
      res.status(404).json({ 
        error: "No active forge found",
        code: "FORGE_NOT_ACTIVE"
      });
      return;
    }

    const cost = forge.calculateReforgeCost(rarity, lockedStats, reforgeCount || 0);

    res.json({
      message: "Reforge cost calculated successfully",
      rarity,
      lockedStats,
      reforgeCount: reforgeCount || 0,
      cost,
      explanation: {
        baseCost: forge.config.baseCosts,
        appliedMultipliers: cost.multipliers
      }
    });
  } catch (err) {
    console.error("Calculate reforge cost error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "CALCULATE_COST_FAILED"
    });
  }
});

// === GET REFORGE HISTORY ===
router.get("/history/:itemInstanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { itemInstanceId } = req.params;

    // Vérifier que l'objet appartient au joueur
    const inventory = await Inventory.findOne({ playerId: req.userId });
    const ownedItem = inventory?.getItem(itemInstanceId);
    
    if (!ownedItem) {
      res.status(404).json({ 
        error: "Item not found or does not belong to player",
        code: "ITEM_NOT_FOUND"
      });
      return;
    }

    const forge = await (Forge as any).getActiveForge();
    const history = forge?.getReforgeHistory(itemInstanceId) || [];

    // Récupérer les informations de base de l'objet
    const baseItem = await Item.findOne({ itemId: ownedItem.itemId });

    res.json({
      message: "Reforge history retrieved successfully",
      item: {
        instanceId: ownedItem.instanceId,
        itemId: ownedItem.itemId,
        name: baseItem?.name,
        level: ownedItem.level,
        enhancement: ownedItem.enhancement,
        totalReforges: ownedItem.equipmentData?.upgradeHistory?.length || 0
      },
      history,
      reforgeTimestamps: ownedItem.equipmentData?.upgradeHistory || []
    });
  } catch (err) {
    console.error("Get reforge history error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_HISTORY_FAILED"
    });
  }
});

// === ADMIN: GET FORGE ANALYTICS ===
router.get("/admin/analytics", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    
    const forge = await (Forge as any).getActiveForge();
    if (!forge) {
      res.status(404).json({ 
        error: "No active forge found",
        code: "FORGE_NOT_ACTIVE"
      });
      return;
    }

    // Récupérer des statistiques globales
    const [totalPlayers, totalInventories] = await Promise.all([
      Player.countDocuments(),
      Inventory.countDocuments()
    ]);

    // Calculer les statistiques de reforge
    const averageReforgesPerGold = forge.totalGoldSpent > 0 ? 
      Math.round(forge.totalReforges / (forge.totalGoldSpent / 1000)) : 0;

    res.json({
      message: "Forge analytics retrieved successfully",
      analytics: {
        totalReforges: forge.totalReforges,
        totalGoldSpent: forge.totalGoldSpent,
        totalGemsSpent: forge.totalGemsSpent,
        averageReforgesPerGold,
        totalPlayers,
        totalInventories,
        averageReforgesPerPlayer: totalPlayers > 0 ? 
          Math.round(forge.totalReforges / totalPlayers * 100) / 100 : 0
      },
      config: {
        configId: forge.configId,
        name: forge.name,
        isActive: forge.isActive,
        lastUpdated: forge.updatedAt
      }
    });
  } catch (err) {
    console.error("Get forge analytics error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_ANALYTICS_FAILED"
    });
  }
});

// === ADMIN: CREATE/UPDATE FORGE CONFIG ===
router.post("/admin/config", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    
    const { error } = forgeConfigSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    // Désactiver les autres forges
    await Forge.updateMany({}, { isActive: false });

    // Créer ou mettre à jour la forge
    const forge = await Forge.findOneAndUpdate(
      { configId: req.body.configId },
      req.body,
      { upsert: true, new: true }
    );

    res.json({
      message: "Forge configuration saved successfully",
      forge: {
        configId: forge.configId,
        name: forge.name,
        description: forge.description,
        isActive: forge.isActive,
        createdAt: forge.createdAt,
        updatedAt: forge.updatedAt
      }
    });
  } catch (err) {
    console.error("Save forge config error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "SAVE_CONFIG_FAILED"
    });
  }
});

// === ADMIN: INITIALIZE DEFAULT FORGE ===
router.post("/admin/initialize", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    
    const existingForge = await (Forge as any).getActiveForge();
    if (existingForge) {
      res.status(409).json({ 
        error: "A forge configuration already exists",
        code: "FORGE_ALREADY_EXISTS"
      });
      return;
    }

    const defaultForge = (Forge as any).createDefaultForge();
    await defaultForge.save();

    res.status(201).json({
      message: "Default forge configuration created successfully",
      forge: {
        configId: defaultForge.configId,
        name: defaultForge.name,
        description: defaultForge.description,
        isActive: defaultForge.isActive
      }
    });
  } catch (err) {
    console.error("Initialize forge error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "INITIALIZE_FORGE_FAILED"
    });
  }
});

// === HELPER FUNCTION FOR STAT IMPROVEMENT ===
function calculateStatImprovement(oldStats: any, newStats: any): any {
  const improvement: any = {};
  const allStats = new Set([...Object.keys(oldStats), ...Object.keys(newStats)]);
  
  for (const stat of allStats) {
    const oldValue = oldStats[stat] || 0;
    const newValue = newStats[stat] || 0;
    const difference = newValue - oldValue;
    
    improvement[stat] = {
      old: oldValue,
      new: newValue,
      difference,
      percentage: oldValue > 0 ? Math.round((difference / oldValue) * 100) : (newValue > 0 ? 100 : 0)
    };
  }
  
  return improvement;
}

export default router;

import express, { Request, Response } from "express";
import Joi from "joi";
import { InventoryService } from "../services/InventoryService";
import authMiddleware from "../middleware/authMiddleware";
import serverMiddleware from "../middleware/serverMiddleware";

const router = express.Router();

// ✅ APPLIQUER le middleware serveur à toutes les routes
router.use(serverMiddleware);

// === SCHÉMAS DE VALIDATION ===

const addItemSchema = Joi.object({
  itemId: Joi.string().required(),
  quantity: Joi.number().min(1).max(999).default(1),
  level: Joi.number().min(1).max(100).default(1),
  enhancement: Joi.number().min(0).max(15).default(0)
});

const equipItemSchema = Joi.object({
  instanceId: Joi.string().required(),
  heroId: Joi.string().required()
});

const removeItemSchema = Joi.object({
  quantity: Joi.number().min(1).optional()
});

const openChestSchema = Joi.object({
  instanceId: Joi.string().required()
});

// === ROUTES PRINCIPALES ===

/**
 * GET /api/inventory
 * Récupérer l'inventaire complet du joueur
 */
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = req.playerId || req.userId;
    const serverId = req.serverId;

    if (!playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const result = await InventoryService.getPlayerInventory(playerId, serverId);

    res.json({
      message: "Inventory retrieved successfully",
      serverId,
      ...result
    });

  } catch (error: any) {
    console.error("Get inventory error:", error);
    
    if (error.message === "Player not found") {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
    } else if (error.message === "Player not found on this server") {
      res.status(404).json({ 
        error: "Player not found on this server",
        code: "WRONG_SERVER"
      });
    } else {
      res.status(500).json({ 
        error: "Failed to retrieve inventory",
        code: "GET_INVENTORY_FAILED"
      });
    }
  }
});

/**
 * GET /api/inventory/category/:category
 * Récupérer les objets par catégorie
 */
router.get("/category/:category", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = req.playerId || req.userId;
    const serverId = req.serverId;

    if (!playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { category } = req.params;
    const { subCategory } = req.query;

    // Validation de la catégorie
    const validCategories = ["Equipment", "Consumable", "Material", "Artifact", "Chest", "Fragment"];
    if (!validCategories.includes(category)) {
      res.status(400).json({
        error: "Invalid category",
        code: "INVALID_CATEGORY",
        validCategories
      });
      return;
    }

    const result = await InventoryService.getItemsByCategory(
      playerId,
      category,
      subCategory as string,
      serverId
    );

    res.json({
      message: `${category} items retrieved successfully`,
      serverId,
      ...result
    });

  } catch (error: any) {
    console.error("Get items by category error:", error);
    
    if (error.message === "Inventory not found") {
      res.status(404).json({
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
    } else if (error.message === "Player not found on this server") {
      res.status(404).json({
        error: "Player not found on this server",
        code: "WRONG_SERVER"
      });
    } else {
      res.status(500).json({
        error: "Failed to retrieve items",
        code: "GET_ITEMS_FAILED"
      });
    }
  }
});

/**
 * POST /api/inventory/add
 * Ajouter un objet à l'inventaire
 */
router.post("/add", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = req.playerId || req.userId;
    const serverId = req.serverId;

    if (!playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { error, value } = addItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { itemId, quantity, level, enhancement } = value;

    const result = await InventoryService.addItem(
      playerId,
      itemId,
      quantity,
      level,
      enhancement,
      serverId
    );

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "ITEM_NOT_FOUND" || result.code === "PLAYER_NOT_FOUND") statusCode = 404;
      if (result.code === "INVENTORY_FULL") statusCode = 409; // Conflict
      if (result.code === "WRONG_SERVER") statusCode = 403; // Forbidden

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: result.item?.autoSold ? "Item auto-sold due to full inventory" : "Item added successfully",
      serverId,
      ...result
    });

  } catch (error: any) {
    console.error("Add item error:", error);
    res.status(500).json({ 
      error: "Failed to add item",
      code: "ADD_ITEM_FAILED"
    });
  }
});

/**
 * DELETE /api/inventory/item/:instanceId
 * Supprimer un objet de l'inventaire
 */
router.delete("/item/:instanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = req.playerId || req.userId;
    const serverId = req.serverId;

    if (!playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { instanceId } = req.params;
    const { error, value } = removeItemSchema.validate(req.query);
    
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { quantity } = value;

    const result = await InventoryService.removeItem(playerId, instanceId, quantity, serverId);

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "INVENTORY_NOT_FOUND" || result.code === "ITEM_NOT_FOUND") {
        statusCode = 404;
      }
      if (result.code === "WRONG_SERVER") {
        statusCode = 403;
      }

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: "Item removed successfully",
      serverId,
      ...result
    });

  } catch (error: any) {
    console.error("Remove item error:", error);
    res.status(500).json({ 
      error: "Failed to remove item",
      code: "REMOVE_ITEM_FAILED"
    });
  }
});

/**
 * POST /api/inventory/equip
 * Équiper un objet sur un héros
 */
router.post("/equip", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = req.playerId || req.userId;
    const serverId = req.serverId;

    if (!playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { error, value } = equipItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { instanceId, heroId } = value;

    const result = await InventoryService.equipItem(playerId, instanceId, heroId, serverId);

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "PLAYER_NOT_FOUND" || result.code === "INVENTORY_NOT_FOUND" || 
          result.code === "EQUIPMENT_NOT_FOUND" || result.code === "HERO_NOT_OWNED") {
        statusCode = 404;
      }
      if (result.code === "NOT_EQUIPMENT") statusCode = 422; // Unprocessable Entity
      if (result.code === "WRONG_SERVER") statusCode = 403; // Forbidden

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: "Equipment equipped successfully",
      serverId,
      ...result
    });

  } catch (error: any) {
    console.error("Equip item error:", error);
    res.status(500).json({ 
      error: "Failed to equip item",
      code: "EQUIP_ITEM_FAILED"
    });
  }
});

/**
 * POST /api/inventory/unequip/:instanceId
 * Déséquiper un objet
 */
router.post("/unequip/:instanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = req.playerId || req.userId;
    const serverId = req.serverId;

    if (!playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { instanceId } = req.params;

    const result = await InventoryService.unequipItem(playerId, instanceId, serverId);

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "INVENTORY_NOT_FOUND" || result.code === "EQUIPMENT_NOT_FOUND") {
        statusCode = 404;
      }
      if (result.code === "NOT_EQUIPPED") statusCode = 422; // Unprocessable Entity
      if (result.code === "WRONG_SERVER") statusCode = 403; // Forbidden

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: "Equipment unequipped successfully",
      serverId,
      ...result
    });

  } catch (error: any) {
    console.error("Unequip item error:", error);
    res.status(500).json({ 
      error: "Failed to unequip item",
      code: "UNEQUIP_ITEM_FAILED"
    });
  }
});

/**
 * POST /api/inventory/chest/open
 * Ouvrir un coffre
 */
router.post("/chest/open", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = req.playerId || req.userId;
    const serverId = req.serverId;

    if (!playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { error, value } = openChestSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { instanceId } = value;

    const result = await InventoryService.openChest(playerId, instanceId, serverId);

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "INVENTORY_NOT_FOUND" || result.code === "CHEST_NOT_FOUND") {
        statusCode = 404;
      }
      if (result.code === "NOT_A_CHEST") statusCode = 422; // Unprocessable Entity
      if (result.code === "WRONG_SERVER") statusCode = 403; // Forbidden

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: "Chest opened successfully",
      serverId,
      ...result
    });

  } catch (error: any) {
    console.error("Open chest error:", error);
    res.status(500).json({ 
      error: "Failed to open chest",
      code: "OPEN_CHEST_FAILED"
    });
  }
});

/**
 * GET /api/inventory/equipped/:heroId
 * Récupérer les objets équipés d'un héros
 */
router.get("/equipped/:heroId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = req.playerId || req.userId;
    const serverId = req.serverId;

    if (!playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { heroId } = req.params;

    const inventoryResult = await InventoryService.getPlayerInventory(playerId, serverId);
    
    if (!inventoryResult.success) {
      res.status(404).json({
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    // Filtrer les objets équipés pour ce héros
    const equippedItems: any[] = [];
    const storage = inventoryResult.inventory.storage as unknown as Record<string, any[]>;

    // Parcourir toutes les catégories d'équipement
    const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
    
    equipmentCategories.forEach(category => {
      if (storage[category]) {
        storage[category].forEach((item: any) => {
          if (item.isEquipped && item.equippedTo === heroId) {
            equippedItems.push(item);
          }
        });
      }
    });

    res.json({
      message: "Equipped items retrieved successfully",
      serverId,
      heroId,
      items: equippedItems,
      count: equippedItems.length
    });

  } catch (error: any) {
    console.error("Get equipped items error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve equipped items",
      code: "GET_EQUIPPED_ITEMS_FAILED"
    });
  }
});

/**
 * POST /api/inventory/cleanup
 * Nettoyer les objets expirés
 */
router.post("/cleanup", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = req.playerId || req.userId;
    const serverId = req.serverId;

    if (!playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const result = await InventoryService.cleanupExpiredItems(playerId, serverId);

    res.json({
      ...result,
      serverId
    });

  } catch (error: any) {
    console.error("Cleanup inventory error:", error);
    
    if (error.message === "Inventory not found") {
      res.status(404).json({
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
    } else if (error.message === "Player not found on this server") {
      res.status(404).json({
        error: "Player not found on this server", 
        code: "WRONG_SERVER"
      });
    } else {
      res.status(500).json({
        error: "Failed to cleanup inventory",
        code: "CLEANUP_FAILED"
      });
    }
  }
});

/**
 * GET /api/inventory/stats
 * Récupérer les statistiques de l'inventaire
 */
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = req.playerId || req.userId;
    const serverId = req.serverId;

    if (!playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const inventoryResult = await InventoryService.getPlayerInventory(playerId, serverId);
    
    if (!inventoryResult.success) {
      res.status(404).json({
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    res.json({
      message: "Inventory statistics retrieved successfully",
      serverId,
      stats: inventoryResult.stats,
      config: inventoryResult.config
    });

  } catch (error: any) {
    console.error("Get inventory stats error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve inventory statistics",
      code: "GET_STATS_FAILED"
    });
  }
});

/**
 * POST /api/inventory/sync-currencies
 * Synchroniser les monnaies Player <-> Inventory
 */
router.post("/sync-currencies", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = req.playerId || req.userId;

    if (!playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const success = await InventoryService.syncCurrencies(playerId);

    if (!success) {
      res.status(404).json({
        error: "Failed to sync currencies - player or inventory not found",
        code: "SYNC_FAILED"
      });
      return;
    }

    res.json({
      message: "Currencies synchronized successfully",
      success: true,
      serverId: req.serverId
    });

  } catch (error: any) {
    console.error("Sync currencies error:", error);
    res.status(500).json({ 
      error: "Failed to sync currencies",
      code: "SYNC_CURRENCIES_FAILED"
    });
  }
});

/**
 * GET /api/inventory/health
 * Vérifier la santé du système d'inventaire
 */
router.get("/health", async (req: Request, res: Response): Promise<void> => {
  try {
    const serverId = req.serverId;
    
    const globalStats = await InventoryService.getGlobalStats(serverId);

    res.json({
      status: "healthy",
      timestamp: new Date(),
      system: "InventoryService",
      version: "2.0.0",
      server: serverId,
      ...globalStats
    });

  } catch (error: any) {
    console.error("Inventory health check error:", error);
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date(),
      system: "InventoryService",
      serverId: req.serverId
    });
  }
});

export default router;

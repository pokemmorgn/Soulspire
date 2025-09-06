import express, { Request, Response } from "express";
import Joi from "joi";
import { InventoryService } from "../services/InventoryService";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

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

const categorySchema = Joi.object({
  category: Joi.string().required(),
  subCategory: Joi.string().optional()
});

// === ROUTES PRINCIPALES ===

/**
 * GET /api/inventory
 * Récupérer l'inventaire complet du joueur
 */
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const result = await InventoryService.getPlayerInventory(req.playerId);

    res.json({
      message: "Inventory retrieved successfully",
      ...result
    });

  } catch (error: any) {
    console.error("Get inventory error:", error);
    
    if (error.message === "Player not found") {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
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
    if (!req.playerId) {
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
      req.playerId,
      category,
      subCategory as string
    );

    res.json({
      message: `${category} items retrieved successfully`,
      ...result
    });

  } catch (error: any) {
    console.error("Get items by category error:", error);
    
    if (error.message === "Inventory not found") {
      res.status(404).json({
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
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
    if (!req.playerId) {
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
      req.playerId,
      itemId,
      quantity,
      level,
      enhancement
    );

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "ITEM_NOT_FOUND") statusCode = 404;
      if (result.code === "INVENTORY_FULL") statusCode = 409; // Conflict

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: result.item?.autoSold ? "Item auto-sold due to full inventory" : "Item added successfully",
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
    if (!req.playerId) {
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

    const result = await InventoryService.removeItem(req.playerId, instanceId, quantity);

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "INVENTORY_NOT_FOUND" || result.code === "ITEM_NOT_FOUND") {
        statusCode = 404;
      }

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: "Item removed successfully",
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
    if (!req.playerId) {
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

    const result = await InventoryService.equipItem(req.playerId, instanceId, heroId);

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "PLAYER_NOT_FOUND" || result.code === "INVENTORY_NOT_FOUND" || 
          result.code === "EQUIPMENT_NOT_FOUND" || result.code === "HERO_NOT_OWNED") {
        statusCode = 404;
      }
      if (result.code === "NOT_EQUIPMENT") statusCode = 422; // Unprocessable Entity

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: "Equipment equipped successfully",
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
    if (!req.playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { instanceId } = req.params;

    const result = await InventoryService.unequipItem(req.playerId, instanceId);

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "INVENTORY_NOT_FOUND" || result.code === "EQUIPMENT_NOT_FOUND") {
        statusCode = 404;
      }
      if (result.code === "NOT_EQUIPPED") statusCode = 422; // Unprocessable Entity

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: "Equipment unequipped successfully",
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
    if (!req.playerId) {
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

    const result = await InventoryService.openChest(req.playerId, instanceId);

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "INVENTORY_NOT_FOUND" || result.code === "CHEST_NOT_FOUND") {
        statusCode = 404;
      }
      if (result.code === "NOT_A_CHEST") statusCode = 422; // Unprocessable Entity

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: "Chest opened successfully",
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
    if (!req.playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { heroId } = req.params;

    // On utilise la méthode du service pour récupérer l'inventaire complet
    // puis on filtre les objets équipés
    const inventoryResult = await InventoryService.getPlayerInventory(req.playerId);
    
    if (!inventoryResult.success) {
      res.status(404).json({
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    // Filtrer les objets équipés pour ce héros
    const equippedItems: any[] = [];
    // Cast storage to a string-indexed record so we can safely use string keys
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
    if (!req.playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const result = await InventoryService.cleanupExpiredItems(req.playerId);

    res.json(result);

  } catch (error: any) {
    console.error("Cleanup inventory error:", error);
    
    if (error.message === "Inventory not found") {
      res.status(404).json({
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
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
    if (!req.playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const inventoryResult = await InventoryService.getPlayerInventory(req.playerId);
    
    if (!inventoryResult.success) {
      res.status(404).json({
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    res.json({
      message: "Inventory statistics retrieved successfully",
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
 * GET /api/inventory/health
 * Vérifier la santé du système d'inventaire
 */
router.get("/health", async (req: Request, res: Response): Promise<void> => {
  try {
    // Obtenir les statistiques globales
    const globalStats = await InventoryService.getGlobalStats();

    res.json({
      status: "healthy",
      timestamp: new Date(),
      system: "InventoryService",
      version: "1.0.0",
      ...globalStats
    });

  } catch (error: any) {
    console.error("Inventory health check error:", error);
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date(),
      system: "InventoryService"
    });
  }
});

export default router;


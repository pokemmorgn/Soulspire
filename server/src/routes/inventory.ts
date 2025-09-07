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
    // ✅ CORRECTION: Utiliser playerId au lieu de userId si disponible
    const playerId = req.playerId || req.userId;
    const serverId = req.serverId;

    if (!playerId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    // ✅ PASSER le serverId au service
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
      subCategory as string
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

    // ✅ PASSER le serverId au service
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

    // ✅ PASSER le serverId au service
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

    // ✅ PASSER le serverId au service
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
      if (result.code === "WRONG_SERVER

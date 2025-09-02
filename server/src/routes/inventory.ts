import express, { Request, Response } from "express";
import Joi from "joi";
import Player from "../models/Player";
import Inventory from "../models/Inventory";
import Item from "../models/Item";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// Schémas de validation
const addItemSchema = Joi.object({
  itemId: Joi.string().required(),
  quantity: Joi.number().min(1).default(1),
  level: Joi.number().min(1).max(100).default(1),
  enhancement: Joi.number().min(0).max(15).default(0)
});

const equipItemSchema = Joi.object({
  instanceId: Joi.string().required(),
  heroId: Joi.string().required()
});

const openChestSchema = Joi.object({
  instanceId: Joi.string().required()
});

const upgradeItemSchema = Joi.object({
  instanceId: Joi.string().required(),
  targetLevel: Joi.number().min(1).max(100).optional(),
  targetEnhancement: Joi.number().min(0).max(15).optional()
});

// === GET PLAYER INVENTORY ===
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // Récupération depuis le modèle Player (monnaies)
    const player = await Player.findById(req.userId)
      .select("gold gems paidGems tickets fragments materials");

    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    // Récupération de l'inventaire complet
    let inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      inventory = new Inventory({ playerId: req.userId });
      await inventory.save();
    }

    // Sécurisation des Maps
    const fragmentsMap = player.fragments || new Map();
    const materialsMap = player.materials || new Map();
    const fragmentsObj = Object.fromEntries(fragmentsMap.entries());
    const materialsObj = Object.fromEntries(materialsMap.entries());

    // Calcul des statistiques avec le nouveau système
    const stats = inventory.getInventoryStats();

    res.json({
      message: "Inventory retrieved successfully",
      inventory: {
        currency: {
          gold: player.gold,
          gems: player.gems,
          paidGems: player.paidGems,
          tickets: player.tickets
        },
        fragments: fragmentsObj,
        materials: materialsObj,
        storage: inventory.storage
      },
      stats,
      config: {
        maxCapacity: inventory.maxCapacity,
        autoSell: inventory.autoSell,
        autoSellRarity: inventory.autoSellRarity
      }
    });
  } catch (err) {
    console.error("Get inventory error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_INVENTORY_FAILED"
    });
  }
});

// === GET ITEMS BY CATEGORY ===
router.get("/category/:category", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    const { subCategory } = req.query;

    const inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      res.status(404).json({ 
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    const items = inventory.getItemsByCategory(category, subCategory as string);

    res.json({
      message: `${category} items retrieved successfully`,
      category,
      subCategory,
      items,
      count: items.length
    });
  } catch (err) {
    console.error("Get items by category error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_ITEMS_FAILED"
    });
  }
});

// === ADD ITEM TO INVENTORY ===
router.post("/add", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = addItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { itemId, quantity, level, enhancement } = req.body;

    // Vérifier que l'objet existe
    const item = await Item.findOne({ itemId });
    if (!item) {
      res.status(404).json({ 
        error: "Item not found",
        code: "ITEM_NOT_FOUND"
      });
      return;
    }

    let inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      inventory = new Inventory({ playerId: req.userId });
    }

    const ownedItem = await inventory.addItem(itemId, quantity, level);
    if (enhancement && enhancement > 0) {
      ownedItem.enhancement = enhancement;
      await inventory.save();
    }

    res.json({
      message: "Item added successfully",
      item: ownedItem,
      itemData: item
    });
  } catch (err) {
    console.error("Add item error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "ADD_ITEM_FAILED"
    });
  }
});

// === REMOVE ITEM ===
router.delete("/item/:instanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const { quantity } = req.query;

    const inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      res.status(404).json({ 
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    const removed = await inventory.removeItem(instanceId, quantity ? parseInt(quantity as string) : undefined);
    
    if (!removed) {
      res.status(404).json({ 
        error: "Item not found",
        code: "ITEM_NOT_FOUND"
      });
      return;
    }

    res.json({
      message: "Item removed successfully",
      instanceId
    });
  } catch (err) {
    console.error("Remove item error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "REMOVE_ITEM_FAILED"
    });
  }
});

// === EQUIP ITEM TO HERO ===
router.post("/equip", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = equipItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { instanceId, heroId } = req.body;

    const [player, inventory] = await Promise.all([
      Player.findById(req.userId),
      Inventory.findOne({ playerId: req.userId })
    ]);

    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    if (!inventory) {
      res.status(404).json({ 
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    // Vérifier que le joueur possède ce héros
    const playerHero = player.heroes.find(h => h.heroId.toString() === heroId);
    if (!playerHero) {
      res.status(404).json({ 
        error: "Hero not owned by player",
        code: "HERO_NOT_OWNED"
      });
      return;
    }

    const success = await inventory.equipItem(instanceId, heroId);
    
    if (!success) {
      res.status(404).json({ 
        error: "Equipment not found or cannot be equipped",
        code: "EQUIP_FAILED"
      });
      return;
    }

    res.json({
      message: "Equipment equipped successfully",
      instanceId,
      heroId
    });
  } catch (err) {
    console.error("Equip item error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "EQUIP_ITEM_FAILED"
    });
  }
});

// === UNEQUIP ITEM ===
router.post("/unequip/:instanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;

    const inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      res.status(404).json({ 
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    const success = await inventory.unequipItem(instanceId);
    
    if (!success) {
      res.status(404).json({ 
        error: "Equipment not found or not equipped",
        code: "UNEQUIP_FAILED"
      });
      return;
    }

    res.json({
      message: "Equipment unequipped successfully",
      instanceId
    });
  } catch (err) {
    console.error("Unequip item error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "UNEQUIP_ITEM_FAILED"
    });
  }
});

// === UPGRADE EQUIPMENT ===
router.post("/upgrade", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = upgradeItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { instanceId, targetLevel, targetEnhancement } = req.body;

    const inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      res.status(404).json({ 
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    const success = await inventory.upgradeEquipment(instanceId, targetLevel, targetEnhancement);
    
    if (!success) {
      res.status(400).json({ 
        error: "Upgrade failed - insufficient resources or invalid target",
        code: "UPGRADE_FAILED"
      });
      return;
    }

    res.json({
      message: "Equipment upgraded successfully",
      instanceId,
      newLevel: targetLevel,
      newEnhancement: targetEnhancement
    });
  } catch (err) {
    console.error("Upgrade equipment error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "UPGRADE_EQUIPMENT_FAILED"
    });
  }
});

// === OPEN CHEST ===
router.post("/chest/open", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = openChestSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { instanceId } = req.body;

    const inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      res.status(404).json({ 
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    // Trouver le coffre dans l'inventaire (il faudra implémenter cette logique)
    const chestItem = inventory.getItem(instanceId);
    if (!chestItem) {
      res.status(404).json({ 
        error: "Chest not found",
        code: "CHEST_NOT_FOUND"
      });
      return;
    }

    // Récupérer les données du coffre
    const itemData = await Item.findOne({ itemId: chestItem.itemId });
    if (!itemData || itemData.category !== "Chest") {
      res.status(400).json({ 
        error: "Item is not a chest",
        code: "NOT_A_CHEST"
      });
      return;
    }

    // Vérifier que userId existe
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    // Ouvrir le coffre
    const rewards = await itemData.openChest(req.userId);
    
    // Supprimer le coffre de l'inventaire
    await inventory.removeItem(instanceId, 1);

    // Ajouter les récompenses à l'inventaire (logique simplifiée)
    const addedItems = [];
    for (const reward of rewards) {
      if (reward.type === "Item" && reward.itemId) {
        const ownedItem = await inventory.addItem(reward.itemId, reward.quantity);
        addedItems.push(ownedItem);
      }
      // TODO: Gérer les autres types de récompenses (Currency, Fragment, Hero)
    }

    res.json({
      message: "Chest opened successfully",
      rewards,
      addedItems
    });
  } catch (err) {
    console.error("Open chest error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "OPEN_CHEST_FAILED"
    });
  }
});

// === GET EQUIPPED ITEMS FOR HERO ===
router.get("/equipped/:heroId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { heroId } = req.params;

    const inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      res.status(404).json({ 
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    const equippedItems = inventory.getEquippedItems(heroId);

    res.json({
      message: "Equipped items retrieved successfully",
      heroId,
      items: equippedItems,
      count: equippedItems.length
    });
  } catch (err) {
    console.error("Get equipped items error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_EQUIPPED_ITEMS_FAILED"
    });
  }
});

// === CLEANUP EXPIRED ITEMS ===
router.post("/cleanup", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      res.status(404).json({ 
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    const removedCount = await inventory.cleanupExpiredItems();

    res.json({
      message: "Inventory cleanup completed",
      removedItems: removedCount
    });
  } catch (err) {
    console.error("Cleanup inventory error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "CLEANUP_FAILED"
    });
  }
});

export default router;

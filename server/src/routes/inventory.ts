import express, { Request, Response } from "express";
import Joi from "joi";
import Player from "../models/Player";
import Inventory from "../models/Inventory";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// Schémas de validation
const addItemSchema = Joi.object({
  itemId: Joi.string().required(),
  name: Joi.string().required(),
  type: Joi.string().valid("Weapon", "Armor", "Accessory").required(),
  rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary").required(),
  level: Joi.number().min(1).max(100).default(1),
  stats: Joi.object({
    atk: Joi.number().min(0).default(0),
    def: Joi.number().min(0).default(0),
    hp: Joi.number().min(0).default(0)
  }).default({ atk: 0, def: 0, hp: 0 })
});

const addMaterialSchema = Joi.object({
  materialId: Joi.string().required(),
  quantity: Joi.number().min(1).required()
});

const addFragmentSchema = Joi.object({
  heroId: Joi.string().required(),
  quantity: Joi.number().min(1).required()
});

const equipItemSchema = Joi.object({
  itemId: Joi.string().required(),
  heroId: Joi.string().required()
});

// === GET PLAYER INVENTORY ===
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // Récupération depuis le modèle Player (inventaire intégré)
    const player = await Player.findById(req.userId)
      .select("gold gems paidGems tickets fragments materials");

    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    // Récupération de l'équipement depuis le modèle Inventory séparé
    let inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      inventory = new Inventory({ playerId: req.userId });
      await inventory.save();
    }

    // ✅ Sécurisation : fallback sur {} si undefined ou null
    const fragmentsMap = player.fragments || new Map();
    const materialsMap = player.materials || new Map();

    const fragmentsObj = Object.fromEntries(fragmentsMap.entries());
    const materialsObj = Object.fromEntries(materialsMap.entries());

    // Statistiques de l'inventaire
    const stats = {
      totalEquipment: inventory.equipment.length,
      equipmentByType: {
        Weapon: inventory.equipment.filter(item => item.type === "Weapon").length,
        Armor: inventory.equipment.filter(item => item.type === "Armor").length,
        Accessory: inventory.equipment.filter(item => item.type === "Accessory").length
      },
      equipmentByRarity: {
        Common: inventory.equipment.filter(item => item.rarity === "Common").length,
        Rare: inventory.equipment.filter(item => item.rarity === "Rare").length,
        Epic: inventory.equipment.filter(item => item.rarity === "Epic").length,
        Legendary: inventory.equipment.filter(item => item.rarity === "Legendary").length
      },
      totalFragments: Object.values(fragmentsObj).reduce((sum: number, count: number) => sum + count, 0),
      totalMaterials: Object.values(materialsObj).reduce((sum: number, count: number) => sum + count, 0),
      equippedItems: inventory.equipment.filter(item => item.equippedTo).length
    };

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
        equipment: inventory.equipment
      },
      stats
    });
  } catch (err) {
    console.error("Get inventory error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_INVENTORY_FAILED"
    });
  }
});

// === ADD EQUIPMENT ===
router.post("/equipment/add", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = addItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    let inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      inventory = new Inventory({ playerId: req.userId });
    }

    const newEquipment = {
      itemId: req.body.itemId,
      name: req.body.name,
      type: req.body.type,
      rarity: req.body.rarity,
      level: req.body.level || 1,
      stats: req.body.stats || { atk: 0, def: 0, hp: 0 }
    };

    inventory.equipment.push(newEquipment);
    await inventory.save();

    res.json({
      message: "Equipment added successfully",
      equipment: newEquipment
    });
  } catch (err) {
    console.error("Add equipment error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "ADD_EQUIPMENT_FAILED"
    });
  }
});

// === REMOVE EQUIPMENT ===
router.delete("/equipment/:itemId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;

    const inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      res.status(404).json({ 
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    const itemIndex = inventory.equipment.findIndex(item => item.itemId === itemId);
    if (itemIndex === -1) {
      res.status(404).json({ 
        error: "Equipment not found",
        code: "EQUIPMENT_NOT_FOUND"
      });
      return;
    }

    // Vérifier si l'équipement est équipé
    if (inventory.equipment[itemIndex].equippedTo) {
      res.status(400).json({ 
        error: "Cannot remove equipped item. Unequip it first.",
        code: "ITEM_EQUIPPED"
      });
      return;
    }

    inventory.equipment.splice(itemIndex, 1);
    await inventory.save();

    res.json({
      message: "Equipment removed successfully",
      itemId
    });
  } catch (err) {
    console.error("Remove equipment error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "REMOVE_EQUIPMENT_FAILED"
    });
  }
});

// === EQUIP ITEM TO HERO ===
router.post("/equipment/equip", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = equipItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { itemId, heroId } = req.body;

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

    // Trouver l'équipement
    const equipment = inventory.equipment.find(item => item.itemId === itemId);
    if (!equipment) {
      res.status(404).json({ 
        error: "Equipment not found",
        code: "EQUIPMENT_NOT_FOUND"
      });
      return;
    }

    // Déséquiper l'ancien équipement du même type sur ce héros
    const existingEquipment = inventory.equipment.find(
      item => item.equippedTo?.toString() === heroId && item.type === equipment.type
    );
    if (existingEquipment) {
      existingEquipment.equippedTo = undefined;
    }

    // Équiper le nouvel équipement
    equipment.equippedTo = playerHero._id;
    await inventory.save();

    res.json({
      message: "Equipment equipped successfully",
      equipment: {
        itemId: equipment.itemId,
        name: equipment.name,
        type: equipment.type,
        equippedTo: heroId
      },
      unequipped: existingEquipment ? {
        itemId: existingEquipment.itemId,
        name: existingEquipment.name
      } : null
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
router.post("/equipment/unequip", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.body;

    const inventory = await Inventory.findOne({ playerId: req.userId });
    if (!inventory) {
      res.status(404).json({ 
        error: "Inventory not found",
        code: "INVENTORY_NOT_FOUND"
      });
      return;
    }

    const equipment = inventory.equipment.find(item => item.itemId === itemId);
    if (!equipment) {
      res.status(404).json({ 
        error: "Equipment not found",
        code: "EQUIPMENT_NOT_FOUND"
      });
      return;
    }

    if (!equipment.equippedTo) {
      res.status(400).json({ 
        error: "Equipment is not equipped",
        code: "EQUIPMENT_NOT_EQUIPPED"
      });
      return;
    }

    equipment.equippedTo = undefined;
    await inventory.save();

    res.json({
      message: "Equipment unequipped successfully",
      equipment: {
        itemId: equipment.itemId,
        name: equipment.name,
        type: equipment.type
      }
    });
  } catch (err) {
    console.error("Unequip item error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "UNEQUIP_ITEM_FAILED"
    });
  }
});

// === ADD MATERIALS ===
router.post("/materials/add", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = addMaterialSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { materialId, quantity } = req.body;

    const player = await Player.findById(req.userId);
    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    const currentQuantity = player.materials.get(materialId) || 0;
    player.materials.set(materialId, currentQuantity + quantity);
    await player.save();

    res.json({
      message: "Materials added successfully",
      material: {
        id: materialId,
        quantity: player.materials.get(materialId)
      }
    });
  } catch (err) {
    console.error("Add materials error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "ADD_MATERIALS_FAILED"
    });
  }
});

// === ADD FRAGMENTS ===
router.post("/fragments/add", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = addFragmentSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { heroId, quantity } = req.body;

    const player = await Player.findById(req.userId);
    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    const currentQuantity = player.fragments.get(heroId) || 0;
    player.fragments.set(heroId, currentQuantity + quantity);
    await player.save();

    res.json({
      message: "Fragments added successfully",
      fragment: {
        heroId,
        quantity: player.fragments.get(heroId)
      }
    });
  } catch (err) {
    console.error("Add fragments error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "ADD_FRAGMENTS_FAILED"
    });
  }
});

export default router;


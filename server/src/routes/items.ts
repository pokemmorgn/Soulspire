import express, { Request, Response } from "express";
import Joi from "joi";
import Item from "../models/Item";
import authMiddleware, { optionalAuthMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

// === Schémas de validation ===
const itemFilterSchema = Joi.object({
  category: Joi.string().valid("Equipment", "Consumable", "Material", "Currency", "Fragment", "Scroll", "Artifact", "Chest").optional(),
  subCategory: Joi.string().optional(),
  rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended").optional(),
  equipmentSlot: Joi.string().valid("Weapon", "Helmet", "Armor", "Boots", "Gloves", "Accessory").optional(),
  chestType: Joi.string().valid("Common", "Elite", "Epic", "Legendary", "Special", "Event").optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  search: Joi.string().optional()
});

const iconUrlPattern = /^(https?:\/\/.+|icons\/.+)$/;

const createItemSchema = Joi.object({
  itemId: Joi.string().required(),
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).default(""),
  // ⬇️ iconUrl accepté ; sinon le modèle posera la valeur par défaut.
  iconUrl: Joi.string().pattern(iconUrlPattern).optional(),
  category: Joi.string().valid("Equipment", "Consumable", "Material", "Currency", "Fragment", "Scroll", "Artifact", "Chest").required(),
  subCategory: Joi.string().required(),
  rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended").required(),
  tier: Joi.number().min(1).max(10).default(1),
  maxLevel: Joi.number().min(1).max(100).default(1),
  baseStats: Joi.object().optional(),
  statsPerLevel: Joi.object().optional(),
  effects: Joi.array().optional(),
  equipmentSlot: Joi.string().valid("Weapon", "Helmet", "Armor", "Boots", "Gloves", "Accessory").optional(),
  classRestriction: Joi.array().items(Joi.string().valid("Tank", "DPS Melee", "DPS Ranged", "Support", "All")).optional(),
  levelRequirement: Joi.number().min(1).default(1),
  consumableType: Joi.string().valid("Potion", "Scroll", "Enhancement", "XP", "Currency").optional(),
  materialType: Joi.string().valid("Enhancement", "Evolution", "Crafting", "Awakening").optional(),
  chestType: Joi.string().valid("Common", "Elite", "Epic", "Legendary", "Special", "Event").optional(),
  chestContents: Joi.array().optional()
});

// (Optionnel) mini schéma pour PUT quand on passe seulement iconUrl
const updateIconUrlSchema = Joi.object({
  iconUrl: Joi.string().pattern(iconUrlPattern).required()
}).unknown(true);

const chestPreviewSchema = Joi.object({
  itemId: Joi.string().required()
});

// === GET ALL ITEMS (CATALOG) ===
router.get("/catalog", optionalAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = itemFilterSchema.validate(req.query);
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const {
      category,
      subCategory,
      rarity,
      equipmentSlot,
      chestType,
      page,
      limit,
      search
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Construction du filtre
    const filter: any = {};
    if (category) filter.category = category;
    if (subCategory) filter.subCategory = subCategory;
    if (rarity) filter.rarity = rarity;
    if (equipmentSlot) filter.equipmentSlot = equipmentSlot;
    if (chestType) filter.chestType = chestType;

    // Recherche textuelle
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const [items, total] = await Promise.all([
      Item.find(filter)
        .select("itemId name description iconUrl category subCategory rarity tier baseStats equipmentSlot chestType sellPrice")
        //                                   ^ add iconUrl
        .skip(skip)
        .limit(limitNum)
        .sort({ category: 1, rarity: 1, name: 1 }),
      Item.countDocuments(filter)
    ]);

    const pagination = {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    };

    res.json({
      message: "Items catalog retrieved successfully",
      items,
      pagination,
      filters: {
        category,
        subCategory,
        rarity,
        equipmentSlot,
        chestType,
        search
      }
    });
  } catch (err) {
    console.error("Get items catalog error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "GET_CATALOG_FAILED"
    });
  }
});

// === GET ITEMS BY CATEGORY ===
router.get("/category/:category", optionalAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    const { subCategory } = req.query;

    const items = await (Item as any).getByCategory(category, subCategory as string);

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
      code: "GET_CATEGORY_FAILED"
    });
  }
});

// === GET CHEST CONTENTS PREVIEW ===
// ⚠️ Important: placé AVANT "/:itemId" pour ne pas être intercepté par la route paramétrique.
router.get("/chest/:itemId/preview", async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;

    const chest = await Item.findOne({ itemId, category: "Chest" });
    if (!chest) {
      res.status(404).json({
        error: "Chest not found",
        code: "CHEST_NOT_FOUND"
      });
      return;
    }

    const preview = chest.getChestPreview();

    res.json({
      message: "Chest preview retrieved successfully",
      chest: {
        itemId: chest.itemId,
        name: chest.name,
        chestType: chest.chestType,
        rarity: chest.rarity,
        openCost: chest.openCost,
        guaranteedRarity: chest.guaranteedRarity
      },
      contents: preview,
      totalDropRate: preview.reduce((sum, content) => sum + content.dropRate, 0)
    });
  } catch (err) {
    console.error("Get chest preview error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "GET_CHEST_PREVIEW_FAILED"
    });
  }
});

// === GET EQUIPMENT SETS ===
router.get("/sets/list", async (req: Request, res: Response): Promise<void> => {
  try {
    const equipmentWithSets = await Item.find({
      category: "Equipment",
      "equipmentSet.setId": { $exists: true, $ne: null }
    }).select("itemId name iconUrl equipmentSlot equipmentSet rarity");
      //                         ^ add iconUrl

    // Grouper par setId
    const sets: { [setId: string]: any } = {};

    equipmentWithSets.forEach(item => {
      const setId = item.equipmentSet?.setId;
      if (setId) {
        if (!sets[setId]) {
          sets[setId] = {
            setId,
            setName: item.equipmentSet?.setName,
            pieces: [],
            totalPieces: 0
          };
        }
        sets[setId].pieces.push({
          itemId: (item as any).itemId,
          name: (item as any).name,
          slot: (item as any).equipmentSlot,
          rarity: (item as any).rarity,
          iconUrl: (item as any).iconUrl
        });
        sets[setId].totalPieces++;
      }
    });

    res.json({
      message: "Equipment sets retrieved successfully",
      sets: Object.values(sets),
      totalSets: Object.keys(sets).length
    });
  } catch (err) {
    console.error("Get equipment sets error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "GET_SETS_FAILED"
    });
  }
});

// === GET SPECIFIC ITEM DETAILS ===
router.get("/:itemId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;

    const item = await Item.findOne({ itemId });
    if (!item) {
      res.status(404).json({
        error: "Item not found",
        code: "ITEM_NOT_FOUND"
      });
      return;
    }

    // Calculer les stats à différents niveaux pour l'équipement
    let statsByLevel: Array<{ level: number; stats: any }> = [];
    if (item.category === "Equipment" && item.maxLevel > 1) {
      const levels = [1, Math.floor(item.maxLevel / 4), Math.floor(item.maxLevel / 2), Math.floor(item.maxLevel * 3 / 4), item.maxLevel];
      statsByLevel = levels.map(level => ({
        level,
        stats: (item as any).getStatsAtLevel(level)
      }));
    }

    res.json({
      message: "Item details retrieved successfully",
      item: {
        ...item.toObject(),
        statsByLevel,
        canBeEquippedBy: item.category === "Equipment" ? {
          Tank: (item as any).canBeEquippedBy("Tank", 1),
          "DPS Melee": (item as any).canBeEquippedBy("DPS Melee", 1),
          "DPS Ranged": (item as any).canBeEquippedBy("DPS Ranged", 1),
          Support: (item as any).canBeEquippedBy("Support", 1)
        } : null
      }
    });
  } catch (err) {
    console.error("Get item details error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "GET_ITEM_DETAILS_FAILED"
    });
  }
});

// === CREATE ITEM (ADMIN ONLY) ===
router.post("/create", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    const { error } = createItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    // Vérifier que l'itemId n'existe pas déjà
    const existingItem = await Item.findOne({ itemId: req.body.itemId });
    if (existingItem) {
      res.status(409).json({
        error: "Item with this ID already exists",
        code: "ITEM_ID_EXISTS"
      });
      return;
    }

    const newItem = new Item(req.body);
    await newItem.save();

    res.status(201).json({
      message: "Item created successfully",
      item: newItem
    });
  } catch (err) {
    console.error("Create item error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "CREATE_ITEM_FAILED"
    });
  }
});

// === UPDATE ITEM (ADMIN ONLY) ===
router.put("/:itemId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    const { itemId } = req.params;

    // Si iconUrl présent, on le valide rapidement
    if (typeof req.body.iconUrl === "string") {
      const { error } = updateIconUrlSchema.validate({ iconUrl: req.body.iconUrl });
      if (error) {
        res.status(400).json({
          error: error.details[0].message,
          code: "VALIDATION_ERROR"
        });
        return;
      }
    }

    const item = await Item.findOne({ itemId });
    if (!item) {
      res.status(404).json({
        error: "Item not found",
        code: "ITEM_NOT_FOUND"
      });
      return;
    }

    // Mise à jour des champs
    Object.assign(item, req.body);
    await item.save();

    res.json({
      message: "Item updated successfully",
      item
    });
  } catch (err) {
    console.error("Update item error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "UPDATE_ITEM_FAILED"
    });
  }
});

// === DELETE ITEM (ADMIN ONLY) ===
router.delete("/:itemId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    const { itemId } = req.params;

    const deletedItem = await Item.findOneAndDelete({ itemId });
    if (!deletedItem) {
      res.status(404).json({
        error: "Item not found",
        code: "ITEM_NOT_FOUND"
      });
      return;
    }

    res.json({
      message: "Item deleted successfully",
      itemId
    });
  } catch (err) {
    console.error("Delete item error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "DELETE_ITEM_FAILED"
    });
  }
});

// === GENERATE SAMPLE ITEMS (DEV ONLY) ===
router.post("/dev/generate-samples", async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter protection dev/admin

    const sampleItems = [
      {
        itemId: "iron_sword_t1",
        name: "Iron Sword",
        description: "A sturdy iron sword for warriors",
        iconUrl: "icons/weapons/iron_sword_t1.png", // optionnel (le modèle peut générer)
        category: "Equipment",
        subCategory: "One_Hand_Sword",
        rarity: "Common",
        tier: 1,
        maxLevel: 20,
        baseStats: { atk: 25, hp: 10 },
        statsPerLevel: { atk: 2, hp: 1 },
        equipmentSlot: "Weapon",
        classRestriction: ["Tank", "DPS Melee"],
        levelRequirement: 1
      },
      {
        itemId: "health_potion_small",
        name: "Small Health Potion",
        description: "Restores 100 HP instantly",
        iconUrl: "icons/consumables/health_potion_small.png",
        category: "Consumable",
        subCategory: "Health_Potion",
        rarity: "Common",
        consumableType: "Potion",
        consumableEffect: {
          type: "heal",
          value: 100
        }
      },
      {
        itemId: "common_chest",
        name: "Common Treasure Chest",
        description: "Contains various common rewards",
        iconUrl: "icons/chests/common_chest.png",
        category: "Chest",
        subCategory: "Common_Chest",
        rarity: "Common",
        chestType: "Common",
        openCost: { gold: 1000 },
        chestContents: [
          {
            type: "Currency",
            currencyType: "gold",
            quantity: 500,
            dropRate: 80
          },
          {
            type: "Item",
            itemId: "iron_sword_t1",
            quantity: 1,
            dropRate: 20
          }
        ],
        guaranteedRarity: "Common"
      }
    ];

    const createdItems: any[] = [];
    for (const itemData of sampleItems) {
      const existingItem = await Item.findOne({ itemId: itemData.itemId });
      if (!existingItem) {
        const newItem = new Item(itemData);
        await newItem.save();
        createdItems.push(newItem);
      }
    }

    res.json({
      message: "Sample items generated successfully",
      createdItems: createdItems.length,
      items: createdItems.map(item => ({ itemId: (item as any).itemId, name: (item as any).name }))
    });
  } catch (err) {
    console.error("Generate sample items error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "GENERATE_SAMPLES_FAILED"
    });
  }
});

export default router;

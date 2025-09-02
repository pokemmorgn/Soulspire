import express, { Request, Response } from "express";
import Joi from "joi";
import Shop from "../models/Shop";
import Player from "../models/Player";
import Inventory from "../models/Inventory";
import Item from "../models/Item";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// Schémas de validation
const shopFilterSchema = Joi.object({
  shopType: Joi.string().valid("General", "Arena", "Clan", "Labyrinth", "Event", "VIP", "Daily", "Weekly", "Monthly", "Flash", "Bundle", "Seasonal").optional(),
  isActive: Joi.boolean().optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(50).default(10)
});

const purchaseSchema = Joi.object({
  instanceId: Joi.string().required(),
  quantity: Joi.number().min(1).default(1)
});

const refreshShopSchema = Joi.object({
  shopType: Joi.string().valid("General", "Arena", "Clan", "Labyrinth", "Event", "VIP", "Daily", "Weekly", "Monthly", "Flash", "Bundle", "Seasonal").required()
});

const createShopSchema = Joi.object({
  shopType: Joi.string().valid("General", "Arena", "Clan", "Labyrinth", "Event", "VIP", "Daily", "Weekly", "Monthly", "Flash", "Bundle", "Seasonal").required(),
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  resetFrequency: Joi.string().valid("never", "daily", "weekly", "monthly", "event").default("never"),
  maxItemsShown: Joi.number().min(1).max(20).default(8),
  levelRequirement: Joi.number().min(1).default(1),
  vipLevelRequirement: Joi.number().min(0).optional(),
  priority: Joi.number().min(1).max(100).default(50)
});

// === GET ALL SHOPS FOR PLAYER ===
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { error } = shopFilterSchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { shopType, isActive, page, limit } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Récupérer le joueur pour vérifier les conditions d'accès
    const player = await Player.findById(req.userId)
      .select("level vipLevel");

    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    // Construire le filtre
    const filter: any = { 
      isActive: isActive !== undefined ? isActive : true,
      levelRequirement: { $lte: player.level }
    };
    
    if (shopType) filter.shopType = shopType;
    if (player.vipLevel) {
      filter.$or = [
        { vipLevelRequirement: { $exists: false } },
        { vipLevelRequirement: { $lte: player.vipLevel } }
      ];
    }

    const now = new Date();
    filter.$and = [
      {
        $or: [
          { startTime: { $exists: false } },
          { startTime: { $lte: now } }
        ]
      },
      {
        $or: [
          { endTime: { $exists: false } },
          { endTime: { $gte: now } }
        ]
      }
    ];

    const [shops, total] = await Promise.all([
      Shop.find(filter)
        .select("shopType name description isActive nextResetTime levelRequirement priority iconUrl items.length featuredItems")
        .skip(skip)
        .limit(limitNum)
        .sort({ priority: -1, shopType: 1 }),
      Shop.countDocuments(filter)
    ]);

    // Enrichir avec des informations supplémentaires
    const enrichedShops = await Promise.all(shops.map(async (shop) => {
      const shopObj = shop.toObject();
      const totalItems = shop.items?.length || 0;
      const featuredCount = shop.featuredItems?.length || 0;
      
      // Vérifier si le shop peut être actualisé
      const canRefresh = shop.refreshCost && (shop.refreshCost.gold || shop.refreshCost.gems);
      
      return {
        ...shopObj,
        stats: {
          totalItems,
          featuredCount,
          canRefresh,
          timeUntilReset: shop.nextResetTime ? Math.max(0, shop.nextResetTime.getTime() - now.getTime()) : null
        }
      };
    }));

    const pagination = {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    };

    res.json({
      message: "Available shops retrieved successfully",
      shops: enrichedShops,
      pagination,
      playerInfo: {
        level: player.level,
        vipLevel: player.vipLevel || 0
      }
    });
  } catch (err) {
    console.error("Get shops error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_SHOPS_FAILED"
    });
  }
});

// === GET SPECIFIC SHOP DETAILS ===
router.get("/:shopType", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { shopType } = req.params;

    const shop = await Shop.findOne({ 
      shopType, 
      isActive: true 
    });

    if (!shop) {
      res.status(404).json({ 
        error: "Shop not found or inactive",
        code: "SHOP_NOT_FOUND"
      });
      return;
    }

    // Vérifier l'accès du joueur
    const canAccess = await shop.canPlayerAccess(req.userId);
    if (!canAccess) {
      res.status(403).json({ 
        error: "Access denied to this shop",
        code: "SHOP_ACCESS_DENIED"
      });
      return;
    }

    // Enrichir les objets avec les données Item
    const enrichedItems = await Promise.all(shop.items.map(async (shopItem) => {
      let itemData = null;
      
      if (shopItem.type === "Item" && shopItem.content.itemId) {
        itemData = await Item.findOne({ itemId: shopItem.content.itemId })
          .select("name description iconUrl rarity category");
      }

      // Vérifier si le joueur peut acheter
      const purchaseCheck = await shop.canPlayerPurchase(shopItem.instanceId, req.userId!);

      return {
        ...shopItem,
        itemData,
        canPurchase: purchaseCheck.canPurchase,
        purchaseBlockReason: purchaseCheck.reason,
        finalPrice: (shopItem.discountPercent || 0) > 0 ? 
          Object.fromEntries(
            Object.entries(shopItem.cost).map(([currency, amount]) => [
              currency, 
              Math.floor(amount * (100 - (shopItem.discountPercent || 0)) / 100)
            ])
          ) : shopItem.cost
      };
    }));

    const now = new Date();
    res.json({
      message: "Shop details retrieved successfully",
      shop: {
        ...shop.toObject(),
        items: enrichedItems,
        timeUntilReset: shop.nextResetTime ? Math.max(0, shop.nextResetTime.getTime() - now.getTime()) : null,
        canRefresh: !!(shop.refreshCost && (shop.refreshCost.gold || shop.refreshCost.gems))
      }
    });
  } catch (err) {
    console.error("Get shop details error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_SHOP_DETAILS_FAILED"
    });
  }
});

// === PURCHASE ITEM FROM SHOP ===
router.post("/:shopType/purchase", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { error } = purchaseSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { shopType } = req.params;
    const { instanceId, quantity } = req.body;

    const [shop, player] = await Promise.all([
      Shop.findOne({ shopType, isActive: true }),
      Player.findById(req.userId)
    ]);

    if (!shop) {
      res.status(404).json({ 
        error: "Shop not found",
        code: "SHOP_NOT_FOUND"
      });
      return;
    }

    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    const shopItem = shop.items.find(item => item.instanceId === instanceId);
    if (!shopItem) {
      res.status(404).json({ 
        error: "Item not found in shop",
        code: "SHOP_ITEM_NOT_FOUND"
      });
      return;
    }

    // Vérifier si le joueur peut acheter
    const purchaseCheck = await shop.canPlayerPurchase(instanceId, req.userId!);
    if (!purchaseCheck.canPurchase) {
      res.status(400).json({ 
        error: `Cannot purchase item: ${purchaseCheck.reason}`,
        code: "PURCHASE_NOT_ALLOWED"
      });
      return;
    }

    // Calculer le coût total
    const finalCost: any = {};
    Object.entries(shopItem.cost).forEach(([currency, amount]) => {
      if (amount > 0) {
        let finalAmount = amount * quantity;
        const discount = shopItem.discountPercent || 0;
        if (discount > 0) {
          finalAmount = Math.floor(finalAmount * (100 - discount) / 100);
        }
        finalCost[currency] = finalAmount;
      }
    });

    // Vérifier que le joueur a assez de ressources
    const insufficientResources = [];
    if (finalCost.gold && player.gold < finalCost.gold) insufficientResources.push("gold");
    if (finalCost.gems && player.gems < finalCost.gems) insufficientResources.push("gems");
    if (finalCost.paidGems && player.paidGems < finalCost.paidGems) insufficientResources.push("paidGems");
    if (finalCost.tickets && player.tickets < finalCost.tickets) insufficientResources.push("tickets");

    if (insufficientResources.length > 0) {
      res.status(400).json({ 
        error: `Insufficient resources: ${insufficientResources.join(", ")}`,
        code: "INSUFFICIENT_RESOURCES"
      });
      return;
    }

    // Effectuer l'achat
    try {
      // Déduire les ressources
      if (finalCost.gold) player.gold -= finalCost.gold;
      if (finalCost.gems) player.gems -= finalCost.gems;
      if (finalCost.paidGems) player.paidGems -= finalCost.paidGems;
      if (finalCost.tickets) player.tickets -= finalCost.tickets;

      // Ajouter l'objet à l'inventaire
      let inventory = await Inventory.findOne({ playerId: req.userId });
      if (!inventory) {
        inventory = new Inventory({ playerId: req.userId });
      }

      const rewards = [];
      
      if (shopItem.type === "Item" && shopItem.content.itemId) {
        const ownedItem = await inventory.addItem(
          shopItem.content.itemId, 
          shopItem.content.quantity * quantity,
          shopItem.content.level || 1
        );
        rewards.push({
          type: "Item",
          itemId: shopItem.content.itemId,
          quantity: shopItem.content.quantity * quantity,
          instanceId: ownedItem.instanceId
        });
      } else if (shopItem.type === "Currency") {
        const currencyAmount = shopItem.content.quantity * quantity;
        switch (shopItem.content.currencyType) {
          case "gold":
            player.gold += currencyAmount;
            break;
          case "gems":
            player.gems += currencyAmount;
            break;
          case "paidGems":
            player.paidGems += currencyAmount;
            break;
          case "tickets":
            player.tickets += currencyAmount;
            break;
        }
        rewards.push({
          type: "Currency",
          currencyType: shopItem.content.currencyType,
          quantity: currencyAmount
        });
      } else if (shopItem.type === "Fragment" && shopItem.content.heroId) {
        const currentFragments = player.fragments.get(shopItem.content.heroId) || 0;
        player.fragments.set(shopItem.content.heroId, currentFragments + (shopItem.content.quantity * quantity));
        rewards.push({
          type: "Fragment",
          heroId: shopItem.content.heroId,
          quantity: shopItem.content.quantity * quantity
        });
      }

      // Mettre à jour le stock
      if (shopItem.maxStock !== -1) {
        shopItem.currentStock -= quantity;
      }

      // Ajouter à l'historique d'achat
      shopItem.purchaseHistory.push({
        playerId: req.userId,
        quantity,
        purchaseDate: new Date()
      });

      // Sauvegarder tout
      await Promise.all([
        player.save(),
        inventory.save(),
        shop.save()
      ]);

      res.json({
        message: "Purchase completed successfully",
        purchase: {
          itemName: shopItem.name,
          quantity,
          cost: finalCost,
          rewards
        },
        playerResources: {
          gold: player.gold,
          gems: player.gems,
          paidGems: player.paidGems,
          tickets: player.tickets
        },
        itemStock: {
          currentStock: shopItem.currentStock,
          maxStock: shopItem.maxStock
        }
      });

    } catch (purchaseError) {
      console.error("Purchase transaction error:", purchaseError);
      res.status(500).json({ 
        error: "Purchase transaction failed",
        code: "PURCHASE_TRANSACTION_FAILED"
      });
    }
  } catch (err) {
    console.error("Purchase item error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "PURCHASE_ITEM_FAILED"
    });
  }
});

// === REFRESH SHOP MANUALLY ===
router.post("/:shopType/refresh", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { shopType } = req.params;

    const [shop, player] = await Promise.all([
      Shop.findOne({ shopType, isActive: true }),
      Player.findById(req.userId)
    ]);

    if (!shop) {
      res.status(404).json({ 
        error: "Shop not found",
        code: "SHOP_NOT_FOUND"
      });
      return;
    }

    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    // Vérifier que le shop peut être actualisé
    if (!shop.refreshCost || (!shop.refreshCost.gold && !shop.refreshCost.gems)) {
      res.status(400).json({ 
        error: "This shop cannot be refreshed manually",
        code: "REFRESH_NOT_ALLOWED"
      });
      return;
    }

    // Vérifier les ressources du joueur
    if (shop.refreshCost.gold && player.gold < shop.refreshCost.gold) {
      res.status(400).json({ 
        error: `Insufficient gold. Required: ${shop.refreshCost.gold}, Available: ${player.gold}`,
        code: "INSUFFICIENT_GOLD"
      });
      return;
    }

    if (shop.refreshCost.gems && player.gems < shop.refreshCost.gems) {
      res.status(400).json({ 
        error: `Insufficient gems. Required: ${shop.refreshCost.gems}, Available: ${player.gems}`,
        code: "INSUFFICIENT_GEMS"
      });
      return;
    }

    // Déduire le coût
    if (shop.refreshCost.gold) player.gold -= shop.refreshCost.gold;
    if (shop.refreshCost.gems) player.gems -= shop.refreshCost.gems;

    // Actualiser le shop
    await shop.refreshShop();
    await player.save();

    res.json({
      message: "Shop refreshed successfully",
      cost: shop.refreshCost,
      playerResources: {
        gold: player.gold,
        gems: player.gems
      },
      newItemsCount: shop.items.length
    });
  } catch (err) {
    console.error("Refresh shop error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "REFRESH_SHOP_FAILED"
    });
  }
});

// === GET PURCHASE HISTORY ===
router.get("/:shopType/history", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    const { shopType } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const shop = await Shop.findOne({ shopType, isActive: true });
    if (!shop) {
      res.status(404).json({ 
        error: "Shop not found",
        code: "SHOP_NOT_FOUND"
      });
      return;
    }

    // Récupérer l'historique du joueur
    const playerHistory: any[] = [];
    
    shop.items.forEach(shopItem => {
      shopItem.purchaseHistory.forEach(purchase => {
        if (purchase.playerId === req.userId) {
          playerHistory.push({
            itemName: shopItem.name,
            itemId: shopItem.itemId,
            quantity: purchase.quantity,
            purchaseDate: purchase.purchaseDate,
            cost: shopItem.cost
          });
        }
      });
    });

    // Trier par date décroissante
    playerHistory.sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime());

    // Paginer
    const total = playerHistory.length;
    const paginatedHistory = playerHistory.slice(skip, skip + limitNum);

    const pagination = {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    };

    res.json({
      message: "Purchase history retrieved successfully",
      shopType,
      history: paginatedHistory,
      pagination
    });
  } catch (err) {
    console.error("Get purchase history error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_HISTORY_FAILED"
    });
  }
});

// === ADMIN: CREATE SHOP ===
router.post("/admin/create", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    
    const { error } = createShopSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const existingShop = await Shop.findOne({ shopType: req.body.shopType });
    if (existingShop) {
      res.status(409).json({ 
        error: "Shop of this type already exists",
        code: "SHOP_TYPE_EXISTS"
      });
      return;
    }

    const newShop = (Shop as any).createPredefinedShop(req.body.shopType);
    Object.assign(newShop, req.body);
    
    await newShop.save();

    res.status(201).json({
      message: "Shop created successfully",
      shop: newShop
    });
  } catch (err) {
    console.error("Create shop error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "CREATE_SHOP_FAILED"
    });
  }
});

// === ADMIN: RESET ALL SHOPS ===
router.post("/admin/reset-all", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    
    const shopsToReset = await (Shop as any).getShopsToReset();
    const resetResults = [];

    for (const shop of shopsToReset) {
      await shop.refreshShop();
      resetResults.push({
        shopType: shop.shopType,
        name: shop.name,
        newItemsCount: shop.items.length
      });
    }

    res.json({
      message: "Shops reset completed",
      resetShops: resetResults,
      totalReset: resetResults.length
    });
  } catch (err) {
    console.error("Reset shops error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "RESET_SHOPS_FAILED"
    });
  }
});

export default router;

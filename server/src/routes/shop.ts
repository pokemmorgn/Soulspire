import express, { Request, Response } from "express";
import Joi from "joi";
import Shop from "../models/Shop";
import Player from "../models/Player";
import Hero from "../models/Hero";
import authMiddleware from "../middleware/authMiddleware";
import { ShopPurchaseRequest, ShopPurchaseResponse } from "../types/index";

const router = express.Router();

// Schémas de validation
const purchaseSchema = Joi.object({
  shopType: Joi.string().valid("Daily", "Weekly", "Monthly", "Premium").required(),
  itemId: Joi.string().required(),
  quantity: Joi.number().min(1).default(1)
});

const refreshSchema = Joi.object({
  shopType: Joi.string().valid("Daily", "Weekly", "Monthly", "Premium").required(),
  force: Joi.boolean().default(false)
});

// === GET ALL SHOPS ===
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const player = await Player.findById(req.userId);
    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    // Récupérer tous les shops actifs
    let shops = await Shop.find({ isActive: true });
    
    // Si aucun shop n'existe, créer les shops par défaut
    if (shops.length === 0) {
      const shopTypes = ["Daily", "Weekly", "Monthly", "Premium"];
      for (const type of shopTypes) {
        const newShop = new Shop({
          type,
          items: (Shop as any).generateShopItems(type),
          isActive: true
        });
        await newShop.save();
        shops.push(newShop);
      }
    }

    // Vérifier les resets nécessaires
    const now = new Date();
    for (const shop of shops) {
      if (shop.nextResetTime <= now && shop.type !== "Premium") {
        await shop.refreshShop();
      }
    }

    // Enrichir les données avec les informations du joueur
    const enrichedShops = await Promise.all(shops.map(async (shop) => {
      const enrichedItems = await Promise.all(shop.items.map(async (item) => {
        const canPurchase = await shop.canPurchase(item.itemId, req.userId!);
        
        // Vérifier les ressources du joueur
        const hasResources = player.canAfford({
          gold: item.cost.gold || 0,
          gems: item.cost.gems || 0,
          paidGems: item.cost.paidGems || 0
        });
        
        // Calculer les achats du joueur pour cet item
        const playerPurchases = item.purchasedBy?.filter(p => p.playerId === req.userId!).length || 0;
        
        return {
          ...item.toObject(),
          canPurchase: canPurchase && hasResources,
          playerPurchases,
          timeUntilReset: Math.max(0, Math.floor((shop.nextResetTime.getTime() - now.getTime()) / 1000))
        };
      }));

      return {
        type: shop.type,
        items: enrichedItems,
        resetTime: shop.resetTime,
        nextResetTime: shop.nextResetTime,
        timeUntilReset: Math.max(0, Math.floor((shop.nextResetTime.getTime() - now.getTime()) / 1000))
      };
    }));

    res.json({
      message: "Shops retrieved successfully",
      shops: enrichedShops,
      playerCurrency: {
        gold: player.gold,
        gems: player.gems,
        paidGems: player.paidGems,
        tickets: player.tickets
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

// === GET SPECIFIC SHOP ===
router.get("/:shopType", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { shopType } = req.params;
    
    if (!["Daily", "Weekly", "Monthly", "Premium"].includes(shopType)) {
      res.status(400).json({ 
        error: "Invalid shop type",
        code: "INVALID_SHOP_TYPE"
      });
      return;
    }

    const player = await Player.findById(req.userId);
    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    let shop = await Shop.findOne({ type: shopType, isActive: true });
    
    // Créer le shop s'il n'existe pas
    if (!shop) {
      shop = new Shop({
        type: shopType,
        items: (Shop as any).generateShopItems(shopType),
        isActive: true
      });
      await shop.save();
    }

    // Vérifier si un reset est nécessaire
    const now = new Date();
    if (shop.nextResetTime <= now && shopType !== "Premium") {
      await shop.refreshShop();
    }

    // Enrichir avec les données du joueur
    const enrichedItems = await Promise.all(shop.items.map(async (item) => {
      const canPurchase = await shop.canPurchase(item.itemId, req.userId!);
      const hasResources = player.canAfford({
        gold: item.cost.gold || 0,
        gems: item.cost.gems || 0,
        paidGems: item.cost.paidGems || 0
      });
      
      const playerPurchases = item.purchasedBy?.filter(p => p.playerId === req.userId!).length || 0;
      
      return {
        ...item.toObject(),
        canPurchase: canPurchase && hasResources,
        playerPurchases,
        timeUntilReset: Math.max(0, Math.floor((shop.nextResetTime.getTime() - now.getTime()) / 1000))
      };
    }));

    res.json({
      message: `${shopType} shop retrieved successfully`,
      shop: {
        type: shop.type,
        items: enrichedItems,
        resetTime: shop.resetTime,
        nextResetTime: shop.nextResetTime,
        timeUntilReset: Math.max(0, Math.floor((shop.nextResetTime.getTime() - now.getTime()) / 1000))
      },
      playerCurrency: {
        gold: player.gold,
        gems: player.gems,
        paidGems: player.paidGems,
        tickets: player.tickets
      }
    });
  } catch (err) {
    console.error("Get shop error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_SHOP_FAILED"
    });
  }
});

// === PURCHASE ITEM ===
router.post("/purchase", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = purchaseSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { shopType, itemId, quantity = 1 }: ShopPurchaseRequest = req.body;

    const player = await Player.findById(req.userId);
    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    const shop = await Shop.findOne({ type: shopType, isActive: true });
    if (!shop) {
      res.status(404).json({ 
        error: "Shop not found",
        code: "SHOP_NOT_FOUND"
      });
      return;
    }

    const item = shop.items.find(i => i.itemId === itemId);
    if (!item) {
      res.status(404).json({ 
        error: "Item not found in shop",
        code: "ITEM_NOT_FOUND"
      });
      return;
    }

    // Vérifications d'achat
    const canPurchase = await shop.canPurchase(itemId, req.userId!);
    if (!canPurchase) {
      res.status(400).json({ 
        error: "Cannot purchase this item (stock/limit reached)",
        code: "PURCHASE_NOT_ALLOWED"
      });
      return;
    }

    // Vérifier que la quantité demandée est disponible
    if (item.maxStock !== -1 && item.currentStock < quantity) {
      res.status(400).json({ 
        error: `Insufficient stock. Available: ${item.currentStock}, Requested: ${quantity}`,
        code: "INSUFFICIENT_STOCK"
      });
      return;
    }

    // Calculer le coût total
    const totalCost = {
      gold: (item.cost.gold || 0) * quantity,
      gems: (item.cost.gems || 0) * quantity,
      paidGems: (item.cost.paidGems || 0) * quantity,
      tickets: (item.cost.tickets || 0) * quantity
    };

    // Vérifier les ressources du joueur
    if (!player.canAfford(totalCost) || (totalCost.tickets > 0 && player.tickets < totalCost.tickets)) {
      res.status(400).json({ 
        error: "Insufficient resources",
        code: "INSUFFICIENT_RESOURCES",
        required: totalCost,
        available: {
          gold: player.gold,
          gems: player.gems,
          paidGems: player.paidGems,
          tickets: player.tickets
        }
      });
      return;
    }

    // Vérifier les exigences de niveau/monde
    if (item.levelRequirement && player.level < item.levelRequirement) {
      res.status(400).json({ 
        error: `Level requirement not met. Required: ${item.levelRequirement}, Current: ${player.level}`,
        code: "LEVEL_REQUIREMENT_NOT_MET"
      });
      return;
    }

    if (item.worldRequirement && player.world < item.worldRequirement) {
      res.status(400).json({ 
        error: `World requirement not met. Required: ${item.worldRequirement}, Current: ${player.world}`,
        code: "WORLD_REQUIREMENT_NOT_MET"
      });
      return;
    }

    // === TRAITEMENT DE L'ACHAT ===
    
    // Déduction des ressources
    if (totalCost.gold > 0) player.gold -= totalCost.gold;
    if (totalCost.gems > 0) player.gems -= totalCost.gems;
    if (totalCost.paidGems > 0) player.paidGems -= totalCost.paidGems;
    if (totalCost.tickets > 0) player.tickets -= totalCost.tickets;

    // Attribution des récompenses selon le type d'item
    let reward: any = {};
    
    switch (item.type) {
      case "Currency":
        if (item.name.includes("Gold")) {
          player.gold += item.quantity * quantity;
          reward = { type: "Gold", quantity: item.quantity * quantity };
        } else if (item.name.includes("Gems")) {
          player.gems += item.quantity * quantity;
          reward = { type: "Gems", quantity: item.quantity * quantity };
        }
        break;
        
      case "Hero":
        if (item.heroData?.heroId) {
          // Héros spécifique
          const existingHero = player.heroes.find(h => h.heroId === item.heroData!.heroId);
          if (existingHero) {
            // Conversion en fragments
            const fragments = item.rarity === "Legendary" ? 25 : item.rarity === "Epic" ? 15 : 10;
            const currentFragments = player.fragments.get(item.heroData.heroId) || 0;
            player.fragments.set(item.heroData.heroId, currentFragments + fragments);
            reward = { type: "Fragments", heroId: item.heroData.heroId, quantity: fragments };
          } else {
            // Nouveau héros
            player.heroes.push({
              heroId: item.heroData.heroId,
              level: item.heroData.level || 1,
              stars: item.heroData.stars || 1,
              equipped: false
            });
            reward = { type: "Hero", heroId: item.heroData.heroId, data: item.heroData };
          }
        } else {
          // Héros aléatoire - implémentation simplifiée
          reward = { type: "RandomHero", rarity: item.rarity };
        }
        break;
        
      case "Fragment":
        // Fragments aléatoires ou spécifiques
        const fragmentAmount = item.quantity * quantity;
        if (item.heroData?.heroId) {
          const current = player.fragments.get(item.heroData.heroId) || 0;
          player.fragments.set(item.heroData.heroId, current + fragmentAmount);
          reward = { type: "Fragments", heroId: item.heroData.heroId, quantity: fragmentAmount };
        } else {
          // Fragments aléatoires - implémentation simplifiée
          reward = { type: "RandomFragments", quantity: fragmentAmount, rarity: item.rarity };
        }
        break;
        
      case "Material":
        const materialAmount = item.quantity * quantity;
        const materialId = item.materialData?.materialType || "generic_material";
        const currentMaterials = player.materials.get(materialId) || 0;
        player.materials.set(materialId, currentMaterials + materialAmount);
        reward = { type: "Materials", materialId, quantity: materialAmount };
        break;
        
      case "Ticket":
        player.tickets += item.quantity * quantity;
        reward = { type: "Tickets", quantity: item.quantity * quantity };
        break;
        
      case "Equipment":
        // Implémentation simplifiée - on donne les stats directement
        reward = { 
          type: "Equipment", 
          data: item.equipmentData,
          quantity: quantity
        };
        break;
    }

    // Mise à jour du stock et des achats
    if (item.maxStock !== -1) {
      item.currentStock -= quantity;
    }
    item.totalPurchased = (item.totalPurchased || 0) + quantity;
    
    // Enregistrer l'achat
    if (!item.purchasedBy) item.purchasedBy = [];
    item.purchasedBy.push({
      playerId: req.userId!,
      quantity,
      purchaseDate: new Date()
    });

    // Sauvegarder les changements
    await Promise.all([
      player.save(),
      shop.save()
    ]);

    const response: ShopPurchaseResponse = {
      message: "Item purchased successfully",
      purchase: {
        itemId: item.itemId,
        itemName: item.name,
        quantity,
        cost: totalCost,
        reward
      },
      remaining: {
        gold: player.gold,
        gems: player.gems,
        paidGems: player.paidGems,
        tickets: player.tickets
      },
      itemStock: {
        current: item.currentStock,
        max: item.maxStock
      }
    };

    res.json(response);
  } catch (err) {
    console.error("Purchase item error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "PURCHASE_ITEM_FAILED"
    });
  }
});

// === REFRESH SHOP (Force reset) ===
router.post("/refresh", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = refreshSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { shopType, force } = req.body;

    const shop = await Shop.findOne({ type: shopType, isActive: true });
    if (!shop) {
      res.status(404).json({ 
        error: "Shop not found",
        code: "SHOP_NOT_FOUND"
      });
      return;
    }

    // Vérifier si le refresh est autorisé
    const now = new Date();
    const canRefresh = force || shop.nextResetTime <= now;
    
    if (!canRefresh) {
      res.status(400).json({ 
        error: "Shop refresh not available yet",
        code: "REFRESH_NOT_AVAILABLE",
        timeUntilReset: Math.floor((shop.nextResetTime.getTime() - now.getTime()) / 1000)
      });
      return;
    }

    // Refresh du shop
    await shop.refreshShop();

    res.json({
      message: `${shopType} shop refreshed successfully`,
      shop: {
        type: shop.type,
        items: shop.items,
        resetTime: shop.resetTime,
        nextResetTime: shop.nextResetTime
      }
    });
  } catch (err) {
    console.error("Refresh shop error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "REFRESH_SHOP_FAILED"
    });
  }
});

// === ADMIN: CREATE CUSTOM SHOP ITEM ===
router.post("/admin/add-item", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter une vérification admin ici
    
    const { shopType, ...itemData } = req.body;

    const shop = await Shop.findOne({ type: shopType, isActive: true });
    if (!shop) {
      res.status(404).json({ 
        error: "Shop not found",
        code: "SHOP_NOT_FOUND"
      });
      return;
    }

    shop.addItem(itemData);
    await shop.save();

    res.json({
      message: "Item added to shop successfully",
      item: itemData
    });
  } catch (err) {
    console.error("Add shop item error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "ADD_SHOP_ITEM_FAILED"
    });
  }
});

export default router;

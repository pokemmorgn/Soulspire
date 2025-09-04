import express, { Request, Response } from "express";
import Joi from "joi";
import { ShopService } from "../services/ShopService";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// === SCHÉMAS DE VALIDATION ===

const shopFilterSchema = Joi.object({
  shopType: Joi.string().valid(
    "General", "Arena", "Clan", "Labyrinth", "Event", 
    "VIP", "Daily", "Weekly", "Monthly", "Flash", "Bundle", "Seasonal"
  ).optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(50).default(10)
});

const purchaseSchema = Joi.object({
  instanceId: Joi.string().required(),
  quantity: Joi.number().min(1).max(99).default(1)
});

const historySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20)
});

// === ROUTES PRINCIPALES ===

/**
 * GET /api/shops
 * Récupérer toutes les boutiques disponibles pour le joueur
 */
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    // Validation des paramètres
    const { error, value } = shopFilterSchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { shopType, page, limit } = value;

    // Appel du service
    const result = await ShopService.getAvailableShops(
      req.userId,
      shopType,
      page,
      limit
    );

    res.json({
      message: "Available shops retrieved successfully",
      ...result
    });

  } catch (error: any) {
    console.error("Get shops error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve shops",
      code: "GET_SHOPS_FAILED"
    });
  }
});

/**
 * GET /api/shops/:shopType
 * Récupérer les détails d'une boutique spécifique
 */
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

    // Validation du type de boutique
    const validShopTypes = [
      "General", "Arena", "Clan", "Labyrinth", "Event", 
      "VIP", "Daily", "Weekly", "Monthly", "Flash", "Bundle", "Seasonal"
    ];

    if (!validShopTypes.includes(shopType)) {
      res.status(400).json({
        error: "Invalid shop type",
        code: "INVALID_SHOP_TYPE",
        validTypes: validShopTypes
      });
      return;
    }

    // Appel du service
    const result = await ShopService.getShopDetails(req.userId, shopType);

    res.json({
      message: "Shop details retrieved successfully",
      ...result
    });

  } catch (error: any) {
    console.error("Get shop details error:", error);
    
    if (error.message === "Shop not found or inactive") {
      res.status(404).json({
        error: "Shop not found",
        code: "SHOP_NOT_FOUND"
      });
    } else if (error.message === "Access denied to this shop") {
      res.status(403).json({
        error: "Access denied to this shop",
        code: "SHOP_ACCESS_DENIED"
      });
    } else {
      res.status(500).json({
        error: "Failed to retrieve shop details",
        code: "GET_SHOP_DETAILS_FAILED"
      });
    }
  }
});

/**
 * POST /api/shops/:shopType/purchase
 * Acheter un objet dans une boutique
 */
router.post("/:shopType/purchase", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    // Validation des données
    const { error, value } = purchaseSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { shopType } = req.params;
    const { instanceId, quantity } = value;

    // Appel du service
    const result = await ShopService.purchaseItem(
      req.userId,
      shopType,
      instanceId,
      quantity
    );

    if (!result.success) {
      // Déterminer le code de statut HTTP selon l'erreur
      let statusCode = 400; // Bad Request par défaut
      
      if (result.code === "SHOP_NOT_FOUND" || result.code === "SHOP_ITEM_NOT_FOUND") {
        statusCode = 404;
      } else if (result.code === "PURCHASE_NOT_ALLOWED") {
        statusCode = 403;
      }

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: "Purchase completed successfully",
      ...result
    });

  } catch (error: any) {
    console.error("Purchase item error:", error);
    res.status(500).json({ 
      error: "Purchase failed",
      code: "PURCHASE_ITEM_FAILED"
    });
  }
});

/**
 * POST /api/shops/:shopType/refresh
 * Actualiser manuellement une boutique
 */
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

    // Appel du service
    const result = await ShopService.refreshShop(req.userId, shopType);

    if (!result.success) {
      let statusCode = 400; // Bad Request par défaut
      
      if (result.code === "SHOP_NOT_FOUND") {
        statusCode = 404;
      } else if (result.code === "REFRESH_NOT_ALLOWED") {
        statusCode = 403;
      }

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: "Shop refreshed successfully",
      ...result
    });

  } catch (error: any) {
    console.error("Refresh shop error:", error);
    res.status(500).json({ 
      error: "Shop refresh failed",
      code: "REFRESH_SHOP_FAILED"
    });
  }
});

/**
 * GET /api/shops/:shopType/history
 * Récupérer l'historique d'achat du joueur dans une boutique
 */
router.get("/:shopType/history", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ 
        error: "User not authenticated",
        code: "USER_NOT_AUTHENTICATED"
      });
      return;
    }

    // Validation des paramètres
    const { error, value } = historySchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { shopType } = req.params;
    const { page, limit } = value;

    // Appel du service
    const result = await ShopService.getPurchaseHistory(
      req.userId,
      shopType,
      page,
      limit
    );

    res.json({
      message: "Purchase history retrieved successfully",
      ...result
    });

  } catch (error: any) {
    console.error("Get purchase history error:", error);
    
    if (error.message === "Shop not found") {
      res.status(404).json({
        error: "Shop not found",
        code: "SHOP_NOT_FOUND"
      });
    } else {
      res.status(500).json({
        error: "Failed to retrieve purchase history",
        code: "GET_HISTORY_FAILED"
      });
    }
  }
});

// === ROUTES D'ADMINISTRATION ===

/**
 * POST /api/shops/admin/create-predefined
 * Créer toutes les boutiques prédéfinies
 * TODO: Ajouter middleware d'authentification admin
 */
router.post("/admin/create-predefined", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Vérifier les permissions admin
    // if (!req.userRole || req.userRole !== 'admin') {
    //   res.status(403).json({ error: "Admin access required", code: "ADMIN_ACCESS_REQUIRED" });
    //   return;
    // }

    const result = await ShopService.createPredefinedShops();

    res.status(201).json({
      message: "Predefined shops created successfully",
      ...result
    });

  } catch (error: any) {
    console.error("Create predefined shops error:", error);
    res.status(500).json({ 
      error: "Failed to create predefined shops",
      code: "CREATE_PREDEFINED_SHOPS_FAILED"
    });
  }
});

/**
 * POST /api/shops/admin/reset-all
 * Forcer le reset de toutes les boutiques éligibles
 * TODO: Ajouter middleware d'authentification admin
 */
router.post("/admin/reset-all", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Vérifier les permissions admin
    // if (!req.userRole || req.userRole !== 'admin') {
    //   res.status(403).json({ error: "Admin access required", code: "ADMIN_ACCESS_REQUIRED" });
    //   return;
    // }

    const result = await ShopService.processShopResets();

    res.json({
      message: "Shop resets completed",
      ...result
    });

  } catch (error: any) {
    console.error("Reset shops error:", error);
    res.status(500).json({ 
      error: "Failed to reset shops",
      code: "RESET_SHOPS_FAILED"
    });
  }
});

/**
 * GET /api/shops/admin/stats
 * Récupérer les statistiques des boutiques
 * TODO: Ajouter middleware d'authentification admin
 */
router.get("/admin/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Vérifier les permissions admin
    // if (!req.userRole || req.userRole !== 'admin') {
    //   res.status(403).json({ error: "Admin access required", code: "ADMIN_ACCESS_REQUIRED" });
    //   return;
    // }

    const { serverId } = req.query;
    const result = await ShopService.getShopStats(serverId as string);

    res.json({
      ...result
    });

  } catch (error: any) {
    console.error("Get shop stats error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve shop statistics",
      code: "GET_SHOP_STATS_FAILED"
    });
  }
});

// === ROUTES DE SANTÉ/DEBUG ===

/**
 * GET /api/shops/health
 * Vérifier la santé du système de boutiques
 */
router.get("/health", async (req: Request, res: Response): Promise<void> => {
  try {
    // Vérifications basiques
    const Shop = (await import("../models/Shop")).default;
    const totalShops = await Shop.countDocuments({ isActive: true });
    const shopsWithItems = await Shop.countDocuments({ 
      isActive: true,
      "items.0": { $exists: true }
    });

    res.json({
      status: "healthy",
      totalActiveShops: totalShops,
      shopsWithItems,
      systemTime: new Date(),
      version: "1.0.0"
    });

  } catch (error: any) {
    console.error("Shop health check error:", error);
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date()
    });
  }
});

export default router;

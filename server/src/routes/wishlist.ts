// server/src/routes/wishlist.ts

import express from "express";
import { WishlistController } from "../controllers/WishlistController";
import authMiddleware from "../middleware/authMiddleware"; // ✅ CORRECTION

const router = express.Router();

// Toutes les routes nécessitent l'authentification
router.use(authMiddleware); // ✅ CORRECTION

/**
 * GET /api/wishlist
 * Récupérer la wishlist du joueur avec stats
 */
router.get("/", WishlistController.getWishlist);

/**
 * POST /api/wishlist
 * Ajouter un héros à la wishlist
 * Body: { heroId: string, itemCost?: { itemId: string, quantity: number } }
 */
router.post("/", WishlistController.addHero);

/**
 * PUT /api/wishlist
 * Remplacer toute la wishlist
 * Body: { heroIds: string[] }
 */
router.put("/", WishlistController.updateWishlist);

/**
 * DELETE /api/wishlist/:heroId
 * Retirer un héros de la wishlist
 */
router.delete("/:heroId", WishlistController.removeHero);

/**
 * GET /api/wishlist/available
 * Liste des héros Legendary disponibles
 * Query: ?element=Fire (optionnel)
 */
router.get("/available", WishlistController.getAvailableHeroes);

/**
 * GET /api/wishlist/stats
 * Statistiques de la wishlist
 */
router.get("/stats", WishlistController.getStats);

// ===== ROUTES WISHLISTS ÉLÉMENTAIRES =====

/**
 * GET /api/wishlist/elemental
 * Obtenir toutes les wishlists élémentaires du joueur
 */
router.get("/elemental", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = (req as any).user?.playerId;
    const serverId = (req as any).user?.serverId;

    if (!playerId || !serverId) {
      res.status(401).json({ 
        success: false, 
        error: "Unauthorized" 
      });
      return;
    }

    console.log(`📋 Récupération wishlists élémentaires pour ${playerId}`);

    const result = await WishlistService.getAllElementalWishlists(playerId, serverId);

    res.json(result);

  } catch (error: any) {
    console.error("❌ Error getting elemental wishlists:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/wishlist/elemental/:element
 * Obtenir la wishlist élémentaire pour un élément spécifique
 */
router.get("/elemental/:element", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = (req as any).user?.playerId;
    const serverId = (req as any).user?.serverId;
    const { element } = req.params;

    if (!playerId || !serverId) {
      res.status(401).json({ 
        success: false, 
        error: "Unauthorized" 
      });
      return;
    }

    // Validation de l'élément
    const validElements = ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"];
    if (!validElements.includes(element)) {
      res.status(400).json({
        success: false,
        error: `Invalid element: ${element}. Valid: ${validElements.join(", ")}`
      });
      return;
    }

    console.log(`🔍 Récupération wishlist ${element} pour ${playerId}`);

    const result = await WishlistService.getElementalWishlist(playerId, serverId, element);

    // Ajouter les stats
    if (result.success && result.wishlist) {
      const stats = await WishlistService.getElementalWishlistStats(playerId, serverId, element);
      res.json({
        ...result,
        stats
      });
      return;
    }

    res.json(result);

  } catch (error: any) {
    console.error("❌ Error getting elemental wishlist:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/wishlist/elemental
 * Créer/mettre à jour une wishlist élémentaire
 * Body: { element: string, heroIds: string[] }
 */
router.post("/elemental", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = (req as any).user?.playerId;
    const serverId = (req as any).user?.serverId;
    const { element, heroIds } = req.body;

    if (!playerId || !serverId) {
      res.status(401).json({ 
        success: false, 
        error: "Unauthorized" 
      });
      return;
    }

    // Validation de l'élément
    const validElements = ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"];
    if (!element || !validElements.includes(element)) {
      res.status(400).json({
        success: false,
        error: `Invalid or missing element. Valid: ${validElements.join(", ")}`
      });
      return;
    }

    // Validation des heroIds
    if (!Array.isArray(heroIds)) {
      res.status(400).json({
        success: false,
        error: "heroIds must be an array"
      });
      return;
    }

    if (heroIds.length > 4) {
      res.status(400).json({
        success: false,
        error: "Maximum 4 heroes allowed in elemental wishlist"
      });
      return;
    }

    console.log(`✏️ Mise à jour wishlist ${element} pour ${playerId}: ${heroIds.length} héros`);

    const result = await WishlistService.updateElementalWishlist(
      playerId,
      serverId,
      element,
      heroIds
    );

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);

  } catch (error: any) {
    console.error("❌ Error updating elemental wishlist:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * PUT /api/wishlist/elemental/:element
 * Mettre à jour une wishlist élémentaire (alias de POST pour RESTful)
 * Body: { heroIds: string[] }
 */
router.put("/elemental/:element", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = (req as any).user?.playerId;
    const serverId = (req as any).user?.serverId;
    const { element } = req.params;
    const { heroIds } = req.body;

    if (!playerId || !serverId) {
      res.status(401).json({ 
        success: false, 
        error: "Unauthorized" 
      });
      return;
    }

    // Validation de l'élément
    const validElements = ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"];
    if (!validElements.includes(element)) {
      res.status(400).json({
        success: false,
        error: `Invalid element: ${element}. Valid: ${validElements.join(", ")}`
      });
      return;
    }

    // Validation des heroIds
    if (!Array.isArray(heroIds)) {
      res.status(400).json({
        success: false,
        error: "heroIds must be an array"
      });
      return;
    }

    console.log(`✏️ Mise à jour wishlist ${element} pour ${playerId}: ${heroIds.length} héros`);

    const result = await WishlistService.updateElementalWishlist(
      playerId,
      serverId,
      element,
      heroIds
    );

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);

  } catch (error: any) {
    console.error("❌ Error updating elemental wishlist:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/wishlist/elemental/:element/stats
 * Obtenir les statistiques d'une wishlist élémentaire
 */
router.get("/elemental/:element/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = (req as any).user?.playerId;
    const serverId = (req as any).user?.serverId;
    const { element } = req.params;

    if (!playerId || !serverId) {
      res.status(401).json({ 
        success: false, 
        error: "Unauthorized" 
      });
      return;
    }

    // Validation de l'élément
    const validElements = ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"];
    if (!validElements.includes(element)) {
      res.status(400).json({
        success: false,
        error: `Invalid element: ${element}. Valid: ${validElements.join(", ")}`
      });
      return;
    }

    console.log(`📊 Récupération stats wishlist ${element} pour ${playerId}`);

    const stats = await WishlistService.getElementalWishlistStats(playerId, serverId, element);

    res.json({
      success: true,
      stats
    });

  } catch (error: any) {
    console.error("❌ Error getting elemental wishlist stats:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/wishlist/elemental/available/:element
 * Obtenir les héros Legendary disponibles pour un élément
 */
router.get("/elemental/available/:element", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { element } = req.params;

    // Validation de l'élément
    const validElements = ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"];
    if (!validElements.includes(element)) {
      res.status(400).json({
        success: false,
        error: `Invalid element: ${element}. Valid: ${validElements.join(", ")}`
      });
      return;
    }

    console.log(`🔍 Récupération héros Legendary ${element} disponibles`);

    const result = await WishlistService.getAvailableHeroes(element);

    res.json(result);

  } catch (error: any) {
    console.error("❌ Error getting available elemental heroes:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;

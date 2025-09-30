// server/src/routes/wishlist.ts

import express from "express";
import { WishlistController } from "../controllers/WishlistController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Toutes les routes nécessitent l'authentification
router.use(authenticateToken);

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

export default router;

// server/src/controllers/WishlistController.ts

import { Request, Response } from "express";
import { WishlistService } from "../services/WishlistService";

export class WishlistController {
  
  /**
   * GET /api/wishlist
   * Récupérer la wishlist du joueur
   */
  static async getWishlist(req: Request, res: Response) {
    try {
      const playerId = (req as any).user?.playerId;
      const serverId = (req as any).user?.serverId;

      if (!playerId || !serverId) {
        return res.status(401).json({ 
          success: false, 
          error: "Unauthorized" 
        });
      }

      const result = await WishlistService.getWishlist(playerId, serverId);
      
      // Ajouter les stats
      if (result.success && result.wishlist) {
        const stats = await WishlistService.getWishlistStats(playerId, serverId);
        return res.json({
          ...result,
          stats
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error("❌ Error in getWishlist:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * POST /api/wishlist
   * Ajouter un héros à la wishlist
   */
  static async addHero(req: Request, res: Response) {
    try {
      const playerId = (req as any).user?.playerId;
      const serverId = (req as any).user?.serverId;
      const { heroId, itemCost } = req.body;

      if (!playerId || !serverId) {
        return res.status(401).json({ 
          success: false, 
          error: "Unauthorized" 
        });
      }

      if (!heroId) {
        return res.status(400).json({ 
          success: false, 
          error: "heroId is required" 
        });
      }

      const result = await WishlistService.addHeroToWishlist(
        playerId, 
        serverId, 
        heroId,
        itemCost
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error("❌ Error in addHero:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * DELETE /api/wishlist/:heroId
   * Retirer un héros de la wishlist
   */
  static async removeHero(req: Request, res: Response) {
    try {
      const playerId = (req as any).user?.playerId;
      const serverId = (req as any).user?.serverId;
      const { heroId } = req.params;

      if (!playerId || !serverId) {
        return res.status(401).json({ 
          success: false, 
          error: "Unauthorized" 
        });
      }

      if (!heroId) {
        return res.status(400).json({ 
          success: false, 
          error: "heroId is required" 
        });
      }

      const result = await WishlistService.removeHeroFromWishlist(
        playerId, 
        serverId, 
        heroId
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error("❌ Error in removeHero:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * PUT /api/wishlist
   * Mettre à jour toute la wishlist (remplacer)
   */
  static async updateWishlist(req: Request, res: Response) {
    try {
      const playerId = (req as any).user?.playerId;
      const serverId = (req as any).user?.serverId;
      const { heroIds } = req.body;

      if (!playerId || !serverId) {
        return res.status(401).json({ 
          success: false, 
          error: "Unauthorized" 
        });
      }

      if (!Array.isArray(heroIds)) {
        return res.status(400).json({ 
          success: false, 
          error: "heroIds must be an array" 
        });
      }

      const result = await WishlistService.updateWishlist(
        playerId, 
        serverId, 
        heroIds
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error("❌ Error in updateWishlist:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * GET /api/wishlist/available
   * Obtenir la liste des héros Legendary disponibles
   */
  static async getAvailableHeroes(req: Request, res: Response) {
    try {
      const { element } = req.query;

      const result = await WishlistService.getAvailableHeroes(
        element as string | undefined
      );

      res.json(result);
    } catch (error: any) {
      console.error("❌ Error in getAvailableHeroes:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * GET /api/wishlist/stats
   * Obtenir les statistiques de la wishlist
   */
  static async getStats(req: Request, res: Response) {
    try {
      const playerId = (req as any).user?.playerId;
      const serverId = (req as any).user?.serverId;

      if (!playerId || !serverId) {
        return res.status(401).json({ 
          success: false, 
          error: "Unauthorized" 
        });
      }

      const stats = await WishlistService.getWishlistStats(playerId, serverId);

      res.json({
        success: true,
        stats
      });
    } catch (error: any) {
      console.error("❌ Error in getStats:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

import express, { Request, Response } from "express";
import authMiddleware from "../middleware/authMiddleware";
import { CollectionService } from "../services/CollectionService";

const router = express.Router();

// GET /api/collection - Collection basique
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const progress = await CollectionService.getPlayerCollectionProgress(req.userId!);
    
    res.json({
      message: "Collection progress retrieved successfully",
      collection: progress
    });
  } catch (err: any) {
    console.error("Get collection error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/collection/detailed - Collection détaillée
router.get("/detailed", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const detailed = await CollectionService.getDetailedCollectionProgress(req.userId!);
    
    res.json({
      message: "Detailed collection progress retrieved successfully",
      collection: detailed
    });
  } catch (err: any) {
    console.error("Get detailed collection error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/collection/by-element - Par élément
router.get("/by-element", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const byElement = await CollectionService.getCollectionByElement(req.userId!);
    
    res.json({
      message: "Collection by element retrieved successfully",
      collection: byElement
    });
  } catch (err: any) {
    console.error("Get collection by element error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/collection/by-role - Par rôle
router.get("/by-role", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const byRole = await CollectionService.getCollectionByRole(req.userId!);
    
    res.json({
      message: "Collection by role retrieved successfully",
      collection: byRole
    });
  } catch (err: any) {
    console.error("Get collection by role error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/collection/missing - Héros manquants
router.get("/missing", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const missing = await CollectionService.getMissingHeroes(req.userId!, limit);
    
    res.json({
      message: "Missing heroes retrieved successfully",
      heroes: missing,
      count: missing.length
    });
  } catch (err: any) {
    console.error("Get missing heroes error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/collection/stats - Statistiques d'acquisition
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await CollectionService.getAcquisitionStats(req.userId!);
    
    res.json({
      message: "Acquisition stats retrieved successfully",
      stats
    });
  } catch (err: any) {
    console.error("Get acquisition stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

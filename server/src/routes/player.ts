import express, { Request, Response } from "express";
import Joi from "joi";
import Player from "../models/Player";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// Schémas de validation
const updatePlayerSchema = Joi.object({
  world: Joi.number().min(1).max(100).optional(),
  level: Joi.number().min(1).max(1000).optional(),
  difficulty: Joi.string().valid("Normal", "Hard", "Nightmare").optional()
});

const currencyUpdateSchema = Joi.object({
  gold: Joi.number().min(0).optional(),
  gems: Joi.number().min(0).optional(),
  paidGems: Joi.number().min(0).optional()
});

const formationSchema = Joi.object({
  heroes: Joi.array().items(Joi.string()).max(9).required() // max 9 slots
});

// === GET PLAYER INFO ===
router.get("/me", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const player = await Player.findById(req.userId)
      .select("-password")
      .populate("heroes.heroId", "name role element rarity baseStats skill");

    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    const playerStats = {
      ...player.toObject(),
      totalHeroes: player.heroes.length,
      equippedHeroes: player.heroes.filter(hero => hero.equipped).length,
      maxLevelHero: player.heroes.reduce((max, hero) => 
        hero.level > max ? hero.level : max, 0),
      totalFragments: Array.from(player.fragments.values()).reduce((sum, count) => sum + count, 0),
      totalMaterials: Array.from(player.materials.values()).reduce((sum, count) => sum + count, 0)
    };

    res.json({
      message: "Player data retrieved successfully",
      player: playerStats
    });
  } catch (err) {
    console.error("Get player error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_PLAYER_FAILED"
    });
  }
});

// === UPDATE PLAYER PROGRESS ===
router.put("/progress", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = updatePlayerSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
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

    const { world, level, difficulty } = req.body;
    
    if (world !== undefined) {
      if (world > player.world + 1) {
        res.status(400).json({ 
          error: "Cannot skip worlds",
          code: "INVALID_WORLD_PROGRESSION"
        });
        return;
      }
      player.world = world;
    }

    if (level !== undefined) {
      player.level = level;
    }

    if (difficulty !== undefined) {
      player.difficulty = difficulty;
    }

    await player.save();

    res.json({
      message: "Player progress updated successfully",
      player: {
        world: player.world,
        level: player.level,
        difficulty: player.difficulty
      }
    });
  } catch (err) {
    console.error("Update progress error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "UPDATE_PROGRESS_FAILED"
    });
  }
});

// === UPDATE CURRENCY ===
router.put("/currency", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = currencyUpdateSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
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

    const { gold, gems, paidGems } = req.body;

    if (gold !== undefined) player.gold = gold;
    if (gems !== undefined) player.gems = gems;
    if (paidGems !== undefined) player.paidGems = paidGems;

    await player.save();

    res.json({
      message: "Currency updated successfully",
      currency: {
        gold: player.gold,
        gems: player.gems,
        paidGems: player.paidGems
      }
    });
  } catch (err) {
    console.error("Update currency error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "UPDATE_CURRENCY_FAILED"
    });
  }
});

// === UPDATE FORMATION ===
router.put("/formation", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = formationSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
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

    const { heroes } = req.body;

    // Vérifier que les héros appartiennent au joueur
    const invalidHeroes = heroes.filter(
      (heroId: string) => !player.heroes.some(h => h.heroId.toString() === heroId)
    );
    if (invalidHeroes.length > 0) {
      res.status(400).json({
        error: "Some heroes are not owned by the player",
        code: "INVALID_HEROES",
        invalidHeroes
      });
      return;
    }

    // Sauvegarder la formation
    player.formations = heroes;
    await player.save();

    res.json({
      message: "Formation updated successfully",
      formation: player.formations
    });
  } catch (err) {
    console.error("Update formation error:", err);
    res.status(500).json({
      error: "Internal server error",
      code: "UPDATE_FORMATION_FAILED"
    });
  }
});

// === GET PLAYER STATISTICS ===
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const player = await Player.findById(req.userId)
      .populate("heroes.heroId", "name role element rarity");

    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    const heroStats = player.heroes.reduce((acc, hero: any) => {
      const rarity = hero.heroId?.rarity || "Unknown";
      const role = hero.heroId?.role || "Unknown";
      const element = hero.heroId?.element || "Unknown";

      acc.byRarity[rarity] = (acc.byRarity[rarity] || 0) + 1;
      acc.byRole[role] = (acc.byRole[role] || 0) + 1;
      acc.byElement[element] = (acc.byElement[element] || 0) + 1;
      
      if (hero.level > acc.maxLevel) acc.maxLevel = hero.level;
      if (hero.stars > acc.maxStars) acc.maxStars = hero.stars;

      return acc;
    }, {
      byRarity: {} as Record<string, number>,
      byRole: {} as Record<string, number>,
      byElement: {} as Record<string, number>,
      maxLevel: 0,
      maxStars: 0
    });

    const stats = {
      totalHeroes: player.heroes.length,
      equippedHeroes: player.heroes.filter(hero => hero.equipped).length,
      currency: {
        gold: player.gold,
        gems: player.gems,
        paidGems: player.paidGems,
        tickets: player.tickets
      },
      progression: {
        world: player.world,
        level: player.level,
        difficulty: player.difficulty
      },
      heroDistribution: heroStats,
      formation: player.formations || [],
      inventory: {
        totalFragments: Array.from(player.fragments.values()).reduce((sum, count) => sum + count, 0),
        totalMaterials: Array.from(player.materials.values()).reduce((sum, count) => sum + count, 0),
        fragmentTypes: player.fragments.size,
        materialTypes: player.materials.size
      },
      accountAge: player.createdAt ? Math.floor((Date.now() - player.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0
    };

    res.json({
      message: "Player statistics retrieved successfully",
      stats
    });
  } catch (err) {
    console.error("Get stats error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_STATS_FAILED"
    });
  }
});

// === DELETE PLAYER ACCOUNT ===
router.delete("/account", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const player = await Player.findById(req.userId);
    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    await Player.findByIdAndDelete(req.userId);

    res.json({
      message: "Player account deleted successfully"
    });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "DELETE_ACCOUNT_FAILED"
    });
  }
});

export default router;

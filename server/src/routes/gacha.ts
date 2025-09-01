import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import { GachaService } from "../services/GachaService";

const router = express.Router();

// Schémas de validation
const pullSchema = Joi.object({
  type: Joi.string().valid("Standard", "Limited", "Ticket").required(),
  count: Joi.number().valid(1, 10).default(1)
});

const historySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(50).default(20)
});

// === GET GACHA RATES ===
router.get("/rates", (req: Request, res: Response): void => {
  const rates = GachaService.getDropRates();
  res.json(rates);
});

// === SINGLE/MULTI PULL ===
router.post("/pull", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = pullSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { type, count } = req.body;

    console.log(`🎰 ${req.userId} effectue ${count} pulls ${type} sur serveur ${req.serverId}`);

    // Utiliser le GachaService
    const result = await GachaService.performPull(
      req.userId!,
      req.serverId!,
      type,
      count
    );

    // Formater la réponse pour l'API
    const response = {
      message: "Gacha pull successful",
      results: result.results.map(r => ({
        hero: {
          id: r.hero._id,
          name: r.hero.name,
          role: r.hero.role,
          element: r.hero.element,
          rarity: r.hero.rarity,
          baseStats: r.hero.baseStats,
          skill: r.hero.skill
        },
        rarity: r.rarity,
        isNew: r.isNew,
        fragmentsGained: r.fragmentsGained
      })),
      stats: result.stats,
      cost: result.cost,
      remaining: result.remaining,
      pityStatus: result.pityStatus
    };

    res.json(response);

  } catch (err: any) {
    console.error("Gacha pull error:", err);
    
    if (err.message.includes("not found")) {
      res.status(404).json({ 
        error: "Player not found on this server",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }
    
    if (err.message.includes("Insufficient")) {
      res.status(400).json({ 
        error: err.message,
        code: "INSUFFICIENT_RESOURCES"
      });
      return;
    }
    
    if (err.message.includes("No heroes available")) {
      res.status(500).json({ 
        error: "Game data error: No heroes available for this rarity",
        code: "NO_HEROES_AVAILABLE"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "GACHA_PULL_FAILED"
    });
  }
});

// === GET SUMMON HISTORY ===
router.get("/history", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = historySchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { page, limit } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;

    const result = await GachaService.getSummonHistory(
      req.userId!,
      req.serverId!,
      pageNum,
      limitNum
    );

    res.json({
      message: "Summon history retrieved successfully",
      summons: result.summons,
      pagination: result.pagination
    });

  } catch (err) {
    console.error("Get summon history error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_SUMMON_HISTORY_FAILED"
    });
  }
});

// === GET SUMMON STATISTICS ===
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await GachaService.getSummonStats(req.userId!, req.serverId!);

    res.json({
      message: "Summon statistics retrieved successfully",
      stats: result.stats
    });

  } catch (err) {
    console.error("Get summon stats error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_SUMMON_STATS_FAILED"
    });
  }
});

// === ROUTE DE TEST (développement uniquement) ===
router.post("/test", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV === "production") {
      res.status(404).json({ error: "Not available in production" });
      return;
    }

    console.log(`🧪 Test gacha pour ${req.userId}`);

    // Effectuer un test avec 10 pulls Standard
    const result = await GachaService.performPull(
      req.userId!,
      req.serverId!,
      "Standard",
      10
    );

    res.json({
      message: "Test gacha pull completed",
      testResults: {
        totalPulls: result.results.length,
        breakdown: result.stats,
        newHeroesObtained: result.results.filter(r => r.isNew).length,
        totalFragmentsGained: result.stats.totalFragments,
        pityProgress: result.pityStatus
      },
      detailedResults: result.results.map(r => ({
        heroName: r.hero.name,
        rarity: r.rarity,
        isNew: r.isNew,
        fragmentsGained: r.fragmentsGained
      })),
      note: "This is a test endpoint for development"
    });

  } catch (err: any) {
    console.error("Test gacha error:", err);
    res.status(500).json({ 
      error: err.message,
      code: "TEST_GACHA_FAILED"
    });
  }
});

// === ROUTE D'INFORMATION SYSTÈME GACHA ===
router.get("/info", (req: Request, res: Response): void => {
  const info = {
    system: {
      name: "Soulspire Gacha System",
      version: "1.0.0",
      description: "Multi-banner gacha with pity system"
    },
    bannerTypes: {
      Standard: {
        description: "Regular banner with all heroes",
        cost: "300 gems (single) / 2700 gems (10x)",
        rates: "50% Common, 30% Rare, 15% Epic, 5% Legendary"
      },
      Limited: {
        description: "Special banner with rate-up heroes",
        cost: "300 gems (single) / 2700 gems (10x)",
        rates: "40% Common, 35% Rare, 20% Epic, 5% Legendary"
      },
      Ticket: {
        description: "Free summon using tickets",
        cost: "1 ticket per pull",
        rates: "Same as Standard banner"
      }
    },
    pitySystem: {
      epic: {
        description: "Guaranteed Epic or better every 10 pulls",
        counter: "Resets after any Epic or Legendary"
      },
      legendary: {
        description: "Guaranteed Legendary after 90 pulls without one",
        counter: "Resets after any Legendary"
      }
    },
    features: {
      multiPullDiscount: "10x pulls cost 2700 gems instead of 3000 (10% discount)",
      duplicateConversion: "Duplicate heroes automatically convert to fragments",
      progressTracking: "All pulls count towards mission and event objectives"
    }
  };

  res.json({
    message: "Gacha system information",
    info,
    endpoints: {
      pull: "POST /api/gacha/pull - Perform summon",
      rates: "GET /api/gacha/rates - View drop rates",
      history: "GET /api/gacha/history - Summon history",
      stats: "GET /api/gacha/stats - Personal statistics"
    }
  });
});

export default router;

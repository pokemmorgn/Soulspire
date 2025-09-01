import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import { GachaService } from "../services/GachaService";

const router = express.Router();

// Schémas de validation
const bannerPullSchema = Joi.object({
  bannerId: Joi.string().required(),
  count: Joi.number().valid(1, 10).default(1)
});

const historySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(50).default(20)
});

const bannerRatesSchema = Joi.object({
  bannerId: Joi.string().required()
});

// === GET ACTIVE BANNERS ===
router.get("/banners", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`📋 ${req.userId} récupère les bannières actives (serveur ${req.serverId})`);

    const result = await GachaService.getActiveBanners(req.serverId!);

    res.json({
      message: "Active banners retrieved successfully",
      banners: result.banners,
      totalBanners: result.banners.length
    });

  } catch (err: any) {
    console.error("Get active banners error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_ACTIVE_BANNERS_FAILED"
    });
  }
});

// === GET BANNER RATES ===
router.get("/banner/rates", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = bannerRatesSchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { bannerId } = req.query;

    const result = await GachaService.getBannerRates(bannerId as string, req.serverId!);

    res.json({
      message: "Banner rates retrieved successfully",
      ...result
    });

  } catch (err: any) {
    console.error("Get banner rates error:", err);
    
    if (err.message.includes("not found")) {
      res.status(404).json({ 
        error: "Banner not found or not available on this server",
        code: "BANNER_NOT_FOUND"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_BANNER_RATES_FAILED"
    });
  }
});

// === PULL ON SPECIFIC BANNER ===
router.post("/pull", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = bannerPullSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { bannerId, count } = req.body;

    console.log(`🎰 ${req.userId} effectue ${count} pulls sur bannière ${bannerId} (serveur ${req.serverId})`);

    // Utiliser le service avec bannière spécifique
    const result = await GachaService.performPullOnBanner(
      req.userId!,
      req.serverId!,
      bannerId,
      count
    );

    // Formater la réponse pour l'API
    const response = {
      message: "Banner gacha pull successful",
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
        fragmentsGained: r.fragmentsGained,
        isFocus: r.isFocus || false
      })),
      stats: result.stats,
      cost: result.cost,
      remaining: result.remaining,
      pityStatus: result.pityStatus,
      bannerInfo: result.bannerInfo
    };

    res.json(response);

  } catch (err: any) {
    console.error("Banner gacha pull error:", err);
    
    if (err.message.includes("not found")) {
      res.status(404).json({ 
        error: err.message.includes("Player") ? "Player not found on this server" : "Banner not found or not active",
        code: err.message.includes("Player") ? "PLAYER_NOT_FOUND" : "BANNER_NOT_FOUND"
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
    
    if (err.message.includes("Cannot pull")) {
      res.status(400).json({ 
        error: err.message,
        code: "PULL_NOT_ALLOWED"
      });
      return;
    }
    
    if (err.message.includes("No heroes available")) {
      res.status(500).json({ 
        error: "Game data error: No heroes available for this banner",
        code: "NO_HEROES_AVAILABLE"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "BANNER_GACHA_PULL_FAILED"
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

    // Récupérer la première bannière active pour le test
    const bannersResult = await GachaService.getActiveBanners(req.serverId!);
    
    if (bannersResult.banners.length === 0) {
      res.status(400).json({
        error: "No active banners available for testing",
        code: "NO_BANNERS_FOR_TEST"
      });
      return;
    }

    const testBanner = bannersResult.banners[0];
    
    // Effectuer un test avec 10 pulls sur la première bannière
    const result = await GachaService.performPullOnBanner(
      req.userId!,
      req.serverId!,
      testBanner.bannerId,
      10
    );

    res.json({
      message: "Test gacha pull completed",
      testBanner: {
        bannerId: testBanner.bannerId,
        name: testBanner.name,
        type: testBanner.type
      },
      testResults: {
        totalPulls: result.results.length,
        breakdown: result.stats,
        newHeroesObtained: result.results.filter(r => r.isNew).length,
        focusHeroesObtained: result.results.filter(r => r.isFocus).length,
        totalFragmentsGained: result.stats.totalFragments,
        pityProgress: result.pityStatus
      },
      detailedResults: result.results.map(r => ({
        heroName: r.hero.name,
        rarity: r.rarity,
        isNew: r.isNew,
        isFocus: r.isFocus || false,
        fragmentsGained: r.fragmentsGained
      })),
      cost: result.cost,
      remaining: result.remaining,
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
router.get("/info", async (req: Request, res: Response): Promise<void> => {
  try {
    const info = {
      system: {
        name: "Soulspire Advanced Gacha System",
        version: "2.0.0",
        description: "Multi-banner gacha system with focus heroes and flexible pity"
      },
      features: {
        multipleBanners: "Support for multiple concurrent banners",
        focusHeroes: "Rate-up system for featured heroes",
        flexiblePity: "Banner-specific or shared pity systems",
        bannerTypes: ["Standard", "Limited", "Event", "Beginner", "Weapon"],
        costTypes: "Gems, tickets, or special currencies",
        bonusRewards: "Milestone rewards for pulling",
        serverFiltering: "Region and server-specific banners"
      },
      bannerTypes: {
        Standard: {
          description: "Regular banner with all heroes",
          availability: "Always available",
          focusHeroes: "No rate-up"
        },
        Limited: {
          description: "Special banner with rate-up heroes",
          availability: "Time-limited",
          focusHeroes: "50% chance for focus heroes on Epic/Legendary"
        },
        Event: {
          description: "Special event banner",
          availability: "During events only",
          focusHeroes: "Event-specific heroes"
        },
        Beginner: {
          description: "New player banner with guaranteed rewards",
          availability: "Limited pulls per player",
          focusHeroes: "Beginner-friendly heroes"
        },
        Weapon: {
          description: "Equipment-focused banner",
          availability: "Varies",
          focusHeroes: "Weapon-specific"
        }
      },
      pitySystem: {
        epic: {
          description: "Guaranteed Epic or better (default: every 10 pulls)",
          note: "Configurable per banner"
        },
        legendary: {
          description: "Guaranteed Legendary (default: after 90 pulls)",
          note: "Configurable per banner"
        },
        shared: "Can be shared across banners or banner-specific"
      }
    };

    res.json({
      message: "Advanced gacha system information",
      info,
      endpoints: {
        banners: "GET /api/gacha/banners - List active banners",
        bannerRates: "GET /api/gacha/banner/rates?bannerId=X - Get banner rates",
        pull: "POST /api/gacha/pull - Pull on specific banner",
        history: "GET /api/gacha/history - Summon history",
        stats: "GET /api/gacha/stats - Personal statistics",
        test: "POST /api/gacha/test - Test pulls (dev only)"
      }
    });

  } catch (err) {
    console.error("Get gacha info error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_GACHA_INFO_FAILED"
    });
  }
});

export default router;

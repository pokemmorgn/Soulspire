import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware, { optionalAuthMiddleware } from "../middleware/authMiddleware"; // ✅ Ajout import
import { requireFeature } from "../middleware/featureMiddleware";
import { GachaService } from "../services/GachaService";
import { WebSocketService } from "../services/WebSocketService";
import { CollectionService } from "../services/CollectionService"; 
import Player from "../models/Player"; 
import Hero from "../models/Hero";  
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

// === GET ACTIVE BANNERS (✅ MODIFIÉ - Auth optionnelle) ===
router.get("/banners", optionalAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ Utiliser serverId du middleware ou défaut
    const serverId = req.serverId || "S1";
    const userId = req.userId; // Peut être undefined si non connecté
    
    if (userId) {
      console.log(`📋 ${userId} récupère les bannières actives (serveur ${serverId})`);
    } else {
      console.log(`📋 Utilisateur non connecté récupère les bannières actives (serveur ${serverId})`);
    }

    const result = await GachaService.getActiveBanners(serverId);

    res.json({
      message: "Active banners retrieved successfully",
      banners: result.banners,
      totalBanners: result.banners.length,
      serverId: serverId,
      authenticated: !!userId // Indique si l'utilisateur est connecté
    });

  } catch (err: any) {
    console.error("Get active banners error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_ACTIVE_BANNERS_FAILED"
    });
  }
});

// === GET BANNER RATES (✅ MODIFIÉ - Auth optionnelle) ===
router.get("/banner/rates", optionalAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
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
    const serverId = req.serverId || "S1";

    const result = await GachaService.getBannerRates(bannerId as string, serverId);

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

// === PULL ON SPECIFIC BANNER (Auth OBLIGATOIRE) ===
router.post("/pull", authMiddleware, requireFeature("gacha"), async (req: Request, res: Response): Promise<void> => {
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
          spells: r.hero.spells
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
      bannerInfo: result.bannerInfo,
      specialEffects: result.specialEffects,
      // Ajout des données pour les animations client
      animations: {
        pullType: count === 1 ? 'single' : 'multi',
        hasLegendary: result.stats.legendary > 0,
        hasMultipleLegendary: result.stats.legendary > 1,
        perfectPull: count === 10 && result.results.every(r => ['Epic', 'Legendary'].includes(r.rarity)),
        luckyStreak: result.specialEffects?.luckyStreakCount || 0,
        pityTriggered: result.specialEffects?.hasPityBreak || false
      }
    };

    // 🎰 === NOTIFICATIONS WEBSOCKET AUTOMATIQUES === 🎰
    try {
      if (result.results.length === 1) {
        // Pull simple - notification immédiate
        WebSocketService.notifyGachaPullResult(req.userId!, {
          hero: {
            id: result.results[0].hero._id,
            name: result.results[0].hero.name,
            rarity: result.results[0].rarity,
            element: result.results[0].hero.element,
            role: result.results[0].hero.role
          },
          isNew: result.results[0].isNew,
          fragmentsGained: result.results[0].fragmentsGained,
          isFocus: result.results[0].isFocus || false,
          bannerId: bannerId,
          bannerName: result.bannerInfo?.name || 'Unknown Banner',
          cost: result.cost,
          pullNumber: result.pityStatus.pullsSinceLegendary + 1
        });

        console.log(`🔔 Pull notification sent to ${req.userId}: ${result.results[0].hero.name} (${result.results[0].rarity})`);
      } else {
        // Multi-pull - notification enrichie
        WebSocketService.notifyGachaMultiPullResult(req.userId!, {
          bannerId: bannerId,
          bannerName: result.bannerInfo?.name || 'Unknown Banner',
          heroes: result.results.map(r => ({
            hero: r.hero,
            rarity: r.rarity,
            isNew: r.isNew,
            fragmentsGained: r.fragmentsGained,
            isFocus: r.isFocus || false
          })),
          summary: result.stats,
          cost: result.cost,
          specialEffects: {
            hasPityBreak: result.specialEffects?.hasPityBreak || false,
            hasMultipleLegendary: result.stats.legendary > 1,
            perfectPull: count === 10 && result.results.every(r => ['Epic', 'Legendary'].includes(r.rarity))
          }
        });

        console.log(`🔔 Multi-pull notification sent to ${req.userId}: ${result.results.length} heroes (${result.stats.legendary}L/${result.stats.epic}E)`);
      }

      // Notifications spéciales pour drops légendaires
      const legendaryResults = result.results.filter(r => r.rarity === 'Legendary');
      for (const legendary of legendaryResults) {
        WebSocketService.notifyGachaLegendaryDrop(req.userId!, req.serverId!, {
          hero: {
            id: legendary.hero._id,
            name: legendary.hero.name,
            rarity: legendary.rarity,
            element: legendary.hero.element,
            role: legendary.hero.role
          },
          bannerId: bannerId,
          bannerName: result.bannerInfo?.name || 'Unknown Banner',
          isFirstTime: legendary.isNew,
          isFocus: legendary.isFocus || false,
          pullsSinceLast: result.pityStatus.pullsSinceLegendary,
          totalLegendaryCount: result.stats.legendary,
          dropRate: legendary.dropRate || 5 // Fallback taux
        });

        console.log(`🌟 Legendary notification sent: ${legendary.hero.name} to ${req.userId}`);
      }

      // Notification de progression pity si proche du seuil
      if (result.pityStatus.legendaryPityIn <= 10 && result.pityStatus.legendaryPityIn > 0) {
        WebSocketService.notifyGachaPityProgress(req.userId!, {
          bannerId: bannerId,
          bannerName: result.bannerInfo?.name || 'Unknown Banner',
          currentPulls: result.pityStatus.pullsSinceLegendary,
          pityThreshold: 90, // ou récupérer de la config bannière
          pullsRemaining: result.pityStatus.legendaryPityIn,
          pityType: 'legendary',
          progressPercentage: (result.pityStatus.pullsSinceLegendary / 90) * 100,
          isSharedPity: false
        });

        console.log(`📊 Pity progress notification sent: ${result.pityStatus.legendaryPityIn} pulls remaining for ${req.userId}`);
      }

      // Notification pity triggé
      if (result.specialEffects?.hasPityBreak && legendaryResults.length > 0) {
        WebSocketService.notifyGachaPityTriggered(req.userId!, {
          bannerId: bannerId,
          bannerName: result.bannerInfo?.name || 'Unknown Banner',
          pityType: 'legendary',
          guaranteedHero: legendaryResults[0].hero,
          pullsToTrigger: result.pityStatus.pullsSinceLegendary,
          newPityCount: 0
        });

        console.log(`🎯 Pity triggered notification sent for ${req.userId}`);
      }

      // Notification nouveaux héros pour la collection
      const newHeroes = result.results.filter(r => r.isNew);
      for (const newHero of newHeroes) {
        // ✅ Utiliser le service avec cache
        const collectionProgress = await CollectionService.getPlayerCollectionProgress(req.userId!);
      
        WebSocketService.notifyGachaNewHeroObtained(req.userId!, {
          hero: newHero.hero,
          bannerId: bannerId,
          bannerName: result.bannerInfo?.name || 'Unknown Banner',
          collectionProgress
        });
      
        console.log(`📚 New hero notification sent: ${newHero.hero.name} for ${req.userId} (Collection: ${collectionProgress.ownedHeroes}/${collectionProgress.totalHeroes})`);
        
        // ✅ Invalider le cache après l'ajout d'un héros
        CollectionService.invalidateCache(req.userId!);
      }

      // Notification lucky streak si applicable
      if (result.specialEffects?.luckyStreakCount && result.specialEffects.luckyStreakCount >= 3) {
        WebSocketService.notifyGachaLuckyStreak(req.userId!, {
          consecutiveRareDrops: result.specialEffects.luckyStreakCount,
          streakType: result.results.some(r => r.rarity === 'Legendary') ? 'legendary_streak' : 'epic_streak',
          recentHeroes: result.results.filter(r => ['Epic', 'Legendary'].includes(r.rarity))
            .slice(0, 3).map(r => r.hero.name),
          probability: Math.pow(0.2, result.specialEffects.luckyStreakCount),
          bonusReward: { gems: result.specialEffects.luckyStreakCount * 10 }
        });

        console.log(`🍀 Lucky streak notification sent: ${result.specialEffects.luckyStreakCount}x streak for ${req.userId}`);
      }

    } catch (notificationError) {
      console.error("⚠️ Erreur notifications WebSocket gacha:", notificationError);
      // Ne pas faire échouer la requête pour des erreurs de notification
    }

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

// === NOUVELLE ROUTE: DÉCLENCHER ÉVÉNEMENT RATE-UP (ADMIN UNIQUEMENT) ===
router.post("/admin/trigger-rate-up", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter middleware admin
    const { bannerId, duration, rateMultiplier, focusHeroes } = req.body;

    await GachaService.triggerRateUpEvent(req.serverId!, {
      bannerId,
      duration,
      rateMultiplier,
      focusHeroes
    });

    res.json({
      message: "Rate-up event triggered successfully",
      eventDetails: {
        bannerId,
        duration: `${duration}h`,
        multiplier: `x${rateMultiplier}`,
        serverId: req.serverId
      }
    });

  } catch (err: any) {
    console.error("Trigger rate-up event error:", err);
    res.status(500).json({ 
      error: "Failed to trigger rate-up event",
      code: "TRIGGER_RATE_UP_FAILED"
    });
  }
});

// === NOUVELLE ROUTE: DÉCLENCHER PULLS GRATUITS (ADMIN UNIQUEMENT) ===
router.post("/admin/trigger-free-pulls", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter middleware admin
    const { bannerId, freePulls, duration, perPlayer } = req.body;

    await GachaService.triggerFreePullsEvent(req.serverId!, {
      bannerId,
      freePulls,
      duration,
      perPlayer: perPlayer || true
    });

    res.json({
      message: "Free pulls event triggered successfully",
      eventDetails: {
        bannerId,
        freePulls: `${freePulls} pulls`,
        duration: `${duration}h`,
        perPlayer: perPlayer ? 'Per player' : 'Server-wide',
        serverId: req.serverId
      }
    });

  } catch (err: any) {
    console.error("Trigger free pulls event error:", err);
    res.status(500).json({ 
      error: "Failed to trigger free pulls event",
      code: "TRIGGER_FREE_PULLS_FAILED"
    });
  }
});

// === NOUVELLE ROUTE: ACTIVER BANNIÈRE SPÉCIALE (ADMIN UNIQUEMENT) ===
router.post("/admin/activate-special-banner", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter middleware admin
    const { bannerId, duration, exclusiveHeroes, specialMechanics } = req.body;

    await GachaService.activateSpecialBanner(req.serverId!, {
      bannerId,
      duration,
      exclusiveHeroes: exclusiveHeroes || [],
      specialMechanics: specialMechanics || []
    });

    res.json({
      message: "Special banner activated successfully",
      bannerDetails: {
        bannerId,
        duration: `${duration}h`,
        exclusiveHeroes: exclusiveHeroes?.length || 0,
        specialMechanics: specialMechanics?.length || 0,
        serverId: req.serverId
      }
    });

  } catch (err: any) {
    console.error("Activate special banner error:", err);
    res.status(500).json({ 
      error: "Failed to activate special banner",
      code: "ACTIVATE_SPECIAL_BANNER_FAILED"
    });
  }
});

// === ROUTE DE TEST (développement uniquement) ===
router.post("/test", authMiddleware, requireFeature("gacha"), async (req: Request, res: Response): Promise<void> => {
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

    // 🎰 Test des notifications WebSocket
    try {
      WebSocketService.notifyGachaMultiPullResult(req.userId!, {
        bannerId: testBanner.bannerId,
        bannerName: testBanner.name,
        heroes: result.results,
        summary: result.stats,
        cost: result.cost,
        specialEffects: {
          hasPityBreak: false,
          hasMultipleLegendary: result.stats.legendary > 1,
          perfectPull: false
        }
      });

      console.log(`🔔 Test notifications sent to ${req.userId}`);
    } catch (notifError) {
      console.warn("⚠️ Test notification error:", notifError);
    }

    res.json({
      message: "Test gacha pull completed with WebSocket notifications",
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
        pityProgress: result.pityStatus,
        specialEffects: result.specialEffects
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
      websocketNotifications: "Sent successfully",
      note: "This is a test endpoint for development with WebSocket integration"
    });

  } catch (err: any) {
    console.error("Test gacha error:", err);
    res.status(500).json({ 
      error: err.message,
      code: "TEST_GACHA_FAILED"
    });
  }
});

// === ROUTE D'INFORMATION SYSTÈME GACHA (✅ MODIFIÉ - Public) ===
router.get("/info", async (req: Request, res: Response): Promise<void> => {
  try {
    const info = {
      system: {
        name: "Soulspire Advanced Gacha System",
        version: "3.0.0",
        description: "Multi-banner gacha system with real-time WebSocket notifications"
      },
      features: {
        multipleBanners: "Support for multiple concurrent banners",
        focusHeroes: "Rate-up system for featured heroes",
        flexiblePity: "Banner-specific or shared pity systems",
        bannerTypes: ["Standard", "Limited", "Event", "Beginner", "Weapon"],
        costTypes: "Gems, tickets, or special currencies",
        bonusRewards: "Milestone rewards for pulling",
        serverFiltering: "Region and server-specific banners",
        realTimeNotifications: "WebSocket integration for instant notifications",
        smartRecommendations: "AI-powered pull recommendations",
        collectionTracking: "Automatic collection progress tracking",
        specialEvents: "Rate-up events, free pulls, special banners"
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
      },
      webSocketNotifications: {
        pullResults: "Real-time pull results with animations",
        legendaryDrops: "Special celebrations for legendary heroes",
        pityProgress: "Live pity counter updates",
        luckyStreaks: "Consecutive rare drop notifications",
        collectionProgress: "New hero acquisition tracking",
        smartRecommendations: "Intelligent pull suggestions",
        specialEvents: "Event announcements and bonuses"
      },
      adminFeatures: {
        rateUpEvents: "POST /api/gacha/admin/trigger-rate-up",
        freePullEvents: "POST /api/gacha/admin/trigger-free-pulls", 
        specialBanners: "POST /api/gacha/admin/activate-special-banner"
      }
    };

    res.json({
      message: "Advanced gacha system information with WebSocket integration",
      info,
      endpoints: {
        banners: "GET /api/gacha/banners - List active banners (public)",
        bannerRates: "GET /api/gacha/banner/rates?bannerId=X - Get banner rates (public)",
        pull: "POST /api/gacha/pull - Pull on specific banner (auth required)",
        history: "GET /api/gacha/history - Summon history (auth required)",
        stats: "GET /api/gacha/stats - Personal statistics (auth required)",
        test: "POST /api/gacha/test - Test pulls (dev only, auth required)"
      },
      websocketEvents: {
        client: [
          "gacha:join_room - Join gacha notifications",
          "gacha:leave_room - Leave gacha notifications", 
          "gacha:subscribe_banner - Subscribe to specific banner",
          "gacha:unsubscribe_banner - Unsubscribe from banner"
        ],
        server: [
          "gacha:pull_result - Single pull result",
          "gacha:multi_pull_result - Multi-pull result",
          "gacha:legendary_drop - Legendary hero obtained",
          "gacha:pity_progress - Pity system progress",
          "gacha:lucky_streak - Lucky streak achieved",
          "gacha:new_hero_obtained - New hero for collection",
          "gacha:rate_up_event - Rate-up event started",
          "gacha:special_banner_live - Special banner activated"
        ]
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



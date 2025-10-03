// server/src/routes/bestiaryRoutes.ts
import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import { BestiaryService } from "../services/BestiaryService";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════
// SCHÉMAS DE VALIDATION
// ═══════════════════════════════════════════════════════════════════

const getBestiarySchema = Joi.object({
  element: Joi.string().valid("Fire", "Water", "Wind", "Electric", "Light", "Dark").optional(),
  type: Joi.string().valid("normal", "elite", "boss").optional(),
  progressionLevel: Joi.string().valid("Undiscovered", "Discovered", "Novice", "Veteran", "Master").optional(),
  isDiscovered: Joi.boolean().optional()
});

const claimRewardSchema = Joi.object({
  rewardId: Joi.string().required()
});

const leaderboardSchema = Joi.object({
  limit: Joi.number().min(1).max(100).default(50)
});

const mostFoughtSchema = Joi.object({
  limit: Joi.number().min(1).max(50).default(10)
});

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/bestiary
 * Récupérer le bestiaire complet du joueur avec filtres optionnels
 */
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = getBestiarySchema.validate(req.query);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { element, type, progressionLevel, isDiscovered } = req.query;

    console.log(`📖 ${req.userId} récupère son bestiaire (serveur ${req.serverId})`);

    // Construire les filtres
    const filters: any = {};
    if (element) filters.element = element;
    if (type) filters.type = type;
    if (progressionLevel) filters.progressionLevel = progressionLevel;
    if (isDiscovered !== undefined) filters.isDiscovered = isDiscovered === "true";

    const result = await BestiaryService.getPlayerBestiary(
      req.userId!,
      req.serverId!,
      filters
    );

    res.json({
      success: true,
      entries: result.entries,
      stats: result.stats,
      totalMonsters: result.totalMonsters,
      filters: filters
    });

  } catch (err: any) {
    console.error("❌ Get bestiary error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "GET_BESTIARY_FAILED"
    });
  }
});

/**
 * GET /api/bestiary/stats
 * Récupérer les statistiques globales du bestiaire du joueur
 */
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`📊 ${req.userId} récupère ses stats de bestiaire`);

    const stats = await BestiaryService.getBestiaryStats(
      req.userId!,
      req.serverId!
    );

    res.json({
      success: true,
      stats
    });

  } catch (err: any) {
    console.error("❌ Get bestiary stats error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "GET_BESTIARY_STATS_FAILED"
    });
  }
});

/**
 * GET /api/bestiary/info
 * Informations sur le système de bestiaire
 */
router.get("/info", async (req: Request, res: Response): Promise<void> => {
  try {
    const info = {
      system: {
        name: "Monster Encyclopedia (Bestiary)",
        version: "1.0.0",
        description: "Collection system inspired by AFK Arena and Pokédex"
      },
      features: {
        autoDiscovery: "Monsters are automatically added after battles",
        progressionLevels: ["Undiscovered", "Discovered", "Novice (10 kills)", "Veteran (50 kills)", "Master (100 kills)"],
        rewards: "Gems, gold, lore, bonus stats, titles",
        tracking: "Combat stats, kill times, damage dealt/taken",
        completionRewards: "Type, element, and full completion bonuses",
        leaderboard: "Server-wide collector rankings"
      },
      progressionLevels: {
        Undiscovered: {
          description: "Never encountered",
          requirements: "none",
          rewards: "none",
          visibility: "Silhouette only"
        },
        Discovered: {
          description: "Encountered at least once",
          requirements: "1+ encounter",
          rewards: "10-50 gems (based on type/rarity)",
          visibility: "Basic info, name, element"
        },
        Novice: {
          description: "Defeated 10+ times",
          requirements: "10+ defeats",
          rewards: "25-100 gems",
          visibility: "Full combat statistics"
        },
        Veteran: {
          description: "Defeated 50+ times",
          requirements: "50+ defeats",
          rewards: "75-250 gems + Lore + Drop list",
          visibility: "Lore story, drop rates"
        },
        Master: {
          description: "Defeated 100+ times",
          requirements: "100+ defeats",
          rewards: "150-500 gems + Permanent bonus",
          visibility: "All info + Master title",
          bonus: "+5% damage and defense vs this monster type"
        }
      },
      completionRewards: {
        typeCompletion: {
          normal: "Complete all normal monsters",
          elite: "Complete all elite monsters",
          boss: "Complete all boss monsters"
        },
        elementCompletion: {
          description: "Discover all monsters of an element",
          reward: "500 gems + elemental damage bonus"
        },
        fullCompletion: {
          description: "Discover 100% of all monsters",
          reward: "5000 gems + Monster Hunter title + Avatar"
        }
      },
      statistics: {
        tracked: [
          "Times encountered",
          "Times defeated",
          "Times killed by monster",
          "Total damage dealt",
          "Total damage taken",
          "Fastest kill time",
          "Average kill time"
        ]
      }
    };

    res.json({
      success: true,
      info,
      endpoints: {
        listBestiary: "GET /api/bestiary - List all entries with filters",
        getStats: "GET /api/bestiary/stats - Global statistics",
        getMonster: "GET /api/bestiary/:monsterId - Specific monster details",
        getRewards: "GET /api/bestiary/rewards - Available completion rewards",
        claimReward: "POST /api/bestiary/rewards/claim - Claim a reward",
        leaderboard: "GET /api/bestiary/leaderboard - Top collectors",
        mostFought: "GET /api/bestiary/most-fought - Most fought monsters"
      },
      websocketEvents: {
        server: [
          "bestiary:discovery - New monster discovered",
          "bestiary:level_up - Progression level increased",
          "bestiary:reward_claimed - Completion reward claimed",
          "bestiary:group_completion - Type/element completed",
          "bestiary:full_completion - 100% completion achieved",
          "bestiary:personal_record - New personal record",
          "bestiary:stats_update - Combat stats updated"
        ],
        client: [
          "bestiary:join_room - Subscribe to notifications",
          "bestiary:leave_room - Unsubscribe from notifications"
        ]
      }
    });

  } catch (err: any) {
    console.error("❌ Get bestiary info error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "GET_INFO_FAILED"
    });
  }
});

/**
 * GET /api/bestiary/:monsterId
 * Récupérer les détails d'un monstre spécifique dans le bestiaire
 */
router.get("/:monsterId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { monsterId } = req.params;

    console.log(`🔍 ${req.userId} consulte monstre ${monsterId}`);

    const entry = await BestiaryService.getMonsterEntry(
      req.userId!,
      req.serverId!,
      monsterId
    );

    res.json({
      success: true,
      entry
    });

  } catch (err: any) {
    console.error("❌ Get monster entry error:", err);

    if (err.message.includes("not found")) {
      res.status(404).json({
        success: false,
        error: "Monster not found",
        code: "MONSTER_NOT_FOUND"
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "GET_MONSTER_ENTRY_FAILED"
    });
  }
});

/**
 * GET /api/bestiary/rewards
 * Récupérer les récompenses de complétion disponibles
 */
router.get("/rewards", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`🎁 ${req.userId} consulte les récompenses de complétion`);

    const rewards = await BestiaryService.getCompletionRewards(
      req.userId!,
      req.serverId!
    );

    res.json({
      success: true,
      rewards
    });

  } catch (err: any) {
    console.error("❌ Get completion rewards error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "GET_COMPLETION_REWARDS_FAILED"
    });
  }
});

/**
 * POST /api/bestiary/rewards/claim
 * Réclamer une récompense de complétion
 */
router.post("/rewards/claim", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = claimRewardSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { rewardId } = req.body;

    console.log(`🎁 ${req.userId} réclame récompense ${rewardId}`);

    const result = await BestiaryService.claimCompletionReward(
      req.userId!,
      req.serverId!,
      rewardId
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.message,
        code: "REWARD_NOT_AVAILABLE"
      });
      return;
    }

    res.json({
      success: true,
      message: result.message,
      reward: result.reward
    });

  } catch (err: any) {
    console.error("❌ Claim completion reward error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "CLAIM_REWARD_FAILED"
    });
  }
});

/**
 * GET /api/bestiary/leaderboard
 * Récupérer le classement des collectionneurs du serveur
 */
router.get("/leaderboard", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = leaderboardSchema.validate(req.query);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { limit } = req.query;
    const limitNum = parseInt(limit as string) || 50;

    console.log(`🏆 ${req.userId} consulte le leaderboard bestiaire`);

    const leaderboard = await BestiaryService.getBestiaryLeaderboard(
      req.serverId!,
      limitNum
    );

    res.json({
      success: true,
      leaderboard,
      total: leaderboard.length
    });

  } catch (err: any) {
    console.error("❌ Get bestiary leaderboard error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "GET_LEADERBOARD_FAILED"
    });
  }
});

/**
 * GET /api/bestiary/most-fought
 * Récupérer les monstres les plus combattus (global ou personnel)
 */
router.get("/most-fought", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = mostFoughtSchema.validate(req.query);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { limit, personal } = req.query;
    const limitNum = parseInt(limit as string) || 10;
    const isPersonal = personal === "true";

    console.log(`⚔️ ${req.userId} consulte monstres les plus combattus (${isPersonal ? "personnel" : "global"})`);

    const mostFought = await BestiaryService.getMostFoughtMonsters(
      req.serverId!,
      isPersonal ? req.userId! : undefined,
      limitNum
    );

    res.json({
      success: true,
      monsters: mostFought,
      scope: isPersonal ? "personal" : "server",
      total: mostFought.length
    });

  } catch (err: any) {
    console.error("❌ Get most fought monsters error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "GET_MOST_FOUGHT_FAILED"
    });
  }
});

/**
 * POST /api/bestiary/unlock/:monsterId (Admin/Debug)
 * Débloquer manuellement un monstre dans le bestiaire
 */
router.post("/unlock/:monsterId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter middleware admin
    const { monsterId } = req.params;

    console.log(`🔓 ${req.userId} débloque manuellement ${monsterId}`);

    const entry = await BestiaryService.unlockMonster(
      req.userId!,
      req.serverId!,
      monsterId
    );

    res.json({
      success: true,
      message: `Monster ${entry.monsterSnapshot.name} unlocked`,
      entry: entry.getBestiaryInfo(true)
    });

  } catch (err: any) {
    console.error("❌ Unlock monster error:", err);

    if (err.message.includes("not found")) {
      res.status(404).json({
        success: false,
        error: "Monster not found",
        code: "MONSTER_NOT_FOUND"
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
      code: "UNLOCK_MONSTER_FAILED"
    });
  }
});

export default router;

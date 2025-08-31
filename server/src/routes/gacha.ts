import express, { Request, Response } from "express";
import Joi from "joi";
import Player from "../models/Player";
import Hero from "../models/Hero";
import Summon from "../models/Summon";
import authMiddleware from "../middleware/authMiddleware";
import { GachaPullRequest, GachaPullResponse } from "../types/index";

const router = express.Router();

// Configuration des coûts et taux
const GACHA_CONFIG = {
  costs: {
    single: { gems: 300 },
    multi: { gems: 2700 }, // Réduction pour 10 invocations
    ticket: { tickets: 1 }
  },
  rates: {
    standard: {
      Common: 50,
      Rare: 30,
      Epic: 15,
      Legendary: 5
    },
    limited: {
      Common: 40,
      Rare: 35,
      Epic: 20,
      Legendary: 5
    }
  },
  pity: {
    legendary: 90, // Garanti au bout de 90 pulls sans legendary
    epic: 10      // Garanti au bout de 10 pulls sans epic
  }
};

// Schémas de validation
const pullSchema = Joi.object({
  type: Joi.string().valid("Standard", "Limited", "Ticket").required(),
  count: Joi.number().valid(1, 10).default(1)
});

// === GET GACHA RATES ===
router.get("/rates", (req: Request, res: Response): void => {
  res.json({
    message: "Gacha rates retrieved successfully",
    rates: GACHA_CONFIG.rates,
    costs: GACHA_CONFIG.costs,
    pity: GACHA_CONFIG.pity
  });
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

    const { type, count }: { type: "Standard" | "Limited" | "Ticket", count: number } = req.body;

    const player = await Player.findById(req.userId);
    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    // Calcul du coût total
    let totalCost: { gems?: number; tickets?: number } = {};
    
    if (type === "Ticket") {
      totalCost.tickets = count;
      if (player.tickets < totalCost.tickets) {
        res.status(400).json({ 
          error: `Insufficient tickets. Required: ${totalCost.tickets}, Available: ${player.tickets}`,
          code: "INSUFFICIENT_TICKETS"
        });
        return;
      }
    } else {
      totalCost.gems = count === 1 ? GACHA_CONFIG.costs.single.gems : GACHA_CONFIG.costs.multi.gems;
      if (player.gems < totalCost.gems) {
        res.status(400).json({ 
          error: `Insufficient gems. Required: ${totalCost.gems}, Available: ${player.gems}`,
          code: "INSUFFICIENT_GEMS"
        });
        return;
      }
    }

    // Système de pity (récupération des pulls précédents)
    const recentSummons = await Summon.find({ playerId: player._id })
      .sort({ createdAt: -1 })
      .limit(100);

    let pullsSinceLegendary = 0;
    let pullsSinceEpic = 0;

    for (const summon of recentSummons) {
      for (const hero of summon.heroesObtained) {
        if (hero.rarity === "Legendary") {
          pullsSinceLegendary = 0;
          break;
        }
        if (hero.rarity === "Epic") {
          pullsSinceEpic = 0;
        }
        pullsSinceLegendary++;
        pullsSinceEpic++;
      }
      if (pullsSinceLegendary === 0) break;
    }

    // Génération des héros
    const obtainedHeroes = [];
    const rates = GACHA_CONFIG.rates[type.toLowerCase() as keyof typeof GACHA_CONFIG.rates] || GACHA_CONFIG.rates.standard;

    for (let i = 0; i < count; i++) {
      let rarity: string;
      
      // Système de pity
      if (pullsSinceLegendary + i >= GACHA_CONFIG.pity.legendary) {
        rarity = "Legendary";
      } else if (pullsSinceEpic + i >= GACHA_CONFIG.pity.epic) {
        rarity = "Epic";
      } else {
        // Tirage normal basé sur les taux
        const rand = Math.random() * 100;
        let cumulative = 0;
        
        for (const [rarityName, rate] of Object.entries(rates)) {
          cumulative += rate;
          if (rand < cumulative) {
            rarity = rarityName;
            break;
          }
        }
        rarity = rarity! || "Common";
      }

      // Sélection d'un héros de cette rareté
      const availableHeroes = await Hero.find({ rarity });
      if (availableHeroes.length === 0) {
        res.status(500).json({ 
          error: `No heroes available for rarity: ${rarity}`,
          code: "NO_HEROES_AVAILABLE"
        });
        return;
      }

      const selectedHero = availableHeroes[Math.floor(Math.random() * availableHeroes.length)];
      
      // Vérifier si le joueur possède déjà ce héros
      const existingHero = player.heroes.find(h => h.heroId.toString() === (selectedHero._id as any).toString());
      
      if (existingHero) {
        // Conversion en fragments si héros déjà possédé
        const fragmentsGained = rarity === "Legendary" ? 25 : rarity === "Epic" ? 15 : rarity === "Rare" ? 10 : 5;
        const currentFragments = player.fragments.get((selectedHero._id as any).toString()) || 0;
        player.fragments.set((selectedHero._id as any).toString(), currentFragments + fragmentsGained);
        
        obtainedHeroes.push({
          hero: selectedHero,
          rarity,
          isNew: false,
          fragmentsGained
        });
      } else {
        // Nouveau héros
        player.heroes.push({
          heroId: (selectedHero._id as any).toString(),
          level: 1,
          stars: 1,
          equipped: false
        });
        
        obtainedHeroes.push({
          hero: selectedHero,
          rarity,
          isNew: true,
          fragmentsGained: 0
        });
      }

      // Reset pity counters si nécessaire
      if (rarity === "Legendary") {
        pullsSinceLegendary = 0;
        pullsSinceEpic = 0;
      } else if (rarity === "Epic") {
        pullsSinceEpic = 0;
      }
    }

    // Déduction des ressources
    if (totalCost.gems) player.gems -= totalCost.gems;
    if (totalCost.tickets) player.tickets -= totalCost.tickets;

    await player.save();

    // Enregistrement de l'invocation
    const summon = new Summon({
      playerId: player._id,
      heroesObtained: obtainedHeroes.map(h => ({
        heroId: h.hero._id,
        rarity: h.rarity
      })),
      type
    });
    await summon.save();

    // Statistiques du pull
    const pullStats = {
      legendary: obtainedHeroes.filter(h => h.rarity === "Legendary").length,
      epic: obtainedHeroes.filter(h => h.rarity === "Epic").length,
      rare: obtainedHeroes.filter(h => h.rarity === "Rare").length,
      common: obtainedHeroes.filter(h => h.rarity === "Common").length,
      newHeroes: obtainedHeroes.filter(h => h.isNew).length,
      totalFragments: obtainedHeroes.reduce((sum, h) => sum + h.fragmentsGained, 0)
    };

    res.json({
      message: "Gacha pull successful",
      results: obtainedHeroes.map(h => ({
        hero: {
          id: h.hero._id,
          name: h.hero.name,
          role: h.hero.role,
          element: h.hero.element,
          rarity: h.hero.rarity,
          baseStats: h.hero.baseStats,
          skill: h.hero.skill
        },
        rarity: h.rarity,
        isNew: h.isNew,
        fragmentsGained: h.fragmentsGained
      })),
      stats: pullStats,
      cost: totalCost,
      remaining: {
        gems: player.gems,
        tickets: player.tickets
      },
      pityStatus: {
        pullsSinceLegendary: pullsSinceLegendary + count,
        pullsSinceEpic: pullsSinceEpic + count,
        legendaryPityIn: Math.max(0, GACHA_CONFIG.pity.legendary - (pullsSinceLegendary + count)),
        epicPityIn: Math.max(0, GACHA_CONFIG.pity.epic - (pullsSinceEpic + count))
      }
    });
  } catch (err) {
    console.error("Gacha pull error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GACHA_PULL_FAILED"
    });
  }
});

// === GET SUMMON HISTORY ===
router.get("/history", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const [summons, total] = await Promise.all([
      Summon.find({ playerId: req.userId })
        .populate("heroesObtained.heroId", "name role element rarity")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Summon.countDocuments({ playerId: req.userId })
    ]);

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    };

    res.json({
      message: "Summon history retrieved successfully",
      summons,
      pagination
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
    // Version simplifiée sans les méthodes statiques
    const rarityStats = await Summon.aggregate([
      { $match: { playerId: req.userId! } },
      { $unwind: "$heroesObtained" },
      { $group: {
        _id: "$heroesObtained.rarity",
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    const totalStats = await Summon.aggregate([
      { $match: { playerId: req.userId! } },
      { $group: {
        _id: null,
        totalSummons: { $sum: { $size: "$heroesObtained" } },
        totalSessions: { $sum: 1 }
      }}
    ]);

    const stats = {
      totalSummons: totalStats[0]?.totalSummons || 0,
      totalSessions: totalStats[0]?.totalSessions || 0,
      rarityDistribution: rarityStats.reduce((acc: any, stat: any) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {} as Record<string, number>)
    };

    // Calcul des taux réels
    if (stats.totalSummons > 0) {
      Object.keys(stats.rarityDistribution).forEach(rarity => {
        (stats as any)[`${rarity.toLowerCase()}Rate`] = 
          ((stats.rarityDistribution[rarity] / stats.totalSummons) * 100).toFixed(2) + "%";
      });
    }

    res.json({
      message: "Summon statistics retrieved successfully",
      stats
    });
  } catch (err) {
    console.error("Get summon stats error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_SUMMON_STATS_FAILED"
    });
  }
});

export default router;

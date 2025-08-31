import express, { Request, Response } from "express";
import Joi from "joi";
import Hero from "../models/Hero";
import Player from "../models/Player";
import authMiddleware, { optionalAuthMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

// Schémas de validation
const heroFilterSchema = Joi.object({
  role: Joi.string().valid("Tank", "DPS Melee", "DPS Ranged", "Support").optional(),
  element: Joi.string().valid("Fire", "Water", "Wind", "Electric", "Light", "Dark").optional(),
  rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary").optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20)
});

const heroUpgradeSchema = Joi.object({
  heroId: Joi.string().required(),
  targetLevel: Joi.number().min(1).max(100).optional(),
  targetStars: Joi.number().min(1).max(6).optional()
});

const equipHeroSchema = Joi.object({
  heroId: Joi.string().required(),
  equipped: Joi.boolean().required()
});

// === GET ALL HEROES (CATALOG) ===
router.get("/catalog", optionalAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = heroFilterSchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { role, element, rarity, page, limit } = req.query;
    const skip = ((page as number) - 1) * (limit as number);

    // Construction du filtre
    const filter: any = {};
    if (role) filter.role = role;
    if (element) filter.element = element;
    if (rarity) filter.rarity = rarity;

    const [heroes, total] = await Promise.all([
      Hero.find(filter)
        .select("name role element rarity baseStats skill")
        .skip(skip)
        .limit(limit as number)
        .sort({ name: 1 }),
      Hero.countDocuments(filter)
    ]);

    const pagination = {
      page: page as number,
      limit: limit as number,
      total,
      pages: Math.ceil(total / (limit as number))
    };

    res.json({
      message: "Heroes catalog retrieved successfully",
      heroes,
      pagination
    });
  } catch (err) {
    console.error("Get catalog error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_CATALOG_FAILED"
    });
  }
});

// === GET SPECIFIC HERO DETAILS ===
router.get("/catalog/:heroId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { heroId } = req.params;

    const hero = await Hero.findById(heroId);
    if (!hero) {
      res.status(404).json({ 
        error: "Hero not found",
        code: "HERO_NOT_FOUND"
      });
      return;
    }

    // Calculer les stats à différents niveaux pour référence
    const statsByLevel = [1, 25, 50, 75, 100].map(level => ({
      level,
      stars1: hero.getStatsAtLevel(level, 1),
      stars3: hero.getStatsAtLevel(level, 3),
      stars6: hero.getStatsAtLevel(level, 6)
    }));

    res.json({
      message: "Hero details retrieved successfully",
      hero: {
        ...hero.toObject(),
        statsByLevel,
        rarityMultiplier: hero.getRarityMultiplier()
      }
    });
  } catch (err) {
    console.error("Get hero details error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_HERO_DETAILS_FAILED"
    });
  }
});

// === GET PLAYER'S HEROES ===
router.get("/my", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = heroFilterSchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const player = await Player.findById(req.userId)
      .populate({
        path: "heroes.heroId",
        select: "name role element rarity baseStats skill"
      });

    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    const { role, element, rarity } = req.query;

    // Filtrage des héros
    let filteredHeroes = player.heroes.filter((playerHero: any) => {
      if (!playerHero.heroId) return false;
      
      const hero = playerHero.heroId;
      if (role && hero.role !== role) return false;
      if (element && hero.element !== element) return false;
      if (rarity && hero.rarity !== rarity) return false;
      
      return true;
    });

    // Enrichissement avec les stats calculées
    const enrichedHeroes = filteredHeroes.map((playerHero: any) => {
      const hero = playerHero.heroId;
      const currentStats = hero.getStatsAtLevel(playerHero.level, playerHero.stars);
      
      return {
        playerHeroId: playerHero._id,
        hero: hero.toObject(),
        level: playerHero.level,
        stars: playerHero.stars,
        equipped: playerHero.equipped,
        currentStats,
        powerLevel: Math.floor(
          (currentStats.hp + currentStats.atk + currentStats.def) * 
          hero.getRarityMultiplier()
        )
      };
    });

    // Tri par niveau de puissance décroissant
    enrichedHeroes.sort((a, b) => b.powerLevel - a.powerLevel);

    res.json({
      message: "Player heroes retrieved successfully",
      heroes: enrichedHeroes,
      summary: {
        total: enrichedHeroes.length,
        equipped: enrichedHeroes.filter(h => h.equipped).length,
        maxLevel: Math.max(...enrichedHeroes.map(h => h.level), 0),
        maxStars: Math.max(...enrichedHeroes.map(h => h.stars), 0)
      }
    });
  } catch (err) {
    console.error("Get player heroes error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_PLAYER_HEROES_FAILED"
    });
  }
});

// === UPGRADE HERO ===
router.post("/upgrade", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = heroUpgradeSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { heroId, targetLevel, targetStars } = req.body;

    const player = await Player.findById(req.userId);
    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    const playerHero = player.heroes.find(h => h.heroId.toString() === heroId);
    if (!playerHero) {
      res.status(404).json({ 
        error: "Hero not owned by player",
        code: "HERO_NOT_OWNED"
      });
      return;
    }

    let goldCost = 0;
    let materialCost = 0;

    // Calcul du coût d'amélioration de niveau
    if (targetLevel && targetLevel > playerHero.level) {
      const levelDiff = targetLevel - playerHero.level;
      goldCost = levelDiff * playerHero.level * 100; // Coût progressif
    }

    // Calcul du coût d'amélioration d'étoiles
    if (targetStars && targetStars > playerHero.stars) {
      const starDiff = targetStars - playerHero.stars;
      materialCost = starDiff * 10; // Fragments nécessaires
    }

    // Vérification des ressources
    if (goldCost > 0 && player.gold < goldCost) {
      res.status(400).json({ 
        error: `Insufficient gold. Required: ${goldCost}, Available: ${player.gold}`,
        code: "INSUFFICIENT_GOLD"
      });
      return;
    }

    if (materialCost > 0) {
      const currentFragments = player.fragments.get(heroId) || 0;
      if (currentFragments < materialCost) {
        res.status(400).json({ 
          error: `Insufficient fragments. Required: ${materialCost}, Available: ${currentFragments}`,
          code: "INSUFFICIENT_FRAGMENTS"
        });
        return;
      }
    }

    // Application des améliorations
    if (targetLevel) playerHero.level = targetLevel;
    if (targetStars) playerHero.stars = targetStars;

    // Déduction des ressources
    if (goldCost > 0) player.gold -= goldCost;
    if (materialCost > 0) {
      const currentFragments = player.fragments.get(heroId) || 0;
      player.fragments.set(heroId, currentFragments - materialCost);
    }

    await player.save();

    res.json({
      message: "Hero upgraded successfully",
      hero: {
        heroId,
        level: playerHero.level,
        stars: playerHero.stars
      },
      cost: {
        gold: goldCost,
        fragments: materialCost
      },
      remaining: {
        gold: player.gold,
        fragments: player.fragments.get(heroId) || 0
      }
    });
  } catch (err) {
    console.error("Upgrade hero error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "UPGRADE_HERO_FAILED"
    });
  }
});

// === EQUIP/UNEQUIP HERO ===
router.post("/equip", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = equipHeroSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { heroId, equipped } = req.body;

    const player = await Player.findById(req.userId);
    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    const playerHero = player.heroes.find(h => h.heroId.toString() === heroId);
    if (!playerHero) {
      res.status(404).json({ 
        error: "Hero not owned by player",
        code: "HERO_NOT_OWNED"
      });
      return;
    }

    // Limite d'équipement (ex: maximum 4 héros équipés)
    if (equipped) {
      const equippedCount = player.heroes.filter(h => h.equipped).length;
      if (equippedCount >= 4 && !playerHero.equipped) {
        res.status(400).json({ 
          error: "Maximum equipped heroes limit reached (4)",
          code: "MAX_EQUIPPED_REACHED"
        });
        return;
      }
    }

    playerHero.equipped = equipped;
    await player.save();

    res.json({
      message: `Hero ${equipped ? 'equipped' : 'unequipped'} successfully`,
      heroId,
      equipped: playerHero.equipped,
      totalEquipped: player.heroes.filter(h => h.equipped).length
    });
  } catch (err) {
    console.error("Equip hero error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "EQUIP_HERO_FAILED"
    });
  }
});

export default router;

import express, { Request, Response } from "express";
import Joi from "joi";
import Hero from "../models/Hero";
import Player from "../models/Player";
import authMiddleware, { optionalAuthMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

// -------------------- Utils --------------------
function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getHeroKeyId(hero: any): string {
  // Préférence au champ heroId stocké, sinon fallback slug(name)
  if (hero.heroId && typeof hero.heroId === "string" && hero.heroId.trim()) return hero.heroId;
  if (hero.name && typeof hero.name === "string" && hero.name.trim()) return slugify(hero.name);
  return ""; // dernier recours (évitons de casser la réponse)
}

function buildGenericKeys(hero: any) {
  const kid = getHeroKeyId(hero);
  return {
    heroId: kid,
    name: `${kid}_name`,
    description: `${kid}_description`,
    icon: `${kid}_icon`,
    sprite: `${kid}_sprite`,
    splashArt: `${kid}_splashArt`,
    strengths: `${kid}_strengths`,
    weaknesses: `${kid}_weaknesses`,
  };
}

// -------------------- Validation --------------------
const heroFilterSchema = Joi.object({
  role: Joi.string().valid("Tank", "DPS Melee", "DPS Ranged", "Support").optional(),
  element: Joi.string().valid("Fire", "Water", "Wind", "Electric", "Light", "Dark").optional(),
  rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary").optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
});

const heroUpgradeSchema = Joi.object({
  heroId: Joi.string().required(),            // <- ATTENTION: ici c'est l'_id Mongo côté Player.heroes[]
  targetLevel: Joi.number().min(1).max(100).optional(),
  targetStars: Joi.number().min(1).max(6).optional(),
});

const equipHeroSchema = Joi.object({
  heroId: Joi.string().required(),            // <- idem: _id Mongo du Hero
  equipped: Joi.boolean().required(),
});

// -------------------- Routes --------------------

// === GET ALL HEROES (CATALOG) ===
router.get("/catalog", optionalAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = heroFilterSchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { role, element, rarity, page, limit } = req.query as any;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {};
    if (role) filter.role = role;
    if (element) filter.element = element;
    if (rarity) filter.rarity = rarity;

    const [heroes, total] = await Promise.all([
      Hero.find(filter)
        .select("_id heroId name role element rarity baseStats spells")
        .skip(skip)
        .limit(limitNum)
        .sort({ name: 1 }),
      Hero.countDocuments(filter),
    ]);

    // Injecte les clés génériques
    const payload = heroes.map(h => {
      const obj = h.toObject();
      const keys = buildGenericKeys(obj);
      return {
        _id: obj._id,
        heroId: keys.heroId, // stable pour assets/traductions
        // Clés génériques pour le client (textes + assets)
        name: keys.name,
        description: keys.description,
        icon: keys.icon,
        sprite: keys.sprite,
        splashArt: keys.splashArt,
        strengths: keys.strengths,
        weaknesses: keys.weaknesses,
        // Données gameplay
        role: obj.role,
        element: obj.element,
        rarity: obj.rarity,
        baseStats: obj.baseStats,
        spells: obj.spells,
      };
    });

    res.json({
      message: "Heroes catalog retrieved successfully",
      heroes: payload,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error("Get catalog error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_CATALOG_FAILED" });
  }
});

// === GET SPECIFIC HERO DETAILS ===
router.get("/catalog/:heroId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { heroId } = req.params;

    // Ici heroId est l'_id MongoDB du document Hero (si tu veux supporter aussi heroId slug, ajoute une recherche alternative)
    const hero = await Hero.findById(heroId).select("_id heroId name role element rarity baseStats spells");
    if (!hero) {
      res.status(404).json({ error: "Hero not found", code: "HERO_NOT_FOUND" });
      return;
    }

    const obj = hero.toObject();
    const keys = buildGenericKeys(obj);

    // Paliers de stats
    const levels = [1, 25, 50, 75, 100];
    const starsList = [1, 3, 6];
    const statsByLevel = levels.map(level => {
      const byStars: Record<string, any> = {};
      starsList.forEach(stars => { byStars[`stars${stars}`] = hero.getStatsAtLevel(level, stars); });
      return { level, ...byStars };
    });

    res.json({
      message: "Hero details retrieved successfully",
      hero: {
        _id: obj._id,
        heroId: keys.heroId,
        // clés génériques
        name: keys.name,
        description: keys.description,
        icon: keys.icon,
        sprite: keys.sprite,
        splashArt: keys.splashArt,
        strengths: keys.strengths,
        weaknesses: keys.weaknesses,
        // gameplay
        role: obj.role,
        element: obj.element,
        rarity: obj.rarity,
        baseStats: obj.baseStats,
        spells: obj.spells,
        statsByLevel,
        rarityMultiplier: hero.getRarityMultiplier(),
      },
    });
  } catch (err) {
    console.error("Get hero details error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_HERO_DETAILS_FAILED" });
  }
});

// === GET PLAYER'S HEROES ===
router.get("/my", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = heroFilterSchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const player = await Player.findById(req.userId).populate({
      path: "heroes.heroId",
      select: "_id heroId name role element rarity baseStats spells",
    });

    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }

    const { role, element, rarity } = req.query as any;

    const filtered = player.heroes.filter((ph: any) => {
      const h = ph.heroId;
      if (!h) return false;
      if (role && h.role !== role) return false;
      if (element && h.element !== element) return false;
      if (rarity && h.rarity !== rarity) return false;
      return true;
    });

    const enriched = filtered.map((ph: any) => {
      const heroDoc = ph.heroId;
      const obj = heroDoc.toObject();
      const keys = buildGenericKeys(obj);

      const currentStats = heroDoc.getStatsAtLevel(ph.level, ph.stars);
      const basicPower = currentStats.hp + currentStats.atk + currentStats.def;
      const powerLevel = Math.floor(basicPower * heroDoc.getRarityMultiplier());

      return {
        playerHeroId: ph._id,
        // renvoyer aussi l'_id du hero + heroId (slug)
        hero: {
          _id: obj._id,
          heroId: keys.heroId,
          name: keys.name,
          description: keys.description,
          icon: keys.icon,
          sprite: keys.sprite,
          splashArt: keys.splashArt,
          strengths: keys.strengths,
          weaknesses: keys.weaknesses,
          role: obj.role,
          element: obj.element,
          rarity: obj.rarity,
          baseStats: obj.baseStats,
          spells: obj.spells,
        },
        level: ph.level,
        stars: ph.stars,
        equipped: ph.equipped,
        currentStats,
        powerLevel,
      };
    }).sort((a: any, b: any) => b.powerLevel - a.powerLevel);

    res.json({
      message: "Player heroes retrieved successfully",
      heroes: enriched,
      summary: {
        total: enriched.length,
        equipped: enriched.filter(h => h.equipped).length,
        maxLevel: Math.max(...enriched.map(h => h.level), 0),
        maxStars: Math.max(...enriched.map(h => h.stars), 0),
      },
    });
  } catch (err) {
    console.error("Get player heroes error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_PLAYER_HEROES_FAILED" });
  }
});

// === UPGRADE HERO ===
router.post("/upgrade", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = heroUpgradeSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroId, targetLevel, targetStars } = req.body; // heroId = _id Mongo du Hero dans l'inventaire

    const player = await Player.findById(req.userId);
    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }

    const playerHero = player.heroes.find((h: any) => h.heroId.toString() === heroId);
    if (!playerHero) {
      res.status(404).json({ error: "Hero not owned by player", code: "HERO_NOT_OWNED" });
      return;
    }

    let goldCost = 0;
    let materialCost = 0;

    if (targetLevel && targetLevel > playerHero.level) {
      const levelDiff = targetLevel - playerHero.level;
      goldCost = levelDiff * playerHero.level * 100;
    }

    if (targetStars && targetStars > playerHero.stars) {
      const starDiff = targetStars - playerHero.stars;
      materialCost = starDiff * 10;
    }

    if (goldCost > 0 && player.gold < goldCost) {
      res.status(400).json({
        error: `Insufficient gold. Required: ${goldCost}, Available: ${player.gold}`,
        code: "INSUFFICIENT_GOLD",
      });
      return;
    }

    if (materialCost > 0) {
      const currentFragments = player.fragments.get(heroId) || 0;
      if (currentFragments < materialCost) {
        res.status(400).json({
          error: `Insufficient fragments. Required: ${materialCost}, Available: ${currentFragments}`,
          code: "INSUFFICIENT_FRAGMENTS",
        });
        return;
      }
    }

    if (targetLevel) playerHero.level = targetLevel;
    if (targetStars) playerHero.stars = targetStars;

    if (goldCost > 0) player.gold -= goldCost;
    if (materialCost > 0) {
      const currentFragments = player.fragments.get(heroId) || 0;
      player.fragments.set(heroId, currentFragments - materialCost);
    }

    await player.save();

    res.json({
      message: "Hero upgraded successfully",
      hero: { heroId, level: playerHero.level, stars: playerHero.stars },
      cost: { gold: goldCost, fragments: materialCost },
      remaining: { gold: player.gold, fragments: player.fragments.get(heroId) || 0 },
    });
  } catch (err) {
    console.error("Upgrade hero error:", err);
    res.status(500).json({ error: "Internal server error", code: "UPGRADE_HERO_FAILED" });
  }
});

// === EQUIP/UNEQUIP HERO ===
router.post("/equip", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = equipHeroSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroId, equipped } = req.body; // heroId = _id Mongo du Hero

    const player = await Player.findById(req.userId);
    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }

    const playerHero = player.heroes.find((h: any) => h.heroId.toString() === heroId);
    if (!playerHero) {
      res.status(404).json({ error: "Hero not owned by player", code: "HERO_NOT_OWNED" });
      return;
    }

    if (equipped) {
      const equippedCount = player.heroes.filter((h: any) => h.equipped).length;
      if (equippedCount >= 4 && !playerHero.equipped) {
        res.status(400).json({ error: "Maximum equipped heroes limit reached (4)", code: "MAX_EQUIPPED_REACHED" });
        return;
      }
    }

    playerHero.equipped = equipped;
    await player.save();

    res.json({
      message: `Hero ${equipped ? "equipped" : "unequipped"} successfully`,
      heroId,
      equipped: playerHero.equipped,
      totalEquipped: player.heroes.filter((h: any) => h.equipped).length,
    });
  } catch (err) {
    console.error("Equip hero error:", err);
    res.status(500).json({ error: "Internal server error", code: "EQUIP_HERO_FAILED" });
  }
});

export default router;

import express, { Request, Response } from "express";
import Joi from "joi";
import Hero from "../models/Hero";
import Player from "../models/Player";
import authMiddleware, { optionalAuthMiddleware } from "../middleware/authMiddleware";
import serverMiddleware from "../middleware/serverMiddleware";
import { requireFeature } from "../middleware/featureMiddleware";
import { HeroUpgradeService } from "../services/HeroUpgradeService";

const router = express.Router();

// ✅ APPLIQUER le middleware serveur à toutes les routes
router.use(serverMiddleware);

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getHeroKeyId(hero: any): string {
  if (hero.heroId && typeof hero.heroId === "string" && hero.heroId.trim()) return hero.heroId;
  if (hero.name && typeof hero.name === "string" && hero.name.trim()) return slugify(hero.name);
  return "";
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

// Fonction utilitaire pour récupérer les identifiants corrects
function getPlayerIdentifiers(req: Request): { accountId?: string; playerId?: string; serverId: string } {
  // Priorité au nouveau format Account/Player
  if (req.accountId && req.playerId && req.serverId) {
    return {
      accountId: req.accountId,
      playerId: req.playerId,
      serverId: req.serverId
    };
  }
  
  // Format legacy avec userId
  return {
    playerId: req.userId,
    serverId: req.serverId || "S1"
  };
}

// Fonction pour construire la query de recherche Player
function buildPlayerQuery(identifiers: { accountId?: string; playerId?: string; serverId: string }) {
  const query: any = { serverId: identifiers.serverId };
  
  // Si on a accountId, on l'utilise (architecture Account/Player)
  if (identifiers.accountId) {
    query.accountId = identifiers.accountId;
  }
  // Sinon on utilise playerId (architecture legacy)
  else if (identifiers.playerId) {
    query.playerId = identifiers.playerId;
  }
  
  return query;
}

// === VALIDATION SCHEMAS ===

const heroFilterSchema = Joi.object({
  role: Joi.string().valid("Tank", "DPS Melee", "DPS Ranged", "Support").optional(),
  element: Joi.string().valid("Fire", "Water", "Wind", "Electric", "Light", "Dark").optional(),
  rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary").optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
});

const levelUpSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
  targetLevel: Joi.number().min(1).max(100).optional(),
});

const starUpgradeSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
});

const skillUpgradeSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
  skillSlot: Joi.string().valid("spell1", "spell2", "spell3", "ultimate", "passive").required(),
});

const evolutionSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
});

const autoUpgradeSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
  maxGoldToSpend: Joi.number().min(0).optional(),
  upgradeStars: Joi.boolean().default(false),
});

const bulkLevelUpSchema = Joi.object({
  heroInstanceIds: Joi.array().items(Joi.string()).min(1).max(20).required(),
  maxGoldToSpend: Joi.number().min(0).optional(),
});

const equipHeroSchema = Joi.object({
  heroId: Joi.string().required(),
  equipped: Joi.boolean().required(),
});

// === CATALOG ROUTES ===

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

    const payload = heroes.map(h => {
      const obj = h.toObject();
      const keys = buildGenericKeys(obj);
      return {
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
      };
    });

    res.json({
      message: "Heroes catalog retrieved successfully",
      serverId: req.serverId,
      heroes: payload,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error("Get catalog error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_CATALOG_FAILED" });
  }
});

router.get("/catalog/:heroId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { heroId } = req.params;

    const hero = await Hero.findById(heroId).select("_id heroId name role element rarity baseStats spells");
    if (!hero) {
      res.status(404).json({ error: "Hero not found", code: "HERO_NOT_FOUND" });
      return;
    }

    const obj = hero.toObject();
    const keys = buildGenericKeys(obj);

    const levels = [1, 25, 50, 75, 100];
    const starsList = [1, 3, 6];
    const statsByLevel = levels.map(level => {
      const byStars: Record<string, any> = {};
      starsList.forEach(stars => { byStars[`stars${stars}`] = hero.getStatsAtLevel(level, stars); });
      return { level, ...byStars };
    });

    res.json({
      message: "Hero details retrieved successfully",
      serverId: req.serverId,
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
        statsByLevel,
        rarityMultiplier: hero.getRarityMultiplier(),
      },
    });
  } catch (err) {
    console.error("Get hero details error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_HERO_DETAILS_FAILED" });
  }
});

// === PLAYER HEROES ROUTES ===

router.get("/my", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser les bons identifiants
    const identifiers = getPlayerIdentifiers(req);
    const playerQuery = buildPlayerQuery(identifiers);

    console.log("🔍 Heroes /my - Debug info:");
    console.log("  Identifiers:", identifiers);
    console.log("  Player query:", playerQuery);

    const { error } = heroFilterSchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    // ✅ CORRECTION: Le populate fonctionne, on l'utilise
    const player = await Player.findOne(playerQuery).populate({
      path: "heroes.heroId",
      model: "Hero",
      select: "_id name role element rarity baseStats spells",
    });

    if (!player) {
      console.log("❌ Player not found with query:", playerQuery);
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }

    console.log("✅ Player found, heroes count:", player.heroes.length);

    if (player.heroes.length === 0) {
      res.json({
        message: "Player heroes retrieved successfully",
        serverId: identifiers.serverId,
        heroes: [],
        summary: { total: 0, equipped: 0, maxLevel: 0, maxStars: 0 },
      });
      return;
    }

    const { role, element, rarity } = req.query as any;

    const filtered = player.heroes.filter((ph: any) => {
      const heroData = ph.heroId;
      if (!heroData || typeof heroData === 'string') {
        console.log("⚠️ Hero not populated:", heroData);
        return false;
      }
      if (role && heroData.role !== role) return false;
      if (element && heroData.element !== element) return false;
      if (rarity && heroData.rarity !== rarity) return false;
      return true;
    });

    console.log("Filtered heroes count:", filtered.length);

    const enriched = filtered.map((ph: any) => {
      const heroDoc = ph.heroId; // Document MongoDB peuplé
      
      if (!heroDoc || typeof heroDoc === 'string') {
        console.log("❌ Hero not populated:", ph.heroId);
        return null;
      }
      
      // ✅ CORRECTION: Document Mongoose déjà peuplé, pas besoin de toObject()
      const obj = heroDoc; // Le document peuplé EST l'objet qu'on veut
      const keys = buildGenericKeys(obj);

      const currentStats = heroDoc.getStatsAtLevel(ph.level, ph.stars);
      const basicPower = currentStats.hp + currentStats.atk + currentStats.def;
      const powerLevel = Math.floor(basicPower * (heroDoc.getRarityMultiplier ? heroDoc.getRarityMultiplier() : 1));

      return {
        playerHeroId: ph._id,
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
    }).filter((hero): hero is NonNullable<typeof hero> => hero !== null);

    // Trier par power level
    const sortedEnriched = enriched.sort((a: any, b: any) => b.powerLevel - a.powerLevel);

    res.json({
      message: "Player heroes retrieved successfully",
      serverId: identifiers.serverId,
      heroes: sortedEnriched,
      summary: {
        total: sortedEnriched.length,
      equipped: sortedEnriched.filter(h => h && h.equipped).length,
      maxLevel: sortedEnriched.length > 0 ? Math.max(...sortedEnriched.filter(h => h).map(h => h!.level)) : 0,
      maxStars: sortedEnriched.length > 0 ? Math.max(...sortedEnriched.filter(h => h).map(h => h!.stars)) : 0,
      },
    });
  } catch (err) {
    console.error("Get player heroes error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_PLAYER_HEROES_FAILED" });
  }
});

router.get("/my/overview", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser les bons identifiants
    const identifiers = getPlayerIdentifiers(req);
    
    const result = await HeroUpgradeService.getPlayerHeroesUpgradeOverview(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId
    );
    
    res.json({
      message: "Heroes upgrade overview retrieved successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Get heroes overview error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_OVERVIEW_FAILED" });
  }
});

router.get("/my/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser les bons identifiants
    const identifiers = getPlayerIdentifiers(req);
    
    const result = await HeroUpgradeService.getHeroUpgradeStats(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId
    );
    
    res.json({
      message: "Hero upgrade stats retrieved successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Get hero stats error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_STATS_FAILED" });
  }
});

// === UPGRADE ROUTES ===

router.get("/upgrade/:heroInstanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser les bons identifiants
    const identifiers = getPlayerIdentifiers(req);
    const { heroInstanceId } = req.params;
    
    const result = await HeroUpgradeService.getHeroUpgradeInfo(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId, 
      heroInstanceId
    );
    
    res.json({
      message: "Hero upgrade info retrieved successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Get upgrade info error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_UPGRADE_INFO_FAILED" });
  }
});

router.post("/upgrade/level", authMiddleware, requireFeature("hero_upgrade"), async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser les bons identifiants
    const identifiers = getPlayerIdentifiers(req);

    const { error } = levelUpSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId, targetLevel } = req.body;
    
    const result = await HeroUpgradeService.levelUpHero(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId, 
      heroInstanceId, 
      targetLevel
    );
    
    if (!result.success) {
      res.status(400).json({ error: result.error, code: result.code });
      return;
    }

    res.json({
      message: "Hero level upgraded successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Level up hero error:", err);
    res.status(500).json({ error: "Internal server error", code: "LEVEL_UP_FAILED" });
  }
});

router.post("/upgrade/stars", authMiddleware, requireFeature("hero_upgrade"), async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser les bons identifiants
    const identifiers = getPlayerIdentifiers(req);

    const { error } = starUpgradeSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId } = req.body;
    
    const result = await HeroUpgradeService.upgradeHeroStars(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId, 
      heroInstanceId
    );
    
    if (!result.success) {
      res.status(400).json({ error: result.error, code: result.code });
      return;
    }

    res.json({
      message: "Hero stars upgraded successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Star upgrade hero error:", err);
    res.status(500).json({ error: "Internal server error", code: "STAR_UPGRADE_FAILED" });
  }
});

router.post("/upgrade/skill", authMiddleware, requireFeature("hero_upgrade"), async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser les bons identifiants
    const identifiers = getPlayerIdentifiers(req);

    const { error } = skillUpgradeSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId, skillSlot } = req.body;
    
    const result = await HeroUpgradeService.upgradeHeroSkill(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId, 
      heroInstanceId, 
      skillSlot
    );
    
    if (!result.success) {
      res.status(400).json({ error: result.error, code: "SKILL_UPGRADE_FAILED" });
      return;
    }

    res.json({
      message: "Hero skill upgraded successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Skill upgrade hero error:", err);
    res.status(500).json({ error: "Internal server error", code: "SKILL_UPGRADE_FAILED" });
  }
});

router.post("/upgrade/evolve", authMiddleware, requireFeature("hero_upgrade"), async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser les bons identifiants
    const identifiers = getPlayerIdentifiers(req);

    const { error } = evolutionSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId } = req.body;
    
    const result = await HeroUpgradeService.evolveHero(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId, 
      heroInstanceId
    );
    
    if (!result.success) {
      res.status(400).json({ error: result.error, code: "EVOLUTION_FAILED" });
      return;
    }

    res.json({
      message: "Hero evolved successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Evolution hero error:", err);
    res.status(500).json({ error: "Internal server error", code: "EVOLUTION_FAILED" });
  }
});

router.post("/upgrade/auto", authMiddleware, requireFeature("hero_upgrade"), async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser les bons identifiants
    const identifiers = getPlayerIdentifiers(req);

    const { error } = autoUpgradeSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId, maxGoldToSpend, upgradeStars } = req.body;
    
    const result = await HeroUpgradeService.autoUpgradeHero(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId, 
      heroInstanceId, 
      maxGoldToSpend, 
      upgradeStars
    );
    
    res.json({
      message: "Hero auto-upgraded successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Auto upgrade hero error:", err);
    res.status(500).json({ error: "Internal server error", code: "AUTO_UPGRADE_FAILED" });
  }
});

router.post("/upgrade/bulk-level", authMiddleware, requireFeature("hero_upgrade"), async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser les bons identifiants
    const identifiers = getPlayerIdentifiers(req);

    const { error } = bulkLevelUpSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceIds, maxGoldToSpend } = req.body;
    
    const result = await HeroUpgradeService.bulkLevelUpHeroes(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId, 
      heroInstanceIds, 
      maxGoldToSpend
    );
    
    res.json({
      message: "Heroes bulk level up completed successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Bulk level up error:", err);
    res.status(500).json({ error: "Internal server error", code: "BULK_LEVEL_UP_FAILED" });
  }
});

router.get("/upgrade/recommendations", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser les bons identifiants
    const identifiers = getPlayerIdentifiers(req);
    
    const result = await HeroUpgradeService.getUpgradeRecommendations(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId
    );
    
    res.json({
      message: "Upgrade recommendations retrieved successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Get recommendations error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_RECOMMENDATIONS_FAILED" });
  }
});

// === EQUIP/UNEQUIP ROUTE (Legacy) ===

router.post("/equip", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // ✅ CORRECTION: Utiliser les bons identifiants
    const identifiers = getPlayerIdentifiers(req);
    const playerQuery = buildPlayerQuery(identifiers);

    const { error } = equipHeroSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroId, equipped } = req.body;

    // ✅ CORRECTION: Recherche avec la bonne query
    const player = await Player.findOne(playerQuery);
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
      serverId: identifiers.serverId,
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


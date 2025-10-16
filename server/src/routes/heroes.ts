import express, { Request, Response } from "express";
import Joi from "joi";
import Hero from "../models/Hero";
import Player from "../models/Player";
import authMiddleware, { optionalAuthMiddleware } from "../middleware/authMiddleware";
import serverMiddleware from "../middleware/serverMiddleware";
import { requireFeature } from "../middleware/featureMiddleware";
import { HeroUpgradeService } from "../services/HeroUpgradeService";
import { InventoryService } from "../services/InventoryService";
import { HeroSpellUpgradeService } from "../services/HeroSpellUpgradeService";

import mongoose from "mongoose";

const router = express.Router();

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

function getPlayerIdentifiers(req: Request): { accountId?: string; playerId?: string; serverId: string } {
  if (req.accountId && req.playerId && req.serverId) {
    return {
      accountId: req.accountId,
      playerId: req.playerId,
      serverId: req.serverId
    };
  }
  
  return {
    playerId: req.userId,
    serverId: req.serverId || "S1"
  };
}

function buildPlayerQuery(identifiers: { accountId?: string; playerId?: string; serverId: string }) {
  const query: any = { serverId: identifiers.serverId };
  
  if (identifiers.accountId) {
    query.accountId = identifiers.accountId;
  }
  else if (identifiers.playerId) {
    query.playerId = identifiers.playerId;
  }
  
  return query;
}

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
  skillSlot: Joi.string().valid("active1", "active2", "active3", "ultimate", "passive").required(),
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

const equipItemSchema = Joi.object({
  instanceId: Joi.string().required(),
  slot: Joi.string().valid("weapon", "helmet", "armor", "boots", "gloves", "accessory").required(),
});

const unequipItemSchema = Joi.object({
  slot: Joi.string().valid("weapon", "helmet", "armor", "boots", "gloves", "accessory").required(),
});

const upgradeSpellSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
  spellSlot: Joi.string().valid("active1", "active2", "active3", "ultimate", "passive").required()
});

const autoUpgradeSpellsSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
  maxGoldToSpend: Joi.number().min(0).optional()
});

const ascensionSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
});

const spellUpgradeSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
  spellLevel: Joi.number().valid(1, 11, 41, 81, 121, 151).required(),
});

const autoLevelUpSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
  maxGoldToSpend: Joi.number().min(0).optional(),
  maxHeroXPToSpend: Joi.number().min(0).optional(),
  includeAscensions: Joi.boolean().default(false)
});

// CATALOG ROUTES
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

// PLAYER HEROES ROUTES
router.get("/my", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const playerQuery = buildPlayerQuery(identifiers);

    const { error } = heroFilterSchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const player = await Player.findOne(playerQuery).populate({
      path: "heroes.heroId",
      model: "Hero",
      select: "_id name role element rarity baseStats spells equipment",
    });

    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }

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
      if (!heroData || typeof heroData === 'string') return false;
      if (role && heroData.role !== role) return false;
      if (element && heroData.element !== element) return false;
      if (rarity && heroData.rarity !== rarity) return false;
      return true;
    });

    const enriched = await Promise.all(filtered.map(async (ph: any) => {
      const heroDoc = ph.heroId;
      
      if (!heroDoc || typeof heroDoc === 'string') return null;
      
      const obj = heroDoc;
      const keys = buildGenericKeys(obj);

      let fullStats, currentStats;
      try {
        fullStats = await heroDoc.getTotalStats(ph.level, ph.stars, player._id.toString());
        currentStats = fullStats.totalStats;
      } catch (error) {
        currentStats = heroDoc.getStatsAtLevel(ph.level, ph.stars);
        fullStats = {
          totalStats: currentStats,
          breakdown: { hero: currentStats, equipment: {}, sets: {} },
          equippedItems: [],
          power: 0
        };
      }

      const basicPower = currentStats.hp + currentStats.atk + currentStats.def;
      const powerLevel = fullStats.power || Math.floor(basicPower * (heroDoc.getRarityMultiplier ? heroDoc.getRarityMultiplier() : 1));

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
          equipment: obj.equipment || {},
        },
        level: ph.level,
        stars: ph.stars,
        equipped: ph.equipped,
        currentStats,
        powerLevel,
        equipmentInfo: {
          equippedItems: fullStats.equippedItems || [],
          breakdown: fullStats.breakdown || {},
          hasEquipment: (fullStats.equippedItems || []).length > 0
        }
      };
    }));

    const validEnriched = enriched.filter((hero): hero is NonNullable<typeof hero> => hero !== null);
    const sortedEnriched = validEnriched.sort((a: any, b: any) => b.powerLevel - a.powerLevel);

    res.json({
      message: "Player heroes retrieved successfully",
      serverId: identifiers.serverId,
      heroes: sortedEnriched,
      summary: {
        total: sortedEnriched.length,
        equipped: sortedEnriched.filter(h => h && h.equipped).length,
        maxLevel: sortedEnriched.length > 0 ? Math.max(...sortedEnriched.filter(h => h).map(h => h!.level)) : 0,
        maxStars: sortedEnriched.length > 0 ? Math.max(...sortedEnriched.filter(h => h).map(h => h!.stars)) : 0,
        totalEquippedItems: sortedEnriched.reduce((sum, h) => sum + (h?.equipmentInfo?.equippedItems?.length || 0), 0),
        heroesWithEquipment: sortedEnriched.filter(h => h?.equipmentInfo?.hasEquipment).length
      },
    });
  } catch (err) {
    console.error("Get player heroes error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_PLAYER_HEROES_FAILED" });
  }
});

router.get("/my/:heroInstanceId/details", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const playerQuery = buildPlayerQuery(identifiers);
    const { heroInstanceId } = req.params;

    const player = await Player.findOne(playerQuery).populate({
      path: "heroes.heroId",
      model: "Hero",
      select: "_id name role element rarity baseStats spells equipment",
    });

    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }

    const playerHero = player.heroes.find((h: any) => h._id?.toString() === heroInstanceId);
    if (!playerHero) {
      res.status(404).json({ error: "Hero not found", code: "HERO_NOT_FOUND" });
      return;
    }

    const heroDoc = playerHero.heroId as any;
    if (!heroDoc || typeof heroDoc === 'string') {
      res.status(500).json({ error: "Hero data not populated", code: "HERO_DATA_ERROR" });
      return;
    }

    // ✅ CORRECTION: Récupérer les items équipés depuis l'inventaire
    const Inventory = mongoose.model('Inventory');
    const inventory = await Inventory.findOne({ playerId: player._id.toString() });
    
    const equippedItems: any[] = [];
    
    if (inventory && heroDoc.equipment) {
      const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
      const slotMapping: Record<string, string> = {
        weapons: 'weapon',
        helmets: 'helmet', 
        armors: 'armor',
        boots: 'boots',
        gloves: 'gloves',
        accessories: 'accessory'
      };

      for (const category of equipmentCategories) {
        const items = inventory.storage[category as keyof typeof inventory.storage];
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.isEquipped && item.equippedTo === heroInstanceId) {
              equippedItems.push({
                slot: slotMapping[category] || category,
                instanceId: item.instanceId,
                itemId: item.itemId,
                name: item.itemId, // TODO: Récupérer le vrai nom depuis Item
                level: item.level,
                enhancement: item.enhancement
              });
            }
          }
        }
      }
    }

    const fullStats = await heroDoc.getTotalStats(playerHero.level, playerHero.stars, player._id.toString());
    const obj = heroDoc.toObject();
    const keys = buildGenericKeys(obj);

    res.json({
      message: "Hero details retrieved successfully",
      serverId: identifiers.serverId,
      hero: {
        playerHeroId: (playerHero as any)._id,
        heroData: {
          _id: obj._id,
          heroId: keys.heroId,
          name: keys.name,
          description: keys.description,
          icon: keys.icon,
          sprite: keys.sprite,
          splashArt: keys.splashArt,
          role: obj.role,
          element: obj.element,
          rarity: obj.rarity,
          baseStats: obj.baseStats,
          spells: obj.spells,
          equipment: obj.equipment || {},
        },
        level: playerHero.level,
        stars: playerHero.stars,
        equipped: playerHero.equipped,
        stats: {
          current: fullStats.totalStats,
          breakdown: fullStats.breakdown,
          power: fullStats.power
        },
        equipment: {
          equipped: equippedItems,  // ✅ Les items équipés depuis l'inventaire
          slots: obj.equipment || {},
          setBonuses: fullStats.breakdown?.sets || {}
        }
      }
    });

  } catch (err) {
    console.error("Get hero details error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_HERO_DETAILS_FAILED" });
  }
});

router.get("/my/:heroInstanceId/equipment", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const playerQuery = buildPlayerQuery(identifiers);
    const { heroInstanceId } = req.params;

    const player = await Player.findOne(playerQuery).populate({
      path: "heroes.heroId",
      model: "Hero"
    });

    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }

    const playerHero = player.heroes.find((h: any) => h._id?.toString() === heroInstanceId);
    if (!playerHero) {
      res.status(404).json({ error: "Hero not found", code: "HERO_NOT_FOUND" });
      return;
    }

    const heroDoc = playerHero.heroId as any;
    if (!heroDoc) {
      res.status(500).json({ error: "Hero data not found", code: "HERO_DATA_ERROR" });
      return;
    }

    const equipmentData = await heroDoc.getEquipmentStats(player._id.toString());

    res.json({
      message: "Hero equipment retrieved successfully",
      serverId: identifiers.serverId,
      heroInstanceId,
      heroName: heroDoc.name,
      equipment: {
        slots: heroDoc.equipment || {},
        equippedItems: equipmentData.equippedItems || [],
        stats: equipmentData.stats || {},
        setBonuses: equipmentData.setsBonus || {},
        totalPower: heroDoc.calculatePower ? heroDoc.calculatePower(equipmentData.stats) : 0
      }
    });

  } catch (err) {
    console.error("Get hero equipment error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_HERO_EQUIPMENT_FAILED" });
  }
});

router.post("/my/:heroInstanceId/equip", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const { heroInstanceId } = req.params;

    const { error, value } = equipItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { instanceId, slot } = value;

    const playerQuery = buildPlayerQuery(identifiers);
    const player = await Player.findOne(playerQuery).populate("heroes.heroId");

    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }

    // ✅ VÉRIFIER que le héros appartient au joueur
    const playerHero = player.heroes.find((h: any) => h._id?.toString() === heroInstanceId);
    if (!playerHero) {
      res.status(404).json({ error: "Hero not found", code: "HERO_NOT_FOUND" });
      return;
    }

    // ✅ CORRECTION: Utiliser player._id (le vrai playerId) au lieu de heroInstanceId
    const equipResult = await InventoryService.equipItem(
      player._id.toString(),  // ✅ Le vrai playerId
      instanceId,
      heroInstanceId,         // L'ID du héros dans player.heroes
      identifiers.serverId
    );

    if (!equipResult.success) {
      let statusCode = 400;
      if (equipResult.code === "PLAYER_NOT_FOUND" || equipResult.code === "HERO_NOT_OWNED") statusCode = 404;
      if (equipResult.code === "WRONG_SERVER") statusCode = 403;

      res.status(statusCode).json(equipResult);
      return;
    }

    // Mettre à jour l'équipement sur le document Hero si nécessaire
    const heroDoc = playerHero.heroId as any;
    if (typeof heroDoc === 'object' && heroDoc.equipment) {
      heroDoc.equipment[slot as keyof typeof heroDoc.equipment] = instanceId;
      await heroDoc.save();
    }

    res.json({
      message: "Item equipped successfully",
      serverId: identifiers.serverId,
      heroInstanceId,
      slot,
      ...equipResult
    });

  } catch (err) {
    console.error("Equip item on hero error:", err);
    res.status(500).json({ error: "Internal server error", code: "EQUIP_ITEM_FAILED" });
  }
});

router.post("/my/:heroInstanceId/unequip", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const { heroInstanceId } = req.params;

    const { error, value } = unequipItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { slot } = value;

    const playerQuery = buildPlayerQuery(identifiers);
    const player = await Player.findOne(playerQuery).populate("heroes.heroId");

    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }

    const playerHero = player.heroes.find((h: any) => h._id?.toString() === heroInstanceId);
    if (!playerHero) {
      res.status(404).json({ error: "Hero not found", code: "HERO_NOT_FOUND" });
      return;
    }

    const heroDoc = playerHero.heroId as any;
    if (!heroDoc || !heroDoc.equipment) {
      res.status(500).json({ error: "Hero data not found", code: "HERO_DATA_ERROR" });
      return;
    }

    const instanceId = heroDoc.equipment[slot as keyof typeof heroDoc.equipment];
    if (!instanceId) {
      res.status(400).json({ error: "No item equipped in this slot", code: "SLOT_EMPTY" });
      return;
    }

    const unequipResult = await InventoryService.unequipItem(
      identifiers.accountId || identifiers.playerId!,
      instanceId,
      identifiers.serverId
    );

    if (!unequipResult.success) {
      let statusCode = 400;
      if (unequipResult.code === "INVENTORY_NOT_FOUND") statusCode = 404;
      if (unequipResult.code === "WRONG_SERVER") statusCode = 403;

      res.status(statusCode).json(unequipResult);
      return;
    }

    heroDoc.equipment[slot as keyof typeof heroDoc.equipment] = undefined;
    await heroDoc.save();

    res.json({
      message: "Item unequipped successfully",
      serverId: identifiers.serverId,
      heroInstanceId,
      slot,
      ...unequipResult
    });

  } catch (err) {
    console.error("Unequip item from hero error:", err);
    res.status(500).json({ error: "Internal server error", code: "UNEQUIP_ITEM_FAILED" });
  }
});

router.get("/my/:heroInstanceId/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const playerQuery = buildPlayerQuery(identifiers);
    const { heroInstanceId } = req.params;

    const player = await Player.findOne(playerQuery).populate({
      path: "heroes.heroId",
      model: "Hero"
    });

    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }

    const playerHero = player.heroes.find((h: any) => h._id?.toString() === heroInstanceId);
    if (!playerHero) {
      res.status(404).json({ error: "Hero not found", code: "HERO_NOT_FOUND" });
      return;
    }

    const heroDoc = playerHero.heroId as any;
    if (!heroDoc) {
      res.status(500).json({ error: "Hero data not found", code: "HERO_DATA_ERROR" });
      return;
    }

    const baseStats = heroDoc.getStatsAtLevel(playerHero.level, playerHero.stars);
    const fullStats = await heroDoc.getTotalStats(playerHero.level, playerHero.stars, player._id.toString());

    const equipmentBonus = {
      hp: fullStats.totalStats.hp - baseStats.hp,
      atk: fullStats.totalStats.atk - baseStats.atk,
      def: fullStats.totalStats.def - baseStats.def,
      crit: fullStats.totalStats.crit - baseStats.crit,
      critDamage: fullStats.totalStats.critDamage - baseStats.critDamage,
      vitesse: fullStats.totalStats.vitesse - baseStats.vitesse,
    };

    const basePower = heroDoc.calculatePower ? heroDoc.calculatePower(baseStats) : 0;
    const totalPower = fullStats.power || 0;

    res.json({
      message: "Hero stats comparison retrieved successfully",
      serverId: identifiers.serverId,
      heroInstanceId,
      heroName: heroDoc.name,
      level: playerHero.level,
      stars: playerHero.stars,
      comparison: {
        base: {
          stats: baseStats,
          power: basePower
        },
        withEquipment: {
          stats: fullStats.totalStats,
          power: totalPower
        },
        bonus: {
          stats: equipmentBonus,
          power: totalPower - basePower,
          powerIncrease: basePower > 0 ? Math.round(((totalPower - basePower) / basePower) * 100) : 0
        }
      },
      breakdown: fullStats.breakdown,
      equippedItems: fullStats.equippedItems || []
    });

  } catch (err) {
    console.error("Get hero stats comparison error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_HERO_STATS_FAILED" });
  }
});

router.get("/my/overview", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
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

// UPGRADE ROUTES
router.get("/upgrade/:heroInstanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
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

const newSkillUpgradeSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
  spellLevel: Joi.number().valid(1, 11, 41, 81, 121, 151).required(),
});

router.post("/upgrade/skill", authMiddleware, requireFeature("hero_upgrade"), async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);

    const { error } = newSkillUpgradeSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId, spellLevel } = req.body;
    
    const result = await HeroUpgradeService.upgradeHeroSpell(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId, 
      heroInstanceId, 
      spellLevel
    );
    
    if (!result.success) {
      res.status(400).json({ error: result.error, code: "SKILL_UPGRADE_FAILED" });
      return;
    }

    res.json({
      message: "Hero spell upgraded successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Spell upgrade hero error:", err);
    res.status(500).json({ error: "Internal server error", code: "SKILL_UPGRADE_FAILED" });
  }
});

router.post("/upgrade/ascend", authMiddleware, requireFeature("hero_upgrade"), async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);

    const { error } = ascensionSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId } = req.body;
    
    const result = await HeroUpgradeService.ascendHero(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId, 
      heroInstanceId
    );
    
    if (!result.success) {
      res.status(400).json({ error: result.error, code: result.code });
      return;
    }

    res.json({
      message: "Hero ascended successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Ascension hero error:", err);
    res.status(500).json({ error: "Internal server error", code: "ASCENSION_FAILED" });
  }
});

router.post("/upgrade/auto", authMiddleware, requireFeature("hero_upgrade"), async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);

    const { error } = autoLevelUpSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId, maxGoldToSpend, maxHeroXPToSpend, includeAscensions } = req.body;
    
    const result = await HeroUpgradeService.autoLevelUpHero(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId, 
      heroInstanceId, 
      maxGoldToSpend,
      maxHeroXPToSpend,
      includeAscensions
    );
    
    res.json({
      message: "Hero auto-leveled successfully",
      serverId: identifiers.serverId,
      ...result
    });
  } catch (err) {
    console.error("Auto level up hero error:", err);
    res.status(500).json({ error: "Internal server error", code: "AUTO_UPGRADE_FAILED" });
  }
});

router.get("/upgrade/:heroInstanceId/ascension-info", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const { heroInstanceId } = req.params;
    
    // Utiliser getHeroUpgradeInfo qui contient déjà les infos d'ascension
    const result = await HeroUpgradeService.getHeroUpgradeInfo(
      identifiers.accountId || identifiers.playerId!, 
      identifiers.serverId, 
      heroInstanceId
    );
    
    if (!result.success) {
      res.status(404).json({ error: "Hero not found", code: "HERO_NOT_FOUND" });
      return;
    }
    
    res.json({
      message: "Hero ascension info retrieved successfully",
      serverId: identifiers.serverId,
      heroInstanceId,
      ascensionInfo: result.upgrades.ascension,
      ascensionUI: result.ascensionUI,
      playerResources: result.playerResources
    });
  } catch (err) {
    console.error("Get ascension info error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_ASCENSION_INFO_FAILED" });
  }
});

// NOUVELLE ROUTE: GET /player-resources
router.get("/player-resources", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const playerQuery = buildPlayerQuery(identifiers);
    
    const player = await Player.findOne(playerQuery);
    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }
    
    const progressionResources = (player as any).getProgressionResources();
    
    res.json({
      message: "Player progression resources retrieved successfully",
      serverId: identifiers.serverId,
      resources: progressionResources,
      totalHeroes: player.heroes.length,
      upgradeableHeroes: player.heroes.filter((h: any) => h.level < 100).length
    });
  } catch (err) {
    console.error("Get player resources error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_PLAYER_RESOURCES_FAILED" });
  }
});


// LEGACY EQUIP ROUTE
router.post("/equip", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const playerQuery = buildPlayerQuery(identifiers);

    const { error } = equipHeroSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroId, equipped } = req.body;

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

// EQUIPMENT RECOMMENDATIONS ROUTE
router.get("/my/:heroInstanceId/equipment/recommendations", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const { heroInstanceId } = req.params;

    const playerQuery = buildPlayerQuery(identifiers);
    const player = await Player.findOne(playerQuery).populate("heroes.heroId");

    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }

    const playerHero = player.heroes.find((h: any) => h._id?.toString() === heroInstanceId);
    if (!playerHero) {
      res.status(404).json({ error: "Hero not found", code: "HERO_NOT_FOUND" });
      return;
    }

    const heroDoc = playerHero.heroId as any;
    if (!heroDoc) {
      res.status(500).json({ error: "Hero data not found", code: "HERO_DATA_ERROR" });
      return;
    }

    const inventoryResult = await InventoryService.getPlayerInventory(
      identifiers.accountId || identifiers.playerId!,
      identifiers.serverId
    );

    if (!inventoryResult.success) {
      res.status(404).json({ error: "Inventory not found", code: "INVENTORY_NOT_FOUND" });
      return;
    }

    const storage = inventoryResult.inventory.storage;
    const currentEquipment = heroDoc.equipment || {};

    const recommendations: any = {};
    const slots = [
      { slot: 'weapon', category: 'weapons' },
      { slot: 'helmet', category: 'helmets' },
      { slot: 'armor', category: 'armors' },
      { slot: 'boots', category: 'boots' },
      { slot: 'gloves', category: 'gloves' },
      { slot: 'accessory', category: 'accessories' }
    ];

    for (const { slot, category } of slots) {
      const currentItemId = currentEquipment[slot];
      const availableItems = (storage as any)[category] || [];
      
      const candidates = availableItems.filter((item: any) => 
        !item.isEquipped || item.equippedTo === heroInstanceId
      );

      candidates.sort((a: any, b: any) => {
        if (a.level !== b.level) return b.level - a.level;
        if (a.enhancement !== b.enhancement) return b.enhancement - a.enhancement;
        return b.instanceId.localeCompare(a.instanceId);
      });

      const currentItem = candidates.find((item: any) => item.instanceId === currentItemId);
      const bestAlternatives = candidates.filter((item: any) => item.instanceId !== currentItemId).slice(0, 3);

      recommendations[slot] = {
        current: currentItem || null,
        alternatives: bestAlternatives,
        hasUpgrade: bestAlternatives.length > 0 && (!currentItem || 
          bestAlternatives[0].level > currentItem.level ||
          bestAlternatives[0].enhancement > currentItem.enhancement)
      };
    }

    let totalUpgradePotential = 0;
    let slotsWithUpgrades = 0;

    Object.values(recommendations).forEach((rec: any) => {
      if (rec.hasUpgrade) {
        slotsWithUpgrades++;
        totalUpgradePotential += rec.alternatives[0]?.level || 0;
      }
    });

    res.json({
      message: "Equipment recommendations retrieved successfully",
      serverId: identifiers.serverId,
      heroInstanceId,
      heroName: heroDoc.name,
      heroRole: heroDoc.role,
      recommendations,
      summary: {
        slotsWithUpgrades,
        totalSlots: slots.length,
        upgradePotential: Math.round(totalUpgradePotential / Math.max(1, slotsWithUpgrades)),
        recommendationScore: slotsWithUpgrades > 0 ? Math.round((slotsWithUpgrades / slots.length) * 100) : 0
      }
    });

  } catch (err) {
    console.error("Get equipment recommendations error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_EQUIPMENT_RECOMMENDATIONS_FAILED" });
  }
});

// EQUIPMENT OPTIMIZATION ROUTE
router.post("/my/:heroInstanceId/equipment/optimize", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const { heroInstanceId } = req.params;

    const optimizeForSchema = Joi.object({
      priority: Joi.string().valid("power", "attack", "defense", "health", "speed").default("power"),
      autoEquip: Joi.boolean().default(false)
    });

    const { error, value } = optimizeForSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { priority, autoEquip } = value;

    const playerQuery = buildPlayerQuery(identifiers);
    const player = await Player.findOne(playerQuery).populate("heroes.heroId");

    if (!player) {
      res.status(404).json({ error: "Player not found", code: "PLAYER_NOT_FOUND" });
      return;
    }

    const playerHero = player.heroes.find((h: any) => h._id?.toString() === heroInstanceId);
    if (!playerHero || !playerHero.heroId) {
      res.status(404).json({ error: "Hero not found", code: "HERO_NOT_FOUND" });
      return;
    }

    const heroDoc = playerHero.heroId as any;
    const currentStats = await heroDoc.getTotalStats(playerHero.level, playerHero.stars, player._id.toString());

    const optimizationResults = {
      currentStats: currentStats.totalStats,
      currentPower: currentStats.power,
      optimizations: [] as any[],
      potentialStats: currentStats.totalStats,
      potentialPower: currentStats.power,
      improvements: {
        power: 0,
        attack: 0,
        defense: 0,
        health: 0,
        speed: 0
      }
    };

    if (autoEquip) {
      optimizationResults.optimizations.push({
        action: "Auto-equip feature coming soon",
        description: "Automatic equipment optimization will be implemented in a future update"
      });
    } else {
      optimizationResults.optimizations.push({
        action: "Analysis completed",
        description: `Optimization priority: ${priority}. Use autoEquip: true to apply changes automatically.`
      });
    }

    res.json({
      message: "Equipment optimization completed",
      serverId: identifiers.serverId,
      heroInstanceId,
      priority,
      autoEquipApplied: autoEquip,
      ...optimizationResults
    });

  } catch (err) {
    console.error("Equipment optimization error:", err);
    res.status(500).json({ error: "Internal server error", code: "EQUIPMENT_OPTIMIZATION_FAILED" });
  }
});

// ============================================
// SPELL UPGRADE ROUTES
// ============================================

/**
 * GET /api/heroes/spells/:heroInstanceId
 * Obtenir les informations d'upgrade des sorts d'un héros
 */
router.get("/spells/:heroInstanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const { heroInstanceId } = req.params;

    const result = await HeroSpellUpgradeService.getHeroSpellUpgradeInfo(
      identifiers.accountId || identifiers.playerId!,
      identifiers.serverId,
      heroInstanceId
    );

    res.json({
      message: "Hero spell upgrade info retrieved successfully",
      serverId: identifiers.serverId,
      ...result
    });

  } catch (err) {
    console.error("Get spell upgrade info error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_SPELL_INFO_FAILED" });
  }
});

/**
 * POST /api/heroes/spells/upgrade
 * Upgrader un sort spécifique
 */
router.post("/spells/upgrade", authMiddleware, requireFeature("hero_upgrade"), async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);

    const { error } = upgradeSpellSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId, spellSlot } = req.body;

    const result = await HeroSpellUpgradeService.upgradeSpell(
      identifiers.accountId || identifiers.playerId!,
      identifiers.serverId,
      heroInstanceId,
      spellSlot
    );

    if (!result.success) {
      res.status(400).json({ error: result.error, code: result.code });
      return;
    }

    res.json({
      message: "Spell upgraded successfully",
      serverId: identifiers.serverId,
      ...result
    });

  } catch (err) {
    console.error("Upgrade spell error:", err);
    res.status(500).json({ error: "Internal server error", code: "UPGRADE_SPELL_FAILED" });
  }
});

/**
 * POST /api/heroes/spells/auto-upgrade
 * Auto-upgrader tous les sorts d'un héros
 */
router.post("/spells/auto-upgrade", authMiddleware, requireFeature("hero_upgrade"), async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);

    const { error } = autoUpgradeSpellsSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId, maxGoldToSpend } = req.body;

    const result = await HeroSpellUpgradeService.autoUpgradeAllSpells(
      identifiers.accountId || identifiers.playerId!,
      identifiers.serverId,
      heroInstanceId,
      maxGoldToSpend
    );

    res.json({
      message: "Spells auto-upgraded successfully",
      serverId: identifiers.serverId,
      ...result
    });

  } catch (err) {
    console.error("Auto-upgrade spells error:", err);
    res.status(500).json({ error: "Internal server error", code: "AUTO_UPGRADE_SPELLS_FAILED" });
  }
});

/**
 * GET /api/heroes/spells/summary
 * Obtenir un résumé des upgrades possibles pour tous les héros
 */
router.get("/spells/summary", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);

    const result = await HeroSpellUpgradeService.getAllHeroesSpellUpgradeSummary(
      identifiers.accountId || identifiers.playerId!,
      identifiers.serverId
    );

    res.json({
      message: "Heroes spell upgrade summary retrieved successfully",
      serverId: identifiers.serverId,
      ...result
    });

  } catch (err) {
    console.error("Get spell upgrade summary error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_SPELL_SUMMARY_FAILED" });
  }
});

/**
 * GET /api/heroes/catalog/:heroId/spell/:spellSlot
 * Obtenir les détails d'un sort d'un héros du catalogue (sans auth)
 */
router.get("/catalog/:heroId/spell/:spellSlot", async (req: Request, res: Response): Promise<void> => {
  try {
    const { heroId, spellSlot } = req.params;

    // Validation du slot
    const validSlots = ['active1', 'active2', 'active3', 'ultimate', 'passive'];
    if (!validSlots.includes(spellSlot)) {
      res.status(400).json({ 
        error: "Invalid spell slot", 
        code: "INVALID_SPELL_SLOT",
        validSlots 
      });
      return;
    }

    // Trouver le héros dans le catalogue
    const hero = await Hero.findById(heroId);
    if (!hero) {
      res.status(404).json({ error: "Hero not found", code: "HERO_NOT_FOUND" });
      return;
    }

    // Récupérer les données du sort (niveau 1 par défaut pour le catalogue)
    const spellLevel = 1;
    const spellData = (hero as any).spells?.[spellSlot];
    
    if (!spellData) {
      res.status(404).json({ 
        error: "Spell not found for this hero", 
        code: "SPELL_NOT_FOUND" 
      });
      return;
    }

    // Calculer les stats du sort au niveau 1
    const currentStats = (hero as any).calculateSpellStats ? 
      (hero as any).calculateSpellStats(spellSlot, spellLevel) : 
      {
        damage: 0,
        healing: 0,
        cooldown: 3,
        duration: 0,
        effect: "",
        additionalEffects: {}
      };

    const nextLevelStats = (hero as any).calculateSpellStats ? 
      (hero as any).calculateSpellStats(spellSlot, spellLevel + 1) : null;

    res.json({
      message: "Catalog spell details retrieved successfully",
      serverId: req.serverId,
      success: true,
      spell: {
        spellId: spellData.id || spellSlot,
        name: spellData.id || spellSlot,
        description: spellData.id || spellSlot,
        currentLevel: spellLevel,
        maxLevel: 10,
        currentStats: currentStats,
        nextLevelStats: nextLevelStats,
        upgradeCost: null, // Pas de coût pour le catalogue
        canUpgrade: false, // Pas d'upgrade possible dans le catalogue
        type: spellSlot
      }
    });

  } catch (err) {
    console.error("Get catalog spell error:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      code: "GET_CATALOG_SPELL_FAILED" 
    });
  }
});


/**
 * GET /api/heroes/spells/:heroInstanceId/:spellSlot
 * Obtenir les détails complets d'un sort spécifique
 */
router.get("/spells/:heroInstanceId/:spellSlot", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const { heroInstanceId, spellSlot } = req.params;

    // Validation du slot
    const validSlots = ['active1', 'active2', 'active3', 'ultimate', 'passive'];
    if (!validSlots.includes(spellSlot)) {
      res.status(400).json({ 
        error: "Invalid spell slot", 
        code: "INVALID_SPELL_SLOT",
        validSlots 
      });
      return;
    }

    const result = await HeroSpellUpgradeService.getSpellDetails(
      identifiers.accountId || identifiers.playerId!,
      identifiers.serverId,
      heroInstanceId,
      spellSlot as any
    );

    if (!result.success) {
      res.status(404).json({ 
        error: result.error, 
        code: result.code 
      });
      return;
    }

    res.json({
      message: "Spell details retrieved successfully",
      serverId: identifiers.serverId,
      ...result
    });

  } catch (err) {
    console.error("Get spell details error:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      code: "GET_SPELL_DETAILS_FAILED" 
    });
  }
});
/**
 * GET /api/heroes/spells/:heroInstanceId
 * Test: Obtenir les informations de spell upgrade d'un héros
 */
router.get("/spells/:heroInstanceId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);
    const { heroInstanceId } = req.params;

    const result = await HeroSpellUpgradeService.getHeroSpellUpgradeInfo(
      identifiers.accountId || identifiers.playerId!,
      identifiers.serverId,
      heroInstanceId
    );

    res.json({
      message: "Hero spell upgrade info retrieved successfully",
      serverId: identifiers.serverId,
      ...result
    });

  } catch (err) {
    console.error("Get spell upgrade info error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_SPELL_INFO_FAILED" });
  }
});

const spellUpgradeNewSchema = Joi.object({
  heroInstanceId: Joi.string().required(),
  spellSlot: Joi.string().valid("active1", "active2", "active3", "ultimate", "passive").required(),
});

/**
 * POST /api/heroes/spells/upgrade
 * Test: Upgrader un sort spécifique avec HeroSpellUpgradeService
 */
router.post("/spells/upgrade", authMiddleware, requireFeature("hero_upgrade"), async (req: Request, res: Response): Promise<void> => {
  try {
    const identifiers = getPlayerIdentifiers(req);

    const { error } = spellUpgradeNewSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const { heroInstanceId, spellSlot } = req.body;

    const result = await HeroSpellUpgradeService.upgradeSpell(
      identifiers.accountId || identifiers.playerId!,
      identifiers.serverId,
      heroInstanceId,
      spellSlot as any
    );

    if (!result.success) {
      res.status(400).json({ error: result.error, code: result.code });
      return;
    }

    res.json({
      message: "Spell upgraded successfully via HeroSpellUpgradeService",
      serverId: identifiers.serverId,
      ...result
    });

  } catch (err) {
    console.error("Upgrade spell via HeroSpellUpgradeService error:", err);
    res.status(500).json({ error: "Internal server error", code: "UPGRADE_SPELL_FAILED" });
  }
});
export default router;







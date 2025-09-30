// server/src/routes/battle-setup.ts
import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import serverMiddleware from "../middleware/serverMiddleware";
import { BattleSetupService } from "../services/BattleSetupService";
import { IFormationSlot } from "../models/Formation";

const router = express.Router();

// Appliquer les middlewares
router.use(authMiddleware);
router.use(serverMiddleware);

// ===== SCHEMAS DE VALIDATION =====

const previewCampaignSchema = Joi.object({
  worldId: Joi.number().integer().min(1).max(100).required(),
  levelId: Joi.number().integer().min(1).max(50).required(),
  difficulty: Joi.string().valid("Normal", "Hard", "Nightmare").default("Normal")
});

const validateFormationSchema = Joi.object({
  worldId: Joi.number().integer().min(1).max(100).optional(),
  levelId: Joi.number().integer().min(1).max(50).optional(),
  difficulty: Joi.string().valid("Normal", "Hard", "Nightmare").default("Normal"),
  slots: Joi.array().items(
    Joi.object({
      slot: Joi.number().integer().min(1).max(5).required(),
      heroId: Joi.string().required()
    })
  ).min(1).max(5).required()
});

const confirmBattleSchema = Joi.object({
  worldId: Joi.number().integer().min(1).max(100).required(),
  levelId: Joi.number().integer().min(1).max(50).required(),
  difficulty: Joi.string().valid("Normal", "Hard", "Nightmare").default("Normal"),
  slots: Joi.array().items(
    Joi.object({
      slot: Joi.number().integer().min(1).max(5).required(),
      heroId: Joi.string().required()
    })
  ).min(1).max(5).required(),
  saveFormation: Joi.boolean().default(false),
  formationName: Joi.string().trim().min(1).max(30).optional(),
  battleOptions: Joi.object({
    mode: Joi.string().valid("auto", "manual").default("auto"),
    speed: Joi.number().valid(1, 2, 3).default(1)
  }).default({ mode: "auto", speed: 1 })
});

const previewArenaSchema = Joi.object({
  opponentId: Joi.string().required()
});

// ===== ROUTES =====

/**
 * GET /api/battle-setup/campaign/preview
 * Prévisualiser un niveau de campagne avant placement
 * Query: worldId, levelId, difficulty
 */
router.get("/campaign/preview", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = previewCampaignSchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { worldId, levelId, difficulty } = req.query;

    console.log(`🔍 Preview niveau: Monde ${worldId}, Niveau ${levelId}, ${difficulty} pour ${req.userId}`);

    const preview = await BattleSetupService.previewCampaignLevel(
      req.userId!,
      req.serverId!,
      parseInt(worldId as string),
      parseInt(levelId as string),
      difficulty as "Normal" | "Hard" | "Nightmare"
    );

    res.json({
      message: "Battle preview retrieved successfully",
      preview
    });

  } catch (err: any) {
    console.error("❌ Erreur preview campagne:", err);
    
    if (err.message === "Player not found") {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    res.status(500).json({ 
      error: "Internal server error",
      code: "PREVIEW_FAILED"
    });
  }
});

/**
 * POST /api/battle-setup/validate
 * Valider une formation temporaire sans la sauvegarder
 * Body: { slots, worldId?, levelId?, difficulty? }
 */
router.post("/validate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = validateFormationSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { slots, worldId, levelId, difficulty } = req.body;

    console.log(`✅ Validation formation temporaire pour ${req.userId} (${slots.length} héros)`);

    const validation = await BattleSetupService.validateTemporaryFormation(
      req.userId!,
      req.serverId!,
      slots as IFormationSlot[],
      worldId ? parseInt(worldId) : undefined,
      levelId ? parseInt(levelId) : undefined,
      difficulty as "Normal" | "Hard" | "Nightmare" | undefined
    );

    res.json({
      message: "Formation validation completed",
      validation
    });

  } catch (err: any) {
    console.error("❌ Erreur validation formation:", err);
    
    if (err.message === "Player not found") {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    res.status(500).json({ 
      error: "Internal server error",
      code: "VALIDATION_FAILED"
    });
  }
});

/**
 * POST /api/battle-setup/confirm
 * Confirmer et lancer le combat avec une formation
 * Body: { worldId, levelId, difficulty, slots, saveFormation?, formationName?, battleOptions }
 */
router.post("/confirm", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = confirmBattleSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { worldId, levelId, difficulty, slots, saveFormation, formationName, battleOptions } = req.body;

    console.log(`🎯 Confirmation combat: Monde ${worldId}, Niveau ${levelId} pour ${req.userId}`);

    // 1. Valider la formation d'abord
    const validation = await BattleSetupService.validateTemporaryFormation(
      req.userId!,
      req.serverId!,
      slots as IFormationSlot[],
      worldId,
      levelId,
      difficulty
    );

    if (!validation.valid) {
      res.status(400).json({
        error: "Formation is invalid",
        code: "INVALID_FORMATION",
        validation
      });
      return;
    }

    // 2. Si demandé, sauvegarder la formation
    if (saveFormation) {
      const FormationService = require("../services/FormationService").FormationService;
      
      const finalName = formationName || `Battle Formation ${Date.now()}`;
      
      await FormationService.createFormation(
        req.userId!,
        req.serverId!,
        {
          name: finalName,
          slots: slots as IFormationSlot[],
          setAsActive: true
        }
      );
      
      console.log(`💾 Formation "${finalName}" sauvegardée`);
    }

    // 3. Lancer le combat via BattleService
    const BattleService = require("../services/BattleService").BattleService;
    
    const battleResult = await BattleService.startCampaignBattle(
      req.userId!,
      req.serverId!,
      worldId,
      levelId,
      difficulty,
      battleOptions
    );

    res.json({
      message: "Battle started successfully",
      battleId: battleResult.battleId,
      victory: battleResult.result.victory,
      result: battleResult.result,
      replay: battleResult.replay,
      formationSaved: saveFormation
    });

  } catch (err: any) {
    console.error("❌ Erreur confirmation combat:", err);
    
    if (err.message === "Player not found") {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    if (err.message === "No equipped heroes found") {
      res.status(400).json({ 
        error: "Formation must have at least one hero",
        code: "NO_HEROES"
      });
      return;
    }

    if (err.message.includes("Vitesse") || err.message.includes("VIP")) {
      res.status(403).json({ 
        error: "Speed not allowed for your VIP level",
        code: "SPEED_NOT_ALLOWED"
      });
      return;
    }

    res.status(500).json({ 
      error: "Internal server error",
      code: "CONFIRM_FAILED"
    });
  }
});

/**
 * GET /api/battle-setup/arena/preview
 * Prévisualiser un combat d'arène
 * Query: opponentId
 */
router.get("/arena/preview", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = previewArenaSchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { opponentId } = req.query;

    if (req.userId === opponentId) {
      res.status(400).json({ 
        error: "Cannot battle against yourself",
        code: "SELF_BATTLE_NOT_ALLOWED"
      });
      return;
    }

    console.log(`⚔️ Preview arène: ${req.userId} vs ${opponentId}`);

    const preview = await BattleSetupService.previewArenaBattle(
      req.userId!,
      req.serverId!,
      opponentId as string
    );

    res.json({
      message: "Arena preview retrieved successfully",
      preview
    });

  } catch (err: any) {
    console.error("❌ Erreur preview arène:", err);
    
    if (err.message.includes("not found")) {
      res.status(404).json({ 
        error: "Player or opponent not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    res.status(500).json({ 
      error: "Internal server error",
      code: "ARENA_PREVIEW_FAILED"
    });
  }
});

/**
 * GET /api/battle-setup/quick
 * Setup rapide pour le niveau actuel du joueur
 */
router.get("/quick", async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`⚡ Quick setup pour ${req.userId}`);

    const preview = await BattleSetupService.quickSetup(
      req.userId!,
      req.serverId!
    );

    res.json({
      message: "Quick setup retrieved successfully",
      preview
    });

  } catch (err: any) {
    console.error("❌ Erreur quick setup:", err);
    
    if (err.message === "Player not found") {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    res.status(500).json({ 
      error: "Internal server error",
      code: "QUICK_SETUP_FAILED"
    });
  }
});

/**
 * GET /api/battle-setup/info
 * Informations générales sur le système de setup
 */
router.get("/info", async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      message: "Battle setup system information",
      endpoints: {
        preview: "GET /api/battle-setup/campaign/preview?worldId=1&levelId=1&difficulty=Normal",
        validate: "POST /api/battle-setup/validate (body: { slots, worldId?, levelId?, difficulty? })",
        confirm: "POST /api/battle-setup/confirm (body: { worldId, levelId, difficulty, slots, saveFormation?, formationName?, battleOptions })",
        arenaPreview: "GET /api/battle-setup/arena/preview?opponentId=PLAYER_123",
        quick: "GET /api/battle-setup/quick"
      },
      workflow: {
        step1: "Preview: Get level info and current formation",
        step2: "Validate: Test a temporary formation (optional)",
        step3: "Confirm: Start the battle with final formation"
      },
      features: {
        formations: "Temporary formations for testing without saving",
        estimation: "Victory chance estimation based on power",
        validation: "Real-time formation validation",
        recommendations: "Strategic recommendations for battle",
        saveOption: "Option to save formation for future use"
      }
    });

  } catch (err) {
    console.error("❌ Erreur info:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "INFO_FAILED"
    });
  }
});

export default router;

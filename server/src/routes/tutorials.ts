// src/routes/tutorials.ts
import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import { TutorialService } from "../services/TutorialService";

const router = express.Router();

// Schémas de validation
const startTutorialSchema = Joi.object({
  tutorialId: Joi.string().required()
});

const nextStepSchema = Joi.object({
  tutorialId: Joi.string().required()
});

const skipTutorialSchema = Joi.object({
  tutorialId: Joi.string().required()
});

// === ROUTES POUR UNITY ===

/**
 * GET /api/tutorials/current
 * Récupérer le tutoriel actuellement en cours
 */
router.get("/current", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentTutorial = await TutorialService.getCurrentTutorial(
      req.userId!,
      req.serverId!
    );

    if (!currentTutorial) {
      res.json({
        message: "No tutorial in progress",
        hasTutorial: false
      });
      return;
    }

    res.json({
      message: "Current tutorial retrieved successfully",
      hasTutorial: true,
      tutorial: {
        tutorialId: currentTutorial.tutorial.tutorialId,
        featureId: currentTutorial.tutorial.featureId,
        titleKey: currentTutorial.tutorial.titleKey,
        descriptionKey: currentTutorial.tutorial.descriptionKey,
        isRequired: currentTutorial.tutorial.isRequired,
        currentStep: currentTutorial.currentStep,
        progress: {
          currentStepIndex: currentTutorial.progress.currentStep,
          totalSteps: currentTutorial.tutorial.steps.length,
          percentage: Math.round((currentTutorial.progress.currentStep / currentTutorial.tutorial.steps.length) * 100)
        }
      }
    });

  } catch (err) {
    console.error("Get current tutorial error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_CURRENT_TUTORIAL_FAILED"
    });
  }
});

/**
 * POST /api/tutorials/start
 * Démarrer un tutoriel manuellement
 */
router.post("/start", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = startTutorialSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { tutorialId } = req.body;

    const success = await TutorialService.startTutorial(
      req.userId!,
      req.serverId!,
      tutorialId
    );

    if (!success) {
      res.status(400).json({
        error: "Failed to start tutorial",
        code: "START_TUTORIAL_FAILED"
      });
      return;
    }

    res.json({
      message: "Tutorial started successfully",
      tutorialId
    });

  } catch (err) {
    console.error("Start tutorial error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "START_TUTORIAL_FAILED"
    });
  }
});

/**
 * POST /api/tutorials/next-step
 * Passer à l'étape suivante
 */
router.post("/next-step", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = nextStepSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { tutorialId } = req.body;

    const result = await TutorialService.nextTutorialStep(
      req.userId!,
      req.serverId!,
      tutorialId
    );

    res.json({
      message: result.completed ? "Tutorial completed successfully" : "Advanced to next step",
      tutorialId,
      completed: result.completed,
      nextStep: result.nextStep || null
    });

  } catch (err) {
    console.error("Next tutorial step error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "NEXT_STEP_FAILED"
    });
  }
});

/**
 * POST /api/tutorials/skip
 * Ignorer un tutoriel
 */
router.post("/skip", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = skipTutorialSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { tutorialId } = req.body;

    const success = await TutorialService.skipTutorial(
      req.userId!,
      req.serverId!,
      tutorialId
    );

    if (!success) {
      res.status(400).json({
        error: "Failed to skip tutorial",
        code: "SKIP_TUTORIAL_FAILED"
      });
      return;
    }

    res.json({
      message: "Tutorial skipped successfully",
      tutorialId
    });

  } catch (err) {
    console.error("Skip tutorial error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "SKIP_TUTORIAL_FAILED"
    });
  }
});

/**
 * GET /api/tutorials/status/:tutorialId
 * Obtenir le statut d'un tutoriel spécifique
 */
router.get("/status/:tutorialId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { tutorialId } = req.params;

    const status = await TutorialService.getTutorialStatus(
      req.userId!,
      req.serverId!,
      tutorialId
    );

    res.json({
      message: "Tutorial status retrieved successfully",
      tutorialId,
      status: status || {
        tutorialId,
        status: "not_started",
        currentStep: 0
      }
    });

  } catch (err) {
    console.error("Get tutorial status error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_TUTORIAL_STATUS_FAILED"
    });
  }
});

/**
 * GET /api/tutorials/stats
 * Obtenir les statistiques des tutoriels du joueur
 */
router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await TutorialService.getPlayerTutorialStats(
      req.userId!,
      req.serverId!
    );

    res.json({
      message: "Tutorial stats retrieved successfully",
      stats
    });

  } catch (err) {
    console.error("Get tutorial stats error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_TUTORIAL_STATS_FAILED"
    });
  }
});

/**
 * GET /api/tutorials/available
 * Obtenir la liste de tous les tutoriels disponibles
 */
router.get("/available", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const tutorials = TutorialService.getAllTutorials();

    res.json({
      message: "Available tutorials retrieved successfully",
      tutorials: tutorials.map(t => ({
        tutorialId: t.tutorialId,
        featureId: t.featureId,
        titleKey: t.titleKey,
        descriptionKey: t.descriptionKey,
        isRequired: t.isRequired,
        stepCount: t.steps.length
      })),
      count: tutorials.length
    });

  } catch (err) {
    console.error("Get available tutorials error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_AVAILABLE_TUTORIALS_FAILED"
    });
  }
});

export default router;

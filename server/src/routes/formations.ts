// server/src/routes/formations.ts
import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import serverMiddleware from "../middleware/serverMiddleware";
import { FormationService } from "../services/FormationService";
import { FormationValidator } from "../services/FormationValidator";
import { IFormationSlot } from "../models/Formation";

const router = express.Router();

// Appliquer les middlewares
router.use(authMiddleware);
router.use(serverMiddleware);

// ===== SCHEMAS DE VALIDATION =====

const formationSlotSchema = Joi.object({
  slot: Joi.number().integer().min(1).max(5).required(),
  heroId: Joi.string().required()
});

const createFormationSchema = Joi.object({
  name: Joi.string().trim().min(1).max(30).required(),
  slots: Joi.array().items(formationSlotSchema).max(5).default([]),
  setAsActive: Joi.boolean().default(false)
});

const updateFormationSchema = Joi.object({
  name: Joi.string().trim().min(1).max(30).optional(),
  slots: Joi.array().items(formationSlotSchema).max(5).optional()
}).min(1);

const validateFormationSchema = Joi.object({
  slots: Joi.array().items(formationSlotSchema).max(5).required()
});

const duplicateFormationSchema = Joi.object({
  newName: Joi.string().trim().min(1).max(30).optional()
});

// ===== ROUTES =====

/**
 * POST /api/formations/create
 * Créer une nouvelle formation
 */
router.post("/create", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = createFormationSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message, 
        code: "VALIDATION_ERROR" 
      });
      return;
    }

    const { name, slots, setAsActive } = value;

    console.log(`🎯 Création formation "${name}" pour ${req.userId}`);

    const result = await FormationService.createFormation(
      req.userId!,
      req.serverId!,
      { name, slots, setAsActive }
    );

    if (!result.success) {
      const statusCode = result.code === "PLAYER_NOT_FOUND" ? 404 :
                        result.code === "MAX_FORMATIONS_REACHED" ? 403 : 400;
      
      res.status(statusCode).json({
        error: result.error,
        code: result.code,
        validation: result.validation
      });
      return;
    }

    res.status(201).json({
      message: "Formation created successfully",
      formation: result.formation,
      stats: result.stats,
      validation: result.validation
    });

  } catch (err: any) {
    console.error("Create formation error:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      code: "CREATE_FORMATION_FAILED" 
    });
  }
});

/**
 * GET /api/formations/list
 * Récupérer toutes les formations du joueur
 */
router.get("/list", async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`📋 Récupération formations pour ${req.userId}`);

    const result = await FormationService.getPlayerFormations(
      req.userId!,
      req.serverId!
    );

    if (!result.success) {
      res.status(404).json({
        error: result.error,
        code: result.code
      });
      return;
    }

    res.json({
      message: "Formations retrieved successfully",
      formations: result.formation,
      count: Array.isArray(result.formation) ? result.formation.length : 0
    });

  } catch (err: any) {
    console.error("Get formations error:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      code: "GET_FORMATIONS_FAILED" 
    });
  }
});

/**
 * GET /api/formations/active
 * Récupérer la formation active
 */
router.get("/active", async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`🎯 Récupération formation active pour ${req.userId}`);

    const result = await FormationService.getActiveFormation(
      req.userId!,
      req.serverId!
    );

    if (!result.success) {
      const statusCode = result.code === "NO_ACTIVE_FORMATION" ? 404 : 500;
      res.status(statusCode).json({
        error: result.error,
        code: result.code
      });
      return;
    }

    res.json({
      message: "Active formation retrieved successfully",
      formation: result.formation,
      stats: result.stats
    });

  } catch (err: any) {
    console.error("Get active formation error:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      code: "GET_ACTIVE_FORMATION_FAILED" 
    });
  }
});

/**
 * GET /api/formations/:formationId
 * Récupérer une formation spécifique
 */
router.get("/:formationId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { formationId } = req.params;

    console.log(`🔍 Récupération formation ${formationId} pour ${req.userId}`);

    const result = await FormationService.getFormation(
      formationId,
      req.userId!,
      req.serverId!
    );

    if (!result.success) {
      const statusCode = result.code === "FORMATION_NOT_FOUND" ? 404 : 500;
      res.status(statusCode).json({
        error: result.error,
        code: result.code
      });
      return;
    }

    res.json({
      message: "Formation retrieved successfully",
      formation: result.formation,
      stats: result.stats
    });

  } catch (err: any) {
    console.error("Get formation error:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      code: "GET_FORMATION_FAILED" 
    });
  }
});

/**
 * PUT /api/formations/:formationId
 * Mettre à jour une formation
 */
router.put("/:formationId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { formationId } = req.params;
    const { error, value } = updateFormationSchema.validate(req.body);
    
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message, 
        code: "VALIDATION_ERROR" 
      });
      return;
    }

    console.log(`✏️ Mise à jour formation ${formationId} pour ${req.userId}`);

    const result = await FormationService.updateFormation(
      formationId,
      req.userId!,
      req.serverId!,
      value
    );

    if (!result.success) {
      const statusCode = result.code === "FORMATION_NOT_FOUND" ? 404 : 400;
      res.status(statusCode).json({
        error: result.error,
        code: result.code,
        validation: result.validation
      });
      return;
    }

    res.json({
      message: "Formation updated successfully",
      formation: result.formation,
      stats: result.stats
    });

  } catch (err: any) {
    console.error("Update formation error:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      code: "UPDATE_FORMATION_FAILED" 
    });
  }
});

/**
 * DELETE /api/formations/:formationId
 * Supprimer une formation
 */
router.delete("/:formationId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { formationId } = req.params;

    console.log(`🗑️ Suppression formation ${formationId} pour ${req.userId}`);

    const result = await FormationService.deleteFormation(
      formationId,
      req.userId!,
      req.serverId!
    );

    if (!result.success) {
      const statusCode = result.code === "FORMATION_NOT_FOUND" ? 404 :
                        result.code === "CANNOT_DELETE_ACTIVE" ? 403 : 400;
      
      res.status(statusCode).json({
        error: result.error,
        code: result.code
      });
      return;
    }

    res.json({
      message: "Formation deleted successfully",
      formation: result.formation
    });

  } catch (err: any) {
    console.error("Delete formation error:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      code: "DELETE_FORMATION_FAILED" 
    });
  }
});

/**
 * POST /api/formations/:formationId/activate
 * Activer une formation
 */
router.post("/:formationId/activate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { formationId } = req.params;

    console.log(`⚡ Activation formation ${formationId} pour ${req.userId}`);

    const result = await FormationService.activateFormation(
      formationId,
      req.userId!,
      req.serverId!
    );

    if (!result.success) {
      const statusCode = result.code === "FORMATION_NOT_FOUND" ? 404 :
                        result.code === "EMPTY_FORMATION" ? 400 : 500;
      
      res.status(statusCode).json({
        error: result.error,
        code: result.code
      });
      return;
    }

    res.json({
      message: "Formation activated successfully",
      formation: result.formation,
      stats: result.stats
    });

  } catch (err: any) {
    console.error("Activate formation error:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      code: "ACTIVATE_FORMATION_FAILED" 
    });
  }
});

/**
 * POST /api/formations/:formationId/duplicate
 * Dupliquer une formation
 */
router.post("/:formationId/duplicate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { formationId } = req.params;
    const { error, value } = duplicateFormationSchema.validate(req.body);
    
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message, 
        code: "VALIDATION_ERROR" 
      });
      return;
    }

    console.log(`📋 Duplication formation ${formationId} pour ${req.userId}`);

    const result = await FormationService.duplicateFormation(
      formationId,
      req.userId!,
      req.serverId!,
      value.newName
    );

    if (!result.success) {
      const statusCode = result.code === "FORMATION_NOT_FOUND" ? 404 :
                        result.code === "MAX_FORMATIONS_REACHED" ? 403 : 400;
      
      res.status(statusCode).json({
        error: result.error,
        code: result.code
      });
      return;
    }

    res.status(201).json({
      message: "Formation duplicated successfully",
      formation: result.formation,
      stats: result.stats
    });

  } catch (err: any) {
    console.error("Duplicate formation error:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      code: "DUPLICATE_FORMATION_FAILED" 
    });
  }
});

/**
 * POST /api/formations/validate
 * Valider une formation avant sauvegarde (preview)
 */
router.post("/validate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = validateFormationSchema.validate(req.body);
    
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message, 
        code: "VALIDATION_ERROR" 
      });
      return;
    }

    console.log(`✅ Validation formation pour ${req.userId}`);

    const validation = await FormationService.validateFormation(
      req.userId!,
      req.serverId!,
      value.slots
    );

    res.json({
      message: "Formation validation completed",
      validation
    });

  } catch (err: any) {
    console.error("Validate formation error:", err);
    res.status(500).json({ 
      error: "Internal server error", 
      code: "VALIDATE_FORMATION_FAILED" 
    });
  }
});

export default router;

import express, { Request, Response } from "express";
import Joi from "joi";
import { EventService } from "../services/EventService";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// Schémas de validation
const joinEventSchema = Joi.object({
  eventId: Joi.string().required().messages({
    'any.required': 'Event ID is required'
  })
});

const leaderboardSchema = Joi.object({
  limit: Joi.number().min(1).max(100).default(50)
});

const claimRewardsSchema = Joi.object({
  eventId: Joi.string().required(),
  objectiveId: Joi.string().required()
});

const createEventSchema = Joi.object({
  eventId: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).required(),
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).required(),
  type: Joi.string().valid("competition", "collection", "battle", "login", "special").required(),
  category: Joi.string().valid("pvp", "pve", "social", "progression", "seasonal").required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
  serverConfig: Joi.object({
    allowedServers: Joi.array().items(
      Joi.string().pattern(/^(S\d+|ALL)$/)
    ).min(1).required(),
    crossServerRanking: Joi.boolean().default(true),
    maxParticipants: Joi.number().min(-1).default(-1)
  }).required(),
  requirements: Joi.array().items(Joi.object({
    type: Joi.string().valid("level", "world", "heroes_owned", "vip_level", "server_age").required(),
    operator: Joi.string().valid("gte", "lte", "eq", "in").required(),
    value: Joi.alternatives().try(Joi.number(), Joi.string(), Joi.array()).required(),
    description: Joi.string().required()
  })).default([]),
  objectives: Joi.array().items(Joi.object({
    objectiveId: Joi.string().required(),
    type: Joi.string().valid("battle_wins", "tower_floors", "gacha_pulls", "login_days", "gold_spent", "collect_items").required(),
    name: Joi.string().required(),
    description: Joi.string().required(),
    targetValue: Joi.number().min(1).required(),
    rewards: Joi.array().items(Joi.object({
      rewardId: Joi.string().required(),
      type: Joi.string().valid("currency", "hero", "equipment", "material", "title", "avatar").required(),
      name: Joi.string().required(),
      description: Joi.string().required()
    })).required()
  })).min(1).required()
});

// === RÉCUPÉRER LES ÉVÉNEMENTS ACTIFS ===
router.get("/active", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`📅 ${req.userId} récupère événements actifs serveur ${req.serverId}`);

    const result = await EventService.getActiveEvents(req.serverId!);

    res.json({
      message: "Active events retrieved successfully",
      events: result.events,
      count: result.count,
      serverInfo: {
        serverId: req.serverId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error("Get active events error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_ACTIVE_EVENTS_FAILED"
    });
  }
});

// === REJOINDRE UN ÉVÉNEMENT ===
router.post("/join", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = joinEventSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { eventId } = req.body;
    
    console.log(`🎪 ${req.userId} tente de rejoindre événement ${eventId}`);

    const result = await EventService.joinEvent(
      eventId,
      req.userId!,
      req.serverId!
    );

    if (!result.success) {
      res.status(400).json({ 
        error: result.message,
        code: result.code || "JOIN_EVENT_FAILED"
      });
      return;
    }

    res.json({
      message: result.message,
      event: result.event
    });

  } catch (err: any) {
    console.error("Join event error:", err);
    
    if (err.message === "Event not found") {
      res.status(404).json({ 
        error: "Event not found",
        code: "EVENT_NOT_FOUND"
      });
      return;
    }
    
    if (err.message === "Player not found") {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }
    
    if (err.message === "Server not allowed for this event") {
      res.status(403).json({ 
        error: "Your server is not allowed to participate in this event",
        code: "SERVER_NOT_ALLOWED"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "JOIN_EVENT_FAILED"
    });
  }
});

// === RÉCUPÉRER LA PROGRESSION DES ÉVÉNEMENTS DU JOUEUR ===
router.get("/my-progress", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await EventService.getPlayerEventProgress(
      req.userId!,
      req.serverId!
    );

    res.json({
      message: "Player event progress retrieved successfully",
      events: result.events,
      summary: {
        activeEvents: result.activeEvents,
        completedEvents: result.completedEvents,
        totalEvents: result.events.length
      }
    });

  } catch (err) {
    console.error("Get player event progress error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_PLAYER_PROGRESS_FAILED"
    });
  }
});

// === RÉCUPÉRER LE CLASSEMENT D'UN ÉVÉNEMENT ===
router.get("/:eventId/leaderboard", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { error } = leaderboardSchema.validate(req.query);
    
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { limit } = req.query;
    const limitNum = parseInt(limit as string) || 50;

    const result = await EventService.getEventLeaderboard(
      eventId,
      req.serverId!,
      limitNum
    );

    res.json({
      message: "Event leaderboard retrieved successfully",
      eventId: result.eventId,
      eventName: result.eventName,
      leaderboard: result.leaderboard,
      totalParticipants: result.totalParticipants,
      crossServerRanking: result.crossServerRanking,
      timeRemaining: result.timeRemaining,
      leaderboardInfo: {
        limit: limitNum,
        serverScope: result.crossServerRanking ? "Cross-Server" : "Server Only"
      }
    });

  } catch (err: any) {
    console.error("Get event leaderboard error:", err);
    
    if (err.message === "Event not found") {
      res.status(404).json({ 
        error: "Event not found",
        code: "EVENT_NOT_FOUND"
      });
      return;
    }
    
    if (err.message === "Server not allowed for this event") {
      res.status(403).json({ 
        error: "Your server cannot access this event leaderboard",
        code: "SERVER_NOT_ALLOWED"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_LEADERBOARD_FAILED"
    });
  }
});

// === RÉCLAMER LES RÉCOMPENSES D'UN OBJECTIF ===
router.post("/claim-rewards", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = claimRewardsSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { eventId, objectiveId } = req.body;
    
    console.log(`🎁 ${req.userId} réclame récompenses ${objectiveId} événement ${eventId}`);

    const result = await EventService.claimObjectiveRewards(
      eventId,
      req.userId!,
      req.serverId!,
      objectiveId
    );

    res.json({
      message: result.message,
      rewards: result.rewards,
      summary: {
        rewardsCount: result.rewards.length,
        eventId,
        objectiveId
      }
    });

  } catch (err: any) {
    console.error("Claim objective rewards error:", err);
    
    if (err.message === "Event not found") {
      res.status(404).json({ 
        error: "Event not found",
        code: "EVENT_NOT_FOUND"
      });
      return;
    }
    
    if (err.message === "Player not participating in this event") {
      res.status(400).json({ 
        error: "You are not participating in this event",
        code: "NOT_PARTICIPATING"
      });
      return;
    }
    
    if (err.message === "Objective not completed yet") {
      res.status(400).json({ 
        error: "Objective not completed yet",
        code: "OBJECTIVE_NOT_COMPLETED"
      });
      return;
    }
    
    if (err.message === "Rewards already claimed for this objective") {
      res.status(400).json({ 
        error: "Rewards already claimed for this objective",
        code: "REWARDS_ALREADY_CLAIMED"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "CLAIM_REWARDS_FAILED"
    });
  }
});

// === RÉCUPÉRER LES DÉTAILS D'UN ÉVÉNEMENT SPÉCIFIQUE ===
router.get("/:eventId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    
    // Pour cette route, on va chercher l'événement directement
    const Event = (await import("../models/Events")).default;
    
    const event = await Event.findOne({ 
      eventId, 
      isVisible: true,
      $or: [
        { "serverConfig.allowedServers": req.serverId },
        { "serverConfig.allowedServers": "ALL" }
      ]
    });

    if (!event) {
      res.status(404).json({ 
        error: "Event not found or not accessible from your server",
        code: "EVENT_NOT_FOUND"
      });
      return;
    }

    // Récupérer les données du joueur s'il participe
    const playerParticipation = event.participants.find((p: any) => p.playerId === req.userId);

    res.json({
      message: "Event details retrieved successfully",
      event: {
        eventId: event.eventId,
        name: event.name,
        description: event.description,
        type: event.type,
        category: event.category,
        startTime: event.startTime,
        endTime: event.endTime,
        timeRemaining: Math.max(0, event.endTime.getTime() - Date.now()),
        status: event.status,
        isActive: event.isActive(),
        serverConfig: event.serverConfig,
        requirements: event.requirements,
        objectives: event.objectives,
        rankingRewards: event.rankingRewards,
        participantCount: event.participants.length,
        bannerUrl: event.bannerUrl,
        iconUrl: event.iconUrl,
        tags: event.tags,
        stats: event.stats
      },
      playerParticipation: playerParticipation ? {
        joinedAt: playerParticipation.joinedAt,
        totalPoints: playerParticipation.totalPoints,
        rank: playerParticipation.rank,
        objectives: playerParticipation.objectives,
        claimedRewards: playerParticipation.claimedRewards
      } : null,
      isParticipating: !!playerParticipation
    });

  } catch (err) {
    console.error("Get event details error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_EVENT_DETAILS_FAILED"
    });
  }
});

// === ROUTES ADMIN (TODO: Ajouter middleware admin) ===

// Créer un nouvel événement
router.post("/admin/create", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Vérifier les droits admin
    
    const { error } = createEventSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const result = await EventService.createEvent(req.body);

    res.status(201).json({
      message: result.message,
      event: {
        eventId: result.event.eventId,
        name: result.event.name,
        type: result.event.type,
        status: result.event.status
      }
    });

  } catch (err: any) {
    console.error("Create event error:", err);
    
    if (err.code === 11000) { // Duplicate eventId
      res.status(400).json({ 
        error: "Event ID already exists",
        code: "DUPLICATE_EVENT_ID"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "CREATE_EVENT_FAILED"
    });
  }
});

// Démarrer un événement manuellement
router.post("/admin/:eventId/start", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Vérifier les droits admin
    
    const { eventId } = req.params;
    
    const result = await EventService.startEvent(eventId);

    res.json({
      message: result.message,
      eventId
    });

  } catch (err: any) {
    console.error("Start event error:", err);
    
    if (err.message === "Event not found") {
      res.status(404).json({ 
        error: "Event not found",
        code: "EVENT_NOT_FOUND"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "START_EVENT_FAILED"
    });
  }
});

// Finaliser un événement
router.post("/admin/:eventId/finalize", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Vérifier les droits admin
    
    const { eventId } = req.params;
    
    const result = await EventService.finalizeEvent(eventId);

    res.json({
      message: result.message,
      finalStats: result.finalStats,
      distributionResult: result.distributionResult
    });

  } catch (err: any) {
    console.error("Finalize event error:", err);
    
    if (err.message === "Event not found") {
      res.status(404).json({ 
        error: "Event not found",
        code: "EVENT_NOT_FOUND"
      });
      return;
    }
    
    if (err.message === "Event is not active") {
      res.status(400).json({ 
        error: "Event is not active and cannot be finalized",
        code: "EVENT_NOT_ACTIVE"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "FINALIZE_EVENT_FAILED"
    });
  }
});

// === ROUTE DE TEST (développement uniquement) ===
router.post("/test/progress", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV === "production") {
      res.status(404).json({ error: "Not available in production" });
      return;
    }

    console.log(`🧪 Test progression événements pour ${req.userId}`);

    // Tester différents types de progression
    const testResults = [];

    const progressTypes = [
      { type: "battle_wins", value: 1, data: { battleType: "campaign", victory: true } },
      { type: "tower_floors", value: 3 },
      { type: "gacha_pulls", value: 5 },
      { type: "gold_spent", value: 1000 }
    ];

    for (const test of progressTypes) {
      const result = await EventService.updatePlayerProgress(
        req.userId!,
        req.serverId!,
        test.type as any,
        test.value,
        test.data
      );
      testResults.push({
        type: test.type,
        value: test.value,
        result
      });
    }

    res.json({
      message: "Event progress test completed",
      results: testResults,
      note: "This is a test endpoint for development"
    });

  } catch (err: any) {
    console.error("Test event progress error:", err);
    res.status(500).json({ 
      error: err.message,
      code: "TEST_EVENT_PROGRESS_FAILED"
    });
  }
});

export default router;

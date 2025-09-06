// src/routes/notifications.ts
import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import { NotificationService } from "../services/NotificationService";
import Player from "../models/Player";

const router = express.Router();

// Schémas de validation
const getNotificationsSchema = Joi.object({
  limit: Joi.number().min(1).max(100).default(20),
  unreadOnly: Joi.boolean().default(false)
});

const markReadSchema = Joi.object({
  notificationIds: Joi.array().items(Joi.string()).min(1).required()
});

const systemNotificationSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  message: Joi.string().min(10).max(500).required(),
  priority: Joi.string().valid("low", "normal", "high", "urgent").default("normal"),
  serverId: Joi.string().pattern(/^(S\d+|ALL)$/).default("ALL")
});

// === ROUTES JOUEUR ===

/**
 * GET /api/notifications
 * Récupérer les notifications du joueur
 */
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = getNotificationsSchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { limit, unreadOnly } = req.query;
    const limitNum = parseInt(limit as string) || 20;
    const unreadOnlyBool = unreadOnly === 'true';

    const notifications = await NotificationService.getPlayerNotifications(
      req.userId!,
      req.serverId!,
      limitNum,
      unreadOnlyBool
    );

    const unreadCount = await NotificationService.getUnreadCount(
      req.userId!,
      req.serverId!
    );

    res.json({
      message: "Notifications retrieved successfully",
      notifications,
      unreadCount,
      filters: {
        limit: limitNum,
        unreadOnly: unreadOnlyBool
      }
    });

  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_NOTIFICATIONS_FAILED"
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Récupérer le nombre de notifications non lues
 */
router.get("/unread-count", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const unreadCount = await NotificationService.getUnreadCount(
      req.userId!,
      req.serverId!
    );

    res.json({
      message: "Unread count retrieved successfully",
      unreadCount
    });

  } catch (err) {
    console.error("Get unread count error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_UNREAD_COUNT_FAILED"
    });
  }
});

/**
 * POST /api/notifications/mark-read
 * Marquer des notifications comme lues
 */
router.post("/mark-read", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = markReadSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { notificationIds } = req.body;

    const success = await NotificationService.markNotificationsAsRead(
      req.userId!,
      req.serverId!,
      notificationIds
    );

    if (!success) {
      res.status(400).json({
        error: "Failed to mark notifications as read",
        code: "MARK_READ_FAILED"
      });
      return;
    }

    const newUnreadCount = await NotificationService.getUnreadCount(
      req.userId!,
      req.serverId!
    );

    res.json({
      message: "Notifications marked as read successfully",
      markedCount: notificationIds.length,
      newUnreadCount
    });

  } catch (err) {
    console.error("Mark notifications read error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "MARK_READ_FAILED"
    });
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Marquer toutes les notifications comme lues
 */
router.post("/mark-all-read", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // Récupérer toutes les notifications non lues
    const unreadNotifications = await NotificationService.getPlayerNotifications(
      req.userId!,
      req.serverId!,
      100,
      true // unreadOnly
    );

    if (unreadNotifications.length === 0) {
      res.json({
        message: "No unread notifications to mark",
        markedCount: 0,
        newUnreadCount: 0
      });
      return;
    }

    const notificationIds = unreadNotifications.map(n => n.id);

    const success = await NotificationService.markNotificationsAsRead(
      req.userId!,
      req.serverId!,
      notificationIds
    );

    res.json({
      message: "All notifications marked as read successfully",
      markedCount: success ? notificationIds.length : 0,
      newUnreadCount: 0
    });

  } catch (err) {
    console.error("Mark all read error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "MARK_ALL_READ_FAILED"
    });
  }
});

// === ROUTES ADMIN ===

/**
 * POST /api/notifications/admin/system
 * Envoyer une notification système (admin)
 */
router.post("/admin/system", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin

    const { error } = systemNotificationSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { title, message, priority, serverId } = req.body;

    await NotificationService.sendSystemNotification(
      serverId,
      title,
      message,
      priority
    );

    res.json({
      message: "System notification sent successfully",
      scope: serverId,
      notification: {
        title,
        message,
        priority
      }
    });

  } catch (err) {
    console.error("Send system notification error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "SEND_SYSTEM_NOTIFICATION_FAILED"
    });
  }
});

/**
 * POST /api/notifications/admin/milestone
 * Envoyer une notification de milestone à un joueur (admin)
 */
router.post("/admin/milestone", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin

    const milestoneSchema = Joi.object({
      playerId: Joi.string().required(),
      serverId: Joi.string().pattern(/^S\d+$/).required(),
      milestone: Joi.string().min(3).max(100).required(),
      description: Joi.string().min(10).max(300).required()
    });

    const { error } = milestoneSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { playerId, serverId, milestone, description } = req.body;

    await NotificationService.notifyMajorMilestone(
      playerId,
      serverId,
      milestone,
      description
    );

    res.json({
      message: "Milestone notification sent successfully",
      target: { playerId, serverId },
      milestone: { milestone, description }
    });

  } catch (err) {
    console.error("Send milestone notification error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "SEND_MILESTONE_FAILED"
    });
  }
});

/**
 * GET /api/notifications/push-queue/:playerId
 * Récupérer les push notifications en attente pour Unity
 */
router.get("/push-queue/:playerId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { playerId } = req.params;
    
    // Vérifier que c'est bien le joueur connecté
    if (req.userId !== playerId) {
      res.status(403).json({
        error: "Access denied",
        code: "UNAUTHORIZED_ACCESS"
      });
      return;
    }

    const player = await Player.findOne({ _id: playerId, serverId: req.serverId! });
    if (!player) {
      res.status(404).json({
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    const pushQueue = (player as any).pushQueue || [];
    const pendingPush = pushQueue.filter((p: any) => !p.sent);

    // Marquer comme envoyés
    pushQueue.forEach((p: any) => {
      if (!p.sent) p.sent = true;
    });
    (player as any).pushQueue = pushQueue;
    await player.save();

    res.json({
      message: "Push queue retrieved successfully",
      pushNotifications: pendingPush,
      count: pendingPush.length
    });

  } catch (err) {
    console.error("Get push queue error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_PUSH_QUEUE_FAILED"
    });
  }
});

export default router;

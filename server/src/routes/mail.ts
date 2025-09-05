import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import { MailService } from "../services/MailService";

const router = express.Router();

const getMailsSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(50).default(20),
  category: Joi.string().valid("system", "reward", "event", "maintenance", "social", "compensation").optional(),
  unreadOnly: Joi.boolean().default(false),
  hasAttachments: Joi.boolean().optional(),
});

const claimMailSchema = Joi.object({
  mailId: Joi.string().required(),
});

const markReadSchema = Joi.object({
  mailId: Joi.string().required(),
});

const sendToPlayerSchema = Joi.object({
  recipientId: Joi.string().required(),
  title: Joi.string().required().max(100),
  content: Joi.string().required().max(1000),
  category: Joi.string().valid("system", "reward", "event", "maintenance", "social", "compensation").required(),
  attachments: Joi.array().items(Joi.object({
    type: Joi.string().valid("gold", "gems", "hero", "material", "ticket", "item").required(),
    itemId: Joi.string().when('type', {
      is: Joi.string().valid("hero", "material", "item"),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    quantity: Joi.number().min(1).max(999999).required(),
    rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary").when('type', {
      is: "hero",
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  })).optional(),
  senderName: Joi.string().max(50).default("System"),
  expiresInDays: Joi.number().min(1).max(30).default(7),
  priority: Joi.string().valid("low", "normal", "high", "urgent").default("normal"),
});

const sendToServerSchema = Joi.object({
  title: Joi.string().required().max(100),
  content: Joi.string().required().max(1000),
  category: Joi.string().valid("system", "reward", "event", "maintenance", "social", "compensation").required(),
  attachments: Joi.array().items(Joi.object({
    type: Joi.string().valid("gold", "gems", "hero", "material", "ticket", "item").required(),
    itemId: Joi.string().when('type', {
      is: Joi.string().valid("hero", "material", "item"),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    quantity: Joi.number().min(1).max(999999).required(),
    rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary").when('type', {
      is: "hero",
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  })).optional(),
  conditions: Joi.object({
    minLevel: Joi.number().min(1).max(1000).optional(),
    maxLevel: Joi.number().min(1).max(1000).optional(),
    vipLevel: Joi.number().min(0).max(15).optional(),
    playerIds: Joi.array().items(Joi.string()).optional(),
  }).optional(),
  senderName: Joi.string().max(50).default("System"),
  expiresInDays: Joi.number().min(1).max(30).default(7),
  priority: Joi.string().valid("low", "normal", "high", "urgent").default("normal"),
});

const sendRewardSchema = Joi.object({
  recipientId: Joi.string().required(),
  rewards: Joi.object({
    gold: Joi.number().min(0).optional(),
    gems: Joi.number().min(0).optional(),
    heroes: Joi.array().items(Joi.object({
      heroId: Joi.string().required(),
      rarity: Joi.string().valid("Common", "Rare", "Epic", "Legendary").required()
    })).optional(),
    materials: Joi.object().pattern(Joi.string(), Joi.number().min(1)).optional(),
    tickets: Joi.number().min(0).optional(),
  }).required(),
  reason: Joi.string().required().max(200),
  category: Joi.string().valid("reward", "compensation", "event").default("reward"),
});

router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = getMailsSchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const serverId = req.headers['x-server-id'] as string || "S1";
    const { page, limit, category, unreadOnly, hasAttachments } = req.query as any;

    const result = await MailService.getPlayerMails(
      req.userId!,
      serverId,
      {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        category,
        unreadOnly: unreadOnly === 'true',
        hasAttachments: hasAttachments === 'true' ? true : hasAttachments === 'false' ? false : undefined
      }
    );

    if (!result.success) {
      res.status(500).json({ error: result.error, code: "GET_MAILS_FAILED" });
      return;
    }

    res.json({
      message: "Mails retrieved successfully",
      ...result
    });
  } catch (err) {
    console.error("Get mails error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_MAILS_FAILED" });
  }
});

router.post("/claim/:mailId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { mailId } = req.params;
    const serverId = req.headers['x-server-id'] as string || "S1";

    const result = await MailService.claimMail(
      req.userId!,
      serverId,
      mailId
    );

    if (!result.success) {
      res.status(400).json({ error: result.error, code: result.code || "CLAIM_FAILED" });
      return;
    }

    res.json({
      message: "Mail claimed successfully",
      ...result
    });
  } catch (err) {
    console.error("Claim mail error:", err);
    res.status(500).json({ error: "Internal server error", code: "CLAIM_MAIL_FAILED" });
  }
});

router.post("/claim-all", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const serverId = req.headers['x-server-id'] as string || "S1";

    const result = await MailService.claimAllMails(
      req.userId!,
      serverId
    );

    if (!result.success) {
      res.status(400).json({ error: result.error, code: result.code || "CLAIM_ALL_FAILED" });
      return;
    }

    res.json({
      message: "All mails claimed successfully",
      ...result
    });
  } catch (err) {
    console.error("Claim all mails error:", err);
    res.status(500).json({ error: "Internal server error", code: "CLAIM_ALL_FAILED" });
  }
});

router.post("/read/:mailId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { mailId } = req.params;
    const serverId = req.headers['x-server-id'] as string || "S1";

    const result = await MailService.markAsRead(
      req.userId!,
      serverId,
      mailId
    );

    if (!result.success) {
      res.status(400).json({ error: result.error, code: "MARK_READ_FAILED" });
      return;
    }

    res.json({
      message: "Mail marked as read successfully"
    });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Internal server error", code: "MARK_READ_FAILED" });
  }
});

router.post("/send/player", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = sendToPlayerSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const serverId = req.headers['x-server-id'] as string || "S1";
    const { recipientId, ...mailOptions } = req.body;

    const result = await MailService.sendToPlayer(
      recipientId,
      serverId,
      mailOptions
    );

    if (!result.success) {
      res.status(500).json({ error: result.error, code: "SEND_MAIL_FAILED" });
      return;
    }

    res.json({
      message: "Mail sent to player successfully",
      mailId: result.mailId
    });
  } catch (err) {
    console.error("Send mail to player error:", err);
    res.status(500).json({ error: "Internal server error", code: "SEND_MAIL_FAILED" });
  }
});

router.post("/send/server", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = sendToServerSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const serverId = req.headers['x-server-id'] as string || "S1";

    const result = await MailService.sendToServer(
      serverId,
      req.body
    );

    if (!result.success) {
      res.status(500).json({ error: result.error, code: "SEND_SERVER_MAIL_FAILED" });
      return;
    }

    res.json({
      message: "Mail sent to server successfully",
      mailId: result.mailId
    });
  } catch (err) {
    console.error("Send mail to server error:", err);
    res.status(500).json({ error: "Internal server error", code: "SEND_SERVER_MAIL_FAILED" });
  }
});

router.post("/send/all-servers", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = sendToServerSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const result = await MailService.sendToAllServers(req.body);

    if (!result.success) {
      res.status(500).json({ error: result.error, code: "SEND_ALL_SERVERS_MAIL_FAILED" });
      return;
    }

    res.json({
      message: "Mail sent to all servers successfully",
      mailId: result.mailId
    });
  } catch (err) {
    console.error("Send mail to all servers error:", err);
    res.status(500).json({ error: "Internal server error", code: "SEND_ALL_SERVERS_MAIL_FAILED" });
  }
});

router.post("/send/reward", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = sendRewardSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message, code: "VALIDATION_ERROR" });
      return;
    }

    const serverId = req.headers['x-server-id'] as string || "S1";
    const { recipientId, rewards, reason, category } = req.body;

    const result = await MailService.sendRewardMail(
      recipientId,
      serverId,
      rewards,
      reason,
      category
    );

    if (!result.success) {
      res.status(500).json({ error: result.error, code: "SEND_REWARD_MAIL_FAILED" });
      return;
    }

    res.json({
      message: "Reward mail sent successfully",
      mailId: result.mailId
    });
  } catch (err) {
    console.error("Send reward mail error:", err);
    res.status(500).json({ error: "Internal server error", code: "SEND_REWARD_MAIL_FAILED" });
  }
});

router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const serverId = req.headers['x-server-id'] as string;

    const result = await MailService.getMailStats(serverId);

    if (!result.success) {
      res.status(500).json({ error: result.error, code: "GET_MAIL_STATS_FAILED" });
      return;
    }

    res.json({
      message: "Mail stats retrieved successfully",
      ...result
    });
  } catch (err) {
    console.error("Get mail stats error:", err);
    res.status(500).json({ error: "Internal server error", code: "GET_MAIL_STATS_FAILED" });
  }
});

router.post("/admin/clean-expired", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await MailService.cleanExpiredMails();

    if (!result.success) {
      res.status(500).json({ error: result.error, code: "CLEAN_EXPIRED_FAILED" });
      return;
    }

    res.json({
      message: "Expired mails cleaned successfully",
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error("Clean expired mails error:", err);
    res.status(500).json({ error: "Internal server error", code: "CLEAN_EXPIRED_FAILED" });
  }
});

router.post("/admin/process-scheduled", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await MailService.processScheduledMails();

    if (!result.success) {
      res.status(500).json({ error: result.error, code: "PROCESS_SCHEDULED_FAILED" });
      return;
    }

    res.json({
      message: "Scheduled mails processed successfully",
      processedCount: result.processedCount
    });
  } catch (err) {
    console.error("Process scheduled mails error:", err);
    res.status(500).json({ error: "Internal server error", code: "PROCESS_SCHEDULED_FAILED" });
  }
});

export default router;

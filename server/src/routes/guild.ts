import express, { Request, Response } from "express";
import Joi from "joi";
import authMiddleware from "../middleware/authMiddleware";
import serverMiddleware from "../middleware/serverMiddleware";
import { requireFeature } from "../middleware/featureMiddleware";

// Import des services guildes
import { GuildManagementService } from "../services/guild/GuildManagementService";
import { GuildMemberService } from "../services/guild/GuildMemberService";
import { GuildActivityService } from "../services/guild/GuildActivityService";
import { GuildSearchService } from "../services/guild/GuildSearchService";

// Import des templates
import { getQuestTemplate, getAvailableQuestTemplates } from "../services/guild/templates/GuildQuestTemplates";
import { getRaidTemplate, getAvailableRaidTemplates } from "../services/guild/templates/GuildRaidTemplates";

// Import WebSocket
import { WebSocketService } from "../services/WebSocketService";

const router = express.Router();

// ✅ APPLIQUER les middlewares à toutes les routes
router.use(serverMiddleware);
router.use(authMiddleware);
router.use(requireFeature("guilds"));

// === SCHÉMAS DE VALIDATION ===

const createGuildSchema = Joi.object({
  name: Joi.string().min(3).max(20).pattern(/^[a-zA-Z0-9\s\-_]+$/).required(),
  tag: Joi.string().min(2).max(5).pattern(/^[A-Z0-9]+$/).required(),
  description: Joi.string().max(300).optional(),
  iconId: Joi.string().optional(),
  isPublic: Joi.boolean().default(true),
  language: Joi.string().valid("en", "fr", "es", "de", "ja", "ko", "zh").default("en")
});

const updateGuildSettingsSchema = Joi.object({
  description: Joi.string().max(300).optional(),
  iconId: Joi.string().optional(),
  isPublic: Joi.boolean().optional(),
  autoAccept: Joi.boolean().optional(),
  minimumLevel: Joi.number().min(1).max(1000).optional(),
  minimumPower: Joi.number().min(0).optional(),
  language: Joi.string().valid("en", "fr", "es", "de", "ja", "ko", "zh").optional(),
  requiredActivity: Joi.string().valid("low", "medium", "high").optional(),
  
  // 🔥 NOUVEAU: Validation auto-kick
  autoKickInactiveMembers: Joi.boolean().optional(),
  inactivityThresholdDays: Joi.number().min(3).max(30).optional()
});

const applyToGuildSchema = Joi.object({
  guildId: Joi.string().required(),
  message: Joi.string().max(200).default("")
});

const processApplicationSchema = Joi.object({
  applicantId: Joi.string().required(),
  action: Joi.string().valid("accept", "reject").required()
});

const invitePlayerSchema = Joi.object({
  targetPlayerId: Joi.string().required()
});

const processInvitationSchema = Joi.object({
  guildId: Joi.string().required(),
  action: Joi.string().valid("accept", "decline").required()
});

const manageMemberSchema = Joi.object({
  targetPlayerId: Joi.string().required(),
  action: Joi.string().valid("kick", "promote_officer", "promote_leader", "demote").required()
});

const contributeSchema = Joi.object({
  gold: Joi.number().min(0).optional(),
  materials: Joi.object().pattern(Joi.string(), Joi.number().min(1)).optional()
}).min(1);

const startQuestSchema = Joi.object({
  questType: Joi.string().valid("daily", "weekly", "special").required(),
  templateId: Joi.string().required()
});

const updateQuestProgressSchema = Joi.object({
  questId: Joi.string().required(),
  progress: Joi.number().min(1).required()
});

const startRaidSchema = Joi.object({
  raidType: Joi.string().valid("guild_boss", "territory_war").required(),
  templateId: Joi.string().required(),
  difficulty: Joi.number().min(1).max(10).default(1)
});

const joinRaidSchema = Joi.object({
  raidId: Joi.string().required()
});

const attackRaidBossSchema = Joi.object({
  raidId: Joi.string().required(),
  damage: Joi.number().min(1).required()
});

const searchGuildsSchema = Joi.object({
  name: Joi.string().optional(),
  tag: Joi.string().optional(),
  minLevel: Joi.number().min(1).optional(),
  maxLevel: Joi.number().max(100).optional(),
  minMembers: Joi.number().min(1).optional(),
  maxMembers: Joi.number().max(50).optional(),
  minPower: Joi.number().min(0).optional(),
  maxPower: Joi.number().optional(),
  language: Joi.string().optional(),
  hasSpace: Joi.boolean().optional(),
  isPublic: Joi.boolean().optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(50).default(20)
});

// ===== ROUTES DE GESTION DE GUILDE =====

/**
 * POST /api/guilds/create
 * Créer une nouvelle guilde
 */
router.post("/create", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = createGuildSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const result = await GuildManagementService.createGuild(
      req.userId!,
      req.serverId!,
      value
    );

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "PLAYER_NOT_FOUND") statusCode = 404;
      if (result.code === "ALREADY_IN_GUILD") statusCode = 409;
      if (result.code === "LEVEL_TOO_LOW") statusCode = 403;
      if (result.code === "INSUFFICIENT_GOLD") statusCode = 402;

      res.status(statusCode).json(result);
      return;
    }

    res.status(201).json({
      message: "Guild created successfully",
      serverId: req.serverId,
      guild: {
        guildId: result.guild!._id,
        name: result.guild!.name,
        tag: result.guild!.tag,
        level: result.guild!.level,
        memberCount: result.guild!.memberCount,
        maxMembers: result.guild!.maxMembers
      }
    });

  } catch (error: any) {
    console.error("Create guild error:", error);
    res.status(500).json({ 
      error: "Failed to create guild",
      code: "CREATE_GUILD_FAILED"
    });
  }
});

/**
 * DELETE /api/guilds/:guildId/disband
 * Dissoudre une guilde
 */
router.delete("/:guildId/disband", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const { reason } = req.body;

    const result = await GuildManagementService.disbandGuild(guildId, req.userId!, reason);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: "Guild disbanded successfully",
      serverId: req.serverId
    });

  } catch (error: any) {
    console.error("Disband guild error:", error);
    res.status(500).json({ 
      error: "Failed to disband guild",
      code: "DISBAND_GUILD_FAILED"
    });
  }
});

/**
 * GET /api/guilds/:guildId
 * Obtenir les détails d'une guilde
 */
router.get("/:guildId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;

    const guild = await GuildManagementService.getGuildDetails(guildId);

    if (!guild) {
      res.status(404).json({
        error: "Guild not found",
        code: "GUILD_NOT_FOUND"
      });
      return;
    }

    res.json({
      message: "Guild details retrieved successfully",
      serverId: req.serverId,
      guild: {
        guildId: guild._id,
        name: guild.name,
        tag: guild.tag,
        description: guild.description,
        iconId: guild.iconId,
        level: guild.level,
        experience: guild.experience,
        experienceRequired: guild.experienceRequired,
        memberCount: guild.memberCount,
        maxMembers: guild.maxMembers,
        settings: guild.settings,
        stats: guild.stats,
        members: guild.members,
        currentQuests: guild.currentQuests,
        currentRaid: guild.currentRaid,
        guildCoins: guild.guildCoins,
        guildBank: guild.guildBank,
        territory: guild.territory,
        createdAt: guild.createdAt
      }
    });

  } catch (error: any) {
    console.error("Get guild details error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve guild details",
      code: "GET_GUILD_FAILED"
    });
  }
});

/**
 * PUT /api/guilds/:guildId/settings
 * Modifier les paramètres d'une guilde
 */
router.put("/:guildId/settings", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const { error, value } = updateGuildSettingsSchema.validate(req.body);
    
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const result = await GuildManagementService.updateGuildSettings(guildId, req.userId!, value);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: "Guild settings updated successfully",
      serverId: req.serverId
    });

  } catch (error: any) {
    console.error("Update guild settings error:", error);
    res.status(500).json({ 
      error: "Failed to update guild settings",
      code: "UPDATE_SETTINGS_FAILED"
    });
  }
});

// ===== ROUTES DE MEMBRES =====

/**
 * POST /api/guilds/apply
 * Postuler à une guilde
 */
router.post("/apply", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = applyToGuildSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { guildId, message } = value;

    const result = await GuildMemberService.applyToGuild(req.userId!, guildId, message);

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "PLAYER_NOT_FOUND" || result.code === "GUILD_NOT_FOUND") statusCode = 404;
      if (result.code === "ALREADY_IN_GUILD") statusCode = 409;
      if (result.code === "REQUIREMENTS_NOT_MET") statusCode = 403;

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: result.autoAccepted ? "Application auto-accepted" : "Application submitted successfully",
      serverId: req.serverId,
      autoAccepted: result.autoAccepted
    });

  } catch (error: any) {
    console.error("Apply to guild error:", error);
    res.status(500).json({ 
      error: "Failed to apply to guild",
      code: "APPLY_GUILD_FAILED"
    });
  }
});

/**
 * POST /api/guilds/:guildId/applications/:applicantId
 * Traiter une candidature
 */
router.post("/:guildId/applications/:applicantId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, applicantId } = req.params;
    const { error, value } = processApplicationSchema.validate({ 
      applicantId, 
      action: req.body.action 
    });

    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { action } = value;

    const result = await GuildMemberService.processApplication(guildId, applicantId, action, req.userId!);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: `Application ${action}ed successfully`,
      serverId: req.serverId
    });

  } catch (error: any) {
    console.error("Process application error:", error);
    res.status(500).json({ 
      error: "Failed to process application",
      code: "PROCESS_APPLICATION_FAILED"
    });
  }
});

/**
 * POST /api/guilds/:guildId/invite
 * Inviter un joueur
 */
router.post("/:guildId/invite", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const { error, value } = invitePlayerSchema.validate(req.body);

    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { targetPlayerId } = value;

    const result = await GuildMemberService.invitePlayer(guildId, targetPlayerId, req.userId!);

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "GUILD_NOT_FOUND" || result.code === "PLAYER_NOT_FOUND") statusCode = 404;
      if (result.code === "ALREADY_IN_GUILD") statusCode = 409;
      if (result.code === "NO_PERMISSION") statusCode = 403;

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: "Invitation sent successfully",
      serverId: req.serverId,
      expiresAt: result.expiresAt
    });

  } catch (error: any) {
    console.error("Invite player error:", error);
    res.status(500).json({ 
      error: "Failed to invite player",
      code: "INVITE_PLAYER_FAILED"
    });
  }
});

/**
 * POST /api/guilds/invitations/respond
 * Répondre à une invitation
 */
router.post("/invitations/respond", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = processInvitationSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { guildId, action } = value;

    const result = await GuildMemberService.processInvitation(req.userId!, guildId, action);

    if (!result.success) {
      let statusCode = 400;
      if (result.code === "GUILD_NOT_FOUND" || result.code === "PLAYER_NOT_FOUND") statusCode = 404;
      if (result.code === "ALREADY_IN_GUILD") statusCode = 409;

      res.status(statusCode).json(result);
      return;
    }

    res.json({
      message: `Invitation ${action}d successfully`,
      serverId: req.serverId,
      ...(action === "accept" && { 
        guild: {
          guildId: result.guild!._id,
          name: result.guild!.name,
          tag: result.guild!.tag
        }
      })
    });

  } catch (error: any) {
    console.error("Process invitation error:", error);
    res.status(500).json({ 
      error: "Failed to process invitation",
      code: "PROCESS_INVITATION_FAILED"
    });
  }
});

/**
 * POST /api/guilds/leave
 * Quitter sa guilde
 */
router.post("/leave", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await GuildMemberService.leaveGuild(req.userId!);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: "Left guild successfully",
      serverId: req.serverId
    });

  } catch (error: any) {
    console.error("Leave guild error:", error);
    res.status(500).json({ 
      error: "Failed to leave guild",
      code: "LEAVE_GUILD_FAILED"
    });
  }
});

/**
 * POST /api/guilds/:guildId/members/manage
 * Gérer un membre (kick, promote, demote)
 */
router.post("/:guildId/members/manage", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const { error, value } = manageMemberSchema.validate(req.body);

    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { targetPlayerId, action } = value;

    let result;
    switch (action) {
      case "kick":
        result = await GuildMemberService.kickMember(guildId, targetPlayerId, req.userId!);
        break;
      case "promote_officer":
        result = await GuildMemberService.promoteMember(guildId, targetPlayerId, "officer", req.userId!);
        break;
      case "promote_leader":
        result = await GuildMemberService.promoteMember(guildId, targetPlayerId, "leader", req.userId!);
        break;
      case "demote":
        result = await GuildMemberService.demoteMember(guildId, targetPlayerId, req.userId!);
        break;
      default:
        res.status(400).json({ error: "Invalid action", code: "INVALID_ACTION" });
        return;
    }

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: `Member ${action} successful`,
      serverId: req.serverId
    });

  } catch (error: any) {
    console.error("Manage member error:", error);
    res.status(500).json({ 
      error: "Failed to manage member",
      code: "MANAGE_MEMBER_FAILED"
    });
  }
});

/**
 * GET /api/guilds/my-info
 * Obtenir les informations de guilde du joueur
 */
router.get("/my-info", async (req: Request, res: Response): Promise<void> => {
  try {
    const playerInfo = await GuildMemberService.getPlayerGuildInfo(req.userId!);

    res.json({
      message: "Player guild info retrieved successfully",
      serverId: req.serverId,
      ...playerInfo
    });

  } catch (error: any) {
    console.error("Get player guild info error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve guild info",
      code: "GET_GUILD_INFO_FAILED"
    });
  }
});

// ===== ROUTES D'ACTIVITÉS =====

/**
 * POST /api/guilds/:guildId/contribute
 * Contribuer à la guilde
 */
router.post("/:guildId/contribute", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const { error, value } = contributeSchema.validate(req.body);

    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const result = await GuildActivityService.contributeToGuild(req.userId!, value);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: "Contribution successful",
      serverId: req.serverId,
      contributionPoints: result.contributionPoints
    });

  } catch (error: any) {
    console.error("Guild contribution error:", error);
    res.status(500).json({ 
      error: "Failed to contribute to guild",
      code: "CONTRIBUTION_FAILED"
    });
  }
});

/**
 * POST /api/guilds/:guildId/quests/start
 * Démarrer une quête de guilde
 */
router.post("/:guildId/quests/start", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const { error, value } = startQuestSchema.validate(req.body);

    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { questType, templateId } = value;

    const result = await GuildActivityService.startGuildQuest(guildId, questType, templateId);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: "Guild quest started successfully",
      serverId: req.serverId,
      quest: result.quest
    });

  } catch (error: any) {
    console.error("Start guild quest error:", error);
    res.status(500).json({ 
      error: "Failed to start guild quest",
      code: "START_QUEST_FAILED"
    });
  }
});

/**
 * POST /api/guilds/:guildId/quests/progress
 * Mettre à jour la progression d'une quête
 */
router.post("/:guildId/quests/progress", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const { error, value } = updateQuestProgressSchema.validate(req.body);

    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { questId, progress } = value;

    const result = await GuildActivityService.updateGuildQuestProgress(guildId, questId, req.userId!, progress);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: "Quest progress updated successfully",
      serverId: req.serverId,
      questCompleted: result.questCompleted
    });

  } catch (error: any) {
    console.error("Update quest progress error:", error);
    res.status(500).json({ 
      error: "Failed to update quest progress",
      code: "UPDATE_QUEST_FAILED"
    });
  }
});

/**
 * GET /api/guilds/:guildId/quests
 * Obtenir les quêtes actives
 */
router.get("/:guildId/quests", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;

    const quests = await GuildActivityService.getGuildQuestProgress(guildId);

    res.json({
      message: "Guild quests retrieved successfully",
      serverId: req.serverId,
      quests
    });

  } catch (error: any) {
    console.error("Get guild quests error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve guild quests",
      code: "GET_QUESTS_FAILED"
    });
  }
});

/**
 * POST /api/guilds/:guildId/raids/start
 * Démarrer un raid de guilde
 */
router.post("/:guildId/raids/start", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const { error, value } = startRaidSchema.validate(req.body);

    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { raidType, templateId, difficulty } = value;

    const result = await GuildActivityService.startGuildRaid(guildId, raidType, templateId, difficulty);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: "Guild raid started successfully",
      serverId: req.serverId,
      raid: result.raid
    });

  } catch (error: any) {
    console.error("Start guild raid error:", error);
    res.status(500).json({ 
      error: "Failed to start guild raid",
      code: "START_RAID_FAILED"
    });
  }
});

/**
 * POST /api/guilds/:guildId/raids/join
 * Rejoindre un raid
 */
router.post("/:guildId/raids/join", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const { error, value } = joinRaidSchema.validate(req.body);

    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { raidId } = value;

    const result = await GuildActivityService.joinGuildRaid(guildId, raidId, req.userId!);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: "Joined raid successfully",
      serverId: req.serverId
    });

  } catch (error: any) {
    console.error("Join guild raid error:", error);
    res.status(500).json({ 
      error: "Failed to join guild raid",
      code: "JOIN_RAID_FAILED"
    });
  }
});

/**
 * POST /api/guilds/:guildId/raids/attack
 * Attaquer le boss de raid
 */
router.post("/:guildId/raids/attack", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const { error, value } = attackRaidBossSchema.validate(req.body);

    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { raidId, damage } = value;

    const result = await GuildActivityService.attackRaidBoss(guildId, raidId, req.userId!, damage);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: "Attack successful",
      serverId: req.serverId,
      raidCompleted: result.raidCompleted
    });

  } catch (error: any) {
    console.error("Attack raid boss error:", error);
    res.status(500).json({ 
      error: "Failed to attack raid boss",
      code: "ATTACK_RAID_FAILED"
    });
  }
});

/**
 * GET /api/guilds/:guildId/raids/status
 * Obtenir le statut du raid actuel
 */
router.get("/:guildId/raids/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;

    const raidStatus = await GuildActivityService.getRaidStatus(guildId);

    if (!raidStatus) {
      res.status(404).json({
        error: "No active raid found",
        code: "NO_ACTIVE_RAID"
      });
      return;
    }

    res.json({
      message: "Raid status retrieved successfully",
      serverId: req.serverId,
      raid: raidStatus
    });

  } catch (error: any) {
    console.error("Get raid status error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve raid status",
      code: "GET_RAID_STATUS_FAILED"
    });
  }
});

/**
 * POST /api/guilds/:guildId/rewards/daily/claim
 * Réclamer les récompenses quotidiennes
 */
router.post("/:guildId/rewards/daily/claim", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;

    const result = await GuildActivityService.claimDailyRewards(guildId, req.userId!);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: "Daily rewards claimed successfully",
      serverId: req.serverId,
      rewards: result.rewards
    });

  } catch (error: any) {
    console.error("Claim daily rewards error:", error);
    res.status(500).json({ 
      error: "Failed to claim daily rewards",
      code: "CLAIM_DAILY_REWARDS_FAILED"
    });
  }
});

/**
 * POST /api/guilds/:guildId/rewards/weekly/claim
 * Réclamer les récompenses hebdomadaires
 */
router.post("/:guildId/rewards/weekly/claim", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;

    const result = await GuildActivityService.claimWeeklyRewards(guildId, req.userId!);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      message: "Weekly rewards claimed successfully",
      serverId: req.serverId,
      rewards: result.rewards
    });

  } catch (error: any) {
    console.error("Claim weekly rewards error:", error);
    res.status(500).json({ 
      error: "Failed to claim weekly rewards",
      code: "CLAIM_WEEKLY_REWARDS_FAILED"
    });
  }
});

// ===== ROUTES DE RECHERCHE ET CLASSEMENTS =====

/**
 * GET /api/guilds/search
 * Rechercher des guildes
 */
router.get("/search", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = searchGuildsSchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { page, limit, ...filters } = value;

    const result = await GuildSearchService.searchGuilds(req.serverId!, filters, page, limit);

    res.json({
      message: "Guild search completed successfully",
      serverId: req.serverId,
      ...result
    });

  } catch (error: any) {
    console.error("Search guilds error:", error);
    res.status(500).json({ 
      error: "Failed to search guilds",
      code: "SEARCH_GUILDS_FAILED"
    });
  }
});

/**
 * GET /api/guilds/leaderboard/:type
 * Obtenir le classement des guildes
 */
router.get("/leaderboard/:type", async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    const { limit = 100 } = req.query;

    if (!["level", "power", "members"].includes(type)) {
      res.status(400).json({
        error: "Invalid leaderboard type",
        code: "INVALID_TYPE",
        validTypes: ["level", "power", "members"]
      });
      return;
    }

    const leaderboard = await GuildSearchService.getGuildLeaderboard(
      req.serverId!, 
      type as "level" | "power" | "members", 
      parseInt(limit as string)
    );

    res.json({
      message: `Guild ${type} leaderboard retrieved successfully`,
      serverId: req.serverId,
      type,
      leaderboard
    });

  } catch (error: any) {
    console.error("Get guild leaderboard error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve guild leaderboard",
      code: "GET_LEADERBOARD_FAILED"
    });
  }
});

/**
 * GET /api/guilds/recommendations
 * Obtenir des recommandations de guildes
 */
router.get("/recommendations", async (req: Request, res: Response): Promise<void> => {
  try {
    const { playerLevel = 1, playerPower = 0, language = "en", limit = 10 } = req.query;

    const recommendations = await GuildSearchService.getRecommendedGuilds(
      req.serverId!,
      parseInt(playerLevel as string),
      parseInt(playerPower as string),
      language as string,
      parseInt(limit as string)
    );

    res.json({
      message: "Guild recommendations retrieved successfully",
      serverId: req.serverId,
      recommendations
    });

  } catch (error: any) {
    console.error("Get guild recommendations error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve guild recommendations",
      code: "GET_RECOMMENDATIONS_FAILED"
    });
  }
});

/**
 * GET /api/guilds/by-activity/:activityType
 * Obtenir des guildes par type d'activité
 */
router.get("/by-activity/:activityType", async (req: Request, res: Response): Promise<void> => {
  try {
    const { activityType } = req.params;
    const { limit = 20 } = req.query;

    const validTypes = ["most_active", "recruiting", "high_level", "beginner_friendly"];
    if (!validTypes.includes(activityType)) {
      res.status(400).json({
        error: "Invalid activity type",
        code: "INVALID_ACTIVITY_TYPE",
        validTypes
      });
      return;
    }

    const guilds = await GuildSearchService.getGuildsByActivity(
      req.serverId!,
      activityType as any,
      parseInt(limit as string)
    );

    res.json({
      message: `${activityType} guilds retrieved successfully`,
      serverId: req.serverId,
      activityType,
      guilds
    });

  } catch (error: any) {
    console.error("Get guilds by activity error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve guilds by activity",
      code: "GET_ACTIVITY_GUILDS_FAILED"
    });
  }
});

/**
 * GET /api/guilds/server-stats
 * Obtenir les statistiques du serveur
 */
router.get("/server-stats", async (req: Request, res: Response): Promise<void> => {
  try {
    const serverStats = await GuildSearchService.getServerStatistics(req.serverId!);

    res.json({
      message: "Server guild statistics retrieved successfully",
      serverId: req.serverId,
      stats: serverStats
    });

  } catch (error: any) {
    console.error("Get server stats error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve server statistics",
      code: "GET_SERVER_STATS_FAILED"
    });
  }
});

/**
 * GET /api/guilds/global-leaderboard
 * Obtenir le classement global des guildes
 */
router.get("/global-leaderboard", async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 50 } = req.query;

    const globalLeaderboard = await GuildSearchService.getTopGuildsGlobal(parseInt(limit as string));

    res.json({
      message: "Global guild leaderboard retrieved successfully",
      globalLeaderboard
    });

  } catch (error: any) {
    console.error("Get global leaderboard error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve global leaderboard",
      code: "GET_GLOBAL_LEADERBOARD_FAILED"
    });
  }
});

// ===== ROUTES TEMPLATE ET UTILITAIRES =====

/**
 * GET /api/guilds/templates/quests/:questType
 * Obtenir les templates de quêtes disponibles
 */
router.get("/templates/quests/:questType", async (req: Request, res: Response): Promise<void> => {
  try {
    const { questType } = req.params;

    if (!["daily", "weekly", "special"].includes(questType)) {
      res.status(400).json({
        error: "Invalid quest type",
        code: "INVALID_QUEST_TYPE",
        validTypes: ["daily", "weekly", "special"]
      });
      return;
    }

    const templates = getAvailableQuestTemplates(questType as "daily" | "weekly" | "special");
    const templatesWithDetails = templates.map(templateId => {
      const template = getQuestTemplate(questType as "daily" | "weekly" | "special", templateId);
      return {
        templateId,
        ...template
      };
    });

    res.json({
      message: `${questType} quest templates retrieved successfully`,
      questType,
      templates: templatesWithDetails
    });

  } catch (error: any) {
    console.error("Get quest templates error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve quest templates",
      code: "GET_QUEST_TEMPLATES_FAILED"
    });
  }
});

/**
 * GET /api/guilds/templates/raids/:raidType
 * Obtenir les templates de raids disponibles
 */
router.get("/templates/raids/:raidType", async (req: Request, res: Response): Promise<void> => {
  try {
    const { raidType } = req.params;

    if (!["guild_boss", "territory_war", "special_event"].includes(raidType)) {
      res.status(400).json({
        error: "Invalid raid type",
        code: "INVALID_RAID_TYPE",
        validTypes: ["guild_boss", "territory_war", "special_event"]
      });
      return;
    }

    const templates = getAvailableRaidTemplates(raidType as "guild_boss" | "territory_war" | "special_event");
    const templatesWithDetails = templates.map(templateId => {
      const template = getRaidTemplate(raidType as "guild_boss" | "territory_war" | "special_event", templateId);
      return {
        templateId,
        ...template
      };
    });

    res.json({
      message: `${raidType} raid templates retrieved successfully`,
      raidType,
      templates: templatesWithDetails
    });

  } catch (error: any) {
    console.error("Get raid templates error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve raid templates",
      code: "GET_RAID_TEMPLATES_FAILED"
    });
  }
});

/**
 * GET /api/guilds/:guildId/activity-logs
 * Obtenir les logs d'activité d'une guilde
 */
router.get("/:guildId/activity-logs", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const { limit = 50 } = req.query;

    const activityLogs = await GuildManagementService.getGuildActivityLogs(
      guildId, 
      parseInt(limit as string)
    );

    res.json({
      message: "Guild activity logs retrieved successfully",
      serverId: req.serverId,
      guildId,
      logs: activityLogs
    });

  } catch (error: any) {
    console.error("Get activity logs error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve activity logs",
      code: "GET_ACTIVITY_LOGS_FAILED"
    });
  }
});

/**
 * GET /api/guilds/:guildId/can-join/:playerId
 * Vérifier si un joueur peut rejoindre une guilde
 */
router.get("/:guildId/can-join/:playerId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, playerId } = req.params;

    const canJoinResult = await GuildMemberService.canPlayerJoinGuild(playerId, guildId);

    res.json({
      message: "Guild join eligibility checked successfully",
      serverId: req.serverId,
      guildId,
      playerId,
      ...canJoinResult
    });

  } catch (error: any) {
    console.error("Check can join guild error:", error);
    res.status(500).json({ 
      error: "Failed to check guild join eligibility",
      code: "CHECK_JOIN_FAILED"
    });
  }
});

// ===== ROUTES WEBSOCKET ET TEMPS RÉEL =====

/**
 * POST /api/guilds/ws/join-room
 * Rejoindre la room WebSocket de sa guilde
 */
router.post("/ws/join-room", async (req: Request, res: Response): Promise<void> => {
  try {
    const playerInfo = await GuildMemberService.getPlayerGuildInfo(req.userId!);

    if (!playerInfo.isInGuild || !playerInfo.guild) {
      res.status(400).json({
        error: "Player is not in a guild",
        code: "NOT_IN_GUILD"
      });
      return;
    }

    // Faire rejoindre la room WebSocket
    WebSocketService.joinGuildRoom(req.userId!, playerInfo.guild.guildId);

    res.json({
      message: "Joined guild WebSocket room successfully",
      serverId: req.serverId,
      guildId: playerInfo.guild.guildId,
      guildName: playerInfo.guild.name
    });

  } catch (error: any) {
    console.error("Join guild WebSocket room error:", error);
    res.status(500).json({ 
      error: "Failed to join guild WebSocket room",
      code: "JOIN_WS_ROOM_FAILED"
    });
  }
});

/**
 * POST /api/guilds/ws/leave-room
 * Quitter la room WebSocket de sa guilde
 */
router.post("/ws/leave-room", async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.body;

    if (!guildId) {
      res.status(400).json({
        error: "Guild ID is required",
        code: "GUILD_ID_REQUIRED"
      });
      return;
    }

    // Faire quitter la room WebSocket
    WebSocketService.leaveGuildRoom(req.userId!, guildId);

    res.json({
      message: "Left guild WebSocket room successfully",
      serverId: req.serverId,
      guildId
    });

  } catch (error: any) {
    console.error("Leave guild WebSocket room error:", error);
    res.status(500).json({ 
      error: "Failed to leave guild WebSocket room",
      code: "LEAVE_WS_ROOM_FAILED"
    });
  }
});

/**
 * GET /api/guilds/ws/stats
 * Obtenir les statistiques WebSocket des guildes
 */
router.get("/ws/stats", async (req: Request, res: Response): Promise<void> => {
  try {
    const wsStats = WebSocketService.getConnectionStats();

    res.json({
      message: "Guild WebSocket statistics retrieved successfully",
      serverId: req.serverId,
      websocketStats: wsStats
    });

  } catch (error: any) {
    console.error("Get WebSocket stats error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve WebSocket statistics",
      code: "GET_WS_STATS_FAILED"
    });
  }
});

// ===== ROUTES ADMINISTRATIVES =====

/**
 * POST /api/guilds/admin/maintenance/:serverId
 * Exécuter maintenance manuelle pour un serveur (admin only)
 */
router.post("/admin/maintenance/:serverId", async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification des permissions admin
    const { serverId } = req.params;
    const { type = "daily" } = req.body;

    let result;
    if (type === "daily") {
      await GuildManagementService.performDailyMaintenance(serverId);
      result = { type: "daily", message: "Daily maintenance completed" };
    } else if (type === "weekly") {
      await GuildManagementService.performWeeklyMaintenance(serverId);
      result = { type: "weekly", message: "Weekly maintenance completed" };
    } else {
      res.status(400).json({
        error: "Invalid maintenance type",
        code: "INVALID_MAINTENANCE_TYPE",
        validTypes: ["daily", "weekly"]
      });
      return;
    }

    res.json({
      message: "Guild maintenance completed successfully",
      serverId,
      maintenanceType: result.type,
      details: result.message
    });

  } catch (error: any) {
    console.error("Guild maintenance error:", error);
    res.status(500).json({ 
      error: "Failed to execute guild maintenance",
      code: "MAINTENANCE_FAILED"
    });
  }
});

/**
 * GET /api/guilds/admin/global-stats
 * Obtenir les statistiques globales des guildes (admin only)
 */
router.get("/admin/global-stats", async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification des permissions admin
    const servers = ['S1', 'S2', 'S3']; // À adapter selon votre configuration
    const globalStats = [];

    for (const serverId of servers) {
      const serverStats = await GuildSearchService.getServerStatistics(serverId);
      globalStats.push({
        serverId,
        ...serverStats
      });
    }

    res.json({
      message: "Global guild statistics retrieved successfully",
      globalStats,
      timestamp: new Date()
    });

  } catch (error: any) {
    console.error("Get global guild stats error:", error);
    res.status(500).json({ 
      error: "Failed to retrieve global guild statistics",
      code: "GET_GLOBAL_STATS_FAILED"
    });
  }
});

/**
 * GET /api/guilds/health
 * Vérifier la santé du système de guildes
 */
router.get("/health", async (req: Request, res: Response): Promise<void> => {
  try {
    const serverStats = await GuildSearchService.getServerStatistics(req.serverId!);
    const wsStats = WebSocketService.getConnectionStats();

    const healthCheck = {
      status: "healthy",
      timestamp: new Date(),
      system: "GuildSystem",
      version: "2.0.0",
      server: req.serverId,
      stats: {
        guilds: serverStats,
        websocket: wsStats.modules.guild,
        connections: wsStats.totalConnections
      }
    };

    res.json(healthCheck);

  } catch (error: any) {
    console.error("Guild health check error:", error);
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date(),
      system: "GuildSystem",
      serverId: req.serverId
    });
  }
});

export default router;

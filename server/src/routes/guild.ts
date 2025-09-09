// server/src/routes/guild.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { GuildManagementService } from '../services/guild/GuildManagementService';
import { GuildMemberService } from '../services/guild/GuildMemberService';
import { GuildActivityService } from '../services/guild/GuildActivityService';
import { GuildSearchService } from '../services/guild/GuildSearchService';

const router = Router();

// Middleware d'authentification pour toutes les routes
router.use(authenticateToken);

// ===== ROUTES DE GESTION DE GUILDE =====

/**
 * Créer une nouvelle guilde
 * POST /guild/create
 */
router.post('/create', async (req, res) => {
  try {
    const { name, tag, description, iconId, isPublic, language } = req.body;
    const { userId: creatorId, serverId } = req.user;

    if (!name || !tag) {
      return res.status(400).json({ 
        success: false, 
        error: "Name and tag are required",
        code: "MISSING_FIELDS"
      });
    }

    const result = await GuildManagementService.createGuild(creatorId, serverId, {
      name,
      tag,
      description,
      iconId,
      isPublic,
      language
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error creating guild:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Obtenir les détails d'une guilde
 * GET /guild/:guildId
 */
router.get('/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    const guild = await GuildManagementService.getGuildDetails(guildId);
    
    if (!guild) {
      return res.status(404).json({ 
        success: false, 
        error: "Guild not found" 
      });
    }

    res.json({ success: true, guild });
  } catch (error) {
    console.error('❌ Error getting guild details:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Mettre à jour les paramètres de guilde
 * PUT /guild/:guildId/settings
 */
router.put('/:guildId/settings', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId: playerId } = req.user;
    const settings = req.body;

    const result = await GuildManagementService.updateGuildSettings(guildId, playerId, settings);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error updating guild settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Dissoudre une guilde
 * DELETE /guild/:guildId
 */
router.delete('/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId: playerId } = req.user;
    const { reason } = req.body;

    const result = await GuildManagementService.disbandGuild(guildId, playerId, reason);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error disbanding guild:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===== ROUTES DE MEMBRES =====

/**
 * Candidater à une guilde
 * POST /guild/:guildId/apply
 */
router.post('/:guildId/apply', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId: playerId } = req.user;
    const { message } = req.body;

    const result = await GuildMemberService.applyToGuild(playerId, guildId, message);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error applying to guild:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Traiter une candidature
 * POST /guild/:guildId/applications/:applicantId/process
 */
router.post('/:guildId/applications/:applicantId/process', async (req, res) => {
  try {
    const { guildId, applicantId } = req.params;
    const { userId: processedBy } = req.user;
    const { action } = req.body; // "accept" | "reject"

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: "Action must be 'accept' or 'reject'" 
      });
    }

    const result = await GuildMemberService.processApplication(guildId, applicantId, action, processedBy);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error processing application:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Inviter un joueur
 * POST /guild/:guildId/invite
 */
router.post('/:guildId/invite', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId: invitedBy } = req.user;
    const { targetPlayerId } = req.body;

    const result = await GuildMemberService.invitePlayer(guildId, targetPlayerId, invitedBy);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error inviting player:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Traiter une invitation
 * POST /guild/:guildId/invitations/process
 */
router.post('/:guildId/invitations/process', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId: playerId } = req.user;
    const { action } = req.body; // "accept" | "decline"

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: "Action must be 'accept' or 'decline'" 
      });
    }

    const result = await GuildMemberService.processInvitation(playerId, guildId, action);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error processing invitation:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Quitter la guilde
 * POST /guild/leave
 */
router.post('/leave', async (req, res) => {
  try {
    const { userId: playerId } = req.user;

    const result = await GuildMemberService.leaveGuild(playerId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error leaving guild:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Exclure un membre
 * POST /guild/:guildId/members/:targetPlayerId/kick
 */
router.post('/:guildId/members/:targetPlayerId/kick', async (req, res) => {
  try {
    const { guildId, targetPlayerId } = req.params;
    const { userId: kickedBy } = req.user;

    const result = await GuildMemberService.kickMember(guildId, targetPlayerId, kickedBy);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error kicking member:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Promouvoir un membre
 * POST /guild/:guildId/members/:targetPlayerId/promote
 */
router.post('/:guildId/members/:targetPlayerId/promote', async (req, res) => {
  try {
    const { guildId, targetPlayerId } = req.params;
    const { userId: promotedBy } = req.user;
    const { newRole } = req.body; // "officer" | "leader"

    if (!['officer', 'leader'].includes(newRole)) {
      return res.status(400).json({ 
        success: false, 
        error: "Role must be 'officer' or 'leader'" 
      });
    }

    const result = await GuildMemberService.promoteMember(guildId, targetPlayerId, newRole, promotedBy);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error promoting member:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Rétrograder un membre
 * POST /guild/:guildId/members/:targetPlayerId/demote
 */
router.post('/:guildId/members/:targetPlayerId/demote', async (req, res) => {
  try {
    const { guildId, targetPlayerId } = req.params;
    const { userId: demotedBy } = req.user;

    const result = await GuildMemberService.demoteMember(guildId, targetPlayerId, demotedBy);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error demoting member:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===== ROUTES D'ACTIVITÉS =====

/**
 * Contribuer à la guilde
 * POST /guild/contribute
 */
router.post('/contribute', async (req, res) => {
  try {
    const { userId: playerId } = req.user;
    const { gold, materials } = req.body;

    const result = await GuildActivityService.contributeToGuild(playerId, { gold, materials });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error contributing to guild:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Obtenir le statut des quêtes
 * GET /guild/:guildId/quests
 */
router.get('/:guildId/quests', async (req, res) => {
  try {
    const { guildId } = req.params;

    const quests = await GuildActivityService.getGuildQuestProgress(guildId);
    res.json({ success: true, quests });
  } catch (error) {
    console.error('❌ Error getting guild quests:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Démarrer une quête
 * POST /guild/:guildId/quests/start
 */
router.post('/:guildId/quests/start', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { questType, questTemplate } = req.body;

    if (!['daily', 'weekly', 'special'].includes(questType)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid quest type" 
      });
    }

    const result = await GuildActivityService.startGuildQuest(guildId, questType, questTemplate);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error starting guild quest:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Obtenir le statut du raid
 * GET /guild/:guildId/raid
 */
router.get('/:guildId/raid', async (req, res) => {
  try {
    const { guildId } = req.params;

    const raid = await GuildActivityService.getRaidStatus(guildId);
    
    if (raid) {
      res.json({ success: true, raid });
    } else {
      res.json({ success: true, raid: null });
    }
  } catch (error) {
    console.error('❌ Error getting raid status:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Démarrer un raid
 * POST /guild/:guildId/raids/start
 */
router.post('/:guildId/raids/start', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { raidType, templateId, difficulty } = req.body;

    if (!['guild_boss', 'territory_war'].includes(raidType)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid raid type" 
      });
    }

    const result = await GuildActivityService.startGuildRaid(guildId, raidType, templateId, difficulty || 1);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error starting guild raid:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Rejoindre un raid
 * POST /guild/:guildId/raids/:raidId/join
 */
router.post('/:guildId/raids/:raidId/join', async (req, res) => {
  try {
    const { guildId, raidId } = req.params;
    const { userId: playerId } = req.user;

    const result = await GuildActivityService.joinGuildRaid(guildId, raidId, playerId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error joining guild raid:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Attaquer le boss de raid
 * POST /guild/:guildId/raids/:raidId/attack
 */
router.post('/:guildId/raids/:raidId/attack', async (req, res) => {
  try {
    const { guildId, raidId } = req.params;
    const { userId: playerId } = req.user;
    const { damage } = req.body;

    if (!damage || damage <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid damage amount" 
      });
    }

    const result = await GuildActivityService.attackRaidBoss(guildId, raidId, playerId, damage);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error attacking raid boss:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Réclamer les récompenses quotidiennes
 * POST /guild/:guildId/rewards/daily/claim
 */
router.post('/:guildId/rewards/daily/claim', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId: playerId } = req.user;

    const result = await GuildActivityService.claimDailyRewards(guildId, playerId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error claiming daily rewards:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Réclamer les récompenses hebdomadaires
 * POST /guild/:guildId/rewards/weekly/claim
 */
router.post('/:guildId/rewards/weekly/claim', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId: playerId } = req.user;

    const result = await GuildActivityService.claimWeeklyRewards(guildId, playerId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error claiming weekly rewards:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===== ROUTES DE RECHERCHE =====

/**
 * Rechercher des guildes
 * GET /guild/search
 */
router.get('/search', async (req, res) => {
  try {
    const { serverId } = req.user;
    const { 
      name, 
      tag, 
      minLevel, 
      maxLevel, 
      minMembers, 
      maxMembers,
      minPower,
      maxPower,
      language,
      hasSpace,
      isPublic,
      page = 1,
      limit = 20
    } = req.query;

    const filters = {
      name: name as string,
      tag: tag as string,
      minLevel: minLevel ? parseInt(minLevel as string) : undefined,
      maxLevel: maxLevel ? parseInt(maxLevel as string) : undefined,
      minMembers: minMembers ? parseInt(minMembers as string) : undefined,
      maxMembers: maxMembers ? parseInt(maxMembers as string) : undefined,
      minPower: minPower ? parseInt(minPower as string) : undefined,
      maxPower: maxPower ? parseInt(maxPower as string) : undefined,
      language: language as string,
      hasSpace: hasSpace === 'true',
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined
    };

    const result = await GuildSearchService.searchGuilds(
      serverId, 
      filters, 
      parseInt(page as string), 
      parseInt(limit as string)
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error searching guilds:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Obtenir le classement des guildes
 * GET /guild/leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { serverId } = req.user;
    const { type = 'power', limit = 100 } = req.query;

    if (!['level', 'power', 'members'].includes(type as string)) {
      return res.status(400).json({ 
        success: false, 
        error: "Type must be 'level', 'power', or 'members'" 
      });
    }

    const leaderboard = await GuildSearchService.getGuildLeaderboard(
      serverId, 
      type as any, 
      parseInt(limit as string)
    );

    res.json({ success: true, leaderboard });
  } catch (error) {
    console.error('❌ Error getting guild leaderboard:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Obtenir les recommandations de guildes
 * GET /guild/recommendations
 */
router.get('/recommendations', async (req, res) => {
  try {
    const { serverId, userId: playerId } = req.user;
    const { limit = 10 } = req.query;

    // Il faudrait récupérer les infos du joueur pour les recommandations
    // Pour l'instant, on utilise des valeurs par défaut
    const recommendations = await GuildSearchService.getRecommendedGuilds(
      serverId,
      50, // playerLevel par défaut
      10000, // playerPower par défaut
      'en', // language par défaut
      parseInt(limit as string)
    );

    res.json({ success: true, recommendations });
  } catch (error) {
    console.error('❌ Error getting guild recommendations:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Obtenir les informations de guilde du joueur
 * GET /guild/my-info
 */
router.get('/my-info', async (req, res) => {
  try {
    const { userId: playerId } = req.user;

    const info = await GuildMemberService.getPlayerGuildInfo(playerId);
    res.json({ success: true, ...info });
  } catch (error) {
    console.error('❌ Error getting player guild info:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Vérifier si le joueur peut rejoindre une guilde
 * GET /guild/:guildId/can-join
 */
router.get('/:guildId/can-join', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId: playerId } = req.user;

    const result = await GuildMemberService.canPlayerJoinGuild(playerId, guildId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error checking if player can join guild:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Obtenir l'historique d'activité de la guilde
 * GET /guild/:guildId/activity
 */
router.get('/:guildId/activity', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { limit = 50 } = req.query;

    const activities = await GuildManagementService.getGuildActivityLogs(
      guildId, 
      parseInt(limit as string)
    );

    res.json({ success: true, activities });
  } catch (error) {
    console.error('❌ Error getting guild activity:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

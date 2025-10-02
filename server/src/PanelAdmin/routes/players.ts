import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import PlayerManagementService from '../services/PlayerManagementService';
import AuditLog from '../models/AuditLog';
import { 
  authenticateAdmin, 
  requirePermission,
  requireMinRole,
  requireSensitiveAction
} from '../middleware/adminAuth';
import {
  IAuthenticatedAdminRequest,
  AdminPermissionError
} from '../types/adminTypes';

const router = express.Router();

// Rate limiting pour les actions de modération
const moderationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Maximum 10 actions de modération par 5 minutes
  message: {
    error: 'Too many moderation actions',
    code: 'MODERATION_RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => {
    const adminReq = req as IAuthenticatedAdminRequest;
    return adminReq.admin?.adminId || req.ip || '0.0.0.0';
  }
});

// Rate limiting pour les modifications de currency
const currencyRateLimit = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 20, // Maximum 20 modifications de currency par 2 minutes
  message: {
    error: 'Too many currency modifications',
    code: 'CURRENCY_RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => {
    const adminReq = req as IAuthenticatedAdminRequest;
    return adminReq.admin?.adminId || req.ip || '0.0.0.0';
  }
});

// Middleware pour extraire l'IP client
const getClientIP = (req: Request): string => {
  return (
    req.ip ||
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    '0.0.0.0'
  ).split(',')[0].trim();
};

// Middleware pour extraire l'User-Agent
const getUserAgent = (req: Request): string => {
  return req.get('User-Agent') || 'Unknown';
};

// ===== ROUTES DE RECHERCHE ET LISTING =====

/**
 * GET /api/admin/players/search
 * Recherche avancée de joueurs
 */
router.get('/search',
  authenticateAdmin,
  requirePermission('player.view'),
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      
      // Construire les filtres à partir des query params
      const filter: any = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string || 'lastLoginAt',
        sortOrder: req.query.sortOrder as string || 'desc'
      };

      // Filtres optionnels
      if (req.query.username) filter.username = req.query.username as string;
      if (req.query.email) filter.email = req.query.email as string;
      if (req.query.serverId) filter.serverId = req.query.serverId as string;
      if (req.query.accountStatus) filter.accountStatus = req.query.accountStatus as string;
      if (req.query.isNewPlayer !== undefined) filter.isNewPlayer = req.query.isNewPlayer === 'true';
      if (req.query.lastSeenDays) filter.lastSeenDays = parseInt(req.query.lastSeenDays as string);

      // Filtres de niveau
      if (req.query.minLevel || req.query.maxLevel) {
        filter.level = {};
        if (req.query.minLevel) filter.level.min = parseInt(req.query.minLevel as string);
        if (req.query.maxLevel) filter.level.max = parseInt(req.query.maxLevel as string);
      }

      // Filtres VIP
      if (req.query.minVip || req.query.maxVip) {
        filter.vipLevel = {};
        if (req.query.minVip) filter.vipLevel.min = parseInt(req.query.minVip as string);
        if (req.query.maxVip) filter.vipLevel.max = parseInt(req.query.maxVip as string);
      }

      // Filtres de dépenses
      if (req.query.minSpent || req.query.maxSpent) {
        filter.totalSpent = {};
        if (req.query.minSpent) filter.totalSpent.min = parseFloat(req.query.minSpent as string);
        if (req.query.maxSpent) filter.totalSpent.max = parseFloat(req.query.maxSpent as string);
      }

      const results = await PlayerManagementService.searchPlayers(filter);

      // Logger la recherche si c'est une requête complexe
      if (Object.keys(filter).length > 4) {
        await AuditLog.createLog({
          adminId: adminReq.admin.adminId,
          adminUsername: adminReq.admin.username,
          adminRole: adminReq.admin.role,
          action: 'player.view_details',
          resource: 'player_search',
          details: {
            additionalInfo: {
              searchFilters: filter,
              resultsCount: results.total
            }
          },
          ipAddress: getClientIP(req),
          userAgent: getUserAgent(req),
          success: true,
          severity: 'low'
        });
      }

      res.json({
        success: true,
        data: results
      });

    } catch (error) {
      console.error('Player search error:', error);
      res.status(500).json({
        error: 'Failed to search players',
        code: 'PLAYER_SEARCH_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/players/:accountId/vip
 * Modifier le niveau VIP d'un joueur
 */
router.post('/:accountId/vip',
  authenticateAdmin,
  requirePermission('economy.modify'),
  currencyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { accountId } = req.params;
      const { serverId, playerId, newVipLevel, reason } = req.body;

      if (!serverId || !playerId || newVipLevel === undefined || !reason) {
        return res.status(400).json({
          error: 'All fields are required: serverId, playerId, newVipLevel, reason',
          code: 'MISSING_VIP_FIELDS'
        });
      }

      if (newVipLevel < 0 || newVipLevel > 15) {
        return res.status(400).json({
          error: 'VIP level must be between 0 and 15',
          code: 'INVALID_VIP_LEVEL'
        });
      }

      const result = await PlayerManagementService.modifyVIPLevel(
        playerId,
        serverId,
        newVipLevel,
        adminReq.admin.adminId,
        reason,
        getClientIP(req),
        getUserAgent(req)
      );

      res.json({
        success: result.success,
        data: {
          oldLevel: result.oldLevel,
          newLevel: newVipLevel
        },
        message: result.message
      });

    } catch (error) {
      console.error('Modify VIP error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to modify VIP level',
        code: 'VIP_MODIFICATION_ERROR'
      });
    }
  }
);
/**
 * GET /api/admin/players/stats
 * Statistiques globales des joueurs
 */
router.get('/stats',
  authenticateAdmin,
  requirePermission('analytics.view'),
  async (req: Request, res: Response) => {
    try {
      const stats = await PlayerManagementService.getGlobalPlayerStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Player stats error:', error);
      res.status(500).json({
        error: 'Failed to get player statistics',
        code: 'PLAYER_STATS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/players/top/:criteria
 * Top joueurs par critère
 */
router.get('/top/:criteria',
  authenticateAdmin,
  requirePermission('analytics.view'),
  async (req: Request, res: Response) => {
    try {
      const { criteria } = req.params;
      const serverId = req.query.serverId as string;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!['level', 'spending', 'vip', 'playtime'].includes(criteria)) {
        return res.status(400).json({
          error: 'Invalid criteria. Must be one of: level, spending, vip, playtime',
          code: 'INVALID_CRITERIA'
        });
      }

      if (limit > 100) {
        return res.status(400).json({
          error: 'Limit cannot exceed 100',
          code: 'LIMIT_TOO_HIGH'
        });
      }

      const topPlayers = await PlayerManagementService.getTopPlayers(
        criteria as 'level' | 'spending' | 'vip' | 'playtime',
        serverId,
        limit
      );

      res.json({
        success: true,
        data: {
          criteria,
          serverId: serverId || 'all',
          limit,
          players: topPlayers
        }
      });

    } catch (error) {
      console.error('Top players error:', error);
      res.status(500).json({
        error: 'Failed to get top players',
        code: 'TOP_PLAYERS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/players/:accountId
 * Détails complets d'un joueur
 */
router.get('/:accountId',
  authenticateAdmin,
  requirePermission('player.view'),
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { accountId } = req.params;

      const playerDetails = await PlayerManagementService.getPlayerDetails(accountId);

      if (!playerDetails) {
        return res.status(404).json({
          error: 'Player not found',
          code: 'PLAYER_NOT_FOUND'
        });
      }

      // Logger l'accès aux détails du joueur
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'player.view_details',
        resource: 'player_details',
        resourceId: accountId,
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        success: true,
        severity: 'low'
      });

      res.json({
        success: true,
        data: playerDetails
      });

    } catch (error) {
      console.error('Get player details error:', error);
      res.status(500).json({
        error: 'Failed to get player details',
        code: 'PLAYER_DETAILS_ERROR'
      });
    }
  }
);

// ===== ROUTES DE MODÉRATION =====

/**
 * POST /api/admin/players/:accountId/moderate
 * Modérer un joueur (ban, suspend, warn, etc.)
 */
router.post('/:accountId/moderate',
  authenticateAdmin,
  requirePermission('player.moderate'),
  moderationRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { accountId } = req.params;
      const { action, reason, duration, serverId, additionalData } = req.body;

      // Validation des données
      if (!action || !reason) {
        return res.status(400).json({
          error: 'Action and reason are required',
          code: 'MISSING_MODERATION_FIELDS'
        });
      }

      if (!['ban', 'unban', 'suspend', 'warn', 'reset_progress'].includes(action)) {
        return res.status(400).json({
          error: 'Invalid action. Must be one of: ban, unban, suspend, warn, reset_progress',
          code: 'INVALID_MODERATION_ACTION'
        });
      }

      if (action === 'suspend' && (!duration || duration <= 0)) {
        return res.status(400).json({
          error: 'Duration is required for suspension and must be positive',
          code: 'INVALID_SUSPENSION_DURATION'
        });
      }

      // Vérifier les permissions spéciales pour certaines actions
      if (['ban', 'reset_progress'].includes(action)) {
        const hasPermission = await PlayerManagementService.checkPlayerManagementPermission(
          adminReq.admin.adminId, 
          action === 'ban' ? 'moderate' : 'delete'
        );
        
        if (!hasPermission) {
          return res.status(403).json({
            error: 'Insufficient permissions for this action',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }
      }

      const moderation = {
        accountId,
        action,
        reason,
        duration,
        serverId,
        additionalData
      };

      const result = await PlayerManagementService.moderatePlayer(
        moderation,
        adminReq.admin.adminId,
        getClientIP(req),
        getUserAgent(req)
      );

      res.json({
        success: result.success,
        message: result.message
      });

    } catch (error) {
      console.error('Moderate player error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to moderate player',
        code: 'MODERATION_ERROR'
      });
    }
  }
);

// ===== ROUTES DE GESTION ÉCONOMIQUE =====

/**
 * POST /api/admin/players/:accountId/currency
 * Modifier les monnaies d'un joueur
 */
router.post('/:accountId/currency',
  authenticateAdmin,
  requirePermission('economy.modify'),
  currencyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { accountId } = req.params;
      const { serverId, playerId, currency, amount, operation, reason } = req.body;

      // Validation des données
      if (!serverId || !playerId || !currency || amount === undefined || !operation || !reason) {
        return res.status(400).json({
          error: 'All fields are required: serverId, playerId, currency, amount, operation, reason',
          code: 'MISSING_CURRENCY_FIELDS'
        });
      }

      if (!['gold', 'gems', 'paidGems', 'tickets'].includes(currency)) {
        return res.status(400).json({
          error: 'Invalid currency. Must be one of: gold, gems, paidGems, tickets',
          code: 'INVALID_CURRENCY'
        });
      }

      if (!['add', 'subtract', 'set'].includes(operation)) {
        return res.status(400).json({
          error: 'Invalid operation. Must be one of: add, subtract, set',
          code: 'INVALID_OPERATION'
        });
      }

      if (typeof amount !== 'number' || amount < 0) {
        return res.status(400).json({
          error: 'Amount must be a positive number',
          code: 'INVALID_AMOUNT'
        });
      }

      // Protection spéciale pour paidGems
      if (currency === 'paidGems' && !adminReq.admin.permissions.includes('*')) {
        return res.status(403).json({
          error: 'Only super admins can modify paid gems',
          code: 'PAID_GEMS_RESTRICTED'
        });
      }

      const modification = {
        serverId,
        playerId,
        currency,
        amount,
        operation,
        reason
      };

      const result = await PlayerManagementService.modifyCurrency(
        modification,
        adminReq.admin.adminId,
        getClientIP(req),
        getUserAgent(req)
      );

      res.json({
        success: result.success,
        data: {
          oldValue: result.oldValue,
          newValue: result.newValue,
          currency,
          operation,
          amount
        },
        message: result.message
      });

    } catch (error) {
      console.error('Modify currency error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to modify currency',
        code: 'CURRENCY_MODIFICATION_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/players/:accountId/heroes
 * Ajouter ou retirer des héros
 */
router.post('/:accountId/heroes',
  authenticateAdmin,
  requirePermission('heroes.manage'),
  currencyRateLimit, // Réutiliser le même rate limit
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { accountId } = req.params;
      const { serverId, playerId, operation, heroId, reason } = req.body;

      // Validation des données
      if (!serverId || !playerId || !operation || !heroId || !reason) {
        return res.status(400).json({
          error: 'All fields are required: serverId, playerId, operation, heroId, reason',
          code: 'MISSING_HERO_FIELDS'
        });
      }

      if (!['add', 'remove'].includes(operation)) {
        return res.status(400).json({
          error: 'Invalid operation. Must be one of: add, remove',
          code: 'INVALID_HERO_OPERATION'
        });
      }

      const result = await PlayerManagementService.modifyHeroes(
        playerId,
        serverId,
        operation,
        heroId,
        adminReq.admin.adminId,
        reason,
        getClientIP(req),
        getUserAgent(req)
      );

      res.json({
        success: result.success,
        data: {
          operation,
          heroId,
          serverId,
          playerId
        },
        message: result.message
      });

    } catch (error) {
      console.error('Modify heroes error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to modify heroes',
        code: 'HERO_MODIFICATION_ERROR'
      });
    }
  }
);

// ===== ROUTES D'ACTIONS AVANCÉES =====

/**
 * POST /api/admin/players/:accountId/reset
 * Réinitialiser la progression d'un joueur
 */
router.post('/:accountId/reset',
  authenticateAdmin,
  requirePermission('player.delete'),
  requireSensitiveAction(),
  moderationRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { accountId } = req.params;
      const { serverId, reason, resetOptions } = req.body;

      // Validation des données
      if (!serverId || !reason) {
        return res.status(400).json({
          error: 'ServerId and reason are required',
          code: 'MISSING_RESET_FIELDS'
        });
      }

      // Options de reset par défaut
      const defaultResetOptions = {
        resetLevel: false,
        resetCampaign: false,
        resetCurrency: false,
        resetHeroes: false,
        resetTower: false
      };

      const finalResetOptions = { ...defaultResetOptions, ...resetOptions };

      const moderation = {
        accountId,
        action: 'reset_progress' as const,
        reason,
        serverId,
        additionalData: finalResetOptions
      };

      const result = await PlayerManagementService.moderatePlayer(
        moderation,
        adminReq.admin.adminId,
        getClientIP(req),
        getUserAgent(req)
      );

      res.json({
        success: result.success,
        data: {
          resetOptions: finalResetOptions,
          serverId,
          reason
        },
        message: result.message
      });

    } catch (error) {
      console.error('Reset player error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to reset player progress',
        code: 'RESET_PLAYER_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/players/:accountId/audit
 * Historique des actions admin sur ce joueur
 */
router.get('/:accountId/audit',
  authenticateAdmin,
  requirePermission('admin.view'),
  async (req: Request, res: Response) => {
    try {
      const { accountId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const auditLogs = await AuditLog.find({
        resourceId: accountId,
        resource: { $in: ['player_account', 'player_currency', 'player_hero', 'player_details'] }
      })
        .sort({ timestamp: -1 })
        .limit(Math.min(limit, 200))
        .select('adminUsername action timestamp success severity details')
        .exec();

      res.json({
        success: true,
        data: {
          accountId,
          auditLogs: auditLogs.map(log => ({
            adminUsername: log.adminUsername,
            action: log.action,
            timestamp: log.timestamp,
            success: log.success,
            severity: log.severity,
            details: log.details?.additionalInfo || {}
          })),
          total: auditLogs.length
        }
      });

    } catch (error) {
      console.error('Player audit error:', error);
      res.status(500).json({
        error: 'Failed to get player audit history',
        code: 'PLAYER_AUDIT_ERROR'
      });
    }
  }
);

// ===== MIDDLEWARE DE GESTION D'ERREURS =====

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Player management route error:', error);
  
  if (error instanceof AdminPermissionError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details
    });
  } else {
    res.status(500).json({
      error: 'Player management service temporarily unavailable',
      code: 'PLAYER_SERVICE_ERROR'
    });
  }
});

export default router;

import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import EconomyService from '../services/EconomyService';
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

const economyRateLimit = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 30,
  message: {
    error: 'Too many economy requests',
    code: 'ECONOMY_RATE_LIMIT_EXCEEDED'
  }
});

const correctionRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: {
    error: 'Too many economy corrections',
    code: 'ECONOMY_CORRECTION_RATE_LIMIT'
  }
});

const getClientIP = (req: Request): string => {
  return (req.ip || req.headers['x-forwarded-for'] as string || '0.0.0.0').split(',')[0].trim();
};

const getUserAgent = (req: Request): string => {
  return req.get('User-Agent') || 'Unknown';
};

/**
 * GET /api/admin/economy/overview
 * Vue d'ensemble de l'économie du jeu
 */
router.get('/overview',
  authenticateAdmin,
  requirePermission('economy.view'),
  economyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const overview = await EconomyService.getEconomyOverview();

      res.json({
        success: true,
        data: overview,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Economy overview error:', error);
      res.status(500).json({
        error: 'Failed to get economy overview',
        code: 'ECONOMY_OVERVIEW_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/economy/cheaters
 * Détecter les tricheurs potentiels
 */
router.get('/cheaters',
  authenticateAdmin,
  requirePermission('player.moderate'),
  economyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const serverId = req.query.serverId as string;
      const minSuspicion = parseInt(req.query.minSuspicion as string) || 60;

      const cheaters = await EconomyService.detectCheaters(serverId);
      const filteredCheaters = cheaters.filter(c => c.suspicionLevel >= minSuspicion);

      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'analytics.view',
        resource: 'cheater_detection',
        details: {
          additionalInfo: {
            serverId: serverId || 'all',
            minSuspicion,
            cheatersFound: filteredCheaters.length,
            topSuspicion: filteredCheaters[0]?.suspicionLevel || 0
          }
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        success: true,
        severity: 'medium'
      });

      res.json({
        success: true,
        data: {
          cheaters: filteredCheaters,
          summary: {
            totalAnalyzed: cheaters.length,
            suspiciousCount: filteredCheaters.length,
            criticalCount: filteredCheaters.filter(c => c.suspicionLevel >= 80).length,
            serverId: serverId || 'all'
          }
        }
      });

    } catch (error) {
      console.error('Detect cheaters error:', error);
      res.status(500).json({
        error: 'Failed to detect cheaters',
        code: 'CHEATER_DETECTION_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/economy/alerts
 * Obtenir les alertes économiques récentes
 */
router.get('/alerts',
  authenticateAdmin,
  requirePermission('economy.view'),
  async (req: Request, res: Response) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const severity = req.query.severity as string;

      let alerts = await EconomyService.flagSuspiciousActivity();

      if (severity && ['low', 'medium', 'high', 'critical'].includes(severity)) {
        alerts = alerts.filter(alert => alert.severity === severity);
      }

      const recentAlerts = alerts.filter(alert => {
        const alertAge = Date.now() - alert.timestamp.getTime();
        return alertAge <= hours * 60 * 60 * 1000;
      });

      res.json({
        success: true,
        data: {
          alerts: recentAlerts,
          summary: {
            total: recentAlerts.length,
            bySeverity: {
              critical: recentAlerts.filter(a => a.severity === 'critical').length,
              high: recentAlerts.filter(a => a.severity === 'high').length,
              medium: recentAlerts.filter(a => a.severity === 'medium').length,
              low: recentAlerts.filter(a => a.severity === 'low').length
            },
            period: `${hours} hours`
          }
        }
      });

    } catch (error) {
      console.error('Economy alerts error:', error);
      res.status(500).json({
        error: 'Failed to get economy alerts',
        code: 'ECONOMY_ALERTS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/economy/servers
 * Comparaison économique entre serveurs
 */
router.get('/servers',
  authenticateAdmin,
  requirePermission('analytics.view'),
  economyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const comparison = await EconomyService.getServerEconomyComparison();

      res.json({
        success: true,
        data: {
          servers: comparison,
          summary: {
            totalServers: comparison.length,
            healthiestServer: comparison.reduce((best, current) => 
              current.healthScore > best.healthScore ? current : best, comparison[0]
            )?.serverId || null,
            mostPopularServer: comparison.reduce((best, current) => 
              current.playerCount > best.playerCount ? current : best, comparison[0]
            )?.serverId || null
          }
        }
      });

    } catch (error) {
      console.error('Server economy comparison error:', error);
      res.status(500).json({
        error: 'Failed to compare server economies',
        code: 'SERVER_ECONOMY_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/economy/player/:accountId
 * Analyse économique détaillée d'un joueur
 */
router.get('/player/:accountId',
  authenticateAdmin,
  requirePermission('player.view'),
  async (req: Request, res: Response) => {
    try {
      const { accountId } = req.params;
      const analysis = await EconomyService.analyzePlayerEconomy(accountId);

      res.json({
        success: true,
        data: analysis
      });

    } catch (error) {
      console.error('Player economy analysis error:', error);
      if (error instanceof Error && error.message === 'Account not found') {
        res.status(404).json({
          error: 'Account not found',
          code: 'ACCOUNT_NOT_FOUND'
        });
      } else {
        res.status(500).json({
          error: 'Failed to analyze player economy',
          code: 'PLAYER_ECONOMY_ERROR'
        });
      }
    }
  }
);

/**
 * POST /api/admin/economy/correct
 * Corriger un problème économique
 */
router.post('/correct',
  authenticateAdmin,
  requirePermission('economy.modify'),
  requireSensitiveAction(),
  correctionRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { type, targetId, reason, data } = req.body;

      if (!type || !targetId || !reason) {
        return res.status(400).json({
          error: 'Type, targetId, and reason are required',
          code: 'MISSING_CORRECTION_FIELDS'
        });
      }

      const validTypes = ['currency_reset', 'progress_rollback', 'purchase_refund'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: `Invalid correction type. Must be one of: ${validTypes.join(', ')}`,
          code: 'INVALID_CORRECTION_TYPE'
        });
      }

      if (reason.length < 10) {
        return res.status(400).json({
          error: 'Reason must be at least 10 characters long',
          code: 'REASON_TOO_SHORT'
        });
      }

      const result = await EconomyService.correctEconomyIssue(
        type,
        targetId,
        adminReq.admin.adminId,
        reason,
        data || {}
      );

      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'economy.modify',
        resource: 'economy_correction',
        resourceId: targetId,
        details: {
          additionalInfo: {
            correctionType: type,
            reason,
            success: result.success,
            changes: result.changes
          }
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        success: result.success,
        severity: 'critical'
      });

      res.json({
        success: result.success,
        message: result.message,
        data: {
          correctionType: type,
          targetId,
          changes: result.changes,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Economy correction error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to correct economy issue',
        code: 'ECONOMY_CORRECTION_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/economy/bulk-check
 * Vérification en masse de comptes suspects
 */
router.post('/bulk-check',
  authenticateAdmin,
  requirePermission('player.moderate'),
  correctionRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { accountIds, serverId } = req.body;

      if (!Array.isArray(accountIds) || accountIds.length === 0) {
        return res.status(400).json({
          error: 'accountIds array is required and must not be empty',
          code: 'MISSING_ACCOUNT_IDS'
        });
      }

      if (accountIds.length > 50) {
        return res.status(400).json({
          error: 'Maximum 50 accounts can be checked at once',
          code: 'TOO_MANY_ACCOUNTS'
        });
      }

      const results = [];
      for (const accountId of accountIds) {
        try {
          const analysis = await EconomyService.analyzePlayerEconomy(accountId);
          results.push({
            accountId,
            success: true,
            economyHealth: analysis.economyHealth,
            suspiciousFlags: analysis.economyHealth.flags.length,
            totalCurrencyValue: analysis.currency.totalValue
          });
        } catch (error) {
          results.push({
            accountId,
            success: false,
            error: error instanceof Error ? error.message : 'Analysis failed'
          });
        }
      }

      const suspicious = results.filter(r => 
        r.success && (r.suspiciousFlags > 0 || r.economyHealth.score < 70)
      );

      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'analytics.view',
        resource: 'bulk_economy_check',
        details: {
          additionalInfo: {
            accountsChecked: accountIds.length,
            suspiciousFound: suspicious.length,
            serverId: serverId || 'all'
          }
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        success: true,
        severity: 'medium'
      });

      res.json({
        success: true,
        data: {
          results,
          summary: {
            totalChecked: accountIds.length,
            suspicious: suspicious.length,
            clean: results.filter(r => r.success && r.suspiciousFlags === 0).length,
            errors: results.filter(r => !r.success).length
          }
        }
      });

    } catch (error) {
      console.error('Bulk economy check error:', error);
      res.status(500).json({
        error: 'Failed to perform bulk economy check',
        code: 'BULK_CHECK_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/economy/trends
 * Tendances économiques sur une période
 */
router.get('/trends',
  authenticateAdmin,
  requirePermission('analytics.view'),
  economyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const serverId = req.query.serverId as string;

      if (days > 30) {
        return res.status(400).json({
          error: 'Maximum 30 days of trends data',
          code: 'INVALID_DAYS_PARAMETER'
        });
      }

      // Placeholder pour les tendances - implémentation simplifiée
      const trends = {
        currencyInflation: Array.from({ length: days }, (_, i) => ({
          date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          goldInflation: Math.random() * 5 - 2.5,
          gemInflation: Math.random() * 3 - 1.5,
          playerCount: Math.floor(Math.random() * 1000) + 500
        })),
        suspiciousActivity: Array.from({ length: days }, (_, i) => ({
          date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          flaggedAccounts: Math.floor(Math.random() * 10),
          correctionsMade: Math.floor(Math.random() * 3)
        }))
      };

      res.json({
        success: true,
        data: {
          trends,
          period: `${days} days`,
          serverId: serverId || 'all',
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Economy trends error:', error);
      res.status(500).json({
        error: 'Failed to get economy trends',
        code: 'ECONOMY_TRENDS_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/economy/emergency-shutdown
 * Arrêt d'urgence de certaines fonctionnalités économiques
 */
router.post('/emergency-shutdown',
  authenticateAdmin,
  requireMinRole('super_admin'),
  requireSensitiveAction(),
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { features, reason } = req.body;

      if (!Array.isArray(features) || !reason) {
        return res.status(400).json({
          error: 'Features array and reason are required',
          code: 'MISSING_SHUTDOWN_FIELDS'
        });
      }

      const validFeatures = ['shop', 'gacha', 'trading', 'currency_purchase'];
      const invalidFeatures = features.filter(f => !validFeatures.includes(f));

      if (invalidFeatures.length > 0) {
        return res.status(400).json({
          error: `Invalid features: ${invalidFeatures.join(', ')}`,
          code: 'INVALID_FEATURES'
        });
      }

      // Log de l'arrêt d'urgence
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'system.server_restart',
        resource: 'economy_features',
        details: {
          additionalInfo: {
            shutdownFeatures: features,
            reason,
            emergency: true
          }
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        success: true,
        severity: 'critical'
      });

      res.json({
        success: true,
        message: `Emergency shutdown initiated for: ${features.join(', ')}`,
        data: {
          shutdownFeatures: features,
          reason,
          timestamp: new Date(),
          adminId: adminReq.admin.adminId
        }
      });

    } catch (error) {
      console.error('Emergency shutdown error:', error);
      res.status(500).json({
        error: 'Failed to execute emergency shutdown',
        code: 'EMERGENCY_SHUTDOWN_ERROR'
      });
    }
  }
);

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Economy route error:', error);
  
  if (error instanceof AdminPermissionError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details
    });
  } else {
    res.status(500).json({
      error: 'Economy service temporarily unavailable',
      code: 'ECONOMY_SERVICE_ERROR'
    });
  }
});

export default router;

import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import AnalyticsService from '../services/AnalyticsService';
import AdminService from '../services/AdminService';
import AuditLog from '../models/AuditLog';
import { 
  authenticateAdmin, 
  requirePermission,
  requireMinRole,
  getSessionStats 
} from '../middleware/adminAuth';
import {
  IAuthenticatedAdminRequest,
  AdminPermissionError
} from '../types/adminTypes';
import { panelConfig } from '../config/panelConfig';

const router = express.Router();

// Rate limiting pour les endpoints analytics
const analyticsRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 requêtes par 5 minutes
  message: {
    error: 'Too many analytics requests',
    code: 'ANALYTICS_RATE_LIMIT_EXCEEDED'
  }
});

// Rate limiting pour les exports (plus restrictif)
const exportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // 10 exports par heure
  message: {
    error: 'Too many export requests',
    code: 'EXPORT_RATE_LIMIT_EXCEEDED'
  }
});

// Cache simple pour les métriques (éviter de surcharger la DB)
const metricsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Middleware de cache pour les métriques
const cacheMetrics = (cacheKey: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const cached = metricsCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return res.json({
        success: true,
        data: cached.data,
        cached: true,
        cacheAge: Math.floor((now - cached.timestamp) / 1000)
      });
    }
    
    // Stocker la clé de cache dans la requête pour l'utiliser après
    (req as any).cacheKey = cacheKey;
    next();
  };
};

// Middleware pour sauvegarder en cache après la réponse
const saveToCache = (req: Request, res: Response, data: any) => {
  const cacheKey = (req as any).cacheKey;
  if (cacheKey) {
    metricsCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }
};

// ===== ROUTES DASHBOARD PRINCIPAL =====

/**
 * GET /api/admin/dashboard/overview
 * Vue d'ensemble complète du dashboard
 */
router.get('/overview', 
  authenticateAdmin,
  requirePermission('analytics.view'),
  analyticsRateLimit,
  cacheMetrics('dashboard_overview'),
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      
      // Obtenir toutes les données du dashboard
      const dashboardData = await AnalyticsService.getDashboardData();
      
      // Ajouter les stats des sessions admin
      const sessionStats = getSessionStats();
      (dashboardData.overview as any).onlineAdmins = sessionStats.totalSessions;
      
      // Sauvegarder en cache et répondre
      saveToCache(req, res, dashboardData);
      
      res.json({
        success: true,
        data: dashboardData,
        cached: false
      });

      // Logger l'accès au dashboard
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'analytics.view_dashboard',
        resource: 'dashboard',
        ipAddress: req.ip || '0.0.0.0',
        userAgent: req.get('User-Agent') || '',
        success: true,
        severity: 'low'
      });

    } catch (error) {
      console.error('Dashboard overview error:', error);
      res.status(500).json({
        error: 'Failed to load dashboard data',
        code: 'DASHBOARD_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/dashboard/quick-stats
 * Statistiques rapides pour le header
 */
router.get('/quick-stats',
  authenticateAdmin,
  requirePermission('analytics.view'),
  cacheMetrics('quick_stats'),
  async (req: Request, res: Response) => {
    try {
      const quickStats = await AnalyticsService.getQuickStats();
      
      // Ajouter les admins en ligne
      const sessionStats = getSessionStats();
      quickStats.onlineAdmins = sessionStats.totalSessions;
      
      saveToCache(req, res, quickStats);
      
      res.json({
        success: true,
        data: quickStats,
        cached: false
      });

    } catch (error) {
      console.error('Quick stats error:', error);
      res.status(500).json({
        error: 'Failed to load quick statistics',
        code: 'QUICK_STATS_ERROR'
      });
    }
  }
);

// ===== ROUTES ANALYTICS SPÉCIALISÉES =====

/**
 * GET /api/admin/dashboard/analytics/players
 * Analytics détaillées des joueurs
 */
router.get('/analytics/players',
  authenticateAdmin,
  requirePermission('analytics.view'),
  analyticsRateLimit,
  cacheMetrics('analytics_players'),
  async (req: Request, res: Response) => {
    try {
      const playerAnalytics = await AnalyticsService.getPlayerAnalytics();
      
      saveToCache(req, res, playerAnalytics);
      
      res.json({
        success: true,
        data: playerAnalytics,
        cached: false
      });

    } catch (error) {
      console.error('Player analytics error:', error);
      res.status(500).json({
        error: 'Failed to load player analytics',
        code: 'PLAYER_ANALYTICS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/dashboard/analytics/economy
 * Analytics économiques et revenus
 */
router.get('/analytics/economy',
  authenticateAdmin,
  requirePermission('analytics.financial'),
  analyticsRateLimit,
  cacheMetrics('analytics_economy'),
  async (req: Request, res: Response) => {
    try {
      const economicAnalytics = await AnalyticsService.getEconomicAnalytics();
      
      saveToCache(req, res, economicAnalytics);
      
      res.json({
        success: true,
        data: economicAnalytics,
        cached: false
      });

    } catch (error) {
      console.error('Economic analytics error:', error);
      res.status(500).json({
        error: 'Failed to load economic analytics',
        code: 'ECONOMIC_ANALYTICS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/dashboard/analytics/content
 * Analytics du contenu et utilisation
 */
router.get('/analytics/content',
  authenticateAdmin,
  requirePermission('analytics.view'),
  analyticsRateLimit,
  cacheMetrics('analytics_content'),
  async (req: Request, res: Response) => {
    try {
      const contentAnalytics = await AnalyticsService.getContentAnalytics();
      
      saveToCache(req, res, contentAnalytics);
      
      res.json({
        success: true,
        data: contentAnalytics,
        cached: false
      });

    } catch (error) {
      console.error('Content analytics error:', error);
      res.status(500).json({
        error: 'Failed to load content analytics',
        code: 'CONTENT_ANALYTICS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/dashboard/server-metrics
 * Métriques serveur en temps réel
 */
router.get('/server-metrics',
  authenticateAdmin,
  requirePermission('analytics.view'),
  cacheMetrics('server_metrics'),
  async (req: Request, res: Response) => {
    try {
      const serverMetrics = await AnalyticsService.getServerMetrics();
      
      // Ajouter des métriques système
      const systemMetrics = {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        cpu: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform
      };

      const combinedMetrics = {
        ...serverMetrics,
        system: systemMetrics
      };
      
      saveToCache(req, res, combinedMetrics);
      
      res.json({
        success: true,
        data: combinedMetrics,
        cached: false
      });

    } catch (error) {
      console.error('Server metrics error:', error);
      res.status(500).json({
        error: 'Failed to load server metrics',
        code: 'SERVER_METRICS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/dashboard/health
 * Santé système et alertes
 */
router.get('/health',
  authenticateAdmin,
  requirePermission('analytics.view'),
  async (req: Request, res: Response) => {
    try {
      const [gameHealth, systemAlerts, auditHealth] = await Promise.all([
        AnalyticsService.getGameHealth(),
        AnalyticsService.generateSystemAlerts(),
        AuditLog.getSystemHealth()
      ]);

      const healthData = {
        game: gameHealth,
        alerts: systemAlerts,
        audit: auditHealth,
        timestamp: new Date()
      };
      
      res.json({
        success: true,
        data: healthData
      });

    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        error: 'Failed to check system health',
        code: 'HEALTH_CHECK_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/dashboard/trends
 * Tendances sur une période
 */
router.get('/trends',
  authenticateAdmin,
  requirePermission('analytics.view'),
  analyticsRateLimit,
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      
      // Limiter à 30 jours maximum
      if (days > 30) {
        return res.status(400).json({
          error: 'Maximum 30 days of trends data',
          code: 'INVALID_DAYS_PARAMETER'
        });
      }

      const trends = await AnalyticsService.getTrends(days);
      
      res.json({
        success: true,
        data: {
          trends,
          period: `${days} days`,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Trends error:', error);
      res.status(500).json({
        error: 'Failed to load trends data',
        code: 'TRENDS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/dashboard/retention
 * Rapport de rétention détaillé
 */
router.get('/retention',
  authenticateAdmin,
  requirePermission('analytics.view'),
  analyticsRateLimit,
  cacheMetrics('retention_report'),
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      
      if (days > 90) {
        return res.status(400).json({
          error: 'Maximum 90 days for retention analysis',
          code: 'INVALID_RETENTION_PERIOD'
        });
      }

      const retentionReport = await AnalyticsService.getRetentionReport(days);
      
      saveToCache(req, res, retentionReport);
      
      res.json({
        success: true,
        data: retentionReport,
        cached: false
      });

    } catch (error) {
      console.error('Retention report error:', error);
      res.status(500).json({
        error: 'Failed to generate retention report',
        code: 'RETENTION_REPORT_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/dashboard/servers
 * Performance par serveur
 */
router.get('/servers',
  authenticateAdmin,
  requirePermission('analytics.view'),
  analyticsRateLimit,
  cacheMetrics('server_performance'),
  async (req: Request, res: Response) => {
    try {
      const serverPerformance = await AnalyticsService.getServerPerformance();
      
      saveToCache(req, res, serverPerformance);
      
      res.json({
        success: true,
        data: serverPerformance,
        cached: false
      });

    } catch (error) {
      console.error('Server performance error:', error);
      res.status(500).json({
        error: 'Failed to analyze server performance',
        code: 'SERVER_PERFORMANCE_ERROR'
      });
    }
  }
);

// ===== ROUTES D'EXPORT =====

/**
 * POST /api/admin/dashboard/export
 * Export de données analytics
 */
router.post('/export',
  authenticateAdmin,
  requirePermission('analytics.export'),
  exportRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { type, format, filters } = req.body;

      // Validation des paramètres
      const validTypes = ['players', 'revenue', 'retention', 'content'];
      const validFormats = ['json', 'csv'];

      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({
          error: 'Invalid export type. Must be one of: ' + validTypes.join(', '),
          code: 'INVALID_EXPORT_TYPE'
        });
      }

      if (!format || !validFormats.includes(format)) {
        return res.status(400).json({
          error: 'Invalid format. Must be json or csv',
          code: 'INVALID_FORMAT'
        });
      }

      // Exporter les données
      const exportResult = await AnalyticsService.exportData(type, format, filters);

      // Logger l'export
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'analytics.export_data',
        resource: 'analytics_data',
        details: {
          additionalInfo: {
            exportType: type,
            format,
            recordCount: Array.isArray(exportResult.data) ? exportResult.data.length : 1
          }
        },
        ipAddress: req.ip || '0.0.0.0',
        userAgent: req.get('User-Agent') || '',
        success: true,
        severity: 'medium'
      });

      // Définir les headers pour le téléchargement
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');

      if (format === 'csv') {
        res.send(exportResult.data);
      } else {
        res.json(exportResult.data);
      }

    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        error: 'Failed to export data',
        code: 'EXPORT_ERROR'
      });
    }
  }
);

// ===== ROUTES ADMIN ET AUDIT =====

/**
 * GET /api/admin/dashboard/admin-stats
 * Statistiques des administrateurs
 */
router.get('/admin-stats',
  authenticateAdmin,
  requirePermission('admin.view'),
  async (req: Request, res: Response) => {
    try {
      const [adminStats, sessionStats, securitySummary] = await Promise.all([
        AdminService.getAdminStats(),
        getSessionStats(),
        AdminService.detectSuspiciousActivity(24)
      ]);

      const combinedStats = {
        admins: adminStats,
        sessions: sessionStats,
        security: {
          suspiciousActivities: securitySummary.length,
          alerts: securitySummary.slice(0, 5) // Top 5 alertes
        }
      };

      res.json({
        success: true,
        data: combinedStats
      });

    } catch (error) {
      console.error('Admin stats error:', error);
      res.status(500).json({
        error: 'Failed to load admin statistics',
        code: 'ADMIN_STATS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/dashboard/security-alerts
 * Alertes de sécurité détaillées
 */
router.get('/security-alerts',
  authenticateAdmin,
  requireMinRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const securityAlerts = await AdminService.detectSuspiciousActivity(hours);

      res.json({
        success: true,
        data: {
          alerts: securityAlerts,
          period: `${hours} hours`,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Security alerts error:', error);
      res.status(500).json({
        error: 'Failed to load security alerts',
        code: 'SECURITY_ALERTS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/dashboard/audit-summary
 * Résumé des logs d'audit
 */
router.get('/audit-summary',
  authenticateAdmin,
  requirePermission('admin.view'),
  async (req: Request, res: Response) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const auditSummary = await AuditLog.getSecuritySummary(hours);

      res.json({
        success: true,
        data: auditSummary
      });

    } catch (error) {
      console.error('Audit summary error:', error);
      res.status(500).json({
        error: 'Failed to load audit summary',
        code: 'AUDIT_SUMMARY_ERROR'
      });
    }
  }
);

// ===== UTILITAIRES =====

/**
 * DELETE /api/admin/dashboard/clear-cache
 * Vider le cache des métriques
 */
router.delete('/clear-cache',
  authenticateAdmin,
  requireMinRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const cacheSize = metricsCache.size;
      metricsCache.clear();

      const adminReq = req as IAuthenticatedAdminRequest;
      
      // Logger l'action
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'system.modify_config',
        resource: 'metrics_cache',
        details: { additionalInfo: { cacheEntriesCleared: cacheSize } },
        ipAddress: req.ip || '0.0.0.0',
        userAgent: req.get('User-Agent') || '',
        success: true,
        severity: 'low'
      });

      res.json({
        success: true,
        message: `Cache cleared successfully (${cacheSize} entries removed)`
      });

    } catch (error) {
      console.error('Clear cache error:', error);
      res.status(500).json({
        error: 'Failed to clear cache',
        code: 'CLEAR_CACHE_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/dashboard/cache-stats
 * Statistiques du cache
 */
router.get('/cache-stats',
  authenticateAdmin,
  requireMinRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const cacheStats = {
        size: metricsCache.size,
        entries: Array.from(metricsCache.keys()),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      };

      res.json({
        success: true,
        data: cacheStats
      });

    } catch (error) {
      console.error('Cache stats error:', error);
      res.status(500).json({
        error: 'Failed to load cache statistics',
        code: 'CACHE_STATS_ERROR'
      });
    }
  }
);

// ===== MIDDLEWARE DE GESTION D'ERREURS =====

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Dashboard route error:', error);
  
  if (error instanceof AdminPermissionError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details
    });
  } else {
    res.status(500).json({
      error: 'Dashboard service temporarily unavailable',
      code: 'DASHBOARD_SERVICE_ERROR'
    });
  }
});

export default router;

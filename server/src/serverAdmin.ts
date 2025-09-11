import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { panelConfig, validateEnvironment } from './PanelAdmin/config/panelConfig';
import { cleanExpiredSessions } from './PanelAdmin/middleware/adminAuth';

// Import des routes admin
import authRoutes from './PanelAdmin/routes/auth';
import dashboardRoutes from './PanelAdmin/routes/dashboard';
import playersRoutes from './PanelAdmin/routes/players';
import economyRoutes from './PanelAdmin/routes/economy';
// Import des services pour l'initialisation
import AdminService from './PanelAdmin/services/AdminService';
import AnalyticsService from './PanelAdmin/services/AnalyticsService';
import Admin from './PanelAdmin/models/Admin';
import AuditLog from './PanelAdmin/models/AuditLog';

export class AdminPanelServer {
  private static initialized = false;

  /**
   * Initialiser le panel admin dans l'application Express principale
   */
  static setupAdminPanel(app: Application): void {
    try {
      console.log('🔧 Initializing Admin Panel...');

      // Validation de la configuration
      this.validateAdminEnvironment();

      // Configuration des middlewares admin
      this.setupAdminMiddlewares(app);

      // Configuration des routes admin
      this.setupAdminRoutes(app);

      // Initialisation des services admin
      this.initializeAdminServices();

      // Tâches de maintenance
      this.setupMaintenanceTasks();

      this.initialized = true;
      console.log('✅ Admin Panel initialized successfully');
      console.log(`📊 Admin Panel available at: /api/admin/*`);
      console.log(`🔐 Admin Auth: /api/admin/auth/*`);
      console.log(`📈 Admin Dashboard: /api/admin/dashboard/*`);

    } catch (error) {
      console.error('❌ Failed to initialize Admin Panel:', error);
      throw error;
    }
  }

  /**
   * Valider l'environnement pour le panel admin
   */
  private static validateAdminEnvironment(): void {
    try {
      validateEnvironment();
      console.log('✅ Admin environment validation passed');
    } catch (error) {
      console.error('❌ Admin environment validation failed:', error);
      throw new Error('Admin panel environment configuration is invalid');
    }
  }

  /**
   * Configuration des middlewares spécifiques au panel admin
   */
  private static setupAdminMiddlewares(app: Application): void {
    // CORS spécifique pour le panel admin
    const adminCorsOptions = {
      origin: panelConfig.server.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      optionsSuccessStatus: 200
    };

    // Sécurité renforcée pour le panel admin
    app.use('/api/admin', helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false // Pour compatibilité
    }));

    // CORS pour le panel admin
    app.use('/api/admin', cors(adminCorsOptions));

    // Parser de cookies pour les sessions admin
    app.use('/api/admin', cookieParser());
    
    // Routes de gestion économique
    app.use('/api/admin/economy', economyRoutes);
    
    // Rate limiting global pour le panel admin
    const adminGlobalRateLimit = rateLimit({
      windowMs: panelConfig.server.rateLimiting.windowMs,
      max: panelConfig.server.rateLimiting.maxRequests,
      message: {
        error: 'Too many requests to admin panel',
        code: 'ADMIN_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(panelConfig.server.rateLimiting.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Utiliser l'IP réelle
        return req.ip || 
               req.headers['x-forwarded-for'] as string || 
               req.headers['x-real-ip'] as string || 
               req.connection.remoteAddress || 
               '0.0.0.0';
      }
    });

    app.use('/api/admin', adminGlobalRateLimit);

    // Middleware de logging spécifique admin
    app.use('/api/admin', (req: Request, res: Response, next: NextFunction) => {
      const timestamp = new Date().toISOString();
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || 'Unknown';
      
      console.log(`[ADMIN] ${timestamp} ${req.method} ${req.originalUrl} - IP: ${ip}`);
      
      // Ajouter des headers de sécurité supplémentaires
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      next();
    });

    console.log('✅ Admin middlewares configured');
  }

  /**
   * Configuration des routes du panel admin
   */
  private static setupAdminRoutes(app: Application): void {
    // Route de santé spécifique au panel admin
    app.get('/api/admin/health', async (req: Request, res: Response) => {
      try {
        const healthCheck = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          panel: {
            version: '1.0.0',
            initialized: this.initialized
          },
          services: {
            authentication: 'operational',
            analytics: 'operational',
            audit: 'operational'
          },
          database: {
            admins: await Admin.countDocuments(),
            auditLogs: await AuditLog.countDocuments()
          }
        };

        res.json(healthCheck);
      } catch (error) {
        console.error('Admin health check error:', error);
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Service temporarily unavailable'
        });
      }
    });

    // Route d'information du panel admin
    app.get('/api/admin/info', (req: Request, res: Response) => {
      res.json({
        name: 'Idle Gacha Admin Panel',
        version: '1.0.0',
        description: 'Administrative interface for Idle Gacha game management',
        endpoints: {
          authentication: '/api/admin/auth/*',
          dashboard: '/api/admin/dashboard/*',
          health: '/api/admin/health'
        },
        features: [
          'User Authentication with 2FA',
          'Real-time Analytics Dashboard',
          'Player Management',
          'Economy Monitoring',
          'Audit Logging',
          'Security Alerts',
          'Data Export'
        ],
        timestamp: new Date().toISOString()
      });
    });

    // Routes d'authentification admin
    app.use('/api/admin/auth', authRoutes);

    // Routes du dashboard admin
    app.use('/api/admin/dashboard', dashboardRoutes);
    
    // Routes de gestion des joueurs
    app.use('/api/admin/players', playersRoutes);
    
    // Route 404 pour le panel admin
    app.use('/api/admin/*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Admin endpoint not found',
        code: 'ADMIN_ENDPOINT_NOT_FOUND',
        path: req.originalUrl,
        availableEndpoints: [
          '/api/admin/health',
          '/api/admin/info',
          '/api/admin/auth/*',
          '/api/admin/dashboard/*'
        ]
      });
    });

    console.log('✅ Admin routes configured');
  }

  /**
   * Initialiser les services admin
   */
  private static async initializeAdminServices(): Promise<void> {
    try {
      // Vérifier si un super admin existe, sinon créer un compte par défaut
      await this.ensureDefaultSuperAdmin();

      // Nettoyer les logs d'audit anciens si configuré
      if (panelConfig.database.enableAuditLog) {
        await this.cleanupOldAuditLogs();
      }

      console.log('✅ Admin services initialized');
    } catch (error) {
      console.error('⚠️ Warning: Admin services initialization partial failure:', error);
      // Ne pas faire échouer le démarrage pour des erreurs non critiques
    }
  }

  /**
   * S'assurer qu'un super admin existe
   */
  private static async ensureDefaultSuperAdmin(): Promise<void> {
    try {
      const superAdminCount = await Admin.countDocuments({ 
        role: 'super_admin', 
        isActive: true 
      });

      if (superAdminCount === 0) {
        console.log('🔧 No super admin found, creating default super admin...');
        
        const defaultAdmin = new Admin({
          username: process.env.DEFAULT_ADMIN_USERNAME || 'superadmin',
          email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@idlegacha.com',
          password: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!',
          role: 'super_admin',
          createdBy: 'system',
          metadata: {
            createdByIP: '127.0.0.1',
            preferredLanguage: 'en',
            timezone: 'UTC'
          }
        });

        await defaultAdmin.save();
        
        console.log('✅ Default super admin created');
        console.log(`📧 Username: ${defaultAdmin.username}`);
        console.log(`🔐 Email: ${defaultAdmin.email}`);
        console.log('⚠️  Please change the default password immediately!');
      } else {
        console.log(`✅ Found ${superAdminCount} super admin(s)`);
      }
    } catch (error) {
      console.error('❌ Failed to ensure default super admin:', error);
      throw error;
    }
  }

  /**
   * Nettoyer les logs d'audit anciens
   */
  private static async cleanupOldAuditLogs(): Promise<void> {
    try {
      const retentionDays = panelConfig.database.retentionDays;
      const cleanedCount = await AuditLog.cleanupOldLogs(retentionDays);
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} old audit logs (retention: ${retentionDays} days)`);
      }
    } catch (error) {
      console.error('⚠️ Warning: Audit log cleanup failed:', error);
    }
  }

  /**
   * Configuration des tâches de maintenance
   */
  private static setupMaintenanceTasks(): void {
    // Nettoyage des sessions expirées toutes les 10 minutes
    setInterval(() => {
      try {
        const cleaned = cleanExpiredSessions();
        if (cleaned > 0) {
          console.log(`🧹 [ADMIN] Cleaned ${cleaned} expired admin sessions`);
        }
      } catch (error) {
        console.error('⚠️ [ADMIN] Session cleanup error:', error);
      }
    }, 10 * 60 * 1000);

    // Nettoyage des logs d'audit une fois par jour (si activé)
    if (panelConfig.database.enableAuditLog) {
      setInterval(async () => {
        try {
          await this.cleanupOldAuditLogs();
        } catch (error) {
          console.error('⚠️ [ADMIN] Audit log cleanup error:', error);
        }
      }, 24 * 60 * 60 * 1000);
    }

    // Génération d'un rapport de santé quotidien
    setInterval(async () => {
      try {
        const health = await AnalyticsService.getGameHealth();
        console.log(`📊 [ADMIN] Daily Health Report - Overall Score: ${health.overallScore}/100`);
        
        if (health.overallScore < 60) {
          console.warn('⚠️ [ADMIN] Game health score is below 60, review needed');
        }
      } catch (error) {
        console.error('⚠️ [ADMIN] Health report generation error:', error);
      }
    }, 24 * 60 * 60 * 1000);

    console.log('✅ Admin maintenance tasks configured');
  }

  /**
   * Arrêt propre du panel admin
   */
  static async shutdown(): Promise<void> {
    try {
      console.log('🛑 Shutting down Admin Panel...');
      
      // Nettoyer les sessions actives
      const sessionsCleared = cleanExpiredSessions();
      console.log(`🧹 Cleared ${sessionsCleared} active admin sessions`);
      
      // Log de fermeture
      await AuditLog.createLog({
        adminId: 'system',
        adminUsername: 'system',
        adminRole: 'super_admin',
        action: 'system.server_restart',
        resource: 'admin_panel',
        ipAddress: '127.0.0.1',
        userAgent: 'System',
        success: true,
        severity: 'medium'
      });

      console.log('✅ Admin Panel shutdown completed');
    } catch (error) {
      console.error('❌ Error during Admin Panel shutdown:', error);
    }
  }

  /**
   * Obtenir le statut du panel admin
   */
  static getStatus(): {
    initialized: boolean;
    config: any;
    stats: any;
  } {
    return {
      initialized: this.initialized,
      config: {
        port: panelConfig.server.port,
        security: {
          requireTwoFactor: panelConfig.security.requireTwoFactor,
          sessionDuration: panelConfig.security.sessionDuration,
          allowedIPs: panelConfig.security.allowedIPs.length
        },
        features: {
          auditLog: panelConfig.database.enableAuditLog,
          metrics: panelConfig.monitoring.enableMetrics,
          backup: panelConfig.export.enableScheduledBackups
        }
      },
      stats: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      }
    };
  }
}

// Export de la fonction principale pour l'importation simple
export const setupAdminPanel = AdminPanelServer.setupAdminPanel.bind(AdminPanelServer);
export const shutdownAdminPanel = AdminPanelServer.shutdown.bind(AdminPanelServer);
export const getAdminPanelStatus = AdminPanelServer.getStatus.bind(AdminPanelServer);

// Export par défaut de la classe complète
export default AdminPanelServer;

import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import InventoryManagementService from '../services/InventoryManagementService';
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

// Rate limiting pour les actions d'inventaire
const inventoryRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // Maximum 30 requêtes par 5 minutes
  message: {
    error: 'Too many inventory requests',
    code: 'INVENTORY_RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => {
    const adminReq = req as IAuthenticatedAdminRequest;
    return adminReq.admin?.adminId || req.ip || '0.0.0.0';
  }
});

// Rate limiting pour les modifications (plus restrictif)
const modificationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // Maximum 10 modifications par 10 minutes
  message: {
    error: 'Too many inventory modifications',
    code: 'INVENTORY_MODIFICATION_RATE_LIMIT'
  },
  keyGenerator: (req) => {
    const adminReq = req as IAuthenticatedAdminRequest;
    return adminReq.admin?.adminId || req.ip || '0.0.0.0';
  }
});

// Middleware pour extraire l'IP client et User-Agent
const getClientIP = (req: Request): string => {
  return (
    req.ip ||
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    '0.0.0.0'
  ).split(',')[0].trim();
};

const getUserAgent = (req: Request): string => {
  return req.get('User-Agent') || 'Unknown';
};

// ===== ROUTES DE RECHERCHE ET LISTING =====

/**
 * GET /api/admin/inventory/search
 * Recherche avancée d'inventaires
 */
router.get('/search',
  authenticateAdmin,
  requirePermission('player.view'),
  inventoryRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      
      // Construction des filtres depuis les query params
      const filter: any = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string || 'lastSyncAt',
        sortOrder: req.query.sortOrder as string || 'desc'
      };

      // Filtres optionnels
      if (req.query.accountId) filter.accountId = req.query.accountId as string;
      if (req.query.serverId) filter.serverId = req.query.serverId as string;
      if (req.query.playerId) filter.playerId = req.query.playerId as string;
      
      // Filtres de monnaies
      if (req.query.minGold) filter.minGold = parseInt(req.query.minGold as string);
      if (req.query.maxGold) filter.maxGold = parseInt(req.query.maxGold as string);
      if (req.query.minGems) filter.minGems = parseInt(req.query.minGems as string);
      if (req.query.maxGems) filter.maxGems = parseInt(req.query.maxGems as string);
      
      // Filtres avancés
      if (req.query.hasItems) {
        filter.hasItems = Array.isArray(req.query.hasItems) ? 
          req.query.hasItems : [req.query.hasItems];
      }
      if (req.query.lastSyncDays) filter.lastSyncDays = parseInt(req.query.lastSyncDays as string);
      if (req.query.inventoryIssues) filter.inventoryIssues = req.query.inventoryIssues === 'true';

      const results = await InventoryManagementService.searchInventories(filter);

      // Logger la recherche si elle est complexe
      if (Object.keys(filter).length > 4) {
        await AuditLog.createLog({
          adminId: adminReq.admin.adminId,
          adminUsername: adminReq.admin.username,
          adminRole: adminReq.admin.role,
          action: 'analytics.view_dashboard',
          resource: 'inventory_search',
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
      console.error('Inventory search error:', error);
      res.status(500).json({
        error: 'Failed to search inventories',
        code: 'INVENTORY_SEARCH_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/inventory/stats
 * Statistiques globales des inventaires
 */
router.get('/stats',
  authenticateAdmin,
  requirePermission('analytics.view'),
  inventoryRateLimit,
  async (req: Request, res: Response) => {
    try {
      const stats = await InventoryManagementService.getInventoryStats();

      res.json({
        success: true,
        data: stats,
        generatedAt: new Date()
      });

    } catch (error) {
      console.error('Inventory stats error:', error);
      res.status(500).json({
        error: 'Failed to get inventory statistics',
        code: 'INVENTORY_STATS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/inventory/:playerId
 * Détails complets d'un inventaire
 */
router.get('/:playerId',
  authenticateAdmin,
  requirePermission('player.view'),
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { playerId } = req.params;
      const serverId = req.query.serverId as string;

      const inventoryDetails = await InventoryManagementService.getInventoryDetails(playerId, serverId);

      if (!inventoryDetails) {
        return res.status(404).json({
          error: 'Inventory not found',
          code: 'INVENTORY_NOT_FOUND'
        });
      }

      // Logger l'accès aux détails de l'inventaire
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'player.view_details',
        resource: 'player_inventory',
        resourceId: playerId,
        details: {
          additionalInfo: {
            serverId: serverId || 'any',
            healthScore: inventoryDetails.healthCheck.healthScore
          }
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        success: true,
        severity: 'low'
      });

      res.json({
        success: true,
        data: inventoryDetails
      });

    } catch (error) {
      console.error('Get inventory details error:', error);
      res.status(500).json({
        error: 'Failed to get inventory details',
        code: 'INVENTORY_DETAILS_ERROR'
      });
    }
  }
);

// ===== ROUTES DE MODIFICATION =====

/**
 * POST /api/admin/inventory/:playerId/modify
 * Modifier l'inventaire d'un joueur
 */
router.post('/:playerId/modify',
  authenticateAdmin,
  requirePermission('heroes.manage'),
  modificationRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { playerId } = req.params;
      const { serverId, operation, items, reason, targetCategory } = req.body;

      // Validation des données
      if (!serverId || !operation || !items || !reason) {
        return res.status(400).json({
          error: 'All fields are required: serverId, operation, items, reason',
          code: 'MISSING_MODIFICATION_FIELDS'
        });
      }

      if (!['add', 'remove', 'set'].includes(operation)) {
        return res.status(400).json({
          error: 'Invalid operation. Must be one of: add, remove, set',
          code: 'INVALID_OPERATION'
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          error: 'Items must be a non-empty array',
          code: 'INVALID_ITEMS_ARRAY'
        });
      }

      // Validation des items
      for (const item of items) {
        if (!item.itemId || typeof item.quantity !== 'number' || item.quantity < 0) {
          return res.status(400).json({
            error: 'Each item must have itemId and positive quantity',
            code: 'INVALID_ITEM_FORMAT'
          });
        }
      }

      if (reason.length < 10) {
        return res.status(400).json({
          error: 'Reason must be at least 10 characters long',
          code: 'REASON_TOO_SHORT'
        });
      }

      const modification = {
        playerId,
        serverId,
        operation,
        items,
        reason,
        targetCategory
      };

      const result = await InventoryManagementService.modifyInventory(
        modification,
        adminReq.admin.adminId,
        getClientIP(req),
        getUserAgent(req)
      );

      res.json({
        success: result.success,
        message: result.message,
        data: {
          operation,
          itemsModified: items.length,
          changes: result.changes,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Modify inventory error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to modify inventory',
        code: 'INVENTORY_MODIFICATION_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/inventory/:playerId/repair
 * Réparer automatiquement les problèmes d'inventaire
 */
router.post('/:playerId/repair',
  authenticateAdmin,
  requirePermission('player.manage'),
  requireSensitiveAction(),
  modificationRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { playerId } = req.params;
      const { serverId } = req.body;

      if (!serverId) {
        return res.status(400).json({
          error: 'ServerId is required',
          code: 'MISSING_SERVER_ID'
        });
      }

      const result = await InventoryManagementService.repairInventory(
        playerId,
        serverId,
        adminReq.admin.adminId,
        getClientIP(req),
        getUserAgent(req)
      );

      res.json({
        success: result.success,
        message: `Inventory repair completed: ${result.fixesApplied.length} fixes applied`,
        data: {
          fixesApplied: result.fixesApplied,
          remainingIssues: result.issues,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Repair inventory error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to repair inventory',
        code: 'INVENTORY_REPAIR_ERROR'
      });
    }
  }
);

// ===== ROUTES D'ANALYSE ET SÉCURITÉ =====

/**
 * GET /api/admin/inventory/suspicious
 * Détecter les inventaires suspects
 */
router.get('/suspicious',
  authenticateAdmin,
  requirePermission('player.moderate'),
  inventoryRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const serverId = req.query.serverId as string;
      const minSuspicion = parseInt(req.query.minSuspicion as string) || 60;

      const suspiciousInventories = await InventoryManagementService.detectSuspiciousInventories(serverId);
      const filtered = suspiciousInventories.filter(inv => inv.suspicionLevel >= minSuspicion);

      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'analytics.view_dashboard',
        resource: 'suspicious_inventories',
        details: {
          additionalInfo: {
            serverId: serverId || 'all',
            minSuspicion,
            suspiciousFound: filtered.length,
            topSuspicion: filtered[0]?.suspicionLevel || 0
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
          suspiciousInventories: filtered,
          summary: {
            totalAnalyzed: suspiciousInventories.length,
            suspiciousCount: filtered.length,
            criticalCount: filtered.filter(inv => inv.suspicionLevel >= 80).length,
            serverId: serverId || 'all'
          }
        }
      });

    } catch (error) {
      console.error('Detect suspicious inventories error:', error);
      res.status(500).json({
        error: 'Failed to detect suspicious inventories',
        code: 'SUSPICIOUS_DETECTION_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/inventory/:playerId/health-check
 * Effectuer un check de santé complet sur un inventaire
 */
router.post('/:playerId/health-check',
  authenticateAdmin,
  requirePermission('analytics.view'),
  async (req: Request, res: Response) => {
    try {
      const { playerId } = req.params;
      const { serverId } = req.body;

      if (!serverId) {
        return res.status(400).json({
          error: 'ServerId is required',
          code: 'MISSING_SERVER_ID'
        });
      }

      // Récupérer l'inventaire d'abord
      const inventoryDetails = await InventoryManagementService.getInventoryDetails(playerId, serverId);
      
      if (!inventoryDetails) {
        return res.status(404).json({
          error: 'Inventory not found',
          code: 'INVENTORY_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: {
          healthCheck: inventoryDetails.healthCheck,
          recommendations: inventoryDetails.healthCheck.recommendations,
          autoFixableIssues: inventoryDetails.healthCheck.issues.filter(issue => issue.autoFixable).length
        }
      });

    } catch (error) {
      console.error('Inventory health check error:', error);
      res.status(500).json({
        error: 'Failed to perform health check',
        code: 'HEALTH_CHECK_ERROR'
      });
    }
  }
);

// ===== ROUTES D'EXPORT =====

/**
 * POST /api/admin/inventory/export
 * Exporter les données d'inventaire
 */
router.post('/export',
  authenticateAdmin,
  requirePermission('analytics.export'),
  modificationRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { format, filters } = req.body;

      // Validation des paramètres
      if (!format || !['json', 'csv'].includes(format)) {
        return res.status(400).json({
          error: 'Invalid format. Must be json or csv',
          code: 'INVALID_FORMAT'
        });
      }

      // Exporter les données
      const exportResult = await InventoryManagementService.exportInventoryData(
        filters || {},
        format
      );

      // Logger l'export
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'analytics.export_data',
        resource: 'inventory_data',
        details: {
          additionalInfo: {
            format,
            filters,
            recordCount: Array.isArray(exportResult.data) ? exportResult.data.length : 1
          }
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
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
      console.error('Export inventory data error:', error);
      res.status(500).json({
        error: 'Failed to export inventory data',
        code: 'INVENTORY_EXPORT_ERROR'
      });
    }
  }
);

// ===== ROUTES UTILITAIRES =====

/**
 * GET /api/admin/inventory/servers/:serverId/summary
 * Résumé des inventaires par serveur
 */
router.get('/servers/:serverId/summary',
  authenticateAdmin,
  requirePermission('analytics.view'),
  async (req: Request, res: Response) => {
    try {
      const { serverId } = req.params;

      // Utiliser la recherche avec filtres spécifiques au serveur
      const searchResult = await InventoryManagementService.searchInventories({
        serverId,
        limit: 1000 // Grande limite pour avoir un aperçu complet
      });

      // Calculer des métriques spécifiques au serveur
      const summary = {
        serverId,
        totalInventories: searchResult.total,
        healthyInventories: searchResult.stats.healthyCount,
        problematicInventories: searchResult.stats.problematicCount,
        totalCurrencyValue: searchResult.stats.totalValue,
        averageCurrencyValue: searchResult.total > 0 ? 
          Math.round(searchResult.stats.totalValue / searchResult.total) : 0,
        capacityUtilization: {
          average: searchResult.inventories.length > 0 ? 
            Math.round(
              searchResult.inventories.reduce((sum, inv) => sum + inv.capacity.utilizationPercent, 0) / 
              searchResult.inventories.length
            ) : 0,
          overCapacity: searchResult.inventories.filter(inv => inv.capacity.utilizationPercent >= 100).length
        }
      };

      res.json({
        success: true,
        data: summary,
        generatedAt: new Date()
      });

    } catch (error) {
      console.error('Server inventory summary error:', error);
      res.status(500).json({
        error: 'Failed to get server inventory summary',
        code: 'SERVER_SUMMARY_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/inventory/bulk-health-check
 * Check de santé en lot
 */
router.post('/bulk-health-check',
  authenticateAdmin,
  requirePermission('analytics.view'),
  modificationRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { playerIds, serverId } = req.body;

      if (!Array.isArray(playerIds) || playerIds.length === 0) {
        return res.status(400).json({
          error: 'playerIds array is required and must not be empty',
          code: 'MISSING_PLAYER_IDS'
        });
      }

      if (playerIds.length > 50) {
        return res.status(400).json({
          error: 'Maximum 50 players can be checked at once',
          code: 'TOO_MANY_PLAYERS'
        });
      }

      const results = [];
      for (const playerId of playerIds) {
        try {
          const inventoryDetails = await InventoryManagementService.getInventoryDetails(playerId, serverId);
          if (inventoryDetails) {
            results.push({
              playerId,
              success: true,
              healthScore: inventoryDetails.healthCheck.healthScore,
              issuesCount: inventoryDetails.healthCheck.issues.length,
              autoFixableIssues: inventoryDetails.healthCheck.issues.filter(issue => issue.autoFixable).length,
              severity: inventoryDetails.healthCheck.healthScore < 60 ? 'high' : 
                       inventoryDetails.healthCheck.healthScore < 80 ? 'medium' : 'low'
            });
          } else {
            results.push({
              playerId,
              success: false,
              error: 'Inventory not found'
            });
          }
        } catch (error) {
          results.push({
            playerId,
            success: false,
            error: error instanceof Error ? error.message : 'Health check failed'
          });
        }
      }

      summary: {
        totalChecked: playerIds.length,
        healthy: results.filter(r => r.success && r.healthScore !== undefined && r.healthScore >= 80).length,
        problematic: problematic.length,
        errors: results.filter(r => !r.success).length
      }

      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'analytics.view_dashboard',
        resource: 'bulk_inventory_health_check',
        details: {
          additionalInfo: {
            playersChecked: playerIds.length,
            problematicFound: problematic.length,
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
            totalChecked: playerIds.length,
            healthy: results.filter(r => r.success && r.healthScore !== undefined && r.healthScore >= 80).length,
            problematic: problematic.length,
            errors: results.filter(r => !r.success).length
          }
        }
      });

    } catch (error) {
      console.error('Bulk health check error:', error);
      res.status(500).json({
        error: 'Failed to perform bulk health check',
        code: 'BULK_HEALTH_CHECK_ERROR'
      });
    }
  }
);

// ===== MIDDLEWARE DE GESTION D'ERREURS =====

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Inventory route error:', error);
  
  if (error instanceof AdminPermissionError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details
    });
  } else {
    res.status(500).json({
      error: 'Inventory service temporarily unavailable',
      code: 'INVENTORY_SERVICE_ERROR'
    });
  }
});

export default router;

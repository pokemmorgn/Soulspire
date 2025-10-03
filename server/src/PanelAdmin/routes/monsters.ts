import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import Monster, { IMonsterDocument, MonsterType, MonsterElement } from '../../models/Monster';
import { MonsterService } from '../../services/MonsterService';
import AuditLog from '../models/AuditLog';
import { 
  authenticateAdmin, 
  requirePermission,
  requireMinRole
} from '../middleware/adminAuth';
import { IAuthenticatedAdminRequest } from '../types/adminTypes';

const router = express.Router();

// Rate limiting pour les modifications
const modifyRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  message: {
    error: 'Too many monster modifications',
    code: 'MONSTER_RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => {
    const adminReq = req as IAuthenticatedAdminRequest;
    return adminReq.admin?.adminId || req.ip || '0.0.0.0';
  }
});

// Helpers
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

// ===== ROUTES DE LISTING ET STATISTIQUES =====

/**
 * GET /api/admin/monsters
 * Liste des monstres avec filtres
 */
router.get('/',
  authenticateAdmin,
  requirePermission('heroes.view'),
  async (req: Request, res: Response) => {
    try {
      const {
        page = '1',
        limit = '20',
        sortBy = 'name',
        sortOrder = 'asc',
        type,
        element,
        role,
        rarity,
        visualTheme,
        worldId,
        search
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100);
      const skip = (pageNum - 1) * limitNum;

      // Construire le filtre
      const filter: any = {};
      
      if (type) filter.type = type;
      if (element) filter.element = element;
      if (role) filter.role = role;
      if (rarity) filter.rarity = rarity;
      if (visualTheme) filter.visualTheme = visualTheme;
      if (worldId) filter.worldTags = parseInt(worldId as string);
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { monsterId: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } }
        ];
      }

      // Exécuter la requête
      const [monsters, total] = await Promise.all([
        Monster.find(filter)
          .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
          .skip(skip)
          .limit(limitNum)
          .select('-__v')
          .lean(),
        Monster.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: {
          monsters,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });

    } catch (error) {
      console.error('❌ Get monsters error:', error);
      res.status(500).json({
        error: 'Failed to get monsters',
        code: 'GET_MONSTERS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/monsters/stats
 * Statistiques globales des monstres
 */
router.get('/stats',
  authenticateAdmin,
  requirePermission('analytics.view'),
  async (req: Request, res: Response) => {
    try {
      const stats = await MonsterService.getMonsterStats();

      // Stats supplémentaires
      const [
        uniqueBosses,
        totalMonsters,
        normalCount,
        eliteCount,
        bossCount
      ] = await Promise.all([
        Monster.countDocuments({ type: 'boss', isUnique: true }),
        Monster.countDocuments(),
        Monster.countDocuments({ type: 'normal' }),
        Monster.countDocuments({ type: 'elite' }),
        Monster.countDocuments({ type: 'boss' })
      ]);

      res.json({
        success: true,
        data: {
          ...stats,
          summary: {
            totalMonsters,
            uniqueBosses,
            normalCount,
            eliteCount,
            bossCount
          }
        }
      });

    } catch (error) {
      console.error('❌ Get monster stats error:', error);
      res.status(500).json({
        error: 'Failed to get monster statistics',
        code: 'GET_STATS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/monsters/:monsterId
 * Détails d'un monstre spécifique
 */
router.get('/:monsterId',
  authenticateAdmin,
  requirePermission('heroes.view'),
  async (req: Request, res: Response) => {
    try {
      const { monsterId } = req.params;

      const monster = await Monster.findOne({ monsterId }).lean();

      if (!monster) {
        return res.status(404).json({
          error: 'Monster not found',
          code: 'MONSTER_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: monster
      });

    } catch (error) {
      console.error('❌ Get monster details error:', error);
      res.status(500).json({
        error: 'Failed to get monster details',
        code: 'GET_MONSTER_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/monsters/preview/:monsterId
 * Preview des stats à différents niveaux/stars
 */
router.get('/preview/:monsterId',
  authenticateAdmin,
  requirePermission('heroes.view'),
  async (req: Request, res: Response) => {
    try {
      const { monsterId } = req.params;
      const { level = '1', stars = '3' } = req.query;

      const levelNum = parseInt(level as string);
      const starsNum = parseInt(stars as string);

      if (levelNum < 1 || levelNum > 100) {
        return res.status(400).json({
          error: 'Level must be between 1 and 100',
          code: 'INVALID_LEVEL'
        });
      }

      if (starsNum < 1 || starsNum > 6) {
        return res.status(400).json({
          error: 'Stars must be between 1 and 6',
          code: 'INVALID_STARS'
        });
      }

      const monster = await Monster.findOne({ monsterId });

      if (!monster) {
        return res.status(404).json({
          error: 'Monster not found',
          code: 'MONSTER_NOT_FOUND'
        });
      }

      const stats = monster.getStatsAtLevel(levelNum, starsNum);

      res.json({
        success: true,
        data: {
          monsterId,
          level: levelNum,
          stars: starsNum,
          stats
        }
      });

    } catch (error) {
      console.error('❌ Preview stats error:', error);
      res.status(500).json({
        error: 'Failed to preview stats',
        code: 'PREVIEW_ERROR'
      });
    }
  }
);

// ===== ROUTES DE MODIFICATION =====

/**
 * POST /api/admin/monsters
 * Créer un nouveau monstre
 */
router.post('/',
  authenticateAdmin,
  requirePermission('heroes.manage'),
  modifyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const monsterData = req.body;

      // Validation basique
      if (!monsterData.monsterId || !monsterData.name || !monsterData.element || !monsterData.role) {
        return res.status(400).json({
          error: 'Missing required fields: monsterId, name, element, role',
          code: 'MISSING_FIELDS'
        });
      }

      // Vérifier que le monsterId n'existe pas déjà
      const existing = await Monster.findOne({ monsterId: monsterData.monsterId });
      if (existing) {
        return res.status(409).json({
          error: 'Monster with this ID already exists',
          code: 'MONSTER_EXISTS'
        });
      }

      const monster = await MonsterService.createMonster(monsterData);

      // Logger l'action
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'event.create',
        resource: 'monster',
        resourceId: monster.monsterId,
        details: {
          newValue: {
            monsterId: monster.monsterId,
            name: monster.name,
            type: monster.type,
            element: monster.element
          }
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        success: true,
        severity: 'medium'
      });

      res.status(201).json({
        success: true,
        data: monster,
        message: `Monster ${monster.name} created successfully`
      });

    } catch (error: any) {
      console.error('❌ Create monster error:', error);
      res.status(500).json({
        error: error.message || 'Failed to create monster',
        code: 'CREATE_MONSTER_ERROR'
      });
    }
  }
);

/**
 * PUT /api/admin/monsters/:monsterId
 * Modifier un monstre existant
 */
router.put('/:monsterId',
  authenticateAdmin,
  requirePermission('heroes.manage'),
  modifyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { monsterId } = req.params;
      const updates = req.body;

      // Récupérer l'ancien état pour logging
      const oldMonster = await Monster.findOne({ monsterId }).lean();
      if (!oldMonster) {
        return res.status(404).json({
          error: 'Monster not found',
          code: 'MONSTER_NOT_FOUND'
        });
      }

      const updatedMonster = await MonsterService.updateMonster(monsterId, updates);

      // Logger l'action
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'event.modify',
        resource: 'monster',
        resourceId: monsterId,
        details: {
          oldValue: {
            name: oldMonster.name,
            type: oldMonster.type,
            baseStats: oldMonster.baseStats
          },
          newValue: updates
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        success: true,
        severity: 'medium'
      });

      res.json({
        success: true,
        data: updatedMonster,
        message: `Monster ${monsterId} updated successfully`
      });

    } catch (error: any) {
      console.error('❌ Update monster error:', error);
      res.status(500).json({
        error: error.message || 'Failed to update monster',
        code: 'UPDATE_MONSTER_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/admin/monsters/:monsterId
 * Supprimer un monstre
 */
router.delete('/:monsterId',
  authenticateAdmin,
  requirePermission('player.delete'),
  modifyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { monsterId } = req.params;

      const monster = await Monster.findOne({ monsterId }).lean();
      if (!monster) {
        return res.status(404).json({
          error: 'Monster not found',
          code: 'MONSTER_NOT_FOUND'
        });
      }

      const success = await MonsterService.deleteMonster(monsterId);

      if (!success) {
        throw new Error('Failed to delete monster');
      }

      // Logger l'action
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'event.delete',
        resource: 'monster',
        resourceId: monsterId,
        details: {
          oldValue: {
            monsterId: monster.monsterId,
            name: monster.name,
            type: monster.type
          }
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        success: true,
        severity: 'high'
      });

      res.json({
        success: true,
        message: `Monster ${monsterId} deleted successfully`
      });

    } catch (error: any) {
      console.error('❌ Delete monster error:', error);
      res.status(500).json({
        error: error.message || 'Failed to delete monster',
        code: 'DELETE_MONSTER_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/monsters/:monsterId/duplicate
 * Dupliquer un monstre
 */
router.post('/:monsterId/duplicate',
  authenticateAdmin,
  requirePermission('heroes.manage'),
  modifyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { monsterId } = req.params;
      const { newMonsterId, newName } = req.body;

      if (!newMonsterId || !newName) {
        return res.status(400).json({
          error: 'newMonsterId and newName are required',
          code: 'MISSING_FIELDS'
        });
      }

      const original = await Monster.findOne({ monsterId }).lean();
      if (!original) {
        return res.status(404).json({
          error: 'Monster not found',
          code: 'MONSTER_NOT_FOUND'
        });
      }

      // Vérifier que le nouveau ID n'existe pas
      const existing = await Monster.findOne({ monsterId: newMonsterId });
      if (existing) {
        return res.status(409).json({
          error: 'Monster with this ID already exists',
          code: 'MONSTER_EXISTS'
        });
      }

      // Créer la copie
      const duplicateData = {
        ...original,
        _id: undefined,
        monsterId: newMonsterId,
        name: newName,
        displayName: newName,
        isUnique: false
      };

      const duplicate = await MonsterService.createMonster(duplicateData);

      // Logger l'action
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'event.create',
        resource: 'monster',
        resourceId: duplicate.monsterId,
        details: {
          additionalInfo: {
            duplicatedFrom: monsterId,
            originalName: original.name
          }
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        success: true,
        severity: 'low'
      });

      res.status(201).json({
        success: true,
        data: duplicate,
        message: `Monster duplicated successfully as ${newName}`
      });

    } catch (error: any) {
      console.error('❌ Duplicate monster error:', error);
      res.status(500).json({
        error: error.message || 'Failed to duplicate monster',
        code: 'DUPLICATE_MONSTER_ERROR'
      });
    }
  }
);

export default router;

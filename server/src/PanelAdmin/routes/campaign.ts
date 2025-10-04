/**
 * Campaign Admin Routes - Panel Admin
 * Routes pour gérer les mondes et niveaux de campagne
 */
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import CampaignWorld from '../../models/CampaignWorld';
import Monster from '../../models/Monster';
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
    error: 'Too many campaign modifications',
    code: 'CAMPAIGN_RATE_LIMIT_EXCEEDED'
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

// ===== ROUTES DE LISTING =====

/**
 * GET /api/admin/campaign/worlds
 * Liste tous les mondes de campagne
 */
router.get('/worlds',
  authenticateAdmin,
  requirePermission('heroes.view'),
  async (req: Request, res: Response) => {
    try {
      const worlds = await CampaignWorld.find({})
        .sort({ worldId: 1 })
        .lean();

      // Enrichir avec des stats
      const enrichedWorlds = await Promise.all(worlds.map(async (world) => {
        const configuredLevels = world.levels.filter(l => l.monsters && l.monsters.length > 0).length;
        const autoGenLevels = world.levels.filter(l => l.autoGenerate && l.autoGenerate.useWorldPool).length;
        
        return {
          ...world,
          stats: {
            totalLevels: world.levels.length,
            configuredLevels,
            autoGenLevels,
            unconfiguredLevels: world.levels.length - configuredLevels - autoGenLevels,
            totalMonsters: world.defaultMonsterPool?.length || 0
          }
        };
      }));

      res.json({
        success: true,
        data: {
          worlds: enrichedWorlds,
          total: enrichedWorlds.length
        }
      });

    } catch (error) {
      console.error('❌ Get campaign worlds error:', error);
      res.status(500).json({
        error: 'Failed to get campaign worlds',
        code: 'GET_CAMPAIGN_WORLDS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/campaign/worlds/:worldId
 * Détails d'un monde spécifique avec tous ses niveaux
 */
router.get('/worlds/:worldId',
  authenticateAdmin,
  requirePermission('heroes.view'),
  async (req: Request, res: Response) => {
    try {
      const worldId = parseInt(req.params.worldId);

      const world = await CampaignWorld.findOne({ worldId }).lean();

      if (!world) {
        return res.status(404).json({
          error: 'World not found',
          code: 'WORLD_NOT_FOUND'
        });
      }

      // Enrichir chaque niveau avec des infos sur les monstres
      const enrichedLevels = await Promise.all(world.levels.map(async (level) => {
        let monsterDetails = [];
        
        if (level.monsters && level.monsters.length > 0) {
          // Récupérer les détails des monstres configurés
          const monsterIds = level.monsters.map(m => m.monsterId);
          const monsters = await Monster.find({ monsterId: { $in: monsterIds } })
            .select('monsterId name element type rarity visualTheme')
            .lean();
          
          monsterDetails = level.monsters.map(config => {
            const monsterData = monsters.find(m => m.monsterId === config.monsterId);
            return {
              ...config,
              monsterData
            };
          });
        }

        return {
          ...level,
          monsterDetails,
          isConfigured: (level.monsters && level.monsters.length > 0) || 
                        (level.autoGenerate && level.autoGenerate.useWorldPool)
        };
      }));

      res.json({
        success: true,
        data: {
          world: {
            ...world,
            levels: enrichedLevels
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Get world details error:', error);
      res.status(500).json({
        error: error.message || 'Failed to get world details',
        code: 'GET_WORLD_DETAILS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/campaign/worlds/:worldId/levels/:levelIndex
 * Détails d'un niveau spécifique
 */
router.get('/worlds/:worldId/levels/:levelIndex',
  authenticateAdmin,
  requirePermission('heroes.view'),
  async (req: Request, res: Response) => {
    try {
      const worldId = parseInt(req.params.worldId);
      const levelIndex = parseInt(req.params.levelIndex);

      const world = await CampaignWorld.findOne({ worldId });

      if (!world) {
        return res.status(404).json({
          error: 'World not found',
          code: 'WORLD_NOT_FOUND'
        });
      }

      const level = world.levels.find(l => l.levelIndex === levelIndex);

      if (!level) {
        return res.status(404).json({
          error: 'Level not found',
          code: 'LEVEL_NOT_FOUND'
        });
      }

      // Récupérer les détails des monstres configurés
      let monsterDetails = [];
      if (level.monsters && level.monsters.length > 0) {
        const monsterIds = level.monsters.map(m => m.monsterId);
        const monsters = await Monster.find({ monsterId: { $in: monsterIds } }).lean();
        
        monsterDetails = level.monsters.map(config => {
          const monsterData = monsters.find(m => m.monsterId === config.monsterId);
          return {
            ...config,
            monsterData
          };
        });
      }

      res.json({
        success: true,
        data: {
          world: {
            worldId: world.worldId,
            name: world.name,
            defaultMonsterPool: world.defaultMonsterPool
          },
          level: {
            ...level,
            monsterDetails
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Get level details error:', error);
      res.status(500).json({
        error: error.message || 'Failed to get level details',
        code: 'GET_LEVEL_DETAILS_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/campaign/monsters/available
 * Liste des monstres disponibles pour la configuration
 */
router.get('/monsters/available',
  authenticateAdmin,
  requirePermission('heroes.view'),
  async (req: Request, res: Response) => {
    try {
      const {
        worldId,
        element,
        type,
        rarity,
        visualTheme,
        search
      } = req.query;

      const filter: any = {};

      // Filtrer par monde si spécifié
      if (worldId) {
        const worldIdNum = parseInt(worldId as string);
        filter.$or = [
          { worldTags: worldIdNum },
          { worldTags: { $size: 0 } }
        ];
      }

      if (element) filter.element = element;
      if (type) filter.type = type;
      if (rarity) filter.rarity = rarity;
      if (visualTheme) filter.visualTheme = visualTheme;
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { monsterId: { $regex: search, $options: 'i' } }
        ];
      }

      const monsters = await Monster.find(filter)
        .select('monsterId name element type role rarity visualTheme baseStats spriteId')
        .sort({ type: 1, name: 1 })
        .lean();

      res.json({
        success: true,
        data: {
          monsters,
          total: monsters.length
        }
      });

    } catch (error) {
      console.error('❌ Get available monsters error:', error);
      res.status(500).json({
        error: 'Failed to get available monsters',
        code: 'GET_AVAILABLE_MONSTERS_ERROR'
      });
    }
  }
);

// ===== ROUTES DE MODIFICATION =====

/**
 * PUT /api/admin/campaign/worlds/:worldId/levels/:levelIndex
 * Mettre à jour la configuration d'un niveau
 */
router.put('/worlds/:worldId/levels/:levelIndex',
  authenticateAdmin,
  requirePermission('heroes.manage'),
  modifyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const worldId = parseInt(req.params.worldId);
      const levelIndex = parseInt(req.params.levelIndex);
      const updates = req.body;

      const world = await CampaignWorld.findOne({ worldId });

      if (!world) {
        return res.status(404).json({
          error: 'World not found',
          code: 'WORLD_NOT_FOUND'
        });
      }

      const levelIdx = world.levels.findIndex(l => l.levelIndex === levelIndex);

      if (levelIdx === -1) {
        return res.status(404).json({
          error: 'Level not found',
          code: 'LEVEL_NOT_FOUND'
        });
      }

      // Sauvegarder l'ancien état pour audit
      const oldLevel = { ...world.levels[levelIdx] };

      // Appliquer les mises à jour
      if (updates.monsters !== undefined) {
        world.levels[levelIdx].monsters = updates.monsters;
      }
      if (updates.autoGenerate !== undefined) {
        world.levels[levelIdx].autoGenerate = updates.autoGenerate;
      }
      if (updates.name !== undefined) {
        world.levels[levelIdx].name = updates.name;
      }
      if (updates.enemyType !== undefined) {
        world.levels[levelIdx].enemyType = updates.enemyType;
      }
      if (updates.difficultyMultiplier !== undefined) {
        world.levels[levelIdx].difficultyMultiplier = updates.difficultyMultiplier;
      }
      if (updates.rewards !== undefined) {
        world.levels[levelIdx].rewards = updates.rewards;
      }
      if (updates.modifiers !== undefined) {
        world.levels[levelIdx].modifiers = updates.modifiers;
      }

      world.markModified('levels');
      await world.save();

      // Logger l'action
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'event.modify',
        resource: 'campaign_level',
        resourceId: `${worldId}-${levelIndex}`,
        details: {
          oldValue: {
            monsters: oldLevel.monsters,
            autoGenerate: oldLevel.autoGenerate
          },
          newValue: {
            monsters: updates.monsters,
            autoGenerate: updates.autoGenerate
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
          level: world.levels[levelIdx]
        },
        message: `Level ${worldId}-${levelIndex} updated successfully`
      });

    } catch (error: any) {
      console.error('❌ Update level error:', error);
      res.status(500).json({
        error: error.message || 'Failed to update level',
        code: 'UPDATE_LEVEL_ERROR'
      });
    }
  }
);

/**
 * PUT /api/admin/campaign/worlds/:worldId/monster-pool
 * Mettre à jour le pool de monstres par défaut d'un monde
 */
router.put('/worlds/:worldId/monster-pool',
  authenticateAdmin,
  requirePermission('heroes.manage'),
  modifyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const worldId = parseInt(req.params.worldId);
      const { monsterPool } = req.body;

      if (!Array.isArray(monsterPool)) {
        return res.status(400).json({
          error: 'monsterPool must be an array',
          code: 'INVALID_MONSTER_POOL'
        });
      }

      const world = await CampaignWorld.findOne({ worldId });

      if (!world) {
        return res.status(404).json({
          error: 'World not found',
          code: 'WORLD_NOT_FOUND'
        });
      }

      const oldPool = world.defaultMonsterPool;
      world.defaultMonsterPool = monsterPool;
      await world.save();

      // Logger l'action
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'event.modify',
        resource: 'campaign_world',
        resourceId: `${worldId}`,
        details: {
          oldValue: { defaultMonsterPool: oldPool },
          newValue: { defaultMonsterPool: monsterPool }
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        success: true,
        severity: 'medium'
      });

      res.json({
        success: true,
        data: {
          worldId,
          defaultMonsterPool: monsterPool
        },
        message: `World ${worldId} monster pool updated successfully`
      });

    } catch (error: any) {
      console.error('❌ Update monster pool error:', error);
      res.status(500).json({
        error: error.message || 'Failed to update monster pool',
        code: 'UPDATE_MONSTER_POOL_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/campaign/worlds/:worldId/levels/:levelIndex/copy
 * Copier la configuration d'un niveau vers un autre
 */
router.post('/worlds/:worldId/levels/:levelIndex/copy',
  authenticateAdmin,
  requirePermission('heroes.manage'),
  modifyRateLimit,
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const worldId = parseInt(req.params.worldId);
      const sourceLevelIndex = parseInt(req.params.levelIndex);
      const { targetLevelIndex } = req.body;

      if (!targetLevelIndex) {
        return res.status(400).json({
          error: 'targetLevelIndex is required',
          code: 'MISSING_TARGET_LEVEL'
        });
      }

      const world = await CampaignWorld.findOne({ worldId });

      if (!world) {
        return res.status(404).json({
          error: 'World not found',
          code: 'WORLD_NOT_FOUND'
        });
      }

      const sourceLevel = world.levels.find(l => l.levelIndex === sourceLevelIndex);
      const targetIdx = world.levels.findIndex(l => l.levelIndex === targetLevelIndex);

      if (!sourceLevel || targetIdx === -1) {
        return res.status(404).json({
          error: 'Source or target level not found',
          code: 'LEVEL_NOT_FOUND'
        });
      }

      // Copier la configuration
      world.levels[targetIdx].monsters = sourceLevel.monsters;
      world.levels[targetIdx].autoGenerate = sourceLevel.autoGenerate;

      world.markModified('levels');
      await world.save();

      // Logger l'action
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'event.create',
        resource: 'campaign_level',
        resourceId: `${worldId}-${targetLevelIndex}`,
        details: {
          additionalInfo: {
            copiedFrom: `${worldId}-${sourceLevelIndex}`,
            monsters: sourceLevel.monsters
          }
        },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
        success: true,
        severity: 'low'
      });

      res.json({
        success: true,
        message: `Configuration copied from level ${sourceLevelIndex} to ${targetLevelIndex}`,
        data: {
          targetLevel: world.levels[targetIdx]
        }
      });

    } catch (error: any) {
      console.error('❌ Copy level config error:', error);
      res.status(500).json({
        error: error.message || 'Failed to copy level configuration',
        code: 'COPY_LEVEL_ERROR'
      });
    }
  }
);

export default router;

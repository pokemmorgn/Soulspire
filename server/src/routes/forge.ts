// server/src/routes/forge.ts
import { Router, Request, Response } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { ForgeService, createForgeService } from '../services/forge/ForgeService';
import { WebSocketService } from '../services/WebSocketService';

const router = Router();

// ===== MIDDLEWARE =====

// Authentification requise pour toutes les routes forge
router.use(authMiddleware);

// ===== VALIDATION HELPERS =====

const validateItemInstanceId = (itemInstanceId: string): boolean => {
  return typeof itemInstanceId === 'string' && itemInstanceId.length > 0;
};

const validateArray = (arr: any, minLength: number = 0, maxLength: number = 100): boolean => {
  return Array.isArray(arr) && arr.length >= minLength && arr.length <= maxLength;
};

const validateOperationType = (type: string): boolean => {
  return ['enhancement', 'reforge', 'fusion', 'tierUpgrade'].includes(type);
};

const validateRarity = (rarity: string): boolean => {
  return ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'].includes(rarity);
};

const validateEquipmentSlot = (slot: string): boolean => {
  return ['Weapon', 'Armor', 'Helmet', 'Boots', 'Gloves', 'Accessory'].includes(slot);
};

// ===== ROUTES PRINCIPALES =====

/**
 * GET /forge/status
 * Obtenir le statut complet de la forge pour le joueur
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    const forgeService = createForgeService(playerId);
    const result = await forgeService.executeBatchOperations(operations);
    
    // Notification WebSocket pour le batch
    if (result.success && result.completedOperations > 0) {
      // Notifier les résultats du batch
      WebSocketService.notifyForgeRecommendations(playerId, {
        playerPowerScore: 0,
        playerLevel: 0,
        recommendations: [],
        resourceOptimization: {
          currentResources: {},
          optimalSpendingPlan: [],
          efficiencyScore: 0
        }
      });
    }
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Batch operations error:', error);
    res.status(500).json({
      success: false,
      error: 'BATCH_OPERATIONS_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /forge/fusion/:itemId/:rarity/count
 * Obtenir le nombre de fusions possibles pour un item spécifique
 */
router.get('/fusion/:itemId/:rarity/count', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    const { itemId, rarity } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    if (!itemId || !validateRarity(rarity)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PARAMETERS',
        message: 'Valid item ID and rarity are required'
      });
    }

    const forgeService = createForgeService(playerId);
    const count = await forgeService.getPossibleFusionsCount(itemId, rarity);
    
    res.json({
      success: true,
      data: { 
        itemId,
        rarity,
        possibleFusions: count
      },
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Fusion count error:', error);
    res.status(500).json({
      success: false,
      error: 'FUSION_COUNT_ERROR',
      message: error.message
    });
  }
});

// ===== ROUTES DE CONFIGURATION =====

/**
 * GET /forge/config
 * Obtenir la configuration active de la forge (pour debug/admin)
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    // Note: En production, cette route devrait être protégée par des permissions admin
    const { ForgeConfig } = require('../models/forging/ForgeConfig');
    const config = await ForgeConfig.getActiveConfig();
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'NO_ACTIVE_CONFIG',
        message: 'No active forge configuration found'
      });
    }

    res.json({
      success: true,
      data: {
        configId: config.configId,
        configName: config.configName,
        version: config.version,
        isActive: config.isActive,
        modules: {
          reforge: {
            enabled: config.config.reforge.enabled,
            baseGoldCost: config.config.reforge.baseGoldCost,
            baseGemCost: config.config.reforge.baseGemCost,
            maxLockedStats: config.config.reforge.maxLockedStats
          },
          enhancement: {
            enabled: config.config.enhancement.enabled,
            baseGoldCost: config.config.enhancement.baseGoldCost,
            baseGemCost: config.config.enhancement.baseGemCost,
            maxLevel: config.config.enhancement.maxLevel,
            pityThreshold: config.config.enhancement.pityThreshold
          },
          fusion: {
            enabled: config.config.fusion.enabled,
            baseGoldCost: config.config.fusion.baseGoldCost,
            baseGemCost: config.config.fusion.baseGemCost,
            requiredItems: config.config.fusion.requiredItems
          },
          tierUpgrade: {
            enabled: config.config.tierUpgrade.enabled,
            baseGoldCost: config.config.tierUpgrade.baseGoldCost,
            baseGemCost: config.config.tierUpgrade.baseGemCost,
            maxTier: config.config.tierUpgrade.maxTier
          }
        },
        globalSettings: config.globalSettings,
        activeEvents: config.activeEvents
      },
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Config error:', error);
    res.status(500).json({
      success: false,
      error: 'FORGE_CONFIG_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /forge/stats/player
 * Obtenir les statistiques détaillées du joueur
 */
router.get('/stats/player', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    const { ForgeStats } = require('../models/forging/ForgeStats');
    const stats = await ForgeStats.getOrCreatePlayerStats(playerId);
    
    res.json({
      success: true,
      data: {
        playerId: stats.playerId,
        globalStats: stats.globalStats,
        moduleStats: stats.moduleStats,
        achievements: stats.achievements,
        streaks: stats.streaks,
        preferences: stats.preferences,
        cachedData: stats.cachedData
      },
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Player stats error:', error);
    res.status(500).json({
      success: false,
      error: 'PLAYER_STATS_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /forge/leaderboard/:metric
 * Obtenir le classement des joueurs selon une métrique
 */
router.get('/leaderboard/:metric', async (req: Request, res: Response) => {
  try {
    const { metric } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const validMetrics = ['totalOperations', 'totalPowerGained', 'efficiencyScore', 'successRate'];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_METRIC',
        message: `Valid metrics are: ${validMetrics.join(', ')}`
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_LIMIT',
        message: 'Limit must be between 1 and 100'
      });
    }

    const { ForgeStats } = require('../models/forging/ForgeStats');
    const leaderboard = await ForgeStats.getLeaderboard(metric, limit);
    
    res.json({
      success: true,
      data: {
        metric,
        limit,
        leaderboard: leaderboard.map((entry: any, index: number) => ({
          rank: index + 1,
          playerId: entry.playerId,
          totalOperations: entry.globalStats?.totalOperations || 0,
          totalPowerGained: entry.globalStats?.totalPowerGained || 0,
          globalSuccessRate: entry.globalStats?.globalSuccessRate || 0,
          efficiencyScore: entry.cachedData?.efficiencyScore || 0
        }))
      },
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: 'LEADERBOARD_ERROR',
      message: error.message
    });
  }
});

/**
 * PUT /forge/preferences
 * Mettre à jour les préférences de forge du joueur
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    const { ForgeStats } = require('../models/forging/ForgeStats');
    const stats = await ForgeStats.getOrCreatePlayerStats(playerId);
    
    // Valider et mettre à jour les préférences
    const preferences = req.body.preferences || {};
    
    if (preferences.autoLockBestStats !== undefined) {
      stats.preferences.autoLockBestStats = Boolean(preferences.autoLockBestStats);
    }
    
    if (preferences.preferredEnhancementStrategy && 
        ['conservative', 'aggressive', 'balanced'].includes(preferences.preferredEnhancementStrategy)) {
      stats.preferences.preferredEnhancementStrategy = preferences.preferredEnhancementStrategy;
    }
    
    if (preferences.enableNotifications !== undefined) {
      stats.preferences.enableNotifications = Boolean(preferences.enableNotifications);
    }
    
    if (preferences.showDetailedResults !== undefined) {
      stats.preferences.showDetailedResults = Boolean(preferences.showDetailedResults);
    }
    
    if (preferences.autoSellFailedItems !== undefined) {
      stats.preferences.autoSellFailedItems = Boolean(preferences.autoSellFailedItems);
    }
    
    await stats.save();
    
    res.json({
      success: true,
      data: {
        preferences: stats.preferences
      },
      message: 'Preferences updated successfully',
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Preferences update error:', error);
    res.status(500).json({
      success: false,
      error: 'PREFERENCES_UPDATE_ERROR',
      message: error.message
    });
  }
});

// ===== ROUTES DE DEBUG (DÉVELOPPEMENT) =====

if (process.env.NODE_ENV === 'development') {
  /**
   * GET /forge/debug/operations/:playerId
   * Obtenir l'historique des opérations d'un joueur (debug uniquement)
   */
  router.get('/debug/operations/:debugPlayerId', async (req: Request, res: Response) => {
    try {
      const { debugPlayerId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const operationType = req.query.operationType as string;
      
      const { ForgeOperation } = require('../models/forging/ForgeOperation');
      
      const options: any = {
        limit,
        offset: 0,
        successOnly: req.query.successOnly === 'true'
      };
      
      if (operationType && validateOperationType(operationType)) {
        options.operationType = operationType;
      }
      
      const operations = await ForgeOperation.getPlayerOperations(debugPlayerId, options);
      
      res.json({
        success: true,
        data: {
          playerId: debugPlayerId,
          operations: operations.map((op: any) => ({
            operationId: op.operationId,
            operationType: op.operationType,
            itemName: op.itemName,
            itemRarity: op.itemRarity,
            success: op.result.success,
            cost: op.cost,
            timestamp: op.timestamp,
            executionTimeMs: op.executionTimeMs
          }))
        },
        debug: true,
        timestamp: new Date()
      });
      
    } catch (error: any) {
      console.error('[Forge] Debug operations error:', error);
      res.status(500).json({
        success: false,
        error: 'DEBUG_OPERATIONS_ERROR',
        message: error.message
      });
    }
  });

  /**
   * POST /forge/debug/reset-stats/:playerId
   * Reset les stats de forge d'un joueur (debug uniquement)
   */
  router.post('/debug/reset-stats/:debugPlayerId', async (req: Request, res: Response) => {
    try {
      const { debugPlayerId } = req.params;
      
      const { ForgeStats } = require('../models/forging/ForgeStats');
      
      await ForgeStats.deleteOne({ playerId: debugPlayerId });
      const newStats = await ForgeStats.getOrCreatePlayerStats(debugPlayerId);
      
      res.json({
        success: true,
        data: {
          message: `Stats reset for player ${debugPlayerId}`,
          newStats: {
            playerId: newStats.playerId,
            globalStats: newStats.globalStats
          }
        },
        debug: true,
        timestamp: new Date()
      });
      
    } catch (error: any) {
      console.error('[Forge] Debug reset stats error:', error);
      res.status(500).json({
        success: false,
        error: 'DEBUG_RESET_STATS_ERROR',
        message: error.message
      });
    }
  });
}

// ===== MIDDLEWARE DE GESTION D'ERREURS =====

router.use((error: any, req: Request, res: Response, next: any) => {
  console.error('[Forge Routes] Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: 'FORGE_INTERNAL_ERROR',
    message: 'Internal server error in forge system',
    timestamp: new Date()
  });
});

export default router;
    const status = await forgeService.getForgeStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Status error:', error);
    res.status(500).json({
      success: false,
      error: 'FORGE_STATUS_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /forge/recommendations
 * Obtenir des recommandations intelligentes de forge
 */
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    const forgeService = createForgeService(playerId);
    const recommendations = await forgeService.getRecommendations();
    
    // Notifier recommandations via WebSocket
    if (recommendations.length > 0) {
      WebSocketService.notifyForgeRecommendations(playerId, {
        playerPowerScore: 0, // Sera rempli par le service
        playerLevel: 0,     // Sera rempli par le service
        recommendations,
        resourceOptimization: {
          currentResources: {},
          optimalSpendingPlan: [],
          efficiencyScore: 0
        }
      });
    }
    
    res.json({
      success: true,
      data: { recommendations },
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'FORGE_RECOMMENDATIONS_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /forge/analytics
 * Obtenir les analytics d'utilisation du joueur
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    const forgeService = createForgeService(playerId);
    const analytics = await forgeService.getUsageAnalytics();
    
    res.json({
      success: true,
      data: analytics,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'FORGE_ANALYTICS_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /forge/optimization-cost
 * Obtenir le coût total pour optimiser tout l'équipement
 */
router.get('/optimization-cost', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    const forgeService = createForgeService(playerId);
    const optimizationCost = await forgeService.getFullOptimizationCost();
    
    res.json({
      success: true,
      data: optimizationCost,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Optimization cost error:', error);
    res.status(500).json({
      success: false,
      error: 'FORGE_OPTIMIZATION_COST_ERROR',
      message: error.message
    });
  }
});

// ===== ROUTES ENHANCEMENT =====

/**
 * GET /forge/enhancement/items
 * Obtenir les items enhanceables
 */
router.get('/enhancement/items', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    const filters: any = {};
    
    if (req.query.rarity && validateRarity(req.query.rarity as string)) {
      filters.rarity = req.query.rarity as string;
    }
    
    if (req.query.maxLevel) {
      const maxLevel = parseInt(req.query.maxLevel as string);
      if (!isNaN(maxLevel) && maxLevel >= 0 && maxLevel <= 30) {
        filters.maxLevel = maxLevel;
      }
    }

    const forgeService = createForgeService(playerId);
    const items = await forgeService.getEnhanceableItems(filters);
    
    res.json({
      success: true,
      data: { items },
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Enhancement items error:', error);
    res.status(500).json({
      success: false,
      error: 'ENHANCEMENT_ITEMS_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /forge/enhancement/:itemInstanceId/cost
 * Obtenir le coût d'enhancement pour un item
 */
router.get('/enhancement/:itemInstanceId/cost', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    const { itemInstanceId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    if (!validateItemInstanceId(itemInstanceId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ITEM_INSTANCE_ID',
        message: 'Item instance ID is required'
      });
    }

    const forgeService = createForgeService(playerId);
    
    const options = {
      usePaidGemsToGuarantee: req.query.usePaidGemsToGuarantee === 'true',
      forceGuaranteed: req.query.forceGuaranteed === 'true'
    };
    
    const cost = await forgeService.getEnhancementCost(itemInstanceId, options);
    
    res.json({
      success: true,
      data: { cost },
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Enhancement cost error:', error);
    res.status(500).json({
      success: false,
      error: 'ENHANCEMENT_COST_ERROR',
      message: error.message
    });
  }
});

/**
 * POST /forge/enhancement/:itemInstanceId/execute
 * Exécuter un enhancement
 */
router.post('/enhancement/:itemInstanceId/execute', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    const { itemInstanceId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    if (!validateItemInstanceId(itemInstanceId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ITEM_INSTANCE_ID',
        message: 'Item instance ID is required'
      });
    }

    const forgeService = createForgeService(playerId);
    
    const options = {
      usePaidGemsToGuarantee: req.body.usePaidGemsToGuarantee === true,
      forceGuaranteed: req.body.forceGuaranteed === true
    };
    
    const result = await forgeService.executeEnhancement(itemInstanceId, options);
    
    // Notification WebSocket
    WebSocketService.notifyForgeEnhancementResult(playerId, {
      itemInstanceId,
      itemName: result.message || 'Unknown Item',
      success: result.success,
      previousLevel: result.previousLevel,
      newLevel: result.newLevel,
      cost: result.cost,
      pityInfo: result.pityInfo,
      statsImprovement: result.statsImprovement,
      guaranteeUsed: result.guaranteeUsed,
      specialEffects: result.specialEffects
    });
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Enhancement execute error:', error);
    res.status(500).json({
      success: false,
      error: 'ENHANCEMENT_EXECUTE_ERROR',
      message: error.message
    });
  }
});

// ===== ROUTES REFORGE =====

/**
 * GET /forge/reforge/items
 * Obtenir les items reforgeables
 */
router.get('/reforge/items', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    const filters: any = {};
    
    if (req.query.rarity && validateRarity(req.query.rarity as string)) {
      filters.rarity = req.query.rarity as string;
    }
    
    if (req.query.slot && validateEquipmentSlot(req.query.slot as string)) {
      filters.slot = req.query.slot as string;
    }

    const forgeService = createForgeService(playerId);
    const items = await forgeService.getReforgeableItems(filters);
    
    res.json({
      success: true,
      data: { items },
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Reforge items error:', error);
    res.status(500).json({
      success: false,
      error: 'REFORGE_ITEMS_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /forge/reforge/:equipmentSlot/stats
 * Obtenir les stats disponibles pour un slot d'équipement
 */
router.get('/reforge/:equipmentSlot/stats', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    const { equipmentSlot } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    if (!validateEquipmentSlot(equipmentSlot)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_EQUIPMENT_SLOT',
        message: 'Invalid equipment slot'
      });
    }

    const forgeService = createForgeService(playerId);
    const availableStats = forgeService.getAvailableStatsForSlot(equipmentSlot);
    
    res.json({
      success: true,
      data: { availableStats },
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Available stats error:', error);
    res.status(500).json({
      success: false,
      error: 'AVAILABLE_STATS_ERROR',
      message: error.message
    });
  }
});

/**
 * POST /forge/reforge/:itemInstanceId/preview
 * Obtenir un aperçu de reforge
 */
router.post('/reforge/:itemInstanceId/preview', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    const { itemInstanceId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    if (!validateItemInstanceId(itemInstanceId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ITEM_INSTANCE_ID',
        message: 'Item instance ID is required'
      });
    }

    const forgeService = createForgeService(playerId);
    
    const options = {
      lockedStats: Array.isArray(req.body.lockedStats) ? req.body.lockedStats : []
    };
    
    const preview = await forgeService.getReforgePreview(itemInstanceId, options);
    
    res.json({
      success: true,
      data: preview,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Reforge preview error:', error);
    res.status(500).json({
      success: false,
      error: 'REFORGE_PREVIEW_ERROR',
      message: error.message
    });
  }
});

/**
 * POST /forge/reforge/:itemInstanceId/execute
 * Exécuter un reforge
 */
router.post('/reforge/:itemInstanceId/execute', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    const { itemInstanceId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    if (!validateItemInstanceId(itemInstanceId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ITEM_INSTANCE_ID',
        message: 'Item instance ID is required'
      });
    }

    const forgeService = createForgeService(playerId);
    
    const options = {
      lockedStats: Array.isArray(req.body.lockedStats) ? req.body.lockedStats : [],
      simulationMode: req.body.simulationMode === true
    };
    
    const result = await forgeService.executeReforge(itemInstanceId, options);
    
    // Notification WebSocket
    WebSocketService.notifyForgeReforgeResult(playerId, {
      itemInstanceId,
      itemName: result.message || 'Unknown Item',
      success: result.success,
      lockedStats: result.lockedStats,
      oldStats: result.previousStats,
      newStats: result.newStats,
      cost: result.cost,
      reforgeCount: result.reforgeCount,
      improvements: result.improvements,
      powerChange: result.powerChange
    });
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Reforge execute error:', error);
    res.status(500).json({
      success: false,
      error: 'REFORGE_EXECUTE_ERROR',
      message: error.message
    });
  }
});

// ===== ROUTES FUSION =====

/**
 * GET /forge/fusion/groups
 * Obtenir les groupes d'items fusionnables
 */
router.get('/fusion/groups', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    const filters: any = {};
    
    if (req.query.rarity && validateRarity(req.query.rarity as string)) {
      filters.rarity = req.query.rarity as string;
    }
    
    if (req.query.minCount) {
      const minCount = parseInt(req.query.minCount as string);
      if (!isNaN(minCount) && minCount >= 3) {
        filters.minCount = minCount;
      }
    }

    const forgeService = createForgeService(playerId);
    const groups = await forgeService.getFusableGroups(filters);
    
    res.json({
      success: true,
      data: { groups },
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Fusion groups error:', error);
    res.status(500).json({
      success: false,
      error: 'FUSION_GROUPS_ERROR',
      message: error.message
    });
  }
});

/**
 * POST /forge/fusion/preview
 * Obtenir un aperçu de fusion
 */
router.post('/fusion/preview', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    const { itemInstanceIds } = req.body;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    if (!validateArray(itemInstanceIds, 3, 3)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ITEM_INSTANCE_IDS',
        message: 'Exactly 3 items required for fusion'
      });
    }

    const forgeService = createForgeService(playerId);
    const preview = await forgeService.getFusionPreview(itemInstanceIds);
    
    res.json({
      success: true,
      data: preview,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Fusion preview error:', error);
    res.status(500).json({
      success: false,
      error: 'FUSION_PREVIEW_ERROR',
      message: error.message
    });
  }
});

/**
 * POST /forge/fusion/execute
 * Exécuter une fusion
 */
router.post('/fusion/execute', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    const { itemInstanceIds } = req.body;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    if (!validateArray(itemInstanceIds, 3, 3)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ITEM_INSTANCE_IDS',
        message: 'Exactly 3 items required for fusion'
      });
    }

    const forgeService = createForgeService(playerId);
    
    const options = {
      validateOnly: req.body.validateOnly === true,
      consumeMaterials: req.body.consumeMaterials !== false
    };
    
    const result = await forgeService.executeFusion(itemInstanceIds, options);
    
    // Notification WebSocket
    WebSocketService.notifyForgeFusionResult(playerId, {
      success: result.success,
      consumedItems: result.consumedItems,
      newItem: result.newItem,
      cost: result.cost,
      rarityUpgrade: result.rarityUpgrade,
      statsComparison: result.statsComparison
    });
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Fusion execute error:', error);
    res.status(500).json({
      success: false,
      error: 'FUSION_EXECUTE_ERROR',
      message: error.message
    });
  }
});

// ===== ROUTES TIER UPGRADE =====

/**
 * GET /forge/tier-upgrade/items
 * Obtenir les items upgradables de tier
 */
router.get('/tier-upgrade/items', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    const filters: any = {};
    
    if (req.query.rarity && validateRarity(req.query.rarity as string)) {
      filters.rarity = req.query.rarity as string;
    }
    
    if (req.query.minTier) {
      const minTier = parseInt(req.query.minTier as string);
      if (!isNaN(minTier) && minTier >= 1 && minTier <= 5) {
        filters.minTier = minTier;
      }
    }
    
    if (req.query.maxTier) {
      const maxTier = parseInt(req.query.maxTier as string);
      if (!isNaN(maxTier) && maxTier >= 1 && maxTier <= 5) {
        filters.maxTier = maxTier;
      }
    }

    const forgeService = createForgeService(playerId);
    const items = await forgeService.getUpgradableItems(filters);
    
    res.json({
      success: true,
      data: { items },
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Tier upgrade items error:', error);
    res.status(500).json({
      success: false,
      error: 'TIER_UPGRADE_ITEMS_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /forge/tier-upgrade/:itemInstanceId/cost-to-max
 * Obtenir le coût total pour upgrader un item au maximum
 */
router.get('/tier-upgrade/:itemInstanceId/cost-to-max', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    const { itemInstanceId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    if (!validateItemInstanceId(itemInstanceId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ITEM_INSTANCE_ID',
        message: 'Item instance ID is required'
      });
    }

    const forgeService = createForgeService(playerId);
    const totalCost = await forgeService.getTotalUpgradeCostToMax(itemInstanceId);
    
    res.json({
      success: true,
      data: totalCost,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Total upgrade cost error:', error);
    res.status(500).json({
      success: false,
      error: 'TOTAL_UPGRADE_COST_ERROR',
      message: error.message
    });
  }
});

/**
 * POST /forge/tier-upgrade/:itemInstanceId/preview
 * Obtenir un aperçu de tier upgrade
 */
router.post('/tier-upgrade/:itemInstanceId/preview', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    const { itemInstanceId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    if (!validateItemInstanceId(itemInstanceId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ITEM_INSTANCE_ID',
        message: 'Item instance ID is required'
      });
    }

    const forgeService = createForgeService(playerId);
    
    const options: any = {};
    if (req.body.targetTier && req.body.targetTier >= 2 && req.body.targetTier <= 5) {
      options.targetTier = req.body.targetTier;
    }
    
    const preview = await forgeService.getTierUpgradePreview(itemInstanceId, options);
    
    res.json({
      success: true,
      data: preview,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Tier upgrade preview error:', error);
    res.status(500).json({
      success: false,
      error: 'TIER_UPGRADE_PREVIEW_ERROR',
      message: error.message
    });
  }
});

/**
 * POST /forge/tier-upgrade/:itemInstanceId/execute
 * Exécuter un tier upgrade
 */
router.post('/tier-upgrade/:itemInstanceId/execute', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    const { itemInstanceId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    if (!validateItemInstanceId(itemInstanceId)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ITEM_INSTANCE_ID',
        message: 'Item instance ID is required'
      });
    }

    const forgeService = createForgeService(playerId);
    
    const options: any = {
      validateOnly: req.body.validateOnly === true
    };
    
    if (req.body.targetTier && req.body.targetTier >= 2 && req.body.targetTier <= 5) {
      options.targetTier = req.body.targetTier;
    }
    
    const result = await forgeService.executeTierUpgrade(itemInstanceId, options);
    
    // Notification WebSocket
    WebSocketService.notifyForgeTierUpgradeResult(playerId, {
      success: result.success,
      itemInstanceId: result.itemInstanceId,
      itemName: result.itemName,
      previousTier: result.previousTier,
      newTier: result.newTier,
      cost: result.cost,
      tierMultiplier: result.tierMultiplier,
      statsImprovement: result.statsImprovement,
      maxTierReached: result.maxTierReached,
      unlockedFeatures: result.unlockedFeatures
    });
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Forge] Tier upgrade execute error:', error);
    res.status(500).json({
      success: false,
      error: 'TIER_UPGRADE_EXECUTE_ERROR',
      message: error.message
    });
  }
});

// ===== ROUTES AVANCÉES =====

/**
 * POST /forge/batch
 * Exécuter des opérations en lot
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId || req.userId;
    const { operations } = req.body;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'PLAYER_ID_REQUIRED',
        message: 'Player ID is required'
      });
    }

    if (!validateArray(operations, 1, 10)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_OPERATIONS',
        message: '1-10 operations allowed'
      });
    }

    // Valider chaque opération
    for (const op of operations) {
      if (!validateOperationType(op.type)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_OPERATION_TYPE',
          message: `Invalid operation type: ${op.type}`
        });
      }
      
      if (!validateItemInstanceId(op.itemInstanceId)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_ITEM_INSTANCE_ID',
          message: 'All operations must have valid item instance IDs'
        });
      }
    }

    const forgeService = createForgeService(playerId);

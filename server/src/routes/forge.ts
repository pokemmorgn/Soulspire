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
        playerPowerScore: 0,
        playerLevel: 0,
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
    const result = await forgeService.executeBatchOperations(operations);
    
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

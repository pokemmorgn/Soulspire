// server/src/routes/forge.ts
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { ForgeService, createForgeService } from '../services/forge/ForgeService';
import { WebSocketService } from '../services/WebSocketService';
import { body, param, query } from 'express-validator';

const router = Router();

// ===== MIDDLEWARE =====

// Authentification requise pour toutes les routes forge
router.use(authenticateToken);

// ===== VALIDATION SCHEMAS =====

const enhancementValidation = [
  param('itemInstanceId').isString().notEmpty().withMessage('Item instance ID required'),
  body('usePaidGemsToGuarantee').optional().isBoolean(),
  body('forceGuaranteed').optional().isBoolean()
];

const reforgeValidation = [
  param('itemInstanceId').isString().notEmpty().withMessage('Item instance ID required'),
  body('lockedStats').optional().isArray(),
  body('lockedStats.*').isString(),
  body('simulationMode').optional().isBoolean()
];

const fusionValidation = [
  body('itemInstanceIds').isArray({ min: 3, max: 3 }).withMessage('Exactly 3 items required for fusion'),
  body('itemInstanceIds.*').isString().notEmpty(),
  body('validateOnly').optional().isBoolean(),
  body('consumeMaterials').optional().isBoolean()
];

const tierUpgradeValidation = [
  param('itemInstanceId').isString().notEmpty().withMessage('Item instance ID required'),
  body('targetTier').optional().isInt({ min: 2, max: 5 }),
  body('validateOnly').optional().isBoolean()
];

const batchOperationValidation = [
  body('operations').isArray({ min: 1, max: 10 }).withMessage('1-10 operations allowed'),
  body('operations.*.type').isIn(['enhancement', 'reforge', 'fusion', 'tierUpgrade']),
  body('operations.*.itemInstanceId').isString().notEmpty(),
  body('operations.*.parameters').optional().isObject()
];

// ===== ROUTES PRINCIPALES =====

/**
 * GET /forge/status
 * Obtenir le statut complet de la forge pour le joueur
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
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
    const playerId = (req as any).user.userId;
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
    const playerId = (req as any).user.userId;
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
    const playerId = (req as any).user.userId;
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
router.get('/enhancement/items', [
  query('rarity').optional().isIn(['Common', 'Rare', 'Epic', 'Legendary', 'Mythic']),
  query('maxLevel').optional().isInt({ min: 0, max: 30 })
], validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const forgeService = createForgeService(playerId);
    
    const filters = {
      rarity: req.query.rarity as string,
      maxLevel: req.query.maxLevel ? parseInt(req.query.maxLevel as string) : undefined
    };
    
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
router.get('/enhancement/:itemInstanceId/cost', enhancementValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const { itemInstanceId } = req.params;
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
router.post('/enhancement/:itemInstanceId/execute', enhancementValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const { itemInstanceId } = req.params;
    const forgeService = createForgeService(playerId);
    
    const options = {
      usePaidGemsToGuarantee: req.body.usePaidGemsToGuarantee,
      forceGuaranteed: req.body.forceGuaranteed
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
router.get('/reforge/items', [
  query('rarity').optional().isIn(['Common', 'Rare', 'Epic', 'Legendary', 'Mythic']),
  query('slot').optional().isIn(['Weapon', 'Armor', 'Helmet', 'Boots', 'Gloves', 'Accessory'])
], validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const forgeService = createForgeService(playerId);
    
    const filters = {
      rarity: req.query.rarity as string,
      slot: req.query.slot as string
    };
    
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
router.get('/reforge/:equipmentSlot/stats', [
  param('equipmentSlot').isIn(['Weapon', 'Armor', 'Helmet', 'Boots', 'Gloves', 'Accessory'])
], validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const { equipmentSlot } = req.params;
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
router.post('/reforge/:itemInstanceId/preview', reforgeValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const { itemInstanceId } = req.params;
    const forgeService = createForgeService(playerId);
    
    const options = {
      lockedStats: req.body.lockedStats || []
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
router.post('/reforge/:itemInstanceId/execute', reforgeValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const { itemInstanceId } = req.params;
    const forgeService = createForgeService(playerId);
    
    const options = {
      lockedStats: req.body.lockedStats || [],
      simulationMode: req.body.simulationMode || false
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
router.get('/fusion/groups', [
  query('rarity').optional().isIn(['Common', 'Rare', 'Epic', 'Legendary']),
  query('minCount').optional().isInt({ min: 3 })
], validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const forgeService = createForgeService(playerId);
    
    const filters = {
      rarity: req.query.rarity as string,
      minCount: req.query.minCount ? parseInt(req.query.minCount as string) : undefined
    };
    
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
router.post('/fusion/preview', fusionValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const { itemInstanceIds } = req.body;
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
router.post('/fusion/execute', fusionValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const { itemInstanceIds } = req.body;
    const forgeService = createForgeService(playerId);
    
    const options = {
      validateOnly: req.body.validateOnly || false,
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
router.get('/tier-upgrade/items', [
  query('rarity').optional().isIn(['Common', 'Rare', 'Epic', 'Legendary', 'Mythic']),
  query('minTier').optional().isInt({ min: 1, max: 5 }),
  query('maxTier').optional().isInt({ min: 1, max: 5 })
], validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const forgeService = createForgeService(playerId);
    
    const filters = {
      rarity: req.query.rarity as string,
      minTier: req.query.minTier ? parseInt(req.query.minTier as string) : undefined,
      maxTier: req.query.maxTier ? parseInt(req.query.maxTier as string) : undefined
    };
    
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
router.get('/tier-upgrade/:itemInstanceId/cost-to-max', [
  param('itemInstanceId').isString().notEmpty()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const { itemInstanceId } = req.params;
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
router.post('/tier-upgrade/:itemInstanceId/preview', tierUpgradeValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const { itemInstanceId } = req.params;
    const forgeService = createForgeService(playerId);
    
    const options = {
      targetTier: req.body.targetTier
    };
    
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
router.post('/tier-upgrade/:itemInstanceId/execute', tierUpgradeValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const { itemInstanceId } = req.params;
    const forgeService = createForgeService(playerId);
    
    const options = {
      targetTier: req.body.targetTier,
      validateOnly: req.body.validateOnly || false
    };
    
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
router.post('/batch', batchOperationValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const playerId = (req as any).user.userId;
    const { operations } = req.body;
    const forgeService = createForgeService(playerId);
    
    const result = await forgeService.executeBatchOperations(operations);
    
    // Notification WebSocket pour le batch
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

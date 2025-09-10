// src/services/ForgeService.ts
import mongoose from "mongoose";
import { ForgeService as BaseForgeService, createForgeService, IForgeMainServiceConfig, DEFAULT_FORGE_SERVICE_CONFIG } from "../models/Forge/index";
import { IForgeOperationResult, IForgeResourceCost } from "../models/Forge/ForgeCore";
import { IReforgeResult } from "../models/Forge/ForgeReforge";

/**
 * Service principal de la Forge - Orchestrateur de tous les modules de forge
 * 
 * Ce service sert d'interface unifiée pour :
 * - Reforge (modification des stats d'équipement avec système de lock)
 * - Enhancement (amélioration +0 à +30 avec système de pity)
 * - Fusion (3 items identiques → rareté supérieure)
 * - Tier Upgrade (T1 à T5 avec multiplicateurs de stats)
 * 
 * Toutes les opérations sont server-side pour éviter la triche.
 */
export class ForgeService {
  private static instances: Map<string, BaseForgeService> = new Map();
  private static configCache: IForgeMainServiceConfig | null = null;

  // === FACTORY METHODS ===

  /**
   * Obtient une instance de ForgeService pour un joueur (avec cache)
   */
  static getInstance(playerId: string, config?: Partial<IForgeMainServiceConfig>): BaseForgeService {
    const cacheKey = `${playerId}_${JSON.stringify(config || {})}`;
    
    if (!this.instances.has(cacheKey)) {
      const finalConfig = config ? 
        { ...DEFAULT_FORGE_SERVICE_CONFIG, ...config } : 
        this.getConfig();
        
      this.instances.set(cacheKey, createForgeService(playerId, finalConfig));
    }

    return this.instances.get(cacheKey)!;
  }

  /**
   * Nettoie le cache des instances (pour éviter les fuites mémoire)
   */
  static clearCache(playerId?: string): void {
    if (playerId) {
      // Supprimer seulement les instances de ce joueur
      const keysToDelete = Array.from(this.instances.keys())
        .filter(key => key.startsWith(`${playerId}_`));
      
      keysToDelete.forEach(key => this.instances.delete(key));
    } else {
      // Nettoyer tout le cache
      this.instances.clear();
    }
  }

  /**
   * Récupère la configuration globale (peut être overridée)
   */
  static getConfig(): IForgeMainServiceConfig {
    if (!this.configCache) {
      this.configCache = { ...DEFAULT_FORGE_SERVICE_CONFIG };
    }
    return this.configCache;
  }

  /**
   * Met à jour la configuration globale
   */
  static updateConfig(updates: Partial<IForgeMainServiceConfig>): void {
    this.configCache = this.configCache ? 
      { ...this.configCache, ...updates } : 
      { ...DEFAULT_FORGE_SERVICE_CONFIG, ...updates };
    
    // Invalider le cache des instances pour forcer recréation
    this.instances.clear();
  }

  // === MÉTHODES UTILITAIRES GLOBALES ===

  /**
   * Valide qu'un joueur a les permissions pour utiliser la forge
   */
  static async validatePlayerAccess(playerId: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      const Player = mongoose.model('Player');
      const player = await Player.findById(playerId);
      
      if (!player) {
        return { valid: false, reason: "PLAYER_NOT_FOUND" };
      }

      // Vérifier niveau minimum global pour la forge
      const minLevel = 5; // Niveau minimum pour accéder à la forge
      if (player.level < minLevel) {
        return { valid: false, reason: "PLAYER_LEVEL_TOO_LOW" };
      }

      // Vérifier que le joueur n'est pas banni de la forge
      if ((player as any).forgeBanned) {
        return { valid: false, reason: "PLAYER_FORGE_BANNED" };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: "VALIDATION_ERROR" };
    }
  }

  /**
   * Calcule les statistiques globales de la forge pour un joueur
   */
  static async getPlayerForgeStats(playerId: string): Promise<{
    totalOperations: number;
    totalGoldSpent: number;
    totalGemsSpent: number;
    moduleBreakdown: { [module: string]: any };
    favoriteModule: string;
    lastActivity: Date | null;
  }> {
    try {
      const forgeService = this.getInstance(playerId);
      const [status, moduleStats] = await Promise.all([
        forgeService.getForgeStatus(),
        forgeService.getAllModuleStats()
      ]);

      let totalOperations = 0;
      let totalGoldSpent = 0;
      let totalGemsSpent = 0;
      let favoriteModule = "none";
      let maxOperations = 0;
      let lastActivity: Date | null = null;

      // Agréger les stats de tous les modules
      for (const [moduleName, stats] of Object.entries(moduleStats)) {
        if (stats.totalOperations) {
          totalOperations += stats.totalOperations;
        }
        if (stats.totalGoldSpent) {
          totalGoldSpent += stats.totalGoldSpent;
        }
        if (stats.totalGemsSpent) {
          totalGemsSpent += stats.totalGemsSpent;
        }
        if (stats.totalOperations > maxOperations) {
          maxOperations = stats.totalOperations;
          favoriteModule = moduleName;
        }
        if (stats.lastOperation && (!lastActivity || new Date(stats.lastOperation) > lastActivity)) {
          lastActivity = new Date(stats.lastOperation);
        }
      }

      return {
        totalOperations,
        totalGoldSpent,
        totalGemsSpent,
        moduleBreakdown: moduleStats,
        favoriteModule,
        lastActivity
      };
    } catch (error) {
      return {
        totalOperations: 0,
        totalGoldSpent: 0,
        totalGemsSpent: 0,
        moduleBreakdown: {},
        favoriteModule: "none",
        lastActivity: null
      };
    }
  }

  /**
   * Obtient des recommandations d'actions pour un joueur
   */
  static async getPlayerRecommendations(playerId: string): Promise<Array<{
    type: 'enhancement' | 'fusion' | 'reforge' | 'tierUpgrade' | 'resource';
    priority: 'low' | 'medium' | 'high';
    message: string;
    action?: string;
    itemInstanceId?: string;
  }>> {
    try {
      const forgeService = this.getInstance(playerId);
      const status = await forgeService.getForgeStatus();
      const recommendations: any[] = [];

      // Recommandations basées sur les ressources
      if (status.playerResources.gold < 5000) {
        recommendations.push({
          type: 'resource',
          priority: 'high',
          message: 'LOW_GOLD_WARNING',
          action: 'FARM_MORE_GOLD'
        });
      }

      if (status.playerResources.gems > 10000) {
        recommendations.push({
          type: 'enhancement',
          priority: 'medium',
          message: 'HIGH_GEM_COUNT_USE_FOR_GUARANTEES',
          action: 'USE_GUARANTEED_ENHANCEMENT'
        });
      }

      // Recommandations basées sur l'inventaire
      if (status.inventory.fusableItems > 5) {
        recommendations.push({
          type: 'fusion',
          priority: 'medium',
          message: 'MANY_FUSABLE_ITEMS_AVAILABLE',
          action: 'CONSIDER_FUSION'
        });
      }

      if (status.inventory.enhanceableItems > 20) {
        recommendations.push({
          type: 'enhancement',
          priority: 'low',
          message: 'MANY_ITEMS_NEED_ENHANCEMENT',
          action: 'BULK_ENHANCEMENT'
        });
      }

      if (status.inventory.upgradeableItems > 3) {
        recommendations.push({
          type: 'tierUpgrade',
          priority: 'medium',
          message: 'TIER_UPGRADES_AVAILABLE',
          action: 'UPGRADE_EQUIPMENT_TIERS'
        });
      }

      // Recommandations basées sur l'utilisation des modules
      const moduleStats = await forgeService.getAllModuleStats();
      const reforgeStats = moduleStats.reforge;
      
      if (reforgeStats && reforgeStats.successRate < 0.3) {
        recommendations.push({
          type: 'reforge',
          priority: 'low',
          message: 'LOW_REFORGE_SUCCESS_RATE',
          action: 'LOCK_MORE_STATS'
        });
      }

      return recommendations;
    } catch (error) {
      return [];
    }
  }

  /**
   * Exporte les données de forge d'un joueur (pour analytics/debug)
   */
  static async exportPlayerData(playerId: string): Promise<{
    playerId: string;
    exportDate: string;
    forgeStatus: any;
    forgeStats: any;
    recommendations: any[];
    inventorySummary: {
      totalEquipment: number;
      enhanceableItems: number;
      fusableGroups: number;
      upgradeableItems: number;
    };
  }> {
    const forgeService = this.getInstance(playerId);
    const [status, stats, recommendations] = await Promise.all([
      forgeService.getForgeStatus(),
      this.getPlayerForgeStats(playerId),
      this.getPlayerRecommendations(playerId)
    ]);

    return {
      playerId,
      exportDate: new Date().toISOString(),
      forgeStatus: status,
      forgeStats: stats,
      recommendations,
      inventorySummary: {
        totalEquipment: Object.values(status.inventory).reduce((sum, count) => sum + count, 0),
        enhanceableItems: status.inventory.enhanceableItems,
        fusableGroups: status.inventory.fusableItems,
        upgradeableItems: status.inventory.upgradeableItems
      }
    };
  }

  // === MÉTHODES DE MONITORING ===

  /**
   * Vérifie la santé du système de forge
   */
  static async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      databaseConnection: boolean;
      moduleInitialization: boolean;
      configurationValid: boolean;
    };
    timestamp: string;
  }> {
    const checks = {
      databaseConnection: true,
      moduleInitialization: true,
      configurationValid: true
    };

    try {
      // Test connexion MongoDB
      await mongoose.connection.db.admin().ping();
    } catch (error) {
      checks.databaseConnection = false;
    }

    try {
      // Test initialisation des modules
      const testService = this.getInstance('test_player');
      await testService.getForgeStatus();
    } catch (error) {
      checks.moduleInitialization = false;
    }

    try {
      // Test configuration
      const config = this.getConfig();
      if (!config.reforge || !config.enhancement || !config.fusion || !config.tierUpgrade) {
        checks.configurationValid = false;
      }
    } catch (error) {
      checks.configurationValid = false;
    }

    const allHealthy = Object.values(checks).every(check => check === true);
    const status = allHealthy ? 'healthy' : 
                  Object.values(checks).filter(check => check === true).length >= 2 ? 'degraded' : 'unhealthy';

    return {
      status,
      checks,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Collecte des métriques système pour monitoring
   */
  static async getSystemMetrics(): Promise<{
    activeInstances: number;
    cacheSize: number;
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    moduleStatus: {
      [moduleName: string]: {
        enabled: boolean;
        operationsToday: number;
      };
    };
  }> {
    const config = this.getConfig();
    const moduleStatus: any = {};

    // Status des modules
    for (const [moduleName, moduleConfig] of Object.entries(config)) {
      moduleStatus[moduleName] = {
        enabled: moduleConfig.enabled,
        operationsToday: 0 // À implémenter avec un système de logs
      };
    }

    return {
      activeInstances: this.instances.size,
      cacheSize: this.instances.size,
      memoryUsage: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      },
      moduleStatus
    };
  }

  // === MÉTHODES D'ADMINISTRATION ===

  /**
   * Force la recalculation des stats d'un item (admin)
   */
  static async recalculateItemStats(playerId: string, itemInstanceId: string): Promise<{
    success: boolean;
    previousStats: any;
    newStats: any;
    message: string;
  }> {
    try {
      const forgeService = this.getInstance(playerId);
      const inventory = await (forgeService as any).getInventory();
      
      if (!inventory) {
        return {
          success: false,
          previousStats: null,
          newStats: null,
          message: "INVENTORY_NOT_FOUND"
        };
      }

      const ownedItem = inventory.getItem(itemInstanceId);
      if (!ownedItem) {
        return {
          success: false,
          previousStats: null,
          newStats: null,
          message: "ITEM_NOT_FOUND"
        };
      }

      const previousStats = { ...ownedItem.stats };

      // Recalculer les stats basé sur le niveau, enhancement, tier, etc.
      const Item = mongoose.model('Item');
      const baseItem = await Item.findOne({ itemId: ownedItem.itemId });
      
      if (!baseItem) {
        return {
          success: false,
          previousStats,
          newStats: null,
          message: "BASE_ITEM_NOT_FOUND"
        };
      }

      // Utiliser la méthode de ForgeCore pour recalculer
      const baseStats = baseItem.baseStats || {};
      const statsPerLevel = baseItem.statsPerLevel || {};
      const level = ownedItem.level || 1;
      const enhancement = ownedItem.enhancement || 0;

      const newStats = (forgeService as any).calculateItemStatsWithEnhancement(
        baseStats,
        statsPerLevel,
        level,
        enhancement
      );

      // Appliquer multiplicateur de tier si applicable
      if ((ownedItem as any).tier && (ownedItem as any).tier > 1) {
        const tierMultipliers: { [tier: number]: number } = {
          1: 1.0, 2: 1.25, 3: 1.60, 4: 2.10, 5: 2.80
        };
        
        const tierMultiplier = tierMultipliers[(ownedItem as any).tier] || 1.0;
        for (const [stat, value] of Object.entries(newStats)) {
          if (typeof value === 'number') {
            newStats[stat] = Math.floor(value * tierMultiplier);
          }
        }
      }

      // Sauvegarder les nouvelles stats
      ownedItem.stats = newStats;
      await inventory.save();

      return {
        success: true,
        previousStats,
        newStats,
        message: "ITEM_STATS_RECALCULATED"
      };
    } catch (error: any) {
      return {
        success: false,
        previousStats: null,
        newStats: null,
        message: error.message || "RECALCULATION_FAILED"
      };
    }
  }

  /**
   * Reset le pity d'un item (admin emergency)
   */
  static async resetItemPity(playerId: string, itemInstanceId: string): Promise<{
    success: boolean;
    message: string;
    previousPity: number;
  }> {
    try {
      const forgeService = this.getInstance(playerId);
      const inventory = await (forgeService as any).getInventory();
      
      if (!inventory) {
        return {
          success: false,
          message: "INVENTORY_NOT_FOUND",
          previousPity: 0
        };
      }

      const ownedItem = inventory.getItem(itemInstanceId);
      if (!ownedItem) {
        return {
          success: false,
          message: "ITEM_NOT_FOUND",
          previousPity: 0
        };
      }

      const previousPity = ownedItem.enhancementPity || 0;
      
      // Reset pity fields
      ownedItem.enhancementPity = 0;
      ownedItem.lastResetFailures = 0;
      ownedItem.lastResetLevel = ownedItem.enhancement || 0;

      await inventory.save();

      return {
        success: true,
        message: "PITY_RESET_SUCCESS",
        previousPity
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "PITY_RESET_FAILED",
        previousPity: 0
      };
    }
  }
}

export default ForgeService;

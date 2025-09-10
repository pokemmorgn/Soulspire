import mongoose from 'mongoose';
import { ForgeOperation } from '../../models/forging/ForgeOperation';
import { ForgeStats } from '../../models/forging/ForgeStats';
import { ForgeConfig } from '../../models/forging/ForgeConfig';

// Import des services spécialisés
import EnhancementService, { EnhancementOptions, EnhancementResult, EnhancementCost } from './EnhancementService';
import ReforgeService, { ReforgeOptions, ReforgeResult, ReforgeCost, ReforgePreview } from './ReforgeService';
import FusionService, { FusionOptions, FusionResult, FusionCost, FusionPreview, FusableGroup } from './FusionService';
import TierUpgradeService, { TierUpgradeOptions, TierUpgradeResult, TierUpgradeCost, TierUpgradePreview, UpgradableItem } from './TierUpgradeService';

// === INTERFACES PRINCIPALES ===

export interface ForgeStatus {
  playerId: string;
  playerResources: {
    gold: number;
    gems: number;
    paidGems: number;
  };
  modules: {
    reforge: {
      enabled: boolean;
      stats: any;
      availableOperations: number;
    };
    enhancement: {
      enabled: boolean;
      stats: any;
      availableOperations: number;
      maxLevel: number;
    };
    fusion: {
      enabled: boolean;
      stats: any;
      availableOperations: number;
      requiredItems: number;
    };
    tierUpgrade: {
      enabled: boolean;
      stats: any;
      availableOperations: number;
      maxTier: number;
    };
  };
  inventory: {
    reforgeableItems: number;
    enhanceableItems: number;
    fusableItems: number;
    upgradeableItems: number;
  };
  globalStats: {
    totalOperations: number;
    totalGoldSpent: number;
    totalGemsSpent: number;
    totalPowerGained: number;
    favoriteModule: string;
    lastActivity: Date | null;
  };
}

export interface BatchOperation {
  type: 'reforge' | 'enhancement' | 'fusion' | 'tierUpgrade';
  itemInstanceId: string;
  parameters?: any;
}

export interface BatchOperationResult {
  success: boolean;
  completedOperations: number;
  totalOperations: number;
  results: Array<{
    operation: BatchOperation;
    success: boolean;
    result?: any;
    error?: string;
  }>;
  totalCost: {
    gold: number;
    gems: number;
    materials: { [materialId: string]: number };
  };
  totalPowerGain: number;
  executionTime: number;
}

export interface ForgeRecommendation {
  type: 'enhancement' | 'reforge' | 'fusion' | 'tierUpgrade';
  priority: 'low' | 'medium' | 'high';
  itemInstanceId: string;
  itemName: string;
  reasoning: string;
  expectedBenefit: string;
  cost: any;
  powerGainEstimate: number;
  efficiencyScore: number; // power gain / cost ratio
}

// === SERVICE PRINCIPAL ===

export class ForgeService {
  private playerId: string;
  
  // Services spécialisés
  private enhancementService: EnhancementService;
  private reforgeService: ReforgeService;
  private fusionService: FusionService;
  private tierUpgradeService: TierUpgradeService;
  
  constructor(playerId: string) {
    this.playerId = playerId;
    
    // Initialiser tous les services spécialisés
    this.enhancementService = new EnhancementService(playerId);
    this.reforgeService = new ReforgeService(playerId);
    this.fusionService = new FusionService(playerId);
    this.tierUpgradeService = new TierUpgradeService(playerId);
  }

  // === MÉTHODES PUBLIQUES PRINCIPALES ===

  /**
   * Récupère le statut complet de la forge pour ce joueur
   */
  async getForgeStatus(): Promise<ForgeStatus> {
    try {
      const [player, inventory, config, playerStats] = await Promise.all([
        this.getPlayer(),
        this.getPlayerInventory(),
        this.getForgeConfig(),
        this.getPlayerStats()
      ]);

      if (!player || !inventory) {
        throw new Error('PLAYER_OR_INVENTORY_NOT_FOUND');
      }

      // Compter les items par catégorie
      const inventoryStats = await this.countInventoryItems(inventory);

      const status: ForgeStatus = {
        playerId: this.playerId,
        playerResources: {
          gold: player.gold || 0,
          gems: player.gems || 0,
          paidGems: player.paidGems || 0
        },
        modules: {
          reforge: {
            enabled: config?.isModuleEnabled('reforge') || false,
            stats: playerStats?.moduleStats?.reforge || this.getDefaultModuleStats(),
            availableOperations: inventoryStats.reforgeableItems
          },
          enhancement: {
            enabled: config?.isModuleEnabled('enhancement') || false,
            stats: playerStats?.moduleStats?.enhancement || this.getDefaultModuleStats(),
            availableOperations: inventoryStats.enhanceableItems,
            maxLevel: 30
          },
          fusion: {
            enabled: config?.isModuleEnabled('fusion') || false,
            stats: playerStats?.moduleStats?.fusion || this.getDefaultModuleStats(),
            availableOperations: inventoryStats.fusableItems,
            requiredItems: 3
          },
          tierUpgrade: {
            enabled: config?.isModuleEnabled('tierUpgrade') || false,
            stats: playerStats?.moduleStats?.tierUpgrade || this.getDefaultModuleStats(),
            availableOperations: inventoryStats.upgradeableItems,
            maxTier: 5
          }
        },
        inventory: inventoryStats,
        globalStats: {
          totalOperations: playerStats?.globalStats?.totalOperations || 0,
          totalGoldSpent: playerStats?.globalStats?.totalGoldSpent || 0,
          totalGemsSpent: playerStats?.globalStats?.totalGemsSpent || 0,
          totalPowerGained: playerStats?.globalStats?.totalPowerGained || 0,
          favoriteModule: playerStats?.globalStats?.favoriteModule || 'none',
          lastActivity: playerStats?.globalStats?.lastForgeDate || null
        }
      };

      return status;
    } catch (error: any) {
      console.error('[ForgeService] getForgeStatus error:', error);
      throw new Error(`FAILED_TO_GET_FORGE_STATUS: ${error.message}`);
    }
  }

  // === DÉLÉGATION AUX SERVICES SPÉCIALISÉS ===

  // Enhancement
  async getEnhancementCost(itemInstanceId: string, options?: EnhancementOptions): Promise<EnhancementCost> {
    return this.enhancementService.getEnhancementCost(itemInstanceId, options);
  }

  async executeEnhancement(itemInstanceId: string, options?: EnhancementOptions): Promise<EnhancementResult> {
    return this.enhancementService.attemptEnhancement(itemInstanceId, options);
  }

  async getEnhanceableItems(filters?: { rarity?: string; maxLevel?: number }) {
    return this.enhancementService.getEnhanceableItems(filters);
  }

  // Reforge
  async getReforgePreview(itemInstanceId: string, options?: ReforgeOptions): Promise<ReforgePreview> {
    return this.reforgeService.getReforgePreview(itemInstanceId, options);
  }

  async executeReforge(itemInstanceId: string, options?: ReforgeOptions): Promise<ReforgeResult> {
    return this.reforgeService.executeReforge(itemInstanceId, options);
  }

  async getReforgeableItems(filters?: { rarity?: string; slot?: string }) {
    return this.reforgeService.getReforgeableItems(filters);
  }

  getAvailableStatsForSlot(equipmentSlot: string): string[] {
    return this.reforgeService.getAvailableStatsForSlot(equipmentSlot);
  }

  // Fusion
  async getFusionPreview(itemInstanceIds: string[]): Promise<FusionPreview> {
    return this.fusionService.getFusionPreview(itemInstanceIds);
  }

  async executeFusion(itemInstanceIds: string[], options?: FusionOptions): Promise<FusionResult> {
    return this.fusionService.executeFusion(itemInstanceIds, options);
  }

  async getFusableGroups(filters?: { rarity?: string; minCount?: number }): Promise<FusableGroup[]> {
    return this.fusionService.getFusableGroups(filters);
  }

  async getPossibleFusionsCount(itemId: string, rarity: string): Promise<number> {
    return this.fusionService.getPossibleFusionsCount(itemId, rarity);
  }

  // Tier Upgrade
  async getTierUpgradePreview(itemInstanceId: string, options?: TierUpgradeOptions): Promise<TierUpgradePreview> {
    return this.tierUpgradeService.getTierUpgradePreview(itemInstanceId, options);
  }

  async executeTierUpgrade(itemInstanceId: string, options?: TierUpgradeOptions): Promise<TierUpgradeResult> {
    return this.tierUpgradeService.executeTierUpgrade(itemInstanceId, options);
  }

  async getUpgradableItems(filters?: { rarity?: string; minTier?: number; maxTier?: number }): Promise<UpgradableItem[]> {
    return this.tierUpgradeService.getUpgradableItems(filters);
  }

  async getTotalUpgradeCostToMax(itemInstanceId: string) {
    return this.tierUpgradeService.getTotalUpgradeCostToMax(itemInstanceId);
  }

  // === MÉTHODES AVANCÉES ===

  /**
   * Exécute des opérations en lot
   */
  async executeBatchOperations(operations: BatchOperation[]): Promise<BatchOperationResult> {
    const startTime = Date.now();
    const results: any[] = [];
    const totalCost = { gold: 0, gems: 0, materials: {} as { [key: string]: number } };
    let totalPowerGain = 0;
    let completedOperations = 0;

    for (const operation of operations) {
      try {
        let result: any;
        
        switch (operation.type) {
          case 'enhancement':
            result = await this.executeEnhancement(operation.itemInstanceId, operation.parameters);
            break;
            
          case 'reforge':
            result = await this.executeReforge(operation.itemInstanceId, operation.parameters);
            break;
            
          case 'fusion':
            if (operation.parameters?.itemInstanceIds) {
              result = await this.executeFusion(operation.parameters.itemInstanceIds, operation.parameters);
            } else {
              throw new Error('FUSION_REQUIRES_ITEM_INSTANCE_IDS');
            }
            break;
            
          case 'tierUpgrade':
            result = await this.executeTierUpgrade(operation.itemInstanceId, operation.parameters);
            break;
            
          default:
            throw new Error(`UNSUPPORTED_OPERATION_TYPE: ${operation.type}`);
        }

        if (result.success) {
          completedOperations++;
          
          // Accumuler coûts
          if (result.cost) {
            totalCost.gold += result.cost.gold || 0;
            totalCost.gems += result.cost.gems || 0;
            
            if (result.cost.materials) {
              for (const [materialId, amount] of Object.entries(result.cost.materials)) {
                totalCost.materials[materialId] = (totalCost.materials[materialId] || 0) + (amount as number);
              }
            }
          }
          
          // Accumuler power gain
          if (result.statsImprovement?.powerIncrease) {
            totalPowerGain += result.statsImprovement.powerIncrease;
          } else if (result.powerChange) {
            totalPowerGain += result.powerChange;
          }
        }

        results.push({
          operation,
          success: result.success,
          result,
          error: result.success ? undefined : result.message
        });

      } catch (error: any) {
        results.push({
          operation,
          success: false,
          error: error.message || 'UNKNOWN_ERROR'
        });
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      success: completedOperations > 0,
      completedOperations,
      totalOperations: operations.length,
      results,
      totalCost,
      totalPowerGain,
      executionTime
    };
  }

  /**
   * Génère des recommandations intelligentes
   */
  async getRecommendations(): Promise<ForgeRecommendation[]> {
    try {
      const [status, enhanceableItems, reforgeableItems, fusableGroups, upgradableItems] = await Promise.all([
        this.getForgeStatus(),
        this.getEnhanceableItems(),
        this.getReforgeableItems(),
        this.getFusableGroups(),
        this.getUpgradableItems()
      ]);

      const recommendations: ForgeRecommendation[] = [];

      // Recommandations d'enhancement (items bas niveau)
      const lowEnhancementItems = enhanceableItems
        .filter(item => item.enhancement < 10 && item.nextEnhancementCost)
        .slice(0, 3);

      for (const item of lowEnhancementItems) {
        if (!item.nextEnhancementCost) continue;
        
        const efficiencyScore = this.calculateEfficiencyScore(
          item.nextEnhancementCost.gold,
          100 // Estimation power gain
        );

        recommendations.push({
          type: 'enhancement',
          priority: 'medium',
          itemInstanceId: item.instanceId,
          itemName: item.name,
          reasoning: `Low enhancement level (+${item.enhancement}) with good upgrade potential`,
          expectedBenefit: `+${item.enhancement + 1} enhancement level`,
          cost: item.nextEnhancementCost,
          powerGainEstimate: 100,
          efficiencyScore
        });
      }

      // Recommandations de fusion (groupes rentables)
      const profitableFusions = fusableGroups
        .filter(group => group.possibleFusions > 0)
        .sort((a, b) => b.estimatedPowerGain - a.estimatedPowerGain)
        .slice(0, 2);

      for (const group of profitableFusions) {
        const efficiencyScore = this.calculateEfficiencyScore(
          group.fusionCost.gold,
          group.estimatedPowerGain
        );

        recommendations.push({
          type: 'fusion',
          priority: group.estimatedPowerGain > 500 ? 'high' : 'medium',
          itemInstanceId: group.itemId,
          itemName: group.itemName,
          reasoning: `${group.possibleFusions} fusion(s) available for ${group.rarity} → ${group.targetRarity}`,
          expectedBenefit: `${group.rarity} → ${group.targetRarity} upgrade`,
          cost: group.fusionCost,
          powerGainEstimate: group.estimatedPowerGain,
          efficiencyScore
        });
      }

      // Recommandations de tier upgrade (items high value)
      const valuableUpgrades = upgradableItems
        .filter(item => item.canUpgrade && item.powerGainEstimate > 200)
        .sort((a, b) => b.powerGainEstimate - a.powerGainEstimate)
        .slice(0, 2);

      for (const item of valuableUpgrades) {
        if (!item.upgradeCost) continue;
        
        const efficiencyScore = this.calculateEfficiencyScore(
          item.upgradeCost.gold,
          item.powerGainEstimate
        );

        recommendations.push({
          type: 'tierUpgrade',
          priority: item.powerGainEstimate > 1000 ? 'high' : 'medium',
          itemInstanceId: item.instanceId,
          itemName: item.name,
          reasoning: `High power gain potential (T${item.currentTier} → T${item.currentTier + 1})`,
          expectedBenefit: `Tier ${item.currentTier} → ${item.currentTier + 1}`,
          cost: item.upgradeCost,
          powerGainEstimate: item.powerGainEstimate,
          efficiencyScore
        });
      }

      // Trier par priorité puis par efficiency score
      recommendations.sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        return priorityDiff !== 0 ? priorityDiff : b.efficiencyScore - a.efficiencyScore;
      });

      return recommendations.slice(0, 5); // Top 5 recommandations

    } catch (error) {
      console.error('[ForgeService] getRecommendations error:', error);
      return [];
    }
  }

  /**
   * Calcule l'efficiency score (power gain / gold cost)
   */
  private calculateEfficiencyScore(goldCost: number, powerGain: number): number {
    if (goldCost <= 0) return 0;
    return Math.round((powerGain / goldCost) * 1000) / 1000; // 3 décimales
  }

  /**
   * Analyse les patterns d'utilisation du joueur
   */
  async getUsageAnalytics(): Promise<{
    favoriteModule: string;
    operationsThisWeek: number;
    avgDailyOperations: number;
    totalInvestment: { gold: number; gems: number };
    roi: number; // Return on Investment
    efficiency: number; // Power gained per gold spent
    trends: {
      module: string;
      trend: 'increasing' | 'decreasing' | 'stable';
      percentage: number;
    }[];
  }> {
    try {
      const playerStats = await this.getPlayerStats();
      
      if (!playerStats) {
        return this.getDefaultAnalytics();
      }

      // Calculer ROI et efficiency
      const totalInvestment = {
        gold: playerStats.globalStats.totalGoldSpent,
        gems: playerStats.globalStats.totalGemsSpent
      };
      
      const roi = totalInvestment.gold > 0 ? 
        (playerStats.globalStats.totalPowerGained / totalInvestment.gold) * 100 : 0;
      
      const efficiency = totalInvestment.gold > 0 ?
        playerStats.globalStats.totalPowerGained / totalInvestment.gold : 0;

      // Calculer activité hebdomadaire (approximation)
      const daysSinceFirstForge = Math.max(1, Math.ceil(
        (Date.now() - playerStats.globalStats.firstForgeDate.getTime()) / (1000 * 60 * 60 * 24)
      ));
      
      const avgDailyOperations = playerStats.globalStats.totalOperations / daysSinceFirstForge;
      const operationsThisWeek = Math.round(avgDailyOperations * 7);

      // Analyser trends (simplifié)
      const moduleStats = playerStats.moduleStats;
      const trends = Object.entries(moduleStats).map(([module, stats]: [string, any]) => ({
        module,
        trend: 'stable' as const, // Simplification - dans un vrai système on analyserait l'historique
        percentage: 0
      }));

      return {
        favoriteModule: playerStats.globalStats.favoriteModule,
        operationsThisWeek,
        avgDailyOperations: Math.round(avgDailyOperations * 100) / 100,
        totalInvestment,
        roi: Math.round(roi * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        trends
      };

    } catch (error) {
      console.error('[ForgeService] getUsageAnalytics error:', error);
      return this.getDefaultAnalytics();
    }
  }

  /**
   * Estime le coût total pour optimiser tout l'équipement
   */
  async getFullOptimizationCost(): Promise<{
    totalCost: { gold: number; gems: number; materials: { [key: string]: number } };
    operations: {
      enhancements: number;
      reforges: number;
      fusions: number;
      tierUpgrades: number;
    };
    estimatedPowerGain: number;
    estimatedTime: string; // "2h 30m"
  }> {
    try {
      const [enhanceableItems, fusableGroups, upgradableItems] = await Promise.all([
        this.getEnhanceableItems(),
        this.getFusableGroups(),
        this.getUpgradableItems()
      ]);

      let totalGold = 0;
      let totalGems = 0;
      const totalMaterials: { [key: string]: number } = {};
      let estimatedPowerGain = 0;

      const operations = {
        enhancements: 0,
        reforges: 0,
        fusions: 0,
        tierUpgrades: 0
      };

      // Compter enhancements potentiels
      for (const item of enhanceableItems) {
        if (item.nextEnhancementCost && item.enhancement < 20) { // Limite raisonnable
          operations.enhancements++;
          totalGold += item.nextEnhancementCost.gold;
          totalGems += item.nextEnhancementCost.gems;
          estimatedPowerGain += 150; // Estimation
          
          if (item.nextEnhancementCost.materials) {
            for (const [materialId, amount] of Object.entries(item.nextEnhancementCost.materials)) {
              totalMaterials[materialId] = (totalMaterials[materialId] || 0) + amount;
            }
          }
        }
      }

      // Compter fusions rentables
      for (const group of fusableGroups) {
        if (group.possibleFusions > 0 && group.estimatedPowerGain > 100) {
          operations.fusions += group.possibleFusions;
          totalGold += group.fusionCost.gold * group.possibleFusions;
          totalGems += group.fusionCost.gems * group.possibleFusions;
          estimatedPowerGain += group.estimatedPowerGain;
          
          if (group.fusionCost.materials) {
            for (const [materialId, amount] of Object.entries(group.fusionCost.materials)) {
              totalMaterials[materialId] = (totalMaterials[materialId] || 0) + (amount * group.possibleFusions);
            }
          }
        }
      }

      // Compter tier upgrades valuables
      for (const item of upgradableItems) {
        if (item.canUpgrade && item.upgradeCost && item.powerGainEstimate > 200) {
          operations.tierUpgrades++;
          totalGold += item.upgradeCost.gold;
          totalGems += item.upgradeCost.gems;
          estimatedPowerGain += item.powerGainEstimate;
          
          if (item.upgradeCost.materials) {
            for (const [materialId, amount] of Object.entries(item.upgradeCost.materials)) {
              totalMaterials[materialId] = (totalMaterials[materialId] || 0) + amount;
            }
          }
        }
      }

      // Estimer temps (2 sec par opération + loading)
      const totalOperations = Object.values(operations).reduce((sum, count) => sum + count, 0);
      const estimatedMinutes = Math.ceil(totalOperations * 2 / 60);
      const hours = Math.floor(estimatedMinutes / 60);
      const minutes = estimatedMinutes % 60;
      const estimatedTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      return {
        totalCost: {
          gold: totalGold,
          gems: totalGems,
          materials: totalMaterials
        },
        operations,
        estimatedPowerGain,
        estimatedTime
      };

    } catch (error) {
      console.error('[ForgeService] getFullOptimizationCost error:', error);
      return {
        totalCost: { gold: 0, gems: 0, materials: {} },
        operations: { enhancements: 0, reforges: 0, fusions: 0, tierUpgrades: 0 },
        estimatedPowerGain: 0,
        estimatedTime: '0m'
      };
    }
  }

  // === MÉTHODES PRIVÉES ===

  /**
   * Compte les items par catégorie dans l'inventaire
   */
  private async countInventoryItems(inventory: any): Promise<{
    reforgeableItems: number;
    enhanceableItems: number;
    fusableItems: number;
    upgradeableItems: number;
  }> {
    let reforgeableItems = 0;
    let enhanceableItems = 0;
    let fusableItems = 0;
    let upgradeableItems = 0;

    const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
    const ItemModel = mongoose.model('Item');
    
    // Compteur pour fusion (par itemId + rareté)
    const fusionCounts: { [key: string]: number } = {};
    
    for (const category of equipmentCategories) {
      const items = inventory.storage[category] || [];
      
      for (const ownedItem of items) {
        const baseItem = await ItemModel.findOne({ itemId: ownedItem.itemId });
        if (!baseItem || baseItem.category !== 'Equipment') continue;
        
        // Reforge: tous les équipements
        reforgeableItems++;
        
        // Enhancement: items pas au niveau max
        const enhancement = ownedItem.enhancement || 0;
        if (enhancement < 30) {
          enhanceableItems++;
        }
        
        // Tier upgrade: items pas au tier max
        const tier = (ownedItem as any).tier || 1;
        if (tier < 5) {
          upgradeableItems++;
        }
        
        // Fusion: compter par groupes d'items identiques
        const rarity = baseItem.rarity || 'Common';
        const fusionKey = `${ownedItem.itemId}_${rarity}`;
        fusionCounts[fusionKey] = (fusionCounts[fusionKey] || 0) + 1;
      }
    }
    
    // Calculer groupes de fusion (need 3+ items identiques)
    fusableItems = Object.values(fusionCounts)
      .filter(count => count >= 3)
      .reduce((sum, count) => sum + Math.floor(count / 3), 0);

    return {
      reforgeableItems,
      enhanceableItems,
      fusableItems,
      upgradeableItems
    };
  }

  private getDefaultModuleStats() {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      totalGoldSpent: 0,
      totalGemsSpent: 0,
      successRate: 0,
      lastOperation: null
    };
  }

  private getDefaultAnalytics() {
    return {
      favoriteModule: 'none',
      operationsThisWeek: 0,
      avgDailyOperations: 0,
      totalInvestment: { gold: 0, gems: 0 },
      roi: 0,
      efficiency: 0,
      trends: []
    };
  }

  // === MÉTHODES UTILITAIRES ===

  private async getPlayer() {
    const Player = mongoose.model('Player');
    return await Player.findById(this.playerId);
  }

  private async getPlayerInventory() {
    const Inventory = mongoose.model('Inventory');
    return await Inventory.findOne({ playerId: this.playerId });
  }

  private async getForgeConfig() {
    return await (ForgeConfig as any).getActiveConfig();
  }

  private async getPlayerStats() {
    try {
      return await (ForgeStats as any).getOrCreatePlayerStats(this.playerId);
    } catch (error) {
      console.warn('[ForgeService] Failed to get player stats:', error);
      return null;
    }
  }
}

// === FACTORY FUNCTION ===

export function createForgeService(playerId: string): ForgeService {
  return new ForgeService(playerId);
}

export default ForgeService;

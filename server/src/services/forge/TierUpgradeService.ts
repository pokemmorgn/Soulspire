import mongoose from 'mongoose';
import { ForgeOperation } from '../../models/forging/ForgeOperation';
import { ForgeStats } from '../../models/forging/ForgeStats';
import { ForgeConfig } from '../../models/forging/ForgeConfig';

// === INTERFACES ===

export interface TierUpgradeOptions {
  targetTier?: number; // Si pas spécifié, upgrade au tier suivant
  validateOnly?: boolean; // Pour preview
}

export interface TierUpgradeCost {
  gold: number;
  gems: number;
  materials?: { [materialId: string]: number };
}

export interface TierUpgradeResult {
  success: boolean;
  itemInstanceId: string;
  itemName: string;
  previousTier: number;
  newTier: number;
  cost: TierUpgradeCost;
  tierMultiplier: number;
  statsImprovement: {
    oldStats: { [stat: string]: number };
    newStats: { [stat: string]: number };
    powerIncrease: number;
    percentageIncrease: number;
  };
  maxTierReached: boolean;
  unlockedFeatures: string[];
  message: string;
}

export interface TierUpgradePreview {
  itemInstanceId: string;
  itemName: string;
  currentTier: number;
  targetTier: number;
  maxPossibleTier: number;
  cost: TierUpgradeCost;
  multipliers: {
    current: number;
    new: number;
    improvement: string;
  };
  canUpgrade: boolean;
  reason?: string;
  totalCostToMax?: {
    gold: number;
    gems: number;
    materials: { [materialId: string]: number };
    steps: number;
  };
}

export interface UpgradableItem {
  instanceId: string;
  itemId: string;
  name: string;
  rarity: string;
  currentTier: number;
  maxPossibleTier: number;
  canUpgrade: boolean;
  upgradeCost: TierUpgradeCost | null;
  powerGainEstimate: number;
}

// === SERVICE PRINCIPAL ===

export class TierUpgradeService {
  private playerId: string;
  
  // Constantes AFK Arena
  private readonly MAX_TIER = 5;
  private readonly TIER_MULTIPLIERS: { [tier: number]: number } = {
    1: 1.0,    // Tier 1 (base)
    2: 1.25,   // Tier 2 (+25%)
    3: 1.60,   // Tier 3 (+60%) 
    4: 2.10,   // Tier 4 (+110%)
    5: 2.80    // Tier 5 (+180%)
  };
  
  private readonly TIER_COST_MULTIPLIERS: { [tier: number]: number } = {
    2: 1,      // T1→T2
    3: 3,      // T2→T3
    4: 8,      // T3→T4
    5: 20      // T4→T5
  };
  
  private readonly RARITY_TIER_LIMITS: { [rarity: string]: number } = {
    'Common': 2,      // Seulement T1→T2
    'Rare': 3,        // Jusqu'à T3
    'Epic': 4,        // Jusqu'à T4
    'Legendary': 5,   // Jusqu'à T5
    'Mythic': 5,      // Jusqu'à T5
    'Ascended': 5     // Jusqu'à T5
  };
  
  constructor(playerId: string) {
    this.playerId = playerId;
  }

  // === MÉTHODES PUBLIQUES ===

  /**
   * Génère un aperçu d'upgrade de tier
   */
  async getTierUpgradePreview(itemInstanceId: string, options: TierUpgradeOptions = {}): Promise<TierUpgradePreview> {
    try {
      // Validation de base
      const { item, baseItem, config } = await this.validateTierUpgradeRequest(itemInstanceId);
      
      const currentTier = this.getCurrentTier(item);
      const maxPossibleTier = this.getMaxTierForRarity(baseItem.rarity);
      const targetTier = options.targetTier ? Math.min(options.targetTier, maxPossibleTier) : currentTier + 1;
      
      // Vérifications
      if (currentTier >= maxPossibleTier) {
        return {
          itemInstanceId,
          itemName: baseItem.name,
          currentTier,
          targetTier: currentTier,
          maxPossibleTier,
          cost: { gold: 0, gems: 0 },
          multipliers: {
            current: this.TIER_MULTIPLIERS[currentTier] || 1,
            new: this.TIER_MULTIPLIERS[currentTier] || 1,
            improvement: '0%'
          },
          canUpgrade: false,
          reason: 'ITEM_ALREADY_AT_MAX_TIER_FOR_RARITY'
        };
      }
      
      if (targetTier <= currentTier) {
        return {
          itemInstanceId,
          itemName: baseItem.name,
          currentTier,
          targetTier: currentTier,
          maxPossibleTier,
          cost: { gold: 0, gems: 0 },
          multipliers: {
            current: this.TIER_MULTIPLIERS[currentTier] || 1,
            new: this.TIER_MULTIPLIERS[currentTier] || 1,
            improvement: '0%'
          },
          canUpgrade: false,
          reason: 'TARGET_TIER_MUST_BE_HIGHER'
        };
      }
      
      // Calculer coût
      const cost = this.calculateTierUpgradeCost(baseItem, currentTier, targetTier);
      
      // Calculer multiplicateurs
      const currentMultiplier = this.TIER_MULTIPLIERS[currentTier] || 1;
      const newMultiplier = this.TIER_MULTIPLIERS[targetTier] || 1;
      const improvementPercentage = ((newMultiplier / currentMultiplier - 1) * 100).toFixed(1) + '%';
      
      // Calculer coût total au max si demandé
      let totalCostToMax;
      if (targetTier < maxPossibleTier) {
        totalCostToMax = this.calculateTotalCostToMax(baseItem, currentTier, maxPossibleTier);
      }
      
      return {
        itemInstanceId,
        itemName: baseItem.name,
        currentTier,
        targetTier,
        maxPossibleTier,
        cost,
        multipliers: {
          current: currentMultiplier,
          new: newMultiplier,
          improvement: improvementPercentage
        },
        canUpgrade: true,
        totalCostToMax
      };
      
    } catch (error) {
      console.error(`[TierUpgradeService] getTierUpgradePreview error for ${itemInstanceId}:`, error);
      
      return {
        itemInstanceId,
        itemName: 'Unknown Item',
        currentTier: 1,
        targetTier: 1,
        maxPossibleTier: 1,
        cost: { gold: 0, gems: 0 },
        multipliers: { current: 1, new: 1, improvement: '0%' },
        canUpgrade: false,
        reason: error instanceof Error ? error.message : 'TIER_UPGRADE_PREVIEW_ERROR'
      };
    }
  }

  /**
   * Exécute un upgrade de tier
   */
  async executeTierUpgrade(itemInstanceId: string, options: TierUpgradeOptions = {}): Promise<TierUpgradeResult> {
    const startTime = Date.now();
    
    try {
      // 1. Validation complète
      const { player, inventory, item, baseItem, config } = await this.validateTierUpgradeRequest(itemInstanceId);
      
      const currentTier = this.getCurrentTier(item);
      const maxPossibleTier = this.getMaxTierForRarity(baseItem.rarity);
      const targetTier = options.targetTier ? Math.min(options.targetTier, maxPossibleTier) : currentTier + 1;
      
      // 2. Vérifications de base
      if (currentTier >= maxPossibleTier) {
        throw new Error('ITEM_ALREADY_AT_MAX_TIER_FOR_RARITY');
      }
      
      if (targetTier <= currentTier) {
        throw new Error('TARGET_TIER_MUST_BE_HIGHER');
      }
      
      if (currentTier >= this.MAX_TIER) {
        throw new Error('ITEM_AT_ABSOLUTE_MAX_TIER');
      }
      
      // 3. Calculer coût et vérifier ressources
      const cost = this.calculateTierUpgradeCost(baseItem, currentTier, targetTier);
      
      if (!await this.canPlayerAfford(player, cost)) {
        throw new Error('INSUFFICIENT_RESOURCES');
      }
      
      // 4. Mode validation seulement
      if (options.validateOnly) {
        return this.createValidationResult(itemInstanceId, baseItem.name, currentTier, targetTier, cost);
      }
      
      // 5. Calculer stats avant modification
      const oldStats = this.calculateItemStats(baseItem, item);
      const oldPowerScore = this.calculatePowerScore(oldStats);
      
      // 6. Dépenser ressources
      await this.spendPlayerResources(player, inventory, cost);
      
      // 7. Appliquer l'upgrade
      const previousTier = currentTier;
      
      // Modifier le tier de l'item
      (item as any).tier = targetTier;
      
      // Mettre à jour equipmentData.upgradeHistory pour tracking
      if (!item.equipmentData) {
        item.equipmentData = {
          durability: 100,
          socketedGems: [],
          upgradeHistory: []
        };
      }
      
      if (!Array.isArray(item.equipmentData.upgradeHistory)) {
        item.equipmentData.upgradeHistory = [];
      }
      
      // Ajouter une entrée pour chaque tier gagné
      for (let i = previousTier; i < targetTier; i++) {
        item.equipmentData.upgradeHistory.push(new Date());
      }
      
      // 8. Recalculer stats avec nouveau tier
      const newStats = this.calculateItemStatsWithTier(baseItem, item, targetTier);
      item.stats = newStats;
      
      // 9. Sauvegarder
      await Promise.all([
        player.save(),
        inventory.save()
      ]);
      
      // 10. Calculer résultats pour l'UI
      const newPowerScore = this.calculatePowerScore(newStats);
      const powerIncrease = newPowerScore - oldPowerScore;
      const percentageIncrease = oldPowerScore > 0 ? ((powerIncrease / oldPowerScore) * 100) : 0;
      const tierMultiplier = this.TIER_MULTIPLIERS[targetTier] || 1;
      const maxTierReached = targetTier >= maxPossibleTier;
      
      // Features débloquées aux hauts tiers
      const unlockedFeatures = this.getUnlockedFeatures(targetTier);
      
      // 11. Logger l'opération
      const executionTime = Date.now() - startTime;
      await this.logOperation(itemInstanceId, baseItem, cost, true, {
        previousTier,
        newTier: targetTier,
        tierMultiplier,
        powerIncrease,
        maxTierReached,
        executionTime
      });
      
      // 12. Mettre à jour stats du joueur
      await this.updatePlayerStats(cost, true, powerIncrease, {
        maxTierReached: Math.max(targetTier, 0),
        totalTierLevelsGained: targetTier - previousTier,
        maxTierItems: maxTierReached ? 1 : 0
      });
      
      // 13. Construire le résultat
      const result: TierUpgradeResult = {
        success: true,
        itemInstanceId,
        itemName: baseItem.name,
        previousTier,
        newTier: targetTier,
        cost,
        tierMultiplier,
        statsImprovement: {
          oldStats,
          newStats,
          powerIncrease,
          percentageIncrease: Math.round(percentageIncrease * 100) / 100
        },
        maxTierReached,
        unlockedFeatures,
        message: 'TIER_UPGRADE_SUCCESS'
      };
      
      return result;
      
    } catch (error) {
      console.error(`[TierUpgradeService] executeTierUpgrade error for ${itemInstanceId}:`, error);
      
      // Logger l'échec
      const executionTime = Date.now() - startTime;
      try {
        await ForgeOperation.create({
          playerId: this.playerId,
          operationType: 'tierUpgrade',
          itemInstanceId,
          itemId: 'unknown',
          itemName: 'Unknown Item',
          itemRarity: 'Common',
          cost: { gold: 0, gems: 0 },
          beforeData: {},
          result: {
            success: false,
            errorCode: 'TIER_UPGRADE_ERROR',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          },
          operationContext: {
            targetTier: options.targetTier
          },
          executionTimeMs: executionTime,
          playerLevel: 1
        });
      } catch (logError) {
        console.warn('[TierUpgradeService] Failed to log error operation:', logError);
      }
      
      throw error;
    }
  }

  /**
   * Obtient les items upgradables du joueur
   */
  async getUpgradableItems(filters: { rarity?: string; minTier?: number; maxTier?: number } = {}): Promise<UpgradableItem[]> {
    try {
      const inventory = await this.getPlayerInventory();
      const upgradableItems: UpgradableItem[] = [];
      
      const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
      const ItemModel = mongoose.model('Item');
      
      for (const category of equipmentCategories) {
        const items = inventory.storage[category] || [];
        
        for (const ownedItem of items) {
          const baseItem = await ItemModel.findOne({ itemId: ownedItem.itemId });
          if (!baseItem || baseItem.category !== 'Equipment') continue;
          
          const rarity = baseItem.rarity || 'Common';
          const currentTier = this.getCurrentTier(ownedItem);
          const maxPossibleTier = this.getMaxTierForRarity(rarity);
          
          // Appliquer filtres
          if (filters.rarity && rarity !== filters.rarity) continue;
          if (filters.minTier && currentTier < filters.minTier) continue;
          if (filters.maxTier && currentTier > filters.maxTier) continue;
          
          const canUpgrade = currentTier < maxPossibleTier && !ownedItem.isEquipped;
          
          let upgradeCost: TierUpgradeCost | null = null;
          let powerGainEstimate = 0;
          
          if (canUpgrade) {
            try {
              upgradeCost = this.calculateTierUpgradeCost(baseItem, currentTier, currentTier + 1);
              
              // Estimer gain de power
              const currentStats = this.calculateItemStats(baseItem, ownedItem);
              const nextTierStats = this.calculateItemStatsWithTier(baseItem, ownedItem, currentTier + 1);
              powerGainEstimate = this.calculatePowerScore(nextTierStats) - this.calculatePowerScore(currentStats);
            } catch (error) {
              continue; // Si erreur de calcul, skip cet item
            }
          }
          
          upgradableItems.push({
            instanceId: ownedItem.instanceId,
            itemId: ownedItem.itemId,
            name: baseItem.name,
            rarity,
            currentTier,
            maxPossibleTier,
            canUpgrade,
            upgradeCost,
            powerGainEstimate
          });
        }
      }
      
      // Trier par potentiel de gain de power (descendant)
      upgradableItems.sort((a, b) => {
        if (a.canUpgrade !== b.canUpgrade) return b.canUpgrade ? 1 : -1;
        return b.powerGainEstimate - a.powerGainEstimate;
      });
      
      return upgradableItems;
      
    } catch (error) {
      console.error('[TierUpgradeService] getUpgradableItems error:', error);
      return [];
    }
  }

  /**
   * Calcule le coût total pour upgrader un item au maximum
   */
  async getTotalUpgradeCostToMax(itemInstanceId: string): Promise<{
    totalGold: number;
    totalGems: number;
    totalMaterials: { [materialId: string]: number };
    steps: Array<{
      fromTier: number;
      toTier: number;
      cost: TierUpgradeCost;
    }>;
  }> {
    try {
      const { item, baseItem } = await this.validateTierUpgradeRequest(itemInstanceId);
      
      const currentTier = this.getCurrentTier(item);
      const maxTier = this.getMaxTierForRarity(baseItem.rarity);
      
      if (currentTier >= maxTier) {
        throw new Error('ITEM_ALREADY_AT_MAX_TIER');
      }
      
      return this.calculateTotalCostToMax(baseItem, currentTier, maxTier);
      
    } catch (error) {
      console.error(`[TierUpgradeService] getTotalUpgradeCostToMax error for ${itemInstanceId}:`, error);
      throw error;
    }
  }

  // === MÉTHODES PRIVÉES ===

  /**
   * Validation complète d'une demande de tier upgrade
   */
  private async validateTierUpgradeRequest(itemInstanceId: string) {
    const [player, inventory, config] = await Promise.all([
      this.getPlayer(),
      this.getPlayerInventory(),
      this.getForgeConfig()
    ]);
    
    if (!player) throw new Error('PLAYER_NOT_FOUND');
    if (!inventory) throw new Error('INVENTORY_NOT_FOUND');
    if (!config || !config.isModuleEnabled('tierUpgrade')) throw new Error('TIER_UPGRADE_MODULE_DISABLED');
    
    const item = inventory.getItem(itemInstanceId);
    if (!item) throw new Error('ITEM_NOT_FOUND_IN_INVENTORY');
    
    if (item.isEquipped) throw new Error('CANNOT_UPGRADE_EQUIPPED_ITEM');
    
    const ItemModel = mongoose.model('Item');
    const baseItem = await ItemModel.findOne({ itemId: item.itemId });
    if (!baseItem) throw new Error('BASE_ITEM_NOT_FOUND');
    
    if (baseItem.category !== 'Equipment') throw new Error('ONLY_EQUIPMENT_CAN_BE_TIER_UPGRADED');
    
    return { player, inventory, item, baseItem, config };
  }

  /**
   * Obtient le tier actuel d'un item
   */
  private getCurrentTier(item: any): number {
    // Priorité : tier field > equipmentData.tier > upgradeHistory.length + 1
    if (item.tier !== undefined && item.tier !== null && typeof item.tier === 'number') {
      return Math.max(1, Math.min(item.tier, this.MAX_TIER));
    }
    
    if (item.equipmentData?.tier !== undefined && typeof item.equipmentData.tier === 'number') {
      return Math.max(1, Math.min(item.equipmentData.tier, this.MAX_TIER));
    }
    
    try {
      const upgradeHistory = item.equipmentData?.upgradeHistory;
      if (Array.isArray(upgradeHistory)) {
        return Math.max(1, Math.min(upgradeHistory.length + 1, this.MAX_TIER));
      }
    } catch (err) {
      // Continue to default
    }
    
    return 1; // Default tier
  }

  /**
   * Obtient le tier maximum pour une rareté
   */
  private getMaxTierForRarity(rarity: string): number {
    return this.RARITY_TIER_LIMITS[rarity] || 2;
  }

  /**
   * Calcule le coût d'upgrade de tier
   */
  private calculateTierUpgradeCost(baseItem: any, currentTier: number, targetTier: number): TierUpgradeCost {
    const config = { // Valeurs par défaut
      baseGoldCost: 10000,
      baseGemCost: 500
    };
    
    const rarity = baseItem.rarity || 'Common';
    
    let totalGold = 0;
    let totalGems = 0;
    const totalMaterials: { [materialId: string]: number } = {};
    
    // Calculer coût pour chaque tier intermédiaire
    for (let tier = currentTier + 1; tier <= targetTier; tier++) {
      const tierMultiplier = this.TIER_COST_MULTIPLIERS[tier] || Math.pow(2, tier - 1);
      const rarityMultiplier = this.getRarityMultiplier(rarity);
      const finalMultiplier = tierMultiplier * rarityMultiplier;
      
      const stepGold = Math.floor(config.baseGoldCost * finalMultiplier);
      const stepGems = Math.floor(config.baseGemCost * finalMultiplier);
      
      totalGold += stepGold;
      totalGems += stepGems;
      
      // Matériaux pour ce tier
      const materials = this.getTierUpgradeMaterials(rarity, tier);
      for (const [materialId, amount] of Object.entries(materials)) {
        totalMaterials[materialId] = (totalMaterials[materialId] || 0) + amount;
      }
    }
    
    return {
      gold: totalGold,
      gems: totalGems,
      materials: totalMaterials
    };
  }

  /**
   * Calcule le coût total jusqu'au tier maximum
   */
  private calculateTotalCostToMax(baseItem: any, currentTier: number, maxTier: number): {
    totalGold: number;
    totalGems: number;
    totalMaterials: { [materialId: string]: number };
    steps: Array<{ fromTier: number; toTier: number; cost: TierUpgradeCost }>;
  } {
    const steps: Array<{ fromTier: number; toTier: number; cost: TierUpgradeCost }> = [];
    let totalGold = 0;
    let totalGems = 0;
    const totalMaterials: { [materialId: string]: number } = {};
    
    for (let targetTier = currentTier + 1; targetTier <= maxTier; targetTier++) {
      const stepCost = this.calculateTierUpgradeCost(baseItem, targetTier - 1, targetTier);
      
      steps.push({
        fromTier: targetTier - 1,
        toTier: targetTier,
        cost: stepCost
      });
      
      totalGold += stepCost.gold;
      totalGems += stepCost.gems;
      
      if (stepCost.materials) {
        for (const [materialId, amount] of Object.entries(stepCost.materials)) {
          totalMaterials[materialId] = (totalMaterials[materialId] || 0) + amount;
        }
      }
    }
    
    return {
      totalGold,
      totalGems,
      totalMaterials,
      steps
    };
  }

  /**
   * Obtient le multiplicateur de coût par rareté
   */
  private getRarityMultiplier(rarity: string): number {
    const multipliers: { [key: string]: number } = {
      'Common': 1,
      'Rare': 2,
      'Epic': 4,
      'Legendary': 8,
      'Mythic': 16,
      'Ascended': 32
    };
    
    return multipliers[rarity] || 1;
  }

  /**
   * Obtient les matériaux requis pour un tier upgrade
   */
  private getTierUpgradeMaterials(rarity: string, targetTier: number): { [materialId: string]: number } {
    const materials: { [materialId: string]: number } = {};
    
    // Matériaux de base selon le tier cible
    const tierMaterials: { [tier: number]: { [materialId: string]: number } } = {
      2: { 'tier_stone': 5, 'enhancement_dust': 10 },
      3: { 'tier_stone': 10, 'enhancement_dust': 20, 'rare_crystal': 3 },
      4: { 'tier_stone': 20, 'enhancement_dust': 40, 'rare_crystal': 8, 'epic_essence': 2 },
      5: { 'tier_stone': 40, 'enhancement_dust': 80, 'rare_crystal': 20, 'epic_essence': 5, 'legendary_core': 1 }
    };
    
    const baseMaterials = tierMaterials[targetTier] || {};
    Object.assign(materials, baseMaterials);
    
    // Matériaux spécialisés par rareté
    const rarityMaterials: { [rarity: string]: { [materialId: string]: number } } = {
      'Rare': { 'silver_thread': 2 },
      'Epic': { 'golden_thread': 3, 'mystic_ore': 1 },
      'Legendary': { 'platinum_thread': 4, 'mystic_ore': 2, 'divine_shard': 1 },
      'Mythic': { 'mythic_thread': 5, 'divine_shard': 2, 'celestial_essence': 1 },
      'Ascended': { 'ascended_thread': 8, 'celestial_essence': 2, 'primordial_fragment': 1 }
    };
    
    const additionalMaterials = rarityMaterials[rarity] || {};
    Object.assign(materials, additionalMaterials);
    
    // Scaling selon le tier
    const scalingFactor = Math.pow(1.5, targetTier - 2);
    for (const [materialId, amount] of Object.entries(materials)) {
      materials[materialId] = Math.ceil(amount * scalingFactor);
    }
    
    return materials;
  }

  /**
   * Calcule les stats d'un item
   */
  private calculateItemStats(baseItem: any, ownedItem: any): { [stat: string]: number } {
    const baseStats = baseItem.baseStats || {};
    const statsPerLevel = baseItem.statsPerLevel || {};
    const level = ownedItem.level || 1;
    const enhancement = ownedItem.enhancement || 0;
    const currentTier = this.getCurrentTier(ownedItem);
    
    return this.calculateItemStatsWithTier(baseItem, ownedItem, currentTier);
  }

  /**
   * Calcule les stats d'un item avec un tier spécifique
   */
  private calculateItemStatsWithTier(baseItem: any, ownedItem: any, tier: number): { [stat: string]: number } {
    const baseStats = baseItem.baseStats || {};
    const statsPerLevel = baseItem.statsPerLevel || {};
    const level = ownedItem.level || 1;
    const enhancement = ownedItem.enhancement || 0;
    
    // Stats de base + stats par niveau
    const currentStats: { [stat: string]: number } = {};
    for (const [stat, baseValue] of Object.entries(baseStats)) {
      if (typeof baseValue === 'number') {
        const levelBonus = (statsPerLevel[stat] || 0) * Math.max(0, level - 1);
        currentStats[stat] = baseValue + levelBonus;
      }
    }
    
    // Appliquer multiplicateur d'enhancement
    if (enhancement > 0) {
      const enhancementMultiplier = 1 + (enhancement * 0.1);
      for (const [stat, value] of Object.entries(currentStats)) {
        currentStats[stat] = Math.floor(value * enhancementMultiplier);
      }
    }
    
    // Appliquer multiplicateur de tier
    const tierMultiplier = this.TIER_MULTIPLIERS[tier] || 1;
    if (tierMultiplier !== 1) {
      for (const [stat, value] of Object.entries(currentStats)) {
        currentStats[stat] = Math.floor(value * tierMultiplier);
      }
    }
    
    return currentStats;
  }

  /**
   * Calcule le power score d'un set de stats
   */
  private calculatePowerScore(stats: { [stat: string]: number }): number {
    return Object.values(stats).reduce((total, value) => total + (typeof value === 'number' ? value : 0), 0);
  }

  /**
   * Obtient les features débloquées à un tier
   */
  private getUnlockedFeatures(tier: number): string[] {
    const features: string[] = [];
    
    if (tier >= 3) features.push('ENHANCED_VISUAL_EFFECTS');
    if (tier >= 4) features.push('SPECIAL_ABILITIES_UNLOCKED');
    if (tier >= 5) features.push('MAXIMUM_POTENTIAL_REACHED');
    
    return features;
  }

  /**
   * Crée un résultat de validation (pour mode validateOnly)
   */
  private createValidationResult(itemInstanceId: string, itemName: string, currentTier: number, targetTier: number, cost: TierUpgradeCost): TierUpgradeResult {
    const tierMultiplier = this.TIER_MULTIPLIERS[targetTier] || 1;
    const maxTierReached = targetTier >= this.MAX_TIER;
    
    return {
      success: true,
      itemInstanceId,
      itemName,
      previousTier: currentTier,
      newTier: targetTier,
      cost,
      tierMultiplier,
      statsImprovement: {
        oldStats: {},
        newStats: {},
        powerIncrease: 0,
        percentageIncrease: 0
      },
      maxTierReached,
      unlockedFeatures: this.getUnlockedFeatures(targetTier),
      message: 'TIER_UPGRADE_VALIDATION_SUCCESS'
    };
  }

  /**
   * Vérifie si le joueur peut se permettre le coût
   */
  private async canPlayerAfford(player: any, cost: TierUpgradeCost): Promise<boolean> {
    if (player.gold < cost.gold || player.gems < cost.gems) {
      return false;
    }
    
    if (cost.materials) {
      const inventory = await this.getPlayerInventory();
      
      for (const [materialId, requiredAmount] of Object.entries(cost.materials)) {
        if (!inventory.hasItem(materialId, requiredAmount)) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Dépense les ressources du joueur
   */
  private async spendPlayerResources(player: any, inventory: any, cost: TierUpgradeCost): Promise<void> {
    player.gold -= cost.gold;
    player.gems -= cost.gems;
    
    if (cost.materials) {
      for (const [materialId, amount] of Object.entries(cost.materials)) {
        await inventory.removeItemByType(materialId, amount);
      }
    }
  }

  /**
   * Log l'opération dans la base de données
   */
  private async logOperation(itemInstanceId: string, baseItem: any, cost: TierUpgradeCost, success: boolean, additionalData: any): Promise<void> {
    try {
      const player = await this.getPlayer();
      
      await ForgeOperation.create({
        playerId: this.playerId,
        operationType: 'tierUpgrade',
        itemInstanceId,
        itemId: baseItem.itemId,
        itemName: baseItem.name || 'Unknown Item',
        itemRarity: baseItem.rarity || 'Common',
        cost: {
          gold: cost.gold,
          gems: cost.gems,
          materials: new Map(Object.entries(cost.materials || {}))
        },
        beforeData: {
          tier: additionalData.previousTier
        },
        result: {
          success,
          data: additionalData
        },
        afterData: success ? {
          tier: additionalData.newTier
        } : undefined,
        operationContext: {
          targetTier: additionalData.newTier
        },
        executionTimeMs: additionalData.executionTime,
        playerLevel: player?.level || 1
      });
    } catch (error) {
      console.warn('[TierUpgradeService] Failed to log operation:', error);
    }
  }

  /**
   * Met à jour les stats du joueur
   */
  private async updatePlayerStats(cost: TierUpgradeCost, success: boolean, powerGain: number, moduleData: any): Promise<void> {
    try {
      const stats = await (ForgeStats as any).getOrCreatePlayerStats(this.playerId);
      
      stats.updateWithOperation({
        operationType: 'tierUpgrade',
        success,
        goldSpent: cost.gold,
        gemsSpent: cost.gems,
        paidGemsSpent: 0,
        powerGain,
        executionTime: 500, // Approximation
        moduleSpecificData: moduleData
      });
      
      await stats.save();
    } catch (error) {
      console.warn('[TierUpgradeService] Failed to update player stats:', error);
    }
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
}

export default TierUpgradeService;

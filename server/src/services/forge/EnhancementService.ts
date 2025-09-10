import mongoose from 'mongoose';
import { ForgeOperation } from '../../models/forging/ForgeOperation';
import { ForgeStats } from '../../models/forging/ForgeStats';
import { ForgeConfig } from '../../models/forging/ForgeConfig';

// === INTERFACES ===

export interface EnhancementOptions {
  usePaidGemsToGuarantee?: boolean;
  forceGuaranteed?: boolean;
}

export interface EnhancementCost {
  gold: number;
  gems: number;
  paidGems?: number;
  materials?: { [materialId: string]: number };
}

export interface EnhancementResult {
  success: boolean;
  previousLevel: number;
  newLevel: number;
  cost: EnhancementCost;
  pityInfo: {
    currentPity: number;
    pityTriggered: boolean;
    nextGuarantee: number;
  };
  statsImprovement: {
    oldPowerScore: number;
    newPowerScore: number;
    powerIncrease: number;
    statChanges: { [stat: string]: { old: number; new: number } };
  };
  guaranteeUsed: boolean;
  specialEffects: string[];
  message: string;
}

// === SERVICE PRINCIPAL ===

export class EnhancementService {
  private playerId: string;
  
  constructor(playerId: string) {
    this.playerId = playerId;
  }

  // === MÉTHODES PUBLIQUES ===

  /**
   * Calcule le coût d'enhancement pour un item
   */
  async getEnhancementCost(itemInstanceId: string, options: EnhancementOptions = {}): Promise<EnhancementCost> {
    const startTime = Date.now();
    
    try {
      // Validation de base
      const { item, baseItem, config } = await this.validateEnhancementRequest(itemInstanceId);
      
      const currentLevel = item.enhancement || 0;
      const targetLevel = currentLevel + 1;
      
      if (currentLevel >= 30) {
        throw new Error('ITEM_AT_MAX_ENHANCEMENT_LEVEL');
      }
      
      // Calcul du coût de base
      const baseCost = this.calculateBaseCost(config, currentLevel, baseItem.rarity);
      
      // Coût des matériaux
      const materials = this.getRequiredMaterials(baseItem.rarity, targetLevel);
      
      // Coût de garantie si demandé
      let guaranteeCost = 0;
      if (options.usePaidGemsToGuarantee) {
        guaranteeCost = this.calculateGuaranteeCost(currentLevel);
      }
      
      const cost: EnhancementCost = {
        gold: baseCost.gold,
        gems: baseCost.gems + guaranteeCost,
        materials
      };
      
      if (guaranteeCost > 0) {
        cost.paidGems = guaranteeCost;
      }
      
      return cost;
      
    } catch (error) {
      console.error(`[EnhancementService] getEnhancementCost error for ${itemInstanceId}:`, error);
      throw error;
    }
  }

  /**
   * Exécute une tentative d'enhancement
   */
  async attemptEnhancement(itemInstanceId: string, options: EnhancementOptions = {}): Promise<EnhancementResult> {
    const startTime = Date.now();
    
    try {
      // 1. Validation complète
      const { player, inventory, item, baseItem, config } = await this.validateEnhancementRequest(itemInstanceId);
      
      const currentLevel = item.enhancement || 0;
      const targetLevel = currentLevel + 1;
      
      if (currentLevel >= 30) {
        throw new Error('ITEM_AT_MAX_ENHANCEMENT_LEVEL');
      }
      
      // 2. Calculer coût et vérifier ressources
      const cost = await this.getEnhancementCost(itemInstanceId, options);
      
      if (!await this.canPlayerAfford(player, cost)) {
        throw new Error('INSUFFICIENT_RESOURCES');
      }
      
      // 3. Calculer chance de succès
      const { effectiveChance, pityInfo } = this.calculateSuccessChance(currentLevel, item, config);
      
      // 4. Déterminer le résultat
      const guaranteeUsed = options.usePaidGemsToGuarantee || options.forceGuaranteed;
      const pityGuaranteed = pityInfo.pityTriggered;
      
      let success: boolean;
      if (guaranteeUsed || pityGuaranteed) {
        success = true;
      } else {
        success = Math.random() <= effectiveChance;
      }
      
      // 5. Calculer les stats avant modification
      const oldStats = this.calculateItemStats(baseItem, item);
      const oldPowerScore = this.calculatePowerScore(oldStats);
      
      // 6. Dépenser les ressources
      await this.spendPlayerResources(player, inventory, cost);
      
      // 7. Appliquer le résultat
      let newLevel = currentLevel;
      let newStats = oldStats;
      let newPowerScore = oldPowerScore;
      const specialEffects: string[] = [];
      
      if (success) {
        newLevel = targetLevel;
        item.enhancement = newLevel;
        
        // Reset pity si palier critique
        const pityResetLevels = [10, 20, 30];
        if (pityResetLevels.includes(newLevel)) {
          item.lastResetFailures = item.enhancementPity || 0;
          item.enhancementPity = item.lastResetFailures || 0;
          specialEffects.push('pity_reset');
        }
        
        // Effet spécial aux multiples de 10
        if (newLevel % 10 === 0) {
          specialEffects.push('milestone_reached');
        }
        
        // Recalculer stats
        newStats = this.calculateItemStats(baseItem, item);
        item.stats = newStats;
        newPowerScore = this.calculatePowerScore(newStats);
        
      } else {
        // Augmenter pity
        item.enhancementPity = (item.enhancementPity || 0) + 1;
      }
      
      // 8. Sauvegarder
      await Promise.all([
        player.save(),
        inventory.save()
      ]);
      
      // 9. Logger l'opération
      const executionTime = Date.now() - startTime;
      await this.logOperation(itemInstanceId, baseItem, cost, success, {
        previousLevel: currentLevel,
        newLevel,
        pityInfo,
        guaranteeUsed,
        pityGuaranteed,
        executionTime
      });
      
      // 10. Mettre à jour les stats du joueur
      await this.updatePlayerStats(cost, success, newPowerScore - oldPowerScore, {
        maxEnhancementReached: Math.max(newLevel, 0),
        pityTriggered: pityGuaranteed ? 1 : 0,
        guaranteeUsed: guaranteeUsed ? 1 : 0,
        milestoneReached: newLevel % 10 === 0 ? 1 : 0
      });
      
      // 11. Calculer changements de stats pour l'UI
      const statChanges: { [stat: string]: { old: number; new: number } } = {};
      for (const [stat, newValue] of Object.entries(newStats)) {
        if (typeof newValue === 'number' && typeof oldStats[stat] === 'number') {
          statChanges[stat] = { old: oldStats[stat], new: newValue };
        }
      }
      
      // 12. Construire le résultat
      const result: EnhancementResult = {
        success,
        previousLevel: currentLevel,
        newLevel,
        cost,
        pityInfo: {
          currentPity: item.enhancementPity || 0,
          pityTriggered: pityGuaranteed,
          nextGuarantee: Math.max(0, config.enhancement.pityThreshold - (item.enhancementPity || 0))
        },
        statsImprovement: {
          oldPowerScore,
          newPowerScore,
          powerIncrease: newPowerScore - oldPowerScore,
          statChanges
        },
        guaranteeUsed,
        specialEffects,
        message: success ? 'ENHANCEMENT_SUCCESS' : 'ENHANCEMENT_FAILED'
      };
      
      return result;
      
    } catch (error) {
      console.error(`[EnhancementService] attemptEnhancement error for ${itemInstanceId}:`, error);
      
      // Logger l'échec
      const executionTime = Date.now() - startTime;
      try {
        await ForgeOperation.create({
          playerId: this.playerId,
          operationType: 'enhancement',
          itemInstanceId,
          itemId: 'unknown',
          itemName: 'Unknown Item',
          itemRarity: 'Common',
          cost: { gold: 0, gems: 0 },
          beforeData: {},
          result: {
            success: false,
            errorCode: 'ENHANCEMENT_ERROR',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          },
          operationContext: {},
          executionTimeMs: executionTime,
          playerLevel: 1
        });
      } catch (logError) {
        console.warn('[EnhancementService] Failed to log error operation:', logError);
      }
      
      throw error;
    }
  }

  /**
   * Obtient les items enhanceables du joueur
   */
  async getEnhanceableItems(filters: { rarity?: string; maxLevel?: number } = {}): Promise<Array<{
    instanceId: string;
    itemId: string;
    name: string;
    rarity: string;
    currentLevel: number;
    enhancement: number;
    canEnhance: boolean;
    nextEnhancementCost: EnhancementCost | null;
  }>> {
    try {
      const inventory = await this.getPlayerInventory();
      const enhanceableItems: any[] = [];
      
      const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
      const ItemModel = mongoose.model('Item');
      
      for (const category of equipmentCategories) {
        const items = inventory.storage[category] || [];
        
        for (const ownedItem of items) {
          const baseItem = await ItemModel.findOne({ itemId: ownedItem.itemId });
          if (!baseItem) continue;
          
          const enhancement = ownedItem.enhancement || 0;
          const rarity = baseItem.rarity || 'Common';
          
          // Appliquer filtres
          if (filters.rarity && rarity !== filters.rarity) continue;
          if (filters.maxLevel && enhancement >= filters.maxLevel) continue;
          
          const canEnhance = enhancement < 30;
          let nextEnhancementCost: EnhancementCost | null = null;
          
          if (canEnhance) {
            try {
              nextEnhancementCost = await this.getEnhancementCost(ownedItem.instanceId);
            } catch (error) {
              // Si erreur de calcul de coût, item pas enhanceable
              continue;
            }
          }
          
          enhanceableItems.push({
            instanceId: ownedItem.instanceId,
            itemId: ownedItem.itemId,
            name: baseItem.name,
            rarity,
            currentLevel: ownedItem.level || 1,
            enhancement,
            canEnhance,
            nextEnhancementCost
          });
        }
      }
      
      // Trier par niveau d'enhancement (plus bas d'abord)
      enhanceableItems.sort((a, b) => a.enhancement - b.enhancement);
      
      return enhanceableItems;
      
    } catch (error) {
      console.error('[EnhancementService] getEnhanceableItems error:', error);
      return [];
    }
  }

  // === MÉTHODES PRIVÉES ===

  /**
   * Validation complète d'une demande d'enhancement
   */
  private async validateEnhancementRequest(itemInstanceId: string) {
    const [player, inventory, config] = await Promise.all([
      this.getPlayer(),
      this.getPlayerInventory(),
      this.getForgeConfig()
    ]);
    
    if (!player) throw new Error('PLAYER_NOT_FOUND');
    if (!inventory) throw new Error('INVENTORY_NOT_FOUND');
    if (!config || !config.isModuleEnabled('enhancement')) throw new Error('ENHANCEMENT_MODULE_DISABLED');
    
    const item = inventory.getItem(itemInstanceId);
    if (!item) throw new Error('ITEM_NOT_FOUND_IN_INVENTORY');
    
    if (item.isEquipped) throw new Error('CANNOT_ENHANCE_EQUIPPED_ITEM');
    
    const ItemModel = mongoose.model('Item');
    const baseItem = await ItemModel.findOne({ itemId: item.itemId });
    if (!baseItem) throw new Error('BASE_ITEM_NOT_FOUND');
    
    if (baseItem.category !== 'Equipment') throw new Error('ONLY_EQUIPMENT_CAN_BE_ENHANCED');
    
    return { player, inventory, item, baseItem, config };
  }

  /**
   * Calcule le coût de base d'enhancement
   */
  private calculateBaseCost(config: any, currentLevel: number, rarity: string): { gold: number; gems: number } {
    const enhancementConfig = config.config.enhancement;
    const baseGold = enhancementConfig.baseGoldCost;
    const baseGems = enhancementConfig.baseGemCost;
    
    // Multiplicateur exponentiel
    const exponentialFactor = 1.15; // Plus agressif pour les hauts niveaux
    const levelMultiplier = Math.pow(exponentialFactor, currentLevel);
    
    // Multiplicateur de rareté
    const rarityMultipliers: { [key: string]: number } = {
      'Common': 1,
      'Rare': 1.5,
      'Epic': 2.5,
      'Legendary': 4,
      'Mythic': 7,
      'Ascended': 12
    };
    
    const rarityMultiplier = rarityMultipliers[rarity] || 1;
    
    // Multiplicateur spécial aux paliers critiques
    const nextLevel = currentLevel + 1;
    const criticalLevels = [10, 20, 30];
    const criticalMultiplier = criticalLevels.includes(nextLevel) ? 1.5 : 1;
    
    const finalMultiplier = levelMultiplier * rarityMultiplier * criticalMultiplier;
    
    return {
      gold: Math.floor(baseGold * finalMultiplier),
      gems: Math.floor(baseGems * finalMultiplier)
    };
  }

  /**
   * Obtient les matériaux requis selon la rareté
   */
  private getRequiredMaterials(rarity: string, targetLevel: number): { [materialId: string]: number } {
    const materials: { [materialId: string]: number } = {};
    
    // Matériaux de base toujours requis
    materials["enhancement_stone"] = Math.max(1, Math.floor(targetLevel / 5) + 1);
    
    // Matériaux spécialisés selon rareté et niveau
    if (targetLevel > 10) {
      const rarityMaterials: { [key: string]: string } = {
        "Common": "iron_ore",
        "Rare": "magic_crystal", 
        "Epic": "dragon_scale",
        "Legendary": "phoenix_feather",
        "Mythic": "celestial_essence",
        "Ascended": "divine_fragment"
      };
      
      const materialId = rarityMaterials[rarity] || "iron_ore";
      materials[materialId] = Math.floor(targetLevel / 10) + 1;
    }
    
    // Matériaux premium aux paliers critiques
    const criticalLevels = [10, 20, 30];
    if (criticalLevels.includes(targetLevel)) {
      materials["enhancement_catalyst"] = 1;
      
      if (targetLevel >= 20) {
        materials["mythic_essence"] = Math.floor(targetLevel / 20);
      }
    }
    
    return materials;
  }

  /**
   * Calcule le coût de garantie
   */
  private calculateGuaranteeCost(currentLevel: number): number {
    const baseCost = 10;
    
    if (currentLevel >= 25) return Math.ceil(baseCost * Math.pow(2, currentLevel - 20));
    if (currentLevel >= 20) return Math.ceil(baseCost * Math.pow(1.8, currentLevel - 15));
    if (currentLevel >= 15) return Math.ceil(baseCost * Math.pow(1.5, currentLevel - 10));
    if (currentLevel >= 10) return Math.ceil(baseCost * Math.pow(1.3, currentLevel - 5));
    
    return Math.ceil(baseCost * (1 + currentLevel * 0.2));
  }

  /**
   * Calcule la chance de succès effective avec pity
   */
  private calculateSuccessChance(currentLevel: number, item: any, config: any) {
    // Taux de base
    const baseChance = this.getBaseSuccessRate(currentLevel);
    
    // Configuration pity
    const pityConfig = config.config.enhancement;
    const pityThreshold = pityConfig.pityThreshold || 10;
    const pityIncrease = pityConfig.pityIncrease || 0.05;
    const pityMax = pityConfig.pityMax || 0.7;
    
    // Calculer pity
    const currentPity = item.enhancementPity || 0;
    const bonusFromPity = Math.min(currentPity * pityIncrease, pityMax);
    
    let effectiveChance = Math.min(1.0, baseChance + bonusFromPity);
    
    // Garantie automatique aux paliers critiques après suffisamment d'échecs
    const nextLevel = currentLevel + 1;
    const guaranteedLevels = [10, 20, 30];
    const isGuaranteedLevel = guaranteedLevels.includes(nextLevel);
    const willBeGuaranteed = isGuaranteedLevel && currentPity >= pityThreshold;
    
    if (willBeGuaranteed) {
      effectiveChance = 1.0;
    }
    
    return {
      effectiveChance,
      pityInfo: {
        currentPity,
        pityThreshold,
        bonusFromPity,
        pityTriggered: willBeGuaranteed,
        isGuaranteedLevel,
        nextLevelIsReset: [10, 20, 30].includes(nextLevel)
      }
    };
  }

  /**
   * Taux de succès de base par niveau
   */
  private getBaseSuccessRate(currentLevel: number): number {
    if (currentLevel <= 5) return 1.0;   // 100% pour +0 à +5
    if (currentLevel <= 10) return 0.9;  // 90% pour +6 à +10
    if (currentLevel <= 15) return 0.7;  // 70% pour +11 à +15
    if (currentLevel <= 20) return 0.5;  // 50% pour +16 à +20
    if (currentLevel <= 25) return 0.25; // 25% pour +21 à +25
    if (currentLevel < 30) return 0.1;   // 10% pour +26 à +29
    return 0.0; // Impossible au-delà de +30
  }

  /**
   * Calcule les stats d'un item avec enhancement
   */
  private calculateItemStats(baseItem: any, ownedItem: any): { [stat: string]: number } {
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
      const enhancementMultiplier = this.getEnhancementMultiplier(enhancement);
      for (const [stat, value] of Object.entries(currentStats)) {
        currentStats[stat] = Math.floor(value * enhancementMultiplier);
      }
    }
    
    return currentStats;
  }

  /**
   * Multiplicateur de stats par niveau d'enhancement
   */
  private getEnhancementMultiplier(enhancementLevel: number): number {
    const multipliers: { [level: number]: number } = {
      0: 1.0,    // +0 = stats de base
      1: 1.05,   // +1 = +5%
      2: 1.10,   // +2 = +10%
      3: 1.16,   // +3 = +16%
      4: 1.23,   // +4 = +23%
      5: 1.30,   // +5 = +30%
      10: 1.75,  // +10 = +75%
      15: 2.50,  // +15 = +150%
      20: 3.50,  // +20 = +250%
      25: 4.75,  // +25 = +375%
      30: 6.00   // +30 = +500%
    };
    
    if (multipliers[enhancementLevel]) {
      return multipliers[enhancementLevel];
    }
    
    // Interpolation linéaire
    const levels = Object.keys(multipliers).map(Number).sort((a, b) => a - b);
    let lowerLevel = 0, upperLevel = 30;
    
    for (let i = 0; i < levels.length - 1; i++) {
      if (enhancementLevel >= levels[i] && enhancementLevel <= levels[i + 1]) {
        lowerLevel = levels[i];
        upperLevel = levels[i + 1];
        break;
      }
    }
    
    const lowerMultiplier = multipliers[lowerLevel];
    const upperMultiplier = multipliers[upperLevel];
    const progress = (enhancementLevel - lowerLevel) / (upperLevel - lowerLevel);
    
    return lowerMultiplier + (upperMultiplier - lowerMultiplier) * progress;
  }

  /**
   * Calcule le power score d'un set de stats
   */
  private calculatePowerScore(stats: { [stat: string]: number }): number {
    return Object.values(stats).reduce((total, value) => total + (typeof value === 'number' ? value : 0), 0);
  }

  /**
   * Vérifie si le joueur peut se permettre le coût
   */
  private async canPlayerAfford(player: any, cost: EnhancementCost): Promise<boolean> {
    // Vérifier monnaies
    if (player.gold < cost.gold || player.gems < cost.gems) {
      return false;
    }
    
    // Vérifier paid gems si requis
    if (cost.paidGems && player.paidGems < cost.paidGems) {
      return false;
    }
    
    // Vérifier matériaux
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
  private async spendPlayerResources(player: any, inventory: any, cost: EnhancementCost): Promise<void> {
    // Dépenser monnaies
    player.gold -= cost.gold;
    player.gems -= cost.gems;
    
    if (cost.paidGems) {
      player.paidGems -= cost.paidGems;
    }
    
    // Dépenser matériaux
    if (cost.materials) {
      for (const [materialId, amount] of Object.entries(cost.materials)) {
        await inventory.removeItemByType(materialId, amount);
      }
    }
  }

  /**
   * Log l'opération dans la base de données
   */
  private async logOperation(itemInstanceId: string, baseItem: any, cost: EnhancementCost, success: boolean, additionalData: any): Promise<void> {
    try {
      const player = await this.getPlayer();
      
      await ForgeOperation.create({
        playerId: this.playerId,
        operationType: 'enhancement',
        itemInstanceId,
        itemId: baseItem.itemId,
        itemName: baseItem.name || 'Unknown Item',
        itemRarity: baseItem.rarity || 'Common',
        cost: {
          gold: cost.gold,
          gems: cost.gems,
          paidGems: cost.paidGems,
          materials: new Map(Object.entries(cost.materials || {}))
        },
        beforeData: {
          enhancement: additionalData.previousLevel,
          enhancementPity: additionalData.pityInfo?.currentPity
        },
        result: {
          success,
          data: additionalData
        },
        afterData: success ? {
          enhancement: additionalData.newLevel,
          enhancementPity: additionalData.pityInfo?.pityTriggered ? 0 : (additionalData.pityInfo?.currentPity || 0) + (success ? 0 : 1)
        } : undefined,
        operationContext: {
          usedGuarantee: additionalData.guaranteeUsed,
          targetTier: additionalData.newLevel
        },
        executionTimeMs: additionalData.executionTime,
        playerLevel: player?.level || 1
      });
    } catch (error) {
      console.warn('[EnhancementService] Failed to log operation:', error);
    }
  }

  /**
   * Met à jour les stats du joueur
   */
  private async updatePlayerStats(cost: EnhancementCost, success: boolean, powerGain: number, moduleData: any): Promise<void> {
    try {
      const stats = await ForgeStats.getOrCreatePlayerStats(this.playerId);
      
      stats.updateWithOperation({
        operationType: 'enhancement',
        success,
        goldSpent: cost.gold,
        gemsSpent: cost.gems,
        paidGemsSpent: cost.paidGems || 0,
        powerGain,
        executionTime: 500, // Approximation
        moduleSpecificData: moduleData
      });
      
      await stats.save();
    } catch (error) {
      console.warn('[EnhancementService] Failed to update player stats:', error);
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

export default EnhancementService;

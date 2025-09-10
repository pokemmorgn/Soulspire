import mongoose from 'mongoose';
import { ForgeOperation } from '../../models/forging/ForgeOperation';
import { ForgeStats } from '../../models/forging/ForgeStats';
import { ForgeConfig } from '../../models/forging/ForgeConfig';

// === INTERFACES ===

export interface FusionOptions {
  validateOnly?: boolean; // Pour preview
  consumeMaterials?: boolean;
}

export interface FusionCost {
  gold: number;
  gems: number;
  materials?: { [materialId: string]: number };
}

export interface FusionResult {
  success: boolean;
  consumedItems: Array<{
    instanceId: string;
    name: string;
    level: number;
    enhancement: number;
  }>;
  newItem: {
    instanceId: string;
    itemId: string;
    name: string;
    rarity: string;
    level: number;
    enhancement: number;
    stats: { [stat: string]: number };
    powerScore: number;
  } | null;
  cost: FusionCost;
  rarityUpgrade: {
    oldRarity: string;
    newRarity: string;
    rarityMultiplier: number;
  };
  statsComparison: {
    oldTotalPower: number;
    newPowerScore: number;
    powerIncrease: number;
  };
  message: string;
}

export interface FusionPreview {
  requiredItems: number;
  consumedItems: Array<{
    instanceId: string;
    name: string;
    level: number;
    enhancement: number;
    stats: { [stat: string]: number };
  }>;
  cost: FusionCost;
  expectedResult: {
    rarity: string;
    conservedLevel: number;
    conservedEnhancement: number;
    estimatedPowerGain: number;
    rarityMultiplier: number;
  };
  canFuse: boolean;
  reason?: string;
}

export interface FusableGroup {
  itemId: string;
  itemName: string;
  rarity: string;
  availableCount: number;
  possibleFusions: number;
  targetRarity: string;
  estimatedPowerGain: number;
  fusionCost: FusionCost;
}

// === SERVICE PRINCIPAL ===

export class FusionService {
  private playerId: string;
  
  // Constantes AFK Arena
  private readonly REQUIRED_ITEMS = 3;
  private readonly MAX_FUSION_RARITY = 'Mythic';
  private readonly RARITY_ORDER = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  
  constructor(playerId: string) {
    this.playerId = playerId;
  }

  // === MÉTHODES PUBLIQUES ===

  /**
   * Génère un aperçu de fusion avant exécution
   */
  async getFusionPreview(itemInstanceIds: string[]): Promise<FusionPreview> {
    try {
      // Validation de base
      if (itemInstanceIds.length !== this.REQUIRED_ITEMS) {
        return {
          requiredItems: this.REQUIRED_ITEMS,
          consumedItems: [],
          cost: { gold: 0, gems: 0 },
          expectedResult: {
            rarity: 'Common',
            conservedLevel: 1,
            conservedEnhancement: 0,
            estimatedPowerGain: 0,
            rarityMultiplier: 1
          },
          canFuse: false,
          reason: 'FUSION_REQUIRES_EXACTLY_THREE_ITEMS'
        };
      }

      const { inventory, items, baseItems, config } = await this.validateFusionRequest(itemInstanceIds);
      
      // Vérifier compatibilité
      const compatibility = this.validateItemCompatibility(baseItems);
      if (!compatibility.compatible) {
        return {
          requiredItems: this.REQUIRED_ITEMS,
          consumedItems: [],
          cost: { gold: 0, gems: 0 },
          expectedResult: {
            rarity: 'Common',
            conservedLevel: 1,
            conservedEnhancement: 0,
            estimatedPowerGain: 0,
            rarityMultiplier: 1
          },
          canFuse: false,
          reason: compatibility.reason
        };
      }

      const currentRarity = baseItems[0].rarity || 'Common';
      const targetRarity = this.getNextRarity(currentRarity);
      
      if (!targetRarity) {
        return {
          requiredItems: this.REQUIRED_ITEMS,
          consumedItems: [],
          cost: { gold: 0, gems: 0 },
          expectedResult: {
            rarity: currentRarity,
            conservedLevel: 1,
            conservedEnhancement: 0,
            estimatedPowerGain: 0,
            rarityMultiplier: 1
          },
          canFuse: false,
          reason: 'ITEM_CANNOT_BE_FUSED_FURTHER'
        };
      }

      // Calculer résultat attendu
      const conservedLevel = this.calculateConservedLevel(items);
      const conservedEnhancement = this.calculateConservedEnhancement(items);
      const cost = this.calculateFusionCost(currentRarity, targetRarity);
      const rarityMultiplier = this.getRarityMultiplier(targetRarity);
      
      // Estimer power gain
      const currentTotalPower = this.calculateTotalPowerOfItems(baseItems, items);
      const estimatedNewPower = Math.floor(currentTotalPower * rarityMultiplier * 0.7); // Approximation
      const estimatedPowerGain = estimatedNewPower - currentTotalPower;

      // Préparer données des items à consommer
      const consumedItems = items.map((item, index) => ({
        instanceId: item.instanceId,
        name: baseItems[index].name,
        level: item.level || 1,
        enhancement: item.enhancement || 0,
        stats: this.calculateItemStats(baseItems[index], item)
      }));

      return {
        requiredItems: this.REQUIRED_ITEMS,
        consumedItems,
        cost,
        expectedResult: {
          rarity: targetRarity,
          conservedLevel,
          conservedEnhancement,
          estimatedPowerGain,
          rarityMultiplier
        },
        canFuse: true
      };

    } catch (error) {
      console.error(`[FusionService] getFusionPreview error:`, error);
      return {
        requiredItems: this.REQUIRED_ITEMS,
        consumedItems: [],
        cost: { gold: 0, gems: 0 },
        expectedResult: {
          rarity: 'Common',
          conservedLevel: 1,
          conservedEnhancement: 0,
          estimatedPowerGain: 0,
          rarityMultiplier: 1
        },
        canFuse: false,
        reason: error instanceof Error ? error.message : 'FUSION_PREVIEW_ERROR'
      };
    }
  }

  /**
   * Exécute une fusion
   */
  async executeFusion(itemInstanceIds: string[], options: FusionOptions = {}): Promise<FusionResult> {
    const startTime = Date.now();
    
    try {
      // 1. Validation complète
      if (itemInstanceIds.length !== this.REQUIRED_ITEMS) {
        throw new Error('FUSION_REQUIRES_EXACTLY_THREE_ITEMS');
      }

      const { player, inventory, items, baseItems, config } = await this.validateFusionRequest(itemInstanceIds);
      
      // 2. Vérifier compatibilité
      const compatibility = this.validateItemCompatibility(baseItems);
      if (!compatibility.compatible) {
        throw new Error(compatibility.reason || 'ITEMS_NOT_COMPATIBLE_FOR_FUSION');
      }

      const currentRarity = baseItems[0].rarity || 'Common';
      const targetRarity = this.getNextRarity(currentRarity);
      
      if (!targetRarity) {
        throw new Error('ITEM_CANNOT_BE_FUSED_FURTHER');
      }

      // 3. Calculer coût et vérifier ressources
      const cost = this.calculateFusionCost(currentRarity, targetRarity);
      
      if (!await this.canPlayerAfford(player, cost)) {
        throw new Error('INSUFFICIENT_RESOURCES');
      }

      // 4. Mode validation seulement
      if (options.validateOnly) {
        return this.createValidationResult(baseItems, items, cost, currentRarity, targetRarity);
      }

      // 5. Calculer valeurs conservées
      const conservedLevel = this.calculateConservedLevel(items);
      const conservedEnhancement = this.calculateConservedEnhancement(items);
      const oldTotalPower = this.calculateTotalPowerOfItems(baseItems, items);

      // 6. Dépenser ressources
      await this.spendPlayerResources(player, inventory, cost);

      // 7. Supprimer les items de base
      const consumedItemsData = items.map((item, index) => ({
        instanceId: item.instanceId,
        name: baseItems[index].name,
        level: item.level || 1,
        enhancement: item.enhancement || 0
      }));

      for (const item of items) {
        const removed = await inventory.removeItem(item.instanceId, 1);
        if (!removed) {
          throw new Error(`Failed to remove item ${item.instanceId}`);
        }
      }

      // 8. Créer le nouvel item fusionné
      const newItem = await this.createFusedItem(baseItems[0], targetRarity, conservedLevel, conservedEnhancement, inventory);
      
      // 9. Sauvegarder
      await Promise.all([
        player.save(),
        inventory.save()
      ]);

      // 10. Calculer résultats pour l'UI
      const newPowerScore = this.calculatePowerScore(newItem.stats);
      const powerIncrease = newPowerScore - oldTotalPower;
      const rarityMultiplier = this.getRarityMultiplier(targetRarity);

      // 11. Logger l'opération
      const executionTime = Date.now() - startTime;
      await this.logOperation(itemInstanceIds, baseItems[0], cost, true, {
        consumedItems: consumedItemsData,
        newItem,
        rarityUpgrade: { oldRarity: currentRarity, newRarity: targetRarity },
        powerIncrease,
        executionTime
      });

      // 12. Mettre à jour stats du joueur
      await this.updatePlayerStats(cost, true, powerIncrease, {
        totalItemsFused: this.REQUIRED_ITEMS,
        highestRarityCreated: targetRarity,
        uniqueItemsFused: [baseItems[0].itemId]
      });

      // 13. Construire le résultat
      const result: FusionResult = {
        success: true,
        consumedItems: consumedItemsData,
        newItem: {
          instanceId: newItem.instanceId,
          itemId: newItem.itemId,
          name: newItem.name,
          rarity: targetRarity,
          level: conservedLevel,
          enhancement: conservedEnhancement,
          stats: newItem.stats,
          powerScore: newPowerScore
        },
        cost,
        rarityUpgrade: {
          oldRarity: currentRarity,
          newRarity: targetRarity,
          rarityMultiplier
        },
        statsComparison: {
          oldTotalPower,
          newPowerScore,
          powerIncrease
        },
        message: 'FUSION_SUCCESS'
      };

      return result;

    } catch (error) {
      console.error(`[FusionService] executeFusion error:`, error);
      
      // Logger l'échec
      const executionTime = Date.now() - startTime;
      try {
        await ForgeOperation.create({
          playerId: this.playerId,
          operationType: 'fusion',
          itemInstanceId: itemInstanceIds.join(','),
          itemId: 'unknown',
          itemName: 'Fusion Attempt',
          itemRarity: 'Common',
          cost: { gold: 0, gems: 0 },
          beforeData: {},
          result: {
            success: false,
            errorCode: 'FUSION_ERROR',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          },
          operationContext: {
            consumedItems: itemInstanceIds
          },
          executionTimeMs: executionTime,
          playerLevel: 1
        });
      } catch (logError) {
        console.warn('[FusionService] Failed to log error operation:', logError);
      }

      throw error;
    }
  }

  /**
   * Obtient les groupes d'items fusionnables
   */
  async getFusableGroups(filters: { rarity?: string; minCount?: number } = {}): Promise<FusableGroup[]> {
    try {
      const inventory = await this.getPlayerInventory();
      const ItemModel = mongoose.model('Item');
      
      // Compteur par itemId + rareté
      const itemCounts: { [key: string]: { count: number; baseItem: any; rarity: string } } = {};
      
      const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
      
      for (const category of equipmentCategories) {
        const items = inventory.storage[category] || [];
        
        for (const ownedItem of items) {
          const baseItem = await ItemModel.findOne({ itemId: ownedItem.itemId });
          if (!baseItem || baseItem.category !== 'Equipment') continue;
          
          const rarity = baseItem.rarity || 'Common';
          
          // Filtrer par rareté si spécifiée
          if (filters.rarity && rarity !== filters.rarity) continue;
          
          // Vérifier si peut être fusionné
          if (!this.canFuseRarity(rarity)) continue;
          
          const key = `${ownedItem.itemId}_${rarity}`;
          
          if (!itemCounts[key]) {
            itemCounts[key] = {
              count: 0,
              baseItem,
              rarity
            };
          }
          
          itemCounts[key].count++;
        }
      }
      
      // Convertir en groups fusionnables
      const fusableGroups: FusableGroup[] = [];
      const minCount = filters.minCount || this.REQUIRED_ITEMS;
      
      for (const [key, data] of Object.entries(itemCounts)) {
        if (data.count < minCount) continue;
        
        const possibleFusions = Math.floor(data.count / this.REQUIRED_ITEMS);
        const targetRarity = this.getNextRarity(data.rarity);
        
        if (!targetRarity) continue;
        
        // Estimer power gain (approximation)
        const rarityMultiplier = this.getRarityMultiplier(targetRarity);
        const estimatedPowerGain = Math.floor(100 * rarityMultiplier * (possibleFusions * 0.3)); // Approximation
        
        const fusionCost = this.calculateFusionCost(data.rarity, targetRarity);
        
        fusableGroups.push({
          itemId: data.baseItem.itemId,
          itemName: data.baseItem.name,
          rarity: data.rarity,
          availableCount: data.count,
          possibleFusions,
          targetRarity,
          estimatedPowerGain,
          fusionCost
        });
      }
      
      // Trier par potentiel de gain de power
      fusableGroups.sort((a, b) => b.estimatedPowerGain - a.estimatedPowerGain);
      
      return fusableGroups;
      
    } catch (error) {
      console.error('[FusionService] getFusableGroups error:', error);
      return [];
    }
  }

  /**
   * Compte les fusions possibles pour un item spécifique
   */
  async getPossibleFusionsCount(itemId: string, rarity: string): Promise<number> {
    try {
      const inventory = await this.getPlayerInventory();
      
      let count = 0;
      const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
      
      for (const category of equipmentCategories) {
        const items = inventory.storage[category] || [];
        count += items.filter((item: any) => item.itemId === itemId).length;
      }
      
      return Math.floor(count / this.REQUIRED_ITEMS);
      
    } catch (error) {
      console.error('[FusionService] getPossibleFusionsCount error:', error);
      return 0;
    }
  }

  // === MÉTHODES PRIVÉES ===

  /**
   * Validation complète d'une demande de fusion
   */
  private async validateFusionRequest(itemInstanceIds: string[]) {
    const [player, inventory, config] = await Promise.all([
      this.getPlayer(),
      this.getPlayerInventory(),
      this.getForgeConfig()
    ]);
    
    if (!player) throw new Error('PLAYER_NOT_FOUND');
    if (!inventory) throw new Error('INVENTORY_NOT_FOUND');
    if (!config || !config.isModuleEnabled('fusion')) throw new Error('FUSION_MODULE_DISABLED');
    
    // Récupérer tous les items
    const items: any[] = [];
    const baseItems: any[] = [];
    const ItemModel = mongoose.model('Item');
    
    for (const instanceId of itemInstanceIds) {
      const item = inventory.getItem(instanceId);
      if (!item) {
        throw new Error(`ITEM_NOT_FOUND_IN_INVENTORY: ${instanceId}`);
      }
      
      if (item.isEquipped) {
        throw new Error('CANNOT_FUSE_EQUIPPED_ITEMS');
      }
      
      const baseItem = await ItemModel.findOne({ itemId: item.itemId });
      if (!baseItem) {
        throw new Error(`BASE_ITEM_NOT_FOUND: ${item.itemId}`);
      }
      
      items.push(item);
      baseItems.push(baseItem);
    }
    
    return { player, inventory, items, baseItems, config };
  }

  /**
   * Valide que les items sont compatibles pour fusion
   */
  private validateItemCompatibility(baseItems: any[]): { compatible: boolean; reason?: string } {
    if (baseItems.length !== this.REQUIRED_ITEMS) {
      return { compatible: false, reason: 'FUSION_REQUIRES_EXACTLY_THREE_ITEMS' };
    }
    
    // Vérifier que tous sont des équipements
    for (const item of baseItems) {
      if (item.category !== 'Equipment') {
        return { compatible: false, reason: 'ONLY_EQUIPMENT_CAN_BE_FUSED' };
      }
    }
    
    // Vérifier même itemId
    const firstItemId = baseItems[0].itemId;
    if (!baseItems.every(item => item.itemId === firstItemId)) {
      return { compatible: false, reason: 'FUSION_ITEMS_MUST_BE_IDENTICAL' };
    }
    
    // Vérifier même rareté
    const firstRarity = baseItems[0].rarity || 'Common';
    if (!baseItems.every(item => (item.rarity || 'Common') === firstRarity)) {
      return { compatible: false, reason: 'FUSION_ITEMS_MUST_HAVE_SAME_RARITY' };
    }
    
    // Vérifier que la rareté peut être fusionnée
    if (!this.canFuseRarity(firstRarity)) {
      return { compatible: false, reason: 'RARITY_CANNOT_BE_FUSED' };
    }
    
    return { compatible: true };
  }

  /**
   * Vérifie si une rareté peut être fusionnée
   */
  private canFuseRarity(rarity: string): boolean {
    return this.RARITY_ORDER.includes(rarity) && rarity !== this.MAX_FUSION_RARITY;
  }

  /**
   * Obtient la rareté suivante
   */
  private getNextRarity(currentRarity: string): string | null {
    const currentIndex = this.RARITY_ORDER.indexOf(currentRarity);
    if (currentIndex < 0 || currentIndex >= this.RARITY_ORDER.length - 1) {
      return null;
    }
    return this.RARITY_ORDER[currentIndex + 1];
  }

  /**
   * Calcule le niveau conservé (moyenne arrondie vers le haut)
   */
  private calculateConservedLevel(items: any[]): number {
    const avgLevel = items.reduce((sum, item) => sum + (item.level || 1), 0) / items.length;
    return Math.ceil(avgLevel);
  }

  /**
   * Calcule l'enhancement conservé (le plus haut)
   */
  private calculateConservedEnhancement(items: any[]): number {
    return Math.max(...items.map(item => item.enhancement || 0));
  }

  /**
   * Calcule le coût de fusion
   */
  private calculateFusionCost(currentRarity: string, targetRarity: string): FusionCost {
    const config = { // Valeurs par défaut
      baseGoldCost: 5000,
      baseGemCost: 200
    };
    
    // Multiplicateurs AFK Arena style
    const rarityMultipliers: { [key: string]: number } = {
      'Common': 1,      // Common → Rare
      'Rare': 3,        // Rare → Epic  
      'Epic': 8,        // Epic → Legendary
      'Legendary': 20   // Legendary → Mythic
    };
    
    const multiplier = rarityMultipliers[currentRarity] || 1;
    const gold = Math.floor(config.baseGoldCost * multiplier);
    const gems = Math.floor(config.baseGemCost * multiplier);
    
    // Matériaux spécialisés
    const materials = this.getFusionMaterials(targetRarity);
    
    return { gold, gems, materials };
  }

  /**
   * Obtient les matériaux requis pour fusion
   */
  private getFusionMaterials(targetRarity: string): { [materialId: string]: number } {
    const materials: { [materialId: string]: number } = {};
    
    // Matériaux de base toujours requis
    materials['fusion_stone'] = 5;
    
    switch (targetRarity) {
      case 'Rare':
        materials['silver_dust'] = 10;
        break;
      case 'Epic':
        materials['gold_dust'] = 5;
        materials['magic_essence'] = 2;
        break;
      case 'Legendary':
        materials['platinum_dust'] = 3;
        materials['legendary_essence'] = 1;
        break;
      case 'Mythic':
        materials['mythic_dust'] = 2;
        materials['celestial_fragment'] = 1;
        break;
    }
    
    return materials;
  }

  /**
   * Obtient le multiplicateur de rareté pour les stats
   */
  private getRarityMultiplier(rarity: string): number {
    const multipliers: { [key: string]: number } = {
      'Common': 1.0,
      'Rare': 1.3,
      'Epic': 1.8,
      'Legendary': 2.5,
      'Mythic': 3.5,
      'Ascended': 5.0
    };
    
    return multipliers[rarity] || 1.0;
  }

  /**
   * Calcule la puissance totale d'une liste d'items
   */
  private calculateTotalPowerOfItems(baseItems: any[], ownedItems: any[]): number {
    let totalPower = 0;
    
    for (let i = 0; i < baseItems.length; i++) {
      const stats = this.calculateItemStats(baseItems[i], ownedItems[i]);
      totalPower += this.calculatePowerScore(stats);
    }
    
    return totalPower;
  }

  /**
   * Crée le nouvel item fusionné
   */
  private async createFusedItem(baseItem: any, targetRarity: string, level: number, enhancement: number, inventory: any): Promise<{
    instanceId: string;
    itemId: string;
    name: string;
    stats: { [stat: string]: number };
  }> {
    const IdGenerator = require('../../utils/idGenerator').IdGenerator;
    
    // Générer nouvel instanceId
    const instanceId = IdGenerator.generateUUID();
    
    // Calculer stats avec multiplicateur de rareté
    const baseStats = baseItem.baseStats || {};
    const statsPerLevel = baseItem.statsPerLevel || {};
    const rarityMultiplier = this.getRarityMultiplier(targetRarity);
    
    // Stats de base avec multiplicateur de rareté
    const boostedBaseStats: { [stat: string]: number } = {};
    for (const [stat, value] of Object.entries(baseStats)) {
      if (typeof value === 'number') {
        boostedBaseStats[stat] = Math.floor(value * rarityMultiplier);
      }
    }
    
    // Calculer stats finales avec niveau et enhancement
    const finalStats = this.calculateItemStatsWithEnhancement(boostedBaseStats, statsPerLevel, level, enhancement);
    
    // Déterminer catégorie de stockage
    const slotMap: { [key: string]: string } = {
      'Weapon': 'weapons',
      'Helmet': 'helmets', 
      'Armor': 'armors',
      'Boots': 'boots',
      'Gloves': 'gloves',
      'Accessory': 'accessories'
    };
    
    const storageCategory = slotMap[baseItem.equipmentSlot] || 'artifacts';
    
    // Créer nouvel item
    const newItem = {
      instanceId,
      itemId: baseItem.itemId,
      quantity: 1,
      level,
      enhancement,
      stats: finalStats,
      isEquipped: false,
      acquiredDate: new Date(),
      equipmentData: {
        durability: 100,
        socketedGems: [],
        upgradeHistory: []
      }
    };
    
    // Ajouter à l'inventaire
    if (!Array.isArray(inventory.storage[storageCategory])) {
      inventory.storage[storageCategory] = [];
    }
    
    inventory.storage[storageCategory].push(newItem);
    
    return {
      instanceId,
      itemId: baseItem.itemId,
      name: baseItem.name,
      stats: finalStats
    };
  }

  /**
   * Calcule les stats d'un item avec enhancement
   */
  private calculateItemStatsWithEnhancement(baseStats: any, statsPerLevel: any, level: number, enhancement: number): { [stat: string]: number } {
    const currentStats: { [stat: string]: number } = {};
    
    // Stats de base + stats par niveau
    for (const [stat, baseValue] of Object.entries(baseStats)) {
      if (typeof baseValue === 'number') {
        const levelBonus = (statsPerLevel[stat] || 0) * Math.max(0, level - 1);
        currentStats[stat] = baseValue + levelBonus;
      }
    }
    
    // Appliquer multiplicateur d'enhancement
    if (enhancement > 0) {
      const enhancementMultiplier = 1 + (enhancement * 0.1); // Approximation
      for (const [stat, value] of Object.entries(currentStats)) {
        currentStats[stat] = Math.floor(value * enhancementMultiplier);
      }
    }
    
    return currentStats;
  }

  /**
   * Calcule les stats d'un item
   */
  private calculateItemStats(baseItem: any, ownedItem: any): { [stat: string]: number } {
    const baseStats = baseItem.baseStats || {};
    const statsPerLevel = baseItem.statsPerLevel || {};
    const level = ownedItem.level || 1;
    const enhancement = ownedItem.enhancement || 0;
    
    return this.calculateItemStatsWithEnhancement(baseStats, statsPerLevel, level, enhancement);
  }

  /**
   * Calcule le power score d'un set de stats
   */
  private calculatePowerScore(stats: { [stat: string]: number }): number {
    return Object.values(stats).reduce((total, value) => total + (typeof value === 'number' ? value : 0), 0);
  }

  /**
   * Crée un résultat de validation (pour mode validateOnly)
   */
  private createValidationResult(baseItems: any[], items: any[], cost: FusionCost, currentRarity: string, targetRarity: string): FusionResult {
    const consumedItems = items.map((item, index) => ({
      instanceId: item.instanceId,
      name: baseItems[index].name,
      level: item.level || 1,
      enhancement: item.enhancement || 0
    }));
    
    const oldTotalPower = this.calculateTotalPowerOfItems(baseItems, items);
    const rarityMultiplier = this.getRarityMultiplier(targetRarity);
    const estimatedNewPower = Math.floor(oldTotalPower * rarityMultiplier * 0.7);
    
    return {
      success: true,
      consumedItems,
      newItem: null, // Pas de nouvel item en mode validation
      cost,
      rarityUpgrade: {
        oldRarity: currentRarity,
        newRarity: targetRarity,
        rarityMultiplier
      },
      statsComparison: {
        oldTotalPower,
        newPowerScore: estimatedNewPower,
        powerIncrease: estimatedNewPower - oldTotalPower
      },
      message: 'FUSION_VALIDATION_SUCCESS'
    };
  }

  /**
   * Vérifie si le joueur peut se permettre le coût
   */
  private async canPlayerAfford(player: any, cost: FusionCost): Promise<boolean> {
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
  private async spendPlayerResources(player: any, inventory: any, cost: FusionCost): Promise<void> {
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
  private async logOperation(itemInstanceIds: string[], baseItem: any, cost: FusionCost, success: boolean, additionalData: any): Promise<void> {
    try {
      const player = await this.getPlayer();
      
      await ForgeOperation.create({
        playerId: this.playerId,
        operationType: 'fusion',
        itemInstanceId: itemInstanceIds.join(','),
        itemId: baseItem.itemId,
        itemName: baseItem.name || 'Unknown Item',
        itemRarity: baseItem.rarity || 'Common',
        cost: {
          gold: cost.gold,
          gems: cost.gems,
          materials: new Map(Object.entries(cost.materials || {}))
        },
        beforeData: {
          // Stats des items consommés
        },
        result: {
          success,
          data: additionalData
        },
        afterData: success ? {
          // Stats du nouvel item
        } : undefined,
        operationContext: {
          consumedItems: itemInstanceIds
        },
        executionTimeMs: additionalData.executionTime,
        playerLevel: player?.level || 1
      });
    } catch (error) {
      console.warn('[FusionService] Failed to log operation:', error);
    }
  }

  /**
   * Met à jour les stats du joueur
   */
  private async updatePlayerStats(cost: FusionCost, success: boolean, powerGain: number, moduleData: any): Promise<void> {
    try {
      const stats = await (ForgeStats as any).getOrCreatePlayerStats(this.playerId);
      
      stats.updateWithOperation({
        operationType: 'fusion',
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
      console.warn('[FusionService] Failed to update player stats:', error);
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

export default FusionService;

import mongoose from 'mongoose';
import { ForgeOperation } from '../../models/forging/ForgeOperation';
import { ForgeStats } from '../../models/forging/ForgeStats';
import { ForgeConfig } from '../../models/forging/ForgeConfig';

// === INTERFACES ===

export interface ReforgeOptions {
  lockedStats?: string[];
  simulationMode?: boolean;
}

export interface ReforgeCost {
  gold: number;
  gems: number;
  materials?: { [materialId: string]: number };
}

export interface ReforgeResult {
  success: boolean;
  previousStats: { [stat: string]: number };
  newStats: { [stat: string]: number };
  lockedStats: string[];
  cost: ReforgeCost;
  improvements: Array<{
    stat: string;
    oldValue: number;
    newValue: number;
    improvement: number;
  }>;
  powerChange: number;
  reforgeCount: number;
  message: string;
}

export interface ReforgePreview {
  currentStats: { [stat: string]: number };
  possibleStats: { [stat: string]: { min: number; max: number } };
  lockedStats: string[];
  cost: ReforgeCost;
  improvementChances: { [stat: string]: number };
}

// === SERVICE PRINCIPAL ===

export class ReforgeService {
  private playerId: string;
  
  constructor(playerId: string) {
    this.playerId = playerId;
  }

  // === MÉTHODES PUBLIQUES ===

  /**
   * Génère un aperçu des stats possibles avant reforge
   */
  async getReforgePreview(itemInstanceId: string, options: ReforgeOptions = {}): Promise<ReforgePreview> {
    try {
      // Validation de base
      const { item, baseItem, config } = await this.validateReforgeRequest(itemInstanceId);
      
      const lockedStats = this.validateLockedStats(options.lockedStats || [], baseItem.equipmentSlot);
      const currentStats = this.getCurrentItemStats(baseItem, item);
      
      // Calculer coût
      const cost = this.calculateReforgeCost(baseItem, lockedStats, item);
      
      // Obtenir les ranges possibles
      const possibleStats = this.getStatRanges(baseItem.rarity, baseItem.equipmentSlot, lockedStats);
      
      // Calculer chances d'amélioration par stat
      const improvementChances = this.calculateImprovementChances(currentStats, possibleStats, lockedStats);
      
      return {
        currentStats,
        possibleStats,
        lockedStats,
        cost,
        improvementChances
      };
      
    } catch (error) {
      console.error(`[ReforgeService] getReforgePreview error for ${itemInstanceId}:`, error);
      throw error;
    }
  }

  /**
   * Exécute un reforge
   */
  async executeReforge(itemInstanceId: string, options: ReforgeOptions = {}): Promise<ReforgeResult> {
    const startTime = Date.now();
    
    try {
      // 1. Validation complète
      const { player, inventory, item, baseItem, config } = await this.validateReforgeRequest(itemInstanceId);
      
      const lockedStats = this.validateLockedStats(options.lockedStats || [], baseItem.equipmentSlot);
      
      // 2. Calculer coût et vérifier ressources
      const cost = this.calculateReforgeCost(baseItem, lockedStats, item);
      
      if (!await this.canPlayerAfford(player, cost)) {
        throw new Error('INSUFFICIENT_RESOURCES');
      }
      
      // 3. Obtenir stats actuelles
      const previousStats = this.getCurrentItemStats(baseItem, item);
      const previousPowerScore = this.calculatePowerScore(previousStats);
      
      // 4. Mode simulation (pour preview avancé)
      if (options.simulationMode) {
        const newStats = this.generateNewStats(baseItem.rarity, baseItem.equipmentSlot, lockedStats, previousStats);
        const improvements = this.calculateImprovements(previousStats, newStats);
        
        return {
          success: true,
          previousStats,
          newStats,
          lockedStats,
          cost,
          improvements,
          powerChange: this.calculatePowerScore(newStats) - previousPowerScore,
          reforgeCount: this.getReforgeCount(item),
          message: 'REFORGE_SIMULATION'
        };
      }
      
      // 5. Dépenser les ressources
      await this.spendPlayerResources(player, inventory, cost);
      
      // 6. Générer nouvelles stats
      const newStats = this.generateNewStats(baseItem.rarity, baseItem.equipmentSlot, lockedStats, previousStats);
      
      // 7. Appliquer les nouvelles stats
      item.reforgedStats = newStats;
      item.stats = newStats;
      
      // 8. Mettre à jour historique de reforge
      if (!item.equipmentData) {
        item.equipmentData = {
          durability: 100,
          socketedGems: [],
          upgradeHistory: []
        };
      }
      item.equipmentData.upgradeHistory.push(new Date());
      
      // 9. Sauvegarder
      await Promise.all([
        player.save(),
        inventory.save()
      ]);
      
      // 10. Calculer les améliorations pour l'UI
      const improvements = this.calculateImprovements(previousStats, newStats);
      const newPowerScore = this.calculatePowerScore(newStats);
      const powerChange = newPowerScore - previousPowerScore;
      
      // 11. Logger l'opération
      const executionTime = Date.now() - startTime;
      await this.logOperation(itemInstanceId, baseItem, cost, true, {
        previousStats,
        newStats,
        lockedStats,
        powerChange,
        reforgeCount: this.getReforgeCount(item),
        executionTime
      });
      
      // 12. Mettre à jour les stats du joueur
      await this.updatePlayerStats(cost, true, powerChange, {
        totalStatLocks: lockedStats.length,
        maxStatLocksUsed: Math.max(lockedStats.length, 0),
        perfectRolls: this.isPerfectRoll(newStats, baseItem.rarity, baseItem.equipmentSlot) ? 1 : 0
      });
      
      // 13. Construire le résultat
      const result: ReforgeResult = {
        success: true,
        previousStats,
        newStats,
        lockedStats,
        cost,
        improvements,
        powerChange,
        reforgeCount: this.getReforgeCount(item),
        message: 'REFORGE_SUCCESS'
      };
      
      return result;
      
    } catch (error) {
      console.error(`[ReforgeService] executeReforge error for ${itemInstanceId}:`, error);
      
      // Logger l'échec
      const executionTime = Date.now() - startTime;
      try {
        await ForgeOperation.create({
          playerId: this.playerId,
          operationType: 'reforge',
          itemInstanceId,
          itemId: 'unknown',
          itemName: 'Unknown Item',
          itemRarity: 'Common',
          cost: { gold: 0, gems: 0 },
          beforeData: {},
          result: {
            success: false,
            errorCode: 'REFORGE_ERROR',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          },
          operationContext: {
            lockedStats: options.lockedStats || []
          },
          executionTimeMs: executionTime,
          playerLevel: 1
        });
      } catch (logError) {
        console.warn('[ReforgeService] Failed to log error operation:', logError);
      }
      
      throw error;
    }
  }

  /**
   * Obtient les stats disponibles pour un slot d'équipement
   */
  getAvailableStatsForSlot(equipmentSlot: string): string[] {
    const slotStats: { [slot: string]: string[] } = {
      'Weapon': ['atk', 'crit', 'critDamage', 'accuracy', 'healthleech'],
      'Armor': ['hp', 'def', 'critResist', 'dodge', 'shieldBonus'],
      'Helmet': ['hp', 'def', 'moral', 'energyRegen', 'healingBonus'],
      'Boots': ['hp', 'vitesse', 'dodge', 'energyRegen'],
      'Gloves': ['atk', 'crit', 'accuracy', 'critDamage'],
      'Accessory': ['hp', 'atk', 'crit', 'healingBonus', 'reductionCooldown']
    };
    
    return slotStats[equipmentSlot] || [];
  }

  /**
   * Obtient les items reforgeables du joueur
   */
  async getReforgeableItems(filters: { rarity?: string; slot?: string } = {}): Promise<Array<{
    instanceId: string;
    itemId: string;
    name: string;
    rarity: string;
    equipmentSlot: string;
    currentStats: { [stat: string]: number };
    reforgeCount: number;
    canReforge: boolean;
    reforgeCost: ReforgeCost | null;
  }>> {
    try {
      const inventory = await this.getPlayerInventory();
      const reforgeableItems: any[] = [];
      
      const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
      const ItemModel = mongoose.model('Item');
      
      for (const category of equipmentCategories) {
        const items = inventory.storage[category] || [];
        
        for (const ownedItem of items) {
          const baseItem = await ItemModel.findOne({ itemId: ownedItem.itemId });
          if (!baseItem || baseItem.category !== 'Equipment') continue;
          
          const rarity = baseItem.rarity || 'Common';
          const equipmentSlot = baseItem.equipmentSlot;
          
          // Appliquer filtres
          if (filters.rarity && rarity !== filters.rarity) continue;
          if (filters.slot && equipmentSlot !== filters.slot) continue;
          
          const currentStats = this.getCurrentItemStats(baseItem, ownedItem);
          const reforgeCount = this.getReforgeCount(ownedItem);
          const canReforge = !ownedItem.isEquipped; // Peut pas reforger les items équipés
          
          let reforgeCost: ReforgeCost | null = null;
          if (canReforge) {
            try {
              reforgeCost = this.calculateReforgeCost(baseItem, [], ownedItem);
            } catch (error) {
              continue; // Si erreur de calcul, skip cet item
            }
          }
          
          reforgeableItems.push({
            instanceId: ownedItem.instanceId,
            itemId: ownedItem.itemId,
            name: baseItem.name,
            rarity,
            equipmentSlot,
            currentStats,
            reforgeCount,
            canReforge,
            reforgeCost
          });
        }
      }
      
      // Trier par rareté puis par nom
      const rarityOrder = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Ascended'];
      reforgeableItems.sort((a, b) => {
        const rarityCompare = rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity);
        return rarityCompare !== 0 ? rarityCompare : a.name.localeCompare(b.name);
      });
      
      return reforgeableItems;
      
    } catch (error) {
      console.error('[ReforgeService] getReforgeableItems error:', error);
      return [];
    }
  }

  // === MÉTHODES PRIVÉES ===

  /**
   * Validation complète d'une demande de reforge
   */
  private async validateReforgeRequest(itemInstanceId: string) {
    const [player, inventory, config] = await Promise.all([
      this.getPlayer(),
      this.getPlayerInventory(),
      this.getForgeConfig()
    ]);
    
    if (!player) throw new Error('PLAYER_NOT_FOUND');
    if (!inventory) throw new Error('INVENTORY_NOT_FOUND');
    if (!config || !config.isModuleEnabled('reforge')) throw new Error('REFORGE_MODULE_DISABLED');
    
    const item = inventory.getItem(itemInstanceId);
    if (!item) throw new Error('ITEM_NOT_FOUND_IN_INVENTORY');
    
    if (item.isEquipped) throw new Error('CANNOT_REFORGE_EQUIPPED_ITEM');
    
    const ItemModel = mongoose.model('Item');
    const baseItem = await ItemModel.findOne({ itemId: item.itemId });
    if (!baseItem) throw new Error('BASE_ITEM_NOT_FOUND');
    
    if (baseItem.category !== 'Equipment') throw new Error('ONLY_EQUIPMENT_CAN_BE_REFORGED');
    
    return { player, inventory, item, baseItem, config };
  }

  /**
   * Valide et nettoie la liste des stats lockées
   */
  private validateLockedStats(lockedStats: string[], equipmentSlot: string): string[] {
    const availableStats = this.getAvailableStatsForSlot(equipmentSlot);
    const maxLocks = 3; // AFK Arena limit
    
    const validStats = lockedStats
      .filter(stat => availableStats.includes(stat))
      .slice(0, maxLocks); // Forcer max 3
    
    return validStats;
  }

  /**
   * Obtient les stats actuelles d'un item
   */
  private getCurrentItemStats(baseItem: any, ownedItem: any): { [stat: string]: number } {
    // Prioriser les stats reforged si elles existent
    if (ownedItem.reforgedStats && Object.keys(ownedItem.reforgedStats).length > 0) {
      return { ...ownedItem.reforgedStats };
    }
    
    // Sinon calculer depuis les stats de base
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
    
    // Appliquer enhancement si présent
    if (enhancement > 0) {
      const enhancementMultiplier = 1 + (enhancement * 0.1); // Approximation
      for (const [stat, value] of Object.entries(currentStats)) {
        currentStats[stat] = Math.floor(value * enhancementMultiplier);
      }
    }
    
    return currentStats;
  }

  /**
   * Calcule le coût de reforge
   */
  private calculateReforgeCost(baseItem: any, lockedStats: string[], ownedItem: any): ReforgeCost {
    const config = { // Valeurs par défaut si config pas accessible
      baseGoldCost: 2000,
      baseGemCost: 100
    };
    
    const rarity = baseItem.rarity || 'Common';
    const reforgeCount = this.getReforgeCount(ownedItem);
    
    // Multiplicateur de rareté
    const rarityMultipliers: { [key: string]: number } = {
      'Common': 1,
      'Rare': 2,
      'Epic': 4,
      'Legendary': 8,
      'Mythic': 16,
      'Ascended': 32
    };
    
    // Multiplicateur de locks (0, 1, 2, 3 stats lockées)
    const lockMultipliers = [1, 1.5, 3, 6];
    const lockCount = Math.min(lockedStats.length, 3);
    
    // Multiplicateur de reforge count (plus c'est utilisé, plus c'est cher)
    const reforgeMultiplier = 1 + (reforgeCount * 0.1);
    
    const rarityMultiplier = rarityMultipliers[rarity] || 1;
    const lockMultiplier = lockMultipliers[lockCount] || 1;
    
    const finalMultiplier = rarityMultiplier * lockMultiplier * reforgeMultiplier;
    
    const gold = Math.floor(config.baseGoldCost * finalMultiplier);
    const gems = Math.floor(config.baseGemCost * finalMultiplier);
    
    // Matériaux requis
    const materials = this.getReforgeMaterials(rarity, lockCount);
    
    return { gold, gems, materials };
  }

  /**
   * Obtient les matériaux requis pour le reforge
   */
  private getReforgeMaterials(rarity: string, lockCount: number): { [materialId: string]: number } {
    const materials: { [materialId: string]: number } = {};
    
    // Matériaux de base
    materials['reforge_stone'] = 2 + lockCount;
    
    // Matériaux par rareté
    const rarityMaterials: { [key: string]: string } = {
      'Rare': 'magic_dust',
      'Epic': 'magic_dust',
      'Legendary': 'mystic_scroll',
      'Mythic': 'mystic_scroll',
      'Ascended': 'celestial_essence'
    };
    
    const materialId = rarityMaterials[rarity];
    if (materialId) {
      const rarityAmounts: { [key: string]: number } = {
        'Rare': 1,
        'Epic': 2,
        'Legendary': 1,
        'Mythic': 2,
        'Ascended': 1
      };
      
      materials[materialId] = (rarityAmounts[rarity] || 1) + Math.floor(lockCount / 2);
    }
    
    return materials;
  }

  /**
   * Obtient les ranges de stats possibles
   */
  private getStatRanges(rarity: string, equipmentSlot: string, lockedStats: string[]): { [stat: string]: { min: number; max: number } } {
    const availableStats = this.getAvailableStatsForSlot(equipmentSlot);
    const ranges: { [stat: string]: { min: number; max: number } } = {};
    
    // Ranges par rareté (approximation)
    const rarityRanges: { [rarity: string]: { min: number; max: number } } = {
      'Common': { min: 10, max: 50 },
      'Rare': { min: 25, max: 100 },
      'Epic': { min: 50, max: 200 },
      'Legendary': { min: 100, max: 400 },
      'Mythic': { min: 200, max: 800 },
      'Ascended': { min: 400, max: 1600 }
    };
    
    const baseRange = rarityRanges[rarity] || rarityRanges['Common'];
    
    // Ajuster ranges par type de stat
    const statModifiers: { [stat: string]: number } = {
      'hp': 3.0,      // HP plus élevé
      'atk': 1.0,     // ATK de base
      'def': 0.8,     // DEF un peu moins
      'crit': 0.3,    // Crit% plus bas
      'critDamage': 0.5,
      'vitesse': 0.4,
      'dodge': 0.3,
      'accuracy': 0.4,
      'moral': 1.2,
      'reductionCooldown': 0.2,
      'healthleech': 0.3,
      'healingBonus': 0.4,
      'shieldBonus': 0.4,
      'energyRegen': 0.3,
      'critResist': 0.3
    };
    
    for (const stat of availableStats) {
      if (lockedStats.includes(stat)) {
        // Stats lockées gardent leur valeur (sera géré dans generateNewStats)
        ranges[stat] = { min: 0, max: 0 };
      } else {
        const modifier = statModifiers[stat] || 1.0;
        ranges[stat] = {
          min: Math.floor(baseRange.min * modifier),
          max: Math.floor(baseRange.max * modifier)
        };
      }
    }
    
    return ranges;
  }

  /**
   * Génère de nouvelles stats selon les règles AFK Arena
   */
  private generateNewStats(rarity: string, equipmentSlot: string, lockedStats: string[], currentStats: { [stat: string]: number }): { [stat: string]: number } {
    const availableStats = this.getAvailableStatsForSlot(equipmentSlot);
    const ranges = this.getStatRanges(rarity, equipmentSlot, lockedStats);
    const newStats: { [stat: string]: number } = {};
    
    // Garder les stats lockées
    for (const stat of lockedStats) {
      if (currentStats[stat] !== undefined) {
        newStats[stat] = currentStats[stat];
      }
    }
    
    // Générer 2-4 stats au total selon le slot
    const slotStatCounts: { [slot: string]: { min: number; max: number } } = {
      'Weapon': { min: 2, max: 4 },
      'Armor': { min: 2, max: 4 },
      'Helmet': { min: 2, max: 3 },
      'Boots': { min: 2, max: 3 },
      'Gloves': { min: 2, max: 3 },
      'Accessory': { min: 2, max: 4 }
    };
    
    const statCount = slotStatCounts[equipmentSlot] || { min: 2, max: 4 };
    const targetStatCount = Math.floor(Math.random() * (statCount.max - statCount.min + 1)) + statCount.min;
    
    // Stats déjà lockées
    const alreadyHaveCount = lockedStats.length;
    const needToGenerate = Math.max(0, targetStatCount - alreadyHaveCount);
    
    // Pool de stats disponibles (pas déjà lockées)
    const availablePool = availableStats.filter(stat => !lockedStats.includes(stat));
    
    // Sélectionner stats à générer avec weighted random
    const statWeights: { [stat: string]: number } = {
      'hp': 3, 'atk': 3, 'def': 2, // Stats principales plus probables
      'crit': 2, 'critDamage': 2,
      'dodge': 1, 'accuracy': 1, 'vitesse': 1,
      'moral': 1, 'reductionCooldown': 1, 'healthleech': 1,
      'healingBonus': 1, 'shieldBonus': 1, 'energyRegen': 1,
      'critResist': 1
    };
    
    const selectedStats: string[] = [];
    const weightedPool = availablePool.map(stat => ({
      stat,
      weight: statWeights[stat] || 1,
      random: Math.random() * (statWeights[stat] || 1)
    })).sort((a, b) => b.random - a.random);
    
    for (let i = 0; i < needToGenerate && i < weightedPool.length; i++) {
      selectedStats.push(weightedPool[i].stat);
    }
    
    // Générer valeurs pour les stats sélectionnées
    for (const stat of selectedStats) {
      const range = ranges[stat];
      if (range && range.max > range.min) {
        // Distribution normale-ish qui favorise les valeurs moyennes-hautes
        const random1 = Math.random();
        const random2 = Math.random();
        const normalRandom = Math.max(random1, random2); // Biais vers valeurs hautes
        
        const value = Math.floor(range.min + (range.max - range.min) * normalRandom);
        newStats[stat] = Math.max(range.min, value);
      }
    }
    
    return newStats;
  }

  /**
   * Calcule les chances d'amélioration pour chaque stat
   */
  private calculateImprovementChances(currentStats: { [stat: string]: number }, possibleRanges: { [stat: string]: { min: number; max: number } }, lockedStats: string[]): { [stat: string]: number } {
    const chances: { [stat: string]: number } = {};
    
    for (const [stat, range] of Object.entries(possibleRanges)) {
      if (lockedStats.includes(stat)) {
        chances[stat] = 0; // Stats lockées = 0% chance de changement
        continue;
      }
      
      const currentValue = currentStats[stat] || 0;
      
      if (range.max <= range.min || currentValue >= range.max) {
        chances[stat] = 0; // Pas d'amélioration possible
      } else if (currentValue <= range.min) {
        chances[stat] = 100; // Amélioration garantie
      } else {
        // Calculer probabilité d'amélioration
        const totalRange = range.max - range.min;
        const improvementRange = range.max - currentValue;
        chances[stat] = Math.round((improvementRange / totalRange) * 100);
      }
    }
    
    return chances;
  }

  /**
   * Calcule les améliorations entre anciens et nouveaux stats
   */
  private calculateImprovements(oldStats: { [stat: string]: number }, newStats: { [stat: string]: number }): Array<{
    stat: string;
    oldValue: number;
    newValue: number;
    improvement: number;
  }> {
    const improvements: any[] = [];
    
    // Parcourir toutes les stats (anciennes et nouvelles)
    const allStats = new Set([...Object.keys(oldStats), ...Object.keys(newStats)]);
    
    for (const stat of allStats) {
      const oldValue = oldStats[stat] || 0;
      const newValue = newStats[stat] || 0;
      const improvement = newValue - oldValue;
      
      if (improvement !== 0) { // Seulement les changements
        improvements.push({
          stat,
          oldValue,
          newValue,
          improvement
        });
      }
    }
    
    return improvements;
  }

  /**
   * Vérifie si c'est un roll parfait
   */
  private isPerfectRoll(stats: { [stat: string]: number }, rarity: string, equipmentSlot: string): boolean {
    const ranges = this.getStatRanges(rarity, equipmentSlot, []);
    
    for (const [stat, value] of Object.entries(stats)) {
      const range = ranges[stat];
      if (range && value < range.max * 0.95) { // 95% du max = presque parfait
        return false;
      }
    }
    
    return true;
  }

  /**
   * Obtient le nombre de reforges effectués sur un item
   */
  private getReforgeCount(item: any): number {
    return item.equipmentData?.upgradeHistory?.length || 0;
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
  private async canPlayerAfford(player: any, cost: ReforgeCost): Promise<boolean> {
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
  private async spendPlayerResources(player: any, inventory: any, cost: ReforgeCost): Promise<void> {
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
  private async logOperation(itemInstanceId: string, baseItem: any, cost: ReforgeCost, success: boolean, additionalData: any): Promise<void> {
    try {
      const player = await this.getPlayer();
      
      await ForgeOperation.create({
        playerId: this.playerId,
        operationType: 'reforge',
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
          stats: new Map(Object.entries(additionalData.previousStats || {})),
          reforgedStats: new Map(Object.entries(additionalData.previousStats || {}))
        },
        result: {
          success,
          data: additionalData
        },
        afterData: success ? {
          stats: new Map(Object.entries(additionalData.newStats || {})),
          reforgedStats: new Map(Object.entries(additionalData.newStats || {}))
        } : undefined,
        operationContext: {
          lockedStats: additionalData.lockedStats || []
        },
        executionTimeMs: additionalData.executionTime,
        playerLevel: player?.level || 1
      });
    } catch (error) {
      console.warn('[ReforgeService] Failed to log operation:', error);
    }
  }

  /**
   * Met à jour les stats du joueur
   */
  private async updatePlayerStats(cost: ReforgeCost, success: boolean, powerGain: number, moduleData: any): Promise<void> {
    try {
      const stats = await (ForgeStats as any).getOrCreatePlayerStats(this.playerId);
      
      stats.updateWithOperation({
        operationType: 'reforge',
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
      console.warn('[ReforgeService] Failed to update player stats:', error);
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

export default ReforgeService;

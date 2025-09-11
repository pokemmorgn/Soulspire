import mongoose from 'mongoose';
import Account from '../../models/Account';
import Player from '../../models/Player';
import Item from '../../models/Item';
import Inventory from '../../models/Inventory';
import AuditLog from '../models/AuditLog';
import { AdminRole, AdminPermission, AdminAction } from '../types/adminTypes';

// Interfaces pour la gestion d'inventaire
interface IInventorySearchFilter {
  accountId?: string;
  serverId?: string;
  playerId?: string;
  hasItems?: string[]; // itemIds que le joueur doit posséder
  minGold?: number;
  maxGold?: number;
  minGems?: number;
  maxGems?: number;
  lastSyncDays?: number; // Jours depuis dernière sync
  inventoryIssues?: boolean; // Inventaires avec des problèmes détectés
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface IInventoryModification {
  playerId: string;
  serverId: string;
  operation: 'add' | 'remove' | 'set';
  items: Array<{
    itemId: string;
    quantity: number;
    level?: number;
    enhancement?: number;
  }>;
  reason: string;
  targetCategory?: string; // Pour optimiser les performances
}

interface IInventoryHealthCheck {
  playerId: string;
  serverId: string;
  healthScore: number; // 0-100
  issues: Array<{
    type: 'currency_mismatch' | 'orphaned_items' | 'invalid_equipment' | 'sync_outdated' | 'capacity_exceeded';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    autoFixable: boolean;
  }>;
  recommendations: string[];
  lastChecked: Date;
}

interface IInventoryStats {
  totalInventories: number;
  healthyInventories: number;
  problematicInventories: number;
  totalItems: number;
  totalValue: number;
  byRarity: Record<string, number>;
  byCategory: Record<string, number>;
  topItems: Array<{
    itemId: string;
    itemName: string;
    totalOwned: number;
    uniqueOwners: number;
  }>;
}

export class InventoryManagementService {

  // ===== RECHERCHE ET ANALYSE =====

  /**
   * Rechercher des inventaires avec filtres avancés
   */
  static async searchInventories(filter: IInventorySearchFilter): Promise<{
    inventories: any[];
    total: number;
    page: number;
    limit: number;
    stats: {
      healthyCount: number;
      problematicCount: number;
      totalValue: number;
    };
  }> {
    try {
      const page = filter.page || 1;
      const limit = Math.min(filter.limit || 20, 100);
      const skip = (page - 1) * limit;

      // Construction de la requête
      const query: any = {};
      
      if (filter.serverId) query.serverId = filter.serverId;
      if (filter.playerId) query.playerId = filter.playerId;
      
      if (filter.minGold !== undefined || filter.maxGold !== undefined) {
        query.gold = {};
        if (filter.minGold !== undefined) query.gold.$gte = filter.minGold;
        if (filter.maxGold !== undefined) query.gold.$lte = filter.maxGold;
      }
      
      if (filter.minGems !== undefined || filter.maxGems !== undefined) {
        query.gems = {};
        if (filter.minGems !== undefined) query.gems.$gte = filter.minGems;
        if (filter.maxGems !== undefined) query.gems.$lte = filter.maxGems;
      }

      if (filter.lastSyncDays) {
        const cutoff = new Date(Date.now() - filter.lastSyncDays * 24 * 60 * 60 * 1000);
        query.lastSyncAt = { $lt: cutoff };
      }

      // Pipeline d'agrégation avec enrichissement des données
      const pipeline: any[] = [
        { $match: query },
        {
          $lookup: {
            from: 'players',
            localField: 'playerId',
            foreignField: '_id',
            as: 'player'
          }
        },
        {
          $lookup: {
            from: 'accounts',
            localField: 'player.accountId',
            foreignField: 'accountId',
            as: 'account'
          }
        }
      ];

      // Filtres sur les comptes/joueurs
      if (filter.accountId) {
        pipeline.push({
          $match: { 'account.accountId': filter.accountId }
        });
      }

      // Filtres sur les items possédés
      if (filter.hasItems && filter.hasItems.length > 0) {
        const itemChecks = filter.hasItems.map(itemId => ({
          $or: [
            { [`storage.weapons.itemId`]: itemId },
            { [`storage.helmets.itemId`]: itemId },
            { [`storage.armors.itemId`]: itemId },
            { [`storage.boots.itemId`]: itemId },
            { [`storage.gloves.itemId`]: itemId },
            { [`storage.accessories.itemId`]: itemId },
            { [`storage.potions.itemId`]: itemId },
            { [`storage.scrolls.itemId`]: itemId },
            { [`storage.enhancementItems.itemId`]: itemId },
            { [`storage.enhancementMaterials.itemId`]: itemId },
            { [`storage.evolutionMaterials.itemId`]: itemId },
            { [`storage.craftingMaterials.itemId`]: itemId },
            { [`storage.awakeningMaterials.itemId`]: itemId },
            { [`storage.artifacts.itemId`]: itemId }
          ]
        }));
        
        pipeline.push({ $match: { $and: itemChecks } });
      }

      // Projection et calculs
      pipeline.push({
        $project: {
          playerId: 1,
          serverId: 1,
          gold: 1,
          gems: 1,
          paidGems: 1,
          tickets: 1,
          maxCapacity: 1,
          lastSyncAt: 1,
          lastCleanup: 1,
          storage: 1,
          playerInfo: { $arrayElemAt: ['$player', 0] },
          accountInfo: { $arrayElemAt: ['$account', 0] },
          // Calculer statistiques basiques
          totalItems: {
            $add: [
              { $size: { $ifNull: ['$storage.weapons', []] } },
              { $size: { $ifNull: ['$storage.helmets', []] } },
              { $size: { $ifNull: ['$storage.armors', []] } },
              { $size: { $ifNull: ['$storage.boots', []] } },
              { $size: { $ifNull: ['$storage.gloves', []] } },
              { $size: { $ifNull: ['$storage.accessories', []] } },
              { $size: { $ifNull: ['$storage.potions', []] } },
              { $size: { $ifNull: ['$storage.scrolls', []] } },
              { $size: { $ifNull: ['$storage.enhancementItems', []] } },
              { $size: { $ifNull: ['$storage.enhancementMaterials', []] } },
              { $size: { $ifNull: ['$storage.evolutionMaterials', []] } },
              { $size: { $ifNull: ['$storage.craftingMaterials', []] } },
              { $size: { $ifNull: ['$storage.awakeningMaterials', []] } },
              { $size: { $ifNull: ['$storage.artifacts', []] } }
            ]
          },
          currencyValue: {
            $add: [
              '$gold',
              { $multiply: ['$gems', 10] },
              { $multiply: ['$paidGems', 20] },
              { $multiply: ['$tickets', 100] }
            ]
          }
        }
      });

      // Tri
      const sortField = filter.sortBy || 'lastSyncAt';
      const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;
      pipeline.push({ $sort: { [sortField]: sortOrder } });

      // Pagination
      const countPipeline = [...pipeline, { $count: 'total' }];
      pipeline.push({ $skip: skip }, { $limit: limit });

      const [results, totalResults] = await Promise.all([
        Inventory.aggregate(pipeline),
        Inventory.aggregate(countPipeline)
      ]);

      const total = totalResults[0]?.total || 0;

      // Calculer statistiques globales
      let healthyCount = 0;
      let problematicCount = 0;
      let totalValue = 0;

      const formattedResults = results.map(inv => {
        const isHealthy = this.quickHealthCheck(inv);
        if (isHealthy) healthyCount++;
        else problematicCount++;
        
        totalValue += inv.currencyValue || 0;

        return this.formatInventorySearchResult(inv);
      });

      return {
        inventories: formattedResults,
        total,
        page,
        limit,
        stats: {
          healthyCount,
          problematicCount,
          totalValue
        }
      };

    } catch (error) {
      console.error('Search inventories error:', error);
      throw new Error('Failed to search inventories');
    }
  }

  /**
   * Obtenir les détails complets d'un inventaire
   */
  static async getInventoryDetails(playerId: string, serverId?: string): Promise<{
    inventory: any;
    player: any;
    account: any;
    healthCheck: IInventoryHealthCheck;
    itemDetails: any[];
  } | null> {
    try {
      const query: any = { playerId };
      if (serverId) query.serverId = serverId;

      const [inventory, player, account] = await Promise.all([
        Inventory.findOne(query),
        Player.findById(playerId),
        player ? Account.findOne({ accountId: (await Player.findById(playerId))?.accountId }) : null
      ]);

      if (!inventory) return null;

      // Effectuer un check de santé complet
      const healthCheck = await this.performHealthCheck(inventory);

      // Enrichir avec les détails des items
      const itemDetails = await this.getInventoryItemDetails(inventory);

      return {
        inventory: {
          playerId: inventory.playerId,
          serverId: inventory.serverId,
          currencies: {
            gold: inventory.gold,
            gems: inventory.gems,
            paidGems: inventory.paidGems,
            tickets: inventory.tickets
          },
          configuration: {
            maxCapacity: inventory.maxCapacity,
            autoSell: inventory.autoSell,
            autoSellRarity: inventory.autoSellRarity
          },
          statistics: inventory.getInventoryStats(),
          storage: inventory.storage,
          metadata: {
            lastSyncAt: inventory.lastSyncAt,
            lastCleanup: inventory.lastCleanup,
            createdAt: inventory.createdAt,
            updatedAt: inventory.updatedAt
          }
        },
        player: player ? {
          playerId: player.playerId,
          displayName: player.displayName,
          level: player.level,
          serverId: player.serverId,
          lastSeenAt: player.lastSeenAt
        } : null,
        account: account ? {
          accountId: account.accountId,
          username: account.username,
          email: account.email,
          accountStatus: account.accountStatus
        } : null,
        healthCheck,
        itemDetails
      };

    } catch (error) {
      console.error('Get inventory details error:', error);
      throw new Error('Failed to get inventory details');
    }
  }

  // ===== MODIFICATIONS D'INVENTAIRE =====

  /**
   * Modifier l'inventaire d'un joueur
   */
  static async modifyInventory(
    modification: IInventoryModification,
    adminId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; changes: any[]; message: string }> {
    try {
      const [inventory, admin] = await Promise.all([
        Inventory.findOne({ playerId: modification.playerId, serverId: modification.serverId }),
        Account.findOne({ accountId: adminId, adminEnabled: true })
      ]);

      if (!inventory) {
        throw new Error('Inventory not found');
      }

      if (!admin || !admin.hasAdminPermission('heroes.manage')) {
        throw new Error('Insufficient permissions to modify inventory');
      }

      const changes: any[] = [];
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          for (const itemData of modification.items) {
            const change = await this.modifyInventoryItem(
              inventory,
              itemData,
              modification.operation,
              session
            );
            changes.push(change);
          }

          // Synchroniser avec le joueur si nécessaire
          await inventory.syncWithPlayer();
          
          // Valider la cohérence post-modification
          const validation = await inventory.validateConsistency();
          if (!validation.valid) {
            throw new Error(`Inventory validation failed: ${validation.issues.join(', ')}`);
          }
        });

        // Logger l'action
        await this.createInventoryAuditLog({
          adminId,
          adminUsername: admin.username,
          adminRole: admin.adminRole!,
          action: 'player.edit_profile',
          playerId: modification.playerId,
          serverId: modification.serverId,
          operation: modification.operation,
          items: modification.items,
          reason: modification.reason,
          changes,
          ipAddress,
          userAgent,
          success: true
        });

        return {
          success: true,
          changes,
          message: `Inventory modified successfully: ${modification.operation} ${modification.items.length} item(s)`
        };

      } finally {
        await session.endSession();
      }

    } catch (error) {
      console.error('Modify inventory error:', error);
      throw new Error(`Failed to modify inventory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Réparer automatiquement les problèmes d'inventaire
   */
  static async repairInventory(
    playerId: string,
    serverId: string,
    adminId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; fixesApplied: string[]; issues: string[] }> {
    try {
      const [inventory, admin] = await Promise.all([
        Inventory.findOne({ playerId, serverId }),
        Account.findOne({ accountId: adminId, adminEnabled: true })
      ]);

      if (!inventory) {
        throw new Error('Inventory not found');
      }

      if (!admin || !admin.hasAdminPermission('player.manage')) {
        throw new Error('Insufficient permissions to repair inventory');
      }

      const fixesApplied: string[] = [];
      const remainingIssues: string[] = [];

      // Synchroniser avec le joueur
      const syncResult = await inventory.syncWithPlayer();
      if (syncResult) {
        fixesApplied.push('Synchronized currencies with player data');
      }

      // Nettoyer les items expirés
      const expiredCleaned = await inventory.cleanupExpiredItems();
      if (expiredCleaned > 0) {
        fixesApplied.push(`Removed ${expiredCleaned} expired items`);
      }

      // Optimiser le stockage
      await inventory.optimizeStorage();
      fixesApplied.push('Optimized inventory storage');

      // Valider la cohérence finale
      const validation = await inventory.validateConsistency();
      if (!validation.valid) {
        remainingIssues.push(...validation.issues);
      }

      // Logger la réparation
      await this.createInventoryAuditLog({
        adminId,
        adminUsername: admin.username,
        adminRole: admin.adminRole!,
        action: 'player.modify_progress',
        playerId,
        serverId,
        operation: 'repair',
        items: [],
        reason: 'Automated inventory repair',
        changes: fixesApplied,
        ipAddress,
        userAgent,
        success: true
      });

      return {
        success: true,
        fixesApplied,
        issues: remainingIssues
      };

    } catch (error) {
      console.error('Repair inventory error:', error);
      throw new Error(`Failed to repair inventory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===== VÉRIFICATIONS DE SANTÉ =====

  /**
   * Effectuer un check de santé complet sur un inventaire
   */
  static async performHealthCheck(inventory: any): Promise<IInventoryHealthCheck> {
    try {
      let healthScore = 100;
      const issues: any[] = [];
      const recommendations: string[] = [];

      // Vérifier la cohérence avec le joueur
      const validation = await inventory.validateConsistency();
      if (!validation.valid) {
        validation.issues.forEach((issue: string) => {
          let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
          let type: string = 'sync_outdated';
          
          if (issue.includes('mismatch')) {
            severity = 'high';
            type = 'currency_mismatch';
            healthScore -= 15;
          } else if (issue.includes('non-existent hero')) {
            severity = 'critical';
            type = 'invalid_equipment';
            healthScore -= 25;
          }

          issues.push({
            type,
            severity,
            description: issue,
            autoFixable: type === 'currency_mismatch' || type === 'sync_outdated'
          });
        });
      }

      // Vérifier la capacité
      const stats = inventory.getInventoryStats();
      if (stats.totalItems > inventory.maxCapacity) {
        issues.push({
          type: 'capacity_exceeded',
          severity: 'medium',
          description: `Inventory capacity exceeded: ${stats.totalItems}/${inventory.maxCapacity}`,
          autoFixable: false
        });
        healthScore -= 10;
        recommendations.push('Increase inventory capacity or remove items');
      }

      // Vérifier les items expirés
      const expiredItems = inventory.getExpiredConsumables();
      if (expiredItems.length > 0) {
        issues.push({
          type: 'orphaned_items',
          severity: 'low',
          description: `${expiredItems.length} expired consumables found`,
          autoFixable: true
        });
        healthScore -= 5;
        recommendations.push('Clean up expired consumables');
      }

      // Vérifier la dernière synchronisation
      const lastSyncAge = Date.now() - inventory.lastSyncAt.getTime();
      const daysSinceSync = lastSyncAge / (1000 * 60 * 60 * 24);
      
      if (daysSinceSync > 7) {
        issues.push({
          type: 'sync_outdated',
          severity: daysSinceSync > 30 ? 'high' : 'medium',
          description: `Inventory not synchronized for ${Math.floor(daysSinceSync)} days`,
          autoFixable: true
        });
        healthScore -= daysSinceSync > 30 ? 20 : 10;
        recommendations.push('Synchronize inventory with player data');
      }

      // Recommandations générales
      if (issues.length === 0) {
        recommendations.push('Inventory is in good health');
      } else {
        const autoFixableCount = issues.filter(i => i.autoFixable).length;
        if (autoFixableCount > 0) {
          recommendations.push(`${autoFixableCount} issues can be auto-fixed`);
        }
      }

      return {
        playerId: inventory.playerId,
        serverId: inventory.serverId,
        healthScore: Math.max(0, healthScore),
        issues,
        recommendations,
        lastChecked: new Date()
      };

    } catch (error) {
      console.error('Health check error:', error);
      return {
        playerId: inventory.playerId,
        serverId: inventory.serverId,
        healthScore: 0,
        issues: [{
          type: 'sync_outdated',
          severity: 'critical',
          description: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          autoFixable: false
        }],
        recommendations: ['Manual investigation required'],
        lastChecked: new Date()
      };
    }
  }

  /**
   * Obtenir les statistiques globales des inventaires
   */
  static async getInventoryStats(): Promise<IInventoryStats> {
    try {
      const [totalInventories, itemStats, rarityStats, categoryStats] = await Promise.all([
        Inventory.countDocuments(),
        this.getItemDistributionStats(),
        this.getRarityDistributionStats(),
        this.getCategoryDistributionStats()
      ]);

      // Effectuer un check de santé global rapide
      const healthyCount = await Inventory.countDocuments({
        lastSyncAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });

      const problematicCount = totalInventories - healthyCount;

      return {
        totalInventories,
        healthyInventories: healthyCount,
        problematicInventories: problematicCount,
        totalItems: itemStats.totalItems,
        totalValue: itemStats.totalValue,
        byRarity: rarityStats,
        byCategory: categoryStats,
        topItems: itemStats.topItems || []
      };

    } catch (error) {
      console.error('Get inventory stats error:', error);
      throw new Error('Failed to get inventory statistics');
    }
  }

  // ===== MÉTHODES UTILITAIRES PRIVÉES =====

  /**
   * Check rapide de santé (pour les listes)
   */
  private static quickHealthCheck(inventory: any): boolean {
    const lastSyncAge = Date.now() - new Date(inventory.lastSyncAt).getTime();
    const daysSinceSync = lastSyncAge / (1000 * 60 * 60 * 24);
    
    return daysSinceSync <= 7 && 
           inventory.totalItems <= inventory.maxCapacity &&
           inventory.gold >= 0 && 
           inventory.gems >= 0;
  }

  /**
   * Modifier un item spécifique dans l'inventaire
   */
  private static async modifyInventoryItem(
    inventory: any,
    itemData: { itemId: string; quantity: number; level?: number; enhancement?: number },
    operation: 'add' | 'remove' | 'set',
    session?: any
  ): Promise<any> {
    const { itemId, quantity, level, enhancement } = itemData;
    
    switch (operation) {
      case 'add':
        const addedItem = await inventory.addItem(itemId, quantity, level || 1);
        if (enhancement && addedItem.instanceId) {
          await inventory.upgradeEquipment(addedItem.instanceId, level, enhancement);
        }
        return {
          operation: 'add',
          itemId,
          quantity,
          level: level || 1,
          enhancement: enhancement || 0,
          instanceId: addedItem.instanceId
        };

      case 'remove':
        const hasItem = inventory.hasItem(itemId, quantity);
        if (!hasItem) {
          throw new Error(`Player does not have ${quantity}x ${itemId}`);
        }
        
        // Trouver et supprimer les items
        let removedCount = 0;
        const categories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories', 
                          'potions', 'scrolls', 'enhancementItems', 'enhancementMaterials', 
                          'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials', 'artifacts'];
        
        for (const category of categories) {
          const items = inventory.storage[category] || [];
          for (let i = items.length - 1; i >= 0 && removedCount < quantity; i--) {
            if (items[i].itemId === itemId) {
              items.splice(i, 1);
              removedCount++;
            }
          }
        }

        return {
          operation: 'remove',
          itemId,
          quantity: removedCount
        };

      case 'set':
        // Pour 'set', on supprime tout puis on ajoute la quantité voulue
        const currentQuantity = inventory.hasItem(itemId, 999) ? 
          this.countPlayerItems(inventory, itemId) : 0;
        
        if (currentQuantity > 0) {
          await this.modifyInventoryItem(inventory, { itemId, quantity: currentQuantity }, 'remove', session);
        }
        
        if (quantity > 0) {
          return await this.modifyInventoryItem(inventory, { itemId, quantity, level, enhancement }, 'add', session);
        }

        return {
          operation: 'set',
          itemId,
          quantity,
          previousQuantity: currentQuantity
        };

      default:
        throw new Error(`Invalid operation: ${operation}`);
    }
  }

  /**
   * Compter le nombre d'items d'un type possédés
   */
  private static countPlayerItems(inventory: any, itemId: string): number {
    let count = 0;
    const categories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories', 
                      'potions', 'scrolls', 'enhancementItems', 'enhancementMaterials', 
                      'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials', 'artifacts'];
    
    for (const category of categories) {
      const items = inventory.storage[category] || [];
      items.forEach((item: any) => {
        if (item.itemId === itemId) {
          count += item.quantity || 1;
        }
      });
    }
    
    return count;
  }

  /**
   * Enrichir l'inventaire avec les détails des items
   */
  private static async getInventoryItemDetails(inventory: any): Promise<any[]> {
    try {
      const itemIds = new Set<string>();
      const categories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories', 
                        'potions', 'scrolls', 'enhancementItems', 'enhancementMaterials', 
                        'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials', 'artifacts'];
      
      // Collecter tous les itemIds uniques
      for (const category of categories) {
        const items = inventory.storage[category] || [];
        items.forEach((item: any) => itemIds.add(item.itemId));
      }

      // Récupérer les détails des items depuis la base
      const items = await Item.find({ itemId: { $in: Array.from(itemIds) } })
        .select('itemId name description rarity category sellPrice iconUrl')
        .exec();

      return items.map(item => ({
        itemId: item.itemId,
        name: item.name,
        description: item.description,
        rarity: item.rarity,
        category: item.category,
        sellPrice: item.sellPrice,
        iconUrl: item.iconUrl
      }));

    } catch (error) {
      console.error('Get item details error:', error);
      return [];
    }
  }

  /**
   * Formater le résultat de recherche d'inventaire
   */
  private static formatInventorySearchResult(result: any): any {
    return {
      playerId: result.playerId,
      serverId: result.serverId,
      currencies: {
        gold: result.gold,
        gems: result.gems,
        paidGems: result.paidGems,
        tickets: result.tickets,
        totalValue: result.currencyValue
      },
      capacity: {
        current: result.totalItems,
        max: result.maxCapacity,
        utilizationPercent: result.maxCapacity > 0 ? 
          Math.round((result.totalItems / result.maxCapacity) * 100) : 0
      },
      player: result.playerInfo ? {
        displayName: result.playerInfo.displayName,
        level: result.playerInfo.level,
        lastSeenAt: result.playerInfo.lastSeenAt
      } : null,
      account: result.accountInfo ? {
        username: result.accountInfo.username,
        accountStatus: result.accountInfo.accountStatus
      } : null,
      metadata: {
        lastSyncAt: result.lastSyncAt,
        lastCleanup: result.lastCleanup,
        isHealthy: this.quickHealthCheck(result)
      }
    };
  }

  /**
   * Obtenir les statistiques de distribution des items
   */
  private static async getItemDistributionStats(): Promise<{
    totalItems: number;
    totalValue: number;
    topItems: any[];
  }> {
    try {
      const stats = await Inventory.aggregate([
        {
          $project: {
            allItems: {
              $concatArrays: [
                { $ifNull: ['$storage.weapons', []] },
                { $ifNull: ['$storage.helmets', []] },
                { $ifNull: ['$storage.armors', []] },
                { $ifNull: ['$storage.boots', []] },
                { $ifNull: ['$storage.gloves', []] },
                { $ifNull: ['$storage.accessories', []] },
                { $ifNull: ['$storage.potions', []] },
                { $ifNull: ['$storage.scrolls', []] },
                { $ifNull: ['$storage.enhancementItems', []] },
                { $ifNull: ['$storage.enhancementMaterials', []] },
                { $ifNull: ['$storage.evolutionMaterials', []] },
                { $ifNull: ['$storage.craftingMaterials', []] },
                { $ifNull: ['$storage.awakeningMaterials', []] },
                { $ifNull: ['$storage.artifacts', []] }
              ]
            },
            currencyValue: {
              $add: [
                '$gold',
                { $multiply: ['$gems', 10] },
                { $multiply: ['$paidGems', 20] },
                { $multiply: ['$tickets', 100] }
              ]
            }
          }
        },
        {
          $unwind: '$allItems'
        },
        {
          $group: {
            _id: '$allItems.itemId',
            totalOwned: { $sum: { $ifNull: ['$allItems.quantity', 1] } },
            uniqueOwners: { $sum: 1 },
            totalCurrencyValue: { $sum: '$currencyValue' }
          }
        },
        {
          $sort: { totalOwned: -1 }
        },
        {
          $limit: 10
        }
      ]);

      const totalStats = await Inventory.aggregate([
        {
          $project: {
            totalItems: {
              $add: [
                { $size: { $ifNull: ['$storage.weapons', []] } },
                { $size: { $ifNull: ['$storage.helmets', []] } },
                { $size: { $ifNull: ['$storage.armors', []] } },
                { $size: { $ifNull: ['$storage.boots', []] } },
                { $size: { $ifNull: ['$storage.gloves', []] } },
                { $size: { $ifNull: ['$storage.accessories', []] } },
                { $size: { $ifNull: ['$storage.potions', []] } },
                { $size: { $ifNull: ['$storage.scrolls', []] } },
                { $size: { $ifNull: ['$storage.enhancementItems', []] } },
                { $size: { $ifNull: ['$storage.enhancementMaterials', []] } },
                { $size: { $ifNull: ['$storage.evolutionMaterials', []] } },
                { $size: { $ifNull: ['$storage.craftingMaterials', []] } },
                { $size: { $ifNull: ['$storage.awakeningMaterials', []] } },
                { $size: { $ifNull: ['$storage.artifacts', []] } }
              ]
            },
            currencyValue: {
              $add: [
                '$gold',
                { $multiply: ['$gems', 10] },
                { $multiply: ['$paidGems', 20] },
                { $multiply: ['$tickets', 100] }
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalItems: { $sum: '$totalItems' },
            totalValue: { $sum: '$currencyValue' }
          }
        }
      ]);

      // Enrichir avec les noms des items
      const topItems = await Promise.all(
        stats.map(async (stat: any) => {
          const item = await Item.findOne({ itemId: stat._id }).select('name');
          return {
            itemId: stat._id,
            itemName: item?.name || 'Unknown Item',
            totalOwned: stat.totalOwned,
            uniqueOwners: stat.uniqueOwners
          };
        })
      );

      return {
        totalItems: totalStats[0]?.totalItems || 0,
        totalValue: totalStats[0]?.totalValue || 0,
        topItems
      };

    } catch (error) {
      console.error('Get item distribution stats error:', error);
      return { totalItems: 0, totalValue: 0, topItems: [] };
    }
  }

  /**
   * Obtenir les statistiques de distribution par rareté
   */
  private static async getRarityDistributionStats(): Promise<Record<string, number>> {
    try {
      const stats = await Inventory.aggregate([
        {
          $project: {
            allItems: {
              $concatArrays: [
                { $ifNull: ['$storage.weapons', []] },
                { $ifNull: ['$storage.helmets', []] },
                { $ifNull: ['$storage.armors', []] },
                { $ifNull: ['$storage.boots', []] },
                { $ifNull: ['$storage.gloves', []] },
                { $ifNull: ['$storage.accessories', []] },
                { $ifNull: ['$storage.potions', []] },
                { $ifNull: ['$storage.scrolls', []] },
                { $ifNull: ['$storage.enhancementItems', []] },
                { $ifNull: ['$storage.enhancementMaterials', []] },
                { $ifNull: ['$storage.evolutionMaterials', []] },
                { $ifNull: ['$storage.craftingMaterials', []] },
                { $ifNull: ['$storage.awakeningMaterials', []] },
                { $ifNull: ['$storage.artifacts', []] }
              ]
            }
          }
        },
        {
          $unwind: '$allItems'
        },
        {
          $lookup: {
            from: 'items',
            localField: 'allItems.itemId',
            foreignField: 'itemId',
            as: 'itemInfo'
          }
        },
        {
          $unwind: '$itemInfo'
        },
        {
          $group: {
            _id: '$itemInfo.rarity',
            count: { $sum: { $ifNull: ['$allItems.quantity', 1] } }
          }
        }
      ]);

      const rarityDistribution: Record<string, number> = {
        Common: 0,
        Rare: 0,
        Epic: 0,
        Legendary: 0,
        Mythic: 0,
        Ascended: 0
      };

      stats.forEach((stat: any) => {
        if (rarityDistribution.hasOwnProperty(stat._id)) {
          rarityDistribution[stat._id] = stat.count;
        }
      });

      return rarityDistribution;

    } catch (error) {
      console.error('Get rarity distribution stats error:', error);
      return { Common: 0, Rare: 0, Epic: 0, Legendary: 0, Mythic: 0, Ascended: 0 };
    }
  }

  /**
   * Obtenir les statistiques de distribution par catégorie
   */
  private static async getCategoryDistributionStats(): Promise<Record<string, number>> {
    try {
      const categoryDistribution: Record<string, number> = {};

      const stats = await Inventory.aggregate([
        {
          $project: {
            weapons: { $size: { $ifNull: ['$storage.weapons', []] } },
            helmets: { $size: { $ifNull: ['$storage.helmets', []] } },
            armors: { $size: { $ifNull: ['$storage.armors', []] } },
            boots: { $size: { $ifNull: ['$storage.boots', []] } },
            gloves: { $size: { $ifNull: ['$storage.gloves', []] } },
            accessories: { $size: { $ifNull: ['$storage.accessories', []] } },
            potions: { $size: { $ifNull: ['$storage.potions', []] } },
            scrolls: { $size: { $ifNull: ['$storage.scrolls', []] } },
            enhancementItems: { $size: { $ifNull: ['$storage.enhancementItems', []] } },
            enhancementMaterials: { $size: { $ifNull: ['$storage.enhancementMaterials', []] } },
            evolutionMaterials: { $size: { $ifNull: ['$storage.evolutionMaterials', []] } },
            craftingMaterials: { $size: { $ifNull: ['$storage.craftingMaterials', []] } },
            awakeningMaterials: { $size: { $ifNull: ['$storage.awakeningMaterials', []] } },
            artifacts: { $size: { $ifNull: ['$storage.artifacts', []] } }
          }
        },
        {
          $group: {
            _id: null,
            weapons: { $sum: '$weapons' },
            helmets: { $sum: '$helmets' },
            armors: { $sum: '$armors' },
            boots: { $sum: '$boots' },
            gloves: { $sum: '$gloves' },
            accessories: { $sum: '$accessories' },
            potions: { $sum: '$potions' },
            scrolls: { $sum: '$scrolls' },
            enhancementItems: { $sum: '$enhancementItems' },
            enhancementMaterials: { $sum: '$enhancementMaterials' },
            evolutionMaterials: { $sum: '$evolutionMaterials' },
            craftingMaterials: { $sum: '$craftingMaterials' },
            awakeningMaterials: { $sum: '$awakeningMaterials' },
            artifacts: { $sum: '$artifacts' }
          }
        }
      ]);

      if (stats[0]) {
        const result = stats[0];
        categoryDistribution['Equipment'] = (result.weapons || 0) + (result.helmets || 0) + 
          (result.armors || 0) + (result.boots || 0) + (result.gloves || 0) + (result.accessories || 0);
        categoryDistribution['Consumables'] = (result.potions || 0) + (result.scrolls || 0) + (result.enhancementItems || 0);
        categoryDistribution['Materials'] = (result.enhancementMaterials || 0) + (result.evolutionMaterials || 0) + 
          (result.craftingMaterials || 0) + (result.awakeningMaterials || 0);
        categoryDistribution['Artifacts'] = result.artifacts || 0;
      }

      return categoryDistribution;

    } catch (error) {
      console.error('Get category distribution stats error:', error);
      return { Equipment: 0, Consumables: 0, Materials: 0, Artifacts: 0 };
    }
  }

  /**
   * Créer un log d'audit pour les actions d'inventaire
   */
  private static async createInventoryAuditLog(logData: {
    adminId: string;
    adminUsername: string;
    adminRole: AdminRole;
    action: AdminAction;
    playerId: string;
    serverId: string;
    operation: string;
    items: any[];
    reason: string;
    changes: any[];
    ipAddress: string;
    userAgent: string;
    success: boolean;
  }): Promise<void> {
    try {
      await AuditLog.createLog({
        adminId: logData.adminId,
        adminUsername: logData.adminUsername,
        adminRole: logData.adminRole,
        action: logData.action,
        resource: 'player_inventory',
        resourceId: logData.playerId,
        details: {
          additionalInfo: {
            serverId: logData.serverId,
            operation: logData.operation,
            itemsModified: logData.items.length,
            items: logData.items,
            reason: logData.reason,
            changes: logData.changes
          }
        },
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent,
        success: logData.success,
        severity: logData.changes.length > 5 ? 'high' : 'medium'
      });
    } catch (error) {
      console.error('Failed to create inventory audit log:', error);
    }
  }

  // ===== DÉTECTION DE TRICHEURS =====

  /**
   * Détecter les inventaires suspects (pour intégration avec EconomyService)
   */
  static async detectSuspiciousInventories(serverId?: string): Promise<Array<{
    playerId: string;
    serverId: string;
    suspicionLevel: number;
    flags: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      evidence: any;
    }>;
    recommendations: string[];
  }>> {
    try {
      const query = serverId ? { serverId } : {};
      const inventories = await Inventory.find(query).limit(100);
      const suspicious: any[] = [];

      for (const inventory of inventories) {
        const suspicionData = await this.analyzeSuspiciousInventory(inventory);
        if (suspicionData.suspicionLevel >= 60) {
          suspicious.push(suspicionData);
        }
      }

      return suspicious.sort((a, b) => b.suspicionLevel - a.suspicionLevel);

    } catch (error) {
      console.error('Detect suspicious inventories error:', error);
      return [];
    }
  }

  /**
   * Analyser un inventaire pour détecter des signes de triche
   */
  private static async analyzeSuspiciousInventory(inventory: any): Promise<{
    playerId: string;
    serverId: string;
    suspicionLevel: number;
    flags: any[];
    recommendations: string[];
  }> {
    let suspicionLevel = 0;
    const flags: any[] = [];
    const recommendations: string[] = [];

    try {
      // Récupérer les données du joueur pour contexte
      const player = await Player.findById(inventory.playerId);
      if (!player) {
        return { playerId: inventory.playerId, serverId: inventory.serverId, suspicionLevel: 0, flags, recommendations };
      }

      // 1. Vérifier les monnaies excessives
      const expectedGold = player.level * 1000;
      if (inventory.gold > expectedGold * 20) {
        flags.push({
          type: 'excessive_currency',
          severity: 'critical',
          description: `Gold amount ${inventory.gold} extremely high for level ${player.level}`,
          evidence: { gold: inventory.gold, level: player.level, expected: expectedGold }
        });
        suspicionLevel += 35;
      }

      // 2. Gems sans achats
      if (inventory.gems > 50000 && player.totalSpentUSDOnServer === 0) {
        flags.push({
          type: 'suspicious_gems',
          severity: 'high',
          description: `High gem count (${inventory.gems}) with no purchases`,
          evidence: { gems: inventory.gems, totalSpent: player.totalSpentUSDOnServer }
        });
        suspicionLevel += 25;
      }

      // 3. Items de haute rareté en quantité suspecte
      const stats = inventory.getInventoryStats();
      const highRarityRatio = (stats.legendaryCount + stats.mythicCount + stats.ascendedCount) / Math.max(stats.totalItems, 1);
      
      if (highRarityRatio > 0.5 && player.level < 50) {
        flags.push({
          type: 'excessive_rare_items',
          severity: 'high',
          description: `Too many high-rarity items (${Math.round(highRarityRatio * 100)}%) for level ${player.level}`,
          evidence: { 
            highRarityCount: stats.legendaryCount + stats.mythicCount + stats.ascendedCount,
            totalItems: stats.totalItems,
            level: player.level 
          }
        });
        suspicionLevel += 20;
      }

      // 4. Inventaire plein de façon suspecte
      if (stats.totalItems >= inventory.maxCapacity && player.level < 30) {
        flags.push({
          type: 'premature_capacity',
          severity: 'medium',
          description: `Inventory at max capacity too early (level ${player.level})`,
          evidence: { currentItems: stats.totalItems, capacity: inventory.maxCapacity, level: player.level }
        });
        suspicionLevel += 15;
      }

      // 5. Items équipés de niveau trop élevé
      const equippedItems = inventory.getEquippedItems();
      const highLevelEquipment = equippedItems.filter((item: any) => item.level > player.level + 10);
      
      if (highLevelEquipment.length > 0) {
        flags.push({
          type: 'overpowered_equipment',
          severity: 'high',
          description: `${highLevelEquipment.length} equipped items with level too high`,
          evidence: { 
            suspiciousItems: highLevelEquipment.map((item: any) => ({ 
              itemId: item.itemId, 
              level: item.level 
            })),
            playerLevel: player.level 
          }
        });
        suspicionLevel += 25;
      }

      // 6. Désynchronisation prolongée
      const daysSinceSync = (Date.now() - inventory.lastSyncAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceSync > 30) {
        flags.push({
          type: 'sync_avoidance',
          severity: 'medium',
          description: `Inventory not synchronized for ${Math.floor(daysSinceSync)} days`,
          evidence: { daysSinceSync: Math.floor(daysSinceSync) }
        });
        suspicionLevel += 10;
      }

      // Générer recommandations
      if (suspicionLevel >= 80) {
        recommendations.push('Immediate investigation required', 'Consider account suspension');
      } else if (suspicionLevel >= 60) {
        recommendations.push('Flag for manual review', 'Monitor closely');
      } else if (suspicionLevel >= 40) {
        recommendations.push('Add to watchlist');
      }

      if (flags.some(f => f.type === 'excessive_currency')) {
        recommendations.push('Audit currency transaction history');
      }

      return {
        playerId: inventory.playerId,
        serverId: inventory.serverId,
        suspicionLevel: Math.min(suspicionLevel, 100),
        flags,
        recommendations
      };

    } catch (error) {
      console.error('Analyze suspicious inventory error:', error);
      return { playerId: inventory.playerId, serverId: inventory.serverId, suspicionLevel: 0, flags, recommendations };
    }
  }

  // ===== MÉTHODES DE VÉRIFICATION DES PERMISSIONS =====

  /**
   * Vérifier les permissions pour une action d'inventaire
   */
  static async checkInventoryPermission(
    adminId: string,
    action: 'view' | 'modify' | 'repair' | 'analyze'
  ): Promise<boolean> {
    try {
      const admin = await Account.findOne({ accountId: adminId, adminEnabled: true });
      if (!admin || !admin.isAdmin()) {
        return false;
      }

      const permissionMap = {
        'view': 'player.view',
        'modify': 'heroes.manage',
        'repair': 'player.manage',
        'analyze': 'analytics.view'
      };

      return admin.hasAdminPermission(permissionMap[action] as AdminPermission);
    } catch (error) {
      console.error('Check inventory permission error:', error);
      return false;
    }
  }

  // ===== UTILITAIRES POUR L'EXPORT =====

  /**
   * Exporter les données d'inventaire pour analyse
   */
  static async exportInventoryData(
    filter: IInventorySearchFilter,
    format: 'json' | 'csv'
  ): Promise<{ data: any; filename: string }> {
    try {
      const searchResult = await this.searchInventories({ ...filter, limit: 1000 });
      const data = searchResult.inventories;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `inventory_export_${timestamp}.${format}`;

      if (format === 'csv') {
        // Convertir en CSV
        const csvData = this.convertInventoryDataToCSV(data);
        return { data: csvData, filename };
      }

      return { data, filename };

    } catch (error) {
      console.error('Export inventory data error:', error);
      throw new Error('Failed to export inventory data');
    }
  }

  /**
   * Convertir les données d'inventaire en CSV
   */
  private static convertInventoryDataToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = [
      'playerId', 'serverId', 'playerName', 'accountUsername',
      'gold', 'gems', 'paidGems', 'tickets', 'totalCurrencyValue',
      'itemsCount', 'maxCapacity', 'utilizationPercent',
      'lastSyncAt', 'isHealthy'
    ];

    const csvRows = data.map(inv => [
      inv.playerId,
      inv.serverId,
      inv.player?.displayName || '',
      inv.account?.username || '',
      inv.currencies.gold,
      inv.currencies.gems,
      inv.currencies.paidGems,
      inv.currencies.tickets,
      inv.currencies.totalValue,
      inv.capacity.current,
      inv.capacity.max,
      inv.capacity.utilizationPercent,
      inv.metadata.lastSyncAt,
      inv.metadata.isHealthy
    ]);

    return [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
  }
}

export default InventoryManagementService;

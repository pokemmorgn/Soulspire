import Inventory from "../models/Inventory";
import Player from "../models/Player";
import Item from "../models/Item";
import { EventService } from "./EventService";

export interface InventoryItemResult {
  success: boolean;
  item?: any;
  error?: string;
  code?: string;
}

export interface ChestOpenResult {
  success: boolean;
  rewards?: any[];
  addedItems?: any[];
  error?: string;
  code?: string;
}

export interface EquipmentResult {
  success: boolean;
  previousItem?: any;
  newItem?: any;
  error?: string;
  code?: string;
}

export interface InventoryStats {
  totalItems: number;
  totalValue: number;
  categoryBreakdown: Record<string, number>;
  rarityBreakdown: Record<string, number>;
  equippedCount: number;
  maxLevelEquipment: number;
}

export class InventoryService {

  // === RÉCUPÉRER L'INVENTAIRE COMPLET D'UN JOUEUR ===
public static async getPlayerInventory(playerId: string, serverId?: string) {
  try {
    console.log(`📦 Récupération inventaire pour ${playerId}`);

    // ✅ NOUVEAU: Récupérer Player avec les nouvelles ressources
    const [player, inventory] = await Promise.all([
      Player.findById(playerId).select("gold gems paidGems tickets heroXP ascensionEssences fragments materials serverId"),
      Inventory.findOne({ playerId })
    ]);

    if (!player) {
      throw new Error("Player not found");
    }

    // ✅ VÉRIFICATION SERVEUR: S'assurer que le serveur correspond
    if (serverId && player.serverId !== serverId) {
      throw new Error("Player not found on this server");
    }

    // Créer l'inventaire s'il n'existe pas
    let playerInventory = inventory;
    if (!playerInventory) {
      playerInventory = await (Inventory as any).createForPlayer(playerId);
      
      // ✅ SYNCHRONISER les monnaies depuis Player vers Inventory
      if (playerInventory) {
        playerInventory.gold = player.gold;
        playerInventory.gems = player.gems;
        playerInventory.paidGems = player.paidGems;
        playerInventory.tickets = player.tickets;
        await playerInventory.save();
      }
    }

    // ✅ VÉRIFIER LA SYNCHRONISATION des monnaies
    if (playerInventory) {
      const needsSync = 
        playerInventory.gold !== player.gold ||
        playerInventory.gems !== player.gems ||
        playerInventory.paidGems !== player.paidGems ||
        playerInventory.tickets !== player.tickets;

      if (needsSync) {
        console.log("⚠️ Désynchronisation détectée, mise à jour...");
        playerInventory.gold = player.gold;
        playerInventory.gems = player.gems;
        playerInventory.paidGems = player.paidGems;
        playerInventory.tickets = player.tickets;
        await playerInventory.save();
      }
    }

    const safeInventory = playerInventory as NonNullable<typeof playerInventory>;

    // Convertir les Maps en objets pour la réponse
    const fragmentsObj = this.mapToObject(player.fragments);
    const materialsObj = this.mapToObject(player.materials);

    // Calculer les statistiques
    const stats = safeInventory.getInventoryStats();
    const enhancedStats = await this.calculateEnhancedStats(safeInventory);

    // ✅ NOUVEAU: Calculer la valeur totale des monnaies player
    const totalCurrencyValue = (
      player.gold * 0.001 +           // 1000 gold = 1 point
      player.gems * 1 +               // 1 gem = 1 point  
      player.paidGems * 2 +           // 1 paid gem = 2 points
      player.tickets * 5 +            // 1 ticket = 5 points
      player.heroXP * 0.01 +          // 100 hero XP = 1 point
      player.ascensionEssences * 10   // 1 essence = 10 points
    );

    return {
      success: true,
      
      // ✅ NOUVEAU: Section ressources Player séparée
      playerCurrencies: {
        gold: player.gold,
        gems: player.gems,
        paidGems: player.paidGems,
        tickets: player.tickets,
        heroXP: player.heroXP,                    // ← NOUVEAU
        ascensionEssences: player.ascensionEssences  // ← NOUVEAU
      },
      
      // Section inventaire (existant mais renommé pour clarté)
      inventory: {
        fragments: fragmentsObj,
        materials: materialsObj,
        storage: safeInventory.storage,
        specialCurrencies: this.mapToObject(safeInventory.storage.specialCurrencies)
      },
      
      // ✅ STATISTIQUES AMÉLIORÉES
      stats: { 
        ...stats, 
        ...enhancedStats,
        totalCurrencyValue: Math.round(totalCurrencyValue)  // ← NOUVEAU
      },
      
      config: {
        maxCapacity: safeInventory.maxCapacity,
        autoSell: safeInventory.autoSell,
        autoSellRarity: safeInventory.autoSellRarity,
        lastCleanup: safeInventory.lastCleanup
      }
    };

  } catch (error: any) {
    console.error("❌ Erreur getPlayerInventory:", error);
    throw error;
  }
}

  // === AJOUTER UN OBJET À L'INVENTAIRE ===
  public static async addItem(
    playerId: string,
    itemId: string,
    quantity: number = 1,
    level: number = 1,
    enhancement: number = 0,
    serverId?: string
  ): Promise<InventoryItemResult> {
    try {
      console.log(`➕ Ajout ${quantity}x ${itemId} pour ${playerId}`);

      // ✅ VÉRIFICATION PLAYER ET SERVEUR
      const player = await Player.findById(playerId);
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      if (serverId && player.serverId !== serverId) {
        return { success: false, error: "Player not found on this server", code: "WRONG_SERVER" };
      }

      // Vérifier que l'objet existe
      const itemData = await Item.findOne({ itemId });
      if (!itemData) {
        return { success: false, error: "Item not found", code: "ITEM_NOT_FOUND" };
      }

      // Récupérer ou créer l'inventaire
      let inventory = await Inventory.findOne({ playerId });
      if (!inventory) {
        inventory = await (Inventory as any).createForPlayer(playerId);
      }

      const safeInventory = inventory as NonNullable<typeof inventory>;

      // Vérifier la capacité
      const currentItems = await this.getTotalItemCount(safeInventory);
      if (currentItems >= safeInventory.maxCapacity) {
        // Auto-sell si configuré
        if (safeInventory.autoSell && this.shouldAutoSell(itemData.rarity, safeInventory.autoSellRarity)) {
          const sellResult = await this.autoSellItem(playerId, itemData, quantity);
          return {
            success: true,
            item: {
              itemId,
              quantity,
              autoSold: true,
              goldGained: sellResult.goldGained
            }
          };
        }
        
        return { success: false, error: "Inventory full", code: "INVENTORY_FULL" };
      }

      // Ajouter l'objet
      const ownedItem = await safeInventory.addItem(itemId, quantity, level);
      
      // Appliquer l'amélioration si spécifiée
      if (enhancement > 0) {
        ownedItem.enhancement = enhancement;
        await safeInventory.save();
      }

      // ✅ METTRE À JOUR les missions et événements avec serverId
      await this.updateProgressTracking(playerId, quantity, {
        itemType: itemData.category,
        rarity: itemData.rarity,
        itemId: itemId,
        serverId: player.serverId
      });

      return {
        success: true,
        item: {
          ...ownedItem,
          itemData: {
            name: itemData.name,
            description: itemData.description,
            rarity: itemData.rarity,
            category: itemData.category,
            iconUrl: itemData.iconUrl
          }
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur addItem:", error);
      return { success: false, error: error.message, code: "ADD_ITEM_FAILED" };
    }
  }

  // === RÉCUPÉRER LES OBJETS PAR CATÉGORIE ===
  public static async getItemsByCategory(
    playerId: string,
    category: string,
    subCategory?: string,
    serverId?: string
  ) {
    try {
      // ✅ VÉRIFICATION PLAYER ET SERVEUR
      if (serverId) {
        const player = await Player.findById(playerId).select("serverId");
        if (!player || player.serverId !== serverId) {
          throw new Error("Player not found on this server");
        }
      }

      const inventory = await Inventory.findOne({ playerId });
      if (!inventory) {
        throw new Error("Inventory not found");
      }

      let items = inventory.getItemsByCategory(category, subCategory);
      
      // Enrichir avec les données des objets
      const enrichedItems = await Promise.all(items.map(async (item) => {
        const itemData = await Item.findOne({ itemId: item.itemId }).select("name description rarity iconUrl category");
        return {
          ...item,
          itemData
        };
      }));

      return {
        success: true,
        category,
        subCategory,
        items: enrichedItems,
        count: enrichedItems.length
      };

    } catch (error: any) {
      console.error("❌ Erreur getItemsByCategory:", error);
      throw error;
    }
  }

  // === SUPPRIMER UN OBJET DE L'INVENTAIRE ===
  public static async removeItem(
    playerId: string,
    instanceId: string,
    quantity?: number,
    serverId?: string
  ): Promise<InventoryItemResult> {
    try {
      console.log(`➖ Suppression ${quantity || "tout"} de ${instanceId} pour ${playerId}`);

      // ✅ VÉRIFICATION PLAYER ET SERVEUR
      if (serverId) {
        const player = await Player.findById(playerId).select("serverId");
        if (!player || player.serverId !== serverId) {
          return { success: false, error: "Player not found on this server", code: "WRONG_SERVER" };
        }
      }

      const inventory = await Inventory.findOne({ playerId });
      if (!inventory) {
        return { success: false, error: "Inventory not found", code: "INVENTORY_NOT_FOUND" };
      }

      // Récupérer l'objet avant suppression pour les logs
      const item = inventory.getItem(instanceId);
      if (!item) {
        return { success: false, error: "Item not found", code: "ITEM_NOT_FOUND" };
      }

      const removed = await inventory.removeItem(instanceId, quantity);
      if (!removed) {
        return { success: false, error: "Failed to remove item", code: "REMOVE_FAILED" };
      }

      return {
        success: true,
        item: {
          instanceId,
          removedQuantity: quantity || item.quantity
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur removeItem:", error);
      return { success: false, error: error.message, code: "REMOVE_ITEM_FAILED" };
    }
  }

  public static async equipItem(
  playerId: string,
  instanceId: string,
  heroId: string,
  serverId?: string
): Promise<EquipmentResult> {
  try {
    console.log(`⚔️ Équipement ${instanceId} sur héros ${heroId} pour ${playerId}`);

    const [player, inventory] = await Promise.all([
      Player.findById(playerId),
      Inventory.findOne({ playerId })
    ]);

    if (!player) {
      return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
    }

    if (serverId && player.serverId !== serverId) {
      return { success: false, error: "Player not found on this server", code: "WRONG_SERVER" };
    }

    if (!inventory) {
      return { success: false, error: "Inventory not found", code: "INVENTORY_NOT_FOUND" };
    }

    // ✅ CORRECTION: Comparer avec h._id au lieu de h.heroId
    const playerHero = player.heroes.find(h => h._id?.toString() === heroId);
    if (!playerHero) {
      return { success: false, error: "Hero not owned", code: "HERO_NOT_OWNED" };
    }

    // Récupérer l'objet à équiper
    const itemToEquip = inventory.getItem(instanceId);
    if (!itemToEquip) {
      return { success: false, error: "Equipment not found", code: "EQUIPMENT_NOT_FOUND" };
    }

    // Vérifier que c'est un équipement
    const itemData = await Item.findOne({ itemId: itemToEquip.itemId });
    if (!itemData || itemData.category !== "Equipment") {
      return { success: false, error: "Item is not equipment", code: "NOT_EQUIPMENT" };
    }

    // Récupérer l'ancien équipement du même slot (s'il existe)
    const equippedItems = inventory.getEquippedItems(heroId);
    const oldEquipment = equippedItems.find(item => {
      // TODO: Améliorer la logique selon le slot d'équipement
      return true;
    });

    // Équiper le nouvel objet
    const success = await inventory.equipItem(instanceId, heroId);
    if (!success) {
      return { success: false, error: "Failed to equip item", code: "EQUIP_FAILED" };
    }

    return {
      success: true,
      newItem: itemToEquip,
      previousItem: oldEquipment || null
    };

  } catch (error: any) {
    console.error("❌ Erreur equipItem:", error);
    return { success: false, error: error.message, code: "EQUIP_ITEM_FAILED" };
  }
}

  // === DÉSÉQUIPER UN OBJET ===
  public static async unequipItem(
    playerId: string,
    instanceId: string,
    serverId?: string
  ): Promise<EquipmentResult> {
    try {
      console.log(`🔓 Déséquipement ${instanceId} pour ${playerId}`);

      // ✅ VÉRIFICATION PLAYER ET SERVEUR
      if (serverId) {
        const player = await Player.findById(playerId).select("serverId");
        if (!player || player.serverId !== serverId) {
          return { success: false, error: "Player not found on this server", code: "WRONG_SERVER" };
        }
      }

      const inventory = await Inventory.findOne({ playerId });
      if (!inventory) {
        return { success: false, error: "Inventory not found", code: "INVENTORY_NOT_FOUND" };
      }

      const item = inventory.getItem(instanceId);
      if (!item) {
        return { success: false, error: "Equipment not found", code: "EQUIPMENT_NOT_FOUND" };
      }

      if (!item.isEquipped) {
        return { success: false, error: "Item is not equipped", code: "NOT_EQUIPPED" };
      }

      const success = await inventory.unequipItem(instanceId);
      if (!success) {
        return { success: false, error: "Failed to unequip item", code: "UNEQUIP_FAILED" };
      }

      return {
        success: true,
        newItem: { ...item, isEquipped: false, equippedTo: undefined }
      };

    } catch (error: any) {
      console.error("❌ Erreur unequipItem:", error);
      return { success: false, error: error.message, code: "UNEQUIP_ITEM_FAILED" };
    }
  }

  // === OUVRIR UN COFFRE ===
  public static async openChest(
    playerId: string,
    instanceId: string,
    serverId?: string
  ): Promise<ChestOpenResult> {
    try {
      console.log(`📦 Ouverture coffre ${instanceId} pour ${playerId}`);

      // ✅ VÉRIFICATION PLAYER ET SERVEUR
      const player = await Player.findById(playerId).select("serverId");
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      if (serverId && player.serverId !== serverId) {
        return { success: false, error: "Player not found on this server", code: "WRONG_SERVER" };
      }

      const inventory = await Inventory.findOne({ playerId });
      if (!inventory) {
        return { success: false, error: "Inventory not found", code: "INVENTORY_NOT_FOUND" };
      }

      const chestItem = inventory.getItem(instanceId);
      if (!chestItem) {
        return { success: false, error: "Chest not found", code: "CHEST_NOT_FOUND" };
      }

      // Récupérer les données du coffre
      const itemData = await Item.findOne({ itemId: chestItem.itemId });
      if (!itemData || itemData.category !== "Chest") {
        return { success: false, error: "Item is not a chest", code: "NOT_A_CHEST" };
      }

      // Ouvrir le coffre
      const rewards = await itemData.openChest(playerId);

      // Supprimer le coffre de l'inventaire
      await inventory.removeItem(instanceId, 1);

      // Ajouter les récompenses
      const addedItems = [];
      for (const reward of rewards) {
        if (reward.type === "Item" && reward.itemId) {
          const addResult = await this.addItem(playerId, reward.itemId, reward.quantity, 1, 0, serverId);
          if (addResult.success) {
            addedItems.push(addResult.item);
          }
        }
      }

      return {
        success: true,
        rewards,
        addedItems
      };

    } catch (error: any) {
      console.error("❌ Erreur openChest:", error);
      return { success: false, error: error.message, code: "OPEN_CHEST_FAILED" };
    }
  }

  // === NETTOYER LES OBJETS EXPIRÉS ===
  public static async cleanupExpiredItems(playerId: string, serverId?: string) {
    try {
      // ✅ VÉRIFICATION PLAYER ET SERVEUR
      if (serverId) {
        const player = await Player.findById(playerId).select("serverId");
        if (!player || player.serverId !== serverId) {
          throw new Error("Player not found on this server");
        }
      }

      const inventory = await Inventory.findOne({ playerId });
      if (!inventory) {
        throw new Error("Inventory not found");
      }

      const removedCount = await inventory.cleanupExpiredItems();

      return {
        success: true,
        message: "Inventory cleanup completed",
        removedItems: removedCount
      };

    } catch (error: any) {
      console.error("❌ Erreur cleanupExpiredItems:", error);
      throw error;
    }
  }

  // === MÉTHODES UTILITAIRES PRIVÉES ===

  // Convertir Map en objet
  private static mapToObject(map: Map<string, any> | undefined): Record<string, any> {
    if (!map || !(map instanceof Map)) {
      return {};
    }
    return Object.fromEntries(map.entries());
  }

  // Compter le nombre total d'objets
  private static async getTotalItemCount(inventory: any): Promise<number> {
    const stats = inventory.getInventoryStats();
    return stats.totalItems;
  }

  // Vérifier si un objet doit être auto-vendu
  private static shouldAutoSell(itemRarity: string, maxAutoSellRarity: string): boolean {
    const rarityOrder = ["Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended"];
    const itemIndex = rarityOrder.indexOf(itemRarity);
    const maxIndex = rarityOrder.indexOf(maxAutoSellRarity);
    
    return itemIndex !== -1 && maxIndex !== -1 && itemIndex <= maxIndex;
  }

  // Auto-vendre un objet
  private static async autoSellItem(playerId: string, itemData: any, quantity: number) {
    const sellPrice = Math.floor((itemData.sellPrice || 10) * quantity * 0.8); // 80% du prix de vente
    
    // ✅ CORRECTION: Utiliser findById au lieu de findOne({ playerId })
    const player = await Player.findById(playerId);
    if (player) {
      player.gold += sellPrice;
      await player.save();

      // ✅ SYNCHRONISER avec l'inventaire
      const inventory = await Inventory.findOne({ playerId });
      if (inventory) {
        inventory.gold = player.gold;
        await inventory.save();
      }
    }

    return {
      goldGained: sellPrice
    };
  }

  // Calculer des statistiques avancées
  private static async calculateEnhancedStats(inventory: any): Promise<any> {
    const totalValue = inventory.calculateTotalValue();
    
    return {
      totalValue,
      categoryBreakdown: {
        weapons: (inventory.storage.weapons || []).length,
        armor: (inventory.storage.helmets || []).length + 
               (inventory.storage.armors || []).length + 
               (inventory.storage.boots || []).length + 
               (inventory.storage.gloves || []).length,
        accessories: (inventory.storage.accessories || []).length,
        consumables: (inventory.storage.potions || []).length + 
                    (inventory.storage.scrolls || []).length,
        materials: (inventory.storage.enhancementMaterials || []).length + 
                  (inventory.storage.evolutionMaterials || []).length
      }
    };
  }

  // Mettre à jour les missions et événements
  private static async updateProgressTracking(
    playerId: string,
    value: number,
    additionalData?: any
  ) {
    try {
      // Vérifier si EventService existe avant de l'utiliser
      if (typeof EventService !== 'undefined' && EventService.updatePlayerProgress) {
        await EventService.updatePlayerProgress(
          playerId,
          additionalData?.serverId || "",
          "collect_items",
          value,
          additionalData
        );
      }

      console.log(`📊 Progression événements mise à jour: +${value} objets collectés`);
    } catch (error) {
      console.error("⚠️ Erreur mise à jour progression inventaire:", error);
    }
  }

  // === MÉTHODES D'ADMINISTRATION ===

  // Récupérer les statistiques globales
  public static async getGlobalStats(serverId?: string) {
    try {
      const pipeline: any[] = [];
      
      // ✅ FILTRER par serveur si spécifié
      if (serverId) {
        // Joindre avec Player pour filtrer par serverId
        pipeline.push(
          {
            $lookup: {
              from: "players",
              localField: "playerId",
              foreignField: "_id",
              as: "player"
            }
          },
          {
            $match: {
              "player.serverId": serverId
            }
          }
        );
      }

      pipeline.push({
        $group: {
          _id: null,
          totalPlayers: { $sum: 1 },
          avgCapacity: { $avg: "$maxCapacity" },
          totalItems: { $sum: { $size: { $ifNull: ["$storage.weapons", []] } } }
        }
      });

      const stats = await Inventory.aggregate(pipeline);

      return {
        success: true,
        serverId,
        stats: stats[0] || {
          totalPlayers: 0,
          avgCapacity: 0,
          totalItems: 0
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getGlobalStats:", error);
      throw error;
    }
  }

  // ✅ NOUVELLE MÉTHODE: Synchroniser les monnaies Player <-> Inventory
  public static async syncCurrencies(playerId: string): Promise<boolean> {
    try {
      const [player, inventory] = await Promise.all([
        Player.findById(playerId).select("gold gems paidGems tickets"),
        Inventory.findOne({ playerId })
      ]);

      if (!player || !inventory) {
        return false;
      }

      // Utiliser Player comme source de vérité
      inventory.gold = player.gold;
      inventory.gems = player.gems;
      inventory.paidGems = player.paidGems;
      inventory.tickets = player.tickets;

      await inventory.save();
      console.log(`✅ Monnaies synchronisées pour ${playerId}`);
      return true;

    } catch (error) {
      console.error(`❌ Erreur sync monnaies pour ${playerId}:`, error);
      return false;
    }
  }

  // ✅ MÉTHODE DE VALIDATION: Vérifier la cohérence des données
  public static async validateInventoryConsistency(playerId: string): Promise<{
    valid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    try {
      const [player, inventory] = await Promise.all([
        Player.findById(playerId),
        Inventory.findOne({ playerId })
      ]);
      
      if (!player) {
        issues.push("Player not found");
        return { valid: false, issues, suggestions };
      }
      
      if (!inventory) {
        issues.push("Inventory not found");
        suggestions.push("Create inventory for player");
        return { valid: false, issues, suggestions };
      }
      
      // Vérifier la synchronisation des monnaies
      if (inventory.gold !== player.gold) {
        issues.push("Gold desynchronized");
        suggestions.push(`Sync gold: Player(${player.gold}) != Inventory(${inventory.gold})`);
      }
      
      if (inventory.gems !== player.gems) {
        issues.push("Gems desynchronized");
        suggestions.push(`Sync gems: Player(${player.gems}) != Inventory(${inventory.gems})`);
      }
      
      if (inventory.paidGems !== player.paidGems) {
        issues.push("Paid gems desynchronized");
        suggestions.push(`Sync paid gems: Player(${player.paidGems}) != Inventory(${inventory.paidGems})`);
      }
      
      if (inventory.tickets !== player.tickets) {
        issues.push("Tickets desynchronized");
        suggestions.push(`Sync tickets: Player(${player.tickets}) != Inventory(${inventory.tickets})`);
      }
      
      // Vérifier la cohérence des objets équipés
      const equippedItems = inventory.getEquippedItems();
      for (const item of equippedItems) {
        const heroExists = player.heroes.some(h => h.heroId.toString() === item.equippedTo);
        if (!heroExists) {
          issues.push(`Item ${item.instanceId} equipped to non-existent hero ${item.equippedTo}`);
          suggestions.push(`Unequip item ${item.instanceId}`);
        }
      }
      
      return {
        valid: issues.length === 0,
        issues,
        suggestions
      };
      
    } catch (error: any) {
      issues.push(`Validation error: ${error.message}`);
      return { valid: false, issues, suggestions };
    }
  }

  // ✅ MÉTHODE DE MIGRATION: Migrer les inventaires vers la nouvelle architecture
  public static async migrateInventories(): Promise<{
    migrated: number;
    errors: number;
    details: string[];
  }> {
    console.log("🔄 Début migration inventaires...");
    
    const details: string[] = [];
    let migrated = 0;
    let errors = 0;
    
    try {
      // Récupérer tous les inventaires
      const inventories = await Inventory.find({});
      details.push(`Trouvé ${inventories.length} inventaires à vérifier`);
      
      for (const inventory of inventories) {
        try {
          // Vérifier si le playerId correspond à un Player._id valide
          const player = await Player.findById(inventory.playerId);
          
          if (!player) {
            details.push(`⚠️ Player non trouvé pour inventory ${inventory.playerId} - suppression`);
            // Supprimer l'inventaire orphelin
            await Inventory.deleteOne({ _id: inventory._id });
            continue;
          }
          
          // Synchroniser les monnaies
          let needsUpdate = false;
          
          if (inventory.gold !== player.gold) {
            inventory.gold = player.gold;
            needsUpdate = true;
          }
          
          if (inventory.gems !== player.gems) {
            inventory.gems = player.gems;
            needsUpdate = true;
          }
          
          if (inventory.paidGems !== player.paidGems) {
            inventory.paidGems = player.paidGems;
            needsUpdate = true;
          }
          
          if (inventory.tickets !== player.tickets) {
            inventory.tickets = player.tickets;
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            await inventory.save();
            details.push(`✅ Synchronisé inventory ${inventory.playerId}`);
          }
          
          migrated++;
          
        } catch (error: any) {
          details.push(`❌ Erreur migration inventory ${inventory.playerId}: ${error.message}`);
          errors++;
        }
      }
      
      details.push(`✅ Migration terminée: ${migrated} inventaires migrés, ${errors} erreurs`);
      console.log(`✅ Migration terminée: ${migrated} inventaires migrés, ${errors} erreurs`);
      
      return { migrated, errors, details };
      
    } catch (error: any) {
      const errorMsg = `❌ Erreur migration globale: ${error.message}`;
      details.push(errorMsg);
      console.error(errorMsg);
      throw error;
    }
  }

  // ✅ MÉTHODE UTILITAIRE: Créer un inventaire complet pour un nouveau joueur
  public static async createInventoryForNewPlayer(playerId: string): Promise<any> {
    try {
      console.log(`🆕 Création inventaire pour nouveau joueur ${playerId}`);
      
      // Vérifier que le joueur existe
      const player = await Player.findById(playerId);
      if (!player) {
        throw new Error("Player not found");
      }
      
      // Créer l'inventaire
      const inventory = await (Inventory as any).createForPlayer(playerId);
      
      // Synchroniser les monnaies initiales
      inventory.gold = player.gold;
      inventory.gems = player.gems;
      inventory.paidGems = player.paidGems;
      inventory.tickets = player.tickets;
      
      await inventory.save();
      
      console.log(`✅ Inventaire créé pour ${playerId}`);
      return inventory;
      
    } catch (error: any) {
      console.error(`❌ Erreur création inventaire pour ${playerId}:`, error);
      throw error;
    }
  }

  // ✅ MÉTHODE DE MAINTENANCE: Nettoyer tous les inventaires orphelins
  public static async cleanupOrphanedInventories(): Promise<{
    deleted: number;
    details: string[];
  }> {
    console.log("🧹 Nettoyage inventaires orphelins...");
    
    const details: string[] = [];
    let deleted = 0;
    
    try {
      const inventories = await Inventory.find({});
      details.push(`Vérification de ${inventories.length} inventaires`);
      
      for (const inventory of inventories) {
        const player = await Player.findById(inventory.playerId);
        
        if (!player) {
          await Inventory.deleteOne({ _id: inventory._id });
          details.push(`🗑️ Supprimé inventaire orphelin: ${inventory.playerId}`);
          deleted++;
        }
      }
      
      details.push(`✅ Nettoyage terminé: ${deleted} inventaires orphelins supprimés`);
      console.log(`✅ Nettoyage terminé: ${deleted} inventaires orphelins supprimés`);
      
      return { deleted, details };
      
    } catch (error: any) {
      const errorMsg = `❌ Erreur nettoyage: ${error.message}`;
      details.push(errorMsg);
      console.error(errorMsg);
      throw error;
    }
  }
}

import Inventory from "../models/Inventory";
import Player from "../models/Player";
import Item from "../models/Item";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";

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
  public static async getPlayerInventory(playerId: string) {
    try {
      console.log(`📦 Récupération inventaire pour ${playerId}`);

      // Récupérer le joueur et son inventaire
      const [player, inventory] = await Promise.all([
        Player.findById(playerId).select("gold gems paidGems tickets fragments materials"),
        Inventory.findOne({ playerId })
      ]);

      if (!player) {
        throw new Error("Player not found");
      }

      // Créer l'inventaire s'il n'existe pas
      let playerInventory = inventory;
      if (!playerInventory) {
        playerInventory = await (Inventory as any).createForPlayer(playerId);
      }

      // Force TypeScript à comprendre que playerInventory existe maintenant
      const safeInventory = playerInventory as NonNullable<typeof playerInventory>;

      // Convertir les Maps en objets pour la réponse
      const fragmentsObj = this.mapToObject(player.fragments);
      const materialsObj = this.mapToObject(player.materials);

      // Calculer les statistiques
      const stats = safeInventory.getInventoryStats();
      const enhancedStats = await this.calculateEnhancedStats(safeInventory);

      return {
        success: true,
        inventory: {
          currency: {
            gold: player.gold,
            gems: player.gems,
            paidGems: player.paidGems,
            tickets: player.tickets
          },
          fragments: fragmentsObj,
          materials: materialsObj,
          storage: safeInventory.storage,
          specialCurrencies: this.mapToObject(safeInventory.storage.specialCurrencies)
        },
        stats: { ...stats, ...enhancedStats },
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
    enhancement: number = 0
  ): Promise<InventoryItemResult> {
    try {
      console.log(`➕ Ajout ${quantity}x ${itemId} pour ${playerId}`);

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

      // Force TypeScript à comprendre que inventory existe maintenant
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

      // Mettre à jour les missions et événements
      await this.updateProgressTracking(playerId, quantity, {
        itemType: itemData.category,
        rarity: itemData.rarity,
        itemId: itemId
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

  // === SUPPRIMER UN OBJET DE L'INVENTAIRE ===
  public static async removeItem(
    playerId: string,
    instanceId: string,
    quantity?: number
  ): Promise<InventoryItemResult> {
    try {
      console.log(`➖ Suppression ${quantity || "tout"} de ${instanceId} pour ${playerId}`);

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

  // === ÉQUIPER UN OBJET SUR UN HÉROS ===
  public static async equipItem(
    playerId: string,
    instanceId: string,
    heroId: string
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

      if (!inventory) {
        return { success: false, error: "Inventory not found", code: "INVENTORY_NOT_FOUND" };
      }

      // Vérifier que le joueur possède ce héros
      const playerHero = player.heroes.find(h => h.heroId.toString() === heroId);
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
        return true; // Logique à affiner selon vos besoins
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
    instanceId: string
  ): Promise<EquipmentResult> {
    try {
      console.log(`🔓 Déséquipement ${instanceId} pour ${playerId}`);

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
    instanceId: string
  ): Promise<ChestOpenResult> {
    try {
      console.log(`📦 Ouverture coffre ${instanceId} pour ${playerId}`);

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
          const addResult = await this.addItem(playerId, reward.itemId, reward.quantity);
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

  // === RÉCUPÉRER LES OBJETS PAR CATÉGORIE ===
  public static async getItemsByCategory(
    playerId: string,
    category: string,
    subCategory?: string
  ) {
    try {
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

  // === NETTOYER LES OBJETS EXPIRÉS ===
  public static async cleanupExpiredItems(playerId: string) {
    try {
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
    
    const player = await Player.findById(playerId);
    if (player) {
      player.gold += sellPrice;
      await player.save();
    }

    return {
      goldGained: sellPrice
    };
  }

  // Calculer des statistiques avancées
  private static async calculateEnhancedStats(inventory: any): Promise<Partial<InventoryStats>> {
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
      await Promise.all([
        EventService.updatePlayerProgress(
          playerId,
          "",
          "collect_items",
          value,
          additionalData
        )
      ]);

      console.log(`📊 Progression événements mise à jour: +${value} objets collectés`);
    } catch (error) {
      console.error("⚠️ Erreur mise à jour progression inventaire:", error);
    }
  }

  // === MÉTHODES D'ADMINISTRATION ===

  // Récupérer les statistiques globales
  public static async getGlobalStats() {
    try {
      const stats = await Inventory.aggregate([
        { $group: {
          _id: null,
          totalPlayers: { $sum: 1 },
          avgCapacity: { $avg: "$maxCapacity" },
          totalItems: { $sum: { $size: { $ifNull: ["$storage.weapons", []] } } }
        }}
      ]);

      return {
        success: true,
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
}

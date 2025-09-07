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

export class InventoryService {

  // === RÉCUPÉRER L'INVENTAIRE COMPLET D'UN JOUEUR ===
  public static async getPlayerInventory(playerId: string, serverId?: string) {
    try {
      console.log(`📦 Récupération inventaire pour ${playerId}`);

      // ✅ CORRECTION: Utiliser _id au lieu de playerId
      const [player, inventory] = await Promise.all([
        Player.findById(playerId).select("gold gems paidGems tickets fragments materials serverId"),
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
        playerInventory.gold = player.gold;
        playerInventory.gems = player.gems;
        playerInventory.paidGems = player.paidGems;
        playerInventory.tickets = player.tickets;
        await playerInventory.save();
      }

      // ✅ VÉRIFIER LA SYNCHRONISATION des monnaies
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

  // === ÉQUIPER UN OBJET SUR UN HÉROS ===
  public static async equipItem(
    playerId: string,
    instanceId: string,
    heroId: string,
    serverId?: string
  ): Promise<EquipmentResult> {
    try {
      console.log(`⚔️ Équipement ${instanceId} sur héros ${heroId} pour ${playerId}`);

      // ✅ CORRECTION: Utiliser findById au lieu de findOne({ playerId })
      const [player, inventory] = await Promise.all([
        Player.findById(playerId),
        Inventory.findOne({ playerId })
      ]);

      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      // ✅ VÉRIFICATION SERVEUR
      if (serverId && player.serverId !== serverId) {
        return { success: false, error: "Player not found on this server", code: "WRONG_SERVER" };
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
        // ✅ TODO: Améliorer la logique selon le slot d'équipement
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
      await Promise.all([
        EventService.updatePlayerProgress(
          playerId,
          additionalData?.serverId || "",
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
}

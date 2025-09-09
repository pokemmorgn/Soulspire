import Shop from "../models/Shop";
import Player from "../models/Player";
import Inventory from "../models/Inventory";
import Item from "../models/Item";
import Hero from "../models/Hero";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { WebSocketService } from "./WebSocketService"; 

export interface ShopPurchaseResult {
  success: boolean;
  purchase?: {
    itemName: string;
    quantity: number;
    cost: Record<string, number>;
    rewards: Array<{
      type: string;
      itemId?: string;
      heroId?: string;
      currencyType?: string;
      quantity: number;
      instanceId?: string;
    }>;
  };
  playerResources?: {
    gold: number;
    gems: number;
    paidGems: number;
    tickets: number;
  };
  error?: string;
  code?: string;
}

export interface ShopRefreshResult {
  success: boolean;
  cost?: Record<string, number>;
  newItemsCount?: number;
  playerResources?: Record<string, number>;
  error?: string;
  code?: string;
}

export class ShopService {

  // === RÉCUPÉRER LES BOUTIQUES DISPONIBLES POUR UN JOUEUR ===
  public static async getAvailableShops(
    playerId: string,
    shopType?: string,
    page: number = 1,
    limit: number = 10
  ) {
    try {
      console.log(`🛒 Récupération boutiques pour ${playerId} (type: ${shopType || "all"})`);

      const player = await Player.findById(playerId).select("level vipLevel");
      if (!player) {
        throw new Error("Player not found");
      }

      // Construire le filtre avec la méthode du modèle
      const shops = await (Shop as any).getActiveShopsForPlayer(playerId);

      // Filtrer par type si spécifié
      const filteredShops = shopType ? 
        shops.filter((shop: any) => shop.shopType === shopType) : 
        shops;

      // Paginer
      const skip = (page - 1) * limit;
      const paginatedShops = filteredShops.slice(skip, skip + limit);

      // Enrichir avec des statistiques
      const enrichedShops = await Promise.all(paginatedShops.map(async (shop: any) => {
        const now = new Date();
        return {
          shopType: shop.shopType,
          name: shop.name,
          description: shop.description,
          isActive: shop.isActive,
          levelRequirement: shop.levelRequirement,
          vipLevelRequirement: shop.vipLevelRequirement,
          priority: shop.priority,
          iconUrl: shop.iconUrl,
          stats: {
            totalItems: shop.items?.length || 0,
            featuredItems: shop.featuredItems?.length || 0,
            canRefresh: !!(shop.refreshCost && (shop.refreshCost.gold || shop.refreshCost.gems)),
            timeUntilReset: shop.nextResetTime ? Math.max(0, shop.nextResetTime.getTime() - now.getTime()) : null
          }
        };
      }));

      return {
        success: true,
        shops: enrichedShops,
        pagination: {
          page,
          limit,
          total: filteredShops.length,
          pages: Math.ceil(filteredShops.length / limit)
        },
        playerInfo: {
          level: player.level,
          vipLevel: player.vipLevel || 0
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getAvailableShops:", error);
      throw error;
    }
  }

  // === RÉCUPÉRER LES DÉTAILS D'UNE BOUTIQUE ===
  public static async getShopDetails(playerId: string, shopType: string) {
    try {
      console.log(`🏪 Détails boutique ${shopType} pour ${playerId}`);

      const shop = await Shop.findOne({ shopType, isActive: true });
      if (!shop) {
        throw new Error("Shop not found or inactive");
      }

      // Vérifier l'accès du joueur
      const canAccess = await shop.canPlayerAccess(playerId);
      if (!canAccess) {
        throw new Error("Access denied to this shop");
      }

      // Enrichir les objets avec les données complètes
      const enrichedItems = await Promise.all(shop.items.map(async (shopItem: any) => {
        let itemData = null;
        
        // Récupérer les données de l'objet
        if (shopItem.type === "Item" && shopItem.content.itemId) {
          itemData = await Item.findOne({ itemId: shopItem.content.itemId })
            .select("name description iconUrl rarity category sellPrice");
        } else if (shopItem.type === "Fragment" && shopItem.content.heroId) {
          itemData = await Hero.findById(shopItem.content.heroId)
            .select("name element rarity iconUrl");
        }

        // Vérifier si le joueur peut acheter
        const purchaseCheck = await shop.canPlayerPurchase(shopItem.instanceId, playerId);

        // Calculer le prix final avec remise
        const finalPrice = this.calculateFinalPrice(shopItem.cost, shopItem.discountPercent || 0);

        return {
          instanceId: shopItem.instanceId,
          itemId: shopItem.itemId,
          type: shopItem.type,
          name: shopItem.name,
          description: shopItem.description,
          content: shopItem.content,
          cost: shopItem.cost,
          finalPrice,
          rarity: shopItem.rarity,
          discountPercent: shopItem.discountPercent || 0,
          maxStock: shopItem.maxStock,
          currentStock: shopItem.currentStock,
          maxPurchasePerPlayer: shopItem.maxPurchasePerPlayer,
          levelRequirement: shopItem.levelRequirement,
          isPromotional: shopItem.isPromotional,
          promotionalText: shopItem.promotionalText,
          isFeatured: shopItem.isFeatured,
          tags: shopItem.tags,
          itemData,
          canPurchase: purchaseCheck.canPurchase,
          purchaseBlockReason: purchaseCheck.reason
        };
      }));

      const now = new Date();
      return {
        success: true,
        shop: {
          shopType: shop.shopType,
          name: shop.name,
          description: shop.description,
          resetFrequency: shop.resetFrequency,
          maxItemsShown: shop.maxItemsShown,
          refreshCost: shop.refreshCost,
          freeRefreshCount: shop.freeRefreshCount,
          items: enrichedItems,
          featuredItems: shop.featuredItems,
          timeUntilReset: shop.nextResetTime ? Math.max(0, shop.nextResetTime.getTime() - now.getTime()) : null,
          canRefresh: !!(shop.refreshCost && (shop.refreshCost.gold || shop.refreshCost.gems))
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getShopDetails:", error);
      throw error;
    }
  }

  // === ACHETER UN OBJET ===
  public static async purchaseItem(
    playerId: string,
    shopType: string,
    instanceId: string,
    quantity: number = 1
  ): Promise<ShopPurchaseResult> {
    try {
      console.log(`💰 Achat ${quantity}x ${instanceId} dans ${shopType} par ${playerId}`);

      const [shop, player] = await Promise.all([
        Shop.findOne({ shopType, isActive: true }),
        Player.findById(playerId)
      ]);

      if (!shop) {
        return { success: false, error: "Shop not found", code: "SHOP_NOT_FOUND" };
      }

      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const shopItem = shop.items.find((item: any) => item.instanceId === instanceId);
      if (!shopItem) {
        return { success: false, error: "Item not found in shop", code: "SHOP_ITEM_NOT_FOUND" };
      }

      // Vérifications d'achat
      const purchaseCheck = await shop.canPlayerPurchase(instanceId, playerId);
      if (!purchaseCheck.canPurchase) {
          try {
                  WebSocketService.notifyShopPurchaseFailure(playerId, {
                    shopType,
                    itemName: shopItem.name,
                    reason: `Cannot purchase item: ${purchaseCheck.reason}`,
                    code: "PURCHASE_NOT_ALLOWED"
                  });
                } catch (error) {
                  console.warn("⚠️ Failed to send purchase failure notification:", error);
                }
        return { 
          success: false, 
          error: `Cannot purchase item: ${purchaseCheck.reason}`, 
          code: "PURCHASE_NOT_ALLOWED" 
        };
      }

      // Calculer le coût total
      const finalCost = this.calculateTotalCost(shopItem.cost, shopItem.discountPercent || 0, quantity);

      // Vérifier les ressources
      const resourceCheck = this.checkPlayerResources(player, finalCost);
      if (!resourceCheck.sufficient) {
        return { 
          success: false, 
          error: `Insufficient resources: ${resourceCheck.missing.join(", ")}`, 
          code: "INSUFFICIENT_RESOURCES" 
        };
      }

      // Effectuer la transaction
      return await this.executePurchaseTransaction(player, shop, shopItem, quantity, finalCost);

    } catch (error: any) {
      console.error("❌ Erreur purchaseItem:", error);
      return { success: false, error: error.message, code: "PURCHASE_FAILED" };
    }
  }

  // === ACTUALISER UNE BOUTIQUE MANUELLEMENT ===
  public static async refreshShop(
    playerId: string,
    shopType: string
  ): Promise<ShopRefreshResult> {
    try {
      console.log(`🔄 Actualisation boutique ${shopType} par ${playerId}`);

      const [shop, player] = await Promise.all([
        Shop.findOne({ shopType, isActive: true }),
        Player.findById(playerId)
      ]);

      if (!shop) {
        return { success: false, error: "Shop not found", code: "SHOP_NOT_FOUND" };
      }

      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      // Vérifier que le shop peut être actualisé
      if (!shop.refreshCost || (!shop.refreshCost.gold && !shop.refreshCost.gems)) {
        return { 
          success: false, 
          error: "This shop cannot be refreshed manually", 
          code: "REFRESH_NOT_ALLOWED" 
        };
      }

      // Vérifier les ressources
      const resourceCheck = this.checkPlayerResources(player, shop.refreshCost);
      if (!resourceCheck.sufficient) {
        return { 
          success: false, 
          error: `Insufficient resources: ${resourceCheck.missing.join(", ")}`, 
          code: "INSUFFICIENT_RESOURCES" 
        };
      }

      // Déduire le coût et actualiser
      this.deductResources(player, shop.refreshCost);
      await shop.refreshShop();
      await player.save();
      try {
        WebSocketService.notifyShopRefreshed(playerId, {
          shopType,
          shopName: shop.name,
          newItemsCount: shop.items.length,
          refreshCost: shop.refreshCost,
          freeRefreshUsed: false, // À implémenter si vous gérez les refresh gratuits
          featuredItems: shop.featuredItems
        });
      } catch (error) {
        console.warn("⚠️ Failed to send shop refresh notification:", error);
      }
      return {
        success: true,
        cost: shop.refreshCost,
        newItemsCount: shop.items.length,
        playerResources: {
          gold: player.gold,
          gems: player.gems,
          paidGems: player.paidGems,
          tickets: player.tickets
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur refreshShop:", error);
      return { success: false, error: error.message, code: "REFRESH_FAILED" };
    }
  }

  // === OBTENIR L'HISTORIQUE D'ACHAT ===
  public static async getPurchaseHistory(
    playerId: string,
    shopType: string,
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const shop = await Shop.findOne({ shopType, isActive: true });
      if (!shop) {
        throw new Error("Shop not found");
      }

      // Récupérer l'historique via la méthode du modèle
      const playerHistory = shop.getPlayerPurchaseHistory(playerId);

      // Paginer
      const skip = (page - 1) * limit;
      const paginatedHistory = playerHistory.slice(skip, skip + limit);

      return {
        success: true,
        shopType,
        history: paginatedHistory,
        pagination: {
          page,
          limit,
          total: playerHistory.length,
          pages: Math.ceil(playerHistory.length / limit)
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getPurchaseHistory:", error);
      throw error;
    }
  }

  // === PROCESSUS AUTOMATIQUE DE RESET DES BOUTIQUES ===
  public static async processShopResets() {
    try {
      console.log("⏰ Vérification des boutiques à renouveler...");

      const shopsToReset = await (Shop as any).getShopsToReset();
      const resetResults = [];

      for (const shop of shopsToReset) {
        const oldItemCount = shop.items.length;
        await shop.refreshShop();
        
        resetResults.push({
          shopType: shop.shopType,
          name: shop.name,
          oldItemsCount: oldItemCount,
          newItemsCount: shop.items.length,
          resetTime: new Date()
        });

        console.log(`🔄 Boutique ${shop.shopType} renouvelée: ${shop.items.length} nouveaux objets`);
      }

      if (resetResults.length > 0) {
        console.log(`✅ ${resetResults.length} boutiques renouvelées automatiquement`);
      }

      return {
        success: true,
        resetShops: resetResults,
        totalReset: resetResults.length
      };

    } catch (error: any) {
      console.error("❌ Erreur processShopResets:", error);
      throw error;
    }
  }

  // === CRÉER DES BOUTIQUES PRÉDÉFINIES ===
  public static async createPredefinedShops() {
    try {
      console.log("🏗️ Création des boutiques prédéfinies...");

      const shopTypes = ["Daily", "Weekly", "Monthly", "Arena", "Clan", "VIP", "Premium"];
      const createdShops = [];

      for (const shopType of shopTypes) {
        const existingShop = await Shop.findOne({ shopType });
        if (!existingShop) {
          const newShop = (Shop as any).createPredefinedShop(shopType);
          await newShop.generateItemsForShopType();
          await newShop.save();
          createdShops.push(shopType);
          
          console.log(`✅ Boutique ${shopType} créée avec ${newShop.items.length} objets`);
        }
      }

      return {
        success: true,
        message: `Created ${createdShops.length} predefined shops`,
        createdShops
      };

    } catch (error: any) {
      console.error("❌ Erreur createPredefinedShops:", error);
      throw error;
    }
  }

  // === MÉTHODES PRIVÉES UTILITAIRES ===

  // Calculer le prix final avec remise
  private static calculateFinalPrice(cost: Record<string, number>, discountPercent: number): Record<string, number> {
    if (discountPercent <= 0) return cost;

    const finalPrice: Record<string, number> = {};
    Object.entries(cost).forEach(([currency, amount]) => {
      if (amount > 0) {
        finalPrice[currency] = Math.floor(amount * (100 - discountPercent) / 100);
      }
    });
    return finalPrice;
  }

  // Calculer le coût total d'un achat
  private static calculateTotalCost(
    cost: Record<string, number>, 
    discountPercent: number, 
    quantity: number
  ): Record<string, number> {
    const finalCost: Record<string, number> = {};
    Object.entries(cost).forEach(([currency, amount]) => {
      if (amount > 0) {
        let totalAmount = amount * quantity;
        if (discountPercent > 0) {
          totalAmount = Math.floor(totalAmount * (100 - discountPercent) / 100);
        }
        finalCost[currency] = totalAmount;
      }
    });
    return finalCost;
  }

  // Vérifier les ressources du joueur
  private static checkPlayerResources(
    player: any, 
    cost: Record<string, number>
  ): { sufficient: boolean; missing: string[] } {
    const missing: string[] = [];
    
    if (cost.gold && player.gold < cost.gold) missing.push("gold");
    if (cost.gems && player.gems < cost.gems) missing.push("gems");
    if (cost.paidGems && player.paidGems < cost.paidGems) missing.push("paidGems");
    if (cost.tickets && player.tickets < cost.tickets) missing.push("tickets");

    return {
      sufficient: missing.length === 0,
      missing
    };
  }

  // Déduire les ressources
  private static deductResources(player: any, cost: Record<string, number>) {
    if (cost.gold) player.gold -= cost.gold;
    if (cost.gems) player.gems -= cost.gems;
    if (cost.paidGems) player.paidGems -= cost.paidGems;
    if (cost.tickets) player.tickets -= cost.tickets;
  }

  // Exécuter la transaction d'achat
  private static async executePurchaseTransaction(
    player: any,
    shop: any,
    shopItem: any,
    quantity: number,
    finalCost: Record<string, number>
  ): Promise<ShopPurchaseResult> {
    
    try {
      // Déduire les ressources
      this.deductResources(player, finalCost);

      // Traiter les récompenses
      const rewards = await this.processItemRewards(player, shopItem, quantity);

      // Mettre à jour le stock et l'historique
      if (shopItem.maxStock !== -1) {
        shopItem.currentStock -= quantity;
      }
      
      shopItem.purchaseHistory.push({
        playerId: player._id.toString(),
        quantity,
        purchaseDate: new Date()
      });

      // Sauvegarder
      const inventory = await Inventory.findOne({ playerId: player._id }) || 
                      new Inventory({ playerId: player._id });
      
      await Promise.all([
        player.save(),
        inventory.save(),
        shop.save()
      ]);
      try {
        WebSocketService.notifyShopPurchaseSuccess(player._id.toString(), {
          shopType: shop.shopType,
          itemName: shopItem.name,
          quantity,
          cost: finalCost,
          rewards,
          remainingStock: shopItem.currentStock,
          playerResources: {
            gold: player.gold,
            gems: player.gems,
            paidGems: player.paidGems,
            tickets: player.tickets
          }
        });
      } catch (error) {
        console.warn("⚠️ Failed to send purchase success notification:", error);
      }
      // Mettre à jour les missions et événements
      await this.updateProgressTracking(player._id.toString(), shopItem, quantity);

      return {
        success: true,
        purchase: {
          itemName: shopItem.name,
          quantity,
          cost: finalCost,
          rewards
        },
        playerResources: {
          gold: player.gold,
          gems: player.gems,
          paidGems: player.paidGems,
          tickets: player.tickets
        }
      };

    } catch (error: any) {
      console.error("❌ Transaction échouée:", error);
      return { success: false, error: "Transaction failed", code: "TRANSACTION_FAILED" };
    }
  }

  // Traiter les récompenses d'un objet
  private static async processItemRewards(player: any, shopItem: any, quantity: number): Promise<any[]> {
    const rewards: any[] = [];
    let inventory = await Inventory.findOne({ playerId: player._id });
    
    if (!inventory) {
      inventory = new Inventory({ playerId: player._id });
    }

    switch (shopItem.type) {
      case "Item":
        if (shopItem.content.itemId) {
          const ownedItem = await inventory.addItem(
            shopItem.content.itemId,
            shopItem.content.quantity * quantity,
            shopItem.content.level || 1
          );
          rewards.push({
            type: "Item",
            itemId: shopItem.content.itemId,
            quantity: shopItem.content.quantity * quantity,
            instanceId: ownedItem.instanceId
          });
        }
        break;

      case "Currency":
        const currencyAmount = shopItem.content.quantity * quantity;
        switch (shopItem.content.currencyType) {
          case "gold": player.gold += currencyAmount; break;
          case "gems": player.gems += currencyAmount; break;
          case "paidGems": player.paidGems += currencyAmount; break;
          case "tickets": player.tickets += currencyAmount; break;
        }
        rewards.push({
          type: "Currency",
          currencyType: shopItem.content.currencyType,
          quantity: currencyAmount
        });
        break;

      case "Fragment":
        if (shopItem.content.heroId) {
          const currentFragments = player.fragments.get(shopItem.content.heroId) || 0;
          player.fragments.set(
            shopItem.content.heroId, 
            currentFragments + (shopItem.content.quantity * quantity)
          );
          rewards.push({
            type: "Fragment",
            heroId: shopItem.content.heroId,
            quantity: shopItem.content.quantity * quantity
          });
        }
        break;

      case "Hero":
        if (shopItem.content.heroId) {
          const existingHero = player.heroes.find((h: any) => h.heroId === shopItem.content.heroId);
          if (!existingHero) {
            player.heroes.push({
              heroId: shopItem.content.heroId,
              level: shopItem.content.level || 1,
              stars: 1,
              equipped: false
            });
            rewards.push({
              type: "Hero",
              heroId: shopItem.content.heroId,
              quantity: 1
            });
          } else {
            // Convertir en fragments si déjà possédé
            const fragments = 50;
            const currentFragments = player.fragments.get(shopItem.content.heroId) || 0;
            player.fragments.set(shopItem.content.heroId, currentFragments + fragments);
            rewards.push({
              type: "Fragment",
              heroId: shopItem.content.heroId,
              quantity: fragments
            });
          }
        }
        break;
    }

    return rewards;
  }

  // Mettre à jour les missions et événements
  private static async updateProgressTracking(
    playerId: string, 
    shopItem: any, 
    quantity: number
  ) {
    try {
      const totalValue = Object.values(shopItem.cost as Record<string, number>)
        .reduce((sum, value) => sum + value, 0);

      await Promise.all([
        MissionService.updateProgress(
          playerId,
          "", // serverId sera ajouté plus tard
          "gold_spent",
          totalValue
        ),
        EventService.updatePlayerProgress(
          playerId,
          "", // serverId sera ajouté plus tard
          "gold_spent",
          totalValue,
          {
            shopType: shopItem.type,
            itemRarity: shopItem.rarity
          }
        )
      ]);

      console.log(`📊 Progression missions/événements mise à jour: ${totalValue} dépensé`);
    } catch (error) {
      console.error("⚠️ Erreur mise à jour progression boutique:", error);
    }
  }

  // === MÉTHODES D'ADMINISTRATION ===

  // Obtenir les statistiques des boutiques
  public static async getShopStats(serverId?: string) {
    try {
      const stats = await Shop.aggregate([
        { $match: { isActive: true } },
        { $group: {
          _id: "$shopType",
          totalShops: { $sum: 1 },
          avgItems: { $avg: { $size: "$items" } },
          totalItems: { $sum: { $size: "$items" } },
          featuredItems: { $sum: { $size: "$featuredItems" } }
        }},
        { $sort: { _id: 1 } }
      ]);

      return {
        success: true,
        serverId: serverId || "ALL",
        stats: stats.map(stat => ({
          shopType: stat._id,
          totalShops: stat.totalShops,
          avgItems: Math.round(stat.avgItems),
          totalItems: stat.totalItems,
          featuredItems: stat.featuredItems
        }))
      };

    } catch (error: any) {
      console.error("❌ Erreur getShopStats:", error);
      throw error;
    }
  }
}

import Shop from "../models/Shop";
import Player from "../models/Player";
import Inventory from "../models/Inventory";
import Item from "../models/Item";
import Hero from "../models/Hero";
import ItemGenerator from "../utils/ItemGenerator";
import { IdGenerator } from "../utils/idGenerator";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { WebSocketService } from "./WebSocketService"; 
import { resetDailyShop, resetWeeklyShop, resetMonthlyShop } from "../scripts/generateShops";

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
      elementalTicketType?: string; // ✅ NOUVEAU
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

export interface ShopResetResult {
  success: boolean;
  resetShops: Array<{
    shopType: string;
    name: string;
    oldItemsCount: number;
    newItemsCount: number;
    resetTime: Date;
  }>;
  totalReset: number;
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

      const shops = await (Shop as any).getActiveShopsForPlayer(playerId);

      const filteredShops = shopType ? 
        shops.filter((shop: any) => shop.shopType === shopType) : 
        shops;

      const skip = (page - 1) * limit;
      const paginatedShops = filteredShops.slice(skip, skip + limit);

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

      const canAccess = await shop.canPlayerAccess(playerId);
      if (!canAccess) {
        throw new Error("Access denied to this shop");
      }
      
      if (!shop.isAvailableToday()) {
        throw new Error("This shop is not available today");
      }
      
      const enrichedItems = await Promise.all(shop.items.map(async (shopItem: any) => {
        let itemData = null;
        let generatedStats = null;
        
        if (shopItem.type === "Item" && shopItem.itemId) {
          itemData = await Item.findOne({ itemId: shopItem.itemId })
            .select("name description iconUrl rarity category sellPrice baseStats equipmentSlot");
          
          if (itemData && shopItem.content.level && shopItem.content.enhancement !== undefined) {
            try {
              const preview = await ItemGenerator.previewGeneration(shopItem.itemId, {
                level: shopItem.content.level,
                enhancementLevel: shopItem.content.enhancement,
                tier: shopItem.content.tier || 1,
                factionAlignment: shopItem.factionAlignment,
                seed: `shop_${shopItem.instanceId}`
              });
              generatedStats = preview.stats;
            } catch (error) {
              console.warn(`⚠️ Impossible de générer preview pour ${shopItem.itemId}:`, error);
            }
          }
        } else if (shopItem.type === "Fragment" && shopItem.content.heroId) {
          itemData = await Hero.findById(shopItem.content.heroId)
            .select("name element rarity iconUrl");
        }

        const purchaseCheck = await shop.canPlayerPurchase(shopItem.instanceId, playerId);
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
          factionAlignment: shopItem.factionAlignment,
          itemData,
          generatedStats,
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

      if (!shop.isAvailableToday()) {
      const nextFriday = this.getNextFridayDate();
      return { 
        success: false, 
        error: `${shop.name} is only available on Fridays. Next opening: ${nextFriday.toLocaleDateString()}`, 
        code: "SHOP_NOT_AVAILABLE_TODAY" 
          };
        }
      const shopItem = shop.items.find((item: any) => item.instanceId === instanceId);
      if (!shopItem) {
        return { success: false, error: "Item not found in shop", code: "SHOP_ITEM_NOT_FOUND" };
      }

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

      const finalCost = this.calculateTotalCost(shopItem.cost, shopItem.discountPercent || 0, quantity);

      const resourceCheck = this.checkPlayerResources(player, finalCost);
      if (!resourceCheck.sufficient) {
        return { 
          success: false, 
          error: `Insufficient resources: ${resourceCheck.missing.join(", ")}`, 
          code: "INSUFFICIENT_RESOURCES" 
        };
      }

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

      if (!shop.refreshCost || (!shop.refreshCost.gold && !shop.refreshCost.gems)) {
        return { 
          success: false, 
          error: "This shop cannot be refreshed manually", 
          code: "REFRESH_NOT_ALLOWED" 
        };
      }

      const resourceCheck = this.checkPlayerResources(player, shop.refreshCost);
      if (!resourceCheck.sufficient) {
        return { 
          success: false, 
          error: `Insufficient resources: ${resourceCheck.missing.join(", ")}`, 
          code: "INSUFFICIENT_RESOURCES" 
        };
      }

      this.deductResources(player, shop.refreshCost);
      await this.regenerateShopItems(shop);
      await player.save();
      
      try {
        WebSocketService.notifyShopRefreshed(playerId, {
          shopType,
          shopName: shop.name,
          newItemsCount: shop.items.length,
          refreshCost: shop.refreshCost,
          freeRefreshUsed: false,
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

// === PROCESSUS AUTOMATIQUE DE RESET DES BOUTIQUES ===
public static async processShopResets(): Promise<ShopResetResult> {
  try {
    console.log("⏰ Vérification des boutiques à renouveler...");

    const shopsToReset = await (Shop as any).getShopsToReset();
    const resetResults = [];

    for (const shop of shopsToReset) {
      const oldItemCount = shop.items.length;
      
      try {
        switch (shop.shopType) {
          case "Daily":
            await this.resetShopWithGenerator(shop, "Daily");
            break;
          case "Weekly":
            await this.resetShopWithGenerator(shop, "Weekly");
            break;
          case "Monthly":
            await this.resetShopWithGenerator(shop, "Monthly");
            break;
          case "ElementalFriday": // ✅ NOUVEAU
            await shop.refreshShop(); // Utilise generateElementalFridayItems() du modèle
            break;
          default:
            await shop.refreshShop();
            break;
        }
      } catch (error) {
        console.error(`❌ Erreur reset ${shop.shopType}:`, error);
        await shop.refreshShop();
      }
      
      resetResults.push({
        shopType: shop.shopType,
        name: shop.name,
        oldItemsCount: oldItemCount,
        newItemsCount: shop.items.length,
        resetTime: new Date()
      });

      console.log(`🔄 Boutique ${shop.shopType} renouvelée: ${shop.items.length} nouveaux objets`);
      
      // ✅ NOTIFICATION WEBSOCKET GLOBALE
      try {
        WebSocketService.notifyGlobalShopReset({
          shopType: shop.shopType,
          shopName: shop.name,
          newItemsCount: shop.items.length,
          resetTime: new Date()
        });
      } catch (error) {
        console.warn("⚠️ Failed to notify shop reset:", error);
      }

      // ✅ NOTIFICATION SPÉCIALE POUR ELEMENTAL FRIDAY (TOUS LES SERVEURS ACTIFS)
      if (shop.shopType === "ElementalFriday") {
        try {
          // ✅ Récupérer dynamiquement tous les serveurs actifs
          const { GameServer } = await import('../models/Server');
          const activeServers = await GameServer.find({ 
            status: { $in: ["online", "maintenance"] } 
          }).select('serverId');
          
          const serverIds = activeServers.map(s => s.serverId);
          
          console.log(`🌍 Envoi notification ElementalFriday à ${serverIds.length} serveur(s): ${serverIds.join(', ')}`);
          
          for (const serverId of serverIds) {
            WebSocketService.broadcastToServer(serverId, 'shop:friday_opened', {
              message: "ELEMENTAL_FRIDAY_SHOP_OPENED",
              shopType: "ElementalFriday",
              offers: shop.items.map((item: any) => ({
                name: item.name,
                tickets: item.content.quantity,
                gems: item.cost.gems,
                originalPrice: item.originalPrice,
                discount: item.discountPercent,
                rarity: item.rarity,
                isFeatured: item.isFeatured
              })),
              expiresIn: 24 * 60 * 60 * 1000, // 24h en ms
              nextReset: shop.nextResetTime,
              priority: 'high'
            });
          }
          
          console.log(`✅ Notification boutique ElementalFriday envoyée à tous les serveurs actifs`);
        } catch (wsError) {
          console.warn("⚠️ Failed to notify Friday shop opening:", wsError);
        }
      }
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
  // === RESET D'UN SHOP AVEC ITEMGENERATOR ===
  private static async resetShopWithGenerator(shop: any, shopType: "Daily" | "Weekly" | "Monthly" | "ElementalFriday") {
    console.log(`🎲 Reset ${shopType} shop avec ItemGenerator...`);
    
    shop.items = [];
    
    // ✅ NOUVEAU : Si c'est ElementalFriday, utiliser la méthode du modèle
    if (shopType === "ElementalFriday") {
      await shop.generateElementalFridayItems();
      shop.resetTime = new Date();
      shop.calculateNextResetTime();
      await shop.save();
      return;
    }
    
    const SHOP_CONFIGS = {
      Daily: {
        maxItems: 8,
        rarityWeights: { "Common": 60, "Rare": 35, "Epic": 5 },
        levelRange: [1, 15],
        tierRange: [1, 2],
        enhancementRange: [0, 2],
        priceMultiplier: { gold: 1.2, gems: 0.8 }
      },
      Weekly: {
        maxItems: 8,
        rarityWeights: { "Rare": 50, "Epic": 40, "Legendary": 10 },
        levelRange: [10, 30],
        tierRange: [2, 4],
        enhancementRange: [1, 3],
        priceMultiplier: { gems: 1.0, paidGems: 0.9 }
      },
      Monthly: {
        maxItems: 8, 
        rarityWeights: { "Epic": 40, "Legendary": 60 },
        levelRange: [20, 50],
        tierRange: [3, 6],
        enhancementRange: [2, 5],
        priceMultiplier: { gems: 0.7, paidGems: 0.6 }
      },
      ElementalFriday: {
        maxItems: 5,
        skipGeneration: true // ✅ NOUVEAU
      }
    };
    
    const config = SHOP_CONFIGS[shopType];
    
    const equipmentTemplates = await Item.find({ category: "Equipment" });
    
    if (equipmentTemplates.length === 0) {
      console.warn("⚠️ Aucun template d'équipement trouvé");
      return;
    }
    
    for (let i = 0; i < config.maxItems; i++) {
      try {
        const targetRarity = this.weightedRandomRarity(config.rarityWeights);
        const templatesOfRarity = equipmentTemplates.filter(t => t.rarity === targetRarity);
        
        if (templatesOfRarity.length === 0) continue;
        
        const template = templatesOfRarity[this.randomInt(0, templatesOfRarity.length - 1)];
        const level = this.randomInt(config.levelRange[0], config.levelRange[1]);
        const tier = this.randomInt(config.tierRange[0], config.tierRange[1]);
        const enhancementLevel = this.randomInt(config.enhancementRange[0], config.enhancementRange[1]);
        
        const generatedItem = await ItemGenerator.generateItemInstance(template.itemId, {
          level,
          tier,
          enhancementLevel,
          randomStatCount: this.randomInt(1, 3),
          factionAlignment: Math.random() < 0.3 ? ["Fire", "Water", "Wind", "Electric", "Light", "Dark"][this.randomInt(0, 5)] : undefined,
          seed: `${shopType}_reset_${Date.now()}_${i}`
        });
        
        const itemPrice = this.calculateItemPrice(template, generatedItem, config.priceMultiplier);
        
        const shopItem = {
          itemId: template.itemId,
          instanceId: IdGenerator.generateCompactUUID(),
          type: "Item" as const,
          name: `${template.name} +${enhancementLevel} (Lv.${level})`,
          description: `${template.description} - Tier ${tier}`,
          content: {
            itemId: generatedItem.itemId,
            quantity: 1,
            level,
            enhancement: enhancementLevel,
            tier
          },
          cost: itemPrice,
          rarity: template.rarity,
          maxStock: this.randomInt(2, 8),
          currentStock: this.randomInt(2, 8),
          maxPurchasePerPlayer: this.randomInt(1, 3),
          purchaseHistory: [],
          levelRequirement: Math.max(1, level - 5),
          isPromotional: Math.random() < 0.2,
          isFeatured: Math.random() < 0.1,
          weight: 50,
          tags: [shopType.toLowerCase(), `tier_${tier}`, `enhancement_${enhancementLevel}`],
          factionAlignment: generatedItem.factionAlignment
        };
        
        shop.addItem(shopItem);
        
      } catch (error) {
        console.error(`❌ Erreur génération objet ${i}:`, error);
      }
    }
    
    shop.resetTime = new Date();
    shop.calculateNextResetTime();
    await shop.save();
  }

  // === RÉGÉNÉRER LES OBJETS D'UN SHOP (REFRESH MANUEL) ===
  private static async regenerateShopItems(shop: any) {
    console.log(`🔄 Régénération objets pour ${shop.shopType}...`);
    
    if (["Daily", "Weekly", "Monthly", "ElementalFriday"].includes(shop.shopType)) {
      await this.resetShopWithGenerator(shop, shop.shopType as "Daily" | "Weekly" | "Monthly" | "ElementalFriday");
    } else {
      await shop.refreshShop();
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

      const playerHistory = shop.getPlayerPurchaseHistory(playerId);
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

  // === CRÉER DES BOUTIQUES PRÉDÉFINIES ===
  public static async createPredefinedShops() {
    try {
      console.log("🏗️ Création des boutiques prédéfinies...");

      const shopTypes = ["Daily", "Weekly", "Monthly", "ElementalFriday"] as const; // ✅ MODIFIÉ
      const createdShops = [];

      for (const shopType of shopTypes) {
        const existingShop = await Shop.findOne({ shopType });
        if (!existingShop) {
          const newShop = (Shop as any).createPredefinedShop(shopType);
          await this.resetShopWithGenerator(newShop, shopType);
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

  private static calculateItemPrice(
    templateItem: any, 
    generatedItem: any, 
    multipliers: Record<string, number>
  ): Record<string, number> {
    const baseCost = templateItem.sellPrice || 100;
    const powerMultiplier = 1 + (generatedItem.generatedStats.powerScore / 1000) * 0.1;
    
    const rarityMultipliers: Record<string, number> = { "Common": 1, "Rare": 2, "Epic": 4, "Legendary": 8 };
    const rarityMultiplier = rarityMultipliers[templateItem.rarity] || 1;
    
    const finalCost = Math.round(baseCost * powerMultiplier * rarityMultiplier);
    const prices: Record<string, number> = {};
    
    if (templateItem.rarity === "Common") {
      prices.gold = Math.round(finalCost * (multipliers.gold || 1));
    } else if (templateItem.rarity === "Rare") {
      if (Math.random() < 0.7) {
        prices.gold = Math.round(finalCost * 1.5 * (multipliers.gold || 1));
      } else {
        prices.gems = Math.round(finalCost * 0.3 * (multipliers.gems || 1));
      }
    } else if (templateItem.rarity === "Epic") {
      if (Math.random() < 0.3) {
        prices.gold = Math.round(finalCost * 2 * (multipliers.gold || 1));
      } else {
        prices.gems = Math.round(finalCost * 0.5 * (multipliers.gems || 1));
      }
    } else {
      if (Math.random() < 0.8) {
        prices.gems = Math.round(finalCost * 0.8 * (multipliers.gems || 1));
      } else {
        prices.paidGems = Math.round(finalCost * 0.1 * (multipliers.paidGems || 1));
      }
    }
    
    return prices;
  }

  private static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private static weightedRandomRarity(weights: Record<string, number>): string {
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const [rarity, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) return rarity;
    }
    
    return Object.keys(weights)[0];
  }

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

  private static deductResources(player: any, cost: Record<string, number>) {
    if (cost.gold) player.gold -= cost.gold;
    if (cost.gems) player.gems -= cost.gems;
    if (cost.paidGems) player.paidGems -= cost.paidGems;
    if (cost.tickets) player.tickets -= cost.tickets;
  }

  private static async executePurchaseTransaction(
    player: any,
    shop: any,
    shopItem: any,
    quantity: number,
    finalCost: Record<string, number>
  ): Promise<ShopPurchaseResult> {
    
    try {
      this.deductResources(player, finalCost);

      const rewards = await this.processItemRewards(player, shopItem, quantity);

      if (shopItem.maxStock !== -1) {
        shopItem.currentStock -= quantity;
      }
      
      shopItem.purchaseHistory.push({
        playerId: player._id.toString(),
        quantity,
        purchaseDate: new Date()
      });

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

  // === TRAITER LES RÉCOMPENSES D'UN OBJET AVEC ITEMGENERATOR ===
  private static async processItemRewards(player: any, shopItem: any, quantity: number): Promise<any[]> {
    const rewards: any[] = [];
    let inventory = await Inventory.findOne({ playerId: player._id });
    
    if (!inventory) {
      inventory = new Inventory({ playerId: player._id });
    }

    switch (shopItem.type) {
      case "Item":
        if (shopItem.content.itemId) {
          try {
            const generatedItem = await ItemGenerator.generateItemInstance(shopItem.itemId, {
              level: shopItem.content.level || 1,
              tier: shopItem.content.tier || 1,
              enhancementLevel: shopItem.content.enhancement || 0,
              factionAlignment: shopItem.factionAlignment,
              seed: `purchase_${shopItem.instanceId}_${Date.now()}`
            });
            
            const ownedItem = await inventory.addItem(
              generatedItem.itemId,
              shopItem.content.quantity * quantity,
              generatedItem.level
            );
            
            rewards.push({
              type: "Item",
              itemId: shopItem.itemId,
              generatedItemId: generatedItem.itemId,
              quantity: shopItem.content.quantity * quantity,
              instanceId: ownedItem.instanceId,
              level: generatedItem.level,
              enhancement: generatedItem.enhancementLevel,
              tier: generatedItem.tier,
              factionAlignment: generatedItem.factionAlignment,
              powerScore: generatedItem.generatedStats.powerScore,
              finalStats: generatedItem.generatedStats.finalStats
            });
            
          } catch (error) {
            console.error("❌ Erreur génération objet achat:", error);
            const ownedItem = await inventory.addItem(
              shopItem.itemId,
              shopItem.content.quantity * quantity,
              shopItem.content.level || 1
            );
            
            rewards.push({
              type: "Item",
              itemId: shopItem.itemId,
              quantity: shopItem.content.quantity * quantity,
              instanceId: ownedItem.instanceId
            });
          }
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

      case "ElementalTicket":
        // ✅ NOUVEAU : Gérer l'achat de tickets élémentaires
        if (shopItem.content.elementalTicketType) {
          const element = shopItem.content.elementalTicketType; // "fire", "water", etc.
          const ticketQuantity = shopItem.content.quantity * quantity;
          
          // Ajouter les tickets au joueur
          await player.addElementalTicket(element, ticketQuantity);
          
          rewards.push({
            type: "ElementalTicket",
            elementalTicketType: element,
            quantity: ticketQuantity
          });
          
          console.log(`🎟️ Added ${ticketQuantity}x ${element} tickets to player ${player._id}`);
        }
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

      case "Bundle":
        if (shopItem.content.bundleItems) {
          for (const bundleItem of shopItem.content.bundleItems) {
            const bundleReward = await this.processItemRewards(player, {
              type: bundleItem.type,
              content: bundleItem,
              itemId: bundleItem.itemId
            }, quantity);
            rewards.push(...bundleReward);
          }
        }
        break;
    }

    return rewards;
  }

  // === METTRE À JOUR LES MISSIONS ET ÉVÉNEMENTS ===
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
          "",
          "gold_spent",
          totalValue
        ),
        EventService.updatePlayerProgress(
          playerId,
          "",
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

  public static async forceShopReset(shopType: string): Promise<ShopResetResult> {
    try {
      console.log(`🔧 Reset forcé du shop ${shopType}...`);
      
      const shop = await Shop.findOne({ shopType, isActive: true });
      if (!shop) {
        throw new Error(`Shop ${shopType} not found`);
      }

      const oldItemCount = shop.items.length;
      
      if (["Daily", "Weekly", "Monthly", "ElementalFriday"].includes(shopType)) {
        await this.resetShopWithGenerator(shop, shopType as "Daily" | "Weekly" | "Monthly" | "ElementalFriday");
      } else {
        await shop.refreshShop();
      }

      const result: ShopResetResult = {
        success: true,
        resetShops: [{
          shopType: shop.shopType,
          name: shop.name,
          oldItemsCount: oldItemCount,
          newItemsCount: shop.items.length,
          resetTime: new Date()
        }],
        totalReset: 1
      };

      console.log(`✅ Shop ${shopType} reset forcé terminé`);
      return result;

    } catch (error: any) {
      console.error(`❌ Erreur reset forcé ${shopType}:`, error);
      throw error;
    }
  }

  public static async previewShopItem(shopType: string, instanceId: string) {
    try {
      const shop = await Shop.findOne({ shopType, isActive: true });
      if (!shop) {
        throw new Error("Shop not found");
      }

      const shopItem = shop.items.find((item: any) => item.instanceId === instanceId);
      if (!shopItem) {
        throw new Error("Shop item not found");
      }

      if (shopItem.type !== "Item" || !shopItem.content.level) {
        return { success: true, preview: null, message: "No preview available for this item type" };
      }

      const preview = await ItemGenerator.previewGeneration(shopItem.itemId, {
        level: shopItem.content.level,
        tier: (shopItem as any).extendedContent?.tier || 1,
        enhancementLevel: shopItem.content.enhancement || 0,
        factionAlignment: (shopItem as any).extendedContent?.factionAlignment,
        seed: `preview_${instanceId}`
      });

      return {
        success: true,
        preview: {
          itemId: shopItem.itemId,
          name: shopItem.name,
          finalStats: preview.stats.finalStats,
          powerScore: preview.stats.powerScore,
          powerRange: preview.powerRange,
          multipliers: preview.stats.multipliers,
          randomStats: preview.stats.randomStats
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur preview shop item:", error);
      throw error;
    }
  }
  // === MÉTHODE UTILITAIRE : Calculer le prochain vendredi ===
  private static getNextFridayDate(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    
    // Si on est vendredi (5), le prochain vendredi est dans 7 jours
    // Sinon, calculer les jours jusqu'au prochain vendredi
    const daysUntilFriday = dayOfWeek === 5 ? 7 : (5 - dayOfWeek + 7) % 7;
    
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + daysUntilFriday);
    nextFriday.setHours(0, 0, 0, 0);
    
    return nextFriday;
  }
}
}

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

      // Enrichir les objets avec les données complètes + données générées
      const enrichedItems = await Promise.all(shop.items.map(async (shopItem: any) => {
        let itemData = null;
        let generatedStats = null;
        
        // Récupérer les données de l'objet template
        if (shopItem.type === "Item" && shopItem.itemId) {
          itemData = await Item.findOne({ itemId: shopItem.itemId })
            .select("name description iconUrl rarity category sellPrice baseStats equipmentSlot");
          
          // Si l'objet a des niveaux/améliorations, calculer les stats générées
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
          factionAlignment: shopItem.factionAlignment,
          itemData,
          generatedStats, // Stats calculées par ItemGenerator
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

      // Déduire le coût et actualiser avec ItemGenerator
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
        
        // Utiliser le script generateShops selon le type
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
            default:
              // Pour les autres shops, utiliser la méthode standard
              await shop.refreshShop();
              break;
          }
        } catch (error) {
          console.error(`❌ Erreur reset ${shop.shopType}:`, error);
          // Fallback vers méthode standard
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
        
        // Notifier tous les joueurs connectés du reset
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
  private static async resetShopWithGenerator(shop: any, shopType: "Daily" | "Weekly" | "Monthly") {
    console.log(`🎲 Reset ${shopType} shop avec ItemGenerator...`);
    
    // Vider les anciens objets
    shop.items = [];
    
    // Utiliser la logique du script generateShops
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
      }
    };
    
    const config = SHOP_CONFIGS[shopType];
    const equipmentTemplates = await Item.find({ category: "Equipment" });
    
    if (equipmentTemplates.length === 0) {
      console.warn("⚠️ Aucun template d'équipement trouvé");
      return;
    }
    
    // Générer les nouveaux objets
    for (let i = 0; i < config.maxItems; i++) {
      try {
        // Choisir la rareté selon les poids
        const targetRarity = this.weightedRandomRarity(config.rarityWeights);
        const templatesOfRarity = equipmentTemplates.filter(t => t.rarity === targetRarity);
        
        if (templatesOfRarity.length === 0) continue;
        
        const template = templatesOfRarity[this.randomInt(0, templatesOfRarity.length - 1)];
        const level = this.randomInt(config.levelRange[0], config.levelRange[1]);
        const tier = this.randomInt(config.tierRange[0], config.tierRange[1]);
        const enhancementLevel = this.randomInt(config.enhancementRange[0], config.enhancementRange[1]);
        
        // Générer l'objet avec ItemGenerator
        const generatedItem = await ItemGenerator.generateItemInstance(template.itemId, {
          level,
          tier,
          enhancementLevel,
          randomStatCount: this.randomInt(1, 3),
          factionAlignment: Math.random() < 0.3 ? ["Fire", "Water", "Wind", "Electric", "Light", "Dark"][this.randomInt(0, 5)] : undefined,
          seed: `${shopType}_reset_${Date.now()}_${i}`
        });
        
        // Calculer le prix
        const itemPrice = this.calculateItemPrice(template, generatedItem, config.priceMultiplier);
        
        // Créer l'objet shop
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
    
    // Mettre à jour les timestamps
    shop.resetTime = new Date();
    shop.calculateNextResetTime();
    await shop.save();
  }

  // === RÉGÉNÉRER LES OBJETS D'UN SHOP (REFRESH MANUEL) ===
  private static async regenerateShopItems(shop: any) {
    console.log(`🔄 Régénération objets pour ${shop.shopType}...`);
    
    if (["Daily", "Weekly", "Monthly"].includes(shop.shopType)) {
      await this.resetShopWithGenerator(shop, shop.shopType as "Daily" | "Weekly" | "Monthly");
    } else {
      // Pour les autres types, utiliser la méthode standard
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

      const shopTypes = ["Daily", "Weekly", "Monthly"] as const;
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

  // Calculer le prix d'un objet généré
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
    
    // Distribution des prix selon la rareté
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
    } else { // Legendary
      if (Math.random() < 0.8) {
        prices.gems = Math.round(finalCost * 0.8 * (multipliers.gems || 1));
      } else {
        prices.paidGems = Math.round(finalCost * 0.1 * (multipliers.paidGems || 1));
      }
    }
    
    return prices;
  }

  // Utilitaires pour la génération aléatoire
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

      // Traiter les récompenses (générer l'objet réel pour l'inventaire)
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

  // Traiter les récompenses d'un objet avec ItemGenerator
  private static async processItemRewards(player: any, shopItem: any, quantity: number): Promise<any[]> {
    const rewards: any[] = [];
    let inventory = await Inventory.findOne({ playerId: player._id });
    
    if (!inventory) {
      inventory = new Inventory({ playerId: player._id });
    }

    switch (shopItem.type) {
      case "Item":
        if (shopItem.content.itemId) {
          // Générer l'objet réel avec les stats du shop
          try {
            const generatedItem = await ItemGenerator.generateItemInstance(shopItem.itemId, {
              level: shopItem.content.level || 1,
              tier: shopItem.content.tier || 1,
              enhancementLevel: shopItem.content.enhancement || 0,
              factionAlignment: shopItem.factionAlignment,
              seed: `purchase_${shopItem.instanceId}_${Date.now()}`
            });
            
            // Ajouter l'objet généré à l'inventaire
            const ownedItem = await inventory.addGeneratedItem(
              generatedItem,
              shopItem.content.quantity * quantity
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
            // Fallback vers objet de base
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

      case "Bundle":
        // Traiter chaque élément du bundle
        if (shopItem.content.bundleItems) {
          for (const bundleItem of shopItem.content.bundleItems) {
            // Récursion pour chaque élément du bundle
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

  // Forcer le reset d'un shop spécifique (admin)
  public static async forceShopReset(shopType: string): Promise<ShopResetResult> {
    try {
      console.log(`🔧 Reset forcé du shop ${shopType}...`);
      
      const shop = await Shop.findOne({ shopType, isActive: true });
      if (!shop) {
        throw new Error(`Shop ${shopType} not found`);
      }

      const oldItemCount = shop.items.length;
      
      // Reset avec ItemGenerator selon le type
      if (["Daily", "Weekly", "Monthly"].includes(shopType)) {
        await this.resetShopWithGenerator(shop, shopType as "Daily" | "Weekly" | "Monthly");
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

  // Prévisualiser un objet avant achat (pour l'UI)
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

      // Générer preview avec ItemGenerator
      const preview = await ItemGenerator.previewGeneration(shopItem.itemId, {
        level: shopItem.content.level,
        tier: shopItem.content.tier || 1,
        enhancementLevel: shopItem.content.enhancement || 0,
        factionAlignment: shopItem.factionAlignment,
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
}

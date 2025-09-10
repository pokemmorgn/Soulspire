import mongoose from "mongoose";
import {
  ForgeModuleBase,
  IForgeModuleConfig,
  IForgeOperationResult,
  IForgeResourceCost
} from "./ForgeCore";

/**
 * Module de fusion d'équipements 100% fidèle à AFK Arena
 *
 * Comportements AFK Arena respectés :
 * - 3 équipements identiques (même itemId, même rareté) → rareté supérieure
 * - Conservation du niveau d'enhancement du plus haut
 * - Fusion possible uniquement jusqu'à Mythic (pas d'Ascended via fusion)
 * - Coût progressif selon la rareté cible
 * - Matériaux spécialisés par rareté
 * - Messages localisés
 */

export interface IFusionOptions {
  recipeCount?: number; // Toujours 3 dans AFK Arena
  consumeMaterials?: boolean;
}

export class ForgeFusion extends ForgeModuleBase {
  // Ordre des raretés AFK Arena (fusion s'arrête à Mythic)
  protected rarityOrder = ["Common", "Rare", "Epic", "Legendary", "Mythic"];
  
  // AFK Arena utilise toujours 3 items pour fusion
  protected readonly REQUIRED_ITEMS_COUNT = 3;
  
  // Rareté maximum atteignable par fusion (Ascended nécessite des fragments)
  protected readonly MAX_FUSION_RARITY = "Mythic";

  constructor(playerId: string, config: IForgeModuleConfig) {
    super(playerId, config);
  }

  getModuleName(): string {
    return "fusion";
  }

  /**
   * Retourne la rareté suivante ou null si fusion impossible
   */
  protected getNextRarity(currentRarity: string): string | null {
    const idx = this.rarityOrder.indexOf(currentRarity);
    if (idx < 0 || idx >= this.rarityOrder.length - 1) return null;
    return this.rarityOrder[idx + 1];
  }

  /**
   * Vérifie si une rareté peut être fusionnée
   */
  protected canFuseRarity(rarity: string): boolean {
    return this.rarityOrder.includes(rarity) && rarity !== this.MAX_FUSION_RARITY;
  }

  /**
   * Calcule le coût de fusion style AFK Arena
   */
  async calculateFusionCost(sampleItemInstanceId: string, options?: IFusionOptions): Promise<IForgeResourceCost | null> {
    const validation = await this.validateItem(sampleItemInstanceId, undefined);
    if (!validation.valid || !validation.itemData || !validation.ownedItem) return null;

    const baseItem: any = validation.itemData;
    const currentRarity = baseItem.rarity || "Common";
    const nextRarity = this.getNextRarity(currentRarity);
    
    if (!nextRarity || !this.canFuseRarity(currentRarity)) return null;

    // Coût de base progressif selon AFK Arena
    const baseGold = this.config.baseGoldCost || 5000;
    const baseGems = this.config.baseGemCost || 0;

    // Multiplicateurs AFK Arena style (plus agressifs)
    const rarityMultipliers: { [key: string]: number } = {
      "Common": 1,      // Common → Rare
      "Rare": 3,        // Rare → Epic  
      "Epic": 8,        // Epic → Legendary
      "Legendary": 20   // Legendary → Mythic
    };

    const multiplier = rarityMultipliers[currentRarity] || 1;
    const gold = Math.floor(baseGold * multiplier);
    const gems = Math.floor(baseGems * multiplier);

    // Matériaux spécialisés par rareté cible
    const materials = this.getFusionMaterials(nextRarity);
    const finalMaterials = options?.consumeMaterials === false ? {} : materials;

    return { gold, gems, materials: finalMaterials };
  }

  /**
   * Matériaux de fusion spécialisés par rareté cible (style AFK Arena)
   */
  protected getFusionMaterials(targetRarity: string): { [materialId: string]: number } {
    const materials: { [materialId: string]: number } = {};

    // Matériaux de base toujours requis
    materials["fusion_stone"] = 5;

    switch (targetRarity) {
      case "Rare":
        materials["silver_dust"] = 10;
        break;
      case "Epic":
        materials["gold_dust"] = 5;
        materials["magic_essence"] = 2;
        break;
      case "Legendary":
        materials["platinum_dust"] = 3;
        materials["legendary_essence"] = 1;
        break;
      case "Mythic":
        materials["mythic_dust"] = 2;
        materials["celestial_fragment"] = 1;
        break;
    }

    return materials;
  }

  /**
   * Détermine le niveau d'enhancement conservé (le plus haut des 3 items)
   */
  protected getConservedEnhancement(ownedItems: Array<{ base: any; owned: any }>): number {
    return Math.max(...ownedItems.map(item => item.owned.enhancement || 0));
  }

  /**
   * Détermine le niveau conservé (moyenne arrondie vers le haut)
   */
  protected getConservedLevel(ownedItems: Array<{ base: any; owned: any }>): number {
    const avgLevel = ownedItems.reduce((sum, item) => sum + (item.owned.level || 1), 0) / ownedItems.length;
    return Math.ceil(avgLevel); // Arrondi vers le haut comme AFK Arena
  }

  /**
   * Tentative de fusion AFK Arena style
   */
  async attemptFusion(itemInstanceIds: string[], options?: IFusionOptions): Promise<IForgeOperationResult> {
    if (!this.isEnabled()) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "FUSION_MODULE_DISABLED", data: null };
    }

    // Validation du nombre d'items (toujours 3 dans AFK Arena)
    if (!Array.isArray(itemInstanceIds) || itemInstanceIds.length !== this.REQUIRED_ITEMS_COUNT) {
      return { 
        success: false, 
        cost: { gold: 0, gems: 0 }, 
        message: "FUSION_REQUIRES_EXACTLY_THREE_ITEMS", 
        data: { required: this.REQUIRED_ITEMS_COUNT, provided: itemInstanceIds?.length || 0 }
      };
    }

    // Validation des items
    const ownedItems: Array<{ base: any; owned: any }> = [];
    for (const iid of itemInstanceIds) {
      const validation = await this.validateItem(iid, undefined);
      if (!validation.valid || !validation.itemData || !validation.ownedItem) {
        return { 
          success: false, 
          cost: { gold: 0, gems: 0 }, 
          message: "INVALID_ITEM_FOR_FUSION", 
          data: { itemInstanceId: iid, reason: validation.reason }
        };
      }
      ownedItems.push({ base: validation.itemData, owned: validation.ownedItem });
    }

    // Vérifications AFK Arena : même itemId, même catégorie, même rareté
    const firstBase = ownedItems[0].base;
    const firstOwned = ownedItems[0].owned;
    
    const sameItemId = ownedItems.every(x => x.base.itemId === firstBase.itemId);
    const sameCategory = ownedItems.every(x => x.base.category === firstBase.category);
    const sameRarity = ownedItems.every(x => (x.base.rarity || "Common") === (firstBase.rarity || "Common"));

    if (!sameItemId || !sameCategory || !sameRarity) {
      return { 
        success: false, 
        cost: { gold: 0, gems: 0 }, 
        message: "FUSION_ITEMS_MUST_BE_IDENTICAL", 
        data: null 
      };
    }

    // Vérifier que c'est de l'équipement
    if (firstBase.category !== "Equipment") {
      return { 
        success: false, 
        cost: { gold: 0, gems: 0 }, 
        message: "ONLY_EQUIPMENT_CAN_BE_FUSED", 
        data: null 
      };
    }

    const currentRarity = firstBase.rarity || "Common";
    const nextRarity = this.getNextRarity(currentRarity);

    if (!nextRarity) {
      return { 
        success: false, 
        cost: { gold: 0, gems: 0 }, 
        message: "ITEM_CANNOT_BE_FUSED_FURTHER", 
        data: { currentRarity, maxFusionRarity: this.MAX_FUSION_RARITY }
      };
    }

    if (!this.canFuseRarity(currentRarity)) {
      return { 
        success: false, 
        cost: { gold: 0, gems: 0 }, 
        message: "RARITY_CANNOT_BE_FUSED", 
        data: { currentRarity, maxFusionRarity: this.MAX_FUSION_RARITY }
      };
    }

    // Calculer coût
    const cost = await this.calculateFusionCost(itemInstanceIds[0], options);
    if (!cost) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "UNABLE_TO_COMPUTE_FUSION_COST", data: null };
    }

    // Vérifier ressources
    const canAfford = await this.validatePlayerResources(cost);
    if (!canAfford) {
      return { success: false, cost, message: "INSUFFICIENT_RESOURCES", data: null };
    }

    // Dépenser ressources
    const spent = await this.spendResources(cost);
    if (!spent) {
      return { success: false, cost, message: "FAILED_TO_SPEND_RESOURCES", data: null };
    }

    // Récupérer l'inventaire
    const inventory = await this.getInventory();
    if (!inventory) {
      await this.logOperation("fusion", itemInstanceIds.join(","), cost, false, { reason: "Inventory not found after spend" });
      await this.updateStats(cost, false);
      return { success: false, cost, message: "INVENTORY_NOT_FOUND_AFTER_SPENDING", data: null };
    }

    // Supprimer les 3 items de base
    try {
      for (const { owned } of ownedItems) {
        const removed = await inventory.removeItem(owned.instanceId, 1);
        if (!removed) {
          throw new Error(`Failed to remove item instance ${owned.instanceId}`);
        }
      }
    } catch (err: any) {
      await this.logOperation("fusion", itemInstanceIds.join(","), cost, false, { reason: "Failed to remove base items", error: err });
      await this.updateStats(cost, false);
      return { success: false, cost, message: "FAILED_TO_REMOVE_BASE_ITEMS", data: { error: err?.message || err } };
    }

    // Créer le nouvel item fusionné
    try {
      // Conserver le meilleur niveau et enhancement
      const conservedLevel = this.getConservedLevel(ownedItems);
      const conservedEnhancement = this.getConservedEnhancement(ownedItems);

      // Rechercher template pour la nouvelle rareté
      const ItemModel = mongoose.model("Item");
      let targetItemTemplate = await ItemModel.findOne({ 
        itemId: firstBase.itemId, 
        rarity: nextRarity 
      });

      // Si pas de template spécifique, utiliser le même itemId
      const targetItemId = targetItemTemplate ? targetItemTemplate.itemId : firstBase.itemId;

      // Construire la nouvelle instance
      const newOwnedItem: any = {
        itemId: targetItemId,
        instanceId: this.generateOperationId(),
        quantity: 1,
        level: conservedLevel,
        enhancement: conservedEnhancement, // Conserver l'enhancement
        isEquipped: false,
        acquiredDate: new Date()
      };

      // Déterminer catégorie de stockage
      let storageCategory: string;
      const slotMap: { [key: string]: string } = {
        "Weapon": "weapons",
        "Helmet": "helmets",
        "Armor": "armors", 
        "Boots": "boots",
        "Gloves": "gloves",
        "Accessory": "accessories"
      };

      storageCategory = slotMap[firstBase.equipmentSlot] || "artifacts";

      if (!Array.isArray(inventory.storage[storageCategory])) {
        storageCategory = "artifacts";
        if (!Array.isArray(inventory.storage[storageCategory])) {
          inventory.storage[storageCategory] = [];
        }
      }

      // Ajouter à l'inventaire
      (inventory.storage as any)[storageCategory].push(newOwnedItem);
      await inventory.save();

      // Calculer les nouvelles stats pour affichage
      const baseStats = (targetItemTemplate?.baseStats) || (firstBase.baseStats || {});
      const statsPerLevel = (targetItemTemplate?.statsPerLevel) || (firstBase.statsPerLevel || {});

      // Multiplicateur de rareté AFK Arena
      const rarityMultipliers: { [key: string]: number } = {
        "Common": 1,
        "Rare": 1.3,
        "Epic": 1.8,
        "Legendary": 2.5,
        "Mythic": 3.5,
        "Ascended": 5.0
      };

      const rarityMultiplier = rarityMultipliers[nextRarity] || 1;

      // Appliquer multiplicateur de rareté aux stats de base
      const recalculatedBaseStats: any = {};
      for (const [k, v] of Object.entries(baseStats)) {
        if (typeof v === "number") {
          recalculatedBaseStats[k] = Math.floor((v as number) * rarityMultiplier);
        } else {
          recalculatedBaseStats[k] = v;
        }
      }

      // Calculer stats finales avec enhancement conservé
      const computedStats = this.calculateItemStatsWithEnhancement(
        recalculatedBaseStats, 
        statsPerLevel, 
        conservedLevel, 
        conservedEnhancement
      );

      // Log & stats
      await this.logOperation("fusion", itemInstanceIds.join(","), cost, true, {
        createdInstanceId: newOwnedItem.instanceId,
        previousRarity: currentRarity,
        newRarity: nextRarity,
        conservedLevel,
        conservedEnhancement,
        consumedItems: itemInstanceIds
      });
      await this.updateStats(cost, true);

      return {
        success: true,
        cost,
        message: "FUSION_SUCCESS",
        data: {
          newInstance: newOwnedItem,
          newInstanceId: newOwnedItem.instanceId,
          previousRarity: currentRarity,
          newRarity: nextRarity,
          conservedLevel,
          conservedEnhancement,
          consumedItems: itemInstanceIds,
          computedStats,
          rarityMultiplier
        }
      };

    } catch (err: any) {
      await this.logOperation("fusion", itemInstanceIds.join(","), cost, false, { reason: "Failed to create fused item", error: err });
      await this.updateStats(cost, false);
      return { success: false, cost, message: "FAILED_TO_CREATE_FUSED_ITEM", data: { error: err?.message || err } };
    }
  }

  /**
   * Obtient les items fusionnables du joueur (par rareté)
   */
  async getFusableItems(rarity?: string): Promise<Array<{ itemId: string; count: number; rarity: string; name: string }>> {
    try {
      const inventory = await this.getInventory();
      if (!inventory) return [];

      const ItemModel = mongoose.model("Item");
      const fusableItems: { [key: string]: { count: number; rarity: string; name: string } } = {};

      // Parcourir équipements
      const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
      
      for (const category of equipmentCategories) {
        const items = inventory.storage[category] || [];
        
        for (const ownedItem of items) {
          const baseItem = await ItemModel.findOne({ itemId: ownedItem.itemId });
          if (!baseItem) continue;

          const itemRarity = baseItem.rarity || "Common";
          
          // Filtrer par rareté si spécifiée
          if (rarity && itemRarity !== rarity) continue;
          
          // Vérifier si peut être fusionné
          if (!this.canFuseRarity(itemRarity)) continue;

          const key = `${ownedItem.itemId}_${itemRarity}`;
          
          if (!fusableItems[key]) {
            fusableItems[key] = {
              count: 0,
              rarity: itemRarity,
              name: baseItem.name
            };
          }
          
          fusableItems[key].count++;
        }
      }

      // Retourner seulement les items avec au moins 3 exemplaires
      return Object.entries(fusableItems)
        .filter(([_, data]) => data.count >= this.REQUIRED_ITEMS_COUNT)
        .map(([key, data]) => ({
          itemId: key.split('_')[0],
          count: data.count,
          rarity: data.rarity,
          name: data.name
        }))
        .sort((a, b) => {
          // Trier par rareté puis par nom
          const rarityOrder = this.rarityOrder.indexOf(a.rarity) - this.rarityOrder.indexOf(b.rarity);
          return rarityOrder !== 0 ? rarityOrder : a.name.localeCompare(b.name);
        });

    } catch (error) {
      return [];
    }
  }

  /**
   * Obtient le nombre de fusions possibles pour un item donné
   */
  async getPossibleFusionsCount(itemId: string, rarity: string): Promise<number> {
    try {
      const inventory = await this.getInventory();
      if (!inventory) return 0;

      let count = 0;
      const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
      
      for (const category of equipmentCategories) {
        const items = inventory.storage[category] || [];
        count += items.filter((item: any) => item.itemId === itemId).length;
      }

      return Math.floor(count / this.REQUIRED_ITEMS_COUNT);
    } catch (error) {
      return 0;
    }
  }
}

export default ForgeFusion;

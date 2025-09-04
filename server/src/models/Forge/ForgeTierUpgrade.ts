import mongoose from "mongoose";
import {
  ForgeModuleBase,
  IForgeModuleConfig,
  IForgeOperationResult,
  IForgeResourceCost
} from "./ForgeCore";

/**
 * Module de Tier Upgrade 100% fidèle à AFK Arena
 *
 * Différences importantes avec l'ancienne version :
 * - Pas de système de "tiers" explicite dans AFK Arena classique
 * - Ce module simule plutôt l'évolution T1→T2→T3 des artefacts/équipements
 * - Ou l'évolution des équipements de faction (ex: Lightbearer T1 → T2)
 * - Stars upgrade pour les équipements (1★ → 2★ → 3★ → 4★ → 5★)
 * - Coûts exponentiels et matériaux rares aux hauts tiers
 */

export interface ITierUpgradeOptions {
  targetTier?: number;
  consumeMaterials?: boolean;
}

export class ForgeTierUpgrade extends ForgeModuleBase {
  // Maximum 5 tiers comme dans AFK Arena (T1 à T5 ou 1★ à 5★)
  public static readonly MAX_TIER = 5;

  // Multiplicateurs de stats par tier (progression AFK Arena)
  protected tierMultipliers: { [tier: number]: number } = {
    1: 1.0,    // Tier 1 (base)
    2: 1.25,   // Tier 2 (+25%)
    3: 1.60,   // Tier 3 (+60%) 
    4: 2.10,   // Tier 4 (+110%)
    5: 2.80    // Tier 5 (+180%)
  };

  // Coûts exponentiels par tier
  protected tierCostMultipliers: { [tier: number]: number } = {
    1: 1,      // T1→T2
    2: 3,      // T2→T3
    3: 8,      // T3→T4
    4: 20,     // T4→T5
    5: 50      // T5+ (théorique)
  };

  constructor(playerId: string, config: IForgeModuleConfig) {
    super(playerId, config);
  }

  getModuleName(): string {
    return "tierUpgrade";
  }

  /**
   * Déduit le tier courant à partir de l'owned item
   * Dans AFK Arena, cela pourrait être stocké dans equipmentData.tier
   * Ici on utilise upgradeHistory.length + 1 comme fallback
   */
  protected getCurrentTierFromOwned(owned: any): number {
    // Priorité au champ tier s'il existe
    if (owned.tier && typeof owned.tier === 'number') {
      return Math.max(1, Math.min(owned.tier, ForgeTierUpgrade.MAX_TIER));
    }
    
    // Fallback sur upgradeHistory
    try {
      const upgradeHistory = owned.equipmentData?.upgradeHistory;
      const historyLen = Array.isArray(upgradeHistory) ? upgradeHistory.length : 0;
      return Math.max(1, Math.min(historyLen + 1, ForgeTierUpgrade.MAX_TIER));
    } catch (err) {
      return 1;
    }
  }

  /**
   * Vérifie si un item peut être upgradé au tier suivant
   */
  protected canUpgradeToNextTier(currentTier: number, rarity: string): boolean {
    // Dans AFK Arena, seuls certains équipements peuvent être upgradés
    if (currentTier >= ForgeTierUpgrade.MAX_TIER) return false;
    
    // Restrictions par rareté (comme dans AFK Arena)
    const rarityLimits: { [key: string]: number } = {
      "Common": 2,      // Seulement T1→T2
      "Rare": 3,        // Jusqu'à T3
      "Epic": 4,        // Jusqu'à T4
      "Legendary": 5,   // Jusqu'à T5
      "Mythic": 5,      // Jusqu'à T5
      "Ascended": 5     // Jusqu'à T5
    };

    const maxTierForRarity = rarityLimits[rarity] || 2;
    return currentTier < maxTierForRarity;
  }

  /**
   * Calcule le coût pour l'upgrade de tier (style AFK Arena)
   */
  async calculateTierUpgradeCost(itemInstanceId: string, options?: ITierUpgradeOptions): Promise<IForgeResourceCost | null> {
    const validation = await this.validateItem(itemInstanceId, undefined);
    if (!validation.valid || !validation.itemData || !validation.ownedItem) return null;

    const baseItem: any = validation.itemData;
    const owned: any = validation.ownedItem;

    const currentTier = this.getCurrentTierFromOwned(owned);
    const targetTier = options?.targetTier ? Math.min(options.targetTier, ForgeTierUpgrade.MAX_TIER) : currentTier + 1;

    if (targetTier <= currentTier) return null;
    if (!this.canUpgradeToNextTier(currentTier, baseItem.rarity || "Common")) return null;

    const rarity = baseItem.rarity || "Common";
    const baseGold = this.config.baseGoldCost || 10000;
    const baseGems = this.config.baseGemCost || 500;

    // Coût exponentiel selon le tier cible
    const tierMultiplier = this.tierCostMultipliers[targetTier] || Math.pow(2, targetTier - 1);
    
    // Multiplicateur de rareté
    const rarityMultipliers: { [key: string]: number } = {
      "Common": 1,
      "Rare": 2,
      "Epic": 4,
      "Legendary": 8,
      "Mythic": 16,
      "Ascended": 32
    };

    const rarityMultiplier = rarityMultipliers[rarity] || 1;
    
    // Coût final
    const finalMultiplier = tierMultiplier * rarityMultiplier;
    const gold = Math.floor(baseGold * finalMultiplier);
    const gems = Math.floor(baseGems * finalMultiplier);

    // Matériaux spécialisés
    const materials = this.getTierUpgradeMaterials(rarity, targetTier);
    const finalMaterials = options?.consumeMaterials === false ? {} : materials;

    return { gold, gems, materials: finalMaterials };
  }

  /**
   * Matériaux requis pour tier upgrade (style AFK Arena)
   */
  protected getTierUpgradeMaterials(rarity: string, targetTier: number): { [materialId: string]: number } {
    const materials: { [materialId: string]: number } = {};

    // Matériaux de base selon le tier cible
    const tierMaterials: { [tier: number]: { [materialId: string]: number } } = {
      2: { "tier_stone": 5, "enhancement_dust": 10 },
      3: { "tier_stone": 10, "enhancement_dust": 20, "rare_crystal": 3 },
      4: { "tier_stone": 20, "enhancement_dust": 40, "rare_crystal": 8, "epic_essence": 2 },
      5: { "tier_stone": 40, "enhancement_dust": 80, "rare_crystal": 20, "epic_essence": 5, "legendary_core": 1 }
    };

    // Matériaux de base pour le tier
    const baseMaterials = tierMaterials[targetTier] || {};
    Object.assign(materials, baseMaterials);

    // Matériaux spécialisés par rareté
    const rarityMaterials: { [rarity: string]: { [materialId: string]: number } } = {
      "Rare": { "silver_thread": 2 },
      "Epic": { "golden_thread": 3, "mystic_ore": 1 },
      "Legendary": { "platinum_thread": 4, "mystic_ore": 2, "divine_shard": 1 },
      "Mythic": { "mythic_thread": 5, "divine_shard": 2, "celestial_essence": 1 },
      "Ascended": { "ascended_thread": 8, "celestial_essence": 2, "primordial_fragment": 1 }
    };

    const additionalMaterials = rarityMaterials[rarity] || {};
    Object.assign(materials, additionalMaterials);

    // Scaling selon le tier (plus c'est haut, plus c'est cher)
    const scalingFactor = Math.pow(1.5, targetTier - 2);
    for (const [materialId, amount] of Object.entries(materials)) {
      materials[materialId] = Math.ceil(amount * scalingFactor);
    }

    return materials;
  }

  /**
   * Tentative d'upgrade de tier
   */
  async attemptTierUpgrade(itemInstanceId: string, options?: ITierUpgradeOptions): Promise<IForgeOperationResult> {
    if (!this.isEnabled()) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "TIER_UPGRADE_MODULE_DISABLED", data: null };
    }

    const levelOk = await this.checkPlayerLevelRestrictions();
    if (!levelOk) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "PLAYER_LEVEL_RESTRICTIONS_NOT_MET", data: null };
    }

    // Validation item
    const validation = await this.validateItem(itemInstanceId, undefined);
    if (!validation.valid || !validation.itemData || !validation.ownedItem) {
      return {
        success: false,
        cost: { gold: 0, gems: 0 },
        message: "INVALID_ITEM_FOR_TIER_UPGRADE",
        data: { reason: validation.reason }
      };
    }

    const baseItem: any = validation.itemData;
    const owned: any = validation.ownedItem;
    const currentTier = this.getCurrentTierFromOwned(owned);
    const targetTier = options?.targetTier ? Math.min(options.targetTier, ForgeTierUpgrade.MAX_TIER) : currentTier + 1;

    // Vérifications de base
    if (baseItem.category !== "Equipment") {
      return { 
        success: false, 
        cost: { gold: 0, gems: 0 }, 
        message: "ONLY_EQUIPMENT_CAN_BE_TIER_UPGRADED", 
        data: null 
      };
    }

    if (targetTier <= currentTier) {
      return { 
        success: false, 
        cost: { gold: 0, gems: 0 }, 
        message: "TARGET_TIER_MUST_BE_HIGHER", 
        data: { currentTier, targetTier }
      };
    }

    if (currentTier >= ForgeTierUpgrade.MAX_TIER) {
      return { 
        success: false, 
        cost: { gold: 0, gems: 0 }, 
        message: "ITEM_AT_MAX_TIER", 
        data: { currentTier, maxTier: ForgeTierUpgrade.MAX_TIER }
      };
    }

    if (!this.canUpgradeToNextTier(currentTier, baseItem.rarity || "Common")) {
      return { 
        success: false, 
        cost: { gold: 0, gems: 0 }, 
        message: "RARITY_CANNOT_REACH_TARGET_TIER", 
        data: { rarity: baseItem.rarity, currentTier, targetTier }
      };
    }

    // Calculer coût
    const cost = await this.calculateTierUpgradeCost(itemInstanceId, options);
    if (!cost) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "UNABLE_TO_COMPUTE_TIER_UPGRADE_COST", data: null };
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

    // Récupérer inventaire
    const inventory = await this.getInventory();
    if (!inventory) {
      await this.logOperation("tierUpgrade", itemInstanceId, cost, false, { reason: "Inventory not found after spend" });
      await this.updateStats(cost, false);
      return { success: false, cost, message: "INVENTORY_NOT_FOUND_AFTER_SPENDING", data: null };
    }

    // Modifier directement l'item existant (pas de remove/add)
    try {
      const ownedItem = inventory.getItem(itemInstanceId);
      if (!ownedItem) {
        throw new Error("Item not found after spending resources");
      }

      // Mettre à jour le tier
      const previousTier = currentTier;
      
      // Stocker le tier dans l'item
      (ownedItem as any).tier = targetTier;

      // Mettre à jour equipmentData.upgradeHistory pour tracking
      if (!ownedItem.equipmentData) {
        ownedItem.equipmentData = {
          durability: 100,
          socketedGems: [],
          upgradeHistory: []
        };
      }

      if (!Array.isArray(ownedItem.equipmentData.upgradeHistory)) {
        ownedItem.equipmentData.upgradeHistory = [];
      }

      // Ajouter une entrée pour chaque tier gagné
      for (let i = previousTier; i < targetTier; i++) {
        ownedItem.equipmentData.upgradeHistory.push(new Date());
      }

      // Sauvegarder
      await inventory.save();

      // Recalculer stats pour affichage
      const baseStats = baseItem.baseStats || {};
      const statsPerLevel = baseItem.statsPerLevel || {};
      const level = ownedItem.level || 1;
      const enhancement = ownedItem.enhancement || 0;

      // Appliquer multiplicateur de tier
      const tierMultiplier = this.tierMultipliers[targetTier] || (1 + 0.3 * (targetTier - 1));
      
      const tierBoostedBaseStats: any = {};
      for (const [k, v] of Object.entries(baseStats)) {
        if (typeof v === "number") {
          tierBoostedBaseStats[k] = Math.floor((v as number) * tierMultiplier);
        } else {
          tierBoostedBaseStats[k] = v;
        }
      }

      // Calculer stats finales avec enhancement
      const computedStats = this.calculateItemStatsWithEnhancement(
        tierBoostedBaseStats,
        statsPerLevel,
        level,
        enhancement
      );

      // Log & stats
      await this.logOperation("tierUpgrade", itemInstanceId, cost, true, {
        previousTier,
        newTier: targetTier,
        tierMultiplier
      });
      await this.updateStats(cost, true);

      return {
        success: true,
        cost,
        message: "TIER_UPGRADE_SUCCESS",
        data: {
          instanceId: itemInstanceId,
          previousTier,
          newTier: targetTier,
          tierMultiplier,
          computedStats,
          maxTierReached: targetTier >= ForgeTierUpgrade.MAX_TIER
        }
      };

    } catch (err: any) {
      await this.logOperation("tierUpgrade", itemInstanceId, cost, false, { reason: "Failed to upgrade tier", error: err });
      await this.updateStats(cost, false);
      return { success: false, cost, message: "FAILED_TO_UPGRADE_TIER", data: { error: err?.message || err } };
    }
  }

  /**
   * Obtient les items upgradables du joueur
   */
  async getUpgradableItems(rarity?: string): Promise<Array<{
    instanceId: string;
    itemId: string;
    name: string;
    rarity: string;
    currentTier: number;
    maxPossibleTier: number;
    canUpgrade: boolean;
  }>> {
    try {
      const inventory = await this.getInventory();
      if (!inventory) return [];

      const ItemModel = mongoose.model("Item");
      const upgradableItems: any[] = [];

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

          const currentTier = this.getCurrentTierFromOwned(ownedItem);
          const canUpgrade = this.canUpgradeToNextTier(currentTier, itemRarity);

          // Calculer tier maximum possible pour cette rareté
          const rarityLimits: { [key: string]: number } = {
            "Common": 2, "Rare": 3, "Epic": 4, "Legendary": 5, "Mythic": 5, "Ascended": 5
          };
          const maxPossibleTier = rarityLimits[itemRarity] || 2;

          upgradableItems.push({
            instanceId: ownedItem.instanceId,
            itemId: ownedItem.itemId,
            name: baseItem.name,
            rarity: itemRarity,
            currentTier,
            maxPossibleTier,
            canUpgrade
          });
        }
      }

      return upgradableItems.sort((a, b) => {
        // Trier par possibilité d'upgrade puis par rareté
        if (a.canUpgrade !== b.canUpgrade) return b.canUpgrade ? 1 : -1;
        
        const rarityOrder = ["Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended"];
        const rarityCompare = rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity);
        
        return rarityCompare !== 0 ? rarityCompare : a.name.localeCompare(b.name);
      });

    } catch (error) {
      return [];
    }
  }

  /**
   * 🔧 MÉTHODE CORRIGÉE - Obtient le coût total pour upgrader un item au tier maximum
   */
  async getTotalUpgradeCostToMax(itemInstanceId: string): Promise<{
    totalGold: number;
    totalGems: number;
    totalMaterials: { [materialId: string]: number };
    steps: Array<{ fromTier: number; toTier: number; cost: IForgeResourceCost }>;
  } | null> {
    try {
      const validation = await this.validateItem(itemInstanceId, undefined);
      if (!validation.valid || !validation.itemData || !validation.ownedItem) return null;

      const baseItem: any = validation.itemData;
      const owned: any = validation.ownedItem;
      const rarity = baseItem.rarity || "Common";

      const rarityLimits: { [key: string]: number } = {
        "Common": 2, "Rare": 3, "Epic": 4, "Legendary": 5, "Mythic": 5, "Ascended": 5
      };
      const maxTier = rarityLimits[rarity] || 2;
      const currentTier = this.getCurrentTierFromOwned(owned);

      if (currentTier >= maxTier) return null;

      let totalGold = 0;
      let totalGems = 0;
      const totalMaterials: { [materialId: string]: number } = {};
      const steps: any[] = [];

      // ✅ CORRECTION : Calculer le coût directement pour chaque tier
      // au lieu de faire appel à calculateTierUpgradeCost de manière répétée
      const baseGold = this.config.baseGoldCost || 10000;
      const baseGems = this.config.baseGemCost || 500;

      // Multiplicateur de rareté
      const rarityMultipliers: { [key: string]: number } = {
        "Common": 1, "Rare": 2, "Epic": 4, "Legendary": 8, "Mythic": 16, "Ascended": 32
      };
      const rarityMultiplier = rarityMultipliers[rarity] || 1;

      // Calculer coût pour chaque tier
      for (let tier = currentTier + 1; tier <= maxTier; tier++) {
        // Calculer le coût pour upgrade vers ce tier
        const tierMultiplier = this.tierCostMultipliers[tier] || Math.pow(2, tier - 1);
        const finalMultiplier = tierMultiplier * rarityMultiplier;
        
        const stepCost: IForgeResourceCost = {
          gold: Math.floor(baseGold * finalMultiplier),
          gems: Math.floor(baseGems * finalMultiplier),
          materials: this.getTierUpgradeMaterials(rarity, tier)
        };

        totalGold += stepCost.gold;
        totalGems += stepCost.gems;

        // Additionner matériaux
        if (stepCost.materials) {
          for (const [materialId, amount] of Object.entries(stepCost.materials)) {
            totalMaterials[materialId] = (totalMaterials[materialId] || 0) + amount;
          }
        }

        steps.push({
          fromTier: tier - 1,
          toTier: tier,
          cost: stepCost
        });
      }

      return {
        totalGold,
        totalGems,
        totalMaterials,
        steps
      };

    } catch (error) {
      console.error('Error in getTotalUpgradeCostToMax:', error);
      return null;
    }
  }
}

export default ForgeTierUpgrade;

import mongoose from "mongoose";
import {
  ForgeModuleBase,
  IForgeModuleConfig,
  IForgeOperationResult,
  IForgeResourceCost
} from "./ForgeCore";

/**
 * Module de Tier Upgrade (inspiré d'AFK Arena)
 *
 * Comportement :
 * - Faire évoluer un équipement T1 -> T2 -> T3 ...
 * - Conserve la même rareté mais augmente les stats de base via multiplicateurs par tier
 * - Utilise des matériaux spécialisés (essences, cristaux, etc.) fournis par ForgeCore.getMaterialRequirements(..., 'tierUpgrade')
 * - Conserve le niveau d'amélioration (+enhancement) de l'instance
 * - Utilise les méthodes du modèle Inventory (removeItem, addItem) pour gérer les instances
 *
 * Hypothèses/précisions sur le stockage :
 * - Le schéma d'Inventory n'expose pas explicitement un champ `tier` sur les owned items.
 *   Ici on infère le tier courant à partir de equipmentData.upgradeHistory.length :
 *     currentTier = (owned.equipmentData?.upgradeHistory?.length ?? 0) + 1
 *   Après réussite, on pousse une date dans equipmentData.upgradeHistory pour matérialiser le changement de tier.
 *
 * - L'owned item possède `enhancement` (conformément à Inventory.ts). On conserve cette valeur sur la nouvelle instance.
 *
 * - Les stats recalculées sont retournées dans data.computedStats (elles ne sont pas persistées dans le sous-document
 *   car le schéma d'ownedItem ne dispose pas de champ `stats`). Si vous souhaitez persister des stats/tiers par instance,
 *   il faudra étendre le schéma Inventory.
 */

export interface ITierUpgradeOptions {
  targetTier?: number; // optionnel : monter directement à ce tier si autorisé (ex: admin)
  consumeMaterials?: boolean; // si false, n'exige pas les matériaux (admin/test)
}

export class ForgeTierUpgrade extends ForgeModuleBase {
  // On définit un maximum de tiers plausible (peut être ajusté)
  public static readonly MAX_TIER = 5;

  // Multiplicateurs de stats par tier (T1 = 1.0)
  protected tierMultipliers: { [tier: number]: number } = {
    1: 1.0,
    2: 1.15,
    3: 1.35,
    4: 1.60,
    5: 2.00
  };

  constructor(playerId: string, config: IForgeModuleConfig) {
    super(playerId, config);
  }

  getModuleName(): string {
    return "tierUpgrade";
  }

  /**
   * Déduit le tier courant à partir de l'owned item.
   * currentTier = upgradeHistory.length + 1
   */
  protected getCurrentTierFromOwned(owned: any): number {
    try {
      const upgradeHistory = owned.equipmentData?.upgradeHistory;
      const historyLen = Array.isArray(upgradeHistory) ? upgradeHistory.length : 0;
      return Math.max(1, historyLen + 1);
    } catch (err) {
      return 1;
    }
  }

  /**
   * Calcule le coût pour passer au prochain tier (ou targetTier si fourni)
   * - Base : baseGold/baseGems de la config
   * - Multiplicateur par rareté (via calculateRarityBasedCost)
   * - Scaling additionnel par tierTarget
   */
  async calculateTierUpgradeCost(itemInstanceId: string, options?: ITierUpgradeOptions): Promise<IForgeResourceCost | null> {
    const validation = await this.validateItem(itemInstanceId, undefined);
    if (!validation.valid || !validation.itemData || !validation.ownedItem) return null;

    const baseItem: any = validation.itemData;
    const owned: any = validation.ownedItem;

    const currentTier = this.getCurrentTierFromOwned(owned);
    const targetTier = options?.targetTier ? options.targetTier : currentTier + 1;

    if (targetTier <= currentTier) return null;
    if (targetTier > ForgeTierUpgrade.MAX_TIER) return null;

    const tierStep = targetTier - currentTier;

    // Calcul du coût de base selon rareté
    const rarity = baseItem.rarity || "Common";
    const baseGold = this.config.baseGoldCost || 300;
    const baseGems = this.config.baseGemCost || 0;

    // Utiliser calculateRarityBasedCost pour appliquer multiplicateur de rareté
    const rarityCost = this.calculateRarityBasedCost(baseGold, baseGems, rarity, { tier: targetTier });

    // Appliquer un scaling par nombre de steps (si targetTier > currentTier)
    const stepMultiplier = 1 + (tierStep * 0.5); // chaque tier supplémentaire multiplie le coût
    const gold = Math.floor(rarityCost.gold * stepMultiplier);
    const gems = Math.floor(rarityCost.gems * stepMultiplier);

    // Matériaux spécialisés pour tier upgrade
    const materials = this.getMaterialRequirements(rarity, "tierUpgrade");
    // Scale materials by tierStep (consume more materials for higher target)
    const scaledMaterials: { [key: string]: number } = {};
    for (const [matId, qty] of Object.entries(materials || {})) {
      scaledMaterials[matId] = Math.max(1, Math.floor((qty as number) * tierStep));
    }

    const finalMaterials = options?.consumeMaterials === false ? {} : scaledMaterials;

    return { gold, gems, materials: finalMaterials };
  }

  /**
   * Tente de faire évoluer un équipement d'un tier à l'autre (ou vers targetTier si fourni)
   */
  async attemptTierUpgrade(itemInstanceId: string, options?: ITierUpgradeOptions): Promise<IForgeOperationResult> {
    if (!this.isEnabled()) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "Tier upgrade module disabled", data: null };
    }

    // Validation item
    const validation = await this.validateItem(itemInstanceId, undefined);
    if (!validation.valid || !validation.itemData || !validation.ownedItem) {
      return {
        success: false,
        cost: { gold: 0, gems: 0 },
        message: validation.reason || "Invalid item",
        data: validation
      };
    }

    const baseItem: any = validation.itemData;
    const owned: any = validation.ownedItem;
    const currentTier = this.getCurrentTierFromOwned(owned);
    const targetTier = options?.targetTier ? options.targetTier : currentTier + 1;

    if (targetTier <= currentTier) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "Target tier must be greater than current tier", data: { currentTier, targetTier } };
    }
    if (targetTier > ForgeTierUpgrade.MAX_TIER) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: `Target tier exceeds maximum (${ForgeTierUpgrade.MAX_TIER})`, data: null };
    }

    // Calculer coût
    const cost = await this.calculateTierUpgradeCost(itemInstanceId, options);
    if (!cost) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "Unable to compute tier upgrade cost", data: null };
    }

    // Vérifier ressources
    const canAfford = await this.validatePlayerResources(cost);
    if (!canAfford) {
      return { success: false, cost, message: "Insufficient resources", data: null };
    }

    // Dépenser ressources
    const spent = await this.spendResources(cost);
    if (!spent) {
      return { success: false, cost, message: "Failed to spend resources", data: null };
    }

    // Récupérer inventaire
    const inventory = await this.getInventory();
    if (!inventory) {
      await this.logOperation("tierUpgrade", itemInstanceId, cost, false, { reason: "Inventory not found after spend" });
      await this.updateStats(cost, false);
      return { success: false, cost, message: "Inventory not found after spending resources", data: null };
    }

    // Supprimer l'ancienne instance
    try {
      const removed = await inventory.removeItem(owned.instanceId, 1);
      if (!removed) {
        throw new Error("Failed to remove base item for tier upgrade");
      }
    } catch (err: any) {
      await this.logOperation("tierUpgrade", itemInstanceId, cost, false, { reason: "Failed to remove base item", error: err });
      await this.updateStats(cost, false);
      return { success: false, cost, message: "Failed to remove base item", data: { error: err?.message || err } };
    }

    // Créer la nouvelle instance (même itemId, même rarity). Conserver level & enhancement.
    try {
      // level to keep
      const level = owned.level || 1;
      const previousEnhancement = owned.enhancement || 0;

      // Ajouter nouvelle instance via inventory.addItem (respecte la logique d'insertion du schéma)
      const added = await inventory.addItem(baseItem.itemId, 1, level);
      // addItem saved inventory already; we still need to set enhancement and equipmentData
      if (!added) {
        throw new Error("inventory.addItem returned falsy");
      }

      // Trouver la référence de l'instance nouvellement ajoutée (addItem renvoie l'owned object)
      const newOwned: any = added;

      // Conserver enhancement
      newOwned.enhancement = previousEnhancement;

      // Mettre à jour equipmentData.upgradeHistory pour refléter le nouveau tier
      if (!newOwned.equipmentData) newOwned.equipmentData = { durability: 100, socketedGems: [], upgradeHistory: [] };
      if (!Array.isArray(newOwned.equipmentData.upgradeHistory)) newOwned.equipmentData.upgradeHistory = [];

      // Calculer nombre d'upgrades à enregistrer : targetTier - 1
      const expectedHistoryLen = Math.max(0, targetTier - 1);
      // On pousse une entrée pour chaque step (ici on pousse une seule date correspondant à cette montée d'au moins 1 step)
      newOwned.equipmentData.upgradeHistory.push(new Date());

      // Sauvegarder l'inventaire (pour persister les modifications sur le sous-document renvoyé)
      await inventory.save();

      // Recalcule des stats pour retourner au client (on n'ajoute pas de champ stats au owned item persistent)
      const baseStats = baseItem.baseStats || {};
      const statsPerLevel = baseItem.statsPerLevel || {};

      // Trouver multiplicateur de tier
      const multiplier = this.tierMultipliers[targetTier] ?? (1 + 0.25 * (targetTier - 1));

      // Appliquer multiplicateur sur baseStats
      const recalculatedBaseStats: any = {};
      for (const [k, v] of Object.entries(baseStats)) {
        if (typeof v === "number") {
          recalculatedBaseStats[k] = Math.floor((v as number) * multiplier);
        } else {
          recalculatedBaseStats[k] = v;
        }
      }

      // Utiliser calculateItemStatsWithEnhancement pour appliquer l'enhancement existant
      const computedStats = this.calculateItemStatsWithEnhancement(recalculatedBaseStats, statsPerLevel, level, previousEnhancement);

      // Log & stats
      await this.logOperation("tierUpgrade", itemInstanceId, cost, true, {
        previousInstanceId: owned.instanceId,
        newInstanceId: newOwned.instanceId,
        previousTier: currentTier,
        newTier: targetTier
      });
      await this.updateStats(cost, true);

      return {
        success: true,
        cost,
        message: `Tier upgrade success: T${currentTier} -> T${targetTier}`,
        data: {
          previousInstanceId: owned.instanceId,
          newInstance: newOwned,
          newInstanceId: newOwned.instanceId,
          previousTier: currentTier,
          newTier: targetTier,
          computedStats
        }
      };
    } catch (err: any) {
      await this.logOperation("tierUpgrade", itemInstanceId, cost, false, { reason: "Failed to create upgraded item", error: err });
      await this.updateStats(cost, false);
      return { success: false, cost, message: "Failed to create upgraded item", data: { error: err?.message || err } };
    }
  }
}

export default ForgeTierUpgrade;

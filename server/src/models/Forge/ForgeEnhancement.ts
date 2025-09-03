import mongoose from "mongoose";
import {
  ForgeModuleBase,
  IForgeModuleConfig,
  IForgeOperationResult,
  IForgeResourceCost
} from "./ForgeCore";

/**
 * Module d'enchantement (Enhancement) inspiré d'AFK Arena.
 * Ajouts :
 * - possibilité d'utiliser des gems payantes pour garantir le succès
 * - système de "pity" / compensation en cas d'échecs répétés
 *
 * Hypothèses :
 * - ownedItem.enhancementLevel : number
 * - ownedItem.enhancementPity : number (compteur d'échecs consécutifs pour le pity)
 * - inventory.getItem(instanceId) retourne un objet modifiable et inventory.save() persiste les changements
 * - player.spendCurrency(cost) accepte un objet coût qui peut contenir `paidGems` si on veut marquer des gems payantes
 */

export interface IEnhancementOptions {
  usePaidGemsToGuarantee?: boolean; // si true, on ajoutera un coût en gems pour garantir le succès
  forceGuaranteed?: boolean; // option interne ou admin pour forcer guarantee (contournement)
}

export class ForgeEnhancement extends ForgeModuleBase {
  // Niveau maximum d'enchantement (AFK-like : +30)
  public static readonly MAX_ENHANCEMENT_LEVEL = 30;

  // Valeurs par défaut de pity / guarantee (peuvent être surchargées via config.materialRequirements ou autre)
  protected defaultPityThreshold = 7; // après 7 échecs consécutifs on garantit la réussite suivante
  protected defaultPityIncreasePerFail = 0.04; // +4% de chance par échec (cumulatif)
  protected defaultMaxPityBonus = 0.5; // max +50% via pity

  constructor(playerId: string, config: IForgeModuleConfig) {
    super(playerId, config);
  }

  getModuleName(): string {
    return "enhancement";
  }

  /**
   * Calcule le coût (gold/gems + matériaux) pour passer de currentLevel -> currentLevel + 1
   * Si options.usePaidGemsToGuarantee=true, la valeur retournée inclura le coût supplémentaire en gems
   */
  async getEnhancementCost(itemInstanceId: string, options?: IEnhancementOptions): Promise<IForgeResourceCost | null> {
    const validation = await this.validateItem(itemInstanceId, undefined);
    if (!validation.valid || !validation.itemData || !validation.ownedItem) return null;

    const baseItem: any = validation.itemData;
    const ownedItem: any = validation.ownedItem;
    const currentLevel: number = ownedItem.enhancementLevel || 0;
    const nextLevel = currentLevel + 1;

    if (currentLevel >= ForgeEnhancement.MAX_ENHANCEMENT_LEVEL) return null;

    // Utiliser calculateExponentialCost pour coûter gold/gems
    const baseGold = this.config.baseGoldCost || 100;
    const baseGems = this.config.baseGemCost || 0;
    const exponentialFactor = 1.12;
    const cost = this.calculateExponentialCost(baseGold, baseGems, nextLevel, ForgeEnhancement.MAX_ENHANCEMENT_LEVEL, exponentialFactor);

    // Ajouter matériaux selon la rareté
    const materials = this.getMaterialRequirements(baseItem.rarity || "Common", "enhancement");

    const finalCost: any = {
      gold: cost.gold,
      gems: cost.gems,
      materials
    };

    // Si l'utilisateur souhaite garantir via gems, ajouter le coût en gems payantes (paidGems)
    if (options?.usePaidGemsToGuarantee) {
      const guaranteeGems = this.calculateGuaranteeGemCost(currentLevel);
      // Marquer comme paidGems si possible — on ajoute la clé paidGems en complément
      finalCost.paidGems = (finalCost.paidGems || 0) + guaranteeGems;
      // On peut aussi augmenter gems si le système attend gems comme principale monnaie
      finalCost.gems = (finalCost.gems || 0) + guaranteeGems;
    }

    return finalCost;
  }

  /**
   * Calcule le coût (en gems payantes) pour garantir le succès à un niveau donné.
   * Formule : basePaidGemCost * (1 + currentLevel * multiplier) ; arrondi à l'entier supérieur.
   * Ces valeurs peuvent être adaptées pour équilibrage.
   */
  protected calculateGuaranteeGemCost(currentLevel: number): number {
    const basePaidGemCost = Math.max(5, Math.floor((this.config.baseGemCost || 5))); // coût de base
    const levelMultiplier = 1 + (currentLevel * 0.25); // chaque + augmente le coût garanti de 25%
    const cost = Math.ceil(basePaidGemCost * levelMultiplier);
    // cap pour éviter abus extrême
    const maxCost = 1000;
    return Math.min(cost, maxCost);
  }

  /**
   * Retourne la probabilité de succès de base (sans pity) pour tenter l'enchantement au niveau courant.
   */
  protected getBaseSuccessChance(currentLevel: number): number {
    if (currentLevel < 5) return 1.0; // 100% pour +0 -> +5
    if (currentLevel < 10) return 0.95;
    if (currentLevel < 15) return 0.85;
    if (currentLevel < 20) return 0.65;
    if (currentLevel < 25) return 0.40;
    if (currentLevel < 30) return 0.18;
    return 0.0;
  }

  /**
   * Calcule la chance de succès effective en appliquant le système de pity.
   * - owned.enhancementPity est le nombre d'échecs consécutifs
   * - configuration via valeurs par défaut ou override via this.config.materialRequirements (facultatif)
   */
  protected getEffectiveSuccessChance(currentLevel: number, ownedItem: any): { effectiveChance: number; pityData: any } {
    const baseChance = this.getBaseSuccessChance(currentLevel);

    const pityFailures = ownedItem.enhancementPity || 0;
    // Récupérer des valeurs de config si présentes (optionnel)
    const pityThreshold = (this.config as any)?.pityThreshold ?? this.defaultPityThreshold;
    const pityIncreasePerFail = (this.config as any)?.pityIncreasePerFail ?? this.defaultPityIncreasePerFail;
    const maxPityBonus = (this.config as any)?.maxPityBonus ?? this.defaultMaxPityBonus;

    // Bonus de pity cumulatif
    const bonusFromPity = Math.min(pityFailures * pityIncreasePerFail, maxPityBonus);
    const effectiveChance = Math.min(1, baseChance + bonusFromPity);

    const willBeGuaranteedByPity = pityFailures >= pityThreshold;

    return {
      effectiveChance,
      pityData: {
        pityFailures,
        pityThreshold,
        pityIncreasePerFail,
        maxPityBonus,
        bonusFromPity,
        willBeGuaranteedByPity
      }
    };
  }

  /**
   * Tente d'enchanter l'objet (essayer d'augmenter de +1).
   * options.usePaidGemsToGuarantee : si true, on ajoute le coût paidGems et la tentative est garantie.
   * Retourne un IForgeOperationResult avec le résultat.
   */
  async attemptEnhance(itemInstanceId: string, options?: IEnhancementOptions): Promise<IForgeOperationResult> {
    if (!this.isEnabled()) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "Enhancement module disabled", data: null };
    }

    const levelOk = await this.checkPlayerLevelRestrictions();
    if (!levelOk) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "Player level restrictions not met", data: null };
    }

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
    const ownedItem: any = validation.ownedItem;
    const currentLevel: number = ownedItem.enhancementLevel || 0;

    if (currentLevel >= ForgeEnhancement.MAX_ENHANCEMENT_LEVEL) {
      return {
        success: false,
        cost: { gold: 0, gems: 0 },
        message: `Item is already at maximum enhancement level (+${ForgeEnhancement.MAX_ENHANCEMENT_LEVEL})`,
        data: { currentLevel }
      };
    }

    // Re-calculer coût de base (sans garantie)
    const baseCost = await this.getEnhancementCost(itemInstanceId, undefined);
    if (!baseCost) {
      return { success: false, cost: { gold: 0, gems: 0 }, message: "Unable to compute cost", data: null };
    }

    // Si option de guarantee via paid gems, obtenir coût complet incluant paidGems
    let finalCost: any = { ...baseCost };
    if (options?.usePaidGemsToGuarantee) {
      const guaranteeGems = this.calculateGuaranteeGemCost(currentLevel);
      finalCost.paidGems = (finalCost.paidGems || 0) + guaranteeGems;
      finalCost.gems = (finalCost.gems || 0) + guaranteeGems;
    }

    // Vérifier que le joueur a les ressources
    const canAfford = await this.validatePlayerResources(finalCost);
    if (!canAfford) {
      return { success: false, cost: finalCost, message: "Insufficient resources", data: null };
    }

    // Dépenser les ressources
    const spent = await this.spendResources(finalCost);
    if (!spent) {
      return { success: false, cost: finalCost, message: "Failed to spend resources", data: null };
    }

    // Recharger inventaire et item pour être sûrs
    const inventory = await this.getInventory();
    if (!inventory) {
      await this.logOperation("enhancement", itemInstanceId, finalCost, false, { reason: "Inventory missing after spend" });
      await this.updateStats(finalCost, false);
      return { success: false, cost: finalCost, message: "Inventory not found after spending resources", data: null };
    }

    const owned = inventory.getItem(itemInstanceId);
    if (!owned) {
      await this.logOperation("enhancement", itemInstanceId, finalCost, false, { reason: "Item missing after spend" });
      await this.updateStats(finalCost, false);
      return { success: false, cost: finalCost, message: "Item missing after spending resources", data: null };
    }

    // Calculer chances et appliquer pity
    const { effectiveChance, pityData } = this.getEffectiveSuccessChance(currentLevel, owned);

    // Si option guarantee via gems ou via forceGuaranteed, garantir le succès
    const guaranteeUsed = !!options?.usePaidGemsToGuarantee || !!options?.forceGuaranteed;
    const pityGuaranteeTriggered = pityData.willBeGuaranteedByPity;

    let success = false;
    let roll = null;

    if (guaranteeUsed || pityGuaranteeTriggered) {
      success = true;
    } else {
      roll = Math.random();
      success = roll <= effectiveChance;
    }

    let newLevel = currentLevel;
    let newStats = null;

    if (success) {
      newLevel = currentLevel + 1;
      owned.enhancementLevel = newLevel;

      // Reset pity on success
      owned.enhancementPity = 0;

      // Recalculer stats
      try {
        const baseStats = baseItem.baseStats || {};
        const statsPerLevel = baseItem.statsPerLevel || {};
        const enhancement = newLevel;
        newStats = this.calculateItemStatsWithEnhancement(baseStats, statsPerLevel, owned.level || 1, enhancement);
        owned.stats = newStats;
      } catch (err) {
        // Si recalcul des stats échoue, ne pas bloquer l'opération
      }

      try {
        await inventory.save();
      } catch (err) {
        // Ne pas bloquer ; log plus bas
      }
    } else {
      // Échec : incrémenter le compteur de pity
      owned.enhancementPity = (owned.enhancementPity || 0) + 1;

      // Possibilité: comportement additionnel comme "compensation partielle" :
      // On pourrait rembourser partiellement gold ou matériaux, ou créditer des "pity tokens".
      // Ici on n'implémente pas de remboursement automatique, seulement le compteur de pity.
      try {
        await inventory.save();
      } catch (err) {
        // continuer
      }
    }

    // Log détaillé incluant pity et guarantee
    await this.logOperation("enhancement", itemInstanceId, finalCost, success, {
      roll,
      effectiveChance,
      baseChance: this.getBaseSuccessChance(currentLevel),
      pityData,
      guaranteeUsed,
      pityGuaranteeTriggered,
      previousLevel: currentLevel,
      newLevel
    });

    await this.updateStats(finalCost, success);

    const messageParts = [];
    if (success) {
      messageParts.push(`Enhancement success: +${newLevel}`);
      if (guaranteeUsed) messageParts.push("(guaranteed via paid gems)");
      if (pityGuaranteeTriggered) messageParts.push("(guaranteed by pity)");
    } else {
      messageParts.push(`Enhancement failed at +${currentLevel}`);
      messageParts.push(`Pity: ${owned.enhancementPity || 0}`);
    }

    return {
      success,
      cost: finalCost,
      message: messageParts.join(" "),
      data: {
        previousLevel: currentLevel,
        newLevel: success ? newLevel : currentLevel,
        newStats,
        pity: owned.enhancementPity || 0,
        guaranteeUsed,
        pityGuaranteeTriggered
      }
    };
  }
}

export default ForgeEnhancement;

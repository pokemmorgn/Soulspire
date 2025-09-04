import mongoose from "mongoose";
import {
  ForgeModuleBase,
  IForgeModuleConfig,
  IForgeOperationResult,
  IForgeResourceCost
} from "./ForgeCore";

/**
 * Module d'enchantement (Enhancement) fidèle à AFK Arena.
 * 
 * Améliorations par rapport à la version précédente :
 * - Pity reset aux paliers +10, +20, +30 comme AFK Arena
 * - Garantie automatique aux paliers critiques
 * - Taux de succès plus fidèles à AFK Arena
 * - Maximum 3 stats lockées dans le reforge (pas 4)
 * - Matériaux plus simples (enhancement stones)
 */

export interface IEnhancementOptions {
  usePaidGemsToGuarantee?: boolean;
  forceGuaranteed?: boolean;
}

export class ForgeEnhancement extends ForgeModuleBase {
  // Niveau maximum comme AFK Arena
  public static readonly MAX_ENHANCEMENT_LEVEL = 30;

  // Paliers critiques où le pity se reset (comme AFK Arena)
  protected readonly PITY_RESET_LEVELS = [10, 20, 30];
  protected readonly GUARANTEED_LEVELS = [10, 20, 30]; // Garantie à ces niveaux après échecs

  // Valeurs ajustées pour être plus fidèles à AFK Arena
  protected defaultPityThreshold = 10; // Plus tolérant qu'AFK Arena réel
  protected defaultPityIncreasePerFail = 0.05; // +5% par échec
  protected defaultMaxPityBonus = 0.7; // max +70% via pity

  constructor(playerId: string, config: IForgeModuleConfig) {
    super(playerId, config);
  }

  getModuleName(): string {
    return "enhancement";
  }

  /**
   * Taux de succès de base plus fidèles à AFK Arena
   */
  protected getBaseSuccessChance(currentLevel: number): number {
    // Taux inspirés d'AFK Arena (approximatifs)
    if (currentLevel <= 5) return 1.0;   // 100% pour +0 à +5
    if (currentLevel <= 10) return 0.9;  // 90% pour +6 à +10
    if (currentLevel <= 15) return 0.7;  // 70% pour +11 à +15
    if (currentLevel <= 20) return 0.5;  // 50% pour +16 à +20
    if (currentLevel <= 25) return 0.25; // 25% pour +21 à +25
    if (currentLevel < 30) return 0.1;   // 10% pour +26 à +29
    return 0.0; // Impossible d'aller au-delà de +30
  }

  /**
   * Système de pity avec reset aux paliers comme AFK Arena
   */
  protected getEffectiveSuccessChance(currentLevel: number, ownedItem: any): { effectiveChance: number; pityData: any } {
    const baseChance = this.getBaseSuccessChance(currentLevel);
    const nextLevel = currentLevel + 1;

    // Trouver le dernier palier de reset passé
    const lastResetLevel = this.PITY_RESET_LEVELS
      .filter(level => level <= currentLevel)
      .pop() || 0;

    // Le pity compte depuis le dernier reset de palier
    const totalFailures = ownedItem.enhancementPity || 0;
    const lastResetFailures = ownedItem.lastResetFailures || 0;
    const pityFailures = totalFailures - lastResetFailures;

    // Récupérer config ou utiliser valeurs par défaut
    const pityThreshold = (this.config as any)?.pityThreshold ?? this.defaultPityThreshold;
    const pityIncreasePerFail = (this.config as any)?.pityIncreasePerFail ?? this.defaultPityIncreasePerFail;
    const maxPityBonus = (this.config as any)?.maxPityBonus ?? this.defaultMaxPityBonus;

    // Bonus de pity cumulatif depuis le dernier reset
    const bonusFromPity = Math.min(pityFailures * pityIncreasePerFail, maxPityBonus);
    let effectiveChance = Math.min(1.0, baseChance + bonusFromPity);

    // Garantie automatique aux paliers critiques après suffisamment d'échecs
    const isGuaranteedLevel = this.GUARANTEED_LEVELS.includes(nextLevel);
    const willBeGuaranteedByPity = isGuaranteedLevel && pityFailures >= pityThreshold;

    // Si c'est un palier garanti et qu'on a assez d'échecs, garantir
    if (willBeGuaranteedByPity) {
      effectiveChance = 1.0;
    }

    return {
      effectiveChance,
      pityData: {
        pityFailures,
        totalFailures,
        lastResetLevel,
        lastResetFailures,
        pityThreshold,
        pityIncreasePerFail,
        maxPityBonus,
        bonusFromPity,
        willBeGuaranteedByPity,
        isGuaranteedLevel,
        nextLevelIsReset: this.PITY_RESET_LEVELS.includes(nextLevel)
      }
    };
  }

  /**
   * Calcule le coût avec matériaux simplifiés (enhancement stones)
   */
  async getEnhancementCost(itemInstanceId: string, options?: IEnhancementOptions): Promise<IForgeResourceCost | null> {
    const validation = await this.validateItem(itemInstanceId, undefined);
    if (!validation.valid || !validation.itemData || !validation.ownedItem) return null;

    const baseItem: any = validation.itemData;
    const ownedItem: any = validation.ownedItem;
    const currentLevel: number = ownedItem.enhancementLevel || 0;
    const nextLevel = currentLevel + 1;

    if (currentLevel >= ForgeEnhancement.MAX_ENHANCEMENT_LEVEL) return null;

    // Coût de base plus agressif pour les hauts niveaux
    const baseGold = this.config.baseGoldCost || 100;
    const baseGems = this.config.baseGemCost || 0;
    let exponentialFactor = 1.15; // Plus agressif qu'avant

    // Coût encore plus élevé aux paliers critiques
    if (this.GUARANTEED_LEVELS.includes(nextLevel)) {
      exponentialFactor = 1.25;
    }

    const cost = this.calculateExponentialCost(
      baseGold, 
      baseGems, 
      nextLevel, 
      ForgeEnhancement.MAX_ENHANCEMENT_LEVEL, 
      exponentialFactor
    );

    // Matériaux simplifiés comme AFK Arena (enhancement stones principalement)
    const materials = this.getSimplifiedMaterials(baseItem.rarity || "Common", nextLevel);

    const finalCost: any = {
      gold: cost.gold,
      gems: cost.gems,
      materials
    };

    // Option guarantee via paid gems
    if (options?.usePaidGemsToGuarantee) {
      const guaranteeGems = this.calculateGuaranteeGemCost(currentLevel);
      finalCost.paidGems = (finalCost.paidGems || 0) + guaranteeGems;
      finalCost.gems = (finalCost.gems || 0) + guaranteeGems;
    }

    return finalCost;
  }

  /**
   * Matériaux simplifiés inspirés d'AFK Arena
   */
  protected getSimplifiedMaterials(rarity: string, targetLevel: number): { [materialId: string]: number } {
    const materials: { [materialId: string]: number } = {};

    // Enhancement stones basiques toujours requis
    materials["enhancement_stone"] = Math.max(1, Math.floor(targetLevel / 5) + 1);

    // Matériaux spécialisés selon rareté et palier
    if (targetLevel > 10) {
      const rarityMaterials: { [key: string]: string } = {
        "Common": "iron_ore",
        "Rare": "magic_crystal", 
        "Epic": "dragon_scale",
        "Legendary": "phoenix_feather",
        "Mythic": "celestial_essence",
        "Ascended": "divine_fragment"
      };

      const materialId = rarityMaterials[rarity] || "iron_ore";
      materials[materialId] = Math.floor(targetLevel / 10) + 1;
    }

    // Matériaux premium aux paliers critiques
    if (this.GUARANTEED_LEVELS.includes(targetLevel)) {
      materials["enhancement_catalyst"] = 1;
      
      if (targetLevel >= 20) {
        materials["mythic_essence"] = Math.floor(targetLevel / 20);
      }
    }

    return materials;
  }

  /**
   * Calcul du coût de garantie ajusté
   */
  protected calculateGuaranteeGemCost(currentLevel: number): number {
    const baseCost = 10;
    
    // Coût exponentiellement plus élevé aux hauts niveaux
    if (currentLevel >= 25) return Math.ceil(baseCost * Math.pow(2, currentLevel - 20));
    if (currentLevel >= 20) return Math.ceil(baseCost * Math.pow(1.8, currentLevel - 15));
    if (currentLevel >= 15) return Math.ceil(baseCost * Math.pow(1.5, currentLevel - 10));
    if (currentLevel >= 10) return Math.ceil(baseCost * Math.pow(1.3, currentLevel - 5));
    
    return Math.ceil(baseCost * (1 + currentLevel * 0.2));
  }

  /**
   * Tentative d'enhancement avec gestion du pity reset
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
  
  // 🔧 CORRECTION : Utiliser le bon champ pour le niveau d'enhancement
  const currentLevel: number = ownedItem.enhancement || ownedItem.enhancementLevel || 0;

  if (currentLevel >= ForgeEnhancement.MAX_ENHANCEMENT_LEVEL) {
    return {
      success: false,
      cost: { gold: 0, gems: 0 },
      message: `Item is already at maximum enhancement level (+${ForgeEnhancement.MAX_ENHANCEMENT_LEVEL})`,
      data: { currentLevel }
    };
  }

  // Calculer coût
  const baseCost = await this.getEnhancementCost(itemInstanceId, undefined);
  if (!baseCost) {
    return { success: false, cost: { gold: 0, gems: 0 }, message: "Unable to compute cost", data: null };
  }

  let finalCost: any = { ...baseCost };
  if (options?.usePaidGemsToGuarantee) {
    const guaranteeGems = this.calculateGuaranteeGemCost(currentLevel);
    finalCost.paidGems = (finalCost.paidGems || 0) + guaranteeGems;
    finalCost.gems = (finalCost.gems || 0) + guaranteeGems;
  }

  // Vérifier ressources
  const canAfford = await this.validatePlayerResources(finalCost);
  if (!canAfford) {
    return { success: false, cost: finalCost, message: "Insufficient resources", data: null };
  }

  // Dépenser ressources
  const spent = await this.spendResources(finalCost);
  if (!spent) {
    return { success: false, cost: finalCost, message: "Failed to spend resources", data: null };
  }

  // Recharger pour être sûr
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

  // 🔧 CORRECTION : Utiliser le bon champ ici aussi pour le calcul du pity
  const currentLevelForPity: number = owned.enhancement || owned.enhancementLevel || 0;

  // Calculer chances et appliquer pity
  const { effectiveChance, pityData } = this.getEffectiveSuccessChance(currentLevelForPity, owned);

  // Déterminer le résultat
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
    
    // 🔧 CORRECTION : Mettre à jour les deux champs pour compatibilité
    owned.enhancement = newLevel;
    owned.enhancementLevel = newLevel;

    // Reset du pity si on atteint un palier de reset
    if (this.PITY_RESET_LEVELS.includes(newLevel)) {
      owned.lastResetFailures = owned.enhancementPity || 0;
      owned.lastResetLevel = newLevel;
    }

    // Reset compteur d'échecs sur succès
    owned.enhancementPity = owned.lastResetFailures || 0;

    // Recalcul des stats
    try {
      const baseStats = baseItem.baseStats || {};
      const statsPerLevel = baseItem.statsPerLevel || {};
      newStats = this.calculateItemStatsWithEnhancement(baseStats, statsPerLevel, owned.level || 1, newLevel);
      owned.stats = newStats;
    } catch (err) {
      // Ne pas bloquer
    }

    try {
      await inventory.save();
    } catch (err) {
      // Log mais ne pas bloquer
    }
  } else {
    // Échec : incrémenter pity
    owned.enhancementPity = (owned.enhancementPity || 0) + 1;

    try {
      await inventory.save();
    } catch (err) {
      // continuer
    }
  }

  // Log détaillé
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

  // Message informatif avec labels
  const messageParts = [];
  if (success) {
    messageParts.push("ENHANCEMENT_SUCCESS");
    if (guaranteeUsed) messageParts.push("GUARANTEED_VIA_PAID_GEMS");
    if (pityGuaranteeTriggered) messageParts.push("GUARANTEED_BY_PITY_PROTECTION");
    if (this.PITY_RESET_LEVELS.includes(newLevel)) messageParts.push("PITY_RESET");
  } else {
    messageParts.push("ENHANCEMENT_FAILED");
    if (pityData.nextLevelIsReset) messageParts.push("NEXT_LEVEL_HAS_PITY_PROTECTION");
  }

  return {
    success,
    cost: finalCost,
    message: messageParts[0], // Message principal pour la localisation
    data: {
      previousLevel: currentLevel,
      newLevel: success ? newLevel : currentLevel,
      newStats,
      pity: owned.enhancementPity || 0,
      pityData,
      guaranteeUsed,
      pityGuaranteeTriggered,
      additionalMessages: messageParts.slice(1) // Messages additionnels
    }
  };
}

export default ForgeEnhancement;

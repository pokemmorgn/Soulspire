import Player from "../models/Player";
import { VipService } from "./VipService";
import { AfkUnlockSystem } from "./AfkUnlockSystem";

export interface AfkReward {
  type: "currency" | "material" | "fragment" | "item";
  currencyType?: "gold" | "gems" | "tickets";
  materialId?: string;
  fragmentId?: string; // heroId for fragments
  itemId?: string;
  quantity: number;
  baseQuantity: number; // avant multiplicateurs
  isNewlyUnlocked?: boolean; // Nouveau flag pour UI
}

export interface AfkRewardsCalculation {
  rewards: AfkReward[];
  multipliers: {
    vip: number;
    stage: number;
    heroes: number;
    total: number;
  };
  ratesPerMinute: {
    gold: number;
    exp: number;
    materials: number;
  };
  maxAccrualHours: number;
  
  // Métadonnées pour le stage selection
  farmingMeta?: {
    isCustomFarming: boolean;
    farmingStage: string;
    effectiveWorld: number;
    effectiveLevel: number;
    effectiveDifficulty: string;
  };

  // Nouvelles métadonnées pour progressive unlocks
  unlockMeta: {
    totalUnlocked: number;
    totalAvailable: number;
    progressPercentage: number;
    recentUnlocks: string[];
    upcomingUnlocks: Array<{
      rewardType: string;
      requirement: string;
      levelsToGo: number;
    }>;
  };
}

export class AfkRewardsService {
  
  // === MÉTHODE PRINCIPALE (ENHANCED AVEC PROGRESSIVE UNLOCKS) ===
  public static async calculatePlayerAfkRewards(playerId: string): Promise<AfkRewardsCalculation> {
    try {
      const player = await Player.findById(playerId)
        .select("world level difficulty heroes vipLevel serverId");
      
      if (!player) {
        throw new Error("Player not found");
      }

      // Vérifier s'il y a un stage de farm custom
      const effectiveStage = await this.getEffectiveFarmingStage(playerId);
      
      // Utiliser le stage effectif pour les calculs
      const targetWorld = effectiveStage.world;
      const targetLevel = effectiveStage.level;
      const targetDifficulty = effectiveStage.difficulty;

      // 1. Calculer les taux de base selon le stage effectif ET les déblocages
      const baseRates = this.calculateBaseRatesWithUnlocks(targetWorld, targetLevel, targetDifficulty);
      
      // 2. Calculer les multiplicateurs (inchangé)
      const multipliers = await this.calculateMultipliers(player);
      
      // 3. Générer les récompenses finales avec déblocages progressifs
      const rewards = this.generateRewardsListWithUnlocks(baseRates, multipliers, {
        ...player.toObject(),
        world: targetWorld,
        level: targetLevel,
        difficulty: targetDifficulty
      });
      
      // 4. Obtenir les métadonnées de déblocage
      const unlockInfo = AfkUnlockSystem.getUnlockInfo(player.world, player.level);
      const upcomingUnlocks = unlockInfo.upcoming.slice(0, 3).map(unlock => ({
        rewardType: unlock.rewardType,
        requirement: unlock.requirement.description,
        levelsToGo: AfkUnlockSystem.getLevelsToUnlock(unlock.rewardType, player.world, player.level).totalLevelsToGo
      }));

      const calculation: AfkRewardsCalculation = {
        rewards,
        multipliers,
        ratesPerMinute: {
          gold: baseRates.goldPerMinute * multipliers.total,
          exp: baseRates.expPerMinute * multipliers.total,
          materials: baseRates.materialsPerMinute * multipliers.total
        },
        maxAccrualHours: this.calculateMaxAccrualHours(player.vipLevel),
        
        // Métadonnées du stage selection
        farmingMeta: {
          isCustomFarming: effectiveStage.isCustom,
          farmingStage: `${targetWorld}-${targetLevel} (${targetDifficulty})`,
          effectiveWorld: targetWorld,
          effectiveLevel: targetLevel,
          effectiveDifficulty: targetDifficulty
        },

        // Nouvelles métadonnées de déblocage progressif
        unlockMeta: {
          totalUnlocked: unlockInfo.totalUnlocked,
          totalAvailable: unlockInfo.totalAvailable,
          progressPercentage: unlockInfo.progressPercentage,
          recentUnlocks: [], // Sera calculé lors de la progression
          upcomingUnlocks
        }
      };

      console.log(`Récompenses AFK calculées: ${unlockInfo.totalUnlocked}/${unlockInfo.totalAvailable} types débloqués (${unlockInfo.progressPercentage}%)`);
      
      return calculation;

    } catch (error: any) {
      console.error("❌ Erreur calculatePlayerAfkRewards:", error);
      throw error;
    }
  }

  // === NOUVELLE MÉTHODE: CALCUL DES TAUX AVEC DÉBLOCAGES ===
  private static calculateBaseRatesWithUnlocks(world: number, level: number, difficulty: string) {
    // Taux de base comme avant
    const worldMultiplier = Math.pow(1.15, world - 1);
    const levelMultiplier = Math.pow(1.05, level - 1);
    
    const difficultyMultiplier: Record<string, number> = {
      "Normal": 1.0,
      "Hard": 1.5,
      "Nightmare": 2.0
    };
    const diffMult = difficultyMultiplier[difficulty] || 1.0;

    // Obtenir les taux de base selon les déblocages
    const baseGoldRate = AfkUnlockSystem.getBaseRate("gold", world, level);
    const baseExpRate = AfkUnlockSystem.getBaseRate("exp", world, level);
    
    // Calculer les taux effectifs
    const goldPerMinute = Math.floor(baseGoldRate * worldMultiplier * levelMultiplier * diffMult);
    const expPerMinute = Math.floor(baseExpRate * worldMultiplier * levelMultiplier * diffMult);
    
    // Matériaux : moyenne des matériaux débloqués
    const unlockedMaterials = AfkUnlockSystem.getUnlockedRewards(world, level)
      .filter(unlock => unlock.category === "material");
    
    const avgMaterialRate = unlockedMaterials.length > 0 ? 
      unlockedMaterials.reduce((sum, mat) => sum + mat.baseRate, 0) / unlockedMaterials.length : 0;
    
    const materialsPerMinute = Math.floor(avgMaterialRate * worldMultiplier * levelMultiplier * diffMult);

    return {
      goldPerMinute,
      expPerMinute,
      materialsPerMinute,
      worldMultiplier,
      levelMultiplier,
      difficultyMultiplier: diffMult,
      unlockedMaterials: unlockedMaterials.length
    };
  }

  // === GÉNÉRATION DE RÉCOMPENSES AVEC DÉBLOCAGES ===
  private static generateRewardsListWithUnlocks(
    baseRates: any, 
    multipliers: any, 
    player: any
  ): AfkReward[] {
    const rewards: AfkReward[] = [];

    // Obtenir toutes les récompenses débloquées
    const unlockedRewards = AfkUnlockSystem.getUnlockedRewards(player.world, player.level);

    // 1. MONNAIES débloquées
    unlockedRewards.filter(unlock => unlock.category === "currency").forEach(unlock => {
      let quantity = 0;
      let baseQuantity = 0;

      switch (unlock.rewardType) {
        case "gold":
          quantity = Math.floor(baseRates.goldPerMinute * multipliers.total);
          baseQuantity = baseRates.goldPerMinute;
          break;
        case "exp":
          // EXP converti en gems pour simplicité
          quantity = Math.floor(baseRates.expPerMinute * multipliers.total * 0.1);
          baseQuantity = Math.floor(baseRates.expPerMinute * 0.1);
          break;
        case "gems":
          const gemsRate = AfkUnlockSystem.getBaseRate("gems", player.world, player.level);
          const progressionMult = AfkUnlockSystem.getProgressionMultiplier("gems", player.world, player.level);
          quantity = Math.floor(gemsRate * multipliers.total * progressionMult);
          baseQuantity = gemsRate;
          break;
        case "tickets":
          if (player.vipLevel >= 2) { // VIP requirement pour tickets
            const ticketsRate = AfkUnlockSystem.getBaseRate("tickets", player.world, player.level);
            const progressionMult = AfkUnlockSystem.getProgressionMultiplier("tickets", player.world, player.level);
            quantity = Math.floor(ticketsRate * multipliers.vip * progressionMult);
            baseQuantity = ticketsRate;
          }
          break;
      }

      if (quantity > 0) {
        rewards.push({
          type: "currency",
          currencyType: unlock.rewardType as "gold" | "gems" | "tickets",
          quantity,
          baseQuantity
        });
      }
    });

    // 2. MATÉRIAUX débloqués
    const unlockedMaterials = unlockedRewards.filter(unlock => unlock.category === "material");
    unlockedMaterials.forEach(unlock => {
      const materialRate = unlock.baseRate;
      const progressionMult = AfkUnlockSystem.getProgressionMultiplier(unlock.rewardType, player.world, player.level);
      const quantity = Math.floor(materialRate * baseRates.materialsPerMinute * multipliers.total * progressionMult / 10);

      if (quantity > 0) {
        rewards.push({
          type: "material",
          materialId: unlock.rewardType,
          quantity,
          baseQuantity: Math.floor(materialRate * baseRates.materialsPerMinute / 10)
        });
      }
    });

    // 3. FRAGMENTS débloqués
    const unlockedFragments = unlockedRewards.filter(unlock => unlock.category === "fragment");
    unlockedFragments.forEach(unlock => {
      const fragmentRate = unlock.baseRate;
      const progressionMult = AfkUnlockSystem.getProgressionMultiplier(unlock.rewardType, player.world, player.level);
      
      // Système de points basé sur la progression pour les fragments
      const fragmentBaseRate = Math.min(0.3, player.world * 0.02 + player.level * 0.001);
      const fragmentPoints = Math.floor(fragmentBaseRate * 100);
      
      if (fragmentPoints > 0) {
        const quantity = Math.floor(fragmentRate * fragmentPoints * multipliers.total * progressionMult / 10);
        
        if (quantity > 0) {
          rewards.push({
            type: "fragment",
            fragmentId: unlock.rewardType,
            quantity,
            baseQuantity: Math.floor(fragmentRate * fragmentPoints / 10)
          });
        }
      }
    });

    return rewards.filter(r => r.quantity > 0);
  }

  // === MÉTHODE POUR DÉTECTER LES NOUVEAUX DÉBLOCAGES ===
  public static async checkForNewUnlocks(
    playerId: string,
    previousWorld: number,
    previousLevel: number
  ): Promise<{
    hasNewUnlocks: boolean;
    newUnlocks: Array<{
      rewardType: string;
      unlockMessage: string;
      category: string;
      rarity: string;
    }>;
  }> {
    try {
      const player = await Player.findById(playerId).select("world level");
      if (!player) {
        return { hasNewUnlocks: false, newUnlocks: [] };
      }

      const recentUnlocks = AfkUnlockSystem.getRecentUnlocks(
        previousWorld, 
        previousLevel, 
        player.world, 
        player.level
      );

      const newUnlocks = recentUnlocks.map(unlock => ({
        rewardType: unlock.rewardType,
        unlockMessage: unlock.requirement.unlockMessage,
        category: unlock.category,
        rarity: unlock.rarity
      }));

      return {
        hasNewUnlocks: newUnlocks.length > 0,
        newUnlocks
      };

    } catch (error) {
      console.error("❌ Erreur checkForNewUnlocks:", error);
      return { hasNewUnlocks: false, newUnlocks: [] };
    }
  }

  // === MÉTHODE POUR L'UI: PREVIEW DES DÉBLOCAGES ===
  public static async getUnlockPreview(playerId: string): Promise<{
    current: {
      unlocked: Array<{
        rewardType: string;
        category: string;
        rarity: string;
        baseRate: number;
        isActive: boolean;
      }>;
      progressPercentage: number;
    };
    upcoming: Array<{
      rewardType: string;
      requirement: string;
      category: string;
      rarity: string;
      levelsToGo: number;
      estimatedReward: string;
    }>;
  }> {
    try {
      const player = await Player.findById(playerId).select("world level");
      if (!player) {
        throw new Error("Player not found");
      }

      const unlockInfo = AfkUnlockSystem.getUnlockInfo(player.world, player.level);
      
      const current = {
        unlocked: unlockInfo.unlocked.map(unlock => ({
          rewardType: unlock.rewardType,
          category: unlock.category,
          rarity: unlock.rarity,
          baseRate: unlock.baseRate,
          isActive: unlock.isActive
        })),
        progressPercentage: unlockInfo.progressPercentage
      };

      const upcoming = unlockInfo.upcoming.map(unlock => {
        const levelsToGo = AfkUnlockSystem.getLevelsToUnlock(unlock.rewardType, player.world, player.level);
        
        // Estimation des récompenses selon le type
        let estimatedReward = "";
        switch (unlock.category) {
          case "currency":
            estimatedReward = unlock.rewardType === "gold" ? "High gold rates" : 
                            unlock.rewardType === "gems" ? "Premium currency" : "Free summons";
            break;
          case "material":
            estimatedReward = `${unlock.baseRate}/min ${unlock.rarity} materials`;
            break;
          case "fragment":
            estimatedReward = `${unlock.rarity} hero fragments`;
            break;
        }

        return {
          rewardType: unlock.rewardType,
          requirement: unlock.requirement.description,
          category: unlock.category,
          rarity: unlock.rarity,
          levelsToGo: levelsToGo.totalLevelsToGo,
          estimatedReward
        };
      });

      return { current, upcoming };

    } catch (error: any) {
      console.error("❌ Erreur getUnlockPreview:", error);
      throw error;
    }
  }

  // === MÉTHODES EXISTANTES CONSERVÉES ===

  private static async getEffectiveFarmingStage(playerId: string): Promise<{
    world: number;
    level: number;
    difficulty: string;
    isCustom: boolean;
  }> {
    try {
      const { getOrCreateForPlayer } = require("../models/AfkFarmingTarget");
      
      const [player, farmingTarget] = await Promise.all([
        Player.findById(playerId).select("world level difficulty"),
        getOrCreateForPlayer(playerId)
      ]);

      if (!player) {
        throw new Error("Player not found");
      }

      if (farmingTarget && farmingTarget.isActive && farmingTarget.isValidStage) {
        return {
          world: farmingTarget.selectedWorld,
          level: farmingTarget.selectedLevel,
          difficulty: farmingTarget.selectedDifficulty,
          isCustom: true
        };
      }

      return {
        world: player.world,
        level: player.level,
        difficulty: player.difficulty,
        isCustom: false
      };

    } catch (error) {
      console.error("❌ Erreur getEffectiveFarmingStage:", error);
      
      const player = await Player.findById(playerId).select("world level difficulty");
      return {
        world: player?.world || 1,
        level: player?.level || 1,
        difficulty: player?.difficulty || "Normal",
        isCustom: false
      };
    }
  }

  private static async calculateMultipliers(player: any) {
    try {
      const vipMultiplier = await VipService.getAfkRewardsMultiplier(player._id.toString(), player.serverId);
      const stageMultiplier = this.calculateStageMultiplier(player.world, player.level);
      const heroesMultiplier = this.calculateHeroesMultiplier(player.heroes);
      const totalMultiplier = vipMultiplier * stageMultiplier * heroesMultiplier;

      return {
        vip: vipMultiplier,
        stage: stageMultiplier,
        heroes: heroesMultiplier,
        total: totalMultiplier
      };

    } catch (error) {
      console.error("❌ Erreur calculateMultipliers:", error);
      return {
        vip: 1.0,
        stage: 1.0,
        heroes: 1.0,
        total: 1.0
      };
    }
  }

  private static calculateStageMultiplier(world: number, level: number): number {
    const totalStages = (world - 1) * 30 + level;
    
    if (totalStages < 50) return 1.0;
    if (totalStages < 100) return 1.2;
    if (totalStages < 200) return 1.5;
    if (totalStages < 300) return 2.0;
    if (totalStages < 500) return 3.0;
    return 5.0;
  }

  private static calculateHeroesMultiplier(heroes: any[]): number {
    if (!heroes || heroes.length === 0) return 0.5;

    const equippedHeroes = heroes.filter(h => h.equipped && h.slot);
    if (equippedHeroes.length === 0) return 0.5;

    let totalPower = 0;
    equippedHeroes.forEach(hero => {
      const heroPower = hero.level * hero.stars;
      totalPower += heroPower;
    });

    const avgPower = totalPower / equippedHeroes.length;
    
    if (avgPower < 50) return 0.8;
    if (avgPower < 100) return 1.0;
    if (avgPower < 200) return 1.3;
    if (avgPower < 500) return 1.6;
    return 2.0;
  }

  private static calculateMaxAccrualHours(vipLevel: number): number {
    let baseHours = 12;
    
    if (vipLevel >= 3) baseHours += 2;
    if (vipLevel >= 6) baseHours += 2;
    if (vipLevel >= 9) baseHours += 4;
    if (vipLevel >= 12) baseHours += 4;
    
    return baseHours;
  }

  // === MÉTHODES PUBLIQUES CONSERVÉES ===

  public static async applyAfkRewards(
    playerId: string, 
    rewards: AfkReward[], 
    multipliedByTime: number = 1
  ): Promise<void> {
    try {
      const player = await Player.findById(playerId);
      if (!player) throw new Error("Player not found");

      for (const reward of rewards) {
        const finalQuantity = Math.floor(reward.quantity * multipliedByTime);
        
        switch (reward.type) {
          case "currency":
            switch (reward.currencyType) {
              case "gold":
                player.gold += finalQuantity;
                break;
              case "gems":
                player.gems += finalQuantity;
                break;
              case "tickets":
                player.tickets += finalQuantity;
                break;
            }
            break;

          case "material":
            if (reward.materialId) {
              const current = player.materials.get(reward.materialId) || 0;
              player.materials.set(reward.materialId, current + finalQuantity);
            }
            break;

          case "fragment":
            if (reward.fragmentId) {
              const current = player.fragments.get(reward.fragmentId) || 0;
              player.fragments.set(reward.fragmentId, current + finalQuantity);
            }
            break;

          case "item":
            console.log(`📦 Objet AFK reçu: ${reward.itemId} x${finalQuantity}`);
            break;
        }
      }

      await player.save();
      console.log(`✅ Récompenses AFK appliquées pour ${player.username}`);

    } catch (error: any) {
      console.error("❌ Erreur applyAfkRewards:", error);
      throw error;
    }
  }

  public static async getAfkSummaryForPlayer(playerId: string): Promise<{
    canClaim: boolean;
    pendingRewards: AfkReward[];
    timeAccumulated: number;
    maxAccrualTime: number;
    multipliers: any;
    nextRewardIn: number;
    farmingMeta?: any;
    unlockMeta?: any; // Nouveau
  }> {
    try {
      const calculation = await this.calculatePlayerAfkRewards(playerId);
      
      const timeAccumulated = 0;
      const maxAccrualTime = calculation.maxAccrualHours * 3600;
      
      return {
        canClaim: timeAccumulated > 0,
        pendingRewards: calculation.rewards,
        timeAccumulated,
        maxAccrualTime,
        multipliers: calculation.multipliers,
        nextRewardIn: 60,
        farmingMeta: calculation.farmingMeta,
        unlockMeta: calculation.unlockMeta // Nouvelles métadonnées
      };

    } catch (error: any) {
      console.error("❌ Erreur getAfkSummaryForPlayer:", error);
      throw error;
    }
  }

  // Autres méthodes publiques (simulateAfkGains, etc.) conservées telles quelles...
  // [Les autres méthodes restent identiques à la version précédente]
}

import Player from "../models/Player";
import { VipService } from "./VipService";
import { AfkUnlockSystem } from "./AfkUnlockSystem";
import { 
  calculateAfkRewardPerMinute, 
  getAfkRewardsUnlockSummary,
  DEBUG_UNLOCK_ALL_AT_WORLD_1 
} from "../config/afkRewardsConfig";

export interface AfkReward {
  type: "currency" | "material" | "fragment" | "item";
  currencyType?: "gold" | "gems" | "tickets" | "heroXP" | "ascensionEssences"; 
  materialId?: string;
  fragmentId?: string; // heroId for fragments
  itemId?: string;
  quantity: number;
  baseQuantity: number; // avant multiplicateurs
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
  
  // Nouvelles métadonnées pour le stage selection
  farmingMeta?: {
    isCustomFarming: boolean;
    farmingStage: string;
    effectiveWorld: number;
    effectiveLevel: number;
    effectiveDifficulty: string;
  };

  // Nouvelles métadonnées pour progressive unlocks
  unlockMeta?: {
    unlockedRewardsCount: number;
    totalRewardsAvailable: number;
    progressPercentage: number;
    recentUnlocks: string[];
    nextUnlocks: string[];
  };
}

export class AfkRewardsService {
  
  // === MÉTHODE PRINCIPALE (ENHANCED AVEC STAGE SELECTION + PROGRESSIVE UNLOCKS) ===
  public static async calculatePlayerAfkRewards(playerId: string): Promise<AfkRewardsCalculation> {
    try {
      const player = await Player.findOne({ playerId: playerId })
      .select("world level difficulty heroes vipLevel serverId");
      
      if (!player) {
        throw new Error("Player not found");
      }

      // VÉRIFIER S'IL Y A UN STAGE DE FARM CUSTOM
      const effectiveStage = await this.getEffectiveFarmingStage(playerId);
      
      // Utiliser le stage effectif (custom ou progression) pour les calculs
      const targetWorld = effectiveStage.world;
      const targetLevel = effectiveStage.level;
      const targetDifficulty = effectiveStage.difficulty;

      // 1. Calculer les taux de base selon le stage effectif + déblocages progressifs
      const baseRates = this.calculateBaseRatesWithUnlocks(
        targetWorld, 
        targetLevel, 
        targetDifficulty, 
        player.world, 
        player.level
      );
      
      // 2. Calculer les multiplicateurs (inchangé)
      const multipliers = await this.calculateMultipliers(player);
      
      // 3. Générer les récompenses finales avec stage effectif + filtrage déblocages
      const allRewards = this.generateRewardsList(baseRates, multipliers, {
        ...player.toObject(),
        world: targetWorld,
        level: targetLevel,
        difficulty: targetDifficulty
      });

      // 4. NOUVEAU : Filtrer selon déblocages progressifs
      const unlockedRewards = AfkUnlockSystem.filterRewardsByUnlocks(
        allRewards, 
        player.world, 
        player.level
      );

      // 5. Obtenir métadonnées des déblocages
      const unlockInfo = AfkUnlockSystem.getUnlockInfo(player.world, player.level);
      
      const calculation: AfkRewardsCalculation = {
        rewards: unlockedRewards, // Seulement les récompenses débloquées
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

        // NOUVEAU : Métadonnées des déblocages progressifs
        unlockMeta: {
          unlockedRewardsCount: unlockInfo.unlocked.length,
          totalRewardsAvailable: unlockInfo.totalAvailable,
          progressPercentage: unlockInfo.progressPercentage,
          recentUnlocks: [], // À remplir si on track la progression
          nextUnlocks: unlockInfo.upcoming.slice(0, 3).map(u => 
            `${u.rewardType} (${u.requirement.description})`
          )
        }
      };

      if (effectiveStage.isCustom) {
        console.log(`Récompenses AFK calculées avec stage custom: ${calculation.farmingMeta!.farmingStage}`);
      }
      
      console.log(`Déblocages: ${unlockInfo.unlocked.length}/${unlockInfo.totalAvailable} (${unlockInfo.progressPercentage}%)`);
      
      return calculation;

    } catch (error: any) {
      console.error("Erreur calculatePlayerAfkRewards:", error);
      throw error;
    }
  }

  // === NOUVELLE MÉTHODE: CALCUL DES TAUX AVEC DÉBLOCAGES PROGRESSIFS ===
  private static calculateBaseRatesWithUnlocks(
    world: number, 
    level: number, 
    difficulty: string,
    playerWorld: number,
    playerLevel: number
  ) {
    // Calcul standard des taux
    const baseRates = this.calculateBaseRates(world, level, difficulty);
    
    // NOUVEAU : Appliquer les déblocages progressifs
    const unlockedRates = AfkUnlockSystem.getAllBaseRates(playerWorld, playerLevel);
    
    // Ajuster les taux selon ce qui est débloqué
    const adjustedRates = {
      goldPerMinute: unlockedRates.gold > 0 ? baseRates.goldPerMinute : 0,
      expPerMinute: unlockedRates.exp > 0 ? baseRates.expPerMinute : 0,
      materialsPerMinute: this.calculateMaterialsRate(unlockedRates, baseRates.materialsPerMinute),
      worldMultiplier: baseRates.worldMultiplier,
      levelMultiplier: baseRates.levelMultiplier,
      difficultyMultiplier: baseRates.difficultyMultiplier
    };

    return adjustedRates;
  }

  // === CALCUL DES MATÉRIAUX SELON DÉBLOCAGES ===
  private static calculateMaterialsRate(unlockedRates: Record<string, number>, baseMaterialsRate: number): number {
    // Calculer le taux de matériaux selon ce qui est débloqué
    const materialTypes = ["fusion_crystal", "elemental_essence", "ascension_stone", "divine_crystal"];
    const unlockedMaterials = materialTypes.filter(type => unlockedRates[type] > 0);
    
    if (unlockedMaterials.length === 0) return 0;
    
    // Répartir le taux de base sur les matériaux débloqués
    return baseMaterialsRate * (unlockedMaterials.length / materialTypes.length);
  }

  // === MÉTHODE EXISTANTE ÉTENDUE : OBTENIR LE STAGE EFFECTIF ===
  private static async getEffectiveFarmingStage(playerId: string): Promise<{
    world: number;
    level: number;
    difficulty: string;
    isCustom: boolean;
  }> {
    try {
      // Import dynamique pour éviter dépendances circulaires
      const { getOrCreateForPlayer } = require("../models/AfkFarmingTarget");
      
      const [player, farmingTarget] = await Promise.all([
       Player.findOne({ playerId: playerId }).select("world level difficulty"),
        getOrCreateForPlayer(playerId)
      ]);

      if (!player) {
        throw new Error("Player not found");
      }

      // Si le farm custom est actif ET valide, l'utiliser
      if (farmingTarget && farmingTarget.isActive && farmingTarget.isValidStage) {
        return {
          world: farmingTarget.selectedWorld,
          level: farmingTarget.selectedLevel,
          difficulty: farmingTarget.selectedDifficulty,
          isCustom: true
        };
      }

      // Sinon, utiliser le stage de progression
      return {
        world: player.world,
        level: player.level,
        difficulty: player.difficulty,
        isCustom: false
      };

    } catch (error) {
      console.error("Erreur getEffectiveFarmingStage:", error);
      
      // Fallback sécurisé
      const player = await Player.findOne({ playerId: playerId }).select("world level difficulty");
      return {
        world: player?.world || 1,
        level: player?.level || 1,
        difficulty: player?.difficulty || "Normal",
        isCustom: false
      };
    }
  }

  // === TAUX DE BASE SELON LA PROGRESSION ===
  private static calculateBaseRates(world: number, level: number, difficulty: string) {
    // Progression exponentielle comme AFK Arena
    const worldMultiplier = Math.pow(1.15, world - 1); // +15% par monde
    const levelMultiplier = Math.pow(1.05, level - 1);  // +5% par niveau
    
    // Bonus de difficulté
    const difficultyMultiplier: Record<string, number> = {
      "Normal": 1.0,
      "Hard": 1.5,
      "Nightmare": 2.0
    };
    const diffMult = difficultyMultiplier[difficulty] || 1.0;

    const baseGold = 100; // Gold de base monde 1 niveau 1
    const baseExp = 50;   // EXP de base
    const baseMaterials = 10; // Matériaux de base

    return {
      goldPerMinute: Math.floor(baseGold * worldMultiplier * levelMultiplier * diffMult),
      expPerMinute: Math.floor(baseExp * worldMultiplier * levelMultiplier * diffMult),
      materialsPerMinute: Math.floor(baseMaterials * worldMultiplier * levelMultiplier * diffMult),
      worldMultiplier,
      levelMultiplier,
      difficultyMultiplier: diffMult
    };
  }

  // === CALCUL DES MULTIPLICATEURS ===
  private static async calculateMultipliers(player: any) {
    try {
      // 1. Multiplicateur VIP
      const vipMultiplier = await VipService.getAfkRewardsMultiplier(player._id.toString(), player.serverId);
      
      // 2. Multiplicateur de stage (progression)
      const stageMultiplier = this.calculateStageMultiplier(player.world, player.level);
      
      // 3. Multiplicateur d'équipe (héros équipés)
      const heroesMultiplier = this.calculateHeroesMultiplier(player.heroes);
      
      // 4. Multiplicateur total
      const totalMultiplier = vipMultiplier * stageMultiplier * heroesMultiplier;

      return {
        vip: vipMultiplier,
        stage: stageMultiplier,
        heroes: heroesMultiplier,
        total: totalMultiplier
      };

    } catch (error) {
      console.error("Erreur calculateMultipliers:", error);
      return {
        vip: 1.0,
        stage: 1.0,
        heroes: 1.0,
        total: 1.0
      };
    }
  }

  // === MULTIPLICATEUR DE STAGE ===
  private static calculateStageMultiplier(world: number, level: number): number {
    // Plus on progresse, plus les récompenses AFK sont importantes
    const totalStages = (world - 1) * 30 + level; // Estimation stages totaux
    
    if (totalStages < 50) return 1.0;
    if (totalStages < 100) return 1.2;
    if (totalStages < 200) return 1.5;
    if (totalStages < 300) return 2.0;
    if (totalStages < 500) return 3.0;
    return 5.0; // End-game
  }

  // === MULTIPLICATEUR D'ÉQUIPE ===
  private static calculateHeroesMultiplier(heroes: any[]): number {
    if (!heroes || heroes.length === 0) return 0.5; // Pas d'équipe = pénalité

    const equippedHeroes = heroes.filter(h => h.equipped && h.slot);
    if (equippedHeroes.length === 0) return 0.5;

    // Calcul basé sur la puissance de l'équipe
    let totalPower = 0;
    equippedHeroes.forEach(hero => {
      // Calcul simple de puissance : niveau × étoiles
      const heroPower = hero.level * hero.stars;
      totalPower += heroPower;
    });

    // Multiplicateur basé sur la puissance totale
    const avgPower = totalPower / equippedHeroes.length;
    
    if (avgPower < 50) return 0.8;
    if (avgPower < 100) return 1.0;
    if (avgPower < 200) return 1.3;
    if (avgPower < 500) return 1.6;
    return 2.0;
  }

  // === GÉNÉRATION DE LA LISTE DES RÉCOMPENSES (ENHANCED AVEC PROGRESSIVE UNLOCKS) ===
 private static generateRewardsList(
  baseRates: any, 
  multipliers: any, 
  player: any
): AfkReward[] {
  const rewards: AfkReward[] = [];

  // 1. OR (toujours présent si débloqué)
  if (AfkUnlockSystem.isRewardUnlocked("gold", player.world, player.level)) {
    const goldMultiplier = AfkUnlockSystem.getProgressionMultiplier("gold", player.world, player.level);
    rewards.push({
      type: "currency",
      currencyType: "gold",
      quantity: Math.floor(baseRates.goldPerMinute * multipliers.total * goldMultiplier),
      baseQuantity: baseRates.goldPerMinute
    });
  }

  // 2. EXP (si débloqué et niveau < 100)
  if (player.level < 100 && AfkUnlockSystem.isRewardUnlocked("exp", player.world, player.level)) {
    const expMultiplier = AfkUnlockSystem.getProgressionMultiplier("exp", player.world, player.level);
    rewards.push({
      type: "currency",
      currencyType: "gems", // On utilise gems comme EXP pour simplifier
      quantity: Math.floor(baseRates.expPerMinute * multipliers.total * 0.1 * expMultiplier),
      baseQuantity: Math.floor(baseRates.expPerMinute * 0.1)
    });
  }

  // 3. GEMS (si débloqué)
  if (AfkUnlockSystem.isRewardUnlocked("gems", player.world, player.level)) {
    const gemsRate = AfkUnlockSystem.getBaseRate("gems", player.world, player.level);
    const gemsMultiplier = AfkUnlockSystem.getProgressionMultiplier("gems", player.world, player.level);
    rewards.push({
      type: "currency",
      currencyType: "gems",
      quantity: Math.floor(gemsRate * multipliers.total * gemsMultiplier),
      baseQuantity: gemsRate
    });
  }

  // ✅ 4. HERO XP (si débloqué) - NOUVEAU
  const heroXPCalc = calculateAfkRewardPerMinute("heroXP", player.world, player.level, player.vipLevel || 0, player.difficulty || "Normal");
  if (heroXPCalc.isUnlocked && heroXPCalc.finalRate > 0) {
    rewards.push({
      type: "currency",
      currencyType: "heroXP",
      quantity: heroXPCalc.finalRate,
      baseQuantity: heroXPCalc.baseRate
    });
  }

  // ✅ 5. ASCENSION ESSENCES (si débloqué) - NOUVEAU  
  const essencesCalc = calculateAfkRewardPerMinute("ascensionEssences", player.world, player.level, player.vipLevel || 0, player.difficulty || "Normal");
  if (essencesCalc.isUnlocked && essencesCalc.finalRate > 0) {
    rewards.push({
      type: "currency",
      currencyType: "ascensionEssences", 
      quantity: essencesCalc.finalRate,
      baseQuantity: essencesCalc.baseRate
    });
  }

  // 6. TICKETS (si débloqué et VIP 2+)
  if (player.vipLevel >= 2 && AfkUnlockSystem.isRewardUnlocked("tickets", player.world, player.level)) {
    const ticketsRate = AfkUnlockSystem.getBaseRate("tickets", player.world, player.level);
    const ticketsMultiplier = AfkUnlockSystem.getProgressionMultiplier("tickets", player.world, player.level);
    rewards.push({
      type: "currency",
      currencyType: "tickets",
      quantity: Math.floor(ticketsRate * multipliers.vip * ticketsMultiplier),
      baseQuantity: ticketsRate
    });
  }

  // 7. MATÉRIAUX (selon déblocages progressifs)
  const materialRewards = this.getMaterialsForWorldWithUnlocks(
    player.world, 
    player.level, 
    baseRates.materialsPerMinute, 
    multipliers.total
  );
  rewards.push(...materialRewards);

  // 8. FRAGMENTS DE HÉROS (selon déblocages progressifs)
  const fragmentRewards = this.getFragmentRewardsWithUnlocks(
    player.world, 
    player.level, 
    multipliers.total
  );
  rewards.push(...fragmentRewards);

  return rewards.filter(r => r.quantity > 0);
}

  // === MATÉRIAUX AVEC DÉBLOCAGES PROGRESSIFS ===
  private static getMaterialsForWorldWithUnlocks(
    playerWorld: number, 
    playerLevel: number, 
    baseMaterials: number, 
    totalMultiplier: number
  ): AfkReward[] {
    const materials: AfkReward[] = [];

    // Fusion Crystals
    if (AfkUnlockSystem.isRewardUnlocked("fusion_crystal", playerWorld, playerLevel)) {
      const multiplier = AfkUnlockSystem.getProgressionMultiplier("fusion_crystal", playerWorld, playerLevel);
      materials.push({
        type: "material",
        materialId: "fusion_crystal",
        quantity: Math.floor(baseMaterials * totalMultiplier * 0.8 * multiplier),
        baseQuantity: Math.floor(baseMaterials * 0.8)
      });
    }

    // Elemental Essence
    if (AfkUnlockSystem.isRewardUnlocked("elemental_essence", playerWorld, playerLevel)) {
      const multiplier = AfkUnlockSystem.getProgressionMultiplier("elemental_essence", playerWorld, playerLevel);
      materials.push({
        type: "material",
        materialId: "elemental_essence",
        quantity: Math.floor(baseMaterials * totalMultiplier * 0.3 * multiplier),
        baseQuantity: Math.floor(baseMaterials * 0.3)
      });
    }

    // Ascension Stones
    if (AfkUnlockSystem.isRewardUnlocked("ascension_stone", playerWorld, playerLevel)) {
      const multiplier = AfkUnlockSystem.getProgressionMultiplier("ascension_stone", playerWorld, playerLevel);
      materials.push({
        type: "material",
        materialId: "ascension_stone",
        quantity: Math.floor(baseMaterials * totalMultiplier * 0.1 * multiplier),
        baseQuantity: Math.floor(baseMaterials * 0.1)
      });
    }

    // Divine Crystals
    if (AfkUnlockSystem.isRewardUnlocked("divine_crystal", playerWorld, playerLevel)) {
      const multiplier = AfkUnlockSystem.getProgressionMultiplier("divine_crystal", playerWorld, playerLevel);
      materials.push({
        type: "material",
        materialId: "divine_crystal",
        quantity: Math.floor(baseMaterials * totalMultiplier * 0.05 * multiplier),
        baseQuantity: Math.floor(baseMaterials * 0.05)
      });
    }

    return materials;
  }

  // === FRAGMENTS AVEC DÉBLOCAGES PROGRESSIFS ===
  private static getFragmentRewardsWithUnlocks(
    playerWorld: number, 
    playerLevel: number, 
    totalMultiplier: number
  ): AfkReward[] {
    const fragments: AfkReward[] = [];

    // Chance de fragments selon la progression (déterministe)
    const fragmentBaseRate = Math.min(0.3, playerWorld * 0.02 + playerLevel * 0.001);
    const fragmentPoints = Math.floor(fragmentBaseRate * 100);
    
    if (fragmentPoints <= 0) return fragments;

    // Héros communs
    if (AfkUnlockSystem.isRewardUnlocked("common_hero_fragments", playerWorld, playerLevel)) {
      const multiplier = AfkUnlockSystem.getProgressionMultiplier("common_hero_fragments", playerWorld, playerLevel);
      const commonQuantity = Math.floor((fragmentPoints * 0.6) * totalMultiplier * multiplier / 10);
      if (commonQuantity > 0) {
        fragments.push({
          type: "fragment",
          fragmentId: "common_hero_fragments",
          quantity: commonQuantity,
          baseQuantity: Math.floor(fragmentPoints * 0.6 / 10)
        });
      }
    }

    // Héros rares
    if (fragmentPoints >= 15 && AfkUnlockSystem.isRewardUnlocked("rare_hero_fragments", playerWorld, playerLevel)) {
      const multiplier = AfkUnlockSystem.getProgressionMultiplier("rare_hero_fragments", playerWorld, playerLevel);
      const rareQuantity = Math.floor((fragmentPoints * 0.3) * totalMultiplier * multiplier / 15);
      if (rareQuantity > 0) {
        fragments.push({
          type: "fragment",
          fragmentId: "rare_hero_fragments",
          quantity: rareQuantity,
          baseQuantity: Math.floor(fragmentPoints * 0.3 / 15)
        });
      }
    }

    // Héros épiques
    if (fragmentPoints >= 25 && AfkUnlockSystem.isRewardUnlocked("epic_hero_fragments", playerWorld, playerLevel)) {
      const multiplier = AfkUnlockSystem.getProgressionMultiplier("epic_hero_fragments", playerWorld, playerLevel);
      const epicQuantity = Math.floor((fragmentPoints * 0.1) * totalMultiplier * multiplier / 25);
      if (epicQuantity > 0) {
        fragments.push({
          type: "fragment",
          fragmentId: "epic_hero_fragments",
          quantity: epicQuantity,
          baseQuantity: Math.floor(fragmentPoints * 0.1 / 25)
        });
      }
    }

    // Héros légendaires
    if (fragmentPoints >= 40 && AfkUnlockSystem.isRewardUnlocked("legendary_hero_fragments", playerWorld, playerLevel)) {
      const multiplier = AfkUnlockSystem.getProgressionMultiplier("legendary_hero_fragments", playerWorld, playerLevel);
      const legendaryQuantity = Math.floor((fragmentPoints * 0.05) * totalMultiplier * multiplier / 40);
      if (legendaryQuantity > 0) {
        fragments.push({
          type: "fragment",
          fragmentId: "legendary_hero_fragments",
          quantity: legendaryQuantity,
          baseQuantity: Math.floor(fragmentPoints * 0.05 / 40)
        });
      }
    }

    return fragments.filter(f => f.quantity > 0);
  }

  // === NOUVELLES MÉTHODES POUR PROGRESSIVE UNLOCKS ===

  /**
   * Vérifier si un joueur a débloqué de nouvelles récompenses récemment
   */
  public static async checkForNewUnlocks(
    playerId: string,
    previousWorld: number,
    previousLevel: number
  ): Promise<{
    hasNewUnlocks: boolean;
    newUnlocks: string[];
    unlockMessages: string[];
  }> {
    try {
      const player = await Player.findOne({ playerId: playerId }).select("world level");
      if (!player) throw new Error("Player not found");

      const recentUnlocks = AfkUnlockSystem.getRecentUnlocks(
        previousWorld,
        previousLevel,
        player.world,
        player.level
      );

      return {
        hasNewUnlocks: recentUnlocks.length > 0,
        newUnlocks: recentUnlocks.map(u => u.rewardType),
        unlockMessages: recentUnlocks.map(u => u.requirement.unlockMessage)
      };
    } catch (error: any) {
      console.error("Erreur checkForNewUnlocks:", error);
      return { hasNewUnlocks: false, newUnlocks: [], unlockMessages: [] };
    }
  }

  /**
   * Obtenir un aperçu des déblocages pour l'UI
   */
  public static async getUnlockPreview(playerId: string): Promise<{
    current: any;
    upcoming: any[];
    progressPercentage: number;
  }> {
    try {
      const player = await Player.findOne({ playerId: playerId }).select("world level");
      if (!player) throw new Error("Player not found");

      const unlockInfo = AfkUnlockSystem.getUnlockInfo(player.world, player.level);

      return {
        current: {
          unlockedCount: unlockInfo.unlocked.length,
          totalAvailable: unlockInfo.totalAvailable,
          latestUnlocks: unlockInfo.unlocked.slice(-3).map(u => u.rewardType)
        },
        upcoming: unlockInfo.upcoming.map(u => ({
          rewardType: u.rewardType,
          requirement: u.requirement.description,
          levelsToGo: AfkUnlockSystem.getLevelsToUnlock(u.rewardType, player.world, player.level).totalLevelsToGo
        })),
        progressPercentage: unlockInfo.progressPercentage
      };
    } catch (error: any) {
      console.error("Erreur getUnlockPreview:", error);
      throw error;
    }
  }

  // === DURÉE MAXIMALE D'ACCUMULATION ===
  private static calculateMaxAccrualHours(vipLevel: number): number {
    // Base : 12h comme AFK Arena
    let baseHours = 12;
    
    // Bonus VIP
    if (vipLevel >= 3) baseHours += 2;  // +2h à VIP 3
    if (vipLevel >= 6) baseHours += 2;  // +2h à VIP 6
    if (vipLevel >= 9) baseHours += 4;  // +4h à VIP 9
    if (vipLevel >= 12) baseHours += 4; // +4h à VIP 12
    
    return baseHours; // Max 24h
  }

  // === APPLIQUER LES RÉCOMPENSES AU JOUEUR ===
  public static async applyAfkRewards(
    playerId: string, 
    rewards: AfkReward[], 
    multipliedByTime: number = 1
  ): Promise<void> {
    try {
      const player = await Player.findOne({ playerId: playerId });
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
            console.log(`Objet AFK reçu: ${reward.itemId} x${finalQuantity}`);
            break;
        }
      }

      await player.save();
      console.log(`Récompenses AFK appliquées pour ${player.displayName}`);

    } catch (error: any) {
      console.error("Erreur applyAfkRewards:", error);
      throw error;
    }
  }

  // === RÉSUMÉ POUR L'UI (ENHANCED) ===
  public static async getAfkSummaryForPlayer(playerId: string): Promise<{
    canClaim: boolean;
    pendingRewards: AfkReward[];
    timeAccumulated: number;
    maxAccrualTime: number;
    multipliers: any;
    nextRewardIn: number;
    farmingMeta?: any;
    unlockMeta?: any; // NOUVEAU
  }> {
    try {
      const calculation = await this.calculatePlayerAfkRewards(playerId);
      
      const timeAccumulated = 0; // À récupérer depuis AfkState
      const maxAccrualTime = calculation.maxAccrualHours * 3600; // en secondes
      
      return {
        canClaim: timeAccumulated > 0,
        pendingRewards: calculation.rewards,
        timeAccumulated,
        maxAccrualTime,
        multipliers: calculation.multipliers,
        nextRewardIn: 60, // 1 minute pour le prochain tick
        farmingMeta: calculation.farmingMeta,
        unlockMeta: calculation.unlockMeta // NOUVEAU
      };

    } catch (error: any) {
      console.error("Erreur getAfkSummaryForPlayer:", error);
      throw error;
    }
  }

  // === NOUVELLES MÉTHODES UTILITAIRES (ENHANCED) ===

  // Calculer les récompenses pour une durée spécifique (en minutes)
  public static async calculateRewardsForDuration(
    playerId: string, 
    durationMinutes: number
  ): Promise<AfkReward[]> {
    try {
      const calculation = await this.calculatePlayerAfkRewards(playerId);
      
      return calculation.rewards.map(reward => ({
        ...reward,
        quantity: Math.floor(reward.quantity * durationMinutes),
        baseQuantity: reward.baseQuantity
      })).filter(r => r.quantity > 0);

    } catch (error: any) {
      console.error("Erreur calculateRewardsForDuration:", error);
      return [];
    }
  }

  // Simuler les gains pour X heures (pour l'UI) - ENHANCED
  public static async simulateAfkGains(
    playerId: string, 
    hours: number
  ): Promise<{
    rewards: AfkReward[];
    totalValue: number;
    cappedAt: number; // En heures si atteint le cap
    farmingMeta?: any;
    unlockMeta?: any; // NOUVEAU
  }> {
    try {
      const calculation = await this.calculatePlayerAfkRewards(playerId);
      const requestedMinutes = hours * 60;
      const maxMinutes = calculation.maxAccrualHours * 60;
      
      const effectiveMinutes = Math.min(requestedMinutes, maxMinutes);
      const cappedAt = effectiveMinutes < requestedMinutes ? calculation.maxAccrualHours : hours;
      
      const rewards = calculation.rewards.map(reward => ({
        ...reward,
        quantity: Math.floor(reward.quantity * effectiveMinutes),
        baseQuantity: reward.baseQuantity
      })).filter(r => r.quantity > 0);

      // Calculer valeur totale
      let totalValue = 0;
      rewards.forEach(reward => {
        switch (reward.type) {
          case "currency":
            if (reward.currencyType === "gold") totalValue += reward.quantity * 0.001;
            else if (reward.currencyType === "gems") totalValue += reward.quantity * 1;
            else if (reward.currencyType === "tickets") totalValue += reward.quantity * 5;
            break;
          case "material":
            totalValue += reward.quantity * 2;
            break;
          case "fragment":
            totalValue += reward.quantity * 10;
            break;
        }
      });

      return {
        rewards,
        totalValue: Math.round(totalValue),
        cappedAt,
        farmingMeta: calculation.farmingMeta,
        unlockMeta: calculation.unlockMeta // NOUVEAU
      };

    } catch (error: any) {
      console.error("Erreur simulateAfkGains:", error);
      return { rewards: [], totalValue: 0, cappedAt: hours };
    }
  }

  // Obtenir les taux actuels d'un joueur (pour l'UI) - ENHANCED
  public static async getPlayerCurrentRates(playerId: string): Promise<{
    ratesPerMinute: {
      gold: number;
      gems: number;
      tickets: number;
      materials: number;
    };
    multipliers: {
      vip: number;
      stage: number;
      heroes: number;
      total: number;
    };
    maxAccrualHours: number;
    progression: {
      world: number;
      level: number;
      difficulty: string;
      totalStages: number;
    };
    farmingMeta?: any;
    unlockMeta?: any; // NOUVEAU
  }> {
    try {
const player = await Player.findOne({ playerId: playerId })
  .select("world level difficulty heroes vipLevel serverId");
      
      if (!player) {
        throw new Error("Player not found");
      }

      const calculation = await this.calculatePlayerAfkRewards(playerId);
      
      return {
        ratesPerMinute: {
          gold: calculation.ratesPerMinute.gold,
          gems: calculation.ratesPerMinute.exp,
          tickets: player.vipLevel >= 2 ? Math.floor(0.5 * calculation.multipliers.vip) : 0,
          materials: calculation.ratesPerMinute.materials
        },
        multipliers: calculation.multipliers,
        maxAccrualHours: calculation.maxAccrualHours,
        progression: {
          world: player.world,
          level: player.level,
          difficulty: player.difficulty,
          totalStages: (player.world - 1) * 30 + player.level
        },
        farmingMeta: calculation.farmingMeta,
        unlockMeta: calculation.unlockMeta // NOUVEAU
      };

    } catch (error: any) {
      console.error("Erreur getPlayerCurrentRates:", error);
      throw error;
    }
  }

  // Comparer les gains avant/après upgrade (pour motiver l'upgrade) - ENHANCED
  public static async compareUpgradeGains(playerId: string): Promise<{
    current: any;
    afterWorldUp: any;
    afterLevelUp: any;
    afterVipUp: any;
    improvement: {
      worldUp: number; // % d'amélioration
      levelUp: number;
      vipUp: number;
    };
    farmingMeta?: any;
    unlockMeta?: any; // NOUVEAU
  }> {
    try {
const player = await Player.findById(playerId)
  .select("world level difficulty heroes vipLevel serverId");
      
      if (!player) {
        throw new Error("Player not found");
      }

      // Calcul actuel
      const current = await this.calculatePlayerAfkRewards(playerId);
      
      // Simulation world +1
      const tempWorld = { ...player.toObject(), world: player.world + 1 };
      const afterWorldUp = this.calculateBaseRatesWithUnlocks(
        tempWorld.world, tempWorld.level, tempWorld.difficulty,
        tempWorld.world, tempWorld.level
      );
      const worldMultipliers = await this.calculateMultipliers(tempWorld);
      
      // Simulation level +5
      const tempLevel = { ...player.toObject(), level: player.level + 5 };
      const afterLevelUp = this.calculateBaseRatesWithUnlocks(
        tempLevel.world, tempLevel.level, tempLevel.difficulty,
        tempLevel.world, tempLevel.level
      );
      const levelMultipliers = await this.calculateMultipliers(tempLevel);
      
      // Simulation VIP +1
      const tempVip = { ...player.toObject(), vipLevel: player.vipLevel + 1 };
      const vipMultipliers = await this.calculateMultipliers(tempVip);
      
      // Calculer améliorations
      const currentGold = current.ratesPerMinute.gold;
      const worldGold = afterWorldUp.goldPerMinute * worldMultipliers.total;
      const levelGold = afterLevelUp.goldPerMinute * levelMultipliers.total;
      const vipGold = current.ratesPerMinute.gold * (vipMultipliers.total / current.multipliers.total);
      
      return {
        current: {
          goldPerMinute: currentGold,
          multipliers: current.multipliers
        },
        afterWorldUp: {
          goldPerMinute: worldGold,
          multipliers: worldMultipliers
        },
        afterLevelUp: {
          goldPerMinute: levelGold,
          multipliers: levelMultipliers
        },
        afterVipUp: {
          goldPerMinute: vipGold,
          multipliers: vipMultipliers
        },
        improvement: {
          worldUp: Math.round(((worldGold / currentGold) - 1) * 100),
          levelUp: Math.round(((levelGold / currentGold) - 1) * 100),
          vipUp: Math.round(((vipGold / currentGold) - 1) * 100)
        },
        farmingMeta: current.farmingMeta,
        unlockMeta: current.unlockMeta // NOUVEAU
      };

    } catch (error: any) {
      console.error("Erreur compareUpgradeGains:", error);
      throw error;
    }
  }

  // === NOUVELLE MÉTHODE: FORCER RECALCUL AVEC STAGE SPÉCIFIQUE (ENHANCED) ===
  public static async calculateRewardsForSpecificStage(
    playerId: string,
    world: number,
    level: number,
    difficulty: string
  ): Promise<AfkRewardsCalculation> {
    try {
      const player = await Player.findById(playerId)
        .select("world level heroes vipLevel serverId");
      
      if (!player) {
        throw new Error("Player not found");
      }

      // Calculer directement pour le stage spécifié AVEC déblocages progressifs
      const baseRates = this.calculateBaseRatesWithUnlocks(
        world, level, difficulty,
        player.world, player.level // Utiliser la vraie progression pour les déblocages
      );
      const multipliers = await this.calculateMultipliers(player);
      
      const tempPlayer = {
        ...player.toObject(),
        world,
        level,
        difficulty
      };
      
      const allRewards = this.generateRewardsList(baseRates, multipliers, tempPlayer);
      
      // Filtrer selon déblocages progressifs (progression réelle du joueur)
      const unlockedRewards = AfkUnlockSystem.filterRewardsByUnlocks(
        allRewards, 
        player.world, 
        player.level
      );

      // Métadonnées des déblocages
      const unlockInfo = AfkUnlockSystem.getUnlockInfo(player.world, player.level);
      
      return {
        rewards: unlockedRewards,
        multipliers,
        ratesPerMinute: {
          gold: baseRates.goldPerMinute * multipliers.total,
          exp: baseRates.expPerMinute * multipliers.total,
          materials: baseRates.materialsPerMinute * multipliers.total
        },
        maxAccrualHours: this.calculateMaxAccrualHours(player.vipLevel),
        farmingMeta: {
          isCustomFarming: true,
          farmingStage: `${world}-${level} (${difficulty})`,
          effectiveWorld: world,
          effectiveLevel: level,
          effectiveDifficulty: difficulty
        },
        unlockMeta: {
          unlockedRewardsCount: unlockInfo.unlocked.length,
          totalRewardsAvailable: unlockInfo.totalAvailable,
          progressPercentage: unlockInfo.progressPercentage,
          recentUnlocks: [],
          nextUnlocks: unlockInfo.upcoming.slice(0, 3).map(u => 
            `${u.rewardType} (${u.requirement.description})`
          )
        }
      };

    } catch (error: any) {
      console.error("Erreur calculateRewardsForSpecificStage:", error);
      throw error;
    }
  }
}

import AfkFarmingTarget, { 
  IAfkFarmingTarget,
  getOrCreateForPlayer,
  setFarmingTarget,
  resetToCurrentStage,
  validateStageAccess,
  getExpectedRewards,
  getStageDescription
} from "../models/AfkFarmingTarget";
import Player from "../models/Player";
import CampaignProgress from "../models/CampaignProgress";
import CampaignWorld from "../models/CampaignWorld";
import { CampaignService } from "./CampaignService";
import { AfkRewardsService, AfkReward, AfkRewardsCalculation } from "./AfkRewardsService";

/**
 * AfkFarmingService - Gestion du choix de stage à farmer en mode AFK
 * Intègre le stage selection avec le système de récompenses AFK existant
 */

export interface FarmingStageInfo {
  playerId: string;
  
  // Stage actuellement utilisé pour le farm
  currentFarmingStage: {
    world: number;
    level: number;
    difficulty: string;
    isCustom: boolean;        // true si choix manuel, false si stage actuel
    description: string;      // "12-5 (Hard)"
  };
  
  // Stage de progression du joueur
  playerProgressionStage: {
    world: number;
    level: number;
    difficulty: string;
    description: string;
  };
  
  // Informations sur le choix de farm
  farmingChoice: {
    isActive: boolean;
    selectedAt?: Date;
    reason?: string;
    targetHero?: string;
    isValid: boolean;
    validationMessage?: string;
  };
  
  // Récompenses prédictives
  expectedRewards: {
    specialDrops: string[];
    rewardMultiplier: number;
    recommendedFor: string[];
    comparedToProgression: {
      betterFor: string[];
      worseFor: string[];
      efficiency: number;     // % comparé au stage actuel
    };
  };
}

export interface AvailableStage {
  world: number;
  level: number;
  difficulty: string;
  description: string;
  isUnlocked: boolean;
  specialDrops: string[];
  rewardMultiplier: number;
  recommendedFor: string[];
  isCurrentlyFarming: boolean;
  isPlayerProgression: boolean;
}

export interface FarmingTargetOptions {
  reason?: "fragments" | "materials" | "progression" | "other";
  targetHeroFragments?: string;
  validateFirst?: boolean;
}

export class AfkFarmingService {
  
  // =====================================================================
  // === OBTENIR LES INFORMATIONS DE FARM ACTUELLES ===
  // =====================================================================
  
  /**
   * Obtenir toutes les informations sur le farm actuel d'un joueur
   */
  public static async getFarmingStageInfo(playerId: string): Promise<{
    success: boolean;
    data?: FarmingStageInfo;
    error?: string;
  }> {
    try {
      console.log(`🎯 Récupération info farming pour ${playerId}`);

      // Récupérer le joueur et son choix de farm
      const [player, farmingTarget] = await Promise.all([
        Player.findById(playerId).select("world level difficulty username"),
        getOrCreateForPlayer(playerId)
      ]);

      if (!player) {
        return {
          success: false,
          error: "Player not found"
        };
      }

      // Déterminer le stage utilisé pour le farm
      const farmingStage = farmingTarget.isActive ? 
        {
          world: farmingTarget.selectedWorld,
          level: farmingTarget.selectedLevel,
          difficulty: farmingTarget.selectedDifficulty
        } : 
        {
          world: player.world,
          level: player.level,
          difficulty: player.difficulty
        };

      // Obtenir les récompenses prédictives
      const expectedRewards = await getExpectedRewards(farmingTarget);
      
      // Comparer avec le stage de progression
      const progressionComparison = await this.compareFarmingEfficiency(
        player.world, player.level, player.difficulty,
        farmingStage.world, farmingStage.level, farmingStage.difficulty
      );

      const farmingInfo: FarmingStageInfo = {
        playerId,
        
        currentFarmingStage: {
          world: farmingStage.world,
          level: farmingStage.level,
          difficulty: farmingStage.difficulty,
          isCustom: farmingTarget.isActive,
          description: getStageDescription(farmingTarget)
        },
        
        playerProgressionStage: {
          world: player.world,
          level: player.level,
          difficulty: player.difficulty,
          description: `${player.world}-${player.level} (${player.difficulty})`
        },
        
        farmingChoice: {
          isActive: farmingTarget.isActive,
          selectedAt: farmingTarget.selectedAt,
          reason: farmingTarget.reason,
          targetHero: farmingTarget.targetHeroFragments,
          isValid: farmingTarget.isValidStage,
          validationMessage: farmingTarget.validationMessage
        },
        
        expectedRewards: {
          specialDrops: expectedRewards.specialDrops,
          rewardMultiplier: expectedRewards.rewardMultiplier,
          recommendedFor: expectedRewards.recommendedFor,
          comparedToProgression: progressionComparison
        }
      };

      return {
        success: true,
        data: farmingInfo
      };

    } catch (error: any) {
      console.error("❌ Erreur getFarmingStageInfo:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtenir le stage effectivement utilisé pour les calculs AFK
   */
  public static async getEffectiveFarmingStage(playerId: string): Promise<{
    world: number;
    level: number;
    difficulty: string;
    isCustom: boolean;
  }> {
    try {
      const [player, farmingTarget] = await Promise.all([
        Player.findById(playerId).select("world level difficulty"),
        getOrCreateForPlayer(playerId)
      ]);

      if (!player) {
        throw new Error("Player not found");
      }

      // Si le farm custom est actif ET valide, l'utiliser
      if (farmingTarget.isActive && farmingTarget.isValidStage) {
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
      console.error("❌ Erreur getEffectiveFarmingStage:", error);
      // Fallback : retourner quelque chose de sûr
      return {
        world: 1,
        level: 1,
        difficulty: "Normal",
        isCustom: false
      };
    }
  }

  // =====================================================================
  // === CALCUL DES RÉCOMPENSES AFK AVEC STAGE SELECTION ===
  // =====================================================================

  /**
   * Calculer les récompenses AFK en utilisant le stage de farm sélectionné
   * Extension de AfkRewardsService qui prend en compte le stage selection
   */
  public static async calculateAfkRewardsWithFarming(playerId: string): Promise<AfkRewardsCalculation> {
    try {
      // Obtenir le stage effectif de farm
      const farmingStage = await this.getEffectiveFarmingStage(playerId);
      
      // Récupérer le joueur pour les autres données nécessaires
      const player = await Player.findById(playerId)
        .select("heroes vipLevel serverId");
      
      if (!player) {
        throw new Error("Player not found");
      }

      // Utiliser AfkRewardsService mais avec le stage de farm au lieu du stage actuel
      const calculation = await this.calculateRewardsForStage(
        playerId,
        farmingStage.world,
        farmingStage.level,
        farmingStage.difficulty,
        player
      );

      // Ajouter des métadonnées sur le farm
      (calculation as any).farmingMeta = {
        isCustomFarming: farmingStage.isCustom,
        farmingStage: `${farmingStage.world}-${farmingStage.level} (${farmingStage.difficulty})`
      };

      console.log(`✅ Récompenses AFK calculées pour farm ${farmingStage.world}-${farmingStage.level}`);
      
      return calculation;

    } catch (error: any) {
      console.error("❌ Erreur calculateAfkRewardsWithFarming:", error);
      
      // Fallback : utiliser le calcul normal
      return await AfkRewardsService.calculatePlayerAfkRewards(playerId);
    }
  }

  /**
   * Calculer les récompenses pour un stage spécifique (utilitaire interne)
   */
  private static async calculateRewardsForStage(
    playerId: string,
    world: number,
    level: number,
    difficulty: string,
    player: any
  ): Promise<AfkRewardsCalculation> {
    try {
      // Utiliser les méthodes internes d'AfkRewardsService
      // (on simule un player temporaire avec le stage de farm)
      const tempPlayer = {
        ...player.toObject(),
        world,
        level,
        difficulty
      };

      // Calculer les taux de base pour ce stage
      const baseRates = this.calculateBaseRatesForStage(world, level, difficulty);
      
      // Calculer les multiplicateurs (VIP, équipement, etc.)
      const multipliers = await this.calculateMultipliersForPlayer(tempPlayer);
      
      // Générer la liste des récompenses
      const rewards = this.generateRewardsListForStage(baseRates, multipliers, tempPlayer);
      
      return {
        rewards,
        multipliers,
        ratesPerMinute: {
          gold: baseRates.goldPerMinute * multipliers.total,
          exp: baseRates.expPerMinute * multipliers.total,
          materials: baseRates.materialsPerMinute * multipliers.total
        },
        maxAccrualHours: this.calculateMaxAccrualHours(player.vipLevel)
      };

    } catch (error) {
      console.error("❌ Erreur calculateRewardsForStage:", error);
      throw error;
    }
  }

  // =====================================================================
  // === GESTION DES CHOIX DE FARM ===
  // =====================================================================

  /**
   * Définir un nouveau stage de farm pour un joueur
   */
  public static async setPlayerFarmingTarget(
    playerId: string,
    world: number,
    level: number,
    difficulty: string,
    options?: FarmingTargetOptions
  ): Promise<{
    success: boolean;
    target?: IAfkFarmingTarget;
    farmingInfo?: FarmingStageInfo;
    error?: string;
  }> {
    try {
      console.log(`🎯 Définition farm ${world}-${level} (${difficulty}) pour ${playerId}`);

      // Validation des paramètres
      if (world < 1 || level < 1) {
        return {
          success: false,
          error: "Invalid stage parameters"
        };
      }

      // Créer/modifier le choix de farm
      const target = await setFarmingTarget(playerId, world, level, difficulty, {
        reason: options?.reason,
        targetHeroFragments: options?.targetHeroFragments
      });

      // Valider si demandé
      if (options?.validateFirst) {
        const isValid = await validateStageAccess(target);
        if (!isValid) {
          return {
            success: false,
            error: target.validationMessage || "Stage not accessible"
          };
        }
      }

      // Récupérer les informations complètes
      const farmingInfoResult = await this.getFarmingStageInfo(playerId);

      return {
        success: true,
        target,
        farmingInfo: farmingInfoResult.data
      };

    } catch (error: any) {
      console.error("❌ Erreur setPlayerFarmingTarget:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Revenir au stage de progression actuel (désactiver le farm custom)
   */
  public static async resetPlayerFarmingTarget(playerId: string): Promise<{
    success: boolean;
    farmingInfo?: FarmingStageInfo;
    error?: string;
  }> {
    try {
      console.log(`🔄 Reset farm target pour ${playerId}`);

      await resetToCurrentStage(playerId);
      
      const farmingInfoResult = await this.getFarmingStageInfo(playerId);

      return {
        success: true,
        farmingInfo: farmingInfoResult.data
      };

    } catch (error: any) {
      console.error("❌ Erreur resetPlayerFarmingTarget:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // =====================================================================
  // === DISCOVERY ET RECOMMANDATIONS ===
  // =====================================================================

  /**
   * Obtenir la liste des stages disponibles pour le farm
   */
  public static async getAvailableFarmingStages(playerId: string): Promise<{
    success: boolean;
    stages?: AvailableStage[];
    currentFarming?: AvailableStage;
    recommendations?: string[];
    error?: string;
  }> {
    try {
      console.log(`📋 Récupération stages disponibles pour ${playerId}`);

      const player = await Player.findById(playerId)
        .select("world level difficulty serverId");
      
      if (!player) {
        return {
          success: false,
          error: "Player not found"
        };
      }

      const farmingTarget = await getOrCreateForPlayer(playerId);
      const stages: AvailableStage[] = [];
      
      // Récupérer la progression complète du joueur
      const playerProgress = await CampaignProgress.find({ 
        playerId, 
        serverId: player.serverId 
      });
      
      // Récupérer tous les mondes disponibles
      const allWorlds = await CampaignWorld.find({}).sort({ worldId: 1 });
      
      // Obtenir les difficultés disponibles pour ce joueur
      const availableDifficulties = await this.getPlayerAvailableDifficulties(
        playerId, 
        player.serverId
      );
      
      // Générer la liste des stages disponibles
      for (const world of allWorlds) {
        // Vérifier si le monde est débloqué
        const isWorldUnlocked = player.level >= world.minPlayerLevel;
        if (!isWorldUnlocked) continue;
        
        const worldProgress = playerProgress.find(p => p.worldId === world.worldId);
        
        for (let l = 1; l <= world.levelCount; l++) {
          for (const difficulty of availableDifficulties) {
            // Vérifier si ce niveau est accessible sur cette difficulté
            const canPlay = await CampaignService.canPlayerPlayLevel(
              playerId,
              player.serverId,
              world.worldId,
              l,
              difficulty
            );
            
            if (!canPlay.allowed) continue;

            const expectedRewards = await getExpectedRewards({
              selectedWorld: world.worldId,
              selectedLevel: l,
              selectedDifficulty: difficulty
            } as any);

            stages.push({
              world: world.worldId,
              level: l,
              difficulty,
              description: `${world.worldId}-${l} (${difficulty})`,
              isUnlocked: true,
              specialDrops: expectedRewards.specialDrops,
              rewardMultiplier: expectedRewards.rewardMultiplier,
              recommendedFor: expectedRewards.recommendedFor,
              isCurrentlyFarming: farmingTarget.isActive && 
                farmingTarget.selectedWorld === world.worldId && 
                farmingTarget.selectedLevel === l && 
                farmingTarget.selectedDifficulty === difficulty,
              isPlayerProgression: player.world === world.worldId && 
                player.level === this.calculatePlayerLevelFromProgress(world.worldId, l) && 
                player.difficulty === difficulty
            });
          }
        }
      }

      // Trouver le stage actuellement farmé
      const currentFarming = stages.find(s => s.isCurrentlyFarming) || 
        stages.find(s => s.isPlayerProgression);

      // Générer des recommandations
      const recommendations = this.generateFarmingRecommendations(stages, player);

      return {
        success: true,
        stages,
        currentFarming,
        recommendations
      };

    } catch (error: any) {
      console.error("❌ Erreur getAvailableFarmingStages:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // =====================================================================
  // === MÉTHODES UTILITAIRES PRIVÉES ===
  // =====================================================================

  /**
   * Comparer l'efficacité de farm entre deux stages
   */
  private static async compareFarmingEfficiency(
    progressionWorld: number, progressionLevel: number, progressionDiff: string,
    farmingWorld: number, farmingLevel: number, farmingDiff: string
  ): Promise<{ betterFor: string[]; worseFor: string[]; efficiency: number }> {
    try {
      // Calculer les multiplicateurs des deux stages
      const progressionRewards = await getExpectedRewards({
        selectedWorld: progressionWorld,
        selectedLevel: progressionLevel,
        selectedDifficulty: progressionDiff
      } as any);

      const farmingRewards = await getExpectedRewards({
        selectedWorld: farmingWorld,
        selectedLevel: farmingLevel,
        selectedDifficulty: farmingDiff
      } as any);

      const efficiency = Math.round((farmingRewards.rewardMultiplier / progressionRewards.rewardMultiplier) * 100);

      const betterFor: string[] = [];
      const worseFor: string[] = [];

      // Analyser les avantages/inconvénients
      if (farmingWorld < progressionWorld) {
        betterFor.push("Specific hero fragments");
        betterFor.push("Easier material farming");
        worseFor.push("Overall progression");
        worseFor.push("End-game materials");
      } else if (farmingWorld > progressionWorld) {
        worseFor.push("Might be too difficult");
      }

      if (farmingDiff === "Nightmare" && progressionDiff !== "Nightmare") {
        betterFor.push("Rare materials");
        betterFor.push("High-tier rewards");
      }

      return { betterFor, worseFor, efficiency };

    } catch (error) {
      console.error("❌ Erreur compareFarmingEfficiency:", error);
      return { betterFor: [], worseFor: [], efficiency: 100 };
    }
  }

  /**
   * Obtenir les difficultés disponibles pour un joueur (basé sur CampaignService)
   */
  private static async getPlayerAvailableDifficulties(
    playerId: string,
    serverId: string
  ): Promise<("Normal" | "Hard" | "Nightmare")[]> {
    try {
      const difficulties: ("Normal" | "Hard" | "Nightmare")[] = ["Normal"];
      
      // Vérifier si le joueur a complété toute la campagne en Normal
      const hasCompletedNormal = await CampaignService.hasPlayerCompletedCampaign(
        playerId, 
        serverId, 
        "Normal"
      );
      if (hasCompletedNormal) {
        difficulties.push("Hard");
      }
      
      // Vérifier si le joueur a complété toute la campagne en Hard
      const hasCompletedHard = await CampaignService.hasPlayerCompletedCampaign(
        playerId, 
        serverId, 
        "Hard"
      );
      if (hasCompletedHard) {
        difficulties.push("Nightmare");
      }
      
      return difficulties;
      
    } catch (error) {
      console.error("❌ Erreur getPlayerAvailableDifficulties:", error);
      return ["Normal"];
    }
  }

  /**
   * Calculer le niveau du joueur basé sur la progression du monde/niveau
   * (estimation inverse de votre logique de niveau)
   */
  private static calculatePlayerLevelFromProgress(world: number, level: number): number {
    // Basé sur votre logique : newPlayerLevel = (worldId - 1) * 10 + levelIndex + 5
    return (world - 1) * 10 + level + 5;
  }

  /**
   * Générer des recommandations de farm basées sur la vraie progression
   */
  private static generateFarmingRecommendations(stages: AvailableStage[], player: any): string[] {
    const recommendations: string[] = [];

    // Si le joueur n'utilise pas de farm custom
    const hasCustomFarm = stages.some(s => s.isCurrentlyFarming && !s.isPlayerProgression);
    
    if (!hasCustomFarm) {
      recommendations.push("Consider farming previous stages for specific hero fragments");
    }

    // Recommander stages Nightmare si disponibles
    const nightmareStages = stages.filter(s => s.difficulty === "Nightmare");
    if (nightmareStages.length > 0) {
      recommendations.push("Try Nightmare stages for better material rewards");
    }

    // Recommander farm de héros spécifiques selon la progression
    const earlyStages = stages.filter(s => s.world <= 5);
    if (earlyStages.length > 0 && player.world > 5) {
      recommendations.push("Farm early stages for common hero fragments to complete collections");
    }

    const hardStages = stages.filter(s => s.difficulty === "Hard");
    if (hardStages.length > 0) {
      recommendations.push("Hard difficulty provides 50% more rewards");
    }

    return recommendations;
  }

  /**
   * Méthodes simplifiées reprenant la logique d'AfkRewardsService
   * (pour éviter les dépendances circulaires)
   */
  private static calculateBaseRatesForStage(world: number, level: number, difficulty: string) {
    const worldMultiplier = Math.pow(1.15, world - 1);
    const levelMultiplier = Math.pow(1.05, level - 1);
    
    const difficultyMultiplier = {
      "Normal": 1.0,
      "Hard": 1.5,
      "Nightmare": 2.0
    }[difficulty] || 1.0;

    const baseGold = 100;
    const baseExp = 50;
    const baseMaterials = 10;

    return {
      goldPerMinute: Math.floor(baseGold * worldMultiplier * levelMultiplier * difficultyMultiplier),
      expPerMinute: Math.floor(baseExp * worldMultiplier * levelMultiplier * difficultyMultiplier),
      materialsPerMinute: Math.floor(baseMaterials * worldMultiplier * levelMultiplier * difficultyMultiplier)
    };
  }

  private static async calculateMultipliersForPlayer(player: any) {
    // Simulation simple des multiplicateurs
    return {
      vip: 1.0 + (player.vipLevel * 0.1),
      stage: 1.0 + (player.world * 0.05),
      heroes: 1.2, // Assumé pour simplicité
      total: 1.0 + (player.vipLevel * 0.1) + (player.world * 0.05) + 0.2
    };
  }

  private static generateRewardsListForStage(baseRates: any, multipliers: any, player: any): AfkReward[] {
    // Version simplifiée de la génération de récompenses
    return [
      {
        type: "currency",
        currencyType: "gold",
        quantity: Math.floor(baseRates.goldPerMinute * multipliers.total),
        baseQuantity: baseRates.goldPerMinute
      }
    ] as AfkReward[];
  }

  private static calculateMaxAccrualHours(vipLevel: number): number {
    let baseHours = 12;
    if (vipLevel >= 3) baseHours += 2;
    if (vipLevel >= 6) baseHours += 2;
    if (vipLevel >= 9) baseHours += 4;
    if (vipLevel >= 12) baseHours += 4;
    return baseHours;
  }
}

export default AfkFarmingService;

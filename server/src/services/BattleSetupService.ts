// server/src/services/BattleSetupService.ts
import Player from "../models/Player";
import Hero from "../models/Hero";
import Formation, { IFormationSlot } from "../models/Formation";
import LevelProgress from "../models/LevelProgress";
import { FormationService } from "./FormationService";
import { FormationValidator } from "./FormationValidator";
import { calculateFormationSynergies } from "../config/FormationBonusConfig";

export interface BattlePreview {
  level: {
    worldId: number;
    levelId: number;
    difficulty: string;
    enemyType: "normal" | "elite" | "boss";
    recommended: boolean;
  };
  playerFormation: {
    formationId?: string;
    name?: string;
    slots: IFormationSlot[];
    heroes: any[];
    totalPower: number;
    stats: any;
  };
  enemies: {
    count: number;
    averageLevel: number;
    totalPower: number;
    composition: any[];
  };
  estimation: {
    victoryChance: number;
    difficulty: "very_easy" | "easy" | "medium" | "hard" | "very_hard";
    powerDifference: number;
    recommendations: string[];
  };
  progress: {
    attempts: number;
    victories: number;
    bestTime: number;
    canSkip: boolean;
  };
  canStart: boolean;
  warnings: string[];
}

export interface FormationValidationPreview {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalPower: number;
    heroCount: number;
    roleDistribution: Record<string, number>;
    elementDistribution: Record<string, number>;
    synergies?: any;
  };
  heroes: any[];
  estimation?: {
    victoryChance: number;
    powerDifference: number;
  };
}

export class BattleSetupService {

  /**
   * Prévisualiser un niveau de campagne avec la formation active
   */
  static async previewCampaignLevel(
    playerId: string,
    serverId: string,
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare" = "Normal"
  ): Promise<BattlePreview> {
    try {
      // 1. Récupérer le joueur et la formation active
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      // 2. Récupérer la formation active
      const activeFormationResult = await FormationService.getActiveFormation(playerId, serverId);
      
      let playerFormation: any = {
        slots: [],
        heroes: [],
        totalPower: 0,
        stats: {}
      };

      if (activeFormationResult.success && activeFormationResult.formation) {
        playerFormation = {
          formationId: activeFormationResult.formation._id,
          name: activeFormationResult.formation.name,
          slots: activeFormationResult.formation.slots,
          heroes: activeFormationResult.formation.heroes || [],
          totalPower: activeFormationResult.stats?.totalPower || 0,
          stats: activeFormationResult.stats
        };
      } else {
        // Fallback: utiliser les héros équipés
        const equippedHeroes = player.heroes.filter((h: any) => h.equipped);
        playerFormation.heroes = equippedHeroes.map((h: any, index: number) => ({
          ...h,
          position: index + 1
        }));
        playerFormation.slots = equippedHeroes.map((h: any, index: number) => ({
          slot: index + 1,
          heroId: h._id.toString()
        }));
        playerFormation.totalPower = await this.calculateQuickPower(equippedHeroes);
      }

      // 3. Générer l'aperçu des ennemis
      const enemyPreview = await this.generateEnemyPreview(worldId, levelId, difficulty);

      // 4. Récupérer la progression du niveau
      const progress = await LevelProgress.getOrCreate(playerId, serverId, worldId, levelId, difficulty);

      // 5. Estimer les chances de victoire
      const estimation = this.estimateVictory(
        playerFormation.totalPower,
        enemyPreview.totalPower,
        playerFormation.heroes.length,
        progress.victories
      );

      // 6. Vérifications
      const canStart = playerFormation.slots.length > 0;
      const warnings: string[] = [];

      if (!canStart) {
        warnings.push("No heroes in formation - please equip heroes first");
      }

      if (playerFormation.slots.length < 3 && canStart) {
        warnings.push("Formation has less than 3 heroes - battle will be harder");
      }

      if (estimation.difficulty === "very_hard" || estimation.difficulty === "hard") {
        warnings.push(`This level is ${estimation.difficulty} for your current power`);
      }

      return {
        level: {
          worldId,
          levelId,
          difficulty,
          enemyType: this.getEnemyType(levelId),
          recommended: estimation.victoryChance >= 60
        },
        playerFormation,
        enemies: enemyPreview,
        estimation,
        progress: {
          attempts: progress.attempts,
          victories: progress.victories,
          bestTime: progress.bestTime,
          canSkip: progress.canSkip()
        },
        canStart,
        warnings
      };

    } catch (error: any) {
      console.error("❌ Erreur preview campagne:", error);
      throw error;
    }
  }

  /**
   * Valider une formation temporaire avant de lancer le combat
   */
  static async validateTemporaryFormation(
    playerId: string,
    serverId: string,
    slots: IFormationSlot[],
    worldId?: number,
    levelId?: number,
    difficulty?: "Normal" | "Hard" | "Nightmare"
  ): Promise<FormationValidationPreview> {
    try {
      // 1. Validation structurelle
      const validation = await FormationValidator.validateFormation(
        playerId,
        serverId,
        slots,
        { allowEmpty: false, checkHeroAvailability: false }
      );

      // 2. Récupérer les données des héros
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const heroes: any[] = [];
      let totalPower = 0;
      const roleDistribution: Record<string, number> = {};
      const elementDistribution: Record<string, number> = {};

      for (const slot of slots) {
        const heroInstance = player.heroes.find((h: any) => h._id?.toString() === slot.heroId);
        if (!heroInstance) continue;

        let heroData;
        if (typeof heroInstance.heroId === 'string') {
          heroData = await Hero.findById(heroInstance.heroId);
        } else {
          heroData = heroInstance.heroId;
        }

        if (!heroData) continue;

        heroes.push({
          heroId: slot.heroId,
          position: slot.slot,
          name: heroData.name,
          role: heroData.role,
          element: heroData.element,
          rarity: heroData.rarity,
          level: heroInstance.level,
          stars: heroInstance.stars
        });

        // Stats
        const levelMultiplier = 1 + (heroInstance.level - 1) * 0.08;
        const starMultiplier = 1 + (heroInstance.stars - 1) * 0.15;
        const totalMultiplier = levelMultiplier * starMultiplier;

        const heroPower = Math.floor(
          heroData.baseStats.atk * 1.0 * totalMultiplier + 
          heroData.baseStats.def * 2.0 * totalMultiplier + 
          heroData.baseStats.hp / 10 * totalMultiplier
        );

        totalPower += heroPower;

        // Distribution
        roleDistribution[heroData.role] = (roleDistribution[heroData.role] || 0) + 1;
        elementDistribution[heroData.element] = (elementDistribution[heroData.element] || 0) + 1;
      }

      // 3. Calculer les synergies
      const synergies = calculateFormationSynergies(elementDistribution);

      // 4. Estimation si niveau fourni
      let estimation;
      if (worldId && levelId && difficulty) {
        const enemyPreview = await this.generateEnemyPreview(worldId, levelId, difficulty);
        const estimationData = this.estimateVictory(totalPower, enemyPreview.totalPower, heroes.length, 0);
        estimation = {
          victoryChance: estimationData.victoryChance,
          powerDifference: estimationData.powerDifference
        };
      }

      return {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings || [],
        stats: {
          totalPower,
          heroCount: heroes.length,
          roleDistribution,
          elementDistribution,
          synergies
        },
        heroes,
        estimation
      };

    } catch (error: any) {
      console.error("❌ Erreur validation temporaire:", error);
      throw error;
    }
  }

  /**
   * Prévisualiser un combat d'arène
   */
  static async previewArenaBattle(
    playerId: string,
    serverId: string,
    opponentId: string
  ): Promise<any> {
    try {
      // 1. Récupérer les deux joueurs
      const [player, opponent] = await Promise.all([
        Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId"),
        Player.findOne({ _id: opponentId, serverId }).populate("heroes.heroId")
      ]);

      if (!player || !opponent) {
        throw new Error("Player or opponent not found");
      }

      // 2. Formations actives
      const [playerFormation, opponentFormation] = await Promise.all([
        FormationService.getActiveFormation(playerId, serverId),
        FormationService.getActiveFormation(opponentId, serverId)
      ]);

      // 3. Calculer puissance
      const playerPower = playerFormation.success ? playerFormation.stats?.totalPower || 0 : 0;
      const opponentPower = opponentFormation.success ? opponentFormation.stats?.totalPower || 0 : 0;

      // 4. Estimation
      const estimation = this.estimateVictory(playerPower, opponentPower, 
        playerFormation.formation?.slots.length || 0, 0);

      return {
        player: {
          username: player.displayName || player.username,
          level: player.level,
          power: playerPower,
          formation: playerFormation.formation
        },
        opponent: {
          username: opponent.displayName || opponent.username,
          level: opponent.level,
          power: opponentPower,
          formation: opponentFormation.formation
        },
        estimation,
        canStart: playerPower > 0 && opponentPower > 0
      };

    } catch (error: any) {
      console.error("❌ Erreur preview arène:", error);
      throw error;
    }
  }

  /**
   * Générer un aperçu des ennemis pour un niveau
   */
  private static async generateEnemyPreview(
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<any> {
    try {
      const enemyCount = 3 + Math.floor(worldId / 5);
      const levelMultiplier = 1 + (worldId * 0.15) + (levelId * 0.05);
      const enemyType = this.getEnemyType(levelId);

      // Difficulté
      let difficultyMultiplier = 1.0;
      if (difficulty === "Hard") difficultyMultiplier = 2.0;
      if (difficulty === "Nightmare") difficultyMultiplier = 4.0;

      // Type d'ennemi
      let typeMultiplier = 1.0;
      if (enemyType === "elite") typeMultiplier = 1.2;
      if (enemyType === "boss") typeMultiplier = 1.5;

      const totalMultiplier = levelMultiplier * difficultyMultiplier * typeMultiplier;

      // Générer composition aléatoire
      const heroes = await Hero.aggregate([{ $sample: { size: enemyCount } }]);

      const composition = heroes.map((hero: any, index: number) => ({
        name: `${enemyType === "boss" ? "Boss " : enemyType === "elite" ? "Elite " : ""}${hero.name}`,
        role: hero.role,
        element: hero.element,
        rarity: hero.rarity,
        level: Math.floor(20 + enemyCount * 2 * typeMultiplier),
        position: index + 1
      }));

      // Calculer puissance estimée
      const basePower = 500 * enemyCount;
      const totalPower = Math.floor(basePower * totalMultiplier);

      return {
        count: enemyCount,
        averageLevel: Math.floor(20 + enemyCount * 2 * typeMultiplier),
        totalPower,
        composition
      };

    } catch (error) {
      console.error("Erreur génération ennemis:", error);
      return {
        count: 3,
        averageLevel: 20,
        totalPower: 1500,
        composition: []
      };
    }
  }

  /**
   * Estimer les chances de victoire
   */
  private static estimateVictory(
    playerPower: number,
    enemyPower: number,
    heroCount: number,
    previousVictories: number
  ): any {
    const powerRatio = playerPower / (enemyPower || 1);
    const powerDifference = Math.round((powerRatio - 1) * 100);

    // Base de chance selon ratio de puissance
    let victoryChance = 50;
    
    if (powerRatio >= 1.5) victoryChance = 95;
    else if (powerRatio >= 1.3) victoryChance = 85;
    else if (powerRatio >= 1.15) victoryChance = 75;
    else if (powerRatio >= 1.0) victoryChance = 65;
    else if (powerRatio >= 0.9) victoryChance = 50;
    else if (powerRatio >= 0.75) victoryChance = 35;
    else if (powerRatio >= 0.6) victoryChance = 20;
    else victoryChance = 10;

    // Bonus victoires précédentes (connaissance du niveau)
    if (previousVictories > 0) {
      victoryChance = Math.min(95, victoryChance + previousVictories * 2);
    }

    // Malus si formation incomplète
    if (heroCount < 5) {
      victoryChance = Math.floor(victoryChance * (0.85 + (heroCount * 0.03)));
    }

    // Déterminer difficulté
    let difficulty: "very_easy" | "easy" | "medium" | "hard" | "very_hard";
    if (victoryChance >= 85) difficulty = "very_easy";
    else if (victoryChance >= 70) difficulty = "easy";
    else if (victoryChance >= 50) difficulty = "medium";
    else if (victoryChance >= 30) difficulty = "hard";
    else difficulty = "very_hard";

    // Recommandations
    const recommendations: string[] = [];
    
    if (powerRatio < 0.9) {
      recommendations.push("Upgrade your heroes before attempting this level");
    }
    if (heroCount < 5) {
      recommendations.push(`Add ${5 - heroCount} more hero(es) to your formation`);
    }
    if (powerRatio < 0.75) {
      recommendations.push("Consider farming previous levels for resources");
    }
    if (previousVictories === 0 && powerRatio < 1.0) {
      recommendations.push("First attempt on this level - be prepared for a challenge");
    }

    return {
      victoryChance: Math.round(victoryChance),
      difficulty,
      powerDifference,
      recommendations
    };
  }

  /**
   * Calculer rapidement la puissance d'une liste de héros
   */
  private static async calculateQuickPower(heroes: any[]): Promise<number> {
    let totalPower = 0;

    for (const heroInstance of heroes) {
      let heroData;
      if (typeof heroInstance.heroId === 'string') {
        heroData = await Hero.findById(heroInstance.heroId);
      } else {
        heroData = heroInstance.heroId;
      }

      if (!heroData || !heroData.baseStats) continue;

      const levelMultiplier = 1 + (heroInstance.level - 1) * 0.08;
      const starMultiplier = 1 + (heroInstance.stars - 1) * 0.15;
      const totalMultiplier = levelMultiplier * starMultiplier;

      const heroPower = Math.floor(
        heroData.baseStats.atk * 1.0 * totalMultiplier + 
        heroData.baseStats.def * 2.0 * totalMultiplier + 
        heroData.baseStats.hp / 10 * totalMultiplier
      );

      totalPower += heroPower;
    }

    return totalPower;
  }

  /**
   * Déterminer le type d'ennemi selon le niveau
   */
  private static getEnemyType(levelId: number): "normal" | "elite" | "boss" {
    if (levelId % 10 === 0) return "boss";
    if (levelId % 5 === 0) return "elite";
    return "normal";
  }

  /**
   * Configuration rapide pour un combat
   */
  static async quickSetup(
    playerId: string,
    serverId: string,
    worldId?: number,
    levelId?: number
  ): Promise<any> {
    const player = await Player.findOne({ _id: playerId, serverId });
    if (!player) {
      throw new Error("Player not found");
    }

    const targetWorld = worldId || player.world || 1;
    const targetLevel = levelId || player.level || 1;

    return this.previewCampaignLevel(playerId, serverId, targetWorld, targetLevel, "Normal");
  }
}

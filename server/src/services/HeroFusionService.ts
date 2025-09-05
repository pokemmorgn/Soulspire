import Player from "../models/Player";
import Hero from "../models/Hero";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { IPlayerHero } from "../types/index";

export interface FusionRequirements {
  mainHero: string; // ID de l'instance du héros principal
  copies: string[]; // IDs des instances de copies du même héros
  foodHeroes: string[]; // IDs des instances de héros "food"
  materials: Record<string, number>; // Matériaux d'ascension requis
  gold: number; // Coût en or
}

export interface FusionPreview {
  canFuse: boolean;
  currentRarity: string;
  currentStars: number;
  targetRarity: string;
  targetStars: number;
  requirements: FusionRequirements;
  statsPreview: {
    current: any;
    after: any;
    gained: any;
  };
  missingRequirements: string[];
}

export interface FusionResult {
  success: boolean;
  fusedHero?: {
    instanceId: string;
    heroData: any;
    newRarity: string;
    newStars: number;
    newStats: any;
    powerGained: number;
  };
  consumedHeroes?: string[];
  cost?: {
    gold: number;
    materials: Record<string, number>;
  };
  playerResources?: {
    gold: number;
    materials: Record<string, number>;
  };
  error?: string;
  code?: string;
}

export interface FusionHistory {
  _id?: string;
  playerId: string;
  mainHeroId: string;
  fromRarity: string;
  fromStars: number;
  toRarity: string;
  toStars: number;
  consumedHeroes: {
    heroId: string;
    heroName: string;
    rarity: string;
    role: "copy" | "food";
  }[];
  cost: {
    gold: number;
    materials: Record<string, number>;
  };
  timestamp: Date;
}

export class HeroFusionService {

  // === CONFIGURATION DU SYSTÈME DE FUSION ===

  private static readonly RARITY_PROGRESSION = [
    "Common", "Rare", "Epic", "Legendary", "Ascended"
  ];

  private static readonly STAR_PROGRESSION = [1, 2, 3, 4, 5];

  private static readonly FUSION_REQUIREMENTS: Record<string, {
    copies: number;
    food: number;
    materials: Record<string, number>;
    goldMultiplier: number;
  }> = {
    // Common → Rare
    "Common_to_Rare": {
      copies: 1, // 1 copie du même héros
      food: 1,   // 1 héros Common de même élément
      materials: { "fusion_crystal": 5 },
      goldMultiplier: 1.0
    },
    // Rare → Epic
    "Rare_to_Epic": {
      copies: 1,
      food: 2, // 2 héros Rare de même élément
      materials: { "fusion_crystal": 10, "elemental_essence": 3 },
      goldMultiplier: 1.5
    },
    // Epic → Legendary
    "Epic_to_Legendary": {
      copies: 1,
      food: 2, // 2 héros Epic de même élément
      materials: { "fusion_crystal": 20, "elemental_essence": 8, "ascension_stone": 2 },
      goldMultiplier: 2.0
    },
    // Legendary → Ascended
    "Legendary_to_Ascended": {
      copies: 1,
      food: 2, // 2 héros Legendary de même élément
      materials: { "fusion_crystal": 40, "elemental_essence": 15, "ascension_stone": 5, "divine_crystal": 1 },
      goldMultiplier: 3.0
    },
    // Ascended 1★ → 2★
    "Ascended_1_to_2": {
      copies: 1,
      food: 1, // 1 héros Legendary+ de même élément
      materials: { "stellar_essence": 10, "divine_crystal": 2 },
      goldMultiplier: 4.0
    },
    // Ascended 2★ → 3★
    "Ascended_2_to_3": {
      copies: 1,
      food: 2,
      materials: { "stellar_essence": 20, "divine_crystal": 4 },
      goldMultiplier: 5.0
    },
    // Ascended 3★ → 4★
    "Ascended_3_to_4": {
      copies: 1,
      food: 3,
      materials: { "stellar_essence": 40, "divine_crystal": 8, "cosmic_shard": 1 },
      goldMultiplier: 6.0
    },
    // Ascended 4★ → 5★
    "Ascended_4_to_5": {
      copies: 1,
      food: 4,
      materials: { "stellar_essence": 80, "divine_crystal": 15, "cosmic_shard": 3 },
      goldMultiplier: 8.0
    }
  };

  // === MÉTHODES PUBLIQUES ===

  /**
   * Obtient un aperçu de fusion pour un héros donné
   */
  public static async getFusionPreview(
    playerId: string,
    serverId: string,
    heroInstanceId: string
  ): Promise<FusionPreview> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const heroInstance = player.heroes.find(h => h._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        throw new Error("Hero not found");
      }

      const heroData = heroInstance.heroId as any;
      const currentRarity = heroData.rarity;
      const currentStars = (heroInstance as any).ascensionStars || 0;

      // Vérifier si une fusion est possible
      const nextLevel = this.getNextAscensionLevel(currentRarity, currentStars);
      if (!nextLevel) {
        return {
          canFuse: false,
          currentRarity,
          currentStars,
          targetRarity: currentRarity,
          targetStars: currentStars,
          requirements: this.createEmptyRequirements(),
          statsPreview: { current: {}, after: {}, gained: {} },
          missingRequirements: ["Hero is already at maximum ascension"]
        };
      }

      const requirements = await this.calculateFusionRequirements(
        player,
        heroInstance,
        heroData,
        nextLevel.rarity,
        nextLevel.stars
      );

      const missingRequirements = await this.validateRequirements(player, requirements);

      const currentStats = this.calculateAscendedStats(heroData, heroInstance.level, currentRarity, currentStars);
      const afterStats = this.calculateAscendedStats(heroData, heroInstance.level, nextLevel.rarity, nextLevel.stars);
      const gainedStats = this.calculateStatsDifference(currentStats, afterStats);

      return {
        canFuse: missingRequirements.length === 0,
        currentRarity,
        currentStars,
        targetRarity: nextLevel.rarity,
        targetStars: nextLevel.stars,
        requirements,
        statsPreview: {
          current: currentStats,
          after: afterStats,
          gained: gainedStats
        },
        missingRequirements
      };

    } catch (error: any) {
      console.error("❌ Erreur getFusionPreview:", error);
      throw error;
    }
  }

  /**
   * Effectue une fusion de héros
   */
  public static async fuseHero(
    playerId: string,
    serverId: string,
    heroInstanceId: string,
    requirements: FusionRequirements
  ): Promise<FusionResult> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const heroInstance = player.heroes.find(h => h._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        return { success: false, error: "Hero not found", code: "HERO_NOT_FOUND" };
      }

      // Validation côté serveur (anti-cheat)
      const validationResult = await this.validateFusionRequest(player, heroInstance, requirements);
      if (!validationResult.valid) {
        return { 
          success: false, 
          error: validationResult.error, 
          code: "VALIDATION_FAILED" 
        };
      }

      const heroData = heroInstance.heroId as any;
      const currentRarity = heroData.rarity;
      const currentStars = (heroInstance as any).ascensionStars || 0;

      const nextLevel = this.getNextAscensionLevel(currentRarity, currentStars);
      if (!nextLevel) {
        return { 
          success: false, 
          error: "Hero is already at maximum ascension", 
          code: "MAX_ASCENSION_REACHED" 
        };
      }

      // Vérifier les ressources
      if (player.gold < requirements.gold) {
        return { 
          success: false, 
          error: `Insufficient gold. Required: ${requirements.gold}`, 
          code: "INSUFFICIENT_GOLD" 
        };
      }

      for (const [materialId, quantity] of Object.entries(requirements.materials)) {
        const available = player.materials.get(materialId) || 0;
        if (available < quantity) {
          return { 
            success: false, 
            error: `Insufficient ${materialId}. Required: ${quantity}, Available: ${available}`, 
            code: "INSUFFICIENT_MATERIALS" 
          };
        }
      }

      // Effectuer la fusion
      const oldStats = this.calculateAscendedStats(heroData, heroInstance.level, currentRarity, currentStars);

      // Consommer les ressources
      player.gold -= requirements.gold;
      for (const [materialId, quantity] of Object.entries(requirements.materials)) {
        const current = player.materials.get(materialId) || 0;
        player.materials.set(materialId, current - quantity);
      }

      // Supprimer les héros consommés
      const consumedHeroNames: string[] = [];
      const allConsumedIds = [...requirements.copies, ...requirements.foodHeroes];
      
      for (const consumedId of allConsumedIds) {
        const heroIndex = player.heroes.findIndex(h => h._id?.toString() === consumedId);
        if (heroIndex !== -1) {
          const consumedHero = player.heroes[heroIndex].heroId as any;
          consumedHeroNames.push(consumedHero.name);
          player.heroes.splice(heroIndex, 1);
        }
      }

      // Mettre à jour le héros principal
      if (nextLevel.rarity !== currentRarity) {
        // Changement de rareté
        heroData.rarity = nextLevel.rarity;
        await heroData.save();
      }
      
      (heroInstance as any).ascensionStars = nextLevel.stars;

      const newStats = this.calculateAscendedStats(heroData, heroInstance.level, nextLevel.rarity, nextLevel.stars);
      const powerGained = this.calculatePower(newStats) - this.calculatePower(oldStats);

      await player.save();

      // Enregistrer dans l'historique
      await this.saveFusionHistory({
        playerId,
        mainHeroId: heroData._id.toString(),
        fromRarity: currentRarity,
        fromStars: currentStars,
        toRarity: nextLevel.rarity,
        toStars: nextLevel.stars,
        consumedHeroes: allConsumedIds.map((id, index) => ({
          heroId: id,
          heroName: consumedHeroNames[index] || "Unknown",
          rarity: requirements.copies.includes(id) ? currentRarity : "Food",
          role: requirements.copies.includes(id) ? "copy" : "food"
        })),
        cost: {
          gold: requirements.gold,
          materials: requirements.materials
        },
        timestamp: new Date()
      });

      // Mettre à jour les missions et événements
      await this.updateProgressTracking(playerId, serverId, nextLevel.rarity, nextLevel.stars);

      console.log(`🔀 ${heroData.name} fusion: ${currentRarity}${currentStars}★ → ${nextLevel.rarity}${nextLevel.stars}★`);

      return {
        success: true,
        fusedHero: {
          instanceId: heroInstanceId,
          heroData: {
            name: heroData.name,
            rarity: heroData.rarity,
            element: heroData.element,
            role: heroData.role
          },
          newRarity: nextLevel.rarity,
          newStars: nextLevel.stars,
          newStats,
          powerGained
        },
        consumedHeroes: allConsumedIds,
        cost: {
          gold: requirements.gold,
          materials: requirements.materials
        },
        playerResources: {
          gold: player.gold,
          materials: Object.fromEntries(player.materials.entries())
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur fuseHero:", error);
      return { success: false, error: error.message, code: "FUSION_FAILED" };
    }
  }

  /**
   * Obtient la liste des héros pouvant être fusionnés
   */
  public static async getFusableHeroes(
    playerId: string,
    serverId: string
  ) {
    try {
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const fusableHeroes: any[] = [];

      for (const heroInstance of player.heroes) {
        const heroData = heroInstance.heroId as any;
        const currentRarity = heroData.rarity;
        const currentStars = (heroInstance as any).ascensionStars || 0;

        const nextLevel = this.getNextAscensionLevel(currentRarity, currentStars);
        if (nextLevel) {
          const requirements = await this.calculateFusionRequirements(
            player,
            heroInstance,
            heroData,
            nextLevel.rarity,
            nextLevel.stars
          );

          const missingRequirements = await this.validateRequirements(player, requirements);

          fusableHeroes.push({
            instanceId: heroInstance._id?.toString() || "",
            heroName: heroData.name,
            currentRarity,
            currentStars,
            targetRarity: nextLevel.rarity,
            targetStars: nextLevel.stars,
            canFuse: missingRequirements.length === 0,
            requirements,
            missingRequirements
          });
        }
      }

      // Trier par priorité (héros fusables en premier, puis par rareté)
      fusableHeroes.sort((a, b) => {
        if (a.canFuse !== b.canFuse) return a.canFuse ? -1 : 1;
        const rarityOrder = this.RARITY_PROGRESSION.indexOf(a.currentRarity) - this.RARITY_PROGRESSION.indexOf(b.currentRarity);
        return rarityOrder !== 0 ? -rarityOrder : a.currentStars - b.currentStars;
      });

      return {
        success: true,
        fusableHeroes,
        summary: {
          totalFusable: fusableHeroes.length,
          readyToFuse: fusableHeroes.filter(h => h.canFuse).length,
          byRarity: this.groupByRarity(fusableHeroes)
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getFusableHeroes:", error);
      throw error;
    }
  }

  /**
   * Obtient l'historique des fusions d'un joueur
   */
  public static async getFusionHistory(
    playerId: string,
    serverId: string,
    limit: number = 20
  ) {
    try {
      // Note: Dans un vrai projet, ceci serait dans une collection MongoDB séparée
      // Pour cet exemple, on simule avec un stockage temporaire
      const history = await this.loadFusionHistory(playerId, limit);

      return {
        success: true,
        history,
        summary: {
          totalFusions: history.length,
          totalGoldSpent: history.reduce((sum, h) => sum + h.cost.gold, 0),
          rarityAchievements: this.calculateRarityAchievements(history)
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getFusionHistory:", error);
      throw error;
    }
  }

  /**
   * Calcule les coûts de fusion optimaux pour un joueur
   */
  public static async getOptimalFusionPath(
    playerId: string,
    serverId: string,
    targetHeroId: string
  ) {
    try {
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const targetHero = player.heroes.find(h => h._id?.toString() === targetHeroId);
      if (!targetHero) {
        throw new Error("Target hero not found");
      }

      const heroData = targetHero.heroId as any;
      const currentRarity = heroData.rarity;
      const currentStars = (targetHero as any).ascensionStars || 0;

      const fusionPath: any[] = [];
      let pathRarity = currentRarity;
      let pathStars = currentStars;
      let totalCost = { gold: 0, materials: {} as Record<string, number> };

      // Calculer le chemin complet vers l'ascension maximale
      while (true) {
        const nextLevel = this.getNextAscensionLevel(pathRarity, pathStars);
        if (!nextLevel) break;

        const requirements = await this.calculateFusionRequirements(
          player,
          targetHero,
          heroData,
          nextLevel.rarity,
          nextLevel.stars
        );

        fusionPath.push({
          from: `${pathRarity} ${pathStars}★`,
          to: `${nextLevel.rarity} ${nextLevel.stars}★`,
          requirements,
          feasible: (await this.validateRequirements(player, requirements)).length === 0
        });

        // Additionner les coûts
        totalCost.gold += requirements.gold;
        for (const [mat, qty] of Object.entries(requirements.materials)) {
          totalCost.materials[mat] = (totalCost.materials[mat] || 0) + qty;
        }

        pathRarity = nextLevel.rarity;
        pathStars = nextLevel.stars;
      }

      return {
        success: true,
        targetHero: {
          name: heroData.name,
          currentLevel: `${currentRarity} ${currentStars}★`,
          maxLevel: `${pathRarity} ${pathStars}★`
        },
        fusionPath,
        totalCost,
        feasibility: {
          canAffordAll: this.canAffordPath(player, totalCost),
          stepsBlocked: fusionPath.filter(step => !step.feasible).length,
          nextBlockedStep: fusionPath.find(step => !step.feasible)?.from || null
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getOptimalFusionPath:", error);
      throw error;
    }
  }

  // === MÉTHODES PRIVÉES ===

  private static getNextAscensionLevel(currentRarity: string, currentStars: number): { rarity: string; stars: number } | null {
    const currentRarityIndex = this.RARITY_PROGRESSION.indexOf(currentRarity);
    
    if (currentRarity === "Ascended") {
      // Système d'étoiles pour Ascended
      if (currentStars < 5) {
        return { rarity: "Ascended", stars: currentStars + 1 };
      }
      return null; // Maximum atteint
    } else {
      // Progression de rareté normale
      if (currentRarityIndex < this.RARITY_PROGRESSION.length - 2) {
        return { rarity: this.RARITY_PROGRESSION[currentRarityIndex + 1], stars: 0 };
      } else if (currentRarityIndex === this.RARITY_PROGRESSION.length - 2) {
        // Legendary → Ascended 1★
        return { rarity: "Ascended", stars: 1 };
      }
      return null;
    }
  }

  private static async calculateFusionRequirements(
    player: any,
    heroInstance: any,
    heroData: any,
    targetRarity: string,
    targetStars: number
  ): Promise<FusionRequirements> {
    const currentRarity = heroData.rarity;
    const currentStars = (heroInstance as any).ascensionStars || 0;

    let fusionKey = "";
    if (currentRarity !== "Ascended") {
      fusionKey = `${currentRarity}_to_${targetRarity}`;
    } else {
      fusionKey = `Ascended_${currentStars}_to_${targetStars}`;
    }

    const fusionConfig = this.FUSION_REQUIREMENTS[fusionKey];
    if (!fusionConfig) {
      return this.createEmptyRequirements();
    }

    // Trouver les copies disponibles du même héros
    const availableCopies = player.heroes.filter((h: any) => 
      h.heroId._id.toString() === heroData._id.toString() && 
      h._id?.toString() !== heroInstance._id?.toString()
    );

    // Trouver les héros food disponibles (même élément, rareté appropriée)
    const availableFoodHeroes = this.findAvailableFoodHeroes(
      player.heroes,
      heroData.element,
      currentRarity,
      heroInstance._id?.toString()
    );

    const requiredCopies = Math.min(fusionConfig.copies, availableCopies.length);
    const requiredFood = Math.min(fusionConfig.food, availableFoodHeroes.length);

    const baseGoldCost = 1000 * this.RARITY_PROGRESSION.indexOf(currentRarity) + 1;
    const goldCost = Math.floor(baseGoldCost * fusionConfig.goldMultiplier);

    return {
      mainHero: heroInstance._id?.toString() || "",
      copies: availableCopies.slice(0, requiredCopies).map(h => h._id?.toString() || ""),
      foodHeroes: availableFoodHeroes.slice(0, requiredFood).map(h => h._id?.toString() || ""),
      materials: fusionConfig.materials,
      gold: goldCost
    };
  }

  private static findAvailableFoodHeroes(
    allHeroes: any[],
    requiredElement: string,
    minRarity: string,
    excludeId?: string
  ): any[] {
    const minRarityIndex = this.RARITY_PROGRESSION.indexOf(minRarity);
    
    return allHeroes.filter(hero => {
      if (hero._id?.toString() === excludeId) return false;
      if (hero.equipped) return false; // Ne pas utiliser les héros équipés
      
      const heroData = hero.heroId;
      if (!heroData) return false;
      
      // Même élément requis
      if (heroData.element !== requiredElement) return false;
      
      // Rareté appropriée pour food
      const heroRarityIndex = this.RARITY_PROGRESSION.indexOf(heroData.rarity);
      return heroRarityIndex >= 0 && heroRarityIndex <= minRarityIndex;
    });
  }

  private static async validateRequirements(
    player: any,
    requirements: FusionRequirements
  ): Promise<string[]> {
    const missing: string[] = [];

    // Vérifier l'or
    if (player.gold < requirements.gold) {
      missing.push(`Gold: need ${requirements.gold}, have ${player.gold}`);
    }

    // Vérifier les matériaux
    for (const [materialId, quantity] of Object.entries(requirements.materials)) {
      const available = player.materials.get(materialId) || 0;
      if (available < quantity) {
        missing.push(`${materialId}: need ${quantity}, have ${available}`);
      }
    }

    // Vérifier les copies
    const actualCopies = player.heroes.filter((h: any) => 
      requirements.copies.includes(h._id?.toString() || "")
    ).length;
    if (actualCopies < requirements.copies.length) {
      missing.push(`Hero copies: need ${requirements.copies.length}, have ${actualCopies}`);
    }

    // Vérifier les food heroes
    const actualFood = player.heroes.filter((h: any) => 
      requirements.foodHeroes.includes(h._id?.toString() || "")
    ).length;
    if (actualFood < requirements.foodHeroes.length) {
      missing.push(`Food heroes: need ${requirements.foodHeroes.length}, have ${actualFood}`);
    }

    return missing;
  }

  private static async validateFusionRequest(
    player: any,
    heroInstance: any,
    requirements: FusionRequirements
  ): Promise<{ valid: boolean; error?: string }> {
    // Validation anti-cheat côté serveur

    // 1. Vérifier que le héros principal existe et appartient au joueur
    if (requirements.mainHero !== (heroInstance._id?.toString() || "")) {
      return { valid: false, error: "Main hero ID mismatch" };
    }

    // 2. Vérifier que tous les héros requis appartiennent au joueur
    const allRequiredIds = [...requirements.copies, ...requirements.foodHeroes];
    for (const requiredId of allRequiredIds) {
      const ownedHero = player.heroes.find((h: any) => h._id?.toString() === requiredId);
      if (!ownedHero) {
        return { valid: false, error: `Hero ${requiredId} not owned by player` };
      }
      if (ownedHero.equipped) {
        return { valid: false, error: `Cannot consume equipped hero ${requiredId}` };
      }
    }

    // 3. Vérifier qu'on ne consomme pas le héros principal
    if (allRequiredIds.includes(requirements.mainHero)) {
      return { valid: false, error: "Cannot consume main hero" };
    }

    // 4. Vérifier les doublons
    const uniqueIds = new Set(allRequiredIds);
    if (uniqueIds.size !== allRequiredIds.length) {
      return { valid: false, error: "Duplicate heroes in requirements" };
    }

    return { valid: true };
  }

  private static calculateAscendedStats(
    heroData: any,
    level: number,
    rarity: string,
    stars: number
  ) {
    const baseStats = heroData.baseStats;
    const levelMultiplier = 1 + (level - 1) * 0.08;
    
    // Multiplicateur de rareté
    const rarityMultipliers: Record<string, number> = {
      "Common": 1.0,
      "Rare": 1.3,
      "Epic": 1.7,
      "Legendary": 2.2,
      "Ascended": 3.0
    };
    
    const rarityMultiplier = rarityMultipliers[rarity] || 1.0;
    
    // Bonus d'étoiles pour Ascended
    const starMultiplier = rarity === "Ascended" ? 1 + (stars * 0.2) : 1.0;
    
    const totalMultiplier = levelMultiplier * rarityMultiplier * starMultiplier;

    return {
      hp: Math.floor(baseStats.hp * totalMultiplier),
      atk: Math.floor(baseStats.atk * totalMultiplier),
      def: Math.floor(baseStats.def * totalMultiplier),
      crit: Math.min(100, baseStats.crit * (1 + (totalMultiplier - 1) * 0.3)),
      critDamage: Math.floor(baseStats.critDamage * (1 + (totalMultiplier - 1) * 0.2)),
      vitesse: Math.floor(baseStats.vitesse * (1 + (totalMultiplier - 1) * 0.5)),
      moral: Math.floor(baseStats.moral * (1 + (totalMultiplier - 1) * 0.4))
    };
  }

  private static calculateStatsDifference(current: any, after: any) {
    const gained: any = {};
    for (const stat in current) {
      gained[stat] = after[stat] - current[stat];
    }
    return gained;
  }

  private static calculatePower(stats: any): number {
    return Math.floor(
      stats.atk * 1.0 + 
      stats.def * 1.5 + 
      stats.hp / 10 + 
      stats.vitesse * 0.5 + 
      stats.crit * 2 + 
      stats.critDamage * 0.1
    );
  }

  private static createEmptyRequirements(): FusionRequirements {
    return {
      mainHero: "",
      copies: [],
      foodHeroes: [],
      materials: {},
      gold: 0
    };
  }

  private static groupByRarity(heroes: any[]) {
    const groups: Record<string, number> = {};
    for (const rarity of this.RARITY_PROGRESSION) {
      groups[rarity] = heroes.filter(h => h.currentRarity === rarity).length;
    }
    return groups;
  }

  private static canAffordPath(player: any, totalCost: any): boolean {
    // Vérifier l'or
    if (player.gold < totalCost.gold) return false;
    
    // Vérifier les matériaux
    for (const [materialId, quantity] of Object.entries(totalCost.materials)) {
      const available = player.materials.get(materialId) || 0;
      if (available < quantity) return false;
    }
    
    return true;
  }

  private static async saveFusionHistory(historyEntry: FusionHistory): Promise<void> {
    // Dans un vrai projet, ceci serait sauvé dans MongoDB
    // Pour cet exemple, on simule avec un stockage en mémoire
    console.log(`📖 Fusion history saved: ${historyEntry.fromRarity}${historyEntry.fromStars}★ → ${historyEntry.toRarity}${historyEntry.toStars}★`);
    
    // Ici vous pourriez créer un modèle FusionHistory et le sauvegarder :
    // const history = new FusionHistory(historyEntry);
    // await history.save();
  }

  private static async loadFusionHistory(playerId: string, limit: number): Promise<FusionHistory[]> {
    // Dans un vrai projet, ceci chargerait depuis MongoDB
    // Pour cet exemple, on retourne un historique simulé
    return [
      {
        _id: "fusion_001",
        playerId,
        mainHeroId: "hero_001",
        fromRarity: "Epic",
        fromStars: 0,
        toRarity: "Legendary",
        toStars: 0,
        consumedHeroes: [
          { heroId: "hero_002", heroName: "Fire Knight Copy", rarity: "Epic", role: "copy" },
          { heroId: "hero_003", heroName: "Wind Warrior", rarity: "Epic", role: "food" }
        ],
        cost: { gold: 4000, materials: { "fusion_crystal": 20, "elemental_essence": 8 } },
        timestamp: new Date(Date.now() - 86400000) // Il y a 1 jour
      }
    ];
  }

  private static calculateRarityAchievements(history: FusionHistory[]) {
    const achievements: Record<string, number> = {};
    for (const entry of history) {
      achievements[entry.toRarity] = (achievements[entry.toRarity] || 0) + 1;
    }
    return achievements;
  }

  private static async updateProgressTracking(
    playerId: string,
    serverId: string,
    newRarity: string,
    newStars: number
  ) {
    try {
      await Promise.all([
        MissionService.updateProgress(
          playerId,
          serverId,
          "heroes_owned",
          1,
          { rarity: newRarity, stars: newStars }
        ),
        EventService.updatePlayerProgress(
          playerId,
          serverId,
          "collect_items",
          1,
          { itemType: "hero_fusion", rarity: newRarity, stars: newStars }
        )
      ]);

      console.log(`📊 Progression fusion mise à jour: ${newRarity} ${newStars}★`);
    } catch (error) {
      console.error("⚠️ Erreur mise à jour progression fusion:", error);
    }
  }

  // === MÉTHODES UTILITAIRES PUBLIQUES ===

  /**
   * Obtient les statistiques de fusion d'un joueur
   */
  public static async getFusionStats(playerId: string, serverId: string) {
    try {
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const stats = {
        totalHeroes: player.heroes.length,
        rarityDistribution: {} as Record<string, number>,
        ascendedHeroes: 0,
        maxStarHeroes: 0,
        averageAscensionLevel: 0,
        totalPower: 0,
        fusionPotential: {
          readyToFuse: 0,
          needMaterials: 0,
          needCopies: 0,
          maxLevel: 0
        }
      };

      // Initialiser la distribution de rareté
      for (const rarity of this.RARITY_PROGRESSION) {
        stats.rarityDistribution[rarity] = 0;
      }

      let totalAscensionValue = 0;

      for (const heroInstance of player.heroes) {
        const heroData = heroInstance.heroId as any;
        const rarity = heroData.rarity;
        const stars = (heroInstance as any).ascensionStars || 0;

        stats.rarityDistribution[rarity]++;

        if (rarity === "Ascended") {
          stats.ascendedHeroes++;
          if (stars === 5) {
            stats.maxStarHeroes++;
          }
        }

        // Calculer la valeur d'ascension (pour moyenne)
        const rarityValue = this.RARITY_PROGRESSION.indexOf(rarity);
        const ascensionValue = rarityValue + (rarity === "Ascended" ? stars * 0.2 : 0);
        totalAscensionValue += ascensionValue;

        // Calculer la puissance
        const currentStats = this.calculateAscendedStats(heroData, heroInstance.level, rarity, stars);
        stats.totalPower += this.calculatePower(currentStats);

        // Analyser le potentiel de fusion
        const nextLevel = this.getNextAscensionLevel(rarity, stars);
        if (nextLevel) {
          const requirements = await this.calculateFusionRequirements(
            player,
            heroInstance,
            heroData,
            nextLevel.rarity,
            nextLevel.stars
          );
          const missing = await this.validateRequirements(player, requirements);
          
          if (missing.length === 0) {
            stats.fusionPotential.readyToFuse++;
          } else if (missing.some(m => m.includes("copies"))) {
            stats.fusionPotential.needCopies++;
          } else {
            stats.fusionPotential.needMaterials++;
          }
        } else {
          stats.fusionPotential.maxLevel++;
        }
      }

      stats.averageAscensionLevel = totalAscensionValue / stats.totalHeroes;

      return {
        success: true,
        stats,
        recommendations: this.generateFusionRecommendations(stats, player)
      };

    } catch (error: any) {
      console.error("❌ Erreur getFusionStats:", error);
      throw error;
    }
  }

  /**
   * Simule une fusion pour prévisualiser les résultats
   */
  public static simulateFusion(
    heroBaseStats: any,
    currentLevel: number,
    fromRarity: string,
    fromStars: number,
    toRarity: string,
    toStars: number
  ) {
    const beforeStats = this.calculateAscendedStats(
      { baseStats: heroBaseStats },
      currentLevel,
      fromRarity,
      fromStars
    );

    const afterStats = this.calculateAscendedStats(
      { baseStats: heroBaseStats },
      currentLevel,
      toRarity,
      toStars
    );

    const powerBefore = this.calculatePower(beforeStats);
    const powerAfter = this.calculatePower(afterStats);

    return {
      before: {
        rarity: fromRarity,
        stars: fromStars,
        stats: beforeStats,
        power: powerBefore
      },
      after: {
        rarity: toRarity,
        stars: toStars,
        stats: afterStats,
        power: powerAfter
      },
      gains: {
        stats: this.calculateStatsDifference(beforeStats, afterStats),
        power: powerAfter - powerBefore,
        powerPercentage: Math.round(((powerAfter - powerBefore) / powerBefore) * 100)
      }
    };
  }

  /**
   * Calcule le coût total pour atteindre un niveau d'ascension spécifique
   */
  public static calculateFullAscensionCost(
    fromRarity: string,
    fromStars: number,
    toRarity: string,
    toStars: number
  ) {
    const totalCost = {
      gold: 0,
      materials: {} as Record<string, number>,
      heroesNeeded: {
        copies: 0,
        food: 0
      }
    };

    let currentRarity = fromRarity;
    let currentStars = fromStars;

    while (currentRarity !== toRarity || currentStars !== toStars) {
      const nextLevel = this.getNextAscensionLevel(currentRarity, currentStars);
      if (!nextLevel) break;

      let fusionKey = "";
      if (currentRarity !== "Ascended") {
        fusionKey = `${currentRarity}_to_${nextLevel.rarity}`;
      } else {
        fusionKey = `Ascended_${currentStars}_to_${nextLevel.stars}`;
      }

      const fusionConfig = this.FUSION_REQUIREMENTS[fusionKey];
      if (fusionConfig) {
        // Additionner les coûts
        const baseGoldCost = 1000 * (this.RARITY_PROGRESSION.indexOf(currentRarity) + 1);
        totalCost.gold += Math.floor(baseGoldCost * fusionConfig.goldMultiplier);

        // Additionner les matériaux
        for (const [materialId, quantity] of Object.entries(fusionConfig.materials)) {
          totalCost.materials[materialId] = (totalCost.materials[materialId] || 0) + quantity;
        }

        // Additionner les héros nécessaires
        totalCost.heroesNeeded.copies += fusionConfig.copies;
        totalCost.heroesNeeded.food += fusionConfig.food;
      }

      currentRarity = nextLevel.rarity;
      currentStars = nextLevel.stars;
    }

    return totalCost;
  }

  private static generateFusionRecommendations(stats: any, player: any): string[] {
    const recommendations: string[] = [];

    if (stats.fusionPotential.readyToFuse > 0) {
      recommendations.push(`${stats.fusionPotential.readyToFuse} heroes ready for fusion!`);
    }

    if (stats.fusionPotential.needCopies > stats.fusionPotential.needMaterials) {
      recommendations.push("Focus on summoning for hero copies");
    } else if (stats.fusionPotential.needMaterials > 0) {
      recommendations.push("Farm materials for fusion upgrades");
    }

    if (stats.ascendedHeroes < 3) {
      recommendations.push("Priority: Get your first 3 Ascended heroes");
    }

    const commonHeroes = stats.rarityDistribution["Common"] || 0;
    if (commonHeroes > 10) {
      recommendations.push("Use excess Common heroes as fusion food");
    }

    if (stats.averageAscensionLevel < 2.0) {
      recommendations.push("Focus on upgrading your strongest heroes first");
    }

    return recommendations;
  }
}

import Player from "../models/Player";
import Hero from "../models/Hero";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";

export interface UpgradeResult {
  success: boolean;
  hero?: any;
  previousStats?: any;
  newStats?: any;
  cost?: any;
  error?: string;
  code?: string;
}

export interface UpgradeCosts {
  gold: number;
  materials: Record<string, number>;
  fragments?: number;
  gems?: number;
}

export interface HeroStats {
  hp: number;
  atk: number;
  def: number;
  defMagique: number;
  vitesse: number;
  intelligence: number;
  force: number;
  moral: number;
  powerScore: number;
}

export interface AwakeningBonus {
  statMultiplier: number;
  newSkillUnlocked?: boolean;
  specialAbility?: string;
  awakening1: boolean;
  awakening2: boolean;
  awakening3: boolean;
  awakening4: boolean;
  awakening5: boolean;
}

export class HeroUpgradeService {

  // === MONTÉE DE NIVEAU D'UN HÉROS ===
  public static async levelUpHero(
    playerId: string,
    heroId: string,
    targetLevel?: number
  ): Promise<UpgradeResult> {
    try {
      console.log(`📈 Level up héros ${heroId} pour ${playerId} (target: ${targetLevel})`);

      const [player, heroData] = await Promise.all([
        Player.findById(playerId),
        Hero.findById(heroId)
      ]);

      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      if (!heroData) {
        return { success: false, error: "Hero data not found", code: "HERO_DATA_NOT_FOUND" };
      }

      // Trouver le héros dans la collection du joueur
      const playerHero = player.heroes.find(h => h.heroId.toString() === heroId);
      if (!playerHero) {
        return { success: false, error: "Hero not owned", code: "HERO_NOT_OWNED" };
      }

      // Déterminer le niveau cible (max 100)
      const maxLevel = 100;
      const currentLevel = playerHero.level;
      const finalTargetLevel = targetLevel ? 
        Math.min(targetLevel, maxLevel) : 
        Math.min(currentLevel + 1, maxLevel);

      if (finalTargetLevel <= currentLevel) {
        return { success: false, error: "Target level must be higher than current", code: "INVALID_TARGET_LEVEL" };
      }

      // Calculer les coûts
      const levelDifference = finalTargetLevel - currentLevel;
      const costs = this.calculateLevelUpCosts(currentLevel, finalTargetLevel, heroData.rarity);

      // Vérifier les ressources
      const resourceCheck = this.checkPlayerResources(player, costs);
      if (!resourceCheck.sufficient) {
        return {
          success: false,
          error: `Insufficient resources: ${resourceCheck.missing.join(", ")}`,
          code: "INSUFFICIENT_RESOURCES"
        };
      }

      // Sauvegarder les stats actuelles
      const previousStats = this.calculateHeroStats(heroData, currentLevel, playerHero.stars);

      // Effectuer la montée de niveau
      playerHero.level = finalTargetLevel;
      
      // Déduire les coûts
      this.deductResources(player, costs);
      
      // Calculer les nouvelles stats
      const newStats = this.calculateHeroStats(heroData, finalTargetLevel, playerHero.stars);

      await player.save();

      // Mettre à jour les missions et événements
      await this.updateProgressTracking(playerId, "hero_levelup", levelDifference);

      console.log(`✅ Héros ${heroData.name} niveau ${currentLevel} → ${finalTargetLevel}`);

      return {
        success: true,
        hero: {
          heroId,
          name: heroData.name,
          level: finalTargetLevel,
          stars: playerHero.stars
        },
        previousStats,
        newStats,
        cost: costs
      };

    } catch (error: any) {
      console.error("❌ Erreur levelUpHero:", error);
      return { success: false, error: error.message, code: "LEVEL_UP_FAILED" };
    }
  }

  // === MONTÉE EN ÉTOILES D'UN HÉROS ===
  public static async starUpHero(
    playerId: string,
    heroId: string,
    targetStars?: number
  ): Promise<UpgradeResult> {
    try {
      console.log(`⭐ Star up héros ${heroId} pour ${playerId} (target: ${targetStars})`);

      const [player, heroData] = await Promise.all([
        Player.findById(playerId),
        Hero.findById(heroId)
      ]);

      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      if (!heroData) {
        return { success: false, error: "Hero data not found", code: "HERO_DATA_NOT_FOUND" };
      }

      const playerHero = player.heroes.find(h => h.heroId.toString() === heroId);
      if (!playerHero) {
        return { success: false, error: "Hero not owned", code: "HERO_NOT_OWNED" };
      }

      // Déterminer les étoiles cibles (max 6)
      const maxStars = 6;
      const currentStars = playerHero.stars;
      const finalTargetStars = targetStars ? 
        Math.min(targetStars, maxStars) : 
        Math.min(currentStars + 1, maxStars);

      if (finalTargetStars <= currentStars) {
        return { success: false, error: "Target stars must be higher than current", code: "INVALID_TARGET_STARS" };
      }

      // Calculer les coûts (beaucoup de fragments requis)
      const starDifference = finalTargetStars - currentStars;
      const costs = this.calculateStarUpCosts(currentStars, finalTargetStars, heroData.rarity);

      // Vérifier les fragments spécifiquement
      const availableFragments = player.fragments.get(heroId) || 0;
      if (costs.fragments && availableFragments < costs.fragments) {
        return {
          success: false,
          error: `Insufficient hero fragments. Need: ${costs.fragments}, Have: ${availableFragments}`,
          code: "INSUFFICIENT_FRAGMENTS"
        };
      }

      // Vérifier les autres ressources
      const resourceCheck = this.checkPlayerResources(player, costs);
      if (!resourceCheck.sufficient) {
        return {
          success: false,
          error: `Insufficient resources: ${resourceCheck.missing.join(", ")}`,
          code: "INSUFFICIENT_RESOURCES"
        };
      }

      // Sauvegarder les stats actuelles
      const previousStats = this.calculateHeroStats(heroData, playerHero.level, currentStars);

      // Effectuer la montée en étoiles
      playerHero.stars = finalTargetStars;
      
      // Déduire les coûts
      this.deductResources(player, costs);
      if (costs.fragments) {
        const currentFragments = player.fragments.get(heroId) || 0;
        player.fragments.set(heroId, currentFragments - costs.fragments);
      }
      
      // Calculer les nouvelles stats
      const newStats = this.calculateHeroStats(heroData, playerHero.level, finalTargetStars);

      await player.save();

      // Mettre à jour les missions et événements
      await this.updateProgressTracking(playerId, "hero_starup", starDifference);

      console.log(`✅ Héros ${heroData.name} étoiles ${currentStars} → ${finalTargetStars}`);

      return {
        success: true,
        hero: {
          heroId,
          name: heroData.name,
          level: playerHero.level,
          stars: finalTargetStars
        },
        previousStats,
        newStats,
        cost: costs
      };

    } catch (error: any) {
      console.error("❌ Erreur starUpHero:", error);
      return { success: false, error: error.message, code: "STAR_UP_FAILED" };
    }
  }

  // === AWAKENING D'UN HÉROS ===
  public static async awakenHero(
    playerId: string,
    heroId: string,
    awakeningLevel: 1 | 2 | 3 | 4 | 5
  ): Promise<UpgradeResult> {
    try {
      console.log(`🌟 Awakening ${awakeningLevel} héros ${heroId} pour ${playerId}`);

      const [player, heroData] = await Promise.all([
        Player.findById(playerId),
        Hero.findById(heroId)
      ]);

      if (!player || !heroData) {
        return { success: false, error: "Player or hero data not found", code: "NOT_FOUND" };
      }

      const playerHero = player.heroes.find(h => h.heroId.toString() === heroId);
      if (!playerHero) {
        return { success: false, error: "Hero not owned", code: "HERO_NOT_OWNED" };
      }

      // Vérifications des prérequis pour awakening
      const prerequisites = this.checkAwakeningPrerequisites(playerHero, awakeningLevel);
      if (!prerequisites.canAwaken) {
        return { success: false, error: prerequisites.reason, code: "AWAKENING_PREREQUISITES_NOT_MET" };
      }

      // Calculer les coûts d'awakening (très chers)
      const costs = this.calculateAwakeningCosts(awakeningLevel, heroData.rarity);

      // Vérifier les ressources
      const resourceCheck = this.checkPlayerResources(player, costs);
      if (!resourceCheck.sufficient) {
        return {
          success: false,
          error: `Insufficient resources for awakening: ${resourceCheck.missing.join(", ")}`,
          code: "INSUFFICIENT_RESOURCES"
        };
      }

      // Sauvegarder les stats actuelles
      const previousStats = this.calculateHeroStats(heroData, playerHero.level, playerHero.stars);

      // Effectuer l'awakening
      if (!playerHero.awakening) {
        playerHero.awakening = {
          awakening1: false,
          awakening2: false,
          awakening3: false,
          awakening4: false,
          awakening5: false
        };
      }

      // Activer le niveau d'awakening
      (playerHero.awakening as any)[`awakening${awakeningLevel}`] = true;
      
      // Déduire les coûts
      this.deductResources(player, costs);
      
      // Calculer les nouvelles stats avec bonus d'awakening
      const newStats = this.calculateHeroStatsWithAwakening(heroData, playerHero.level, playerHero.stars, playerHero.awakening);

      await player.save();

      // Mettre à jour les missions et événements
      await this.updateProgressTracking(playerId, "hero_awakening", 1);

      console.log(`✅ Héros ${heroData.name} awakening ${awakeningLevel} réussi`);

      return {
        success: true,
        hero: {
          heroId,
          name: heroData.name,
          level: playerHero.level,
          stars: playerHero.stars,
          awakening: playerHero.awakening
        },
        previousStats,
        newStats,
        cost: costs
      };

    } catch (error: any) {
      console.error("❌ Erreur awakenHero:", error);
      return { success: false, error: error.message, code: "AWAKENING_FAILED" };
    }
  }

  // === RÉCUPÉRER LES COÛTS D'AMÉLIORATION ===
  public static async getUpgradeCosts(
    playerId: string,
    heroId: string,
    upgradeType: "level" | "star" | "awakening",
    targetValue?: number
  ) {
    try {
      const [player, heroData] = await Promise.all([
        Player.findById(playerId),
        Hero.findById(heroId)
      ]);

      if (!player || !heroData) {
        throw new Error("Player or hero data not found");
      }

      const playerHero = player.heroes.find(h => h.heroId.toString() === heroId);
      if (!playerHero) {
        throw new Error("Hero not owned");
      }

      let costs: UpgradeCosts;
      let canUpgrade = true;
      let reason = "";

      switch (upgradeType) {
        case "level":
          const targetLevel = targetValue || playerHero.level + 1;
          costs = this.calculateLevelUpCosts(playerHero.level, targetLevel, heroData.rarity);
          if (targetLevel > 100) {
            canUpgrade = false;
            reason = "Max level reached (100)";
          }
          break;

        case "star":
          const targetStars = targetValue || playerHero.stars + 1;
          costs = this.calculateStarUpCosts(playerHero.stars, targetStars, heroData.rarity);
          if (targetStars > 6) {
            canUpgrade = false;
            reason = "Max stars reached (6)";
          }
          break;

        case "awakening":
          const awakeningLevel = targetValue as (1 | 2 | 3 | 4 | 5);
          costs = this.calculateAwakeningCosts(awakeningLevel, heroData.rarity);
          const prerequisites = this.checkAwakeningPrerequisites(playerHero, awakeningLevel);
          if (!prerequisites.canAwaken) {
            canUpgrade = false;
            reason = prerequisites.reason || "Prerequisites not met";
          }
          break;

        default:
          throw new Error("Invalid upgrade type");
      }

      // Vérifier les ressources disponibles
      const resourceCheck = this.checkPlayerResources(player, costs);

      return {
        success: true,
        upgradeType,
        targetValue,
        costs,
        canUpgrade: canUpgrade && resourceCheck.sufficient,
        reason: canUpgrade ? (resourceCheck.sufficient ? "" : `Missing: ${resourceCheck.missing.join(", ")}`) : reason,
        playerResources: {
          gold: player.gold,
          gems: player.gems,
          fragments: player.fragments.get(heroId) || 0,
          materials: Object.fromEntries(player.materials.entries())
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getUpgradeCosts:", error);
      throw error;
    }
  }

  // === RÉCUPÉRER LES STATS D'UN HÉROS ===
  public static async getHeroStats(playerId: string, heroId: string) {
    try {
      const [player, heroData] = await Promise.all([
        Player.findById(playerId),
        Hero.findById(heroId)
      ]);

      if (!player || !heroData) {
        throw new Error("Player or hero data not found");
      }

      const playerHero = player.heroes.find(h => h.heroId.toString() === heroId);
      if (!playerHero) {
        throw new Error("Hero not owned");
      }

      // Calculer les stats avec et sans awakening
      const baseStats = this.calculateHeroStats(heroData, playerHero.level, playerHero.stars);
      const finalStats = playerHero.awakening ? 
        this.calculateHeroStatsWithAwakening(heroData, playerHero.level, playerHero.stars, playerHero.awakening) :
        baseStats;

      return {
        success: true,
        hero: {
          heroId,
          name: heroData.name,
          level: playerHero.level,
          stars: playerHero.stars,
          awakening: playerHero.awakening,
          rarity: heroData.rarity,
          element: heroData.element,
          role: heroData.role
        },
        stats: {
          base: baseStats,
          final: finalStats,
          awakeningBonus: playerHero.awakening ? this.getAwakeningBonus(playerHero.awakening) : null
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getHeroStats:", error);
      throw error;
    }
  }

  // === MÉTHODES PRIVÉES DE CALCUL ===

  // Calculer les coûts de montée de niveau
  private static calculateLevelUpCosts(currentLevel: number, targetLevel: number, rarity: string): UpgradeCosts {
    const levelDiff = targetLevel - currentLevel;
    const rarityMultiplier = this.getRarityMultiplier(rarity);

    // Coût progressif selon le niveau
    const baseGoldPerLevel = 1000 + currentLevel * 50;
    const totalGold = Math.floor(baseGoldPerLevel * levelDiff * rarityMultiplier);

    return {
      gold: totalGold,
      materials: {
        "exp_potion": levelDiff * 2,
        "enhancement_stone": Math.floor(levelDiff / 5) + 1
      }
    };
  }

  // Calculer les coûts de montée en étoiles
  private static calculateStarUpCosts(currentStars: number, targetStars: number, rarity: string): UpgradeCosts {
    const starDiff = targetStars - currentStars;
    const rarityMultiplier = this.getRarityMultiplier(rarity);

    // Coût exponentiel pour les étoiles
    let totalFragments = 0;
    let totalGold = 0;

    for (let star = currentStars + 1; star <= targetStars; star++) {
      const fragmentsNeeded = this.getFragmentsForStar(star, rarity);
      const goldNeeded = fragmentsNeeded * 100 * rarityMultiplier;
      
      totalFragments += fragmentsNeeded;
      totalGold += goldNeeded;
    }

    return {
      gold: Math.floor(totalGold),
      fragments: totalFragments,
      materials: {
        "star_crystal": starDiff,
        "essence_orb": starDiff * 2
      }
    };
  }

  // Calculer les coûts d'awakening
  private static calculateAwakeningCosts(awakeningLevel: number, rarity: string): UpgradeCosts {
    const rarityMultiplier = this.getRarityMultiplier(rarity);
    const levelMultiplier = awakeningLevel * 2;

    return {
      gold: Math.floor(50000 * levelMultiplier * rarityMultiplier),
      gems: 100 * awakeningLevel,
      materials: {
        "awakening_crystal": awakeningLevel,
        "soul_essence": awakeningLevel * 5,
        "divine_fragment": awakeningLevel * 2
      }
    };
  }

  // Calculer les stats de base d'un héros
  private static calculateHeroStats(heroData: any, level: number, stars: number): HeroStats {
    const baseStats = heroData.baseStats;
    const levelMultiplier = 1 + (level - 1) * 0.08;
    const starMultiplier = 1 + (stars - 1) * 0.15;
    const totalMultiplier = levelMultiplier * starMultiplier;

    const finalStats = {
      hp: Math.floor(baseStats.hp * totalMultiplier),
      atk: Math.floor(baseStats.atk * totalMultiplier),
      def: Math.floor(baseStats.def * totalMultiplier),
      defMagique: Math.floor((baseStats.defMagique || baseStats.def * 0.8) * totalMultiplier),
      vitesse: Math.floor((baseStats.vitesse || 80) * Math.min(1.5, totalMultiplier * 0.6)),
      intelligence: Math.floor((baseStats.intelligence || 70) * totalMultiplier),
      force: Math.floor((baseStats.force || 80) * totalMultiplier),
      moral: Math.floor((baseStats.moral || 60) * totalMultiplier * 0.8),
      powerScore: 0
    };

    // Calculer le Power Score
    finalStats.powerScore = Math.floor(
      finalStats.atk * 1 + 
      finalStats.def * 2 + 
      finalStats.hp / 10 +
      finalStats.intelligence * 0.5 +
      finalStats.vitesse * 0.3
    );

    return finalStats;
  }

  // Calculer les stats avec awakening
  private static calculateHeroStatsWithAwakening(heroData: any, level: number, stars: number, awakening: any): HeroStats {
    const baseStats = this.calculateHeroStats(heroData, level, stars);
    const awakeningBonus = this.getAwakeningBonus(awakening);

    // Appliquer le multiplicateur d'awakening
    const multiplier = awakeningBonus.statMultiplier;

    return {
      hp: Math.floor(baseStats.hp * multiplier),
      atk: Math.floor(baseStats.atk * multiplier),
      def: Math.floor(baseStats.def * multiplier),
      defMagique: Math.floor(baseStats.defMagique * multiplier),
      vitesse: Math.floor(baseStats.vitesse * Math.min(1.3, multiplier)),
      intelligence: Math.floor(baseStats.intelligence * multiplier),
      force: Math.floor(baseStats.force * multiplier),
      moral: Math.floor(baseStats.moral * multiplier),
      powerScore: Math.floor(baseStats.powerScore * multiplier * 1.2)
    };
  }

  // === MÉTHODES UTILITAIRES ===

  // Vérifier les ressources du joueur
  private static checkPlayerResources(player: any, costs: UpgradeCosts): { sufficient: boolean; missing: string[] } {
    const missing: string[] = [];

    if (costs.gold > player.gold) missing.push(`gold (${costs.gold - player.gold} needed)`);
    if (costs.gems && costs.gems > (player.gems || 0)) missing.push(`gems (${costs.gems - (player.gems || 0)} needed)`);

    // Vérifier les matériaux
    if (costs.materials) {
      for (const [materialId, required] of Object.entries(costs.materials)) {
        const available = player.materials.get(materialId) || 0;
        if (available < required) {
          missing.push(`${materialId} (${required - available} needed)`);
        }
      }
    }

    return {
      sufficient: missing.length === 0,
      missing
    };
  }

  // Déduire les ressources
  private static deductResources(player: any, costs: UpgradeCosts) {
    player.gold -= costs.gold;
    if (costs.gems) player.gems -= costs.gems;

    // Déduire les matériaux
    if (costs.materials) {
      for (const [materialId, cost] of Object.entries(costs.materials)) {
        const current = player.materials.get(materialId) || 0;
        player.materials.set(materialId, current - cost);
      }
    }
  }

  // Obtenir le multiplicateur de rareté
  private static getRarityMultiplier(rarity: string): number {
    const multipliers: Record<string, number> = {
      "Common": 1.0,
      "Rare": 1.3,
      "Epic": 1.7,
      "Legendary": 2.5
    };
    return multipliers[rarity] || 1.0;
  }

  // Obtenir les fragments nécessaires pour une étoile
  private static getFragmentsForStar(starLevel: number, rarity: string): number {
    const baseFragments: Record<number, number> = {
      2: 20,
      3: 40,
      4: 80,
      5: 150,
      6: 300
    };

    const rarityMultiplier = this.getRarityMultiplier(rarity);
    return Math.floor((baseFragments[starLevel] || 20) * rarityMultiplier);
  }

  // Vérifier les prérequis d'awakening
  private static checkAwakeningPrerequisites(playerHero: any, awakeningLevel: number): { canAwaken: boolean; reason?: string } {
    // Vérifications de base
    if (playerHero.level < 60) {
      return { canAwaken: false, reason: "Hero must be level 60+ for awakening" };
    }

    if (playerHero.stars < 4) {
      return { canAwaken: false, reason: "Hero must be 4+ stars for awakening" };
    }

    // Vérifier les awakenings précédents
    if (awakeningLevel > 1) {
      const previousAwakening = `awakening${awakeningLevel - 1}`;
      if (!playerHero.awakening || !playerHero.awakening[previousAwakening]) {
        return { canAwaken: false, reason: `Must complete awakening ${awakeningLevel - 1} first` };
      }
    }

    // Vérifier si déjà fait
    if (playerHero.awakening && playerHero.awakening[`awakening${awakeningLevel}`]) {
      return { canAwaken: false, reason: `Awakening ${awakeningLevel} already completed` };
    }

    return { canAwaken: true };
  }

  // Obtenir le bonus d'awakening
  private static getAwakeningBonus(awakening: any): AwakeningBonus {
    let statMultiplier = 1.0;
    let awakeningCount = 0;

    for (let i = 1; i <= 5; i++) {
      if (awakening[`awakening${i}`]) {
        awakeningCount++;
        statMultiplier += 0.15; // +15% par awakening
      }
    }

    return {
      statMultiplier,
      newSkillUnlocked: awakeningCount >= 3,
      specialAbility: awakeningCount === 5 ? "Divine Transcendence" : undefined,
      awakening1: awakening.awakening1 || false,
      awakening2: awakening.awakening2 || false,
      awakening3: awakening.awakening3 || false,
      awakening4: awakening.awakening4 || false,
      awakening5: awakening.awakening5 || false
    };
  }

  // Mettre à jour les missions et événements
  private static async updateProgressTracking(playerId: string, progressType: string, value: number) {
    try {
      await Promise.all([
        EventService.updatePlayerProgress(
          playerId,
          "",
          "heroes_owned", // Utiliser un type existant
          value,
          { upgradeType: progressType }
        )
      ]);

      console.log(`📊 Progression événements mise à jour: +${value} ${progressType}`);
    } catch (error) {
      console.error("⚠️ Erreur mise à jour progression héros:", error);
    }
  }

  // === MÉTHODES D'ADMINISTRATION ===

  // Statistiques globales des améliorations
  public static async getUpgradeStats() {
    try {
      const stats = await Player.aggregate([
        { $unwind: "$heroes" },
        { $group: {
          _id: null,
          totalHeroes: { $sum: 1 },
          avgLevel: { $avg: "$heroes.level" },
          avgStars: { $avg: "$heroes.stars" },
          maxLevel: { $max: "$heroes.level" },
          maxStars: { $max: "$heroes.stars" },
          awakenedHeroes: { 
            $sum: { 
              $cond: [{ $ne: ["$heroes.awakening", null] }, 1, 0] 
            }
          }
        }}
      ]);

      return {
        success: true,
        stats: stats[0] || {
          totalHeroes: 0,
          avgLevel: 0,
          avgStars: 0,
          maxLevel: 0,
          maxStars: 0,
          awakenedHeroes: 0
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getUpgradeStats:", error);
      throw error;
    }
  }
}

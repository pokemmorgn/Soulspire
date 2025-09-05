import Player from "../models/Player";
import Hero from "../models/Hero";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { IPlayerHero } from "../types/index";

export interface HeroUpgradeResult {
  success: boolean;
  hero?: any;
  newLevel?: number;
  newStars?: number;
  statsGained?: any;
  cost?: {
    gold?: number;
    fragments?: number;
    materials?: Record<string, number>;
  };
  playerResources?: {
    gold: number;
    fragments: Record<string, number>;
    materials: Record<string, number>;
  };
  error?: string;
  code?: string;
}

export interface SkillUpgradeResult {
  success: boolean;
  skill?: {
    skillId: string;
    oldLevel: number;
    newLevel: number;
    newDescription?: string;
  };
  cost?: Record<string, number>;
  error?: string;
}

export interface EvolutionResult {
  success: boolean;
  hero?: any;
  newRarity?: string;
  statsBonus?: any;
  unlockedSkills?: string[];
  cost?: {
    fragments: number;
    materials: Record<string, number>;
  };
  error?: string;
}

export class HeroUpgradeService {

  public static async levelUpHero(
    playerId: string,
    serverId: string,
    heroInstanceId: string,
    targetLevel?: number
  ): Promise<HeroUpgradeResult> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const heroInstance = player.heroes.find(h => h._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        return { success: false, error: "Hero not found", code: "HERO_NOT_FOUND" };
      }

      const heroData = await Hero.findById(heroInstance.heroId);
      if (!heroData) {
        return { success: false, error: "Hero data not found", code: "HERO_DATA_NOT_FOUND" };
      }

      const currentLevel = heroInstance.level;
      const maxLevel = this.getMaxLevel(heroInstance.stars, player.level);
      const finalTargetLevel = targetLevel ? Math.min(targetLevel, maxLevel) : currentLevel + 1;

      if (currentLevel >= maxLevel) {
        return { success: false, error: "Hero is at maximum level", code: "MAX_LEVEL_REACHED" };
      }

      if (finalTargetLevel <= currentLevel) {
        return { success: false, error: "Invalid target level", code: "INVALID_TARGET_LEVEL" };
      }

      const totalCost = this.calculateLevelUpCost(currentLevel, finalTargetLevel, heroData.rarity);

      if (player.gold < totalCost.gold) {
        return { 
          success: false, 
          error: `Insufficient gold. Required: ${totalCost.gold}, Available: ${player.gold}`, 
          code: "INSUFFICIENT_GOLD" 
        };
      }

      const oldStats = this.calculateHeroStats(heroData, currentLevel, heroInstance.stars);
      
      player.gold -= totalCost.gold;
      heroInstance.level = finalTargetLevel;

      const newStats = this.calculateHeroStats(heroData, finalTargetLevel, heroInstance.stars);
      const statsGained = {
        hp: newStats.hp - oldStats.hp,
        atk: newStats.atk - oldStats.atk,
        def: newStats.def - oldStats.def,
        vitesse: newStats.vitesse - oldStats.vitesse,
        intelligence: newStats.intelligence - oldStats.intelligence,
        force: newStats.force - oldStats.force,
        moral: newStats.moral - oldStats.moral
      };

      await player.save();

      await this.updateProgressTracking(playerId, serverId, "level_up", finalTargetLevel - currentLevel);

      console.log(`⬆️ ${heroData.name} level ${currentLevel} → ${finalTargetLevel} (${totalCost.gold} gold)`);

      return {
        success: true,
        hero: {
          instanceId: heroInstanceId,
          heroData: {
            name: heroData.name,
            rarity: heroData.rarity,
            element: heroData.element,
            role: heroData.role
          },
          level: heroInstance.level,
          stars: heroInstance.stars
        },
        newLevel: finalTargetLevel,
        statsGained,
        cost: totalCost,
        playerResources: {
          gold: player.gold,
          fragments: Object.fromEntries(player.fragments.entries()),
          materials: Object.fromEntries(player.materials.entries())
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur levelUpHero:", error);
      return { success: false, error: error.message, code: "LEVEL_UP_FAILED" };
    }
  }

  public static async upgradeHeroStars(
    playerId: string,
    serverId: string,
    heroInstanceId: string
  ): Promise<HeroUpgradeResult> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const heroInstance = player.heroes.find(h => h._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        return { success: false, error: "Hero not found", code: "HERO_NOT_FOUND" };
      }

      const heroData = await Hero.findById(heroInstance.heroId);
      if (!heroData) {
        return { success: false, error: "Hero data not found", code: "HERO_DATA_NOT_FOUND" };
      }

      const currentStars = heroInstance.stars;
      const maxStars = this.getMaxStars(heroData.rarity);

      if (currentStars >= maxStars) {
        return { success: false, error: "Hero is at maximum stars", code: "MAX_STARS_REACHED" };
      }

      const requiredFragments = this.getStarUpgradeFragmentCost(currentStars, heroData.rarity);
      const currentFragments = player.fragments.get(heroInstance.heroId.toString()) || 0;

      if (currentFragments < requiredFragments) {
        return { 
          success: false, 
          error: `Insufficient fragments. Required: ${requiredFragments}, Available: ${currentFragments}`, 
          code: "INSUFFICIENT_FRAGMENTS" 
        };
      }

      const oldStats = this.calculateHeroStats(heroData, heroInstance.level, currentStars);
      
      player.fragments.set(heroInstance.heroId.toString(), currentFragments - requiredFragments);
      heroInstance.stars = currentStars + 1;

      const newStats = this.calculateHeroStats(heroData, heroInstance.level, heroInstance.stars);
      const statsGained = {
        hp: newStats.hp - oldStats.hp,
        atk: newStats.atk - oldStats.atk,
        def: newStats.def - oldStats.def,
        vitesse: newStats.vitesse - oldStats.vitesse,
        intelligence: newStats.intelligence - oldStats.intelligence,
        force: newStats.force - oldStats.force,
        moral: newStats.moral - oldStats.moral
      };

      await player.save();

      await this.updateProgressTracking(playerId, serverId, "star_upgrade", 1);

      console.log(`⭐ ${heroData.name} ${currentStars} → ${heroInstance.stars} étoiles (${requiredFragments} fragments)`);

      return {
        success: true,
        hero: {
          instanceId: heroInstanceId,
          heroData: {
            name: heroData.name,
            rarity: heroData.rarity,
            element: heroData.element,
            role: heroData.role
          },
          level: heroInstance.level,
          stars: heroInstance.stars
        },
        newStars: heroInstance.stars,
        statsGained,
        cost: { fragments: requiredFragments },
        playerResources: {
          gold: player.gold,
          fragments: Object.fromEntries(player.fragments.entries()),
          materials: Object.fromEntries(player.materials.entries())
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur upgradeHeroStars:", error);
      return { success: false, error: error.message, code: "STAR_UPGRADE_FAILED" };
    }
  }

  public static async upgradeHeroSkill(
    playerId: string,
    serverId: string,
    heroInstanceId: string,
    skillSlot: "spell1" | "spell2" | "spell3" | "ultimate" | "passive"
  ): Promise<SkillUpgradeResult> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return { success: false, error: "Player not found" };
      }

      const heroInstance = player.heroes.find(h => h._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        return { success: false, error: "Hero not found" };
      }

      const heroData = await Hero.findById(heroInstance.heroId);
      if (!heroData) {
        return { success: false, error: "Hero data not found" };
      }

      if (!(heroInstance as any).skills) {
        (heroInstance as any).skills = {
          spell1: { level: 1 },
          spell2: { level: 1 },
          spell3: { level: 1 },
          ultimate: { level: 1 },
          passive: { level: 1 }
        };
      }

      const currentSkillLevel = (heroInstance as any).skills[skillSlot]?.level || 1;
      const maxSkillLevel = this.getMaxSkillLevel(heroInstance.level);

      if (currentSkillLevel >= maxSkillLevel) {
        return { success: false, error: "Skill is at maximum level" };
      }

      const skillCost = this.calculateSkillUpgradeCost(currentSkillLevel, heroData.rarity);

      if (player.gold < skillCost.gold) {
        return { success: false, error: `Insufficient gold. Required: ${skillCost.gold}` };
      }

      const requiredMaterial = `skill_essence_${heroData.element.toLowerCase()}`;
      const currentMaterial = player.materials.get(requiredMaterial) || 0;

      if (currentMaterial < skillCost.materials) {
        return { 
          success: false, 
          error: `Insufficient ${requiredMaterial}. Required: ${skillCost.materials}` 
        };
      }

      player.gold -= skillCost.gold;
      player.materials.set(requiredMaterial, currentMaterial - skillCost.materials);
      
      (heroInstance as any).skills[skillSlot].level = currentSkillLevel + 1;

      await player.save();

      console.log(`🔮 ${heroData.name} ${skillSlot} level ${currentSkillLevel} → ${currentSkillLevel + 1}`);

      return {
        success: true,
        skill: {
          skillId: skillSlot,
          oldLevel: currentSkillLevel,
          newLevel: currentSkillLevel + 1
        },
        cost: {
          gold: skillCost.gold,
          [requiredMaterial]: skillCost.materials
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur upgradeHeroSkill:", error);
      return { success: false, error: error.message };
    }
  }

  public static async evolveHero(
    playerId: string,
    serverId: string,
    heroInstanceId: string
  ): Promise<EvolutionResult> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return { success: false, error: "Player not found" };
      }

      const heroInstance = player.heroes.find(h => h._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        return { success: false, error: "Hero not found" };
      }

      const heroData = await Hero.findById(heroInstance.heroId);
      if (!heroData) {
        return { success: false, error: "Hero data not found" };
      }

      if (!this.canEvolveHero(heroInstance, heroData)) {
        return { success: false, error: "Hero cannot be evolved yet" };
      }

      const evolutionCost = this.calculateEvolutionCost(heroData.rarity);
      
      const currentFragments = player.fragments.get(heroInstance.heroId.toString()) || 0;
      if (currentFragments < evolutionCost.fragments) {
        return { 
          success: false, 
          error: `Insufficient fragments. Required: ${evolutionCost.fragments}` 
        };
      }

      const evolutionMaterials = this.getEvolutionMaterials(heroData.rarity);
      for (const [materialId, quantity] of Object.entries(evolutionMaterials)) {
        const currentQuantity = player.materials.get(materialId) || 0;
        if (currentQuantity < quantity) {
          return { 
            success: false, 
            error: `Insufficient ${materialId}. Required: ${quantity}` 
          };
        }
      }

      const newRarity = this.getNextRarity(heroData.rarity);
      if (!newRarity) {
        return { success: false, error: "Cannot evolve further" };
      }

      player.fragments.set(heroInstance.heroId.toString(), currentFragments - evolutionCost.fragments);
      
      for (const [materialId, quantity] of Object.entries(evolutionMaterials)) {
        const currentQuantity = player.materials.get(materialId) || 0;
        player.materials.set(materialId, currentQuantity - quantity);
      }

      const oldRarity = heroData.rarity;
      (heroData as any).rarity = newRarity;
      
      const evolutionBonus = this.calculateEvolutionStatsBonus(oldRarity, newRarity);
      heroData.baseStats.hp = Math.floor(heroData.baseStats.hp * evolutionBonus.hpMultiplier);
      heroData.baseStats.atk = Math.floor(heroData.baseStats.atk * evolutionBonus.atkMultiplier);
      heroData.baseStats.def = Math.floor(heroData.baseStats.def * evolutionBonus.defMultiplier);

      await Promise.all([
        player.save(),
        heroData.save()
      ]);

      await this.updateProgressTracking(playerId, serverId, "hero_evolution", 1);

      console.log(`🌟 ${heroData.name} évolution ${oldRarity} → ${newRarity}`);

      return {
        success: true,
        hero: heroInstance,
        newRarity,
        statsBonus: evolutionBonus,
        cost: {
          fragments: evolutionCost.fragments,
          materials: evolutionMaterials
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur evolveHero:", error);
      return { success: false, error: error.message };
    }
  }

  public static async getHeroUpgradeInfo(
    playerId: string,
    serverId: string,
    heroInstanceId: string
  ) {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const heroInstance = player.heroes.find(h => h._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        throw new Error("Hero not found");
      }

      const heroData = await Hero.findById(heroInstance.heroId);
      if (!heroData) {
        throw new Error("Hero data not found");
      }

      const currentStats = this.calculateHeroStats(heroData, heroInstance.level, heroInstance.stars);
      const maxLevel = this.getMaxLevel(heroInstance.stars, player.level);
      const maxStars = this.getMaxStars(heroData.rarity);

      const levelUpInfo = heroInstance.level < maxLevel ? {
        available: true,
        currentLevel: heroInstance.level,
        maxLevel,
        nextLevelCost: this.calculateLevelUpCost(heroInstance.level, heroInstance.level + 1, heroData.rarity),
        maxLevelCost: this.calculateLevelUpCost(heroInstance.level, maxLevel, heroData.rarity),
        statsAtMaxLevel: this.calculateHeroStats(heroData, maxLevel, heroInstance.stars)
      } : { available: false, reason: "Maximum level reached" };

      const starUpgradeInfo = heroInstance.stars < maxStars ? {
        available: true,
        currentStars: heroInstance.stars,
        maxStars,
        nextStarCost: this.getStarUpgradeFragmentCost(heroInstance.stars, heroData.rarity),
        currentFragments: player.fragments.get(heroInstance.heroId.toString()) || 0,
        statsAtNextStar: this.calculateHeroStats(heroData, heroInstance.level, heroInstance.stars + 1)
      } : { available: false, reason: "Maximum stars reached" };

      const evolutionInfo = this.canEvolveHero(heroInstance, heroData) ? {
        available: true,
        currentRarity: heroData.rarity,
        nextRarity: this.getNextRarity(heroData.rarity),
        cost: this.calculateEvolutionCost(heroData.rarity),
        requirements: this.getEvolutionRequirements(heroData.rarity)
      } : { available: false, reason: "Evolution requirements not met" };

      const skillsInfo = this.getSkillsUpgradeInfo(heroInstance, heroData, player);

      return {
        success: true,
        hero: {
          instanceId: heroInstanceId,
          name: heroData.name,
          rarity: heroData.rarity,
          element: heroData.element,
          role: heroData.role,
          level: heroInstance.level,
          stars: heroInstance.stars,
          currentStats
        },
        upgrades: {
          levelUp: levelUpInfo,
          starUpgrade: starUpgradeInfo,
          evolution: evolutionInfo,
          skills: skillsInfo
        },
        playerResources: {
          gold: player.gold,
          fragments: Object.fromEntries(player.fragments.entries()),
          materials: Object.fromEntries(player.materials.entries())
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getHeroUpgradeInfo:", error);
      throw error;
    }
  }

  public static async getPlayerHeroesUpgradeOverview(playerId: string, serverId: string) {
    try {
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const heroesOverview = await Promise.all(player.heroes.map(async (heroInstance: any) => {
        const heroData = heroInstance.heroId;
        const currentStats = this.calculateHeroStats(heroData, heroInstance.level, heroInstance.stars);
        
        const canLevelUp = heroInstance.level < this.getMaxLevel(heroInstance.stars, player.level);
        const canUpgradeStars = heroInstance.stars < this.getMaxStars(heroData.rarity);
        const canEvolve = this.canEvolveHero(heroInstance, heroData);

        const nextLevelCost = canLevelUp ? 
          this.calculateLevelUpCost(heroInstance.level, heroInstance.level + 1, heroData.rarity) : null;
        
        const nextStarCost = canUpgradeStars ? 
          this.getStarUpgradeFragmentCost(heroInstance.stars, heroData.rarity) : null;

        return {
          instanceId: heroInstance._id?.toString() || "",
          heroId: heroData._id.toString(),
          name: heroData.name,
          rarity: heroData.rarity,
          element: heroData.element,
          role: heroData.role,
          level: heroInstance.level,
          stars: heroInstance.stars,
          equipped: heroInstance.equipped,
          currentStats,
          power: this.calculateHeroPower(currentStats),
          upgradePossibilities: {
            canLevelUp,
            canUpgradeStars,
            canEvolve,
            nextLevelCost,
            nextStarCost,
            hasFragments: canUpgradeStars && nextStarCost !== null ? 
              (player.fragments.get(heroData._id.toString()) || 0) >= nextStarCost : false
          }
        };
      }));

      const upgradeStats = {
        totalHeroes: heroesOverview.length,
        canLevelUp: heroesOverview.filter(h => h.upgradePossibilities.canLevelUp).length,
        canUpgradeStars: heroesOverview.filter(h => h.upgradePossibilities.canUpgradeStars).length,
        canEvolve: heroesOverview.filter(h => h.upgradePossibilities.canEvolve).length,
        totalPower: heroesOverview.reduce((sum, h) => sum + h.power, 0)
      };

      return {
        success: true,
        heroes: heroesOverview.sort((a, b) => b.power - a.power),
        stats: upgradeStats,
        playerResources: {
          gold: player.gold,
          totalFragments: Array.from(player.fragments.values()).reduce((sum, f) => sum + f, 0),
          totalMaterials: Array.from(player.materials.values()).reduce((sum, m) => sum + m, 0)
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerHeroesUpgradeOverview:", error);
      throw error;
    }
  }

  public static async bulkLevelUpHeroes(
    playerId: string,
    serverId: string,
    heroInstanceIds: string[],
    maxGoldToSpend?: number
  ) {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const results: any[] = [];
      let totalGoldSpent = 0;
      const availableGold = maxGoldToSpend || player.gold;

      for (const heroInstanceId of heroInstanceIds) {
        const heroInstance = player.heroes.find(h => h._id?.toString() === heroInstanceId);
        if (!heroInstance) continue;

        const heroData = await Hero.findById(heroInstance.heroId);
        if (!heroData) continue;

        const maxLevel = this.getMaxLevel(heroInstance.stars, player.level);
        if (heroInstance.level >= maxLevel) {
          results.push({
            heroInstanceId,
            success: false,
            reason: "Already at maximum level"
          });
          continue;
        }

        let targetLevel = heroInstance.level;
        let levelCost = 0;

        while (targetLevel < maxLevel && totalGoldSpent + levelCost < availableGold) {
          const nextLevelCost = this.calculateLevelUpCost(targetLevel, targetLevel + 1, heroData.rarity);
          if (totalGoldSpent + levelCost + nextLevelCost.gold <= availableGold) {
            levelCost += nextLevelCost.gold;
            targetLevel++;
          } else {
            break;
          }
        }

        if (targetLevel > heroInstance.level) {
          const oldLevel = heroInstance.level;
          heroInstance.level = targetLevel;
          totalGoldSpent += levelCost;

          results.push({
            heroInstanceId,
            heroName: heroData.name, // heroData est maintenant correctement typé
            success: true,
            oldLevel,
            newLevel: targetLevel,
            goldSpent: levelCost
          });
        } else {
          results.push({
            heroInstanceId,
            success: false,
            reason: "Insufficient gold"
          });
        }
      }

      player.gold -= totalGoldSpent;
      await player.save();

      const successfulUpgrades = results.filter(r => r.success).length;
      await this.updateProgressTracking(playerId, serverId, "bulk_level_up", successfulUpgrades);

      return {
        success: true,
        results,
        summary: {
          heroesUpgraded: successfulUpgrades,
          totalGoldSpent,
          remainingGold: player.gold
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur bulkLevelUpHeroes:", error);
      throw error;
    }
  }

  public static async autoUpgradeHero(
    playerId: string,
    serverId: string,
    heroInstanceId: string,
    maxGoldToSpend?: number,
    upgradeStars: boolean = false
  ) {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const heroInstance = player.heroes.find(h => h._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        throw new Error("Hero not found");
      }

      const heroData = await Hero.findById(heroInstance.heroId);
      if (!heroData) {
        throw new Error("Hero data not found");
      }

      const upgrades: any[] = [];
      let totalCost = { gold: 0, fragments: 0 };
      const availableGold = maxGoldToSpend || player.gold;

      const maxLevel = this.getMaxLevel(heroInstance.stars, player.level);
      if (heroInstance.level < maxLevel) {
        let targetLevel = heroInstance.level;
        let levelCost = 0;

        while (targetLevel < maxLevel && levelCost < availableGold) {
          const nextLevelCost = this.calculateLevelUpCost(targetLevel, targetLevel + 1, heroData.rarity);
          if (levelCost + nextLevelCost.gold <= availableGold) {
            levelCost += nextLevelCost.gold;
            targetLevel++;
          } else {
            break;
          }
        }

        if (targetLevel > heroInstance.level) {
          const oldLevel = heroInstance.level;
          heroInstance.level = targetLevel;
          totalCost.gold += levelCost;

          upgrades.push({
            type: "level",
            from: oldLevel,
            to: targetLevel,
            cost: { gold: levelCost }
          });
        }
      }

      if (upgradeStars) {
        const maxStars = this.getMaxStars(heroData.rarity);
        while (heroInstance.stars < maxStars) {
          const fragmentCost = this.getStarUpgradeFragmentCost(heroInstance.stars, heroData.rarity);
          const currentFragments = player.fragments.get(heroInstance.heroId.toString()) || 0;

          if (currentFragments >= fragmentCost) {
            const oldStars = heroInstance.stars;
            heroInstance.stars++;
            player.fragments.set(heroInstance.heroId.toString(), currentFragments - fragmentCost);
            totalCost.fragments += fragmentCost;

            upgrades.push({
              type: "stars",
              from: oldStars,
              to: heroInstance.stars,
              cost: { fragments: fragmentCost }
            });

            const newMaxLevel = this.getMaxLevel(heroInstance.stars, player.level);
            if (heroInstance.level < newMaxLevel && totalCost.gold < availableGold) {
              let additionalLevels = 0;
              let additionalCost = 0;
              let currentLevel = heroInstance.level;

              while (currentLevel < newMaxLevel && totalCost.gold + additionalCost < availableGold) {
                const nextCost = this.calculateLevelUpCost(currentLevel, currentLevel + 1, heroData.rarity);
                if (totalCost.gold + additionalCost + nextCost.gold <= availableGold) {
                  additionalCost += nextCost.gold;
                  currentLevel++;
                  additionalLevels++;
                } else {
                  break;
                }
              }

              if (additionalLevels > 0) {
                const oldLevel = heroInstance.level;
                heroInstance.level = currentLevel;
                totalCost.gold += additionalCost;

                upgrades.push({
                  type: "level_after_star",
                  from: oldLevel,
                  to: currentLevel,
                  cost: { gold: additionalCost }
                });
              }
            }
          } else {
            break;
          }
        }
      }

      player.gold -= totalCost.gold;
      await player.save();

      const finalStats = this.calculateHeroStats(heroData, heroInstance.level, heroInstance.stars);

      return {
        success: true,
        hero: {
          instanceId: heroInstanceId,
          name: heroData.name,
          finalLevel: heroInstance.level,
          finalStars: heroInstance.stars,
          finalStats,
          finalPower: this.calculateHeroPower(finalStats)
        },
        upgrades,
        totalCost,
        playerResources: {
          gold: player.gold,
          fragments: Object.fromEntries(player.fragments.entries())
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur autoUpgradeHero:", error);
      throw error;
    }
  }

  public static async getUpgradeRecommendations(playerId: string, serverId: string) {
    try {
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const recommendations: any[] = [];
      const equippedHeroes = player.heroes.filter((h: any) => h.equipped);
      const unequippedHeroes = player.heroes.filter((h: any) => !h.equipped);

      for (const heroInstance of equippedHeroes) {
        const heroData = heroInstance.heroId as any; // Cast pour accéder aux propriétés après populate
        const priority = this.calculateUpgradePriority(heroInstance, heroData, player, true);
        
        if (priority.score > 0) {
          recommendations.push({
            heroInstanceId: heroInstance._id?.toString() || "",
            heroName: heroData.name,
            priority: priority.score,
            isEquipped: true,
            recommendations: priority.recommendations,
            estimatedCost: priority.estimatedCost
          });
        }
      }

      for (const heroInstance of unequippedHeroes.slice(0, 10)) {
        const heroData = heroInstance.heroId as any; // Cast pour accéder aux propriétés après populate
        const priority = this.calculateUpgradePriority(heroInstance, heroData, player, false);
        
        if (priority.score > 0) {
          recommendations.push({
            heroInstanceId: heroInstance._id?.toString() || "",
            heroName: heroData.name,
            priority: priority.score,
            isEquipped: false,
            recommendations: priority.recommendations,
            estimatedCost: priority.estimatedCost
          });
        }
      }

      recommendations.sort((a, b) => b.priority - a.priority);

      return {
        success: true,
        recommendations: recommendations.slice(0, 20),
        playerBudget: {
          gold: player.gold,
          totalFragments: Array.from(player.fragments.values()).reduce((sum, f) => sum + f, 0)
        },
        summary: {
          equippedHeroesCount: equippedHeroes.length,
          totalRecommendations: recommendations.length,
          highPriorityCount: recommendations.filter(r => r.priority >= 8).length
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getUpgradeRecommendations:", error);
      throw error;
    }
  }

  public static async getHeroUpgradeStats(playerId: string, serverId: string) {
    try {
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const stats = {
        totalHeroes: player.heroes.length,
        averageLevel: 0,
        averageStars: 0,
        rarityDistribution: { "Common": 0, "Rare": 0, "Epic": 0, "Legendary": 0 },
        maxLevelHeroes: 0,
        maxStarHeroes: 0,
        totalPower: 0,
        upgradeableHeroes: 0,
        fragmentsAvailable: Array.from(player.fragments.values()).reduce((sum, f) => sum + f, 0),
        goldAvailable: player.gold
      };

      for (const heroInstance of player.heroes) {
        const heroData = heroInstance.heroId as any;
        stats.averageLevel += heroInstance.level;
        stats.averageStars += heroInstance.stars;
        
        const rarityKey = heroData.rarity as keyof typeof stats.rarityDistribution;
        if (stats.rarityDistribution[rarityKey] !== undefined) {
          stats.rarityDistribution[rarityKey]++;
        }
        
        const currentStats = this.calculateHeroStats(heroData, heroInstance.level, heroInstance.stars);
        stats.totalPower += this.calculateHeroPower(currentStats);
        
        const maxLevel = this.getMaxLevel(heroInstance.stars, player.level);
        const maxStars = this.getMaxStars(heroData.rarity);
        
        if (heroInstance.level >= maxLevel && heroInstance.stars >= maxStars) {
          stats.maxLevelHeroes++;
        }
        
        if (heroInstance.level < maxLevel || heroInstance.stars < maxStars) {
          stats.upgradeableHeroes++;
        }
      }

      stats.averageLevel = Math.round(stats.averageLevel / stats.totalHeroes * 10) / 10;
      stats.averageStars = Math.round(stats.averageStars / stats.totalHeroes * 10) / 10;

      return {
        success: true,
        stats,
        analysis: {
          upgradeProgress: Math.round((stats.maxLevelHeroes / stats.totalHeroes) * 100),
          powerPerHero: Math.round(stats.totalPower / stats.totalHeroes),
          resourceSufficiency: {
            gold: stats.goldAvailable > stats.upgradeableHeroes * 1000,
            fragments: stats.fragmentsAvailable > stats.upgradeableHeroes * 20
          }
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getHeroUpgradeStats:", error);
      throw error;
    }
  }

  // === MÉTHODES PRIVÉES ===

  private static calculateLevelUpCost(currentLevel: number, targetLevel: number, rarity: string) {
    let totalGold = 0;
    const rarityMultiplier = this.getRarityMultiplier(rarity);

    for (let level = currentLevel; level < targetLevel; level++) {
      const baseCost = 100 + (level * 15);
      totalGold += Math.floor(baseCost * rarityMultiplier);
    }

    return { gold: totalGold };
  }

  private static getStarUpgradeFragmentCost(currentStars: number, rarity: string): number {
    const baseCosts = [10, 20, 40, 80, 160];
    const rarityMultiplier = this.getRarityMultiplier(rarity);
    return Math.floor((baseCosts[currentStars - 1] || 200) * rarityMultiplier);
  }

  private static calculateSkillUpgradeCost(currentLevel: number, rarity: string) {
    const baseGold = 500 + (currentLevel * 200);
    const baseMaterials = 2 + Math.floor(currentLevel / 2);
    const rarityMultiplier = this.getRarityMultiplier(rarity);

    return {
      gold: Math.floor(baseGold * rarityMultiplier),
      materials: Math.floor(baseMaterials * rarityMultiplier)
    };
  }

  private static calculateEvolutionCost(rarity: string) {
    const costs: Record<string, number> = {
      "Common": 100,
      "Rare": 200,
      "Epic": 400,
      "Legendary": 800
    };
    return { fragments: costs[rarity] || 1000 };
  }

  private static getEvolutionMaterials(rarity: string): Record<string, number> {
    const materials: Record<string, Record<string, number>> = {
      "Common": { "evolution_crystal_basic": 5, "essence_pure": 10 },
      "Rare": { "evolution_crystal_basic": 10, "evolution_crystal_advanced": 3, "essence_pure": 20 },
      "Epic": { "evolution_crystal_advanced": 8, "evolution_crystal_superior": 2, "essence_pure": 50 },
      "Legendary": { "evolution_crystal_superior": 5, "evolution_crystal_divine": 1, "essence_pure": 100 }
    };
    return materials[rarity] || {};
  }

  private static calculateHeroStats(heroData: any, level: number, stars: number) {
    const levelMultiplier = 1 + (level - 1) * 0.08;
    const starMultiplier = 1 + (stars - 1) * 0.15;
    const totalMultiplier = levelMultiplier * starMultiplier;

    return {
      hp: Math.floor(heroData.baseStats.hp * totalMultiplier),
      atk: Math.floor(heroData.baseStats.atk * totalMultiplier),
      def: Math.floor(heroData.baseStats.def * totalMultiplier),
      vitesse: Math.floor((heroData.baseStats.vitesse || 80) * Math.min(2.0, totalMultiplier * 0.6 + 0.4)),
      intelligence: Math.floor((heroData.baseStats.intelligence || 70) * totalMultiplier),
      force: Math.floor((heroData.baseStats.force || 80) * totalMultiplier),
      moral: Math.floor((heroData.baseStats.moral || 60) * totalMultiplier * 0.8 + 0.2)
    };
  }

  private static getMaxLevel(stars: number, playerLevel: number): number {
    const starLevelCaps = [20, 30, 40, 60, 80, 100];
    const starCap = starLevelCaps[stars - 1] || 100;
    return Math.min(starCap, playerLevel + 20);
  }

  private static getMaxStars(rarity: string): number {
    const maxStars: Record<string, number> = {
      "Common": 5,
      "Rare": 6,
      "Epic": 6,
      "Legendary": 6
    };
    return maxStars[rarity] || 6;
  }

  private static getMaxSkillLevel(heroLevel: number): number {
    return Math.min(10, Math.floor(heroLevel / 10) + 1);
  }

  private static getRarityMultiplier(rarity: string): number {
    const multipliers: Record<string, number> = {
      "Common": 1.0,
      "Rare": 1.5,
      "Epic": 2.0,
      "Legendary": 3.0
    };
    return multipliers[rarity] || 1.0;
  }

  private static canEvolveHero(heroInstance: any, heroData: any): boolean {
    return heroInstance.level >= 50 && 
           heroInstance.stars >= 5 && 
           heroData.rarity !== "Legendary";
  }

  private static getNextRarity(currentRarity: string): string | null {
    const progression: Record<string, string> = {
      "Common": "Rare",
      "Rare": "Epic",
      "Epic": "Legendary"
    };
    return progression[currentRarity] || null;
  }

  private static calculateEvolutionStatsBonus(oldRarity: string, newRarity: string) {
    return {
      hpMultiplier: 1.3,
      atkMultiplier: 1.25,
      defMultiplier: 1.2,
      speedBonus: 10,
      skillLevelBonus: 1
    };
  }

  private static getEvolutionRequirements(rarity: string) {
    return {
      minLevel: 50,
      minStars: 5,
      materials: this.getEvolutionMaterials(rarity)
    };
  }

  private static calculateUpgradePriority(
    heroInstance: any,
    heroData: any,
    player: any,
    isEquipped: boolean
  ) {
    let score = 0;
    const recommendations: string[] = [];
    let estimatedCost = { gold: 0, fragments: 0 };

    const basePriority = isEquipped ? 5 : 2;
    const rarityValues: Record<string, number> = { "Common": 0, "Rare": 1, "Epic": 2, "Legendary": 3 };
    const rarityBonus = rarityValues[heroData.rarity] || 0;
    
    score += basePriority + rarityBonus;

    const maxLevel = this.getMaxLevel(heroInstance.stars, player.level);
    if (heroInstance.level < maxLevel) {
      const levelGap = maxLevel - heroInstance.level;
      const levelPriority = Math.min(3, levelGap / 10);
      score += levelPriority;
      
      if (levelGap >= 5) {
        recommendations.push(`Level up ${levelGap} levels`);
        estimatedCost.gold += this.calculateLevelUpCost(heroInstance.level, Math.min(heroInstance.level + 10, maxLevel), heroData.rarity).gold;
      }
    }

    const maxStars = this.getMaxStars(heroData.rarity);
    if (heroInstance.stars < maxStars) {
      const fragmentCost = this.getStarUpgradeFragmentCost(heroInstance.stars, heroData.rarity);
      const availableFragments = player.fragments.get(heroInstance.heroId.toString()) || 0;
      
      if (availableFragments >= fragmentCost) {
        score += 2;
        recommendations.push(`Upgrade to ${heroInstance.stars + 1} stars`);
        estimatedCost.fragments += fragmentCost;
      } else {
        const fragmentsNeeded = fragmentCost - availableFragments;
        if (fragmentsNeeded <= 50) {
          score += 1;
          recommendations.push(`Need ${fragmentsNeeded} more fragments for star upgrade`);
        }
      }
    }

    if (this.canEvolveHero(heroInstance, heroData)) {
      const evolutionCost = this.calculateEvolutionCost(heroData.rarity);
      const availableFragments = player.fragments.get(heroInstance.heroId.toString()) || 0;
      
      if (availableFragments >= evolutionCost.fragments) {
        score += 4;
        recommendations.push("Ready for evolution!");
        estimatedCost.fragments += evolutionCost.fragments;
      }
    }

    const currentPower = this.calculateHeroPower(this.calculateHeroStats(heroData, heroInstance.level, heroInstance.stars));
    if (currentPower < player.level * 100) {
      score += 1;
      recommendations.push("Power below player level average");
    }

    return {
      score: Math.round(score * 10) / 10,
      recommendations,
      estimatedCost
    };
  }

  private static calculateHeroPower(stats: any): number {
    return Math.floor(stats.atk * 1.0 + stats.def * 2.0 + stats.hp / 10);
  }

  private static getSkillsUpgradeInfo(heroInstance: any, heroData: any, player: any) {
    const skills = ["spell1", "spell2", "spell3", "ultimate", "passive"];
    const skillsInfo: any = {};

    if (!(heroInstance as any).skills) {
      (heroInstance as any).skills = {
        spell1: { level: 1 },
        spell2: { level: 1 },
        spell3: { level: 1 },
        ultimate: { level: 1 },
        passive: { level: 1 }
      };
    }

    for (const skillSlot of skills) {
      const currentLevel = (heroInstance as any).skills[skillSlot]?.level || 1;
      const maxLevel = this.getMaxSkillLevel(heroInstance.level);
      
      if (currentLevel < maxLevel) {
        const cost = this.calculateSkillUpgradeCost(currentLevel, heroData.rarity);
        const requiredMaterial = `skill_essence_${heroData.element.toLowerCase()}`;
        
        skillsInfo[skillSlot] = {
          available: true,
          currentLevel,
          maxLevel,
          cost,
          requiredMaterial,
          playerHasMaterial: (player.materials.get(requiredMaterial) || 0) >= cost.materials
        };
      } else {
        skillsInfo[skillSlot] = {
          available: false,
          currentLevel,
          maxLevel,
          reason: "Maximum level reached"
        };
      }
    }

    return skillsInfo;
  }

  private static async updateProgressTracking(
    playerId: string,
    serverId: string,
    upgradeType: string,
    value: number
  ) {
    try {
      await Promise.all([
        MissionService.updateProgress(
          playerId,
          serverId,
          "heroes_owned",
          value,
          { upgradeType }
        ),
        EventService.updatePlayerProgress(
          playerId,
          serverId,
          "collect_items",
          value,
          { itemType: "hero_upgrade", upgradeType }
        )
      ]);

      console.log(`📊 Progression missions/événements mise à jour: ${upgradeType} +${value}`);
    } catch (error) {
      console.error("⚠️ Erreur mise à jour progression héros:", error);
    }
  }
}

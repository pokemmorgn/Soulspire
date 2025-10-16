// server/src/services/HeroUpgradeService.ts
import Player from "../models/Player";
import Hero from "../models/Hero";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { IPlayerHero } from "../types/index";
import { achievementEmitter, AchievementEvent } from '../utils/AchievementEmitter';
import {
  getAscensionCostForLevel,
  isAscensionLevel,
  getAscensionTier,
  canHeroAscendToLevel,
  getTotalCostToLevel,
  getAscensionUIInfo,
  getLevelUpCost,
  getMaxLevelForRarity,
  getAscensionReward,
  ASCENSION_COSTS
} from '../config/ascensionCosts';

// ===============================================
// INTERFACES DE RÉSULTATS
// ===============================================

export interface HeroUpgradeResult {
  success: boolean;
  hero?: {
    instanceId: string;
    heroData: {
      name: string;
      rarity: string;
      element: string;
      role: string;
    };
    level: number;
    stars: number;
    ascensionTier: number;
    unlockedSpells: string[];
  };
  newLevel?: number;
  newStars?: number;
  newAscensionTier?: number;
  statsGained?: any;
  spellsUnlocked?: Array<{ level: number; spellId: string; slot: string }>;
  cost?: {
    gold?: number;
    heroXP?: number;
    fragments?: number;
    ascensionEssence?: number;
    materials?: Record<string, number>;
  };
  playerResources?: {
    gold: number;
    heroXP: number;
    ascensionEssences: number;
    fragments: Record<string, number>;
    materials: Record<string, number>;
  };
  error?: string;
  code?: string;
}

export interface AscensionResult {
  success: boolean;
  hero?: any;
  newLevel?: number;
  newAscensionTier?: number;
  statsBonus?: any;
  spellsUnlocked?: Array<{ level: number; spellId: string; slot: string }>;
  rewards?: {
    gold?: number;
    gems?: number;
  };
  cost?: {
    gold: number;
    heroXP: number;
    ascensionEssence: number;
  };
  error?: string;
  code?: string;
}

export interface SkillUpgradeResult {
  success: boolean;
  skill?: {
    spellLevel: number;
    spellId: string;
    oldLevel: number;
    newLevel: number;
    newStats?: any;
  };
  cost?: Record<string, number>;
  error?: string;
  code?: string;
}

// ===============================================
// SERVICE PRINCIPAL
// ===============================================

export class HeroUpgradeService {

  // ===============================================
  // LEVEL UP NORMAL (sans ascension)
  // ===============================================

  public static async levelUpHero(
    accountId: string,
    serverId: string,
    heroInstanceId: string,
    targetLevel?: number
  ): Promise<HeroUpgradeResult> {
    try {
      const player = await Player.findOne({ accountId, serverId });
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const heroInstance = player.heroes.find(h => (h as any)._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        return { success: false, error: "Hero not found", code: "HERO_NOT_FOUND" };
      }

      const heroData = await Hero.findById(heroInstance.heroId);
      if (!heroData) {
        return { success: false, error: "Hero data not found", code: "HERO_DATA_NOT_FOUND" };
      }

      const currentLevel = heroInstance.level;
      const maxLevelForRarity = getMaxLevelForRarity(heroData.rarity);
      const finalTargetLevel = targetLevel ? Math.min(targetLevel, maxLevelForRarity) : currentLevel + 1;

      // Vérifier si on peut atteindre ce niveau
      if (currentLevel >= maxLevelForRarity) {
        return { success: false, error: "Hero is at maximum level for its rarity", code: "MAX_LEVEL_REACHED" };
      }

      if (finalTargetLevel <= currentLevel) {
        return { success: false, error: "Invalid target level", code: "INVALID_TARGET_LEVEL" };
      }

      // Vérifier s'il faut passer par des paliers d'ascension
      const ascensionCheck = canHeroAscendToLevel(heroData.rarity, currentLevel, finalTargetLevel);
      if (!ascensionCheck.canAscend) {
        return { success: false, error: ascensionCheck.reason, code: "ASCENSION_REQUIRED" };
      }

      if (ascensionCheck.requiredAscensions.length > 0) {
        return { 
          success: false, 
          error: `Cannot level up directly. Must ascend at level(s): ${ascensionCheck.requiredAscensions.map(a => a.level).join(', ')}`, 
          code: "ASCENSION_REQUIRED" 
        };
      }

      // Calculer le coût du level up normal
      const levelUpCost = getLevelUpCost(currentLevel, finalTargetLevel, heroData.rarity);

      if (!player.canAffordHeroLevelUp(levelUpCost)) {
        return { 
          success: false, 
          error: `Insufficient resources. Required: ${levelUpCost.gold} gold, ${levelUpCost.heroXP} heroXP`, 
          code: "INSUFFICIENT_RESOURCES" 
        };
      }

      // Calculer les stats avant/après
      const oldStats = this.calculateHeroStats(heroData, currentLevel, heroInstance.stars, heroInstance.ascensionTier);
      
      // Effectuer le level up
      await player.spendHeroLevelUpResources(levelUpCost);
      heroInstance.level = finalTargetLevel;

      // Mettre à jour les sorts débloqués
      const newUnlockedSpells = this.updateUnlockedSpells(heroInstance, heroData, finalTargetLevel);

      const newStats = this.calculateHeroStats(heroData, finalTargetLevel, heroInstance.stars, heroInstance.ascensionTier);
      const statsGained = {
        hp: newStats.hp - oldStats.hp,
        atk: newStats.atk - oldStats.atk,
        def: newStats.def - oldStats.def,
        vitesse: newStats.vitesse - oldStats.vitesse,
        moral: newStats.moral - oldStats.moral
      };

      await player.save();
      
      // Événements d'achievements
      this.emitLevelUpAchievements(accountId, serverId, heroData, currentLevel, finalTargetLevel);
      
      await this.updateProgressTracking(accountId, serverId, "level_up", finalTargetLevel - currentLevel);

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
          stars: heroInstance.stars,
          ascensionTier: heroInstance.ascensionTier,
          unlockedSpells: heroInstance.unlockedSpells
        },
        newLevel: finalTargetLevel,
        statsGained,
        spellsUnlocked: newUnlockedSpells,
        cost: {
          gold: levelUpCost.gold,
          heroXP: levelUpCost.heroXP
        },
        playerResources: {
          gold: player.gold,
          heroXP: player.heroXP,
          ascensionEssences: player.ascensionEssences,
          fragments: Object.fromEntries(player.fragments.entries()),
          materials: Object.fromEntries(player.materials.entries())
        }
      };

    } catch (error: any) {
      return { success: false, error: error.message, code: "LEVEL_UP_FAILED" };
    }
  }

  // ===============================================
  // ASCENSION DE HÉROS
  // ===============================================

  public static async ascendHero(
    accountId: string,
    serverId: string,
    heroInstanceId: string
  ): Promise<AscensionResult> {
    try {
      const player = await Player.findOne({ accountId, serverId });
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const heroInstance = player.heroes.find(h => (h as any)._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        return { success: false, error: "Hero not found", code: "HERO_NOT_FOUND" };
      }

      const heroData = await Hero.findById(heroInstance.heroId);
      if (!heroData) {
        return { success: false, error: "Hero data not found", code: "HERO_DATA_NOT_FOUND" };
      }

      const currentLevel = heroInstance.level;
      const targetLevel = currentLevel + 1;

      // Vérifier si c'est un niveau d'ascension
      if (!isAscensionLevel(targetLevel)) {
        return { 
          success: false, 
          error: `Level ${targetLevel} is not an ascension level. Ascension levels are: 41, 81, 121, 151`, 
          code: "NOT_ASCENSION_LEVEL" 
        };
      }

      // Vérifier si le héros peut atteindre ce niveau de rareté
      if (!canHeroAscendToLevel(heroData.rarity, currentLevel, targetLevel).canAscend) {
        return { 
          success: false, 
          error: `${heroData.rarity} heroes cannot ascend to level ${targetLevel}`, 
          code: "RARITY_LIMIT_REACHED" 
        };
      }

      // Obtenir le coût d'ascension
      const ascensionCost = getAscensionCostForLevel(targetLevel);
      if (!ascensionCost) {
        return { success: false, error: "Invalid ascension level", code: "INVALID_ASCENSION_LEVEL" };
      }

      // Vérifier les ressources
      if (!player.canAffordAscension(ascensionCost)) {
        return { 
          success: false, 
          error: `Insufficient resources. Required: ${ascensionCost.gold} gold, ${ascensionCost.heroXP} heroXP, ${ascensionCost.ascensionEssence} essences`, 
          code: "INSUFFICIENT_RESOURCES" 
        };
      }

      // Calculer les stats avant ascension
      const oldStats = this.calculateHeroStats(heroData, currentLevel, heroInstance.stars, heroInstance.ascensionTier);
      
      // Effectuer l'ascension
      await player.spendAscensionResources(ascensionCost);
      heroInstance.level = targetLevel;
      heroInstance.ascensionTier = getAscensionTier(targetLevel);

      // Mettre à jour les sorts débloqués
      const newUnlockedSpells = this.updateUnlockedSpells(heroInstance, heroData, targetLevel);

      // Calculer les nouveaux stats avec le bonus d'ascension
      const newStats = this.calculateHeroStats(heroData, targetLevel, heroInstance.stars, heroInstance.ascensionTier);
      const statsBonus = {
        hp: newStats.hp - oldStats.hp,
        atk: newStats.atk - oldStats.atk,
        def: newStats.def - oldStats.def,
        vitesse: newStats.vitesse - oldStats.vitesse,
        moral: newStats.moral - oldStats.moral
      };

      // Obtenir les récompenses d'ascension
      const ascensionReward = getAscensionReward(heroInstance.ascensionTier);
      let rewards = {};
      if (ascensionReward?.other) {
        if (ascensionReward.other.gold) {
          player.gold += ascensionReward.other.gold;
        }
        if (ascensionReward.other.gems) {
          player.gems += ascensionReward.other.gems;
        }
        rewards = ascensionReward.other;
      }

      await player.save();
      
      // Événements d'achievements
      this.emitAscensionAchievements(accountId, serverId, heroData, heroInstance.ascensionTier);
      
      await this.updateProgressTracking(accountId, serverId, "hero_ascension", 1);

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
          stars: heroInstance.stars,
          ascensionTier: heroInstance.ascensionTier,
          unlockedSpells: heroInstance.unlockedSpells
        },
        newLevel: targetLevel,
        newAscensionTier: heroInstance.ascensionTier,
        statsBonus,
        spellsUnlocked: newUnlockedSpells,
        rewards,
        cost: ascensionCost
      };

    } catch (error: any) {
      return { success: false, error: error.message, code: "ASCENSION_FAILED" };
    }
  }

  // ===============================================
  // UPGRADE D'ÉTOILES
  // ===============================================

  public static async upgradeHeroStars(
    accountId: string,
    serverId: string,
    heroInstanceId: string
  ): Promise<HeroUpgradeResult> {
    try {
      const player = await Player.findOne({ accountId, serverId });
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const heroInstance = player.heroes.find(h => (h as any)._id?.toString() === heroInstanceId);
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

      const oldStats = this.calculateHeroStats(heroData, heroInstance.level, currentStars, heroInstance.ascensionTier);
      
      player.fragments.set(heroInstance.heroId.toString(), currentFragments - requiredFragments);
      heroInstance.stars = currentStars + 1;

      const newStats = this.calculateHeroStats(heroData, heroInstance.level, heroInstance.stars, heroInstance.ascensionTier);
      const statsGained = {
        hp: newStats.hp - oldStats.hp,
        atk: newStats.atk - oldStats.atk,
        def: newStats.def - oldStats.def,
        vitesse: newStats.vitesse - oldStats.vitesse,
        moral: newStats.moral - oldStats.moral
      };

      await player.save();
      
      // Événements d'achievements
      this.emitStarUpgradeAchievements(accountId, serverId, heroData, heroInstance.stars);
      
      await this.updateProgressTracking(accountId, serverId, "star_upgrade", 1);

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
          stars: heroInstance.stars,
          ascensionTier: heroInstance.ascensionTier,
          unlockedSpells: heroInstance.unlockedSpells
        },
        newStars: heroInstance.stars,
        statsGained,
        cost: { fragments: requiredFragments },
        playerResources: {
          gold: player.gold,
          heroXP: player.heroXP,
          ascensionEssences: player.ascensionEssences,
          fragments: Object.fromEntries(player.fragments.entries()),
          materials: Object.fromEntries(player.materials.entries())
        }
      };

    } catch (error: any) {
      return { success: false, error: error.message, code: "STAR_UPGRADE_FAILED" };
    }
  }

  // ===============================================
  // UPGRADE DE SORTS
  // ===============================================

  public static async upgradeHeroSpell(
    accountId: string,
    serverId: string,
    heroInstanceId: string,
    spellLevel: number // 1, 11, 41, 81, 121, 151
  ): Promise<SkillUpgradeResult> {
    try {
      const player = await Player.findOne({ accountId, serverId });
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const heroInstance = player.heroes.find(h => (h as any)._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        return { success: false, error: "Hero not found", code: "HERO_NOT_FOUND" };
      }

      const heroData = await Hero.findById(heroInstance.heroId);
      if (!heroData) {
        return { success: false, error: "Hero data not found", code: "HERO_DATA_NOT_FOUND" };
      }

      // Vérifier si le sort est débloqué
      const spellSlot = `level${spellLevel}`;
      if (!heroInstance.unlockedSpells.includes(spellSlot)) {
        return { 
          success: false, 
          error: `Spell at level ${spellLevel} is not unlocked yet`, 
          code: "SPELL_NOT_UNLOCKED" 
        };
      }

      // Obtenir le sort du héros
      const heroSpell = heroData.getSpellByLevel(spellLevel);
      if (!heroSpell) {
        return { 
          success: false, 
          error: `No spell defined for level ${spellLevel}`, 
          code: "SPELL_NOT_DEFINED" 
        };
      }

      const currentSpellLevel = heroSpell.level;
      const maxSpellLevel = (spellLevel >= 81) ? 10 : 12; // Sorts ultimes max niveau 10

      if (currentSpellLevel >= maxSpellLevel) {
        return { success: false, error: "Spell is at maximum level", code: "MAX_SPELL_LEVEL_REACHED" };
      }

      const spellCost = this.calculateSpellUpgradeCost(currentSpellLevel, heroData.rarity, spellLevel);

      if (player.gold < spellCost.gold) {
        return { success: false, error: `Insufficient gold. Required: ${spellCost.gold}`, code: "INSUFFICIENT_GOLD" };
      }

      const requiredMaterial = `spell_essence_${heroData.element.toLowerCase()}`;
      const currentMaterial = player.materials.get(requiredMaterial) || 0;

      if (currentMaterial < spellCost.materials) {
        return { 
          success: false, 
          error: `Insufficient ${requiredMaterial}. Required: ${spellCost.materials}`, 
          code: "INSUFFICIENT_MATERIALS"
        };
      }

      // Effectuer l'upgrade
      player.gold -= spellCost.gold;
      player.materials.set(requiredMaterial, currentMaterial - spellCost.materials);
      
      const newSpellLevel = currentSpellLevel + 1;
      heroData.upgradeSpellByLevel(spellLevel, newSpellLevel);

      await Promise.all([player.save(), heroData.save()]);

      // Calculer les nouvelles stats du sort
      const newSpellStats = heroData.calculateSpellStatsByLevel(spellLevel, newSpellLevel);

      return {
        success: true,
        skill: {
          spellLevel,
          spellId: heroSpell.id,
          oldLevel: currentSpellLevel,
          newLevel: newSpellLevel,
          newStats: newSpellStats
        },
        cost: {
          gold: spellCost.gold,
          [requiredMaterial]: spellCost.materials
        }
      };

    } catch (error: any) {
      return { success: false, error: error.message, code: "SPELL_UPGRADE_FAILED" };
    }
  }

  // ===============================================
  // INFORMATIONS ET OVERVIEW
  // ===============================================

  public static async getHeroUpgradeInfo(
    accountId: string,
    serverId: string,
    heroInstanceId: string
  ) {
    try {
      const player = await Player.findOne({ accountId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const heroInstance = player.heroes.find(h => (h as any)._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        throw new Error("Hero not found");
      }

      const heroData = await Hero.findById(heroInstance.heroId);
      if (!heroData) {
        throw new Error("Hero data not found");
      }

      const currentStats = this.calculateHeroStats(heroData, heroInstance.level, heroInstance.stars, heroInstance.ascensionTier);
      const maxLevelForRarity = getMaxLevelForRarity(heroData.rarity);
      const maxStars = this.getMaxStars(heroData.rarity);

      // Informations de level up
      const levelUpInfo = heroInstance.level < maxLevelForRarity ? {
        available: true,
        currentLevel: heroInstance.level,
        maxLevel: maxLevelForRarity,
        nextLevelCost: this.getNextLevelCost(heroInstance, heroData),
        blockedByAscension: this.isNextLevelAscension(heroInstance.level)
      } : { available: false, reason: "Maximum level reached" };

      // Informations d'ascension
      const ascensionInfo = this.getAscensionInfo(heroInstance, heroData);

      // Informations d'étoiles
      const starUpgradeInfo = heroInstance.stars < maxStars ? {
        available: true,
        currentStars: heroInstance.stars,
        maxStars,
        nextStarCost: this.getStarUpgradeFragmentCost(heroInstance.stars, heroData.rarity),
        currentFragments: player.fragments.get(heroInstance.heroId.toString()) || 0
      } : { available: false, reason: "Maximum stars reached" };

      // Informations des sorts
      const spellsInfo = this.getSpellsUpgradeInfo(heroInstance, heroData, player);

      // Informations UI d'ascension
      const uiInfo = getAscensionUIInfo(heroData.rarity, heroInstance.level);

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
          ascensionTier: heroInstance.ascensionTier,
          currentStats,
          unlockedSpells: heroInstance.unlockedSpells
        },
        upgrades: {
          levelUp: levelUpInfo,
          ascension: ascensionInfo,
          starUpgrade: starUpgradeInfo,
          spells: spellsInfo
        },
        ascensionUI: uiInfo,
        playerResources: {
          gold: player.gold,
          heroXP: player.heroXP,
          ascensionEssences: player.ascensionEssences,
          fragments: Object.fromEntries(player.fragments.entries()),
          materials: Object.fromEntries(player.materials.entries())
        }
      };

    } catch (error: any) {
      throw error;
    }
  }

  // ===============================================
  // MÉTHODES UTILITAIRES PRIVÉES
  // ===============================================

  private static calculateHeroStats(heroData: any, level: number, stars: number, ascensionTier: number = 0) {
    const levelMultiplier = 1 + (level - 1) * 0.08;
    const starMultiplier = 1 + (stars - 1) * 0.15;
    
    // Bonus d'ascension selon le tier
    const ascensionMultipliers = [1.0, 1.15, 1.35, 1.60, 1.90];
    const ascensionMultiplier = ascensionMultipliers[ascensionTier] || 1.0;
    
    const totalMultiplier = levelMultiplier * starMultiplier * ascensionMultiplier;

    return {
      hp: Math.floor(heroData.baseStats.hp * totalMultiplier),
      atk: Math.floor(heroData.baseStats.atk * totalMultiplier),
      def: Math.floor(heroData.baseStats.def * totalMultiplier),
      vitesse: Math.floor((heroData.baseStats.vitesse || 80) * Math.min(2.0, totalMultiplier * 0.6 + 0.4)),
      moral: Math.floor((heroData.baseStats.moral || 60) * totalMultiplier * 0.8 + 0.2)
    };
  }

  private static updateUnlockedSpells(heroInstance: any, heroData: any, newLevel: number): Array<{ level: number; spellId: string; slot: string }> {
    const spellLevels = [1, 11, 41, 81, 121, 151];
    const newlyUnlocked: Array<{ level: number; spellId: string; slot: string }> = [];

    for (const spellLevel of spellLevels) {
      const spellSlot = `level${spellLevel}`;
      
      // Si le héros atteint ce niveau et que le sort n'est pas encore débloqué
      if (newLevel >= spellLevel && !heroInstance.unlockedSpells.includes(spellSlot)) {
        // Vérifier si le héros a un sort défini pour ce niveau
        const spell = heroData.getSpellByLevel(spellLevel);
        if (spell) {
          heroInstance.unlockedSpells.push(spellSlot);
          newlyUnlocked.push({
            level: spellLevel,
            spellId: spell.id,
            slot: spellSlot
          });
        }
      }
    }

    return newlyUnlocked;
  }

  private static getMaxStars(rarity: string): number {
    const maxStars: Record<string, number> = {
      "Common": 5,
      "Rare": 6,
      "Epic": 6,
      "Legendary": 6,
      "Mythic": 6
    };
    return maxStars[rarity] || 6;
  }

  private static getStarUpgradeFragmentCost(currentStars: number, rarity: string): number {
    const baseCosts = [10, 20, 40, 80, 160];
    const rarityMultiplier = this.getRarityMultiplier(rarity);
    return Math.floor((baseCosts[currentStars - 1] || 200) * rarityMultiplier);
  }

  private static getRarityMultiplier(rarity: string): number {
    const multipliers: Record<string, number> = {
      "Common": 1.0,
      "Rare": 1.5,
      "Epic": 2.0,
      "Legendary": 3.0,
      "Mythic": 4.0
    };
    return multipliers[rarity] || 1.0;
  }

  private static calculateSpellUpgradeCost(currentLevel: number, rarity: string, spellLevel: number) {
    const baseGold = 500 + (currentLevel * 200);
    const baseMaterials = 2 + Math.floor(currentLevel / 2);
    const rarityMultiplier = this.getRarityMultiplier(rarity);
    
    // Les sorts ultimes coûtent plus cher
    const spellMultiplier = spellLevel >= 81 ? 1.5 : 1.0;

    return {
      gold: Math.floor(baseGold * rarityMultiplier * spellMultiplier),
      materials: Math.floor(baseMaterials * rarityMultiplier * spellMultiplier)
    };
  }

  private static getNextLevelCost(heroInstance: any, heroData: any) {
    const currentLevel = heroInstance.level;
    const nextLevel = currentLevel + 1;
    
    if (isAscensionLevel(nextLevel)) {
      return getAscensionCostForLevel(nextLevel);
    } else {
      return getLevelUpCost(currentLevel, nextLevel, heroData.rarity);
    }
  }

  private static isNextLevelAscension(currentLevel: number): boolean {
    return isAscensionLevel(currentLevel + 1);
  }

  private static getAscensionInfo(heroInstance: any, heroData: any) {
    const currentLevel = heroInstance.level;
    const nextLevel = currentLevel + 1;
    const maxLevel = getMaxLevelForRarity(heroData.rarity);
    
    if (nextLevel > maxLevel) {
      return { available: false, reason: "Hero is at maximum level for its rarity" };
    }
    
    if (!isAscensionLevel(nextLevel)) {
      return { available: false, reason: "Next level is not an ascension level" };
    }
    
    const ascensionCost = getAscensionCostForLevel(nextLevel);
    const ascensionReward = getAscensionReward(getAscensionTier(nextLevel));
    
    return {
      available: true,
      currentLevel,
      nextLevel,
      currentTier: heroInstance.ascensionTier,
      nextTier: getAscensionTier(nextLevel),
      cost: ascensionCost,
      rewards: ascensionReward
    };
  }

  private static getSpellsUpgradeInfo(heroInstance: any, heroData: any, player: any) {
    const spellLevels = [1, 11, 41, 81, 121, 151];
    const spellsInfo: any = {};

    for (const spellLevel of spellLevels) {
      const spellSlot = `level${spellLevel}`;
      
      // Vérifier si le sort est débloqué
      if (!heroInstance.unlockedSpells.includes(spellSlot)) {
        spellsInfo[spellSlot] = {
          available: false,
          reason: heroInstance.level >= spellLevel ? "Hero level sufficient but spell not defined" : `Requires level ${spellLevel}`,
          requiredLevel: spellLevel,
          currentLevel: heroInstance.level
        };
        continue;
      }

      // Obtenir le sort
      const spell = heroData.getSpellByLevel(spellLevel);
      if (!spell) {
        spellsInfo[spellSlot] = {
          available: false,
          reason: "No spell defined for this level"
        };
        continue;
      }

      const currentSpellLevel = spell.level;
      const maxSpellLevel = (spellLevel >= 81) ? 10 : 12;
      
      if (currentSpellLevel >= maxSpellLevel) {
        spellsInfo[spellSlot] = {
          available: false,
          currentLevel: currentSpellLevel,
          maxLevel: maxSpellLevel,
          reason: "Spell is at maximum level"
        };
        continue;
      }

      // Calculer le coût d'upgrade
      const cost = this.calculateSpellUpgradeCost(currentSpellLevel, heroData.rarity, spellLevel);
      const requiredMaterial = `spell_essence_${heroData.element.toLowerCase()}`;
      const playerHasMaterial = (player.materials.get(requiredMaterial) || 0) >= cost.materials;

      spellsInfo[spellSlot] = {
        available: true,
        spellId: spell.id,
        currentLevel: currentSpellLevel,
        maxLevel: maxSpellLevel,
        cost,
        requiredMaterial,
        playerHasMaterial,
        playerCanAfford: player.gold >= cost.gold && playerHasMaterial
      };
    }

    return spellsInfo;
  }

  // ===============================================
  // MÉTHODES D'ACHIEVEMENTS
  // ===============================================

  private static emitLevelUpAchievements(accountId: string, serverId: string, heroData: any, oldLevel: number, newLevel: number) {
    achievementEmitter.emit(AchievementEvent.HERO_LEVEL_REACHED, {
      playerId: accountId,
      serverId,
      value: newLevel,
      metadata: {
        heroId: (heroData._id as any).toString(),
        heroName: heroData.name,
        rarity: heroData.rarity,
        element: heroData.element,
        role: heroData.role,
        previousLevel: oldLevel,
        levelsGained: newLevel - oldLevel
      }
    });
  }

  private static emitAscensionAchievements(accountId: string, serverId: string, heroData: any, ascensionTier: number) {
    achievementEmitter.emit(AchievementEvent.HERO_AWAKENED, {
      playerId: accountId,
      serverId,
      value: ascensionTier,
      metadata: {
        heroId: (heroData._id as any).toString(),
        heroName: heroData.name,
        rarity: heroData.rarity,
        element: heroData.element,
        role: heroData.role,
        ascensionTier
      }
    });
  }

  private static emitStarUpgradeAchievements(accountId: string, serverId: string, heroData: any, stars: number) {
    achievementEmitter.emit(AchievementEvent.HERO_STARS_REACHED, {
      playerId: accountId,
      serverId,
      value: stars,
      metadata: {
        heroId: (heroData._id as any).toString(),
        heroName: heroData.name,
        rarity: heroData.rarity,
        element: heroData.element,
        role: heroData.role,
        stars
      }
    });
  }

  // ===============================================
  // FONCTIONS AVANCÉES
  // ===============================================

  public static async getPlayerHeroesUpgradeOverview(accountId: string, serverId: string) {
    try {
      const player = await Player.findOne({ accountId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const heroesOverview = await Promise.all(player.heroes.map(async (heroInstance: any) => {
        const heroData = heroInstance.heroId;
        const currentStats = this.calculateHeroStats(heroData, heroInstance.level, heroInstance.stars, heroInstance.ascensionTier);
        
        const maxLevel = getMaxLevelForRarity(heroData.rarity);
        const canLevelUp = heroInstance.level < maxLevel && !this.isNextLevelAscension(heroInstance.level);
        const canAscend = this.isNextLevelAscension(heroInstance.level) && heroInstance.level < maxLevel;
        const canUpgradeStars = heroInstance.stars < this.getMaxStars(heroData.rarity);

        const nextLevelCost = canLevelUp ? 
          getLevelUpCost(heroInstance.level, heroInstance.level + 1, heroData.rarity) : null;
        
        const nextAscensionCost = canAscend ?
          getAscensionCostForLevel(heroInstance.level + 1) : null;
        
        const nextStarCost = canUpgradeStars ? 
          this.getStarUpgradeFragmentCost(heroInstance.stars, heroData.rarity) : null;

        const uiInfo = getAscensionUIInfo(heroData.rarity, heroInstance.level);

        return {
          instanceId: heroInstance._id?.toString() || "",
          heroId: (heroData._id as any).toString(),
          name: heroData.name,
          rarity: heroData.rarity,
          element: heroData.element,
          role: heroData.role,
          level: heroInstance.level,
          stars: heroInstance.stars,
          ascensionTier: heroInstance.ascensionTier,
          equipped: heroInstance.equipped,
          currentStats,
          power: this.calculateHeroPower(currentStats),
          unlockedSpells: heroInstance.unlockedSpells,
          upgradePossibilities: {
            canLevelUp,
            canAscend,
            canUpgradeStars,
            nextLevelCost,
            nextAscensionCost,
            nextStarCost,
            hasFragments: canUpgradeStars && nextStarCost !== null ? 
              (player.fragments.get(heroData._id.toString()) || 0) >= nextStarCost : false,
            hasAscensionResources: canAscend && nextAscensionCost ? 
              player.canAffordAscension(nextAscensionCost) : false
          },
          ascensionUI: uiInfo
        };
      }));

      const upgradeStats = {
        totalHeroes: heroesOverview.length,
        canLevelUp: heroesOverview.filter(h => h.upgradePossibilities.canLevelUp).length,
        canAscend: heroesOverview.filter(h => h.upgradePossibilities.canAscend).length,
        canUpgradeStars: heroesOverview.filter(h => h.upgradePossibilities.canUpgradeStars).length,
        totalPower: heroesOverview.reduce((sum, h) => sum + h.power, 0),
        byAscensionTier: {
          tier0: heroesOverview.filter(h => h.ascensionTier === 0).length,
          tier1: heroesOverview.filter(h => h.ascensionTier === 1).length,
          tier2: heroesOverview.filter(h => h.ascensionTier === 2).length,
          tier3: heroesOverview.filter(h => h.ascensionTier === 3).length,
          tier4: heroesOverview.filter(h => h.ascensionTier === 4).length
        }
      };

      return {
        success: true,
        heroes: heroesOverview.sort((a, b) => b.power - a.power),
        stats: upgradeStats,
        playerResources: {
          gold: player.gold,
          heroXP: player.heroXP,
          ascensionEssences: player.ascensionEssences,
          totalFragments: Array.from(player.fragments.values()).reduce((sum, f) => sum + f, 0),
          totalMaterials: Array.from(player.materials.values()).reduce((sum, m) => sum + m, 0)
        }
      };

    } catch (error: any) {
      throw error;
    }
  }

  public static async autoLevelUpHero(
    accountId: string,
    serverId: string,
    heroInstanceId: string,
    maxGoldToSpend?: number,
    maxHeroXPToSpend?: number,
    includeAscensions: boolean = false
  ) {
    try {
      const player = await Player.findOne({ accountId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const heroInstance = player.heroes.find(h => (h as any)._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        throw new Error("Hero not found");
      }

      const heroData = await Hero.findById(heroInstance.heroId);
      if (!heroData) {
        throw new Error("Hero data not found");
      }

      const upgrades: any[] = [];
      let totalCost = { gold: 0, heroXP: 0, ascensionEssence: 0 };
      const availableGold = maxGoldToSpend || player.gold;
      const availableHeroXP = maxHeroXPToSpend || player.heroXP;
      const maxLevel = getMaxLevelForRarity(heroData.rarity);

      let currentLevel = heroInstance.level;

      while (currentLevel < maxLevel && totalCost.gold < availableGold && totalCost.heroXP < availableHeroXP) {
        const nextLevel = currentLevel + 1;
        
        if (isAscensionLevel(nextLevel)) {
          if (!includeAscensions) {
            break; // Arrêter si on ne veut pas inclure les ascensions
          }
          
          const ascensionCost = getAscensionCostForLevel(nextLevel);
          if (!ascensionCost) break;
          
          // Vérifier si on peut payer l'ascension
          if (totalCost.gold + ascensionCost.gold <= availableGold &&
              totalCost.heroXP + ascensionCost.heroXP <= availableHeroXP &&
              player.ascensionEssences >= ascensionCost.ascensionEssence) {
            
            totalCost.gold += ascensionCost.gold;
            totalCost.heroXP += ascensionCost.heroXP;
            totalCost.ascensionEssence += ascensionCost.ascensionEssence;
            
            upgrades.push({
              type: "ascension",
              fromLevel: currentLevel,
              toLevel: nextLevel,
              newTier: getAscensionTier(nextLevel),
              cost: ascensionCost
            });
            
            currentLevel = nextLevel;
            heroInstance.ascensionTier = getAscensionTier(nextLevel);
          } else {
            break; // Pas assez de ressources pour l'ascension
          }
        } else {
          // Level up normal
          const levelUpCost = getLevelUpCost(currentLevel, nextLevel, heroData.rarity);
          
          if (totalCost.gold + levelUpCost.gold <= availableGold &&
              totalCost.heroXP + levelUpCost.heroXP <= availableHeroXP) {
            
            totalCost.gold += levelUpCost.gold;
            totalCost.heroXP += levelUpCost.heroXP;
            
            upgrades.push({
              type: "level_up",
              fromLevel: currentLevel,
              toLevel: nextLevel,
              cost: levelUpCost
            });
            
            currentLevel = nextLevel;
          } else {
            break; // Pas assez de ressources pour le level up
          }
        }
      }

      // Appliquer les changements si il y en a
      if (upgrades.length > 0) {
        heroInstance.level = currentLevel;
        
        // Dépenser les ressources
        player.gold -= totalCost.gold;
        player.heroXP -= totalCost.heroXP;
        if (totalCost.ascensionEssence > 0) {
          player.ascensionEssences -= totalCost.ascensionEssence;
        }
        
        // Mettre à jour les sorts débloqués
        this.updateUnlockedSpells(heroInstance, heroData, currentLevel);
        
        await player.save();
      }

      const finalStats = this.calculateHeroStats(heroData, heroInstance.level, heroInstance.stars, heroInstance.ascensionTier);

      return {
        success: true,
        hero: {
          instanceId: heroInstanceId,
          name: heroData.name,
          finalLevel: heroInstance.level,
          finalStars: heroInstance.stars,
          finalAscensionTier: heroInstance.ascensionTier,
          finalStats,
          finalPower: this.calculateHeroPower(finalStats),
          unlockedSpells: heroInstance.unlockedSpells
        },
        upgrades,
        totalCost,
        levelsGained: currentLevel - (heroInstance.level - upgrades.length),
        ascensionsPerformed: upgrades.filter(u => u.type === "ascension").length,
        playerResources: {
          gold: player.gold,
          heroXP: player.heroXP,
          ascensionEssences: player.ascensionEssences,
          fragments: Object.fromEntries(player.fragments.entries())
        }
      };

    } catch (error: any) {
      throw error;
    }
  }

  public static async getHeroUpgradeStats(accountId: string, serverId: string) {
    try {
      const player = await Player.findOne({ accountId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const stats = {
        totalHeroes: player.heroes.length,
        averageLevel: 0,
        averageStars: 0,
        rarityDistribution: { "Common": 0, "Rare": 0, "Epic": 0, "Legendary": 0, "Mythic": 0 },
        ascensionTierDistribution: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0 },
        maxLevelHeroes: 0,
        maxStarHeroes: 0,
        totalPower: 0,
        upgradeableHeroes: 0,
        heroesReadyForAscension: 0,
        totalSpellsUnlocked: 0
      };

      for (const heroInstance of player.heroes) {
        const heroData = heroInstance.heroId as any;
        stats.averageLevel += heroInstance.level;
        stats.averageStars += heroInstance.stars;
        
        const rarityKey = heroData.rarity as keyof typeof stats.rarityDistribution;
        if (stats.rarityDistribution[rarityKey] !== undefined) {
          stats.rarityDistribution[rarityKey]++;
        }
        
        const tierKey = heroInstance.ascensionTier.toString() as keyof typeof stats.ascensionTierDistribution;
        if (stats.ascensionTierDistribution[tierKey] !== undefined) {
          stats.ascensionTierDistribution[tierKey]++;
        }
        
        const currentStats = this.calculateHeroStats(heroData, heroInstance.level, heroInstance.stars, heroInstance.ascensionTier);
        stats.totalPower += this.calculateHeroPower(currentStats);
        
        const maxLevel = getMaxLevelForRarity(heroData.rarity);
        const maxStars = this.getMaxStars(heroData.rarity);
        
        if (heroInstance.level >= maxLevel && heroInstance.stars >= maxStars) {
          stats.maxLevelHeroes++;
        }
        
        if (heroInstance.level < maxLevel || heroInstance.stars < maxStars) {
          stats.upgradeableHeroes++;
        }
        
        if (this.isNextLevelAscension(heroInstance.level) && heroInstance.level < maxLevel) {
          stats.heroesReadyForAscension++;
        }
        
        stats.totalSpellsUnlocked += heroInstance.unlockedSpells.length;
      }

      stats.averageLevel = Math.round(stats.averageLevel / stats.totalHeroes * 10) / 10;
      stats.averageStars = Math.round(stats.averageStars / stats.totalHeroes * 10) / 10;

      return {
        success: true,
        stats,
        analysis: {
          upgradeProgress: Math.round((stats.maxLevelHeroes / stats.totalHeroes) * 100),
          powerPerHero: Math.round(stats.totalPower / stats.totalHeroes),
          averageSpellsPerHero: Math.round(stats.totalSpellsUnlocked / stats.totalHeroes * 10) / 10,
          resourceSufficiency: {
            gold: player.gold > stats.upgradeableHeroes * 1000,
            heroXP: player.heroXP > stats.upgradeableHeroes * 500,
            ascensionEssences: player.ascensionEssences > stats.heroesReadyForAscension * 5
          }
        }
      };

    } catch (error: any) {
      throw error;
    }
  }

  private static calculateHeroPower(stats: any): number {
    return Math.floor(
      stats.atk * 1.0 + 
      stats.def * 1.5 + 
      stats.hp / 10 + 
      stats.vitesse * 0.5 + 
      (stats.moral || 0) * 0.3
    );
  }

  private static async updateProgressTracking(accountId: string, serverId: string, upgradeType: string, value: number) {
    try {
      await Promise.all([
        MissionService.updateProgress(accountId, serverId, "heroes_owned", value, { upgradeType }),
        EventService.updatePlayerProgress(accountId, serverId, "collect_items", value, { itemType: "hero_upgrade", upgradeType })
      ]);
    } catch (error) {
      console.error("⚠️ Erreur mise à jour progression héros:", error);
    }
  }
}

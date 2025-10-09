// server/src/services/HeroSpellUpgradeService.ts

import Player from "../models/Player";
import Hero from "../models/Hero";
import { achievementEmitter, AchievementEvent } from '../utils/AchievementEmitter';

export interface SpellUpgradeResult {
  success: boolean;
  spell?: {
    slot: string;
    spellId: string;
    oldLevel: number;
    newLevel: number;
  };
  cost?: {
    gold: number;
    essence: number;
  };
  playerResources?: {
    gold: number;
    essences: Record<string, number>;
  };
  error?: string;
  code?: string;
}

export interface SpellUpgradeInfo {
  success: boolean;
  heroInstanceId: string;
  heroName: string;
  element: string;
  rarity: string;
  spells: {
    spell1?: SpellSlotInfo;
    spell2?: SpellSlotInfo;
    ultimate?: SpellSlotInfo;
    passive1?: SpellSlotInfo;
    passive2?: SpellSlotInfo;
    passive3?: SpellSlotInfo;
  };
  playerResources: {
    gold: number;
    essences: Record<string, number>;
  };
}

interface SpellSlotInfo {
  spellId: string;
  currentLevel: number;
  maxLevel: number;
  canUpgrade: boolean;
  upgradeCost?: {
    gold: number;
    essence: number;
  };
  reason?: string;
}

export class HeroSpellUpgradeService {

  /**
   * Obtenir les informations d'upgrade pour tous les sorts d'un héros
   */
  static async getHeroSpellUpgradeInfo(
    accountId: string,
    serverId: string,
    heroInstanceId: string
  ): Promise<SpellUpgradeInfo> {
    try {
      const player = await Player.findOne({ accountId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const heroInstance = player.heroes.find((h: any) => h._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        throw new Error("Hero not found");
      }

      const heroData = heroInstance.heroId as any;
      if (!heroData) {
        throw new Error("Hero data not found");
      }

      const maxLevel = this.getMaxSpellLevel(heroData.rarity);
      const essenceType = this.getEssenceType(heroData.element);

      const spellsInfo: any = {};
      const slots = ['spell1', 'spell2', 'ultimate', 'passive1', 'passive2', 'passive3'];

      for (const slot of slots) {
        const spellData = heroData.spells?.[slot as keyof typeof heroData.spells];
        
        if (spellData?.id) {
          const currentLevel = spellData.level;
          const canUpgrade = currentLevel < maxLevel;
          const upgradeCost = canUpgrade 
            ? this.calculateUpgradeCost(currentLevel, heroData.rarity, heroData.element)
            : undefined;

          spellsInfo[slot] = {
            spellId: spellData.id,
            currentLevel,
            maxLevel,
            canUpgrade,
            upgradeCost,
            reason: canUpgrade ? undefined : "Maximum level reached"
          };
        }
      }

      return {
        success: true,
        heroInstanceId,
        heroName: heroData.name,
        element: heroData.element,
        rarity: heroData.rarity,
        spells: spellsInfo,
        playerResources: {
          gold: player.gold,
          essences: this.getPlayerEssences(player, essenceType)
        }
      };

    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Upgrader un sort spécifique
   */
  static async upgradeSpell(
    accountId: string,
    serverId: string,
    heroInstanceId: string,
    spellSlot: "spell1" | "spell2" | "ultimate" | "passive1" | "passive2" | "passive3"
  ): Promise<SpellUpgradeResult> {
    try {
      const player = await Player.findOne({ accountId, serverId }).populate("heroes.heroId");
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const heroInstance = player.heroes.find((h: any) => h._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        return { success: false, error: "Hero not found", code: "HERO_NOT_FOUND" };
      }

      const heroData = heroInstance.heroId as any;
      if (!heroData) {
        return { success: false, error: "Hero data not found", code: "HERO_DATA_NOT_FOUND" };
      }

      // Vérifier que le slot existe
      const spellData = heroData.spells?.[spellSlot];
      if (!spellData?.id) {
        return { 
          success: false, 
          error: `Spell slot ${spellSlot} is not unlocked or empty`, 
          code: "SPELL_SLOT_EMPTY" 
        };
      }

      const currentLevel = spellData.level;
      const maxLevel = this.getMaxSpellLevel(heroData.rarity);

      // Vérifier niveau max
      if (currentLevel >= maxLevel) {
        return { 
          success: false, 
          error: `Spell is already at maximum level (${maxLevel})`, 
          code: "MAX_LEVEL_REACHED" 
        };
      }

      // Calculer le coût
      const cost = this.calculateUpgradeCost(currentLevel, heroData.rarity, heroData.element);
      const essenceType = this.getEssenceType(heroData.element);

      // Vérifier les ressources
      if (player.gold < cost.gold) {
        return { 
          success: false, 
          error: `Insufficient gold. Required: ${cost.gold}, Available: ${player.gold}`, 
          code: "INSUFFICIENT_GOLD" 
        };
      }

      const currentEssence = player.materials.get(essenceType) || 0;
      if (currentEssence < cost.essence) {
        return { 
          success: false, 
          error: `Insufficient ${essenceType}. Required: ${cost.essence}, Available: ${currentEssence}`, 
          code: "INSUFFICIENT_ESSENCE" 
        };
      }

      // Déduire les ressources
      player.gold -= cost.gold;
      player.materials.set(essenceType, currentEssence - cost.essence);

      // Upgrader le sort
      const oldLevel = spellData.level;
      spellData.level = currentLevel + 1;

      await heroData.save();
      await player.save();

      // Achievements
      achievementEmitter.emit(AchievementEvent.GOLD_SPENT, {
        playerId: accountId,
        serverId,
        value: cost.gold,
        metadata: {
          spentOn: 'spell_upgrade',
          heroId: heroData._id.toString(),
          heroName: heroData.name,
          spellSlot,
          spellId: spellData.id,
          newLevel: spellData.level
        }
      });

      console.log(`✨ ${heroData.name} - ${spellSlot} (${spellData.id}) upgraded: ${oldLevel} → ${spellData.level}`);

      return {
        success: true,
        spell: {
          slot: spellSlot,
          spellId: spellData.id,
          oldLevel,
          newLevel: spellData.level
        },
        cost,
        playerResources: {
          gold: player.gold,
          essences: this.getPlayerEssences(player, essenceType)
        }
      };

    } catch (error: any) {
      return { success: false, error: error.message, code: "UPGRADE_FAILED" };
    }
  }

  /**
   * Upgrader tous les sorts d'un héros (max upgrade avec budget)
   */
  static async autoUpgradeAllSpells(
    accountId: string,
    serverId: string,
    heroInstanceId: string,
    maxGoldToSpend?: number
  ) {
    try {
      const player = await Player.findOne({ accountId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const heroInstance = player.heroes.find((h: any) => h._id?.toString() === heroInstanceId);
      if (!heroInstance) {
        throw new Error("Hero not found");
      }

      const heroData = heroInstance.heroId as any;
      const maxLevel = this.getMaxSpellLevel(heroData.rarity);
      const essenceType = this.getEssenceType(heroData.element);

      const upgrades: any[] = [];
      let totalGoldSpent = 0;
      let totalEssenceSpent = 0;
      const availableGold = maxGoldToSpend || player.gold;

      const slots = ['spell1', 'spell2', 'ultimate', 'passive1', 'passive2', 'passive3'];

      for (const slot of slots) {
        const spellData = heroData.spells?.[slot as keyof typeof heroData.spells];
        
        if (!spellData?.id) continue;

        let currentLevel = spellData.level;
        
        while (currentLevel < maxLevel) {
          const cost = this.calculateUpgradeCost(currentLevel, heroData.rarity, heroData.element);
          const currentEssence = player.materials.get(essenceType) || 0;

          // Vérifier si on peut se permettre l'upgrade
          if (totalGoldSpent + cost.gold > availableGold || 
              totalEssenceSpent + cost.essence > currentEssence) {
            break;
          }

          // Effectuer l'upgrade
          const oldLevel = currentLevel;
          currentLevel++;
          spellData.level = currentLevel;

          totalGoldSpent += cost.gold;
          totalEssenceSpent += cost.essence;

          upgrades.push({
            slot,
            spellId: spellData.id,
            from: oldLevel,
            to: currentLevel,
            cost
          });
        }
      }

      if (upgrades.length > 0) {
        player.gold -= totalGoldSpent;
        const currentEssence = player.materials.get(essenceType) || 0;
        player.materials.set(essenceType, currentEssence - totalEssenceSpent);
        await heroData.save();
        await player.save();

        console.log(`✨ Auto-upgrade complet pour ${heroData.name}: ${upgrades.length} sorts upgradés`);
      }

      return {
        success: true,
        heroName: heroData.name,
        upgrades,
        totalCost: {
          gold: totalGoldSpent,
          essence: totalEssenceSpent
        },
        playerResources: {
          gold: player.gold,
          essences: this.getPlayerEssences(player, essenceType)
        }
      };

    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Obtenir un résumé des upgrades possibles pour tous les héros
   */
  static async getAllHeroesSpellUpgradeSummary(accountId: string, serverId: string) {
    try {
      const player = await Player.findOne({ accountId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      const heroesSummary: any[] = [];

      for (const heroInstance of player.heroes) {
        const heroData = heroInstance.heroId as any;
        if (!heroData) continue;

        const maxLevel = this.getMaxSpellLevel(heroData.rarity);
        const slots = ['spell1', 'spell2', 'ultimate', 'passive1', 'passive2', 'passive3'];
        
        let upgradeableSpells = 0;
        let totalUpgradeCost = { gold: 0, essence: 0 };

        for (const slot of slots) {
          const spellData = heroInstance.spells?.[slot as keyof typeof heroInstance.spells];
          if (spellData?.id && spellData.level < maxLevel) {
            upgradeableSpells++;
            const cost = this.calculateUpgradeCost(spellData.level, heroData.rarity, heroData.element);
            totalUpgradeCost.gold += cost.gold;
            totalUpgradeCost.essence += cost.essence;
          }
        }

        if (upgradeableSpells > 0) {
          heroesSummary.push({
            instanceId: (heroInstance as any)._id?.toString(),
            heroName: heroData.name,
            element: heroData.element,
            rarity: heroData.rarity,
            upgradeableSpells,
            nextUpgradeCost: totalUpgradeCost
          });
        }
      }

      heroesSummary.sort((a, b) => b.upgradeableSpells - a.upgradeableSpells);

      return {
        success: true,
        heroes: heroesSummary,
        totalUpgradeableHeroes: heroesSummary.length,
        playerResources: {
          gold: player.gold,
          essences: this.getAllPlayerEssences(player)
        }
      };

    } catch (error: any) {
      throw error;
    }
  }

  // ============================================
  // MÉTHODES PRIVÉES
  // ============================================

  /**
   * Calculer le coût d'upgrade d'un sort
   */
  private static calculateUpgradeCost(
    currentLevel: number,
    rarity: string,
    element: string
  ): { gold: number; essence: number } {
    const rarityMultipliers: Record<string, number> = {
      "Common": 1.0,
      "Rare": 1.5,
      "Epic": 2.0,
      "Legendary": 3.0,
      "Mythic": 4.0
    };

    const rarityMultiplier = rarityMultipliers[rarity] || 1.0;
    const nextLevel = currentLevel + 1;

    const baseGoldCost = 500;
    const baseEssenceCost = 5;

    return {
      gold: Math.floor(baseGoldCost * nextLevel * rarityMultiplier),
      essence: Math.floor(baseEssenceCost * nextLevel * rarityMultiplier)
    };
  }

  /**
   * Obtenir le niveau max des sorts selon la rareté du héros
   */
  private static getMaxSpellLevel(rarity: string): number {
    const maxLevels: Record<string, number> = {
      "Common": 5,
      "Rare": 6,
      "Epic": 8,
      "Legendary": 10,
      "Mythic": 12
    };

    return maxLevels[rarity] || 5;
  }

  /**
   * Obtenir le type d'essence selon l'élément
   */
  private static getEssenceType(element: string): string {
    const essenceMap: Record<string, string> = {
      "Fire": "fire_essence",
      "Water": "water_essence",
      "Wind": "wind_essence",
      "Electric": "electric_essence",
      "Light": "light_essence",
      "Dark": "dark_essence"
    };

    return essenceMap[element] || "neutral_essence";
  }

  /**
   * Obtenir les essences d'un joueur pour un élément
   */
  private static getPlayerEssences(player: any, essenceType: string): Record<string, number> {
    return {
      [essenceType]: player.materials.get(essenceType) || 0
    };
  }

  /**
   * Obtenir toutes les essences d'un joueur
   */
  private static getAllPlayerEssences(player: any): Record<string, number> {
    const essenceTypes = [
      'fire_essence', 'water_essence', 'wind_essence',
      'electric_essence', 'light_essence', 'dark_essence'
    ];

    const essences: Record<string, number> = {};
    for (const essence of essenceTypes) {
      essences[essence] = player.materials.get(essence) || 0;
    }

    return essences;
  }
}

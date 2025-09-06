/**
 * AfkUnlockSystem - Système de déblocage progressif des récompenses AFK
 * Comme AFK Arena : les types de récompenses se débloquent au fur et à mesure de la progression
 */

export type RewardType = "gold" | "exp" | "dust" | "essence" | "gems" | "tickets" | "fragments";
export type MaterialType = "fusion_crystal" | "elemental_essence" | "ascension_stone" | "divine_crystal";
export type FragmentType = "common_hero_fragments" | "rare_hero_fragments" | "epic_hero_fragments" | "legendary_hero_fragments";

export interface UnlockRequirement {
  world: number;
  level?: number;           // Optionnel : niveau spécifique dans le monde
  description: string;      // Description pour l'UI
  unlockMessage: string;    // Message affiché quand débloqué
}

export interface RewardUnlock {
  rewardType: RewardType | MaterialType | FragmentType;
  requirement: UnlockRequirement;
  baseRate: number;         // Taux de base par minute
  category: "currency" | "material" | "fragment";
  rarity: "common" | "rare" | "epic" | "legendary";
  isActive: boolean;        // Si ce type de récompense est actif dans le jeu
}

// Configuration des déblocages progressifs (inspiré AFK Arena)
export const AFK_UNLOCK_CONFIG: RewardUnlock[] = [
  // === MONNAIES DE BASE ===
  {
    rewardType: "gold",
    requirement: {
      world: 1,
      level: 1,
      description: "Available from start",
      unlockMessage: "Gold generation unlocked!"
    },
    baseRate: 100,
    category: "currency",
    rarity: "common",
    isActive: true
  },
  
  {
    rewardType: "exp",
    requirement: {
      world: 1,
      level: 10,
      description: "Unlock at level 1-10",
      unlockMessage: "Experience generation unlocked! Your heroes can now gain EXP while AFK."
    },
    baseRate: 50,
    category: "currency",
    rarity: "common",
    isActive: true
  },

  // === MATÉRIAUX PROGRESSION ===
  {
    rewardType: "fusion_crystal",
    requirement: {
      world: 2,
      level: 1,
      description: "Unlock at World 2",
      unlockMessage: "Fusion Crystals unlocked! Essential for hero upgrades."
    },
    baseRate: 8,
    category: "material",
    rarity: "common",
    isActive: true
  },

  {
    rewardType: "elemental_essence",
    requirement: {
      world: 4,
      level: 1,
      description: "Unlock at World 4",
      unlockMessage: "Elemental Essence unlocked! Used for advanced hero abilities."
    },
    baseRate: 3,
    category: "material",
    rarity: "rare",
    isActive: true
  },

  {
    rewardType: "ascension_stone",
    requirement: {
      world: 6,
      level: 1,
      description: "Unlock at World 6",
      unlockMessage: "Ascension Stones unlocked! Critical for hero evolution."
    },
    baseRate: 1,
    category: "material",
    rarity: "epic",
    isActive: true
  },

  // === MONNAIES PREMIUM ===
  {
    rewardType: "gems",
    requirement: {
      world: 8,
      level: 1,
      description: "Unlock at World 8",
      unlockMessage: "Gems generation unlocked! Premium currency from AFK rewards."
    },
    baseRate: 1,
    category: "currency",
    rarity: "rare",
    isActive: true
  },

  {
    rewardType: "tickets",
    requirement: {
      world: 12,
      level: 1,
      description: "Unlock at World 12",
      unlockMessage: "Summon Tickets unlocked! Free summons from AFK time."
    },
    baseRate: 0.5,
    category: "currency",
    rarity: "epic",
    isActive: true
  },

  // === MATÉRIAUX AVANCÉS ===
  {
    rewardType: "divine_crystal",
    requirement: {
      world: 15,
      level: 1,
      description: "Unlock at World 15",
      unlockMessage: "Divine Crystals unlocked! Legendary materials for end-game progression."
    },
    baseRate: 0.5,
    category: "material",
    rarity: "legendary",
    isActive: true
  },

  // === FRAGMENTS DE HÉROS ===
  {
    rewardType: "common_hero_fragments",
    requirement: {
      world: 3,
      level: 1,
      description: "Unlock at World 3",
      unlockMessage: "Common Hero Fragments unlocked! Collect fragments to summon heroes."
    },
    baseRate: 2,
    category: "fragment",
    rarity: "common",
    isActive: true
  },

  {
    rewardType: "rare_hero_fragments",
    requirement: {
      world: 7,
      level: 1,
      description: "Unlock at World 7",
      unlockMessage: "Rare Hero Fragments unlocked! More powerful heroes await."
    },
    baseRate: 1,
    category: "fragment",
    rarity: "rare",
    isActive: true
  },

  {
    rewardType: "epic_hero_fragments",
    requirement: {
      world: 10,
      level: 1,
      description: "Unlock at World 10",
      unlockMessage: "Epic Hero Fragments unlocked! Elite heroes join your collection."
    },
    baseRate: 0.5,
    category: "fragment",
    rarity: "epic",
    isActive: true
  },

  {
    rewardType: "legendary_hero_fragments",
    requirement: {
      world: 18,
      level: 1,
      description: "Unlock at World 18",
      unlockMessage: "Legendary Hero Fragments unlocked! The most powerful heroes!"
    },
    baseRate: 0.1,
    category: "fragment",
    rarity: "legendary",
    isActive: true
  }
];

export class AfkUnlockSystem {

  // === VÉRIFICATION DES DÉBLOCAGES ===

  /**
   * Vérifier si un type de récompense est débloqué pour un joueur
   */
  public static isRewardUnlocked(
    rewardType: RewardType | MaterialType | FragmentType,
    playerWorld: number,
    playerLevel: number
  ): boolean {
    const unlock = AFK_UNLOCK_CONFIG.find(u => u.rewardType === rewardType);
    
    if (!unlock || !unlock.isActive) {
      return false;
    }

    // Vérifier le monde
    if (playerWorld < unlock.requirement.world) {
      return false;
    }

    // Si même monde, vérifier le niveau (si spécifié)
    if (playerWorld === unlock.requirement.world && unlock.requirement.level) {
      return playerLevel >= unlock.requirement.level;
    }

    return true;
  }

  /**
   * Obtenir tous les types de récompenses débloqués pour un joueur
   */
  public static getUnlockedRewards(
    playerWorld: number,
    playerLevel: number
  ): RewardUnlock[] {
    return AFK_UNLOCK_CONFIG.filter(unlock => 
      unlock.isActive && this.isRewardUnlocked(unlock.rewardType, playerWorld, playerLevel)
    );
  }

  /**
   * Obtenir les prochains déblocages pour un joueur
   */
  public static getUpcomingUnlocks(
    playerWorld: number,
    playerLevel: number,
    limit: number = 3
  ): RewardUnlock[] {
    return AFK_UNLOCK_CONFIG
      .filter(unlock => 
        unlock.isActive && !this.isRewardUnlocked(unlock.rewardType, playerWorld, playerLevel)
      )
      .sort((a, b) => {
        // Trier par monde puis par niveau
        if (a.requirement.world !== b.requirement.world) {
          return a.requirement.world - b.requirement.world;
        }
        return (a.requirement.level || 0) - (b.requirement.level || 0);
      })
      .slice(0, limit);
  }

  /**
   * Calculer combien de niveaux/mondes manquent pour débloquer une récompense
   */
  public static getLevelsToUnlock(
    rewardType: RewardType | MaterialType | FragmentType,
    playerWorld: number,
    playerLevel: number
  ): { worldsToGo: number; levelsToGo: number; totalLevelsToGo: number } {
    const unlock = AFK_UNLOCK_CONFIG.find(u => u.rewardType === rewardType);
    
    if (!unlock) {
      return { worldsToGo: 0, levelsToGo: 0, totalLevelsToGo: 0 };
    }

    if (this.isRewardUnlocked(rewardType, playerWorld, playerLevel)) {
      return { worldsToGo: 0, levelsToGo: 0, totalLevelsToGo: 0 };
    }

    const worldsToGo = Math.max(0, unlock.requirement.world - playerWorld);
    const levelsToGo = unlock.requirement.level ? 
      Math.max(0, unlock.requirement.level - playerLevel) : 0;
    
    // Estimation du nombre total de niveaux (assumant ~20 niveaux par monde)
    const totalLevelsToGo = worldsToGo * 20 + levelsToGo;

    return { worldsToGo, levelsToGo, totalLevelsToGo };
  }

  // === CALCUL DES TAUX SELON LES DÉBLOCAGES ===

  /**
   * Obtenir le taux de base d'une récompense (si débloquée)
   */
  public static getBaseRate(
    rewardType: RewardType | MaterialType | FragmentType,
    playerWorld: number,
    playerLevel: number
  ): number {
    if (!this.isRewardUnlocked(rewardType, playerWorld, playerLevel)) {
      return 0;
    }

    const unlock = AFK_UNLOCK_CONFIG.find(u => u.rewardType === rewardType);
    return unlock?.baseRate || 0;
  }

  /**
   * Obtenir tous les taux de base pour un joueur
   */
  public static getAllBaseRates(
    playerWorld: number,
    playerLevel: number
  ): Record<string, number> {
    const rates: Record<string, number> = {};
    
    AFK_UNLOCK_CONFIG.forEach(unlock => {
      if (unlock.isActive) {
        rates[unlock.rewardType] = this.getBaseRate(unlock.rewardType, playerWorld, playerLevel);
      }
    });

    return rates;
  }

  // === FONCTIONNALITÉS UI ===

  /**
   * Obtenir les informations de déblocage pour l'UI
   */
  public static getUnlockInfo(
    playerWorld: number,
    playerLevel: number
  ): {
    unlocked: RewardUnlock[];
    upcoming: RewardUnlock[];
    totalUnlocked: number;
    totalAvailable: number;
    progressPercentage: number;
  } {
    const unlocked = this.getUnlockedRewards(playerWorld, playerLevel);
    const upcoming = this.getUpcomingUnlocks(playerWorld, playerLevel, 5);
    const totalAvailable = AFK_UNLOCK_CONFIG.filter(u => u.isActive).length;
    
    return {
      unlocked,
      upcoming,
      totalUnlocked: unlocked.length,
      totalAvailable,
      progressPercentage: Math.round((unlocked.length / totalAvailable) * 100)
    };
  }

  /**
   * Obtenir les messages de déblocage récents pour un joueur
   */
  public static getRecentUnlocks(
    previousWorld: number,
    previousLevel: number,
    currentWorld: number,
    currentLevel: number
  ): RewardUnlock[] {
    const recentUnlocks: RewardUnlock[] = [];
    
    AFK_UNLOCK_CONFIG.forEach(unlock => {
      if (!unlock.isActive) return;
      
      const wasUnlocked = this.isRewardUnlocked(unlock.rewardType, previousWorld, previousLevel);
      const isNowUnlocked = this.isRewardUnlocked(unlock.rewardType, currentWorld, currentLevel);
      
      if (!wasUnlocked && isNowUnlocked) {
        recentUnlocks.push(unlock);
      }
    });

    return recentUnlocks;
  }

  // === CONFIGURATION ET MAINTENANCE ===

  /**
   * Valider la configuration des déblocages
   */
  public static validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Vérifier qu'il n'y a pas de doublons
    const rewardTypes = AFK_UNLOCK_CONFIG.map(u => u.rewardType);
    const duplicates = rewardTypes.filter((type, index) => rewardTypes.indexOf(type) !== index);
    
    if (duplicates.length > 0) {
      errors.push(`Duplicate reward types: ${duplicates.join(", ")}`);
    }

    // Vérifier que les mondes sont dans l'ordre croissant
    let lastWorld = 0;
    for (const unlock of AFK_UNLOCK_CONFIG) {
      if (unlock.requirement.world < lastWorld) {
        errors.push(`World order issue: ${unlock.rewardType} at world ${unlock.requirement.world}`);
      }
      lastWorld = unlock.requirement.world;
    }

    // Vérifier les taux de base
    const invalidRates = AFK_UNLOCK_CONFIG.filter(u => u.baseRate < 0);
    if (invalidRates.length > 0) {
      errors.push(`Invalid base rates for: ${invalidRates.map(u => u.rewardType).join(", ")}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Obtenir les statistiques de la configuration
   */
  public static getConfigStats(): {
    totalRewards: number;
    byCategory: Record<string, number>;
    byRarity: Record<string, number>;
    byWorld: Record<number, number>;
    averageBaseRate: number;
  } {
    const active = AFK_UNLOCK_CONFIG.filter(u => u.isActive);
    
    const byCategory: Record<string, number> = {};
    const byRarity: Record<string, number> = {};
    const byWorld: Record<number, number> = {};
    
    active.forEach(unlock => {
      byCategory[unlock.category] = (byCategory[unlock.category] || 0) + 1;
      byRarity[unlock.rarity] = (byRarity[unlock.rarity] || 0) + 1;
      byWorld[unlock.requirement.world] = (byWorld[unlock.requirement.world] || 0) + 1;
    });

    const totalRate = active.reduce((sum, unlock) => sum + unlock.baseRate, 0);
    const averageBaseRate = active.length > 0 ? totalRate / active.length : 0;

    return {
      totalRewards: active.length,
      byCategory,
      byRarity,
      byWorld,
      averageBaseRate: Math.round(averageBaseRate * 100) / 100
    };
  }

  // === INTÉGRATION AVEC SYSTÈME EXISTANT ===

  /**
   * Filtrer une liste de récompenses selon les déblocages
   */
  public static filterRewardsByUnlocks<T extends { type: string; materialId?: string; fragmentId?: string }>(
    rewards: T[],
    playerWorld: number,
    playerLevel: number
  ): T[] {
    return rewards.filter(reward => {
      let rewardType: string;
      
      // Déterminer le type de récompense
      if (reward.type === "material" && reward.materialId) {
        rewardType = reward.materialId;
      } else if (reward.type === "fragment" && reward.fragmentId) {
        rewardType = reward.fragmentId;
      } else {
        rewardType = reward.type;
      }
      
      return this.isRewardUnlocked(rewardType as any, playerWorld, playerLevel);
    });
  }

  /**
   * Obtenir le multiplicateur de progression pour une récompense
   * (Plus une récompense est débloquée depuis longtemps, plus elle est efficace)
   */
  public static getProgressionMultiplier(
    rewardType: RewardType | MaterialType | FragmentType,
    playerWorld: number,
    playerLevel: number
  ): number {
    const unlock = AFK_UNLOCK_CONFIG.find(u => u.rewardType === rewardType);
    
    if (!unlock || !this.isRewardUnlocked(rewardType, playerWorld, playerLevel)) {
      return 0;
    }

    // Calculer depuis combien de "temps" la récompense est débloquée
    const worldsSinceUnlock = playerWorld - unlock.requirement.world;
    const levelsSinceUnlock = (unlock.requirement.level || 0) > 0 ? 
      playerLevel - unlock.requirement.level! : 0;
    
    // Multiplicateur basé sur la progression depuis le déblocage
    const baseMultiplier = 1.0;
    const worldBonus = worldsSinceUnlock * 0.1; // +10% par monde depuis déblocage
    const levelBonus = levelsSinceUnlock * 0.02; // +2% par niveau depuis déblocage
    
    return Math.max(baseMultiplier, baseMultiplier + worldBonus + levelBonus);
  }
}

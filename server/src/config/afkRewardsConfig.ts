// server/src/config/afkRewardsConfig.ts

/**
 * Configuration des récompenses AFK - Hero XP et Ascension Essences
 * Permet d'équilibrer facilement les taux et déblocages
 */

// ===== VARIABLE DEBUG =====
// ⚠️ METTRE À FALSE EN PRODUCTION !
export const DEBUG_UNLOCK_ALL_AT_WORLD_1 = true;

/**
 * Si DEBUG_UNLOCK_ALL_AT_WORLD_1 = true, 
 * toutes les récompenses sont débloquées dès le monde 1 niveau 1
 * pour faciliter les tests
 */

export interface AfkRewardConfig {
  type: "heroXP" | "ascensionEssences";
  unlockRequirement: {
    minWorld: number;
    minLevel: number;
    description: string;
  };
  baseRate: {
    min: number;        // Quantité minimum par minute
    max: number;        // Quantité maximum par minute
    scaling: number;    // Multiplicateur par monde (ex: 1.15 = +15% par monde)
  };
  progressionBonus: {
    vipMultiplier: number;      // Bonus VIP (ex: 0.1 = +10% par niveau VIP)
    difficultyMultiplier: {     // Bonus selon difficulté
      Normal: number;
      Hard: number;
      Nightmare: number;
    };
    stageMultiplier: number;    // Bonus par stage avancé (ex: 0.02 = +2% par stage)
  };
  dailyCap?: {
    enabled: boolean;
    maxPerDay: number;
    resetHour: number;  // Heure UTC de reset (0-23)
  };
  metadata: {
    rarity: "common" | "rare" | "epic" | "legendary";
    category: "progression" | "enhancement" | "currency";
    description: string;
  };
}

// ===== CONFIGURATION DES RÉCOMPENSES AFK =====
export const AFK_REWARDS_CONFIG: AfkRewardConfig[] = [
  
  // === HERO XP ===
  {
    type: "heroXP",
    unlockRequirement: {
      minWorld: 2,        // Déblocage monde 2
      minLevel: 15,       // Niveau 15 minimum
      description: "Unlocked at World 2, Level 15"
    },
    baseRate: {
      min: 20,           // 20 Hero XP/min minimum
      max: 50,           // 50 Hero XP/min maximum
      scaling: 1.12      // +12% par monde
    },
    progressionBonus: {
      vipMultiplier: 0.08,    // +8% par niveau VIP
      difficultyMultiplier: {
        Normal: 1.0,
        Hard: 1.3,         // +30% en Hard
        Nightmare: 1.6     // +60% en Nightmare
      },
      stageMultiplier: 0.015  // +1.5% par stage au-delà du minimum
    },
    dailyCap: {
      enabled: false,     // Pas de cap journalier pour Hero XP
      maxPerDay: 0,
      resetHour: 0
    },
    metadata: {
      rarity: "common",
      category: "progression",
      description: "Experience points used to level up heroes"
    }
  },

  // === ASCENSION ESSENCES ===
  {
    type: "ascensionEssences",
    unlockRequirement: {
      minWorld: 5,        // Déblocage monde 5 (plus tard)
      minLevel: 35,       // Niveau 35 minimum
      description: "Unlocked at World 5, Level 35"
    },
    baseRate: {
      min: 1,            // 1 Essence/min minimum
      max: 4,            // 4 Essences/min maximum
      scaling: 1.18      // +18% par monde (plus rare)
    },
    progressionBonus: {
      vipMultiplier: 0.12,    // +12% par niveau VIP (plus généreux)
      difficultyMultiplier: {
        Normal: 1.0,
        Hard: 1.5,         // +50% en Hard
        Nightmare: 2.2     // +120% en Nightmare
      },
      stageMultiplier: 0.025  // +2.5% par stage au-delà du minimum
    },
    dailyCap: {
      enabled: true,      // Cap journalier pour Essences (rare)
      maxPerDay: 200,     // 200 essences max par jour
      resetHour: 4        // Reset à 4h UTC (pour éviter minuit)
    },
    metadata: {
      rarity: "epic",
      category: "enhancement",
      description: "Rare essences used to break hero level caps at major tiers"
    }
  }
];

// ===== FONCTIONS UTILITAIRES =====

/**
 * Obtenir la config d'une récompense par type
 */
export function getAfkRewardConfig(type: "heroXP" | "ascensionEssences"): AfkRewardConfig | undefined {
  return AFK_REWARDS_CONFIG.find(config => config.type === type);
}

/**
 * Vérifier si un joueur a débloqué une récompense
 */
export function isAfkRewardUnlocked(
  type: "heroXP" | "ascensionEssences",
  playerWorld: number,
  playerLevel: number
): boolean {
  const config = getAfkRewardConfig(type);
  if (!config) return false;
  
  // ✅ MODE DEBUG : Tout débloqué au monde 1
  if (DEBUG_UNLOCK_ALL_AT_WORLD_1) {
    return playerWorld >= 1 && playerLevel >= 1;
  }
  
  // Mode normal
  return playerWorld >= config.unlockRequirement.minWorld && 
         playerLevel >= config.unlockRequirement.minLevel;
}

/**
 * Calculer le taux de base selon la progression du joueur
 */
export function calculateAfkRewardBaseRate(
  type: "heroXP" | "ascensionEssences",
  playerWorld: number,
  playerLevel: number
): number {
  const config = getAfkRewardConfig(type);
  if (!config || !isAfkRewardUnlocked(type, playerWorld, playerLevel)) {
    return 0;
  }

  // ✅ MODE DEBUG : Utiliser monde 1 comme base
  const baseWorld = DEBUG_UNLOCK_ALL_AT_WORLD_1 ? 1 : config.unlockRequirement.minWorld;
  
  // Taux de base + scaling par monde
  const worldMultiplier = Math.pow(config.baseRate.scaling, playerWorld - baseWorld);
  const baseRate = config.baseRate.min * worldMultiplier;
  
  // Limiter au maximum configuré
  return Math.min(baseRate, config.baseRate.max);
}

/**
 * Calculer les multiplicateurs selon progression, VIP, difficulté
 */
export function calculateAfkRewardMultipliers(
  type: "heroXP" | "ascensionEssences",
  playerWorld: number,
  playerLevel: number,
  vipLevel: number,
  difficulty: "Normal" | "Hard" | "Nightmare"
): {
  vipMultiplier: number;
  difficultyMultiplier: number;
  stageMultiplier: number;
  totalMultiplier: number;
} {
  const config = getAfkRewardConfig(type);
  if (!config) {
    return { vipMultiplier: 1, difficultyMultiplier: 1, stageMultiplier: 1, totalMultiplier: 1 };
  }

  // Multiplicateur VIP
  const vipMultiplier = 1 + (vipLevel * config.progressionBonus.vipMultiplier);
  
  // Multiplicateur difficulté
  const difficultyMultiplier = config.progressionBonus.difficultyMultiplier[difficulty] || 1;
  
  // ✅ MODE DEBUG : Utiliser niveau 1 comme base
  const baseLevel = DEBUG_UNLOCK_ALL_AT_WORLD_1 ? 1 : config.unlockRequirement.minLevel;
  
  // Multiplicateur stage (bonus pour être avancé)
  const stageProgress = Math.max(0, playerLevel - baseLevel);
  const stageMultiplier = 1 + (stageProgress * config.progressionBonus.stageMultiplier);
  
  // Multiplicateur total
  const totalMultiplier = vipMultiplier * difficultyMultiplier * stageMultiplier;
  
  return {
    vipMultiplier,
    difficultyMultiplier,
    stageMultiplier,
    totalMultiplier
  };
}

/**
 * Calculer la quantité finale par minute pour un joueur
 */
export function calculateAfkRewardPerMinute(
  type: "heroXP" | "ascensionEssences",
  playerWorld: number,
  playerLevel: number,
  vipLevel: number,
  difficulty: "Normal" | "Hard" | "Nightmare"
): {
  baseRate: number;
  multipliers: ReturnType<typeof calculateAfkRewardMultipliers>;
  finalRate: number;
  isUnlocked: boolean;
} {
  const isUnlocked = isAfkRewardUnlocked(type, playerWorld, playerLevel);
  
  if (!isUnlocked) {
    return {
      baseRate: 0,
      multipliers: { vipMultiplier: 1, difficultyMultiplier: 1, stageMultiplier: 1, totalMultiplier: 1 },
      finalRate: 0,
      isUnlocked: false
    };
  }

  const baseRate = calculateAfkRewardBaseRate(type, playerWorld, playerLevel);
  const multipliers = calculateAfkRewardMultipliers(type, playerWorld, playerLevel, vipLevel, difficulty);
  const finalRate = Math.floor(baseRate * multipliers.totalMultiplier);

  return {
    baseRate,
    multipliers,
    finalRate,
    isUnlocked: true
  };
}

/**
 * Obtenir un résumé des déblocages pour l'UI
 */
export function getAfkRewardsUnlockSummary(
  playerWorld: number,
  playerLevel: number
): {
  unlocked: string[];
  upcoming: Array<{
    type: string;
    requirement: string;
    worldsToGo: number;
    levelsToGo: number;
  }>;
  totalAvailable: number;
} {
  const unlocked: string[] = [];
  const upcoming: Array<{
    type: string;
    requirement: string;
    worldsToGo: number;
    levelsToGo: number;
  }> = [];

  for (const config of AFK_REWARDS_CONFIG) {
    if (isAfkRewardUnlocked(config.type, playerWorld, playerLevel)) {
      unlocked.push(config.type);
    } else {
      const worldsToGo = Math.max(0, config.unlockRequirement.minWorld - playerWorld);
      const levelsToGo = Math.max(0, config.unlockRequirement.minLevel - playerLevel);
      
      upcoming.push({
        type: config.type,
        requirement: config.unlockRequirement.description,
        worldsToGo,
        levelsToGo
      });
    }
  }

  return {
    unlocked,
    upcoming,
    totalAvailable: AFK_REWARDS_CONFIG.length
  };
}

/**
 * Valider la configuration (pour debug/maintenance)
 */
export function validateAfkRewardsConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const config of AFK_REWARDS_CONFIG) {
    // Vérifier les taux de base
    if (config.baseRate.min <= 0) {
      errors.push(`${config.type}: baseRate.min must be > 0`);
    }
    
    if (config.baseRate.max < config.baseRate.min) {
      errors.push(`${config.type}: baseRate.max must be >= baseRate.min`);
    }
    
    if (config.baseRate.scaling <= 1) {
      warnings.push(`${config.type}: baseRate.scaling <= 1 means no progression scaling`);
    }
    
    // Vérifier les multiplicateurs
    if (config.progressionBonus.vipMultiplier < 0) {
      errors.push(`${config.type}: vipMultiplier cannot be negative`);
    }
    
    // Vérifier les exigences de déblocage
    if (config.unlockRequirement.minWorld < 1) {
      errors.push(`${config.type}: minWorld must be >= 1`);
    }
    
    if (config.unlockRequirement.minLevel < 1) {
      errors.push(`${config.type}: minLevel must be >= 1`);
    }
    
    // Vérifier le cap journalier
    if (config.dailyCap && config.dailyCap.enabled) {
      if (config.dailyCap.maxPerDay <= 0) {
        errors.push(`${config.type}: dailyCap.maxPerDay must be > 0 when enabled`);
      }
      
      if (config.dailyCap.resetHour < 0 || config.dailyCap.resetHour > 23) {
        errors.push(`${config.type}: dailyCap.resetHour must be 0-23`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ===== EXPORT DE LA CONFIG POUR FACILITER LES TESTS =====
export default AFK_REWARDS_CONFIG;

// server/src/config/ascensionCosts.ts

/**
 * Configuration des coûts pour le système d'ascension des héros
 * 
 * Système de progression :
 * - Niveaux normaux : Gold + Hero XP
 * - Paliers d'ascension : Gold + Hero XP + Essence d'Ascension
 * 
 * Paliers d'ascension :
 * - Tier 1: Niveau 40→41 (Common max, unlock pour Rare+)
 * - Tier 2: Niveau 80→81 (Rare max, unlock pour Epic+)
 * - Tier 3: Niveau 120→121 (Epic max, unlock pour Legendary+)
 * - Tier 4: Niveau 150→151 (Legendary max, unlock pour Mythic)
 */

// ===============================================
// CAPS DE NIVEAU PAR RARETÉ
// ===============================================

export const LEVEL_CAPS_BY_RARITY = {
  Common: 40,
  Rare: 80,
  Epic: 120,
  Legendary: 150,
  Mythic: 170
} as const;

export const ASCENSION_TIERS = {
  TIER_1: { from: 40, to: 41, name: "First Ascension" },
  TIER_2: { from: 80, to: 81, name: "Second Ascension" },
  TIER_3: { from: 120, to: 121, name: "Third Ascension" },
  TIER_4: { from: 150, to: 151, name: "Fourth Ascension" }
} as const;

// ===============================================
// COÛTS D'ASCENSION PAR PALIER
// ===============================================

export interface AscensionCost {
  gold: number;
  heroXP: number;
  ascensionEssence: number;
}

export const ASCENSION_COSTS: Record<string, AscensionCost> = {
  // Palier 1 : Niveau 40→41 (débloquer pour Rare+)
  tier1: {
    gold: 5000,
    heroXP: 2000,
    ascensionEssence: 5
  },
  
  // Palier 2 : Niveau 80→81 (débloquer pour Epic+)
  tier2: {
    gold: 15000,
    heroXP: 8000,
    ascensionEssence: 15
  },
  
  // Palier 3 : Niveau 120→121 (débloquer pour Legendary+)
  tier3: {
    gold: 40000,
    heroXP: 20000,
    ascensionEssence: 35
  },
  
  // Palier 4 : Niveau 150→151 (débloquer pour Mythic)
  tier4: {
    gold: 80000,
    heroXP: 50000,
    ascensionEssence: 75
  }
};

// ===============================================
// FONCTIONS UTILITAIRES
// ===============================================

/**
 * Obtient le coût d'ascension pour un niveau spécifique
 */
export function getAscensionCostForLevel(level: number): AscensionCost | null {
  switch (level) {
    case 40:
      return ASCENSION_COSTS.tier1;
    case 80:
      return ASCENSION_COSTS.tier2;
    case 120:
      return ASCENSION_COSTS.tier3;
    case 150:
      return ASCENSION_COSTS.tier4;
    default:
      return null;
  }
}

/**
 * Vérifie si un niveau est un palier d'ascension
 */
export function isAscensionLevel(level: number): boolean {
  return [40, 80, 120, 150].includes(level);
}

/**
 * Obtient le palier d'ascension pour un niveau
 */
export function getAscensionTier(level: number): number {
  if (level >= 150) return 4;
  if (level >= 120) return 3;
  if (level >= 80) return 2;
  if (level >= 40) return 1;
  return 0;
}

/**
 * Vérifie si une rareté peut atteindre un niveau donné
 */
export function canRarityReachLevel(rarity: string, level: number): boolean {
  const maxLevel = LEVEL_CAPS_BY_RARITY[rarity as keyof typeof LEVEL_CAPS_BY_RARITY];
  return maxLevel ? level <= maxLevel : false;
}

/**
 * Obtient le niveau maximum pour une rareté
 */
export function getMaxLevelForRarity(rarity: string): number {
  return LEVEL_CAPS_BY_RARITY[rarity as keyof typeof LEVEL_CAPS_BY_RARITY] || 40;
}

// ===============================================
// COÛTS DE LEVEL UP NORMAUX
// ===============================================

export interface LevelUpCost {
  gold: number;
  heroXP: number;
}

/**
 * Calcule le coût pour monter du niveau actuel au niveau cible (hors paliers)
 */
export function getLevelUpCost(currentLevel: number, targetLevel: number, rarity: string): LevelUpCost {
  // Multiplicateurs par rareté
  const rarityMultipliers: Record<string, number> = {
    Common: 1.0,
    Rare: 1.2,
    Epic: 1.5,
    Legendary: 2.0,
    Mythic: 2.5
  };
  
  const rarityMult = rarityMultipliers[rarity] || 1.0;
  let totalGold = 0;
  let totalHeroXP = 0;
  
  for (let level = currentLevel; level < targetLevel; level++) {
    // Ne pas inclure les paliers d'ascension dans le calcul normal
    if (isAscensionLevel(level + 1)) {
      continue;
    }
    
    // Coût de base qui augmente avec le niveau
    const baseGoldCost = 100 + (level * 25);
    const baseXPCost = 50 + (level * 15);
    
    totalGold += Math.floor(baseGoldCost * rarityMult);
    totalHeroXP += Math.floor(baseXPCost * rarityMult);
  }
  
  return {
    gold: totalGold,
    heroXP: totalHeroXP
  };
}

/**
 * Calcule le coût pour monter d'un seul niveau
 */
export function getSingleLevelCost(currentLevel: number, rarity: string): LevelUpCost {
  return getLevelUpCost(currentLevel, currentLevel + 1, rarity);
}

// ===============================================
// FONCTIONS DE VALIDATION
// ===============================================

/**
 * Valide si un héros peut être ascensionné à un niveau donné
 */
export function canHeroAscendToLevel(heroRarity: string, currentLevel: number, targetLevel: number): {
  canAscend: boolean;
  reason?: string;
  requiredAscensions: Array<{ level: number; cost: AscensionCost }>;
} {
  const maxLevel = getMaxLevelForRarity(heroRarity);
  const requiredAscensions: Array<{ level: number; cost: AscensionCost }> = [];
  
  // Vérifier si le niveau cible est atteignable par cette rareté
  if (targetLevel > maxLevel) {
    return {
      canAscend: false,
      reason: `${heroRarity} heroes cannot reach level ${targetLevel}. Maximum is ${maxLevel}.`,
      requiredAscensions: []
    };
  }
  
  // Vérifier si le héros a déjà le niveau requis
  if (currentLevel >= targetLevel) {
    return {
      canAscend: false,
      reason: `Hero is already at level ${currentLevel}, which is >= target level ${targetLevel}.`,
      requiredAscensions: []
    };
  }
  
  // Identifier les paliers d'ascension nécessaires
  for (let level = currentLevel + 1; level <= targetLevel; level++) {
    if (isAscensionLevel(level)) {
      const cost = getAscensionCostForLevel(level - 1);
      if (cost) {
        requiredAscensions.push({ level, cost });
      }
    }
  }
  
  return {
    canAscend: true,
    requiredAscensions
  };
}

/**
 * Calcule le coût total pour atteindre un niveau cible (level up + ascensions)
 */
export function getTotalCostToLevel(currentLevel: number, targetLevel: number, rarity: string): {
  levelUpCost: LevelUpCost;
  ascensionCosts: Array<{ level: number; cost: AscensionCost }>;
  totalCost: {
    gold: number;
    heroXP: number;
    ascensionEssence: number;
  };
} {
  const validation = canHeroAscendToLevel(rarity, currentLevel, targetLevel);
  
  if (!validation.canAscend) {
    throw new Error(validation.reason || "Cannot ascend to target level");
  }
  
  // Coût des level ups normaux
  const levelUpCost = getLevelUpCost(currentLevel, targetLevel, rarity);
  
  // Coûts des ascensions
  const ascensionCosts = validation.requiredAscensions;
  
  // Coût total
  let totalGold = levelUpCost.gold;
  let totalHeroXP = levelUpCost.heroXP;
  let totalAscensionEssence = 0;
  
  ascensionCosts.forEach(ascension => {
    totalGold += ascension.cost.gold;
    totalHeroXP += ascension.cost.heroXP;
    totalAscensionEssence += ascension.cost.ascensionEssence;
  });
  
  return {
    levelUpCost,
    ascensionCosts,
    totalCost: {
      gold: totalGold,
      heroXP: totalHeroXP,
      ascensionEssence: totalAscensionEssence
    }
  };
}

// ===============================================
// MULTIPLICATEURS ET BONUS
// ===============================================

/**
 * Multiplicateurs de stats par palier d'ascension
 */
export const ASCENSION_STAT_MULTIPLIERS = {
  tier0: 1.0,    // Base (niveaux 1-40)
  tier1: 1.15,   // Après ascension 40→41
  tier2: 1.35,   // Après ascension 80→81
  tier3: 1.60,   // Après ascension 120→121
  tier4: 1.90    // Après ascension 150→151
};

/**
 * Obtient le multiplicateur de stats selon le palier d'ascension
 */
export function getStatMultiplierForTier(ascensionTier: number): number {
  switch (ascensionTier) {
    case 0: return ASCENSION_STAT_MULTIPLIERS.tier0;
    case 1: return ASCENSION_STAT_MULTIPLIERS.tier1;
    case 2: return ASCENSION_STAT_MULTIPLIERS.tier2;
    case 3: return ASCENSION_STAT_MULTIPLIERS.tier3;
    case 4: return ASCENSION_STAT_MULTIPLIERS.tier4;
    default: return ASCENSION_STAT_MULTIPLIERS.tier0;
  }
}

// ===============================================
// REWARDS D'ASCENSION
// ===============================================

/**
 * Récompenses obtenues lors d'une ascension
 */
export interface AscensionReward {
  unlockedSpells: number[];  // Niveaux de sorts débloqués
  statBonus: {
    hpBonus: number;
    atkBonus: number;
    defBonus: number;
  };
  other?: {
    gold?: number;
    gems?: number;
  };
}

export const ASCENSION_REWARDS: Record<string, AscensionReward> = {
  tier1: {
    unlockedSpells: [41],  // Débloquer sorts niveau 41
    statBonus: {
      hpBonus: 0.15,  // +15% HP de base
      atkBonus: 0.15, // +15% ATK de base
      defBonus: 0.15  // +15% DEF de base
    },
    other: {
      gold: 1000,
      gems: 50
    }
  },
  tier2: {
    unlockedSpells: [81],  // Débloquer sorts niveau 81
    statBonus: {
      hpBonus: 0.20,  // +20% HP supplémentaire
      atkBonus: 0.20, // +20% ATK supplémentaire
      defBonus: 0.20  // +20% DEF supplémentaire
    },
    other: {
      gold: 5000,
      gems: 100
    }
  },
  tier3: {
    unlockedSpells: [121], // Débloquer sorts niveau 121 (futur)
    statBonus: {
      hpBonus: 0.25,  // +25% HP supplémentaire
      atkBonus: 0.25, // +25% ATK supplémentaire
      defBonus: 0.25  // +25% DEF supplémentaire
    },
    other: {
      gold: 10000,
      gems: 200
    }
  },
  tier4: {
    unlockedSpells: [151], // Débloquer sorts niveau 151 (futur)
    statBonus: {
      hpBonus: 0.30,  // +30% HP supplémentaire
      atkBonus: 0.30, // +30% ATK supplémentaire
      defBonus: 0.30  // +30% DEF supplémentaire
    },
    other: {
      gold: 20000,
      gems: 500
    }
  }
};

/**
 * Obtient les récompenses pour un palier d'ascension
 */
export function getAscensionReward(ascensionTier: number): AscensionReward | null {
  const tierKey = `tier${ascensionTier}` as keyof typeof ASCENSION_REWARDS;
  return ASCENSION_REWARDS[tierKey] || null;
}

// ===============================================
// FONCTIONS POUR L'UI
// ===============================================

/**
 * Obtient des informations formatées pour l'UI
 */
export function getAscensionUIInfo(heroRarity: string, currentLevel: number): {
  currentTier: number;
  nextAscensionLevel: number | null;
  nextAscensionCost: AscensionCost | null;
  maxLevelForRarity: number;
  canAscendFurther: boolean;
  progressToNextAscension: {
    levelsNeeded: number;
    percentage: number;
  } | null;
} {
  const currentTier = getAscensionTier(currentLevel);
  const maxLevel = getMaxLevelForRarity(heroRarity);
  
  // Trouver la prochaine ascension possible
  let nextAscensionLevel: number | null = null;
  let nextAscensionCost: AscensionCost | null = null;
  
  const ascensionLevels = [41, 81, 121, 151];
  for (const level of ascensionLevels) {
    if (level > currentLevel && level <= maxLevel) {
      nextAscensionLevel = level;
      nextAscensionCost = getAscensionCostForLevel(level - 1);
      break;
    }
  }
  
  // Calculer la progression
  let progressToNextAscension: { levelsNeeded: number; percentage: number } | null = null;
  if (nextAscensionLevel) {
    const levelsNeeded = nextAscensionLevel - currentLevel;
    const totalLevelsInTier = nextAscensionLevel - (currentTier === 0 ? 1 : ascensionLevels[currentTier - 1] || 1);
    const percentage = Math.max(0, Math.min(100, ((totalLevelsInTier - levelsNeeded) / totalLevelsInTier) * 100));
    
    progressToNextAscension = {
      levelsNeeded,
      percentage: Math.round(percentage)
    };
  }
  
  return {
    currentTier,
    nextAscensionLevel,
    nextAscensionCost,
    maxLevelForRarity: maxLevel,
    canAscendFurther: nextAscensionLevel !== null,
    progressToNextAscension
  };
}

// ===============================================
// CONSTANTES POUR L'ÉCONOMIE
// ===============================================

/**
 * Valeurs d'échange approximatives (pour l'UI et les calculs)
 */
export const ECONOMY_VALUES = {
  // Coût en gems pour acheter directement
  ascensionEssenceGemCost: 20,  // 1 essence = 20 gems
  heroXPGemCost: 0.1,           // 1 heroXP = 0.1 gem
  
  // Valeur de revente
  ascensionEssenceSellValue: 100, // Prix de vente en gold
  
  // Ratios de conversion (si implémentés)
  goldToGemRatio: 1000,         // 1000 gold = 1 gem
  heroXPToGoldRatio: 2          // 1 heroXP = 2 gold
};

// ===============================================
// EXPORT PAR DÉFAUT
// ===============================================

export default {
  LEVEL_CAPS_BY_RARITY,
  ASCENSION_TIERS,
  ASCENSION_COSTS,
  ASCENSION_STAT_MULTIPLIERS,
  ASCENSION_REWARDS,
  ECONOMY_VALUES,
  
  // Fonctions utilitaires
  getAscensionCostForLevel,
  isAscensionLevel,
  getAscensionTier,
  canRarityReachLevel,
  getMaxLevelForRarity,
  getLevelUpCost,
  getSingleLevelCost,
  canHeroAscendToLevel,
  getTotalCostToLevel,
  getStatMultiplierForTier,
  getAscensionReward,
  getAscensionUIInfo
};

// server/src/config/gameBalance.ts

/**
 * 🎮 CONFIGURATION CENTRALE DU GAME BALANCE
 * 
 * Toutes les constantes et formules du jeu sont centralisées ici.
 * Facilite l'équilibrage et les ajustements sans toucher au code métier.
 */

export const GAME_BALANCE = {
  
  // ═══════════════════════════════════════════════════════════════════
  // 🌍 CAMPAGNE - Scaling et progression
  // ═══════════════════════════════════════════════════════════════════
  campaign: {
    // Nombre d'ennemis par niveau
    enemyCountBase: 3,
    enemyCountPerWorld: 0.2,  // +1 ennemi tous les 5 mondes (3 + worldId / 5)
    
    // Scaling de puissance des ennemis
    levelMultiplierBase: 1.0,
    levelMultiplierPerWorld: 0.15,  // +15% par monde
    levelMultiplierPerLevel: 0.05,  // +5% par niveau dans le monde
    
    // Multiplicateurs par difficulté
    difficultyMultipliers: {
      Normal: 1.0,
      Hard: 2.0,
      Nightmare: 4.0
    },
    
    // Multiplicateurs par type d'ennemi
    enemyTypeMultipliers: {
      normal: 1.0,
      elite: 1.2,
      boss: 1.5
    },
    
    // Bonus de stats pour les boss
    bossStatBonus: {
      hpMultiplier: 2.5,
      atkMultiplier: 1.8,
      defMultiplier: 1.5,
      startingEnergy: 50,  // Les boss commencent avec de l'énergie
      initialBuffs: ["boss_aura"]
    },
    
    // Bonus de stats pour les elite
    eliteStatBonus: {
      hpMultiplier: 1.5,
      atkMultiplier: 1.3,
      defMultiplier: 1.2,
      startingEnergy: 0
    },
    
    // Progression des niveaux de joueur
    playerLevelProgression: {
      baseLevel: 1,
      levelPerWorld: 10,   // Niveau = (worldId - 1) * 10 + levelIndex + 5
      levelPerStage: 1,
      minimumBonus: 5
    },
    
    // Conditions de déverrouillage des difficultés
    difficultyUnlock: {
      Hard: {
        requiresCompletion: "Normal",
        minPlayerLevel: 50
      },
      Nightmare: {
        requiresCompletion: "Hard",
        minPlayerLevel: 100
      }
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // 📊 STATS - Scaling des héros et monstres
  // ═══════════════════════════════════════════════════════════════════
  stats: {
    // Scaling par niveau (appliqué à HP, ATK, DEF)
    levelScaling: 0.08,  // +8% par niveau
    
    // Scaling par étoiles (appliqué à toutes les stats)
    starScaling: 0.15,   // +15% par étoile
    
    // Multiplicateurs de rareté
    rarityMultipliers: {
      Common: 1.0,
      Rare: 1.25,
      Epic: 1.5,
      Legendary: 2.0,
      Mythic: 2.5
    },
    
    // Scaling des stats secondaires (plus lent que les stats principales)
    secondaryStatScaling: {
      speed: 0.5,      // Vitesse scale à 50% du taux normal
      mental: 0.3,     // Moral scale à 30% du taux normal
      cooldown: 0.01   // Réduction de CD scale très lentement
    },
    
    // Caps de stats
    statCaps: {
      crit: 100,            // % de critique max
      critResist: 100,      // % de résistance critique max
      dodge: 100,           // % d'esquive max
      accuracy: 100,        // % de précision max
      healthleech: 100,     // % de vol de vie max
      reductionCooldown: 50 // % de réduction de CD max
    },
    
    // Stats de base par rôle (multiplicateurs appliqués aux bases)
    roleStatModifiers: {
      Tank: {
        hp: 1.5,
        def: 1.4,
        atk: 0.7
      },
      "DPS Melee": {
        hp: 1.0,
        def: 0.9,
        atk: 1.4
      },
      "DPS Ranged": {
        hp: 0.8,
        def: 0.8,
        atk: 1.3
      },
      Support: {
        hp: 1.0,
        def: 1.0,
        atk: 0.8
      }
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // ⚔️ COMBAT - Formules de dégâts et combat
  // ═══════════════════════════════════════════════════════════════════
  combat: {
    // Formules de dégâts de base
    damageFormulas: {
      attack: {
        baseMultiplier: 1.0,
        defenseReduction: 0.5  // damage = atk - (def * 0.5)
      },
      skill: {
        baseMultiplier: 1.6,
        intelligenceBonus: 0.4,
        defenseReduction: 0.5
      },
      ultimate: {
        baseMultiplier: 2.5,
        intelligenceBonus: 0.6,
        defenseReduction: 0.5
      }
    },
    
    // Critique
    critical: {
      baseChance: 0.08,        // 8% de base
      damageMultiplier: 1.75,  // x1.75 dégâts en critique
      speedBonus: 0.001,       // +0.1% par point de vitesse
      rarityBonus: 0.02        // Bonus par niveau de rareté
    },
    
    // Énergie
    energy: {
      baseGeneration: 10,
      moralBonus: 0.125,       // +1 énergie par 8 points de moral
      randomVariance: 5,       // ±5 énergie aléatoire
      maxEnergy: 100,
      ultimateCost: 100,
      onHitGain: 12,           // Énergie gagnée en attaquant
      onHitVariance: 8         // ±8 variance
    },
    
    // Durée de combat
    maxTurns: 200,             // Combat s'arrête après 200 tours
    
    // Vitesse de combat (VIP)
    speedMultipliers: {
      vipRequirements: {
        speed1: 0,   // Tout le monde
        speed2: 2,   // VIP 2+
        speed3: 5    // VIP 5+
      }
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // 🔥 ÉLÉMENTS - Triangle élémentaire et avantages
  // ═══════════════════════════════════════════════════════════════════
  elements: {
    // Triangle élémentaire
    advantages: {
      Fire: ["Wind"],
      Water: ["Fire"],
      Wind: ["Electric"],
      Electric: ["Water"],
      Light: ["Dark"],
      Dark: ["Light"]
    },
    
    // Multiplicateurs d'avantage/désavantage
    advantageMultiplier: 1.5,
    disadvantageMultiplier: 0.75,
    neutralMultiplier: 1.0,
    
    // Distribution élémentaire dans les mondes
    worldElementBias: {
      1: ["Fire", "Wind"],      // Monde 1: Forêt en feu
      2: ["Water", "Wind"],     // Monde 2: Côtes venteuses
      3: ["Electric", "Fire"],  // Monde 3: Montagnes orageuses
      4: ["Dark", "Electric"],  // Monde 4: Cavernes sombres
      5: ["Light", "Water"],    // Monde 5: Temple lumineux
      // ... etc pour les 20 mondes
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // 👹 MONSTRES - Configuration des ennemis
  // ═══════════════════════════════════════════════════════════════════
  monsters: {
    // Stats de base par type de monstre (appliqués au baseStats)
    baseStatsByType: {
      normal: {
        hpMultiplier: 1.0,
        atkMultiplier: 1.0,
        defMultiplier: 1.0,
        speedMultiplier: 1.0
      },
      elite: {
        hpMultiplier: 1.5,
        atkMultiplier: 1.3,
        defMultiplier: 1.2,
        speedMultiplier: 1.1
      },
      boss: {
        hpMultiplier: 2.5,
        atkMultiplier: 1.8,
        defMultiplier: 1.5,
        speedMultiplier: 1.2
      }
    },
    
    // Règles d'apparition
    spawnRules: {
      maxNormalPerLevel: 5,
      eliteEveryNLevels: 5,   // Elite au niveau 5, 15, 25, etc.
      bossEveryNLevels: 10,   // Boss au niveau 10, 20, 30, etc.
      
      // Niveau et étoiles par type
      levelByType: {
        normal: {
          base: 20,
          perWorld: 2
        },
        elite: {
          base: 25,
          perWorld: 3
        },
        boss: {
          base: 30,
          perWorld: 5
        }
      },
      
      starsByType: {
        normal: 3,
        elite: 4,
        boss: 5
      }
    },
    
    // Distribution par rôle (pour génération aléatoire)
    roleDistribution: {
      Tank: 0.25,      // 25% de chance
      "DPS Melee": 0.30,
      "DPS Ranged": 0.25,
      Support: 0.20
    },
    
    // Loot tables par type
    lootMultipliers: {
      normal: 1.0,
      elite: 1.5,
      boss: 3.0
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // 💰 RÉCOMPENSES - Gold, XP, items
  // ═══════════════════════════════════════════════════════════════════
  rewards: {
    // Récompenses de base
    baseExperience: 80,
    baseGold: 40,
    
    // Scaling par monde/niveau
    experiencePerWorld: 10,
    experiencePerLevel: 2,
    goldPerWorld: 5,
    goldPerLevel: 1,
    
    // Bonus de difficulté
    difficultyBonuses: {
      Normal: 1.0,
      Hard: 1.5,
      Nightmare: 2.0
    },
    
    // Bonus de performance (temps de combat)
    performanceBonuses: {
      fast: {         // < 10 tours
        threshold: 10,
        multiplier: 1.5
      },
      medium: {       // 10-20 tours
        threshold: 20,
        multiplier: 1.2
      },
      slow: {         // > 20 tours
        threshold: 999,
        multiplier: 1.0
      }
    },
    
    // Skip rewards (récompenses en mode skip)
    skipRewards: {
      bonusMultiplier: 1.1,  // +10% pour récompenser le skip
      requiresVictories: 3,  // Nécessite 3 victoires pour débloquer
      timeBonus: {
        fast: 1.2,           // Bonus si bestTime < 10s
        medium: 1.1          // Bonus si bestTime < 20s
      }
    },
    
    // Drops d'items (probabilités)
    itemDropRates: {
      normal: {
        common: 0.50,      // 50% chance item commun
        rare: 0.15,        // 15% chance item rare
        epic: 0.03,        // 3% chance item épique
        legendary: 0.005   // 0.5% chance item légendaire
      },
      elite: {
        common: 0.30,
        rare: 0.40,
        epic: 0.15,
        legendary: 0.02
      },
      boss: {
        common: 0.10,
        rare: 0.30,
        epic: 0.40,
        legendary: 0.10,
        guaranteed: true   // Boss drop toujours quelque chose
      }
    },
    
    // Fragments de héros
    fragmentDropRates: {
      common: 0.20,
      rare: 0.10,
      epic: 0.05,
      legendary: 0.01
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // ⭐ POWER SCORE - Calcul de puissance
  // ═══════════════════════════════════════════════════════════════════
  powerScore: {
    // Formule: ATK × 1.0 + DEF × 2.0 + HP ÷ 10 + autres stats
    weights: {
      atk: 1.0,
      def: 2.0,
      hp: 0.1,
      speed: 0.5,
      crit: 2.0,
      critDamage: 0.1
    },
    
    // Bonus de power score
    levelBonus: 100,       // +100 power par niveau
    starBonus: 500,        // +500 power par étoile
    ascensionBonus: 1000,  // +1000 power par ascension
    awakenBonus: 2000      // +2000 power par awakening
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // 🎯 FORMATION - Synergies et bonus
  // ═══════════════════════════════════════════════════════════════════
  formation: {
    // Bonus élémentaires (voir FormationBonusConfig.ts)
    elementalSynergies: {
      2: { hp: 5, atk: 5, def: 0 },      // 2 héros même élément
      3: { hp: 10, atk: 10, def: 5 },    // 3 héros
      4: { hp: 15, atk: 15, def: 10 },   // 4 héros
      5: { hp: 25, atk: 25, def: 15 }    // 5 héros (mono-élément)
    },
    
    // Positions sur le terrain
    positions: {
      frontLine: [1, 2],     // Positions front (tanks)
      backLine: [3, 4, 5],   // Positions back (DPS/Support)
      
      // Protection du back-line
      backLineProtection: true,  // Back protégé tant que front vivant
    },
    
    // Composition recommandée
    recommendedComposition: {
      minHeroes: 3,
      maxHeroes: 5,
      recommendedTanks: 1,
      recommendedDPS: 2,
      recommendedSupports: 1
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // 🎲 VIP & PROGRESSION
  // ═══════════════════════════════════════════════════════════════════
  vip: {
    // Experience VIP
    expPerLevel: 1000,
    maxLevel: 15,
    
    // Avantages par niveau VIP
    benefits: {
      speed2: 2,   // Débloquer vitesse x2
      speed3: 5,   // Débloquer vitesse x3
      skipCost: 3, // Réduction coût skip
      extraRewards: 7  // +10% récompenses
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // 🏆 TOWER - Tour infinie
  // ═══════════════════════════════════════════════════════════════════
  tower: {
    // Scaling par étage
    baseMultiplier: 1.0,
    multiplierPerFloor: 0.10,  // +10% par étage
    
    // Boss tous les X étages
    bossEveryNFloors: 10,
    
    // Récompenses
    rewardScaling: 1.15  // +15% par étage
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // ⚔️ ARENA - PvP
  // ═══════════════════════════════════════════════════════════════════
  arena: {
    // Récompenses PvP
    baseGoldReward: 100,
    baseExpReward: 50,
    
    // Classement
    rankRewards: {
      top10: { gold: 1000, gems: 100 },
      top100: { gold: 500, gems: 50 },
      top1000: { gold: 200, gems: 20 }
    }
  }
  
} as const;

// ═══════════════════════════════════════════════════════════════════
// 🛠️ FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculer le multiplicateur de niveau pour un monde/niveau donné
 */
export function calculateLevelMultiplier(worldId: number, levelId: number): number {
  const { levelMultiplierBase, levelMultiplierPerWorld, levelMultiplierPerLevel } = GAME_BALANCE.campaign;
  return levelMultiplierBase + (worldId * levelMultiplierPerWorld) + (levelId * levelMultiplierPerLevel);
}

/**
 * Calculer le nombre d'ennemis pour un monde
 */
export function calculateEnemyCount(worldId: number): number {
  const { enemyCountBase, enemyCountPerWorld } = GAME_BALANCE.campaign;
  return Math.floor(enemyCountBase + (worldId * enemyCountPerWorld));
}

/**
 * Obtenir le multiplicateur total pour un ennemi
 */
export function getEnemyTotalMultiplier(
  worldId: number,
  levelId: number,
  difficulty: "Normal" | "Hard" | "Nightmare",
  enemyType: "normal" | "elite" | "boss"
): number {
  const levelMult = calculateLevelMultiplier(worldId, levelId);
  const diffMult = GAME_BALANCE.campaign.difficultyMultipliers[difficulty];
  const typeMult = GAME_BALANCE.campaign.enemyTypeMultipliers[enemyType];
  
  return levelMult * diffMult * typeMult;
}

/**
 * Calculer les stats finales d'un héros/monstre avec level et stars
 */
export function calculateFinalStats(baseStats: any, level: number, stars: number) {
  const { levelScaling, starScaling } = GAME_BALANCE.stats;
  
  const levelMultiplier = 1 + (level - 1) * levelScaling;
  const starMultiplier = 1 + (stars - 1) * starScaling;
  const totalMultiplier = levelMultiplier * starMultiplier;
  
  return {
    hp: Math.floor(baseStats.hp * totalMultiplier),
    atk: Math.floor(baseStats.atk * totalMultiplier),
    def: Math.floor(baseStats.def * totalMultiplier),
    // ... autres stats
  };
}

/**
 * Obtenir l'avantage élémentaire
 */
export function getElementalAdvantage(attackerElement: string, defenderElement: string): number {
  const { advantages, advantageMultiplier, disadvantageMultiplier, neutralMultiplier } = GAME_BALANCE.elements;
  
  if (advantages[attackerElement]?.includes(defenderElement)) {
    return advantageMultiplier;
  }
  
  if (advantages[defenderElement]?.includes(attackerElement)) {
    return disadvantageMultiplier;
  }
  
  return neutralMultiplier;
}

/**
 * Calculer le power score d'un participant
 */
export function calculatePowerScore(stats: any): number {
  const { weights } = GAME_BALANCE.powerScore;
  
  return Math.floor(
    (stats.atk || 0) * weights.atk +
    (stats.def || 0) * weights.def +
    (stats.hp || 0) * weights.hp +
    (stats.speed || stats.vitesse || 0) * weights.speed +
    (stats.crit || 0) * weights.crit +
    (stats.critDamage || 0) * weights.critDamage
  );
}

/**
 * Calculer les récompenses d'un niveau
 */
export function calculateLevelRewards(
  worldId: number,
  levelId: number,
  difficulty: "Normal" | "Hard" | "Nightmare",
  turns: number
): { experience: number; gold: number } {
  const { 
    baseExperience, 
    baseGold, 
    experiencePerWorld, 
    experiencePerLevel,
    goldPerWorld,
    goldPerLevel,
    difficultyBonuses,
    performanceBonuses
  } = GAME_BALANCE.rewards;
  
  // Base
  let exp = baseExperience + (worldId * experiencePerWorld) + (levelId * experiencePerLevel);
  let gold = baseGold + (worldId * goldPerWorld) + (levelId * goldPerLevel);
  
  // Difficulté
  const diffMult = difficultyBonuses[difficulty];
  exp *= diffMult;
  gold *= diffMult;
  
  // Performance (nombre de tours)
  let perfMult = 1.0;
  if (turns <= performanceBonuses.fast.threshold) {
    perfMult = performanceBonuses.fast.multiplier;
  } else if (turns <= performanceBonuses.medium.threshold) {
    perfMult = performanceBonuses.medium.multiplier;
  }
  
  exp *= perfMult;
  gold *= perfMult;
  
  return {
    experience: Math.floor(exp),
    gold: Math.floor(gold)
  };
}

// Export du type pour autocomplétion
export type GameBalance = typeof GAME_BALANCE;

// ultimateAnalyzer.ts - Module spécialisé pour l'analyse des ultimates
import mongoose from "mongoose";
import * as fs from "fs";
import * as path from "path";

// ===== IMPORTS CORRECTS BASÉS SUR LES VRAIS FICHIERS =====

import { BattleEngine, IBattleOptions } from "../../services/BattleEngine";
import { SpellManager, HeroSpells } from "../../gameplay/SpellManager";
import { EffectManager } from "../../gameplay/EffectManager";
import { PassiveManager } from "../../gameplay/PassiveManager";
import { IBattleParticipant, IBattleAction, IBattleResult } from "../../models/Battle";

// ===== INTERFACES SPÉCIALISÉES ULTIMATES =====

interface UltimateSpell {
  config: {
    id: string;
    name: string;
    type: "ultimate";
    category: string;
    element?: string;
  };
  getEnergyCost?(level: number): number;
  getEffectiveCooldown?(caster: any, level: number): number;
}

// ✨ NOUVEAU : Système d'alertes automatiques
interface UltimateAlert {
  level: "CRITICAL" | "BALANCE" | "DESIGN";
  type: string;
  message: string;
  value: number;
  threshold: number;
  autoFix?: string;
  suggestion?: string;
  priority: number; // 1 = urgent, 5 = low
}

interface AlertThresholds {
  critical: {
    maxUsagePerMinute: number;
    maxDpsPerMinute: number;
    minEnergyCost: number;
    maxUsagesPer60s: number;
    impossibleHealDamage: boolean;
  };
  balance: {
    minDamagePerUse: number;
    minUtilityScore: number;
    maxRating: number;
    minUsageRate: number;
    minGameChanging: number;
  };
  design: {
    minAccessibility: number;
    minVersatility: number;
    minUniqueIndex: number;
    targetBalanceRange: [number, number];
  };
}

interface UltimateMetrics {
  // Métriques core ultimates
  rawImpact: number;                    // Dégâts/heal bruts de l'ultimate
  gameChangingScore: number;            // Capacité à retourner un combat
  clutchFactor: number;                 // Performance dans situations critiques
  
  // Timing et disponibilité
  energyEfficiency: number;             // Ratio impact/coût énergétique
  timingOptimization: number;           // Utilisé au bon moment
  accessibilityScore: number;           // Facilité d'accès en combat
  
  // Impact situationnel
  soloCarryPotential: number;           // Capacité à porter seul
  teamSynergyAmplification: number;     // Boost donné à l'équipe
  counterPlayResistance: number;        // Résistance aux contres
  
  // Métriques avancées
  scalingPotential: number;             // Performance late game
  versatilityScore: number;             // Efficacité multi-situations
  uniquenessIndex: number;              // Effet unique vs autres ultimates
}

interface UltimateTestScenario {
  name: string;
  description: string;
  setupTeam: (ultimateSpell: UltimateSpell) => IBattleParticipant[];
  setupEnemies: () => IBattleParticipant[];
  specialConditions: {
    startingEnergy?: number;
    turnLimit?: number;
    forcedTiming?: number;  // Tour où forcer l'ultimate
    difficultyModifier?: number;
  };
  expectedOutcome: "ultimate_wins" | "close_fight" | "ultimate_insufficient";
  weight: number;
  focusMetric: keyof UltimateMetrics;
}

// ✨ INTERFACE COMPLÈTE AVEC TOUTES LES MÉTRIQUES TEMPS RÉEL
interface UltimateDpsMetrics {
  totalDamage: number;              // Dégâts totaux infligés
  averageDamagePerUse: number;      // Dégâts moyens par utilisation
  dpsRating: number;                // Note DPS (0-100)
  dpsRank: number;                  // Rang DPS parmi tous ultimates
  healingPerSecond: number;         // HPS pour ultimates de heal
  utilityScore: number;             // Score pour buffs/debuffs/control
  // ✨ NOUVEAU : Métriques temps réel 60s
  realTimeUsage: number;            // Nombre d'utilisations en 60s
  usageFrequency: number;           // Utilisations par minute
  realTimeDPS: number;              // DPS réel par minute
  realTimeHPS: number;              // HPS réel par minute
}

interface UltimateAnalysisResult {
  spellId: string;
  spellName: string;
  element: string;
  category: string;
  metrics: UltimateMetrics;
  
  // ✨ MÉTRIQUES DPS AVEC TOUTES LES PROPRIÉTÉS
  dpsMetrics: UltimateDpsMetrics;
  
  // ✨ NOUVEAU : Résumé technique
  technicalSummary: {
    category: string;
    element: string;
    energyCost: number;
    usageRate: number;                // % d'utilisation dans les combats
    averageTiming: number;            // Tour moyen d'utilisation
    effectDescription: string;        // Description des effets
  };
  
  // ✨ NOUVEAU : Système d'alertes
  alerts: UltimateAlert[];
  
  // Scores globaux
  overallPower: number;                 // Puissance globale (0-100)
  designQuality: number;                // Qualité du design (0-100)
  balanceRating: number;                // Note d'équilibrage (0-100)
  
  // Classification
  ultimateClass: "game_changer" | "finisher" | "support" | "situational" | "underwhelming";
  optimalTiming: "early" | "mid" | "late" | "clutch" | "anytime";
  bestUseCase: string;
  
  // Statut et recommandations
  balanceStatus: "underpowered" | "weak" | "balanced" | "strong" | "overpowered" | "broken";
  urgentFixes: string[];
  designSuggestions: string[];
  
  // Données détaillées
  scenarioResults: Record<string, any>;
  comparisonRank: number;               // Rang parmi tous les ultimates
}

// ===== GÉNÉRATEUR DE HÉROS POUR TESTS ULTIMATES =====

class UltimateHeroFactory {
  
  static createUltimateCarrier(config: {
    ultimateSpell: UltimateSpell;
    level: number;
    element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
    startingEnergy?: number;
  }): IBattleParticipant {
    
    const stats = this.getOptimizedStatsForUltimate(config.ultimateSpell, config.level);
    
    return {
      heroId: `ultimate_carrier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${config.ultimateSpell.config.name} Carrier`,
      position: 2, // Position centrale
      role: this.determineOptimalRole(config.ultimateSpell),
      element: config.element,
      rarity: "Legendary", // Toujours légendaire pour tests ultimates
      level: config.level,
      stars: 5,
      stats,
      currentHp: stats.hp,
      energy: config.startingEnergy || 0,
      status: {
        alive: true,
        buffs: [],
        debuffs: []
      }
    };
  }
  
  private static getOptimizedStatsForUltimate(ultimateSpell: UltimateSpell, level: number): any {
    const baseMultiplier = 1 + (level - 1) * 0.1;
    const categoryBonus = this.getCategoryMultiplier(ultimateSpell.config.category);
    
    return {
      hp: Math.floor(6000 * baseMultiplier * categoryBonus.hp),
      maxHp: Math.floor(6000 * baseMultiplier * categoryBonus.hp),
      atk: Math.floor(400 * baseMultiplier * categoryBonus.atk),
      def: Math.floor(250 * baseMultiplier * categoryBonus.def),
      speed: Math.floor(90 * baseMultiplier * categoryBonus.speed)
    };
  }
  
  private static getCategoryMultiplier(category: string): any {
    const multipliers: Record<string, any> = {
      "damage": { hp: 0.9, atk: 1.4, def: 0.8, speed: 1.1 },
      "heal": { hp: 1.2, atk: 0.7, def: 1.1, speed: 1.0 },
      "buff": { hp: 1.0, atk: 0.9, def: 1.0, speed: 1.2 },
      "debuff": { hp: 0.8, atk: 1.1, def: 0.9, speed: 1.3 },
      "control": { hp: 0.9, atk: 0.8, def: 1.0, speed: 1.4 },
      "utility": { hp: 0.9, atk: 0.8, def: 1.0, speed: 1.4 }
    };
    
    return multipliers[category] || { hp: 1.0, atk: 1.0, def: 1.0, speed: 1.0 };
  }
  
  private static determineOptimalRole(ultimateSpell: UltimateSpell): "Tank" | "DPS Melee" | "DPS Ranged" | "Support" {
    switch (ultimateSpell.config.category) {
      case "damage": return "DPS Ranged";
      case "heal": return "Support";
      case "buff": return "Support";
      case "debuff": return "DPS Ranged";
      case "control": return "Support";
      case "utility": return "Support";
      default: return "DPS Ranged";
    }
  }
  
  static createSupportTeam(carrierLevel: number): IBattleParticipant[] {
    return [
      {
        heroId: `support_tank_${Date.now()}`,
        name: "Support Tank",
        position: 1,
        role: "Tank",
        element: "Light",
        rarity: "Epic",
        level: carrierLevel - 2,
        stars: 4,
        stats: { hp: 8000, maxHp: 8000, atk: 180, def: 420, speed: 75 },
        currentHp: 8000,
        energy: 0,
        status: { alive: true, buffs: [], debuffs: [] }
      },
      {
        heroId: `support_healer_${Date.now()}`,
        name: "Support Healer",
        position: 5,
        role: "Support",
        element: "Water",
        rarity: "Epic",
        level: carrierLevel - 1,
        stars: 4,
        stats: { hp: 4200, maxHp: 4200, atk: 220, def: 180, speed: 95 },
        currentHp: 4200,
        energy: 0,
        status: { alive: true, buffs: [], debuffs: [] }
      }
    ];
  }
  
  static createChallengingEnemies(level: number, difficulty: "easy" | "medium" | "hard" | "extreme"): IBattleParticipant[] {
    const difficultyMultipliers = {
      "easy": 0.8,
      "medium": 1.0,
      "hard": 1.3,
      "extreme": 1.7
    };
    
    const mult = difficultyMultipliers[difficulty];
    const enemyLevel = Math.floor(level * mult);
    
    return [
      {
        heroId: `enemy_boss_${Date.now()}`,
        name: `${difficulty.toUpperCase()} Boss`,
        position: 1,
        role: "Tank",
        element: "Dark",
        rarity: "Legendary",
        level: enemyLevel,
        stars: 5,
        stats: { 
          hp: Math.floor(12000 * mult), 
          maxHp: Math.floor(12000 * mult), 
          atk: Math.floor(320 * mult), 
          def: Math.floor(450 * mult), 
          speed: 70 
        },
        currentHp: Math.floor(12000 * mult),
        energy: 0,
        status: { alive: true, buffs: [], debuffs: [] }
      },
      {
        heroId: `enemy_dps_${Date.now()}`,
        name: "Enemy DPS",
        position: 2,
        role: "DPS Ranged",
        element: "Fire",
        rarity: "Epic",
        level: enemyLevel - 1,
        stars: 4,
        stats: { 
          hp: Math.floor(5000 * mult), 
          maxHp: Math.floor(5000 * mult), 
          atk: Math.floor(380 * mult), 
          def: Math.floor(200 * mult), 
          speed: 95 
        },
        currentHp: Math.floor(5000 * mult),
        energy: 0,
        status: { alive: true, buffs: [], debuffs: [] }
      }
    ];
  }
}

// ===== GÉNÉRATEUR DE SCÉNARIOS ULTIMATES AVEC COMBAT LONG =====

class UltimateScenarioGenerator {
  
  static generateSpecializedScenarios(): UltimateTestScenario[] {
    return [
      this.createClutchScenario(),
      this.createBossSlayerScenario(), 
      this.createTeamFightScenario(),
      // ✨ NOUVEAU : Scénarios de combat long pour mesurer utilisations multiples
      this.createLongCombatScenario(),
      this.createEnduranceTestScenario(),
      this.createRealTimeScenario()
    ];
  }
  
  private static createClutchScenario(): UltimateTestScenario {
    return {
      name: "Clutch Ultimate Test",
      description: "Situation critique - team blessé, ultimate doit sauver",
      setupTeam: (ultimateSpell: UltimateSpell) => {
        const carrier = UltimateHeroFactory.createUltimateCarrier({
          ultimateSpell,
          level: 40,
          element: "Fire",
          startingEnergy: 100
        });
        
        const support = UltimateHeroFactory.createSupportTeam(40);
        // Team commence blessée
        support.forEach(hero => {
          hero.currentHp = Math.floor(hero.stats.hp * 0.3);
        });
        
        return [carrier, ...support];
      },
      setupEnemies: () => UltimateHeroFactory.createChallengingEnemies(42, "hard"),
      specialConditions: {
        startingEnergy: 100,
        turnLimit: 8,
        forcedTiming: 1 // Ultimate doit être utilisé tour 1
      },
      expectedOutcome: "ultimate_wins",
      weight: 2.0,
      focusMetric: "clutchFactor"
    };
  }
  
  private static createBossSlayerScenario(): UltimateTestScenario {
    return {
      name: "Boss Slayer Ultimate",
      description: "1v1 ultime vs boss massif",
      setupTeam: (ultimateSpell: UltimateSpell) => {
        return [UltimateHeroFactory.createUltimateCarrier({
          ultimateSpell,
          level: 50,
          element: "Electric",
          startingEnergy: 100
        })];
      },
      setupEnemies: () => {
        const boss = UltimateHeroFactory.createChallengingEnemies(55, "extreme")[0];
        boss.stats.hp *= 2.5;
        boss.currentHp = boss.stats.hp;
        boss.stats.maxHp = boss.stats.hp;
        return [boss];
      },
      specialConditions: {
        startingEnergy: 100,
        turnLimit: 12,
        forcedTiming: 2
      },
      expectedOutcome: "close_fight",
      weight: 1.8,
      focusMetric: "rawImpact"
    };
  }
  
  private static createTeamFightScenario(): UltimateTestScenario {
    return {
      name: "Team Fight Ultimate",
      description: "Combat d'équipe 3v3 équilibré",
      setupTeam: (ultimateSpell: UltimateSpell) => {
        const carrier = UltimateHeroFactory.createUltimateCarrier({
          ultimateSpell,
          level: 45,
          element: "Light",
          startingEnergy: 80
        });
        
        const team = UltimateHeroFactory.createSupportTeam(45);
        
        return [carrier, ...team];
      },
      setupEnemies: () => UltimateHeroFactory.createChallengingEnemies(46, "medium"),
      specialConditions: {
        startingEnergy: 80,
        turnLimit: 15
      },
      expectedOutcome: "ultimate_wins",
      weight: 1.5,
      focusMetric: "teamSynergyAmplification"
    };
  }
  
  // ✨ NOUVEAU : Combat long pour tester utilisations multiples (60 secondes simulées)
  private static createLongCombatScenario(): UltimateTestScenario {
    return {
      name: "Long Combat Test (60s)",
      description: "Combat de 60 secondes pour mesurer utilisations multiples",
      setupTeam: (ultimateSpell: UltimateSpell) => {
        const carrier = UltimateHeroFactory.createUltimateCarrier({
          ultimateSpell,
          level: 50,
          element: "Electric",
          startingEnergy: 0 // Commence à 0 pour progression réaliste
        });
        
        const team = UltimateHeroFactory.createSupportTeam(50);
        return [carrier, ...team];
      },
      setupEnemies: () => {
        // Ennemis avec beaucoup de HP pour combat long
        const enemies = UltimateHeroFactory.createChallengingEnemies(48, "medium");
        enemies.forEach(enemy => {
          enemy.stats.hp *= 4; // x4 HP pour combat long
          enemy.currentHp = enemy.stats.hp;
          enemy.stats.maxHp = enemy.stats.hp;
        });
        return enemies;
      },
      specialConditions: {
        turnLimit: 60, // ~60 tours = ~60 secondes
        difficultyModifier: 1.2
      },
      expectedOutcome: "ultimate_wins",
      weight: 3.0, // Poids important car mesure réaliste
      focusMetric: "accessibilityScore"
    };
  }
  
  // ✨ NOUVEAU : Test d'endurance avec régénération
  private static createEnduranceTestScenario(): UltimateTestScenario {
    return {
      name: "Endurance Test",
      description: "Combat d'endurance avec vagues d'ennemis",
      setupTeam: (ultimateSpell: UltimateSpell) => {
        const carrier = UltimateHeroFactory.createUltimateCarrier({
          ultimateSpell,
          level: 45,
          element: "Water",
          startingEnergy: 0
        });
        
        // Team plus résistante
        const team = UltimateHeroFactory.createSupportTeam(45);
        team.forEach(hero => {
          hero.stats.hp *= 1.5;
          hero.currentHp = hero.stats.hp;
          hero.stats.maxHp = hero.stats.hp;
        });
        
        return [carrier, ...team];
      },
      setupEnemies: () => {
        // Plusieurs ennemis faibles pour combat long
        const enemies = [];
        for (let i = 0; i < 4; i++) {
          const enemy = UltimateHeroFactory.createChallengingEnemies(40, "easy")[0];
          enemy.heroId = `endurance_enemy_${i}`;
          enemies.push(enemy);
        }
        return enemies;
      },
      specialConditions: {
        turnLimit: 50,
        difficultyModifier: 0.8
      },
      expectedOutcome: "ultimate_wins",
      weight: 2.5,
      focusMetric: "scalingPotential"
    };
  }
  
  // ✨ NOUVEAU : Scénario temps réel simulé
  private static createRealTimeScenario(): UltimateTestScenario {
    return {
      name: "Real-Time Simulation",
      description: "Simulation temps réel avec génération d'énergie réaliste",
      setupTeam: (ultimateSpell: UltimateSpell) => {
        const carrier = UltimateHeroFactory.createUltimateCarrier({
          ultimateSpell,
          level: 55,
          element: "Light",
          startingEnergy: 20 // Début réaliste
        });
        
        const team = UltimateHeroFactory.createSupportTeam(55);
        return [carrier, ...team];
      },
      setupEnemies: () => UltimateHeroFactory.createChallengingEnemies(52, "hard"),
      specialConditions: {
        startingEnergy: 20,
        turnLimit: 80, // Combat potentiellement très long
        difficultyModifier: 1.1
      },
      expectedOutcome: "close_fight",
      weight: 2.8,
      focusMetric: "timingOptimization"
    };
  }
}

// ===== ANALYSEUR SPÉCIALISÉ ULTIMATES =====

class UltimateAnalyzer {
  
  private scenarios: UltimateTestScenario[];
  private ultimateResults: Map<string, UltimateAnalysisResult> = new Map();
  
  // ✨ NOUVEAU : Seuils d'alertes configurables
  private alertThresholds: AlertThresholds = {
    critical: {
      maxUsagePerMinute: 8.0,           // >8 utilisations/min = impossible
      maxDpsPerMinute: 50000,           // >50k DPS/min = aberrant
      minEnergyCost: 60,                // <60 énergie = trop faible pour ultimate
      maxUsagesPer60s: 12,              // >12 utilisations en 60s = spam
      impossibleHealDamage: true        // Heal ultimate qui fait des dégâts
    },
    balance: {
      minDamagePerUse: 3500,            // <3500 dégâts/use pour damage ultimate
      minUtilityScore: 35,              // <35 utilité pour utility ultimate
      maxRating: 95,                    // >95 rating = trop puissant
      minUsageRate: 60,                 // <60% usage = rarement utilisé
      minGameChanging: 25               // <25 game-changing = pas assez impactant
    },
    design: {
      minAccessibility: 50,             // <50% accessibilité = problème design
      minVersatility: 40,               // <40 versatilité = trop situationnel
      minUniqueIndex: 25,               // <25 unicité = trop générique
      targetBalanceRange: [55, 75]      // Zone de balance idéale
    }
  };
  
  constructor() {
    this.scenarios = UltimateScenarioGenerator.generateSpecializedScenarios();
  }
  
  async initialize(): Promise<void> {
    console.log("⚡ Initialisation de l'analyseur d'ultimates...");
    
    try {
      await SpellManager.initialize();
      await EffectManager.initialize();
      await PassiveManager.initialize();
      console.log("✅ Analyseur d'ultimates prêt");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log("⚠️ Erreur initialisation systèmes:", errorMessage);
      console.log("💡 L'analyse continuera avec les fonctionnalités disponibles");
    }
  }
  
  async runCompleteAnalysis(): Promise<void> {
    console.log("\n⚡ === ANALYSE SPÉCIALISÉE DES ULTIMATES ===\n");
    
    const startTime = Date.now();
    
    // Récupérer les ultimates depuis le SpellManager
    const ultimateSpells = this.getUltimateSpells();
    
    if (ultimateSpells.length === 0) {
      console.log("⚠️ Aucun ultimate trouvé dans le système");
      console.log("💡 Génération d'ultimates d'exemple pour démonstration...\n");
      
      // Mode simulation avec exemples
      const exampleUltimates = this.generateExampleUltimates();
      await this.analyzeUltimateList(exampleUltimates, "simulation");
    } else {
      console.log(`🎯 Analyse de ${ultimateSpells.length} ultimates sur ${this.scenarios.length} scénarios spécialisés\n`);
      await this.analyzeUltimateList(ultimateSpells, "real");
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏱️ Analyse ultimates terminée en ${duration}s\n`);
  }
  
  private async analyzeUltimateList(ultimateSpells: UltimateSpell[], mode: "real" | "simulation"): Promise<void> {
    // Phase 1: Tests individuels
    console.log(`🔬 Phase 1: Tests de performance individuels (mode ${mode})...`);
    for (const ultimate of ultimateSpells) {
      if (mode === "real") {
        await this.analyzeUltimatePerformance(ultimate);
      } else {
        await this.simulateUltimatePerformance(ultimate);
      }
      process.stdout.write('⚡');
    }
    console.log(" ✅\n");
    
    // Phase 2: Analyse comparative
    console.log("📊 Phase 2: Analyse comparative des ultimates...");
    this.generateComparativeAnalysis();
    console.log("✅\n");
    
    // Phase 3: Rapport spécialisé
    console.log("📋 Phase 3: Génération du rapport ultimates...");
    const report = this.generateUltimateReport(mode);
    this.saveReport(report);
    
    this.displayUltimateFindings(mode);
  }
  
  private getUltimateSpells(): UltimateSpell[] {
    try {
      const allSpells = SpellManager.getAllSpells();
      return allSpells
        .filter((spell: any) => spell.config && spell.config.type === "ultimate")
        .map((spell: any) => spell as UltimateSpell);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn("⚠️ Erreur récupération sorts:", errorMessage);
      return [];
    }
  }
  
  private generateExampleUltimates(): UltimateSpell[] {
    return [
      {
        config: {
          id: "example_fireball_ultimate",
          name: "Effondrement Infernal",
          type: "ultimate",
          category: "damage",
          element: "Fire"
        },
        getEnergyCost: () => 100,
        getEffectiveCooldown: () => 0
      },
      {
        config: {
          id: "example_heal_ultimate",
          name: "Renaissance Ultime",
          type: "ultimate",
          category: "heal",
          element: "Light"
        },
        getEnergyCost: () => 100,
        getEffectiveCooldown: () => 0
      },
      {
        config: {
          id: "example_control_ultimate",
          name: "Tempête de Vide",
          type: "ultimate",
          category: "control",
          element: "Dark"
        },
        getEnergyCost: () => 100,
        getEffectiveCooldown: () => 0
      },
      {
        config: {
          id: "example_buff_ultimate",
          name: "Aura de Domination",
          type: "ultimate",
          category: "buff",
          element: "Light"
        },
        getEnergyCost: () => 100,
        getEffectiveCooldown: () => 0
      }
    ];
  }
  
  // Mode simulation (si pas d'ultimates réels)
  private async simulateUltimatePerformance(ultimateSpell: UltimateSpell): Promise<void> {
    const metrics: UltimateMetrics = {
      rawImpact: this.simulateMetric(ultimateSpell, "rawImpact"),
      gameChangingScore: this.simulateMetric(ultimateSpell, "gameChangingScore"),
      clutchFactor: this.simulateMetric(ultimateSpell, "clutchFactor"),
      energyEfficiency: this.simulateMetric(ultimateSpell, "energyEfficiency"),
      timingOptimization: this.simulateMetric(ultimateSpell, "timingOptimization"),
      accessibilityScore: this.simulateMetric(ultimateSpell, "accessibilityScore"),
      soloCarryPotential: this.simulateMetric(ultimateSpell, "soloCarryPotential"),
      teamSynergyAmplification: this.simulateMetric(ultimateSpell, "teamSynergyAmplification"),
      counterPlayResistance: this.simulateMetric(ultimateSpell, "counterPlayResistance"),
      scalingPotential: this.simulateMetric(ultimateSpell, "scalingPotential"),
      versatilityScore: this.simulateMetric(ultimateSpell, "versatilityScore"),
      uniquenessIndex: this.simulateMetric(ultimateSpell, "uniquenessIndex")
    };
    
    const scenarioResults: Record<string, any> = {};
    this.scenarios.forEach(scenario => {
      scenarioResults[scenario.name] = {
        performance: this.simulateScenarioPerformance(ultimateSpell, scenario),
        impact: "simulated",
        notes: ["Résultat simulé"],
        ultimateUsed: true,
        damageDealt: Math.floor(Math.random() * 5000 + 2000),
        gameChanging: Math.random() > 0.5,
        victory: Math.random() > 0.3,
        scenarioName: scenario.name,
        usesCount: Math.floor(Math.random() * 4 + 1),
        battleDuration: Math.floor(Math.random() * 20 + 15),
        utilityScore: Math.floor(Math.random() * 50 + 10)
      };
    });
    
    // Calculer métriques DPS et résumé technique simulés
    const dpsMetrics = this.calculateDpsMetrics(scenarioResults, ultimateSpell);
    const technicalSummary = this.generateTechnicalSummary(ultimateSpell, scenarioResults, metrics);
    
    const analysis: UltimateAnalysisResult = {
      spellId: ultimateSpell.config.id,
      spellName: ultimateSpell.config.name,
      element: ultimateSpell.config.element || "None",
      category: ultimateSpell.config.category,
      metrics,
      dpsMetrics,
      technicalSummary,
      alerts: [], // Sera rempli après
      overallPower: this.calculateOverallPower(metrics),
      designQuality: this.calculateDesignQuality(metrics, ultimateSpell),
      balanceRating: this.calculateBalanceRating(metrics, ultimateSpell),
      ultimateClass: this.classifyUltimate(metrics),
      optimalTiming: this.determineOptimalTiming(metrics, scenarioResults),
      bestUseCase: this.determineBestUseCase(scenarioResults),
      balanceStatus: this.determineUltimateBalanceStatus(metrics),
      urgentFixes: this.generateUrgentFixes(metrics, ultimateSpell),
      designSuggestions: this.generateDetailedSuggestions(metrics, ultimateSpell, dpsMetrics),
      scenarioResults,
      comparisonRank: 0
    };
    
    // ✨ NOUVEAU : Détecter anomalies et alertes
    analysis.alerts = this.detectAnomalies(analysis);
    
    this.ultimateResults.set(ultimateSpell.config.id, analysis);
  }
  
  // Mode réel (avec BattleEngine)
  private async analyzeUltimatePerformance(ultimateSpell: UltimateSpell): Promise<void> {
    const metrics: UltimateMetrics = {
      rawImpact: 0,
      gameChangingScore: 0,
      clutchFactor: 0,
      energyEfficiency: 0,
      timingOptimization: 0,
      accessibilityScore: 0,
      soloCarryPotential: 0,
      teamSynergyAmplification: 0,
      counterPlayResistance: 0,
      scalingPotential: 0,
      versatilityScore: 0,
      uniquenessIndex: 0
    };
    
    const scenarioResults: Record<string, any> = {};
    const performanceAggregator = { total: 0, count: 0 };
    
    // Tester dans chaque scénario spécialisé
    for (const scenario of this.scenarios) {
      try {
        const result = await this.testUltimateInScenario(ultimateSpell, scenario);
        scenarioResults[scenario.name] = result;
        
        // Agréger performance globale
        performanceAggregator.total += result.performance * scenario.weight;
        performanceAggregator.count += scenario.weight;
        
        // Mettre à jour la métrique focus du scénario
        this.updateSpecificMetric(metrics, result, scenario);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Erreur scénario ${scenario.name}:`, errorMessage);
        scenarioResults[scenario.name] = {
          performance: 0,
          impact: "error",
          notes: [`Erreur: ${errorMessage}`],
          ultimateUsed: false,
          scenarioName: scenario.name,
          usesCount: 0,
          battleDuration: 1,
          utilityScore: 0
        };
      }
    }
    
    // Calculer métriques dérivées
    this.calculateDerivedMetrics(metrics, scenarioResults, ultimateSpell);
    
    // ✨ NOUVEAU : Calculer métriques DPS et résumé technique
    const dpsMetrics = this.calculateDpsMetrics(scenarioResults, ultimateSpell);
    const technicalSummary = this.generateTechnicalSummary(ultimateSpell, scenarioResults, metrics);
    
    // Générer l'analyse finale
    const analysis: UltimateAnalysisResult = {
      spellId: ultimateSpell.config.id,
      spellName: ultimateSpell.config.name,
      element: ultimateSpell.config.element || "None",
      category: ultimateSpell.config.category,
      metrics,
      dpsMetrics,
      technicalSummary,
      alerts: [], // Sera rempli après
      overallPower: this.calculateOverallPower(metrics),
      designQuality: this.calculateDesignQuality(metrics, ultimateSpell),
      balanceRating: this.calculateBalanceRating(metrics, ultimateSpell),
      ultimateClass: this.classifyUltimate(metrics),
      optimalTiming: this.determineOptimalTiming(metrics, scenarioResults),
      bestUseCase: this.determineBestUseCase(scenarioResults),
      balanceStatus: this.determineUltimateBalanceStatus(metrics),
      urgentFixes: this.generateUrgentFixes(metrics, ultimateSpell),
      designSuggestions: this.generateDetailedSuggestions(metrics, ultimateSpell, dpsMetrics),
      scenarioResults,
      comparisonRank: 0
    };
    
    // ✨ NOUVEAU : Détecter anomalies et alertes
    analysis.alerts = this.detectAnomalies(analysis);
    
    this.ultimateResults.set(ultimateSpell.config.id, analysis);
  }
  
  private async testUltimateInScenario(ultimateSpell: UltimateSpell, scenario: UltimateTestScenario): Promise<any> {
    // Setup teams selon le scénario
    const playerTeam = scenario.setupTeam(ultimateSpell);
    const enemyTeam = scenario.setupEnemies();
    
    // Configuration des sorts
    const ultimateCarrier = playerTeam[0];
    const heroSpells: HeroSpells = {
      ultimate: { id: ultimateSpell.config.id, level: 5 }
    };
    
    const playerSpells = new Map<string, HeroSpells>();
    playerSpells.set(ultimateCarrier.heroId, heroSpells);
    
    // Options de combat
    const battleOptions: IBattleOptions = {
      mode: "auto",
      speed: 1
    };
    
    // Simulation du combat
    const engine = new BattleEngine(
      playerTeam,
      enemyTeam,
      playerSpells,
      new Map(),
      battleOptions
    );
    
    const result = engine.simulateBattle();
    const actions = engine.getActions();
    
    return this.analyzeUltimateCombatResult(result, actions, ultimateCarrier.heroId, ultimateSpell, scenario);
  }
  
  private analyzeUltimateCombatResult(
    battleResult: IBattleResult,
    actions: IBattleAction[],
    carrierId: string,
    ultimateSpell: UltimateSpell,
    scenario: UltimateTestScenario
  ): any {
    
    // ✅ CORRIGÉ: Filtrer les actions d'ultimate par actorId et actionType
    const ultimateActions = actions.filter(action => 
      action.actorId === carrierId && 
      action.actionType === "ultimate"
    );
    
    const ultimateUsed = ultimateActions.length > 0;
    const ultimateDamage = ultimateActions.reduce((sum, action) => sum + (action.damage || 0), 0);
    const ultimateHealing = ultimateActions.reduce((sum, action) => sum + (action.healing || 0), 0);
    
    // ✅ CORRIGÉ: Calculer l'impact sans propriété 'team'
    const playerTeamIds = scenario.setupTeam(ultimateSpell).map(p => p.heroId);
    
    const totalPlayerDamage = actions
      .filter(action => playerTeamIds.includes(action.actorId))
      .reduce((sum, action) => sum + (action.damage || 0), 0);
    
    const ultimateContribution = totalPlayerDamage > 0 ? ultimateDamage / totalPlayerDamage : 0;
    
    // ✨ NOUVEAU : Métriques DPS détaillées
    const battleDurationTurns = battleResult.totalTurns || 1;
    const dpsPerTurn = ultimateDamage / battleDurationTurns;
    const hpsPerTurn = ultimateHealing / battleDurationTurns;
    const avgDamagePerUse = ultimateUsed ? ultimateDamage / ultimateActions.length : 0;
    
    // ✨ NOUVEAU : Analyse des effets secondaires
    const buffsApplied = ultimateActions.reduce((sum, action) => sum + (action.buffsApplied?.length || 0), 0);
    const debuffsApplied = ultimateActions.reduce((sum, action) => sum + (action.debuffsApplied?.length || 0), 0);
    const utilityScore = (buffsApplied * 15) + (debuffsApplied * 12) + (ultimateHealing > 0 ? 20 : 0);
    
    // Score de performance adapté aux ultimates
    let performance = 30; // Base
    
    if (ultimateUsed) {
      performance += 30; // Bonus gros pour utilisation
      
      // Bonus selon l'impact
      performance += Math.min(25, ultimateContribution * 50);
      
      // Bonus selon le résultat attendu
      if (battleResult.victory) {
        if (scenario.expectedOutcome === "ultimate_wins") performance += 20;
        if (scenario.expectedOutcome === "close_fight") performance += 10;
      }
      
    } else {
      // Ultimate non utilisé - très problématique
      performance = 5;
    }
    
    // Classification de l'impact
    let impact = "minimal";
    if (ultimateContribution > 0.7) impact = "dominant";
    else if (ultimateContribution > 0.4) impact = "major";
    else if (ultimateContribution > 0.2) impact = "moderate";
    else if (ultimateUsed) impact = "minor";
    
    const notes: string[] = [];
    if (!ultimateUsed) notes.push("Ultimate jamais utilisé - problème critique");
    if (ultimateContribution > 0.8) notes.push("Contribution ultra-dominante");
    if (avgDamagePerUse > 8000) notes.push("Dégâts par utilisation très élevés");
    if (utilityScore > 50) notes.push("Forte utilité (buffs/heals/debuffs)");
    
    // ✨ NOUVEAU : Debug détaillé
    console.log(`    🔍 DEBUG ${ultimateSpell.config.name}:`);
    console.log(`       ⚔️ Dégâts: ${ultimateDamage} (${avgDamagePerUse}/use)`);
    console.log(`       💚 Soins: ${ultimateHealing} (${hpsPerTurn}/turn)`);
    console.log(`       📊 Contribution: ${Math.round(ultimateContribution * 100)}%`);
    console.log(`       ⚡ Utilisé: ${ultimateActions.length}x, Tour: ${ultimateActions[0]?.turn || 'N/A'}`);
    console.log(`       🎯 Utilité: ${utilityScore} (${buffsApplied} buffs, ${debuffsApplied} debuffs)`);
    
    return {
      performance: Math.max(0, Math.min(100, performance)),
      impact,
      notes,
      ultimateUsed,
      damageDealt: ultimateDamage,
      healingDone: ultimateHealing,
      gameChanging: ultimateContribution > 0.5,
      contribution: ultimateContribution,
      battleDuration: battleDurationTurns,
      victory: battleResult.victory,
      timing: ultimateActions[0]?.turn || null,
      // ✨ NOUVEAU : Métriques détaillées
      dpsPerTurn,
      hpsPerTurn,
      avgDamagePerUse,
      utilityScore,
      buffsApplied,
      debuffsApplied,
      usesCount: ultimateActions.length,
      scenarioName: scenario.name // ✨ NOUVEAU : Nom du scénario pour identification
    };
  }
  
  // ✨ NOUVEAU : Système de détection d'anomalies automatique
  private detectAnomalies(ultimate: UltimateAnalysisResult): UltimateAlert[] {
    const alerts: UltimateAlert[] = [];
    
    // ===== ALERTES CRITIQUES (BUGS ÉVIDENTS) =====
    
    // 1. Spam d'ultimate impossible
    if (ultimate.dpsMetrics.usageFrequency > this.alertThresholds.critical.maxUsagePerMinute) {
      alerts.push({
        level: "CRITICAL",
        type: "IMPOSSIBLE_USAGE_SPAM",
        message: `${ultimate.dpsMetrics.usageFrequency}/min utilisations IMPOSSIBLE`,
        value: ultimate.dpsMetrics.usageFrequency,
        threshold: this.alertThresholds.critical.maxUsagePerMinute,
        autoFix: "Vérifier coût énergétique réel et système de génération d'énergie",
        priority: 1
      });
    }
    
    // 2. Trop d'utilisations en 60s
    if (ultimate.dpsMetrics.realTimeUsage > this.alertThresholds.critical.maxUsagesPer60s) {
      alerts.push({
        level: "CRITICAL",
        type: "USAGE_COUNT_ABERRANT",
        message: `${ultimate.dpsMetrics.realTimeUsage} utilisations/60s aberrant`,
        value: ultimate.dpsMetrics.realTimeUsage,
        threshold: this.alertThresholds.critical.maxUsagesPer60s,
        autoFix: "Ultimate spammé - vérifier coût énergie/cooldown",
        priority: 1
      });
    }
    
    // 3. DPS temps réel aberrant
    if (ultimate.dpsMetrics.realTimeDPS > this.alertThresholds.critical.maxDpsPerMinute) {
      alerts.push({
        level: "CRITICAL",
        type: "DPS_VALUES_ABERRANT", 
        message: `${ultimate.dpsMetrics.realTimeDPS} DPS/min valeurs impossibles`,
        value: ultimate.dpsMetrics.realTimeDPS,
        threshold: this.alertThresholds.critical.maxDpsPerMinute,
        autoFix: "Bug dans calcul DPS - vérifier formules",
        priority: 1
      });
    }
    
    // 4. Ultimate heal qui fait des dégâts
    if (ultimate.category === "heal" && ultimate.dpsMetrics.averageDamagePerUse > 0) {
      alerts.push({
        level: "CRITICAL",
        type: "CATEGORY_BUG",
        message: "Ultimate HEAL fait des dégâts - erreur de catégorie",
        value: ultimate.dpsMetrics.averageDamagePerUse,
        threshold: 0,
        autoFix: "Retirer dégâts du code heal OU changer catégorie",
        priority: 1
      });
    }
    
    // 5. Coût énergétique trop faible
    if (ultimate.technicalSummary.energyCost < this.alertThresholds.critical.minEnergyCost) {
      alerts.push({
        level: "CRITICAL",
        type: "ENERGY_COST_TOO_LOW",
        message: `Coût ${ultimate.technicalSummary.energyCost} trop faible pour ultimate`,
        value: ultimate.technicalSummary.energyCost,
        threshold: this.alertThresholds.critical.minEnergyCost,
        autoFix: "Augmenter coût à minimum 80-100 énergie",
        priority: 2
      });
    }
    
    // ===== ALERTES BALANCE (DÉSÉQUILIBRES) =====
    
    // 6. Damage ultimate trop faible
    if (ultimate.category === "damage" && ultimate.dpsMetrics.averageDamagePerUse < this.alertThresholds.balance.minDamagePerUse) {
      alerts.push({
        level: "BALANCE",
        type: "DAMAGE_TOO_LOW",
        message: `Dégâts ${ultimate.dpsMetrics.averageDamagePerUse} insuffisants pour ultimate damage`,
        value: ultimate.dpsMetrics.averageDamagePerUse,
        threshold: this.alertThresholds.balance.minDamagePerUse,
        suggestion: `Augmenter à ~${this.alertThresholds.balance.minDamagePerUse + 1000} (+${this.alertThresholds.balance.minDamagePerUse + 1000 - ultimate.dpsMetrics.averageDamagePerUse})`,
        priority: 2
      });
    }
    
    // 7. Utility ultimate inutile
    if ((ultimate.category === "utility" || ultimate.category === "buff" || ultimate.category === "debuff" || ultimate.category === "control") 
        && ultimate.dpsMetrics.utilityScore < this.alertThresholds.balance.minUtilityScore) {
      alerts.push({
        level: "BALANCE",
        type: "UTILITY_TOO_WEAK",
        message: `Utilité ${Math.round(ultimate.dpsMetrics.utilityScore)} trop faible`,
        value: ultimate.dpsMetrics.utilityScore,
        threshold: this.alertThresholds.balance.minUtilityScore,
        suggestion: "Ajouter buffs/debuffs plus forts ou effets uniques",
        priority: 2
      });
    }
    
    // 8. Ultimate trop puissant
    if (ultimate.dpsMetrics.dpsRating > this.alertThresholds.balance.maxRating) {
      alerts.push({
        level: "BALANCE",
        type: "OVERPOWERED",
        message: `Rating ${ultimate.dpsMetrics.dpsRating}/100 trop élevé`,
        value: ultimate.dpsMetrics.dpsRating,
        threshold: this.alertThresholds.balance.maxRating,
        suggestion: "Réduire impact de 15-25% ou augmenter coût énergie",
        priority: 2
      });
    }
    
    // 9. Ultimate rarement utilisé
    if (ultimate.technicalSummary.usageRate < this.alertThresholds.balance.minUsageRate) {
      alerts.push({
        level: "BALANCE",
        type: "RARELY_USED",
        message: `Usage ${ultimate.technicalSummary.usageRate}% trop faible`,
        value: ultimate.technicalSummary.usageRate,
        threshold: this.alertThresholds.balance.minUsageRate,
        suggestion: "Réduire coût énergie ou améliorer timing d'activation",
        priority: 3
      });
    }
    
    // 10. Manque de game-changing
    if (ultimate.metrics.gameChangingScore < this.alertThresholds.balance.minGameChanging) {
      alerts.push({
        level: "BALANCE",
        type: "LACKS_IMPACT",
        message: `Game-changing ${ultimate.metrics.gameChangingScore}/100 insuffisant`,
        value: ultimate.metrics.gameChangingScore,
        threshold: this.alertThresholds.balance.minGameChanging,
        suggestion: "Ajouter mécaniques uniques qui changent le cours du combat",
        priority: 3
      });
    }
    
    // ===== ALERTES DESIGN (AMÉLIORATIONS) =====
    
    // 11. Accessibilité problématique
    if (ultimate.metrics.accessibilityScore < this.alertThresholds.design.minAccessibility) {
      alerts.push({
        level: "DESIGN",
        type: "ACCESSIBILITY_ISSUE",
        message: `Accessibilité ${Math.round(ultimate.metrics.accessibilityScore)}% problématique`,
        value: ultimate.metrics.accessibilityScore,
        threshold: this.alertThresholds.design.minAccessibility,
        suggestion: "Optimiser coût/timing pour meilleure accessibilité",
        priority: 4
      });
    }
    
    // 12. Trop situationnel
    if (ultimate.metrics.versatilityScore < this.alertThresholds.design.minVersatility) {
      alerts.push({
        level: "DESIGN",
        type: "TOO_SITUATIONAL",
        message: `Versatilité ${Math.round(ultimate.metrics.versatilityScore)}/100 limitée`,
        value: ultimate.metrics.versatilityScore,
        threshold: this.alertThresholds.design.minVersatility,
        suggestion: "Ajouter effets secondaires pour plus de situations d'usage",
        priority: 4
      });
    }
    
    // 13. Manque d'unicité
    if (ultimate.metrics.uniquenessIndex < this.alertThresholds.design.minUniqueIndex) {
      alerts.push({
        level: "DESIGN",
        type: "LACKS_UNIQUENESS",
        message: `Unicité ${Math.round(ultimate.metrics.uniquenessIndex)}/100 générique`,
        value: ultimate.metrics.uniquenessIndex,
        threshold: this.alertThresholds.design.minUniqueIndex,
        suggestion: "Créer mécaniques signature non-reproductibles",
        priority: 5
      });
    }
    
    // 14. Hors zone de balance idéale
    const [minBalance, maxBalance] = this.alertThresholds.design.targetBalanceRange;
    if (ultimate.overallPower < minBalance || ultimate.overallPower > maxBalance) {
      alerts.push({
        level: "DESIGN",
        type: "BALANCE_RANGE_ISSUE",
        message: `Puissance ${ultimate.overallPower}/100 hors zone idéale [${minBalance}-${maxBalance}]`,
        value: ultimate.overallPower,
        threshold: ultimate.overallPower < minBalance ? minBalance : maxBalance,
        suggestion: ultimate.overallPower < minBalance ? 
          `Buff global de ${Math.round((minBalance - ultimate.overallPower) * 1.5)}%` :
          `Nerf global de ${Math.round((ultimate.overallPower - maxBalance) * 1.2)}%`,
        priority: 3
      });
    }
    
    // Trier par priorité (1 = le plus urgent)
    return alerts.sort((a, b) => a.priority - b.priority);
  }
  
  // ✨ NOUVEAU : Calculer les métriques DPS détaillées avec utilisation multiple
  private calculateDpsMetrics(scenarioResults: Record<string, any>, ultimateSpell: UltimateSpell): UltimateDpsMetrics {
    const results = Object.values(scenarioResults);
    
    const totalDamage = results.reduce((sum: number, result: any) => sum + (result.damageDealt || 0), 0);
    const totalHealing = results.reduce((sum: number, result: any) => sum + (result.healingDone || 0), 0);
    const totalUses = results.reduce((sum: number, result: any) => sum + (result.usesCount || 0), 0);
    const totalTurns = results.reduce((sum: number, result: any) => sum + (result.battleDuration || 1), 0);
    
    // ✨ NOUVEAU : Métriques temps réel 60s
    const longCombatResult = results.find((r: any) => r.scenarioName === "Long Combat Test (60s)");
    const realTimeUsage = longCombatResult ? longCombatResult.usesCount || 0 : 0;
    const usageFrequency = longCombatResult ? (realTimeUsage / (longCombatResult.battleDuration || 1)) * 60 : 0; // Par minute
    
    const averageDamagePerUse = totalUses > 0 ? Math.round(totalDamage / totalUses) : 0;
    const averageHealingPerUse = totalUses > 0 ? Math.round(totalHealing / totalUses) : 0;
    const dpsPerTurn = totalTurns > 0 ? Math.round(totalDamage / totalTurns) : 0;
    const hpsPerTurn = totalTurns > 0 ? Math.round(totalHealing / totalTurns) : 0;
    
    // ✨ NOUVEAU : Calculer DPS temps réel (dégâts par minute)
    const realTimeDPS = longCombatResult ? (longCombatResult.damageDealt || 0) / ((longCombatResult.battleDuration || 1) / 60) : 0;
    const realTimeHPS = longCombatResult ? (longCombatResult.healingDone || 0) / ((longCombatResult.battleDuration || 1) / 60) : 0;
    
    // Calculer note DPS (0-100) basée sur la catégorie ET utilisation multiple
    let dpsRating = 0;
    if (ultimateSpell.config.category === "damage") {
      dpsRating = Math.min(100, Math.max(0, (averageDamagePerUse - 2000) / 80 + realTimeUsage * 5));
    } else if (ultimateSpell.config.category === "heal") {
      dpsRating = Math.min(100, Math.max(0, (averageHealingPerUse - 1000) / 60 + realTimeUsage * 8));
    } else {
      // Pour control/buff/debuff, on base sur l'utilité ET fréquence
      const avgUtility = results.reduce((sum: number, result: any) => sum + (result.utilityScore || 0), 0) / results.length;
      dpsRating = Math.min(100, Math.max(0, avgUtility + realTimeUsage * 10));
    }
    
    return {
      totalDamage,
      averageDamagePerUse,
      dpsRating: Math.round(dpsRating),
      dpsRank: 0, // Sera calculé dans generateComparativeAnalysis
      healingPerSecond: hpsPerTurn,
      utilityScore: results.reduce((sum: number, result: any) => sum + (result.utilityScore || 0), 0) / results.length,
      // ✨ NOUVEAU : Métriques temps réel
      realTimeUsage,
      usageFrequency: Math.round(usageFrequency * 10) / 10,
      realTimeDPS: Math.round(realTimeDPS),
      realTimeHPS: Math.round(realTimeHPS)
    };
  }
  
  // ✨ NOUVEAU : Générer le résumé technique
  private generateTechnicalSummary(ultimateSpell: UltimateSpell, scenarioResults: Record<string, any>, metrics: UltimateMetrics): any {
    const results = Object.values(scenarioResults);
    const usageRate = results.filter((result: any) => result.ultimateUsed).length / results.length;
    const avgTiming = results
      .filter((result: any) => result.timing !== null)
      .reduce((sum: number, result: any) => sum + (result.timing || 0), 0) / 
      results.filter((result: any) => result.timing !== null).length || 0;
    
    let energyCost = 100;
    try {
      energyCost = ultimateSpell.getEnergyCost ? ultimateSpell.getEnergyCost(5) : 100;
    } catch (error) {
      // Fallback
    }
    
    // Description des effets basée sur la catégorie
    const effectDescriptions: Record<string, string> = {
      "damage": "Inflige des dégâts massifs aux ennemis",
      "heal": "Soigne les alliés et peut ressusciter",
      "buff": "Améliore les capacités de l'équipe",
      "debuff": "Affaiblit et handicape les ennemis",
      "control": "Contrôle le champ de bataille et manipule l'initiative",
      "utility": "Effet spécialisé unique"
    };
    
    return {
      category: ultimateSpell.config.category,
      element: ultimateSpell.config.element || "None",
      energyCost,
      usageRate: Math.round(usageRate * 100),
      averageTiming: Math.round(avgTiming),
      effectDescription: effectDescriptions[ultimateSpell.config.category] || "Effet spécialisé unique"
    };
  }
  
  private simulateMetric(ultimateSpell: UltimateSpell, metricName: string): number {
    const baseValue = 30 + Math.random() * 40;
    
    let categoryBonus = 0;
    switch (ultimateSpell.config.category) {
      case "damage":
        if (metricName === "rawImpact" || metricName === "soloCarryPotential") categoryBonus = 20;
        break;
      case "heal":
        if (metricName === "teamSynergyAmplification" || metricName === "clutchFactor") categoryBonus = 15;
        break;
      case "control":
        if (metricName === "gameChangingScore" || metricName === "versatilityScore") categoryBonus = 18;
        break;
      case "buff":
        if (metricName === "teamSynergyAmplification" || metricName === "scalingPotential") categoryBonus = 16;
        break;
    }
    
    let elementBonus = 0;
    if (ultimateSpell.config.element === "Fire" && metricName === "rawImpact") elementBonus = 10;
    if (ultimateSpell.config.element === "Light" && metricName === "teamSynergyAmplification") elementBonus = 10;
    if (ultimateSpell.config.element === "Dark" && metricName === "gameChangingScore") elementBonus = 10;
    
    return Math.min(100, Math.max(0, baseValue + categoryBonus + elementBonus));
  }
  
  // ✨ NOUVEAU : Description des effets par catégorie
  private getEffectDescription(category: string): string {
    const descriptions: Record<string, string> = {
      "damage": "Inflige des dégâts massifs aux ennemis",
      "heal": "Soigne les alliés et peut ressusciter",
      "buff": "Améliore les capacités de l'équipe",
      "debuff": "Affaiblit et handicape les ennemis",
      "control": "Contrôle le champ de bataille et manipule l'initiative",
      "utility": "Effet spécialisé unique"
    };
    
    return descriptions[category] || "Effet spécialisé unique";
  }
  
  private simulateScenarioPerformance(ultimateSpell: UltimateSpell, scenario: UltimateTestScenario): number {
    const basePerformance = 40 + Math.random() * 30;
    
    let synergy = 0;
    if (scenario.name === "Boss Slayer Ultimate" && ultimateSpell.config.category === "damage") synergy = 15;
    if (scenario.name === "Clutch Ultimate Test" && ultimateSpell.config.category === "heal") synergy = 20;
    if (scenario.name === "Team Fight Ultimate" && ultimateSpell.config.category === "control") synergy = 12;
    
    return Math.min(100, Math.max(0, basePerformance + synergy));
  }
  
  private updateSpecificMetric(metrics: UltimateMetrics, result: any, scenario: UltimateTestScenario): void {
    const performance = result.performance;
    const focusMetric = scenario.focusMetric;
    
    (metrics as any)[focusMetric] = performance;
    
    switch (scenario.name) {
      case "Clutch Ultimate Test":
        metrics.clutchFactor = performance;
        metrics.gameChangingScore = result.gameChanging ? 80 : 20;
        break;
      case "Boss Slayer Ultimate":
        metrics.rawImpact = performance;
        metrics.soloCarryPotential = performance * 0.9;
        break;
      case "Team Fight Ultimate":
        metrics.teamSynergyAmplification = performance;
        metrics.versatilityScore = performance * 0.8;
        break;
    }
  }
  
  private calculateDerivedMetrics(metrics: UltimateMetrics, scenarioResults: Record<string, any>, ultimateSpell: UltimateSpell): void {
    try {
      const energyCost = ultimateSpell.getEnergyCost ? ultimateSpell.getEnergyCost(5) : 100;
      metrics.energyEfficiency = Math.max(0, 100 - (energyCost - 100) * 2 + metrics.rawImpact * 0.5);
    } catch (error) {
      metrics.energyEfficiency = 50;
    }
    
    const timingResults = Object.values(scenarioResults)
      .filter((result: any) => result.timing !== null)
      .map((result: any) => result.performance);
    
    metrics.timingOptimization = timingResults.length > 0 
      ? timingResults.reduce((sum, perf) => sum + perf, 0) / timingResults.length
      : 50;
    
    const usageRate = Object.values(scenarioResults)
      .filter((result: any) => result.ultimateUsed).length / Object.keys(scenarioResults).length;
    
    metrics.accessibilityScore = usageRate * 100;
    
    const performances = Object.values(scenarioResults).map((result: any) => result.performance);
    const avgPerformance = performances.reduce((sum, perf) => sum + perf, 0) / performances.length;
    const variance = performances.reduce((sum, perf) => sum + Math.pow(perf - avgPerformance, 2), 0) / performances.length;
    metrics.counterPlayResistance = Math.max(0, 100 - variance);
    
    metrics.scalingPotential = Math.min(100, metrics.rawImpact + metrics.gameChangingScore * 0.5);
    metrics.uniquenessIndex = 50;
  }
  
  private calculateOverallPower(metrics: UltimateMetrics): number {
    return Math.round(
      metrics.rawImpact * 0.25 +
      metrics.gameChangingScore * 0.25 +
      metrics.clutchFactor * 0.15 +
      metrics.soloCarryPotential * 0.15 +
      metrics.teamSynergyAmplification * 0.10 +
      metrics.accessibilityScore * 0.10
    );
  }
  
  private calculateDesignQuality(metrics: UltimateMetrics, ultimateSpell: UltimateSpell): number {
    let score = 50;
    
    if (metrics.rawImpact > 70 || metrics.gameChangingScore > 70) score += 20;
    if (metrics.timingOptimization > 60) score += 15;
    if (metrics.accessibilityScore < 30) score -= 25;
    if (metrics.clutchFactor < 25) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }
  
  private calculateBalanceRating(metrics: UltimateMetrics, ultimateSpell: UltimateSpell): number {
    const targetPower = 70;
    const actualPower = this.calculateOverallPower(metrics);
    const deviation = Math.abs(actualPower - targetPower) / targetPower;
    return Math.max(0, Math.round(100 - deviation * 100));
  }
  
  private classifyUltimate(metrics: UltimateMetrics): "game_changer" | "finisher" | "support" | "situational" | "underwhelming" {
    if (metrics.gameChangingScore > 75) return "game_changer";
    if (metrics.rawImpact > 80) return "finisher";
    if (metrics.teamSynergyAmplification > 70) return "support";
    if (metrics.clutchFactor > 60 || metrics.versatilityScore < 40) return "situational";
    return "underwhelming";
  }
  
  private determineOptimalTiming(metrics: UltimateMetrics, scenarioResults: Record<string, any>): "early" | "mid" | "late" | "clutch" | "anytime" {
    if (metrics.clutchFactor > 70) return "clutch";
    if (metrics.scalingPotential > 70) return "late";
    if (metrics.rawImpact > 80 && metrics.accessibilityScore > 60) return "early";
    if (metrics.versatilityScore > 60) return "anytime";
    return "mid";
  }
  
  private determineBestUseCase(scenarioResults: Record<string, any>): string {
    const bestScenario = Object.entries(scenarioResults)
      .reduce((best, [name, result]) => 
        result.performance > best.performance ? { name, performance: result.performance } : best,
        { name: "Aucun", performance: 0 }
      );
    
    return `Optimal: ${bestScenario.name} (${Math.round(bestScenario.performance)}%)`;
  }
  
  private determineUltimateBalanceStatus(metrics: UltimateMetrics): "underpowered" | "weak" | "balanced" | "strong" | "overpowered" | "broken" {
    const power = this.calculateOverallPower(metrics);
    const accessibility = metrics.accessibilityScore;
    
    if (accessibility < 20) return "underpowered";
    if (power < 35) return "weak";
    if (power > 95) return "broken";
    if (power > 85) return "overpowered";
    if (power > 75) return "strong";
    return "balanced";
  }
  
  private generateUrgentFixes(metrics: UltimateMetrics, ultimateSpell: UltimateSpell): string[] {
    const fixes: string[] = [];
    
    if (metrics.accessibilityScore < 30) {
      fixes.push("CRITIQUE: Ultimate rarement utilisé - vérifier coût énergétique et timing");
    }
    
    if (metrics.rawImpact < 25) {
      fixes.push("URGENT: Impact insuffisant - augmenter dégâts/effets de 40-60%");
    }
    
    if (metrics.gameChangingScore < 20) {
      fixes.push("URGENT: Manque de game-changing potential - revoir les effets uniques");
    }
    
    const overallPower = this.calculateOverallPower(metrics);
    if (overallPower > 90) {
      fixes.push("NERF REQUIS: Ultimate trop puissant - réduire impact de 15-25%");
    }
    
    return fixes;
  }
  
  // ✨ NOUVEAU : Système de suggestions détaillées et spécialisées
  private generateDetailedSuggestions(metrics: UltimateMetrics, ultimateSpell: UltimateSpell, dpsMetrics: UltimateDpsMetrics): string[] {
    const suggestions: string[] = [];
    
    // Suggestions basées sur la catégorie
    switch (ultimateSpell.config.category) {
      case "damage":
        if (dpsMetrics.averageDamagePerUse < 4000) {
          suggestions.push(`🔥 DAMAGE BOOST: Augmenter dégâts base à ~5500 (+${5500 - dpsMetrics.averageDamagePerUse})`);
        }
        if (dpsMetrics.realTimeUsage < 2) {
          suggestions.push("⚡ ENERGY: Réduire coût à 90 énergie pour plus d'utilisations");
        }
        if (metrics.versatilityScore < 50) {
          suggestions.push("💥 AoE: Ajouter zone d'effet ou effets secondaires");
        }
        break;
        
      case "heal":
        if (dpsMetrics.realTimeHPS < 800) {
          suggestions.push(`💚 HEAL BOOST: Augmenter soins à ~1200 HPS (+${1200 - dpsMetrics.realTimeHPS})`);
        }
        if (metrics.teamSynergyAmplification < 60) {
          suggestions.push("🛡️ UTILITY: Ajouter buffs défensifs (shields, résistances)");
        }
        break;
        
      case "buff":
        if (dpsMetrics.utilityScore < 60) {
          suggestions.push("⬆️ STRONGER BUFFS: Augmenter bonus à +50% ATQ/DEF au lieu de +30%");
        }
        if (metrics.scalingPotential < 50) {
          suggestions.push("🕐 DURATION: Étendre durée des buffs à 8-10 tours");
        }
        break;
        
      case "debuff":
        if (dpsMetrics.utilityScore < 50) {
          suggestions.push("⬇️ STRONGER DEBUFFS: Ajouter -50% DEF ou silence 3 tours");
        }
        if (metrics.counterPlayResistance < 40) {
          suggestions.push("🎯 SPREAD: Appliquer debuffs à toute l'équipe ennemie");
        }
        break;
        
      case "control":
      case "utility":
        if (dpsMetrics.utilityScore < 40) {
          suggestions.push("🎛️ CONTROL: Ajouter stun/freeze 2-3 tours ou manipulation initiative");
        }
        if (metrics.gameChangingScore < 30) {
          suggestions.push("🔄 UNIQUE: Créer mécaniques uniques (swap positions, reset cooldowns)");
        }
        break;
    }
    
    // Suggestions générales basées sur les métriques
    if (dpsMetrics.usageFrequency < 1.5) { // Moins de 1.5x par minute
      suggestions.push("⚡ ACCESSIBILITY: Réduire coût à 80-90 énergie pour plus d'utilisations");
    }
    
    if (metrics.clutchFactor < 40) {
      suggestions.push("🚨 CLUTCH: Ajouter bonus si équipe <50% HP (+100% efficacité)");
    }
    
    if (metrics.uniquenessIndex < 30) {
      suggestions.push("💎 UNIQUE: Créer mécaniques signature non-copiables");
    }
    
    // Suggestions d'équilibrage spécifiques
    const overallPower = this.calculateOverallPower(metrics);
    if (overallPower < 50) {
      suggestions.push(`📈 GLOBAL BUFF: Ultimate sous-performant, buff global de ${Math.round((60 - overallPower) * 2)}%`);
    }
    
    return suggestions.slice(0, 4); // Max 4 suggestions pour lisibilité
  }
  
  private generateComparativeAnalysis(): void {
    const results = Array.from(this.ultimateResults.values());
    
    // ✨ NOUVEAU : Classement par puissance globale
    results.sort((a, b) => b.overallPower - a.overallPower);
    results.forEach((result, index) => {
      result.comparisonRank = index + 1;
    });
    
    // ✨ NOUVEAU : Classement DPS spécialisé
    const damageUltimates = results.filter(r => r.category === "damage");
    const healUltimates = results.filter(r => r.category === "heal");
    const utilityUltimates = results.filter(r => r.category === "buff" || r.category === "debuff" || r.category === "control" || r.category === "utility");
    
    // Classer les ultimates de dégâts par DPS
    damageUltimates.sort((a, b) => b.dpsMetrics.averageDamagePerUse - a.dpsMetrics.averageDamagePerUse);
    damageUltimates.forEach((result, index) => {
      result.dpsMetrics.dpsRank = index + 1;
    });
    
    // Classer les ultimates de soin par HPS
    healUltimates.sort((a, b) => b.dpsMetrics.healingPerSecond - a.dpsMetrics.healingPerSecond);
    healUltimates.forEach((result, index) => {
      result.dpsMetrics.dpsRank = index + 1;
    });
    
    // Classer les ultimates utilitaires par score d'utilité
    utilityUltimates.sort((a, b) => b.dpsMetrics.utilityScore - a.dpsMetrics.utilityScore);
    utilityUltimates.forEach((result, index) => {
      result.dpsMetrics.dpsRank = index + 1;
    });
    
    // Calculer l'index d'unicité
    results.forEach(result => {
      const others = results.filter(r => r.spellId !== result.spellId);
      if (others.length > 0) {
        const avgRawImpact = others.reduce((sum, r) => sum + r.metrics.rawImpact, 0) / others.length;
        const avgGameChanging = others.reduce((sum, r) => sum + r.metrics.gameChangingScore, 0) / others.length;
        
        const impactDeviation = Math.abs(result.metrics.rawImpact - avgRawImpact) / Math.max(1, avgRawImpact);
        const gameChangingDeviation = Math.abs(result.metrics.gameChangingScore - avgGameChanging) / Math.max(1, avgGameChanging);
        
        result.metrics.uniquenessIndex = Math.min(100, (impactDeviation + gameChangingDeviation) * 50);
      }
    });
    
    console.log("   📊 Rangs globaux et DPS calculés");
    console.log(`   🏆 Top DPS: ${damageUltimates[0]?.spellName || 'N/A'} (${damageUltimates[0]?.dpsMetrics.averageDamagePerUse || 0} avg dmg)`);
    console.log(`   💚 Top HPS: ${healUltimates[0]?.spellName || 'N/A'} (${healUltimates[0]?.dpsMetrics.healingPerSecond || 0}/turn)`);
  }
  
  private generateUltimateReport(mode: "real" | "simulation"): any {
    const results = Array.from(this.ultimateResults.values());
    
    return {
      metadata: {
        timestamp: new Date().toISOString(),
        version: "1.0.5-final-fixed-complete",
        totalUltimatesAnalyzed: results.length,
        totalScenariosUsed: this.scenarios.length,
        analysisType: mode === "real" ? "Real Battle Analysis with 60s Combat" : "Simulation Analysis",
        mode
      },
      summary: {
        averageOverallPower: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.overallPower, 0) / results.length) : 0,
        averageDesignQuality: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.designQuality, 0) / results.length) : 0,
        averageBalanceRating: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.balanceRating, 0) / results.length) : 0,
        
        classificationBreakdown: {
          game_changer: results.filter(r => r.ultimateClass === "game_changer").length,
          finisher: results.filter(r => r.ultimateClass === "finisher").length,
          support: results.filter(r => r.ultimateClass === "support").length,
          situational: results.filter(r => r.ultimateClass === "situational").length,
          underwhelming: results.filter(r => r.ultimateClass === "underwhelming").length
        },
        
        balanceBreakdown: {
          balanced: results.filter(r => r.balanceStatus === "balanced").length,
          underpowered: results.filter(r => r.balanceStatus === "underpowered" || r.balanceStatus === "weak").length,
          overpowered: results.filter(r => r.balanceStatus === "overpowered" || r.balanceStatus === "broken").length
        }
      },
      ultimateAnalysis: results,
      scenarios: this.scenarios.map(s => ({
        name: s.name,
        description: s.description,
        weight: s.weight,
        focusMetric: s.focusMetric
      })),
      recommendations: this.generateGlobalUltimateRecommendations(results, mode)
    };
  }
  
  private generateGlobalUltimateRecommendations(results: UltimateAnalysisResult[], mode: "real" | "simulation"): any {
    const critical: string[] = [];
    const balance: string[] = [];
    const design: string[] = [];
    
    const criticalUltimates = results.filter(r => r.urgentFixes.length > 0);
    const lowAccessibility = results.filter(r => r.metrics.accessibilityScore < 30);
    const underwhelming = results.filter(r => r.ultimateClass === "underwhelming");
    
    if (criticalUltimates.length > 0) {
      critical.push(`${criticalUltimates.length} ultimates nécessitent des corrections urgentes`);
    }
    
    if (results.length > 0 && lowAccessibility.length > results.length * 0.4) {
      balance.push(`${lowAccessibility.length} ultimates sont rarement utilisés - problème systémique d'énergie`);
    }
    
    if (results.length > 0 && underwhelming.length > results.length * 0.3) {
      design.push(`${underwhelming.length} ultimates manquent d'impact - revoir le concept global`);
    }
    
    if (mode === "simulation") {
      design.push("Analyse en mode simulation - créer des ultimates réels pour tests complets");
    }
    
    return { critical, balance, design };
  }
  
  private saveReport(report: any): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `ultimate_analysis_${timestamp}.json`;
      const outputPath = path.join(process.cwd(), 'logs', 'balance', filename);
      
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
      console.log(`💾 Rapport ultimates sauvegardé: ${filename}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn("⚠️ Erreur sauvegarde rapport:", errorMessage);
    }
  }
  
  private displayUltimateFindings(mode: "real" | "simulation"): void {
    const results = Array.from(this.ultimateResults.values());
    
    console.log("⚡ === RÉSULTATS SPÉCIALISÉS ULTIMATES ===\n");
    
    if (results.length === 0) {
      console.log("❌ Aucun ultimate analysé");
      return;
    }
    
    const modeText = mode === "real" ? "🎮 Analyse complète avec BattleEngine" : "🔧 Analyse simulée (démo)";
    console.log(`Mode: ${modeText}\n`);
    
    // ✨ NOUVEAU : Dashboard d'alertes en priorité
    this.displayAlertsDashboard(results);
    
    // ✨ NOUVEAU : Résumé technique détaillé par ultimate
    console.log("📋 === RÉSUMÉS TECHNIQUES ===");
    results.forEach(ultimate => {
      console.log(`\n⚡ ${ultimate.spellName} (${ultimate.element} ${ultimate.category})`);
      console.log(`   🔧 Coût: ${ultimate.technicalSummary.energyCost} énergie | Usage: ${ultimate.technicalSummary.usageRate}% | Tour moy: ${ultimate.technicalSummary.averageTiming}`);
      console.log(`   📊 DPS Rating: ${ultimate.dpsMetrics.dpsRating}/100 | Dégâts moy: ${ultimate.dpsMetrics.averageDamagePerUse}`);
      console.log(`   💚 HPS: ${ultimate.dpsMetrics.healingPerSecond}/turn | Utilité: ${Math.round(ultimate.dpsMetrics.utilityScore)}`);
      // ✨ NOUVEAU : Métriques temps réel
      console.log(`   ⏱️ Usage 60s: ${ultimate.dpsMetrics.realTimeUsage}x | Fréq: ${ultimate.dpsMetrics.usageFrequency}/min`);
      console.log(`   🎯 DPS temps réel: ${ultimate.dpsMetrics.realTimeDPS}/min | HPS: ${ultimate.dpsMetrics.realTimeHPS}/min`);
      console.log(`   📝 ${ultimate.technicalSummary.effectDescription}`);
      
      // ✨ NOUVEAU : Afficher alertes pour cet ultimate
      this.displayUltimateAlerts(ultimate);
      
      // ✨ NOUVEAU : Afficher suggestions
      if (ultimate.designSuggestions.length > 0) {
        console.log(`   💡 Suggestions:`);
        ultimate.designSuggestions.forEach(suggestion => {
          console.log(`      ${suggestion}`);
        });
      }
      
      if (ultimate.urgentFixes.length > 0) {
        console.log(`   🚨 Fix urgent: ${ultimate.urgentFixes[0]}`);
      }
    });
    
    // ✨ NOUVEAU : Classement DPS par catégorie
    console.log("\n🏆 === CLASSEMENTS DPS ===");
    
    const damageUltimates = results.filter(r => r.category === "damage").sort((a, b) => b.dpsMetrics.averageDamagePerUse - a.dpsMetrics.averageDamagePerUse);
    if (damageUltimates.length > 0) {
      console.log("\n💥 TOP DAMAGE ULTIMATES:");
      damageUltimates.forEach((ultimate, i) => {
        console.log(`   ${i + 1}. ${ultimate.spellName}: ${ultimate.dpsMetrics.averageDamagePerUse} dmg/use (Rating: ${ultimate.dpsMetrics.dpsRating}/100)`);
        console.log(`      ⏱️ Temps réel: ${ultimate.dpsMetrics.realTimeDPS} DPS/min | ${ultimate.dpsMetrics.realTimeUsage} utilisations/60s`);
      });
    }
    
    const healUltimates = results.filter(r => r.category === "heal").sort((a, b) => b.dpsMetrics.healingPerSecond - a.dpsMetrics.healingPerSecond);
    if (healUltimates.length > 0) {
      console.log("\n💚 TOP HEALING ULTIMATES:");
      healUltimates.forEach((ultimate, i) => {
        console.log(`   ${i + 1}. ${ultimate.spellName}: ${ultimate.dpsMetrics.healingPerSecond} HPS (Rating: ${ultimate.dpsMetrics.dpsRating}/100)`);
        console.log(`      ⏱️ Temps réel: ${ultimate.dpsMetrics.realTimeHPS} HPS/min | ${ultimate.dpsMetrics.realTimeUsage} utilisations/60s`);
      });
    }
    
    const utilityUltimates = results.filter(r => r.category === "buff" || r.category === "debuff" || r.category === "control" || r.category === "utility")
      .sort((a, b) => b.dpsMetrics.utilityScore - a.dpsMetrics.utilityScore);
    if (utilityUltimates.length > 0) {
      console.log("\n🎯 TOP UTILITY ULTIMATES:");
      utilityUltimates.forEach((ultimate, i) => {
        console.log(`   ${i + 1}. ${ultimate.spellName}: ${Math.round(ultimate.dpsMetrics.utilityScore)} utilité (${ultimate.category})`);
        console.log(`      ⏱️ Fréquence: ${ultimate.dpsMetrics.usageFrequency}/min | ${ultimate.dpsMetrics.realTimeUsage} utilisations/60s`);
      });
    }
    
    // Classement global par puissance
    const topUltimates = results
      .sort((a, b) => b.overallPower - a.overallPower)
      .slice(0, Math.min(3, results.length));
    
    console.log("\n🏆 TOP ULTIMATES GLOBAUX:");
    topUltimates.forEach((ultimate, i) => {
      console.log(`   ${i + 1}. ${ultimate.spellName} (${ultimate.overallPower}/100) - ${ultimate.ultimateClass}`);
      console.log(`      💥 Impact: ${ultimate.metrics.rawImpact}/100 | 🎯 Game-changing: ${ultimate.metrics.gameChangingScore}/100`);
      console.log(`      📊 DPS: ${ultimate.dpsMetrics.averageDamagePerUse} | 💎 Rang DPS: #${ultimate.dpsMetrics.dpsRank} (${ultimate.category})`);
    });
    
    const problematic = results.filter(r => r.urgentFixes.length > 0);
    
    if (problematic.length > 0) {
      console.log("\n🚨 ULTIMATES PROBLÉMATIQUES:");
      problematic.forEach(ultimate => {
        console.log(`   ⚡ ${ultimate.spellName}: ${ultimate.balanceStatus} (${ultimate.overallPower}/100)`);
        if (ultimate.urgentFixes.length > 0) {
          console.log(`      🔧 ${ultimate.urgentFixes[0]}`);
        }
      });
    }
    
    // Statistiques globales
    const avgPower = Math.round(results.reduce((sum, r) => sum + r.overallPower, 0) / results.length);
    const balanced = results.filter(r => r.balanceStatus === "balanced").length;
    const avgAccessibility = Math.round(results.reduce((sum, r) => sum + r.metrics.accessibilityScore, 0) / results.length);
    const avgDps = Math.round(results.reduce((sum, r) => sum + r.dpsMetrics.averageDamagePerUse, 0) / results.length);
    const avgRealTimeUsage = Math.round((results.reduce((sum, r) => sum + r.dpsMetrics.realTimeUsage, 0) / results.length) * 10) / 10;
    
    // ✨ NOUVEAU : Statistiques d'alertes
    const totalAlerts = results.reduce((sum, r) => sum + r.alerts.length, 0);
    const criticalAlerts = results.reduce((sum, r) => sum + r.alerts.filter(a => a.level === "CRITICAL").length, 0);
    const balanceAlerts = results.reduce((sum, r) => sum + r.alerts.filter(a => a.level === "BALANCE").length, 0);
    
    console.log(`\n📈 SANTÉ GLOBALE DES ULTIMATES:`);
    console.log(`   ⚡ Puissance moyenne: ${avgPower}/100`);
    console.log(`   ⚖️ Équilibrés: ${balanced}/${results.length} (${Math.round(balanced/results.length*100)}%)`);
    console.log(`   🎯 Accessibilité moyenne: ${avgAccessibility}/100`);
    console.log(`   💥 DPS moyen: ${avgDps} dégâts/utilisation`);
    console.log(`   ⏱️ Usage 60s moyen: ${avgRealTimeUsage} utilisations/minute`);
    console.log(`   🚨 Alertes: ${totalAlerts} total (${criticalAlerts} critiques, ${balanceAlerts} balance)`);
    
    // ✨ NOUVEAU : Indicateur de santé globale
    const healthScore = Math.max(0, 100 - (criticalAlerts * 20) - (balanceAlerts * 5));
    const healthStatus = healthScore >= 80 ? "🟢 EXCELLENTE" : 
                        healthScore >= 60 ? "🟡 CORRECTE" :
                        healthScore >= 40 ? "🟠 PROBLÉMATIQUE" : "🔴 CRITIQUE";
    console.log(`   🏥 Santé globale: ${healthScore}/100 ${healthStatus}`);
    
    if (mode === "simulation") {
      console.log(`\n💡 PROCHAINES ÉTAPES:`);
      console.log(`   🎮 Créer des ultimates réels dans gameplay/ultimates/`);
      console.log(`   🔗 Le module se connectera automatiquement au SpellManager`);
      console.log(`   ⚡ Relancer l'analyse pour tests avec BattleEngine`);
    }
    
    console.log("");
  }
  
  // ✨ NOUVEAU : Dashboard d'alertes centralisé
  private displayAlertsDashboard(results: UltimateAnalysisResult[]): void {
    const allAlerts = results.flatMap(r => r.alerts.map(alert => ({ ...alert, ultimateName: r.spellName })));
    
    if (allAlerts.length === 0) {
      console.log("✅ === DASHBOARD ALERTES ===");
      console.log("✅ Aucune alerte détectée - Tous les ultimates sont dans les normes !\n");
      return;
    }
    
    const criticalAlerts = allAlerts.filter(a => a.level === "CRITICAL");
    const balanceAlerts = allAlerts.filter(a => a.level === "BALANCE");
    const designAlerts = allAlerts.filter(a => a.level === "DESIGN");
    
    console.log("🚨 === DASHBOARD ALERTES AUTOMATIQUES ===");
    console.log(`Total: ${allAlerts.length} alertes | 🚨 ${criticalAlerts.length} Critiques | ⚖️ ${balanceAlerts.length} Balance | 💡 ${designAlerts.length} Design\n`);
    
    // Alertes critiques (priorité absolue)
    if (criticalAlerts.length > 0) {
      console.log("🚨 ALERTES CRITIQUES (Fix immédiat requis):");
      criticalAlerts
        .sort((a, b) => a.priority - b.priority)
        .forEach(alert => {
          console.log(`   ⚡ ${alert.ultimateName}: ${alert.message}`);
          if (alert.autoFix) {
            console.log(`      🔧 FIX AUTO: ${alert.autoFix}`);
          }
        });
      console.log("");
    }
    
    // Alertes balance (ajustements recommandés)
    if (balanceAlerts.length > 0) {
      console.log("⚖️ ALERTES BALANCE (Ajustements recommandés):");
      balanceAlerts
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 5) // Top 5 pour éviter spam
        .forEach(alert => {
          console.log(`   ⚡ ${alert.ultimateName}: ${alert.message}`);
          if (alert.suggestion) {
            console.log(`      💡 SUGGESTION: ${alert.suggestion}`);
          }
        });
      if (balanceAlerts.length > 5) {
        console.log(`   ... et ${balanceAlerts.length - 5} autres alertes balance`);
      }
      console.log("");
    }
    
    // Alertes design (améliorations futures) - seulement les plus importantes
    if (designAlerts.length > 0) {
      const topDesignAlerts = designAlerts
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 3); // Top 3 seulement
      
      console.log("💡 ALERTES DESIGN (Améliorations prioritaires):");
      topDesignAlerts.forEach(alert => {
        console.log(`   ⚡ ${alert.ultimateName}: ${alert.message}`);
        if (alert.suggestion) {
          console.log(`      📈 AMÉLIORATION: ${alert.suggestion}`);
        }
      });
      console.log("");
    }
    
    // Résumé des priorités
    const urgentCount = criticalAlerts.length + balanceAlerts.filter(a => a.priority <= 2).length;
    if (urgentCount > 0) {
      console.log(`🎯 PRIORITÉ: ${urgentCount} alertes urgentes nécessitent une attention immédiate\n`);
    }
  }
  
  // ✨ NOUVEAU : Affichage des alertes spécifiques à un ultimate
  private displayUltimateAlerts(ultimate: UltimateAnalysisResult): void {
    if (ultimate.alerts.length === 0) return;
    
    const criticalAlerts = ultimate.alerts.filter(a => a.level === "CRITICAL");
    const balanceAlerts = ultimate.alerts.filter(a => a.level === "BALANCE");
    
    // Afficher seulement les alertes critiques et balance urgentes
    const urgentAlerts = [
      ...criticalAlerts,
      ...balanceAlerts.filter(a => a.priority <= 2)
    ];
    
    if (urgentAlerts.length > 0) {
      console.log(`   🚨 ALERTES (${urgentAlerts.length}):`);
      urgentAlerts.forEach(alert => {
        const icon = alert.level === "CRITICAL" ? "🚨" : "⚖️";
        console.log(`      ${icon} ${alert.message}`);
        if (alert.autoFix) {
          console.log(`         🔧 ${alert.autoFix}`);
        } else if (alert.suggestion) {
          console.log(`         💡 ${alert.suggestion}`);
        }
      });
    }
  }
}

// ===== EXPORT DE LA FONCTION PRINCIPALE =====

export async function runUltimateAnalysis(): Promise<void> {
  const analyzer = new UltimateAnalyzer();
  await analyzer.initialize();
  await analyzer.runCompleteAnalysis();
}

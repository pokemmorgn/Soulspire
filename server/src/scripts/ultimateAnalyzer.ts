// modules/ultimateAnalyzer.ts - Module spécialisé pour l'analyse des ultimates
import mongoose from "mongoose";
import * as fs from "fs";
import * as path from "path";
import { BattleEngine, IBattleOptions } from "../../services/BattleEngine";
import { SpellManager, HeroSpells } from "../../gameplay/SpellManager";
import { EffectManager } from "../../gameplay/EffectManager";
import { PassiveManager } from "../../gameplay/PassiveManager";
import { IBattleParticipant, IBattleResult } from "../../models/Battle";

// ===== INTERFACES SPÉCIALISÉES ULTIMATES =====

interface UltimateSpell {
  config: {
    id: string;
    name: string;
    type: "ultimate";
    category: string;
    element?: string;
  };
  getEnergyCost(level: number): number;
  getEffectiveCooldown(caster: any, level: number): number;
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

interface UltimateAnalysisResult {
  spellId: string;
  spellName: string;
  element: string;
  metrics: UltimateMetrics;
  
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
      "control": { hp: 0.9, atk: 0.8, def: 1.0, speed: 1.4 }
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

// ===== GÉNÉRATEUR DE SCÉNARIOS ULTIMATES =====

class UltimateScenarioGenerator {
  
  static generateSpecializedScenarios(): UltimateTestScenario[] {
    return [
      this.createClutchScenario(),
      this.createBossSlayerScenario(), 
      this.createTeamFightScenario(),
      this.createLateGameScenario(),
      this.createSurvivalScenario(),
      this.createBurstTestScenario()
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
      description: "Combat d'équipe 5v5 équilibré",
      setupTeam: (ultimateSpell: UltimateSpell) => {
        const carrier = UltimateHeroFactory.createUltimateCarrier({
          ultimateSpell,
          level: 45,
          element: "Light",
          startingEnergy: 80
        });
        
        const team = UltimateHeroFactory.createSupportTeam(45);
        team.push({
          heroId: `extra_dps_${Date.now()}`,
          name: "Extra DPS",
          position: 3,
          role: "DPS Melee",
          element: "Wind",
          rarity: "Epic",
          level: 44,
          stars: 4,
          stats: { hp: 5200, maxHp: 5200, atk: 340, def: 190, speed: 88 },
          currentHp: 5200,
          energy: 0,
          status: { alive: true, buffs: [], debuffs: [] }
        });
        
        team.push({
          heroId: `extra_support_${Date.now()}`,
          name: "Extra Support",
          position: 4,
          role: "Support",
          element: "Electric",
          rarity: "Rare",
          level: 43,
          stars: 3,
          stats: { hp: 4000, maxHp: 4000, atk: 200, def: 170, speed: 92 },
          currentHp: 4000,
          energy: 0,
          status: { alive: true, buffs: [], debuffs: [] }
        });
        
        return [carrier, ...team];
      },
      setupEnemies: () => {
        const enemies = UltimateHeroFactory.createChallengingEnemies(46, "medium");
        // Ajouter plus d'ennemis pour 5v5
        enemies.push({
          heroId: `enemy_3_${Date.now()}`,
          name: "Enemy Support",
          position: 3,
          role: "Support",
          element: "Dark",
          rarity: "Epic",
          level: 45,
          stars: 4,
          stats: { hp: 4500, maxHp: 4500, atk: 230, def: 200, speed: 90 },
          currentHp: 4500,
          energy: 0,
          status: { alive: true, buffs: [], debuffs: [] }
        });
        
        enemies.push({
          heroId: `enemy_4_${Date.now()}`,
          name: "Enemy DPS 2",
          position: 4,
          role: "DPS Melee",
          element: "Water",
          rarity: "Epic",
          level: 44,
          stars: 4,
          stats: { hp: 5000, maxHp: 5000, atk: 350, def: 180, speed: 85 },
          currentHp: 5000,
          energy: 0,
          status: { alive: true, buffs: [], debuffs: [] }
        });
        
        enemies.push({
          heroId: `enemy_5_${Date.now()}`,
          name: "Enemy Mage",
          position: 5,
          role: "DPS Ranged",
          element: "Wind",
          rarity: "Rare",
          level: 43,
          stars: 3,
          stats: { hp: 3800, maxHp: 3800, atk: 320, def: 150, speed: 100 },
          currentHp: 3800,
          energy: 0,
          status: { alive: true, buffs: [], debuffs: [] }
        });
        
        return enemies;
      },
      specialConditions: {
        startingEnergy: 80,
        turnLimit: 15
      },
      expectedOutcome: "ultimate_wins",
      weight: 1.5,
      focusMetric: "teamSynergyAmplification"
    };
  }
  
  private static createLateGameScenario(): UltimateTestScenario {
    return {
      name: "Late Game Scaling",
      description: "Test de scaling niveau 60+ vs ennemis puissants",
      setupTeam: (ultimateSpell: UltimateSpell) => {
        const carrier = UltimateHeroFactory.createUltimateCarrier({
          ultimateSpell,
          level: 65,
          element: "Dark",
          startingEnergy: 100
        });
        
        return [carrier, ...UltimateHeroFactory.createSupportTeam(63)];
      },
      setupEnemies: () => UltimateHeroFactory.createChallengingEnemies(67, "hard"),
      specialConditions: {
        startingEnergy: 100,
        turnLimit: 20
      },
      expectedOutcome: "ultimate_wins",
      weight: 1.3,
      focusMetric: "scalingPotential"
    };
  }
  
  private static createSurvivalScenario(): UltimateTestScenario {
    return {
      name: "Survival Ultimate",
      description: "Ultimate défensif - doit faire survivre l'équipe",
      setupTeam: (ultimateSpell: UltimateSpell) => {
        return [UltimateHeroFactory.createUltimateCarrier({
          ultimateSpell,
          level: 35,
          element: "Water",
          startingEnergy: 100
        })];
      },
      setupEnemies: () => {
        // Beaucoup d'ennemis avec burst damage
        const enemies = UltimateHeroFactory.createChallengingEnemies(38, "medium");
        enemies.push(...UltimateHeroFactory.createChallengingEnemies(36, "medium"));
        return enemies;
      },
      specialConditions: {
        startingEnergy: 100,
        turnLimit: 25,
        forcedTiming: 3
      },
      expectedOutcome: "close_fight",
      weight: 1.4,
      focusMetric: "gameChangingScore"
    };
  }
  
  private static createBurstTestScenario(): UltimateTestScenario {
    return {
      name: "Pure Burst Test",
      description: "Test de burst pur - dégâts maximum instantané",
      setupTeam: (ultimateSpell: UltimateSpell) => {
        const carrier = UltimateHeroFactory.createUltimateCarrier({
          ultimateSpell,
          level: 40,
          element: "Fire",
          startingEnergy: 100
        });
        
        // Team glass cannon pour maximiser les dégâts
        carrier.stats.atk *= 1.5;
        carrier.stats.hp *= 0.7;
        carrier.currentHp = carrier.stats.hp;
        
        return [carrier];
      },
      setupEnemies: () => {
        const dummy = UltimateHeroFactory.createChallengingEnemies(40, "medium")[0];
        // Tank dummy avec beaucoup de PV pour mesurer les dégâts
        dummy.stats.hp *= 3;
        dummy.currentHp = dummy.stats.hp;
        dummy.stats.maxHp = dummy.stats.hp;
        dummy.stats.atk = 1; // Quasi pas de dégâts pour focus sur l'ultimate
        return [dummy];
      },
      specialConditions: {
        startingEnergy: 100,
        turnLimit: 5,
        forcedTiming: 1
      },
      expectedOutcome: "ultimate_wins",
      weight: 1.2,
      focusMetric: "rawImpact"
    };
  }
}

// ===== ANALYSEUR SPÉCIALISÉ ULTIMATES =====

class UltimateAnalyzer {
  
  private scenarios: UltimateTestScenario[];
  private ultimateResults: Map<string, UltimateAnalysisResult> = new Map();
  
  constructor() {
    this.scenarios = UltimateScenarioGenerator.generateSpecializedScenarios();
  }
  
  async initialize(): Promise<void> {
    console.log("⚡ Initialisation de l'analyseur d'ultimates...");
    await SpellManager.initialize();
    await EffectManager.initialize();
    await PassiveManager.initialize();
    console.log("✅ Analyseur d'ultimates prêt");
  }
  
  async runCompleteAnalysis(): Promise<void> {
    console.log("\n⚡ === ANALYSE SPÉCIALISÉE DES ULTIMATES ===\n");
    
    const startTime = Date.now();
    const ultimateSpells = this.getUltimateSpells();
    
    console.log(`🎯 Analyse de ${ultimateSpells.length} ultimates sur ${this.scenarios.length} scénarios spécialisés\n`);
    
    if (ultimateSpells.length === 0) {
      console.log("⚠️ Aucun ultimate trouvé dans le système");
      return;
    }
    
    // Phase 1: Tests individuels
    console.log("🔬 Phase 1: Tests de performance individuels...");
    for (const ultimate of ultimateSpells) {
      await this.analyzeUltimatePerformance(ultimate);
      process.stdout.write('⚡');
    }
    console.log(" ✅\n");
    
    // Phase 2: Analyse comparative
    console.log("📊 Phase 2: Analyse comparative des ultimates...");
    this.generateComparativeAnalysis();
    console.log("✅\n");
    
    // Phase 3: Rapport spécialisé
    console.log("📋 Phase 3: Génération du rapport ultimates...");
    const report = this.generateUltimateReport();
    this.saveReport(report);
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏱️ Analyse ultimates terminée en ${duration}s\n`);
    
    this.displayUltimateFindings();
  }
  
  private getUltimateSpells(): UltimateSpell[] {
    const allSpells = SpellManager.getAllSpells();
    return allSpells
      .filter((spell: any) => spell.config.type === "ultimate")
      .map((spell: any) => spell as UltimateSpell);
  }
  
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
      const result = await this.testUltimateInScenario(ultimateSpell, scenario);
      scenarioResults[scenario.name] = result;
      
      // Agréger performance globale
      performanceAggregator.total += result.performance * scenario.weight;
      performanceAggregator.count += scenario.weight;
      
      // Mettre à jour la métrique focus du scénario
      this.updateSpecificMetric(metrics, result, scenario);
    }
    
    // Calculer métriques dérivées
    this.calculateDerivedMetrics(metrics, scenarioResults, ultimateSpell);
    
    // Générer l'analyse finale
    const analysis: UltimateAnalysisResult = {
      spellId: ultimateSpell.config.id,
      spellName: ultimateSpell.config.name,
      element: ultimateSpell.config.element || "None",
      metrics,
      overallPower: this.calculateOverallPower(metrics),
      designQuality: this.calculateDesignQuality(metrics, ultimateSpell),
      balanceRating: this.calculateBalanceRating(metrics, ultimateSpell),
      ultimateClass: this.classifyUltimate(metrics),
      optimalTiming: this.determineOptimalTiming(metrics, scenarioResults),
      bestUseCase: this.determineBestUseCase(scenarioResults),
      balanceStatus: this.determineUltimateBalanceStatus(metrics),
      urgentFixes: this.generateUrgentFixes(metrics, ultimateSpell),
      designSuggestions: this.generateDesignSuggestions(metrics, ultimateSpell),
      scenarioResults,
      comparisonRank: 0 // Will be set during comparative analysis
    };
    
    this.ultimateResults.set(ultimateSpell.config.id, analysis);
  }
  
  private async testUltimateInScenario(ultimateSpell: UltimateSpell, scenario: UltimateTestScenario): Promise<any> {
    try {
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
      
    } catch (error) {
      console.warn(`⚠️ Erreur test ultimate ${ultimateSpell.config.id} dans ${scenario.name}: ${error}`);
      return {
        performance: 0,
        impact: "error",
        notes: [`Erreur: ${error}`],
        ultimateUsed: false,
        damageDealt: 0,
        gameChanging: false
      };
    }
  }
  
  private analyzeUltimateCombatResult(
    battleResult: IBattleResult,
    actions: any[],
    carrierId: string,
    ultimateSpell: UltimateSpell,
    scenario: UltimateTestScenario
  ): any {
    
    const ultimateActions = actions.filter(action => 
      action.actorId === carrierId && 
      action.spellId === ultimateSpell.config.id
    );
    
    const ultimateUsed = ultimateActions.length > 0;
    const ultimateDamage = ultimateActions.reduce((sum, action) => sum + (action.damage || 0), 0);
    const ultimateHealing = ultimateActions.reduce((sum, action) => sum + (action.healing || 0), 0);
    
    // Calculer l'impact de l'ultimate
    const totalPlayerDamage = actions
      .filter(action => action.team === "player")
      .reduce((sum, action) => sum + (action.damage || 0), 0);
    
    const ultimateContribution = totalPlayerDamage > 0 ? ultimateDamage / totalPlayerDamage : 0;
    
    // Analyser si l'ultimate a changé le cours du combat
    const gameChanging = this.detectGameChangingMoment(actions, ultimateActions, battleResult);
    
    // Score de performance adapté aux ultimates
    let performance = 30; // Base
    
    if (ultimateUsed) {
      performance += 30; // Bonus gros pour utilisation
      
      // Bonus selon l'impact
      performance += Math.min(25, ultimateContribution * 50);
      
      // Bonus si game-changing
      if (gameChanging) performance += 15;
      
      // Bonus selon le résultat attendu
      if (battleResult.victory) {
        if (scenario.expectedOutcome === "ultimate_wins") performance += 20;
        if (scenario.expectedOutcome === "close_fight") performance += 10;
      }
      
      // Bonus/malus selon le timing
      if (scenario.specialConditions.forcedTiming) {
        const ultimateTurn = ultimateActions[0]?.turn || 999;
        const expectedTurn = scenario.specialConditions.forcedTiming;
        const timingDiff = Math.abs(ultimateTurn - expectedTurn);
        performance += Math.max(0, 10 - timingDiff * 2);
      }
      
    } else {
      // Ultimate non utilisé - très problématique
      performance = 5;
    }
    
    // Classification de l'impact
    let impact = "minimal";
    if (gameChanging) impact = "game_changing";
    else if (ultimateContribution > 0.7) impact = "dominant";
    else if (ultimateContribution > 0.4) impact = "major";
    else if (ultimateContribution > 0.2) impact = "moderate";
    else if (ultimateUsed) impact = "minor";
    
    const notes: string[] = [];
    if (!ultimateUsed) notes.push("Ultimate jamais utilisé - problème critique");
    if (gameChanging) notes.push("Ultimate a changé le cours du combat");
    if (ultimateContribution > 0.8) notes.push("Contribution ultra-dominante");
    if (battleResult.victory && ultimateDamage === 0 && ultimateHealing === 0) {
      notes.push("Victoire sans impact mesurable de l'ultimate");
    }
    
    return {
      performance: Math.max(0, Math.min(100, performance)),
      impact,
      notes,
      ultimateUsed,
      damageDealt: ultimateDamage,
      healingDone: ultimateHealing,
      gameChanging,
      contribution: ultimateContribution,
      battleDuration: battleResult.totalTurns,
      victory: battleResult.victory,
      timing: ultimateActions[0]?.turn || null
    };
  }
  
  private detectGameChangingMoment(actions: any[], ultimateActions: any[], battleResult: IBattleResult): boolean {
    if (ultimateActions.length === 0) return false;
    
    const ultimateTurn = ultimateActions[0].turn;
    
    // Analyser la situation avant/après l'ultimate
    const actionsBeforeUlt = actions.filter(a => a.turn < ultimateTurn);
    const actionsAfterUlt = actions.filter(a => a.turn > ultimateTurn);
    
    // Simple heuristique: si le ratio de dégâts change drastiquement
    const playerDmgBefore = actionsBeforeUlt
      .filter(a => a.team === "player")
      .reduce((sum, a) => sum + (a.damage || 0), 0);
    
    const playerDmgAfter = actionsAfterUlt
      .filter(a => a.team === "player")
      .reduce((sum, a) => sum + (a.damage || 0), 0);
    
    const enemyDmgBefore = actionsBeforeUlt
      .filter(a => a.team === "enemy")
      .reduce((sum, a) => sum + (a.damage || 0), 0);
    
    const enemyDmgAfter = actionsAfterUlt
      .filter(a => a.team === "enemy")
      .reduce((sum, a) => sum + (a.damage || 0), 0);
    
    // Si l'ultimate a significativement changé la balance
    const ratioBefore = playerDmgBefore / Math.max(1, enemyDmgBefore);
    const ratioAfter = playerDmgAfter / Math.max(1, enemyDmgAfter);
    
    return (ratioAfter / Math.max(0.1, ratioBefore)) > 2.0; // Ratio x2 minimum
  }
  
  private updateSpecificMetric(metrics: UltimateMetrics, result: any, scenario: UltimateTestScenario): void {
    const performance = result.performance;
    const focusMetric = scenario.focusMetric;
    
    // Mise à jour directe de la métrique focus
    (metrics as any)[focusMetric] = performance;
    
    // Mise à jour des métriques connexes selon le scénario
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
        
      case "Late Game Scaling":
        metrics.scalingPotential = performance;
        break;
        
      case "Survival Ultimate":
        metrics.gameChangingScore = Math.max(metrics.gameChangingScore, performance);
        break;
        
      case "Pure Burst Test":
        metrics.rawImpact = Math.max(metrics.rawImpact, performance);
        break;
    }
  }
  
  private calculateDerivedMetrics(metrics: UltimateMetrics, scenarioResults: Record<string, any>, ultimateSpell: UltimateSpell): void {
    // Efficacité énergétique basée sur le coût vs l'impact
    const energyCost = ultimateSpell.getEnergyCost(5);
    metrics.energyEfficiency = Math.max(0, 100 - (energyCost - 100) * 2 + metrics.rawImpact * 0.5);
    
    // Optimisation du timing basée sur les résultats de timing
    const timingResults = Object.values(scenarioResults)
      .filter((result: any) => result.timing !== null)
      .map((result: any) => result.performance);
    
    metrics.timingOptimization = timingResults.length > 0 
      ? timingResults.reduce((sum, perf) => sum + perf, 0) / timingResults.length
      : 50;
    
    // Accessibilité basée sur la fréquence d'utilisation
    const usageRate = Object.values(scenarioResults)
      .filter((result: any) => result.ultimateUsed).length / Object.keys(scenarioResults).length;
    
    metrics.accessibilityScore = usageRate * 100;
    
    // Résistance aux contres (basée sur la variabilité des performances)
    const performances = Object.values(scenarioResults).map((result: any) => result.performance);
    const avgPerformance = performances.reduce((sum, perf) => sum + perf, 0) / performances.length;
    const variance = performances.reduce((sum, perf) => sum + Math.pow(perf - avgPerformance, 2), 0) / performances.length;
    metrics.counterPlayResistance = Math.max(0, 100 - variance);
    
    // Index d'unicité (placeholder - nécessiterait comparaison avec autres ultimates)
    metrics.uniquenessIndex = 50; // Will be calculated in comparative analysis
  }
  
  private calculateOverallPower(metrics: UltimateMetrics): number {
    return Math.round(
      metrics.rawImpact * 0.25 +
      metrics.gameChangingScore * 0.25 +
      metrics.clutchFactor * 0.15 +
      metrics.soloCarryPotential * 0.15 +
      metrics.teamSynergyAmplification * 0.10 +
      metrics.scalingPotential * 0.10
    );
  }
  
  private calculateDesignQuality(metrics: UltimateMetrics, ultimateSpell: UltimateSpell): number {
    let score = 50;
    
    // Bonus pour forte identité
    if (metrics.rawImpact > 70 || metrics.gameChangingScore > 70) score += 20;
    
    // Bonus pour bon timing
    if (metrics.timingOptimization > 60) score += 15;
    
    // Bonus pour unicité
    if (metrics.uniquenessIndex > 60) score += 10;
    
    // Malus pour inaccessibilité
    if (metrics.accessibilityScore < 30) score -= 25;
    
    // Malus pour manque de clutch factor
    if (metrics.clutchFactor < 25) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }
  
  private calculateBalanceRating(metrics: UltimateMetrics, ultimateSpell: UltimateSpell): number {
    const targetPower = 70; // Cible pour un ultimate équilibré
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
    
    if (accessibility < 20) return "underpowered"; // Inutilisable
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
    
    if (metrics.clutchFactor < 15) {
      fixes.push("Inefficace en situation critique - ajouter effets situationnels");
    }
    
    const overallPower = this.calculateOverallPower(metrics);
    if (overallPower > 90) {
      fixes.push("NERF REQUIS: Ultimate trop puissant - réduire impact de 15-25%");
    }
    
    return fixes;
  }
  
  private generateDesignSuggestions(metrics: UltimateMetrics, ultimateSpell: UltimateSpell): string[] {
    const suggestions: string[] = [];
    
    if (metrics.uniquenessIndex < 40) {
      suggestions.push("Ajouter des mécaniques uniques pour différencier cet ultimate");
    }
    
    if (metrics.teamSynergyAmplification < 30) {
      suggestions.push("Considérer des effets de synergie avec les alliés");
    }
    
    if (metrics.scalingPotential < 35) {
      suggestions.push("Améliorer le scaling late game ou ajouter des effets percentage-based");
    }
    
    if (metrics.versatilityScore < 25) {
      suggestions.push("Élargir les cas d'usage - ajouter des effets polyvalents");
    }
    
    if (metrics.counterPlayResistance < 40) {
      suggestions.push("Ajouter de la résistance aux contres ou des conditions d'activation variées");
    }
    
    return suggestions;
  }
  
  private generateComparativeAnalysis(): void {
    const results = Array.from(this.ultimateResults.values());
    
    // Calculer les rangs
    results.sort((a, b) => b.overallPower - a.overallPower);
    results.forEach((result, index) => {
      result.comparisonRank = index + 1;
    });
    
    // Calculer l'index d'unicité relatif
    results.forEach(result => {
      const others = results.filter(r => r.spellId !== result.spellId);
      const avgRawImpact = others.reduce((sum, r) => sum + r.metrics.rawImpact, 0) / others.length;
      const avgGameChanging = others.reduce((sum, r) => sum + r.metrics.gameChangingScore, 0) / others.length;
      
      const impactDeviation = Math.abs(result.metrics.rawImpact - avgRawImpact) / avgRawImpact;
      const gameChangingDeviation = Math.abs(result.metrics.gameChangingScore - avgGameChanging) / avgGameChanging;
      
      result.metrics.uniquenessIndex = Math.min(100, (impactDeviation + gameChangingDeviation) * 50);
    });
    
    console.log("   📊 Rangs et unicité calculés");
  }
  
  private generateUltimateReport(): any {
    const results = Array.from(this.ultimateResults.values());
    
    return {
      metadata: {
        timestamp: new Date().toISOString(),
        version: "1.0.0-ultimate-specialist",
        totalUltimatesAnalyzed: results.length,
        totalScenariosUsed: this.scenarios.length,
        analysisType: "Ultimate Specialized Analysis"
      },
      summary: {
        averageOverallPower: Math.round(results.reduce((sum, r) => sum + r.overallPower, 0) / results.length),
        averageDesignQuality: Math.round(results.reduce((sum, r) => sum + r.designQuality, 0) / results.length),
        averageBalanceRating: Math.round(results.reduce((sum, r) => sum + r.balanceRating, 0) / results.length),
        
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
      recommendations: this.generateGlobalUltimateRecommendations(results)
    };
  }
  
  private generateGlobalUltimateRecommendations(results: UltimateAnalysisResult[]): any {
    const critical: string[] = [];
    const balance: string[] = [];
    const design: string[] = [];
    
    const criticalUltimates = results.filter(r => r.urgentFixes.length > 0);
    const lowAccessibility = results.filter(r => r.metrics.accessibilityScore < 30);
    const underwhelming = results.filter(r => r.ultimateClass === "underwhelming");
    
    if (criticalUltimates.length > 0) {
      critical.push(`${criticalUltimates.length} ultimates nécessitent des corrections urgentes`);
    }
    
    if (lowAccessibility.length > results.length * 0.4) {
      balance.push(`${lowAccessibility.length} ultimates sont rarement utilisés - problème systémique d'énergie`);
    }
    
    if (underwhelming.length > results.length * 0.3) {
      design.push(`${underwhelming.length} ultimates manquent d'impact - revoir le concept global`);
    }
    
    const avgUniqueness = results.reduce((sum, r) => sum + r.metrics.uniquenessIndex, 0) / results.length;
    if (avgUniqueness < 40) {
      design.push("Ultimates trop similaires - diversifier les mécaniques uniques");
    }
    
    return { critical, balance, design };
  }
  
  private saveReport(report: any): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `ultimate_analysis_${timestamp}.json`;
    const outputPath = path.join(process.cwd(), 'logs', 'balance', filename);
    
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`💾 Rapport ultimates sauvegardé: ${filename}`);
  }
  
  private displayUltimateFindings(): void {
    const results = Array.from(this.ultimateResults.values());
    
    console.log("⚡ === RÉSULTATS SPÉCIALISÉS ULTIMATES ===\n");
    
    // Top 3 ultimates
    const topUltimates = results
      .sort((a, b) => b.overallPower - a.overallPower)
      .slice(0, 3);
    
    console.log("🏆 TOP 3 ULTIMATES:");
    topUltimates.forEach((ultimate, i) => {
      console.log(`   ${i + 1}. ${ultimate.spellName} (${ultimate.overallPower}/100) - ${ultimate.ultimateClass}`);
      console.log(`      💥 Impact: ${ultimate.metrics.rawImpact}/100 | 🎯 Game-changing: ${ultimate.metrics.gameChangingScore}/100`);
    });
    
    // Ultimates problématiques
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
    
    // Classification overview
    console.log("\n📊 RÉPARTITION DES CLASSES:");
    const classCount = results.reduce((count, r) => {
      count[r.ultimateClass] = (count[r.ultimateClass] || 0) + 1;
      return count;
    }, {} as Record<string, number>);
    
    Object.entries(classCount).forEach(([className, count]) => {
      const percentage = Math.round((count / results.length) * 100);
      console.log(`   ${className}: ${count}/${results.length} (${percentage}%)`);
    });
    
    // Statistiques globales
    const avgPower = Math.round(results.reduce((sum, r) => sum + r.overallPower, 0) / results.length);
    const balanced = results.filter(r => r.balanceStatus === "balanced").length;
    const avgAccessibility = Math.round(results.reduce((sum, r) => sum + r.metrics.accessibilityScore, 0) / results.length);
    
    console.log(`\n📈 SANTÉ GLOBALE DES ULTIMATES:`);
    console.log(`   ⚡ Puissance moyenne: ${avgPower}/100`);
    console.log(`   ⚖️ Équilibrés: ${balanced}/${results.length} (${Math.round(balanced/results.length*100)}%)`);
    console.log(`   🎯 Accessibilité moyenne: ${avgAccessibility}/100`);
    console.log("");
  }
}

// ===== EXPORT DE LA FONCTION PRINCIPALE =====

export async function runUltimateAnalysis(): Promise<void> {
  const analyzer = new UltimateAnalyzer();
  await analyzer.initialize();
  await analyzer.runCompleteAnalysis();
}

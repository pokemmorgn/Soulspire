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

// ===== GÉNÉRATEUR DE SCÉNARIOS ULTIMATES SIMPLIFIÉS =====

class UltimateScenarioGenerator {
  
  static generateSpecializedScenarios(): UltimateTestScenario[] {
    return [
      this.createClutchScenario(),
      this.createBossSlayerScenario(), 
      this.createTeamFightScenario()
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
        victory: Math.random() > 0.3
      };
    });
    
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
      comparisonRank: 0
    };
    
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
          ultimateUsed: false
        };
      }
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
      comparisonRank: 0
    };
    
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
    // On va utiliser actorId pour déterminer l'équipe
    const playerTeamIds = scenario.setupTeam(ultimateSpell).map(p => p.heroId);
    
    const totalPlayerDamage = actions
      .filter(action => playerTeamIds.includes(action.actorId))
      .reduce((sum, action) => sum + (action.damage || 0), 0);
    
    const ultimateContribution = totalPlayerDamage > 0 ? ultimateDamage / totalPlayerDamage : 0;
    
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
    
    return {
      performance: Math.max(0, Math.min(100, performance)),
      impact,
      notes,
      ultimateUsed,
      damageDealt: ultimateDamage,
      healingDone: ultimateHealing,
      gameChanging: ultimateContribution > 0.5,
      contribution: ultimateContribution,
      battleDuration: battleResult.totalTurns,
      victory: battleResult.victory,
      timing: ultimateActions[0]?.turn || null
    };
  }
  
  // ===== MÉTHODES UTILITAIRES =====
  
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
    
    return suggestions;
  }
  
  private generateComparativeAnalysis(): void {
    const results = Array.from(this.ultimateResults.values());
    
    results.sort((a, b) => b.overallPower - a.overallPower);
    results.forEach((result, index) => {
      result.comparisonRank = index + 1;
    });
    
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
    
    console.log("   📊 Rangs et unicité calculés");
  }
  
  private generateUltimateReport(mode: "real" | "simulation"): any {
    const results = Array.from(this.ultimateResults.values());
    
    return {
      metadata: {
        timestamp: new Date().toISOString(),
        version: "1.0.4-final-fixed",
        totalUltimatesAnalyzed: results.length,
        totalScenariosUsed: this.scenarios.length,
        analysisType: mode === "real" ? "Real Battle Analysis" : "Simulation Analysis",
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
    
    const topUltimates = results
      .sort((a, b) => b.overallPower - a.overallPower)
      .slice(0, Math.min(3, results.length));
    
    console.log("🏆 TOP ULTIMATES:");
    topUltimates.forEach((ultimate, i) => {
      console.log(`   ${i + 1}. ${ultimate.spellName} (${ultimate.overallPower}/100) - ${ultimate.ultimateClass}`);
      console.log(`      💥 Impact: ${ultimate.metrics.rawImpact}/100 | 🎯 Game-changing: ${ultimate.metrics.gameChangingScore}/100`);
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
    
    const avgPower = Math.round(results.reduce((sum, r) => sum + r.overallPower, 0) / results.length);
    const balanced = results.filter(r => r.balanceStatus === "balanced").length;
    const avgAccessibility = Math.round(results.reduce((sum, r) => sum + r.metrics.accessibilityScore, 0) / results.length);
    
    console.log(`\n📈 SANTÉ GLOBALE DES ULTIMATES:`);
    console.log(`   ⚡ Puissance moyenne: ${avgPower}/100`);
    console.log(`   ⚖️ Équilibrés: ${balanced}/${results.length} (${Math.round(balanced/results.length*100)}%)`);
    console.log(`   🎯 Accessibilité moyenne: ${avgAccessibility}/100`);
    
    if (mode === "simulation") {
      console.log(`\n💡 PROCHAINES ÉTAPES:`);
      console.log(`   🎮 Créer des ultimates réels dans gameplay/ultimates/`);
      console.log(`   🔗 Le module se connectera automatiquement au SpellManager`);
      console.log(`   ⚡ Relancer l'analyse pour tests avec BattleEngine`);
    }
    
    console.log("");
  }
}

// ===== EXPORT DE LA FONCTION PRINCIPALE =====

export async function runUltimateAnalysis(): Promise<void> {
  const analyzer = new UltimateAnalyzer();
  await analyzer.initialize();
  await analyzer.runCompleteAnalysis();
}

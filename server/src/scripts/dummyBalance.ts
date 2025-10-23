// advancedBalanceAnalyzer_ultimateFix.ts - Version adaptée aux ultimates à usage unique
import mongoose from "mongoose";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { BattleEngine, IBattleOptions } from "../services/BattleEngine";
import { SpellManager, HeroSpells } from "../gameplay/SpellManager";
import { EffectManager } from "../gameplay/EffectManager";
import { PassiveManager } from "../gameplay/PassiveManager";
import { IBattleParticipant, IBattleResult } from "../models/Battle";

dotenv.config();

// ===== INTERFACES ET TYPES =====

interface BaseSpell {
  config: {
    id: string;
    name: string;
    type: string;
    category: string;
    element?: string;
  };
  getEnergyCost(level: number): number;
  getEffectiveCooldown(caster: any, level: number): number;
}

interface AdvancedSpellMetrics {
  // Métriques de base
  averageDps: number;
  burstPotential: number;
  sustainedDps: number;
  
  // Métriques d'utilité
  utilityScore: number;
  survivalContribution: number;
  setupTime: number;
  
  // Métriques situationnelles
  earlyGameImpact: number;
  lateGameImpact: number;
  bossEffectiveness: number;
  aoeEffectiveness: number;
  
  // Métriques de synergie
  soloViability: number;
  teamSynergy: number;
  counterResistance: number;
  
  // Métriques de gameplay
  skillCeiling: number;
  reliability: number;
  adaptability: number;
  
  // ✅ NOUVEAU: Métriques spécifiques aux ultimates
  ultimateImpact: number;      // Impact quand l'ultimate est utilisé
  gameChangingPotential: number; // Capacité à retourner un combat
}

interface CombatScenario {
  name: string;
  description: string;
  playerTeam: IBattleParticipant[];
  enemyTeam: IBattleParticipant[];
  specialConditions?: {
    turnLimit?: number;
    waveCount?: number;
    bossModifiers?: Record<string, number>;
    environmentEffects?: string[];
    guaranteedUltimate?: boolean; // ✅ NOUVEAU: Force l'usage de l'ultimate
  };
  expectedOutcome: "player_advantage" | "balanced" | "enemy_advantage";
  weight: number;
}

interface SpellAnalysisResult {
  spellId: string;
  spellName: string;
  category: string;
  element: string;
  spellType: "active" | "ultimate"; // ✅ NOUVEAU: Distinction claire
  actualRarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
  
  metrics: AdvancedSpellMetrics;
  
  // Scores globaux (0-100)
  overallScore: number;
  balanceScore: number;
  designScore: number;
  
  // Classification intelligente
  archetypes: string[];
  optimalUseCase: string;
  gameplayRole: string;
  
  // Recommandations
  balanceStatus: "underpowered" | "balanced" | "strong" | "overpowered" | "broken";
  recommendations: {
    immediate: string[];
    design: string[];
    synergy: string[];
  };
  
  // Données détaillées
  scenarioResults: Record<string, {
    performance: number;
    impact: string;
    notes: string[];
  }>;
}

// ===== GÉNÉRATEURS DE DONNÉES =====

class HeroFactory {
  
  static createHero(config: {
    name: string;
    role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
    element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
    rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
    level: number;
    spells?: HeroSpells;
    statModifiers?: Partial<Record<string, number>>;
    startingEnergy?: number; // ✅ NOUVEAU: Pour tester les ultimates
  }): IBattleParticipant {
    
    const baseStats = this.getBaseStatsByRole(config.role, config.level);
    const rarityMultiplier = this.getRarityMultiplier(config.rarity);
    
    if (config.statModifiers) {
      Object.entries(config.statModifiers).forEach(([stat, modifier]) => {
        if (modifier && baseStats[stat as keyof typeof baseStats]) {
          (baseStats as any)[stat] *= modifier;
        }
      });
    }
    
    const finalStats = {
      hp: Math.floor(baseStats.hp * rarityMultiplier),
      maxHp: Math.floor(baseStats.hp * rarityMultiplier),
      atk: Math.floor(baseStats.atk * rarityMultiplier),
      def: Math.floor(baseStats.def * rarityMultiplier),
      speed: Math.floor(baseStats.speed * rarityMultiplier)
    };
    
    return {
      heroId: `${config.name.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: config.name,
      position: Math.floor(Math.random() * 5) + 1,
      role: config.role,
      element: config.element,
      rarity: config.rarity,
      level: config.level,
      stars: 5,
      stats: finalStats,
      currentHp: finalStats.hp,
      energy: config.startingEnergy || 0, // ✅ Énergie configurable
      status: {
        alive: true,
        buffs: [],
        debuffs: []
      }
    };
  }
  
  private static getBaseStatsByRole(role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support", level: number): {
    hp: number; atk: number; def: number; speed: number;
  } {
    const levelMultiplier = 1 + (level - 1) * 0.1;
    
    const roleStats = {
      "Tank": { hp: 8000, atk: 200, def: 400, speed: 70 },
      "DPS Melee": { hp: 5000, atk: 350, def: 200, speed: 85 },
      "DPS Ranged": { hp: 4000, atk: 380, def: 150, speed: 90 },
      "Support": { hp: 4500, atk: 250, def: 180, speed: 95 }
    };
    
    const base = roleStats[role];
    
    return {
      hp: Math.floor(base.hp * levelMultiplier),
      atk: Math.floor(base.atk * levelMultiplier),
      def: Math.floor(base.def * levelMultiplier),
      speed: Math.floor(base.speed * levelMultiplier)
    };
  }
  
  private static getRarityMultiplier(rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic"): number {
    const multipliers: Record<string, number> = {
      "Common": 1.0,
      "Rare": 1.15,
      "Epic": 1.35,
      "Legendary": 1.65,
      "Mythic": 2.0
    };
    return multipliers[rarity];
  }
}

class ScenarioGenerator {
  
  static generateBalancedScenarios(): CombatScenario[] {
    return [
      this.createActiveSpellScenario(),
      this.createUltimateTestScenario(), // ✅ NOUVEAU: Scénario spécial ultimates
      this.createEarlyGameScenario(),
      this.createMidGameScenario(),
      this.createLateGameScenario(),
      this.createBossScenario(),
      this.createAoEScenario()
    ];
  }
  
  // ✅ NOUVEAU: Scénario pour tester spécifiquement les sorts actifs
  private static createActiveSpellScenario(): CombatScenario {
    return {
      name: "Active Spell Test",
      description: "Combat standard pour sorts actifs - énergie normale",
      playerTeam: [
        HeroFactory.createHero({ name: "Active Tank", role: "Tank", element: "Fire", rarity: "Epic", level: 30 }),
        HeroFactory.createHero({ name: "Active DPS", role: "DPS Ranged", element: "Electric", rarity: "Epic", level: 30 }),
        HeroFactory.createHero({ name: "Active Support", role: "Support", element: "Light", rarity: "Rare", level: 30 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Enemy Tank", role: "Tank", element: "Water", rarity: "Epic", level: 32 }),
        HeroFactory.createHero({ name: "Enemy DPS", role: "DPS Melee", element: "Dark", rarity: "Epic", level: 30 }),
        HeroFactory.createHero({ name: "Enemy Support", role: "Support", element: "Dark", rarity: "Rare", level: 30 })
      ],
      expectedOutcome: "balanced",
      weight: 1.0
    };
  }
  
  // ✅ NOUVEAU: Scénario spécialement conçu pour les ultimates
  private static createUltimateTestScenario(): CombatScenario {
    return {
      name: "Ultimate Power Test",
      description: "Combat long avec énergie garantie pour tester les ultimates",
      playerTeam: [
        HeroFactory.createHero({ 
          name: "Ultimate Hero", 
          role: "DPS Ranged", 
          element: "Fire", 
          rarity: "Legendary", 
          level: 40,
          startingEnergy: 100 // ✅ Commence avec ultimate ready
        }),
        HeroFactory.createHero({ name: "Support Tank", role: "Tank", element: "Light", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "Support Healer", role: "Support", element: "Water", rarity: "Epic", level: 40 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Tough Boss", role: "Tank", element: "Dark", rarity: "Legendary", level: 45,
          statModifiers: { hp: 2.0, def: 1.5 } }),
        HeroFactory.createHero({ name: "Boss Add 1", role: "DPS Melee", element: "Dark", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "Boss Add 2", role: "DPS Ranged", element: "Dark", rarity: "Epic", level: 40 })
      ],
      specialConditions: {
        turnLimit: 25, // Combat long
        guaranteedUltimate: true // Force l'usage d'ultimate
      },
      expectedOutcome: "player_advantage", // Avec ultimate, le joueur devrait gagner
      weight: 1.5 // ✅ Poids important pour les ultimates
    };
  }
  
  private static createEarlyGameScenario(): CombatScenario {
    return {
      name: "Early Game Clash",
      description: "Combat niveau 15, héros communs/rares",
      playerTeam: [
        HeroFactory.createHero({ name: "Tank", role: "Tank", element: "Fire", rarity: "Common", level: 15 }),
        HeroFactory.createHero({ name: "DPS", role: "DPS Melee", element: "Water", rarity: "Common", level: 15 }),
        HeroFactory.createHero({ name: "Healer", role: "Support", element: "Light", rarity: "Rare", level: 15 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Enemy1", role: "Tank", element: "Dark", rarity: "Common", level: 16 }),
        HeroFactory.createHero({ name: "Enemy2", role: "DPS Melee", element: "Fire", rarity: "Common", level: 15 }),
        HeroFactory.createHero({ name: "Enemy3", role: "Support", element: "Dark", rarity: "Rare", level: 14 })
      ],
      expectedOutcome: "balanced",
      weight: 0.8 // Moins important que ultimate test
    };
  }
  
  private static createMidGameScenario(): CombatScenario {
    return {
      name: "Mid Game Skirmish",
      description: "Combat niveau 35, mix de raretés",
      playerTeam: [
        HeroFactory.createHero({ name: "Knight", role: "Tank", element: "Light", rarity: "Epic", level: 35 }),
        HeroFactory.createHero({ name: "Mage", role: "DPS Ranged", element: "Electric", rarity: "Epic", level: 35 }),
        HeroFactory.createHero({ name: "Cleric", role: "Support", element: "Light", rarity: "Rare", level: 35 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Elite Guard", role: "Tank", element: "Water", rarity: "Epic", level: 36 }),
        HeroFactory.createHero({ name: "Battle Mage", role: "DPS Ranged", element: "Fire", rarity: "Epic", level: 35 }),
        HeroFactory.createHero({ name: "War Priest", role: "Support", element: "Light", rarity: "Rare", level: 34 })
      ],
      expectedOutcome: "balanced",
      weight: 1.0
    };
  }
  
  private static createLateGameScenario(): CombatScenario {
    return {
      name: "Late Game Epic Battle",
      description: "Combat niveau 55, héros légendaires",
      playerTeam: [
        HeroFactory.createHero({ name: "Paladin", role: "Tank", element: "Light", rarity: "Legendary", level: 55 }),
        HeroFactory.createHero({ name: "Archmage", role: "DPS Ranged", element: "Electric", rarity: "Legendary", level: 55 }),
        HeroFactory.createHero({ name: "Oracle", role: "Support", element: "Light", rarity: "Legendary", level: 55 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Demon Lord", role: "Tank", element: "Dark", rarity: "Legendary", level: 58 }),
        HeroFactory.createHero({ name: "Void Sorcerer", role: "DPS Ranged", element: "Dark", rarity: "Legendary", level: 56 }),
        HeroFactory.createHero({ name: "Chaos Priest", role: "Support", element: "Dark", rarity: "Epic", level: 55 })
      ],
      expectedOutcome: "player_advantage",
      weight: 1.0
    };
  }
  
  private static createBossScenario(): CombatScenario {
    return {
      name: "Boss Fight",
      description: "Combat vs boss unique puissant",
      playerTeam: [
        HeroFactory.createHero({ name: "Guardian", role: "Tank", element: "Light", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "DPS Main", role: "DPS Ranged", element: "Fire", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "Healer", role: "Support", element: "Water", rarity: "Epic", level: 40 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Ancient Dragon", role: "DPS Ranged", element: "Fire", rarity: "Mythic", level: 50,
          statModifiers: { hp: 2.0, atk: 1.5, def: 1.3 } })
      ],
      expectedOutcome: "enemy_advantage",
      weight: 1.0
    };
  }
  
  private static createAoEScenario(): CombatScenario {
    return {
      name: "AoE Effectiveness Test",
      description: "Nombreux ennemis faibles",
      playerTeam: [
        HeroFactory.createHero({ name: "AoE Mage", role: "DPS Ranged", element: "Fire", rarity: "Epic", level: 35 }),
        HeroFactory.createHero({ name: "Tank", role: "Tank", element: "Water", rarity: "Rare", level: 35 }),
        HeroFactory.createHero({ name: "Support", role: "Support", element: "Light", rarity: "Rare", level: 35 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Minion1", role: "DPS Melee", element: "Dark", rarity: "Common", level: 25 }),
        HeroFactory.createHero({ name: "Minion2", role: "DPS Melee", element: "Dark", rarity: "Common", level: 25 }),
        HeroFactory.createHero({ name: "Minion3", role: "DPS Ranged", element: "Dark", rarity: "Common", level: 25 }),
        HeroFactory.createHero({ name: "Minion4", role: "DPS Ranged", element: "Dark", rarity: "Common", level: 25 })
      ],
      expectedOutcome: "player_advantage",
      weight: 0.8
    };
  }
}

// ===== ANALYSEUR PRINCIPAL ADAPTÉ AUX ULTIMATES =====

class AdvancedBalanceAnalyzer {
  
  private scenarios: CombatScenario[];
  private spellResults: Map<string, SpellAnalysisResult> = new Map();
  
  constructor() {
    this.scenarios = ScenarioGenerator.generateBalancedScenarios();
  }
  
  async initializeSystems(): Promise<void> {
    console.log("🎮 Initialisation des systèmes de jeu...");
    await SpellManager.initialize();
    await EffectManager.initialize();
    await PassiveManager.initialize();
    console.log("✅ Systèmes initialisés");
  }
  
  async runCompleteAnalysis(): Promise<void> {
    console.log("\n🔬 === ANALYSE AVANCÉE D'ÉQUILIBRAGE (ULTIMATE-AWARE) ===\n");
    
    const startTime = Date.now();
    const allSpells = this.getTestableSpells();
    
    console.log(`📊 Analyse de ${allSpells.length} sorts sur ${this.scenarios.length} scénarios\n`);
    
    // Séparer les sorts actifs et ultimates pour analyse distincte
    const activeSpells = allSpells.filter(s => s.spell.config.type === "active");
    const ultimateSpells = allSpells.filter(s => s.spell.config.type === "ultimate");
    
    console.log(`   🔥 Sorts actifs: ${activeSpells.length}`);
    console.log(`   ⚡ Ultimates: ${ultimateSpells.length}\n`);
    
    // Phase 1: Analyse individuelle des sorts
    console.log("📈 Phase 1: Analyse des performances par sort...");
    for (const spell of allSpells) {
      await this.analyzeSpellPerformance(spell);
      process.stdout.write('.');
    }
    console.log(" ✅\n");
    
    // Phase 2: Analyse comparative
    console.log("📊 Phase 2: Analyse comparative et recommandations...");
    this.generateComparativeAnalysis();
    console.log("✅\n");
    
    // Phase 3: Génération du rapport
    console.log("📋 Phase 3: Génération du rapport final...");
    const report = this.generateComprehensiveReport();
    this.saveReport(report);
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏱️ Analyse terminée en ${duration}s\n`);
    
    this.displayKeyFindings();
  }
  
  private getTestableSpells(): Array<{ id: string; spell: BaseSpell }> {
    const allSpells = SpellManager.getAllSpells();
    return allSpells
      .filter((spell: any) => spell.config.type === "active" || spell.config.type === "ultimate")
      .map((spell: any) => ({ id: spell.config.id, spell: spell as BaseSpell }));
  }
  
  private async analyzeSpellPerformance(spellData: { id: string; spell: BaseSpell }): Promise<void> {
    const { id, spell } = spellData;
    const isUltimate = spell.config.type === "ultimate";
    
    // Initialiser toutes les métriques à 0
    const metrics: AdvancedSpellMetrics = {
      averageDps: 0,
      burstPotential: 0,
      sustainedDps: 0,
      utilityScore: 0,
      survivalContribution: 0,
      setupTime: 0,
      earlyGameImpact: 0,
      lateGameImpact: 0,
      bossEffectiveness: 0,
      aoeEffectiveness: 0,
      soloViability: 0,
      teamSynergy: 0,
      counterResistance: 0,
      skillCeiling: 0,
      reliability: 0,
      adaptability: 0,
      ultimateImpact: 0,
      gameChangingPotential: 0
    };
    
    const scenarioResults: Record<string, any> = {};
    const performanceSum = { total: 0, count: 0 };
    
    // ✅ ADAPTATION: Filtrer les scénarios selon le type de sort
    const relevantScenarios = this.getRelevantScenarios(spell);
    
    // Tester le sort dans chaque scénario pertinent
    for (const scenario of relevantScenarios) {
      const result = await this.testSpellInScenario(spell, scenario);
      scenarioResults[scenario.name] = result;
      
      // Accumuler pour moyenne globale
      performanceSum.total += result.performance * scenario.weight;
      performanceSum.count += scenario.weight;
      
      // Contribuer aux métriques spécifiques
      this.updateMetricsFromScenario(metrics, result, scenario, isUltimate);
    }
    
    // Calculer la moyenne DPS globale
    metrics.averageDps = performanceSum.count > 0 ? performanceSum.total / performanceSum.count : 0;
    
    // Normaliser toutes les métriques
    this.normalizeMetrics(metrics, isUltimate);
    
    // Calculer les scores finaux avec logique adaptée
    const analysis: SpellAnalysisResult = {
      spellId: id,
      spellName: spell.config.name,
      category: spell.config.category,
      element: spell.config.element || "None",
      spellType: isUltimate ? "ultimate" : "active",
      actualRarity: this.determineActualRarity(spell, metrics),
      metrics,
      overallScore: this.calculateOverallScore(metrics, isUltimate),
      balanceScore: this.calculateBalanceScore(metrics, spell),
      designScore: this.calculateDesignScore(metrics, spell),
      archetypes: this.determineArchetypes(metrics, spell),
      optimalUseCase: this.determineOptimalUseCase(metrics, scenarioResults),
      gameplayRole: this.determineGameplayRole(metrics, isUltimate),
      balanceStatus: this.determineBalanceStatus(metrics, spell),
      recommendations: this.generateRecommendations(metrics, spell),
      scenarioResults
    };
    
    this.spellResults.set(id, analysis);
  }
  
  // ✅ NOUVEAU: Sélectionner les scénarios pertinents selon le type de sort
  private getRelevantScenarios(spell: BaseSpell): CombatScenario[] {
    const isUltimate = spell.config.type === "ultimate";
    
    if (isUltimate) {
      // Pour les ultimates, focus sur les scénarios où ils peuvent être utilisés
      return this.scenarios.filter(scenario => 
        scenario.name === "Ultimate Power Test" ||
        scenario.name === "Late Game Epic Battle" ||
        scenario.name === "Boss Fight"
      );
    } else {
      // Pour les sorts actifs, tous les scénarios sauf celui des ultimates
      return this.scenarios.filter(scenario => 
        scenario.name !== "Ultimate Power Test"
      );
    }
  }
  
  // ✅ ADAPTATION: Normalisation différente pour ultimates vs actifs
  private normalizeMetrics(metrics: AdvancedSpellMetrics, isUltimate: boolean): void {
    const scenarioCount = isUltimate ? 3 : 6; // Différent selon le type
    
    // Les métriques qui s'accumulent doivent être divisées
    metrics.reliability = metrics.reliability / scenarioCount;
    metrics.adaptability = metrics.adaptability / scenarioCount;
    
    if (isUltimate) {
      // Pour les ultimates, la "reliability" n'est pas le même concept
      // On se base plus sur l'impact quand utilisé
      metrics.reliability = Math.max(metrics.ultimateImpact * 0.8, metrics.reliability);
    }
    
    // Assurer que tout reste dans [0-100]
    Object.keys(metrics).forEach(key => {
      const value = (metrics as any)[key];
      if (typeof value === 'number') {
        (metrics as any)[key] = Math.max(0, Math.min(100, value));
      }
    });
  }
  
  private async testSpellInScenario(spell: BaseSpell, scenario: CombatScenario): Promise<any> {
    const testTeam = [...scenario.playerTeam];
    const testHero = testTeam[0];
    const isUltimate = spell.config.type === "ultimate";
    
    // ✅ ADAPTATION: Configuration différente pour ultimates
    const heroSpells: HeroSpells = isUltimate ? {
      ultimate: { id: spell.config.id, level: 5 }
    } : {
      active1: { id: spell.config.id, level: 5 }
    };
    
    const playerSpells = new Map<string, HeroSpells>();
    playerSpells.set(testHero.heroId, heroSpells);
    
    const battleOptions: IBattleOptions = {
      mode: "auto",
      speed: 1
    };
    
    try {
      const engine = new BattleEngine(
        testTeam,
        scenario.enemyTeam,
        playerSpells,
        new Map(),
        battleOptions
      );
      
      const result = engine.simulateBattle();
      const actions = engine.getActions();
      
      return this.analyzeCombatResult(result, actions, testHero.heroId, spell, scenario);
      
    } catch (error) {
      return {
        performance: 0,
        impact: "error",
        notes: [`Erreur: ${error}`],
        spellUsage: 0,
        contribution: 0
      };
    }
  }
  
  private analyzeCombatResult(
    battleResult: IBattleResult, 
    actions: any[], 
    testHeroId: string, 
    spell: BaseSpell, 
    scenario: CombatScenario
  ): any {
    
    const isUltimate = spell.config.type === "ultimate";
    
    const spellActions = actions.filter(action => 
      action.actorId === testHeroId && 
      (action.spellId === spell.config.id || action.actionType === "skill")
    );
    
    const totalSpellDamage = spellActions.reduce((sum, action) => sum + (action.damage || 0), 0);
    const spellUsageCount = spellActions.length;
    
    const totalDamageInBattle = actions
      .filter(action => action.actorId === testHeroId)
      .reduce((sum, action) => sum + (action.damage || 0), 0);
    
    const spellContribution = totalDamageInBattle > 0 ? (totalSpellDamage / totalDamageInBattle) : 0;
    
    // ✅ ADAPTATION: Logique de performance différente pour ultimates
    let performance = 30;
    
    if (isUltimate) {
      // Pour les ultimates: focus sur l'impact quand utilisé
      if (spellUsageCount > 0) {
        performance = 50; // Base plus élevée si utilisé
        performance += Math.min(30, spellContribution * 60); // Impact majeur
        if (battleResult.victory) performance += 20;
        if (battleResult.totalTurns < 15) performance += 10; // Victoire rapide après ultimate
      } else {
        // Si l'ultimate n'est pas utilisé dans un scénario d'ultimate, c'est problématique
        if (scenario.specialConditions?.guaranteedUltimate) {
          performance = 10; // Très mauvais
        } else {
          performance = 40; // Neutre - normal qu'il ne soit pas utilisé
        }
      }
    } else {
      // Pour les sorts actifs: logique existante
      if (battleResult.victory) {
        performance += 30;
        if (battleResult.totalTurns < 10) performance += 10;
      } else {
        performance -= 20;
      }
      
      if (spellUsageCount > 0) {
        performance += Math.min(15, spellUsageCount * 3);
        performance += Math.min(15, spellContribution * 25);
      } else {
        performance -= 15; // Pénalité plus forte pour sorts actifs non utilisés
      }
    }
    
    // Impact du sort
    let impact = "minimal";
    if (spellContribution > 0.6) impact = "dominant";
    else if (spellContribution > 0.4) impact = "major";
    else if (spellContribution > 0.2) impact = "moderate";
    else if (spellContribution > 0.05) impact = "minor";
    
    const notes: string[] = [];
    if (spellUsageCount === 0) {
      notes.push(isUltimate ? "Ultimate non utilisé" : "Sort jamais utilisé");
    }
    if (spellContribution > 0.8) notes.push("Impact très élevé");
    if (isUltimate && spellUsageCount > 0) notes.push("Ultimate déclenché avec succès");
    
    return {
      performance: Math.max(0, Math.min(100, performance)),
      impact,
      notes,
      spellUsage: spellUsageCount,
      contribution: spellContribution,
      totalSpellDamage,
      battleDuration: battleResult.totalTurns,
      victory: battleResult.victory
    };
  }
  
  private updateMetricsFromScenario(
    metrics: AdvancedSpellMetrics, 
    scenarioResult: any, 
    scenario: CombatScenario,
    isUltimate: boolean
  ): void {
    const performance = scenarioResult.performance;
    
    // Mise à jour directe selon le scénario
    switch (scenario.name) {
      case "Ultimate Power Test":
        metrics.ultimateImpact = performance;
        metrics.gameChangingPotential = scenarioResult.contribution * 100;
        break;
      case "Active Spell Test":
        metrics.sustainedDps = performance;
        break;
      case "Early Game Clash":
        metrics.earlyGameImpact = performance;
        break;
      case "Late Game Epic Battle":
        metrics.lateGameImpact = performance;
        break;
      case "Boss Fight":
        metrics.bossEffectiveness = performance;
        break;
      case "AoE Effectiveness Test":
        metrics.aoeEffectiveness = performance;
        break;
      case "Mid Game Skirmish":
        metrics.teamSynergy = performance;
        break;
    }
    
    // Métriques de fiabilité adaptées
    if (isUltimate) {
      // Pour ultimates: reliability = capacité à être disponible au bon moment
      if (scenarioResult.spellUsage > 0) {
        metrics.reliability += 30; // Bonus important si utilisé
      }
    } else {
      // Pour sorts actifs: reliability = utilisation consistante
      if (scenarioResult.spellUsage > 0) {
        metrics.reliability += 15;
      }
    }
    
    metrics.adaptability += performance * 0.1;
  }
  
  // ✅ ADAPTATION: Score global différent pour ultimates vs actifs
  private calculateOverallScore(metrics: AdvancedSpellMetrics, isUltimate: boolean): number {
    if (isUltimate) {
      return Math.round(
        metrics.ultimateImpact * 0.4 +
        metrics.gameChangingPotential * 0.3 +
        metrics.bossEffectiveness * 0.2 +
        metrics.reliability * 0.1
      );
    } else {
      return Math.round(
        metrics.averageDps * 0.3 +
        metrics.reliability * 0.25 +
        metrics.sustainedDps * 0.2 +
        metrics.teamSynergy * 0.15 +
        metrics.adaptability * 0.1
      );
    }
  }
  
  // ✅ ADAPTATION: Rôle gameplay adapté
  private determineGameplayRole(metrics: AdvancedSpellMetrics, isUltimate: boolean): string {
    if (isUltimate) {
      if (metrics.ultimateImpact > 70) return "game_changer";
      if (metrics.bossEffectiveness > 65) return "boss_killer";
      if (metrics.gameChangingPotential > 60) return "finisher";
      return "ultimate_support";
    } else {
      if (metrics.averageDps > 65 && metrics.reliability > 60) return "core";
      if (metrics.sustainedDps > 70) return "sustained_dps";
      if (metrics.bossEffectiveness > 70 || metrics.aoeEffectiveness > 70) return "situational";
      if (metrics.reliability < 30) return "unreliable";
      return "support";
    }
  }
  
  // ✅ ADAPTATION: Statut d'équilibrage adapté aux ultimates
  private determineBalanceStatus(metrics: AdvancedSpellMetrics, spell: BaseSpell): "underpowered" | "balanced" | "strong" | "overpowered" | "broken" {
    const isUltimate = spell.config.type === "ultimate";
    const score = isUltimate ? metrics.ultimateImpact : metrics.averageDps;
    const reliability = metrics.reliability;
    
    if (isUltimate) {
      // Seuils différents pour ultimates
      if (score < 40 || reliability < 15) return "underpowered";
      if (score > 90) return "broken";
      if (score > 80) return "overpowered";
      if (score > 65) return "strong";
      return "balanced";
    } else {
      // Seuils existants pour sorts actifs
      if (reliability < 10) return "underpowered";
      if (score < 25) return "underpowered";
      if (score > 85) return "broken";
      if (score > 70) return "overpowered";
      if (score > 55) return "strong";
      return "balanced";
    }
  }
  
  // ✅ ADAPTATION: Recommandations adaptées
  private generateRecommendations(metrics: AdvancedSpellMetrics, spell: BaseSpell): any {
    const immediate: string[] = [];
    const design: string[] = [];
    const synergy: string[] = [];
    const isUltimate = spell.config.type === "ultimate";
    
    if (isUltimate) {
      if (metrics.ultimateImpact < 40) {
        immediate.push("Augmenter l'impact de l'ultimate - dégâts ou effets insuffisants");
      }
      if (metrics.reliability < 20) {
        immediate.push("Problème de timing - ultimate non utilisé au bon moment");
      }
      if (metrics.gameChangingPotential < 30) {
        design.push("Ultimate pas assez game-changing - ajouter des effets uniques");
      }
    } else {
      if (metrics.reliability < 20) {
        immediate.push("Réduire coût énergie ou cooldown - sort trop peu utilisé");
      }
      if (metrics.averageDps < 30) {
        const increase = Math.round((35 - metrics.averageDps) * 2);
        immediate.push(`Augmenter puissance de ${increase}%`);
      }
      if (metrics.averageDps > 80) {
        const decrease = Math.round((metrics.averageDps - 65) * 1.5);
        immediate.push(`Réduire puissance de ${decrease}%`);
      }
    }
    
    if (metrics.teamSynergy < 30) {
      synergy.push("Ajouter des effets de synergie élémentaire");
    }
    
    return { immediate, design, synergy };
  }
  
  // Méthodes existantes adaptées...
  private determineActualRarity(spell: BaseSpell, metrics: AdvancedSpellMetrics): "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" {
    const isUltimate = spell.config.type === "ultimate";
    const score = isUltimate ? metrics.ultimateImpact : metrics.averageDps;
    
    if (score >= 80) return "Mythic";
    if (score >= 65) return "Legendary";
    if (score >= 50) return "Epic";
    if (score >= 35) return "Rare";
    return "Common";
  }
  
  private calculateBalanceScore(metrics: AdvancedSpellMetrics, spell: BaseSpell): number {
    const expectedScore = this.getExpectedScore(spell);
    const isUltimate = spell.config.type === "ultimate";
    const actualScore = isUltimate ? metrics.ultimateImpact : metrics.averageDps;
    
    if (actualScore === 0) return 0;
    
    const deviation = Math.abs(actualScore - expectedScore) / expectedScore;
    return Math.max(0, Math.round(100 - deviation * 100));
  }
  
  private getExpectedScore(spell: BaseSpell): number {
    const isUltimate = spell.config.type === "ultimate";
    
    if (isUltimate) return 65; // Seuil plus élevé pour ultimates
    
    const energyCost = spell.getEnergyCost(5);
    const cooldown = spell.getEffectiveCooldown({ stats: { speed: 100 } }, 5);
    
    if (energyCost > 50) return 60;
    if (cooldown > 5) return 55;
    return 45;
  }
  
  private calculateDesignScore(metrics: AdvancedSpellMetrics, spell: BaseSpell): number {
    let score = 50;
    const isUltimate = spell.config.type === "ultimate";
    
    if (isUltimate) {
      if (metrics.gameChangingPotential > 50) score += 20;
      if (metrics.ultimateImpact > 60) score += 15;
    } else {
      if (metrics.bossEffectiveness > 60 || metrics.aoeEffectiveness > 60) score += 10;
      if (metrics.reliability > 50) score += 15;
    }
    
    if (metrics.reliability < 20) score -= 20;
    
    return Math.max(0, Math.min(100, score));
  }
  
  private determineArchetypes(metrics: AdvancedSpellMetrics, spell: BaseSpell): string[] {
    const archetypes: string[] = [];
    const isUltimate = spell.config.type === "ultimate";
    
    if (isUltimate) {
      if (metrics.gameChangingPotential > 65) archetypes.push("game_changer");
      if (metrics.bossEffectiveness > 65) archetypes.push("boss_killer");
      if (metrics.ultimateImpact > 70) archetypes.push("high_impact");
    } else {
      if (metrics.bossEffectiveness > 65) archetypes.push("single_target");
      if (metrics.aoeEffectiveness > 65) archetypes.push("aoe");
      if (metrics.teamSynergy > 65) archetypes.push("synergy");
      if (metrics.reliability > 70) archetypes.push("reliable");
    }
    
    return archetypes.length > 0 ? archetypes : ["generic"];
  }
  
  private determineOptimalUseCase(metrics: AdvancedSpellMetrics, scenarioResults: Record<string, any>): string {
    const bestScenario = Object.entries(scenarioResults)
      .reduce((best, [name, result]) => 
        result.performance > best.performance ? { name, performance: result.performance } : best,
        { name: "Aucun", performance: 0 }
      );
    
    return `Optimal: ${bestScenario.name} (${Math.round(bestScenario.performance)}%)`;
  }
  
  private generateComparativeAnalysis(): void {
    console.log("   🔄 Analyse comparative terminée");
  }
  
  private generateComprehensiveReport(): any {
    const results = Array.from(this.spellResults.values());
    const activeSpells = results.filter(r => r.spellType === "active");
    const ultimateSpells = results.filter(r => r.spellType === "ultimate");
    
    return {
      metadata: {
        timestamp: new Date().toISOString(),
        version: "3.0.2-ultimate-aware",
        totalSpellsAnalyzed: results.length,
        activeSpellsAnalyzed: activeSpells.length,
        ultimateSpellsAnalyzed: ultimateSpells.length,
        totalScenariosUsed: this.scenarios.length
      },
      summary: {
        overall: {
          averageOverallScore: Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length),
          balancedSpells: results.filter(r => r.balanceStatus === "balanced").length,
          overpoweredSpells: results.filter(r => r.balanceStatus === "overpowered" || r.balanceStatus === "broken").length,
          underpoweredSpells: results.filter(r => r.balanceStatus === "underpowered").length,
        },
        activeSpells: {
          averageScore: activeSpells.length > 0 ? Math.round(activeSpells.reduce((sum, r) => sum + r.overallScore, 0) / activeSpells.length) : 0,
          balanced: activeSpells.filter(r => r.balanceStatus === "balanced").length,
          problematic: activeSpells.filter(r => r.balanceStatus === "broken" || r.balanceStatus === "underpowered").length
        },
        ultimateSpells: {
          averageScore: ultimateSpells.length > 0 ? Math.round(ultimateSpells.reduce((sum, r) => sum + r.overallScore, 0) / ultimateSpells.length) : 0,
          balanced: ultimateSpells.filter(r => r.balanceStatus === "balanced").length,
          problematic: ultimateSpells.filter(r => r.balanceStatus === "broken" || r.balanceStatus === "underpowered").length
        }
      },
      spellAnalysis: results,
      scenarios: this.scenarios.map(s => ({
        name: s.name,
        description: s.description,
        weight: s.weight
      })),
      recommendations: this.generateGlobalRecommendations(results)
    };
  }
  
  private generateGlobalRecommendations(results: SpellAnalysisResult[]): any {
    const critical: string[] = [];
    const balance: string[] = [];
    const design: string[] = [];
    
    const activeSpells = results.filter(r => r.spellType === "active");
    const ultimateSpells = results.filter(r => r.spellType === "ultimate");
    
    const brokenSpells = results.filter(r => r.balanceStatus === "broken");
    const underpowered = results.filter(r => r.balanceStatus === "underpowered");
    
    if (brokenSpells.length > 0) {
      critical.push(`${brokenSpells.length} sorts trop puissants nécessitent un nerf`);
    }
    
    if (underpowered.length > results.length * 0.3) {
      balance.push(`${underpowered.length} sorts sous-alimentés à améliorer`);
    }
    
    const lowReliabilityActives = activeSpells.filter(r => r.metrics.reliability < 30);
    if (lowReliabilityActives.length > 0) {
      design.push(`${lowReliabilityActives.length} sorts actifs peu utilisés - problème de coût/cooldown`);
    }
    
    const weakUltimates = ultimateSpells.filter(r => r.metrics.ultimateImpact < 40);
    if (weakUltimates.length > 0) {
      design.push(`${weakUltimates.length} ultimates manquent d'impact`);
    }
    
    return { critical, balance, design };
  }
  
  private saveReport(report: any): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `ultimate_aware_balance_${timestamp}.json`;
    const outputPath = path.join(process.cwd(), 'logs', 'balance', filename);
    
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`💾 Rapport ultimate-aware sauvegardé: ${filename}`);
  }
  
  private displayKeyFindings(): void {
    const results = Array.from(this.spellResults.values());
    const activeSpells = results.filter(r => r.spellType === "active");
    const ultimateSpells = results.filter(r => r.spellType === "ultimate");
    
    console.log("🎯 === RÉSULTATS CLÉS (ULTIMATE-AWARE) ===\n");
    
    // Top sorts actifs
    const topActives = activeSpells
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 3);
    
    console.log("🔥 TOP 3 SORTS ACTIFS:");
    topActives.forEach((spell, i) => {
      console.log(`   ${i + 1}. ${spell.spellName} (${spell.overallScore}/100) - ${spell.gameplayRole}`);
    });
    
    // Top ultimates
    const topUltimates = ultimateSpells
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 3);
    
    console.log("\n⚡ TOP 3 ULTIMATES:");
    topUltimates.forEach((spell, i) => {
      console.log(`   ${i + 1}. ${spell.spellName} (${spell.overallScore}/100) - ${spell.gameplayRole}`);
    });
    
    // Sorts problématiques
    const problematic = results.filter(r => 
      r.balanceStatus === "broken" || r.balanceStatus === "underpowered"
    );
    
    if (problematic.length > 0) {
      console.log("\n⚠️ SORTS PROBLÉMATIQUES:");
      problematic.slice(0, 8).forEach(spell => {
        const type = spell.spellType === "ultimate" ? "⚡" : "🔥";
        console.log(`   🚨 ${type} ${spell.spellName}: ${spell.balanceStatus} (${spell.overallScore}/100)`);
        if (spell.recommendations.immediate.length > 0) {
          console.log(`      → ${spell.recommendations.immediate[0]}`);
        }
      });
      
      if (problematic.length > 8) {
        console.log(`   ... et ${problematic.length - 8} autres sorts problématiques`);
      }
    }
    
    // Statistiques séparées
    const avgActiveScore = activeSpells.length > 0 ? Math.round(activeSpells.reduce((sum, r) => sum + r.overallScore, 0) / activeSpells.length) : 0;
    const avgUltimateScore = ultimateSpells.length > 0 ? Math.round(ultimateSpells.reduce((sum, r) => sum + r.overallScore, 0) / ultimateSpells.length) : 0;
    
    const balancedActives = activeSpells.filter(r => r.balanceStatus === "balanced").length;
    const balancedUltimates = ultimateSpells.filter(r => r.balanceStatus === "balanced").length;
    
    console.log(`\n📊 SANTÉ GLOBALE:`);
    console.log(`   🔥 Sorts actifs: ${avgActiveScore}/100 - ${balancedActives}/${activeSpells.length} équilibrés (${Math.round(balancedActives/activeSpells.length*100)}%)`);
    console.log(`   ⚡ Ultimates: ${avgUltimateScore}/100 - ${balancedUltimates}/${ultimateSpells.length} équilibrés (${Math.round(balancedUltimates/ultimateSpells.length*100)}%)`);
    console.log(""); 
  }
}

// ===== SCRIPT PRINCIPAL =====

async function runAdvancedBalanceAnalysis(): Promise<void> {
  try {
    const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";
    await mongoose.connect(MONGO_URI);
    
    const analyzer = new AdvancedBalanceAnalyzer();
    await analyzer.initializeSystems();
    await analyzer.runCompleteAnalysis();
    
  } catch (error) {
    console.error("❌ Erreur lors de l'analyse:", error);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runAdvancedBalanceAnalysis().then(() => process.exit(0));
}

export { AdvancedBalanceAnalyzer, runAdvancedBalanceAnalysis };

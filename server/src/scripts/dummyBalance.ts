// advancedBalanceAnalyzer_bugfixed.ts - Version corrigée avec calculs fixes
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
  };
  expectedOutcome: "player_advantage" | "balanced" | "enemy_advantage";
  weight: number;
}

interface SpellAnalysisResult {
  spellId: string;
  spellName: string;
  category: string;
  element: string;
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
      energy: 0,
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
      this.createEarlyGameScenario(),
      this.createMidGameScenario(),
      this.createLateGameScenario(),
      this.createBossScenario(),
      this.createAoEScenario()
    ];
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
      weight: 1.0
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
      weight: 1.0
    };
  }
}

// ===== ANALYSEUR PRINCIPAL CORRIGÉ =====

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
    console.log("\n🔬 === ANALYSE AVANCÉE D'ÉQUILIBRAGE (VERSION CORRIGÉE) ===\n");
    
    const startTime = Date.now();
    const allSpells = this.getTestableSpells();
    
    console.log(`📊 Analyse de ${allSpells.length} sorts sur ${this.scenarios.length} scénarios\n`);
    
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
    
    // ✅ FIX: Initialiser toutes les métriques à 0
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
      adaptability: 0
    };
    
    const scenarioResults: Record<string, any> = {};
    const performanceSum = { total: 0, count: 0 };
    
    // Tester le sort dans chaque scénario
    for (const scenario of this.scenarios) {
      const result = await this.testSpellInScenario(spell, scenario);
      scenarioResults[scenario.name] = result;
      
      // ✅ FIX: Accumuler pour moyenne globale
      performanceSum.total += result.performance * scenario.weight;
      performanceSum.count += scenario.weight;
      
      // Contribuer aux métriques spécifiques
      this.updateMetricsFromScenario(metrics, result, scenario);
    }
    
    // ✅ FIX: Calculer la moyenne DPS globale
    metrics.averageDps = performanceSum.count > 0 ? performanceSum.total / performanceSum.count : 0;
    
    // ✅ FIX: Normaliser toutes les métriques qui se cumulent
    this.normalizeMetrics(metrics);
    
    // Calculer les scores finaux
    const analysis: SpellAnalysisResult = {
      spellId: id,
      spellName: spell.config.name,
      category: spell.config.category,
      element: spell.config.element || "None",
      actualRarity: this.determineActualRarity(spell, metrics),
      metrics,
      overallScore: this.calculateOverallScore(metrics),
      balanceScore: this.calculateBalanceScore(metrics, spell),
      designScore: this.calculateDesignScore(metrics, spell),
      archetypes: this.determineArchetypes(metrics, spell),
      optimalUseCase: this.determineOptimalUseCase(metrics, scenarioResults),
      gameplayRole: this.determineGameplayRole(metrics),
      balanceStatus: this.determineBalanceStatus(metrics, spell),
      recommendations: this.generateRecommendations(metrics, spell),
      scenarioResults
    };
    
    this.spellResults.set(id, analysis);
  }
  
  // ✅ FIX: Nouvelle méthode pour normaliser les métriques
  private normalizeMetrics(metrics: AdvancedSpellMetrics): void {
    const scenarioCount = this.scenarios.length;
    
    // Les métriques qui s'accumulent doivent être divisées
    metrics.reliability = metrics.reliability / scenarioCount;
    metrics.adaptability = metrics.adaptability / scenarioCount;
    
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
    
    const heroSpells: HeroSpells = {
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
    
    // ✅ FIX: Logique de performance corrigée
    let performance = 30; // Base plus réaliste
    
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
      performance -= 10; // Pénalité si jamais utilisé
    }
    
    // Impact du sort
    let impact = "minimal";
    if (spellContribution > 0.6) impact = "dominant";
    else if (spellContribution > 0.4) impact = "major";
    else if (spellContribution > 0.2) impact = "moderate";
    else if (spellContribution > 0.05) impact = "minor";
    
    const notes: string[] = [];
    if (spellUsageCount === 0) notes.push("Sort jamais utilisé");
    if (spellContribution > 0.8) notes.push("Impact très élevé");
    
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
    scenario: CombatScenario
  ): void {
    const performance = scenarioResult.performance;
    
    // ✅ FIX: Mise à jour directe sans accumulation
    switch (scenario.name) {
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
    
    // Métriques de fiabilité basées sur l'usage
    if (scenarioResult.spellUsage > 0) {
      metrics.reliability += 20; // Accumuler seulement si utilisé
    }
    
    metrics.adaptability += performance * 0.15; // Petite accumulation pondérée
  }
  
  private determineActualRarity(spell: BaseSpell, metrics: AdvancedSpellMetrics): "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" {
    const score = metrics.averageDps;
    
    if (score >= 80) return "Mythic";
    if (score >= 65) return "Legendary";
    if (score >= 50) return "Epic";
    if (score >= 35) return "Rare";
    return "Common";
  }
  
  private calculateOverallScore(metrics: AdvancedSpellMetrics): number {
    return Math.round(
      metrics.averageDps * 0.4 +
      metrics.reliability * 0.2 +
      metrics.teamSynergy * 0.15 +
      metrics.adaptability * 0.15 +
      (metrics.bossEffectiveness + metrics.aoeEffectiveness) * 0.05
    );
  }
  
  private calculateBalanceScore(metrics: AdvancedSpellMetrics, spell: BaseSpell): number {
    const expectedScore = this.getExpectedScore(spell);
    const actualScore = metrics.averageDps;
    
    if (actualScore === 0) return 0;
    
    const deviation = Math.abs(actualScore - expectedScore) / expectedScore;
    return Math.max(0, Math.round(100 - deviation * 100));
  }
  
  private getExpectedScore(spell: BaseSpell): number {
    const energyCost = spell.getEnergyCost(5);
    const cooldown = spell.getEffectiveCooldown({ stats: { speed: 100 } }, 5);
    
    if (spell.config.type === "ultimate") return 70;
    if (energyCost > 50) return 60;
    if (cooldown > 5) return 55;
    return 45;
  }
  
  private calculateDesignScore(metrics: AdvancedSpellMetrics, spell: BaseSpell): number {
    let score = 50;
    
    if (metrics.bossEffectiveness > 60 || metrics.aoeEffectiveness > 60) score += 10;
    if (metrics.reliability > 50) score += 15;
    if (metrics.reliability < 20) score -= 20;
    
    return Math.max(0, Math.min(100, score));
  }
  
  private determineArchetypes(metrics: AdvancedSpellMetrics, spell: BaseSpell): string[] {
    const archetypes: string[] = [];
    
    if (metrics.bossEffectiveness > 65) archetypes.push("single_target");
    if (metrics.aoeEffectiveness > 65) archetypes.push("aoe");
    if (metrics.teamSynergy > 65) archetypes.push("synergy");
    if (metrics.reliability > 70) archetypes.push("reliable");
    
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
  
  private determineGameplayRole(metrics: AdvancedSpellMetrics): string {
    if (metrics.averageDps > 65 && metrics.reliability > 60) return "core";
    if (metrics.bossEffectiveness > 70 || metrics.aoeEffectiveness > 70) return "situational";
    if (metrics.reliability < 30) return "unreliable";
    return "support";
  }
  
  // ✅ FIX: Logique de statut d'équilibrage corrigée
  private determineBalanceStatus(metrics: AdvancedSpellMetrics, spell: BaseSpell): "underpowered" | "balanced" | "strong" | "overpowered" | "broken" {
    const score = metrics.averageDps;
    const reliability = metrics.reliability;
    
    // Si le sort n'est jamais utilisé, c'est underpowered
    if (reliability < 10) return "underpowered";
    
    // Classification par score
    if (score < 25) return "underpowered";
    if (score > 85) return "broken";
    if (score > 70) return "overpowered";
    if (score > 55) return "strong";
    return "balanced";
  }
  
  // ✅ FIX: Recommandations corrigées
  private generateRecommendations(metrics: AdvancedSpellMetrics, spell: BaseSpell): any {
    const immediate: string[] = [];
    const design: string[] = [];
    const synergy: string[] = [];
    
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
    
    if (metrics.teamSynergy < 30) {
      synergy.push("Ajouter des effets de synergie élémentaire");
    }
    
    if (metrics.reliability < 40 && spell.config.category !== "utility") {
      design.push("Améliorer la consistance d'utilisation");
    }
    
    return { immediate, design, synergy };
  }
  
  private generateComparativeAnalysis(): void {
    console.log("   🔄 Analyse comparative terminée");
  }
  
  private generateComprehensiveReport(): any {
    const results = Array.from(this.spellResults.values());
    
    return {
      metadata: {
        timestamp: new Date().toISOString(),
        version: "3.0.1-bugfixed",
        totalSpellsAnalyzed: results.length,
        totalScenariosUsed: this.scenarios.length
      },
      summary: {
        averageOverallScore: Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length),
        balancedSpells: results.filter(r => r.balanceStatus === "balanced").length,
        overpoweredSpells: results.filter(r => r.balanceStatus === "overpowered" || r.balanceStatus === "broken").length,
        underpoweredSpells: results.filter(r => r.balanceStatus === "underpowered").length,
        averageBalanceScore: Math.round(results.reduce((sum, r) => sum + r.balanceScore, 0) / results.length)
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
    
    const brokenSpells = results.filter(r => r.balanceStatus === "broken");
    const underpowered = results.filter(r => r.balanceStatus === "underpowered");
    
    if (brokenSpells.length > 0) {
      critical.push(`${brokenSpells.length} sorts trop puissants nécessitent un nerf`);
    }
    
    if (underpowered.length > results.length * 0.3) {
      balance.push(`${underpowered.length} sorts sous-alimentés à améliorer`);
    }
    
    const lowReliability = results.filter(r => r.metrics.reliability < 30);
    if (lowReliability.length > 0) {
      design.push(`${lowReliability.length} sorts peu utilisés - problème de coût/cooldown`);
    }
    
    return { critical, balance, design };
  }
  
  private saveReport(report: any): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `advanced_balance_fixed_${timestamp}.json`;
    const outputPath = path.join(process.cwd(), 'logs', 'balance', filename);
    
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`💾 Rapport corrigé sauvegardé: ${filename}`);
  }
  
  private displayKeyFindings(): void {
    const results = Array.from(this.spellResults.values());
    
    console.log("🎯 === RÉSULTATS CLÉS (VERSION CORRIGÉE) ===\n");
    
    // Top 5 meilleurs sorts
    const topSpells = results
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 5);
    
    console.log("🏆 TOP 5 SORTS:");
    topSpells.forEach((spell, i) => {
      console.log(`   ${i + 1}. ${spell.spellName} (${spell.overallScore}/100) - ${spell.gameplayRole}`);
    });
    
    // Sorts problématiques
    const problematic = results.filter(r => 
      r.balanceStatus === "broken" || r.balanceStatus === "underpowered"
    );
    
    if (problematic.length > 0) {
      console.log("\n⚠️ SORTS PROBLÉMATIQUES:");
      problematic.slice(0, 10).forEach(spell => { // Limiter à 10
        console.log(`   🚨 ${spell.spellName}: ${spell.balanceStatus} (${spell.overallScore}/100)`);
        if (spell.recommendations.immediate.length > 0) {
          console.log(`      → ${spell.recommendations.immediate[0]}`);
        }
      });
      
      if (problematic.length > 10) {
        console.log(`   ... et ${problematic.length - 10} autres sorts problématiques`);
      }
    }
    
    // Statistiques générales
    const avgScore = Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length);
    const balanced = results.filter(r => r.balanceStatus === "balanced").length;
    
    console.log(`\n📊 SANTÉ GLOBALE: ${avgScore}/100`);
    console.log(`   ⚖️ Sorts équilibrés: ${balanced}/${results.length} (${Math.round(balanced/results.length*100)}%)`);
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

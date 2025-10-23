// advancedBalanceAnalyzer.ts - Système d'équilibrage intelligent
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

// ===== TYPES AVANCÉS =====

interface AdvancedSpellMetrics {
  // Métriques de base
  averageDps: number;
  burstPotential: number;
  sustainedDps: number;
  
  // Métriques d'utilité
  utilityScore: number;        // Impact buffs/debuffs/contrôles
  survivalContribution: number; // Contribution à la survie d'équipe
  setupTime: number;           // Temps avant impact maximum
  
  // Métriques situationnelles
  earlyGameImpact: number;     // Performance niveaux 1-20
  lateGameImpact: number;      // Performance niveaux 40+
  bossEffectiveness: number;   // Efficacité vs boss
  aoeEffectiveness: number;    // Efficacité vs groupes
  
  // Métriques de synergie
  soloViability: number;       // Performance en solo
  teamSynergy: number;         // Boost apporté à l'équipe
  counterResistance: number;   // Résistance aux contres
  
  // Métriques de gameplay
  skillCeiling: number;        // Potentiel avec bon timing/positionnement
  reliability: number;         // Consistance des résultats
  adaptability: number;        // Flexibilité selon la situation
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
  weight: number; // Importance du scénario (0-1)
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
  archetypes: string[];         // ["burst", "sustain", "utility", "control"]
  optimalUseCase: string;       // Description du meilleur usage
  gameplayRole: string;         // "core", "situational", "support", "niche"
  
  // Recommandations
  balanceStatus: "underpowered" | "balanced" | "strong" | "overpowered" | "broken";
  recommendations: {
    immediate: string[];         // Changements urgents
    design: string[];           // Améliorations de design
    synergy: string[];          // Suggestions de synergie
  };
  
  // Données détaillées
  scenarioResults: Record<string, {
    performance: number;
    impact: string;
    notes: string[];
  }>;
}

interface TeamComposition {
  name: string;
  strategy: string;
  roles: {
    tank: IBattleParticipant;
    dps1: IBattleParticipant;
    dps2: IBattleParticipant;
    support: IBattleParticipant;
    flex: IBattleParticipant;
  };
  expectedStrengths: string[];
  expectedWeaknesses: string[];
}

// ===== GÉNÉRATEURS DE DONNÉES =====

class HeroFactory {
  
static createHero(config: {
  name: string;
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";        // ← Type union strict
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";  // ← Type union strict  
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";  // ← Type union strict
  level: number;
  spells?: HeroSpells;
  statModifiers?: Partial<Record<string, number>>;
}): IBattleParticipant
    
    const baseStats = this.getBaseStatsByRole(config.role, config.level);
    const rarityMultiplier = this.getRarityMultiplier(config.rarity);
    
    // Appliquer modificateurs custom
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
  
  private static getBaseStatsByRole(
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support", 
  level: number
): {
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
  
 private static getRarityMultiplier(
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic"
  ): number {
    const multipliers: Record<string, number> = {
      "Common": 1.0,
      "Rare": 1.15,
      "Epic": 1.35,
      "Legendary": 1.65,
      "Mythic": 2.0
    };
    return multipliers[rarity] || 1.0;
  }
}

class ScenarioGenerator {
  
  static generateBalancedScenarios(): CombatScenario[] {
    return [
      this.createEarlyGameScenario(),
      this.createMidGameScenario(),
      this.createLateGameScenario(),
      this.createBossScenario(),
      this.createAoEScenario(),
      this.createTankTestScenario(),
      this.createBurstRaceScenario(),
      this.createEnduranceScenario(),
      this.createControlTestScenario(),
      this.createSynergyScenario()
    ];
  }
  
  private static createEarlyGameScenario(): CombatScenario {
    return {
      name: "Early Game Clash",
      description: "Combat niveau 10-20, ressources limitées, pas d'ultimates",
      playerTeam: [
        HeroFactory.createHero({ name: "Rookie Tank", role: "Tank", element: "Fire", rarity: "Common", level: 15 }),
        HeroFactory.createHero({ name: "Basic DPS", role: "DPS Melee", element: "Water", rarity: "Common", level: 15 }),
        HeroFactory.createHero({ name: "Healer", role: "Support", element: "Light", rarity: "Rare", level: 15 }),
        HeroFactory.createHero({ name: "Archer", role: "DPS Ranged", element: "Wind", rarity: "Common", level: 15 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Goblin Chief", role: "Tank", element: "Dark", rarity: "Rare", level: 16 }),
        HeroFactory.createHero({ name: "Orc Warrior", role: "DPS Melee", element: "Fire", rarity: "Common", level: 15 }),
        HeroFactory.createHero({ name: "Dark Priest", role: "Support", element: "Dark", rarity: "Rare", level: 14 })
      ],
      specialConditions: {
        turnLimit: 15,
        environmentEffects: ["low_energy_gen"] // Génération énergie réduite
      },
      expectedOutcome: "balanced",
      weight: 0.9
    };
  }
  
  private static createMidGameScenario(): CombatScenario {
    return {
      name: "Mid Game Skirmish",
      description: "Combat équilibré niveau 30-40, mix de raretés",
      playerTeam: [
        HeroFactory.createHero({ name: "Knight", role: "Tank", element: "Light", rarity: "Epic", level: 35 }),
        HeroFactory.createHero({ name: "Berserker", role: "DPS Melee", element: "Fire", rarity: "Rare", level: 35 }),
        HeroFactory.createHero({ name: "Mage", role: "DPS Ranged", element: "Electric", rarity: "Epic", level: 35 }),
        HeroFactory.createHero({ name: "Cleric", role: "Support", element: "Light", rarity: "Rare", level: 35 }),
        HeroFactory.createHero({ name: "Assassin", role: "DPS Melee", element: "Dark", rarity: "Epic", level: 35 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Elite Guard", role: "Tank", element: "Water", rarity: "Epic", level: 36 }),
        HeroFactory.createHero({ name: "Battle Mage", role: "DPS Ranged", element: "Fire", rarity: "Epic", level: 35 }),
        HeroFactory.createHero({ name: "War Priest", role: "Support", element: "Light", rarity: "Rare", level: 34 }),
        HeroFactory.createHero({ name: "Champion", role: "DPS Melee", element: "Electric", rarity: "Epic", level: 36 })
      ],
      expectedOutcome: "balanced",
      weight: 1.0
    };
  }
  
  private static createLateGameScenario(): CombatScenario {
    return {
      name: "Late Game Epic Battle",
      description: "Combat haute intensité niveau 50+, héros légendaires",
      playerTeam: [
        HeroFactory.createHero({ name: "Paladin Lord", role: "Tank", element: "Light", rarity: "Legendary", level: 55 }),
        HeroFactory.createHero({ name: "Dragon Slayer", role: "DPS Melee", element: "Fire", rarity: "Legendary", level: 55 }),
        HeroFactory.createHero({ name: "Archmage", role: "DPS Ranged", element: "Electric", rarity: "Legendary", level: 55 }),
        HeroFactory.createHero({ name: "Divine Oracle", role: "Support", element: "Light", rarity: "Legendary", level: 55 }),
        HeroFactory.createHero({ name: "Shadow Master", role: "DPS Ranged", element: "Dark", rarity: "Epic", level: 55 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Demon Lord", role: "Tank", element: "Dark", rarity: "Legendary", level: 58, 
          statModifiers: { hp: 1.3, atk: 1.2, def: 1.25 } }),
        HeroFactory.createHero({ name: "Infernal Knight", role: "DPS Melee", element: "Fire", rarity: "Legendary", level: 56 }),
        HeroFactory.createHero({ name: "Void Sorcerer", role: "DPS Ranged", element: "Dark", rarity: "Legendary", level: 56 }),
        HeroFactory.createHero({ name: "Chaos Priest", role: "Support", element: "Dark", rarity: "Epic", level: 55 })
      ],
      expectedOutcome: "player_advantage",
      weight: 0.8
    };
  }
  
  private static createBossScenario(): CombatScenario {
    return {
      name: "Boss Fight",
      description: "Combat vs boss unique puissant avec adds",
      playerTeam: [
        HeroFactory.createHero({ name: "Guardian", role: "Tank", element: "Light", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "DPS Main", role: "DPS Ranged", element: "Fire", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "DPS Off", role: "DPS Melee", element: "Electric", rarity: "Rare", level: 40 }),
        HeroFactory.createHero({ name: "Healer", role: "Support", element: "Water", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "Buffer", role: "Support", element: "Light", rarity: "Rare", level: 40 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Ancient Dragon", role: "DPS Ranged", element: "Fire", rarity: "Mythic", level: 50,
          statModifiers: { hp: 2.5, atk: 1.8, def: 1.5, speed: 0.8 } }),
        HeroFactory.createHero({ name: "Dragon Whelp", role: "DPS Melee", element: "Fire", rarity: "Rare", level: 35 }),
        HeroFactory.createHero({ name: "Dragon Whelp", role: "DPS Melee", element: "Fire", rarity: "Rare", level: 35 })
      ],
      specialConditions: {
        bossModifiers: { damage_reduction: 20, status_resistance: 50 },
        turnLimit: 25
      },
      expectedOutcome: "enemy_advantage",
      weight: 0.7
    };
  }
  
  private static createAoEScenario(): CombatScenario {
    return {
      name: "AoE Effectiveness Test",
      description: "Nombreux ennemis faibles pour tester l'AoE",
      playerTeam: [
        HeroFactory.createHero({ name: "AoE Mage", role: "DPS Ranged", element: "Fire", rarity: "Epic", level: 35 }),
        HeroFactory.createHero({ name: "Tank", role: "Tank", element: "Water", rarity: "Rare", level: 35 }),
        HeroFactory.createHero({ name: "Support", role: "Support", element: "Light", rarity: "Rare", level: 35 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Minion 1", role: "DPS Melee", element: "Dark", rarity: "Common", level: 25 }),
        HeroFactory.createHero({ name: "Minion 2", role: "DPS Melee", element: "Dark", rarity: "Common", level: 25 }),
        HeroFactory.createHero({ name: "Minion 3", role: "DPS Ranged", element: "Dark", rarity: "Common", level: 25 }),
        HeroFactory.createHero({ name: "Minion 4", role: "DPS Ranged", element: "Dark", rarity: "Common", level: 25 }),
        HeroFactory.createHero({ name: "Minion 5", role: "DPS Melee", element: "Dark", rarity: "Common", level: 25 }),
        HeroFactory.createHero({ name: "Summoner", role: "Support", element: "Dark", rarity: "Rare", level: 30 })
      ],
      expectedOutcome: "player_advantage",
      weight: 0.6
    };
  }
  
  private static createTankTestScenario(): CombatScenario {
    return {
      name: "Tank Endurance Test",
      description: "Test de survie avec dégâts soutenus",
      playerTeam: [
        HeroFactory.createHero({ name: "Super Tank", role: "Tank", element: "Light", rarity: "Legendary", level: 45 }),
        HeroFactory.createHero({ name: "Healer 1", role: "Support", element: "Water", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "Healer 2", role: "Support", element: "Light", rarity: "Rare", level: 40 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Heavy DPS 1", role: "DPS Ranged", element: "Fire", rarity: "Epic", level: 42 }),
        HeroFactory.createHero({ name: "Heavy DPS 2", role: "DPS Melee", element: "Electric", rarity: "Epic", level: 42 }),
        HeroFactory.createHero({ name: "Heavy DPS 3", role: "DPS Ranged", element: "Dark", rarity: "Epic", level: 42 }),
        HeroFactory.createHero({ name: "Assassin", role: "DPS Melee", element: "Dark", rarity: "Rare", level: 40 })
      ],
      specialConditions: {
        turnLimit: 30 // Combat long pour tester l'endurance
      },
      expectedOutcome: "balanced",
      weight: 0.8
    };
  }
  
  private static createBurstRaceScenario(): CombatScenario {
    return {
      name: "Burst Race",
      description: "Combat rapide, qui tue l'autre en premier",
      playerTeam: [
        HeroFactory.createHero({ name: "Glass Cannon 1", role: "DPS Ranged", element: "Electric", rarity: "Epic", level: 40,
          statModifiers: { atk: 1.5, hp: 0.7, def: 0.6 } }),
        HeroFactory.createHero({ name: "Glass Cannon 2", role: "DPS Melee", element: "Fire", rarity: "Epic", level: 40,
          statModifiers: { atk: 1.5, hp: 0.7, def: 0.6 } }),
        HeroFactory.createHero({ name: "Burst Support", role: "Support", element: "Light", rarity: "Rare", level: 40 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Enemy Burst 1", role: "DPS Ranged", element: "Dark", rarity: "Epic", level: 41,
          statModifiers: { atk: 1.5, hp: 0.7, def: 0.6 } }),
        HeroFactory.createHero({ name: "Enemy Burst 2", role: "DPS Melee", element: "Water", rarity: "Epic", level: 41,
          statModifiers: { atk: 1.5, hp: 0.7, def: 0.6 } }),
        HeroFactory.createHero({ name: "Enemy Support", role: "Support", element: "Dark", rarity: "Rare", level: 40 })
      ],
      specialConditions: {
        turnLimit: 8, // Combat très rapide
        environmentEffects: ["high_energy_gen"] // Plus d'ultimates
      },
      expectedOutcome: "balanced",
      weight: 0.7
    };
  }
  
  private static createEnduranceScenario(): CombatScenario {
    return {
      name: "Endurance Battle",
      description: "Combat de guerre d'usure prolongé",
      playerTeam: [
        HeroFactory.createHero({ name: "Defensive Tank", role: "Tank", element: "Water", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "Sustain DPS", role: "DPS Ranged", element: "Light", rarity: "Rare", level: 40 }),
        HeroFactory.createHero({ name: "Main Healer", role: "Support", element: "Water", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "Off Healer", role: "Support", element: "Light", rarity: "Rare", level: 40 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "Enemy Tank", role: "Tank", element: "Fire", rarity: "Epic", level: 41 }),
        HeroFactory.createHero({ name: "DoT Specialist", role: "DPS Ranged", element: "Dark", rarity: "Rare", level: 40 }),
        HeroFactory.createHero({ name: "Enemy Healer", role: "Support", element: "Dark", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "Debuffer", role: "Support", element: "Water", rarity: "Rare", level: 40 })
      ],
      specialConditions: {
        turnLimit: 40, // Combat très long
        environmentEffects: ["mana_burn"] // Coût énergie augmenté
      },
      expectedOutcome: "balanced",
      weight: 0.6
    };
  }
  
  private static createControlTestScenario(): CombatScenario {
    return {
      name: "Control Effectiveness",
      description: "Test de l'efficacité des sorts de contrôle",
      playerTeam: [
        HeroFactory.createHero({ name: "Controller", role: "Support", element: "Water", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "Disabler", role: "DPS Ranged", element: "Electric", rarity: "Rare", level: 40 }),
        HeroFactory.createHero({ name: "Tank", role: "Tank", element: "Light", rarity: "Rare", level: 40 }),
        HeroFactory.createHero({ name: "Finisher", role: "DPS Melee", element: "Fire", rarity: "Epic", level: 40 })
      ],
      enemyTeam: [
        HeroFactory.createHero({ name: "High DPS 1", role: "DPS Ranged", element: "Fire", rarity: "Epic", level: 42 }),
        HeroFactory.createHero({ name: "High DPS 2", role: "DPS Melee", element: "Dark", rarity: "Epic", level: 42 }),
        HeroFactory.createHero({ name: "Enemy Support", role: "Support", element: "Dark", rarity: "Rare", level: 40 })
      ],
      expectedOutcome: "player_advantage",
      weight: 0.7
    };
  }
  
  private static createSynergyScenario(): CombatScenario {
    return {
      name: "Synergy Test",
      description: "Équipe optimisée vs équipe random pour tester les synergies",
      playerTeam: [
        // Équipe Fire synergy
        HeroFactory.createHero({ name: "Fire Tank", role: "Tank", element: "Fire", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "Fire DPS 1", role: "DPS Melee", element: "Fire", rarity: "Epic", level: 40 }),
        HeroFactory.createHero({ name: "Fire DPS 2", role: "DPS Ranged", element: "Fire", rarity: "Rare", level: 40 }),
        HeroFactory.createHero({ name: "Fire Support", role: "Support", element: "Fire", rarity: "Rare", level: 40 }),
        HeroFactory.createHero({ name: "Fire Mage", role: "DPS Ranged", element: "Fire", rarity: "Epic", level: 40 })
      ],
      enemyTeam: [
        // Équipe mixte sans synergie
        HeroFactory.createHero({ name: "Mixed Tank", role: "Tank", element: "Water", rarity: "Epic", level: 42 }),
        HeroFactory.createHero({ name: "Mixed DPS 1", role: "DPS Melee", element: "Electric", rarity: "Epic", level: 42 }),
        HeroFactory.createHero({ name: "Mixed DPS 2", role: "DPS Ranged", element: "Dark", rarity: "Epic", level: 42 }),
        HeroFactory.createHero({ name: "Mixed Support", role: "Support", element: "Light", rarity: "Rare", level: 41 })
      ],
      expectedOutcome: "player_advantage",
      weight: 0.8
    };
  }
}

// ===== ANALYSEUR PRINCIPAL =====

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
    console.log("\n🔬 === ANALYSE AVANCÉE D'ÉQUILIBRAGE ===\n");
    
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
    
    // Tester le sort dans chaque scénario
    for (const scenario of this.scenarios) {
      const result = await this.testSpellInScenario(spell, scenario);
      scenarioResults[scenario.name] = result;
      
      // Contribuer aux métriques globales
      this.updateMetricsFromScenario(metrics, result, scenario);
    }
    
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
  
  private async testSpellInScenario(spell: BaseSpell, scenario: CombatScenario): Promise<any> {
    // Créer une équipe test avec le sort à analyser
    const testTeam = [...scenario.playerTeam];
    const testHero = testTeam[0]; // Héros principal qui utilisera le sort
    
    // Configurer les sorts du héros test
    const heroSpells: HeroSpells = {
      active1: { id: spell.config.id, level: 5 },
      active2: { id: "basic_attack", level: 1 }, // Sort de base
      // Pas d'ultimate pour focus sur le sort testé
    };
    
    const playerSpells = new Map<string, HeroSpells>();
    playerSpells.set(testHero.heroId, heroSpells);
    
    // Options de combat
    const battleOptions: IBattleOptions = {
      mode: "auto",
      speed: 1
    };
    
    try {
      // Simuler le combat
      const engine = new BattleEngine(
        testTeam,
        scenario.enemyTeam,
        playerSpells,
        new Map(),
        battleOptions
      );
      
      const result = engine.simulateBattle();
      const actions = engine.getActions();
      
      // Analyser les résultats
      return this.analyzeCombatResult(result, actions, testHero.heroId, spell, scenario);
      
    } catch (error) {
      console.warn(`⚠️ Erreur test ${spell.config.id} dans ${scenario.name}: ${error}`);
      return {
        performance: 0,
        impact: "error",
        notes: [`Erreur simulation: ${error}`],
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
    const totalSpellHealing = spellActions.reduce((sum, action) => sum + (action.healing || 0), 0);
    const spellUsageCount = spellActions.length;
    
    const totalDamageInBattle = actions
      .filter(action => action.actorId === testHeroId)
      .reduce((sum, action) => sum + (action.damage || 0), 0);
    
    const spellContribution = totalDamageInBattle > 0 ? (totalSpellDamage / totalDamageInBattle) : 0;
    
    // Calculer performance relative
    let performance = 50; // Base neutre
    
    if (battleResult.victory) {
      performance += 20;
      if (battleResult.totalTurns < 10) performance += 10; // Victoire rapide
    } else {
      performance -= 20;
    }
    
    if (spellUsageCount > 0) {
      performance += Math.min(20, spellUsageCount * 2); // Bonus utilisation
      performance += Math.min(15, spellContribution * 30); // Bonus contribution
    }
    
    // Impact du sort
    let impact = "minimal";
    if (spellContribution > 0.6) impact = "dominant";
    else if (spellContribution > 0.4) impact = "major";
    else if (spellContribution > 0.2) impact = "moderate";
    else if (spellContribution > 0.05) impact = "minor";
    
    const notes: string[] = [];
    if (spellUsageCount === 0) notes.push("Sort jamais utilisé");
    if (spellContribution > 0.8) notes.push("Semble trop puissant");
    if (totalSpellHealing > totalSpellDamage && spell.config.category === "damage") {
      notes.push("Sort de dégâts avec plus de soins que de dégâts");
    }
    
    return {
      performance: Math.max(0, Math.min(100, performance)),
      impact,
      notes,
      spellUsage: spellUsageCount,
      contribution: spellContribution,
      totalSpellDamage,
      totalSpellHealing,
      battleDuration: battleResult.totalTurns,
      victory: battleResult.victory
    };
  }
  
  private updateMetricsFromScenario(
    metrics: AdvancedSpellMetrics, 
    scenarioResult: any, 
    scenario: CombatScenario
  ): void {
    const weight = scenario.weight;
    const performance = scenarioResult.performance / 100; // Normaliser 0-1
    
    // Moyennes pondérées
    metrics.averageDps += performance * weight * 100;
    
    // Métriques spécifiques par scénario
    switch (scenario.name) {
      case "Early Game Clash":
        metrics.earlyGameImpact += performance * 100;
        break;
      case "Late Game Epic Battle":
        metrics.lateGameImpact += performance * 100;
        break;
      case "Boss Fight":
        metrics.bossEffectiveness += performance * 100;
        break;
      case "AoE Effectiveness Test":
        metrics.aoeEffectiveness += performance * 100;
        break;
      case "Burst Race":
        metrics.burstPotential += performance * 100;
        break;
      case "Endurance Battle":
        metrics.sustainedDps += performance * 100;
        break;
      case "Control Effectiveness":
        metrics.utilityScore += performance * 100;
        break;
      case "Tank Endurance Test":
        metrics.survivalContribution += performance * 100;
        break;
      case "Synergy Test":
        metrics.teamSynergy += performance * 100;
        break;
    }
    
    // Métriques de fiabilité
    metrics.reliability += (scenarioResult.spellUsage > 0 ? 1 : 0) * weight * 20;
    metrics.adaptability += performance * weight * 15;
  }
  
  private determineActualRarity(spell: BaseSpell, metrics: AdvancedSpellMetrics): "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" {
    const score = metrics.averageDps;
    
    if (score >= 85) return "Mythic";
    if (score >= 70) return "Legendary";
    if (score >= 55) return "Epic";
    if (score >= 40) return "Rare";
    return "Common";
  }
  
  private calculateOverallScore(metrics: AdvancedSpellMetrics): number {
    return Math.round(
      metrics.averageDps * 0.25 +
      metrics.utilityScore * 0.20 +
      metrics.reliability * 0.15 +
      metrics.adaptability * 0.15 +
      metrics.teamSynergy * 0.15 +
      metrics.burstPotential * 0.10
    );
  }
  
  private calculateBalanceScore(metrics: AdvancedSpellMetrics, spell: BaseSpell): number {
    // Score basé sur l'écart aux attentes selon le type de sort
    const expectedScore = this.getExpectedScore(spell);
    const actualScore = metrics.averageDps;
    
    const deviation = Math.abs(actualScore - expectedScore) / expectedScore;
    return Math.max(0, 100 - deviation * 100);
  }
  
  private getExpectedScore(spell: BaseSpell): number {
    const energyCost = spell.getEnergyCost(5);
    const cooldown = spell.getEffectiveCooldown({ stats: { speed: 100 } }, 5);
    
    if (spell.config.type === "ultimate") return 80;
    if (energyCost > 50) return 70;
    if (cooldown > 5) return 60;
    return 50;
  }
  
  private calculateDesignScore(metrics: AdvancedSpellMetrics, spell: BaseSpell): number {
    let score = 50;
    
    // Bonus si le sort a une niche claire
    if (metrics.bossEffectiveness > 70 || metrics.aoeEffectiveness > 70) score += 15;
    if (metrics.earlyGameImpact > 60 && metrics.lateGameImpact < 40) score += 10; // Bon early game spell
    if (metrics.utilityScore > 60 && spell.config.category !== "damage") score += 15;
    
    // Malus si le sort est trop généraliste ou trop faible
    if (metrics.reliability < 30) score -= 20;
    if (metrics.adaptability < 20) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }
  
  private determineArchetypes(metrics: AdvancedSpellMetrics, spell: BaseSpell): string[] {
    const archetypes: string[] = [];
    
    if (metrics.burstPotential > 70) archetypes.push("burst");
    if (metrics.sustainedDps > 70) archetypes.push("sustain");
    if (metrics.utilityScore > 60) archetypes.push("utility");
    if (metrics.survivalContribution > 60) archetypes.push("defensive");
    if (metrics.aoeEffectiveness > 70) archetypes.push("aoe");
    if (metrics.bossEffectiveness > 70) archetypes.push("single_target");
    
    return archetypes.length > 0 ? archetypes : ["generic"];
  }
  
  private determineOptimalUseCase(metrics: AdvancedSpellMetrics, scenarioResults: Record<string, any>): string {
    const bestScenario = Object.entries(scenarioResults)
      .reduce((best, [name, result]) => 
        result.performance > best.performance ? { name, performance: result.performance } : best,
        { name: "", performance: 0 }
      );
    
    return `Optimal dans: ${bestScenario.name} (${bestScenario.performance}% performance)`;
  }
  
  private determineGameplayRole(metrics: AdvancedSpellMetrics): string {
    if (metrics.averageDps > 75 && metrics.reliability > 70) return "core";
    if (metrics.utilityScore > 70) return "support";
    if (metrics.bossEffectiveness > 80 || metrics.aoeEffectiveness > 80) return "situational";
    return "niche";
  }
  
  private determineBalanceStatus(metrics: AdvancedSpellMetrics, spell: BaseSpell): "underpowered" | "balanced" | "strong" | "overpowered" | "broken" {
    const score = metrics.averageDps;
    const reliability = metrics.reliability;
    
    if (score < 25 || reliability < 20) return "underpowered";
    if (score > 90 && reliability > 80) return "broken";
    if (score > 80) return "overpowered";
    if (score > 65) return "strong";
    return "balanced";
  }
  
  private generateRecommendations(metrics: AdvancedSpellMetrics, spell: BaseSpell): any {
    const immediate: string[] = [];
    const design: string[] = [];
    const synergy: string[] = [];
    
    if (metrics.reliability < 30) {
      immediate.push("Réduire coût énergie ou cooldown - sort trop peu utilisé");
    }
    
    if (metrics.averageDps < 30) {
      immediate.push(`Augmenter dégâts de ${Math.round((40 - metrics.averageDps) * 2)}%`);
    }
    
    if (metrics.averageDps > 85) {
      immediate.push(`Réduire dégâts de ${Math.round((metrics.averageDps - 70) * 1.5)}%`);
    }
    
    if (metrics.utilityScore < 20 && spell.config.category !== "damage") {
      design.push("Ajouter effets secondaires (buffs/debuffs/contrôle)");
    }
    
    if (metrics.teamSynergy < 30) {
      synergy.push("Considérer des effets de synergie élémentaire");
    }
    
    return { immediate, design, synergy };
  }
  
  private generateComparativeAnalysis(): void {
    // Ici on pourrait faire des comparaisons entre sorts similaires
    // Identifier les outliers, etc.
    console.log("   🔄 Analyse comparative terminée");
  }
  
  private generateComprehensiveReport(): any {
    const results = Array.from(this.spellResults.values());
    
    return {
      metadata: {
        timestamp: new Date().toISOString(),
        version: "3.0.0-advanced",
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
      critical.push(`${brokenSpells.length} sorts cassés nécessitent une correction immédiate`);
    }
    
    if (underpowered.length > results.length * 0.3) {
      balance.push(`Trop de sorts faibles (${underpowered.length}/${results.length}) - revoir les formules de base`);
    }
    
    const lowReliability = results.filter(r => r.metrics.reliability < 30);
    if (lowReliability.length > 0) {
      design.push(`${lowReliability.length} sorts peu fiables - revoir coûts et cooldowns`);
    }
    
    return { critical, balance, design };
  }
  
  private saveReport(report: any): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `advanced_balance_${timestamp}.json`;
    const outputPath = path.join(process.cwd(), 'logs', 'balance', filename);
    
    // Créer le dossier si nécessaire
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`💾 Rapport sauvegardé: ${filename}`);
  }
  
  private displayKeyFindings(): void {
    const results = Array.from(this.spellResults.values());
    
    console.log("🎯 === RÉSULTATS CLÉS ===\n");
    
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
      problematic.forEach(spell => {
        console.log(`   🚨 ${spell.spellName}: ${spell.balanceStatus} (${spell.overallScore}/100)`);
        if (spell.recommendations.immediate.length > 0) {
          console.log(`      → ${spell.recommendations.immediate[0]}`);
        }
      });
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
    // Connexion MongoDB
    const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";
    await mongoose.connect(MONGO_URI);
    
    // Lancement de l'analyse
    const analyzer = new AdvancedBalanceAnalyzer();
    await analyzer.initializeSystems();
    await analyzer.runCompleteAnalysis();
    
  } catch (error) {
    console.error("❌ Erreur lors de l'analyse:", error);
  } finally {
    await mongoose.disconnect();
  }
}

// Exécution si script appelé directement
if (require.main === module) {
  runAdvancedBalanceAnalysis().then(() => process.exit(0));
}

export { AdvancedBalanceAnalyzer, runAdvancedBalanceAnalysis };

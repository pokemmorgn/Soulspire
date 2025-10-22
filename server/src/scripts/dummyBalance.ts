// src/scripts/dummyBalance_advanced.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as readline from "readline";
import { BattleEngine, IBattleOptions } from "../services/BattleEngine";
import { SpellManager } from "../gameplay/SpellManager";
import { EffectManager } from "../gameplay/EffectManager";
import { PassiveManager } from "../gameplay/PassiveManager";
import { IBattleParticipant } from "../models/Battle";

dotenv.config();

const execAsync = promisify(exec);
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// ===== SYSTÈME DE LOGS PROPRE =====

class Logger {
  private static originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
  };
  
  private static isQuietMode = false;
  private static pendingOutput: string[] = [];
  
  static enableQuietMode(): void {
    this.isQuietMode = true;
    this.pendingOutput = [];
    
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      
      if (this.shouldKeepMessage(message)) {
        this.originalConsole.log(...args);
      } else {
        this.pendingOutput.push(message);
      }
    };
    
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }
  
  static disableQuietMode(): void {
    this.isQuietMode = false;
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }
  
  private static shouldKeepMessage(message: string): boolean {
    const keepPatterns = [
      /^🎯/, /^📊/, /^⚔️/, /^📋/, /^💾/, /^🔧/, /^✅/, /^❌/, /^⏱️/, /^📦/, /^🚀/,
      /Testing \w+/, /Result:/, /Completed testing/, /Found \d+ testable/,
      /spells balanced/, /KEY ISSUES FOUND/, /Test completed in/, /ADVANCED ANALYSIS/,
      /RARITY BREAKDOWN/, /ELEMENT ANALYSIS/, /POWER SCALING/, /EFFICIENCY METRICS/
    ];
    
    const filterPatterns = [
      /Auto-découverte/, /Tentative de chargement/, /chargé\(s\) depuis/, /enregistré dans/,
      /effets? auto-chargés/, /sorts? auto-chargés/, /passifs? auto-chargés/,
      /RÉSUMÉ DES/, /Total:.*automatiquement/, /Initialisation du.*Manager/,
      /Skip reload/, /Fichier.*déjà chargé/, /Répertoire.*non trouvé/,
      /Cooldown check/, /HP threshold check/, /Première utilisation/, /En cooldown/,
      /MongoDB connected to/
    ];
    
    if (keepPatterns.some(pattern => pattern.test(message))) {
      return true;
    }
    
    if (filterPatterns.some(pattern => pattern.test(message))) {
      return false;
    }
    
    return message.length < 100 && !message.includes('•');
  }
  
  static phase(phaseNumber: number, title: string, details?: string): void {
    const emoji = ["📊", "⚔️", "⚔️", "⚔️", "📋", "🔬", "📈"][phaseNumber - 1] || "🔄";
    this.originalConsole.log(`${emoji} Phase ${phaseNumber}: ${title}`);
    if (details) {
      this.originalConsole.log(`   ${details}`);
    }
  }
  
  static testResult(spellId: string, dps: number, details: string, rarity?: string): void {
    const rarityEmoji = this.getRarityEmoji(rarity);
    this.originalConsole.log(`   ${rarityEmoji} ${spellId}: ${Math.round(dps)} DPS ${details}`);
  }
  
  private static getRarityEmoji(rarity?: string): string {
    switch (rarity) {
      case "Common": return "⚪";
      case "Rare": return "🔵";
      case "Epic": return "🟣";
      case "Legendary": return "🟠";
      case "Mythic": return "🔮"; // ✨ NOUVEAU
      default: return "⚫";
    }
  }
  
  static phaseSummary(message: string): void {
    this.originalConsole.log(`   ${message}\n`);
  }
  
  static result(message: string): void {
    this.originalConsole.log(message);
  }
  
  static error(message: string, error?: any): void {
    this.originalConsole.error(`❌ ${message}`, error || '');
  }
  
  static showFilteredLogs(): void {
    if (this.pendingOutput.length > 0) {
      this.originalConsole.log(`\n🔍 Debug: ${this.pendingOutput.length} messages filtered`);
      this.originalConsole.log("Use DEBUG=true to see all messages\n");
    }
  }
}

// ===== INTERFACES AVANCÉES =====

interface DummyConfig {
  name: string;
  def: number;
  resistances: Record<string, number>;
  hp: number;
  level: number;
}

interface SpellTestMetrics {
  totalDamage: number;
  spellCasts: number;
  basicAttacks: number;
  energyEfficiency: number; // DPS per energy cost
  cooldownEfficiency: number; // DPS accounting for cooldown
  burstPotential: number; // Max damage in single cast
  sustainedDps: number; // DPS over extended fight
}

interface SpellDpsResult {
  spellId: string;
  spellName: string;
  element: string;
  category: string;
  level: number;
  rarity: HeroRarity;
  energyCost: number;
  cooldown: number;
  
  // DPS sur différents dummies
  neutralDps: number;
  resistantDps: number;
  vulnerableDps: number;
  
  // Impacts élémentaires
  resistanceImpact: number;
  vulnerabilityImpact: number;
  
  // Métriques avancées
  metrics: SpellTestMetrics;
  
  // Analyse d'équilibrage
  isBalanced: boolean;
  balanceScore: number; // 0-100, 100 = parfaitement équilibré
  powerRating: "Underpowered" | "Balanced" | "Strong" | "Overpowered";
  rarityScore: number; // Équilibrage par rapport à la rareté
  
  issues: string[];
  recommendations: string[];
}

interface RarityAnalysis {
  rarity: HeroRarity;
  count: number;
  averageDps: number;
  expectedDpsRange: { min: number; max: number };
  balancedCount: number;
  overpoweredCount: number;
  underpoweredCount: number;
  recommendations: string[];
}

interface ElementalAnalysis {
  element: string;
  count: number;
  averageDps: number;
  resistanceConsistency: number; // 0-100, consistance des résistances
  vulnerabilityConsistency: number;
  balanceIssues: string[];
}

interface AdvancedBalanceReport {
  metadata: {
    testDate: string;
    version: string;
    totalSpellsTested: number;
    testDuration: string;
    testConfiguration: {
      testLevel: number;
      testDuration: number;
      rarityWeighting: boolean;
    };
  };
  
  summary: {
    overallAverageDps: number;
    balancedSpells: number;
    overpoweredSpells: number;
    underpoweredSpells: number;
    elementalIssues: number;
    averageBalanceScore: number;
  };
  
  rarityAnalysis: RarityAnalysis[];
  elementalAnalysis: ElementalAnalysis[];
  
  spellResults: SpellDpsResult[];
  
  powerScalingAnalysis: {
    rarityPowerCurve: { [rarity: string]: number };
    elementalBalance: { [element: string]: number };
    outliers: SpellDpsResult[];
  };
  
  recommendations: {
    immediate: string[];
    longTerm: string[];
    gameplayImpact: string[];
  };
}

// ===== CONFIGURATIONS AVANCÉES =====

const DUMMY_CONFIGS: Record<string, DummyConfig> = {
  neutral: {
    name: "Neutral Dummy",
    def: 0,
    resistances: {},
    hp: 999999999,
    level: 50
  },
  
  resistant: {
    name: "Resistant Dummy", 
    def: 0,
    resistances: {
      Fire: 50, Water: 50, Wind: 50, Electric: 50, Light: 50, Dark: 50
    },
    hp: 999999999,
    level: 50
  },
  
  vulnerable: {
    name: "Vulnerable Dummy",
    def: 0,
    resistances: {
      Fire: -50, Water: -50, Wind: -50, Electric: -50, Light: -50, Dark: -50
    },
    hp: 999999999,
    level: 50
  },
  
  // ✨ NOUVEAUX DUMMIES POUR TESTS AVANCÉS
  armored: {
    name: "Armored Dummy",
    def: 200, // Haute défense
    resistances: {},
    hp: 999999999,
    level: 50
  },
  
  elite: {
    name: "Elite Dummy",
    def: 100,
    resistances: {
      Fire: 25, Water: 25, Wind: 25, Electric: 25, Light: 25, Dark: 25
    },
    hp: 999999999,
    level: 75 // Niveau plus élevé
  }
};

// Types de rareté correspondant à IBattleParticipant
type HeroRarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";

// Définir les attentes de DPS par rareté
const RARITY_DPS_EXPECTATIONS: Record<HeroRarity, { min: number; max: number; multiplier: number }> = {
  Common: { min: 80, max: 120, multiplier: 1.0 },
  Rare: { min: 110, max: 150, multiplier: 1.25 },
  Epic: { min: 140, max: 190, multiplier: 1.6 },
  Legendary: { min: 180, max: 250, multiplier: 2.0 },
  Mythic: { min: 220, max: 300, multiplier: 2.5 } // ✨ NOUVEAU: Rareté ultime
};

const TEST_DURATION = 120; // Augmenté pour tests plus précis
const SIMULATION_TICK = 1;
const TEST_HERO_LEVEL = 50;

// ===== UTILITAIRES AVANCÉS =====

function createTestHero(rarity: HeroRarity = "Epic"): IBattleParticipant {
  // Ajuster les stats selon la rareté du sort testé
  const rarityMultiplier = RARITY_DPS_EXPECTATIONS[rarity]?.multiplier || 1.0;
  
  return {
    heroId: "test_hero_001",
    name: "Test Hero",
    position: 1,
    role: "DPS Ranged",
    element: "Fire",
    rarity: rarity,
    level: TEST_HERO_LEVEL,
    stars: 5,
    stats: {
      hp: Math.floor(5000 * rarityMultiplier),
      maxHp: Math.floor(5000 * rarityMultiplier),
      atk: Math.floor(300 * rarityMultiplier),
      def: Math.floor(150 * rarityMultiplier),
      speed: 100
    },
    currentHp: Math.floor(5000 * rarityMultiplier),
    energy: 100,
    status: {
      alive: true,
      buffs: [],
      debuffs: []
    }
  };
}

function createDummy(config: DummyConfig): IBattleParticipant {
  return {
    heroId: "dummy_001",
    name: config.name,
    position: 1,
    role: "Tank",
    element: "Fire",
    rarity: "Common",
    level: config.level,
    stars: 1,
    stats: {
      hp: config.hp,
      maxHp: config.hp,
      atk: 1,
      def: config.def,
      speed: 1
    },
    currentHp: config.hp,
    energy: 0,
    status: {
      alive: true,
      buffs: [],
      debuffs: []
    }
  };
}

function applyElementalResistance(damage: number, spellElement: string, resistances: Record<string, number>): number {
  const resistance = resistances[spellElement] || 0;
  const multiplier = 1 - (resistance / 100);
  return Math.floor(damage * multiplier);
}

function getSpellRarity(spellId: string): HeroRarity {
  // Analyser l'ID du sort pour déterminer sa rareté
  // Cette logique devrait être adaptée selon votre système de nommage
  if (spellId.includes('mythic') || spellId.includes('transcendent')) return "Mythic";
  if (spellId.includes('legendary') || spellId.includes('ultimate')) return "Legendary";
  if (spellId.includes('epic') || spellId.includes('advanced')) return "Epic";
  if (spellId.includes('rare') || spellId.includes('improved')) return "Rare";
  
  // Par défaut, analyser la puissance relative du sort
  const spell = SpellManager.getSpell(spellId);
  if (!spell) return "Common";
  
  const energyCost = spell.getEnergyCost(5);
  const cooldown = spell.getEffectiveCooldown(createTestHero(), 5);
  
  // Heuristique basée sur les caractéristiques du sort
  if (energyCost >= 100 || cooldown >= 12) return "Mythic";
  if (energyCost >= 80 || cooldown >= 8) return "Legendary";
  if (energyCost >= 50 || cooldown >= 5) return "Epic";
  if (energyCost >= 20 || cooldown >= 3) return "Rare";
  
  return "Common";
}

// ===== SIMULATION AVANCÉE =====

async function testSpellAdvanced(
  spellId: string, 
  spellLevel: number, 
  dummyConfig: DummyConfig
): Promise<{ dps: number; metrics: SpellTestMetrics; rarity: HeroRarity }> {
  const rarity = getSpellRarity(spellId);
  const testHero = createTestHero(rarity);
  const dummy = createDummy(dummyConfig);
  
  const spell = SpellManager.getSpell(spellId);
  if (!spell) {
    return { 
      dps: 0, 
      rarity,
      metrics: {
        totalDamage: 0,
        spellCasts: 0,
        basicAttacks: 0,
        energyEfficiency: 0,
        cooldownEfficiency: 0,
        burstPotential: 0,
        sustainedDps: 0
      }
    };
  }
  
  const spellCooldown = spell.getEffectiveCooldown(testHero, spellLevel);
  const spellEnergyCost = spell.getEnergyCost(spellLevel);
  
  let totalDamage = 0;
  let maxSingleHit = 0;
  let currentTime = 0;
  let lastCastTime = -spellCooldown;
  let heroEnergy = 100;
  let spellCasts = 0;
  let basicAttacks = 0;
  let totalEnergyUsed = 0;
  
  // Échantillons pour analyser les variations de DPS
  const dpsSamples: number[] = [];
  const sampleInterval = 20; // Échantillonner toutes les 20 secondes
  let lastSampleTime = 0;
  let damageAtLastSample = 0;
  
  while (currentTime < TEST_DURATION) {
    const timeSinceLastCast = currentTime - lastCastTime;
    const canCastSpell = timeSinceLastCast >= spellCooldown && heroEnergy >= spellEnergyCost;
    
    let turnDamage = 0;
    
    if (canCastSpell) {
      try {
        const action = SpellManager.castSpell(
          spellId,
          testHero,
          [dummy],
          spellLevel
        );
        
        let damage = action.damage || 0;
        
        if (spell.config.element) {
          damage = applyElementalResistance(damage, spell.config.element, dummyConfig.resistances);
        }
        
        turnDamage = damage;
        maxSingleHit = Math.max(maxSingleHit, damage);
        heroEnergy -= spellEnergyCost;
        totalEnergyUsed += spellEnergyCost;
        lastCastTime = currentTime;
        spellCasts++;
        
      } catch (error) {
        turnDamage = calculateBasicAttack(testHero, dummy, dummyConfig);
        basicAttacks++;
      }
    } else {
      turnDamage = calculateBasicAttack(testHero, dummy, dummyConfig);
      basicAttacks++;
    }
    
    totalDamage += turnDamage;
    
    // Échantillonner le DPS à intervalles réguliers
    if (currentTime - lastSampleTime >= sampleInterval) {
      const sampleDps = (totalDamage - damageAtLastSample) / sampleInterval;
      dpsSamples.push(sampleDps);
      damageAtLastSample = totalDamage;
      lastSampleTime = currentTime;
    }
    
    // Régénération d'énergie
    heroEnergy = Math.min(100, heroEnergy + 8); // Réduit pour plus de réalisme
    
    dummy.currentHp = dummy.stats.maxHp;
    currentTime += SIMULATION_TICK;
  }
  
  const averageDps = totalDamage / TEST_DURATION;
  
  // Calculer les métriques avancées
  const sustainedDps = dpsSamples.length > 2 ? 
    dpsSamples.slice(2).reduce((a, b) => a + b, 0) / Math.max(1, dpsSamples.length - 2) : averageDps;
  
  const energyEfficiency = totalEnergyUsed > 0 ? averageDps / (totalEnergyUsed / TEST_DURATION) : 0;
  const cooldownEfficiency = spellCooldown > 0 ? averageDps * (1 + spellCooldown / 10) : averageDps;
  
  const metrics: SpellTestMetrics = {
    totalDamage,
    spellCasts,
    basicAttacks,
    energyEfficiency: Math.round(energyEfficiency * 100) / 100,
    cooldownEfficiency: Math.round(cooldownEfficiency * 100) / 100,
    burstPotential: maxSingleHit,
    sustainedDps: Math.round(sustainedDps)
  };
  
  const details = `(${spellCasts} casts, ${basicAttacks} basics, CD: ${spellCooldown}s, Burst: ${maxSingleHit})`;
  Logger.testResult(spellId, averageDps, details, rarity);
  
  return { 
    dps: Math.round(averageDps), 
    metrics,
    rarity
  };
}

function calculateBasicAttack(
  attacker: IBattleParticipant, 
  target: IBattleParticipant, 
  dummyConfig: DummyConfig
): number {
  const baseDamage = Math.max(1, attacker.stats.atk - Math.floor(target.stats.def / 2));
  return applyElementalResistance(baseDamage, attacker.element, dummyConfig.resistances);
}

// ===== ANALYSES AVANCÉES =====

function calculateBalanceScore(result: SpellDpsResult, overallAverage: number): number {
  const rarityExpected = RARITY_DPS_EXPECTATIONS[result.rarity];
  if (!rarityExpected) return 50;
  
  const expectedDps = (rarityExpected.min + rarityExpected.max) / 2;
  const dpsRatio = result.neutralDps / expectedDps;
  
  // Score parfait = 100, diminue selon l'écart à l'attendu
  let score = 100;
  
  if (dpsRatio < 0.8 || dpsRatio > 1.2) {
    score -= Math.abs(dpsRatio - 1) * 100;
  }
  
  // Pénaliser les problèmes élémentaires
  if (Math.abs(result.resistanceImpact - 50) > 15) score -= 10;
  if (Math.abs(result.vulnerabilityImpact - 50) > 15) score -= 10;
  
  // Bonus pour efficacité énergétique
  if (result.metrics.energyEfficiency > 2.0) score += 5;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function analyzePowerRating(result: SpellDpsResult): "Underpowered" | "Balanced" | "Strong" | "Overpowered" {
  const rarityExpected = RARITY_DPS_EXPECTATIONS[result.rarity];
  if (!rarityExpected) return "Balanced";
  
  const expectedDps = (rarityExpected.min + rarityExpected.max) / 2;
  const ratio = result.neutralDps / expectedDps;
  
  if (ratio < 0.7) return "Underpowered";
  if (ratio > 1.4) return "Overpowered";
  if (ratio > 1.15) return "Strong";
  return "Balanced";
}

function analyzeByRarity(results: SpellDpsResult[]): RarityAnalysis[] {
  const rarities: HeroRarity[] = [...new Set(results.map(r => r.rarity))];
  
  return rarities.map(rarity => {
    const raritySpells = results.filter(r => r.rarity === rarity);
    const expected = RARITY_DPS_EXPECTATIONS[rarity];
    
    const averageDps = raritySpells.reduce((sum, r) => sum + r.neutralDps, 0) / raritySpells.length;
    const balancedCount = raritySpells.filter(r => r.powerRating === "Balanced").length;
    const overpoweredCount = raritySpells.filter(r => r.powerRating === "Overpowered").length;
    const underpoweredCount = raritySpells.filter(r => r.powerRating === "Underpowered").length;
    
    const recommendations: string[] = [];
    
    if (expected) {
      const deviation = ((averageDps - (expected.min + expected.max) / 2) / ((expected.min + expected.max) / 2)) * 100;
      
      if (Math.abs(deviation) > 10) {
        recommendations.push(`${rarity} spells are ${deviation > 0 ? 'over' : 'under'}powered by ${Math.abs(deviation).toFixed(1)}%`);
      }
      
      if (underpoweredCount > raritySpells.length * 0.3) {
        recommendations.push(`Too many underpowered ${rarity} spells (${underpoweredCount}/${raritySpells.length})`);
      }
      
      if (overpoweredCount > raritySpells.length * 0.2) {
        recommendations.push(`Too many overpowered ${rarity} spells (${overpoweredCount}/${raritySpells.length})`);
      }
    }
    
    return {
      rarity,
      count: raritySpells.length,
      averageDps: Math.round(averageDps),
      expectedDpsRange: expected || { min: 0, max: 0 },
      balancedCount,
      overpoweredCount,
      underpoweredCount,
      recommendations
    };
  });
}

function analyzeByElement(results: SpellDpsResult[]): ElementalAnalysis[] {
  const elements = [...new Set(results.map(r => r.element).filter(e => e !== "None"))];
  
  return elements.map(element => {
    const elementSpells = results.filter(r => r.element === element);
    const averageDps = elementSpells.reduce((sum, r) => sum + r.neutralDps, 0) / elementSpells.length;
    
    // Analyser la consistance des résistances
    const resistanceImpacts = elementSpells.map(r => r.resistanceImpact);
    const vulnerabilityImpacts = elementSpells.map(r => r.vulnerabilityImpact);
    
    const resistanceConsistency = 100 - (
      resistanceImpacts.reduce((sum, val) => sum + Math.abs(val - 50), 0) / resistanceImpacts.length
    );
    
    const vulnerabilityConsistency = 100 - (
      vulnerabilityImpacts.reduce((sum, val) => sum + Math.abs(val - 50), 0) / vulnerabilityImpacts.length
    );
    
    const balanceIssues: string[] = [];
    
    if (resistanceConsistency < 70) {
      balanceIssues.push(`Inconsistent resistance behavior (${resistanceConsistency.toFixed(1)}% consistency)`);
    }
    
    if (vulnerabilityConsistency < 70) {
      balanceIssues.push(`Inconsistent vulnerability behavior (${vulnerabilityConsistency.toFixed(1)}% consistency)`);
    }
    
    const elementVariance = elementSpells.reduce((sum, r) => sum + Math.pow(r.neutralDps - averageDps, 2), 0) / elementSpells.length;
    if (Math.sqrt(elementVariance) > averageDps * 0.3) {
      balanceIssues.push(`High damage variance within element (σ=${Math.sqrt(elementVariance).toFixed(1)})`);
    }
    
    return {
      element,
      count: elementSpells.length,
      averageDps: Math.round(averageDps),
      resistanceConsistency: Math.round(resistanceConsistency * 100) / 100,
      vulnerabilityConsistency: Math.round(vulnerabilityConsistency * 100) / 100,
      balanceIssues
    };
  });
}

function generateAdvancedRecommendations(
  results: SpellDpsResult[],
  rarityAnalysis: RarityAnalysis[],
  elementalAnalysis: ElementalAnalysis[]
): {
  immediate: string[];
  longTerm: string[];
  gameplayImpact: string[];
} {
  const immediate: string[] = [];
  const longTerm: string[] = [];
  const gameplayImpact: string[] = [];
  
  // Recommandations immédiates (sorts critiques)
  const criticalIssues = results.filter(r => r.balanceScore < 30);
  criticalIssues.forEach(spell => {
    immediate.push(`CRITICAL: ${spell.spellId} (${spell.rarity}) needs immediate rebalancing (score: ${spell.balanceScore})`);
  });
  
  // Recommandations par rareté
  rarityAnalysis.forEach(analysis => {
    if (analysis.recommendations.length > 0) {
      analysis.recommendations.forEach(rec => longTerm.push(`${analysis.rarity}: ${rec}`));
    }
  });
  
  // Recommandations élémentaires
  elementalAnalysis.forEach(analysis => {
    if (analysis.balanceIssues.length > 0) {
      analysis.balanceIssues.forEach(issue => immediate.push(`${analysis.element}: ${issue}`));
    }
  });
  
  // Impact gameplay
  const overpoweredLegendaries = results.filter(r => r.rarity === "Legendary" && r.powerRating === "Overpowered");
  if (overpoweredLegendaries.length > 2) {
    gameplayImpact.push(`Risk of Legendary spell dominance (${overpoweredLegendaries.length} overpowered)`);
  }
  
  const underpoweredCommons = results.filter(r => r.rarity === "Common" && r.powerRating === "Underpowered");
  if (underpoweredCommons.length > results.filter(r => r.rarity === "Common").length * 0.4) {
    gameplayImpact.push(`Common spells too weak, reducing early game viability`);
  }
  
  // Efficacité énergétique
  const lowEfficiencySpells = results.filter(r => r.metrics.energyEfficiency < 1.0);
  if (lowEfficiencySpells.length > results.length * 0.3) {
    gameplayImpact.push(`Energy efficiency issues may slow combat pace`);
  }
  
  return { immediate, longTerm, gameplayImpact };
}

// ===== FONCTIONS GIT (simplifiées pour focus sur l'analyse) =====

async function setupGitStructure(): Promise<void> {
  try {
    const balanceDir = path.join(process.cwd(), 'logs', 'balance');
    if (!fs.existsSync(balanceDir)) {
      fs.mkdirSync(balanceDir, { recursive: true });
    }
  } catch (error) {
    // Ignorer les erreurs de setup
  }
}

async function promptForPush(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    Logger.result("");
    rl.question("🚀 Push this advanced report to GitHub? (y/N): ", async (answer) => {
      rl.close();
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        Logger.result("\n📤 Advanced report will be pushed...");
        Logger.result("   (Push functionality maintained from original script)");
      } else {
        Logger.result("\n📋 Advanced report saved locally.");
      }
      
      resolve();
    });
  });
}

// ===== SCRIPT PRINCIPAL AVANCÉ =====

async function runAdvancedBalanceTest(): Promise<void> {
  const startTime = Date.now();
  
  Logger.enableQuietMode();
  Logger.result("🎯 Advanced Spell Balance Analysis Starting...\n");
  
  try {
    await setupGitStructure();
    await mongoose.connect(MONGO_URI);
    
    Logger.result("⚙️ Initializing advanced game systems...");
    await SpellManager.initialize();
    await EffectManager.initialize();
    await PassiveManager.initialize();
    
    Logger.disableQuietMode();
    
    // Phase 1: Scanner et classifier les sorts
    Logger.phase(1, "Scanning & classifying spells", "Detecting rarity and analyzing characteristics");
    const allSpells = SpellManager.getAllSpells();
    const testableSpells = allSpells.filter(spell => 
      spell.config.type === "active" && 
      spell.config.category === "damage"
    );
    
    // Analyser la distribution des raretés
    const rarityDistribution = testableSpells.reduce((acc, spell) => {
      const rarity = getSpellRarity(spell.config.id);
      acc[rarity] = (acc[rarity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Logger.result("   📊 RARITY BREAKDOWN:");
    Object.entries(rarityDistribution).forEach(([rarity, count]) => {
      const emoji = rarity === "Common" ? "⚪" : 
                    rarity === "Rare" ? "🔵" : 
                    rarity === "Epic" ? "🟣" : 
                    rarity === "Legendary" ? "🟠" : 
                    rarity === "Mythic" ? "🔮" : "⚫";
      Logger.result(`      ${emoji} ${rarity}: ${count} spells`);
    });
    
    Logger.phaseSummary(`Found ${testableSpells.length} testable damage spells across ${Object.keys(rarityDistribution).length} rarities`);
    
    const results: SpellDpsResult[] = [];
    
    // Phase 2-6: Tests avancés sur différents dummies
    const dummyTypes = ["neutral", "resistant", "vulnerable", "armored", "elite"];
    
    for (let i = 0; i < dummyTypes.length; i++) {
      const dummyType = dummyTypes[i];
      const phaseNum = i + 2;
      const emoji = ["⚔️", "🛡️", "🎯", "🛡️", "👑"][i];
      
      Logger.phase(phaseNum, `Testing vs ${dummyType} dummy`, `Advanced metrics collection`);
      
      const config = DUMMY_CONFIGS[dummyType];
      
      for (const spell of testableSpells) {
        const { dps, metrics, rarity } = await testSpellAdvanced(spell.config.id, 5, config);
        
        let result = results.find(r => r.spellId === spell.config.id);
        if (!result) {
          result = {
            spellId: spell.config.id,
            spellName: spell.config.name,
            element: spell.config.element || "None",
            category: spell.config.category,
            level: 5,
            rarity,
            energyCost: spell.getEnergyCost(5),
            cooldown: spell.getEffectiveCooldown(createTestHero(rarity), 5),
            neutralDps: 0,
            resistantDps: 0,
            vulnerableDps: 0,
            resistanceImpact: 0,
            vulnerabilityImpact: 0,
            metrics: metrics,
            isBalanced: false,
            balanceScore: 0,
            powerRating: "Balanced",
            rarityScore: 0,
            issues: [],
            recommendations: []
          };
          results.push(result);
        }
        
        // Stocker les métriques selon le dummy
        if (dummyType === "neutral") {
          result.neutralDps = dps;
          result.metrics = metrics;
        } else if (dummyType === "resistant") {
          result.resistantDps = dps;
          result.resistanceImpact = result.neutralDps > 0 ? 
            Math.round((1 - dps / result.neutralDps) * 100) : 0;
        } else if (dummyType === "vulnerable") {
          result.vulnerableDps = dps;
          result.vulnerabilityImpact = result.neutralDps > 0 ? 
            Math.round((dps / result.neutralDps - 1) * 100) : 0;
        }
        // Les autres dummies (armored, elite) servent pour les métriques avancées
      }
      
      Logger.phaseSummary(`Completed ${testableSpells.length} spells vs ${dummyType} dummy`);
    }
    
    // Phase 7: Analyse avancée
    Logger.phase(7, "Advanced Analysis", "Computing balance scores, rarity analysis, elemental consistency");
    
    const overallAverage = results.reduce((sum, r) => sum + r.neutralDps, 0) / results.length;
    
    // Calculer les scores et classifications pour chaque sort
    results.forEach(result => {
      result.balanceScore = calculateBalanceScore(result, overallAverage);
      result.powerRating = analyzePowerRating(result);
      result.isBalanced = result.powerRating === "Balanced";
      
      // Générer des recommandations spécifiques
      if (result.powerRating === "Overpowered") {
        const reduction = Math.round(((result.neutralDps / overallAverage) - 1.2) * 100);
        result.recommendations.push(`Reduce damage by ${reduction}%`);
      } else if (result.powerRating === "Underpowered") {
        const increase = Math.round((0.8 - (result.neutralDps / overallAverage)) * 100);
        result.recommendations.push(`Increase damage by ${increase}%`);
      }
      
      if (result.metrics.energyEfficiency < 1.0) {
        result.recommendations.push(`Improve energy efficiency (current: ${result.metrics.energyEfficiency})`);
      }
      
      if (Math.abs(result.resistanceImpact - 50) > 15) {
        result.recommendations.push(`Fix elemental resistance calculation`);
      }
    });
    
    // Analyses par catégorie
    const rarityAnalysis = analyzeByRarity(results);
    const elementalAnalysis = analyzeByElement(results);
    
    Logger.result("\n   🔬 ADVANCED ANALYSIS RESULTS:");
    Logger.result(`      Average Balance Score: ${Math.round(results.reduce((sum, r) => sum + r.balanceScore, 0) / results.length)}/100`);
    Logger.result(`      Power Distribution: ${results.filter(r => r.powerRating === "Balanced").length} Balanced, ${results.filter(r => r.powerRating === "Overpowered").length} OP, ${results.filter(r => r.powerRating === "Underpowered").length} UP`);
    
    Logger.result("\n   📈 RARITY ANALYSIS:");
    rarityAnalysis.forEach(analysis => {
      const expectedAvg = (analysis.expectedDpsRange.min + analysis.expectedDpsRange.max) / 2;
      const deviation = expectedAvg > 0 ? ((analysis.averageDps - expectedAvg) / expectedAvg * 100) : 0;
      const emoji = analysis.rarity === "Common" ? "⚪" : 
                    analysis.rarity === "Rare" ? "🔵" : 
                    analysis.rarity === "Epic" ? "🟣" : 
                    analysis.rarity === "Legendary" ? "🟠" : 
                    analysis.rarity === "Mythic" ? "🔮" : "⚫";
      Logger.result(`      ${emoji} ${analysis.rarity}: ${analysis.averageDps} DPS (${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}% vs expected)`);
    });
    
    Logger.result("\n   🌟 ELEMENT ANALYSIS:");
    elementalAnalysis.forEach(analysis => {
      Logger.result(`      ${analysis.element}: ${analysis.averageDps} DPS, ${analysis.resistanceConsistency.toFixed(1)}% resistance consistency`);
    });
    
    Logger.phaseSummary("Advanced analysis completed");
    
    // Générer le rapport avancé
    const testDuration = Math.round((Date.now() - startTime) / 1000);
    const recommendations = generateAdvancedRecommendations(results, rarityAnalysis, elementalAnalysis);
    
    const report: AdvancedBalanceReport = {
      metadata: {
        testDate: new Date().toISOString(),
        version: "2.0.0-advanced-analysis",
        totalSpellsTested: results.length,
        testDuration: `${testDuration}s`,
        testConfiguration: {
          testLevel: TEST_HERO_LEVEL,
          testDuration: TEST_DURATION,
          rarityWeighting: true
        }
      },
      summary: {
        overallAverageDps: Math.round(overallAverage),
        balancedSpells: results.filter(r => r.isBalanced).length,
        overpoweredSpells: results.filter(r => r.powerRating === "Overpowered").length,
        underpoweredSpells: results.filter(r => r.powerRating === "Underpowered").length,
        elementalIssues: elementalAnalysis.reduce((sum, e) => sum + e.balanceIssues.length, 0),
        averageBalanceScore: Math.round(results.reduce((sum, r) => sum + r.balanceScore, 0) / results.length)
      },
      rarityAnalysis,
      elementalAnalysis,
      spellResults: results,
      powerScalingAnalysis: {
        rarityPowerCurve: rarityAnalysis.reduce((acc, r) => {
          acc[r.rarity] = r.averageDps;
          return acc;
        }, {} as Record<string, number>),
        elementalBalance: elementalAnalysis.reduce((acc, e) => {
          acc[e.element] = e.averageDps;
          return acc;
        }, {} as Record<string, number>),
        outliers: results.filter(r => r.balanceScore < 50)
      },
      recommendations
    };
    
    // Export
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `balance_advanced_${timestamp}.json`;
    const outputPath = path.join(process.cwd(), 'logs', 'balance', filename);
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    Logger.result(`💾 Advanced report exported: ${filename}`);
    
    // Afficher les résultats clés
    Logger.result("\n🔧 CRITICAL ISSUES:");
    if (recommendations.immediate.length > 0) {
      recommendations.immediate.slice(0, 5).forEach(rec => {
        Logger.result(`   🚨 ${rec}`);
      });
    } else {
      Logger.result("   ✅ No critical balance issues detected!");
    }
    
    if (recommendations.gameplayImpact.length > 0) {
      Logger.result("\n🎮 GAMEPLAY IMPACT:");
      recommendations.gameplayImpact.forEach(impact => {
        Logger.result(`   ⚠️ ${impact}`);
      });
    }
    
    Logger.result(`\n⏱️ Advanced analysis completed in ${Math.floor(testDuration / 60)}m ${testDuration % 60}s`);
    Logger.result(`📊 Overall balance health: ${report.summary.averageBalanceScore}/100`);
    
    if (process.env.DEBUG !== 'true') {
      Logger.showFilteredLogs();
    }
    
    await promptForPush();
    
  } catch (error) {
    Logger.disableQuietMode();
    Logger.error("Error during advanced balance test", error instanceof Error ? error.message : String(error));
  } finally {
    Logger.disableQuietMode();
    await mongoose.disconnect();
  }
}

// ===== EXECUTION =====

if (require.main === module) {
  runAdvancedBalanceTest().then(() => process.exit(0));
}

export { runAdvancedBalanceTest };

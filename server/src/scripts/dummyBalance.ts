// src/scripts/dummyBalance_fixed.ts
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

// ===== SYSTÈME DE LOGS AVEC DEBUG =====

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
      /RARITY BREAKDOWN/, /ELEMENT ANALYSIS/, /POWER SCALING/, /EFFICIENCY METRICS/,
      /🔍 DEBUG/, /⚠️ SPELL CASTING/, /🚨 ENERGY/, /🔥 COOLDOWN/ // Debug patterns
    ];
    
    const filterPatterns = [
      /Auto-découverte/, /Tentative de chargement/, /chargé\(s\) depuis/, /enregistré dans/,
      /effets? auto-chargés/, /sorts? auto-chargés/, /passifs? auto-chargés/,
      /RÉSUMÉ DES/, /Total:.*automatiquement/, /Initialisation du.*Manager/,
      /Skip reload/, /Fichier.*déjà chargé/, /Répertoire.*non trouvé/,
      /MongoDB connected to/, /résiste à/, /prend feu/, /lance.*niveau/, /charge !/
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
  
  static debug(message: string): void {
    this.originalConsole.log(`🔍 DEBUG: ${message}`);
  }
  
  static spellDebug(message: string): void {
    this.originalConsole.log(`⚠️ SPELL CASTING: ${message}`);
  }
  
  private static getRarityEmoji(rarity?: string): string {
    switch (rarity) {
      case "Common": return "⚪";
      case "Rare": return "🔵";
      case "Epic": return "🟣";
      case "Legendary": return "🟠";
      case "Mythic": return "🔮";
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

// ===== INTERFACES FIXES =====

type HeroRarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";

const RARITY_DPS_EXPECTATIONS: Record<HeroRarity, { min: number; max: number; multiplier: number }> = {
  Common: { min: 80, max: 120, multiplier: 1.0 },
  Rare: { min: 110, max: 150, multiplier: 1.25 },
  Epic: { min: 140, max: 190, multiplier: 1.6 },
  Legendary: { min: 180, max: 250, multiplier: 2.0 },
  Mythic: { min: 220, max: 300, multiplier: 2.5 }
};

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
  energyEfficiency: number;
  cooldownEfficiency: number;
  burstPotential: number;
  sustainedDps: number;
  castSuccessRate: number; // ✨ NOUVEAU: Taux de réussite des casts
  averageEnergyCost: number; // ✨ NOUVEAU: Coût moyen
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
  
  neutralDps: number;
  resistantDps: number;
  vulnerableDps: number;
  
  resistanceImpact: number;
  vulnerabilityImpact: number;
  
  metrics: SpellTestMetrics;
  
  isBalanced: boolean;
  balanceScore: number;
  powerRating: "Underpowered" | "Balanced" | "Strong" | "Overpowered";
  rarityScore: number;
  
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
  resistanceConsistency: number;
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

// ===== CONFIGURATIONS FIXES =====

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
  
  armored: {
    name: "Armored Dummy",
    def: 200,
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
    level: 75
  }
};

const TEST_DURATION = 120;
const SIMULATION_TICK = 1;
const TEST_HERO_LEVEL = 50;

// ===== UTILITAIRES FIXES =====

function createTestHero(rarity: HeroRarity = "Epic"): IBattleParticipant {
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
    element: "Fire", // ✨ FIX: Changer l'élément pour éviter la résistance Fire vs Fire
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
  // ✨ AMÉLIORATION: Analyse plus intelligente
  if (spellId.includes('mythic') || spellId.includes('transcendent')) return "Mythic";
  if (spellId.includes('legendary') || spellId.includes('ultimate')) return "Legendary";
  if (spellId.includes('epic') || spellId.includes('advanced')) return "Epic";
  if (spellId.includes('rare') || spellId.includes('improved')) return "Rare";
  
  const spell = SpellManager.getSpell(spellId);
  if (!spell) return "Common";
  
  const energyCost = spell.getEnergyCost(5);
  const cooldown = spell.getEffectiveCooldown(createTestHero(), 5);
  
  // ✨ FIX: Ajuster les seuils pour détecter correctement les raretés
  if (energyCost >= 100 || cooldown >= 12) return "Mythic";
  if (energyCost >= 80 || cooldown >= 8) return "Legendary";
  if (energyCost >= 40 || cooldown >= 5) return "Epic"; // Réduit de 50 à 40
  if (energyCost >= 10 || cooldown >= 2) return "Rare"; // Réduit de 20 à 10
  
  return "Common";
}

// ===== SIMULATION FIXÉE =====

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
    Logger.spellDebug(`Spell not found: ${spellId}`);
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
        sustainedDps: 0,
        castSuccessRate: 0,
        averageEnergyCost: 0
      }
    };
  }
  
  const spellCooldown = spell.getEffectiveCooldown(testHero, spellLevel);
  const spellEnergyCost = spell.getEnergyCost(spellLevel);
  
  Logger.debug(`${spellId} - Energy Cost: ${spellEnergyCost}, Cooldown: ${spellCooldown}s`);
  
  let totalDamage = 0;
  let maxSingleHit = 0;
  let currentTime = 0;
  let lastCastTime = -spellCooldown;
  let heroEnergy = 100;
  let spellCasts = 0;
  let basicAttacks = 0;
  let totalEnergyUsed = 0;
  let castAttempts = 0;
  let castFailures = 0;
  
  const dpsSamples: number[] = [];
  const sampleInterval = 20;
  let lastSampleTime = 0;
  let damageAtLastSample = 0;
  
  while (currentTime < TEST_DURATION) {
    const timeSinceLastCast = currentTime - lastCastTime;
    const canCastSpell = timeSinceLastCast >= spellCooldown && heroEnergy >= spellEnergyCost;
    
    let turnDamage = 0;
    
    if (canCastSpell && spellEnergyCost <= 100) { // ✨ FIX: Éviter les sorts impossibles
      castAttempts++;
      try {
        // ✨ FIX: Nettoyer les cooldowns avant de lancer
        SpellManager.clearHeroCooldowns(testHero.heroId);
        
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
        
        Logger.debug(`${spellId} cast success: ${damage} damage, energy: ${heroEnergy}/${spellEnergyCost}`);
        
      } catch (error) {
        castFailures++;
        turnDamage = calculateBasicAttack(testHero, dummy, dummyConfig);
        basicAttacks++;
        Logger.spellDebug(`${spellId} cast failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      turnDamage = calculateBasicAttack(testHero, dummy, dummyConfig);
      basicAttacks++;
      
      if (currentTime % 30 === 0) { // Log périodique
        Logger.debug(`${spellId} basic attack - Energy: ${heroEnergy}/${spellEnergyCost}, CD: ${timeSinceLastCast}/${spellCooldown}`);
      }
    }
    
    totalDamage += turnDamage;
    
    if (currentTime - lastSampleTime >= sampleInterval) {
      const sampleDps = (totalDamage - damageAtLastSample) / sampleInterval;
      dpsSamples.push(sampleDps);
      damageAtLastSample = totalDamage;
      lastSampleTime = currentTime;
    }
    
    // ✨ FIX: Régénération d'énergie plus réaliste
    if (spell.config.type === "ultimate") {
      heroEnergy = Math.min(100, heroEnergy + 5); // Ultimates plus lents
    } else {
      heroEnergy = Math.min(100, heroEnergy + 10); // Sorts actifs normaux
    }
    
    dummy.currentHp = dummy.stats.maxHp;
    currentTime += SIMULATION_TICK;
  }
  
  const averageDps = totalDamage / TEST_DURATION;
  
  const sustainedDps = dpsSamples.length > 2 ? 
    dpsSamples.slice(2).reduce((a, b) => a + b, 0) / Math.max(1, dpsSamples.length - 2) : averageDps;
  
  const energyEfficiency = totalEnergyUsed > 0 ? averageDps / (totalEnergyUsed / TEST_DURATION) : 0;
  const cooldownEfficiency = spellCooldown > 0 ? averageDps * (1 + spellCooldown / 10) : averageDps;
  const castSuccessRate = castAttempts > 0 ? ((castAttempts - castFailures) / castAttempts) * 100 : 0;
  const averageEnergyCost = spellCasts > 0 ? totalEnergyUsed / spellCasts : 0;
  
  const metrics: SpellTestMetrics = {
    totalDamage,
    spellCasts,
    basicAttacks,
    energyEfficiency: Math.round(energyEfficiency * 100) / 100,
    cooldownEfficiency: Math.round(cooldownEfficiency * 100) / 100,
    burstPotential: maxSingleHit,
    sustainedDps: Math.round(sustainedDps),
    castSuccessRate: Math.round(castSuccessRate * 100) / 100,
    averageEnergyCost: Math.round(averageEnergyCost * 100) / 100
  };
  
  const details = `(${spellCasts} casts, ${basicAttacks} basics, ${castSuccessRate}% success, Burst: ${maxSingleHit})`;
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

// ===== ANALYSES FIXES =====

function calculateBalanceScore(result: SpellDpsResult, overallAverage: number): number {
  const rarityExpected = RARITY_DPS_EXPECTATIONS[result.rarity];
  if (!rarityExpected) return 50;
  
  const expectedDps = (rarityExpected.min + rarityExpected.max) / 2;
  
  // ✨ FIX: Si pas de DPS, score automatiquement bas
  if (result.neutralDps === 0) return 5;
  
  const dpsRatio = result.neutralDps / expectedDps;
  
  let score = 100;
  
  // ✨ FIX: Pénalité pour 0 cast
  if (result.metrics.spellCasts === 0) {
    score -= 80; // Grosse pénalité si le sort ne se lance jamais
  }
  
  if (dpsRatio < 0.8 || dpsRatio > 1.2) {
    score -= Math.abs(dpsRatio - 1) * 50; // Réduit la pénalité
  }
  
  if (Math.abs(result.resistanceImpact - 50) > 15) score -= 10;
  if (Math.abs(result.vulnerabilityImpact - 50) > 15) score -= 10;
  
  if (result.metrics.energyEfficiency > 2.0) score += 5;
  if (result.metrics.castSuccessRate > 80) score += 10; // ✨ NOUVEAU: Bonus pour bon taux de succès
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function analyzePowerRating(result: SpellDpsResult): "Underpowered" | "Balanced" | "Strong" | "Overpowered" {
  const rarityExpected = RARITY_DPS_EXPECTATIONS[result.rarity];
  if (!rarityExpected) return "Balanced";
  
  // ✨ FIX: Si pas de sorts lancés, c'est underpowered
  if (result.metrics.spellCasts === 0) return "Underpowered";
  
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
    
    // ✨ FIX: Recommandations pour sorts qui ne se lancent pas
    const nocastSpells = raritySpells.filter(r => r.metrics.spellCasts === 0);
    if (nocastSpells.length > 0) {
      recommendations.push(`${nocastSpells.length} ${rarity} spells never cast - check energy cost and cooldown`);
    }
    
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
  
  // ✨ FIX: Recommandations pour sorts qui ne se lancent pas
  const nonCastingSpells = results.filter(r => r.metrics.spellCasts === 0);
  if (nonCastingSpells.length > 0) {
    immediate.push(`CRITICAL: ${nonCastingSpells.length} spells never cast - fix energy costs and cooldowns`);
    
    nonCastingSpells.forEach(spell => {
      if (spell.energyCost > 100) {
        immediate.push(`${spell.spellId}: Energy cost too high (${spell.energyCost}) - reduce to ≤100`);
      }
      if (spell.cooldown > 15) {
        immediate.push(`${spell.spellId}: Cooldown too long (${spell.cooldown}s) - reduce to ≤15s`);
      }
    });
  }
  
  const criticalIssues = results.filter(r => r.balanceScore < 30);
  criticalIssues.forEach(spell => {
    immediate.push(`CRITICAL: ${spell.spellId} (${spell.rarity}) needs immediate rebalancing (score: ${spell.balanceScore})`);
  });
  
  rarityAnalysis.forEach(analysis => {
    if (analysis.recommendations.length > 0) {
      analysis.recommendations.forEach(rec => longTerm.push(`${analysis.rarity}: ${rec}`));
    }
  });
  
  elementalAnalysis.forEach(analysis => {
    if (analysis.balanceIssues.length > 0) {
      analysis.balanceIssues.forEach(issue => immediate.push(`${analysis.element}: ${issue}`));
    }
  });
  
  const overpoweredLegendaries = results.filter(r => r.rarity === "Legendary" && r.powerRating === "Overpowered");
  if (overpoweredLegendaries.length > 2) {
    gameplayImpact.push(`Risk of Legendary spell dominance (${overpoweredLegendaries.length} overpowered)`);
  }
  
  const underpoweredCommons = results.filter(r => r.rarity === "Common" && r.powerRating === "Underpowered");
  if (underpoweredCommons.length > results.filter(r => r.rarity === "Common").length * 0.4) {
    gameplayImpact.push(`Common spells too weak, reducing early game viability`);
  }
  
  const lowEfficiencySpells = results.filter(r => r.metrics.energyEfficiency < 1.0);
  if (lowEfficiencySpells.length > results.length * 0.3) {
    gameplayImpact.push(`Energy efficiency issues may slow combat pace`);
  }
  
  return { immediate, longTerm, gameplayImpact };
}

// ===== FONCTIONS GIT SIMPLIFIÉES =====

async function setupGitStructure(): Promise<void> {
  try {
    const balanceDir = path.join(process.cwd(), 'logs', 'balance');
    if (!fs.existsSync(balanceDir)) {
      fs.mkdirSync(balanceDir, { recursive: true });
    }
  } catch (error) {
    // Ignorer les erreurs
  }
}

async function promptForPush(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    Logger.result("");
    rl.question("🚀 Push this fixed report to GitHub? (y/N): ", async (answer) => {
      rl.close();
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        Logger.result("\n📤 Fixed report will be pushed...");
      } else {
        Logger.result("\n📋 Fixed report saved locally.");
      }
      
      resolve();
    });
  });
}

// ===== SCRIPT PRINCIPAL FIXÉ =====

async function runFixedBalanceTest(): Promise<void> {
  const startTime = Date.now();
  
  Logger.enableQuietMode();
  Logger.result("🎯 Fixed Advanced Spell Balance Analysis Starting...\n");
  
  try {
    await setupGitStructure();
    await mongoose.connect(MONGO_URI);
    
    Logger.result("⚙️ Initializing fixed game systems...");
    await SpellManager.initialize();
    await EffectManager.initialize();
    await PassiveManager.initialize();
    
    Logger.disableQuietMode();
    
    Logger.phase(1, "Scanning & classifying spells with fixes", "Improved rarity detection and validation");
    const allSpells = SpellManager.getAllSpells();
    const testableSpells = allSpells.filter(spell => 
      spell.config.type === "active" && 
      spell.config.category === "damage"
    );
    
    // ✨ DEBUG: Afficher les caractéristiques de chaque sort
    Logger.result("   🔍 SPELL ANALYSIS:");
    testableSpells.forEach(spell => {
      const rarity = getSpellRarity(spell.config.id);
      const energyCost = spell.getEnergyCost(5);
      const cooldown = spell.getEffectiveCooldown(createTestHero(), 5);
      Logger.result(`      ${spell.config.id}: ${rarity} (Energy: ${energyCost}, CD: ${cooldown}s)`);
    });
    
    const rarityDistribution = testableSpells.reduce((acc, spell) => {
      const rarity = getSpellRarity(spell.config.id);
      acc[rarity] = (acc[rarity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Logger.result("\n   📊 RARITY BREAKDOWN:");
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
    
    // Phase 2-6: Tests avec debug amélioré
    const dummyTypes = ["neutral", "resistant", "vulnerable", "armored", "elite"];
    
    for (let i = 0; i < dummyTypes.length; i++) {
      const dummyType = dummyTypes[i];
      const phaseNum = i + 2;
      
      Logger.phase(phaseNum, `Testing vs ${dummyType} dummy`, `Fixed simulation with debug`);
      
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
      }
      
      Logger.phaseSummary(`Completed ${testableSpells.length} spells vs ${dummyType} dummy`);
    }
    
    // Phase 7: Analyse fixée
    Logger.phase(7, "Fixed Advanced Analysis", "Improved scoring with cast rate consideration");
    
    const overallAverage = results.reduce((sum, r) => sum + r.neutralDps, 0) / results.length;
    
    results.forEach(result => {
      result.balanceScore = calculateBalanceScore(result, overallAverage);
      result.powerRating = analyzePowerRating(result);
      result.isBalanced = result.powerRating === "Balanced";
      
      // ✨ FIX: Recommandations améliorées
      if (result.metrics.spellCasts === 0) {
        result.recommendations.push(`CRITICAL: Never casts - check energy cost (${result.energyCost}) and cooldown (${result.cooldown}s)`);
      }
      
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
      
      if (result.metrics.castSuccessRate < 50) {
        result.recommendations.push(`Low cast success rate: ${result.metrics.castSuccessRate}%`);
      }
    });
    
    const rarityAnalysis = analyzeByRarity(results);
    const elementalAnalysis = analyzeByElement(results);
    
    Logger.result("\n   🔬 FIXED ANALYSIS RESULTS:");
    Logger.result(`      Average Balance Score: ${Math.round(results.reduce((sum, r) => sum + r.balanceScore, 0) / results.length)}/100`);
    Logger.result(`      Spells that cast: ${results.filter(r => r.metrics.spellCasts > 0).length}/${results.length}`);
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
    
    Logger.phaseSummary("Fixed advanced analysis completed");
    
    const testDuration = Math.round((Date.now() - startTime) / 1000);
    const recommendations = generateAdvancedRecommendations(results, rarityAnalysis, elementalAnalysis);
    
    const report: AdvancedBalanceReport = {
      metadata: {
        testDate: new Date().toISOString(),
        version: "2.1.0-fixed-casting",
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
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `balance_fixed_${timestamp}.json`;
    const outputPath = path.join(process.cwd(), 'logs', 'balance', filename);
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    Logger.result(`💾 Fixed report exported: ${filename}`);
    
    Logger.result("\n🔧 CRITICAL ISSUES (FIXED ANALYSIS):");
    if (recommendations.immediate.length > 0) {
      recommendations.immediate.slice(0, 7).forEach(rec => {
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
    
    Logger.result(`\n⏱️ Fixed analysis completed in ${Math.floor(testDuration / 60)}m ${testDuration % 60}s`);
    Logger.result(`📊 Fixed balance health: ${report.summary.averageBalanceScore}/100`);
    
    if (process.env.DEBUG !== 'true') {
      Logger.showFilteredLogs();
    }
    
    await promptForPush();
    
  } catch (error) {
    Logger.disableQuietMode();
    Logger.error("Error during fixed balance test", error instanceof Error ? error.message : String(error));
  } finally {
    Logger.disableQuietMode();
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runFixedBalanceTest().then(() => process.exit(0));
}

export { runFixedBalanceTest };

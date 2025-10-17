// src/scripts/dummyBalance.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { BattleEngine, IBattleOptions } from "../services/BattleEngine";
import { SpellManager } from "../gameplay/SpellManager";
import { EffectManager } from "../gameplay/EffectManager";
import { PassiveManager } from "../gameplay/PassiveManager";
import { IBattleParticipant } from "../models/Battle";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// ===== INTERFACES =====

interface DummyConfig {
  name: string;
  def: number;
  resistances: Record<string, number>;
  hp: number;
}

interface SpellDpsResult {
  spellId: string;
  element: string;
  category: string;
  level: number;
  neutralDps: number;
  resistantDps: number;
  vulnerableDps: number;
  resistanceImpact: number;
  vulnerabilityImpact: number;
  isBalanced: boolean;
  issues: string[];
}

interface BalanceReport {
  metadata: {
    testDate: string;
    version: string;
    totalSpellsTested: number;
    testDuration: string;
  };
  summary: {
    averageDps: number;
    balancedSpells: number;
    overpoweredSpells: number;
    underpoweredSpells: number;
    elementalIssues: number;
  };
  spellResults: SpellDpsResult[];
  recommendations: string[];
}

// ===== CONFIGURATIONS =====

const DUMMY_CONFIGS: Record<string, DummyConfig> = {
  neutral: {
    name: "Neutral Dummy",
    def: 0,
    resistances: {},
    hp: 999999999
  },
  
  resistant: {
    name: "Resistant Dummy", 
    def: 0,
    resistances: {
      Fire: 50,
      Water: 50,
      Wind: 50,
      Electric: 50,
      Light: 50,
      Dark: 50
    },
    hp: 999999999
  },
  
  vulnerable: {
    name: "Vulnerable Dummy",
    def: 0,
    resistances: {
      Fire: -50,
      Water: -50,
      Wind: -50,
      Electric: -50,
      Light: -50,
      Dark: -50
    },
    hp: 999999999
  }
};

const TEST_DURATION = 30; // 30 secondes par test
const TEST_HERO_LEVEL = 50; // Niveau standard pour les tests

// ===== UTILITAIRES =====

function createTestHero(): IBattleParticipant {
  return {
    heroId: "test_hero_001",
    name: "Test Hero",
    position: 1,
    role: "DPS Ranged",
    element: "Fire",
    rarity: "Epic",
    level: TEST_HERO_LEVEL,
    stars: 5,
    stats: {
      hp: 5000,
      maxHp: 5000,
      atk: 300,
      def: 150,
      speed: 100
    },
    currentHp: 5000,
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
    element: "Fire", // Changé de "Neutral" vers "Fire"
    rarity: "Common",
    level: TEST_HERO_LEVEL,
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

// ===== SIMULATION =====

async function testSpellDps(
  spellId: string, 
  spellLevel: number, 
  dummyConfig: DummyConfig
): Promise<number> {
  const testHero = createTestHero();
  const dummy = createDummy(dummyConfig);
  
  // Créer un combat de 30 secondes
  const battleOptions: IBattleOptions = { mode: "auto", speed: 1 };
  const battleEngine = new BattleEngine(
    [testHero], 
    [dummy], 
    new Map([["test_hero_001", { active1: { id: spellId, level: spellLevel } }]]),
    new Map(),
    battleOptions
  );
  
  let totalDamage = 0;
  let actionCount = 0;
  const startTime = Date.now();
  
  // Simuler pendant TEST_DURATION secondes
  while ((Date.now() - startTime) < (TEST_DURATION * 1000)) {
    // Forcer le héros à lancer le sort
    try {
      const action = SpellManager.castSpell(
        spellId,
        testHero,
        [dummy],
        spellLevel
      );
      
      let damage = action.damage || 0;
      
      // Appliquer la résistance élémentaire du dummy
      const spell = SpellManager.getSpell(spellId);
      if (spell && spell.config.element) {
        damage = applyElementalResistance(damage, spell.config.element, dummyConfig.resistances);
      }
      
      totalDamage += damage;
      actionCount++;
      
      // Régénérer l'énergie du héros
      testHero.energy = 100;
      
      // Régénérer le dummy (il doit rester vivant)
      dummy.currentHp = dummy.stats.maxHp;
      
    } catch (error) {
      // Sort non disponible ou erreur, utiliser attaque de base
      totalDamage += 50; // Dégâts d'attaque de base estimés
      actionCount++;
    }
    
    // Petit délai pour éviter une boucle trop intensive
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const dps = totalDamage / TEST_DURATION;
  return Math.round(dps);
}

// ===== ANALYSE =====

function analyzeSpellBalance(results: SpellDpsResult[]): {
  overpowered: SpellDpsResult[];
  underpowered: SpellDpsResult[];
  elementalIssues: SpellDpsResult[];
  recommendations: string[];
} {
  const avgDps = results.reduce((sum, r) => sum + r.neutralDps, 0) / results.length;
  
  const overpowered = results.filter(r => r.neutralDps > avgDps * 1.5);
  const underpowered = results.filter(r => r.neutralDps < avgDps * 0.5);
  
  const elementalIssues = results.filter(r => {
    // La résistance devrait réduire d'environ 50%
    // La vulnérabilité devrait augmenter d'environ 50%
    const resistanceOff = Math.abs(r.resistanceImpact - 50) > 15;
    const vulnerabilityOff = Math.abs(r.vulnerabilityImpact - 50) > 15;
    return resistanceOff || vulnerabilityOff;
  });
  
  const recommendations: string[] = [];
  
  // Recommandations pour sorts overpowered
  overpowered.forEach(spell => {
    const reduction = Math.round(((spell.neutralDps / avgDps) - 1.2) * 100);
    recommendations.push(`${spell.spellId}: Reduce damage by ${reduction}% (currently +${Math.round((spell.neutralDps / avgDps - 1) * 100)}% vs average)`);
  });
  
  // Recommandations pour sorts underpowered
  underpowered.forEach(spell => {
    const increase = Math.round((0.8 - (spell.neutralDps / avgDps)) * 100);
    recommendations.push(`${spell.spellId}: Increase damage by ${increase}% (currently ${Math.round((spell.neutralDps / avgDps - 1) * 100)}% vs average)`);
  });
  
  // Recommandations pour problèmes élémentaires
  elementalIssues.forEach(spell => {
    recommendations.push(`${spell.spellId}: Fix elemental calculation (resistance: ${spell.resistanceImpact}%, vulnerability: ${spell.vulnerabilityImpact}%)`);
  });
  
  return { overpowered, underpowered, elementalIssues, recommendations };
}

// ===== SCRIPT PRINCIPAL =====

async function runDummyBalanceTest(): Promise<void> {
  const startTime = Date.now();
  
  console.log("🎯 Dummy Balance Test Starting...\n");
  
  try {
    // Connexion MongoDB
    await mongoose.connect(MONGO_URI);
    
    // Initialiser les gestionnaires
    await SpellManager.initialize();
    await EffectManager.initialize();
    await PassiveManager.initialize();
    
    // Phase 1: Scanner tous les sorts
    console.log("📊 Phase 1: Scanning spells...");
    const allSpells = SpellManager.getAllSpells();
    const testableSpells = allSpells.filter(spell => 
      spell.config.type === "active" && 
      spell.config.category === "damage"
    );
    
    console.log(`   Found ${testableSpells.length} testable damage spells\n`);
    
    if (testableSpells.length === 0) {
      console.log("❌ No testable spells found!");
      return;
    }
    
    const results: SpellDpsResult[] = [];
    
    // Phase 2-4: Tester sur chaque dummy
    for (const dummyType of ["neutral", "resistant", "vulnerable"]) {
      console.log(`⚔️ Phase ${dummyType === "neutral" ? "2" : dummyType === "resistant" ? "3" : "4"}: Testing ${dummyType} dummy...`);
      
      const config = DUMMY_CONFIGS[dummyType];
      let balancedCount = 0;
      
      for (const spell of testableSpells) {
        const dps = await testSpellDps(spell.config.id, 5, config);
        
        // Stocker ou mettre à jour le résultat
        let result = results.find(r => r.spellId === spell.config.id);
        if (!result) {
          result = {
            spellId: spell.config.id,
            element: spell.config.element || "None",
            category: spell.config.category,
            level: 5,
            neutralDps: 0,
            resistantDps: 0,
            vulnerableDps: 0,
            resistanceImpact: 0,
            vulnerabilityImpact: 0,
            isBalanced: false,
            issues: []
          };
          results.push(result);
        }
        
        // Assigner le DPS selon le type de dummy
        if (dummyType === "neutral") {
          result.neutralDps = dps;
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
    }
    
    // Phase 5: Analyse
    console.log("\n📋 Phase 5: Analysis...");
    
    // Calculer l'équilibrage pour chaque sort
    const avgDps = results.reduce((sum, r) => sum + r.neutralDps, 0) / results.length;
    
    results.forEach(result => {
      const dpsRatio = result.neutralDps / avgDps;
      result.isBalanced = dpsRatio >= 0.7 && dpsRatio <= 1.4;
      
      if (!result.isBalanced) {
        if (dpsRatio > 1.4) {
          result.issues.push(`OVERPOWERED: +${Math.round((dpsRatio - 1) * 100)}% vs average`);
        } else {
          result.issues.push(`UNDERPOWERED: ${Math.round((dpsRatio - 1) * 100)}% vs average`);
        }
      }
      
      // Vérifier les problèmes élémentaires
      if (Math.abs(result.resistanceImpact - 50) > 15) {
        result.issues.push(`Resistance issue: ${result.resistanceImpact}% instead of ~50%`);
      }
      if (Math.abs(result.vulnerabilityImpact - 50) > 15) {
        result.issues.push(`Vulnerability issue: ${result.vulnerabilityImpact}% instead of ~50%`);
      }
    });
    
    const analysis = analyzeSpellBalance(results);
    const balancedCount = results.filter(r => r.isBalanced).length;
    
    console.log(`   ✅ ${balancedCount} spells balanced (${Math.round(balancedCount / results.length * 100)}%)`);
    console.log(`   ⚠️ ${results.length - balancedCount} spells need attention\n`);
    
    // Générer le rapport
    const testDuration = Math.round((Date.now() - startTime) / 1000);
    const report: BalanceReport = {
      metadata: {
        testDate: new Date().toISOString(),
        version: "1.0.0",
        totalSpellsTested: results.length,
        testDuration: `${testDuration}s`
      },
      summary: {
        averageDps: Math.round(avgDps),
        balancedSpells: balancedCount,
        overpoweredSpells: analysis.overpowered.length,
        underpoweredSpells: analysis.underpowered.length,
        elementalIssues: analysis.elementalIssues.length
      },
      spellResults: results,
      recommendations: analysis.recommendations
    };
    
    // Export JSON
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `balance_${timestamp}.json`;
    const outputPath = path.join(process.cwd(), filename);
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`💾 Exported: ${outputPath}\n`);
    
    // Afficher les problèmes clés
    if (analysis.recommendations.length > 0) {
      console.log("🔧 KEY ISSUES FOUND:");
      analysis.recommendations.slice(0, 5).forEach(rec => {
        console.log(`   - ${rec}`);
      });
      
      if (analysis.recommendations.length > 5) {
        console.log(`   ... and ${analysis.recommendations.length - 5} more (see JSON file)`);
      }
    } else {
      console.log("✅ All spells appear balanced!");
    }
    
    console.log(`\n⏱️ Test completed in ${Math.floor(testDuration / 60)}m ${testDuration % 60}s`);
    
  } catch (error) {
    console.error("❌ Error during balance test:", error);
  } finally {
    await mongoose.disconnect();
  }
}

// ===== EXECUTION =====

if (require.main === module) {
  runDummyBalanceTest().then(() => process.exit(0));
}

export { runDummyBalanceTest };

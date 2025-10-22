// src/scripts/dummyBalance.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { BattleEngine, IBattleOptions } from "../services/BattleEngine";
import { SpellManager } from "../gameplay/SpellManager";
import { EffectManager } from "../gameplay/EffectManager";
import { PassiveManager } from "../gameplay/PassiveManager";
import { IBattleParticipant } from "../models/Battle";

dotenv.config();

const execAsync = promisify(exec);
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

const TEST_DURATION = 60; // 60 secondes simulées par test
const SIMULATION_TICK = 1; // 1 seconde par tick de simulation
const TEST_HERO_LEVEL = 50; // Niveau standard pour les tests

// ===== FONCTIONS GIT AUTO-PUSH =====

async function setupGitStructure(): Promise<void> {
  console.log("📁 Setting up Git structure...");
  
  try {
    // Créer la structure de logs
    const logsDir = path.join(process.cwd(), 'logs');
    const balanceDir = path.join(logsDir, 'balance');
    
    if (!fs.existsSync(balanceDir)) {
      fs.mkdirSync(balanceDir, { recursive: true });
    }
    
    // Créer README pour les logs
    const logsReadme = path.join(logsDir, 'README.md');
    if (!fs.existsSync(logsReadme)) {
      const readmeContent = `# Logs Directory

Ce dossier contient tous les logs et rapports générés par le serveur.

## Structure
- \`balance/\` : Rapports d'équilibrage des sorts et héros
- \`performance/\` : Tests de performance et benchmarks  
- \`errors/\` : Logs d'erreurs et debugging

## Utilisation
Les rapports sont générés automatiquement et pushés vers GitHub pour suivi.
`;
      fs.writeFileSync(logsReadme, readmeContent);
    }
    
    // Créer README pour balance
    const balanceReadme = path.join(balanceDir, 'README.md');
    if (!fs.existsSync(balanceReadme)) {
      const balanceReadmeContent = `# Balance Reports

Rapports d'équilibrage automatiques générés par \`dummyBalance.ts\`.

## Format des fichiers
- \`balance_YYYY-MM-DDTHH-MM-SS.json\` : Rapport complet avec:
  - DPS de tous les sorts sur différents ennemis
  - Analyse d'équilibrage automatique
  - Recommandations d'ajustements

## Génération
\`\`\`bash
cd server
npx ts-node src/scripts/dummyBalance.ts
\`\`\`

Les rapports sont automatiquement pushés vers GitHub après génération.
`;
      fs.writeFileSync(balanceReadme, balanceReadmeContent);
    }
    
    console.log("   ✅ Git structure created");
    
  } catch (error) {
    console.error("   ⚠️ Error setting up Git structure:", error instanceof Error ? error.message : String(error));
  }
}

async function pushToGit(reportPath: string, reportSummary: any): Promise<void> {
  console.log("\n📤 Pushing to GitHub...");
  
  try {
    // Vérifier qu'on est dans un repo Git
    await execAsync('git rev-parse --git-dir');
    
    // Auto-configurer SSH pour GitHub
    await autoConfigureSSH();
    
    // Configurer Git si pas déjà fait
    await setupGitConfig();
    
    // Déplacer les anciens rapports vers la nouvelle structure
    await moveOldReports();
    
    // Vérifier et corriger le .gitignore
    await fixGitignore();
    
    // Changer l'origine vers SSH si nécessaire
    await switchToSSH();
    
    // Ajouter les nouveaux fichiers
    console.log("   ➕ Adding files...");
    await execAsync('git add .gitignore');
    await execAsync('git add logs/ -f'); // Force l'ajout même si dans .gitignore
    await execAsync('git add debugsequilibrage/ || true'); // Au cas où il existerait encore
    
    // Vérifier s'il y a quelque chose à committer
    const { stdout: statusOutput } = await execAsync('git status --porcelain');
    if (!statusOutput.trim()) {
      console.log("   ℹ️  No changes to commit");
      return;
    }
    
    // Créer un message de commit informatif (échapper les caractères spéciaux)
    const timestamp = new Date().toLocaleString('fr-FR');
    const balanced = reportSummary.balancedSpells;
    const total = reportSummary.totalSpellsTested || 0;
    const percentage = total > 0 ? Math.round((balanced / total) * 100) : 0;
    
    const commitMessage = `feat: Balance report ${timestamp}

Test Results:
- ${total} spells tested
- ${balanced} balanced (${percentage}%)
- ${reportSummary.overpoweredSpells || 0} overpowered
- ${reportSummary.underpoweredSpells || 0} underpowered
- Average DPS: ${reportSummary.averageDps || 0}

Generated by: dummyBalance.ts with auto-push`.replace(/"/g, '\\"');
    
    // Commit
    console.log("   💾 Committing...");
    await execAsync(`git commit -m "${commitMessage}"`);
    
    // Push avec SSH
    console.log("   🚀 Pushing to origin/main...");
    await execAsync('git push origin main');
    
    console.log("   ✅ Successfully pushed to GitHub!");
    console.log(`   🔗 View on: https://github.com/pokemmorgn/Soulspire/tree/main/logs/balance`);
    
  } catch (error) {
    console.error("   ❌ Git push failed:", error instanceof Error ? error.message : String(error));
    console.log("   ℹ️  You can manually push later with:");
    console.log("      git add logs/ -f && git commit -m 'Add balance report' && git push origin main");
  }
}

async function moveOldReports(): Promise<void> {
  try {
    const rootDir = process.cwd();
    const balanceDir = path.join(rootDir, 'logs', 'balance');
    
    // Déplacer les rapports de la racine
    const files = fs.readdirSync(rootDir);
    const balanceFiles = files.filter(f => f.startsWith('balance_') && f.endsWith('.json'));
    
    for (const file of balanceFiles) {
      const oldPath = path.join(rootDir, file);
      const newPath = path.join(balanceDir, file);
      
      if (!fs.existsSync(newPath)) {
        fs.renameSync(oldPath, newPath);
        console.log(`   📦 Moved ${file} to logs/balance/`);
      }
    }
    
    // Déplacer le contenu de debugsequilibrage s'il existe
    const debugDir = path.join(rootDir, 'debugsequilibrage');
    if (fs.existsSync(debugDir)) {
      const debugFiles = fs.readdirSync(debugDir);
      
      for (const file of debugFiles) {
        if (file !== '.gitkeep' && file.endsWith('.json')) {
          const oldPath = path.join(debugDir, file);
          const newPath = path.join(balanceDir, file);
          
          if (!fs.existsSync(newPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`   📦 Moved ${file} from debugsequilibrage/`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error("   ⚠️ Error moving old reports:", error instanceof Error ? error.message : String(error));
  }
}

async function fixGitignore(): Promise<void> {
  try {
    console.log("   📝 Checking/fixing .gitignore...");
    
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    let gitignoreContent = '';
    
    // Lire le .gitignore existant
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }
    
    // Vérifier si la configuration logs est déjà présente
    if (!gitignoreContent.includes('# ===== LOGS CONFIGURATION =====')) {
      const logsConfig = `

# ===== LOGS CONFIGURATION =====
# Ignorer la plupart des logs, mais garder les rapports de balance importants
logs/*.log
logs/temp/
logs/debug/

# AUTORISER les rapports de balance (important pour le suivi du développement)
!logs/
!logs/balance/
!logs/balance/*.json
!logs/balance/README.md
!logs/README.md
`;
      
      gitignoreContent += logsConfig;
      fs.writeFileSync(gitignorePath, gitignoreContent);
      console.log("   ✅ Updated .gitignore to allow balance reports");
    } else {
      console.log("   ✅ .gitignore already configured for logs");
    }
    
  } catch (error) {
    console.error("   ⚠️ Error fixing .gitignore:", error instanceof Error ? error.message : String(error));
  }
}

async function setupGitConfig(): Promise<void> {
  try {
    console.log("   🔧 Checking Git configuration...");
    
    // Vérifier si user.name est configuré
    try {
      await execAsync('git config user.name');
    } catch {
      console.log("   📝 Setting Git user.name...");
      await execAsync('git config user.name "Soulspire Auto Balance"');
    }
    
    // Vérifier si user.email est configuré
    try {
      await execAsync('git config user.email');
    } catch {
      console.log("   📧 Setting Git user.email...");
      await execAsync('git config user.email "balance-bot@soulspire.local"');
    }
    
    console.log("   ✅ Git configuration ready");
    
  } catch (error) {
    console.error("   ⚠️ Error setting up Git config:", error instanceof Error ? error.message : String(error));
  }
}

async function autoConfigureSSH(): Promise<void> {
  try {
    console.log("   🔑 Auto-configuring SSH...");
    
    // Chercher les clés SSH existantes
    const homeDir = require('os').homedir();
    const sshDir = path.join(homeDir, '.ssh');
    
    let sshKey = null;
    const possibleKeys = [
      path.join(sshDir, 'id_ed25519'),
      path.join(sshDir, 'id_rsa'),
      path.join(sshDir, 'id_ecdsa')
    ];
    
    for (const keyPath of possibleKeys) {
      if (fs.existsSync(keyPath)) {
        sshKey = keyPath;
        console.log(`   🔍 Found SSH key: ${keyPath}`);
        break;
      }
    }
    
    if (!sshKey) {
      console.log("   ⚠️ No SSH key found, will use HTTPS (may prompt for credentials)");
      return;
    }
    
    // Configurer SSH pour GitHub
    const sshConfigPath = path.join(sshDir, 'config');
    let sshConfig = '';
    
    if (fs.existsSync(sshConfigPath)) {
      sshConfig = fs.readFileSync(sshConfigPath, 'utf8');
    }
    
    // Ajouter config GitHub si pas présente
    if (!sshConfig.includes('Host github.com')) {
      const githubConfig = `

# GitHub Soulspire (auto-added)
Host github.com
    HostName github.com
    User git
    IdentityFile ${sshKey}
    IdentitiesOnly yes
`;
      
      sshConfig += githubConfig;
      fs.writeFileSync(sshConfigPath, sshConfig);
      fs.chmodSync(sshConfigPath, 0o600);
      console.log("   ✅ SSH config updated for GitHub");
    } else {
      console.log("   ✅ SSH already configured for GitHub");
    }
    
  } catch (error) {
    console.error("   ⚠️ Error configuring SSH:", error instanceof Error ? error.message : String(error));
  }
}

async function switchToSSH(): Promise<void> {
  try {
    console.log("   🔄 Checking Git remote...");
    
    const { stdout } = await execAsync('git remote get-url origin');
    const currentUrl = stdout.trim();
    
    // Si c'est déjà SSH, ne rien faire
    if (currentUrl.startsWith('git@github.com:')) {
      console.log("   ✅ Already using SSH");
      return;
    }
    
    // Si c'est HTTPS GitHub, convertir vers SSH
    if (currentUrl.includes('github.com/pokemmorgn/Soulspire')) {
      console.log("   🔄 Converting to SSH...");
      await execAsync('git remote set-url origin git@github.com:pokemmorgn/Soulspire.git');
      console.log("   ✅ Switched to SSH");
    } else {
      console.log("   ⚠️ Unknown remote URL, keeping as-is");
    }
    
  } catch (error) {
    console.error("   ⚠️ Error switching to SSH:", error instanceof Error ? error.message : String(error));
  }
}

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
    element: "Fire",
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

// ===== SIMULATION INSTANTANÉE =====

async function testSpellDps(
  spellId: string, 
  spellLevel: number, 
  dummyConfig: DummyConfig
): Promise<number> {
  const testHero = createTestHero();
  const dummy = createDummy(dummyConfig);
  
  // Récupérer les infos du sort
  const spell = SpellManager.getSpell(spellId);
  if (!spell) {
    console.warn(`⚠️ Sort non trouvé: ${spellId}`);
    return 0;
  }
  
  const spellCooldown = spell.getEffectiveCooldown(testHero, spellLevel);
  const spellEnergyCost = spell.getEnergyCost(spellLevel);
  
  console.log(`   Testing ${spellId} (CD: ${spellCooldown}s, Energy: ${spellEnergyCost})`);
  
  let totalDamage = 0;
  let currentTime = 0;
  let lastCastTime = -spellCooldown; // Peut cast immédiatement
  let heroEnergy = 100;
  let spellCasts = 0;
  let basicAttacks = 0;
  
  // Simulation tick par tick (1 seconde par tick)
  while (currentTime < TEST_DURATION) {
    const timeSinceLastCast = currentTime - lastCastTime;
    const canCastSpell = timeSinceLastCast >= spellCooldown && heroEnergy >= spellEnergyCost;
    
    if (canCastSpell) {
      // Lancer le sort
      try {
        const action = SpellManager.castSpell(
          spellId,
          testHero,
          [dummy],
          spellLevel
        );
        
        let damage = action.damage || 0;
        
        // Appliquer la résistance élémentaire du dummy
        if (spell.config.element) {
          damage = applyElementalResistance(damage, spell.config.element, dummyConfig.resistances);
        }
        
        totalDamage += damage;
        heroEnergy -= spellEnergyCost;
        lastCastTime = currentTime;
        spellCasts++;
        
      } catch (error) {
        // Sort échoué, faire une attaque de base
        const basicDamage = calculateBasicAttack(testHero, dummy, dummyConfig);
        totalDamage += basicDamage;
        basicAttacks++;
      }
    } else {
      // Pas de sort disponible, attaque de base
      const basicDamage = calculateBasicAttack(testHero, dummy, dummyConfig);
      totalDamage += basicDamage;
      basicAttacks++;
    }
    
    // Régénération d'énergie (10 par seconde approximativement)
    heroEnergy = Math.min(100, heroEnergy + 10);
    
    // Régénérer le dummy (il doit rester vivant)
    dummy.currentHp = dummy.stats.maxHp;
    
    // Avancer le temps
    currentTime += SIMULATION_TICK;
  }
  
  const dps = totalDamage / TEST_DURATION;
  console.log(`     Result: ${Math.round(dps)} DPS (${spellCasts} spell casts, ${basicAttacks} basic attacks)`);
  
  return Math.round(dps);
}

function calculateBasicAttack(
  attacker: IBattleParticipant, 
  target: IBattleParticipant, 
  dummyConfig: DummyConfig
): number {
  // Dégâts d'attaque de base simple
  const baseDamage = Math.max(1, attacker.stats.atk - Math.floor(target.stats.def / 2));
  
  // Appliquer résistance si l'attaquant a un élément
  return applyElementalResistance(baseDamage, attacker.element, dummyConfig.resistances);
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
    // Setup Git structure
    await setupGitStructure();
    
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
      
      console.log(`   Completed testing ${testableSpells.length} spells on ${dummyType} dummy\n`);
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
        version: "1.1.0-autopush",
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
    
    // Export JSON dans le nouveau dossier logs/balance
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `balance_${timestamp}.json`;
    const outputPath = path.join(process.cwd(), 'logs', 'balance', filename);
    
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
    
    // Auto-push vers GitHub
    await pushToGit(outputPath, report.summary);
    
  } catch (error) {
    console.error("❌ Error during balance test:", error instanceof Error ? error.message : String(error));
  } finally {
    await mongoose.disconnect();
  }
}

// ===== EXECUTION =====

if (require.main === module) {
  runDummyBalanceTest().then(() => process.exit(0));
}

export { runDummyBalanceTest };

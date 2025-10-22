// src/scripts/dummyBalance.ts
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
  
  // Activer le mode silencieux (supprime tous les logs automatiques)
  static enableQuietMode(): void {
    this.isQuietMode = true;
    this.pendingOutput = [];
    
    // Rediriger console.log pour capturer les logs indésirables
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      
      // Filtrer les messages que nous voulons garder
      if (this.shouldKeepMessage(message)) {
        this.originalConsole.log(...args);
      } else {
        // Stocker les messages filtrés pour debug si nécessaire
        this.pendingOutput.push(message);
      }
    };
    
    // Garder warn et error normaux
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }
  
  // Désactiver le mode silencieux
  static disableQuietMode(): void {
    this.isQuietMode = false;
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }
  
  // Déterminer si un message doit être gardé
  private static shouldKeepMessage(message: string): boolean {
    // Messages à GARDER (importants pour le test)
    const keepPatterns = [
      /^🎯/, // Début du test
      /^📊/, // Phases
      /^⚔️/, // Tests dummy
      /^📋/, // Analyse
      /^💾/, // Export
      /^🔧/, // Problèmes trouvés
      /^✅/, // Succès final
      /^❌/, // Erreurs importantes
      /^⏱️/, // Durée
      /^📦/, // Report généré
      /^🚀/, // Push question
      /Testing \w+/, // Tests individuels
      /Result:/, // Résultats de tests
      /Completed testing/, // Fin de phase
      /Found \d+ testable/, // Nombre de sorts
      /spells balanced/, // Résultats d'équilibrage
      /KEY ISSUES FOUND/, // Problèmes détectés
      /Test completed in/, // Fin de test
    ];
    
    // Messages à FILTRER (bruit des loaders automatiques)
    const filterPatterns = [
      /Auto-découverte/, // AutoLoaders
      /Tentative de chargement/, // Imports
      /chargé\(s\) depuis/, // Fichiers chargés
      /enregistré dans/, // Enregistrements
      /effets? auto-chargés/, // Stats des loaders
      /sorts? auto-chargés/, // Stats des loaders
      /passifs? auto-chargés/, // Stats des loaders
      /RÉSUMÉ DES/, // Résumés verbeux
      /Total:.*automatiquement/, // Totaux des loaders
      /Initialisation du.*Manager/, // Init des managers
      /Skip reload/, // Cache des loaders
      /Fichier.*déjà chargé/, // Cache
      /Répertoire.*non trouvé/, // Dossiers manquants
      /Cooldown check/, // Détails de cooldown des passifs
      /HP threshold check/, // Vérifications HP
      /Première utilisation/, // Passifs
      /En cooldown/, // Cooldown messages
      /MongoDB connected to/, // Connexion DB
    ];
    
    // Vérifier les patterns à garder en priorité
    if (keepPatterns.some(pattern => pattern.test(message))) {
      return true;
    }
    
    // Vérifier les patterns à filtrer
    if (filterPatterns.some(pattern => pattern.test(message))) {
      return false;
    }
    
    // Par défaut, garder les messages courts et significatifs
    return message.length < 100 && !message.includes('•');
  }
  
  // Logger spécialisé pour les phases du test
  static phase(phaseNumber: number, title: string, details?: string): void {
    const emoji = ["📊", "⚔️", "⚔️", "⚔️", "📋"][phaseNumber - 1] || "🔄";
    this.originalConsole.log(`${emoji} Phase ${phaseNumber}: ${title}`);
    if (details) {
      this.originalConsole.log(`   ${details}`);
    }
  }
  
  // Logger pour les résultats de tests
  static testResult(spellId: string, dps: number, details: string): void {
    this.originalConsole.log(`   Testing ${spellId}: ${Math.round(dps)} DPS ${details}`);
  }
  
  // Logger pour les résumés de phase
  static phaseSummary(message: string): void {
    this.originalConsole.log(`   ${message}\n`);
  }
  
  // Logger pour les résultats finaux
  static result(message: string): void {
    this.originalConsole.log(message);
  }
  
  // Logger pour les erreurs importantes
  static error(message: string, error?: any): void {
    this.originalConsole.error(`❌ ${message}`, error || '');
  }
  
  // Afficher les logs filtrés en mode debug
  static showFilteredLogs(): void {
    if (this.pendingOutput.length > 0) {
      this.originalConsole.log(`\n🔍 Debug: ${this.pendingOutput.length} messages filtered`);
      this.originalConsole.log("Use DEBUG=true to see all messages\n");
    }
  }
}

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
    
  } catch (error) {
    // Ignorer les erreurs de setup en mode silencieux
  }
}

async function pushToGit(reportPath: string, reportSummary: any): Promise<void> {
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
    
    // Ajouter les nouveaux fichiers
    await execAsync('git add .gitignore');
    await execAsync('git add logs/ -f'); // Force l'ajout même si dans .gitignore
    await execAsync('git add debugsequilibrage/ || true'); // Au cas où il existerait encore
    
    // Vérifier s'il y a quelque chose à committer
    const { stdout: statusOutput } = await execAsync('git status --porcelain');
    if (!statusOutput.trim()) {
      return;
    }
    
    // Créer un message de commit informatif
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
    
    // Commit et push
    await execAsync(`git commit -m "${commitMessage}"`);
    await execAsync('git push origin main');
    
    Logger.result("✅ Successfully pushed to GitHub!");
    Logger.result("🔗 View on: https://github.com/pokemmorgn/Soulspire/tree/main/logs/balance");
    
  } catch (error) {
    Logger.error("Git push failed", error instanceof Error ? error.message : String(error));
    Logger.result("ℹ️  You can manually push later with:");
    Logger.result("   git add logs/ -f && git commit -m 'Add balance report' && git push origin main");
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
          }
        }
      }
    }
    
  } catch (error) {
    // Ignorer les erreurs en mode silencieux
  }
}

async function fixGitignore(): Promise<void> {
  try {
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
    }
    
  } catch (error) {
    // Ignorer les erreurs
  }
}

async function setupGitConfig(): Promise<void> {
  try {
    // Vérifier si user.name est configuré
    try {
      await execAsync('git config user.name');
    } catch {
      await execAsync('git config user.name "Soulspire Auto Balance"');
    }
    
    // Vérifier si user.email est configuré
    try {
      await execAsync('git config user.email');
    } catch {
      await execAsync('git config user.email "balance-bot@soulspire.local"');
    }
    
  } catch (error) {
    // Ignorer les erreurs
  }
}

async function autoConfigureSSH(): Promise<void> {
  try {
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
        break;
      }
    }
    
    if (!sshKey) {
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
    }
    
  } catch (error) {
    // Ignorer les erreurs
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
    return 0;
  }
  
  const spellCooldown = spell.getEffectiveCooldown(testHero, spellLevel);
  const spellEnergyCost = spell.getEnergyCost(spellLevel);
  
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
  
  // Log uniquement le résultat essentiel
  const details = `(${spellCasts} casts, ${basicAttacks} basics, CD: ${spellCooldown}s)`;
  Logger.testResult(spellId, dps, details);
  
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

// ===== FONCTION DE PROMPT =====

async function promptForPush(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    Logger.result("");
    rl.question("🚀 Push this report to GitHub? (y/N): ", async (answer) => {
      rl.close();
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        Logger.result("\n📤 Launching push script...");
        
        try {
          // Importer et lancer le script de push
          const { pushReports } = await import('./pushReports');
          await pushReports();
        } catch (error) {
          Logger.error("Error launching push script", error instanceof Error ? error.message : String(error));
          Logger.result("\n📋 You can push manually later with:");
          Logger.result("   npx ts-node src/scripts/pushReports.ts");
        }
      } else {
        Logger.result("\n📋 Report saved locally. To push later, run:");
        Logger.result("   npx ts-node src/scripts/pushReports.ts");
      }
      
      resolve();
    });
  });
}

// ===== SCRIPT PRINCIPAL =====

async function runDummyBalanceTest(): Promise<void> {
  const startTime = Date.now();
  
  // ACTIVER LE MODE SILENCIEUX PENDANT L'INITIALISATION
  Logger.enableQuietMode();
  
  Logger.result("🎯 Dummy Balance Test Starting...\n");
  
  try {
    // Setup Git structure (silencieux)
    await setupGitStructure();
    
    // Connexion MongoDB
    await mongoose.connect(MONGO_URI);
    
    // Initialiser les gestionnaires (les logs de chargement sont filtrés)
    Logger.result("⚙️ Initializing game systems...");
    await SpellManager.initialize();
    await EffectManager.initialize();
    await PassiveManager.initialize();
    
    // DÉSACTIVER LE MODE SILENCIEUX POUR LES PHASES DE TEST
    Logger.disableQuietMode();
    
    // Phase 1: Scanner tous les sorts
    Logger.phase(1, "Scanning spells");
    const allSpells = SpellManager.getAllSpells();
    const testableSpells = allSpells.filter(spell => 
      spell.config.type === "active" && 
      spell.config.category === "damage"
    );
    
    Logger.phaseSummary(`Found ${testableSpells.length} testable damage spells`);
    
    if (testableSpells.length === 0) {
      Logger.error("No testable spells found!");
      return;
    }
    
    const results: SpellDpsResult[] = [];
    
    // Phase 2-4: Tester sur chaque dummy
    const dummyTypes = ["neutral", "resistant", "vulnerable"];
    for (let i = 0; i < dummyTypes.length; i++) {
      const dummyType = dummyTypes[i];
      Logger.phase(i + 2, `Testing vs ${dummyType} dummy`, `${testableSpells.length} spells to test`);
      
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
      
      Logger.phaseSummary(`Completed testing ${testableSpells.length} spells vs ${dummyType} dummy`);
    }
    
    // Phase 5: Analyse
    Logger.phase(5, "Analyzing balance", "Computing spell equilibrium metrics");
    
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
    
    Logger.phaseSummary(`✅ ${balancedCount} spells balanced (${Math.round(balancedCount / results.length * 100)}%)`);
    Logger.phaseSummary(`⚠️ ${results.length - balancedCount} spells need attention`);
    
    // Générer le rapport
    const testDuration = Math.round((Date.now() - startTime) / 1000);
    const report: BalanceReport = {
      metadata: {
        testDate: new Date().toISOString(),
        version: "1.2.0-clean-logs",
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
    Logger.result(`💾 Report exported: ${filename}`);
    
    // Afficher les problèmes clés
    if (analysis.recommendations.length > 0) {
      Logger.result("\n🔧 KEY ISSUES FOUND:");
      analysis.recommendations.slice(0, 5).forEach(rec => {
        Logger.result(`   - ${rec}`);
      });
      
      if (analysis.recommendations.length > 5) {
        Logger.result(`   ... and ${analysis.recommendations.length - 5} more (see JSON file)`);
      }
    } else {
      Logger.result("✅ All spells appear balanced!");
    }
    
    Logger.result(`\n⏱️ Test completed in ${Math.floor(testDuration / 60)}m ${testDuration % 60}s`);
    
    // Proposer de lancer le script de push
    Logger.result("\n📦 Report generated successfully!");
    Logger.result(`📁 Full report: logs/balance/${filename}`);
    
    // Afficher les logs filtrés en mode debug
    if (process.env.DEBUG !== 'true') {
      Logger.showFilteredLogs();
    }
    
    // Demander si on veut pusher
    await promptForPush();
    
  } catch (error) {
    Logger.disableQuietMode(); // S'assurer que les erreurs sont visibles
    Logger.error("Error during balance test", error instanceof Error ? error.message : String(error));
  } finally {
    Logger.disableQuietMode();
    await mongoose.disconnect();
  }
}

// ===== EXECUTION =====

if (require.main === module) {
  runDummyBalanceTest().then(() => process.exit(0));
}

export { runDummyBalanceTest };

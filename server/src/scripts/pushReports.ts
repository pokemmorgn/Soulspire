// src/scripts/pushReports.ts
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

// Charger les variables d'environnement depuis le bon répertoire
// Script: server/src/scripts/pushReports.ts
// .env:   server/.env
// Donc on remonte de 2 niveaux: ../..
const envPath = path.join(__dirname, '../../../.env');
dotenv.config({ path: envPath });

const execAsync = promisify(exec);

// ===== CONFIGURATION GITHUB =====
const GITHUB_CONFIG = {
  username: "pokemmorgn",
  token: process.env.GITHUB_TOKEN || "",
  repo: "Soulspire"
};

// ===== FONCTIONS GIT =====

async function setupGitConfig(): Promise<void> {
  try {
    console.log("   🔧 Checking Git configuration...");
    
    // Vérifier si user.name est configuré
    try {
      await execAsync('git config user.name');
    } catch {
      console.log("   📝 Setting Git user.name...");
      await execAsync('git config user.name "Soulspire Reports Bot"');
    }
    
    // Vérifier si user.email est configuré
    try {
      await execAsync('git config user.email');
    } catch {
      console.log("   📧 Setting Git user.email...");
      await execAsync('git config user.email "reports@soulspire.local"');
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

# GitHub Soulspire (auto-added by pushReports)
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

async function moveOldReports(): Promise<void> {
  try {
    const rootDir = process.cwd();
    const balanceDir = path.join(rootDir, 'logs', 'balance');
    
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(balanceDir)) {
      fs.mkdirSync(balanceDir, { recursive: true });
    }
    
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

async function analyzeReports(): Promise<{ count: number; latest: string | null; summary: any }> {
  try {
    const balanceDir = path.join(process.cwd(), 'logs', 'balance');
    
    if (!fs.existsSync(balanceDir)) {
      return { count: 0, latest: null, summary: null };
    }
    
    const files = fs.readdirSync(balanceDir)
      .filter(f => f.startsWith('balance_') && f.endsWith('.json'))
      .sort()
      .reverse(); // Plus récent en premier
    
    if (files.length === 0) {
      return { count: 0, latest: null, summary: null };
    }
    
    // Lire le rapport le plus récent
    const latestFile = files[0];
    const latestPath = path.join(balanceDir, latestFile);
    const reportContent = fs.readFileSync(latestPath, 'utf8');
    const report = JSON.parse(reportContent);
    
    return {
      count: files.length,
      latest: latestFile,
      summary: report.summary
    };
    
  } catch (error) {
    console.error("   ⚠️ Error analyzing reports:", error instanceof Error ? error.message : String(error));
    return { count: 0, latest: null, summary: null };
  }
}

// ===== SCRIPT PRINCIPAL =====

async function pushReports(): Promise<void> {
  console.log("🚀 Pushing balance reports to GitHub...\n");
  
  // Debug: vérifier que le token est chargé
  console.log("🔍 Environment check:");
  console.log(`   GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? 'FOUND ✅' : 'NOT FOUND ❌'}`);
  
  try {
    // Vérifier qu'on est dans un repo Git
    await execAsync('git rev-parse --git-dir');
    
    // Analyser les rapports disponibles
    console.log("📊 Analyzing reports...");
    const { count, latest, summary } = await analyzeReports();
    
    if (count === 0) {
      console.log("❌ No balance reports found!");
      console.log("💡 Run balance test first: npx ts-node src/scripts/dummyBalance.ts");
      return;
    }
    
    console.log(`   📁 Found ${count} report(s)`);
    console.log(`   📄 Latest: ${latest}`);
    
    if (summary) {
      console.log(`   📊 Summary: ${summary.balancedSpells}/${summary.balancedSpells + summary.overpoweredSpells + summary.underpoweredSpells} spells balanced`);
    }
    
    // Configuration Git
    await setupGitConfig();
    
    // Organisation des fichiers
    await moveOldReports();
    await fixGitignore();
    
    // Tentative de configuration SSH (optionnel)
    await autoConfigureSSH();
    
    // Ajouter les fichiers
    console.log("\n📦 Adding files to Git...");
    await execAsync('git add .gitignore');
    await execAsync('git add logs/ -f');
    
    // Vérifier s'il y a quelque chose à committer
    const { stdout: statusOutput } = await execAsync('git status --porcelain');
    if (!statusOutput.trim()) {
      console.log("✅ No changes to commit - everything up to date!");
      return;
    }
    
    console.log("   📋 Files to commit:");
    console.log(statusOutput);
    
    // Créer un message de commit informatif
    const timestamp = new Date().toLocaleString('fr-FR');
    let commitMessage = `feat: Balance reports update ${timestamp}`;
    
    if (summary) {
      commitMessage += `

Reports Summary:
- ${count} total reports
- Latest: ${latest}
- ${summary.balancedSpells} balanced spells
- ${summary.overpoweredSpells || 0} overpowered
- ${summary.underpoweredSpells || 0} underpowered
- Average DPS: ${summary.averageDps || 0}

Auto-pushed by: pushReports.ts`;
    }
    
    // Échapper les caractères spéciaux pour le commit
    commitMessage = commitMessage.replace(/"/g, '\\"');
    
    // Commit
    console.log("\n💾 Committing...");
    await execAsync(`git commit -m "${commitMessage}"`);
    
    // Push avec authentification automatique
    console.log("🚀 Pushing to GitHub...");
    
    // Vérifier que le token est présent
    if (!GITHUB_CONFIG.token) {
      throw new Error("GITHUB_TOKEN not found in environment variables");
    }
    
    // Utiliser le token GitHub pour l'authentification
    const authenticatedUrl = `https://${GITHUB_CONFIG.username}:${GITHUB_CONFIG.token}@github.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}.git`;
    
    // Temporairement changer l'origine pour inclure l'auth
    const { stdout: currentUrl } = await execAsync('git remote get-url origin');
    await execAsync(`git remote set-url origin "${authenticatedUrl}"`);
    
    try {
      await execAsync('git push origin main');
      console.log("\n✅ Successfully pushed to GitHub!");
    } finally {
      // Remettre l'URL sans token pour sécurité (dans l'historique Git)
      const cleanUrl = currentUrl.trim();
      await execAsync(`git remote set-url origin "${cleanUrl}"`);
    }
    console.log("🔗 View on: https://github.com/pokemmorgn/Soulspire/tree/main/logs/balance");
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("\n❌ Push failed:", errorMsg);
    
    if (errorMsg.includes('Permission denied') || errorMsg.includes('publickey')) {
      console.log("\n🔑 SSH Authentication failed. Options:");
      console.log("   1. Add your SSH key to GitHub: https://github.com/settings/keys");
      console.log("   2. Or use HTTPS: git remote set-url origin https://github.com/pokemmorgn/Soulspire.git");
      console.log("   3. Then retry this script");
    } else if (errorMsg.includes('Username for')) {
      console.log("\n🔐 HTTPS Authentication required:");
      console.log("   Username: pokemmorgn");
      console.log("   Password: [GitHub Personal Access Token]");
      console.log("   Get token: https://github.com/settings/tokens/new");
    } else {
      console.log("\n📋 Manual push command:");
      console.log("   git add logs/ -f && git commit -m 'Balance reports' && git push origin main");
    }
  }
}

// ===== EXECUTION =====

if (require.main === module) {
  pushReports().then(() => process.exit(0));
}

export { pushReports };

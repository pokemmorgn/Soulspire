#!/usr/bin/env ts-node
// dummyBalance.ts - Hub principal d'analyse avec modules spécialisés
import mongoose from "mongoose";
import dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

// ===== INTERFACES COMMUNES =====

interface AnalysisModule {
  name: string;
  description: string;
  run(): Promise<void>;
}

// ===== MENU INTERACTIF =====

class BalanceAnalysisHub {
  
  private modules: Map<string, AnalysisModule> = new Map();
  private rl: readline.Interface;
  
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.registerModules();
  }
  
  private registerModules(): void {
    this.modules.set("ultimate", {
      name: "Analyse des Ultimates",
      description: "Analyse spécialisée des sorts ultimates (impact, game-changing potential)",
      run: () => import('./modules/ultimateAnalyzer').then(m => m.runUltimateAnalysis())
    });
    
    this.modules.set("active", {
      name: "Analyse des Sorts Actifs",
      description: "Analyse des sorts actifs (DPS, reliability, coût/bénéfice)",
      run: () => import('./modules/activeSpellAnalyzer').then(m => m.runActiveSpellAnalysis())
    });
    
    this.modules.set("heroes", {
      name: "Analyse des Héros",
      description: "Comparaison de puissance des héros par rôle et rareté",
      run: () => import('./modules/heroAnalyzer').then(m => m.runHeroAnalysis())
    });
    
    this.modules.set("team", {
      name: "Analyse d'Équipes",
      description: "Test de compositions d'équipe et synergies",
      run: () => import('./modules/teamAnalyzer').then(m => m.runTeamAnalysis())
    });
    
    this.modules.set("economy", {
      name: "Analyse Économique",
      description: "Balance des récompenses, coûts et progression",
      run: () => import('./modules/economyAnalyzer').then(m => m.runEconomyAnalysis())
    });
    
    this.modules.set("progression", {
      name: "Analyse de Progression",
      description: "Courbe de difficulté et évolution de puissance",
      run: () => import('./modules/progressionAnalyzer').then(m => m.runProgressionAnalysis())
    });
  }
  
  async start(): Promise<void> {
    console.log("\n🎮 === HUB D'ANALYSE D'ÉQUILIBRAGE ===\n");
    console.log("Bienvenue dans le système d'analyse modulaire !");
    
    await this.connectDatabase();
    await this.showMainMenu();
  }
  
  private async connectDatabase(): Promise<void> {
    try {
      const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";
      await mongoose.connect(MONGO_URI);
      console.log("✅ Connexion MongoDB établie\n");
    } catch (error) {
      console.error("❌ Erreur connexion DB:", error);
      process.exit(1);
    }
  }
  
  private async showMainMenu(): Promise<void> {
    console.log("📋 MODULES D'ANALYSE DISPONIBLES:\n");
    
    const moduleList = Array.from(this.modules.entries());
    moduleList.forEach(([key, module], index) => {
      console.log(`   ${index + 1}. ${module.name}`);
      console.log(`      ${module.description}\n`);
    });
    
    console.log("   0. Quitter\n");
    
    const choice = await this.getUserChoice("Sélectionnez un module (0-" + moduleList.length + "): ");
    
    if (choice === "0") {
      await this.exit();
      return;
    }
    
    const moduleIndex = parseInt(choice) - 1;
    if (moduleIndex >= 0 && moduleIndex < moduleList.length) {
      const [key, module] = moduleList[moduleIndex];
      await this.runModule(key, module);
    } else {
      console.log("❌ Choix invalide. Veuillez réessayer.\n");
      await this.showMainMenu();
    }
  }
  
  private async runModule(key: string, module: AnalysisModule): Promise<void> {
    console.log(`\n🚀 Lancement du module: ${module.name}\n`);
    console.log("═".repeat(60));
    
    try {
      const startTime = Date.now();
      await module.run();
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log("═".repeat(60));
      console.log(`✅ Module terminé en ${duration}s\n`);
      
    } catch (error) {
      console.error(`❌ Erreur dans le module ${module.name}:`, error);
    }
    
    await this.showPostAnalysisMenu();
  }
  
  private async showPostAnalysisMenu(): Promise<void> {
    console.log("🔄 QUE SOUHAITEZ-VOUS FAIRE ?\n");
    console.log("   1. Lancer un autre module");
    console.log("   2. Relancer le même module");
    console.log("   3. Afficher l'aide sur les modules");
    console.log("   0. Quitter\n");
    
    const choice = await this.getUserChoice("Votre choix (0-3): ");
    
    switch (choice) {
      case "1":
        await this.showMainMenu();
        break;
      case "2":
        // TODO: Relancer le dernier module
        await this.showMainMenu();
        break;
      case "3":
        await this.showModuleHelp();
        break;
      case "0":
        await this.exit();
        break;
      default:
        console.log("❌ Choix invalide.\n");
        await this.showPostAnalysisMenu();
    }
  }
  
  private async showModuleHelp(): Promise<void> {
    console.log("\n📖 === AIDE SUR LES MODULES ===\n");
    
    console.log("🔥 ANALYSE DES SORTS ACTIFS");
    console.log("   - Teste la fréquence d'utilisation");
    console.log("   - Mesure le DPS soutenu");
    console.log("   - Analyse coût/bénéfice");
    console.log("   - Recommandations d'ajustement de coûts\n");
    
    console.log("⚡ ANALYSE DES ULTIMATES");
    console.log("   - Focus sur l'impact quand utilisés");
    console.log("   - Game-changing potential");
    console.log("   - Efficacité vs boss");
    console.log("   - Timing et disponibilité\n");
    
    console.log("🦸 ANALYSE DES HÉROS");
    console.log("   - Comparaison par rôle (Tank, DPS, Support)");
    console.log("   - Scaling par rareté");
    console.log("   - Power Score vs niveau");
    console.log("   - Détection des outliers\n");
    
    console.log("🏟️ ANALYSE D'ÉQUIPES");
    console.log("   - Test de compositions meta");
    console.log("   - Synergies élémentaires");
    console.log("   - Contre-compositions");
    console.log("   - Win rate simulations\n");
    
    console.log("💰 ANALYSE ÉCONOMIQUE");
    console.log("   - Balance des récompenses");
    console.log("   - Coût d'évolution");
    console.log("   - Drop rates");
    console.log("   - Progression F2P vs P2W\n");
    
    console.log("📈 ANALYSE DE PROGRESSION");
    console.log("   - Courbe de difficulté");
    console.log("   - Power gaps entre niveaux");
    console.log("   - Gating artificiel");
    console.log("   - Temps de progression\n");
    
    await this.getUserChoice("Appuyez sur Entrée pour continuer...");
    await this.showPostAnalysisMenu();
  }
  
  private getUserChoice(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }
  
  private async exit(): Promise<void> {
    console.log("\n👋 Fermeture du hub d'analyse...");
    await mongoose.disconnect();
    this.rl.close();
    process.exit(0);
  }
}

// ===== GESTION DES ARGUMENTS CLI =====

async function handleCliArgs(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Mode interactif par défaut
    const hub = new BalanceAnalysisHub();
    await hub.start();
    return;
  }
  
  // Mode CLI direct
  const command = args[0];
  
  switch (command) {
    case "--ultimate":
    case "-u":
      console.log("🚀 Lancement direct: Analyse des Ultimates");
      const { runUltimateAnalysis } = await import('./modules/ultimateAnalyzer');
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game");
      await runUltimateAnalysis();
      await mongoose.disconnect();
      break;
      
    case "--active":
    case "-a":
      console.log("🚀 Lancement direct: Analyse des Sorts Actifs");
      const { runActiveSpellAnalysis } = await import('./modules/activeSpellAnalyzer');
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game");
      await runActiveSpellAnalysis();
      await mongoose.disconnect();
      break;
      
    case "--heroes":
    case "-h":
      console.log("🚀 Lancement direct: Analyse des Héros");
      const { runHeroAnalysis } = await import('./modules/heroAnalyzer');
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game");
      await runHeroAnalysis();
      await mongoose.disconnect();
      break;
      
    case "--team":
    case "-t":
      console.log("🚀 Lancement direct: Analyse d'Équipes");
      const { runTeamAnalysis } = await import('./modules/teamAnalyzer');
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game");
      await runTeamAnalysis();
      await mongoose.disconnect();
      break;
      
    case "--help":
      showCliHelp();
      break;
      
    default:
      console.error(`❌ Commande inconnue: ${command}`);
      showCliHelp();
      process.exit(1);
  }
}

function showCliHelp(): void {
  console.log("\n🎮 === HUB D'ANALYSE D'ÉQUILIBRAGE ===\n");
  console.log("USAGE:");
  console.log("  npx ts-node src/scripts/dummyBalance.ts [OPTIONS]\n");
  console.log("OPTIONS:");
  console.log("  (aucun)       Mode interactif avec menu");
  console.log("  --ultimate    Analyse directe des ultimates");
  console.log("  --active      Analyse directe des sorts actifs");
  console.log("  --heroes      Analyse directe des héros");
  console.log("  --team        Analyse directe des équipes");
  console.log("  --help        Affiche cette aide\n");
  console.log("EXEMPLES:");
  console.log("  npx ts-node src/scripts/dummyBalance.ts");
  console.log("  npx ts-node src/scripts/dummyBalance.ts --ultimate");
  console.log("  npx ts-node src/scripts/dummyBalance.ts -u");
  console.log("");
}

// ===== POINT D'ENTRÉE =====

if (require.main === module) {
  handleCliArgs().catch(error => {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  });
}

export { BalanceAnalysisHub };

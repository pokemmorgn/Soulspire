#!/usr/bin/env ts-node
// dummyBalance.ts - Hub principal d'analyse avec auto-détection des modules
import mongoose from "mongoose";
import dotenv from "dotenv";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

// ===== INTERFACES COMMUNES =====

interface AnalysisModule {
  name: string;
  description: string;
  run(): Promise<void>;
}

// ===== MENU INTERACTIF AVEC AUTO-DÉTECTION =====

class BalanceAnalysisHub {
  
  private modules: Map<string, AnalysisModule> = new Map();
  private rl: readline.Interface;
  private modulesPath: string;
  
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.modulesPath = path.join(__dirname, 'modules');
    this.autoRegisterModules();
  }
  
  private autoRegisterModules(): void {
    console.log("🔍 Détection automatique des modules...");
    
    // Vérifier si le dossier modules existe
    if (!fs.existsSync(this.modulesPath)) {
      console.log("📁 Création du dossier modules...");
      fs.mkdirSync(this.modulesPath, { recursive: true });
    }
    
    // Scanner les fichiers .ts/.js dans le dossier modules
    const moduleFiles = this.scanModuleFiles();
    
    // Enregistrer les modules connus (avec fallback si fichier absent)
    this.registerKnownModules(moduleFiles);
    
    console.log(`✅ ${this.modules.size} modules détectés\n`);
  }
  
  private scanModuleFiles(): string[] {
    try {
      const files = fs.readdirSync(this.modulesPath);
      return files
        .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
        .map(file => file.replace(/\.(ts|js)$/, ''));
    } catch (error) {
      console.log("⚠️ Impossible de lire le dossier modules");
      return [];
    }
  }
  
  private registerKnownModules(availableFiles: string[]): void {
    // Définir tous les modules possibles
    const moduleDefinitions = [
      {
        key: "ultimate",
        file: "ultimateAnalyzer",
        name: "Analyse des Ultimates",
        description: "Analyse spécialisée des sorts ultimates (impact, game-changing potential)",
        functionName: "runUltimateAnalysis"
      },
      {
        key: "active",
        file: "activeSpellAnalyzer",
        name: "Analyse des Sorts Actifs",
        description: "Analyse des sorts actifs (DPS, reliability, coût/bénéfice)",
        functionName: "runActiveSpellAnalysis"
      },
      {
        key: "heroes",
        file: "heroAnalyzer",
        name: "Analyse des Héros",
        description: "Comparaison de puissance des héros par rôle et rareté",
        functionName: "runHeroAnalysis"
      },
      {
        key: "team",
        file: "teamAnalyzer",
        name: "Analyse d'Équipes",
        description: "Test de compositions d'équipe et synergies",
        functionName: "runTeamAnalysis"
      },
      {
        key: "economy",
        file: "economyAnalyzer",
        name: "Analyse Économique",
        description: "Balance des récompenses, coûts et progression",
        functionName: "runEconomyAnalysis"
      },
      {
        key: "progression",
        file: "progressionAnalyzer",
        name: "Analyse de Progression",
        description: "Courbe de difficulté et évolution de puissance",
        functionName: "runProgressionAnalysis"
      }
    ];
    
    // Enregistrer seulement les modules dont le fichier existe
    moduleDefinitions.forEach(def => {
      if (availableFiles.includes(def.file)) {
        this.modules.set(def.key, {
          name: def.name,
          description: def.description,
          run: () => this.dynamicImportModule(def.file, def.functionName)
        });
        console.log(`   ✅ ${def.name} - Module disponible`);
      } else {
        console.log(`   ⏳ ${def.name} - Module non trouvé (${def.file}.ts)`);
      }
    });
    
    // Ajouter un module de création si aucun module trouvé
    if (this.modules.size === 0) {
      this.modules.set("create", {
        name: "Créer un module d'exemple",
        description: "Génère un module d'exemple pour commencer",
        run: () => this.createExampleModule()
      });
    }
  }
  
  private async dynamicImportModule(fileName: string, functionName: string): Promise<void> {
    try {
      const modulePath = path.join(this.modulesPath, fileName);
      const module = await import(modulePath);
      
      if (typeof module[functionName] === 'function') {
        await module[functionName]();
      } else {
        throw new Error(`Fonction ${functionName} non trouvée dans ${fileName}`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors du chargement du module ${fileName}:`, error);
      console.log("💡 Vérifiez que le module exporte bien la fonction attendue");
    }
  }
  
  private async createExampleModule(): Promise<void> {
    console.log("📝 Création d'un module d'exemple...");
    
    const exampleModule = `// ultimateAnalyzer.ts - Module d'exemple généré automatiquement
import mongoose from "mongoose";

export async function runUltimateAnalysis(): Promise<void> {
  console.log("⚡ === EXEMPLE D'ANALYSE DES ULTIMATES ===\\n");
  
  console.log("🎯 Ce module est un exemple généré automatiquement");
  console.log("📋 Vous pouvez le modifier selon vos besoins\\n");
  
  // Simulation d'une analyse
  console.log("📊 Analyse en cours...");
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log("✅ Analyse terminée !\\n");
  console.log("🔧 Modifiez ce fichier dans: modules/ultimateAnalyzer.ts");
}
`;
    
    const examplePath = path.join(this.modulesPath, 'ultimateAnalyzer.ts');
    
    try {
      fs.writeFileSync(examplePath, exampleModule);
      console.log(`✅ Module d'exemple créé: ${examplePath}`);
      console.log("🔄 Relancez le script pour voir le nouveau module !");
    } catch (error) {
      console.error("❌ Erreur création module d'exemple:", error);
    }
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
      console.log("💡 Le script continuera mais certains modules peuvent échouer\n");
    }
  }
  
  private async showMainMenu(): Promise<void> {
    console.log("📋 MODULES D'ANALYSE DISPONIBLES:\n");
    
    const moduleList = Array.from(this.modules.entries());
    
    if (moduleList.length === 0) {
      console.log("   ⚠️ Aucun module trouvé !");
      console.log("   📁 Créez des modules dans le dossier: modules/");
      console.log("   💡 Exemple: modules/ultimateAnalyzer.ts\n");
    } else {
      moduleList.forEach(([key, module], index) => {
        console.log(`   ${index + 1}. ${module.name}`);
        console.log(`      ${module.description}\n`);
      });
    }
    
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
      console.log("💡 Vérifiez les imports et dépendances du module\n");
    }
    
    await this.showPostAnalysisMenu();
  }
  
  private async showPostAnalysisMenu(): Promise<void> {
    console.log("🔄 QUE SOUHAITEZ-VOUS FAIRE ?\n");
    console.log("   1. Lancer un autre module");
    console.log("   2. Rescanner les modules");
    console.log("   3. Afficher l'aide sur les modules");
    console.log("   0. Quitter\n");
    
    const choice = await this.getUserChoice("Votre choix (0-3): ");
    
    switch (choice) {
      case "1":
        await this.showMainMenu();
        break;
      case "2":
        console.log("🔄 Nouveau scan des modules...");
        this.modules.clear();
        this.autoRegisterModules();
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
    
    console.log("🔧 COMMENT CRÉER UN MODULE:");
    console.log("   1. Créez un fichier .ts dans le dossier modules/");
    console.log("   2. Exportez une fonction avec le bon nom");
    console.log("   3. Le hub détectera automatiquement le module\n");
    
    console.log("📋 EXEMPLE DE MODULE (modules/monAnalyzer.ts):");
    console.log("   export async function runMonAnalysis(): Promise<void> {");
    console.log("     console.log('Mon analyse !');");
    console.log("   }\n");
    
    console.log("🔥 MODULES PRÉVUS:");
    console.log("   📝 ultimateAnalyzer.ts - runUltimateAnalysis()");
    console.log("   📝 activeSpellAnalyzer.ts - runActiveSpellAnalysis()");
    console.log("   📝 heroAnalyzer.ts - runHeroAnalysis()");
    console.log("   📝 teamAnalyzer.ts - runTeamAnalysis()");
    console.log("   📝 economyAnalyzer.ts - runEconomyAnalysis()");
    console.log("   📝 progressionAnalyzer.ts - runProgressionAnalysis()\n");
    
    console.log("💡 CONSEILS:");
    console.log("   - Utilisez les imports relatifs (../services/BattleEngine)");
    console.log("   - Gérez les erreurs avec try/catch");
    console.log("   - Sauvegardez les rapports dans logs/balance/");
    console.log("   - Affichez des progress indicators\n");
    
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
    try {
      await mongoose.disconnect();
    } catch (error) {
      // Ignore les erreurs de déconnexion
    }
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
  
  // Mode CLI direct avec détection auto
  const command = args[0];
  const modulesPath = path.join(__dirname, 'modules');
  
  const moduleMap: Record<string, { file: string; func: string }> = {
    "--ultimate": { file: "ultimateAnalyzer", func: "runUltimateAnalysis" },
    "-u": { file: "ultimateAnalyzer", func: "runUltimateAnalysis" },
    "--active": { file: "activeSpellAnalyzer", func: "runActiveSpellAnalysis" },
    "-a": { file: "activeSpellAnalyzer", func: "runActiveSpellAnalysis" },
    "--heroes": { file: "heroAnalyzer", func: "runHeroAnalysis" },
    "-h": { file: "heroAnalyzer", func: "runHeroAnalysis" },
    "--team": { file: "teamAnalyzer", func: "runTeamAnalysis" },
    "-t": { file: "teamAnalyzer", func: "runTeamAnalysis" }
  };
  
  if (command === "--help") {
    showCliHelp();
    return;
  }
  
  const moduleInfo = moduleMap[command];
  if (!moduleInfo) {
    console.error(`❌ Commande inconnue: ${command}`);
    showCliHelp();
    process.exit(1);
  }
  
  // Vérifier si le module existe
  const modulePath = path.join(modulesPath, moduleInfo.file + '.ts');
  const modulePathJs = path.join(modulesPath, moduleInfo.file + '.js');
  
  if (!fs.existsSync(modulePath) && !fs.existsSync(modulePathJs)) {
    console.error(`❌ Module ${moduleInfo.file} non trouvé`);
    console.log(`💡 Créez le fichier: modules/${moduleInfo.file}.ts`);
    console.log(`💡 Ou lancez le mode interactif pour voir les modules disponibles`);
    process.exit(1);
  }
  
  try {
    console.log(`🚀 Lancement direct: ${moduleInfo.file}`);
    
    // Connexion DB
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game");
    
    // Import et exécution du module
    const module = await import(path.join(modulesPath, moduleInfo.file));
    
    if (typeof module[moduleInfo.func] === 'function') {
      await module[moduleInfo.func]();
    } else {
      throw new Error(`Fonction ${moduleInfo.func} non trouvée`);
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error(`❌ Erreur exécution module:`, error);
    process.exit(1);
  }
}

function showCliHelp(): void {
  console.log("\n🎮 === HUB D'ANALYSE D'ÉQUILIBRAGE ===\n");
  console.log("USAGE:");
  console.log("  npx ts-node src/scripts/dummyBalance.ts [OPTIONS]\n");
  console.log("OPTIONS:");
  console.log("  (aucun)       Mode interactif avec menu et auto-détection");
  console.log("  --ultimate    Analyse directe des ultimates (si module présent)");
  console.log("  --active      Analyse directe des sorts actifs (si module présent)");
  console.log("  --heroes      Analyse directe des héros (si module présent)");
  console.log("  --team        Analyse directe des équipes (si module présent)");
  console.log("  --help        Affiche cette aide\n");
  console.log("EXEMPLES:");
  console.log("  npx ts-node src/scripts/dummyBalance.ts");
  console.log("  npx ts-node src/scripts/dummyBalance.ts --ultimate");
  console.log("  npx ts-node src/scripts/dummyBalance.ts -u\n");
  console.log("MODULES:");
  console.log("  Le système détecte automatiquement les modules dans modules/");
  console.log("  Créez un fichier .ts avec la fonction d'export appropriée");
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

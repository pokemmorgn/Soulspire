// server/src/scripts/advancedIndexDetector.ts
// Détection avancée des sources de warnings d'index

import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m"
};
const log = (c: string, m: string) => console.log(`${c}${m}${colors.reset}`);

async function scanAllJSFiles(directory: string, extensions = ['.ts', '.js']): Promise<void> {
  const scanResults = {
    levelIndexFound: [] as string[],
    eventIdIndexFound: [] as string[],
    pluginsFound: [] as string[],
    indexCreations: [] as string[]
  };

  function scanDirectory(dir: string) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        scanDirectory(filePath);
      } else if (extensions.some(ext => file.endsWith(ext))) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const relativePath = path.relative(process.cwd(), filePath);
          
          // Chercher des patterns spécifiques
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            const lineNum = index + 1;
            const location = `${relativePath}:${lineNum}`;
            
            // Pattern level index
            if (line.includes('level') && (line.includes('index') || line.includes('Index'))) {
              if (line.includes('level: 1') || line.includes('"level"') || line.includes("'level'")) {
                scanResults.levelIndexFound.push(`${location}: ${line.trim()}`);
              }
            }
            
            // Pattern eventId index
            if (line.includes('eventId') && (line.includes('index') || line.includes('Index'))) {
              if (line.includes('eventId: 1') || line.includes('"eventId"') || line.includes("'eventId'")) {
                scanResults.eventIdIndexFound.push(`${location}: ${line.trim()}`);
              }
            }
            
            // Plugins suspects
            if (line.includes('plugin(') || line.includes('.plugin')) {
              scanResults.pluginsFound.push(`${location}: ${line.trim()}`);
            }
            
            // Créations d'index manuelles
            if (line.includes('createIndex') || line.includes('ensureIndex')) {
              scanResults.indexCreations.push(`${location}: ${line.trim()}`);
            }
          });
        } catch (error) {
          // Ignorer les erreurs de lecture de fichier
        }
      }
    }
  }

  log(colors.cyan, "🔍 Scan complet du projet...");
  scanDirectory(directory);
  
  // Afficher les résultats
  log(colors.bright, "\n📊 === RÉSULTATS DU SCAN COMPLET ===\n");
  
  if (scanResults.levelIndexFound.length > 0) {
    log(colors.red, `🔍 Index 'level' trouvés (${scanResults.levelIndexFound.length}):`);
    scanResults.levelIndexFound.forEach(result => {
      log(colors.white, `  - ${result}`);
    });
    console.log();
  }
  
  if (scanResults.eventIdIndexFound.length > 0) {
    log(colors.red, `🔍 Index 'eventId' trouvés (${scanResults.eventIdIndexFound.length}):`);
    scanResults.eventIdIndexFound.forEach(result => {
      log(colors.white, `  - ${result}`);
    });
    console.log();
  }
  
  if (scanResults.pluginsFound.length > 0) {
    log(colors.yellow, `🔌 Plugins Mongoose trouvés (${scanResults.pluginsFound.length}):`);
    scanResults.pluginsFound.slice(0, 10).forEach(result => {
      log(colors.white, `  - ${result}`);
    });
    if (scanResults.pluginsFound.length > 10) {
      log(colors.yellow, `  ... et ${scanResults.pluginsFound.length - 10} autres`);
    }
    console.log();
  }
  
  if (scanResults.indexCreations.length > 0) {
    log(colors.blue, `⚙️ Créations d'index manuelles (${scanResults.indexCreations.length}):`);
    scanResults.indexCreations.slice(0, 10).forEach(result => {
      log(colors.white, `  - ${result}`);
    });
    if (scanResults.indexCreations.length > 10) {
      log(colors.blue, `  ... et ${scanResults.indexCreations.length - 10} autres`);
    }
    console.log();
  }
}

async function checkMongooseWarnings() {
  log(colors.cyan, "🧪 Test de reproduction des warnings...");
  
  // Créer un schéma simple pour reproduire les warnings
  const testSchema = new mongoose.Schema({
    level: { type: Number, default: 1 },
    eventId: { type: String }
  });
  
  // Ajouter des index potentiellement dupliqués
  testSchema.index({ level: 1 });
  
  // Capturer les warnings
  const originalWarn = console.warn;
  const warnings: string[] = [];
  
  console.warn = function(...args) {
    const message = args.join(' ');
    if (message.includes('Duplicate schema index')) {
      warnings.push(message);
    }
    originalWarn.apply(console, args);
  };
  
  try {
    // Créer le modèle (peut déclencher les warnings)
    const TestModel = mongoose.model('TestIndexWarning', testSchema);
    
    setTimeout(() => {
      console.warn = originalWarn;
      
      if (warnings.length > 0) {
        log(colors.red, "\n⚠️ Warnings reproduits:");
        warnings.forEach(warning => {
          log(colors.white, `  ${warning}`);
        });
      } else {
        log(colors.green, "\n✅ Aucun warning reproduit avec le test");
      }
    }, 1000);
    
  } catch (error) {
    console.warn = originalWarn;
  }
}

async function checkRealIndexes() {
  try {
    log(colors.cyan, "\n🔌 Connexion à MongoDB...");
    await mongoose.connect(MONGO_URI);
    
    const db = mongoose.connection.db;
    if (!db) throw new Error("Connexion DB échouée");
    
    // Lister toutes les collections
    const collections = await db.listCollections().toArray();
    log(colors.blue, `\n📋 Collections trouvées: ${collections.length}`);
    
    for (const collection of collections) {
      const collectionName = collection.name;
      
      try {
        const indexes = await db.collection(collectionName).indexes();
        
        // Chercher des index suspects
        const suspiciousIndexes = indexes.filter(idx => 
          JSON.stringify(idx.key).includes('"level"') || 
          JSON.stringify(idx.key).includes('"eventId"') ||
          idx.name?.includes('level') ||
          idx.name?.includes('eventId')
        );
        
        if (suspiciousIndexes.length > 0) {
          log(colors.red, `\n🔍 Index suspects dans '${collectionName}':`);
          suspiciousIndexes.forEach(idx => {
            log(colors.white, `  - ${idx.name}: ${JSON.stringify(idx.key)}`);
          });
        }
      } catch (error: any) {
        log(colors.yellow, `  ⚠️ Erreur lecture ${collectionName}: ${error.message}`);
      }
    }
    
  } catch (error: any) {
    log(colors.red, `❌ Erreur MongoDB: ${error.message}`);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

async function findWarningSource() {
  try {
    log(colors.cyan, "🔍 === DÉTECTION AVANCÉE DES WARNINGS ===\n");
    
    // 1. Scanner tous les fichiers du projet
    await scanAllJSFiles(process.cwd());
    
    // 2. Vérifier les index MongoDB réels
    await checkRealIndexes();
    
    // 3. Tester la reproduction des warnings
    await checkMongooseWarnings();
    
    log(colors.cyan, "\n💡 === SUGGESTIONS ===");
    log(colors.white, "1. Si des index 'level' ou 'eventId' sont trouvés ci-dessus, les examiner");
    log(colors.white, "2. Si des plugins sont trouvés, vérifier s'ils créent des index automatiquement");
    log(colors.white, "3. Les warnings peuvent venir de modèles dans node_modules");
    log(colors.white, "4. Essayer de lancer avec --trace-warnings pour voir la source exacte");
    log(colors.yellow, "\nCommande de trace:");
    log(colors.blue, "node --trace-warnings node_modules/.bin/ts-node server/src/scripts/testAfkFinal.ts");
    
  } catch (error: any) {
    log(colors.red, `❌ Erreur: ${error.message}`);
    console.error("Stack:", error.stack);
  }
}

// Aide
function showUsage() {
  log(colors.cyan, "\n🔍 === DÉTECTEUR AVANCÉ DE WARNINGS ===");
  console.log("Ce script fait un scan complet pour trouver la source des warnings :");
  console.log("• 🔍 Scan de TOUS les fichiers du projet");
  console.log("• 🔍 Recherche de patterns 'level' et 'eventId'");
  console.log("• 🔍 Détection des plugins Mongoose");
  console.log("• 🔍 Vérification des index MongoDB réels");
  console.log("• 🧪 Test de reproduction des warnings");
  console.log("\nLancement:");
  console.log("npx ts-node server/src/scripts/advancedIndexDetector.ts");
  console.log("");
}

if (require.main === module) {
  showUsage();
  findWarningSource().then(() => process.exit(0));
}

export default findWarningSource;

// server/src/scripts/findDuplicateIndexes.ts
// Script pour identifier les modèles avec des index dupliqués

import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";
const MODELS_DIR = path.join(__dirname, "../models");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};
const log = (c: string, m: string) => console.log(`${c}${m}${colors.reset}`);

interface IndexIssue {
  file: string;
  field: string;
  line: number;
  issue: "field_and_schema" | "multiple_schema";
  suggestion: string;
}

async function scanModelFiles(): Promise<IndexIssue[]> {
  const issues: IndexIssue[] = [];
  
  // Obtenir tous les fichiers .ts dans le dossier models
  const modelFiles = fs.readdirSync(MODELS_DIR)
    .filter(file => file.endsWith('.ts'))
    .map(file => path.join(MODELS_DIR, file));

  log(colors.cyan, `\n🔍 Scan de ${modelFiles.length} fichiers modèles...\n`);

  for (const filePath of modelFiles) {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    log(colors.blue, `📄 Analyse ${fileName}...`);

    // Chercher les patterns problématiques
    const schemaIndexes = new Map<string, number[]>(); // field -> lignes avec schema.index()
    const fieldIndexes = new Map<string, number[]>();   // field -> lignes avec index: true

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Pattern 1: index: true dans la définition du champ
      const fieldIndexMatch = line.match(/(\w+):\s*\{[^}]*index:\s*true/);
      if (fieldIndexMatch) {
        const field = fieldIndexMatch[1];
        if (!fieldIndexes.has(field)) fieldIndexes.set(field, []);
        fieldIndexes.get(field)!.push(lineNum);
      }
      
      // Pattern 2: unique: true dans la définition du champ
      const uniqueFieldMatch = line.match(/(\w+):\s*\{[^}]*unique:\s*true/);
      if (uniqueFieldMatch) {
        const field = uniqueFieldMatch[1];
        if (!fieldIndexes.has(field)) fieldIndexes.set(field, []);
        fieldIndexes.get(field)!.push(lineNum);
      }
      
      // Pattern 3: schema.index() avec un seul champ
      const schemaIndexMatch = line.match(/schema\.index\(\s*\{\s*(\w+):\s*[^}]+\}/);
      if (schemaIndexMatch) {
        const field = schemaIndexMatch[1];
        if (!schemaIndexes.has(field)) schemaIndexes.set(field, []);
        schemaIndexes.get(field)!.push(lineNum);
      }
      
      // Pattern 4: Multiple schema.index() pour le même champ
      const multipleSchemaMatch = line.match(/schema\.index\(\s*\{\s*(\w+):/);
      if (multipleSchemaMatch) {
        const field = multipleSchemaMatch[1];
        if (!schemaIndexes.has(field)) schemaIndexes.set(field, []);
        schemaIndexes.get(field)!.push(lineNum);
      }
    });

    // Détecter les problèmes
    
    // Problème 1: field index + schema index
    for (const [field, fieldLines] of fieldIndexes) {
      if (schemaIndexes.has(field)) {
        const schemaLines = schemaIndexes.get(field)!;
        issues.push({
          file: fileName,
          field,
          line: fieldLines[0],
          issue: "field_and_schema",
          suggestion: `Supprimer 'index: true' ou 'unique: true' ligne ${fieldLines.join(', ')} et garder seulement schema.index() ligne ${schemaLines.join(', ')}`
        });
      }
    }
    
    // Problème 2: Multiple schema.index() pour le même champ
    for (const [field, lines] of schemaIndexes) {
      if (lines.length > 1) {
        issues.push({
          file: fileName,
          field,
          line: lines[0],
          issue: "multiple_schema",
          suggestion: `Plusieurs schema.index() pour '${field}' aux lignes ${lines.join(', ')}. Garder seulement un.`
        });
      }
    }

    if (issues.filter(i => i.file === fileName).length === 0) {
      log(colors.green, `  ✅ Aucun problème d'index détecté`);
    }
  }

  return issues;
}

async function findDuplicateIndexes() {
  try {
    log(colors.cyan, "🔍 === RECHERCHE INDEX DUPLIQUÉS ===\n");
    
    // Scanner les fichiers modèles
    const issues = await scanModelFiles();
    
    if (issues.length === 0) {
      log(colors.green, "\n🎉 Aucun problème d'index détecté dans les modèles !");
      return;
    }

    // Afficher les problèmes trouvés
    log(colors.red, `\n❌ ${issues.length} problème(s) d'index détecté(s) :\n`);
    
    issues.forEach((issue, index) => {
      log(colors.yellow, `${index + 1}. ${issue.file} - Champ '${issue.field}'`);
      log(colors.white, `   Ligne ${issue.line}: ${issue.issue === 'field_and_schema' ? 'Index défini dans le champ ET schema' : 'Index dupliqués dans schema'}`);
      log(colors.blue, `   💡 ${issue.suggestion}\n`);
    });

    // Connexion à MongoDB pour vérifier les index réels
    log(colors.cyan, "🔌 Connexion à MongoDB pour vérifier les index réels...");
    await mongoose.connect(MONGO_URI);
    
    const db = mongoose.connection.db;
    if (!db) throw new Error("Connexion DB échouée");

    // Vérifier les index des collections suspectes
    const suspiciousCollections = ['players', 'accounts', 'events', 'campaigns'];
    
    for (const collectionName of suspiciousCollections) {
      try {
        const indexes = await db.collection(collectionName).indexes();
        log(colors.blue, `\n📋 Index réels sur ${collectionName}:`);
        
        const levelIndexes = indexes.filter(idx => 
          JSON.stringify(idx.key).includes('"level":1') || 
          JSON.stringify(idx.key).includes('"eventId":1')
        );
        
        if (levelIndexes.length > 0) {
          log(colors.red, `  ⚠️ Index suspects trouvés:`);
          levelIndexes.forEach(idx => {
            log(colors.white, `    - ${idx.name}: ${JSON.stringify(idx.key)}`);
          });
        } else {
          log(colors.green, `  ✅ Pas d'index 'level' ou 'eventId' dupliqués`);
        }
      } catch (error: any) {
        log(colors.yellow, `  ⚠️ Collection ${collectionName} non trouvée: ${error.message}`);
      }
    }

    log(colors.cyan, "\n🔧 === CORRECTIONS SUGGÉRÉES ===");
    log(colors.white, "1. Pour chaque problème détecté, appliquer la suggestion");
    log(colors.white, "2. Recompiler les modèles");
    log(colors.white, "3. Optionnel: Lancer le reset des index si les warnings persistent");

  } catch (error: any) {
    log(colors.red, `❌ Erreur: ${error.message}`);
    console.error("Stack:", error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      log(colors.green, "\n🔌 Déconnecté de MongoDB");
    }
  }
}

// Aide
function showUsage() {
  log(colors.cyan, "\n🔍 === DÉTECTEUR INDEX DUPLIQUÉS ===");
  console.log("Ce script analyse les modèles Mongoose pour détecter :");
  console.log("• 🔍 Champs avec 'index: true' ET schema.index()");
  console.log("• 🔍 Multiples schema.index() pour le même champ");
  console.log("• 🔍 Index MongoDB réels sur les collections");
  console.log("• 💡 Suggestions de correction automatiques");
  console.log("\nLancement:");
  console.log("npx ts-node server/src/scripts/findDuplicateIndexes.ts");
  console.log("");
}

if (require.main === module) {
  showUsage();
  findDuplicateIndexes().then(() => process.exit(0));
}

export default findDuplicateIndexes;

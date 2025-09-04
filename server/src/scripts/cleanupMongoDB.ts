import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = (message: string, color: string = colors.reset) => {
  console.log(`${color}${message}${colors.reset}`);
};

async function cleanupMongoDBIndexes(): Promise<void> {
  let connection: typeof mongoose | null = null;
  
  try {
    log("🔗 Connexion à MongoDB...", colors.cyan);
    connection = await mongoose.connect(MONGO_URI);
    log("✅ Connecté à MongoDB", colors.green);

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Impossible d'établir la connexion à la base de données");
    }

    const inventoriesCollection = db.collection('inventories');
    const playersCollection = db.collection('players');
    const itemsCollection = db.collection('items');

    // 1. Afficher les index existants
    log("\n🔍 Index existants sur la collection 'inventories':", colors.yellow);
    try {
      const indexes = await inventoriesCollection.indexes();
      indexes.forEach((index: any, i: number) => {
        log(`   ${i + 1}. ${index.name} - ${JSON.stringify(index.key)}`, colors.blue);
      });
    } catch (error: any) {
      log(`   ⚠️ Erreur lors de la récupération des index: ${error.message}`, colors.yellow);
    }

    // 2. Supprimer les index problématiques
    log("\n🗑️ Suppression des index problématiques...", colors.yellow);
    const indexesToDrop = [
      'storage.weapons.instanceId_1',
      'storage.helmets.instanceId_1', 
      'storage.armors.instanceId_1',
      'storage.boots.instanceId_1',
      'storage.gloves.instanceId_1',
      'storage.accessories.instanceId_1',
      'storage.*.instanceId_1'
    ];

    let droppedCount = 0;
    for (const indexName of indexesToDrop) {
      try {
        await inventoriesCollection.dropIndex(indexName);
        log(`   ✅ Supprimé: ${indexName}`, colors.green);
        droppedCount++;
      } catch (error: any) {
        if (error.code === 27 || error.message.includes('not found') || error.message.includes('does not exist')) {
          log(`   ℹ️ Index '${indexName}' déjà supprimé ou inexistant`, colors.blue);
        } else {
          log(`   ⚠️ Erreur lors de la suppression de '${indexName}': ${error.message}`, colors.yellow);
        }
      }
    }

    // 3. Nettoyer les documents avec des valeurs null/undefined dans instanceId
    log("\n🧹 Nettoyage des documents avec instanceId invalides...", colors.yellow);
    
    const categories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
    let totalModified = 0;
    
    for (const category of categories) {
      try {
        // ✅ SOLUTION DÉFINITIVE : Utiliser une approche en plusieurs étapes
        
        // Étape 1 : Supprimer les items avec instanceId null
        const result1 = await inventoriesCollection.updateMany(
          { [`storage.${category}.instanceId`]: null },
          { $pull: { [`storage.${category}`]: { instanceId: null } } }
        );
        
        // Étape 2 : Supprimer les items avec instanceId vide
        const result2 = await inventoriesCollection.updateMany(
          { [`storage.${category}.instanceId`]: "" },
          { $pull: { [`storage.${category}`]: { instanceId: "" } } }
        );
        
        // Étape 3 : Supprimer les items sans instanceId
        const result3 = await inventoriesCollection.updateMany(
          { [`storage.${category}`]: { $elemMatch: { instanceId: { $exists: false } } } },
          { $pull: { [`storage.${category}`]: { instanceId: { $exists: false } } } }
        );
        
        const categoryModified = result1.modifiedCount + result2.modifiedCount + result3.modifiedCount;
        totalModified += categoryModified;
        
        if (categoryModified > 0) {
          log(`   ✅ ${category}: ${categoryModified} documents nettoyés`, colors.green);
        }
      } catch (error: any) {
        log(`   ⚠️ Erreur lors du nettoyage de ${category}: ${error.message}`, colors.yellow);
      }
    }
    
    log(`   ✅ Total: ${totalModified} documents nettoyés`, colors.green);

    // 4. Supprimer les documents d'inventaire complètement vides ou corrompus
    log("\n🗑️ Suppression des inventaires corrompus...", colors.yellow);
    
    let deletedInventoriesCount = 0;
    try {
      const deleteResult = await inventoriesCollection.deleteMany({
        $or: [
          { playerId: null },
          { playerId: "" },
          { playerId: { $exists: false } },
          { storage: null },
          { storage: { $exists: false } }
        ]
      });

      deletedInventoriesCount = deleteResult.deletedCount;
      if (deleteResult.deletedCount > 0) {
        log(`   ✅ ${deleteResult.deletedCount} inventaires corrompus supprimés`, colors.green);
      } else {
        log(`   ℹ️ Aucun inventaire corrompu trouvé`, colors.blue);
      }
    } catch (error: any) {
      log(`   ⚠️ Erreur lors de la suppression des inventaires corrompus: ${error.message}`, colors.yellow);
    }

    // 5. Nettoyer les données de test existantes
    log("\n🧪 Nettoyage des données de test...", colors.yellow);
    
    let totalTestDataDeleted = 0;
    
    // Supprimer les joueurs de test
    try {
      const playersResult = await playersCollection.deleteMany({ 
        username: { $regex: /forge_test|test_player/i }
      });
      totalTestDataDeleted += playersResult.deletedCount;
      if (playersResult.deletedCount > 0) {
        log(`   ✅ ${playersResult.deletedCount} joueurs de test supprimés`, colors.green);
      }
    } catch (error: any) {
      log(`   ⚠️ Erreur lors de la suppression des joueurs de test: ${error.message}`, colors.yellow);
    }

    // Supprimer les inventaires de test
    try {
      const inventoriesResult = await inventoriesCollection.deleteMany({ 
        playerId: { $regex: /forge_test/i }
      });
      totalTestDataDeleted += inventoriesResult.deletedCount;
      if (inventoriesResult.deletedCount > 0) {
        log(`   ✅ ${inventoriesResult.deletedCount} inventaires de test supprimés`, colors.green);
      }
    } catch (error: any) {
      log(`   ⚠️ Erreur lors de la suppression des inventaires de test: ${error.message}`, colors.yellow);
    }

    // Supprimer les items de test
    try {
      const itemsResult = await itemsCollection.deleteMany({ 
        itemId: { 
          $regex: /^(common_|rare_|epic_|legendary_|mythic_|reforge_stone|magic_dust|mystic_scroll|celestial_essence|enhancement_stone|silver_dust|gold_dust|platinum_dust|legendary_essence|fusion_stone|magic_essence|celestial_fragment|tier_stone|enhancement_dust|rare_crystal|epic_essence|legendary_core|silver_thread|golden_thread|mystic_ore|divine_shard)/ 
        }
      });
      totalTestDataDeleted += itemsResult.deletedCount;
      if (itemsResult.deletedCount > 0) {
        log(`   ✅ ${itemsResult.deletedCount} items de test supprimés`, colors.green);
      }
    } catch (error: any) {
      log(`   ⚠️ Erreur lors de la suppression des items de test: ${error.message}`, colors.yellow);
    }

    if (totalTestDataDeleted === 0) {
      log(`   ℹ️ Aucune donnée de test trouvée`, colors.blue);
    }

    // 6. Vérifier et recréer les index de base (optionnel)
    log("\n🔧 Vérification des index de base...", colors.yellow);
    try {
      // S'assurer que l'index principal existe
      const existingIndexes = await inventoriesCollection.indexes();
      const hasPlayerIdIndex = existingIndexes.some(idx => 
        idx.name === 'playerId_1' || JSON.stringify(idx.key).includes('playerId')
      );
      
      if (!hasPlayerIdIndex) {
        await inventoriesCollection.createIndex({ playerId: 1 }, { unique: true });
        log(`   ✅ Index playerId recréé`, colors.green);
      } else {
        log(`   ℹ️ Index playerId déjà présent`, colors.blue);
      }
    } catch (error: any) {
      log(`   ⚠️ Erreur lors de la vérification des index: ${error.message}`, colors.yellow);
    }

    // 7. Afficher les index restants
    log("\n📋 Index restants après nettoyage:", colors.yellow);
    try {
      const finalIndexes = await inventoriesCollection.indexes();
      finalIndexes.forEach((index: any, i: number) => {
        log(`   ${i + 1}. ${index.name} - ${JSON.stringify(index.key)}`, colors.blue);
      });
    } catch (error: any) {
      log(`   ⚠️ Erreur lors de la récupération des index finaux: ${error.message}`, colors.yellow);
    }

    // 8. Statistiques finales
    log("\n📊 Statistiques de nettoyage:", colors.bright);
    log(`   🗑️ Index supprimés: ${droppedCount}`, colors.green);
    log(`   🧹 Documents nettoyés: ${totalModified}`, colors.green);
    log(`   🗂️ Inventaires supprimés: ${deletedInventoriesCount}`, colors.green);
    log(`   🧪 Données de test supprimées: ${totalTestDataDeleted}`, colors.green);

    log("\n✅ Nettoyage terminé avec succès!", colors.green);
    log("\n🚀 Vous pouvez maintenant relancer les tests de forge:", colors.cyan);
    log("   npx ts-node src/scripts/testForgeComplete.ts", colors.blue);

  } catch (error: any) {
    log(`\n💥 Erreur lors du nettoyage: ${error.message}`, colors.red);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, colors.red);
    }
    throw error;
  } finally {
    try {
      if (connection) {
        await mongoose.connection.close();
        log("\n🔌 Connexion MongoDB fermée", colors.blue);
      }
    } catch (error: any) {
      log(`⚠️ Erreur lors de la fermeture: ${error.message}`, colors.yellow);
    }
  }
}

// Fonction principale
const main = async (): Promise<void> => {
  log("🧹 SCRIPT DE NETTOYAGE MONGODB - SYSTÈME DE FORGE", colors.bright);
  log("=".repeat(60), colors.bright);
  log("📝 Ce script va :", colors.yellow);
  log("   • Supprimer les index problématiques sur instanceId", colors.reset);
  log("   • Nettoyer les documents corrompus", colors.reset);
  log("   • Supprimer les données de test existantes", colors.reset);
  log("   • Préparer la DB pour les tests de forge", colors.reset);
  log("=".repeat(60), colors.bright);

  // Demander confirmation
  log("\n⚠️  ATTENTION: Cette opération va modifier votre base de données!", colors.yellow);
  log("Appuyez sur Ctrl+C pour annuler, ou attendez 3 secondes pour continuer...", colors.yellow);
  
  // Attendre 3 secondes pour permettre l'annulation
  await new Promise(resolve => setTimeout(resolve, 3000));
  log("🚀 Début du nettoyage...", colors.cyan);

  try {
    await cleanupMongoDBIndexes();
    log("\n🎉 Script terminé avec succès!", colors.green);
    process.exit(0);
  } catch (error) {
    log("\n💥 Script échoué!", colors.red);
    process.exit(1);
  }
};

// Point d'entrée
if (require.main === module) {
  main().catch((error) => {
    console.error("Erreur fatale:", error);
    process.exit(1);
  });
}

export default cleanupMongoDBIndexes;

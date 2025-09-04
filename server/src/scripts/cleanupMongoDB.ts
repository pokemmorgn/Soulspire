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
  try {
    log("🔗 Connexion à MongoDB...", colors.cyan);
    await mongoose.connect(MONGO_URI);
    log("✅ Connecté à MongoDB", colors.green);

    const db = mongoose.connection.db;
    const collection = db.collection('inventories');

    // 1. Afficher les index existants
    log("\n🔍 Index existants sur la collection 'inventories':", colors.yellow);
    const indexes = await collection.indexes();
    indexes.forEach((index: any, i: number) => {
      log(`   ${i + 1}. ${index.name} - ${JSON.stringify(index.key)}`, colors.blue);
    });

    // 2. Supprimer les index problématiques
    log("\n🗑️ Suppression des index problématiques...", colors.yellow);
    const indexesToDrop = [
      'storage.weapons.instanceId_1',
      'storage.helmets.instanceId_1', 
      'storage.armors.instanceId_1',
      'storage.boots.instanceId_1',
      'storage.gloves.instanceId_1',
      'storage.accessories.instanceId_1'
    ];

    let droppedCount = 0;
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        log(`   ✅ Supprimé: ${indexName}`, colors.green);
        droppedCount++;
      } catch (error: any) {
        if (error.code === 27 || error.message.includes('not found')) {
          log(`   ℹ️ Index '${indexName}' déjà supprimé ou inexistant`, colors.blue);
        } else {
          log(`   ⚠️ Erreur lors de la suppression de '${indexName}': ${error.message}`, colors.yellow);
        }
      }
    }

    // 3. Nettoyer les documents avec des valeurs null/undefined dans instanceId
    log("\n🧹 Nettoyage des documents avec instanceId invalides...", colors.yellow);
    
    const updateResult = await collection.updateMany(
      {},
      {
        $pull: {
          'storage.weapons': { 
            $or: [
              { instanceId: { $in: [null, undefined, ''] } },
              { instanceId: { $exists: false } }
            ]
          },
          'storage.helmets': { 
            $or: [
              { instanceId: { $in: [null, undefined, ''] } },
              { instanceId: { $exists: false } }
            ]
          },
          'storage.armors': { 
            $or: [
              { instanceId: { $in: [null, undefined, ''] } },
              { instanceId: { $exists: false } }
            ]
          },
          'storage.boots': { 
            $or: [
              { instanceId: { $in: [null, undefined, ''] } },
              { instanceId: { $exists: false } }
            ]
          },
          'storage.gloves': { 
            $or: [
              { instanceId: { $in: [null, undefined, ''] } },
              { instanceId: { $exists: false } }
            ]
          },
          'storage.accessories': { 
            $or: [
              { instanceId: { $in: [null, undefined, ''] } },
              { instanceId: { $exists: false } }
            ]
          }
        }
      }
    );

    log(`   ✅ ${updateResult.modifiedCount} documents nettoyés`, colors.green);

    // 4. Supprimer les documents d'inventaire complètement vides ou corrompus
    log("\n🗑️ Suppression des inventaires corrompus...", colors.yellow);
    
    const deleteResult = await collection.deleteMany({
      $or: [
        { playerId: { $in: [null, undefined, ''] } },
        { storage: null },
        { storage: undefined }
      ]
    });

    if (deleteResult.deletedCount > 0) {
      log(`   ✅ ${deleteResult.deletedCount} inventaires corrompus supprimés`, colors.green);
    } else {
      log(`   ℹ️ Aucun inventaire corrompu trouvé`, colors.blue);
    }

    // 5. Nettoyer les données de test existantes
    log("\n🧪 Nettoyage des données de test...", colors.yellow);
    
    const testCleanupResults = await Promise.all([
      // Supprimer les joueurs de test
      db.collection('players').deleteMany({ 
        username: { $regex: /forge_test|test_player/i }
      }),
      // Supprimer les inventaires de test
      db.collection('inventories').deleteMany({ 
        playerId: { $regex: /forge_test/i }
      }),
      // Supprimer les items de test
      db.collection('items').deleteMany({ 
        itemId: { 
          $regex: /^(common_|rare_|epic_|legendary_|mythic_|reforge_stone|magic_dust|mystic_scroll|celestial_essence|enhancement_stone|silver_dust|gold_dust|platinum_dust|legendary_essence|fusion_stone|magic_essence|celestial_fragment|tier_stone|enhancement_dust|rare_crystal|epic_essence|legendary_core|silver_thread|golden_thread|mystic_ore|divine_shard)/ 
        }
      })
    ]);

    const totalTestDataDeleted = testCleanupResults.reduce((sum, result) => sum + result.deletedCount, 0);
    if (totalTestDataDeleted > 0) {
      log(`   ✅ ${totalTestDataDeleted} documents de test supprimés`, colors.green);
    } else {
      log(`   ℹ️ Aucune donnée de test trouvée`, colors.blue);
    }

    // 6. Afficher les index restants
    log("\n📋 Index restants après nettoyage:", colors.yellow);
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach((index: any, i: number) => {
      log(`   ${i + 1}. ${index.name} - ${JSON.stringify(index.key)}`, colors.blue);
    });

    // 7. Statistiques finales
    log("\n📊 Statistiques de nettoyage:", colors.bright);
    log(`   🗑️ Index supprimés: ${droppedCount}`, colors.green);
    log(`   🧹 Documents nettoyés: ${totalModified}`, colors.green);
    log(`   🗂️ Inventaires supprimés: ${deleteResult.deletedCount}`, colors.green);
    log(`   🧪 Données de test supprimées: ${totalTestDataDeleted}`, colors.green);

    log("\n✅ Nettoyage terminé avec succès!", colors.green);
    log("\n🚀 Vous pouvez maintenant relancer les tests de forge:", colors.cyan);
    log("   npx ts-node src/scripts/testForgeComplete.ts", colors.blue);

  } catch (error: any) {
    log(`\n💥 Erreur lors du nettoyage: ${error.message}`, colors.red);
    console.error(error.stack);
    throw error;
  } finally {
    try {
      await mongoose.connection.close();
      log("\n🔌 Connexion MongoDB fermée", colors.blue);
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
  main();
}

export default cleanupMongoDBIndexes;

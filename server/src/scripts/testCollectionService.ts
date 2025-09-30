import mongoose from "mongoose";
import dotenv from "dotenv";
import { CollectionService } from "../services/CollectionService";
import Player from "../models/Player";
import Hero from "../models/Hero";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/unity-gacha-game";

/**
 * Script de test du CollectionService
 * Usage: npx ts-node src/scripts/testCollectionService.ts [playerId]
 */
async function testCollectionService() {
  try {
    console.log("🔗 Connexion à MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connecté à MongoDB\n");

    // Récupérer l'ID du joueur (argument ou premier joueur trouvé)
    let playerId = process.argv[2];
    
    if (!playerId) {
      console.log("ℹ️  Aucun playerId fourni, recherche du premier joueur...");
      const firstPlayer = await Player.findOne().select('_id username');
      if (!firstPlayer) {
        console.error("❌ Aucun joueur trouvé dans la base de données");
        process.exit(1);
      }
      playerId = firstPlayer._id.toString();
      console.log(`✅ Joueur trouvé: ${firstPlayer.username} (${playerId})\n`);
    }

    console.log("=" .repeat(60));
    console.log("🧪 TEST DU COLLECTION SERVICE");
    console.log("=" .repeat(60));
    console.log(`Player ID: ${playerId}\n`);

    // === TEST 1: Collection Progress Basique ===
    console.log("📊 TEST 1: Collection Progress Basique");
    console.log("-".repeat(60));
    const startTime1 = Date.now();
    const basicProgress = await CollectionService.getPlayerCollectionProgress(playerId);
    const duration1 = Date.now() - startTime1;
    
    console.log("Résultat:");
    console.log(`  ├─ Total de héros: ${basicProgress.totalHeroes}`);
    console.log(`  ├─ Héros possédés: ${basicProgress.ownedHeroes}`);
    console.log(`  └─ Pourcentage: ${basicProgress.completionPercentage}%`);
    console.log(`⏱️  Temps d'exécution: ${duration1}ms\n`);

    // === TEST 2: Cache Performance ===
    console.log("🚀 TEST 2: Performance du Cache");
    console.log("-".repeat(60));
    const startTime2 = Date.now();
    const cachedProgress = await CollectionService.getPlayerCollectionProgress(playerId);
    const duration2 = Date.now() - startTime2;
    
    console.log("Résultat (depuis le cache):");
    console.log(`  ├─ Héros possédés: ${cachedProgress.ownedHeroes}`);
    console.log(`  └─ Pourcentage: ${cachedProgress.completionPercentage}%`);
    console.log(`⏱️  Temps d'exécution: ${duration2}ms`);
    console.log(`⚡ Amélioration: ${Math.round(((duration1 - duration2) / duration1) * 100)}% plus rapide\n`);

    // === TEST 3: Collection Détaillée par Rareté ===
    console.log("🎯 TEST 3: Collection Détaillée par Rareté");
    console.log("-".repeat(60));
    const startTime3 = Date.now();
    const detailedProgress = await CollectionService.getDetailedCollectionProgress(playerId);
    const duration3 = Date.now() - startTime3;
    
    console.log("Résultat:");
    console.log(`  Global: ${detailedProgress.ownedHeroes}/${detailedProgress.totalHeroes} (${detailedProgress.completionPercentage}%)`);
    console.log("\n  Par rareté:");
    console.log(`  ├─ Common:    ${detailedProgress.byRarity.Common.owned}/${detailedProgress.byRarity.Common.total} (${detailedProgress.byRarity.Common.percentage}%)`);
    console.log(`  ├─ Rare:      ${detailedProgress.byRarity.Rare.owned}/${detailedProgress.byRarity.Rare.total} (${detailedProgress.byRarity.Rare.percentage}%)`);
    console.log(`  ├─ Epic:      ${detailedProgress.byRarity.Epic.owned}/${detailedProgress.byRarity.Epic.total} (${detailedProgress.byRarity.Epic.percentage}%)`);
    console.log(`  └─ Legendary: ${detailedProgress.byRarity.Legendary.owned}/${detailedProgress.byRarity.Legendary.total} (${detailedProgress.byRarity.Legendary.percentage}%)`);
    console.log(`⏱️  Temps d'exécution: ${duration3}ms\n`);

    // === TEST 4: Collection par Élément ===
    console.log("🔥 TEST 4: Collection par Élément");
    console.log("-".repeat(60));
    const startTime4 = Date.now();
    const byElement = await CollectionService.getCollectionByElement(playerId);
    const duration4 = Date.now() - startTime4;
    
    console.log("Résultat:");
    Object.entries(byElement).forEach(([element, data]) => {
      console.log(`  ├─ ${element.padEnd(10)}: ${data.owned}/${data.total} (${data.percentage}%)`);
    });
    console.log(`⏱️  Temps d'exécution: ${duration4}ms\n`);

    // === TEST 5: Collection par Rôle ===
    console.log("⚔️  TEST 5: Collection par Rôle");
    console.log("-".repeat(60));
    const startTime5 = Date.now();
    const byRole = await CollectionService.getCollectionByRole(playerId);
    const duration5 = Date.now() - startTime5;
    
    console.log("Résultat:");
    Object.entries(byRole).forEach(([role, data]) => {
      console.log(`  ├─ ${role.padEnd(15)}: ${data.owned}/${data.total} (${data.percentage}%)`);
    });
    console.log(`⏱️  Temps d'exécution: ${duration5}ms\n`);

    // === TEST 6: Héros Manquants ===
    console.log("❓ TEST 6: Héros Manquants (Top 5)");
    console.log("-".repeat(60));
    const startTime6 = Date.now();
    const missingHeroes = await CollectionService.getMissingHeroes(playerId, 5);
    const duration6 = Date.now() - startTime6;
    
    console.log(`Résultat (${missingHeroes.length} héros manquants affichés):`);
    if (missingHeroes.length === 0) {
      console.log("  🎉 Collection complète ! Tous les héros sont possédés !");
    } else {
      missingHeroes.forEach((hero, index) => {
        console.log(`  ${index + 1}. ${hero.name.padEnd(20)} [${hero.rarity}] - ${hero.element} ${hero.role}`);
      });
    }
    console.log(`⏱️  Temps d'exécution: ${duration6}ms\n`);

    // === TEST 7: Statistiques d'Acquisition ===
    console.log("📈 TEST 7: Statistiques d'Acquisition");
    console.log("-".repeat(60));
    const startTime7 = Date.now();
    const acquisitionStats = await CollectionService.getAcquisitionStats(playerId);
    const duration7 = Date.now() - startTime7;
    
    console.log("Résultat:");
    console.log(`  ├─ Total de pulls: ${acquisitionStats.totalPulls}`);
    console.log(`  ├─ Héros uniques obtenus: ${acquisitionStats.uniqueHeroesObtained}`);
    console.log(`  ├─ Taux de doublons: ${acquisitionStats.duplicateRate}%`);
    console.log(`  └─ Taille actuelle de la collection: ${acquisitionStats.currentCollectionSize}`);
    console.log(`⏱️  Temps d'exécution: ${duration7}ms\n`);

    // === TEST 8: Invalidation du Cache ===
    console.log("🗑️  TEST 8: Invalidation du Cache");
    console.log("-".repeat(60));
    CollectionService.invalidateCache(playerId);
    console.log("✅ Cache invalidé pour ce joueur");
    
    const startTime8 = Date.now();
    const refreshedProgress = await CollectionService.getPlayerCollectionProgress(playerId);
    const duration8 = Date.now() - startTime8;
    
    console.log(`Résultat (données fraîches): ${refreshedProgress.ownedHeroes}/${refreshedProgress.totalHeroes}`);
    console.log(`⏱️  Temps d'exécution: ${duration8}ms (devrait être similaire au premier appel)\n`);

    // === RÉSUMÉ FINAL ===
    console.log("=" .repeat(60));
    console.log("📊 RÉSUMÉ DES PERFORMANCES");
    console.log("=" .repeat(60));
    console.log(`Test 1 (Basic - Cold):      ${duration1}ms`);
    console.log(`Test 2 (Basic - Cached):    ${duration2}ms (${Math.round(((duration1 - duration2) / duration1) * 100)}% plus rapide)`);
    console.log(`Test 3 (Detailed):          ${duration3}ms`);
    console.log(`Test 4 (By Element):        ${duration4}ms`);
    console.log(`Test 5 (By Role):           ${duration5}ms`);
    console.log(`Test 6 (Missing Heroes):    ${duration6}ms`);
    console.log(`Test 7 (Acquisition Stats): ${duration7}ms`);
    console.log(`Test 8 (Refresh):           ${duration8}ms`);
    console.log("\n✅ Tous les tests terminés avec succès !");
    console.log("=" .repeat(60));

  } catch (error: any) {
    console.error("\n❌ Erreur lors du test:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Déconnecté de MongoDB");
  }
}

// Exécuter le script
testCollectionService();

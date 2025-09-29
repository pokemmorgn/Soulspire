// server/src/scripts/migrateToFormations.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import Formation from "../models/Formation";
import { IdGenerator } from "../utils/idGenerator";

// Charger les variables d'environnement
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

interface MigrationStats {
  totalPlayers: number;
  playersWithEquippedHeroes: number;
  formationsCreated: number;
  playersSkipped: number;
  errors: number;
}

/**
 * Migrer les joueurs avec héros équipés vers le système de formations
 */
async function migratePlayersToFormations(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalPlayers: 0,
    playersWithEquippedHeroes: 0,
    formationsCreated: 0,
    playersSkipped: 0,
    errors: 0
  };

  console.log("🔄 Début de la migration vers le système de formations...\n");

  try {
    // Récupérer tous les joueurs
    const players = await Player.find({}).populate("heroes.heroId");
    stats.totalPlayers = players.length;

    console.log(`📊 ${stats.totalPlayers} joueur(s) trouvé(s)\n`);

    for (const player of players) {
      try {
        // Vérifier si le joueur a déjà une formation active
        const existingFormation = await Formation.findOne({
          playerId: player._id,
          serverId: player.serverId,
          isActive: true
        });

        if (existingFormation) {
          console.log(`✅ ${player.displayName} (${player._id}) a déjà une formation active`);
          stats.playersSkipped++;
          continue;
        }

        // Récupérer les héros équipés
        const equippedHeroes = player.heroes.filter((h: any) => h.equipped);

        if (equippedHeroes.length === 0) {
          console.log(`⏭️  ${player.displayName} (${player._id}) n'a pas de héros équipés`);
          stats.playersSkipped++;
          continue;
        }

        stats.playersWithEquippedHeroes++;

        // Créer les slots de formation (max 5 héros)
        const slots = equippedHeroes.slice(0, 5).map((hero: any, index: number) => ({
          slot: index + 1,
          heroId: hero._id.toString()
        }));

        // Créer la formation "Default"
        const defaultFormation = new Formation({
          _id: IdGenerator.generateFormationId(),
          playerId: player._id,
          serverId: player.serverId,
          name: "Default Formation",
          slots: slots,
          isActive: true,
          lastUsed: new Date()
        });

        await defaultFormation.save();

        console.log(
          `✅ ${player.displayName} (${player._id}) - Formation créée avec ${slots.length} héros ` +
          `(positions: ${slots.map(s => s.slot).join(", ")})`
        );

        stats.formationsCreated++;

      } catch (error: any) {
        console.error(`❌ Erreur pour ${player.displayName} (${player._id}):`, error.message);
        stats.errors++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 RÉSUMÉ DE LA MIGRATION");
    console.log("=".repeat(60));
    console.log(`Joueurs totaux:              ${stats.totalPlayers}`);
    console.log(`Joueurs avec héros équipés:  ${stats.playersWithEquippedHeroes}`);
    console.log(`Formations créées:           ${stats.formationsCreated}`);
    console.log(`Joueurs ignorés:             ${stats.playersSkipped}`);
    console.log(`Erreurs:                     ${stats.errors}`);
    console.log("=".repeat(60) + "\n");

    if (stats.formationsCreated > 0) {
      console.log("🎉 Migration terminée avec succès !");
    } else if (stats.playersSkipped === stats.totalPlayers) {
      console.log("ℹ️  Aucune migration nécessaire - Tous les joueurs ont déjà des formations ou pas de héros équipés");
    } else {
      console.log("⚠️  Migration terminée avec quelques erreurs");
    }

    return stats;

  } catch (error: any) {
    console.error("💥 Erreur fatale lors de la migration:", error);
    throw error;
  }
}

/**
 * Vérifier le statut de la migration
 */
async function checkMigrationStatus(): Promise<void> {
  console.log("🔍 Vérification du statut de migration...\n");

  try {
    const totalPlayers = await Player.countDocuments({});
    const playersWithEquipped = await Player.countDocuments({
      "heroes": { $elemMatch: { equipped: true } }
    });

    const totalFormations = await Formation.countDocuments({});
    const activeFormations = await Formation.countDocuments({ isActive: true });

    console.log("📊 STATUT ACTUEL:");
    console.log(`   Joueurs totaux:                  ${totalPlayers}`);
    console.log(`   Joueurs avec héros équipés:      ${playersWithEquipped}`);
    console.log(`   Formations totales:              ${totalFormations}`);
    console.log(`   Formations actives:              ${activeFormations}`);

    const needsMigration = playersWithEquipped > activeFormations;
    console.log(`   Migration nécessaire:            ${needsMigration ? "❌ OUI" : "✅ NON"}\n`);

    if (!needsMigration) {
      console.log("✅ Tous les joueurs avec héros équipés ont une formation active !");
    } else {
      console.log(`⚠️  ${playersWithEquipped - activeFormations} joueur(s) nécessitent une migration`);
    }

  } catch (error: any) {
    console.error("❌ Erreur lors de la vérification:", error.message);
  }
}

/**
 * Nettoyer les formations de test
 */
async function cleanupTestFormations(): Promise<void> {
  console.log("🧹 Nettoyage des formations de test...\n");

  try {
    // Supprimer les formations orphelines (joueurs n'existent plus)
    const formations = await Formation.find({});
    let deleted = 0;

    for (const formation of formations) {
      const playerExists = await Player.exists({ _id: formation.playerId });
      if (!playerExists) {
        await Formation.deleteOne({ _id: formation._id });
        console.log(`🗑️  Formation orpheline supprimée: ${formation.name} (${formation._id})`);
        deleted++;
      }
    }

    console.log(`\n✅ ${deleted} formation(s) orpheline(s) supprimée(s)\n`);

  } catch (error: any) {
    console.error("❌ Erreur lors du nettoyage:", error.message);
  }
}

/**
 * Point d'entrée principal
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Afficher l'aide
  if (args.includes("--help")) {
    console.log(`
🔧 MIGRATION SYSTÈME DE FORMATIONS - Utilisation:

  npx ts-node src/scripts/migrateToFormations.ts           # Migration complète
  npx ts-node src/scripts/migrateToFormations.ts --check   # Vérifier le statut
  npx ts-node src/scripts/migrateToFormations.ts --cleanup # Nettoyer formations orphelines
  npx ts-node src/scripts/migrateToFormations.ts --help    # Afficher cette aide

📋 Description:
  Ce script migre les joueurs utilisant l'ancien système "equipped"
  vers le nouveau système de formations.

🎯 Processus:
  1. Trouve tous les joueurs avec des héros équipés
  2. Crée une formation "Default Formation" pour chacun
  3. Place les héros équipés dans la formation (max 5)
  4. Active automatiquement la formation

⚠️  Notes:
  - Les joueurs sans héros équipés sont ignorés
  - Les joueurs ayant déjà une formation sont ignorés
  - Les héros gardent leur statut "equipped" pour compatibilité
    `);
    return;
  }

  // Connexion à MongoDB
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connexion MongoDB établie\n");

    // Exécuter l'action demandée
    if (args.includes("--check")) {
      await checkMigrationStatus();
    } else if (args.includes("--cleanup")) {
      await cleanupTestFormations();
    } else {
      // Migration par défaut
      await migratePlayersToFormations();
    }

  } catch (error: any) {
    console.error("💥 Erreur fatale:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Connexion MongoDB fermée\n");
  }
}

// Exécution du script
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Erreur non gérée:", error);
    process.exit(1);
  });
}

export { migratePlayersToFormations, checkMigrationStatus };

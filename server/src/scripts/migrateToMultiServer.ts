import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import Battle from "../models/Battle";
import { GameServer } from "../models/Server";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Migration des modèles existants vers multi-serveurs
const migrateToMultiServer = async (): Promise<void> => {
  try {
    console.log("🔄 === MIGRATION VERS MULTI-SERVEURS ===\n");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connecté à MongoDB");

    // 1. Créer le serveur par défaut S1 s'il n'existe pas
    await createDefaultServer();

    // 2. Migrer tous les joueurs existants vers S1
    await migrateExistingPlayers();

    // 3. Migrer tous les combats existants vers S1
    await migrateExistingBattles();

    // 4. Créer quelques serveurs d'exemple
    await createExampleServers();

    console.log("\n🎉 === MIGRATION TERMINÉE ===");
    console.log("Votre application est maintenant multi-serveurs !");
    
  } catch (error) {
    console.error("❌ Erreur lors de la migration:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Déconnecté de MongoDB");
  }
};

// Créer le serveur par défaut S1
async function createDefaultServer(): Promise<void> {
  try {
    console.log("🏗️ Création du serveur par défaut...");
    
    const existingServer = await GameServer.findOne({ serverId: "S1" });
    if (existingServer) {
      console.log("✅ Serveur S1 existe déjà");
      return;
    }

    const defaultServer = new GameServer({
      serverId: "S1",
      name: "Server Alpha",
      region: "GLOBAL",
      status: "online",
      maxPlayers: 10000,
      currentPlayers: 0,
      isNewPlayerAllowed: true,
      crossServerConfig: {
        allowedServers: ["S2", "S3"],
        globalEvents: true,
        crossServerArena: false,
        crossServerGuilds: false
      },
      version: "1.0.0",
      serverEconomy: {
        totalGoldCirculation: 0,
        totalGemsSpent: 0,
        averagePlayerLevel: 1,
        topGuildName: ""
      }
    });

    await defaultServer.save();
    console.log("✨ Serveur S1 créé avec succès");
    
  } catch (error) {
    console.error("❌ Erreur création serveur par défaut:", error);
    throw error;
  }
}

// Migrer tous les joueurs existants vers S1
async function migrateExistingPlayers(): Promise<void> {
  try {
    console.log("👥 Migration des joueurs existants...");
    
    // Vérifier combien de joueurs n'ont pas de serverId
    const playersWithoutServer = await Player.countDocuments({ 
      serverId: { $exists: false } 
    });
    
    if (playersWithoutServer === 0) {
      console.log("✅ Tous les joueurs ont déjà un serverId");
      return;
    }

    console.log(`📊 ${playersWithoutServer} joueurs à migrer vers S1`);
    
    // Ajouter serverId: "S1" à tous les joueurs qui n'en ont pas
    const result = await Player.updateMany(
      { serverId: { $exists: false } },
      { $set: { serverId: "S1" } }
    );

    console.log(`✅ ${result.modifiedCount} joueurs migrés vers S1`);
    
    // Mettre à jour le compteur de joueurs du serveur S1
    const totalPlayers = await Player.countDocuments({ serverId: "S1" });
    await GameServer.updateOne(
      { serverId: "S1" },
      { $set: { currentPlayers: totalPlayers } }
    );
    
    console.log(`📊 Population S1 mise à jour: ${totalPlayers} joueurs`);
    
  } catch (error) {
    console.error("❌ Erreur migration joueurs:", error);
    throw error;
  }
}

// Migrer tous les combats existants vers S1
async function migrateExistingBattles(): Promise<void> {
  try {
    console.log("⚔️ Migration des combats existants...");
    
    const battlesWithoutServer = await Battle.countDocuments({ 
      serverId: { $exists: false } 
    });
    
    if (battlesWithoutServer === 0) {
      console.log("✅ Tous les combats ont déjà un serverId");
      return;
    }

    console.log(`📊 ${battlesWithoutServer} combats à migrer vers S1`);
    
    const result = await Battle.updateMany(
      { serverId: { $exists: false } },
      { $set: { serverId: "S1" } }
    );

    console.log(`✅ ${result.modifiedCount} combats migrés vers S1`);
    
  } catch (error) {
    console.error("❌ Erreur migration combats:", error);
    throw error;
  }
}

// Créer quelques serveurs d'exemple
async function createExampleServers(): Promise<void> {
  try {
    console.log("🌍 Création de serveurs d'exemple...");
    
    const exampleServers = [
      {
        serverId: "S2",
        name: "Server Beta",
        region: "EU",
        crossServerConfig: {
          allowedServers: ["S1", "S3"],
          globalEvents: true,
          crossServerArena: true,
          crossServerGuilds: false
        }
      },
      {
        serverId: "S3",
        name: "Server Gamma",
        region: "NA",
        crossServerConfig: {
          allowedServers: ["S1", "S2"],
          globalEvents: true,
          crossServerArena: false,
          crossServerGuilds: true
        }
      },
      {
        serverId: "S4",
        name: "Server Delta",
        region: "ASIA",
        crossServerConfig: {
          allowedServers: [],
          globalEvents: true,
          crossServerArena: false,
          crossServerGuilds: false
        }
      }
    ];

    let created = 0;
    
    for (const serverData of exampleServers) {
      const existingServer = await GameServer.findOne({ serverId: serverData.serverId });
      if (!existingServer) {
        const newServer = new GameServer({
          ...serverData,
          status: "online",
          maxPlayers: 10000,
          currentPlayers: 0,
          isNewPlayerAllowed: true,
          version: "1.0.0",
          serverEconomy: {
            totalGoldCirculation: 0,
            totalGemsSpent: 0,
            averagePlayerLevel: 1,
            topGuildName: ""
          }
        });
        
        await newServer.save();
        created++;
        console.log(`✨ Serveur ${serverData.serverId} créé (${serverData.region})`);
      }
    }
    
    console.log(`✅ ${created} nouveaux serveurs créés`);
    
  } catch (error) {
    console.error("❌ Erreur création serveurs d'exemple:", error);
    throw error;
  }
}

// Fonction pour afficher l'état final
async function displayFinalState(): Promise<void> {
  try {
    console.log("\n📊 === ÉTAT FINAL ===");
    
    // Compter les serveurs
    const serverCount = await GameServer.countDocuments();
    console.log(`🏗️ Serveurs total: ${serverCount}`);
    
    // Lister les serveurs
    const servers = await GameServer.find().select("serverId name region status currentPlayers");
    servers.forEach(server => {
      console.log(`   ${server.serverId}: ${server.name} (${server.region}) - ${server.currentPlayers} joueurs`);
    });
    
    // Compter les joueurs par serveur
    const playersByServer = await Player.aggregate([
      { $group: { _id: "$serverId", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log(`\n👥 Répartition des joueurs:`);
    playersByServer.forEach((stat: any) => {
      console.log(`   ${stat._id}: ${stat.count} joueurs`);
    });
    
    // Compter les combats par serveur
    const battlesByServer = await Battle.aggregate([
      { $group: { _id: "$serverId", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log(`\n⚔️ Répartition des combats:`);
    battlesByServer.forEach((stat: any) => {
      console.log(`   ${stat._id}: ${stat.count} combats`);
    });
    
  } catch (error) {
    console.error("❌ Erreur affichage état final:", error);
  }
}

// Fonction principale avec affichage final
const runMigrationWithSummary = async (): Promise<void> => {
  await migrateToMultiServer();
  await displayFinalState();
};

// Exécuter la migration si ce fichier est appelé directement
if (require.main === module) {
  runMigrationWithSummary().then(() => process.exit(0));
}

export { migrateToMultiServer };

// server/src/scripts/nuclearResetIndexes.ts
// Reset COMPLET et agressif de tous les index problématiques

import mongoose from "mongoose";
import dotenv from "dotenv";

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
};
const log = (c: string, m: string) => console.log(`${c}${m}${colors.reset}`);

async function nuclearResetIndexes() {
  try {
    log(colors.cyan, "💥 === RESET NUCLEAR DES INDEX ===\n");
    
    await mongoose.connect(MONGO_URI);
    log(colors.green, "✅ Connecté à MongoDB");

    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error("Database connection not established");
    }

    // =============================================
    // LISTER TOUS LES INDEX EXISTANTS
    // =============================================
    
    log(colors.blue, "\n📋 Index actuels sur players:");
    const playersIndexes = await db.collection('players').indexes();
    playersIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    log(colors.blue, "\n📋 Index actuels sur accounts:");
    const accountsIndexes = await db.collection('accounts').indexes();
    accountsIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // =============================================
    // SUPPRIMER TOUS LES INDEX PLAYERS (sauf _id)
    // =============================================
    
    log(colors.red, "\n💥 Suppression COMPLÈTE des index players...");
    
    for (const index of playersIndexes) {
      if (index.name && index.name !== '_id_') { // Vérification TypeScript stricte
        try {
          await db.collection('players').dropIndex(index.name);
          log(colors.green, `✅ Index ${index.name} supprimé de players`);
        } catch (error: any) {
          log(colors.yellow, `⚠️ Impossible de supprimer ${index.name}: ${error.message}`);
        }
      }
    }

    // =============================================
    // SUPPRIMER TOUS LES INDEX ACCOUNTS (sauf _id)
    // =============================================
    
    log(colors.red, "\n💥 Suppression COMPLÈTE des index accounts...");
    
    for (const index of accountsIndexes) {
      if (index.name && index.name !== '_id_') { // Vérification TypeScript stricte
        try {
          await db.collection('accounts').dropIndex(index.name);
          log(colors.green, `✅ Index ${index.name} supprimé de accounts`);
        } catch (error: any) {
          log(colors.yellow, `⚠️ Impossible de supprimer ${index.name}: ${error.message}`);
        }
      }
    }

    // =============================================
    // RECRÉER SEULEMENT LES INDEX ESSENTIELS
    // =============================================
    
    log(colors.blue, "\n🔄 Recréation des index essentiels...");
    
    // Index PLAYERS essentiels - Un par un pour éviter les erreurs TypeScript
    try {
      await db.collection('players').createIndex({ playerId: 1 }, { unique: true, name: "playerId_1" });
      log(colors.green, "✅ Index playerId_1 créé sur players");
    } catch (error: any) {
      log(colors.yellow, `⚠️ Index playerId_1 déjà existant: ${error.message}`);
    }
    
    try {
      await db.collection('players').createIndex({ accountId: 1, serverId: 1 }, { name: "accountId_1_serverId_1" });
      log(colors.green, "✅ Index accountId_1_serverId_1 créé sur players");
    } catch (error: any) {
      log(colors.yellow, `⚠️ Index accountId_1_serverId_1 déjà existant: ${error.message}`);
    }
    
    try {
      await db.collection('players').createIndex({ serverId: 1 }, { name: "serverId_1" });
      log(colors.green, "✅ Index serverId_1 créé sur players");
    } catch (error: any) {
      log(colors.yellow, `⚠️ Index serverId_1 déjà existant: ${error.message}`);
    }
    
    // Index ACCOUNTS essentiels - Un par un
    try {
      await db.collection('accounts').createIndex({ accountId: 1 }, { unique: true, name: "accountId_1" });
      log(colors.green, "✅ Index accountId_1 créé sur accounts");
    } catch (error: any) {
      log(colors.yellow, `⚠️ Index accountId_1 déjà existant: ${error.message}`);
    }
    
    try {
      await db.collection('accounts').createIndex({ username: 1 }, { unique: true, name: "username_1" });
      log(colors.green, "✅ Index username_1 créé sur accounts");
    } catch (error: any) {
      log(colors.yellow, `⚠️ Index username_1 déjà existant: ${error.message}`);
    }

    // =============================================
    // VÉRIFICATION FINALE
    // =============================================
    
    log(colors.blue, "\n📋 Index finaux sur players:");
    const finalPlayersIndexes = await db.collection('players').indexes();
    finalPlayersIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    log(colors.blue, "\n📋 Index finaux sur accounts:");
    const finalAccountsIndexes = await db.collection('accounts').indexes();
    finalAccountsIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    log(colors.cyan, "\n🎉 === RESET NUCLEAR TERMINÉ ===");
    log(colors.green, "✅ TOUS les index problématiques ont été supprimés");
    log(colors.green, "✅ Seuls les index essentiels ont été recréés");
    log(colors.blue, "➡️ Vous pouvez maintenant relancer vos tests AFK");

  } catch (error: any) {
    log(colors.red, `❌ Erreur reset nuclear: ${error.message}`);
    console.error("Stack:", error.stack);
  } finally {
    await mongoose.disconnect();
    log(colors.green, "\n🔌 Déconnecté de MongoDB");
  }
}

// Aide
function showUsage() {
  log(colors.cyan, "\n💥 === SCRIPT RESET NUCLEAR INDEX ===");
  console.log("Ce script fait un reset COMPLET de tous les index :");
  console.log("• 💥 Supprime TOUS les index (sauf _id) de players et accounts");
  console.log("• 🔄 Recrée SEULEMENT les index essentiels");
  console.log("• 📋 Liste les index avant et après");
  console.log("• ⚠️ ATTENTION: Opération destructive mais nécessaire");
  console.log("\nLancement:");
  console.log("npx ts-node server/src/scripts/nuclearResetIndexes.ts");
  console.log("");
}

if (require.main === module) {
  showUsage();
  nuclearResetIndexes().then(() => process.exit(0));
}

export default nuclearResetIndexe

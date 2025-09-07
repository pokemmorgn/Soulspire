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
      if (index.name !== '_id_') { // Garder seulement l'index _id
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
      if (index.name !== '_id_') { // Garder seulement l'index _id
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
    
    // Index PLAYERS essentiels uniquement
    const playerIndexes = [
      { fields: { playerId: 1 }, options: { unique: true, name: "playerId_1" } },
      { fields: { accountId: 1, serverId: 1 }, options: { name: "accountId_1_serverId_1" } },
      { fields: { serverId: 1 }, options: { name: "serverId_1" } }
    ];
    
    for (const idx of playerIndexes) {
      try {
        await db.collection('players').createIndex(idx.fields, idx.options);
        log(colors.green, `✅ Index ${idx.options.name} créé sur players`);
      } catch (error: any) {
        log(colors.yellow, `⚠️ Index ${idx.options.name} déjà existant: ${error.message}`);
      }
    }
    
    // Index ACCOUNTS essentiels uniquement
    const accountIndexes = [
      { fields: { accountId: 1 } as const, options: { unique: true, name: "accountId_1" } },
      { fields: { username: 1 } as const, options: { unique: true, name: "username_1" } }
    ];
    
    for (const idx of accountIndexes) {
      try {
        await db.collection('accounts').createIndex(idx.fields, idx.options);
        log(colors.green, `✅ Index ${idx.options.name} créé sur accounts`);
      } catch (error: any) {
        log(colors.yellow, `⚠️ Index ${idx.options.name} déjà existant: ${error.message}`);
      }
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

export default nuclearResetIndexes;

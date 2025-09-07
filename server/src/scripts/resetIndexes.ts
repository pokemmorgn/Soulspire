// server/src/scripts/resetIndexes.ts
// Script pour supprimer les anciens index problématiques

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

async function resetIndexes() {
  try {
    log(colors.cyan, "🔧 === RESET INDEX MONGODB ===\n");
    
    await mongoose.connect(MONGO_URI);
    log(colors.green, "✅ Connecté à MongoDB");

    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error("Database connection not established");
    }
    
    // =============================================
    // SUPPRIMER LES INDEX PROBLÉMATIQUES
    // =============================================
    
    log(colors.yellow, "\n🗑️ Suppression des index problématiques...");
    
    try {
      // Supprimer l'index username_1 sur players
      await db.collection('players').dropIndex('username_1');
      log(colors.green, "✅ Index username_1 supprimé de players");
    } catch (error: any) {
      log(colors.yellow, `⚠️ Index username_1 déjà absent de players: ${error.message}`);
    }
    
    try {
      // Supprimer l'index purchaseHistory.transactionId_1 sur accounts
      await db.collection('accounts').dropIndex('purchaseHistory.transactionId_1');
      log(colors.green, "✅ Index purchaseHistory.transactionId_1 supprimé de accounts");
    } catch (error: any) {
      log(colors.yellow, `⚠️ Index purchaseHistory.transactionId_1 déjà absent de accounts: ${error.message}`);
    }
    
    // =============================================
    // LISTER LES INDEX RESTANTS
    // =============================================
    
    log(colors.blue, "\n📋 Index restants sur players:");
    const playersIndexes = await db.collection('players').indexes();
    playersIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    log(colors.blue, "\n📋 Index restants sur accounts:");
    const accountsIndexes = await db.collection('accounts').indexes();
    accountsIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // =============================================
    // RECRÉER LES INDEX CORRECTS
    // =============================================
    
    log(colors.yellow, "\n🔄 Recréation des index corrects...");
    
    // Index pour players (nouveau système)
    try {
      await db.collection('players').createIndex({ playerId: 1 }, { unique: true });
      log(colors.green, "✅ Index playerId unique créé sur players");
    } catch (error: any) {
      log(colors.yellow, `⚠️ Index playerId déjà existant: ${error.message}`);
    }
    
    try {
      await db.collection('players').createIndex({ accountId: 1, serverId: 1 });
      log(colors.green, "✅ Index accountId+serverId créé sur players");
    } catch (error: any) {
      log(colors.yellow, `⚠️ Index accountId+serverId déjà existant: ${error.message}`);
    }
    
    // Index pour accounts (corrigé)
    try {
      await db.collection('accounts').createIndex({ accountId: 1 }, { unique: true });
      log(colors.green, "✅ Index accountId unique créé sur accounts");
    } catch (error: any) {
      log(colors.yellow, `⚠️ Index accountId déjà existant: ${error.message}`);
    }
    
    try {
      // Index partiel pour purchaseHistory.transactionId (évite les null)
      await db.collection('accounts').createIndex(
        { "purchaseHistory.transactionId": 1 }, 
        { 
          unique: true, 
          partialFilterExpression: { 
            "purchaseHistory.transactionId": { $ne: null, $exists: true } 
          }
        }
      );
      log(colors.green, "✅ Index partiel purchaseHistory.transactionId créé sur accounts");
    } catch (error: any) {
      log(colors.yellow, `⚠️ Index purchaseHistory.transactionId déjà existant: ${error.message}`);
    }
    
    log(colors.cyan, "\n🎉 === RESET INDEX TERMINÉ ===");
    log(colors.green, "✅ Les index problématiques ont été supprimés");
    log(colors.green, "✅ Les nouveaux index corrects ont été créés");
    log(colors.blue, "➡️ Vous pouvez maintenant relancer vos tests AFK");

  } catch (error: any) {
    log(colors.red, `❌ Erreur reset index: ${error.message}`);
    console.error("Stack:", error.stack);
  } finally {
    await mongoose.disconnect();
    log(colors.green, "\n🔌 Déconnecté de MongoDB");
  }
}

// Aide
function showUsage() {
  log(colors.cyan, "\n🔧 === SCRIPT RESET INDEX MONGODB ===");
  console.log("Ce script supprime les anciens index problématiques :");
  console.log("• 🗑️ Supprime username_1 de players (virtual supprimé)");
  console.log("• 🗑️ Supprime purchaseHistory.transactionId_1 de accounts");
  console.log("• 🔄 Recrée les index corrects pour Account/Player");
  console.log("• 📋 Liste les index restants");
  console.log("\nLancement:");
  console.log("npx ts-node server/src/scripts/resetIndexes.ts");
  console.log("");
}

if (require.main === module) {
  showUsage();
  resetIndexes().then(() => process.exit(0));
}

export default resetIndexes;

import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import Account from "../models/Account";
import Player from "../models/Player";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

/**
 * Script pour créer un joueur de test avec des ressources
 * Permet de tester le système gacha immédiatement
 */

interface TestPlayerConfig {
  username: string;
  email: string;
  password: string;
  serverId: string;
  gems: number;
  tickets: number;
  gold: number;
  level: number;
}

const DEFAULT_TEST_PLAYER: TestPlayerConfig = {
  username: "gacha_tester",
  email: "gacha@test.com",
  password: "test123456",
  serverId: "S1",
  gems: 10000,      // 10k gems = ~33 pulls
  tickets: 50,      // 50 tickets = 50 pulls gratuits
  gold: 100000,     // 100k gold pour upgrades
  level: 10         // Level 10 pour débloquer features
};

const createTestPlayer = async (config: TestPlayerConfig = DEFAULT_TEST_PLAYER): Promise<void> => {
  try {
    console.log("🎮 Creating test player for Gacha testing...\n");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Vérifier si le joueur existe déjà
    const existingAccount = await Account.findOne({ email: config.email });
    
    if (existingAccount) {
      console.log("⚠️  Test account already exists!");
      console.log("   Would you like to:");
      console.log("   1. Delete and recreate");
      console.log("   2. Just add resources to existing player");
      console.log("");
      console.log("   Proceeding with option 2 (adding resources)...\n");

      // Trouver le player associé
      const player = await Player.findOne({ 
        accountId: existingAccount._id.toString(), 
        serverId: config.serverId 
      });

      if (player) {
        // Ajouter des ressources
        player.gems += config.gems;
        player.tickets += config.tickets;
        player.gold += config.gold;
        await player.save();

        console.log("✅ Resources added to existing player!");
        console.log("");
        printPlayerInfo(existingAccount, player, config);
        return;
      } else {
        console.log("❌ No player found for this account on server " + config.serverId);
        console.log("   Creating new player...\n");
      }
    }

    // === CRÉER LE COMPTE ===
    console.log("📝 Creating account...");
    
    const hashedPassword = await bcrypt.hash(config.password, 10);
    
    const account = new Account({
      username: config.username,
      email: config.email,
      password: hashedPassword,
      role: "player",
      isVerified: true,  // Auto-vérifié pour test
      vipLevel: 0
    });

    await account.save();
    console.log(`✅ Account created: ${account.username} (${account._id})\n`);

    // === CRÉER LE PLAYER ===
    console.log("🎮 Creating player...");

    const player = new Player({
      accountId: account._id.toString(),
      username: config.username,
      displayName: config.username,
      serverId: config.serverId,
      level: config.level,
      experience: 0,
      
      // Ressources généreuses pour tests
      gold: config.gold,
      gems: config.gems,
      tickets: config.tickets,
      
      // Collections vides
      heroes: [],
      formations: [],
      fragments: new Map(),
      materials: new Map(),
      
      // Progression
      campaignProgress: {
        currentWorld: 1,
        currentLevel: 1,
        highestWorldCompleted: 0,
        starsEarned: 0
      },
      
      // Stats
      stats: {
        totalBattles: 0,
        battlesWon: 0,
        battlesLost: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        heroesUnlocked: 0,
        achievementsUnlocked: 0
      },
      
      // Settings
      settings: {
        language: "en",
        soundEnabled: true,
        musicEnabled: true,
        notificationsEnabled: true
      }
    });

    await player.save();
    console.log(`✅ Player created on server ${player.serverId}\n`);

    // === RÉSUMÉ ===
    console.log("═══════════════════════════════════════════════════════");
    console.log("🎉 TEST PLAYER CREATED SUCCESSFULLY!");
    console.log("═══════════════════════════════════════════════════════\n");
    
    printPlayerInfo(account, player, config);

    // === INSTRUCTIONS ===
    console.log("\n📋 NEXT STEPS:\n");
    console.log("1. Login to get JWT token:");
    console.log(`   POST http://localhost:3000/api/auth/login`);
    console.log(`   Body: {`);
    console.log(`     "email": "${config.email}",`);
    console.log(`     "password": "${config.password}"`);
    console.log(`   }\n`);

    console.log("2. Copy the JWT token from response\n");

    console.log("3. Test a pull:");
    console.log(`   POST http://localhost:3000/api/gacha/pull`);
    console.log(`   Headers:`);
    console.log(`     Authorization: Bearer YOUR_JWT_TOKEN`);
    console.log(`     Content-Type: application/json`);
    console.log(`   Body: {`);
    console.log(`     "bannerId": "beginner_blessing_001",`);
    console.log(`     "count": 1`);
    console.log(`   }\n`);

    console.log("4. Check the results and your new hero!\n");

    // === COMMANDES CURL ===
    console.log("💡 QUICK TEST WITH CURL:\n");
    console.log("# 1. Login");
    console.log(`curl -X POST http://localhost:3000/api/auth/login \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"email":"${config.email}","password":"${config.password}"}'`);
    console.log("");
    console.log("# 2. Pull (replace YOUR_TOKEN)");
    console.log(`curl -X POST http://localhost:3000/api/gacha/pull \\`);
    console.log(`  -H "Authorization: Bearer YOUR_TOKEN" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"bannerId":"beginner_blessing_001","count":1}'`);
    console.log("");

  } catch (error: any) {
    console.error("❌ Error creating test player:", error);
    if (error.code === 11000) {
      console.error("   Duplicate key error. Player might already exist.");
      console.error("   Try deleting the existing player first.");
    }
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Fonction utilitaire pour afficher les infos
function printPlayerInfo(account: any, player: any, config: TestPlayerConfig) {
  console.log("🎮 PLAYER INFORMATION:\n");
  console.log(`   Username: ${account.username}`);
  console.log(`   Email: ${config.email}`);
  console.log(`   Password: ${config.password}`);
  console.log(`   Account ID: ${account._id}`);
  console.log(`   Player ID: ${player._id}`);
  console.log(`   Server: ${player.serverId}`);
  console.log(`   Level: ${player.level}`);
  console.log("");
  console.log("💎 RESOURCES:\n");
  console.log(`   Gems: ${player.gems} 💎`);
  console.log(`   Tickets: ${player.tickets} 🎫`);
  console.log(`   Gold: ${player.gold} 🪙`);
  console.log("");
  console.log("🎰 GACHA POTENTIAL:\n");
  const singlePulls = Math.floor(player.gems / 300);
  const multiPulls = Math.floor(player.gems / 2700);
  console.log(`   Single pulls (300 gems): ${singlePulls} pulls`);
  console.log(`   Multi pulls (2700 gems): ${multiPulls} x10 pulls`);
  console.log(`   Ticket pulls: ${player.tickets} pulls`);
  console.log(`   Total potential pulls: ${singlePulls + player.tickets}`);
}

// Fonction pour supprimer un joueur test existant
const deleteTestPlayer = async (email: string): Promise<void> => {
  try {
    console.log(`🗑️  Deleting test player: ${email}\n`);
    
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const account = await Account.findOne({ email });
    if (!account) {
      console.log("❌ Account not found");
      return;
    }

    // Supprimer le player
    const deletedPlayers = await Player.deleteMany({ accountId: account._id.toString() });
    console.log(`✅ Deleted ${deletedPlayers.deletedCount} player(s)`);

    // Supprimer le compte
    await Account.deleteOne({ _id: account._id });
    console.log("✅ Account deleted");

  } catch (error) {
    console.error("❌ Error deleting test player:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Fonction pour ajouter des ressources à un joueur existant
const addResourcesToPlayer = async (
  email: string, 
  gems: number = 5000, 
  tickets: number = 25
): Promise<void> => {
  try {
    console.log(`💎 Adding resources to player: ${email}\n`);
    
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const account = await Account.findOne({ email });
    if (!account) {
      console.log("❌ Account not found");
      return;
    }

    const player = await Player.findOne({ accountId: account._id.toString() });
    if (!player) {
      console.log("❌ Player not found");
      return;
    }

    const oldGems = player.gems;
    const oldTickets = player.tickets;

    player.gems += gems;
    player.tickets += tickets;
    await player.save();

    console.log("✅ Resources added!\n");
    console.log("   Before:");
    console.log(`     Gems: ${oldGems}`);
    console.log(`     Tickets: ${oldTickets}`);
    console.log("");
    console.log("   After:");
    console.log(`     Gems: ${player.gems} (+${gems})`);
    console.log(`     Tickets: ${player.tickets} (+${tickets})`);

  } catch (error) {
    console.error("❌ Error adding resources:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Commandes disponibles
const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];
const arg3 = process.argv[5];

if (require.main === module) {
  switch (command) {
    case "create":
      createTestPlayer().then(() => process.exit(0));
      break;
      
    case "delete":
      if (!arg1) {
        console.log("Usage: npm run test:player delete <email>");
        process.exit(1);
      }
      deleteTestPlayer(arg1).then(() => process.exit(0));
      break;
      
    case "add-resources":
      if (!arg1) {
        console.log("Usage: npm run test:player add-resources <email> [gems] [tickets]");
        process.exit(1);
      }
      const gems = arg2 ? parseInt(arg2) : 5000;
      const tickets = arg3 ? parseInt(arg3) : 25;
      addResourcesToPlayer(arg1, gems, tickets).then(() => process.exit(0));
      break;
      
    default:
      console.log("Available commands:");
      console.log("  npm run test:player create");
      console.log("  npm run test:player delete <email>");
      console.log("  npm run test:player add-resources <email> [gems] [tickets]");
      process.exit(1);
  }
}

export { createTestPlayer, deleteTestPlayer, addResourcesToPlayer };

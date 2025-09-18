import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import { IdGenerator } from "../utils/idGenerator";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Configuration du joueur test
const TEST_PLAYER_CONFIG = {
  serverId: "S1",
  displayName: "testt", // Nom à rechercher
  updates: {
    level: 50,
    experience: 9999999999, // XP pour level 4
    gold: 50000,
    gems: 2000,
    paidGems: 500,
    tickets: 20,
    world: 2,
    stage: 5,
    // Ajout d'items dans l'inventaire
    items: new Map([
      ["potion_health_small", 10],
      ["potion_mana_small", 5],
      ["sword_iron", 1],
      ["armor_leather", 1],
      ["material_wood", 25],
      ["material_stone", 15],
      ["fragment_hero_001", 3]
    ]),
    // Ajout de matériaux
    materials: new Map([
      ["enhancement_stone_basic", 20],
      ["evolution_crystal", 5],
      ["awakening_shard", 2]
    ]),
    // Ajout de fragments de héros (génériques avec vos IDs)
    fragments: new Map([
      ["HERO_TANK_001", 10],      // Fragment de tank
      ["HERO_DPS_001", 8],        // Fragment de DPS
      ["HERO_SUPPORT_001", 12],   // Fragment de support
      ["HERO_RARE_001", 5],       // Fragment rare
      ["HERO_EPIC_001", 3]        // Fragment épique
    ])
  }
};

// === FONCTION DE MISE À JOUR ===
const updateTestPlayer = async (): Promise<void> => {
  try {
    console.log("🎮 Starting test player update...");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Rechercher le joueur test
    const testPlayer = await Player.findOne({
      serverId: TEST_PLAYER_CONFIG.serverId,
      displayName: TEST_PLAYER_CONFIG.displayName
    });
    
    if (!testPlayer) {
      console.log("❌ Test player not found!");
      console.log(`Looking for: ${TEST_PLAYER_CONFIG.displayName} on server ${TEST_PLAYER_CONFIG.serverId}`);
      
      // Afficher les joueurs disponibles
      const playersOnServer = await Player.find({ serverId: TEST_PLAYER_CONFIG.serverId })
        .select("displayName playerId level")
        .limit(10);
      
      console.log("\n📋 Available players on S1:");
      playersOnServer.forEach(player => {
        console.log(`   - ${player.displayName} (Level ${player.level}) - ID: ${player.playerId}`);
      });
      
      return;
    }
    
    console.log(`🎯 Found test player: ${testPlayer.displayName} (ID: ${testPlayer.playerId})`);
    console.log(`📊 Current stats: Level ${testPlayer.level}, Gold: ${testPlayer.gold}, Gems: ${testPlayer.gems}`);
    
    // Appliquer les mises à jour
    const updates = TEST_PLAYER_CONFIG.updates;
    
    // Mise à jour des stats de base
    testPlayer.level = updates.level;
    testPlayer.experience = updates.experience;
    testPlayer.gold = updates.gold;
    testPlayer.gems = updates.gems;
    testPlayer.paidGems = updates.paidGems;
    testPlayer.tickets = updates.tickets;
    testPlayer.world = updates.world;
    testPlayer.stage = updates.stage;
    
    // Mise à jour de la progression de campagne
    testPlayer.campaignProgress.highestWorld = Math.max(testPlayer.campaignProgress.highestWorld, updates.world);
    testPlayer.campaignProgress.highestStage = Math.max(testPlayer.campaignProgress.highestStage, updates.stage);
    
    // Mise à jour des items
    if (updates.items) {
      updates.items.forEach((quantity, itemId) => {
        testPlayer.items.set(itemId, (testPlayer.items.get(itemId) || 0) + quantity);
      });
    }
    
    // Mise à jour des matériaux
    if (updates.materials) {
      updates.materials.forEach((quantity, materialId) => {
        testPlayer.materials.set(materialId, (testPlayer.materials.get(materialId) || 0) + quantity);
      });
    }
    
    // Mise à jour des fragments
    if (updates.fragments) {
      updates.fragments.forEach((quantity, heroId) => {
        testPlayer.fragments.set(heroId, (testPlayer.fragments.get(heroId) || 0) + quantity);
      });
    }
    
    // Marquer comme non-nouveau joueur
    testPlayer.isNewPlayer = false;
    testPlayer.tutorialCompleted = true;
    
    // Mettre à jour la dernière connexion
    testPlayer.lastSeenAt = new Date();
    
    // Sauvegarder
    await testPlayer.save();
    
    console.log("✅ Test player updated successfully!");
    console.log(`\n📊 New stats:`);
    console.log(`   - Level: ${testPlayer.level} (XP: ${testPlayer.experience})`);
    console.log(`   - Gold: ${testPlayer.gold.toLocaleString()}`);
    console.log(`   - Gems: ${testPlayer.gems}`);
    console.log(`   - Paid Gems: ${testPlayer.paidGems}`);
    console.log(`   - Tickets: ${testPlayer.tickets}`);
    console.log(`   - Progress: World ${testPlayer.world}, Stage ${testPlayer.stage}`);
    
    // Afficher l'inventaire
    console.log(`\n🎒 Items added:`);
    if (testPlayer.items && testPlayer.items.size > 0) {
      testPlayer.items.forEach((quantity, itemId) => {
        console.log(`   - ${itemId}: ${quantity}`);
      });
    }
    
    console.log(`\n🔧 Materials added:`);
    if (testPlayer.materials && testPlayer.materials.size > 0) {
      testPlayer.materials.forEach((quantity, materialId) => {
        console.log(`   - ${materialId}: ${quantity}`);
      });
    }
    
    console.log(`\n🧩 Fragments added:`);
    if (testPlayer.fragments && testPlayer.fragments.size > 0) {
      testPlayer.fragments.forEach((quantity, heroId) => {
        console.log(`   - ${heroId}: ${quantity}`);
      });
    }
    
    // Ajouter quelques transactions VIP de test
    const vipResult = await testPlayer.addVipExp(1500, "admin_grant", 0);
    console.log(`\n⭐ VIP Update: Level ${vipResult.newLevel} ${vipResult.leveledUp ? "(LEVEL UP!)" : ""}`);
    
    console.log("🎉 Test player setup completed!");
    
  } catch (error: any) {
    console.error("❌ Update failed:", error.message);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(0);
  }
};

// === FONCTION POUR CRÉER UN NOUVEAU JOUEUR TEST (optionnel) ===
const createTestPlayer = async (): Promise<void> => {
  try {
    console.log("🆕 Creating new test player...");
    
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Vérifier si le joueur existe déjà
    const existingPlayer = await Player.findOne({
      serverId: TEST_PLAYER_CONFIG.serverId,
      displayName: TEST_PLAYER_CONFIG.displayName
    });
    
    if (existingPlayer) {
      console.log("⚠️ Test player already exists! Use update mode instead.");
      return;
    }
    
    // Créer nouveau joueur
    const newPlayer = new Player({
      _id: IdGenerator.generatePlayerId(),
      accountId: "ACC_testuseraccount123", // ID de compte de test
      serverId: TEST_PLAYER_CONFIG.serverId,
      displayName: TEST_PLAYER_CONFIG.displayName,
      ...TEST_PLAYER_CONFIG.updates,
      isNewPlayer: false,
      tutorialCompleted: true
    });
    
    await newPlayer.save();
    console.log(`✅ Created new test player: ${newPlayer.displayName} (${newPlayer.playerId})`);
    
  } catch (error: any) {
    console.error("❌ Creation failed:", error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

// === EXÉCUTION DU SCRIPT ===
if (require.main === module) {
  console.log("🚀 Test Player Updater");
  console.log("Arguments:", process.argv.slice(2).join(' '));
  console.log("Use --create to create a new test player instead of updating\n");
  
  const shouldCreate = process.argv.includes('--create');
  
  if (shouldCreate) {
    createTestPlayer();
  } else {
    updateTestPlayer();
  }
}

export { updateTestPlayer, createTestPlayer };

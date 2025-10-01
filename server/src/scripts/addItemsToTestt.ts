import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import Inventory from "../models/Inventory";
import Item from "../models/Item";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

/**
 * Script pour ajouter UN item de CHAQUE catégorie à l'utilisateur Testt
 */
async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // Trouver le joueur Testt
  const username = "Testt";
  const player = await Player.findOne({ username });
  
  if (!player) {
    console.error(`❌ Player not found: ${username}`);
    process.exit(1);
  }

  console.log(`✅ Player found: ${username} (ID: ${player._id})`);

  // Récupérer ou créer l'inventaire
  let inventory = await Inventory.findOne({ playerId: player._id });
  if (!inventory) {
    console.log("📦 Creating new inventory...");
    inventory = new Inventory({ 
      playerId: player._id, 
      maxCapacity: 500 
    });
  }

  console.log("\n🔍 Searching for one item per category...\n");

  // Définir les catégories à chercher
  const categories = [
    "Equipment",
    "Consumable", 
    "Material",
    "Currency",
    "Fragment",
    "Scroll",
    "Artifact",
    "Chest"
  ];

  const itemsToAdd: any[] = [];

  // Pour chaque catégorie, trouver UN item
  for (const category of categories) {
    try {
      const item = await Item.findOne({ category }).limit(1);
      
      if (item) {
        itemsToAdd.push(item);
        console.log(`✅ Found ${category}: ${item.name} (${item.itemId})`);
      } else {
        console.log(`⚠️ No item found for category: ${category}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error finding item for ${category}:`, msg);
    }
  }

  console.log(`\n📋 Total items to add: ${itemsToAdd.length}\n`);

  // Ajouter les items à l'inventaire
  let successCount = 0;
  let errorCount = 0;

  for (const item of itemsToAdd) {
    try {
      const owned = await inventory.addItem(item.itemId, 1, 1);
      console.log(`✅ Added ${item.category}: ${item.name} -> ${owned.instanceId}`);
      successCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error adding ${item.itemId}:`, msg);
      errorCount++;
    }
  }

  // Sauvegarder l'inventaire
  try {
    await inventory.save();
    console.log("\n💾 Inventory saved successfully!");
  } catch (saveErr) {
    const msg = saveErr instanceof Error ? saveErr.message : String(saveErr);
    console.error("❌ Error saving inventory:", msg);
  }

  // Afficher le résumé
  console.log("\n" + "=".repeat(50));
  console.log("📊 SUMMARY");
  console.log("=".repeat(50));
  console.log(`Player: ${username}`);
  console.log(`Items added successfully: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total categories processed: ${categories.length}`);
  console.log("=".repeat(50) + "\n");

  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB");
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("💥 Fatal error:", msg);
  process.exit(1);
});

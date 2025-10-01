import mongoose from "mongoose";
import dotenv from "dotenv";
import Item from "../models/Item";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

/**
 * Script pour ajouter les catégories d'items manquantes :
 * - Currency (monnaies spéciales)
 * - Fragment (fragments de héros)
 * - Scroll (parchemins)
 * - Artifact (artefacts)
 */

const missingItems = [
  // === CURRENCY (Monnaies spéciales) ===
  {
    itemId: "arena_coin",
    name: "ARENA_COIN_NAME",
    description: "ARENA_COIN_DESC",
    iconUrl: "icons/currencies/arena_coin.png",
    category: "Currency",
    subCategory: "Arena_Currency",
    rarity: "Common",
    tier: 1,
    maxLevel: 1,
    sellPrice: 0, // Ne peut pas être vendu
    buyPrice: 0
  },
  {
    itemId: "guild_token",
    name: "GUILD_TOKEN_NAME",
    description: "GUILD_TOKEN_DESC",
    iconUrl: "icons/currencies/guild_token.png",
    category: "Currency",
    subCategory: "Guild_Currency",
    rarity: "Rare",
    tier: 1,
    maxLevel: 1,
    sellPrice: 0,
    buyPrice: 0
  },

  // === FRAGMENT (Fragments de héros) ===
  {
    itemId: "fragment_common_hero",
    name: "FRAGMENT_COMMON_HERO_NAME",
    description: "FRAGMENT_COMMON_HERO_DESC",
    iconUrl: "icons/fragments/fragment_common.png",
    category: "Fragment",
    subCategory: "Hero_Fragment",
    rarity: "Common",
    tier: 1,
    maxLevel: 1,
    sellPrice: 20,
    buyPrice: 100
  },
  {
    itemId: "fragment_rare_hero",
    name: "FRAGMENT_RARE_HERO_NAME",
    description: "FRAGMENT_RARE_HERO_DESC",
    iconUrl: "icons/fragments/fragment_rare.png",
    category: "Fragment",
    subCategory: "Hero_Fragment",
    rarity: "Rare",
    tier: 1,
    maxLevel: 1,
    sellPrice: 100,
    buyPrice: 500
  },
  {
    itemId: "fragment_epic_hero",
    name: "FRAGMENT_EPIC_HERO_NAME",
    description: "FRAGMENT_EPIC_HERO_DESC",
    iconUrl: "icons/fragments/fragment_epic.png",
    category: "Fragment",
    subCategory: "Hero_Fragment",
    rarity: "Epic",
    tier: 1,
    maxLevel: 1,
    sellPrice: 500,
    buyPrice: 2000
  },

  // === SCROLL (Parchemins) ===
  {
    itemId: "scroll_summon_common",
    name: "SCROLL_SUMMON_COMMON_NAME",
    description: "SCROLL_SUMMON_COMMON_DESC",
    iconUrl: "icons/scrolls/scroll_summon_common.png",
    category: "Scroll",
    subCategory: "Summon_Scroll",
    rarity: "Common",
    tier: 1,
    maxLevel: 1,
    consumableType: "Scroll",
    consumableEffect: {
      type: "currency",
      value: 1 // 1 invocation
    },
    sellPrice: 50,
    buyPrice: 200
  },
  {
    itemId: "scroll_summon_elite",
    name: "SCROLL_SUMMON_ELITE_NAME",
    description: "SCROLL_SUMMON_ELITE_DESC",
    iconUrl: "icons/scrolls/scroll_summon_elite.png",
    category: "Scroll",
    subCategory: "Summon_Scroll",
    rarity: "Rare",
    tier: 1,
    maxLevel: 1,
    consumableType: "Scroll",
    consumableEffect: {
      type: "currency",
      value: 1 // 1 invocation elite
    },
    sellPrice: 200,
    buyPrice: 1000
  },
  {
    itemId: "scroll_teleport",
    name: "SCROLL_TELEPORT_NAME",
    description: "SCROLL_TELEPORT_DESC",
    iconUrl: "icons/scrolls/scroll_teleport.png",
    category: "Scroll",
    subCategory: "Utility_Scroll",
    rarity: "Rare",
    tier: 1,
    maxLevel: 1,
    consumableType: "Scroll",
    consumableEffect: {
      type: "buff",
      value: 1, // Téléportation
      duration: 0
    },
    sellPrice: 100,
    buyPrice: 500
  },

  // === ARTIFACT (Artefacts) ===
  {
    itemId: "artifact_ring_of_power",
    name: "ARTIFACT_RING_OF_POWER_NAME",
    description: "ARTIFACT_RING_OF_POWER_DESC",
    iconUrl: "icons/artifacts/ring_of_power.png",
    category: "Artifact",
    subCategory: "Ring",
    rarity: "Epic",
    tier: 1,
    maxLevel: 50,
    artifactType: "Might",
    baseStats: {
      atk: 50,
      hp: 100,
      crit: 10
    },
    statsPerLevel: {
      atk: 3,
      hp: 5,
      crit: 0.3
    },
    effects: [
      {
        id: "ring_power_effect",
        name: "Power Surge",
        description: "Increases attack by 15% when HP is above 50%",
        type: "Passive",
        trigger: "always",
        value: 15
      }
    ],
    sellPrice: 1000,
    buyPrice: 5000
  },
  {
    itemId: "artifact_amulet_of_vitality",
    name: "ARTIFACT_AMULET_OF_VITALITY_NAME",
    description: "ARTIFACT_AMULET_OF_VITALITY_DESC",
    iconUrl: "icons/artifacts/amulet_vitality.png",
    category: "Artifact",
    subCategory: "Amulet",
    rarity: "Legendary",
    tier: 1,
    maxLevel: 80,
    artifactType: "Vitality",
    baseStats: {
      hp: 300,
      def: 30,
      healthleech: 5
    },
    statsPerLevel: {
      hp: 15,
      def: 1.5,
      healthleech: 0.2
    },
    effects: [
      {
        id: "amulet_vitality_effect",
        name: "Life Force",
        description: "Regenerate 2% HP every 3 seconds",
        type: "Passive",
        trigger: "always",
        value: 2,
        duration: 3
      }
    ],
    sellPrice: 5000,
    buyPrice: 20000
  },
  {
    itemId: "artifact_cloak_of_shadows",
    name: "ARTIFACT_CLOAK_OF_SHADOWS_NAME",
    description: "ARTIFACT_CLOAK_OF_SHADOWS_DESC",
    iconUrl: "icons/artifacts/cloak_shadows.png",
    category: "Artifact",
    subCategory: "Cloak",
    rarity: "Epic",
    tier: 1,
    maxLevel: 60,
    artifactType: "Celerity",
    baseStats: {
      dodge: 15,
      vitesse: 20,
      accuracy: 10
    },
    statsPerLevel: {
      dodge: 0.5,
      vitesse: 1,
      accuracy: 0.3
    },
    effects: [
      {
        id: "cloak_shadows_effect",
        name: "Shadow Step",
        description: "30% chance to dodge the first attack in battle",
        type: "Passive",
        trigger: "combat_start",
        value: 30
      }
    ],
    sellPrice: 1500,
    buyPrice: 7000
  }
];

async function main() {
  try {
    console.log("🌱 Starting missing categories seed...");
    
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const itemData of missingItems) {
      try {
        const existingItem = await Item.findOne({ itemId: itemData.itemId });
        
        if (existingItem) {
          console.log(`⏭️ Skipped existing item: ${itemData.itemId}`);
          skippedCount++;
        } else {
          const newItem = new Item(itemData);
          await newItem.save();
          console.log(`✅ Created ${itemData.category}: ${itemData.name} (${itemData.itemId})`);
          createdCount++;
        }
      } catch (error: any) {
        console.error(`❌ Error creating item ${itemData.itemId}:`, error.message);
      }
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 SEED SUMMARY");
    console.log("=".repeat(60));
    console.log(`Created: ${createdCount} items`);
    console.log(`Skipped: ${skippedCount} items`);
    console.log(`Total processed: ${missingItems.length} items`);
    console.log("=".repeat(60));
    
    const totalItems = await Item.countDocuments();
    console.log(`\n📦 Total items in database: ${totalItems}`);
    
    // Afficher le compte par catégorie
    console.log("\n📋 Items by category:");
    const categories = await Item.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    categories.forEach(cat => {
      console.log(`   - ${cat._id}: ${cat.count}`);
    });
    
    console.log("\n🎉 Missing categories seed completed successfully!");
    
  } catch (error: any) {
    console.error("❌ Seed failed:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(0);
  }
}

if (require.main === module) {
  console.log("🚀 Missing Categories Seeder");
  console.log("Adding Currency, Fragment, Scroll, and Artifact items\n");
  main();
}

export default main;

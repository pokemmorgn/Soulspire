// server/src/scripts/seedAscensionEssences.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import Item from "../models/Item";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// === ESSENCES D'ASCENSION UNIVERSELLES ===
const ascensionEssences = [
  // === ESSENCE D'ASCENSION UNIVERSELLE ===
  {
    itemId: "ascension_essence",
    name: "ASCENSION_ESSENCE_NAME",
    description: "ASCENSION_ESSENCE_DESC",
    iconUrl: "icons/materials/ascension_essence.png",
    category: "Material",
    subCategory: "Ascension_Material",
    rarity: "Epic",
    tier: 1,
    maxLevel: 1,
    materialType: "Awakening",
    materialGrade: "Advanced",
    sellPrice: 100,
    buyPrice: 200
  },

  // === PACKS D'ESSENCES (pour les achats) ===
  {
    itemId: "ascension_essence_pack_small",
    name: "ASCENSION_ESSENCE_PACK_SMALL_NAME",
    description: "ASCENSION_ESSENCE_PACK_SMALL_DESC",
    iconUrl: "icons/packs/ascension_essence_pack_small.png",
    category: "Consumable",
    subCategory: "Essence_Pack",
    rarity: "Rare",
    consumableType: "Currency",
    consumableEffect: {
      type: "currency",
      value: 5 // Donne 5 essences
    },
    sellPrice: 400,
    buyPrice: 800
  },
  {
    itemId: "ascension_essence_pack_medium",
    name: "ASCENSION_ESSENCE_PACK_MEDIUM_NAME", 
    description: "ASCENSION_ESSENCE_PACK_MEDIUM_DESC",
    iconUrl: "icons/packs/ascension_essence_pack_medium.png",
    category: "Consumable",
    subCategory: "Essence_Pack",
    rarity: "Epic",
    consumableType: "Currency",
    consumableEffect: {
      type: "currency",
      value: 15 // Donne 15 essences
    },
    sellPrice: 1200,
    buyPrice: 2000
  },
  {
    itemId: "ascension_essence_pack_large",
    name: "ASCENSION_ESSENCE_PACK_LARGE_NAME",
    description: "ASCENSION_ESSENCE_PACK_LARGE_DESC", 
    iconUrl: "icons/packs/ascension_essence_pack_large.png",
    category: "Consumable",
    subCategory: "Essence_Pack",
    rarity: "Legendary",
    consumableType: "Currency",
    consumableEffect: {
      type: "currency",
      value: 50 // Donne 50 essences
    },
    sellPrice: 4000,
    buyPrice: 6000
  },

  // === COFFRES AVEC ESSENCES ===
  {
    itemId: "ascension_chest",
    name: "ASCENSION_CHEST_NAME",
    description: "ASCENSION_CHEST_DESC",
    iconUrl: "icons/chests/ascension_chest.png",
    category: "Chest",
    subCategory: "Ascension_Chest",
    rarity: "Epic",
    chestType: "Special",
    openCost: {
      gems: 300
    },
    chestContents: [
      {
        type: "Item",
        itemId: "ascension_essence",
        quantity: 10,
        dropRate: 80
      },
      {
        type: "Item", 
        itemId: "ascension_essence",
        quantity: 20,
        dropRate: 35
      },
      {
        type: "Item",
        itemId: "ascension_essence", 
        quantity: 5,
        dropRate: 100 // Garanti minimum
      },
      {
        type: "Currency",
        currencyType: "gold",
        quantity: 2000,
        dropRate: 60
      }
    ],
    guaranteedRarity: "Rare",
    sellPrice: 1500
  },

  // === MATÉRIAUX COMPLÉMENTAIRES ===
  {
    itemId: "hero_xp_crystal",
    name: "HERO_XP_CRYSTAL_NAME",
    description: "HERO_XP_CRYSTAL_DESC",
    iconUrl: "icons/materials/hero_xp_crystal.png", 
    category: "Consumable",
    subCategory: "XP_Material",
    rarity: "Rare",
    consumableType: "XP",
    consumableEffect: {
      type: "xp",
      value: 500 // Donne 500 Hero XP
    },
    sellPrice: 50,
    buyPrice: 100
  },
  {
    itemId: "hero_xp_crystal_large",
    name: "HERO_XP_CRYSTAL_LARGE_NAME",
    description: "HERO_XP_CRYSTAL_LARGE_DESC",
    iconUrl: "icons/materials/hero_xp_crystal_large.png",
    category: "Consumable", 
    subCategory: "XP_Material",
    rarity: "Epic",
    consumableType: "XP",
    consumableEffect: {
      type: "xp",
      value: 2000 // Donne 2000 Hero XP
    },
    sellPrice: 200,
    buyPrice: 350
  },

  // === CRISTAUX DE DÉBLOCAGE DE SORTS ===
  {
    itemId: "spell_unlock_crystal",
    name: "SPELL_UNLOCK_CRYSTAL_NAME",
    description: "SPELL_UNLOCK_CRYSTAL_DESC",
    iconUrl: "icons/materials/spell_unlock_crystal.png",
    category: "Material",
    subCategory: "Spell_Material", 
    rarity: "Epic",
    materialType: "Awakening",
    materialGrade: "Advanced",
    sellPrice: 150,
    buyPrice: 300
  },

  // === COFFRES DE NIVEAU UP ===
  {
    itemId: "level_up_chest",
    name: "LEVEL_UP_CHEST_NAME",
    description: "LEVEL_UP_CHEST_DESC",
    iconUrl: "icons/chests/level_up_chest.png",
    category: "Chest",
    subCategory: "Level_Up_Chest",
    rarity: "Rare",
    chestType: "Special",
    openCost: {
      gold: 2000
    },
    chestContents: [
      {
        type: "Item",
        itemId: "hero_xp_crystal",
        quantity: 3,
        dropRate: 70
      },
      {
        type: "Item",
        itemId: "hero_xp_crystal_large", 
        quantity: 1,
        dropRate: 30
      },
      {
        type: "Currency",
        currencyType: "gold",
        quantity: 1500,
        dropRate: 80
      },
      {
        type: "Item",
        itemId: "ascension_essence",
        quantity: 3,
        dropRate: 25
      }
    ],
    guaranteedRarity: "Common",
    sellPrice: 800
  },

  // === NOUVEAUX COFFRES PREMIUM ===
  {
    itemId: "premium_ascension_chest",
    name: "PREMIUM_ASCENSION_CHEST_NAME",
    description: "PREMIUM_ASCENSION_CHEST_DESC",
    iconUrl: "icons/chests/premium_ascension_chest.png",
    category: "Chest",
    subCategory: "Premium_Chest",
    rarity: "Legendary",
    chestType: "Special",
    openCost: {
      paidGems: 500
    },
    chestContents: [
      {
        type: "Item",
        itemId: "ascension_essence",
        quantity: 25,
        dropRate: 90
      },
      {
        type: "Item",
        itemId: "ascension_essence",
        quantity: 50,
        dropRate: 40
      },
      {
        type: "Item",
        itemId: "hero_xp_crystal_large",
        quantity: 5,
        dropRate: 70
      },
      {
        type: "Item",
        itemId: "spell_unlock_crystal",
        quantity: 3,
        dropRate: 50
      },
      {
        type: "Currency",
        currencyType: "gold",
        quantity: 10000,
        dropRate: 85
      }
    ],
    guaranteedRarity: "Epic",
    sellPrice: 5000
  }
];

// === FONCTION DE SEED ===
const seedAscensionEssences = async (): Promise<void> => {
  try {
    console.log("🌟 Starting ascension essences seed...");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Supprimer les essences existantes si demandé
    const deleteExisting = process.argv.includes('--clear');
    if (deleteExisting) {
      await Item.deleteMany({
        $or: [
          { subCategory: "Ascension_Material" },
          { subCategory: "Essence_Pack" },
          { subCategory: "XP_Material" },
          { subCategory: "Spell_Material" },
          { itemId: { $in: ["ascension_chest", "level_up_chest", "premium_ascension_chest"] } }
        ]
      });
      console.log("🗑️ Cleared existing ascension materials");
    }
    
    // Insérer les nouveaux objets
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const itemData of ascensionEssences) {
      try {
        // Vérifier si l'objet existe déjà
        const existingItem = await Item.findOne({ itemId: itemData.itemId });
        
        if (existingItem && !deleteExisting) {
          console.log(`⏭️ Skipped existing item: ${itemData.itemId}`);
          skippedCount++;
        } else {
          const newItem = new Item(itemData);
          await newItem.save();
          console.log(`✅ Created item: ${itemData.itemId} (${itemData.name})`);
          createdCount++;
        }
      } catch (error: any) {
        console.error(`❌ Error creating item ${itemData.itemId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Ascension Essences Seed Summary:`);
    console.log(`   - Created: ${createdCount} items`);
    console.log(`   - Skipped: ${skippedCount} items`);
    console.log(`   - Errors: ${errorCount} items`);
    console.log(`   - Total in seed: ${ascensionEssences.length} items`);
    
    // Vérification finale des essences
    const ascensionItemsCount = await Item.countDocuments({
      $or: [
        { subCategory: "Ascension_Material" },
        { subCategory: "Essence_Pack" },
        { subCategory: "XP_Material" },
        { subCategory: "Spell_Material" }
      ]
    });
    
    console.log(`   - Total ascension items in database: ${ascensionItemsCount}`);
    
    // Test de récupération
    const essenceItem = await Item.findOne({ itemId: "ascension_essence" });
    if (essenceItem) {
      console.log(`✅ Main ascension essence created successfully:`);
      console.log(`   - ID: ${essenceItem.itemId}`);
      console.log(`   - Name: ${essenceItem.name}`);
      console.log(`   - Rarity: ${essenceItem.rarity}`);
      console.log(`   - Sell Price: ${essenceItem.sellPrice}`);
    } else {
      console.log(`❌ Main ascension essence not found!`);
    }
    
    console.log("🎉 Ascension essences seed completed successfully!");
    
  } catch (error) {
    console.error("❌ Ascension essences seed failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(0);
  }
};

// === FONCTION POUR OBTENIR LES COÛTS D'ASCENSION ===
export const getAscensionCosts = () => {
  return {
    // Coûts par palier d'ascension
    tier1: { // Niveau 40→41
      gold: 5000,
      heroXP: 2000,
      ascensionEssence: 5
    },
    tier2: { // Niveau 80→81  
      gold: 15000,
      heroXP: 8000,
      ascensionEssence: 15
    },
    tier3: { // Niveau 120→121
      gold: 40000,
      heroXP: 20000,
      ascensionEssence: 35
    },
    tier4: { // Niveau 150→151
      gold: 80000,
      heroXP: 50000,
      ascensionEssence: 75
    }
  };
};

// === FONCTION POUR OBTENIR LES COÛTS DE LEVEL UP NORMAUX ===
export const getLevelUpCosts = (currentLevel: number, targetLevel: number, rarity: string) => {
  const rarityMultipliers: Record<string, number> = {
    Common: 1.0,
    Rare: 1.2,
    Epic: 1.5,
    Legendary: 2.0,
    Mythic: 2.5
  };
  
  const rarityMult = rarityMultipliers[rarity] || 1.0;
  let totalGold = 0;
  let totalHeroXP = 0;
  
  for (let level = currentLevel; level < targetLevel; level++) {
    // Coût de base qui augmente avec le niveau
    const baseGoldCost = 100 + (level * 25);
    const baseXPCost = 50 + (level * 15);
    
    totalGold += Math.floor(baseGoldCost * rarityMult);
    totalHeroXP += Math.floor(baseXPCost * rarityMult);
  }
  
  return {
    gold: totalGold,
    heroXP: totalHeroXP
  };
};

// === EXÉCUTION DU SCRIPT ===
if (require.main === module) {
  console.log("🚀 Ascension Essences Database Seeder");
  console.log("Arguments:", process.argv);
  console.log("Use --clear to delete existing ascension materials before seeding\n");
  
  seedAscensionEssences();
}

export default seedAscensionEssences;

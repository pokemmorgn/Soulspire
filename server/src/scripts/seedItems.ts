import mongoose from "mongoose";
import dotenv from "dotenv";
import Item from "../models/Item";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// === OBJETS DE BASE POUR LE SEED ===
const seedItems = [
  // === ARMES ===
  {
    itemId: "rusty_sword",
    name: "RUSTY_SWORD_NAME",
    description: "RUSTY_SWORD_DESC",
    iconUrl: "icons/weapons/rusty_sword.png",
    category: "Equipment",
    subCategory: "One_Hand_Sword",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: {
      atk: 15,
      hp: 5
    },
    statsPerLevel: {
      atk: 1.2,
      hp: 0.5
    },
    equipmentSlot: "Weapon",
    classRestriction: ["Tank", "DPS Melee"],
    levelRequirement: 1,
    sellPrice: 25
  },
  {
    itemId: "iron_sword",
    name: "IRON_SWORD_NAME",
    description: "IRON_SWORD_DESC",
    iconUrl: "icons/weapons/iron_sword.png",
    category: "Equipment",
    subCategory: "One_Hand_Sword",
    rarity: "Common",
    tier: 2,
    maxLevel: 40,
    baseStats: {
      atk: 35,
      hp: 15,
      crit: 2
    },
    statsPerLevel: {
      atk: 2.5,
      hp: 1,
      crit: 0.1
    },
    equipmentSlot: "Weapon",
    classRestriction: ["Tank", "DPS Melee"],
    levelRequirement: 10,
    sellPrice: 150
  },
  {
    itemId: "wooden_bow",
    name: "WOODEN_BOW_NAME",
    description: "WOODEN_BOW_DESC",
    iconUrl: "icons/weapons/wooden_bow.png",
    category: "Equipment",
    subCategory: "Bow",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: {
      atk: 20,
      crit: 5,
      accuracy: 10
    },
    statsPerLevel: {
      atk: 1.8,
      crit: 0.2,
      accuracy: 0.3
    },
    equipmentSlot: "Weapon",
    classRestriction: ["DPS Ranged"],
    levelRequirement: 1,
    sellPrice: 30
  },
  {
    itemId: "magic_staff",
    name: "MAGIC_STAFF_NAME",
    description: "MAGIC_STAFF_DESC",
    iconUrl: "icons/weapons/magic_staff.png",
    category: "Equipment",
    subCategory: "Staff",
    rarity: "Rare",
    tier: 1,
    maxLevel: 30,
    baseStats: {
      atk: 25,
      healingBonus: 10,
      energyRegen: 3,
      reductionCooldown: 2
    },
    statsPerLevel: {
      atk: 2,
      healingBonus: 0.5,
      energyRegen: 0.2,
      reductionCooldown: 0.1
    },
    equipmentSlot: "Weapon",
    classRestriction: ["Support"],
    levelRequirement: 5,
    sellPrice: 200
  },

  // === ARMURES ===
  {
    itemId: "leather_armor",
    name: "LEATHER_ARMOR_NAME",
    description: "LEATHER_ARMOR_DESC",
    iconUrl: "icons/armors/leather_armor.png",
    category: "Equipment",
    subCategory: "Light_Armor",
    rarity: "Common",
    tier: 1,
    maxLevel: 25,
    baseStats: {
      hp: 50,
      def: 8,
      dodge: 3
    },
    statsPerLevel: {
      hp: 3,
      def: 0.6,
      dodge: 0.1
    },
    equipmentSlot: "Armor",
    classRestriction: ["DPS Melee", "DPS Ranged"],
    levelRequirement: 1,
    sellPrice: 40
  },
  {
    itemId: "chainmail_armor",
    name: "CHAINMAIL_ARMOR_NAME",
    description: "CHAINMAIL_ARMOR_DESC",
    iconUrl: "icons/armors/chainmail_armor.png",
    category: "Equipment",
    subCategory: "Medium_Armor",
    rarity: "Common",
    tier: 2,
    maxLevel: 35,
    baseStats: {
      hp: 100,
      def: 20,
      critResist: 8
    },
    statsPerLevel: {
      hp: 6,
      def: 1.5,
      critResist: 0.3
    },
    equipmentSlot: "Armor",
    classRestriction: ["Tank", "DPS Melee"],
    levelRequirement: 8,
    sellPrice: 180
  },
  {
    itemId: "plate_armor",
    name: "PLATE_ARMOR_NAME",
    description: "PLATE_ARMOR_DESC",
    iconUrl: "icons/armors/plate_armor.png",
    category: "Equipment",
    subCategory: "Heavy_Armor",
    rarity: "Epic",
    tier: 1,
    maxLevel: 50,
    baseStats: {
      hp: 200,
      def: 50,
      critResist: 15,
      shieldBonus: 8
    },
    statsPerLevel: {
      hp: 12,
      def: 3,
      critResist: 0.4,
      shieldBonus: 0.2
    },
    equipmentSlot: "Armor",
    classRestriction: ["Tank"],
    levelRequirement: 15,
    sellPrice: 800
  },

  // === CASQUES ===
  {
    itemId: "cloth_hat",
    name: "CLOTH_HAT_NAME",
    description: "CLOTH_HAT_DESC",
    iconUrl: "icons/helmets/cloth_hat.png",
    category: "Equipment",
    subCategory: "Light_Helmet",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: {
      hp: 20,
      moral: 8,
      energyRegen: 1
    },
    statsPerLevel: {
      hp: 1.5,
      moral: 0.6,
      energyRegen: 0.1
    },
    equipmentSlot: "Helmet",
    classRestriction: ["Support"],
    levelRequirement: 1,
    sellPrice: 20
  },
  {
    itemId: "iron_helmet",
    name: "IRON_HELMET_NAME",
    description: "IRON_HELMET_DESC",
    iconUrl: "icons/helmets/iron_helmet.png",
    category: "Equipment",
    subCategory: "Heavy_Helmet",
    rarity: "Common",
    tier: 2,
    maxLevel: 30,
    baseStats: {
      hp: 40,
      def: 12,
      critResist: 6
    },
    statsPerLevel: {
      hp: 2.5,
      def: 0.8,
      critResist: 0.25
    },
    equipmentSlot: "Helmet",
    classRestriction: ["Tank", "DPS Melee"],
    levelRequirement: 5,
    sellPrice: 80
  },

  // === CONSOMMABLES ===
  {
    itemId: "health_potion_small",
    name: "HEALTH_POTION_SMALL_NAME",
    description: "HEALTH_POTION_SMALL_DESC",
    iconUrl: "icons/consumables/health_potion_small.png",
    category: "Consumable",
    subCategory: "Health_Potion",
    rarity: "Common",
    consumableType: "Potion",
    consumableEffect: {
      type: "heal",
      value: 100
    },
    sellPrice: 10
  },
  {
    itemId: "health_potion_medium",
    name: "HEALTH_POTION_MEDIUM_NAME",
    description: "HEALTH_POTION_MEDIUM_DESC",
    iconUrl: "icons/consumables/health_potion_medium.png",
    category: "Consumable",
    subCategory: "Health_Potion",
    rarity: "Common",
    consumableType: "Potion",
    consumableEffect: {
      type: "heal",
      value: 300
    },
    sellPrice: 25
  },
  {
    itemId: "mana_potion_small",
    name: "MANA_POTION_SMALL_NAME",
    description: "MANA_POTION_SMALL_DESC",
    iconUrl: "icons/consumables/mana_potion_small.png",
    category: "Consumable",
    subCategory: "Mana_Potion",
    rarity: "Common",
    consumableType: "Potion",
    consumableEffect: {
      type: "buff",
      value: 50,
      duration: 300
    },
    sellPrice: 15
  },
  {
    itemId: "xp_scroll",
    name: "XP_SCROLL_NAME",
    description: "XP_SCROLL_DESC",
    iconUrl: "icons/consumables/xp_scroll.png",
    category: "Consumable",
    subCategory: "XP_Scroll",
    rarity: "Rare",
    consumableType: "XP",
    consumableEffect: {
      type: "xp",
      value: 1000
    },
    sellPrice: 50
  },

  // === MATÉRIAUX ===
  {
    itemId: "iron_ore",
    name: "IRON_ORE_NAME",
    description: "IRON_ORE_DESC",
    iconUrl: "icons/materials/iron_ore.png",
    category: "Material",
    subCategory: "Metal_Ore",
    rarity: "Common",
    materialType: "Crafting",
    materialGrade: "Basic",
    sellPrice: 5
  },
  {
    itemId: "magic_crystal",
    name: "MAGIC_CRYSTAL_NAME",
    description: "MAGIC_CRYSTAL_DESC",
    iconUrl: "icons/materials/magic_crystal.png",
    category: "Material",
    subCategory: "Crystal",
    rarity: "Rare",
    materialType: "Enhancement",
    materialGrade: "Advanced",
    sellPrice: 30
  },
  {
    itemId: "dragon_scale",
    name: "DRAGON_SCALE_NAME",
    description: "DRAGON_SCALE_DESC",
    iconUrl: "icons/materials/dragon_scale.png",
    category: "Material",
    subCategory: "Monster_Part",
    rarity: "Epic",
    materialType: "Evolution",
    materialGrade: "Master",
    sellPrice: 150
  },
  {
    itemId: "awakening_stone",
    name: "AWAKENING_STONE_NAME",
    description: "AWAKENING_STONE_DESC",
    iconUrl: "icons/materials/awakening_stone.png",
    category: "Material",
    subCategory: "Special_Stone",
    rarity: "Legendary",
    materialType: "Awakening",
    materialGrade: "Legendary",
    sellPrice: 500
  },

  // === COFFRES ===
  {
    itemId: "wooden_chest",
    name: "WOODEN_CHEST_NAME",
    description: "WOODEN_CHEST_DESC",
    iconUrl: "icons/chests/wooden_chest.png",
    category: "Chest",
    subCategory: "Common_Chest",
    rarity: "Common",
    chestType: "Common",
    openCost: {
      gold: 500
    },
    chestContents: [
      {
        type: "Currency",
        currencyType: "gold",
        quantity: 200,
        dropRate: 70
      },
      {
        type: "Item",
        itemId: "health_potion_small",
        quantity: 1,
        dropRate: 50
      },
      {
        type: "Item",
        itemId: "iron_ore",
        quantity: 3,
        dropRate: 40
      }
    ],
    guaranteedRarity: "Common",
    sellPrice: 100
  },
  {
    itemId: "silver_chest",
    name: "SILVER_CHEST_NAME",
    description: "SILVER_CHEST_DESC",
    iconUrl: "icons/chests/silver_chest.png",
    category: "Chest",
    subCategory: "Elite_Chest",
    rarity: "Rare",
    chestType: "Elite",
    openCost: {
      gems: 100
    },
    chestContents: [
      {
        type: "Currency",
        currencyType: "gold",
        quantity: 1000,
        dropRate: 80
      },
      {
        type: "Item",
        itemId: "iron_sword",
        quantity: 1,
        dropRate: 30
      },
      {
        type: "Item",
        itemId: "magic_crystal",
        quantity: 2,
        dropRate: 25
      },
      {
        type: "Currency",
        currencyType: "gems",
        quantity: 50,
        dropRate: 15
      }
    ],
    guaranteedRarity: "Rare",
    sellPrice: 500
  },
  {
    itemId: "golden_chest",
    name: "GOLDEN_CHEST_NAME",
    description: "GOLDEN_CHEST_DESC",
    iconUrl: "icons/chests/golden_chest.png",
    category: "Chest",
    subCategory: "Legendary_Chest",
    rarity: "Legendary",
    chestType: "Legendary",
    openCost: {
      gems: 500
    },
    chestContents: [
      {
        type: "Currency",
        currencyType: "gold",
        quantity: 5000,
        dropRate: 90
      },
      {
        type: "Item",
        itemId: "plate_armor",
        quantity: 1,
        dropRate: 20
      },
      {
        type: "Item",
        itemId: "dragon_scale",
        quantity: 1,
        dropRate: 30
      },
      {
        type: "Item",
        itemId: "awakening_stone",
        quantity: 1,
        dropRate: 10
      },
      {
        type: "Currency",
        currencyType: "gems",
        quantity: 200,
        dropRate: 25
      }
    ],
    guaranteedRarity: "Epic",
    sellPrice: 2500
  }
];

// === FONCTION DE SEED ===
const seedDatabase = async (): Promise<void> => {
  try {
    console.log("🌱 Starting items seed...");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Supprimer tous les objets existants (optionnel)
    const deleteAll = process.argv.includes('--clear');
    if (deleteAll) {
      await Item.deleteMany({});
      console.log("🗑️ Cleared existing items");
    }
    
    // Insérer les nouveaux objets
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const itemData of seedItems) {
      try {
        // Vérifier si l'objet existe déjà
        const existingItem = await Item.findOne({ itemId: itemData.itemId });
        
        if (existingItem) {
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
      }
    }
    
    console.log(`\n📊 Seed Summary:`);
    console.log(`   - Created: ${createdCount} items`);
    console.log(`   - Skipped: ${skippedCount} items`);
    console.log(`   - Total in seed: ${seedItems.length} items`);
    
    // Vérification finale
    const totalItems = await Item.countDocuments();
    console.log(`   - Total items in database: ${totalItems}`);
    
    console.log("🎉 Items seed completed successfully!");
    
  } catch (error) {
    console.error("❌ Seed failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(0);
  }
};

// === EXÉCUTION DU SCRIPT ===
if (require.main === module) {
  console.log("🚀 Items Database Seeder");
  console.log("Arguments:", process.argv);
  console.log("Use --clear to delete existing items before seeding\n");
  
  seedDatabase();
}

export default seedDatabase;

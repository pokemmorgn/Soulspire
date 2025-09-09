// server/src/scripts/migrateItemsFromCSV.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import Item from "../models/Item";
import { IdGenerator } from "../utils/idGenerator";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// === OBJETS DIRECTEMENT FORMATÉS SELON NOTRE MODÈLE ===
const NEW_ITEMS = [
  // === CASQUES ===
  {
    itemId: "casque_cuir_use",
    name: "CASQUE_CUIR_USE_NAME",
    description: "CASQUE_CUIR_USE_DESC",
    iconUrl: "icons/helmets/casque_cuir_use.png",
    category: "Equipment",
    subCategory: "Light_Helmet",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: { hp: 200 },
    statsPerLevel: { hp: 10 },
    equipmentSlot: "Helmet",
    classRestriction: ["All"],
    levelRequirement: 1,
    sellPrice: 50
  },
  {
    itemId: "capuche_etudiant",
    name: "CAPUCHE_ETUDIANT_NAME",
    description: "CAPUCHE_ETUDIANT_DESC",
    iconUrl: "icons/helmets/capuche_etudiant.png",
    category: "Equipment",
    subCategory: "Light_Helmet",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: { hp: 220 },
    statsPerLevel: { hp: 11 },
    equipmentSlot: "Helmet",
    classRestriction: ["Support"],
    levelRequirement: 1,
    sellPrice: 55
  },
  {
    itemId: "heaume_soldat",
    name: "HEAUME_SOLDAT_NAME",
    description: "HEAUME_SOLDAT_DESC",
    iconUrl: "icons/helmets/heaume_soldat.png",
    category: "Equipment",
    subCategory: "Heavy_Helmet",
    rarity: "Rare",
    tier: 1,
    maxLevel: 30,
    baseStats: { hp: 400, def: 15 },
    statsPerLevel: { hp: 20, def: 0.8 },
    equipmentSlot: "Helmet",
    classRestriction: ["Tank", "DPS Melee"],
    levelRequirement: 5,
    sellPrice: 200
  },
  {
    itemId: "masque_runique",
    name: "MASQUE_RUNIQUE_NAME",
    description: "MASQUE_RUNIQUE_DESC",
    iconUrl: "icons/helmets/masque_runique.png",
    category: "Equipment",
    subCategory: "Medium_Helmet",
    rarity: "Rare",
    tier: 1,
    maxLevel: 30,
    baseStats: { hp: 380, accuracy: 5 },
    statsPerLevel: { hp: 19, accuracy: 0.3 },
    equipmentSlot: "Helmet",
    classRestriction: ["DPS Ranged"],
    levelRequirement: 5,
    sellPrice: 190
  },
  {
    itemId: "heaume_garde",
    name: "HEAUME_GARDE_NAME",
    description: "HEAUME_GARDE_DESC",
    iconUrl: "icons/helmets/heaume_garde.png",
    category: "Equipment",
    subCategory: "Heavy_Helmet",
    rarity: "Rare",
    tier: 1,
    maxLevel: 30,
    baseStats: { hp: 420, critResist: 8 },
    statsPerLevel: { hp: 21, critResist: 0.4 },
    equipmentSlot: "Helmet",
    classRestriction: ["Tank"],
    levelRequirement: 5,
    sellPrice: 210
  },
  {
    itemId: "casque_gladiateur",
    name: "CASQUE_GLADIATEUR_NAME",
    description: "CASQUE_GLADIATEUR_DESC",
    iconUrl: "icons/helmets/casque_gladiateur.png",
    category: "Equipment",
    subCategory: "Heavy_Helmet",
    rarity: "Epic",
    tier: 1,
    maxLevel: 40,
    baseStats: { hp: 800, crit: 10 },
    statsPerLevel: { hp: 40, crit: 0.5 },
    equipmentSlot: "Helmet",
    classRestriction: ["DPS Melee"],
    levelRequirement: 15,
    sellPrice: 800
  },
  {
    itemId: "couronne_acier_runique",
    name: "COURONNE_ACIER_RUNIQUE_NAME",
    description: "COURONNE_ACIER_RUNIQUE_DESC",
    iconUrl: "icons/helmets/couronne_acier_runique.png",
    category: "Equipment",
    subCategory: "Medium_Helmet",
    rarity: "Epic",
    tier: 1,
    maxLevel: 40,
    baseStats: { hp: 750, healingBonus: 10 },
    statsPerLevel: { hp: 37, healingBonus: 0.5 },
    equipmentSlot: "Helmet",
    classRestriction: ["Support"],
    levelRequirement: 15,
    sellPrice: 750
  },
  {
    itemId: "casque_colosse",
    name: "CASQUE_COLOSSE_NAME",
    description: "CASQUE_COLOSSE_DESC",
    iconUrl: "icons/helmets/casque_colosse.png",
    category: "Equipment",
    subCategory: "Heavy_Helmet",
    rarity: "Epic",
    tier: 1,
    maxLevel: 40,
    baseStats: { hp: 850, def: 25 },
    statsPerLevel: { hp: 42, def: 1.2 },
    equipmentSlot: "Helmet",
    classRestriction: ["Tank"],
    levelRequirement: 15,
    sellPrice: 850
  },
  {
    itemId: "heaume_titan",
    name: "HEAUME_TITAN_NAME",
    description: "HEAUME_TITAN_DESC",
    iconUrl: "icons/helmets/heaume_titan.png",
    category: "Equipment",
    subCategory: "Heavy_Helmet",
    rarity: "Legendary",
    tier: 1,
    maxLevel: 50,
    baseStats: { hp: 1200 },
    statsPerLevel: { hp: 60 },
    equipmentSlot: "Helmet",
    classRestriction: ["Tank"],
    levelRequirement: 25,
    sellPrice: 2500,
    effects: [{
      id: IdGenerator.generateCompactUUID(),
      name: "Immunité Étourdissement",
      description: "Immunité contre les étourdissements",
      type: "Passive",
      trigger: "always",
      value: 100
    }]
  },
  {
    itemId: "masque_spectral",
    name: "MASQUE_SPECTRAL_NAME",
    description: "MASQUE_SPECTRAL_DESC",
    iconUrl: "icons/helmets/masque_spectral.png",
    category: "Equipment",
    subCategory: "Medium_Helmet",
    rarity: "Legendary",
    tier: 1,
    maxLevel: 50,
    baseStats: { hp: 1000 },
    statsPerLevel: { hp: 50 },
    equipmentSlot: "Helmet",
    classRestriction: ["DPS Ranged"],
    levelRequirement: 25,
    sellPrice: 2000,
    effects: [{
      id: IdGenerator.generateCompactUUID(),
      name: "Silence en Riposte",
      description: "10% chance de silence quand on reçoit des dégâts",
      type: "Passive",
      trigger: "onHit",
      value: 10
    }]
  },

  // === SETS LÉGENDAIRES - CASQUES ===
  {
    itemId: "casque_gardien_fer",
    name: "CASQUE_GARDIEN_FER_NAME",
    description: "CASQUE_GARDIEN_FER_DESC",
    iconUrl: "icons/helmets/casque_gardien_fer.png",
    category: "Equipment",
    subCategory: "Heavy_Helmet",
    rarity: "Legendary",
    tier: 2,
    maxLevel: 60,
    baseStats: { hp: 1100, def: 30 },
    statsPerLevel: { hp: 55, def: 1.5 },
    equipmentSlot: "Helmet",
    classRestriction: ["Tank"],
    levelRequirement: 30,
    sellPrice: 3000,
    equipmentSet: { setId: "gardien_de_fer", setName: "Gardien de Fer" }
  },
  {
    itemId: "casque_bastion_runique",
    name: "CASQUE_BASTION_RUNIQUE_NAME",
    description: "CASQUE_BASTION_RUNIQUE_DESC",
    iconUrl: "icons/helmets/casque_bastion_runique.png",
    category: "Equipment",
    subCategory: "Heavy_Helmet",
    rarity: "Legendary",
    tier: 2,
    maxLevel: 60,
    baseStats: { hp: 1050, critResist: 20 },
    statsPerLevel: { hp: 52, critResist: 1.0 },
    equipmentSlot: "Helmet",
    classRestriction: ["Support"],
    levelRequirement: 30,
    sellPrice: 2800,
    equipmentSet: { setId: "bastion_runique", setName: "Bastion Runique" }
  },

  // === PLASTRONS ===
  {
    itemId: "plastron_cuir",
    name: "PLASTRON_CUIR_NAME",
    description: "PLASTRON_CUIR_DESC",
    iconUrl: "icons/armors/plastron_cuir.png",
    category: "Equipment",
    subCategory: "Light_Armor",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: { hp: 300 },
    statsPerLevel: { hp: 15 },
    equipmentSlot: "Armor",
    classRestriction: ["All"],
    levelRequirement: 1,
    sellPrice: 75
  },
  {
    itemId: "robe_apprenti",
    name: "ROBE_APPRENTI_NAME",
    description: "ROBE_APPRENTI_DESC",
    iconUrl: "icons/armors/robe_apprenti.png",
    category: "Equipment",
    subCategory: "Robe",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: { hp: 280, critResist: 5 },
    statsPerLevel: { hp: 14, critResist: 0.3 },
    equipmentSlot: "Armor",
    classRestriction: ["Support"],
    levelRequirement: 1,
    sellPrice: 70
  },
  {
    itemId: "armure_soldat",
    name: "ARMURE_SOLDAT_NAME",
    description: "ARMURE_SOLDAT_DESC",
    iconUrl: "icons/armors/armure_soldat.png",
    category: "Equipment",
    subCategory: "Medium_Armor",
    rarity: "Rare",
    tier: 1,
    maxLevel: 30,
    baseStats: { hp: 600, def: 30 },
    statsPerLevel: { hp: 30, def: 1.5 },
    equipmentSlot: "Armor",
    classRestriction: ["Tank", "DPS Melee"],
    levelRequirement: 5,
    sellPrice: 300
  },

  // === ARMES ===
  {
    itemId: "epee_rouillee",
    name: "EPEE_ROUILLEE_NAME",
    description: "EPEE_ROUILLEE_DESC",
    iconUrl: "icons/weapons/epee_rouillee.png",
    category: "Equipment",
    subCategory: "One_Hand_Sword",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: { atk: 80 },
    statsPerLevel: { atk: 4 },
    equipmentSlot: "Weapon",
    classRestriction: ["Tank", "DPS Melee"],
    levelRequirement: 1,
    sellPrice: 40
  },
  {
    itemId: "baton_novice",
    name: "BATON_NOVICE_NAME",
    description: "BATON_NOVICE_DESC",
    iconUrl: "icons/weapons/baton_novice.png",
    category: "Equipment",
    subCategory: "Staff",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: { atk: 70, healingBonus: 5 },
    statsPerLevel: { atk: 3.5, healingBonus: 0.3 },
    equipmentSlot: "Weapon",
    classRestriction: ["Support"],
    levelRequirement: 1,
    sellPrice: 35
  },

  // === SETS LÉGENDAIRES - ARMES ===
  {
    itemId: "lame_lames_vent",
    name: "LAME_LAMES_VENT_NAME",
    description: "LAME_LAMES_VENT_DESC",
    iconUrl: "icons/weapons/lame_lames_vent.png",
    category: "Equipment",
    subCategory: "Curved_Sword",
    rarity: "Legendary",
    tier: 2,
    maxLevel: 60,
    baseStats: { atk: 500, vitesse: 25 },
    statsPerLevel: { atk: 25, vitesse: 1.2 },
    equipmentSlot: "Weapon",
    classRestriction: ["DPS Melee"],
    levelRequirement: 30,
    sellPrice: 4000,
    equipmentSet: { setId: "lames_du_vent", setName: "Lames du Vent" }
  },
  {
    itemId: "hache_berserker_sanglant",
    name: "HACHE_BERSERKER_SANGLANT_NAME",
    description: "HACHE_BERSERKER_SANGLANT_DESC",
    iconUrl: "icons/weapons/hache_berserker_sanglant.png",
    category: "Equipment",
    subCategory: "Two_Hand_Axe",
    rarity: "Legendary",
    tier: 2,
    maxLevel: 60,
    baseStats: { atk: 520, crit: 30 },
    statsPerLevel: { atk: 26, crit: 1.5 },
    equipmentSlot: "Weapon",
    classRestriction: ["DPS Melee"],
    levelRequirement: 30,
    sellPrice: 4200,
    equipmentSet: { setId: "berserker_sanglant", setName: "Berserker Sanglant" }
  },
  {
    itemId: "arc_oeil_faucon",
    name: "ARC_OEIL_FAUCON_NAME",
    description: "ARC_OEIL_FAUCON_DESC",
    iconUrl: "icons/weapons/arc_oeil_faucon.png",
    category: "Equipment",
    subCategory: "Bow",
    rarity: "Legendary",
    tier: 2,
    maxLevel: 60,
    baseStats: { atk: 480, accuracy: 35 },
    statsPerLevel: { atk: 24, accuracy: 1.8 },
    equipmentSlot: "Weapon",
    classRestriction: ["DPS Ranged"],
    levelRequirement: 30,
    sellPrice: 3800,
    equipmentSet: { setId: "oeil_du_faucon", setName: "Œil du Faucon" }
  },
  {
    itemId: "orbe_arcanes_instables",
    name: "ORBE_ARCANES_INSTABLES_NAME",
    description: "ORBE_ARCANES_INSTABLES_DESC",
    iconUrl: "icons/weapons/orbe_arcanes_instables.png",
    category: "Equipment",
    subCategory: "Orb",
    rarity: "Legendary",
    tier: 2,
    maxLevel: 60,
    baseStats: { atk: 450, healingBonus: 40 },
    statsPerLevel: { atk: 22, healingBonus: 2.0 },
    equipmentSlot: "Weapon",
    classRestriction: ["Support"],
    levelRequirement: 30,
    sellPrice: 3600,
    equipmentSet: { setId: "arcanes_instables", setName: "Arcanes Instables" }
  },
  {
    itemId: "sceptre_main_sacree",
    name: "SCEPTRE_MAIN_SACREE_NAME",
    description: "SCEPTRE_MAIN_SACREE_DESC",
    iconUrl: "icons/weapons/sceptre_main_sacree.png",
    category: "Equipment",
    subCategory: "Scepter",
    rarity: "Legendary",
    tier: 2,
    maxLevel: 60,
    baseStats: { atk: 420, healingBonus: 30 },
    statsPerLevel: { atk: 21, healingBonus: 1.5 },
    equipmentSlot: "Weapon",
    classRestriction: ["Support"],
    levelRequirement: 30,
    sellPrice: 3400,
    equipmentSet: { setId: "main_sacree", setName: "Main Sacrée" }
  },
  {
    itemId: "cristal_oracle_astral",
    name: "CRISTAL_ORACLE_ASTRAL_NAME",
    description: "CRISTAL_ORACLE_ASTRAL_DESC",
    iconUrl: "icons/weapons/cristal_oracle_astral.png",
    category: "Equipment",
    subCategory: "Crystal",
    rarity: "Legendary",
    tier: 2,
    maxLevel: 60,
    baseStats: { atk: 460, energyRegen: 4 },
    statsPerLevel: { atk: 23, energyRegen: 0.2 },
    equipmentSlot: "Weapon",
    classRestriction: ["Support"],
    levelRequirement: 30,
    sellPrice: 3700,
    equipmentSet: { setId: "oracle_astral", setName: "Oracle Astral" }
  },

  // === BOTTES ===
  {
    itemId: "bottes_cuir",
    name: "BOTTES_CUIR_NAME",
    description: "BOTTES_CUIR_DESC",
    iconUrl: "icons/boots/bottes_cuir.png",
    category: "Equipment",
    subCategory: "Light_Boots",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: { hp: 150, vitesse: 5 },
    statsPerLevel: { hp: 7, vitesse: 0.3 },
    equipmentSlot: "Boots",
    classRestriction: ["All"],
    levelRequirement: 1,
    sellPrice: 30
  },

  // === GANTS ===
  {
    itemId: "gants_cuir",
    name: "GANTS_CUIR_NAME",
    description: "GANTS_CUIR_DESC",
    iconUrl: "icons/gloves/gants_cuir.png",
    category: "Equipment",
    subCategory: "Light_Gloves",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: { hp: 100, atk: 10 },
    statsPerLevel: { hp: 5, atk: 0.5 },
    equipmentSlot: "Gloves",
    classRestriction: ["All"],
    levelRequirement: 1,
    sellPrice: 25
  },

  // === ACCESSOIRES ===
  {
    itemId: "anneau_cuivre",
    name: "ANNEAU_CUIVRE_NAME",
    description: "ANNEAU_CUIVRE_DESC",
    iconUrl: "icons/accessories/anneau_cuivre.png",
    category: "Equipment",
    subCategory: "Ring",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: { hp: 50, atk: 5 },
    statsPerLevel: { hp: 2.5, atk: 0.3 },
    equipmentSlot: "Accessory",
    classRestriction: ["All"],
    levelRequirement: 1,
    sellPrice: 15
  },
  {
    itemId: "pendentif_cuivre",
    name: "PENDENTIF_CUIVRE_NAME",
    description: "PENDENTIF_CUIVRE_DESC",
    iconUrl: "icons/accessories/pendentif_cuivre.png",
    category: "Equipment",
    subCategory: "Necklace",
    rarity: "Common",
    tier: 1,
    maxLevel: 20,
    baseStats: { hp: 80, atk: 3 },
    statsPerLevel: { hp: 4, atk: 0.2 },
    equipmentSlot: "Accessory",
    classRestriction: ["All"],
    levelRequirement: 1,
    sellPrice: 20
  }
];

// === FONCTION DE MIGRATION ===
const migrateItems = async (): Promise<void> => {
  try {
    console.log("🌱 Starting items migration from CSV data...");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Supprimer tous les objets existants
    const deleteResult = await Item.deleteMany({});
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} existing items`);
    
    // Insérer les nouveaux objets
    let createdCount = 0;
    let errorCount = 0;
    
    for (const itemData of NEW_ITEMS) {
      try {
        const newItem = new Item(itemData);
        await newItem.save();
        console.log(`✅ Created item: ${itemData.itemId} (${itemData.name})`);
        createdCount++;
      } catch (error: any) {
        console.error(`❌ Error creating item ${itemData.itemId}:`, error.message);
        errorCount++;
      }
    }
    
    // Statistiques finales
    console.log(`\n📊 Migration Summary:`);
    console.log(`   - Created: ${createdCount} items`);
    console.log(`   - Errors: ${errorCount} items`);
    console.log(`   - Total in migration: ${NEW_ITEMS.length} items`);
    
    // Vérification finale
    const totalItems = await Item.countDocuments();
    console.log(`   - Total items in database: ${totalItems}`);
    
    // Statistiques par rareté
    const rarityStats = await Item.aggregate([
      { $group: { _id: "$rarity", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log(`\n📈 Items by rarity:`);
    rarityStats.forEach(stat => {
      console.log(`   - ${stat._id}: ${stat.count} items`);
    });
    
    // Statistiques des sets
    const setStats = await Item.aggregate([
      { $match: { "equipmentSet.setId": { $exists: true } } },
      { $group: { _id: "$equipmentSet.setName", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log(`\n🛡️ Equipment sets:`);
    setStats.forEach(stat => {
      console.log(`   - ${stat._id}: ${stat.count} pieces`);
    });
    
    console.log("🎉 Items migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(0);
  }
};

// === EXÉCUTION DU SCRIPT ===
if (require.main === module) {
  console.log("🚀 Items Database Migration from CSV");
  console.log("This will replace ALL existing items with new ones from CSV data\n");
  
  migrateItems();
}

export default migrateItems;

import mongoose from "mongoose";
import dotenv from "dotenv";
import Shop from "../models/Shop";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// === FONCTION DE SEED ===
const seedShops = async (): Promise<void> => {
  try {
    console.log("🏪 Starting shops seed...");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Types de shops à créer
    const shopTypes = ["General", "Arena", "Clan", "Daily", "VIP", "Labyrinth", "Event"];
    
    // Supprimer tous les shops existants (optionnel)
    const deleteAll = process.argv.includes('--clear');
    if (deleteAll) {
      await Shop.deleteMany({});
      console.log("🗑️ Cleared existing shops");
    }
    
    // Créer les shops prédéfinis
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const shopType of shopTypes) {
      try {
        // Vérifier si le shop existe déjà
        const existingShop = await Shop.findOne({ shopType });
        
        if (existingShop) {
          console.log(`⏭️ Skipped existing shop: ${shopType}`);
          skippedCount++;
        } else {
          const newShop = (Shop as any).createPredefinedShop(shopType);
          await newShop.save();
          console.log(`✅ Created shop: ${shopType} (${newShop.name})`);
          createdCount++;
        }
      } catch (error: any) {
        console.error(`❌ Error creating shop ${shopType}:`, error.message);
      }
    }
    
    console.log(`\n📊 Seed Summary:`);
    console.log(`   - Created: ${createdCount} shops`);
    console.log(`   - Skipped: ${skippedCount} shops`);
    console.log(`   - Total in seed: ${shopTypes.length} shops`);
    
    // Vérification finale
    const totalShops = await Shop.countDocuments();
    const activeShops = await Shop.countDocuments({ isActive: true });
    console.log(`   - Total shops in database: ${totalShops}`);
    console.log(`   - Active shops: ${activeShops}`);
    
    // Afficher les détails des shops créés
    console.log(`\n📋 Shops Details:`);
    const allShops = await Shop.find().select("shopType name resetFrequency maxItemsShown levelRequirement");
    for (const shop of allShops) {
      console.log(`   ${shop.shopType}: ${shop.items?.length || 0} items`);
    }
    
    console.log("🎉 Shops seed completed successfully!");
    
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
  console.log("🚀 Shops Database Seeder");
  console.log("Arguments:", process.argv.slice(2).join(' '));
  console.log("Use --clear to delete existing shops before seeding\n");
  
  seedShops();
}

export default seedShops;

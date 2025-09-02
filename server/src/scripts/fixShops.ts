import mongoose from "mongoose";
import dotenv from "dotenv";
import Shop from "../models/Shop";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

const fixShops = async (): Promise<void> => {
  try {
    console.log("🔧 Fixing shops database...");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Supprimer tous les shops corrompus
    const deletedCount = await Shop.deleteMany({});
    console.log(`🗑️ Deleted ${deletedCount.deletedCount} existing shops`);
    
    // Recréer les shops de base proprement
    const shopTypes = ["General", "Arena", "Clan", "Daily", "VIP", "Labyrinth", "Event"];
    
    for (const shopType of shopTypes) {
      try {
        const shop = (Shop as any).createPredefinedShop(shopType);
        await shop.save();
        console.log(`✅ Created ${shopType} shop: ${shop.name}`);
        
        // Générer quelques objets de test
        await shop.refreshShop();
        console.log(`  📦 Generated ${shop.items.length} items`);
        
      } catch (error: any) {
        console.error(`❌ Error creating shop ${shopType}:`, error.message);
      }
    }
    
    // Vérification finale
    const totalShops = await Shop.countDocuments();
    console.log(`\n📊 Final count: ${totalShops} shops created`);
    
    // Afficher les détails
    const allShops = await Shop.find().select("shopType name items resetFrequency levelRequirement");
    console.log("\n📋 Created shops:");
    for (const shop of allShops) {
      console.log(`  🏪 ${shop.shopType}: "${shop.name}" (${shop.items?.length || 0} items, reset: ${shop.resetFrequency})`);
    }
    
    console.log("\n🎉 Shops fixed successfully!");
    
  } catch (error) {
    console.error("❌ Fix failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(0);
  }
};

if (require.main === module) {
  console.log("🚀 Shop Fix Script");
  fixShops();
}

export default fixShops;

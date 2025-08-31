import mongoose from "mongoose";
import dotenv from "dotenv";
import Shop from "../models/Shop";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

const seedShops = async (): Promise<void> => {
  try {
    console.log("🌱 Starting shop seeding...");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Supprimer les shops existants
    await Shop.deleteMany({});
    console.log("🗑️ Cleared existing shops");

    // Créer les 4 types de shops
    const shopTypes = ["Daily", "Weekly", "Monthly", "Premium"];
    const createdShops = [];

    for (const type of shopTypes) {
      const shopItems = (Shop as any).generateShopItems(type);
      
      const shop = new Shop({
        type,
        items: shopItems,
        isActive: true
      });

      await shop.save();
      createdShops.push(shop);
      
      console.log(`✅ Created ${type} shop with ${shopItems.length} items`);
    }

    // Afficher un résumé
    console.log("\n📊 Shop Seeding Summary:");
    for (const shop of createdShops) {
      console.log(`   ${shop.type}: ${shop.items.length} items`);
      console.log(`   Next Reset: ${shop.nextResetTime.toISOString()}`);
      
      // Afficher quelques items d'exemple
      const sampleItems = shop.items.slice(0, 2);
      for (const item of sampleItems) {
        const costStr = Object.entries(item.cost)
          .filter(([_, value]) => value > 0)
          .map(([key, value]) => `${value} ${key}`)
          .join(", ");
        console.log(`     - ${item.name}: ${costStr}`);
      }
      console.log("");
    }

    console.log("🎉 Shop seeding completed successfully!");
    
  } catch (error) {
    console.error("❌ Shop seeding failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Exécuter le seeding si ce fichier est appelé directement
if (require.main === module) {
  seedShops().then(() => process.exit(0));
}

export { seedShops };

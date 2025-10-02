import mongoose from "mongoose";
import dotenv from "dotenv";
import Shop from "../models/Shop";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

async function seedFridayShop() {
  try {
    console.log("🛒 Creating ElementalFriday shop...");
    
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Supprimer l'ancienne boutique si elle existe
    await Shop.deleteOne({ shopType: "ElementalFriday" });
    console.log("🗑️ Deleted existing ElementalFriday shop");

    // Créer la nouvelle boutique
    const fridayShop = (Shop as any).createPredefinedShop("ElementalFriday");
    
    // Générer les 5 offres
    await fridayShop.generateElementalFridayItems();
    
    // Sauvegarder
    await fridayShop.save();

    console.log("✅ ElementalFriday shop created successfully!");
    console.log(`   - ${fridayShop.items.length} offers generated`);
    console.log(`   - Next reset: ${fridayShop.nextResetTime}`);
    
    // Afficher les offres
    console.log("\n📦 Offers:");
    fridayShop.items.forEach((item: any, index: number) => {
      console.log(`   ${index + 1}. ${item.name}`);
      console.log(`      └─ ${item.content.quantity} tickets for ${item.cost.gems} gems (${item.discountPercent}% off)`);
    });

  } catch (error) {
    console.error("❌ Seed failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

if (require.main === module) {
  seedFridayShop();
}

export default seedFridayShop;

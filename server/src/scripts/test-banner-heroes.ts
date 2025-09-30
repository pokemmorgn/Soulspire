// test-banner-heroes.ts
import mongoose from "mongoose";
import Banner from "./models/Banner";

mongoose.connect("mongodb://localhost:27017/unity-gacha-game");

const testBanner = async () => {
  const banner = await Banner.findOne({ bannerId: "beginner_blessing_001" });
  if (!banner) {
    console.log("❌ Bannière non trouvée");
    return;
  }
  
  console.log("📋 Banner:", banner.name);
  console.log("🎯 Pool type:", banner.heroPool.includeAll ? "ALL" : "SPECIFIC");
  console.log("📝 Specific heroes:", banner.heroPool.specificHeroes);
  
  const heroes = await banner.getAvailableHeroes();
  console.log(`✅ Héros trouvés: ${heroes.length}`);
  
  heroes.forEach((hero: any) => {
    console.log(`  - ${hero.name} (${hero.rarity} ${hero.role})`);
  });
  
  await mongoose.disconnect();
};

testBanner();

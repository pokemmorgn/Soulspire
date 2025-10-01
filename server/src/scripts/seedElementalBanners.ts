// server/src/scripts/seedElementalBanners.ts

import mongoose from "mongoose";
import dotenv from "dotenv";
import Banner from "../models/Banner";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

/**
 * Obtenir les jours de rotation pour chaque élément
 */
function getRotationDaysForElement(element: string): string[] {
  const dayMap: { [key: string]: string[] } = {
    "Fire": ["monday", "sunday"],
    "Electric": ["tuesday", "sunday"],
    "Wind": ["wednesday", "sunday"],
    "Water": ["thursday", "sunday"],
    "Light": ["saturday", "sunday"],
    "Shadow": ["saturday", "sunday"]
  };
  
  return dayMap[element] || [];
}

/**
 * Obtenir tous les héros d'un élément
 */
async function getHeroesByElement(element: string): Promise<string[]> {
  const heroes = await Hero.find({ element }).select("_id name rarity");
  console.log(`   Found ${heroes.length} ${element} heroes in database`);
  return heroes.map((h: any) => h._id.toString());
}

/**
 * Créer une bannière élémentaire
 */
async function createElementalBanner(element: string) {
  const now = new Date();
  const tenYearsLater = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);

  console.log(`\n🔮 Creating ${element} Elemental Banner...`);

  // Récupérer tous les héros de cet élément
  const elementHeroIds = await getHeroesByElement(element);

  if (elementHeroIds.length === 0) {
    console.log(`   ⚠️ No ${element} heroes found, skipping banner creation`);
    return null;
  }

  // Récupérer les héros Legendary de cet élément pour focus
  const legendaryHeroes = await Hero.find({ 
    element, 
    rarity: "Legendary" 
  }).select("_id name");

  console.log(`   Found ${legendaryHeroes.length} Legendary ${element} heroes`);

  // Sélectionner 1-2 héros focus au hasard
  const focusHeroes = legendaryHeroes.length > 0 
    ? [legendaryHeroes[Math.floor(Math.random() * legendaryHeroes.length)]]
    : [];

  const banner = {
    bannerId: `elemental_${element.toLowerCase()}`,
    name: `${element} Elemental Summon`,
    type: "Standard" as const,
    description: `Summon ${element} element heroes using ${element} elemental tickets! All heroes are guaranteed to be ${element} element. Legendary pity at 50 pulls, wishlist pity at 100 pulls.`,

    startTime: now,
    endTime: tenYearsLater,
    timezone: "UTC",
    serverConfig: { 
      allowedServers: ["ALL"], 
      region: ["GLOBAL"] 
    },

    isActive: true,
    isVisible: true,
    sortOrder: 150, // Entre Standard (50) et Limited (200)

    // Pool de héros: tous les héros de l'élément
    heroPool: { 
      includeAll: false, 
      specificHeroes: elementHeroIds,
      excludedHeroes: [], 
      rarityFilters: [] 
    },

    // Héros focus (si disponibles)
    focusHeroes: focusHeroes.map((hero: any) => ({
      heroId: hero._id.toString(),
      rateUpMultiplier: 2.0,
      guaranteed: false,
      focusChance: 0.40 // 40% chance pour les legendaries
    })),

    // Taux de drop (mêmes que Standard)
    rates: { 
      Common: 35.5, 
      Rare: 36, 
      Epic: 24, 
      Legendary: 4.5
    },

    // Coût: tickets élémentaires uniquement
    costs: {
      singlePull: { gems: 0, tickets: 0 },
      multiPull: { gems: 0, tickets: 0 },
      firstPullDiscount: { gems: 0, tickets: 0 }
    },

    // Configuration élémentaire
    elementalConfig: {
      element,
      ticketCost: 1, // 1 ticket par pull
      rotationDays: getRotationDaysForElement(element)
    },

    // Pity réduit pour bannières élémentaires
    pityConfig: { 
      legendaryPity: 50,  // 50 pulls au lieu de 90
      epicPity: 0,
      sharedPity: false, 
      resetOnBannerEnd: false 
    },

    limits: { 
      maxPullsPerPlayer: -1, 
      maxPullsPerDay: -1, 
      firstTimePullBonus: false 
    },

    bonusRewards: {
      milestones: [
        { 
          pullCount: 25, 
          rewards: [{ 
            type: "currency" as const, 
            quantity: 250, 
            itemId: "gems" 
          }] 
        },
        {
          pullCount: 50,
          rewards: [
            { type: "currency" as const, quantity: 500, itemId: "gems" },
            { type: "currency" as const, quantity: 2, itemId: "tickets" }
          ]
        },
        {
          pullCount: 100,
          rewards: [
            { type: "currency" as const, quantity: 1000, itemId: "gems" },
            { type: "currency" as const, quantity: 5, itemId: "tickets" }
          ]
        }
      ]
    },

    bannerImage: `https://cdn.placeholder.com/banners/elemental_${element.toLowerCase()}.png`,
    iconImage: `https://cdn.placeholder.com/icons/elemental_${element.toLowerCase()}_icon.png`,
    backgroundMusic: `https://cdn.placeholder.com/audio/elemental_${element.toLowerCase()}_theme.mp3`,
    animationType: "standard" as const,

    stats: { 
      totalPulls: 0, 
      totalPlayers: 0, 
      averagePullsPerPlayer: 0, 
      legendaryCount: 0, 
      epicCount: 0 
    },

    tags: ["elemental", element.toLowerCase(), "ticket-based"],
    category: "Character" as const
  };

  console.log(`   ✅ Banner configured:`);
  console.log(`      Heroes: ${elementHeroIds.length}`);
  console.log(`      Focus: ${focusHeroes.length > 0 ? focusHeroes[0].name : 'None'}`);
  console.log(`      Rotation: ${banner.elementalConfig.rotationDays.join(", ")}`);
  console.log(`      Legendary Pity: ${banner.pityConfig.legendaryPity}`);

  return banner;
}

/**
 * Seed principal
 */
async function seedElementalBanners() {
  try {
    console.log("🔮 Starting elemental banners seeding...\n");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Vérifier combien de héros existent par élément
    console.log("📊 Checking hero distribution by element:");
    const elements = ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"];
    
    for (const element of elements) {
      const count = await Hero.countDocuments({ element });
      const legendaryCount = await Hero.countDocuments({ element, rarity: "Legendary" });
      console.log(`   ${element}: ${count} total (${legendaryCount} Legendary)`);
    }

    console.log("\n" + "=".repeat(60));

    // Supprimer les bannières élémentaires existantes
    const deleteResult = await Banner.deleteMany({ 
      bannerId: { $regex: /^elemental_/ } 
    });
    console.log(`\n🗑️  Deleted ${deleteResult.deletedCount} existing elemental banners`);

    // Créer les 6 bannières élémentaires
    const banners = [];

    for (const element of elements) {
      const banner = await createElementalBanner(element);
      if (banner) {
        banners.push(banner);
      }
    }

    // Insérer toutes les bannières
    if (banners.length > 0) {
      await Banner.insertMany(banners);
      console.log("\n" + "=".repeat(60));
      console.log(`\n✅ Successfully created ${banners.length} elemental banners!\n`);
      
      console.log("📋 Summary:");
      banners.forEach((banner, index) => {
        console.log(`   ${index + 1}. ${banner.name}`);
        console.log(`      └─ Banner ID: ${banner.bannerId}`);
        console.log(`      └─ Heroes: ${banner.heroPool.specificHeroes?.length || 0}`);
        console.log(`      └─ Focus: ${banner.focusHeroes.length > 0 ? 'Yes' : 'No'}`);
        console.log(`      └─ Active on: ${banner.elementalConfig?.rotationDays.join(", ")}`);
        console.log(`      └─ Pity: ${banner.pityConfig?.legendaryPity || 50} pulls`);
        console.log("");
      });
    } else {
      console.log("\n⚠️ No elemental banners were created (no heroes found)");
    }

    console.log("=".repeat(60));
    console.log("\n🎯 Next steps:");
    console.log("   1. Run: npm run test:elemental to test the system");
    console.log("   2. Check rotation: GET /api/gacha/elemental/rotation");
    console.log("   3. View banners: GET /api/gacha/elemental/banners");
    console.log("");

  } catch (error: any) {
    console.error("\n❌ Elemental banners seeding failed:", error.message || error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB\n");
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  seedElementalBanners().then(() => process.exit(0));
}

export { seedElementalBanners };

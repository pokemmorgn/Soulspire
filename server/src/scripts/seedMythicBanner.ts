// server/src/scripts/seedMythicBanner.ts

import mongoose from "mongoose";
import dotenv from "dotenv";
import Banner from "../models/Banner";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// ============================================================
// Utils
// ============================================================
async function getHeroesByRarity(rarity: string) {
  return Hero.find({ rarity }).select("_id name rarity role element").lean();
}

// ============================================================
// BANNIÈRE MYTHIQUE
// ============================================================
async function createMythicBanner() {
  const now = new Date();
  const tenYearsLater = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);

  // Vérifier que les héros mythiques existent
  const mythicHeroes = await getHeroesByRarity("Mythic");
  
  if (mythicHeroes.length === 0) {
    throw new Error("❌ No Mythic heroes found! Please run 'npm run seed:heroes' first.");
  }

  console.log(`✅ Found ${mythicHeroes.length} Mythic heroes in database`);
  mythicHeroes.forEach(hero => {
    console.log(`   - ${hero.name} (${hero.element} ${hero.role})`);
  });

  return {
    bannerId: "mythic_eternal_001",
    name: "Eternal Mythic Summon",
    type: "Mythic" as const,
    description: "The ultimate summoning ritual reserved for the most dedicated adventurers. Use precious Mythic Scrolls earned from your journey to summon god-tier heroes. 5% Mythic rate with guaranteed pity at 35 pulls!",

    // Permanent (10 ans)
    startTime: now,
    endTime: tenYearsLater,
    timezone: "UTC",
    serverConfig: {
      allowedServers: ["ALL"],
      region: ["GLOBAL"]
    },

    isActive: true,
    isVisible: true,
    sortOrder: 300, // Priorité maximale (après Limited = 200)

    // Pool : TOUS les Mythic + TOUS les Legendary
    heroPool: {
      includeAll: true,
      specificHeroes: [],
      excludedHeroes: [],
      rarityFilters: ["Mythic", "Legendary"]
    },

    // Pas de focus heroes (tous les mythics ont les mêmes chances)
    focusHeroes: [],

    // Taux : 5% Mythic / 95% Legendary (pas de Common/Rare/Epic)
    rates: {
      Common: 0,
      Rare: 0,
      Epic: 0,
      Legendary: 95,
      Mythic: 5
    },

    // Coûts : UNIQUEMENT parchemins mythiques
    costs: {
      singlePull: {
        mythicScrolls: 1
      },
      multiPull: {
        mythicScrolls: 10
      },
      firstPullDiscount: {}
    },

    // Pity : 35 pulls = Mythic garanti
    pityConfig: {
      legendaryPity: 35, // Utilisé pour le pity Mythic
      epicPity: 0,
      sharedPity: false,
      resetOnBannerEnd: false
    },

    limits: {
      maxPullsPerPlayer: -1, // Illimité
      maxPullsPerDay: -1,
      firstTimePullBonus: false
    },

    bonusRewards: {
      milestones: [
        {
          pullCount: 10,
          rewards: [
            { type: "currency" as const, quantity: 1000, itemId: "gems" }
          ]
        },
        {
          pullCount: 35,
          rewards: [
            { type: "currency" as const, quantity: 5000, itemId: "gems" },
            { type: "material" as const, quantity: 1, itemId: "mythic_essence" }
          ]
        },
        {
          pullCount: 100,
          rewards: [
            { type: "currency" as const, quantity: 10000, itemId: "gems" },
            { type: "material" as const, quantity: 5, itemId: "mythic_essence" }
          ]
        }
      ]
    },

    bannerImage: "https://cdn.placeholder.com/banners/mythic_eternal.png",
    iconImage: "https://cdn.placeholder.com/icons/mythic_eternal_icon.png",
    backgroundMusic: "https://cdn.placeholder.com/audio/mythic_theme.mp3",
    animationType: "special" as const,

    stats: {
      totalPulls: 0,
      totalPlayers: 0,
      averagePullsPerPlayer: 0,
      legendaryCount: 0,
      epicCount: 0
    },

    tags: ["mythic", "endgame", "premium", "permanent", "god-tier"],
    category: "Character" as const
  };
}

// ============================================================
// SEED
// ============================================================
const seedMythicBanner = async () => {
  try {
    console.log("🔮 Starting Mythic Banner seeding...");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Vérifier si la bannière existe déjà
    const existingBanner = await Banner.findOne({ type: "Mythic" });

    if (existingBanner) {
      console.log("🔄 Mythic banner already exists, updating...");
      
      const mythicBanner = await createMythicBanner();
      await Banner.updateOne(
        { type: "Mythic" },
        { $set: mythicBanner }
      );
      
      console.log("✅ Mythic banner updated successfully!");
    } else {
      console.log("📝 Creating new Mythic banner...");
      
      const mythicBanner = await createMythicBanner();
      await Banner.create(mythicBanner);
      
      console.log("✅ Mythic banner created successfully!");
    }

    // Afficher les détails
    const finalBanner = await Banner.findOne({ type: "Mythic" });
    
    if (finalBanner) {
      console.log("\n📋 Banner details:");
      console.log(`   Name: ${finalBanner.name}`);
      console.log(`   Banner ID: ${finalBanner.bannerId}`);
      console.log(`   Type: ${finalBanner.type}`);
      console.log(`   Rates: ${finalBanner.rates.Mythic}% Mythic / ${finalBanner.rates.Legendary}% Legendary`);
      console.log(`   Pity: Mythic guaranteed at ${finalBanner.pityConfig?.legendaryPity || 35} pulls`);
      console.log(`   Cost: ${finalBanner.costs.singlePull.mythicScrolls || 1} scroll (single) / ${finalBanner.costs.multiPull.mythicScrolls || 10} scrolls (10x)`);
      console.log(`   Active: ${finalBanner.isActive ? "Yes ✅" : "No ❌"}`);
      console.log(`   Visible: ${finalBanner.isVisible ? "Yes ✅" : "No ❌"}`);
      console.log(`   Tags: [${finalBanner.tags.join(", ")}]`);
      console.log(`   End Time: ${finalBanner.endTime.toISOString()}`);
      
      // Afficher les héros disponibles
      const availableHeroes = await finalBanner.getAvailableHeroes();
      const mythicHeroes = availableHeroes.filter((h: any) => h.rarity === "Mythic");
      const legendaryHeroes = availableHeroes.filter((h: any) => h.rarity === "Legendary");
      
      console.log(`\n🎯 Available Heroes:`);
      console.log(`   Mythic: ${mythicHeroes.length}`);
      mythicHeroes.forEach((h: any) => {
        console.log(`      - ${h.name} (${h.element} ${h.role})`);
      });
      console.log(`   Legendary: ${legendaryHeroes.length}`);
    }

    console.log("\n🎉 Mythic Banner seeding completed!");

  } catch (error: any) {
    console.error("❌ Mythic Banner seeding failed:", error.message || error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

if (require.main === module) {
  seedMythicBanner().then(() => process.exit(0));
}

export { seedMythicBanner };

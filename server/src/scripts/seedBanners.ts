import mongoose from "mongoose";
import dotenv from "dotenv";
import Banner from "../models/Banner";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// ============================================================
// Utils
// ============================================================
async function getHeroesByRarity(rarity: string) {
  return Hero.find({ rarity }).select("_id name rarity role element").lean();
}

async function getHeroByName(name: string) {
  return Hero.findOne({ name }).select("_id name rarity role element").lean();
}

function pickRandom<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

// ============================================================
// BANNERS
// ============================================================
async function createBeginnerBanner() {
  const now = new Date();
  const tenYearsLater = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);

  const commons = await getHeroesByRarity("Common");
  const rares = await getHeroesByRarity("Rare");
  const epics = await getHeroesByRarity("Epic");
  const legendaries = await getHeroesByRarity("Legendary");

  const rareSelection = pickRandom(rares, 5);
  const epicSelection = pickRandom(epics, 3);
  const legendarySelection = pickRandom(legendaries, 1);

  const poolHeroes = [
    ...commons.map((h) => h._id),
    ...rareSelection.map((h) => h._id),
    ...epicSelection.map((h) => h._id),
    ...legendarySelection.map((h) => h._id),
  ];

  return {
    bannerId: "beginner_blessing_001",
    name: "Starter's Blessing",
    type: "Beginner" as const,
    description:
      "Perfect for new adventurers! Reduced costs and guaranteed Epic hero within your first 10 pulls! Limited to 60 pulls per player.",

    startTime: now,
    endTime: tenYearsLater,
    timezone: "UTC",
    serverConfig: { allowedServers: ["ALL"], region: ["GLOBAL"] },

    isActive: true,
    isVisible: true,
    sortOrder: 100,

    heroPool: { includeAll: false, specificHeroes: poolHeroes, excludedHeroes: [], rarityFilters: [] },
    focusHeroes: [], // Pas de focus heroes sur la bannière débutant

    rates: { Common: 45, Rare: 35, Epic: 17, Legendary: 3 },
    costs: {
      singlePull: { gems: 150, tickets: 1 },
      multiPull: { gems: 1350 },
      firstPullDiscount: { gems: 50 },
    },
    pityConfig: { legendaryPity: 60, epicPity: 10, sharedPity: false, resetOnBannerEnd: false },
    limits: { maxPullsPerPlayer: 60, maxPullsPerDay: -1, firstTimePullBonus: true },

    bonusRewards: {
      milestones: [
        { pullCount: 10, rewards: [{ type: "currency", quantity: 100, itemId: "gems" }] },
        {
          pullCount: 30,
          rewards: [
            { type: "currency", quantity: 300, itemId: "gems" },
            { type: "currency", quantity: 3, itemId: "tickets" },
          ],
        },
        {
          pullCount: 60,
          rewards: [
            { type: "currency", quantity: 1000, itemId: "gems" },
            { type: "currency", quantity: 5, itemId: "tickets" },
          ],
        },
      ],
    },

    bannerImage: "https://cdn.placeholder.com/banners/beginner_blessing.png",
    iconImage: "https://cdn.placeholder.com/icons/beginner_blessing_icon.png",
    backgroundMusic: "https://cdn.placeholder.com/audio/beginner_theme.mp3",
    animationType: "standard" as const,
    stats: { totalPulls: 0, totalPlayers: 0, averagePullsPerPlayer: 0, legendaryCount: 0, epicCount: 0 },
    tags: ["newbie", "recommended", "limited-pulls", "beginner-friendly"],
    category: "Character" as const,
  };
}

function createStandardBanner() {
  const now = new Date();
  const tenYearsLater = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);

  return {
    bannerId: "standard_summon_001",
    name: "Hero Summoning - Standard",
    type: "Standard" as const,
    description: "The standard summoning pool featuring all heroes. Pity system guarantees a Legendary hero within 90 pulls!",

    startTime: now,
    endTime: tenYearsLater,
    timezone: "UTC",
    serverConfig: { allowedServers: ["ALL"], region: ["GLOBAL"] },

    isActive: true,
    isVisible: true,
    sortOrder: 50,

    heroPool: { includeAll: true, specificHeroes: [], excludedHeroes: [], rarityFilters: [] },
    focusHeroes: [], // Pas de focus heroes sur la bannière standard

    rates: { Common: 50, Rare: 30, Epic: 15, Legendary: 5 },
    costs: {
      singlePull: { gems: 300, tickets: 1 },
      multiPull: { gems: 2700 },
      firstPullDiscount: { gems: 150 },
    },
    pityConfig: { legendaryPity: 90, sharedPity: false, resetOnBannerEnd: false },
    limits: { maxPullsPerPlayer: -1, maxPullsPerDay: -1, firstTimePullBonus: true },

    bonusRewards: {
      milestones: [
        { pullCount: 50, rewards: [{ type: "currency", quantity: 500, itemId: "gems" }] },
        {
          pullCount: 100,
          rewards: [
            { type: "currency", quantity: 1000, itemId: "gems" },
            { type: "currency", quantity: 5, itemId: "tickets" },
          ],
        },
        {
          pullCount: 200,
          rewards: [
            { type: "currency", quantity: 2000, itemId: "gems" },
            { type: "currency", quantity: 10, itemId: "tickets" },
          ],
        },
      ],
    },

    bannerImage: "https://cdn.placeholder.com/banners/standard_summon.png",
    iconImage: "https://cdn.placeholder.com/icons/standard_summon_icon.png",
    backgroundMusic: "https://cdn.placeholder.com/audio/standard_theme.mp3",
    animationType: "standard" as const,
    stats: { totalPulls: 0, totalPlayers: 0, averagePullsPerPlayer: 0, legendaryCount: 0, epicCount: 0 },
    tags: ["permanent", "all-heroes", "standard"],
    category: "Character" as const,
  };
}

async function createLimitedBanner(focusHeroName: string) {
  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const focusHero = await getHeroByName(focusHeroName);

  if (!focusHero) {
    throw new Error(`❌ Focus hero "${focusHeroName}" not found in DB`);
  }

  if (focusHero.rarity !== "Legendary") {
    throw new Error(`❌ Focus hero "${focusHeroName}" is not Legendary (found: ${focusHero.rarity})`);
  }

  return {
    bannerId: `limited_${focusHeroName.toLowerCase()}_rateup`,
    name: `${focusHeroName} Rate-Up`,
    type: "Limited" as const,
    description: `Limited-time banner featuring ${focusHeroName.toUpperCase()}! Increased drop rates and guaranteed on your first Legendary pull. Available for 14 days only!`,

    startTime: now,
    endTime: twoWeeksLater,
    timezone: "UTC",
    serverConfig: { allowedServers: ["ALL"], region: ["GLOBAL"] },

    isActive: true,
    isVisible: true,
    sortOrder: 200,

    heroPool: { includeAll: true, specificHeroes: [], excludedHeroes: [], rarityFilters: [] },
    
    // ✅ MODIFICATION PRINCIPALE : Ajout de focusChance
    focusHeroes: [
      { 
        heroId: focusHero._id, 
        rateUpMultiplier: 2.5,        // Multiplicateur (non utilisé pour l'instant)
        guaranteed: true,              // Premier legendary = focus garanti
        focusChance: 0.75              // ✅ 75% de chance pour les legendaries suivants
      }
    ],

    // ✅ Taux sans le champ obsolète focusRateUp
    rates: { Common: 40, Rare: 34, Epic: 24, Legendary: 2 },
    
    costs: {
      singlePull: { gems: 300, tickets: 1 },
      multiPull: { gems: 2700 },
      firstPullDiscount: { gems: 200 },
    },
    pityConfig: { legendaryPity: 90, sharedPity: false, resetOnBannerEnd: true },
    limits: { maxPullsPerPlayer: -1, maxPullsPerDay: -1, firstTimePullBonus: true },

    bonusRewards: {
      milestones: [
        { pullCount: 10, rewards: [{ type: "currency", quantity: 100, itemId: "gems" }] },
        {
          pullCount: 30,
          rewards: [
            { type: "currency", quantity: 300, itemId: "gems" },
            { type: "currency", quantity: 3, itemId: "tickets" },
          ],
        },
        {
          pullCount: 50,
          rewards: [
            { type: "currency", quantity: 500, itemId: "gems" },
            { type: "material", quantity: 1, itemId: "epic_fragment" },
          ],
        },
        {
          pullCount: 100,
          rewards: [
            { type: "currency", quantity: 1000, itemId: "gems" },
            { type: "currency", quantity: 10, itemId: "tickets" },
          ],
        },
      ],
    },

    bannerImage: `https://cdn.placeholder.com/banners/${focusHeroName.toLowerCase()}_rateup.png`,
    iconImage: `https://cdn.placeholder.com/icons/${focusHeroName.toLowerCase()}_icon.png`,
    backgroundMusic: "https://cdn.placeholder.com/audio/limited_theme.mp3",
    animationType: "rainbow" as const,
    stats: { totalPulls: 0, totalPlayers: 0, averagePullsPerPlayer: 0, legendaryCount: 0, epicCount: 0 },
    tags: ["limited", "rate-up", focusHeroName.toLowerCase()],
    category: "Character" as const,
  };
}

// ============================================================
// SEED
// ============================================================
const seedBanners = async () => {
  try {
    console.log("🎰 Starting banner seeding...");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    await Banner.deleteMany({});
    console.log("🗑️  Cleared existing banners");

    // Argument CLI ou fallback sur Saryel
    const focusArg = process.argv.find((arg) => arg.startsWith("--focus="));
    const focusHeroName = focusArg ? focusArg.split("=")[1] : "Saryel";

    console.log(`🎯 Limited Banner focus hero: ${focusHeroName}`);

    const beginner = await createBeginnerBanner();
    const standard = createStandardBanner();
    const limited = await createLimitedBanner(focusHeroName);

    await Banner.insertMany([beginner, standard, limited]);

    console.log("✅ Created 3 banners successfully!");
    console.log("\n📋 Bannières créées:");
    console.log(`   1. ${beginner.name} (Beginner)`);
    console.log(`   2. ${standard.name} (Standard)`);
    console.log(`   3. ${limited.name} (Limited) - Focus: ${focusHeroName} avec ${(limited.focusHeroes[0].focusChance * 100).toFixed(0)}% chance`);
    console.log("");
  } catch (error: any) {
    console.error("❌ Banner seeding failed:", error.message || error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

if (require.main === module) {
  seedBanners().then(() => process.exit(0));
}

export { seedBanners };

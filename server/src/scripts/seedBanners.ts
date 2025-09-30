import mongoose from "mongoose";
import dotenv from "dotenv";
import Banner from "../models/Banner";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// ============================================================
// Fonctions utilitaires
// ============================================================
async function getHeroesByRarity(rarity: string) {
  return Hero.find({ rarity }).select("_id name rarity role element").lean();
}

async function getHeroByName(name: string) {
  return Hero.findOne({ name }).select("_id name rarity role element").lean();
}

// ============================================================
// 1. BEGINNER BANNER - Pour nouveaux joueurs
// ============================================================
async function createBeginnerBanner() {
  const now = new Date();
  const tenYearsLater = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);

  // Héros par rareté
  const commons = await getHeroesByRarity("Common");
  const rares = await getHeroesByRarity("Rare");
  const epics = await getHeroesByRarity("Epic");
  const aureon = await getHeroByName("Aureon"); // focus Legendary beginner

  // Sélectionner quelques héros équilibrés
  const rareSelection = rares.filter((h) =>
    ["Ignar", "Kaelen", "Nereida", "Lyaria", "Ignara"].includes(h.name)
  );
  const epicSelection = epics.filter((h) =>
    ["Zephyra", "Thalrik", "Glacius"].includes(h.name)
  );

  return {
    bannerId: "beginner_blessing_001",
    name: "Starter's Blessing",
    type: "Beginner" as const,
    description:
      "Perfect for new adventurers! Reduced costs and guaranteed Epic hero within your first 10 pulls! Limited to 60 pulls per player.",

    startTime: now,
    endTime: tenYearsLater,
    timezone: "UTC",

    serverConfig: {
      allowedServers: ["ALL"],
      region: ["GLOBAL"],
    },

    isActive: true,
    isVisible: true,
    sortOrder: 100,

    heroPool: {
      includeAll: false,
      specificHeroes: [
        ...commons.map((h) => h._id),
        ...rareSelection.map((h) => h._id),
        ...epicSelection.map((h) => h._id),
        aureon?._id,
      ].filter(Boolean),
      excludedHeroes: [],
      rarityFilters: [],
    },

    focusHeroes: [],

    rates: { Common: 45, Rare: 35, Epic: 17, Legendary: 3 },

    costs: {
      singlePull: { gems: 150, tickets: 1 },
      multiPull: { gems: 1350 },
      firstPullDiscount: { gems: 50 },
    },

    pityConfig: {
      legendaryPity: 60,
      epicPity: 10,
      sharedPity: false,
      resetOnBannerEnd: false,
    },

    limits: {
      maxPullsPerPlayer: 60,
      maxPullsPerDay: -1,
      firstTimePullBonus: true,
    },

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

    stats: {
      totalPulls: 0,
      totalPlayers: 0,
      averagePullsPerPlayer: 0,
      legendaryCount: 0,
      epicCount: 0,
    },

    tags: ["newbie", "recommended", "limited-pulls", "beginner-friendly"],
    category: "Character" as const,
  };
}

// ============================================================
// 2. STANDARD BANNER - Pool complet permanent
// ============================================================
function createStandardBanner() {
  const now = new Date();
  const tenYearsLater = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);

  return {
    bannerId: "standard_summon_001",
    name: "Hero Summoning - Standard",
    type: "Standard" as const,
    description:
      "The standard summoning pool featuring all heroes. Pity system guarantees a Legendary hero within 90 pulls!",

    startTime: now,
    endTime: tenYearsLater,
    timezone: "UTC",

    serverConfig: { allowedServers: ["ALL"], region: ["GLOBAL"] },

    isActive: true,
    isVisible: true,
    sortOrder: 50,

    heroPool: { includeAll: true, specificHeroes: [], excludedHeroes: [], rarityFilters: [] },

    focusHeroes: [],

    rates: { Common: 50, Rare: 30, Epic: 15, Legendary: 5 },

    costs: {
      singlePull: { gems: 300, tickets: 1 },
      multiPull: { gems: 2700 },
      firstPullDiscount: { gems: 150 },
    },

    pityConfig: {
      legendaryPity: 90,
      epicPity: 10,
      sharedPity: false,
      resetOnBannerEnd: false,
    },

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

    stats: {
      totalPulls: 0,
      totalPlayers: 0,
      averagePullsPerPlayer: 0,
      legendaryCount: 0,
      epicCount: 0,
    },

    tags: ["permanent", "all-heroes", "standard"],
    category: "Character" as const,
  };
}

// ============================================================
// 3. LIMITED BANNER - Focus Aureon
// ============================================================
async function createLimitedBanner() {
  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const aureon = await getHeroByName("Aureon");

  return {
    bannerId: "divine_guardian_rateup_001",
    name: "Divine Guardian Rate-Up",
    type: "Limited" as const,
    description:
      "Limited-time banner featuring AUREON, the legendary Light Tank! Increased drop rates and guaranteed on your first Legendary pull. Available for 14 days only!",

    startTime: now,
    endTime: twoWeeksLater,
    timezone: "UTC",

    serverConfig: { allowedServers: ["ALL"], region: ["GLOBAL"] },

    isActive: true,
    isVisible: true,
    sortOrder: 200,

    heroPool: { includeAll: true, specificHeroes: [], excludedHeroes: [], rarityFilters: [] },

    focusHeroes: aureon
      ? [
          {
            heroId: aureon._id,
            rateUpMultiplier: 2.5,
            guaranteed: true,
          },
        ]
      : [],

    rates: { Common: 40, Rare: 35, Epic: 20, Legendary: 5, focusRateUp: 50 },

    costs: {
      singlePull: { gems: 300, tickets: 1 },
      multiPull: { gems: 2700 },
      firstPullDiscount: { gems: 200 },
    },

    pityConfig: {
      legendaryPity: 90,
      epicPity: 10,
      sharedPity: false,
      resetOnBannerEnd: true,
    },

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

    bannerImage: "https://cdn.placeholder.com/banners/divine_guardian_aureon.png",
    iconImage: "https://cdn.placeholder.com/icons/divine_guardian_icon.png",
    backgroundMusic: "https://cdn.placeholder.com/audio/divine_theme.mp3",
    animationType: "rainbow" as const,

    stats: {
      totalPulls: 0,
      totalPlayers: 0,
      averagePullsPerPlayer: 0,
      legendaryCount: 0,
      epicCount: 0,
    },

    tags: ["limited", "rate-up", "aureon", "light-element", "tank", "event"],
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
    console.log("🗑️ Cleared existing banners");

    const beginner = await createBeginnerBanner();
    const standard = createStandardBanner();
    const limited = await createLimitedBanner();

    await Banner.insertMany([beginner, standard, limited]);

    console.log("✅ Created 3 banners successfully!");
  } catch (error) {
    console.error("❌ Banner seeding failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

if (require.main === module) {
  seedBanners().then(() => process.exit(0));
}

export { seedBanners };

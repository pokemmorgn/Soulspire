import mongoose from "mongoose";
import dotenv from "dotenv";
import Banner from "../models/Banner";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

/**
 * Script de création des 3 bannières principales du jeu
 * - Beginner Banner (nouveaux joueurs)
 * - Standard Banner (pool complet permanent)
 * - Limited Banner (focus Aureon avec rate-up)
 */

// Liste des IDs de héros par rareté (à mettre à jour après seed des héros)
const HERO_IDS = {
  // Common (6)
  common: [
    "Tynira",    // Electric Support
    "Braknor",   // Wind Ranged DPS
    "Nora",      // Water Ranged DPS
    "Halvar",    // Wind Tank
    "Zeyra",     // Electric Melee DPS
    "Cinder"     // Fire Melee DPS
  ],
  
  // Rare (8)
  rare: [
    "Ignar",     // Fire Tank
    "Kaelen",    // Wind Melee DPS (custom spells)
    "Nereida",   // Water Support (custom spells)
    "Theron",    // Electric Ranged DPS
    "Lyaria",    // Light Support (custom spells)
    "Korgrim",   // Shadow Tank
    "Ignara",    // Fire Ranged DPS (custom spells)
    "Mistral"    // Wind Support
  ],
  
  // Epic (8)
  epic: [
    "Zephyra",   // Wind Ranged DPS (custom spells)
    "Thalrik",   // Electric Tank (custom spells)
    "Seliora",   // Shadow Ranged DPS (custom spells)
    "Glacius",   // Water Tank
    "Drogath",   // Shadow Tank (custom spells)
    "Solara",    // Light Support
    "Emberia",   // Fire Melee DPS
    "Nereon"     // Water Support
  ],
  
  // Legendary (10)
  legendary: [
    "Aureon",      // Light Tank (custom spells lvl 4) - FOCUS HERO
    "Veyron",      // Wind Melee DPS (custom spells)
    "Pyra",        // Fire Support (custom spells)
    "Voidhar",     // Shadow Ranged DPS
    "Leviathan",   // Water Tank
    "Infernus",    // Fire Melee DPS
    "Celestine",   // Light Support
    "Stormking",   // Electric Ranged DPS
    "Tempest",     // Electric Melee DPS
    "Shadowmere"   // Shadow Ranged DPS
  ]
};

// ============================================================================
// 1. BEGINNER BANNER - Pour nouveaux joueurs
// ============================================================================
const createBeginnerBanner = () => {
  const now = new Date();
  const tenYearsLater = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
  
  return {
    bannerId: "beginner_blessing_001",
    name: "Starter's Blessing",
    type: "Beginner" as const,
    description: "Perfect for new adventurers! Reduced costs and guaranteed Epic hero within your first 10 pulls! Limited to 60 pulls per player.",
    
    // Timing - Permanent mais limitée par joueur
    startTime: now,
    endTime: tenYearsLater,
    timezone: "UTC",
    
    // Configuration serveur - TOUS les serveurs
    serverConfig: {
      allowedServers: ["ALL"],
      region: ["GLOBAL"]
    },
    
    // Visibilité
    isActive: true,
    isVisible: true,
    sortOrder: 100, // Priorité maximale (affichée en premier)
    
    // Pool de héros - SÉLECTION ÉQUILIBRÉE pour débutants
    heroPool: {
      includeAll: false,
      specificHeroes: [
        // Tous les Common (6)
        ...HERO_IDS.common,
        
        // Rare sélectionnés (5 sur 8) - Meilleurs pour early game
        "Ignar",    // Tank solide
        "Kaelen",   // DPS avec sorts custom
        "Nereida",  // Support essentiel avec sorts custom
        "Lyaria",   // Support light avec sorts custom
        "Ignara",   // Ranged DPS avec sorts custom
        
        // Epic sélectionnés (3 sur 8) - Piliers mid-game
        "Zephyra",  // Ranged DPS fort (sorts custom)
        "Thalrik",  // Tank électrique (sorts custom)
        "Glacius",  // Tank eau solide
        
        // Legendary (1 sur 10) - Récompense ultime
        "Aureon"    // Tank light légendaire (sorts custom lvl 4)
      ],
      excludedHeroes: [],
      rarityFilters: [] // Pas de filtre, on utilise specificHeroes
    },
    
    // Pas de héros focus - Pool équilibré
    focusHeroes: [],
    
    // Taux favorables aux débutants
    rates: {
      Common: 45,    // Légèrement réduit
      Rare: 35,      // Augmenté pour aider
      Epic: 17,      // Augmenté
      Legendary: 3   // Chance réduite mais possible
    },
    
    // Coûts RÉDUITS pour nouveaux joueurs
    costs: {
      singlePull: {
        gems: 150,   // 50% de réduction
        tickets: 1
      },
      multiPull: {
        gems: 1350   // 50% de réduction (10 pulls)
      },
      firstPullDiscount: {
        gems: 50     // Premier pull à 50 gems seulement!
      }
    },
    
    // Pity system réduit pour encourager
    pityConfig: {
      legendaryPity: 60,  // Réduit de 90 à 60
      epicPity: 10,       // Epic garanti tous les 10 pulls
      sharedPity: false,  // Compteur indépendant
      resetOnBannerEnd: false
    },
    
    // Limites strictes - Bannière pour débutants uniquement
    limits: {
      maxPullsPerPlayer: 60,  // 60 pulls maximum
      maxPullsPerDay: -1,     // Pas de limite quotidienne
      firstTimePullBonus: true
    },
    
    // Récompenses bonus par paliers
    bonusRewards: {
      milestones: [
        {
          pullCount: 10,
          rewards: [
            { type: "currency" as const, quantity: 100, itemId: "gems" }
          ]
        },
        {
          pullCount: 30,
          rewards: [
            { type: "currency" as const, quantity: 300, itemId: "gems" },
            { type: "currency" as const, quantity: 3, itemId: "tickets" }
          ]
        },
        {
          pullCount: 60,
          rewards: [
            { type: "currency" as const, quantity: 1000, itemId: "gems" },
            { type: "currency" as const, quantity: 5, itemId: "tickets" }
          ]
        }
      ]
    },
    
    // Assets visuels
    bannerImage: "https://cdn.placeholder.com/banners/beginner_blessing.png",
    iconImage: "https://cdn.placeholder.com/icons/beginner_blessing_icon.png",
    backgroundMusic: "https://cdn.placeholder.com/audio/beginner_theme.mp3",
    animationType: "standard" as const,
    
    // Stats initiales
    stats: {
      totalPulls: 0,
      totalPlayers: 0,
      averagePullsPerPlayer: 0,
      legendaryCount: 0,
      epicCount: 0
    },
    
    // Tags et métadonnées
    tags: ["newbie", "recommended", "limited-pulls", "beginner-friendly"],
    category: "Character" as const
  };
};

// ============================================================================
// 2. STANDARD BANNER - Pool complet permanent
// ============================================================================
const createStandardBanner = () => {
  const now = new Date();
  const tenYearsLater = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
  
  return {
    bannerId: "standard_summon_001",
    name: "Hero Summoning - Standard",
    type: "Standard" as const,
    description: "The standard summoning pool featuring all heroes. Pity system guarantees a Legendary hero within 90 pulls!",
    
    // Timing - PERMANENT
    startTime: now,
    endTime: tenYearsLater,
    timezone: "UTC",
    
    // Configuration serveur - TOUS les serveurs
    serverConfig: {
      allowedServers: ["ALL"],
      region: ["GLOBAL"]
    },
    
    // Visibilité
    isActive: true,
    isVisible: true,
    sortOrder: 50, // Deuxième position
    
    // Pool complet - TOUS les héros disponibles
    heroPool: {
      includeAll: true,
      specificHeroes: [],
      excludedHeroes: [],
      rarityFilters: [] // Tous les héros de toutes raretés
    },
    
    // Pas de héros focus - Pool neutre
    focusHeroes: [],
    
    // Taux standards équilibrés
    rates: {
      Common: 50,
      Rare: 30,
      Epic: 15,
      Legendary: 5
    },
    
    // Coûts standards
    costs: {
      singlePull: {
        gems: 300,
        tickets: 1
      },
      multiPull: {
        gems: 2700  // 10% discount pour 10 pulls
      },
      firstPullDiscount: {
        gems: 150   // Premier pull à moitié prix
      }
    },
    
    // Pity system standard
    pityConfig: {
      legendaryPity: 90,  // Legendary garanti à 90 pulls
      epicPity: 10,       // Epic garanti tous les 10 pulls
      sharedPity: false,  // Compteur indépendant
      resetOnBannerEnd: false
    },
    
    // Pas de limites - Bannière permanente
    limits: {
      maxPullsPerPlayer: -1,  // Illimité
      maxPullsPerDay: -1,
      firstTimePullBonus: true
    },
    
    // Récompenses bonus par paliers
    bonusRewards: {
      milestones: [
        {
          pullCount: 50,
          rewards: [
            { type: "currency" as const, quantity: 500, itemId: "gems" }
          ]
        },
        {
          pullCount: 100,
          rewards: [
            { type: "currency" as const, quantity: 1000, itemId: "gems" },
            { type: "currency" as const, quantity: 5, itemId: "tickets" }
          ]
        },
        {
          pullCount: 200,
          rewards: [
            { type: "currency" as const, quantity: 2000, itemId: "gems" },
            { type: "currency" as const, quantity: 10, itemId: "tickets" }
          ]
        }
      ]
    },
    
    // Assets visuels
    bannerImage: "https://cdn.placeholder.com/banners/standard_summon.png",
    iconImage: "https://cdn.placeholder.com/icons/standard_summon_icon.png",
    backgroundMusic: "https://cdn.placeholder.com/audio/standard_theme.mp3",
    animationType: "standard" as const,
    
    // Stats initiales
    stats: {
      totalPulls: 0,
      totalPlayers: 0,
      averagePullsPerPlayer: 0,
      legendaryCount: 0,
      epicCount: 0
    },
    
    // Tags et métadonnées
    tags: ["permanent", "all-heroes", "standard"],
    category: "Character" as const
  };
};

// ============================================================================
// 3. LIMITED BANNER - Focus Aureon avec rate-up
// ============================================================================
const createLimitedBanner = () => {
  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  
  return {
    bannerId: "divine_guardian_rateup_001",
    name: "Divine Guardian Rate-Up",
    type: "Limited" as const,
    description: "Limited-time banner featuring AUREON, the legendary Light Tank! Increased drop rates and guaranteed on your first Legendary pull. Available for 14 days only!",
    
    // Timing - LIMITÉ à 14 jours
    startTime: now,
    endTime: twoWeeksLater,
    timezone: "UTC",
    
    // Configuration serveur - TOUS les serveurs
    serverConfig: {
      allowedServers: ["ALL"],
      region: ["GLOBAL"]
    },
    
    // Visibilité
    isActive: true,
    isVisible: true,
    sortOrder: 200, // Priorité maximale (au-dessus de tout)
    
    // Pool complet MAIS avec focus
    heroPool: {
      includeAll: true,
      specificHeroes: [],
      excludedHeroes: [],
      rarityFilters: []
    },
    
    // FOCUS sur Aureon - Rate-up massif
    focusHeroes: [
      {
        heroId: "Aureon",  // Light Tank Legendary
        rateUpMultiplier: 2.5,  // Taux x2.5
        guaranteed: true        // Garanti au premier Legendary du pity
      }
    ],
    
    // Taux modifiés pour favoriser les hautes raretés
    rates: {
      Common: 40,     // Réduit
      Rare: 35,       // Augmenté
      Epic: 20,       // Augmenté
      Legendary: 5,   // Standard (mais 50% de chance d'être Aureon)
      focusRateUp: 50 // 50% des Legendary seront Aureon
    },
    
    // Coûts standards (pas de réduction sur limited)
    costs: {
      singlePull: {
        gems: 300,
        tickets: 1
      },
      multiPull: {
        gems: 2700
      },
      firstPullDiscount: {
        gems: 200  // Petite réduction sur premier pull
      }
    },
    
    // Pity system standard mais compteur indépendant
    pityConfig: {
      legendaryPity: 90,
      epicPity: 10,
      sharedPity: false,      // Compteur séparé de Standard
      resetOnBannerEnd: true  // Reset quand bannière expire
    },
    
    // Pas de limites - Encourage le whaling
    limits: {
      maxPullsPerPlayer: -1,
      maxPullsPerDay: -1,
      firstTimePullBonus: true
    },
    
    // Récompenses généreuses par paliers
    bonusRewards: {
      milestones: [
        {
          pullCount: 10,
          rewards: [
            { type: "currency" as const, quantity: 100, itemId: "gems" }
          ]
        },
        {
          pullCount: 30,
          rewards: [
            { type: "currency" as const, quantity: 300, itemId: "gems" },
            { type: "currency" as const, quantity: 3, itemId: "tickets" }
          ]
        },
        {
          pullCount: 50,
          rewards: [
            { type: "currency" as const, quantity: 500, itemId: "gems" },
            { type: "material" as const, quantity: 1, itemId: "epic_fragment" }
          ]
        },
        {
          pullCount: 100,
          rewards: [
            { type: "currency" as const, quantity: 1000, itemId: "gems" },
            { type: "currency" as const, quantity: 10, itemId: "tickets" }
            // + Legendary garanti grâce au pity
          ]
        }
      ]
    },
    
    // Assets visuels - Thème Aureon
    bannerImage: "https://cdn.placeholder.com/banners/divine_guardian_aureon.png",
    iconImage: "https://cdn.placeholder.com/icons/divine_guardian_icon.png",
    backgroundMusic: "https://cdn.placeholder.com/audio/divine_theme.mp3",
    animationType: "rainbow" as const,  // Animation spéciale
    
    // Stats initiales
    stats: {
      totalPulls: 0,
      totalPlayers: 0,
      averagePullsPerPlayer: 0,
      legendaryCount: 0,
      epicCount: 0
    },
    
    // Tags et métadonnées
    tags: ["limited", "rate-up", "aureon", "light-element", "tank", "event"],
    category: "Character" as const
  };
};

// ============================================================================
// FONCTION PRINCIPALE DE SEED
// ============================================================================
const seedBanners = async (): Promise<void> => {
  try {
    console.log("🎰 Starting banner seeding...\n");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Supprimer les bannières existantes
    const deletedCount = await Banner.deleteMany({});
    console.log(`🗑️  Cleared ${deletedCount.deletedCount} existing banners\n`);

    // Créer les 3 bannières
    console.log("📦 Creating banners...\n");

    // 1. Beginner Banner
    const beginnerBanner = await Banner.create(createBeginnerBanner());
    console.log("✅ BEGINNER BANNER created:");
    console.log(`   📛 ID: ${beginnerBanner.bannerId}`);
    console.log(`   📛 Name: ${beginnerBanner.name}`);
    console.log(`   🎯 Pool: ${beginnerBanner.heroPool.specificHeroes?.length || 0} specific heroes`);
    console.log(`   💎 Costs: ${beginnerBanner.costs.singlePull.gems} gems (single) / ${beginnerBanner.costs.multiPull.gems} gems (×10)`);
    console.log(`   🎲 Rates: C:${beginnerBanner.rates.Common}% R:${beginnerBanner.rates.Rare}% E:${beginnerBanner.rates.Epic}% L:${beginnerBanner.rates.Legendary}%`);
    console.log(`   🔒 Limit: ${beginnerBanner.limits.maxPullsPerPlayer} pulls max`);
    console.log(`   ⏰ Duration: Permanent (but limited per player)`);
    console.log("");

    // 2. Standard Banner
    const standardBanner = await Banner.create(createStandardBanner());
    console.log("✅ STANDARD BANNER created:");
    console.log(`   📛 ID: ${standardBanner.bannerId}`);
    console.log(`   📛 Name: ${standardBanner.name}`);
    console.log(`   🎯 Pool: ALL heroes (includeAll: true)`);
    console.log(`   💎 Costs: ${standardBanner.costs.singlePull.gems} gems (single) / ${standardBanner.costs.multiPull.gems} gems (×10)`);
    console.log(`   🎲 Rates: C:${standardBanner.rates.Common}% R:${standardBanner.rates.Rare}% E:${standardBanner.rates.Epic}% L:${standardBanner.rates.Legendary}%`);
    console.log(`   🔒 Limit: Unlimited`);
    console.log(`   ⏰ Duration: Permanent`);
    console.log("");

    // 3. Limited Banner
    const limitedBanner = await Banner.create(createLimitedBanner());
    console.log("✅ LIMITED BANNER created:");
    console.log(`   📛 ID: ${limitedBanner.bannerId}`);
    console.log(`   📛 Name: ${limitedBanner.name}`);
    console.log(`   🎯 Pool: ALL heroes + Focus on ${limitedBanner.focusHeroes[0].heroId}`);
    console.log(`   ⭐ Rate-up: ${limitedBanner.focusHeroes[0].rateUpMultiplier}x multiplier (${limitedBanner.rates.focusRateUp}% of Legendary)`);
    console.log(`   💎 Costs: ${limitedBanner.costs.singlePull.gems} gems (single) / ${limitedBanner.costs.multiPull.gems} gems (×10)`);
    console.log(`   🎲 Rates: C:${limitedBanner.rates.Common}% R:${limitedBanner.rates.Rare}% E:${limitedBanner.rates.Epic}% L:${limitedBanner.rates.Legendary}%`);
    console.log(`   🔒 Limit: Unlimited`);
    console.log(`   ⏰ Duration: 14 days (ends ${limitedBanner.endTime.toLocaleDateString()})`);
    console.log("");

    // Résumé final
    const totalBanners = await Banner.countDocuments();
    console.log("═══════════════════════════════════════════════════════");
    console.log(`🎉 Successfully created ${totalBanners} banners!`);
    console.log("═══════════════════════════════════════════════════════\n");

    // Informations de configuration
    console.log("📋 CONFIGURATION SUMMARY:");
    console.log("   Server: ALL servers (global)");
    console.log("   Database: unity-gacha-game");
    console.log("   Total Heroes Pool: 32 heroes");
    console.log("");

    console.log("🎯 BANNER PRIORITIES (sortOrder):");
    console.log("   1. Divine Guardian Rate-Up (Limited) - 200");
    console.log("   2. Starter's Blessing (Beginner) - 100");
    console.log("   3. Hero Summoning Standard - 50");
    console.log("");

    console.log("💡 NEXT STEPS:");
    console.log("   1. Test banners with: GET /api/gacha/banners");
    console.log("   2. Test pulling with: POST /api/gacha/pull");
    console.log("   3. Check rates with: GET /api/gacha/rates/:bannerId");
    console.log("   4. Update placeholder image URLs in production");
    console.log("");

    console.log("🔗 HERO NAME MAPPING:");
    console.log("   Note: Hero IDs in specificHeroes use hero NAMES, not _id");
    console.log("   The GachaService will resolve names to ObjectIds automatically");
    console.log("");

    console.log("⚠️  IMPORTANT REMINDERS:");
    console.log("   - Beginner banner limited to 60 pulls per player");
    console.log("   - Limited banner expires in 14 days");
    console.log("   - Standard banner is permanent with no limits");
    console.log("   - All banners use shared timezone: UTC");
    console.log("   - Pity counters are independent per banner (sharedPity: false)");
    console.log("");

  } catch (error: any) {
    console.error("❌ Banner seeding failed:", error);
    if (error.errors) {
      console.error("Validation errors:");
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
      });
    }
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Exécuter le seeding si appelé directement
if (require.main === module) {
  seedBanners().then(() => process.exit(0));
}

export { seedBanners };

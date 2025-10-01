// server/src/scripts/configureBannerFreePulls.ts

import mongoose from "mongoose";
import dotenv from "dotenv";
import Banner from "../models/Banner";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

/**
 * Configuration des pulls gratuits par défaut pour chaque type de bannière
 */
const FREE_PULL_CONFIGS = {
  // Bannière Débutante : 1 pull gratuit par jour
  beginner: {
    enabled: true,
    resetType: "daily" as const,
    pullsPerReset: 1,
    requiresAuth: true,
    applyTicketDrops: true
  },
  
  // Bannière Standard : 1 pull gratuit par jour
  standard: {
    enabled: true,
    resetType: "daily" as const,
    pullsPerReset: 1,
    requiresAuth: true,
    applyTicketDrops: true
  },
  
  // Bannière Limitée : 1 pull gratuit par jour (pendant la durée de la bannière)
  limited: {
    enabled: true,
    resetType: "daily" as const,
    pullsPerReset: 1,
    requiresAuth: true,
    applyTicketDrops: true
  },
  
  // Bannières Élémentaires : 1 pull gratuit par semaine
  elemental: {
    enabled: true,
    resetType: "weekly" as const,
    pullsPerReset: 1,
    requiresAuth: true,
    applyTicketDrops: false // Pas de tickets élémentaires sur pulls gratuits élémentaires
  },
  
  // Bannière Mythique : PAS de pulls gratuits (système premium)
  mythic: {
    enabled: false,
    resetType: "never" as const,
    pullsPerReset: 0,
    requiresAuth: true,
    applyTicketDrops: false
  }
};

/**
 * Configurer les pulls gratuits pour toutes les bannières
 */
async function configureBannerFreePulls() {
  try {
    console.log("🎁 Starting banner free pulls configuration...\n");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Récupérer toutes les bannières
    const banners = await Banner.find({});
    
    console.log(`📋 Found ${banners.length} banners to configure\n`);
    console.log("=".repeat(80));

    let configured = 0;
    let skipped = 0;

    for (const banner of banners) {
      console.log(`\n🔮 Configuring: ${banner.name} (${banner.type})`);
      console.log(`   Banner ID: ${banner.bannerId}`);

      // Déterminer la config selon le type
      let config;
      
      if (banner.bannerId.startsWith("beginner_")) {
        config = FREE_PULL_CONFIGS.beginner;
      } else if (banner.bannerId.startsWith("standard_")) {
        config = FREE_PULL_CONFIGS.standard;
      } else if (banner.bannerId.startsWith("limited_")) {
        config = FREE_PULL_CONFIGS.limited;
      } else if (banner.bannerId.startsWith("elemental_")) {
        config = FREE_PULL_CONFIGS.elemental;
      } else if (banner.type === "Mythic") {
        config = FREE_PULL_CONFIGS.mythic;
      } else {
        // Par défaut : Standard
        config = FREE_PULL_CONFIGS.standard;
      }

      // Si déjà configuré, demander confirmation
      if (banner.freePullConfig && banner.freePullConfig.enabled !== undefined) {
        console.log(`   ⚠️  Free pulls already configured:`);
        console.log(`      - Enabled: ${banner.freePullConfig.enabled}`);
        console.log(`      - Reset: ${banner.freePullConfig.resetType}`);
        console.log(`      - Pulls: ${banner.freePullConfig.pullsPerReset}`);
        console.log(`   ⏭️  Skipping (already configured)`);
        skipped++;
        continue;
      }

      // Appliquer la configuration
      banner.freePullConfig = config;
      await banner.save();

      console.log(`   ✅ Configured:`);
      console.log(`      - Enabled: ${config.enabled}`);
      console.log(`      - Reset: ${config.resetType}`);
      console.log(`      - Pulls per reset: ${config.pullsPerReset}`);
      console.log(`      - Apply ticket drops: ${config.applyTicketDrops}`);

      configured++;
    }

    console.log("\n" + "=".repeat(80));
    console.log(`\n✅ Configuration complete!`);
    console.log(`   - Configured: ${configured} banners`);
    console.log(`   - Skipped: ${skipped} banners (already configured)`);
    console.log(`   - Total: ${banners.length} banners\n`);

    // Afficher résumé par type
    console.log("📊 Configuration summary by type:");
    const summary = await Banner.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          enabledCount: {
            $sum: { $cond: ["$freePullConfig.enabled", 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    summary.forEach((item: any) => {
      console.log(`   ${item._id}: ${item.enabledCount}/${item.count} enabled`);
    });

    console.log("\n🎯 Next steps:");
    console.log("   1. Test free pulls: POST /api/gacha/free-pull");
    console.log("   2. Check status: GET /api/gacha/free-pulls/status");
    console.log("   3. Monitor logs for free pull usage");
    console.log("");

  } catch (error: any) {
    console.error("\n❌ Configuration failed:", error.message || error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB\n");
  }
}

/**
 * Reset la configuration des pulls gratuits (pour tests)
 */
async function resetBannerFreePulls() {
  try {
    console.log("🔄 Resetting all banner free pulls configuration...\n");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const result = await Banner.updateMany(
      {},
      { $unset: { freePullConfig: "" } }
    );

    console.log(`✅ Reset ${result.modifiedCount} banners\n`);

  } catch (error: any) {
    console.error("\n❌ Reset failed:", error.message || error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB\n");
  }
}

// Exécuter selon l'argument
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes("--reset")) {
    resetBannerFreePulls().then(() => process.exit(0));
  } else {
    configureBannerFreePulls().then(() => process.exit(0));
  }
}

export { configureBannerFreePulls, resetBannerFreePulls };

// server/src/scripts/configureFreePulls.ts

import mongoose from "mongoose";
import dotenv from "dotenv";
import Banner from "../models/Banner";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

/**
 * Configuration des pulls gratuits par type de bannière
 * Modifie ces valeurs selon tes besoins !
 */
const FREE_PULL_CONFIGS = {
  Standard: {
    enabled: true,              // ✅ Activer
    resetType: "daily" as const,
    pullsPerReset: 1,           // 1 pull gratuit par jour
    applyTicketDrops: true      // Les pulls gratuits peuvent drop des tickets élémentaires
  },
  
  Limited: {
    enabled: false,             // ❌ Désactivé par défaut
    resetType: "daily" as const,
    pullsPerReset: 0,
    applyTicketDrops: true
  },
  
  Beginner: {
    enabled: true,              // ✅ Activer
    resetType: "daily" as const,
    pullsPerReset: 2,           // 2 pulls gratuits par jour pour débutants
    applyTicketDrops: true
  },
  
  Mythic: {
    enabled: false,             // ❌ Désactivé (trop rare)
    resetType: "weekly" as const,
    pullsPerReset: 0,
    applyTicketDrops: false     // Pas de tickets élémentaires sur mythique
  },
  
  Elemental: {
    enabled: true,              // ✅ Activer pour élémentaires
    resetType: "daily" as const,
    pullsPerReset: 1,           // 1 pull gratuit par jour par élément
    applyTicketDrops: false     // Pas de tickets élémentaires (éviter boucle infinie)
  }
};

async function configureFreePulls() {
  try {
    console.log("🎁 Starting free pulls configuration...\n");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Récupérer toutes les bannières
    const banners = await Banner.find({});

    let configured = 0;
    let skipped = 0;

    for (const banner of banners) {
      console.log(`🔮 Configuring: ${banner.name} (${banner.type})`);
      console.log(`   Banner ID: ${banner.bannerId}`);

      // Déterminer la config selon le type
      let config;
      
      if (banner.bannerId.startsWith("elemental_")) {
        config = FREE_PULL_CONFIGS.Elemental;
      } else {
        config = FREE_PULL_CONFIGS[banner.type as keyof typeof FREE_PULL_CONFIGS];
      }

      if (!config) {
        console.log(`   ⚠️  No config found for type ${banner.type}, skipping\n`);
        skipped++;
        continue;
      }

      // Appliquer la configuration
      banner.freePullConfig = {
        enabled: config.enabled,
        resetType: config.resetType,
        pullsPerReset: config.pullsPerReset,
        requiresAuth: true,
        applyTicketDrops: config.applyTicketDrops
      };

      await banner.save();

      console.log(`   ✅ Configured:`);
      console.log(`      - Enabled: ${config.enabled ? "YES" : "NO"}`);
      console.log(`      - Reset: ${config.resetType}`);
      console.log(`      - Pulls: ${config.pullsPerReset}`);
      console.log(`      - Ticket drops: ${config.applyTicketDrops ? "YES" : "NO"}\n`);

      configured++;
    }

    console.log("=" .repeat(80));
    console.log("\n✅ Configuration complete!");
    console.log(`   - Configured: ${configured} banners`);
    console.log(`   - Skipped: ${skipped} banners`);
    console.log(`   - Total: ${banners.length} banners\n`);

    // Résumé par type
    const summary = {
      Standard: 0,
      Limited: 0,
      Beginner: 0,
      Mythic: 0,
      Elemental: 0
    };

    for (const banner of banners) {
      if (banner.freePullConfig?.enabled) {
        if (banner.bannerId.startsWith("elemental_")) {
          summary.Elemental++;
        } else {
          summary[banner.type as keyof typeof summary]++;
        }
      }
    }

    console.log("📊 Enabled free pulls by type:");
    Object.entries(summary).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`   ${type}: ${count} banner(s)`);
      }
    });

    console.log("\n🎯 Next steps:");
    console.log("   1. Test free pulls: POST /api/gacha/free-pull");
    console.log("   2. Check status: GET /api/gacha/free-pulls/status");
    console.log("   3. Players will see free pulls on next login\n");

  } catch (error: any) {
    console.error("\n❌ Configuration failed:", error.message || error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB\n");
  }
}

if (require.main === module) {
  configureFreePulls().then(() => process.exit(0));
}

export { configureFreePulls };

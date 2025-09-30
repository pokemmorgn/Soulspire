import mongoose from "mongoose";
import dotenv from "dotenv";
import Banner from "../models/Banner";  // ✅ Chemin corrigé
import Hero from "../models/Hero";      // ✅ Import Hero aussi

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

/**
 * Script de test pour vérifier que les bannières trouvent bien leurs héros
 * Teste chaque bannière et affiche les héros disponibles
 */

const testBannerHeroes = async (): Promise<void> => {
  try {
    console.log("🧪 Starting banner heroes test...\n");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Récupérer toutes les bannières
    const banners = await Banner.find({}).sort({ sortOrder: -1 });
    
    if (banners.length === 0) {
      console.log("❌ No banners found in database");
      console.log("💡 Run 'npm run seed:banners' first");
      return;
    }

    console.log(`📦 Found ${banners.length} banner(s) to test\n`);
    console.log("═══════════════════════════════════════════════════════\n");

    // Tester chaque bannière
    for (const banner of banners) {
      console.log(`🎰 Testing: ${banner.name}`);
      console.log(`   📛 ID: ${banner.bannerId}`);
      console.log(`   📊 Type: ${banner.type}`);
      console.log(`   🎯 Pool type: ${banner.heroPool.includeAll ? "ALL HEROES" : "SPECIFIC HEROES"}`);
      
      if (!banner.heroPool.includeAll && banner.heroPool.specificHeroes) {
        console.log(`   📝 Specific heroes count: ${banner.heroPool.specificHeroes.length}`);
        console.log(`   📝 Heroes: ${banner.heroPool.specificHeroes.slice(0, 5).join(", ")}${banner.heroPool.specificHeroes.length > 5 ? "..." : ""}`);
      }
      
      if (banner.heroPool.excludedHeroes && banner.heroPool.excludedHeroes.length > 0) {
        console.log(`   🚫 Excluded heroes: ${banner.heroPool.excludedHeroes.length}`);
      }
      
      if (banner.heroPool.rarityFilters && banner.heroPool.rarityFilters.length > 0) {
        console.log(`   ⭐ Rarity filters: ${banner.heroPool.rarityFilters.join(", ")}`);
      }

      // Récupérer les héros disponibles
      console.log(`   🔍 Fetching available heroes...`);
      const startTime = Date.now();
      const heroes = await banner.getAvailableHeroes();
      const fetchTime = Date.now() - startTime;
      
      console.log(`   ✅ Found ${heroes.length} hero(es) in ${fetchTime}ms\n`);

      if (heroes.length === 0) {
        console.log("   ⚠️  WARNING: No heroes found! This banner won't work!\n");
        continue;
      }

      // Statistiques par rareté
      const rarityStats = {
        Common: 0,
        Rare: 0,
        Epic: 0,
        Legendary: 0
      };

      heroes.forEach((hero: any) => {
        if (hero.rarity in rarityStats) {
          rarityStats[hero.rarity as keyof typeof rarityStats]++;
        }
      });

      console.log("   📊 Rarity distribution:");
      console.log(`      - Common: ${rarityStats.Common}`);
      console.log(`      - Rare: ${rarityStats.Rare}`);
      console.log(`      - Epic: ${rarityStats.Epic}`);
      console.log(`      - Legendary: ${rarityStats.Legendary}`);
      console.log("");

      // Statistiques par rôle
      const roleStats: Record<string, number> = {};
      heroes.forEach((hero: any) => {
        roleStats[hero.role] = (roleStats[hero.role] || 0) + 1;
      });

      console.log("   📊 Role distribution:");
      Object.entries(roleStats).forEach(([role, count]) => {
        console.log(`      - ${role}: ${count}`);
      });
      console.log("");

      // Afficher quelques héros exemples
      console.log("   🎭 Sample heroes:");
      const sampleHeroes = heroes.slice(0, 5);
      sampleHeroes.forEach((hero: any) => {
        console.log(`      - ${hero.name} (${hero.rarity} ${hero.role} - ${hero.element})`);
      });
      
      if (heroes.length > 5) {
        console.log(`      ... and ${heroes.length - 5} more`);
      }
      console.log("");

      // Vérifier les héros focus
      if (banner.focusHeroes && banner.focusHeroes.length > 0) {
        console.log("   ⭐ Focus heroes:");
        for (const focusHero of banner.focusHeroes) {
          const hero = heroes.find((h: any) => 
            h._id.toString() === focusHero.heroId || h.name === focusHero.heroId
          );
          
          if (hero) {
            console.log(`      ✅ ${focusHero.heroId} (x${focusHero.rateUpMultiplier} rate-up) - FOUND`);
          } else {
            console.log(`      ❌ ${focusHero.heroId} - NOT FOUND IN POOL!`);
          }
        }
        console.log("");
      }

      // Validation finale
      console.log("   🎯 Validation:");
      
      // Vérifier que le pool respecte les contraintes
      let isValid = true;
      const issues: string[] = [];

      if (heroes.length === 0) {
        isValid = false;
        issues.push("No heroes available");
      }

      // Pour Beginner banner, vérifier qu'on a bien 15 héros
      if (banner.type === "Beginner" && !banner.heroPool.includeAll) {
        const expectedCount = banner.heroPool.specificHeroes?.length || 0;
        if (heroes.length !== expectedCount) {
          isValid = false;
          issues.push(`Expected ${expectedCount} heroes, found ${heroes.length}`);
        }
      }

      // Vérifier que les focus heroes sont dans le pool
      if (banner.focusHeroes && banner.focusHeroes.length > 0) {
        for (const focusHero of banner.focusHeroes) {
          const found = heroes.some((h: any) => 
            h._id.toString() === focusHero.heroId || h.name === focusHero.heroId
          );
          if (!found) {
            isValid = false;
            issues.push(`Focus hero "${focusHero.heroId}" not in pool`);
          }
        }
      }

      if (isValid) {
        console.log("      ✅ All checks passed!");
      } else {
        console.log("      ❌ Issues found:");
        issues.forEach(issue => console.log(`         - ${issue}`));
      }

      console.log("");
      console.log("───────────────────────────────────────────────────────\n");
    }

    // Résumé final
    console.log("═══════════════════════════════════════════════════════");
    console.log("📊 SUMMARY");
    console.log("═══════════════════════════════════════════════════════\n");

    const totalHeroes = await Hero.countDocuments();
    console.log(`Total heroes in database: ${totalHeroes}`);
    console.log(`Total banners tested: ${banners.length}`);
    
    let allValid = true;
    for (const banner of banners) {
      const heroes = await banner.getAvailableHeroes();
      const valid = heroes.length > 0;
      allValid = allValid && valid;
      
      console.log(`  ${valid ? "✅" : "❌"} ${banner.name}: ${heroes.length} heroes`);
    }

    console.log("");
    if (allValid) {
      console.log("🎉 All banners are working correctly!");
    } else {
      console.log("⚠️  Some banners have issues. Check the logs above.");
    }
    console.log("");

  } catch (error: any) {
    console.error("❌ Test failed:", error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Exécuter le test
if (require.main === module) {
  testBannerHeroes().then(() => process.exit(0));
}

export { testBannerHeroes };

// server/src/scripts/testWishlistSystem.ts

import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import Hero from "../models/Hero";
import Banner from "../models/Banner";
import BannerPity from "../models/BannerPity";
import { WishlistService } from "../services/WishlistService";
import { GachaService } from "../services/GachaService";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

async function testWishlistSystem() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    // 1. Créer/récupérer un joueur de test
    let player = await Player.findOne({ displayName: "wishlist_tester" });
    
    if (!player) {
      console.log("❌ Player 'wishlist_tester' not found");
      console.log("Creating test player...\n");
      
      player = new Player({
        displayName: "wishlist_tester",
        accountId: "test_account_wishlist",
        serverId: "S1",
        gems: 100000,
        tickets: 100
      });
      await player.save();
      console.log("✅ Test player created\n");
    }

    console.log(`👤 Player: ${player.displayName} (${player._id})`);
    console.log(`💎 Gems: ${player.gems}`);
    console.log(`🎫 Tickets: ${player.tickets}\n`);

    // 2. Récupérer 4 héros Legendary pour la wishlist
    const legendaries = await Hero.find({ rarity: "Legendary" }).limit(4);
    
    if (legendaries.length < 4) {
      console.log("❌ Not enough Legendary heroes in database");
      console.log("Please run seedHeroes.ts first");
      return;
    }

    console.log("📋 Creating wishlist with 4 Legendary heroes:");
    
    for (const hero of legendaries) {
      const result = await WishlistService.addHeroToWishlist(
        player._id,
        player.serverId,
        hero._id.toString()
      );
      console.log(`   ${result.success ? "✅" : "❌"} ${hero.name} (${hero.element} ${hero.role})`);
    }

    // 3. Vérifier les stats de la wishlist
    console.log("\n📊 Wishlist Stats:");
    const stats = await WishlistService.getWishlistStats(player._id, player.serverId);
    console.log(`   Heroes: ${stats.heroCount}/${stats.maxHeroes}`);
    console.log(`   Pity Counter: ${stats.pityCounter}/${stats.pityThreshold}`);
    console.log(`   Pulls until pity: ${stats.pullsUntilPity}`);

    // 4. Simuler 50 pulls normaux (ne devrait PAS déclencher wishlist pity)
    console.log("\n🎰 Phase 1: Testing 50 normal pulls (no wishlist pity yet)...\n");

    const banner = await Banner.findOne({ type: "Standard" });
    if (!banner) {
      console.log("❌ Standard banner not found. Run seedBanners.ts first");
      return;
    }

    let totalLegendaries = 0;
    let totalSaryel = 0;

    for (let batch = 0; batch < 5; batch++) {
      console.log(`\n--- Batch ${batch + 1}/5 (10 pulls) ---`);
      
      const pullResult = await GachaService.performPullOnBanner(
        player._id,
        player.serverId,
        banner.bannerId,
        10
      );

      const legendaries = pullResult.results.filter((r: any) => r.rarity === "Legendary");
      const wishlistHits = legendaries.filter((r: any) => r.isWishlistPity);
      
      totalLegendaries += legendaries.length;
      
      console.log(`   Legendary: ${legendaries.length}`);
      console.log(`   Wishlist pity: ${wishlistHits.length > 0 ? "✅ YES" : "❌ NO"}`);
      console.log(`   Pity counter: ${pullResult.pityStatus.pullsSinceLegendary}/50`);
      
      if (pullResult.pityStatus.wishlistPityCounter !== undefined) {
        console.log(`   Wishlist pity: ${pullResult.pityStatus.wishlistPityCounter}/100`);
      }

      // Afficher les héros obtenus
      if (legendaries.length > 0) {
        console.log(`   Heroes:`);
        legendaries.forEach((leg: any) => {
          const isInWishlist = legendaries.some((h: any) => 
            stats && legendaries.find(wh => wh._id.toString() === leg.hero._id.toString())
          );
          console.log(`      - ${leg.hero.name} ${leg.isWishlistPity ? "🎯 WISHLIST" : ""}`);
          if (leg.hero.name === "Saryel") totalSaryel++;
        });
      }

      // Attendre un peu entre les batchs
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📈 Phase 1 Summary:`);
    console.log(`   Total pulls: 50`);
    console.log(`   Total Legendary: ${totalLegendaries}`);

    // 5. Forcer le pity wishlist à 99 pour tester le déclenchement
    console.log("\n🔧 Forcing wishlist pity to 99 for testing...");
    
    const wishlist = await WishlistService["getOrCreateWishlist"](player._id, player.serverId);
    wishlist.pityCounter = 99;
    await wishlist.save();
    
    const statsBeforePity = await WishlistService.getWishlistStats(player._id, player.serverId);
    console.log(`✅ Wishlist pity set to: ${statsBeforePity.pityCounter}/100`);

    // 6. Faire 1 pull qui devrait déclencher le wishlist pity
    console.log("\n🎯 Phase 2: Testing wishlist pity trigger (1 pull)...\n");
    
    const pityPullResult = await GachaService.performPullOnBanner(
      player._id,
      player.serverId,
      banner.bannerId,
      1
    );

    const pityHero = pityPullResult.results[0];
    const isWishlistPityTriggered = pityHero.isWishlistPity;
    const isInWishlist = legendaries.some(h => h._id.toString() === pityHero.hero._id.toString());

    console.log("═══════════════════════════════════════");
    console.log("           🎯 WISHLIST PITY RESULT");
    console.log("═══════════════════════════════════════");
    console.log(`Hero obtained: ${pityHero.hero.name}`);
    console.log(`Rarity: ${pityHero.rarity}`);
    console.log(`Is wishlist pity: ${isWishlistPityTriggered ? "✅ YES" : "❌ NO"}`);
    console.log(`Is from wishlist: ${isInWishlist ? "✅ YES" : "❌ NO"}`);
    console.log(`Is new: ${pityHero.isNew ? "✅" : "Duplicate"}`);

    // 7. Vérifier que le pity a été reset
    const statsAfterPity = await WishlistService.getWishlistStats(player._id, player.serverId);
    console.log(`\nWishlist pity after pull: ${statsAfterPity.pityCounter}/100`);
    console.log(`${statsAfterPity.pityCounter === 0 ? "✅ Pity correctly reset" : "❌ ERROR: Pity not reset!"}`);

    // 8. Résumé final
    console.log("\n═══════════════════════════════════════");
    console.log("           📊 FINAL SUMMARY");
    console.log("═══════════════════════════════════════");
    console.log(`Total pulls: 51`);
    console.log(`Total Legendary: ${totalLegendaries + 1}`);
    console.log(`Wishlist heroes:`);
    legendaries.forEach(h => console.log(`   - ${h.name}`));
    console.log(`\nWishlist pity triggered: ${isWishlistPityTriggered ? "✅ YES" : "❌ NO"}`);
    console.log(`Hero from wishlist: ${isInWishlist ? "✅ YES" : "❌ NO"}`);
    
    if (isWishlistPityTriggered && isInWishlist) {
      console.log("\n🎉 SUCCESS: Wishlist system working perfectly!");
    } else if (isWishlistPityTriggered && !isInWishlist) {
      console.log("\n⚠️ WARNING: Pity triggered but hero not from wishlist");
    } else {
      console.log("\n❌ ERROR: Wishlist pity did not trigger");
    }

    // 9. Afficher l'état final du joueur
    const finalPlayer = await Player.findOne({ _id: player._id });
    console.log("\n💰 Final Resources:");
    console.log(`   Gems: ${finalPlayer!.gems}`);
    console.log(`   Tickets: ${finalPlayer!.tickets}`);
    console.log(`   Total heroes: ${finalPlayer!.heroes.length}`);

  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

testWishlistSystem().then(() => process.exit(0));

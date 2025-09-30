// server/src/scripts/testDailyRewards.ts

import mongoose from "mongoose";
import dotenv from "dotenv";
import { DailyRewardsService } from "../services/DailyRewardsService";
import DailyRewards from "../models/DailyRewards";
import Player from "../models/Player";
import { validateDailyRewardsConfig, DAILY_REWARDS_CONFIG } from "../config/DailyRewardsConfig";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

console.log("🧪 TEST DAILY REWARDS SYSTEM\n");
console.log("=".repeat(70));

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connecté\n");
  } catch (error) {
    console.error("❌ Erreur connexion MongoDB:", error);
    process.exit(1);
  }
}

async function testConfigValidation() {
  console.log("📋 TEST 1: Validation de la configuration\n");
  
  const validation = validateDailyRewardsConfig();
  
  if (validation.valid) {
    console.log("✅ Configuration valide !");
    console.log(`   • ${DAILY_REWARDS_CONFIG.cycleDays} jours configurés`);
    console.log(`   • Streak reset après ${DAILY_REWARDS_CONFIG.streakResetAfterMissedDays} jours ratés`);
    console.log(`   • Bonus VIP: +${DAILY_REWARDS_CONFIG.vipBonusPerLevel * 100}% par niveau`);
  } else {
    console.log("❌ Configuration invalide :");
    validation.errors.forEach(err => console.log(`   • ${err}`));
    process.exit(1);
  }
  
  console.log("\n" + "=".repeat(70) + "\n");
}

async function testPlayerCreationAndFirstClaim() {
  console.log("📋 TEST 2: Création joueur et premier claim\n");
  
  try {
    // Créer un joueur de test
    let testPlayer = await Player.findOne({ username: "test_daily_rewards" });
    
    if (!testPlayer) {
      testPlayer = new Player({
        username: "test_daily_rewards",
        displayName: "Test Daily Rewards",
        email: "test@dailyrewards.com",
        passwordHash: "test123",
        serverId: "S1",
        level: 1,
        gold: 1000,
        gems: 100,
        tickets: 5
      });
      await testPlayer.save();
      console.log("✅ Joueur de test créé");
    } else {
      console.log("✅ Joueur de test existant trouvé");
    }
    
    console.log(`   • ID: ${testPlayer._id}`);
    console.log(`   • Nom: ${testPlayer.displayName}`);
    console.log(`   • Or initial: ${testPlayer.gold}`);
    console.log(`   • Gemmes initiales: ${testPlayer.gems}`);
    
    // Tester le statut avant claim
    console.log("\n🔍 Récupération du statut...");
    const statusBefore = await DailyRewardsService.getDailyRewardStatus(testPlayer._id, "S1");
    
    if (statusBefore.success && statusBefore.status) {
      console.log("✅ Statut récupéré !");
      console.log(`   • Peut claim: ${statusBefore.status.canClaim}`);
      console.log(`   • Jour actuel: ${statusBefore.status.currentDay}`);
      console.log(`   • Streak actuel: ${statusBefore.status.currentStreak}`);
      console.log(`   • Valeur estimée: ${statusBefore.nextReward?.estimatedValue || 0}`);
    } else {
      console.log("❌ Erreur récupération statut:", statusBefore.error);
    }
    
    // Tester le claim
    console.log("\n🎁 Tentative de claim...");
    const claimResult = await DailyRewardsService.claimDailyReward(testPlayer._id, "S1");
    
    if (claimResult.success && claimResult.claim) {
      console.log("✅ Récompense réclamée avec succès !");
      console.log(`   • Jour réclamé: ${claimResult.claim.day}`);
      console.log(`   • Streak: ${claimResult.streakInfo?.currentStreak}`);
      console.log(`   • Valeur totale: ${claimResult.claim.totalValue}`);
      console.log(`   • Bonus VIP: x${claimResult.claim.vipBonus.toFixed(2)}`);
      console.log(`   • Bonus Streak: x${claimResult.claim.streakBonus.toFixed(2)}`);
      
      if (claimResult.appliedRewards) {
        console.log("\n   Récompenses appliquées:");
        console.log(`   • Or: +${claimResult.appliedRewards.gold}`);
        console.log(`   • Gemmes: +${claimResult.appliedRewards.gems}`);
        console.log(`   • Tickets: +${claimResult.appliedRewards.tickets}`);
        if (claimResult.appliedRewards.items.length > 0) {
          console.log(`   • Items: ${claimResult.appliedRewards.items.length} objets`);
        }
      }
    } else {
      console.log("❌ Erreur claim:", claimResult.error);
    }
    
    // Vérifier les ressources après claim
    const playerAfter = await Player.findById(testPlayer._id);
    if (playerAfter) {
      console.log("\n💰 Ressources après claim:");
      console.log(`   • Or: ${testPlayer.gold} → ${playerAfter.gold} (+${playerAfter.gold - testPlayer.gold})`);
      console.log(`   • Gemmes: ${testPlayer.gems} → ${playerAfter.gems} (+${playerAfter.gems - testPlayer.gems})`);
      console.log(`   • Tickets: ${testPlayer.tickets} → ${playerAfter.tickets} (+${playerAfter.tickets - testPlayer.tickets})`);
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
    return testPlayer._id;
    
  } catch (error: any) {
    console.error("❌ Erreur test:", error.message);
    console.log("\n" + "=".repeat(70) + "\n");
    return null;
  }
}

async function testPreview(playerId: string) {
  console.log("📋 TEST 3: Preview des prochains jours\n");
  
  try {
    const preview = await DailyRewardsService.getRewardsPreview(playerId, "S1", 7);
    
    if (preview.success && preview.preview) {
      console.log(`✅ Preview de ${preview.preview.length} jours récupéré !\n`);
      
      preview.preview.forEach((day, index) => {
        const icon = day.isSpecial ? "⭐" : "📅";
        console.log(`${icon} Jour ${day.day}: ${day.title}`);
        console.log(`   • Valeur de base: ${day.baseValue}`);
        console.log(`   • Avec bonus VIP: ${day.vipBonusValue}`);
        if (day.streakBonusValue) {
          console.log(`   • Avec bonus Streak: ${day.streakBonusValue}`);
        }
        console.log(`   • Récompenses: ${day.rewards.length} items`);
        if (preview.preview && index < preview.preview.length - 1) console.log("");
      });
    } else {
      console.log("❌ Erreur preview:", preview.error);
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
    
  } catch (error: any) {
    console.error("❌ Erreur test preview:", error.message);
    console.log("\n" + "=".repeat(70) + "\n");
  }
}

async function testDoubleClaimPrevention(playerId: string) {
  console.log("📋 TEST 4: Protection contre double claim\n");
  
  try {
    console.log("🔒 Tentative de claim une 2ème fois aujourd'hui...");
    const claimResult = await DailyRewardsService.claimDailyReward(playerId, "S1");
    
    if (!claimResult.success) {
      console.log("✅ Double claim correctement bloqué !");
      console.log(`   • Erreur: ${claimResult.error}`);
      console.log(`   • Code: ${claimResult.code}`);
    } else {
      console.log("❌ ATTENTION: Double claim autorisé (BUG!)");
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
    
  } catch (error: any) {
    console.error("❌ Erreur test double claim:", error.message);
    console.log("\n" + "=".repeat(70) + "\n");
  }
}

async function testLeaderboard() {
  console.log("📋 TEST 5: Leaderboard des streaks\n");
  
  try {
    const leaderboard = await DailyRewardsService.getStreakLeaderboard("S1", 10);
    
    if (leaderboard.success && leaderboard.leaderboard) {
      console.log(`✅ Leaderboard récupéré (${leaderboard.leaderboard.length} joueurs)\n`);
      
      leaderboard.leaderboard.forEach((entry, index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
        console.log(`${medal} ${entry.playerName} (Lvl ${entry.playerLevel})`);
        console.log(`   • Streak actuel: ${entry.currentStreak} jours`);
        console.log(`   • Record: ${entry.longestStreak} jours`);
        console.log(`   • Claims totaux: ${entry.totalClaims}`);
        if (index < leaderboard.leaderboard.length - 1) console.log("");
      });
    } else {
      console.log("❌ Erreur leaderboard:", leaderboard.error);
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
    
  } catch (error: any) {
    console.error("❌ Erreur test leaderboard:", error.message);
    console.log("\n" + "=".repeat(70) + "\n");
  }
}

async function testGlobalStats() {
  console.log("📋 TEST 6: Statistiques globales\n");
  
  try {
    const stats = await DailyRewardsService.getGlobalStats("S1");
    
    if (stats.success && stats.stats) {
      console.log("✅ Statistiques récupérées !\n");
      console.log(`📊 Statistiques du serveur S1:`);
      console.log(`   • Joueurs totaux: ${stats.stats.totalPlayers}`);
      console.log(`   • Joueurs actifs (7j): ${stats.stats.activePlayers}`);
      console.log(`   • Streak moyen: ${Math.round(stats.stats.avgStreak)} jours`);
      console.log(`   • Streak maximum: ${stats.stats.maxStreak} jours`);
      console.log(`   • Claims totaux: ${stats.stats.totalClaims}`);
      console.log(`   • Valeur totale distribuée: ${stats.stats.totalValue}`);
    } else {
      console.log("❌ Erreur stats:", stats.error);
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
    
  } catch (error: any) {
    console.error("❌ Erreur test stats:", error.message);
    console.log("\n" + "=".repeat(70) + "\n");
  }
}

async function runAllTests() {
  console.log("🚀 DÉMARRAGE DES TESTS DAILY REWARDS\n");
  
  await connectDB();
  await testConfigValidation();
  
  const playerId = await testPlayerCreationAndFirstClaim();
  
  if (playerId) {
    await testPreview(playerId);
    await testDoubleClaimPrevention(playerId);
    await testLeaderboard();
    await testGlobalStats();
  }
  
  console.log("✅ TOUS LES TESTS TERMINÉS !\n");
  console.log("=".repeat(70));
  
  await mongoose.connection.close();
  console.log("\n🔌 Connexion MongoDB fermée");
  process.exit(0);
}

// Exécuter les tests
runAllTests().catch(error => {
  console.error("❌ Erreur fatale:", error);
  process.exit(1);
});

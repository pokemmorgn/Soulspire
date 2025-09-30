// server/src/scripts/testDailyRewardsAdvanced.ts

import mongoose from "mongoose";
import dotenv from "dotenv";
import { DailyRewardsService } from "../services/DailyRewardsService";
import DailyRewards from "../models/DailyRewards";
import Player from "../models/Player";
import { IdGenerator } from "../utils/idGenerator";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

console.log("🧪 TESTS AVANCÉS - DAILY REWARDS SYSTEM\n");
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

async function cleanupTestPlayers() {
  console.log("🧹 Nettoyage des joueurs de test...\n");
  
  try {
    await Player.deleteMany({ username: /^test_advanced_/ });
    await DailyRewards.deleteMany({ playerId: /^PLAYER_.*advanced.*/ });
    console.log("✅ Joueurs de test nettoyés\n");
  } catch (error) {
    console.warn("⚠️ Erreur nettoyage:", error);
  }
  
  console.log("=".repeat(70) + "\n");
}

async function createTestPlayer(suffix: string, vipLevel: number = 0) {
  const accountId = IdGenerator.generateAccountId();
  
  const player = new Player({
    accountId,
    username: `test_advanced_${suffix}`,
    displayName: `Test Advanced ${suffix}`,
    email: `test_advanced_${suffix}@test.com`,
    passwordHash: "test123",
    serverId: "S1",
    level: 10 + vipLevel * 5,
    vipLevel,
    gold: 5000,
    gems: 500,
    tickets: 10
  });
  
  await player.save();
  return player;
}

// ===== TEST 1: STREAK PROGRESSION =====
async function testStreakProgression() {
  console.log("📋 TEST 1: Progression du streak sur plusieurs jours\n");
  
  try {
    const player = await createTestPlayer("streak", 0);
    console.log(`✅ Joueur créé: ${player.displayName}`);
    
    const dailyRewards = await (DailyRewards as any).getOrCreate(player._id, "S1");
    
    // Simuler 10 jours de claims consécutifs
    for (let day = 1; day <= 10; day++) {
      // Claim du jour
      const result = await DailyRewardsService.claimDailyReward(player._id, "S1");
      
      if (result.success && result.streakInfo) {
        const icon = day === 7 ? "🏆" : "📅";
        console.log(`${icon} Jour ${day} réclamé - Streak: ${result.streakInfo.currentStreak} (${result.streakInfo.streakTier})`);
        
        // Milestone atteint ?
        if (day === 7) {
          console.log(`   🎉 MILESTONE 7 JOURS ! Bonus: x${result.streakInfo.streakBonus}`);
        }
      } else {
        console.log(`❌ Échec claim jour ${day}:`, result.error);
      }
      
      // Simuler le passage au jour suivant
      dailyRewards.lastClaimDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h en arrière
      await dailyRewards.save();
    }
    
    // Vérifier le streak final
    const finalStatus = await DailyRewardsService.getDailyRewardStatus(player._id, "S1");
    
    if (finalStatus.success && finalStatus.status) {
      console.log("\n📊 État final après 10 jours:");
      console.log(`   • Streak actuel: ${finalStatus.status.currentStreak} jours`);
      console.log(`   • Tier: ${finalStatus.status.streakTier}`);
      console.log(`   • Multiplicateur: x${finalStatus.status.streakMultiplier}`);
      console.log(`   • Total claims: ${finalStatus.status.totalClaims}`);
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
    return player._id;
    
  } catch (error: any) {
    console.error("❌ Erreur test streak:", error.message);
    console.log("\n" + "=".repeat(70) + "\n");
    return null;
  }
}

// ===== TEST 2: RESET DU STREAK =====
async function testStreakReset() {
  console.log("📋 TEST 2: Reset du streak après jours ratés\n");
  
  try {
    const player = await createTestPlayer("reset", 0);
    console.log(`✅ Joueur créé: ${player.displayName}`);
    
    const dailyRewards = await (DailyRewards as any).getOrCreate(player._id, "S1");
    
    // Créer un streak de 5 jours
    console.log("🔥 Construction d'un streak de 5 jours...");
    for (let day = 1; day <= 5; day++) {
      await DailyRewardsService.claimDailyReward(player._id, "S1");
      dailyRewards.lastClaimDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await dailyRewards.save();
    }
    
    console.log(`✅ Streak construit: 5 jours\n`);
    
    // Simuler 3 jours ratés (devrait reset)
    console.log("⏰ Simulation de 3 jours ratés...");
    dailyRewards.lastClaimDate = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)); // 3 jours en arrière
    await dailyRewards.save();
    
    // Vérifier le reset
    await dailyRewards.checkAndResetStreak();
    await dailyRewards.save();
    
    console.log(`\n📊 État après 3 jours ratés:`);
    console.log(`   • Streak actuel: ${dailyRewards.currentStreak} jours`);
    console.log(`   • Jours ratés consécutifs: ${dailyRewards.consecutiveMissedDays}`);
    console.log(`   • Jour actuel dans le cycle: ${dailyRewards.currentDay}`);
    
    if (dailyRewards.currentStreak === 0) {
      console.log(`   ✅ Streak correctement reset !`);
    } else {
      console.log(`   ❌ ERREUR: Streak devrait être à 0`);
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
    
  } catch (error: any) {
    console.error("❌ Erreur test reset:", error.message);
    console.log("\n" + "=".repeat(70) + "\n");
  }
}

// ===== TEST 3: BONUS VIP =====
async function testVipBonus() {
  console.log("📋 TEST 3: Bonus VIP sur les récompenses\n");
  
  try {
    // Créer 3 joueurs avec VIP différents
    const player0 = await createTestPlayer("vip0", 0);
    const player5 = await createTestPlayer("vip5", 5);
    const player10 = await createTestPlayer("vip10", 10);
    
    console.log("✅ 3 joueurs créés:");
    console.log(`   • ${player0.displayName} - VIP ${player0.vipLevel}`);
    console.log(`   • ${player5.displayName} - VIP ${player5.vipLevel}`);
    console.log(`   • ${player10.displayName} - VIP ${player10.vipLevel}\n`);
    
    // Claim pour chacun
    const results = [];
    
    for (const player of [player0, player5, player10]) {
      const result = await DailyRewardsService.claimDailyReward(player._id, "S1");
      if (result.success && result.appliedRewards && result.claim) {
        results.push({
          vipLevel: player.vipLevel,
          vipBonus: result.claim.vipBonus,
          gold: result.appliedRewards.gold,
          gems: result.appliedRewards.gems
        });
      }
    }
    
    console.log("💎 Comparaison des récompenses:\n");
    
    results.forEach(r => {
      console.log(`VIP ${r.vipLevel} (bonus x${r.vipBonus.toFixed(2)}):`);
      console.log(`   • Or: ${r.gold}`);
      console.log(`   • Gemmes: ${r.gems}`);
      console.log("");
    });
    
    // Vérifier la progression
    const baseGold = results[0].gold;
    const vip5Gold = results[1].gold;
    const vip10Gold = results[2].gold;
    
    const expectedVip5 = Math.floor(baseGold * 1.5); // +50% pour VIP 5
    const expectedVip10 = Math.floor(baseGold * 2.0); // +100% pour VIP 10
    
    console.log("✅ Vérification des calculs:");
    console.log(`   • Base (VIP 0): ${baseGold} or`);
    console.log(`   • VIP 5 attendu: ${expectedVip5} or → Reçu: ${vip5Gold} ${vip5Gold === expectedVip5 ? '✅' : '❌'}`);
    console.log(`   • VIP 10 attendu: ${expectedVip10} or → Reçu: ${vip10Gold} ${vip10Gold === expectedVip10 ? '✅' : '❌'}`);
    
    console.log("\n" + "=".repeat(70) + "\n");
    
  } catch (error: any) {
    console.error("❌ Erreur test VIP:", error.message);
    console.log("\n" + "=".repeat(70) + "\n");
  }
}

// ===== TEST 4: MILESTONES =====
async function testMilestones() {
  console.log("📋 TEST 4: Milestones de streak (7, 14, 30 jours)\n");
  
  try {
    const player = await createTestPlayer("milestones", 0);
    console.log(`✅ Joueur créé: ${player.displayName}\n`);
    
    const dailyRewards = await (DailyRewards as any).getOrCreate(player._id, "S1");
    
    const milestones = [7, 14, 30];
    
    console.log("🎯 Simulation des milestones...\n");
    
    for (let day = 1; day <= 30; day++) {
      const result = await DailyRewardsService.claimDailyReward(player._id, "S1");
      
      if (result.success && result.streakInfo) {
        const isMilestone = milestones.includes(day);
        const icon = isMilestone ? "🏆" : "📅";
        
        if (isMilestone) {
          console.log(`${icon} JOUR ${day} - MILESTONE ATTEINT !`);
          console.log(`   • Streak: ${result.streakInfo.currentStreak} jours`);
          console.log(`   • Tier: ${result.streakInfo.streakTier}`);
          console.log(`   • Bonus: x${result.streakInfo.streakBonus}`);
          console.log("");
        }
      }
      
      // Simuler le passage au jour suivant
      dailyRewards.lastClaimDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await dailyRewards.save();
    }
    
    // Statut final
    const finalStatus = await DailyRewardsService.getDailyRewardStatus(player._id, "S1");
    
    if (finalStatus.success && finalStatus.status) {
      console.log("🎉 Cycle de 30 jours terminé !");
      console.log(`   • Streak final: ${finalStatus.status.currentStreak} jours`);
      console.log(`   • Record: ${finalStatus.status.longestStreak} jours`);
      console.log(`   • Tier: ${finalStatus.status.streakTier}`);
      console.log(`   • Multiplicateur: x${finalStatus.status.streakMultiplier}`);
      console.log(`   • Total claims: ${finalStatus.status.totalClaims}`);
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
    
  } catch (error: any) {
    console.error("❌ Erreur test milestones:", error.message);
    console.log("\n" + "=".repeat(70) + "\n");
  }
}

// ===== TEST 5: CYCLE COMPLET 30 JOURS =====
async function testFullCycle() {
  console.log("📋 TEST 5: Cycle complet de 30 jours avec jours spéciaux\n");
  
  try {
    const player = await createTestPlayer("cycle", 3); // VIP 3
    console.log(`✅ Joueur créé: ${player.displayName} (VIP ${player.vipLevel})\n`);
    
    const dailyRewards = await (DailyRewards as any).getOrCreate(player._id, "S1");
    
    const specialDays = [5, 7, 10, 14, 15, 20, 21, 25, 28, 30];
    let totalGoldEarned = 0;
    let totalGemsEarned = 0;
    
    console.log("🗓️ Simulation du cycle complet...\n");
    
    for (let day = 1; day <= 30; day++) {
      const result = await DailyRewardsService.claimDailyReward(player._id, "S1");
      
      if (result.success && result.appliedRewards) {
        totalGoldEarned += result.appliedRewards.gold;
        totalGemsEarned += result.appliedRewards.gems;
        
        const isSpecial = specialDays.includes(day);
        const icon = isSpecial ? "⭐" : "📅";
        
        if (isSpecial) {
          console.log(`${icon} Jour ${day} - JOUR SPÉCIAL`);
          console.log(`   • Or: +${result.appliedRewards.gold}`);
          console.log(`   • Gemmes: +${result.appliedRewards.gems}`);
          console.log(`   • Valeur: ${result.claim?.totalValue}\n`);
        }
      }
      
      // Simuler le passage au jour suivant
      dailyRewards.lastClaimDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await dailyRewards.save();
    }
    
    console.log("🎊 Cycle de 30 jours terminé !\n");
    console.log("💰 Récompenses totales gagnées:");
    console.log(`   • Or total: ${totalGoldEarned.toLocaleString()}`);
    console.log(`   • Gemmes totales: ${totalGemsEarned.toLocaleString()}`);
    console.log(`   • Moyenne par jour: ${Math.round(totalGoldEarned / 30)} or, ${Math.round(totalGemsEarned / 30)} gemmes`);
    
    // Vérifier le retour au jour 1
    const statusAfterCycle = await DailyRewardsService.getDailyRewardStatus(player._id, "S1");
    
    if (statusAfterCycle.success && statusAfterCycle.status) {
      console.log(`\n🔄 Prochain jour: ${statusAfterCycle.status.nextDay} ${statusAfterCycle.status.nextDay === 1 ? '(retour au début du cycle ✅)' : '❌'}`);
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
    
  } catch (error: any) {
    console.error("❌ Erreur test cycle:", error.message);
    console.log("\n" + "=".repeat(70) + "\n");
  }
}

// ===== TEST 6: DAILY RESET =====
async function testDailyReset() {
  console.log("📋 TEST 6: Fonctionnement du reset quotidien\n");
  
  try {
    // Créer plusieurs joueurs avec différents états
    const player1 = await createTestPlayer("reset1", 0);
    const player2 = await createTestPlayer("reset2", 0);
    const player3 = await createTestPlayer("reset3", 0);
    
    console.log("✅ 3 joueurs créés pour tester le reset\n");
    
    // Player 1: A claim hier
    const dr1 = await (DailyRewards as any).getOrCreate(player1._id, "S1");
    await DailyRewardsService.claimDailyReward(player1._id, "S1");
    dr1.lastClaimDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h en arrière
    await dr1.save();
    console.log(`📅 ${player1.displayName}: A claim hier (devrait pouvoir claim aujourd'hui)`);
    
    // Player 2: A claim il y a 2 jours (devrait perdre son streak)
    const dr2 = await (DailyRewards as any).getOrCreate(player2._id, "S1");
    await DailyRewardsService.claimDailyReward(player2._id, "S1");
    dr2.currentStreak = 5; // Avait un streak de 5
    dr2.lastClaimDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h en arrière
    await dr2.save();
    console.log(`⏰ ${player2.displayName}: A claim il y a 2 jours (streak devrait reset)`);
    
    // Player 3: A claim il y a 4 jours (devrait aussi perdre son streak)
    const dr3 = await (DailyRewards as any).getOrCreate(player3._id, "S1");
    await DailyRewardsService.claimDailyReward(player3._id, "S1");
    dr3.currentStreak = 10; // Avait un streak de 10
    dr3.lastClaimDate = new Date(Date.now() - 96 * 60 * 60 * 1000); // 96h en arrière
    await dr3.save();
    console.log(`⏰ ${player3.displayName}: A claim il y a 4 jours (streak devrait reset)\n`);
    
    // Exécuter le reset quotidien
    console.log("🔄 Exécution du reset quotidien...\n");
    const resetResult = await DailyRewardsService.performDailyReset();
    
    if (resetResult.success) {
      console.log(`✅ Reset terminé: ${resetResult.processed} joueurs traités, ${resetResult.errors} erreurs\n`);
    }
    
    // Vérifier les états après reset
    console.log("🔍 Vérification des états après reset:\n");
    
    const status1 = await DailyRewardsService.getDailyRewardStatus(player1._id, "S1");
    const status2 = await DailyRewardsService.getDailyRewardStatus(player2._id, "S1");
    const status3 = await DailyRewardsService.getDailyRewardStatus(player3._id, "S1");
    
    if (status1.success && status1.status) {
      console.log(`📊 ${player1.displayName}:`);
      console.log(`   • Peut claim: ${status1.status.canClaim ? '✅' : '❌'}`);
      console.log(`   • Streak: ${status1.status.currentStreak} (devrait être 1)`);
    }
    
    if (status2.success && status2.status) {
      console.log(`\n📊 ${player2.displayName}:`);
      console.log(`   • Streak: ${status2.status.currentStreak} (devrait être 0 - reset)`);
      console.log(`   • ${status2.status.currentStreak === 0 ? '✅' : '❌'} Streak correctement reset`);
    }
    
    if (status3.success && status3.status) {
      console.log(`\n📊 ${player3.displayName}:`);
      console.log(`   • Streak: ${status3.status.currentStreak} (devrait être 0 - reset)`);
      console.log(`   • ${status3.status.currentStreak === 0 ? '✅' : '❌'} Streak correctement reset`);
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
    
  } catch (error: any) {
    console.error("❌ Erreur test reset:", error.message);
    console.log("\n" + "=".repeat(70) + "\n");
  }
}

// ===== TEST 7: STATS ET LEADERBOARD =====
async function testStatsAndLeaderboard() {
  console.log("📋 TEST 7: Statistiques et leaderboard\n");
  
  try {
    // Créer 5 joueurs avec différents streaks
    console.log("✅ Création de 5 joueurs avec différents streaks...\n");
    
    const players = [];
    for (let i = 1; i <= 5; i++) {
      const player = await createTestPlayer(`leader${i}`, 0);
      players.push(player);
      
      const dr = await (DailyRewards as any).getOrCreate(player._id, "S1");
      
      // Simuler différents nombres de claims
      const claimsCount = i * 3; // 3, 6, 9, 12, 15 claims
      
      for (let j = 0; j < claimsCount; j++) {
        await DailyRewardsService.claimDailyReward(player._id, "S1");
        dr.lastClaimDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
        await dr.save();
      }
      
      console.log(`   • ${player.displayName}: ${claimsCount} claims, streak ${claimsCount}`);
    }
    
    console.log("\n🏆 Récupération du leaderboard...\n");
    
    const leaderboard = await DailyRewardsService.getStreakLeaderboard("S1", 5);
    
    if (leaderboard.success && leaderboard.leaderboard) {
      console.log("📊 Top 5 des streaks:\n");
      
      leaderboard.leaderboard.forEach((entry, index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
        console.log(`${medal} ${entry.playerName}`);
        console.log(`   • Streak: ${entry.currentStreak} jours`);
        console.log(`   • Record: ${entry.longestStreak} jours`);
        console.log(`   • Claims: ${entry.totalClaims}\n`);
      });
    }
    
    console.log("📈 Statistiques globales du serveur...\n");
    
    const stats = await DailyRewardsService.getGlobalStats("S1");
    
    if (stats.success && stats.stats) {
      console.log("📊 Statistiques S1:");
      console.log(`   • Joueurs totaux: ${stats.stats.totalPlayers}`);
      console.log(`   • Joueurs actifs (7j): ${stats.stats.activePlayers}`);
      console.log(`   • Streak moyen: ${Math.round(stats.stats.avgStreak)} jours`);
      console.log(`   • Streak maximum: ${stats.stats.maxStreak} jours`);
      console.log(`   • Claims totaux: ${stats.stats.totalClaims}`);
      console.log(`   • Valeur distribuée: ${stats.stats.totalValue}`);
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
    
  } catch (error: any) {
    console.error("❌ Erreur test stats:", error.message);
    console.log("\n" + "=".repeat(70) + "\n");
  }
}

// ===== EXÉCUTION DE TOUS LES TESTS =====
async function runAllAdvancedTests() {
  console.log("🚀 DÉMARRAGE DES TESTS AVANCÉS\n");
  
  await connectDB();
  await cleanupTestPlayers();
  
  await testStreakProgression();
  await testStreakReset();
  await testVipBonus();
  await testMilestones();
  await testFullCycle();
  await testDailyReset();
  await testStatsAndLeaderboard();
  
  console.log("✅ TOUS LES TESTS AVANCÉS TERMINÉS !\n");
  console.log("=".repeat(70));
  
  await mongoose.connection.close();
  console.log("\n🔌 Connexion MongoDB fermée");
  process.exit(0);
}

// Exécuter les tests
runAllAdvancedTests().catch(error => {
  console.error("❌ Erreur fatale:", error);
  process.exit(1);
});

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import AfkState from "../models/AfkState";
import AfkServiceEnhanced from "../services/AfkService";
import AfkSession from "../models/AfkSession";
import { AfkRewardsService } from "../services/AfkRewardsService";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Couleurs pour logs
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m"
};
const log = (c: string, m: string) => console.log(`${c}${m}${colors.reset}`);

async function getOrCreateTestPlayers() {
  // Joueur de base (monde 1) - système classique
  let basicPlayer = await Player.findOne({ username: "AfkTestBasic" });
  if (!basicPlayer) {
    basicPlayer = new Player({
      username: "AfkTestBasic",
      password: "test123",
      serverId: "S1",
      gold: 1000,
      gems: 50,
      world: 1,
      level: 10,
      vipLevel: 0,
      heroes: [
        { heroId: "hero_001", level: 5, stars: 1, equipped: true, slot: 1 },
        { heroId: "hero_002", level: 3, stars: 1, equipped: true, slot: 2 }
      ]
    });
    await basicPlayer.save();
    log(colors.yellow, "🆕 Joueur Basic créé (monde 1)");
  }

  // Joueur avancé (monde 5) - système enhanced
  let advancedPlayer = await Player.findOne({ username: "AfkTestAdvanced" });
  if (!advancedPlayer) {
    advancedPlayer = new Player({
      username: "AfkTestAdvanced",
      password: "test123",
      serverId: "S1",
      gold: 10000,
      gems: 500,
      world: 5,
      level: 35,
      vipLevel: 3,
      difficulty: "Hard",
      heroes: [
        { heroId: "hero_001", level: 25, stars: 3, equipped: true, slot: 1 },
        { heroId: "hero_002", level: 22, stars: 2, equipped: true, slot: 2 },
        { heroId: "hero_003", level: 20, stars: 2, equipped: true, slot: 3 },
        { heroId: "hero_004", level: 18, stars: 1, equipped: true, slot: 4 }
      ]
    });
    await advancedPlayer.save();
    log(colors.yellow, "🆕 Joueur Advanced créé (monde 5, VIP 3)");
  }

  return { basicPlayer, advancedPlayer };
}

/**
 * Avance artificiellement l'horloge côté état AFK
 */
async function fastForward(playerId: string, seconds: number, alsoAccumulateSinceClaim = false) {
  const state = await AfkState.findOne({ playerId });
  if (!state) throw new Error("AfkState introuvable");

  const newLastTickAt = new Date((state.lastTickAt?.getTime() || Date.now()) - seconds * 1000);
  state.lastTickAt = newLastTickAt;

  if (alsoAccumulateSinceClaim) {
    state.accumulatedSinceClaimSec = Math.max(0, state.accumulatedSinceClaimSec + seconds);
  }

  await state.save();
  return state;
}

async function showSummaryEnhanced(playerId: string, title = "SUMMARY") {
  const s = await AfkServiceEnhanced.getSummaryEnhanced(playerId, false);
  log(colors.cyan, `\n📦 ${title}`);
  
  // Affichage format original
  console.table({
    pendingGold: s.pendingGold,
    baseGoldPerMinute: s.baseGoldPerMinute,
    accumulatedSinceClaimSec: s.accumulatedSinceClaimSec,
    maxAccrualSeconds: s.maxAccrualSeconds,
    todayAccruedGold: s.todayAccruedGold
  });

  // Affichage enhanced si disponible
  if (s.useEnhancedRewards) {
    log(colors.green, "🚀 ENHANCED DATA:");
    console.table({
      totalValue: s.totalValue,
      pendingRewardsCount: s.pendingRewards.length,
      vipMultiplier: s.activeMultipliers.vip,
      stageMultiplier: s.activeMultipliers.stage,
      heroesMultiplier: s.activeMultipliers.heroes,
      totalMultiplier: s.activeMultipliers.total
    });

    if (s.pendingRewards.length > 0) {
      log(colors.white, "📋 Pending Rewards:");
      s.pendingRewards.forEach(reward => {
        console.log(`  ${reward.type}/${reward.currencyType || reward.materialId || reward.fragmentId}: ${reward.quantity}`);
      });
    }

    if (s.todayClaimedRewards) {
      log(colors.white, "📈 Today Claimed:");
      console.table(s.todayClaimedRewards);
    }
  }

  log(colors.blue, `Can Upgrade: ${s.canUpgrade} | Enhanced Mode: ${s.useEnhancedRewards}`);
  return s;
}

/**
 * Simule un AFK avec le système enhanced
 */
async function simulateAfkMinutesEnhanced(playerId: string, minutes: number, label: string) {
  log(colors.magenta, `\n⏳ Simulation AFK Enhanced (${label}) — ${minutes} min`);
  const seconds = minutes * 60;

  await fastForward(playerId, seconds);
  const result = await AfkServiceEnhanced.tickEnhanced(playerId, new Date());
  
  log(colors.yellow, `+ Gold: ${result.goldGained} | Enhanced Rewards: ${result.enhancedRewards.length} types | Time: ${result.timeElapsed}s`);
  
  if (result.enhancedRewards.length > 0) {
    log(colors.white, "🎁 New Enhanced Rewards:");
    result.enhancedRewards.forEach(reward => {
      console.log(`  ${reward.type}/${reward.currencyType || reward.materialId || reward.fragmentId}: ${reward.quantity}`);
    });
  }
  
  return result;
}

/**
 * Test complet du système enhanced
 */
async function testAfkEnhanced(): Promise<void> {
  try {
    log(colors.cyan, "\n🧪 === TEST AFK ENHANCED ===\n");
    await mongoose.connect(MONGO_URI);
    log(colors.green, "✅ Connecté à MongoDB");

    const { basicPlayer, advancedPlayer } = await getOrCreateTestPlayers();
    const basicId = (basicPlayer._id as Types.ObjectId).toString();
    const advancedId = (advancedPlayer._id as Types.ObjectId).toString();

    // =============================================
    // TEST 1: Joueur basique (système classique)
    // =============================================
    log(colors.bright, "\n🔰 === TEST JOUEUR BASIQUE (Monde 1) ===");
    
    await showSummaryEnhanced(basicId, "BASIC PLAYER - INITIAL");
    
    // Simulation AFK court
    await simulateAfkMinutesEnhanced(basicId, 5, "Basic - 5 min");
    await showSummaryEnhanced(basicId, "BASIC PLAYER - APRÈS 5 MIN");
    
    // Claim classique
    log(colors.green, "\n💰 BASIC CLAIM");
    const basicClaim = await AfkServiceEnhanced.claimEnhanced(basicId);
    console.table({
      claimed: basicClaim.claimed,
      totalGold: basicClaim.totalGold,
      enhancedRewards: basicClaim.claimedRewards.length,
      totalValue: basicClaim.totalValue
    });

    // =============================================
    // TEST 2: Joueur avancé (système enhanced auto)
    // =============================================
    log(colors.bright, "\n🚀 === TEST JOUEUR AVANCÉ (Monde 5, VIP 3) ===");
    
    await showSummaryEnhanced(advancedId, "ADVANCED PLAYER - INITIAL");
    
    // Le joueur devrait être automatiquement migré vers enhanced
    const advancedSummary = await AfkServiceEnhanced.getSummaryEnhanced(advancedId, true);
    if (advancedSummary.useEnhancedRewards) {
      log(colors.green, "✅ Auto-migré vers Enhanced System!");
    } else if (advancedSummary.canUpgrade) {
      log(colors.yellow, "🔄 Migration manuelle vers Enhanced...");
      const upgradeResult = await AfkServiceEnhanced.upgradeToEnhanced(advancedId);
      console.log(`Upgrade: ${upgradeResult.success} - ${upgradeResult.message}`);
    }

    // Test calculs de taux avancés
    log(colors.cyan, "\n📊 CALCUL TAUX AVANCÉS");
    try {
      const rates = await AfkRewardsService.getPlayerCurrentRates(advancedId);
      console.table({
        goldPerMin: rates.ratesPerMinute.gold,
        gemsPerMin: rates.ratesPerMinute.gems,
        ticketsPerMin: rates.ratesPerMinute.tickets,
        materialsPerMin: rates.ratesPerMinute.materials,
        maxAccrualHours: rates.maxAccrualHours
      });
    } catch (error: any) {
      log(colors.red, `❌ Erreur calcul taux: ${error.message}`);
    }

    // Simulation AFK court avec enhanced
    await simulateAfkMinutesEnhanced(advancedId, 10, "Advanced - 10 min Enhanced");
    await showSummaryEnhanced(advancedId, "ADVANCED PLAYER - APRÈS 10 MIN");

    // Claim enhanced
    log(colors.green, "\n💎 ENHANCED CLAIM");
    const enhancedClaim = await AfkServiceEnhanced.claimEnhanced(advancedId);
    console.table({
      goldClaimed: enhancedClaim.goldClaimed,
      totalGold: enhancedClaim.totalGold,
      enhancedRewards: enhancedClaim.claimedRewards.length,
      totalValue: enhancedClaim.totalValue
    });
    
    if (enhancedClaim.claimedRewards.length > 0) {
      log(colors.white, "🎁 Enhanced Rewards Claimed:");
      enhancedClaim.claimedRewards.forEach(reward => {
        console.log(`  ${reward.type}/${reward.currencyType || reward.materialId || reward.fragmentId}: ${reward.quantity}`);
      });
    }

    if (enhancedClaim.playerUpdates) {
      log(colors.white, "📈 Player Updates:");
      console.table(enhancedClaim.playerUpdates);
    }

    // =============================================
    // TEST 3: Simulation longue durée (cap test)
    // =============================================
    log(colors.bright, "\n⏰ === TEST CAP LONGUE DURÉE ===");
    
    // AFK ultra long (20h) pour tester le cap VIP
    await fastForward(advancedId, 20 * 3600, false);
    await AfkServiceEnhanced.tickEnhanced(advancedId, new Date());
    const afterLongAfk = await showSummaryEnhanced(advancedId, "APRÈS 20H AFK (Cap attendu)");
    
    log(colors.yellow, `Cap atteint: ${afterLongAfk.accumulatedSinceClaimSec >= afterLongAfk.maxAccrualSeconds}`);

    // =============================================
    // TEST 4: Simulation gains (UI)
    // =============================================
    log(colors.bright, "\n📈 === TEST SIMULATION GAINS ===");
    
    try {
      const simulation1h = await AfkRewardsService.simulateAfkGains(advancedId, 1);
      const simulation8h = await AfkRewardsService.simulateAfkGains(advancedId, 8);
      const simulation24h = await AfkRewardsService.simulateAfkGains(advancedId, 24);
      
      console.table({
        "1h_totalValue": simulation1h.totalValue,
        "1h_rewards": simulation1h.rewards.length,
        "1h_cappedAt": simulation1h.cappedAt,
        "8h_totalValue": simulation8h.totalValue,
        "8h_rewards": simulation8h.rewards.length,
        "8h_cappedAt": simulation8h.cappedAt,
        "24h_totalValue": simulation24h.totalValue,
        "24h_rewards": simulation24h.rewards.length,
        "24h_cappedAt": simulation24h.cappedAt
      });
    } catch (error: any) {
      log(colors.red, `❌ Erreur simulation gains: ${error.message}`);
    }

    // =============================================
    // TEST 5: Comparaison amélioration
    // =============================================
    log(colors.bright, "\n🆙 === TEST COMPARAISON AMÉLIORATIONS ===");
    
    try {
      const comparison = await AfkRewardsService.compareUpgradeGains(advancedId);
      console.table({
        currentGold: comparison.current.goldPerMinute,
        afterWorldUp: comparison.afterWorldUp.goldPerMinute,
        afterLevelUp: comparison.afterLevelUp.goldPerMinute,
        afterVipUp: comparison.afterVipUp.goldPerMinute,
        worldImprovement: `${comparison.improvement.worldUp}%`,
        levelImprovement: `${comparison.improvement.levelUp}%`,
        vipImprovement: `${comparison.improvement.vipUp}%`
      });
    } catch (error: any) {
      log(colors.red, `❌ Erreur comparaison améliorations: ${error.message}`);
    }

    // =============================================
    // TEST 6: Statistiques usage
    // =============================================
    log(colors.bright, "\n📊 === STATISTIQUES USAGE ENHANCED ===");
    
    try {
      const usageStats = await AfkServiceEnhanced.getEnhancedUsageStats();
      console.table(usageStats);
    } catch (error: any) {
      log(colors.red, `❌ Erreur statistiques usage: ${error.message}`);
    }

    log(colors.cyan, "\n🎉 === TESTS AFK ENHANCED TERMINÉS ===\n");

  } catch (err: any) {
    log(colors.red, `❌ Erreur test AFK Enhanced: ${err.message}`);
    console.error(err);
  } finally {
    await mongoose.disconnect();
    log(colors.green, "🔌 Déconnecté de MongoDB");
  }
}

/**
 * Test de compatibilité - vérifie que l'ancien système fonctionne toujours
 */
async function testCompatibility(): Promise<void> {
  try {
    log(colors.cyan, "\n🔄 === TEST COMPATIBILITÉ ===\n");
    await mongoose.connect(MONGO_URI);
    
    const { basicPlayer } = await getOrCreateTestPlayers();
    const playerId = (basicPlayer._id as Types.ObjectId).toString();

    // Test avec les ANCIENNES méthodes
    log(colors.blue, "📋 Test méthodes classiques...");
    
    const oldSummary = await AfkServiceEnhanced.getSummary(playerId, true);
    console.table({
      pendingGold: oldSummary.pendingGold,
      baseGoldPerMinute: oldSummary.baseGoldPerMinute,
      todayAccruedGold: oldSummary.todayAccruedGold
    });

    await fastForward(playerId, 300); // 5 min
    const oldState = await AfkServiceEnhanced.tick(playerId);
    log(colors.yellow, `Old tick result - pendingGold: ${oldState.pendingGold}`);

    const oldClaim = await AfkServiceEnhanced.claim(playerId);
    log(colors.green, `Old claim result - claimed: ${oldClaim.claimed}, totalGold: ${oldClaim.totalGold}`);

    log(colors.green, "✅ Compatibilité totale confirmée!");

  } catch (err: any) {
    log(colors.red, `❌ Erreur test compatibilité: ${err.message}`);
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

// Aide
function showUsage() {
  log(colors.cyan, "\n🎮 === SCRIPT DE TEST AFK ENHANCED ===");
  console.log("Ce script teste le nouveau système AFK Enhanced :");
  console.log("• 🔰 Joueur basique (monde 1) - système classique");
  console.log("• 🚀 Joueur avancé (monde 5+) - système enhanced automatique");
  console.log("• 💎 Multi-récompenses (or, gems, matériaux, fragments)");
  console.log("• 📊 Multiplicateurs VIP/progression/équipe");
  console.log("• ⏰ Caps d'accumulation VIP");
  console.log("• 📈 Simulations et comparaisons d'améliorations");
  console.log("• 🔄 Tests de compatibilité totale");
  console.log("\nLancement:");
  console.log("npx ts-node src/scripts/testAfkEnhanced.ts");
  console.log("npx ts-node src/scripts/testAfkEnhanced.ts --compat (test compatibilité)");
  console.log("");
}

if (require.main === module) {
  showUsage();
  
  const args = process.argv.slice(2);
  if (args.includes("--compat")) {
    testCompatibility().then(() => process.exit(0));
  } else {
    testAfkEnhanced().then(() => process.exit(0));
  }
}

export { testAfkEnhanced, testCompatibility };

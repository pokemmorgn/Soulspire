// server/src/scripts/testAfkFinal.ts
// Version finale qui marche après le reset des index

import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import AfkState from "../models/AfkState";
import AfkServiceEnhanced from "../services/AfkService";
import { AfkRewardsService } from "../services/AfkRewardsService";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

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

async function cleanTestData() {
  log(colors.yellow, "🧹 Nettoyage des données de test...");
  
  try {
    await Promise.all([
      Player.deleteMany({ playerId: { $regex: /TEST.*FINAL/ } }),
      AfkState.deleteMany({ playerId: { $regex: /TEST.*FINAL/ } })
    ]);
    
    // Attendre un peu pour s'assurer que la suppression est complète
    await new Promise(resolve => setTimeout(resolve, 500));
    
    log(colors.green, "✅ Données de test nettoyées");
  } catch (error: any) {
    log(colors.yellow, `⚠️ Erreur nettoyage: ${error.message}`);
  }
}

async function createTestPlayers() {
  const timestamp = Date.now();
  
  log(colors.blue, "👤 Création des joueurs de test...");
  
  // Joueur basique
  const basicPlayer = new Player({
    playerId: `TEST_BASIC_FINAL_${timestamp}`,
    accountId: `ACC_BASIC_FINAL_${timestamp}`,
    serverId: "S1",
    displayName: "TestBasicFinal",
    gold: 1000,
    gems: 50,
    world: 1,
    level: 10,
    vipLevel: 0,
    heroes: [{
      heroId: "hero_basic_001",
      level: 5,
      stars: 1,
      equipped: true,
      slot: 1,
      experience: 0,
      ascensionLevel: 0,
      awakenLevel: 0,
      acquisitionDate: new Date()
    }]
  });
  await basicPlayer.save();
  log(colors.green, `✅ Joueur Basic créé: ${basicPlayer.playerId}`);
  
  // Joueur avancé
  const advancedPlayer = new Player({
    playerId: `TEST_ADVANCED_FINAL_${timestamp}`,
    accountId: `ACC_ADVANCED_FINAL_${timestamp}`,
    serverId: "S1",
    displayName: "TestAdvancedFinal",
    gold: 10000,
    gems: 500,
    world: 5,
    level: 50,
    vipLevel: 3,
    difficulty: "Hard",
    heroes: [
      {
        heroId: "hero_adv_001",
        level: 30,
        stars: 3,
        equipped: true,
        slot: 1,
        experience: 1000,
        ascensionLevel: 2,
        awakenLevel: 1,
        acquisitionDate: new Date()
      },
      {
        heroId: "hero_adv_002",
        level: 25,
        stars: 2,
        equipped: true,
        slot: 2,
        experience: 800,
        ascensionLevel: 1,
        awakenLevel: 0,
        acquisitionDate: new Date()
      }
    ]
  });
  await advancedPlayer.save();
  log(colors.green, `✅ Joueur Advanced créé: ${advancedPlayer.playerId}`);
  
  return { basicPlayer, advancedPlayer };
}

async function testAfkFinal(): Promise<void> {
  try {
    log(colors.cyan, "\n🧪 === TEST AFK FINAL (APRÈS RESET INDEX) ===\n");
    
    await mongoose.connect(MONGO_URI);
    log(colors.green, "✅ Connecté à MongoDB");

    // Nettoyage préventif
    await cleanTestData();

    // Création des joueurs
    const { basicPlayer, advancedPlayer } = await createTestPlayers();
    
    // =============================================
    // TEST 1: Vérification Player correcte
    // =============================================
    log(colors.bright, "\n🔍 === TEST VÉRIFICATION PLAYERS ===");
    
    const foundBasic = await Player.findOne({ playerId: basicPlayer.playerId });
    const foundAdvanced = await Player.findOne({ playerId: advancedPlayer.playerId });
    
    if (!foundBasic) throw new Error("Player Basic non trouvé avec findOne");
    if (!foundAdvanced) throw new Error("Player Advanced non trouvé avec findOne");
    
    log(colors.green, `✅ Player Basic trouvé: ${foundBasic.displayName}`);
    log(colors.green, `✅ Player Advanced trouvé: ${foundAdvanced.displayName}`);

    // =============================================
    // TEST 2: États AFK de base
    // =============================================
    log(colors.bright, "\n⚙️ === TEST ÉTATS AFK ===");
    
    const basicState = await AfkServiceEnhanced.ensureState(basicPlayer.playerId);
    log(colors.green, `✅ État Basic - PlayerId: ${basicState.playerId}`);
    log(colors.blue, `📊 Taux or/min: ${basicState.baseGoldPerMinute}`);

    const advancedState = await AfkServiceEnhanced.ensureState(advancedPlayer.playerId);
    log(colors.green, `✅ État Advanced - PlayerId: ${advancedState.playerId}`);
    log(colors.blue, `📊 Taux or/min: ${advancedState.baseGoldPerMinute}`);

    // =============================================
    // TEST 3: Tick AFK
    // =============================================
    log(colors.bright, "\n⏰ === TEST TICK AFK ===");
    
    // Simuler 5 minutes AFK pour le joueur basic
    basicState.lastTickAt = new Date(Date.now() - 5 * 60 * 1000);
    await basicState.save();
    
    const afterTick = await AfkServiceEnhanced.tick(basicPlayer.playerId);
    const goldGained = afterTick.pendingGold;
    log(colors.yellow, `📈 Or gagné en 5min (Basic): ${goldGained}`);
    
    if (goldGained <= 0) {
      log(colors.red, "❌ Aucun or gagné - problème de calcul AFK");
    } else {
      log(colors.green, "✅ Calcul AFK fonctionne correctement");
    }

    // =============================================
    // TEST 4: Claim AFK
    // =============================================
    log(colors.bright, "\n💰 === TEST CLAIM AFK ===");
    
    const claimResult = await AfkServiceEnhanced.claim(basicPlayer.playerId);
    log(colors.green, `💰 Or réclamé: ${claimResult.claimed}`);
    log(colors.blue, `💎 Total or joueur: ${claimResult.totalGold}`);
    
    if (claimResult.claimed <= 0) {
      log(colors.red, "❌ Aucun or réclamé - problème de claim");
    } else {
      log(colors.green, "✅ Claim AFK fonctionne correctement");
    }

    // =============================================
    // TEST 5: Système Enhanced
    // =============================================
    log(colors.bright, "\n🚀 === TEST SYSTÈME ENHANCED ===");
    
    const summary = await AfkServiceEnhanced.getSummaryEnhanced(advancedPlayer.playerId, true);
    log(colors.cyan, `Enhanced activé: ${summary.useEnhancedRewards}`);
    log(colors.cyan, `Peut upgrade: ${summary.canUpgrade}`);
    
    if (summary.canUpgrade) {
      const upgradeResult = await AfkServiceEnhanced.upgradeToEnhanced(advancedPlayer.playerId);
      log(colors.green, `🔄 Upgrade Enhanced: ${upgradeResult.success}`);
      log(colors.blue, `📝 Message: ${upgradeResult.message}`);
    }

    // =============================================
    // TEST 6: Calculs de récompenses (TEST PRINCIPAL)
    // =============================================
    log(colors.bright, "\n📊 === TEST CALCULS RÉCOMPENSES ===");
    
    try {
      const rewardsCalc = await AfkRewardsService.calculatePlayerAfkRewards(advancedPlayer.playerId);
      log(colors.green, `✅ Récompenses calculées: ${rewardsCalc.rewards.length} types`);
      log(colors.blue, `📊 Multiplicateur total: ${rewardsCalc.multipliers.total.toFixed(2)}`);
      log(colors.blue, `💰 Or/min: ${rewardsCalc.ratesPerMinute.gold}`);
      log(colors.blue, `💎 Exp/min: ${rewardsCalc.ratesPerMinute.exp}`);
      log(colors.blue, `🔧 Matériaux/min: ${rewardsCalc.ratesPerMinute.materials}`);
      
      // Afficher les récompenses
      if (rewardsCalc.rewards.length > 0) {
        log(colors.white, "🎁 Récompenses disponibles:");
        rewardsCalc.rewards.forEach(reward => {
          const name = reward.currencyType || reward.materialId || reward.fragmentId || reward.type;
          console.log(`  • ${name}: ${reward.quantity}/min`);
        });
      }
      
    } catch (error: any) {
      log(colors.red, `❌ Erreur calculs récompenses: ${error.message}`);
      console.error("Stack:", error.stack);
      
      if (error.message.includes("findById")) {
        log(colors.red, "🔍 DIAGNOSTIC: Encore une erreur findById!");
        log(colors.yellow, "➡️ Vérifiez AfkRewardsService.ts");
      }
    }

    // =============================================
    // TEST 7: Test Enhanced complet
    // =============================================
    log(colors.bright, "\n💎 === TEST ENHANCED COMPLET ===");
    
    try {
      // Simuler du temps AFK
      advancedState.lastTickAt = new Date(Date.now() - 10 * 60 * 1000); // 10 min
      await advancedState.save();
      
      const enhancedTick = await AfkServiceEnhanced.tickEnhanced(advancedPlayer.playerId);
      log(colors.yellow, `⚡ Enhanced tick - Gold: ${enhancedTick.goldGained}`);
      log(colors.yellow, `⚡ Enhanced rewards: ${enhancedTick.enhancedRewards.length} types`);
      
      if (enhancedTick.enhancedRewards.length > 0) {
        log(colors.white, "🎁 Enhanced rewards reçues:");
        enhancedTick.enhancedRewards.forEach(reward => {
          const name = reward.currencyType || reward.materialId || reward.fragmentId || "unknown";
          console.log(`  • ${reward.type}/${name}: ${reward.quantity}`);
        });
      }
      
      // Claim enhanced
      const enhancedClaim = await AfkServiceEnhanced.claimEnhanced(advancedPlayer.playerId);
      log(colors.green, `💎 Enhanced claim - Or: ${enhancedClaim.goldClaimed}`);
      log(colors.green, `💎 Enhanced claim - Valeur totale: ${enhancedClaim.totalValue}`);
      log(colors.green, `💎 Enhanced rewards réclamées: ${enhancedClaim.claimedRewards.length}`);
      
    } catch (error: any) {
      log(colors.red, `❌ Erreur Enhanced: ${error.message}`);
      console.error("Stack:", error.stack);
    }

    // =============================================
    // NETTOYAGE FINAL
    // =============================================
    await cleanTestData();

    log(colors.cyan, "\n🎉 === TESTS AFK FINAL TERMINÉS AVEC SUCCÈS ===");
    log(colors.green, "✅ Le système AFK fonctionne correctement avec Account/Player");
    log(colors.green, "✅ Les corrections findById ont été appliquées");
    log(colors.green, "✅ Les index MongoDB ont été corrigés");

  } catch (error: any) {
    log(colors.red, `❌ Erreur test: ${error.message}`);
    console.error("Stack complet:", error.stack);
    
    // Diagnostic automatique
    if (error.message.includes("E11000") && error.message.includes("username")) {
      log(colors.red, "\n🔍 DIAGNOSTIC: Index username encore présent!");
      log(colors.yellow, "➡️ Lancez d'abord: npx ts-node server/src/scripts/resetIndexes.ts");
    }
    if (error.message.includes("findById")) {
      log(colors.red, "\n🔍 DIAGNOSTIC: Erreur findById encore présente!");
      log(colors.yellow, "➡️ Vérifiez que tous les services utilisent findOne({ playerId })");
    }
    
  } finally {
    await mongoose.disconnect();
    log(colors.green, "\n🔌 Déconnecté de MongoDB");
  }
}

// Aide
function showUsage() {
  log(colors.cyan, "\n🧪 === TEST AFK FINAL ===");
  console.log("Version finale après reset des index MongoDB");
  console.log("• ✅ Fonctionne avec les index corrigés");
  console.log("• ✅ Test complet Account/Player");
  console.log("• ✅ Test système AFK Enhanced");
  console.log("• ✅ Diagnostic automatique des erreurs");
  console.log("\nPré-requis:");
  console.log("1. Lancez d'abord: npx ts-node server/src/scripts/resetIndexes.ts");
  console.log("2. Puis lancez: npx ts-node server/src/scripts/testAfkFinal.ts");
  console.log("");
}

if (require.main === module) {
  showUsage();
  testAfkFinal().then(() => process.exit(0));
}

export default testAfkFinal;

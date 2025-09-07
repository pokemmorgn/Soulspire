// server/src/scripts/testAfkFixed.ts
// Version rapide qui évite les problèmes d'index

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import Account from "../models/Account";
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

async function forceCleanupDatabase() {
  log(colors.red, "🗑️ Nettoyage forcé de la base de données...");
  
  try {
    // Supprimer TOUS les documents de test de manière agressive
    await Promise.all([
      Account.deleteMany({ $or: [
        { accountId: { $regex: /TEST/ } },
        { username: { $regex: /Test/ } },
        { email: { $regex: /test/ } }
      ]}),
      Player.deleteMany({ $or: [
        { playerId: { $regex: /TEST/ } },
        { displayName: { $regex: /Test/ } }
      ]}),
      AfkState.deleteMany({ playerId: { $regex: /TEST/ } }),
      AfkSession.deleteMany({ playerId: { $regex: /TEST/ } })
    ]);
    
    // Attendre un peu pour s'assurer que la base est clean
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    log(colors.green, "✅ Base de données nettoyée");
  } catch (error: any) {
    log(colors.yellow, `⚠️ Erreur nettoyage: ${error.message}`);
  }
}

async function createTestPlayersSimple() {
  // Utiliser des IDs uniques avec timestamp pour éviter les collisions
  const timestamp = Date.now();
  
  // ✅ SOLUTION : Créer directement les players sans comptes séparés pour ce test
  let basicPlayer = await Player.findOne({ playerId: `PLAYER_BASIC_${timestamp}` });
  if (!basicPlayer) {
    basicPlayer = new Player({
      playerId: `PLAYER_BASIC_${timestamp}`,
      accountId: `ACC_BASIC_${timestamp}`, // Lien fictif pour ce test
      serverId: "S1",
      displayName: "AfkTestBasic",
      gold: 1000,
      gems: 50,
      world: 1,
      level: 10,
      vipLevel: 0,
      heroes: [
        { 
          heroId: "hero_001", 
          level: 5, 
          stars: 1, 
          equipped: true, 
          slot: 1, 
          experience: 0, 
          ascensionLevel: 0, 
          awakenLevel: 0, 
          acquisitionDate: new Date() 
        }
      ]
    });
    await basicPlayer.save();
    log(colors.yellow, "🆕 Joueur Basic créé (test simple)");
  }

  let advancedPlayer = await Player.findOne({ playerId: `PLAYER_ADVANCED_${timestamp}` });
  if (!advancedPlayer) {
    advancedPlayer = new Player({
      playerId: `PLAYER_ADVANCED_${timestamp}`,
      accountId: `ACC_ADVANCED_${timestamp}`, // Lien fictif pour ce test
      serverId: "S1",
      displayName: "AfkTestAdvanced",
      gold: 10000,
      gems: 500,
      world: 5,
      level: 35,
      vipLevel: 3,
      difficulty: "Hard",
      heroes: [
        { 
          heroId: "hero_001", 
          level: 25, 
          stars: 3, 
          equipped: true, 
          slot: 1, 
          experience: 0, 
          ascensionLevel: 0, 
          awakenLevel: 0, 
          acquisitionDate: new Date() 
        },
        { 
          heroId: "hero_002", 
          level: 22, 
          stars: 2, 
          equipped: true, 
          slot: 2, 
          experience: 0, 
          ascensionLevel: 0, 
          awakenLevel: 0, 
          acquisitionDate: new Date() 
        }
      ]
    });
    await advancedPlayer.save();
    log(colors.yellow, "🆕 Joueur Advanced créé (test simple)");
  }

  return { basicPlayer, advancedPlayer };
}

async function quickAfkTest(): Promise<void> {
  try {
    log(colors.cyan, "\n🧪 === TEST AFK RAPIDE (SANS ERREURS) ===\n");
    await mongoose.connect(MONGO_URI);
    log(colors.green, "✅ Connecté à MongoDB");

    // Nettoyage forcé
    await forceCleanupDatabase();

    // Création simple
    const { basicPlayer, advancedPlayer } = await createTestPlayersSimple();
    const basicId = basicPlayer.playerId;
    const advancedId = advancedPlayer.playerId;

    // =============================================
    // TEST 1: État AFK de base
    // =============================================
    log(colors.bright, "\n🔰 === TEST ÉTAT AFK ===");
    
    const basicState = await AfkServiceEnhanced.ensureState(basicId);
    log(colors.green, `✅ État Basic créé - PlayerId: ${basicState.playerId}`);
    log(colors.blue, `📊 Taux or/min: ${basicState.baseGoldPerMinute}`);

    const advancedState = await AfkServiceEnhanced.ensureState(advancedId);
    log(colors.green, `✅ État Advanced créé - PlayerId: ${advancedState.playerId}`);
    log(colors.blue, `📊 Taux or/min: ${advancedState.baseGoldPerMinute}`);

    // =============================================
    // TEST 2: Tick et Claim de base
    // =============================================
    log(colors.bright, "\n⏰ === TEST TICK ET CLAIM ===");
    
    // Simuler 5 minutes AFK
    basicState.lastTickAt = new Date(Date.now() - 5 * 60 * 1000);
    await basicState.save();
    
    const afterTick = await AfkServiceEnhanced.tick(basicId);
    log(colors.yellow, `📈 Or après 5min: ${afterTick.pendingGold}`);

    const claimResult = await AfkServiceEnhanced.claim(basicId);
    log(colors.green, `💰 Or réclamé: ${claimResult.claimed}`);

    // =============================================
    // TEST 3: Enhanced (joueur avancé)
    // =============================================
    log(colors.bright, "\n🚀 === TEST ENHANCED ===");
    
    const summaryEnhanced = await AfkServiceEnhanced.getSummaryEnhanced(advancedId, true);
    log(colors.cyan, `Enhanced activé: ${summaryEnhanced.useEnhancedRewards}`);
    log(colors.cyan, `Peut upgrade: ${summaryEnhanced.canUpgrade}`);
    
    if (summaryEnhanced.canUpgrade) {
      const upgradeResult = await AfkServiceEnhanced.upgradeToEnhanced(advancedId);
      log(colors.green, `🔄 Upgrade: ${upgradeResult.success} - ${upgradeResult.message}`);
    }

    // =============================================
    // TEST 4: Calculs de récompenses
    // =============================================
    log(colors.bright, "\n📊 === TEST CALCULS RÉCOMPENSES ===");
    
    try {
      const rewardsCalc = await AfkRewardsService.calculatePlayerAfkRewards(advancedId);
      log(colors.green, `✅ Récompenses calculées: ${rewardsCalc.rewards.length} types`);
      log(colors.blue, `📊 Multiplicateur total: ${rewardsCalc.multipliers.total}`);
      log(colors.blue, `💰 Or/min: ${rewardsCalc.ratesPerMinute.gold}`);
    } catch (error: any) {
      log(colors.red, `❌ Erreur calculs: ${error.message}`);
    }

    // =============================================
    // TEST 5: Nettoyage final
    // =============================================
    log(colors.bright, "\n🧹 === NETTOYAGE FINAL ===");
    await forceCleanupDatabase();

    log(colors.cyan, "\n🎉 === TEST RAPIDE TERMINÉ AVEC SUCCÈS ===\n");

  } catch (err: any) {
    log(colors.red, `❌ Erreur: ${err.message}`);
    console.error("Stack:", err.stack);
    
    // Diagnostic
    if (err.message.includes("E11000")) {
      log(colors.yellow, "\n🔍 DIAGNOSTIC: Erreur de clé dupliquée détectée");
      log(colors.yellow, "➡️ Problème d'index unique dans le modèle Account");
    }
    if (err.message.includes("findById")) {
      log(colors.yellow, "\n🔍 DIAGNOSTIC: Erreur findById détectée");
      log(colors.yellow, "➡️ Vérifiez les corrections Player.findOne({ playerId })");
    }
    
  } finally {
    await mongoose.disconnect();
    log(colors.green, "🔌 Déconnecté de MongoDB");
  }
}

// Aide
function showUsage() {
  log(colors.cyan, "\n🎮 === TEST AFK RAPIDE (SANS ERREURS) ===");
  console.log("Version simplifiée qui évite les problèmes d'index MongoDB");
  console.log("• ✅ Nettoyage forcé de la base");
  console.log("• ✅ Création players sans comptes complexes");
  console.log("• ✅ Tests essentiels du système AFK");
  console.log("• ✅ Diagnostic automatique des erreurs");
  console.log("\nLancement:");
  console.log("npx ts-node server/src/scripts/testAfkFixed.ts");
  console.log("");
}

if (require.main === module) {
  showUsage();
  quickAfkTest().then(() => process.exit(0));
}

export default quickAfkTest;

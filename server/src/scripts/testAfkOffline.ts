import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import AfkState from "../models/AfkState";
import AfkService from "../services/AfkService";

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
  cyan: "\x1b[36m"
};
const log = (c: string, m: string) => console.log(`${c}${m}${colors.reset}`);

/** Création / récupération d’un joueur de test (offline) */
async function getOrCreateOfflinePlayer() {
  let player = await Player.findOne({ username: "AfkOfflineTest" });
  if (!player) {
    player = new Player({
      username: "AfkOfflineTest",
      password: "test123",
      serverId: "S1",
      gold: 0,
      gems: 0,
      world: 1,
      level: 1
    });
    await player.save();
    log(colors.yellow, "🆕 Joueur de test offline créé");
  } else {
    log(colors.blue, "📋 Joueur de test offline existant");
  }
  return player;
}

/** Avance artificiellement l'horloge côté état AFK (ne touche PAS accumulatedSinceClaimSec) */
async function fastForward(playerId: string, seconds: number) {
  const state = await AfkState.findOne({ playerId });
  if (!state) throw new Error("AfkState introuvable (assure-toi d'avoir appelé getSummary/ensureState).");
  state.lastTickAt = new Date((state.lastTickAt?.getTime() || Date.now()) - seconds * 1000);
  await state.save();
  return state;
}

/** Affiche un résumé lisible */
async function showSummary(playerId: string, title = "SUMMARY") {
  const s = await AfkService.getSummary(playerId, false);
  log(colors.cyan, `\n📦 ${title}`);
  console.table({
    pendingGold: s.pendingGold,
    baseGoldPerMinute: s.baseGoldPerMinute,
    maxAccrualSeconds: s.maxAccrualSeconds,
    accumulatedSinceClaimSec: s.accumulatedSinceClaimSec,
    lastTickAt: s.lastTickAt,
    lastClaimAt: s.lastClaimAt,
    todayAccruedGold: s.todayAccruedGold
  });
  return s;
}

/** Simule un OFFLINE de X minutes : recul lastTickAt puis tick via getSummary/tick */
async function simulateOfflineMinutes(playerId: string, minutes: number, label: string) {
  log(colors.magenta, `\n📴 Simulation OFFLINE (${label}) — ${minutes} min`);
  await fastForward(playerId, minutes * 60);
  // getSummary(tickBefore=true) fera le tick serveur (cap 12h appliqué)
  const s = await AfkService.getSummary(playerId, true);
  log(colors.yellow, `→ PendingGold: ${s.pendingGold} | accumSinceClaimSec=${s.accumulatedSinceClaimSec}/${s.maxAccrualSeconds}`);
  return s;
}

/** Reset quotidien (force le changement de jour) */
async function simulateDayChange(playerId: string) {
  const state = await AfkState.findOne({ playerId });
  if (!state) throw new Error("AfkState introuvable pour simulateDayChange");
  const yesterdayISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  state.todayKey = yesterdayISO;
  await state.save();
  // Déclenche le reset via un tick
  await AfkService.getSummary(playerId, true);
}

/**
 * Scénario OFFLINE pur :
 *  1) Ensure state & bootstrap offline (settleOfflineIfNeeded)
 *  2) OFFLINE 30 min → gain attendu: 30 * 5 = 150
 *  3) Claim
 *  4) OFFLINE 6h → gain: 6*60*5 = 1800
 *  5) Claim
 *  6) OFFLINE 20h → cap à 12h → gain: 720*5 = 3600
 *  7) Claim
 *  8) Reset quotidien puis OFFLINE 90 min → gain 450
 */
async function testAfkOffline(): Promise<void> {
  try {
    log(colors.cyan, "\n🧪 === TEST AFK OFFLINE ===\n");
    await mongoose.connect(MONGO_URI);
    log(colors.green, "✅ Connecté à MongoDB");

    const player = await getOrCreateOfflinePlayer();
    const playerId = (player._id as any).toString();

    // 1) Bootstrap: initialise AfkState + settle offline si first-time (via lastSeenAt)
    await AfkService.getSummary(playerId, true);
    await showSummary(playerId, "SUMMARY INITIAL");

    // 2) OFFLINE 30 min
    const s30 = await simulateOfflineMinutes(playerId, 30, "30 min");
    // 3) Claim
    log(colors.green, "\n💰 CLAIM #1");
    const claim1 = await AfkService.claim(playerId);
    console.table({ claimed: claim1.claimed, totalGold: claim1.totalGold, pendingGoldAfter: claim1.state.pendingGold });
    await showSummary(playerId, "SUMMARY APRÈS CLAIM #1");

    // 4) OFFLINE 6h (360 min)
    const s6h = await simulateOfflineMinutes(playerId, 360, "6 heures");
    // 5) Claim
    log(colors.green, "\n💰 CLAIM #2");
    const claim2 = await AfkService.claim(playerId);
    console.table({ claimed: claim2.claimed, totalGold: claim2.totalGold, pendingGoldAfter: claim2.state.pendingGold });
    await showSummary(playerId, "SUMMARY APRÈS CLAIM #2");

    // 6) OFFLINE 20h (cap à 12h)
    const s20h = await simulateOfflineMinutes(playerId, 20 * 60, "20 heures (cap à 12h)");
    // 7) Claim
    log(colors.green, "\n💰 CLAIM #3 (cap 12h)");
    const claim3 = await AfkService.claim(playerId);
    console.table({ claimed: claim3.claimed, totalGold: claim3.totalGold, pendingGoldAfter: claim3.state.pendingGold });
    await showSummary(playerId, "SUMMARY APRÈS CLAIM #3");

    // 8) Reset quotidien + OFFLINE 90 min
    log(colors.yellow, "\n📅 Reset quotidien");
    await simulateDayChange(playerId);
    await showSummary(playerId, "SUMMARY APRÈS RESET JOUR");

    await simulateOfflineMinutes(playerId, 90, "90 min après reset");
    log(colors.green, "\n💰 CLAIM #4");
    const claim4 = await AfkService.claim(playerId);
    console.table({ claimed: claim4.claimed, totalGold: claim4.totalGold, pendingGoldAfter: claim4.state.pendingGold });
    await showSummary(playerId, "SUMMARY FINAL");

    log(colors.cyan, "\n🎉 === TESTS AFK OFFLINE TERMINÉS ===\n");
  } catch (err: any) {
    log(colors.red, `❌ Erreur test AFK OFFLINE: ${err.message}`);
    console.error(err);
  } finally {
    await mongoose.disconnect();
    log(colors.green, "🔌 Déconnecté de MongoDB");
  }
}

// Aide
function showUsage() {
  log(colors.cyan, "\n🎮 === SCRIPT DE TEST AFK OFFLINE ===");
  console.log("Ce script teste l'accumulation AFK SANS sessions actives :");
  console.log("• Simule des périodes d'absence (offline) en reculant lastTickAt");
  console.log("• Vérifie le cap 12h, le claim, et le reset quotidien");
  console.log("\nLancement:");
  console.log("npx ts-node src/scripts/testAfkOffline.ts");
  console.log("");
}

if (require.main === module) {
  showUsage();
  testAfkOffline().then(() => process.exit(0));
}

export { testAfkOffline };

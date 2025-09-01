import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import AfkState from "../models/AfkState";
import AfkService from "../services/AfkService";
import AfkSession from "../models/AfkSession";

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

async function getOrCreateAfkTestPlayer() {
  let player = await Player.findOne({ username: "AfkTestPlayer" });
  if (!player) {
    player = new Player({
      username: "AfkTestPlayer",
      password: "test123",
      serverId: "S1",
      gold: 0,
      gems: 0,
      world: 1,
      level: 1
    });
    await player.save();
    log(colors.yellow, "🆕 Joueur de test AFK créé");
  } else {
    log(colors.blue, "📋 Joueur de test AFK existant");
  }
  return player;
}

/**
 * Avance artificiellement l'horloge côté état AFK pour simuler le temps qui passe.
 * - Déplace lastTickAt en arrière
 * - Optionnel: augmente accumulatedSinceClaimSec (pour tester le cap)
 */
async function fastForward(playerId: string, seconds: number, alsoAccumulateSinceClaim = false) {
  const state = await AfkState.findOne({ playerId });
  if (!state) throw new Error("AfkState introuvable (ensureState avant).");

  const newLastTickAt = new Date((state.lastTickAt?.getTime() || Date.now()) - seconds * 1000);
  state.lastTickAt = newLastTickAt;

  if (alsoAccumulateSinceClaim) {
    state.accumulatedSinceClaimSec = Math.max(0, state.accumulatedSinceClaimSec + seconds);
  }

  await state.save();
  return state;
}

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

/**
 * Simule un AFK de X minutes, en accélérant le temps via fastForward + tick(now)
 * On passe "now" au service pour rester déterministe.
 */
async function simulateAfkMinutes(playerId: string, minutes: number, label: string) {
  log(colors.magenta, `\n⏳ Simulation AFK (${label}) — ${minutes} min`);
  const seconds = minutes * 60;

  // Avance le temps côté état
  await fastForward(playerId, seconds);

  // Tick avec le "now" réel (le delta sera détecté)
  const state = await AfkService.tick(playerId, new Date());
  log(colors.yellow, `+ PendingGold: ${state.pendingGold} | accumSinceClaimSec=${state.accumulatedSinceClaimSec}`);
  return state;
}

/**
 * Force un "day change" pour vérifier le reset du compteur todayAccruedGold / todayKey
 */
async function simulateDayChange(playerId: string) {
  const state = await AfkState.findOne({ playerId });
  if (!state) throw new Error("AfkState introuvable pour simulateDayChange");

  // Reculer la todayKey d'un jour
  const yesterdayISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  state.todayKey = yesterdayISO;
  await state.save();

  // Un petit tick pour déclencher _resetTodayIfNeeded()
  await AfkService.tick(playerId, new Date());
}

/**
 * Nettoie toutes les sessions AFK du joueur (utile entre scénarios)
 */
async function closeAllSessions(playerId: string) {
  await AfkSession.updateMany({ playerId, status: "running" }, { $set: { status: "ended", endedAt: new Date() } });
}

/**
 * Scénario complet :
 * 1) ensureState + summary
 * 2) Start session → heartbeats → stop
 * 3) AFK court (2 minutes)
 * 4) Claim
 * 5) AFK long (15 heures) → cap attendu (12h)
 * 6) Claim
 * 7) Test reset quotidien
 * 8) Test worker de fermeture de sessions froides
 */
async function testAfk(): Promise<void> {
  try {
    log(colors.cyan, "\n🧪 === TEST AFK ===\n");
    await mongoose.connect(MONGO_URI);
    log(colors.green, "✅ Connecté à MongoDB");

    const player = await getOrCreateAfkTestPlayer();
    const playerId = (player._id as any).toString();

    // Ensure AFK state
    await AfkService.getSummary(playerId, true);

    // 1) Summary initial
    await showSummary(playerId, "SUMMARY INITIAL");

    // 2) Cycle start → heartbeat → stop
    log(colors.blue, "\n🚦 START SESSION");
    const start = await AfkService.startSession(playerId, { source: "idle", deviceId: "TEST-DEVICE" });
    console.log(`Session started: ${start.id}`);

    log(colors.blue, "💓 HEARTBEAT #1");
    await AfkService.heartbeat(playerId);
    await new Promise(r => setTimeout(r, 500));
    log(colors.blue, "💓 HEARTBEAT #2");
    await AfkService.heartbeat(playerId);

    await showSummary(playerId, "SUMMARY APRÈS HEARTBEATS");

    log(colors.blue, "🛑 STOP SESSION");
    await AfkService.stopSession(playerId);

    // 3) AFK court: 2 minutes
    await simulateAfkMinutes(playerId, 2, "AFK court (2 min)");
    await showSummary(playerId, "SUMMARY AVANT CLAIM #1");

    // 4) Claim
    log(colors.green, "\n💰 CLAIM #1");
    const claim1 = await AfkService.claim(playerId);
    console.table({ claimed: claim1.claimed, totalGold: claim1.totalGold, pendingGoldAfter: claim1.state.pendingGold });
    await showSummary(playerId, "SUMMARY APRÈS CLAIM #1");

    // 5) AFK long: 15 heures (au-delà du cap 12h par défaut)
    log(colors.magenta, "\n🕒 Simulation AFK long (15h, cap attendu à 12h)");
    // On avance le temps ET on augmente accumulatedSinceClaimSec pour tester le cap
    await fastForward(playerId, 15 * 3600, false);
    await AfkService.tick(playerId, new Date());
    const afterLong = await showSummary(playerId, "SUMMARY APRÈS AFK LONG");
    console.log(`➡️ accumulatedSinceClaimSec=${afterLong.accumulatedSinceClaimSec} | maxAccrualSeconds=${afterLong.maxAccrualSeconds}`);

    // 6) Claim après AFK long
    log(colors.green, "\n💰 CLAIM #2 (après long AFK)");
    const claim2 = await AfkService.claim(playerId);
    console.table({ claimed: claim2.claimed, totalGold: claim2.totalGold, pendingGoldAfter: claim2.state.pendingGold });
    await showSummary(playerId, "SUMMARY APRÈS CLAIM #2");

    // 7) Test reset quotidien
    log(colors.yellow, "\n📅 Test reset quotidien (todayKey)");
    await simulateDayChange(playerId);
    const sAfterDay = await showSummary(playerId, "SUMMARY APRÈS CHANGEMENT DE JOUR");
    console.log(`➡️ todayKey a été réinitialisé, todayAccruedGold=${sAfterDay.todayAccruedGold}`);

    // 8) Test close stale sessions
    log(colors.blue, "\n🧹 Test fermeture des sessions ‘stales’");
    await closeAllSessions(playerId);
    // Ré-ouvre une session puis recule son lastHeartbeatAt pour simuler une session froide
    const sess = await AfkService.startSession(playerId, { source: "idle" });
    await AfkSession.updateOne({ _id: sess._id }, { $set: { lastHeartbeatAt: new Date(Date.now() - 10 * 60 * 1000) } }); // 10 min
    const closed = await AfkService.closeStaleSessions(120); // coldAfterSec=120s
    console.log(`Sessions fermées par worker: ${closed}`);

    log(colors.cyan, "\n🎉 === TESTS AFK TERMINÉS ===\n");
  } catch (err: any) {
    log(colors.red, `❌ Erreur test AFK: ${err.message}`);
    console.error(err);
  } finally {
    await mongoose.disconnect();
    log(colors.green, "🔌 Déconnecté de MongoDB");
  }
}

// Aide
function showUsage() {
  log(colors.cyan, "\n🎮 === SCRIPT DE TEST AFK ===");
  console.log("Ce script simule des sessions AFK comme AFK Arena :");
  console.log("• Démarre/stoppe des sessions, envoie des heartbeats");
  console.log("• Simule le temps (AFK court/long avec cap 12h)");
  console.log("• Fait des claim et vérifie l’or total");
  console.log("• Teste le reset quotidien et le cleanup des sessions froides");
  console.log("\nLancement:");
  console.log("npx ts-node src/scripts/testAfk.ts");
  console.log("");
}

if (require.main === module) {
  showUsage();
  testAfk().then(() => process.exit(0));
}

export { testAfk };

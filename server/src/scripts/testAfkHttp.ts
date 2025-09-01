import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Config API
const BASE_URL = process.env.API_URL || "http://localhost:3000";
const USERNAME = "AfkHttpTest";
const PASSWORD = "test123";

// Couleurs console
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
};
const log = (c: string, msg: string) => console.log(`${c}${msg}${colors.reset}`);

async function loginOrRegister(): Promise<string> {
  try {
    // Tentative de login
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: USERNAME,
      password: PASSWORD,
      serverId: "S1",
    });
    log(colors.green, "✅ Login réussi");
    return loginRes.data.token;
  } catch (err: any) {
    // Sinon inscription
    log(colors.yellow, "⚠️ Création du joueur de test");
    const registerRes = await axios.post(`${BASE_URL}/api/auth/register`, {
      username: USERNAME,
      password: PASSWORD,
      serverId: "S1",
    });
    return registerRes.data.token;
  }
}

async function run() {
  try {
    const token = await loginOrRegister();
    const headers = { Authorization: `Bearer ${token}` };

    // 1. Summary initial
    log(colors.cyan, "\n📦 Summary initial");
    let res = await axios.get(`${BASE_URL}/afk/summary`, { headers });
    console.log(res.data);

    // 2. Start session
    log(colors.cyan, "\n🚦 Start session");
    res = await axios.post(`${BASE_URL}/afk/start`, {}, { headers });
    console.log(res.data);

    // 3. Heartbeat
    log(colors.cyan, "\n💓 Heartbeat");
    res = await axios.post(`${BASE_URL}/afk/heartbeat`, {}, { headers });
    console.log(res.data);

    // 4. Simuler AFK offline : reculer lastTickAt en DB
    log(colors.cyan, "\n⏳ Simuler 10 minutes AFK (offline)");
    // ⚠️ Ici, pour le test, on appelle directement l’API /afk/summary
    // après avoir reculé lastTickAt en base manuellement (par script service)
    // → à toi d’utiliser le script service précédent pour forcer lastTickAt

    res = await axios.get(`${BASE_URL}/afk/summary`, { headers });
    console.log(res.data);

    // 5. Claim
    log(colors.cyan, "\n💰 Claim");
    res = await axios.post(`${BASE_URL}/afk/claim`, {}, { headers });
    console.log(res.data);

    // 6. Stop session
    log(colors.cyan, "\n🛑 Stop session");
    res = await axios.post(`${BASE_URL}/afk/stop`, {}, { headers });
    console.log(res.data);

    log(colors.green, "\n🎉 Test AFK HTTP terminé");
  } catch (err: any) {
    log(colors.red, `❌ Erreur test AFK HTTP: ${err.message}`);
    if (err.response) console.error(err.response.data);
  }
}

if (require.main === module) {
  run();
}

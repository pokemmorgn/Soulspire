const API_URL = "http://localhost:3000/api";
const BANNER_ID = "limited_saryel_rateup";

// Credentials du compte de test
const USERNAME = "gacha_tester";
const PASSWORD = "test123456";
const SERVER = "S1";

async function main() {
  try {
    // 🔑 Login → récupérer token
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: USERNAME,
        password: PASSWORD,
        serverId: SERVER,
      }),
    });

    const loginData = await loginRes.json();
    const token = loginData.accessToken;
    console.log("✅ Token récupéré\n");

    let totalPulls = 0;
    let legendaryCount = 0;
    let gotSaryel = false;

    // 🔁 20 multi pulls de 10
    for (let i = 1; i <= 20; i++) {
      totalPulls += 10;
      console.log(`🎰 Multi-pull ${i} (${totalPulls} pulls cumulés)...`);

      const pullRes = await fetch(`${API_URL}/gacha/pull`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bannerId: BANNER_ID,
          count: 10,
        }),
      });

      const data = await pullRes.json();
      const results = data.results || [];

      for (const r of results) {
        if (r.rarity === "Legendary") {
          legendaryCount++;
          if (r.name === "Saryel") {
            gotSaryel = true;
            console.log(`🌟 Saryel obtenu au multi-pull ${i}!`);
            break;
          }
        }
      }

      if (gotSaryel) break;

      // pause pour éviter rate limit
      await new Promise((res) => setTimeout(res, 1500));
    }

    // 📊 Résumé final
    console.log("\n══════════════════════════════════════");
    if (gotSaryel) {
      console.log(`✅ Saryel obtenu en ${totalPulls} pulls !`);
    } else {
      console.log("❌ Saryel NON obtenu après 200 pulls (20 multi-pulls)");
    }
    console.log(`📊 Total pulls: ${totalPulls}`);
    console.log(`🌟 Total Legendary obtenus: ${legendaryCount}`);
    console.log("══════════════════════════════════════\n");
  } catch (err: any) {
    console.error("❌ Erreur durant la simulation:", err.message);
  }
}

if (require.main === module) {
  main();
}

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
    let saryelCount = 0;
    let gotSaryel = false;
    const legendariesObtained: string[] = [];

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
      
      // ✅ Debug : Afficher la réponse complète du premier pull
      if (i === 1) {
        console.log("\n📦 Structure de la réponse (premier pull):");
        console.log(JSON.stringify(data, null, 2).substring(0, 500) + "...\n");
      }
      
      const results = data.results || [];

      for (const r of results) {
        if (r.rarity === "Legendary") {
          legendaryCount++;
          
          // ✅ CORRECTION : Vérifier à la fois r.name ET r.hero.name
          const heroName = r.name || r.hero?.name || "Unknown";
          legendariesObtained.push(heroName);
          
          console.log(`   🌟 Legendary obtenu: ${heroName}${r.isFocus ? ' [FOCUS]' : ''}`);
          
          if (heroName === "Saryel") {
            saryelCount++;
            if (!gotSaryel) {
              gotSaryel = true;
              console.log(`   🎯 *** PREMIER SARYEL obtenu au multi-pull ${i}! ***\n`);
            }
          }
        }
      }

      // ⚠️ NE PAS BREAK : Continuer pour tester les 200 pulls complets
      // if (gotSaryel) break;

      // pause pour éviter rate limit
      await new Promise((res) => setTimeout(res, 1500));
    }

    // 📊 Résumé final détaillé
    console.log("\n══════════════════════════════════════");
    if (gotSaryel) {
      console.log(`✅ Saryel obtenu ! (${saryelCount}× sur ${legendaryCount} legendaries)`);
      console.log(`📈 Taux de focus effectif: ${((saryelCount / legendaryCount) * 100).toFixed(1)}%`);
    } else {
      console.log("❌ Saryel NON obtenu après 200 pulls (20 multi-pulls)");
      console.log("⚠️  Ceci est statistiquement TRÈS improbable (0.39% de chance)");
    }
    console.log(`📊 Total pulls: ${totalPulls}`);
    console.log(`🌟 Total Legendary obtenus: ${legendaryCount}`);
    
    if (legendariesObtained.length > 0) {
      console.log(`\n📜 Liste des Legendaries obtenus:`);
      legendariesObtained.forEach((name, idx) => {
        console.log(`   ${idx + 1}. ${name}`);
      });
    }
    
    console.log("══════════════════════════════════════\n");
    
    // ✅ Recommandations selon le résultat
    if (!gotSaryel && legendaryCount > 0) {
      console.log("🔧 DIAGNOSTIC:");
      console.log("   Le système de focus ne fonctionne pas correctement.");
      console.log("   Vérifiez les logs serveur pour voir si focusChance est bien appliqué.\n");
    } else if (saryelCount === legendaryCount) {
      console.log("✅ PARFAIT: Tous les legendaries sont Saryel (focus 100%)!\n");
    } else if (saryelCount / legendaryCount >= 0.6) {
      console.log("✅ BON: Le système de focus fonctionne correctement (~75% attendu).\n");
    }
    
  } catch (err: any) {
    console.error("❌ Erreur durant la simulation:", err.message);
    console.error("Stack:", err.stack);
  }
}

if (require.main === module) {
  main();
}

const API_URL = "http://localhost:3000/api";
const BANNER_ID = "limited_saryel_rateup";

// Credentials du compte de test
const USERNAME = "gacha_tester";
const PASSWORD = "test123456";
const SERVER = "S1";

// Configuration du pity pour la bannière Saryel
const PITY_CONFIG = {
  legendaryPity: 90,
  epicPity: 10
};

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
    let epicCount = 0;
    let saryelCount = 0;
    let gotSaryel = false;
    const legendariesObtained: string[] = [];
    
    // ✅ Tracking du Pity
    let pityStatus = {
      legendaryPulls: 0,
      epicPulls: 0,
      legendaryPityTriggered: 0,
      epicPityTriggered: 0
    };

    console.log("🎰 ════════════════════════════════════════");
    console.log("   SIMULATION DE 200 PULLS - BANNIÈRE SARYEL");
    console.log("════════════════════════════════════════\n");

    // 🔁 20 multi pulls de 10
    for (let i = 1; i <= 20; i++) {
      totalPulls += 10;
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🎰 Multi-pull ${i}/20 (${totalPulls} pulls cumulés)`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Afficher l'état du pity AVANT le pull
      console.log(`📊 État Pity AVANT ce pull:`);
      console.log(`   🌟 Legendary: ${pityStatus.legendaryPulls}/${PITY_CONFIG.legendaryPity} (${PITY_CONFIG.legendaryPity - pityStatus.legendaryPulls} restants)`);
      console.log(`   💎 Epic: ${pityStatus.epicPulls}/${PITY_CONFIG.epicPity} (${PITY_CONFIG.epicPity - pityStatus.epicPulls} restants)`);

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
      
      // ✅ Récupérer le pity status de la réponse API
      const apiPityStatus = data.pityStatus;

      console.log(`\n📦 Résultats de ce multi-pull:`);

      // Parcourir les résultats
      for (let pullIndex = 0; pullIndex < results.length; pullIndex++) {
        const r = results[pullIndex];
        
        // Incrémenter les compteurs pity
        pityStatus.legendaryPulls++;
        pityStatus.epicPulls++;
        
        // Vérifier si un pity va se déclencher
        const willTriggerLegendaryPity = pityStatus.legendaryPulls >= PITY_CONFIG.legendaryPity;
        const willTriggerEpicPity = pityStatus.epicPulls >= PITY_CONFIG.epicPity;
        
        if (willTriggerLegendaryPity) {
          console.log(`   🔔 [Pull ${pullIndex + 1}/10] PITY LEGENDARY se déclenche !`);
        } else if (willTriggerEpicPity) {
          console.log(`   🔔 [Pull ${pullIndex + 1}/10] PITY EPIC se déclenche !`);
        }
        
        if (r.rarity === "Legendary") {
          legendaryCount++;
          
          const heroName = r.name || r.hero?.name || "Unknown";
          legendariesObtained.push(heroName);
          
          const wasPity = pityStatus.legendaryPulls >= PITY_CONFIG.legendaryPity;
          if (wasPity) {
            pityStatus.legendaryPityTriggered++;
          }
          
          console.log(`   🌟 [Pull ${pullIndex + 1}/10] LEGENDARY: ${heroName}${r.isFocus ? ' [FOCUS ✨]' : ''}${wasPity ? ' (via PITY 🔔)' : ''}`);
          
          // Reset pity legendary
          pityStatus.legendaryPulls = 0;
          pityStatus.epicPulls = 0;
          console.log(`      └─ Pity RESET → Legendary: 0/${PITY_CONFIG.legendaryPity}, Epic: 0/${PITY_CONFIG.epicPity}`);
          
          if (heroName === "Saryel") {
            saryelCount++;
            if (!gotSaryel) {
              gotSaryel = true;
              console.log(`      └─ 🎯 *** PREMIER SARYEL OBTENU ! ***`);
            }
          }
          
        } else if (r.rarity === "Epic") {
          epicCount++;
          
          const wasPity = pityStatus.epicPulls >= PITY_CONFIG.epicPity;
          if (wasPity) {
            pityStatus.epicPityTriggered++;
          }
          
          const heroName = r.name || r.hero?.name || "Unknown";
          console.log(`   💎 [Pull ${pullIndex + 1}/10] EPIC: ${heroName}${wasPity ? ' (via PITY 🔔)' : ''}`);
          
          // Reset pity epic seulement
          pityStatus.epicPulls = 0;
          pityStatus.legendaryPulls++;
          console.log(`      └─ Epic Pity RESET → Epic: 0/${PITY_CONFIG.epicPity}, Legendary: ${pityStatus.legendaryPulls}/${PITY_CONFIG.legendaryPity}`);
        }
      }
      
      // ✅ Afficher l'état du pity APRÈS le pull (depuis l'API si disponible)
      if (apiPityStatus) {
        console.log(`\n📊 État Pity APRÈS ce pull (depuis API):`);
        console.log(`   🌟 Legendary: ${apiPityStatus.pullsSinceLegendary}/${PITY_CONFIG.legendaryPity} (${apiPityStatus.legendaryPityIn} restants)`);
        console.log(`   💎 Epic: ${apiPityStatus.pullsSinceEpic}/${PITY_CONFIG.epicPity} (${apiPityStatus.epicPityIn} restants)`);
        
        // Synchroniser avec le tracking local
        pityStatus.legendaryPulls = apiPityStatus.pullsSinceLegendary;
        pityStatus.epicPulls = apiPityStatus.pullsSinceEpic;
      }

      // pause pour éviter rate limit
      await new Promise((res) => setTimeout(res, 1500));
    }

    // 📊 Résumé final détaillé
    console.log("\n\n");
    console.log("════════════════════════════════════════");
    console.log("           📊 RÉSUMÉ FINAL");
    console.log("════════════════════════════════════════\n");
    
    // Résultat Saryel
    if (gotSaryel) {
      console.log(`✅ SARYEL OBTENU !`);
      console.log(`   └─ ${saryelCount}× Saryel sur ${legendaryCount} legendaries`);
      console.log(`   └─ Taux de focus effectif: ${((saryelCount / legendaryCount) * 100).toFixed(1)}%`);
    } else {
      console.log("❌ SARYEL NON OBTENU");
      console.log("   ⚠️  Statistiquement TRÈS improbable (0.39% de chance)");
    }
    
    console.log(`\n📊 Statistiques Générales:`);
    console.log(`   • Total pulls: ${totalPulls}`);
    console.log(`   • Legendary obtenus: ${legendaryCount} (${((legendaryCount / totalPulls) * 100).toFixed(2)}%)`);
    console.log(`   • Epic obtenus: ${epicCount} (${((epicCount / totalPulls) * 100).toFixed(2)}%)`);
    
    console.log(`\n🔔 Statistiques Pity:`);
    console.log(`   • Pity Legendary déclenché: ${pityStatus.legendaryPityTriggered}× sur ${legendaryCount} legendaries`);
    console.log(`   • Pity Epic déclenché: ${pityStatus.epicPityTriggered}× sur ${epicCount} epics`);
    console.log(`   • Legendary naturels: ${legendaryCount - pityStatus.legendaryPityTriggered} (${(((legendaryCount - pityStatus.legendaryPityTriggered) / totalPulls) * 100).toFixed(2)}% taux réel)`);
    
    console.log(`\n📈 État Pity Final:`);
    console.log(`   • Pulls depuis dernier Legendary: ${pityStatus.legendaryPulls}/${PITY_CONFIG.legendaryPity}`);
    console.log(`   • Pulls jusqu'au prochain Legendary garanti: ${PITY_CONFIG.legendaryPity - pityStatus.legendaryPulls}`);
    console.log(`   • Pulls depuis dernier Epic: ${pityStatus.epicPulls}/${PITY_CONFIG.epicPity}`);
    console.log(`   • Pulls jusqu'au prochain Epic garanti: ${PITY_CONFIG.epicPity - pityStatus.epicPulls}`);
    
    if (legendariesObtained.length > 0) {
      console.log(`\n📜 Liste des Legendaries obtenus:`);
      legendariesObtained.forEach((name, idx) => {
        console.log(`   ${idx + 1}. ${name}${name === 'Saryel' ? ' ⭐' : ''}`);
      });
    }
    
    console.log("\n════════════════════════════════════════\n");
    
    // ✅ Analyse qualitative
    if (!gotSaryel && legendaryCount > 0) {
      console.log("🔧 DIAGNOSTIC:");
      console.log("   Le système de focus ne fonctionne pas correctement.");
      console.log("   Vérifiez les logs serveur.\n");
    } else if (saryelCount === legendaryCount) {
      console.log("✅ PARFAIT: Tous les legendaries sont Saryel (focus 100%)!\n");
    } else if (saryelCount / legendaryCount >= 0.6) {
      console.log("✅ BON: Le système de focus fonctionne correctement (~75% attendu).\n");
    } else if (saryelCount / legendaryCount >= 0.4) {
      console.log("⚠️  MOYEN: Taux de focus un peu bas, mais statistiquement possible.\n");
    }
    
  } catch (err: any) {
    console.error("\n❌ Erreur durant la simulation:", err.message);
    console.error("Stack:", err.stack);
  }
}

if (require.main === module) {
  main();
}

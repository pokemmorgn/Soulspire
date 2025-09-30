const API_URL = "http://localhost:3000/api";
const BANNER_ID = "limited_saryel_rateup";

// Credentials du compte de test
const USERNAME = "gacha_tester";
const PASSWORD = "test123456";
const SERVER = "S1";

// ✅ Configuration du pity pour la bannière Saryel (SANS Epic Pity)
const PITY_CONFIG = {
  legendaryPity: 50
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
    let rareCount = 0;
    let commonCount = 0;
    let saryelCount = 0;
    let gotSaryel = false;
    const legendariesObtained: string[] = [];
    
    // ✅ Tracking du Pity (UNIQUEMENT Legendary)
    let pityStatus = {
      legendaryPulls: 0,
      legendaryPityTriggered: 0
    };

    console.log("🎰 ════════════════════════════════════════");
    console.log("   SIMULATION DE 200 PULLS - BANNIÈRE SARYEL");
    console.log("   Style: AFK Arena (Legendary Pity SEULEMENT)");
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
        
        // Incrémenter le compteur pity legendary
        pityStatus.legendaryPulls++;
        
        // Vérifier si le pity legendary va se déclencher
        const willTriggerLegendaryPity = pityStatus.legendaryPulls >= PITY_CONFIG.legendaryPity;
        
        if (willTriggerLegendaryPity) {
          console.log(`   🔔 [Pull ${pullIndex + 1}/10] PITY LEGENDARY se déclenche !`);
        }
        
        if (r.rarity === "Legendary") {
          legendaryCount++;
          
          const heroName = r.name || r.hero?.name || "Unknown";
          legendariesObtained.push(heroName);
          
          const wasPity = pityStatus.legendaryPulls >= PITY_CONFIG.legendaryPity;
          if (wasPity) {
            pityStatus.legendaryPityTriggered++;
          }
          
          console.log(`   🌟 [Pull ${pullIndex + 1}/10] LEGENDARY: ${heroName}${r.isFocus ? ' [FOCUS ✨]' : ''}${wasPity ? ' (via PITY 🔔)' : ' (Naturel ✨)'}`);
          
          // Reset pity legendary
          pityStatus.legendaryPulls = 0;
          console.log(`      └─ Pity RESET → Legendary: 0/${PITY_CONFIG.legendaryPity}`);
          
          if (heroName === "Saryel") {
            saryelCount++;
            if (!gotSaryel) {
              gotSaryel = true;
              console.log(`      └─ 🎯 *** PREMIER SARYEL OBTENU ! ***`);
            }
          }
          
        } else if (r.rarity === "Epic") {
          epicCount++;
          const heroName = r.name || r.hero?.name || "Unknown";
          // ✅ Log simplifié (pas de pity Epic)
          if (pullIndex < 3 || pullIndex >= 7) { // Afficher seulement quelques epics pour ne pas polluer
            console.log(`   💎 [Pull ${pullIndex + 1}/10] EPIC: ${heroName}`);
          }
        } else if (r.rarity === "Rare") {
          rareCount++;
        } else if (r.rarity === "Common") {
          commonCount++;
        }
      }
      
      // ✅ Résumé compact du pull si pas de legendary
      if (results.filter((r: any) => r.rarity === "Legendary").length === 0) {
        console.log(`   📊 Résumé: ${results.filter((r: any) => r.rarity === "Epic").length} Epic, ${results.filter((r: any) => r.rarity === "Rare").length} Rare, ${results.filter((r: any) => r.rarity === "Common").length} Common`);
      }
      
      // ✅ Afficher l'état du pity APRÈS le pull (depuis l'API si disponible)
      if (apiPityStatus) {
        console.log(`\n📊 État Pity APRÈS ce pull (depuis API):`);
        console.log(`   🌟 Legendary: ${apiPityStatus.pullsSinceLegendary}/${PITY_CONFIG.legendaryPity} (${apiPityStatus.legendaryPityIn} restants)`);
        
        // Synchroniser avec le tracking local
        pityStatus.legendaryPulls = apiPityStatus.pullsSinceLegendary;
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
      console.log("   ⚠️  Statistiquement TRÈS improbable avec guaranteed = true");
    }
    
    console.log(`\n📊 Statistiques Générales:`);
    console.log(`   • Total pulls: ${totalPulls}`);
    console.log(`   • Legendary obtenus: ${legendaryCount} (${((legendaryCount / totalPulls) * 100).toFixed(2)}%)`);
    console.log(`   • Epic obtenus: ${epicCount} (${((epicCount / totalPulls) * 100).toFixed(2)}%)`);
    console.log(`   • Rare obtenus: ${rareCount} (${((rareCount / totalPulls) * 100).toFixed(2)}%)`);
    console.log(`   • Common obtenus: ${commonCount} (${((commonCount / totalPulls) * 100).toFixed(2)}%)`);
    
    console.log(`\n🔔 Statistiques Pity:`);
    console.log(`   • Pity Legendary déclenché: ${pityStatus.legendaryPityTriggered}× sur ${legendaryCount} legendaries`);
    console.log(`   • Legendary naturels: ${legendaryCount - pityStatus.legendaryPityTriggered} (${(((legendaryCount - pityStatus.legendaryPityTriggered) / totalPulls) * 100).toFixed(2)}% taux réel)`);
    
    // ✅ Calcul du taux théorique attendu
    const expectedLegendaryRate = 2.0; // 2% configuré
    const expectedLegendaries = (totalPulls * expectedLegendaryRate) / 100;
    console.log(`   • Legendary attendus (théorique): ${expectedLegendaries.toFixed(1)} (${expectedLegendaryRate}% taux)`);
    
    console.log(`\n📈 État Pity Final:`);
    console.log(`   • Pulls depuis dernier Legendary: ${pityStatus.legendaryPulls}/${PITY_CONFIG.legendaryPity}`);
    console.log(`   • Pulls jusqu'au prochain Legendary garanti: ${PITY_CONFIG.legendaryPity - pityStatus.legendaryPulls}`);
    
    if (pityStatus.legendaryPulls >= 70) {
      console.log(`   ⚠️  ATTENTION: Proche du pity ! (${pityStatus.legendaryPulls}/90)`);
    }
    
    if (legendariesObtained.length > 0) {
      console.log(`\n📜 Liste des Legendaries obtenus:`);
      legendariesObtained.forEach((name, idx) => {
        const isSaryel = name === 'Saryel';
        console.log(`   ${idx + 1}. ${name}${isSaryel ? ' ⭐' : ''}`);
      });
    }
    
    console.log("\n════════════════════════════════════════\n");
    
    // ✅ Analyse qualitative détaillée
    if (!gotSaryel && legendaryCount > 0) {
      console.log("🔧 DIAGNOSTIC:");
      console.log("   ❌ Le système de focus ne fonctionne PAS correctement.");
      console.log("   Le premier Legendary devrait TOUJOURS être Saryel (guaranteed: true).");
      console.log("   Vérifiez hasPlayerPulledLegendaryOnBanner() dans GachaService.\n");
    } else if (saryelCount === legendaryCount && legendaryCount > 1) {
      console.log("✅ PARFAIT: Tous les legendaries sont Saryel (focus 100%)!");
      console.log("   Le système fonctionne idéalement.\n");
    } else if (legendaryCount === 1 && saryelCount === 1) {
      console.log("✅ BON: Premier Legendary est Saryel (guaranteed fonctionne).");
      console.log("   Pas assez de données pour tester le rate-up à 75%.\n");
    } else if (saryelCount / legendaryCount >= 0.6) {
      console.log("✅ BON: Le système de focus fonctionne correctement.");
      console.log(`   Taux observé: ${((saryelCount / legendaryCount) * 100).toFixed(1)}% (attendu: ~75%).\n`);
    } else if (saryelCount / legendaryCount >= 0.4) {
      console.log("⚠️  MOYEN: Taux de focus un peu bas.");
      console.log(`   Taux observé: ${((saryelCount / legendaryCount) * 100).toFixed(1)}% (attendu: ~75%).`);
      console.log("   Statistiquement possible avec petit échantillon, mais à surveiller.\n");
    } else {
      console.log("❌ PROBLÈME: Taux de focus trop bas !");
      console.log(`   Taux observé: ${((saryelCount / legendaryCount) * 100).toFixed(1)}% (attendu: ~75%).`);
      console.log("   Vérifiez focusChance dans la bannière.\n");
    }
    
    // ✅ Analyse du taux de legendary
    const legendaryRate = (legendaryCount / totalPulls) * 100;
    if (legendaryRate < 1.5) {
      console.log("⚠️  TAUX LEGENDARY BAS: Vous avez eu moins de chance que prévu.");
    } else if (legendaryRate > 2.5) {
      console.log("🍀 CHANCEUX: Vous avez eu plus de Legendary que le taux normal !");
    } else {
      console.log("✅ Taux de Legendary conforme aux attentes (~2%).");
    }
    
  } catch (err: any) {
    console.error("\n❌ Erreur durant la simulation:", err.message);
    console.error("Stack:", err.stack);
  }
}

if (require.main === module) {
  main();
}

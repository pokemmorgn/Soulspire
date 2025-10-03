import mongoose from "mongoose";
import dotenv from "dotenv";
import CampaignWorld from "../models/CampaignWorld";
import Player from "../models/Player";
import Hero from "../models/Hero";
import Monster from "../models/Monster";
import { BattleService } from "../services/BattleService";

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
  cyan: "\x1b[36m"
};

function colorLog(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

const testWaves = async (): Promise<void> => {
  try {
    colorLog(colors.cyan, "\n🌊 === TEST SYSTÈME DE VAGUES ===\n");
    
    await mongoose.connect(MONGO_URI);
    colorLog(colors.green, "✅ Connecté à MongoDB");

    // 1. Créer ou récupérer un joueur de test
    const testPlayer = await getOrCreateTestPlayer();
    colorLog(colors.blue, `👤 Joueur de test: ${testPlayer.displayName}`);

    // 2. Équiper des héros
    await equipTestHeroes(testPlayer);
    colorLog(colors.blue, `⚔️ ${testPlayer.heroes.filter((h: any) => h.equipped).length} héros équipés`);

    // 3. Créer un monde de test avec vagues
    await createTestWorldWithWaves();
    colorLog(colors.green, "✅ Monde de test avec vagues créé");

    // 4. Test 1 : Combat avec vagues automatiques (enableWaves = true)
    colorLog(colors.cyan, "\n🧪 === TEST 1 : VAGUES AUTOMATIQUES ===");
    await testAutoWaves(testPlayer);

    // 5. Test 2 : Combat avec vagues configurées manuellement
    colorLog(colors.cyan, "\n🧪 === TEST 2 : VAGUES CONFIGURÉES ===");
    await testConfiguredWaves(testPlayer);

    // 6. Test 3 : Combat classique sans vagues
    colorLog(colors.cyan, "\n🧪 === TEST 3 : COMBAT CLASSIQUE (PAS DE VAGUES) ===");
    await testNoWaves(testPlayer);

    colorLog(colors.cyan, "\n🎉 === TOUS LES TESTS TERMINÉS ===\n");
    
  } catch (error) {
    colorLog(colors.red, `❌ Erreur lors des tests: ${error}`);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    colorLog(colors.green, "🔌 Déconnecté de MongoDB");
  }
};

async function getOrCreateTestPlayer() {
  // Importer Account et IdGenerator
  const Account = (await import("../models/Account")).default;
  const { IdGenerator } = await import("../utils/idGenerator");
  
  // Chercher ou créer le compte
  let account = await Account.findOne({ username: "WaveTestAccount" });
  
  if (!account) {
    account = new Account({
      username: "WaveTestAccount",
      password: "test123hash", // Hashé en production
      accountStatus: "active"
    });
    await account.save();
    colorLog(colors.yellow, "🆕 Compte de test créé");
  }
  
  // Chercher ou créer le joueur sur S1
  let player = await Player.findOne({ 
    accountId: account._id,
    serverId: "S1" 
  });
  
  if (!player) {
    player = new Player({
      accountId: account._id,
      serverId: "S1",
      displayName: "WaveTestPlayer",
      level: 50,
      gold: 10000,
      gems: 1000,
      vipLevel: 5,
      vipExperience: 0,
      world: 1,
      stage: 1
    });
    await player.save();
    colorLog(colors.yellow, "🆕 Joueur de test créé sur serveur S1");
  } else {
    // Mettre à jour le VIP si nécessaire
    if (player.vipLevel < 5) {
      player.vipLevel = 5;
      await player.save();
      colorLog(colors.blue, "📋 VIP mis à jour à 5");
    }
  }
  
  return player;
}

async function equipTestHeroes(player: any) {
  const heroesWithSpells = await Hero.find({
    name: { $in: ["Ignara", "Aureon", "Veyron", "Pyra", "Aqualis"] }
  }).limit(5);
  
  if (heroesWithSpells.length === 0) {
    throw new Error("Aucun héros trouvé ! Lancez d'abord le seed des héros.");
  }

  player.heroes = [];
  for (let i = 0; i < heroesWithSpells.length; i++) {
    const hero = heroesWithSpells[i];
    player.heroes.push({
      heroId: (hero._id as any).toString(),
      level: 30 + i * 5,
      stars: Math.min(6, 4 + i),
      equipped: true
    });
  }
  
  await player.save();
}

async function createTestWorldWithWaves() {
  // Supprimer l'ancien monde de test s'il existe
  await CampaignWorld.deleteOne({ worldId: 999 });

  // Récupérer quelques monstres pour les tests
  const monsters = await Monster.find().limit(10);
  if (monsters.length === 0) {
    throw new Error("Aucun monstre trouvé ! Lancez d'abord le seed des monstres.");
  }

  const monsterPool = monsters.map(m => m.monsterId);

  // Créer le monde de test
  const testWorld = new CampaignWorld({
    worldId: 3,
    name: "Test World - Waves System",
    description: "Monde de test pour le système de vagues",
    mapTheme: "testing_grounds",
    levelCount: 3,
    minPlayerLevel: 1,
    recommendedPower: 1000,
    elementBias: ["Fire", "Water"],
    defaultMonsterPool: monsterPool,
    levels: [
      {
        // Niveau 1 : Vagues automatiques (boss)
        levelIndex: 1,
        name: "Test Auto Waves (Boss)",
        enableWaves: true,
        autoWaveCount: 3,
        enemyType: "boss",
        autoGenerate: {
          useWorldPool: true,
          count: 3,
          enemyType: "normal"
        },
        staminaCost: 6,
        rewards: {
          experience: 100,
          gold: 50,
          items: [],
          fragments: []
        },
        waveRewards: {
          perWave: {
            experience: 30,
            gold: 20,
            items: [],
            fragments: []
          },
          finalWave: {
            experience: 100,
            gold: 80,
            items: ["wave_clear_token"],
            fragments: []
          }
        }
      },
      {
        // Niveau 2 : Vagues configurées manuellement
        levelIndex: 2,
        name: "Test Configured Waves",
        waves: [
          {
            waveNumber: 1,
            monsters: [
              { monsterId: monsterPool[0], count: 2, position: 1 },
              { monsterId: monsterPool[1], count: 1, position: 2 }
            ],
            delay: 3000,
            isBossWave: false,
            waveRewards: {
              experience: 40,
              gold: 25,
              items: [],
              fragments: []
            }
          },
          {
            waveNumber: 2,
            monsters: [
              { monsterId: monsterPool[2], count: 1, position: 1, levelOverride: 35, starsOverride: 5 }
            ],
            delay: 5000,
            isBossWave: true,
            waveRewards: {
              experience: 120,
              gold: 100,
              items: ["boss_token"],
              fragments: []
            }
          }
        ],
        staminaCost: 8,
        rewards: {
          experience: 160,
          gold: 125,
          items: ["wave_master_token"],
          fragments: []
        }
      },
      {
        // Niveau 3 : Combat classique (pas de vagues)
        levelIndex: 3,
        name: "Test Classic Battle (No Waves)",
        autoGenerate: {
          useWorldPool: true,
          count: 3,
          enemyType: "normal"
        },
        staminaCost: 6,
        rewards: {
          experience: 80,
          gold: 40,
          items: [],
          fragments: []
        }
      }
    ]
  });

  await testWorld.save();
}

async function testAutoWaves(player: any) {
  try {
    colorLog(colors.yellow, "🎯 Lancement combat avec vagues automatiques (Monde 999, Niveau 1)...");
    
    const battleResult = await BattleService.startCampaignBattle(
      (player._id as any).toString(),
      "S1",
      999,
      1,
      "Normal",
      { mode: "auto", speed: 3 }
    );

    displayBattleResult(battleResult, "VAGUES AUTOMATIQUES");

  } catch (error: any) {
    colorLog(colors.red, `❌ Erreur test auto waves: ${error.message}`);
  }
}

async function testConfiguredWaves(player: any) {
  try {
    colorLog(colors.yellow, "🎯 Lancement combat avec vagues configurées (Monde 999, Niveau 2)...");
    
    const battleResult = await BattleService.startCampaignBattle(
      (player._id as any).toString(),
      "S1",
      999,
      2,
      "Normal",
      { mode: "auto", speed: 3 }
    );

    displayBattleResult(battleResult, "VAGUES CONFIGURÉES");

  } catch (error: any) {
    colorLog(colors.red, `❌ Erreur test configured waves: ${error.message}`);
  }
}

async function testNoWaves(player: any) {
  try {
    colorLog(colors.yellow, "🎯 Lancement combat classique sans vagues (Monde 999, Niveau 3)...");
    
    const battleResult = await BattleService.startCampaignBattle(
      (player._id as any).toString(),
      "S1",
      999,
      3,
      "Normal",
      { mode: "auto", speed: 3 }
    );

    displayBattleResult(battleResult, "COMBAT CLASSIQUE");

  } catch (error: any) {
    colorLog(colors.red, `❌ Erreur test no waves: ${error.message}`);
  }
}

function displayBattleResult(battleResult: any, testName: string) {
  const { result, replay } = battleResult;
  
  colorLog(colors.cyan, `\n📊 === RÉSULTATS ${testName} ===`);
  
  if (result.victory) {
    colorLog(colors.green, `🏆 VICTOIRE !`);
  } else {
    colorLog(colors.red, `💀 DÉFAITE...`);
  }
  
  console.log(`⏱️  Durée: ${Math.round(result.battleDuration / 1000)}s`);
  console.log(`🎯 Tours total: ${result.totalTurns}`);
  
  // Vérifier si c'est un combat multi-vagues
  if (replay.waveData) {
    colorLog(colors.magenta, `\n🌊 DONNÉES DE VAGUES:`);
    console.log(`   Vagues totales: ${replay.waveData.totalWaves}`);
    console.log(`   Vagues complétées: ${replay.waveData.completedWaves}`);
    
    if (replay.waveData.waveRewards && replay.waveData.waveRewards.length > 0) {
      colorLog(colors.yellow, `\n💰 RÉCOMPENSES PAR VAGUE:`);
      for (const waveReward of replay.waveData.waveRewards) {
        console.log(`   Vague ${waveReward.waveNumber}: ${waveReward.rewards.gold} or, ${waveReward.rewards.experience} XP`);
        if (waveReward.rewards.items && waveReward.rewards.items.length > 0) {
          console.log(`      Items: ${waveReward.rewards.items.join(", ")}`);
        }
      }
      
      // Total des récompenses de vagues
      const totalGold = replay.waveData.waveRewards.reduce((sum: number, wr: any) => sum + wr.rewards.gold, 0);
      const totalExp = replay.waveData.waveRewards.reduce((sum: number, wr: any) => sum + wr.rewards.experience, 0);
      colorLog(colors.green, `   TOTAL: ${totalGold} or, ${totalExp} XP`);
    }
    
    if (replay.waveData.playerStatePerWave && replay.waveData.playerStatePerWave.length > 0) {
      colorLog(colors.blue, `\n🏥 ÉTAT DE L'ÉQUIPE PAR VAGUE:`);
      for (const waveState of replay.waveData.playerStatePerWave) {
        const aliveCount = waveState.heroes.filter((h: any) => h.alive).length;
        const avgHpPercent = Math.round(
          waveState.heroes
            .filter((h: any) => h.alive)
            .reduce((sum: number, h: any) => sum + (h.currentHp / 100), 0) / aliveCount * 100
        );
        console.log(`   Fin vague ${waveState.waveNumber}: ${aliveCount}/${waveState.heroes.length} héros vivants (HP moy: ${avgHpPercent}%)`);
      }
    }
  } else {
    colorLog(colors.blue, `📝 Combat classique (pas de vagues)`);
  }
  
  colorLog(colors.yellow, `\n📊 STATISTIQUES:`);
  console.log(`💥 Dégâts infligés: ${result.stats.totalDamageDealt}`);
  console.log(`💚 Soins effectués: ${result.stats.totalHealingDone}`);
  console.log(`⚡ Coups critiques: ${result.stats.criticalHits}`);
  console.log(`🌟 Ultimates utilisés: ${result.stats.ultimatesUsed}`);
  
  if (result.victory && result.rewards) {
    colorLog(colors.green, `\n🎁 RÉCOMPENSES FINALES:`);
    console.log(`💰 Or total: ${result.rewards.gold}`);
    console.log(`⭐ Expérience totale: ${result.rewards.experience}`);
    if (result.rewards.items && result.rewards.items.length > 0) {
      console.log(`📦 Items: ${result.rewards.items.join(", ")}`);
    }
  }
  
  // Analyse des actions par vague
  if (replay.waveData && replay.actions) {
    colorLog(colors.cyan, `\n⚔️ ACTIONS PAR VAGUE:`);
    const actionsByWave: Record<number, number> = {};
    
    for (const action of replay.actions) {
      const waveNum = (action as any).waveNumber || 1;
      actionsByWave[waveNum] = (actionsByWave[waveNum] || 0) + 1;
    }
    
    for (const [wave, count] of Object.entries(actionsByWave)) {
      console.log(`   Vague ${wave}: ${count} actions`);
    }
  }
  
  console.log("");
}

function showUsage() {
  colorLog(colors.cyan, "\n🌊 === SCRIPT DE TEST SYSTÈME DE VAGUES ===");
  console.log("Ce script teste le système de vagues complet:");
  console.log("• Test 1: Vagues automatiques (enableWaves = true)");
  console.log("• Test 2: Vagues configurées manuellement");
  console.log("• Test 3: Combat classique sans vagues");
  console.log("\nPrérequis:");
  console.log("• Héros créés avec: npx ts-node src/scripts/seedHeroes.ts");
  console.log("• Monstres créés avec: npx ts-node src/scripts/seedMonsters.ts");
  console.log("\nLancement:");
  console.log("npx ts-node src/scripts/testWaves.ts");
  console.log("");
}

if (require.main === module) {
  showUsage();
  testWaves().then(() => process.exit(0));
}

export { testWaves };

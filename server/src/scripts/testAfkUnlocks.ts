import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import { AfkRewardsService } from "../services/AfkRewardsService";
import { AfkUnlockSystem } from "../services/AfkUnlockSystem";

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

async function createTestPlayersForUnlocks() {
  log(colors.yellow, "🏗️ Création des joueurs test pour Progressive Unlocks...");

  const testPlayers = [
    {
      username: "UnlockTestBeginner",
      world: 1,
      level: 5,
      vipLevel: 0,
      description: "Débutant (or seulement)"
    },
    {
      username: "UnlockTestEarly",
      world: 3,
      level: 15,
      vipLevel: 1,
      description: "Early game (or + fusion + fragments communs)"
    },
    {
      username: "UnlockTestMid",
      world: 8,
      level: 45,
      vipLevel: 3,
      description: "Mid game (or + matériaux + gems)"
    },
    {
      username: "UnlockTestAdvanced",
      world: 12,
      level: 80,
      vipLevel: 5,
      description: "Advanced (or + gems + tickets)"
    },
    {
      username: "UnlockTestEndGame",
      world: 18,
      level: 100, // Réduit de 120 à 100 pour respecter la limite du schéma
      vipLevel: 8,
      description: "End game (toutes récompenses)"
    }
  ];

  const createdPlayers = [];

  for (const playerData of testPlayers) {
    let player = await Player.findOne({ username: playerData.username });
    
    if (!player) {
      player = new Player({
        username: playerData.username,
        password: "test123",
        serverId: "S1",
        gold: 5000,
        gems: 200,
        world: playerData.world,
        level: playerData.level,
        difficulty: "Normal",
        vipLevel: playerData.vipLevel,
        heroes: [
          { heroId: "hero_001", level: Math.floor(playerData.level * 0.8), stars: 2, equipped: true, slot: 1 },
          { heroId: "hero_002", level: Math.floor(playerData.level * 0.7), stars: 2, equipped: true, slot: 2 },
          { heroId: "hero_003", level: Math.floor(playerData.level * 0.6), stars: 1, equipped: true, slot: 3 }
        ]
      });
      await player.save();
      log(colors.green, `✅ Créé ${playerData.username} - ${playerData.description}`);
    } else {
      // Mettre à jour le niveau s'il était trop élevé
      if (player.level > 100) {
        player.level = 100;
        await player.save();
        log(colors.yellow, `📝 Mis à jour ${playerData.username} - niveau ajusté à 100`);
      }
      log(colors.blue, `📋 Existant ${playerData.username} - ${playerData.description}`);
    }

    createdPlayers.push({
      player,
      description: playerData.description
    });
  }

  return createdPlayers;
}

async function testUnlockValidation() {
  log(colors.bright, "\n🔍 === TEST VALIDATION CONFIGURATION ===");

  const validation = AfkUnlockSystem.validateConfig();
  
  if (validation.valid) {
    log(colors.green, "✅ Configuration des déblocages valide");
  } else {
    log(colors.red, "❌ Erreurs dans la configuration:");
    validation.errors.forEach(error => console.log(`  • ${error}`));
  }

  const stats = AfkUnlockSystem.getConfigStats();
  console.table({
    "Total Rewards": stats.totalRewards,
    "Categories": Object.keys(stats.byCategory).join(", "),
    "Rarities": Object.keys(stats.byRarity).join(", "),
    "Worlds with Unlocks": Object.keys(stats.byWorld).join(", "),
    "Average Base Rate": stats.averageBaseRate
  });

  log(colors.cyan, "📊 Répartition par catégorie:");
  console.table(stats.byCategory);

  log(colors.cyan, "📊 Répartition par rareté:");
  console.table(stats.byRarity);
}

async function testUnlocksForPlayer(playerId: string, playerName: string, description: string) {
  log(colors.bright, `\n🎯 === TEST DÉBLOCAGES - ${playerName} ===`);
  log(colors.white, description);

  try {
    const player = await Player.findById(playerId).select("world level username");
    if (!player) {
      log(colors.red, "❌ Joueur non trouvé");
      return;
    }

    // Test 1: Déblocages disponibles
    log(colors.blue, "\n📋 Déblocages disponibles:");
    const unlockInfo = AfkUnlockSystem.getUnlockInfo(player.world, player.level);
    
    console.table({
      "Unlocked Count": unlockInfo.unlocked.length,
      "Total Available": unlockInfo.totalAvailable,
      "Progress %": unlockInfo.progressPercentage
    });

    if (unlockInfo.unlocked.length > 0) {
      log(colors.green, "✅ Récompenses débloquées:");
      unlockInfo.unlocked.forEach(unlock => {
        const rate = AfkUnlockSystem.getBaseRate(unlock.rewardType, player.world, player.level);
        const multiplier = AfkUnlockSystem.getProgressionMultiplier(unlock.rewardType, player.world, player.level);
        console.log(`  • ${unlock.rewardType} (${unlock.category}) - Rate: ${rate}/min - Multiplier: ${multiplier.toFixed(2)}x`);
      });
    }

    if (unlockInfo.upcoming.length > 0) {
      log(colors.yellow, "🔮 Prochains déblocages:");
      unlockInfo.upcoming.forEach(unlock => {
        const levelsToGo = AfkUnlockSystem.getLevelsToUnlock(unlock.rewardType, player.world, player.level);
        console.log(`  • ${unlock.rewardType}: ${unlock.requirement.description} (${levelsToGo.totalLevelsToGo} niveaux restants)`);
      });
    }

    // Test 2: Calcul des récompenses avec déblocages
    log(colors.magenta, "\n💎 Calcul récompenses AFK avec déblocages:");
    
    try {
      const rewards = await AfkRewardsService.calculatePlayerAfkRewards(playerId);
      
      console.table({
        "Rewards Count": rewards.rewards.length,
        "Gold/min": rewards.ratesPerMinute.gold,
        "Gems/min": rewards.ratesPerMinute.exp,
        "Materials/min": rewards.ratesPerMinute.materials,
        "Total Multiplier": rewards.multipliers.total,
        "Unlock Progress": `${rewards.unlockMeta?.progressPercentage}%`
      });

      if (rewards.rewards.length > 0) {
        log(colors.white, "🎁 Récompenses par minute:");
        rewards.rewards.forEach(reward => {
          const type = reward.currencyType || reward.materialId || reward.fragmentId || reward.itemId;
          console.log(`  ${reward.type}/${type}: ${reward.quantity}/min (base: ${reward.baseQuantity})`);
        });
      }

      if (rewards.unlockMeta?.nextUnlocks && rewards.unlockMeta.nextUnlocks.length > 0) {
        log(colors.cyan, "🚀 Prochains déblocages motivants:");
        rewards.unlockMeta.nextUnlocks.forEach((unlock: string) => {
          console.log(`  • ${unlock}`);
        });
      }

      // Test 3: Simulation gains 1h avec déblocages
      log(colors.green, "\n⏳ Simulation 1h avec déblocages:");
      const simulation = await AfkRewardsService.simulateAfkGains(playerId, 1);
      
      console.table({
        "Total Value": simulation.totalValue,
        "Rewards Types": simulation.rewards.length,
        "Unlock Progress": `${simulation.unlockMeta?.progressPercentage}%`
      });

      if (simulation.rewards.length > 0) {
        log(colors.white, "💰 Gains simulés (1h):");
        simulation.rewards.slice(0, 8).forEach(reward => {
          const type = reward.currencyType || reward.materialId || reward.fragmentId || reward.itemId;
          console.log(`  ${reward.type}/${type}: ${reward.quantity}`);
        });
      }

      return {
        unlockedCount: unlockInfo.unlocked.length,
        totalValue: simulation.totalValue,
        rewardsCount: rewards.rewards.length
      };

    } catch (error: any) {
      log(colors.red, `❌ Erreur calcul récompenses pour ${playerName}: ${error.message}`);
      // Retourner des valeurs par défaut
      return {
        unlockedCount: unlockInfo.unlocked.length,
        totalValue: 0,
        rewardsCount: 0
      };
    }

  } catch (error: any) {
    log(colors.red, `❌ Erreur test ${playerName}: ${error.message}`);
    return null;
  }
}

async function testProgressionSimulation() {
  log(colors.bright, "\n📈 === TEST SIMULATION PROGRESSION ===");

  // Simuler progression d'un joueur monde 1 → monde 10
  const progressionSteps = [
    { world: 1, level: 1, description: "Début du jeu" },
    { world: 1, level: 10, description: "EXP débloqué" },
    { world: 2, level: 1, description: "Fusion Crystals débloqués" },
    { world: 3, level: 1, description: "Fragments communs débloqués" },
    { world: 4, level: 1, description: "Elemental Essence débloquée" },
    { world: 6, level: 1, description: "Ascension Stones débloquées" },
    { world: 8, level: 1, description: "Gems débloquées" },
    { world: 10, level: 1, description: "Fragments épiques débloqués" },
    { world: 12, level: 1, description: "Tickets débloqués" }
  ];

  const progressionResults = [];

  for (const step of progressionSteps) {
    const unlocked = AfkUnlockSystem.getUnlockedRewards(step.world, step.level);
    const upcoming = AfkUnlockSystem.getUpcomingUnlocks(step.world, step.level, 1);
    
    progressionResults.push({
      Stage: `${step.world}-${step.level}`,
      Description: step.description,
      "Unlocked Count": unlocked.length,
      "Next Unlock": upcoming.length > 0 ? upcoming[0].rewardType : "None",
      "Progress %": Math.round((unlocked.length / 12) * 100) // Approximativement 12 récompenses totales
    });
  }

  console.table(progressionResults);

  // Test détection nouveaux déblocages
  log(colors.cyan, "\n🆕 Test détection nouveaux déblocages:");
  
  for (let i = 1; i < progressionSteps.length; i++) {
    const previous = progressionSteps[i - 1];
    const current = progressionSteps[i];
    
    const recentUnlocks = AfkUnlockSystem.getRecentUnlocks(
      previous.world, previous.level,
      current.world, current.level
    );

    if (recentUnlocks.length > 0) {
      log(colors.green, `✨ ${previous.world}-${previous.level} → ${current.world}-${current.level}:`);
      recentUnlocks.forEach(unlock => {
        console.log(`  🎉 ${unlock.requirement.unlockMessage}`);
      });
    }
  }
}

async function testComparisonBetweenPlayers(players: any[]) {
  log(colors.bright, "\n⚖️ === COMPARAISON ENTRE JOUEURS ===");

  const comparisonData = [];

  for (const { player, description } of players) {
    try {
      const playerId = (player._id as any).toString();
      
      // Essayer de calculer les récompenses de manière sécurisée
      let rewards, simulation1h;
      
      try {
        rewards = await AfkRewardsService.calculatePlayerAfkRewards(playerId);
        simulation1h = await AfkRewardsService.simulateAfkGains(playerId, 1);
      } catch (error: any) {
        log(colors.yellow, `⚠️ Erreur calcul pour ${player.username}, utilisation de valeurs par défaut`);
        
        // Valeurs par défaut en cas d'erreur
        rewards = {
          rewards: [],
          multipliers: { vip: 1, stage: 1, heroes: 1, total: 1 },
          ratesPerMinute: { gold: 100, exp: 50, materials: 10 },
          unlockMeta: {
            unlockedRewardsCount: AfkUnlockSystem.getUnlockedRewards(player.world, player.level).length,
            progressPercentage: Math.round((AfkUnlockSystem.getUnlockedRewards(player.world, player.level).length / 12) * 100)
          }
        };
        
        simulation1h = {
          totalValue: rewards.ratesPerMinute.gold * 60 * 0.001, // Estimation basique
          rewards: []
        };
      }

      comparisonData.push({
        Player: player.username,
        "World-Level": `${player.world}-${player.level}`,
        "VIP": player.vipLevel,
        "Unlocked": rewards.unlockMeta?.unlockedRewardsCount || 0,
        "Progress %": rewards.unlockMeta?.progressPercentage || 0,
        "Gold/h": Math.floor(rewards.ratesPerMinute.gold * 60),
        "Rewards Types": rewards.rewards.length,
        "1h Value": simulation1h.totalValue
      });
    } catch (error: any) {
      log(colors.red, `❌ Erreur comparaison ${player.username}: ${error.message}`);
      
      // Ajouter une entrée avec des valeurs par défaut
      comparisonData.push({
        Player: player.username,
        "World-Level": `${player.world}-${player.level}`,
        "VIP": player.vipLevel,
        "Unlocked": AfkUnlockSystem.getUnlockedRewards(player.world, player.level).length,
        "Progress %": Math.round((AfkUnlockSystem.getUnlockedRewards(player.world, player.level).length / 12) * 100),
        "Gold/h": 0,
        "Rewards Types": 0,
        "1h Value": 0
      });
    }
  }

  console.table(comparisonData);

  // Analyser la progression
  log(colors.cyan, "\n📊 Analyse de la progression:");
  if (comparisonData.length >= 2) {
    const beginner = comparisonData[0];
    const endgame = comparisonData[comparisonData.length - 1];
    
    const goldImprovement = beginner["Gold/h"] > 0 ? 
      Math.round((endgame["Gold/h"] / beginner["Gold/h"]) * 100) / 100 : "∞";
    const valueImprovement = beginner["1h Value"] > 0 ? 
      Math.round((endgame["1h Value"] / beginner["1h Value"]) * 100) / 100 : "∞";
    
    console.table({
      "Gold Improvement": `${goldImprovement}x`,
      "Value Improvement": `${valueImprovement}x`,
      "Unlock Progression": `${beginner["Unlocked"]} → ${endgame["Unlocked"]} types`,
      "Progress": `${beginner["Progress %"]}% → ${endgame["Progress %"]}%`
    });
  }
}

async function testSpecificUnlocks() {
  log(colors.bright, "\n🎯 === TEST DÉBLOCAGES SPÉCIFIQUES ===");

  const testCases = [
    { reward: "gold", expectedWorld: 1, expectedLevel: 1 },
    { reward: "exp", expectedWorld: 1, expectedLevel: 10 },
    { reward: "fusion_crystal", expectedWorld: 2, expectedLevel: 1 },
    { reward: "gems", expectedWorld: 8, expectedLevel: 1 },
    { reward: "tickets", expectedWorld: 12, expectedLevel: 1 },
    { reward: "legendary_hero_fragments", expectedWorld: 18, expectedLevel: 1 }
  ];

  log(colors.white, "🧪 Test des conditions de déblocage:");
  
  testCases.forEach(testCase => {
    // Test juste avant le déblocage
    const beforeUnlock = AfkUnlockSystem.isRewardUnlocked(
      testCase.reward as any,
      testCase.expectedWorld,
      Math.max(1, testCase.expectedLevel - 1)
    );
    
    // Test au moment du déblocage
    const atUnlock = AfkUnlockSystem.isRewardUnlocked(
      testCase.reward as any,
      testCase.expectedWorld,
      testCase.expectedLevel
    );
    
    // Test après le déblocage
    const afterUnlock = AfkUnlockSystem.isRewardUnlocked(
      testCase.reward as any,
      testCase.expectedWorld + 1,
      testCase.expectedLevel
    );
    
    const status = beforeUnlock ? "❌ ERREUR" : atUnlock && afterUnlock ? "✅ OK" : "❌ ERREUR";
    console.log(`  ${status} ${testCase.reward}: débloqué à ${testCase.expectedWorld}-${testCase.expectedLevel}`);
  });
}

/**
 * Test principal du système Progressive Unlocks
 */
async function testAfkUnlocks(): Promise<void> {
  try {
    log(colors.cyan, "\n🧪 === TEST AFK PROGRESSIVE UNLOCKS ===\n");
    await mongoose.connect(MONGO_URI);
    log(colors.green, "✅ Connecté à MongoDB");

    // Test 1: Validation de la configuration
    await testUnlockValidation();

    // Test 2: Création des joueurs de test
    const testPlayers = await createTestPlayersForUnlocks();

    // Test 3: Test déblocages spécifiques
    await testSpecificUnlocks();

    // Test 4: Test pour chaque joueur
    const playerResults = [];
    for (const { player, description } of testPlayers) {
      const playerId = (player._id as any).toString();
      const result = await testUnlocksForPlayer(playerId, player.username, description);
      if (result) {
        playerResults.push({ ...result, player, description });
      }
    }

    // Test 5: Simulation de progression
    await testProgressionSimulation();

    // Test 6: Comparaison entre joueurs
    await testComparisonBetweenPlayers(testPlayers);

    // Test 7: Vérification cohérence
    log(colors.bright, "\n🔍 === VÉRIFICATION COHÉRENCE ===");
    
    const beginnerResult = playerResults.find(r => r.player.world === 1);
    const endgameResult = playerResults.find(r => r.player.world >= 15);
    
    if (beginnerResult && endgameResult) {
      const isProgressionLogical = endgameResult.unlockedCount > beginnerResult.unlockedCount &&
                                  endgameResult.totalValue > beginnerResult.totalValue;
      
      if (isProgressionLogical) {
        log(colors.green, "✅ Progression logique confirmée : plus de progression = plus de récompenses");
      } else {
        log(colors.red, "❌ Problème de progression détecté");
      }
    }

    log(colors.cyan, "\n🎉 === TESTS PROGRESSIVE UNLOCKS TERMINÉS ===\n");

  } catch (err: any) {
    log(colors.red, `❌ Erreur test Progressive Unlocks: ${err.message}`);
    console.error(err);
  } finally {
    await mongoose.disconnect();
    log(colors.green, "🔌 Déconnecté de MongoDB");
  }
}

// Aide
function showUsage() {
  log(colors.cyan, "\n🎮 === SCRIPT DE TEST PROGRESSIVE UNLOCKS ===");
  console.log("Ce script teste le système de déblocage progressif AFK :");
  console.log("• 🔓 Déblocages selon le monde/niveau de progression");
  console.log("• 📊 Filtrage des récompenses selon ce qui est débloqué");
  console.log("• 🎯 Intégration avec AfkRewardsService modifié");
  console.log("• 📈 Simulation de progression et nouveaux déblocages");
  console.log("• ⚖️ Comparaisons entre différents niveaux de joueurs");
  console.log("• 🧪 Validation de la configuration des déblocages");
  console.log("\nLancement:");
  console.log("npx ts-node src/scripts/testAfkUnlocks.ts");
  console.log("");
}

if (require.main === module) {
  showUsage();
  testAfkUnlocks().then(() => process.exit(0));
}

export { testAfkUnlocks };

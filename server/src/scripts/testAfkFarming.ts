import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import CampaignWorld from "../models/CampaignWorld";
import CampaignProgress from "../models/CampaignProgress";
import AfkFarmingService from "../services/AfkFarmingService";
import { AfkRewardsService } from "../services/AfkRewardsService";
import AfkServiceEnhanced from "../services/AfkService";

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

async function createTestCampaignData() {
  log(colors.yellow, "🏗️ Création des données de campagne test...");
  
  // Créer quelques mondes test si ils n'existent pas
  for (let worldId = 1; worldId <= 10; worldId++) {
    const existingWorld = await CampaignWorld.findOne({ worldId });
    if (!existingWorld) {
      await CampaignWorld.create({
        worldId,
        name: `World ${worldId}`,
        description: `Test world ${worldId}`,
        mapTheme: `theme_${worldId}`,
        levelCount: 20,
        minPlayerLevel: (worldId - 1) * 10 + 1,
        recommendedPower: worldId * 1000,
        elementBias: ["Fire", "Water"],
        levels: Array.from({ length: 20 }, (_, i) => ({
          levelIndex: i + 1,
          name: `Level ${i + 1}`,
          enemyType: i === 19 ? "boss" : i % 5 === 4 ? "elite" : "normal",
          difficultyMultiplier: 1 + (i * 0.05),
          staminaCost: 6,
          rewards: {
            experience: 50 + worldId * 10,
            gold: 30 + worldId * 5,
            items: [],
            fragments: []
          }
        }))
      });
    }
  }
  log(colors.green, "✅ Mondes de campagne prêts");
}

async function getOrCreateFarmingTestPlayers() {
  // Joueur débutant (monde 3) - peut utiliser stage selection de base
  let beginnerPlayer = await Player.findOne({ username: "FarmTestBeginner" });
  if (!beginnerPlayer) {
    beginnerPlayer = new Player({
      username: "FarmTestBeginner",
      password: "test123",
      serverId: "S1",
      gold: 2000,
      gems: 100,
      world: 3,
      level: 25,
      difficulty: "Normal",
      vipLevel: 1,
      heroes: [
        { heroId: "hero_001", level: 15, stars: 2, equipped: true, slot: 1 },
        { heroId: "hero_002", level: 12, stars: 1, equipped: true, slot: 2 }
      ]
    });
    await beginnerPlayer.save();
    log(colors.yellow, "🆕 Joueur Beginner créé (monde 3)");
  }

  // Joueur avancé (monde 8) - accès complet Normal + Hard potentiel
  let advancedPlayer = await Player.findOne({ username: "FarmTestAdvanced" });
  if (!advancedPlayer) {
    advancedPlayer = new Player({
      username: "FarmTestAdvanced", 
      password: "test123",
      serverId: "S1",
      gold: 50000,
      gems: 1000,
      world: 8,
      level: 75,
      difficulty: "Hard",
      vipLevel: 5,
      heroes: [
        { heroId: "hero_001", level: 40, stars: 4, equipped: true, slot: 1 },
        { heroId: "hero_002", level: 38, stars: 3, equipped: true, slot: 2 },
        { heroId: "hero_003", level: 35, stars: 3, equipped: true, slot: 3 },
        { heroId: "hero_004", level: 32, stars: 2, equipped: true, slot: 4 },
        { heroId: "hero_005", level: 30, stars: 2, equipped: true, slot: 5 }
      ]
    });
    await advancedPlayer.save();
    log(colors.yellow, "🆕 Joueur Advanced créé (monde 8, VIP 5)");
  }

  // Créer quelques progressions de campagne
  for (const player of [beginnerPlayer, advancedPlayer]) {
    const playerId = (player._id as any).toString();
    const maxWorld = player.displayName === "FarmTestBeginner" ? 3 : 8;
    
    for (let worldId = 1; worldId <= maxWorld; worldId++) {
      const existingProgress = await CampaignProgress.findOne({ playerId, serverId: "S1", worldId });
      if (!existingProgress) {
        const levelCleared = worldId < maxWorld ? 20 : (player.level - (worldId - 1) * 10);
        await CampaignProgress.create({
          playerId,
          serverId: "S1",
          worldId,
          highestLevelCleared: Math.max(0, levelCleared),
          starsByLevel: Array.from({ length: Math.max(0, levelCleared) }, (_, i) => ({
            levelIndex: i + 1,
            stars: Math.floor(Math.random() * 3) + 1,
            bestTimeMs: 30000 + Math.random() * 20000
          })),
          progressByDifficulty: [
            {
              difficulty: "Normal",
              highestLevelCleared: Math.max(0, levelCleared),
              starsByLevel: Array.from({ length: Math.max(0, levelCleared) }, (_, i) => ({
                levelIndex: i + 1,
                stars: Math.floor(Math.random() * 3) + 1
              })),
              isCompleted: levelCleared >= 20,
              completedAt: levelCleared >= 20 ? new Date() : undefined
            }
          ],
          totalStarsEarned: levelCleared * 2,
          firstCompletionDate: levelCleared >= 20 ? new Date() : undefined
        });
      }
    }
  }

  return { beginnerPlayer, advancedPlayer };
}

async function showFarmingInfo(playerId: string, title: string) {
  log(colors.cyan, `\n📊 ${title}`);
  
  try {
    const farmingInfo = await AfkFarmingService.getFarmingStageInfo(playerId);
    
    if (!farmingInfo.success) {
      log(colors.red, `❌ Erreur: ${farmingInfo.error}`);
      return;
    }

    const info = farmingInfo.data!;
    
    console.table({
      "Current Farm": info.currentFarmingStage.description,
      "Is Custom": info.currentFarmingStage.isCustom,
      "Player Stage": info.playerProgressionStage.description,
      "Farm Active": info.farmingChoice.isActive,
      "Farm Valid": info.farmingChoice.isValid,
      "Reward Multiplier": info.expectedRewards.rewardMultiplier,
      "Efficiency vs Progression": `${info.expectedRewards.comparedToProgression.efficiency}%`
    });

    if (info.expectedRewards.specialDrops.length > 0) {
      log(colors.white, `🎁 Special Drops: ${info.expectedRewards.specialDrops.join(", ")}`);
    }

    if (info.expectedRewards.comparedToProgression.betterFor.length > 0) {
      log(colors.green, `✅ Better for: ${info.expectedRewards.comparedToProgression.betterFor.join(", ")}`);
    }

    if (info.expectedRewards.comparedToProgression.worseFor.length > 0) {
      log(colors.yellow, `⚠️ Worse for: ${info.expectedRewards.comparedToProgression.worseFor.join(", ")}`);
    }

    return info;
  } catch (error: any) {
    log(colors.red, `❌ Erreur showFarmingInfo: ${error.message}`);
  }
}

async function testStageSelection(playerId: string, playerName: string) {
  log(colors.bright, `\n🎯 === TEST STAGE SELECTION - ${playerName} ===`);

  // 1. État initial
  await showFarmingInfo(playerId, `${playerName} - État Initial`);

  // 2. Obtenir les stages disponibles
  log(colors.blue, "\n📋 Stages disponibles:");
  const stagesResult = await AfkFarmingService.getAvailableFarmingStages(playerId);
  
  if (stagesResult.success && stagesResult.stages) {
    console.table(stagesResult.stages.slice(0, 10).map(stage => ({
      Description: stage.description,
      "Reward Multiplier": stage.rewardMultiplier,
      "Currently Farming": stage.isCurrentlyFarming,
      "Is Progression": stage.isPlayerProgression,
      "Special Drops": stage.specialDrops.slice(0, 2).join(", ") || "None"
    })));
    
    log(colors.white, `Total stages disponibles: ${stagesResult.stages.length}`);
    
    if (stagesResult.recommendations && stagesResult.recommendations.length > 0) {
      log(colors.cyan, "💡 Recommandations:");
      stagesResult.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    // 3. Test: définir un stage de farm custom (ancien monde pour fragments)
    const targetStages = stagesResult.stages.filter(s => 
      s.world <= 2 && s.difficulty === "Normal" && !s.isPlayerProgression
    );
    
    if (targetStages.length > 0) {
      const targetStage = targetStages[0];
      log(colors.green, `\n🔄 Test: définir farm custom sur ${targetStage.description}`);
      
      const setResult = await AfkFarmingService.setPlayerFarmingTarget(
        playerId,
        targetStage.world,
        targetStage.level,
        targetStage.difficulty,
        {
          reason: "fragments",
          targetHeroFragments: "hero_001",
          validateFirst: true
        }
      );
      
      if (setResult.success) {
        log(colors.green, "✅ Stage de farm défini avec succès!");
        await showFarmingInfo(playerId, `${playerName} - Après Custom Farm`);
      } else {
        log(colors.red, `❌ Échec définition farm: ${setResult.error}`);
      }
    }

    // 4. Test: calculer récompenses avec stage selection
    log(colors.magenta, "\n💎 Test calcul récompenses avec stage selection:");
    
    try {
      const rewardsWithFarming = await AfkRewardsService.calculatePlayerAfkRewards(playerId);
      
      if (rewardsWithFarming.farmingMeta) {
        console.table({
          "Custom Farming": rewardsWithFarming.farmingMeta.isCustomFarming,
          "Farming Stage": rewardsWithFarming.farmingMeta.farmingStage,
          "Gold/min": rewardsWithFarming.ratesPerMinute.gold,
          "Gems/min": rewardsWithFarming.ratesPerMinute.exp,
          "Materials/min": rewardsWithFarming.ratesPerMinute.materials,
          "VIP Multiplier": rewardsWithFarming.multipliers.vip,
          "Total Multiplier": rewardsWithFarming.multipliers.total
        });
        
        log(colors.white, "🎁 Récompenses par minute:");
        rewardsWithFarming.rewards.forEach(reward => {
          const type = reward.currencyType || reward.materialId || reward.fragmentId || reward.itemId;
          console.log(`  ${reward.type}/${type}: ${reward.quantity}/min (base: ${reward.baseQuantity})`);
        });
      }
    } catch (error: any) {
      log(colors.red, `❌ Erreur calcul récompenses: ${error.message}`);
    }

    // 5. Test: reset vers stage de progression
    log(colors.blue, "\n🔄 Test: reset vers stage de progression");
    
    const resetResult = await AfkFarmingService.resetPlayerFarmingTarget(playerId);
    if (resetResult.success) {
      log(colors.green, "✅ Reset vers progression réussi!");
      await showFarmingInfo(playerId, `${playerName} - Après Reset`);
    } else {
      log(colors.red, `❌ Échec reset: ${resetResult.error}`);
    }
  } else {
    log(colors.red, `❌ Impossible de récupérer les stages: ${stagesResult.error}`);
  }
}

async function testRewardsPreview() {
  log(colors.bright, "\n🔮 === TEST PREVIEW RÉCOMPENSES ===");
  
  // Test preview pour différents stages
  const testStages = [
    { world: 1, level: 5, difficulty: "Normal" },
    { world: 3, level: 10, difficulty: "Normal" },
    { world: 5, level: 15, difficulty: "Hard" },
    { world: 8, level: 20, difficulty: "Nightmare" }
  ];

  for (const stage of testStages) {
    try {
      const { getExpectedRewards } = require("../models/AfkFarmingTarget");
      const rewards = await getExpectedRewards({
        selectedWorld: stage.world,
        selectedLevel: stage.level,
        selectedDifficulty: stage.difficulty
      });

      console.table({
        Stage: `${stage.world}-${stage.level} (${stage.difficulty})`,
        "Reward Multiplier": rewards.rewardMultiplier,
        "Special Drops": rewards.specialDrops.slice(0, 3).join(", ") || "None",
        "Recommended For": rewards.recommendedFor.slice(0, 2).join(", ") || "None"
      });
    } catch (error: any) {
      log(colors.red, `❌ Erreur preview ${stage.world}-${stage.level}: ${error.message}`);
    }
  }
}

async function testAfkIntegration(playerId: string, playerName: string) {
  log(colors.bright, `\n⚡ === TEST INTÉGRATION AFK - ${playerName} ===`);
  
  try {
    // 1. Définir un stage custom
    await AfkFarmingService.setPlayerFarmingTarget(playerId, 2, 10, "Normal", {
      reason: "fragments",
      validateFirst: true
    });

    // 2. Simuler accumulation AFK avec stage custom
    log(colors.yellow, "⏳ Simulation AFK avec stage custom...");
    
    const simulation = await AfkRewardsService.simulateAfkGains(playerId, 2); // 2h
    
    console.table({
      "Hours Simulated": 2,
      "Total Value": simulation.totalValue,
      "Rewards Count": simulation.rewards.length,
      "Capped At": simulation.cappedAt,
      "Has Farming Meta": !!simulation.farmingMeta
    });

    if (simulation.farmingMeta) {
      log(colors.cyan, `🎯 Stage utilisé: ${simulation.farmingMeta.farmingStage} (custom: ${simulation.farmingMeta.isCustomFarming})`);
    }

    if (simulation.rewards.length > 0) {
      log(colors.white, "🎁 Récompenses simulées (2h):");
      simulation.rewards.slice(0, 8).forEach(reward => {
        const type = reward.currencyType || reward.materialId || reward.fragmentId || reward.itemId;
        console.log(`  ${reward.type}/${type}: ${reward.quantity}`);
      });
    }

    // 3. Test avec système AFK Enhanced
    log(colors.green, "\n💎 Test avec AfkService Enhanced...");
    
    const enhancedSummary = await AfkServiceEnhanced.getSummaryEnhanced(playerId, true);
    
    console.table({
      "Pending Gold": enhancedSummary.pendingGold,
      "Enhanced Mode": enhancedSummary.useEnhancedRewards,
      "Can Upgrade": enhancedSummary.canUpgrade,
      "Total Value": enhancedSummary.totalValue,
      "VIP Multiplier": enhancedSummary.activeMultipliers.vip,
      "Total Multiplier": enhancedSummary.activeMultipliers.total
    });

  } catch (error: any) {
    log(colors.red, `❌ Erreur test intégration AFK: ${error.message}`);
  }
}

/**
 * Test principal du système de stage selection
 */
async function testAfkFarming(): Promise<void> {
  try {
    log(colors.cyan, "\n🧪 === TEST AFK FARMING STAGE SELECTION ===\n");
    await mongoose.connect(MONGO_URI);
    log(colors.green, "✅ Connecté à MongoDB");

    // Préparer les données de test
    await createTestCampaignData();
    const { beginnerPlayer, advancedPlayer } = await getOrCreateFarmingTestPlayers();
    
const beginnerId = beginnerPlayer._id;
const advancedId = advancedPlayer._id;

    // Test 1: Preview des récompenses
    await testRewardsPreview();

    // Test 2: Stage selection - joueur débutant
    await testStageSelection(beginnerId, "BEGINNER");

    // Test 3: Stage selection - joueur avancé
    await testStageSelection(advancedId, "ADVANCED");

    // Test 4: Intégration avec système AFK
    await testAfkIntegration(advancedId, "ADVANCED");

    // Test 5: Vérification compatibilité
    log(colors.bright, "\n🔄 === TEST COMPATIBILITÉ ===");
    
    log(colors.blue, "Test calcul récompenses standard (sans stage custom)...");
    await AfkFarmingService.resetPlayerFarmingTarget(beginnerId);
    
    const standardRewards = await AfkRewardsService.calculatePlayerAfkRewards(beginnerId);
    log(colors.green, `✅ Calcul standard: ${standardRewards.ratesPerMinute.gold} gold/min`);
    
    if (standardRewards.farmingMeta) {
      log(colors.white, `Farming Meta: ${standardRewards.farmingMeta.isCustomFarming ? "Custom" : "Progression"} - ${standardRewards.farmingMeta.farmingStage}`);
    }

    log(colors.cyan, "\n🎉 === TESTS AFK FARMING TERMINÉS ===\n");

  } catch (err: any) {
    log(colors.red, `❌ Erreur test AFK Farming: ${err.message}`);
    console.error(err);
  } finally {
    await mongoose.disconnect();
    log(colors.green, "🔌 Déconnecté de MongoDB");
  }
}

// Aide
function showUsage() {
  log(colors.cyan, "\n🎮 === SCRIPT DE TEST AFK FARMING ===");
  console.log("Ce script teste le système de Stage Selection AFK :");
  console.log("• 🎯 Sélection de stages custom pour farm");
  console.log("• 📊 Calcul des récompenses selon le stage sélectionné");
  console.log("• 🔄 Intégration transparente avec le système AFK existant");
  console.log("• 💎 Compatibility avec AfkService Enhanced");
  console.log("• 🎁 Preview et simulation des récompenses");
  console.log("• 📋 Recommandations intelligentes de farm");
  console.log("\nLancement:");
  console.log("npx ts-node src/scripts/testAfkFarming.ts");
  console.log("");
}

if (require.main === module) {
  showUsage();
  testAfkFarming().then(() => process.exit(0));
}

export { testAfkFarming };

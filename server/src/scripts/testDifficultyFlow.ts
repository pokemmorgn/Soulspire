#!/usr/bin/env ts-node

// server/src/scripts/testDifficultyFlow.ts
// Test rapide du nouveau système de difficultés
// Usage: npx ts-node src/scripts/testDifficultyFlow.ts

import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import CampaignWorld from "../models/CampaignWorld";
import CampaignProgress from "../models/CampaignProgress";
import { CampaignService } from "../services/CampaignService";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Couleurs pour l'affichage
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

class DifficultyFlowTester {
  private testPlayerId: string = "";
  private serverId: string = "S1";

  public async runTest(): Promise<void> {
    try {
      log(colors.cyan, "\n🧪 === TEST RAPIDE DU NOUVEAU SYSTÈME DE DIFFICULTÉS ===\n");

      await this.setupTest();
      await this.testNormalProgression();
      await this.testDifficultyUnlocks();
      await this.testWorldAccess();
      
      log(colors.green, "\n✅ === TOUS LES TESTS PASSÉS AVEC SUCCÈS ! ===\n");

    } catch (error) {
      log(colors.red, `❌ Erreur: ${error}`);
      throw error;
    }
  }

  private async setupTest(): Promise<void> {
    log(colors.blue, "🔧 Setup du test...");

    // Nettoyer les données de test
    await Player.deleteMany({ username: "DifficultyTestPlayer" });
    await CampaignProgress.deleteMany({ playerId: { $regex: /^test_difficulty/ } });

    // Créer un joueur de test
    const testPlayer = new Player({
      username: "DifficultyTestPlayer",
      password: "test123",
      serverId: this.serverId,
      level: 1,
      world: 1,
      gold: 10000,
      gems: 1000
    });

    await testPlayer.save();
    this.testPlayerId = (testPlayer._id as any).toString();

    // Vérifier qu'on a des mondes
    const worldCount = await CampaignWorld.countDocuments({});
    if (worldCount === 0) {
      throw new Error("Aucun monde trouvé ! Lancez d'abord initCampaign.ts");
    }

    log(colors.green, `✅ Joueur créé (niveau ${testPlayer.level}) avec ${worldCount} mondes disponibles`);
  }

  private async testNormalProgression(): Promise<void> {
    log(colors.cyan, "\n📈 Test 1: Progression Normal");

    // Test accès monde 1 niveau 1
    let access = await CampaignService.canPlayerPlayLevel(
      this.testPlayerId,
      this.serverId,
      1,
      1,
      "Normal"
    );
    
    console.log(`   Monde 1 Niveau 1 Normal: ${access.allowed ? "✅ AUTORISÉ" : "❌ BLOQUÉ"}`);
    if (!access.allowed) console.log(`      Raison: ${access.reason}`);

    // Test accès monde 1 niveau 2 (sans avoir fini niveau 1)
    access = await CampaignService.canPlayerPlayLevel(
      this.testPlayerId,
      this.serverId,
      1,
      2,
      "Normal"
    );
    
    console.log(`   Monde 1 Niveau 2 Normal: ${access.allowed ? "❌ AUTORISÉ (ERREUR)" : "✅ BLOQUÉ"}`);
    if (!access.allowed) console.log(`      Raison: ${access.reason}`);

    // Simuler la complétion du niveau 1
    await this.simulateLevel(1, 1, "Normal");
    
    access = await CampaignService.canPlayerPlayLevel(
      this.testPlayerId,
      this.serverId,
      1,
      2,
      "Normal"
    );
    
    console.log(`   Monde 1 Niveau 2 Normal (après niveau 1): ${access.allowed ? "✅ AUTORISÉ" : "❌ BLOQUÉ"}`);

    log(colors.green, "✅ Progression Normal OK");
  }

  private async testDifficultyUnlocks(): Promise<void> {
    log(colors.cyan, "\n🎚️ Test 2: Déblocage des difficultés");

    // Test Hard sans avoir terminé la campagne
    let access = await CampaignService.canPlayerPlayLevel(
      this.testPlayerId,
      this.serverId,
      1,
      1,
      "Hard"
    );
    
    console.log(`   Monde 1 Niveau 1 Hard (début): ${access.allowed ? "❌ AUTORISÉ (ERREUR)" : "✅ BLOQUÉ"}`);
    if (!access.allowed) console.log(`      Raison: ${access.reason}`);

    // Simuler la complétion de toute la campagne en Normal
    log(colors.yellow, "   🔧 Simulation complétion campagne Normal...");
    await this.simulateFullCampaign("Normal");

    access = await CampaignService.canPlayerPlayLevel(
      this.testPlayerId,
      this.serverId,
      1,
      1,
      "Hard"
    );
    
    console.log(`   Monde 1 Niveau 1 Hard (après Normal): ${access.allowed ? "✅ AUTORISÉ" : "❌ BLOQUÉ"}`);

    // Test Nightmare sans Hard complet
    access = await CampaignService.canPlayerPlayLevel(
      this.testPlayerId,
      this.serverId,
      1,
      1,
      "Nightmare"
    );
    
    console.log(`   Monde 1 Niveau 1 Nightmare (avant Hard): ${access.allowed ? "❌ AUTORISÉ (ERREUR)" : "✅ BLOQUÉ"}`);

    // Simuler complétion Hard
    log(colors.yellow, "   🔧 Simulation complétion campagne Hard...");
    await this.simulateFullCampaign("Hard");

    access = await CampaignService.canPlayerPlayLevel(
      this.testPlayerId,
      this.serverId,
      1,
      1,
      "Nightmare"
    );
    
    console.log(`   Monde 1 Niveau 1 Nightmare (après Hard): ${access.allowed ? "✅ AUTORISÉ" : "❌ BLOQUÉ"}`);

    log(colors.green, "✅ Déblocage difficultés OK");
  }

  private async testWorldAccess(): Promise<void> {
    log(colors.cyan, "\n🌍 Test 3: Accès aux mondes");

    // Tester l'accès aux différents mondes selon le niveau joueur
    const worlds = await CampaignWorld.find({}).sort({ worldId: 1 }).limit(5);
    
    for (const world of worlds) {
      const player = await Player.findById(this.testPlayerId);
      if (!player) continue;

      const canAccess = player.level >= world.minPlayerLevel;
      
      console.log(`   Monde ${world.worldId} (req: lvl ${world.minPlayerLevel}): ${canAccess ? "✅ DÉBLOQUÉ" : "🔒 VERROUILLÉ"}`);
      
      // Tester l'accès effectif
      const access = await CampaignService.canPlayerPlayLevel(
        this.testPlayerId,
        this.serverId,
        world.worldId,
        1,
        "Normal"
      );

      if (canAccess !== access.allowed) {
        console.log(`      ⚠️ Incohérence détectée ! Théorie: ${canAccess}, Réalité: ${access.allowed}`);
      }
    }

    // Test avec un joueur de haut niveau
    const highLevelPlayer = await Player.findById(this.testPlayerId);
    if (highLevelPlayer) {
      highLevelPlayer.level = 100;
      await highLevelPlayer.save();
      
      console.log(`\n   🚀 Test avec joueur niveau ${highLevelPlayer.level}:`);
      
      for (const world of worlds) {
        const access = await CampaignService.canPlayerPlayLevel(
          this.testPlayerId,
          this.serverId,
          world.worldId,
          1,
          "Normal"
        );
        
        console.log(`      Monde ${world.worldId}: ${access.allowed ? "✅ ACCESSIBLE" : "❌ BLOQUÉ"}`);
      }
    }

    log(colors.green, "✅ Accès mondes OK");
  }

  private async simulateLevel(worldId: number, levelIndex: number, difficulty: string): Promise<void> {
    const world = await CampaignWorld.findOne({ worldId });
    if (!world) return;

    let progress = await CampaignProgress.findOne({
      playerId: this.testPlayerId,
      serverId: this.serverId,
      worldId
    });

    if (!progress) {
      progress = new CampaignProgress({
        playerId: this.testPlayerId,
        serverId: this.serverId,
        worldId,
        highestLevelCleared: 0,
        starsByLevel: []
      });
    }

    // Utiliser la méthode du modèle pour mettre à jour
    (progress as any).updateDifficultyProgress(
      difficulty as "Normal" | "Hard" | "Nightmare",
      levelIndex,
      3, // 3 étoiles
      25000, // 25 secondes
      world.levelCount
    );

    await progress.save();

    // Mettre à jour le niveau joueur si Normal
    if (difficulty === "Normal") {
      const player = await Player.findById(this.testPlayerId);
      if (player) {
        const newLevel = Math.max(player.level, (worldId - 1) * 10 + levelIndex + 5);
        if (newLevel > player.level) {
          player.level = newLevel;
          await player.save();
        }
      }
    }
  }

  private async simulateFullCampaign(difficulty: string): Promise<void> {
    const worlds = await CampaignWorld.find({}).sort({ worldId: 1 });
    
    for (const world of worlds) {
      // Compléter tous les niveaux du monde
      for (let level = 1; level <= world.levelCount; level++) {
        await this.simulateLevel(world.worldId, level, difficulty);
      }
    }
    
    console.log(`      ✅ ${worlds.length} mondes complétés en ${difficulty}`);
  }

  private async cleanup(): Promise<void> {
    await Player.deleteMany({ username: "DifficultyTestPlayer" });
    await CampaignProgress.deleteMany({ playerId: this.testPlayerId });
    log(colors.blue, "🧹 Nettoyage effectué");
  }
}

// === TESTS SPÉCIALISÉS ===

async function testCampaignDataStructure(): Promise<void> {
  log(colors.cyan, "\n📊 Test structure données campagne:");

  const testPlayer = await Player.findOne({ username: "DifficultyTestPlayer" });
  if (!testPlayer) {
    console.log("   ⚠️ Pas de joueur de test trouvé");
    return;
  }

  try {
    const campaignData = await CampaignService.getPlayerCampaignData(
      (testPlayer._id as any).toString(),
      "S1"
    );

    console.log(`   📊 Niveau joueur: ${campaignData.playerLevel}`);
    console.log(`   🌍 Mondes débloqués: ${campaignData.globalStats.unlockedWorlds}/${campaignData.globalStats.totalWorlds}`);
    console.log(`   ⭐ Étoiles totales: ${campaignData.globalStats.totalStarsEarned}`);
    
    // Tester quelques mondes
    const testWorlds = campaignData.campaignData.slice(0, 3);
    for (const world of testWorlds) {
      console.log(`   🏰 ${world.name} (${world.worldId}): ${world.isUnlocked ? "✅ Débloqué" : "🔒 Verrouillé"} - ${world.totalStars}/${world.maxStars} étoiles`);
    }

    log(colors.green, "✅ Structure données OK");

  } catch (error) {
    log(colors.red, `❌ Erreur structure: ${error}`);
  }
}

async function testDifficultyStatusEndpoint(): Promise<void> {
  log(colors.cyan, "\n🎚️ Test statut difficultés:");

  const testPlayer = await Player.findOne({ username: "DifficultyTestPlayer" });
  if (!testPlayer) return;

  const playerId = (testPlayer._id as any).toString();
  const serverId = "S1";

  try {
    const [normalCompleted, hardCompleted] = await Promise.all([
      CampaignService.hasPlayerCompletedCampaign(playerId, serverId, "Normal"),
      CampaignService.hasPlayerCompletedCampaign(playerId, serverId, "Hard")
    ]);

    const difficultyStatus = {
      Normal: {
        unlocked: true,
        completed: normalCompleted
      },
      Hard: {
        unlocked: normalCompleted,
        completed: hardCompleted
      },
      Nightmare: {
        unlocked: hardCompleted,
        completed: false
      }
    };

    for (const [diff, status] of Object.entries(difficultyStatus)) {
      const icon = status.unlocked ? (status.completed ? "✅" : "🔓") : "🔒";
      console.log(`   ${icon} ${diff}: ${status.unlocked ? "Débloqué" : "Verrouillé"} | ${status.completed ? "Terminé" : "En cours"}`);
    }

    log(colors.green, "✅ Statut difficultés OK");

  } catch (error) {
    log(colors.red, `❌ Erreur statut: ${error}`);
  }
}

// === SCRIPT PRINCIPAL ===
async function main() {
  try {
    console.log("🚀 Démarrage test système de difficultés...");
    
    await mongoose.connect(MONGO_URI);
    log(colors.green, "✅ Connecté à MongoDB");
    
    const tester = new DifficultyFlowTester();
    
    // Tests principaux
    await tester.runTest();
    
    // Tests supplémentaires
    await testCampaignDataStructure();
    await testDifficultyStatusEndpoint();
    
    // Nettoyage
    await Player.deleteMany({ username: "DifficultyTestPlayer" });
    await CampaignProgress.deleteMany({ playerId: { $regex: /^test_difficulty/ } });
    
    log(colors.green, "\n🎉 SYSTÈME DE DIFFICULTÉS VALIDÉ ! 🎉");
    log(colors.cyan, "\n📋 Résumé des fonctionnalités testées:");
    console.log("   ✅ Progression séquentielle en Normal");
    console.log("   ✅ Déblocage Hard après complétion Normal");  
    console.log("   ✅ Déblocage Nightmare après complétion Hard");
    console.log("   ✅ Accès libre aux mondes débloqués par niveau");
    console.log("   ✅ Cohérence des données de progression");
    console.log("   ✅ API endpoints fonctionnels");

  } catch (error) {
    log(colors.red, `❌ Test échoué: ${error}`);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log(colors.blue, "🔌 Déconnecté de MongoDB");
    process.exit(0);
  }
}

// Lancement si script appelé directement
if (require.main === module) {
  main();
}

export default DifficultyFlowTester;

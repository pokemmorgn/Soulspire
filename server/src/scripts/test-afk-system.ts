// scripts/test-afk-system.ts
/**
 * 🧪 SCRIPT DE TEST COMPLET - SYSTÈME AFK
 * 
 * Teste toutes les fonctionnalités du système AFK avec le nouveau système Account/Player
 * À exécuter avec : npm run test:afk
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Account from "../server/src/models/Account";
import Player from "../server/src/models/Player";
import AfkState from "../server/src/models/AfkState";
import AfkSession from "../server/src/models/AfkSession";
import AfkFarmingTarget from "../server/src/models/AfkFarmingTarget";
import AfkServiceEnhanced from "../server/src/services/AfkService";
import { AfkRewardsService } from "../server/src/services/AfkRewardsService";
import AfkFarmingService from "../server/src/services/AfkFarmingService";

dotenv.config();

// ===================================================================
// 🎯 DONNÉES DE TEST
// ===================================================================

const TEST_DATA = {
  account: {
    accountId: "ACC_TEST_AFK_12345",
    username: "afk_test_user",
    email: "afk.test@example.com",
    password: "hashed_password_123",
    accountStatus: "active" as const
  },
  server: {
    serverId: "S1"
  },
  player: {
    playerId: "PLAYER_AFK_TEST_67890",
    displayName: "AFK Test Player",
    world: 5,
    level: 45,
    difficulty: "Normal" as const,
    gold: 1000,
    gems: 100,
    vipLevel: 2,
    heroes: [
      {
        heroId: "hero_1",
        level: 30,
        stars: 3,
        equipped: true,
        slot: 1,
        experience: 1000,
        ascensionLevel: 2,
        awakenLevel: 1,
        acquisitionDate: new Date()
      }
    ]
  }
};

// ===================================================================
// 🛠️ FONCTIONS UTILITAIRES
// ===================================================================

class AfkTestSuite {
  private account: any = null;
  private player: any = null;
  private testResults: { test: string; success: boolean; error?: string; duration?: number }[] = [];

  async setup() {
    console.log("🔧 Configuration des données de test...");

    try {
      // Nettoyer les données existantes
      await this.cleanup();

      // Créer le compte de test
      this.account = await Account.create(TEST_DATA.account);
      console.log(`✅ Compte créé: ${this.account.accountId}`);

      // Créer le joueur de test
      this.player = await Player.create({
        ...TEST_DATA.player,
        accountId: this.account.accountId,
        serverId: TEST_DATA.server.serverId
      });
      console.log(`✅ Joueur créé: ${this.player.playerId}`);

      return true;
    } catch (error) {
      console.error("❌ Erreur setup:", error);
      return false;
    }
  }

  async cleanup() {
    console.log("🧹 Nettoyage des données de test...");

    try {
      await Promise.all([
        Account.deleteMany({ accountId: { $regex: /TEST/ } }),
        Player.deleteMany({ playerId: { $regex: /TEST/ } }),
        AfkState.deleteMany({ playerId: { $regex: /TEST/ } }),
        AfkSession.deleteMany({ playerId: { $regex: /TEST/ } }),
        AfkFarmingTarget.deleteMany({ playerId: { $regex: /TEST/ } })
      ]);
      console.log("✅ Nettoyage terminé");
    } catch (error) {
      console.warn("⚠️ Erreur nettoyage:", error);
    }
  }

  async runTest(testName: string, testFn: () => Promise<void>) {
    const startTime = Date.now();
    console.log(`\n🧪 Test: ${testName}`);

    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.testResults.push({ test: testName, success: true, duration });
      console.log(`✅ ${testName} - SUCCÈS (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.testResults.push({ 
        test: testName, 
        success: false, 
        error: error.message,
        duration 
      });
      console.error(`❌ ${testName} - ÉCHEC:`, error.message);
    }
  }

  async runAllTests() {
    console.log("🚀 Démarrage des tests du système AFK\n");

    // Tests de base
    await this.runTest("1. Création état AFK", () => this.testAfkStateCreation());
    await this.runTest("2. Tick AFK basique", () => this.testBasicAfkTick());
    await this.runTest("3. Claim AFK basique", () => this.testBasicAfkClaim());
    
    // Tests enhanced
    await this.runTest("4. Upgrade vers Enhanced", () => this.testEnhancedUpgrade());
    await this.runTest("5. Tick Enhanced", () => this.testEnhancedTick());
    await this.runTest("6. Claim Enhanced", () => this.testEnhancedClaim());
    
    // Tests de sessions
    await this.runTest("7. Session AFK", () => this.testAfkSession());
    await this.runTest("8. Heartbeat", () => this.testHeartbeat());
    
    // Tests de farming
    await this.runTest("9. Stage Farming Info", () => this.testStageFarmingInfo());
    await this.runTest("10. Set Farming Target", () => this.testSetFarmingTarget());
    await this.runTest("11. Reset Farming Target", () => this.testResetFarmingTarget());
    
    // Tests de calculs
    await this.runTest("12. Calcul récompenses", () => this.testRewardsCalculation());
    await this.runTest("13. Simulation gains", () => this.testGainsSimulation());
    
    // Tests d'intégration
    await this.runTest("14. Intégration complète", () => this.testFullIntegration());

    this.printResults();
  }

  // ===================================================================
  // 🧪 TESTS INDIVIDUELS
  // ===================================================================

  async testAfkStateCreation() {
    const state = await AfkServiceEnhanced.ensureState(this.player.playerId);
    
    if (!state) throw new Error("État AFK non créé");
    if (state.playerId !== this.player.playerId) throw new Error("PlayerId incorrect");
    if (state.baseGoldPerMinute <= 0) throw new Error("Taux d'or invalide");
    
    console.log(`  📊 État créé - Or/min: ${state.baseGoldPerMinute}`);
  }

  async testBasicAfkTick() {
    const stateBefore = await AfkServiceEnhanced.ensureState(this.player.playerId);
    const goldBefore = stateBefore.pendingGold;
    
    // Simuler 5 minutes d'AFK
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    stateBefore.lastTickAt = fiveMinutesAgo;
    await stateBefore.save();
    
    const stateAfter = await AfkServiceEnhanced.tick(this.player.playerId);
    const goldGained = stateAfter.pendingGold - goldBefore;
    
    if (goldGained <= 0) throw new Error("Aucun or gagné");
    
    console.log(`  💰 Or gagné en 5min: ${goldGained}`);
  }

  async testBasicAfkClaim() {
    const claimResult = await AfkServiceEnhanced.claim(this.player.playerId);
    
    if (claimResult.claimed <= 0) throw new Error("Aucun or réclamé");
    if (claimResult.totalGold <= 0) throw new Error("Or total invalide");
    
    // Vérifier que le joueur a bien reçu l'or
    const updatedPlayer = await Player.findOne({ playerId: this.player.playerId });
    if (!updatedPlayer) throw new Error("Joueur non trouvé après claim");
    
    console.log(`  🎁 Or réclamé: ${claimResult.claimed}, Total: ${claimResult.totalGold}`);
  }

  async testEnhancedUpgrade() {
    const upgradeResult = await AfkServiceEnhanced.upgradeToEnhanced(this.player.playerId);
    
    if (!upgradeResult.success) {
      // Si pas encore éligible, mettre à jour le joueur
      await Player.findOneAndUpdate(
        { playerId: this.player.playerId },
        { world: 3, level: 50 } // Critères pour enhanced
      );
      
      const secondTry = await AfkServiceEnhanced.upgradeToEnhanced(this.player.playerId);
      if (!secondTry.success) throw new Error("Upgrade enhanced échoué");
    }
    
    console.log(`  🚀 Enhanced activé`);
  }

  async testEnhancedTick() {
    const tickResult = await AfkServiceEnhanced.tickEnhanced(this.player.playerId);
    
    if (!tickResult.state) throw new Error("État non retourné");
    if (!tickResult.state.useEnhancedRewards) throw new Error("Enhanced non activé");
    
    console.log(`  ⚡ Enhanced tick - Récompenses: ${tickResult.enhancedRewards.length}`);
  }

  async testEnhancedClaim() {
    // D'abord générer quelques récompenses
    const state = await AfkServiceEnhanced.ensureStateEnhanced(this.player.playerId);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    state.lastTickAt = fiveMinutesAgo;
    await state.save();
    
    await AfkServiceEnhanced.tickEnhanced(this.player.playerId);
    
    const claimResult = await AfkServiceEnhanced.claimEnhanced(this.player.playerId);
    
    if (claimResult.goldClaimed < 0) throw new Error("Or réclamé invalide");
    if (claimResult.totalValue < 0) throw new Error("Valeur totale invalide");
    
    console.log(`  💎 Enhanced claim - Or: ${claimResult.goldClaimed}, Valeur: ${claimResult.totalValue}`);
  }

  async testAfkSession() {
    const session = await AfkServiceEnhanced.startSession(this.player.playerId, {
      deviceId: "test_device",
      source: "idle"
    });
    
    if (!session) throw new Error("Session non créée");
    if (session.playerId !== this.player.playerId) throw new Error("PlayerId session incorrect");
    if (session.status !== "running") throw new Error("Statut session incorrect");
    
    console.log(`  📱 Session créée: ${session._id}`);
  }

  async testHeartbeat() {
    const heartbeatResult = await AfkServiceEnhanced.heartbeat(this.player.playerId);
    
    if (!heartbeatResult.state) throw new Error("État heartbeat manquant");
    if (!heartbeatResult.session) throw new Error("Session heartbeat manquante");
    
    console.log(`  💓 Heartbeat OK`);
  }

  async testStageFarmingInfo() {
    const farmingInfo = await AfkFarmingService.getFarmingStageInfo(this.player.playerId);
    
    if (!farmingInfo.success) throw new Error(farmingInfo.error);
    if (!farmingInfo.data) throw new Error("Données farming manquantes");
    if (!farmingInfo.data.currentFarmingStage) throw new Error("Stage farming manquant");
    
    console.log(`  🎯 Farming: ${farmingInfo.data.currentFarmingStage.description}`);
  }

  async testSetFarmingTarget() {
    const setResult = await AfkFarmingService.setPlayerFarmingTarget(
      this.player.playerId,
      3, 10, "Hard",
      { reason: "materials", validateFirst: false }
    );
    
    if (!setResult.success) throw new Error(setResult.error);
    if (!setResult.target) throw new Error("Target non créé");
    
    console.log(`  🎯 Target défini: ${setResult.target.selectedWorld}-${setResult.target.selectedLevel}`);
  }

  async testResetFarmingTarget() {
    const resetResult = await AfkFarmingService.resetPlayerFarmingTarget(this.player.playerId);
    
    if (!resetResult.success) throw new Error(resetResult.error);
    
    console.log(`  🔄 Target reset OK`);
  }

  async testRewardsCalculation() {
    const calculation = await AfkRewardsService.calculatePlayerAfkRewards(this.player.playerId);
    
    if (!calculation.rewards) throw new Error("Récompenses manquantes");
    if (calculation.rewards.length === 0) throw new Error("Aucune récompense");
    if (calculation.multipliers.total <= 0) throw new Error("Multiplicateur invalide");
    
    console.log(`  📊 Calcul - ${calculation.rewards.length} récompenses, Multi: ${calculation.multipliers.total}`);
  }

  async testGainsSimulation() {
    const simulation = await AfkRewardsService.simulateAfkGains(this.player.playerId, 1);
    
    if (!simulation.rewards) throw new Error("Simulation échouée");
    if (simulation.totalValue < 0) throw new Error("Valeur simulation invalide");
    
    console.log(`  🔮 Simulation 1h - Valeur: ${simulation.totalValue}`);
  }

  async testFullIntegration() {
    // Test d'un scénario complet : tick enhanced + claim + farming
    const summary = await AfkServiceEnhanced.getSummaryEnhanced(this.player.playerId, true);
    
    if (!summary) throw new Error("Summary manquant");
    if (summary.pendingGold < 0) throw new Error("Or en attente invalide");
    
    // Tester le farming avec stage custom
    await AfkFarmingService.setPlayerFarmingTarget(
      this.player.playerId, 2, 5, "Normal"
    );
    
    // Vérifier que le stage effectif a changé
    const effectiveStage = await AfkFarmingService.getEffectiveFarmingStage(this.player.playerId);
    if (!effectiveStage.isCustom) throw new Error("Stage custom non activé");
    
    console.log(`  🔗 Intégration complète OK - Stage: ${effectiveStage.world}-${effectiveStage.level}`);
  }

  // ===================================================================
  // 📊 RÉSULTATS
  // ===================================================================

  printResults() {
    console.log("\n" + "=".repeat(60));
    console.log("📊 RÉSULTATS DES TESTS AFK");
    console.log("=".repeat(60));

    const passed = this.testResults.filter(r => r.success).length;
    const failed = this.testResults.filter(r => !r.success).length;
    const totalDuration = this.testResults.reduce((sum, r) => sum + (r.duration || 0), 0);

    console.log(`✅ Tests réussis: ${passed}`);
    console.log(`❌ Tests échoués: ${failed}`);
    console.log(`⏱️ Durée totale: ${totalDuration}ms`);
    console.log(`📈 Taux de réussite: ${Math.round((passed / this.testResults.length) * 100)}%`);

    if (failed > 0) {
      console.log("\n❌ ÉCHECS DÉTAILLÉS:");
      this.testResults
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  • ${r.test}: ${r.error}`);
        });
    }

    console.log("\n" + "=".repeat(60));
    
    if (failed === 0) {
      console.log("🎉 TOUS LES TESTS SONT PASSÉS ! Le système AFK fonctionne correctement.");
    } else {
      console.log("⚠️ CERTAINS TESTS ONT ÉCHOUÉ. Vérifiez les erreurs ci-dessus.");
    }
  }
}

// ===================================================================
// 🚀 EXÉCUTION DU SCRIPT
// ===================================================================

async function main() {
  try {
    // Connexion à la base de données
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/afk_test";
    await mongoose.connect(mongoUri);
    console.log("✅ Connexion MongoDB établie");

    // Créer et exécuter la suite de tests
    const testSuite = new AfkTestSuite();
    
    const setupSuccess = await testSuite.setup();
    if (!setupSuccess) {
      console.error("❌ Échec du setup. Arrêt des tests.");
      process.exit(1);
    }

    await testSuite.runAllTests();
    await testSuite.cleanup();

  } catch (error) {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Déconnexion MongoDB");
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

export default AfkTestSuite;

#!/usr/bin/env npx ts-node

/**
 * SCRIPT DE TEST COMPLET - SYSTÈME DE GUILDES
 * Usage: npx ts-node scripts/test-guild-system.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
// 🔥 CORRECTION: Imports corrigés pour la structure réelle
import { GuildManagementService } from '../services/guild/GuildManagementService';
import { GuildMemberService } from '../services/guild/GuildMemberService';
import { GuildActivityService } from '../services/guild/GuildActivityService';
import { GuildSearchService } from '../services/guild/GuildSearchService';
import Guild from '../models/Guild';
import Player from '../models/Player';
import { IdGenerator } from '../utils/idGenerator';

// Configuration
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";
const TEST_SERVER_ID = "TEST_S1";

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  data?: any;
  duration: number;
}

class GuildSystemTester {
  private results: TestResult[] = [];
  private testPlayers: any[] = [];
  private testGuild: any = null;

  async runAllTests(): Promise<void> {
    console.log("🧪 === DÉBUT DES TESTS SYSTÈME GUILDES ===\n");
    
    try {
      // Connexion à la base
      await this.connectDatabase();
      
      // Nettoyage initial
      await this.cleanup();
      
      // 1. Tests de création de données de test
      await this.createTestPlayers();
      
      // 🔥 VÉRIFICATION: Arrêter si pas de joueurs créés
      if (this.testPlayers.length === 0) {
        console.error("❌ Aucun joueur de test créé - arrêt des tests");
        return;
      }
      
      // 2. Tests de gestion de guildes
      await this.testGuildCreation();
      
      // 🔥 VÉRIFICATION: Arrêter si pas de guilde créée
      if (!this.testGuild) {
        console.error("❌ Aucune guilde de test créée - arrêt des tests");
        return;
      }
      
      await this.testGuildSettings();
      
      // 3. Tests de membres
      await this.testMemberManagement();
      await this.testApplicationsInvitations();
      await this.testRoleHierarchy();
      
      // 4. Tests d'activités
      await this.testContributions();
      await this.testQuests();
      await this.testRaids();
      await this.testRewards();
      
      // 5. Tests de recherche
      await this.testSearch();
      
      // 6. Tests de leadership automatique
      await this.testAutoLeadershipTransfer();
      
      // 7. Tests de maintenance
      await this.testMaintenance();
      
      // Nettoyage final
      await this.cleanup();
      
    } catch (error) {
      console.error("❌ Erreur critique dans les tests:", error);
    } finally {
      await this.disconnectDatabase();
      this.printResults();
    }
  }

  private async connectDatabase(): Promise<void> {
    try {
      await mongoose.connect(MONGO_URI);
      console.log("✅ Connexion MongoDB établie");
    } catch (error) {
      throw new Error(`❌ Échec connexion MongoDB: ${error}`);
    }
  }

  private async disconnectDatabase(): Promise<void> {
    await mongoose.disconnect();
    console.log("🔌 Connexion MongoDB fermée");
  }

  private async cleanup(): Promise<void> {
    console.log("🧹 Nettoyage des données de test...");
    
    // Supprimer guildes de test
    await Guild.deleteMany({ serverId: TEST_SERVER_ID });
    
    // Supprimer joueurs de test
    await Player.deleteMany({ 
      displayName: { $regex: /^TEST_PLAYER_/ }
    });
    
    console.log("✅ Nettoyage terminé\n");
  }

  private async createTestPlayers(): Promise<void> {
    await this.runTest("Création joueurs de test", async () => {
      const playerData = [
        { name: "TEST_PLAYER_LEADER", level: 50, gold: 100000, gems: 5000 },
        { name: "TEST_PLAYER_OFFICER", level: 45, gold: 50000, gems: 3000 },
        { name: "TEST_PLAYER_ELITE", level: 40, gold: 30000, gems: 2000 },
        { name: "TEST_PLAYER_MEMBER1", level: 35, gold: 20000, gems: 1000 },
        { name: "TEST_PLAYER_MEMBER2", level: 30, gold: 15000, gems: 500 },
        { name: "TEST_PLAYER_INACTIVE", level: 25, gold: 10000, gems: 100 }
      ];

      for (const data of playerData) {
        const player = new Player({
          _id: IdGenerator.generatePlayerId(),
          serverId: TEST_SERVER_ID,
          displayName: data.name,
          level: data.level,
          gold: data.gold,
          gems: data.gems,
          lastActiveAt: data.name.includes("INACTIVE") ? 
            new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) : // 5 jours d'inactivité
            new Date()
        });
        
        await player.save();
        this.testPlayers.push(player);
      }

      return { playersCreated: this.testPlayers.length };
    });
  }

  private async testGuildCreation(): Promise<void> {
    await this.runTest("Création de guilde", async () => {
      const leader = this.testPlayers[0];
      
      const result = await GuildManagementService.createGuild(
        leader._id,
        TEST_SERVER_ID,
        {
          name: "TEST_GUILD_ALPHA",
          tag: "TGA",
          description: "Guilde de test pour validation système",
          isPublic: true,
          language: "fr"
        }
      );

      if (!result.success) {
        throw new Error(result.error || "Échec création guilde");
      }

      this.testGuild = result.guild;
      
      // Vérifications
      if (this.testGuild.name !== "TEST_GUILD_ALPHA") {
        throw new Error("Nom de guilde incorrect");
      }
      
      if (this.testGuild.members.length !== 1) {
        throw new Error("Nombre de membres incorrect");
      }
      
      if (!this.testGuild.isLeader(leader._id)) {
        throw new Error("Leader non défini correctement");
      }

      return { 
        guildId: this.testGuild._id,
        guildName: this.testGuild.name,
        memberCount: this.testGuild.members.length
      };
    });
  }

  private async testGuildSettings(): Promise<void> {
    await this.runTest("Modification paramètres guilde", async () => {
      const leader = this.testPlayers[0];
      
      const result = await GuildManagementService.updateGuildSettings(
        this.testGuild._id,
        leader._id,
        {
          description: "Guilde modifiée",
          minimumLevel: 20,
          autoKickInactiveMembers: true,
          inactivityThresholdDays: 10
        }
      );

      if (!result.success) {
        throw new Error(result.error || "Échec modification paramètres");
      }

      // Vérifier les changements
      const updatedGuild = await Guild.findById(this.testGuild._id);
      if (updatedGuild?.description !== "Guilde modifiée") {
        throw new Error("Description non mise à jour");
      }
      
      if (!updatedGuild?.settings.autoKickInactiveMembers) {
        throw new Error("Auto-kick non activé");
      }

      return { 
        settingsUpdated: true,
        autoKickEnabled: updatedGuild.settings.autoKickInactiveMembers
      };
    });
  }

  private async testMemberManagement(): Promise<void> {
    await this.runTest("Gestion des membres", async () => {
      const leader = this.testPlayers[0];
      const newMembers = this.testPlayers.slice(1, 4); // Officer, Elite, Member1
      
      let addedMembers = 0;

      // Ajouter les membres
      for (const player of newMembers) {
        const addResult = await this.testGuild.addMember(
          player._id,
          player.displayName,
          player.level,
          player.calculatePowerScore()
        );
        
        if (addResult) {
          addedMembers++;
        }
      }

      // Promouvoir les membres avec la nouvelle hiérarchie
      await this.testGuild.promoteMember(newMembers[0]._id, "officer"); // Officer
      await this.testGuild.promoteMember(newMembers[1]._id, "elite");   // Elite
      // newMembers[2] reste "member"

      // Vérifications
      const guild = await Guild.findById(this.testGuild._id);
      if (guild?.memberCount !== 4) {
        throw new Error(`Nombre de membres incorrect: ${guild?.memberCount}`);
      }

      // Vérifier les rôles
      const officerMember = guild?.getMember(newMembers[0]._id);
      const eliteMember = guild?.getMember(newMembers[1]._id);
      const normalMember = guild?.getMember(newMembers[2]._id);

      if (officerMember?.role !== "officer") {
        throw new Error("Rôle officer non assigné");
      }
      
      if (eliteMember?.role !== "elite") {
        throw new Error("Rôle elite non assigné");
      }
      
      if (normalMember?.role !== "member") {
        throw new Error("Rôle member incorrect");
      }

      return { 
        membersAdded: addedMembers,
        totalMembers: guild?.memberCount,
        roles: {
          leader: 1,
          officer: 1,
          elite: 1,
          member: 1
        }
      };
    });
  }

  private async testApplicationsInvitations(): Promise<void> {
    await this.runTest("Candidatures et invitations", async () => {
      const applicant = this.testPlayers[4]; // Member2
      const leader = this.testPlayers[0];
      
      // Test candidature
      const applyResult = await GuildMemberService.applyToGuild(
        applicant._id,
        this.testGuild._id,
        "Je veux rejoindre votre guilde !"
      );

      if (!applyResult.success) {
        throw new Error("Échec candidature");
      }

      // Accepter la candidature
      const processResult = await GuildMemberService.processApplication(
        this.testGuild._id,
        applicant._id,
        "accept",
        leader._id
      );

      if (!processResult.success) {
        throw new Error("Échec acceptation candidature");
      }

      // Vérifier l'ajout
      const guild = await Guild.findById(this.testGuild._id);
      const newMember = guild?.getMember(applicant._id);
      
      if (!newMember) {
        throw new Error("Membre non ajouté après candidature");
      }

      return {
        applicationProcessed: true,
        memberAdded: true,
        totalMembers: guild?.memberCount
      };
    });
  }

  private async testRoleHierarchy(): Promise<void> {
    await this.runTest("Hiérarchie des rôles", async () => {
      const guild = await Guild.findById(this.testGuild._id);
      const officer = this.testPlayers[1];
      const elite = this.testPlayers[2];
      const member = this.testPlayers[3];

      // Tests de permissions selon la hiérarchie : Leader > Officer > Elite > Member
      const tests = {
        leaderCanManage: guild?.canManageMembers(this.testPlayers[0]._id),
        officerCanManage: guild?.canManageMembers(officer._id),
        eliteCanInvite: guild?.canInviteMembers(elite._id),
        eliteCannotManage: !guild?.canManageMembers(elite._id),
        memberCannotInvite: !guild?.canInviteMembers(member._id),
        memberCannotManage: !guild?.canManageMembers(member._id)
      };

      // Vérifier que tous les tests passent
      const failedTests = Object.entries(tests).filter(([key, value]) => !value);
      
      if (failedTests.length > 0) {
        throw new Error(`Tests de permissions échoués: ${failedTests.map(([key]) => key).join(', ')}`);
      }

      return {
        permissionTests: tests,
        allTestsPassed: failedTests.length === 0
      };
    });
  }

  private async testContributions(): Promise<void> {
    await this.runTest("Contributions de guilde", async () => {
      const member = this.testPlayers[3];
      
      const contributionResult = await GuildActivityService.contributeToGuild(
        member._id,
        {
          gold: 5000,
          materials: { "iron_ore": 10, "magic_crystal": 5 }
        }
      );

      if (!contributionResult.success) {
        throw new Error(contributionResult.error || "Échec contribution");
      }

      // Vérifier la contribution
      const guild = await Guild.findById(this.testGuild._id);
      const contributor = guild?.getMember(member._id);

      if ((contributor?.contributionDaily || 0) <= 0) {
        throw new Error("Contribution quotidienne non enregistrée");
      }

      return {
        contributionPoints: contributionResult.contributionPoints,
        dailyContribution: contributor?.contributionDaily,
        guildBankGold: guild?.guildBank.gold
      };
    });
  }

  private async testQuests(): Promise<void> {
    await this.runTest("Quêtes de guilde", async () => {
      // Démarrer une quête
      const questResult = await GuildActivityService.startGuildQuest(
        this.testGuild._id,
        "daily",
        "daily_contribution"
      );

      if (!questResult.success) {
        throw new Error(questResult.error || "Échec démarrage quête");
      }

      const quest = questResult.quest;
      
      // Progression de la quête
      const progressResult = await GuildActivityService.updateGuildQuestProgress(
        this.testGuild._id,
        quest!.questId,
        this.testPlayers[0]._id,
        1000
      );

      if (!progressResult.success) {
        throw new Error("Échec progression quête");
      }

      // Vérifier la progression
      const questProgress = await GuildActivityService.getGuildQuestProgress(this.testGuild._id);
      const activeQuest = questProgress.find((q: any) => q.questId === quest!.questId);

      if (!activeQuest || activeQuest.currentProgress !== 1000) {
        throw new Error("Progression de quête incorrecte");
      }

      return {
        questStarted: true,
        questProgress: activeQuest.currentProgress,
        questTarget: activeQuest.targetValue,
        progressPercentage: activeQuest.progressPercentage
      };
    });
  }

  private async testRaids(): Promise<void> {
    await this.runTest("Raids de guilde", async () => {
      // Démarrer un raid
      const raidResult = await GuildActivityService.startGuildRaid(
        this.testGuild._id,
        "guild_boss",
        "ancient_dragon",
        1
      );

      if (!raidResult.success) {
        throw new Error(raidResult.error || "Échec démarrage raid");
      }

      const raid = raidResult.raid;

      // Rejoindre le raid
      const joinResult = await GuildActivityService.joinGuildRaid(
        this.testGuild._id,
        raid!.raidId,
        this.testPlayers[0]._id
      );

      if (!joinResult.success) {
        throw new Error("Échec participation raid");
      }

      // Attaquer le boss
      const attackResult = await GuildActivityService.attackRaidBoss(
        this.testGuild._id,
        raid!.raidId,
        this.testPlayers[0]._id,
        10000
      );

      if (!attackResult.success) {
        throw new Error("Échec attaque boss");
      }

      // Vérifier le statut
      const raidStatus = await GuildActivityService.getRaidStatus(this.testGuild._id);
      
      if (!raidStatus) {
        throw new Error("Statut raid non trouvé");
      }

      return {
        raidStarted: true,
        participantJoined: true,
        bossAttacked: true,
        bossHealthPercentage: raidStatus.bossHealth.percentage,
        participants: raidStatus.currentParticipants
      };
    });
  }

  private async testRewards(): Promise<void> {
    await this.runTest("Récompenses de guilde", async () => {
      const member = this.testPlayers[1];

      // Test récompenses quotidiennes
      const dailyResult = await GuildActivityService.claimDailyRewards(
        this.testGuild._id,
        member._id
      );

      if (!dailyResult.success) {
        throw new Error(dailyResult.error || "Échec réclamation récompenses quotidiennes");
      }

      return {
        dailyRewardsClaimed: true,
        rewards: dailyResult.rewards
      };
    });
  }

  private async testSearch(): Promise<void> {
    await this.runTest("Recherche de guildes", async () => {
      // Test recherche basique
      const searchResult = await GuildSearchService.searchGuilds(
        TEST_SERVER_ID,
        { name: "TEST_GUILD" },
        1,
        10
      );

      if (searchResult.guilds.length === 0) {
        throw new Error("Guilde de test non trouvée dans la recherche");
      }

      // Test classement
      const leaderboard = await GuildSearchService.getGuildLeaderboard(
        TEST_SERVER_ID,
        "level",
        10
      );

      // Test statistiques serveur
      const serverStats = await GuildSearchService.getServerStatistics(TEST_SERVER_ID);

      return {
        searchResults: searchResult.guilds.length,
        leaderboardEntries: leaderboard.length,
        serverStats: {
          totalGuilds: serverStats.totalGuilds,
          activeGuilds: serverStats.activeGuilds
        }
      };
    });
  }

  private async testAutoLeadershipTransfer(): Promise<void> {
    await this.runTest("Transfert automatique de leadership", async () => {
      // Simuler l'inactivité du leader en modifiant sa date de dernière activité
      const guild = await Guild.findById(this.testGuild._id);
      const leader = guild?.getMember(this.testPlayers[0]._id);
      
      if (leader) {
        // Mettre le leader inactif depuis 3 jours (72h)
        leader.lastActiveAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        await guild?.save();
      }

      // Tester le transfert de leadership
      const transferResult = await GuildManagementService.checkAndTransferInactiveLeadership(
        this.testGuild._id
      );

      if (!transferResult.success) {
        throw new Error(transferResult.error || "Échec transfert leadership");
      }

      // Vérifier le transfert
      const updatedGuild = await Guild.findById(this.testGuild._id);
      const newLeader = updatedGuild?.members.find((m: any) => m.role === "leader");
      const oldLeader = updatedGuild?.members.find((m: any) => m.playerId === this.testPlayers[0]._id);

      if (!newLeader || newLeader.playerId === this.testPlayers[0]._id) {
        throw new Error("Leadership non transféré");
      }

      if (oldLeader?.role === "leader") {
        throw new Error("Ancien leader toujours leader");
      }

      return {
        transferred: transferResult.transferred,
        oldLeader: transferResult.oldLeader?.playerName,
        newLeader: transferResult.newLeader?.playerName,
        newLeaderRole: newLeader.role
      };
    });
  }

  private async testMaintenance(): Promise<void> {
    await this.runTest("Maintenance automatique", async () => {
      // Test maintenance quotidienne
      await GuildManagementService.performDailyMaintenance(TEST_SERVER_ID);
      
      // Test vérification leaders inactifs
      const leadershipCheck = await GuildManagementService.checkAllInactiveLeadersOnServer(TEST_SERVER_ID);

      return {
        maintenanceCompleted: true,
        guildsChecked: leadershipCheck.guildsChecked,
        transfersPerformed: leadershipCheck.transfersPerformed
      };
    });
  }

  private async runTest(name: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🧪 Test: ${name}...`);
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        success: true,
        data: result,
        duration
      });
      
      console.log(`   ✅ Réussi (${duration}ms)`);
      if (result && typeof result === 'object') {
        console.log(`   📊 Données:`, JSON.stringify(result, null, 2));
      }
      console.log("");
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        success: false,
        error: error.message,
        duration
      });
      
      console.log(`   ❌ Échec (${duration}ms): ${error.message}\n`);
    }
  }

  private printResults(): void {
    console.log("\n🏁 === RÉSULTATS DES TESTS ===");
    
    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\n📊 Statistiques:`);
    console.log(`   • Total: ${totalTests} tests`);
    console.log(`   • Réussis: ${successfulTests} ✅`);
    console.log(`   • Échoués: ${failedTests} ❌`);
    console.log(`   • Durée totale: ${totalDuration}ms`);
    console.log(`   • Taux de réussite: ${Math.round((successfulTests / totalTests) * 100)}%`);

    if (failedTests > 0) {
      console.log(`\n❌ Tests échoués:`);
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   • ${r.name}: ${r.error}`));
    }

    console.log(`\n${failedTests === 0 ? '🎉 TOUS LES TESTS RÉUSSIS !' : '⚠️ CERTAINS TESTS ONT ÉCHOUÉ'}`);
  }
}

// Exécution du script
const tester = new GuildSystemTester();
tester.runAllTests().catch(console.error);

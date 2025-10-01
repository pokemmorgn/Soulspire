// src/services/SchedulerService.ts
import * as cron from 'node-cron';
import { ShopService } from './ShopService';
import { ArenaService } from './arena';
import { GuildManagementService } from './guild/GuildManagementService';
import { GuildActivityService } from './guild/GuildActivityService';
import { DailyRewardsService } from './DailyRewardsService';
import { WebSocketService } from './WebSocketService';
import Guild from '../models/Guild';
import { IdGenerator } from '../utils/idGenerator';
import { ElementalBannerService } from './ElementalBannerService';

export class SchedulerService {
  private static scheduledTasks: Map<string, any> = new Map();

  // Démarrer tous les schedulers
  public static startAllSchedulers() {
    console.log("🕐 Démarrage des tâches programmées...");

    // ===== BOUTIQUES =====
    // Reset des boutiques quotidiennes - tous les jours à minuit
    this.scheduleTask('daily-shop-reset', '0 0 * * *', async () => {
      console.log("🌅 Reset quotidien des boutiques...");
      await ShopService.processShopResets();
    });

    // Reset des boutiques hebdomadaires - tous les lundis à minuit
    this.scheduleTask('weekly-shop-reset', '0 0 * * 1', async () => {
      console.log("📅 Reset hebdomadaire des boutiques...");
      await ShopService.processShopResets();
    });

    // Reset des boutiques mensuelles - le 1er de chaque mois à minuit
    this.scheduleTask('monthly-shop-reset', '0 0 1 * *', async () => {
      console.log("📆 Reset mensuel des boutiques...");
      await ShopService.processShopResets();
    });
// ===== DAILY REWARDS =====
    // Reset quotidien des Daily Rewards - tous les jours à minuit
    this.scheduleTask('daily-rewards-reset', '0 0 * * *', async () => {
      console.log("🎁 Reset quotidien des Daily Rewards...");
      try {
        const result = await DailyRewardsService.performDailyReset();
        
        if (result.success) {
          console.log(`✅ Reset Daily Rewards terminé: ${result.processed} joueurs traités, ${result.errors} erreurs`);
          
          // Notifier via WebSocket si besoin
          if (result.processed > 0) {
            WebSocketService.broadcastToServer('S1', 'daily_rewards:daily_reset_completed', {
              processed: result.processed,
              errors: result.errors,
              timestamp: new Date()
            });
          }
        } else {
          console.error("❌ Échec du reset Daily Rewards");
        }
      } catch (error) {
        console.error("❌ Erreur reset Daily Rewards:", error);
      }
    });

    // Rappels Daily Rewards - tous les jours à 18h (6h avant minuit)
    this.scheduleTask('daily-rewards-reminder', '0 18 * * *', async () => {
      console.log("⏰ Envoi des rappels Daily Rewards...");
      try {
        // TODO: Implémenter l'envoi de rappels aux joueurs qui n'ont pas claim
        // Pour l'instant, juste un log
        console.log("📬 Rappels Daily Rewards à implémenter (feature future)");
      } catch (error) {
        console.error("❌ Erreur rappels Daily Rewards:", error);
      }
    });
    // ===== BANNIÈRES ÉLÉMENTAIRES =====
    // Rotation quotidienne des bannières élémentaires - tous les jours à minuit
    this.scheduleTask('elemental-banner-rotation', '0 0 * * *', async () => {
      console.log("🔄 Rotation quotidienne des bannières élémentaires...");
      try {
        const servers = ['S1', 'S2', 'S3']; // Liste de tes serveurs
        
        for (const serverId of servers) {
          await ElementalBannerService.performDailyRotation(serverId);
        }
        
        console.log("✅ Rotation élémentaire terminée pour tous les serveurs");
      } catch (error) {
        console.error("❌ Erreur rotation bannières élémentaires:", error);
      }
    });

    // Activation boutique vendredi - tous les vendredis à minuit
    this.scheduleTask('elemental-shop-friday', '0 0 * * 5', async () => {
      console.log("🛒 Ouverture boutique élémentaire (vendredi)...");
      try {
        const servers = ['S1', 'S2', 'S3'];
        
        for (const serverId of servers) {
          // Notifier via WebSocket
          WebSocketService.broadcastToServer(serverId, 'elemental:shop_opened', {
            duration: 24,
            specialOffers: true,
            message: "Elemental shop is now open! Special ticket packs available."
          });
        }
        
        console.log("✅ Notifications boutique élémentaire envoyées");
      } catch (error) {
        console.error("❌ Erreur notification boutique élémentaire:", error);
      }
    });

    // Augmentation du taux de drop vendredi - tous les vendredis à minuit
    this.scheduleTask('elemental-friday-boost', '0 0 * * 5', async () => {
      console.log("🎉 Activation boost tickets élémentaires (vendredi 15%)...");
      try {
        const servers = ['S1', 'S2', 'S3'];
        
        for (const serverId of servers) {
          WebSocketService.broadcastToServer(serverId, 'elemental:drop_boost_active', {
            dropRate: 15,
            normalRate: 5,
            multiplier: 3,
            duration: 24,
            message: "Friday Bonus: 15% drop rate for elemental tickets!"
          });
        }
        
        console.log("✅ Boost vendredi activé");
      } catch (error) {
        console.error("❌ Erreur boost vendredi:", error);
      }
    });

    // Rappel rotation dimanche (tous les éléments disponibles)
    this.scheduleTask('elemental-sunday-reminder', '0 18 * * 6', async () => {
      console.log("📢 Rappel: Dimanche tous les éléments disponibles...");
      try {
        const servers = ['S1', 'S2', 'S3'];
        
        for (const serverId of servers) {
          WebSocketService.broadcastToServer(serverId, 'elemental:sunday_reminder', {
            message: "Tomorrow: All elemental banners will be available!",
            elements: ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"],
            hoursUntil: 6
          });
        }
        
        console.log("✅ Rappel dimanche envoyé");
      } catch (error) {
        console.error("❌ Erreur rappel dimanche:", error);
      }
    });
    // ===== ARÈNE =====
    // Maintenance quotidienne de l'arène - tous les jours à 1h du matin
    this.scheduleTask('arena-daily-maintenance', '0 1 * * *', async () => {
      console.log("🏟️ Maintenance quotidienne de l'arène...");
      try {
        const servers = ['S1', 'S2', 'S3']; // Remplace par ta liste de serveurs
        
        for (const serverId of servers) {
          await ArenaService.performDailyMaintenance(serverId);
        }
        
        console.log("✅ Maintenance arène terminée pour tous les serveurs");
      } catch (error) {
        console.error("❌ Erreur maintenance arène:", error);
      }
    });

    // Reset classements arène - tous les jours à 2h du matin
    this.scheduleTask('arena-rankings-update', '0 2 * * *', async () => {
      console.log("📊 Mise à jour des classements d'arène...");
      try {
        const servers = ['S1', 'S2', 'S3'];
        
        for (const serverId of servers) {
          await ArenaService.getServerArenaStats(serverId);
        }
        
        console.log("✅ Classements arène mis à jour");
      } catch (error) {
        console.error("❌ Erreur mise à jour classements arène:", error);
      }
    });

    // Événements spéciaux arène - vérification toutes les 6 heures
    this.scheduleTask('arena-events-check', '0 */6 * * *', async () => {
      console.log("🎉 Vérification événements spéciaux arène...");
      try {
        const now = new Date();
        const isWeekend = now.getDay() === 0 || now.getDay() === 6;
        
        await ArenaService.toggleSpecialEvent("bonusWeekend", isWeekend);
        
        if (isWeekend) {
          console.log("🎮 Bonus weekend arène activé");
        }
      } catch (error) {
        console.error("❌ Erreur événements arène:", error);
      }
    });

    // ===== GUILDES =====
    // Maintenance quotidienne des guildes - tous les jours à 3h du matin
    this.scheduleTask('guild-daily-maintenance', '0 3 * * *', async () => {
      console.log("🏛️ Maintenance quotidienne des guildes...");
      try {
        const servers = ['S1', 'S2', 'S3'];
        let totalResults = {
          guildsProcessed: 0,
          inactiveMembersRemoved: 0,
          expiredInvitationsCleared: 0,
          dailyRewardsReset: 0,
          leadershipTransfers: 0
        };
        
        for (const serverId of servers) {
          const result = await this.performGuildDailyMaintenance(serverId);
          totalResults.guildsProcessed += result.guildsProcessed;
          totalResults.inactiveMembersRemoved += result.inactiveMembersRemoved;
          totalResults.expiredInvitationsCleared += result.expiredInvitationsCleared;
          totalResults.dailyRewardsReset += result.dailyRewardsReset;
          totalResults.leadershipTransfers += result.leadershipTransfers;
        }
        
        console.log(`✅ Maintenance guildes terminée: ${totalResults.guildsProcessed} guildes, ${totalResults.inactiveMembersRemoved} membres inactifs supprimés, ${totalResults.leadershipTransfers} transferts de leadership`);
      } catch (error) {
        console.error("❌ Erreur maintenance guildes:", error);
      }
    });

    // 🔥 NOUVEAU: Vérification leadership toutes les 12h (midi et minuit)
    this.scheduleTask('guild-leadership-check', '0 0,12 * * *', async () => {
      console.log("👑 Vérification automatique des leaders inactifs...");
      try {
        const servers = ['S1', 'S2', 'S3'];
        let totalTransfers = 0;
        
        for (const serverId of servers) {
          const leadershipCheck = await GuildManagementService.checkAllInactiveLeadersOnServer(serverId);
          totalTransfers += leadershipCheck.transfersPerformed;
          
          if (leadershipCheck.transfersPerformed > 0) {
            console.log(`👑 ${serverId}: ${leadershipCheck.transfersPerformed} transferts de leadership effectués`);
            
            // Notifier via WebSocket pour monitoring
            WebSocketService.broadcastToServer(serverId, 'guild:leadership_transfers_completed', {
              serverTransfers: leadershipCheck.transfersPerformed,
              guildsChecked: leadershipCheck.guildsChecked,
              transfers: leadershipCheck.transfers
            });
          }
        }
        
        console.log(`✅ Vérification leadership terminée: ${totalTransfers} transferts au total`);
      } catch (error) {
        console.error("❌ Erreur vérification leadership:", error);
      }
    });

    // Auto-start des quêtes quotidiennes - tous les jours à 4h du matin
    this.scheduleTask('guild-daily-quests', '0 4 * * *', async () => {
      console.log("📋 Démarrage automatique des quêtes quotidiennes...");
      try {
        await this.autoStartDailyQuests();
        console.log("✅ Quêtes quotidiennes démarrées");
      } catch (error) {
        console.error("❌ Erreur démarrage quêtes quotidiennes:", error);
      }
    });

    // Maintenance hebdomadaire des guildes - tous les lundis à 4h du matin
    this.scheduleTask('guild-weekly-maintenance', '0 4 * * 1', async () => {
      console.log("📅 Maintenance hebdomadaire des guildes...");
      try {
        const servers = ['S1', 'S2', 'S3'];
        
        for (const serverId of servers) {
          await GuildManagementService.performWeeklyMaintenance(serverId);
        }
        
        console.log("✅ Maintenance hebdomadaire guildes terminée");
      } catch (error) {
        console.error("❌ Erreur maintenance hebdomadaire guildes:", error);
      }
    });

    // Nettoyage des raids expirés - toutes les heures
    this.scheduleTask('guild-raids-cleanup', '0 * * * *', async () => {
      console.log("⚔️ Nettoyage des raids expirés...");
      try {
        await this.cleanupExpiredRaids();
      } catch (error) {
        console.error("❌ Erreur nettoyage raids:", error);
      }
    });

    // Événements spéciaux guildes - tous les vendredis à 18h
    this.scheduleTask('guild-weekend-events', '0 18 * * 5', async () => {
      console.log("🎉 Activation événements weekend guildes...");
      try {
        await this.activateWeekendGuildEvents();
      } catch (error) {
        console.error("❌ Erreur événements guildes:", error);
      }
    });

    // ===== VÉRIFICATIONS GÉNÉRALES =====
    // Vérification générale boutiques - toutes les heures
    this.scheduleTask('shop-health-check', '0 * * * *', async () => {
      console.log("🔍 Vérification santé des boutiques...");
      try {
        const result = await ShopService.processShopResets();
        if (result.totalReset > 0) {
          console.log(`✅ ${result.totalReset} boutiques mises à jour automatiquement`);
        }
      } catch (error) {
        console.error("❌ Erreur vérification boutiques:", error);
      }
    });

    console.log(`✅ ${this.scheduledTasks.size} tâches programmées démarrées`);
  }

  // ===== MÉTHODES GUILDES =====

  /**
   * 🔥 MISE À JOUR: Maintenance quotidienne des guildes avec transfert de leadership
   */
  private static async performGuildDailyMaintenance(serverId: string): Promise<{
    guildsProcessed: number;
    inactiveMembersRemoved: number;
    expiredInvitationsCleared: number;
    dailyRewardsReset: number;
    leadershipTransfers: number;
  }> {
    try {
      const guilds = await Guild.find({ serverId, status: "active" });
      let inactiveMembersRemoved = 0;
      let expiredInvitationsCleared = 0;
      let dailyRewardsReset = 0;
      let leadershipTransfers = 0;

      for (const guild of guilds) {
        // 1. Nettoyer les invitations expirées
        const invitationsBefore = guild.invitations.length;
        await guild.cleanupExpiredInvitations();
        const invitationsAfter = guild.invitations.length;
        expiredInvitationsCleared += (invitationsBefore - invitationsAfter);

        // 2. 👑 NOUVEAU: Vérifier et transférer leadership si nécessaire
        try {
          const leadershipResult = await GuildManagementService.checkAndTransferInactiveLeadership(guild._id);
          if (leadershipResult.success && leadershipResult.transferred) {
            leadershipTransfers++;
            console.log(`👑 Leadership transféré dans ${guild.name}: ${leadershipResult.oldLeader?.playerName} → ${leadershipResult.newLeader?.playerName}`);
          }
        } catch (error) {
          console.error(`❌ Erreur transfert leadership pour ${guild.name}:`, error);
        }

        // 3. Supprimer les membres inactifs SEULEMENT si activé par le leader
        if (guild.settings.autoKickInactiveMembers) {
          const thresholdDays = guild.settings.inactivityThresholdDays || 7;
          const inactiveMembers = guild.members.filter((member: any) => {
            const daysSinceActive = (Date.now() - member.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceActive > thresholdDays && member.role !== "leader";
          });
        
          for (const member of inactiveMembers) {
            await guild.removeMember(member.playerId, "inactive");
            
            // Notifier via WebSocket
            WebSocketService.notifyGuildMemberLeft(guild._id, {
              playerId: member.playerId,
              playerName: member.playerName,
              reason: 'inactive'
            });
        
            inactiveMembersRemoved++;
          }
        
          if (inactiveMembers.length > 0) {
            console.log(`🧹 ${guild.name}: ${inactiveMembers.length} membres inactifs supprimés automatiquement (seuil: ${thresholdDays} jours)`);
          }
        } else {
          console.log(`⏸️ ${guild.name}: Auto-kick désactivé - membres inactifs conservés`);
        }

        // 4. Reset des récompenses quotidiennes
        await guild.resetDailyProgress();
        dailyRewardsReset++;

        // Notifier les nouvelles récompenses disponibles
        WebSocketService.notifyGuildDailyRewards(guild._id, {
          rewardType: 'daily',
          totalEligibleMembers: guild.memberCount,
          claimedBy: 0,
          rewards: guild.rewards.dailyRewards.rewards
        });

        // 5. Mettre à jour les statistiques
        await guild.updateStats();
      }

      return {
        guildsProcessed: guilds.length,
        inactiveMembersRemoved,
        expiredInvitationsCleared,
        dailyRewardsReset,
        leadershipTransfers
      };

    } catch (error) {
      console.error(`❌ Error in guild daily maintenance for ${serverId}:`, error);
      return {
        guildsProcessed: 0,
        inactiveMembersRemoved: 0,
        expiredInvitationsCleared: 0,
        dailyRewardsReset: 0,
        leadershipTransfers: 0
      };
    }
  }

  /**
   * Démarrer automatiquement les quêtes quotidiennes
   */
  private static async autoStartDailyQuests(): Promise<void> {
    try {
      const guilds = await Guild.find({ status: "active", level: { $gte: 3 } });
      let questsStarted = 0;

      for (const guild of guilds) {
        // Vérifier s'il y a déjà des quêtes actives aujourd'hui
        const today = new Date().toDateString();
        const hasActiveDailyQuest = guild.currentQuests.some((quest: any) => 
          quest.questType === 'daily' && 
          quest.startDate.toDateString() === today
        );

        if (hasActiveDailyQuest) continue;

        // Sélectionner une quête quotidienne au hasard
        const dailyQuestTemplates = [
          'daily_contribution', 
          'daily_battles', 
          'daily_summons', 
          'daily_tower',
          'daily_campaign'
        ];
        
        const randomTemplate = dailyQuestTemplates[Math.floor(Math.random() * dailyQuestTemplates.length)];
        
        const result = await GuildActivityService.startGuildQuest(guild._id, 'daily', randomTemplate);
        if (result.success && result.quest) {
          // Notifier via WebSocket
          WebSocketService.notifyGuildQuestStarted(guild._id, {
            questId: result.quest.questId,
            name: result.quest.name,
            description: result.quest.description,
            questType: result.quest.questType,
            targetValue: result.quest.targetValue,
            endDate: result.quest.endDate,
            rewards: result.quest.rewards
          });
          
          questsStarted++;
        }
      }

      console.log(`📋 ${questsStarted} quêtes quotidiennes démarrées automatiquement`);

    } catch (error) {
      console.error("❌ Error auto-starting daily quests:", error);
    }
  }

  /**
   * Nettoyer les raids expirés
   */
  private static async cleanupExpiredRaids(): Promise<void> {
    try {
      const guilds = await Guild.find({ 
        status: "active",
        currentRaid: { $exists: true, $ne: null }
      });

      let raidsCompleted = 0;
      const now = new Date();

      for (const guild of guilds) {
        if (guild.currentRaid && guild.currentRaid.endTime < now) {
          // Raid expiré
          if (guild.currentRaid.status === "active") {
            // Marquer comme échoué si encore actif
            guild.currentRaid.status = "failed";
            
            // Notifier les participants
            WebSocketService.sendToPlayer(guild.currentRaid.participants[0]?.playerId || 'system', 'guild:raid_expired', {
              raidName: guild.currentRaid.name,
              reason: 'timeout'
            });
          }
          
          // Déplacer vers l'historique
          await guild.completeRaid(guild.currentRaid.raidId);
          raidsCompleted++;
        }
      }

      if (raidsCompleted > 0) {
        console.log(`⚔️ ${raidsCompleted} raids expirés nettoyés`);
      }

    } catch (error) {
      console.error("❌ Error cleaning up expired raids:", error);
    }
  }

  /**
   * Activer les événements weekend pour les guildes
   */
  private static async activateWeekendGuildEvents(): Promise<void> {
    try {
      const servers = ['S1', 'S2', 'S3'];
      
      for (const serverId of servers) {
        // Activer bonus contributions weekend
        WebSocketService.notifyGuildEvent(serverId, {
          eventType: 'bonus_contributions',
          eventName: 'Weekend Bonus',
          description: 'Double contribution points during weekend!',
          duration: 72, // 72h (vendredi 18h -> lundi 18h)
          bonusMultiplier: 2,
          specialRewards: {
            extraGuildExp: 1000,
            bonusGuildCoins: 500
          }
        });
      }

      console.log("🎉 Événements weekend guildes activés");

    } catch (error) {
      console.error("❌ Error activating weekend guild events:", error);
    }
  }

  // ===== MÉTHODES EXISTANTES =====

  // Programmer une tâche spécifique
  private static scheduleTask(name: string, cronExpression: string, task: () => Promise<void>) {
    try {
      const scheduledTask = cron.schedule(cronExpression, async () => {
        console.log(`⚡ Exécution tâche: ${name}`);
        try {
          await task();
        } catch (error) {
          console.error(`❌ Erreur tâche ${name}:`, error);
        }
      }, {
        timezone: "UTC"
      });

      scheduledTask.start();
      this.scheduledTasks.set(name, scheduledTask);
      console.log(`📋 Tâche "${name}" programmée: ${cronExpression}`);
      
    } catch (error) {
      console.error(`❌ Impossible de programmer la tâche ${name}:`, error);
    }
  }

  // Arrêter toutes les tâches
  public static stopAllSchedulers() {
    console.log("⏹️ Arrêt des tâches programmées...");
    
    this.scheduledTasks.forEach((task, name) => {
      try {
        task.stop();
        console.log(`🛑 Tâche "${name}" arrêtée`);
      } catch (error) {
        console.error(`❌ Erreur arrêt tâche ${name}:`, error);
      }
    });
    
    this.scheduledTasks.clear();
    console.log("✅ Toutes les tâches programmées arrêtées");
  }

  // Obtenir le statut des tâches
  public static getSchedulerStatus() {
    const tasks = Array.from(this.scheduledTasks.entries()).map(([name, task]) => ({
      name,
      running: task ? true : false
    }));

    return {
      totalTasks: this.scheduledTasks.size,
      tasks
    };
  }

  // Exécuter manuellement une tâche (pour debug)
  public static async runTaskManually(taskName: string) {
    console.log(`🔧 Exécution manuelle: ${taskName}`);
    
    switch (taskName) {
      case 'shop-reset':
        await ShopService.processShopResets();
        break;
      case 'daily-shop-reset':
        console.log("🌅 Reset quotidien manuel...");
        await ShopService.processShopResets();
        break;
      case 'weekly-shop-reset':
        console.log("📅 Reset hebdomadaire manuel...");
        await ShopService.processShopResets();
        break;
      case 'monthly-shop-reset':
        console.log("📆 Reset mensuel manuel...");
        await ShopService.processShopResets();
        break;
      case 'arena-daily-maintenance':
        console.log("🏟️ Maintenance arène manuelle...");
        await ArenaService.performDailyMaintenance('S1');
        break;
      case 'arena-rankings-update':
        console.log("📊 Mise à jour classements manuelle...");
        await ArenaService.getServerArenaStats('S1');
        break;
      case 'arena-events-check':
        console.log("🎉 Vérification événements arène manuelle...");
        await ArenaService.toggleSpecialEvent("doubleRewards", true);
        break;
      // ===== TÂCHES GUILDES =====
      case 'guild-daily-maintenance':
        console.log("🏛️ Maintenance guildes manuelle...");
        await this.performGuildDailyMaintenance('S1');
        break;
      case 'guild-leadership-check':
        console.log("👑 Vérification leadership manuelle...");
        const result = await GuildManagementService.checkAllInactiveLeadersOnServer('S1');
        console.log(`✅ ${result.transfersPerformed} transferts effectués sur ${result.guildsChecked} guildes`);
        break;
      case 'guild-daily-quests':
        console.log("📋 Démarrage quêtes quotidiennes manuel...");
        await this.autoStartDailyQuests();
        break;
      case 'guild-weekly-maintenance':
        console.log("📅 Maintenance hebdomadaire guildes manuelle...");
        await GuildManagementService.performWeeklyMaintenance('S1');
        break;
      case 'guild-raids-cleanup':
        console.log("⚔️ Nettoyage raids manuel...");
        await this.cleanupExpiredRaids();
        break;
      case 'guild-weekend-events':
        console.log("🎉 Événements weekend guildes manuel...");
        await this.activateWeekendGuildEvents();
        break;
        // ===== TÂCHES DAILY REWARDS =====
      case 'daily-rewards-reset':
        console.log("🎁 Reset Daily Rewards manuel...");
        const resetResult = await DailyRewardsService.performDailyReset();
        console.log(`✅ ${resetResult.processed} joueurs traités, ${resetResult.errors} erreurs`);
        break;
      case 'daily-rewards-reminder':
        console.log("⏰ Rappels Daily Rewards manuel...");
        console.log("📬 Rappels Daily Rewards à implémenter (feature future)");
        break;
        case 'daily-rewards-reminder':
        console.log("⏰ Rappels Daily Rewards manuel...");
        console.log("📬 Rappels Daily Rewards à implémenter (feature future)");
        break;
      // ===== TÂCHES BANNIÈRES ÉLÉMENTAIRES =====
      case 'elemental-banner-rotation':
        console.log("🔄 Rotation bannières élémentaires manuelle...");
        await ElementalBannerService.performDailyRotation('S1');
        break;
      case 'elemental-shop-friday':
        console.log("🛒 Ouverture boutique élémentaire manuelle...");
        WebSocketService.broadcastToServer('S1', 'elemental:shop_opened', {
          duration: 24,
          specialOffers: true
        });
        break;
      case 'elemental-friday-boost':
        console.log("🎉 Activation boost vendredi manuel...");
        WebSocketService.broadcastToServer('S1', 'elemental:drop_boost_active', {
          dropRate: 15,
          normalRate: 5,
          multiplier: 3,
          duration: 24
        });
        break;
      case 'elemental-sunday-reminder':
        console.log("📢 Rappel dimanche manuel...");
        WebSocketService.broadcastToServer('S1', 'elemental:sunday_reminder', {
          message: "Tomorrow: All elemental banners available!",
          elements: ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"],
          hoursUntil: 6
        });
        break;
      default:
        throw new Error(`Tâche inconnue: ${taskName}`);
    }
    
    console.log(`✅ Tâche ${taskName} exécutée manuellement`);
  }

  // Ajouter une tâche personnalisée
  public static addCustomTask(name: string, cronExpression: string, task: () => Promise<void>) {
    if (this.scheduledTasks.has(name)) {
      console.warn(`⚠️ Tâche ${name} existe déjà - écrasement`);
      const existingTask = this.scheduledTasks.get(name);
      if (existingTask) {
        existingTask.stop();
      }
    }

    this.scheduleTask(name, cronExpression, task);
    console.log(`➕ Tâche personnalisée ajoutée: ${name}`);
  }

  // Supprimer une tâche spécifique
  public static removeTask(name: string): boolean {
    const task = this.scheduledTasks.get(name);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(name);
      console.log(`🗑️ Tâche ${name} supprimée`);
      return true;
    }
    console.warn(`⚠️ Tâche ${name} introuvable`);
    return false;
  }
}

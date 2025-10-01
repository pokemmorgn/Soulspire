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
import { FreePullService } from './FreePullService';
import Player from '../models/Player';

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

    // ===== PULLS GRATUITS =====
    // Reset automatique des pulls gratuits - toutes les heures
    this.scheduleTask('free-pulls-auto-reset', '0 * * * *', async () => {
      console.log("🎁 Vérification reset automatique pulls gratuits...");
      try {
        const result = await this.processFreePullsReset();
        
        if (result.totalReset > 0) {
          console.log(`✅ Reset pulls gratuits: ${result.totalReset} joueurs traités`);
          console.log(`   - Daily: ${result.dailyReset} resets`);
          console.log(`   - Weekly: ${result.weeklyReset} resets`);
          console.log(`   - Monthly: ${result.monthlyReset} resets`);
          
          // Notifier via WebSocket les joueurs concernés
          for (const resetInfo of result.resetDetails) {
            WebSocketService.sendToPlayer(resetInfo.playerId, 'gacha:free_pulls_reset', {
              bannerId: resetInfo.bannerId,
              bannerName: resetInfo.bannerName,
              pullsAvailable: resetInfo.pullsAvailable,
              resetType: resetInfo.resetType,
              nextResetAt: resetInfo.nextResetAt
            });
          }
        }
      } catch (error) {
        console.error("❌ Erreur reset pulls gratuits:", error);
      }
    });

    // Rappel pulls gratuits non utilisés - tous les jours à 20h
    this.scheduleTask('free-pulls-reminder', '0 20 * * *', async () => {
      console.log("⏰ Envoi rappels pulls gratuits non utilisés...");
      try {
        const result = await this.sendFreePullsReminders();
        
        if (result.remindersSent > 0) {
          console.log(`📬 ${result.remindersSent} rappels envoyés`);
        }
      } catch (error) {
        console.error("❌ Erreur rappels pulls gratuits:", error);
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

  // ===== MÉTHODES PULLS GRATUITS =====

  /**
   * Traiter automatiquement les resets de pulls gratuits
   */
/**
 * Traiter automatiquement les resets de pulls gratuits (OPTIMISÉ pour haute performance)
 */
private static async processFreePullsReset(): Promise<{
  totalReset: number;
  dailyReset: number;
  weeklyReset: number;
  monthlyReset: number;
  resetDetails: Array<{
    playerId: string;
    bannerId: string;
    bannerName: string;
    pullsAvailable: number;
    resetType: string;
    nextResetAt: Date;
  }>;
}> {
  try {
    const now = new Date();
    const result = {
      totalReset: 0,
      dailyReset: 0,
      weeklyReset: 0,
      monthlyReset: 0,
      resetDetails: [] as any[]
    };

    // Configuration
    const BATCH_SIZE = 1000; // Nombre de joueurs à traiter par batch
    const PARALLEL_LIMIT = 20; // Nombre de resets en parallèle
    const MAX_DETAILS = 100; // Limite de détails stockés pour éviter surcharge mémoire

    console.log(`🎁 Démarrage du reset automatique des pulls gratuits...`);

    // ✅ Récupérer dynamiquement tous les serveurs actifs
    const activeServers = await Player.distinct('serverId');
    console.log(`🌍 ${activeServers.length} serveur(s) détecté(s): ${activeServers.join(', ')}`);

    // Traiter serveur par serveur pour mieux répartir la charge
    for (const serverId of activeServers) {
      console.log(`\n🔍 Traitement du serveur ${serverId}...`);
      
      let skip = 0;
      let hasMore = true;
      let serverResets = 0;
      let batchNumber = 0;

      while (hasMore) {
        batchNumber++;

        // Récupérer un batch de joueurs avec pulls gratuits expirés
        const players = await Player.find({
          serverId,
          'freePulls.nextResetAt': { $lte: now }
        })
        .select('_id serverId freePulls displayName')
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean(); // Utiliser lean() pour meilleures performances

        if (players.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`   📦 Batch ${batchNumber}: ${players.length} joueur(s) à vérifier`);

        // Récupérer toutes les bannières nécessaires en une seule requête
        const allBannerIds = new Set<string>();
        players.forEach(player => {
          player.freePulls?.forEach((fp: any) => {
            if (fp.nextResetAt <= now) {
              allBannerIds.add(fp.bannerId);
            }
          });
        });

        if (allBannerIds.size === 0) {
          console.log(`   ⏭️ Aucune bannière à traiter dans ce batch`);
          skip += BATCH_SIZE;
          continue;
        }

        const Banner = (await import('../models/Banner')).default;
        const banners = await Banner.find({
          bannerId: { $in: Array.from(allBannerIds) },
          'freePullConfig.enabled': true
        }).select('bannerId name freePullConfig').lean();

        console.log(`   🎰 ${banners.length} bannière(s) active(s) dans ce batch`);

        // Créer un map pour accès rapide
        const bannerMap = new Map(
          banners.map(b => [b.bannerId, b])
        );

        // Traiter les joueurs par chunks pour limiter la concurrence
        const chunks: any[][] = [];
        for (let i = 0; i < players.length; i += PARALLEL_LIMIT) {
          chunks.push(players.slice(i, i + PARALLEL_LIMIT));
        }

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex];
          
          const settledResults = await Promise.allSettled(
            chunk.map(async (playerData: any) => {
              try {
                // Récupérer le player document complet (nécessaire pour les méthodes)
                const player = await Player.findById(playerData._id);
                if (!player) return { success: false, reason: 'not_found' };

                let playerResets = 0;

                for (const tracker of player.freePulls) {
                  if (tracker.nextResetAt <= now) {
                    const banner = bannerMap.get(tracker.bannerId);

                    if (!banner || !banner.freePullConfig) {
                      continue;
                    }

                    const config = banner.freePullConfig;

                    // Calculer la prochaine date de reset
                    const nextResetAt = FreePullService.calculateNextResetDate(config.resetType);

                    // Effectuer le reset
                    await player.resetFreePulls(
                      tracker.bannerId,
                      config.pullsPerReset,
                      nextResetAt
                    );

                    playerResets++;

                    // Incrémenter les compteurs
                    result.totalReset++;
                    serverResets++;
                    
                    switch (config.resetType) {
                      case 'daily':
                        result.dailyReset++;
                        break;
                      case 'weekly':
                        result.weeklyReset++;
                        break;
                      case 'monthly':
                        result.monthlyReset++;
                        break;
                    }

                    // Ajouter aux détails (limiter pour éviter surcharge mémoire)
                    if (result.resetDetails.length < MAX_DETAILS) {
                      result.resetDetails.push({
                        playerId: player._id,
                        bannerId: tracker.bannerId,
                        bannerName: banner.name,
                        pullsAvailable: config.pullsPerReset,
                        resetType: config.resetType,
                        nextResetAt
                      });
                    }
                  }
                }

                if (playerResets > 0) {
                  console.log(`      ✓ ${player.displayName}: ${playerResets} reset(s)`);
                }

                return { success: true, resets: playerResets };

              } catch (error) {
                console.error(`      ✗ Erreur joueur ${playerData._id}:`, error);
                return { success: false, error };
              }
            })
          );

          // Compter les succès/échecs
          const successful = settledResults.filter(r => r.status === 'fulfilled' && (r.value as any)?.success).length;
          const failed = settledResults.length - successful;

          if (failed > 0) {
            console.log(`      ⚠️ Chunk ${chunkIndex + 1}/${chunks.length}: ${successful} OK, ${failed} échec(s)`);
          }
        }

        skip += BATCH_SIZE;

        // Pause de 100ms entre les batchs pour éviter surcharge DB
        if (hasMore && players.length === BATCH_SIZE) {
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          hasMore = false; // Dernier batch (moins de BATCH_SIZE joueurs)
        }
      }

      console.log(`   ✅ Serveur ${serverId}: ${serverResets} reset(s) effectué(s)`);
    }

    console.log(`\n🎉 Reset global terminé:`);
    console.log(`   - Serveurs traités: ${activeServers.length}`);
    console.log(`   - Total: ${result.totalReset} reset(s)`);
    console.log(`   - Daily: ${result.dailyReset}`);
    console.log(`   - Weekly: ${result.weeklyReset}`);
    console.log(`   - Monthly: ${result.monthlyReset}`);

    return result;

  } catch (error) {
    console.error("❌ Error in processFreePullsReset:", error);
    return {
      totalReset: 0,
      dailyReset: 0,
      weeklyReset: 0,
      monthlyReset: 0,
      resetDetails: []
    };
  }
}
  /**
   * Envoyer des rappels aux joueurs qui ont des pulls gratuits non utilisés
   */
  private static async sendFreePullsReminders(): Promise<{
    remindersSent: number;
    playersNotified: string[];
  }> {
    try {
      const now = new Date();
      const result = {
        remindersSent: 0,
        playersNotified: [] as string[]
      };

      // Récupérer les joueurs avec pulls gratuits disponibles
      const players = await Player.find({
        'freePulls': {
          $elemMatch: {
            pullsAvailable: { $gt: 0 },
            nextResetAt: { $lte: new Date(now.getTime() + 4 * 60 * 60 * 1000) } // Dans moins de 4h
          }
        }
        }).select('_id serverId freePulls displayName');

      console.log(`📬 ${players.length} joueurs avec pulls gratuits à rappeler...`);

      for (const player of players) {
        const availablePulls = player.freePulls.filter(
          fp => fp.pullsAvailable > 0 && fp.nextResetAt <= new Date(now.getTime() + 4 * 60 * 60 * 1000)
        );

        if (availablePulls.length > 0) {
          // Récupérer les noms des bannières
          const Banner = (await import('../models/Banner')).default;
          const bannerIds = availablePulls.map(fp => fp.bannerId);
          const banners = await Banner.find({ bannerId: { $in: bannerIds } }).select('bannerId name');

          const bannerMap = new Map(banners.map(b => [b.bannerId, b.name]));

          // Envoyer notification via WebSocket
          WebSocketService.sendToPlayer(player._id, 'gacha:free_pulls_reminder', {
            message: `You have ${availablePulls.length} free pull(s) available!`,
            banners: availablePulls.map(fp => ({
              bannerId: fp.bannerId,
              bannerName: bannerMap.get(fp.bannerId) || 'Unknown Banner',
              pullsAvailable: fp.pullsAvailable,
              expiresIn: Math.round((fp.nextResetAt.getTime() - now.getTime()) / (1000 * 60 * 60)) // heures
            })),
            priority: 'medium'
          });

          result.remindersSent++;
          result.playersNotified.push(player._id);

          console.log(`📧 Rappel envoyé à ${player.displayName}: ${availablePulls.length} pull(s) gratuit(s)`);
        }
      }

      return result;

    } catch (error) {
      console.error("❌ Error in sendFreePullsReminders:", error);
      return {
        remindersSent: 0,
        playersNotified: []
      };
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
        const leadershipResult = await GuildManagementService.checkAllInactiveLeadersOnServer('S1');
        console.log(`✅ ${leadershipResult.transfersPerformed} transferts effectués sur ${leadershipResult.guildsChecked} guildes`);
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
        const dailyRewardsResult = await DailyRewardsService.performDailyReset();
        console.log(`✅ ${dailyRewardsResult.processed} joueurs traités, ${dailyRewardsResult.errors} erreurs`);
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
      // ===== TÂCHES PULLS GRATUITS =====
      case 'free-pulls-auto-reset':
        console.log("🎁 Reset pulls gratuits manuel...");
        const freePullsResult = await this.processFreePullsReset();
        console.log(`✅ ${freePullsResult.totalReset} resets effectués (Daily: ${freePullsResult.dailyReset}, Weekly: ${freePullsResult.weeklyReset}, Monthly: ${freePullsResult.monthlyReset})`);
        break;
      case 'free-pulls-reminder':
        console.log("⏰ Rappels pulls gratuits manuel...");
        const remindersResult = await this.sendFreePullsReminders();
        console.log(`✅ ${remindersResult.remindersSent} rappels envoyés`);
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

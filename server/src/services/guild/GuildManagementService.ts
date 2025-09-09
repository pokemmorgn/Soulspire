import Guild, { IGuildDocument } from "../../models/Guild";
import Player from "../../models/Player";
import { WebSocketService } from '../WebSocketService';

export interface GuildCreationResult {
  success: boolean;
  guild?: IGuildDocument;
  error?: string;
  code?: string;
}

export interface LeadershipTransferResult {
  success: boolean;
  transferred?: boolean;
  newLeader?: {
    playerId: string;
    playerName: string;
    role: string;
    lastActiveAt: Date;
  };
  oldLeader?: {
    playerId: string;
    playerName: string;
    inactiveDays: number;
  };
  error?: string;
  code?: string;
}

export class GuildManagementService {

  static async createGuild(
    creatorId: string,
    serverId: string,
    guildData: {
      name: string;
      tag: string;
      description?: string;
      iconId?: string;
      isPublic?: boolean;
      language?: string;
    }
  ): Promise<GuildCreationResult> {
    try {
      const player = await Player.findOne({ _id: creatorId, serverId });
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      if (player.guildId) {
        return { success: false, error: "Player already in a guild", code: "ALREADY_IN_GUILD" };
      }

      if (player.level < 10) {
        return { success: false, error: "Minimum level 10 required", code: "LEVEL_TOO_LOW" };
      }

      const existingName = await Guild.findOne({ 
        name: new RegExp(`^${guildData.name}$`, 'i'), 
        serverId 
      });
      if (existingName) {
        return { success: false, error: "Guild name already exists", code: "NAME_EXISTS" };
      }

      const existingTag = await Guild.findOne({ 
        tag: guildData.tag.toUpperCase(), 
        serverId 
      });
      if (existingTag) {
        return { success: false, error: "Guild tag already exists", code: "TAG_EXISTS" };
      }

      const creationCost = 10000;
      if (player.gold < creationCost) {
        return { success: false, error: "Insufficient gold", code: "INSUFFICIENT_GOLD" };
      }

      const guild = new Guild({
        serverId,
        name: guildData.name,
        tag: guildData.tag.toUpperCase(),
        description: guildData.description || "",
        iconId: guildData.iconId || "default_guild_icon",
        createdBy: creatorId,
        settings: {
          isPublic: guildData.isPublic ?? true,
          language: guildData.language || "en"
        }
      });

      await guild.addMember(creatorId, player.displayName, player.level, player.calculatePowerScore());
      await guild.promoteMember(creatorId, "leader");

      player.gold -= creationCost;
      player.guildId = guild._id;
      await player.save();

      await guild.save();

      console.log(`🏛️ Guild created: ${guild.name} [${guild.tag}] by ${player.displayName} on ${serverId}`);
      WebSocketService.notifyGuildCreated(creatorId, serverId, {
        guildId: guild._id,
        name: guild.name,
        tag: guild.tag,
        level: guild.level
      });

      // 🔥 NOUVEAU: Faire rejoindre le créateur à la room de guilde
      WebSocketService.joinGuildRoom(creatorId, guild._id);
      return { success: true, guild };

    } catch (error) {
      console.error("❌ Error creating guild:", error);
      return { success: false, error: "Failed to create guild", code: "CREATION_FAILED" };
    }
  }

  static async disbandGuild(guildId: string, playerId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      if (!guild.isLeader(playerId)) {
        return { success: false, error: "Only leader can disband guild" };
      }

      for (const member of guild.members) {
        const player = await Player.findById(member.playerId);
        if (player) {
          player.guildId = undefined;
          await player.save();
        }
      }
      
      WebSocketService.notifyGuildDisbanded(guild.members, {
        guildName: guild.name,
        guildTag: guild.tag,
        reason: reason || "Disbanded by leader",
        disbandedBy: playerId
      });
      
      // 🔥 NOUVEAU: Faire quitter tous les membres des rooms
      guild.members.forEach(member => {
        WebSocketService.leaveGuildRoom(member.playerId, guild._id);
      });

      guild.status = "disbanded";
      guild.disbandedAt = new Date();
      guild.disbandedBy = playerId;
      guild.disbandReason = reason || "Disbanded by leader";
      await guild.save();

      console.log(`🏛️ Guild disbanded: ${guild.name} [${guild.tag}] by ${playerId}`);
      return { success: true };

    } catch (error) {
      console.error("❌ Error disbanding guild:", error);
      return { success: false, error: "Failed to disband guild" };
    }
  }

  static async getGuildDetails(guildId: string): Promise<IGuildDocument | null> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild || guild.status === "disbanded") {
        return null;
      }

      await guild.updateStats();
      await guild.cleanupExpiredInvitations();

      return guild;

    } catch (error) {
      console.error("❌ Error getting guild details:", error);
      return null;
    }
  }

static async updateGuildSettings(
  guildId: string,
  playerId: string,
  settings: {
    description?: string;
    iconId?: string;
    isPublic?: boolean;
    autoAccept?: boolean;
    minimumLevel?: number;
    minimumPower?: number;
    language?: string;
    requiredActivity?: "low" | "medium" | "high";
    
    // 🔥 NOUVEAU: Paramètres auto-kick
    autoKickInactiveMembers?: boolean;
    inactivityThresholdDays?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const guild = await Guild.findById(guildId);
    if (!guild) {
      return { success: false, error: "Guild not found" };
    }

    if (!guild.isLeader(playerId)) {
      return { success: false, error: "Only leader can update settings" };
    }

    // Paramètres existants
    if (settings.description !== undefined) guild.description = settings.description;
    if (settings.iconId !== undefined) guild.iconId = settings.iconId;
    if (settings.isPublic !== undefined) guild.settings.isPublic = settings.isPublic;
    if (settings.autoAccept !== undefined) guild.settings.autoAccept = settings.autoAccept;
    if (settings.minimumLevel !== undefined) guild.settings.minimumLevel = settings.minimumLevel;
    if (settings.minimumPower !== undefined) guild.settings.minimumPower = settings.minimumPower;
    if (settings.language !== undefined) guild.settings.language = settings.language;
    if (settings.requiredActivity !== undefined) guild.settings.requiredActivity = settings.requiredActivity;

    // 🔥 NOUVEAU: Paramètres auto-kick
    if (settings.autoKickInactiveMembers !== undefined) {
      const oldSetting = guild.settings.autoKickInactiveMembers;
      guild.settings.autoKickInactiveMembers = settings.autoKickInactiveMembers;
      
      // Log du changement
      if (oldSetting !== settings.autoKickInactiveMembers) {
        await guild.addActivityLog({
          type: "settings_changed",
          playerId: playerId,
          playerName: "Leader",
          details: { 
            setting: "autoKickInactiveMembers",
            oldValue: oldSetting,
            newValue: settings.autoKickInactiveMembers,
            changedAt: new Date()
          }
        });
        
        console.log(`⚙️ ${guild.name}: Auto-kick ${settings.autoKickInactiveMembers ? 'activé' : 'désactivé'} par le leader`);
      }
    }
    
    if (settings.inactivityThresholdDays !== undefined) {
      // Validation du seuil (3-30 jours)
      const threshold = Math.max(3, Math.min(30, settings.inactivityThresholdDays));
      guild.settings.inactivityThresholdDays = threshold;
    }

    await guild.save();
    return { success: true };

  } catch (error) {
    console.error("❌ Error updating guild settings:", error);
    return { success: false, error: "Failed to update settings" };
  }
}

  static async getGuildActivityLogs(guildId: string, limit: number = 50): Promise<any[]> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) return [];

      return guild.activityLogs
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit)
        .map(log => ({
          type: log.type,
          playerName: log.playerName,
          targetPlayerName: log.targetPlayerName,
          details: log.details,
          timestamp: log.timestamp
        }));

    } catch (error) {
      console.error("❌ Error getting guild activity logs:", error);
      return [];
    }
  }

  // 🔥 NOUVELLE MÉTHODE: Vérifier et transférer le leadership si inactif
  static async checkAndTransferInactiveLeadership(guildId: string): Promise<LeadershipTransferResult> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found", code: "GUILD_NOT_FOUND" };
      }

      // Trouver le leader actuel
      const currentLeader = guild.members.find(member => member.role === "leader");
      if (!currentLeader) {
        return { success: false, error: "No leader found", code: "NO_LEADER" };
      }

      // Calculer l'inactivité du leader (en heures)
      const now = new Date();
      const inactiveHours = (now.getTime() - currentLeader.lastActiveAt.getTime()) / (1000 * 60 * 60);
      const inactiveDays = Math.floor(inactiveHours / 24);

      // Seuil d'inactivité : 48-72h (paramétrable)
      const inactivityThresholdHours = 48; // 48h par défaut
      
      if (inactiveHours < inactivityThresholdHours) {
        return { 
          success: true, 
          transferred: false,
          oldLeader: {
            playerId: currentLeader.playerId,
            playerName: currentLeader.playerName,
            inactiveDays
          }
        };
      }

      // Chercher le meilleur candidat pour remplacer
      const eligibleOfficers = guild.members.filter(member => 
        member.role === "officer" && 
        member.playerId !== currentLeader.playerId
      );
      
      let newLeader;
      if (eligibleOfficers.length > 0) {
        // Prendre l'officier le plus actif (dernière activité la plus récente)
        newLeader = eligibleOfficers.sort((a, b) => 
          b.lastActiveAt.getTime() - a.lastActiveAt.getTime()
        )[0];
      } else {
        // 🔥 NOUVEAU: Si pas d'officiers, chercher parmi les Elite
        const eligibleElites = guild.members.filter(member => 
          member.role === "elite" && 
          member.playerId !== currentLeader.playerId
        );
      
        if (eligibleElites.length > 0) {
          newLeader = eligibleElites.sort((a, b) => 
            b.lastActiveAt.getTime() - a.lastActiveAt.getTime()
          )[0];
        } else {
          // Si pas d'Elite, prendre le membre le plus actif
          const eligibleMembers = guild.members.filter(member => 
            member.role === "member" && 
            member.playerId !== currentLeader.playerId
          );
      
          if (eligibleMembers.length === 0) {
            return { 
              success: false, 
              error: "No eligible candidates for leadership transfer", 
              code: "NO_CANDIDATES" 
            };
          }
      
          newLeader = eligibleMembers.sort((a, b) => 
            b.lastActiveAt.getTime() - a.lastActiveAt.getTime()
          )[0];
        }
      }

      // Vérifier que le nouveau leader n'est pas trop inactif aussi (max 24h)
      const newLeaderInactiveHours = (now.getTime() - newLeader.lastActiveAt.getTime()) / (1000 * 60 * 60);
      if (newLeaderInactiveHours > 24) {
        return { 
          success: false, 
          error: "No sufficiently active candidates found", 
          code: "ALL_INACTIVE" 
        };
      }

      // Effectuer le transfert de leadership
      await guild.demoteMember(currentLeader.playerId);
      await guild.promoteMember(newLeader.playerId, "leader");

      // Ajouter log d'activité spécial
      await guild.addActivityLog({
        type: "promote",
        playerId: newLeader.playerId,
        playerName: newLeader.playerName,
        targetPlayerId: currentLeader.playerId,
        targetPlayerName: currentLeader.playerName,
        details: { 
          reason: "automatic_leadership_transfer",
          oldLeaderInactiveDays: inactiveDays,
          transferredAt: now,
          newLeaderLastActive: newLeader.lastActiveAt
        }
      });

      // Notifier via WebSocket
      WebSocketService.notifyGuildMemberRoleChanged(guild._id, {
        playerId: newLeader.playerId,
        playerName: newLeader.playerName,
        oldRole: newLeader.role,
        newRole: "leader",
        changedBy: "system",
        changedByName: "Auto-Transfer System"
      });

      // Notifier l'ancien leader de sa rétrogradation
      WebSocketService.notifyGuildMemberRoleChanged(guild._id, {
        playerId: currentLeader.playerId,
        playerName: currentLeader.playerName,
        oldRole: "leader",
        newRole: "member",
        changedBy: "system",
        changedByName: "Auto-Transfer System"
      });

      // Notification spéciale à toute la guilde
      WebSocketService.sendToPlayer(newLeader.playerId, 'guild:leadership_auto_transferred', {
        type: 'leadership_gained',
        oldLeader: {
          playerId: currentLeader.playerId,
          playerName: currentLeader.playerName,
          inactiveDays
        },
        newLeader: {
          playerId: newLeader.playerId,
          playerName: newLeader.playerName,
          role: "leader"
        },
        reason: "leadership_inactivity",
        transferredAt: now
      });

      WebSocketService.sendToPlayer(currentLeader.playerId, 'guild:leadership_auto_transferred', {
        type: 'leadership_lost',
        oldLeader: {
          playerId: currentLeader.playerId,
          playerName: currentLeader.playerName,
          inactiveDays
        },
        newLeader: {
          playerId: newLeader.playerId,
          playerName: newLeader.playerName,
          role: "leader"
        },
        reason: "leadership_inactivity",
        transferredAt: now
      });

      console.log(`👑 Leadership transferred in guild ${guild.name}: ${currentLeader.playerName} → ${newLeader.playerName} (inactive ${inactiveDays} days)`);

      return {
        success: true,
        transferred: true,
        newLeader: {
          playerId: newLeader.playerId,
          playerName: newLeader.playerName,
          role: "leader",
          lastActiveAt: newLeader.lastActiveAt
        },
        oldLeader: {
          playerId: currentLeader.playerId,
          playerName: currentLeader.playerName,
          inactiveDays
        }
      };

    } catch (error) {
      console.error("❌ Error checking/transferring leadership:", error);
      return { success: false, error: "Failed to transfer leadership", code: "TRANSFER_FAILED" };
    }
  }

  // 🔥 NOUVELLE MÉTHODE: Vérifier tous les leaders inactifs d'un serveur
  static async checkAllInactiveLeadersOnServer(serverId: string): Promise<{
    guildsChecked: number;
    transfersPerformed: number;
    transfers: Array<{
      guildId: string;
      guildName: string;
      oldLeader: string;
      newLeader: string;
      inactiveDays: number;
    }>;
  }> {
    try {
      const guilds = await Guild.find({ serverId, status: "active" });
      const transfers: Array<any> = [];
      let transfersPerformed = 0;

      for (const guild of guilds) {
        const result = await this.checkAndTransferInactiveLeadership(guild._id);
        
        if (result.success && result.transferred) {
          transfers.push({
            guildId: guild._id,
            guildName: guild.name,
            oldLeader: result.oldLeader!.playerName,
            newLeader: result.newLeader!.playerName,
            inactiveDays: result.oldLeader!.inactiveDays
          });
          transfersPerformed++;
        }
      }

      console.log(`👑 Leadership check on ${serverId}: ${transfersPerformed} transfers performed out of ${guilds.length} guilds`);

      return {
        guildsChecked: guilds.length,
        transfersPerformed,
        transfers
      };

    } catch (error) {
      console.error("❌ Error checking all inactive leaders:", error);
      return {
        guildsChecked: 0,
        transfersPerformed: 0,
        transfers: []
      };
    }
  }

  // 🔥 MÉTHODE MISE À JOUR: Maintenance quotidienne avec transfert de leadership
  static async performDailyMaintenance(serverId: string): Promise<void> {
    try {
      const guilds = await Guild.find({ serverId, status: "active" });
      
      for (const guild of guilds) {
        await guild.resetDailyProgress();
        await guild.cleanupExpiredInvitations();
        
        const inactiveMembers = guild.members.filter((member: any) => {
          const daysSinceActive = (Date.now() - member.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceActive > 7;
        });

        for (const member of inactiveMembers) {
          if (member.role !== "leader") {
            await guild.removeMember(member.playerId, "inactive");
            
            const player = await Player.findById(member.playerId);
            if (player) {
              player.guildId = undefined;
              await player.save();
            }
          }
        }

        await guild.updateStats();
      }

      // 🔥 NOUVEAU: Vérifier les leaders inactifs
      const leadershipCheck = await this.checkAllInactiveLeadersOnServer(serverId);
      
      if (leadershipCheck.transfersPerformed > 0) {
        console.log(`👑 ${leadershipCheck.transfersPerformed} leadership transfers performed during daily maintenance on ${serverId}`);
      }

      console.log(`🏛️ Daily guild maintenance completed for ${serverId}: ${guilds.length} guilds processed`);

    } catch (error) {
      console.error("❌ Error in guild daily maintenance:", error);
    }
  }

  static async performWeeklyMaintenance(serverId: string): Promise<void> {
    try {
      const guilds = await Guild.find({ serverId, status: "active" });
      
      for (const guild of guilds) {
        await guild.resetWeeklyProgress();

        const expiredQuests = guild.currentQuests.filter((quest: any) => 
          quest.endDate < new Date() && !quest.isCompleted
        );

        for (const quest of expiredQuests) {
          await guild.completeQuest(quest.questId);
        }
      }

      console.log(`🏛️ Weekly guild maintenance completed for ${serverId}: ${guilds.length} guilds processed`);

    } catch (error) {
      console.error("❌ Error in guild weekly maintenance:", error);
    }
  }

  static async getGuildStatistics(serverId: string): Promise<{
    totalGuilds: number;
    activeGuilds: number;
    totalMembers: number;
    averageMembersPerGuild: number;
    topGuildByPower: string;
    topGuildByLevel: string;
  }> {
    try {
      const allGuilds = await Guild.find({ serverId });
      const activeGuilds = allGuilds.filter(g => g.status === "active");
      
      const totalMembers = activeGuilds.reduce((sum, guild) => sum + guild.memberCount, 0);
      const averageMembersPerGuild = activeGuilds.length > 0 ? Math.round(totalMembers / activeGuilds.length) : 0;
      
      const topByPower = activeGuilds.sort((a, b) => b.stats.totalPower - a.stats.totalPower)[0];
      const topByLevel = activeGuilds.sort((a, b) => b.level - a.level)[0];

      return {
        totalGuilds: allGuilds.length,
        activeGuilds: activeGuilds.length,
        totalMembers,
        averageMembersPerGuild,
        topGuildByPower: topByPower ? `${topByPower.name} [${topByPower.tag}]` : "None",
        topGuildByLevel: topByLevel ? `${topByLevel.name} [${topByLevel.tag}]` : "None"
      };

    } catch (error) {
      console.error("❌ Error getting guild statistics:", error);
      return {
        totalGuilds: 0,
        activeGuilds: 0,
        totalMembers: 0,
        averageMembersPerGuild: 0,
        topGuildByPower: "None",
        topGuildByLevel: "None"
      };
    }
  }

  /**
   * Notifier mise à jour de la puissance de guilde
   */
  public static async notifyGuildPowerUpdate(guildId: string, serverId: string): Promise<void> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) return;

      await guild.updateStats();
      
      // Vérifier si c'est un nouveau record serveur
      const serverGuilds = await Guild.find({ serverId, status: "active" })
        .sort({ "stats.totalPower": -1 })
        .limit(10);
      
      const guildRank = serverGuilds.findIndex(g => g._id === guildId) + 1;
      
      // Notifier seulement si dans le top 5
      if (guildRank > 0 && guildRank <= 5) {
        WebSocketService.notifyGuildPowerRecord(guildId, serverId, {
          guildName: guild.name,
          guildTag: guild.tag,
          newTotalPower: guild.stats.totalPower,
          oldRecord: 0, // Sera calculé selon ta logique métier
          serverRank: guildRank,
          powerIncrease: 0 // Sera calculé selon ta logique métier
        });
      }
    } catch (error) {
      console.error('❌ Error notifying guild power update:', error);
    }
  }
}

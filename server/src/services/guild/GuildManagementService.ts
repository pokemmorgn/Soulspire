import Guild, { IGuildDocument } from "../../models/Guild";
import Player from "../../models/Player";

export interface GuildCreationResult {
  success: boolean;
  guild?: IGuildDocument;
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

      if (settings.description !== undefined) guild.description = settings.description;
      if (settings.iconId !== undefined) guild.iconId = settings.iconId;
      if (settings.isPublic !== undefined) guild.settings.isPublic = settings.isPublic;
      if (settings.autoAccept !== undefined) guild.settings.autoAccept = settings.autoAccept;
      if (settings.minimumLevel !== undefined) guild.settings.minimumLevel = settings.minimumLevel;
      if (settings.minimumPower !== undefined) guild.settings.minimumPower = settings.minimumPower;
      if (settings.language !== undefined) guild.settings.language = settings.language;
      if (settings.requiredActivity !== undefined) guild.settings.requiredActivity = settings.requiredActivity;

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
}

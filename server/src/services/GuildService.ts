import Guild, { IGuild, IGuildDocument, IGuildMember, IGuildQuest, IGuildRaid } from "../models/Guild";
import Player, { IPlayerDocument } from "../models/Player";
import { IdGenerator } from "../utils/idGenerator";

export interface GuildCreationResult {
  success: boolean;
  guild?: IGuildDocument;
  error?: string;
  code?: string;
}

export interface GuildJoinResult {
  success: boolean;
  guild?: IGuildDocument;
  member?: IGuildMember;
  error?: string;
  code?: string;
}

export interface GuildApplicationResult {
  success: boolean;
  applicationId?: string;
  autoAccepted?: boolean;
  error?: string;
  code?: string;
}

export interface GuildInvitationResult {
  success: boolean;
  invitationId?: string;
  expiresAt?: Date;
  error?: string;
  code?: string;
}

export class GuildService {
  
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

      const existingName = await Guild.findByName(guildData.name, serverId);
      if (existingName) {
        return { success: false, error: "Guild name already exists", code: "NAME_EXISTS" };
      }

      const existingTag = await Guild.findByTag(guildData.tag, serverId);
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

  static async applyToGuild(playerId: string, guildId: string, message: string = ""): Promise<GuildApplicationResult> {
    try {
      const player = await Player.findById(playerId);
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      if (player.guildId) {
        return { success: false, error: "Already in a guild", code: "ALREADY_IN_GUILD" };
      }

      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found", code: "GUILD_NOT_FOUND" };
      }

      if (!guild.canJoin(player.level, player.calculatePowerScore())) {
        return { success: false, error: "Requirements not met", code: "REQUIREMENTS_NOT_MET" };
      }

      await guild.addApplication(playerId, player.displayName, player.level, player.calculatePowerScore(), message);

      if (guild.settings.autoAccept) {
        player.guildId = guild._id;
        await player.save();
        return { success: true, autoAccepted: true };
      }

      return { success: true, applicationId: playerId };

    } catch (error) {
      console.error("❌ Error applying to guild:", error);
      return { success: false, error: "Application failed", code: "APPLICATION_FAILED" };
    }
  }

  static async processApplication(guildId: string, applicantId: string, action: "accept" | "reject", processedBy: string): Promise<{ success: boolean; error?: string }> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      if (!guild.canManageMembers(processedBy)) {
        return { success: false, error: "Insufficient permissions" };
      }

      await guild.processApplication(applicantId, action, processedBy);

      if (action === "accept") {
        const player = await Player.findById(applicantId);
        if (player) {
          player.guildId = guild._id;
          await player.save();
        }
      }

      return { success: true };

    } catch (error) {
      console.error("❌ Error processing application:", error);
      return { success: false, error: "Failed to process application" };
    }
  }

  static async invitePlayer(guildId: string, targetPlayerId: string, invitedBy: string): Promise<GuildInvitationResult> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found", code: "GUILD_NOT_FOUND" };
      }

      if (!guild.canManageMembers(invitedBy)) {
        return { success: false, error: "Insufficient permissions", code: "NO_PERMISSION" };
      }

      const targetPlayer = await Player.findById(targetPlayerId);
      if (!targetPlayer) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      if (targetPlayer.guildId) {
        return { success: false, error: "Player already in a guild", code: "ALREADY_IN_GUILD" };
      }

      const inviter = guild.getMember(invitedBy);
      if (!inviter) {
        return { success: false, error: "Inviter not in guild", code: "INVITER_NOT_MEMBER" };
      }

      await guild.inviteMember(targetPlayerId, targetPlayer.displayName, invitedBy, inviter.playerName);

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return { success: true, invitationId: targetPlayerId, expiresAt };

    } catch (error) {
      console.error("❌ Error inviting player:", error);
      return { success: false, error: "Invitation failed", code: "INVITATION_FAILED" };
    }
  }

  static async processInvitation(playerId: string, guildId: string, action: "accept" | "decline"): Promise<GuildJoinResult> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found", code: "GUILD_NOT_FOUND" };
      }

      const player = await Player.findById(playerId);
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      await guild.processInvitation(playerId, action);

      if (action === "accept") {
        if (player.guildId) {
          return { success: false, error: "Already in a guild", code: "ALREADY_IN_GUILD" };
        }

        await guild.addMember(playerId, player.displayName, player.level, player.calculatePowerScore());
        player.guildId = guild._id;
        await player.save();

        const member = guild.getMember(playerId);
        return { success: true, guild, member };
      }

      return { success: true };

    } catch (error) {
      console.error("❌ Error processing invitation:", error);
      return { success: false, error: "Failed to process invitation", code: "PROCESS_FAILED" };
    }
  }

  static async leaveGuild(playerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const player = await Player.findById(playerId);
      if (!player || !player.guildId) {
        return { success: false, error: "Player not in a guild" };
      }

      const guild = await Guild.findById(player.guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      if (guild.isLeader(playerId) && guild.memberCount > 1) {
        return { success: false, error: "Leader must transfer leadership or disband guild" };
      }

      await guild.removeMember(playerId, "left");
      player.guildId = undefined;
      await player.save();

      if (guild.memberCount === 0) {
        guild.status = "disbanded";
        guild.disbandedAt = new Date();
        guild.disbandReason = "Last member left";
        await guild.save();
      }

      return { success: true };

    } catch (error) {
      console.error("❌ Error leaving guild:", error);
      return { success: false, error: "Failed to leave guild" };
    }
  }

  static async kickMember(guildId: string, targetPlayerId: string, kickedBy: string): Promise<{ success: boolean; error?: string }> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      if (!guild.canManageMembers(kickedBy)) {
        return { success: false, error: "Insufficient permissions" };
      }

      const targetMember = guild.getMember(targetPlayerId);
      if (!targetMember) {
        return { success: false, error: "Player not in guild" };
      }

      if (targetMember.role === "leader") {
        return { success: false, error: "Cannot kick the leader" };
      }

      const kicker = guild.getMember(kickedBy);
      if (kicker && targetMember.role === "officer" && kicker.role !== "leader") {
        return { success: false, error: "Officers can only be kicked by the leader" };
      }

      await guild.removeMember(targetPlayerId, "kicked");

      const player = await Player.findById(targetPlayerId);
      if (player) {
        player.guildId = undefined;
        await player.save();
      }

      return { success: true };

    } catch (error) {
      console.error("❌ Error kicking member:", error);
      return { success: false, error: "Failed to kick member" };
    }
  }

  static async promoteMember(guildId: string, targetPlayerId: string, newRole: "officer" | "leader", promotedBy: string): Promise<{ success: boolean; error?: string }> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      if (newRole === "leader" && !guild.isLeader(promotedBy)) {
        return { success: false, error: "Only leader can promote to leader" };
      }

      if (newRole === "officer" && !guild.canManageMembers(promotedBy)) {
        return { success: false, error: "Insufficient permissions" };
      }

      if (newRole === "leader") {
        await guild.demoteMember(promotedBy);
      }

      await guild.promoteMember(targetPlayerId, newRole);
      return { success: true };

    } catch (error) {
      console.error("❌ Error promoting member:", error);
      return { success: false, error: "Failed to promote member" };
    }
  }

  static async demoteMember(guildId: string, targetPlayerId: string, demotedBy: string): Promise<{ success: boolean; error?: string }> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      if (!guild.isLeader(demotedBy)) {
        return { success: false, error: "Only leader can demote members" };
      }

      const targetMember = guild.getMember(targetPlayerId);
      if (!targetMember || targetMember.role === "member") {
        return { success: false, error: "Player is already a member or not in guild" };
      }

      await guild.demoteMember(targetPlayerId);
      return { success: true };

    } catch (error) {
      console.error("❌ Error demoting member:", error);
      return { success: false, error: "Failed to demote member" };
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

  static async contributeToGuild(playerId: string, contribution: { gold?: number; materials?: Record<string, number> }): Promise<{ success: boolean; error?: string; contributionPoints?: number }> {
    try {
      const player = await Player.findById(playerId);
      if (!player || !player.guildId) {
        return { success: false, error: "Player not in a guild" };
      }

      const guild = await Guild.findById(player.guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      let contributionPoints = 0;
      let cost = { gold: 0, materials: {} as Record<string, number> };

      if (contribution.gold && contribution.gold > 0) {
        if (player.gold < contribution.gold) {
          return { success: false, error: "Insufficient gold" };
        }
        cost.gold = contribution.gold;
        contributionPoints += contribution.gold / 100;
      }

      if (contribution.materials) {
        for (const [material, amount] of Object.entries(contribution.materials)) {
          const playerAmount = player.materials.get(material) || 0;
          if (playerAmount < amount) {
            return { success: false, error: `Insufficient ${material}` };
          }
          cost.materials[material] = amount;
          contributionPoints += amount * 10;
        }
      }

      if (contributionPoints === 0) {
        return { success: false, error: "No valid contribution" };
      }

      player.gold -= cost.gold;
      for (const [material, amount] of Object.entries(cost.materials)) {
        const current = player.materials.get(material) || 0;
        player.materials.set(material, current - amount);
      }

      guild.guildBank.gold += cost.gold;
      for (const [material, amount] of Object.entries(cost.materials)) {
        const current = guild.guildBank.materials.get(material) || 0;
        guild.guildBank.materials.set(material, current + amount);
      }
      guild.guildBank.lastDonation = new Date();

      await guild.addContribution(playerId, contributionPoints, "daily");
      await guild.addExperience(Math.floor(contributionPoints / 10), "member_contribution");

      await player.save();
      await guild.save();

      return { success: true, contributionPoints };

    } catch (error) {
      console.error("❌ Error contributing to guild:", error);
      return { success: false, error: "Contribution failed" };
    }
  }

  static async updateMemberActivity(playerId: string): Promise<void> {
    try {
      const player = await Player.findById(playerId);
      if (!player || !player.guildId) return;

      const guild = await Guild.findById(player.guildId);
      if (guild) {
        await guild.updateMemberActivity(playerId);
      }

    } catch (error) {
      console.error("❌ Error updating member activity:", error);
    }
  }

  static async performDailyMaintenance(serverId: string): Promise<void> {
    try {
      const guilds = await Guild.findByServer(serverId);
      
      for (const guild of guilds) {
        await guild.resetDailyProgress();
        await guild.cleanupExpiredInvitations();
        
        const inactiveMembers = guild.members.filter((member: IGuildMember) => {
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
      const guilds = await Guild.findByServer(serverId);
      
      for (const guild of guilds) {
        await guild.resetWeeklyProgress();

        const expiredQuests = guild.currentQuests.filter((quest: IGuildQuest) => 
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
}

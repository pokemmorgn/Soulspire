import Guild, { IGuildDocument, IGuildMember } from "../../models/Guild";
import Player from "../../models/Player";

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

export class GuildMemberService {

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
        return { success: true, guild, member: member || undefined };
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

  static async getPlayerGuildInfo(playerId: string): Promise<{
    isInGuild: boolean;
    guild?: {
      guildId: string;
      name: string;
      tag: string;
      level: number;
      memberCount: number;
      maxMembers: number;
      role: string;
      contributionDaily: number;
      contributionWeekly: number;
      contributionTotal: number;
    };
    pendingInvitations?: Array<{
      guildId: string;
      guildName: string;
      guildTag: string;
      invitedBy: string;
      invitedAt: Date;
      expiresAt: Date;
    }>;
  }> {
    try {
      const player = await Player.findById(playerId);
      if (!player) {
        return { isInGuild: false };
      }

      if (!player.guildId) {
        const invitations = await Guild.find({
          "invitations.playerId": playerId,
          "invitations.status": "pending"
        }).select('name tag invitations');

        const pendingInvitations = invitations.flatMap(guild => 
          guild.invitations
            .filter((inv: any) => inv.playerId === playerId && inv.status === "pending")
            .map((inv: any) => ({
              guildId: guild._id,
              guildName: guild.name,
              guildTag: guild.tag,
              invitedBy: inv.invitedByName,
              invitedAt: inv.invitedAt,
              expiresAt: inv.expiresAt
            }))
        );

        return { isInGuild: false, pendingInvitations };
      }

      const guild = await Guild.findById(player.guildId);
      if (!guild) {
        player.guildId = undefined;
        await player.save();
        return { isInGuild: false };
      }

      const member = guild.getMember(playerId);
      if (!member) {
        player.guildId = undefined;
        await player.save();
        return { isInGuild: false };
      }

      return {
        isInGuild: true,
        guild: {
          guildId: guild._id,
          name: guild.name,
          tag: guild.tag,
          level: guild.level,
          memberCount: guild.memberCount,
          maxMembers: guild.maxMembers,
          role: member.role,
          contributionDaily: member.contributionDaily,
          contributionWeekly: member.contributionWeekly,
          contributionTotal: member.contributionTotal
        }
      };

    } catch (error) {
      console.error("❌ Error getting player guild info:", error);
      return { isInGuild: false };
    }
  }

  static async canPlayerJoinGuild(playerId: string, guildId: string): Promise<{
    canJoin: boolean;
    reason?: string;
    requirements?: {
      minimumLevel: number;
      minimumPower: number;
      playerLevel: number;
      playerPower: number;
    };
  }> {
    try {
      const player = await Player.findById(playerId);
      if (!player) {
        return { canJoin: false, reason: "Player not found" };
      }

      if (player.guildId) {
        return { canJoin: false, reason: "Player already in a guild" };
      }

      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { canJoin: false, reason: "Guild not found" };
      }

      if (guild.status !== "active") {
        return { canJoin: false, reason: "Guild is not active" };
      }

      const playerPower = player.calculatePowerScore();
      const requirements = {
        minimumLevel: guild.settings.minimumLevel,
        minimumPower: guild.settings.minimumPower,
        playerLevel: player.level,
        playerPower
      };

      if (guild.memberCount >= guild.maxMembers) {
        return { canJoin: false, reason: "Guild is full", requirements };
      }

      if (player.level < guild.settings.minimumLevel) {
        return { canJoin: false, reason: "Level requirement not met", requirements };
      }

      if (playerPower < guild.settings.minimumPower) {
        return { canJoin: false, reason: "Power requirement not met", requirements };
      }

      return { canJoin: true, requirements };

    } catch (error) {
      console.error("❌ Error checking if player can join guild:", error);
      return { canJoin: false, reason: "Error checking requirements" };
    }
  }
}

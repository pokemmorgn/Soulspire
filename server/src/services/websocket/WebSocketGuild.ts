// server/src/services/websocket/WebSocketGuild.ts
import { Server as SocketIOServer } from 'socket.io';
import { IGuildDocument, IGuildMember, IGuildQuest, IGuildRaid } from '../../models/Guild';

/**
 * SERVICE WEBSOCKET SPÉCIALISÉ GUILDES
 * Toutes les notifications temps réel liées au système de guildes
 */
export class WebSocketGuild {
  private static io: SocketIOServer | null = null;

  // ===== INITIALISATION =====

  /**
   * Initialiser avec l'instance Socket.IO principale
   */
  public static initialize(socketInstance: SocketIOServer): void {
    this.io = socketInstance;
    console.log('✅ WebSocketGuild initialized');
  }

  // ===== NOTIFICATIONS DE GESTION DE GUILDE =====

  /**
   * Notifier création de guilde
   */
  public static notifyGuildCreated(
    creatorId: string,
    serverId: string,
    guildData: {
      guildId: string;
      name: string;
      tag: string;
      level: number;
    }
  ): void {
    if (!this.io) {
      console.warn('⚠️ WebSocketGuild not initialized');
      return;
    }

    this.io.to(`player:${creatorId}`).emit('guild:created', {
      type: 'guild_created',
      data: guildData,
      timestamp: new Date(),
      animation: 'guild_creation_celebration',
      sound: 'guild_created_fanfare'
    });

    // Broadcast au serveur qu'une nouvelle guilde a été créée
    this.io.to(`server:${serverId}`).emit('guild:new_guild_on_server', {
      type: 'new_guild_on_server',
      data: {
        guildName: guildData.name,
        guildTag: guildData.tag,
        creatorName: `Player_${creatorId.slice(-4)}`
      },
      timestamp: new Date()
    });

    console.log(`🏛️ Guild creation notification sent to ${creatorId}: ${guildData.name} [${guildData.tag}]`);
  }

  /**
   * Notifier dissolution de guilde
   */
  public static notifyGuildDisbanded(
    guildMembers: IGuildMember[],
    guildData: {
      guildName: string;
      guildTag: string;
      reason: string;
      disbandedBy: string;
    }
  ): void {
    if (!this.io) return;

    guildMembers.forEach(member => {
      this.io!.to(`player:${member.playerId}`).emit('guild:disbanded', {
        type: 'guild_disbanded',
        data: guildData,
        timestamp: new Date(),
        animation: 'guild_dissolution',
        sound: 'guild_disbanded_somber'
      });
    });

    console.log(`💔 Guild disbanded notification sent to ${guildMembers.length} members: ${guildData.guildName}`);
  }

  // ===== NOTIFICATIONS DE MEMBRES =====

  /**
   * Notifier qu'un nouveau membre a rejoint
   */
  public static notifyMemberJoined(
    guildId: string,
    newMember: {
      playerId: string;
      playerName: string;
      playerLevel: number;
      playerPower: number;
      joinMethod: 'application' | 'invitation' | 'auto_accept';
    }
  ): void {
    if (!this.io) return;

    this.io.to(`guild:${guildId}`).emit('guild:member_joined', {
      type: 'member_joined',
      data: newMember,
      timestamp: new Date(),
      animation: 'member_welcome',
      sound: 'member_joined_chime'
    });

    // Notification personnelle au nouveau membre
    this.io.to(`player:${newMember.playerId}`).emit('guild:welcome', {
      type: 'guild_welcome',
      data: {
        message: 'Welcome to the guild!',
        joinMethod: newMember.joinMethod
      },
      timestamp: new Date(),
      animation: 'welcome_celebration'
    });

    console.log(`👋 Member joined notification sent to guild ${guildId}: ${newMember.playerName} (${newMember.joinMethod})`);
  }

  /**
   * Notifier qu'un membre a quitté/été exclu
   */
  public static notifyMemberLeft(
    guildId: string,
    memberData: {
      playerId: string;
      playerName: string;
      reason: 'left' | 'kicked' | 'inactive';
      kickedBy?: string;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`guild:${guildId}`).emit('guild:member_left', {
      type: 'member_left',
      data: memberData,
      timestamp: new Date(),
      animation: memberData.reason === 'kicked' ? 'member_kicked' : 'member_goodbye'
    });

    // Notification personnelle au membre qui part
    this.io.to(`player:${memberData.playerId}`).emit('guild:left_guild', {
      type: 'left_guild',
      data: {
        reason: memberData.reason,
        kickedBy: memberData.kickedBy
      },
      timestamp: new Date(),
      animation: memberData.reason === 'kicked' ? 'kicked_notification' : 'farewell'
    });

    console.log(`👋 Member left notification sent to guild ${guildId}: ${memberData.playerName} (${memberData.reason})`);
  }

  /**
   * Notifier promotion/rétrogradation de membre
   */
  public static notifyMemberRoleChanged(
    guildId: string,
    roleChangeData: {
      playerId: string;
      playerName: string;
      oldRole: string;
      newRole: string;
      changedBy: string;
      changedByName: string;
    }
  ): void {
    if (!this.io) return;

    const isPromotion = this.getRoleLevel(roleChangeData.newRole) > this.getRoleLevel(roleChangeData.oldRole);

    this.io.to(`guild:${guildId}`).emit('guild:member_role_changed', {
      type: 'member_role_changed',
      data: roleChangeData,
      timestamp: new Date(),
      animation: isPromotion ? 'promotion_celebration' : 'demotion_notice'
    });

    // Notification personnelle au membre concerné
    this.io.to(`player:${roleChangeData.playerId}`).emit('guild:role_changed', {
      type: 'role_changed',
      data: {
        oldRole: roleChangeData.oldRole,
        newRole: roleChangeData.newRole,
        changedBy: roleChangeData.changedByName,
        isPromotion
      },
      timestamp: new Date(),
      animation: isPromotion ? 'personal_promotion' : 'role_change',
      sound: isPromotion ? 'promotion_fanfare' : 'role_change_chime'
    });

    console.log(`🔄 Role change notification sent to guild ${guildId}: ${roleChangeData.playerName} ${roleChangeData.oldRole} → ${roleChangeData.newRole}`);
  }

  // ===== NOTIFICATIONS DE QUÊTES =====

  /**
   * Notifier nouvelle quête de guilde
   */
  public static notifyQuestStarted(
    guildId: string,
    questData: {
      questId: string;
      name: string;
      description: string;
      questType: string;
      targetValue: number;
      endDate: Date;
      rewards: any;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`guild:${guildId}`).emit('guild:quest_started', {
      type: 'quest_started',
      data: questData,
      timestamp: new Date(),
      animation: 'quest_announcement',
      sound: 'quest_started_horn',
      priority: 'high'
    });

    console.log(`📋 Quest started notification sent to guild ${guildId}: ${questData.name} (${questData.questType})`);
  }

  /**
   * Notifier progression de quête
   */
  public static notifyQuestProgress(
    guildId: string,
    progressData: {
      questId: string;
      questName: string;
      currentProgress: number;
      targetValue: number;
      progressPercentage: number;
      contributorName: string;
      contributionAmount: number;
      isCompleted: boolean;
    }
  ): void {
    if (!this.io) return;

    // Ne notifier que pour les jalons importants ou la complétion
    if (progressData.isCompleted || progressData.progressPercentage % 25 === 0) {
      this.io.to(`guild:${guildId}`).emit('guild:quest_progress', {
        type: 'quest_progress',
        data: progressData,
        timestamp: new Date(),
        animation: progressData.isCompleted ? 'quest_completed' : 'quest_milestone',
        sound: progressData.isCompleted ? 'quest_completed_fanfare' : 'milestone_chime'
      });

      console.log(`📈 Quest progress notification sent to guild ${guildId}: ${progressData.questName} ${progressData.progressPercentage}%${progressData.isCompleted ? ' COMPLETED' : ''}`);
    }
  }

  /**
   * Notifier contribution individuelle à une quête
   */
  public static notifyQuestContribution(
    playerId: string,
    contributionData: {
      questName: string;
      contribution: number;
      totalContribution: number;
      rank: number;
      personalRewards?: any;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('guild:quest_contribution', {
      type: 'quest_contribution',
      data: contributionData,
      timestamp: new Date(),
      animation: 'contribution_acknowledgment'
    });

    console.log(`📊 Quest contribution notification sent to ${playerId}: ${contributionData.contribution} to ${contributionData.questName} (rank #${contributionData.rank})`);
  }

  // ===== NOTIFICATIONS DE RAIDS =====

  /**
   * Notifier nouveau raid de guilde
   */
  public static notifyRaidStarted(
    guildId: string,
    raidData: {
      raidId: string;
      name: string;
      description: string;
      raidType: string;
      difficultyLevel: number;
      maxParticipants: number;
      duration: number;
      rewards: any;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`guild:${guildId}`).emit('guild:raid_started', {
      type: 'raid_started',
      data: raidData,
      timestamp: new Date(),
      animation: 'raid_announcement',
      sound: 'raid_started_war_horn',
      priority: 'high'
    });

    console.log(`⚔️ Raid started notification sent to guild ${guildId}: ${raidData.name} (${raidData.raidType}, difficulty ${raidData.difficultyLevel})`);
  }

  /**
   * Notifier participation au raid
   */
  public static notifyRaidParticipantJoined(
    guildId: string,
    participantData: {
      raidId: string;
      raidName: string;
      playerName: string;
      currentParticipants: number;
      maxParticipants: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`guild:${guildId}`).emit('guild:raid_participant_joined', {
      type: 'raid_participant_joined',
      data: participantData,
      timestamp: new Date(),
      animation: 'warrior_joined'
    });

    console.log(`⚔️ Raid participant notification sent to guild ${guildId}: ${participantData.playerName} joined ${participantData.raidName} (${participantData.currentParticipants}/${participantData.maxParticipants})`);
  }

  /**
   * Notifier progression du raid en temps réel
   */
  public static notifyRaidProgress(
    guildId: string,
    progressData: {
      raidId: string;
      raidName: string;
      bossHealthPercentage: number;
      totalDamage: number;
      recentAttacker: string;
      recentDamage: number;
      isCriticalPhase: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`guild:${guildId}`).emit('guild:raid_progress', {
      type: 'raid_progress',
      data: progressData,
      timestamp: new Date(),
      animation: progressData.isCriticalPhase ? 'boss_critical' : 'boss_damage'
    });

    // Log seulement pour les phases critiques ou gros dégâts
    if (progressData.isCriticalPhase || progressData.recentDamage > 10000) {
      console.log(`💥 Raid progress notification sent to guild ${guildId}: ${progressData.recentAttacker} dealt ${progressData.recentDamage} damage to ${progressData.raidName} (${progressData.bossHealthPercentage}% HP left)`);
    }
  }

  /**
   * Notifier complétion du raid
   */
  public static notifyRaidCompleted(
    guildId: string,
    completionData: {
      raidId: string;
      raidName: string;
      duration: number;
      participantCount: number;
      mvpPlayer: string;
      mvpDamage: number;
      totalRewards: any;
      isServerFirst?: boolean;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`guild:${guildId}`).emit('guild:raid_completed', {
      type: 'raid_completed',
      data: completionData,
      timestamp: new Date(),
      animation: completionData.isServerFirst ? 'server_first_victory' : 'raid_victory',
      sound: 'raid_victory_fanfare',
      priority: 'high'
    });

    console.log(`🏆 Raid completed notification sent to guild ${guildId}: ${completionData.raidName} in ${Math.floor(completionData.duration / 60000)}min, MVP: ${completionData.mvpPlayer}`);
  }

  // ===== NOTIFICATIONS DE PROGRESSION =====

  /**
   * Notifier montée de niveau de guilde
   */
  public static notifyGuildLevelUp(
    guildId: string,
    levelUpData: {
      oldLevel: number;
      newLevel: number;
      guildName: string;
      unlockedFeatures: string[];
      newMaxMembers: number;
      celebrationRewards: any;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`guild:${guildId}`).emit('guild:level_up', {
      type: 'guild_level_up',
      data: levelUpData,
      timestamp: new Date(),
      animation: 'guild_level_celebration',
      sound: 'guild_level_fanfare',
      priority: 'high'
    });

    console.log(`🆙 Guild level up notification sent to guild ${guildId}: ${levelUpData.guildName} reached level ${levelUpData.newLevel} (unlocked: ${levelUpData.unlockedFeatures.join(', ')})`);
  }

  /**
   * Notifier nouveau record de puissance
   */
  public static notifyPowerRecord(
    guildId: string,
    serverId: string,
    recordData: {
      guildName: string;
      guildTag: string;
      newTotalPower: number;
      oldRecord: number;
      serverRank: number;
      powerIncrease: number;
    }
  ): void {
    if (!this.io) return;

    // Notification à la guilde
    this.io.to(`guild:${guildId}`).emit('guild:power_record', {
      type: 'power_record',
      data: recordData,
      timestamp: new Date(),
      animation: 'power_milestone',
      sound: 'power_record_chime'
    });

    // Si c'est un record serveur significatif, annoncer au serveur
    if (recordData.serverRank <= 5) {
      this.io.to(`server:${serverId}`).emit('guild:server_power_record', {
        type: 'server_power_record',
        data: {
          guildName: recordData.guildName,
          guildTag: recordData.guildTag,
          newTotalPower: recordData.newTotalPower,
          serverRank: recordData.serverRank
        },
        timestamp: new Date()
      });
    }

    console.log(`💪 Power record notification sent to guild ${guildId}: ${recordData.guildName} reached ${recordData.newTotalPower} power (rank #${recordData.serverRank})`);
  }

  // ===== NOTIFICATIONS DE RÉCOMPENSES =====

  /**
   * Notifier distribution de récompenses quotidiennes
   */
  public static notifyDailyRewards(
    guildId: string,
    rewardsData: {
      rewardType: 'daily' | 'weekly' | 'seasonal';
      totalEligibleMembers: number;
      claimedBy: number;
      rewards: any;
      bonusMultiplier?: number;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`guild:${guildId}`).emit('guild:daily_rewards', {
      type: 'daily_rewards_available',
      data: rewardsData,
      timestamp: new Date(),
      animation: 'rewards_available',
      priority: 'medium'
    });

    console.log(`🎁 Daily rewards notification sent to guild ${guildId}: ${rewardsData.rewardType} rewards for ${rewardsData.totalEligibleMembers} members`);
  }

  /**
   * Notifier récompense personnelle réclamée
   */
  public static notifyPersonalRewardClaimed(
    playerId: string,
    rewardData: {
      rewardType: string;
      guildName: string;
      rewards: any;
      bonusMultiplier: number;
      nextRewardAvailable?: Date;
    }
  ): void {
    if (!this.io) return;

    this.io.to(`player:${playerId}`).emit('guild:personal_reward_claimed', {
      type: 'personal_reward_claimed',
      data: rewardData,
      timestamp: new Date(),
      animation: rewardData.bonusMultiplier > 1 ? 'bonus_reward_celebration' : 'reward_claimed'
    });

    console.log(`💰 Personal guild reward claimed by ${playerId}: ${rewardData.rewardType} from ${rewardData.guildName} (x${rewardData.bonusMultiplier})`);
  }

  // ===== NOTIFICATIONS D'ÉVÉNEMENTS SPÉCIAUX =====

  /**
   * Notifier événement de guilde spécial
   */
  public static notifyGuildEvent(
    serverId: string,
    eventData: {
      eventType: 'guild_war' | 'double_exp' | 'bonus_contributions' | 'special_raid';
      eventName: string;
      description: string;
      duration: number;
      affectedGuilds?: string[];
      bonusMultiplier?: number;
      specialRewards?: any;
    }
  ): void {
    if (!this.io) return;

    const targetRoom = eventData.affectedGuilds ? 
      eventData.affectedGuilds.map(guildId => `guild:${guildId}`) : 
      [`server:${serverId}`];

    targetRoom.forEach(room => {
      this.io!.to(room).emit('guild:special_event', {
        type: 'guild_special_event',
        data: eventData,
        timestamp: new Date(),
        animation: 'guild_event_celebration',
        sound: 'event_fanfare',
        priority: 'high'
      });
    });

    console.log(`🎉 Guild event notification sent to ${serverId}: ${eventData.eventName} for ${eventData.duration}h`);
  }

  // ===== MÉTHODES UTILITAIRES PRIVÉES =====

  /**
   * Obtenir le niveau hiérarchique d'un rôle
   */
  private static getRoleLevel(role: string): number {
    const roleLevels = { 'member': 1, 'officer': 2, 'leader': 3 };
    return roleLevels[role as keyof typeof roleLevels] || 0;
  }

  // ===== MÉTHODES UTILITAIRES PUBLIQUES =====

  /**
   * Vérifier si le service est disponible
   */
  public static isAvailable(): boolean {
    return this.io !== null;
  }

  /**
   * Faire rejoindre un joueur à la room de sa guilde
   */
  public static joinGuildRoom(playerId: string, guildId: string): void {
    if (!this.io) return;

    // Trouver le socket du joueur
    const playerSockets = Array.from(this.io.sockets.sockets.values())
      .filter(socket => (socket as any).playerId === playerId);

    playerSockets.forEach(socket => {
      socket.join(`guild:${guildId}`);
    });

    console.log(`🏛️ Player ${playerId} joined guild room ${guildId}`);
  }

  /**
   * Faire quitter un joueur de la room de sa guilde
   */
  public static leaveGuildRoom(playerId: string, guildId: string): void {
    if (!this.io) return;

    const playerSockets = Array.from(this.io.sockets.sockets.values())
      .filter(socket => (socket as any).playerId === playerId);

    playerSockets.forEach(socket => {
      socket.leave(`guild:${guildId}`);
    });

    console.log(`🚪 Player ${playerId} left guild room ${guildId}`);
  }

  /**
   * Obtenir les statistiques des rooms de guildes
   */
  public static getGuildRoomStats(guildId: string): { membersConnected: number; totalMembers: number } {
    if (!this.io) return { membersConnected: 0, totalMembers: 0 };

    try {
      const guildRoom = this.io.sockets.adapter.rooms.get(`guild:${guildId}`);
      return {
        membersConnected: guildRoom ? guildRoom.size : 0,
        totalMembers: 0 // Sera rempli par la logique métier
      };
    } catch (error) {
      console.error('❌ Erreur getGuildRoomStats:', error);
      return { membersConnected: 0, totalMembers: 0 };
    }
  }

  /**
   * Broadcast message personnalisé à une guilde
   */
  public static broadcastToGuild(
    guildId: string,
    event: string,
    data: any,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): void {
    if (!this.io) return;

    this.io.to(`guild:${guildId}`).emit(event, {
      data,
      timestamp: new Date(),
      priority
    });

    console.log(`📢 Guild broadcast sent to ${guildId}: ${event}`);
  }

  /**
   * Statistiques globales du système guild WebSocket
   */
  public static getGlobalGuildStats(): {
    totalGuildRooms: number;
    totalPlayersInGuilds: number;
    averagePlayersPerGuild: number;
  } {
    if (!this.io) return { totalGuildRooms: 0, totalPlayersInGuilds: 0, averagePlayersPerGuild: 0 };

    try {
      const guildRooms = Array.from(this.io.sockets.adapter.rooms.keys())
        .filter(room => room.startsWith('guild:'));
      
      const totalPlayersInGuilds = guildRooms.reduce((sum, room) => {
        const roomSize = this.io!.sockets.adapter.rooms.get(room)?.size || 0;
        return sum + roomSize;
      }, 0);

      return {
        totalGuildRooms: guildRooms.length,
        totalPlayersInGuilds,
        averagePlayersPerGuild: guildRooms.length > 0 ? Math.round(totalPlayersInGuilds / guildRooms.length) : 0
      };
    } catch (error) {
      console.error('❌ Erreur getGlobalGuildStats:', error);
      return { totalGuildRooms: 0, totalPlayersInGuilds: 0, averagePlayersPerGuild: 0 };
    }
  }
}

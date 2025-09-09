import Guild, { IGuildDocument, IGuildQuest, IGuildRaid } from "../../models/Guild";
import Player from "../../models/Player";
import { IdGenerator } from "../../utils/idGenerator";

export interface GuildQuestProgress {
  questId: string;
  questType: string;
  name: string;
  description: string;
  currentProgress: number;
  targetValue: number;
  progressPercentage: number;
  isCompleted: boolean;
  timeRemaining?: number;
  topContributors: Array<{
    playerId: string;
    playerName: string;
    contribution: number;
  }>;
}

export interface GuildRaidStatus {
  raidId: string;
  raidType: string;
  name: string;
  status: string;
  currentParticipants: number;
  maxParticipants: number;
  bossHealth: {
    current: number;
    max: number;
    percentage: number;
  };
  timeRemaining?: number;
  topDamageDealer?: {
    playerId: string;
    playerName: string;
    damage: number;
  };
}

export class GuildActivityService {

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
        const currentGuildMaterial = (guild.guildBank.materials as any).get(material) || 0;
        (guild.guildBank.materials as any).set(material, currentGuildMaterial + amount);
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

  static async startGuildQuest(guildId: string, questType: "daily" | "weekly" | "special", questTemplate: string): Promise<{ success: boolean; error?: string; quest?: IGuildQuest }> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      const questTemplates = {
        daily_contribution: {
          name: "Daily Contributions",
          description: "Contribute 50,000 gold to the guild bank",
          targetValue: 50000,
          rewards: {
            guildExp: 1000,
            guildCoins: 500,
            memberRewards: { gold: 2000, gems: 50 }
          }
        },
        weekly_power: {
          name: "Power Growth",
          description: "Increase total guild power by 100,000",
          targetValue: 100000,
          rewards: {
            guildExp: 5000,
            guildCoins: 2000,
            memberRewards: { gold: 10000, gems: 200 }
          }
        },
        daily_battles: {
          name: "Guild Battles",
          description: "Complete 100 battles as a guild",
          targetValue: 100,
          rewards: {
            guildExp: 800,
            guildCoins: 400,
            memberRewards: { gold: 1500, gems: 30 }
          }
        },
        weekly_heroes: {
          name: "Hero Collection",
          description: "Summon 50 new heroes across the guild",
          targetValue: 50,
          rewards: {
            guildExp: 3000,
            guildCoins: 1500,
            memberRewards: { gold: 8000, gems: 150 }
          }
        }
      };

      const template = questTemplates[questTemplate as keyof typeof questTemplates];
      if (!template) {
        return { success: false, error: "Invalid quest template" };
      }

      const endDate = questType === "daily" ? 
        new Date(Date.now() + 24 * 60 * 60 * 1000) :
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const questData = {
        questType,
        name: template.name,
        description: template.description,
        targetValue: template.targetValue,
        rewards: template.rewards,
        startDate: new Date(),
        endDate
      };

      await guild.startQuest(questData);
      
      const quest = guild.currentQuests[guild.currentQuests.length - 1];
      return { success: true, quest };

    } catch (error) {
      console.error("❌ Error starting guild quest:", error);
      return { success: false, error: "Failed to start quest" };
    }
  }

  static async updateGuildQuestProgress(guildId: string, questId: string, playerId: string, progress: number): Promise<{ success: boolean; error?: string; questCompleted?: boolean }> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      const questBefore = guild.currentQuests.find((q: IGuildQuest) => q.questId === questId);
      if (!questBefore) {
        return { success: false, error: "Quest not found" };
      }

      const wasCompleted = questBefore.isCompleted;
      await guild.updateQuestProgress(questId, playerId, progress);
      
      const questAfter = guild.currentQuests.find((q: IGuildQuest) => q.questId === questId);
      const questCompleted = questAfter ? questAfter.isCompleted && !wasCompleted : false;

      return { success: true, questCompleted };

    } catch (error) {
      console.error("❌ Error updating quest progress:", error);
      return { success: false, error: "Failed to update progress" };
    }
  }

  static async getGuildQuestProgress(guildId: string): Promise<GuildQuestProgress[]> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return [];
      }

      return guild.currentQuests.map((quest: IGuildQuest) => ({
        questId: quest.questId,
        questType: quest.questType,
        name: quest.name,
        description: quest.description,
        currentProgress: quest.currentProgress,
        targetValue: quest.targetValue,
        progressPercentage: Math.min(100, (quest.currentProgress / quest.targetValue) * 100),
        isCompleted: quest.isCompleted,
        timeRemaining: quest.isCompleted ? undefined : Math.max(0, quest.endDate.getTime() - Date.now()),
        topContributors: quest.contributors
          .sort((a, b) => b.contribution - a.contribution)
          .slice(0, 5)
      }));

    } catch (error) {
      console.error("❌ Error getting quest progress:", error);
      return [];
    }
  }

  static async startGuildRaid(guildId: string, raidType: "guild_boss" | "territory_war", templateId: string, difficulty: number = 1): Promise<{ success: boolean; error?: string; raid?: IGuildRaid }> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      if (guild.level < 5) {
        return { success: false, error: "Guild level 5 required for raids" };
      }

      const { getRaidTemplate } = await import("./templates/GuildRaidTemplates");
      const baseTemplate = getRaidTemplate(raidType, templateId);
      if (!baseTemplate) {
        return { success: false, error: "Invalid raid template" };
      }

      const { calculateRaidRewards } = await import("./templates/GuildRaidTemplates");
      const template = calculateRaidRewards(baseTemplate, difficulty);

      const raidData = {
        raidType,
        name: template.name,
        description: template.description,
        difficultyLevel: difficulty,
        maxParticipants: template.maxParticipants,
        startTime: new Date(),
        endTime: new Date(Date.now() + template.duration * 60 * 60 * 1000),
        bossHealth: { current: template.baseBossHealth, max: template.baseBossHealth },
        rewards: template.baseRewards
      };

      await guild.startRaid(raidData);
      return { success: true, raid: guild.currentRaid };

    } catch (error) {
      console.error("❌ Error starting guild raid:", error);
      return { success: false, error: "Failed to start raid" };
    }
  }

  static async joinGuildRaid(guildId: string, raidId: string, playerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      const player = await Player.findById(playerId);
      if (!player) {
        return { success: false, error: "Player not found" };
      }

      if (!guild.getMember(playerId)) {
        return { success: false, error: "Player not in guild" };
      }

      await guild.joinRaid(raidId, playerId, player.displayName);
      return { success: true };

    } catch (error) {
      console.error("❌ Error joining guild raid:", error);
      return { success: false, error: "Failed to join raid" };
    }
  }

  static async attackRaidBoss(guildId: string, raidId: string, playerId: string, damage: number): Promise<{ success: boolean; error?: string; raidCompleted?: boolean }> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild || !guild.currentRaid || guild.currentRaid.raidId !== raidId) {
        return { success: false, error: "Raid not found" };
      }

      if (guild.currentRaid.status !== "active") {
        return { success: false, error: "Raid is not active" };
      }

      const participant = guild.currentRaid.participants.find((p: any) => p.playerId === playerId);
      if (!participant) {
        return { success: false, error: "Player not participating in raid" };
      }

      const healthBefore = guild.currentRaid.bossHealth.current;
      await guild.updateRaidProgress(raidId, playerId, damage);
      const raidCompleted = guild.currentRaid.bossHealth.current <= 0 && healthBefore > 0;

      if (raidCompleted) {
        await this.distributeRaidRewards(guild);
      }

      return { success: true, raidCompleted };

    } catch (error) {
      console.error("❌ Error attacking raid boss:", error);
      return { success: false, error: "Attack failed" };
    }
  }

  static async getRaidStatus(guildId: string): Promise<GuildRaidStatus | null> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild || !guild.currentRaid) {
        return null;
      }

      const raid = guild.currentRaid;
      const topDamageDealer = raid.participants
        .sort((a: any, b: any) => b.damageDealt - a.damageDealt)[0];

      return {
        raidId: raid.raidId,
        raidType: raid.raidType,
        name: raid.name,
        status: raid.status,
        currentParticipants: raid.currentParticipants,
        maxParticipants: raid.maxParticipants,
        bossHealth: {
          current: raid.bossHealth.current,
          max: raid.bossHealth.max,
          percentage: (raid.bossHealth.current / raid.bossHealth.max) * 100
        },
        timeRemaining: Math.max(0, raid.endTime.getTime() - Date.now()),
        topDamageDealer: topDamageDealer ? {
          playerId: topDamageDealer.playerId,
          playerName: topDamageDealer.playerName,
          damage: topDamageDealer.damageDealt
        } : undefined
      };

    } catch (error) {
      console.error("❌ Error getting raid status:", error);
      return null;
    }
  }

  private static async distributeRaidRewards(guild: IGuildDocument): Promise<void> {
    try {
      if (!guild.currentRaid) return;

      const participants = guild.currentRaid.participants.sort((a: any, b: any) => b.damageDealt - a.damageDealt);
      
      for (let i = 0; i < participants.length; i++) {
        const participant = participants[i];
        const player = await Player.findById(participant.playerId);
        if (!player) continue;

        let rewardTier: "mvp" | "top_10" | "participant" = "participant";
        
        if (i === 0) {
          rewardTier = "mvp";
        } else if (i < 10) {
          rewardTier = "top_10";
        }

        const tierReward = guild.currentRaid.rewards.memberRewards.find(r => r.tier === rewardTier);
        if (tierReward) {
          player.gold += tierReward.rewards.gold;
          player.gems += tierReward.rewards.gems;
          
      for (const [material, amount] of Object.entries(tierReward.rewards.materials)) {
            const current = player.materials.get(material) || 0;
            player.materials.set(material, current + amount);
          }
          
          await player.save();
        }
      }

      guild.guildCoins += guild.currentRaid.rewards.guildCoins;
      await guild.addExperience(guild.currentRaid.rewards.guildExp, "raid_completion");
      await guild.completeRaid(guild.currentRaid.raidId);

    } catch (error) {
      console.error("❌ Error distributing raid rewards:", error);
    }
  }

  static async claimDailyRewards(guildId: string, playerId: string): Promise<{ success: boolean; error?: string; rewards?: any }> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      if (!guild.getMember(playerId)) {
        return { success: false, error: "Player not in guild" };
      }

      const today = new Date().toDateString();
      const lastClaim = guild.rewards.dailyRewards.lastClaimTime.toDateString();
      
      if (today === lastClaim && guild.rewards.dailyRewards.claimedBy.includes(playerId)) {
        return { success: false, error: "Already claimed today" };
      }

      const player = await Player.findById(playerId);
      if (!player) {
        return { success: false, error: "Player not found" };
      }

      const rewards = guild.rewards.dailyRewards.rewards;
      const vipMultiplier = 1 + (player.vipLevel * 0.1);
      
      const finalRewards = {
        gold: Math.floor(rewards.gold * vipMultiplier),
        gems: Math.floor(rewards.gems * vipMultiplier),
        guildCoins: rewards.guildCoins
      };

      player.gold += finalRewards.gold;
      player.gems += finalRewards.gems;
      await player.save();

      if (today !== lastClaim) {
        guild.rewards.dailyRewards.claimedBy = [playerId];
        guild.rewards.dailyRewards.lastClaimTime = new Date();
      } else {
        guild.rewards.dailyRewards.claimedBy.push(playerId);
      }
      
      await guild.save();

      return { success: true, rewards: finalRewards };

    } catch (error) {
      console.error("❌ Error claiming daily rewards:", error);
      return { success: false, error: "Failed to claim rewards" };
    }
  }

  static async claimWeeklyRewards(guildId: string, playerId: string): Promise<{ success: boolean; error?: string; rewards?: any }> {
    try {
      const guild = await Guild.findById(guildId);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      const member = guild.getMember(playerId);
      if (!member) {
        return { success: false, error: "Player not in guild" };
      }

      const thisWeek = this.getWeekNumber(new Date());
      const lastClaimWeek = this.getWeekNumber(guild.rewards.weeklyRewards.lastClaimTime);
      
      if (thisWeek === lastClaimWeek && guild.rewards.weeklyRewards.claimedBy.includes(playerId)) {
        return { success: false, error: "Already claimed this week" };
      }

      if (member.contributionWeekly < 1000) {
        return { success: false, error: "Minimum 1000 weekly contribution required" };
      }

      const player = await Player.findById(playerId);
      if (!player) {
        return { success: false, error: "Player not found" };
      }

      const baseRewards = guild.rewards.weeklyRewards.rewards;
      const contributionBonus = Math.floor(member.contributionWeekly / 1000);
      
      const finalRewards = {
        gold: baseRewards.gold + (contributionBonus * 1000),
        gems: baseRewards.gems + (contributionBonus * 10),
        guildCoins: baseRewards.guildCoins + (contributionBonus * 50)
      };

      player.gold += finalRewards.gold;
      player.gems += finalRewards.gems;
      
      for (const [material, amount] of Object.entries(baseRewards.materials)) {
        const current = player.materials.get(material) || 0;
        player.materials.set(material, current + amount);
      }
      
      await player.save();

      if (thisWeek !== lastClaimWeek) {
        guild.rewards.weeklyRewards.claimedBy = [playerId];
        guild.rewards.weeklyRewards.lastClaimTime = new Date();
      } else {
        guild.rewards.weeklyRewards.claimedBy.push(playerId);
      }
      
      await guild.save();

      return { success: true, rewards: finalRewards };

    } catch (error) {
      console.error("❌ Error claiming weekly rewards:", error);
      return { success: false, error: "Failed to claim rewards" };
    }
  }

  private static getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}

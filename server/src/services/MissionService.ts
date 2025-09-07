import { MissionTemplate, PlayerMissions } from "../models/Missions";
import Player from "../models/Player";
import { IMissionReward, IPlayerMissionProgress } from "../models/Missions";

export class MissionService {

  public static async initializePlayerMissions(accountId: string, serverId: string) {
    try {
      console.log(`🎯 Initialisation missions pour ${accountId} sur serveur ${serverId}`);

      let playerMissions = await PlayerMissions.findOne({ playerId: accountId, serverId });
      if (playerMissions) {
        return {
          success: true,
          message: "Player missions already initialized",
          existing: true
        };
      }

      const player = await Player.findOne({ accountId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      playerMissions = new PlayerMissions({
        playerId: accountId,
        serverId,
        dailyMissions: [],
        weeklyMissions: [],
        achievements: [],
        stats: {
          totalDailyCompleted: 0,
          totalWeeklyCompleted: 0,
          totalAchievementsCompleted: 0,
          currentDailyStreak: 0,
          longestDailyStreak: 0,
          lastDailyReset: new Date(),
          lastWeeklyReset: new Date()
        },
        timezone: "UTC",
        isActive: true
      });

      playerMissions.calculateNextResets();
      await this.generateInitialMissions(playerMissions, player.level);

      console.log(`✅ Missions initialisées pour ${player.displayName}`);

      return {
        success: true,
        message: "Player missions initialized successfully",
        existing: false,
        dailyCount: playerMissions.dailyMissions.length,
        weeklyCount: playerMissions.weeklyMissions.length,
        achievementCount: playerMissions.achievements.length
      };

    } catch (error: any) {
      console.error("❌ Erreur initializePlayerMissions:", error);
      throw error;
    }
  }

  public static async getPlayerMissions(accountId: string, serverId: string) {
    try {
      let playerMissions = await PlayerMissions.findOne({ playerId: accountId, serverId });

      if (!playerMissions) {
        const initResult = await this.initializePlayerMissions(accountId, serverId);
        playerMissions = await PlayerMissions.findOne({ playerId: accountId, serverId });
      }

      if (!playerMissions) {
        throw new Error("Failed to initialize player missions");
      }

      await this.checkAndApplyResets(playerMissions);

      const currentTime = Date.now();
      const dailyTimeRemaining = Math.max(0, playerMissions.nextDailyReset.getTime() - currentTime);
      const weeklyTimeRemaining = Math.max(0, playerMissions.nextWeeklyReset.getTime() - currentTime);

      const totalDailyMissions = playerMissions.dailyMissions.length;
      const completedDailyMissions = playerMissions.dailyMissions.filter(m => m.isCompleted).length;
      const totalWeeklyMissions = playerMissions.weeklyMissions.length;
      const completedWeeklyMissions = playerMissions.weeklyMissions.filter(m => m.isCompleted).length;

      return {
        success: true,
        missions: {
          daily: playerMissions.dailyMissions.sort((a, b) => b.priority - a.priority),
          weekly: playerMissions.weeklyMissions.sort((a, b) => b.priority - a.priority),
          achievements: playerMissions.achievements.filter(a => !a.isCompleted).slice(0, 10)
        },
        stats: playerMissions.stats,
        progress: {
          dailyProgress: totalDailyMissions > 0 ? (completedDailyMissions / totalDailyMissions) * 100 : 0,
          weeklyProgress: totalWeeklyMissions > 0 ? (completedWeeklyMissions / totalWeeklyMissions) * 100 : 0,
          dailyCompleted: completedDailyMissions,
          dailyTotal: totalDailyMissions,
          weeklyCompleted: completedWeeklyMissions,
          weeklyTotal: totalWeeklyMissions
        },
        timeRemaining: {
          dailyReset: Math.floor(dailyTimeRemaining / 1000),
          weeklyReset: Math.floor(weeklyTimeRemaining / 1000),
          dailyResetFormatted: this.formatTimeRemaining(dailyTimeRemaining),
          weeklyResetFormatted: this.formatTimeRemaining(weeklyTimeRemaining)
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerMissions:", error);
      throw error;
    }
  }

  public static async updateProgress(
    accountId: string,
    serverId: string,
    conditionType: "battle_wins" | "tower_floors" | "gacha_pulls" | "login" | "gold_spent" | "level_reached" | "heroes_owned",
    value: number,
    additionalData?: any
  ) {
    try {
      console.log(`📈 Mise à jour progression missions ${accountId}: ${conditionType} +${value}`);

      const playerMissions = await PlayerMissions.findOne({ playerId: accountId, serverId });
      if (!playerMissions || !playerMissions.isActive) {
        return {
          success: false,
          message: "Player missions not found or inactive",
          completedMissions: []
        };
      }

      const completedMissions: string[] = [];
      const allTemplates = await MissionTemplate.find({ isActive: true });
      const templateMap = new Map();
      allTemplates.forEach(template => {
        templateMap.set(template.missionId, template);
      });

      const missionTypes = [
        { key: 'dailyMissions', missions: playerMissions.dailyMissions },
        { key: 'weeklyMissions', missions: playerMissions.weeklyMissions },
        { key: 'achievements', missions: playerMissions.achievements }
      ];

      let updated = false;

      for (const missionType of missionTypes) {
        for (const mission of missionType.missions) {
          if (mission.isCompleted) continue;

          const template = templateMap.get(mission.templateId);
          if (!template) continue;

          if (this.missionMatchesCondition(template, conditionType, additionalData)) {
            mission.currentValue += value;
            updated = true;

            if (mission.currentValue >= mission.targetValue) {
              mission.isCompleted = true;
              mission.completedAt = new Date();
              completedMissions.push(mission.missionId);

              if (missionType.key === 'dailyMissions') {
                playerMissions.stats.totalDailyCompleted += 1;
              } else if (missionType.key === 'weeklyMissions') {
                playerMissions.stats.totalWeeklyCompleted += 1;
              } else if (missionType.key === 'achievements') {
                playerMissions.stats.totalAchievementsCompleted += 1;
              }

              console.log(`🎯 Mission complétée: ${mission.name}`);
            }
          }
        }
      }

      if (updated) {
        await playerMissions.save();
      }

      if (completedMissions.some(id => playerMissions.dailyMissions.some(m => m.missionId === id))) {
        const allDailyCompleted = playerMissions.dailyMissions.every(m => m.isCompleted);
        if (allDailyCompleted) {
          playerMissions.stats.currentDailyStreak += 1;
          if (playerMissions.stats.currentDailyStreak > playerMissions.stats.longestDailyStreak) {
            playerMissions.stats.longestDailyStreak = playerMissions.stats.currentDailyStreak;
          }
          await playerMissions.save();
          console.log(`🔥 Streak quotidien: ${playerMissions.stats.currentDailyStreak} jours !`);
        }
      }

      if (completedMissions.length > 0) {
        console.log(`✅ ${completedMissions.length} missions complétées pour ${accountId}`);
      }

      return {
        success: true,
        completedMissions,
        message: completedMissions.length > 0 ? 
          `Completed ${completedMissions.length} mission${completedMissions.length > 1 ? 's' : ''}!` : 
          "Progress updated"
      };

    } catch (error: any) {
      console.error("❌ Erreur updateProgress:", error);
      return {
        success: false,
        error: error.message,
        completedMissions: []
      };
    }
  }

  public static async claimMissionRewards(
    accountId: string,
    serverId: string,
    missionId: string
  ) {
    try {
      console.log(`🎁 ${accountId} réclame récompenses mission ${missionId}`);

      const [playerMissions, player] = await Promise.all([
        PlayerMissions.findOne({ playerId: accountId, serverId }),
        Player.findOne({ accountId, serverId })
      ]);

      if (!playerMissions) {
        throw new Error("Player missions not found");
      }

      if (!player) {
        throw new Error("Player not found");
      }

      const claimResult = await playerMissions.claimRewards(missionId);

      if (!claimResult.success) {
        return {
          success: false,
          message: "Cannot claim rewards for this mission",
          reason: "Mission not completed or rewards already claimed"
        };
      }

      const appliedRewards = [];

      for (const reward of claimResult.rewards) {
        await this.applyRewardToPlayer(player, reward);
        appliedRewards.push({
          type: reward.type,
          quantity: reward.quantity,
          currencyType: reward.currencyType,
          description: this.getRewardDescription(reward)
        });
      }

      await player.save();

      console.log(`✅ ${appliedRewards.length} récompenses appliquées à ${player.displayName}`);

      return {
        success: true,
        message: "Mission rewards claimed successfully",
        rewards: appliedRewards,
        missionId
      };

    } catch (error: any) {
      console.error("❌ Erreur claimMissionRewards:", error);
      throw error;
    }
  }

  public static async claimAllAvailableRewards(accountId: string, serverId: string) {
    try {
      console.log(`🎁 ${accountId} réclame toutes les récompenses disponibles`);

      const playerMissions = await PlayerMissions.findOne({ playerId: accountId, serverId });
      if (!playerMissions) {
        throw new Error("Player missions not found");
      }

      const claimableRewards: any[] = [];
      const allMissions = [
        ...playerMissions.dailyMissions,
        ...playerMissions.weeklyMissions,
        ...playerMissions.achievements
      ];

      for (const mission of allMissions) {
        if (mission.isCompleted && !mission.isRewardClaimed) {
          const claimResult = await this.claimMissionRewards(accountId, serverId, mission.missionId);
          if (claimResult.success) {
            claimableRewards.push({
              missionId: mission.missionId,
              missionName: mission.name,
              rewards: claimResult.rewards
            });
          }
        }
      }

      return {
        success: true,
        message: `Claimed rewards from ${claimableRewards.length} missions`,
        claimedMissions: claimableRewards.length,
        details: claimableRewards
      };

    } catch (error: any) {
      console.error("❌ Erreur claimAllAvailableRewards:", error);
      throw error;
    }
  }

  public static async forceResetMissions(
    accountId: string,
    serverId: string,
    resetType: "daily" | "weekly" | "both"
  ) {
    try {
      console.log(`🔄 Force reset ${resetType} missions pour ${accountId}`);

      const playerMissions = await PlayerMissions.findOne({ playerId: accountId, serverId });
      if (!playerMissions) {
        throw new Error("Player missions not found");
      }

      const player = await Player.findOne({ accountId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      if (resetType === "daily" || resetType === "both") {
        await this.resetDailyMissions(playerMissions, player.level);
      }

      if (resetType === "weekly" || resetType === "both") {
        await this.resetWeeklyMissions(playerMissions, player.level);
      }

      return {
        success: true,
        message: `${resetType} missions reset successfully`,
        resetType
      };

    } catch (error: any) {
      console.error("❌ Erreur forceResetMissions:", error);
      throw error;
    }
  }

  private static missionMatchesCondition(
    template: any,
    conditionType: string,
    additionalData?: any
  ): boolean {
    
    if (template.condition.type !== conditionType) {
      return false;
    }

    switch (conditionType) {
      case "battle_wins":
        if (template.condition.battleConditions) {
          const { battleType, difficulty, winRequired, minWorld } = template.condition.battleConditions;
          
          if (battleType && additionalData?.battleType !== battleType) {
            return false;
          }
          
          if (difficulty && additionalData?.difficulty !== difficulty) {
            return false;
          }
          
          if (winRequired && !additionalData?.victory) {
            return false;
          }
          
          if (minWorld && (!additionalData?.world || additionalData.world < minWorld)) {
            return false;
          }
        }
        break;
        
      case "heroes_owned":
        if (template.condition.heroConditions) {
          const { rarity, minLevel, minStars } = template.condition.heroConditions;
          
          if (rarity && additionalData?.rarity !== rarity) {
            return false;
          }
          
          if (minLevel && (!additionalData?.level || additionalData.level < minLevel)) {
            return false;
          }
          
          if (minStars && (!additionalData?.stars || additionalData.stars < minStars)) {
            return false;
          }
        }
        break;
        
      case "tower_floors":
      case "gacha_pulls":
      case "login":
      case "gold_spent":
      case "level_reached":
      case "daily_missions_completed":
      default:
        break;
    }
    
    return true;
  }

  private static async generateInitialMissions(playerMissions: any, playerLevel: number) {
    const dailyTemplates = await MissionTemplate.find({
      type: "daily",
      isActive: true,
      minPlayerLevel: { $lte: playerLevel },
      $or: [
        { maxPlayerLevel: { $exists: false } },
        { maxPlayerLevel: null },
        { maxPlayerLevel: { $gte: playerLevel } }
      ]
    }).sort({ priority: -1, spawnWeight: -1 });

    if (dailyTemplates.length > 0) {
      await playerMissions.generateDailyMissions(dailyTemplates, Math.min(5, dailyTemplates.length));
    }

    const weeklyTemplates = await MissionTemplate.find({
      type: "weekly",
      isActive: true,
      minPlayerLevel: { $lte: playerLevel },
      $or: [
        { maxPlayerLevel: { $exists: false } },
        { maxPlayerLevel: null },
        { maxPlayerLevel: { $gte: playerLevel } }
      ]
    }).sort({ priority: -1 });

    if (weeklyTemplates.length > 0) {
      await playerMissions.generateWeeklyMissions(weeklyTemplates, Math.min(3, weeklyTemplates.length));
    }

    await this.addBasicAchievements(playerMissions, playerLevel);
  }

  private static async checkAndApplyResets(playerMissions: any) {
    const player = await Player.findOne({ accountId: playerMissions.playerId, serverId: playerMissions.serverId });
    if (!player) return;

    let updated = false;

    if (playerMissions.needsDailyReset()) {
      await this.resetDailyMissions(playerMissions, player.level);
      updated = true;
    }

    if (playerMissions.needsWeeklyReset()) {
      await this.resetWeeklyMissions(playerMissions, player.level);
      updated = true;
    }

    if (updated) {
      await playerMissions.save();
    }
  }

  private static async resetDailyMissions(playerMissions: any, playerLevel: number) {
    console.log(`🌅 Reset missions quotidiennes pour ${playerMissions.playerId}`);

    const allCompleted = playerMissions.dailyMissions.length > 0 && 
                        playerMissions.dailyMissions.every((m: any) => m.isCompleted);

    if (!allCompleted && playerMissions.dailyMissions.length > 0) {
      playerMissions.stats.currentDailyStreak = 0;
    }

    const dailyTemplates = await MissionTemplate.find({
      type: "daily",
      isActive: true,
      minPlayerLevel: { $lte: playerLevel },
      $or: [
        { maxPlayerLevel: { $exists: false } },
        { maxPlayerLevel: null },
        { maxPlayerLevel: { $gte: playerLevel } }
      ]
    });

    if (dailyTemplates.length > 0) {
      await playerMissions.generateDailyMissions(dailyTemplates, Math.min(5, dailyTemplates.length));
    }

    playerMissions.stats.lastDailyReset = new Date();
  }

  private static async resetWeeklyMissions(playerMissions: any, playerLevel: number) {
    console.log(`📅 Reset missions hebdomadaires pour ${playerMissions.playerId}`);

    const weeklyTemplates = await MissionTemplate.find({
      type: "weekly",
      isActive: true,
      minPlayerLevel: { $lte: playerLevel },
      $or: [
        { maxPlayerLevel: { $exists: false } },
        { maxPlayerLevel: null },
        { maxPlayerLevel: { $gte: playerLevel } }
      ]
    });

    if (weeklyTemplates.length > 0) {
      await playerMissions.generateWeeklyMissions(weeklyTemplates, Math.min(3, weeklyTemplates.length));
    }

    playerMissions.stats.lastWeeklyReset = new Date();
  }

  private static async addBasicAchievements(playerMissions: any, playerLevel: number) {
    const achievementTemplates = await MissionTemplate.find({
      type: "achievement",
      isActive: true,
      minPlayerLevel: { $lte: playerLevel + 10 },
      $or: [
        { maxPlayerLevel: { $exists: false } },
        { maxPlayerLevel: null },
        { maxPlayerLevel: { $gte: playerLevel } }
      ]
    }).limit(20);

    for (const template of achievementTemplates) {
      playerMissions.achievements.push({
        missionId: `achievement_${playerMissions.playerId}_${template.missionId}_${Date.now()}`,
        templateId: template.missionId,
        name: template.name,
        description: template.description,
        type: "achievement",
        category: template.category,
        currentValue: 0,
        targetValue: template.condition.targetValue,
        isCompleted: false,
        isRewardClaimed: false,
        rewards: template.rewards,
        assignedAt: new Date(),
        expiresAt: null,
        priority: template.priority
      });
    }
  }

  private static async applyRewardToPlayer(player: any, reward: IMissionReward) {
    switch (reward.type) {
      case "currency":
        switch (reward.currencyType) {
          case "gold":
            player.gold += reward.quantity;
            break;
          case "gems":
            player.gems += reward.quantity;
            break;
          case "paidGems":
            player.paidGems += reward.quantity;
            break;
          case "tickets":
            player.tickets += reward.quantity;
            break;
        }
        break;

      case "hero":
        if (reward.heroId) {
          const existingHero = player.heroes.find((h: any) => h.heroId === reward.heroId);
          if (!existingHero) {
            player.heroes.push({
              heroId: reward.heroId,
              level: 1,
              stars: 1,
              equipped: false
            });
          } else {
            const fragments = 25;
            const currentFragments = player.fragments.get(reward.heroId) || 0;
            player.fragments.set(reward.heroId, currentFragments + fragments);
          }
        }
        break;

      case "fragment":
        if (reward.fragmentHeroId) {
          const currentFragments = player.fragments.get(reward.fragmentHeroId) || 0;
          player.fragments.set(reward.fragmentHeroId, currentFragments + reward.quantity);
        }
        break;

      case "material":
        if (reward.materialId) {
          const currentQuantity = player.materials.get(reward.materialId) || 0;
          player.materials.set(reward.materialId, currentQuantity + reward.quantity);
        }
        break;

      default:
        console.warn(`⚠️ Type de récompense mission non implémenté: ${reward.type}`);
        break;
    }
  }

  private static getRewardDescription(reward: IMissionReward): string {
    switch (reward.type) {
      case "currency":
        return `${reward.quantity} ${reward.currencyType?.toUpperCase()}`;
      case "hero":
        return `Hero: ${reward.heroId}`;
      case "fragment":
        return `${reward.quantity} Hero Fragments`;
      case "material":
        return `${reward.quantity} ${reward.materialId}`;
      case "equipment":
        return `${reward.equipmentData?.rarity} ${reward.equipmentData?.type}`;
      default:
        return `${reward.type}: ${reward.quantity}`;
    }
  }

  private static formatTimeRemaining(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  public static async createMissionTemplate(templateData: any) {
    try {
      const template = new MissionTemplate(templateData);
      await template.save();

      console.log(`🎯 Nouveau template de mission créé: ${template.name} (${template.missionId})`);

      return {
        success: true,
        message: "Mission template created successfully",
        template: template.toObject()
      };

    } catch (error: any) {
      console.error("❌ Erreur createMissionTemplate:", error);
      throw error;
    }
  }

  public static async getMissionStats(serverId?: string) {
    try {
      const matchStage = serverId ? { serverId } : {};

      const stats = await PlayerMissions.aggregate([
        { $match: matchStage },
        { $group: {
          _id: null,
          totalPlayers: { $sum: 1 },
          avgDailyCompleted: { $avg: "$stats.totalDailyCompleted" },
          avgWeeklyCompleted: { $avg: "$stats.totalWeeklyCompleted" },
          avgAchievementsCompleted: { $avg: "$stats.totalAchievementsCompleted" },
          maxDailyStreak: { $max: "$stats.longestDailyStreak" },
          avgCurrentStreak: { $avg: "$stats.currentDailyStreak" }
        }}
      ]);

      const globalStats = stats[0] || {
        totalPlayers: 0,
        avgDailyCompleted: 0,
        avgWeeklyCompleted: 0,
        avgAchievementsCompleted: 0,
        maxDailyStreak: 0,
        avgCurrentStreak: 0
      };

      return {
        success: true,
        serverId: serverId || "ALL",
        stats: {
          ...globalStats,
          avgDailyCompleted: Math.round(globalStats.avgDailyCompleted),
          avgWeeklyCompleted: Math.round(globalStats.avgWeeklyCompleted),
          avgAchievementsCompleted: Math.round(globalStats.avgAchievementsCompleted),
          avgCurrentStreak: Math.round(globalStats.avgCurrentStreak * 10) / 10
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getMissionStats:", error);
      throw error;
    }
  }
}

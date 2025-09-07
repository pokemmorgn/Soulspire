import Event, { IEvent, IEventParticipation, IEventReward } from "../models/Events";
import Player from "../models/Player";
import Hero from "../models/Hero";

export class EventService {

  public static async getActiveEvents(serverId: string) {
    try {
      console.log(`📅 Récupération événements actifs pour serveur ${serverId}`);

      const events = await Event.find({
        status: "active",
        isVisible: true,
        startTime: { $lte: new Date() },
        endTime: { $gte: new Date() },
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      }).sort({ priority: -1, startTime: 1 });

      const enrichedEvents = events.map(event => ({
        eventId: event.eventId,
        name: event.name,
        description: event.description,
        type: event.type,
        category: event.category,
        startTime: event.startTime,
        endTime: event.endTime,
        duration: event.duration,
        isActive: event.isActive(),
        timeRemaining: Math.max(0, event.endTime.getTime() - Date.now()),
        serverConfig: event.serverConfig,
        requirements: event.requirements,
        objectives: event.objectives,
        rankingRewards: event.rankingRewards,
        participantCount: event.participants.length,
        bannerUrl: event.bannerUrl,
        iconUrl: event.iconUrl,
        tags: event.tags,
        priority: event.priority
      }));

      return {
        success: true,
        events: enrichedEvents,
        count: enrichedEvents.length
      };

    } catch (error: any) {
      console.error("❌ Erreur getActiveEvents:", error);
      throw error;
    }
  }

  public static async joinEvent(
    eventId: string, 
    accountId: string, 
    serverId: string
  ) {
    try {
      console.log(`🎪 ${accountId} tente de rejoindre l'événement ${eventId}`);

      const event = await Event.findOne({ eventId, isVisible: true });
      if (!event) {
        throw new Error("Event not found");
      }

      if (!event.serverConfig.allowedServers.includes(serverId) && 
          !event.serverConfig.allowedServers.includes("ALL")) {
        throw new Error("Server not allowed for this event");
      }

      const player = await Player.findOne({ accountId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const playerData = {
        level: player.level,
        world: player.world,
        heroes_owned: player.heroes.length,
        vip_level: player.vipLevel || 0,
        server_age: Math.floor((Date.now() - ((player as any).createdAt?.getTime() || 0)) / (1000 * 60 * 60 * 24))
      };

      const eligibility = await event.canPlayerJoin(accountId, playerData);
      if (!eligibility.canJoin) {
        return {
          success: false,
          message: eligibility.reason || "Cannot join this event",
          code: "NOT_ELIGIBLE"
        };
      }

      await event.addParticipant(accountId, player.displayName, serverId);

      console.log(`✅ ${player.displayName} a rejoint l'événement ${event.name}`);

      return {
        success: true,
        message: "Successfully joined the event",
        event: {
          eventId: event.eventId,
          name: event.name,
          objectives: event.objectives.map(obj => ({
            objectiveId: obj.objectiveId,
            name: obj.name,
            description: obj.description,
            targetValue: obj.targetValue,
            currentValue: 0,
            rewards: obj.rewards
          }))
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur joinEvent:", error);
      throw error;
    }
  }

  public static async updatePlayerProgress(
    accountId: string, 
    serverId: string, 
    progressType: "battle_wins" | "tower_floors" | "gacha_pulls" | "login_days" | "gold_spent" | "collect_items",
    value: number,
    additionalData?: any
  ) {
    try {
      console.log(`📈 Mise à jour progression événements ${accountId}: ${progressType} +${value}`);

      const activeEvents = await Event.find({
        status: "active",
        startTime: { $lte: new Date() },
        endTime: { $gte: new Date() },
        "participants.playerId": accountId,
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      });

      let updatedEvents = 0;
      const completedObjectives: any[] = [];

      for (const event of activeEvents) {
        const relevantObjectives = event.objectives.filter((obj: any) => obj.type === progressType);
        
        if (relevantObjectives.length > 0) {
          const participant = event.participants.find((p: any) => p.playerId === accountId);
          
          if (participant) {
            for (const eventObjective of relevantObjectives) {
              if (this.objectiveMatchesCondition(eventObjective, progressType, additionalData)) {
                const participantObjective = participant.objectives.find((obj: any) => 
                  obj.objectiveId === eventObjective.objectiveId
                );
                
                if (participantObjective && !participantObjective.completedAt) {
                  participantObjective.currentValue = Math.min(
                    participantObjective.currentValue + value,
                    eventObjective.targetValue
                  );
                  
                  if (participantObjective.currentValue >= eventObjective.targetValue) {
                    participantObjective.completedAt = new Date();
                    
                    const points = Math.floor(eventObjective.targetValue * 0.1);
                    participant.totalPoints += points;
                    
                    completedObjectives.push({
                      eventId: event.eventId,
                      eventName: event.name,
                      objectiveId: eventObjective.objectiveId,
                      objectiveName: eventObjective.name,
                      pointsEarned: points
                    });
                    
                    console.log(`🎯 Objectif complété: ${eventObjective.name} dans ${event.name} (+${points} points)`);
                  }
                }
              }
            }
            
            participant.lastActivityAt = new Date();
            await event.save();
            updatedEvents++;
          }
        }
      }

      console.log(`✅ ${updatedEvents} événements mis à jour, ${completedObjectives.length} objectifs complétés`);

      return {
        success: true,
        updatedEvents,
        completedObjectives,
        message: completedObjectives.length > 0 ? 
          `Completed ${completedObjectives.length} event objectives!` : 
          "Progress updated"
      };

    } catch (error: any) {
      console.error("❌ Erreur updatePlayerProgress:", error);
      return {
        success: false,
        error: error.message,
        updatedEvents: 0,
        completedObjectives: []
      };
    }
  }

  public static async getPlayerEventProgress(accountId: string, serverId: string) {
    try {
      const playerEvents = await Event.find({
        "participants.playerId": accountId,
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      }).sort({ startTime: -1 });

      const eventProgress = playerEvents.map(event => {
        const participant = event.participants.find((p: any) => p.playerId === accountId);
        
        return {
          eventId: event.eventId,
          name: event.name,
          type: event.type,
          status: event.status,
          isActive: event.isActive(),
          timeRemaining: event.status === "active" ? 
            Math.max(0, event.endTime.getTime() - Date.now()) : 0,
          
          playerData: participant ? {
            joinedAt: participant.joinedAt,
            totalPoints: participant.totalPoints,
            rank: participant.rank,
            objectives: participant.objectives.map((obj: any) => {
              const eventObjective = event.objectives.find((o: any) => o.objectiveId === obj.objectiveId);
              return {
                objectiveId: obj.objectiveId,
                name: eventObjective?.name,
                currentValue: obj.currentValue,
                targetValue: eventObjective?.targetValue,
                progress: eventObjective ? (obj.currentValue / eventObjective.targetValue) * 100 : 0,
                isCompleted: !!obj.completedAt,
                completedAt: obj.completedAt,
                rewardsClaimed: obj.rewardsClaimed,
                rewards: eventObjective?.rewards || []
              };
            }),
            claimedRewards: participant.claimedRewards
          } : null
        };
      });

      return {
        success: true,
        events: eventProgress,
        activeEvents: eventProgress.filter(e => e.isActive).length,
        completedEvents: eventProgress.filter(e => e.status === "completed").length
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerEventProgress:", error);
      throw error;
    }
  }

  public static async getEventLeaderboard(
    eventId: string, 
    serverId: string, 
    limit: number = 50
  ) {
    try {
      const event = await Event.findOne({ eventId, isVisible: true });
      if (!event) {
        throw new Error("Event not found");
      }

      if (!event.serverConfig.allowedServers.includes(serverId) && 
          !event.serverConfig.allowedServers.includes("ALL")) {
        throw new Error("Server not allowed for this event");
      }

      await event.calculateRankings();

      let participants = event.participants;
      if (!event.serverConfig.crossServerRanking) {
        participants = participants.filter((p: any) => p.serverId === serverId);
        
        participants.sort((a: any, b: any) => 
          b.totalPoints - a.totalPoints || a.joinedAt.getTime() - b.joinedAt.getTime()
        );
        participants.forEach((p: any, index: number) => {
          p.rank = index + 1;
        });
      }

      const leaderboard = participants.slice(0, limit).map((participant: any) => ({
        rank: participant.rank,
        playerId: participant.playerId,
        playerName: participant.playerName,
        serverId: participant.serverId,
        totalPoints: participant.totalPoints,
        completedObjectives: participant.objectives.filter((obj: any) => obj.completedAt).length,
        joinedAt: participant.joinedAt,
        lastActivityAt: participant.lastActivityAt
      }));

      return {
        success: true,
        eventId: event.eventId,
        eventName: event.name,
        leaderboard,
        totalParticipants: participants.length,
        crossServerRanking: event.serverConfig.crossServerRanking,
        timeRemaining: Math.max(0, event.endTime.getTime() - Date.now())
      };

    } catch (error: any) {
      console.error("❌ Erreur getEventLeaderboard:", error);
      throw error;
    }
  }

  public static async claimObjectiveRewards(
    eventId: string,
    accountId: string,
    serverId: string,
    objectiveId: string
  ) {
    try {
      console.log(`🎁 ${accountId} réclame récompenses objectif ${objectiveId} événement ${eventId}`);

      const event = await Event.findOne({ eventId, isVisible: true });
      if (!event) {
        throw new Error("Event not found");
      }

      const participant = event.participants.find((p: any) => p.playerId === accountId);
      if (!participant) {
        throw new Error("Player not participating in this event");
      }

      const objectiveProgress = participant.objectives.find((obj: any) => obj.objectiveId === objectiveId);
      if (!objectiveProgress) {
        throw new Error("Objective not found");
      }

      if (!objectiveProgress.completedAt) {
        throw new Error("Objective not completed yet");
      }

      if (objectiveProgress.rewardsClaimed) {
        throw new Error("Rewards already claimed for this objective");
      }

      const eventObjective = event.objectives.find((obj: any) => obj.objectiveId === objectiveId);
      if (!eventObjective) {
        throw new Error("Event objective not found");
      }

      const player = await Player.findOne({ accountId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const rewardsGiven = [];

      for (const reward of eventObjective.rewards) {
        await this.applyRewardToPlayer(player, reward);
        rewardsGiven.push({
          type: reward.type,
          name: reward.name,
          description: reward.description
        });
      }

      objectiveProgress.rewardsClaimed = true;
      event.stats.rewardsDistributed += eventObjective.rewards.length;
      
      await Promise.all([
        event.save(),
        player.save()
      ]);

      console.log(`✅ ${rewardsGiven.length} récompenses données à ${player.displayName}`);

      return {
        success: true,
        message: "Objective rewards claimed successfully",
        rewards: rewardsGiven
      };

    } catch (error: any) {
      console.error("❌ Erreur claimObjectiveRewards:", error);
      throw error;
    }
  }

  public static async finalizeEvent(eventId: string) {
    try {
      console.log(`🏁 Finalisation de l'événement ${eventId}`);

      const event = await Event.findOne({ eventId });
      if (!event) {
        throw new Error("Event not found");
      }

      if (event.status !== "active") {
        throw new Error("Event is not active");
      }

      await event.calculateRankings();
      const distributionResult = await event.distributeRankingRewards();

      event.status = "completed";
      await event.save();

      console.log(`✅ Événement ${event.name} finalisé - ${distributionResult.distributed} récompenses distribuées`);

      return {
        success: true,
        message: "Event finalized successfully",
        finalStats: {
          totalParticipants: event.stats.totalParticipants,
          completedObjectives: event.stats.completedObjectives,
          rewardsDistributed: event.stats.rewardsDistributed,
          topScore: event.stats.topScore,
          averagePoints: event.stats.averagePoints
        },
        distributionResult
      };

    } catch (error: any) {
      console.error("❌ Erreur finalizeEvent:", error);
      throw error;
    }
  }

  private static objectiveMatchesCondition(
    objective: any,
    progressType: string,
    additionalData?: any
  ): boolean {
    
    switch (progressType) {
      case "battle_wins":
        if (objective.battleConditions) {
          const { battleType, difficulty, winRequired } = objective.battleConditions;
          
          if (battleType && additionalData?.battleType !== battleType) {
            return false;
          }
          
          if (difficulty && additionalData?.difficulty !== difficulty) {
            return false;
          }
          
          if (winRequired && !additionalData?.victory) {
            return false;
          }
        }
        break;
        
      case "collect_items":
        if (objective.collectConditions) {
          const { itemType, rarity, specificIds } = objective.collectConditions;
          
          if (itemType && additionalData?.itemType !== itemType) {
            return false;
          }
          
          if (rarity && additionalData?.rarity !== rarity) {
            return false;
          }
          
          if (specificIds && specificIds.length > 0) {
            if (!additionalData?.itemId || !specificIds.includes(additionalData.itemId)) {
              return false;
            }
          }
        }
        break;
        
      case "tower_floors":
      case "gacha_pulls":
      case "login_days":
      case "gold_spent":
      default:
        break;
    }
    
    return true;
  }

  private static async applyRewardToPlayer(player: any, reward: IEventReward) {
    switch (reward.type) {
      case "currency":
        if (reward.currencyData?.gold) player.gold += reward.currencyData.gold;
        if (reward.currencyData?.gems) player.gems += reward.currencyData.gems;
        if (reward.currencyData?.paidGems) player.paidGems += reward.currencyData.paidGems;
        if (reward.currencyData?.tickets) player.tickets += reward.currencyData.tickets;
        break;
        
      case "hero":
        if (reward.heroData?.heroId) {
          const existingHero = player.heroes.find((h: any) => h.heroId === reward.heroData!.heroId);
          if (!existingHero) {
            player.heroes.push({
              heroId: reward.heroData.heroId,
              level: reward.heroData.level || 1,
              stars: reward.heroData.stars || 1,
              equipped: false
            });
          } else {
            const fragments = reward.heroData.guaranteed ? 50 : 25;
            const currentFragments = player.fragments.get(reward.heroData.heroId) || 0;
            player.fragments.set(reward.heroData.heroId, currentFragments + fragments);
          }
        }
        break;
        
      case "material":
        if (reward.materialData) {
          const currentQuantity = player.materials.get(reward.materialData.materialId) || 0;
          player.materials.set(reward.materialData.materialId, currentQuantity + reward.materialData.quantity);
        }
        break;
        
      default:
        console.warn(`⚠️ Type de récompense non implémenté: ${reward.type}`);
        break;
    }
  }

  public static async createEvent(eventData: Partial<IEvent>) {
    try {
      const event = new Event(eventData);
      await event.save();
      
      console.log(`🎪 Nouvel événement créé: ${event.name} (${event.eventId})`);
      
      return {
        success: true,
        message: "Event created successfully",
        event: event.toObject()
      };
      
    } catch (error: any) {
      console.error("❌ Erreur createEvent:", error);
      throw error;
    }
  }

  public static async startEvent(eventId: string) {
    try {
      const event = await Event.findOne({ eventId });
      if (!event) {
        throw new Error("Event not found");
      }
      
      event.status = "active";
      await event.save();
      
      console.log(`▶️ Événement démarré: ${event.name}`);
      
      return {
        success: true,
        message: "Event started successfully"
      };
      
    } catch (error: any) {
      console.error("❌ Erreur startEvent:", error);
      throw error;
    }
  }
}

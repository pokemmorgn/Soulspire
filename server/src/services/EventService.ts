import Event, { IEvent, IEventParticipation, IEventReward } from "../models/Events";
import Player from "../models/Player";
import Hero from "../models/Hero";

export class EventService {

  // === RÉCUPÉRER LES ÉVÉNEMENTS ACTIFS POUR UN SERVEUR ===
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

      // Enrichir avec les données du joueur si nécessaire
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

  // === REJOINDRE UN ÉVÉNEMENT ===
  public static async joinEvent(
    eventId: string, 
    playerId: string, 
    serverId: string
  ) {
    try {
      console.log(`🎪 ${playerId} tente de rejoindre l'événement ${eventId}`);

      // Récupérer l'événement
      const event = await Event.findOne({ eventId, isVisible: true });
      if (!event) {
        throw new Error("Event not found");
      }

      // Vérifier que l'événement accepte ce serveur
      if (!event.serverConfig.allowedServers.includes(serverId) && 
          !event.serverConfig.allowedServers.includes("ALL")) {
        throw new Error("Server not allowed for this event");
      }

      // Récupérer le joueur avec ses données
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      // Préparer les données du joueur pour la validation
      const playerData = {
        level: player.level,
        world: player.world,
        heroes_owned: player.heroes.length,
        vip_level: 0, // TODO: Implémenter système VIP
        server_age: Math.floor((Date.now() - (player.createdAt?.getTime() || 0)) / (1000 * 60 * 60 * 24))
      };

      // Vérifier si le joueur peut rejoindre
      const eligibility = await event.canPlayerJoin(playerId, playerData);
      if (!eligibility.canJoin) {
        return {
          success: false,
          message: eligibility.reason || "Cannot join this event",
          code: "NOT_ELIGIBLE"
        };
      }

      // Ajouter le joueur à l'événement
      await event.addParticipant(playerId, player.username, serverId);

      console.log(`✅ ${player.username} a rejoint l'événement ${event.name}`);

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

  // === METTRE À JOUR LA PROGRESSION D'UN JOUEUR ===
  public static async updatePlayerProgress(
    playerId: string, 
    serverId: string, 
    progressType: "battle_wins" | "tower_floors" | "gacha_pulls" | "login_days" | "gold_spent" | "collect_items",
    value: number,
    additionalData?: any
  ) {
    try {
      console.log(`📈 Mise à jour progression événements ${playerId}: ${progressType} +${value}`);

      // Trouver tous les événements actifs où le joueur participe
      const activeEvents = await Event.find({
        status: "active",
        startTime: { $lte: new Date() },
        endTime: { $gte: new Date() },
        "participants.playerId": playerId,
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      });

      let updatedEvents = 0;
      const completedObjectives: any[] = [];

      for (const event of activeEvents) {
        // Vérifier si cet événement a des objectifs correspondants
        const relevantObjectives = event.objectives.filter((obj: any) => obj.type === progressType);
        
        if (relevantObjectives.length > 0) {
          const participant = event.participants.find((p: any) => p.playerId === playerId);
          
          if (participant) {
            // Récupérer les objectifs complétés avant la mise à jour
            const previousCompletedCount = participant.objectives.filter((obj: any) => obj.completedAt).length;
            
            // Mettre à jour chaque objectif correspondant
            for (const eventObjective of relevantObjectives) {
              // Vérifier les conditions spécifiques de l'objectif
              if (this.objectiveMatchesCondition(eventObjective, progressType, additionalData)) {
                const participantObjective = participant.objectives.find((obj: any) => 
                  obj.objectiveId === eventObjective.objectiveId
                );
                
                if (participantObjective && !participantObjective.completedAt) {
                  participantObjective.currentValue = Math.min(
                    participantObjective.currentValue + value,
                    eventObjective.targetValue
                  );
                  
                  // Vérifier si l'objectif est maintenant complété
                  if (participantObjective.currentValue >= eventObjective.targetValue) {
                    participantObjective.completedAt = new Date();
                    
                    // Calculer les points pour le classement
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
            
            // Mettre à jour la dernière activité
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
      // Ne pas faire échouer l'action principale, juste logger
      return {
        success: false,
        error: error.message,
        updatedEvents: 0,
        completedObjectives: []
      };
    }
  }

  // === RÉCUPÉRER LA PROGRESSION D'UN JOUEUR DANS LES ÉVÉNEMENTS ===
  public static async getPlayerEventProgress(playerId: string, serverId: string) {
    try {
      const playerEvents = await Event.find({
        "participants.playerId": playerId,
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      }).sort({ startTime: -1 });

      const eventProgress = playerEvents.map(event => {
        const participant = event.participants.find((p: any) => p.playerId === playerId);
        
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

  // === RÉCUPÉRER LE CLASSEMENT D'UN ÉVÉNEMENT ===
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

      // Vérifier l'accès au serveur
      if (!event.serverConfig.allowedServers.includes(serverId) && 
          !event.serverConfig.allowedServers.includes("ALL")) {
        throw new Error("Server not allowed for this event");
      }

      // Calculer les classements si nécessaire
      await event.calculateRankings();

      // Filtrer par serveur si pas de classement cross-server
      let participants = event.participants;
      if (!event.serverConfig.crossServerRanking) {
        participants = participants.filter((p: any) => p.serverId === serverId);
        
        // Re-calculer les rangs pour ce serveur uniquement
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

  // === RÉCLAMER LES RÉCOMPENSES D'OBJECTIF ===
  public static async claimObjectiveRewards(
    eventId: string,
    playerId: string,
    serverId: string,
    objectiveId: string
  ) {
    try {
      console.log(`🎁 ${playerId} réclame récompenses objectif ${objectiveId} événement ${eventId}`);

      const event = await Event.findOne({ eventId, isVisible: true });
      if (!event) {
        throw new Error("Event not found");
      }

      const participant = event.participants.find((p: any) => p.playerId === playerId);
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

      // Récupérer les récompenses de l'objectif
      const eventObjective = event.objectives.find((obj: any) => obj.objectiveId === objectiveId);
      if (!eventObjective) {
        throw new Error("Event objective not found");
      }

      // Appliquer les récompenses au joueur
      const player = await Player.findOne({ _id: playerId, serverId });
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

      // Marquer les récompenses comme réclamées
      objectiveProgress.rewardsClaimed = true;
      event.stats.rewardsDistributed += eventObjective.rewards.length;
      
      await Promise.all([
        event.save(),
        player.save()
      ]);

      console.log(`✅ ${rewardsGiven.length} récompenses données à ${player.username}`);

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

  // === FINALISER UN ÉVÉNEMENT ET DISTRIBUER LES RÉCOMPENSES DE CLASSEMENT ===
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

      // Calculer les classements finaux
      await event.calculateRankings();

      // Distribuer les récompenses de classement
      const distributionResult = await event.distributeRankingRewards();

      // Marquer l'événement comme terminé
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

  // === MÉTHODES UTILITAIRES PRIVÉES ===

  // Vérifier si un objectif d'événement correspond aux conditions
  private static objectiveMatchesCondition(
    objective: any,
    progressType: string,
    additionalData?: any
  ): boolean {
    
    // Vérifications spécifiques selon le type de progression
    switch (progressType) {
      case "battle_wins":
        if (objective.battleConditions) {
          const { battleType, difficulty, winRequired } = objective.battleConditions;
          
          // Vérifier le type de combat
          if (battleType && additionalData?.battleType !== battleType) {
            return false;
          }
          
          // Vérifier la difficulté
          if (difficulty && additionalData?.difficulty !== difficulty) {
            return false;
          }
          
          // Vérifier si une victoire est requise
          if (winRequired && !additionalData?.victory) {
            return false;
          }
        }
        break;
        
      case "collect_items":
        if (objective.collectConditions) {
          const { itemType, rarity, specificIds } = objective.collectConditions;
          
          // Vérifier le type d'item
          if (itemType && additionalData?.itemType !== itemType) {
            return false;
          }
          
          // Vérifier la rareté
          if (rarity && additionalData?.rarity !== rarity) {
            return false;
          }
          
          // Vérifier les IDs spécifiques
          if (specificIds && specificIds.length > 0) {
            if (!additionalData?.itemId || !specificIds.includes(additionalData.itemId)) {
              return false;
            }
          }
        }
        break;
        
      // Pour les autres types, pas de conditions supplémentaires pour l'instant
      case "tower_floors":
      case "gacha_pulls":
      case "login_days":
      case "gold_spent":
      default:
        // Pas de conditions supplémentaires, accepter directement
        break;
    }
    
    return true;
  }

  // Appliquer une récompense à un joueur
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
            // Convertir en fragments si déjà possédé
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
        
      // TODO: Implémenter equipment, title, avatar
      default:
        console.warn(`⚠️ Type de récompense non implémenté: ${reward.type}`);
        break;
    }
  }

  // === MÉTHODES D'ADMINISTRATION ===

  // Créer un nouvel événement (admin uniquement)
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

  // Démarrer manuellement un événement
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

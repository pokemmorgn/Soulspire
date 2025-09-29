import { TowerProgress, TowerRanking, TowerFloorConfig } from "../models/Tower";
import Player from "../models/Player";
import Hero from "../models/Hero";
import { BattleService } from "./BattleService";
import { BattleEngine } from "./BattleEngine";
import { IBattleParticipant } from "../models/Battle";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { calculateFormationSynergies } from "../config/FormationBonusConfig";

export class TowerService {
  
  // === DÉMARRER UN RUN DANS LA TOUR ===
  public static async startTowerRun(
    playerId: string, 
    serverId: string, 
    heroTeam: string[]
  ) {
    try {
      console.log(`🗼 Démarrage run tour - Joueur: ${playerId}, Serveur: ${serverId}`);

      // Vérifier le joueur
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found on this server");
      }

      // Vérifier l'équipe (3-4 héros max)
      if (!heroTeam || heroTeam.length < 1 || heroTeam.length > 4) {
        throw new Error("Invalid team size (1-4 heroes required)");
      }

      // Vérifier que le joueur possède tous les héros
      const validHeroes = heroTeam.every(heroId => 
        player.heroes.some(h => h.heroId.toString() === heroId)
      );
      
      if (!validHeroes) {
        throw new Error("Some heroes are not owned by the player");
      }

      // Récupérer ou créer la progression du joueur
      let towerProgress = await TowerProgress.findOne({ playerId, serverId });
      
      if (!towerProgress) {
        towerProgress = new TowerProgress({
          playerId,
          serverId,
          currentFloor: 1,
          highestFloor: 1,
          totalClears: 0,
          stats: {
            totalDamageDealt: 0,
            totalBattlesWon: 0,
            totalTimeSpent: 0,
            averageFloorTime: 0,
            longestStreak: 0
          },
          rewards: {
            totalGoldEarned: 0,
            totalExpGained: 0,
            itemsObtained: []
          },
          currentRun: {
            startFloor: 1,
            currentFloor: 1,
            isActive: false,
            heroTeam: [],
            consumablesUsed: 0
          },
          runHistory: []
        });
      }

      // Vérifier si un run est déjà en cours
      if (towerProgress.currentRun.isActive) {
        return {
          success: false,
          message: "A tower run is already in progress",
          currentRun: towerProgress.currentRun
        };
      }

      // Démarrer le nouveau run
      const startFloor = Math.max(1, towerProgress.highestFloor - 5); // Peut commencer 5 étages avant son record
      
      towerProgress.startNewRun(startFloor, heroTeam);
      await towerProgress.save();

      console.log(`✅ Run tour démarré - Étage de départ: ${startFloor}`);

      return {
        success: true,
        message: "Tower run started successfully",
        currentRun: towerProgress.currentRun,
        startFloor,
        highestFloor: towerProgress.highestFloor
      };

    } catch (error: any) {
      console.error("❌ Erreur startTowerRun:", error);
      throw error;
    }
  }

  // === COMBATTRE UN ÉTAGE ===
  public static async fightFloor(
    playerId: string, 
    serverId: string
  ) {
    try {
      console.log(`⚔️ Combat d'étage - Joueur: ${playerId}`);

      // Récupérer la progression
      const towerProgress = await TowerProgress.findOne({ playerId, serverId });
      if (!towerProgress || !towerProgress.currentRun.isActive) {
        throw new Error("No active tower run found");
      }

      const currentFloor = towerProgress.currentRun.currentFloor;
      const floorConfig = TowerFloorConfig.getFloorConfig(currentFloor);

      // Récupérer le joueur et construire son équipe
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const playerTeam = await this.buildTowerPlayerTeam(player, towerProgress.currentRun.heroTeam);
      const enemyTeam = await this.generateTowerEnemies(floorConfig);

      console.log(`🎯 Étage ${currentFloor}: ${playerTeam.length} héros vs ${enemyTeam.length} ennemis`);

      // Simulation du combat
      const battleEngine = new BattleEngine(playerTeam, enemyTeam);
      const battleResult = battleEngine.simulateBattle();

      // Traitement du résultat
      if (battleResult.victory) {
        // Victoire - progression
        const floorRewards = this.calculateFloorRewards(floorConfig);
        
        await towerProgress.completeFloor(floorRewards);
        
        // Appliquer les récompenses au joueur
        if (floorRewards.gold > 0) player.gold += floorRewards.gold;
        if (floorRewards.exp > 0) {
          // TODO: Distribuer l'XP aux héros
        }
        await player.save();

        await Promise.all([
          MissionService.updateProgress(
            playerId, 
            serverId, 
            "tower_floors", 
            1
          ),
          EventService.updatePlayerProgress(
            playerId, 
            serverId, 
            "tower_floors", 
            1, 
            { 
              floor: currentFloor,
              isBossFloor: floorConfig.enemyConfig.bossFloor 
            }
          )
        ]);

        console.log(`🏆 Victoire étage ${currentFloor}! Missions et événements mis à jour.`);
        
        // Vérifier si c'est un étage boss (récompense spéciale)
        let specialReward = null;
        if (floorConfig.rewards.firstClearBonus && currentFloor > towerProgress.highestFloor) {
          specialReward = floorConfig.rewards.firstClearBonus;
          player.gold += specialReward.gold;
          if (specialReward.gems) player.gems += specialReward.gems;
          await player.save();
        }

        console.log(`🏆 Victoire étage ${currentFloor}! Récompenses: ${floorRewards.gold} or`);

        return {
          success: true,
          victory: true,
          currentFloor: towerProgress.currentRun.currentFloor,
          rewards: floorRewards,
          specialReward,
          battleResult: battleResult,
          nextFloorAvailable: true
        };

      } else {
        // Défaite - fin du run
        await towerProgress.endRun("defeated");

        // Mettre à jour le classement si nécessaire
        await this.updatePlayerRanking(playerId, serverId, player.displayName, towerProgress);

        console.log(`💀 Défaite étage ${currentFloor}. Run terminé.`);

        return {
          success: true,
          victory: false,
          finalFloor: currentFloor - 1,
          totalRewards: towerProgress.rewards,
          battleResult: battleResult,
          runCompleted: true
        };
      }

    } catch (error: any) {
      console.error("❌ Erreur fightFloor:", error);
      throw error;
    }
  }

  // === ABANDONNER LE RUN ACTUEL ===
  public static async abandonRun(playerId: string, serverId: string) {
    try {
      const towerProgress = await TowerProgress.findOne({ playerId, serverId });
      if (!towerProgress || !towerProgress.currentRun.isActive) {
        throw new Error("No active tower run found");
      }

      await towerProgress.endRun("abandoned");
      console.log(`🚪 Run abandonné par ${playerId} à l'étage ${towerProgress.currentRun.currentFloor}`);

      return {
        success: true,
        message: "Tower run abandoned",
        finalFloor: towerProgress.currentRun.currentFloor - 1,
        rewards: towerProgress.rewards
      };

    } catch (error: any) {
      console.error("❌ Erreur abandonRun:", error);
      throw error;
    }
  }

  // === RÉCUPÉRER LA PROGRESSION DU JOUEUR ===
  public static async getPlayerProgress(playerId: string, serverId: string) {
    try {
      const towerProgress = await TowerProgress.findOne({ playerId, serverId });
      
      if (!towerProgress) {
        return {
          hasProgress: false,
          message: "No tower progress found"
        };
      }

      // Calculer le rang du joueur
      const playerRank = await towerProgress.getPlayerRank(serverId);

      return {
        hasProgress: true,
        currentFloor: towerProgress.currentFloor,
        highestFloor: towerProgress.highestFloor,
        totalClears: towerProgress.totalClears,
        currentRun: towerProgress.currentRun,
        stats: towerProgress.stats,
        rewards: towerProgress.rewards,
        runHistory: towerProgress.runHistory.slice(-5), // 5 derniers runs
        playerRank
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerProgress:", error);
      throw error;
    }
  }

  // === RÉCUPÉRER LE CLASSEMENT DU SERVEUR ===
  public static async getServerLeaderboard(serverId: string, limit: number = 50) {
    try {
      const topPlayers = await TowerProgress.find({ serverId })
        .sort({ highestFloor: -1, totalClears: -1 })
        .limit(limit)
        .populate("playerId", "username");

      const leaderboard = topPlayers.map((progress, index) => ({
        rank: index + 1,
        playerId: progress.playerId,
        playerName: (progress.playerId as any).username,
        highestFloor: progress.highestFloor,
        totalClears: progress.totalClears,
        lastActive: (progress as any).updatedAt || new Date()
      }));

      return {
        success: true,
        leaderboard,
        serverInfo: {
          serverId,
          totalPlayers: leaderboard.length,
          topFloor: leaderboard[0]?.highestFloor || 0
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getServerLeaderboard:", error);
      throw error;
    }
  }

  // === CONSTRUIRE L'ÉQUIPE DU JOUEUR POUR LA TOUR ===
  private static async buildTowerPlayerTeam(
    player: any, 
    heroTeamIds: string[]
  ): Promise<IBattleParticipant[]> {
    
    const team: IBattleParticipant[] = [];

    for (const heroId of heroTeamIds) {
      const playerHero = player.heroes.find((h: any) => h.heroId.toString() === heroId);
      if (!playerHero) continue;

      // Récupérer les données du héros
      const heroData = await Hero.findById(playerHero.heroId);
      if (!heroData) continue;

      // Calculer les stats de combat (même méthode que BattleService)
      const levelMultiplier = 1 + (playerHero.level - 1) * 0.1;
      const starMultiplier = 1 + (playerHero.stars - 1) * 0.2;
      const totalMultiplier = levelMultiplier * starMultiplier;

      const combatStats = {
        hp: Math.floor(heroData.baseStats.hp * totalMultiplier),
        maxHp: Math.floor(heroData.baseStats.hp * totalMultiplier),
        atk: Math.floor(heroData.baseStats.atk * totalMultiplier),
        def: Math.floor(heroData.baseStats.def * totalMultiplier),
        speed: 80 + playerHero.level // Vitesse basée sur le niveau
      };

      const participant: IBattleParticipant = {
        heroId: (heroData._id as any).toString(),
        name: heroData.name,
        position: team.length + 1, // ✅ NOUVEAU : Position 1, 2, 3, 4
        role: heroData.role,
        element: heroData.element,
        rarity: heroData.rarity,
        level: playerHero.level,
        stars: playerHero.stars,
        stats: combatStats,
        currentHp: combatStats.hp,
        energy: 0,
        status: {
          alive: true,
          buffs: [],
          debuffs: []
        }
      };

      team.push(participant);
    }

    return team;
  }

  // === GÉNÉRER LES ENNEMIS D'UN ÉTAGE ===
private static async generateTowerEnemies(floorConfig: any): Promise<IBattleParticipant[]> {
  const { floor, enemyConfig, difficultyMultiplier } = floorConfig;
  const enemies: IBattleParticipant[] = [];

  const baseHeroes = await Hero.aggregate([{ $sample: { size: enemyConfig.enemyCount } }]);

  // ✅ NOUVEAU : Calculer d'abord la distribution élémentaire
  const elementDistribution: Record<string, number> = {};
  
  for (const heroData of baseHeroes) {
    if (heroData.element) {
      elementDistribution[heroData.element] = (elementDistribution[heroData.element] || 0) + 1;
    }
  }

  // ✅ Créer les ennemis avec les bonus appliqués
  for (let i = 0; i < baseHeroes.length; i++) {
    const heroData = baseHeroes[i];
    
    const baseMultiplier = difficultyMultiplier * (1 + (floor - 1) * 0.15);
    
    const baseEnemyStats = {
      hp: Math.floor(heroData.baseStats.hp * baseMultiplier),
      maxHp: Math.floor(heroData.baseStats.hp * baseMultiplier),
      atk: Math.floor(heroData.baseStats.atk * baseMultiplier),
      def: Math.floor(heroData.baseStats.def * baseMultiplier),
      speed: 90 + Math.floor(floor * 0.5)
    };
    
    // ✅ NOUVEAU : Appliquer les bonus de synergie
    const enemyStats = this.applyFormationBonuses(baseEnemyStats, elementDistribution);

    const enemy: IBattleParticipant = {
      heroId: `tower_enemy_${floor}_${i}`,
      name: enemyConfig.bossFloor ? `Tower Boss ${heroData.name}` : `Tower Guardian ${heroData.name}`,
      position: i + 1,
      role: heroData.role,
      element: heroData.element,
      rarity: enemyConfig.bossFloor ? "Legendary" : "Epic",
      level: enemyConfig.baseLevel,
      stars: enemyConfig.bossFloor ? 6 : 4,
      stats: enemyStats, // ✅ NOUVEAU : Stats avec bonus
      currentHp: enemyStats.hp, // ✅ NOUVEAU : HP avec bonus
      energy: enemyConfig.bossFloor ? 50 : 0,
      status: {
        alive: true,
        buffs: enemyConfig.bossFloor ? ["boss_aura"] : [],
        debuffs: []
      }
    };

    enemies.push(enemy);
  }

  console.log(`👹 Générés ${enemies.length} ennemis étage ${floor} (${enemyConfig.bossFloor ? 'BOSS' : 'Normal'})`);
  return enemies;
}

  /**
 * Appliquer les bonus de synergie élémentaire aux ennemis de la tour
 */
private static applyFormationBonuses(
  stats: any,
  elementDistribution: Record<string, number>
): any {
  const synergies = calculateFormationSynergies(elementDistribution);
  const bonuses = synergies.bonuses;

  if (bonuses.hp > 0 || bonuses.atk > 0 || bonuses.def > 0) {
    return {
      hp: Math.floor(stats.hp * (1 + bonuses.hp / 100)),
      maxHp: Math.floor(stats.maxHp * (1 + bonuses.hp / 100)),
      atk: Math.floor(stats.atk * (1 + bonuses.atk / 100)),
      def: Math.floor(stats.def * (1 + bonuses.def / 100)),
      speed: stats.speed
    };
  }

  return stats;
}
  
  // === CALCULER LES RÉCOMPENSES D'UN ÉTAGE ===
  private static calculateFloorRewards(floorConfig: any) {
    return {
      gold: floorConfig.rewards.baseGold,
      exp: floorConfig.rewards.baseExp,
      items: floorConfig.rewards.dropItems || []
    };
  }

  // === METTRE À JOUR LE CLASSEMENT ===
  private static async updatePlayerRanking(
    playerId: string, 
    serverId: string, 
    playerName: string, 
    towerProgress: any
  ) {
    try {
      const currentSeason = new Date().toISOString().slice(0, 7); // YYYY-MM

      let ranking = await TowerRanking.findOne({ serverId, season: currentSeason });
      
      if (!ranking) {
        // Créer le classement de la saison
        ranking = new TowerRanking({
          serverId,
          season: currentSeason,
          rankings: [],
          seasonStart: new Date(),
          seasonEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), // Fin du mois
          isActive: true
        });
      }

      await ranking.updatePlayerRank(
        playerId, 
        playerName, 
        towerProgress.highestFloor, 
        towerProgress.totalClears
      );

      console.log(`🏅 Classement mis à jour pour ${playerName} - Étage ${towerProgress.highestFloor}`);

    } catch (error) {
      console.error("❌ Erreur updatePlayerRanking:", error);
      // Ne pas faire échouer le processus principal
    }
  }

  // === RÉCUPÉRER LES STATISTIQUES GLOBALES ===
  public static async getTowerStats(serverId: string) {
    try {
      const stats = await TowerProgress.aggregate([
        { $match: { serverId } },
        { $group: {
          _id: null,
          totalPlayers: { $sum: 1 },
          averageFloor: { $avg: "$highestFloor" },
          maxFloor: { $max: "$highestFloor" },
          totalClears: { $sum: "$totalClears" }
        }}
      ]);

      const serverStats = stats[0] || {
        totalPlayers: 0,
        averageFloor: 0,
        maxFloor: 0,
        totalClears: 0
      };

      return {
        success: true,
        serverId,
        stats: {
          ...serverStats,
          averageFloor: Math.round(serverStats.averageFloor)
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getTowerStats:", error);
      throw error;
    }
  }
}

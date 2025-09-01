import { TowerProgress, TowerRanking, TowerFloorConfig } from "../models/Tower";
import Player from "../models/Player";
import Hero from "../models/Hero";
import { BattleService } from "./BattleService";
import { IBattleParticipant } from "../models/Battle";

export class TowerService {

  // Récupère ou crée la progression d'un joueur dans la tour
  public static async getOrCreatePlayerProgress(playerId: string, serverId: string) {
    try {
      let progress = await TowerProgress.findOne({ playerId, serverId });
      
      if (!progress) {
        progress = new TowerProgress({
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
        
        await progress.save();
        console.log(`🗼 Nouvelle progression tour créée pour ${playerId} sur ${serverId}`);
      }
      
      return progress;
    } catch (error) {
      console.error("Error getting/creating tower progress:", error);
      throw error;
    }
  }

  // Démarre un nouveau run dans la tour
  public static async startTowerRun(playerId: string, serverId: string, startFloor?: number) {
    try {
      const progress = await this.getOrCreatePlayerProgress(playerId, serverId);
      
      // Vérifier qu'aucun run n'est en cours
      if (progress.currentRun.isActive) {
        throw new Error("A tower run is already active");
      }
      
      // Récupérer le joueur et ses héros équipés
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }
      
      const equippedHeroes = player.heroes.filter((h: any) => h.equipped);
      if (equippedHeroes.length === 0) {
        throw new Error("No equipped heroes found");
      }
      
      // Déterminer l'étage de départ
      const actualStartFloor = startFloor || progress.highestFloor;
      if (actualStartFloor > progress.highestFloor) {
        throw new Error("Cannot start from a floor higher than your record");
      }
      
      // Démarrer le run
      const heroTeam = equippedHeroes.map((h: any) => h.heroId._id.toString());
      progress.startNewRun(actualStartFloor, heroTeam);
      await progress.save();
      
      // Récupérer la configuration du premier étage
      const floorConfig = TowerFloorConfig.getFloorConfig(actualStartFloor);
      
      return {
        runId: progress.currentRun.startFloor + "_" + Date.now(),
        startFloor: actualStartFloor,
        currentFloor: actualStartFloor,
        floorConfig,
        heroTeam: equippedHeroes.map((h: any) => ({
          id: h.heroId._id,
          name: h.heroId.name,
          level: h.level,
          stars: h.stars
        }))
      };
      
    } catch (error) {
      console.error("Error starting tower run:", error);
      throw error;
    }
  }

  // Combat contre un étage de la tour
  public static async challengeFloor(playerId: string, serverId: string) {
    try {
      const progress = await this.getOrCreatePlayerProgress(playerId, serverId);
      
      if (!progress.currentRun.isActive) {
        throw new Error("No active tower run");
      }
      
      const currentFloor = progress.currentRun.currentFloor;
      const floorConfig = TowerFloorConfig.getFloorConfig(currentFloor);
      
      // Récupérer l'équipe du joueur
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }
      
      // Construire l'équipe du joueur
      const playerTeam = await this.buildPlayerTeamForTower(player, progress.currentRun.heroTeam);
      
      // Générer les ennemis de l'étage
      const enemyTeam = await this.generateFloorEnemies(floorConfig);
      
      // Simuler le combat via BattleService
      console.log(`⚔️ Combat étage ${currentFloor}: ${playerTeam.length} vs ${enemyTeam.length}`);
      
      const battleEngine = new (await import("./BattleEngine")).BattleEngine(playerTeam, enemyTeam);
      const battleResult = battleEngine.simulateBattle();
      
      if (battleResult.victory) {
        // Victoire - calculer les récompenses
        const floorRewards = this.calculateFloorRewards(floorConfig, currentFloor, progress);
        
        // Mettre à jour la progression
        await progress.completeFloor(floorRewards);
        
        // Mettre à jour le classement
        await this.updatePlayerRanking(playerId, player.username, serverId, progress.highestFloor, progress.totalClears);
        
        // Appliquer les récompenses au joueur
        if (floorRewards.gold > 0) player.gold += floorRewards.gold;
        if (floorRewards.gems > 0) player.gems += floorRewards.gems;
        await player.save();
        
        return {
          victory: true,
          floorCompleted: currentFloor,
          nextFloor: currentFloor + 1,
          rewards: floorRewards,
          battleStats: battleResult.stats,
          canContinue: true
        };
        
      } else {
        // Défaite - terminer le run
        await progress.endRun("defeated");
        
        return {
          victory: false,
          floorCompleted: currentFloor - 1,
          runEnded: true,
          battleStats: battleResult.stats,
          canContinue: false
        };
      }
      
    } catch (error) {
      console.error("Error challenging floor:", error);
      throw error;
    }
  }

  // Abandonne le run actuel
  public static async abandonRun(playerId: string, serverId: string) {
    try {
      const progress = await this.getOrCreatePlayerProgress(playerId, serverId);
      
      if (!progress.currentRun.isActive) {
        throw new Error("No active tower run to abandon");
      }
      
      const floorsCompleted = progress.currentRun.currentFloor - progress.currentRun.startFloor;
      await progress.endRun("abandoned");
      
      return {
        message: "Tower run abandoned",
        floorsCompleted,
        canRestart: true
      };
      
    } catch (error) {
      console.error("Error abandoning tower run:", error);
      throw error;
    }
  }

  // Récupère le classement de la tour pour un serveur
  public static async getServerRanking(serverId: string, limit: number = 100) {
    try {
      const currentSeason = this.getCurrentSeason();
      
      let ranking = await TowerRanking.findOne({ 
        serverId, 
        season: currentSeason,
        isActive: true 
      });
      
      if (!ranking) {
        ranking = await this.createNewSeasonRanking(serverId, currentSeason);
      }
      
      // Récupérer aussi les progressions récentes pour mettre à jour
      const recentProgresses = await TowerProgress.find({ serverId })
        .sort({ updatedAt: -1 })
        .limit(limit);
      
      // Mettre à jour le classement avec les données récentes
      for (const progress of recentProgresses) {
        const player = await Player.findOne({ _id: progress.playerId, serverId });
        if (player) {
          await ranking.updatePlayerRank(
            progress.playerId,
            player.username,
            progress.highestFloor,
            progress.totalClears
          );
        }
      }
      
      return {
        season: currentSeason,
        rankings: ranking.rankings.slice(0, limit),
        totalPlayers: ranking.rankings.length,
        lastUpdated: ranking.updatedAt
      };
      
    } catch (error) {
      console.error("Error getting server ranking:", error);
      throw error;
    }
  }

  // Récupère les statistiques détaillées d'un joueur
  public static async getPlayerStats(playerId: string, serverId: string) {
    try {
      const progress = await this.getOrCreatePlayerProgress(playerId, serverId);
      const playerRank = await progress.getPlayerRank(serverId);
      
      // Calculer des statistiques additionnelles
      const recentRuns = progress.runHistory.slice(-10); // 10 derniers runs
      const avgFloorsPerRun = recentRuns.length > 0 ? 
        recentRuns.reduce((sum, run) => sum + (run.endFloor - run.startFloor + 1), 0) / recentRuns.length : 0;
      
      return {
        progression: {
          currentFloor: progress.currentFloor,
          highestFloor: progress.highestFloor,
          totalClears: progress.totalClears,
          rank: playerRank
        },
        stats: {
          ...progress.stats,
          avgFloorsPerRun: Math.round(avgFloorsPerRun * 10) / 10,
          totalRuns: progress.runHistory.length,
          successRate: progress.runHistory.length > 0 ? 
            (progress.runHistory.filter(r => r.result === "completed").length / progress.runHistory.length) * 100 : 0
        },
        rewards: progress.rewards,
        currentRun: progress.currentRun.isActive ? {
          startFloor: progress.currentRun.startFloor,
          currentFloor: progress.currentRun.currentFloor,
          timeElapsed: progress.currentRun.startTime ? 
            Date.now() - progress.currentRun.startTime.getTime() : 0
        } : null,
        recentHistory: recentRuns
      };
      
    } catch (error) {
      console.error("Error getting player stats:", error);
      throw error;
    }
  }

  // Construit l'équipe du joueur pour la tour
  private static async buildPlayerTeamForTower(player: any, heroTeam: string[]): Promise<IBattleParticipant[]> {
    const team: IBattleParticipant[] = [];
    
    for (const heroId of heroTeam) {
      const playerHero = player.heroes.find((h: any) => 
        h.heroId._id.toString() === heroId || h.heroId.toString() === heroId
      );
      
      if (!playerHero || !playerHero.heroId) continue;
      
      const heroData = typeof playerHero.heroId === 'string' ? 
        await Hero.findById(playerHero.heroId) : playerHero.heroId;
      
      if (!heroData) continue;
      
      const combatStats = this.calculateTowerCombatStats(heroData, playerHero.level, playerHero.stars);
      
      team.push({
        heroId: (heroData._id as any).toString(),
        name: heroData.name,
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
      });
    }
    
    return team;
  }

  // Génère les ennemis d'un étage
  private static async generateFloorEnemies(floorConfig: any): Promise<IBattleParticipant[]> {
    const enemies: IBattleParticipant[] = [];
    
    // Récupérer des héros aléatoires comme base
    const availableHeroes = await Hero.aggregate([
      { $sample: { size: floorConfig.enemyConfig.enemyCount } }
    ]);
    
    for (let i = 0; i < availableHeroes.length; i++) {
      const heroData = availableHeroes[i];
      const enemyLevel = floorConfig.enemyConfig.baseLevel;
      const enemyStars = floorConfig.enemyConfig.bossFloor ? 6 : 3;
      
      // Stats améliorées par le multiplicateur de difficulté
      const baseStats = this.calculateTowerCombatStats(heroData, enemyLevel, enemyStars);
      const enhancedStats = {
        hp: Math.floor(baseStats.hp * floorConfig.difficultyMultiplier),
        maxHp: Math.floor(baseStats.hp * floorConfig.difficultyMultiplier),
        atk: Math.floor(baseStats.atk * floorConfig.difficultyMultiplier),
        def: Math.floor(baseStats.def * floorConfig.difficultyMultiplier),
        speed: baseStats.speed
      };
      
      const enemyName = floorConfig.enemyConfig.bossFloor ? 
        `Floor ${floorConfig.floor} Boss` : 
        `Floor ${floorConfig.floor} Guardian ${i + 1}`;
      
      enemies.push({
        heroId: `tower_enemy_${floorConfig.floor}_${i}`,
        name: enemyName,
        role: heroData.role,
        element: heroData.element,
        rarity: heroData.rarity,
        level: enemyLevel,
        stars: enemyStars,
        stats: enhancedStats,
        currentHp: enhancedStats.hp,
        energy: 0,
        status: {
          alive: true,
          buffs: [],
          debuffs: []
        }
      });
    }
    
    return enemies;
  }

  // Calcule les stats de combat pour la tour
  private static calculateTowerCombatStats(heroData: any, level: number, stars: number) {
    const levelMultiplier = 1 + (level - 1) * 0.1;
    const starMultiplier = 1 + (stars - 1) * 0.2;
    const totalMultiplier = levelMultiplier * starMultiplier;
    
    const hp = Math.floor(heroData.baseStats.hp * totalMultiplier);
    const atk = Math.floor(heroData.baseStats.atk * totalMultiplier);
    const def = Math.floor(heroData.baseStats.def * totalMultiplier);
    
    const speedByRole = {
      "Tank": 80,
      "DPS Melee": 100,
      "DPS Ranged": 90,
      "Support": 85
    };
    
    const baseSpeed = speedByRole[heroData.role as keyof typeof speedByRole] || 90;
    const speed = Math.floor(baseSpeed * (1 + (level - 1) * 0.01));
    
    return { hp, maxHp: hp, atk, def, speed };
  }

  // Calcule les récompenses d'un étage
  private static calculateFloorRewards(floorConfig: any, currentFloor: number, progress: any) {
    const baseRewards = floorConfig.rewards;
    let rewards: any = {
      gold: baseRewards.baseGold,
      exp: baseRewards.baseExp,
      gems: 0,
      items: []
    };
    
    // Bonus de première completion
    if (currentFloor > progress.highestFloor && baseRewards.firstClearBonus) {
      rewards.gold += baseRewards.firstClearBonus.gold;
      rewards.gems += baseRewards.firstClearBonus.gems || 0;
      rewards.items.push(...(baseRewards.firstClearBonus.items || []));
    }
    
    // Drops aléatoires
    if (baseRewards.dropItems) {
      for (const drop of baseRewards.dropItems) {
        if (Math.random() < drop.dropRate) {
          rewards.items.push(`${drop.itemType}_floor_${currentFloor}`);
        }
      }
    }
    
    return rewards;
  }

  // Utilitaires pour les classements
  private static getCurrentSeason(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private static async createNewSeasonRanking(serverId: string, season: string) {
    const seasonStart = new Date();
    seasonStart.setDate(1); // Premier jour du mois
    seasonStart.setHours(0, 0, 0, 0);
    
    const seasonEnd = new Date(seasonStart);
    seasonEnd.setMonth(seasonEnd.getMonth() + 1);
    seasonEnd.setDate(0); // Dernier jour du mois
    seasonEnd.setHours(23, 59, 59, 999);
    
    const ranking = new TowerRanking({
      serverId,
      season,
      rankings: [],
      seasonStart,
      seasonEnd,
      isActive: true
    });
    
    await ranking.save();
    return ranking;
  }

  private static async updatePlayerRanking(
    playerId: string, 
    playerName: string, 
    serverId: string, 
    highestFloor: number, 
    totalClears: number
  ) {
    const currentSeason = this.getCurrentSeason();
    let ranking = await TowerRanking.findOne({ serverId, season: currentSeason, isActive: true });
    
    if (!ranking) {
      ranking = await this.createNewSeasonRanking(serverId, currentSeason);
    }
    
    await ranking.updatePlayerRank(playerId, playerName, highestFloor, totalClears);
    console.log(`📊 Classement mis à jour: ${playerName} étage ${highestFloor}`);
  }
}

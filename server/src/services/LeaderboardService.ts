import Player from "../models/Player";
import Hero from "../models/Hero";
import { TowerProgress } from "../models/Tower";
import CampaignProgress from "../models/CampaignProgress";
import AfkState from "../models/AfkState";

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  serverId: string;
  value: number;
  additionalData?: any;
  lastUpdated?: Date;
  level: number;
}

export interface LeaderboardResponse {
  success: boolean;
  leaderboard: LeaderboardEntry[];
  playerRank?: {
    rank: number;
    value: number;
    percentile: number;
  };
  meta: {
    type: string;
    serverId: string;
    totalPlayers: number;
    lastUpdate: Date;
    updateFrequency: string;
  };
}

export interface PowerCalculation {
  totalPower: number;
  heroesPower: number;
  equipmentPower: number;
  levelPower: number;
  breakdown: {
    heroCount: number;
    avgHeroLevel: number;
    avgHeroStars: number;
    equippedHeroes: number;
  };
}

export class LeaderboardService {

  // === CLASSEMENT PAR PUISSANCE TOTALE ===
  public static async getPowerLeaderboard(
    serverId: string,
    limit: number = 50,
    playerId?: string
  ): Promise<LeaderboardResponse> {
    try {
      console.log(`💪 Classement puissance serveur ${serverId} (top ${limit})`);

      // Récupérer tous les joueurs avec leurs héros
      const players = await Player.find({ serverId })
        .populate("heroes.heroId")
        .select("username level heroes lastSeenAt")
        .lean();

      if (players.length === 0) {
        return this.createEmptyLeaderboard("power", serverId);
      }

      // Calculer la puissance pour chaque joueur
      const playerPowers = await Promise.all(
        players.map(async (player) => {
          const powerCalc = await this.calculatePlayerPower(player);
          return {
            playerId: player._id.toString(),
            playerName: player.displayName,
            power: powerCalc.totalPower,
            breakdown: powerCalc.breakdown,
            level: player.level,
            lastSeen: player.lastSeenAt
          };
        })
      );

      // Trier par puissance décroissante
      playerPowers.sort((a, b) => b.power - a.power);

      // Créer le classement
      const leaderboard: LeaderboardEntry[] = playerPowers
        .slice(0, limit)
        .map((player, index) => ({
          rank: index + 1,
          playerId: player.playerId,
          playerName: player.playerName,
          serverId,
          value: player.power,
          level: player.level,
          additionalData: {
            breakdown: player.breakdown,
            lastSeen: player.lastSeen
          }
        }));

      // Trouver le rang du joueur spécifique si demandé
      let playerRank = undefined;
      if (playerId) {
        const playerIndex = playerPowers.findIndex(p => p.playerId === playerId);
        if (playerIndex !== -1) {
          playerRank = {
            rank: playerIndex + 1,
            value: playerPowers[playerIndex].power,
            percentile: Math.round(((playerPowers.length - playerIndex) / playerPowers.length) * 100)
          };
        }
      }

      console.log(`✅ Classement puissance généré: ${leaderboard.length} joueurs`);

      return {
        success: true,
        leaderboard,
        playerRank,
        meta: {
          type: "power",
          serverId,
          totalPlayers: playerPowers.length,
          lastUpdate: new Date(),
          updateFrequency: "real-time"
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getPowerLeaderboard:", error);
      throw error;
    }
  }

  // === CLASSEMENT TOUR ===
  public static async getTowerLeaderboard(
    serverId: string,
    limit: number = 50,
    playerId?: string
  ): Promise<LeaderboardResponse> {
    try {
      console.log(`🗼 Classement tour serveur ${serverId} (top ${limit})`);

      // Récupérer les progressions tour avec infos joueur
      const towerProgresses = await TowerProgress.find({ serverId })
        .populate("playerId", "username level")
        .sort({ highestFloor: -1, totalClears: -1 })
        .limit(limit * 2) // Prendre plus pour gérer les joueurs supprimés
        .lean();

      if (towerProgresses.length === 0) {
        return this.createEmptyLeaderboard("tower", serverId);
      }

      // Filtrer et construire le classement
      const validProgresses = towerProgresses
        .filter(progress => progress.playerId && (progress.playerId as any).username)
        .slice(0, limit);

      const leaderboard: LeaderboardEntry[] = validProgresses.map((progress, index) => {
        const player = progress.playerId as any;
        return {
          rank: index + 1,
          playerId: player._id.toString(),
          playerName: player.username,
          serverId,
          value: progress.highestFloor,
          level: player.level,
          additionalData: {
            totalClears: progress.totalClears,
            currentFloor: progress.currentFloor,
            totalTimeSpent: progress.stats?.totalTimeSpent || 0,
            isActiveRun: progress.currentRun?.isActive || false
          },
          lastUpdated: (progress as any).updatedAt
        };
      });

      // Trouver le rang du joueur spécifique
      let playerRank = undefined;
      if (playerId) {
        const allProgresses = await TowerProgress.find({ serverId })
          .sort({ highestFloor: -1, totalClears: -1 });
        
        const playerIndex = allProgresses.findIndex(p => p.playerId.toString() === playerId);
        if (playerIndex !== -1) {
          playerRank = {
            rank: playerIndex + 1,
            value: allProgresses[playerIndex].highestFloor,
            percentile: Math.round(((allProgresses.length - playerIndex) / allProgresses.length) * 100)
          };
        }
      }

      return {
        success: true,
        leaderboard,
        playerRank,
        meta: {
          type: "tower",
          serverId,
          totalPlayers: await TowerProgress.countDocuments({ serverId }),
          lastUpdate: new Date(),
          updateFrequency: "real-time"
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getTowerLeaderboard:", error);
      throw error;
    }
  }

  // === CLASSEMENT CAMPAGNE (PROGRESSION) ===
  public static async getCampaignLeaderboard(
    serverId: string,
    limit: number = 50,
    playerId?: string
  ): Promise<LeaderboardResponse> {
    try {
      console.log(`🏰 Classement campagne serveur ${serverId} (top ${limit})`);

      // Récupérer les joueurs avec leur progression campagne
      const players = await Player.find({ serverId })
        .select("username level world lastSeenAt")
        .sort({ world: -1, level: -1 })
        .limit(limit * 2)
        .lean();

      if (players.length === 0) {
        return this.createEmptyLeaderboard("campaign", serverId);
      }

      // Récupérer les progressions détaillées pour les tops joueurs
      const playerIds = players.map(p => p._id.toString());
      const campaignProgresses = await CampaignProgress.find({
        playerId: { $in: playerIds },
        serverId
      }).lean();

      // Créer une map pour accès rapide
      const progressMap = new Map();
      campaignProgresses.forEach((progress: any) => {
        progressMap.set(progress.playerId, progress);
      });

      // Calculer le score de progression pour chaque joueur
      const playerScores = players.map(player => {
        const progress = progressMap.get(player._id.toString());
        
        // Score basé sur monde + niveau + étoiles obtenues
        const worldScore = (player.world - 1) * 1000;
        const levelScore = player.level;
        const starScore = progress ? progress.totalStarsEarned || 0 : 0;
        const totalScore = worldScore + levelScore + starScore;

        return {
          playerId: player._id.toString(),
          playerName: player.username,
          totalScore,
          world: player.world,
          level: player.level,
          stars: starScore,
          playerLevel: player.level,
          lastSeen: player.lastSeenAt,
          progressData: progress
        };
      });

      // Trier par score total
      playerScores.sort((a, b) => b.totalScore - a.totalScore);

      // Créer le classement
      const leaderboard: LeaderboardEntry[] = playerScores
        .slice(0, limit)
        .map((player, index) => ({
          rank: index + 1,
          playerId: player.playerId,
          playerName: player.playerName,
          serverId,
          value: player.totalScore,
          level: player.playerLevel,
          additionalData: {
            world: player.world,
            campaignLevel: player.level,
            totalStars: player.stars,
            lastSeen: player.lastSeen,
            completedWorlds: player.progressData ? 
              player.progressData.progressByDifficulty?.filter((d: any) => d.isCompleted).length || 0 : 0
          }
        }));

      // Rang du joueur spécifique
      let playerRank = undefined;
      if (playerId) {
        const playerIndex = playerScores.findIndex(p => p.playerId === playerId);
        if (playerIndex !== -1) {
          playerRank = {
            rank: playerIndex + 1,
            value: playerScores[playerIndex].totalScore,
            percentile: Math.round(((playerScores.length - playerIndex) / playerScores.length) * 100)
          };
        }
      }

      return {
        success: true,
        leaderboard,
        playerRank,
        meta: {
          type: "campaign",
          serverId,
          totalPlayers: playerScores.length,
          lastUpdate: new Date(),
          updateFrequency: "real-time"
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getCampaignLeaderboard:", error);
      throw error;
    }
  }

  // === CLASSEMENT AFK GAINS (GOLD GAGNÉ) ===
  public static async getAfkLeaderboard(
    serverId: string,
    limit: number = 50,
    playerId?: string,
    period: "daily" | "weekly" | "total" = "daily"
  ): Promise<LeaderboardResponse> {
    try {
      console.log(`💰 Classement AFK ${period} serveur ${serverId} (top ${limit})`);

      // Récupérer les états AFK avec infos joueur
      const afkStates = await AfkState.find({})
        .populate("playerId", "username level serverId")
        .lean();

      // Filtrer par serveur et calculer le score selon la période
      const relevantStates = afkStates
        .filter(state => {
          const player = state.playerId as any;
          return player && player.serverId === serverId;
        })
        .map(state => {
          const player = state.playerId as any;
          let score = 0;

          switch (period) {
            case "daily":
              score = state.todayAccruedGold || 0;
              break;
            case "weekly":
              // Approximation basée sur le taux quotidien
              score = (state.todayAccruedGold || 0) * 7;
              break;
            case "total":
              // Utiliser approximation mensuelle
              score = (state.todayAccruedGold || 0) * 30;
              break;
          }

          return {
            playerId: player._id.toString(),
            playerName: player.username,
            score,
            goldPerMinute: state.baseGoldPerMinute,
            todayGold: state.todayAccruedGold || 0,
            level: player.level,
            lastTick: state.lastTickAt
          };
        });

      // Trier par score
      relevantStates.sort((a, b) => b.score - a.score);

      // Créer le classement
      const leaderboard: LeaderboardEntry[] = relevantStates
        .slice(0, limit)
        .map((player, index) => ({
          rank: index + 1,
          playerId: player.playerId,
          playerName: player.playerName,
          serverId,
          value: player.score,
          level: player.level,
          additionalData: {
            goldPerMinute: player.goldPerMinute,
            todayGold: player.todayGold,
            period,
            lastTick: player.lastTick
          }
        }));

      // Rang du joueur spécifique
      let playerRank = undefined;
      if (playerId) {
        const playerIndex = relevantStates.findIndex(p => p.playerId === playerId);
        if (playerIndex !== -1) {
          playerRank = {
            rank: playerIndex + 1,
            value: relevantStates[playerIndex].score,
            percentile: Math.round(((relevantStates.length - playerIndex) / relevantStates.length) * 100)
          };
        }
      }

      return {
        success: true,
        leaderboard,
        playerRank,
        meta: {
          type: `afk-${period}`,
          serverId,
          totalPlayers: relevantStates.length,
          lastUpdate: new Date(),
          updateFrequency: period === "daily" ? "hourly" : "daily"
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getAfkLeaderboard:", error);
      throw error;
    }
  }

  // === CLASSEMENT PAR NIVEAU JOUEUR ===
  public static async getLevelLeaderboard(
    serverId: string,
    limit: number = 50,
    playerId?: string
  ): Promise<LeaderboardResponse> {
    try {
      const players = await Player.find({ serverId })
        .select("username level world lastSeenAt createdAt")
        .sort({ level: -1, world: -1 })
        .limit(limit)
        .lean();

      if (players.length === 0) {
        return this.createEmptyLeaderboard("level", serverId);
      }

      const leaderboard: LeaderboardEntry[] = players.map((player, index) => ({
        rank: index + 1,
        playerId: player._id.toString(),
        playerName: player.username,
        serverId,
        value: player.level,
        level: player.level,
        additionalData: {
          world: player.world,
          accountAge: Math.floor((Date.now() - ((player as any).createdAt?.getTime() || Date.now())) / (1000 * 60 * 60 * 24)),
          lastSeen: player.lastSeenAt
        }
      }));

      // Rang du joueur spécifique
      let playerRank = undefined;
      if (playerId) {
        const allPlayers = await Player.find({ serverId }).sort({ level: -1, world: -1 });
        const playerIndex = allPlayers.findIndex((p: any) => p._id.toString() === playerId);
        if (playerIndex !== -1) {
          playerRank = {
            rank: playerIndex + 1,
            value: allPlayers[playerIndex].level,
            percentile: Math.round(((allPlayers.length - playerIndex) / allPlayers.length) * 100)
          };
        }
      }

      return {
        success: true,
        leaderboard,
        playerRank,
        meta: {
          type: "level",
          serverId,
          totalPlayers: await Player.countDocuments({ serverId }),
          lastUpdate: new Date(),
          updateFrequency: "real-time"
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getLevelLeaderboard:", error);
      throw error;
    }
  }

  // === CLASSEMENT MULTI-SERVEURS (GLOBAL) ===
  public static async getGlobalLeaderboard(
    type: "power" | "tower" | "level",
    limit: number = 100
  ): Promise<LeaderboardResponse> {
    try {
      console.log(`🌍 Classement global ${type} (top ${limit})`);

      switch (type) {
        case "power":
          return await this.getGlobalPowerLeaderboard(limit);
        case "tower":
          return await this.getGlobalTowerLeaderboard(limit);
        case "level":
          return await this.getGlobalLevelLeaderboard(limit);
        default:
          throw new Error(`Unsupported global leaderboard type: ${type}`);
      }

    } catch (error: any) {
      console.error("❌ Erreur getGlobalLeaderboard:", error);
      throw error;
    }
  }

  // === RÉSUMÉ RAPIDE DES CLASSEMENTS POUR UN JOUEUR ===
  public static async getPlayerRankingSummary(playerId: string, serverId: string) {
    try {
      console.log(`📊 Résumé classements pour ${playerId} sur ${serverId}`);

      const [powerRank, towerRank, campaignRank, levelRank] = await Promise.all([
        this.getPowerLeaderboard(serverId, 1, playerId).then(r => r.playerRank),
        this.getTowerLeaderboard(serverId, 1, playerId).then(r => r.playerRank),
        this.getCampaignLeaderboard(serverId, 1, playerId).then(r => r.playerRank),
        this.getLevelLeaderboard(serverId, 1, playerId).then(r => r.playerRank)
      ]);

      return {
        success: true,
        playerId,
        serverId,
        rankings: {
          power: powerRank || { rank: 0, value: 0, percentile: 0 },
          tower: towerRank || { rank: 0, value: 0, percentile: 0 },
          campaign: campaignRank || { rank: 0, value: 0, percentile: 0 },
          level: levelRank || { rank: 0, value: 0, percentile: 0 }
        },
        summary: {
          bestRank: Math.min(
            powerRank?.rank || Infinity,
            towerRank?.rank || Infinity,
            campaignRank?.rank || Infinity,
            levelRank?.rank || Infinity
          ),
          averagePercentile: Math.round(
            ((powerRank?.percentile || 0) + 
             (towerRank?.percentile || 0) + 
             (campaignRank?.percentile || 0) + 
             (levelRank?.percentile || 0)) / 4
          )
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerRankingSummary:", error);
      throw error;
    }
  }

  // === MÉTHODES PRIVÉES ===

  // Calculer la puissance totale d'un joueur
  private static async calculatePlayerPower(player: any): Promise<PowerCalculation> {
    let totalPower = 0;
    let heroesPower = 0;
    let heroCount = 0;
    let totalLevel = 0;
    let totalStars = 0;
    let equippedHeroes = 0;

    for (const heroInstance of player.heroes) {
      const heroData = heroInstance.heroId;
      if (!heroData || !heroData.baseStats) continue;

      heroCount++;
      totalLevel += heroInstance.level;
      totalStars += heroInstance.stars;
      if (heroInstance.equipped) equippedHeroes++;

      // Calcul de puissance par héros (même formule que BattleService)
      const levelMultiplier = 1 + (heroInstance.level - 1) * 0.08;
      const starMultiplier = 1 + (heroInstance.stars - 1) * 0.15;
      const totalMultiplier = levelMultiplier * starMultiplier;

      const heroPower = Math.floor(
        (heroData.baseStats.atk * 1.0 + 
         heroData.baseStats.def * 2.0 + 
         heroData.baseStats.hp / 10) * totalMultiplier
      );

      heroesPower += heroPower;
    }

    // Bonus niveau joueur
    const levelPower = player.level * 50;
    
    // TODO: Ajouter equipmentPower quand le système d'équipement sera implémenté
    const equipmentPower = 0;

    totalPower = heroesPower + levelPower + equipmentPower;

    return {
      totalPower,
      heroesPower,
      equipmentPower,
      levelPower,
      breakdown: {
        heroCount,
        avgHeroLevel: heroCount > 0 ? Math.round(totalLevel / heroCount) : 0,
        avgHeroStars: heroCount > 0 ? Math.round((totalStars / heroCount) * 10) / 10 : 0,
        equippedHeroes
      }
    };
  }

  // Créer un classement vide
  private static createEmptyLeaderboard(type: string, serverId: string): LeaderboardResponse {
    return {
      success: true,
      leaderboard: [],
      meta: {
        type,
        serverId,
        totalPlayers: 0,
        lastUpdate: new Date(),
        updateFrequency: "real-time"
      }
    };
  }

  // Classement global puissance
  private static async getGlobalPowerLeaderboard(limit: number): Promise<LeaderboardResponse> {
    const players = await Player.find({})
      .populate("heroes.heroId")
      .select("username level serverId heroes")
      .lean();

    const playerPowers = await Promise.all(
      players.map(async (player) => {
        const powerCalc = await this.calculatePlayerPower(player);
        return {
          playerId: player._id.toString(),
          playerName: player.displayName,
          serverId: player.serverId,
          power: powerCalc.totalPower,
          level: player.level
        };
      })
    );

    playerPowers.sort((a, b) => b.power - a.power);

    const leaderboard: LeaderboardEntry[] = playerPowers
      .slice(0, limit)
      .map((player, index) => ({
        rank: index + 1,
        playerId: player.playerId,
        playerName: player.playerName,
        serverId: player.serverId,
        value: player.power,
        level: player.level
      }));

    return {
      success: true,
      leaderboard,
      meta: {
        type: "global-power",
        serverId: "ALL",
        totalPlayers: playerPowers.length,
        lastUpdate: new Date(),
        updateFrequency: "daily"
      }
    };
  }

  // Classement global tour
  private static async getGlobalTowerLeaderboard(limit: number): Promise<LeaderboardResponse> {
    const towerProgresses = await TowerProgress.find({})
      .populate("playerId", "username level serverId")
      .sort({ highestFloor: -1, totalClears: -1 })
      .limit(limit)
      .lean();

    const leaderboard: LeaderboardEntry[] = towerProgresses
      .filter(progress => progress.playerId)
      .map((progress, index) => {
        const player = progress.playerId as any;
        return {
          rank: index + 1,
          playerId: player._id.toString(),
          playerName: player.displayName,
          serverId: player.serverId,
          value: progress.highestFloor,
          level: player.level,
          additionalData: {
            totalClears: progress.totalClears
          }
        };
      });

    return {
      success: true,
      leaderboard,
      meta: {
        type: "global-tower",
        serverId: "ALL",
        totalPlayers: leaderboard.length,
        lastUpdate: new Date(),
        updateFrequency: "real-time"
      }
    };
  }

  // Classement global niveau
  private static async getGlobalLevelLeaderboard(limit: number): Promise<LeaderboardResponse> {
    const players = await Player.find({})
      .select("username level serverId world")
      .sort({ level: -1, world: -1 })
      .limit(limit)
      .lean();

    const leaderboard: LeaderboardEntry[] = players.map((player, index) => ({
      rank: index + 1,
      playerId: player._id.toString(),
      playerName: player.username,
      serverId: player.serverId,
      value: player.level,
      level: player.level,
      additionalData: {
        world: player.world
      }
    }));

    return {
      success: true,
      leaderboard,
      meta: {
        type: "global-level",
        serverId: "ALL",
        totalPlayers: leaderboard.length,
        lastUpdate: new Date(),
        updateFrequency: "real-time"
      }
    };
  }

  // === MÉTHODES D'ADMINISTRATION ===

  // Précomputer les classements (pour optimisation)
  public static async precomputeLeaderboards(serverId: string) {
    try {
      console.log(`🔄 Précomputation classements serveur ${serverId}...`);

      const [power, tower, campaign, level] = await Promise.all([
        this.getPowerLeaderboard(serverId, 100),
        this.getTowerLeaderboard(serverId, 100),
        this.getCampaignLeaderboard(serverId, 100),
        this.getLevelLeaderboard(serverId, 100)
      ]);

      // TODO: Sauvegarder en cache/Redis pour accès rapide

      return {
        success: true,
        serverId,
        computed: {
          power: power.leaderboard.length,
          tower: tower.leaderboard.length,
          campaign: campaign.leaderboard.length,
          level: level.leaderboard.length
        },
        computedAt: new Date()
      };

    } catch (error: any) {
      console.error("❌ Erreur precomputeLeaderboards:", error);
      throw error;
    }
  }

  // Statistiques des classements
  public static async getLeaderboardStats(serverId: string) {
    try {
      const [
        totalPlayers,
        activePlayers,
        towerPlayers,
        avgPower
      ] = await Promise.all([
        Player.countDocuments({ serverId }),
        Player.countDocuments({ 
          serverId, 
          lastSeenAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        }),
        TowerProgress.countDocuments({ serverId }),
        Player.aggregate([
          { $match: { serverId } },
          { $group: { _id: null, avgLevel: { $avg: "$level" } } }
        ])
      ]);

      return {
        success: true,
        serverId,
        stats: {
          totalPlayers,
          activePlayers,
          towerPlayers,
          averageLevel: Math.round(avgPower[0]?.avgLevel || 0),
          activityRate: totalPlayers > 0 ? Math.round((activePlayers / totalPlayers) * 100) : 0,
          towerParticipation: totalPlayers > 0 ? Math.round((towerPlayers / totalPlayers) * 100) : 0
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getLeaderboardStats:", error);
      throw error;
    }
  }
}

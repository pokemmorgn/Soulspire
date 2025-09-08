// server/src/services/ArenaService.ts

import Player from "../models/Player";
import { ArenaPlayer, ArenaMatch, ArenaSeason } from "../models/Arena";
import { BattleService } from "./BattleService";
import { LeaderboardService } from "./LeaderboardService";
import { NotificationService } from "./NotificationService";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { IBattleOptions } from "./BattleEngine";
import {
  ArenaLeague,
  ArenaMatchType,
  ArenaSeasonStatus,
  IArenaPlayer,
  IArenaMatch,
  IArenaOpponent,
  IArenaFormation,
  IArenaPlayerStats,
  IArenaLeaderboard,
  ArenaServiceResponse,
  ArenaMatchResponse,
  ArenaOpponentsResponse,
  ArenaLeaderboardResponse,
  ArenaStatsResponse,
  IArenaOpponentSearch,
  IArenaConfig
} from "../types/ArenaTypes";

/**
 * SERVICE PRINCIPAL D'ARÈNE PVP
 * Système complet inspiré d'AFK Arena avec ligues, saisons, et récompenses
 */
export class ArenaService {

  // ===== CONFIGURATION GLOBALE =====
  
  private static readonly CONFIG: IArenaConfig = {
    pointCalculation: {
      basePointsPerWin: 25,
      basePointsPerLoss: -15,
      rankDifferenceMultiplier: 0.1,
      leagueBonusMultiplier: 1.2
    },
    cooldowns: {
      betweenMatches: 300,        // 5 minutes entre combats
      revengeWindow: 24,          // 24h pour se venger
      dailyRewardClaim: 24        // 24h entre réclamations
    },
    seasonDuration: 30,           // 30 jours par saison
    preSeasonDuration: 3,         // 3 jours de préparation
    opponentSearch: {
      maxRankDifference: 100,     // Différence de rang max
      maxPowerDifference: 0.3,    // 30% de différence de puissance
      searchRadius: 10,           // 10 adversaires retournés
      excludeRecentHours: 2       // 2h avant de revoir le même adversaire
    }
  };

  // ===== GESTION DES JOUEURS D'ARÈNE =====

  /**
   * Initialiser un joueur dans l'arène
   */
  public static async initializePlayer(playerId: string, serverId: string): Promise<ArenaServiceResponse<IArenaPlayer>> {
    try {
      console.log(`🏟️ Initialisation arène pour ${playerId} sur ${serverId}`);

      // Vérifier si le joueur existe déjà
      let arenaPlayer = await ArenaPlayer.findByPlayer(playerId, serverId);
      if (arenaPlayer) {
        return {
          success: true,
          data: arenaPlayer.toObject(),
          message: "Player already initialized in arena"
        };
      }

      // Récupérer les données du joueur
      const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      // Obtenir la saison actuelle
      const currentSeason = await this.getCurrentSeason(serverId);
      if (!currentSeason) {
        throw new Error("No active arena season");
      }

      // Créer la formation défensive initiale
      const defensiveFormation = await this.createInitialFormation(player);
      if (!defensiveFormation) {
        throw new Error("Cannot create initial formation - no equipped heroes");
      }

      // Créer le joueur d'arène
      arenaPlayer = new ArenaPlayer({
        playerId,
        serverId,
        seasonId: currentSeason.seasonId,
        currentLeague: ArenaLeague.BRONZE,
        arenaPoints: 0,
        currentRank: 999999,
        defensiveFormation,
        offensiveFormations: [defensiveFormation], // Formation initiale dupliquée
        dailyMatchesUsed: 0,
        lastMatchAt: new Date(),
        lastRewardClaimedAt: new Date(),
        unclaimedDailyRewards: true
      });

      await arenaPlayer.save();

      // Ajouter le participant à la saison
      await currentSeason.addParticipant(playerId);

      // Calculer le rang initial
      await this.updatePlayerRanking(serverId);

      console.log(`✅ Joueur ${playerId} initialisé en arène (Ligue: ${arenaPlayer.currentLeague})`);

      // Notification de bienvenue
      await NotificationService.notifyFeatureUnlock(playerId, serverId, "arena");

      return {
        success: true,
        data: arenaPlayer.toObject(),
        message: "Player successfully initialized in arena",
        meta: {
          timestamp: new Date(),
          serverId,
          seasonId: currentSeason.seasonId
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur initializePlayer:", error);
      return {
        success: false,
        error: error.message,
        meta: {
          timestamp: new Date(),
          serverId
        }
      };
    }
  }

  /**
   * Obtenir les statistiques d'un joueur
   */
  public static async getPlayerStats(playerId: string, serverId: string): Promise<ArenaStatsResponse> {
    try {
      const arenaPlayer = await ArenaPlayer.findByPlayer(playerId, serverId);
      if (!arenaPlayer) {
        return {
          success: false,
          error: "Player not found in arena"
        };
      }

      const stats = arenaPlayer.getStats();
      
      // Ajouter des statistiques supplémentaires
      const recentMatches = await ArenaMatch.getPlayerHistory(playerId, serverId, 5);
      const seasonData = await ArenaSeason.getCurrentSeason(serverId);

      const enrichedStats: IArenaPlayerStats = {
        ...stats,
        totalSeasons: await this.getPlayerSeasonCount(playerId, serverId),
        bestRankEver: arenaPlayer.highestRank,
        bestLeagueEver: await this.getPlayerBestLeague(playerId, serverId),
        formationsCount: arenaPlayer.offensiveFormations.length,
        lastMatchAt: arenaPlayer.lastMatchAt,
        averageMatchDuration: await this.getPlayerAverageMatchDuration(playerId, serverId)
      };

      return {
        success: true,
        data: enrichedStats,
        meta: {
          timestamp: new Date(),
          serverId,
          seasonId: seasonData?.seasonId
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerStats:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===== RECHERCHE D'ADVERSAIRES =====

  /**
   * Trouver des adversaires pour un joueur
   */
  public static async findOpponents(
    playerId: string, 
    serverId: string,
    options: Partial<IArenaOpponentSearch> = {}
  ): Promise<ArenaOpponentsResponse> {
    try {
      console.log(`🎯 Recherche adversaires pour ${playerId} sur ${serverId}`);

      const arenaPlayer = await ArenaPlayer.findByPlayer(playerId, serverId);
      if (!arenaPlayer) {
        throw new Error("Player not found in arena");
      }

      // Vérifier si le joueur peut combattre
      const canFight = arenaPlayer.canStartMatch();
      if (!canFight.allowed) {
        return {
          success: false,
          error: canFight.reason,
          data: {
            opponents: [],
            searchCriteria: {
              playerId,
              serverId,
              filters: options.filters || {},
              limit: options.limit || 10
            },
            playerInfo: {
              currentRank: arenaPlayer.currentRank,
              currentPoints: arenaPlayer.arenaPoints,
              dailyMatchesRemaining: arenaPlayer.getMaxDailyMatches() - arenaPlayer.dailyMatchesUsed
            }
          }
        };
      }

      // Configuration de recherche
      const searchConfig = {
        playerId,
        serverId,
        filters: {
          league: options.filters?.league || arenaPlayer.currentLeague,
          minPower: options.filters?.minPower,
          maxPower: options.filters?.maxPower,
          difficulty: options.filters?.difficulty,
          excludeRecent: options.filters?.excludeRecent ?? true,
          onlineOnly: options.filters?.onlineOnly ?? false
        },
        limit: Math.min(options.limit || 10, 20)
      };

      // Rechercher les adversaires potentiels
      const potentialOpponents = await this.searchPotentialOpponents(arenaPlayer, searchConfig);
      
      // Filtrer et enrichir les adversaires
      const opponents: IArenaOpponent[] = [];
      
      for (const opponent of potentialOpponents) {
        if (opponents.length >= searchConfig.limit) break;

        const opponentData = await this.enrichOpponentData(arenaPlayer, opponent);
        if (opponentData && this.isValidOpponent(arenaPlayer, opponentData, searchConfig)) {
          opponents.push(opponentData);
        }
      }

      // Trier par difficulté recommandée
      opponents.sort((a, b) => {
        const difficultyOrder = { "easy": 1, "medium": 2, "hard": 3 };
        return difficultyOrder[a.estimatedDifficulty] - difficultyOrder[b.estimatedDifficulty];
      });

      console.log(`✅ ${opponents.length} adversaires trouvés pour ${playerId}`);

      return {
        success: true,
        data: {
          opponents,
          searchCriteria: searchConfig,
          playerInfo: {
            currentRank: arenaPlayer.currentRank,
            currentPoints: arenaPlayer.arenaPoints,
            dailyMatchesRemaining: arenaPlayer.getMaxDailyMatches() - arenaPlayer.dailyMatchesUsed
          }
        },
        meta: {
          timestamp: new Date(),
          serverId
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur findOpponents:", error);
      return {
        success: false,
        error: error.message,
        data: {
          opponents: [],
          searchCriteria: {
            playerId,
            serverId,
            filters: {},
            limit: 10
          },
          playerInfo: {
            currentRank: 999999,
            currentPoints: 0,
            dailyMatchesRemaining: 0
          }
        }
      };
    }
  }

  // ===== SYSTÈME DE COMBAT =====

  /**
   * Démarrer un combat d'arène
   */
  public static async startMatch(
    attackerId: string,
    serverId: string,
    defenderId: string,
    matchType: ArenaMatchType = ArenaMatchType.RANKED,
    battleOptions: IBattleOptions = { mode: "auto", speed: 1 }
  ): Promise<ArenaMatchResponse> {
    try {
      console.log(`⚔️ Combat d'arène: ${attackerId} vs ${defenderId} (${matchType})`);

      // Validation des participants
      const [attacker, defender] = await Promise.all([
        ArenaPlayer.findByPlayer(attackerId, serverId),
        ArenaPlayer.findByPlayer(defenderId, serverId)
      ]);

      if (!attacker || !defender) {
        throw new Error("One or both players not found in arena");
      }

      // Vérifications pré-combat
      const validation = await this.validateMatch(attacker, defender, matchType);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Obtenir la saison actuelle
      const currentSeason = await this.getCurrentSeason(serverId);
      if (!currentSeason) {
        throw new Error("No active arena season");
      }

      // Préparer les données du match
      const attackerData = await this.prepareMatchPlayerData(attacker);
      const defenderData = await this.prepareMatchPlayerData(defender);

      // Exécuter le combat via BattleService
      const battleResult = await BattleService.startArenaBattle(
        attackerId,
        serverId,
        defenderId,
        battleOptions
      );

      // Calculer l'échange de points
      const pointsExchange = this.calculatePointsExchange(
        attacker,
        defender,
        battleResult.result.victory
      );

      // Calculer les récompenses
      const rewards = this.calculateMatchRewards(
        attacker,
        defender,
        battleResult.result.victory,
        pointsExchange
      );

      // Créer l'enregistrement du match
      const arenaMatch = new ArenaMatch({
        serverId,
        seasonId: currentSeason.seasonId,
        attackerId,
        defenderId,
        attackerData,
        defenderData,
        matchType,
        battleId: battleResult.battleId,
        battleResult: battleResult.result,
        pointsExchanged: pointsExchange.pointsGained,
        attackerPointsBefore: attacker.arenaPoints,
        attackerPointsAfter: attacker.arenaPoints + pointsExchange.pointsGained,
        defenderPointsBefore: defender.arenaPoints,
        defenderPointsAfter: defender.arenaPoints + pointsExchange.pointsLost,
        rewards,
        duration: battleResult.result.battleDuration,
        isRevenge: matchType === ArenaMatchType.REVENGE
      });

      await arenaMatch.save();

      // Appliquer les résultats aux joueurs
      await this.applyMatchResults(attacker, defender, arenaMatch, battleResult.result.victory);

      // Mettre à jour les classements
      await this.updatePlayerRanking(serverId);

      // Enregistrer le match dans la saison
      await currentSeason.recordMatch(arenaMatch.matchId);

      // Vérifier les promotions/relégations
      const promotionInfo = await this.checkPromotion(attacker);

      // Missions et événements
      await Promise.all([
        MissionService.updateProgress(attackerId, serverId, "arena_wins", battleResult.result.victory ? 1 : 0),
        EventService.updatePlayerProgress(attackerId, serverId, "arena_matches", 1),
        this.sendMatchNotifications(attacker, defender, battleResult.result.victory, promotionInfo)
      ]);

      console.log(`✅ Combat terminé: ${battleResult.result.victory ? "Victoire" : "Défaite"} (${pointsExchange.pointsGained} pts)`);

      return {
        success: true,
        data: {
          match: arenaMatch.toObject(),
          newRank: attacker.currentRank,
          newPoints: attacker.arenaPoints,
          newLeague: attacker.currentLeague,
          rewards,
          promotionInfo
        },
        message: `Arena match completed - ${battleResult.result.victory ? "Victory" : "Defeat"}`,
        meta: {
          timestamp: new Date(),
          serverId,
          seasonId: currentSeason.seasonId
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur startMatch:", error);
      return {
        success: false,
        error: error.message,
        data: {
          match: {} as any,
          newRank: 0,
          newPoints: 0,
          newLeague: ArenaLeague.BRONZE,
          rewards: {} as any
        }
      };
    }
  }

  // ===== CLASSEMENTS ET LEADERBOARDS =====

  /**
   * Obtenir le classement d'une ligue
   */
  public static async getLeaderboard(
    serverId: string,
    league?: ArenaLeague,
    limit: number = 50
  ): Promise<ArenaLeaderboardResponse> {
    try {
      console.log(`🏆 Récupération classement ${league || "global"} pour ${serverId}`);

      const currentSeason = await this.getCurrentSeason(serverId);
      if (!currentSeason) {
        throw new Error("No active arena season");
      }

      const query: any = { serverId };
      if (league) {
        query.currentLeague = league;
      }

      const arenaPlayers = await ArenaPlayer.find(query)
        .sort({ arenaPoints: -1, seasonWins: -1, currentRank: 1 })
        .limit(limit)
        .populate('playerId', 'displayName level lastSeenAt')
        .lean();

      const rankings = arenaPlayers.map((player, index) => {
        const playerData = player.playerId as any;
        return {
          rank: index + 1,
          playerId: player.playerId,
          playerName: playerData.displayName,
          level: playerData.level,
          arenaPoints: player.arenaPoints,
          wins: player.seasonWins,
          losses: player.seasonLosses,
          winRate: player.seasonWins + player.seasonLosses > 0 
            ? Math.round((player.seasonWins / (player.seasonWins + player.seasonLosses)) * 100)
            : 0,
          winStreak: player.seasonWinStreak,
          defensivePower: player.defensiveFormation.totalPower,
          lastMatchAt: player.lastMatchAt
        };
      });

      const leaderboard: IArenaLeaderboard = {
        serverId,
        league: league || ArenaLeague.BRONZE,
        seasonId: currentSeason.seasonId,
        rankings,
        totalPlayers: await ArenaPlayer.countDocuments(query),
        lastUpdated: new Date()
      };

      return {
        success: true,
        data: leaderboard,
        meta: {
          timestamp: new Date(),
          serverId,
          seasonId: currentSeason.seasonId
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getLeaderboard:", error);
      return {
        success: false,
        error: error.message,
        data: {
          serverId,
          league: league || ArenaLeague.BRONZE,
          seasonId: "",
          rankings: [],
          totalPlayers: 0,
          lastUpdated: new Date()
        }
      };
    }
  }

  // ===== GESTION DES SAISONS =====

  /**
   * Obtenir la saison actuelle
   */
  public static async getCurrentSeason(serverId: string) {
    try {
      let currentSeason = await ArenaSeason.getCurrentSeason(serverId);
      
      if (!currentSeason) {
        console.log(`🆕 Création nouvelle saison pour ${serverId}`);
        currentSeason = await this.createNewSeason(serverId);
      }

      // Vérifier si la saison doit se terminer
      if (currentSeason.daysRemaining() <= 0) {
        console.log(`🔚 Fin de saison ${currentSeason.seasonNumber} pour ${serverId}`);
        await this.endSeason(currentSeason);
        currentSeason = await this.createNewSeason(serverId);
      }

      return currentSeason;

    } catch (error: any) {
      console.error("❌ Erreur getCurrentSeason:", error);
      return null;
    }
  }

  /**
   * Créer une nouvelle saison
   */
  private static async createNewSeason(serverId: string) {
    const previousSeasons = await ArenaSeason.find({ serverId }).sort({ seasonNumber: -1 }).limit(1);
    const newSeasonNumber = previousSeasons.length > 0 ? previousSeasons[0].seasonNumber + 1 : 1;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + this.CONFIG.seasonDuration);

    const newSeason = new ArenaSeason({
      serverId,
      seasonNumber: newSeasonNumber,
      startDate,
      endDate,
      status: ArenaSeasonStatus.ACTIVE,
      seasonTheme: `Season ${newSeasonNumber}: Arena Legends`,
      totalParticipants: 0,
      totalMatches: 0
    });

    await newSeason.save();
    console.log(`✅ Nouvelle saison ${newSeasonNumber} créée pour ${serverId}`);

    return newSeason;
  }

  /**
   * Terminer une saison
   */
  private static async endSeason(season: any) {
    try {
      console.log(`🏁 Fin de saison ${season.seasonNumber} sur ${season.serverId}`);

      // Marquer la saison comme terminée
      season.status = ArenaSeasonStatus.ENDED;
      
      // Générer les classements finaux
      const finalRankings = await this.generateSeasonFinalRankings(season.serverId, season.seasonId);
      season.finalRankings = finalRankings;
      
      await season.save();

      // Distribuer les récompenses de fin de saison
      await this.distributeSeasonEndRewards(season.serverId, season, finalRankings);

      // Réinitialiser les données saisonnières des joueurs
      await this.resetPlayerSeasonData(season.serverId);

      console.log(`✅ Saison ${season.seasonNumber} terminée avec ${finalRankings.length} participants`);

    } catch (error) {
      console.error("❌ Erreur endSeason:", error);
    }
  }

  // ===== MÉTHODES UTILITAIRES PRIVÉES =====

  /**
   * Créer la formation initiale d'un joueur
   */
  private static async createInitialFormation(player: any): Promise<IArenaFormation | null> {
    const equippedHeroes = player.heroes.filter((h: any) => h.equipped);
    if (equippedHeroes.length === 0) {
      return null;
    }

    let totalPower = 0;
    const heroSlots = equippedHeroes.map((hero: any, index: number) => {
      const heroPower = this.calculateHeroPower(hero);
      totalPower += heroPower;
      
      return {
        slot: index + 1,
        heroId: hero.heroId._id || hero.heroId,
        level: hero.level,
        stars: hero.stars,
        power: heroPower
      };
    });

    return {
      formationId: `formation_${Date.now()}`,
      name: "Default Formation",
      heroSlots,
      totalPower,
      isActive: true,
      lastUsedAt: new Date(),
      createdAt: new Date()
    };
  }

  /**
   * Calculer la puissance d'un héros
   */
  private static calculateHeroPower(hero: any): number {
    const heroData = hero.heroId;
    if (!heroData || !heroData.baseStats) return 0;

    const levelMultiplier = 1 + (hero.level - 1) * 0.08;
    const starMultiplier = 1 + (hero.stars - 1) * 0.15;
    const totalMultiplier = levelMultiplier * starMultiplier;

    return Math.floor(
      (heroData.baseStats.atk * 1.0 + 
       heroData.baseStats.def * 2.0 + 
       heroData.baseStats.hp / 10) * totalMultiplier
    );
  }

  /**
   * Rechercher les adversaires potentiels
   */
  private static async searchPotentialOpponents(arenaPlayer: any, searchConfig: any) {
    const query: any = {
      serverId: searchConfig.serverId,
      playerId: { $ne: searchConfig.playerId }
    };

    // Filtrer par ligue si spécifié
    if (searchConfig.filters.league) {
      query.currentLeague = searchConfig.filters.league;
    }

    // Exclure les adversaires récents si demandé
    if (searchConfig.filters.excludeRecent) {
      const recentThreshold = new Date();
      recentThreshold.setHours(recentThreshold.getHours() - this.CONFIG.opponentSearch.excludeRecentHours);
      
      const recentMatches = await ArenaMatch.find({
        serverId: searchConfig.serverId,
        $or: [
          { attackerId: searchConfig.playerId },
          { defenderId: searchConfig.playerId }
        ],
        createdAt: { $gte: recentThreshold }
      }).select('attackerId defenderId');

      const recentOpponentIds = recentMatches.map(match => 
        match.attackerId === searchConfig.playerId ? match.defenderId : match.attackerId
      );

      if (recentOpponentIds.length > 0) {
        query.playerId = { $nin: [...recentOpponentIds, searchConfig.playerId] };
      }
    }

    return ArenaPlayer.find(query)
      .populate('playerId', 'displayName level lastSeenAt')
      .sort({ arenaPoints: -1 })
      .limit(searchConfig.limit * 2); // Prendre plus pour filtrer ensuite
  }

  /**
   * Enrichir les données d'un adversaire
   */
  private static async enrichOpponentData(attacker: any, opponent: any): Promise<IArenaOpponent | null> {
    try {
      const playerData = opponent.playerId;
      if (!playerData) return null;

      const winRate = opponent.totalWins + opponent.totalLosses > 0
        ? (opponent.totalWins / (opponent.totalWins + opponent.totalLosses)) * 100
        : 0;

      // Calculer la difficulté estimée
      const powerDifference = (opponent.defensiveFormation.totalPower - attacker.defensiveFormation.totalPower) / attacker.defensiveFormation.totalPower;
      let estimatedDifficulty: "easy" | "medium" | "hard";
      
      if (powerDifference < -0.2) estimatedDifficulty = "easy";
      else if (powerDifference > 0.2) estimatedDifficulty = "hard";
      else estimatedDifficulty = "medium";

      // Calculer les points potentiels
      const pointsCalculation = this.calculatePointsExchange(attacker, opponent, true);

      const isOnline = playerData.lastSeenAt 
        ? (Date.now() - playerData.lastSeenAt.getTime()) < (15 * 60 * 1000) // 15 minutes
        : false;

      return {
        playerId: opponent.playerId,
        playerName: playerData.displayName,
        level: playerData.level,
        league: opponent.currentLeague,
        arenaPoints: opponent.arenaPoints,
        rank: opponent.currentRank,
        defensiveFormation: opponent.defensiveFormation,
        winRate: Math.round(winRate),
        lastSeenAt: playerData.lastSeenAt || new Date(),
        isOnline,
        canAttack: true,
        estimatedDifficulty,
        pointsGainOnWin: pointsCalculation.pointsGained,
        pointsLostOnDefeat: Math.abs(pointsCalculation.pointsLost)
      };

    } catch (error) {
      console.error("❌ Erreur enrichOpponentData:", error);
      return null;
    }
  }

  /**
   * Valider si un adversaire est valide
   */
  private static isValidOpponent(attacker: any, opponent: IArenaOpponent, searchConfig: any): boolean {
    // Vérifier la différence de puissance si spécifiée
    if (searchConfig.filters.minPower && opponent.defensiveFormation.totalPower < searchConfig.filters.minPower) {
      return false;
    }
    
    if (searchConfig.filters.maxPower && opponent.defensiveFormation.totalPower > searchConfig.filters.maxPower) {
      return false;
    }

    // Vérifier si en ligne seulement si demandé
    if (searchConfig.filters.onlineOnly && !opponent.isOnline) {
      return false;
    }

    // Vérifier la difficulté si spécifiée
    if (searchConfig.filters.difficulty && opponent.estimatedDifficulty !== searchConfig.filters.difficulty) {
      return false;
    }

    return true;
  }

  /**
   * Calculer l'échange de points entre deux joueurs
   */
  private static calculatePointsExchange(attacker: any, defender: any, attackerWon: boolean) {
    const config = this.CONFIG.pointCalculation;
    
    // Points de base selon le résultat
    let pointsGained = attackerWon ? config.basePointsPerWin : config.basePointsPerLoss;
    let pointsLost = attackerWon ? config.basePointsPerLoss : config.basePointsPerWin;

    // Modificateur basé sur la différence de rang
    const rankDifference = defender.currentRank - attacker.currentRank;
    const rankMultiplier = 1 + (rankDifference * config.rankDifferenceMultiplier / 100);

    // Modificateur basé sur la ligue
    const leagueMultiplier = this.getLeagueMultiplier(attacker.currentLeague);

    // Appliquer les multiplicateurs
    pointsGained = Math.round(pointsGained * rankMultiplier * leagueMultiplier);
    pointsLost = Math.round(pointsLost * rankMultiplier * leagueMultiplier);

    // Assurer des valeurs minimales/maximales
    pointsGained = Math.max(1, Math.min(100, pointsGained));
    pointsLost = Math.max(-50, Math.min(-1, pointsLost));

    return { pointsGained, pointsLost };
  }

  /**
   * Obtenir le multiplicateur de ligue
   */
  private static getLeagueMultiplier(league: ArenaLeague): number {
    const multipliers = {
      [ArenaLeague.BRONZE]: 1.0,
      [ArenaLeague.SILVER]: 1.1,
      [ArenaLeague.GOLD]: 1.2,
      [ArenaLeague.DIAMOND]: 1.3,
      [ArenaLeague.MASTER]: 1.4,
      [ArenaLeague.LEGENDARY]: 1.5
    };
    return multipliers[league] || 1.0;
  }

  /**
   * Calculer les récompenses d'un match
   */
  private static calculateMatchRewards(attacker: any, defender: any, attackerWon: boolean, pointsExchange: any) {
    const baseRewards = {
      winner: {
        arenaPoints: pointsExchange.pointsGained,
        gold: 50,
        experience: 25,
        seasonTokens: 5,
        items: []
      },
      loser: {
        arenaPoints: pointsExchange.pointsLost,
        gold: 10,
        experience: 5,
        seasonTokens: 1
      }
    };

    // Bonus selon la ligue
    const leagueBonus = this.getLeagueRewardMultiplier(attacker.currentLeague);
    
    if (attackerWon) {
      baseRewards.winner.gold = Math.floor(baseRewards.winner.gold * leagueBonus);
      baseRewards.winner.experience = Math.floor(baseRewards.winner.experience * leagueBonus);
      baseRewards.winner.seasonTokens = Math.floor(baseRewards.winner.seasonTokens * leagueBonus);
    }

    return baseRewards;
  }

  /**
   * Obtenir le multiplicateur de récompenses par ligue
   */
  private static getLeagueRewardMultiplier(league: ArenaLeague): number {
    const multipliers = {
      [ArenaLeague.BRONZE]: 1.0,
      [ArenaLeague.SILVER]: 1.2,
      [ArenaLeague.GOLD]: 1.4,
      [ArenaLeague.DIAMOND]: 1.6,
      [ArenaLeague.MASTER]: 1.8,
      [ArenaLeague.LEGENDARY]: 2.0
    };
    return multipliers[league] || 1.0;
  }

  /**
   * Valider un match avant de le commencer
   */
  private static async validateMatch(attacker: any, defender: any, matchType: ArenaMatchType) {
    // Vérifier que l'attaquant peut combattre
    const canFight = attacker.canStartMatch();
    if (!canFight.allowed) {
      return { valid: false, error: canFight.reason };
    }

    // Vérifier que les joueurs ne sont pas les mêmes
    if (attacker.playerId === defender.playerId) {
      return { valid: false, error: "Cannot fight against yourself" };
    }

    // Vérifier les formations
    if (!attacker.defensiveFormation || !defender.defensiveFormation) {
      return { valid: false, error: "Players must have defensive formations" };
    }

    if (attacker.defensiveFormation.heroSlots.length === 0 || defender.defensiveFormation.heroSlots.length === 0) {
      return { valid: false, error: "Players must have heroes in their formations" };
    }

    // Validation spécifique pour les combats de vengeance
    if (matchType === ArenaMatchType.REVENGE) {
      const revengeWindow = this.CONFIG.cooldowns.revengeWindow * 60 * 60 * 1000; // Heures en millisecondes
      const recentLoss = await ArenaMatch.findOne({
        serverId: attacker.serverId,
        defenderId: attacker.playerId,
        attackerId: defender.playerId,
        'battleResult.victory': false,
        createdAt: { $gte: new Date(Date.now() - revengeWindow) }
      });

      if (!recentLoss) {
        return { valid: false, error: "No recent loss found for revenge" };
      }
    }

    return { valid: true };
  }

  /**
   * Préparer les données d'un joueur pour un match
   */
  private static async prepareMatchPlayerData(arenaPlayer: any) {
    const player = await Player.findOne({ _id: arenaPlayer.playerId, serverId: arenaPlayer.serverId });
    if (!player) {
      throw new Error("Player data not found");
    }

    return {
      playerId: arenaPlayer.playerId,
      playerName: player.displayName,
      level: player.level,
      league: arenaPlayer.currentLeague,
      arenaPoints: arenaPlayer.arenaPoints,
      rank: arenaPlayer.currentRank,
      formation: arenaPlayer.defensiveFormation,
      teamPower: arenaPlayer.defensiveFormation.totalPower
    };
  }

  /**
   * Appliquer les résultats d'un match aux joueurs
   */
  private static async applyMatchResults(attacker: any, defender: any, match: any, attackerWon: boolean) {
    // Mettre à jour l'attaquant
    await attacker.addPoints(match.rewards.winner.arenaPoints);
    attacker.dailyMatchesUsed += 1;
    attacker.lastMatchAt = new Date();
    attacker.totalMatches += 1;
    
    if (attackerWon) {
      attacker.seasonWins += 1;
      attacker.totalWins += 1;
      attacker.seasonWinStreak += 1;
      
      if (attacker.seasonWinStreak > attacker.seasonBestWinStreak) {
        attacker.seasonBestWinStreak = attacker.seasonWinStreak;
      }
    } else {
      attacker.seasonLosses += 1;
      attacker.totalLosses += 1;
      attacker.seasonWinStreak = 0;
    }

    await attacker.save();

    // Mettre à jour le défenseur
    await defender.addPoints(match.rewards.loser.arenaPoints);
    defender.totalMatches += 1;
    
    if (!attackerWon) {
      defender.seasonWins += 1;
      defender.totalWins += 1;
      defender.seasonWinStreak += 1;
      
      if (defender.seasonWinStreak > defender.seasonBestWinStreak) {
        defender.seasonBestWinStreak = defender.seasonWinStreak;
      }
    } else {
      defender.seasonLosses += 1;
      defender.totalLosses += 1;
      defender.seasonWinStreak = 0;
    }

    await defender.save();

    // Appliquer les récompenses au joueur principal
    const playerToReward = await Player.findOne({ 
      _id: attacker.playerId, 
      serverId: attacker.serverId 
    });
    
    if (playerToReward) {
      const rewards = attackerWon ? match.rewards.winner : match.rewards.loser;
      playerToReward.gold += rewards.gold;
      attacker.seasonTokens += rewards.seasonTokens;
      attacker.lifetimeSeasonTokens += rewards.seasonTokens;
      
      await Promise.all([playerToReward.save(), attacker.save()]);
    }
  }

  /**
   * Mettre à jour les classements des joueurs
   */
  private static async updatePlayerRanking(serverId: string) {
    try {
      // Obtenir tous les joueurs du serveur triés par points
      const allPlayers = await ArenaPlayer.find({ serverId })
        .sort({ arenaPoints: -1, seasonWins: -1, seasonWinStreak: -1 });

      // Mettre à jour les rangs
      for (let i = 0; i < allPlayers.length; i++) {
        const newRank = i + 1;
        await allPlayers[i].updateRank(newRank);
      }

      console.log(`📊 Classements mis à jour pour ${allPlayers.length} joueurs sur ${serverId}`);

    } catch (error) {
      console.error("❌ Erreur updatePlayerRanking:", error);
    }
  }

  /**
   * Vérifier et traiter les promotions/relégations
   */
  private static async checkPromotion(arenaPlayer: any) {
    const oldLeague = arenaPlayer.currentLeague;
    const newLeague = this.determineLeagueFromPoints(arenaPlayer.arenaPoints);
    
    if (oldLeague === newLeague) {
      return null; // Pas de changement
    }

    const promoted = this.getLeagueRank(newLeague) > this.getLeagueRank(oldLeague);
    const relegated = this.getLeagueRank(newLeague) < this.getLeagueRank(oldLeague);

    if (promoted) {
      arenaPlayer.currentLeague = newLeague;
      arenaPlayer.lastPromotionAt = new Date();
      await arenaPlayer.save();

      // Récompenses de promotion
      const bonusRewards = this.getPromotionRewards(newLeague);
      
      console.log(`🎉 ${arenaPlayer.playerId} promu en ${newLeague}!`);

      return {
        promoted: true,
        relegated: false,
        newLeague,
        bonusRewards
      };

    } else if (relegated) {
      arenaPlayer.currentLeague = newLeague;
      arenaPlayer.lastRelegationAt = new Date();
      await arenaPlayer.save();

      console.log(`📉 ${arenaPlayer.playerId} relégué en ${newLeague}`);

      return {
        promoted: false,
        relegated: true,
        newLeague,
        bonusRewards: null
      };
    }

    return null;
  }

  /**
   * Déterminer la ligue à partir des points
   */
  private static determineLeagueFromPoints(points: number): ArenaLeague {
    if (points >= 5000) return ArenaLeague.LEGENDARY;
    if (points >= 4000) return ArenaLeague.MASTER;
    if (points >= 3000) return ArenaLeague.DIAMOND;
    if (points >= 2000) return ArenaLeague.GOLD;
    if (points >= 1000) return ArenaLeague.SILVER;
    return ArenaLeague.BRONZE;
  }

  /**
   * Obtenir le rang numérique d'une ligue
   */
  private static getLeagueRank(league: ArenaLeague): number {
    const ranks = {
      [ArenaLeague.BRONZE]: 1,
      [ArenaLeague.SILVER]: 2,
      [ArenaLeague.GOLD]: 3,
      [ArenaLeague.DIAMOND]: 4,
      [ArenaLeague.MASTER]: 5,
      [ArenaLeague.LEGENDARY]: 6
    };
    return ranks[league] || 1;
  }

  /**
   * Obtenir les récompenses de promotion
   */
  private static getPromotionRewards(league: ArenaLeague) {
    const rewards = {
      [ArenaLeague.SILVER]: { gold: 500, gems: 50, seasonTokens: 100 },
      [ArenaLeague.GOLD]: { gold: 1000, gems: 100, seasonTokens: 200 },
      [ArenaLeague.DIAMOND]: { gold: 2000, gems: 200, seasonTokens: 400 },
      [ArenaLeague.MASTER]: { gold: 4000, gems: 400, seasonTokens: 800 },
      [ArenaLeague.LEGENDARY]: { gold: 8000, gems: 800, seasonTokens: 1600 }
    };
    return rewards[league] || null;
  }

  /**
   * Envoyer les notifications de match
   */
  private static async sendMatchNotifications(attacker: any, defender: any, attackerWon: boolean, promotionInfo: any) {
    try {
      // Notification pour l'attaquant
      const result = attackerWon ? "Victoire" : "Défaite";
      const defenderPlayer = await Player.findOne({ _id: defender.playerId });
      
      await NotificationService.sendProgressUpdate(
        attacker.playerId,
        attacker.serverId,
        {
          milestone: `Combat d'arène: ${result}`,
          newFeatures: promotionInfo?.promoted ? [`Promotion en ${promotionInfo.newLeague}`] : undefined
        }
      );

      // Notification de promotion si applicable
      if (promotionInfo?.promoted) {
        await NotificationService.notifyMajorMilestone(
          attacker.playerId,
          attacker.serverId,
          `Promotion ${promotionInfo.newLeague}`,
          `Félicitations ! Vous avez été promu en ligue ${promotionInfo.newLeague}`
        );
      }

    } catch (error) {
      console.error("❌ Erreur sendMatchNotifications:", error);
    }
  }

  // ===== GESTION DES RÉCOMPENSES =====

  /**
   * Réclamer les récompenses quotidiennes
   */
  public static async claimDailyRewards(playerId: string, serverId: string): Promise<ArenaServiceResponse> {
    try {
      const arenaPlayer = await ArenaPlayer.findByPlayer(playerId, serverId);
      if (!arenaPlayer) {
        return { success: false, error: "Player not found in arena" };
      }

      const result = await arenaPlayer.claimDailyRewards();
      
      if (!result.success) {
        return { success: false, error: "No rewards available to claim" };
      }

      // Appliquer les récompenses au joueur
      const player = await Player.findOne({ _id: playerId, serverId });
      if (player) {
        player.gold += result.rewards.gold;
        player.gems += result.rewards.gems;
        arenaPlayer.seasonTokens += result.rewards.seasonTokens;
        arenaPlayer.lifetimeSeasonTokens += result.rewards.seasonTokens;
        
        await Promise.all([player.save(), arenaPlayer.save()]);
      }

      console.log(`💰 Récompenses quotidiennes réclamées par ${playerId}: ${JSON.stringify(result.rewards)}`);

      return {
        success: true,
        data: result.rewards,
        message: "Daily rewards claimed successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur claimDailyRewards:", error);
      return { success: false, error: error.message };
    }
  }

  // ===== GESTION DES FORMATIONS =====

  /**
   * Définir la formation défensive
   */
  public static async setDefensiveFormation(
    playerId: string, 
    serverId: string, 
    formationData: any
  ): Promise<ArenaServiceResponse> {
    try {
      const arenaPlayer = await ArenaPlayer.findByPlayer(playerId, serverId);
      if (!arenaPlayer) {
        return { success: false, error: "Player not found in arena" };
      }

      // Valider la formation
      const validation = await this.validateFormation(playerId, serverId, formationData);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Créer la nouvelle formation
      const newFormation: IArenaFormation = {
        formationId: `formation_${Date.now()}`,
        name: formationData.name || "Defensive Formation",
        heroSlots: formationData.heroSlots,
        totalPower: formationData.totalPower,
        isActive: true,
        lastUsedAt: new Date(),
        createdAt: new Date()
      };

      await arenaPlayer.setDefensiveFormation(newFormation);

      console.log(`🛡️ Formation défensive mise à jour pour ${playerId} (Puissance: ${newFormation.totalPower})`);

      return {
        success: true,
        data: newFormation,
        message: "Defensive formation updated successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur setDefensiveFormation:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Valider une formation
   */
  private static async validateFormation(playerId: string, serverId: string, formationData: any) {
    // Vérifier que le joueur possède tous les héros
    const player = await Player.findOne({ _id: playerId, serverId }).populate("heroes.heroId");
    if (!player) {
      return { valid: false, error: "Player not found" };
    }

    const playerHeroIds = player.heroes.map((h: any) => h.heroId._id || h.heroId);
    
    for (const slot of formationData.heroSlots) {
      if (!playerHeroIds.includes(slot.heroId)) {
        return { valid: false, error: `Player does not own hero ${slot.heroId}` };
      }
    }

    // Vérifier que la formation n'est pas vide
    if (formationData.heroSlots.length === 0) {
      return { valid: false, error: "Formation cannot be empty" };
    }

    // Vérifier les positions valides (1-9)
    for (const slot of formationData.heroSlots) {
      if (slot.slot < 1 || slot.slot > 9) {
        return { valid: false, error: "Invalid slot position" };
      }
    }

    return { valid: true };
  }

  // ===== UTILITAIRES DE SAISON =====

  /**
   * Générer les classements finaux d'une saison
   */
  private static async generateSeasonFinalRankings(serverId: string, seasonId: string) {
    const arenaPlayers = await ArenaPlayer.find({ serverId, seasonId })
      .sort({ arenaPoints: -1, seasonWins: -1 })
      .populate('playerId', 'displayName');

    return arenaPlayers.map((player, index) => ({
      playerId: player.playerId,
      playerName: (player.playerId as any).displayName,
      finalRank: index + 1,
      finalLeague: player.currentLeague,
      finalPoints: player.arenaPoints,
      totalWins: player.seasonWins,
      totalLosses: player.seasonLosses,
      bestWinStreak: player.seasonBestWinStreak,
      rewardsClaimed: false
    }));
  }

  /**
   * Distribuer les récompenses de fin de saison
   */
  private static async distributeSeasonEndRewards(serverId: string, season: any, rankings: any[]) {
    try {
      for (const ranking of rankings) {
        const rewards = season.exclusiveRewards[ranking.finalLeague];
        if (!rewards) continue;

        // Appliquer les récompenses
        const player = await Player.findOne({ _id: ranking.playerId, serverId });
        const arenaPlayer = await ArenaPlayer.findByPlayer(ranking.playerId, serverId);
        
        if (player && arenaPlayer) {
          player.gold += rewards.seasonTokens * 10; // Conversion tokens en or
          arenaPlayer.seasonTokens += rewards.seasonTokens;
          arenaPlayer.lifetimeSeasonTokens += rewards.seasonTokens;
          
          await Promise.all([player.save(), arenaPlayer.save()]);

          // Notification de récompenses
          await NotificationService.notifyMajorMilestone(
            ranking.playerId,
            serverId,
            `Fin de saison ${season.seasonNumber}`,
            `Rang final: ${ranking.finalRank} en ${ranking.finalLeague}. Récompenses: ${rewards.seasonTokens} tokens`
          );
        }

        ranking.rewardsClaimed = true;
      }

      console.log(`🎁 Récompenses de fin de saison distribuées à ${rankings.length} joueurs`);

    } catch (error) {
      console.error("❌ Erreur distributeSeasonEndRewards:", error);
    }
  }

  /**
   * Réinitialiser les données saisonnières des joueurs
   */
  private static async resetPlayerSeasonData(serverId: string) {
    try {
      await ArenaPlayer.updateMany(
        { serverId },
        {
          $set: {
            seasonWins: 0,
            seasonLosses: 0,
            seasonWinStreak: 0,
            seasonBestWinStreak: 0,
            dailyMatchesUsed: 0,
            unclaimedDailyRewards: true
          }
        }
      );

      console.log(`🔄 Données saisonnières réinitialisées pour le serveur ${serverId}`);

    } catch (error) {
      console.error("❌ Erreur resetPlayerSeasonData:", error);
    }
  }

  // ===== STATISTIQUES ET UTILITAIRES =====

  /**
   * Obtenir le nombre de saisons d'un joueur
   */
  private static async getPlayerSeasonCount(playerId: string, serverId: string): Promise<number> {
    try {
      const seasons = await ArenaSeason.find({ serverId, status: ArenaSeasonStatus.ENDED });
      let count = 0;
      
      for (const season of seasons) {
        const participated = season.finalRankings?.some(ranking => ranking.playerId === playerId);
        if (participated) count++;
      }
      
      return count;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Obtenir la meilleure ligue d'un joueur
   */
  private static async getPlayerBestLeague(playerId: string, serverId: string): Promise<ArenaLeague> {
    try {
      const seasons = await ArenaSeason.find({ serverId, status: ArenaSeasonStatus.ENDED });
      let bestLeague = ArenaLeague.BRONZE;
      let bestRank = 6;
      
      for (const season of seasons) {
        const playerRanking = season.finalRankings?.find(ranking => ranking.playerId === playerId);
        if (playerRanking) {
          const leagueRank = this.getLeagueRank(playerRanking.finalLeague);
          if (leagueRank < bestRank) {
            bestRank = leagueRank;
            bestLeague = playerRanking.finalLeague;
          }
        }
      }
      
      return bestLeague;
    } catch (error) {
      return ArenaLeague.BRONZE;
    }
  }

  /**
   * Obtenir la durée moyenne des combats d'un joueur
   */
  private static async getPlayerAverageMatchDuration(playerId: string, serverId: string): Promise<number> {
    try {
      const matches = await ArenaMatch.find({
        serverId,
        $or: [{ attackerId: playerId }, { defenderId: playerId }]
      }).select('duration');

      if (matches.length === 0) return 0;

      const totalDuration = matches.reduce((sum, match) => sum + match.duration, 0);
      return Math.round(totalDuration / matches.length);
    } catch (error) {
      return 0;
    }
  }

  // ===== MÉTHODES PUBLIQUES SUPPLÉMENTAIRES =====

  /**
   * Obtenir l'historique des combats d'un joueur
   */
  public static async getMatchHistory(
    playerId: string, 
    serverId: string, 
    limit: number = 20
  ): Promise<ArenaServiceResponse> {
    try {
      const matches = await ArenaMatch.getPlayerHistory(playerId, serverId, limit);
      
      const history = matches.map(match => ({
        matchId: match.matchId,
        opponent: match.attackerId === playerId 
          ? { id: match.defenderId, name: match.defenderData.playerName, role: "defender" }
          : { id: match.attackerId, name: match.attackerData.playerName, role: "attacker" },
        result: match.attackerId === playerId 
          ? (match.battleResult.victory ? "win" : "loss")
          : (match.battleResult.victory ? "loss" : "win"),
        pointsChange: match.attackerId === playerId 
          ? match.pointsExchanged 
          : -match.pointsExchanged,
        duration: match.duration,
        matchType: match.matchType,
        createdAt: match.createdAt
      }));

      return {
        success: true,
        data: { matches: history, total: history.length },
        message: "Match history retrieved successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur getMatchHistory:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtenir les combats de vengeance disponibles
   */
  public static async getRevengeMatches(playerId: string, serverId: string): Promise<ArenaServiceResponse> {
    try {
      const revengeMatches = await ArenaMatch.getRevengeMatches(playerId, serverId);
      
      const revengeOpponents = [];
      for (const match of revengeMatches) {
        const attacker = await ArenaPlayer.findOne({ 
          playerId: match.attackerId, 
          serverId 
        }).populate('playerId', 'displayName level');
        
        if (attacker) {
          revengeOpponents.push({
            matchId: match.matchId,
            opponentId: match.attackerId,
            opponentName: (attacker.playerId as any).displayName,
            opponentLevel: (attacker.playerId as any).level,
            opponentLeague: attacker.currentLeague,
            opponentPower: attacker.defensiveFormation.totalPower,
            originalDefeat: match.createdAt,
            canRevenge: true
          });
        }
      }

      return {
        success: true,
        data: { revengeMatches: revengeOpponents },
        message: "Revenge matches retrieved successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur getRevengeMatches:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Réinitialisation quotidienne automatique
   */
  public static async performDailyReset(serverId: string): Promise<void> {
    try {
      console.log(`🌅 Reset quotidien arène pour ${serverId}`);

      await ArenaPlayer.updateMany(
        { serverId },
        {
          $set: {
            dailyMatchesUsed: 0,
            unclaimedDailyRewards: true
          }
        }
      );

      console.log(`✅ Reset quotidien terminé pour ${serverId}`);

    } catch (error) {
      console.error("❌ Erreur performDailyReset:", error);
    }
  }
}

// server/src/services/arena/ArenaMatchmaking.ts

import { ArenaPlayer, ArenaMatch } from "../../models/Arena";
import {
  ArenaLeague,
  IArenaOpponent,
  IArenaOpponentSearch,
  ArenaOpponentsResponse,
  IArenaConfig
} from "../../types/ArenaTypes";

/**
 * SERVICE DE MATCHMAKING AVANCÉ
 * Recherche d'adversaires intelligente avec filtres et algorithmes
 */
export class ArenaMatchmaking {

  // ===== CONFIGURATION MATCHMAKING =====
  
  private static readonly CONFIG: Pick<IArenaConfig, 'opponentSearch'> = {
    opponentSearch: {
      maxRankDifference: 100,     // Différence de rang max
      maxPowerDifference: 0.3,    // 30% de différence de puissance
      searchRadius: 10,           // 10 adversaires retournés
      excludeRecentHours: 2       // 2h avant de revoir le même adversaire
    }
  };

  // ===== RECHERCHE AVANCÉE D'ADVERSAIRES =====

  /**
   * Recherche d'adversaires avec filtres avancés
   */
  public static async findAdvancedOpponents(
    playerId: string, 
    serverId: string,
    options: Partial<IArenaOpponentSearch> = {}
  ): Promise<ArenaOpponentsResponse> {
    const { ArenaCache } = await import('./ArenaCache');
    return ArenaCache.getOpponents(playerId, serverId, options);
  }

  /**
   * Recherche d'adversaires par difficulté spécifique
   */
  public static async findOpponentsByDifficulty(
    playerId: string,
    serverId: string,
    difficulty: "easy" | "medium" | "hard",
    limit: number = 5
  ): Promise<ArenaOpponentsResponse> {
    const searchOptions: Partial<IArenaOpponentSearch> = {
      filters: {
        difficulty,
        excludeRecent: true
      },
      limit
    };

    return this.findAdvancedOpponents(playerId, serverId, searchOptions);
  }

  /**
   * Recherche d'adversaires en ligne seulement
   */
  public static async findOnlineOpponents(
    playerId: string,
    serverId: string,
    limit: number = 8
  ): Promise<ArenaOpponentsResponse> {
    const searchOptions: Partial<IArenaOpponentSearch> = {
      filters: {
        onlineOnly: true,
        excludeRecent: true
      },
      limit
    };

    return this.findAdvancedOpponents(playerId, serverId, searchOptions);
  }

  /**
   * Recherche d'adversaires dans une ligue spécifique
   */
  public static async findOpponentsByLeague(
    playerId: string,
    serverId: string,
    targetLeague: ArenaLeague,
    limit: number = 6
  ): Promise<ArenaOpponentsResponse> {
    const searchOptions: Partial<IArenaOpponentSearch> = {
      filters: {
        league: targetLeague,
        excludeRecent: false // Permet de voir tous les adversaires de la ligue
      },
      limit
    };

    return this.findAdvancedOpponents(playerId, serverId, searchOptions);
  }

  // ===== MÉTHODES PRIVÉES - RECHERCHE =====

  /**
   * Recherche de base des adversaires potentiels
   */
  private static async searchBasicOpponents(arenaPlayer: any, searchConfig: IArenaOpponentSearch) {
    const query: any = {
      serverId: searchConfig.serverId,
      playerId: { $ne: searchConfig.playerId }
    };

    // Filtrer par ligue si spécifié
    if (searchConfig.filters.league) {
      query.currentLeague = searchConfig.filters.league;
    } else {
      // Recherche dans la ligue actuelle et adjacentes
      const currentLeague = arenaPlayer.currentLeague;
      const adjacentLeagues = this.getAdjacentLeagues(currentLeague);
      query.currentLeague = { $in: adjacentLeagues };
    }

    // Filtrer par rang (éviter les écarts trop importants)
    const maxRankDiff = this.CONFIG.opponentSearch.maxRankDifference;
    query.currentRank = {
      $gte: Math.max(1, arenaPlayer.currentRank - maxRankDiff),
      $lte: arenaPlayer.currentRank + maxRankDiff
    };

    return ArenaPlayer.find(query)
      .populate('playerId', 'displayName level lastSeenAt')
      .sort({ arenaPoints: -1 })
      .limit(searchConfig.limit * 3); // Prendre plus pour filtrer ensuite
  }

  /**
   * Appliquer les filtres avancés
   */
  private static async applyAdvancedFilters(
    arenaPlayer: any, 
    opponents: any[], 
    searchConfig: IArenaOpponentSearch
  ) {
    let filteredOpponents = [...opponents];

    // Filtrer par puissance si spécifié
    if (searchConfig.filters.minPower || searchConfig.filters.maxPower) {
      const playerPower = arenaPlayer.defensiveFormation.totalPower;
      
      filteredOpponents = filteredOpponents.filter(opponent => {
        const opponentPower = opponent.defensiveFormation.totalPower;
        
        if (searchConfig.filters.minPower && opponentPower < searchConfig.filters.minPower) {
          return false;
        }
        
        if (searchConfig.filters.maxPower && opponentPower > searchConfig.filters.maxPower) {
          return false;
        }

        // Vérifier la différence relative de puissance
        const powerDifference = Math.abs(opponentPower - playerPower) / playerPower;
        return powerDifference <= this.CONFIG.opponentSearch.maxPowerDifference;
      });
    }

    // Exclure les adversaires récents si demandé
    if (searchConfig.filters.excludeRecent) {
      const recentOpponentIds = await this.getRecentOpponentIds(
        searchConfig.playerId, 
        searchConfig.serverId
      );
      
      filteredOpponents = filteredOpponents.filter(opponent => 
        !recentOpponentIds.includes(opponent.playerId)
      );
    }

    // Filtrer par statut en ligne si demandé
    if (searchConfig.filters.onlineOnly) {
      filteredOpponents = filteredOpponents.filter(opponent => {
        const playerData = opponent.playerId;
        if (!playerData?.lastSeenAt) return false;
        
        const timeSinceLastSeen = Date.now() - playerData.lastSeenAt.getTime();
        return timeSinceLastSeen < (15 * 60 * 1000); // 15 minutes
      });
    }

    return filteredOpponents;
  }

  /**
   * Enrichir les données des adversaires
   */
  private static async enrichOpponentData(arenaPlayer: any, opponents: any[]): Promise<IArenaOpponent[]> {
    const enrichedOpponents: IArenaOpponent[] = [];

    for (const opponent of opponents) {
      try {
        const playerData = opponent.playerId;
        if (!playerData) continue;

        // Calculer le taux de victoire
        const winRate = opponent.totalWins + opponent.totalLosses > 0
          ? (opponent.totalWins / (opponent.totalWins + opponent.totalLosses)) * 100
          : 0;

        // Calculer la difficulté estimée
        const estimatedDifficulty = this.calculateDifficulty(arenaPlayer, opponent);

        // Calculer les points potentiels
        const { pointsGainOnWin, pointsLostOnDefeat } = this.calculatePotentialPoints(arenaPlayer, opponent);

        // Vérifier le statut en ligne
        const isOnline = playerData.lastSeenAt 
          ? (Date.now() - playerData.lastSeenAt.getTime()) < (15 * 60 * 1000)
          : false;

        enrichedOpponents.push({
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
          pointsGainOnWin,
          pointsLostOnDefeat
        });

      } catch (error) {
        console.warn(`⚠️ Erreur enrichissement adversaire ${opponent.playerId}:`, error);
        continue;
      }
    }

    return enrichedOpponents;
  }

  /**
   * Trier et sélectionner les adversaires finaux
   */
  private static sortAndSelectOpponents(
    opponents: IArenaOpponent[], 
    searchConfig: IArenaOpponentSearch
  ): IArenaOpponent[] {
    // Filtrer par difficulté si spécifié
    let finalOpponents = opponents;
    
    if (searchConfig.filters.difficulty) {
      finalOpponents = opponents.filter(opp => opp.estimatedDifficulty === searchConfig.filters.difficulty);
    }

    // Trier par pertinence (combinaison rang, puissance, activité)
    finalOpponents.sort((a, b) => {
      // Priorité aux joueurs en ligne
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      
      // Puis par proximité de rang
      const rankDiffA = Math.abs(a.rank - (opponents[0]?.rank || 999999));
      const rankDiffB = Math.abs(b.rank - (opponents[0]?.rank || 999999));
      if (rankDiffA !== rankDiffB) return rankDiffA - rankDiffB;
      
      // Puis par difficulté (medium > easy > hard pour variété)
      const difficultyOrder = { "medium": 1, "easy": 2, "hard": 3 };
      const diffA = difficultyOrder[a.estimatedDifficulty];
      const diffB = difficultyOrder[b.estimatedDifficulty];
      if (diffA !== diffB) return diffA - diffB;
      
      // Enfin par points d'arène
      return b.arenaPoints - a.arenaPoints;
    });

    // Retourner seulement le nombre demandé
    return finalOpponents.slice(0, searchConfig.limit);
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Obtenir les ligues adjacentes pour élargir la recherche
   */
  private static getAdjacentLeagues(currentLeague: ArenaLeague): ArenaLeague[] {
    const leagueOrder = [
      ArenaLeague.BRONZE,
      ArenaLeague.SILVER,
      ArenaLeague.GOLD,
      ArenaLeague.DIAMOND,
      ArenaLeague.MASTER,
      ArenaLeague.LEGENDARY
    ];

    const currentIndex = leagueOrder.indexOf(currentLeague);
    const adjacent: ArenaLeague[] = [currentLeague];

    // Ajouter la ligue inférieure si elle existe
    if (currentIndex > 0) {
      adjacent.push(leagueOrder[currentIndex - 1]);
    }

    // Ajouter la ligue supérieure si elle existe
    if (currentIndex < leagueOrder.length - 1) {
      adjacent.push(leagueOrder[currentIndex + 1]);
    }

    return adjacent;
  }

  /**
   * Obtenir les IDs des adversaires récents
   */
  private static async getRecentOpponentIds(playerId: string, serverId: string): Promise<string[]> {
    const recentThreshold = new Date();
    recentThreshold.setHours(recentThreshold.getHours() - this.CONFIG.opponentSearch.excludeRecentHours);
    
    const recentMatches = await ArenaMatch.find({
      serverId,
      $or: [
        { attackerId: playerId },
        { defenderId: playerId }
      ],
      createdAt: { $gte: recentThreshold }
    }).select('attackerId defenderId');

    const recentOpponentIds = recentMatches.map(match => 
      match.attackerId === playerId ? match.defenderId : match.attackerId
    );

    return [...new Set(recentOpponentIds)]; // Supprimer les doublons
  }

  /**
   * Calculer la difficulté d'un adversaire
   */
  private static calculateDifficulty(
    player: any, 
    opponent: any
  ): "easy" | "medium" | "hard" {
    const playerPower = player.defensiveFormation.totalPower;
    const opponentPower = opponent.defensiveFormation.totalPower;
    
    // Différence de puissance
    const powerDifference = (opponentPower - playerPower) / playerPower;
    
    // Différence de rang (inversée car rang plus petit = meilleur)
    const rankDifference = (player.currentRank - opponent.currentRank) / player.currentRank;
    
    // Différence de points d'arène
    const pointsDifference = (opponent.arenaPoints - player.arenaPoints) / Math.max(player.arenaPoints, 1);
    
    // Score combiné (plus élevé = plus difficile)
    const difficultyScore = (powerDifference + rankDifference + pointsDifference) / 3;
    
    if (difficultyScore < -0.15) return "easy";
    if (difficultyScore > 0.15) return "hard";
    return "medium";
  }

  /**
   * Calculer les points potentiels pour un match
   */
  private static calculatePotentialPoints(player: any, opponent: any) {
    const basePointsWin = 25;
    const basePointsLoss = 15;
    
    // Modificateur basé sur la différence de rang
    const rankDifference = opponent.currentRank - player.currentRank;
    const rankMultiplier = 1 + (rankDifference * 0.1 / 100);
    
    // Modificateur basé sur la différence de points
    const pointsDifference = opponent.arenaPoints - player.arenaPoints;
    const pointsMultiplier = 1 + (pointsDifference * 0.001);
    
    const totalMultiplier = Math.max(0.5, Math.min(2.0, rankMultiplier * pointsMultiplier));
    
    return {
      pointsGainOnWin: Math.round(basePointsWin * totalMultiplier),
      pointsLostOnDefeat: Math.round(basePointsLoss * (2 - totalMultiplier))
    };
  }

  /**
   * Obtenir le nombre maximum de combats quotidiens selon la ligue
   */
  private static getMaxDailyMatches(league: ArenaLeague): number {
    const limits: Record<ArenaLeague, number> = {
      [ArenaLeague.BRONZE]: 10,
      [ArenaLeague.SILVER]: 12,
      [ArenaLeague.GOLD]: 15,
      [ArenaLeague.DIAMOND]: 18,
      [ArenaLeague.MASTER]: 20,
      [ArenaLeague.LEGENDARY]: 25
    };
    return limits[league] || 10;
  }

  // ===== MÉTHODES DE RÉPONSE =====

  /**
   * Créer une réponse vide en cas d'erreur
   */
  private static createEmptyResponse(
    playerId: string,
    serverId: string,
    arenaPlayer: any,
    reason: string,
    options: Partial<IArenaOpponentSearch>
  ): ArenaOpponentsResponse {
    return {
      success: false,
      error: reason,
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
          dailyMatchesRemaining: this.getMaxDailyMatches(arenaPlayer.currentLeague) - arenaPlayer.dailyMatchesUsed
        }
      }
    };
  }

  /**
   * Créer une réponse d'erreur
   */
  private static createErrorResponse(
    error: string,
    playerId: string,
    serverId: string,
    options: Partial<IArenaOpponentSearch>
  ): ArenaOpponentsResponse {
    return {
      success: false,
      error,
      data: {
        opponents: [],
        searchCriteria: {
          playerId,
          serverId,
          filters: options.filters || {},
          limit: options.limit || 10
        },
        playerInfo: {
          currentRank: 999999,
          currentPoints: 0,
          dailyMatchesRemaining: 0
        }
      }
    };
  }

  // ===== MÉTHODES PUBLIQUES AVANCÉES =====

  /**
   * Obtenir des statistiques de matchmaking
   */
  public static async getMatchmakingStats(serverId: string) {
    try {
      const totalPlayers = await ArenaPlayer.countDocuments({ serverId });
      
      const leagueDistribution = await ArenaPlayer.aggregate([
        { $match: { serverId } },
        { $group: { _id: "$currentLeague", count: { $sum: 1 } } }
      ]);

      const averageWaitTime = await this.calculateAverageWaitTime(serverId);
      
      return {
        success: true,
        data: {
          totalPlayers,
          leagueDistribution: leagueDistribution.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          averageWaitTime,
          timestamp: new Date()
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculer le temps d'attente moyen (estimation)
   */
  private static async calculateAverageWaitTime(serverId: string): Promise<number> {
    // Simulation basée sur la densité de joueurs
    const activePlayers = await ArenaPlayer.countDocuments({
      serverId,
      lastMatchAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Dernières 24h
    });

    // Plus il y a de joueurs actifs, moins l'attente est longue
    if (activePlayers > 1000) return 5; // 5 secondes
    if (activePlayers > 500) return 15; // 15 secondes
    if (activePlayers > 100) return 30; // 30 secondes
    return 60; // 1 minute
  }

  /**
   * Recommander un adversaire optimal
   */
  public static async getRecommendedOpponent(
    playerId: string,
    serverId: string
  ): Promise<{ success: boolean; opponent?: IArenaOpponent; reason?: string }> {
    try {
      const response = await this.findAdvancedOpponents(playerId, serverId, {
        filters: { difficulty: "medium", excludeRecent: true },
        limit: 3
      });

      if (!response.success || response.data.opponents.length === 0) {
        return { success: false, reason: "No suitable opponents found" };
      }

      // Retourner le premier adversaire (le mieux classé)
      const recommendedOpponent = response.data.opponents[0];
      
      return {
        success: true,
        opponent: recommendedOpponent
      };

    } catch (error: any) {
      return { success: false, reason: error.message };
    }
  }
}

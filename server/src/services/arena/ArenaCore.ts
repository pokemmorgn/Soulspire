// server/src/services/arena/ArenaCore.ts

import Player from "../../models/Player";
import { ArenaPlayer, ArenaMatch, ArenaSeason } from "../../models/Arena";
import { BattleService } from "../BattleService";
import { NotificationService } from "../NotificationService";
import { IBattleOptions } from "../BattleEngine";
import {
  ArenaLeague,
  ArenaMatchType,
  ArenaSeasonStatus,
  IArenaPlayer,
  IArenaMatch,
  IArenaOpponent,
  IArenaFormation,
  IArenaPlayerStats,
  ArenaServiceResponse,
  ArenaMatchResponse,
  ArenaOpponentsResponse,
  ArenaStatsResponse
} from "../../types/ArenaTypes";

/**
 * SERVICE PRINCIPAL D'ARÈNE - VERSION SIMPLIFIÉE
 * Fonctionnalités de base : initialisation, stats, combat simple
 */
export class ArenaCore {

  // ===== INITIALISATION ET GESTION DE BASE =====

  /**
   * Initialiser un joueur dans l'arène
   */
  public static async initializePlayer(playerId: string, serverId: string): Promise<ArenaServiceResponse<IArenaPlayer>> {
    try {
      console.log(`🏟️ Initialisation arène pour ${playerId} sur ${serverId}`);

      // Vérifier si le joueur existe déjà
      let arenaPlayer = await ArenaPlayer.findOne({ playerId, serverId });
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

      // Obtenir ou créer la saison actuelle
      const currentSeason = await this.getCurrentSeason(serverId);

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
        offensiveFormations: [defensiveFormation],
        dailyMatchesUsed: 0,
        lastMatchAt: new Date(),
        lastRewardClaimedAt: new Date(),
        unclaimedDailyRewards: true
      });

      await arenaPlayer.save();

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
      const arenaPlayer = await ArenaPlayer.findOne({ playerId, serverId });
      if (!arenaPlayer) {
        return {
          success: false,
          error: "Player not found in arena",
          data: {} as IArenaPlayerStats
        };
      }

      const stats = arenaPlayer.getStats();
      
      // Ajouter des statistiques supplémentaires
      const currentSeason = await this.getCurrentSeason(serverId);

      const enrichedStats: IArenaPlayerStats = {
        ...stats,
        totalSeasons: 1, // Simplifié pour le moment
        bestRankEver: arenaPlayer.highestRank,
        bestLeagueEver: arenaPlayer.currentLeague,
        formationsCount: arenaPlayer.offensiveFormations.length,
        lastMatchAt: arenaPlayer.lastMatchAt,
        averageMatchDuration: 30000 // Simplifié
      };

      return {
        success: true,
        data: enrichedStats,
        meta: {
          timestamp: new Date(),
          serverId,
          seasonId: currentSeason?.seasonId
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerStats:", error);
      return {
        success: false,
        error: error.message,
        data: {} as IArenaPlayerStats
      };
    }
  }

  // ===== RECHERCHE D'ADVERSAIRES SIMPLE =====

  /**
   * Trouver des adversaires simples pour un joueur
   */
  public static async findSimpleOpponents(
    playerId: string, 
    serverId: string,
    limit: number = 5
  ): Promise<ArenaOpponentsResponse> {
    try {
      console.log(`🎯 Recherche adversaires simples pour ${playerId} sur ${serverId}`);

      const arenaPlayer = await ArenaPlayer.findOne({ playerId, serverId });
      if (!arenaPlayer) {
        throw new Error("Player not found in arena");
      }

      // Vérifier si le joueur peut combattre
      const canFight = arenaPlayer.canStartMatch();
      if (!canFight.allowed) {
        return {
          success: false,
          error: canFight.reason || "Cannot fight",
          data: {
            opponents: [],
            searchCriteria: {
              playerId,
              serverId,
              filters: {},
              limit
            },
            playerInfo: {
              currentRank: arenaPlayer.currentRank,
              currentPoints: arenaPlayer.arenaPoints,
              dailyMatchesRemaining: this.getMaxDailyMatches(arenaPlayer.currentLeague) - arenaPlayer.dailyMatchesUsed
            }
          }
        };
      }

      // Recherche simple : même ligue, rangs similaires
      const potentialOpponents = await ArenaPlayer.find({
        serverId,
        playerId: { $ne: playerId },
        currentLeague: arenaPlayer.currentLeague
      })
        .populate('playerId', 'displayName level lastSeenAt')
        .sort({ arenaPoints: -1 })
        .limit(limit * 2);

      // Convertir en format IArenaOpponent
      const opponents: IArenaOpponent[] = [];
      
      for (const opponent of potentialOpponents) {
        if (opponents.length >= limit) break;

        const playerData = opponent.playerId as any;
        if (!playerData) continue;

        const winRate = opponent.totalWins + opponent.totalLosses > 0
          ? (opponent.totalWins / (opponent.totalWins + opponent.totalLosses)) * 100
          : 0;

        // Difficulté basée sur les points
        const pointsDiff = opponent.arenaPoints - arenaPlayer.arenaPoints;
        let estimatedDifficulty: "easy" | "medium" | "hard";
        if (pointsDiff < -100) estimatedDifficulty = "easy";
        else if (pointsDiff > 100) estimatedDifficulty = "hard";
        else estimatedDifficulty = "medium";

        const isOnline = playerData.lastSeenAt 
          ? (Date.now() - playerData.lastSeenAt.getTime()) < (15 * 60 * 1000)
          : false;

        opponents.push({
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
          pointsGainOnWin: 25, // Simplifié
          pointsLostOnDefeat: 15  // Simplifié
        });
      }

      console.log(`✅ ${opponents.length} adversaires trouvés pour ${playerId}`);

      return {
        success: true,
        data: {
          opponents,
          searchCriteria: {
            playerId,
            serverId,
            filters: {},
            limit
          },
          playerInfo: {
            currentRank: arenaPlayer.currentRank,
            currentPoints: arenaPlayer.arenaPoints,
            dailyMatchesRemaining: this.getMaxDailyMatches(arenaPlayer.currentLeague) - arenaPlayer.dailyMatchesUsed
          }
        },
        meta: {
          timestamp: new Date(),
          serverId
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur findSimpleOpponents:", error);
      return {
        success: false,
        error: error.message,
        data: {
          opponents: [],
          searchCriteria: {
            playerId,
            serverId,
            filters: {},
            limit
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

  // ===== COMBAT SIMPLE =====

  /**
   * Démarrer un combat d'arène simple
   */
  public static async startSimpleMatch(
    attackerId: string,
    serverId: string,
    defenderId: string,
    battleOptions: IBattleOptions = { mode: "auto", speed: 1 }
  ): Promise<ArenaMatchResponse> {
    try {
      console.log(`⚔️ Combat d'arène simple: ${attackerId} vs ${defenderId}`);

      // Validation des participants
      const [attacker, defender] = await Promise.all([
        ArenaPlayer.findOne({ playerId: attackerId, serverId }),
        ArenaPlayer.findOne({ playerId: defenderId, serverId })
      ]);

      if (!attacker || !defender) {
        throw new Error("One or both players not found in arena");
      }

      // Vérifications pré-combat
      const canFight = attacker.canStartMatch();
      if (!canFight.allowed) {
        throw new Error(canFight.reason || "Cannot fight");
      }

      // Obtenir la saison actuelle
      const currentSeason = await this.getCurrentSeason(serverId);

      // Exécuter le combat via BattleService
      const battleResult = await BattleService.startArenaBattle(
        attackerId,
        serverId,
        defenderId,
        battleOptions
      );

      // Calculer l'échange de points simple
      const pointsGained = battleResult.result.victory ? 25 : -15;
      const pointsLost = battleResult.result.victory ? -10 : 15;

      // Récompenses simples
      const rewards = {
        winner: {
          arenaPoints: pointsGained,
          gold: 50,
          experience: 25,
          seasonTokens: 5,
          items: []
        },
        loser: {
          arenaPoints: pointsLost,
          gold: 10,
          experience: 5,
          seasonTokens: 1
        }
      };

      // Créer l'enregistrement du match
      const arenaMatch = new ArenaMatch({
        serverId,
        seasonId: currentSeason.seasonId,
        attackerId,
        defenderId,
        attackerData: await this.prepareMatchPlayerData(attacker),
        defenderData: await this.prepareMatchPlayerData(defender),
        matchType: ArenaMatchType.RANKED,
        battleId: battleResult.battleId,
        battleResult: battleResult.result,
        pointsExchanged: pointsGained,
        attackerPointsBefore: attacker.arenaPoints,
        attackerPointsAfter: attacker.arenaPoints + pointsGained,
        defenderPointsBefore: defender.arenaPoints,
        defenderPointsAfter: defender.arenaPoints + pointsLost,
        rewards,
        duration: battleResult.result.battleDuration,
        isRevenge: false
      });

      await arenaMatch.save();

      // Appliquer les résultats aux joueurs
      await this.applySimpleMatchResults(attacker, defender, battleResult.result.victory, rewards);

      // Mettre à jour les classements
      await this.updatePlayerRanking(serverId);

      console.log(`✅ Combat terminé: ${battleResult.result.victory ? "Victoire" : "Défaite"} (${pointsGained} pts)`);

      return {
        success: true,
        data: {
          match: arenaMatch.toObject(),
          newRank: attacker.currentRank,
          newPoints: attacker.arenaPoints,
          newLeague: attacker.currentLeague,
          rewards
        },
        message: `Arena match completed - ${battleResult.result.victory ? "Victory" : "Defeat"}`,
        meta: {
          timestamp: new Date(),
          serverId,
          seasonId: currentSeason.seasonId
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur startSimpleMatch:", error);
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

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Obtenir ou créer la saison actuelle
   */
  private static async getCurrentSeason(serverId: string) {
    let currentSeason = await ArenaSeason.findOne({ 
      serverId, 
      status: ArenaSeasonStatus.ACTIVE 
    });
    
    if (!currentSeason) {
      console.log(`🆕 Création nouvelle saison pour ${serverId}`);
      
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 30); // 30 jours

      currentSeason = new ArenaSeason({
        serverId,
        seasonNumber: 1,
        startDate,
        endDate,
        status: ArenaSeasonStatus.ACTIVE,
        seasonTheme: "Season 1: Arena Legends",
        totalParticipants: 0,
        totalMatches: 0
      });

      await currentSeason.save();
    }

    return currentSeason;
  }

/**
 * Créer la formation initiale d'un joueur
 */
private static async createInitialFormation(player: any): Promise<IArenaFormation | null> {
  let equippedHeroes = player.heroes.filter((h: any) => h.equipped);
  
  // 🔥 FIX CRITIQUE : Si pas de héros équipés, auto-équiper les premiers
  if (equippedHeroes.length === 0) {
    console.log(`🛠️ Aucun héros équipé pour ${player.displayName}, auto-équipement...`);
    
    // Prendre les premiers héros disponibles (max 5)
    const availableHeroes = player.heroes.slice(0, Math.min(5, player.heroes.length));
    
    if (availableHeroes.length === 0) {
      console.error(`❌ ${player.displayName} n'a aucun héros ! Impossible de créer une formation.`);
      return null;
    }
    
    // Les marquer comme équipés
    for (let i = 0; i < availableHeroes.length; i++) {
      availableHeroes[i].equipped = true;
      availableHeroes[i].slot = i + 1;
    }
    
    // Sauvegarder les changements
    try {
      await player.save();
      console.log(`✅ Auto-équipement de ${availableHeroes.length} héros pour ${player.displayName}`);
    } catch (error) {
      console.error(`❌ Erreur sauvegarde auto-équipement pour ${player.displayName}:`, error);
    }
    
    equippedHeroes = availableHeroes;
  }

  let totalPower = 0;
  const heroSlots = equippedHeroes.map((hero: any, index: number) => {
    const heroPower = this.calculateHeroPower(hero);
    totalPower += heroPower;
    
    return {
      slot: hero.slot || (index + 1), // Utiliser le slot existant ou calculer
      heroId: hero.heroId._id || hero.heroId,
      level: hero.level,
      stars: hero.stars,
      power: heroPower
    };
  });

  // 🔥 SÉCURITÉ : Assurer une puissance minimale
  if (totalPower === 0) {
    totalPower = 1000; // Puissance de base pour éviter division par zéro
    console.warn(`⚠️ Puissance totale = 0 pour ${player.displayName}, appliqué puissance de base: ${totalPower}`);
  }

  const formation: IArenaFormation = {
    formationId: `formation_${Date.now()}_${player._id}`,
    name: "Formation par défaut",
    heroSlots,
    totalPower,
    isActive: true,
    lastUsedAt: new Date(),
    createdAt: new Date()
  };

  console.log(`🎯 Formation créée pour ${player.displayName}: ${heroSlots.length} héros, ${totalPower} puissance`);

  return formation;
}
  /**
   * Calculer la puissance d'un héros (version simplifiée)
   */
  private static calculateHeroPower(hero: any): number {
    const heroData = hero.heroId;
    if (!heroData || !heroData.baseStats) return 1000; // Valeur par défaut

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
   * Appliquer les résultats d'un match simple
   */
  private static async applySimpleMatchResults(attacker: any, defender: any, attackerWon: boolean, rewards: any) {
    // Mettre à jour l'attaquant
    const attackerReward = attackerWon ? rewards.winner : rewards.loser;
    attacker.arenaPoints = Math.max(0, attacker.arenaPoints + attackerReward.arenaPoints);
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
    const defenderReward = attackerWon ? rewards.loser : rewards.winner;
    defender.arenaPoints = Math.max(0, defender.arenaPoints + defenderReward.arenaPoints);
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

    // Appliquer les récompenses or/gems au joueur principal
    const playerToReward = await Player.findOne({ 
      _id: attacker.playerId, 
      serverId: attacker.serverId 
    });
    
    if (playerToReward) {
      playerToReward.gold += attackerReward.gold;
      attacker.seasonTokens += attackerReward.seasonTokens;
      attacker.lifetimeSeasonTokens += attackerReward.seasonTokens;
      
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
        if (allPlayers[i].currentRank !== newRank) {
          allPlayers[i].currentRank = newRank;
          if (newRank < allPlayers[i].highestRank) {
            allPlayers[i].highestRank = newRank;
          }
          await allPlayers[i].save();
        }
      }

      console.log(`📊 Classements mis à jour pour ${allPlayers.length} joueurs sur ${serverId}`);

    } catch (error) {
      console.error("❌ Erreur updatePlayerRanking:", error);
    }
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
}

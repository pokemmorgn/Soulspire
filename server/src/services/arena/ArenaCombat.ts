// server/src/services/arena/ArenaCombat.ts

import Player from "../../models/Player";
import { ArenaPlayer, ArenaMatch, ArenaSeason } from "../../models/Arena";
import { BattleService } from "../BattleService";
import { NotificationService } from "../NotificationService";
import { MissionService } from "../MissionService";
import { EventService } from "../EventService";
import { IBattleOptions } from "../BattleEngine";
import {
  ArenaLeague,
  ArenaMatchType,
  ArenaSeasonStatus,
  IArenaMatch,
  IArenaRewards,
  IArenaMatchPlayer,
  ArenaServiceResponse,
  ArenaMatchResponse
} from "../../types/ArenaTypes";

/**
 * SERVICE DE COMBAT D'ARÈNE AVANCÉ
 * Gestion complète des combats : validation, exécution, récompenses, promotions
 */
export class ArenaCombat {

  // ===== CONFIGURATION COMBAT =====
  
  private static readonly COMBAT_CONFIG = {
    pointCalculation: {
      basePointsPerWin: 25,
      basePointsPerLoss: -15,
      rankDifferenceMultiplier: 0.1,
      leagueBonusMultiplier: 1.2
    },
    cooldowns: {
      betweenMatches: 300,        // 5 minutes entre combats
      revengeWindow: 24,          // 24h pour se venger
    },
    rewards: {
      experienceMultiplier: 1.5,  // Bonus XP arène vs campagne
      goldMultiplier: 2.0,        // Bonus or arène vs campagne
      seasonTokenMultiplier: 1.0
    }
  };

  // ===== COMBAT PRINCIPAL =====

  /**
   * Démarrer un combat d'arène avec gestion complète
   */
  public static async startAdvancedMatch(
    attackerId: string,
    serverId: string,
    defenderId: string,
    matchType: ArenaMatchType = ArenaMatchType.RANKED,
    battleOptions: IBattleOptions = { mode: "auto", speed: 1 }
  ): Promise<ArenaMatchResponse> {
    try {
      console.log(`⚔️ Combat d'arène avancé: ${attackerId} vs ${defenderId} (${matchType})`);

      // Étape 1: Validation des participants
      const validation = await this.validateMatchParticipants(attackerId, defenderId, serverId, matchType);
      if (!validation.success) {
        throw new Error(validation.error);
      }

    const attacker = validation.data.attacker;
    const defender = validation.data.defender;
    const season = validation.data.season;

      // Étape 2: Préparer les données du match
      const matchData = await this.prepareMatchData(attacker, defender, season, matchType);

      // Étape 3: Exécuter le combat
      const battleResult = await BattleService.startArenaBattle(
        attackerId,
        serverId,
        defenderId,
        battleOptions
      );

      // Étape 4: Calculer les résultats
      const combatResults = this.calculateCombatResults(
        attacker,
        defender,
        battleResult.result.victory,
        matchType
      );

      // Étape 5: Créer l'enregistrement du match
      const arenaMatch = await this.createMatchRecord(
        matchData,
        battleResult,
        combatResults,
        matchType
      );

      // Étape 6: Appliquer les résultats
      await this.applyMatchResults(attacker, defender, combatResults, battleResult.result.victory);

      // Étape 7: Vérifier les promotions/relégations
      const promotionInfo = await this.checkPromotionRelegation(attacker);

      // Étape 8: Notifications et missions
      await this.handlePostMatchEvents(attacker, defender, battleResult.result.victory, promotionInfo);

      // Étape 9: Mettre à jour les classements
      const { ArenaCache } = await import('./ArenaCache');
      ArenaCache.invalidateAfterMatch(attackerId, defenderId, serverId);

      console.log(`✅ Combat avancé terminé: ${battleResult.result.victory ? "Victoire" : "Défaite"} (${combatResults.pointsExchange.attacker} pts)`);

      return {
        success: true,
        data: {
          match: arenaMatch.toObject(),
          newRank: attacker.currentRank,
          newPoints: attacker.arenaPoints,
          newLeague: attacker.currentLeague,
          rewards: combatResults.rewards,
          promotionInfo: promotionInfo ? {
            promoted: promotionInfo.promoted,
            newLeague: promotionInfo.newLeague,
            bonusRewards: promotionInfo.bonusRewards
          } : undefined
        },
        message: `Arena match completed - ${battleResult.result.victory ? "Victory" : "Defeat"}`,
        meta: {
          timestamp: new Date(),
          serverId,
          seasonId: season.seasonId
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur startAdvancedMatch:", error);
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

  /**
   * Combat de vengeance
   */
  public static async startRevengeMatch(
    attackerId: string,
    serverId: string,
    originalMatchId: string,
    battleOptions: IBattleOptions = { mode: "auto", speed: 1 }
  ): Promise<ArenaMatchResponse> {
    try {
      console.log(`🔥 Combat de vengeance: ${attackerId} vs match ${originalMatchId}`);

      // Récupérer le match original
      const originalMatch = await ArenaMatch.findOne({ 
        _id: originalMatchId, 
        serverId,
        defenderId: attackerId,
        isRevenge: false
      });

      if (!originalMatch) {
        throw new Error("Original match not found or not eligible for revenge");
      }

      // Vérifier la fenêtre de vengeance
      const timeSinceMatch = Date.now() - originalMatch.createdAt.getTime();
      const revengeWindow = this.COMBAT_CONFIG.cooldowns.revengeWindow * 60 * 60 * 1000;
      
      if (timeSinceMatch > revengeWindow) {
        throw new Error("Revenge window has expired");
      }

      // Vérifier que la vengeance n'a pas déjà été prise
      const existingRevenge = await ArenaMatch.findOne({
        serverId,
        attackerId,
        defenderId: originalMatch.attackerId,
        originalMatchId,
        isRevenge: true
      });

      if (existingRevenge) {
        throw new Error("Revenge already taken for this match");
      }

      // Démarrer le combat de vengeance
      const result = await this.startAdvancedMatch(
        attackerId,
        serverId,
        originalMatch.attackerId,
        ArenaMatchType.REVENGE,
        battleOptions
      );

      // Marquer comme vengeance et lier au match original
      if (result.success && result.data.match) {
      const matchDoc = result.data.match as any;
      await ArenaMatch.findByIdAndUpdate(matchDoc._id, {
          isRevenge: true,
          originalMatchId
        });
      }

      return result;

    } catch (error: any) {
      console.error("❌ Erreur startRevengeMatch:", error);
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

  // ===== VALIDATION ET PRÉPARATION =====

  /**
   * Valider les participants d'un match
   */
  private static async validateMatchParticipants(
    attackerId: string,
    defenderId: string,
    serverId: string,
    matchType: ArenaMatchType
  ) {
    try {
      // Récupérer les participants
      const [attacker, defender] = await Promise.all([
        ArenaPlayer.findOne({ playerId: attackerId, serverId }),
        ArenaPlayer.findOne({ playerId: defenderId, serverId })
      ]);

      if (!attacker || !defender) {
        return { success: false, error: "One or both players not found in arena" };
      }

      // Vérifier que l'attaquant peut combattre
      const canFight = attacker.canStartMatch();
      if (!canFight.allowed) {
        return { success: false, error: canFight.reason || "Cannot start match" };
      }

      // Vérifier que les joueurs ne sont pas les mêmes
      if (attackerId === defenderId) {
        return { success: false, error: "Cannot fight against yourself" };
      }

      // Vérifier les formations
      if (!attacker.defensiveFormation || !defender.defensiveFormation) {
        return { success: false, error: "Players must have defensive formations" };
      }

      if (attacker.defensiveFormation.heroSlots.length === 0 || 
          defender.defensiveFormation.heroSlots.length === 0) {
        return { success: false, error: "Players must have heroes in their formations" };
      }

      // Obtenir la saison actuelle
      const season = await ArenaSeason.findOne({
        serverId,
        status: ArenaSeasonStatus.ACTIVE
      });

      if (!season) {
        return { success: false, error: "No active arena season" };
      }

      return {
        success: true,
        data: { attacker, defender, season }
      } as any;

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Préparer les données du match
   */
  private static async prepareMatchData(attacker: any, defender: any, season: any, matchType: ArenaMatchType) {
    const [attackerPlayerData, defenderPlayerData] = await Promise.all([
      Player.findOne({ _id: attacker.playerId, serverId: attacker.serverId }),
      Player.findOne({ _id: defender.playerId, serverId: defender.serverId })
    ]);

    if (!attackerPlayerData || !defenderPlayerData) {
      throw new Error("Player data not found");
    }

    const attackerData: IArenaMatchPlayer = {
      playerId: attacker.playerId,
      playerName: attackerPlayerData.displayName,
      level: attackerPlayerData.level,
      league: attacker.currentLeague,
      arenaPoints: attacker.arenaPoints,
      rank: attacker.currentRank,
      formation: attacker.defensiveFormation,
      teamPower: attacker.defensiveFormation.totalPower
    };

    const defenderData: IArenaMatchPlayer = {
      playerId: defender.playerId,
      playerName: defenderPlayerData.displayName,
      level: defenderPlayerData.level,
      league: defender.currentLeague,
      arenaPoints: defender.arenaPoints,
      rank: defender.currentRank,
      formation: defender.defensiveFormation,
      teamPower: defender.defensiveFormation.totalPower
    };

    return {
      serverId: attacker.serverId,
      seasonId: season.seasonId,
      attackerData,
      defenderData,
      matchType
    };
  }

  // ===== CALCULS DE COMBAT =====

  /**
   * Calculer les résultats complets d'un combat
   */
  private static calculateCombatResults(
    attacker: any,
    defender: any,
    attackerWon: boolean,
    matchType: ArenaMatchType
  ) {
    // Calculer l'échange de points
    const pointsExchange = this.calculatePointsExchange(attacker, defender, attackerWon);
    
    // Calculer les récompenses
    const rewards = this.calculateAdvancedRewards(attacker, defender, attackerWon, matchType);
    
    // Calculer les bonus de ligue
    const leagueBonus = this.getLeagueBonus(attacker.currentLeague);

    return {
      pointsExchange,
      rewards,
      leagueBonus,
      attackerWon
    };
  }

  /**
   * Calculer l'échange de points ELO-like
   */
  private static calculatePointsExchange(attacker: any, defender: any, attackerWon: boolean) {
    const config = this.COMBAT_CONFIG.pointCalculation;
    
    // Points de base selon le résultat
    let attackerPoints = attackerWon ? config.basePointsPerWin : config.basePointsPerLoss;
    let defenderPoints = attackerWon ? config.basePointsPerLoss : config.basePointsPerWin;

    // Modificateur basé sur la différence de rang (rang plus petit = meilleur)
    const rankDifference = defender.currentRank - attacker.currentRank;
    const rankMultiplier = 1 + (rankDifference * config.rankDifferenceMultiplier / 100);

    // Modificateur basé sur la différence de points
    const pointsDifference = defender.arenaPoints - attacker.arenaPoints;
    const pointsMultiplier = 1 + (pointsDifference * 0.001);

    // Modificateur basé sur la ligue
    const leagueMultiplier = this.getLeagueMultiplier(attacker.currentLeague);

    // Appliquer les multiplicateurs
    const totalMultiplier = rankMultiplier * pointsMultiplier * leagueMultiplier;
    attackerPoints = Math.round(attackerPoints * totalMultiplier);
    defenderPoints = Math.round(defenderPoints * (2 - totalMultiplier));

    // Assurer des valeurs min/max raisonnables
    attackerPoints = Math.max(-50, Math.min(100, attackerPoints));
    defenderPoints = Math.max(-50, Math.min(100, defenderPoints));

    return {
      attacker: attackerPoints,
      defender: defenderPoints,
      multiplier: totalMultiplier
    };
  }

  /**
   * Calculer les récompenses avancées
   */
  private static calculateAdvancedRewards(
    attacker: any,
    defender: any,
    attackerWon: boolean,
    matchType: ArenaMatchType
  ): IArenaRewards {
    const config = this.COMBAT_CONFIG.rewards;
    const leagueMultiplier = this.getLeagueRewardMultiplier(attacker.currentLeague);
    
    // Récompenses de base
    let winnerRewards = {
      arenaPoints: 0, // Sera calculé séparément
      gold: Math.floor(50 * config.goldMultiplier * leagueMultiplier),
      experience: Math.floor(25 * config.experienceMultiplier * leagueMultiplier),
      seasonTokens: Math.floor(5 * config.seasonTokenMultiplier * leagueMultiplier),
      items: [] as string[]
    };

    let loserRewards = {
      arenaPoints: 0, // Sera calculé séparément
      gold: Math.floor(10 * config.goldMultiplier),
      experience: Math.floor(5 * config.experienceMultiplier),
      seasonTokens: Math.floor(1 * config.seasonTokenMultiplier)
    };

    // Bonus pour combat de vengeance
    if (matchType === ArenaMatchType.REVENGE) {
      winnerRewards.gold = Math.floor(winnerRewards.gold * 1.5);
      winnerRewards.seasonTokens = Math.floor(winnerRewards.seasonTokens * 2);
      loserRewards.gold = Math.floor(loserRewards.gold * 1.2);
    }

    // Bonus selon la différence de rang
    const rankDifference = Math.abs(attacker.currentRank - defender.currentRank);
    if (rankDifference > 50) {
      const underdog = attacker.currentRank > defender.currentRank ? "attacker" : "defender";
      if ((attackerWon && underdog === "attacker") || (!attackerWon && underdog === "defender")) {
        winnerRewards.gold = Math.floor(winnerRewards.gold * 1.3);
        winnerRewards.seasonTokens = Math.floor(winnerRewards.seasonTokens * 1.5);
      }
    }

    // Chance d'objets rares selon la ligue
    if (attackerWon && Math.random() < this.getItemDropChance(attacker.currentLeague)) {
      winnerRewards.items.push(this.generateRandomItem(attacker.currentLeague));
    }

    return {
      winner: winnerRewards,
      loser: loserRewards
    };
  }

  // ===== GESTION DES PROMOTIONS =====

  /**
   * Vérifier et traiter les promotions/relégations
   */
  private static async checkPromotionRelegation(arenaPlayer: any) {
    const oldLeague = arenaPlayer.currentLeague;
    const newLeague = this.determineLeagueFromPoints(arenaPlayer.arenaPoints);
    
    if (oldLeague === newLeague) {
      return null; // Pas de changement
    }

    const promoted = this.getLeagueRank(newLeague) > this.getLeagueRank(oldLeague);
    const relegated = this.getLeagueRank(newLeague) < this.getLeagueRank(oldLeague);

    if (promoted) {
      // Vérifier les conditions de promotion (victoires consécutives)
      const requiredWins = this.getPromotionRequiredWins(newLeague);
      if (arenaPlayer.seasonWinStreak >= requiredWins) {
        arenaPlayer.currentLeague = newLeague;
        arenaPlayer.lastPromotionAt = new Date();
        await arenaPlayer.save();

        const bonusRewards = this.getPromotionRewards(newLeague);
        
        console.log(`🎉 ${arenaPlayer.playerId} promu en ${newLeague}!`);

        return {
          promoted: true,
          relegated: false,
          newLeague,
          bonusRewards
        };
      }
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
   * Obtenir les victoires consécutives requises pour promotion
   */
  private static getPromotionRequiredWins(league: ArenaLeague): number {
    const requirements: Partial<Record<ArenaLeague, number>> = {
      [ArenaLeague.SILVER]: 3,
      [ArenaLeague.GOLD]: 4,
      [ArenaLeague.DIAMOND]: 5,
      [ArenaLeague.MASTER]: 6,
      [ArenaLeague.LEGENDARY]: 8
    };
    return requirements[league] || 3;
  }

  /**
   * Obtenir les récompenses de promotion
   */
  private static getPromotionRewards(league: ArenaLeague) {
    const rewards: Partial<Record<ArenaLeague, { gold: number; gems: number; seasonTokens: number }>> = {
      [ArenaLeague.SILVER]: { gold: 500, gems: 50, seasonTokens: 100 },
      [ArenaLeague.GOLD]: { gold: 1000, gems: 100, seasonTokens: 200 },
      [ArenaLeague.DIAMOND]: { gold: 2000, gems: 200, seasonTokens: 400 },
      [ArenaLeague.MASTER]: { gold: 4000, gems: 400, seasonTokens: 800 },
      [ArenaLeague.LEGENDARY]: { gold: 8000, gems: 800, seasonTokens: 1600 }
    };
    return rewards[league] || null;
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Créer l'enregistrement du match
   */
  private static async createMatchRecord(matchData: any, battleResult: any, combatResults: any, matchType: ArenaMatchType) {
    const arenaMatch = new ArenaMatch({
      serverId: matchData.serverId,
      seasonId: matchData.seasonId,
      attackerId: matchData.attackerData.playerId,
      defenderId: matchData.defenderData.playerId,
      attackerData: matchData.attackerData,
      defenderData: matchData.defenderData,
      matchType,
      battleId: battleResult.battleId,
      battleResult: battleResult.result,
      pointsExchanged: combatResults.pointsExchange.attacker,
      attackerPointsBefore: matchData.attackerData.arenaPoints,
      attackerPointsAfter: matchData.attackerData.arenaPoints + combatResults.pointsExchange.attacker,
      defenderPointsBefore: matchData.defenderData.arenaPoints,
      defenderPointsAfter: matchData.defenderData.arenaPoints + combatResults.pointsExchange.defender,
      rewards: combatResults.rewards,
      duration: battleResult.result.battleDuration,
      isRevenge: matchType === ArenaMatchType.REVENGE
    });

    await arenaMatch.save();
    return arenaMatch;
  }

  /**
   * Appliquer les résultats du match aux joueurs
   */
  private static async applyMatchResults(attacker: any, defender: any, combatResults: any, attackerWon: boolean) {
    // Mettre à jour l'attaquant
    const attackerReward = attackerWon ? combatResults.rewards.winner : combatResults.rewards.loser;
    attacker.arenaPoints = Math.max(0, attacker.arenaPoints + combatResults.pointsExchange.attacker);
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

    // Appliquer les récompenses de tokens
    attacker.seasonTokens += attackerReward.seasonTokens;
    attacker.lifetimeSeasonTokens += attackerReward.seasonTokens;

    await attacker.save();

    // Mettre à jour le défenseur
    const defenderReward = attackerWon ? combatResults.rewards.loser : combatResults.rewards.winner;
    defender.arenaPoints = Math.max(0, defender.arenaPoints + combatResults.pointsExchange.defender);
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

    // Appliquer les récompenses de tokens
    defender.seasonTokens += defenderReward.seasonTokens;
    defender.lifetimeSeasonTokens += defenderReward.seasonTokens;

    await defender.save();

    // Appliquer les récompenses or/gems au joueur principal
    const playerToReward = await Player.findOne({ 
      _id: attacker.playerId, 
      serverId: attacker.serverId 
    });
    
    if (playerToReward) {
      playerToReward.gold += attackerReward.gold;
      await playerToReward.save();
    }
  }

  /**
   * Gérer les événements post-match
   */
  private static async handlePostMatchEvents(attacker: any, defender: any, attackerWon: boolean, promotionInfo: any) {
    try {
      // Missions et événements
      await Promise.all([
        MissionService.updateProgress(
          attacker.playerId, 
          attacker.serverId, 
          "battle_wins", 
          attackerWon ? 1 : 0
        ),
        EventService.updatePlayerProgress(
          attacker.playerId, 
          attacker.serverId, 
          "battle_wins", 
          1
        )
      ]);

      // Notifications
      const defenderPlayer = await Player.findOne({ _id: defender.playerId });
      const result = attackerWon ? "Victoire" : "Défaite";
      
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
      console.error("❌ Erreur handlePostMatchEvents:", error);
    }
  }

  /**
   * Mettre à jour les classements d'arène
   */
  private static async updateArenaRankings(serverId: string) {
    try {
      const allPlayers = await ArenaPlayer.find({ serverId })
        .sort({ arenaPoints: -1, seasonWins: -1, seasonWinStreak: -1 });

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

      console.log(`📊 Classements d'arène mis à jour pour ${allPlayers.length} joueurs sur ${serverId}`);

    } catch (error) {
      console.error("❌ Erreur updateArenaRankings:", error);
    }
  }

  // ===== MÉTHODES UTILITAIRES PRIVÉES =====

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

  private static getLeagueBonus(league: ArenaLeague) {
    return {
      pointsMultiplier: this.getLeagueMultiplier(league),
      rewardsMultiplier: this.getLeagueRewardMultiplier(league),
      league
    };
  }

  private static getItemDropChance(league: ArenaLeague): number {
    const chances = {
      [ArenaLeague.BRONZE]: 0.05,
      [ArenaLeague.SILVER]: 0.08,
      [ArenaLeague.GOLD]: 0.12,
      [ArenaLeague.DIAMOND]: 0.16,
      [ArenaLeague.MASTER]: 0.20,
      [ArenaLeague.LEGENDARY]: 0.25
    };
    return chances[league] || 0.05;
  }

  private static generateRandomItem(league: ArenaLeague): string {
    const items = {
      [ArenaLeague.BRONZE]: ["bronze_chest", "minor_potion"],
      [ArenaLeague.SILVER]: ["silver_chest", "health_potion", "minor_gem"],
      [ArenaLeague.GOLD]: ["gold_chest", "energy_potion", "rare_gem"],
      [ArenaLeague.DIAMOND]: ["diamond_chest", "super_potion", "epic_gem"],
      [ArenaLeague.MASTER]: ["master_chest", "legendary_potion", "master_gem"],
      [ArenaLeague.LEGENDARY]: ["legendary_chest", "mythic_potion", "legendary_gem"]
    };
    
    const leagueItems = items[league] || items[ArenaLeague.BRONZE];
    return leagueItems[Math.floor(Math.random() * leagueItems.length)];
  }

  // ===== MÉTHODES PUBLIQUES ADDITIONNELLES =====

  /**
   * Obtenir l'historique des combats d'un joueur
   */
  public static async getPlayerMatchHistory(
    playerId: string,
    serverId: string,
    limit: number = 20
  ): Promise<ArenaServiceResponse> {
    try {
      const matches = await ArenaMatch.find({
        serverId,
        $or: [{ attackerId: playerId }, { defenderId: playerId }]
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

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
        isRevenge: match.isRevenge,
        createdAt: match.createdAt,
        rewards: match.attackerId === playerId 
          ? (match.battleResult.victory ? match.rewards.winner : match.rewards.loser)
          : (match.battleResult.victory ? match.rewards.loser : match.rewards.winner)
      }));

      return {
        success: true,
        data: { matches: history, total: history.length },
        message: "Match history retrieved successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerMatchHistory:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtenir les combats de vengeance disponibles
   */
  public static async getAvailableRevengeMatches(
    playerId: string,
    serverId: string
  ): Promise<ArenaServiceResponse> {
    try {
      const revengeWindow = this.COMBAT_CONFIG.cooldowns.revengeWindow * 60 * 60 * 1000;
      const recentThreshold = new Date(Date.now() - revengeWindow);

      // Trouver les défaites récentes sans vengeance
      const recentLosses = await ArenaMatch.find({
        serverId,
        defenderId: playerId,
        'battleResult.victory': false,
        isRevenge: false,
        createdAt: { $gte: recentThreshold }
      });

      const revengeOpponents = [];
      for (const match of recentLosses) {
        // Vérifier qu'il n'y a pas déjà eu de vengeance
        const existingRevenge = await ArenaMatch.findOne({
          serverId,
          attackerId: playerId,
          defenderId: match.attackerId,
          originalMatchId: match._id,
          isRevenge: true
        });

        if (!existingRevenge) {
          const attacker = await ArenaPlayer.findOne({ 
            playerId: match.attackerId, 
            serverId 
          }).populate('playerId', 'displayName level');

          if (attacker) {
            const timeRemaining = revengeWindow - (Date.now() - match.createdAt.getTime());
            
            revengeOpponents.push({
              originalMatchId: match._id,
              opponentId: match.attackerId,
              opponentName: match.attackerData.playerName,
              opponentLevel: match.attackerData.level,
              opponentLeague: attacker.currentLeague,
              opponentPower: attacker.defensiveFormation.totalPower,
              originalDefeat: match.createdAt,
              timeRemainingMs: timeRemaining,
              canRevenge: timeRemaining > 0,
              pointsLost: Math.abs(match.pointsExchanged)
            });
          }
        }
      }

      return {
        success: true,
        data: { 
          revengeMatches: revengeOpponents,
          revengeWindowHours: this.COMBAT_CONFIG.cooldowns.revengeWindow
        },
        message: "Available revenge matches retrieved successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur getAvailableRevengeMatches:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Simuler un combat pour prévoir les résultats
   */
  public static async simulateMatch(
    attackerId: string,
    serverId: string,
    defenderId: string
  ): Promise<ArenaServiceResponse> {
    try {
      const [attacker, defender] = await Promise.all([
        ArenaPlayer.findOne({ playerId: attackerId, serverId }),
        ArenaPlayer.findOne({ playerId: defenderId, serverId })
      ]);

      if (!attacker || !defender) {
        return { success: false, error: "One or both players not found" };
      }

      // Simuler l'échange de points pour victoire et défaite
      const winPointsExchange = this.calculatePointsExchange(attacker, defender, true);
      const lossPointsExchange = this.calculatePointsExchange(attacker, defender, false);

      // Simuler les récompenses
      const winRewards = this.calculateAdvancedRewards(attacker, defender, true, ArenaMatchType.RANKED);
      const lossRewards = this.calculateAdvancedRewards(attacker, defender, false, ArenaMatchType.RANKED);

      // Estimer les chances de victoire basées sur la puissance
      const powerDifference = (attacker.defensiveFormation.totalPower - defender.defensiveFormation.totalPower) / defender.defensiveFormation.totalPower;
      let winChance = 0.5; // Base 50%
      
      if (powerDifference > 0.2) winChance = 0.7;
      else if (powerDifference > 0.1) winChance = 0.6;
      else if (powerDifference < -0.2) winChance = 0.3;
      else if (powerDifference < -0.1) winChance = 0.4;

      const simulation = {
        estimatedWinChance: Math.round(winChance * 100),
        powerComparison: {
          attackerPower: attacker.defensiveFormation.totalPower,
          defenderPower: defender.defensiveFormation.totalPower,
          difference: powerDifference
        },
        potentialOutcomes: {
          victory: {
            pointsGained: winPointsExchange.attacker,
            newPoints: attacker.arenaPoints + winPointsExchange.attacker,
            rewards: winRewards.winner,
            newLeague: this.determineLeagueFromPoints(attacker.arenaPoints + winPointsExchange.attacker)
          },
          defeat: {
            pointsLost: Math.abs(lossPointsExchange.attacker),
            newPoints: Math.max(0, attacker.arenaPoints + lossPointsExchange.attacker),
            rewards: lossRewards.loser,
            newLeague: this.determineLeagueFromPoints(Math.max(0, attacker.arenaPoints + lossPointsExchange.attacker))
          }
        }
      };

      return {
        success: true,
        data: simulation,
        message: "Match simulation completed"
      };

    } catch (error: any) {
      console.error("❌ Erreur simulateMatch:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Abandonner un combat en cours (si implémenté)
   */
  public static async forfeitMatch(
    battleId: string,
    playerId: string,
    serverId: string
  ): Promise<ArenaServiceResponse> {
    try {
      // Vérifier que le combat existe et appartient au joueur
      const match = await ArenaMatch.findOne({
        battleId,
        serverId,
        $or: [{ attackerId: playerId }, { defenderId: playerId }]
      });

      if (!match) {
        return { success: false, error: "Match not found or not authorized" };
      }

      // Marquer comme forfait
      match.battleResult.victory = match.attackerId !== playerId; // L'adversaire gagne
      match.battleResult.winnerTeam = match.attackerId === playerId ? "enemy" : "player";
      
      // Appliquer des pénalités réduites
      const forfeitPenalty = -10; // Pénalité fixe pour forfait
      
      if (match.attackerId === playerId) {
        match.pointsExchanged = forfeitPenalty;
        match.attackerPointsAfter = Math.max(0, match.attackerPointsBefore + forfeitPenalty);
      } else {
        // Le défenseur ne peut normalement pas forfait, mais gérer le cas
        match.pointsExchanged = -forfeitPenalty;
        match.defenderPointsAfter = Math.max(0, match.defenderPointsBefore + forfeitPenalty);
      }

      await match.save();

      console.log(`🏳️ Combat ${battleId} forfait par ${playerId}`);

      return {
        success: true,
        data: {
          penaltyPoints: Math.abs(forfeitPenalty),
          message: "Match forfeited"
        },
        message: "Match successfully forfeited"
      };

    } catch (error: any) {
      console.error("❌ Erreur forfeitMatch:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtenir les statistiques de combat d'un joueur
   */
  public static async getPlayerCombatStats(
    playerId: string,
    serverId: string
  ): Promise<ArenaServiceResponse> {
    try {
      const arenaPlayer = await ArenaPlayer.findOne({ playerId, serverId });
      if (!arenaPlayer) {
        return { success: false, error: "Player not found in arena" };
      }

      // Statistiques des matches récents (30 derniers jours)
      const recentThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentMatches = await ArenaMatch.find({
        serverId,
        $or: [{ attackerId: playerId }, { defenderId: playerId }],
        createdAt: { $gte: recentThreshold }
      });

      let recentWins = 0;
      let recentLosses = 0;
      let totalDamage = 0;
      let averageDuration = 0;

      recentMatches.forEach(match => {
        const won = (match.attackerId === playerId && match.battleResult.victory) ||
                   (match.defenderId === playerId && !match.battleResult.victory);
        
        if (won) recentWins++;
        else recentLosses++;
        
        totalDamage += match.battleResult.stats?.totalDamageDealt || 0;
        averageDuration += match.duration;
      });

      if (recentMatches.length > 0) {
        averageDuration = Math.round(averageDuration / recentMatches.length);
      }

      const stats = {
        currentSeason: {
          wins: arenaPlayer.seasonWins,
          losses: arenaPlayer.seasonLosses,
          winRate: arenaPlayer.seasonWins + arenaPlayer.seasonLosses > 0 
            ? Math.round((arenaPlayer.seasonWins / (arenaPlayer.seasonWins + arenaPlayer.seasonLosses)) * 100)
            : 0,
          winStreak: arenaPlayer.seasonWinStreak,
          bestWinStreak: arenaPlayer.seasonBestWinStreak
        },
        recent30Days: {
          wins: recentWins,
          losses: recentLosses,
          winRate: recentWins + recentLosses > 0 
            ? Math.round((recentWins / (recentWins + recentLosses)) * 100)
            : 0,
          totalMatches: recentMatches.length,
          averageDuration: averageDuration,
          totalDamage
        },
        allTime: {
          wins: arenaPlayer.totalWins,
          losses: arenaPlayer.totalLosses,
          winRate: arenaPlayer.totalWins + arenaPlayer.totalLosses > 0 
            ? Math.round((arenaPlayer.totalWins / (arenaPlayer.totalWins + arenaPlayer.totalLosses)) * 100)
            : 0,
          totalMatches: arenaPlayer.totalMatches
        },
        progression: {
          currentLeague: arenaPlayer.currentLeague,
          currentRank: arenaPlayer.currentRank,
          highestRank: arenaPlayer.highestRank,
          arenaPoints: arenaPlayer.arenaPoints,
          seasonTokens: arenaPlayer.seasonTokens
        }
      };

      return {
        success: true,
        data: stats,
        message: "Combat statistics retrieved successfully"
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerCombatStats:", error);
      return { success: false, error: error.message };
    }
  }
}

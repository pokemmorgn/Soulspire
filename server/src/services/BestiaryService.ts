// server/src/services/BestiaryService.ts
import BestiaryEntry, { IBestiaryEntryDocument, BestiaryLevel } from "../models/BestiaryEntry";
import Monster from "../models/Monster";
import Player from "../models/Player";
import { WebSocketService } from "./WebSocketService";

/**
 * 📖 BESTIARY SERVICE
 * 
 * Gère le système de collection de monstres (Monster Encyclopedia).
 * Auto-unlock après combats, récompenses de progression, statistiques.
 */

interface IRewardItem {
  type: "gems" | "gold" | "tickets" | "bonus" | "title" | "avatar";
  amount?: number;
  identifier?: string;
  description?: string;
}

export class BestiaryService {

  /**
   * 🎯 MÉTHODE PRINCIPALE : Enregistrer une rencontre après un combat
   * 
   * Appelé automatiquement depuis BattleService après chaque combat.
   */
  public static async recordMonsterEncounter(
    playerId: string,
    serverId: string,
    monsterId: string,
    defeated: boolean,
    damageDealt: number,
    damageTaken: number,
    killTime?: number
  ): Promise<{
    entry: IBestiaryEntryDocument;
    newDiscovery: boolean;
    levelUp: boolean;
    rewards: IRewardItem[];
  }> {
    try {
      console.log(`📖 Enregistrement rencontre: ${playerId} vs ${monsterId} (${defeated ? "Victoire" : "Défaite"})`);

      // 1. Récupérer les données du monstre
      const monsterData = await Monster.findOne({ monsterId });
      if (!monsterData) {
        throw new Error(`Monster ${monsterId} not found`);
      }

      // 2. Obtenir ou créer l'entrée du bestiaire
      const entry = await BestiaryEntry.getOrCreate(playerId, serverId, monsterId, {
        name: monsterData.name,
        element: monsterData.element,
        role: monsterData.role,
        type: monsterData.type,
        visualTheme: monsterData.visualTheme,
        rarity: monsterData.rarity
      });

      const wasDiscovered = entry.isDiscovered;
      const previousLevel = entry.progressionLevel;

      // 3. Enregistrer la rencontre
      await entry.recordEncounter(defeated, damageDealt, damageTaken, killTime);

      // 4. Déterminer si nouvelle découverte ou level up
      const newDiscovery = !wasDiscovered && entry.isDiscovered;
      const levelUp = previousLevel !== entry.progressionLevel;

      // 5. Calculer les récompenses
      const rewards = await this.calculateRewards(entry, newDiscovery, levelUp, previousLevel);

      // 6. Appliquer les récompenses au joueur
      if (rewards.length > 0) {
        await this.applyRewards(playerId, serverId, rewards);
      }

// 7. Notifications WebSocket
      try {
        if (newDiscovery) {
          WebSocketService.notifyBestiaryDiscovery(playerId, {
            monsterId: entry.monsterId,
            monsterName: entry.monsterSnapshot.name,
            monsterType: entry.monsterSnapshot.type,
            element: entry.monsterSnapshot.element,
            rewards: rewards.filter(r => r.type === "gems" || r.type === "gold").map(r => ({
              type: r.type,
              amount: r.amount || 0
            }))
          });
          
          console.log(`🔔 Discovery notification sent: ${entry.monsterSnapshot.name}`);
        }

        if (levelUp && previousLevel !== "Undiscovered") {
          WebSocketService.notifyBestiaryLevelUp(playerId, {
            monsterId: entry.monsterId,
            monsterName: entry.monsterSnapshot.name,
            previousLevel,
            newLevel: entry.progressionLevel,
            rewards: rewards.map(r => ({
              type: r.type,
              amount: r.amount,
              identifier: r.identifier,
              description: r.description
            })),
            unlockedFeatures: this.getUnlockedFeatures(entry.progressionLevel)
          });
          
          console.log(`🔔 Level up notification sent: ${entry.monsterSnapshot.name} → ${entry.progressionLevel}`);
        }
      } catch (wsError) {
        console.error("❌ Erreur notification WebSocket bestiaire:", wsError);
        // Ne pas faire échouer la requête pour des erreurs de notification
      }

      return {
        entry,
        newDiscovery,
        levelUp,
        rewards
      };

    } catch (error: any) {
      console.error("❌ Erreur recordMonsterEncounter:", error);
      throw error;
    }
  }

  /**
   * 💰 Calculer les récompenses selon la progression
   */
  private static async calculateRewards(
    entry: IBestiaryEntryDocument,
    newDiscovery: boolean,
    levelUp: boolean,
    previousLevel: BestiaryLevel
  ): Promise<IRewardItem[]> {
    const rewards: IRewardItem[] = [];

    // Récompense de découverte
    if (newDiscovery) {
      const discoveryReward = this.getDiscoveryReward(entry.monsterSnapshot.type, entry.monsterSnapshot.rarity);
      rewards.push(...discoveryReward);
    }

    // Récompenses de level up
    if (levelUp) {
      const levelRewards = this.getLevelUpRewards(entry.progressionLevel, entry.monsterSnapshot.type);
      rewards.push(...levelRewards);
    }

    return rewards;
  }

  /**
   * 🎁 Récompenses de découverte (première rencontre)
   */
  private static getDiscoveryReward(monsterType: string, rarity: string): IRewardItem[] {
    const rewards: IRewardItem[] = [];

    // Gems selon le type
    const gemsByType: Record<string, number> = {
      normal: 10,
      elite: 25,
      boss: 50
    };

    const gemsAmount = gemsByType[monsterType] || 10;

    // Multiplicateur de rareté
    const rarityMultipliers: Record<string, number> = {
      Common: 1.0,
      Rare: 1.25,
      Epic: 1.5,
      Legendary: 2.0,
      Mythic: 2.5
    };

    const multiplier = rarityMultipliers[rarity] || 1.0;
    const finalGems = Math.floor(gemsAmount * multiplier);

    rewards.push({
      type: "gems",
      amount: finalGems,
      description: "Récompense de découverte"
    });

    // Gold bonus
    rewards.push({
      type: "gold",
      amount: finalGems * 2,
      description: "Bonus or de découverte"
    });

    return rewards;
  }

  /**
   * 🏆 Récompenses de level up (Novice, Veteran, Master)
   */
  private static getLevelUpRewards(level: BestiaryLevel, monsterType: string): IRewardItem[] {
    const rewards: IRewardItem[] = [];

    // Novice (10 kills)
    if (level === "Novice") {
      rewards.push({
        type: "gems",
        amount: monsterType === "boss" ? 100 : monsterType === "elite" ? 50 : 25,
        description: "Rang Novice atteint"
      });
    }

    // Veteran (50 kills)
    if (level === "Veteran") {
      rewards.push({
        type: "gems",
        amount: monsterType === "boss" ? 250 : monsterType === "elite" ? 150 : 75,
        description: "Rang Veteran atteint"
      });

      rewards.push({
        type: "bonus",
        identifier: "lore_unlocked",
        description: "Lore du monstre débloqué"
      });

      rewards.push({
        type: "bonus",
        identifier: "drops_unlocked",
        description: "Liste des drops débloquée"
      });
    }

    // Master (100 kills)
    if (level === "Master") {
      rewards.push({
        type: "gems",
        amount: monsterType === "boss" ? 500 : monsterType === "elite" ? 300 : 150,
        description: "Rang Master atteint !"
      });

      rewards.push({
        type: "bonus",
        identifier: `master_bonus_${monsterType}`,
        description: `+5% dégâts et défense contre les ${monsterType}`
      });

      // Titre spécial pour les boss
      if (monsterType === "boss") {
        rewards.push({
          type: "title",
          identifier: "boss_slayer",
          description: "Titre: Boss Slayer"
        });
      }
    }

    return rewards;
  }

  /**
   * 💎 Appliquer les récompenses au joueur
   */
  private static async applyRewards(
    playerId: string,
    serverId: string,
    rewards: IRewardItem[]
  ): Promise<void> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        console.warn(`⚠️ Joueur ${playerId} introuvable pour appliquer récompenses`);
        return;
      }

      let gemsTotal = 0;
      let goldTotal = 0;
      let ticketsTotal = 0;

      for (const reward of rewards) {
        switch (reward.type) {
          case "gems":
            gemsTotal += reward.amount || 0;
            break;

          case "gold":
            goldTotal += reward.amount || 0;
            break;

          case "tickets":
            ticketsTotal += reward.amount || 0;
            break;

          case "title":
          case "avatar":
          case "bonus":
            // TODO: Gérer les titres, avatars et bonus permanents
            console.log(`🎁 ${reward.type} reçu: ${reward.identifier}`);
            break;
        }
      }

      // Appliquer les monnaies
      if (gemsTotal > 0) player.gems += gemsTotal;
      if (goldTotal > 0) player.gold += goldTotal;
      if (ticketsTotal > 0) player.tickets += ticketsTotal;

      await player.save();

      console.log(`💰 Récompenses appliquées: ${gemsTotal} gems, ${goldTotal} or, ${ticketsTotal} tickets`);

    } catch (error: any) {
      console.error("❌ Erreur applyRewards:", error);
    }
  }
/**
   * 📋 Déterminer les fonctionnalités débloquées par niveau
   */
  private static getUnlockedFeatures(level: BestiaryLevel): string[] {
    const features: Record<BestiaryLevel, string[]> = {
      Undiscovered: [],
      Discovered: ["basic_info", "encounter_count"],
      Novice: ["full_stats", "damage_tracking", "kill_times"],
      Veteran: ["lore", "drop_list", "advanced_stats"],
      Master: ["damage_bonus", "defense_bonus", "special_title"]
    };

    return features[level] || [];
  }
  /**
   * 🎁 Déterminer le type de récompense depuis son ID
   */
  private static getRewardType(rewardId: string): 'type_completion' | 'element_completion' | 'full_completion' {
    if (rewardId.includes('bestiary_complete')) return 'full_completion';
    if (rewardId.includes('element')) return 'element_completion';
    return 'type_completion';
  }
  /**
   * 📋 Récupérer tout le bestiaire d'un joueur
   */
  public static async getPlayerBestiary(
    playerId: string,
    serverId: string,
    filters?: {
      element?: string;
      type?: "normal" | "elite" | "boss";
      progressionLevel?: BestiaryLevel;
      isDiscovered?: boolean;
    }
  ): Promise<{
    entries: any[];
    stats: any;
    totalMonsters: number;
  }> {
    try {
      console.log(`📖 Récupération bestiaire pour ${playerId}`);

      // 1. Récupérer toutes les entrées du joueur
      const entries = await BestiaryEntry.getPlayerBestiary(playerId, serverId, filters);

      // 2. Obtenir le total de monstres dans le jeu
      const totalMonsters = await Monster.countDocuments({});

      // 3. Créer des entrées vides pour les monstres non découverts
      const discoveredMonsterIds = entries.map(e => e.monsterId);
      const allMonsters = await Monster.find({}).select("monsterId name element role type visualTheme rarity");

      const allEntries = allMonsters.map(monster => {
        const existing = entries.find(e => e.monsterId === monster.monsterId);

        if (existing) {
          return existing.getBestiaryInfo(true);
        } else {
          // Monstre non découvert - retourner silhouette
          return {
            monsterId: monster.monsterId,
            progressionLevel: "Undiscovered",
            progressPercentage: 0,
            isDiscovered: false,
            monster: {
              name: "???",
              element: "Unknown",
              type: "Unknown",
              visualTheme: "Unknown"
            },
            basicStats: null,
            pendingRewards: {
              discovery: false,
              novice: false,
              veteran: false,
              master: false
            }
          };
        }
      });

      // 4. Obtenir les statistiques
      const stats = await BestiaryEntry.getPlayerStats(playerId, serverId);

      return {
        entries: allEntries,
        stats,
        totalMonsters
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerBestiary:", error);
      throw error;
    }
  }

  /**
   * 📊 Obtenir les statistiques du bestiaire
   */
  public static async getBestiaryStats(
    playerId: string,
    serverId: string
  ): Promise<any> {
    try {
      const stats = await BestiaryEntry.getPlayerStats(playerId, serverId);
      const totalMonsters = await Monster.countDocuments({});

      return {
        ...stats,
        totalMonstersInGame: totalMonsters,
        completionPercentage: totalMonsters > 0 ?
          Math.floor((stats.discovered / totalMonsters) * 100) : 0
      };

    } catch (error: any) {
      console.error("❌ Erreur getBestiaryStats:", error);
      throw error;
    }
  }

  /**
   * 🔍 Obtenir les détails d'une entrée spécifique
   */
  public static async getMonsterEntry(
    playerId: string,
    serverId: string,
    monsterId: string
  ): Promise<any> {
    try {
      const entry = await BestiaryEntry.findOne({ playerId, serverId, monsterId });

      if (!entry) {
        // Monstre jamais rencontré
        const monster = await Monster.findOne({ monsterId });
        if (!monster) {
          throw new Error("Monster not found");
        }

        return {
          monsterId,
          progressionLevel: "Undiscovered",
          isDiscovered: false,
          monster: {
            name: "???",
            element: "Unknown",
            type: "Unknown",
            visualTheme: "Unknown"
          },
          message: "Ce monstre n'a pas encore été rencontré"
        };
      }

      return entry.getBestiaryInfo(true);

    } catch (error: any) {
      console.error("❌ Erreur getMonsterEntry:", error);
      throw error;
    }
  }

  /**
   * 🎁 Obtenir les récompenses de complétion disponibles
   */
  public static async getCompletionRewards(
    playerId: string,
    serverId: string
  ): Promise<any> {
    try {
      const rewards = await BestiaryEntry.getCompletionRewards(playerId, serverId);
      return rewards;

    } catch (error: any) {
      console.error("❌ Erreur getCompletionRewards:", error);
      throw error;
    }
  }

  /**
   * 💎 Réclamer une récompense de complétion
   */
  public static async claimCompletionReward(
    playerId: string,
    serverId: string,
    rewardId: string
  ): Promise<{
    success: boolean;
    reward?: any;
    message: string;
  }> {
    try {
      console.log(`🎁 Réclamation récompense: ${rewardId} par ${playerId}`);

      const completionRewards = await this.getCompletionRewards(playerId, serverId);

      // Vérifier si la récompense existe et est disponible
      const availableReward = completionRewards.available.find((r: any) => r.id === rewardId);

      if (!availableReward) {
        return {
          success: false,
          message: "Récompense non disponible ou déjà réclamée"
        };
      }

      // Appliquer la récompense
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      if (availableReward.gems) {
        player.gems += availableReward.gems;
      }

      if (availableReward.gold) {
        player.gold += availableReward.gold;
      }

      await player.save();

    console.log(`✅ Récompense ${rewardId} réclamée: ${availableReward.gems} gems`);

      // Notification WebSocket
      try {
        WebSocketService.notifyBestiaryRewardClaimed(playerId, {
          rewardId,
          rewardType: this.getRewardType(rewardId),
          rewards: {
            gems: availableReward.gems,
            gold: availableReward.gold,
            title: availableReward.title,
            bonus: availableReward.bonus
          },
          completionPercentage: (await this.getBestiaryStats(playerId, serverId)).completionPercentage
        });
        
        console.log(`🔔 Reward claimed notification sent: ${rewardId}`);
      } catch (wsError) {
        console.error("❌ Erreur notification WebSocket reward:", wsError);
      }

      return {
        success: true,
        reward: availableReward,
        message: "Récompense réclamée avec succès !"
      };

    } catch (error: any) {
      console.error("❌ Erreur claimCompletionReward:", error);
      throw error;
    }
  }

  /**
   * 🔓 Débloquer manuellement un monstre (admin/debug)
   */
  public static async unlockMonster(
    playerId: string,
    serverId: string,
    monsterId: string
  ): Promise<IBestiaryEntryDocument> {
    try {
      console.log(`🔓 Unlock manuel: ${monsterId} pour ${playerId}`);

      const monsterData = await Monster.findOne({ monsterId });
      if (!monsterData) {
        throw new Error("Monster not found");
      }

      const entry = await BestiaryEntry.getOrCreate(playerId, serverId, monsterId, {
        name: monsterData.name,
        element: monsterData.element,
        role: monsterData.role,
        type: monsterData.type,
        visualTheme: monsterData.visualTheme,
        rarity: monsterData.rarity
      });

      if (!entry.isDiscovered) {
        entry.isDiscovered = true;
        entry.progressionLevel = "Discovered";
        entry.combatStats.firstEncounteredAt = new Date();
        await entry.save();
      }

      return entry;

    } catch (error: any) {
      console.error("❌ Erreur unlockMonster:", error);
      throw error;
    }
  }

  /**
   * 📈 Obtenir le classement des joueurs (leaderboard)
   */
  public static async getBestiaryLeaderboard(
    serverId: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      // Aggrégation pour obtenir les meilleurs collectionneurs
      const leaderboard = await BestiaryEntry.aggregate([
        { $match: { serverId } },
        {
          $group: {
            _id: "$playerId",
            totalDiscovered: { $sum: { $cond: ["$isDiscovered", 1, 0] } },
            totalMastered: { $sum: { $cond: [{ $eq: ["$progressionLevel", "Master"] }, 1, 0] } },
            totalDefeats: { $sum: "$combatStats.timesDefeated" },
            totalDamage: { $sum: "$combatStats.totalDamageDealt" }
          }
        },
        { $sort: { totalDiscovered: -1, totalMastered: -1 } },
        { $limit: limit }
      ]);

      // Enrichir avec les infos joueur
      const enrichedLeaderboard = await Promise.all(
        leaderboard.map(async (entry: any) => {
          const player = await Player.findOne({ _id: entry._id, serverId }).select("displayName level");
          return {
            playerId: entry._id,
            playerName: player?.displayName || "Unknown",
            playerLevel: player?.level || 1,
            totalDiscovered: entry.totalDiscovered,
            totalMastered: entry.totalMastered,
            totalDefeats: entry.totalDefeats,
            totalDamage: entry.totalDamage
          };
        })
      );

      return enrichedLeaderboard;

    } catch (error: any) {
      console.error("❌ Erreur getBestiaryLeaderboard:", error);
      throw error;
    }
  }

  /**
   * 🎯 Obtenir les monstres les plus combattus (global ou par joueur)
   */
  public static async getMostFoughtMonsters(
    serverId: string,
    playerId?: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const matchStage: any = { serverId };
      if (playerId) matchStage.playerId = playerId;

      const mostFought = await BestiaryEntry.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$monsterId",
            totalEncounters: { $sum: "$combatStats.timesEncountered" },
            totalDefeats: { $sum: "$combatStats.timesDefeated" },
            totalDeaths: { $sum: "$combatStats.timesKilledBy" },
            monsterInfo: { $first: "$monsterSnapshot" }
          }
        },
        { $sort: { totalEncounters: -1 } },
        { $limit: limit }
      ]);

      return mostFought.map((m: any) => ({
        monsterId: m._id,
        name: m.monsterInfo.name,
        element: m.monsterInfo.element,
        type: m.monsterInfo.type,
        totalEncounters: m.totalEncounters,
        totalDefeats: m.totalDefeats,
        totalDeaths: m.totalDeaths,
        winRate: m.totalEncounters > 0 ?
          Math.floor((m.totalDefeats / m.totalEncounters) * 100) : 0
      }));

    } catch (error: any) {
      console.error("❌ Erreur getMostFoughtMonsters:", error);
      throw error;
    }
  }
}

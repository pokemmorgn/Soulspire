import Player from "../models/Player";
import Hero from "../models/Hero";
import Summon from "../models/Summon";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";

// Configuration des taux et coûts
const GACHA_CONFIG = {
  costs: {
    single: { gems: 300 },
    multi: { gems: 2700 }, // Réduction pour 10 invocations
    ticket: { tickets: 1 }
  },
  rates: {
    standard: {
      Common: 50,
      Rare: 30,
      Epic: 15,
      Legendary: 5
    },
    limited: {
      Common: 40,
      Rare: 35,
      Epic: 20,
      Legendary: 5
    }
  },
  pity: {
    legendary: 90, // Garanti au bout de 90 pulls sans legendary
    epic: 10      // Garanti au bout de 10 pulls sans epic
  }
};

export interface GachaPullResult {
  hero: any;
  rarity: string;
  isNew: boolean;
  fragmentsGained: number;
}

export interface GachaResponse {
  success: boolean;
  results: GachaPullResult[];
  stats: {
    legendary: number;
    epic: number;
    rare: number;
    common: number;
    newHeroes: number;
    totalFragments: number;
  };
  cost: {
    gems?: number;
    tickets?: number;
  };
  remaining: {
    gems: number;
    tickets: number;
  };
  pityStatus: {
    pullsSinceLegendary: number;
    pullsSinceEpic: number;
    legendaryPityIn: number;
    epicPityIn: number;
  };
}

export class GachaService {

  // === EFFECTUER UNE INVOCATION (SINGLE/MULTI) ===
  public static async performPull(
    playerId: string,
    serverId: string,
    pullType: "Standard" | "Limited" | "Ticket",
    count: number = 1
  ): Promise<GachaResponse> {
    try {
      console.log(`🎰 ${playerId} effectue ${count} pulls ${pullType} sur serveur ${serverId}`);

      // Récupérer le joueur avec vérification serveur
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found on this server");
      }

      // Vérifier et déduire le coût
      const costCheck = await this.checkAndDeductCost(player, pullType, count);
      if (!costCheck.success) {
        throw new Error(costCheck.error);
      }

      // Calculer le système de pity
      const pityStatus = await this.calculatePityStatus(playerId, serverId);

      // Effectuer les pulls
      const pullResults = await this.executePulls(
        player,
        pullType,
        count,
        pityStatus
      );

      // Enregistrer l'invocation
      await this.recordSummon(playerId, pullResults, pullType);

      // Mettre à jour les missions et événements
      await this.updateProgressTracking(playerId, serverId, count);

      // Calculer les statistiques finales
      const finalStats = this.calculatePullStats(pullResults);

      // Nouveau statut pity
      const newPityStatus = {
        pullsSinceLegendary: pityStatus.pullsSinceLegendary + count,
        pullsSinceEpic: pityStatus.pullsSinceEpic + count,
        legendaryPityIn: Math.max(0, GACHA_CONFIG.pity.legendary - (pityStatus.pullsSinceLegendary + count)),
        epicPityIn: Math.max(0, GACHA_CONFIG.pity.epic - (pityStatus.pullsSinceEpic + count))
      };

      // Reset pity si des légendaires/épiques ont été obtenus
      const legendaryCount = pullResults.filter(r => r.rarity === "Legendary").length;
      const epicCount = pullResults.filter(r => r.rarity === "Epic").length;
      
      if (legendaryCount > 0) {
        newPityStatus.pullsSinceLegendary = 0;
        newPityStatus.pullsSinceEpic = 0;
        newPityStatus.legendaryPityIn = GACHA_CONFIG.pity.legendary;
        newPityStatus.epicPityIn = GACHA_CONFIG.pity.epic;
      } else if (epicCount > 0) {
        newPityStatus.pullsSinceEpic = 0;
        newPityStatus.epicPityIn = GACHA_CONFIG.pity.epic;
      }

      console.log(`✅ Gacha complété: ${pullResults.length} héros obtenus, ${finalStats.newHeroes} nouveaux`);

      return {
        success: true,
        results: pullResults,
        stats: finalStats,
        cost: costCheck.cost,
        remaining: {
          gems: player.gems,
          tickets: player.tickets
        },
        pityStatus: newPityStatus
      };

    } catch (error: any) {
      console.error("❌ Erreur performPull:", error);
      throw error;
    }
  }

  // === RÉCUPÉRER L'HISTORIQUE D'INVOCATIONS ===
  public static async getSummonHistory(
    playerId: string,
    serverId: string,
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const skip = (page - 1) * limit;

      const [summons, total] = await Promise.all([
        Summon.find({ playerId })
          .populate("heroesObtained.heroId", "name role element rarity")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Summon.countDocuments({ playerId })
      ]);

      const pagination = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      };

      return {
        success: true,
        summons,
        pagination
      };

    } catch (error: any) {
      console.error("❌ Erreur getSummonHistory:", error);
      throw error;
    }
  }

  // === RÉCUPÉRER LES STATISTIQUES D'INVOCATION ===
  public static async getSummonStats(playerId: string, serverId: string) {
    try {
      // Statistiques par rareté
      const rarityStats = await Summon.aggregate([
        { $match: { playerId: playerId } },
        { $unwind: "$heroesObtained" },
        { $group: {
          _id: "$heroesObtained.rarity",
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]);

      // Statistiques totales
      const totalStats = await Summon.aggregate([
        { $match: { playerId: playerId } },
        { $group: {
          _id: null,
          totalSummons: { $sum: { $size: "$heroesObtained" } },
          totalSessions: { $sum: 1 }
        }}
      ]);

      const stats = {
        totalSummons: totalStats[0]?.totalSummons || 0,
        totalSessions: totalStats[0]?.totalSessions || 0,
        rarityDistribution: rarityStats.reduce((acc: any, stat: any) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {} as Record<string, number>)
      };

      // Calculer les taux réels
      if (stats.totalSummons > 0) {
        Object.keys(stats.rarityDistribution).forEach(rarity => {
          (stats as any)[`${rarity.toLowerCase()}Rate`] = 
            ((stats.rarityDistribution[rarity] / stats.totalSummons) * 100).toFixed(2) + "%";
        });
      }

      // Statut pity actuel
      const pityStatus = await this.calculatePityStatus(playerId, serverId);

      return {
        success: true,
        stats: {
          ...stats,
          pityStatus
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getSummonStats:", error);
      throw error;
    }
  }

  // === RÉCUPÉRER LES TAUX DE DROP ===
  public static getDropRates() {
    return {
      success: true,
      rates: GACHA_CONFIG.rates,
      costs: GACHA_CONFIG.costs,
      pity: GACHA_CONFIG.pity,
      info: {
        guarantees: {
          epic: "1 Epic minimum every 10 pulls",
          legendary: "1 Legendary guaranteed after 90 pulls without one"
        },
        multiPullBonus: "10x pull costs 2700 gems instead of 3000 (10% discount)"
      }
    };
  }

  // === MÉTHODES PRIVÉES ===

  // Vérifier et déduire le coût
  private static async checkAndDeductCost(
    player: any,
    pullType: "Standard" | "Limited" | "Ticket",
    count: number
  ) {
    let totalCost: { gems?: number; tickets?: number } = {};
    
    if (pullType === "Ticket") {
      totalCost.tickets = count;
      if (player.tickets < totalCost.tickets) {
        return {
          success: false,
          error: `Insufficient tickets. Required: ${totalCost.tickets}, Available: ${player.tickets}`
        };
      }
    } else {
      totalCost.gems = count === 1 ? 
        GACHA_CONFIG.costs.single.gems : 
        GACHA_CONFIG.costs.multi.gems;
      
      if (player.gems < totalCost.gems) {
        return {
          success: false,
          error: `Insufficient gems. Required: ${totalCost.gems}, Available: ${player.gems}`
        };
      }
    }

    // Déduire le coût
    if (totalCost.gems) player.gems -= totalCost.gems;
    if (totalCost.tickets) player.tickets -= totalCost.tickets;
    
    await player.save();

    return {
      success: true,
      cost: totalCost
    };
  }

  // Calculer le statut pity
  private static async calculatePityStatus(playerId: string, serverId: string) {
    const recentSummons = await Summon.find({ playerId })
      .sort({ createdAt: -1 })
      .limit(100);

    let pullsSinceLegendary = 0;
    let pullsSinceEpic = 0;

    for (const summon of recentSummons) {
      for (const hero of summon.heroesObtained) {
        if (hero.rarity === "Legendary") {
          pullsSinceLegendary = 0;
          break;
        }
        if (hero.rarity === "Epic") {
          pullsSinceEpic = 0;
        }
        pullsSinceLegendary++;
        pullsSinceEpic++;
      }
      if (pullsSinceLegendary === 0) break;
    }

    return {
      pullsSinceLegendary,
      pullsSinceEpic,
      legendaryPityIn: Math.max(0, GACHA_CONFIG.pity.legendary - pullsSinceLegendary),
      epicPityIn: Math.max(0, GACHA_CONFIG.pity.epic - pullsSinceEpic)
    };
  }

  // Exécuter les pulls
  private static async executePulls(
    player: any,
    pullType: "Standard" | "Limited" | "Ticket",
    count: number,
    pityStatus: any
  ): Promise<GachaPullResult[]> {
    
    const results: GachaPullResult[] = [];
    const rates = GACHA_CONFIG.rates[pullType.toLowerCase() as keyof typeof GACHA_CONFIG.rates] || GACHA_CONFIG.rates.standard;

    for (let i = 0; i < count; i++) {
      let rarity: string;
      
      // Système de pity
      if (pityStatus.pullsSinceLegendary + i >= GACHA_CONFIG.pity.legendary) {
        rarity = "Legendary";
      } else if (pityStatus.pullsSinceEpic + i >= GACHA_CONFIG.pity.epic) {
        rarity = "Epic";
      } else {
        // Tirage normal basé sur les taux
        rarity = this.rollRarity(rates);
      }

      // Sélection d'un héros de cette rareté
      const availableHeroes = await Hero.find({ rarity });
      if (availableHeroes.length === 0) {
        throw new Error(`No heroes available for rarity: ${rarity}`);
      }

      const selectedHero = availableHeroes[Math.floor(Math.random() * availableHeroes.length)];
      
      // Vérifier si le joueur possède déjà ce héros
      const existingHero = player.heroes.find((h: any) => h.heroId.toString() === (selectedHero._id as any).toString());
      
      if (existingHero) {
        // Conversion en fragments si héros déjà possédé
        const fragmentsGained = this.getFragmentsByRarity(rarity);
        const currentFragments = player.fragments.get((selectedHero._id as any).toString()) || 0;
        player.fragments.set((selectedHero._id as any).toString(), currentFragments + fragmentsGained);
        
        results.push({
          hero: selectedHero,
          rarity,
          isNew: false,
          fragmentsGained
        });
      } else {
        // Nouveau héros
        player.heroes.push({
          heroId: (selectedHero._id as any).toString(),
          level: 1,
          stars: 1,
          equipped: false
        });
        
        results.push({
          hero: selectedHero,
          rarity,
          isNew: true,
          fragmentsGained: 0
        });
      }
    }

    await player.save();
    return results;
  }

  // Tirer une rareté selon les taux
  private static rollRarity(rates: Record<string, number>): string {
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    for (const [rarityName, rate] of Object.entries(rates)) {
      cumulative += rate;
      if (rand < cumulative) {
        return rarityName;
      }
    }
    
    return "Common"; // Fallback
  }

  // Obtenir le nombre de fragments selon la rareté
  private static getFragmentsByRarity(rarity: string): number {
    const fragmentsByRarity: Record<string, number> = {
      Common: 5,
      Rare: 10,
      Epic: 15,
      Legendary: 25
    };
    
    return fragmentsByRarity[rarity] || 5;
  }

  // Enregistrer l'invocation
  private static async recordSummon(
    playerId: string,
    results: GachaPullResult[],
    pullType: "Standard" | "Limited" | "Ticket"
  ) {
    const summon = new Summon({
      playerId,
      heroesObtained: results.map(r => ({
        heroId: r.hero._id,
        rarity: r.rarity
      })),
      type: pullType
    });
    
    await summon.save();
  }

  // Mettre à jour le suivi de progression
  private static async updateProgressTracking(
    playerId: string,
    serverId: string,
    count: number
  ) {
    try {
      await Promise.all([
        MissionService.updateProgress(
          playerId,
          serverId,
          "gacha_pulls",
          count
        ),
        EventService.updatePlayerProgress(
          playerId,
          serverId,
          "gacha_pulls",
          count
        )
      ]);
      
      console.log(`📊 Progression missions/événements mise à jour: ${count} pulls gacha`);
    } catch (error) {
      console.error("⚠️ Erreur mise à jour progression gacha:", error);
      // Ne pas faire échouer le gacha pour ça
    }
  }

  // Calculer les statistiques des pulls
  private static calculatePullStats(results: GachaPullResult[]) {
    return {
      legendary: results.filter(r => r.rarity === "Legendary").length,
      epic: results.filter(r => r.rarity === "Epic").length,
      rare: results.filter(r => r.rarity === "Rare").length,
      common: results.filter(r => r.rarity === "Common").length,
      newHeroes: results.filter(r => r.isNew).length,
      totalFragments: results.reduce((sum, r) => sum + r.fragmentsGained, 0)
    };
  }
}

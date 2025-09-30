import Player from "../models/Player";
import Hero from "../models/Hero";
import Summon from "../models/Summon";

/**
 * Service de gestion de la collection de héros
 * Centralise toutes les opérations liées à la progression de collection
 */
export class CollectionService {
  
  // Cache simple en mémoire (TTL 5 minutes)
  private static cache = new Map<string, {
    data: CollectionProgress;
    timestamp: number;
  }>();
  
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Obtenir la progression de collection d'un joueur avec cache
   */
  public static async getPlayerCollectionProgress(playerId: string): Promise<CollectionProgress> {
    // Vérifier le cache
    const cached = this.cache.get(playerId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Récupérer les données fraîches
    const [player, totalHeroes] = await Promise.all([
      Player.findById(playerId).select('heroes'),
      Hero.countDocuments()
    ]);

    if (!player) {
      throw new Error("Player not found");
    }

    const ownedHeroes = player.heroes.length;
    const completionPercentage = totalHeroes > 0 
      ? Math.round((ownedHeroes / totalHeroes) * 100) 
      : 0;

    const progress: CollectionProgress = {
      totalHeroes,
      ownedHeroes,
      completionPercentage
    };

    // Mettre en cache
    this.cache.set(playerId, {
      data: progress,
      timestamp: Date.now()
    });

    return progress;
  }

  /**
   * Obtenir la progression détaillée avec répartition par rareté
   */
  public static async getDetailedCollectionProgress(playerId: string): Promise<DetailedCollectionProgress> {
    const player = await Player.findById(playerId);
    
    if (!player) {
      throw new Error("Player not found");
    }

    // ✅ CORRECTION : Récupérer les IDs des héros possédés
    const ownedHeroIds = player.heroes.map(h => h.heroId);

    // ✅ CORRECTION : Récupérer les héros complets depuis la collection Hero
    const ownedHeroesData = await Hero.find({ _id: { $in: ownedHeroIds } });

    // Compter les héros par rareté
    const ownedByRarity = {
      Common: 0,
      Rare: 0,
      Epic: 0,
      Legendary: 0
    };

    ownedHeroesData.forEach((hero: any) => {
      const rarity = hero.rarity;
      if (rarity && rarity in ownedByRarity) {
        ownedByRarity[rarity as keyof typeof ownedByRarity]++;
      }
    });

    // Compter le total de héros disponibles par rareté
    const totalByRarity = await Hero.aggregate([
      {
        $group: {
          _id: "$rarity",
          count: { $sum: 1 }
        }
      }
    ]);

    const totalByRarityMap: Record<string, number> = {};
    totalByRarity.forEach(item => {
      totalByRarityMap[item._id] = item.count;
    });

    const basicProgress = await this.getPlayerCollectionProgress(playerId);

    return {
      ...basicProgress,
      byRarity: {
        Common: {
          owned: ownedByRarity.Common,
          total: totalByRarityMap.Common || 0,
          percentage: this.calculatePercentage(ownedByRarity.Common, totalByRarityMap.Common)
        },
        Rare: {
          owned: ownedByRarity.Rare,
          total: totalByRarityMap.Rare || 0,
          percentage: this.calculatePercentage(ownedByRarity.Rare, totalByRarityMap.Rare)
        },
        Epic: {
          owned: ownedByRarity.Epic,
          total: totalByRarityMap.Epic || 0,
          percentage: this.calculatePercentage(ownedByRarity.Epic, totalByRarityMap.Epic)
        },
        Legendary: {
          owned: ownedByRarity.Legendary,
          total: totalByRarityMap.Legendary || 0,
          percentage: this.calculatePercentage(ownedByRarity.Legendary, totalByRarityMap.Legendary)
        }
      }
    };
  }

  /**
   * Obtenir la progression par élément
   */
  public static async getCollectionByElement(playerId: string): Promise<CollectionByElement> {
    const player = await Player.findById(playerId);
    
    if (!player) {
      throw new Error("Player not found");
    }

    // ✅ CORRECTION : Récupérer les IDs des héros possédés
    const ownedHeroIds = player.heroes.map(h => h.heroId);

    // ✅ CORRECTION : Récupérer les héros complets depuis la collection Hero
    const ownedHeroesData = await Hero.find({ _id: { $in: ownedHeroIds } });

    const ownedByElement: Record<string, number> = {};
    ownedHeroesData.forEach((hero: any) => {
      const element = hero.element;
      if (element) {
        ownedByElement[element] = (ownedByElement[element] || 0) + 1;
      }
    });

    const totalByElement = await Hero.aggregate([
      {
        $group: {
          _id: "$element",
          count: { $sum: 1 }
        }
      }
    ]);

    const result: CollectionByElement = {};
    totalByElement.forEach(item => {
      const element = item._id;
      result[element] = {
        owned: ownedByElement[element] || 0,
        total: item.count,
        percentage: this.calculatePercentage(ownedByElement[element] || 0, item.count)
      };
    });

    return result;
  }

  /**
   * Obtenir la progression par rôle
   */
  public static async getCollectionByRole(playerId: string): Promise<CollectionByRole> {
    const player = await Player.findById(playerId);
    
    if (!player) {
      throw new Error("Player not found");
    }

    // ✅ CORRECTION : Récupérer les IDs des héros possédés
    const ownedHeroIds = player.heroes.map(h => h.heroId);

    // ✅ CORRECTION : Récupérer les héros complets depuis la collection Hero
    const ownedHeroesData = await Hero.find({ _id: { $in: ownedHeroIds } });

    const ownedByRole: Record<string, number> = {};
    ownedHeroesData.forEach((hero: any) => {
      const role = hero.role;
      if (role) {
        ownedByRole[role] = (ownedByRole[role] || 0) + 1;
      }
    });

    const totalByRole = await Hero.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 }
        }
      }
    ]);

    const result: CollectionByRole = {};
    totalByRole.forEach(item => {
      const role = item._id;
      result[role] = {
        owned: ownedByRole[role] || 0,
        total: item.count,
        percentage: this.calculatePercentage(ownedByRole[role] || 0, item.count)
      };
    });

    return result;
  }

  /**
   * Obtenir les héros manquants du joueur
   */
  public static async getMissingHeroes(playerId: string, limit: number = 20): Promise<any[]> {
    const player = await Player.findById(playerId);
    
    if (!player) {
      throw new Error("Player not found");
    }

    const ownedHeroIds = player.heroes.map(h => h.heroId.toString());

    const missingHeroes = await Hero.find({
      _id: { $nin: ownedHeroIds }
    })
    .select('name rarity element role')
    .limit(limit)
    .sort({ rarity: -1 }); // Légendaires en premier

    return missingHeroes;
  }

  /**
   * Obtenir les statistiques d'acquisition de héros
   */
  public static async getAcquisitionStats(playerId: string): Promise<AcquisitionStats> {
    const recentSummons = await Summon.find({ playerId })
      .sort({ createdAt: -1 })
      .limit(100);

    let totalPulls = 0;
    let uniqueHeroes = new Set<string>();

    recentSummons.forEach(summon => {
      summon.heroesObtained.forEach(hero => {
        totalPulls++;
        uniqueHeroes.add(hero.heroId.toString());
      });
    });

    const player = await Player.findById(playerId);
    const duplicateRate = totalPulls > 0 
      ? Math.round(((totalPulls - uniqueHeroes.size) / totalPulls) * 100)
      : 0;

    return {
      totalPulls,
      uniqueHeroesObtained: uniqueHeroes.size,
      duplicateRate,
      currentCollectionSize: player?.heroes.length || 0
    };
  }

  /**
   * Invalider le cache pour un joueur spécifique
   */
  public static invalidateCache(playerId: string): void {
    this.cache.delete(playerId);
  }

  /**
   * Nettoyer le cache complet (appelé périodiquement)
   */
  public static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Nettoyer les entrées expirées du cache
   */
  public static cleanExpiredCache(): void {
    const now = Date.now();
    for (const [playerId, cached] of this.cache.entries()) {
      if (now - cached.timestamp >= this.CACHE_TTL) {
        this.cache.delete(playerId);
      }
    }
  }

  // === MÉTHODES UTILITAIRES PRIVÉES ===

  private static calculatePercentage(owned: number, total: number): number {
    return total > 0 ? Math.round((owned / total) * 100) : 0;
  }
}

// === TYPES ===

export interface CollectionProgress {
  totalHeroes: number;
  ownedHeroes: number;
  completionPercentage: number;
}

export interface RarityProgress {
  owned: number;
  total: number;
  percentage: number;
}

export interface DetailedCollectionProgress extends CollectionProgress {
  byRarity: {
    Common: RarityProgress;
    Rare: RarityProgress;
    Epic: RarityProgress;
    Legendary: RarityProgress;
  };
}

export interface CollectionByElement {
  [element: string]: {
    owned: number;
    total: number;
    percentage: number;
  };
}

export interface CollectionByRole {
  [role: string]: {
    owned: number;
    total: number;
    percentage: number;
  };
}

export interface AcquisitionStats {
  totalPulls: number;
  uniqueHeroesObtained: number;
  duplicateRate: number;
  currentCollectionSize: number;
}

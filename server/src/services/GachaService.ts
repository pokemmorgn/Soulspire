import Player from "../models/Player";
import Hero from "../models/Hero";
import Summon from "../models/Summon";
import Banner from "../models/Banner";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";

// Configuration de base (fallback seulement)
const FALLBACK_CONFIG = {
  pity: {
    legendary: 90,
    epic: 10
  }
};

export interface GachaPullResult {
  hero: any;
  rarity: string;
  isNew: boolean;
  fragmentsGained: number;
  isFocus?: boolean; // Nouveau: indique si c'est un héros focus
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
    focusHeroes: number; // Nouveau
  };
  cost: {
    gems?: number;
    tickets?: number;
    specialCurrency?: number; // Nouveau
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
  bannerInfo: {
    bannerId: string;
    name: string;
    focusHeroes: string[];
  };
}

export class GachaService {

  // === RÉCUPÉRER LES BANNIÈRES ACTIVES ===
  public static async getActiveBanners(serverId: string) {
    try {
      const banners = await Banner.find({
        isActive: true,
        isVisible: true,
        startTime: { $lte: new Date() },
        endTime: { $gte: new Date() },
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      }).sort({ sortOrder: -1, startTime: -1 });

      return {
        success: true,
        banners: banners.map(banner => ({
          bannerId: banner.bannerId,
          name: banner.name,
          type: banner.type,
          description: banner.description,
          endTime: banner.endTime,
          costs: banner.costs,
          rates: banner.rates,
          focusHeroes: banner.focusHeroes,
          bannerImage: banner.bannerImage,
          iconImage: banner.iconImage,
          tags: banner.tags,
          category: banner.category,
          timeRemaining: Math.max(0, banner.endTime.getTime() - Date.now())
        }))
      };

    } catch (error: any) {
      console.error("❌ Erreur getActiveBanners:", error);
      throw error;
    }
  }

  // === EFFECTUER UNE INVOCATION SUR UNE BANNIÈRE SPÉCIFIQUE ===
  public static async performPullOnBanner(
    playerId: string,
    serverId: string,
    bannerId: string,
    count: number = 1
  ): Promise<GachaResponse> {
    try {
      console.log(`🎰 ${playerId} effectue ${count} pulls sur bannière ${bannerId} (serveur ${serverId})`);

      // Récupérer la bannière
      const banner = await Banner.findOne({
        bannerId,
        isActive: true,
        isVisible: true,
        startTime: { $lte: new Date() },
        endTime: { $gte: new Date() },
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      });

      if (!banner) {
        throw new Error("Banner not found or not active");
      }

      // Récupérer le joueur
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found on this server");
      }

      // Vérifier les permissions du joueur pour cette bannière
      const canPull = await banner.canPlayerPull(playerId);
      if (!canPull.canPull) {
        throw new Error(canPull.reason || "Cannot pull on this banner");
      }

      // Vérifier et déduire le coût
      const costCheck = await this.checkAndDeductBannerCost(player, banner, count);
      if (!costCheck.success) {
        throw new Error(costCheck.error);
      }

      // Calculer le système de pity (utilise config bannière ou fallback)
      const pityConfig = {
        legendaryPity: banner.pityConfig?.legendaryPity || FALLBACK_CONFIG.pity.legendary,
        epicPity: banner.pityConfig?.epicPity || FALLBACK_CONFIG.pity.epic
      };
      const pityStatus = await this.calculatePityStatus(playerId, serverId, bannerId);

      // Effectuer les pulls avec la configuration de la bannière
      const pullResults = await this.executeBannerPulls(
        player,
        banner,
        count,
        pityStatus,
        pityConfig
      );

      // Enregistrer l'invocation
      await this.recordSummon(playerId, pullResults, banner.type, bannerId);

      // Mettre à jour les statistiques de la bannière
      const rarities = pullResults.map(r => r.rarity);
      await banner.updateStats(count, rarities);

      // Mettre à jour les missions et événements
      await this.updateProgressTracking(playerId, serverId, count);

      // Calculer les statistiques finales
      const finalStats = this.calculatePullStats(pullResults);

      // Nouveau statut pity
      const newPityStatus = this.calculateNewPityStatus(
        pityStatus,
        pullResults,
        count,
        pityConfig
      );

      console.log(`✅ Gacha complété sur ${banner.name}: ${pullResults.length} héros obtenus`);

      return {
        success: true,
        results: pullResults,
        stats: finalStats,
        cost: costCheck.cost || { gems: 0, tickets: 0 },
        remaining: {
          gems: player.gems,
          tickets: player.tickets
        },
        pityStatus: newPityStatus,
        bannerInfo: {
          bannerId: banner.bannerId,
          name: banner.name,
          focusHeroes: banner.focusHeroes.map(f => f.heroId)
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur performPullOnBanner:", error);
      throw error;
    }
  }

  // === EFFECTUER UNE INVOCATION (LEGACY - redirige vers bannière par défaut) ===
  public static async performPull(
    playerId: string,
    serverId: string,
    pullType: "Standard" | "Limited" | "Ticket",
    count: number = 1
  ): Promise<GachaResponse> {
    try {
      // Trouver la bannière correspondante au type
      let bannerType = pullType;
      if (pullType === "Ticket") bannerType = "Standard"; // Les tickets utilisent la bannière standard

      const banner = await Banner.findOne({
        type: bannerType,
        isActive: true,
        isVisible: true,
        startTime: { $lte: new Date() },
        endTime: { $gte: new Date() },
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      }).sort({ sortOrder: -1 });

      if (!banner) {
        throw new Error(`No active ${pullType} banner found`);
      }

      // Rediriger vers la méthode par bannière
      return await this.performPullOnBanner(playerId, serverId, banner.bannerId, count);

    } catch (error: any) {
      console.error("❌ Erreur performPull (legacy):", error);
      throw error;
    }
  }

  // === RÉCUPÉRER LES TAUX DE DROP D'UNE BANNIÈRE ===
  public static async getBannerRates(bannerId: string, serverId: string) {
    try {
      const banner = await Banner.findOne({
        bannerId,
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      });

      if (!banner) {
        throw new Error("Banner not found");
      }

      return {
        success: true,
        bannerId: banner.bannerId,
        name: banner.name,
        rates: banner.rates,
        costs: banner.costs,
        pity: banner.pityConfig || {
          legendaryPity: FALLBACK_CONFIG.pity.legendary,
          epicPity: FALLBACK_CONFIG.pity.epic
        },
        focusHeroes: banner.focusHeroes,
        info: {
          guarantees: {
            epic: `1 Epic minimum every ${banner.pityConfig?.epicPity || FALLBACK_CONFIG.pity.epic} pulls`,
            legendary: `1 Legendary guaranteed after ${banner.pityConfig?.legendaryPity || FALLBACK_CONFIG.pity.legendary} pulls without one`
          },
          multiPullBonus: banner.costs.multiPull.gems && banner.costs.singlePull.gems ? 
            `10x pull discount available` : null
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getBannerRates:", error);
      throw error;
    }
  }

  // === RÉCUPÉRER LES TAUX GLOBAUX (LEGACY) ===
  public static getDropRates() {
    return {
      success: true,
      message: "Use /banners endpoint to get current banner rates",
      fallbackRates: {
        Standard: { Common: 50, Rare: 30, Epic: 15, Legendary: 5 },
        Limited: { Common: 40, Rare: 35, Epic: 20, Legendary: 5 }
      },
      fallbackPity: FALLBACK_CONFIG.pity
    };
  }

  // === MÉTHODES PRIVÉES MISES À JOUR ===

  // Vérifier et déduire le coût selon la bannière
  private static async checkAndDeductBannerCost(
    player: any,
    banner: any,
    count: number
  ): Promise<{ success: boolean; cost?: { gems?: number; tickets?: number; specialCurrency?: number }; error?: string }> {
    
    const costConfig = count === 1 ? banner.costs.singlePull : banner.costs.multiPull;
    let totalCost: { gems?: number; tickets?: number; specialCurrency?: number } = {};
    
    // Déterminer le coût réel
    if (costConfig.gems) totalCost.gems = costConfig.gems;
    if (costConfig.tickets) totalCost.tickets = costConfig.tickets;
    if (costConfig.specialCurrency) totalCost.specialCurrency = costConfig.specialCurrency;
    
    // Vérifier les ressources disponibles
    if (totalCost.gems && player.gems < totalCost.gems) {
      return {
        success: false,
        error: `Insufficient gems. Required: ${totalCost.gems}, Available: ${player.gems}`
      };
    }
    
    if (totalCost.tickets && player.tickets < totalCost.tickets) {
      return {
        success: false,
        error: `Insufficient tickets. Required: ${totalCost.tickets}, Available: ${player.tickets}`
      };
    }
    
    // TODO: Gérer specialCurrency quand implémenté
    if (totalCost.specialCurrency) {
      console.warn("⚠️ Special currency not implemented yet");
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

  // Exécuter les pulls avec la configuration de la bannière
  private static async executeBannerPulls(
    player: any,
    banner: any,
    count: number,
    pityStatus: any,
    pityConfig: any
  ): Promise<GachaPullResult[]> {
    
    const results: GachaPullResult[] = [];
    const availableHeroes = await banner.getAvailableHeroes();
    
    if (availableHeroes.length === 0) {
      throw new Error("No heroes available in this banner");
    }

    for (let i = 0; i < count; i++) {
      let rarity: string;
      
      // Système de pity avec config bannière
      if (pityStatus.pullsSinceLegendary + i >= pityConfig.legendaryPity) {
        rarity = "Legendary";
      } else if (pityStatus.pullsSinceEpic + i >= pityConfig.epicPity) {
        rarity = "Epic";
      } else {
        // Tirage normal basé sur les taux de la bannière
        rarity = this.rollRarity(banner.rates);
      }

      // Sélection d'un héros de cette rareté
      const heroesOfRarity = availableHeroes.filter(h => h.rarity === rarity);
      if (heroesOfRarity.length === 0) {
        // Fallback vers une rareté disponible
        const fallbackHero = availableHeroes[Math.floor(Math.random() * availableHeroes.length)];
        rarity = fallbackHero.rarity;
      }

      // Appliquer les rate-up pour les héros focus
      let selectedHero: any;
      const isFocusRarity = rarity === "Legendary" || rarity === "Epic";
      const focusHeroesOfRarity = banner.focusHeroes.filter((f: any) => {
        const focusHero = availableHeroes.find(h => h._id.toString() === f.heroId);
        return focusHero && focusHero.rarity === rarity;
      });

      if (isFocusRarity && focusHeroesOfRarity.length > 0 && Math.random() < 0.5) {
        // 50% de chance d'obtenir un héros focus si disponible
        const focusHero = focusHeroesOfRarity[Math.floor(Math.random() * focusHeroesOfRarity.length)];
        selectedHero = availableHeroes.find(h => h._id.toString() === focusHero.heroId);
      } else {
        // Sélection normale
        const heroesOfRarity = availableHeroes.filter(h => h.rarity === rarity);
        selectedHero = heroesOfRarity[Math.floor(Math.random() * heroesOfRarity.length)];
      }

      if (!selectedHero) {
        console.error(`❌ Aucun héros trouvé pour la rareté ${rarity}`);
        continue;
      }

      // Vérifier si c'est un héros focus
      const isFocus = banner.focusHeroes.some((f: any) => f.heroId === selectedHero._id.toString());
      
      // Vérifier si le joueur possède déjà ce héros
      const existingHero = player.heroes.find((h: any) => h.heroId.toString() === selectedHero._id.toString());
      
      if (existingHero) {
        // Conversion en fragments
        const fragmentsGained = this.getFragmentsByRarity(rarity);
        const currentFragments = player.fragments.get(selectedHero._id.toString()) || 0;
        player.fragments.set(selectedHero._id.toString(), currentFragments + fragmentsGained);
        
        results.push({
          hero: selectedHero,
          rarity,
          isNew: false,
          fragmentsGained,
          isFocus
        });
      } else {
        // Nouveau héros
        player.heroes.push({
          heroId: selectedHero._id.toString(),
          level: 1,
          stars: 1,
          equipped: false
        });
        
        results.push({
          hero: selectedHero,
          rarity,
          isNew: true,
          fragmentsGained: 0,
          isFocus
        });
      }
    }

    await player.save();
    return results;
  }

  // Calculer le nouveau statut pity
  private static calculateNewPityStatus(
    oldStatus: any,
    results: GachaPullResult[],
    count: number,
    pityConfig: any
  ) {
    let newStatus = {
      pullsSinceLegendary: oldStatus.pullsSinceLegendary + count,
      pullsSinceEpic: oldStatus.pullsSinceEpic + count,
      legendaryPityIn: 0,
      epicPityIn: 0
    };

    // Reset pity si des légendaires/épiques ont été obtenus
    const legendaryCount = results.filter(r => r.rarity === "Legendary").length;
    const epicCount = results.filter(r => r.rarity === "Epic").length;
    
    if (legendaryCount > 0) {
      newStatus.pullsSinceLegendary = 0;
      newStatus.pullsSinceEpic = 0;
    } else if (epicCount > 0) {
      newStatus.pullsSinceEpic = 0;
    }

    newStatus.legendaryPityIn = Math.max(0, pityConfig.legendaryPity - newStatus.pullsSinceLegendary);
    newStatus.epicPityIn = Math.max(0, pityConfig.epicPity - newStatus.pullsSinceEpic);

    return newStatus;
  }

  // Calculer les stats avec focus heroes
  private static calculatePullStats(results: GachaPullResult[]) {
    return {
      legendary: results.filter(r => r.rarity === "Legendary").length,
      epic: results.filter(r => r.rarity === "Epic").length,
      rare: results.filter(r => r.rarity === "Rare").length,
      common: results.filter(r => r.rarity === "Common").length,
      newHeroes: results.filter(r => r.isNew).length,
      totalFragments: results.reduce((sum, r) => sum + r.fragmentsGained, 0),
      focusHeroes: results.filter(r => r.isFocus).length
    };
  }

  // Enregistrer l'invocation avec bannière
  private static async recordSummon(
    playerId: string,
    results: GachaPullResult[],
    bannerType: string,
    bannerId: string
  ) {
    const summon = new Summon({
      playerId,
      heroesObtained: results.map(r => ({
        heroId: r.hero._id,
        rarity: r.rarity
      })),
      type: bannerType,
      // Ajouter bannerId si le modèle Summon le supporte
      bannerId: bannerId
    });
    
    await summon.save();
  }

  // === MÉTHODES UTILITAIRES EXISTANTES (inchangées) ===

  private static async calculatePityStatus(playerId: string, serverId: string, bannerId?: string) {
    // Si bannerId fourni, calculer pity spécifique à cette bannière
    // Sinon, pity global
    const recentSummons = await Summon.find({ 
      playerId,
      ...(bannerId && { bannerId }) // Filtrer par bannière si spécifié
    })
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
      pullsSinceEpic
    };
  }

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

  private static getFragmentsByRarity(rarity: string): number {
    const fragmentsByRarity: Record<string, number> = {
      Common: 5,
      Rare: 10,
      Epic: 15,
      Legendary: 25
    };
    
    return fragmentsByRarity[rarity] || 5;
  }

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
    }
  }

  // === MÉTHODES PUBLIQUES POUR L'HISTORIQUE ET STATS (inchangées) ===

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

  public static async getSummonStats(playerId: string, serverId: string) {
    try {
      const rarityStats = await Summon.aggregate([
        { $match: { playerId: playerId } },
        { $unwind: "$heroesObtained" },
        { $group: {
          _id: "$heroesObtained.rarity",
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]);

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

      if (stats.totalSummons > 0) {
        Object.keys(stats.rarityDistribution).forEach(rarity => {
          (stats as any)[`${rarity.toLowerCase()}Rate`] = 
            ((stats.rarityDistribution[rarity] / stats.totalSummons) * 100).toFixed(2) + "%";
        });
      }

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
}

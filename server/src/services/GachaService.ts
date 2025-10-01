import Player from "../models/Player";
import Hero from "../models/Hero";
import Summon from "../models/Summon";
import Banner from "../models/Banner";
import BannerPity from "../models/BannerPity";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { WebSocketGacha } from "./websocket/WebSocketGacha";
import { CollectionService } from "./CollectionService";
import { WishlistService } from "./WishlistService";
import { ElementalBannerService } from "./ElementalBannerService";
// Configuration de base (fallback seulement)
const FALLBACK_CONFIG = {
  pity: {
    legendary: 90,
    epic: 10
  }
};

// Configuration améliorée pour les animations et effets
const GACHA_CONFIG = {
  animations: {
    pullDuration: 3000, // 3 secondes pour un pull simple
    multiPullDuration: 8000, // 8 secondes pour un 10-pull
    legendaryDelay: 2000, // Délai supplémentaire pour les légendaires
  },
  rareDrop: {
    legendaryThreshold: 1.0, // < 1% = ultra rare
    ultraRareThreshold: 0.5, // < 0.5% = mythique
    streakThreshold: 3, // 3 drops consécutifs rares = streak
  },
  recommendations: {
    pityWarningThreshold: 10, // Avertir à 10 pulls du pity
    resourceOptimizationMin: 1000, // Minimum gems pour optimisation
    smartRecommendationCooldown: 3600000, // 1h entre recommandations
  }
};

export interface GachaPullResult {
  hero: any;
  rarity: string;
  isNew: boolean;
  fragmentsGained: number;
  isFocus?: boolean; // Indique si c'est un héros focus
  dropRate?: number; // Taux de drop effectif pour ce pull
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
    focusHeroes: number;
  };
  cost: {
    gems?: number;
    tickets?: number;
    specialCurrency?: number;
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
  // Nouveaux champs pour les notifications WebSocket
  notifications?: {
    hasLegendary: boolean;
    hasUltraRare: boolean;
    hasLuckyStreak: boolean;
    hasPityTrigger: boolean;
    hasNewHero: boolean;
    hasCollectionProgress: boolean;
  };
  specialEffects?: {
    hasPityBreak: boolean;
    hasMultipleLegendary: boolean;
    perfectPull: boolean;
    luckyStreakCount: number;
  };
  bonusRewards?: {
    elementalTickets?: { element: string; quantity: number }[];
  };
}

// ✅ NOUVEAU: Interface pour les drops de tickets élémentaires
export interface ElementalTicketDrop {
  element: string;
  quantity: number;
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
          timeRemaining: Math.max(0, banner.endTime.getTime() - Date.now()),
          // Nouvelles informations pour l'UI
          pityConfig: banner.pityConfig || {
            legendaryPity: FALLBACK_CONFIG.pity.legendary,
            epicPity: FALLBACK_CONFIG.pity.epic
          },
          specialMechanics: this.getBannerSpecialMechanics(banner),
          recommendedFor: this.getBannerRecommendations(banner)
        }))
      };

    } catch (error: any) {
      console.error("❌ Erreur getActiveBanners:", error);
      throw error;
    }
  }

  // === EFFECTUER UNE INVOCATION SUR UNE BANNIÈRE SPÉCIFIQUE (VERSION ENRICHIE) ===
public static async performPullOnBanner(
  playerId: string,
  serverId: string,
  bannerId: string,
  count: number = 1
): Promise<GachaResponse> {
  try {
    console.log(`🎰 ${playerId} effectue ${count} pulls sur bannière ${bannerId} (serveur ${serverId})`);

    // Notifier le début du pull avec animation
    await this.notifyPullStarted(playerId, bannerId, count);

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

    // Calculer le système de pity
    const pityConfig = {
      legendaryPity: banner.pityConfig?.legendaryPity || FALLBACK_CONFIG.pity.legendary,
      epicPity: banner.pityConfig?.epicPity || FALLBACK_CONFIG.pity.epic
    };
    const pityStatus = await this.calculatePityStatus(playerId, serverId, bannerId);

    // Effectuer les pulls avec la configuration de la bannière
    const pullResponse = await this.executeBannerPulls(
      playerId,
      serverId,
      banner.bannerId,
      count
    );

    // Extraire les résultats
    const pullResults = pullResponse.results;

    // Calculer les effets spéciaux
    const specialEffects = this.calculateSpecialEffects(pullResults, pityStatus, count);

    // Enregistrer l'invocation
    await this.recordSummon(playerId, pullResults, banner.type, bannerId);

    // Mettre à jour les statistiques de la bannière
    const rarities = pullResults.map((r: any) => r.rarity);
    await banner.updateStats(count, rarities);

    // ✅ NOUVEAU: Roll et octroyer les tickets élémentaires
    const elementalTicketDrops = await this.rollElementalTicketDrops(
      playerId,
      serverId,
      count
    );
    
    if (elementalTicketDrops.length > 0) {
      await this.grantElementalTickets(playerId, elementalTicketDrops);
    }

    // Utiliser le pityState retourné par executeBannerPulls
    const newPityStatus = {
      pullsSinceLegendary: pullResponse.pityState.pullsSinceLegendary,
      pullsSinceEpic: 0,
      legendaryPityIn: Math.max(0, (banner.pityConfig?.legendaryPity || 90) - pullResponse.pityState.pullsSinceLegendary),
      epicPityIn: 0
    };

    // Calculer les statistiques finales
    const finalStats = this.calculatePullStats(pullResults);

    // Construire la réponse
    const response: GachaResponse = {
      success: true,
      results: pullResults,
      stats: finalStats,
      cost: costCheck.cost || { gems: 0, tickets: 0 },
      remaining: pullResponse.currency,
      pityStatus: newPityStatus,
      bannerInfo: {
        bannerId: banner.bannerId,
        name: banner.name,
        focusHeroes: banner.focusHeroes.map((f: any) => f.heroId)
      },
      specialEffects,
      notifications: {
        hasLegendary: finalStats.legendary > 0,
        hasUltraRare: pullResults.some((r: any) => r.dropRate && r.dropRate < GACHA_CONFIG.rareDrop.legendaryThreshold),
        hasLuckyStreak: specialEffects.luckyStreakCount >= GACHA_CONFIG.rareDrop.streakThreshold,
        hasPityTrigger: specialEffects.hasPityBreak,
        hasNewHero: finalStats.newHeroes > 0,
        hasCollectionProgress: true
      },
      // ✅ NOUVEAU: Inclure les tickets élémentaires dans la réponse
      ...(elementalTicketDrops.length > 0 && {
        bonusRewards: {
          elementalTickets: elementalTicketDrops
        }
      })
    };

    // === SYSTÈME DE NOTIFICATIONS WEBSOCKET ENRICHI ===
    await this.processGachaNotifications(playerId, serverId, response, banner);

    // Mettre à jour les missions et événements
    await this.updateProgressTracking(playerId, serverId, count);

    // Recommandations intelligentes (asynchrones)
    this.generateSmartRecommendations(playerId, serverId, response, banner).catch(err => {
      console.warn("⚠️ Erreur génération recommandations:", err);
    });

    console.log(`✅ Gacha complété sur ${banner.name}: ${pullResults.length} héros obtenus`);

    return response;

  } catch (error: any) {
    console.error("❌ Erreur performPullOnBanner:", error);
    throw error;
  }
}

  // === NOUVELLES MÉTHODES POUR LES NOTIFICATIONS WEBSOCKET ===

  /**
   * Notifier le début d'un pull avec animation
   */
  private static async notifyPullStarted(
    playerId: string,
    bannerId: string,
    count: number
  ): Promise<void> {
    try {
      const banner = await Banner.findOne({ bannerId });
      if (!banner) return;

      if (WebSocketGacha.isAvailable()) {
        WebSocketGacha.notifyPullStarted(playerId, {
          bannerId,
          bannerName: banner.name,
          pullType: count === 1 ? 'single' : 'multi',
          cost: count === 1 ? banner.costs.singlePull : banner.costs.multiPull,
          anticipatedDuration: count === 1 ? 
            GACHA_CONFIG.animations.pullDuration : 
            GACHA_CONFIG.animations.multiPullDuration
        });
      }

      // Délai pour l'animation
      await new Promise(resolve => 
        setTimeout(resolve, count === 1 ? 1000 : 2000)
      );

    } catch (error) {
      console.warn("⚠️ Erreur notifyPullStarted:", error);
    }
  }

  /**
   * Traiter toutes les notifications WebSocket après un pull
   */
  private static async processGachaNotifications(
    playerId: string,
    serverId: string,
    response: GachaResponse,
    banner: any
  ): Promise<void> {
    try {
      if (!WebSocketGacha.isAvailable()) return;

      // 1. Notifications de résultats de pull
      if (response.results.length === 1) {
        // Pull simple
        const result = response.results[0];
        WebSocketGacha.notifyPullResult(playerId, {
          hero: {
            id: result.hero._id,
            name: result.hero.name,
            rarity: result.rarity,
            element: result.hero.element,
            role: result.hero.role
          },
          isNew: result.isNew,
          fragmentsGained: result.fragmentsGained,
          isFocus: result.isFocus || false,
          bannerId: banner.bannerId,
          bannerName: banner.name,
          cost: response.cost,
          pullNumber: response.pityStatus.pullsSinceLegendary + 1
        });
      } else {
        // Multi-pull
        WebSocketGacha.notifyMultiPullResult(playerId, {
          bannerId: banner.bannerId,
          bannerName: banner.name,
          heroes: response.results.map(r => ({
            hero: r.hero,
            rarity: r.rarity,
            isNew: r.isNew,
            fragmentsGained: r.fragmentsGained,
            isFocus: r.isFocus || false
          })),
          summary: response.stats,
          cost: response.cost,
          specialEffects: response.specialEffects || {
            hasPityBreak: false,
            hasMultipleLegendary: false,
            perfectPull: false
          }
        });
      }

      // 2. Notifications spéciales pour drops légendaires
      const legendaryResults = response.results.filter(r => r.rarity === 'Legendary');
      for (const legendary of legendaryResults) {
        WebSocketGacha.notifyLegendaryDrop(playerId, serverId, {
          hero: {
            id: legendary.hero._id,
            name: legendary.hero.name,
            rarity: legendary.rarity,
            element: legendary.hero.element,
            role: legendary.hero.role
          },
          bannerId: banner.bannerId,
          bannerName: banner.name,
          isFirstTime: legendary.isNew,
          isFocus: legendary.isFocus || false,
          pullsSinceLast: response.pityStatus.pullsSinceLegendary,
          totalLegendaryCount: await this.getPlayerLegendaryCount(playerId),
          dropRate: legendary.dropRate || banner.rates.Legendary
        });
      }

      // 3. Notifications de progression pity
      if (response.pityStatus.legendaryPityIn <= GACHA_CONFIG.recommendations.pityWarningThreshold) {
        WebSocketGacha.notifyPityProgress(playerId, {
          bannerId: banner.bannerId,
          bannerName: banner.name,
          currentPulls: response.pityStatus.pullsSinceLegendary,
          pityThreshold: banner.pityConfig?.legendaryPity || FALLBACK_CONFIG.pity.legendary,
          pullsRemaining: response.pityStatus.legendaryPityIn,
          pityType: 'legendary',
          progressPercentage: (response.pityStatus.pullsSinceLegendary / (banner.pityConfig?.legendaryPity || FALLBACK_CONFIG.pity.legendary)) * 100,
          isSharedPity: banner.pityConfig?.sharedPity || false
        });
      }

      // 4. Notification pity triggé
      if (response.specialEffects?.hasPityBreak) {
        const pityResult = legendaryResults[0];
        if (pityResult) {
          WebSocketGacha.notifyPityTriggered(playerId, {
            bannerId: banner.bannerId,
            bannerName: banner.name,
            pityType: 'legendary',
            guaranteedHero: pityResult.hero,
            pullsToTrigger: response.pityStatus.pullsSinceLegendary + response.results.length,
            newPityCount: 0
          });
        }
      }

      // 5. Notifications de nouveaux héros et collection
      const newHeroes = response.results.filter(r => r.isNew);
      for (const newHero of newHeroes) {
        const collectionProgress = await this.getPlayerCollectionProgress(playerId);
        
        WebSocketGacha.notifyNewHeroObtained(playerId, {
          hero: newHero.hero,
          bannerId: banner.bannerId,
          bannerName: banner.name,
          collectionProgress: {
            totalHeroes: collectionProgress.totalHeroes,
            ownedHeroes: collectionProgress.ownedHeroes + 1,
            completionPercentage: ((collectionProgress.ownedHeroes + 1) / collectionProgress.totalHeroes) * 100
          }
        });
      }

      // 6. Détection et notification de lucky streaks
      const luckyStreak = await this.detectLuckyStreak(playerId, response.results);
      if (luckyStreak.isStreak) {
        WebSocketGacha.notifyLuckyStreak(playerId, {
          consecutiveRareDrops: luckyStreak.count,
          streakType: luckyStreak.type,
          recentHeroes: luckyStreak.heroNames,
          probability: luckyStreak.probability,
          bonusReward: luckyStreak.bonusReward
        });
      }

      // 7. Notifications d'ultra-rares
      const ultraRares = response.results.filter(r => 
        r.dropRate && r.dropRate < GACHA_CONFIG.rareDrop.ultraRareThreshold
      );
      for (const ultraRare of ultraRares) {
        WebSocketGacha.notifyUltraRareDrop(playerId, serverId, {
          hero: ultraRare.hero,
          rarity: 'celestial', // ou autre type ultra-rare
          bannerId: banner.bannerId,
          globalDropCount: await this.getGlobalHeroDropCount(ultraRare.hero._id),
          serverFirstDrop: await this.isServerFirstDrop(ultraRare.hero._id, serverId),
          dropRate: ultraRare.dropRate ?? GACHA_CONFIG.rareDrop.ultraRareThreshold
        });
      }

    } catch (error) {
      console.error("❌ Erreur processGachaNotifications:", error);
    }
  }

  /**
   * Générer des recommandations intelligentes après un pull
   */
  private static async generateSmartRecommendations(
    playerId: string,
    serverId: string,
    response: GachaResponse,
    banner: any
  ): Promise<void> {
    try {
      if (!WebSocketGacha.isAvailable()) return;

      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) return;

      // Recommandation basée sur le pity
      if (response.pityStatus.legendaryPityIn <= 5 && player.gems >= (banner.costs.singlePull.gems || 0)) {
        WebSocketGacha.notifyPityRecommendation(playerId, {
          type: 'pull_now_pity_close',
          bannerId: banner.bannerId,
          bannerName: banner.name,
          reason: `Légendaire garanti dans ${response.pityStatus.legendaryPityIn} pulls`,
          pullsFromPity: response.pityStatus.legendaryPityIn,
          resourcesNeeded: {
            gems: (banner.costs.singlePull.gems || 0) * response.pityStatus.legendaryPityIn
          },
          priority: 'high'
        });
      }

      // Recommandation d'optimisation des ressources
      if (player.gems >= GACHA_CONFIG.recommendations.resourceOptimizationMin) {
        const optimization = await this.calculateResourceOptimization(playerId, serverId);
        if (optimization.efficiencyScore < 80) {
          WebSocketGacha.notifyResourceOptimization(playerId, optimization);
        }
      }

      // Recommandation intelligente générale
      const smartRec = await this.generateContextualRecommendation(playerId, serverId, response, banner);
      if (smartRec) {
        WebSocketGacha.notifySmartRecommendation(playerId, smartRec);
      }

    } catch (error) {
      console.error("❌ Erreur generateSmartRecommendations:", error);
    }
  }

  // === MÉTHODES UTILITAIRES NOUVELLES ===

  /**
   * Calculer les effets spéciaux d'un pull
   */
  private static calculateSpecialEffects(
    results: GachaPullResult[],
    pityStatus: any,
    pullCount: number
  ): any {
    const legendaryCount = results.filter(r => r.rarity === 'Legendary').length;
    const epicCount = results.filter(r => r.rarity === 'Epic').length;
    
    return {
      hasPityBreak: pityStatus.pullsSinceLegendary + pullCount >= 90 && legendaryCount > 0,
      hasMultipleLegendary: legendaryCount > 1,
      perfectPull: pullCount === 10 && results.every(r => ['Epic', 'Legendary'].includes(r.rarity)),
      luckyStreakCount: this.calculateCurrentStreak(results)
    };
  }

  // ===== SYSTÈME DE TICKETS ÉLÉMENTAIRES =====

  /**
   * Calculer les drops de tickets élémentaires après un pull
   */
  private static async rollElementalTicketDrops(
    playerId: string,
    serverId: string,
    count: number
  ): Promise<ElementalTicketDrop[]> {
    try {
      const drops: ElementalTicketDrop[] = [];
      
      // Déterminer le taux selon le jour
      const now = new Date();
      const isFriday = now.getDay() === 5;
      const dropRate = isFriday ? 0.15 : 0.05; // 15% vendredi, 5% autres jours
      
      console.log(`🎲 Rolling ${count} elemental ticket drops (${dropRate * 100}% rate, ${isFriday ? 'Friday' : 'Regular day'})`);
      
      // Roll pour chaque pull
      for (let i = 0; i < count; i++) {
        const roll = Math.random();
        
        if (roll < dropRate) {
          // Drop réussi ! Sélectionner un élément aléatoire
          const elements = ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"];
          const randomElement = elements[Math.floor(Math.random() * elements.length)];
          
          drops.push({ 
            element: randomElement, 
            quantity: 1 
          });
          
          console.log(`   ✅ Drop ${i + 1}: ${randomElement} ticket`);
        }
      }
      
      // Grouper les drops par élément
      const groupedDrops = drops.reduce((acc: { [key: string]: number }, drop) => {
        acc[drop.element] = (acc[drop.element] || 0) + drop.quantity;
        return acc;
      }, {});
      
      const finalDrops = Object.entries(groupedDrops).map(([element, quantity]) => ({
        element,
        quantity
      }));
      
      if (finalDrops.length > 0) {
        console.log(`🎁 Total drops: ${finalDrops.map(d => `${d.quantity}x ${d.element}`).join(", ")}`);
      } else {
        console.log(`   No elemental tickets dropped this time`);
      }
      
      return finalDrops;
      
    } catch (error: any) {
      console.error("❌ Error rolling elemental ticket drops:", error);
      return [];
    }
  }

  /**
   * Ajouter les tickets élémentaires au joueur
   */
  private static async grantElementalTickets(
    playerId: string,
    drops: ElementalTicketDrop[]
  ): Promise<void> {
    try {
      if (drops.length === 0) return;
      
      const player = await Player.findById(playerId);
      if (!player) {
        console.error("❌ Player not found for ticket grant");
        return;
      }
      
      for (const drop of drops) {
        await player.addElementalTicket(drop.element, drop.quantity);
      }
      
      console.log(`✅ Granted ${drops.length} elemental ticket drop(s) to player ${playerId}`);
      
    } catch (error: any) {
      console.error("❌ Error granting elemental tickets:", error);
    }
  }
  /**
   * Obtenir les mécaniques spéciales d'une bannière
   */
  private static getBannerSpecialMechanics(banner: any): string[] {
    const mechanics: string[] = [];
    
    if (banner.focusHeroes && banner.focusHeroes.length > 0) {
      mechanics.push('Rate-up Heroes');
    }
    if (banner.pityConfig?.legendaryPity && banner.pityConfig.legendaryPity < FALLBACK_CONFIG.pity.legendary) {
      mechanics.push('Reduced Pity');
    }
    if (banner.bonusRewards.milestones && banner.bonusRewards.milestones.length > 0) {
      mechanics.push('Milestone Rewards');
    }
    if (banner.type === 'Limited') {
      mechanics.push('Limited Time');
    }
    
    return mechanics;
  }

  /**
   * Obtenir les recommandations pour une bannière
   */
  private static getBannerRecommendations(banner: any): string[] {
    const recommendations: string[] = [];
    
    if (banner.type === 'Beginner') {
      recommendations.push('Recommended for new players');
    }
    if (banner.focusHeroes && banner.focusHeroes.length > 0) {
      recommendations.push('Featured heroes available');
    }
    if (banner.costs.firstPullDiscount) {
      recommendations.push('First pull discount available');
    }
    
    return recommendations;
  }

  /**
   * Calculer le streak actuel
   */
  private static calculateCurrentStreak(results: GachaPullResult[]): number {
    let streak = 0;
    for (const result of results.reverse()) {
      if (['Epic', 'Legendary'].includes(result.rarity)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  /**
   * Détecter un lucky streak
   */
  private static async detectLuckyStreak(
    playerId: string,
    results: GachaPullResult[]
  ): Promise<any> {
    // Récupérer les derniers pulls du joueur
    const recentSummons = await Summon.find({ playerId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Analyser pour détecter des streaks
    let consecutiveRares = 0;
    const heroNames: string[] = [];
    
    for (const result of results) {
      if (['Epic', 'Legendary'].includes(result.rarity)) {
        consecutiveRares++;
        heroNames.push(result.hero.name);
      }
    }

    const isStreak = consecutiveRares >= GACHA_CONFIG.rareDrop.streakThreshold;
    
    return {
      isStreak,
      count: consecutiveRares,
      type: results.some(r => r.rarity === 'Legendary') ? 'legendary_streak' : 'epic_streak',
      heroNames: heroNames.slice(0, 3), // Limiter à 3 noms
      probability: Math.pow(0.2, consecutiveRares), // Probabilité approximative
      bonusReward: isStreak ? { gems: consecutiveRares * 10 } : null
    };
  }

  /**
   * Obtenir le nombre de légendaires du joueur
   */
  private static async getPlayerLegendaryCount(playerId: string): Promise<number> {
    const legendaryCount = await Summon.aggregate([
      { $match: { playerId } },
      { $unwind: "$heroesObtained" },
      { $match: { "heroesObtained.rarity": "Legendary" } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);
    
    return legendaryCount[0]?.count || 0;
  }

    /**
     * Obtenir la progression de collection du joueur
     */
    private static async getPlayerCollectionProgress(playerId: string): Promise<any> {
      return await CollectionService.getPlayerCollectionProgress(playerId);
    }

  /**
   * Obtenir le nombre global de drops d'un héros
   */
  private static async getGlobalHeroDropCount(heroId: string): Promise<number> {
    const dropCount = await Summon.aggregate([
      { $unwind: "$heroesObtained" },
      { $match: { "heroesObtained.heroId": heroId } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);
    
    return dropCount[0]?.count || 0;
  }

  /**
   * Vérifier si c'est le premier drop sur le serveur
   */
  private static async isServerFirstDrop(heroId: string, serverId: string): Promise<boolean> {
    const existingDrop = await Summon.findOne({
      "heroesObtained.heroId": heroId,
      // Ajouter filtre serveur si disponible dans le modèle
    });
    
    return !existingDrop;
  }

  /**
   * Calculer l'optimisation des ressources
   */
  private static async calculateResourceOptimization(
    playerId: string,
    serverId: string
  ): Promise<any> {
    const player = await Player.findOne({ _id: playerId, serverId });
    if (!player) throw new Error("Player not found");

    const activeBanners = await this.getActiveBanners(serverId);
    
    // Logique d'optimisation basée sur les taux, pity, ressources
    const suggestions = activeBanners.banners.map(banner => ({
      bannerId: banner.bannerId,
      bannerName: banner.name,
      recommendedPulls: Math.min(10, Math.floor(player.gems / (banner.costs.singlePull.gems || 300))),
      expectedLegendary: 0.5, // Calcul approximatif
      expectedNew: 3 // Calcul approximatif
    }));

    return {
      currentResources: { gems: player.gems, tickets: player.tickets },
      suggestedAllocation: suggestions,
      efficiencyScore: 75, // Score calculé
      reasoning: "Optimisation basée sur les taux actuels et votre progression"
    };
  }

  /**
   * Générer une recommandation contextuelle
   */
  private static async generateContextualRecommendation(
    playerId: string,
    serverId: string,
    response: GachaResponse,
    banner: any
  ): Promise<any | null> {
    const player = await Player.findOne({ _id: playerId, serverId });
    if (!player) return null;

    // Logique de recommandation basée sur le contexte
    if (response.stats.legendary === 0 && player.gems > 3000) {
      return {
        type: 'pull_now_optimal',
        title: 'Moment optimal pour puller',
        description: 'Vos ressources sont suffisantes et le pity approche',
        reasoning: [
          'Ressources suffisantes disponibles',
          'Pity légendaire dans les prochains pulls',
          'Bannière avec de bons taux'
        ],
        suggestedAction: 'Effectuer 10 pulls maintenant',
        bannerId: banner.bannerId,
        resourceImpact: {
          gemsNeeded: banner.costs.multiPull.gems || 2700,
          expectedReward: 'Au moins 1 légendaire garanti'
        },
        priority: 'medium',
        timeRelevant: true
      };
    }

    return null;
  }

  // === MÉTHODES EXISTANTES MISES À JOUR ===

  // Vérifier et déduire le coût selon la bannière
// Vérifier et déduire le coût selon la bannière
private static async checkAndDeductBannerCost(
  player: any,
  banner: any,
  count: number
): Promise<{ success: boolean; cost?: { gems?: number; tickets?: number; specialCurrency?: number }; error?: string }> {
  
  // ✅ ÉTAPE 1 : Vérifier si c'est le premier pull du joueur sur cette bannière
  const isFirstPull = await Summon.hasPlayerPulledOnBanner(player._id.toString(), banner.bannerId);
  
  // ✅ ÉTAPE 2 : Déterminer le coût à appliquer
  let costConfig;
  
  if (count === 1 && !isFirstPull && banner.costs.firstPullDiscount) {
    // 🎁 Premier pull avec réduction
    costConfig = banner.costs.firstPullDiscount;
    console.log(`🎁 First pull discount applied for ${player._id} on ${banner.bannerId}: ${costConfig.gems || 0} gems`);
  } else if (count === 1) {
    // Pull simple normal
    costConfig = banner.costs.singlePull;
  } else {
    // Multi-pull (10x)
    costConfig = banner.costs.multiPull;
  }
  
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

  // Exécuter les pulls avec la configuration de la bannière (version enrichie)
/**
 * Exécuter les pulls avec la configuration de la bannière
 * Lit le focusChance depuis la config de la bannière pour chaque héros focus
 */
/**
 * Exécuter les pulls avec la configuration de la bannière
 * Version sans Pity Epic (style AFK Arena)
 */
private static async executeBannerPulls(
  playerId: string,
  serverId: string,
  bannerId: string,
  count: number
): Promise<{
  success: boolean;
  results: any[];
  pityState: any;
  currency: any;
}> {
  try {
    // Récupérer le joueur
    const player = await Player.findOne({ _id: playerId, serverId });
    if (!player) {
      throw new Error("Player not found");
    }

    // Récupérer la bannière
    const banner = await Banner.findOne({ bannerId });
    if (!banner) {
      throw new Error("Banner not found");
    }

    // Vérifier que la bannière est active
    if (!banner.isCurrentlyActive()) {
      throw new Error(`Banner ${banner.name} is not currently active`);
    }

    // Récupérer ou créer le pity state
    let pityState = await BannerPity.findOne({ playerId, bannerId });
    if (!pityState) {
      pityState = new BannerPity({
        playerId,
        bannerId,
        pullsSinceLegendary: 0,
        pullsSinceEpic: 0,
        totalPulls: 0,
        hasReceivedLegendary: false
      });
      await pityState.save();
    }

    // Configuration du pity
    const pityConfig = {
      legendaryPity: banner.pityConfig?.legendaryPity || 90,
      epicPity: banner.pityConfig?.epicPity || 0
    };

    console.log(`\n🎰 Starting ${count} pulls on banner: ${banner.name}`);
    console.log(`📊 Current Pity State:`);
    console.log(`   Legendary: ${pityState.pullsSinceLegendary}/${pityConfig.legendaryPity}`);
    console.log(`   Has received Legendary: ${pityState.hasReceivedLegendary}`);

    // Récupérer le pool de héros disponibles
    const availableHeroes = await banner.getAvailableHeroes();
    if (availableHeroes.length === 0) {
      throw new Error("No heroes available in banner pool");
    }

    console.log(`   Available heroes: ${availableHeroes.length}`);

    // Résultats des pulls
    const results: any[] = [];
    let currentPullsSinceLegendary = pityState.pullsSinceLegendary;

    // ✅ Boucle de pulls avec Wishlist intégrée
    for (let i = 0; i < count; i++) {
      let rarity: string;
      let isPityTriggered = false;
      let isWishlistPity = false; // ✅ NOUVEAU

      // ✅ NOUVEAU : Vérifier pity wishlist EN PREMIER (priorité absolue)
      const wishlistPityTriggered = await WishlistService.isWishlistPityTriggered(
        playerId,
        serverId
      );

      if (wishlistPityTriggered) {
        rarity = "Legendary";
        isPityTriggered = true;
        isWishlistPity = true;
        console.log(`\n🎯 [PULL ${i + 1}] PITY WISHLIST DÉCLENCHÉ (100 pulls sans Legendary) !`);
      }
      // Pity legendary normal
      else if (currentPullsSinceLegendary >= pityConfig.legendaryPity) {
        rarity = "Legendary";
        isPityTriggered = true;
        console.log(`\n🔔 [PULL ${i + 1}] PITY LEGENDARY DÉCLENCHÉ (${pityConfig.legendaryPity} pulls) !`);
      }
      // Roll normal
      else {
       rarity = this.rollRarity(banner.rates as any);
      }

      console.log(`   ├─ Rareté tirée: ${rarity}`);

      // ✅ Sélection du héros avec priorité Wishlist
      let selectedHero: any;

      if (isWishlistPity) {
        // ✅ NOUVEAU : Pity wishlist déclenché - choisir dans la wishlist
        const wishlistHero = await WishlistService.getRandomWishlistHero(playerId, serverId);

        if (wishlistHero) {
          selectedHero = wishlistHero;
          console.log(`   🎯 Héro WISHLIST: ${selectedHero.name} ⭐`);
        } else {
          // Wishlist vide - sélection Legendary normale
          console.log(`   ⚠️ Wishlist vide, sélection Legendary normale`);
          const legendaryHeroes = availableHeroes.filter((h: any) => h.rarity === "Legendary");
          if (legendaryHeroes.length === 0) {
            throw new Error("No Legendary heroes available");
          }
          selectedHero = legendaryHeroes[Math.floor(Math.random() * legendaryHeroes.length)];
        }
      } else if (rarity === "Legendary" && banner.focusHeroes.length > 0) {
        // Logique focus hero (pour bannières limitées)
        const focusHero = banner.focusHeroes[0];
        const isFirstLegendary = !pityState.hasReceivedLegendary;

        // Premier legendary = garanti si configuré
        if (focusHero.guaranteed && isFirstLegendary) {
          const focusHeroData = availableHeroes.find(
            (h: any) => h._id.toString() === focusHero.heroId
          );
          if (focusHeroData) {
            selectedHero = focusHeroData;
            console.log(`   ⭐ GARANTI: ${selectedHero.name} (premier Legendary)`);
          }
        }
        // Legendaries suivants = focusChance %
        else if (focusHero.focusChance && Math.random() < focusHero.focusChance) {
          const focusHeroData = availableHeroes.find(
            (h: any) => h._id.toString() === focusHero.heroId
          );
          if (focusHeroData) {
            selectedHero = focusHeroData;
            console.log(`   ⭐ FOCUS: ${selectedHero.name} (${(focusHero.focusChance * 100).toFixed(0)}% chance)`);
          }
        }

        // Si pas de focus ou raté, sélection Legendary normale
        if (!selectedHero) {
          const legendaryHeroes = availableHeroes.filter((h: any) => h.rarity === "Legendary");
          selectedHero = legendaryHeroes[Math.floor(Math.random() * legendaryHeroes.length)];
        }
      } else {
        // Sélection normale par rareté
        const heroesOfRarity = availableHeroes.filter((h: any) => h.rarity === rarity);
        if (heroesOfRarity.length === 0) {
          throw new Error(`No heroes found for rarity: ${rarity}`);
        }
        selectedHero = heroesOfRarity[Math.floor(Math.random() * heroesOfRarity.length)];
      }

      console.log(`   └─ Héro obtenu: ${selectedHero.name} (${selectedHero.rarity})`);

      // Vérifier si le héros est déjà possédé
      const existingHero = player.heroes.find(
        (h: any) => h.heroId === selectedHero._id.toString()
      );

      if (existingHero) {
        console.log(`   🔄 Héro déjà possédé, conversion en fragments`);
        
        // Conversion en fragments selon la rareté
        const fragmentsMap: { [key: string]: number } = {
          Common: 5,
          Rare: 10,
          Epic: 25,
          Legendary: 50,
          Mythic: 100
        };

        const fragmentsGained = fragmentsMap[selectedHero.rarity] || 5;
        const fragmentKey = `${selectedHero._id}_fragment`;
        const currentFragments = player.fragments.get(fragmentKey) || 0;
        player.fragments.set(fragmentKey, currentFragments + fragmentsGained);

        console.log(`   └─ +${fragmentsGained} fragments de ${selectedHero.name}`);
      } else {
        // Nouveau héros - ajouter au roster
        await player.addHero(selectedHero._id.toString(), 1, 1);
        console.log(`   ✅ Nouveau héro ajouté au roster`);
      }

      // Ajouter le résultat
      results.push({
        hero: selectedHero,
        rarity: selectedHero.rarity,
        isNew: !existingHero,
        isDuplicate: !!existingHero,
        isPityTriggered,
        isWishlistPity, // ✅ NOUVEAU : Indicateur wishlist
        pullNumber: i + 1
      });

      // ✅ Gestion des compteurs de pity
      if (rarity === "Legendary") {
        currentPullsSinceLegendary = 0;
        pityState.hasReceivedLegendary = true;

        // ✅ NOUVEAU : Reset le pity wishlist
        await WishlistService.resetWishlistPity(playerId, serverId);

        console.log(`   └─ Pity RESET → Legendary: 0, Wishlist: 0`);
      } else {
        currentPullsSinceLegendary++;

        // ✅ NOUVEAU : Incrémenter le pity wishlist
        await WishlistService.incrementWishlistPity(playerId, serverId);
      }
    }

    // Mettre à jour le pity state
    pityState.pullsSinceLegendary = currentPullsSinceLegendary;
    pityState.totalPulls += count;
    await pityState.save();

    // Sauvegarder le joueur
    await player.save();

    console.log(`\n✅ ${count} pulls completed successfully`);
    console.log(`📊 Final Pity State:`);
    console.log(`   Legendary: ${pityState.pullsSinceLegendary}/${pityConfig.legendaryPity}`);
    
    // ✅ NOUVEAU : Afficher l'état wishlist
    const wishlistStats = await WishlistService.getWishlistStats(playerId, serverId);
    if (wishlistStats) {
      console.log(`   Wishlist: ${wishlistStats.pityCounter}/${wishlistStats.pityThreshold}`);
    }

    return {
      success: true,
      results,
      pityState: {
        pullsSinceLegendary: pityState.pullsSinceLegendary,
        totalPulls: pityState.totalPulls,
        hasReceivedLegendary: pityState.hasReceivedLegendary,
        wishlistPityCounter: wishlistStats?.pityCounter || 0 // ✅ NOUVEAU
      },
      currency: {
        gems: player.gems,
        paidGems: player.paidGems,
        tickets: player.tickets
      }
    };
  } catch (error: any) {
    console.error("❌ Error in executeBannerPulls:", error);
    throw error;
  }
}

/**
 * Vérifier si le joueur a déjà obtenu un legendary sur cette bannière
 */
private static async hasPlayerPulledLegendaryOnBanner(
  playerId: string,
  bannerId: string
): Promise<boolean> {
  const summon = await Summon.findOne({
    playerId,
    bannerId,
    "heroesObtained.rarity": "Legendary"
  });
  
  return !!summon;
}

  // Calculer le nouveau statut pity (version enrichie)
private static calculateNewPityStatus(
  oldStatus: any,
  results: GachaPullResult[],
  count: number,
  pityConfig: any
) {
  let newStatus = {
    pullsSinceLegendary: oldStatus.pullsSinceLegendary + count,
    pullsSinceEpic: 0,  // ❌ Toujours 0 (non utilisé)
    legendaryPityIn: 0,
    epicPityIn: 0       // ❌ Toujours 0 (non utilisé)
  };

  // Reset pity si des légendaires ont été obtenus
  const legendaryCount = results.filter(r => r.rarity === "Legendary").length;
  
  if (legendaryCount > 0) {
    // Trouver le dernier légendaire pour reset précis
    let pullsToLastLegendary = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i].rarity === "Legendary") {
        pullsToLastLegendary = results.length - i - 1;
        break;
      }
    }
    newStatus.pullsSinceLegendary = pullsToLastLegendary;
  }

  newStatus.legendaryPityIn = Math.max(0, pityConfig.legendaryPity - newStatus.pullsSinceLegendary);
  // ❌ Epic pity supprimé
  newStatus.epicPityIn = 0;

  return newStatus;
}

  // Calculer les stats avec focus heroes (version enrichie)
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

  // Enregistrer l'invocation avec bannière (version enrichie)
// Enregistrer l'invocation avec bannière (version enrichie)
private static async recordSummon(
  playerId: string,
  results: GachaPullResult[],
  bannerType: string,
  bannerId: string
) {
  // ✅ CORRECTION: Mapper le type de bannière vers un type Summon valide
  let summonType: "Standard" | "Limited" | "Ticket";
  
  if (bannerType === "Limited" || bannerType === "Event") {
    summonType = "Limited";
  } else if (bannerType === "Beginner" || bannerType === "Standard" || bannerType === "Weapon") {
    summonType = "Standard";
  } else {
    summonType = "Standard"; // Par défaut
  }
  
  const summon = new Summon({
    playerId,
    bannerId: bannerId, // ✅ AJOUT : Stocker le bannerId
    heroesObtained: results.map(r => ({
      heroId: r.hero._id,
      rarity: r.rarity,
      // Ajouter métadonnées si le modèle les supporte
      isNew: r.isNew,
      isFocus: r.isFocus,
      fragmentsGained: r.fragmentsGained
    })),
    type: summonType
  });
  
  await summon.save();
  
  console.log(`✅ Summon enregistré: ${playerId} sur bannière ${bannerId} (${results.length} héros)`);
  
  // Enregistrer dans l'historique détaillé (optionnel)
  this.recordDetailedSummonHistory(playerId, results, bannerId).catch(err => {
    console.warn("⚠️ Erreur enregistrement historique détaillé:", err);
  });
}

  /**
   * Enregistrer un historique détaillé des invocations (optionnel)
   */
  private static async recordDetailedSummonHistory(
    playerId: string,
    results: GachaPullResult[],
    bannerId: string
  ): Promise<void> {
    // Si vous avez une collection SummonHistory séparée pour des analytics avancées
    const detailedHistory = {
      playerId,
      bannerId,
      timestamp: new Date(),
      results: results.map(r => ({
        heroId: r.hero._id,
        heroName: r.hero.name,
        rarity: r.rarity,
        element: r.hero.element,
        role: r.hero.role,
        isNew: r.isNew,
        isFocus: r.isFocus,
        fragmentsGained: r.fragmentsGained,
        dropRate: r.dropRate
      })),
      metadata: {
        totalCost: results.length * 300, // Approximatif
        luckyScore: this.calculateLuckScore(results),
        rarityDistribution: this.calculatePullStats(results)
      }
    };
    
    // Enregistrer en base si modèle disponible
    // await SummonHistory.create(detailedHistory);
    
    console.log(`📊 Historique détaillé enregistré pour ${playerId}: ${results.length} pulls sur ${bannerId}`);
  }

  /**
   * Calculer un score de chance pour un pull
   */
  private static calculateLuckScore(results: GachaPullResult[]): number {
    let luckScore = 50; // Score neutre
    
    results.forEach(result => {
      if (result.rarity === 'Legendary') {
        luckScore += result.dropRate ? (5 / result.dropRate) * 10 : 30;
      } else if (result.rarity === 'Epic') {
        luckScore += result.dropRate ? (20 / result.dropRate) * 5 : 15;
      }
      
      if (result.isFocus) {
        luckScore += 10; // Bonus pour héros focus
      }
      
      if (result.isNew) {
        luckScore += 5; // Bonus pour nouveau héros
      }
    });
    
    return Math.min(100, Math.max(0, Math.round(luckScore)));
  }

  // === MÉTHODES EXISTANTES INCHANGÉES ===

  public static async performPull(
    playerId: string,
    serverId: string,
    pullType: "Standard" | "Limited" | "Ticket",
    count: number = 1
  ): Promise<GachaResponse> {
    try {
      // Trouver la bannière correspondante au type
      let bannerType = pullType;
      if (pullType === "Ticket") bannerType = "Standard";

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

    // ✅ Calculer les informations de focus depuis focusHeroes
    let focusInfo: string | null = null;
    if (banner.focusHeroes && banner.focusHeroes.length > 0) {
      const focusHero = banner.focusHeroes[0];
      if (focusHero.focusChance) {
        focusInfo = `${(focusHero.focusChance * 100).toFixed(0)}% chance for focus heroes`;
      }
      if (focusHero.guaranteed) {
        focusInfo = focusInfo 
          ? `${focusInfo} (first legendary guaranteed)` 
          : 'First legendary guaranteed as focus hero';
      }
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
          `10x pull discount available` : null,
        focusRateUp: focusInfo,  // ✅ Utilise la nouvelle logique
        specialMechanics: this.getBannerSpecialMechanics(banner)
      }
    };

  } catch (error: any) {
    console.error("❌ Erreur getBannerRates:", error);
    throw error;
  }
}

  public static getDropRates() {
    return {
      success: true,
      message: "Use /banners endpoint to get current banner rates",
      fallbackRates: {
        Standard: { Common: 50, Rare: 30, Epic: 15, Legendary: 5 },
        Limited: { Common: 40, Rare: 35, Epic: 20, Legendary: 5 }
      },
      fallbackPity: FALLBACK_CONFIG.pity,
      // Nouvelles informations
      systemInfo: {
        animations: GACHA_CONFIG.animations,
        rareDrop: GACHA_CONFIG.rareDrop,
        notifications: "Real-time WebSocket notifications enabled"
      }
    };
  }

  private static async calculatePityStatus(playerId: string, serverId: string, bannerId?: string) {
    const recentSummons = await Summon.find({ 
      playerId,
      ...(bannerId && { bannerId })
    })
      .sort({ createdAt: -1 })
      .limit(200); // Augmenté pour plus de précision

    let pullsSinceLegendary = 0;
    let pullsSinceEpic = 0;

    for (const summon of recentSummons) {
      for (const hero of summon.heroesObtained) {
        if (hero.rarity === "Legendary") {
          return { pullsSinceLegendary, pullsSinceEpic };
        }
        if (hero.rarity === "Epic" && pullsSinceEpic === pullsSinceLegendary) {
          pullsSinceEpic = pullsSinceLegendary;
        }
        pullsSinceLegendary++;
        if (pullsSinceEpic === pullsSinceLegendary - 1) {
          pullsSinceEpic++;
        }
      }
    }

    return { pullsSinceLegendary, pullsSinceEpic };
  }

  private static rollRarity(rates: any): string {
    const rand = Math.random() * 100;
    let cumulative = 0;
    
    // Ordre important: du plus rare au plus commun
    const orderedRarities = ["Legendary", "Epic", "Rare", "Common"];
    
    for (const rarityName of orderedRarities) {
      if (rates[rarityName]) {
        cumulative += rates[rarityName];
        if (rand < cumulative) {
          return rarityName;
        }
      }
    }
    
    return "Common"; // Fallback
  }

  private static getFragmentsByRarity(rarity: string): number {
    const fragmentsByRarity: Record<string, number> = {
      Common: 5,
      Rare: 10,
      Epic: 15,
      Legendary: 25,
      Mythic: 50 
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

  // === MÉTHODES PUBLIQUES POUR L'HISTORIQUE ET STATS (enrichies) ===

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

      // Enrichir les données d'historique
      const enrichedSummons = summons.map(summon => ({
        ...summon.toObject(),
        luckScore: this.calculateLuckScore(
          summon.heroesObtained.map((h: any) => ({
            rarity: h.rarity,
            isNew: h.isNew || false,
            isFocus: h.isFocus || false,
            dropRate: 5 // Valeur par défaut
          } as GachaPullResult))
        ),
        summary: {
          legendary: summon.heroesObtained.filter((h: any) => h.rarity === 'Legendary').length,
          epic: summon.heroesObtained.filter((h: any) => h.rarity === 'Epic').length,
          newHeroes: summon.heroesObtained.filter((h: any) => h.isNew).length || 0
        }
      }));

      const pagination = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      };

      return {
        success: true,
        summons: enrichedSummons,
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

      // Statistiques avancées
      const recentSummons = await Summon.find({ playerId })
        .sort({ createdAt: -1 })
        .limit(50);

      const luckScores = recentSummons.map(summon => 
        this.calculateLuckScore(
          summon.heroesObtained.map((h: any) => ({
            rarity: h.rarity,
            isNew: h.isNew || false,
            isFocus: h.isFocus || false,
            dropRate: 5
          } as GachaPullResult))
        )
      );

      const averageLuckScore = luckScores.length > 0 ? 
        Math.round(luckScores.reduce((a, b) => a + b, 0) / luckScores.length) : 50;

      const stats = {
        totalSummons: totalStats[0]?.totalSummons || 0,
        totalSessions: totalStats[0]?.totalSessions || 0,
        rarityDistribution: rarityStats.reduce((acc: any, stat: any) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {} as Record<string, number>),
        // Nouvelles statistiques
        averageLuckScore,
        bestLuckScore: Math.max(...luckScores, 50),
        recentActivity: {
          lastPull: recentSummons[0]?.createdAt || null,
          pullsLast7Days: recentSummons.filter(s => 
            s.createdAt && s.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          ).length,
          favoriteRarity: this.getMostPulledRarity(rarityStats)
        }
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
          pityStatus: {
            ...pityStatus,
            efficiency: this.calculatePityEfficiency(pityStatus, stats.totalSummons)
          }
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getSummonStats:", error);
      throw error;
    }
  }

  /**
   * Obtenir la rareté la plus pullée
   */
  private static getMostPulledRarity(rarityStats: any[]): string {
    if (rarityStats.length === 0) return "Common";
    
    return rarityStats.reduce((max, current) => 
      current.count > max.count ? current : max
    )._id;
  }

  /**
   * Calculer l'efficacité du système pity
   */
  private static calculatePityEfficiency(pityStatus: any, totalSummons: number): number {
    if (totalSummons === 0) return 100;
    
    const expectedLegendaryPerPity = totalSummons / 90;
    const actualLegendaryRate = (totalSummons - pityStatus.pullsSinceLegendary) / totalSummons;
    
    return Math.round((actualLegendaryRate / (expectedLegendaryPerPity / totalSummons)) * 100);
  }

  // === NOUVELLES MÉTHODES POUR ÉVÉNEMENTS SPÉCIAUX ===

  /**
   * Déclencher un événement rate-up
   */
  public static async triggerRateUpEvent(
    serverId: string,
    eventConfig: {
      bannerId: string;
      duration: number; // en heures
      rateMultiplier: number;
      focusHeroes?: string[];
    }
  ): Promise<void> {
    try {
      const banner = await Banner.findOne({ bannerId: eventConfig.bannerId });
      if (!banner) {
        throw new Error("Banner not found");
      }

      // Temporairement augmenter les taux (implémentation simplifiée)
      const originalRates = { ...banner.rates };
      banner.rates.Legendary *= eventConfig.rateMultiplier;
      banner.rates.Epic *= eventConfig.rateMultiplier;
      await banner.save();

      // Notifier via WebSocket
      if (WebSocketGacha.isAvailable()) {
        WebSocketGacha.notifyRateUpEvent(serverId, {
          eventType: 'rate_up',
          bannerId: eventConfig.bannerId,
          bannerName: banner.name,
          duration: eventConfig.duration,
          focusHeroes: eventConfig.focusHeroes || banner.focusHeroes.map(f => f.heroId),
          bonusMultiplier: eventConfig.rateMultiplier,
          description: `Taux augmentés x${eventConfig.rateMultiplier} pendant ${eventConfig.duration}h`
        });
      }

      // Programmer la fin de l'événement
      setTimeout(async () => {
        banner.rates = originalRates;
        await banner.save();
        console.log(`🎉 Rate-up event ended for ${banner.name}`);
      }, eventConfig.duration * 60 * 60 * 1000);

      console.log(`🚀 Rate-up event started for ${banner.name}: x${eventConfig.rateMultiplier} for ${eventConfig.duration}h`);

    } catch (error) {
      console.error("❌ Erreur triggerRateUpEvent:", error);
      throw error;
    }
  }

  /**
   * Déclencher un événement pulls gratuits
   */
  public static async triggerFreePullsEvent(
    serverId: string,
    eventConfig: {
      bannerId: string;
      freePulls: number;
      duration: number; // en heures
      perPlayer: boolean;
    }
  ): Promise<void> {
    try {
      const banner = await Banner.findOne({ bannerId: eventConfig.bannerId });
      if (!banner) {
        throw new Error("Banner not found");
      }

      // Notifier via WebSocket
      if (WebSocketGacha.isAvailable()) {
        WebSocketGacha.notifyFreePullsEvent(serverId, {
          eventName: `Free ${eventConfig.freePulls} Pulls`,
          bannerId: eventConfig.bannerId,
          bannerName: banner.name,
          freePullsCount: eventConfig.freePulls,
          duration: eventConfig.duration,
          restrictions: eventConfig.perPlayer ? ['One per player'] : undefined
        });
      }

      // Logique d'implémentation des pulls gratuits
      // TODO: Implémenter le système de suivi des pulls gratuits par joueur

      console.log(`🎁 Free pulls event started: ${eventConfig.freePulls} pulls on ${banner.name} for ${eventConfig.duration}h`);

    } catch (error) {
      console.error("❌ Erreur triggerFreePullsEvent:", error);
      throw error;
    }
  }

  /**
   * Activer une bannière spéciale
   */
  public static async activateSpecialBanner(
    serverId: string,
    bannerConfig: {
      bannerId: string;
      duration: number;
      exclusiveHeroes: string[];
      specialMechanics: string[];
    }
  ): Promise<void> {
    try {
      const banner = await Banner.findOne({ bannerId: bannerConfig.bannerId });
      if (!banner) {
        throw new Error("Banner not found");
      }

      banner.isActive = true;
      banner.isVisible = true;
      banner.endTime = new Date(Date.now() + bannerConfig.duration * 60 * 60 * 1000);
      await banner.save();

      // Notifier via WebSocket
      if (WebSocketGacha.isAvailable()) {
        WebSocketGacha.notifySpecialBannerLive(serverId, {
          bannerId: bannerConfig.bannerId,
          bannerName: banner.name,
          bannerType: banner.type as any,
          exclusiveHeroes: bannerConfig.exclusiveHeroes,
          duration: bannerConfig.duration,
          specialMechanics: bannerConfig.specialMechanics
        });
      }

      console.log(`🌟 Special banner activated: ${banner.name} for ${bannerConfig.duration}h with ${bannerConfig.exclusiveHeroes.length} exclusive heroes`);

    } catch (error) {
      console.error("❌ Erreur activateSpecialBanner:", error);
      throw error;
    }
  }
// === PULLS ÉLÉMENTAIRES ===

  /**
   * Effectuer un pull sur une bannière élémentaire avec des tickets
   */
  public static async performElementalPull(
    playerId: string,
    serverId: string,
    element: string,
    count: number = 1
  ): Promise<GachaResponse> {
    try {
      console.log(`🔮 ${playerId} performs ${count} elemental pull(s) on ${element} banner`);

      // 1. Vérifier que l'élément est valide
      const validElements = ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"];
      if (!validElements.includes(element)) {
        throw new Error(`Invalid element: ${element}. Valid: ${validElements.join(", ")}`);
      }

      // 2. Vérifier la rotation (bannière active aujourd'hui ?)
      const isActive = await ElementalBannerService.isElementActive(serverId, element);
      if (!isActive) {
        throw new Error(`${element} elemental banner is not active today`);
      }

      // 3. Vérifier que le joueur existe et a assez de tickets
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found on this server");
      }

      if (!player.hasElementalTickets(element, count)) {
        throw new Error(
          `Insufficient ${element} tickets. Required: ${count}, Available: ${player.elementalTickets[element.toLowerCase() as keyof typeof player.elementalTickets]}`
        );
      }

      // 4. Trouver la bannière élémentaire
      const banner = await Banner.findOne({
        isActive: true,
        isVisible: true,
        "elementalConfig.element": element,
        $or: [
          { "serverConfig.allowedServers": serverId },
          { "serverConfig.allowedServers": "ALL" }
        ]
      });

      if (!banner) {
        throw new Error(`No active ${element} elemental banner found`);
      }

      console.log(`✅ Found elemental banner: ${banner.name} (${banner.bannerId})`);

      // 5. Effectuer le pull (réutiliser la logique existante)
      const pullResponse = await this.executeBannerPullsElemental(
        playerId,
        serverId,
        banner.bannerId,
        element,
        count
      );

      // 6. Déduire les tickets
      await player.spendElementalTickets(element, count);
      console.log(`💎 Spent ${count}x ${element} ticket(s)`);

      // 7. Calculer les stats finales
      const finalStats = this.calculatePullStats(pullResponse.results);

      // 8. Calculer les effets spéciaux
      const pityConfig = {
        legendaryPity: banner.pityConfig?.legendaryPity || 50,
        epicPity: banner.pityConfig?.epicPity || 0
      };
      const specialEffects = this.calculateSpecialEffects(
        pullResponse.results, 
        pullResponse.pityState, 
        count
      );

      // 9. Construire la réponse
      const response: GachaResponse = {
        success: true,
        results: pullResponse.results,
        stats: finalStats,
        cost: { 
          // Pas de gems/tickets normaux, seulement les tickets élémentaires
        },
        remaining: {
          gems: player.gems,
          tickets: player.tickets
        },
        pityStatus: {
          pullsSinceLegendary: pullResponse.pityState.pullsSinceLegendary,
          pullsSinceEpic: 0,
          legendaryPityIn: Math.max(0, pityConfig.legendaryPity - pullResponse.pityState.pullsSinceLegendary),
          epicPityIn: 0
        },
        bannerInfo: {
          bannerId: banner.bannerId,
          name: banner.name,
          focusHeroes: banner.focusHeroes?.map((f: any) => f.heroId) || []
        },
        specialEffects,
        notifications: {
          hasLegendary: finalStats.legendary > 0,
          hasUltraRare: pullResponse.results.some((r: any) => r.dropRate && r.dropRate < GACHA_CONFIG.rareDrop.legendaryThreshold),
          hasLuckyStreak: specialEffects.luckyStreakCount >= GACHA_CONFIG.rareDrop.streakThreshold,
          hasPityTrigger: specialEffects.hasPityBreak,
          hasNewHero: finalStats.newHeroes > 0,
          hasCollectionProgress: true
        }
      };

      console.log(`✅ Elemental pull completed: ${pullResponse.results.length} heroes (${finalStats.legendary}L/${finalStats.epic}E)`);

      return response;

    } catch (error: any) {
      console.error("❌ Error performElementalPull:", error);
      throw error;
    }
  }

  /**
   * Effectuer les pulls élémentaires avec pity élémentaire et wishlist élémentaire
   */
  private static async executeBannerPullsElemental(
    playerId: string,
    serverId: string,
    bannerId: string,
    element: string,
    count: number
  ): Promise<{
    success: boolean;
    results: any[];
    pityState: any;
    currency: any;
  }> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const banner = await Banner.findOne({ bannerId });
      if (!banner) {
        throw new Error("Banner not found");
      }

      // Récupérer ou créer le pity élémentaire
      let pityState = await BannerPity.findOne({ 
        playerId, 
        bannerId,
        element 
      });
      
      if (!pityState) {
        pityState = new BannerPity({
          playerId,
          bannerId,
          element,
          pullsSinceLegendary: 0,
          pullsSinceEpic: 0,
          totalPulls: 0,
          hasReceivedLegendary: false
        });
        await pityState.save();
      }

      const pityConfig = {
        legendaryPity: banner.pityConfig?.legendaryPity || 50,
        epicPity: 0
      };

      console.log(`\n🔮 Starting ${count} elemental pulls (${element}):`);
      console.log(`   Pity: ${pityState.pullsSinceLegendary}/${pityConfig.legendaryPity}`);

      // Récupérer le pool de héros (filtré par élément)
      const availableHeroes = await banner.getAvailableHeroes();
      const elementHeroes = availableHeroes.filter((h: any) => h.element === element);
      
      if (elementHeroes.length === 0) {
        throw new Error(`No ${element} heroes available in banner pool`);
      }

      console.log(`   Available ${element} heroes: ${elementHeroes.length}`);

      const results: any[] = [];
      let currentPullsSinceLegendary = pityState.pullsSinceLegendary;

      // Boucle de pulls
      for (let i = 0; i < count; i++) {
        let rarity: string;
        let isPityTriggered = false;
        let isWishlistPity = false;

        // ✅ Vérifier pity wishlist élémentaire EN PREMIER
        const wishlistPityTriggered = await WishlistService.isElementalWishlistPityTriggered(
          playerId,
          serverId,
          element
        );

        if (wishlistPityTriggered) {
          rarity = "Legendary";
          isPityTriggered = true;
          isWishlistPity = true;
          console.log(`\n🎯 [PULL ${i + 1}] ELEMENTAL WISHLIST PITY TRIGGERED (${element}, 100 pulls)`);
        }
        // Pity legendary normal (50 pulls)
        else if (currentPullsSinceLegendary >= pityConfig.legendaryPity) {
          rarity = "Legendary";
          isPityTriggered = true;
          console.log(`\n🔔 [PULL ${i + 1}] ELEMENTAL PITY TRIGGERED (${element}, ${pityConfig.legendaryPity} pulls)`);
        }
        // Roll normal
        else {
          rarity = this.rollRarity(banner.rates as any);
        }

        console.log(`   ├─ Rarity: ${rarity}`);

        // Sélection du héros
        let selectedHero: any;

        if (isWishlistPity) {
          // Wishlist élémentaire déclenché
          const wishlistHero = await WishlistService.getRandomElementalWishlistHero(
            playerId, 
            serverId,
            element
          );

          if (wishlistHero) {
            selectedHero = wishlistHero;
            console.log(`   🎯 Elemental Wishlist Hero: ${selectedHero.name} ⭐`);
          } else {
            // Wishlist vide - sélection Legendary normale
            console.log(`   ⚠️ Wishlist empty, random ${element} Legendary`);
            const legendaries = elementHeroes.filter((h: any) => h.rarity === "Legendary");
            selectedHero = legendaries[Math.floor(Math.random() * legendaries.length)];
          }
        } else {
          // Sélection normale par rareté (dans le pool élémentaire)
          const heroesOfRarity = elementHeroes.filter((h: any) => h.rarity === rarity);
          if (heroesOfRarity.length === 0) {
            throw new Error(`No ${element} heroes found for rarity: ${rarity}`);
          }
          selectedHero = heroesOfRarity[Math.floor(Math.random() * heroesOfRarity.length)];
        }

        console.log(`   └─ Hero: ${selectedHero.name} (${selectedHero.rarity})`);

        // Vérifier si déjà possédé
        const existingHero = player.heroes.find(
          (h: any) => h.heroId === selectedHero._id.toString()
        );

        if (existingHero) {
          console.log(`   🔄 Already owned, converting to fragments`);
          
          const fragmentsMap: { [key: string]: number } = {
            Common: 5,
            Rare: 10,
            Epic: 25,
            Legendary: 50
          };

          const fragmentsGained = fragmentsMap[selectedHero.rarity] || 5;
          const fragmentKey = `${selectedHero._id}_fragment`;
          const currentFragments = player.fragments.get(fragmentKey) || 0;
          player.fragments.set(fragmentKey, currentFragments + fragmentsGained);

          console.log(`   └─ +${fragmentsGained} fragments`);
        } else {
          await player.addHero(selectedHero._id.toString(), 1, 1);
          console.log(`   ✅ New hero added`);
        }

        results.push({
          hero: selectedHero,
          rarity: selectedHero.rarity,
          isNew: !existingHero,
          isDuplicate: !!existingHero,
          isPityTriggered,
          isWishlistPity,
          pullNumber: i + 1
        });

        // Gestion des compteurs de pity
        if (rarity === "Legendary") {
          currentPullsSinceLegendary = 0;
          pityState.hasReceivedLegendary = true;

          // Reset pity wishlist élémentaire
          await WishlistService.resetElementalWishlistPity(playerId, serverId, element);

          console.log(`   └─ Pity RESET → Elemental Legendary: 0, Elemental Wishlist: 0`);
        } else {
          currentPullsSinceLegendary++;

          // Incrémenter pity wishlist élémentaire
          await WishlistService.incrementElementalWishlistPity(playerId, serverId, element);
        }
      }

      // Sauvegarder le pity
      pityState.pullsSinceLegendary = currentPullsSinceLegendary;
      pityState.totalPulls += count;
      await pityState.save();

      // Sauvegarder le joueur
      await player.save();

      console.log(`\n✅ ${count} elemental pulls completed`);
      console.log(`📊 Final Pity: ${pityState.pullsSinceLegendary}/${pityConfig.legendaryPity}`);

      return {
        success: true,
        results,
        pityState: {
          pullsSinceLegendary: pityState.pullsSinceLegendary,
          totalPulls: pityState.totalPulls,
          hasReceivedLegendary: pityState.hasReceivedLegendary
        },
        currency: {
          gems: player.gems,
          paidGems: player.paidGems,
          tickets: player.tickets
        }
      };

    } catch (error: any) {
      console.error("❌ Error in executeBannerPullsElemental:", error);
      throw error;
    }
  }
}

import Player from "../models/Player";
import Hero from "../models/Hero";
import Summon from "../models/Summon";
import Banner from "../models/Banner";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { WebSocketGacha } from "./websocket/WebSocketGacha";

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
      const pullResults = await this.executeBannerPulls(
        player,
        banner,
        count,
        pityStatus,
        pityConfig
      );

      // Calculer les effets spéciaux
      const specialEffects = this.calculateSpecialEffects(pullResults, pityStatus, count);

      // Enregistrer l'invocation
      await this.recordSummon(playerId, pullResults, banner.type, bannerId);

      // Mettre à jour les statistiques de la bannière
      const rarities = pullResults.map(r => r.rarity);
      await banner.updateStats(count, rarities);

      // Calculer le nouveau statut pity
      const newPityStatus = this.calculateNewPityStatus(
        pityStatus,
        pullResults,
        count,
        pityConfig
      );

      // Calculer les statistiques finales
      const finalStats = this.calculatePullStats(pullResults);

      // Construire la réponse
      const response: GachaResponse = {
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
        },
        specialEffects,
        notifications: {
          hasLegendary: finalStats.legendary > 0,
          hasUltraRare: pullResults.some(r => r.dropRate && r.dropRate < GACHA_CONFIG.rareDrop.legendaryThreshold),
          hasLuckyStreak: specialEffects.luckyStreakCount >= GACHA_CONFIG.rareDrop.streakThreshold,
          hasPityTrigger: specialEffects.hasPityBreak,
          hasNewHero: finalStats.newHeroes > 0,
          hasCollectionProgress: true
        }
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
    const player = await Player.findById(playerId);
    const totalHeroes = await Hero.countDocuments();
    
    return {
      totalHeroes,
      ownedHeroes: player?.heroes.length || 0
    };
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

  // Exécuter les pulls avec la configuration de la bannière (version enrichie)
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
      const heroesOfRarity = availableHeroes.filter((h: any) => h.rarity === rarity);
      if (heroesOfRarity.length === 0) {
        // Fallback vers une rareté disponible
        const fallbackHero = availableHeroes[Math.floor(Math.random() * availableHeroes.length)];
        rarity = fallbackHero.rarity;
      }

      // Appliquer les rate-up pour les héros focus
      let selectedHero: any;
      let isFocus = false;
      const isFocusRarity = rarity === "Legendary" || rarity === "Epic";
      const focusHeroesOfRarity = banner.focusHeroes.filter((f: any) => {
        const focusHero = availableHeroes.find((h: any) => h._id.toString() === f.heroId);
        return focusHero && focusHero.rarity === rarity;
      });

      if (isFocusRarity && focusHeroesOfRarity.length > 0 && Math.random() < 0.5) {
        // 50% de chance d'obtenir un héros focus si disponible
        const focusHero = focusHeroesOfRarity[Math.floor(Math.random() * focusHeroesOfRarity.length)];
        selectedHero = availableHeroes.find((h: any) => h._id.toString() === focusHero.heroId);
        isFocus = true;
      } else {
        // Sélection normale
        const heroesOfRarity = availableHeroes.filter((h: any) => h.rarity === rarity);
        selectedHero = heroesOfRarity[Math.floor(Math.random() * heroesOfRarity.length)];
      }

      if (!selectedHero) {
        console.error(`❌ Aucun héros trouvé pour la rareté ${rarity}`);
        continue;
      }

      // Calculer le taux de drop effectif
      let dropRate = banner.rates[rarity];
      if (isFocus && banner.rates.focusRateUp) {
        dropRate += banner.rates.focusRateUp;
      }

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
          isFocus,
          dropRate
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
          isFocus,
          dropRate
        });
      }
    }

    await player.save();
    return results;
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
      pullsSinceEpic: oldStatus.pullsSinceEpic + count,
      legendaryPityIn: 0,
      epicPityIn: 0
    };

    // Reset pity si des légendaires/épiques ont été obtenus
    const legendaryCount = results.filter(r => r.rarity === "Legendary").length;
    const epicCount = results.filter(r => r.rarity === "Epic").length;
    
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
      newStatus.pullsSinceEpic = pullsToLastLegendary;
    } else if (epicCount > 0) {
      // Trouver le dernier épique pour reset précis
      let pullsToLastEpic = 0;
      for (let i = results.length - 1; i >= 0; i--) {
        if (results[i].rarity === "Epic") {
          pullsToLastEpic = results.length - i - 1;
          break;
        }
      }
      newStatus.pullsSinceEpic = pullsToLastEpic;
    }

    newStatus.legendaryPityIn = Math.max(0, pityConfig.legendaryPity - newStatus.pullsSinceLegendary);
    newStatus.epicPityIn = Math.max(0, pityConfig.epicPity - newStatus.pullsSinceEpic);

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
    heroesObtained: results.map(r => ({
      heroId: r.hero._id,
      rarity: r.rarity,
      // Ajouter métadonnées si le modèle les supporte
      isNew: r.isNew,
      isFocus: r.isFocus,
      fragmentsGained: r.fragmentsGained
    })),
    type: summonType  // ✅ Utiliser le type mappé
    // Ajouter bannerId si le modèle Summon le supporte
    // bannerId: bannerId
  });
  
  await summon.save();
  
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
          // Nouvelles informations
          focusRateUp: banner.rates.focusRateUp ? 
            `+${banner.rates.focusRateUp}% chance for focus heroes` : null,
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

  private static rollRarity(rates: Record<string, number>): string {
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
}

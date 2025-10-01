// server/src/services/MythicService.ts

import Player from "../models/Player";
import Hero from "../models/Hero";
import Banner from "../models/Banner";
import MythicPity from "../models/MythicPity";
import Summon from "../models/Summon";
import { WebSocketGacha } from "./websocket/WebSocketGacha";
import { GachaPullResult } from "./GachaService";

// Configuration mythique
const MYTHIC_CONFIG = {
  fusedPullsPerScroll: 80,      // 80 pulls Normal/Limited → 1 parchemin
  mythicPityThreshold: 35,       // 35 pulls mythiques → garanti
  scrollCostSingle: 1,           // Coût 1 pull simple
  scrollCostMulti: 10            // Coût 10-pull
};

export interface MythicPullResult extends GachaPullResult {
  isMythic?: boolean;
}

export interface MythicGachaResponse {
  success: boolean;
  results: MythicPullResult[];
  stats: {
    mythic: number;
    legendary: number;
    newHeroes: number;
    totalFragments: number;
  };
  scrollsUsed: number;
  scrollsRemaining: number;
  pityStatus: {
    mythicPullsSinceLast: number;
    pullsUntilMythicPity: number;
  };
  bannerInfo: {
    bannerId: string;
    name: string;
  };
}

export class MythicService {

  // === INCRÉMENTER LE COMPTEUR FUSIONNÉ ===
  
  /**
   * Incrémenter le compteur fusionné après pulls Normal/Limited
   * Appelé automatiquement par GachaService
   */
  static async incrementFusedCounter(
    playerId: string,
    serverId: string,
    pullCount: number
  ): Promise<{
    scrollsEarned: number;
    totalScrolls: number;
    fusedCounter: number;
  }> {
    try {
      console.log(`🔮 Incrementing fused counter for ${playerId}: +${pullCount} pulls`);

      // Récupérer ou créer le pity mythique
      let mythicPity = await MythicPity.findOne({ playerId, serverId });
      
      if (!mythicPity) {
        mythicPity = new MythicPity({
          playerId,
          serverId,
          fusedPullCounter: 0,
          scrollsEarned: 0,
          scrollsUsed: 0,
          scrollsAvailable: 0,
          mythicPullsSinceLast: 0,
          mythicPityThreshold: MYTHIC_CONFIG.mythicPityThreshold,
          totalMythicPulls: 0,
          lastScrollEarnedAt: new Date(),
          mythicHeroesObtained: []
        });
      }

      // Incrémenter le compteur
      mythicPity.fusedPullCounter += pullCount;

      // Vérifier si on doit octroyer des parchemins
      const scrollsEarned = await this.checkAndGrantScrolls(mythicPity);

      await mythicPity.save();

      console.log(`   └─ Fused counter: ${mythicPity.fusedPullCounter}/${MYTHIC_CONFIG.fusedPullsPerScroll}`);
      if (scrollsEarned > 0) {
        console.log(`   🎁 ${scrollsEarned} mythic scroll(s) earned!`);
      }

      return {
        scrollsEarned,
        totalScrolls: mythicPity.scrollsAvailable,
        fusedCounter: mythicPity.fusedPullCounter
      };

    } catch (error: any) {
      console.error("❌ Error incrementFusedCounter:", error);
      throw error;
    }
  }

  /**
   * Vérifier et octroyer des parchemins mythiques
   * 80 pulls fusionnés → 1 parchemin
   */
  private static async checkAndGrantScrolls(
    mythicPity: any
  ): Promise<number> {
    try {
      const scrollsToGrant = Math.floor(mythicPity.fusedPullCounter / MYTHIC_CONFIG.fusedPullsPerScroll);
      
      if (scrollsToGrant > 0) {
        // Octroyer les parchemins
        await mythicPity.earnScrolls(scrollsToGrant);
        
        // Réduire le compteur fusionné
        mythicPity.fusedPullCounter = mythicPity.fusedPullCounter % MYTHIC_CONFIG.fusedPullsPerScroll;
        
        return scrollsToGrant;
      }

      return 0;

    } catch (error: any) {
      console.error("❌ Error checkAndGrantScrolls:", error);
      return 0;
    }
  }

  // === PULLS MYTHIQUES ===

  /**
   * Effectuer un pull sur bannière mythique avec parchemins
   */
  static async performMythicPull(
    playerId: string,
    serverId: string,
    bannerId: string,
    count: number = 1
  ): Promise<MythicGachaResponse> {
    try {
      console.log(`🔮 ${playerId} performs ${count} mythic pull(s) on banner ${bannerId}`);

      // Vérifier que count est valide
      if (count !== 1 && count !== 10) {
        throw new Error("Invalid pull count. Must be 1 or 10.");
      }

      // Récupérer la bannière mythique
      const banner = await Banner.findOne({
        bannerId,
        type: "Mythic",
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
        throw new Error("Mythic banner not found or not active");
      }

      // Récupérer le joueur
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found on this server");
      }

      // Récupérer le pity mythique
      const mythicPity = await MythicPity.findOne({ playerId, serverId });
      if (!mythicPity) {
        throw new Error("Mythic pity not found. Please perform Normal/Limited pulls first to earn scrolls.");
      }

      // Vérifier le coût en parchemins
      const scrollCost = count === 1 ? MYTHIC_CONFIG.scrollCostSingle : MYTHIC_CONFIG.scrollCostMulti;
      
      if (mythicPity.scrollsAvailable < scrollCost) {
        throw new Error(
          `Insufficient mythic scrolls. Required: ${scrollCost}, Available: ${mythicPity.scrollsAvailable}`
        );
      }

      console.log(`✅ Mythic pull validated: ${scrollCost} scroll(s) will be used`);

      // Effectuer les pulls
      const pullResponse = await this.executeMythicPulls(
        player,
        mythicPity,
        banner,
        count
      );

      // Déduire les parchemins
      await mythicPity.useScrolls(scrollCost);

      // Enregistrer l'invocation
      await this.recordMythicSummon(playerId, pullResponse.results, bannerId);

      // Mettre à jour les stats de la bannière
      const rarities = pullResponse.results.map(r => r.rarity);
      await banner.updateStats(count, rarities);

      // Calculer les stats finales
      const finalStats = {
        mythic: pullResponse.results.filter(r => r.rarity === "Mythic").length,
        legendary: pullResponse.results.filter(r => r.rarity === "Legendary").length,
        newHeroes: pullResponse.results.filter(r => r.isNew).length,
        totalFragments: pullResponse.results.reduce((sum, r) => sum + r.fragmentsGained, 0)
      };

      // Construire la réponse
      const response: MythicGachaResponse = {
        success: true,
        results: pullResponse.results,
        stats: finalStats,
        scrollsUsed: scrollCost,
        scrollsRemaining: mythicPity.scrollsAvailable,
        pityStatus: {
          mythicPullsSinceLast: mythicPity.mythicPullsSinceLast,
          pullsUntilMythicPity: Math.max(0, mythicPity.mythicPityThreshold - mythicPity.mythicPullsSinceLast)
        },
        bannerInfo: {
          bannerId: banner.bannerId,
          name: banner.name
        }
      };

      // Notifications WebSocket
      await this.processMythicNotifications(playerId, serverId, response, banner);

      console.log(`✅ Mythic pull completed: ${finalStats.mythic}M/${finalStats.legendary}L obtained`);

      return response;

    } catch (error: any) {
      console.error("❌ Error performMythicPull:", error);
      throw error;
    }
  }

  /**
   * Exécuter les pulls mythiques avec pity
   */
  private static async executeMythicPulls(
    player: any,
    mythicPity: any,
    banner: any,
    count: number
  ): Promise<{
    results: MythicPullResult[];
  }> {
    try {
      console.log(`\n🔮 Starting ${count} mythic pulls`);
      console.log(`📊 Current Mythic Pity: ${mythicPity.mythicPullsSinceLast}/${mythicPity.mythicPityThreshold}`);

      // Récupérer le pool de héros (Mythic + Legendary)
      const availableHeroes = await banner.getAvailableHeroes();
      const mythicHeroes = availableHeroes.filter((h: any) => h.rarity === "Mythic");
      const legendaryHeroes = availableHeroes.filter((h: any) => h.rarity === "Legendary");

      if (mythicHeroes.length === 0) {
        throw new Error("No Mythic heroes available in pool");
      }

      console.log(`   Available: ${mythicHeroes.length} Mythic, ${legendaryHeroes.length} Legendary`);

      const results: MythicPullResult[] = [];
      let currentMythicPity = mythicPity.mythicPullsSinceLast;

      // Boucle de pulls
      for (let i = 0; i < count; i++) {
        let rarity: string;
        let isPityTriggered = false;

        // Vérifier pity mythique
        if (currentMythicPity >= mythicPity.mythicPityThreshold) {
          rarity = "Mythic";
          isPityTriggered = true;
          console.log(`\n🔔 [PULL ${i + 1}] MYTHIC PITY TRIGGERED (${mythicPity.mythicPityThreshold} pulls)!`);
        } else {
          // Roll normal : 5% Mythic / 95% Legendary
          rarity = this.rollMythicRarity(banner.rates);
        }

        console.log(`   ├─ Rarity rolled: ${rarity}`);

        // Sélectionner le héros
        let selectedHero: any;
        
        if (rarity === "Mythic") {
          selectedHero = mythicHeroes[Math.floor(Math.random() * mythicHeroes.length)];
        } else {
          selectedHero = legendaryHeroes[Math.floor(Math.random() * legendaryHeroes.length)];
        }

        console.log(`   └─ Hero obtained: ${selectedHero.name} (${selectedHero.rarity})`);

        // Vérifier si déjà possédé
        const existingHero = player.heroes.find(
          (h: any) => h.heroId === selectedHero._id.toString()
        );

        if (existingHero) {
          console.log(`   🔄 Already owned, converting to fragments`);
          
          const fragmentsMap: { [key: string]: number } = {
            Legendary: 50,
            Mythic: 100
          };

          const fragmentsGained = fragmentsMap[selectedHero.rarity] || 50;
          const fragmentKey = `${selectedHero._id}_fragment`;
          const currentFragments = player.fragments.get(fragmentKey) || 0;
          player.fragments.set(fragmentKey, currentFragments + fragmentsGained);

          console.log(`   └─ +${fragmentsGained} fragments of ${selectedHero.name}`);
        } else {
          // Nouveau héros
          await player.addHero(selectedHero._id.toString(), 1, 1);
          console.log(`   ✅ New hero added to roster`);
        }

        // Ajouter le résultat
        results.push({
          hero: selectedHero,
          rarity: selectedHero.rarity,
          isNew: !existingHero,
          fragmentsGained: existingHero ? (selectedHero.rarity === "Mythic" ? 100 : 50) : 0,
          isMythic: selectedHero.rarity === "Mythic",
          isPityTriggered
        } as MythicPullResult);

        // Gérer le pity
        if (rarity === "Mythic") {
          currentMythicPity = 0;
          mythicPity.mythicHeroesObtained.push(selectedHero._id.toString());
          console.log(`   └─ Mythic Pity RESET → 0/${mythicPity.mythicPityThreshold}`);
        } else {
          currentMythicPity++;
        }

        mythicPity.incrementMythicPity();
      }

      // Sauvegarder
      mythicPity.mythicPullsSinceLast = currentMythicPity;
      if (results.some(r => r.rarity === "Mythic")) {
        mythicPity.resetMythicPity();
      }
      await mythicPity.save();
      await player.save();

      console.log(`\n✅ ${count} mythic pulls completed`);
      console.log(`📊 Final Mythic Pity: ${currentMythicPity}/${mythicPity.mythicPityThreshold}`);

      return { results };

    } catch (error: any) {
      console.error("❌ Error executeMythicPulls:", error);
      throw error;
    }
  }

  /**
   * Roll rarity pour bannière mythique (5% Mythic / 95% Legendary)
   */
  private static rollMythicRarity(rates: any): string {
    const rand = Math.random() * 100;
    
    if (rand < rates.Mythic) {
      return "Mythic";
    }
    
    return "Legendary";
  }

  // === STATISTIQUES ===

  /**
   * Obtenir l'état complet du système mythique
   */
  static async getMythicStatus(
    playerId: string,
    serverId: string
  ): Promise<any> {
    try {
      const mythicPity = await MythicPity.findOne({ playerId, serverId });

      if (!mythicPity) {
        return {
          hasData: false,
          message: "No mythic data found. Perform Normal/Limited pulls to earn mythic scrolls."
        };
      }

      const player = await Player.findOne({ _id: playerId, serverId });
      const mythicHeroesOwned = player?.heroes.filter(h => {
        // Chercher dans la liste des IDs obtenus
        return mythicPity.mythicHeroesObtained.includes(h.heroId.toString());
      }).length || 0;

      return {
        hasData: true,
        fusedCounter: mythicPity.fusedPullCounter,
        scrollsAvailable: mythicPity.scrollsAvailable,
        scrollsEarned: mythicPity.scrollsEarned,
        scrollsUsed: mythicPity.scrollsUsed,
        pullsUntilNextScroll: MYTHIC_CONFIG.fusedPullsPerScroll - (mythicPity.fusedPullCounter % MYTHIC_CONFIG.fusedPullsPerScroll),
        mythicPityCounter: mythicPity.mythicPullsSinceLast,
        pullsUntilMythicPity: Math.max(0, mythicPity.mythicPityThreshold - mythicPity.mythicPullsSinceLast),
        mythicHeroesOwned,
        totalMythicPulls: mythicPity.totalMythicPulls,
        lastScrollEarnedAt: mythicPity.lastScrollEarnedAt,
        lastMythicPulledAt: mythicPity.lastMythicPulledAt
      };

    } catch (error: any) {
      console.error("❌ Error getMythicStatus:", error);
      throw error;
    }
  }

  /**
   * Obtenir l'historique des héros mythiques
   */
  static async getMythicHistory(
    playerId: string,
    serverId: string
  ): Promise<any[]> {
    try {
      const summons = await Summon.find({
        playerId,
        "heroesObtained.rarity": "Mythic"
      })
        .sort({ createdAt: -1 })
        .limit(50);

      const mythicHistory = summons.flatMap(summon => 
        summon.heroesObtained
          .filter((h: any) => h.rarity === "Mythic")
          .map((h: any) => ({
            heroId: h.heroId,
            obtainedAt: summon.createdAt,
            bannerId: summon.bannerId || "mythic_banner"
          }))
      );

      // Populer les infos des héros
      const heroIds = mythicHistory.map(h => h.heroId);
      const heroes = await Hero.find({ _id: { $in: heroIds } });

      return mythicHistory.map(entry => {
        const heroData = heroes.find(h => h._id.toString() === entry.heroId);
        return {
          ...entry,
          heroName: heroData?.name || "Unknown",
          heroElement: heroData?.element || "Unknown"
        };
      });

    } catch (error: any) {
      console.error("❌ Error getMythicHistory:", error);
      return [];
    }
  }

  // === UTILITAIRES ===

  /**
   * Enregistrer une invocation mythique
   */
  private static async recordMythicSummon(
    playerId: string,
    results: MythicPullResult[],
    bannerId: string
  ): Promise<void> {
    try {
      const summon = new Summon({
        playerId,
        bannerId,
        heroesObtained: results.map(r => ({
          heroId: r.hero._id,
          rarity: r.rarity,
          isNew: r.isNew,
          fragmentsGained: r.fragmentsGained
        })),
        type: "Limited" // Utiliser "Limited" comme type car pas de type "Mythic" dans Summon
      });

      await summon.save();
      console.log(`📝 Mythic summon recorded: ${playerId} on ${bannerId}`);

    } catch (error: any) {
      console.error("❌ Error recordMythicSummon:", error);
    }
  }

  /**
   * Notifications WebSocket pour pulls mythiques
   */
  private static async processMythicNotifications(
    playerId: string,
    serverId: string,
    response: MythicGachaResponse,
    banner: any
  ): Promise<void> {
    try {
      if (!WebSocketGacha.isAvailable()) return;

      // Notification pour chaque Mythic obtenu
      const mythicResults = response.results.filter(r => r.rarity === "Mythic");
      
      for (const mythic of mythicResults) {
        WebSocketGacha.notifyLegendaryDrop(playerId, serverId, {
          hero: mythic.hero,
          bannerId: banner.bannerId,
          bannerName: banner.name,
          isFirstTime: mythic.isNew,
          isFocus: false,
          pullsSinceLast: response.pityStatus.mythicPullsSinceLast,
          totalLegendaryCount: await this.getPlayerMythicCount(playerId),
          dropRate: banner.rates.Mythic
        });
      }

    } catch (error) {
      console.warn("⚠️ Error processMythicNotifications:", error);
    }
  }

  /**
   * Obtenir le nombre de mythiques du joueur
   */
  private static async getPlayerMythicCount(playerId: string): Promise<number> {
    const mythicPity = await MythicPity.findOne({ playerId });
    return mythicPity?.mythicHeroesObtained.length || 0;
  }
}

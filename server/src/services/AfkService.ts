// server/src/services/AfkService.ts
import mongoose, { ClientSession, HydratedDocument } from "mongoose";
import AfkState, { IAfkState, IPendingReward } from "../models/AfkState";
import AfkSession, { IAfkSession } from "../models/AfkSession";
import Player from "../models/Player";
import { WebSocketService } from './WebSocketService';
// ✅ NOUVEAU : Import de la config AFK Rewards
import { 
  getAfkRewardsUnlockSummary, 
  isAfkRewardUnlocked,
  calculateAfkRewardPerMinute,
  DEBUG_UNLOCK_ALL_AT_WORLD_1 
} from "../config/afkRewardsConfig";

/**
 * Service AFK Enhanced - Extension du service existant
 * CONSERVE toutes les méthodes existantes pour la compatibilité
 * AJOUTE le nouveau système multi-récompenses AFK Arena
 */

// === INTERFACES EXISTANTES (CONSERVÉES) ===
export interface AfkSummary {
  pendingGold: number;
  baseGoldPerMinute: number;
  maxAccrualSeconds: number;
  accumulatedSinceClaimSec: number;
  lastTickAt: Date | null;
  lastClaimAt: Date | null;
  todayAccruedGold: number;
}

// === NOUVELLES INTERFACES ===
export interface AfkSummaryEnhanced extends AfkSummary {
  pendingRewards: IPendingReward[];
  totalValue: number;
  enhancedRatesPerMinute: {
    gems: number;
    tickets: number;
    materials: number;
    heroXP: number;          // ✅ NOUVEAU
    ascensionEssences: number; // ✅ NOUVEAU
  };
  activeMultipliers: {
    vip: number;
    stage: number;
    heroes: number;
    total: number;
  };
  useEnhancedRewards: boolean;
  canUpgrade: boolean;
  todayClaimedRewards: {
    gold: number;
    gems: number;
    materials: number;
    fragments: number;
    heroXP: number;          // ✅ NOUVEAU
    ascensionEssences: number; // ✅ NOUVEAU
  };
  // ✅ NOUVEAU : Infos sur les déblocages
  unlockInfo: {
    unlockedRewards: string[];
    nextUnlocks: Array<{
      type: string;
      requirement: string;
      worldsToGo: number;
      levelsToGo: number;
    }>;
    progressPercentage: number;
  };
}

export interface ClaimResultEnhanced {
  // Ancien format (compatibilité)
  claimed: number;
  totalGold: number;
  state: HydratedDocument<IAfkState>;
  
  // Nouveau format
  claimedRewards: IPendingReward[];
  goldClaimed: number;
  totalValue: number;
  playerUpdates: {
    gold: number;
    gems: number;
    tickets: number;
    heroXP: number;          // ✅ NOUVEAU
    ascensionEssences: number; // ✅ NOUVEAU
    materialsAdded: Record<string, number>;
    fragmentsAdded: Record<string, number>;
  };
}

type SourceType = "idle" | "offline";

const DEFAULTS = {
  HEARTBEAT_GRACE_SEC: 120,
  MAX_HEARTBEAT_DELTA_SEC: 300,
  // ✅ SUPPRIMÉ : ENHANCED_UNLOCK_WORLD (maintenant géré par afkRewardsConfig)
};

export class AfkServiceEnhanced {
  
  // ==================================================================================
  // === MÉTHODES EXISTANTES (CONSERVÉES POUR COMPATIBILITÉ) ===
  // ==================================================================================

  /**
   * ensureState() ORIGINAL - maintient la compatibilité
   */
  static async ensureState(playerId: string): Promise<HydratedDocument<IAfkState>> {
    const state = await AfkState.findOneAndUpdate(
      { playerId },
      { $setOnInsert: {} },
      { new: true, upsert: true }
    );
    return state as HydratedDocument<IAfkState>;
  }

  /**
   * tick() ORIGINAL - retourne juste l'or gagné
   */
  static async tick(
    playerId: string,
    now: Date = new Date()
  ): Promise<HydratedDocument<IAfkState>> {
    const state = await this.ensureState(playerId);
    state.tick(now);
    await state.save();
    return state;
  }

  /**
   * getSummary() ORIGINAL - format original pour compatibilité
   */
  static async getSummary(
    playerId: string,
    tickBefore = true
  ): Promise<AfkSummary> {
    await this.settleOfflineIfNeeded(playerId);

    const state = tickBefore
      ? await this.tick(playerId)
      : await this.ensureState(playerId);

    return {
      pendingGold: state.pendingGold,
      baseGoldPerMinute: state.baseGoldPerMinute,
      maxAccrualSeconds: state.maxAccrualSeconds,
      accumulatedSinceClaimSec: state.accumulatedSinceClaimSec,
      lastTickAt: state.lastTickAt,
      lastClaimAt: state.lastClaimAt,
      todayAccruedGold: state.todayAccruedGold,
    };
  }

  /**
   * claim() ORIGINAL - format original pour compatibilité
   */
  static async claim(playerId: string): Promise<{
    claimed: number;
    totalGold: number;
    state: HydratedDocument<IAfkState>;
  }> {
    let claimed = 0;
    let totalGold = 0;
    let updatedState: HydratedDocument<IAfkState>;

    const session: ClientSession = await mongoose.startSession();
    let usedTxn = false;
    try {
      await session.withTransaction(async () => {
        usedTxn = true;

        let state = await AfkState.findOne({ playerId }).session(session);
        if (!state) {
          state = await AfkState.findOneAndUpdate(
            { playerId },
            { $setOnInsert: {} },
            { new: true, upsert: true, session }
          );
        }
        state!.tick(new Date());
        await state!.save({ session });

        claimed = state!.claim();
        await state!.save({ session });

        const player = await Player.findOne({ playerId: playerId }).session(session);
        if (!player) throw new Error("Player not found");
        player.gold += claimed;
        await player.save({ session });

        totalGold = player.gold;
        updatedState = state as HydratedDocument<IAfkState>;
      });
    } catch (e) {
      usedTxn = false;
    } finally {
      session.endSession();
    }

    if (!usedTxn) {
      const state = await this.ensureState(playerId);
      state.tick(new Date());
      await state.save();

      claimed = state.claim();
      await state.save();

      const player = await Player.findOne({ playerId: playerId });
      if (!player) throw new Error("Player not found");
      player.gold += claimed;
      await player.save();

      totalGold = player.gold;
      updatedState = state;
    }

    return { claimed, totalGold, state: updatedState! };
  }

  // ==================================================================================
  // === NOUVELLES MÉTHODES (SYSTÈME ENHANCED) ===
  // ==================================================================================

  /**
   * ✅ MODIFIÉ : ensureStateEnhanced() - Utilise afkRewardsConfig pour l'éligibilité
   */
  static async ensureStateEnhanced(playerId: string): Promise<HydratedDocument<IAfkState>> {
    let state = await this.ensureState(playerId);
    
    // ✅ NOUVEAU : Vérifier éligibilité selon afkRewardsConfig au lieu de logique fixe
    if (!state.useEnhancedRewards && await this.canUseEnhancedSystemFromConfig(playerId)) {
      await state.enableEnhancedMode();
      await state.save();
      console.log(`🚀 Joueur ${playerId} migré vers le système AFK Enhanced (via afkRewardsConfig)`);
    }
    
    return state;
  }

  /**
   * ✅ MODIFIÉ : tickEnhanced() - Version avec multi-récompenses incluant Hero XP et Ascension Essences
   */
static async tickEnhanced(
  playerId: string,
  now: Date = new Date()
): Promise<{
  state: HydratedDocument<IAfkState>;
  goldGained: number;
  enhancedRewards: IPendingReward[];
  timeElapsed: number;
}> {
  await this.settleOfflineIfNeeded(playerId);
  const state = await this.ensureStateEnhanced(playerId);
  
  // ✅ CORRECTION : Faire le tick enhanced AVANT de générer nos propres récompenses
  const result = await state.tickEnhanced(now);
  
  // ✅ NOUVEAU : Générer Hero XP et Ascension Essences selon afkRewardsConfig
  // APRÈS le tick enhanced pour utiliser le bon timeElapsed
  const configRewards = await this.generateEnhancedRewardsFromConfig(playerId, result.timeElapsed);
  
  // Ajouter les nouvelles récompenses au state
  configRewards.forEach(reward => {
    state.addPendingReward(reward);
  });
  
  await state.save();
  
  // Récupérer l'or gagné traditionnel
  const goldGained = state.pendingGold;
  
  return {
    state,
    goldGained,
    enhancedRewards: [...result.rewards, ...configRewards],
    timeElapsed: result.timeElapsed
  };
}

/**
 * ✅ NOUVEAU : Générer Hero XP et Ascension Essences selon afkRewardsConfig (version corrigée)
 */
static async generateEnhancedRewardsFromConfig(playerId: string, timeElapsedSeconds: number): Promise<IPendingReward[]> {
  try {
    const player = await Player.findOne({ playerId: playerId }).select("world level vipLevel difficulty");
    if (!player) return [];

    const rewards: IPendingReward[] = [];
    const timeElapsedMinutes = timeElapsedSeconds / 60;

    console.log(`⏱️ Génération enhanced rewards pour ${timeElapsedMinutes.toFixed(2)} minutes`);

    // ✅ HERO XP selon afkRewardsConfig
    const heroXPCalc = calculateAfkRewardPerMinute("heroXP", player.world, player.level, player.vipLevel || 0, player.difficulty || "Normal");
    if (heroXPCalc.isUnlocked && heroXPCalc.finalRate > 0) {
      const heroXPGained = Math.floor(heroXPCalc.finalRate * timeElapsedMinutes);
      if (heroXPGained > 0) {
        rewards.push({
          type: "currency",
          currencyType: "heroXP",
          quantity: heroXPGained
        });
        console.log(`💪 Hero XP généré: ${heroXPGained} (${heroXPCalc.finalRate}/min × ${timeElapsedMinutes.toFixed(2)}min)`);
      }
    }

    // ✅ ASCENSION ESSENCES selon afkRewardsConfig
    const essencesCalc = calculateAfkRewardPerMinute("ascensionEssences", player.world, player.level, player.vipLevel || 0, player.difficulty || "Normal");
    if (essencesCalc.isUnlocked && essencesCalc.finalRate > 0) {
      const essencesGained = Math.floor(essencesCalc.finalRate * timeElapsedMinutes);
      if (essencesGained > 0) {
        rewards.push({
          type: "currency",
          currencyType: "ascensionEssences",
          quantity: essencesGained
        });
        console.log(`🌟 Ascension Essences générées: ${essencesGained} (${essencesCalc.finalRate}/min × ${timeElapsedMinutes.toFixed(2)}min)`);
      }
    }

    return rewards;

  } catch (error) {
    console.error("❌ Erreur generateEnhancedRewardsFromConfig:", error);
    return [];
  }
}
  /**
   * ✅ MODIFIÉ : getSummaryEnhanced() - Inclut Hero XP et Ascension Essences
   */
  static async getSummaryEnhanced(
    playerId: string,
    tickBefore = true
  ): Promise<AfkSummaryEnhanced> {
    await this.settleOfflineIfNeeded(playerId);

    const tickResult = tickBefore 
      ? await this.tickEnhanced(playerId)
      : { state: await this.ensureStateEnhanced(playerId), goldGained: 0, enhancedRewards: [], timeElapsed: 0 };
    
    const state = tickResult.state;
    
    // ✅ NOUVEAU : Utiliser afkRewardsConfig pour vérifier l'éligibilité
    const canUpgrade = !state.useEnhancedRewards && await this.canUseEnhancedSystemFromConfig(playerId);
    
    // ✅ NOUVEAU : Obtenir infos des déblocages depuis afkRewardsConfig
    const player = await Player.findOne({ playerId: playerId }).select("world level");
    const unlockInfo = player ? getAfkRewardsUnlockSummary(player.world, player.level) : {
      unlocked: [],
      upcoming: [],
      totalAvailable: 0
    };

    // ✅ NOUVEAU : Calculer taux Hero XP et Ascension Essences
    const heroXPRate = player ? this.getHeroXPRateFromConfig(player.world, player.level, player.vipLevel || 0, player.difficulty || "Normal") : 0;
    const ascensionEssencesRate = player ? this.getAscensionEssencesRateFromConfig(player.world, player.level, player.vipLevel || 0, player.difficulty || "Normal") : 0;

    return {
      // Format original (compatibilité)
      pendingGold: state.pendingGold,
      baseGoldPerMinute: state.baseGoldPerMinute,
      maxAccrualSeconds: state.maxAccrualSeconds,
      accumulatedSinceClaimSec: state.accumulatedSinceClaimSec,
      lastTickAt: state.lastTickAt,
      lastClaimAt: state.lastClaimAt,
      todayAccruedGold: state.todayAccruedGold,
      
      // Nouvelles données avec Hero XP et Ascension Essences
      pendingRewards: state.pendingRewards,
      totalValue: state.calculateTotalValue(),
      enhancedRatesPerMinute: {
        ...state.enhancedRatesPerMinute,
        heroXP: heroXPRate,
        ascensionEssences: ascensionEssencesRate
      },
      activeMultipliers: state.activeMultipliers,
      useEnhancedRewards: state.useEnhancedRewards,
      canUpgrade,
      todayClaimedRewards: {
        ...state.todayClaimedRewards,
        heroXP: state.todayClaimedRewards.heroXP || 0,
        ascensionEssences: state.todayClaimedRewards.ascensionEssences || 0
      },
      
      // ✅ NOUVEAU : Infos des déblocages
      unlockInfo: {
        unlockedRewards: unlockInfo.unlocked,
        nextUnlocks: unlockInfo.upcoming,
        progressPercentage: unlockInfo.totalAvailable > 0 ? 
          Math.round((unlockInfo.unlocked.length / unlockInfo.totalAvailable) * 100) : 0
      }
    };
  }

  /**
   * ✅ MODIFIÉ : claimEnhanced() - Applique Hero XP et Ascension Essences au joueur
   */
  static async claimEnhanced(playerId: string): Promise<ClaimResultEnhanced> {
    const session: ClientSession = await mongoose.startSession();
    
    try {
      const result = await session.withTransaction(async () => {
        // 1. Tick avant claim
        const state = await AfkState.findOne({ playerId }).session(session);
        if (!state) throw new Error("AFK state not found");
        
        await state.tickEnhanced(new Date());
        await state.save({ session });

        // 2. Claim enhanced
        const claimResult = await state.claimEnhanced();
        await state.save({ session });

        // 3. Obtenir le joueur
        const player = await Player.findOne({ playerId: playerId }).session(session);
        if (!player) throw new Error("Player not found");

        // 4. Appliquer les récompenses
        const playerUpdates = {
          gold: claimResult.goldClaimed,
          gems: 0,
          tickets: 0,
          heroXP: 0,          // ✅ NOUVEAU
          ascensionEssences: 0, // ✅ NOUVEAU
          materialsAdded: {} as Record<string, number>,
          fragmentsAdded: {} as Record<string, number>
        };

        // Appliquer l'or traditionnel
        player.gold += claimResult.goldClaimed;

        // Appliquer les nouvelles récompenses
        for (const reward of claimResult.claimedRewards) {
          switch (reward.type) {
            case "currency":
              switch (reward.currencyType) {
                case "gems":
                  player.gems += reward.quantity;
                  playerUpdates.gems += reward.quantity;
                  break;
                case "tickets":
                  player.tickets += reward.quantity;
                  playerUpdates.tickets += reward.quantity;
                  break;
                // ✅ NOUVEAU : Hero XP
                case "heroXP":
                  player.heroXP += reward.quantity;
                  playerUpdates.heroXP += reward.quantity;
                  console.log(`💪 Player ${player.displayName} gained ${reward.quantity} Hero XP from AFK`);
                  break;
                // ✅ NOUVEAU : Ascension Essences
                case "ascensionEssences":
                  player.ascensionEssences += reward.quantity;
                  playerUpdates.ascensionEssences += reward.quantity;
                  console.log(`🌟 Player ${player.displayName} gained ${reward.quantity} Ascension Essences from AFK`);
                  break;
              }
              break;

            case "material":
              if (reward.materialId) {
                const current = player.materials.get(reward.materialId) || 0;
                player.materials.set(reward.materialId, current + reward.quantity);
                playerUpdates.materialsAdded[reward.materialId] = reward.quantity;
              }
              break;

            case "fragment":
              if (reward.fragmentId) {
                const current = player.fragments.get(reward.fragmentId) || 0;
                player.fragments.set(reward.fragmentId, current + reward.quantity);
                playerUpdates.fragmentsAdded[reward.fragmentId] = reward.quantity;
              }
              break;

            case "item":
              // TODO: Intégrer avec InventoryService
              console.log(`📦 Objet AFK reçu: ${reward.itemId} x${reward.quantity}`);
              break;
          }
        }

        await player.save({ session });

        // 5. Format de retour compatible + enhanced
        return {
          // Format original (compatibilité)
          claimed: claimResult.goldClaimed,
          totalGold: player.gold,
          state: state as HydratedDocument<IAfkState>,
          
          // Format enhanced
          claimedRewards: claimResult.claimedRewards,
          goldClaimed: claimResult.goldClaimed,
          totalValue: claimResult.totalValue,
          playerUpdates
        };
      });

      // 🔥 NOUVEAU : Notifier via WebSocket avec Hero XP et Ascension Essences
      try {
        const offlineTime = result.totalValue > 1000 ? 
          Math.floor(Math.random() * 3600000) + 1800000 : 
          Math.floor(Math.random() * 1800000) + 600000;

        WebSocketService.notifyAfkOfflineRewardsClaimed(playerId, {
          offlineTime,
          totalRewards: {
            gold: result.goldClaimed,
            exp: result.playerUpdates.heroXP, // ✅ NOUVEAU : Utiliser Hero XP comme EXP
            gems: result.playerUpdates.gems,
            materials: result.playerUpdates.materialsAdded,
            fragments: result.playerUpdates.fragmentsAdded
          },
          bonusMultiplier: result.totalValue > 2000 ? 2.0 : 1.0,
          cappedAt: 12
        });

        // ✅ NOUVEAU : Notification spéciale pour Ascension Essences (rare)
        if (result.playerUpdates.ascensionEssences > 0) {
          WebSocketService.notifyAfkRareDrop(playerId, {
            itemName: "Ascension Essences",
            itemRarity: 'epic',
            location: "AFK Rewards",
            dropChance: 0.1,
            itemValue: result.playerUpdates.ascensionEssences * 100
          });
        }

      } catch (wsError) {
        console.error('❌ Erreur notification WebSocket AFK:', wsError);
      }

      return result;
    } finally {
      session.endSession();
    }
  }

  /**
   * ✅ MODIFIÉ : upgradeToEnhanced() - Utilise afkRewardsConfig pour l'éligibilité
   */
  static async upgradeToEnhanced(playerId: string): Promise<{
    success: boolean;
    message: string;
    newRates?: any;
    multipliers?: any;
  }> {
    try {
      // ✅ MODIFIÉ : Utiliser afkRewardsConfig au lieu de logique fixe
      if (!await this.canUseEnhancedSystemFromConfig(playerId)) {
        const player = await Player.findOne({ playerId: playerId }).select("world level");
        const requirement = DEBUG_UNLOCK_ALL_AT_WORLD_1 ? "World 1, Level 1" : "World 2, Level 15 (for Hero XP)";
        
        return {
          success: false,
          message: `Player not eligible for enhanced system yet. Requirement: ${requirement}. Current: World ${player?.world || 1}, Level ${player?.level || 1}`
        };
      }

      const state = await this.ensureState(playerId);
      
      if (state.useEnhancedRewards) {
        return {
          success: false,
          message: "Player already using enhanced system"
        };
      }

      await state.enableEnhancedMode();
      await state.save();

      // ✅ NOUVEAU : Calculer les nouveaux taux selon afkRewardsConfig
      const player = await Player.findOne({ playerId: playerId }).select("world level vipLevel difficulty");
      const newRates = player ? {
        heroXP: this.getHeroXPRateFromConfig(player.world, player.level, player.vipLevel || 0, player.difficulty || "Normal"),
        ascensionEssences: this.getAscensionEssencesRateFromConfig(player.world, player.level, player.vipLevel || 0, player.difficulty || "Normal")
      } : {};

      // 🔥 NOUVEAU : Notifier l'activation du bonus enhanced
      try {
        WebSocketService.notifyAfkBonusRewardsActivated(playerId, {
          bonusType: 'vip',
          multiplier: state.activeMultipliers.total,
          duration: -1, // Permanent
          source: 'Enhanced AFK System Upgrade'
        });
      } catch (wsError) {
        console.error('❌ Erreur notification WebSocket enhanced:', wsError);
      }

      return {
        success: true,
        message: "Successfully upgraded to enhanced AFK system",
        newRates: {
          ...state.enhancedRatesPerMinute,
          ...newRates
        },
        multipliers: state.activeMultipliers
      };

    } catch (error: any) {
      console.error("❌ Erreur upgradeToEnhanced:", error);
      return {
        success: false,
        message: "Failed to upgrade to enhanced system"
      };
    }
  }

  // ==================================================================================
  // === NOUVELLES MÉTHODES UTILITAIRES (AFKREWARDSCONFIG) ===
  // ==================================================================================

  /**
   * ✅ NOUVEAU : Vérifier éligibilité selon afkRewardsConfig
   */
  static async canUseEnhancedSystemFromConfig(playerId: string): Promise<boolean> {
    try {
      const player = await Player.findOne({ playerId: playerId }).select("world level");
      if (!player) return false;
      
      // ✅ NOUVEAU : Utiliser afkRewardsConfig pour déterminer l'éligibilité
      // Si Hero XP ou Ascension Essences sont débloqués, on peut utiliser enhanced
      const heroXPUnlocked = isAfkRewardUnlocked("heroXP", player.world, player.level);
      const ascensionEssencesUnlocked = isAfkRewardUnlocked("ascensionEssences", player.world, player.level);
      
      return heroXPUnlocked || ascensionEssencesUnlocked;
      
    } catch (error) {
      console.error("❌ Erreur canUseEnhancedSystemFromConfig:", error);
      return false;
    }
  }

  /**
   * ✅ NOUVEAU : Générer Hero XP et Ascension Essences selon afkRewardsConfig
   */
  static async generateEnhancedRewardsFromConfig(playerId: string, state: HydratedDocument<IAfkState>): Promise<IPendingReward[]> {
    try {
      const player = await Player.findOne({ playerId: playerId }).select("world level vipLevel difficulty");
      if (!player) return [];

      const rewards: IPendingReward[] = [];
      const timeElapsedMinutes = Math.max(0, state.accumulatedSinceClaimSec) / 60;

      // ✅ HERO XP selon afkRewardsConfig
      const heroXPCalc = calculateAfkRewardPerMinute("heroXP", player.world, player.level, player.vipLevel || 0, player.difficulty || "Normal");
      if (heroXPCalc.isUnlocked && heroXPCalc.finalRate > 0) {
        const heroXPGained = Math.floor(heroXPCalc.finalRate * timeElapsedMinutes);
        if (heroXPGained > 0) {
          rewards.push({
            type: "currency",
            currencyType: "heroXP",
            quantity: heroXPGained
          });
        }
      }

      // ✅ ASCENSION ESSENCES selon afkRewardsConfig
      const essencesCalc = calculateAfkRewardPerMinute("ascensionEssences", player.world, player.level, player.vipLevel || 0, player.difficulty || "Normal");
      if (essencesCalc.isUnlocked && essencesCalc.finalRate > 0) {
        const essencesGained = Math.floor(essencesCalc.finalRate * timeElapsedMinutes);
        if (essencesGained > 0) {
          rewards.push({
            type: "currency",
            currencyType: "ascensionEssences",
            quantity: essencesGained
          });
        }
      }

      return rewards;

    } catch (error) {
      console.error("❌ Erreur generateEnhancedRewardsFromConfig:", error);
      return [];
    }
  }

  /**
   * ✅ NOUVEAU : Obtenir taux Hero XP depuis afkRewardsConfig
   */
  static getHeroXPRateFromConfig(world: number, level: number, vipLevel: number, difficulty: string): number {
    const calc = calculateAfkRewardPerMinute("heroXP", world, level, vipLevel, difficulty as any);
    return calc.isUnlocked ? calc.finalRate : 0;
  }

  /**
   * ✅ NOUVEAU : Obtenir taux Ascension Essences depuis afkRewardsConfig
   */
  static getAscensionEssencesRateFromConfig(world: number, level: number, vipLevel: number, difficulty: string): number {
    const calc = calculateAfkRewardPerMinute("ascensionEssences", world, level, vipLevel, difficulty as any);
    return calc.isUnlocked ? calc.finalRate : 0;
  }

  // ==================================================================================
  // === MÉTHODES UTILITAIRES (CONSERVÉES) ===
  // ==================================================================================

  /**
   * Obtenir les statistiques d'utilisation du système enhanced
   */
  static async getEnhancedUsageStats(): Promise<{
    totalPlayers: number;
    enhancedUsers: number;
    eligibleForUpgrade: number;
    averageMultiplier: number;
    // ✅ NOUVEAU : Stats des nouveaux déblocages
    heroXPUsers: number;
    ascensionEssencesUsers: number;
  }> {
    try {
      const [totalStats, enhancedStats] = await Promise.all([
        AfkState.countDocuments({}),
        AfkState.aggregate([
          { $group: {
            _id: "$useEnhancedRewards",
            count: { $sum: 1 },
            avgMultiplier: { $avg: "$activeMultipliers.total" }
          }}
        ])
      ]);

      const enhancedUsers = enhancedStats.find(s => s._id === true)?.count || 0;
      const avgMultiplier = enhancedStats.find(s => s._id === true)?.avgMultiplier || 1.0;

      // ✅ NOUVEAU : Calculer éligibilité selon afkRewardsConfig
      const allPlayers = await Player.find({}).select("world level");
      let eligibleForUpgrade = 0;
      let heroXPUsers = 0;
      let ascensionEssencesUsers = 0;

      for (const player of allPlayers) {
        const heroXPUnlocked = isAfkRewardUnlocked("heroXP", player.world, player.level);
        const ascensionEssencesUnlocked = isAfkRewardUnlocked("ascensionEssences", player.world, player.level);
        
        if (heroXPUnlocked || ascensionEssencesUnlocked) {
          eligibleForUpgrade++;
        }
        
        if (heroXPUnlocked) heroXPUsers++;
        if (ascensionEssencesUnlocked) ascensionEssencesUsers++;
      }

      return {
        totalPlayers: totalStats,
        enhancedUsers,
        eligibleForUpgrade: Math.max(0, eligibleForUpgrade - enhancedUsers),
        averageMultiplier: Math.round(avgMultiplier * 100) / 100,
        heroXPUsers,
        ascensionEssencesUsers
      };

    } catch (error) {
      console.error("❌ Erreur getEnhancedUsageStats:", error);
      return {
        totalPlayers: 0,
        enhancedUsers: 0,
        eligibleForUpgrade: 0,
        averageMultiplier: 1.0,
        heroXPUsers: 0,
        ascensionEssencesUsers: 0
      };
    }
  }

  // === MÉTHODES EXISTANTES CONSERVÉES (Sessions, etc.) ===

  private static async settleOfflineIfNeeded(playerId: string): Promise<void> {
    const [player, state] = await Promise.all([
      Player.findOne({ playerId: playerId }).select("lastSeenAt createdAt"),
      AfkState.findOne({ playerId }),
    ]);

    if (!state) {
      await this.ensureState(playerId);
      return;
    }

    if (!state.lastTickAt) {
      const anchor =
        (player?.lastSeenAt as Date | undefined) ??
        ((player as any)?.createdAt as Date | undefined) ??
        new Date();

      state.lastTickAt = anchor;
      await state.save();
    }
  }

  static async startSession(
    playerId: string,
    opts?: { deviceId?: string; source?: SourceType }
  ): Promise<HydratedDocument<IAfkSession>> {
    const { deviceId = null, source = "idle" } = opts || {};
    const sessionDoc = await AfkSession.create({
      playerId,
      deviceId,
      source,
      status: "running",
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
    });

    await this.tick(playerId);
    return sessionDoc as HydratedDocument<IAfkSession>;
  }

  static async heartbeat(playerId: string): Promise<{
    state: HydratedDocument<IAfkState>;
    session: HydratedDocument<IAfkSession> | null;
  }> {
    const now = new Date();

    let activeSession: HydratedDocument<IAfkSession> | null =
      (await AfkSession.findOne({ playerId, status: "running" })
        .sort({ startedAt: -1 })) as HydratedDocument<IAfkSession> | null;

    if (!activeSession) {
      activeSession = await this.startSession(playerId, { source: "idle" });
    } else {
      const deltaSec = Math.floor(
        (now.getTime() - activeSession.lastHeartbeatAt.getTime()) / 1000
      );
      if (deltaSec > DEFAULTS.MAX_HEARTBEAT_DELTA_SEC) {
        activeSession.lastHeartbeatAt = new Date(
          activeSession.lastHeartbeatAt.getTime() +
            DEFAULTS.MAX_HEARTBEAT_DELTA_SEC * 1000
        );
      } else {
        activeSession.lastHeartbeatAt = now;
      }
      await activeSession.save();
    }

    const state = await this.tick(playerId, now);
    return { state, session: activeSession };
  }

  static async stopSession(
    playerId: string
  ): Promise<HydratedDocument<IAfkSession> | null> {
    const sess = (await AfkSession.findOne({
      playerId,
      status: "running",
    }).sort({ startedAt: -1 })) as HydratedDocument<IAfkSession> | null;

    if (!sess) return null;

    await this.tick(playerId);

    sess.status = "ended";
    sess.endedAt = new Date();
    await sess.save();
    return sess;
  }

  static async closeStaleSessions(
    coldAfterSec = DEFAULTS.HEARTBEAT_GRACE_SEC
  ): Promise<number> {
    const threshold = new Date(Date.now() - coldAfterSec * 1000);
    const res = await AfkSession.updateMany(
      { status: "running", lastHeartbeatAt: { $lt: threshold } },
      { $set: { status: "ended", endedAt: new Date() } }
    );
    // @ts-ignore
    return res.modifiedCount ?? 0;
  }

  /**
   * NOUVELLE MÉTHODE : Simuler événement de farming avec notifications WebSocket
   */
  static async simulateFarmingSession(
    playerId: string,
    duration: number = 3600000 // 1h par défaut
  ): Promise<{
    success: boolean;
    rewards: any;
    notifications: string[];
  }> {
    try {
      const notifications: string[] = [];

      // 1. Démarrer le farming
      const farmingLocation = "World 5-3 (Hard)";
      WebSocketService.notifyAfkFarmingStarted(playerId, {
        location: farmingLocation,
        expectedDuration: duration,
        estimatedRewards: { gold: 1500, exp: 750, materials: 25 },
        farmingType: 'progression'
      });
      notifications.push('Farming started notification sent');

      // 2. Simuler progression à 25%, 50%, 75%
      const progressIntervals = [25, 50, 75];
      for (const progress of progressIntervals) {
        setTimeout(() => {
          WebSocketService.notifyAfkFarmingProgress(playerId, {
            elapsed: duration * (progress / 100),
            totalDuration: duration,
            currentRewards: { 
              gold: Math.floor(1500 * progress / 100),
              exp: Math.floor(750 * progress / 100)
            },
            progressPercentage: progress,
            location: farmingLocation
          });
        }, duration * (progress / 100));
      }
      notifications.push('Progress notifications scheduled');

      // 3. Drop rare à 60% (si chanceux)
      if (Math.random() < 0.3) {
        setTimeout(() => {
          WebSocketService.notifyAfkRareDrop(playerId, {
            itemName: "Epic Fusion Crystal",
            itemRarity: 'epic',
            location: farmingLocation,
            dropChance: 0.05,
            itemValue: 500
          });
        }, duration * 0.6);
        notifications.push('Rare drop notification scheduled');
      }

      // 4. Farming terminé
      setTimeout(() => {
        WebSocketService.notifyAfkFarmingCompleted(playerId, {
          duration,
          location: farmingLocation,
          rewards: {
            gold: 1500 + Math.floor(Math.random() * 300),
            exp: 750 + Math.floor(Math.random() * 150),
            gems: Math.floor(Math.random() * 10),
            materials: { "fusion_crystal": 25, "elemental_essence": 8 }
          },
          items: Math.random() < 0.3 ? ["Epic Fusion Crystal"] : [],
          efficiency: 85 + Math.floor(Math.random() * 15)
        });
      }, duration);
      notifications.push('Completion notification scheduled');

      return {
        success: true,
        rewards: { estimated: true },
        notifications
      };

    } catch (error: any) {
      console.error('❌ Erreur simulateFarmingSession:', error);
      return {
        success: false,
        rewards: {},
        notifications: [`Error: ${error.message}`]
      };
    }
  }

  /**
   * NOUVELLE MÉTHODE : Vérifier si le joueur est bloqué et envoyer recommandations
   */
  static async checkAndNotifyProgressStuck(playerId: string): Promise<void> {
    try {
      const player = await Player.findOne({ playerId: playerId }).select("world level lastSeenAt");
      if (!player) return;

      const state = await this.ensureState(playerId);
      
      // Simuler détection de blocage (pas de progression depuis 24h)
      const lastProgress = player.lastSeenAt || new Date();
      const stuckTime = Date.now() - lastProgress.getTime();
      
      if (stuckTime > 24 * 3600 * 1000) { // 24h sans progression
        WebSocketService.notifyAfkProgressStuck(playerId, {
          currentStage: `${player.world}-${player.level}`,
          timeStuck: stuckTime,
          recommendations: [
            {
              type: 'upgrade',
              description: 'Upgrade your heroes to increase combat power',
              priority: 'high',
              cost: 5000
            },
            {
              type: 'formation',
              description: 'Optimize your formation for better synergy',
              priority: 'medium'
            },
            {
              type: 'ascension',
              description: 'Ascend heroes for permanent stat boosts',
              priority: 'high',
              cost: 50000
            }
          ],
          canAutoFix: state.useEnhancedRewards // Seulement si enhanced
        });

        console.log(`⚠️ Progress stuck notification sent to ${playerId} (stuck ${Math.floor(stuckTime / 3600000)}h)`);
      }

    } catch (error) {
      console.error('❌ Erreur checkAndNotifyProgressStuck:', error);
    }
  }
}

export default AfkServiceEnhanced;

import mongoose, { ClientSession, HydratedDocument } from "mongoose";
import AfkState, { IAfkState, IPendingReward } from "../models/AfkState";
import AfkSession, { IAfkSession } from "../models/AfkSession";
import Player from "../models/Player";

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
    materialsAdded: Record<string, number>;
    fragmentsAdded: Record<string, number>;
  };
}

type SourceType = "idle" | "offline";

const DEFAULTS = {
  HEARTBEAT_GRACE_SEC: 120,
  MAX_HEARTBEAT_DELTA_SEC: 300,
  ENHANCED_UNLOCK_WORLD: 3, // Débloque le système enhanced au monde 3
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
   * ensureStateEnhanced() - Version améliorée avec auto-upgrade
   */
  static async ensureStateEnhanced(playerId: string): Promise<HydratedDocument<IAfkState>> {
    let state = await this.ensureState(playerId);
    
    // Vérifier si le joueur peut être upgradé au système enhanced
    if (!state.useEnhancedRewards && await this.canUseEnhancedSystem(playerId)) {
      await state.enableEnhancedMode();
      await state.save();
      console.log(`🚀 Joueur ${playerId} migré vers le système AFK Enhanced`);
    }
    
    return state;
  }

  /**
   * tickEnhanced() - Version avec multi-récompenses
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
    
    // Faire le tick enhanced si activé
    const result = await state.tickEnhanced(now);
    await state.save();
    
    // Récupérer l'or gagné traditionnel
    const goldGained = state.pendingGold;
    
    return {
      state,
      goldGained,
      enhancedRewards: result.rewards,
      timeElapsed: result.timeElapsed
    };
  }

  /**
   * getSummaryEnhanced() - Résumé complet avec nouvelles fonctionnalités
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
    const canUpgrade = !state.useEnhancedRewards && await this.canUseEnhancedSystem(playerId);

    return {
      // Format original (compatibilité)
      pendingGold: state.pendingGold,
      baseGoldPerMinute: state.baseGoldPerMinute,
      maxAccrualSeconds: state.maxAccrualSeconds,
      accumulatedSinceClaimSec: state.accumulatedSinceClaimSec,
      lastTickAt: state.lastTickAt,
      lastClaimAt: state.lastClaimAt,
      todayAccruedGold: state.todayAccruedGold,
      
      // Nouvelles données
      pendingRewards: state.pendingRewards,
      totalValue: state.calculateTotalValue(),
      enhancedRatesPerMinute: state.enhancedRatesPerMinute,
      activeMultipliers: state.activeMultipliers,
      useEnhancedRewards: state.useEnhancedRewards,
      canUpgrade,
      todayClaimedRewards: state.todayClaimedRewards
    };
  }

  /**
   * claimEnhanced() - Récupère toutes les récompenses (or + nouvelles)
   */
  static async claimEnhanced(playerId: string): Promise<ClaimResultEnhanced> {
    const session: ClientSession = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
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
    } finally {
      session.endSession();
    }
  }

  /**
   * upgradeToEnhanced() - Migrer un joueur vers le système enhanced
   */
  static async upgradeToEnhanced(playerId: string): Promise<{
    success: boolean;
    message: string;
    newRates?: any;
    multipliers?: any;
  }> {
    try {
      if (!await this.canUseEnhancedSystem(playerId)) {
        return {
          success: false,
          message: "Player not eligible for enhanced system yet"
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

      return {
        success: true,
        message: "Successfully upgraded to enhanced AFK system",
        newRates: state.enhancedRatesPerMinute,
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
  // === MÉTHODES UTILITAIRES ===
  // ==================================================================================

  /**
   * Vérifier si un joueur peut utiliser le système enhanced
   */
  static async canUseEnhancedSystem(playerId: string): Promise<boolean> {
    try {
     const player = await Player.findOne({ playerId: playerId }).select("world level");
      if (!player) return false;
      
      // Conditions pour débloquer : monde 3+ OU niveau 50+
      return player.world >= DEFAULTS.ENHANCED_UNLOCK_WORLD || player.level >= 50;
      
    } catch (error) {
      console.error("❌ Erreur canUseEnhancedSystem:", error);
      return false;
    }
  }

  /**
   * Obtenir les statistiques d'utilisation du système enhanced
   */
  static async getEnhancedUsageStats(): Promise<{
    totalPlayers: number;
    enhancedUsers: number;
    eligibleForUpgrade: number;
    averageMultiplier: number;
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
      const regularUsers = enhancedStats.find(s => s._id === false)?.count || 0;
      const avgMultiplier = enhancedStats.find(s => s._id === true)?.avgMultiplier || 1.0;

      // Calculer combien sont éligibles pour l'upgrade
      const eligiblePlayers = await Player.countDocuments({
        $or: [
          { world: { $gte: DEFAULTS.ENHANCED_UNLOCK_WORLD } },
          { level: { $gte: 50 } }
        ]
      });

      const eligibleForUpgrade = Math.max(0, eligiblePlayers - enhancedUsers);

      return {
        totalPlayers: totalStats,
        enhancedUsers,
        eligibleForUpgrade,
        averageMultiplier: Math.round(avgMultiplier * 100) / 100
      };

    } catch (error) {
      console.error("❌ Erreur getEnhancedUsageStats:", error);
      return {
        totalPlayers: 0,
        enhancedUsers: 0,
        eligibleForUpgrade: 0,
        averageMultiplier: 1.0
      };
    }
  }

  // ==================================================================================
  // === MÉTHODES EXISTANTES CONSERVÉES (Sessions, etc.) ===
  // ==================================================================================

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
}

export default AfkServiceEnhanced;

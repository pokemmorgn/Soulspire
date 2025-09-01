import mongoose, { ClientSession, HydratedDocument } from "mongoose";
import AfkState, { IAfkState } from "../models/AfkState";
import AfkSession, { IAfkSession } from "../models/AfkSession";
import Player from "../models/Player";

/**
 * Service AFK - Proto (gold/min fixe, cap type AFK Arena)
 * - tick(): met à jour pendingGold en respectant le cap
 * - claim(): crédite player.gold et remet l’état AFK
 * - startSession/heartbeat/stopSession: traçage + anti-cheat léger
 */

export interface AfkSummary {
  pendingGold: number;
  baseGoldPerMinute: number;
  maxAccrualSeconds: number;
  accumulatedSinceClaimSec: number;
  lastTickAt: Date | null;
  lastClaimAt: Date | null;
  todayAccruedGold: number;
}

type SourceType = "idle" | "offline";

const DEFAULTS = {
  HEARTBEAT_GRACE_SEC: 120,   // si pas de heartbeat > 120s, session froide
  MAX_HEARTBEAT_DELTA_SEC: 300, // borne anti "time injection"
};

export class AfkService {
  /**
   * S’assure que l’état AFK existe pour le joueur.
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
   * tick(): calcule le gain depuis le dernier tick et persiste.
   * Retourne l’état AFK mis à jour.
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
   * Résumé pour l’UI (peut faire un tick léger).
   */
  static async getSummary(
    playerId: string,
    tickBefore = true
  ): Promise<AfkSummary> {
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
   * claim(): crédite l’or au joueur et remet l’état AFK à zéro.
   * Tente une transaction (replica set). Fallback non transactionnel si indisponible.
   */
  static async claim(playerId: string): Promise<{
    claimed: number;
    totalGold: number;
    state: HydratedDocument<IAfkState>;
  }> {
    let claimed = 0;
    let totalGold = 0;
    let updatedState: HydratedDocument<IAfkState>;

    // --- Tentative avec transaction ---
    const session: ClientSession = await mongoose.startSession();
    let usedTxn = false;
    try {
      await session.withTransaction(async () => {
        usedTxn = true;

        // 1) Tick avant claim
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

        // 2) Claim
        claimed = state!.claim();
        await state!.save({ session });

        // 3) Créditer le Player
        const player = await Player.findById(playerId).session(session);
        if (!player) throw new Error("Player not found");
        player.gold += claimed;
        await player.save({ session });

        totalGold = player.gold;
        updatedState = state as HydratedDocument<IAfkState>;
      });
    } catch (e) {
      // tombera dans le fallback
      usedTxn = false;
    } finally {
      session.endSession();
    }

    // --- Fallback non transactionnel ---
    if (!usedTxn) {
      const state = await this.ensureState(playerId);
      state.tick(new Date());
      await state.save();

      claimed = state.claim();
      await state.save();

      const player = await Player.findById(playerId);
      if (!player) throw new Error("Player not found");
      player.gold += claimed;
      await player.save();

      totalGold = player.gold;
      updatedState = state;
    }

    return { claimed, totalGold, state: updatedState! };
  }

  /**
   * Démarre une session AFK (trace analytics / anti-cheat léger).
   */
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

    // tick initial pour mettre pendingGold à jour
    await this.tick(playerId);

    return sessionDoc as HydratedDocument<IAfkSession>;
  }

  /**
   * Heartbeat: met à jour la session courante et tick l’AfkState.
   * Anti-cheat: borne le delta heartbeat.
   */
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
        // borne pour éviter l’injection d’un gros delta
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

  /**
   * stopSession: clôt la session AFK courante.
   */
  static async stopSession(
    playerId: string
  ): Promise<HydratedDocument<IAfkSession> | null> {
    const sess = (await AfkSession.findOne({
      playerId,
      status: "running",
    }).sort({ startedAt: -1 })) as HydratedDocument<IAfkSession> | null;

    if (!sess) return null;

    // Dernier tick à l’arrêt
    await this.tick(playerId);

    sess.status = "ended";
    sess.endedAt = new Date();
    await sess.save();
    return sess;
  }

  /**
   * Nettoyage périodique: ferme les sessions “orphelines”.
   * À appeler depuis un cron/worker (optionnel).
   */
  static async closeStaleSessions(
    coldAfterSec = DEFAULTS.HEARTBEAT_GRACE_SEC
  ): Promise<number> {
    const threshold = new Date(Date.now() - coldAfterSec * 1000);
    const res = await AfkSession.updateMany(
      { status: "running", lastHeartbeatAt: { $lt: threshold } },
      { $set: { status: "ended", endedAt: new Date() } }
    );
    // @ts-ignore: Mongoose types vary by version
    return res.modifiedCount ?? 0;
  }
}

export default AfkService;

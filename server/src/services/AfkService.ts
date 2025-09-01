import mongoose, { ClientSession } from "mongoose";
import AfkState, { IAfkState } from "../models/AfkState";
import AfkSession, { IAfkSession } from "../models/AfkSession";
import Player from "../models/Player";

/**
 * Service AFK - Version proto (gold/min fixe, cap type AFK Arena)
 * - tick(): met à jour pendingGold en respectant le cap
 * - claim(): crédite player.gold et remet le compteur AFK
 * - startSession/heartbeat/stopSession: traçage et anti-cheat léger
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
  HEARTBEAT_GRACE_SEC: 120, // si pas de heartbeat pendant > 120s, on considère la session “froide”
  MAX_HEARTBEAT_DELTA_SEC: 300, // ignore les heartbeats trop espacés (anti-fake time jump)
};

export class AfkService {
  /**
   * S’assure que l’état AFK existe pour le joueur.
   */
  static async ensureState(playerId: string): Promise<IAfkState> {
    const state = await AfkState.findOneAndUpdate(
      { playerId },
      { $setOnInsert: {} },
      { new: true, upsert: true }
    );
    return state!;
  }

  /**
   * tick(): calcule le gain depuis le dernier tick et persiste.
   * Retourne le nouveau pendingGold.
   */
  static async tick(playerId: string, now: Date = new Date()): Promise<IAfkState> {
    const state = await this.ensureState(playerId);
    state.tick(now);
    await state.save();
    return state;
  }

  /**
   * Résumé pour l’UI sans mutation (pratique à l’ouverture du jeu).
   * Peut faire un tick léger pour éviter un affichage “froid”.
   */
  static async getSummary(playerId: string, tickBefore = true): Promise<AfkSummary> {
    const state = tickBefore ? await this.tick(playerId) : await this.ensureState(playerId);
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
   * Utilise une transaction si possible (replica set requis).
   */
  static async claim(playerId: string): Promise<{ claimed: number; totalGold: number; state: IAfkState }> {
    const session = await mongoose.startSession();
    let claimed = 0;
    let totalGold = 0;
    let updatedState: IAfkState;

    try {
      await session.withTransaction(async () => {
        // 1) Tick avant claim pour récupérer tout ce qui est dû
        const state = await AfkState.findOne({ playerId }).session(session);
        if (!state) {
          // Si pas d’état, on le crée à la volée (claim = 0)
          updatedState = await AfkState.findOneAndUpdate(
            { playerId },
            { $setOnInsert: {} },
            { new: true, upsert: true, session }
          ) as IAfkState;
        } else {
          state.tick(new Date());
          await state.save({ session });
          updatedState = state;
        }

        // 2) Claim AFK
        claimed = updatedState.claim();
        await updatedState.save({ session });

        // 3) Créditer le Player
        const player = await Player.findById(playerId).session(session);
        if (!player) throw new Error("Player not found");
        player.gold += claimed;
        await player.save({ session });

        totalGold = player.gold;
      });
    } finally {
      session.endSession();
    }

    // Si la transaction n’est pas supportée, on ferait une version sans session.
    if (claimed === undefined) {
      // fallback (très rare) — version non transactionnelle
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
  ): Promise<IAfkSession> {
    const { deviceId = null, source = "idle" } = opts || {};
    const session = await AfkSession.create({
      playerId,
      deviceId,
      source,
      status: "running",
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
    });

    // tick initial pour mettre pendingGold à jour
    await this.tick(playerId);

    return session;
  }

  /**
   * Heartbeat: met à jour la session courante et tick l’AfkState.
   * Anti-cheat simple: si le delta est > MAX_HEARTBEAT_DELTA_SEC, on borne.
   */
  static async heartbeat(playerId: string): Promise<{ state: IAfkState; session: IAfkSession | null }> {
    const now = new Date();
    let activeSession = await AfkSession.findOne({ playerId, status: "running" }).sort({ startedAt: -1 });

    if (!activeSession) {
      // Si pas de session, on en recrée une (grâce de reconnexion)
      activeSession = await this.startSession(playerId, { source: "idle" });
    } else {
      const deltaSec = Math.floor((now.getTime() - activeSession.lastHeartbeatAt.getTime()) / 1000);
      // Limite l’intervalle accepté
      if (deltaSec > DEFAULTS.MAX_HEARTBEAT_DELTA_SEC) {
        // on ajuste juste le lastHeartbeatAt pour éviter une “time injection”
        activeSession.lastHeartbeatAt = new Date(activeSession.lastHeartbeatAt.getTime() + DEFAULTS.MAX_HEARTBEAT_DELTA_SEC * 1000);
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
  static async stopSession(playerId: string): Promise<IAfkSession | null> {
    const sess = await AfkSession.findOne({ playerId, status: "running" }).sort({ startedAt: -1 });
    if (!sess) return null;

    // Un dernier tick à l’arrêt
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
  static async closeStaleSessions(coldAfterSec = DEFAULTS.HEARTBEAT_GRACE_SEC): Promise<number> {
    const threshold = new Date(Date.now() - coldAfterSec * 1000);
    const res = await AfkSession.updateMany(
      { status: "running", lastHeartbeatAt: { $lt: threshold } },
      { $set: { status: "ended", endedAt: new Date() } }
    );
    return res.modifiedCount ?? 0;
  }
}

export default AfkService;

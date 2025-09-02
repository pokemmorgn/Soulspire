import { Router, type RequestHandler } from "express";
import AfkService from "../services/AfkService";

/**
 * Augmentation de type pour Express afin d'exposer req.user?.id
 */
declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string };
  }
}

// -----------------------------------------------------------------------------
// Notifier SSE in-memory AMÉLIORÉ
// -----------------------------------------------------------------------------
type AfkEvent =
  | {
      type: "summary";
      data: {
        pendingGold: number;
        baseGoldPerMinute: number;
        accumulatedSinceClaimSec: number;
        maxAccrualSeconds: number;
        lastTickAt: string | null;
        lastClaimAt: string | null;
        goldPerSecond: number; // NOUVEAU: pour calcul temps réel côté client
        timeUntilCap: number;  // NOUVEAU: temps restant avant cap (en sec)
      };
    }
  | { type: "claimed"; data: { claimed: number; totalGold: number } }
  | { type: "realtime_update"; data: { pendingGold: number; accumulatedSinceClaimSec: number } } // NOUVEAU
  | { type: "ping"; data: { t: number } };

class AfkNotifier {
  private static _instance: AfkNotifier;
  private clients = new Map<string, Set<import("express").Response>>();
  private realtimeIntervals = new Map<string, NodeJS.Timeout>();

  static instance() {
    if (!this._instance) this._instance = new AfkNotifier();
    return this._instance;
  }

  subscribe(playerId: string, res: import("express").Response) {
    if (!this.clients.has(playerId)) this.clients.set(playerId, new Set());
    this.clients.get(playerId)!.add(res);

    // NOUVEAU: Démarre l'update temps réel pour ce joueur
    this.startRealtimeUpdates(playerId);
  }

  unsubscribe(playerId: string, res: import("express").Response) {
    const set = this.clients.get(playerId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) {
      this.clients.delete(playerId);
      // NOUVEAU: Arrête l'update temps réel si plus de clients
      this.stopRealtimeUpdates(playerId);
    }
  }

  // NOUVEAU: Démarre les updates temps réel toutes les secondes
  private startRealtimeUpdates(playerId: string) {
    // Évite les doublons
    if (this.realtimeIntervals.has(playerId)) return;

    const interval = setInterval(async () => {
      try {
        const summary = await AfkService.getSummary(playerId, true); // tick à chaque fois
        
        // Calcule le gold en temps réel
        const goldPerSecond = summary.baseGoldPerMinute / 60;
        const timeUntilCap = Math.max(0, summary.maxAccrualSeconds - summary.accumulatedSinceClaimSec);
        
        this.notify(playerId, {
          type: "realtime_update",
          data: {
            pendingGold: summary.pendingGold,
            accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec
          }
        });
      } catch (error) {
        console.error(`Erreur realtime update pour ${playerId}:`, error);
      }
    }, 1000); // TOUTES LES SECONDES

    this.realtimeIntervals.set(playerId, interval);
  }

  // NOUVEAU: Arrête les updates temps réel
  private stopRealtimeUpdates(playerId: string) {
    const interval = this.realtimeIntervals.get(playerId);
    if (interval) {
      clearInterval(interval);
      this.realtimeIntervals.delete(playerId);
    }
  }

  notify(playerId: string, evt: AfkEvent) {
    const set = this.clients.get(playerId);
    if (!set || set.size === 0) return;
    const payload = `event: ${evt.type}\ndata: ${JSON.stringify(evt.data)}\n\n`;
    for (const res of set) {
      try {
        res.write(payload);
      } catch {
        // la connexion sera nettoyée au close
      }
    }
  }
}

const notifier = AfkNotifier.instance();
const router = Router();

/** Auth middleware */
const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.user?.id) return res.status(401).json({ ok: false, error: "Unauthenticated" });
  next();
};

// Anti-spam heartbeat (en mémoire)
const lastHeartbeatByPlayer = new Map<string, number>();

// -----------------------------------------------------------------------------
// Handlers AMÉLIORÉS
// -----------------------------------------------------------------------------
const getSummary: RequestHandler = async (req, res) => {
  const playerId = req.user!.id;
  const summary = await AfkService.getSummary(playerId, true);

  // NOUVEAU: Calcul des données temps réel
  const goldPerSecond = summary.baseGoldPerMinute / 60;
  const timeUntilCap = Math.max(0, summary.maxAccrualSeconds - summary.accumulatedSinceClaimSec);

  const responseData = {
    pendingGold: summary.pendingGold,
    baseGoldPerMinute: summary.baseGoldPerMinute,
    accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
    maxAccrualSeconds: summary.maxAccrualSeconds,
    lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
    lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
    goldPerSecond, // NOUVEAU
    timeUntilCap,  // NOUVEAU
  };

  notifier.notify(playerId, {
    type: "summary",
    data: responseData,
  });

  res.json({ ok: true, data: responseData });
};

const postStart: RequestHandler = async (req, res) => {
  const playerId = req.user!.id;
  const { deviceId, source } = (req.body || {}) as { deviceId?: string; source?: "idle" | "offline" };

  const session = await AfkService.startSession(playerId, { deviceId, source });
  const summary = await AfkService.getSummary(playerId, false);

  const goldPerSecond = summary.baseGoldPerMinute / 60;
  const timeUntilCap = Math.max(0, summary.maxAccrualSeconds - summary.accumulatedSinceClaimSec);

  const responseData = {
    pendingGold: summary.pendingGold,
    baseGoldPerMinute: summary.baseGoldPerMinute,
    accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
    maxAccrualSeconds: summary.maxAccrualSeconds,
    lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
    lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
    goldPerSecond,
    timeUntilCap,
  };

  notifier.notify(playerId, {
    type: "summary",
    data: responseData,
  });

  res.json({ ok: true, sessionId: session.id, data: responseData });
};

// NOUVEAU: Heartbeat plus fréquent et léger
const postHeartbeat: RequestHandler = async (req, res) => {
  const playerId = req.user!.id;

  // Anti-spam réduit: min 500ms entre heartbeats (au lieu de 2s)
  const now = Date.now();
  const last = lastHeartbeatByPlayer.get(playerId) || 0;
  if (now - last < 500) {
    return res.status(429).json({ ok: false, error: "Too many heartbeats" });
  }
  lastHeartbeatByPlayer.set(playerId, now);

  const { state } = await AfkService.heartbeat(playerId);

  const goldPerSecond = state.baseGoldPerMinute / 60;
  const timeUntilCap = Math.max(0, state.maxAccrualSeconds - state.accumulatedSinceClaimSec);

  const responseData = {
    pendingGold: state.pendingGold,
    baseGoldPerMinute: state.baseGoldPerMinute,
    accumulatedSinceClaimSec: state.accumulatedSinceClaimSec,
    maxAccrualSeconds: state.maxAccrualSeconds,
    lastTickAt: state.lastTickAt ? new Date(state.lastTickAt).toISOString() : null,
    lastClaimAt: state.lastClaimAt ? new Date(state.lastClaimAt).toISOString() : null,
    goldPerSecond,
    timeUntilCap,
  };

  notifier.notify(playerId, {
    type: "summary",
    data: responseData,
  });

  res.json({
    ok: true,
    data: {
      pendingGold: state.pendingGold,
      accumulatedSinceClaimSec: state.accumulatedSinceClaimSec,
      maxAccrualSeconds: state.maxAccrualSeconds,
      goldPerSecond, // NOUVEAU
      timeUntilCap,  // NOUVEAU
    },
  });
};

const postStop: RequestHandler = async (req, res) => {
  const playerId = req.user!.id;
  const session = await AfkService.stopSession(playerId);

  const summary = await AfkService.getSummary(playerId, false);
  const goldPerSecond = summary.baseGoldPerMinute / 60;
  const timeUntilCap = Math.max(0, summary.maxAccrualSeconds - summary.accumulatedSinceClaimSec);

  const responseData = {
    pendingGold: summary.pendingGold,
    baseGoldPerMinute: summary.baseGoldPerMinute,
    accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
    maxAccrualSeconds: summary.maxAccrualSeconds,
    lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
    lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
    goldPerSecond,
    timeUntilCap,
  };

  notifier.notify(playerId, {
    type: "summary",
    data: responseData,
  });

  res.json({ ok: true, ended: !!session, data: responseData });
};

const postClaim: RequestHandler = async (req, res) => {
  const playerId = req.user!.id;
  const result = await AfkService.claim(playerId);

  notifier.notify(playerId, { type: "claimed", data: { claimed: result.claimed, totalGold: result.totalGold } });

  const summary = await AfkService.getSummary(playerId, false);
  const goldPerSecond = summary.baseGoldPerMinute / 60;
  const timeUntilCap = Math.max(0, summary.maxAccrualSeconds - summary.accumulatedSinceClaimSec);

  const responseData = {
    pendingGold: summary.pendingGold,
    baseGoldPerMinute: summary.baseGoldPerMinute,
    accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
    maxAccrualSeconds: summary.maxAccrualSeconds,
    lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
    lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
    goldPerSecond,
    timeUntilCap,
  };

  notifier.notify(playerId, {
    type: "summary",
    data: responseData,
  });

  res.json({
    ok: true,
    claimed: result.claimed,
    totalGold: result.totalGold,
    pendingGold: summary.pendingGold,
  });
};

// AMÉLIORÉ: Stream avec updates temps réel
const getStream: RequestHandler = async (req, res) => {
  const playerId = req.user!.id;

  // Headers SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // @ts-ignore - certaines implémentations ajoutent flushHeaders
  res.flushHeaders?.();

  notifier.subscribe(playerId, res);

  // Summary initial AMÉLIORÉ
  const summary = await AfkService.getSummary(playerId, true);
  const goldPerSecond = summary.baseGoldPerMinute / 60;
  const timeUntilCap = Math.max(0, summary.maxAccrualSeconds - summary.accumulatedSinceClaimSec);

  res.write(
    `event: summary\ndata: ${JSON.stringify({
      pendingGold: summary.pendingGold,
      baseGoldPerMinute: summary.baseGoldPerMinute,
      accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
      maxAccrualSeconds: summary.maxAccrualSeconds,
      lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
      lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
      goldPerSecond, // NOUVEAU
      timeUntilCap,  // NOUVEAU
    })}\n\n`
  );

  // Keepalive ping (moins fréquent car on a les updates temps réel)
  const ping = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
  }, 30000); // 30s au lieu de 20s

  const cleanup = () => {
    clearInterval(ping);
    notifier.unsubscribe(playerId, res);
  };
  req.on("close", cleanup);
  // @ts-ignore
  res.on?.("close", cleanup);
};

// -----------------------------------------------------------------------------
// Montage des routes
// -----------------------------------------------------------------------------
router.get("/summary", requireAuth, getSummary);
router.post("/start", requireAuth, postStart);
router.post("/heartbeat", requireAuth, postHeartbeat);
router.post("/stop", requireAuth, postStop);
router.post("/claim", requireAuth, postClaim);
router.get("/stream", requireAuth, getStream);

export default router;

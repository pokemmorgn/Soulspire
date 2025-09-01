import { Router, type RequestHandler } from "express";
import AfkService from "../services/AfkService";

/**
 * Augmentation de type pour Express afin d'exposer req.user?.id
 * (si ton authMiddleware fait bien req.user = { id: string })
 */
declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string };
  }
}

// -----------------------------------------------------------------------------
// Notifier SSE in-memory
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
      };
    }
  | { type: "claimed"; data: { claimed: number; totalGold: number } }
  | { type: "ping"; data: { t: number } };

class AfkNotifier {
  private static _instance: AfkNotifier;
  private clients = new Map<string, Set<import("express").Response>>();

  static instance() {
    if (!this._instance) this._instance = new AfkNotifier();
    return this._instance;
  }

  subscribe(playerId: string, res: import("express").Response) {
    if (!this.clients.has(playerId)) this.clients.set(playerId, new Set());
    this.clients.get(playerId)!.add(res);
  }

  unsubscribe(playerId: string, res: import("express").Response) {
    const set = this.clients.get(playerId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) this.clients.delete(playerId);
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

/** Si jamais ton auth global n'est pas monté avant /afk, tu peux utiliser ceci localement */
const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.user?.id) return res.status(401).json({ ok: false, error: "Unauthenticated" });
  next();
};

// Anti-spam heartbeat (en mémoire)
const lastHeartbeatByPlayer = new Map<string, number>();

// -----------------------------------------------------------------------------
// Handlers (typés en RequestHandler pour éviter l'overload subApplication)
// -----------------------------------------------------------------------------
const getSummary: RequestHandler = async (req, res) => {
  const playerId = req.user!.id;
  const summary = await AfkService.getSummary(playerId, true);

  notifier.notify(playerId, {
    type: "summary",
    data: {
      pendingGold: summary.pendingGold,
      baseGoldPerMinute: summary.baseGoldPerMinute,
      accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
      maxAccrualSeconds: summary.maxAccrualSeconds,
      lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
      lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
    },
  });

  res.json({ ok: true, data: summary });
};

const postStart: RequestHandler = async (req, res) => {
  const playerId = req.user!.id;
  const { deviceId, source } = (req.body || {}) as { deviceId?: string; source?: "idle" | "offline" };

  const session = await AfkService.startSession(playerId, { deviceId, source });
  const summary = await AfkService.getSummary(playerId, false);

  notifier.notify(playerId, {
    type: "summary",
    data: {
      pendingGold: summary.pendingGold,
      baseGoldPerMinute: summary.baseGoldPerMinute,
      accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
      maxAccrualSeconds: summary.maxAccrualSeconds,
      lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
      lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
    },
  });

  res.json({ ok: true, sessionId: session.id, data: summary });
};

const postHeartbeat: RequestHandler = async (req, res) => {
  const playerId = req.user!.id;

  // Anti-spam simple: min 2s entre heartbeats
  const now = Date.now();
  const last = lastHeartbeatByPlayer.get(playerId) || 0;
  if (now - last < 2000) {
    return res.status(429).json({ ok: false, error: "Too many heartbeats" });
  }
  lastHeartbeatByPlayer.set(playerId, now);

  const { state } = await AfkService.heartbeat(playerId);

  notifier.notify(playerId, {
    type: "summary",
    data: {
      pendingGold: state.pendingGold,
      baseGoldPerMinute: state.baseGoldPerMinute,
      accumulatedSinceClaimSec: state.accumulatedSinceClaimSec,
      maxAccrualSeconds: state.maxAccrualSeconds,
      lastTickAt: state.lastTickAt ? new Date(state.lastTickAt).toISOString() : null,
      lastClaimAt: state.lastClaimAt ? new Date(state.lastClaimAt).toISOString() : null,
    },
  });

  res.json({
    ok: true,
    data: {
      pendingGold: state.pendingGold,
      accumulatedSinceClaimSec: state.accumulatedSinceClaimSec,
      maxAccrualSeconds: state.maxAccrualSeconds,
    },
  });
};

const postStop: RequestHandler = async (req, res) => {
  const playerId = req.user!.id;
  const session = await AfkService.stopSession(playerId);

  const summary = await AfkService.getSummary(playerId, false);
  notifier.notify(playerId, {
    type: "summary",
    data: {
      pendingGold: summary.pendingGold,
      baseGoldPerMinute: summary.baseGoldPerMinute,
      accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
      maxAccrualSeconds: summary.maxAccrualSeconds,
      lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
      lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
    },
  });

  res.json({ ok: true, ended: !!session, data: summary });
};

const postClaim: RequestHandler = async (req, res) => {
  const playerId = req.user!.id;
  const result = await AfkService.claim(playerId);

  notifier.notify(playerId, { type: "claimed", data: { claimed: result.claimed, totalGold: result.totalGold } });

  const summary = await AfkService.getSummary(playerId, false);
  notifier.notify(playerId, {
    type: "summary",
    data: {
      pendingGold: summary.pendingGold,
      baseGoldPerMinute: summary.baseGoldPerMinute,
      accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
      maxAccrualSeconds: summary.maxAccrualSeconds,
      lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
      lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
    },
  });

  res.json({
    ok: true,
    claimed: result.claimed,
    totalGold: result.totalGold,
    pendingGold: summary.pendingGold,
  });
};

const getStream: RequestHandler = async (req, res) => {
  const playerId = req.user!.id;

  // Headers SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // flush (si dispo)
  // @ts-ignore - certaines implémentations ajoutent flushHeaders
  res.flushHeaders?.();

  notifier.subscribe(playerId, res);

  // Summary initial
  const summary = await AfkService.getSummary(playerId, true);
  res.write(
    `event: summary\ndata: ${JSON.stringify({
      pendingGold: summary.pendingGold,
      baseGoldPerMinute: summary.baseGoldPerMinute,
      accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
      maxAccrualSeconds: summary.maxAccrualSeconds,
      lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
      lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
    })}\n\n`
  );

  // Keepalive ping
  const ping = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
  }, 20000);

  const cleanup = () => {
    clearInterval(ping);
    notifier.unsubscribe(playerId, res);
  };
  req.on("close", cleanup);
  // @ts-ignore
  res.on?.("close", cleanup);
};

// -----------------------------------------------------------------------------
// Montage des routes (protégées par requireAuth)
// -----------------------------------------------------------------------------
router.get("/summary", requireAuth, getSummary);
router.post("/start", requireAuth, postStart);
router.post("/heartbeat", requireAuth, postHeartbeat);
router.post("/stop", requireAuth, postStop);
router.post("/claim", requireAuth, postClaim);
router.get("/stream", requireAuth, getStream);

export default router;

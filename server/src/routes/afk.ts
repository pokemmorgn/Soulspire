import { Router, Request, Response } from "express";
import AfkService from "../services/AfkService";

// -----------------------------------------------------------------------------
// Typage simple pour l'auth — on suppose que ton middleware met req.user.id
// -----------------------------------------------------------------------------
type AuthedRequest = Request & { user: { id: string } };

// -----------------------------------------------------------------------------
// Notifier SSE très léger (in-memory)
// -----------------------------------------------------------------------------
type AfkEvent =
  | { type: "summary"; data: { pendingGold: number; baseGoldPerMinute: number; accumulatedSinceClaimSec: number; maxAccrualSeconds: number; lastTickAt: string | null; lastClaimAt: string | null } }
  | { type: "claimed"; data: { claimed: number; totalGold: number } }
  | { type: "ping"; data: { t: number } };

class AfkNotifier {
  private static _instance: AfkNotifier;
  // Map playerId -> Set of Response (SSE clients)
  private clients = new Map<string, Set<Response>>();

  static instance() {
    if (!this._instance) this._instance = new AfkNotifier();
    return this._instance;
  }

  subscribe(playerId: string, res: Response) {
    if (!this.clients.has(playerId)) this.clients.set(playerId, new Set());
    this.clients.get(playerId)!.add(res);
  }

  unsubscribe(playerId: string, res: Response) {
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
        // si la connexion est morte, on la retirera lors du close 'finish'
      }
    }
  }
}

const notifier = AfkNotifier.instance();

// -----------------------------------------------------------------------------
// Router
// -----------------------------------------------------------------------------
const router = Router();

/**
 * GET /afk/summary
 * → retourne l’état AFK (avec un tick léger)
 */
router.get("/summary", async (req: AuthedRequest, res: Response) => {
  const playerId = req.user.id;
  const summary = await AfkService.getSummary(playerId, true);

  // Push aussi sur SSE si abonné
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
});

/**
 * POST /afk/start
 * body: { deviceId?: string, source?: "idle" | "offline" }
 */
router.post("/start", async (req: AuthedRequest, res: Response) => {
  const playerId = req.user.id;
  const { deviceId, source } = req.body || {};
  const session = await AfkService.startSession(playerId, { deviceId, source });

  // tick initial déjà fait côté service, on refile un summary frais
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
});

/**
 * POST /afk/heartbeat
 * → met à jour la session et tick l’état AFK
 */
let lastHeartbeatByPlayer = new Map<string, number>(); // anti-spam (ms)
router.post("/heartbeat", async (req: AuthedRequest, res: Response) => {
  const playerId = req.user.id;

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
});

/**
 * POST /afk/stop
 */
router.post("/stop", async (req: AuthedRequest, res: Response) => {
  const playerId = req.user.id;
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
});

/**
 * POST /afk/claim
 * → crédite l’or, remet à zéro l’AFK et renvoie les nouvelles valeurs
 */
router.post("/claim", async (req: AuthedRequest, res: Response) => {
  const playerId = req.user.id;
  const result = await AfkService.claim(playerId);

  // Notifier le client : event "claimed" + summary à jour
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
});

/**
 * GET /afk/stream
 * → Server-Sent Events pour recevoir en direct les notifs AFK
 *   events possibles: "summary", "claimed", "ping"
 *
 * Client exemple:
 *   const es = new EventSource('/afk/stream');
 *   es.addEventListener('summary', e => console.log(JSON.parse(e.data)));
 *   es.addEventListener('claimed', e => console.log(JSON.parse(e.data)));
 */
router.get("/stream", async (req: AuthedRequest, res: Response) => {
  const playerId = req.user.id;

  // Headers SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  // Flush initial (certains proxies)
  res.flushHeaders?.();

  // Abonnement
  notifier.subscribe(playerId, res);

  // Envoi d’un summary initial
  const summary = await AfkService.getSummary(playerId, true);
  res.write(`event: summary\ndata: ${JSON.stringify({
    pendingGold: summary.pendingGold,
    baseGoldPerMinute: summary.baseGoldPerMinute,
    accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
    maxAccrualSeconds: summary.maxAccrualSeconds,
    lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
    lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
  })}\n\n`);

  // Keepalive ping toutes les 20s
  const ping = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
  }, 20000);

  // Unsubscribe on close
  const cleanup = () => {
    clearInterval(ping);
    notifier.unsubscribe(playerId, res);
  };
  req.on("close", cleanup);
  res.on?.("close", cleanup);
});

export default router;

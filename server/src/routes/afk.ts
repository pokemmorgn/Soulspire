import { Router, type RequestHandler } from "express";
import AfkServiceEnhanced from "../services/AfkService";
import authMiddleware from "../middleware/authMiddleware";
/**
 * Routes AFK Enhanced - MÊMES NOMS DE ROUTES
 * Compatibilité totale + nouvelles fonctionnalités en arrière-plan
 */

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string };
  }
}

// === NOTIFIER SSE AMÉLIORÉ ===
type AfkEvent =
  | {
      type: "summary";
      data: {
        // Format original (compatibilité)
        pendingGold: number;
        baseGoldPerMinute: number;
        accumulatedSinceClaimSec: number;
        maxAccrualSeconds: number;
        lastTickAt: string | null;
        lastClaimAt: string | null;
        goldPerSecond: number;
        timeUntilCap: number;
        
        // Nouvelles données (enhanced)
        pendingRewards?: any[];
        totalValue?: number;
        enhancedRatesPerMinute?: any;
        activeMultipliers?: any;
        useEnhancedRewards?: boolean;
        canUpgrade?: boolean;
        todayClaimedRewards?: any;
      };
    }
  | { 
      type: "claimed"; 
      data: { 
        // Format original
        claimed: number; 
        totalGold: number;
        
        // Format enhanced
        claimedRewards?: any[];
        goldClaimed?: number;
        totalValue?: number;
        playerUpdates?: any;
      } 
    }
  | { type: "realtime_update"; data: { pendingGold: number; accumulatedSinceClaimSec: number; totalValue?: number } }
  | { type: "upgrade_available"; data: { canUpgrade: boolean; benefits: any } }
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
    this.startRealtimeUpdates(playerId);
  }

  unsubscribe(playerId: string, res: import("express").Response) {
    const set = this.clients.get(playerId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) {
      this.clients.delete(playerId);
      this.stopRealtimeUpdates(playerId);
    }
  }

  private startRealtimeUpdates(playerId: string) {
    if (this.realtimeIntervals.has(playerId)) return;

    const interval = setInterval(async () => {
      try {
        const summary = await AfkServiceEnhanced.getSummaryEnhanced(playerId, true);
        
        this.notify(playerId, {
          type: "realtime_update",
          data: {
            pendingGold: summary.pendingGold,
            accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
            totalValue: summary.totalValue
          }
        });

        // Notifier si upgrade disponible
        if (summary.canUpgrade) {
          this.notify(playerId, {
            type: "upgrade_available",
            data: { 
              canUpgrade: true, 
              benefits: summary.enhancedRatesPerMinute 
            }
          });
        }
      } catch (error) {
        console.error(`Erreur realtime update pour ${playerId}:`, error);
      }
    }, 1000);

    this.realtimeIntervals.set(playerId, interval);
  }

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

// Anti-spam heartbeat
const lastHeartbeatByPlayer = new Map<string, number>();

// === ROUTES EXISTANTES (NOMS IDENTIQUES, FONCTIONNALITÉS AMÉLIORÉES) ===

/**
 * GET /summary - Version Enhanced compatible
 * Retourne format original + données enhanced si disponibles
 */
const getSummary: RequestHandler = async (req, res) => {
const playerId = req.playerId!;
  
  try {
    const summary = await AfkServiceEnhanced.getSummaryEnhanced(playerId, true);

    const goldPerSecond = summary.baseGoldPerMinute / 60;
    const timeUntilCap = Math.max(0, summary.maxAccrualSeconds - summary.accumulatedSinceClaimSec);

    const responseData = {
      // Format original (compatibilité garantie)
      pendingGold: summary.pendingGold,
      baseGoldPerMinute: summary.baseGoldPerMinute,
      accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
      maxAccrualSeconds: summary.maxAccrualSeconds,
      lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
      lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
      goldPerSecond,
      timeUntilCap,
      
      // Nouvelles données (enhanced) - ajoutées sans casser la compatibilité
      ...(summary.useEnhancedRewards && {
        pendingRewards: summary.pendingRewards,
        totalValue: summary.totalValue,
        enhancedRatesPerMinute: summary.enhancedRatesPerMinute,
        activeMultipliers: summary.activeMultipliers,
        todayClaimedRewards: summary.todayClaimedRewards
      }),
      
      // Métadonnées système
      useEnhancedRewards: summary.useEnhancedRewards,
      canUpgrade: summary.canUpgrade
    };

    notifier.notify(playerId, {
      type: "summary",
      data: responseData,
    });

    res.json({ ok: true, data: responseData });

  } catch (error: any) {
    console.error("❌ Erreur getSummary:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

/**
 * POST /start - Compatible enhanced
 */
const postStart: RequestHandler = async (req, res) => {
  const playerId = req.playerId!;
  const { deviceId, source } = (req.body || {}) as { deviceId?: string; source?: "idle" | "offline" };

  try {
    const session = await AfkServiceEnhanced.startSession(playerId, { deviceId, source });
    const summary = await AfkServiceEnhanced.getSummaryEnhanced(playerId, false);

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
      
      // Enhanced data
      ...(summary.useEnhancedRewards && {
        pendingRewards: summary.pendingRewards,
        totalValue: summary.totalValue,
        enhancedRatesPerMinute: summary.enhancedRatesPerMinute,
        activeMultipliers: summary.activeMultipliers
      }),
      
      useEnhancedRewards: summary.useEnhancedRewards,
      canUpgrade: summary.canUpgrade
    };

    notifier.notify(playerId, {
      type: "summary",
      data: responseData,
    });

    res.json({ ok: true, sessionId: session.id, data: responseData });

  } catch (error: any) {
    console.error("❌ Erreur postStart:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

/**
 * POST /heartbeat - Compatible enhanced
 */
const postHeartbeat: RequestHandler = async (req, res) => {
  const playerId = req.playerId!;

  // Anti-spam
  const now = Date.now();
  const last = lastHeartbeatByPlayer.get(playerId) || 0;
  if (now - last < 500) {
    return res.status(429).json({ ok: false, error: "Too many heartbeats" });
  }
  lastHeartbeatByPlayer.set(playerId, now);

  try {
    const { state } = await AfkServiceEnhanced.heartbeat(playerId);
    const summary = await AfkServiceEnhanced.getSummaryEnhanced(playerId, false);

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
      
      // Enhanced data si disponible
      ...(summary.useEnhancedRewards && {
        totalValue: summary.totalValue,
        activeMultipliers: summary.activeMultipliers
      })
    };

    notifier.notify(playerId, {
      type: "summary",
      data: responseData,
    });

    res.json({
      ok: true,
      data: {
        pendingGold: summary.pendingGold,
        accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
        maxAccrualSeconds: summary.maxAccrualSeconds,
        goldPerSecond,
        timeUntilCap,
        
        // Enhanced si disponible
        ...(summary.useEnhancedRewards && {
          totalValue: summary.totalValue
        })
      },
    });

  } catch (error: any) {
    console.error("❌ Erreur postHeartbeat:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

/**
 * POST /stop - Compatible enhanced
 */
const postStop: RequestHandler = async (req, res) => {
  const playerId = req.playerId!;

  try {
    const session = await AfkServiceEnhanced.stopSession(playerId);
    const summary = await AfkServiceEnhanced.getSummaryEnhanced(playerId, false);

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
      
      // Enhanced data
      ...(summary.useEnhancedRewards && {
        pendingRewards: summary.pendingRewards,
        totalValue: summary.totalValue
      }),
      
      useEnhancedRewards: summary.useEnhancedRewards
    };

    notifier.notify(playerId, {
      type: "summary",
      data: responseData,
    });

    res.json({ ok: true, ended: !!session, data: responseData });

  } catch (error: any) {
    console.error("❌ Erreur postStop:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

/**
 * POST /claim - Version Enhanced (format de retour rétrocompatible)
 */
const postClaim: RequestHandler = async (req, res) => {
  const playerId = req.playerId!;

  try {
    const result = await AfkServiceEnhanced.claimEnhanced(playerId);

    // Notifier avec format enhanced
    notifier.notify(playerId, { 
      type: "claimed", 
      data: { 
        // Format original (compatibilité)
        claimed: result.claimed, 
        totalGold: result.totalGold,
        
        // Format enhanced
        claimedRewards: result.claimedRewards,
        goldClaimed: result.goldClaimed,
        totalValue: result.totalValue,
        playerUpdates: result.playerUpdates
      } 
    });

    const summary = await AfkServiceEnhanced.getSummaryEnhanced(playerId, false);

    const responseData = {
      pendingGold: summary.pendingGold,
      baseGoldPerMinute: summary.baseGoldPerMinute,
      accumulatedSinceClaimSec: summary.accumulatedSinceClaimSec,
      maxAccrualSeconds: summary.maxAccrualSeconds,
      lastTickAt: summary.lastTickAt ? new Date(summary.lastTickAt).toISOString() : null,
      lastClaimAt: summary.lastClaimAt ? new Date(summary.lastClaimAt).toISOString() : null,
      goldPerSecond: summary.baseGoldPerMinute / 60,
      timeUntilCap: Math.max(0, summary.maxAccrualSeconds - summary.accumulatedSinceClaimSec),
      
      // Enhanced data
      ...(summary.useEnhancedRewards && {
        todayClaimedRewards: summary.todayClaimedRewards
      })
    };

    notifier.notify(playerId, {
      type: "summary",
      data: responseData,
    });

    res.json({
      ok: true,
      // Format original (compatibilité)
      claimed: result.claimed,
      totalGold: result.totalGold,
      pendingGold: summary.pendingGold,
      
      // Nouvelles données enhanced
      ...(result.claimedRewards.length > 0 && {
        claimedRewards: result.claimedRewards,
        totalValue: result.totalValue,
        playerUpdates: result.playerUpdates
      })
    });

  } catch (error: any) {
    console.error("❌ Erreur postClaim:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

/**
 * GET /stream - SSE Enhanced
 */
const getStream: RequestHandler = async (req, res) => {
  const playerId = req.playerId!;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // @ts-ignore
  res.flushHeaders?.();

  notifier.subscribe(playerId, res);

  try {
    const summary = await AfkServiceEnhanced.getSummaryEnhanced(playerId, true);
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
        goldPerSecond,
        timeUntilCap,
        
        // Enhanced data
        ...(summary.useEnhancedRewards && {
          pendingRewards: summary.pendingRewards,
          totalValue: summary.totalValue,
          enhancedRatesPerMinute: summary.enhancedRatesPerMinute,
          activeMultipliers: summary.activeMultipliers,
          todayClaimedRewards: summary.todayClaimedRewards
        }),
        
        useEnhancedRewards: summary.useEnhancedRewards,
        canUpgrade: summary.canUpgrade
      })}\n\n`
    );

  } catch (error: any) {
    console.error("❌ Erreur getStream:", error);
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
  }

  // Keepalive ping
  const ping = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
  }, 30000);

  const cleanup = () => {
    clearInterval(ping);
    notifier.unsubscribe(playerId, res);
  };
  req.on("close", cleanup);
  // @ts-ignore
  res.on?.("close", cleanup);
};

// === NOUVELLES ROUTES OPTIONNELLES (POUR LES CLIENTS QUI VEULENT PLUS DE DÉTAILS) ===

/**
 * POST /upgrade - Migrer vers le système enhanced (nouvelle route optionnelle)
 */
const postUpgrade: RequestHandler = async (req, res) => {
  const playerId = req.playerId!;

  try {
    const result = await AfkServiceEnhanced.upgradeToEnhanced(playerId);

    if (result.success) {
      // Notifier du succès de l'upgrade
      notifier.notify(playerId, {
        type: "upgrade_available",
        data: { 
          canUpgrade: false, 
          benefits: result.newRates 
        }
      });
    }

    res.json({
      ok: result.success,
      message: result.message,
      ...(result.success && {
        newRates: result.newRates,
        multipliers: result.multipliers
      })
    });

  } catch (error: any) {
    console.error("❌ Erreur postUpgrade:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

/**
 * GET /rates - Obtenir les taux détaillés (nouvelle route optionnelle)
 */
const getRates: RequestHandler = async (req, res) => {
  const playerId = req.playerId!;

  try {
    const { AfkRewardsService } = require("../services/AfkRewardsService");
    const rates = await AfkRewardsService.getPlayerCurrentRates(playerId);

    res.json({ ok: true, data: rates });

  } catch (error: any) {
    console.error("❌ Erreur getRates:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

/**
 * GET /simulate/:hours - Simuler gains pour X heures (nouvelle route optionnelle)
 */
const getSimulate: RequestHandler = async (req, res) => {
  const playerId = req.playerId!;
  const hours = parseInt(req.params.hours) || 1;

  if (hours < 0 || hours > 48) {
    return res.status(400).json({ ok: false, error: "Hours must be between 0 and 48" });
  }

  try {
    const { AfkRewardsService } = require("../services/AfkRewardsService");
    const simulation = await AfkRewardsService.simulateAfkGains(playerId, hours);

    res.json({ ok: true, data: simulation });

  } catch (error: any) {
    console.error("❌ Erreur getSimulate:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

// === MONTAGE DES ROUTES ===

// Routes existantes (noms identiques)
router.get("/summary", authMiddleware, getSummary);
router.post("/start", authMiddleware, postStart);
router.post("/heartbeat", authMiddleware, postHeartbeat);
router.post("/stop", authMiddleware, postStop);
router.post("/claim", authMiddleware, postClaim);
router.get("/stream", authMiddleware, getStream);
router.post("/upgrade", authMiddleware, postUpgrade);
router.get("/rates", authMiddleware, getRates);
router.get("/simulate/:hours", authMiddleware, getSimulate);


export default router;

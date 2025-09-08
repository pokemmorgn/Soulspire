// server/src/middleware/arenaRateLimit.ts
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Rate limit pour les combats d'arène
export const arenaMatchLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15, // Max 15 combats par 5 minutes (3 par minute)
  message: {
    success: false,
    error: "Too many arena battles. Please wait before starting another match.",
    code: "ARENA_RATE_LIMIT",
    retryAfter: "5 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Rate limit par utilisateur + serveur
    return `arena_match_${req.userId}_${req.serverId}`;
  },
  skip: (req: Request) => {
    // Skip si pas d'authentification (sera rejeté par authMiddleware anyway)
    return !req.userId || !req.serverId;
  }
});

// Rate limit pour recherche d'adversaires
export const arenaSearchLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 recherches par minute
  message: {
    success: false,
    error: "Too many opponent searches. Please wait before searching again.",
    code: "ARENA_SEARCH_LIMIT",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `arena_search_${req.userId}_${req.serverId}`;
  },
  skip: (req: Request) => {
    return !req.userId || !req.serverId;
  }
});

// Rate limit pour réclamation de récompenses
export const arenaRewardsLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Max 10 réclamations par minute
  message: {
    success: false,
    error: "Too many reward claims. Please wait before claiming again.",
    code: "ARENA_REWARDS_LIMIT",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `arena_rewards_${req.userId}_${req.serverId}`;
  }
});

// Rate limit général pour l'arène
export const arenaGeneralLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Max 100 requêtes arène par minute
  message: {
    success: false,
    error: "Too many arena requests. Please slow down.",
    code: "ARENA_GENERAL_LIMIT",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `arena_general_${req.userId}_${req.serverId}`;
  }
});

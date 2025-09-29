import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWTPayload } from "../types/index";

// Extension de l'interface Request pour la nouvelle architecture
declare global {
  namespace Express {
    interface Request {
      // Anciens champs pour compatibilité
      userId?: string;
      user?: JWTPayload;
      
      // Nouveaux champs pour Account/Player
      accountId?: string;
      playerId?: string;
      serverId?: string;
    }
  }
}

interface ExtendedJWTPayload extends JWTPayload {
  accountId?: string;
  playerId?: string;
  serverId?: string;
}

interface AuthenticatedRequest extends Request {
  userId: string;
  accountId: string;
  playerId: string;
  serverId: string;
  user: ExtendedJWTPayload;
}

const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({ 
        error: "Authorization header missing",
        code: "AUTH_MISSING"
      });
      return;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({ 
        error: "Invalid authorization format. Expected: Bearer <token>",
        code: "AUTH_FORMAT_INVALID"
      });
      return;
    }

    const token = parts[1];
    if (!token) {
      res.status(401).json({ 
        error: "Token missing",
        code: "TOKEN_MISSING"
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET not configured");
      res.status(500).json({ 
        error: "Server configuration error",
        code: "SERVER_CONFIG_ERROR"
      });
      return;
    }

    // Vérification du token
    const decoded = jwt.verify(token, jwtSecret) as ExtendedJWTPayload;

    // Vérifications de base
    if (!decoded.id && !decoded.playerId && !decoded.accountId) {
      res.status(403).json({ 
        error: "Invalid token payload - missing ID",
        code: "TOKEN_PAYLOAD_INVALID"
      });
      return;
    }

    // Support de l'ancien format (pour compatibilité)
    if (decoded.id && !decoded.playerId && !decoded.accountId) {
      req.userId = decoded.id;
      req.user = decoded;
    } 
    // ✅ NOUVEAU FORMAT Account/Player (CORRIGÉ)
    else if (decoded.accountId && decoded.playerId && decoded.serverId) {
      req.accountId = decoded.accountId;
      req.playerId = decoded.playerId;
      req.serverId = decoded.serverId;
      req.userId = decoded.accountId; // ✅ CORRECTION : userId = accountId pour compatibilité
      req.user = decoded;
    }
    // ✅ FORMAT HYBRIDE (pendant la migration) (CORRIGÉ)
    else if (decoded.id) {
      req.userId = decoded.id; // Dans l'ancien format, id = accountId
      req.accountId = decoded.accountId || decoded.id; // ✅ CORRECTION : Garder cohérence
      req.playerId = decoded.playerId || decoded.id;
      req.serverId = decoded.serverId || "S1";
      req.user = decoded;
    }
    else {
      res.status(403).json({ 
        error: "Invalid token payload format",
        code: "TOKEN_PAYLOAD_INVALID"
      });
      return;
    }

    next();
  } catch (err) {
    // ✅ CORRECTION: Gestion spécifique des erreurs JWT sans pollution des logs
    
    if (err instanceof jwt.TokenExpiredError) {
      // ✅ Token expiré = comportement normal, pas un "log d'erreur"
      console.log(`🔒 Token expired (expiredAt: ${err.expiredAt}) - User needs to login again`);
      res.status(403).json({ 
        error: "Token expired",
        code: "TOKEN_EXPIRED"
      });
      return;
    }
    
    if (err instanceof jwt.JsonWebTokenError) {
      // ✅ Token invalide = info level plutôt qu'erreur
      console.log(`🔒 Invalid JWT token: ${err.message}`);
      res.status(403).json({ 
        error: "Invalid or expired token",
        code: "TOKEN_INVALID"
      });
      return;
    }

    // ✅ Seules les VRAIES erreurs sont loggées comme erreurs
    console.error("🚨 Auth middleware error:", err);
    res.status(500).json({ 
      error: "Authentication failed",
      code: "AUTH_FAILED"
    });
  }
};

// Middleware optionnel (encore plus silencieux)
const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    next();
    return;
  }

  try {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      const token = parts[1];
      const jwtSecret = process.env.JWT_SECRET;
      
      if (jwtSecret && token) {
        const decoded = jwt.verify(token, jwtSecret) as ExtendedJWTPayload;
        
        // ✅ CORRECTION : Injection des données selon le format du token
        if (decoded.accountId && decoded.playerId && decoded.serverId) {
          req.accountId = decoded.accountId;
          req.playerId = decoded.playerId;
          req.serverId = decoded.serverId;
          req.userId = decoded.accountId; // ✅ CORRECTION : userId = accountId
        } else if (decoded.id) {
          req.userId = decoded.id;
          req.accountId = decoded.accountId || decoded.id; // ✅ CORRECTION
          req.playerId = decoded.playerId || decoded.id;
          req.serverId = decoded.serverId || "S1";
        }
        
        req.user = decoded;
      }
    }
  } catch (err) {
    // ✅ Middleware optionnel = encore plus silencieux
    if (err instanceof jwt.TokenExpiredError || err instanceof jwt.JsonWebTokenError) {
      // Token expiré/invalide en mode optionnel = totalement normal, pas de log
    } else {
      console.warn("⚠️ Optional auth failed:", err);
    }
  }
  
  next();
};

// Middleware pour vérifier les rôles admin
const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.userId && !req.playerId) {
    res.status(401).json({ 
      error: "Authentication required",
      code: "AUTH_REQUIRED"
    });
    return;
  }
  
  next();
};

// Middleware pour s'assurer qu'on a les nouvelles données Account/Player
const requireNewAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.accountId || !req.playerId || !req.serverId) {
    res.status(401).json({ 
      error: "This endpoint requires new authentication format. Please login again.",
      code: "AUTH_FORMAT_OUTDATED"
    });
    return;
  }
  
  next();
};

// Middleware de compatibilité pour injecter serverId par défaut
const injectServerIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Si on n'a pas de serverId mais qu'on a un userId, on utilise S1 par défaut
  if (req.userId && !req.serverId) {
    req.serverId = "S1";
  }
  
  next();
};

export { 
  authMiddleware as default, 
  optionalAuthMiddleware, 
  adminMiddleware,
  requireNewAuthMiddleware,
  injectServerIdMiddleware
};
export type { AuthenticatedRequest, ExtendedJWTPayload };

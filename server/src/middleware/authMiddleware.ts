import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWTPayload } from "../types/index";

// Extension de l'interface Request pour inclure userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: JWTPayload;
    }
  }
}

interface AuthenticatedRequest extends Request {
  userId: string;
  user: JWTPayload;
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

    // Format attendu: "Bearer <token>"
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
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    if (!decoded.id) {
      res.status(403).json({ 
        error: "Invalid token payload",
        code: "TOKEN_PAYLOAD_INVALID"
      });
      return;
    }

    // Injection de l'ID utilisateur dans la requête
    req.userId = decoded.id;
    req.user = decoded;

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ 
        error: "Invalid or expired token",
        code: "TOKEN_INVALID"
      });
      return;
    }
    
    if (err instanceof jwt.TokenExpiredError) {
      res.status(403).json({ 
        error: "Token expired",
        code: "TOKEN_EXPIRED"
      });
      return;
    }

    res.status(500).json({ 
      error: "Authentication failed",
      code: "AUTH_FAILED"
    });
  }
};

// Middleware optionnel pour les routes qui peuvent fonctionner avec ou sans auth
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
        const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
        req.userId = decoded.id;
        req.user = decoded;
      }
    }
  } catch (err) {
    // En cas d'erreur, on continue sans authentification
    console.warn("Optional auth failed:", err);
  }
  
  next();
};

// Middleware pour vérifier les rôles admin (pour futures fonctionnalités)
const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Pour l'instant, on suppose que tous les utilisateurs authentifiés sont admins
  // À adapter selon vos besoins
  if (!req.userId) {
    res.status(401).json({ 
      error: "Authentication required",
      code: "AUTH_REQUIRED"
    });
    return;
  }
  
  next();
};

export { authMiddleware as default, optionalAuthMiddleware, adminMiddleware };
export type { AuthenticatedRequest };

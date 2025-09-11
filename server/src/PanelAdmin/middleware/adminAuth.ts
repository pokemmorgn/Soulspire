import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { panelConfig } from '../config/panelConfig';
import { 
  IAuthenticatedAdminRequest,
  AdminRole,
  AdminPermission,
  AdminAuthError,
  AdminPermissionError,
  IRateLimitInfo,
  ADMIN_ROLE_HIERARCHY,
  HIGH_PRIVILEGE_PERMISSIONS,
  SENSITIVE_ACTIONS,
  AdminAction
} from '../types/adminTypes';
import { IdGenerator } from '../../utils/idGenerator';

// Cache simple pour les sessions (en production, utiliser Redis)
const sessionCache = new Map<string, {
  adminId: string;
  username: string;
  role: AdminRole;
  permissions: AdminPermission[];
  ipAddress: string;
  expiresAt: Date;
}>();

// Cache pour le rate limiting par IP
const rateLimitCache = new Map<string, {
  count: number;
  resetTime: Date;
}>();

/**
 * Middleware principal d'authentification admin
 * Vérifie le JWT token et charge les informations de l'admin
 */
export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Vérification de l'IP autorisée
    const clientIP = getClientIP(req);
    if (!isIPAllowed(clientIP)) {
      logSecurityEvent('unauthorized_ip', null, clientIP, req);
      throw new AdminAuthError(
        'Access denied from this IP address',
        'IP_NOT_ALLOWED',
        403,
        { ip: clientIP }
      );
    }

    // 2. Extraction du token JWT
    const token = extractJWTToken(req);
    if (!token) {
      throw new AdminAuthError(
        'No authentication token provided',
        'TOKEN_MISSING',
        401
      );
    }

    // 3. Vérification et décodage du JWT
    const decoded = jwt.verify(token, panelConfig.security.jwtSecret) as any;
    if (!decoded.adminId || !decoded.sessionId) {
      throw new AdminAuthError(
        'Invalid token format',
        'TOKEN_INVALID',
        401
      );
    }

    // 4. Vérification de la session en cache
    const session = sessionCache.get(decoded.sessionId);
    if (!session) {
      throw new AdminAuthError(
        'Session not found or expired',
        'SESSION_EXPIRED',
        401
      );
    }

    // 5. Vérification de l'expiration
    if (new Date() > session.expiresAt) {
      sessionCache.delete(decoded.sessionId);
      throw new AdminAuthError(
        'Session expired',
        'SESSION_EXPIRED',
        401
      );
    }

    // 6. Vérification de l'IP de session (sécurité)
    if (session.ipAddress !== clientIP) {
      sessionCache.delete(decoded.sessionId);
      logSecurityEvent('session_hijack_attempt', session.adminId, clientIP, req);
      throw new AdminAuthError(
        'Session IP mismatch - security violation',
        'SESSION_IP_MISMATCH',
        401
      );
    }

    // 7. Enrichissement de la requête avec les infos admin
    (req as IAuthenticatedAdminRequest).admin = {
      adminId: session.adminId,
      username: session.username,
      role: session.role,
      permissions: session.permissions,
      sessionId: decoded.sessionId
    };

    // 8. Log de l'accès réussi (optionnel, pour les actions sensibles)
    if (req.method !== 'GET') {
      logAdminAction(
        session.adminId,
        session.username,
        'admin.api_access' as AdminAction,
        `${req.method} ${req.path}`,
        null,
        clientIP,
        req.get('User-Agent') || '',
        true
      );
    }

    next();

  } catch (error) {
    if (error instanceof AdminAuthError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Invalid authentication token',
        code: 'TOKEN_INVALID'
      });
    } else {
      console.error('Admin auth middleware error:', error);
      res.status(500).json({
        error: 'Authentication service temporarily unavailable',
        code: 'AUTH_SERVICE_ERROR'
      });
    }
  }
};

/**
 * Middleware de vérification des permissions
 * Utilisation: requirePermission('player.manage', 'economy.view')
 */
export const requirePermission = (...requiredPermissions: AdminPermission[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const adminReq = req as IAuthenticatedAdminRequest;
    
    if (!adminReq.admin) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const userPermissions = adminReq.admin.permissions;
    
    // Super admin a tous les droits
    if (userPermissions.includes('*')) {
      next();
      return;
    }

    // Vérifier si l'utilisateur a au moins une des permissions requises
    const hasPermission = requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      logAdminAction(
        adminReq.admin.adminId,
        adminReq.admin.username,
        'admin.permission_denied' as AdminAction,
        `${req.method} ${req.path}`,
        null,
        getClientIP(req),
        req.get('User-Agent') || '',
        false,
        `Missing permissions: ${requiredPermissions.join(', ')}`
      );

      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: requiredPermissions,
        current: userPermissions.filter(p => p !== '*') // Ne pas exposer le '*'
      });
      return;
    }

    next();
  };
};

/**
 * Middleware de vérification du rôle minimum
 * Utilisation: requireMinRole('admin')
 */
export const requireMinRole = (minRole: AdminRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const adminReq = req as IAuthenticatedAdminRequest;
    
    if (!adminReq.admin) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const userRoleLevel = ADMIN_ROLE_HIERARCHY[adminReq.admin.role];
    const requiredRoleLevel = ADMIN_ROLE_HIERARCHY[minRole];

    if (userRoleLevel < requiredRoleLevel) {
      res.status(403).json({
        error: `Minimum role required: ${minRole}`,
        code: 'INSUFFICIENT_ROLE',
        required: minRole,
        current: adminReq.admin.role
      });
      return;
    }

    next();
  };
};

/**
 * Middleware pour les actions ultra-sensibles
 * Nécessite une double vérification et log spécial
 */
export const requireSensitiveAction = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const adminReq = req as IAuthenticatedAdminRequest;
    
    if (!adminReq.admin) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Seuls les super_admin et admin peuvent faire des actions sensibles
    if (!['super_admin', 'admin'].includes(adminReq.admin.role)) {
      res.status(403).json({
        error: 'Sensitive action requires elevated privileges',
        code: 'SENSITIVE_ACTION_DENIED'
      });
      return;
    }

    // Log spécial pour action sensible
    logAdminAction(
      adminReq.admin.adminId,
      adminReq.admin.username,
      'admin.sensitive_action_attempt' as AdminAction,
      `${req.method} ${req.path}`,
      null,
      getClientIP(req),
      req.get('User-Agent') || '',
      true,
      'Sensitive action initiated'
    );

    next();
  };
};

/**
 * Rate limiting spécialisé pour l'admin panel
 */
export const adminRateLimit = rateLimit({
  windowMs: panelConfig.server.rateLimiting.windowMs,
  max: panelConfig.server.rateLimiting.maxRequests,
  message: {
    error: 'Too many admin requests, please slow down',
    code: 'ADMIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const adminReq = req as IAuthenticatedAdminRequest;
    return adminReq.admin?.adminId || getClientIP(req);
  }
});

/**
 * Rate limiting strict pour les actions critiques
 */
export const criticalActionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Maximum 5 actions critiques par minute
  message: {
    error: 'Too many critical actions, please wait',
    code: 'CRITICAL_ACTION_RATE_LIMIT'
  },
  keyGenerator: (req) => {
    const adminReq = req as IAuthenticatedAdminRequest;
    return adminReq.admin?.adminId || getClientIP(req);
  }
});

// ===== FONCTIONS UTILITAIRES =====

/**
 * Extrait l'IP réelle du client
 */
function getClientIP(req: Request): string {
  return (
    req.ip ||
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    '0.0.0.0'
  ).split(',')[0].trim();
}

/**
 * Vérifie si l'IP est autorisée
 */
function isIPAllowed(ip: string): boolean {
  const allowedIPs = panelConfig.security.allowedIPs;
  
  // Si aucune restriction configurée, autoriser
  if (!allowedIPs || allowedIPs.length === 0) {
    return true;
  }

  // Vérifier si l'IP est dans la liste autorisée
  return allowedIPs.some(allowedIP => {
    // Support des wildcards basiques (ex: 192.168.1.*)
    if (allowedIP.includes('*')) {
      const pattern = allowedIP.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(ip);
    }
    return allowedIP === ip;
  });
}

/**
 * Extrait le token JWT des headers
 */
function extractJWTToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Alternative : cookie (si configuré)
  if (req.cookies && req.cookies['admin_token']) {
    return req.cookies['admin_token'];
  }
  
  return null;
}

/**
 * Crée une session admin en cache
 */
export function createAdminSession(
  adminId: string,
  username: string,
  role: AdminRole,
  permissions: AdminPermission[],
  ipAddress: string
): { sessionId: string; token: string; expiresAt: Date } {
  
  const sessionId = IdGenerator.generateSessionId();
  const expiresAt = new Date(Date.now() + panelConfig.security.sessionDuration * 60 * 60 * 1000);
  
  // Stocker en cache
  sessionCache.set(sessionId, {
    adminId,
    username,
    role,
    permissions,
    ipAddress,
    expiresAt
  });

  // Créer le JWT token
  const token = jwt.sign(
    { 
      adminId, 
      sessionId,
      role,
      iat: Math.floor(Date.now() / 1000)
    },
    panelConfig.security.jwtSecret,
    { 
      expiresIn: `${panelConfig.security.sessionDuration}h`,
      issuer: 'idle-gacha-admin-panel',
      audience: 'admin-users'
    }
  );

  return { sessionId, token, expiresAt };
}

/**
 * Révoque une session admin
 */
export function revokeAdminSession(sessionId: string): boolean {
  return sessionCache.delete(sessionId);
}

/**
 * Nettoie les sessions expirées
 */
export function cleanExpiredSessions(): number {
  const now = new Date();
  let cleaned = 0;
  
  for (const [sessionId, session] of sessionCache.entries()) {
    if (now > session.expiresAt) {
      sessionCache.delete(sessionId);
      cleaned++;
    }
  }
  
  return cleaned;
}

/**
 * Obtient les statistiques des sessions actives
 */
export function getSessionStats(): {
  totalSessions: number;
  sessionsByRole: Record<AdminRole, number>;
  oldestSession: Date | null;
} {
  const stats = {
    totalSessions: sessionCache.size,
    sessionsByRole: {
      super_admin: 0,
      admin: 0,
      moderator: 0,
      viewer: 0
    } as Record<AdminRole, number>,
    oldestSession: null as Date | null
  };

  let oldestDate: Date | null = null;

  for (const session of sessionCache.values()) {
    stats.sessionsByRole[session.role]++;
    
    const sessionAge = new Date(session.expiresAt.getTime() - panelConfig.security.sessionDuration * 60 * 60 * 1000);
    if (!oldestDate || sessionAge < oldestDate) {
      oldestDate = sessionAge;
    }
  }

  stats.oldestSession = oldestDate;
  return stats;
}

/**
 * Log des événements de sécurité
 */
function logSecurityEvent(
  type: string,
  adminId: string | null,
  ipAddress: string,
  req: Request
): void {
  console.warn(`🚨 SECURITY EVENT: ${type}`, {
    adminId,
    ipAddress,
    userAgent: req.get('User-Agent'),
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // TODO: En production, envoyer vers un service de monitoring
  // ou une base de données de logs de sécurité
}

/**
 * Log des actions admin (simplifié pour l'instant)
 */
function logAdminAction(
  adminId: string,
  adminUsername: string,
  action: AdminAction,
  resource: string,
  resourceId: string | null,
  ipAddress: string,
  userAgent: string,
  success: boolean,
  errorMessage?: string
): void {
  console.log(`📊 ADMIN ACTION: ${action}`, {
    adminId,
    adminUsername,
    resource,
    resourceId,
    ipAddress,
    success,
    errorMessage,
    timestamp: new Date().toISOString()
  });
  
  // TODO: Sauvegarder en base dans AuditLog.ts
}

// Nettoyage automatique des sessions expirées toutes les 10 minutes
setInterval(() => {
  const cleaned = cleanExpiredSessions();
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired admin sessions`);
  }
}, 10 * 60 * 1000);

export default {
  authenticateAdmin,
  requirePermission,
  requireMinRole,
  requireSensitiveAction,
  adminRateLimit,
  criticalActionRateLimit,
  createAdminSession,
  revokeAdminSession,
  cleanExpiredSessions,
  getSessionStats
};

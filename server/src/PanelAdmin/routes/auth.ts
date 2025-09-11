import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import AdminService from '../services/AdminService';
import Admin from '../models/Admin';
import AuditLog from '../models/AuditLog';
import { 
  authenticateAdmin, 
  requirePermission,
  requireMinRole,
  createAdminSession,
  revokeAdminSession 
} from '../middleware/adminAuth';
import {
  IAuthenticatedAdminRequest,
  ILoginRequest,
  AdminAuthError,
  AdminPermissionError
} from '../types/adminTypes';
import { panelConfig } from '../config/panelConfig';

const router = express.Router();

// Rate limiting spécifique pour l'authentification
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Maximum 10 tentatives par IP
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting pour changement de mot de passe
const passwordChangeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // Maximum 3 changements par heure
  message: {
    error: 'Too many password change attempts',
    code: 'PASSWORD_CHANGE_RATE_LIMIT'
  }
});

// Middleware pour extraire l'IP client
const getClientIP = (req: Request): string => {
  return (
    req.ip ||
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    '0.0.0.0'
  ).split(',')[0].trim();
};

// Middleware pour extraire l'User-Agent
const getUserAgent = (req: Request): string => {
  return req.get('User-Agent') || 'Unknown';
};

// ===== ROUTES D'AUTHENTIFICATION =====

/**
 * POST /api/admin/auth/login
 * Connexion d'un administrateur
 */
router.post('/login', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password, twoFactorCode } = req.body as ILoginRequest;
    const ipAddress = getClientIP(req);
    const userAgent = getUserAgent(req);

    // Validation des données
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Tentative de connexion
    const loginResult = await AdminService.login(
      { username, password, twoFactorCode },
      ipAddress,
      userAgent
    );

    if (loginResult.success) {
      // Définir le cookie de session (optionnel)
      if (loginResult.token) {
        res.cookie('admin_token', loginResult.token, {
          httpOnly: true,
          secure: panelConfig.server.enableHttps,
          sameSite: 'strict',
          maxAge: panelConfig.security.sessionDuration * 60 * 60 * 1000
        });
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          admin: loginResult.adminUser,
          token: loginResult.token,
          expiresIn: panelConfig.security.sessionDuration * 3600 // en secondes
        }
      });
    } else {
      // 2FA requis
      res.status(200).json({
        success: false,
        requiresTwoFactor: true,
        message: loginResult.message || 'Two-factor authentication required'
      });
    }

  } catch (error) {
    if (error instanceof AdminAuthError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
    } else {
      console.error('Login route error:', error);
      res.status(500).json({
        error: 'Authentication service temporarily unavailable',
        code: 'INTERNAL_ERROR'
      });
    }
  }
});

/**
 * POST /api/admin/auth/logout
 * Déconnexion d'un administrateur
 */
router.post('/logout', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const adminReq = req as IAuthenticatedAdminRequest;
    const ipAddress = getClientIP(req);
    const userAgent = getUserAgent(req);

    await AdminService.logout(
      adminReq.admin.adminId,
      adminReq.admin.sessionId,
      ipAddress,
      userAgent
    );

    // Supprimer le cookie
    res.clearCookie('admin_token');

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout route error:', error);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

/**
 * GET /api/admin/auth/me
 * Obtenir le profil de l'administrateur connecté
 */
router.get('/me', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const adminReq = req as IAuthenticatedAdminRequest;
    
    const admin = await AdminService.getAdminById(adminReq.admin.adminId);
    if (!admin) {
      return res.status(404).json({
        error: 'Admin profile not found',
        code: 'ADMIN_NOT_FOUND'
      });
    }

    const profile = admin.getAccountSummary();

    res.json({
      success: true,
      data: {
        admin: profile,
        session: {
          sessionId: adminReq.admin.sessionId,
          permissions: adminReq.admin.permissions,
          loginTime: admin.lastLoginAt
        }
      }
    });

  } catch (error) {
    console.error('Get profile route error:', error);
    res.status(500).json({
      error: 'Failed to retrieve profile',
      code: 'PROFILE_ERROR'
    });
  }
});

/**
 * POST /api/admin/auth/refresh
 * Renouveler le token de session
 */
router.post('/refresh', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const adminReq = req as IAuthenticatedAdminRequest;
    const ipAddress = getClientIP(req);

    // Créer une nouvelle session
    const newSession = createAdminSession(
      adminReq.admin.adminId,
      adminReq.admin.username,
      adminReq.admin.role,
      adminReq.admin.permissions,
      ipAddress
    );

    // Révoquer l'ancienne session
    revokeAdminSession(adminReq.admin.sessionId);

    // Mettre à jour le cookie
    res.cookie('admin_token', newSession.token, {
      httpOnly: true,
      secure: panelConfig.server.enableHttps,
      sameSite: 'strict',
      maxAge: panelConfig.security.sessionDuration * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newSession.token,
        expiresAt: newSession.expiresAt,
        expiresIn: panelConfig.security.sessionDuration * 3600
      }
    });

  } catch (error) {
    console.error('Refresh token route error:', error);
    res.status(500).json({
      error: 'Failed to refresh token',
      code: 'REFRESH_ERROR'
    });
  }
});

/**
 * POST /api/admin/auth/change-password
 * Changer le mot de passe
 */
router.post('/change-password', 
  passwordChangeRateLimit, 
  authenticateAdmin, 
  async (req: Request, res: Response) => {
    try {
      const adminReq = req as IAuthenticatedAdminRequest;
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const ipAddress = getClientIP(req);
      const userAgent = getUserAgent(req);

      // Validation des données
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          error: 'All password fields are required',
          code: 'MISSING_PASSWORD_FIELDS'
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          error: 'New passwords do not match',
          code: 'PASSWORD_MISMATCH'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          error: 'New password must be at least 8 characters long',
          code: 'PASSWORD_TOO_SHORT'
        });
      }

      // Récupérer l'admin avec le mot de passe
      const admin = await Admin.findOne({ 
        adminId: adminReq.admin.adminId 
      }).select('+password');

      if (!admin) {
        return res.status(404).json({
          error: 'Admin not found',
          code: 'ADMIN_NOT_FOUND'
        });
      }

      // Vérifier le mot de passe actuel
      const isCurrentPasswordValid = await admin.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        // Logger la tentative de changement avec mauvais mot de passe
        await AuditLog.createLog({
          adminId: adminReq.admin.adminId,
          adminUsername: adminReq.admin.username,
          adminRole: adminReq.admin.role,
          action: 'admin.password_change',
          resource: 'admin_user',
          resourceId: adminReq.admin.adminId,
          ipAddress,
          userAgent,
          success: false,
          severity: 'medium',
          errorMessage: 'Invalid current password'
        });

        return res.status(401).json({
          error: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // Changer le mot de passe
      await AdminService.resetPassword(
        adminReq.admin.adminId,
        newPassword,
        adminReq.admin.adminId, // Auto-changement
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      if (error instanceof AdminPermissionError) {
        res.status(403).json({
          error: error.message,
          code: error.code
        });
      } else {
        console.error('Change password route error:', error);
        res.status(500).json({
          error: 'Failed to change password',
          code: 'PASSWORD_CHANGE_ERROR'
        });
      }
    }
  }
);

/**
 * POST /api/admin/auth/enable-2fa
 * Activer l'authentification à deux facteurs
 */
router.post('/enable-2fa', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const adminReq = req as IAuthenticatedAdminRequest;
    const { verificationCode } = req.body;
    const ipAddress = getClientIP(req);
    const userAgent = getUserAgent(req);

    const admin = await Admin.findOne({ 
      adminId: adminReq.admin.adminId 
    }).select('+twoFactorSecret');

    if (!admin) {
      return res.status(404).json({
        error: 'Admin not found',
        code: 'ADMIN_NOT_FOUND'
      });
    }

    if (admin.twoFactorEnabled) {
      return res.status(400).json({
        error: 'Two-factor authentication is already enabled',
        code: '2FA_ALREADY_ENABLED'
      });
    }

    // Générer ou utiliser le secret existant
    let secret = admin.twoFactorSecret;
    if (!secret) {
      secret = admin.generateTwoFactorSecret();
      await admin.save();
    }

    // Si un code de vérification est fourni, l'activer
    if (verificationCode) {
      const isValidCode = admin.verifyTwoFactorCode(verificationCode);
      if (!isValidCode) {
        return res.status(400).json({
          error: 'Invalid verification code',
          code: 'INVALID_2FA_CODE'
        });
      }

      admin.twoFactorEnabled = true;
      await admin.save();

      // Logger l'activation
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'admin.2fa_enable',
        resource: 'admin_security',
        resourceId: adminReq.admin.adminId,
        ipAddress,
        userAgent,
        success: true,
        severity: 'medium'
      });

      res.json({
        success: true,
        message: 'Two-factor authentication enabled successfully'
      });
    } else {
      // Retourner le secret pour configuration
      res.json({
        success: true,
        message: 'Two-factor authentication setup initiated',
        data: {
          secret,
          qrCodeUrl: `otpauth://totp/AdminPanel:${admin.username}?secret=${secret}&issuer=IdleGachaAdmin`
        }
      });
    }

  } catch (error) {
    console.error('Enable 2FA route error:', error);
    res.status(500).json({
      error: 'Failed to enable two-factor authentication',
      code: '2FA_ENABLE_ERROR'
    });
  }
});

/**
 * POST /api/admin/auth/disable-2fa
 * Désactiver l'authentification à deux facteurs
 */
router.post('/disable-2fa', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const adminReq = req as IAuthenticatedAdminRequest;
    const { password, verificationCode } = req.body;
    const ipAddress = getClientIP(req);
    const userAgent = getUserAgent(req);

    // Validation des données
    if (!password || !verificationCode) {
      return res.status(400).json({
        error: 'Password and verification code are required',
        code: 'MISSING_DISABLE_2FA_FIELDS'
      });
    }

    const admin = await Admin.findOne({ 
      adminId: adminReq.admin.adminId 
    }).select('+password +twoFactorSecret');

    if (!admin) {
      return res.status(404).json({
        error: 'Admin not found',
        code: 'ADMIN_NOT_FOUND'
      });
    }

    if (!admin.twoFactorEnabled) {
      return res.status(400).json({
        error: 'Two-factor authentication is not enabled',
        code: '2FA_NOT_ENABLED'
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid password',
        code: 'INVALID_PASSWORD'
      });
    }

    // Vérifier le code 2FA
    const isValidCode = admin.verifyTwoFactorCode(verificationCode);
    if (!isValidCode) {
      return res.status(400).json({
        error: 'Invalid verification code',
        code: 'INVALID_2FA_CODE'
      });
    }

    // Désactiver le 2FA
    admin.twoFactorEnabled = false;
    admin.twoFactorSecret = undefined;
    await admin.save();

    // Logger la désactivation
    await AuditLog.createLog({
      adminId: adminReq.admin.adminId,
      adminUsername: adminReq.admin.username,
      adminRole: adminReq.admin.role,
      action: 'admin.2fa_disable',
      resource: 'admin_security',
      resourceId: adminReq.admin.adminId,
      ipAddress,
      userAgent,
      success: true,
      severity: 'high' // Désactivation = plus sensible
    });

    res.json({
      success: true,
      message: 'Two-factor authentication disabled successfully'
    });

  } catch (error) {
    console.error('Disable 2FA route error:', error);
    res.status(500).json({
      error: 'Failed to disable two-factor authentication',
      code: '2FA_DISABLE_ERROR'
    });
  }
});

/**
 * GET /api/admin/auth/sessions
 * Obtenir les sessions actives (pour le super admin)
 */
router.get('/sessions', 
  authenticateAdmin, 
  requireMinRole('admin'),
  async (req: Request, res: Response) => {
    try {
      // Importer la fonction de stats depuis le middleware
      const { getSessionStats } = require('../middleware/adminAuth');
      const sessionStats = getSessionStats();

      // Obtenir les connexions récentes depuis les logs
      const recentLogins = await AuditLog.find({
        action: 'admin.login',
        success: true,
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
        .sort({ timestamp: -1 })
        .limit(20)
        .select('adminUsername timestamp ipAddress')
        .exec();

      res.json({
        success: true,
        data: {
          activeSessions: sessionStats,
          recentLogins: recentLogins.map(log => ({
            username: log.adminUsername,
            timestamp: log.timestamp,
            ipAddress: log.ipAddress
          }))
        }
      });

    } catch (error) {
      console.error('Get sessions route error:', error);
      res.status(500).json({
        error: 'Failed to retrieve session information',
        code: 'SESSIONS_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/auth/revoke-session
 * Révoquer une session spécifique (super admin seulement)
 */
router.post('/revoke-session', 
  authenticateAdmin, 
  requireMinRole('super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      const adminReq = req as IAuthenticatedAdminRequest;
      const ipAddress = getClientIP(req);
      const userAgent = getUserAgent(req);

      if (!sessionId) {
        return res.status(400).json({
          error: 'Session ID is required',
          code: 'MISSING_SESSION_ID'
        });
      }

      const revoked = revokeAdminSession(sessionId);

      // Logger l'action
      await AuditLog.createLog({
        adminId: adminReq.admin.adminId,
        adminUsername: adminReq.admin.username,
        adminRole: adminReq.admin.role,
        action: 'admin.logout',
        resource: 'admin_session',
        resourceId: sessionId,
        details: { additionalInfo: { reason: 'Forced logout by admin' } },
        ipAddress,
        userAgent,
        success: revoked,
        severity: 'medium'
      });

      if (revoked) {
        res.json({
          success: true,
          message: 'Session revoked successfully'
        });
      } else {
        res.status(404).json({
          error: 'Session not found or already expired',
          code: 'SESSION_NOT_FOUND'
        });
      }

    } catch (error) {
      console.error('Revoke session route error:', error);
      res.status(500).json({
        error: 'Failed to revoke session',
        code: 'REVOKE_SESSION_ERROR'
      });
    }
  }
);

// ===== MIDDLEWARE DE GESTION D'ERREURS =====

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Admin auth route error:', error);
  
  if (error instanceof AdminAuthError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details
    });
  } else if (error instanceof AdminPermissionError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details
    });
  } else {
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;

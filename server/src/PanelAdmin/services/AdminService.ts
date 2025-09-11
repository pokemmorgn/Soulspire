import bcrypt from 'bcrypt';
import Admin, { IAdminDocument } from '../models/Admin';
import AuditLog from '../models/AuditLog';
import { panelConfig } from '../config/panelConfig';
import { 
  createAdminSession, 
  revokeAdminSession,
  getSessionStats 
} from '../middleware/adminAuth';
import {
  AdminRole,
  AdminPermission,
  AdminAction,
  ILoginRequest,
  ILoginResponse,
  ICreateAdminRequest,
  IUpdateAdminRequest,
  IAdminStatsResponse,
  ISecurityAlert,
  IAdminFilter,
  AdminAuthError,
  AdminPermissionError,
  DEFAULT_ROLE_PERMISSIONS,
  ADMIN_ROLE_HIERARCHY,
  SENSITIVE_ACTIONS
} from '../types/adminTypes';
import { IdGenerator } from '../../utils/idGenerator';

export class AdminService {
  
  // ===== AUTHENTIFICATION =====
  
  /**
   * Connexion d'un administrateur
   */
  static async login(
    loginData: ILoginRequest, 
    ipAddress: string, 
    userAgent: string
  ): Promise<ILoginResponse> {
    try {
      // 1. Trouver l'admin par username
      const admin = await Admin.findOne({ 
        username: loginData.username.toLowerCase() 
      }).select('+password +twoFactorSecret');

      if (!admin) {
        await this.logFailedLogin(loginData.username, ipAddress, userAgent, 'User not found');
        throw new AdminAuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      }

      // 2. Vérifier si le compte est actif
      if (!admin.isActive) {
        await this.logFailedLogin(admin.username, ipAddress, userAgent, 'Account inactive');
        throw new AdminAuthError('Account is disabled', 'ACCOUNT_DISABLED', 403);
      }

      // 3. Vérifier si le compte est verrouillé
      if (admin.isLocked()) {
        await this.logFailedLogin(admin.username, ipAddress, userAgent, 'Account locked');
        throw new AdminAuthError('Account is locked due to multiple failed attempts', 'ACCOUNT_LOCKED', 423);
      }

      // 4. Vérifier le mot de passe
      const isPasswordValid = await admin.comparePassword(loginData.password);
      if (!isPasswordValid) {
        await admin.incrementLoginAttempts();
        await this.logFailedLogin(admin.username, ipAddress, userAgent, 'Invalid password');
        throw new AdminAuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      }

      // 5. Vérifier le 2FA si activé
      if (admin.twoFactorEnabled) {
        if (!loginData.twoFactorCode) {
          return {
            success: false,
            requiresTwoFactor: true,
            message: 'Two-factor authentication required'
          };
        }

        if (!admin.verifyTwoFactorCode(loginData.twoFactorCode)) {
          await admin.incrementLoginAttempts();
          await this.logFailedLogin(admin.username, ipAddress, userAgent, 'Invalid 2FA code');
          throw new AdminAuthError('Invalid two-factor code', 'INVALID_2FA', 401);
        }
      }

      // 6. Connexion réussie - créer la session
      const permissions = admin.getEffectivePermissions();
      const session = createAdminSession(
        admin.adminId,
        admin.username,
        admin.role,
        permissions,
        ipAddress
      );

      // 7. Mettre à jour les infos de connexion
      await admin.updateLastLogin(ipAddress);
      await admin.resetLoginAttempts();

      // 8. Logger la connexion réussie
      await this.createAuditLog({
        adminId: admin.adminId,
        adminUsername: admin.username,
        adminRole: admin.role,
        action: 'admin.login',
        resource: 'admin_session',
        resourceId: session.sessionId,
        ipAddress,
        userAgent,
        success: true,
        severity: 'low',
        sessionId: session.sessionId
      });

      return {
        success: true,
        token: session.token,
        adminUser: {
          adminId: admin.adminId,
          username: admin.username,
          role: admin.role,
          permissions,
          email: admin.email,
          lastLoginAt: admin.lastLoginAt
        }
      };

    } catch (error) {
      if (error instanceof AdminAuthError) {
        throw error;
      }
      console.error('Login service error:', error);
      throw new AdminAuthError('Authentication service temporarily unavailable', 'SERVICE_ERROR', 503);
    }
  }

  /**
   * Déconnexion d'un administrateur
   */
  static async logout(
    adminId: string, 
    sessionId: string, 
    ipAddress: string, 
    userAgent: string
  ): Promise<void> {
    try {
      const admin = await Admin.findOne({ adminId });
      if (!admin) return;

      // Révoquer la session
      const revoked = revokeAdminSession(sessionId);

      // Logger la déconnexion
      await this.createAuditLog({
        adminId: admin.adminId,
        adminUsername: admin.username,
        adminRole: admin.role,
        action: 'admin.logout',
        resource: 'admin_session',
        resourceId: sessionId,
        ipAddress,
        userAgent,
        success: revoked,
        severity: 'low',
        sessionId
      });

    } catch (error) {
      console.error('Logout service error:', error);
    }
  }

  // ===== GESTION DES ADMINISTRATEURS =====

  /**
   * Créer un nouvel administrateur
   */
  static async createAdmin(
    adminData: ICreateAdminRequest,
    createdBy: string,
    createdByIP: string,
    userAgent: string
  ): Promise<IAdminDocument> {
    try {
      // Validation des données
      this.validateAdminData(adminData);

      // Vérifier les permissions du créateur
      const creator = await Admin.findOne({ adminId: createdBy });
      if (!creator || !creator.canManageAdmin(adminData.role)) {
        throw new AdminPermissionError(
          'Insufficient permissions to create admin with this role',
          'admin.create'
        );
      }

      // Créer le nouvel admin
      const newAdmin = new Admin({
        username: adminData.username.toLowerCase(),
        email: adminData.email.toLowerCase(),
        password: adminData.password,
        role: adminData.role,
        accountId: adminData.accountId,
        permissions: DEFAULT_ROLE_PERMISSIONS[adminData.role],
        createdBy,
        metadata: {
          createdByIP,
          preferredLanguage: 'en',
          timezone: 'UTC'
        }
      });

      await newAdmin.save();

      // Logger la création
      await this.createAuditLog({
        adminId: createdBy,
        adminUsername: creator.username,
        adminRole: creator.role,
        action: 'admin.create_user',
        resource: 'admin_user',
        resourceId: newAdmin.adminId,
        details: {
          newValue: {
            username: newAdmin.username,
            email: newAdmin.email,
            role: newAdmin.role
          }
        },
        ipAddress: createdByIP,
        userAgent,
        success: true,
        severity: 'high'
      });

      return newAdmin;

    } catch (error) {
      if (error instanceof AdminPermissionError) {
        throw error;
      }
      console.error('Create admin error:', error);
      throw new Error('Failed to create admin user');
    }
  }

  /**
   * Mettre à jour un administrateur
   */
  static async updateAdmin(
    targetAdminId: string,
    updateData: IUpdateAdminRequest,
    updatedBy: string,
    ipAddress: string,
    userAgent: string
  ): Promise<IAdminDocument> {
    try {
      const [targetAdmin, updater] = await Promise.all([
        Admin.findOne({ adminId: targetAdminId }),
        Admin.findOne({ adminId: updatedBy })
      ]);

      if (!targetAdmin) {
        throw new Error('Target admin not found');
      }

      if (!updater) {
        throw new AdminAuthError('Updater admin not found', 'ADMIN_NOT_FOUND', 404);
      }

      // Vérifier les permissions
      if (updateData.role && !updater.canManageAdmin(updateData.role)) {
        throw new AdminPermissionError(
          'Insufficient permissions to assign this role',
          'admin.modify_permissions'
        );
      }

      if (!updater.canManageAdmin(targetAdmin.role)) {
        throw new AdminPermissionError(
          'Insufficient permissions to modify this admin',
          'admin.manage'
        );
      }

      // Sauvegarder l'ancien état
      const oldState = {
        role: targetAdmin.role,
        permissions: targetAdmin.permissions,
        isActive: targetAdmin.isActive
      };

      // Appliquer les modifications
      if (updateData.role !== undefined) {
        targetAdmin.role = updateData.role;
        // Réassigner les permissions par défaut si changement de rôle
        targetAdmin.permissions = DEFAULT_ROLE_PERMISSIONS[updateData.role];
      }

      if (updateData.permissions !== undefined) {
        targetAdmin.permissions = updateData.permissions;
      }

      if (updateData.isActive !== undefined) {
        targetAdmin.isActive = updateData.isActive;
      }

      await targetAdmin.save();

      // Logger la modification
      await this.createAuditLog({
        adminId: updatedBy,
        adminUsername: updater.username,
        adminRole: updater.role,
        action: 'admin.modify_permissions',
        resource: 'admin_user',
        resourceId: targetAdminId,
        details: {
          oldValue: oldState,
          newValue: {
            role: targetAdmin.role,
            permissions: targetAdmin.permissions,
            isActive: targetAdmin.isActive
          },
          changes: this.calculateChanges(oldState, {
            role: targetAdmin.role,
            permissions: targetAdmin.permissions,
            isActive: targetAdmin.isActive
          })
        },
        ipAddress,
        userAgent,
        success: true,
        severity: 'critical'
      });

      return targetAdmin;

    } catch (error) {
      if (error instanceof AdminPermissionError || error instanceof AdminAuthError) {
        throw error;
      }
      console.error('Update admin error:', error);
      throw new Error('Failed to update admin user');
    }
  }

  /**
   * Supprimer un administrateur
   */
  static async deleteAdmin(
    targetAdminId: string,
    deletedBy: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      const [targetAdmin, deleter] = await Promise.all([
        Admin.findOne({ adminId: targetAdminId }),
        Admin.findOne({ adminId: deletedBy })
      ]);

      if (!targetAdmin) {
        throw new Error('Target admin not found');
      }

      if (!deleter) {
        throw new AdminAuthError('Deleter admin not found', 'ADMIN_NOT_FOUND', 404);
      }

      // Vérifier les permissions
      if (!deleter.canManageAdmin(targetAdmin.role)) {
        throw new AdminPermissionError(
          'Insufficient permissions to delete this admin',
          'admin.delete'
        );
      }

      // Empêcher la suppression du dernier super_admin
      if (targetAdmin.role === 'super_admin') {
        const superAdminCount = await Admin.countDocuments({ 
          role: 'super_admin', 
          isActive: true 
        });
        if (superAdminCount <= 1) {
          throw new Error('Cannot delete the last super admin');
        }
      }

      // Sauvegarder les infos avant suppression
      const adminInfo = {
        username: targetAdmin.username,
        email: targetAdmin.email,
        role: targetAdmin.role
      };

      await targetAdmin.deleteOne();

      // Logger la suppression
      await this.createAuditLog({
        adminId: deletedBy,
        adminUsername: deleter.username,
        adminRole: deleter.role,
        action: 'admin.delete_user',
        resource: 'admin_user',
        resourceId: targetAdminId,
        details: {
          oldValue: adminInfo
        },
        ipAddress,
        userAgent,
        success: true,
        severity: 'critical'
      });

    } catch (error) {
      if (error instanceof AdminPermissionError || error instanceof AdminAuthError) {
        throw error;
      }
      console.error('Delete admin error:', error);
      throw new Error('Failed to delete admin user');
    }
  }

  // ===== RECHERCHE ET STATISTIQUES =====

  /**
   * Rechercher des administrateurs
   */
  static async searchAdmins(filter: IAdminFilter): Promise<{
    admins: IAdminDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const query: any = {};

      // Construire la requête
      if (filter.role) query.role = filter.role;
      if (filter.isActive !== undefined) query.isActive = filter.isActive;
      if (filter.username) {
        query.username = { $regex: filter.username, $options: 'i' };
      }
      if (filter.email) {
        query.email = { $regex: filter.email, $options: 'i' };
      }

      const page = filter.page || 1;
      const limit = Math.min(filter.limit || 20, 100);
      const skip = (page - 1) * limit;

      const sortField = filter.sortBy || 'createdAt';
      const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;

      const [admins, total] = await Promise.all([
        Admin.find(query)
          .select('-password -twoFactorSecret')
          .sort({ [sortField]: sortOrder })
          .skip(skip)
          .limit(limit)
          .exec(),
        Admin.countDocuments(query)
      ]);

      return { admins, total, page, limit };

    } catch (error) {
      console.error('Search admins error:', error);
      throw new Error('Failed to search admin users');
    }
  }

  /**
   * Obtenir les statistiques des administrateurs
   */
  static async getAdminStats(): Promise<IAdminStatsResponse> {
    try {
      const [stats, sessionStats] = await Promise.all([
        Admin.getAdminStats(),
        getSessionStats()
      ]);

      const byRole = stats.byRole.reduce((acc: any, stat: any) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {
        super_admin: 0,
        admin: 0,
        moderator: 0,
        viewer: 0
      });

      // Calculer les connexions récentes (7 derniers jours)
      const recentLogins = stats.byRole.reduce((total: number, stat: any) => {
        return total + stat.recentLogins;
      }, 0);

      // Compter les échecs de connexion récents
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const failedLogins = await AuditLog.countDocuments({
        action: 'admin.failed_login',
        timestamp: { $gte: cutoff }
      });

      return {
        totalAdmins: stats.summary.total,
        activeAdmins: sessionStats.totalSessions,
        adminsByRole: byRole,
        recentLogins,
        failedLogins
      };

    } catch (error) {
      console.error('Get admin stats error:', error);
      throw new Error('Failed to get admin statistics');
    }
  }

  // ===== SÉCURITÉ ET AUDIT =====

  /**
   * Détecter les activités suspectes
   */
  static async detectSuspiciousActivity(hours: number = 24): Promise<ISecurityAlert[]> {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      const alerts: ISecurityAlert[] = [];

      // 1. Échecs de connexion multiples depuis la même IP
      const failedLoginsByIP = await AuditLog.aggregate([
        {
          $match: {
            action: 'admin.failed_login',
            timestamp: { $gte: cutoff }
          }
        },
        {
          $group: {
            _id: '$ipAddress',
            count: { $sum: 1 },
            admins: { $addToSet: '$adminUsername' }
          }
        },
        { $match: { count: { $gte: 5 } } }
      ]);

      failedLoginsByIP.forEach(item => {
        alerts.push({
          type: 'multiple_failures',
          adminId: 'system',
          adminUsername: 'system',
          ipAddress: item._id,
          timestamp: new Date(),
          details: `${item.count} failed login attempts from IP ${item._id}`,
          severity: item.count > 10 ? 'critical' : 'high'
        });
      });

      // 2. Actions critiques récentes
      const criticalActions = await AuditLog.find({
        action: { $in: SENSITIVE_ACTIONS },
        timestamp: { $gte: cutoff }
      }).limit(50);

      criticalActions.forEach(log => {
        alerts.push({
          type: 'permission_escalation',
          adminId: log.adminId,
          adminUsername: log.adminUsername,
          ipAddress: log.ipAddress,
          timestamp: log.timestamp,
          details: `Critical action: ${log.action} on ${log.resource}`,
          severity: 'high'
        });
      });

      // 3. Connexions depuis des IPs inhabituelles
      const adminLogins = await AuditLog.aggregate([
        {
          $match: {
            action: 'admin.login',
            success: true,
            timestamp: { $gte: cutoff }
          }
        },
        {
          $group: {
            _id: { adminId: '$adminId', ipAddress: '$ipAddress' },
            count: { $sum: 1 },
            adminUsername: { $first: '$adminUsername' }
          }
        }
      ]);

      // Détecter les nouvelles IPs par admin
      for (const login of adminLogins) {
        const historicalIPs = await AuditLog.distinct('ipAddress', {
          adminId: login._id.adminId,
          action: 'admin.login',
          success: true,
          timestamp: { $lt: cutoff }
        });

        if (!historicalIPs.includes(login._id.ipAddress)) {
          alerts.push({
            type: 'unusual_activity',
            adminId: login._id.adminId,
            adminUsername: login.adminUsername,
            ipAddress: login._id.ipAddress,
            timestamp: new Date(),
            details: `Login from new IP address: ${login._id.ipAddress}`,
            severity: 'medium'
          });
        }
      }

      return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    } catch (error) {
      console.error('Detect suspicious activity error:', error);
      return [];
    }
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Créer un log d'audit
   */
  private static async createAuditLog(logData: any): Promise<void> {
    try {
      await AuditLog.createLog(logData);
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Ne pas faire échouer l'opération principale si le log échoue
    }
  }

  /**
   * Logger un échec de connexion
   */
  private static async logFailedLogin(
    username: string,
    ipAddress: string,
    userAgent: string,
    reason: string
  ): Promise<void> {
    await this.createAuditLog({
      adminId: 'system',
      adminUsername: username,
      adminRole: 'viewer' as AdminRole,
      action: 'admin.failed_login' as AdminAction,
      resource: 'admin_session',
      details: { reason },
      ipAddress,
      userAgent,
      success: false,
      severity: 'medium'
    });
  }

  /**
   * Valider les données d'un nouvel admin
   */
  private static validateAdminData(adminData: ICreateAdminRequest): void {
    if (!adminData.username || adminData.username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    if (!adminData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminData.email)) {
      throw new Error('Valid email address is required');
    }

    if (!adminData.password || adminData.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!['super_admin', 'admin', 'moderator', 'viewer'].includes(adminData.role)) {
      throw new Error('Invalid admin role');
    }
  }

  /**
   * Calculer les changements entre deux objets
   */
  private static calculateChanges(oldObj: any, newObj: any): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};

    for (const key in newObj) {
      if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
        changes[key] = {
          from: oldObj[key],
          to: newObj[key]
        };
      }
    }

    return changes;
  }

  /**
   * Obtenir un admin par ID
   */
  static async getAdminById(adminId: string): Promise<IAdminDocument | null> {
    try {
      return await Admin.findOne({ adminId })
        .select('-password -twoFactorSecret')
        .exec();
    } catch (error) {
      console.error('Get admin by ID error:', error);
      return null;
    }
  }

  /**
   * Vérifier si un admin a une permission spécifique
   */
  static async checkPermission(adminId: string, permission: AdminPermission): Promise<boolean> {
    try {
      const admin = await Admin.findOne({ adminId });
      return admin ? admin.hasPermission(permission) : false;
    } catch (error) {
      console.error('Check permission error:', error);
      return false;
    }
  }

  /**
   * Réinitialiser le mot de passe d'un admin
   */
  static async resetPassword(
    targetAdminId: string,
    newPassword: string,
    resetBy: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      const [targetAdmin, resetter] = await Promise.all([
        Admin.findOne({ adminId: targetAdminId }),
        Admin.findOne({ adminId: resetBy })
      ]);

      if (!targetAdmin || !resetter) {
        throw new Error('Admin not found');
      }

      if (!resetter.canManageAdmin(targetAdmin.role)) {
        throw new AdminPermissionError(
          'Insufficient permissions to reset password',
          'admin.manage'
        );
      }

      // Hash et sauvegarder le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      targetAdmin.password = hashedPassword;
      targetAdmin.metadata.lastPasswordChange = new Date();
      await targetAdmin.save();

      // Logger l'action
      await this.createAuditLog({
        adminId: resetBy,
        adminUsername: resetter.username,
        adminRole: resetter.role,
        action: 'admin.password_change',
        resource: 'admin_user',
        resourceId: targetAdminId,
        ipAddress,
        userAgent,
        success: true,
        severity: 'high'
      });

    } catch (error) {
      if (error instanceof AdminPermissionError) {
        throw error;
      }
      console.error('Reset password error:', error);
      throw new Error('Failed to reset password');
    }
  }
}

export default AdminService;

import bcrypt from 'bcrypt';
import Account from '../../models/Account';
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
   * Connexion d'un administrateur via compte Account
   */
  static async login(
    loginData: ILoginRequest, 
    ipAddress: string, 
    userAgent: string
  ): Promise<ILoginResponse> {
    try {
      // 1. Trouver le compte par username avec les champs admin
      const account = await Account.findOne({ 
        username: loginData.username.toLowerCase(),
        adminEnabled: true // Seuls les comptes avec admin activé
      }).select('+password +adminTwoFactorSecret');

      if (!account) {
        await this.logFailedLogin(loginData.username, ipAddress, userAgent, 'Admin account not found');
        throw new AdminAuthError('Invalid admin credentials', 'INVALID_ADMIN_CREDENTIALS', 401);
      }

      // 2. Vérifier si le compte est actif et admin
      if (!account.isAdmin()) {
        await this.logFailedLogin(account.username, ipAddress, userAgent, 'Account not admin');
        throw new AdminAuthError('Account does not have admin privileges', 'NOT_ADMIN_ACCOUNT', 403);
      }

      // 3. Vérifier si le compte admin est verrouillé
      if (this.isAdminLocked(account)) {
        await this.logFailedLogin(account.username, ipAddress, userAgent, 'Admin account locked');
        throw new AdminAuthError('Admin account is locked due to multiple failed attempts', 'ADMIN_ACCOUNT_LOCKED', 423);
      }

      // 4. Vérifier le mot de passe avec bcrypt
      const isPasswordValid = await bcrypt.compare(loginData.password, account.password);
      if (!isPasswordValid) {
        await this.incrementAdminLoginAttempts(account);
        await this.logFailedLogin(account.username, ipAddress, userAgent, 'Invalid password');
        throw new AdminAuthError('Invalid admin credentials', 'INVALID_ADMIN_CREDENTIALS', 401);
      }

      // 5. Vérifier le 2FA si activé
      if (account.adminTwoFactorEnabled) {
        if (!loginData.twoFactorCode) {
          return {
            success: false,
            requiresTwoFactor: true,
            message: 'Two-factor authentication required for admin access'
          };
        }

        if (!this.verifyAdminTwoFactorCode(account, loginData.twoFactorCode)) {
          await this.incrementAdminLoginAttempts(account);
          await this.logFailedLogin(account.username, ipAddress, userAgent, 'Invalid admin 2FA code');
          throw new AdminAuthError('Invalid two-factor authentication code', 'INVALID_ADMIN_2FA', 401);
        }
      }

      // 6. Connexion réussie - créer la session admin
      const permissions = this.getEffectiveAdminPermissions(account);
      const session = createAdminSession(
        account.accountId,
        account.username,
        account.adminRole!,
        permissions,
        ipAddress
      );

      // 7. Mettre à jour les infos de connexion admin
      await this.updateAdminLastLogin(account, ipAddress);
      await this.resetAdminLoginAttempts(account);

      // 8. Logger la connexion admin réussie
      await this.createAuditLog({
        adminId: account.accountId,
        adminUsername: account.username,
        adminRole: account.adminRole!,
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
          adminId: account.accountId,
          username: account.username,
          role: account.adminRole!,
          permissions,
          email: account.email || '',
          lastLoginAt: account.adminLastLoginAt
        }
      };

    } catch (error) {
      if (error instanceof AdminAuthError) {
        throw error;
      }
      console.error('Admin login service error:', error);
      throw new AdminAuthError('Admin authentication service temporarily unavailable', 'SERVICE_ERROR', 503);
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
      const account = await Account.findOne({ accountId: adminId, adminEnabled: true });
      if (!account) return;

      // Révoquer la session
      const revoked = revokeAdminSession(sessionId);

      // Logger la déconnexion admin
      await this.createAuditLog({
        adminId: account.accountId,
        adminUsername: account.username,
        adminRole: account.adminRole!,
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
      console.error('Admin logout service error:', error);
    }
  }

  // ===== GESTION DES ADMINISTRATEURS =====

  /**
   * Promouvoir un compte existant en administrateur
   */
  static async promoteToAdmin(
    targetAccountId: string,
    adminRole: AdminRole,
    promotedBy: string,
    ipAddress: string,
    userAgent: string
  ): Promise<any> {
    try {
      // Récupérer le compte cible et le promoteur
      const [targetAccount, promoter] = await Promise.all([
        Account.findOne({ accountId: targetAccountId }),
        Account.findOne({ accountId: promotedBy, adminEnabled: true })
      ]);

      if (!targetAccount) {
        throw new Error('Target account not found');
      }

      if (!promoter || !promoter.isAdmin()) {
        throw new AdminAuthError('Promoter does not have admin privileges', 'NOT_ADMIN', 403);
      }

      // Vérifier les permissions du promoteur
      if (!promoter.canManageAdmin(adminRole)) {
        throw new AdminPermissionError(
          'Insufficient permissions to grant this admin role',
          'admin.create'
        );
      }

      // Promouvoir le compte
      await targetAccount.setAdminRole(adminRole, promotedBy);

      // Logger la promotion
      await this.createAuditLog({
        adminId: promotedBy,
        adminUsername: promoter.username,
        adminRole: promoter.adminRole!,
        action: 'admin.create_user',
        resource: 'admin_account',
        resourceId: targetAccountId,
        details: {
          additionalInfo: {
            promotedUser: targetAccount.username,
            grantedRole: adminRole,
            previousRole: targetAccount.adminRole || 'none'
          }
        },
        ipAddress,
        userAgent,
        success: true,
        severity: 'high'
      });

      return {
        accountId: targetAccount.accountId,
        username: targetAccount.username,
        adminRole: targetAccount.adminRole,
        adminEnabled: targetAccount.adminEnabled,
        promotedAt: new Date()
      };

    } catch (error) {
      if (error instanceof AdminPermissionError || error instanceof AdminAuthError) {
        throw error;
      }
      console.error('Promote to admin error:', error);
      throw new Error('Failed to promote account to admin');
    }
  }

  /**
   * Mettre à jour les permissions d'un administrateur
   */
  static async updateAdminPermissions(
    targetAdminId: string,
    updateData: { 
      adminRole?: AdminRole; 
      adminPermissions?: AdminPermission[];
      adminEnabled?: boolean;
    },
    updatedBy: string,
    ipAddress: string,
    userAgent: string
  ): Promise<any> {
    try {
      const [targetAccount, updater] = await Promise.all([
        Account.findOne({ accountId: targetAdminId, adminEnabled: true }),
        Account.findOne({ accountId: updatedBy, adminEnabled: true })
      ]);

      if (!targetAccount || !targetAccount.isAdmin()) {
        throw new Error('Target admin account not found');
      }

      if (!updater || !updater.isAdmin()) {
        throw new AdminAuthError('Updater does not have admin privileges', 'NOT_ADMIN', 403);
      }

      // Vérifier les permissions
      if (updateData.adminRole && !updater.canManageAdmin(updateData.adminRole)) {
        throw new AdminPermissionError(
          'Insufficient permissions to assign this admin role',
          'admin.change_permissions'
        );
      }

      if (!updater.canManageAdmin(targetAccount.adminRole!)) {
        throw new AdminPermissionError(
          'Insufficient permissions to modify this admin',
          'admin.manage'
        );
      }

      // Sauvegarder l'ancien état
      const oldState = {
        adminRole: targetAccount.adminRole,
        adminPermissions: targetAccount.adminPermissions,
        adminEnabled: targetAccount.adminEnabled
      };

      // Appliquer les modifications
      if (updateData.adminRole !== undefined) {
        targetAccount.adminRole = updateData.adminRole;
        // Réassigner les permissions par défaut si changement de rôle
        targetAccount.adminPermissions = DEFAULT_ROLE_PERMISSIONS[updateData.adminRole];
      }

      if (updateData.adminPermissions !== undefined) {
        targetAccount.adminPermissions = updateData.adminPermissions;
      }

      if (updateData.adminEnabled !== undefined) {
        targetAccount.adminEnabled = updateData.adminEnabled;
      }

      await targetAccount.save();

      // Logger la modification
      await this.createAuditLog({
        adminId: updatedBy,
        adminUsername: updater.username,
        adminRole: updater.adminRole!,
        action: 'admin.modify_permissions',
        resource: 'admin_account',
        resourceId: targetAdminId,
        details: {
          oldValue: oldState,
          newValue: {
            adminRole: targetAccount.adminRole,
            adminPermissions: targetAccount.adminPermissions,
            adminEnabled: targetAccount.adminEnabled
          },
          additionalInfo: {
            changes: this.calculateChanges(oldState, {
              adminRole: targetAccount.adminRole,
              adminPermissions: targetAccount.adminPermissions,
              adminEnabled: targetAccount.adminEnabled
            })
          }
        },
        ipAddress,
        userAgent,
        success: true,
        severity: 'critical'
      });

      return {
        accountId: targetAccount.accountId,
        username: targetAccount.username,
        adminRole: targetAccount.adminRole,
        adminPermissions: targetAccount.adminPermissions,
        adminEnabled: targetAccount.adminEnabled,
        updatedAt: new Date()
      };

    } catch (error) {
      if (error instanceof AdminPermissionError || error instanceof AdminAuthError) {
        throw error;
      }
      console.error('Update admin permissions error:', error);
      throw new Error('Failed to update admin permissions');
    }
  }

  /**
   * Révoquer les privilèges admin d'un compte
   */
  static async revokeAdminPrivileges(
    targetAdminId: string,
    revokedBy: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      const [targetAccount, revoker] = await Promise.all([
        Account.findOne({ accountId: targetAdminId, adminEnabled: true }),
        Account.findOne({ accountId: revokedBy, adminEnabled: true })
      ]);

      if (!targetAccount || !targetAccount.isAdmin()) {
        throw new Error('Target admin account not found');
      }

      if (!revoker || !revoker.isAdmin()) {
        throw new AdminAuthError('Revoker does not have admin privileges', 'NOT_ADMIN', 403);
      }

      // Vérifier les permissions
      if (!revoker.canManageAdmin(targetAccount.adminRole!)) {
        throw new AdminPermissionError(
          'Insufficient permissions to revoke admin privileges from this admin',
          'admin.delete'
        );
      }

      // Empêcher la révocation du dernier super_admin
      if (targetAccount.adminRole === 'super_admin') {
        const superAdminCount = await Account.countDocuments({ 
          adminRole: 'super_admin', 
          adminEnabled: true 
        });
        if (superAdminCount <= 1) {
          throw new Error('Cannot revoke privileges from the last super admin');
        }
      }

      // Sauvegarder les infos avant révocation
      const adminInfo = {
        username: targetAccount.username,
        adminRole: targetAccount.adminRole,
        adminPermissions: targetAccount.adminPermissions
      };

      // Révoquer les privilèges
      targetAccount.adminEnabled = false;
      targetAccount.adminRole = undefined;
      targetAccount.adminPermissions = undefined;
      targetAccount.adminTwoFactorEnabled = false;
      targetAccount.adminTwoFactorSecret = undefined;
      await targetAccount.save();

      // Logger la révocation
      await this.createAuditLog({
        adminId: revokedBy,
        adminUsername: revoker.username,
        adminRole: revoker.adminRole!,
        action: 'admin.delete_user',
        resource: 'admin_account',
        resourceId: targetAdminId,
        details: {
          oldValue: adminInfo,
          additionalInfo: {
            revokedUser: targetAccount.username
          }
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
      console.error('Revoke admin privileges error:', error);
      throw new Error('Failed to revoke admin privileges');
    }
  }

  // ===== RECHERCHE ET STATISTIQUES =====

  /**
   * Rechercher des administrateurs
   */
  static async searchAdmins(filter: IAdminFilter): Promise<{
    admins: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const query: any = { adminEnabled: true };

      // Construire la requête
      if (filter.role) query.adminRole = filter.role;
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

      const [accounts, total] = await Promise.all([
        Account.find(query)
          .select('accountId username email adminRole adminPermissions adminLastLoginAt createdAt adminEnabled')
          .sort({ [sortField]: sortOrder })
          .skip(skip)
          .limit(limit)
          .exec(),
        Account.countDocuments(query)
      ]);

      const admins = accounts.map(account => ({
        adminId: account.accountId,
        username: account.username,
        email: account.email,
        role: account.adminRole,
        permissions: account.adminPermissions,
        lastLoginAt: account.adminLastLoginAt,
        createdAt: (account as any).createdAt,
        isActive: account.adminEnabled
      }));

      return { admins, total, page, limit };

    } catch (error) {
      console.error('Search admins error:', error);
      throw new Error('Failed to search admin accounts');
    }
  }

  /**
   * Obtenir les statistiques des administrateurs
   */
  static async getAdminStats(): Promise<IAdminStatsResponse> {
    try {
      const [stats, sessionStats] = await Promise.all([
        Account.aggregate([
          { $match: { adminEnabled: true } },
          {
            $group: {
              _id: '$adminRole',
              count: { $sum: 1 },
              recentLogins: {
                $sum: {
                  $cond: [
                    { 
                      $gte: ['$adminLastLoginAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]),
        getSessionStats()
      ]);

      const byRole = stats.reduce((acc: any, stat: any) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {
        super_admin: 0,
        admin: 0,
        moderator: 0,
        viewer: 0
      });

      // Calculer les connexions récentes
      const recentLogins = stats.reduce((total: number, stat: any) => {
        return total + stat.recentLogins;
      }, 0);

      // Compter les échecs de connexion admin récents
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const failedLogins = await AuditLog.countDocuments({
        action: 'admin.failed_login',
        timestamp: { $gte: cutoff }
      });

      const totalAdmins = Object.values(byRole).reduce((sum: number, count: any) => sum + count, 0);

      return {
        totalAdmins,
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
   * Détecter les activités suspectes des admins
   */
  static async detectSuspiciousActivity(hours: number = 24): Promise<ISecurityAlert[]> {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      const alerts: ISecurityAlert[] = [];

      // 1. Échecs de connexion admin multiples depuis la même IP
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
          details: `${item.count} failed admin login attempts from IP ${item._id}`,
          severity: item.count > 10 ? 'critical' : 'high'
        });
      });

      // 2. Actions admin critiques récentes
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
          details: `Critical admin action: ${log.action} on ${log.resource}`,
          severity: 'high'
        });
      });

      // 3. Nouvelles promotions admin récentes
      const adminPromotions = await AuditLog.find({
        action: 'admin.create_user',
        timestamp: { $gte: cutoff }
      });

      adminPromotions.forEach(log => {
        alerts.push({
          type: 'unusual_activity',
          adminId: log.adminId,
          adminUsername: log.adminUsername,
          ipAddress: log.ipAddress,
          timestamp: log.timestamp,
          details: `New admin account promoted: ${log.details?.additionalInfo?.promotedUser}`,
          severity: 'medium'
        });
      });

      return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    } catch (error) {
      console.error('Detect suspicious admin activity error:', error);
      return [];
    }
  }

  // ===== MÉTHODES UTILITAIRES PRIVÉES =====

  /**
   * Créer un log d'audit
   */
  private static async createAuditLog(logData: any): Promise<void> {
    try {
      await AuditLog.createLog(logData);
    } catch (error) {
      console.error('Failed to create admin audit log:', error);
    }
  }

  /**
   * Logger un échec de connexion admin
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
      details: { additionalInfo: { reason } },
      ipAddress,
      userAgent,
      success: false,
      severity: 'medium'
    });
  }

  /**
   * Vérifier si un compte admin est verrouillé
   */
  private static isAdminLocked(account: any): boolean {
    return !!(account.adminLockedUntil && account.adminLockedUntil > new Date());
  }

  /**
   * Incrémenter les tentatives de connexion admin
   */
  private static async incrementAdminLoginAttempts(account: any): Promise<void> {
    const maxAttempts = 5;
    const lockTimeMs = 30 * 60 * 1000; // 30 minutes

    account.adminLoginAttempts = (account.adminLoginAttempts || 0) + 1;

    if (account.adminLoginAttempts >= maxAttempts) {
      account.adminLockedUntil = new Date(Date.now() + lockTimeMs);
    }

    await account.save();
  }

  /**
   * Réinitialiser les tentatives de connexion admin
   */
  private static async resetAdminLoginAttempts(account: any): Promise<void> {
    account.adminLoginAttempts = 0;
    account.adminLockedUntil = undefined;
    await account.save();
  }

  /**
   * Mettre à jour la dernière connexion admin
   */
  private static async updateAdminLastLogin(account: any, ipAddress: string): Promise<void> {
    account.adminLastLoginAt = new Date();
    await account.save();
  }

  /**
   * Obtenir les permissions effectives d'un admin
   */
  private static getEffectiveAdminPermissions(account: any): AdminPermission[] {
    if (account.adminPermissions?.includes('*')) {
      return ['*'];
    }
    
    const rolePermissions = DEFAULT_ROLE_PERMISSIONS[account.adminRole as AdminRole] || [];
    const customPermissions = account.adminPermissions || [];
    
    return [...new Set([...rolePermissions, ...customPermissions])];
  }

  /**
   * Vérifier le code 2FA admin (implémentation basique)
   */
  private static verifyAdminTwoFactorCode(account: any, code: string): boolean {
    if (!account.adminTwoFactorEnabled || !account.adminTwoFactorSecret) {
      return false;
    }
    
    // Implémentation simple pour l'exemple
    const expectedCode = Math.floor(Date.now() / 30000).toString().substr(-6);
    return code === expectedCode;
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

  // ===== MÉTHODES PUBLIQUES UTILITAIRES =====

  /**
   * Obtenir un admin par ID
   */
  static async getAdminById(adminId: string): Promise<any | null> {
    try {
      const account = await Account.findOne({ 
        accountId: adminId, 
        adminEnabled: true 
      }).select('accountId username email adminRole adminPermissions adminLastLoginAt createdAt');

      if (!account || !account.isAdmin()) {
        return null;
      }

      return {
        adminId: account.accountId,
        username: account.username,
        email: account.email,
        role: account.adminRole,
        permissions: this.getEffectiveAdminPermissions(account),
        lastLoginAt: account.adminLastLoginAt,
        createdAt: (account as any).createdAt,
        getAccountSummary: () => ({
          adminId: account.accountId,
          username: account.username,
          email: account.email,
          role: account.adminRole,
          permissions: this.getEffectiveAdminPermissions(account),
          isActive: account.adminEnabled,
          isLocked: this.isAdminLocked(account),
          lastLoginAt: account.adminLastLoginAt,
          createdAt: account.createdAt
        })
      };
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
      const account = await Account.findOne({ accountId: adminId, adminEnabled: true });
      return account ? account.hasAdminPermission(permission) : false;
    } catch (error) {
      console.error('Check admin permission error:', error);
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
      const [targetAccount, resetter] = await Promise.all([
        Account.findOne({ accountId: targetAdminId, adminEnabled: true }),
        Account.findOne({ accountId: resetBy, adminEnabled: true })
      ]);

      if (!targetAccount || !resetter) {
        throw new Error('Admin account not found');
      }

      if (!resetter.canManageAdmin(targetAccount.adminRole!)) {
        throw new AdminPermissionError(
          'Insufficient permissions to reset admin password',
          'admin.manage'
        );
      }

      // Hash et sauvegarder le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      targetAccount.password = hashedPassword;
      if (!targetAccount.adminMetadata) targetAccount.adminMetadata = {};
      targetAccount.adminMetadata.lastPasswordChange = new Date();
      await targetAccount.save();

      // Logger l'action
      await this.createAuditLog({
        adminId: resetBy,
        adminUsername: resetter.username,
        adminRole: resetter.adminRole!,
        action: 'admin.password_change',
        resource: 'admin_account',
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
      console.error('Reset admin password error:', error);
      throw new Error('Failed to reset admin password');
    }
  }
}

export default AdminService;

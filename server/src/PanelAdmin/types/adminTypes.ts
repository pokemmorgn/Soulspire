import { Request } from 'express';

// ===== TYPES PRINCIPAUX =====

export interface IAdminUser {
  adminId: string;
  accountId?: string; // Lien vers un compte de jeu (optionnel)
  username: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
  isActive: boolean;
  lastLoginAt?: Date;
  lastLoginIP?: string;
  loginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  createdBy: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
}

export interface IAdminSession {
  sessionId: string;
  adminId: string;
  role: AdminRole;
  permissions: AdminPermission[];
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface IAuditLog {
  logId: string;
  adminId: string;
  adminUsername: string;
  action: AdminAction;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress: string;
  userAgent: string;
  serverId?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

// ===== TYPES ÉNUMÉRÉS =====

export type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'viewer';

export type AdminPermission = 
  // Serveur et système
  | 'server.manage'
  | 'server.restart'
  | 'server.config'
  | 'system.config'
  | 'system.backup'
  | 'system.logs'
  
  // Gestion des joueurs
  | 'player.view'
  | 'player.manage'
  | 'player.moderate'
  | 'player.ban'
  | 'player.unban'
  | 'player.edit'
  | 'player.delete'
  
  // Économie et monnaies
  | 'economy.view'
  | 'economy.modify'
  | 'economy.add_currency'
  | 'economy.remove_currency'
  | 'economy.transaction_history'
  
  // Héros et collection
  | 'heroes.view'
  | 'heroes.manage'
  | 'heroes.add'
  | 'heroes.remove'
  | 'heroes.modify_stats'
  
  // Événements et contenu
  | 'events.view'
  | 'events.manage'
  | 'events.create'
  | 'events.delete'
  
  // Boutiques et gacha
  | 'shop.view'
  | 'shop.manage'
  | 'gacha.view'
  | 'gacha.modify_rates'
  
  // Analytics et rapports
  | 'analytics.view'
  | 'analytics.export'
  | 'analytics.financial'
  
  // Gestion des admins
  | 'admin.view'
  | 'admin.manage'
  | 'admin.create'
  | 'admin.delete'
  | 'admin.change_permissions'
  
  // Actions spéciales
  | '*'; // Super-admin seulement

export type AdminAction =
  // Authentification
  | 'admin.login'
  | 'admin.logout'
  | 'admin.failed_login'
  | 'admin.password_change'
  | 'admin.2fa_enable'
  | 'admin.2fa_disable'
  
  // Gestion des joueurs
  | 'player.view_details'
  | 'player.ban'
  | 'player.unban'
  | 'player.edit_profile'
  | 'player.add_currency'
  | 'player.remove_currency'
  | 'player.add_hero'
  | 'player.remove_hero'
  | 'player.modify_progress'
  | 'player.reset_account'
  | 'player.delete_account'
  
  // Économie
  | 'economy.view_transactions'
  | 'economy.modify_shop'
  | 'economy.create_promo_code'
  | 'economy.disable_promo_code'
  
  // Système
  | 'system.view_logs'
  | 'system.modify_config'
  | 'system.create_backup'
  | 'system.restore_backup'
  | 'system.server_restart'
  
  // Événements
  | 'event.create'
  | 'event.modify'
  | 'event.delete'
  | 'event.start'
  | 'event.stop'
  
  // Analytics
  | 'analytics.view_dashboard'
  | 'analytics.export_data'
  | 'analytics.view_financial'
  
  // Gestion des admins
  | 'admin.create_user'
  | 'admin.delete_user'
  | 'admin.modify_permissions'
  | 'admin.view_audit_logs';

// ===== INTERFACES POUR REQUESTS =====

export interface IAuthenticatedAdminRequest extends Request {
  admin: {
    adminId: string;
    username: string;
    role: AdminRole;
    permissions: AdminPermission[];
    sessionId: string;
  };
}

export interface ILoginRequest {
  username: string;
  password: string;
  twoFactorCode?: string;
}

export interface ICreateAdminRequest {
  username: string;
  email: string;
  password: string;
  role: AdminRole;
  accountId?: string; // Optionnel : lier à un compte de jeu
}

export interface IUpdateAdminRequest {
  role?: AdminRole;
  isActive?: boolean;
  permissions?: AdminPermission[];
}

// ===== INTERFACES POUR RESPONSES =====

export interface ILoginResponse {
  success: boolean;
  token?: string;
  adminUser?: {
    adminId: string;
    username: string;
    role: AdminRole;
    permissions: AdminPermission[];
    email: string;
    lastLoginAt?: Date;
  };
  requiresTwoFactor?: boolean;
  message?: string;
}

export interface IAdminStatsResponse {
  totalAdmins: number;
  activeAdmins: number;
  adminsByRole: Record<AdminRole, number>;
  recentLogins: number;
  failedLogins: number;
}

export interface ISecurityAlert {
  type: 'suspicious_login' | 'multiple_failures' | 'permission_escalation' | 'unusual_activity';
  adminId: string;
  adminUsername: string;
  ipAddress: string;
  timestamp: Date;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ===== INTERFACES POUR FILTERING ET PAGINATION =====

export interface IPaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IAdminFilter extends IPaginationQuery {
  role?: AdminRole;
  isActive?: boolean;
  username?: string;
  email?: string;
}

export interface IAuditLogFilter extends IPaginationQuery {
  adminId?: string;
  action?: AdminAction;
  success?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  ipAddress?: string;
  serverId?: string;
}

// ===== VALIDATION HELPERS =====

export const ADMIN_ROLE_HIERARCHY: Record<AdminRole, number> = {
  'viewer': 1,
  'moderator': 2,
  'admin': 3,
  'super_admin': 4
};

export const DEFAULT_ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  'viewer': [
    'analytics.view',
    'economy.view',
    'player.view'
  ],
  'moderator': [
    'analytics.view',
    'economy.view',
    'player.view',
    'player.moderate',
    'player.ban'
  ],
  'admin': [
    'analytics.view',
    'analytics.export',
    'economy.view',
    'economy.modify',
    'player.view',
    'player.manage',
    'player.moderate',
    'player.ban',
    'player.edit',
    'events.view',
    'events.manage',
    'heroes.view',
    'heroes.manage',
    'shop.view',
    'shop.manage'
  ],
  'super_admin': ['*']
};

// ===== UTILITY TYPES =====

export interface IRateLimitInfo {
  windowMs: number;
  maxRequests: number;
  currentRequests: number;
  resetTime: Date;
}

export interface ISecurityConfig {
  maxLoginAttempts: number;
  lockoutDuration: number; // en minutes
  sessionDuration: number; // en heures
  requireTwoFactor: boolean;
  allowedIPs: string[];
  passwordMinLength: number;
  passwordRequireSpecialChars: boolean;
}

// ===== CONSTANTS =====

export const SENSITIVE_ACTIONS: AdminAction[] = [
  'player.delete_account',
  'player.reset_account',
  'economy.remove_currency',
  'admin.delete_user',
  'admin.modify_permissions',
  'system.server_restart',
  'system.restore_backup'
];

export const HIGH_PRIVILEGE_PERMISSIONS: AdminPermission[] = [
  'server.manage',
  'server.restart',
  'system.config',
  'player.delete',
  'admin.manage',
  'admin.create',
  'admin.delete',
  '*'
];

// ===== ERROR TYPES =====

export interface IAdminError extends Error {
  code: string;
  statusCode: number;
  details?: any;
}

export class AdminAuthError extends Error implements IAdminError {
  code: string;
  statusCode: number;
  details?: any;

  constructor(message: string, code: string, statusCode: number = 401, details?: any) {
    super(message);
    this.name = 'AdminAuthError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class AdminPermissionError extends Error implements IAdminError {
  code: string;
  statusCode: number;
  details?: any;

  constructor(message: string, requiredPermission: AdminPermission, statusCode: number = 403) {
    super(message);
    this.name = 'AdminPermissionError';
    this.code = 'INSUFFICIENT_PERMISSIONS';
    this.statusCode = statusCode;
    this.details = { requiredPermission };
  }
}

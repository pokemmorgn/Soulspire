import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { IdGenerator } from '../../utils/idGenerator';
import {
  IAdminUser,
  AdminRole,
  AdminPermission,
  DEFAULT_ROLE_PERMISSIONS,
  ADMIN_ROLE_HIERARCHY
} from '../types/adminTypes';

// Interface pour le document Mongoose
export interface IAdminDocument extends Document, IAdminUser {
  _id: string;
  
  // Méthodes d'instance
  comparePassword(candidatePassword: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
  incrementLoginAttempts(): Promise<IAdminDocument>;
  resetLoginAttempts(): Promise<IAdminDocument>;
  lockAccount(): Promise<IAdminDocument>;
  unlockAccount(): Promise<IAdminDocument>;
  isLocked(): boolean;
  updateLastLogin(ipAddress: string): Promise<IAdminDocument>;
  hasPermission(permission: AdminPermission): boolean;
  canManageAdmin(targetAdminRole: AdminRole): boolean;
  getEffectivePermissions(): AdminPermission[];
  generateTwoFactorSecret(): string;
  verifyTwoFactorCode(code: string): boolean;
  getAccountSummary(): any;
}

// Schéma principal
const adminSchema = new Schema<IAdminDocument>({
  _id: {
    type: String,
    required: true,
    default: () => IdGenerator.generateUUID()
  },
  adminId: {
    type: String,
    required: true,
    unique: true,
    default: function(this: IAdminDocument) { 
      return this._id; 
    }
  },
  accountId: {
    type: String,
    sparse: true,
    index: true,
    validate: {
      validator: function(v: string) {
        // Valider que c'est un ID de compte valide si fourni
        return !v || v.startsWith('ACC_');
      },
      message: 'Invalid account ID format'
    }
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_-]+$/,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false // Ne pas inclure par défaut dans les requêtes
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator', 'viewer'],
    default: 'viewer',
    required: true,
    index: true
  },
  permissions: [{
    type: String,
    enum: [
      // Serveur et système
      'server.manage', 'server.restart', 'server.config', 'system.config', 
      'system.backup', 'system.logs',
      // Gestion des joueurs
      'player.view', 'player.manage', 'player.moderate', 'player.ban', 
      'player.unban', 'player.edit', 'player.delete',
      // Économie
      'economy.view', 'economy.modify', 'economy.add_currency', 
      'economy.remove_currency', 'economy.transaction_history',
      // Héros
      'heroes.view', 'heroes.manage', 'heroes.add', 'heroes.remove', 'heroes.modify_stats',
      // Événements
      'events.view', 'events.manage', 'events.create', 'events.delete',
      // Boutiques et gacha
      'shop.view', 'shop.manage', 'gacha.view', 'gacha.modify_rates',
      // Analytics
      'analytics.view', 'analytics.export', 'analytics.financial',
      // Gestion des admins
      'admin.view', 'admin.manage', 'admin.create', 'admin.delete', 'admin.change_permissions',
      // Super-admin
      '*'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastLoginAt: {
    type: Date,
    index: true
  },
  lastLoginIP: {
    type: String,
    match: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^::1$|^127\.0\.0\.1$/
  },
  loginAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  lockedUntil: {
    type: Date,
    index: true
  },
  createdBy: {
    type: String,
    required: true,
    default: 'system'
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false // Sensible, ne pas inclure par défaut
  },
  
  // Métadonnées supplémentaires
  metadata: {
    createdByIP: String,
    lastPasswordChange: { type: Date, default: Date.now },
    failedLoginIPs: [String],
    preferredLanguage: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' }
  }
}, {
  timestamps: true,
  collection: 'admin_users',
  _id: false
});

// ===== HOOKS PRE-SAVE =====

// Hash du mot de passe avant sauvegarde
adminSchema.pre('save', async function(next) {
  // Synchroniser adminId avec _id
  if (!this.adminId || this.adminId !== this._id) {
    this.adminId = this._id;
  }

  // Hash du mot de passe si modifié
  if (this.isModified('password')) {
    try {
      this.password = await this.hashPassword(this.password);
      this.metadata.lastPasswordChange = new Date();
    } catch (error) {
      return next(error as Error);
    }
  }

  // Assigner les permissions par défaut selon le rôle si pas définies
  if (this.isModified('role') && (!this.permissions || this.permissions.length === 0)) {
    this.permissions = DEFAULT_ROLE_PERMISSIONS[this.role];
  }

  next();
});

// ===== INDEX =====

adminSchema.index({ _id: 1 }, { unique: true });
adminSchema.index({ adminId: 1 }, { unique: true });
adminSchema.index({ username: 1 }, { unique: true });
adminSchema.index({ email: 1 }, { unique: true });
adminSchema.index({ role: 1, isActive: 1 });
adminSchema.index({ lastLoginAt: -1 });
adminSchema.index({ lockedUntil: 1 }, { sparse: true });
adminSchema.index({ 'metadata.createdByIP': 1 });

// Index pour recherche par permissions
adminSchema.index({ permissions: 1 });

// ===== MÉTHODES STATIQUES =====

adminSchema.statics.findByUsername = function(username: string) {
  return this.findOne({ username: username.toLowerCase(), isActive: true });
};

adminSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

adminSchema.statics.findActiveAdmins = function() {
  return this.find({ isActive: true }).select('-password -twoFactorSecret');
};

adminSchema.statics.findByRole = function(role: AdminRole) {
  return this.find({ role, isActive: true }).select('-password -twoFactorSecret');
};

adminSchema.statics.getAdminStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        active: { 
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        recentLogins: {
          $sum: {
            $cond: [
              { 
                $gte: ['$lastLoginAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  const totalStats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        locked: {
          $sum: {
            $cond: [
              { $gt: ['$lockedUntil', new Date()] },
              1,
              0
            ]
          }
        },
        withTwoFactor: {
          $sum: {
            $cond: [{ $eq: ['$twoFactorEnabled', true] }, 1, 0]
          }
        }
      }
    }
  ]);

  return {
    byRole: stats,
    summary: totalStats[0] || { total: 0, locked: 0, withTwoFactor: 0 }
  };
};

// ===== MÉTHODES D'INSTANCE =====

adminSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

adminSchema.methods.hashPassword = async function(password: string): Promise<string> {
  const saltRounds = 12; // Fort niveau de sécurité
  return await bcrypt.hash(password, saltRounds);
};

adminSchema.methods.incrementLoginAttempts = function(): Promise<IAdminDocument> {
  // Si le compte était verrouillé et que le verrou a expiré, le réinitialiser
  if (this.lockedUntil && this.lockedUntil < new Date()) {
    return this.updateOne({
      $unset: { lockedUntil: 1 },
      $set: { loginAttempts: 1 }
    }).exec();
  }

  const updates: any = { $inc: { loginAttempts: 1 } };
  
  // Verrouiller si trop de tentatives (configurable)
  const maxAttempts = 5;
  const lockTimeMs = 30 * 60 * 1000; // 30 minutes

  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockedUntil: new Date(Date.now() + lockTimeMs) };
  }

  return this.updateOne(updates).exec();
};

adminSchema.methods.resetLoginAttempts = function(): Promise<IAdminDocument> {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockedUntil: 1
    }
  }).exec();
};

adminSchema.methods.lockAccount = function(): Promise<IAdminDocument> {
  const lockTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  return this.updateOne({
    $set: { 
      lockedUntil: lockTime,
      loginAttempts: 999 // Marquer comme verrouillé manuellement
    }
  }).exec();
};

adminSchema.methods.unlockAccount = function(): Promise<IAdminDocument> {
  return this.updateOne({
    $unset: {
      lockedUntil: 1,
      loginAttempts: 1
    }
  }).exec();
};

adminSchema.methods.isLocked = function(): boolean {
  return !!(this.lockedUntil && this.lockedUntil > new Date());
};

adminSchema.methods.updateLastLogin = function(ipAddress: string): Promise<IAdminDocument> {
  return this.updateOne({
    $set: {
      lastLoginAt: new Date(),
      lastLoginIP: ipAddress
    },
    $unset: {
      loginAttempts: 1,
      lockedUntil: 1
    }
  }).exec();
};

adminSchema.methods.hasPermission = function(permission: AdminPermission): boolean {
  // Super admin a tout
  if (this.permissions.includes('*')) {
    return true;
  }
  
  return this.permissions.includes(permission);
};

adminSchema.methods.canManageAdmin = function(targetAdminRole: AdminRole): boolean {
  // Seuls les super_admin peuvent gérer d'autres super_admin
  if (targetAdminRole === 'super_admin') {
    return this.role === 'super_admin';
  }
  
  // Un admin peut gérer les rôles inférieurs
  const currentLevel = ADMIN_ROLE_HIERARCHY[this.role];
  const targetLevel = ADMIN_ROLE_HIERARCHY[targetAdminRole];
  
  return currentLevel > targetLevel;
};

adminSchema.methods.getEffectivePermissions = function(): AdminPermission[] {
  if (this.permissions.includes('*')) {
    return ['*'];
  }
  
  // Combiner les permissions du rôle et les permissions personnalisées
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[this.role] || [];
  const customPermissions = this.permissions || [];
  
  // Supprimer les doublons
  return [...new Set([...rolePermissions, ...customPermissions])];
};

adminSchema.methods.generateTwoFactorSecret = function(this: IAdminDocument): string {
  // Pour la simplicité, on génère un secret basique
  // En production, utiliser une vraie librairie 2FA comme speakeasy
  const secret = require('crypto').randomBytes(32).toString('base64');
  this.twoFactorSecret = secret;
  return secret;
};

adminSchema.methods.verifyTwoFactorCode = function(this: IAdminDocument, code: string): boolean {
  // Implémentation basique pour l'exemple
  // En production, utiliser speakeasy ou similar
  if (!this.twoFactorEnabled || !this.twoFactorSecret) {
    return false;
  }
  
  // Pour l'instant, accepter un code simple basé sur le timestamp
  const expectedCode = Math.floor(Date.now() / 30000).toString().substr(-6);
  return code === expectedCode;
};

adminSchema.methods.getAccountSummary = function(this: IAdminDocument) {
  return {
    adminId: this.adminId,
    username: this.username,
    email: this.email,
    role: this.role,
    permissions: this.getEffectivePermissions(),
    isActive: this.isActive,
    isLocked: this.isLocked(),
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    twoFactorEnabled: this.twoFactorEnabled,
    metadata: {
      accountAge: this.createdAt ? Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      daysSinceLastLogin: this.lastLoginAt ? Math.floor((Date.now() - this.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24)) : null,
      loginAttemptsCount: this.loginAttempts || 0
    }
  };
};

// ===== VALIDATION PERSONNALISÉE =====

adminSchema.path('email').validate(async function(email: string) {
  if (!this.isNew && !this.isModified('email')) return true;
  
  const emailCount = await (this.constructor as any).countDocuments({ 
    email, 
    _id: { $ne: this._id } 
  });
  return !emailCount;
}, 'Email already exists');

adminSchema.path('username').validate(async function(username: string) {
  if (!this.isNew && !this.isModified('username')) return true;
  
  const usernameCount = await (this.constructor as any).countDocuments({ 
    username, 
    _id: { $ne: this._id } 
  });
  return !usernameCount;
}, 'Username already exists');

// Export du modèle
export default mongoose.model<IAdminDocument>('Admin', adminSchema);

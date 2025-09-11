import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { IdGenerator } from '../../utils/idGenerator';
import {
  AdminRole,
  AdminPermission,
  DEFAULT_ROLE_PERMISSIONS,
  ADMIN_ROLE_HIERARCHY
} from '../types/adminTypes';

// Interface pour les métadonnées
interface IAdminMetadata {
  createdByIP?: string;
  lastPasswordChange?: Date;
  failedLoginIPs?: string[];
  preferredLanguage?: string;
  timezone?: string;
}

// Interface principale du document
export interface IAdminDocument extends Document {
  _id: string;
  adminId: string;
  accountId?: string;
  username: string;
  email: string;
  password: string;
  role: AdminRole;
  permissions: AdminPermission[];
  isActive: boolean;
  lastLoginAt?: Date;
  lastLoginIP?: string;
  loginAttempts: number;
  lockedUntil?: Date;
  createdBy: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  metadata: IAdminMetadata;
  createdAt: Date;
  updatedAt: Date;

  // Méthodes d'instance
  comparePassword(candidatePassword: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  lockAccount(): Promise<void>;
  unlockAccount(): Promise<void>;
  isLocked(): boolean;
  updateLastLogin(ipAddress: string): Promise<void>;
  hasPermission(permission: AdminPermission): boolean;
  canManageAdmin(targetAdminRole: AdminRole): boolean;
  getEffectivePermissions(): AdminPermission[];
  generateTwoFactorSecret(): string;
  verifyTwoFactorCode(code: string): boolean;
  getAccountSummary(): any;
}

// Interface pour les méthodes statiques
interface IAdminModel extends Model<IAdminDocument> {
  findByUsername(username: string): Promise<IAdminDocument | null>;
  findByEmail(email: string): Promise<IAdminDocument | null>;
  findActiveAdmins(): Promise<IAdminDocument[]>;
  findByRole(role: AdminRole): Promise<IAdminDocument[]>;
  getAdminStats(): Promise<any>;
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
    unique: true
  },
  accountId: {
    type: String,
    sparse: true,
    index: true,
    validate: {
      validator: function(v: string) {
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
    select: false
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
      'server.manage', 'server.restart', 'server.config', 'system.config', 
      'system.backup', 'system.logs', 'player.view', 'player.manage', 
      'player.moderate', 'player.ban', 'player.unban', 'player.edit', 
      'player.delete', 'economy.view', 'economy.modify', 'economy.add_currency', 
      'economy.remove_currency', 'economy.transaction_history', 'heroes.view', 
      'heroes.manage', 'heroes.add', 'heroes.remove', 'heroes.modify_stats',
      'events.view', 'events.manage', 'events.create', 'events.delete',
      'shop.view', 'shop.manage', 'gacha.view', 'gacha.modify_rates',
      'analytics.view', 'analytics.export', 'analytics.financial',
      'admin.view', 'admin.manage', 'admin.create', 'admin.delete', 
      'admin.change_permissions', '*'
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
    type: String
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
    select: false
  },
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

// ===== PRE-SAVE HOOK =====
adminSchema.pre<IAdminDocument>('save', async function(next) {
  try {
    // Synchroniser adminId avec _id
    if (!this.adminId || this.adminId !== this._id) {
      this.adminId = this._id;
    }

    // Hash du mot de passe si modifié
    if (this.isModified('password')) {
      const saltRounds = 12;
      this.password = await bcrypt.hash(this.password, saltRounds);
      if (!this.metadata) {
        this.metadata = {};
      }
      this.metadata.lastPasswordChange = new Date();
    }

    // Assigner les permissions par défaut selon le rôle
    if (this.isModified('role') && (!this.permissions || this.permissions.length === 0)) {
      this.permissions = DEFAULT_ROLE_PERMISSIONS[this.role] || [];
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

// ===== INDEX =====
adminSchema.index({ _id: 1 }, { unique: true });
adminSchema.index({ adminId: 1 }, { unique: true });
adminSchema.index({ username: 1 }, { unique: true });
adminSchema.index({ email: 1 }, { unique: true });
adminSchema.index({ role: 1, isActive: 1 });
adminSchema.index({ lastLoginAt: -1 });
adminSchema.index({ lockedUntil: 1 }, { sparse: true });
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
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

adminSchema.methods.incrementLoginAttempts = async function(): Promise<void> {
  const updates: any = { $inc: { loginAttempts: 1 } };
  
  // Verrouiller si trop de tentatives
  const maxAttempts = 5;
  const lockTimeMs = 30 * 60 * 1000; // 30 minutes

  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockedUntil: new Date(Date.now() + lockTimeMs) };
  }

  await this.updateOne(updates);
};

adminSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  await this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockedUntil: 1
    }
  });
};

adminSchema.methods.lockAccount = async function(): Promise<void> {
  const lockTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await this.updateOne({
    $set: { 
      lockedUntil: lockTime,
      loginAttempts: 999
    }
  });
};

adminSchema.methods.unlockAccount = async function(): Promise<void> {
  await this.updateOne({
    $unset: {
      lockedUntil: 1,
      loginAttempts: 1
    }
  });
};

adminSchema.methods.isLocked = function(): boolean {
  return !!(this.lockedUntil && this.lockedUntil > new Date());
};

adminSchema.methods.updateLastLogin = async function(ipAddress: string): Promise<void> {
  await this.updateOne({
    $set: {
      lastLoginAt: new Date(),
      lastLoginIP: ipAddress
    },
    $unset: {
      loginAttempts: 1,
      lockedUntil: 1
    }
  });
};

adminSchema.methods.hasPermission = function(permission: AdminPermission): boolean {
  if (this.permissions.includes('*')) {
    return true;
  }
  return this.permissions.includes(permission);
};

adminSchema.methods.canManageAdmin = function(targetAdminRole: AdminRole): boolean {
  if (targetAdminRole === 'super_admin') {
    return this.role === 'super_admin';
  }
  
  const currentLevel = ADMIN_ROLE_HIERARCHY[this.role];
  const targetLevel = ADMIN_ROLE_HIERARCHY[targetAdminRole];
  
  return currentLevel > targetLevel;
};

adminSchema.methods.getEffectivePermissions = function(): AdminPermission[] {
  if (this.permissions.includes('*')) {
    return ['*'];
  }
  
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[this.role] || [];
  const customPermissions = this.permissions || [];
  
  return [...new Set([...rolePermissions, ...customPermissions])];
};

adminSchema.methods.generateTwoFactorSecret = function(): string {
  const crypto = require('crypto');
  const secret = crypto.randomBytes(32).toString('base64');
  this.twoFactorSecret = secret;
  return secret;
};

adminSchema.methods.verifyTwoFactorCode = function(code: string): boolean {
  if (!this.twoFactorEnabled || !this.twoFactorSecret) {
    return false;
  }
  
  // Implémentation simple pour l'exemple
  const expectedCode = Math.floor(Date.now() / 30000).toString().substr(-6);
  return code === expectedCode;
};

adminSchema.methods.getAccountSummary = function() {
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

// ===== VALIDATION CUSTOM =====
adminSchema.path('email').validate(async function(email: string) {
  if (!this.isNew && !this.isModified('email')) return true;
  
  const emailCount = await mongoose.model('Admin').countDocuments({ 
    email, 
    _id: { $ne: this._id } 
  });
  return !emailCount;
}, 'Email already exists');

adminSchema.path('username').validate(async function(username: string) {
  if (!this.isNew && !this.isModified('username')) return true;
  
  const usernameCount = await mongoose.model('Admin').countDocuments({ 
    username, 
    _id: { $ne: this._id } 
  });
  return !usernameCount;
}, 'Username already exists');

// Export du modèle
const Admin = mongoose.model<IAdminDocument, IAdminModel>('Admin', adminSchema);
export default Admin;

import mongoose, { Document, Schema, Model } from 'mongoose';
import { IdGenerator } from '../../utils/idGenerator';
import {
  AdminAction,
  AdminRole,
  IAuditLogFilter
} from '../types/adminTypes';

// Interface pour les détails de l'action (flexible)
interface IActionDetails {
  oldValue?: any;
  newValue?: any;
  affectedFields?: string[];
  additionalInfo?: any;
  requestBody?: any;
  responseCode?: number;
  duration?: number; // en ms
  targetUserId?: string;
  targetUsername?: string;
  changes?: Record<string, { from: any; to: any }>;
}

// Interface principale du document
export interface IAuditLogDocument extends Document {
  _id: string;
  logId: string;
  adminId: string;
  adminUsername: string;
  adminRole: AdminRole;
  action: AdminAction;
  resource: string;
  resourceId?: string;
  details?: IActionDetails;
  ipAddress: string;
  userAgent: string;
  serverId?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  sessionId?: string;
  
  // Méthodes d'instance
  isCriticalAction(): boolean;
  getReadableDescription(): string;
  anonymize(): IAuditLogDocument;
}

// Interface pour les méthodes statiques
interface IAuditLogModel extends Model<IAuditLogDocument> {
  createLog(logData: Partial<IAuditLogDocument>): Promise<IAuditLogDocument>;
  findByAdmin(adminId: string, limit?: number): Promise<IAuditLogDocument[]>;
  findByAction(action: AdminAction, limit?: number): Promise<IAuditLogDocument[]>;
  findByResource(resource: string, resourceId?: string): Promise<IAuditLogDocument[]>;
  findCriticalActions(hours?: number): Promise<IAuditLogDocument[]>;
  findFailedActions(hours?: number): Promise<IAuditLogDocument[]>;
  getSecuritySummary(hours?: number): Promise<any>;
  getAdminActivity(adminId: string, hours?: number): Promise<any>;
  searchLogs(filter: IAuditLogFilter): Promise<{ logs: IAuditLogDocument[], total: number }>;
  cleanupOldLogs(retentionDays: number): Promise<number>;
  getSystemHealth(): Promise<any>;
}

// Schéma pour les détails de l'action
const actionDetailsSchema = new Schema<IActionDetails>({
  oldValue: Schema.Types.Mixed,
  newValue: Schema.Types.Mixed,
  affectedFields: [String],
  additionalInfo: Schema.Types.Mixed,
  requestBody: Schema.Types.Mixed,
  responseCode: Number,
  duration: Number,
  targetUserId: String,
  targetUsername: String,
  changes: Schema.Types.Mixed
}, { _id: false });

// Schéma principal
const auditLogSchema = new Schema<IAuditLogDocument>({
  _id: {
    type: String,
    required: true,
    default: () => IdGenerator.generateLogId()
  },
  logId: {
    type: String,
    required: true,
    unique: true,
    default: function() { return this._id; }
  },
  adminId: {
    type: String,
    required: true,
    index: true
  },
  adminUsername: {
    type: String,
    required: true,
    index: true
  },
  adminRole: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator', 'viewer'],
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: [
      // Authentification
      'admin.login', 'admin.logout', 'admin.failed_login', 'admin.password_change',
      'admin.2fa_enable', 'admin.2fa_disable',
      // Gestion des joueurs
      'player.view_details', 'player.ban', 'player.unban', 'player.edit_profile',
      'player.add_currency', 'player.remove_currency', 'player.add_hero',
      'player.remove_hero', 'player.modify_progress', 'player.reset_account',
      'player.delete_account',
      // Économie
      'economy.view_transactions', 'economy.modify_shop', 'economy.create_promo_code',
      'economy.disable_promo_code',
      // Système
      'system.view_logs', 'system.modify_config', 'system.create_backup',
      'system.restore_backup', 'system.server_restart',
      // Événements
      'event.create', 'event.modify', 'event.delete', 'event.start', 'event.stop',
      // Analytics
      'analytics.view_dashboard', 'analytics.export_data', 'analytics.view_financial',
      // Gestion des admins
      'admin.create_user', 'admin.delete_user', 'admin.modify_permissions',
      'admin.view_audit_logs'
    ],
    required: true,
    index: true
  },
  resource: {
    type: String,
    required: true,
    index: true
  },
  resourceId: {
    type: String,
    index: true
  },
  details: {
    type: actionDetailsSchema,
    default: null
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  serverId: {
    type: String,
    match: /^S\d+$/,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  success: {
    type: Boolean,
    required: true,
    index: true
  },
  errorMessage: {
    type: String,
    maxlength: 1000
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    index: true
  }
}, {
  timestamps: false, // On gère timestamp manuellement
  collection: 'audit_logs',
  _id: false
});

function determineSeverityHelper(log: any): 'low' | 'medium' | 'high' | 'critical' {
  if (!log.success) {
    if (log.action.includes('login') || log.action.includes('auth')) {
      return 'medium';
    }
    return 'high';
  }
  
  const criticalActions = [
    'player.delete_account', 'admin.delete_user', 'system.server_restart'
  ];
  
  const highActions = [
    'player.ban', 'admin.modify_permissions', 'system.modify_config'
  ];
  
  if (criticalActions.includes(log.action)) return 'critical';
  if (highActions.includes(log.action)) return 'high';
  if (log.action.includes('modify') || log.action.includes('delete')) return 'medium';
  
  return 'low';
}

function sanitizeRequestBodyHelper(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}
// ===== PRE-SAVE HOOK =====
auditLogSchema.pre<IAuditLogDocument>('save', function(next) {
  // Synchroniser logId avec _id
  if (!this.logId || this.logId !== this._id) {
    this.logId = this._id;
  }

  // Déterminer automatiquement la sévérité si pas définie
  if (!this.severity || this.severity === 'low') {
    this.severity = determineSeverityHelper(this);
  }

  // Anonymiser les données sensibles si nécessaire
  if (this.details && this.details.requestBody) {
    this.details.requestBody = sanitizeRequestBodyHelper(this.details.requestBody);
  }

  next();
});

// ===== INDEX COMPOSÉS =====
auditLogSchema.index({ adminId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ success: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ ipAddress: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 }); // Pour le cleanup automatique

// Index TTL pour nettoyage automatique (optionnel, 90 jours par défaut)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// ===== MÉTHODES STATIQUES =====
auditLogSchema.statics.createLog = async function(logData: Partial<IAuditLogDocument>): Promise<IAuditLogDocument> {
  const log = new this({
    ...logData,
    timestamp: logData.timestamp || new Date()
  });
  
  return await log.save();
};

auditLogSchema.statics.findByAdmin = function(adminId: string, limit: number = 100): Promise<IAuditLogDocument[]> {
  return this.find({ adminId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
};

auditLogSchema.statics.findByAction = function(action: AdminAction, limit: number = 100): Promise<IAuditLogDocument[]> {
  return this.find({ action })
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
};

auditLogSchema.statics.findByResource = function(resource: string, resourceId?: string): Promise<IAuditLogDocument[]> {
  const query: any = { resource };
  if (resourceId) query.resourceId = resourceId;
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(200)
    .exec();
};

auditLogSchema.statics.findCriticalActions = function(hours: number = 24): Promise<IAuditLogDocument[]> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    severity: { $in: ['high', 'critical'] },
    timestamp: { $gte: cutoff }
  })
    .sort({ timestamp: -1 })
    .exec();
};

auditLogSchema.statics.findFailedActions = function(hours: number = 24): Promise<IAuditLogDocument[]> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    success: false,
    timestamp: { $gte: cutoff }
  })
    .sort({ timestamp: -1 })
    .exec();
};

auditLogSchema.statics.getSecuritySummary = async function(hours: number = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    { $match: { timestamp: { $gte: cutoff } } },
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        failedActions: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } },
        criticalActions: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
        uniqueAdmins: { $addToSet: '$adminId' },
        uniqueIPs: { $addToSet: '$ipAddress' },
        actionsByType: {
          $push: {
            action: '$action',
            success: '$success',
            severity: '$severity'
          }
        }
      }
    }
  ]);

  const topActions = await this.aggregate([
    { $match: { timestamp: { $gte: cutoff } } },
    { $group: { _id: '$action', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  return {
    summary: stats[0] || {
      totalActions: 0,
      failedActions: 0,
      criticalActions: 0,
      uniqueAdmins: [],
      uniqueIPs: [],
      actionsByType: []
    },
    topActions,
    period: `${hours} hours`
  };
};

auditLogSchema.statics.getAdminActivity = async function(adminId: string, hours: number = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const activity = await this.aggregate([
    { $match: { adminId, timestamp: { $gte: cutoff } } },
    {
      $group: {
        _id: { 
          hour: { $hour: '$timestamp' },
          date: { $dateToString: { format: "%Y-%m-%d", date: '$timestamp' } }
        },
        actions: { $sum: 1 },
        failed: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } },
        critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } }
      }
    },
    { $sort: { '_id.date': -1, '_id.hour': -1 } }
  ]);

  const recentActions = await this.find({ adminId, timestamp: { $gte: cutoff } })
    .sort({ timestamp: -1 })
    .limit(50)
    .select('action resource timestamp success severity')
    .exec();

  return {
    hourlyActivity: activity,
    recentActions,
    adminId,
    period: `${hours} hours`
  };
};

auditLogSchema.statics.searchLogs = async function(filter: IAuditLogFilter) {
  const query: any = {};
  
  // Construire la requête
  if (filter.adminId) query.adminId = filter.adminId;
  if (filter.action) query.action = filter.action;
  if (filter.success !== undefined) query.success = filter.success;
  if (filter.ipAddress) query.ipAddress = filter.ipAddress;
  if (filter.serverId) query.serverId = filter.serverId;
  
  if (filter.dateFrom || filter.dateTo) {
    query.timestamp = {};
    if (filter.dateFrom) query.timestamp.$gte = filter.dateFrom;
    if (filter.dateTo) query.timestamp.$lte = filter.dateTo;
  }

  const page = filter.page || 1;
  const limit = Math.min(filter.limit || 50, 200); // Max 200 per page
  const skip = (page - 1) * limit;

  const sortField = filter.sortBy || 'timestamp';
  const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;

  const [logs, total] = await Promise.all([
    this.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .exec(),
    this.countDocuments(query)
  ]);

  return { logs, total };
};

auditLogSchema.statics.cleanupOldLogs = async function(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  const result = await this.deleteMany({
    timestamp: { $lt: cutoff },
    severity: { $nin: ['critical'] } // Garder les logs critiques plus longtemps
  });

  return result.deletedCount || 0;
};

auditLogSchema.statics.getSystemHealth = async function() {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const [recentStats, oldestLog, newestLog, totalLogs] = await Promise.all([
    this.aggregate([
      { $match: { timestamp: { $gte: last24h } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          errors: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } }
        }
      }
    ]),
    this.findOne().sort({ timestamp: 1 }).select('timestamp'),
    this.findOne().sort({ timestamp: -1 }).select('timestamp'),
    this.countDocuments()
  ]);

  const stats = recentStats[0] || { total: 0, errors: 0, critical: 0 };
  const errorRate = stats.total > 0 ? (stats.errors / stats.total * 100).toFixed(2) : '0';

  return {
    last24Hours: {
      totalLogs: stats.total,
      errorCount: stats.errors,
      criticalCount: stats.critical,
      errorRate: `${errorRate}%`
    },
    database: {
      totalLogs,
      oldestLog: oldestLog?.timestamp,
      newestLog: newestLog?.timestamp,
      retentionSpan: oldestLog && newestLog ? 
        Math.floor((newestLog.timestamp.getTime() - oldestLog.timestamp.getTime()) / (1000 * 60 * 60 * 24)) : 0
    }
  };
};

// ===== MÉTHODES D'INSTANCE =====
auditLogSchema.methods.isCriticalAction = function(): boolean {
  const criticalActions = [
    'player.delete_account',
    'player.reset_account',
    'admin.delete_user',
    'admin.modify_permissions',
    'system.server_restart',
    'system.restore_backup'
  ];
  
  return criticalActions.includes(this.action) || this.severity === 'critical';
};

auditLogSchema.methods.getReadableDescription = function(): string {
  const actionMap: Record<string, string> = {
    'admin.login': 'Admin logged in',
    'admin.logout': 'Admin logged out',
    'player.ban': 'Banned player',
    'player.unban': 'Unbanned player',
    'player.add_currency': 'Added currency to player',
    'economy.modify_shop': 'Modified shop configuration',
    'system.server_restart': 'Restarted server'
  };
  
  const baseDesc = actionMap[this.action] || this.action;
  const target = this.resourceId ? ` (${this.resourceId})` : '';
  const status = this.success ? '✅' : '❌';
  
  return `${status} ${baseDesc}${target}`;
};

auditLogSchema.methods.anonymize = function(): IAuditLogDocument {
  const anonymized = this.toObject();
  
  // Anonymiser les données sensibles
  anonymized.ipAddress = this.ipAddress.split('.').map((part: string, index: number) =>
    index < 2 ? part : 'XXX'
  ).join('.');
  
  anonymized.userAgent = 'ANONYMIZED';
  
  if (anonymized.details) {
    delete anonymized.details.requestBody;
    delete anonymized.details.additionalInfo;
  }
  
  return anonymized as IAuditLogDocument;
};

// Méthodes d'aide pour la sévérité
auditLogSchema.methods.determineSeverity = function(): 'low' | 'medium' | 'high' | 'critical' {
  if (!this.success) {
    if (this.action.includes('login') || this.action.includes('auth')) {
      return 'medium';
    }
    return 'high';
  }
  
  const criticalActions = [
    'player.delete_account', 'admin.delete_user', 'system.server_restart'
  ];
  
  const highActions = [
    'player.ban', 'admin.modify_permissions', 'system.modify_config'
  ];
  
  if (criticalActions.includes(this.action)) return 'critical';
  if (highActions.includes(this.action)) return 'high';
  if (this.action.includes('modify') || this.action.includes('delete')) return 'medium';
  
  return 'low';
};

auditLogSchema.methods.sanitizeRequestBody = function(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
};

// Export du modèle
const AuditLog = mongoose.model<IAuditLogDocument, IAuditLogModel>('AuditLog', auditLogSchema);
export default AuditLog;

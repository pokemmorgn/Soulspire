import dotenv from 'dotenv';

dotenv.config();

export interface IPanelConfig {
  // Sécurité
  security: {
    jwtSecret: string;
    sessionDuration: number; // en heures
    maxLoginAttempts: number;
    lockoutDuration: number; // en minutes
    allowedIPs: string[];
    requireTwoFactor: boolean;
  };

  // Serveur
  server: {
    port: number;
    host: string;
    corsOrigins: string[];
    enableHttps: boolean;
    rateLimiting: {
      windowMs: number;
      maxRequests: number;
    };
  };

  // Base de données
  database: {
    connectionString: string;
    adminDatabase: string; // Base spécifique pour les données admin
    enableAuditLog: boolean;
    retentionDays: number; // Rétention des logs
  };

  // Permissions et rôles
  permissions: {
    roles: {
      [role: string]: {
        name: string;
        permissions: string[];
        description: string;
      };
    };
    defaultRole: string;
  };

  // Dashboard et métriques
  dashboard: {
    refreshInterval: number; // en secondes
    maxDataPoints: number;
    enableRealTimeUpdates: boolean;
    cacheDuration: number; // en minutes
  };

  // Export et backup
  export: {
    maxRecords: number;
    allowedFormats: string[];
    enableScheduledBackups: boolean;
    backupPath: string;
  };

  // Monitoring
  monitoring: {
    enableMetrics: boolean;
    alertThresholds: {
      serverLoad: number;
      errorRate: number;
      responseTime: number;
      concurrentUsers: number;
    };
    notifications: {
      email: string[];
      webhook?: string;
    };
  };
}

// Configuration par défaut
const defaultConfig: IPanelConfig = {
  security: {
    jwtSecret: process.env.ADMIN_JWT_SECRET || 'admin-super-secret-key-change-in-production',
    sessionDuration: 8, // 8 heures
    maxLoginAttempts: 5,
    lockoutDuration: 30, // 30 minutes
    allowedIPs: process.env.ADMIN_ALLOWED_IPS?.split(',') || ['127.0.0.1', '::1'],
    requireTwoFactor: process.env.ADMIN_REQUIRE_2FA === 'true'
  },

  server: {
    port: parseInt(process.env.ADMIN_PANEL_PORT || '3001'),
    host: process.env.ADMIN_PANEL_HOST || 'localhost',
    corsOrigins: process.env.ADMIN_CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    enableHttps: process.env.ADMIN_ENABLE_HTTPS === 'true',
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100
    }
  },

  database: {
    connectionString: process.env.MONGO_URI || 'mongodb://localhost:27017/idle_gacha_admin',
    adminDatabase: process.env.ADMIN_DB_NAME || 'admin_panel',
    enableAuditLog: process.env.ADMIN_ENABLE_AUDIT === 'true',
    retentionDays: parseInt(process.env.ADMIN_LOG_RETENTION || '90')
  },

  permissions: {
    roles: {
      'super_admin': {
        name: 'Super Administrateur',
        permissions: [
          'server.manage',
          'player.manage',
          'economy.view',
          'economy.modify',
          'events.manage',
          'analytics.view',
          'admin.manage',
          'system.config'
        ],
        description: 'Accès complet au système'
      },
      'admin': {
        name: 'Administrateur',
        permissions: [
          'player.manage',
          'economy.view',
          'economy.modify',
          'events.manage',
          'analytics.view'
        ],
        description: 'Gestion des joueurs et événements'
      },
      'moderator': {
        name: 'Modérateur',
        permissions: [
          'player.view',
          'player.moderate',
          'economy.view',
          'analytics.view'
        ],
        description: 'Modération des joueurs'
      },
      'viewer': {
        name: 'Observateur',
        permissions: [
          'analytics.view',
          'economy.view'
        ],
        description: 'Consultation des données uniquement'
      }
    },
    defaultRole: 'viewer'
  },

  dashboard: {
    refreshInterval: 30, // 30 secondes
    maxDataPoints: 1000,
    enableRealTimeUpdates: true,
    cacheDuration: 5 // 5 minutes
  },

  export: {
    maxRecords: 10000,
    allowedFormats: ['csv', 'json', 'xlsx'],
    enableScheduledBackups: true,
    backupPath: process.env.ADMIN_BACKUP_PATH || './backups'
  },

  monitoring: {
    enableMetrics: true,
    alertThresholds: {
      serverLoad: 80, // %
      errorRate: 5, // %
      responseTime: 2000, // ms
      concurrentUsers: 1000
    },
    notifications: {
      email: process.env.ADMIN_ALERT_EMAILS?.split(',') || [],
      webhook: process.env.ADMIN_WEBHOOK_URL
    }
  }
};

// Validation de la configuration
export function validateConfig(config: IPanelConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validation sécurité
  if (!config.security.jwtSecret || config.security.jwtSecret.length < 32) {
    errors.push('JWT Secret doit contenir au moins 32 caractères');
  }

  if (config.security.sessionDuration < 1 || config.security.sessionDuration > 24) {
    errors.push('Durée de session doit être entre 1 et 24 heures');
  }

  // Validation serveur
  if (config.server.port < 1000 || config.server.port > 65535) {
    errors.push('Port doit être entre 1000 et 65535');
  }

  // Validation base de données
  if (!config.database.connectionString) {
    errors.push('Connection string MongoDB requis');
  }

  // Validation rôles
  if (!config.permissions.roles[config.permissions.defaultRole]) {
    errors.push('Rôle par défaut inexistant');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Configuration finale avec validation
let panelConfig: IPanelConfig;

try {
  panelConfig = { ...defaultConfig };
  
  // Override avec variables d'environnement spécifiques si nécessaire
  if (process.env.NODE_ENV === 'production') {
    // Configuration production plus stricte
    panelConfig.security.requireTwoFactor = true;
    panelConfig.database.enableAuditLog = true;
    panelConfig.monitoring.enableMetrics = true;
  }

  // Validation
  const validation = validateConfig(panelConfig);
  if (!validation.valid) {
    console.error('❌ Configuration du panel admin invalide:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log('✅ Configuration du panel admin chargée avec succès');
  
} catch (error) {
  console.error('❌ Erreur lors du chargement de la configuration:', error);
  process.exit(1);
}

export { panelConfig };
export default panelConfig;

// Types utilitaires pour la configuration
export type AdminRole = keyof typeof panelConfig.permissions.roles;
export type AdminPermission = string;

// Helper pour vérifier les permissions
export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  return userPermissions.includes(requiredPermission) || userPermissions.includes('*');
}

// Helper pour obtenir les permissions d'un rôle
export function getRolePermissions(role: AdminRole): string[] {
  return panelConfig.permissions.roles[role]?.permissions || [];
}

// Environment validation helper
export function validateEnvironment(): void {
  const requiredEnvVars = [
    'MONGO_URI',
    'ADMIN_JWT_SECRET'
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('❌ Variables d\'environnement manquantes pour le panel admin:');
    missing.forEach(envVar => console.error(`  - ${envVar}`));
    
    console.log('\n📝 Exemple de configuration .env:');
    console.log('MONGODB_URI=mongodb://localhost:27017/idle_gacha');
    console.log('ADMIN_JWT_SECRET=your-super-secure-admin-secret-key-here');
    console.log('ADMIN_PANEL_PORT=3001');
    console.log('ADMIN_REQUIRE_2FA=false');
    console.log('ADMIN_ALLOWED_IPS=127.0.0.1,::1');
    
    throw new Error('Configuration environnement incomplète');
  }
}

import mongoose, { Document, Schema } from "mongoose";

// Interface pour les serveurs de jeu
export interface IGameServer {
  _id?: string;
  serverId: string; // "S1", "S2", "S3", etc.
  name: string;
  region: "EU" | "NA" | "ASIA" | "GLOBAL";
  status: "online" | "maintenance" | "offline";
  
  // Capacité et population
  maxPlayers: number;
  currentPlayers: number;
  isNewPlayerAllowed: boolean;
  
  // Configuration cross-server
  crossServerConfig: {
    allowedServers: string[]; // Serveurs avec lesquels ce serveur peut interagir
    globalEvents: boolean; // Participe aux événements globaux
    crossServerArena: boolean; // PvP cross-server autorisé
    crossServerGuilds: boolean; // Guildes cross-server autorisées
  };
  
  // Métadonnées
  launchDate: Date;
  lastMaintenance?: Date;
  version: string;
  
  // Économie du serveur
  serverEconomy: {
    totalGoldCirculation: number;
    totalGemsSpent: number;
    averagePlayerLevel: number;
    topGuildName?: string;
  };
}

// Interface pour la configuration cross-server globale
export interface ICrossServerConfig {
  _id?: string;
  configName: string;
  
  // Règles générales
  globalRules: {
    maxServersPerEvent: number;
    crossServerCooldown: number; // en heures
    maintenanceMode: boolean;
  };
  
  // Configurations spécifiques
  eventConfigs: {
    eventType: "raid" | "pvp" | "tournament" | "boss";
    allowedServers: string[];
    minServerLevel: number;
    maxParticipants: number;
    rewardsMultiplier: number;
  }[];
  
  // Restrictions par région
  regionRestrictions: {
    region: string;
    allowedCrossRegions: string[];
    latencyLimit: number; // ms
  }[];
}

interface IGameServerDocument extends Document {
  serverId: string;
  name: string;
  region: "EU" | "NA" | "ASIA" | "GLOBAL";
  status: "online" | "maintenance" | "offline";
  maxPlayers: number;
  currentPlayers: number;
  isNewPlayerAllowed: boolean;
  crossServerConfig: {
    allowedServers: string[];
    globalEvents: boolean;
    crossServerArena: boolean;
    crossServerGuilds: boolean;
  };
  launchDate: Date;
  lastMaintenance?: Date;
  version: string;
  serverEconomy: {
    totalGoldCirculation: number;
    totalGemsSpent: number;
    averagePlayerLevel: number;
    topGuildName?: string;
  };
  
  // Méthodes d'instance
  canAcceptNewPlayers(): boolean;
  canInteractWith(otherServerId: string): boolean;
  updatePlayerCount(delta: number): Promise<IGameServerDocument>;
  updateEconomyStats(goldDelta: number, gemsDelta: number): Promise<IGameServerDocument>;
}

interface ICrossServerConfigDocument extends Document {
  configName: string;
  globalRules: {
    maxServersPerEvent: number;
    crossServerCooldown: number;
    maintenanceMode: boolean;
  };
  eventConfigs: {
    eventType: "raid" | "pvp" | "tournament" | "boss";
    allowedServers: string[];
    minServerLevel: number;
    maxParticipants: number;
    rewardsMultiplier: number;
  }[];
  regionRestrictions: {
    region: string;
    allowedCrossRegions: string[];
    latencyLimit: number;
  }[];
  
  // Méthodes d'instance
  canServersInteract(server1: string, server2: string): boolean;
  getEventConfig(eventType: string): any;
}

// Schéma GameServer
const gameServerSchema = new Schema<IGameServerDocument>({
  serverId: { 
    type: String, 
    required: true, 
    unique: true,
    match: /^S\d+$/ // Format S1, S2, S3...
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 50
  },
  region: { 
    type: String, 
    enum: ["EU", "NA", "ASIA", "GLOBAL"],
    required: true 
  },
  status: { 
    type: String, 
    enum: ["online", "maintenance", "offline"],
    default: "online"
  },
  
  maxPlayers: { 
    type: Number, 
    required: true,
    min: 100,
    max: 50000,
    default: 10000
  },
  currentPlayers: { 
    type: Number, 
    default: 0,
    min: 0
  },
  isNewPlayerAllowed: { 
    type: Boolean, 
    default: true 
  },
  
  crossServerConfig: {
    allowedServers: [{ 
      type: String,
      match: /^S\d+$/
    }],
    globalEvents: { type: Boolean, default: true },
    crossServerArena: { type: Boolean, default: false },
    crossServerGuilds: { type: Boolean, default: false }
  },
  
  launchDate: { 
    type: Date, 
    default: Date.now 
  },
  lastMaintenance: { type: Date },
  version: { 
    type: String, 
    required: true,
    default: "1.0.0"
  },
  
  serverEconomy: {
    totalGoldCirculation: { type: Number, default: 0 },
    totalGemsSpent: { type: Number, default: 0 },
    averagePlayerLevel: { type: Number, default: 1 },
    topGuildName: { type: String, default: "" }
  }
}, {
  timestamps: true,
  collection: 'gameservers'
});

// Schéma CrossServerConfig
const crossServerConfigSchema = new Schema<ICrossServerConfigDocument>({
  configName: { 
    type: String, 
    required: true,
    unique: true
  },
  
  globalRules: {
    maxServersPerEvent: { type: Number, default: 4, min: 2, max: 10 },
    crossServerCooldown: { type: Number, default: 24, min: 1, max: 168 }, // heures
    maintenanceMode: { type: Boolean, default: false }
  },
  
  eventConfigs: [{
    eventType: { 
      type: String, 
      enum: ["raid", "pvp", "tournament", "boss"],
      required: true 
    },
    allowedServers: [{ type: String, match: /^S\d+$/ }],
    minServerLevel: { type: Number, default: 1, min: 1 },
    maxParticipants: { type: Number, default: 100, min: 10 },
    rewardsMultiplier: { type: Number, default: 1.0, min: 0.5, max: 3.0 }
  }],
  
  regionRestrictions: [{
    region: { 
      type: String, 
      enum: ["EU", "NA", "ASIA", "GLOBAL"],
      required: true 
    },
    allowedCrossRegions: [{ 
      type: String, 
      enum: ["EU", "NA", "ASIA", "GLOBAL"]
    }],
    latencyLimit: { type: Number, default: 200, min: 50, max: 1000 } // ms
  }]
}, {
  timestamps: true,
  collection: 'crossserverconfigs'
});

// Index pour optimiser les requêtes
gameServerSchema.index({ serverId: 1 });
gameServerSchema.index({ region: 1, status: 1 });
gameServerSchema.index({ status: 1, isNewPlayerAllowed: 1 });
gameServerSchema.index({ currentPlayers: 1 });

crossServerConfigSchema.index({ configName: 1 });

// Méthodes statiques GameServer
gameServerSchema.statics.getAvailableServers = function(region?: string) {
  const filter: any = { 
    status: "online", 
    isNewPlayerAllowed: true,
    $expr: { $lt: ["$currentPlayers", "$maxPlayers"] }
  };
  
  if (region) filter.region = region;
  
  return this.find(filter).sort({ currentPlayers: 1 });
};

gameServerSchema.statics.getServerById = function(serverId: string) {
  return this.findOne({ serverId, status: { $ne: "offline" } });
};

gameServerSchema.statics.getAllActiveServers = function() {
  return this.find({ status: { $in: ["online", "maintenance"] } }).sort({ serverId: 1 });
};

// Méthodes d'instance GameServer
gameServerSchema.methods.canAcceptNewPlayers = function(): boolean {
  return this.status === "online" && 
         this.isNewPlayerAllowed && 
         this.currentPlayers < this.maxPlayers;
};

gameServerSchema.methods.canInteractWith = function(otherServerId: string): boolean {
  return this.crossServerConfig.allowedServers.includes(otherServerId);
};

gameServerSchema.methods.updatePlayerCount = function(delta: number) {
  this.currentPlayers = Math.max(0, this.currentPlayers + delta);
  return this.save();
};

gameServerSchema.methods.updateEconomyStats = function(goldDelta: number, gemsDelta: number) {
  this.serverEconomy.totalGoldCirculation += goldDelta;
  this.serverEconomy.totalGemsSpent += gemsDelta;
  return this.save();
};

// Méthodes statiques CrossServerConfig
crossServerConfigSchema.statics.getActiveConfig = function() {
  return this.findOne({ configName: "main" }) || this.findOne().sort({ createdAt: -1 });
};

// Méthodes d'instance CrossServerConfig
crossServerConfigSchema.methods.canServersInteract = function(server1: string, server2: string): boolean {
  if (this.globalRules.maintenanceMode) return false;
  
  // Vérifier les restrictions par région
  // Pour l'instant, logique simplifiée
  return true;
};

crossServerConfigSchema.methods.getEventConfig = function(eventType: string) {
  return this.eventConfigs.find(config => config.eventType === eventType);
};

export const GameServer = mongoose.model<IGameServerDocument>("GameServer", gameServerSchema);
export const CrossServerConfig = mongoose.model<ICrossServerConfigDocument>("CrossServerConfig", crossServerConfigSchema);

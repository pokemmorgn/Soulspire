import mongoose, { Document, Schema } from "mongoose";

// Interface pour l'historique des achats premium (ANALYTICS SEULEMENT)
interface IPurchaseHistory {
  transactionId: string;
  platform: "android" | "ios" | "web" | "steam";
  productId: string;
  productName: string;
  priceUSD: number;
  priceCurrency: string;
  purchaseDate: Date;
  serverId: string; // Serveur où l'achat a été fait
  status: "completed" | "pending" | "refunded" | "failed";
  // Note: Pas de gemsReceived car chaque serveur gère ses propres gems
}

// Interface pour les connexions
interface ILoginHistory {
  loginDate: Date;
  serverId: string;
  platform: "android" | "ios" | "web" | "steam";
  deviceId?: string;
  ipAddress?: string;
  country?: string;
}

// Interface principale du compte (AUTHENTIFICATION + ANALYTICS SEULEMENT)
export interface IAccount {
  _id?: string;
  accountId: string; // UUID unique global
  username: string; // Unique globalement
  email?: string;
  password: string;
  
  // STATUT COMPTE
  accountStatus: "active" | "suspended" | "banned" | "inactive";
  suspensionReason?: string;
  suspensionExpiresAt?: Date;
  
  // MÉTADONNÉES CONNEXION
  lastLoginAt: Date;
  lastLoginServerId?: string;
  lastLoginPlatform?: string;
  createdAt: Date;
  
  // ANALYTICS GLOBALES (pour business intelligence)
  totalPlaytimeMinutes: number; // Temps de jeu total tous serveurs
  totalPurchasesUSD: number; // Total dépensé tous serveurs (analytics)
  firstPurchaseDate?: Date;
  lastPurchaseDate?: Date;
  
  // PRÉFÉRENCES UTILISATEUR (partagées)
  preferences: {
    language: string;
    notifications: {
      email: boolean;
      push: boolean;
      marketing: boolean;
    };
    privacy: {
      showOnlineStatus: boolean;
      allowFriendRequests: boolean;
    };
  };
  
  // HISTORIQUES (analytics seulement)
  purchaseHistory: IPurchaseHistory[]; // Pour tracking business
  loginHistory: ILoginHistory[];
  
  // DONNÉES CROSS-SERVER
  favoriteServerId?: string; // Serveur principal du joueur
  serverList: string[]; // Liste des serveurs où le joueur a un personnage
}

interface IAccountDocument extends Document {
  accountId: string;
  username: string;
  email?: string;
  password: string;
  accountStatus: "active" | "suspended" | "banned" | "inactive";
  suspensionReason?: string;
  suspensionExpiresAt?: Date;
  lastLoginAt: Date;
  lastLoginServerId?: string;
  lastLoginPlatform?: string;
  totalPlaytimeMinutes: number;
  totalPurchasesUSD: number;
  firstPurchaseDate?: Date;
  lastPurchaseDate?: Date;
  preferences: {
    language: string;
    notifications: {
      email: boolean;
      push: boolean;
      marketing: boolean;
    };
    privacy: {
      showOnlineStatus: boolean;
      allowFriendRequests: boolean;
    };
  };
  purchaseHistory: IPurchaseHistory[];
  loginHistory: ILoginHistory[];
  favoriteServerId?: string;
  serverList: string[];
  
  // Méthodes d'instance
  addPurchaseRecord(purchase: IPurchaseHistory): Promise<IAccountDocument>;
  addLoginRecord(serverId: string, platform: string, deviceId?: string, ipAddress?: string): Promise<IAccountDocument>;
  isSuspended(): boolean;
  canAccessServer(serverId: string): boolean;
  addServerToList(serverId: string): Promise<IAccountDocument>;
  getAccountStats(): any;
}

// Schémas secondaires
const purchaseHistorySchema = new Schema<IPurchaseHistory>({
  transactionId: { type: String, required: true, unique: true },
  platform: { 
    type: String, 
    enum: ["android", "ios", "web", "steam"], 
    required: true 
  },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  priceUSD: { type: Number, required: true, min: 0 },
  priceCurrency: { type: String, required: true, maxlength: 3 },
  purchaseDate: { type: Date, default: Date.now },
  serverId: { type: String, required: true, match: /^S\d+$/ },
  status: { 
    type: String, 
    enum: ["completed", "pending", "refunded", "failed"],
    default: "completed"
  }
}, { _id: false });

const loginHistorySchema = new Schema<ILoginHistory>({
  loginDate: { type: Date, default: Date.now },
  serverId: { type: String, required: true, match: /^S\d+$/ },
  platform: { 
    type: String, 
    enum: ["android", "ios", "web", "steam"], 
    required: true 
  },
  deviceId: { type: String },
  ipAddress: { type: String },
  country: { type: String, maxlength: 2 } // Code pays ISO
}, { _id: false });

// Schéma principal Account
const accountSchema = new Schema<IAccountDocument>({
  accountId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => `ACC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  username: { 
    type: String, 
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_-]+$/ // Alphanumerique + underscore + tiret
  },
  email: { 
    type: String,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ // Email basique
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  
  // STATUT COMPTE
  accountStatus: { 
    type: String, 
    enum: ["active", "suspended", "banned", "inactive"],
    default: "active"
  },
  suspensionReason: { type: String },
  suspensionExpiresAt: { type: Date },
  
  // CONNEXIONS
  lastLoginAt: { 
    type: Date, 
    default: Date.now 
  },
  lastLoginServerId: { 
    type: String,
    match: /^S\d+$/
  },
  lastLoginPlatform: { 
    type: String, 
    enum: ["android", "ios", "web", "steam"]
  },
  
  // ANALYTICS GLOBALES
  totalPlaytimeMinutes: { 
    type: Number, 
    default: 0,
    min: 0
  },
  totalPurchasesUSD: { 
    type: Number, 
    default: 0,
    min: 0
  },
  firstPurchaseDate: { type: Date },
  lastPurchaseDate: { type: Date },
  
  // PRÉFÉRENCES
  preferences: {
    language: { 
      type: String, 
      default: "en",
      enum: ["en", "fr", "es", "de", "ja", "ko", "zh"]
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    },
    privacy: {
      showOnlineStatus: { type: Boolean, default: true },
      allowFriendRequests: { type: Boolean, default: true }
    }
  },
  
  // HISTORIQUES
  purchaseHistory: { 
    type: [purchaseHistorySchema],
    default: []
  },
  loginHistory: { 
    type: [loginHistorySchema],
    default: []
  },
  
  // CROSS-SERVER
  favoriteServerId: { 
    type: String,
    match: /^S\d+$/
  },
  serverList: [{
    type: String,
    match: /^S\d+$/
  }]
}, {
  timestamps: true,
  collection: 'accounts'
});

// Index pour optimiser les requêtes
accountSchema.index({ accountId: 1 }, { unique: true });
accountSchema.index({ username: 1 }, { unique: true });
accountSchema.index({ email: 1 }, { sparse: true });
accountSchema.index({ accountStatus: 1 });
accountSchema.index({ lastLoginAt: -1 });
accountSchema.index({ totalPurchasesUSD: -1 });
accountSchema.index({ "loginHistory.loginDate": -1 });
accountSchema.index({ "purchaseHistory.purchaseDate": -1 });

// Méthodes statiques
accountSchema.statics.findByUsername = function(username: string) {
  return this.findOne({ username: username.toLowerCase() });
};

accountSchema.statics.findActiveAccounts = function() {
  return this.find({ accountStatus: "active" });
};

accountSchema.statics.getAccountsByServer = function(serverId: string) {
  return this.find({ serverList: serverId });
};

accountSchema.statics.getSpendingAccounts = function(minSpent: number = 1) {
  return this.find({ totalPurchasesUSD: { $gte: minSpent } });
};

// Méthodes d'instance
accountSchema.methods.addPurchaseRecord = function(purchase: IPurchaseHistory) {
  // Ajouter l'achat à l'historique (ANALYTICS SEULEMENT)
  this.purchaseHistory.push(purchase);
  
  // Mettre à jour les statistiques globales
  this.totalPurchasesUSD += purchase.priceUSD;
  if (!this.firstPurchaseDate) {
    this.firstPurchaseDate = purchase.purchaseDate;
  }
  this.lastPurchaseDate = purchase.purchaseDate;
  
  // NOTE: Les gems sont gérées dans Player.ts, pas ici !
  
  return this.save();
};

accountSchema.methods.addLoginRecord = function(
  serverId: string, 
  platform: string, 
  deviceId?: string, 
  ipAddress?: string
) {
  // Ajouter à l'historique (garder seulement les 50 dernières connexions)
  this.loginHistory.push({
    loginDate: new Date(),
    serverId,
    platform: platform as any,
    deviceId,
    ipAddress
  });
  
  if (this.loginHistory.length > 50) {
    this.loginHistory = this.loginHistory.slice(-50);
  }
  
  // Mettre à jour les infos de dernière connexion
  this.lastLoginAt = new Date();
  this.lastLoginServerId = serverId;
  this.lastLoginPlatform = platform as any;
  
  return this.save();
};

accountSchema.methods.isSuspended = function() {
  if (this.accountStatus !== "suspended") return false;
  if (!this.suspensionExpiresAt) return true; // Suspension permanente
  return new Date() < this.suspensionExpiresAt;
};

accountSchema.methods.canAccessServer = function(serverId: string) {
  if (this.accountStatus === "banned") return false;
  if (this.isSuspended()) return false;
  
  // TODO: Ajouter logique de restriction par région/serveur si nécessaire
  return true;
};

accountSchema.methods.addServerToList = function(serverId: string) {
  if (!this.serverList.includes(serverId)) {
    this.serverList.push(serverId);
    return this.save();
  }
  return Promise.resolve(this);
};

accountSchema.methods.getAccountStats = function() {
  return {
    accountAge: this.createdAt ? Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
    totalLogins: this.loginHistory.length,
    totalPurchases: this.purchaseHistory.filter((p: IPurchaseHistory) => p.status === "completed").length,
    averageSessionsPerDay: this.loginHistory.length / Math.max(1, Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24))),
    serversPlayed: this.serverList.length,
    isSpender: this.totalPurchasesUSD > 0,
    isWhale: this.totalPurchasesUSD > 100,
    accountType: this.totalPurchasesUSD > 100 ? "Whale" : this.totalPurchasesUSD > 0 ? "Spender" : "F2P"
  };
};

export default mongoose.model<IAccountDocument>("Account", accountSchema);

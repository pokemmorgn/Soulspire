// server/src/models/ShopOffer.ts

import mongoose, { Document, Schema } from "mongoose";

/**
 * Interface pour les tickets élémentaires dans une offre
 */
export interface IElementalTicketReward {
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Shadow";
  quantity: number;
}

/**
 * Interface pour une offre de boutique
 */
export interface IShopOffer {
  _id?: string;
  offerId: string;
  name: string;
  description: string;
  
  // Type d'offre
  offerType: "friday_elemental" | "daily_gems" | "special_event";
  
  // Récompenses
  rewards: {
    elementalTickets?: IElementalTicketReward[];
    gems?: number;
    tickets?: number;
    materials?: { itemId: string; quantity: number }[];
  };
  
  // Prix
  priceGems: number;
  pricePaidGems?: number; // Optionnel : argent réel
  priceUSD?: number; // Pour achats réels
  
  // Limites
  limitPerPlayer: number; // -1 = illimité
  limitPerDay?: number;
  limitPerWeek?: number;
  limitPerMonth?: number;
  
  // Disponibilité
  availableOnDays: string[]; // ["friday"] ou ["monday", "tuesday", ...]
  startTime: Date;
  endTime: Date;
  
  // Serveurs
  serverConfig: {
    allowedServers: string[]; // ["S1", "S2"] ou ["ALL"]
    region?: string[];
  };
  
  // État
  isActive: boolean;
  isVisible: boolean;
  sortOrder: number;
  
  // Visuels
  offerImage: string;
  iconImage: string;
  badgeText?: string; // Ex: "BEST VALUE", "LIMITED"
  
  // Tags
  tags: string[];
  
  // Stats
  totalPurchases: number;
  totalRevenue: number;
  
  // Métadonnées
  createdAt?: Date;
  updatedAt?: Date;
}

interface IShopOfferDocument extends Document {
  offerId: string;
  name: string;
  description: string;
  offerType: "friday_elemental" | "daily_gems" | "special_event";
  rewards: {
    elementalTickets?: IElementalTicketReward[];
    gems?: number;
    tickets?: number;
    materials?: { itemId: string; quantity: number }[];
  };
  priceGems: number;
  pricePaidGems?: number;
  priceUSD?: number;
  limitPerPlayer: number;
  limitPerDay?: number;
  limitPerWeek?: number;
  limitPerMonth?: number;
  availableOnDays: string[];
  startTime: Date;
  endTime: Date;
  serverConfig: {
    allowedServers: string[];
    region?: string[];
  };
  isActive: boolean;
  isVisible: boolean;
  sortOrder: number;
  offerImage: string;
  iconImage: string;
  badgeText?: string;
  tags: string[];
  totalPurchases: number;
  totalRevenue: number;
  
  // Méthodes d'instance
  isAvailableToday(): boolean;
  isAvailableOnServer(serverId: string): boolean;
  canPlayerPurchase(playerId: string, purchaseCount: number): boolean;
}

// Schéma Mongoose
const shopOfferSchema = new Schema<IShopOfferDocument>({
  offerId: {
    type: String,
    required: true,
    unique: true,
    match: /^[a-zA-Z0-9_-]+$/
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  offerType: {
    type: String,
    enum: ["friday_elemental", "daily_gems", "special_event"],
    required: true
  },
  
  // Récompenses
  rewards: {
    elementalTickets: [{
      element: {
        type: String,
        enum: ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"],
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      }
    }],
    gems: {
      type: Number,
      min: 0
    },
    tickets: {
      type: Number,
      min: 0
    },
    materials: [{
      itemId: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 }
    }]
  },
  
  // Prix
  priceGems: {
    type: Number,
    required: true,
    min: 0
  },
  pricePaidGems: {
    type: Number,
    min: 0
  },
  priceUSD: {
    type: Number,
    min: 0
  },
  
  // Limites
  limitPerPlayer: {
    type: Number,
    default: -1,
    min: -1
  },
  limitPerDay: {
    type: Number,
    min: -1
  },
  limitPerWeek: {
    type: Number,
    min: -1
  },
  limitPerMonth: {
    type: Number,
    min: -1
  },
  
  // Disponibilité
  availableOnDays: [{
    type: String,
    lowercase: true,
    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  }],
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(this: IShopOfferDocument, endTime: Date) {
        return endTime > this.startTime;
      },
      message: "End time must be after start time"
    }
  },
  
  // Serveurs
  serverConfig: {
    allowedServers: [{
      type: String,
      match: /^(S\d+|ALL)$/
    }],
    region: [{
      type: String,
      enum: ["EU", "NA", "ASIA", "GLOBAL"]
    }]
  },
  
  // État
  isActive: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  
  // Visuels
  offerImage: {
    type: String,
    required: true,
    match: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i
  },
  iconImage: {
    type: String,
    required: true,
    match: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i
  },
  badgeText: {
    type: String,
    maxlength: 20
  },
  
  // Tags
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Stats
  totalPurchases: {
    type: Number,
    default: 0,
    min: 0
  },
  totalRevenue: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  collection: 'shop_offers'
});

// Index pour optimiser les requêtes
shopOfferSchema.index({ offerId: 1 });
shopOfferSchema.index({ offerType: 1, isActive: 1, isVisible: 1 });
shopOfferSchema.index({ availableOnDays: 1 });
shopOfferSchema.index({ startTime: 1, endTime: 1 });
shopOfferSchema.index({ "serverConfig.allowedServers": 1 });
shopOfferSchema.index({ sortOrder: 1 });

// === MÉTHODES D'INSTANCE ===

/**
 * Vérifier si l'offre est disponible aujourd'hui
 */
shopOfferSchema.methods.isAvailableToday = function(): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = dimanche, 1 = lundi, etc.
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayName = dayNames[dayOfWeek];
  
  return this.isActive && 
         this.isVisible && 
         this.startTime <= now && 
         this.endTime >= now &&
         this.availableOnDays.includes(todayName);
};

/**
 * Vérifier si l'offre est disponible sur un serveur
 */
shopOfferSchema.methods.isAvailableOnServer = function(serverId: string): boolean {
  return this.serverConfig.allowedServers.includes(serverId) || 
         this.serverConfig.allowedServers.includes("ALL");
};

/**
 * Vérifier si un joueur peut acheter cette offre
 */
shopOfferSchema.methods.canPlayerPurchase = function(
  playerId: string,
  purchaseCount: number
): boolean {
  // Si pas de limite, toujours OK
  if (this.limitPerPlayer === -1) {
    return true;
  }
  
  // Sinon vérifier la limite
  return purchaseCount < this.limitPerPlayer;
};

// === MÉTHODES STATIQUES ===

/**
 * Obtenir les offres disponibles aujourd'hui pour un serveur
 */
shopOfferSchema.statics.getAvailableOffers = function(serverId: string) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayName = dayNames[dayOfWeek];
  
  return this.find({
    isActive: true,
    isVisible: true,
    startTime: { $lte: now },
    endTime: { $gte: now },
    availableOnDays: todayName,
    $or: [
      { "serverConfig.allowedServers": serverId },
      { "serverConfig.allowedServers": "ALL" }
    ]
  }).sort({ sortOrder: -1 });
};

/**
 * Obtenir les offres du vendredi pour un serveur
 */
shopOfferSchema.statics.getFridayOffers = function(serverId: string) {
  const now = new Date();
  
  return this.find({
    isActive: true,
    isVisible: true,
    startTime: { $lte: now },
    endTime: { $gte: now },
    availableOnDays: "friday",
    $or: [
      { "serverConfig.allowedServers": serverId },
      { "serverConfig.allowedServers": "ALL" }
    ]
  }).sort({ sortOrder: -1 });
};

/**
 * Obtenir une offre par ID
 */
shopOfferSchema.statics.getOfferById = function(offerId: string, serverId: string) {
  return this.findOne({
    offerId,
    $or: [
      { "serverConfig.allowedServers": serverId },
      { "serverConfig.allowedServers": "ALL" }
    ]
  });
};

/**
 * Mettre à jour les stats d'achat
 */
shopOfferSchema.statics.recordPurchase = async function(
  offerId: string,
  priceGems: number
): Promise<void> {
  await this.updateOne(
    { offerId },
    {
      $inc: {
        totalPurchases: 1,
        totalRevenue: priceGems
      }
    }
  );
};

export default mongoose.model<IShopOfferDocument>("ShopOffer", shopOfferSchema);

import mongoose, { Document, Schema } from "mongoose";

// Interface pour les taux de drop spécifiques
export interface IBannerRates {
  Common: number;
  Rare: number;
  Epic: number;
  Legendary: number;
  Mythic: number; 
  // ❌ SUPPRIMÉ : focusRateUp (obsolète, remplacé par focusChance dans IFocusHero)
}

// Interface pour un héros focus/rate-up
export interface IFocusHero {
  heroId: string;
  rateUpMultiplier: number; // ex: 2.0 = taux x2 (non utilisé pour l'instant)
  guaranteed?: boolean; // Garanti au premier legendary
  focusChance?: number; // ✅ NOUVEAU : Probabilité d'obtenir ce héros focus (0-1, ex: 0.75 = 75%)
}

// Interface pour les coûts de bannière
export interface IBannerCost {
  singlePull: {
    gems?: number;
    tickets?: number;
    specialCurrency?: number;
    mythicScrolls?: number;  // ✅ NOUVEAU
  };
  multiPull: {
    gems?: number;
    tickets?: number;
    specialCurrency?: number;
    mythicScrolls?: number;  // ✅ NOUVEAU
  };
  firstPullDiscount?: {
    gems?: number;
    tickets?: number;
  };
}

// Interface pour la bannière
export interface IBanner {
  _id?: string;
  bannerId: string;
  name: string;
  type: "Standard" | "Limited" | "Event" | "Beginner" | "Weapon" | "Mythic"; 
  description: string;
  
  // Timing
  startTime: Date;
  endTime: Date;
  timezone: string;
  
  // Configuration serveur
  serverConfig: {
    allowedServers: string[]; // ["S1", "S2"] ou ["ALL"]
    region?: string[];
  };
  
  // Visibilité et état
  isActive: boolean;
  isVisible: boolean;
  sortOrder: number; // Ordre d'affichage
  
  // Pool de héros disponibles
  heroPool: {
    includeAll: boolean; // true = tous les héros, false = liste spécifique
    specificHeroes?: string[]; // IDs des héros si includeAll = false
    excludedHeroes?: string[]; // Héros à exclure même si includeAll = true
    rarityFilters?: string[]; // Filtrer par rareté ["Epic", "Legendary"]
  };
  
  // Héros en vedette (rate-up)
  focusHeroes: IFocusHero[];
  
  // Taux de drop
  rates: IBannerRates;
  
  // Coûts
  costs: IBannerCost;

  elementalConfig?: {
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Shadow";
  ticketCost: number;
  rotationDays: string[]; // ["monday", "sunday"], etc.
  };
  
  // Système de pity spécifique à cette bannière
  pityConfig?: {
    legendaryPity?: number; // Override du pity système
    epicPity?: number;
    sharedPity?: boolean; // Partage le compteur avec d'autres bannières
    resetOnBannerEnd?: boolean;
  };
  
  // Limites
  limits: {
    maxPullsPerPlayer?: number; // -1 = illimité
    maxPullsPerDay?: number;
    firstTimePullBonus?: boolean;
  };
  
  // Récompenses bonus
  bonusRewards: {
    milestones: {
      pullCount: number;
      rewards: {
        type: "currency" | "hero" | "material";
        quantity: number;
        itemId?: string;
      }[];
    }[];
  };
  
  // Métadonnées visuelles
  bannerImage: string;
  iconImage: string;
  backgroundMusic?: string;
  animationType?: "standard" | "rainbow" | "special";
  
  // Statistiques
  stats: {
    totalPulls: number;
    totalPlayers: number;
    averagePullsPerPlayer: number;
    legendaryCount: number;
    epicCount: number;
  };
  
  // Tags et métadonnées
  tags: string[]; // ["newbie", "limited", "anniversary"]
  category: string; // "Character", "Weapon", "Special"
}

interface IBannerDocument extends Document {
  bannerId: string;
  name: string;
  type: "Standard" | "Limited" | "Event" | "Beginner" | "Weapon" | "Mythic";
  description: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  serverConfig: {
    allowedServers: string[];
    region?: string[];
  };
  isActive: boolean;
  isVisible: boolean;
  sortOrder: number;
  heroPool: {
    includeAll: boolean;
    specificHeroes?: string[];
    excludedHeroes?: string[];
    rarityFilters?: string[];
  };
  focusHeroes: IFocusHero[];
  rates: IBannerRates;
  costs: IBannerCost;
  elementalConfig?: {
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Shadow";
  ticketCost: number;
  rotationDays: string[];
  };
  pityConfig?: {
    legendaryPity?: number;
    epicPity?: number;
    sharedPity?: boolean;
    resetOnBannerEnd?: boolean;
  };
  limits: {
    maxPullsPerPlayer?: number;
    maxPullsPerDay?: number;
    firstTimePullBonus?: boolean;
  };
  bonusRewards: {
    milestones: {
      pullCount: number;
      rewards: {
        type: "currency" | "hero" | "material";
        quantity: number;
        itemId?: string;
      }[];
    }[];
  };
  bannerImage: string;
  iconImage: string;
  backgroundMusic?: string;
  animationType?: "standard" | "rainbow" | "special";
  stats: {
    totalPulls: number;
    totalPlayers: number;
    averagePullsPerPlayer: number;
    legendaryCount: number;
    epicCount: number;
  };
  tags: string[];
  category: string;
  
  // Méthodes d'instance
  isCurrentlyActive(): boolean;
  getAvailableHeroes(): Promise<any[]>;
  canPlayerPull(playerId: string): Promise<{ canPull: boolean; reason?: string }>;
  updateStats(pullCount: number, rarities: string[]): Promise<IBannerDocument>;
}

// Schéma de la bannière
const bannerSchema = new Schema<IBannerDocument>({
  bannerId: {
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
  type: {
    type: String,
    enum: ["Standard", "Limited", "Event", "Beginner", "Weapon", "Mythic"],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(this: IBannerDocument, endTime: Date) {
        return endTime > this.startTime;
      },
      message: "End time must be after start time"
    }
  },
  timezone: {
    type: String,
    default: "UTC",
    match: /^[A-Za-z]+\/[A-Za-z_]+$|^UTC$/
  },
  
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
  
  heroPool: {
    includeAll: {
      type: Boolean,
      default: true
    },
    specificHeroes: [{
      type: String
    }],
    excludedHeroes: [{
      type: String
    }],
    rarityFilters: [{
      type: String,
      enum: ["Common", "Rare", "Epic", "Legendary", "Mythic"]
    }]
  },
  
  // ✅ MODIFICATION : Ajout de focusChance
  focusHeroes: [{
    heroId: {
      type: String,
      required: true
    },
    rateUpMultiplier: {
      type: Number,
      required: true,
      min: 1.0,
      max: 10.0
    },
    guaranteed: {
      type: Boolean,
      default: false
    },
    focusChance: {
      type: Number,
      default: 0.5,  // Défaut 50%
      min: 0.0,      // Minimum 0% (jamais focus)
      max: 1.0       // Maximum 100% (toujours focus)
    }
  }],
  
  // ✅ MODIFICATION : Suppression de focusRateUp obsolète
  rates: {
    Common: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    Rare: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    Epic: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    Legendary: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    Mythic: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0
    }
    // ❌ SUPPRIMÉ : focusRateUp (obsolète)
  },
  
  costs: {
    singlePull: {
      gems: { type: Number, min: 0 },
      tickets: { type: Number, min: 0 },
      specialCurrency: { type: Number, min: 0 },
      mythicScrolls: { type: Number, min: 0 }
    },
    multiPull: {
      gems: { type: Number, min: 0 },
      tickets: { type: Number, min: 0 },
      specialCurrency: { type: Number, min: 0 },
      mythicScrolls: { type: Number, min: 0 }
    },
    firstPullDiscount: {
      gems: { type: Number, min: 0 },
      tickets: { type: Number, min: 0 }
    }
  },
  elementalConfig: {
  element: {
    type: String,
    enum: ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"],
    sparse: true
  },
  ticketCost: {
    type: Number,
    min: 0,
    default: 1
  },
  rotationDays: [{
    type: String,
    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    lowercase: true
  }]
  },
  pityConfig: {
    legendaryPity: { type: Number, min: 1, max: 200 },
    epicPity: { type: Number, min: 0, max: 50 },
    sharedPity: { type: Boolean, default: false },
    resetOnBannerEnd: { type: Boolean, default: false }
  },
  
  limits: {
    maxPullsPerPlayer: { type: Number, default: -1 },
    maxPullsPerDay: { type: Number, default: -1 },
    firstTimePullBonus: { type: Boolean, default: false }
  },
  
  bonusRewards: {
    milestones: [{
      pullCount: { type: Number, required: true, min: 1 },
      rewards: [{
        type: {
          type: String,
          enum: ["currency", "hero", "material"],
          required: true
        },
        quantity: { type: Number, required: true, min: 1 },
        itemId: { type: String }
      }]
    }]
  },
  
  bannerImage: {
    type: String,
    required: true,
    match: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i
  },
  iconImage: {
    type: String,
    required: true,
    match: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i
  },
  backgroundMusic: {
    type: String,
    match: /^https?:\/\/.+\.(mp3|wav|ogg)$/i
  },
  animationType: {
    type: String,
    enum: ["standard", "rainbow", "special"],
    default: "standard"
  },
  
  stats: {
    totalPulls: { type: Number, default: 0, min: 0 },
    totalPlayers: { type: Number, default: 0, min: 0 },
    averagePullsPerPlayer: { type: Number, default: 0, min: 0 },
    legendaryCount: { type: Number, default: 0, min: 0 },
    epicCount: { type: Number, default: 0, min: 0 }
  },
  
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  category: {
    type: String,
    required: true,
    enum: ["Character", "Weapon", "Special"]
  }
}, {
  timestamps: true,
  collection: 'banners'
});

// Index pour optimiser les requêtes
bannerSchema.index({ bannerId: 1 });
bannerSchema.index({ type: 1, isActive: 1, isVisible: 1 });
bannerSchema.index({ startTime: 1, endTime: 1 });
bannerSchema.index({ "serverConfig.allowedServers": 1 });
bannerSchema.index({ sortOrder: 1, startTime: -1 });
bannerSchema.index({ "elementalConfig.element": 1 });
bannerSchema.index({ "elementalConfig.element": 1, isActive: 1, isVisible: 1 });
// Validation des taux (doivent additionner à 100%)
bannerSchema.pre('save', function(next) {
  const total = this.rates.Common + this.rates.Rare + this.rates.Epic + this.rates.Legendary;
  if (Math.abs(total - 100) > 0.1) { // Tolérance de 0.1%
    return next(new Error(`Banner rates must add up to 100% (current: ${total}%)`));
  }
  next();
});

// Méthodes statiques
bannerSchema.statics.getActiveBanners = function(serverId: string) {
  const now = new Date();
  return this.find({
    isActive: true,
    isVisible: true,
    startTime: { $lte: now },
    endTime: { $gte: now },
    $or: [
      { "serverConfig.allowedServers": serverId },
      { "serverConfig.allowedServers": "ALL" }
    ]
  }).sort({ sortOrder: -1, startTime: -1 });
};

bannerSchema.statics.getBannerById = function(bannerId: string, serverId: string) {
  return this.findOne({
    bannerId,
    $or: [
      { "serverConfig.allowedServers": serverId },
      { "serverConfig.allowedServers": "ALL" }
    ]
  });
};
bannerSchema.statics.getElementalBanners = function(serverId: string, element?: string) {
  const query: any = {
    isActive: true,
    isVisible: true,
    startTime: { $lte: new Date() },
    endTime: { $gte: new Date() },
    "elementalConfig.element": { $exists: true },
    $or: [
      { "serverConfig.allowedServers": serverId },
      { "serverConfig.allowedServers": "ALL" }
    ]
  };
  
  if (element) {
    query["elementalConfig.element"] = element;
  }
  
  return this.find(query).sort({ sortOrder: -1 });
};

bannerSchema.statics.getElementalBannerByElement = function(serverId: string, element: string) {
  return this.findOne({
    isActive: true,
    isVisible: true,
    startTime: { $lte: new Date() },
    endTime: { $gte: new Date() },
    "elementalConfig.element": element,
    $or: [
      { "serverConfig.allowedServers": serverId },
      { "serverConfig.allowedServers": "ALL" }
    ]
  });
};
// Méthodes d'instance
bannerSchema.methods.isCurrentlyActive = function(): boolean {
  const now = new Date();
  return this.isActive && 
         this.isVisible && 
         this.startTime <= now && 
         this.endTime >= now;
};
bannerSchema.methods.isElementalBanner = function(): boolean {
  return !!this.elementalConfig && !!this.elementalConfig.element;
};

bannerSchema.methods.getAvailableHeroes = async function() {
  const Hero = mongoose.model('Hero');
  
  if (this.heroPool.includeAll) {
    // Tous les héros sauf les exclus
    const filter: any = {};
    
    if (this.heroPool.excludedHeroes && this.heroPool.excludedHeroes.length > 0) {
      // ✅ Supporter exclusion par name OU _id
      const excludedByName = await Hero.find(
        { name: { $in: this.heroPool.excludedHeroes } },
        { _id: 1 }
      );
      const excludedIds = [
        ...this.heroPool.excludedHeroes.filter((id: string) => id.match(/^[0-9a-fA-F]{24}$/)), // ObjectIds
        ...excludedByName.map((h: any) => h._id)  // Noms convertis en _id
      ];
      
      if (excludedIds.length > 0) {
        filter._id = { $nin: excludedIds };
      }
    }
    
    if (this.heroPool.rarityFilters && this.heroPool.rarityFilters.length > 0) {
      filter.rarity = { $in: this.heroPool.rarityFilters };
    }
    
    return await Hero.find(filter);
  } else {
    // ✅ Liste spécifique - Supporter name OU _id
    
    // Séparer les ObjectIds valides des noms
    const objectIds = this.heroPool.specificHeroes?.filter((id: string) => 
      id.match(/^[0-9a-fA-F]{24}$/)  // Pattern ObjectId MongoDB
    ) || [];
    
    const names = this.heroPool.specificHeroes?.filter((id: string) => 
      !id.match(/^[0-9a-fA-F]{24}$/)  // Tout ce qui n'est pas un ObjectId = nom
    ) || [];
    
    // Construire la requête avec $or pour chercher par _id OU name
    const query: any = {};
    
    if (objectIds.length > 0 && names.length > 0) {
      // Les deux types existent
      query.$or = [
        { _id: { $in: objectIds } },
        { name: { $in: names } }
      ];
    } else if (objectIds.length > 0) {
      // Seulement des ObjectIds
      query._id = { $in: objectIds };
    } else if (names.length > 0) {
      // Seulement des noms
      query.name = { $in: names };
    } else {
      // Aucun héros spécifié - retourner vide
      return [];
    }
    
    return await Hero.find(query);
  }
};

bannerSchema.methods.canPlayerPull = async function(playerId: string) {
  // TODO: Vérifier les limites par joueur
  // Pour l'instant, toujours autorisé
  return { canPull: true };
};

bannerSchema.methods.updateStats = function(pullCount: number, rarities: string[]) {
  this.stats.totalPulls += pullCount;
  this.stats.legendaryCount += rarities.filter(r => r === "Legendary").length;
  this.stats.epicCount += rarities.filter(r => r === "Epic").length;
  
  // Recalculer la moyenne (approximative)
  if (this.stats.totalPlayers > 0) {
    this.stats.averagePullsPerPlayer = this.stats.totalPulls / this.stats.totalPlayers;
  }
  
  return this.save();
};

export default mongoose.model<IBannerDocument>("Banner", bannerSchema);

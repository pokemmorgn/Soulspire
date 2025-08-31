// src/models/ShopItem.ts
import mongoose, { Document, Schema } from "mongoose";

export interface IShopItemTemplate {
  _id?: string;
  itemId: string;
  name: string;
  description?: string;
  type: "Currency" | "Fragment" | "Material" | "Equipment" | "Hero" | "Ticket";
  subType?: string; // Ex: "gold", "fire_fragment", "evolution_basic"
  quantity: number;
  cost: {
    gold?: number;
    gems?: number;
    paidGems?: number;
  };
  maxPurchases: number; // -1 = illimité
  rarity?: "Common" | "Rare" | "Epic" | "Legendary";
  discount?: number; // Pourcentage de réduction
  
  // Configuration d'apparition dans les shops
  shopAvailability: {
    daily: {
      enabled: boolean;
      weight: number; // Probabilité d'apparition (1-100)
      maxAppearances: number; // Par reset
    };
    weekly: {
      enabled: boolean;
      weight: number;
      maxAppearances: number;
    };
    monthly: {
      enabled: boolean;
      weight: number;
      maxAppearances: number;
    };
    premium: {
      enabled: boolean;
      featured?: boolean; // Toujours visible dans premium
    };
  };
  
  // Conditions d'apparition
  requirements?: {
    minPlayerLevel?: number;
    maxPlayerLevel?: number;
    minWorld?: number;
    requiredHero?: string; // ID d'un héros requis
    excludeIfOwned?: boolean; // Ne pas apparaître si le joueur possède déjà l'item/héros
  };
  
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface IShopItemTemplateDocument extends Document {
  itemId: string;
  name: string;
  description?: string;
  type: "Currency" | "Fragment" | "Material" | "Equipment" | "Hero" | "Ticket";
  subType?: string;
  quantity: number;
  cost: {
    gold?: number;
    gems?: number;
    paidGems?: number;
  };
  maxPurchases: number;
  rarity?: "Common" | "Rare" | "Epic" | "Legendary";
  discount?: number;
  shopAvailability: {
    daily: {
      enabled: boolean;
      weight: number;
      maxAppearances: number;
    };
    weekly: {
      enabled: boolean;
      weight: number;
      maxAppearances: number;
    };
    monthly: {
      enabled: boolean;
      weight: number;
      maxAppearances: number;
    };
    premium: {
      enabled: boolean;
      featured?: boolean;
    };
  };
  requirements?: {
    minPlayerLevel?: number;
    maxPlayerLevel?: number;
    minWorld?: number;
    requiredHero?: string;
    excludeIfOwned?: boolean;
  };
  active: boolean;
  isAvailableForShop(shopType: string, playerLevel: number, playerWorld: number): boolean;
  calculateFinalCost(): { gold: number; gems: number; paidGems: number };
}

const shopItemTemplateSchema = new Schema<IShopItemTemplateDocument>({
  itemId: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String, 
    maxlength: 500,
    trim: true
  },
  type: { 
    type: String, 
    enum: ["Currency", "Fragment", "Material", "Equipment", "Hero", "Ticket"],
    required: true 
  },
  subType: { 
    type: String, 
    trim: true
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  cost: {
    gold: { type: Number, min: 0, default: 0 },
    gems: { type: Number, min: 0, default: 0 },
    paidGems: { type: Number, min: 0, default: 0 }
  },
  maxPurchases: { 
    type: Number, 
    default: 1,
    validate: {
      validator: function(v: number) {
        return v === -1 || v > 0;
      },
      message: 'maxPurchases must be -1 (unlimited) or greater than 0'
    }
  },
  rarity: { 
    type: String, 
    enum: ["Common", "Rare", "Epic", "Legendary"]
  },
  discount: { 
    type: Number, 
    min: 0, 
    max: 90, 
    default: 0 
  },

  // Configuration des shops
  shopAvailability: {
    daily: {
      enabled: { type: Boolean, default: false },
      weight: { type: Number, min: 1, max: 100, default: 50 },
      maxAppearances: { type: Number, min: 1, default: 1 }
    },
    weekly: {
      enabled: { type: Boolean, default: false },
      weight: { type: Number, min: 1, max: 100, default: 30 },
      maxAppearances: { type: Number, min: 1, default: 1 }
    },
    monthly: {
      enabled: { type: Boolean, default: false },
      weight: { type: Number, min: 1, max: 100, default: 20 },
      maxAppearances: { type: Number, min: 1, default: 1 }
    },
    premium: {
      enabled: { type: Boolean, default: false },
      featured: { type: Boolean, default: false }
    }
  },

  // Conditions d'apparition
  requirements: {
    minPlayerLevel: { type: Number, min: 1 },
    maxPlayerLevel: { type: Number, min: 1 },
    minWorld: { type: Number, min: 1 },
    requiredHero: { type: String },
    excludeIfOwned: { type: Boolean, default: false }
  },

  active: { type: Boolean, default: true }
}, {
  timestamps: true,
  collection: 'shop_item_templates'
});

// Index pour optimiser les requêtes
shopItemTemplateSchema.index({ itemId: 1 });
shopItemTemplateSchema.index({ type: 1 });
shopItemTemplateSchema.index({ rarity: 1 });
shopItemTemplateSchema.index({ active: 1 });
shopItemTemplateSchema.index({ "shopAvailability.daily.enabled": 1 });
shopItemTemplateSchema.index({ "shopAvailability.weekly.enabled": 1 });
shopItemTemplateSchema.index({ "shopAvailability.monthly.enabled": 1 });
shopItemTemplateSchema.index({ "shopAvailability.premium.enabled": 1 });

// Méthodes statiques pour récupération par shop
shopItemTemplateSchema.statics.getAvailableForShop = function(shopType: string, playerLevel: number = 1, playerWorld: number = 1) {
  const shopField = `shopAvailability.${shopType.toLowerCase()}`;
  
  const baseQuery: any = {
    active: true,
    [`${shopField}.enabled`]: true
  };

  // Filtres par niveau/monde si spécifiés
  if (playerLevel > 1) {
    baseQuery.$or = [
      { "requirements.minPlayerLevel": { $exists: false } },
      { "requirements.minPlayerLevel": { $lte: playerLevel } }
    ];
  }

  if (playerLevel > 1) {
    baseQuery.$and = baseQuery.$and || [];
    baseQuery.$and.push({
      $or: [
        { "requirements.maxPlayerLevel": { $exists: false } },
        { "requirements.maxPlayerLevel": { $gte: playerLevel } }
      ]
    });
  }

  if (playerWorld > 1) {
    baseQuery.$and = baseQuery.$and || [];
    baseQuery.$and.push({
      $or: [
        { "requirements.minWorld": { $exists: false } },
        { "requirements.minWorld": { $lte: playerWorld } }
      ]
    });
  }

  return this.find(baseQuery).sort({ [`${shopField}.weight`]: -1 });
};

shopItemTemplateSchema.statics.getFeaturedPremiumItems = function() {
  return this.find({
    active: true,
    "shopAvailability.premium.enabled": true,
    "shopAvailability.premium.featured": true
  }).sort({ rarity: -1 });
};

shopItemTemplateSchema.statics.getByType = function(itemType: string) {
  return this.find({
    active: true,
    type: itemType
  }).sort({ name: 1 });
};

shopItemTemplateSchema.statics.getByRarity = function(rarity: string) {
  return this.find({
    active: true,
    rarity: rarity
  }).sort({ name: 1 });
};

// Méthodes d'instance
shopItemTemplateSchema.methods.isAvailableForShop = function(
  shopType: string, 
  playerLevel: number, 
  playerWorld: number
): boolean {
  if (!this.active) return false;
  
  const shopConfig = this.shopAvailability[shopType.toLowerCase() as keyof typeof this.shopAvailability];
  if (!shopConfig || !shopConfig.enabled) return false;

  // Vérifier les requirements
  if (this.requirements) {
    if (this.requirements.minPlayerLevel && playerLevel < this.requirements.minPlayerLevel) {
      return false;
    }
    if (this.requirements.maxPlayerLevel && playerLevel > this.requirements.maxPlayerLevel) {
      return false;
    }
    if (this.requirements.minWorld && playerWorld < this.requirements.minWorld) {
      return false;
    }
  }

  return true;
};

shopItemTemplateSchema.methods.calculateFinalCost = function() {
  const baseCost = {
    gold: this.cost.gold || 0,
    gems: this.cost.gems || 0,
    paidGems: this.cost.paidGems || 0
  };

  if (this.discount && this.discount > 0) {
    const multiplier = (100 - this.discount) / 100;
    return {
      gold: Math.floor(baseCost.gold * multiplier),
      gems: Math.floor(baseCost.gems * multiplier),
      paidGems: Math.floor(baseCost.paidGems * multiplier)
    };
  }

  return baseCost;
};

export default mongoose.model<IShopItemTemplateDocument>("ShopItemTemplate", shopItemTemplateSchema);

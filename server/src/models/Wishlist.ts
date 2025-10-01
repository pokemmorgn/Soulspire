// server/src/models/Wishlist.ts

import mongoose, { Document, Schema } from "mongoose";

export interface IWishlistHero {
  heroId: string;
  addedAt: Date;
  itemCost?: {
    itemId: string;           // ID de l'item requis (ex: "wishlist_token")
    quantity: number;         // Quantité requise
    paidAt?: Date;            // Date de paiement (pour audit)
  };
}

export interface IWishlist {
  playerId: string;
  serverId: string;
  
  // Configuration
  type: "normal" | "elemental";  // Pour futur système élémentaire
  element?: string;              // Si type = "elemental"
  
  // Héros
  heroes: IWishlistHero[];
  maxHeroes: number;             // Configurable (défaut 4)
  
  // Pity
  pityCounter: number;
  pityThreshold: number;         // Configurable (défaut 100)
  lastPityReset: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

interface IWishlistDocument extends Document {
  playerId: string;
  serverId: string;
  type: "normal" | "elemental";
  element?: string;
  heroes: IWishlistHero[];
  maxHeroes: number;
  pityCounter: number;
  pityThreshold: number;
  lastPityReset: Date;
  
  // Méthodes
  canAddHero(): boolean;
  addHero(heroId: string, itemCost?: { itemId: string; quantity: number }): Promise<void>;
  removeHero(heroId: string): Promise<void>;
  incrementPity(): void;
  resetPity(): void;
  isPityTriggered(): boolean;
}

const wishlistSchema = new Schema<IWishlistDocument>({
  playerId: {
    type: String,
    required: true,
    index: true
  },
  serverId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ["normal", "elemental"],
    default: "normal"
  },
  element: {
    type: String,
    enum: ["Fire", "Water", "Wind", "Electric", "Light", "Dark"],
    required: function(this: IWishlistDocument) {
      return this.type === "elemental";
    }
  },
  heroes: [{
    heroId: {
      type: String,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    itemCost: {
      itemId: { type: String },
      quantity: { type: Number, min: 0 },
      paidAt: { type: Date }
    }
  }],
  maxHeroes: {
    type: Number,
    default: 4,
    min: 1,
    max: 10
  },
  pityCounter: {
    type: Number,
    default: 0,
    min: 0
  },
  pityThreshold: {
    type: Number,
    default: 100,
    min: 1
  },
  lastPityReset: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'wishlists'
});

//  Index composé pour unicité (permet plusieurs wishlists par joueur)
  wishlistSchema.index({ playerId: 1, serverId: 1, type: 1 }, { 
    unique: true,
    partialFilterExpression: { type: 'normal' }
  });
  
  // ✅ NOUVEAU: Index unique pour wishlists élémentaires (une par élément)
  wishlistSchema.index({ playerId: 1, serverId: 1, type: 1, element: 1 }, { 
    unique: true,
    partialFilterExpression: { type: 'elemental', element: { $exists: true } }
  });

// Méthodes d'instance
wishlistSchema.methods.canAddHero = function(): boolean {
  return this.heroes.length < this.maxHeroes;
};

wishlistSchema.methods.addHero = async function(
  heroId: string, 
  itemCost?: { itemId: string; quantity: number }
): Promise<void> {
  if (!this.canAddHero()) {
    throw new Error(`Wishlist is full (max ${this.maxHeroes} heroes)`);
  }
  
  // Vérifier si déjà dans la wishlist
  if (this.heroes.some((h: IWishlistHero) => h.heroId === heroId)) {
    throw new Error("Hero already in wishlist");
  }
  
  // Vérifier que le héros existe et est Legendary
  const Hero = mongoose.model('Hero');
  const hero = await Hero.findById(heroId);
  if (!hero) {
    throw new Error("Hero not found");
  }
  if (hero.rarity !== "Legendary") {
    throw new Error("Only Legendary heroes can be added to wishlist");
  }
  
  // ✅ Futur : Vérifier et déduire l'item si coût requis
  if (itemCost) {
    // TODO: Implémenter la vérification et déduction d'items
    // const player = await Player.findById(this.playerId);
    // if (!player.hasItem(itemCost.itemId, itemCost.quantity)) {
    //   throw new Error(`Insufficient ${itemCost.itemId}`);
    // }
    // player.removeItem(itemCost.itemId, itemCost.quantity);
    // await player.save();
  }
  
  this.heroes.push({
    heroId,
    addedAt: new Date(),
    itemCost: itemCost ? { ...itemCost, paidAt: new Date() } : undefined
  });
  
  await this.save();
};

wishlistSchema.methods.removeHero = async function(heroId: string): Promise<void> {
  const index = this.heroes.findIndex((h: IWishlistHero) => h.heroId === heroId);
  if (index === -1) {
    throw new Error("Hero not in wishlist");
  }
  
  this.heroes.splice(index, 1);
  await this.save();
};

wishlistSchema.methods.incrementPity = function(): void {
  this.pityCounter++;
};

wishlistSchema.methods.resetPity = function(): void {
  this.pityCounter = 0;
  this.lastPityReset = new Date();
};

wishlistSchema.methods.isPityTriggered = function(): boolean {
  return this.pityCounter >= this.pityThreshold - 1; // Déclenche à 99
};

export type { IWishlistDocument };

export default mongoose.model<IWishlistDocument>("Wishlist", wishlistSchema);

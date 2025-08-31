import mongoose, { Document, Schema } from "mongoose";
import { IPlayer, IPlayerHero } from "../types/index";

interface IPlayerDocument extends Document {
  username: string;
  password: string;
  gold: number;
  gems: number;
  paidGems: number;
  world: number;
  level: number;
  backgroundId?: string; // <-- nouveau champ optionnel
  difficulty: "Normal" | "Hard" | "Nightmare";
  heroes: IPlayerHero[];
  tickets: number;
  fragments: Map<string, number>;
  materials: Map<string, number>;
  createdAt?: Date;
  addHero(heroId: string, level?: number, stars?: number): any;
  getEquippedHeroes(): IPlayerHero[];
  canAfford(cost: { gold?: number, gems?: number, paidGems?: number }): boolean;
  spendCurrency(cost: { gold?: number, gems?: number, paidGems?: number }): any;
}

const playerHeroSchema = new Schema<IPlayerHero>({
  heroId: { 
    type: String,
    required: true 
  },
  level: { 
    type: Number, 
    default: 1,
    min: 1,
    max: 100
  },
  stars: { 
    type: Number, 
    default: 1,
    min: 1,
    max: 6
  },
  equipped: { 
    type: Boolean, 
    default: false 
  }
});

const playerSchema = new Schema<IPlayerDocument>({
  username: { 
    type: String, 
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },

  // Monnaies
  gold: { 
    type: Number, 
    default: 1000,
    min: 0
  },
  gems: { 
    type: Number, 
    default: 100,
    min: 0
  },
  paidGems: { 
    type: Number, 
    default: 0,
    min: 0
  },

  // Progression campagne
  world: { 
    type: Number, 
    default: 1,
    min: 1
  },
  level: { 
    type: Number, 
    default: 1,
    min: 1
  },
    backgroundId: { // <-- nouveau champ
    type: String,
    default: null
  },
  difficulty: { 
    type: String, 
    enum: ["Normal", "Hard", "Nightmare"],
    default: "Normal"
  },

  // Héros possédés
  heroes: [playerHeroSchema],

  // Inventaire intégré
  tickets: { 
    type: Number, 
    default: 0,
    min: 0
  },
  fragments: { 
    type: Map, 
    of: Number, 
    default: new Map()
  },
  materials: { 
    type: Map, 
    of: Number, 
    default: new Map()
  }
}, {
  timestamps: true,
  collection: 'players'
});

// Index pour optimiser les requêtes
playerSchema.index({ username: 1 });
playerSchema.index({ level: -1 });
playerSchema.index({ createdAt: -1 });

// Méthodes d'instance
playerSchema.methods.addHero = function(heroId: string, level: number = 1, stars: number = 1) {
  this.heroes.push({
    heroId,
    level,
    stars,
    equipped: false
  });
  return this.save();
};

playerSchema.methods.getEquippedHeroes = function() {
  return this.heroes.filter((hero: IPlayerHero) => hero.equipped);
};

playerSchema.methods.canAfford = function(cost: { gold?: number, gems?: number, paidGems?: number }) {
  if (cost.gold && this.gold < cost.gold) return false;
  if (cost.gems && this.gems < cost.gems) return false;
  if (cost.paidGems && this.paidGems < cost.paidGems) return false;
  return true;
};

playerSchema.methods.spendCurrency = function(cost: { gold?: number, gems?: number, paidGems?: number }) {
  if (!this.canAfford(cost)) {
    throw new Error("Insufficient currency");
  }
  
  if (cost.gold) this.gold -= cost.gold;
  if (cost.gems) this.gems -= cost.gems;
  if (cost.paidGems) this.paidGems -= cost.paidGems;
  
  return this.save();
};

export default mongoose.model<IPlayerDocument>("Player", playerSchema);


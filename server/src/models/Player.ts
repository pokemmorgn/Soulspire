import mongoose, { Document, Schema } from "mongoose";
import { IPlayer, IPlayerHero } from "../types/index";

interface IFormationSlot {
  slot: number;
  heroId: string;
}

interface IFormation {
  _id?: string;
  name: string;
  slots: IFormationSlot[];
}

interface IPlayerDocument extends Document {
  serverId: string;
  username: string;
  password: string;
  gold: number;
  gems: number;
  paidGems: number;
  world: number;
  level: number;
  backgroundId?: string; 
  avatarId?: string;
  difficulty: "Normal" | "Hard" | "Nightmare";
  vipLevel: number;
  vipExperience: number;
  formationId?: string;
  formations: IFormation[];
  heroes: IPlayerHero[];
  tickets: number;
  fragments: Map<string, number>;
  materials: Map<string, number>;
  createdAt?: Date;
  lastSeenAt?: Date;
  addHero(heroId: string, level?: number, stars?: number): any;
  getEquippedHeroes(): IPlayerHero[];
  setFormation(formationId: string, slots: { slot: number, heroId: string }[]): any;
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
  },
  slot: {
    type: Number,
    min: 1,
    max: 9,
    default: null
  }
});

const formationSchema = new Schema<IFormation>({
  name: { type: String, required: true },
  slots: [{
    slot: { type: Number, required: true, min: 1, max: 9 },
    heroId: { type: String, required: true }
  }]
}, { _id: true });

const playerSchema = new Schema<IPlayerDocument>({
  serverId: { 
    type: String,
    required: true,
    match: /^S\d+$/,
    default: "S1"
  },
  username: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },

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
  backgroundId: { 
    type: String,
    default: null
  },
  avatarId: { 
    type: String,
    default: null
  },
  difficulty: { 
    type: String, 
    enum: ["Normal", "Hard", "Nightmare"],
    default: "Normal"
  },

  vipLevel: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 15
  },
  vipExperience: { 
    type: Number, 
    default: 0,
    min: 0
  },

  formationId: { 
    type: String,
    default: null
  },

  formations: { 
    type: [formationSchema],
    default: []
  },

  heroes: [playerHeroSchema],

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
  },
  lastSeenAt: {
    type: Date,
    default: () => new Date()
  }
}, {
  timestamps: true,
  collection: 'players'
});

playerSchema.index({ username: 1, serverId: 1 }, { unique: true });
playerSchema.index({ level: -1 });
playerSchema.index({ createdAt: -1 });
playerSchema.index({ lastSeenAt: -1 });
playerSchema.index({ vipLevel: -1 });

playerSchema.methods.addHero = function(heroId: string, level: number = 1, stars: number = 1) {
  this.heroes.push({
    heroId,
    level,
    stars,
    equipped: false,
    slot: null
  });
  return this.save();
};

playerSchema.methods.getEquippedHeroes = function() {
  return this.heroes.filter((hero: IPlayerHero) => hero.equipped);
};

playerSchema.methods.setFormation = function(formationId: string, slots: { slot: number, heroId: string }[]) {
  this.formationId = formationId;

  this.heroes.forEach((h: IPlayerHero) => {
    h.slot = null;
    h.equipped = false;
  });

  slots.forEach(({ slot, heroId }) => {
    const hero = this.heroes.find((h: IPlayerHero) => h.heroId === heroId);
    if (hero) {
      hero.slot = slot;
      hero.equipped = true;
    }
  });

  return this.save();
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

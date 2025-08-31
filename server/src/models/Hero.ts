import mongoose, { Document, Schema } from "mongoose";
import { IHero } from "../types/index";

interface IHeroDocument extends IHero, Document {}

const heroSchema = new Schema<IHeroDocument>({
  name: { 
    type: String, 
    required: true,
    trim: true,
    unique: true
  },
  role: { 
    type: String, 
    enum: ["Tank", "DPS Melee", "DPS Ranged", "Support"],
    required: true
  },
  element: { 
    type: String, 
    enum: ["Fire", "Water", "Wind", "Electric", "Light", "Dark"],
    required: true
  },
  rarity: { 
    type: String, 
    enum: ["Common", "Rare", "Epic", "Legendary"],
    required: true
  },

  // Stats de base
  baseStats: {
    hp: { 
      type: Number, 
      required: true,
      min: 100,
      max: 10000
    },
    atk: { 
      type: Number, 
      required: true,
      min: 10,
      max: 2000
    },
    def: { 
      type: Number, 
      required: true,
      min: 10,
      max: 1000
    }
  },

  // Compétence signature
  skill: {
    name: { 
      type: String, 
      required: true,
      trim: true
    },
    description: { 
      type: String, 
      required: true,
      maxlength: 500
    },
    type: { 
      type: String, 
      enum: ["Heal", "Buff", "AoE", "Control", "Damage"],
      required: true
    }
  }
}, {
  timestamps: true,
  collection: 'heroes'
});

// Index pour optimiser les requêtes
heroSchema.index({ rarity: 1 });
heroSchema.index({ role: 1 });
heroSchema.index({ element: 1 });
heroSchema.index({ name: 1 });

// Méthodes statiques pour les drop rates
heroSchema.statics.getDropRates = function() {
  return {
    Common: 50,
    Rare: 30,
    Epic: 15,
    Legendary: 5
  };
};

heroSchema.statics.getRandomRarity = function(): string {
  const rand = Math.random() * 100;
  if (rand < 50) return "Common";
  if (rand < 80) return "Rare";
  if (rand < 95) return "Epic";
  return "Legendary";
};

// Méthodes d'instance
heroSchema.methods.getStatsAtLevel = function(level: number, stars: number = 1) {
  const levelMultiplier = 1 + (level - 1) * 0.1;
  const starMultiplier = 1 + (stars - 1) * 0.2;
  
  return {
    hp: Math.floor(this.baseStats.hp * levelMultiplier * starMultiplier),
    atk: Math.floor(this.baseStats.atk * levelMultiplier * starMultiplier),
    def: Math.floor(this.baseStats.def * levelMultiplier * starMultiplier)
  };
};

heroSchema.methods.getRarityMultiplier = function(): number {
  const multipliers = {
    Common: 1,
    Rare: 1.25,
    Epic: 1.5,
    Legendary: 2
  };
  return multipliers[this.rarity] || 1;
};

heroSchema.methods.getElementAdvantage = function(targetElement: string): number {
  const advantages: { [key: string]: string[] } = {
    Fire: ["Wind"],
    Water: ["Fire"],
    Wind: ["Electric"],
    Electric: ["Water"],
    Light: ["Dark"],
    Dark: ["Light"]
  };
  
  if (advantages[this.element]?.includes(targetElement)) return 1.5;
  if (advantages[targetElement]?.includes(this.element)) return 0.75;
  return 1;
};

export default mongoose.model<IHeroDocument>("Hero", heroSchema);

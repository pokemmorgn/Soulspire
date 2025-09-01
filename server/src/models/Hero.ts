import mongoose, { Document, Schema } from "mongoose";
import { IHero } from "../types/index";

interface IHeroDocument extends Document {
  name: string;
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    defMagique: number;
    vitesse: number;
    intelligence: number;
    force: number;
    moral: number;
    reductionCooldown: number;
  };
  skill: {
    name: string;
    description: string;
    type: "Heal" | "Buff" | "AoE" | "Control" | "Damage";
    cooldown: number;
    energyCost: number;
  };
  getStatsAtLevel(level: number, stars?: number): any;
  getRarityMultiplier(): number;
  getElementAdvantage(targetElement: string): number;
}

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

  // Stats de base étendues
  baseStats: {
    hp: { 
      type: Number, 
      required: true,
      min: 100,
      max: 15000
    },
    atk: { 
      type: Number, 
      required: true,
      min: 10,
      max: 3000
    },
    def: { 
      type: Number, 
      required: true,
      min: 10,
      max: 1500
    },
    defMagique: {
      type: Number,
      required: true,
      min: 10,
      max: 1500,
      default: function(this: IHeroDocument) { 
        return Math.floor(this.baseStats.def * 0.8); // 80% de la def physique par défaut
      }
    },
    vitesse: {
      type: Number,
      required: true,
      min: 50,
      max: 200,
      default: function(this: IHeroDocument) {
        // Vitesse par rôle
        const speedByRole: Record<string, number> = {
          "Tank": 70,
          "DPS Melee": 90,
          "DPS Ranged": 85,
          "Support": 80
        };
        return speedByRole[this.role] || 80;
      }
    },
    intelligence: {
      type: Number,
      required: true,
      min: 20,
      max: 300,
      default: function(this: IHeroDocument) {
        // Intelligence par rôle et élément
        const intByRole: Record<string, number> = {
          "Tank": 50,
          "DPS Melee": 60,
          "DPS Ranged": 100,
          "Support": 120
        };
        return intByRole[this.role] || 70;
      }
    },
    force: {
      type: Number,
      required: true,
      min: 20,
      max: 300,
      default: function(this: IHeroDocument) {
        // Force par rôle
        const strByRole: Record<string, number> = {
          "Tank": 120,
          "DPS Melee": 110,
          "DPS Ranged": 70,
          "Support": 60
        };
        return strByRole[this.role] || 80;
      }
    },
    moral: {
      type: Number,
      required: true,
      min: 30,
      max: 200,
      default: function(this: IHeroDocument) {
        // Moral par rareté (influence la génération d'énergie)
        const moralByRarity: Record<string, number> = {
          "Common": 50,
          "Rare": 65,
          "Epic": 80,
          "Legendary": 100
        };
        return moralByRarity[this.rarity] || 60;
      }
    },
    reductionCooldown: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
      default: function(this: IHeroDocument) {
        // Réduction de cooldown par rareté (en %)
        const cooldownByRarity: Record<string, number> = {
          "Common": 0,
          "Rare": 5,
          "Epic": 10,
          "Legendary": 15
        };
        return cooldownByRarity[this.rarity] || 0;
      }
    }
  },

  // Compétence signature étendue
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
    },
    cooldown: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: function(this: any) {
        // Cooldown par type de compétence
        const cooldownByType: Record<string, number> = {
          "Heal": 4,
          "Buff": 5,
          "AoE": 6,
          "Control": 7,
          "Damage": 3
        };
        return cooldownByType[this.type] || 5;
      }
    },
    energyCost: {
      type: Number,
      required: true,
      min: 20,
      max: 100,
      default: function(this: any) {
        // Coût en énergie par type
        const energyByType: Record<string, number> = {
          "Heal": 60,
          "Buff": 50,
          "AoE": 80,
          "Control": 70,
          "Damage": 40
        };
        return energyByType[this.type] || 50;
      }
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

// Méthodes d'instance étendues
heroSchema.methods.getStatsAtLevel = function(level: number, stars: number = 1) {
  const levelMultiplier = 1 + (level - 1) * 0.08; // Réduit légèrement
  const starMultiplier = 1 + (stars - 1) * 0.15; // Réduit pour compenser plus de stats
  
  const finalMultiplier = levelMultiplier * starMultiplier;
  
  return {
    hp: Math.floor(this.baseStats.hp * finalMultiplier),
    atk: Math.floor(this.baseStats.atk * finalMultiplier),
    def: Math.floor(this.baseStats.def * finalMultiplier),
    defMagique: Math.floor(this.baseStats.defMagique * finalMultiplier),
    vitesse: Math.floor(this.baseStats.vitesse * (1 + (finalMultiplier - 1) * 0.5)), // Vitesse évolue moins
    intelligence: Math.floor(this.baseStats.intelligence * finalMultiplier),
    force: Math.floor(this.baseStats.force * finalMultiplier),
    moral: Math.floor(this.baseStats.moral * (1 + (finalMultiplier - 1) * 0.3)), // Moral évolue modérément
    reductionCooldown: Math.min(50, Math.floor(this.baseStats.reductionCooldown * (1 + (level - 1) * 0.01))) // Max 50%
  };
};

heroSchema.methods.getRarityMultiplier = function(): number {
  const multipliers: { [key: string]: number } = {
    Common: 1,
    Rare: 1.25,
    Epic: 1.5,
    Legendary: 2
  };
  return multipliers[this.rarity as string] || 1;
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

// Méthodes utilitaires pour le système de combat
heroSchema.methods.getEffectiveCooldown = function(baseCooldown: number): number {
  const reductionPercent = this.baseStats.reductionCooldown / 100;
  return Math.max(1, Math.ceil(baseCooldown * (1 - reductionPercent)));
};

heroSchema.methods.getEnergyGeneration = function(): number {
  // Génération d'énergie basée sur le moral (base 10-20 par tour)
  return Math.floor(10 + (this.baseStats.moral / 10));
};

heroSchema.methods.getMagicResistance = function(): number {
  // Résistance magique basée sur defMagique et intelligence
  return Math.floor((this.baseStats.defMagique + this.baseStats.intelligence * 0.5) / 10);
};

// Pré-save pour calculer automatiquement certaines stats
heroSchema.pre('save', function(next) {
  // S'assurer que les stats dérivées sont cohérentes
  if (!this.baseStats.defMagique) {
    this.baseStats.defMagique = Math.floor(this.baseStats.def * 0.8);
  }
  
  if (!this.baseStats.vitesse) {
    const speedByRole = {
      "Tank": 70,
      "DPS Melee": 90,
      "DPS Ranged": 85,
      "Support": 80
    };
    this.baseStats.vitesse = speedByRole[this.role as keyof typeof speedByRole] || 80;
  }
  
  if (!this.skill.cooldown) {
    const cooldownByType = {
      "Heal": 4,
      "Buff": 5,
      "AoE": 6,
      "Control": 7,
      "Damage": 3
    };
    this.skill.cooldown = cooldownByType[this.skill.type as keyof typeof cooldownByType] || 5;
  }
  
  if (!this.skill.energyCost) {
    const energyByType = {
      "Heal": 60,
      "Buff": 50,
      "AoE": 80,
      "Control": 70,
      "Damage": 40
    };
    this.skill.energyCost = energyByType[this.skill.type as keyof typeof energyByType] || 50;
  }
  
  next();
});

export default mongoose.model<IHeroDocument>("Hero", heroSchema);

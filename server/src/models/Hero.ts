import mongoose, { Document, Schema } from "mongoose";
import { IHero } from "../types/index";

// Interface pour les sorts équipés
interface IHeroSpells {
  spell1?: {
    id: string;
    level: number;
  };
  spell2?: {
    id: string;
    level: number;
  };
  spell3?: {
    id: string;
    level: number;
  };
  ultimate: {
    id: string;
    level: number;
  };
  passive?: {
    id: string;
    level: number;
  };
}

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
  
  // NOUVEAU : Système de sorts remplace l'ancien "skill"
  spells: IHeroSpells;
  
  // Méthodes héritées
  getStatsAtLevel(level: number, stars?: number): any;
  getRarityMultiplier(): number;
  getElementAdvantage(targetElement: string): number;
  getEffectiveCooldown(baseCooldown: number): number;
  getEnergyGeneration(): number;
  getMagicResistance(): number;
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

  // Stats de base étendues (inchangées)
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
        return Math.floor(this.baseStats.def * 0.8);
      }
    },
    vitesse: {
      type: Number,
      required: true,
      min: 50,
      max: 200,
      default: function(this: IHeroDocument) {
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

  // NOUVEAU : Système de sorts
  spells: {
    spell1: {
      id: { 
        type: String,
        required: false // Peut être vide pour certains héros
      },
      level: { 
        type: Number, 
        default: 1,
        min: 1,
        max: 10
      }
    },
    spell2: {
      id: { 
        type: String,
        required: false
      },
      level: { 
        type: Number, 
        default: 1,
        min: 1,
        max: 10
      }
    },
    spell3: {
      id: { 
        type: String,
        required: false
      },
      level: { 
        type: Number, 
        default: 1,
        min: 1,
        max: 10
      }
    },
    ultimate: {
      id: { 
        type: String,
        required: true // Tous les héros ont un ultimate
      },
      level: { 
        type: Number, 
        default: 1,
        min: 1,
        max: 5 // Ultimates ont moins de niveaux
      }
    },
    passive: {
      id: { 
        type: String,
        required: false
      },
      level: { 
        type: Number, 
        default: 1,
        min: 1,
        max: 5
      }
    }
  }
}, {
  timestamps: true,
  collection: 'heroes'
});

// Index pour optimiser les requêtes (inchangés)
heroSchema.index({ rarity: 1 });
heroSchema.index({ role: 1 });
heroSchema.index({ element: 1 });
heroSchema.index({ "spells.ultimate.id": 1 }); // NOUVEAU : index sur les ultimates

// Méthodes statiques pour les drop rates (inchangées)
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

// Méthodes d'instance héritées (inchangées)
heroSchema.methods.getStatsAtLevel = function(level: number, stars: number = 1) {
  const levelMultiplier = 1 + (level - 1) * 0.08;
  const starMultiplier = 1 + (stars - 1) * 0.15;
  
  const finalMultiplier = levelMultiplier * starMultiplier;
  
  return {
    hp: Math.floor(this.baseStats.hp * finalMultiplier),
    atk: Math.floor(this.baseStats.atk * finalMultiplier),
    def: Math.floor(this.baseStats.def * finalMultiplier),
    defMagique: Math.floor(this.baseStats.defMagique * finalMultiplier),
    vitesse: Math.floor(this.baseStats.vitesse * (1 + (finalMultiplier - 1) * 0.5)),
    intelligence: Math.floor(this.baseStats.intelligence * finalMultiplier),
    force: Math.floor(this.baseStats.force * finalMultiplier),
    moral: Math.floor(this.baseStats.moral * (1 + (finalMultiplier - 1) * 0.3)),
    reductionCooldown: Math.min(50, Math.floor(this.baseStats.reductionCooldown * (1 + (level - 1) * 0.01)))
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

// Méthodes utilitaires pour le système de combat (inchangées)
heroSchema.methods.getEffectiveCooldown = function(baseCooldown: number): number {
  const reductionPercent = this.baseStats.reductionCooldown / 100;
  return Math.max(1, Math.ceil(baseCooldown * (1 - reductionPercent)));
};

heroSchema.methods.getEnergyGeneration = function(): number {
  return Math.floor(10 + (this.baseStats.moral / 10));
};

heroSchema.methods.getMagicResistance = function(): number {
  return Math.floor((this.baseStats.defMagique + this.baseStats.intelligence * 0.5) / 10);
};

// NOUVELLES méthodes pour le système de sorts
heroSchema.methods.getAllSpells = function(): Array<{ slot: string; id: string; level: number }> {
  const result = [];
  
  if (this.spells.spell1?.id) result.push({ slot: "spell1", id: this.spells.spell1.id, level: this.spells.spell1.level });
  if (this.spells.spell2?.id) result.push({ slot: "spell2", id: this.spells.spell2.id, level: this.spells.spell2.level });
  if (this.spells.spell3?.id) result.push({ slot: "spell3", id: this.spells.spell3.id, level: this.spells.spell3.level });
  if (this.spells.ultimate?.id) result.push({ slot: "ultimate", id: this.spells.ultimate.id, level: this.spells.ultimate.level });
  if (this.spells.passive?.id) result.push({ slot: "passive", id: this.spells.passive.id, level: this.spells.passive.level });
  
  return result;
};

heroSchema.methods.getSpell = function(spellSlot: string): { id: string; level: number } | null {
  const spellData = this.spells[spellSlot as keyof IHeroSpells];
  return spellData && spellData.id ? { id: spellData.id, level: spellData.level } : null;
};

heroSchema.methods.setSpell = function(spellSlot: string, spellId: string, level: number = 1): void {
  if (!this.spells[spellSlot as keyof IHeroSpells]) {
    this.spells[spellSlot as keyof IHeroSpells] = { id: spellId, level };
  } else {
    this.spells[spellSlot as keyof IHeroSpells]!.id = spellId;
    this.spells[spellSlot as keyof IHeroSpells]!.level = level;
  }
};

heroSchema.methods.upgradeSpell = function(spellSlot: string, newLevel: number): boolean {
  const spell = this.spells[spellSlot as keyof IHeroSpells];
  if (!spell || !spell.id) return false;
  
  const maxLevel = spellSlot === "ultimate" || spellSlot === "passive" ? 5 : 10;
  if (newLevel > maxLevel || newLevel <= spell.level) return false;
  
  spell.level = newLevel;
  return true;
};

// Pré-save pour s'assurer de la cohérence (étendu)
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
  
  // NOUVEAU : Vérifier que l'ultimate est défini
  if (!this.spells.ultimate || !this.spells.ultimate.id) {
    // Assigner un ultimate par défaut selon l'élément
    const defaultUltimates: Record<string, string> = {
      "Fire": "fire_storm",
      "Water": "tidal_wave", 
      "Wind": "tornado",
      "Electric": "lightning_strike",
      "Light": "divine_light",
      "Dark": "shadow_realm"
    };
    
    this.spells.ultimate = {
      id: defaultUltimates[this.element] || "basic_ultimate",
      level: 1
    };
  }
  
  next();
});

export default mongoose.model<IHeroDocument>("Hero", heroSchema);

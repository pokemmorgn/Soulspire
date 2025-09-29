// server/src/models/Formation.ts
import mongoose, { Document, Schema } from "mongoose";

export interface IFormationSlot {
  slot: number;      // Position 1-5
  heroId: string;    // ID de l'instance du héros dans player.heroes
}

export interface IFormationDocument extends Document {
  _id: string;
  playerId: string;
  serverId: string;
  name: string;
  slots: IFormationSlot[];
  isActive: boolean;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Méthodes
  getTotalPower(playerHeroes: any[]): Promise<number>;
  getHeroesInFormation(playerHeroes: any[]): any[];
  getRoleDistribution(playerHeroes: any[]): Record<string, number>;
  getElementDistribution(playerHeroes: any[]): Record<string, number>;
  isEmpty(): boolean;
  isFull(): boolean;
}

const formationSlotSchema = new Schema<IFormationSlot>({
  slot: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5 
  },
  heroId: { 
    type: String, 
    required: true 
  }
}, { _id: false });

const formationSchema = new Schema<IFormationDocument>({
  _id: {
    type: String,
    required: true,
    default: () => `FORM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  playerId: { 
    type: String, 
    required: true,
    index: true
  },
  serverId: { 
    type: String, 
    required: true,
    match: /^S\d+$/,
    index: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 30,
    default: "New Formation"
  },
  slots: {
    type: [formationSlotSchema],
    default: [],
    validate: {
      validator: function(slots: IFormationSlot[]) {
        // Max 5 slots
        if (slots.length > 5) return false;
        
        // Pas de doublons de position
        const positions = slots.map(s => s.slot);
        const uniquePositions = new Set(positions);
        if (positions.length !== uniquePositions.size) return false;
        
        // Positions valides (1-5)
        return slots.every(s => s.slot >= 1 && s.slot <= 5);
      },
      message: "Invalid formation slots configuration"
    }
  },
  isActive: { 
    type: Boolean, 
    default: false 
  },
  lastUsed: { 
    type: Date 
  }
}, {
  timestamps: true,
  collection: 'formations'
});

// Index composé pour éviter doublons de noms par joueur
formationSchema.index({ playerId: 1, serverId: 1, name: 1 });

// Index pour recherches rapides
formationSchema.index({ playerId: 1, serverId: 1, isActive: 1 });

// ===== STATICS =====

formationSchema.statics.findByPlayer = function(playerId: string, serverId: string) {
  return this.find({ playerId, serverId }).sort({ isActive: -1, lastUsed: -1 });
};

formationSchema.statics.findActiveFormation = function(playerId: string, serverId: string) {
  return this.findOne({ playerId, serverId, isActive: true });
};

formationSchema.statics.getPlayerFormationCount = function(playerId: string, serverId: string) {
  return this.countDocuments({ playerId, serverId });
};

// ===== METHODS =====

formationSchema.methods.getTotalPower = async function(playerHeroes: any[]): Promise<number> {
  try {
    const Hero = mongoose.model('Hero');
    let totalPower = 0;

    for (const slot of this.slots) {
      const heroInstance = playerHeroes.find((h: any) => 
        h._id?.toString() === slot.heroId
      );
      
      if (!heroInstance) continue;

      let heroData;
      if (typeof heroInstance.heroId === 'string') {
        heroData = await Hero.findById(heroInstance.heroId);
      } else {
        heroData = heroInstance.heroId;
      }

      if (!heroData || !heroData.baseStats) continue;

      // Calculer stats du héros
      const levelMultiplier = 1 + (heroInstance.level - 1) * 0.08;
      const starMultiplier = 1 + (heroInstance.stars - 1) * 0.15;
      const totalMultiplier = levelMultiplier * starMultiplier;

      const stats = {
        hp: Math.floor(heroData.baseStats.hp * totalMultiplier),
        atk: Math.floor(heroData.baseStats.atk * totalMultiplier),
        def: Math.floor(heroData.baseStats.def * totalMultiplier)
      };

      // Calcul du power
      const heroPower = Math.floor(
        stats.atk * 1.0 + 
        stats.def * 2.0 + 
        stats.hp / 10
      );

      totalPower += heroPower;
    }

    return totalPower;
  } catch (error) {
    console.error("Error calculating formation power:", error);
    return 0;
  }
};

formationSchema.methods.getHeroesInFormation = function(playerHeroes: any[]): any[] {
  return this.slots
    .map((slot: IFormationSlot) => {
      const hero = playerHeroes.find((h: any) => 
        h._id?.toString() === slot.heroId
      );
      return hero ? { ...hero, position: slot.slot } : null;
    })
    .filter((h: any) => h !== null)
    .sort((a: any, b: any) => a.position - b.position);
};

formationSchema.methods.getRoleDistribution = function(playerHeroes: any[]): Record<string, number> {
  const distribution: Record<string, number> = {
    "Tank": 0,
    "DPS Melee": 0,
    "DPS Ranged": 0,
    "Support": 0
  };

  for (const slot of this.slots) {
    const heroInstance = playerHeroes.find((h: any) => 
      h._id?.toString() === slot.heroId
    );
    
    if (!heroInstance) continue;

    const heroData = typeof heroInstance.heroId === 'string' ? 
      null : heroInstance.heroId;
    
    if (heroData && heroData.role) {
      distribution[heroData.role] = (distribution[heroData.role] || 0) + 1;
    }
  }

  return distribution;
};

formationSchema.methods.getElementDistribution = function(playerHeroes: any[]): Record<string, number> {
  const distribution: Record<string, number> = {
    "Fire": 0,
    "Water": 0,
    "Wind": 0,
    "Electric": 0,
    "Light": 0,
    "Dark": 0
  };

  for (const slot of this.slots) {
    const heroInstance = playerHeroes.find((h: any) => 
      h._id?.toString() === slot.heroId
    );
    
    if (!heroInstance) continue;

    const heroData = typeof heroInstance.heroId === 'string' ? 
      null : heroInstance.heroId;
    
    if (heroData && heroData.element) {
      distribution[heroData.element] = (distribution[heroData.element] || 0) + 1;
    }
  }

  return distribution;
};

formationSchema.methods.isEmpty = function(): boolean {
  return this.slots.length === 0;
};

formationSchema.methods.isFull = function(): boolean {
  return this.slots.length === 5;
};

// ===== PRE-SAVE HOOKS =====

formationSchema.pre('save', async function(next) {
  // Si la formation devient active, désactiver les autres
  if (this.isActive && this.isModified('isActive')) {
    await mongoose.model('Formation').updateMany(
      { 
        playerId: this.playerId, 
        serverId: this.serverId,
        _id: { $ne: this._id } 
      },
      { $set: { isActive: false } }
    );
  }

  // Mettre à jour lastUsed si activée
  if (this.isActive && this.isModified('isActive')) {
    this.lastUsed = new Date();
  }

  next();
});

export default mongoose.model<IFormationDocument>("Formation", formationSchema);

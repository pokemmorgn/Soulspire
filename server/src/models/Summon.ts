import mongoose, { Document, Schema } from "mongoose";
import { ISummon } from "../types/index";

interface ISummonDocument extends ISummon, Document {}

const summonSchema = new Schema<ISummonDocument>({
  playerId: { 
    type: Schema.Types.ObjectId, 
    ref: "Player",
    required: true
  },
  heroesObtained: [{
    heroId: { 
      type: Schema.Types.ObjectId, 
      ref: "Hero",
      required: true
    },
    rarity: { 
      type: String,
      enum: ["Common", "Rare", "Epic", "Legendary"],
      required: true
    }
  }],
  type: { 
    type: String, 
    enum: ["Standard", "Limited", "Ticket"],
    required: true
  }
}, {
  timestamps: true,
  collection: 'summons'
});

// Index pour optimiser les requêtes
summonSchema.index({ playerId: 1 });
summonSchema.index({ type: 1 });
summonSchema.index({ createdAt: -1 });

// Méthodes statiques
summonSchema.statics.getPlayerSummonHistory = function(playerId: string, limit: number = 50) {
  return this.find({ playerId })
    .populate('heroesObtained.heroId', 'name rarity role element')
    .sort({ createdAt: -1 })
    .limit(limit);
};

summonSchema.statics.getPlayerSummonStats = function(playerId: string) {
  return this.aggregate([
    { $match: { playerId: new mongoose.Types.ObjectId(playerId) } },
    { $unwind: "$heroesObtained" },
    { $group: {
      _id: "$heroesObtained.rarity",
      count: { $sum: 1 }
    }},
    { $sort: { _id: 1 } }
  ]);
};

summonSchema.statics.getTotalSummons = function(playerId: string) {
  return this.aggregate([
    { $match: { playerId: new mongoose.Types.ObjectId(playerId) } },
    { $group: {
      _id: null,
      totalSummons: { $sum: { $size: "$heroesObtained" } },
      totalSessions: { $sum: 1 }
    }}
  ]);
};

// Méthodes d'instance
summonSchema.methods.addHero = function(heroId: string, rarity: string) {
  this.heroesObtained.push({ heroId, rarity });
  return this.save();
};

summonSchema.methods.getLegendaryCount = function(): number {
  return this.heroesObtained.filter(hero => hero.rarity === "Legendary").length;
};

summonSchema.methods.getEpicCount = function(): number {
  return this.heroesObtained.filter(hero => hero.rarity === "Epic").length;
};

summonSchema.methods.getRarityDistribution = function() {
  const distribution = {
    Common: 0,
    Rare: 0,
    Epic: 0,
    Legendary: 0
  };
  
  this.heroesObtained.forEach(hero => {
    distribution[hero.rarity as keyof typeof distribution]++;
  });
  
  return distribution;
};

export default mongoose.model<ISummonDocument>("Summon", summonSchema);

import mongoose, { Document, Schema, Model } from "mongoose";
import { ISummon } from "../types/index";

interface ISummonDocument extends Document {
  playerId: string;
  bannerId?: string; // ✅ NOUVEAU
  heroesObtained: {
    heroId: string;
    rarity: string;
  }[];
  type: "Standard" | "Limited" | "Ticket";
  createdAt?: Date;
  addHero(heroId: string, rarity: string): any;
  getLegendaryCount(): number;
  getEpicCount(): number;
  getRarityDistribution(): any;
}

// ✅ AJOUT : Interface pour les méthodes statiques
interface ISummonModel extends Model<ISummonDocument> {
  getPlayerSummonHistory(playerId: string, limit?: number): any;
  getPlayerSummonStats(playerId: string): any;
  getTotalSummons(playerId: string): any;
  hasPlayerPulledOnBanner(playerId: string, bannerId: string): Promise<boolean>;
}

const summonSchema = new Schema<ISummonDocument, ISummonModel>({
  playerId: { 
    type: String,
    required: true
  },
  bannerId: { // ✅ NOUVEAU CHAMP
    type: String,
    required: false,
    index: true
  },
  heroesObtained: [{
    heroId: { 
      type: String,
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
summonSchema.index({ playerId: 1, bannerId: 1 }); // ✅ NOUVEAU
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

// ✅ NOUVELLE MÉTHODE : Vérifier si un joueur a déjà pullé sur une bannière spécifique
summonSchema.statics.hasPlayerPulledOnBanner = async function(
  playerId: string, 
  bannerId: string
): Promise<boolean> {
  const existingPull = await this.findOne({ playerId, bannerId });
  return !!existingPull;
};

// Méthodes d'instance
summonSchema.methods.addHero = function(heroId: string, rarity: string) {
  this.heroesObtained.push({ heroId, rarity });
  return this.save();
};

summonSchema.methods.getLegendaryCount = function(): number {
  return this.heroesObtained.filter((hero: any) => hero.rarity === "Legendary").length;
};

summonSchema.methods.getEpicCount = function(): number {
  return this.heroesObtained.filter((hero: any) => hero.rarity === "Epic").length;
};

summonSchema.methods.getRarityDistribution = function() {
  const distribution = {
    Common: 0,
    Rare: 0,
    Epic: 0,
    Legendary: 0
  };
  
  this.heroesObtained.forEach((hero: any) => {
    distribution[hero.rarity as keyof typeof distribution]++;
  });
  
  return distribution;
};

export default mongoose.model<ISummonDocument, ISummonModel>("Summon", summonSchema);

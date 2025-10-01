// server/src/models/MythicPity.ts

import mongoose, { Document, Schema } from "mongoose";

export interface IMythicPity {
  playerId: string;
  serverId: string;
  
  // Compteur fusionné (Standard + Limited pulls)
  fusedPullCounter: number;        // Pulls cumulés sur Standard + Limited
  scrollsEarned: number;            // Total parchemins gagnés (lifetime)
  scrollsUsed: number;              // Total parchemins dépensés (lifetime)
  scrollsAvailable: number;         // Parchemins actuellement disponibles
  
  // Pity sur bannière mythique
  mythicPullsSinceLast: number;     // Pulls avec parchemins depuis dernier Mythic
  mythicPityThreshold: number;      // Seuil pity garanti (défaut 35)
  totalMythicPulls: number;         // Total pulls mythiques (lifetime)
  
  // Historique
  lastScrollEarnedAt: Date;
  lastMythicPulledAt?: Date;
  mythicHeroesObtained: string[];   // IDs des héros mythiques obtenus
  
  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
}

interface IMythicPityDocument extends Document {
  playerId: string;
  serverId: string;
  fusedPullCounter: number;
  scrollsEarned: number;
  scrollsUsed: number;
  scrollsAvailable: number;
  mythicPullsSinceLast: number;
  mythicPityThreshold: number;
  totalMythicPulls: number;
  lastScrollEarnedAt: Date;
  lastMythicPulledAt?: Date;
  mythicHeroesObtained: string[];
  
  // Méthodes
  earnScrolls(count: number): Promise<IMythicPityDocument>;
  useScrolls(count: number): Promise<IMythicPityDocument>;
  incrementMythicPity(): void;
  resetMythicPity(): void;
  isMythicPityTriggered(): boolean;
}

const mythicPitySchema = new Schema<IMythicPityDocument>({
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
  fusedPullCounter: {
    type: Number,
    default: 0,
    min: 0
  },
  scrollsEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  scrollsUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  scrollsAvailable: {
    type: Number,
    default: 0,
    min: 0
  },
  mythicPullsSinceLast: {
    type: Number,
    default: 0,
    min: 0
  },
  mythicPityThreshold: {
    type: Number,
    default: 35,
    min: 1,
    max: 100
  },
  totalMythicPulls: {
    type: Number,
    default: 0,
    min: 0
  },
  lastScrollEarnedAt: {
    type: Date,
    default: Date.now
  },
  lastMythicPulledAt: {
    type: Date
  },
  mythicHeroesObtained: [{
    type: String
  }]
}, {
  timestamps: true,
  collection: 'mythic_pity'
});

// Index unique par joueur et serveur
mythicPitySchema.index({ playerId: 1, serverId: 1 }, { unique: true });

// Méthodes d'instance

/**
 * Gagner des parchemins mythiques
 */
mythicPitySchema.methods.earnScrolls = async function(count: number): Promise<IMythicPityDocument> {
  this.scrollsEarned += count;
  this.scrollsAvailable += count;
  this.lastScrollEarnedAt = new Date();
  
  console.log(`✨ Player ${this.playerId} earned ${count} mythic scroll(s). Total available: ${this.scrollsAvailable}`);
  
  return await this.save();
};

/**
 * Utiliser des parchemins mythiques
 */
mythicPitySchema.methods.useScrolls = async function(count: number): Promise<IMythicPityDocument> {
  if (this.scrollsAvailable < count) {
    throw new Error(`Insufficient mythic scrolls. Required: ${count}, Available: ${this.scrollsAvailable}`);
  }
  
  this.scrollsUsed += count;
  this.scrollsAvailable -= count;
  
  console.log(`💎 Player ${this.playerId} used ${count} mythic scroll(s). Remaining: ${this.scrollsAvailable}`);
  
  return await this.save();
};

/**
 * Incrémenter le pity mythique
 */
mythicPitySchema.methods.incrementMythicPity = function(): void {
  this.mythicPullsSinceLast++;
  this.totalMythicPulls++;
};

/**
 * Reset le pity mythique (après obtention Mythic)
 */
mythicPitySchema.methods.resetMythicPity = function(): void {
  this.mythicPullsSinceLast = 0;
  this.lastMythicPulledAt = new Date();
  console.log(`🔮 Mythic pity reset for player ${this.playerId}`);
};

/**
 * Vérifier si le pity mythique est déclenché
 */
mythicPitySchema.methods.isMythicPityTriggered = function(): boolean {
  return this.mythicPullsSinceLast >= this.mythicPityThreshold;
};

export default mongoose.model<IMythicPityDocument>("MythicPity", mythicPitySchema);

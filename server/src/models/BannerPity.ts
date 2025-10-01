// server/src/models/BannerPity.ts

import mongoose, { Document, Schema } from "mongoose";

export interface IBannerPity {
  playerId: string;
  bannerId: string;
  element?: string;
  pullsSinceLegendary: number;
  pullsSinceEpic: number;
  totalPulls: number;
  hasReceivedLegendary: boolean;
  lastPullDate: Date;
}

interface IBannerPityDocument extends Document {
  playerId: string;
  bannerId: string;
  element?: string;
  pullsSinceLegendary: number;
  pullsSinceEpic: number;
  totalPulls: number;
  hasReceivedLegendary: boolean;
  lastPullDate: Date;
}

const bannerPitySchema = new Schema<IBannerPityDocument>({
  playerId: {
    type: String,
    required: true,
    index: true
  },
  bannerId: {
    type: String,
    required: true,
    index: true
  },
    element: { // ✅ NOUVEAU
    type: String,
    enum: ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"],
    sparse: true,
    index: true
  },
  pullsSinceLegendary: {
    type: Number,
    default: 0,
    min: 0
  },
  pullsSinceEpic: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPulls: {
    type: Number,
    default: 0,
    min: 0
  },
  hasReceivedLegendary: {
    type: Boolean,
    default: false
  },
  lastPullDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'banner_pity'
});

// Permet d'avoir un pity différent par bannière ET par élément
bannerPitySchema.index({ playerId: 1, bannerId: 1 }, { 
  unique: true,
  partialFilterExpression: { element: { $exists: false } }
});

// ✅ NOUVEAU: Index unique pour pity élémentaire
bannerPitySchema.index({ playerId: 1, bannerId: 1, element: 1 }, { 
  unique: true,
  partialFilterExpression: { element: { $exists: true } }
});

// ✅ NOUVEAU: Index pour requêtes élémentaires
bannerPitySchema.index({ playerId: 1, element: 1 });

export default mongoose.model<IBannerPityDocument>("BannerPity", bannerPitySchema);

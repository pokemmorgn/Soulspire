// server/src/models/ElementalBannerRotation.ts

import mongoose, { Document, Schema, Model } from "mongoose";

// Interface pour la rotation des bannières élémentaires
export interface IElementalBannerRotation {
  _id?: string;
  serverId: string;
  currentWeek: number;           // Numéro de semaine de l'année
  currentDay: string;            // "monday", "tuesday", "wednesday", etc.
  activeElements: string[];      // ["Fire"], ["Light", "Shadow"], etc.
  activeBanners: string[];       // ["elemental_fire"], ["elemental_light", "elemental_shadow"]
  shopOpen: boolean;             // true le vendredi uniquement
  nextRotationAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface IElementalBannerRotationDocument extends Document {
  serverId: string;
  currentWeek: number;
  currentDay: string;
  activeElements: string[];
  activeBanners: string[];
  shopOpen: boolean;
  nextRotationAt: Date;
  
  // Méthodes d'instance
  isElementActive(element: string): boolean;
  getActiveElementsCount(): number;
}

// ✅ AJOUT : Interface pour les méthodes statiques
interface IElementalBannerRotationModel extends Model<IElementalBannerRotationDocument> {
  getCurrentRotation(serverId: string): Promise<IElementalBannerRotationDocument>;
  createRotationForToday(serverId: string): Promise<IElementalBannerRotationDocument>;
  updateRotation(serverId: string): Promise<IElementalBannerRotationDocument>;
  getActiveElementsForDay(dayOfWeek: number): string[];
  getDayNameFromNumber(dayOfWeek: number): string;
  getWeekNumber(date: Date): number;
  getNextMidnight(): Date;
  isElementActiveToday(serverId: string, element: string): Promise<boolean>;
  isShopDay(serverId: string): Promise<boolean>;
}

// Schéma de la rotation
const elementalBannerRotationSchema = new Schema<IElementalBannerRotationDocument, IElementalBannerRotationModel>({
  serverId: {
    type: String,
    required: true,
    match: /^S\d+$/,
    index: true
  },
  currentWeek: {
    type: Number,
    required: true,
    min: 1,
    max: 53
  },
  currentDay: {
    type: String,
    required: true,
    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    lowercase: true
  },
  activeElements: [{
    type: String,
    enum: ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"]
  }],
  activeBanners: [{
    type: String,
    match: /^elemental_[a-z]+$/
  }],
  shopOpen: {
    type: Boolean,
    default: false
  },
  nextRotationAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'elemental_banner_rotations'
});

// Index unique pour éviter les doublons par serveur
elementalBannerRotationSchema.index({ serverId: 1 }, { unique: true });

// Index pour les requêtes de rotation
elementalBannerRotationSchema.index({ nextRotationAt: 1 });
elementalBannerRotationSchema.index({ serverId: 1, currentDay: 1 });

// === MÉTHODES STATIQUES ===

/**
 * Obtenir la rotation actuelle pour un serveur
 */
elementalBannerRotationSchema.statics.getCurrentRotation = async function(
  this: IElementalBannerRotationModel,
  serverId: string
): Promise<IElementalBannerRotationDocument> {
  let rotation = await this.findOne({ serverId });
  
  // Si pas de rotation existante, en créer une
  if (!rotation) {
    console.log(`📅 Creating initial rotation for ${serverId}`);
    rotation = await this.createRotationForToday(serverId);
  }
  
  // Vérifier si la rotation doit être mise à jour
  const now = new Date();
  if (rotation && rotation.nextRotationAt <= now) {
    console.log(`🔄 Rotation expired for ${serverId}, updating...`);
    rotation = await this.updateRotation(serverId);
  }
  
  if (!rotation) {
    throw new Error(`Failed to get rotation for ${serverId}`);
  }
  
  return rotation;
};

/**
 * Créer une rotation pour aujourd'hui
 */
elementalBannerRotationSchema.statics.createRotationForToday = async function(
  this: IElementalBannerRotationModel,
  serverId: string
): Promise<IElementalBannerRotationDocument> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = dimanche, 1 = lundi, etc.
  
  const dayName = this.getDayNameFromNumber(dayOfWeek);
  const weekNumber = this.getWeekNumber(now);
  const activeElements = this.getActiveElementsForDay(dayOfWeek);
  const activeBanners = activeElements.map((el: string) => `elemental_${el.toLowerCase()}`);
  
  const rotation = await this.create({
    serverId,
    currentWeek: weekNumber,
    currentDay: dayName,
    activeElements,
    activeBanners,
    shopOpen: dayOfWeek === 5, // Vendredi
    nextRotationAt: this.getNextMidnight()
  });
  
  console.log(`✅ Created rotation for ${serverId}: ${dayName} - Elements: [${activeElements.join(", ")}]`);
  
  return rotation;
};

/**
 * Mettre à jour la rotation (appelé par le cron job)
 */
elementalBannerRotationSchema.statics.updateRotation = async function(
  this: IElementalBannerRotationModel,
  serverId: string
): Promise<IElementalBannerRotationDocument> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  const dayName = this.getDayNameFromNumber(dayOfWeek);
  const weekNumber = this.getWeekNumber(now);
  const activeElements = this.getActiveElementsForDay(dayOfWeek);
  const activeBanners = activeElements.map((el: string) => `elemental_${el.toLowerCase()}`);
  
  const rotation = await this.findOneAndUpdate(
    { serverId },
    {
      currentWeek: weekNumber,
      currentDay: dayName,
      activeElements,
      activeBanners,
      shopOpen: dayOfWeek === 5,
      nextRotationAt: this.getNextMidnight()
    },
    { new: true, upsert: true }
  );
  
  console.log(`🔄 Updated rotation for ${serverId}: ${dayName} - Elements: [${activeElements.join(", ")}]`);
  
  if (!rotation) {
    throw new Error(`Failed to update rotation for ${serverId}`);
  }
  
  return rotation;
};

/**
 * Obtenir les éléments actifs selon le jour de la semaine
 */
elementalBannerRotationSchema.statics.getActiveElementsForDay = function(dayOfWeek: number): string[] {
  const rotationMap: { [key: number]: string[] } = {
    1: ["Fire"],                                             // Lundi
    2: ["Electric"],                                         // Mardi
    3: ["Wind"],                                            // Mercredi
    4: ["Water"],                                           // Jeudi
    5: [],                                                  // Vendredi (boutique)
    6: ["Light", "Shadow"],                                 // Samedi
    0: ["Fire", "Water", "Wind", "Electric", "Light", "Shadow"] // Dimanche
  };
  
  return rotationMap[dayOfWeek] || [];
};

/**
 * Obtenir le nom du jour à partir du numéro
 */
elementalBannerRotationSchema.statics.getDayNameFromNumber = function(dayOfWeek: number): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[dayOfWeek];
};

/**
 * Obtenir le numéro de semaine de l'année
 */
elementalBannerRotationSchema.statics.getWeekNumber = function(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

/**
 * Obtenir le prochain minuit
 */
elementalBannerRotationSchema.statics.getNextMidnight = function(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
};

/**
 * Vérifier si un élément est actif aujourd'hui
 */
elementalBannerRotationSchema.statics.isElementActiveToday = async function(
  serverId: string, 
  element: string
): Promise<boolean> {
  const rotation = await this.getCurrentRotation(serverId);
  return rotation.activeElements.includes(element);
};

/**
 * Vérifier si c'est le jour boutique (vendredi)
 */
elementalBannerRotationSchema.statics.isShopDay = async function(serverId: string): Promise<boolean> {
  const rotation = await this.getCurrentRotation(serverId);
  return rotation.shopOpen;
};

// === MÉTHODES D'INSTANCE ===

/**
 * Vérifier si un élément spécifique est actif
 */
elementalBannerRotationSchema.methods.isElementActive = function(element: string): boolean {
  return this.activeElements.includes(element);
};

/**
 * Obtenir le nombre d'éléments actifs
 */
elementalBannerRotationSchema.methods.getActiveElementsCount = function(): number {
  return this.activeElements.length;
};

export default mongoose.model<IElementalBannerRotationDocument, IElementalBannerRotationModel>(
  "ElementalBannerRotation", 
  elementalBannerRotationSchema
);

import mongoose, { Document, Schema } from "mongoose";
import { IShop, IShopItem } from "../types/index";

interface IShopDocument extends Document {
  type: "Daily" | "Weekly" | "Monthly" | "Premium";
  items: IShopItem[];
  resetTime: Date;
  nextResetTime: Date;
  isActive: boolean;
  refreshShop(): Promise<IShopDocument>;
  addItem(item: Partial<IShopItem>): IShopDocument;
  removeItem(itemId: string): boolean;
  canPurchase(itemId: string, playerId: string): Promise<boolean>;
}

const shopItemSchema = new Schema<IShopItem>({
  itemId: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ["Currency", "Hero", "Equipment", "Material", "Fragment", "Ticket"],
    required: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    maxlength: 200,
    default: ""
  },
  rarity: { 
    type: String, 
    enum: ["Common", "Rare", "Epic", "Legendary"],
    default: "Common"
  },
  quantity: { 
    type: Number, 
    required: true,
    min: 1,
    default: 1
  },
  
  // Coûts
  cost: {
    gold: { type: Number, min: 0, default: 0 },
    gems: { type: Number, min: 0, default: 0 },
    paidGems: { type: Number, min: 0, default: 0 },
    tickets: { type: Number, min: 0, default: 0 }
  },
  
  // Stock et limitations
  maxStock: { 
    type: Number, 
    min: -1, // -1 = stock illimité
    default: -1
  },
  currentStock: { 
    type: Number, 
    min: 0,
    default: function(this: IShopItem) {
      return this.maxStock === -1 ? 999999 : this.maxStock;
    }
  },
  maxPurchasePerPlayer: { 
    type: Number, 
    min: -1, // -1 = illimité par joueur
    default: -1
  },
  
  // Conditions d'achat
  levelRequirement: { 
    type: Number, 
    min: 1,
    default: 1
  },
  worldRequirement: { 
    type: Number, 
    min: 1,
    default: 1
  },
  
  // Données spécifiques selon le type
  heroData: {
    heroId: { type: String, default: null },
    level: { type: Number, min: 1, default: 1 },
    stars: { type: Number, min: 1, max: 6, default: 1 }
  },
  equipmentData: {
    type: { 
      type: String, 
      enum: ["Weapon", "Armor", "Accessory"],
      default: null
    },
    level: { type: Number, min: 1, default: 1 },
    stats: {
      atk: { type: Number, min: 0, default: 0 },
      def: { type: Number, min: 0, default: 0 },
      hp: { type: Number, min: 0, default: 0 }
    }
  },
  materialData: {
    materialType: { type: String, default: null }
  },
  
  // Metadata
  weight: { 
    type: Number, 
    min: 1,
    max: 100,
    default: 50 // Probabilité d'apparition lors de la génération
  },
  isPromotional: { 
    type: Boolean, 
    default: false 
  },
  promotionalText: { 
    type: String, 
    maxlength: 100,
    default: ""
  },
  
  // Tracking des achats
  totalPurchased: { 
    type: Number, 
    min: 0,
    default: 0
  },
  purchasedBy: [{ 
    playerId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    purchaseDate: { type: Date, default: Date.now }
  }]
});

const shopSchema = new Schema<IShopDocument>({
  type: { 
    type: String, 
    enum: ["Daily", "Weekly", "Monthly", "Premium"],
    required: true
  },
  
  items: [shopItemSchema],
  
  resetTime: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  nextResetTime: { 
    type: Date, 
    required: true,
    default: function(this: IShopDocument) {
      const now = new Date();
      switch (this.type) {
        case "Daily":
          now.setDate(now.getDate() + 1);
          now.setHours(0, 0, 0, 0);
          break;
        case "Weekly":
          now.setDate(now.getDate() + (7 - now.getDay()));
          now.setHours(0, 0, 0, 0);
          break;
        case "Monthly":
          now.setMonth(now.getMonth() + 1, 1);
          now.setHours(0, 0, 0, 0);
          break;
        case "Premium":
          // Premium shop ne reset pas automatiquement
          now.setFullYear(now.getFullYear() + 1);
          break;
      }
      return now;
    }
  },
  
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: true,
  collection: 'shops'
});

// Index pour optimiser les requêtes
shopSchema.index({ type: 1, isActive: 1 });
shopSchema.index({ resetTime: 1 });
shopSchema.index({ nextResetTime: 1 });
shopSchema.index({ "items.type": 1 });
shopSchema.index({ "items.rarity": 1 });

// Méthodes statiques
shopSchema.statics.getCurrentShop = function(shopType: string) {
  return this.findOne({ 
    type: shopType, 
    isActive: true,
    nextResetTime: { $gt: new Date() }
  });
};

shopSchema.statics.getAllActiveShops = function() {
  return this.find({ 
    isActive: true,
    nextResetTime: { $gt: new Date() }
  }).sort({ type: 1 });
};

shopSchema.statics.getExpiredShops = function() {
  return this.find({ 
    nextResetTime: { $lte: new Date() },
    isActive: true
  });
};

// Génération automatique d'items selon le type de shop
shopSchema.statics.generateShopItems = function(shopType: string): IShopItem[] {
  const items: IShopItem[] = [];
  
  switch (shopType) {
    case "Daily":
      // Or à prix réduit
      items.push({
        itemId: `gold_${Date.now()}_1`,
        type: "Currency",
        name: "Gold Pack (Small)",
        description: "1000 Gold coins",
        quantity: 1000,
        cost: { gems: 100 },
        maxStock: 3,
        weight: 100
      } as IShopItem);
      
      // Fragments communs
      items.push({
        itemId: `fragments_${Date.now()}_2`,
        type: "Fragment", 
        name: "Common Hero Fragments",
        description: "Random common hero fragments",
        quantity: 10,
        cost: { gold: 5000 },
        maxStock: 2,
        weight: 80
      } as IShopItem);
      
      // Ticket d'invocation
      items.push({
        itemId: `ticket_${Date.now()}_3`,
        type: "Ticket",
        name: "Summon Ticket",
        description: "Free hero summon",
        quantity: 1,
        cost: { gold: 10000 },
        maxStock: 1,
        maxPurchasePerPlayer: 1,
        weight: 60
      } as IShopItem);
      break;
      
    case "Weekly":
      // Fragments rares
      items.push({
        itemId: `fragments_rare_${Date.now()}_1`,
        type: "Fragment",
        name: "Rare Hero Fragments",
        description: "Rare hero fragments selection",
        rarity: "Rare",
        quantity: 25,
        cost: { gems: 500 },
        maxStock: 2,
        weight: 70
      } as IShopItem);
      
      // Matériaux d'évolution
      items.push({
        itemId: `materials_${Date.now()}_2`,
        type: "Material",
        name: "Evolution Materials",
        description: "Materials for hero evolution",
        quantity: 5,
        cost: { gems: 300 },
        maxStock: 5,
        weight: 90
      } as IShopItem);
      
      // Équipement rare
      items.push({
        itemId: `equipment_${Date.now()}_3`,
        type: "Equipment",
        name: "Rare Equipment Box",
        description: "Random rare equipment",
        rarity: "Rare",
        quantity: 1,
        cost: { gems: 800 },
        maxStock: 1,
        equipmentData: {
          level: 1,
          stats: { atk: 50, def: 30, hp: 100 }
        },
        weight: 50
      } as IShopItem);
      break;
      
    case "Monthly":
      // Héros légendaire garanti
      items.push({
        itemId: `hero_legendary_${Date.now()}_1`,
        type: "Hero",
        name: "Legendary Hero Selection",
        description: "Choose any legendary hero",
        rarity: "Legendary",
        quantity: 1,
        cost: { gems: 5000 },
        maxStock: 1,
        maxPurchasePerPlayer: 1,
        heroData: { level: 1, stars: 1 },
        isPromotional: true,
        promotionalText: "LIMITED TIME!",
        weight: 100
      } as IShopItem);
      
      // Pack massif de ressources
      items.push({
        itemId: `mega_pack_${Date.now()}_2`,
        type: "Currency",
        name: "Mega Resource Pack",
        description: "50,000 Gold + 1,000 Gems",
        quantity: 1,
        cost: { paidGems: 2000 },
        maxStock: 1,
        maxPurchasePerPlayer: 1,
        isPromotional: true,
        weight: 80
      } as IShopItem);
      break;
      
    case "Premium":
      // Packs payants
      items.push({
        itemId: `starter_pack_${Date.now()}_1`,
        type: "Currency",
        name: "Starter Pack",
        description: "5,000 Gems + Rare Hero + Materials",
        quantity: 1,
        cost: { paidGems: 500 },
        maxStock: -1,
        maxPurchasePerPlayer: 1,
        isPromotional: true,
        promotionalText: "BEST VALUE",
        weight: 100
      } as IShopItem);
      break;
  }
  
  return items;
};

// Méthodes d'instance
shopSchema.methods.refreshShop = async function(): Promise<IShopDocument> {
  // Générer de nouveaux items
  const newItems = (this.constructor as any).generateShopItems(this.type);
  
  // Reset du shop
  this.items = newItems;
  this.resetTime = new Date();
  
  // Calcul du prochain reset
  const now = new Date();
  switch (this.type) {
    case "Daily":
      now.setDate(now.getDate() + 1);
      now.setHours(0, 0, 0, 0);
      break;
    case "Weekly":
      now.setDate(now.getDate() + (7 - now.getDay()));
      now.setHours(0, 0, 0, 0);
      break;
    case "Monthly":
      now.setMonth(now.getMonth() + 1, 1);
      now.setHours(0, 0, 0, 0);
      break;
    case "Premium":
      // Premium ne reset pas
      now.setFullYear(now.getFullYear() + 1);
      break;
  }
  this.nextResetTime = now;
  
  return await this.save();
};

shopSchema.methods.addItem = function(item: Partial<IShopItem>): IShopDocument {
  const newItem: IShopItem = {
    itemId: item.itemId || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: item.type || "Currency",
    name: item.name || "Unknown Item",
    description: item.description || "",
    rarity: item.rarity || "Common",
    quantity: item.quantity || 1,
    cost: item.cost || { gold: 100 },
    maxStock: item.maxStock || -1,
    currentStock: item.currentStock || (item.maxStock === -1 ? 999999 : item.maxStock || -1),
    maxPurchasePerPlayer: item.maxPurchasePerPlayer || -1,
    levelRequirement: item.levelRequirement || 1,
    worldRequirement: item.worldRequirement || 1,
    heroData: item.heroData,
    equipmentData: item.equipmentData,
    materialData: item.materialData,
    weight: item.weight || 50,
    isPromotional: item.isPromotional || false,
    promotionalText: item.promotionalText || "",
    totalPurchased: 0,
    purchasedBy: []
  };
  
  this.items.push(newItem);
  return this;
};

shopSchema.methods.removeItem = function(itemId: string): boolean {
  const initialLength = this.items.length;
  this.items = this.items.filter((item: IShopItem) => item.itemId !== itemId);
  return this.items.length < initialLength;
};

shopSchema.methods.canPurchase = async function(itemId: string, playerId: string): Promise<boolean> {
  const item = this.items.find((i: IShopItem) => i.itemId === itemId);
  if (!item) return false;
  
  // Vérifier le stock
  if (item.maxStock !== -1 && item.currentStock <= 0) return false;
  
  // Vérifier les achats par joueur
  if (item.maxPurchasePerPlayer !== -1) {
    const playerPurchases = item.purchasedBy
      .filter(p => p.playerId === playerId)
      .reduce((sum, p) => sum + p.quantity, 0);
    
    if (playerPurchases >= item.maxPurchasePerPlayer) return false;
  }
  
  // Vérifier les exigences de niveau/monde (nécessiterait une requête Player)
  // Pour l'instant, on suppose que c'est vérifié côté route
  
  return true;
};

// Middleware pre-save pour validation
shopSchema.pre('save', function(next) {
  // Validation des items
  for (const item of this.items) {
    // Au moins un coût doit être défini
    const hasCost = Object.values(item.cost).some(cost => cost > 0);
    if (!hasCost) {
      return next(new Error(`Item ${item.itemId} must have at least one cost defined`));
    }
    
    // Validation spécifique selon le type
    if (item.type === "Hero" && !item.heroData) {
      return next(new Error(`Hero item ${item.itemId} must have heroData`));
    }
    
    if (item.type === "Equipment" && !item.equipmentData) {
      return next(new Error(`Equipment item ${item.itemId} must have equipmentData`));
    }
  }
  
  next();
});

export default mongoose.model<IShopDocument>("Shop", shopSchema);

import mongoose, { Document, Schema } from "mongoose";

// === INTERFACES ===

// Objet à vendre dans le shop
interface IShopItem {
  itemId: string;           
  instanceId: string;       
  type: "Item" | "Currency" | "Fragment" | "Hero" | "Chest" | "Bundle" | "ElementalTicket"; // ✅ AJOUT
  name: string;            
  description?: string;
  
  // Contenu de l'offre
  content: {
    itemId?: string;        
    heroId?: string;        
    currencyType?: "gold" | "gems" | "paidGems" | "tickets";
    elementalTicketType?: "fire" | "water" | "wind" | "electric" | "light" | "shadow"; // ✅ NOUVEAU
    quantity: number;
    level?: number;         
    enhancement?: number;   
    bundleItems?: Array<{   
      type: string;
      itemId?: string;
      quantity: number;
    }>;
  };
  
  // Prix
  cost: {
    gold?: number;
    gems?: number;
    paidGems?: number;
    tickets?: number;
  };
  
  // Propriétés de vente
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" | "Ascended";
  originalPrice?: number;  
  discountPercent?: number; 
  
  // Limitations
  maxStock: number;        
  currentStock: number;
  maxPurchasePerPlayer: number; 
  purchaseHistory: Array<{
    playerId: string;
    quantity: number;
    purchaseDate: Date;
  }>;
  
  // Conditions d'achat
  levelRequirement: number;
  vipLevelRequirement?: number;
  chapterRequirement?: number;
  
  // Métadonnées
  isPromotional: boolean;
  promotionalText?: string;
  isFeatured: boolean;     
  weight: number;          
  tags: string[];          
}

// Types de shops
type ShopType = 
  | "Daily"         
  | "Weekly"        
  | "Monthly"       
  | "Arena"         
  | "Clan"          
  | "VIP"           
  | "Premium"
  | "ElementalFriday"; // ✅ NOUVEAU

// Document principal du shop
interface IShopDocument extends Document {
  shopType: ShopType;
  name: string;
  description?: string;
  isActive: boolean;
  
  // Timing
  startTime?: Date;        
  endTime?: Date;
  resetTime: Date;         
  nextResetTime: Date;     
  resetFrequency: "never" | "daily" | "weekly" | "monthly" | "event";
  
  // Configuration
  maxItemsShown: number;   
  refreshCost?: {          
    gold?: number;
    gems?: number;
  };
  freeRefreshCount: number; 
  
  // Objets
  items: IShopItem[];
  featuredItems: string[]; 
  
  // Conditions d'accès
  levelRequirement: number;
  vipLevelRequirement?: number;
  chapterRequirement?: number;
  
  // Métadonnées
  priority: number;        
  iconUrl?: string;
  bannerUrl?: string;
  
  // === MÉTHODES ===
  refreshShop(): Promise<IShopDocument>;
  addItem(item: Partial<IShopItem>): this;
  removeItem(instanceId: string): boolean;
  canPlayerAccess(playerId: string): Promise<boolean>;
  canPlayerPurchase(instanceId: string, playerId: string): Promise<{ canPurchase: boolean; reason?: string }>;
  purchaseItem(instanceId: string, playerId: string, quantity?: number): Promise<any>;
  getPlayerPurchaseHistory(playerId: string): IShopItem["purchaseHistory"];
  generateDailyItems(): Promise<void>;
  generateWeeklyItems(): Promise<void>;
  generateMonthlyItems(): Promise<void>;
  generatePremiumItems(): Promise<void>;
  generateElementalFridayItems(): Promise<void>; // ✅ NOUVEAU
  applyDiscount(instanceId: string, discountPercent: number): boolean;
  calculateNextResetTime(): void;
  generateItemsForShopType(): Promise<void>;
}

// === SCHÉMAS MONGOOSE ===

const shopItemSchema = new Schema<IShopItem>({
  itemId: { type: String, required: true },
  instanceId: { 
    type: String, 
    required: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  type: { 
    type: String, 
    enum: ["Item", "Currency", "Fragment", "Hero", "Chest", "Bundle", "ElementalTicket"], // ✅ MODIFIÉ
    required: true 
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    trim: true 
  },
  
  // Contenu
  content: {
    itemId: { type: String },
    heroId: { type: String },
    currencyType: { 
      type: String,
      enum: ["gold", "gems", "paidGems", "tickets"]
    },
    elementalTicketType: { // ✅ NOUVEAU
      type: String,
      enum: ["fire", "water", "wind", "electric", "light", "shadow"]
    },
    quantity: { type: Number, required: true, min: 1 },
    level: { type: Number, min: 1 },
    enhancement: { type: Number, min: 0, max: 15 },
    bundleItems: [{
      type: { type: String, required: true },
      itemId: { type: String },
      quantity: { type: Number, required: true, min: 1 }
    }]
  },
  
  // Prix
  cost: {
    gold: { type: Number, min: 0, default: 0 },
    gems: { type: Number, min: 0, default: 0 },
    paidGems: { type: Number, min: 0, default: 0 },
    tickets: { type: Number, min: 0, default: 0 }
  },
  
  // Propriétés
  rarity: { 
    type: String, 
    enum: ["Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended"],
    required: true 
  },
  originalPrice: { type: Number, min: 0 },
  discountPercent: { type: Number, min: 0, max: 100, default: 0 },
  
  // Stock
  maxStock: { type: Number, default: -1 },
  currentStock: { 
    type: Number,
    default: function(this: IShopItem) {
      return this.maxStock === -1 ? 999999 : this.maxStock;
    }
  },
  maxPurchasePerPlayer: { type: Number, default: -1 },
  purchaseHistory: [{
    playerId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    purchaseDate: { type: Date, default: Date.now }
  }],
  
  // Conditions
  levelRequirement: { type: Number, default: 1, min: 1 },
  vipLevelRequirement: { type: Number, min: 0 },
  chapterRequirement: { type: Number, min: 1 },
  
  // Métadonnées
  isPromotional: { type: Boolean, default: false },
  promotionalText: { type: String, trim: true },
  isFeatured: { type: Boolean, default: false },
  weight: { type: Number, default: 50, min: 1, max: 100 },
  tags: [{ type: String, trim: true }]
}, { _id: false });

const shopSchema = new Schema<IShopDocument>({
  shopType: { 
    type: String, 
    enum: ["Daily", "Weekly", "Monthly", "Premium", "ElementalFriday"], // ✅ MODIFIÉ
    required: true 
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    trim: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  // Timing
  startTime: { type: Date },
  endTime: { type: Date },
  resetTime: { type: Date, default: Date.now },
  nextResetTime: { 
    type: Date,
    required: true
  },
  resetFrequency: { 
    type: String, 
    enum: ["never", "daily", "weekly", "monthly", "event"],
    default: "never"
  },
  
  // Configuration
  maxItemsShown: { type: Number, default: 8, min: 1 },
  refreshCost: {
    gold: { type: Number, min: 0, default: 0 },
    gems: { type: Number, min: 0, default: 0 }
  },
  freeRefreshCount: { type: Number, default: 0, min: 0 },
  
  // Objets
  items: [shopItemSchema],
  featuredItems: [{ type: String }],
  
  // Conditions
  levelRequirement: { type: Number, default: 1, min: 1 },
  vipLevelRequirement: { type: Number, min: 0 },
  chapterRequirement: { type: Number, min: 1 },
  
  // Métadonnées
  priority: { type: Number, default: 50, min: 1, max: 100 },
  iconUrl: { type: String, trim: true },
  bannerUrl: { type: String, trim: true }
}, {
  timestamps: true,
  collection: 'shops'
});

// === INDEX ===
shopSchema.index({ shopType: 1, isActive: 1 });
shopSchema.index({ nextResetTime: 1 });
shopSchema.index({ startTime: 1, endTime: 1 });
shopSchema.index({ levelRequirement: 1 });
shopSchema.index({ "items.instanceId": 1 });
shopSchema.index({ priority: -1 });

// === MÉTHODES STATIQUES ===

shopSchema.statics.getActiveShopsForPlayer = async function(playerId: string) {
  const Player = mongoose.model('Player');
  const player = await Player.findById(playerId).select('level vipLevel');
  
  if (!player) return [];
  
  const now = new Date();
  
  const filter: any = {
    isActive: true,
    levelRequirement: { $lte: player.level }
  };
  
  const andConditions: any[] = [];
  
  andConditions.push({
    $or: [
      { startTime: { $exists: false } },
      { startTime: { $lte: now } }
    ]
  });
  
  andConditions.push({
    $or: [
      { endTime: { $exists: false } },
      { endTime: { $gte: now } }
    ]
  });
  
  if (player.vipLevel) {
    andConditions.push({
      $or: [
        { vipLevelRequirement: { $exists: false } },
        { vipLevelRequirement: { $lte: player.vipLevel } }
      ]
    });
  }
  
  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }
  
  return this.find(filter).sort({ priority: -1, shopType: 1 });
};

shopSchema.statics.getShopsToReset = function() {
  return this.find({
    isActive: true,
    nextResetTime: { $lte: new Date() },
    resetFrequency: { $ne: "never" }
  });
};

// ✅ NOUVEAU : Configuration shop ElementalFriday
shopSchema.statics.createPredefinedShop = function(shopType: ShopType) {
  const shopConfigs: Record<ShopType, any> = {
    Daily: {
      name: "DAILY_SHOP_NAME",
      resetFrequency: "daily",
      maxItemsShown: 8,
      freeRefreshCount: 2,
      refreshCost: { gems: 50 },
      priority: 90
    },
    Weekly: {
      name: "WEEKLY_SHOP_NAME",
      resetFrequency: "weekly", 
      maxItemsShown: 12,
      freeRefreshCount: 1,
      refreshCost: { gems: 100 },
      priority: 80
    },
    Monthly: {
      name: "MONTHLY_SHOP_NAME",
      resetFrequency: "monthly",
      maxItemsShown: 16,
      freeRefreshCount: 0,
      refreshCost: { gems: 200 },
      priority: 85
    },
    Arena: {
      name: "ARENA_SHOP_NAME",
      resetFrequency: "daily",
      maxItemsShown: 8,
      levelRequirement: 10,
      priority: 70
    },
    Clan: {
      name: "CLAN_SHOP_NAME",
      resetFrequency: "weekly",
      maxItemsShown: 6,
      levelRequirement: 15,
      priority: 75
    },
    VIP: {
      name: "VIP_SHOP_NAME",
      resetFrequency: "weekly",
      maxItemsShown: 10,
      vipLevelRequirement: 1,
      priority: 95
    },
    Premium: {
      name: "PREMIUM_SHOP_NAME",
      resetFrequency: "never",
      maxItemsShown: 10,
      freeRefreshCount: 0,
      priority: 95
    },
    // ✅ NOUVEAU : Boutique élémentaire du vendredi
    ElementalFriday: {
      name: "ELEMENTAL_FRIDAY_SHOP_NAME",
      resetFrequency: "weekly", // Reset tous les vendredis
      maxItemsShown: 5, // 5 offres fixes
      freeRefreshCount: 0, // Pas de refresh
      refreshCost: undefined, // Pas de refresh payant
      priority: 100, // Priorité maximale
      levelRequirement: 1, // Accessible à tous
      description: "ELEMENTAL_FRIDAY_SHOP_DESCRIPTION"
    }
  };
  
  const config = shopConfigs[shopType];
  const now = new Date();
  let nextReset = new Date(now);
  
  // ✅ LOGIQUE SPÉCIALE pour ElementalFriday
  if (shopType === "ElementalFriday") {
    // Calculer le prochain vendredi
    const dayOfWeek = now.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    nextReset.setDate(now.getDate() + daysUntilFriday);
    nextReset.setHours(0, 0, 0, 0);
  } else {
    // Logique normale pour les autres shops
    switch (config.resetFrequency) {
      case "daily":
        nextReset.setDate(now.getDate() + 1);
        nextReset.setHours(0, 0, 0, 0);
        break;
      case "weekly":
        nextReset.setDate(now.getDate() + (7 - now.getDay()));
        nextReset.setHours(0, 0, 0, 0);
        break;
      case "monthly":
        nextReset.setMonth(now.getMonth() + 1, 1);
        nextReset.setHours(0, 0, 0, 0);
        break;
      case "never":
      default:
        nextReset.setFullYear(now.getFullYear() + 1);
        break;
    }
  }
  
  return new this({
    shopType,
    ...config,
    nextResetTime: nextReset
  });
};

// === MÉTHODES D'INSTANCE ===

shopSchema.methods.refreshShop = async function(): Promise<IShopDocument> {
  this.items = [];
  await this.generateItemsForShopType();
  this.resetTime = new Date();
  this.calculateNextResetTime();
  return await this.save();
};

// ✅ MODIFICATION : Calculer le prochain reset (logique spéciale vendredi)
shopSchema.methods.calculateNextResetTime = function() {
  const now = new Date();
  let nextReset = new Date(now);
  
  // ✅ LOGIQUE SPÉCIALE pour ElementalFriday
  if (this.shopType === "ElementalFriday") {
    const dayOfWeek = now.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    nextReset.setDate(now.getDate() + daysUntilFriday);
    nextReset.setHours(0, 0, 0, 0);
    this.nextResetTime = nextReset;
    return;
  }
  
  // Logique normale pour les autres shops
  switch (this.resetFrequency) {
    case "daily":
      nextReset.setDate(now.getDate() + 1);
      nextReset.setHours(0, 0, 0, 0);
      break;
    case "weekly":
      nextReset.setDate(now.getDate() + (7 - now.getDay()));
      nextReset.setHours(0, 0, 0, 0);
      break;
    case "monthly":
      nextReset.setMonth(now.getMonth() + 1, 1);
      nextReset.setHours(0, 0, 0, 0);
      break;
    case "never":
    case "event":
    default:
      nextReset.setFullYear(now.getFullYear() + 1);
      break;
  }
  
  this.nextResetTime = nextReset;
};

shopSchema.methods.generateItemsForShopType = async function() {
  switch (this.shopType) {
    case "Daily":
      await this.generateDailyItems();
      break;
    case "Weekly":
      await this.generateWeeklyItems();
      break;
    case "Monthly":
      await this.generateMonthlyItems();
      break;
    case "Premium":
      await this.generatePremiumItems();
      break;
    case "ElementalFriday": // ✅ NOUVEAU
      await this.generateElementalFridayItems();
      break;
    default:
      await this.generateDefaultItems();
  }
};

// ✅ NOUVELLE MÉTHODE : Générer les 5 offres du vendredi
shopSchema.methods.generateElementalFridayItems = async function() {
  console.log("🛒 Génération des offres ElementalFriday...");
  
  // Les 5 offres fixes avec prix et quantités croissantes
  const fridayOffers = [
    {
      name: "ELEMENTAL_FRIDAY_OFFER_1_NAME", // "Pack Découverte"
      description: "ELEMENTAL_FRIDAY_OFFER_1_DESC",
      ticketQuantity: 5,
      gems: 500,
      discount: 10,
      rarity: "Common" as const,
      tags: ["starter", "value"]
    },
    {
      name: "ELEMENTAL_FRIDAY_OFFER_2_NAME", // "Pack Explorateur"
      description: "ELEMENTAL_FRIDAY_OFFER_2_DESC",
      ticketQuantity: 12,
      gems: 1000,
      discount: 15,
      rarity: "Rare" as const,
      tags: ["popular", "value"]
    },
    {
      name: "ELEMENTAL_FRIDAY_OFFER_3_NAME", // "Pack Aventurier"
      description: "ELEMENTAL_FRIDAY_OFFER_3_DESC",
      ticketQuantity: 25,
      gems: 1800,
      discount: 20,
      rarity: "Epic" as const,
      tags: ["bestseller", "value"],
      isFeatured: true
    },
    {
      name: "ELEMENTAL_FRIDAY_OFFER_4_NAME", // "Pack Héros"
      description: "ELEMENTAL_FRIDAY_OFFER_4_DESC",
      ticketQuantity: 50,
      gems: 3200,
      discount: 25,
      rarity: "Legendary" as const,
      tags: ["premium", "whale"]
    },
    {
      name: "ELEMENTAL_FRIDAY_OFFER_5_NAME", // "Pack Légende"
      description: "ELEMENTAL_FRIDAY_OFFER_5_DESC",
      ticketQuantity: 100,
      gems: 5500,
      discount: 30,
      rarity: "Mythic" as const,
      tags: ["ultimate", "whale", "limited"],
      isFeatured: true,
      isPromotional: true,
      promotionalText: "ELEMENTAL_FRIDAY_BEST_VALUE"
    }
  ];

  // Créer les 5 offres
  for (const offer of fridayOffers) {
    // Calculer prix original (pour afficher la remise)
    const basePrice = offer.ticketQuantity * 150; // 150 gems par ticket de base
    const originalPrice = Math.round(basePrice);
    const finalPrice = Math.round(originalPrice * (100 - offer.discount) / 100);

    this.addItem({
      itemId: `elemental_ticket_pack_${offer.ticketQuantity}`,
      type: "ElementalTicket",
      name: offer.name,
      description: offer.description,
      content: {
        elementalTicketType: "fire", // Élément aléatoire, peut être changé
        quantity: offer.ticketQuantity
      },
      cost: {
        gems: finalPrice
      },
      rarity: offer.rarity,
      originalPrice: originalPrice,
      discountPercent: offer.discount,
      maxStock: -1, // Stock illimité
      maxPurchasePerPlayer: 3, // 3 achats max par pack
      levelRequirement: 1,
      isPromotional: offer.isPromotional || false,
      promotionalText: offer.promotionalText,
      isFeatured: offer.isFeatured || false,
      weight: 100,
      tags: offer.tags
    });
  }

  console.log(`✅ ${fridayOffers.length} offres ElementalFriday générées`);
};

shopSchema.methods.generateDailyItems = async function() {
  const Item = mongoose.model('Item');
  const items = await Item.find({ category: "Consumable" }).limit(15);
  
  for (const item of items.slice(0, this.maxItemsShown)) {
    this.addItem({
      itemId: item.itemId,
      type: "Item",
      name: item.name,
      content: { itemId: item.itemId, quantity: 1 },
      cost: { gold: item.sellPrice * 2 },
      rarity: item.rarity,
      maxStock: 5,
      weight: 70
    });
  }
};

shopSchema.methods.generateWeeklyItems = async function() {
  const Item = mongoose.model('Item');
  const items = await Item.find({ rarity: { $in: ["Rare", "Epic"] } }).limit(20);
  
  for (const item of items.slice(0, this.maxItemsShown)) {
    this.addItem({
      itemId: item.itemId,
      type: "Item",
      name: item.name,
      content: { itemId: item.itemId, quantity: 1 },
      cost: { gems: Math.floor(item.sellPrice * 0.8) },
      rarity: item.rarity,
      maxStock: 3,
      maxPurchasePerPlayer: 2,
      weight: 60
    });
  }
};

shopSchema.methods.generateMonthlyItems = async function() {
  const Item = mongoose.model('Item');
  const items = await Item.find({ rarity: { $in: ["Epic", "Legendary"] } }).limit(25);
  
  for (const item of items.slice(0, this.maxItemsShown)) {
    this.addItem({
      itemId: item.itemId,
      type: "Item",
      name: item.name,
      content: { itemId: item.itemId, quantity: 1 },
      cost: { gems: Math.floor(item.sellPrice * 0.6) },
      rarity: item.rarity,
      maxStock: 1,
      maxPurchasePerPlayer: 1,
      weight: 40,
      isPromotional: true,
      discountPercent: 25
    });
  }
};

shopSchema.methods.generatePremiumItems = async function() {
  const Item = mongoose.model('Item');
  const items = await Item.find({ rarity: "Legendary" }).limit(15);
  
  for (const item of items.slice(0, this.maxItemsShown)) {
    this.addItem({
      itemId: item.itemId,
      type: "Bundle",
      name: `Premium Pack: ${item.name}`,
      content: { 
        bundleItems: [
          { type: "Item", itemId: item.itemId, quantity: 1 },
          { type: "Currency", itemId: "gems", quantity: 500 },
          { type: "Currency", itemId: "gold", quantity: 10000 }
        ]
      },
      cost: { paidGems: 999 },
      rarity: "Legendary",
      maxStock: -1,
      maxPurchasePerPlayer: 5,
      weight: 100,
      isFeatured: true,
      tags: ["premium", "value", "limited"]
    });
  }
};

shopSchema.methods.generateDefaultItems = async function() {
  const Item = mongoose.model('Item');
  const items = await Item.find().limit(10);
  
  for (const item of items.slice(0, Math.min(this.maxItemsShown, 4))) {
    this.addItem({
      itemId: item.itemId,
      type: "Item",
      name: item.name,
      content: { itemId: item.itemId, quantity: 1 },
      cost: { gold: item.sellPrice * 1.5 },
      rarity: item.rarity,
      maxStock: 3,
      weight: 60
    });
  }
};

shopSchema.methods.addItem = function(itemData: Partial<IShopItem>): typeof this {
  const newItem: IShopItem = {
    itemId: itemData.itemId || "",
    instanceId: new mongoose.Types.ObjectId().toString(),
    type: itemData.type || "Item",
    name: itemData.name || "Unknown Item",
    description: itemData.description || "",
    content: itemData.content || { quantity: 1 },
    cost: itemData.cost || { gold: 100 },
    rarity: itemData.rarity || "Common",
    originalPrice: itemData.originalPrice,
    discountPercent: itemData.discountPercent || 0,
    maxStock: itemData.maxStock || -1,
    currentStock: itemData.currentStock || (itemData.maxStock === -1 ? 999999 : itemData.maxStock || -1),
    maxPurchasePerPlayer: itemData.maxPurchasePerPlayer || -1,
    purchaseHistory: [],
    levelRequirement: itemData.levelRequirement || 1,
    vipLevelRequirement: itemData.vipLevelRequirement,
    chapterRequirement: itemData.chapterRequirement,
    isPromotional: itemData.isPromotional || false,
    promotionalText: itemData.promotionalText,
    isFeatured: itemData.isFeatured || false,
    weight: itemData.weight || 50,
    tags: itemData.tags || []
  };
  
  this.items.push(newItem);
  return this;
};

shopSchema.methods.removeItem = function(instanceId: string): boolean {
  const initialLength = this.items.length;
  this.items = this.items.filter((item: IShopItem) => item.instanceId !== instanceId);
  return this.items.length < initialLength;
};

shopSchema.methods.canPlayerAccess = async function(playerId: string): Promise<boolean> {
  const Player = mongoose.model('Player');
  const player = await Player.findById(playerId).select('level vipLevel');
  
  if (!player) return false;
  
  if (player.level < this.levelRequirement) return false;
  
  if (this.vipLevelRequirement && (!player.vipLevel || player.vipLevel < this.vipLevelRequirement)) {
    return false;
  }
  
  const now = new Date();
  if (this.startTime && now < this.startTime) return false;
  if (this.endTime && now > this.endTime) return false;
  
  return true;
};

shopSchema.methods.canPlayerPurchase = async function(instanceId: string, playerId: string) {
  const item = this.items.find((item: IShopItem) => item.instanceId === instanceId);
  if (!item) {
    return { canPurchase: false, reason: "ITEM_NOT_FOUND" };
  }
  
  if (item.maxStock !== -1 && item.currentStock <= 0) {
    return { canPurchase: false, reason: "OUT_OF_STOCK" };
  }
  
  if (item.maxPurchasePerPlayer !== -1) {
    const playerPurchases = item.purchaseHistory
      .filter((p: { playerId: string; quantity: number; purchaseDate: Date }) => p.playerId === playerId)
      .reduce((sum: number, p: { quantity: number }) => sum + p.quantity, 0);
    
    if (playerPurchases >= item.maxPurchasePerPlayer) {
      return { canPurchase: false, reason: "PURCHASE_LIMIT_REACHED" };
    }
  }
  
  return { canPurchase: true };
};

shopSchema.methods.getPlayerPurchaseHistory = function(playerId: string) {
  const history: any[] = [];
  
  this.items.forEach((item: IShopItem) => {
    item.purchaseHistory.forEach(purchase => {
      if (purchase.playerId === playerId) {
        history.push({
          ...purchase,
          itemName: item.name,
          itemId: item.itemId
        });
      }
    });
  });
  
  return history.sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime());
};

shopSchema.methods.applyDiscount = function(instanceId: string, discountPercent: number): boolean {
  const item = this.items.find((item: IShopItem) => item.instanceId === instanceId);
  if (!item) return false;
  
  item.discountPercent = Math.max(0, Math.min(100, discountPercent));
  item.isPromotional = discountPercent > 0;
  
  return true;
};

export default mongoose.model<IShopDocument>("Shop", shopSchema);

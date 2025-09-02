import mongoose, { Document, Schema } from "mongoose";

// === INTERFACES ===

// Objet à vendre dans le shop
interface IShopItem {
  itemId: string;           // ID de l'objet de base
  instanceId: string;       // ID unique de cette offre
  type: "Item" | "Currency" | "Fragment" | "Hero" | "Chest" | "Bundle";
  name: string;            // Nom affiché (peut utiliser des labels)
  description?: string;
  
  // Contenu de l'offre
  content: {
    itemId?: string;        // Pour les objets normaux
    heroId?: string;        // Pour les héros/fragments
    currencyType?: "gold" | "gems" | "paidGems" | "tickets";
    quantity: number;
    level?: number;         // Pour équipement/héros
    enhancement?: number;   // Pour équipement
    bundleItems?: Array<{   // Pour les bundles
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
    arenaCoins?: number;    // Monnaies spéciales
    clanCoins?: number;
    eventTokens?: number;
    labTokens?: number;
    guildCoins?: number;
  };
  
  // Propriétés de vente
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" | "Ascended";
  originalPrice?: number;  // Prix original (pour les promos)
  discountPercent?: number; // % de réduction
  
  // Limitations
  maxStock: number;        // -1 = illimité
  currentStock: number;
  maxPurchasePerPlayer: number; // -1 = illimité
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
  isFeatured: boolean;     // Mis en avant
  weight: number;          // Probabilité d'apparition
  tags: string[];          // "new", "hot", "limited", etc.
}

// Types de shops comme AFK Arena
type ShopType = 
  | "General"        // Shop général (toujours disponible)
  | "Arena"         // Boutique arène
  | "Clan"          // Boutique de clan/guilde
  | "Labyrinth"     // Boutique du labyrinthe
  | "Event"         // Boutique d'événement
  | "VIP"           // Boutique VIP
  | "Daily"         // Offres quotidiennes
  | "Weekly"        // Offres hebdomadaires
  | "Monthly"       // Offres mensuelles
  | "Flash"         // Ventes flash
  | "Bundle"        // Packs spéciaux
  | "Seasonal";     // Boutique saisonnière

// Document principal du shop
interface IShopDocument extends Document {
  shopType: ShopType;
  name: string;
  description?: string;
  isActive: boolean;
  
  // Timing
  startTime?: Date;        // Pour événements/promos
  endTime?: Date;
  resetTime: Date;         // Dernier reset
  nextResetTime: Date;     // Prochain reset
  resetFrequency: "never" | "daily" | "weekly" | "monthly" | "event";
  
  // Configuration
  maxItemsShown: number;   // Nombre d'objets affichés
  refreshCost?: {          // Coût pour actualiser manuellement
    gold?: number;
    gems?: number;
  };
  freeRefreshCount: number; // Nombre d'actualisations gratuites
  
  // Objets
  items: IShopItem[];
  featuredItems: string[]; // IDs des objets mis en avant
  
  // Conditions d'accès
  levelRequirement: number;
  vipLevelRequirement?: number;
  chapterRequirement?: number;
  
  // Métadonnées
  priority: number;        // Ordre d'affichage
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
  applyDiscount(instanceId: string, discountPercent: number): boolean;
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
    enum: ["Item", "Currency", "Fragment", "Hero", "Chest", "Bundle"],
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
    tickets: { type: Number, min: 0, default: 0 },
    arenaCoins: { type: Number, min: 0, default: 0 },
    clanCoins: { type: Number, min: 0, default: 0 },
    eventTokens: { type: Number, min: 0, default: 0 },
    labTokens: { type: Number, min: 0, default: 0 },
    guildCoins: { type: Number, min: 0, default: 0 }
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
    default: function() {
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
    enum: ["General", "Arena", "Clan", "Labyrinth", "Event", "VIP", "Daily", "Weekly", "Monthly", "Flash", "Bundle", "Seasonal"],
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

// Obtenir shops actifs pour un joueur
shopSchema.statics.getActiveShopsForPlayer = async function(playerId: string) {
  const Player = mongoose.model('Player');
  const player = await Player.findById(playerId).select('level vipLevel chapter');
  
  if (!player) return [];
  
  const now = new Date();
  return this.find({
    isActive: true,
    levelRequirement: { $lte: player.level },
    $or: [
      { startTime: { $exists: false } },
      { startTime: { $lte: now } }
    ],
    $or: [
      { endTime: { $exists: false } },
      { endTime: { $gte: now } }
    ]
  }).sort({ priority: -1, shopType: 1 });
};

// Obtenir shops à renouveler
shopSchema.statics.getShopsToReset = function() {
  return this.find({
    isActive: true,
    nextResetTime: { $lte: new Date() },
    resetFrequency: { $ne: "never" }
  });
};

// Créer shop prédéfini
shopSchema.statics.createPredefinedShop = function(shopType: ShopType) {
  const shopConfigs: Record<ShopType, any> = {
    General: {
      name: "GENERAL_SHOP_NAME",
      resetFrequency: "never",
      maxItemsShown: 12,
      freeRefreshCount: 3,
      refreshCost: { gems: 50 }
    },
    Arena: {
      name: "ARENA_SHOP_NAME", 
      resetFrequency: "daily",
      maxItemsShown: 8,
      levelRequirement: 10
    },
    Clan: {
      name: "CLAN_SHOP_NAME",
      resetFrequency: "weekly", 
      maxItemsShown: 6,
      levelRequirement: 15
    },
    Daily: {
      name: "DAILY_OFFERS_NAME",
      resetFrequency: "daily",
      maxItemsShown: 4,
      priority: 90
    },
    VIP: {
      name: "VIP_SHOP_NAME",
      resetFrequency: "weekly",
      maxItemsShown: 10,
      vipLevelRequirement: 1,
      priority: 95
    },
    Labyrinth: {
      name: "LABYRINTH_SHOP_NAME",
      resetFrequency: "weekly",
      maxItemsShown: 6,
      levelRequirement: 20
    },
    Event: {
      name: "EVENT_SHOP_NAME",
      resetFrequency: "event",
      maxItemsShown: 8,
      levelRequirement: 5
    },
    Weekly: {
      name: "WEEKLY_SHOP_NAME",
      resetFrequency: "weekly",
      maxItemsShown: 6,
      priority: 80
    },
    Monthly: {
      name: "MONTHLY_SHOP_NAME",
      resetFrequency: "monthly",
      maxItemsShown: 10,
      priority: 85
    },
    Flash: {
      name: "FLASH_SHOP_NAME",
      resetFrequency: "daily",
      maxItemsShown: 4,
      priority: 100
    },
    Bundle: {
      name: "BUNDLE_SHOP_NAME",
      resetFrequency: "never",
      maxItemsShown: 8,
      priority: 90
    },
    Seasonal: {
      name: "SEASONAL_SHOP_NAME",
      resetFrequency: "event",
      maxItemsShown: 12,
      priority: 95
    }
  };
  
  const config = shopConfigs[shopType] || shopConfigs.General;
  const now = new Date();
  let nextReset = new Date(now);
  
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
  }
  
  return new this({
    shopType,
    ...config,
    nextResetTime: nextReset
  });
};

// === MÉTHODES D'INSTANCE ===

// Rafraîchir le shop
shopSchema.methods.refreshShop = async function(): Promise<IShopDocument> {
  // Vider les objets actuels
  this.items = [];
  
  // Générer nouveaux objets selon le type
  await this.generateItemsForShopType();
  
  // Mettre à jour les timestamps
  this.resetTime = new Date();
  this.calculateNextResetTime();
  
  return await this.save();
};

// Calculer le prochain reset
shopSchema.methods.calculateNextResetTime = function() {
  const now = new Date();
  let nextReset = new Date(now);
  
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

// Générer objets selon le type de shop
shopSchema.methods.generateItemsForShopType = async function() {
  const Item = mongoose.model('Item');
  
  // Logique de génération selon le type de shop
  switch (this.shopType) {
    case "General":
      await this.generateGeneralItems();
      break;
    case "Arena":
      await this.generateArenaItems();
      break;
    case "Clan":
      await this.generateClanItems();
      break;
    case "Daily":
      await this.generateDailyItems();
      break;
    default:
      await this.generateDefaultItems();
  }
};

// Générer objets du shop général
shopSchema.methods.generateGeneralItems = async function() {
  const Item = mongoose.model('Item');
  const items = await Item.find({ category: { $in: ["Equipment", "Consumable"] } }).limit(20);
  
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

// Générer objets du shop arène
shopSchema.methods.generateArenaItems = async function() {
  const Item = mongoose.model('Item');
  const items = await Item.find({ rarity: { $in: ["Rare", "Epic"] } }).limit(15);
  
  for (const item of items.slice(0, this.maxItemsShown)) {
    this.addItem({
      itemId: item.itemId,
      type: "Item", 
      name: item.name,
      content: { itemId: item.itemId, quantity: 1 },
      cost: { arenaCoins: Math.floor(item.sellPrice * 0.5) },
      rarity: item.rarity,
      maxStock: 3,
      maxPurchasePerPlayer: 2,
      weight: 60
    });
  }
};

// Ajouter un objet
shopSchema.methods.addItem = function(itemData: Partial<IShopItem>) {
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

// Vérifier si joueur peut acheter
shopSchema.methods.canPlayerPurchase = async function(instanceId: string, playerId: string) {
  const item = this.items.find((item: IShopItem) => item.instanceId === instanceId);
  if (!item) {
    return { canPurchase: false, reason: "ITEM_NOT_FOUND" };
  }
  
  // Vérifier le stock
  if (item.maxStock !== -1 && item.currentStock <= 0) {
    return { canPurchase: false, reason: "OUT_OF_STOCK" };
  }
  
  // Vérifier les achats par joueur
  if (item.maxPurchasePerPlayer !== -1) {
    const playerPurchases = item.purchaseHistory
      .filter((p: any) => p.playerId === playerId)
      .reduce((sum: number, p: any) => sum + p.quantity, 0);
    
    if (playerPurchases >= item.maxPurchasePerPlayer) {
      return { canPurchase: false, reason: "PURCHASE_LIMIT_REACHED" };
    }
  }
  
  return { canPurchase: true };
};

export default mongoose.model<IShopDocument>("Shop", shopSchema);

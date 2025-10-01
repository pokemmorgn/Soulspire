import mongoose, { Document, Schema } from "mongoose";

// === INTERFACES ===

// Objet possédé par le joueur (instance d'un Item)
interface IOwnedItem {
  itemId: string;        // Référence vers l'Item de base
  instanceId: string;    // ID unique de cette instance
  quantity: number;      // Quantité possédée
  level: number;         // Niveau de l'objet (pour équipement)
  enhancement: number;   // Niveau d'amélioration (+0 à +15)
  isEquipped: boolean;   // Si équipé sur un héros
  equippedTo?: string;   // ID du héros qui l'équipe
  
  // Données spécifiques selon le type
  equipmentData?: {
    durability: number;        // Durabilité (0-100)
    socketedGems?: string[];   // Gemmes incrustées
    upgradeHistory: Date[];    // Historique des améliorations
  };
  
  consumableData?: {
    expirationDate?: Date;     // Date d'expiration (pour certains consommables)
    usageCount?: number;       // Nombre d'utilisations restantes
  };
  
  // Métadonnées
  acquiredDate: Date;
  lastUsedDate?: Date;
}

// Stockage par catégories (comme AFK Arena)
interface ICategorizedStorage {
  // Équipement
  weapons: IOwnedItem[];
  helmets: IOwnedItem[];
  armors: IOwnedItem[];
  boots: IOwnedItem[];
  gloves: IOwnedItem[];
  accessories: IOwnedItem[];
  
  // Consommables
  potions: IOwnedItem[];
  scrolls: IOwnedItem[];
  enhancementItems: IOwnedItem[];
  
  // Matériaux
  enhancementMaterials: IOwnedItem[];
  evolutionMaterials: IOwnedItem[];
  craftingMaterials: IOwnedItem[];
  awakeningMaterials: IOwnedItem[];
  
  // Fragments et monnaies spéciales
  heroFragments: Map<string, number>;    // heroId -> quantité
  specialCurrencies: Map<string, number>; // currencyId -> quantité
  
  // Artefacts
  artifacts: IOwnedItem[];
}

// Statistiques de l'inventaire
interface IInventoryStats {
  totalItems: number;
  totalWeight: number;
  maxCapacity: number;
  
  // Par catégorie
  equipmentCount: number;
  consumableCount: number;
  materialCount: number;
  artifactCount: number;
  
  // Par rareté
  commonCount: number;
  rareCount: number;
  epicCount: number;
  legendaryCount: number;
  mythicCount: number;
  ascendedCount: number;
  
  // Équipement spécifique
  equippedItemsCount: number;
  maxLevelEquipment: number;
  setsCompleted: string[];
}

// Document principal de l'inventaire
interface IInventoryDocument extends Document {
  playerId: string;  // ✅ RÉFÉRENCE vers Player._id (pas vers Account)
  
  // Monnaies de base (synchronisées avec Player)
  gold: number;
  gems: number;
  paidGems: number;
  tickets: number;
  
  // Stockage organisé
  storage: ICategorizedStorage;
  
  // Configuration
  maxCapacity: number;
  autoSell: boolean;           // Auto-vendre les objets de faible rareté
  autoSellRarity: string;      // Rareté maximum à auto-vendre
  
  // ✅ NOUVEAU: Métadonnées serveur
  serverId?: string;           // Pour traçabilité et migration future
  lastSyncAt: Date;           // Dernière synchronisation avec Player
  lastCleanup: Date;          // Dernière suppression d'objets expirés
  
  // === MÉTHODES D'INSTANCE ===
  
  // Gestion des objets
  addItem(itemId: string, quantity?: number, level?: number): Promise<IOwnedItem>;
  removeItem(instanceId: string, quantity?: number): Promise<boolean>;
  hasItem(itemId: string, quantity?: number): boolean;
  getItem(instanceId: string): IOwnedItem | null;
  getItemsByCategory(category: string, subCategory?: string): IOwnedItem[];
  
  // Équipement
  equipItem(instanceId: string, heroId: string): Promise<boolean>;
  unequipItem(instanceId: string): Promise<boolean>;
  getEquippedItems(heroId?: string): IOwnedItem[];
  upgradeEquipment(instanceId: string, targetLevel?: number, targetEnhancement?: number): Promise<boolean>;
  
  // Gestion des sets
  getEquippedSetPieces(heroId: string, setId: string): number;
  getAvailableSetPieces(setId: string): IOwnedItem[];
  
  // Consommables
  useConsumable(instanceId: string, heroId?: string): Promise<any>;
  getExpiredConsumables(): IOwnedItem[];
  
  // Matériaux
  getMaterialsByType(materialType: string, grade?: string): IOwnedItem[];
  canCraftItem(itemId: string): Promise<boolean>;
  
  // ✅ NOUVELLES MÉTHODES pour la nouvelle architecture
  syncWithPlayer(): Promise<boolean>;
  validateConsistency(): Promise<{ valid: boolean; issues: string[] }>;
  
  // Utilitaires
  getInventoryStats(): IInventoryStats;
  cleanupExpiredItems(): Promise<number>;
  optimizeStorage(): Promise<void>;
  calculateTotalValue(): number;
  
  // Tri et filtres
  sortItemsByRarity(items: IOwnedItem[]): IOwnedItem[];
  sortItemsByLevel(items: IOwnedItem[]): IOwnedItem[];
  filterItemsByRarity(items: IOwnedItem[], rarity: string): IOwnedItem[];
}

// === SCHÉMAS MONGOOSE ===

const ownedItemSchema = new Schema<IOwnedItem>({
  itemId: { 
    type: String, 
    required: true,
    ref: 'Item'
  },
  instanceId: { 
    type: String, 
    required: true,
    // ✅ CORRECTION: Pas d'unique ici car géré au niveau global
    default: () => new mongoose.Types.ObjectId().toString()
  },
  quantity: { 
    type: Number, 
    required: true,
    min: 1,
    default: 1
  },
  level: { 
    type: Number, 
    min: 1,
    max: 100,
    default: 1
  },
  enhancement: { 
    type: Number, 
    min: 0,
    max: 15,
    default: 0
  },
  isEquipped: { 
    type: Boolean, 
    default: false 
  },
  equippedTo: { 
    type: String,
    default: null
  },
  
  // Données spécifiques équipement
  equipmentData: {
    durability: { 
      type: Number, 
      min: 0, 
      max: 100, 
      default: 100 
    },
    socketedGems: [{ type: String }],
    upgradeHistory: [{ type: Date }]
  },
  
  // Données spécifiques consommables
  consumableData: {
    expirationDate: { type: Date },
    usageCount: { 
      type: Number, 
      min: 0,
      default: 1
    }
  },
  
  // Métadonnées
  acquiredDate: { 
    type: Date, 
    default: Date.now 
  },
  lastUsedDate: { type: Date }
}, { _id: false });

const categorizedStorageSchema = new Schema<ICategorizedStorage>({
  // Équipement par slot
  weapons: [ownedItemSchema],
  helmets: [ownedItemSchema],
  armors: [ownedItemSchema],
  boots: [ownedItemSchema],
  gloves: [ownedItemSchema],
  accessories: [ownedItemSchema],
  
  // Consommables
  potions: [ownedItemSchema],
  scrolls: [ownedItemSchema],
  enhancementItems: [ownedItemSchema],
  
  // Matériaux
  enhancementMaterials: [ownedItemSchema],
  evolutionMaterials: [ownedItemSchema],
  craftingMaterials: [ownedItemSchema],
  awakeningMaterials: [ownedItemSchema],
  
  // Maps pour fragments et monnaies spéciales
  heroFragments: { 
    type: Map, 
    of: Number, 
    default: new Map()
  },
  specialCurrencies: { 
    type: Map, 
    of: Number, 
    default: new Map()
  },
  
  // Artefacts
  artifacts: [ownedItemSchema]
}, { _id: false });

const inventorySchema = new Schema<IInventoryDocument>({
  playerId: { 
    type: String,
    required: true,
    unique: true  // ✅ UN inventaire par Player
  },
  
  // Monnaies de base (synchronisées avec Player)
  gold: { 
    type: Number, 
    default: 0,
    min: 0
  },
  gems: { 
    type: Number, 
    default: 0,
    min: 0
  },
  paidGems: { 
    type: Number, 
    default: 0,
    min: 0
  },
  tickets: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  // Stockage principal
  storage: {
    type: categorizedStorageSchema,
    default: () => ({
      weapons: [],
      helmets: [],
      armors: [],
      boots: [],
      gloves: [],
      accessories: [],
      potions: [],
      scrolls: [],
      enhancementItems: [],
      enhancementMaterials: [],
      evolutionMaterials: [],
      craftingMaterials: [],
      awakeningMaterials: [],
      heroFragments: new Map(),
      specialCurrencies: new Map(),
      artifacts: []
    })
  },
  
  // Configuration
  maxCapacity: { 
    type: Number, 
    default: 200,
    min: 100
  },
  autoSell: { 
    type: Boolean, 
    default: false 
  },
  autoSellRarity: { 
    type: String, 
    enum: ["Common", "Rare"],
    default: "Common"
  },
  
  // ✅ NOUVELLES MÉTADONNÉES
  serverId: {
    type: String,
    match: /^S\d+$/,
    // Pas required pour compatibilité avec données existantes
  },
  lastSyncAt: { 
    type: Date, 
    default: Date.now 
  },
  lastCleanup: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true,
  collection: 'inventories'
});

// === INDEX OPTIMISÉS ===
inventorySchema.index({ playerId: 1 }, { unique: true });
inventorySchema.index({ serverId: 1 });
inventorySchema.index({ playerId: 1, serverId: 1 });
inventorySchema.index({ "storage.weapons.isEquipped": 1 });
inventorySchema.index({ "storage.*.instanceId": 1 });
inventorySchema.index({ lastSyncAt: 1 });


// === MIDDLEWARE DE VALIDATION ===
inventorySchema.pre('save', function(next) {
  // S'assurer que les monnaies ne sont jamais négatives
  if (this.gold < 0) this.gold = 0;
  if (this.gems < 0) this.gems = 0;
  if (this.paidGems < 0) this.paidGems = 0;
  if (this.tickets < 0) this.tickets = 0;
  
  // Mettre à jour lastSyncAt
  this.lastSyncAt = new Date();
  
  // Nettoyer les maps vides
  if (this.storage.heroFragments && this.storage.heroFragments.size === 0) {
    this.storage.heroFragments = new Map();
  }
  if (this.storage.specialCurrencies && this.storage.specialCurrencies.size === 0) {
    this.storage.specialCurrencies = new Map();
  }
  
  next();
});

// === MÉTHODES STATIQUES ===

inventorySchema.statics.createForPlayer = async function(playerId: string, serverId?: string) {
  // ✅ VÉRIFIER que le Player existe d'abord
  const Player = mongoose.model('Player');
  const player = await Player.findById(playerId);
  
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }
  
  const inventory = new this({
    playerId,
    serverId: serverId || player.serverId,
    gold: player.gold || 0,
    gems: player.gems || 0,
    paidGems: player.paidGems || 0,
    tickets: player.tickets || 0,
    maxCapacity: 200,
    storage: {
      weapons: [],
      helmets: [],
      armors: [],
      boots: [],
      gloves: [],
      accessories: [],
      potions: [],
      scrolls: [],
      enhancementItems: [],
      enhancementMaterials: [],
      evolutionMaterials: [],
      craftingMaterials: [],
      awakeningMaterials: [],
      heroFragments: new Map(),
      specialCurrencies: new Map(),
      artifacts: []
    }
  });
  
  return await inventory.save();
};

// ✅ NOUVELLE MÉTHODE: Trouver par Player et Serveur
inventorySchema.statics.findByPlayerAndServer = function(playerId: string, serverId?: string) {
  const query: any = { playerId };
  if (serverId) query.serverId = serverId;
  return this.findOne(query);
};

// ✅ NOUVELLE MÉTHODE: Migration en lot
inventorySchema.statics.migrateToNewFormat = async function() {
  const Player = mongoose.model('Player');
  const inventories = await this.find({ serverId: { $exists: false } });
  
  let migrated = 0;
  let errors = 0;
  
  for (const inventory of inventories) {
    try {
      const player = await Player.findById(inventory.playerId);
      if (player) {
        inventory.serverId = player.serverId;
        inventory.gold = player.gold;
        inventory.gems = player.gems;
        inventory.paidGems = player.paidGems;
        inventory.tickets = player.tickets;
        await inventory.save();
        migrated++;
      } else {
        // Supprimer inventaire orphelin
        await this.deleteOne({ _id: inventory._id });
      }
    } catch (error) {
      console.error(`Migration error for inventory ${inventory.playerId}:`, error);
      errors++;
    }
  }
  
  return { migrated, errors };
};

// === MÉTHODES D'INSTANCE ===

// ✅ NOUVELLE MÉTHODE: Synchroniser avec Player
inventorySchema.methods.syncWithPlayer = async function(): Promise<boolean> {
  try {
    const Player = mongoose.model('Player');
    const player = await Player.findById(this.playerId);
    
    if (!player) {
      console.error(`Player not found for inventory: ${this.playerId}`);
      return false;
    }
    
    // Synchroniser les monnaies
    this.gold = player.gold;
    this.gems = player.gems;
    this.paidGems = player.paidGems;
    this.tickets = player.tickets;
    
    // Mettre à jour serverId si manquant
    if (!this.serverId && player.serverId) {
      this.serverId = player.serverId;
    }
    
    this.lastSyncAt = new Date();
    await this.save();
    
    console.log(`✅ Inventaire synchronisé pour ${this.playerId}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Erreur synchronisation inventaire ${this.playerId}:`, error);
    return false;
  }
};

// ✅ NOUVELLE MÉTHODE: Valider la cohérence
inventorySchema.methods.validateConsistency = async function(): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
  
  try {
    const Player = mongoose.model('Player');
    const player = await Player.findById(this.playerId);
    
    if (!player) {
      issues.push("Player not found");
      return { valid: false, issues };
    }
    
    // Vérifier synchronisation des monnaies
    if (this.gold !== player.gold) {
      issues.push(`Gold mismatch: Inventory(${this.gold}) vs Player(${player.gold})`);
    }
    
    if (this.gems !== player.gems) {
      issues.push(`Gems mismatch: Inventory(${this.gems}) vs Player(${player.gems})`);
    }
    
    if (this.paidGems !== player.paidGems) {
      issues.push(`Paid gems mismatch: Inventory(${this.paidGems}) vs Player(${player.paidGems})`);
    }
    
    if (this.tickets !== player.tickets) {
      issues.push(`Tickets mismatch: Inventory(${this.tickets}) vs Player(${player.tickets})`);
    }
    
    // Vérifier serverId
    if (this.serverId && player.serverId && this.serverId !== player.serverId) {
      issues.push(`Server mismatch: Inventory(${this.serverId}) vs Player(${player.serverId})`);
    }
    
    // Vérifier objets équipés vs héros existants
    const equippedItems = this.getEquippedItems();
    for (const item of equippedItems) {
      const heroExists = player.heroes.some((h: any) => h.heroId.toString() === item.equippedTo);
      if (!heroExists) {
        issues.push(`Item ${item.instanceId} equipped to non-existent hero ${item.equippedTo}`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
    
  } catch (error: any) {
    issues.push(`Validation error: ${error.message}`);
    return { valid: false, issues };
  }
};

// Ajouter un objet (méthode existante avec améliorations)
inventorySchema.methods.addItem = async function(
  itemId: string, 
  quantity: number = 1, 
  level: number = 1
): Promise<IOwnedItem> {
  // Récupérer les données de l'objet depuis le modèle Item
  const Item = mongoose.model('Item');
  const item = await Item.findOne({ itemId });
  
  if (!item) {
    throw new Error(`Item not found: ${itemId}`);
  }
  
  const newOwnedItem: IOwnedItem = {
    itemId,
    instanceId: new mongoose.Types.ObjectId().toString(),
    quantity,
    level,
    enhancement: 0,
    isEquipped: false,
    acquiredDate: new Date()
  };
  
  // Déterminer la catégorie de stockage
  let storageCategory: keyof ICategorizedStorage;
  
  if (item.category === "Equipment") {
    const slotMap: { [key: string]: string } = {
      "Weapon": "weapons",
      "Helmet": "helmets", 
      "Armor": "armors",
      "Boots": "boots",
      "Gloves": "gloves",
      "Accessory": "accessories"
    };
    storageCategory = slotMap[item.equipmentSlot] as keyof ICategorizedStorage;
  } else if (item.category === "Consumable") {
    const consumableMap: { [key: string]: string } = {
      "Potion": "potions",
      "Scroll": "scrolls",
      "Enhancement": "enhancementItems",
      "XP": "enhancementItems",
      "Currency": "enhancementItems"
    };
    storageCategory = consumableMap[item.consumableType] as keyof ICategorizedStorage;
  } else if (item.category === "Material") {
    const materialMap: { [key: string]: string } = {
      "Enhancement": "enhancementMaterials",
      "Evolution": "evolutionMaterials", 
      "Crafting": "craftingMaterials",
      "Awakening": "awakeningMaterials"
    };
    storageCategory = materialMap[item.materialType] as keyof ICategorizedStorage;
  } else if (item.category === "Artifact") {
    storageCategory = "artifacts";
  } else if (item.category === "Chest") {
    storageCategory = "artifacts";
  } else if (item.category === "Fragment") {
    // Les fragments vont dans les maps spéciales
    const fragmentsMap = this.storage.heroFragments || new Map();
    const currentQuantity = fragmentsMap.get(itemId) || 0;
    fragmentsMap.set(itemId, currentQuantity + quantity);
    this.storage.heroFragments = fragmentsMap;
    await this.save();
    return newOwnedItem;
  } else if (item.category === "Currency") {
    // Les monnaies spéciales vont dans les maps
    const currenciesMap = this.storage.specialCurrencies || new Map();
    const currentQuantity = currenciesMap.get(itemId) || 0;
    currenciesMap.set(itemId, currentQuantity + quantity);
    this.storage.specialCurrencies = currenciesMap;
    await this.save();
    return newOwnedItem;
  } else {
    throw new Error(`Cannot store item of category: ${item.category}`);
  }
  
  // Ajouter à la bonne catégorie
  if (Array.isArray(this.storage[storageCategory])) {
    (this.storage[storageCategory] as IOwnedItem[]).push(newOwnedItem);
  } else {
    throw new Error(`Invalid storage category: ${storageCategory}`);
  }
  
  await this.save();
  return newOwnedItem;
};

// === AUTRES MÉTHODES EXISTANTES (inchangées) ===

// Supprimer un objet
inventorySchema.methods.removeItem = async function(
  instanceId: string, 
  quantity?: number
): Promise<boolean> {
  const categories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories', 
                     'potions', 'scrolls', 'enhancementItems', 'enhancementMaterials', 
                     'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials', 'artifacts'];
  
  for (const category of categories) {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    if (Array.isArray(items)) {
      const itemIndex = items.findIndex(item => item.instanceId === instanceId);
      if (itemIndex !== -1) {
        if (!quantity || quantity >= items[itemIndex].quantity) {
          items.splice(itemIndex, 1);
        } else {
          items[itemIndex].quantity -= quantity;
        }
        await this.save();
        return true;
      }
    }
  }
  return false;
};

// Vérifier si possède un objet
inventorySchema.methods.hasItem = function(itemId: string, quantity: number = 1): boolean {
  const categories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories', 
                     'potions', 'scrolls', 'enhancementItems', 'enhancementMaterials', 
                     'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials', 'artifacts'];
  
  let totalQuantity = 0;
  for (const category of categories) {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    if (Array.isArray(items)) {
      items.forEach(item => {
        if (item.itemId === itemId) {
          totalQuantity += item.quantity;
        }
      });
    }
  }
  return totalQuantity >= quantity;
};

// Obtenir un objet spécifique
inventorySchema.methods.getItem = function(instanceId: string): IOwnedItem | null {
  const categories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories', 
                     'potions', 'scrolls', 'enhancementItems', 'enhancementMaterials', 
                     'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials', 'artifacts'];
  
  for (const category of categories) {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    if (Array.isArray(items)) {
      const item = items.find(item => item.instanceId === instanceId);
      if (item) return item;
    }
  }
  return null;
};

// Obtenir objets par catégorie
inventorySchema.methods.getItemsByCategory = function(category: string, subCategory?: string): IOwnedItem[] {
  const allItems: IOwnedItem[] = [];
  const categories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories', 
                     'potions', 'scrolls', 'enhancementItems', 'enhancementMaterials', 
                     'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials', 'artifacts'];
  
  for (const cat of categories) {
    const items = this.storage[cat as keyof ICategorizedStorage] as IOwnedItem[];
    if (Array.isArray(items)) {
      allItems.push(...items);
    }
  }
  
  // TODO: Améliorer le filtrage par catégorie avec requête Item
  return allItems;
};

// Obtenir les statistiques
inventorySchema.methods.getInventoryStats = function(): IInventoryStats {
  const stats: IInventoryStats = {
    totalItems: 0,
    totalWeight: 0,
    maxCapacity: this.maxCapacity,
    equipmentCount: 0,
    consumableCount: 0,
    materialCount: 0,
    artifactCount: 0,
    commonCount: 0,
    rareCount: 0,
    epicCount: 0,
    legendaryCount: 0,
    mythicCount: 0,
    ascendedCount: 0,
    equippedItemsCount: 0,
    maxLevelEquipment: 0,
    setsCompleted: []
  };
  
  const categories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories', 
                     'potions', 'scrolls', 'enhancementItems', 'enhancementMaterials', 
                     'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials', 'artifacts'];
  
  for (const category of categories) {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    if (Array.isArray(items) && items.length > 0) {
      stats.totalItems += items.length;
      
      if (['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'].includes(category)) {
        stats.equipmentCount += items.length;
      } else if (['potions', 'scrolls', 'enhancementItems'].includes(category)) {
        stats.consumableCount += items.length;
      } else if (['enhancementMaterials', 'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials'].includes(category)) {
        stats.materialCount += items.length;
      } else if (category === 'artifacts') {
        stats.artifactCount += items.length;
      }
      
      items.forEach((item: IOwnedItem) => {
        if (item.isEquipped) stats.equippedItemsCount++;
        if (item.level > stats.maxLevelEquipment) {
          stats.maxLevelEquipment = item.level;
        }
      });
    }
  }
  
  return stats;
};

// Obtenir objets équipés
inventorySchema.methods.getEquippedItems = function(heroId?: string): IOwnedItem[] {
  const equippedItems: IOwnedItem[] = [];
  const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
  
  for (const category of equipmentCategories) {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    if (Array.isArray(items)) {
      items.forEach(item => {
        if (item.isEquipped && (!heroId || item.equippedTo === heroId)) {
          equippedItems.push(item);
        }
      });
    }
  }
  
  return equippedItems;
};

// Déséquiper un objet
inventorySchema.methods.unequipItem = async function(instanceId: string): Promise<boolean> {
  const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
  
  for (const category of equipmentCategories) {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    if (Array.isArray(items)) {
      const item = items.find(item => item.instanceId === instanceId);
      if (item && item.isEquipped) {
        item.isEquipped = false;
        item.equippedTo = undefined;
        await this.save();
        return true;
      }
    }
  }
  
  return false;
};

// Équiper un objet
inventorySchema.methods.equipItem = async function(
  instanceId: string, 
  heroId: string
): Promise<boolean> {
  // Chercher l'objet dans toutes les catégories d'équipement
  const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
  
  for (const category of equipmentCategories) {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    const item = items.find(item => item.instanceId === instanceId);
    
    if (item) {
      // Déséquiper l'ancien objet du même slot sur ce héros
      const oldItem = items.find(i => 
        i.equippedTo === heroId && i.instanceId !== instanceId
      );
      if (oldItem) {
        oldItem.isEquipped = false;
        oldItem.equippedTo = undefined;
      }
      
      // Équiper le nouvel objet
      item.isEquipped = true;
      item.equippedTo = heroId;
      
      await this.save();
      return true;
    }
  }
  
  return false;
};

// Nettoyer les objets expirés
inventorySchema.methods.cleanupExpiredItems = async function(): Promise<number> {
  let removedCount = 0;
  const now = new Date();
  
  // Nettoyer les consommables expirés
  ['potions', 'scrolls', 'enhancementItems'].forEach(category => {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (item.consumableData?.expirationDate && 
          item.consumableData.expirationDate < now) {
        items.splice(i, 1);
        removedCount++;
      }
    }
  });
  
  this.lastCleanup = now;
  await this.save();
  return removedCount;
};

// Calculer la valeur totale
inventorySchema.methods.calculateTotalValue = function(): number {
  let totalValue = 0;
  
  // Ajouter les monnaies
  totalValue += this.gold;
  totalValue += this.gems * 10; // Les gems valent plus
  totalValue += this.paidGems * 20;
  
  // Pour calculer la valeur des objets, il faudrait faire des requêtes vers Item
  // Pour l'instant on retourne juste les monnaies
  
  return totalValue;
};

// ✅ NOUVELLES MÉTHODES UTILITAIRES

// Optimiser le stockage (défragmentation)
inventorySchema.methods.optimizeStorage = async function(): Promise<void> {
  console.log(`🔧 Optimisation stockage pour ${this.playerId}`);
  
  const categories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories', 
                     'potions', 'scrolls', 'enhancementItems', 'enhancementMaterials', 
                     'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials', 'artifacts'];
  
  let optimized = false;
  
  for (const category of categories) {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    if (Array.isArray(items)) {
      // Supprimer les objets avec quantité <= 0
      const validItems = items.filter(item => item.quantity > 0);
      if (validItems.length !== items.length) {
        (this.storage[category as keyof ICategorizedStorage] as IOwnedItem[]) = validItems;
        optimized = true;
      }
      
      // Grouper les objets identiques (même itemId, niveau, amélioration)
      const groupedItems = new Map<string, IOwnedItem>();
      
      for (const item of validItems) {
        const key = `${item.itemId}-${item.level}-${item.enhancement}-${item.isEquipped}`;
        const existing = groupedItems.get(key);
        
        if (existing && !item.isEquipped) {
          // Fusionner les quantités pour les objets non équipés identiques
          existing.quantity += item.quantity;
          optimized = true;
        } else {
          groupedItems.set(key, { ...item });
        }
      }
      
      if (optimized) {
        (this.storage[category as keyof ICategorizedStorage] as IOwnedItem[]) = Array.from(groupedItems.values());
      }
    }
  }
  
  if (optimized) {
    await this.save();
    console.log(`✅ Stockage optimisé pour ${this.playerId}`);
  }
};

// Trier les objets par rareté
inventorySchema.methods.sortItemsByRarity = function(items: IOwnedItem[]): IOwnedItem[] {
  const rarityOrder = ["Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended"];
  
  return items.sort((a, b) => {
    // Nécessiterait une requête vers Item pour obtenir la rareté
    // Pour l'instant, tri par niveau puis amélioration
    if (a.level !== b.level) return b.level - a.level;
    return b.enhancement - a.enhancement;
  });
};

// Trier les objets par niveau
inventorySchema.methods.sortItemsByLevel = function(items: IOwnedItem[]): IOwnedItem[] {
  return items.sort((a, b) => {
    if (a.level !== b.level) return b.level - a.level;
    if (a.enhancement !== b.enhancement) return b.enhancement - a.enhancement;
    return a.acquiredDate.getTime() - b.acquiredDate.getTime();
  });
};

// Filtrer les objets par rareté
inventorySchema.methods.filterItemsByRarity = function(items: IOwnedItem[], rarity: string): IOwnedItem[] {
  // Nécessiterait une requête vers Item pour filtrer par rareté
  // Pour l'instant, retourne tous les objets
  return items;
};

// Obtenir les consommables expirés
inventorySchema.methods.getExpiredConsumables = function(): IOwnedItem[] {
  const expiredItems: IOwnedItem[] = [];
  const now = new Date();
  
  ['potions', 'scrolls', 'enhancementItems'].forEach(category => {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    items.forEach(item => {
      if (item.consumableData?.expirationDate && 
          item.consumableData.expirationDate < now) {
        expiredItems.push(item);
      }
    });
  });
  
  return expiredItems;
};

// Utiliser un consommable
inventorySchema.methods.useConsumable = async function(instanceId: string, heroId?: string): Promise<any> {
  const consumableCategories = ['potions', 'scrolls', 'enhancementItems'];
  
  for (const category of consumableCategories) {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    const itemIndex = items.findIndex(item => item.instanceId === instanceId);
    
    if (itemIndex !== -1) {
      const item = items[itemIndex];
      
      // Vérifier si le consommable peut être utilisé
      if (item.consumableData?.expirationDate && 
          item.consumableData.expirationDate < new Date()) {
        throw new Error("Consommable expiré");
      }
      
      if (item.consumableData?.usageCount && item.consumableData.usageCount <= 0) {
        throw new Error("Consommable épuisé");
      }
      
      // Utiliser le consommable
      item.lastUsedDate = new Date();
      
      if (item.consumableData?.usageCount) {
        item.consumableData.usageCount--;
        
        // Supprimer si épuisé
        if (item.consumableData.usageCount <= 0) {
          items.splice(itemIndex, 1);
        }
      } else {
        // Consommable à usage unique
        if (item.quantity > 1) {
          item.quantity--;
        } else {
          items.splice(itemIndex, 1);
        }
      }
      
      await this.save();
      
      return {
        success: true,
        itemId: item.itemId,
        heroId,
        effect: "Consommable utilisé" // TODO: Implémenter les effets réels
      };
    }
  }
  
  throw new Error("Consommable non trouvé");
};

// Obtenir les matériaux par type
inventorySchema.methods.getMaterialsByType = function(materialType: string, grade?: string): IOwnedItem[] {
  const materialCategories = ['enhancementMaterials', 'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials'];
  const materials: IOwnedItem[] = [];
  
  for (const category of materialCategories) {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    materials.push(...items);
  }
  
  // TODO: Filtrer par type et grade avec requête vers Item
  return materials;
};

// Vérifier si peut fabriquer un objet
inventorySchema.methods.canCraftItem = async function(itemId: string): Promise<boolean> {
  // TODO: Implémenter la logique de craft avec recettes
  return false;
};

// Obtenir les pièces d'un set équipées
inventorySchema.methods.getEquippedSetPieces = function(heroId: string, setId: string): number {
  const equippedItems = this.getEquippedItems(heroId);
  
  // TODO: Implémenter la logique des sets avec requête vers Item
  return 0;
};

// Obtenir les pièces d'un set disponibles
inventorySchema.methods.getAvailableSetPieces = function(setId: string): IOwnedItem[] {
  // TODO: Implémenter la logique des sets avec requête vers Item
  return [];
};

// Améliorer un équipement
inventorySchema.methods.upgradeEquipment = async function(
  instanceId: string, 
  targetLevel?: number, 
  targetEnhancement?: number
): Promise<boolean> {
  const item = this.getItem(instanceId);
  
  if (!item) {
    return false;
  }
  
  // TODO: Implémenter la logique d'amélioration avec coûts et matériaux
  
  if (targetLevel && targetLevel > item.level) {
    item.level = Math.min(targetLevel, 100);
  }
  
  if (targetEnhancement && targetEnhancement > item.enhancement) {
    item.enhancement = Math.min(targetEnhancement, 15);
    
    // Ajouter à l'historique
    if (!item.equipmentData) {
      item.equipmentData = {
        durability: 100,
        socketedGems: [],
        upgradeHistory: []
      };
    }
    
    item.equipmentData.upgradeHistory.push(new Date());
  }
  
  await this.save();
  return true;
};

export default mongoose.model<IInventoryDocument>("Inventory", inventorySchema);


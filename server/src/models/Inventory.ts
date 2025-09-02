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
  playerId: string;
  
  // Monnaies de base (depuis Player)
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
  
  // Dernière mise à jour
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
    unique: true,
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
    unique: true
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
  
  // Maintenance
  lastCleanup: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true,
  collection: 'inventories'
});

// === INDEX ===
inventorySchema.index({ playerId: 1 });
inventorySchema.index({ "storage.weapons.itemId": 1 });
inventorySchema.index({ "storage.weapons.isEquipped": 1 });
inventorySchema.index({ "storage.*.instanceId": 1 });

// === MÉTHODES STATIQUES ===

inventorySchema.statics.createForPlayer = async function(playerId: string) {
  const inventory = new this({
    playerId,
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

// === MÉTHODES D'INSTANCE ===

// Ajouter un objet
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
    // Pour les coffres, on les met dans les artefacts ou une catégorie spéciale
    storageCategory = "artifacts";
  } else if (item.category === "Fragment") {
    // Les fragments vont dans les maps spéciales, pas dans les tableaux
    const fragmentsMap = this.storage.heroFragments || new Map();
    const currentQuantity = fragmentsMap.get(itemId) || 0;
    fragmentsMap.set(itemId, currentQuantity + quantity);
    this.storage.heroFragments = fragmentsMap;
    await this.save();
    return newOwnedItem; // Retour anticipé
  } else if (item.category === "Currency") {
    // Les monnaies spéciales vont dans les maps
    const currenciesMap = this.storage.specialCurrencies || new Map();
    const currentQuantity = currenciesMap.get(itemId) || 0;
    currenciesMap.set(itemId, currentQuantity + quantity);
    this.storage.specialCurrencies = currenciesMap;
    await this.save();
    return newOwnedItem; // Retour anticipé
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

// Supprimer un objet
inventorySchema.methods.removeItem = async function(
  instanceId: string, 
  quantity?: number
): Promise<boolean> {
  // Chercher l'objet dans toutes les catégories
  const categories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories', 
                     'potions', 'scrolls', 'enhancementItems', 'enhancementMaterials', 
                     'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials', 'artifacts'];
  
  for (const category of categories) {
    const items = this.storage[category as keyof ICategorizedStorage] as IOwnedItem[];
    if (Array.isArray(items)) {
      const itemIndex = items.findIndex(item => item.instanceId === instanceId);
      if (itemIndex !== -1) {
        if (!quantity || quantity >= items[itemIndex].quantity) {
          // Supprimer complètement
          items.splice(itemIndex, 1);
        } else {
          // Réduire la quantité
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
  
  // Filtrer par catégorie (nécessiterait une requête Item pour vérifier la catégorie exacte)
  // Pour l'instant, retourne tous les objets
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
  
  // Compter tous les objets dans toutes les catégories
  Object.values(this.storage).forEach(category => {
    if (Array.isArray(category)) {
      stats.totalItems += category.length;
      
      category.forEach((item: IOwnedItem) => {
        if (item.isEquipped) stats.equippedItemsCount++;
        if (item.level > stats.maxLevelEquipment) {
          stats.maxLevelEquipment = item.level;
        }
      });
    }
  });
  
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

export default mongoose.model<IInventoryDocument>("Inventory", inventorySchema);

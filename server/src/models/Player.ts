import mongoose, { Document, Schema } from "mongoose";

// === INTERFACES UNIFIÉES ===

// Stats d'objets (conservées de votre Item.ts)
interface IItemStats {
  // Stats de base
  hp: number;
  atk: number;
  def: number;

  // Stats avancées
  crit: number;        // Chance de critique (%)
  critDamage: number;  // Dégâts critiques (%)
  critResist: number;  // Résistance aux critiques (%)
  dodge: number;       // Esquive (%)
  accuracy: number;    // Précision (%)

  // Stats spécialisées
  vitesse: number;
  moral: number;
  reductionCooldown: number; // Réduction de CD (%)
  healthleech: number;       // Vol de vie (%)

  // Bonus spéciaux
  healingBonus: number;    // Bonus aux soins (%)
  shieldBonus: number;     // Bonus aux boucliers (%)
  energyRegen: number;     // Régénération d'énergie (valeur plate)
}

// Objet possédé (fusionné depuis Inventory.ts)
interface IOwnedItem {
  itemId: string;        // Référence vers l'Item de base
  instanceId: string;    // ID unique de cette instance
  quantity: number;      // Quantité possédée
  level: number;         // Niveau de l'objet (pour équipement)
  enhancement: number;   // Niveau d'amélioration (+0 à +15)
  
  // ✅ AJOUT : Progression AFK Arena style
  tier: number;          // T0, T1, T2, T3 (Tier upgrade)
  stars: number;         // 0-5 étoiles (Ascension)
  
  // État équipement
  isEquipped: boolean;   // Si équipé sur un héros
  equippedTo?: string;   // ID du héros qui l'équipe
  isLocked: boolean;     // Verrouillé contre suppression accidentelle
  isFavorite: boolean;   // Marqué comme favori
  
  // Données spécifiques selon le type
  equipmentData?: {
    durability: number;        // Durabilité (0-100)
    socketedGems?: string[];   // Gemmes incrustées
    upgradeHistory: Date[];    // Historique des améliorations
    setId?: string;            // ID du set d'équipement
  };
  
  consumableData?: {
    expirationDate?: Date;     // Date d'expiration (pour certains consommables)
    usageCount?: number;       // Nombre d'utilisations restantes
  };
  
  // Métadonnées
  acquiredDate: Date;
  lastUsedDate?: Date;
  lastUpgradeDate?: Date;
}

// Inventaire unifié (fusionné dans Player)
interface IPlayerInventory {
  // ✅ MONNAIES UNIFIÉES (source unique de vérité)
  currencies: {
    gold: number;
    gems: number;
    paidGems: number;
    tickets: number;
    arenaTokens?: number;      // Jetons d'arène
    labTokens?: number;        // Jetons de labyrinthe
    guildCoins?: number;       // Pièces de guilde
  };
  
  // ✅ OBJETS UNIFIÉS (liste unique au lieu de catégories séparées)
  items: IOwnedItem[];
  
  // ✅ FRAGMENTS (fusionnés depuis Player)
  heroFragments: Map<string, number>;    // heroId -> quantité
  itemFragments: Map<string, number>;    // itemId -> quantité (pour craft)
  
  // ✅ MATÉRIAUX (fusionnés depuis Player)
  materials: {
    enhancementStones: Map<string, number>;    // Pierre +1 à +30 par rareté
    tierMaterials: Map<string, number>;        // Matériaux T1→T2→T3
    fusionScrolls: Map<string, number>;        // Parchemins de fusion
    elderTreeSap: Map<string, number>;         // Sève arbre des anciens
    factionalEssence: Map<string, number>;     // Essences factionnelles
  };
  
  // Configuration inventaire
  maxCapacity: number;
  autoSell: {
    enabled: boolean;
    maxRarity: "Common" | "Rare";
  };
  
  // Métadonnées
  lastCleanup: Date;
  lastOptimization: Date;
}

// Équipement d'un héros (simplifié)
interface IHeroEquipment {
  weapon?: string;      // instanceId de l'arme équipée
  helmet?: string;      // instanceId du casque
  armor?: string;       // instanceId de l'armure
  boots?: string;       // instanceId des bottes
  accessory?: string;   // instanceId de l'accessoire
}

// Héros du joueur (enrichi)
interface IPlayerHero {
  heroId: string;            // Référence vers Hero de base
  level: number;             // Niveau du héros
  experience: number;        // XP accumulée
  ascension: number;         // Niveau d'ascension (0-5)
  stars: number;             // Étoiles d'ascension (0-5)
  equipment: IHeroEquipment; // Équipement
  isActive: boolean;         // Dans l'équipe active
  position?: number;         // Position dans l'équipe (1-5)
  
  // Progression
  skillLevels: {
    skill1: number;
    skill2: number;
    skill3: number;
    ultimate: number;
  };
  
  // Métadonnées
  acquiredDate: Date;
  lastUsedDate?: Date;
}

// Document Player unifié
interface IPlayerDocument extends Document {
  // ✅ IDENTIFICATION
  accountId: string;         // Référence vers Account
  serverId: string;          // Serveur du joueur
  playerName: string;        // Nom du joueur
  
  // ✅ PROGRESSION PRINCIPALE
  level: number;
  experience: number;
  vipLevel: number;
  vipExperience: number;
  
  // ✅ PROGRESSION CAMPAGNE
  campaignProgress: {
    currentWorld: number;
    currentLevel: number;
    maxWorld: number;
    maxLevel: number;
    difficulty: "Normal" | "Hard" | "Nightmare";
  };
  
  // ✅ COLLECTION HÉROS
  heroes: IPlayerHero[];
  
  // ✅ INVENTAIRE UNIFIÉ (remplace le modèle Inventory séparé)
  inventory: IPlayerInventory;
  
  // ✅ RÉCOMPENSES AFK
  afkRewards: {
    lastClaimTime: Date;
    accumulatedTime: number;     // Temps AFK en secondes
    maxStorageHours: number;     // Capacité stockage (VIP bonus)
  };
  
  // ✅ ACTIVITÉS ET PROGRESSION
  activities: {
    dailyQuests: {
      completed: string[];           // IDs des quêtes complétées aujourd'hui
      lastResetDate: Date;           // Dernière remise à zéro
    };
    events: {
      participatedEvents: string[];  // IDs des événements auxquels il participe
      eventProgress: Map<string, number>; // eventId -> progression
    };
    arena: {
      rank: number;
      seasonalRank: number;
      battlesWon: number;
      battlesLost: number;
      lastBattleDate?: Date;
    };
    guild?: {
      guildId: string;
      role: "Member" | "Officer" | "Leader";
      joinDate: Date;
      contributionPoints: number;
    };
  };
  
  // ✅ STATISTIQUES GÉNÉRALES
  statistics: {
    totalPlayTime: number;           // En secondes
    heroesUnlocked: number;
    itemsCollected: number;
    battlesWon: number;
    questsCompleted: number;
    gemsSpent: number;
    goldEarned: number;
  };
  
  // Métadonnées serveur
  createdAt: Date;
  lastLoginAt: Date;
  lastSaveAt: Date;
  
  // === MÉTHODES D'INVENTAIRE (remplace InventoryService) ===
  
  // Gestion des objets
  addItem(itemId: string, quantity?: number, level?: number): Promise<IOwnedItem>;
  removeItem(instanceId: string, quantity?: number): Promise<boolean>;
  hasItem(itemId: string, quantity?: number): boolean;
  getItem(instanceId: string): IOwnedItem | null;
  getItemsByCategory(category: string): IOwnedItem[];
  
  // Équipement héros
  equipItem(heroId: string, instanceId: string): Promise<boolean>;
  unequipItem(heroId: string, slot: string): Promise<boolean>;
  getEquippedItems(heroId?: string): IOwnedItem[];
  
  // Progression objets
  enhanceItem(instanceId: string, targetLevel: number): Promise<boolean>;
  upgradeItemTier(instanceId: string): Promise<boolean>;
  addStarsToItem(instanceId: string, stars: number): Promise<boolean>;
  
  // Fusion et craft
  fuseItems(instanceIds: string[]): Promise<IOwnedItem>;
  craftItem(recipeId: string): Promise<IOwnedItem>;
  
  // Sets d'équipement
  getEquippedSetPieces(heroId: string, setId: string): number;
  getSetBonuses(heroId: string): any[];
  
  // Utilitaires
  getInventoryStats(): any;
  cleanupExpiredItems(): Promise<number>;
  optimizeInventory(): Promise<void>;
  calculateInventoryValue(): number;
  
  // === MÉTHODES HÉROS ===
  
  addHero(heroId: string): Promise<IPlayerHero>;
  getHero(heroId: string): IPlayerHero | null;
  levelUpHero(heroId: string, levels: number): Promise<boolean>;
  ascendHero(heroId: string): Promise<boolean>;
  
  // === MÉTHODES ÉCONOMIQUES ===
  
  addCurrency(type: keyof IPlayerInventory['currencies'], amount: number): Promise<boolean>;
  spendCurrency(type: keyof IPlayerInventory['currencies'], amount: number): Promise<boolean>;
  hasCurrency(type: keyof IPlayerInventory['currencies'], amount: number): boolean;
  
  // === MÉTHODES PROGRESSION ===
  
  advanceCampaign(world: number, level: number): Promise<boolean>;
  addExperience(amount: number): Promise<boolean>;
  addVipExperience(amount: number): Promise<boolean>;
}

// === SCHÉMAS MONGOOSE ===

// Schéma des stats d'objets
const itemStatsSchema = new Schema<IItemStats>({
  hp: { type: Number, default: 0, min: 0 },
  atk: { type: Number, default: 0, min: 0 },
  def: { type: Number, default: 0, min: 0 },
  crit: { type: Number, default: 0, min: 0, max: 100 },
  critDamage: { type: Number, default: 0, min: 0 },
  critResist: { type: Number, default: 0, min: 0, max: 100 },
  dodge: { type: Number, default: 0, min: 0, max: 100 },
  accuracy: { type: Number, default: 0, min: 0, max: 100 },
  vitesse: { type: Number, default: 0, min: 0 },
  moral: { type: Number, default: 0, min: 0 },
  reductionCooldown: { type: Number, default: 0, min: 0, max: 50 },
  healthleech: { type: Number, default: 0, min: 0, max: 100 },
  healingBonus: { type: Number, default: 0, min: 0 },
  shieldBonus: { type: Number, default: 0, min: 0 },
  energyRegen: { type: Number, default: 0, min: 0 }
}, { _id: false });

// Schéma des objets possédés
const ownedItemSchema = new Schema<IOwnedItem>({
  itemId: { 
    type: String, 
    required: true,
    ref: 'Item'
  },
  instanceId: { 
    type: String, 
    required: true,
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
    max: 30,  // ✅ Aligné sur AFK Arena (+0 à +30)
    default: 0
  },
  
  // ✅ NOUVELLES PROPRIÉTÉS AFK ARENA
  tier: { 
    type: Number, 
    min: 0, 
    max: 3, 
    default: 0  // T0, T1, T2, T3
  },
  stars: { 
    type: Number, 
    min: 0, 
    max: 5, 
    default: 0  // 0-5 étoiles
  },
  
  // État
  isEquipped: { 
    type: Boolean, 
    default: false 
  },
  equippedTo: { 
    type: String,
    default: null
  },
  isLocked: { 
    type: Boolean, 
    default: false  // ✅ Verrouillage AFK Arena
  },
  isFavorite: { 
    type: Boolean, 
    default: false  // ✅ Favoris AFK Arena
  },
  
  // Données spécifiques
  equipmentData: {
    durability: { 
      type: Number, 
      min: 0, 
      max: 100, 
      default: 100 
    },
    socketedGems: [{ type: String }],
    upgradeHistory: [{ type: Date }],
    setId: { type: String }  // ✅ ID du set d'équipement
  },
  
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
  lastUsedDate: { type: Date },
  lastUpgradeDate: { type: Date }
}, { _id: false });

// Schéma de l'équipement d'un héros
const heroEquipmentSchema = new Schema<IHeroEquipment>({
  weapon: { type: String, default: null },
  helmet: { type: String, default: null },
  armor: { type: String, default: null },
  boots: { type: String, default: null },
  accessory: { type: String, default: null }
}, { _id: false });

// Schéma d'un héros du joueur
const playerHeroSchema = new Schema<IPlayerHero>({
  heroId: { 
    type: String, 
    required: true,
    ref: 'Hero'
  },
  level: { 
    type: Number, 
    min: 1, 
    max: 240,  // ✅ AFK Arena max level
    default: 1 
  },
  experience: { 
    type: Number, 
    min: 0, 
    default: 0 
  },
  ascension: { 
    type: Number, 
    min: 0, 
    max: 5,    // ✅ AFK Arena ascension levels
    default: 0 
  },
  stars: { 
    type: Number, 
    min: 0, 
    max: 5,    // ✅ 0-5 étoiles
    default: 0 
  },
  equipment: { 
    type: heroEquipmentSchema, 
    default: () => ({}) 
  },
  isActive: { 
    type: Boolean, 
    default: false 
  },
  position: { 
    type: Number, 
    min: 1, 
    max: 5,    // ✅ 5 positions comme AFK Arena
    default: null 
  },
  
  // Progression des compétences
  skillLevels: {
    skill1: { type: Number, min: 1, max: 10, default: 1 },
    skill2: { type: Number, min: 1, max: 10, default: 1 },
    skill3: { type: Number, min: 1, max: 10, default: 1 },
    ultimate: { type: Number, min: 1, max: 5, default: 1 }
  },
  
  // Métadonnées
  acquiredDate: { 
    type: Date, 
    default: Date.now 
  },
  lastUsedDate: { type: Date }
}, { _id: false });

// Schéma de l'inventaire unifié
const playerInventorySchema = new Schema<IPlayerInventory>({
  // ✅ MONNAIES UNIFIÉES
  currencies: {
    gold: { type: Number, default: 0, min: 0 },
    gems: { type: Number, default: 0, min: 0 },
    paidGems: { type: Number, default: 0, min: 0 },
    tickets: { type: Number, default: 0, min: 0 },
    arenaTokens: { type: Number, default: 0, min: 0 },
    labTokens: { type: Number, default: 0, min: 0 },
    guildCoins: { type: Number, default: 0, min: 0 }
  },
  
  // ✅ OBJETS UNIFIÉS
  items: [ownedItemSchema],
  
  // ✅ FRAGMENTS
  heroFragments: { 
    type: Map, 
    of: Number, 
    default: new Map()
  },
  itemFragments: { 
    type: Map, 
    of: Number, 
    default: new Map()
  },
  
  // ✅ MATÉRIAUX
  materials: {
    enhancementStones: { 
      type: Map, 
      of: Number, 
      default: new Map()
    },
    tierMaterials: { 
      type: Map, 
      of: Number, 
      default: new Map()
    },
    fusionScrolls: { 
      type: Map, 
      of: Number, 
      default: new Map()
    },
    elderTreeSap: { 
      type: Map, 
      of: Number, 
      default: new Map()
    },
    factionalEssence: { 
      type: Map, 
      of: Number, 
      default: new Map()
    }
  },
  
  // Configuration
  maxCapacity: { 
    type: Number, 
    default: 200,
    min: 100
  },
  autoSell: {
    enabled: { 
      type: Boolean, 
      default: false 
    },
    maxRarity: { 
      type: String, 
      enum: ["Common", "Rare"],
      default: "Common"
    }
  },
  
  // Métadonnées
  lastCleanup: { 
    type: Date, 
    default: Date.now 
  },
  lastOptimization: { 
    type: Date, 
    default: Date.now 
  }
}, { _id: false });

// Schéma principal du Player
const playerSchema = new Schema<IPlayerDocument>({
  // ✅ IDENTIFICATION
  accountId: { 
    type: String, 
    required: true,
    ref: 'Account'
  },
  serverId: { 
    type: String, 
    required: true,
    match: /^S\d+$/
  },
  playerName: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 20
  },
  
  // ✅ PROGRESSION PRINCIPALE
  level: { 
    type: Number, 
    min: 1, 
    max: 500,  // ✅ AFK Arena style
    default: 1 
  },
  experience: { 
    type: Number, 
    min: 0, 
    default: 0 
  },
  vipLevel: { 
    type: Number, 
    min: 0, 
    max: 15,   // ✅ AFK Arena VIP levels
    default: 0 
  },
  vipExperience: { 
    type: Number, 
    min: 0, 
    default: 0 
  },
  
  // ✅ PROGRESSION CAMPAGNE
  campaignProgress: {
    currentWorld: { type: Number, min: 1, max: 20, default: 1 },
    currentLevel: { type: Number, min: 1, max: 30, default: 1 },
    maxWorld: { type: Number, min: 1, max: 20, default: 1 },
    maxLevel: { type: Number, min: 1, max: 30, default: 1 },
    difficulty: { 
      type: String, 
      enum: ["Normal", "Hard", "Nightmare"],
      default: "Normal"
    }
  },
  
  // ✅ COLLECTION HÉROS
  heroes: [playerHeroSchema],
  
  // ✅ INVENTAIRE UNIFIÉ (remplace le modèle Inventory)
  inventory: {
    type: playerInventorySchema,
    default: () => ({
      currencies: {
        gold: 0,
        gems: 0,
        paidGems: 0,
        tickets: 0,
        arenaTokens: 0,
        labTokens: 0,
        guildCoins: 0
      },
      items: [],
      heroFragments: new Map(),
      itemFragments: new Map(),
      materials: {
        enhancementStones: new Map(),
        tierMaterials: new Map(),
        fusionScrolls: new Map(),
        elderTreeSap: new Map(),
        factionalEssence: new Map()
      },
      maxCapacity: 200,
      autoSell: {
        enabled: false,
        maxRarity: "Common"
      },
      lastCleanup: new Date(),
      lastOptimization: new Date()
    })
  },
  
  // ✅ RÉCOMPENSES AFK
  afkRewards: {
    lastClaimTime: { 
      type: Date, 
      default: Date.now 
    },
    accumulatedTime: { 
      type: Number, 
      min: 0, 
      default: 0 
    },
    maxStorageHours: { 
      type: Number, 
      min: 12, 
      max: 24,   // ✅ VIP bonus dans AFK Arena
      default: 12 
    }
  },
  
  // ✅ ACTIVITÉS
  activities: {
    dailyQuests: {
      completed: [{ type: String }],
      lastResetDate: { type: Date, default: Date.now }
    },
    events: {
      participatedEvents: [{ type: String }],
      eventProgress: { 
        type: Map, 
        of: Number, 
        default: new Map()
      }
    },
    arena: {
      rank: { type: Number, default: 999999 },
      seasonalRank: { type: Number, default: 999999 },
      battlesWon: { type: Number, default: 0 },
      battlesLost: { type: Number, default: 0 },
      lastBattleDate: { type: Date }
    },
    guild: {
      guildId: { type: String },
      role: { 
        type: String, 
        enum: ["Member", "Officer", "Leader"]
      },
      joinDate: { type: Date },
      contributionPoints: { type: Number, default: 0 }
    }
  },
  
  // ✅ STATISTIQUES
  statistics: {
    totalPlayTime: { type: Number, default: 0 },
    heroesUnlocked: { type: Number, default: 0 },
    itemsCollected: { type: Number, default: 0 },
    battlesWon: { type: Number, default: 0 },
    questsCompleted: { type: Number, default: 0 },
    gemsSpent: { type: Number, default: 0 },
    goldEarned: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  collection: 'players'
});

// === INDEX OPTIMISÉS ===
playerSchema.index({ accountId: 1, serverId: 1 }, { unique: true });
playerSchema.index({ serverId: 1 });
playerSchema.index({ playerName: 1, serverId: 1 });
playerSchema.index({ level: -1 });
playerSchema.index({ vipLevel: -1 });
playerSchema.index({ "campaignProgress.maxWorld": -1, "campaignProgress.maxLevel": -1 });
playerSchema.index({ "activities.arena.rank": 1 });
playerSchema.index({ "activities.guild.guildId": 1 });

// Index pour les objets (recherche rapide)
playerSchema.index({ "inventory.items.instanceId": 1 });
playerSchema.index({ "inventory.items.isEquipped": 1 });
playerSchema.index({ "inventory.items.itemId": 1 });

// === MIDDLEWARE ===

// Validation avant sauvegarde
playerSchema.pre('save', function(next) {
  // S'assurer que les Maps sont bien initialisées
  if (!this.inventory.heroFragments) {
    this.inventory.heroFragments = new Map();
  }
  if (!this.inventory.itemFragments) {
    this.inventory.itemFragments = new Map();
  }
  
  // Nettoyer les Maps vides
  if (this.inventory.heroFragments.size === 0) {
    this.inventory.heroFragments = new Map();
  }
  
  // Mettre à jour les statistiques
  this.statistics.heroesUnlocked = this.heroes.length;
  this.statistics.itemsCollected = this.inventory.items.length;
  
  // S'assurer que les monnaies ne sont jamais négatives
  const currencies = this.inventory.currencies;
  currencies.gold = Math.max(0, currencies.gold);
  currencies.gems = Math.max(0, currencies.gems);
  currencies.paidGems = Math.max(0, currencies.paidGems);
  currencies.tickets = Math.max(0, currencies.tickets);
  
  next();
});

// === MÉTHODES STATIQUES ===

// Créer un nouveau joueur
playerSchema.statics.createNewPlayer = async function(accountId: string, serverId: string, playerName: string) {
  const player = new this({
    accountId,
    serverId,
    playerName,
    level: 1,
    experience: 0,
    vipLevel: 0,
    vipExperience: 0,
    campaignProgress: {
      currentWorld: 1,
      currentLevel: 1,
      maxWorld: 1,
      maxLevel: 1,
      difficulty: "Normal"
    },
    heroes: [],
    inventory: {
      currencies: {
        gold: 1000,      // ✅ Or de départ
        gems: 100,       // ✅ Gemmes de départ
        paidGems: 0,
        tickets: 5,      // ✅ Tickets de départ
        arenaTokens: 0,
        labTokens: 0,
        guildCoins: 0
      },
      items: [],
      heroFragments: new Map(),
      itemFragments: new Map(),
      materials: {
        enhancementStones: new Map(),
        tierMaterials: new Map(),
        fusionScrolls: new Map(),
        elderTreeSap: new Map(),
        factionalEssence: new Map()
      },
      maxCapacity: 200,
      autoSell: {
        enabled: false,
        maxRarity: "Common"
      },
      lastCleanup: new Date(),
      lastOptimization: new Date()
    },
    afkRewards: {
      lastClaimTime: new Date(),
      accumulatedTime: 0,
      maxStorageHours: 12
    },
    activities: {
      dailyQuests: {
        completed: [],
        lastResetDate: new Date()
      },
      events: {
        participatedEvents: [],
        eventProgress: new Map()
      },
      arena: {
        rank: 999999,
        seasonalRank: 999999,
        battlesWon: 0,
        battlesLost: 0
      },
      guild: {}
    },
    statistics: {
      totalPlayTime: 0,
      heroesUnlocked: 0,
      itemsCollected: 0,
      battlesWon: 0,
      questsCompleted: 0,
      gemsSpent: 0,
      goldEarned: 0
    }
  });
  
  return await player.save();
};

// Trouver par compte et serveur
playerSchema.statics.findByAccountAndServer = function(accountId: string, serverId: string) {
  return this.findOne({ accountId, serverId });
};

// === MÉTHODES D'INSTANCE (Inventaire) ===

// Ajouter un objet
playerSchema.methods.addItem = async function(
  itemId: string, 
  quantity: number = 1, 
  level: number = 1
): Promise<IOwnedItem> {
  // Vérifier que l'objet existe
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
    tier: 0,
    stars: 0,
    isEquipped: false,
    isLocked: false,
    isFavorite: false,
    acquiredDate: new Date()
  };
  
  this.inventory.items.push(newOwnedItem);
  this.statistics.itemsCollected = this.inventory.items.length;
  
  await this.save();
  return newOwnedItem;
};

// Supprimer un objet
playerSchema.methods.removeItem = async function(
  instanceId: string, 
  quantity?: number
): Promise<boolean> {
  const itemIndex = this.inventory.items.findIndex(
    item => item.instanceId === instanceId
  );
  
  if (itemIndex === -1) {
    return false;
  }
  
  const item = this.inventory.items[itemIndex];
  
  if (!quantity || quantity >= item.quantity) {
    this.inventory.items.splice(itemIndex, 1);
  } else {
    item.quantity -= quantity;
  }
  
  await this.save();
  return true;
};

// Vérifier si possède un objet
playerSchema.methods.hasItem = function(itemId: string, quantity: number = 1): boolean {
  let totalQuantity = 0;
  this.inventory.items.forEach(item => {
    if (item.itemId === itemId) {
      totalQuantity += item.quantity;
    }
  });
  return totalQuantity >= quantity;
};

// Obtenir un objet spécifique
playerSchema.methods.getItem = function(instanceId: string): IOwnedItem | null {
  return this.inventory.items.find(item => item.instanceId === instanceId) || null;
};

// Obtenir objets par catégorie
playerSchema.methods.getItemsByCategory = function(category: string): IOwnedItem[] {
  // TODO: Nécessiterait une requête vers Item pour filtrer par catégorie
  return this.inventory.items;
};

// Équiper un objet sur un héros
playerSchema.methods.equipItem = async function(
  heroId: string, 
  instanceId: string
): Promise<boolean> {
  const hero = this.heroes.find(h => h.heroId === heroId);
  const item = this.getItem(instanceId);
  
  if (!hero || !item) {
    return false;
  }
  
  // Récupérer les données de l'objet pour connaître le slot
  const Item = mongoose.model('Item');
  const itemData = await Item.findOne({ itemId: item.itemId });
  
  if (!itemData || itemData.category !== "Equipment") {
    return false;
  }
  
  const slot = itemData.equipmentSlot?.toLowerCase();
  if (!slot || !['weapon', 'helmet', 'armor', 'boots', 'accessory'].includes(slot)) {
    return false;
  }
  
  // Déséquiper l'ancien objet du même slot
  const oldInstanceId = hero.equipment[slot as keyof IHeroEquipment];
  if (oldInstanceId) {
    const oldItem = this.getItem(oldInstanceId);
    if (oldItem) {
      oldItem.isEquipped = false;
      oldItem.equippedTo = undefined;
    }
  }
  
  // Équiper le nouvel objet
  hero.equipment[slot as keyof IHeroEquipment] = instanceId;
  item.isEquipped = true;
  item.equippedTo = heroId;
  
  await this.save();
  return true;
};

// Déséquiper un objet
playerSchema.methods.unequipItem = async function(
  heroId: string, 
  slot: string
): Promise<boolean> {
  const hero = this.heroes.find(h => h.heroId === heroId);
  
  if (!hero) {
    return false;
  }
  
  const instanceId = hero.equipment[slot as keyof IHeroEquipment];
  if (!instanceId) {
    return false;
  }
  
  const item = this.getItem(instanceId);
  if (item) {
    item.isEquipped = false;
    item.equippedTo = undefined;
  }
  
  hero.equipment[slot as keyof IHeroEquipment] = undefined;
  
  await this.save();
  return true;
};

// Obtenir objets équipés
playerSchema.methods.getEquippedItems = function(heroId?: string): IOwnedItem[] {
  return this.inventory.items.filter(item => {
    return item.isEquipped && (!heroId || item.equippedTo === heroId);
  });
};

// Améliorer un objet (+enhancement)
playerSchema.methods.enhanceItem = async function(
  instanceId: string, 
  targetLevel: number
): Promise<boolean> {
  const item = this.getItem(instanceId);
  
  if (!item || targetLevel <= item.enhancement || targetLevel > 30) {
    return false;
  }
  
  // TODO: Vérifier les coûts et matériaux nécessaires
  
  item.enhancement = targetLevel;
  item.lastUpgradeDate = new Date();
  
  if (!item.equipmentData) {
    item.equipmentData = {
      durability: 100,
      socketedGems: [],
      upgradeHistory: []
    };
  }
  
  item.equipmentData.upgradeHistory.push(new Date());
  
  await this.save();
  return true;
};

// Upgrader le tier d'un objet (T0→T1→T2→T3)
playerSchema.methods.upgradeItemTier = async function(instanceId: string): Promise<boolean> {
  const item = this.getItem(instanceId);
  
  if (!item || item.tier >= 3) {
    return false;
  }
  
  // TODO: Vérifier les coûts et matériaux nécessaires
  
  item.tier++;
  item.lastUpgradeDate = new Date();
  
  await this.save();
  return true;
};

// Ajouter des étoiles à un objet
playerSchema.methods.addStarsToItem = async function(
  instanceId: string, 
  stars: number
): Promise<boolean> {
  const item = this.getItem(instanceId);
  
  if (!item || item.stars + stars > 5) {
    return false;
  }
  
  item.stars += stars;
  item.lastUpgradeDate = new Date();
  
  await this.save();
  return true;
};

// Fusionner des objets
playerSchema.methods.fuseItems = async function(instanceIds: string[]): Promise<IOwnedItem> {
  // TODO: Implémenter la logique de fusion
  throw new Error("Fusion not implemented yet");
};

// Obtenir les pièces d'un set équipées
playerSchema.methods.getEquippedSetPieces = function(heroId: string, setId: string): number {
  const equippedItems = this.getEquippedItems(heroId);
  
  // TODO: Requête vers Item pour vérifier les setId
  return equippedItems.filter(item => 
    item.equipmentData?.setId === setId
  ).length;
};

// Obtenir les bonus de sets
playerSchema.methods.getSetBonuses = function(heroId: string): any[] {
  const bonuses: any[] = [];
  
  // TODO: Implémenter la logique des sets
  // 1. Récupérer tous les objets équipés du héros
  // 2. Grouper par setId
  // 3. Calculer les bonus selon le nombre de pièces (2/4/6)
  
  return bonuses;
};

// === MÉTHODES D'INSTANCE (Héros) ===

// Ajouter un héros
playerSchema.methods.addHero = async function(heroId: string): Promise<IPlayerHero> {
  // Vérifier que le héros n'est pas déjà possédé
  const existingHero = this.heroes.find(h => h.heroId === heroId);
  if (existingHero) {
    throw new Error("Hero already owned");
  }
  
  const newHero: IPlayerHero = {
    heroId,
    level: 1,
    experience: 0,
    ascension: 0,
    stars: 0,
    equipment: {},
    isActive: false,
    skillLevels: {
      skill1: 1,
      skill2: 1,
      skill3: 1,
      ultimate: 1
    },
    acquiredDate: new Date()
  };
  
  this.heroes.push(newHero);
  this.statistics.heroesUnlocked = this.heroes.length;
  
  await this.save();
  return newHero;
};

// Obtenir un héros
playerSchema.methods.getHero = function(heroId: string): IPlayerHero | null {
  return this.heroes.find(h => h.heroId === heroId) || null;
};

// Monter le niveau d'un héros
playerSchema.methods.levelUpHero = async function(
  heroId: string, 
  levels: number
): Promise<boolean> {
  const hero = this.getHero(heroId);
  
  if (!hero || levels <= 0) {
    return false;
  }
  
  const newLevel = Math.min(hero.level + levels, 240); // Max level AFK Arena
  const levelGained = newLevel - hero.level;
  
  if (levelGained <= 0) {
    return false;
  }
  
  hero.level = newLevel;
  // TODO: Calculer et déduire les coûts (gold + matériaux)
  
  await this.save();
  return true;
};

// Ascension d'un héros
playerSchema.methods.ascendHero = async function(heroId: string): Promise<boolean> {
  const hero = this.getHero(heroId);
  
  if (!hero || hero.ascension >= 5) {
    return false;
  }
  
  // TODO: Vérifier les coûts et matériaux nécessaires
  // TODO: Vérifier les fragments de héros
  
  hero.ascension++;
  hero.lastUsedDate = new Date();
  
  await this.save();
  return true;
};

// === MÉTHODES D'INSTANCE (Économie) ===

// Ajouter des monnaies
playerSchema.methods.addCurrency = async function(
  type: keyof IPlayerInventory['currencies'], 
  amount: number
): Promise<boolean> {
  if (amount <= 0) {
    return false;
  }
  
  this.inventory.currencies[type] += amount;
  
  // Mettre à jour les statistiques
  if (type === 'gold') {
    this.statistics.goldEarned += amount;
  } else if (type === 'gems' || type === 'paidGems') {
    // Les gems dépensées sont trackées ailleurs
  }
  
  await this.save();
  return true;
};

// Dépenser des monnaies
playerSchema.methods.spendCurrency = async function(
  type: keyof IPlayerInventory['currencies'], 
  amount: number
): Promise<boolean> {
  if (amount <= 0 || !this.hasCurrency(type, amount)) {
    return false;
  }
  
  this.inventory.currencies[type] -= amount;
  
  // Mettre à jour les statistiques
  if (type === 'gems' || type === 'paidGems') {
    this.statistics.gemsSpent += amount;
  }
  
  await this.save();
  return true;
};

// Vérifier si possède assez de monnaies
playerSchema.methods.hasCurrency = function(
  type: keyof IPlayerInventory['currencies'], 
  amount: number
): boolean {
  return this.inventory.currencies[type] >= amount;
};

// === MÉTHODES D'INSTANCE (Progression) ===

// Avancer dans la campagne
playerSchema.methods.advanceCampaign = async function(
  world: number, 
  level: number
): Promise<boolean> {
  const progress = this.campaignProgress;
  
  // Vérifier que c'est une progression valide
  if (world < progress.maxWorld || 
      (world === progress.maxWorld && level <= progress.maxLevel)) {
    return false;
  }
  
  progress.currentWorld = world;
  progress.currentLevel = level;
  
  // Mettre à jour le maximum atteint
  if (world > progress.maxWorld || 
      (world === progress.maxWorld && level > progress.maxLevel)) {
    progress.maxWorld = world;
    progress.maxLevel = level;
  }
  
  await this.save();
  return true;
};

// Ajouter de l'expérience au joueur
playerSchema.methods.addExperience = async function(amount: number): Promise<boolean> {
  if (amount <= 0) {
    return false;
  }
  
  this.experience += amount;
  
  // Calculer le niveau basé sur l'expérience
  // TODO: Implémenter la courbe d'expérience
  const newLevel = Math.floor(this.experience / 1000) + 1; // Formule simple
  
  if (newLevel > this.level && newLevel <= 500) {
    this.level = newLevel;
  }
  
  await this.save();
  return true;
};

// Ajouter de l'expérience VIP
playerSchema.methods.addVipExperience = async function(amount: number): Promise<boolean> {
  if (amount <= 0) {
    return false;
  }
  
  this.vipExperience += amount;
  
  // Calculer le niveau VIP basé sur l'expérience
  // TODO: Implémenter la courbe d'expérience VIP (plus coûteuse)
  const newVipLevel = Math.floor(this.vipExperience / 10000); // Formule simple
  
  if (newVipLevel > this.vipLevel && newVipLevel <= 15) {
    this.vipLevel = newVipLevel;
    
    // Mettre à jour les bonus VIP (comme maxStorageHours)
    this.afkRewards.maxStorageHours = Math.min(12 + this.vipLevel, 24);
  }
  
  await this.save();
  return true;
};

// === MÉTHODES D'INSTANCE (Utilitaires) ===

// Obtenir les statistiques d'inventaire
playerSchema.methods.getInventoryStats = function(): any {
  const items = this.inventory.items;
  
  const stats = {
    totalItems: items.length,
    maxCapacity: this.inventory.maxCapacity,
    
    // Par catégorie (nécessiterait requête vers Item)
    equipmentCount: items.filter(item => item.isEquipped).length,
    
    // Par rareté (nécessiterait requête vers Item)
    commonCount: 0,
    rareCount: 0,
    epicCount: 0,
    legendaryCount: 0,
    
    // Équipement
    equippedCount: items.filter(item => item.isEquipped).length,
    maxEnhancement: Math.max(...items.map(item => item.enhancement), 0),
    maxTier: Math.max(...items.map(item => item.tier), 0),
    maxStars: Math.max(...items.map(item => item.stars), 0),
    
    // Sets (placeholder)
    setsCompleted: []
  };
  
  return stats;
};

// Nettoyer les objets expirés
playerSchema.methods.cleanupExpiredItems = async function(): Promise<number> {
  let removedCount = 0;
  const now = new Date();
  
  for (let i = this.inventory.items.length - 1; i >= 0; i--) {
    const item = this.inventory.items[i];
    
    if (item.consumableData?.expirationDate && 
        item.consumableData.expirationDate < now) {
      this.inventory.items.splice(i, 1);
      removedCount++;
    }
  }
  
  this.inventory.lastCleanup = now;
  await this.save();
  
  return removedCount;
};

// Optimiser l'inventaire (défragmentation)
playerSchema.methods.optimizeInventory = async function(): Promise<void> {
  // Supprimer les objets avec quantité <= 0
  this.inventory.items = this.inventory.items.filter(item => item.quantity > 0);
  
  // Grouper les objets identiques non équipés
  const groupedItems = new Map<string, IOwnedItem>();
  const equippedItems: IOwnedItem[] = [];
  
  for (const item of this.inventory.items) {
    if (item.isEquipped) {
      equippedItems.push(item);
    } else {
      const key = `${item.itemId}-${item.level}-${item.enhancement}-${item.tier}-${item.stars}`;
      const existing = groupedItems.get(key);
      
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        groupedItems.set(key, { ...item });
      }
    }
  }
  
  this.inventory.items = [...equippedItems, ...Array.from(groupedItems.values())];
  this.inventory.lastOptimization = new Date();
  
  await this.save();
};

// Calculer la valeur totale de l'inventaire
playerSchema.methods.calculateInventoryValue = function(): number {
  let totalValue = 0;
  
  // Valeur des monnaies
  const currencies = this.inventory.currencies;
  totalValue += currencies.gold;
  totalValue += currencies.gems * 10;
  totalValue += currencies.paidGems * 20;
  totalValue += currencies.tickets * 50;
  totalValue += (currencies.arenaTokens || 0) * 5;
  totalValue += (currencies.labTokens || 0) * 8;
  totalValue += (currencies.guildCoins || 0) * 3;
  
  // TODO: Valeur des objets (nécessiterait requête vers Item pour les prix)
  // Pour l'instant, on estime basé sur l'amélioration
  this.inventory.items.forEach(item => {
    let itemValue = 100; // Valeur de base
    itemValue *= (1 + item.enhancement * 0.5); // Bonus enhancement
    itemValue *= (1 + item.tier * 0.3);        // Bonus tier
    itemValue *= (1 + item.stars * 0.2);       // Bonus stars
    itemValue *= item.quantity;
    totalValue += itemValue;
  });
  
  return Math.floor(totalValue);
};

// Craft d'un objet (placeholder)
playerSchema.methods.craftItem = async function(recipeId: string): Promise<IOwnedItem> {
  // TODO: Implémenter le système de craft
  throw new Error("Crafting not implemented yet");
};

export default mongoose.model<IPlayerDocument>("Player", playerSchema);

// Types et interfaces pour l'API Soulspire

export interface IPlayer {
  _id?: string;
  username: string;
  password: string;
  gold: number;
  gems: number;
  paidGems: number;
  world: number;
  level: number;
  difficulty: "Normal" | "Hard" | "Nightmare";
  heroes: IPlayerHero[];
  formationId?: string | null;
  tickets: number;
  fragments: Map<string, number>;
  materials: Map<string, number>;
  createdAt?: Date;
}

export interface IPlayerHero {
  _id?: string;
  heroId: string;
  level: number;
  stars: number;
  equipped: boolean;
  slot?: number | null;
}

export interface IHero {
  _id?: string;
  name: string;
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support";
  element: "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark";
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    defMagique: number;
    vitesse: number;
    intelligence: number;
    force: number;
    moral: number;
    reductionCooldown: number;
  };
  skill: {
    name: string;
    description: string;
    type: "Heal" | "Buff" | "AoE" | "Control" | "Damage";
    cooldown: number;
    energyCost: number;
  };
}

export interface IEquipment {
  _id?: string;
  itemId: string;
  name: string;
  type: "Weapon" | "Armor" | "Accessory";
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  level: number;
  stats: {
    atk: number;
    def: number;
    hp: number;
  };
  equippedTo?: string;
}

export interface IInventory {
  _id?: string;
  playerId: string;
  gold: number;
  gems: number;
  paidGems: number;
  tickets: number;
  fragments: Map<string, number>;
  materials: Map<string, number>;
  equipment: IEquipment[];
}

export interface ISummon {
  _id?: string;
  playerId: string;
  heroesObtained: {
    heroId: string;
    rarity: string;
  }[];
  type: "Standard" | "Limited" | "Ticket";
  createdAt?: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  id: string;
  iat?: number;
  exp?: number;
}

// Types pour les requêtes/réponses
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  playerId: string;
}

export interface GachaPullRequest {
  type: "Standard" | "Limited" | "Ticket";
  count?: number;
}

export interface GachaPullResponse {
  message: string;
  results: {
    hero: {
      id: string;
      name: string;
      role: string;
      element: string;
      rarity: string;
      baseStats: {
        hp: number;
        atk: number;
        def: number;
        defMagique: number;
        vitesse: number;
        intelligence: number;
        force: number;
        moral: number;
        reductionCooldown: number;
      };
      skill: {
        name: string;
        description: string;
        type: string;
        cooldown: number;
        energyCost: number;
      };
    };
    rarity: string;
    isNew: boolean;
    fragmentsGained: number;
  }[];
  stats: {
    legendary: number;
    epic: number;
    rare: number;
    common: number;
    newHeroes: number;
    totalFragments: number;
  };
  cost: {
    gems?: number;
    tickets?: number;
  };
  remaining: {
    gems: number;
    tickets: number;
  };
  pityStatus: {
    pullsSinceLegendary: number;
    pullsSinceEpic: number;
    legendaryPityIn: number;
    epicPityIn: number;
  };
}

export interface IShopItem {
  itemId: string;
  type: "Currency" | "Hero" | "Equipment" | "Material" | "Fragment" | "Ticket";
  name: string;
  description?: string;
  rarity?: "Common" | "Rare" | "Epic" | "Legendary";
  quantity: number;
  
  // Coûts
  cost: {
    gold?: number;
    gems?: number;
    paidGems?: number;
    tickets?: number;
  };
  
  // Stock et limitations
  maxStock: number; // -1 = illimité
  currentStock: number;
  maxPurchasePerPlayer: number; // -1 = illimité par joueur
  
  // Conditions d'achat
  levelRequirement?: number;
  worldRequirement?: number;
  
  // Données spécifiques selon le type
  heroData?: {
    heroId?: string;
    level?: number;
    stars?: number;
  };
  equipmentData?: {
    type?: "Weapon" | "Armor" | "Accessory";
    level?: number;
    stats?: {
      atk: number;
      def: number;
      hp: number;
    };
  };
  materialData?: {
    materialType?: string;
  };
  
  // Metadata
  weight?: number; // Probabilité d'apparition (1-100)
  isPromotional?: boolean;
  promotionalText?: string;
  
  // Tracking
  totalPurchased?: number;
  purchasedBy?: {
    playerId: string;
    quantity: number;
    purchaseDate: Date;
  }[];
}

export interface IShop {
  _id?: string;
  type: "Daily" | "Weekly" | "Monthly" | "Premium";
  items: IShopItem[];
  resetTime: Date;
  nextResetTime: Date;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Types pour les requêtes/réponses Shop
export interface ShopPurchaseRequest {
  shopType: "Daily" | "Weekly" | "Monthly" | "Premium";
  itemId: string;
  quantity?: number;
}

export interface ShopPurchaseResponse {
  message: string;
  purchase: {
    itemId: string;
    itemName: string;
    quantity: number;
    cost: {
      gold?: number;
      gems?: number;
      paidGems?: number;
      tickets?: number;
    };
    reward: {
      type: string;
      quantity: number;
      data?: any;
    };
  };
  remaining: {
    gold: number;
    gems: number;
    paidGems: number;
    tickets: number;
  };
  itemStock: {
    current: number;
    max: number;
  };
}

export interface ShopRefreshRequest {
  shopType: "Daily" | "Weekly" | "Monthly" | "Premium";
  force?: boolean;
}

export interface ShopListResponse {
  message: string;
  shops: {
    type: string;
    items: (IShopItem & {
      canPurchase: boolean;
      playerPurchases: number;
      timeUntilReset: number; // en secondes
    })[];
    resetTime: Date;
    nextResetTime: Date;
  }[];
}

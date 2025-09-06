// Types et interfaces pour l'API Soulspire - Version Account/Player

// === ARCHITECTURE ACCOUNT/PLAYER ===

export interface LoginRequest {
  username: string;
  password: string;
  serverId?: string;
}

export interface JWTPayload {
  id: string;
  accountId?: string;
  playerId?: string;
  serverId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  playerId: string;
  accountId?: string;
  serverId?: string;
  playerInfo?: {
    displayName: string;
    level: number;
    vipLevel: number;
    isNewPlayer: boolean;
  };
}

export interface AccountInfo {
  accountId: string;
  username: string;
  email?: string;
  accountStatus: "active" | "suspended" | "banned" | "inactive";
  totalPlaytimeMinutes: number;
  totalPurchasesUSD: number;
  serverList: string[];
  favoriteServerId?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface PlayerInfo {
  serverId: string;
  displayName: string;
  level: number;
  vipLevel: number;
  lastSeenAt: Date;
  accountAge: number;
}

export interface SwitchServerRequest {
  serverId: string;
}

export interface SwitchServerResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  playerId: string;
  serverId: string;
  playerInfo: {
    displayName: string;
    level: number;
    vipLevel: number;
    isNewPlayer: boolean;
  };
}

// === INTERFACES PLAYER (COMPATIBILITÉ) ===

export interface IPlayer {
  _id?: string;
  playerId?: string;
  accountId?: string;
  serverId?: string;
  username: string;
  displayName?: string;
  password?: string; // Temporaire pour compatibilité
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
  lastSeenAt?: Date;
}

export interface IPlayerHero {
  _id?: string;
  heroId: string;
  level: number;
  stars: number;
  equipped: boolean;
  slot?: number | null;
  experience?: number;
  ascensionLevel?: number;
  awakenLevel?: number;
  acquisitionDate?: Date;
}

// === INTERFACES HÉROS ===

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

export interface IHeroStats {
  attack: number;
  defense: number;
  health: number;
  speed: number;
  criticalRate: number;
  criticalDamage: number;
  accuracy: number;
  dodge: number;
}

export interface IHeroSkill {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  energyCost: number;
  targetType: "self" | "ally" | "enemy" | "all_allies" | "all_enemies";
  effects: ISkillEffect[];
}

export interface ISkillEffect {
  type: "damage" | "heal" | "buff" | "debuff" | "status";
  value: number;
  duration?: number;
  target: "self" | "target" | "all";
}

// === INTERFACES ÉQUIPEMENT ===

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

// === INTERFACES GACHA ===

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

export interface IGachaBanner {
  bannerId: string;
  name: string;
  type: "standard" | "limited" | "weapon";
  startDate: Date;
  endDate?: Date;
  rates: IGachaRates;
  featuredHeroes: string[];
  pityCounter: number;
  maxPity: number;
}

export interface IGachaRates {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
}

export interface IGachaResult {
  heroId: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  isNew: boolean;
  fragments?: number;
}

// === INTERFACES BOUTIQUE ===

export interface IShopItem {
  itemId: string;
  type: "Currency" | "Hero" | "Equipment" | "Material" | "Fragment" | "Ticket";
  name: string;
  description?: string;
  rarity?: "Common" | "Rare" | "Epic" | "Legendary";
  quantity: number;
  
  cost: {
    gold?: number;
    gems?: number;
    paidGems?: number;
    tickets?: number;
  };
  
  maxStock: number;
  currentStock: number;
  maxPurchasePerPlayer: number;
  
  levelRequirement?: number;
  worldRequirement?: number;
  
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
  
  weight?: number;
  isPromotional?: boolean;
  promotionalText?: string;
  
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
      timeUntilReset: number;
    })[];
    resetTime: Date;
    nextResetTime: Date;
  }[];
}

// === INTERFACES COMBAT ===

export interface IBattleResult {
  victory: boolean;
  rewards: IReward[];
  experience: number;
  battleLog: IBattleLogEntry[];
}

export interface IBattleLogEntry {
  turn: number;
  actor: string;
  action: string;
  target?: string;
  damage?: number;
  healing?: number;
  effect?: string;
}

// === INTERFACES RÉCOMPENSES ===

export interface IReward {
  type: "currency" | "hero" | "item" | "material";
  id?: string;
  quantity: number;
  rarity?: "common" | "rare" | "epic" | "legendary";
}

// === INTERFACES CAMPAGNE ===

export interface ICampaignStage {
  worldId: number;
  stageId: number;
  difficulty: "Normal" | "Hard" | "Nightmare";
  enemyLevel: number;
  enemyPower: number;
  rewards: IReward[];
  firstClearRewards: IReward[];
}

// === INTERFACES TOUR ===

export interface ITowerFloor {
  floor: number;
  enemyLevel: number;
  enemyPower: number;
  rewards: IReward[];
  resetRewards: IReward[];
}

// === INTERFACES ÉVÉNEMENTS ===

export interface IEvent {
  eventId: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  type: "campaign" | "tower" | "arena" | "special";
  requirements: IEventRequirement[];
  rewards: IEventReward[];
}

export interface IEventRequirement {
  type: "level" | "vip" | "progression" | "item";
  value: number | string;
}

export interface IEventReward {
  milestone: number;
  rewards: IReward[];
}

// === INTERFACES MISSIONS ===

export interface IMission {
  missionId: string;
  name: string;
  description: string;
  type: "daily" | "weekly" | "achievement";
  requirements: IMissionRequirement[];
  rewards: IReward[];
  progress: number;
  maxProgress: number;
  completed: boolean;
  claimed: boolean;
}

export interface IMissionRequirement {
  type: "battle" | "level" | "collect" | "spend";
  target?: string;
  value: number;
}

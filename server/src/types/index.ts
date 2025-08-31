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
  };
  skill: {
    name: string;
    description: string;
    type: "Heal" | "Buff" | "AoE" | "Control" | "Damage";
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
      };
      skill: {
        name: string;
        description: string;
        type: string;
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

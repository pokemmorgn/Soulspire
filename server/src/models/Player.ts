import mongoose, { Document, Schema } from "mongoose";

// Interface pour les héros du joueur
export interface IPlayerHero {
  heroId: string;
  level: number;
  stars: number;
  equipped: boolean;
  slot: number | null;
  experience: number;
  ascensionLevel: number; // 0=Normal, 1=Elite, 2=Elite+, 3=Legendary, 4=Legendary+, 5=Mythic, etc.
  awakenLevel: number; // Awakening level (0-5)
  acquisitionDate: Date;
}

// Interface pour les formations
interface IFormationSlot {
  slot: number;
  heroId: string;
}

interface IFormation {
  _id?: string;
  name: string;
  slots: IFormationSlot[];
  isActive: boolean;
  lastUsed?: Date;
}

// Interface pour les achats spécifiques au serveur
interface IServerPurchase {
  transactionId: string;
  productId: string;
  productName: string;
  priceUSD: number;
  gemsReceived: number;
  bonusGems: number;
  purchaseDate: Date;
  platform: "android" | "ios" | "web" | "steam";
  status: "completed" | "pending" | "refunded" | "failed";
}

// Interface pour l'historique VIP du serveur
interface IVipTransaction {
  transactionId: string;
  expGained: number;
  source: "purchase" | "event" | "admin_grant";
  cost: number; // Gems payantes dépensées
  timestamp: Date;
  levelBefore: number;
  levelAfter: number;
}

// Interface principale du joueur (spécifique à un serveur)
export interface IPlayer {
  _id?: string;
  playerId: string; // UUID unique pour ce joueur sur ce serveur
  accountId: string; // Référence vers Account global
  serverId: string; // "S1", "S2", etc.
  
  // IDENTITÉ SUR LE SERVEUR
  displayName: string; // Nom affiché (peut différer du username Account)
  avatarId?: string;
  backgroundId?: string;
  
  // PROGRESSION SPÉCIFIQUE AU SERVEUR
  playerLevel: number; // Niveau du joueur
  experience: number; // EXP du joueur
  world: number; // Monde campagne
  stage: number; // Stage dans le monde
  difficulty: "Normal" | "Hard" | "Nightmare";
  
  // MONNAIES SPÉCIFIQUES AU SERVEUR
  gold: number; // Or farmé sur ce serveur
  gems: number; // Gems farmées sur ce serveur
  paidGems: number; // Gems ACHETÉES sur ce serveur (isolées)
  tickets: number; // Tickets d'invocation
  
  // VIP SPÉCIFIQUE AU SERVEUR
  vipLevel: number; // VIP de ce serveur uniquement
  vipExperience: number; // EXP VIP de ce serveur
  vipTransactions: IVipTransaction[]; // Historique VIP serveur
  
  // COLLECTION ET PROGRESSION
  heroes: IPlayerHero[];
  formations: IFormation[];
  activeFormationId?: string;
  
  // INVENTAIRE SERVEUR
  fragments: Map<string, number>; // Fragments de héros
  materials: Map<string, number>; // Matériaux d'évolution
  items: Map<string, number>; // Objets et équipements
  
  // PROGRESSION MODES DE JEU
  campaignProgress: {
    highestWorld: number;
    highestStage: number;
    starsEarned: number;
  };
  towerProgress: {
    highestFloor: number;
    lastResetDate: Date;
  };
  arenaProgress: {
    currentRank: number;
    highestRank: number;
    seasonWins: number;
    seasonLosses: number;
  };
  
  // DONNÉES TEMPORELLES SERVEUR
  lastLoginAt: Date;
  lastAfkCollectAt: Date;
  lastDailyResetAt: Date;
  playtimeMinutes: number; // Temps de jeu sur ce serveur
  
  // ÉVÉNEMENTS ET MISSIONS SERVEUR
  dailyMissionsCompleted: number;
  weeklyMissionsCompleted: number;
  eventParticipations: string[]; // IDs des événements auxquels il a participé
  
  // SOCIAL SERVEUR
  guildId?: string;
  friendsList: string[]; // IDs des amis sur ce serveur
  
  // ACHATS SERVEUR
  serverPurchases: IServerPurchase[]; // Achats faits sur ce serveur
  totalSpentUSDOnServer: number; // Total dépensé sur ce serveur
  
  // MÉTA-DONNÉES
  createdAt: Date;
  isNewPlayer: boolean; // Premier jour sur le serveur
  tutorialCompleted: boolean;
  
  // DONNÉES DE JEU
  totalBattlesFought: number;
  totalBattlesWon: number;
  totalDamageDealt: number;
  totalHeroesCollected: number;
}

interface IPlayerDocument extends Document {
  playerId: string;
  accountId: string;
  serverId: string;
  displayName: string;
  avatarId?: string;
  backgroundId?: string;
  playerLevel: number;
  experience: number;
  world: number;
  stage: number;
  difficulty: "Normal" | "Hard" | "Nightmare";
  gold: number;
  gems: number;
  paidGems: number;
  tickets: number;
  vipLevel: number;
  vipExperience: number;
  vipTransactions: IVipTransaction[];
  heroes: IPlayerHero[];
  formations: IFormation[];
  activeFormationId?: string;
  fragments: Map<string, number>;
  materials: Map<string, number>;
  items: Map<string, number>;
  campaignProgress: {
    highestWorld: number;
    highestStage: number;
    starsEarned: number;
  };
  towerProgress: {
    highestFloor: number;
    lastResetDate: Date;
  };
  arenaProgress: {
    currentRank: number;
    highestRank: number;
    seasonWins: number;
    seasonLosses: number;
  };
  lastLoginAt: Date;
  lastAfkCollectAt: Date;
  lastDailyResetAt: Date;
  playtimeMinutes: number;
  dailyMissionsCompleted: number;
  weeklyMissionsCompleted: number;
  eventParticipations: string[];
  guildId?: string;
  friendsList: string[];
  serverPurchases: IServerPurchase[];
  totalSpentUSDOnServer: number;
  isNewPlayer: boolean;
  tutorialCompleted: boolean;
  totalBattlesFought: number;
  totalBattlesWon: number;
  totalDamageDealt: number;
  totalHeroesCollected: number;
  
  // Méthodes d'instance
  addHero(heroId: string, level?: number, stars?: number): Promise<IPlayerDocument>;
  removeHero(heroId: string): Promise<IPlayerDocument>;
  upgradeHero(heroId: string, newLevel: number, newStars?: number): Promise<IPlayerDocument>;
  getEquippedHeroes(): IPlayerHero[];
  setFormation(formationId: string, slots: { slot: number, heroId: string }[]): Promise<IPlayerDocument>;
  canAfford(cost: { gold?: number, gems?: number, paidGems?: number, tickets?: number }): boolean;
  spendCurrency(cost: { gold?: number, gems?: number, paidGems?: number, tickets?: number }): Promise<IPlayerDocument>;
  addCurrency(currency: { gold?: number, gems?: number, paidGems?: number, tickets?: number }): Promise<IPlayerDocument>;
  addVipExp(amount: number, source?: string, cost?: number): Promise<{ newLevel: number; leveledUp: boolean }>;
  addServerPurchase(purchase: IServerPurchase): Promise<IPlayerDocument>;
  updateProgress(type: string, value: number): Promise<IPlayerDocument>;
  isEligibleForEvent(eventType: string): boolean;
  calculatePowerScore(): number;
  getPlayerStats(): any;
  needsDailyReset(): boolean;
  performDailyReset(): Promise<IPlayerDocument>;
}

// Schémas secondaires
const playerHeroSchema = new Schema<IPlayerHero>({
  heroId: { 
    type: String,
    required: true 
  },
  level: { 
    type: Number, 
    default: 1,
    min: 1,
    max: 100
  },
  stars: { 
    type: Number, 
    default: 1,
    min: 1,
    max: 6
  },
  equipped: { 
    type: Boolean, 
    default: false 
  },
  slot: {
    type: Number,
    min: 1,
    max: 9,
    default: null
  },
  experience: {
    type: Number,
    default: 0,
    min: 0
  },
  ascensionLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 8
  },
  awakenLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  acquisitionDate: {
    type: Date,
    default: Date.now
  }
});

const formationSchema = new Schema<IFormation>({
  name: { type: String, required: true },
  slots: [{
    slot: { type: Number, required: true, min: 1, max: 9 },
    heroId: { type: String, required: true }
  }],
  isActive: { type: Boolean, default: false },
  lastUsed: { type: Date }
}, { _id: true });

const serverPurchaseSchema = new Schema<IServerPurchase>({
  transactionId: { type: String, required: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  priceUSD: { type: Number, required: true, min: 0 },
  gemsReceived: { type: Number, required: true, min: 0 },
  bonusGems: { type: Number, default: 0, min: 0 },
  purchaseDate: { type: Date, default: Date.now },
  platform: { 
    type: String, 
    enum: ["android", "ios", "web", "steam"], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ["completed", "pending", "refunded", "failed"],
    default: "completed"
  }
}, { _id: false });

const vipTransactionSchema = new Schema<IVipTransaction>({
  transactionId: { type: String, required: true },
  expGained: { type: Number, required: true, min: 0 },
  source: { 
    type: String, 
    enum: ["purchase", "event", "admin_grant"],
    required: true 
  },
  cost: { type: Number, default: 0, min: 0 },
  timestamp: { type: Date, default: Date.now },
  levelBefore: { type: Number, required: true, min: 0 },
  levelAfter: { type: Number, required: true, min: 0 }
}, { _id: false });

// Schéma principal Player
const playerSchema = new Schema<IPlayerDocument>({
  playerId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => `PLAYER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  accountId: { 
    type: String,
    required: true,
    index: true
  },
  serverId: { 
    type: String,
    required: true,
    match: /^S\d+$/,
    index: true
  },
  
  // IDENTITÉ
  displayName: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  avatarId: { 
    type: String,
    default: "default_avatar"
  },
  backgroundId: { 
    type: String,
    default: "default_bg"
  },
  
  // PROGRESSION
  playerLevel: { 
    type: Number, 
    default: 1,
    min: 1,
    max: 500
  },
  experience: { 
    type: Number, 
    default: 0,
    min: 0
  },
  world: { 
    type: Number, 
    default: 1,
    min: 1,
    max: 20
  },
  stage: { 
    type: Number, 
    default: 1,
    min: 1
  },
  difficulty: { 
    type: String, 
    enum: ["Normal", "Hard", "Nightmare"],
    default: "Normal"
  },
  
  // MONNAIES SERVEUR
  gold: { 
    type: Number, 
    default: 1000,
    min: 0
  },
  gems: { 
    type: Number, 
    default: 100,
    min: 0
  },
  paidGems: { 
    type: Number, 
    default: 0,
    min: 0
  },
  tickets: { 
    type: Number, 
    default: 5,
    min: 0
  },
  
  // VIP SERVEUR
  vipLevel: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 15
  },
  vipExperience: { 
    type: Number, 
    default: 0,
    min: 0
  },
  vipTransactions: { 
    type: [vipTransactionSchema],
    default: []
  },
  
  // COLLECTION
  heroes: [playerHeroSchema],
  formations: { 
    type: [formationSchema],
    default: []
  },
  activeFormationId: { 
    type: String,
    default: null
  },
  
  // INVENTAIRE
  fragments: { 
    type: Map, 
    of: Number, 
    default: new Map()
  },
  materials: { 
    type: Map, 
    of: Number, 
    default: new Map()
  },
  items: { 
    type: Map, 
    of: Number, 
    default: new Map()
  },
  
  // PROGRESSION MODES
  campaignProgress: {
    highestWorld: { type: Number, default: 1 },
    highestStage: { type: Number, default: 1 },
    starsEarned: { type: Number, default: 0 }
  },
  towerProgress: {
    highestFloor: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now }
  },
  arenaProgress: {
    currentRank: { type: Number, default: 999999 },
    highestRank: { type: Number, default: 999999 },
    seasonWins: { type: Number, default: 0 },
    seasonLosses: { type: Number, default: 0 }
  },
  
  // TEMPOREL
  lastLoginAt: { 
    type: Date, 
    default: Date.now 
  },
  lastAfkCollectAt: { 
    type: Date, 
    default: Date.now 
  },
  lastDailyResetAt: { 
    type: Date, 
    default: Date.now 
  },
  playtimeMinutes: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  // MISSIONS ET ÉVÉNEMENTS
  dailyMissionsCompleted: { 
    type: Number, 
    default: 0,
    min: 0
  },
  weeklyMissionsCompleted: { 
    type: Number, 
    default: 0,
    min: 0
  },
  eventParticipations: [{ 
    type: String 
  }],
  
  // SOCIAL
  guildId: { type: String },
  friendsList: [{ type: String }],
  
  // ACHATS SERVEUR
  serverPurchases: { 
    type: [serverPurchaseSchema],
    default: []
  },
  totalSpentUSDOnServer: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  // MÉTA
  isNewPlayer: { 
    type: Boolean, 
    default: true
  },
  tutorialCompleted: { 
    type: Boolean, 
    default: false
  },
  
  // STATS
  totalBattlesFought: { 
    type: Number, 
    default: 0,
    min: 0
  },
  totalBattlesWon: { 
    type: Number, 
    default: 0,
    min: 0
  },
  totalDamageDealt: { 
    type: Number, 
    default: 0,
    min: 0
  },
  totalHeroesCollected: { 
    type: Number, 
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  collection: 'players'
});

// Index composites pour optimiser les requêtes
playerSchema.index({ accountId: 1, serverId: 1 }); // Un account peut avoir plusieurs players
playerSchema.index({ serverId: 1, playerLevel: -1 }); // Classements par serveur
playerSchema.index({ serverId: 1, vipLevel: -1 }); // Classements VIP par serveur
playerSchema.index({ serverId: 1, "campaignProgress.highestWorld": -1 }); // Progression campagne
playerSchema.index({ serverId: 1, "towerProgress.highestFloor": -1 }); // Classement tour
playerSchema.index({ serverId: 1, "arenaProgress.currentRank": 1 }); // Classement arène
playerSchema.index({ serverId: 1, totalSpentUSDOnServer: -1 }); // Spenders par serveur
playerSchema.index({ serverId: 1, lastLoginAt: -1 }); // Activité par serveur
playerSchema.index({ guildId: 1 }); // Membres de guilde
playerSchema.index({ isNewPlayer: 1, createdAt: -1 }); // Nouveaux joueurs

// Méthodes statiques
playerSchema.statics.findByAccount = function(accountId: string, serverId?: string) {
  const query: any = { accountId };
  if (serverId) query.serverId = serverId;
  return this.find(query);
};

playerSchema.statics.findByServer = function(serverId: string) {
  return this.find({ serverId });
};

playerSchema.statics.getServerLeaderboard = function(serverId: string, type: string = "level", limit: number = 100) {
  const sortField = type === "level" ? "playerLevel" : 
                   type === "vip" ? "vipLevel" :
                   type === "tower" ? "towerProgress.highestFloor" :
                   type === "spending" ? "totalSpentUSDOnServer" : "playerLevel";
  
  return this.find({ serverId })
    .sort({ [sortField]: -1 })
    .limit(limit)
    .select('displayName playerLevel vipLevel towerProgress.highestFloor totalSpentUSDOnServer');
};

playerSchema.statics.getActivePlayersOnServer = function(serverId: string, hoursAgo: number = 24) {
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return this.find({ 
    serverId, 
    lastLoginAt: { $gte: cutoff } 
  });
};

// Méthodes d'instance
playerSchema.methods.addHero = function(heroId: string, level: number = 1, stars: number = 1) {
  const existingHero = this.heroes.find((h: IPlayerHero) => h.heroId === heroId);
  if (existingHero) {
    // Si le héros existe déjà, on peut augmenter ses étoiles ou le convertir en fragments
    return this.save();
  }
  
  this.heroes.push({
    heroId,
    level,
    stars,
    equipped: false,
    slot: null,
    experience: 0,
    ascensionLevel: 0,
    awakenLevel: 0,
    acquisitionDate: new Date()
  });
  
  this.totalHeroesCollected = this.heroes.length;
  return this.save();
};

playerSchema.methods.removeHero = function(heroId: string) {
  this.heroes = this.heroes.filter((h: IPlayerHero) => h.heroId !== heroId);
  this.totalHeroesCollected = this.heroes.length;
  return this.save();
};

playerSchema.methods.upgradeHero = function(heroId: string, newLevel: number, newStars?: number) {
  const hero = this.heroes.find((h: IPlayerHero) => h.heroId === heroId);
  if (hero) {
    hero.level = newLevel;
    if (newStars !== undefined) hero.stars = newStars;
  }
  return this.save();
};

playerSchema.methods.getEquippedHeroes = function() {
  return this.heroes.filter((hero: IPlayerHero) => hero.equipped);
};

playerSchema.methods.setFormation = function(formationId: string, slots: { slot: number, heroId: string }[]) {
  this.activeFormationId = formationId;
  
  // Désactiver tous les héros
  this.heroes.forEach((h: IPlayerHero) => {
    h.slot = null;
    h.equipped = false;
  });
  
  // Activer les héros de la formation
  slots.forEach(({ slot, heroId }) => {
    const hero = this.heroes.find((h: IPlayerHero) => h.heroId === heroId);
    if (hero) {
      hero.slot = slot;
      hero.equipped = true;
    }
  });
  
  return this.save();
};

playerSchema.methods.canAfford = function(cost: { gold?: number, gems?: number, paidGems?: number, tickets?: number }) {
  if (cost.gold && this.gold < cost.gold) return false;
  if (cost.gems && this.gems < cost.gems) return false;
  if (cost.paidGems && this.paidGems < cost.paidGems) return false;
  if (cost.tickets && this.tickets < cost.tickets) return false;
  return true;
};

playerSchema.methods.spendCurrency = function(cost: { gold?: number, gems?: number, paidGems?: number, tickets?: number }) {
  if (!this.canAfford(cost)) {
    throw new Error("Insufficient currency");
  }
  
  if (cost.gold) this.gold -= cost.gold;
  if (cost.gems) this.gems -= cost.gems;
  if (cost.paidGems) this.paidGems -= cost.paidGems;
  if (cost.tickets) this.tickets -= cost.tickets;
  
  return this.save();
};

playerSchema.methods.addCurrency = function(currency: { gold?: number, gems?: number, paidGems?: number, tickets?: number }) {
  if (currency.gold) this.gold += currency.gold;
  if (currency.gems) this.gems += currency.gems;
  if (currency.paidGems) this.paidGems += currency.paidGems;
  if (currency.tickets) this.tickets += currency.tickets;
  
  return this.save();
};

playerSchema.methods.addVipExp = function(amount: number, source: string = "purchase", cost: number = 0) {
  const oldLevel = this.vipLevel;
  this.vipExperience += amount;
  
  // Calcul simple du niveau VIP (à adapter selon vos règles)
  const newLevel = Math.min(15, Math.floor(this.vipExperience / 1000));
  const leveledUp = newLevel > oldLevel;
  this.vipLevel = newLevel;
  
  // Ajouter la transaction VIP
  this.vipTransactions.push({
    transactionId: `vip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    expGained: amount,
    source: source as any,
    cost,
    timestamp: new Date(),
    levelBefore: oldLevel,
    levelAfter: newLevel
  });
  
  return this.save().then(() => ({ newLevel, leveledUp }));
};

playerSchema.methods.addServerPurchase = function(purchase: IServerPurchase) {
  this.serverPurchases.push(purchase);
  this.totalSpentUSDOnServer += purchase.priceUSD;
  
  // Ajouter les gems au joueur
  if (purchase.status === "completed") {
    this.paidGems += purchase.gemsReceived + purchase.bonusGems;
  }
  
  return this.save();
};

playerSchema.methods.updateProgress = function(type: string, value: number) {
  switch (type) {
    case "campaign":
      if (value > this.campaignProgress.highestWorld) {
        this.campaignProgress.highestWorld = value;
      }
      break;
    case "tower":
      if (value > this.towerProgress.highestFloor) {
        this.towerProgress.highestFloor = value;
      }
      break;
    case "battle_won":
      this.totalBattlesWon += value;
      this.totalBattlesFought += value;
      break;
    case "battle_lost":
      this.totalBattlesFought += value;
      break;
    case "damage":
      this.totalDamageDealt += value;
      break;
  }
  return this.save();
};

playerSchema.methods.isEligibleForEvent = function(eventType: string) {
  // Logique d'éligibilité pour différents événements
  switch (eventType) {
    case "newbie_event":
      return this.isNewPlayer;
    case "vip_event":
      return this.vipLevel >= 5;
    case "endgame_event":
      return this.playerLevel >= 100;
    default:
      return true;
  }
};

playerSchema.methods.calculatePowerScore = function() {
  // Calcul simplifié du power score basé sur les héros équipés
  const equippedHeroes = this.getEquippedHeroes();
  return equippedHeroes.reduce((total: number, hero: IPlayerHero) => {
    const baseScore = hero.level * 100 + hero.stars * 500;
    const ascensionBonus = hero.ascensionLevel * 1000;
    const awakenBonus = hero.awakenLevel * 2000;
    return total + baseScore + ascensionBonus + awakenBonus;
  }, 0);
};

playerSchema.methods.getPlayerStats = function() {
  return {
    basicInfo: {
      displayName: this.displayName,
      playerLevel: this.playerLevel,
      vipLevel: this.vipLevel,
      serverId: this.serverId
    },
    progression: {
      campaignProgress: this.campaignProgress,
      towerProgress: this.towerProgress,
      arenaProgress: this.arenaProgress
    },
    collection: {
      totalHeroes: this.heroes.length,
      equippedHeroes: this.getEquippedHeroes().length,
      powerScore: this.calculatePowerScore()
    },
    economy: {
      gold: this.gold,
      gems: this.gems,
      paidGems: this.paidGems,
      tickets: this.tickets,
      totalSpentUSD: this.totalSpentUSDOnServer
    },
    activity: {
      playtimeHours: Math.round(this.playtimeMinutes / 60),
      totalBattles: this.totalBattlesFought,
      winRate: this.totalBattlesFought > 0 ? (this.totalBattlesWon / this.totalBattlesFought * 100).toFixed(1) : "0",
      lastLogin: this.lastLoginAt,
      accountAge: this.createdAt ? Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0
    }
  };
};

playerSchema.methods.needsDailyReset = function() {
  const now = new Date();
  const lastReset = new Date(this.lastDailyResetAt);
  
  // Check if it's a new day (can be customized for server timezone)
  return now.getDate() !== lastReset.getDate() || 
         now.getMonth() !== lastReset.getMonth() || 
         now.getFullYear() !== lastReset.getFullYear();
};

playerSchema.methods.performDailyReset = function() {
  this.dailyMissionsCompleted = 0;
  this.lastDailyResetAt = new Date();
  
  // Réinitialiser d'autres données quotidiennes si nécessaire
  // Ex: tentatives de donjon, énergie, etc.
  
  return this.save();
};

export default mongoose.model<IPlayerDocument>("Player", playerSchema);

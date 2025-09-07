import mongoose, { Document, Schema } from "mongoose";

export interface IPlayerHero {
  heroId: string;
  level: number;
  stars: number;
  equipped: boolean;
  slot: number | null;
  experience: number;
  ascensionLevel: number;
  awakenLevel: number;
  acquisitionDate: Date;
}

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

interface IVipTransaction {
  transactionId: string;
  expGained: number;
  source: "purchase" | "event" | "admin_grant";
  cost: number;
  timestamp: Date;
  levelBefore: number;
  levelAfter: number;
}

export interface IPlayer {
  _id?: string; // PRIMARY KEY = playerId string
  playerId?: string; // Optionnel, redondant
  accountId: string;
  serverId: string;
  displayName: string;
  avatarId?: string;
  backgroundId?: string;
  level: number;
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
  lastSeenAt: Date;
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
  createdAt?: Date;
  isNewPlayer: boolean;
  tutorialCompleted: boolean;
  totalBattlesFought: number;
  totalBattlesWon: number;
  totalDamageDealt: number;
  totalHeroesCollected: number;
}

interface IPlayerDocument extends Document, IPlayer {
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

const playerHeroSchema = new Schema<IPlayerHero>({
  heroId: { type: String, required: true },
  level: { type: Number, default: 1, min: 1, max: 100 },
  stars: { type: Number, default: 1, min: 1, max: 6 },
  equipped: { type: Boolean, default: false },
  slot: { type: Number, min: 1, max: 9, default: null },
  experience: { type: Number, default: 0, min: 0 },
  ascensionLevel: { type: Number, default: 0, min: 0, max: 8 },
  awakenLevel: { type: Number, default: 0, min: 0, max: 5 },
  acquisitionDate: { type: Date, default: Date.now }
}, { _id: true });

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
  platform: { type: String, enum: ["android", "ios", "web", "steam"], required: true },
  status: { type: String, enum: ["completed", "pending", "refunded", "failed"], default: "completed" }
}, { _id: false });

const vipTransactionSchema = new Schema<IVipTransaction>({
  transactionId: { type: String, required: true },
  expGained: { type: Number, required: true, min: 0 },
  source: { type: String, enum: ["purchase", "event", "admin_grant"], required: true },
  cost: { type: Number, default: 0, min: 0 },
  timestamp: { type: Date, default: Date.now },
  levelBefore: { type: Number, required: true, min: 0 },
  levelAfter: { type: Number, required: true, min: 0 }
}, { _id: false });

const playerSchema = new Schema<IPlayerDocument>({
  _id: { // PRIMARY KEY en string
    type: String,
    required: true,
    default: () => `PLAYER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  playerId: { // Optionnel, redondant
    type: String,
    required: false,
    default: undefined
  },
  accountId: { type: String, required: true },
  serverId: { type: String, required: true, match: /^S\d+$/ },
  displayName: { type: String, required: true, trim: true, minlength: 3, maxlength: 20 },
  avatarId: { type: String, default: "default_avatar" },
  backgroundId: { type: String, default: "default_bg" },
  level: { type: Number, default: 1, min: 1, max: 500 },
  experience: { type: Number, default: 0, min: 0 },
  world: { type: Number, default: 1, min: 1, max: 20 },
  stage: { type: Number, default: 1, min: 1 },
  difficulty: { type: String, enum: ["Normal", "Hard", "Nightmare"], default: "Normal" },
  gold: { type: Number, default: 1000, min: 0 },
  gems: { type: Number, default: 100, min: 0 },
  paidGems: { type: Number, default: 0, min: 0 },
  tickets: { type: Number, default: 5, min: 0 },
  vipLevel: { type: Number, default: 0, min: 0, max: 15 },
  vipExperience: { type: Number, default: 0, min: 0 },
  vipTransactions: { type: [vipTransactionSchema], default: [] },
  heroes: [playerHeroSchema],
  formations: { type: [formationSchema], default: [] },
  activeFormationId: { type: String, default: null },
  fragments: { type: Map, of: Number, default: new Map() },
  materials: { type: Map, of: Number, default: new Map() },
  items: { type: Map, of: Number, default: new Map() },
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
  lastSeenAt: { type: Date, default: Date.now },
  lastAfkCollectAt: { type: Date, default: Date.now },
  lastDailyResetAt: { type: Date, default: Date.now },
  playtimeMinutes: { type: Number, default: 0, min: 0 },
  dailyMissionsCompleted: { type: Number, default: 0, min: 0 },
  weeklyMissionsCompleted: { type: Number, default: 0, min: 0 },
  eventParticipations: [{ type: String }],
  guildId: { type: String },
  friendsList: [{ type: String }],
  serverPurchases: { type: [serverPurchaseSchema], default: [] },
  totalSpentUSDOnServer: { type: Number, default: 0, min: 0 },
  isNewPlayer: { type: Boolean, default: true },
  tutorialCompleted: { type: Boolean, default: false },
  totalBattlesFought: { type: Number, default: 0, min: 0 },
  totalBattlesWon: { type: Number, default: 0, min: 0 },
  totalDamageDealt: { type: Number, default: 0, min: 0 },
  totalHeroesCollected: { type: Number, default: 0, min: 0 }
}, {
  timestamps: true,
  collection: 'players'
});

// Pas de virtuals
playerSchema.set('toJSON', { virtuals: false });
playerSchema.set('toObject', { virtuals: false });

// Index sur _id automatique (clé primaire), donc inutile sur playerId
playerSchema.index({ accountId: 1, serverId: 1 });
playerSchema.index({ serverId: 1 });

// Les statics et methods restent inchangés (tu peux adapter si tu supprimes playerId)
playerSchema.statics.findByAccount = function(accountId: string, serverId?: string) {
  const query: any = { accountId };
  if (serverId) query.serverId = serverId;
  return this.find(query);
};

playerSchema.statics.findByServer = function(serverId: string) {
  return this.find({ serverId });
};

playerSchema.statics.getServerLeaderboard = function(serverId: string, type: string = "level", limit: number = 100) {
  const sortField = type === "level" ? "level" : 
                   type === "vip" ? "vipLevel" :
                   type === "tower" ? "towerProgress.highestFloor" :
                   type === "spending" ? "totalSpentUSDOnServer" : "level";
  
  return this.find({ serverId })
    .sort({ [sortField]: -1 })
    .limit(limit)
    .select('displayName level vipLevel towerProgress.highestFloor totalSpentUSDOnServer');
};

playerSchema.statics.getActivePlayersOnServer = function(serverId: string, hoursAgo: number = 24) {
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return this.find({ serverId, lastSeenAt: { $gte: cutoff } });
};

playerSchema.methods.addHero = function(heroId: string, level: number = 1, stars: number = 1) {
  const existingHero = this.heroes.find((h: IPlayerHero) => h.heroId === heroId);
  if (existingHero) {
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
  
  this.heroes.forEach((h: IPlayerHero) => {
    h.slot = null;
    h.equipped = false;
  });
  
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
  
  const newLevel = Math.min(15, Math.floor(this.vipExperience / 1000));
  const leveledUp = newLevel > oldLevel;
  this.vipLevel = newLevel;
  
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
  switch (eventType) {
    case "newbie_event":
      return this.isNewPlayer;
    case "vip_event":
      return this.vipLevel >= 5;
    case "endgame_event":
      return this.level >= 100;
    default:
      return true;
  }
};

playerSchema.methods.calculatePowerScore = function() {
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
      level: this.level,
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
      lastLogin: this.lastSeenAt,
      accountAge: this.createdAt ? Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0
    }
  };
};

playerSchema.methods.needsDailyReset = function() {
  const now = new Date();
  const lastReset = new Date(this.lastDailyResetAt);
  
  return now.getDate() !== lastReset.getDate() || 
         now.getMonth() !== lastReset.getMonth() || 
         now.getFullYear() !== lastReset.getFullYear();
};

playerSchema.methods.performDailyReset = function() {
  this.dailyMissionsCompleted = 0;
  this.lastDailyResetAt = new Date();
  return this.save();
};

export default mongoose.model<IPlayerDocument>("Player", playerSchema);

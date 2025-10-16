import mongoose, { Document, Schema } from "mongoose";
import { IdGenerator } from "../utils/idGenerator";
import { achievementEmitter, AchievementEvent } from '../utils/AchievementEmitter';

// ----- Sous-interfaces -----
export interface IPlayerHero {
  _id?: mongoose.Types.ObjectId;
  heroId: string;
  level: number;
  stars: number;
  equipped: boolean;
  slot: number | null;
  experience: number;
  ascensionLevel: number;
  awakenLevel: number;
  acquisitionDate: Date;
  ascensionTier: number;      // 0-4 (0=non ascensionné, 1=palier 40, 2=palier 80, 3=palier 120, 4=palier 150)
  unlockedSpells: string[];   // ["level1", "level11", "level41", etc.]
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

// ✅ NOUVEAU : Interface pour tracker les pulls gratuits par bannière
export interface IFreePullTracker {
  bannerId: string;
  pullsUsed: number;
  pullsAvailable: number;
  lastResetAt: Date;
  nextResetAt: Date;
}

// ----- Interface principale SANS _id -----
export interface IPlayer {
  playerId: string;
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
  heroXP: number;
  ascensionEssences: number;
  elementalTickets: {
    fire: number;
    water: number;
    wind: number;
    electric: number;
    light: number;
    shadow: number;
  };
  freePulls: IFreePullTracker[]; // ✅ NOUVEAU
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

// ----- Document Mongoose -----
export interface IPlayerDocument extends Document, IPlayer {
  _id: string;
  addHero(heroId: string, level?: number, stars?: number): Promise<IPlayerDocument>;
  removeHero(heroId: string): Promise<IPlayerDocument>;
  upgradeHero(heroId: string, newLevel: number, newStars?: number): Promise<IPlayerDocument>;
  getEquippedHeroes(): IPlayerHero[];
  setFormation(formationId: string, slots: { slot: number, heroId: string }[]): Promise<IPlayerDocument>;
  canAfford(cost: { gold?: number, gems?: number, paidGems?: number, tickets?: number }): boolean;
  spendCurrency(cost: { gold?: number, gems?: number, paidGems?: number, tickets?: number }): Promise<IPlayerDocument>;
  addCurrency(currency: { gold?: number, gems?: number, paidGems?: number, tickets?: number }): Promise<IPlayerDocument>;
  addElementalTicket(element: string, quantity?: number): Promise<IPlayerDocument>;
  spendElementalTickets(element: string, quantity: number): Promise<IPlayerDocument>;
  hasElementalTickets(element: string, quantity: number): boolean;
  // ✅ NOUVEAU : Méthodes pour pulls gratuits
  getFreePullTracker(bannerId: string): IFreePullTracker | undefined;
  initializeFreePulls(bannerId: string, pullsAvailable: number, nextResetAt: Date): Promise<void>;
  useFreePull(bannerId: string, count?: number): Promise<boolean>;
  resetFreePulls(bannerId: string, pullsAvailable: number, nextResetAt: Date): Promise<void>;
  checkAndResetFreePulls(bannerId: string): Promise<boolean>;
  addVipExp(amount: number, source?: string, cost?: number): Promise<{ newLevel: number; leveledUp: boolean }>;
  addServerPurchase(purchase: IServerPurchase): Promise<IPlayerDocument>;
  updateProgress(type: string, value: number): Promise<IPlayerDocument>;
  isEligibleForEvent(eventType: string): boolean;
  calculatePowerScore(): number;
  getPlayerStats(): any;
  needsDailyReset(): boolean;
  performDailyReset(): Promise<IPlayerDocument>;
  canAffordHeroLevelUp(cost: { gold: number, heroXP: number }): boolean;
  spendHeroLevelUpResources(cost: { gold: number, heroXP: number }): Promise<IPlayerDocument>;
  addHeroXP(amount: number): Promise<IPlayerDocument>;
}

// ----- Schémas des sous-documents -----
const playerHeroSchema = new Schema<IPlayerHero>({
  heroId: { type: String, required: true },
  level: { type: Number, default: 1, min: 1, max: 100 },
  stars: { type: Number, default: 1, min: 1, max: 6 },
  equipped: { type: Boolean, default: false },
  slot: { type: Number, min: 1, max: 9, default: null },
  experience: { type: Number, default: 0, min: 0 },
  ascensionEssences: { type: Number, default: 0, min: 0 },
  ascensionLevel: { type: Number, default: 0, min: 0, max: 8 },
  awakenLevel: { type: Number, default: 0, min: 0, max: 5 },
  acquisitionDate: { type: Date, default: Date.now },
  ascensionTier: { type: Number, default: 0, min: 0, max: 4 },
  unlockedSpells: [{ type: String }]
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
  transactionId: { 
    type: String, 
    required: true,
    default: () => IdGenerator.generateTransactionId()
  },
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
  transactionId: { 
    type: String, 
    required: true,
    default: () => IdGenerator.generateTransactionId()
  },
  expGained: { type: Number, required: true, min: 0 },
  source: { type: String, enum: ["purchase", "event", "admin_grant"], required: true },
  cost: { type: Number, default: 0, min: 0 },
  timestamp: { type: Date, default: Date.now },
  levelBefore: { type: Number, required: true, min: 0 },
  levelAfter: { type: Number, required: true, min: 0 }
}, { _id: false });

// ----- Schéma principal -----
const playerSchema = new Schema<IPlayerDocument>({
  _id: {
    type: String,
    required: true,
    default: () => IdGenerator.generatePlayerId()
  },
  playerId: {
    type: String,
    required: true,
    default: function () { return this._id; }
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
  heroXP: { type: Number, default: 0, min: 0 },
  elementalTickets: {
    fire: { type: Number, default: 0, min: 0 },
    water: { type: Number, default: 0, min: 0 },
    wind: { type: Number, default: 0, min: 0 },
    electric: { type: Number, default: 0, min: 0 },
    light: { type: Number, default: 0, min: 0 },
    shadow: { type: Number, default: 0, min: 0 }
  },
  
  // ✅ NOUVEAU : Tracker des pulls gratuits par bannière
  freePulls: [{
    bannerId: {
      type: String,
      required: true,
      index: true
    },
    pullsUsed: {
      type: Number,
      default: 0,
      min: 0
    },
    pullsAvailable: {
      type: Number,
      default: 0,
      min: 0
    },
    lastResetAt: {
      type: Date,
      default: Date.now
    },
    nextResetAt: {
      type: Date,
      required: true
    }
  }],
  
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

// ----- Options et index -----
playerSchema.set('toJSON', { virtuals: false });
playerSchema.set('toObject', { virtuals: false });
playerSchema.index({ accountId: 1, serverId: 1 });
playerSchema.index({ serverId: 1 });
playerSchema.index({ "freePulls.bannerId": 1, "freePulls.nextResetAt": 1 });

// ----- Statics -----
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

// ----- Méthodes -----
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
    acquisitionDate: new Date(),
    ascensionTier: 0,
    unlockedSpells: ["level1"]  // Au niveau 1, seul le premier sort est débloqué
    
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

playerSchema.methods.canAfford = function(cost: { 
  gold?: number; 
  gems?: number; 
  paidGems?: number; 
  tickets?: number;
  heroXP?: number;
  ascensionEssence?: number;
}) {
  if (cost.gold && this.gold < cost.gold) return false;
  if (cost.gems && this.gems < cost.gems) return false;
  if (cost.paidGems && this.paidGems < cost.paidGems) return false;
  if (cost.tickets && this.tickets < cost.tickets) return false;
  if (cost.heroXP && this.heroXP < cost.heroXP) return false;
  if (cost.ascensionEssence && this.ascensionEssences < cost.ascensionEssence) return false;
  return true;
};

playerSchema.methods.spendCurrency = function(cost: { 
  gold?: number; 
  gems?: number; 
  paidGems?: number; 
  tickets?: number;
  heroXP?: number;
  ascensionEssence?: number;
}) {
  if (!this.canAfford(cost)) {
    throw new Error("Insufficient currency");
  }
  
  if (cost.gold) this.gold -= cost.gold;
  if (cost.gems) this.gems -= cost.gems;
  if (cost.paidGems) this.paidGems -= cost.paidGems;
  if (cost.tickets) this.tickets -= cost.tickets;
  if (cost.heroXP) this.heroXP -= cost.heroXP;
  if (cost.ascensionEssence) this.ascensionEssences -= cost.ascensionEssence;
  
  return this.save();
};

playerSchema.methods.addCurrency = function(currency: { 
  gold?: number; 
  gems?: number; 
  paidGems?: number; 
  tickets?: number;
  heroXP?: number;
  ascensionEssence?: number;
}) {
  if (currency.gold) this.gold += currency.gold;
  if (currency.gems) this.gems += currency.gems;
  if (currency.paidGems) this.paidGems += currency.paidGems;
  if (currency.tickets) this.tickets += currency.tickets;
  if (currency.heroXP) this.heroXP += currency.heroXP;
  if (currency.ascensionEssence) this.ascensionEssences += currency.ascensionEssence;
  
  return this.save();
};

playerSchema.methods.addElementalTicket = function(element: string, quantity: number = 1) {
  const elementKey = element.toLowerCase() as keyof typeof this.elementalTickets;
  
  if (!this.elementalTickets[elementKey] && this.elementalTickets[elementKey] !== 0) {
    throw new Error(`Invalid element: ${element}. Valid elements: fire, water, wind, electric, light, shadow`);
  }
  
  this.elementalTickets[elementKey] += quantity;
  
  console.log(`✅ Player ${this.displayName} gained ${quantity}x ${element} ticket(s). Total: ${this.elementalTickets[elementKey]}`);
  
  return this.save();
};

playerSchema.methods.spendElementalTickets = function(element: string, quantity: number) {
  const elementKey = element.toLowerCase() as keyof typeof this.elementalTickets;
  
  if (!this.elementalTickets[elementKey] && this.elementalTickets[elementKey] !== 0) {
    throw new Error(`Invalid element: ${element}`);
  }
  
  if (this.elementalTickets[elementKey] < quantity) {
    throw new Error(`Insufficient ${element} tickets. Required: ${quantity}, Available: ${this.elementalTickets[elementKey]}`);
  }
  
  this.elementalTickets[elementKey] -= quantity;
  
  console.log(`💎 Player ${this.displayName} spent ${quantity}x ${element} ticket(s). Remaining: ${this.elementalTickets[elementKey]}`);
  
  return this.save();
};

playerSchema.methods.hasElementalTickets = function(element: string, quantity: number): boolean {
  const elementKey = element.toLowerCase() as keyof typeof this.elementalTickets;
  
  if (!this.elementalTickets[elementKey] && this.elementalTickets[elementKey] !== 0) {
    return false;
  }
  
  return this.elementalTickets[elementKey] >= quantity;
};

// ===== MÉTHODES POUR PULLS GRATUITS ✅ NOUVEAU =====

/**
 * Obtenir le tracker de pulls gratuits pour une bannière
 */
playerSchema.methods.getFreePullTracker = function(bannerId: string): IFreePullTracker | undefined {
  return this.freePulls.find((fp: IFreePullTracker) => fp.bannerId === bannerId);
};

/**
 * Initialiser ou mettre à jour le tracker de pulls gratuits pour une bannière
 */
playerSchema.methods.initializeFreePulls = async function(
  bannerId: string, 
  pullsAvailable: number,
  nextResetAt: Date
): Promise<void> {
  const existing = this.getFreePullTracker(bannerId);
  
  if (existing) {
    // Mettre à jour
    existing.pullsAvailable = pullsAvailable;
    existing.nextResetAt = nextResetAt;
  } else {
    // Créer nouveau tracker
    this.freePulls.push({
      bannerId,
      pullsUsed: 0,
      pullsAvailable,
      lastResetAt: new Date(),
      nextResetAt
    });
  }
  
  await this.save();
};

/**
 * Utiliser un pull gratuit sur une bannière
 */
playerSchema.methods.useFreePull = async function(bannerId: string, count: number = 1): Promise<boolean> {
  const tracker = this.getFreePullTracker(bannerId);
  
  if (!tracker) {
    throw new Error(`No free pull tracker found for banner ${bannerId}`);
  }
  
  if (tracker.pullsAvailable < count) {
    return false; // Pas assez de pulls gratuits
  }
  
  tracker.pullsUsed += count;
  tracker.pullsAvailable -= count;
  
  await this.save();
  return true;
};

/**
 * Reset les pulls gratuits pour une bannière
 */
playerSchema.methods.resetFreePulls = async function(
  bannerId: string,
  pullsAvailable: number,
  nextResetAt: Date
): Promise<void> {
  const tracker = this.getFreePullTracker(bannerId);
  
  if (!tracker) {
    // Créer nouveau tracker si n'existe pas
    await this.initializeFreePulls(bannerId, pullsAvailable, nextResetAt);
    return;
  }
  
  tracker.pullsUsed = 0;
  tracker.pullsAvailable = pullsAvailable;
  tracker.lastResetAt = new Date();
  tracker.nextResetAt = nextResetAt;
  
  await this.save();
  
  console.log(`🔄 Free pulls reset for player ${this._id} on banner ${bannerId}: ${pullsAvailable} pulls available`);
};

/**
 * Vérifier si les pulls gratuits doivent être reset
 */
playerSchema.methods.checkAndResetFreePulls = async function(bannerId: string): Promise<boolean> {
  const tracker = this.getFreePullTracker(bannerId);
  
  if (!tracker) {
    return false;
  }
  
  const now = new Date();
  
  if (now >= tracker.nextResetAt) {
    return true; // Doit être reset
  }
  
  return false;
};

playerSchema.methods.addVipExp = function(amount: number, source: string = "purchase", cost: number = 0) {
  const oldLevel = this.vipLevel;
  this.vipExperience += amount;
  
  const newLevel = Math.min(15, Math.floor(this.vipExperience / 1000));
  const leveledUp = newLevel > oldLevel;
  this.vipLevel = newLevel;
  
  this.vipTransactions.push({
    transactionId: IdGenerator.generateTransactionId(),
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
      heroXP: this.heroXP,
      ascensionEssences: this.ascensionEssences,
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

// Middleware post-save pour achievements
playerSchema.post('save', function(doc) {
  if (this.isModified('world')) {
    achievementEmitter.emit(AchievementEvent.WORLD_REACHED, {
      playerId: doc._id.toString(),
      serverId: doc.serverId,
      value: doc.world
    });
  }
  
  if (this.isModified('towerProgress.highestFloor')) {
    achievementEmitter.emit(AchievementEvent.TOWER_FLOOR, {
      playerId: doc._id.toString(),
      serverId: doc.serverId,
      value: doc.towerProgress.highestFloor
    });
  }
});
// Vérifier si le joueur peut payer un level up
playerSchema.methods.canAffordHeroLevelUp = function(cost: { gold: number, heroXP: number }): boolean {
  if (this.gold < cost.gold) return false;
  if (this.heroXP < cost.heroXP) return false;
  return true;
};

// Dépenser les ressources pour level up
playerSchema.methods.spendHeroLevelUpResources = function(cost: { gold: number, heroXP: number }) {
  if (!this.canAffordHeroLevelUp(cost)) {
    throw new Error("Insufficient resources for hero level up");
  }
  
  this.gold -= cost.gold;
  this.heroXP -= cost.heroXP;
  
  return this.save();
};

// Ajouter de l'Hero XP
playerSchema.methods.addHeroXP = function(amount: number) {
  this.heroXP += amount;
  return this.save();
};

/**
 * Vérifier si le joueur peut payer un coût d'ascension
 */
playerSchema.methods.canAffordAscension = function(cost: { 
  gold: number; 
  heroXP: number; 
  ascensionEssence: number 
}): boolean {
  if (this.gold < cost.gold) return false;
  if (this.heroXP < cost.heroXP) return false;
  if (this.ascensionEssences < cost.ascensionEssence) return false;
  return true;
};

/**
 * Dépenser les ressources pour une ascension
 */
playerSchema.methods.spendAscensionResources = function(cost: { 
  gold: number; 
  heroXP: number; 
  ascensionEssence: number 
}) {
  if (!this.canAffordAscension(cost)) {
    throw new Error("Insufficient resources for ascension");
  }
  
  this.gold -= cost.gold;
  this.heroXP -= cost.heroXP;
  this.ascensionEssences -= cost.ascensionEssence;
  
  return this.save();
};

/**
 * Ajouter des essences d'ascension
 */
playerSchema.methods.addAscensionEssences = function(amount: number) {
  this.ascensionEssences += amount;
  console.log(`✅ Player ${this.displayName} gained ${amount} ascension essence(s). Total: ${this.ascensionEssences}`);
  return this.save();
};

/**
 * Dépenser des essences d'ascension
 */
playerSchema.methods.spendAscensionEssences = function(amount: number) {
  if (this.ascensionEssences < amount) {
    throw new Error(`Insufficient ascension essences. Required: ${amount}, Available: ${this.ascensionEssences}`);
  }
  
  this.ascensionEssences -= amount;
  console.log(`💎 Player ${this.displayName} spent ${amount} ascension essence(s). Remaining: ${this.ascensionEssences}`);
  
  return this.save();
};

/**
 * Vérifier si le joueur a assez d'essences
 */
playerSchema.methods.hasAscensionEssences = function(amount: number): boolean {
  return this.ascensionEssences >= amount;
};

/**
 * Obtenir un résumé des ressources de progression
 */
playerSchema.methods.getProgressionResources = function() {
  return {
    gold: this.gold,
    heroXP: this.heroXP,
    ascensionEssences: this.ascensionEssences,
    totalValue: {
      gold: this.gold,
      gems: this.heroXP * 0.1 + this.ascensionEssences * 2 // Valeur approximative en gems
    }
  };
};

export default mongoose.model<IPlayerDocument>("Player", playerSchema);






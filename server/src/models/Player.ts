import mongoose, { Document, Schema } from "mongoose";

// === INTERFACES NETTOYÉES ===

// Compétences d'un héros du joueur
interface IHeroSkills {
  skill1: number;    // Niveau 1-10
  skill2: number;    // Niveau 1-10
  skill3: number;    // Niveau 1-10
  ultimate: number;  // Niveau 1-5
}

// Héros possédé par le joueur (SANS équipement)
interface IPlayerHero {
  heroId: string;            // Référence vers Hero de base
  level: number;             // Niveau du héros (1-240)
  experience: number;        // XP accumulée
  ascension: number;         // Niveau d'ascension (0-5)
  stars: number;             // Étoiles d'ascension (0-5)
  
  // ❌ SUPPRIMÉ : equipment (maintenant dans Inventory)
  
  // Formation
  isActive: boolean;         // Dans l'équipe active
  position?: number;         // Position dans l'équipe (1-5)
  
  // Progression des compétences
  skillLevels: IHeroSkills;
  
  // Métadonnées
  acquiredDate: Date;
  lastUsedDate?: Date;
}

// Progression campagne
interface ICampaignProgress {
  currentWorld: number;      // Monde actuel
  currentLevel: number;      // Niveau actuel
  maxWorld: number;          // Monde maximum atteint
  maxLevel: number;          // Niveau maximum atteint
  difficulty: "Normal" | "Hard" | "Nightmare";
}

// Activités du joueur
interface IPlayerActivities {
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
}

// Statistiques générales du joueur
interface IPlayerStatistics {
  totalPlayTime: number;           // En secondes
  heroesUnlocked: number;
  battlesWon: number;
  questsCompleted: number;
  campaignLevelsCleared: number;
  firstLoginDate: Date;
  lastActivityDate: Date;
}

// Récompenses AFK
interface IAfkRewards {
  lastClaimTime: Date;
  accumulatedTime: number;     // Temps AFK en secondes
  maxStorageHours: number;     // Capacité stockage (bonus VIP)
}

// Document Player nettoyé
interface IPlayerDocument extends Document {
  // ✅ IDENTIFICATION
  accountId: string;         // Référence vers Account
  serverId: string;          // Serveur du joueur
  playerName: string;        // Nom du joueur
  
  // ✅ PROGRESSION PRINCIPALE
  level: number;             // Niveau joueur (1-500)
  experience: number;        // XP du joueur
  vipLevel: number;          // Niveau VIP (0-15)
  vipExperience: number;     // XP VIP
  
  // ✅ PROGRESSION CAMPAGNE
  campaignProgress: ICampaignProgress;
  
  // ✅ COLLECTION HÉROS (sans équipement)
  heroes: IPlayerHero[];
  
  // ✅ RÉCOMPENSES AFK
  afkRewards: IAfkRewards;
  
  // ✅ ACTIVITÉS
  activities: IPlayerActivities;
  
  // ✅ STATISTIQUES
  statistics: IPlayerStatistics;
  
  // Métadonnées
  createdAt: Date;
  lastLoginAt: Date;
  lastSaveAt: Date;
  
  // === MÉTHODES HÉROS ===
  addHero(heroId: string): Promise<IPlayerHero>;
  getHero(heroId: string): IPlayerHero | null;
  removeHero(heroId: string): Promise<boolean>;
  levelUpHero(heroId: string, levels: number): Promise<boolean>;
  ascendHero(heroId: string): Promise<boolean>;
  upgradeHeroSkill(heroId: string, skill: string, newLevel: number): Promise<boolean>;
  
  // === MÉTHODES PROGRESSION ===
  advanceCampaign(world: number, level: number): Promise<boolean>;
  addExperience(amount: number): Promise<boolean>;
  addVipExperience(amount: number): Promise<boolean>;
  
  // === MÉTHODES FORMATION ===
  setHeroActive(heroId: string, isActive: boolean): Promise<boolean>;
  setHeroPosition(heroId: string, position: number): Promise<boolean>;
  getActiveHeroes(): IPlayerHero[];
  
  // === MÉTHODES UTILITAIRES ===
  updateStatistics(): Promise<void>;
  getPlayerSummary(): any;
}

// === SCHÉMAS MONGOOSE ===

// Schéma des compétences héros
const heroSkillsSchema = new Schema<IHeroSkills>({
  skill1: { type: Number, min: 1, max: 10, default: 1 },
  skill2: { type: Number, min: 1, max: 10, default: 1 },
  skill3: { type: Number, min: 1, max: 10, default: 1 },
  ultimate: { type: Number, min: 1, max: 5, default: 1 }
}, { _id: false });

// Schéma d'un héros du joueur (nettoyé)
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
  
  // ❌ SUPPRIMÉ : equipment (maintenant dans Inventory)
  
  // Formation
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
    type: heroSkillsSchema, 
    default: () => ({
      skill1: 1,
      skill2: 1,
      skill3: 1,
      ultimate: 1
    })
  },
  
  // Métadonnées
  acquiredDate: { 
    type: Date, 
    default: Date.now 
  },
  lastUsedDate: { type: Date }
}, { _id: false });

// Schéma progression campagne
const campaignProgressSchema = new Schema<ICampaignProgress>({
  currentWorld: { type: Number, min: 1, max: 20, default: 1 },
  currentLevel: { type: Number, min: 1, max: 30, default: 1 },
  maxWorld: { type: Number, min: 1, max: 20, default: 1 },
  maxLevel: { type: Number, min: 1, max: 30, default: 1 },
  difficulty: { 
    type: String, 
    enum: ["Normal", "Hard", "Nightmare"],
    default: "Normal"
  }
}, { _id: false });

// Schéma activités
const playerActivitiesSchema = new Schema<IPlayerActivities>({
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
}, { _id: false });

// Schéma statistiques
const playerStatisticsSchema = new Schema<IPlayerStatistics>({
  totalPlayTime: { type: Number, default: 0 },
  heroesUnlocked: { type: Number, default: 0 },
  battlesWon: { type: Number, default: 0 },
  questsCompleted: { type: Number, default: 0 },
  campaignLevelsCleared: { type: Number, default: 0 },
  firstLoginDate: { type: Date, default: Date.now },
  lastActivityDate: { type: Date, default: Date.now }
}, { _id: false });

// Schéma récompenses AFK
const afkRewardsSchema = new Schema<IAfkRewards>({
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
}, { _id: false });

// Schéma principal du Player (nettoyé)
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
    type: campaignProgressSchema,
    default: () => ({
      currentWorld: 1,
      currentLevel: 1,
      maxWorld: 1,
      maxLevel: 1,
      difficulty: "Normal"
    })
  },
  
  // ✅ COLLECTION HÉROS (sans équipement)
  heroes: [playerHeroSchema],
  
  // ✅ RÉCOMPENSES AFK
  afkRewards: {
    type: afkRewardsSchema,
    default: () => ({
      lastClaimTime: new Date(),
      accumulatedTime: 0,
      maxStorageHours: 12
    })
  },
  
  // ✅ ACTIVITÉS
  activities: {
    type: playerActivitiesSchema,
    default: () => ({
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
    })
  },
  
  // ✅ STATISTIQUES
  statistics: {
    type: playerStatisticsSchema,
    default: () => ({
      totalPlayTime: 0,
      heroesUnlocked: 0,
      battlesWon: 0,
      questsCompleted: 0,
      campaignLevelsCleared: 0,
      firstLoginDate: new Date(),
      lastActivityDate: new Date()
    })
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

// === MIDDLEWARE ===

// Validation et mise à jour avant sauvegarde
playerSchema.pre('save', function(next) {
  // Mettre à jour les statistiques automatiquement
  this.statistics.heroesUnlocked = this.heroes.length;
  this.statistics.lastActivityDate = new Date();
  
  // Calculer niveaux campagne terminés
  this.statistics.campaignLevelsCleared = 
    (this.campaignProgress.maxWorld - 1) * 30 + this.campaignProgress.maxLevel;
  
  // Mettre à jour bonus VIP pour AFK rewards
  this.afkRewards.maxStorageHours = Math.min(12 + this.vipLevel, 24);
  
  // S'assurer qu'il n'y a pas plus de 5 héros actifs
  const activeHeroes = this.heroes.filter(h => h.isActive);
  if (activeHeroes.length > 5) {
    // Désactiver les héros en surplus
    const excess = activeHeroes.slice(5);
    excess.forEach(hero => {
      hero.isActive = false;
      hero.position = undefined;
    });
  }
  
  next();
});

// === MÉTHODES STATIQUES ===

// Créer un nouveau joueur
playerSchema.statics.createNewPlayer = async function(
  accountId: string, 
  serverId: string, 
  playerName: string
) {
  const player = new this({
    accountId,
    serverId,
    playerName,
    level: 1,
    experience: 0,
    vipLevel: 0,
    vipExperience: 0,
    heroes: [],
    campaignProgress: {
      currentWorld: 1,
      currentLevel: 1,
      maxWorld: 1,
      maxLevel: 1,
      difficulty: "Normal"
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
      battlesWon: 0,
      questsCompleted: 0,
      campaignLevelsCleared: 0,
      firstLoginDate: new Date(),
      lastActivityDate: new Date()
    }
  });
  
  return await player.save();
};

// Trouver par compte et serveur
playerSchema.statics.findByAccountAndServer = function(accountId: string, serverId: string) {
  return this.findOne({ accountId, serverId });
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
  await this.save();
  return newHero;
};

// Obtenir un héros
playerSchema.methods.getHero = function(heroId: string): IPlayerHero | null {
  return this.heroes.find(h => h.heroId === heroId) || null;
};

// Supprimer un héros
playerSchema.methods.removeHero = async function(heroId: string): Promise<boolean> {
  const heroIndex = this.heroes.findIndex(h => h.heroId === heroId);
  
  if (heroIndex === -1) {
    return false;
  }
  
  this.heroes.splice(heroIndex, 1);
  await this.save();
  return true;
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
  hero.lastUsedDate = new Date();
  
  await this.save();
  return true;
};

// Ascension d'un héros
playerSchema.methods.ascendHero = async function(heroId: string): Promise<boolean> {
  const hero = this.getHero(heroId);
  
  if (!hero || hero.ascension >= 5) {
    return false;
  }
  
  hero.ascension++;
  hero.lastUsedDate = new Date();
  
  await this.save();
  return true;
};

// Améliorer une compétence de héros
playerSchema.methods.upgradeHeroSkill = async function(
  heroId: string, 
  skill: string, 
  newLevel: number
): Promise<boolean> {
  const hero = this.getHero(heroId);
  
  if (!hero) {
    return false;
  }
  
  const currentLevel = (hero.skillLevels as any)[skill];
  if (!currentLevel || newLevel <= currentLevel) {
    return false;
  }
  
  const maxLevel = skill === 'ultimate' ? 5 : 10;
  if (newLevel > maxLevel) {
    return false;
  }
  
  (hero.skillLevels as any)[skill] = newLevel;
  hero.lastUsedDate = new Date();
  
  await this.save();
  return true;
};

// === MÉTHODES D'INSTANCE (Formation) ===

// Activer/désactiver un héros
playerSchema.methods.setHeroActive = async function(
  heroId: string, 
  isActive: boolean
): Promise<boolean> {
  const hero = this.getHero(heroId);
  
  if (!hero) {
    return false;
  }
  
  // Vérifier qu'on ne dépasse pas 5 héros actifs
  if (isActive) {
    const activeCount = this.heroes.filter(h => h.isActive).length;
    if (activeCount >= 5) {
      return false;
    }
  }
  
  hero.isActive = isActive;
  if (!isActive) {
    hero.position = undefined;
  }
  
  await this.save();
  return true;
};

// Définir la position d'un héros
playerSchema.methods.setHeroPosition = async function(
  heroId: string, 
  position: number
): Promise<boolean> {
  const hero = this.getHero(heroId);
  
  if (!hero || !hero.isActive || position < 1 || position > 5) {
    return false;
  }
  
  // Vérifier que la position n'est pas déjà prise
  const heroAtPosition = this.heroes.find(h => h.position === position);
  if (heroAtPosition && heroAtPosition.heroId !== heroId) {
    heroAtPosition.position = undefined;
  }
  
  hero.position = position;
  
  await this.save();
  return true;
};

// Obtenir les héros actifs
playerSchema.methods.getActiveHeroes = function(): IPlayerHero[] {
  return this.heroes.filter(h => h.isActive).sort((a, b) => {
    if (a.position && b.position) return a.position - b.position;
    if (a.position) return -1;
    if (b.position) return 1;
    return 0;
  });
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
  
  // Calculer le niveau basé sur l'expérience (formule simple)
  const newLevel = Math.floor(this.experience / 1000) + 1;
  
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
  
  // Calculer le niveau VIP basé sur l'expérience (plus coûteux)
  const newVipLevel = Math.floor(this.vipExperience / 10000);
  
  if (newVipLevel > this.vipLevel && newVipLevel <= 15) {
    this.vipLevel = newVipLevel;
    
    // Mettre à jour les bonus VIP
    this.afkRewards.maxStorageHours = Math.min(12 + this.vipLevel, 24);
  }
  
  await this.save();
  return true;
};

// === MÉTHODES D'INSTANCE (Utilitaires) ===

// Mettre à jour les statistiques
playerSchema.methods.updateStatistics = async function(): Promise<void> {
  this.statistics.heroesUnlocked = this.heroes.length;
  this.statistics.lastActivityDate = new Date();
  this.statistics.campaignLevelsCleared = 
    (this.campaignProgress.maxWorld - 1) * 30 + this.campaignProgress.maxLevel;
  
  await this.save();
};

// Obtenir un résumé du joueur
playerSchema.methods.getPlayerSummary = function(): any {
  return {
    playerId: this._id,
    playerName: this.playerName,
    level: this.level,
    vipLevel: this.vipLevel,
    campaignProgress: this.campaignProgress,
    heroCount: this.heroes.length,
    activeHeroCount: this.heroes.filter(h => h.isActive).length,
    statistics: this.statistics,
    lastLogin: this.lastLoginAt || this.updatedAt
  };
};

export default mongoose.model<IPlayerDocument>("Player", playerSchema);

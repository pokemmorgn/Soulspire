import mongoose, { Document, Schema } from "mongoose";

// Interface pour les récompenses de mission
export interface IMissionReward {
  type: "currency" | "hero" | "equipment" | "material" | "fragment" | "ticket" | "title";
  quantity: number;
  
  // Données spécifiques selon le type
  currencyType?: "gold" | "gems" | "paidGems" | "tickets";
  heroId?: string;
  materialId?: string;
  fragmentHeroId?: string;
  equipmentData?: {
    type: "Weapon" | "Armor" | "Accessory";
    rarity: "Common" | "Rare" | "Epic" | "Legendary";
    level: number;
  };
  titleData?: {
    titleId: string;
    name: string;
    description: string;
  };
}

// Interface pour les conditions de mission
export interface IMissionCondition {
  type: "battle_wins" | "tower_floors" | "gacha_pulls" | "login" | "gold_spent" | "level_reached" | "heroes_owned" | "daily_missions_completed";
  targetValue: number;
  
  // Conditions spécifiques
  battleConditions?: {
    battleType?: "campaign" | "arena" | "tower";
    difficulty?: "Normal" | "Hard" | "Nightmare";
    winRequired?: boolean;
    minWorld?: number;
  };
  
  heroConditions?: {
    rarity?: "Common" | "Rare" | "Epic" | "Legendary";
    minLevel?: number;
    minStars?: number;
  };
}

// Interface pour une mission template
export interface IMissionTemplate {
  _id?: string;
  missionId: string;
  name: string;
  description: string;
  type: "daily" | "weekly" | "achievement";
  category: "battle" | "progression" | "collection" | "social" | "login";
  
  // Conditions pour compléter la mission
  condition: IMissionCondition;
  
  // Récompenses
  rewards: IMissionReward[];
  
  // Paramètres
  priority: number; // 1-10, pour l'ordre d'affichage
  isActive: boolean;
  minPlayerLevel: number;
  maxPlayerLevel?: number; // null = pas de limite
  
  // Probabilité d'apparition (pour les missions aléatoires)
  spawnWeight: number; // 1-100
  
  // Icône et affichage
  iconUrl?: string;
  bannerUrl?: string;
  tags: string[];
}

// Interface pour la progression d'une mission par un joueur
export interface IPlayerMissionProgress {
  missionId: string;
  templateId: string; // Référence au template
  name: string;
  description: string;
  type: "daily" | "weekly" | "achievement";
  category: string;
  
  // Progression
  currentValue: number;
  targetValue: number;
  isCompleted: boolean;
  completedAt?: Date;
  isRewardClaimed: boolean;
  claimedAt?: Date;
  
  // Récompenses
  rewards: IMissionReward[];
  
  // Métadonnées
  assignedAt: Date;
  expiresAt?: Date; // null pour les achievements
  priority: number;
}

// Interface pour les missions d'un joueur
export interface IPlayerMissions {
  _id?: string;
  playerId: string;
  serverId: string;
  
  // Missions actuelles
  dailyMissions: IPlayerMissionProgress[];
  weeklyMissions: IPlayerMissionProgress[];
  achievements: IPlayerMissionProgress[];
  
  // Statistiques et progression
  stats: {
    totalDailyCompleted: number;
    totalWeeklyCompleted: number;
    totalAchievementsCompleted: number;
    currentDailyStreak: number;
    longestDailyStreak: number;
    lastDailyReset: Date;
    lastWeeklyReset: Date;
  };
  
  // Dates de reset
  nextDailyReset: Date;
  nextWeeklyReset: Date;
  
  // Configuration
  timezone: string;
  isActive: boolean;
}

interface IMissionTemplateDocument extends Document {
  missionId: string;
  name: string;
  description: string;
  type: "daily" | "weekly" | "achievement";
  category: "battle" | "progression" | "collection" | "social" | "login";
  condition: IMissionCondition;
  rewards: IMissionReward[];
  priority: number;
  isActive: boolean;
  minPlayerLevel: number;
  maxPlayerLevel?: number;
  spawnWeight: number;
  iconUrl?: string;
  bannerUrl?: string;
  tags: string[];
}

interface IPlayerMissionsDocument extends Document {
  playerId: string;
  serverId: string;
  dailyMissions: IPlayerMissionProgress[];
  weeklyMissions: IPlayerMissionProgress[];
  achievements: IPlayerMissionProgress[];
  stats: {
    totalDailyCompleted: number;
    totalWeeklyCompleted: number;
    totalAchievementsCompleted: number;
    currentDailyStreak: number;
    longestDailyStreak: number;
    lastDailyReset: Date;
    lastWeeklyReset: Date;
  };
  nextDailyReset: Date;
  nextWeeklyReset: Date;
  timezone: string;
  isActive: boolean;
  
  // Méthodes d'instance
  needsDailyReset(): boolean;
  needsWeeklyReset(): boolean;
  generateDailyMissions(templates: IMissionTemplateDocument[], count: number): Promise<IPlayerMissionsDocument>;
  generateWeeklyMissions(templates: IMissionTemplateDocument[], count: number): Promise<IPlayerMissionsDocument>;
  updateProgress(missionType: string, conditionType: string, value: number, additionalData?: any): Promise<{ updated: boolean; completed: string[] }>;
  claimRewards(missionId: string): Promise<{ success: boolean; rewards: IMissionReward[] }>;
  calculateNextResets(): void;
}

// Schémas Mongoose
const missionRewardSchema = new Schema<IMissionReward>({
  type: { 
    type: String, 
    enum: ["currency", "hero", "equipment", "material", "fragment", "ticket", "title"],
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true,
    min: 1
  },
  currencyType: { 
    type: String, 
    enum: ["gold", "gems", "paidGems", "tickets"]
  },
  heroId: { type: String },
  materialId: { type: String },
  fragmentHeroId: { type: String },
  equipmentData: {
    type: { type: String, enum: ["Weapon", "Armor", "Accessory"] },
    rarity: { type: String, enum: ["Common", "Rare", "Epic", "Legendary"] },
    level: { type: Number, min: 1, max: 100, default: 1 }
  },
  titleData: {
    titleId: { type: String },
    name: { type: String },
    description: { type: String }
  }
});

const missionConditionSchema = new Schema<IMissionCondition>({
  type: { 
    type: String, 
    enum: ["battle_wins", "tower_floors", "gacha_pulls", "login", "gold_spent", "level_reached", "heroes_owned", "daily_missions_completed"],
    required: true 
  },
  targetValue: { 
    type: Number, 
    required: true,
    min: 1
  },
  battleConditions: {
    battleType: { type: String, enum: ["campaign", "arena", "tower"] },
    difficulty: { type: String, enum: ["Normal", "Hard", "Nightmare"] },
    winRequired: { type: Boolean, default: true },
    minWorld: { type: Number, min: 1 }
  },
  heroConditions: {
    rarity: { type: String, enum: ["Common", "Rare", "Epic", "Legendary"] },
    minLevel: { type: Number, min: 1, max: 100 },
    minStars: { type: Number, min: 1, max: 6 }
  }
});

const missionTemplateSchema = new Schema<IMissionTemplateDocument>({
  missionId: { 
    type: String, 
    required: true, 
    unique: true,
    match: /^[a-zA-Z0-9_-]+$/
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String, 
    required: true,
    maxlength: 300
  },
  type: { 
    type: String, 
    enum: ["daily", "weekly", "achievement"],
    required: true 
  },
  category: { 
    type: String, 
    enum: ["battle", "progression", "collection", "social", "login"],
    required: true 
  },
  
  condition: missionConditionSchema,
  rewards: [missionRewardSchema],
  
  priority: { 
    type: Number, 
    default: 5,
    min: 1,
    max: 10
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  minPlayerLevel: { 
    type: Number, 
    default: 1,
    min: 1
  },
  maxPlayerLevel: { 
    type: Number,
    min: 1
  },
  spawnWeight: { 
    type: Number, 
    default: 50,
    min: 1,
    max: 100
  },
  
  iconUrl: { 
    type: String,
    match: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i
  },
  bannerUrl: { 
    type: String,
    match: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i
  },
  tags: [{ 
    type: String,
    lowercase: true,
    trim: true
  }]
}, {
  timestamps: true,
  collection: 'missiontemplates'
});

const playerMissionProgressSchema = new Schema<IPlayerMissionProgress>({
  missionId: { type: String, required: true },
  templateId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
    enum: ["daily", "weekly", "achievement"],
    required: true 
  },
  category: { type: String, required: true },
  
  currentValue: { type: Number, default: 0, min: 0 },
  targetValue: { type: Number, required: true, min: 1 },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
  isRewardClaimed: { type: Boolean, default: false },
  claimedAt: { type: Date },
  
  rewards: [missionRewardSchema],
  
  assignedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  priority: { type: Number, default: 5 }
});

const playerMissionsSchema = new Schema<IPlayerMissionsDocument>({
  playerId: { 
    type: String, 
    required: true 
  },
  serverId: { 
    type: String,
    required: true,
    match: /^S\d+$/
  },
  
  dailyMissions: [playerMissionProgressSchema],
  weeklyMissions: [playerMissionProgressSchema],
  achievements: [playerMissionProgressSchema],
  
  stats: {
    totalDailyCompleted: { type: Number, default: 0, min: 0 },
    totalWeeklyCompleted: { type: Number, default: 0, min: 0 },
    totalAchievementsCompleted: { type: Number, default: 0, min: 0 },
    currentDailyStreak: { type: Number, default: 0, min: 0 },
    longestDailyStreak: { type: Number, default: 0, min: 0 },
    lastDailyReset: { type: Date, default: Date.now },
    lastWeeklyReset: { type: Date, default: Date.now }
  },
  
  nextDailyReset: { 
    type: Date, 
    required: true,
    default: function() {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    }
  },
  nextWeeklyReset: { 
    type: Date, 
    required: true,
    default: function() {
      const nextMonday = new Date();
      const daysUntilMonday = (7 - nextMonday.getDay() + 1) % 7 || 7;
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
      nextMonday.setHours(0, 0, 0, 0);
      return nextMonday;
    }
  },
  
  timezone: { 
    type: String, 
    default: "UTC",
    match: /^[A-Za-z]+\/[A-Za-z_]+$|^UTC$/
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: true,
  collection: 'playermissions'
});

// Index pour optimiser les requêtes
missionTemplateSchema.index({ type: 1, isActive: 1 });
missionTemplateSchema.index({ category: 1 });
missionTemplateSchema.index({ priority: -1 });

playerMissionsSchema.index({ playerId: 1, serverId: 1 }, { unique: true });
playerMissionsSchema.index({ nextDailyReset: 1 });
playerMissionsSchema.index({ nextWeeklyReset: 1 });

// Méthodes statiques
missionTemplateSchema.statics.getActiveTemplates = function(type: "daily" | "weekly" | "achievement", playerLevel: number) {
  return this.find({
    type,
    isActive: true,
    minPlayerLevel: { $lte: playerLevel },
    $or: [
      { maxPlayerLevel: { $exists: false } },
      { maxPlayerLevel: null },
      { maxPlayerLevel: { $gte: playerLevel } }
    ]
  }).sort({ priority: -1, spawnWeight: -1 });
};

// Méthodes d'instance PlayerMissions
playerMissionsSchema.methods.needsDailyReset = function(): boolean {
  return new Date() >= this.nextDailyReset;
};

playerMissionsSchema.methods.needsWeeklyReset = function(): boolean {
  return new Date() >= this.nextWeeklyReset;
};

playerMissionsSchema.methods.generateDailyMissions = function(templates: IMissionTemplateDocument[], count: number) {
  console.log(`🎯 Génération de ${count} missions quotidiennes pour ${this.playerId}`);
  
  // Mélanger et sélectionner les templates selon leur poids
  const weightedTemplates = [];
  for (const template of templates) {
    for (let i = 0; i < template.spawnWeight; i++) {
      weightedTemplates.push(template);
    }
  }
  
  // Sélectionner aléatoirement sans doublons
  const selectedTemplates = [];
  const usedTemplateIds = new Set();
  
  while (selectedTemplates.length < count && selectedTemplates.length < templates.length) {
    const randomTemplate = weightedTemplates[Math.floor(Math.random() * weightedTemplates.length)];
    if (!usedTemplateIds.has(randomTemplate.missionId)) {
      selectedTemplates.push(randomTemplate);
      usedTemplateIds.add(randomTemplate.missionId);
    }
  }
  
  // Créer les missions
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);
  
  this.dailyMissions = selectedTemplates.map((template, index) => ({
    missionId: `daily_${this.playerId}_${template.missionId}_${Date.now()}_${index}`,
    templateId: template.missionId,
    name: template.name,
    description: template.description,
    type: "daily" as const,
    category: template.category,
    currentValue: 0,
    targetValue: template.condition.targetValue,
    isCompleted: false,
    isRewardClaimed: false,
    rewards: template.rewards,
    assignedAt: new Date(),
    expiresAt: tomorrow,
    priority: template.priority
  }));
  
  this.calculateNextResets();
  return this.save();
};

playerMissionsSchema.methods.generateWeeklyMissions = function(templates: IMissionTemplateDocument[], count: number) {
  console.log(`📅 Génération de ${count} missions hebdomadaires pour ${this.playerId}`);
  
  // Même logique que les quotidiennes mais avec expiration à la fin de semaine
  const selectedTemplates = templates.slice(0, count);
  
  const nextSunday = new Date();
  const daysUntilSunday = (7 - nextSunday.getDay()) % 7;
  nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
  nextSunday.setHours(23, 59, 59, 999);
  
  this.weeklyMissions = selectedTemplates.map((template, index) => ({
    missionId: `weekly_${this.playerId}_${template.missionId}_${Date.now()}_${index}`,
    templateId: template.missionId,
    name: template.name,
    description: template.description,
    type: "weekly" as const,
    category: template.category,
    currentValue: 0,
    targetValue: template.condition.targetValue,
    isCompleted: false,
    isRewardClaimed: false,
    rewards: template.rewards,
    assignedAt: new Date(),
    expiresAt: nextSunday,
    priority: template.priority
  }));
  
  this.calculateNextResets();
  return this.save();
};

playerMissionsSchema.methods.updateProgress = function(
  missionType: string, 
  conditionType: string, 
  value: number, 
  additionalData?: any
) {
  const missions = this[missionType as keyof IPlayerMissionsDocument] as IPlayerMissionProgress[];
  if (!missions || !Array.isArray(missions)) {
    return Promise.resolve({ updated: false, completed: [] });
  }
  
  const completed: string[] = [];
  let updated = false;
  
  for (const mission of missions) {
    if (mission.isCompleted) continue;
    
    // Vérifier si cette mission correspond au type de condition
    if (this.missionMatchesCondition(mission, conditionType, additionalData)) {
      mission.currentValue += value;
      updated = true;
      
      // Vérifier si la mission est complétée
      if (mission.currentValue >= mission.targetValue) {
        mission.isCompleted = true;
        mission.completedAt = new Date();
        completed.push(mission.missionId);
        
        // Mettre à jour les statistiques
        if (missionType === 'dailyMissions') {
          this.stats.totalDailyCompleted += 1;
        } else if (missionType === 'weeklyMissions') {
          this.stats.totalWeeklyCompleted += 1;
        } else if (missionType === 'achievements') {
          this.stats.totalAchievementsCompleted += 1;
        }
      }
    }
  }
  
  return this.save().then(() => ({ updated, completed }));
};

playerMissionsSchema.methods.missionMatchesCondition = function(
  mission: IPlayerMissionProgress, 
  conditionType: string, 
  additionalData?: any
): boolean {
  // Récupérer le template pour avoir les conditions
  // Pour simplifier, on suppose que le conditionType correspond directement
  // Dans une vraie implémentation, il faudrait charger le template
  
  // Logique simplifiée basée sur les types de mission communs
  const missionConditionMap: { [key: string]: string[] } = {
    'battle_wins': ['battle'],
    'tower_floors': ['progression'],
    'gacha_pulls': ['collection'],
    'login': ['login'],
    'gold_spent': ['progression'],
    'level_reached': ['progression'],
    'heroes_owned': ['collection'],
    'daily_missions_completed': ['progression']
  };
  
  const validCategories = missionConditionMap[conditionType] || [];
  return validCategories.includes(mission.category);
};

playerMissionsSchema.methods.claimRewards = function(missionId: string) {
  // Chercher dans toutes les catégories
  let targetMission: IPlayerMissionProgress | null = null;
  
  for (const missionType of ['dailyMissions', 'weeklyMissions', 'achievements']) {
    const missions = this[missionType as keyof IPlayerMissionsDocument] as IPlayerMissionProgress[];
    if (missions && Array.isArray(missions)) {
      targetMission = missions.find((m: any) => m.missionId === missionId) || null;
      if (targetMission) break;
    }
  }
  
  if (!targetMission) {
    return Promise.resolve({ success: false, rewards: [] });
  }
  
  if (!targetMission.isCompleted) {
    return Promise.resolve({ success: false, rewards: [] });
  }
  
  if (targetMission.isRewardClaimed) {
    return Promise.resolve({ success: false, rewards: [] });
  }
  
  targetMission.isRewardClaimed = true;
  targetMission.claimedAt = new Date();
  
  return this.save().then(() => ({
    success: true,
    rewards: targetMission!.rewards
  }));
};

playerMissionsSchema.methods.calculateNextResets = function() {
  const now = new Date();
  
  // Prochain reset quotidien
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  this.nextDailyReset = tomorrow;
  
  // Prochain reset hebdomadaire (lundi)
  const nextMonday = new Date(now);
  const daysUntilMonday = (7 - nextMonday.getDay() + 1) % 7 || 7;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  this.nextWeeklyReset = nextMonday;
};

export const MissionTemplate = mongoose.model<IMissionTemplateDocument>("MissionTemplate", missionTemplateSchema);
export const PlayerMissions = mongoose.model<IPlayerMissionsDocument>("PlayerMissions", playerMissionsSchema);

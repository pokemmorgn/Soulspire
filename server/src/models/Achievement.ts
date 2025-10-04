// server/src/models/Achievement.ts
import mongoose, { Document, Schema } from "mongoose";

/**
 * Catégories d'achievements pour organisation
 */
export type AchievementCategory = 
  | "progression"    // Avancement dans le jeu (mondes, tour, etc.)
  | "collection"     // Collection de héros
  | "combat"         // Performances en combat
  | "social"         // Interactions sociales
  | "economy"        // Gestion de ressources
  | "ranking"        // Classements et compétition
  | "special";       // Événements spéciaux

/**
 * Types d'achievements selon leur mécanique
 */
export type AchievementType =
  | "milestone"      // Atteindre un objectif précis (ex: Monde 3)
  | "first"          // Premier joueur à faire X (unique)
  | "leaderboard"    // Classement continu (Top 100)
  | "cumulative"     // Accumuler X au total (ex: 1000 combats)
  | "speed"          // Faire X en moins de Y temps
  | "challenge";     // Défis spéciaux avec conditions

/**
 * Rareté des achievements (affecte récompenses et prestige)
 */
export type AchievementRarity =
  | "common"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

/**
 * Critère de déblocage d'un achievement
 * Permet de définir des conditions complexes
 */
export interface IAchievementCriteria {
  type: string;                    // "world_reached", "tower_floor", "hero_count", etc.
  target: number;                  // Valeur cible à atteindre
  comparison: "=" | ">=" | "<=" | ">" | "<";  // Type de comparaison
  metadata?: {                     // Filtres additionnels
    worldId?: number;
    difficulty?: string;
    element?: string;
    rarity?: string;
    battleType?: string;
    [key: string]: any;
  };
}

/**
 * Récompenses pour déblocage d'achievement
 */
export interface IAchievementReward {
  gold?: number;
  gems?: number;
  tickets?: number;
  items?: string[];
  fragments?: { heroId: string; quantity: number }[];
  
  // Récompenses cosmétiques
  title?: string;                  // Titre déblocable (ex: "World Pioneer")
  avatar?: string;                 // Avatar frame
  background?: string;             // Background de profil
  badge?: string;                  // Badge à afficher
}

/**
 * Document principal Achievement
 */
export interface IAchievement extends Document {
  achievementId: string;
  name: string;
  description: string;
  
  // Classification
  category: AchievementCategory;
  type: AchievementType;
  rarity: AchievementRarity;
  
  // Critères de déblocage (AND logic entre critères)
  criteria: IAchievementCriteria[];
  
  // Récompenses
  rewards: IAchievementReward;
  
  // Pour les achievements "first" (premier joueur)
  isUnique: boolean;
  firstPlayerToComplete?: string;   // PlayerId du premier
  firstPlayerName?: string;          // DisplayName pour affichage
  completedAt?: Date;                // Quand le premier l'a obtenu
  
  // Pour les leaderboards
  isLeaderboard: boolean;
  leaderboardLimit?: number;         // Top X joueurs (ex: 100)
  leaderboardRefreshInterval?: number; // Intervalle de refresh (ms)
  
  // Métadonnées visuelles
  iconId?: string;
  bannerImageId?: string;
  
  // Visibilité et activation
  isHidden: boolean;                 // Caché jusqu'à déblocage (achievements secrets)
  isActive: boolean;                 // Peut être désactivé temporairement
  
  // Valeur et prestige
  pointsValue: number;               // Points d'achievement
  
  // Portée
  scope: "server" | "global";        // Serveur-specific ou cross-server
  serverId?: string;                 // Si scope = "server"
  
  // Conditions temporelles
  startDate?: Date;                  // Date de début (pour événements)
  endDate?: Date;                    // Date de fin (pour événements limités)
  
  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
}

const achievementCriteriaSchema = new Schema({
  type: {
    type: String,
    required: true
  },
  target: {
    type: Number,
    required: true,
    min: 0
  },
  comparison: {
    type: String,
    enum: ["=", ">=", "<=", ">", "<"],
    default: ">="
  },
  metadata: {
    type: Schema.Types.Mixed
  }
}, { _id: false });

const achievementRewardSchema = new Schema({
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
  tickets: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  items: [{ 
    type: String 
  }],
  fragments: [{
    heroId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 }
  }],
  title: { 
    type: String 
  },
  avatar: { 
    type: String 
  },
  background: { 
    type: String 
  },
  badge: { 
    type: String 
  }
}, { _id: false });

const achievementSchema = new Schema<IAchievement>({
  achievementId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    required: true
  },
  
  category: {
    type: String,
    enum: ["progression", "collection", "combat", "social", "economy", "ranking", "special"],
    required: true,
    index: true
  },
  
  type: {
    type: String,
    enum: ["milestone", "first", "leaderboard", "cumulative", "speed", "challenge"],
    required: true,
    index: true
  },
  
  rarity: {
    type: String,
    enum: ["common", "rare", "epic", "legendary", "mythic"],
    default: "common",
    index: true
  },
  
  criteria: {
    type: [achievementCriteriaSchema],
    required: true,
    validate: {
      validator: function(v: any[]) {
        return v && v.length > 0;
      },
      message: 'Achievement must have at least one criteria'
    }
  },
  
  rewards: {
    type: achievementRewardSchema,
    required: true
  },
  
  isUnique: {
    type: Boolean,
    default: false,
    index: true
  },
  
  firstPlayerToComplete: {
    type: String,
    index: true
  },
  
  firstPlayerName: {
    type: String
  },
  
  completedAt: {
    type: Date
  },
  
  isLeaderboard: {
    type: Boolean,
    default: false,
    index: true
  },
  
  leaderboardLimit: {
    type: Number,
    min: 1,
    max: 1000
  },
  
  leaderboardRefreshInterval: {
    type: Number,
    min: 60000, // Minimum 1 minute
    default: 3600000 // 1 heure par défaut
  },
  
  iconId: {
    type: String
  },
  
  bannerImageId: {
    type: String
  },
  
  isHidden: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  pointsValue: {
    type: Number,
    default: 10,
    min: 0
  },
  
  scope: {
    type: String,
    enum: ["server", "global"],
    default: "server",
    index: true
  },
  
  serverId: {
    type: String,
    index: true
  },
  
  startDate: {
    type: Date
  },
  
  endDate: {
    type: Date
  }
  
}, {
  timestamps: true,
  collection: "achievements"
});

// Index composés pour optimiser les requêtes fréquentes
achievementSchema.index({ scope: 1, serverId: 1, isActive: 1 });
achievementSchema.index({ category: 1, type: 1, isActive: 1 });
achievementSchema.index({ isUnique: 1, firstPlayerToComplete: 1 });
achievementSchema.index({ isLeaderboard: 1, isActive: 1 });
achievementSchema.index({ startDate: 1, endDate: 1 });

// Validation pre-save
achievementSchema.pre('save', function(next) {
  // Valider que les achievements uniques ne peuvent pas être leaderboard
  if (this.isUnique && this.isLeaderboard) {
    return next(new Error('Achievement cannot be both unique and leaderboard'));
  }
  
  // Valider que les leaderboard ont une limite
  if (this.isLeaderboard && !this.leaderboardLimit) {
    this.leaderboardLimit = 100; // Défaut
  }
  
  // Valider que scope server a un serverId
  if (this.scope === 'server' && !this.serverId) {
    return next(new Error('Server-scoped achievement must have serverId'));
  }
  
  next();
});

// Méthodes statiques
achievementSchema.statics.findActive = function(serverId?: string) {
  const query: any = { isActive: true };
  
  if (serverId) {
    query.$or = [
      { scope: 'global' },
      { scope: 'server', serverId }
    ];
  } else {
    query.scope = 'global';
  }
  
  return this.find(query);
};

achievementSchema.statics.findByCategory = function(category: AchievementCategory, serverId?: string) {
  const query: any = { 
    category, 
    isActive: true 
  };
  
  if (serverId) {
    query.$or = [
      { scope: 'global' },
      { scope: 'server', serverId }
    ];
  }
  
  return this.find(query);
};

export default mongoose.model<IAchievement>("Achievement", achievementSchema);

import mongoose, { Document, Schema } from "mongoose";

// Interface pour les conditions de participation
export interface IEventCondition {
  type: "level" | "world" | "heroes_owned" | "vip_level" | "server_age";
  operator: "gte" | "lte" | "eq" | "in";
  value: number | string | number[] | string[];
  description: string;
}

// Interface pour les récompenses d'événement
export interface IEventReward {
  rewardId: string;
  type: "currency" | "hero" | "equipment" | "material" | "title" | "avatar";
  name: string;
  description: string;
  rarity?: "Common" | "Rare" | "Epic" | "Legendary";
  
  // Données spécifiques selon le type
  currencyData?: {
    gold?: number;
    gems?: number;
    paidGems?: number;
    tickets?: number;
  };
  heroData?: {
    heroId: string;
    level: number;
    stars: number;
    guaranteed: boolean;
  };
  equipmentData?: {
    type: "Weapon" | "Armor" | "Accessory";
    level: number;
    stats: {
      atk: number;
      def: number;
      hp: number;
    };
  };
  materialData?: {
    materialId: string;
    quantity: number;
  };
  titleData?: {
    titleId: string;
    name: string;
    color: string;
    duration: number; // jours, -1 = permanent
  };
}

// Interface pour les objectifs d'événement
export interface IEventObjective {
  objectiveId: string;
  type: "battle_wins" | "tower_floors" | "gacha_pulls" | "login_days" | "gold_spent" | "collect_items";
  name: string;
  description: string;
  targetValue: number;
  currentValue: number;
  isCompleted: boolean;
  rewards: IEventReward[];
  
  // Conditions spécifiques
  battleConditions?: {
    battleType?: "campaign" | "arena" | "tower";
    difficulty?: "Normal" | "Hard" | "Nightmare";
    winRequired?: boolean;
  };
  collectConditions?: {
    itemType?: "hero" | "equipment" | "material";
    rarity?: "Common" | "Rare" | "Epic" | "Legendary";
    specificIds?: string[];
  };
}

// Interface pour la participation d'un joueur
export interface IEventParticipation {
  playerId: string;
  playerName: string;
  serverId: string;
  joinedAt: Date;
  lastActivityAt: Date;
  
  // Progression des objectifs
  objectives: {
    objectiveId: string;
    currentValue: number;
    completedAt?: Date;
    rewardsClaimed: boolean;
  }[];
  
  // Points et classement
  totalPoints: number;
  rank: number;
  
  // Récompenses réclamées
  claimedRewards: string[]; // IDs des récompenses déjà réclamées
}

// Interface pour les événements
export interface IEvent {
  _id?: string;
  eventId: string;
  name: string;
  description: string;
  type: "competition" | "collection" | "battle" | "login" | "special";
  category: "pvp" | "pve" | "social" | "progression" | "seasonal";
  
  // Timing
  startTime: Date;
  endTime: Date;
  timezone: string;
  duration: number; // en heures
  
  // Configuration cross-server
  serverConfig: {
    allowedServers: string[]; // ["S1", "S2"] ou ["ALL"] pour tous
    crossServerRanking: boolean;
    maxParticipants: number; // -1 = illimité
    participantsByServer: Map<string, number>; // Compteur par serveur
  };
  
  // Conditions de participation
  requirements: IEventCondition[];
  
  // Objectifs et récompenses
  objectives: IEventObjective[];
  
  // Récompenses de classement final
  rankingRewards: {
    rank: string; // "1", "2-5", "6-10", "11-50", "51-100", etc.
    rewards: IEventReward[];
  }[];
  
  // Participants
  participants: IEventParticipation[];
  
  // État de l'événement
  status: "upcoming" | "active" | "ending" | "completed" | "cancelled";
  isVisible: boolean;
  isAutoStart: boolean;
  
  // Métadonnées
  bannerUrl?: string;
  iconUrl?: string;
  tags: string[]; // ["newbie", "endgame", "pvp", "limited", etc.]
  priority: number; // Pour l'ordre d'affichage (1-10)
  
  // Statistiques
  stats: {
    totalParticipants: number;
    completedObjectives: number;
    rewardsDistributed: number;
    averagePoints: number;
    topScore: number;
  };
}

interface IEventDocument extends Document {
  eventId: string;
  name: string;
  description: string;
  type: "competition" | "collection" | "battle" | "login" | "special";
  category: "pvp" | "pve" | "social" | "progression" | "seasonal";
  startTime: Date;
  endTime: Date;
  timezone: string;
  duration: number;
  serverConfig: {
    allowedServers: string[];
    crossServerRanking: boolean;
    maxParticipants: number;
    participantsByServer: Map<string, number>;
  };
  requirements: IEventCondition[];
  objectives: IEventObjective[];
  rankingRewards: {
    rank: string;
    rewards: IEventReward[];
  }[];
  participants: IEventParticipation[];
  status: "upcoming" | "active" | "ending" | "completed" | "cancelled";
  isVisible: boolean;
  isAutoStart: boolean;
  bannerUrl?: string;
  iconUrl?: string;
  tags: string[];
  priority: number;
  stats: {
    totalParticipants: number;
    completedObjectives: number;
    rewardsDistributed: number;
    averagePoints: number;
    topScore: number;
  };
  
  // Méthodes d'instance
  canPlayerJoin(playerId: string, playerData: any): Promise<{ canJoin: boolean; reason?: string }>;
  addParticipant(playerId: string, playerName: string, serverId: string): Promise<IEventDocument>;
  updatePlayerProgress(playerId: string, objectiveType: string, value: number): Promise<IEventDocument>;
  calculateRankings(): Promise<IEventDocument>;
  distributeRankingRewards(): Promise<{ distributed: number; totalRewards: number }>;
  isActive(): boolean;
  getPlayerRank(playerId: string): number;
}

// Schémas Mongoose
const eventConditionSchema = new Schema<IEventCondition>({
  type: { 
    type: String, 
    enum: ["level", "world", "heroes_owned", "vip_level", "server_age"],
    required: true 
  },
  operator: { 
    type: String, 
    enum: ["gte", "lte", "eq", "in"],
    required: true 
  },
  value: { 
    type: Schema.Types.Mixed, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  }
});

const eventRewardSchema = new Schema<IEventReward>({
  rewardId: { type: String, required: true },
  type: { 
    type: String, 
    enum: ["currency", "hero", "equipment", "material", "title", "avatar"],
    required: true 
  },
  name: { type: String, required: true },
  description: { type: String, required: true },
  rarity: { 
    type: String, 
    enum: ["Common", "Rare", "Epic", "Legendary"]
  },
  
  currencyData: {
    gold: { type: Number, min: 0 },
    gems: { type: Number, min: 0 },
    paidGems: { type: Number, min: 0 },
    tickets: { type: Number, min: 0 }
  },
  heroData: {
    heroId: { type: String },
    level: { type: Number, min: 1, max: 100 },
    stars: { type: Number, min: 1, max: 6 },
    guaranteed: { type: Boolean, default: false }
  },
  equipmentData: {
    type: { type: String, enum: ["Weapon", "Armor", "Accessory"] },
    level: { type: Number, min: 1, max: 100 },
    stats: {
      atk: { type: Number, min: 0 },
      def: { type: Number, min: 0 },
      hp: { type: Number, min: 0 }
    }
  },
  materialData: {
    materialId: { type: String },
    quantity: { type: Number, min: 1 }
  },
  titleData: {
    titleId: { type: String },
    name: { type: String },
    color: { type: String },
    duration: { type: Number, default: -1 } // -1 = permanent
  }
});

const eventObjectiveSchema = new Schema<IEventObjective>({
  objectiveId: { type: String, required: true },
  type: { 
    type: String, 
    enum: ["battle_wins", "tower_floors", "gacha_pulls", "login_days", "gold_spent", "collect_items"],
    required: true 
  },
  name: { type: String, required: true },
  description: { type: String, required: true },
  targetValue: { type: Number, required: true, min: 1 },
  currentValue: { type: Number, default: 0, min: 0 },
  isCompleted: { type: Boolean, default: false },
  rewards: [eventRewardSchema],
  
  battleConditions: {
    battleType: { type: String, enum: ["campaign", "arena", "tower"] },
    difficulty: { type: String, enum: ["Normal", "Hard", "Nightmare"] },
    winRequired: { type: Boolean, default: true }
  },
  collectConditions: {
    itemType: { type: String, enum: ["hero", "equipment", "material"] },
    rarity: { type: String, enum: ["Common", "Rare", "Epic", "Legendary"] },
    specificIds: [{ type: String }]
  }
});

const eventParticipationSchema = new Schema<IEventParticipation>({
  playerId: { type: String, required: true },
  playerName: { type: String, required: true },
  serverId: { type: String, required: true, match: /^S\d+$/ },
  joinedAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
  
  objectives: [{
    objectiveId: { type: String, required: true },
    currentValue: { type: Number, default: 0, min: 0 },
    completedAt: { type: Date },
    rewardsClaimed: { type: Boolean, default: false }
  }],
  
  totalPoints: { type: Number, default: 0, min: 0 },
  rank: { type: Number, default: 0, min: 0 },
  claimedRewards: [{ type: String }]
});

const eventSchema = new Schema<IEventDocument>({
  eventId: { 
    type: String, 
    required: true, 
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
    maxlength: 500
  },
  type: { 
    type: String, 
    enum: ["competition", "collection", "battle", "login", "special"],
    required: true 
  },
  category: { 
    type: String, 
    enum: ["pvp", "pve", "social", "progression", "seasonal"],
    required: true 
  },
  
  startTime: { 
    type: Date, 
    required: true 
  },
  endTime: { 
    type: Date, 
    required: true,
    validate: {
      validator: function(this: IEventDocument, endTime: Date) {
        return endTime > this.startTime;
      },
      message: "End time must be after start time"
    }
  },
  timezone: { 
    type: String, 
    default: "UTC",
    match: /^[A-Za-z]+\/[A-Za-z_]+$|^UTC$/
  },
  duration: { 
    type: Number, 
    required: true,
    min: 1,
    max: 8760 // Max 1 an en heures
  },
  
  serverConfig: {
    allowedServers: [{ 
      type: String, 
      match: /^(S\d+|ALL)$/ 
    }],
    crossServerRanking: { type: Boolean, default: true },
    maxParticipants: { type: Number, default: -1, min: -1 },
    participantsByServer: { 
      type: Map, 
      of: Number, 
      default: new Map() 
    }
  },
  
  requirements: [eventConditionSchema],
  objectives: [eventObjectiveSchema],
  
  rankingRewards: [{
    rank: { 
      type: String, 
      required: true,
      match: /^(\d+|\d+-\d+)$/  // Format: "1" ou "2-5"
    },
    rewards: [eventRewardSchema]
  }],
  
  participants: [eventParticipationSchema],
  
  status: { 
    type: String, 
    enum: ["upcoming", "active", "ending", "completed", "cancelled"],
    default: "upcoming"
  },
  isVisible: { 
    type: Boolean, 
    default: true 
  },
  isAutoStart: { 
    type: Boolean, 
    default: true 
  },
  
  bannerUrl: { 
    type: String,
    match: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i
  },
  iconUrl: { 
    type: String,
    match: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i
  },
  tags: [{ 
    type: String,
    lowercase: true,
    trim: true
  }],
  priority: { 
    type: Number, 
    default: 5,
    min: 1,
    max: 10
  },
  
  stats: {
    totalParticipants: { type: Number, default: 0, min: 0 },
    completedObjectives: { type: Number, default: 0, min: 0 },
    rewardsDistributed: { type: Number, default: 0, min: 0 },
    averagePoints: { type: Number, default: 0, min: 0 },
    topScore: { type: Number, default: 0, min: 0 }
  }
}, {
  timestamps: true,
  collection: 'events'
});

// Index pour optimiser les requêtes
eventSchema.index({ eventId: 1 }, { unique: true });
eventSchema.index({ status: 1, isVisible: 1 });
eventSchema.index({ startTime: 1, endTime: 1 });
eventSchema.index({ "serverConfig.allowedServers": 1 });
eventSchema.index({ type: 1, category: 1 });
eventSchema.index({ "participants.playerId": 1 });
eventSchema.index({ "participants.serverId": 1 });
eventSchema.index({ priority: -1, startTime: 1 });

// Méthodes statiques
eventSchema.statics.getActiveEvents = function(serverId: string) {
  const now = new Date();
  return this.find({
    status: "active",
    isVisible: true,
    startTime: { $lte: now },
    endTime: { $gte: now },
    $or: [
      { "serverConfig.allowedServers": serverId },
      { "serverConfig.allowedServers": "ALL" }
    ]
  }).sort({ priority: -1, startTime: 1 });
};

eventSchema.statics.getUpcomingEvents = function(serverId: string) {
  const now = new Date();
  return this.find({
    status: "upcoming",
    isVisible: true,
    startTime: { $gt: now },
    $or: [
      { "serverConfig.allowedServers": serverId },
      { "serverConfig.allowedServers": "ALL" }
    ]
  }).sort({ startTime: 1 }).limit(10);
};

eventSchema.statics.getPlayerEvents = function(playerId: string) {
  return this.find({
    "participants.playerId": playerId,
    isVisible: true
  }).sort({ startTime: -1 });
};

// Méthodes d'instance
eventSchema.methods.canPlayerJoin = async function(playerId: string, playerData: any) {
  // Vérifier si déjà participant
  if (this.participants.some((p: IEventParticipation) => p.playerId === playerId)) {
    return { canJoin: false, reason: "Already participating in this event" };
  }
  
  // Vérifier le statut de l'événement
  if (this.status !== "active") {
    return { canJoin: false, reason: "Event is not currently active" };
  }
  
  // Vérifier la limite de participants
  if (this.serverConfig.maxParticipants > 0 && 
      this.participants.length >= this.serverConfig.maxParticipants) {
    return { canJoin: false, reason: "Event is full" };
  }
  
  // Vérifier les conditions requises
  for (const requirement of this.requirements) {
    const playerValue = playerData[requirement.type];
    
    switch (requirement.operator) {
      case "gte":
        if (playerValue < requirement.value) {
          return { canJoin: false, reason: requirement.description };
        }
        break;
      case "lte":
        if (playerValue > requirement.value) {
          return { canJoin: false, reason: requirement.description };
        }
        break;
      case "eq":
        if (playerValue !== requirement.value) {
          return { canJoin: false, reason: requirement.description };
        }
        break;
      case "in":
        if (!Array.isArray(requirement.value) || 
            !requirement.value.includes(playerValue)) {
          return { canJoin: false, reason: requirement.description };
        }
        break;
    }
  }
  
  return { canJoin: true };
};

eventSchema.methods.addParticipant = function(playerId: string, playerName: string, serverId: string) {
  const participation: IEventParticipation = {
    playerId,
    playerName,
    serverId,
    joinedAt: new Date(),
    lastActivityAt: new Date(),
    objectives: this.objectives.map((obj: IEventObjective) => ({
      objectiveId: obj.objectiveId,
      currentValue: 0,
      rewardsClaimed: false
    })),
    totalPoints: 0,
    rank: 0,
    claimedRewards: []
  };
  
  this.participants.push(participation);
  this.stats.totalParticipants = this.participants.length;
  
  // Mettre à jour le compteur par serveur
  const serverCount = this.serverConfig.participantsByServer.get(serverId) || 0;
  this.serverConfig.participantsByServer.set(serverId, serverCount + 1);
  
  return this.save();
};

eventSchema.methods.updatePlayerProgress = function(playerId: string, objectiveType: string, value: number) {
  const participant = this.participants.find((p: IEventParticipation) => p.playerId === playerId);
  if (!participant) return this.save();
  
  participant.lastActivityAt = new Date();
  
  // Mettre à jour les objectifs correspondants
  for (const objective of this.objectives) {
    if (objective.type === objectiveType) {
      const participantObjective = participant.objectives.find(
        (obj: any) => obj.objectiveId === objective.objectiveId
      );
      
      if (participantObjective && !participantObjective.completedAt) {
        participantObjective.currentValue += value;
        
        // Vérifier si l'objectif est complété
        if (participantObjective.currentValue >= objective.targetValue) {
          participantObjective.completedAt = new Date();
          this.stats.completedObjectives += 1;
          
          // Calculer les points (basé sur la difficulté de l'objectif)
          const points = Math.floor(objective.targetValue * 0.1);
          participant.totalPoints += points;
        }
      }
    }
  }
  
  return this.save();
};

eventSchema.methods.calculateRankings = function() {
  // Trier les participants par points décroissants
  this.participants.sort((a: IEventParticipation, b: IEventParticipation) => 
    b.totalPoints - a.totalPoints || a.joinedAt.getTime() - b.joinedAt.getTime()
  );
  
  // Assigner les rangs
  this.participants.forEach((participant: IEventParticipation, index: number) => {
    participant.rank = index + 1;
  });
  
  // Mettre à jour les statistiques
  if (this.participants.length > 0) {
    this.stats.topScore = this.participants[0].totalPoints;
    this.stats.averagePoints = Math.round(
      this.participants.reduce((sum: number, p: IEventParticipation) => sum + p.totalPoints, 0) / 
      this.participants.length
    );
  }
  
  return this.save();
};

eventSchema.methods.distributeRankingRewards = async function() {
  let distributed = 0;
  let totalRewards = 0;
  
  for (const participant of this.participants) {
    for (const rankReward of this.rankingRewards) {
      if (this.isRankInRange(participant.rank, rankReward.rank)) {
        totalRewards += rankReward.rewards.length;
        
        // Distribuer les récompenses (implémentation simplifiée)
        for (const reward of rankReward.rewards) {
          if (!participant.claimedRewards.includes(reward.rewardId)) {
            participant.claimedRewards.push(reward.rewardId);
            distributed++;
          }
        }
      }
    }
  }
  
  this.stats.rewardsDistributed = distributed;
  await this.save();
  
  return { distributed, totalRewards };
};

eventSchema.methods.isActive = function(): boolean {
  const now = new Date();
  return this.status === "active" && 
         this.startTime <= now && 
         this.endTime >= now;
};

eventSchema.methods.getPlayerRank = function(playerId: string): number {
  const participant = this.participants.find((p: IEventParticipation) => p.playerId === playerId);
  return participant ? participant.rank : 0;
};

// Méthode utilitaire pour vérifier si un rang correspond à une plage
eventSchema.methods.isRankInRange = function(rank: number, rankRange: string): boolean {
  if (rankRange.includes("-")) {
    const [start, end] = rankRange.split("-").map(Number);
    return rank >= start && rank <= end;
  }
  return rank === parseInt(rankRange);
};

export default mongoose.model<IEventDocument>("Event", eventSchema);

import mongoose, { Document, Schema, Types } from "mongoose";
import { AfkReward } from "../services/AfkRewardsService";

/**
 * AfkState Enhanced - Version complète avec système de récompenses AFK Arena
 * - Supports multiple reward types (gold, materials, fragments, etc.)
 * - VIP bonuses integration
 * - Stage-based progression rewards
 * - Heroes team power influence
 */

export interface IPendingReward {
  type: "currency" | "material" | "fragment" | "item";
  currencyType?: "gold" | "gems" | "tickets";
  materialId?: string;
  fragmentId?: string;
  itemId?: string;
  quantity: number;
}

export interface IAfkState extends Document {
  playerId: Types.ObjectId;
  
  // Récompenses en attente (format multi-type)
  pendingRewards: IPendingReward[];
  
  // Timing et accumulation
  lastTickAt: Date | null;
  lastClaimAt: Date | null;
  accumulatedSinceClaimSec: number;
  
  // Configuration dynamique (mise à jour selon la progression du joueur)
  currentRatesPerMinute: {
    gold: number;
    gems: number;
    tickets: number;
    materials: number;
  };
  
  // Multiplicateurs actifs
  activeMultipliers: {
    vip: number;
    stage: number;
    heroes: number;
    total: number;
    lastUpdated: Date;
  };
  
  // Limite d'accumulation (en secondes, dépend du VIP)
  maxAccrualSeconds: number;
  
  // Cache des récompenses (pour éviter les recalculs constants)
  rewardsCache: {
    rewards: IPendingReward[];
    calculatedAt: Date;
    validUntil: Date;
  } | null;
  
  // Suivi quotidien
  todayClaimedRewards: {
    gold: number;
    gems: number;
    materials: number;
    fragments: number;
  };
  todayKey: string;

  // Méthodes d'instance
  tick(now?: Date): Promise<{ rewards: IPendingReward[]; timeElapsed: number }>;
  claim(): Promise<{ claimedRewards: IPendingReward[]; totalValue: number }>;
  updatePlayerProgression(): Promise<void>;
  _resetTodayIfNeeded(now: Date): void;
  addPendingReward(reward: IPendingReward): void;
  clearPendingRewards(): void;
  calculateTotalValue(): number;
  hasRewards(): boolean;
  getRewardsByType(type: string): IPendingReward[];
  isRewardsCacheValid(): boolean;
  invalidateCache(): void;
}

const pendingRewardSchema = new Schema<IPendingReward>({
  type: {
    type: String,
    enum: ["currency", "material", "fragment", "item"],
    required: true
  },
  currencyType: {
    type: String,
    enum: ["gold", "gems", "tickets"],
    required: function() { return this.type === "currency"; }
  },
  materialId: {
    type: String,
    required: function() { return this.type === "material"; }
  },
  fragmentId: {
    type: String,
    required: function() { return this.type === "fragment"; }
  },
  itemId: {
    type: String,
    required: function() { return this.type === "item"; }
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const AfkStateSchema = new Schema<IAfkState>({
  playerId: {
    type: Schema.Types.ObjectId,
    ref: "Player",
    required: true,
    index: true,
    unique: true,
  },

  // Récompenses en attente
  pendingRewards: {
    type: [pendingRewardSchema],
    default: []
  },

  // Timing
  lastTickAt: { type: Date, default: null },
  lastClaimAt: { type: Date, default: null },
  accumulatedSinceClaimSec: { type: Number, default: 0, min: 0 },

  // Taux actuels (mis à jour selon la progression)
  currentRatesPerMinute: {
    gold: { type: Number, default: 100, min: 0 },
    gems: { type: Number, default: 10, min: 0 },
    tickets: { type: Number, default: 0.5, min: 0 },
    materials: { type: Number, default: 20, min: 0 }
  },

  // Multiplicateurs actifs
  activeMultipliers: {
    vip: { type: Number, default: 1.0, min: 1.0 },
    stage: { type: Number, default: 1.0, min: 1.0 },
    heroes: { type: Number, default: 1.0, min: 0.5 },
    total: { type: Number, default: 1.0, min: 0.5 },
    lastUpdated: { type: Date, default: () => new Date() }
  },

  // Limite d'accumulation (12-24h selon VIP)
  maxAccrualSeconds: { type: Number, default: 12 * 3600, min: 0 },

  // Cache des récompenses
  rewardsCache: {
    rewards: { type: [pendingRewardSchema], default: [] },
    calculatedAt: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    default: null
  },

  // Suivi quotidien
  todayClaimedRewards: {
    gold: { type: Number, default: 0, min: 0 },
    gems: { type: Number, default: 0, min: 0 },
    materials: { type: Number, default: 0, min: 0 },
    fragments: { type: Number, default: 0, min: 0 }
  },
  
  todayKey: { 
    type: String, 
    default: () => new Date().toISOString().slice(0, 10) 
  },
}, {
  timestamps: true,
  collection: "afk_states",
});

// Index pour performance
AfkStateSchema.index({ playerId: 1, lastTickAt: -1 });
AfkStateSchema.index({ todayKey: 1 });
AfkStateSchema.index({ "activeMultipliers.lastUpdated": -1 });

// === MÉTHODES D'INSTANCE ===

// Reset quotidien si nécessaire
AfkStateSchema.methods._resetTodayIfNeeded = function(now: Date) {
  const key = now.toISOString().slice(0, 10);
  if (this.todayKey !== key) {
    this.todayKey = key;
    this.todayClaimedRewards = {
      gold: 0,
      gems: 0,
      materials: 0,
      fragments: 0
    };
  }
};

// Ajouter une récompense en attente
AfkStateSchema.methods.addPendingReward = function(reward: IPendingReward) {
  // Chercher si une récompense du même type existe déjà
  const existingIndex = this.pendingRewards.findIndex((r: IPendingReward) => {
    if (r.type !== reward.type) return false;
    
    switch (r.type) {
      case "currency":
        return r.currencyType === reward.currencyType;
      case "material":
        return r.materialId === reward.materialId;
      case "fragment":
        return r.fragmentId === reward.fragmentId;
      case "item":
        return r.itemId === reward.itemId;
      default:
        return false;
    }
  });

  if (existingIndex !== -1) {
    // Additionner avec la récompense existante
    this.pendingRewards[existingIndex].quantity += reward.quantity;
  } else {
    // Ajouter nouvelle récompense
    this.pendingRewards.push(reward);
  }
};

// Vérifier si le cache des récompenses est valide
AfkStateSchema.methods.isRewardsCacheValid = function(): boolean {
  if (!this.rewardsCache || !this.rewardsCache.validUntil) return false;
  return new Date() < this.rewardsCache.validUntil;
};

// Invalider le cache des récompenses
AfkStateSchema.methods.invalidateCache = function() {
  this.rewardsCache = null;
};

// Mettre à jour la progression du joueur (recalcule taux et multiplicateurs)
AfkStateSchema.methods.updatePlayerProgression = async function(): Promise<void> {
  try {
    // Import dynamique pour éviter les dépendances circulaires
    const { AfkRewardsService } = require("../services/AfkRewardsService");
    
    const calculation = await AfkRewardsService.calculatePlayerAfkRewards(this.playerId.toString());
    
    // Mettre à jour les compteurs
  this.accumulatedSinceClaimSec += effectiveSec;
  this.lastTickAt = current;

  return { rewards: newRewards, timeElapsed: effectiveSec };
};

// Obtenir la distribution des matériaux selon la progression
AfkStateSchema.methods.getMaterialDistribution = function(): Record<string, number> {
  // Import dynamique pour éviter les dépendances circulaires
  const Player = require("../models/Player").default;
  
  // Distribution par défaut (sera affinée selon le monde du joueur)
  return {
    "fusion_crystal": 0.6,        // 60% des matériaux
    "elemental_essence": 0.25,    // 25%
    "ascension_stone": 0.1,       // 10%
    "divine_crystal": 0.05        // 5%
  };
};

/**
 * claim(): renvoie toutes les récompenses en attente et remet à zéro
 */
AfkStateSchema.methods.claim = async function(): Promise<{ claimedRewards: IPendingReward[]; totalValue: number }> {
  const claimedRewards = [...this.pendingRewards];
  const totalValue = this.calculateTotalValue();
  
  // Mettre à jour les stats quotidiennes
  claimedRewards.forEach((reward: IPendingReward) => {
    switch (reward.type) {
      case "currency":
        if (reward.currencyType === "gold") {
          this.todayClaimedRewards.gold += reward.quantity;
        } else if (reward.currencyType === "gems") {
          this.todayClaimedRewards.gems += reward.quantity;
        }
        break;
      case "material":
        this.todayClaimedRewards.materials += reward.quantity;
        break;
      case "fragment":
        this.todayClaimedRewards.fragments += reward.quantity;
        break;
    }
  });
  
  // Reset
  this.pendingRewards = [];
  this.accumulatedSinceClaimSec = 0;
  this.lastClaimAt = new Date();
  
  return { claimedRewards, totalValue };
};

// Vider les récompenses en attente
AfkStateSchema.methods.clearPendingRewards = function() {
  this.pendingRewards = [];
};

// Calculer la valeur totale des récompenses en attente
AfkStateSchema.methods.calculateTotalValue = function(): number {
  let totalValue = 0;
  
  this.pendingRewards.forEach((reward: IPendingReward) => {
    switch (reward.type) {
      case "currency":
        if (reward.currencyType === "gold") {
          totalValue += reward.quantity * 0.001; // 1000 gold = 1 point
        } else if (reward.currencyType === "gems") {
          totalValue += reward.quantity * 1; // 1 gem = 1 point
        } else if (reward.currencyType === "tickets") {
          totalValue += reward.quantity * 5; // 1 ticket = 5 points
        }
        break;
      case "material":
        totalValue += reward.quantity * 2; // Matériaux ont une valeur base
        break;
      case "fragment":
        totalValue += reward.quantity * 10; // Fragments sont précieux
        break;
      case "item":
        totalValue += reward.quantity * 25; // Items ont une valeur élevée
        break;
    }
  });
  
  return Math.round(totalValue);
};

// Vérifier s'il y a des récompenses à réclamer
AfkStateSchema.methods.hasRewards = function(): boolean {
  return this.pendingRewards.length > 0 && 
         this.pendingRewards.some((r: IPendingReward) => r.quantity > 0);
};

// Obtenir les récompenses par type
AfkStateSchema.methods.getRewardsByType = function(type: string): IPendingReward[] {
  return this.pendingRewards.filter((r: IPendingReward) => r.type === type);
};

// === MÉTHODES STATIQUES ===

// Créer un état AFK pour un nouveau joueur
AfkStateSchema.statics.createForNewPlayer = async function(playerId: string) {
  const state = new this({
    playerId,
    pendingRewards: [],
    lastTickAt: null,
    lastClaimAt: null,
    accumulatedSinceClaimSec: 0,
    currentRatesPerMinute: {
      gold: 100, // Taux de base pour nouveau joueur
      gems: 10,
      tickets: 0,
      materials: 20
    },
    activeMultipliers: {
      vip: 1.0,
      stage: 1.0,
      heroes: 0.5, // Pénalité sans équipe
      total: 0.5,
      lastUpdated: new Date()
    },
    maxAccrualSeconds: 12 * 3600, // 12h de base
    rewardsCache: null,
    todayClaimedRewards: {
      gold: 0,
      gems: 0,
      materials: 0,
      fragments: 0
    }
  });
  
  return await state.save();
};

// Obtenir les statistiques AFK du serveur
AfkStateSchema.statics.getServerAfkStats = async function(serverId?: string) {
  const matchCondition = serverId ? { serverId } : {};
  
  const stats = await this.aggregate([
    { $match: matchCondition },
    { $group: {
      _id: null,
      totalPlayers: { $sum: 1 },
      avgGoldPending: { $avg: { $sum: {
        $map: {
          input: { $filter: {
            input: "$pendingRewards",
            cond: { $and: [
              { $eq: ["$this.type", "currency"] },
              { $eq: ["$this.currencyType", "gold"] }
            ]}
          }},
          as: "reward",
          in: "$reward.quantity"
        }
      }}},
      totalAccumulatedTime: { $sum: "$accumulatedSinceClaimSec" },
      playersWithRewards: { $sum: { $cond: [
        { $gt: [{ $size: "$pendingRewards" }, 0] }, 1, 0
      ]}},
      avgMultiplier: { $avg: "$activeMultipliers.total" }
    }}
  ]);
  
  return stats[0] || {
    totalPlayers: 0,
    avgGoldPending: 0,
    totalAccumulatedTime: 0,
    playersWithRewards: 0,
    avgMultiplier: 1.0
  };
};

// Nettoyer les états obsolètes (maintenance)
AfkStateSchema.statics.cleanupStaleStates = async function(daysOld: number = 30) {
  const threshold = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const result = await this.deleteMany({
    $or: [
      { lastTickAt: { $lt: threshold } },
      { lastClaimAt: { $lt: threshold } },
      { updatedAt: { $lt: threshold } }
    ],
    "pendingRewards.0": { $exists: false } // Pas de récompenses en attente
  });
  
  return {
    deletedCount: result.deletedCount || 0,
    message: `Cleaned up ${result.deletedCount || 0} stale AFK states`
  };
};

// Recalculer les multiplicateurs pour tous les joueurs (maintenance)
AfkStateSchema.statics.recalculateAllMultipliers = async function() {
  const states = await this.find({
    "activeMultipliers.lastUpdated": { 
      $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Plus de 24h
    }
  }).limit(100); // Traiter par batches
  
  let updated = 0;
  for (const state of states) {
    try {
      await state.updatePlayerProgression();
      await state.save();
      updated++;
    } catch (error) {
      console.error(`❌ Erreur recalcul multiplicateurs ${state.playerId}:`, error);
    }
  }
  
  return {
    processed: states.length,
    updated,
    message: `Recalculated multipliers for ${updated}/${states.length} players`
  };
};

// Obtenir le leaderboard des gains AFK quotidiens
AfkStateSchema.statics.getDailyAfkLeaderboard = async function(serverId?: string, limit: number = 50) {
  const today = new Date().toISOString().slice(0, 10);
  const matchCondition = serverId ? { serverId, todayKey: today } : { todayKey: today };
  
  return this.aggregate([
    { $match: matchCondition },
    { $addFields: {
      totalDailyValue: {
        $add: [
          { $multiply: ["$todayClaimedRewards.gold", 0.001] },
          "$todayClaimedRewards.gems",
          { $multiply: ["$todayClaimedRewards.materials", 2] },
          { $multiply: ["$todayClaimedRewards.fragments", 10] }
        ]
      }
    }},
    { $sort: { totalDailyValue: -1 } },
    { $limit: limit },
    { $lookup: {
      from: "players",
      localField: "playerId",
      foreignField: "_id",
      as: "playerInfo"
    }},
    { $addFields: {
      playerName: { $arrayElemAt: ["$playerInfo.username", 0] }
    }},
    { $project: {
      playerId: 1,
      playerName: 1,
      todayClaimedRewards: 1,
      totalDailyValue: 1,
      activeMultipliers: 1
    }}
  ]);
};

export default mongoose.model<IAfkState>("AfkState", AfkStateSchema); jour les taux
    this.currentRatesPerMinute = {
      gold: calculation.ratesPerMinute.gold,
      gems: calculation.ratesPerMinute.exp, // EXP -> gems pour simplifier
      tickets: 0.5 * calculation.multipliers.vip, // Tickets pour VIP
      materials: calculation.ratesPerMinute.materials
    };
    
    // Mettre à jour les multiplicateurs
    this.activeMultipliers = {
      ...calculation.multipliers,
      lastUpdated: new Date()
    };
    
    // Mettre à jour la limite d'accumulation
    this.maxAccrualSeconds = calculation.maxAccrualHours * 3600;
    
    console.log(`📊 Progression AFK mise à jour pour ${this.playerId}`);
    
  } catch (error) {
    console.error("❌ Erreur updatePlayerProgression:", error);
  }
};

/**
 * tick(): calcule les récompenses depuis le dernier tick
 * Version améliorée avec support multi-récompenses
 */
AfkStateSchema.methods.tick = async function(now?: Date): Promise<{ rewards: IPendingReward[]; timeElapsed: number }> {
  const current = now ?? new Date();
  this._resetTodayIfNeeded(current);

  // Premier tick : initialise simplement lastTickAt
  if (!this.lastTickAt) {
    this.lastTickAt = current;
    return { rewards: [], timeElapsed: 0 };
  }

  // Calcul du delta (en secondes)
  const deltaSec = Math.max(0, Math.floor((current.getTime() - this.lastTickAt.getTime()) / 1000));
  
  if (deltaSec === 0) {
    return { rewards: [], timeElapsed: 0 };
  }

  // Respect du cap d'accumulation depuis le dernier claim
  const remainingSecBeforeCap = Math.max(0, this.maxAccrualSeconds - this.accumulatedSinceClaimSec);
  if (remainingSecBeforeCap <= 0) {
    this.lastTickAt = current;
    return { rewards: [], timeElapsed: 0 };
  }

  const effectiveSec = Math.min(deltaSec, remainingSecBeforeCap);
  const effectiveMin = effectiveSec / 60;

  // Vérifier si les multiplicateurs sont récents (< 1h)
  const multipliersAge = (current.getTime() - this.activeMultipliers.lastUpdated.getTime()) / (1000 * 60 * 60);
  if (multipliersAge > 1) {
    await this.updatePlayerProgression();
  }

  // Générer les récompenses pour la période écoulée
  const newRewards: IPendingReward[] = [];

  // OR
  const goldGained = Math.floor(this.currentRatesPerMinute.gold * effectiveMin);
  if (goldGained > 0) {
    newRewards.push({
      type: "currency",
      currencyType: "gold",
      quantity: goldGained
    });
  }

  // GEMS (EXP)
  const gemsGained = Math.floor(this.currentRatesPerMinute.gems * effectiveMin);
  if (gemsGained > 0) {
    newRewards.push({
      type: "currency",
      currencyType: "gems",
      quantity: gemsGained
    });
  }

  // TICKETS (VIP seulement)
  const ticketsGained = Math.floor(this.currentRatesPerMinute.tickets * effectiveMin);
  if (ticketsGained > 0) {
    newRewards.push({
      type: "currency",
      currencyType: "tickets",
      quantity: ticketsGained
    });
  }

  // MATÉRIAUX (logique simplifiée)
  const materialsGained = Math.floor(this.currentRatesPerMinute.materials * effectiveMin);
  if (materialsGained > 0) {
    // Distribution des matériaux selon la progression
    const distributionRates = this.getMaterialDistribution();
    
    for (const [materialId, rate] of Object.entries(distributionRates)) {
      const quantity = Math.floor(materialsGained * (rate as number));
      if (quantity > 0) {
        newRewards.push({
          type: "material",
          materialId,
          quantity
        });
      }
    }
  }

  // Ajouter les nouvelles récompenses aux pending
  newRewards.forEach(reward => {
    this.addPendingReward(reward);
  });

  // Mettre à

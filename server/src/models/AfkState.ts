// server/src/models/AfkState.ts
import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * AfkState Enhanced - Extension du modèle existant avec nouvelles fonctionnalités
 * CONSERVE LA COMPATIBILITÉ avec l'ancien système (pendingGold, baseGoldPerMinute)
 * AJOUTE le support multi-récompenses AFK Arena
 */

// ✅ MODIFIÉ : Nouveau type pour les récompenses multi-types avec Hero XP et Ascension Essences
export interface IPendingReward {
  type: "currency" | "material" | "fragment" | "item";
  currencyType?: "gold" | "gems" | "tickets" | "heroXP" | "ascensionEssences"; // ✅ AJOUTÉ
  materialId?: string;
  fragmentId?: string;
  itemId?: string;
  quantity: number;
}

export interface IAfkState extends Document {
  playerId: string; // ← CHANGÉ de Types.ObjectId à string
  
  // === ANCIEN SYSTÈME (CONSERVÉ) ===
  pendingGold: number;                 // Or en attente (non réclamé)
  lastTickAt: Date | null;             // Dernière fois où on a "tick"
  lastClaimAt: Date | null;            // Dernier claim
  accumulatedSinceClaimSec: number;    // Temps accumulé depuis le dernier claim (pour cap 12h)
  baseGoldPerMinute: number;           // OR/min fixe (ex: 5)
  maxAccrualSeconds: number;           // Cap de durée depuis le dernier claim (ex: 12h)
  todayAccruedGold: number;
  todayKey: string;                    // AAAA-MM-JJ pour reset quotidien

  // === NOUVEAU SYSTÈME (AJOUTÉ) ===
  // Récompenses multi-types (or, gems, matériaux, fragments)
  pendingRewards: IPendingReward[];
  
  // ✅ MODIFIÉ : Taux dynamiques selon progression avec Hero XP et Ascension Essences
  enhancedRatesPerMinute: {
    gems: number;
    tickets: number;
    materials: number;
    heroXP: number;          // ✅ AJOUTÉ
    ascensionEssences: number; // ✅ AJOUTÉ
  };
  
  // Multiplicateurs VIP/progression/équipe
  activeMultipliers: {
    vip: number;
    stage: number;
    heroes: number;
    total: number;
    lastUpdated: Date;
  };
  
  // ✅ MODIFIÉ : Suivi quotidien étendu avec Hero XP et Ascension Essences
  todayClaimedRewards: {
    gold: number;
    gems: number;
    materials: number;
    fragments: number;
    heroXP: number;          // ✅ AJOUTÉ
    ascensionEssences: number; // ✅ AJOUTÉ
  };

  // Mode de fonctionnement
  useEnhancedRewards: boolean; // true = nouveau système, false = ancien

  // === MÉTHODES EXISTANTES (CONSERVÉES) ===
  tick(now?: Date): number;            // retourne le gold ajouté à pendingGold
  claim(): number;                     // retourne le gold réclamé (et remet à zéro)
  _resetTodayIfNeeded(now: Date): void;

  // === NOUVELLES MÉTHODES ===
  tickEnhanced(now?: Date): Promise<{ rewards: IPendingReward[]; timeElapsed: number }>;
  claimEnhanced(): Promise<{ claimedRewards: IPendingReward[]; goldClaimed: number; totalValue: number }>;
  updatePlayerProgression(): Promise<void>;
  addPendingReward(reward: IPendingReward): void;
  calculateTotalValue(): number;
  hasEnhancedRewards(): boolean;
  enableEnhancedMode(): Promise<void>;
}

const pendingRewardSchema = new Schema<IPendingReward>({
  type: {
    type: String,
    enum: ["currency", "material", "fragment", "item"],
    required: true
  },
  currencyType: {
    type: String,
    enum: ["gold", "gems", "tickets", "heroXP", "ascensionEssences"], // ✅ AJOUTÉ
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
  type: String,
  required: true,
  index: true,
  unique: true,
},

  // === CHAMPS EXISTANTS (CONSERVÉS) ===
  pendingGold: { type: Number, default: 0, min: 0 },
  lastTickAt: { type: Date, default: null },
  lastClaimAt: { type: Date, default: null },
  accumulatedSinceClaimSec: { type: Number, default: 0, min: 0 },
  baseGoldPerMinute: { type: Number, default: 5, min: 0 },
  maxAccrualSeconds: { type: Number, default: 12 * 3600, min: 0 },
  todayAccruedGold: { type: Number, default: 0, min: 0 },
  todayKey: { type: String, default: () => new Date().toISOString().slice(0, 10) },

  // === NOUVEAUX CHAMPS ===
  pendingRewards: {
    type: [pendingRewardSchema],
    default: []
  },
  
  // ✅ MODIFIÉ : enhancedRatesPerMinute avec Hero XP et Ascension Essences
  enhancedRatesPerMinute: {
    gems: { type: Number, default: 1, min: 0 },
    tickets: { type: Number, default: 0.1, min: 0 },
    materials: { type: Number, default: 2, min: 0 },
    heroXP: { type: Number, default: 0, min: 0 },          // ✅ AJOUTÉ
    ascensionEssences: { type: Number, default: 0, min: 0 } // ✅ AJOUTÉ
  },
  
  activeMultipliers: {
    vip: { type: Number, default: 1.0, min: 1.0 },
    stage: { type: Number, default: 1.0, min: 1.0 },
    heroes: { type: Number, default: 1.0, min: 0.5 },
    total: { type: Number, default: 1.0, min: 0.5 },
    lastUpdated: { type: Date, default: () => new Date() }
  },
  
  // ✅ MODIFIÉ : todayClaimedRewards avec Hero XP et Ascension Essences
  todayClaimedRewards: {
    gold: { type: Number, default: 0, min: 0 },
    gems: { type: Number, default: 0, min: 0 },
    materials: { type: Number, default: 0, min: 0 },
    fragments: { type: Number, default: 0, min: 0 },
    heroXP: { type: Number, default: 0, min: 0 },          // ✅ AJOUTÉ
    ascensionEssences: { type: Number, default: 0, min: 0 } // ✅ AJOUTÉ
  },

  useEnhancedRewards: { type: Boolean, default: false }
}, {
  timestamps: true,
  collection: "afk_states",
});

// Index
AfkStateSchema.index({ playerId: 1, status: 1 });
AfkStateSchema.index({ status: 1, lastHeartbeatAt: -1 });
AfkStateSchema.index({ todayKey: 1 });
AfkStateSchema.index({ updatedAt: -1 });

// === MÉTHODES EXISTANTES (CONSERVÉES) ===

AfkStateSchema.methods._resetTodayIfNeeded = function(now: Date) {
  const key = now.toISOString().slice(0, 10);
  if (this.todayKey !== key) {
    this.todayKey = key;
    this.todayAccruedGold = 0;
    // ✅ MODIFIÉ : Reset aussi les nouvelles stats
    this.todayClaimedRewards = {
      gold: 0,
      gems: 0,
      materials: 0,
      fragments: 0,
      heroXP: 0,          // ✅ AJOUTÉ
      ascensionEssences: 0 // ✅ AJOUTÉ
    };
  }
};

/**
 * tick() ORIGINAL - maintient la compatibilité
 */
AfkStateSchema.methods.tick = function(now?: Date): number {
  const current = now ?? new Date();
  this._resetTodayIfNeeded(current);

  if (!this.lastTickAt) {
    this.lastTickAt = current;
    return 0;
  }

  const deltaSec = Math.max(0, Math.floor((current.getTime() - this.lastTickAt.getTime()) / 1000));
  if (deltaSec === 0) return 0;

  const remainingSecBeforeCap = Math.max(0, this.maxAccrualSeconds - this.accumulatedSinceClaimSec);
  if (remainingSecBeforeCap <= 0) {
    this.lastTickAt = current;
    return 0;
  }

  const effectiveSec = Math.min(deltaSec, remainingSecBeforeCap);
  const goldPerSec = this.baseGoldPerMinute / 60;
  const gained = Math.floor(effectiveSec * goldPerSec);

  if (gained > 0) {
    this.pendingGold += gained;
    this.todayAccruedGold += gained;
  }

  this.accumulatedSinceClaimSec += effectiveSec;
  this.lastTickAt = current;

  return gained;
};

/**
 * claim() ORIGINAL - maintient la compatibilité
 */
AfkStateSchema.methods.claim = function(): number {
  const claimed = this.pendingGold;
  this.pendingGold = 0;
  this.accumulatedSinceClaimSec = 0;
  this.lastClaimAt = new Date();
  return claimed;
};

// === NOUVELLES MÉTHODES (SYSTÈME ENHANCED) ===

// Ajouter une récompense multi-type
AfkStateSchema.methods.addPendingReward = function(reward: IPendingReward) {
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
    this.pendingRewards[existingIndex].quantity += reward.quantity;
  } else {
    this.pendingRewards.push(reward);
  }
};

// Mettre à jour la progression (calcule nouveaux taux et multiplicateurs)
AfkStateSchema.methods.updatePlayerProgression = async function(): Promise<void> {
  try {
    // Import dynamique pour éviter dépendances circulaires
    const { AfkRewardsService } = require("../services/AfkRewardsService");
    
    const calculation = await AfkRewardsService.calculatePlayerAfkRewards(this.playerId.toString());
    
    // Mettre à jour baseGoldPerMinute (ancien système)
    this.baseGoldPerMinute = calculation.ratesPerMinute.gold;
    
    // ✅ MODIFIÉ : Mettre à jour les nouveaux taux avec Hero XP et Ascension Essences
    this.enhancedRatesPerMinute = {
      gems: calculation.ratesPerMinute.exp || 1,
      tickets: 0.5 * calculation.multipliers.vip,
      materials: calculation.ratesPerMinute.materials || 2,
      heroXP: calculation.ratesPerMinute.heroXP || 0,          // ✅ AJOUTÉ
      ascensionEssences: calculation.ratesPerMinute.ascensionEssences || 0 // ✅ AJOUTÉ
    };
    
    // Mettre à jour les multiplicateurs
    this.activeMultipliers = {
      ...calculation.multipliers,
      lastUpdated: new Date()
    };
    
    // Mettre à jour le cap d'accumulation
    this.maxAccrualSeconds = calculation.maxAccrualHours * 3600;
    
    console.log(`📊 Progression AFK mise à jour pour ${this.playerId}`);
    
  } catch (error) {
    console.error("❌ Erreur updatePlayerProgression:", error);
  }
};

/**
 * tickEnhanced() - Version améliorée avec multi-récompenses
 */
AfkStateSchema.methods.tickEnhanced = async function(now?: Date): Promise<{ rewards: IPendingReward[]; timeElapsed: number }> {
  const current = now ?? new Date();
  
  // D'abord faire le tick normal pour l'or
  const goldGained = this.tick(current);
  
  if (!this.useEnhancedRewards) {
    return { rewards: [], timeElapsed: 0 };
  }

  // Vérifier si besoin de recalculer la progression
  const multipliersAge = (current.getTime() - this.activeMultipliers.lastUpdated.getTime()) / (1000 * 60 * 60);
  if (multipliersAge > 1) {
    await this.updatePlayerProgression();
  }

  const effectiveSec = Math.min(
    Math.max(0, Math.floor((current.getTime() - (this.lastTickAt?.getTime() || current.getTime())) / 1000)),
    Math.max(0, this.maxAccrualSeconds - this.accumulatedSinceClaimSec)
  );
  
  if (effectiveSec <= 0) {
    return { rewards: [], timeElapsed: 0 };
  }

  const effectiveMin = effectiveSec / 60;
  const newRewards: IPendingReward[] = [];

  // GEMS
  const gemsGained = Math.floor(this.enhancedRatesPerMinute.gems * effectiveMin * this.activeMultipliers.total);
  if (gemsGained > 0) {
    newRewards.push({
      type: "currency",
      currencyType: "gems",
      quantity: gemsGained
    });
  }

  // TICKETS (VIP seulement)
  const ticketsGained = Math.floor(this.enhancedRatesPerMinute.tickets * effectiveMin);
  if (ticketsGained > 0) {
    newRewards.push({
      type: "currency",
      currencyType: "tickets",
      quantity: ticketsGained
    });
  }

  // ✅ NOUVEAU : HERO XP
  const heroXPGained = Math.floor(this.enhancedRatesPerMinute.heroXP * effectiveMin * this.activeMultipliers.total);
  if (heroXPGained > 0) {
    newRewards.push({
      type: "currency",
      currencyType: "heroXP",
      quantity: heroXPGained
    });
  }

  // ✅ NOUVEAU : ASCENSION ESSENCES
  const ascensionEssencesGained = Math.floor(this.enhancedRatesPerMinute.ascensionEssences * effectiveMin * this.activeMultipliers.total);
  if (ascensionEssencesGained > 0) {
    newRewards.push({
      type: "currency",
      currencyType: "ascensionEssences",
      quantity: ascensionEssencesGained
    });
  }

  // MATÉRIAUX
  const materialsGained = Math.floor(this.enhancedRatesPerMinute.materials * effectiveMin * this.activeMultipliers.total);
  if (materialsGained > 0) {
    // Distribution simple des matériaux
    const fusionCrystals = Math.floor(materialsGained * 0.6);
    const elementalEssence = Math.floor(materialsGained * 0.25);
    const ascensionStone = Math.floor(materialsGained * 0.15);

    if (fusionCrystals > 0) {
      newRewards.push({
        type: "material",
        materialId: "fusion_crystal",
        quantity: fusionCrystals
      });
    }
    if (elementalEssence > 0) {
      newRewards.push({
        type: "material",
        materialId: "elemental_essence",
        quantity: elementalEssence
      });
    }
    if (ascensionStone > 0) {
      newRewards.push({
        type: "material",
        materialId: "ascension_stone",
        quantity: ascensionStone
      });
    }
  }

  // Ajouter aux pending rewards
  newRewards.forEach(reward => {
    this.addPendingReward(reward);
  });

  return { rewards: newRewards, timeElapsed: effectiveSec };
};

/**
 * claimEnhanced() - Récupère toutes les récompenses (or + nouvelles)
 */
AfkStateSchema.methods.claimEnhanced = async function(): Promise<{ claimedRewards: IPendingReward[]; goldClaimed: number; totalValue: number }> {
  // Claim l'or traditionnel
  const goldClaimed = this.claim();
  
  // Claim les nouvelles récompenses
  const claimedRewards = [...this.pendingRewards];
  const totalValue = this.calculateTotalValue();
  
  // ✅ MODIFIÉ : Mettre à jour les stats quotidiennes avec Hero XP et Ascension Essences
  claimedRewards.forEach((reward: IPendingReward) => {
    switch (reward.type) {
      case "currency":
        if (reward.currencyType === "gems") {
          this.todayClaimedRewards.gems += reward.quantity;
        } else if (reward.currencyType === "heroXP") {
          this.todayClaimedRewards.heroXP += reward.quantity;
        } else if (reward.currencyType === "ascensionEssences") {
          this.todayClaimedRewards.ascensionEssences += reward.quantity;
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
  
  // Mettre à jour l'or dans les stats
  this.todayClaimedRewards.gold += goldClaimed;
  
  // Reset les pending rewards
  this.pendingRewards = [];
  
  return { claimedRewards, goldClaimed, totalValue };
};

// ✅ MODIFIÉ : Calculer valeur totale des récompenses avec Hero XP et Ascension Essences
AfkStateSchema.methods.calculateTotalValue = function(): number {
  let totalValue = this.pendingGold * 0.001; // Or existant
  
  this.pendingRewards.forEach((reward: IPendingReward) => {
    switch (reward.type) {
      case "currency":
        if (reward.currencyType === "gems") {
          totalValue += reward.quantity * 1;
        } else if (reward.currencyType === "tickets") {
          totalValue += reward.quantity * 5;
        } else if (reward.currencyType === "heroXP") {
          totalValue += reward.quantity * 0.1; // Hero XP moins précieux que gems
        } else if (reward.currencyType === "ascensionEssences") {
          totalValue += reward.quantity * 10; // Ascension Essences très précieux
        }
        break;
      case "material":
        totalValue += reward.quantity * 2;
        break;
      case "fragment":
        totalValue += reward.quantity * 10;
        break;
      case "item":
        totalValue += reward.quantity * 25;
        break;
    }
  });
  
  return Math.round(totalValue);
};

// Vérifier s'il y a des récompenses améliorées
AfkStateSchema.methods.hasEnhancedRewards = function(): boolean {
  return this.pendingRewards.length > 0 && 
         this.pendingRewards.some((r: IPendingReward) => r.quantity > 0);
};

// Activer le mode amélioré
AfkStateSchema.methods.enableEnhancedMode = async function(): Promise<void> {
  if (!this.useEnhancedRewards) {
    this.useEnhancedRewards = true;
    await this.updatePlayerProgression();
    console.log(`🚀 Mode Enhanced AFK activé pour ${this.playerId}`);
  }
};

export default mongoose.model<IAfkState>("AfkState", AfkStateSchema);

// server/src/models/BestiaryEntry.ts
import mongoose, { Document, Schema } from "mongoose";

/**
 * 📖 BESTIARY ENTRY MODEL
 * 
 * Système de collection de monstres inspiré d'AFK Arena / Pokédex.
 * Chaque joueur a son propre bestiaire avec progression par monstre.
 * 
 * Progression Levels:
 * - Undiscovered (🔒) : Jamais rencontré
 * - Discovered (👁️) : Rencontré 1+ fois (infos basiques visibles)
 * - Novice (🥉) : Vaincu 10+ fois (stats complètes)
 * - Veteran (🥈) : Vaincu 50+ fois (lore + drops)
 * - Master (🥇) : Vaincu 100+ fois (bonus permanent + titre)
 */

// Types de progression
export type BestiaryLevel = "Undiscovered" | "Discovered" | "Novice" | "Veteran" | "Master";

// Interface pour les statistiques de combat
interface IMonsterCombatStats {
  timesEncountered: number;      // Nombre de fois rencontré
  timesDefeated: number;          // Nombre de fois vaincu
  timesKilledBy: number;          // Nombre de fois tué par ce monstre
  totalDamageDealt: number;       // Dégâts totaux infligés
  totalDamageTaken: number;       // Dégâts totaux reçus
  fastestKillTime: number;        // Temps du kill le plus rapide (ms)
  averageKillTime: number;        // Temps moyen de kill (ms)
  lastEncounteredAt: Date;        // Dernière rencontre
  firstEncounteredAt: Date;       // Première rencontre
}

// Interface pour les récompenses débloquées
interface IUnlockedRewards {
  discoveryReward: boolean;       // Récompense de découverte
  noviceReward: boolean;          // Récompense Novice (10 kills)
  veteranReward: boolean;         // Récompense Veteran (50 kills)
  masterReward: boolean;          // Récompense Master (100 kills)
  loreUnlocked: boolean;          // Lore débloqué
  dropsUnlocked: boolean;         // Liste des drops débloquée
}

// Interface principale du document
export interface IBestiaryEntryDocument extends Document {
  _id: string;
  playerId: string;               // Joueur propriétaire
  serverId: string;               // Serveur
  monsterId: string;              // ID du monstre (MON_fire_goblin)
  
  // Progression
  progressionLevel: BestiaryLevel;
  isDiscovered: boolean;
  
  // Stats de combat
  combatStats: IMonsterCombatStats;
  
  // Récompenses
  rewards: IUnlockedRewards;
  
  // Données du monstre (snapshot pour éviter les lookups)
  monsterSnapshot: {
    name: string;
    element: string;
    role: string;
    type: "normal" | "elite" | "boss";
    visualTheme: string;
    rarity: string;
  };
  
  // Métadonnées
  createdAt?: Date;
  updatedAt?: Date;
  
  // Méthodes
  recordEncounter(defeated: boolean, damageDealt: number, damageTaken: number, killTime?: number): Promise<void>;
  updateProgressionLevel(): Promise<BestiaryLevel>;
  getProgressPercentage(): number;
  canClaimReward(rewardType: string): boolean;
  claimReward(rewardType: string): Promise<boolean>;
  getBestiaryInfo(includeSecrets: boolean): any;
}

// Interface du modèle
interface IBestiaryEntryModel extends mongoose.Model<IBestiaryEntryDocument> {
  getOrCreate(playerId: string, serverId: string, monsterId: string, monsterData?: any): Promise<IBestiaryEntryDocument>;
  getPlayerBestiary(playerId: string, serverId: string, filters?: any): Promise<IBestiaryEntryDocument[]>;
  getPlayerStats(playerId: string, serverId: string): Promise<any>;
  getCompletionRewards(playerId: string, serverId: string): Promise<any>;
}

// ═══════════════════════════════════════════════════════════════════
// SCHÉMA
// ═══════════════════════════════════════════════════════════════════

const bestiaryEntrySchema = new Schema<IBestiaryEntryDocument>({
  playerId: {
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
  monsterId: {
    type: String,
    required: true,
    index: true
  },
  
  // Progression
  progressionLevel: {
    type: String,
    enum: ["Undiscovered", "Discovered", "Novice", "Veteran", "Master"],
    default: "Undiscovered"
  },
  isDiscovered: {
    type: Boolean,
    default: false
  },
  
  // Stats de combat
  combatStats: {
    timesEncountered: { type: Number, default: 0, min: 0 },
    timesDefeated: { type: Number, default: 0, min: 0 },
    timesKilledBy: { type: Number, default: 0, min: 0 },
    totalDamageDealt: { type: Number, default: 0, min: 0 },
    totalDamageTaken: { type: Number, default: 0, min: 0 },
    fastestKillTime: { type: Number, default: 0, min: 0 },
    averageKillTime: { type: Number, default: 0, min: 0 },
    lastEncounteredAt: { type: Date },
    firstEncounteredAt: { type: Date }
  },
  
  // Récompenses
  rewards: {
    discoveryReward: { type: Boolean, default: false },
    noviceReward: { type: Boolean, default: false },
    veteranReward: { type: Boolean, default: false },
    masterReward: { type: Boolean, default: false },
    loreUnlocked: { type: Boolean, default: false },
    dropsUnlocked: { type: Boolean, default: false }
  },
  
  // Snapshot du monstre
  monsterSnapshot: {
    name: { type: String, required: true },
    element: { type: String, required: true },
    role: { type: String, required: true },
    type: { type: String, enum: ["normal", "elite", "boss"], required: true },
    visualTheme: { type: String, required: true },
    rarity: { type: String, required: true }
  }
  
}, {
  timestamps: true,
  collection: "bestiary_entries"
});

// Index composés pour performance
bestiaryEntrySchema.index({ playerId: 1, serverId: 1 });
bestiaryEntrySchema.index({ playerId: 1, serverId: 1, monsterId: 1 }, { unique: true });
bestiaryEntrySchema.index({ playerId: 1, serverId: 1, progressionLevel: 1 });
bestiaryEntrySchema.index({ playerId: 1, serverId: 1, isDiscovered: 1 });

// ═══════════════════════════════════════════════════════════════════
// MÉTHODES D'INSTANCE
// ═══════════════════════════════════════════════════════════════════

/**
 * Enregistrer une rencontre avec ce monstre
 */
bestiaryEntrySchema.methods.recordEncounter = async function(
  defeated: boolean,
  damageDealt: number,
  damageTaken: number,
  killTime?: number
): Promise<void> {
  const now = new Date();
  
  // Première rencontre
  if (!this.isDiscovered) {
    this.isDiscovered = true;
    this.combatStats.firstEncounteredAt = now;
    console.log(`🔓 ${this.monsterSnapshot.name} découvert pour la première fois !`);
  }
  
  // Mettre à jour les stats
  this.combatStats.timesEncountered++;
  this.combatStats.lastEncounteredAt = now;
  this.combatStats.totalDamageDealt += damageDealt;
  this.combatStats.totalDamageTaken += damageTaken;
  
  if (defeated) {
    this.combatStats.timesDefeated++;
    
    // Temps de kill
    if (killTime && killTime > 0) {
      // Fastest kill
      if (this.combatStats.fastestKillTime === 0 || killTime < this.combatStats.fastestKillTime) {
        this.combatStats.fastestKillTime = killTime;
      }
      
      // Average kill time
      const totalKills = this.combatStats.timesDefeated;
      const currentAvg = this.combatStats.averageKillTime;
      this.combatStats.averageKillTime = Math.floor(
        ((currentAvg * (totalKills - 1)) + killTime) / totalKills
      );
    }
    
    console.log(`⚔️ ${this.monsterSnapshot.name} vaincu (${this.combatStats.timesDefeated} fois)`);
  } else {
    // Tué par le monstre
    this.combatStats.timesKilledBy++;
    console.log(`💀 Tué par ${this.monsterSnapshot.name} (${this.combatStats.timesKilledBy} fois)`);
  }
  
  // Mettre à jour le niveau de progression
  await this.updateProgressionLevel();
  
  await this.save();
};

/**
 * Mettre à jour le niveau de progression selon les kills
 */
bestiaryEntrySchema.methods.updateProgressionLevel = async function(): Promise<BestiaryLevel> {
  const kills = this.combatStats.timesDefeated;
  let newLevel: BestiaryLevel = this.progressionLevel;
  let rewardUnlocked = false;
  
  // Déterminer le niveau
  if (kills >= 100) {
    newLevel = "Master";
    if (!this.rewards.masterReward) {
      this.rewards.masterReward = true;
      rewardUnlocked = true;
      console.log(`🥇 ${this.monsterSnapshot.name} MASTER atteint ! Récompense disponible !`);
    }
  } else if (kills >= 50) {
    newLevel = "Veteran";
    if (!this.rewards.veteranReward) {
      this.rewards.veteranReward = true;
      this.rewards.loreUnlocked = true;
      this.rewards.dropsUnlocked = true;
      rewardUnlocked = true;
      console.log(`🥈 ${this.monsterSnapshot.name} VETERAN atteint ! Lore débloqué !`);
    }
  } else if (kills >= 10) {
    newLevel = "Novice";
    if (!this.rewards.noviceReward) {
      this.rewards.noviceReward = true;
      rewardUnlocked = true;
      console.log(`🥉 ${this.monsterSnapshot.name} NOVICE atteint ! Stats complètes débloquées !`);
    }
  } else if (this.isDiscovered) {
    newLevel = "Discovered";
    if (!this.rewards.discoveryReward) {
      this.rewards.discoveryReward = true;
      rewardUnlocked = true;
      console.log(`👁️ ${this.monsterSnapshot.name} découvert ! Récompense de découverte !`);
    }
  } else {
    newLevel = "Undiscovered";
  }
  
  this.progressionLevel = newLevel;
  return newLevel;
};

/**
 * Obtenir le pourcentage de progression (0-100)
 */
bestiaryEntrySchema.methods.getProgressPercentage = function(): number {
  const kills = this.combatStats.timesDefeated;
  
  // 0-100 kills = 0-100%
  return Math.min(100, Math.floor((kills / 100) * 100));
};

/**
 * Vérifier si une récompense peut être réclamée
 */
bestiaryEntrySchema.methods.canClaimReward = function(rewardType: string): boolean {
  const rewardsMap: Record<string, boolean> = {
    discovery: this.rewards.discoveryReward && this.isDiscovered,
    novice: this.rewards.noviceReward && this.combatStats.timesDefeated >= 10,
    veteran: this.rewards.veteranReward && this.combatStats.timesDefeated >= 50,
    master: this.rewards.masterReward && this.combatStats.timesDefeated >= 100
  };
  
  return rewardsMap[rewardType] || false;
};

/**
 * Réclamer une récompense
 */
bestiaryEntrySchema.methods.claimReward = async function(rewardType: string): Promise<boolean> {
  if (!this.canClaimReward(rewardType)) {
    return false;
  }
  
  // Marquer la récompense comme réclamée
  const rewardFlags: Record<string, keyof IUnlockedRewards> = {
    discovery: "discoveryReward",
    novice: "noviceReward",
    veteran: "veteranReward",
    master: "masterReward"
  };
  
  const flag = rewardFlags[rewardType];
  if (flag) {
    this.rewards[flag] = false; // Reset pour ne pas réclamer deux fois
    await this.save();
    return true;
  }
  
  return false;
};

/**
 * Obtenir les infos du bestiaire (avec ou sans secrets)
 */
bestiaryEntrySchema.methods.getBestiaryInfo = function(includeSecrets: boolean = false): any {
  const info: any = {
    monsterId: this.monsterId,
    progressionLevel: this.progressionLevel,
    progressPercentage: this.getProgressPercentage(),
    isDiscovered: this.isDiscovered,
    
    // Toujours visible
    monster: {
      name: this.isDiscovered ? this.monsterSnapshot.name : "???",
      element: this.isDiscovered ? this.monsterSnapshot.element : "Unknown",
      type: this.isDiscovered ? this.monsterSnapshot.type : "Unknown",
      visualTheme: this.isDiscovered ? this.monsterSnapshot.visualTheme : "Unknown"
    },
    
    // Stats basiques (si découvert)
    basicStats: this.isDiscovered ? {
      timesEncountered: this.combatStats.timesEncountered,
      timesDefeated: this.combatStats.timesDefeated,
      firstEncounteredAt: this.combatStats.firstEncounteredAt
    } : null
  };
  
  // Stats complètes (Novice+)
  if (this.progressionLevel === "Novice" || this.progressionLevel === "Veteran" || this.progressionLevel === "Master") {
    info.fullStats = {
      timesKilledBy: this.combatStats.timesKilledBy,
      totalDamageDealt: this.combatStats.totalDamageDealt,
      totalDamageTaken: this.combatStats.totalDamageTaken,
      averageKillTime: this.combatStats.averageKillTime,
      fastestKillTime: this.combatStats.fastestKillTime
    };
  }
  
  // Lore et drops (Veteran+)
  if (this.rewards.loreUnlocked && includeSecrets) {
    info.lore = {
      unlocked: true,
      description: `Informations détaillées sur ${this.monsterSnapshot.name}...`
    };
  }
  
  if (this.rewards.dropsUnlocked && includeSecrets) {
    info.drops = {
      unlocked: true,
      // Liste des drops du monstre (à récupérer depuis Monster model)
    };
  }
  
  // Bonus permanent (Master)
  if (this.progressionLevel === "Master") {
    info.masterBonus = {
      damageBonus: 5, // +5% damage contre ce type de monstre
      defenseBonus: 5  // +5% defense contre ce type de monstre
    };
  }
  
  // Récompenses disponibles
  info.pendingRewards = {
    discovery: this.canClaimReward("discovery"),
    novice: this.canClaimReward("novice"),
    veteran: this.canClaimReward("veteran"),
    master: this.canClaimReward("master")
  };
  
  return info;
};

// ═══════════════════════════════════════════════════════════════════
// MÉTHODES STATIQUES
// ═══════════════════════════════════════════════════════════════════

/**
 * Obtenir ou créer une entrée de bestiaire
 */
bestiaryEntrySchema.statics.getOrCreate = async function(
  playerId: string,
  serverId: string,
  monsterId: string,
  monsterData?: any
): Promise<IBestiaryEntryDocument> {
  let entry = await this.findOne({ playerId, serverId, monsterId });
  
  if (!entry && monsterData) {
    // Créer nouvelle entrée
    entry = new this({
      playerId,
      serverId,
      monsterId,
      monsterSnapshot: {
        name: monsterData.name,
        element: monsterData.element,
        role: monsterData.role,
        type: monsterData.type,
        visualTheme: monsterData.visualTheme,
        rarity: monsterData.rarity
      }
    });
    
    await entry.save();
    console.log(`📖 Nouvelle entrée bestiaire créée: ${monsterData.name}`);
  }
  
  return entry!;
};

/**
 * Récupérer tout le bestiaire d'un joueur
 */
bestiaryEntrySchema.statics.getPlayerBestiary = async function(
  playerId: string,
  serverId: string,
  filters?: any
): Promise<IBestiaryEntryDocument[]> {
  const query: any = { playerId, serverId };
  
  // Filtres optionnels
  if (filters?.element) query["monsterSnapshot.element"] = filters.element;
  if (filters?.type) query["monsterSnapshot.type"] = filters.type;
  if (filters?.progressionLevel) query.progressionLevel = filters.progressionLevel;
  if (filters?.isDiscovered !== undefined) query.isDiscovered = filters.isDiscovered;
  
  return await this.find(query).sort({ "combatStats.timesDefeated": -1 });
};

/**
 * Obtenir les statistiques globales du bestiaire d'un joueur
 */
bestiaryEntrySchema.statics.getPlayerStats = async function(
  playerId: string,
  serverId: string
): Promise<any> {
  const entries = await this.find({ playerId, serverId });
  
  const stats = {
    total: entries.length,
    discovered: entries.filter((e: IBestiaryEntryDocument) => e.isDiscovered).length,
    undiscovered: entries.filter((e: IBestiaryEntryDocument) => !e.isDiscovered).length,
    
    byProgressionLevel: {
      Undiscovered: entries.filter((e: IBestiaryEntryDocument) => e.progressionLevel === "Undiscovered").length,
      Discovered: entries.filter((e: IBestiaryEntryDocument) => e.progressionLevel === "Discovered").length,
      Novice: entries.filter((e: IBestiaryEntryDocument) => e.progressionLevel === "Novice").length,
      Veteran: entries.filter((e: IBestiaryEntryDocument) => e.progressionLevel === "Veteran").length,
      Master: entries.filter((e: IBestiaryEntryDocument) => e.progressionLevel === "Master").length
    },
    
    byType: {
      normal: entries.filter((e: IBestiaryEntryDocument) => e.monsterSnapshot.type === "normal").length,
      elite: entries.filter((e: IBestiaryEntryDocument) => e.monsterSnapshot.type === "elite").length,
      boss: entries.filter((e: IBestiaryEntryDocument) => e.monsterSnapshot.type === "boss").length
    },
    
    byElement: {} as Record<string, number>,
    
    combatTotals: {
      totalEncounters: entries.reduce((sum: number, e: IBestiaryEntryDocument) => sum + e.combatStats.timesEncountered, 0),
      totalDefeats: entries.reduce((sum: number, e: IBestiaryEntryDocument) => sum + e.combatStats.timesDefeated, 0),
      totalDeaths: entries.reduce((sum: number, e: IBestiaryEntryDocument) => sum + e.combatStats.timesKilledBy, 0),
      totalDamageDealt: entries.reduce((sum: number, e: IBestiaryEntryDocument) => sum + e.combatStats.totalDamageDealt, 0),
      totalDamageTaken: entries.reduce((sum: number, e: IBestiaryEntryDocument) => sum + e.combatStats.totalDamageTaken, 0)
    },
    
    completionPercentage: entries.length > 0 ? 
      Math.floor((entries.filter((e: IBestiaryEntryDocument) => e.isDiscovered).length / entries.length) * 100) : 0,
    
    masterCompletionPercentage: entries.length > 0 ?
      Math.floor((entries.filter((e: IBestiaryEntryDocument) => e.progressionLevel === "Master").length / entries.length) * 100) : 0
  };
  
  // Compter par élément
  const elements = ["Fire", "Water", "Wind", "Electric", "Light", "Dark"];
  elements.forEach(element => {
    stats.byElement[element] = entries.filter((e: IBestiaryEntryDocument) => e.monsterSnapshot.element === element).length;
  });
  
  return stats;
};

/**
 * Obtenir les récompenses de complétion disponibles
 */
bestiaryEntrySchema.statics.getCompletionRewards = async function(
  playerId: string,
  serverId: string
): Promise<any> {
  const entries = await this.find({ playerId, serverId });
  const stats = await this.getPlayerStats(playerId, serverId);
  
  const rewards: any = {
    available: [],
    claimed: [],
    progress: {}
  };
  
  // Récompenses par type
  const normalMastered = entries.filter(e => e.monsterSnapshot.type === "normal" && e.progressionLevel === "Master").length;
  const eliteMastered = entries.filter(e => e.monsterSnapshot.type === "elite" && e.progressionLevel === "Master").length;
  const bossMastered = entries.filter(e => e.monsterSnapshot.type === "boss" && e.progressionLevel === "Master").length;
  
  // Récompenses par élément (tous découverts)
  const elements = ["Fire", "Water", "Wind", "Electric", "Light", "Dark"];
  elements.forEach(element => {
    const elementMonsters = entries.filter(e => e.monsterSnapshot.element === element);
    const discovered = elementMonsters.filter(e => e.isDiscovered).length;
    
    if (elementMonsters.length > 0) {
      rewards.progress[`${element}_discovery`] = {
        current: discovered,
        required: elementMonsters.length,
        percentage: Math.floor((discovered / elementMonsters.length) * 100),
        reward: {
          gems: 500,
          bonus: `+5% damage vs ${element} monsters`
        }
      };
    }
  });
  
  // Récompense complétion totale
  if (stats.completionPercentage === 100) {
    rewards.available.push({
      id: "bestiary_complete",
      name: "Monster Encyclopedia Complete",
      gems: 5000,
      title: "Monster Hunter",
      avatar: "monster_hunter_avatar"
    });
  }
  
  return rewards;
};

// Pré-save : Validation
bestiaryEntrySchema.pre("save", function(next) {
  // S'assurer que timesDefeated <= timesEncountered
  if (this.combatStats.timesDefeated > this.combatStats.timesEncountered) {
    this.combatStats.timesDefeated = this.combatStats.timesEncountered;
  }
  
  next();
});

export default mongoose.model<IBestiaryEntryDocument, IBestiaryEntryModel>("BestiaryEntry", bestiaryEntrySchema);

import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * AfkFarmingTarget - Choix du stage à farmer en mode AFK
 * Permet au joueur de sélectionner quel stage farmer au lieu du stage actuel
 * Comme dans AFK Arena : farm ancien stage pour fragments spécifiques, etc.
 */

export interface IAfkFarmingTarget extends Document {
  playerId: Types.ObjectId;
  
  // Stage sélectionné pour le farm AFK
  selectedWorld: number;
  selectedLevel: number;
  selectedDifficulty: "Normal" | "Hard" | "Nightmare";
  
  // Métadonnées
  isActive: boolean;                    // Si false, utilise le stage actuel du joueur
  selectedAt: Date;                     // Quand le choix a été fait
  lastValidatedAt: Date;                // Dernière vérification que le stage est débloqué
  
  // Raisons du choix (optionnel, pour analytics)
  reason?: "fragments" | "materials" | "progression" | "other";
  targetHeroFragments?: string;         // ID du héros ciblé si reason = "fragments"
  
  // Validation
  isValidStage: boolean;                // Le stage est-il toujours débloqué ?
  validationMessage?: string;           // Message d'erreur si invalide
}

const AfkFarmingTargetSchema = new Schema<IAfkFarmingTarget>({
  playerId: {
    type: Schema.Types.ObjectId,
    ref: "Player",
    required: true,
    index: true,
    unique: true, // Un seul choix de farm par joueur
  },
  
  selectedWorld: {
    type: Number,
    required: true,
    min: 1,
    max: 50, // Limite raisonnable
  },
  
  selectedLevel: {
    type: Number,
    required: true,
    min: 1,
    max: 50, // Limite par monde
  },
  
  selectedDifficulty: {
    type: String,
    enum: ["Normal", "Hard", "Nightmare"],
    required: true,
    default: "Normal",
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  
  selectedAt: {
    type: Date,
    required: true,
    default: () => new Date(),
  },
  
  lastValidatedAt: {
    type: Date,
    required: true,
    default: () => new Date(),
  },
  
  reason: {
    type: String,
    enum: ["fragments", "materials", "progression", "other"],
    default: "other",
  },
  
  targetHeroFragments: {
    type: String,
    default: null,
  },
  
  isValidStage: {
    type: Boolean,
    default: true,
    index: true,
  },
  
  validationMessage: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
  collection: "afk_farming_targets",
});

// Index pour requêtes fréquentes
AfkFarmingTargetSchema.index({ playerId: 1, isActive: 1 });
AfkFarmingTargetSchema.index({ selectedWorld: 1, selectedLevel: 1 });
AfkFarmingTargetSchema.index({ lastValidatedAt: 1 }); // Pour cleanup périodique

// === MÉTHODES D'INSTANCE ===

/**
 * Valider que le stage sélectionné est toujours accessible au joueur
 */
AfkFarmingTargetSchema.methods.validateStageAccess = async function(): Promise<boolean> {
  try {
    // Import dynamique pour éviter dépendances circulaires
    const Player = require("./Player").default;
    const player = await Player.findById(this.playerId).select("world level difficulty completedStages");
    
    if (!player) {
      this.isValidStage = false;
      this.validationMessage = "Player not found";
      return false;
    }

    // Vérifier que le monde sélectionné n'est pas supérieur au monde actuel
    if (this.selectedWorld > player.world) {
      this.isValidStage = false;
      this.validationMessage = `World ${this.selectedWorld} not unlocked (current: ${player.world})`;
      return false;
    }

    // Si même monde, vérifier le niveau
    if (this.selectedWorld === player.world && this.selectedLevel > player.level) {
      this.isValidStage = false;
      this.validationMessage = `Level ${this.selectedWorld}-${this.selectedLevel} not unlocked`;
      return false;
    }

    // Vérifier la difficulté (Hard/Nightmare nécessite d'avoir complété en Normal/Hard)
    if (this.selectedDifficulty === "Hard") {
      const normalCompleted = this.checkStageCompleted(player.completedStages, 
        this.selectedWorld, this.selectedLevel, "Normal");
      if (!normalCompleted) {
        this.isValidStage = false;
        this.validationMessage = `Must complete ${this.selectedWorld}-${this.selectedLevel} Normal first`;
        return false;
      }
    }

    if (this.selectedDifficulty === "Nightmare") {
      const hardCompleted = this.checkStageCompleted(player.completedStages, 
        this.selectedWorld, this.selectedLevel, "Hard");
      if (!hardCompleted) {
        this.isValidStage = false;
        this.validationMessage = `Must complete ${this.selectedWorld}-${this.selectedLevel} Hard first`;
        return false;
      }
    }

    // Stage valide
    this.isValidStage = true;
    this.validationMessage = null;
    this.lastValidatedAt = new Date();
    
    return true;

  } catch (error) {
    console.error("❌ Erreur validateStageAccess:", error);
    this.isValidStage = false;
    this.validationMessage = "Validation error";
    return false;
  }
};

/**
 * Vérifier si un stage est complété (utilitaire)
 */
AfkFarmingTargetSchema.methods.checkStageCompleted = function(
  completedStages: any[], 
  world: number, 
  level: number, 
  difficulty: string
): boolean {
  if (!completedStages || !Array.isArray(completedStages)) return false;
  
  return completedStages.some(stage => 
    stage.world === world && 
    stage.level === level && 
    stage.difficulty === difficulty && 
    stage.completed === true
  );
};

/**
 * Obtenir une description lisible du stage sélectionné
 */
AfkFarmingTargetSchema.methods.getStageDescription = function(): string {
  return `${this.selectedWorld}-${this.selectedLevel} (${this.selectedDifficulty})`;
};

/**
 * Obtenir les récompenses spécifiques de ce stage (pour preview)
 */
AfkFarmingTargetSchema.methods.getExpectedRewards = async function(): Promise<{
  specialDrops: string[];
  rewardMultiplier: number;
  recommendedFor: string[];
}> {
  // Logique simple pour déterminer les drops spéciaux selon le stage
  const specialDrops: string[] = [];
  const recommendedFor: string[] = [];
  
  // Fragments de héros selon le monde (logique simplifiée)
  if (this.selectedWorld <= 5) {
    specialDrops.push("common_hero_fragments");
    recommendedFor.push("Early game heroes");
  } else if (this.selectedWorld <= 10) {
    specialDrops.push("rare_hero_fragments");
    recommendedFor.push("Mid game heroes");
  } else if (this.selectedWorld <= 15) {
    specialDrops.push("epic_hero_fragments");
    recommendedFor.push("Late game heroes");
  } else {
    specialDrops.push("legendary_hero_fragments");
    recommendedFor.push("Endgame heroes");
  }

  // Matériaux spéciaux selon la difficulté
  if (this.selectedDifficulty === "Hard") {
    specialDrops.push("enhanced_materials");
  }
  if (this.selectedDifficulty === "Nightmare") {
    specialDrops.push("rare_materials", "ascension_materials");
  }

  // Multiplicateur de récompenses selon la difficulté
  const difficultyMultipliers = {
    "Normal": 1.0,
    "Hard": 1.5,
    "Nightmare": 2.0
  };

  // Réduction pour les anciens stages (encourager la progression)
  const worldDifference = Math.max(0, this.selectedWorld - 1);
  const progressionPenalty = Math.max(0.5, 1 - (worldDifference * 0.05)); // -5% par monde d'écart

  return {
    specialDrops,
    rewardMultiplier: difficultyMultipliers[this.selectedDifficulty] * progressionPenalty,
    recommendedFor
  };
};

// === MÉTHODES STATIQUES ===

/**
 * Obtenir ou créer le choix de farm d'un joueur
 */
AfkFarmingTargetSchema.statics.getOrCreateForPlayer = async function(playerId: string) {
  let target = await this.findOne({ playerId });
  
  if (!target) {
    // Créer avec le stage actuel du joueur par défaut
    const Player = require("./Player").default;
    const player = await Player.findById(playerId).select("world level difficulty");
    
    if (!player) throw new Error("Player not found");
    
    target = await this.create({
      playerId,
      selectedWorld: player.world,
      selectedLevel: player.level,
      selectedDifficulty: player.difficulty || "Normal",
      isActive: false, // Inactif par défaut = utilise progression actuelle
      reason: "progression"
    });
  }
  
  return target;
};

/**
 * Définir un nouveau choix de farm pour un joueur
 */
AfkFarmingTargetSchema.statics.setFarmingTarget = async function(
  playerId: string,
  world: number,
  level: number,
  difficulty: string,
  options?: {
    reason?: string;
    targetHeroFragments?: string;
  }
) {
  const target = await this.getOrCreateForPlayer(playerId);
  
  target.selectedWorld = world;
  target.selectedLevel = level;
  target.selectedDifficulty = difficulty;
  target.isActive = true;
  target.selectedAt = new Date();
  target.reason = options?.reason || "other";
  target.targetHeroFragments = options?.targetHeroFragments || null;
  
  // Valider immédiatement
  await target.validateStageAccess();
  await target.save();
  
  return target;
};

/**
 * Désactiver le farm personnalisé (retour au stage actuel)
 */
AfkFarmingTargetSchema.statics.resetToCurrentStage = async function(playerId: string) {
  const target = await this.getOrCreateForPlayer(playerId);
  target.isActive = false;
  await target.save();
  return target;
};

/**
 * Valider tous les choix de farm (tâche de maintenance)
 */
AfkFarmingTargetSchema.statics.validateAllTargets = async function(): Promise<{
  validated: number;
  invalidated: number;
  errors: number;
}> {
  const targets = await this.find({ isActive: true });
  let validated = 0;
  let invalidated = 0;
  let errors = 0;
  
  for (const target of targets) {
    try {
      const isValid = await target.validateStageAccess();
      await target.save();
      
      if (isValid) {
        validated++;
      } else {
        invalidated++;
        // Optionnel : désactiver automatiquement les choix invalides
        // target.isActive = false;
        // await target.save();
      }
    } catch (error) {
      console.error(`❌ Erreur validation target ${target._id}:`, error);
      errors++;
    }
  }
  
  return { validated, invalidated, errors };
};

export default mongoose.model<IAfkFarmingTarget>("AfkFarmingTarget", AfkFarmingTargetSchema);

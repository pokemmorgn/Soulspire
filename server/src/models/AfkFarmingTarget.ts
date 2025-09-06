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
  selectedDifficulty: string; // "Normal" | "Hard" | "Nightmare"
  
  // Métadonnées
  isActive: boolean;                    // Si false, utilise le stage actuel du joueur
  selectedAt: Date;                     // Quand le choix a été fait
  lastValidatedAt: Date;                // Dernière vérification que le stage est débloqué
  
  // Raisons du choix (optionnel, pour analytics)
  reason?: string; // "fragments" | "materials" | "progression" | "other"
  targetHeroFragments?: string;         // ID du héros ciblé si reason = "fragments"
  
  // Validation
  isValidStage: boolean;                // Le stage est-il toujours débloqué ?
  validationMessage?: string;           // Message d'erreur si invalide
}

const AfkFarmingTargetSchema = new Schema<IAfkFarmingTarget>({
playerId: {
  type: String,
  required: true,
  index: true,
  unique: true,
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
    max: 100, // Limite par monde
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
    required: false,
  },
  
  isValidStage: {
    type: Boolean,
    default: true,
    index: true,
  },
  
  validationMessage: {
    type: String,
    required: false,
  },
}, {
  timestamps: true,
  collection: "afk_farming_targets",
});

// Index pour requêtes fréquentes
AfkFarmingTargetSchema.index({ playerId: 1, isActive: 1 });
AfkFarmingTargetSchema.index({ selectedWorld: 1, selectedLevel: 1 });
AfkFarmingTargetSchema.index({ lastValidatedAt: 1 }); // Pour cleanup périodique

const AfkFarmingTarget = mongoose.model<IAfkFarmingTarget>("AfkFarmingTarget", AfkFarmingTargetSchema);

// === FONCTIONS UTILITAIRES (pas de méthodes d'instance pour éviter les problèmes TypeScript) ===

/**
 * Valider que le stage sélectionné est toujours accessible au joueur
 */
export async function validateStageAccess(target: IAfkFarmingTarget): Promise<boolean> {
  try {
    // Import dynamique pour éviter dépendances circulaires
    const Player = require("./Player").default;
    const player = await Player.findById(target.playerId).select("world level difficulty completedStages");
    
    if (!player) {
      target.isValidStage = false;
      target.validationMessage = "Player not found";
      return false;
    }

    // Vérifier que le monde sélectionné n'est pas supérieur au monde actuel
    if (target.selectedWorld > player.world) {
      target.isValidStage = false;
      target.validationMessage = `World ${target.selectedWorld} not unlocked (current: ${player.world})`;
      return false;
    }

    // Si même monde, vérifier le niveau
    if (target.selectedWorld === player.world && target.selectedLevel > player.level) {
      target.isValidStage = false;
      target.validationMessage = `Level ${target.selectedWorld}-${target.selectedLevel} not unlocked`;
      return false;
    }

    // Vérifier la difficulté (Hard/Nightmare nécessite d'avoir complété en Normal/Hard)
    if (target.selectedDifficulty === "Hard") {
      const normalCompleted = checkStageCompleted(player.completedStages, 
        target.selectedWorld, target.selectedLevel, "Normal");
      if (!normalCompleted) {
        target.isValidStage = false;
        target.validationMessage = `Must complete ${target.selectedWorld}-${target.selectedLevel} Normal first`;
        return false;
      }
    }

    if (target.selectedDifficulty === "Nightmare") {
      const hardCompleted = checkStageCompleted(player.completedStages, 
        target.selectedWorld, target.selectedLevel, "Hard");
      if (!hardCompleted) {
        target.isValidStage = false;
        target.validationMessage = `Must complete ${target.selectedWorld}-${target.selectedLevel} Hard first`;
        return false;
      }
    }

    // Stage valide
    target.isValidStage = true;
    target.validationMessage = undefined;
    target.lastValidatedAt = new Date();
    
    return true;

  } catch (error) {
    console.error("❌ Erreur validateStageAccess:", error);
    target.isValidStage = false;
    target.validationMessage = "Validation error";
    return false;
  }
}

/**
 * Vérifier si un stage est complété (utilitaire)
 */
export function checkStageCompleted(
  completedStages: any[], 
  world: number, 
  level: number, 
  difficulty: string
): boolean {
  if (!completedStages || !Array.isArray(completedStages)) return false;
  
  return completedStages.some((stage: any) => 
    stage.world === world && 
    stage.level === level && 
    stage.difficulty === difficulty && 
    stage.completed === true
  );
}

/**
 * Obtenir une description lisible du stage sélectionné
 */
export function getStageDescription(target: IAfkFarmingTarget): string {
  return `${target.selectedWorld}-${target.selectedLevel} (${target.selectedDifficulty})`;
}

/**
 * Obtenir les récompenses spécifiques de ce stage (pour preview)
 */
export async function getExpectedRewards(target: IAfkFarmingTarget): Promise<{
  specialDrops: string[];
  rewardMultiplier: number;
  recommendedFor: string[];
}> {
  // Logique simple pour déterminer les drops spéciaux selon le stage
  const specialDrops: string[] = [];
  const recommendedFor: string[] = [];
  
  // Fragments de héros selon le monde (logique simplifiée)
  if (target.selectedWorld <= 5) {
    specialDrops.push("common_hero_fragments");
    recommendedFor.push("Early game heroes");
  } else if (target.selectedWorld <= 10) {
    specialDrops.push("rare_hero_fragments");
    recommendedFor.push("Mid game heroes");
  } else if (target.selectedWorld <= 15) {
    specialDrops.push("epic_hero_fragments");
    recommendedFor.push("Late game heroes");
  } else {
    specialDrops.push("legendary_hero_fragments");
    recommendedFor.push("Endgame heroes");
  }

  // Matériaux spéciaux selon la difficulté
  if (target.selectedDifficulty === "Hard") {
    specialDrops.push("enhanced_materials");
  }
  if (target.selectedDifficulty === "Nightmare") {
    specialDrops.push("rare_materials", "ascension_materials");
  }

  // Multiplicateur de récompenses selon la difficulté
  let rewardMultiplier = 1.0;
  if (target.selectedDifficulty === "Hard") {
    rewardMultiplier = 1.5;
  } else if (target.selectedDifficulty === "Nightmare") {
    rewardMultiplier = 2.0;
  }

  // Réduction pour les anciens stages (encourager la progression)
  const worldDifference = Math.max(0, target.selectedWorld - 1);
  const progressionPenalty = Math.max(0.5, 1 - (worldDifference * 0.05)); // -5% par monde d'écart
  rewardMultiplier = rewardMultiplier * progressionPenalty;

  return {
    specialDrops,
    rewardMultiplier,
    recommendedFor
  };
}

/**
 * Obtenir ou créer le choix de farm d'un joueur
 */
export async function getOrCreateForPlayer(playerId: string): Promise<IAfkFarmingTarget> {
  let target = await AfkFarmingTarget.findOne({ playerId });
  
  if (!target) {
    // Créer avec le stage actuel du joueur par défaut
    const Player = require("./Player").default;
    const player = await Player.findById(playerId).select("world level difficulty");
    
    if (!player) throw new Error("Player not found");
    
    target = await AfkFarmingTarget.create({
      playerId,
      selectedWorld: player.world,
      selectedLevel: player.level,
      selectedDifficulty: player.difficulty || "Normal",
      isActive: false, // Inactif par défaut = utilise progression actuelle
      reason: "progression"
    });
  }
  
  return target;
}

/**
 * Définir un nouveau choix de farm pour un joueur
 */
export async function setFarmingTarget(
  playerId: string,
  world: number,
  level: number,
  difficulty: string,
  options?: {
    reason?: string;
    targetHeroFragments?: string;
  }
): Promise<IAfkFarmingTarget> {
  const target = await getOrCreateForPlayer(playerId);
  
  target.selectedWorld = world;
  target.selectedLevel = level;
  target.selectedDifficulty = difficulty;
  target.isActive = true;
  target.selectedAt = new Date();
  target.reason = options?.reason || "other";
  target.targetHeroFragments = options?.targetHeroFragments;
  
  // Valider immédiatement
  await validateStageAccess(target);
  await target.save();
  
  return target;
}

/**
 * Désactiver le farm personnalisé (retour au stage actuel)
 */
export async function resetToCurrentStage(playerId: string): Promise<IAfkFarmingTarget> {
  const target = await getOrCreateForPlayer(playerId);
  target.isActive = false;
  await target.save();
  return target;
}

/**
 * Valider tous les choix de farm (tâche de maintenance)
 */
export async function validateAllTargets(): Promise<{
  validated: number;
  invalidated: number;
  errors: number;
}> {
  const targets = await AfkFarmingTarget.find({ isActive: true });
  let validated = 0;
  let invalidated = 0;
  let errors = 0;
  
  for (const target of targets) {
    try {
      const isValid = await validateStageAccess(target);
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
}

export default AfkFarmingTarget;

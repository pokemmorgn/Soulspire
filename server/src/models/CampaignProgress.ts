// models/CampaignProgress.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ILevelStar {
  levelIndex: number;
  stars: number;         // 0..3 étoiles selon la performance
  bestTimeMs?: number;   // Meilleur temps en millisecondes
}

// Progression sur une difficulté spécifique
export interface IDifficultyProgress {
  difficulty: "Normal" | "Hard" | "Nightmare";
  highestLevelCleared: number; // Plus haut niveau battu sur cette difficulté
  starsByLevel: ILevelStar[];  // Étoiles par niveau sur cette difficulté
  isCompleted: boolean;        // Si tous les niveaux du monde sont terminés
  completedAt?: Date;          // Date de complétion du monde
}

export interface ICampaignProgress extends Document {
  playerId: string;
  serverId: string;      
  worldId: number;       
  
  // ✅ ANCIEN SYSTÈME (pour compatibilité) - représente le mode Normal
  highestLevelCleared: number; // MODE NORMAL uniquement
  starsByLevel: ILevelStar[];  // MODE NORMAL uniquement
  
  // 🆕 NOUVEAU SYSTÈME - Progression par difficulté
  progressByDifficulty: IDifficultyProgress[];
  
  // Statistiques globales du monde
  totalStarsEarned: number;    // Total étoiles sur TOUTES difficultés
  totalTimeSpent: number;      // Temps total passé sur ce monde (ms)
  firstCompletionDate?: Date;  // Première fois que le monde a été terminé (Normal)
}

const levelStarSchema = new Schema<ILevelStar>({
  levelIndex: { type: Number, required: true },
  stars: { type: Number, min: 0, max: 3, default: 0 },
  bestTimeMs: { type: Number, min: 0 }
});

const difficultyProgressSchema = new Schema<IDifficultyProgress>({
  difficulty: { 
    type: String, 
    enum: ["Normal", "Hard", "Nightmare"], 
    required: true 
  },
  highestLevelCleared: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  starsByLevel: { 
    type: [levelStarSchema], 
    default: [] 
  },
  isCompleted: { 
    type: Boolean, 
    default: false 
  },
  completedAt: { 
    type: Date 
  }
});

const campaignProgressSchema = new Schema<ICampaignProgress>({
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
  worldId: { 
    type: Number, 
    required: true, 
    index: true 
  },
  
  // Ancien système (compatibilité - représente Normal mode)
  highestLevelCleared: { 
    type: Number, 
    default: 0 
  },
  starsByLevel: { 
    type: [levelStarSchema], 
    default: [] 
  },
  
  // Nouveau système
  progressByDifficulty: { 
    type: [difficultyProgressSchema], 
    default: function() {
      return [
        { 
          difficulty: "Normal", 
          highestLevelCleared: 0, 
          starsByLevel: [], 
          isCompleted: false 
        }
      ];
    }
  },
  
  // Statistiques globales
  totalStarsEarned: { 
    type: Number, 
    default: 0 
  },
  totalTimeSpent: { 
    type: Number, 
    default: 0 
  },
  firstCompletionDate: { 
    type: Date 
  }
}, { 
  timestamps: true, 
  collection: "campaign_progress" 
});

// Index composite unique
campaignProgressSchema.index({ 
  playerId: 1, 
  serverId: 1, 
  worldId: 1 
}, { unique: true });

// Index pour les requêtes de progression
campaignProgressSchema.index({ 
  playerId: 1, 
  serverId: 1, 
  "progressByDifficulty.difficulty": 1 
});

// === MÉTHODES D'INSTANCE ===

// Obtenir la progression pour une difficulté spécifique
campaignProgressSchema.methods.getProgressForDifficulty = function(
  difficulty: "Normal" | "Hard" | "Nightmare"
): IDifficultyProgress | undefined {
  return this.progressByDifficulty.find((p: IDifficultyProgress) => p.difficulty === difficulty);
};

// Mettre à jour la progression pour une difficulté
campaignProgressSchema.methods.updateDifficultyProgress = function(
  difficulty: "Normal" | "Hard" | "Nightmare",
  levelIndex: number,
  stars: number,
  battleTimeMs: number,
  worldLevelCount: number
): void {
  
  let difficultyProgress = this.getProgressForDifficulty(difficulty);
  
  // Créer l'entrée de difficulté si elle n'existe pas
  if (!difficultyProgress) {
    difficultyProgress = {
      difficulty,
      highestLevelCleared: 0,
      starsByLevel: [],
      isCompleted: false
    };
    this.progressByDifficulty.push(difficultyProgress);
  }
  
  // Mettre à jour le niveau le plus haut
  if (levelIndex > difficultyProgress.highestLevelCleared) {
    difficultyProgress.highestLevelCleared = levelIndex;
  }
  
  // Mettre à jour les étoiles du niveau
  let levelStar = difficultyProgress.starsByLevel.find((s: ILevelStar) => s.levelIndex === levelIndex);
  if (!levelStar) {
    levelStar = {
      levelIndex,
      stars: stars,
      bestTimeMs: battleTimeMs
    };
    difficultyProgress.starsByLevel.push(levelStar);
  } else {
    // Mettre à jour seulement si c'est mieux
    if (stars > levelStar.stars) {
      levelStar.stars = stars;
    }
    if (!levelStar.bestTimeMs || battleTimeMs < levelStar.bestTimeMs) {
      levelStar.bestTimeMs = battleTimeMs;
    }
  }
  
  // Vérifier si le monde est maintenant complété sur cette difficulté
  if (difficultyProgress.highestLevelCleared >= worldLevelCount && !difficultyProgress.isCompleted) {
    difficultyProgress.isCompleted = true;
    difficultyProgress.completedAt = new Date();
    
    // Si c'est la première complétion (Normal), marquer la date
    if (difficulty === "Normal" && !this.firstCompletionDate) {
      this.firstCompletionDate = new Date();
    }
  }
  
  // Synchroniser avec l'ancien système si c'est Normal
  if (difficulty === "Normal") {
    this.highestLevelCleared = difficultyProgress.highestLevelCleared;
    this.starsByLevel = [...difficultyProgress.starsByLevel];
  }
  
  // Recalculer les statistiques globales
  this.recalculateGlobalStats();
};

// Recalculer les statistiques globales
campaignProgressSchema.methods.recalculateGlobalStats = function(): void {
  this.totalStarsEarned = this.progressByDifficulty.reduce((total: number, difficulty: IDifficultyProgress) => {
    return total + difficulty.starsByLevel.reduce((sum: number, level: ILevelStar) => sum + level.stars, 0);
  }, 0);
};

// Vérifier si une difficulté est complétée
campaignProgressSchema.methods.isDifficultyCompleted = function(
  difficulty: "Normal" | "Hard" | "Nightmare"
): boolean {
  const progress = this.getProgressForDifficulty(difficulty);
  return progress ? progress.isCompleted : false;
};

// Obtenir le plus haut niveau sur une difficulté
campaignProgressSchema.methods.getHighestLevelForDifficulty = function(
  difficulty: "Normal" | "Hard" | "Nightmare"
): number {
  const progress = this.getProgressForDifficulty(difficulty);
  return progress ? progress.highestLevelCleared : 0;
};

// Obtenir toutes les étoiles sur une difficulté
campaignProgressSchema.methods.getStarsForDifficulty = function(
  difficulty: "Normal" | "Hard" | "Nightmare"
): number {
  const progress = this.getProgressForDifficulty(difficulty);
  if (!progress) return 0;
  
  return progress.starsByLevel.reduce((sum: number, level: ILevelStar) => sum + level.stars, 0);
};

// === MÉTHODES STATIQUES ===

// Obtenir la progression complète d'un joueur sur un serveur
campaignProgressSchema.statics.getPlayerProgress = function(playerId: string, serverId: string) {
  return this.find({ playerId, serverId }).sort({ worldId: 1 });
};

// Vérifier si un joueur a terminé toute la campagne sur une difficulté
campaignProgressSchema.statics.hasPlayerCompletedAllWorlds = async function(
  playerId: string, 
  serverId: string, 
  difficulty: "Normal" | "Hard" | "Nightmare",
  totalWorlds: number
): Promise<boolean> {
  
  const completedWorlds = await this.countDocuments({
    playerId,
    serverId,
    "progressByDifficulty": {
      $elemMatch: {
        difficulty: difficulty,
        isCompleted: true
      }
    }
  });
  
  return completedWorlds >= totalWorlds;
};

// Obtenir les statistiques d'un joueur
campaignProgressSchema.statics.getPlayerStats = function(playerId: string, serverId: string) {
  return this.aggregate([
    { $match: { playerId, serverId } },
    { $unwind: "$progressByDifficulty" },
    { $group: {
      _id: "$progressByDifficulty.difficulty",
      worldsCompleted: { 
        $sum: { $cond: ["$progressByDifficulty.isCompleted", 1, 0] } 
      },
      totalStars: { 
        $sum: { $sum: "$progressByDifficulty.starsByLevel.stars" } 
      },
      totalLevelsCleared: { 
        $sum: "$progressByDifficulty.highestLevelCleared" 
      }
    }},
    { $sort: { _id: 1 } }
  ]);
};

// Middleware pour maintenir la compatibilité
campaignProgressSchema.pre('save', function() {
  // S'assurer que la progression Normal existe toujours
  const normalProgress = this.getProgressForDifficulty("Normal");
  if (!normalProgress) {
    this.progressByDifficulty.push({
      difficulty: "Normal",
      highestLevelCleared: this.highestLevelCleared || 0,
      starsByLevel: this.starsByLevel || [],
      isCompleted: false
    });
  }
  
  // Recalculer les stats globales
  this.recalculateGlobalStats();
});

export default mongoose.model<ICampaignProgress>("CampaignProgress", campaignProgressSchema);

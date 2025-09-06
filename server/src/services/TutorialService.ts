// src/services/TutorialService.ts
import Player from "../models/Player";

export interface TutorialStep {
  stepId: string;
  type: "popup" | "highlight" | "tooltip" | "overlay" | "sequence";
  target?: string; // UI element to highlight
  position?: "top" | "bottom" | "left" | "right" | "center";
  duration?: number; // milliseconds
  skippable: boolean;
  required: boolean;
  order: number;
}

export interface FeatureTutorial {
  featureId: string;
  tutorialId: string;
  titleKey: string; // Label key for translation
  descriptionKey: string; // Label key for translation
  steps: TutorialStep[];
  isRequired: boolean;
  triggerOnce: boolean;
  prerequisites?: string[]; // Other tutorials that must be completed first
}

export interface PlayerTutorialProgress {
  tutorialId: string;
  featureId: string;
  status: "not_started" | "in_progress" | "completed" | "skipped";
  currentStep: number;
  startedAt?: Date;
  completedAt?: Date;
  skippedAt?: Date;
}

// Configuration des tutoriels par feature
const FEATURE_TUTORIALS: FeatureTutorial[] = [
  {
    featureId: "gacha",
    tutorialId: "gacha_intro",
    titleKey: "tutorial.gacha.title", // "Bienvenue à la Taverne !"
    descriptionKey: "tutorial.gacha.description", // "Invoquez de nouveaux héros ici"
    isRequired: true,
    triggerOnce: true,
    steps: [
      {
        stepId: "welcome",
        type: "popup",
        position: "center",
        skippable: false,
        required: true,
        order: 1
      },
      {
        stepId: "highlight_banner",
        type: "highlight",
        target: "gacha_banner_button",
        position: "bottom",
        skippable: false,
        required: true,
        order: 2
      },
      {
        stepId: "first_pull",
        type: "tooltip",
        target: "pull_button",
        position: "top",
        skippable: false,
        required: true,
        order: 3
      }
    ]
  },
  {
    featureId: "hero_upgrade",
    tutorialId: "hero_upgrade_intro",
    titleKey: "tutorial.hero_upgrade.title", // "Améliorez vos Héros"
    descriptionKey: "tutorial.hero_upgrade.description", // "Augmentez leur puissance"
    isRequired: true,
    triggerOnce: true,
    steps: [
      {
        stepId: "explain_levels",
        type: "popup",
        position: "center",
        skippable: false,
        required: true,
        order: 1
      },
      {
        stepId: "highlight_hero",
        type: "highlight",
        target: "hero_slot_0",
        position: "bottom",
        skippable: false,
        required: true,
        order: 2
      },
      {
        stepId: "show_upgrade_button",
        type: "highlight",
        target: "level_up_button",
        position: "top",
        skippable: false,
        required: true,
        order: 3
      }
    ]
  },
  {
    featureId: "tower",
    tutorialId: "tower_intro",
    titleKey: "tutorial.tower.title", // "Tour des Rêves"
    descriptionKey: "tutorial.tower.description", // "Défi en étages infinis"
    isRequired: true,
    triggerOnce: true,
    steps: [
      {
        stepId: "explain_concept",
        type: "popup",
        position: "center",
        skippable: false,
        required: true,
        order: 1
      },
      {
        stepId: "show_start_button",
        type: "highlight",
        target: "tower_start_button",
        position: "bottom",
        skippable: false,
        required: true,
        order: 2
      }
    ]
  },
  {
    featureId: "arena",
    tutorialId: "arena_intro",
    titleKey: "tutorial.arena.title", // "Combat PvP"
    descriptionKey: "tutorial.arena.description", // "Affrontez d'autres joueurs"
    isRequired: true,
    triggerOnce: true,
    steps: [
      {
        stepId: "explain_pvp",
        type: "popup",
        position: "center",
        skippable: false,
        required: true,
        order: 1
      },
      {
        stepId: "show_opponents",
        type: "highlight",
        target: "opponent_list",
        position: "top",
        skippable: false,
        required: true,
        order: 2
      }
    ]
  },
  {
    featureId: "formations",
    tutorialId: "formations_intro", 
    titleKey: "tutorial.formations.title", // "Formations de Combat"
    descriptionKey: "tutorial.formations.description", // "Organisez vos héros"
    isRequired: true,
    triggerOnce: true,
    steps: [
      {
        stepId: "explain_formations",
        type: "popup",
        position: "center",
        skippable: false,
        required: true,
        order: 1
      },
      {
        stepId: "show_slots",
        type: "highlight",
        target: "formation_grid",
        position: "bottom",
        skippable: false,
        required: true,
        order: 2
      }
    ]
  },
  {
    featureId: "shop_basic",
    tutorialId: "shop_intro",
    titleKey: "tutorial.shop.title", // "Boutique"
    descriptionKey: "tutorial.shop.description", // "Achetez des objets utiles"
    isRequired: false,
    triggerOnce: true,
    steps: [
      {
        stepId: "show_shop",
        type: "tooltip",
        target: "shop_button",
        position: "bottom",
        skippable: true,
        required: false,
        order: 1
      }
    ]
  }
];

export class TutorialService {

  // === DÉCLENCHEMENT AUTOMATIQUE ===

  /**
   * Déclencher le tutoriel d'une feature automatiquement
   */
  public static async triggerFeatureTutorial(
    playerId: string,
    serverId: string,
    featureId: string
  ): Promise<boolean> {
    try {
      const tutorial = FEATURE_TUTORIALS.find(t => t.featureId === featureId);
      if (!tutorial) {
        console.log(`No tutorial configured for feature: ${featureId}`);
        return false;
      }

      // Vérifier si le tutoriel doit être déclenché
      const shouldTrigger = await this.shouldTriggerTutorial(playerId, serverId, tutorial);
      if (!shouldTrigger) {
        console.log(`Tutorial ${tutorial.tutorialId} should not be triggered for ${playerId}`);
        return false;
      }

      // Démarrer le tutoriel
      await this.startTutorial(playerId, serverId, tutorial.tutorialId);
      
      console.log(`🎓 Tutorial triggered: ${tutorial.tutorialId} for player ${playerId}`);
      return true;
      
    } catch (error) {
      console.error("Error triggering feature tutorial:", error);
      return false;
    }
  }

  /**
   * Démarrer un tutoriel spécifique
   */
  public static async startTutorial(
    playerId: string,
    serverId: string,
    tutorialId: string
  ): Promise<boolean> {
    try {
      const tutorial = FEATURE_TUTORIALS.find(t => t.tutorialId === tutorialId);
      if (!tutorial) {
        throw new Error(`Tutorial not found: ${tutorialId}`);
      }

      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      // Initialiser les tutoriels si nécessaire
      if (!(player as any).tutorialProgress) {
        (player as any).tutorialProgress = [];
      }

      const progress: PlayerTutorialProgress = {
        tutorialId,
        featureId: tutorial.featureId,
        status: "in_progress",
        currentStep: 0,
        startedAt: new Date()
      };

      (player as any).tutorialProgress.push(progress);
      await player.save();

      return true;
      
    } catch (error) {
      console.error("Error starting tutorial:", error);
      return false;
    }
  }

  // === GESTION DES ÉTAPES ===

  /**
   * Passer à l'étape suivante d'un tutoriel
   */
  public static async nextTutorialStep(
    playerId: string,
    serverId: string,
    tutorialId: string
  ): Promise<{ completed: boolean; nextStep?: TutorialStep }> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }

      const tutorialProgress = (player as any).tutorialProgress || [];
      const progress = tutorialProgress.find((p: PlayerTutorialProgress) => 
        p.tutorialId === tutorialId && p.status === "in_progress"
      );

      if (!progress) {
        throw new Error(`Tutorial not in progress: ${tutorialId}`);
      }

      const tutorial = FEATURE_TUTORIALS.find(t => t.tutorialId === tutorialId);
      if (!tutorial) {
        throw new Error(`Tutorial not found: ${tutorialId}`);
      }

      progress.currentStep++;

      // Vérifier si le tutoriel est terminé
      if (progress.currentStep >= tutorial.steps.length) {
        progress.status = "completed";
        progress.completedAt = new Date();
        await player.save();
        
        console.log(`🎓 Tutorial completed: ${tutorialId} for player ${playerId}`);
        return { completed: true };
      }

      // Retourner l'étape suivante
      const nextStep = tutorial.steps[progress.currentStep];
      await player.save();

      return { completed: false, nextStep };
      
    } catch (error) {
      console.error("Error advancing tutorial step:", error);
      throw error;
    }
  }

  /**
   * Ignorer un tutoriel
   */
  public static async skipTutorial(
    playerId: string,
    serverId: string,
    tutorialId: string
  ): Promise<boolean> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) return false;

      const tutorialProgress = (player as any).tutorialProgress || [];
      const progress = tutorialProgress.find((p: PlayerTutorialProgress) => 
        p.tutorialId === tutorialId
      );

      if (progress) {
        progress.status = "skipped";
        progress.skippedAt = new Date();
        await player.save();
      }

      return true;
      
    } catch (error) {
      console.error("Error skipping tutorial:", error);
      return false;
    }
  }

  // === CONSULTATION ===

  /**
   * Obtenir l'état d'un tutoriel pour un joueur
   */
  public static async getTutorialStatus(
    playerId: string,
    serverId: string,
    tutorialId: string
  ): Promise<PlayerTutorialProgress | null> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) return null;

      const tutorialProgress = (player as any).tutorialProgress || [];
      return tutorialProgress.find((p: PlayerTutorialProgress) => 
        p.tutorialId === tutorialId
      ) || null;
      
    } catch (error) {
      console.error("Error getting tutorial status:", error);
      return null;
    }
  }

  /**
   * Obtenir le tutoriel actuel à afficher pour Unity
   */
  public static async getCurrentTutorial(
    playerId: string,
    serverId: string
  ): Promise<{
    tutorial: FeatureTutorial;
    progress: PlayerTutorialProgress;
    currentStep: TutorialStep;
  } | null> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) return null;

      const tutorialProgress = (player as any).tutorialProgress || [];
      const inProgress = tutorialProgress.find((p: PlayerTutorialProgress) => 
        p.status === "in_progress"
      );

      if (!inProgress) return null;

      const tutorial = FEATURE_TUTORIALS.find(t => t.tutorialId === inProgress.tutorialId);
      if (!tutorial) return null;

      const currentStep = tutorial.steps[inProgress.currentStep];
      if (!currentStep) return null;

      return {
        tutorial,
        progress: inProgress,
        currentStep
      };
      
    } catch (error) {
      console.error("Error getting current tutorial:", error);
      return null;
    }
  }

  /**
   * Obtenir tous les tutoriels disponibles
   */
  public static getAllTutorials(): FeatureTutorial[] {
    return [...FEATURE_TUTORIALS];
  }

  /**
   * Obtenir les statistiques des tutoriels d'un joueur
   */
  public static async getPlayerTutorialStats(
    playerId: string,
    serverId: string
  ): Promise<{
    total: number;
    completed: number;
    skipped: number;
    inProgress: number;
    completionRate: number;
  }> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return { total: 0, completed: 0, skipped: 0, inProgress: 0, completionRate: 0 };
      }

      const tutorialProgress = (player as any).tutorialProgress || [];
      const total = FEATURE_TUTORIALS.length;
      const completed = tutorialProgress.filter((p: PlayerTutorialProgress) => p.status === "completed").length;
      const skipped = tutorialProgress.filter((p: PlayerTutorialProgress) => p.status === "skipped").length;
      const inProgress = tutorialProgress.filter((p: PlayerTutorialProgress) => p.status === "in_progress").length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        total,
        completed,
        skipped,
        inProgress,
        completionRate
      };
      
    } catch (error) {
      console.error("Error getting tutorial stats:", error);
      return { total: 0, completed: 0, skipped: 0, inProgress: 0, completionRate: 0 };
    }
  }

  // === MÉTHODES PRIVÉES ===

  /**
   * Vérifier si un tutoriel doit être déclenché
   */
  private static async shouldTriggerTutorial(
    playerId: string,
    serverId: string,
    tutorial: FeatureTutorial
  ): Promise<boolean> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) return false;

      const tutorialProgress = (player as any).tutorialProgress || [];
      const existingProgress = tutorialProgress.find((p: PlayerTutorialProgress) => 
        p.tutorialId === tutorial.tutorialId
      );

      // Si triggerOnce et déjà fait
      if (tutorial.triggerOnce && existingProgress) {
        return false;
      }

      // Vérifier les prérequis
      if (tutorial.prerequisites) {
        for (const prereq of tutorial.prerequisites) {
          const prereqProgress = tutorialProgress.find((p: PlayerTutorialProgress) => 
            p.tutorialId === prereq && p.status === "completed"
          );
          if (!prereqProgress) {
            return false;
          }
        }
      }

      return true;
      
    } catch (error) {
      console.error("Error checking tutorial trigger:", error);
      return false;
    }
  }
}

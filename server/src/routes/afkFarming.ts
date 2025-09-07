import { Router } from "express";
import AfkFarmingService from "../services/AfkFarmingService";
import authMiddleware from "../middleware/authMiddleware";

/**
 * Routes AFK Farming - Stage Selection pour Unity
 * Compatible avec le système AFK existant
 * VERSION CORRIGÉE pour Account/Player system
 */

const router = Router();

// Extension TypeScript pour éviter les erreurs de compilation
declare module "express-serve-static-core" {
  interface Request {
    playerId?: string;
    accountId?: string;
    serverId?: string;
  }
}

// =====================================================================
// === ROUTES PRINCIPALES ===
// =====================================================================

/**
 * GET /afk-farming/info
 * Obtenir l'état actuel du farm d'un joueur
 */
router.get("/info", authMiddleware, async (req: any, res: any) => {
  try {
    const playerId = req.playerId!;
    
    console.log(`📊 GET /afk-farming/info pour ${playerId}`);

    const result = await AfkFarmingService.getFarmingStageInfo(playerId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error: any) {
    console.error("❌ Erreur GET /afk-farming/info:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * GET /afk-farming/stages
 * Obtenir la liste des stages disponibles pour le farm
 */
router.get("/stages", authMiddleware, async (req: any, res: any) => {
  try {
    const playerId = req.playerId!;
    
    console.log(`📋 GET /afk-farming/stages pour ${playerId}`);

    const result = await AfkFarmingService.getAvailableFarmingStages(playerId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        stages: result.stages || [],
        currentFarming: result.currentFarming || null,
        recommendations: result.recommendations || [],
        totalStages: (result.stages || []).length
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur GET /afk-farming/stages:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * POST /afk-farming/set
 * Définir un nouveau stage de farm
 */
router.post("/set", authMiddleware, async (req: any, res: any) => {
  try {
    const playerId = req.playerId!;
    const { world, level, difficulty, reason, targetHeroFragments, validateFirst } = req.body;
    
    console.log(`🎯 POST /afk-farming/set pour ${playerId}: ${world}-${level} (${difficulty})`);

    // Validation des paramètres
    if (!world || !level || !difficulty) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: world, level, difficulty"
      });
    }

    if (typeof world !== "number" || typeof level !== "number") {
      return res.status(400).json({
        success: false,
        error: "World and level must be numbers"
      });
    }

    if (!["Normal", "Hard", "Nightmare"].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        error: "Difficulty must be Normal, Hard, or Nightmare"
      });
    }

    const result = await AfkFarmingService.setPlayerFarmingTarget(
      playerId,
      world,
      level,
      difficulty,
      {
        reason: reason || "other",
        targetHeroFragments: targetHeroFragments || undefined,
        validateFirst: validateFirst === true
      }
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: `Farming target set to ${world}-${level} (${difficulty})`,
      data: {
        farmingTarget: result.target,
        farmingInfo: result.farmingInfo
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur POST /afk-farming/set:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * POST /afk-farming/reset
 * Revenir au stage de progression actuel (désactiver le farm custom)
 */
router.post("/reset", authMiddleware, async (req: any, res: any) => {
  try {
    const playerId = req.playerId!;
    
    console.log(`🔄 POST /afk-farming/reset pour ${playerId}`);

    const result = await AfkFarmingService.resetPlayerFarmingTarget(playerId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: "Farming target reset to progression stage",
      data: {
        farmingInfo: result.farmingInfo
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur POST /afk-farming/reset:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * GET /afk-farming/rewards/:world/:level/:difficulty
 * Preview des récompenses pour un stage spécifique
 */
router.get("/rewards/:world/:level/:difficulty", authMiddleware, async (req: any, res: any) => {
  try {
    const playerId = req.playerId!;
    const { world, level, difficulty } = req.params;
    
    console.log(`🔮 GET /afk-farming/rewards/${world}/${level}/${difficulty} pour ${playerId}`);

    // Validation des paramètres
    const worldNum = parseInt(world);
    const levelNum = parseInt(level);

    if (isNaN(worldNum) || isNaN(levelNum)) {
      return res.status(400).json({
        success: false,
        error: "World and level must be valid numbers"
      });
    }

    if (!["Normal", "Hard", "Nightmare"].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        error: "Difficulty must be Normal, Hard, or Nightmare"
      });
    }

    // Utiliser getExpectedRewards du modèle
    const { getExpectedRewards } = require("../models/AfkFarmingTarget");
    
    const expectedRewards = await getExpectedRewards({
      selectedWorld: worldNum,
      selectedLevel: levelNum,
      selectedDifficulty: difficulty
    } as any);

    // Calculer des estimations de gains AFK (simulation)
    const baseRates = {
      gold: 100 * Math.pow(1.15, worldNum - 1) * Math.pow(1.05, levelNum - 1),
      gems: 1 * Math.pow(1.1, worldNum - 1),
      materials: 10 * Math.pow(1.2, worldNum - 1)
    };

    const difficultyMultiplierMap: any = {
      "Normal": 1.0,
      "Hard": 1.5,
      "Nightmare": 2.0
    };
    const difficultyMultiplier = difficultyMultiplierMap[difficulty] || 1.0;

    const estimatedGainsPerHour = {
      gold: Math.floor(baseRates.gold * 60 * difficultyMultiplier * expectedRewards.rewardMultiplier),
      gems: Math.floor(baseRates.gems * 60 * difficultyMultiplier),
      materials: Math.floor(baseRates.materials * 60 * difficultyMultiplier)
    };

    res.json({
      success: true,
      data: {
        stage: {
          world: worldNum,
          level: levelNum,
          difficulty,
          description: `${worldNum}-${levelNum} (${difficulty})`
        },
        expectedRewards,
        estimatedGainsPerHour,
        comparison: {
          vsNormal: Math.round((difficultyMultiplier - 1) * 100),
          description: difficultyMultiplier > 1 ? 
            `${Math.round((difficultyMultiplier - 1) * 100)}% more rewards than Normal` :
            "Base rewards"
        }
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur GET /afk-farming/rewards:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * GET /afk-farming/effective-stage
 * Obtenir le stage effectivement utilisé pour les calculs AFK
 */
router.get("/effective-stage", authMiddleware, async (req: any, res: any) => {
  try {
    const playerId = req.playerId!;
    
    console.log(`⚙️ GET /afk-farming/effective-stage pour ${playerId}`);

    const effectiveStage = await AfkFarmingService.getEffectiveFarmingStage(playerId);

    res.json({
      success: true,
      data: {
        effectiveStage,
        description: `${effectiveStage.world}-${effectiveStage.level} (${effectiveStage.difficulty})`,
        isCustomFarming: effectiveStage.isCustom,
        source: effectiveStage.isCustom ? "custom_selection" : "player_progression"
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur GET /afk-farming/effective-stage:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

// =====================================================================
// === ROUTES UTILITAIRES ===
// =====================================================================

/**
 * GET /afk-farming/validate/:world/:level/:difficulty
 * Valider si un stage est accessible pour le joueur
 */
router.get("/validate/:world/:level/:difficulty", authMiddleware, async (req: any, res: any) => {
  try {
    const playerId = req.playerId!;
    const { world, level, difficulty } = req.params;
    
    console.log(`✅ GET /afk-farming/validate/${world}/${level}/${difficulty} pour ${playerId}`);

    // Validation des paramètres
    const worldNum = parseInt(world);
    const levelNum = parseInt(level);

    if (isNaN(worldNum) || isNaN(levelNum)) {
      return res.status(400).json({
        success: false,
        error: "World and level must be valid numbers"
      });
    }

    if (!["Normal", "Hard", "Nightmare"].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        error: "Difficulty must be Normal, Hard, or Nightmare"
      });
    }

    // Récupérer le serverId du joueur - CORRECTION ICI
    const Player = require("../models/Player").default;
    const player = await Player.findOne({ playerId: playerId }).select("serverId");
    
    if (!player) {
      return res.status(404).json({
        success: false,
        error: "Player not found"
      });
    }

    const serverId = player.serverId;

    const { CampaignService } = require("../services/CampaignService");
    const validation = await CampaignService.canPlayerPlayLevel(
      playerId,
      serverId,
      worldNum,
      levelNum,
      difficulty
    );

    res.json({
      success: true,
      data: {
        stage: {
          world: worldNum,
          level: levelNum,
          difficulty,
          description: `${worldNum}-${levelNum} (${difficulty})`
        },
        validation: {
          allowed: validation.allowed,
          reason: validation.reason || null
        },
        canSetAsFarmTarget: validation.allowed
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur GET /afk-farming/validate:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * GET /afk-farming/recommendations
 * Obtenir des recommandations de farm personnalisées
 */
router.get("/recommendations", authMiddleware, async (req: any, res: any) => {
  try {
    const playerId = req.playerId!;
    
    console.log(`💡 GET /afk-farming/recommendations pour ${playerId}`);

    // Récupérer les stages disponibles pour générer des recommandations
    const stagesResult = await AfkFarmingService.getAvailableFarmingStages(playerId);
    
    if (!stagesResult.success) {
      return res.status(400).json({
        success: false,
        error: stagesResult.error
      });
    }

    const stages = stagesResult.stages || [];
    const recommendations = stagesResult.recommendations || [];

    // Générer des recommandations spécifiques
    const specificRecommendations = [];

    // Meilleur stage pour fragments communs
    const earlyStages = stages.filter(s => s.world <= 5 && s.difficulty === "Normal");
    if (earlyStages.length > 0) {
      const bestEarly = earlyStages[earlyStages.length - 1]; // Plus haut niveau monde 1-5
      specificRecommendations.push({
        type: "fragments",
        title: "Best for Common Hero Fragments",
        stage: bestEarly,
        reason: "High efficiency for collecting common hero fragments"
      });
    }

    // Meilleur stage pour matériaux (Hard/Nightmare)
    const hardStages = stages.filter(s => s.difficulty === "Hard");
    if (hardStages.length > 0) {
      const bestHard = hardStages[Math.floor(hardStages.length / 2)]; // Stage moyen en Hard
      specificRecommendations.push({
        type: "materials",
        title: "Best for Materials",
        stage: bestHard,
        reason: "50% more materials than Normal difficulty"
      });
    }

    // Stage Nightmare si disponible
    const nightmareStages = stages.filter(s => s.difficulty === "Nightmare");
    if (nightmareStages.length > 0) {
      const bestNightmare = nightmareStages[0]; // Premier stage Nightmare
      specificRecommendations.push({
        type: "endgame",
        title: "Best for Endgame Resources",
        stage: bestNightmare,
        reason: "Maximum rewards with rare materials"
      });
    }

    res.json({
      success: true,
      data: {
        generalRecommendations: recommendations,
        specificRecommendations,
        totalStagesAvailable: stages.length,
        summary: {
          hasCustomFarm: stages.some(s => s.isCurrentlyFarming && !s.isPlayerProgression),
          difficultiesUnlocked: [...new Set(stages.map(s => s.difficulty))],
          worldsAvailable: [...new Set(stages.map(s => s.world))].length
        }
      }
    });

  } catch (error: any) {
    console.error("❌ Erreur GET /afk-farming/recommendations:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

export default router;

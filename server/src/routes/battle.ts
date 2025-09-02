import express, { Request, Response } from "express";
import Joi from "joi";
import { BattleService } from "../services/BattleService";
import { IBattleOptions } from "../services/BattleEngine";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

const battleOptionsSchema = Joi.object({
  mode: Joi.string().valid("auto", "manual").default("auto"),
  speed: Joi.number().valid(1, 2, 3).default(1)
});

const campaignBattleSchema = Joi.object({
  worldId: Joi.number().min(1).max(100).required(),
  levelId: Joi.number().min(1).max(50).required(),
  difficulty: Joi.string().valid("Normal", "Hard", "Nightmare").default("Normal"),
  battleOptions: battleOptionsSchema.default({ mode: "auto", speed: 1 })
});

const arenaBattleSchema = Joi.object({
  opponentId: Joi.string().required(),
  battleOptions: battleOptionsSchema.default({ mode: "auto", speed: 1 })
});

const battleHistorySchema = Joi.object({
  limit: Joi.number().min(1).max(50).default(20)
});

const replaySchema = Joi.object({
  speed: Joi.number().valid(1, 2, 3).optional()
});

router.post("/campaign", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = campaignBattleSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { worldId, levelId, difficulty, battleOptions } = req.body;
    
    console.log(`🎯 ${req.userId} démarre combat: Monde ${worldId}, Niveau ${levelId}, ${difficulty} (${battleOptions.mode}, x${battleOptions.speed})`);

    const battleResult = await BattleService.startCampaignBattle(
      req.userId!,
      req.serverId!,
      worldId,
      levelId,
      difficulty,
      battleOptions as IBattleOptions
    );

    res.json({
      message: "Campaign battle completed",
      battleId: battleResult.battleId,
      victory: battleResult.result.victory,
      result: battleResult.result,
      battleOptions: battleOptions,
      replay: battleResult.replay
    });

  } catch (err: any) {
    console.error("Campaign battle error:", err);
    
    if (err.message === "Player not found") {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }
    
    if (err.message === "No equipped heroes found") {
      res.status(400).json({ 
        error: "You must equip at least one hero before battle",
        code: "NO_EQUIPPED_HEROES"
      });
      return;
    }
    
    if (err.message.includes("Vitesse") || err.message.includes("VIP")) {
      res.status(403).json({ 
        error: "Speed not allowed for your VIP level",
        code: "SPEED_NOT_ALLOWED"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "CAMPAIGN_BATTLE_FAILED"
    });
  }
});

router.post("/arena", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = arenaBattleSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { opponentId, battleOptions } = req.body;
    
    if (req.userId === opponentId) {
      res.status(400).json({ 
        error: "Cannot battle against yourself",
        code: "SELF_BATTLE_NOT_ALLOWED"
      });
      return;
    }

    console.log(`⚔️ Combat d'arène: ${req.userId} vs ${opponentId} (${battleOptions.mode}, x${battleOptions.speed})`);

    const battleResult = await BattleService.startArenaBattle(
      req.userId!,
      req.serverId!, 
      opponentId,
      battleOptions as IBattleOptions
    );

    res.json({
      message: "Arena battle completed",
      battleId: battleResult.battleId,
      victory: battleResult.result.victory,
      result: battleResult.result,
      battleOptions: battleOptions,
      replay: battleResult.replay
    });

  } catch (err: any) {
    console.error("Arena battle error:", err);
    
    if (err.message.includes("not found")) {
      res.status(404).json({ 
        error: "Player or opponent not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }
    
    if (err.message.includes("equipped heroes")) {
      res.status(400).json({ 
        error: "Both players must have equipped heroes",
        code: "MISSING_EQUIPPED_HEROES"
      });
      return;
    }
    
    if (err.message.includes("Vitesse") || err.message.includes("VIP")) {
      res.status(403).json({ 
        error: "Speed not allowed for your VIP level",
        code: "SPEED_NOT_ALLOWED"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "ARENA_BATTLE_FAILED"
    });
  }
});

router.get("/history", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = battleHistorySchema.validate(req.query);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { limit } = req.query;
    const limitNum = parseInt(limit as string) || 20;

    const history = await BattleService.getBattleHistory(req.userId!,req.serverId!, limitNum);

    res.json({
      message: "Battle history retrieved successfully",
      battles: history,
      total: history.length
    });

  } catch (err) {
    console.error("Get battle history error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_BATTLE_HISTORY_FAILED"
    });
  }
});

router.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await BattleService.getPlayerBattleStats(req.userId!, req.serverId!);

    res.json({
      message: "Battle statistics retrieved successfully",
      stats: {
        totalBattles: stats.totalBattles,
        victories: stats.victories,
        defeats: stats.totalBattles - stats.victories,
        winRate: Math.round((stats.winRate || 0) * 100) / 100,
        totalDamageDealt: stats.totalDamage,
        averageBattleDuration: Math.round(stats.avgBattleDuration || 0)
      }
    });

  } catch (err) {
    console.error("Get battle stats error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_BATTLE_STATS_FAILED"
    });
  }
});

router.get("/replay/:battleId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { battleId } = req.params;
    const { error } = replaySchema.validate(req.query);
    
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    if (!battleId) {
      res.status(400).json({ 
        error: "Battle ID is required",
        code: "BATTLE_ID_REQUIRED"
      });
      return;
    }

    const { speed } = req.query;
    const replaySpeed = speed ? parseInt(speed as string) as 1 | 2 | 3 : undefined;

    const replay = await BattleService.getBattleReplay(battleId, req.userId!, req.serverId!, replaySpeed);

    res.json({
      message: "Battle replay retrieved successfully",
      replay
    });

  } catch (err: any) {
    console.error("Get battle replay error:", err);
    
    if (err.message === "Battle not found") {
      res.status(404).json({ 
        error: "Battle not found",
        code: "BATTLE_NOT_FOUND"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_BATTLE_REPLAY_FAILED"
    });
  }
});

router.post("/quick", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`⚡ Combat rapide pour ${req.userId}`);

    const battleResult = await BattleService.startCampaignBattle(
      req.userId!, 
      req.serverId!,  
      1, 
      1, 
      "Normal",
      { mode: "auto", speed: 1 }
    );

    res.json({
      message: "Quick battle completed",
      victory: battleResult.result.victory,
      rewards: battleResult.result.rewards,
      summary: {
        totalTurns: battleResult.result.totalTurns,
        duration: `${Math.round(battleResult.result.battleDuration / 1000)}s`,
        damageDealt: battleResult.result.stats.totalDamageDealt,
        criticalHits: battleResult.result.stats.criticalHits,
        ultimatesUsed: battleResult.result.stats.ultimatesUsed
      }
    });

  } catch (err: any) {
    console.error("Quick battle error:", err);
    
    if (err.message === "No equipped heroes found") {
      res.status(400).json({ 
        error: "Please equip at least one hero first",
        code: "NO_EQUIPPED_HEROES",
        suggestion: "Use POST /api/heroes/equip to equip a hero"
      });
      return;
    }
    
    res.status(500).json({ 
      error: "Quick battle failed",
      code: "QUICK_BATTLE_FAILED"
    });
  }
});

router.get("/arena/opponents", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const opponents = [
      { id: "dummy1", username: "TestBot1", level: 10, power: 1500 },
      { id: "dummy2", username: "TestBot2", level: 15, power: 2000 },
      { id: "dummy3", username: "TestBot3", level: 8, power: 1200 }
    ];

    res.json({
      message: "Available opponents retrieved",
      opponents,
      note: "This is a placeholder implementation"
    });

  } catch (err) {
    console.error("Get opponents error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_OPPONENTS_FAILED"
    });
  }
});

router.post("/test", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV === "production") {
      res.status(404).json({ error: "Not available in production" });
      return;
    }

    console.log(`🧪 Test de combat pour ${req.userId}`);

    const testOptions: IBattleOptions = {
      mode: req.body.mode || "auto",
      speed: req.body.speed || 1
    };

    const battleResult = await BattleService.startCampaignBattle(
      req.userId!, 
      req.serverId!, 
      1, 
      1, 
      "Normal",
      testOptions
    );

    res.json({
      message: "Test battle completed",
      battleId: battleResult.battleId,
      result: battleResult.result,
      battleOptions: testOptions,
      actionsCount: battleResult.replay.actions.length,
      playerTeam: battleResult.replay.playerTeam.map((hero: any) => ({
        name: hero.name,
        role: hero.role,
        level: hero.level,
        finalHp: hero.currentHp
      })),
      enemyTeam: battleResult.replay.enemyTeam.map((enemy: any) => ({
        name: enemy.name,
        role: enemy.role,
        level: enemy.level,
        finalHp: enemy.currentHp
      })),
      replay: battleResult.replay
    });

  } catch (err: any) {
    console.error("Test battle error:", err);
    res.status(500).json({ 
      error: err.message,
      code: "TEST_BATTLE_FAILED"
    });
  }
});

export default router;

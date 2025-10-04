import express, { Request, Response } from 'express';
import { AchievementService } from '../services/AchievementService';
import authMiddleware from '../middleware/authMiddleware';

const router = express.Router();

/**
 * GET /api/achievements
 * Obtenir tous les achievements du joueur
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { playerId, serverId } = req.body;
    const { completed, claimed, category, includeHidden } = req.query;
    
    const filters = {
      completed: completed === 'true' ? true : completed === 'false' ? false : undefined,
      claimed: claimed === 'true' ? true : claimed === 'false' ? false : undefined,
      category: category as string,
      includeHidden: includeHidden === 'true'
    };
    
    const achievements = await AchievementService.getPlayerAchievements(
      playerId,
      serverId,
      filters
    );
    
    res.json({
      success: true,
      achievements,
      total: achievements.length
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/achievements/:achievementId/claim
 * Réclamer les récompenses d'un achievement
 */
router.post('/:achievementId/claim', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { playerId, serverId } = req.body;
    const { achievementId } = req.params;
    
    const result = await AchievementService.claimRewards(
      playerId,
      serverId,
      achievementId
    );
    
    res.json(result);
    
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/achievements/unclaimed
 * Obtenir les achievements non réclamés
 */
router.get('/unclaimed', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { playerId, serverId } = req.body;
    
    const unclaimed = await AchievementService.getPlayerAchievements(
      playerId,
      serverId,
      { completed: true, claimed: false }
    );
    
    res.json({
      success: true,
      unclaimed,
      count: unclaimed.length
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/achievements/leaderboard/:achievementId
 * Obtenir le classement d'un achievement
 */
router.get('/leaderboard/:achievementId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.body;
    const { achievementId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const leaderboard = await AchievementService.getAchievementLeaderboard(
      achievementId,
      serverId,
      limit
    );
    
    res.json({
      success: true,
      ...leaderboard
    });
    
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

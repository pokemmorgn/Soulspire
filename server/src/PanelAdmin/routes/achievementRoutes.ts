import { Router } from 'express';
import { AchievementService } from '../../services/AchievementService';
import Achievement from '../../models/Achievement';
import PlayerAchievement from '../../models/PlayerAchievement';

const router = Router();

// Liste tous les achievements
router.get('/achievements', async (req, res) => {
  try {
    const achievements = await Achievement.find().sort({ category: 1, name: 1 });
    res.json({ success: true, achievements });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Créer un achievement
router.post('/achievements', async (req, res) => {
  try {
    const achievement = await AchievementService.createAchievement(req.body);
    res.json({ success: true, achievement });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Mettre à jour
router.put('/achievements/:achievementId', async (req, res) => {
  try {
    const achievement = await AchievementService.updateAchievement(
      req.params.achievementId,
      req.body
    );
    res.json({ success: true, achievement });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Supprimer
router.delete('/achievements/:achievementId', async (req, res) => {
  try {
    await AchievementService.deleteAchievement(req.params.achievementId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Stats globales
router.get('/achievements/stats', async (req, res) => {
  try {
    const stats = await Achievement.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgPoints: { $avg: '$pointsValue' }
        }
      }
    ]);
    
    const totalPlayers = await PlayerAchievement.distinct('playerId').countDocuments();
    
    res.json({ success: true, stats, totalPlayers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

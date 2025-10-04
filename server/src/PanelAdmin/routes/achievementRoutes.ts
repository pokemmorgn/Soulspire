import { Router } from 'express';
import { AchievementService } from '../../services/AchievementService';
import Achievement from '../../models/Achievement';
import PlayerAchievement from '../../models/PlayerAchievement';

const router = Router();

// 🔧 CORRECTION : Routes commencent par '/' au lieu de '/achievements'
// Car déjà montées sur '/api/admin/achievements' dans serverAdmin.ts

// Liste tous les achievements
router.get('/', async (req, res) => {
  try {
    const achievements = await Achievement.find().sort({ category: 1, displayOrder: 1, name: 1 });
    res.json({ success: true, achievements });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🔧 IMPORTANT : Stats AVANT /:achievementId pour éviter de matcher "stats" comme un ID
// Stats globales des achievements
router.get('/stats', async (req, res) => {
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
    
    // 🔧 CORRECTION : await distinct() puis accéder à .length
    const playerIds = await PlayerAchievement.distinct('playerId');
    const totalPlayers = playerIds.length;
    
    res.json({ success: true, stats, totalPlayers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Créer un achievement
router.post('/', async (req, res) => {
  try {
    const achievement = await AchievementService.createAchievement(req.body);
    res.json({ success: true, achievement });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Détails d'un achievement spécifique
router.get('/:achievementId', async (req, res) => {
  try {
    const achievement = await Achievement.findOne({ achievementId: req.params.achievementId });
    if (!achievement) {
      return res.status(404).json({ success: false, error: 'Achievement not found' });
    }
    res.json({ success: true, achievement });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mettre à jour un achievement
router.put('/:achievementId', async (req, res) => {
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

// Supprimer un achievement
router.delete('/:achievementId', async (req, res) => {
  try {
    await AchievementService.deleteAchievement(req.params.achievementId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;

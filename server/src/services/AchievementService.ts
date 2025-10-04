// server/src/services/AchievementService.ts
import { achievementEmitter, AchievementEvent, IAchievementEventData } from '../utils/AchievementEmitter';
import Achievement, { IAchievement, IAchievementCriteria } from '../models/Achievement';
import PlayerAchievement, { IPlayerAchievement, IPlayerAchievementProgress } from '../models/PlayerAchievement';
import Player from '../models/Player';

export class AchievementService {
  
  private static initialized = false;
  
  /**
   * Initialiser les listeners d'événements (appelé au démarrage du serveur)
   */
  static initialize() {
    if (this.initialized) {
      console.warn('⚠️ AchievementService already initialized');
      return;
    }
    
    console.log('🏆 Initializing Achievement System...');
    
    // Progression
    achievementEmitter.on(AchievementEvent.WORLD_REACHED, (data: IAchievementEventData) => {
      this.handleEvent('world_reached', data);
    });
    
    achievementEmitter.on(AchievementEvent.STAGE_CLEARED, (data: IAchievementEventData) => {
      this.handleEvent('stage_cleared', data);
    });
    
    achievementEmitter.on(AchievementEvent.TOWER_FLOOR, (data: IAchievementEventData) => {
      this.handleEvent('tower_floor', data);
    });
    
    // Combat
    achievementEmitter.on(AchievementEvent.BATTLE_WON, (data: IAchievementEventData) => {
      this.handleEvent('battle_won', data);
    });
    
    achievementEmitter.on(AchievementEvent.BOSS_DEFEATED, (data: IAchievementEventData) => {
      this.handleEvent('boss_defeated', data);
    });
    
    achievementEmitter.on(AchievementEvent.PERFECT_VICTORY, (data: IAchievementEventData) => {
      this.handleEvent('perfect_victory', data);
    });
    
    // Collection
    achievementEmitter.on(AchievementEvent.HERO_COLLECTED, (data: IAchievementEventData) => {
      this.handleEvent('hero_collected', data);
    });
    
    achievementEmitter.on(AchievementEvent.HERO_ASCENDED, (data: IAchievementEventData) => {
      this.handleEvent('hero_ascended', data);
    });
    
    // Économie
    achievementEmitter.on(AchievementEvent.GOLD_SPENT, (data: IAchievementEventData) => {
      this.handleEvent('gold_spent', data);
    });
    
    achievementEmitter.on(AchievementEvent.GACHA_PULL, (data: IAchievementEventData) => {
      this.handleEvent('gacha_pull', data);
    });
    
    // PvP
    achievementEmitter.on(AchievementEvent.ARENA_VICTORY, (data: IAchievementEventData) => {
      this.handleEvent('arena_victory', data);
    });
    
    // VIP / Compte
    achievementEmitter.on(AchievementEvent.PLAYER_LEVEL_REACHED, (data: IAchievementEventData) => {
      this.handleEvent('player_level_reached', data);
    });
    
    achievementEmitter.on(AchievementEvent.VIP_LEVEL_REACHED, (data: IAchievementEventData) => {
      this.handleEvent('vip_level_reached', data);
    });
    
    this.initialized = true;
    console.log('✅ Achievement System initialized');
  }
  
  /**
   * Handler centralisé pour tous les événements
   */
  private static async handleEvent(eventType: string, data: IAchievementEventData) {
    try {
      await this.updatePlayerProgress(
        data.playerId,
        data.serverId,
        eventType,
        data.value || 1,
        data.metadata
      );
    } catch (error) {
      console.error(`❌ Error handling achievement event ${eventType}:`, error);
    }
  }
  
  /**
   * Mettre à jour la progression des achievements d'un joueur
   */
  static async updatePlayerProgress(
    playerId: string,
    serverId: string,
    eventType: string,
    value: number,
    metadata?: any
  ): Promise<IPlayerAchievement[]> {
    try {
      // Récupérer tous les achievements actifs correspondant à cet événement
      const relevantAchievements = await this.findRelevantAchievements(
        serverId,
        eventType,
        metadata
      );
      
      if (relevantAchievements.length === 0) {
        return [];
      }
      
      const updatedAchievements: IPlayerAchievement[] = [];
      
      for (const achievement of relevantAchievements) {
        // Gérer les achievements "first" (unique)
        if (achievement.isUnique && achievement.firstPlayerToComplete) {
          continue; // Déjà pris par quelqu'un d'autre
        }
        
        // Récupérer ou créer la progression du joueur
        const initialProgress = this.initializeProgress(achievement.criteria);
        const playerAchievement = await PlayerAchievement.getOrCreate(
          playerId,
          serverId,
          achievement.achievementId,
          initialProgress
        );
        
        if (playerAchievement.isCompleted) {
          continue; // Déjà complété
        }
        
        // Mettre à jour la progression pour chaque critère concerné
        let hasUpdates = false;
        
        for (let i = 0; i < achievement.criteria.length; i++) {
          const criteria = achievement.criteria[i];
          
          if (criteria.type === eventType) {
            // Vérifier si les metadata matchent (si spécifiés)
            if (this.metadataMatches(criteria.metadata, metadata)) {
              const currentProgress = playerAchievement.progress[i];
              
              // Mettre à jour la valeur (cumulative ou set)
              let newValue: number;
              
              if (this.isCumulativeEvent(eventType)) {
                // Événements cumulatifs (battle_won, gold_spent, etc.)
                newValue = currentProgress.currentValue + value;
              } else {
                // Événements de milestone (world_reached, tower_floor, etc.)
                newValue = Math.max(currentProgress.currentValue, value);
              }
              
              const wasCompleted = playerAchievement.updateCriteriaProgress(i, newValue);
              hasUpdates = true;
              
              if (wasCompleted) {
                // Achievement débloqué!
                await this.onAchievementUnlocked(playerAchievement, achievement, playerId, serverId);
              }
            }
          }
        }
        
        if (hasUpdates) {
          await playerAchievement.save();
          updatedAchievements.push(playerAchievement);
        }
      }
      
      return updatedAchievements;
      
    } catch (error) {
      console.error('❌ Error updating player progress:', error);
      throw error;
    }
  }
  
  /**
   * Callback quand un achievement est débloqué
   */
  private static async onAchievementUnlocked(
    playerAchievement: IPlayerAchievement,
    achievement: IAchievement,
    playerId: string,
    serverId: string
  ) {
    console.log(`🎉 Achievement unlocked: ${achievement.name} for player ${playerId}`);
    
    // Si c'est un achievement "first", le marquer comme pris
    if (achievement.isUnique && !achievement.firstPlayerToComplete) {
      const player = await Player.findOne({ _id: playerId, serverId });
      
      achievement.firstPlayerToComplete = playerId;
      achievement.firstPlayerName = player?.displayName || 'Unknown';
      achievement.completedAt = new Date();
      await achievement.save();
      
      console.log(`🏆 FIRST! ${player?.displayName} is the first to complete: ${achievement.name}`);
    }
    
    // Marquer pour notification (sera envoyée au prochain login ou en temps réel)
    playerAchievement.notified = false;
    
    // TODO: Envoyer notification en temps réel si le joueur est connecté
    // NotificationService.sendAchievementUnlock(playerId, achievement);
  }
  
  /**
   * Réclamer les récompenses d'un achievement
   */
  static async claimRewards(
    playerId: string,
    serverId: string,
    achievementId: string
  ): Promise<any> {
    try {
      const playerAchievement = await PlayerAchievement.findOne({
        playerId,
        serverId,
        achievementId,
        isCompleted: true,
        rewardsClaimed: false
      });
      
      if (!playerAchievement) {
        throw new Error('Achievement not found or already claimed');
      }
      
      const achievement = await Achievement.findOne({ achievementId });
      if (!achievement) {
        throw new Error('Achievement definition not found');
      }
      
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error('Player not found');
      }
      
      // Appliquer les récompenses
      const rewards = achievement.rewards;
      
      if (rewards.gold) {
        player.gold += rewards.gold;
      }
      
      if (rewards.gems) {
        player.gems += rewards.gems;
      }
      
      if (rewards.tickets) {
        player.tickets += rewards.tickets;
      }
      
      // TODO: Ajouter items et fragments à l'inventaire
      // if (rewards.items) { ... }
      // if (rewards.fragments) { ... }
      
      await player.save();
      
      // Marquer comme réclamé
      playerAchievement.rewardsClaimed = true;
      playerAchievement.claimedAt = new Date();
      await playerAchievement.save();
      
      console.log(`💰 Rewards claimed for ${achievement.name}: ${JSON.stringify(rewards)}`);
      
      return {
        success: true,
        rewards,
        playerAchievement
      };
      
    } catch (error) {
      console.error('❌ Error claiming rewards:', error);
      throw error;
    }
  }
  
  /**
   * Obtenir tous les achievements d'un joueur
   */
  static async getPlayerAchievements(
    playerId: string,
    serverId: string,
    filters?: {
      completed?: boolean;
      claimed?: boolean;
      category?: string;
      includeHidden?: boolean;
    }
  ): Promise<any[]> {
    try {
      const query: any = {};
      
      if (filters?.completed !== undefined) {
        query.isCompleted = filters.completed;
      }
      
      if (filters?.claimed !== undefined) {
        query.rewardsClaimed = filters.claimed;
      }
      
      const playerAchievements = await PlayerAchievement.find({
        playerId,
        serverId,
        ...query
      });
      
      // Récupérer les définitions d'achievements
      const achievementIds = playerAchievements.map(pa => pa.achievementId);
      
      const achievementQuery: any = {
        achievementId: { $in: achievementIds },
        isActive: true
      };
      
      if (filters?.category) {
        achievementQuery.category = filters.category;
      }
      
      if (!filters?.includeHidden) {
        achievementQuery.$or = [
          { isHidden: false },
          { achievementId: { $in: playerAchievements.filter(pa => pa.isCompleted).map(pa => pa.achievementId) } }
        ];
      }
      
      const achievements = await Achievement.find(achievementQuery);
      
      // Fusionner les données
      const result = playerAchievements.map(pa => {
        const achievement = achievements.find(a => a.achievementId === pa.achievementId);
        
        return {
          ...pa.toObject(),
          achievementData: achievement?.toObject()
        };
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Error getting player achievements:', error);
      throw error;
    }
  }
  
  /**
   * Obtenir le leaderboard d'un achievement
   */
  static async getAchievementLeaderboard(
    achievementId: string,
    serverId: string,
    limit: number = 100
  ): Promise<any> {
    try {
      const achievement = await Achievement.findOne({ achievementId, isActive: true });
      
      if (!achievement) {
        throw new Error('Achievement not found');
      }
      
      if (!achievement.isLeaderboard) {
        throw new Error('Achievement is not a leaderboard');
      }
      
      const leaderboard = await PlayerAchievement.getLeaderboard(
        achievementId,
        serverId,
        limit
      );
      
      return {
        achievement: achievement.toObject(),
        leaderboard: leaderboard.map((entry: any, index: number) => ({
          rank: index + 1,
          playerId: entry.playerId,
          playerName: entry.playerId?.displayName || 'Unknown',
          score: entry.currentScore,
          completedAt: entry.completedAt
        }))
      };
      
    } catch (error) {
      console.error('❌ Error getting leaderboard:', error);
      throw error;
    }
  }
  
  /**
   * Admin: Créer un achievement
   */
  static async createAchievement(data: Partial<IAchievement>): Promise<IAchievement> {
    try {
      const achievement = new Achievement(data);
      await achievement.save();
      
      console.log(`✅ Achievement created: ${achievement.name} (${achievement.achievementId})`);
      
      return achievement;
      
    } catch (error) {
      console.error('❌ Error creating achievement:', error);
      throw error;
    }
  }
  
  /**
   * Admin: Mettre à jour un achievement
   */
  static async updateAchievement(
    achievementId: string,
    updates: Partial<IAchievement>
  ): Promise<IAchievement | null> {
    try {
      const achievement = await Achievement.findOneAndUpdate(
        { achievementId },
        updates,
        { new: true, runValidators: true }
      );
      
      if (!achievement) {
        throw new Error('Achievement not found');
      }
      
      console.log(`✅ Achievement updated: ${achievement.name}`);
      
      return achievement;
      
    } catch (error) {
      console.error('❌ Error updating achievement:', error);
      throw error;
    }
  }
  
  /**
   * Admin: Supprimer un achievement
   */
  static async deleteAchievement(achievementId: string): Promise<boolean> {
    try {
      const result = await Achievement.deleteOne({ achievementId });
      
      if (result.deletedCount === 0) {
        throw new Error('Achievement not found');
      }
      
      // Optionnel: Supprimer aussi les progressions joueurs
      // await PlayerAchievement.deleteMany({ achievementId });
      
      console.log(`✅ Achievement deleted: ${achievementId}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error deleting achievement:', error);
      throw error;
    }
  }
  
  // === MÉTHODES UTILITAIRES PRIVÉES ===
  
  /**
   * Trouver les achievements pertinents pour un type d'événement
   */
  private static async findRelevantAchievements(
    serverId: string,
    eventType: string,
    metadata?: any
  ): Promise<IAchievement[]> {
    const query: any = {
      isActive: true,
      'criteria.type': eventType,
      $or: [
        { scope: 'global' },
        { scope: 'server', serverId }
      ]
    };
    
    // Filtrer par dates si applicable
    const now = new Date();
    query.$and = [
      { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] }
    ];
    
    return await Achievement.find(query);
  }
  
  /**
   * Initialiser la progression pour un achievement
   */
  private static initializeProgress(criteria: IAchievementCriteria[]): IPlayerAchievementProgress[] {
    return criteria.map((c, index) => ({
      criteriaIndex: index,
      currentValue: 0,
      targetValue: c.target,
      completed: false
    }));
  }
  
  /**
   * Vérifier si les metadata correspondent
   */
  private static metadataMatches(criteriaMetadata?: any, eventMetadata?: any): boolean {
    if (!criteriaMetadata) return true;
    if (!eventMetadata) return false;
    
    for (const key in criteriaMetadata) {
      if (criteriaMetadata[key] !== eventMetadata[key]) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Déterminer si un événement est cumulatif
   */
  private static isCumulativeEvent(eventType: string): boolean {
    const cumulativeEvents = [
      'battle_won',
      'battle_lost',
      'boss_defeated',
      'gold_spent',
      'gold_earned',
      'gems_spent',
      'gacha_pull',
      'hero_collected',
      'total_damage_dealt',
      'critical_hits',
      'ultimates_used'
    ];
    
    return cumulativeEvents.includes(eventType);
  }
}

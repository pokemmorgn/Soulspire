import { EventEmitter } from 'events';

/**
 * Émetteur d'événements centralisé pour le système d'achievements
 * Inspiré du système de dispatching d'événements d'Unreal Engine
 */
class AchievementEmitter extends EventEmitter {
  constructor() {
    super();
    // Augmenter la limite de listeners pour supporter de nombreux achievements
    this.setMaxListeners(100);
  }
}

export const achievementEmitter = new AchievementEmitter();

/**
 * Énumération de tous les types d'événements achievements
 * Chaque événement correspond à une action trackable dans le jeu
 */
export enum AchievementEvent {
  // === PROGRESSION ===
  WORLD_REACHED = 'world_reached',
  STAGE_CLEARED = 'stage_cleared',
  TOWER_FLOOR = 'tower_floor',
  DIFFICULTY_UNLOCKED = 'difficulty_unlocked',
  CAMPAIGN_COMPLETED = 'campaign_completed',
  
  // === COMBAT ===
  BATTLE_WON = 'battle_won',
  BATTLE_LOST = 'battle_lost',
  PERFECT_VICTORY = 'perfect_victory',        // Victoire sans perte de HP
  BOSS_DEFEATED = 'boss_defeated',
  ELITE_DEFEATED = 'elite_defeated',
  WAVE_COMPLETED = 'wave_completed',
  CONSECUTIVE_WINS = 'consecutive_wins',
  
  // === COLLECTION ===
  HERO_COLLECTED = 'hero_collected',
  HERO_LEVEL_REACHED = 'hero_level_reached',
  HERO_ASCENDED = 'hero_ascended',
  HERO_AWAKENED = 'hero_awakened',
  HERO_STARS_REACHED = 'hero_stars_reached',
  FULL_TEAM_ELEMENT = 'full_team_element',    // Équipe mono-élément
  COLLECTION_MILESTONE = 'collection_milestone', // X héros collectés
  
  // === ÉCONOMIE ===
  GOLD_EARNED = 'gold_earned',
  GOLD_SPENT = 'gold_spent',
  GEMS_EARNED = 'gems_earned',
  GEMS_SPENT = 'gems_spent',
  GACHA_PULL = 'gacha_pull',
  SHOP_PURCHASE = 'shop_purchase',
  
  // === SOCIAL ===
  GUILD_JOINED = 'guild_joined',
  GUILD_CONTRIBUTION = 'guild_contribution',
  FRIEND_ADDED = 'friend_added',
  MESSAGE_SENT = 'message_sent',
  
  // === PVP / ARÈNE ===
  ARENA_VICTORY = 'arena_victory',
  ARENA_DEFEAT = 'arena_defeat',
  ARENA_RANK_REACHED = 'arena_rank_reached',
  ARENA_STREAK = 'arena_streak',
  
  // === VIP / PROGRESSION COMPTE ===
  PLAYER_LEVEL_REACHED = 'player_level_reached',
  VIP_LEVEL_REACHED = 'vip_level_reached',
  LOGIN_STREAK = 'login_streak',
  DAILY_QUEST_COMPLETED = 'daily_quest_completed',
  WEEKLY_QUEST_COMPLETED = 'weekly_quest_completed',
  
  // === SPÉCIAL / ÉVÉNEMENTS ===
  EVENT_COMPLETED = 'event_completed',
  LIMITED_ACHIEVEMENT = 'limited_achievement',
  SEASONAL_MILESTONE = 'seasonal_milestone',
  
  // === STATISTIQUES ===
  TOTAL_DAMAGE_DEALT = 'total_damage_dealt',
  TOTAL_HEALING_DONE = 'total_healing_done',
  CRITICAL_HITS = 'critical_hits',
  ULTIMATES_USED = 'ultimates_used',
}

/**
 * Interface pour les données transmises avec chaque événement
 */
export interface IAchievementEventData {
  playerId: string;
  serverId: string;
  value?: number;              // Valeur numérique (quantité, niveau, etc.)
  metadata?: {                 // Métadonnées contextuelles
    worldId?: number;
    levelId?: number;
    difficulty?: string;
    battleType?: string;
    heroId?: string;
    rarity?: string;
    element?: string;
    guildId?: string;
    eventId?: string;
    [key: string]: any;        // Flexibilité pour données custom
  };
}

/**
 * Helper pour émettre des événements avec validation de type
 */
export class AchievementEventHelper {
  /**
   * Émettre un événement achievement de manière type-safe
   */
  static emit(event: AchievementEvent, data: IAchievementEventData): void {
    if (!data.playerId || !data.serverId) {
      console.warn(`⚠️ Achievement event ${event} missing required data (playerId or serverId)`);
      return;
    }
    
    achievementEmitter.emit(event, data);
  }
  
  /**
   * Émettre plusieurs événements en batch (optimisation)
   */
  static emitBatch(events: Array<{ event: AchievementEvent; data: IAchievementEventData }>): void {
    for (const { event, data } of events) {
      this.emit(event, data);
    }
  }
}

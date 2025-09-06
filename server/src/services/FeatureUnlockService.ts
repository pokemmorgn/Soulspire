import Player from "../models/Player";

// Types de conditions de déblocage
export type UnlockConditionType = "level" | "world" | "stage" | "tutorial" | "heroes_count" | "vip_level";

// Interface pour une condition de déblocage
export interface UnlockCondition {
  type: UnlockConditionType;
  value: number;
  description: string;
}

// Interface pour une feature débloquable
export interface FeatureUnlock {
  featureId: string;
  name: string;
  description: string;
  category: "gameplay" | "progression" | "social" | "monetization";
  condition: UnlockCondition;
  iconUrl?: string;
  tutorialStep?: string;
  isCore: boolean; // True = feature essentielle, False = feature bonus
}

// Interface pour le statut d'une feature pour un joueur
export interface PlayerFeatureStatus {
  featureId: string;
  isUnlocked: boolean;
  condition: UnlockCondition;
  currentValue: number;
  progression: number; // 0-100%
  unlockMessage?: string;
}

// Configuration des déblocages (comme AFK Arena)
const FEATURE_UNLOCKS: FeatureUnlock[] = [
  // === CORE GAMEPLAY ===
  {
    featureId: "campaign",
    name: "Campagne",
    description: "Mode histoire principal",
    category: "gameplay",
    condition: { type: "level", value: 1, description: "Disponible dès le début" },
    isCore: true
  },
  {
    featureId: "shop_basic",
    name: "Boutique",
    description: "Acheter des objets de base",
    category: "gameplay", 
    condition: { type: "level", value: 3, description: "Débloqué au niveau 3" },
    isCore: true
  },
  {
    featureId: "gacha",
    name: "Taverne",
    description: "Invoquer de nouveaux héros",
    category: "progression",
    condition: { type: "level", value: 8, description: "Débloqué au niveau 8" },
    isCore: true
  },
  {
    featureId: "hero_upgrade",
    name: "Amélioration Héros", 
    description: "Améliorer niveau et étoiles des héros",
    category: "progression",
    condition: { type: "level", value: 10, description: "Débloqué au niveau 10" },
    isCore: true
  },
  {
    featureId: "formations",
    name: "Formations",
    description: "Gérer plusieurs formations de combat",
    category: "gameplay",
    condition: { type: "level", value: 12, description: "Débloqué au niveau 12" },
    isCore: true
  },
  
  // === TOWER ET CHALLENGES ===
  {
    featureId: "tower",
    name: "Tour des Rêves",
    description: "Défi en étages infinis",
    category: "gameplay",
    condition: { type: "world", value: 3, description: "Débloqué au monde 3" },
    isCore: true
  },
  {
    featureId: "campaign_hard",
    name: "Mode Difficile",
    description: "Campagne en difficulté Hard",
    category: "gameplay",
    condition: { type: "world", value: 8, description: "Débloqué après avoir terminé le monde 8 en Normal" },
    isCore: true
  },
  {
    featureId: "campaign_nightmare", 
    name: "Mode Cauchemar",
    description: "Campagne en difficulté Nightmare",
    category: "gameplay",
    condition: { type: "world", value: 12, description: "Débloqué après avoir terminé le monde 12 en Hard" },
    isCore: true
  },
  
  // === PVP ET SOCIAL ===
  {
    featureId: "arena",
    name: "Arène",
    description: "Combat PvP asynchrone", 
    category: "social",
    condition: { type: "level", value: 25, description: "Débloqué au niveau 25" },
    isCore: true
  },
  {
    featureId: "guild",
    name: "Guilde",
    description: "Rejoindre une guilde et participer aux raids",
    category: "social",
    condition: { type: "level", value: 35, description: "Débloqué au niveau 35" },
    isCore: true
  },
  
  // === FEATURES AVANCÉES ===
  {
    featureId: "bounty_board",
    name: "Tableau des Primes",
    description: "Missions quotidiennes avancées",
    category: "progression",
    condition: { type: "level", value: 40, description: "Débloqué au niveau 40" },
    isCore: false
  },
  {
    featureId: "faction_tower",
    name: "Tours de Faction",
    description: "Tours spécialisées par élément",
    category: "gameplay", 
    condition: { type: "world", value: 15, description: "Débloqué au monde 15" },
    isCore: false
  },
  {
    featureId: "labyrinth",
    name: "Labyrinthe",
    description: "Exploration avec récompenses uniques",
    category: "gameplay",
    condition: { type: "level", value: 50, description: "Débloqué au niveau 50" },
    isCore: false
  },
  
  // === MONETIZATION ÉTHIQUE ===
  {
    featureId: "vip_rewards",
    name: "Récompenses VIP",
    description: "Récompenses quotidiennes VIP",
    category: "monetization",
    condition: { type: "level", value: 15, description: "Débloqué au niveau 15" },
    isCore: false
  },
  {
    featureId: "shop_premium",
    name: "Boutique Premium",
    description: "Objets premium et packs spéciaux",
    category: "monetization",
    condition: { type: "level", value: 20, description: "Débloqué au niveau 20" },
    isCore: false
  }
];

export class FeatureUnlockService {
  
  // === MÉTHODES PRINCIPALES ===
  
  /**
   * Vérifier si une feature est débloquée pour un joueur
   */
  public static async isFeatureUnlocked(playerId: string, serverId: string, featureId: string): Promise<boolean> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }
      
      const feature = FEATURE_UNLOCKS.find(f => f.featureId === featureId);
      if (!feature) {
        console.warn(`Feature '${featureId}' not found in unlock configuration`);
        return false;
      }
      
      return this.checkUnlockCondition(player, feature.condition);
      
    } catch (error) {
      console.error(`Error checking feature unlock for ${featureId}:`, error);
      return false;
    }
  }
  
  /**
   * Obtenir toutes les features et leur statut pour un joueur
   */
  public static async getPlayerFeatureStatus(playerId: string, serverId: string): Promise<PlayerFeatureStatus[]> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found");
      }
      
      const featureStatuses: PlayerFeatureStatus[] = [];
      
      for (const feature of FEATURE_UNLOCKS) {
        const currentValue = this.getCurrentValue(player, feature.condition.type);
        const isUnlocked = this.checkUnlockCondition(player, feature.condition);
        const progression = Math.min(100, Math.max(0, (currentValue / feature.condition.value) * 100));
        
        featureStatuses.push({
          featureId: feature.featureId,
          isUnlocked,
          condition: feature.condition,
          currentValue,
          progression: Math.round(progression),
          unlockMessage: isUnlocked ? `${feature.name} débloqué !` : undefined
        });
      }
      
      return featureStatuses;
      
    } catch (error) {
      console.error("Error getting player feature status:", error);
      throw error;
    }
  }
  
  /**
   * Obtenir les features récemment débloquées
   */
  public static async getRecentlyUnlockedFeatures(playerId: string, serverId: string): Promise<FeatureUnlock[]> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return [];
      }
      
      const recentlyUnlocked: FeatureUnlock[] = [];
      
      for (const feature of FEATURE_UNLOCKS) {
        const currentValue = this.getCurrentValue(player, feature.condition.type);
        
        // Vérifier si la feature vient d'être débloquée (dans la dernière progression)
        if (currentValue === feature.condition.value && this.checkUnlockCondition(player, feature.condition)) {
          recentlyUnlocked.push(feature);
        }
      }
      
      return recentlyUnlocked;
      
    } catch (error) {
      console.error("Error getting recently unlocked features:", error);
      return [];
    }
  }
  
  /**
   * Obtenir la prochaine feature à débloquer
   */
  public static async getNextUnlock(playerId: string, serverId: string): Promise<FeatureUnlock | null> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return null;
      }
      
      const unlockedFeatures = await this.getUnlockedFeatures(playerId, serverId);
      const unlockedIds = unlockedFeatures.map(f => f.featureId);
      
      // Trouver la prochaine feature core non débloquée
      const nextCoreFeature = FEATURE_UNLOCKS
        .filter(f => f.isCore && !unlockedIds.includes(f.featureId))
        .sort((a, b) => a.condition.value - b.condition.value)[0];
      
      return nextCoreFeature || null;
      
    } catch (error) {
      console.error("Error getting next unlock:", error);
      return null;
    }
  }
  
  /**
   * Obtenir toutes les features débloquées
   */
  public static async getUnlockedFeatures(playerId: string, serverId: string): Promise<FeatureUnlock[]> {
    try {
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return [];
      }
      
      const unlockedFeatures: FeatureUnlock[] = [];
      
      for (const feature of FEATURE_UNLOCKS) {
        if (this.checkUnlockCondition(player, feature.condition)) {
          unlockedFeatures.push(feature);
        }
      }
      
      return unlockedFeatures;
      
    } catch (error) {
      console.error("Error getting unlocked features:", error);
      return [];
    }
  }
  
  // === MÉTHODES UTILITAIRES ===
  
  /**
   * Vérifier une condition de déblocage
   */
  private static checkUnlockCondition(player: any, condition: UnlockCondition): boolean {
    const currentValue = this.getCurrentValue(player, condition.type);
    return currentValue >= condition.value;
  }
  
  /**
   * Obtenir la valeur actuelle selon le type de condition
   */
  private static getCurrentValue(player: any, conditionType: UnlockConditionType): number {
    switch (conditionType) {
      case "level":
        return player.level || 1;
      case "world":
        return player.world || 1;
      case "stage":
        return player.stage || 1;
      case "heroes_count":
        return player.heroes ? player.heroes.length : 0;
      case "vip_level":
        return player.vipLevel || 0;
      case "tutorial":
        return player.tutorialCompleted ? 1 : 0;
      default:
        return 0;
    }
  }
  
  /**
   * Obtenir la configuration d'une feature
   */
  public static getFeatureConfig(featureId: string): FeatureUnlock | null {
    return FEATURE_UNLOCKS.find(f => f.featureId === featureId) || null;
  }
  
  /**
   * Obtenir toutes les features par catégorie
   */
  public static getFeaturesByCategory(category: string): FeatureUnlock[] {
    return FEATURE_UNLOCKS.filter(f => f.category === category);
  }
  
  /**
   * Validation middleware helper pour les routes
   */
  public static async validateFeatureAccess(playerId: string, serverId: string, featureId: string): Promise<void> {
    const isUnlocked = await this.isFeatureUnlocked(playerId, serverId, featureId);
    
    if (!isUnlocked) {
      const feature = this.getFeatureConfig(featureId);
      const errorMessage = feature 
        ? `Feature '${feature.name}' non débloquée. ${feature.condition.description}`
        : `Feature '${featureId}' non trouvée`;
      
      throw new Error(errorMessage);
    }
  }
  
  // === MÉTHODES D'ADMINISTRATION ===
  
  /**
   * Obtenir les statistiques de déblocage pour le serveur
   */
  public static async getServerUnlockStats(serverId: string) {
    try {
      const players = await Player.find({ serverId }).select('level world vipLevel heroes tutorialCompleted');
      
      const stats = {
        totalPlayers: players.length,
        featureStats: {} as Record<string, { unlockedCount: number; percentage: number }>
      };
      
      for (const feature of FEATURE_UNLOCKS) {
        const unlockedCount = players.filter(player => 
          this.checkUnlockCondition(player, feature.condition)
        ).length;
        
        stats.featureStats[feature.featureId] = {
          unlockedCount,
          percentage: players.length > 0 ? Math.round((unlockedCount / players.length) * 100) : 0
        };
      }
      
      return stats;
      
    } catch (error) {
      console.error("Error getting server unlock stats:", error);
      throw error;
    }
  }
  
  /**
   * Obtenir la liste complète des features configurées
   */
  public static getAllFeatures(): FeatureUnlock[] {
    return [...FEATURE_UNLOCKS];
  }
}

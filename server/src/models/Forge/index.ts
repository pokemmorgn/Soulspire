import { ForgeCore, IForgeModuleConfig, IForgeOperationResult, IForgeResourceCost } from "./ForgeCore";
import { ForgeReforgeService, IReforgeResult } from "./ForgeReforge";

// === INTERFACE PRINCIPALE DU SERVICE FORGE ===

export interface IForgeServiceConfig {
  reforge: IForgeModuleConfig;
  enhancement?: IForgeModuleConfig;
  fusion?: IForgeModuleConfig;
  tierUpgrade?: IForgeModuleConfig;
}

export interface IForgeStatus {
  playerId: string;
  playerResources: {
    gold: number;
    gems: number;
    paidGems: number;
  };
  modules: {
    reforge: {
      enabled: boolean;
      stats: any;
      availableOperations: number;
    };
    enhancement?: {
      enabled: boolean;
      stats: any;
      maxLevel: number;
    };
    fusion?: {
      enabled: boolean;
      stats: any;
      availableRecipes: number;
    };
    tierUpgrade?: {
      enabled: boolean;
      stats: any;
      availableUpgrades: number;
    };
  };
  inventory: {
    reforgeableItems: number;
    enhanceableItems: number;
    fusableItems: number;
    upgradeableItems: number;
  };
}

// === CONFIGURATION PAR DÉFAUT ===

export const DEFAULT_FORGE_SERVICE_CONFIG: IForgeServiceConfig = {
  reforge: {
    enabled: true,
    baseGoldCost: 1000,
    baseGemCost: 50,
    materialRequirements: {
      "Common": { "iron_ore": 2 },
      "Rare": { "magic_crystal": 1 },
      "Epic": { "dragon_scale": 1 },
      "Legendary": { "awakening_stone": 1 }
    },
    levelRestrictions: {
      minPlayerLevel: 1
    }
  },
  enhancement: {
    enabled: true,
    baseGoldCost: 500,
    baseGemCost: 25,
    materialRequirements: {
      "Common": { "enhancement_stone_basic": 1 },
      "Rare": { "enhancement_stone_basic": 2, "enhancement_stone_advanced": 1 },
      "Epic": { "enhancement_stone_advanced": 2, "enhancement_stone_master": 1 },
      "Legendary": { "enhancement_stone_master": 2, "enhancement_stone_legendary": 1 }
    },
    levelRestrictions: {
      minPlayerLevel: 1
    }
  },
  fusion: {
    enabled: true,
    baseGoldCost: 2000,
    baseGemCost: 100,
    materialRequirements: {
      "Common": { "fusion_catalyst_basic": 1 },
      "Rare": { "fusion_catalyst_advanced": 1 },
      "Epic": { "fusion_catalyst_master": 1 }
    },
    levelRestrictions: {
      minPlayerLevel: 10
    }
  },
  tierUpgrade: {
    enabled: true,
    baseGoldCost: 5000,
    baseGemCost: 200,
    materialRequirements: {
      "Common": { "tier_essence_basic": 5 },
      "Rare": { "tier_essence_advanced": 3 },
      "Epic": { "tier_essence_master": 2 },
      "Legendary": { "tier_essence_legendary": 1 }
    },
    levelRestrictions: {
      minPlayerLevel: 15
    }
  }
};

// === SERVICE PRINCIPAL DE LA FORGE ===

export class ForgeService extends ForgeCore {
  private config: IForgeServiceConfig;
  private reforgeService: ForgeReforgeService;
  
  // Placeholder pour les autres services (à implémenter)
  // private enhancementService: ForgeEnhancementService;
  // private fusionService: ForgeFusionService;
  // private tierUpgradeService: ForgeTierUpgradeService;

  constructor(playerId: string, config: IForgeServiceConfig = DEFAULT_FORGE_SERVICE_CONFIG) {
    super(playerId);
    this.config = config;
    
    // Initialiser le service de reforge
    this.reforgeService = new ForgeReforgeService(playerId, config.reforge);
    
    // TODO: Initialiser les autres services quand ils seront créés
    // this.enhancementService = new ForgeEnhancementService(playerId, config.enhancement);
    // this.fusionService = new ForgeFusionService(playerId, config.fusion);
    // this.tierUpgradeService = new ForgeTierUpgradeService(playerId, config.tierUpgrade);
  }

  // === MÉTHODES PUBLIQUES PRINCIPALES ===

  /**
   * Récupère le statut complet de la forge pour ce joueur
   */
  async getForgeStatus(): Promise<IForgeStatus> {
    try {
      // Récupérer les ressources du joueur
      const [player, inventory] = await Promise.all([
        this.getPlayer(),
        this.getInventory()
      ]);

      if (!player || !inventory) {
        throw new Error("Player or inventory not found");
      }

      // Compter les objets par catégorie
      const inventoryStats = this.countInventoryItems(inventory);

      // Initialiser le service de reforge si nécessaire
      await this.reforgeService.initialize();

      const status: IForgeStatus = {
        playerId: this.playerId,
        playerResources: {
          gold: player.gold,
          gems: player.gems,
          paidGems: player.paidGems
        },
        modules: {
          reforge: {
            enabled: this.config.reforge.enabled,
            stats: this.reforgeService.getStats(),
            availableOperations: inventoryStats.reforgeableItems
          }
        },
        inventory: inventoryStats
      };

      return status;
    } catch (error: any) {
      throw new Error(`Failed to get forge status: ${error.message}`);
    }
  }

  // === MÉTHODES POUR LE REFORGE ===

  /**
   * Obtient un aperçu du coût et résultat d'un reforge
   */
  async getReforgePreview(itemInstanceId: string, lockedStats: string[] = []): Promise<IReforgeResult> {
    return await this.reforgeService.getReforgePreview(itemInstanceId, lockedStats);
  }

  /**
   * Exécute un reforge sur un équipement
   */
  async executeReforge(itemInstanceId: string, lockedStats: string[] = []): Promise<IForgeOperationResult> {
    return await this.reforgeService.executeReforge(itemInstanceId, lockedStats);
  }

  /**
   * Obtient les stats disponibles pour un slot d'équipement
   */
  async getAvailableStatsForSlot(equipmentSlot: string): Promise<string[]> {
    return await this.reforgeService.getAvailableStats(equipmentSlot);
  }

  /**
   * Obtient les ranges de stats pour une rareté donnée
   */
  async getStatRangesByRarity(rarity: string): Promise<{ [stat: string]: { min: number; max: number } }> {
    return await this.reforgeService.getStatRanges(rarity);
  }

  // === MÉTHODES POUR L'ENHANCEMENT (Placeholder) ===

  /**
   * Obtient un aperçu du coût d'enhancement
   */
  async getEnhancementPreview(itemInstanceId: string, targetLevel?: number): Promise<any> {
    // TODO: Implémenter quand ForgeEnhancementService sera créé
    throw new Error("Enhancement service not yet implemented");
  }

  /**
   * Exécute un enhancement sur un équipement
   */
  async executeEnhancement(itemInstanceId: string, targetLevel?: number): Promise<IForgeOperationResult> {
    // TODO: Implémenter quand ForgeEnhancementService sera créé
    throw new Error("Enhancement service not yet implemented");
  }

  // === MÉTHODES POUR LA FUSION (Placeholder) ===

  /**
   * Obtient les recettes de fusion disponibles
   */
  async getAvailableFusionRecipes(): Promise<any[]> {
    // TODO: Implémenter quand ForgeFusionService sera créé
    throw new Error("Fusion service not yet implemented");
  }

  /**
   * Exécute une fusion d'équipements
   */
  async executeFusion(recipeId: string, inputItemIds: string[]): Promise<IForgeOperationResult> {
    // TODO: Implémenter quand ForgeFusionService sera créé
    throw new Error("Fusion service not yet implemented");
  }

  // === MÉTHODES POUR LE TIER UPGRADE (Placeholder) ===

  /**
   * Obtient un aperçu du coût de tier upgrade
   */
  async getTierUpgradePreview(itemInstanceId: string): Promise<any> {
    // TODO: Implémenter quand ForgeTierUpgradeService sera créé
    throw new Error("Tier upgrade service not yet implemented");
  }

  /**
   * Exécute un tier upgrade sur un équipement
   */
  async executeTierUpgrade(itemInstanceId: string): Promise<IForgeOperationResult> {
    // TODO: Implémenter quand ForgeTierUpgradeService sera créé
    throw new Error("Tier upgrade service not yet implemented");
  }

  // === MÉTHODES UTILITAIRES ===

  /**
   * Vérifie si un module spécifique est activé
   */
  isModuleEnabled(moduleName: keyof IForgeServiceConfig): boolean {
    const moduleConfig = this.config[moduleName];
    return moduleConfig ? moduleConfig.enabled : false;
  }

  /**
   * Met à jour la configuration d'un module
   */
  updateModuleConfig(moduleName: keyof IForgeServiceConfig, newConfig: Partial<IForgeModuleConfig>): void {
    if (this.config[moduleName]) {
      Object.assign(this.config[moduleName]!, newConfig);
    }
  }

  /**
   * Obtient les statistiques de tous les modules
   */
  async getAllModuleStats(): Promise<{ [moduleName: string]: any }> {
    const stats: { [moduleName: string]: any } = {};

    // Stats du reforge
    if (this.config.reforge.enabled) {
      stats.reforge = this.reforgeService.getStats();
    }

    // TODO: Ajouter les stats des autres modules quand ils seront implémentés

    return stats;
  }

  /**
   * Calcule le coût total estimé pour plusieurs opérations
   */
  async calculateBatchOperationCost(operations: Array<{
    type: 'reforge' | 'enhancement' | 'fusion' | 'tierUpgrade';
    itemInstanceId: string;
    parameters?: any;
  }>): Promise<IForgeResourceCost> {
    const totalCost: IForgeResourceCost = { gold: 0, gems: 0, materials: {} };

    for (const operation of operations) {
      try {
        let operationCost: IForgeResourceCost = { gold: 0, gems: 0 };

        switch (operation.type) {
          case 'reforge':
            const reforgePreview = await this.getReforgePreview(
              operation.itemInstanceId, 
              operation.parameters?.lockedStats || []
            );
            operationCost = reforgePreview.cost;
            break;

          case 'enhancement':
            // TODO: Implémenter quand le service sera prêt
            break;

          case 'fusion':
            // TODO: Implémenter quand le service sera prêt
            break;

          case 'tierUpgrade':
            // TODO: Implémenter quand le service sera prêt
            break;
        }

        // Additionner les coûts
        totalCost.gold += operationCost.gold;
        totalCost.gems += operationCost.gems;

        if (operationCost.materials) {
          if (!totalCost.materials) totalCost.materials = {};
          
          for (const [materialId, amount] of Object.entries(operationCost.materials)) {
            totalCost.materials[materialId] = (totalCost.materials[materialId] || 0) + amount;
          }
        }
      } catch (error) {
        // Ignorer les erreurs d'estimation pour continuer le calcul
        console.warn(`Failed to calculate cost for operation ${operation.type} on ${operation.itemInstanceId}`);
      }
    }

    return totalCost;
  }

  // === MÉTHODES PRIVÉES ===

  /**
   * Compte les objets dans l'inventaire par catégorie d'opération
   */
  private countInventoryItems(inventory: any): {
    reforgeableItems: number;
    enhanceableItems: number;
    fusableItems: number;
    upgradeableItems: number;
  } {
    let reforgeableItems = 0;
    let enhanceableItems = 0;
    let fusableItems = 0;
    let upgradeableItems = 0;

    // Catégories d'équipement dans l'inventaire
    const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
    
    equipmentCategories.forEach(category => {
      const items = inventory.storage[category] || [];
      
      items.forEach((item: any) => {
        // Tous les équipements peuvent être reforged
        reforgeableItems++;
        
        // Les équipements peuvent être enhanced si pas au max
        if (item.enhancement < 30) {
          enhanceableItems++;
        }
        
        // Les équipements de rareté inférieure peuvent être fusés
        if (['Common', 'Rare', 'Epic'].includes(item.rarity)) {
          fusableItems++;
        }
        
        // Les équipements peuvent être tier upgraded s'ils ne sont pas au tier max
        if (item.tier < 10) {
          upgradeableItems++;
        }
      });
    });

    return {
      reforgeableItems,
      enhanceableItems,
      fusableItems,
      upgradeableItems
    };
  }

  /**
   * Valide qu'une opération peut être effectuée sur un objet
   */
  private async validateItemForOperation(
    itemInstanceId: string, 
    operationType: 'reforge' | 'enhancement' | 'fusion' | 'tierUpgrade'
  ): Promise<{ valid: boolean; reason?: string; itemData?: any; ownedItem?: any }> {
    try {
      const validation = await this.validateItem(itemInstanceId, "Equipment");
      
      if (!validation.valid) {
        return validation;
      }

      const { itemData, ownedItem } = validation;

      // Validations spécifiques selon le type d'opération
      switch (operationType) {
        case 'reforge':
          // Tous les équipements peuvent être reforged
          break;

        case 'enhancement':
          if (ownedItem.enhancement >= 30) {
            return { valid: false, reason: "Item is already at maximum enhancement level" };
          }
          break;

        case 'fusion':
          if (!['Common', 'Rare', 'Epic'].includes(itemData.rarity)) {
            return { valid: false, reason: "Item rarity too high for fusion" };
          }
          break;

        case 'tierUpgrade':
          if (ownedItem.tier >= 10) {
            return { valid: false, reason: "Item is already at maximum tier" };
          }
          break;
      }

      return { valid: true, itemData, ownedItem };
    } catch (error: any) {
      return { valid: false, reason: `Validation error: ${error.message}` };
    }
  }

  /**
   * Logs une opération pour les analytics
   */
  private async logForgeOperation(
    operation: string,
    itemInstanceId: string,
    cost: IForgeResourceCost,
    success: boolean,
    additionalData?: any
  ): Promise<void> {
    await this.logOperation(operation, itemInstanceId, cost, success, {
      timestamp: new Date().toISOString(),
      playerId: this.playerId,
      ...additionalData
    });
  }
}

// === FACTORY FUNCTION ===

/**
 * Crée une nouvelle instance du service Forge pour un joueur
 */
export function createForgeService(playerId: string, config?: Partial<IForgeServiceConfig>): ForgeService {
  const finalConfig = config ? 
    { ...DEFAULT_FORGE_SERVICE_CONFIG, ...config } : 
    DEFAULT_FORGE_SERVICE_CONFIG;
    
  return new ForgeService(playerId, finalConfig);
}

// === UTILITAIRES POUR LES ROUTES ===

/**
 * Middleware pour vérifier que le module de forge demandé est activé
 */
export function validateForgeModule(moduleName: keyof IForgeServiceConfig) {
  return (req: any, res: any, next: any) => {
    const forgeService = createForgeService(req.userId);
    
    if (!forgeService.isModuleEnabled(moduleName)) {
      return res.status(403).json({
        error: `Forge module '${moduleName}' is disabled`,
        code: "MODULE_DISABLED"
      });
    }
    
    req.forgeService = forgeService;
    next();
  };
}

/**
 * Convertit les erreurs de forge en réponses HTTP standardisées
 */
export function handleForgeError(error: any, operation: string) {
  console.error(`Forge ${operation} error:`, error);
  
  // Erreurs communes avec codes spécifiques
  const errorMappings: { [key: string]: { code: string; status: number } } = {
    "Player not found": { code: "PLAYER_NOT_FOUND", status: 404 },
    "Inventory not found": { code: "INVENTORY_NOT_FOUND", status: 404 },
    "Item not found": { code: "ITEM_NOT_FOUND", status: 404 },
    "Cannot afford": { code: "INSUFFICIENT_RESOURCES", status: 400 },
    "Insufficient material": { code: "INSUFFICIENT_MATERIALS", status: 400 },
    "Invalid locked stats": { code: "INVALID_LOCKED_STATS", status: 400 },
    "Only equipment can be": { code: "INVALID_ITEM_TYPE", status: 400 },
    "Item is currently equipped": { code: "ITEM_EQUIPPED", status: 400 },
    "disabled": { code: "MODULE_DISABLED", status: 403 }
  };

  // Trouver le mapping d'erreur approprié
  let errorCode = "UNKNOWN_ERROR";
  let statusCode = 500;

  for (const [keyword, mapping] of Object.entries(errorMappings)) {
    if (error.message && error.message.includes(keyword)) {
      errorCode = mapping.code;
      statusCode = mapping.status;
      break;
    }
  }

  return {
    error: error.message || "An unknown error occurred",
    code: errorCode,
    operation,
    timestamp: new Date().toISOString(),
    statusCode
  };
}

/**
 * Valide les paramètres de reforge
 */
export function validateReforgeParams(params: any): { valid: boolean; error?: string } {
  if (!params.itemInstanceId || typeof params.itemInstanceId !== 'string') {
    return { valid: false, error: "itemInstanceId is required and must be a string" };
  }

  if (params.lockedStats && !Array.isArray(params.lockedStats)) {
    return { valid: false, error: "lockedStats must be an array" };
  }

  if (params.lockedStats && params.lockedStats.length > 4) {
    return { valid: false, error: "Maximum 4 stats can be locked" };
  }

  // Vérifier que les stats lockées sont des strings valides
  if (params.lockedStats) {
    for (const stat of params.lockedStats) {
      if (typeof stat !== 'string' || stat.length === 0) {
        return { valid: false, error: "All locked stats must be non-empty strings" };
      }
    }
  }

  return { valid: true };
}

// === EXPORTS PRINCIPAUX ===

export { ForgeCore } from "./ForgeCore";
export { ForgeReforgeService, IReforgeResult } from "./ForgeReforge";

// Export des types principaux
export type {
  IForgeServiceConfig,
  IForgeStatus,
  IForgeOperationResult,
  IForgeResourceCost,
  IForgeModuleConfig
} from "./ForgeCore";

// Export du service principal par défaut
export default ForgeService;

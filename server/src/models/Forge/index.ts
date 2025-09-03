import { ForgeCore, IForgeModuleConfig, IForgeOperationResult, IForgeResourceCost } from "./ForgeCore";
import { ForgeReforgeService, IReforgeResult } from "./ForgeReforge";
import ForgeEnhancement from "./ForgeEnhancement";
import ForgeFusion from "./ForgeFusion";
import ForgeTierUpgrade from "./ForgeTierUpgrade";

// === INTERFACES PRINCIPALES DU SERVICE FORGE ===

export interface IForgeMainServiceConfig {
  reforge: IForgeModuleConfig;
  enhancement: IForgeModuleConfig;
  fusion: IForgeModuleConfig;
  tierUpgrade: IForgeModuleConfig;
}

export interface IForgeMainStatus {
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
    enhancement: {
      enabled: boolean;
      stats: any;
      availableOperations: number;
      maxLevel: number;
    };
    fusion: {
      enabled: boolean;
      stats: any;
      availableOperations: number;
      requiredItems: number;
    };
    tierUpgrade: {
      enabled: boolean;
      stats: any;
      availableOperations: number;
      maxTier: number;
    };
  };
  inventory: {
    reforgeableItems: number;
    enhanceableItems: number;
    fusableItems: number;
    upgradeableItems: number;
  };
}

// === CONFIGURATION PAR DÉFAUT AFK ARENA STYLE ===

export const DEFAULT_FORGE_SERVICE_CONFIG: IForgeMainServiceConfig = {
  reforge: {
    enabled: true,
    baseGoldCost: 2000,
    baseGemCost: 100,
    materialRequirements: {
      "Common": { "reforge_stone": 2 },
      "Rare": { "reforge_stone": 3, "magic_dust": 1 },
      "Epic": { "reforge_stone": 5, "magic_dust": 2 },
      "Legendary": { "reforge_stone": 8, "magic_dust": 3, "mystic_scroll": 1 },
      "Mythic": { "reforge_stone": 12, "magic_dust": 5, "mystic_scroll": 2 },
      "Ascended": { "reforge_stone": 20, "magic_dust": 8, "mystic_scroll": 3, "celestial_essence": 1 }
    },
    levelRestrictions: {
      minPlayerLevel: 10
    }
  },
  enhancement: {
    enabled: true,
    baseGoldCost: 1000,
    baseGemCost: 50,
    materialRequirements: {
      "Common": { "enhancement_stone": 1 },
      "Rare": { "enhancement_stone": 2, "silver_dust": 1 },
      "Epic": { "enhancement_stone": 3, "gold_dust": 1 },
      "Legendary": { "enhancement_stone": 5, "platinum_dust": 1, "legendary_essence": 1 },
      "Mythic": { "enhancement_stone": 8, "mythic_dust": 1, "celestial_fragment": 1 },
      "Ascended": { "enhancement_stone": 12, "divine_fragment": 1, "primordial_essence": 1 }
    },
    levelRestrictions: {
      minPlayerLevel: 5
    }
  },
  fusion: {
    enabled: true,
    baseGoldCost: 5000,
    baseGemCost: 200,
    materialRequirements: {
      "Common": { "fusion_stone": 5, "silver_dust": 10 },
      "Rare": { "fusion_stone": 8, "gold_dust": 5, "magic_essence": 2 },
      "Epic": { "fusion_stone": 12, "platinum_dust": 3, "legendary_essence": 1 },
      "Legendary": { "fusion_stone": 20, "mythic_dust": 2, "celestial_fragment": 1 }
    },
    levelRestrictions: {
      minPlayerLevel: 15
    }
  },
  tierUpgrade: {
    enabled: true,
    baseGoldCost: 10000,
    baseGemCost: 500,
    materialRequirements: {
      "Common": { "tier_stone": 5, "enhancement_dust": 10 },
      "Rare": { "tier_stone": 10, "enhancement_dust": 20, "silver_thread": 2 },
      "Epic": { "tier_stone": 20, "enhancement_dust": 40, "golden_thread": 3 },
      "Legendary": { "tier_stone": 40, "enhancement_dust": 80, "platinum_thread": 4, "divine_shard": 1 },
      "Mythic": { "tier_stone": 80, "enhancement_dust": 160, "mythic_thread": 5, "celestial_essence": 1 },
      "Ascended": { "tier_stone": 160, "enhancement_dust": 320, "ascended_thread": 8, "primordial_fragment": 1 }
    },
    levelRestrictions: {
      minPlayerLevel: 20
    }
  }
};

// === SERVICE PRINCIPAL DE LA FORGE ===

export class ForgeService extends ForgeCore {
  private config: IForgeMainServiceConfig;
  private reforgeService: ForgeReforgeService;
  private enhancementService: ForgeEnhancement;
  private fusionService: ForgeFusion;
  private tierUpgradeService: ForgeTierUpgrade;

  constructor(playerId: string, config: IForgeMainServiceConfig = DEFAULT_FORGE_SERVICE_CONFIG) {
    super(playerId);
    this.config = config;
    
    // Initialiser tous les services
    this.reforgeService = new ForgeReforgeService(playerId, config.reforge);
    this.enhancementService = new ForgeEnhancement(playerId, config.enhancement);
    this.fusionService = new ForgeFusion(playerId, config.fusion);
    this.tierUpgradeService = new ForgeTierUpgrade(playerId, config.tierUpgrade);
  }

  // === MÉTHODES PUBLIQUES PRINCIPALES ===

  /**
   * Récupère le statut complet de la forge pour ce joueur
   */
  async getForgeStatus(): Promise<IForgeMainStatus> {
    try {
      // Récupérer les ressources du joueur
      const [player, inventory] = await Promise.all([
        this.getPlayer(),
        this.getInventory()
      ]);

      if (!player || !inventory) {
        throw new Error("PLAYER_OR_INVENTORY_NOT_FOUND");
      }

      // Compter les objets par catégorie
      const inventoryStats = await this.countInventoryItems(inventory);

      // Initialiser le service de reforge si nécessaire
      await this.reforgeService.initialize();

      const status: IForgeMainStatus = {
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
          },
          enhancement: {
            enabled: this.config.enhancement.enabled,
            stats: this.enhancementService.getStats(),
            availableOperations: inventoryStats.enhanceableItems,
            maxLevel: 30
          },
          fusion: {
            enabled: this.config.fusion.enabled,
            stats: this.fusionService.getStats(),
            availableOperations: inventoryStats.fusableItems,
            requiredItems: 3
          },
          tierUpgrade: {
            enabled: this.config.tierUpgrade.enabled,
            stats: this.tierUpgradeService.getStats(),
            availableOperations: inventoryStats.upgradeableItems,
            maxTier: 5
          }
        },
        inventory: inventoryStats
      };

      return status;
    } catch (error: any) {
      throw new Error(`FAILED_TO_GET_FORGE_STATUS: ${error.message}`);
    }
  }

  // === MÉTHODES POUR LE REFORGE ===

  async getReforgePreview(itemInstanceId: string, lockedStats: string[] = []): Promise<IReforgeResult> {
    try {
      return await this.reforgeService.getReforgePreview(itemInstanceId, lockedStats);
    } catch (error: any) {
      throw new Error(error.message || "REFORGE_PREVIEW_FAILED");
    }
  }

  async executeReforge(itemInstanceId: string, lockedStats: string[] = []): Promise<IForgeOperationResult> {
    return await this.reforgeService.executeReforge(itemInstanceId, lockedStats);
  }

  async getAvailableStatsForSlot(equipmentSlot: string): Promise<string[]> {
    try {
      return await this.reforgeService.getAvailableStats(equipmentSlot);
    } catch (error: any) {
      throw new Error(error.message || "GET_AVAILABLE_STATS_FAILED");
    }
  }

  async getMaxLockedStatsForSlot(equipmentSlot: string): Promise<number> {
    try {
      return await this.reforgeService.getMaxLockedStats(equipmentSlot);
    } catch (error: any) {
      throw new Error(error.message || "GET_MAX_LOCKED_STATS_FAILED");
    }
  }

  async getStatRangesByRarity(rarity: string): Promise<{ [stat: string]: { min: number; max: number } }> {
    try {
      return await this.reforgeService.getStatRanges(rarity);
    } catch (error: any) {
      throw new Error(error.message || "GET_STAT_RANGES_FAILED");
    }
  }

  // === MÉTHODES POUR L'ENHANCEMENT ===

  async getEnhancementCost(itemInstanceId: string, usePaidGemsToGuarantee?: boolean): Promise<IForgeResourceCost> {
    try {
      const cost = await this.enhancementService.getEnhancementCost(itemInstanceId, { usePaidGemsToGuarantee });
      if (!cost) throw new Error("UNABLE_TO_COMPUTE_ENHANCEMENT_COST");
      return cost;
    } catch (error: any) {
      throw new Error(error.message || "GET_ENHANCEMENT_COST_FAILED");
    }
  }

  async executeEnhancement(itemInstanceId: string, usePaidGemsToGuarantee?: boolean): Promise<IForgeOperationResult> {
    return await this.enhancementService.attemptEnhance(itemInstanceId, { usePaidGemsToGuarantee });
  }

  // === MÉTHODES POUR LA FUSION ===

  async getFusionCost(itemInstanceId: string): Promise<IForgeResourceCost> {
    try {
      const cost = await this.fusionService.calculateFusionCost(itemInstanceId);
      if (!cost) throw new Error("UNABLE_TO_COMPUTE_FUSION_COST");
      return cost;
    } catch (error: any) {
      throw new Error(error.message || "GET_FUSION_COST_FAILED");
    }
  }

  async executeFusion(itemInstanceIds: string[]): Promise<IForgeOperationResult> {
    return await this.fusionService.attemptFusion(itemInstanceIds);
  }

  async getFusableItems(rarity?: string): Promise<Array<{ itemId: string; count: number; rarity: string; name: string }>> {
    try {
      return await this.fusionService.getFusableItems(rarity);
    } catch (error: any) {
      throw new Error("GET_FUSABLE_ITEMS_FAILED");
    }
  }

  async getPossibleFusionsCount(itemId: string, rarity: string): Promise<number> {
    try {
      return await this.fusionService.getPossibleFusionsCount(itemId, rarity);
    } catch (error: any) {
      throw new Error("GET_POSSIBLE_FUSIONS_COUNT_FAILED");
    }
  }

  // === MÉTHODES POUR LE TIER UPGRADE ===

  async getTierUpgradeCost(itemInstanceId: string, targetTier?: number): Promise<IForgeResourceCost> {
    try {
      const cost = await this.tierUpgradeService.calculateTierUpgradeCost(itemInstanceId, { targetTier });
      if (!cost) throw new Error("UNABLE_TO_COMPUTE_TIER_UPGRADE_COST");
      return cost;
    } catch (error: any) {
      throw new Error(error.message || "GET_TIER_UPGRADE_COST_FAILED");
    }
  }

  async executeTierUpgrade(itemInstanceId: string, targetTier?: number): Promise<IForgeOperationResult> {
    return await this.tierUpgradeService.attemptTierUpgrade(itemInstanceId, { targetTier });
  }

  async getUpgradableItems(rarity?: string): Promise<Array<{
    instanceId: string;
    itemId: string;
    name: string;
    rarity: string;
    currentTier: number;
    maxPossibleTier: number;
    canUpgrade: boolean;
  }>> {
    try {
      return await this.tierUpgradeService.getUpgradableItems(rarity);
    } catch (error: any) {
      throw new Error("GET_UPGRADABLE_ITEMS_FAILED");
    }
  }

  async getTotalUpgradeCostToMax(itemInstanceId: string): Promise<{
    totalGold: number;
    totalGems: number;
    totalMaterials: { [materialId: string]: number };
    steps: Array<{ fromTier: number; toTier: number; cost: IForgeResourceCost }>;
  }> {
    try {
      const cost = await this.tierUpgradeService.getTotalUpgradeCostToMax(itemInstanceId);
      if (!cost) throw new Error("UNABLE_TO_COMPUTE_TOTAL_UPGRADE_COST");
      return cost;
    } catch (error: any) {
      throw new Error("GET_TOTAL_UPGRADE_COST_FAILED");
    }
  }

  // === MÉTHODES UTILITAIRES ===

  isModuleEnabled(moduleName: keyof IForgeMainServiceConfig): boolean {
    const moduleConfig = this.config[moduleName];
    return moduleConfig ? moduleConfig.enabled : false;
  }

  updateModuleConfig(moduleName: keyof IForgeMainServiceConfig, newConfig: Partial<IForgeModuleConfig>): void {
    if (this.config[moduleName]) {
      Object.assign(this.config[moduleName]!, newConfig);
    }
  }

  async getAllModuleStats(): Promise<{ [moduleName: string]: any }> {
    const stats: { [moduleName: string]: any } = {};

    if (this.config.reforge.enabled) {
      stats.reforge = this.reforgeService.getStats();
    }
    if (this.config.enhancement.enabled) {
      stats.enhancement = this.enhancementService.getStats();
    }
    if (this.config.fusion.enabled) {
      stats.fusion = this.fusionService.getStats();
    }
    if (this.config.tierUpgrade.enabled) {
      stats.tierUpgrade = this.tierUpgradeService.getStats();
    }

    return stats;
  }

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
            operationCost = await this.getEnhancementCost(
              operation.itemInstanceId,
              operation.parameters?.usePaidGemsToGuarantee
            );
            break;

          case 'fusion':
            if (operation.parameters?.itemInstanceIds) {
              operationCost = await this.getFusionCost(operation.itemInstanceId);
            }
            break;

          case 'tierUpgrade':
            operationCost = await this.getTierUpgradeCost(
              operation.itemInstanceId,
              operation.parameters?.targetTier
            );
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

  private async countInventoryItems(inventory: any): Promise<{
    reforgeableItems: number;
    enhanceableItems: number;
    fusableItems: number;
    upgradeableItems: number;
  }> {
    let reforgeableItems = 0;
    let enhanceableItems = 0;
    let fusableItems = 0;
    let upgradeableItems = 0;

    const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
    
    equipmentCategories.forEach((category: string) => {
      const items = inventory.storage[category] || [];
      
      items.forEach((item: any) => {
        // Tous les équipements peuvent être reforged
        reforgeableItems++;
        
        // Enhancement : items pas au niveau max
        const currentEnhancement = item.enhancement || 0;
        if (currentEnhancement < 30) {
          enhanceableItems++;
        }
        
        // Fusion : compter les groupes d'items identiques (sera calculé plus précisément par le service)
        fusableItems++;
        
        // Tier upgrade : items pas au tier max
        const currentTier = item.tier || 1;
        if (currentTier < 5) {
          upgradeableItems++;
        }
      });
    });

    // Pour fusion, on divise par 3 car il faut 3 items
    fusableItems = Math.floor(fusableItems / 3);

    return {
      reforgeableItems,
      enhanceableItems,
      fusableItems,
      upgradeableItems
    };
  }
}

// === FACTORY FUNCTION ===

export function createForgeService(playerId: string, config?: Partial<IForgeMainServiceConfig>): ForgeService {
  const finalConfig = config ? 
    { ...DEFAULT_FORGE_SERVICE_CONFIG, ...config } : 
    DEFAULT_FORGE_SERVICE_CONFIG;
    
  return new ForgeService(playerId, finalConfig);
}

// === UTILITAIRES POUR LES ROUTES ===

export function validateForgeModule(moduleName: keyof IForgeMainServiceConfig) {
  return (req: any, res: any, next: any) => {
    const forgeService = createForgeService(req.userId);
    
    if (!forgeService.isModuleEnabled(moduleName)) {
      return res.status(403).json({
        error: "FORGE_MODULE_DISABLED",
        code: "MODULE_DISABLED",
        module: moduleName
      });
    }
    
    req.forgeService = forgeService;
    next();
  };
}

export function handleForgeError(error: any, operation: string) {
  console.error(`Forge ${operation} error:`, error);
  
  // Labels d'erreur standardisés
  const errorMappings: { [key: string]: { code: string; status: number } } = {
    "PLAYER_NOT_FOUND": { code: "PLAYER_NOT_FOUND", status: 404 },
    "INVENTORY_NOT_FOUND": { code: "INVENTORY_NOT_FOUND", status: 404 },
    "ITEM_NOT_FOUND": { code: "ITEM_NOT_FOUND", status: 404 },
    "INSUFFICIENT_RESOURCES": { code: "INSUFFICIENT_RESOURCES", status: 400 },
    "INSUFFICIENT_MATERIALS": { code: "INSUFFICIENT_MATERIALS", status: 400 },
    "INVALID_LOCKED_STATS": { code: "INVALID_LOCKED_STATS", status: 400 },
    "ONLY_EQUIPMENT_CAN_BE": { code: "INVALID_ITEM_TYPE", status: 400 },
    "ITEM_EQUIPPED": { code: "ITEM_EQUIPPED", status: 400 },
    "MODULE_DISABLED": { code: "MODULE_DISABLED", status: 403 },
    "MAX_ENHANCEMENT_LEVEL": { code: "ITEM_AT_MAX_LEVEL", status: 400 },
    "MAX_TIER": { code: "ITEM_AT_MAX_TIER", status: 400 },
    "FUSION_REQUIRES": { code: "INVALID_FUSION_REQUIREMENTS", status: 400 }
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
    error: error.message || "UNKNOWN_ERROR_OCCURRED",
    code: errorCode,
    operation,
    timestamp: new Date().toISOString(),
    statusCode
  };
}

export function validateForgeParams(params: any, operationType: string): { valid: boolean; error?: string } {
  if (!params.itemInstanceId || typeof params.itemInstanceId !== 'string') {
    return { valid: false, error: "ITEM_INSTANCE_ID_REQUIRED" };
  }

  switch (operationType) {
    case 'reforge':
      if (params.lockedStats && !Array.isArray(params.lockedStats)) {
        return { valid: false, error: "LOCKED_STATS_MUST_BE_ARRAY" };
      }
      if (params.lockedStats && params.lockedStats.length > 3) {
        return { valid: false, error: "MAX_LOCKED_STATS_EXCEEDED" };
      }
      break;

    case 'fusion':
      if (!params.itemInstanceIds || !Array.isArray(params.itemInstanceIds)) {
        return { valid: false, error: "ITEM_INSTANCE_IDS_REQUIRED" };
      }
      if (params.itemInstanceIds.length !== 3) {
        return { valid: false, error: "FUSION_REQUIRES_EXACTLY_THREE_ITEMS" };
      }
      break;

    case 'tierUpgrade':
      if (params.targetTier && (typeof params.targetTier !== 'number' || params.targetTier < 1 || params.targetTier > 5)) {
        return { valid: false, error: "INVALID_TARGET_TIER" };
      }
      break;
  }

  return { valid: true };
}

// === EXPORTS PRINCIPAUX ===

export { ForgeCore } from "./ForgeCore";
export { ForgeReforgeService, IReforgeResult } from "./ForgeReforge";
export { default as ForgeEnhancement } from "./ForgeEnhancement";
export { default as ForgeFusion } from "./ForgeFusion";
export { default as ForgeTierUpgrade } from "./ForgeTierUpgrade";

export type {
  IForgeOperationResult,
  IForgeResourceCost,
  IForgeModuleConfig
};

export default ForgeService;

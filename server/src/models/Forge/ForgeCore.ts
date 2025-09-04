import mongoose from "mongoose";

// === INTERFACES COMMUNES ===

// Ressources nécessaires pour les opérations de forge
export interface IForgeResourceCost {
  gold: number;
  gems: number;
  materials?: { [materialId: string]: number };
}

// Résultat standard des opérations de forge
export interface IForgeOperationResult {
  success: boolean;
  cost: IForgeResourceCost;
  message: string;
  data?: any;
}

// Configuration de base pour tous les modules de forge
export interface IForgeModuleConfig {
  enabled: boolean;
  baseGoldCost: number;
  baseGemCost: number;
  materialRequirements?: { [rarity: string]: { [materialId: string]: number } };
  levelRestrictions?: {
    minPlayerLevel: number;
    maxPlayerLevel?: number;
  };
}

// Interface pour la validation des objets
export interface IItemValidationResult {
  valid: boolean;
  reason?: string;
  itemData?: any;
  ownedItem?: any;
}

// Interface pour les statistiques communes
export interface IForgeStats {
  totalOperations: number;
  totalGoldSpent: number;
  totalGemsSpent: number;
  successRate: number;
  lastOperation?: Date;
}

// === INTERFACES POUR LE SERVICE PRINCIPAL ===

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

// === CLASSE UTILITAIRE FORGE CORE ===

export class ForgeCore {
  protected playerId: string;
  
  constructor(playerId: string) {
    this.playerId = playerId;
  }

  // === VALIDATION DES OBJETS ===
  
  /**
   * Valide qu'un objet peut être utilisé dans les opérations de forge
   */
  async validateItem(itemInstanceId: string, requiredCategory?: string): Promise<IItemValidationResult> {
    try {
      const Inventory = mongoose.model('Inventory');
      const Item = mongoose.model('Item');

      // Récupérer l'inventaire du joueur
      const inventory = await Inventory.findOne({ playerId: this.playerId });
      if (!inventory) {
        return { valid: false, reason: "Inventory not found" };
      }

      // Trouver l'objet dans l'inventaire
      const ownedItem = inventory.getItem(itemInstanceId);
      if (!ownedItem) {
        return { valid: false, reason: "Item not found in inventory" };
      }

      // Récupérer les données de base de l'objet
      const baseItem = await Item.findOne({ itemId: ownedItem.itemId });
      if (!baseItem) {
        return { valid: false, reason: "Base item data not found" };
      }

      // Vérifier la catégorie si spécifiée
      if (requiredCategory && baseItem.category !== requiredCategory) {
        return { 
          valid: false, 
          reason: `Item must be of category ${requiredCategory}, found ${baseItem.category}` 
        };
      }

      // Vérifier que l'objet n'est pas équipé (sauf si on permet la forge d'objets équipés)
      if (ownedItem.isEquipped) {
        return { 
          valid: false, 
          reason: "Item is currently equipped" 
        };
      }

      return {
        valid: true,
        itemData: baseItem,
        ownedItem
      };
    } catch (error: any) {
      return { 
        valid: false, 
        reason: `Validation error: ${error.message}` 
      };
    }
  }

  /**
   * Try to resolve a materialId (used in cost.materials) to an actual itemId present in the player's inventory.
   * Strategy:
   * 1. If inventory.hasItem(materialId) => use materialId as-is.
   * 2. Check an alias map (common legacy names -> canonical itemIds).
   * 3. Search material categories for an item whose itemId equals materialId.
   * 4. Search for a partial match (contains / startsWith) as a fallback.
   * 5. Return null if nothing found.
   */
  protected async resolveMaterialId(materialId: string, inventory: any): Promise<string | null> {
    try {
      if (!inventory) return null;

      // 0) Quick positive check via inventory.hasItem
      try {
        if (typeof inventory.hasItem === "function" && inventory.hasItem(materialId, 1)) {
          return materialId;
        }
      } catch (e) {
        // ignore hasItem errors and continue to scanning storage
      }

      // 1) Alias map to map module-generated keys to canonical inventory itemIds
      const aliasMap: { [key: string]: string } = {
        // Fusion aliases
        "fusion_stone": "fusion_catalyst_basic",
        "silver_dust": "fusion_catalyst_basic",
        "gold_dust": "fusion_catalyst_advanced",
        "platinum_dust": "fusion_catalyst_master",
        "mythic_dust": "fusion_catalyst_master",

        // Enhancement aliases
        "enhancement_stone": "enhancement_stone_basic",
        "enhancement_dust": "enhancement_stone_basic",
        "enhancement_stone_basic": "enhancement_stone_basic",
        "enhancement_stone_advanced": "enhancement_stone_advanced",
        "enhancement_stone_master": "enhancement_stone_master",

        // Tier aliases
        "tier_stone": "tier_essence_basic",
        "rare_crystal": "tier_essence_advanced",
        "epic_essence": "tier_essence_master",
        "legendary_core": "tier_essence_legendary",
        "silver_thread": "tier_essence_basic",
        "golden_thread": "tier_essence_advanced",
        "platinum_thread": "tier_essence_master",
        "mythic_thread": "tier_essence_legendary"
      };

      if (aliasMap[materialId]) {
        // check alias presence
        const alias = aliasMap[materialId];
        try {
          if (typeof inventory.hasItem === "function" && inventory.hasItem(alias, 1)) {
            return alias;
          }
        } catch (e) {
          // continue to scanning storage
        }
        // if alias exists anywhere in storage, return it
        const materialCategories = [
          "enhancementMaterials",
          "evolutionMaterials",
          "craftingMaterials",
          "awakeningMaterials",
          "enhancementItems",
          "artifacts"
        ];
        for (const cat of materialCategories) {
          const items = (inventory as any).storage?.[cat] || [];
          if (Array.isArray(items)) {
            const foundAlias = items.find((it: any) => it.itemId === alias);
            if (foundAlias) return foundAlias.itemId;
          }
        }
        // if alias not present, continue to other heuristics
      }

      const materialCategories = [
        "enhancementMaterials",
        "evolutionMaterials",
        "craftingMaterials",
        "awakeningMaterials",
        "enhancementItems",
        "artifacts"
      ];

      // 2) Search for exact matches in storage
      for (const cat of materialCategories) {
        const items = (inventory as any).storage?.[cat] || [];
        if (Array.isArray(items)) {
          const found = items.find((it: any) => it.itemId === materialId);
          if (found) return found.itemId;
        }
      }

      // 3) Partial match fallback (contains / startsWith)
      for (const cat of materialCategories) {
        const items = (inventory as any).storage?.[cat] || [];
        if (Array.isArray(items)) {
          const found = items.find((it: any) => typeof it.itemId === "string" && (
            it.itemId.includes(materialId) || it.itemId.startsWith(materialId) || materialId.startsWith(it.itemId)
          ));
          if (found) return found.itemId;
        }
      }

      // 4) Failing that, try normalized forms (strip plurals / dashes)
      const normalized = materialId.replace(/[-\s]/g, "_").replace(/s$/, "");
      if (normalized !== materialId) {
        for (const cat of materialCategories) {
          const items = (inventory as any).storage?.[cat] || [];
          if (Array.isArray(items)) {
            const found = items.find((it: any) => it.itemId === normalized || (typeof it.itemId === "string" && it.itemId.includes(normalized)));
            if (found) return found.itemId;
          }
        }
      }

      return null;
    } catch (error) {
      console.error("[forge] resolveMaterialId error", { materialId, error });
      return null;
    }
  }

  /**
   * Valide qu'un joueur peut se permettre un certain coût
   */
  async validatePlayerResources(cost: IForgeResourceCost): Promise<boolean> {
    try {
      const Player = mongoose.model('Player');
      const Inventory = mongoose.model('Inventory');

      // Récupérer le joueur
      const player = await Player.findById(this.playerId);
      if (!player) {
        console.warn(`[forge] validatePlayerResources: player not found for playerId=${this.playerId}`);
        return false;
      }

      // Normalize gems field: accept paidGems as gems fallback (safe access)
      const paidGems = (cost as any)?.paidGems;
      if (paidGems !== undefined && cost.gems === undefined) {
        cost.gems = paidGems;
      }

      // Log the cost vs player balances for debugging
      try {
        console.log(
          `[forge] validatePlayerResources: playerId=${this.playerId} playerBalance={ gold:${(player as any).gold ?? 'n/a'}, gems:${(player as any).gems ?? 'n/a'} } cost={ gold:${cost.gold ?? 0}, gems:${cost.gems ?? 0}, materials:${JSON.stringify(cost.materials || {})} }`
        );
      } catch (e) {
        // ignore logging errors
        console.log('[forge] validatePlayerResources: logging error', e);
      }

      // Vérifier les monnaies de base
      if (!player.canAfford(cost)) {
        console.log('[forge] validatePlayerResources: player.canAfford returned false', { playerId: this.playerId, cost });
        return false;
      }

      // Vérifier les matériaux si nécessaire
      if (cost.materials && Object.keys(cost.materials).length > 0) {
        const inventory = await Inventory.findOne({ playerId: this.playerId });
        if (!inventory) {
          console.log('[forge] validatePlayerResources: inventory not found', { playerId: this.playerId });
          return false;
        }

        // For each material, try to resolve it to an itemId present in inventory
        for (const [materialId, requiredAmount] of Object.entries(cost.materials)) {
          const resolvedId = await this.resolveMaterialId(materialId, inventory);

          if (!resolvedId) {
            console.log('[forge] validatePlayerResources: missing material (no matching itemId)', {
              materialId,
              requiredAmount,
              playerId: this.playerId
            });
            return false;
          }

          const has = typeof inventory.hasItem === "function"
            ? inventory.hasItem(resolvedId, requiredAmount)
            : ((inventory as any).storage?.craftingMaterials || []).filter((it: any) => it.itemId === resolvedId).reduce((s: number, it: any) => s + (it.quantity || 1), 0) >= (requiredAmount as number);

          if (!has) {
            console.log('[forge] validatePlayerResources: missing material', { materialId, resolvedId, requiredAmount, playerId: this.playerId });
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('[forge] validatePlayerResources: error', error);
      return false;
    }
  }

  /**
   * Dépense les ressources du joueur
   */
  async spendResources(cost: IForgeResourceCost): Promise<boolean> {
    try {
      const Player = mongoose.model('Player');
      const Inventory = mongoose.model('Inventory');

      const [player, inventory] = await Promise.all([
        Player.findById(this.playerId),
        Inventory.findOne({ playerId: this.playerId })
      ]);

      if (!player || !inventory) {
        console.log('[forge] spendResources: missing player or inventory', { playerExists: !!player, inventoryExists: !!inventory, playerId: this.playerId });
        return false;
      }

      // Normalize gems field again (safe any access)
      const paidGems = (cost as any)?.paidGems;
      if (paidGems !== undefined && cost.gems === undefined) {
        cost.gems = paidGems;
      }

      // Vérifier une dernière fois avant de dépenser
      if (!await this.validatePlayerResources(cost)) {
        console.log('[forge] spendResources: validatePlayerResources failed (aborting spend)', { playerId: this.playerId, cost });
        return false;
      }

      // Dépenser les monnaies
      try {
        await player.spendCurrency(cost);
      } catch (e) {
        console.error('[forge] spendResources: player.spendCurrency failed', e);
        return false;
      }

      // Dépenser les matériaux (use resolved itemIds and remove required quantities across instances)
      if (cost.materials) {
        for (const [materialId, amountRaw] of Object.entries(cost.materials)) {
          const amountNeeded = Number(amountRaw) || 0;
          if (amountNeeded <= 0) continue;

          const resolvedId = await this.resolveMaterialId(materialId, inventory);
          if (!resolvedId) {
            console.error('[forge] spendResources: resolvedId not found for material', { materialId });
            return false;
          }

          // Find all owned items matching resolvedId across material categories
          const materialCategories = [
            "enhancementMaterials",
            "evolutionMaterials",
            "craftingMaterials",
            "awakeningMaterials",
            "enhancementItems",
            "artifacts"
          ];

          let remaining = amountNeeded;
          for (const cat of materialCategories) {
            if (remaining <= 0) break;
            const items = (inventory as any).storage?.[cat] || [];
            if (!Array.isArray(items) || items.length === 0) continue;

            // iterate copy to avoid modification issues
            for (const owned of [...items]) {
              if (owned.itemId !== resolvedId) continue;
              const qty = owned.quantity || 1;
              const toRemove = Math.min(qty, remaining);
              const removed = await inventory.removeItem(owned.instanceId, toRemove);
              if (!removed) {
                console.error('[forge] spendResources: failed to remove material instance', { resolvedId, instanceId: owned.instanceId, toRemove });
                return false;
              }
              remaining -= toRemove;
              if (remaining <= 0) break;
            }
          }

          if (remaining > 0) {
            console.error('[forge] spendResources: insufficient material quantity after removal attempts', { materialId, resolvedId, requested: amountNeeded, remaining, playerId: this.playerId });
            return false;
          }
        }
      }

      // Sauvegarder les changements
      await Promise.all([player.save(), inventory.save()]);
      return true;
    } catch (error) {
      console.error('[forge] spendResources: error', error);
      return false;
    }
  }

  // === CALCULS DE COÛTS ===

  /**
   * Calcule un coût basé sur la rareté et des multiplicateurs
   */
  calculateRarityBasedCost(
    baseGold: number,
    baseGems: number,
    rarity: string,
    multipliers: { [key: string]: number } = {}
  ): IForgeResourceCost {
    // Multiplicateurs par rareté
    const rarityMultipliers: { [key: string]: number } = {
      "Common": 1,
      "Rare": 1.5,
      "Epic": 2.5,
      "Legendary": 4,
      "Mythic": 7,
      "Ascended": 12
    };

    const rarityMultiplier = rarityMultipliers[rarity] || 1;
    
    // Appliquer tous les multiplicateurs
    let finalMultiplier = rarityMultiplier;
    Object.values(multipliers).forEach(mult => {
      finalMultiplier *= mult;
    });

    return {
      gold: Math.floor(baseGold * finalMultiplier),
      gems: Math.floor(baseGems * finalMultiplier)
    };
  }

  /**
   * Calcule un coût avec progression exponentielle (pour enhancement)
   */
  calculateExponentialCost(
    baseGold: number,
    baseGems: number,
    currentLevel: number,
    maxLevel: number,
    exponentialFactor: number = 1.1
  ): IForgeResourceCost {
    const levelMultiplier = Math.pow(exponentialFactor, currentLevel);
    const progressMultiplier = 1 + (currentLevel / maxLevel);
    
    return {
      gold: Math.floor(baseGold * levelMultiplier * progressMultiplier),
      gems: Math.floor(baseGems * levelMultiplier * progressMultiplier)
    };
  }

  // === GESTION DES MATÉRIAUX ===

  /**
   * Génère les matériaux requis selon la rareté
   */
  getMaterialRequirements(rarity: string, operationType: string): { [materialId: string]: number } {
    const materialMappings: { [key: string]: { [key: string]: { [key: string]: number } } } = {
      enhancement: {
        "Common": { "enhancement_stone_basic": 2 },
        "Rare": { "enhancement_stone_basic": 5, "enhancement_stone_advanced": 1 },
        "Epic": { "enhancement_stone_advanced": 3, "enhancement_stone_master": 1 },
        "Legendary": { "enhancement_stone_master": 2, "enhancement_stone_legendary": 1 },
        "Mythic": { "enhancement_stone_legendary": 3 },
        "Ascended": { "enhancement_stone_legendary": 5, "celestial_essence": 1 }
      },
      fusion: {
        "Common": { "fusion_catalyst_basic": 1 },
        "Rare": { "fusion_catalyst_basic": 2, "fusion_catalyst_advanced": 1 },
        "Epic": { "fusion_catalyst_advanced": 2, "fusion_catalyst_master": 1 },
        "Legendary": { "fusion_catalyst_master": 2 },
        "Mythic": { "fusion_catalyst_master": 3, "celestial_essence": 1 },
        "Ascended": { "celestial_essence": 2 }
      },
      tierUpgrade: {
        "Common": { "tier_essence_basic": 3 },
        "Rare": { "tier_essence_basic": 5, "tier_essence_advanced": 2 },
        "Epic": { "tier_essence_advanced": 4, "tier_essence_master": 2 },
        "Legendary": { "tier_essence_master": 3, "tier_essence_legendary": 1 },
        "Mythic": { "tier_essence_legendary": 2 },
        "Ascended": { "tier_essence_legendary": 3, "celestial_essence": 1 }
      }
    };

    return materialMappings[operationType]?.[rarity] || {};
  }

  // === UTILITAIRES ===

  /**
   * Génère un ID unique pour les opérations
   */
  generateOperationId(): string {
    return `forge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log une opération pour les statistiques
   */
  async logOperation(
    operationType: string,
    itemInstanceId: string,
    cost: IForgeResourceCost,
    success: boolean,
    additionalData?: any
  ): Promise<void> {
    try {
      // Ici on pourrait logger dans une collection séparée pour les analytics
      // Pour l'instant, on se contente d'un log console en développement
      if (process.env.NODE_ENV === 'development') {
        console.log(`Forge Operation: ${operationType}`, {
          playerId: this.playerId,
          itemInstanceId,
          cost,
          success,
          timestamp: new Date().toISOString(),
          additionalData
        });
      }
    } catch (error) {
      // Ne pas faire échouer l'opération si le logging échoue
    }
  }

  /**
   * Calcule les stats d'un objet à un niveau donné (avec enhancement)
   */
  calculateItemStatsWithEnhancement(
    baseStats: any,
    statsPerLevel: any,
    level: number,
    enhancement: number
  ): any {
    const currentStats: any = {};
    
    // Stats de base + stats par niveau
    for (const [stat, baseValue] of Object.entries(baseStats)) {
      if (typeof baseValue === 'number') {
        const levelBonus = (statsPerLevel[stat] || 0) * Math.max(0, level - 1);
        currentStats[stat] = baseValue + levelBonus;
      }
    }

    // Appliquer le multiplicateur d'enhancement
    if (enhancement > 0) {
      const enhancementMultiplier = this.getEnhancementMultiplier(enhancement);
      for (const [stat, value] of Object.entries(currentStats)) {
        if (typeof value === 'number') {
          currentStats[stat] = Math.floor(value * enhancementMultiplier);
        }
      }
    }

    return currentStats;
  }

  /**
   * Retourne le multiplicateur de stats pour un niveau d'enhancement donné
   */
  protected getEnhancementMultiplier(enhancementLevel: number): number {
    // Progression similaire à AFK Arena
    const multipliers: { [level: number]: number } = {
      0: 1.0,    // +0 = stats de base
      1: 1.05,   // +1 = +5%
      2: 1.10,   // +2 = +10%
      3: 1.16,   // +3 = +16%
      4: 1.23,   // +4 = +23%
      5: 1.30,   // +5 = +30%
      10: 1.75,  // +10 = +75%
      15: 2.50,  // +15 = +150%
      20: 3.50,  // +20 = +250%
      25: 4.75,  // +25 = +375%
      30: 6.00   // +30 = +500%
    };

    // Interpolation linéaire pour les niveaux non définis
    if (multipliers[enhancementLevel]) {
      return multipliers[enhancementLevel];
    }

    // Trouver les niveaux encadrants et interpoler
    const levels = Object.keys(multipliers).map(Number).sort((a, b) => a - b);
    let lowerLevel = 0;
    let upperLevel = 30;

    for (let i = 0; i < levels.length - 1; i++) {
      if (enhancementLevel >= levels[i] && enhancementLevel <= levels[i + 1]) {
        lowerLevel = levels[i];
        upperLevel = levels[i + 1];
        break;
      }
    }

    const lowerMultiplier = multipliers[lowerLevel];
    const upperMultiplier = multipliers[upperLevel];
    const progress = (enhancementLevel - lowerLevel) / (upperLevel - lowerLevel);
    
    return lowerMultiplier + (upperMultiplier - lowerMultiplier) * progress;
  }

  // === MÉTHODES D'ACCÈS RAPIDE AUX MODÈLES ===

  protected async getPlayer() {
    const Player = mongoose.model('Player');
    return await Player.findById(this.playerId);
  }

  protected async getInventory() {
    const Inventory = mongoose.model('Inventory');
    return await Inventory.findOne({ playerId: this.playerId });
  }

  protected async getItem(itemId: string) {
    const Item = mongoose.model('Item');
    return await Item.findOne({ itemId });
  }
}

// === CLASSE DE BASE POUR TOUS LES MODULES ===

export abstract class ForgeModuleBase extends ForgeCore {
  protected config: IForgeModuleConfig;
  protected stats: IForgeStats;

  constructor(playerId: string, config: IForgeModuleConfig) {
    super(playerId);
    this.config = config;
    this.stats = {
      totalOperations: 0,
      totalGoldSpent: 0,
      totalGemsSpent: 0,
      successRate: 0
    };
  }

  /**
   * Méthode abstraite que chaque module doit implémenter
   */
  abstract getModuleName(): string;

  /**
   * Vérifie si le module est activé
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Vérifie les restrictions de niveau du joueur
   */
  async checkPlayerLevelRestrictions(): Promise<boolean> {
    if (!this.config.levelRestrictions) return true;

    const player = await this.getPlayer();
    if (!player) return false;

    const { minPlayerLevel, maxPlayerLevel } = this.config.levelRestrictions;
    
    if (player.level < minPlayerLevel) return false;
    if (maxPlayerLevel && player.level > maxPlayerLevel) return false;

    return true;
  }

  /**
   * Met à jour les statistiques du module
   */
  protected async updateStats(cost: IForgeResourceCost, success: boolean): Promise<void> {
    this.stats.totalOperations++;
    if (success) {
      this.stats.totalGoldSpent += cost.gold;
      this.stats.totalGemsSpent += cost.gems;
    }
    this.stats.successRate = this.stats.totalOperations > 0 ? 
      (this.stats.totalOperations - (this.stats.totalOperations - this.stats.totalGoldSpent)) / this.stats.totalOperations : 0;
    this.stats.lastOperation = new Date();
  }

  /**
   * Retourne les statistiques du module
   */
  getStats(): IForgeStats {
    return { ...this.stats };
  }
}

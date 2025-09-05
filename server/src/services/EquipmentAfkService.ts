import Player from "../models/Player";
import Inventory from "../models/Inventory";

/**
 * Equipment AFK Service - Impact des équipements sur les gains AFK
 * Calcule les bonus d'équipement qui boostent les récompenses AFK comme dans AFK Arena
 */

export interface EquipmentAfkBonus {
  source: string;          // Nom de l'équipement/source du bonus
  type: "multiplier" | "flat" | "percentage";
  value: number;           // Valeur du bonus
  affectedReward: "all" | "gold" | "gems" | "materials" | "fragments";
  heroId?: string;         // Héros qui porte l'équipment (si applicable)
  equipmentId?: string;    // ID de l'équipement
  equipmentLevel?: number; // Niveau de l'équipement
}

export interface EquipmentAfkAnalysis {
  totalMultiplier: number;           // Multiplicateur total des équipements
  goldMultiplier: number;            // Multiplicateur spécifique à l'or
  gemsMultiplier: number;            // Multiplicateur spécifique aux gems
  materialsMultiplier: number;       // Multiplicateur spécifique aux matériaux
  fragmentsMultiplier: number;       // Multiplicateur spécifique aux fragments
  bonuses: EquipmentAfkBonus[];      // Détail de tous les bonus
  equippedItemsCount: number;        // Nombre d'objets équipés
  averageEquipmentLevel: number;     // Niveau moyen des équipements
  setsCompleted: string[];           // Sets d'équipement complétés
  recommendations: string[];         // Recommandations d'amélioration
}

export class EquipmentAfkService {

  /**
   * Analyser tous les bonus d'équipement AFK d'un joueur
   */
  public static async analyzePlayerEquipmentAfkBonuses(playerId: string): Promise<{
    success: boolean;
    analysis: EquipmentAfkAnalysis;
    error?: string;
  }> {
    try {
      console.log(`🛡️ Analyse équipements AFK pour ${playerId}`);

      const [player, inventory] = await Promise.all([
        Player.findById(playerId).select("heroes"),
        Inventory.findOne({ playerId })
      ]);

      if (!player) {
        return {
          success: false,
          analysis: this.getEmptyAnalysis(),
          error: "Player not found"
        };
      }

      if (!inventory) {
        return {
          success: false,
          analysis: this.getEmptyAnalysis(),
          error: "Inventory not found"
        };
      }

      // Récupérer tous les objets équipés
      const equippedItems = inventory.getEquippedItems();
      
      const bonuses: EquipmentAfkBonus[] = [];
      let totalEquipmentLevel = 0;
      let equippedCount = 0;

      // Analyser chaque objet équipé
      for (const equippedItem of equippedItems) {
        try {
          // Import dynamique pour éviter dépendances circulaires
          const Item = require("../models/Item").default;
          const itemData = await Item.findOne({ itemId: equippedItem.itemId });
          
          if (itemData) {
            const itemBonuses = this.calculateItemAfkBonuses(equippedItem, itemData);
            bonuses.push(...itemBonuses);
            
            totalEquipmentLevel += equippedItem.level || 1;
            equippedCount++;
          }
        } catch (error) {
          console.error(`Erreur analyse item ${equippedItem.itemId}:`, error);
        }
      }

      // Analyser les bonus de sets complets
      const setBonuses = await this.calculateSetBonuses(inventory, player.heroes);
      bonuses.push(...setBonuses.bonuses);

      // Calculer les multiplicateurs finaux
      const multipliers = this.consolidateMultipliers(bonuses);

      const analysis: EquipmentAfkAnalysis = {
        totalMultiplier: multipliers.total,
        goldMultiplier: multipliers.gold,
        gemsMultiplier: multipliers.gems,
        materialsMultiplier: multipliers.materials,
        fragmentsMultiplier: multipliers.fragments,
        bonuses,
        equippedItemsCount: equippedCount,
        averageEquipmentLevel: equippedCount > 0 ? Math.round(totalEquipmentLevel / equippedCount) : 0,
        setsCompleted: setBonuses.completedSets,
        recommendations: this.generateRecommendations(bonuses, equippedCount, multipliers)
      };

      console.log(`✅ Équipements analysés: ${equippedCount} items, ${multipliers.total}x multiplicateur`);

      return {
        success: true,
        analysis
      };

    } catch (error: any) {
      console.error("❌ Erreur analyzePlayerEquipmentAfkBonuses:", error);
      return {
        success: false,
        analysis: this.getEmptyAnalysis(),
        error: error.message
      };
    }
  }

  /**
   * Calculer les bonus AFK d'un objet équipé
   */
  private static calculateItemAfkBonuses(
    equippedItem: any, 
    itemData: any
  ): EquipmentAfkBonus[] {
    const bonuses: EquipmentAfkBonus[] = [];

    // Bonus de base selon le type d'équipement
    const baseBonus = this.getBaseEquipmentAfkBonus(itemData.category, itemData.equipmentSlot);
    if (baseBonus > 0) {
      bonuses.push({
        source: `${itemData.name} (Base)`,
        type: "multiplier",
        value: baseBonus,
        affectedReward: "all",
        heroId: equippedItem.equippedTo,
        equipmentId: equippedItem.itemId,
        equipmentLevel: equippedItem.level
      });
    }

    // Bonus de niveau d'équipement
    const levelBonus = this.calculateLevelBonus(equippedItem.level || 1, itemData.rarity);
    if (levelBonus > 0) {
      bonuses.push({
        source: `${itemData.name} (Level ${equippedItem.level})`,
        type: "percentage",
        value: levelBonus,
        affectedReward: "all",
        heroId: equippedItem.equippedTo,
        equipmentId: equippedItem.itemId,
        equipmentLevel: equippedItem.level
      });
    }

    // Bonus d'amélioration (+1, +2, etc.)
    const enhancementBonus = this.calculateEnhancementBonus(equippedItem.enhancement || 0);
    if (enhancementBonus > 0) {
      bonuses.push({
        source: `${itemData.name} (+${equippedItem.enhancement})`,
        type: "percentage",
        value: enhancementBonus,
        affectedReward: "all",
        heroId: equippedItem.equippedTo,
        equipmentId: equippedItem.itemId,
        equipmentLevel: equippedItem.level
      });
    }

    // Bonus de rareté
    const rarityBonus = this.getRarityAfkBonus(itemData.rarity);
    if (rarityBonus > 0) {
      bonuses.push({
        source: `${itemData.name} (${itemData.rarity})`,
        type: "percentage",
        value: rarityBonus,
        affectedReward: "all",
        heroId: equippedItem.equippedTo,
        equipmentId: equippedItem.itemId,
        equipmentLevel: equippedItem.level
      });
    }

    return bonuses;
  }

  /**
   * Bonus de base selon le type d'équipement
   */
  private static getBaseEquipmentAfkBonus(category: string, slot: string): number {
    if (category !== "Equipment") return 0;

    const slotBonuses: Record<string, number> = {
      "Weapon": 0.15,      // +15% pour les armes
      "Armor": 0.10,       // +10% pour les armures
      "Helmet": 0.08,      // +8% pour les casques
      "Boots": 0.06,       // +6% pour les bottes
      "Gloves": 0.06,      // +6% pour les gants
      "Accessory": 0.12    // +12% pour les accessoires
    };

    return slotBonuses[slot] || 0;
  }

  /**
   * Bonus selon le niveau de l'équipement
   */
  private static calculateLevelBonus(level: number, rarity: string): number {
    const rarityMultipliers: Record<string, number> = {
      "Common": 0.02,      // +2% par niveau
      "Rare": 0.03,        // +3% par niveau
      "Epic": 0.04,        // +4% par niveau
      "Legendary": 0.06,   // +6% par niveau
      "Mythic": 0.08,      // +8% par niveau
      "Ascended": 0.10     // +10% par niveau
    };

    const multiplier = rarityMultipliers[rarity] || 0.02;
    return (level - 1) * multiplier; // Niveau 1 = pas de bonus, niveau 2 = 1x multiplier, etc.
  }

  /**
   * Bonus d'amélioration (+1, +2, etc.)
   */
  private static calculateEnhancementBonus(enhancement: number): number {
    if (enhancement <= 0) return 0;
    
    // Progression exponentielle : +5% au +1, +10% au +2, +20% au +5, etc.
    return Math.floor(enhancement * 5 * Math.pow(1.2, enhancement - 1));
  }

  /**
   * Bonus de rareté fixe
   */
  private static getRarityAfkBonus(rarity: string): number {
    const rarityBonuses: Record<string, number> = {
      "Common": 0,
      "Rare": 5,           // +5%
      "Epic": 15,          // +15%
      "Legendary": 35,     // +35%
      "Mythic": 75,        // +75%
      "Ascended": 150      // +150%
    };

    return rarityBonuses[rarity] || 0;
  }

  /**
   * Calculer les bonus de sets d'équipement
   */
  private static async calculateSetBonuses(
    inventory: any, 
    heroes: any[]
  ): Promise<{ bonuses: EquipmentAfkBonus[]; completedSets: string[] }> {
    const bonuses: EquipmentAfkBonus[] = [];
    const completedSets: string[] = [];

    // Pour chaque héros équipé
    const equippedHeroes = heroes.filter(h => h.equipped && h.slot);
    
    for (const hero of equippedHeroes) {
      const heroEquipment = inventory.getEquippedItems(hero.heroId);
      const setBonuses = this.analyzeSetBonuses(heroEquipment);
      
      setBonuses.forEach(setBonus => {
        if (setBonus.piecesEquipped >= setBonus.piecesRequired) {
          bonuses.push({
            source: `${setBonus.setName} Set (${setBonus.piecesEquipped}/${setBonus.piecesRequired})`,
            type: "multiplier",
            value: setBonus.afkBonus,
            affectedReward: "all",
            heroId: hero.heroId
          });
          
          if (!completedSets.includes(setBonus.setName)) {
            completedSets.push(setBonus.setName);
          }
        }
      });
    }

    return { bonuses, completedSets };
  }

  /**
   * Analyser les sets d'équipement d'un héros
   */
  private static analyzeSetBonuses(heroEquipment: any[]): Array<{
    setName: string;
    piecesEquipped: number;
    piecesRequired: number;
    afkBonus: number;
  }> {
    // Grouper par set (basé sur un pattern dans le nom ou ID)
    const setGroups: Record<string, number> = {};
    
    heroEquipment.forEach(item => {
      // Logique simplifiée : détection de sets par préfixe du nom
      const setName = this.extractSetName(item.itemId);
      if (setName) {
        setGroups[setName] = (setGroups[setName] || 0) + 1;
      }
    });

    // Convertir en bonus
    return Object.entries(setGroups).map(([setName, pieces]) => ({
      setName,
      piecesEquipped: pieces,
      piecesRequired: this.getSetRequirement(setName),
      afkBonus: this.getSetAfkBonus(setName, pieces)
    }));
  }

  /**
   * Extraire le nom du set depuis l'ID de l'item
   */
  private static extractSetName(itemId: string): string | null {
    // Logique simplifiée : les sets ont des préfixes communs
    const setPrefixes = [
      "dragon_", "phoenix_", "shadow_", "light_", "nature_", 
      "frost_", "flame_", "storm_", "earth_", "void_"
    ];
    
    for (const prefix of setPrefixes) {
      if (itemId.startsWith(prefix)) {
        return prefix.replace("_", "").toUpperCase();
      }
    }
    
    return null;
  }

  /**
   * Obtenir le nombre de pièces requis pour un set
   */
  private static getSetRequirement(setName: string): number {
    // La plupart des sets requièrent 4 pièces
    const setRequirements: Record<string, number> = {
      "DRAGON": 4,
      "PHOENIX": 4,
      "SHADOW": 6,    // Set plus rare
      "LIGHT": 6,     // Set plus rare
      "NATURE": 4,
      "FROST": 4,
      "FLAME": 4,
      "STORM": 4,
      "EARTH": 4,
      "VOID": 8       // Set légendaire
    };
    
    return setRequirements[setName] || 4;
  }

  /**
   * Obtenir le bonus AFK d'un set selon le nombre de pièces
   */
  private static getSetAfkBonus(setName: string, pieces: number): number {
    const setBonuses: Record<string, Record<number, number>> = {
      "DRAGON": { 2: 0.05, 4: 0.15 },      // +5% à 2 pièces, +15% à 4 pièces
      "PHOENIX": { 2: 0.08, 4: 0.20 },     // Meilleur set
      "SHADOW": { 2: 0.04, 4: 0.12, 6: 0.25 },
      "LIGHT": { 2: 0.06, 4: 0.18, 6: 0.35 },
      "NATURE": { 2: 0.03, 4: 0.10 },
      "FROST": { 2: 0.04, 4: 0.12 },
      "FLAME": { 2: 0.04, 4: 0.12 },
      "STORM": { 2: 0.05, 4: 0.14 },
      "EARTH": { 2: 0.03, 4: 0.09 },
      "VOID": { 2: 0.10, 4: 0.25, 6: 0.50, 8: 1.0 } // Set légendaire
    };
    
    return setBonuses[setName]?.[pieces] || 0;
  }

  /**
   * Consolider tous les bonus en multiplicateurs finaux
   */
  private static consolidateMultipliers(bonuses: EquipmentAfkBonus[]): {
    total: number;
    gold: number;
    gems: number;
    materials: number;
    fragments: number;
  } {
    let totalMultiplier = 1.0;
    let goldMultiplier = 1.0;
    let gemsMultiplier = 1.0;
    let materialsMultiplier = 1.0;
    let fragmentsMultiplier = 1.0;

    bonuses.forEach(bonus => {
      const bonusValue = bonus.type === "percentage" ? bonus.value / 100 : bonus.value;
      
      if (bonus.affectedReward === "all") {
        if (bonus.type === "multiplier") {
          totalMultiplier *= (1 + bonusValue);
        } else {
          totalMultiplier += bonusValue;
        }
      } else {
        // Bonus spécifiques par type de récompense
        const multiplierToUpdate = bonus.type === "multiplier" ? (1 + bonusValue) : bonusValue;
        
        switch (bonus.affectedReward) {
          case "gold":
            goldMultiplier *= multiplierToUpdate;
            break;
          case "gems":
            gemsMultiplier *= multiplierToUpdate;
            break;
          case "materials":
            materialsMultiplier *= multiplierToUpdate;
            break;
          case "fragments":
            fragmentsMultiplier *= multiplierToUpdate;
            break;
        }
      }
    });

    return {
      total: Math.round(totalMultiplier * 100) / 100,
      gold: Math.round((goldMultiplier * totalMultiplier) * 100) / 100,
      gems: Math.round((gemsMultiplier * totalMultiplier) * 100) / 100,
      materials: Math.round((materialsMultiplier * totalMultiplier) * 100) / 100,
      fragments: Math.round((fragmentsMultiplier * totalMultiplier) * 100) / 100
    };
  }

  /**
   * Générer des recommandations d'amélioration
   */
  private static generateRecommendations(
    bonuses: EquipmentAfkBonus[], 
    equippedCount: number, 
    multipliers: any
  ): string[] {
    const recommendations: string[] = [];

    if (equippedCount < 6) {
      recommendations.push(`Equip more items (${equippedCount}/6 slots used)`);
    }

    if (multipliers.total < 1.5) {
      recommendations.push("Upgrade equipment levels for better AFK bonuses");
    }

    const hasEnhancedItems = bonuses.some(b => b.source.includes("+"));
    if (!hasEnhancedItems) {
      recommendations.push("Enhance equipment (+1, +2, etc.) for significant AFK bonuses");
    }

    const hasSetBonuses = bonuses.some(b => b.source.includes("Set"));
    if (!hasSetBonuses) {
      recommendations.push("Complete equipment sets for powerful AFK multipliers");
    }

    if (multipliers.total > 3.0) {
      recommendations.push("Excellent equipment setup! Consider upgrading to higher rarities");
    }

    return recommendations;
  }

  /**
   * Analyse vide par défaut
   */
  private static getEmptyAnalysis(): EquipmentAfkAnalysis {
    return {
      totalMultiplier: 1.0,
      goldMultiplier: 1.0,
      gemsMultiplier: 1.0,
      materialsMultiplier: 1.0,
      fragmentsMultiplier: 1.0,
      bonuses: [],
      equippedItemsCount: 0,
      averageEquipmentLevel: 0,
      setsCompleted: [],
      recommendations: ["Equip items to boost AFK rewards"]
    };
  }

  /**
   * Obtenir le multiplicateur d'équipement pour un joueur (pour intégration avec AfkRewardsService)
   */
  public static async getPlayerEquipmentMultiplier(playerId: string): Promise<number> {
    try {
      const result = await this.analyzePlayerEquipmentAfkBonuses(playerId);
      return result.success ? result.analysis.totalMultiplier : 1.0;
    } catch (error) {
      console.error("❌ Erreur getPlayerEquipmentMultiplier:", error);
      return 1.0;
    }
  }

  /**
   * Simuler l'impact d'un upgrade d'équipement sur les gains AFK
   */
  public static async simulateEquipmentUpgradeImpact(
    playerId: string,
    itemInstanceId: string,
    targetLevel: number,
    targetEnhancement: number
  ): Promise<{
    success: boolean;
    currentMultiplier: number;
    projectedMultiplier: number;
    improvement: number;
    worthUpgrading: boolean;
    error?: string;
  }> {
    try {
      // Analyse actuelle
      const currentAnalysis = await this.analyzePlayerEquipmentAfkBonuses(playerId);
      if (!currentAnalysis.success) {
        return {
          success: false,
          currentMultiplier: 1.0,
          projectedMultiplier: 1.0,
          improvement: 0,
          worthUpgrading: false,
          error: currentAnalysis.error
        };
      }

      // TODO: Implémenter la simulation d'upgrade
      // Pour l'instant, estimation simple
      const currentMultiplier = currentAnalysis.analysis.totalMultiplier;
      const estimatedImprovement = (targetLevel - 1) * 0.03 + targetEnhancement * 0.05;
      const projectedMultiplier = currentMultiplier * (1 + estimatedImprovement);
      
      const improvement = ((projectedMultiplier / currentMultiplier) - 1) * 100;
      const worthUpgrading = improvement > 10; // Plus de 10% d'amélioration

      return {
        success: true,
        currentMultiplier,
        projectedMultiplier: Math.round(projectedMultiplier * 100) / 100,
        improvement: Math.round(improvement * 100) / 100,
        worthUpgrading
      };

    } catch (error: any) {
      console.error("❌ Erreur simulateEquipmentUpgradeImpact:", error);
      return {
        success: false,
        currentMultiplier: 1.0,
        projectedMultiplier: 1.0,
        improvement: 0,
        worthUpgrading: false,
        error: error.message
      };
    }
  }
}

export default EquipmentAfkService;

// server/src/utils/ItemGenerator.ts
import { IdGenerator } from "./idGenerator";
import Item from "../models/Item";

// === INTERFACES POUR LA GÉNÉRATION ===

interface IStatVariance {
  min: number;    // Variance minimale (ex: -20%)
  max: number;    // Variance maximale (ex: +20%)
}

interface IGenerationOptions {
  level: number;                    // Niveau de l'objet généré
  randomStatCount?: number;         // Nombre de stats aléatoires (0-5)
  tier?: number;                    // Tier de l'objet (1-10)
  factionAlignment?: string;        // Alignement de faction ("Fire", "Water", etc.)
  enhancementLevel?: number;        // Niveau d'amélioration (0-5 étoiles)
  rarityBoost?: number;            // Boost de rareté (0.0 - 1.0)
  seed?: string;                   // Seed pour reproductibilité
  guaranteedStats?: string[];      // Stats garanties à ajouter
}

interface IGeneratedStats {
  baseStats: Partial<IItemStats>;
  randomStats: Array<{
    stat: string;
    value: number;
    variance: number;
    source: "random" | "guaranteed";
  }>;
  multipliers: {
    levelMultiplier: number;
    rarityMultiplier: number;
    factionMultiplier: number;
    enhancementMultiplier: number;
    tierMultiplier: number;
  };
  finalStats: Partial<IItemStats>;
  powerScore: number;
}

interface IGeneratedItem {
  // Propriétés de base héritées du template
  itemId: string;
  name: string;
  description: string;
  iconUrl: string;
  category: string;
  subCategory: string;
  rarity: string;
  equipmentSlot?: string;
  classRestriction?: string[];
  
  // Propriétés générées
  level: number;
  tier: number;
  enhancementLevel: number;
  factionAlignment?: string;
  
  // Stats calculées
  generatedStats: IGeneratedStats;
  
  // Métadonnées de génération
  templateItemId: string;
  generationSeed: string;
  createdAt: Date;
}

// === CONFIGURATION DES STATS ALÉATOIRES PAR TYPE D'ÉQUIPEMENT ===

const RANDOM_STAT_POOLS: { [equipmentSlot: string]: Array<{ stat: string; weight: number; baseRange: [number, number] }> } = {
  Weapon: [
    { stat: "crit", weight: 30, baseRange: [3, 12] },
    { stat: "critDamage", weight: 25, baseRange: [8, 25] },
    { stat: "accuracy", weight: 20, baseRange: [5, 15] },
    { stat: "healthleech", weight: 15, baseRange: [2, 8] },
    { stat: "vitesse", weight: 10, baseRange: [2, 6] }
  ],
  Armor: [
    { stat: "hp", weight: 35, baseRange: [20, 80] },
    { stat: "def", weight: 30, baseRange: [5, 20] },
    { stat: "critResist", weight: 20, baseRange: [3, 12] },
    { stat: "dodge", weight: 10, baseRange: [2, 8] },
    { stat: "shieldBonus", weight: 5, baseRange: [3, 10] }
  ],
  Helmet: [
    { stat: "hp", weight: 25, baseRange: [15, 50] },
    { stat: "moral", weight: 25, baseRange: [5, 20] },
    { stat: "energyRegen", weight: 20, baseRange: [1, 5] },
    { stat: "critResist", weight: 15, baseRange: [2, 8] },
    { stat: "reductionCooldown", weight: 15, baseRange: [1, 5] }
  ],
  Boots: [
    { stat: "vitesse", weight: 40, baseRange: [3, 15] },
    { stat: "dodge", weight: 25, baseRange: [3, 12] },
    { stat: "hp", weight: 20, baseRange: [10, 40] },
    { stat: "energyRegen", weight: 10, baseRange: [1, 3] },
    { stat: "accuracy", weight: 5, baseRange: [2, 6] }
  ],
  Gloves: [
    { stat: "atk", weight: 30, baseRange: [5, 20] },
    { stat: "crit", weight: 25, baseRange: [2, 10] },
    { stat: "accuracy", weight: 20, baseRange: [3, 12] },
    { stat: "critDamage", weight: 15, baseRange: [5, 18] },
    { stat: "healthleech", weight: 10, baseRange: [1, 5] }
  ],
  Accessory: [
    { stat: "healingBonus", weight: 25, baseRange: [3, 15] },
    { stat: "shieldBonus", weight: 20, baseRange: [3, 12] },
    { stat: "reductionCooldown", weight: 20, baseRange: [1, 6] },
    { stat: "energyRegen", weight: 15, baseRange: [1, 4] },
    { stat: "moral", weight: 10, baseRange: [3, 12] },
    { stat: "critResist", weight: 10, baseRange: [2, 8] }
  ]
};

// === MULTIPLICATEURS DE RARETÉ ===
const RARITY_MULTIPLIERS: { [rarity: string]: number } = {
  "Common": 1.0,
  "Rare": 1.4,
  "Epic": 1.8,
  "Legendary": 2.5,
  "Mythic": 3.5,
  "Ascended": 5.0
};

// === ALIGNEMENTS DE FACTION ===
const FACTION_ALIGNMENTS = ["Fire", "Water", "Wind", "Electric", "Light", "Dark"];

export class ItemGenerator {
  
  /**
   * Génère une instance d'objet basée sur un template existant en DB
   */
  static async generateItemInstance(
    templateItemId: string, 
    options: IGenerationOptions
  ): Promise<IGeneratedItem> {
    
    // 1. Récupérer le template depuis la DB
    const template = await Item.findOne({ itemId: templateItemId });
    if (!template) {
      throw new Error(`Template item not found: ${templateItemId}`);
    }

    // 2. Générer le seed si non fourni
    const seed = options.seed || this.generateSeed();
    this.setSeed(seed);

    // 3. Déterminer les propriétés générées
    const level = Math.max(1, options.level);
    const tier = options.tier || this.randomInt(1, 3);
    const enhancementLevel = options.enhancementLevel || 0;
    const factionAlignment = options.factionAlignment || this.rollFactionAlignment(template.rarity);

    // 4. Calculer les stats
    const generatedStats = this.calculateStats(template, {
      level,
      tier,
      enhancementLevel,
      factionAlignment,
      randomStatCount: options.randomStatCount,
      guaranteedStats: options.guaranteedStats,
      rarityBoost: options.rarityBoost
    });

    // 5. Construire l'objet généré
    const generatedItem: IGeneratedItem = {
      itemId: IdGenerator.generateCompactUUID(), // Nouvel ID unique pour l'instance
      name: template.name,
      description: template.description,
      iconUrl: template.iconUrl,
      category: template.category,
      subCategory: template.subCategory,
      rarity: template.rarity,
      equipmentSlot: template.equipmentSlot,
      classRestriction: template.classRestriction,
      
      level,
      tier,
      enhancementLevel,
      factionAlignment,
      
      generatedStats,
      templateItemId,
      generationSeed: seed,
      createdAt: new Date()
    };

    return generatedItem;
  }

  /**
   * Calcule les stats finales avec tous les modificateurs
   */
  private static calculateStats(
    template: any,
    options: {
      level: number;
      tier: number;
      enhancementLevel: number;
      factionAlignment?: string;
      randomStatCount?: number;
      guaranteedStats?: string[];
      rarityBoost?: number;
    }
  ): IGeneratedStats {
    
    const { level, tier, enhancementLevel, factionAlignment, randomStatCount, guaranteedStats, rarityBoost } = options;
    
    // 1. Stats de base du template au niveau donné
    const baseStats = { ...template.baseStats };
    if (template.statsPerLevel) {
      for (const [stat, increment] of Object.entries(template.statsPerLevel)) {
        if (typeof increment === "number") {
          baseStats[stat] = (baseStats[stat] || 0) + increment * (level - 1);
        }
      }
    }

    // 2. Calculer les multiplicateurs
    const multipliers = {
      levelMultiplier: 1 + (level - 1) * 0.08,  // +8% par niveau
      rarityMultiplier: RARITY_MULTIPLIERS[template.rarity] * (1 + (rarityBoost || 0)),
      factionMultiplier: factionAlignment ? 1.3 : 1.0,  // +30% si faction alignée
      enhancementMultiplier: 1 + enhancementLevel * 0.2,  // +20% par étoile d'amélioration
      tierMultiplier: 1 + (tier - 1) * 0.25  // +25% par tier
    };

    // 3. Générer les stats aléatoires
    const randomStats = this.generateRandomStats(
      template.equipmentSlot,
      randomStatCount || this.getDefaultRandomStatCount(template.rarity),
      guaranteedStats
    );

    // 4. Appliquer tous les multiplicateurs
    const finalStats: Partial<IItemStats> = {};
    const totalMultiplier = Object.values(multipliers).reduce((a, b) => a * b, 1);

    // Stats de base
    for (const [stat, value] of Object.entries(baseStats)) {
      if (typeof value === "number") {
        finalStats[stat as keyof IItemStats] = Math.round(value * totalMultiplier);
      }
    }

    // Stats aléatoires
    for (const randomStat of randomStats) {
      const currentValue = finalStats[randomStat.stat as keyof IItemStats] || 0;
      finalStats[randomStat.stat as keyof IItemStats] = Math.round(
        currentValue + randomStat.value * totalMultiplier * 0.7  // Les stats aléatoires sont 30% moins puissantes
      );
    }

    // 5. Calculer le power score
    const powerScore = this.calculatePowerScore(finalStats);

    return {
      baseStats,
      randomStats,
      multipliers,
      finalStats,
      powerScore
    };
  }

  /**
   * Génère des stats aléatoires selon l'emplacement d'équipement
   */
  private static generateRandomStats(
    equipmentSlot: string | undefined,
    count: number,
    guaranteedStats?: string[]
  ): Array<{ stat: string; value: number; variance: number; source: "random" | "guaranteed" }> {
    
    const results: Array<{ stat: string; value: number; variance: number; source: "random" | "guaranteed" }> = [];
    const usedStats = new Set<string>();

    if (!equipmentSlot || !RANDOM_STAT_POOLS[equipmentSlot]) {
      return results;
    }

    const statPool = [...RANDOM_STAT_POOLS[equipmentSlot]];

    // 1. Ajouter les stats garanties
    if (guaranteedStats) {
      for (const statName of guaranteedStats) {
        const poolStat = statPool.find(s => s.stat === statName);
        if (poolStat && !usedStats.has(statName)) {
          const baseValue = this.randomFloat(poolStat.baseRange[0], poolStat.baseRange[1]);
          const variance = this.randomFloat(-0.2, 0.3); // -20% à +30%
          
          results.push({
            stat: statName,
            value: Math.round(baseValue * (1 + variance)),
            variance,
            source: "guaranteed"
          });
          usedStats.add(statName);
        }
      }
    }

    // 2. Ajouter les stats aléatoires
    const remainingCount = Math.max(0, count - results.length);
    for (let i = 0; i < remainingCount; i++) {
      const availableStats = statPool.filter(s => !usedStats.has(s.stat));
      if (availableStats.length === 0) break;

      const selectedStat = this.weightedRandom(availableStats);
      const baseValue = this.randomFloat(selectedStat.baseRange[0], selectedStat.baseRange[1]);
      const variance = this.randomFloat(-0.15, 0.25); // -15% à +25%
      
      results.push({
        stat: selectedStat.stat,
        value: Math.round(baseValue * (1 + variance)),
        variance,
        source: "random"
      });
      usedStats.add(selectedStat.stat);
    }

    return results;
  }

  /**
   * Détermine le nombre de stats aléatoires selon la rareté
   */
  private static getDefaultRandomStatCount(rarity: string): number {
    const counts: { [rarity: string]: number } = {
      "Common": this.randomInt(0, 1),
      "Rare": this.randomInt(1, 2),
      "Epic": this.randomInt(2, 3),
      "Legendary": this.randomInt(3, 4),
      "Mythic": this.randomInt(4, 5),
      "Ascended": 5
    };
    return counts[rarity] || 0;
  }

  /**
   * Détermine si un objet a un alignement de faction
   */
  private static rollFactionAlignment(rarity: string): string | undefined {
    const chances: { [rarity: string]: number } = {
      "Common": 0.0,      // Pas de faction
      "Rare": 0.3,        // 30% de chance
      "Epic": 0.6,        // 60% de chance
      "Legendary": 0.9,   // 90% de chance
      "Mythic": 0.95,     // 95% de chance
      "Ascended": 1.0     // Toujours
    };

    const chance = chances[rarity] || 0;
    if (Math.random() < chance) {
      return FACTION_ALIGNMENTS[Math.floor(Math.random() * FACTION_ALIGNMENTS.length)];
    }
    return undefined;
  }

  /**
   * Calcule le power score d'un objet
   */
  private static calculatePowerScore(stats: Partial<IItemStats>): number {
    let power = 0;
    
    // Formule similaire à celle des héros : ATQ × 1 + DEF × 2 + PV ÷ 10
    power += (stats.atk || 0) * 1;
    power += (stats.def || 0) * 2;
    power += (stats.hp || 0) / 10;
    
    // Bonus pour les stats avancées
    power += (stats.crit || 0) * 0.5;
    power += (stats.critDamage || 0) * 0.3;
    power += (stats.dodge || 0) * 0.4;
    power += (stats.vitesse || 0) * 0.6;
    power += (stats.healingBonus || 0) * 0.4;
    power += (stats.energyRegen || 0) * 2;
    
    return Math.round(power);
  }

  // === UTILITAIRES POUR LA GÉNÉRATION ALÉATOIRE ===

  private static seed = 0;

  private static setSeed(seedStr: string): void {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      const char = seedStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    this.seed = Math.abs(hash);
  }

  private static generateSeed(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private static seededRandom(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  private static randomInt(min: number, max: number): number {
    return Math.floor(this.seededRandom() * (max - min + 1)) + min;
  }

  private static randomFloat(min: number, max: number): number {
    return this.seededRandom() * (max - min) + min;
  }

  private static weightedRandom<T extends { weight: number }>(items: T[]): T {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = this.seededRandom() * totalWeight;
    
    for (const item of items) {
      random -= item.weight;
      if (random <= 0) return item;
    }
    
    return items[items.length - 1];
  }

  // === MÉTHODES UTILITAIRES PUBLIQUES ===

  /**
   * Génère plusieurs instances d'objets en lot
   */
  static async generateBatch(
    templateItemId: string, 
    count: number, 
    baseOptions: IGenerationOptions
  ): Promise<IGeneratedItem[]> {
    const results: IGeneratedItem[] = [];
    
    for (let i = 0; i < count; i++) {
      const options = {
        ...baseOptions,
        seed: baseOptions.seed ? `${baseOptions.seed}_${i}` : undefined
      };
      
      const item = await this.generateItemInstance(templateItemId, options);
      results.push(item);
    }
    
    return results;
  }

  /**
   * Prévisualise la génération sans créer l'objet
   */
  static async previewGeneration(
    templateItemId: string, 
    options: IGenerationOptions
  ): Promise<{ stats: IGeneratedStats; powerRange: { min: number; max: number } }> {
    
    const template = await Item.findOne({ itemId: templateItemId });
    if (!template) {
      throw new Error(`Template item not found: ${templateItemId}`);
    }

    // Générer plusieurs échantillons pour estimer la plage
    const samples: number[] = [];
    for (let i = 0; i < 10; i++) {
      const tempOptions = { ...options, seed: `preview_${i}` };
      const stats = this.calculateStats(template, {
        level: tempOptions.level,
        tier: tempOptions.tier || 1,
        enhancementLevel: tempOptions.enhancementLevel || 0,
        factionAlignment: tempOptions.factionAlignment,
        randomStatCount: tempOptions.randomStatCount,
        guaranteedStats: tempOptions.guaranteedStats,
        rarityBoost: tempOptions.rarityBoost
      });
      samples.push(stats.powerScore);
    }

    // Calculer les stats avec le seed principal
    const mainSeed = options.seed || this.generateSeed();
    this.setSeed(mainSeed);
    
    const finalStats = this.calculateStats(template, {
      level: options.level,
      tier: options.tier || 1,
      enhancementLevel: options.enhancementLevel || 0,
      factionAlignment: options.factionAlignment,
      randomStatCount: options.randomStatCount,
      guaranteedStats: options.guaranteedStats,
      rarityBoost: options.rarityBoost
    });

    return {
      stats: finalStats,
      powerRange: {
        min: Math.min(...samples),
        max: Math.max(...samples)
      }
    };
  }
}

export default ItemGenerator;

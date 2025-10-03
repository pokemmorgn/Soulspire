import Monster from "../models/Monster";
import CampaignWorld, { ILevelConfig, IWaveConfig as ILevelWaveConfig } from "../models/CampaignWorld";
import { IBattleParticipant } from "../models/Battle";
import { HeroSpells } from "../gameplay/SpellManager";
import { IWaveConfig } from "./BattleEngine";
import { IdGenerator } from "../utils/idGenerator";
export class MonsterService {

  /**
   * Générer les ennemis pour un niveau de campagne (avec support des vagues)
   */
  public static async generateCampaignEnemies(
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<{
    enemyTeam: IBattleParticipant[];
    enemySpells: Map<string, HeroSpells>;
    waveConfigs?: IWaveConfig[];
  }> {
    try {
      console.log(`🎯 Génération ennemis: Monde ${worldId}, Niveau ${levelId}, ${difficulty}`);

      // Récupérer la configuration du monde
      const world = await CampaignWorld.findOne({ worldId });
      if (!world) {
        console.warn(`⚠️ Monde ${worldId} introuvable, génération par défaut`);
        return this.generateDefaultEnemies(worldId, levelId, difficulty);
      }

      // Trouver le niveau spécifique
      const levelConfig = world.levels.find(l => l.levelIndex === levelId);
      if (!levelConfig) {
        console.warn(`⚠️ Niveau ${levelId} introuvable, génération par défaut`);
        return this.generateDefaultEnemies(worldId, levelId, difficulty);
      }

      // ✨ NOUVEAU : Vérifier si c'est un combat à vagues
      const shouldUseWaves = this.shouldLevelHaveWaves(levelConfig);
      
      if (shouldUseWaves) {
        console.log(`🌊 Combat multi-vagues détecté pour niveau ${levelId}`);
        return await this.generateWaveEnemies(world, levelConfig, worldId, levelId, difficulty);
      }

      // Combat classique (une seule vague)
      const { enemyTeam, enemySpells } = await this.generateSingleWaveEnemies(
        world,
        levelConfig,
        worldId,
        levelId,
        difficulty
      );

      return { enemyTeam, enemySpells };

    } catch (error) {
      console.error("❌ Erreur génération ennemis:", error);
      return this.generateDefaultEnemies(worldId, levelId, difficulty);
    }
  }

  /**
   * ✨ NOUVEAU : Vérifier si un niveau doit avoir des vagues
   */
  private static shouldLevelHaveWaves(levelConfig: ILevelConfig): boolean {
    // 1. Si waves est explicitement défini et non vide
    if (levelConfig.waves && levelConfig.waves.length > 1) {
      return true;
    }

    // 2. Si enableWaves est activé
    if (levelConfig.enableWaves === true) {
      return true;
    }

    return false;
  }

  /**
   * ✨ NOUVEAU : Générer les vagues pour un combat multi-vagues
   */
  private static async generateWaveEnemies(
    world: any,
    levelConfig: ILevelConfig,
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<{
    enemyTeam: IBattleParticipant[];
    enemySpells: Map<string, HeroSpells>;
    waveConfigs: IWaveConfig[];
  }> {
    const waveConfigs: IWaveConfig[] = [];
    const allEnemySpells = new Map<string, HeroSpells>();

    // Cas 1 : Vagues explicitement définies dans la config
    if (levelConfig.waves && levelConfig.waves.length > 0) {
      console.log(`📋 Utilisation des vagues configurées (${levelConfig.waves.length} vagues)`);
      
      for (const waveConfigData of levelConfig.waves) {
        const { enemyTeam, enemySpells } = await this.generateWaveFromConfig(
          world,
          waveConfigData,
          worldId,
          levelId,
          difficulty
        );

        // Fusionner les sorts
        enemySpells.forEach((spells, heroId) => {
          allEnemySpells.set(heroId, spells);
        });

        // Calculer les récompenses de vague
        const waveRewards = this.calculateWaveRewards(
          worldId,
          levelId,
          difficulty,
          waveConfigData.waveNumber,
          levelConfig.waves!.length,
          levelConfig.waveRewards
        );

        waveConfigs.push({
          waveNumber: waveConfigData.waveNumber,
          enemies: enemyTeam,
          delay: waveConfigData.delay || 3000,
          isBossWave: waveConfigData.isBossWave || false,
          waveRewards
        });
      }
    }
    // Cas 2 : Génération automatique des vagues
    else if (levelConfig.enableWaves === true) {
      const waveCount = levelConfig.autoWaveCount || this.getDefaultWaveCount(levelConfig.enemyType);
      console.log(`🤖 Génération automatique de ${waveCount} vagues`);

      for (let wave = 1; wave <= waveCount; wave++) {
        const { enemyTeam, enemySpells } = await this.generateAutoWave(
          world,
          levelConfig,
          worldId,
          levelId,
          difficulty,
          wave,
          waveCount
        );

        // Fusionner les sorts
        enemySpells.forEach((spells, heroId) => {
          allEnemySpells.set(heroId, spells);
        });

        const isBossWave = wave === waveCount;
        const waveRewards = this.calculateWaveRewards(
          worldId,
          levelId,
          difficulty,
          wave,
          waveCount,
          levelConfig.waveRewards
        );

        waveConfigs.push({
          waveNumber: wave,
          enemies: enemyTeam,
          delay: wave === 1 ? 0 : 3000,
          isBossWave,
          waveRewards
        });
      }
    }

    // La première vague sert d'équipe initiale
    const initialEnemyTeam = waveConfigs[0]?.enemies || [];

    return {
      enemyTeam: initialEnemyTeam,
      enemySpells: allEnemySpells,
      waveConfigs
    };
  }

  /**
   * ✨ NOUVEAU : Générer une vague depuis la configuration
   */
  private static async generateWaveFromConfig(
    world: any,
    waveConfig: ILevelWaveConfig,
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<{
    enemyTeam: IBattleParticipant[];
    enemySpells: Map<string, HeroSpells>;
  }> {
    const enemyTeam: IBattleParticipant[] = [];
    const enemySpells = new Map<string, HeroSpells>();

    // Si des monstres sont explicitement définis
    if (waveConfig.monsters && waveConfig.monsters.length > 0) {
      for (const monsterConfig of waveConfig.monsters) {
        const monster = await Monster.findOne({ monsterId: monsterConfig.monsterId });
        if (!monster) {
          console.warn(`⚠️ Monstre ${monsterConfig.monsterId} introuvable`);
          continue;
        }

        const count = monsterConfig.count || 1;
        for (let i = 0; i < count; i++) {
          const participant = this.createEnemyParticipant(
            monster,
            worldId,
            levelId,
            difficulty,
            monsterConfig.position || (enemyTeam.length + 1),
            monsterConfig.levelOverride,
            monsterConfig.starsOverride
          );

          enemyTeam.push(participant);

          const spells = this.extractMonsterSpells(monster);
          enemySpells.set(participant.heroId, spells);
        }
      }
    }
    // Sinon, génération automatique
    else if (waveConfig.autoGenerate) {
      const autoGenConfig = waveConfig.autoGenerate;
      const monsterPool = world.defaultMonsterPool || [];

      for (let i = 0; i < autoGenConfig.count; i++) {
        const randomMonsterId = monsterPool[Math.floor(Math.random() * monsterPool.length)];
        const monster = await Monster.findOne({ monsterId: randomMonsterId });

        if (monster) {
          const participant = this.createEnemyParticipant(
            monster,
            worldId,
            levelId,
            difficulty,
            i + 1
          );

          enemyTeam.push(participant);

          const spells = this.extractMonsterSpells(monster);
          enemySpells.set(participant.heroId, spells);
        }
      }
    }

    return { enemyTeam, enemySpells };
  }

  /**
   * ✨ NOUVEAU : Générer automatiquement une vague
   */
  private static async generateAutoWave(
    world: any,
    levelConfig: ILevelConfig,
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare",
    waveNumber: number,
    totalWaves: number
  ): Promise<{
    enemyTeam: IBattleParticipant[];
    enemySpells: Map<string, HeroSpells>;
  }> {
    const enemyTeam: IBattleParticipant[] = [];
    const enemySpells = new Map<string, HeroSpells>();

    // Déterminer le type d'ennemis selon la vague
    let enemyType: "normal" | "elite" | "boss";
    let enemyCount: number;

    if (waveNumber === totalWaves) {
      // Dernière vague = boss
      enemyType = "boss";
      enemyCount = 1;
    } else if (waveNumber === totalWaves - 1 && totalWaves >= 3) {
      // Avant-dernière vague = élites
      enemyType = "elite";
      enemyCount = 2;
    } else {
      // Vagues normales
      enemyType = "normal";
      enemyCount = 3;
    }

    console.log(`🎲 Vague ${waveNumber}: ${enemyCount} ${enemyType}(s)`);

    // Générer les ennemis
    const monsterPool = world.defaultMonsterPool || [];
    
    for (let i = 0; i < enemyCount; i++) {
      const randomMonsterId = monsterPool[Math.floor(Math.random() * monsterPool.length)];
      const monster = await Monster.findOne({ monsterId: randomMonsterId });

      if (monster) {
        // Ajuster le niveau selon la vague (AVEC CAP À 100)
        const levelBonus = (waveNumber - 1) * 2;
        const calculatedLevel = Math.floor(10 + (worldId - 1) * 5 + levelId * 0.5) + levelBonus;
        const overrideLevel = Math.min(100, calculatedLevel); // ✅ CAP à 100

        const participant = this.createEnemyParticipant(
          monster,
          worldId,
          levelId,
          difficulty,
          i + 1,
          overrideLevel,
          enemyType === "boss" ? 5 : enemyType === "elite" ? 4 : 3
        );

        enemyTeam.push(participant);

        const spells = this.extractMonsterSpells(monster);
        enemySpells.set(participant.heroId, spells);
      }
    }

    return { enemyTeam, enemySpells };
  }

  /**
   * ✨ NOUVEAU : Calculer les récompenses d'une vague
   */
  private static calculateWaveRewards(
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare",
    waveNumber: number,
    totalWaves: number,
    configRewards?: any
  ) {
    // Si des récompenses sont définies dans la config
    if (configRewards) {
      if (waveNumber === totalWaves && configRewards.finalWave) {
        return configRewards.finalWave;
      } else if (configRewards.perWave) {
        return configRewards.perWave;
      }
    }

    // Récompenses par défaut
    const baseExp = 20 + (worldId - 1) * 5 + levelId;
    const baseGold = 15 + (worldId - 1) * 3 + levelId;

    // Multiplicateur de difficulté
    let diffMultiplier = 1.0;
    if (difficulty === "Hard") diffMultiplier = 1.5;
    if (difficulty === "Nightmare") diffMultiplier = 2.0;

    // Bonus pour la dernière vague
    const waveMultiplier = waveNumber === totalWaves ? 2.0 : 0.5;

    return {
      experience: Math.floor(baseExp * diffMultiplier * waveMultiplier),
      gold: Math.floor(baseGold * diffMultiplier * waveMultiplier),
      items: waveNumber === totalWaves ? ["wave_completion_token"] : [],
      fragments: []
    };
  }

  /**
   * ✨ NOUVEAU : Obtenir le nombre de vagues par défaut selon le type d'ennemi
   */
  private static getDefaultWaveCount(enemyType?: string): number {
    if (enemyType === "boss") return 3;
    if (enemyType === "elite") return 2;
    return 1;
  }

  /**
   * Générer les ennemis pour une seule vague (combat classique)
   */
  private static async generateSingleWaveEnemies(
    world: any,
    levelConfig: ILevelConfig,
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<{
    enemyTeam: IBattleParticipant[];
    enemySpells: Map<string, HeroSpells>;
  }> {
    const enemyTeam: IBattleParticipant[] = [];
    const enemySpells = new Map<string, HeroSpells>();

    // Cas 1 : Monstres explicitement définis
    if (levelConfig.monsters && levelConfig.monsters.length > 0) {
      console.log(`📋 Utilisation des monstres configurés (${levelConfig.monsters.length})`);

      for (const monsterConfig of levelConfig.monsters) {
        const monster = await Monster.findOne({ monsterId: monsterConfig.monsterId });
        if (!monster) {
          console.warn(`⚠️ Monstre ${monsterConfig.monsterId} introuvable`);
          continue;
        }

        const count = monsterConfig.count || 1;
        for (let i = 0; i < count; i++) {
          const participant = this.createEnemyParticipant(
            monster,
            worldId,
            levelId,
            difficulty,
            monsterConfig.position || (enemyTeam.length + 1),
            monsterConfig.levelOverride,
            monsterConfig.starsOverride
          );

          enemyTeam.push(participant);

          const spells = this.extractMonsterSpells(monster);
          enemySpells.set(participant.heroId, spells);
        }
      }
    }
    // Cas 2 : Auto-génération
    else if (levelConfig.autoGenerate) {
      console.log(`🤖 Génération automatique`);

      const autoGenConfig = levelConfig.autoGenerate;
      const monsterPool = autoGenConfig.useWorldPool ? world.defaultMonsterPool : [];

      if (!monsterPool || monsterPool.length === 0) {
        console.warn(`⚠️ Pool de monstres vide, utilisation fallback`);
        return this.generateDefaultEnemies(worldId, levelId, difficulty);
      }

      for (let i = 0; i < autoGenConfig.count; i++) {
        const randomMonsterId = monsterPool[Math.floor(Math.random() * monsterPool.length)];
        const monster = await Monster.findOne({ monsterId: randomMonsterId });

        if (monster) {
          const participant = this.createEnemyParticipant(
            monster,
            worldId,
            levelId,
            difficulty,
            i + 1
          );

          enemyTeam.push(participant);

          const spells = this.extractMonsterSpells(monster);
          enemySpells.set(participant.heroId, spells);
        }
      }
    }
    // Cas 3 : Fallback
    else {
      console.warn(`⚠️ Aucune config de monstres, utilisation fallback`);
      return this.generateDefaultEnemies(worldId, levelId, difficulty);
    }

    return { enemyTeam, enemySpells };
  }

  /**
   * Créer un participant ennemi depuis un monstre
   */
  private static createEnemyParticipant(
    monster: any,
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare",
    position: number,
    levelOverride?: number,
    starsOverride?: number
  ): IBattleParticipant {
    // Calcul du niveau de l'ennemi (AVEC CAP À 100)
    const calculatedLevel = levelOverride || Math.floor(10 + (worldId - 1) * 5 + levelId * 0.5);
    const baseLevel = Math.min(100, calculatedLevel); // ✅ CAP à 100
    
    // Multiplicateurs de difficulté
    let diffMultiplier = 1.0;
    if (difficulty === "Hard") diffMultiplier = 2.0;
    if (difficulty === "Nightmare") diffMultiplier = 4.0;

    // Déterminer le type d'ennemi
    const enemyType = levelId % 10 === 0 ? "boss" : levelId % 5 === 0 ? "elite" : "normal";
    let typeMultiplier = 1.0;
    if (enemyType === "boss") typeMultiplier = 1.5;
    if (enemyType === "elite") typeMultiplier = 1.2;

    const totalMultiplier = diffMultiplier * typeMultiplier;

    // Stats finales
    const finalHp = Math.floor(monster.baseStats.hp * totalMultiplier);
    const finalAtk = Math.floor(monster.baseStats.atk * totalMultiplier);
    const finalDef = Math.floor(monster.baseStats.def * totalMultiplier);
    const finalSpeed = monster.baseStats.vitesse || 80;

    return {
      heroId: `${monster.monsterId}_${Date.now()}_${IdGenerator.generateCompactUUID().slice(0, 8)}`,
      name: monster.name,
      position,
      role: monster.role,
      element: monster.element,
      rarity: monster.rarity,
      level: baseLevel,
      stars: starsOverride || 3,
      stats: {
        hp: finalHp,
        maxHp: finalHp,
        atk: finalAtk,
        def: finalDef,
        speed: finalSpeed
      },
      currentHp: finalHp,
      energy: 0,
      status: {
        alive: true,
        buffs: [],
        debuffs: []
      }
    };
  }

  /**
   * Extraire les sorts d'un monstre
   */
  private static extractMonsterSpells(monster: any): HeroSpells {
    const heroSpells: HeroSpells = {};

    if (monster.spells) {
      if (monster.spells.spell1?.id) {
        heroSpells.spell1 = {
          id: monster.spells.spell1.id,
          level: monster.spells.spell1.level || 1
        };
      }

      if (monster.spells.spell2?.id) {
        heroSpells.spell2 = {
          id: monster.spells.spell2.id,
          level: monster.spells.spell2.level || 1
        };
      }

      if (monster.spells.spell3?.id) {
        heroSpells.spell3 = {
          id: monster.spells.spell3.id,
          level: monster.spells.spell3.level || 1
        };
      }

      if (monster.spells.ultimate?.id) {
        heroSpells.ultimate = {
          id: monster.spells.ultimate.id,
          level: monster.spells.ultimate.level || 1
        };
      }

      if (monster.spells.passive?.id) {
        heroSpells.passive = {
          id: monster.spells.passive.id,
          level: monster.spells.passive.level || 1
        };
      }
    }

    // Ultimate par défaut si pas défini
    if (!heroSpells.ultimate) {
      heroSpells.ultimate = {
        id: this.getDefaultUltimate(monster.element, monster.role),
        level: 1
      };
    }

    return heroSpells;
  }

  /**
   * Générer des ennemis par défaut (fallback)
   */
  private static async generateDefaultEnemies(
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<{
    enemyTeam: IBattleParticipant[];
    enemySpells: Map<string, HeroSpells>;
  }> {
    console.warn(`⚠️ Génération d'ennemis par défaut pour ${worldId}-${levelId}`);

    const enemyTeam: IBattleParticipant[] = [];
    const enemySpells = new Map<string, HeroSpells>();

    // Récupérer 3 monstres aléatoires
    const monsters = await Monster.aggregate([{ $sample: { size: 3 } }]);

    for (let i = 0; i < monsters.length; i++) {
      const monster = monsters[i];
      const participant = this.createEnemyParticipant(
        monster,
        worldId,
        levelId,
        difficulty,
        i + 1
      );

      enemyTeam.push(participant);

      const spells = this.extractMonsterSpells(monster);
      enemySpells.set(participant.heroId, spells);
    }

    return { enemyTeam, enemySpells };
  }

  /**
   * Obtenir un ultimate par défaut
   */
  private static getDefaultUltimate(element: string, role: string): string {
    const ultimatesByElement: Record<string, string> = {
      "Fire": "fire_storm",
      "Water": "tidal_wave",
      "Wind": "tornado",
      "Electric": "lightning_strike",
      "Light": "divine_light",
      "Dark": "shadow_realm"
    };

    const ultimatesByRole: Record<string, string> = {
      "Tank": "fortress_shield",
      "DPS Melee": "berserker_rage",
      "DPS Ranged": "arrow_storm",
      "Support": "mass_healing"
    };

    return ultimatesByElement[element] || ultimatesByRole[role] || "basic_ultimate";
  }

  // ========================================
  // 🔧 MÉTHODES POUR LE PANEL ADMIN
  // ========================================

  /**
   * Récupérer les statistiques globales des monstres
   */
  public static async getMonsterStats() {
    try {
      const totalMonsters = await Monster.countDocuments();
      
      const byElement = await Monster.aggregate([
        { $group: { _id: "$element", count: { $sum: 1 } } }
      ]);

      const byRole = await Monster.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } }
      ]);

      const byRarity = await Monster.aggregate([
        { $group: { _id: "$rarity", count: { $sum: 1 } } }
      ]);

      return {
        total: totalMonsters,
        byElement: byElement.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byRole: byRole.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byRarity: byRarity.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error("Erreur getMonsterStats:", error);
      throw error;
    }
  }

  /**
   * Créer un nouveau monstre
   */
  public static async createMonster(monsterData: any) {
    try {
      const monster = new Monster(monsterData);
      await monster.save();
      
      console.log(`✅ Monstre créé: ${monster.name} (${monster.monsterId})`);
      
      return monster;
    } catch (error) {
      console.error("Erreur createMonster:", error);
      throw error;
    }
  }

  /**
   * Mettre à jour un monstre existant
   */
  public static async updateMonster(monsterId: string, updates: any) {
    try {
      const monster = await Monster.findOneAndUpdate(
        { monsterId },
        updates,
        { new: true, runValidators: true }
      );

      if (!monster) {
        throw new Error("Monster not found");
      }

      console.log(`✅ Monstre mis à jour: ${monster.name} (${monster.monsterId})`);

      return monster;
    } catch (error) {
      console.error("Erreur updateMonster:", error);
      throw error;
    }
  }

  /**
   * Supprimer un monstre
   */
  public static async deleteMonster(monsterId: string) {
    try {
      const result = await Monster.deleteOne({ monsterId });

      if (result.deletedCount === 0) {
        throw new Error("Monster not found");
      }

      console.log(`✅ Monstre supprimé: ${monsterId}`);

      return true;
    } catch (error) {
      console.error("Erreur deleteMonster:", error);
      throw error;
    }
  }
}

// server/src/services/MonsterService.ts
import Monster, { IMonsterDocument, MonsterType, MonsterElement } from "../models/Monster";
import CampaignWorld, { ILevelConfig, ICampaignWorld } from "../models/CampaignWorld";
import { GAME_BALANCE, getEnemyTotalMultiplier, calculateFinalStats } from "../config/gameBalance";
import { IBattleParticipant } from "../models/Battle";
import { HeroSpells } from "../gameplay/SpellManager";

/**
 * 👹 MONSTER SERVICE
 * 
 * Gère la génération dynamique des monstres pour les combats.
 * Lit la configuration depuis CampaignWorld.levels et génère les ennemis appropriés.
 */

export class MonsterService {

  /**
   * 🎯 MÉTHODE PRINCIPALE : Générer les ennemis pour un niveau de campagne
   * 
   * Lit la configuration du niveau et génère les monstres selon 3 modes:
   * 1. Monstres spécifiques assignés manuellement (monsters: [...])
   * 2. Auto-génération depuis le pool du monde (autoGenerate: {...})
   * 3. Fallback ancien système (enemyType/enemyCount)
   */
  public static async generateCampaignEnemies(
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<{
    enemyTeam: IBattleParticipant[];
    enemySpells: Map<string, HeroSpells>;
  }> {
    try {
      console.log(`👹 Génération monstres: Monde ${worldId}, Niveau ${levelId}, ${difficulty}`);

      // 1. Récupérer la configuration du monde et du niveau
      const world = await CampaignWorld.findOne({ worldId });
      if (!world) {
        throw new Error(`World ${worldId} not found`);
      }

      const levelConfig = world.levels.find(l => l.levelIndex === levelId);
      if (!levelConfig) {
        throw new Error(`Level ${levelId} not found in world ${worldId}`);
      }

      // 2. Déterminer le mode de génération
      let enemyTeam: IBattleParticipant[] = [];
      let enemySpells = new Map<string, HeroSpells>();

      // MODE 1: Monstres spécifiques assignés manuellement
      if (levelConfig.monsters && levelConfig.monsters.length > 0) {
        console.log(`✅ Mode: Monstres spécifiques (${levelConfig.monsters.length} configurés)`);
        
        const result = await this.generateFromSpecificMonsters(
          levelConfig.monsters,
          worldId,
          levelId,
          difficulty
        );
        
        enemyTeam = result.enemyTeam;
        enemySpells = result.enemySpells;
      }
      // MODE 2: Auto-génération depuis pool du monde
      else if (levelConfig.autoGenerate) {
        console.log(`✅ Mode: Auto-génération (pool du monde)`);
        
        const result = await this.generateFromWorldPool(
          world,
          levelConfig,
          worldId,
          levelId,
          difficulty
        );
        
        enemyTeam = result.enemyTeam;
        enemySpells = result.enemySpells;
      }
      // MODE 3: Fallback ancien système
      else {
        console.log(`⚠️ Mode: Fallback ancien système`);
        
        const enemyType = levelConfig.enemyType || this.determineEnemyType(levelId);
        const enemyCount = levelConfig.enemyCount || this.determineEnemyCount(enemyType);
        
        const result = await this.generateFromLegacySystem(
          worldId,
          levelId,
          difficulty,
          enemyType,
          enemyCount,
          world.elementBias
        );
        
        enemyTeam = result.enemyTeam;
        enemySpells = result.enemySpells;
      }

      console.log(`✅ ${enemyTeam.length} monstres générés pour Monde ${worldId}-${levelId}`);
      
      return { enemyTeam, enemySpells };

    } catch (error: any) {
      console.error("❌ Erreur generateCampaignEnemies:", error);
      throw error;
    }
  }

  /**
   * 🎯 MODE 1: Générer depuis monstres spécifiques assignés
   */
  private static async generateFromSpecificMonsters(
    monsterConfigs: any[],
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<{
    enemyTeam: IBattleParticipant[];
    enemySpells: Map<string, HeroSpells>;
  }> {
    const enemyTeam: IBattleParticipant[] = [];
    const enemySpells = new Map<string, HeroSpells>();
    
    let positionCounter = 1;

    for (const config of monsterConfigs) {
      const count = config.count || 1;
      
      // Récupérer le monstre depuis la DB
      const monsterData = await Monster.findOne({ monsterId: config.monsterId });
      if (!monsterData) {
        console.warn(`⚠️ Monstre ${config.monsterId} non trouvé, skip`);
        continue;
      }

      // Générer X instances de ce monstre
      for (let i = 0; i < count; i++) {
        const level = config.levelOverride || this.calculateMonsterLevel(worldId, levelId, monsterData.type);
        const stars = config.starsOverride || GAME_BALANCE.monsters.spawnRules.starsByType[monsterData.type];
        const position = config.position || positionCounter++;

        const participant = await this.createBattleParticipant(
          monsterData,
          level,
          stars,
          position,
          worldId,
          levelId,
          difficulty,
          i
        );

        enemyTeam.push(participant);

        // Extraire les sorts
        const spells = this.extractMonsterSpells(monsterData);
        enemySpells.set(participant.heroId, spells);
      }
    }

    return { enemyTeam, enemySpells };
  }

  /**
   * 🎯 MODE 2: Générer depuis le pool du monde (auto-génération)
   */
  private static async generateFromWorldPool(
    world: ICampaignWorld,
    levelConfig: ILevelConfig,
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<{
    enemyTeam: IBattleParticipant[];
    enemySpells: Map<string, HeroSpells>;
  }> {
    const autoGen = levelConfig.autoGenerate!;
    const count = autoGen.count || 3;
    const enemyType = autoGen.enemyType || "normal";

    let monsters: IMonsterDocument[] = [];

    // Utiliser le pool du monde ou faire un sample aléatoire
    if (autoGen.useWorldPool && world.defaultMonsterPool && world.defaultMonsterPool.length > 0) {
      console.log(`📦 Utilisation du pool du monde (${world.defaultMonsterPool.length} monstres disponibles)`);
      
      // Récupérer les monstres du pool
      const poolMonsters = await Monster.find({
        monsterId: { $in: world.defaultMonsterPool },
        type: enemyType
      });

      // Si pas assez de monstres du bon type, prendre tous ceux du pool
      if (poolMonsters.length === 0) {
        const allPoolMonsters = await Monster.find({
          monsterId: { $in: world.defaultMonsterPool }
        });
        monsters = this.randomSample(allPoolMonsters, count);
      } else {
        monsters = this.randomSample(poolMonsters, count);
      }
    } else {
      console.log(`🎲 Sample aléatoire depuis la DB`);
      
      // Sample aléatoire depuis tous les monstres compatibles
      monsters = await Monster.sampleForWorld(worldId, count, enemyType);
    }

    // Si toujours pas de monstres, fallback sur n'importe quel monstre
    if (monsters.length === 0) {
      console.warn(`⚠️ Aucun monstre trouvé, fallback sur sample global`);
      monsters = await Monster.aggregate([
        { $match: { type: enemyType } },
        { $sample: { size: count } }
      ]);
    }

    // Générer les participants
    const enemyTeam: IBattleParticipant[] = [];
    const enemySpells = new Map<string, HeroSpells>();

    for (let i = 0; i < monsters.length; i++) {
      const monsterData = monsters[i];
      const level = this.calculateMonsterLevel(worldId, levelId, enemyType);
      const stars = GAME_BALANCE.monsters.spawnRules.starsByType[enemyType];
      const position = i + 1;

      const participant = await this.createBattleParticipant(
        monsterData,
        level,
        stars,
        position,
        worldId,
        levelId,
        difficulty,
        i
      );

      enemyTeam.push(participant);

      const spells = this.extractMonsterSpells(monsterData);
      enemySpells.set(participant.heroId, spells);
    }

    return { enemyTeam, enemySpells };
  }

  /**
   * 🎯 MODE 3: Fallback ancien système (compatibilité)
   */
  private static async generateFromLegacySystem(
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare",
    enemyType: MonsterType,
    enemyCount: number,
    elementBias?: string[]
  ): Promise<{
    enemyTeam: IBattleParticipant[];
    enemySpells: Map<string, HeroSpells>;
  }> {
    console.log(`🔄 Génération legacy: ${enemyCount}x ${enemyType}`);

    // Sample aléatoire
    let monsters = await Monster.sampleForWorld(worldId, enemyCount, enemyType);

    // Si pas assez de monstres, sample global
    if (monsters.length < enemyCount) {
      monsters = await Monster.aggregate([
        { $match: { type: enemyType } },
        { $sample: { size: enemyCount } }
      ]);
    }

    const enemyTeam: IBattleParticipant[] = [];
    const enemySpells = new Map<string, HeroSpells>();

    for (let i = 0; i < monsters.length; i++) {
      const monsterData = monsters[i];
      const level = this.calculateMonsterLevel(worldId, levelId, enemyType);
      const stars = GAME_BALANCE.monsters.spawnRules.starsByType[enemyType];
      const position = i + 1;

      const participant = await this.createBattleParticipant(
        monsterData,
        level,
        stars,
        position,
        worldId,
        levelId,
        difficulty,
        i
      );

      enemyTeam.push(participant);

      const spells = this.extractMonsterSpells(monsterData);
      enemySpells.set(participant.heroId, spells);
    }

    return { enemyTeam, enemySpells };
  }

  /**
   * 🏗️ Créer un IBattleParticipant depuis un monstre
   */
  private static async createBattleParticipant(
    monsterData: IMonsterDocument,
    level: number,
    stars: number,
    position: number,
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare",
    instanceIndex: number
  ): Promise<IBattleParticipant> {
    
    // Calculer le multiplicateur total
    const totalMultiplier = getEnemyTotalMultiplier(worldId, levelId, difficulty, monsterData.type);

    // Obtenir les stats de base du monstre
    const baseStats = monsterData.getStatsAtLevel(level, stars);

    // Appliquer le multiplicateur de difficulté/monde
    const finalStats: any = {};
    for (const [key, value] of Object.entries(baseStats)) {
      if (typeof value === 'number') {
        finalStats[key] = Math.floor(value * totalMultiplier);
      } else {
        finalStats[key] = value;
      }
    }

    // Bonus spécifiques pour boss/elite
    if (monsterData.type === "boss") {
      const bossBonus = GAME_BALANCE.campaign.bossStatBonus;
      finalStats.hp = Math.floor(finalStats.hp * bossBonus.hpMultiplier);
      finalStats.maxHp = finalStats.hp;
      finalStats.atk = Math.floor(finalStats.atk * bossBonus.atkMultiplier);
      finalStats.def = Math.floor(finalStats.def * bossBonus.defMultiplier);
    } else if (monsterData.type === "elite") {
      const eliteBonus = GAME_BALANCE.campaign.eliteStatBonus;
      finalStats.hp = Math.floor(finalStats.hp * eliteBonus.hpMultiplier);
      finalStats.maxHp = finalStats.hp;
      finalStats.atk = Math.floor(finalStats.atk * eliteBonus.atkMultiplier);
      finalStats.def = Math.floor(finalStats.def * eliteBonus.defMultiplier);
    }

    // Nom avec préfixe selon le type
    let displayName = monsterData.displayName || monsterData.name;
    if (monsterData.type === "boss") {
      displayName = `Boss ${displayName}`;
    } else if (monsterData.type === "elite") {
      displayName = `Elite ${displayName}`;
    }

    // ID unique pour cette instance
    const uniqueId = `${monsterData.monsterId}_${worldId}_${levelId}_${instanceIndex}`;

    // Energy de départ (boss commence avec de l'énergie)
    const startingEnergy = monsterData.type === "boss" ? 
      GAME_BALANCE.campaign.bossStatBonus.startingEnergy : 
      monsterData.type === "elite" ? 
        GAME_BALANCE.campaign.eliteStatBonus.startingEnergy : 
        0;

    // Buffs de départ (boss a boss_aura)
    const startingBuffs = monsterData.type === "boss" ? 
      [...GAME_BALANCE.campaign.bossStatBonus.initialBuffs] : 
      [];

    return {
      heroId: uniqueId,
      name: displayName,
      position,
      role: monsterData.role,
      element: monsterData.element,
      rarity: monsterData.rarity,
      level,
      stars,
      stats: finalStats,
      currentHp: finalStats.hp,
      energy: startingEnergy,
      status: {
        alive: true,
        buffs: startingBuffs,
        debuffs: []
      }
    };
  }

  /**
   * 📜 Extraire les sorts d'un monstre
   */
  private static extractMonsterSpells(monsterData: IMonsterDocument): HeroSpells {
    const spells: HeroSpells = {};

    if (monsterData.spells.spell1?.id) {
      spells.spell1 = {
        id: monsterData.spells.spell1.id,
        level: monsterData.spells.spell1.level || 1
      };
    }

    if (monsterData.spells.spell2?.id) {
      spells.spell2 = {
        id: monsterData.spells.spell2.id,
        level: monsterData.spells.spell2.level || 1
      };
    }

    if (monsterData.spells.spell3?.id) {
      spells.spell3 = {
        id: monsterData.spells.spell3.id,
        level: monsterData.spells.spell3.level || 1
      };
    }

    if (monsterData.spells.ultimate?.id) {
      spells.ultimate = {
        id: monsterData.spells.ultimate.id,
        level: monsterData.spells.ultimate.level || 1
      };
    }

    if (monsterData.spells.passive?.id) {
      spells.passive = {
        id: monsterData.spells.passive.id,
        level: monsterData.spells.passive.level || 1
      };
    }

    return spells;
  }

  /**
   * 📊 Calculer le niveau d'un monstre selon le monde/niveau
   */
  private static calculateMonsterLevel(
    worldId: number,
    levelId: number,
    enemyType: MonsterType
  ): number {
    const { levelByType } = GAME_BALANCE.monsters.spawnRules;
    const config = levelByType[enemyType];
    
    return config.base + (worldId * config.perWorld);
  }

  /**
   * 🎲 Sample aléatoire d'un tableau
   */
  private static randomSample<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, array.length));
  }

  /**
   * 🎯 Déterminer le type d'ennemi selon le niveau (fallback)
   */
  private static determineEnemyType(levelId: number): MonsterType {
    if (levelId % 10 === 0) return "boss";
    if (levelId % 5 === 0) return "elite";
    return "normal";
  }

  /**
   * 🔢 Déterminer le nombre d'ennemis selon le type (fallback)
   */
  private static determineEnemyCount(enemyType: MonsterType): number {
    switch (enemyType) {
      case "boss": return 1;
      case "elite": return 2;
      case "normal": return 3;
      default: return 3;
    }
  }

  /**
   * 🔍 Obtenir un monstre par ID
   */
  public static async getMonsterById(monsterId: string): Promise<IMonsterDocument | null> {
    return await Monster.findOne({ monsterId });
  }

  /**
   * 📦 Obtenir tous les monstres d'un monde
   */
  public static async getMonstersForWorld(worldId: number): Promise<IMonsterDocument[]> {
    return await Monster.findForWorld(worldId);
  }

  /**
   * 👑 Obtenir tous les boss
   */
  public static async getAllBosses(): Promise<IMonsterDocument[]> {
    return await Monster.find({ type: "boss" }).sort({ minWorldLevel: 1 });
  }

  /**
   * 🎨 Obtenir les monstres par thème visuel
   */
  public static async getMonstersByTheme(theme: string): Promise<IMonsterDocument[]> {
    return await Monster.findByTheme(theme as any);
  }

  /**
   * ✨ Créer un nouveau monstre
   */
  public static async createMonster(monsterData: any): Promise<IMonsterDocument> {
    try {
      const monster = new Monster(monsterData);
      await monster.save();
      
      console.log(`✅ Monstre créé: ${monster.monsterId} - ${monster.name}`);
      return monster;
    } catch (error: any) {
      console.error("❌ Erreur création monstre:", error);
      throw error;
    }
  }

  /**
   * 🔄 Mettre à jour un monstre
   */
  public static async updateMonster(
    monsterId: string,
    updates: Partial<IMonsterDocument>
  ): Promise<IMonsterDocument | null> {
    try {
      const monster = await Monster.findOneAndUpdate(
        { monsterId },
        { $set: updates },
        { new: true }
      );

      if (monster) {
        console.log(`✅ Monstre mis à jour: ${monsterId}`);
      }

      return monster;
    } catch (error: any) {
      console.error("❌ Erreur update monstre:", error);
      throw error;
    }
  }

  /**
   * 🗑️ Supprimer un monstre
   */
  public static async deleteMonster(monsterId: string): Promise<boolean> {
    try {
      const result = await Monster.deleteOne({ monsterId });
      
      if (result.deletedCount > 0) {
        console.log(`✅ Monstre supprimé: ${monsterId}`);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error("❌ Erreur suppression monstre:", error);
      throw error;
    }
  }

  /**
   * 📊 Obtenir les statistiques des monstres
   */
  public static async getMonsterStats() {
    try {
      const stats = await Monster.aggregate([
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            avgLevel: { $avg: "$baseStats.hp" }
          }
        }
      ]);

      const elementStats = await Monster.aggregate([
        {
          $group: {
            _id: "$element",
            count: { $sum: 1 }
          }
        }
      ]);

      const themeStats = await Monster.aggregate([
        {
          $group: {
            _id: "$visualTheme",
            count: { $sum: 1 }
          }
        }
      ]);

      return {
        byType: stats,
        byElement: elementStats,
        byTheme: themeStats,
        total: await Monster.countDocuments()
      };
    } catch (error: any) {
      console.error("❌ Erreur stats monstres:", error);
      throw error;
    }
  }
}

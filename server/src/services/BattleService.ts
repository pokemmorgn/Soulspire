import Battle, { IBattleParticipant, IBattleResult } from "../models/Battle";
import Player from "../models/Player";
import Hero from "../models/Hero";
import { BattleEngine } from "./BattleEngine";

export class BattleService {

  // Démarre un combat de campagne
  public static async startCampaignBattle(
    playerId: string, 
    worldId: number, 
    levelId: number, 
    difficulty: "Normal" | "Hard" | "Nightmare" = "Normal"
  ) {
    try {
      console.log(`🎯 Démarrage combat campagne: Monde ${worldId}, Niveau ${levelId}, ${difficulty}`);

      // Récupérer le joueur et son équipe
      const player = await Player.findById(playerId).populate("heroes.heroId");
      if (!player) {
        throw new Error("Player not found");
      }

      // Construire l'équipe du joueur (héros équipés)
      const playerTeam = await this.buildPlayerTeam(player);
      if (playerTeam.length === 0) {
        throw new Error("No equipped heroes found");
      }

      // Générer l'équipe ennemie
      const enemyTeam = await this.generateEnemyTeam(worldId, levelId, difficulty);

      // Créer le document de combat
      const battle = new Battle({
        playerId,
        battleType: "campaign",
        playerTeam,
        enemyTeam,
        actions: [],
        result: {} as IBattleResult,
        status: "preparing",
        context: {
          worldId,
          levelId,
          difficulty,
          enemyType: this.getEnemyType(levelId)
        }
      });

      await battle.save();

      // Lancer la simulation de combat
      const battleEngine = new BattleEngine(playerTeam, enemyTeam);
      const result = battleEngine.simulateBattle();

      // Mettre à jour le combat avec les résultats
      battle.actions = battleEngine.getActions();
      await battle.completeBattle(result);

      // Appliquer les récompenses si victoire
      if (result.victory) {
        await this.applyBattleRewards(player, result);
        await this.updatePlayerProgress(player, worldId, levelId, difficulty);
      }

      console.log(`✅ Combat terminé: ${result.victory ? "Victoire" : "Défaite"}`);

      return {
        battleId: battle._id,
        result,
        replay: battle.getBattleReplay()
      };

    } catch (error) {
      console.error("❌ Erreur lors du combat:", error);
      throw error;
    }
  }

  // Démarre un combat d'arène PvP
  public static async startArenaBattle(playerId: string, opponentId: string) {
    try {
      console.log(`⚔️ Combat d'arène: ${playerId} vs ${opponentId}`);

      // Récupérer les deux joueurs
      const [player, opponent] = await Promise.all([
        Player.findById(playerId).populate("heroes.heroId"),
        Player.findById(opponentId).populate("heroes.heroId")
      ]);

      if (!player || !opponent) {
        throw new Error("Player or opponent not found");
      }

      // Construire les équipes
      const playerTeam = await this.buildPlayerTeam(player);
      const enemyTeam = await this.buildPlayerTeam(opponent);

      if (playerTeam.length === 0 || enemyTeam.length === 0) {
        throw new Error("Both players must have equipped heroes");
      }

      // Créer le combat
      const battle = new Battle({
        playerId,
        battleType: "arena",
        playerTeam,
        enemyTeam,
        actions: [],
        result: {} as IBattleResult,
        status: "preparing"
      });

      await battle.save();

      // Simuler le combat
      const battleEngine = new BattleEngine(playerTeam, enemyTeam);
      const result = battleEngine.simulateBattle();

      // Finaliser le combat
      battle.actions = battleEngine.getActions();
      await battle.completeBattle(result);

      // Récompenses PvP spécifiques
      if (result.victory) {
        const pvpRewards = this.calculatePvPRewards();
        await this.applyBattleRewards(player, { ...result, rewards: pvpRewards });
      }

      return {
        battleId: battle._id,
        result,
        replay: battle.getBattleReplay()
      };

    } catch (error) {
      console.error("❌ Erreur combat d'arène:", error);
      throw error;
    }
  }

  // Construit l'équipe du joueur à partir de ses héros équipés
  private static async buildPlayerTeam(player: any): Promise<IBattleParticipant[]> {
    const team: IBattleParticipant[] = [];
    
    // Récupérer les héros équipés
    const equippedHeroes = player.heroes.filter((hero: any) => hero.equipped);
    
    for (const playerHero of equippedHeroes) {
      const heroData = playerHero.heroId;
      
      if (!heroData) continue;

      // Calculer les stats de combat
      const combatStats = this.calculateCombatStats(heroData, playerHero.level, playerHero.stars);
      
      const participant: IBattleParticipant = {
        heroId: heroData._id.toString(),
        name: heroData.name,
        role: heroData.role,
        element: heroData.element,
        rarity: heroData.rarity,
        level: playerHero.level,
        stars: playerHero.stars,
        stats: combatStats,
        currentHp: combatStats.hp,
        energy: 0,
        status: {
          alive: true,
          buffs: [],
          debuffs: []
        }
      };
      
      team.push(participant);
    }
    
    return team;
  }

  // Génère une équipe ennemie pour la campagne
  private static async generateEnemyTeam(
    worldId: number, 
    levelId: number, 
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<IBattleParticipant[]> {
    
    // Calculer la puissance des ennemis selon le monde/niveau
    const basePowerMultiplier = 1 + (worldId - 1) * 0.1 + (levelId - 1) * 0.02;
    const difficultyMultiplier = difficulty === "Hard" ? 2 : difficulty === "Nightmare" ? 4 : 1;
    const finalMultiplier = basePowerMultiplier * difficultyMultiplier;

    // Déterminer le type d'ennemi (normal/elite/boss)
    const enemyType = this.getEnemyType(levelId);
    const enemyCount = enemyType === "boss" ? 1 : enemyType === "elite" ? 2 : 3;

    // Récupérer des héros aléatoires comme base pour les ennemis
    const availableHeroes = await Hero.aggregate([{ $sample: { size: enemyCount } }]);
    
    const enemyTeam: IBattleParticipant[] = [];
    
    for (let i = 0; i < availableHeroes.length; i++) {
      const heroData = availableHeroes[i];
      
      // Niveau des ennemis basé sur le monde
      const enemyLevel = Math.min(100, Math.max(1, worldId * 5 + levelId));
      const enemyStars = enemyType === "boss" ? 6 : enemyType === "elite" ? 4 : 2;
      
      // Stats de base multipliées par la difficulté
      const baseStats = this.calculateCombatStats(heroData, enemyLevel, enemyStars);
      const enhancedStats = {
        hp: Math.floor(baseStats.hp * finalMultiplier),
        maxHp: Math.floor(baseStats.hp * finalMultiplier),
        atk: Math.floor(baseStats.atk * finalMultiplier),
        def: Math.floor(baseStats.def * finalMultiplier),
        speed: baseStats.speed
      };
      
      const enemy: IBattleParticipant = {
        heroId: `enemy_${heroData._id}_${i}`,
        name: `${enemyType === "boss" ? "Boss " : enemyType === "elite" ? "Elite " : ""}${heroData.name}`,
        role: heroData.role,
        element: heroData.element,
        rarity: heroData.rarity,
        level: enemyLevel,
        stars: enemyStars,
        stats: enhancedStats,
        currentHp: enhancedStats.hp,
        energy: 0,
        status: {
          alive: true,
          buffs: [],
          debuffs: []
        }
      };
      
      enemyTeam.push(enemy);
    }
    
    return enemyTeam;
  }

  // Calcule les stats de combat d'un héros
  private static calculateCombatStats(heroData: any, level: number, stars: number) {
    const levelMultiplier = 1 + (level - 1) * 0.1;
    const starMultiplier = 1 + (stars - 1) * 0.2;
    const totalMultiplier = levelMultiplier * starMultiplier;
    
    const hp = Math.floor(heroData.baseStats.hp * totalMultiplier);
    const atk = Math.floor(heroData.baseStats.atk * totalMultiplier);
    const def = Math.floor(heroData.baseStats.def * totalMultiplier);
    
    // Vitesse basée sur le rôle
    const speedByRole = {
      "Tank": 80,
      "DPS Melee": 100,
      "DPS Ranged": 90,
      "Support": 85
    };
    
    const baseSpeed = speedByRole[heroData.role as keyof typeof speedByRole] || 90;
    const speed = Math.floor(baseSpeed * (1 + (level - 1) * 0.01));
    
    return {
      hp,
      maxHp: hp,
      atk,
      def,
      speed
    };
  }

  // Détermine le type d'ennemi selon le niveau
  private static getEnemyType(levelId: number): "normal" | "elite" | "boss" {
    if (levelId % 10 === 0) return "boss";      // Niveaux 10, 20, 30 = boss
    if (levelId % 5 === 0) return "elite";      // Niveaux 5, 15, 25 = elite
    return "normal";                             // Autres = normal
  }

  // Applique les récompenses de combat au joueur
  private static async applyBattleRewards(player: any, result: IBattleResult) {
    // Appliquer l'expérience et l'or
    player.gold += result.rewards.gold;
    
    // TODO: Appliquer l'expérience aux héros
    // TODO: Ajouter les objets obtenus
    // TODO: Ajouter les fragments
    
    await player.save();
    
    console.log(`💰 Récompenses appliquées: ${result.rewards.gold} or, ${result.rewards.experience} XP`);
  }

  // Met à jour la progression du joueur en campagne
  private static async updatePlayerProgress(
    player: any, 
    worldId: number, 
    levelId: number, 
    difficulty: string
  ) {
    // Mettre à jour le niveau maximum atteint
    if (worldId > player.world || (worldId === player.world && levelId > player.level)) {
      player.world = worldId;
      player.level = levelId;
    }
    
    await player.save();
    
    console.log(`📈 Progression mise à jour: Monde ${player.world}, Niveau ${player.level}`);
  }

  // Calcule les récompenses spécifiques au PvP
  private static calculatePvPRewards() {
    return {
      experience: 50,
      gold: 100,
      items: [],
      fragments: []
    };
  }

  // Récupère l'historique des combats d'un joueur
  public static async getBattleHistory(playerId: string, limit: number = 20) {
    return await Battle.find({ playerId, status: "completed" })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("battleType result context createdAt battleDuration");
  }

  // Récupère les statistiques de combat d'un joueur
  public static async getPlayerBattleStats(playerId: string) {
    const stats = await Battle.aggregate([
      { $match: { playerId, status: "completed" } },
      { $group: {
        _id: null,
        totalBattles: { $sum: 1 },
        victories: { $sum: { $cond: ["$result.victory", 1, 0] } },
        totalDamage: { $sum: "$result.stats.totalDamageDealt" },
        avgBattleDuration: { $avg: "$result.battleDuration" }
      }},
      { $addFields: {
        winRate: { $divide: ["$victories", "$totalBattles"] }
      }}
    ]);
    
    return stats[0] || {
      totalBattles: 0,
      victories: 0,
      winRate: 0,
      totalDamage: 0,
      avgBattleDuration: 0
    };
  }

  // Récupère le replay d'un combat spécifique
  public static async getBattleReplay(battleId: string, playerId: string) {
    const battle = await Battle.findOne({ _id: battleId, playerId });
    
    if (!battle) {
      throw new Error("Battle not found");
    }
    
    return battle.getBattleReplay();
  }
}

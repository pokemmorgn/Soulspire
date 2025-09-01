import Battle, { IBattleParticipant, IBattleResult } from "../models/Battle";
import Player from "../models/Player";
import Hero from "../models/Hero";
import { BattleEngine } from "./BattleEngine";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { HeroSpells } from "../gameplay/SpellManager";

export class BattleService {

  // Démarre un combat de campagne
  public static async startCampaignBattle(
    playerId: string, 
    serverId: string,
    worldId: number, 
    levelId: number, 
    difficulty: "Normal" | "Hard" | "Nightmare" = "Normal"
  ) {
    try {
      console.log(`🎯 Démarrage combat campagne: Monde ${worldId}, Niveau ${levelId}, ${difficulty} sur ${serverId}`);

      // Récupérer le joueur ET vérifier qu'il est sur le bon serveur
      const player = await Player.findOne({ 
        _id: playerId, 
        serverId: serverId 
      }).populate("heroes.heroId");
      
      if (!player) {
        throw new Error("Player not found or not on this server");
      }

      // Construire l'équipe du joueur (héros équipés) avec leurs sorts
      const { playerTeam, playerSpells } = await this.buildPlayerTeamWithSpells(player);
      if (playerTeam.length === 0) {
        throw new Error("No equipped heroes found");
      }

      // Générer l'équipe ennemie avec leurs sorts
      const { enemyTeam, enemySpells } = await this.generateEnemyTeamWithSpells(worldId, levelId, difficulty);

      // Créer le document de combat avec serverId
      const battle = new Battle({
        playerId,
        serverId: serverId,
        battleType: "campaign",
        playerTeam,
        enemyTeam,
        actions: [],
        result: {
          victory: false,
          winnerTeam: "enemy",
          totalTurns: 0,
          battleDuration: 0,
          rewards: {
            experience: 0,
            gold: 0,
            items: [],
            fragments: []
          },
          stats: {
            totalDamageDealt: 0,
            totalHealingDone: 0,
            criticalHits: 0,
            ultimatesUsed: 0
          }
        },
        status: "preparing",
        context: {
          worldId,
          levelId,
          difficulty,
          enemyType: this.getEnemyType(levelId)
        }
      });

      await battle.save();

      // Lancer la simulation de combat AVEC les sorts
      const battleEngine = new BattleEngine(playerTeam, enemyTeam, playerSpells, enemySpells);
      const result = battleEngine.simulateBattle();

      // Mettre à jour le combat avec les résultats
      battle.actions = battleEngine.getActions();
      battle.result = result;
      battle.status = "completed";
      battle.battleEnded = new Date();
      await battle.save();

      // Appliquer les récompenses si victoire
      if (result.victory) {
        await this.applyBattleRewards(player, result);
        await this.updatePlayerProgress(player, worldId, levelId, difficulty);
      }

      await Promise.all([
        MissionService.updateProgress(
          playerId, 
          serverId, 
          "battle_wins", 
          1, 
          { 
            battleType: "campaign", 
            victory: result.victory, 
            difficulty: difficulty,
            world: worldId 
          }
        ),
        EventService.updatePlayerProgress(
          playerId, 
          serverId, 
          "battle_wins", 
          1, 
          { 
            battleType: "campaign", 
            victory: result.victory, 
            difficulty: difficulty,
            world: worldId 
          }
        )
      ]);
      
      console.log(`✅ Combat terminé: ${result.victory ? "Victoire" : "Défaite"}`);

      return {
        battleId: battle._id,
        result,
        replay: {
          battleId: battle._id,
          playerTeam: battle.playerTeam,
          enemyTeam: battle.enemyTeam,
          actions: battle.actions,
          result: battle.result,
          duration: Date.now() - battle.battleStarted.getTime()
        }
      };

    } catch (error) {
      console.error("❌ Erreur lors du combat:", error);
      throw error;
    }
  }

  // Démarre un combat d'arène PvP
  public static async startArenaBattle(
    playerId: string, 
    serverId: string,
    opponentId: string
  ) {
    try {
      console.log(`⚔️ Combat d'arène: ${playerId} vs ${opponentId} sur serveur ${serverId}`);

      // Récupérer les deux joueurs du même serveur (sauf si cross-server autorisé)
      const [player, opponent] = await Promise.all([
        Player.findOne({ _id: playerId, serverId: serverId }).populate("heroes.heroId"),
        Player.findOne({ _id: opponentId, serverId: serverId }).populate("heroes.heroId")
      ]);

      if (!player || !opponent) {
        throw new Error("Player or opponent not found on this server");
      }

      // Construire les équipes avec leurs sorts
      const { playerTeam, playerSpells } = await this.buildPlayerTeamWithSpells(player);
      const { playerTeam: enemyTeam, playerSpells: enemySpells } = await this.buildPlayerTeamWithSpells(opponent);

      if (playerTeam.length === 0 || enemyTeam.length === 0) {
        throw new Error("Both players must have equipped heroes");
      }

      // Créer le combat avec serverId
      const battle = new Battle({
        playerId,
        serverId: serverId,
        battleType: "arena",
        playerTeam,
        enemyTeam,
        actions: [],
        result: {
          victory: false,
          winnerTeam: "enemy",
          totalTurns: 0,
          battleDuration: 0,
          rewards: {
            experience: 0,
            gold: 0,
            items: [],
            fragments: []
          },
          stats: {
            totalDamageDealt: 0,
            totalHealingDone: 0,
            criticalHits: 0,
            ultimatesUsed: 0
          }
        },
        status: "preparing"
      });

      await battle.save();

      // Simuler le combat AVEC les sorts
      const battleEngine = new BattleEngine(playerTeam, enemyTeam, playerSpells, enemySpells);
      const result = battleEngine.simulateBattle();

      // Finaliser le combat
      battle.actions = battleEngine.getActions();
      battle.result = result;
      battle.status = "completed";
      battle.battleEnded = new Date();
      await battle.save();

      // Récompenses PvP spécifiques
      if (result.victory) {
        const pvpRewards = this.calculatePvPRewards();
        await this.applyBattleRewards(player, { ...result, rewards: pvpRewards });
      }

      await Promise.all([
        MissionService.updateProgress(
          playerId, 
          serverId, 
          "battle_wins", 
          1, 
          { 
            battleType: "arena", 
            victory: result.victory
          }
        ),
        EventService.updatePlayerProgress(
          playerId, 
          serverId, 
          "battle_wins", 
          1, 
          { 
            battleType: "arena", 
            victory: result.victory
          }
        )
      ]);
      
      return {
        battleId: battle._id,
        result,
        replay: {
          battleId: battle._id,
          playerTeam: battle.playerTeam,
          enemyTeam: battle.enemyTeam,
          actions: battle.actions,
          result: battle.result,
          duration: Date.now() - battle.battleStarted.getTime()
        }
      };

    } catch (error) {
      console.error("❌ Erreur combat d'arène:", error);
      throw error;
    }
  }

  // NOUVEAU: Construit l'équipe du joueur avec leurs sorts
  private static async buildPlayerTeamWithSpells(player: any): Promise<{
    playerTeam: IBattleParticipant[];
    playerSpells: Map<string, HeroSpells>;
  }> {
    const team: IBattleParticipant[] = [];
    const spells = new Map<string, HeroSpells>();
    
    // Récupérer les héros équipés
    const equippedHeroes = player.heroes.filter((hero: any) => hero.equipped);
    
    for (const playerHero of equippedHeroes) {
      let heroData;
      
      // Gérer le cas où populate a fonctionné ou non
      if (typeof playerHero.heroId === 'string') {
        heroData = await Hero.findById(playerHero.heroId);
      } else {
        heroData = playerHero.heroId;
      }
      
      if (!heroData) {
        console.warn(`⚠️ Héros non trouvé: ${playerHero.heroId}`);
        continue;
      }

      // Vérifier que les stats de base existent
      if (!heroData.baseStats || !heroData.baseStats.hp) {
        console.error(`❌ Stats manquantes pour le héros: ${heroData.name}`);
        continue;
      }

      // Calculer les stats de combat avec les nouvelles stats étendues
      const combatStats = this.calculateCombatStats(heroData, playerHero.level, playerHero.stars);
      
      const participant: IBattleParticipant = {
        heroId: (heroData._id as any).toString(),
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

      // NOUVEAU: Extraire les sorts du héros
      const heroSpells = this.extractHeroSpells(heroData);
      spells.set(participant.heroId, heroSpells);
      
      console.log(`⚡ ${heroData.name} équipé avec sorts:`, heroSpells);
    }
    
    return { playerTeam: team, playerSpells: spells };
  }

  // NOUVEAU: Génère une équipe ennemie avec des sorts
  private static async generateEnemyTeamWithSpells(
    worldId: number, 
    levelId: number, 
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<{
    enemyTeam: IBattleParticipant[];
    enemySpells: Map<string, HeroSpells>;
  }> {
    
    // Calculer la puissance des ennemis selon le monde/niveau
    const basePowerMultiplier = 1 + (worldId - 1) * 0.1 + (levelId - 1) * 0.02;
    const difficultyMultiplier = difficulty === "Hard" ? 1.5 : difficulty === "Nightmare" ? 2.5 : 1;
    const finalMultiplier = basePowerMultiplier * difficultyMultiplier;

    // Déterminer le type d'ennemi (normal/elite/boss)
    const enemyType = this.getEnemyType(levelId);
    const enemyCount = enemyType === "boss" ? 1 : enemyType === "elite" ? 2 : 3;

    // Récupérer des héros aléatoires comme base pour les ennemis
    const availableHeroes = await Hero.aggregate([{ $sample: { size: enemyCount } }]);
    
    const enemyTeam: IBattleParticipant[] = [];
    const enemySpells = new Map<string, HeroSpells>();
    
    for (let i = 0; i < availableHeroes.length; i++) {
      const heroData = availableHeroes[i];
      
      // Niveau des ennemis basé sur le monde
      const enemyLevel = Math.min(100, Math.max(1, worldId * 5 + levelId));
      const enemyStars = enemyType === "boss" ? 6 : enemyType === "elite" ? 4 : 2;
      
      // Stats de base multipliées par la difficulté avec les nouvelles stats
      const baseStats = this.calculateCombatStats(heroData, enemyLevel, enemyStars);
      const enhancedStats = {
        hp: Math.floor(baseStats.hp * finalMultiplier),
        maxHp: Math.floor(baseStats.hp * finalMultiplier),
        atk: Math.floor(baseStats.atk * finalMultiplier),
        def: Math.floor(baseStats.def * finalMultiplier),
        defMagique: Math.floor(baseStats.defMagique * finalMultiplier),
        vitesse: Math.floor(baseStats.vitesse * Math.min(2.0, finalMultiplier)), // Vitesse limitée
        intelligence: Math.floor(baseStats.intelligence * finalMultiplier),
        force: Math.floor(baseStats.force * finalMultiplier),
        moral: Math.floor(baseStats.moral * finalMultiplier),
        reductionCooldown: Math.min(50, baseStats.reductionCooldown + (enemyType === "boss" ? 15 : 0)),
        // Nouvelles stats calculées
        magicResistance: Math.floor((baseStats.defMagique + baseStats.intelligence * 0.3) / 10),
        energyGeneration: Math.floor(10 + (baseStats.moral / 8)),
        criticalChance: Math.min(50, Math.floor(5 + baseStats.vitesse / 10)),
        speed: baseStats.vitesse // Pour compatibilité avec BattleEngine
      };
      
      const enemyId = `enemy_${heroData._id}_${i}`;
      const enemy: IBattleParticipant = {
        heroId: enemyId,
        name: `${enemyType === "boss" ? "Boss " : enemyType === "elite" ? "Elite " : ""}${heroData.name}`,
        role: heroData.role,
        element: heroData.element,
        rarity: heroData.rarity,
        level: enemyLevel,
        stars: enemyStars,
        stats: enhancedStats,
        currentHp: enhancedStats.hp,
        energy: enemyType === "boss" ? Math.floor(baseStats.moral / 2) : 0, // Boss commence avec énergie
        status: {
          alive: true,
          buffs: enemyType === "boss" ? ["boss_aura"] : [],
          debuffs: []
        }
      };
      
      enemyTeam.push(enemy);

      // NOUVEAU: Générer des sorts pour l'ennemi basés sur le héros original
      const heroSpells = this.extractHeroSpells(heroData);
      enemySpells.set(enemyId, heroSpells);
    }
    
    return { enemyTeam, enemySpells };
  }

  // NOUVEAU: Extrait les sorts d'un héros depuis sa config
  private static extractHeroSpells(heroData: any): HeroSpells {
    const heroSpells: HeroSpells = {};

    // Récupérer les sorts depuis le modèle Hero
    if (heroData.spells) {
      if (heroData.spells.spell1?.id) {
        heroSpells.spell1 = {
          id: heroData.spells.spell1.id,
          level: heroData.spells.spell1.level || 1
        };
      }
      
      if (heroData.spells.spell2?.id) {
        heroSpells.spell2 = {
          id: heroData.spells.spell2.id,
          level: heroData.spells.spell2.level || 1
        };
      }
      
      if (heroData.spells.spell3?.id) {
        heroSpells.spell3 = {
          id: heroData.spells.spell3.id,
          level: heroData.spells.spell3.level || 1
        };
      }
      
      if (heroData.spells.ultimate?.id) {
        heroSpells.ultimate = {
          id: heroData.spells.ultimate.id,
          level: heroData.spells.ultimate.level || 1
        };
      }
      
      if (heroData.spells.passive?.id) {
        heroSpells.passive = {
          id: heroData.spells.passive.id,
          level: heroData.spells.passive.level || 1
        };
      }
    }

    // Si aucun sort n'est défini, créer des sorts par défaut
    if (!heroSpells.ultimate) {
      heroSpells.ultimate = {
        id: this.getDefaultUltimate(heroData.element, heroData.role),
        level: 1
      };
    }

    return heroSpells;
  }

  // NOUVEAU: Génère un ultimate par défaut selon élément/rôle
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

    // Priorité à l'élément, fallback sur le rôle
    return ultimatesByElement[element] || ultimatesByRole[role] || "basic_ultimate";
  }

  // Calcule les stats de combat étendues d'un héros (inchangé)
  private static calculateCombatStats(heroData: any, level: number, stars: number) {
    // Vérifier que les stats de base existent
    if (!heroData.baseStats) {
      console.error(`❌ baseStats manquant pour ${heroData.name}`);
      throw new Error(`Hero ${heroData.name} missing baseStats`);
    }

    const { 
      hp, atk, def, defMagique, vitesse, intelligence, force, moral, reductionCooldown 
    } = heroData.baseStats;
    
    if (hp === undefined || atk === undefined || def === undefined) {
      console.error(`❌ Stats de base incomplètes pour ${heroData.name}:`, heroData.baseStats);
      throw new Error(`Hero ${heroData.name} has incomplete base stats`);
    }

    // Multiplicateurs d'évolution
    const levelMultiplier = 1 + (level - 1) * 0.08; // Stats principales
    const starMultiplier = 1 + (stars - 1) * 0.15;
    const primaryMultiplier = levelMultiplier * starMultiplier;
    
    // Multiplicateurs réduits pour certaines stats
    const speedMultiplier = 1 + (primaryMultiplier - 1) * 0.4; // Vitesse évolue moins
    const mentalMultiplier = 1 + (primaryMultiplier - 1) * 0.6; // Stats mentales évoluent modérément
    
    // Stats finales calculées
    const finalHp = Math.floor(hp * primaryMultiplier);
    const finalAtk = Math.floor(atk * primaryMultiplier);
    const finalDef = Math.floor(def * primaryMultiplier);
    const finalDefMagique = Math.floor((defMagique || Math.floor(def * 0.8)) * primaryMultiplier);
    const finalVitesse = Math.floor((vitesse || 80) * speedMultiplier);
    const finalIntelligence = Math.floor((intelligence || 70) * primaryMultiplier);
    const finalForce = Math.floor((force || 80) * primaryMultiplier);
    const finalMoral = Math.floor((moral || 60) * mentalMultiplier);
    const finalReductionCooldown = Math.min(50, Math.floor((reductionCooldown || 0) * (1 + (level - 1) * 0.01)));
    
    // Stats dérivées calculées
    const magicResistance = Math.floor((finalDefMagique + finalIntelligence * 0.3) / 10);
    const energyGeneration = Math.floor(10 + (finalMoral / 8)); // Base 10-35 par tour
    const criticalChance = Math.min(50, Math.floor(5 + finalVitesse / 10)); // 5-25% crit
    
    return {
      // Stats principales
      hp: finalHp,
      maxHp: finalHp,
      atk: finalAtk,
      def: finalDef,
      defMagique: finalDefMagique,
      vitesse: finalVitesse,
      intelligence: finalIntelligence,
      force: finalForce,
      moral: finalMoral,
      reductionCooldown: finalReductionCooldown,
      
      // Stats dérivées pour le combat
      magicResistance,
      energyGeneration,
      criticalChance,
      
      // Compatibilité avec l'ancien système
      speed: finalVitesse
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
  public static async getBattleHistory(playerId: string, serverId: string, limit: number = 20) {
    return await Battle.find({ 
      playerId, 
      serverId: serverId,
      status: "completed" 
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("battleType result context createdAt battleDuration");
  }

  // Récupère les statistiques de combat d'un joueur
  public static async getPlayerBattleStats(playerId: string, serverId: string) {
    const stats = await Battle.aggregate([
      { $match: { 
        playerId: playerId, 
        serverId: serverId,
        status: "completed" 
      }},
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
  public static async getBattleReplay(battleId: string, playerId: string, serverId: string) {
    const battle = await Battle.findOne({ 
      _id: battleId, 
      playerId: playerId,
      serverId: serverId
    });
    
    if (!battle) {
      throw new Error("Battle not found");
    }
    
    return {
      battleId: battle._id,
      playerTeam: battle.playerTeam,
      enemyTeam: battle.enemyTeam,
      actions: battle.actions,
      result: battle.result,
      duration: battle.battleEnded ? 
        battle.battleEnded.getTime() - battle.battleStarted.getTime() : 0
    };
  }
}

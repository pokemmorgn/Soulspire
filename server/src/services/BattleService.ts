import Battle, { IBattleParticipant, IBattleResult } from "../models/Battle";
import Player from "../models/Player";
import Hero from "../models/Hero";
import LevelProgress from "../models/LevelProgress";
import Formation from "../models/Formation";
import { BestiaryService } from "./BestiaryService";
import { BattleEngine, IBattleOptions } from "./BattleEngine";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { HeroSpells } from "../gameplay/SpellManager";
import { MonsterService } from "./MonsterService";
import { calculateFormationSynergies } from "../config/FormationBonusConfig";
import { achievementEmitter, AchievementEvent } from '../utils/AchievementEmitter';
export class BattleService {

  public static async startCampaignBattle(
    playerId: string, 
    serverId: string,
    worldId: number, 
    levelId: number, 
    difficulty: "Normal" | "Hard" | "Nightmare" = "Normal",
    battleOptions: IBattleOptions = { mode: "auto", speed: 1 }
  ) {
    try {
      console.log(`🎯 Combat campagne: Monde ${worldId}, Niveau ${levelId}, ${difficulty} (${battleOptions.mode}, x${battleOptions.speed})`);

      const player = await Player.findOne({ 
        _id: playerId, 
        serverId: serverId 
      }).populate("heroes.heroId");
      
      if (!player) {
        throw new Error("Player not found or not on this server");
      }

      battleOptions.playerVipLevel = player.vipLevel || 0;

      const { playerTeam, playerSpells } = await this.buildPlayerTeamWithSpells(player);
      if (playerTeam.length === 0) {
        throw new Error("No equipped heroes found");
      }

      // Mapper la difficulté et les paramètres du niveau
      const { enemyTeam, enemySpells, waveConfigs } = await MonsterService.generateCampaignEnemies(
        worldId,
        levelId,
        difficulty
      );

      // Log si combat multi-vagues
      if (waveConfigs && waveConfigs.length > 1) {
        console.log(`🌊 Combat multi-vagues: ${waveConfigs.length} vagues détectées`);
      }

      const battle = new Battle({
        playerId,
        serverId: serverId,
        battleType: "campaign",
        playerTeam,
        enemyTeam,
        battleOptions,
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
          enemyType: this.determineEnemyType(levelId)
        }
      });

      await battle.save();

      const battleEngine = new BattleEngine(playerTeam, enemyTeam, playerSpells, enemySpells, battleOptions, waveConfigs);
      const result = battleEngine.simulateBattle();

      battle.actions = battleEngine.getActions();
      battle.result = result;
      battle.status = "completed";
      battle.battleEnded = new Date();
      if (battleEngine.isMultiWaveBattle()) {
        battle.waveData = battleEngine.getWaveData();
        console.log(`📊 Données de vague sauvegardées: ${battle.waveData?.completedWaves}/${battle.waveData?.totalWaves} vagues`);
      }
      await battle.save();

      if (result.victory) {
        await this.applyBattleRewards(player, result);
        await this.updatePlayerProgress(player, worldId, levelId, difficulty);

        achievementEmitter.emit(AchievementEvent.BATTLE_WON, {
          playerId,
          serverId,
          value: 1,
          metadata: { 
            battleType: 'campaign', 
            worldId, 
            levelId,
            difficulty 
          }
        });
        
        // Si boss
        if (this.determineEnemyType(levelId) === 'boss') {
          achievementEmitter.emit(AchievementEvent.BOSS_DEFEATED, {
            playerId,
            serverId,
            metadata: { worldId, levelId }
          });
        }
      }

      await LevelProgress.recordAttempt(
        playerId, 
        serverId, 
        worldId, 
        levelId, 
        difficulty, 
        result.victory, 
        result.battleDuration
      );

      // 📖 ENREGISTRER DANS LE BESTIAIRE
      try {
        // Enregistrer chaque monstre combattu
        for (const enemy of enemyTeam) {
          // ✅ FIX: Extraire le vrai monsterId depuis le heroId généré
          // Format du heroId: "MON_red_yeti_elite_1759500867581_b45e6621"
          // On veut récupérer: "MON_red_yeti_elite"
          const heroIdParts = enemy.heroId.split('_');
          
          let monsterId: string;
          
          // Si le heroId contient un timestamp (format: prefix_timestamp_uuid)
          // On enlève les 2 derniers segments (timestamp et uuid)
          if (heroIdParts.length > 3 && !isNaN(Number(heroIdParts[heroIdParts.length - 2]))) {
            // Format détecté: MON_red_yeti_elite_1759500867581_b45e6621
            // On garde tout sauf les 2 derniers segments
            monsterId = heroIdParts.slice(0, -2).join('_');
          } else {
            // Sinon, on utilise le heroId tel quel (ancien format ou format inattendu)
            monsterId = enemy.heroId;
          }
          
          // Calculer les dégâts infligés au monstre
          const damageDealt = enemy.stats.hp - (enemy.currentHp || 0);
          
          // Estimation des dégâts reçus (basé sur l'ATK du monstre et la durée)
          const damageTaken = Math.floor(enemy.stats.atk * 0.5);
          
          await BestiaryService.recordMonsterEncounter(
            playerId,
            serverId,
            monsterId, // ✅ Utiliser le monsterId extrait
            result.victory, // true si monstre vaincu
            damageDealt,
            damageTaken,
            result.victory ? result.battleDuration : undefined
          );
        }
        
        console.log(`📖 Bestiaire mis à jour: ${enemyTeam.length} monstre(s) enregistré(s)`);
      } catch (bestiaryError: any) {
        console.error("⚠️ Erreur enregistrement bestiaire:", bestiaryError);
        // Ne pas faire échouer le combat si le bestiaire a un problème
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
          battleOptions: battle.battleOptions,
          duration: Date.now() - battle.battleStarted.getTime(),
          waveData: battle.waveData  // ✨ NOUVEAU : Inclure les données de vague
        }
      };

    } catch (error) {
      console.error("❌ Erreur lors du combat:", error);
      throw error;
    }
  }

  public static async startArenaBattle(
    playerId: string, 
    serverId: string,
    opponentId: string,
    battleOptions: IBattleOptions = { mode: "auto", speed: 1 }
  ) {
    try {
      console.log(`⚔️ Combat d'arène: ${playerId} vs ${opponentId} (${battleOptions.mode}, x${battleOptions.speed})`);

      const [player, opponent] = await Promise.all([
        Player.findOne({ _id: playerId, serverId: serverId }).populate("heroes.heroId"),
        Player.findOne({ _id: opponentId, serverId: serverId }).populate("heroes.heroId")
      ]);

      if (!player || !opponent) {
        throw new Error("Player or opponent not found on this server");
      }

      battleOptions.playerVipLevel = player.vipLevel || 0;

      const { playerTeam, playerSpells } = await this.buildPlayerTeamWithSpells(player);
      const { playerTeam: enemyTeam, playerSpells: enemySpells } = await this.buildPlayerTeamWithSpells(opponent);

      if (playerTeam.length === 0 || enemyTeam.length === 0) {
        throw new Error("Both players must have equipped heroes");
      }

      const battle = new Battle({
        playerId,
        serverId: serverId,
        battleType: "arena",
        playerTeam,
        enemyTeam,
        battleOptions,
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

      const battleEngine = new BattleEngine(playerTeam, enemyTeam, playerSpells, enemySpells, battleOptions, undefined);
      const result = battleEngine.simulateBattle();

      battle.actions = battleEngine.getActions();
      battle.result = result;
      battle.status = "completed";
      battle.battleEnded = new Date();
      if (battleEngine.isMultiWaveBattle()) {
        battle.waveData = battleEngine.getWaveData();
      }
      await battle.save();

      if (result.victory) {
        const pvpRewards = this.calculatePvPRewards();
        await this.applyBattleRewards(player, { ...result, rewards: pvpRewards });
      }

      await LevelProgress.recordAttempt(
        playerId, 
        serverId, 
        0, 
        0, 
        "Normal", 
        result.victory, 
        result.battleDuration
      );
// 📖 ENREGISTRER DANS LE BESTIAIRE (PvP)
      try {
        for (const enemy of enemyTeam) {
          const monsterId = enemy.heroId;
          const damageDealt = enemy.stats.hp - (enemy.currentHp || 0);
          const damageTaken = Math.floor(enemy.stats.atk * 0.5);
          
          await BestiaryService.recordMonsterEncounter(
            playerId,
            serverId,
            monsterId,
            result.victory,
            damageDealt,
            damageTaken,
            result.victory ? result.battleDuration : undefined
          );
        }
        
        console.log(`📖 Bestiaire PvP mis à jour: ${enemyTeam.length} monstre(s)`);
      } catch (bestiaryError: any) {
        console.error("⚠️ Erreur bestiaire PvP:", bestiaryError);
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
          battleOptions: battle.battleOptions,
          duration: Date.now() - battle.battleStarted.getTime(),
          waveData: battle.waveData  // ✨ NOUVEAU
        }
      };

    } catch (error) {
      console.error("❌ Erreur combat d'arène:", error);
      throw error;
    }
  }

private static async buildPlayerTeamWithSpells(player: any): Promise<{
  playerTeam: IBattleParticipant[];
  playerSpells: Map<string, HeroSpells>;
}> {
  const team: IBattleParticipant[] = [];
  const spells = new Map<string, HeroSpells>();
  
  // ✅ NOUVEAU : Récupérer la formation active
  const activeFormation = await Formation.findOne({
    playerId: player._id,
    serverId: player.serverId,
    isActive: true
  });

// ✅ Fallback : Si pas de formation active, utiliser les héros équipés (ancien système)
if (!activeFormation || activeFormation.slots.length === 0) {
  console.warn(`⚠️ Pas de formation active pour ${player._id}, utilisation des héros équipés`);
  
  const equippedHeroes = player.heroes.filter((hero: any) => hero.equipped);
  
  // ✅ NOUVEAU : Calculer la distribution élémentaire pour les héros équipés
  const elementDistribution: Record<string, number> = {};
  
  for (const playerHero of equippedHeroes) {
    let heroData;
    if (typeof playerHero.heroId === 'string') {
      heroData = await Hero.findById(playerHero.heroId);
    } else {
      heroData = playerHero.heroId;
    }
    
    if (heroData && heroData.element) {
      elementDistribution[heroData.element] = (elementDistribution[heroData.element] || 0) + 1;
    }
  }
  
  // Assigner des positions par défaut (1, 2, 3, 4, 5)
  for (let i = 0; i < equippedHeroes.length; i++) {
    const playerHero = equippedHeroes[i];
    const position = i + 1;
    
    let heroData;
    if (typeof playerHero.heroId === 'string') {
      heroData = await Hero.findById(playerHero.heroId);
    } else {
      heroData = playerHero.heroId;
    }
    
    if (!heroData) {
      console.warn(`⚠️ Héros non trouvé: ${playerHero.heroId}`);
      continue;
    }

    if (!heroData.baseStats || !heroData.baseStats.hp) {
      console.error(`❌ Stats manquantes pour le héros: ${heroData.name}`);
      continue;
    }

    const combatStats = this.calculateCombatStats(heroData, playerHero.level, playerHero.stars);
    
    // ✅ NOUVEAU : Appliquer les bonus de synergie même en fallback
    const bonusedStats = this.applyFormationBonuses(combatStats, elementDistribution, heroData.element);
    
    const participant: IBattleParticipant = {
      heroId: (heroData._id as any).toString(),
      name: heroData.name,
      position, // Position assignée
      role: heroData.role,
      element: heroData.element,
      rarity: heroData.rarity,
      level: playerHero.level,
      stars: playerHero.stars,
      stats: bonusedStats, // ✅ NOUVEAU : Stats avec bonus
      currentHp: bonusedStats.hp, // ✅ NOUVEAU : HP avec bonus
      energy: 0,
      status: {
        alive: true,
        buffs: [],
        debuffs: []
      }
    };
    
    team.push(participant);

    const heroSpells = this.extractHeroSpells(heroData);
    spells.set(participant.heroId, heroSpells);
  }
  
  return { playerTeam: team, playerSpells: spells };
}

// ✅ NOUVEAU : Utiliser la formation active
console.log(`✅ Utilisation formation: "${activeFormation.name}" (${activeFormation.slots.length} héros)`);

// Trier les slots par position (1 -> 5)
const sortedSlots = [...activeFormation.slots].sort((a, b) => a.slot - b.slot);

// ✅ NOUVEAU : Calculer la distribution élémentaire AVANT de créer les participants
const elementDistribution: Record<string, number> = {};

for (const slot of sortedSlots) {
  const playerHero = player.heroes.find((h: any) => 
    h._id?.toString() === slot.heroId
  );
  
  if (!playerHero) continue;
  
  let heroData;
  if (typeof playerHero.heroId === 'string') {
    heroData = await Hero.findById(playerHero.heroId);
  } else {
    heroData = playerHero.heroId;
  }
  
  if (heroData && heroData.element) {
    elementDistribution[heroData.element] = (elementDistribution[heroData.element] || 0) + 1;
  }
}

// ✅ NOUVEAU : Maintenant créer les participants avec les bonus appliqués
for (const slot of sortedSlots) {
  const playerHero = player.heroes.find((h: any) => 
    h._id?.toString() === slot.heroId
  );
  
  if (!playerHero) {
    console.warn(`⚠️ Héros ${slot.heroId} dans formation mais pas dans player.heroes`);
    continue;
  }
  
  let heroData;
  if (typeof playerHero.heroId === 'string') {
    heroData = await Hero.findById(playerHero.heroId);
  } else {
    heroData = playerHero.heroId;
  }
  
  if (!heroData) {
    console.warn(`⚠️ Héros non trouvé: ${playerHero.heroId}`);
    continue;
  }

  if (!heroData.baseStats || !heroData.baseStats.hp) {
    console.error(`❌ Stats manquantes pour le héros: ${heroData.name}`);
    continue;
  }

  const combatStats = this.calculateCombatStats(heroData, playerHero.level, playerHero.stars);
  
  // ✅ NOUVEAU : Appliquer les bonus de synergie
  const bonusedStats = this.applyFormationBonuses(combatStats, elementDistribution, heroData.element);
  
  const participant: IBattleParticipant = {
    heroId: (heroData._id as any).toString(),
    name: heroData.name,
    position: slot.slot, // Position depuis la formation
    role: heroData.role,
    element: heroData.element,
    rarity: heroData.rarity,
    level: playerHero.level,
    stars: playerHero.stars,
    stats: bonusedStats, // ✅ NOUVEAU : Stats avec bonus
    currentHp: bonusedStats.hp, // ✅ NOUVEAU : HP avec bonus
    energy: 0,
    status: {
      alive: true,
      buffs: [],
      debuffs: []
    }
  };
  
  team.push(participant);

  const heroSpells = this.extractHeroSpells(heroData);
  spells.set(participant.heroId, heroSpells);
  
  console.log(`⚡ ${heroData.name} en position ${slot.slot}`);
}
  
  return { playerTeam: team, playerSpells: spells };
}

private static extractHeroSpells(heroData: any): HeroSpells {
  const heroSpells: HeroSpells = {};

  if (heroData.spells) {
    if (heroData.spells.active1?.id) {
      heroSpells.active1 = {
        id: heroData.spells.active1.id,
        level: heroData.spells.active1.level || 1
      };
    }
    
    if (heroData.spells.active2?.id) {
      heroSpells.active2 = {
        id: heroData.spells.active2.id,
        level: heroData.spells.active2.level || 1
      };
    }
    
    if (heroData.spells.active3?.id) {
      heroSpells.active3 = {
        id: heroData.spells.active3.id,
        level: heroData.spells.active3.level || 1
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

    if (!heroSpells.ultimate) {
      heroSpells.ultimate = {
        id: this.getDefaultUltimate(heroData.element, heroData.role),
        level: 1
      };
    }

    return heroSpells;
  }

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

  private static calculateCombatStats(heroData: any, level: number, stars: number) {
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

    const levelMultiplier = 1 + (level - 1) * 0.08;
    const starMultiplier = 1 + (stars - 1) * 0.15;
    const primaryMultiplier = levelMultiplier * starMultiplier;
    
    const speedMultiplier = 1 + (primaryMultiplier - 1) * 0.4;
    const mentalMultiplier = 1 + (primaryMultiplier - 1) * 0.6;
    
    const finalHp = Math.floor(hp * primaryMultiplier);
    const finalAtk = Math.floor(atk * primaryMultiplier);
    const finalDef = Math.floor(def * primaryMultiplier);
    const finalDefMagique = Math.floor((defMagique || Math.floor(def * 0.8)) * primaryMultiplier);
    const finalVitesse = Math.floor((vitesse || 80) * speedMultiplier);
    const finalIntelligence = Math.floor((intelligence || 70) * primaryMultiplier);
    const finalForce = Math.floor((force || 80) * primaryMultiplier);
    const finalMoral = Math.floor((moral || 60) * mentalMultiplier);
    const finalReductionCooldown = Math.min(50, Math.floor((reductionCooldown || 0) * (1 + (level - 1) * 0.01)));
    
    const magicResistance = Math.floor((finalDefMagique + finalIntelligence * 0.3) / 10);
    const energyGeneration = Math.floor(10 + (finalMoral / 8));
    const criticalChance = Math.min(50, Math.floor(5 + finalVitesse / 10));
    
    return {
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
      magicResistance,
      energyGeneration,
      criticalChance,
      speed: finalVitesse
    };
  }

  /**
 * Appliquer les bonus de synergie élémentaire aux stats de combat
 */
private static applyFormationBonuses(
  stats: any,
  elementDistribution: Record<string, number>,
  heroElement: string
): any {
  const count = elementDistribution[heroElement] || 0;
  
  // Pas de bonus si le héros est seul de son élément
  if (count < 2) {
    return stats;
  }
  
  // Importer la fonction depuis la config
  const { getElementBonus } = require("../config/FormationBonusConfig");
  const bonus = getElementBonus(heroElement, count);

  if (bonus.hp > 0 || bonus.atk > 0 || bonus.def > 0) {
    const bonusedStats = {
      hp: Math.floor(stats.hp * (1 + bonus.hp / 100)),
      maxHp: Math.floor(stats.maxHp * (1 + bonus.hp / 100)),
      atk: Math.floor(stats.atk * (1 + bonus.atk / 100)),
      def: Math.floor(stats.def * (1 + bonus.def / 100)),
      defMagique: stats.defMagique,
      vitesse: stats.vitesse,
      intelligence: stats.intelligence,
      force: stats.force,
      moral: stats.moral,
      precision: stats.precision,
      esquive: stats.esquive,
      speed: stats.speed
    };

    console.log(
      `🔥 ${heroElement}: ${count}x = +${bonus.hp}% stats (bonus individuel)`
    );

    return bonusedStats;
  }

  return stats;
}
  
  private static async applyBattleRewards(player: any, result: IBattleResult) {
    player.gold += result.rewards.gold;
    await player.save();
    
    console.log(`💰 Récompenses appliquées: ${result.rewards.gold} or, ${result.rewards.experience} XP`);
  }

  private static async updatePlayerProgress(
    player: any, 
    worldId: number, 
    levelId: number, 
    difficulty: string
  ) {
    if (worldId > player.world || (worldId === player.world && levelId > player.level)) {
      player.world = worldId;
      player.level = levelId;
    }
    
    await player.save();
    
    console.log(`📈 Progression mise à jour: Monde ${player.world}, Niveau ${player.level}`);
  }

  private static calculatePvPRewards() {
    return {
      experience: 50,
      gold: 100,
      items: [],
      fragments: []
    };
  }

  public static async getBattleHistory(playerId: string, serverId: string, limit: number = 20) {
    return await Battle.find({ 
      playerId, 
      serverId: serverId,
      status: "completed" 
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("battleType result context battleOptions createdAt battleDuration");
  }

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

  public static async getBattleReplay(battleId: string, playerId: string, serverId: string, replaySpeed?: 1 | 2 | 3) {
    const battle = await Battle.findOne({ 
      _id: battleId, 
      playerId: playerId,
      serverId: serverId
    });
    
    if (!battle) {
      throw new Error("Battle not found");
    }
    
    const originalDuration = battle.battleEnded ? 
      battle.battleEnded.getTime() - battle.battleStarted.getTime() : 0;
    
    const adjustedDuration = replaySpeed ? 
      Math.floor(originalDuration / replaySpeed) : originalDuration;
    
    return {
      battleId: battle._id,
      playerTeam: battle.playerTeam,
      enemyTeam: battle.enemyTeam,
      actions: battle.actions,
      result: battle.result,
      battleOptions: battle.battleOptions,
      duration: adjustedDuration,
      originalDuration: originalDuration,
      replaySpeed: replaySpeed || 1,
      waveData: battle.waveData  // ✨ NOUVEAU : Inclure les données de vague
    };
  }

  public static async skipBattle(
    playerId: string,
    serverId: string,
    worldId: number,
    levelId: number,
    difficulty: "Normal" | "Hard" | "Nightmare",
    bestTime: number
  ) {
    const progress = await LevelProgress.getOrCreate(playerId, serverId, worldId, levelId, difficulty);
    
    if (!progress.canSkip()) {
      throw new Error(`Skip requires 3+ victories (you have ${progress.victories})`);
    }

    const player = await Player.findOne({ _id: playerId, serverId: serverId });
    if (!player) {
      throw new Error("Player not found");
    }

    const skipRewards = this.calculateSkipRewards(worldId, levelId, difficulty, bestTime);
    
    player.gold += skipRewards.gold;
    await player.save();

    await this.updatePlayerProgress(player, worldId, levelId, difficulty);

    console.log(`⏩ Combat skippé: ${skipRewards.gold} or, ${skipRewards.experience} XP`);

    return {
      victory: true,
      skipped: true,
      rewards: skipRewards,
      message: `Level ${worldId}-${levelId} skipped successfully`,
      basedOnBestTime: bestTime
    };
  }

  public static async quitBattle(
    battleId: string,
    playerId: string,
    serverId: string,
    reason: "quit" | "timeout" | "disconnect" = "quit"
  ) {
    const battle = await Battle.findOne({ 
      _id: battleId, 
      playerId: playerId,
      serverId: serverId
    });
    
    if (!battle) {
      throw new Error("Battle not found");
    }

    if (battle.status === "completed") {
      throw new Error("Battle already completed");
    }

    battle.status = "abandoned";
    battle.battleEnded = new Date();
    
    battle.result = {
      victory: false,
      winnerTeam: "enemy",
      totalTurns: 0,
      battleDuration: Date.now() - battle.battleStarted.getTime(),
      rewards: { experience: 0, gold: 0, items: [], fragments: [] },
      stats: { totalDamageDealt: 0, totalHealingDone: 0, criticalHits: 0, ultimatesUsed: 0 }
    };

    await battle.save();

    if (battle.context?.worldId && battle.context?.levelId && battle.context?.difficulty) {
      await LevelProgress.recordAttempt(
        playerId,
        serverId,
        battle.context.worldId,
        battle.context.levelId,
        battle.context.difficulty,
        false,
        0
      );
    }

    console.log(`🏃 Combat abandonné: ${battleId} (${reason})`);

    return {
      battleId: battle._id,
      quit: true,
      reason: reason,
      message: "Battle abandoned - no rewards given"
    };
  }

  private static calculateSkipRewards(
    worldId: number, 
    levelId: number, 
    difficulty: "Normal" | "Hard" | "Nightmare",
    bestTime: number
  ) {
    const baseExp = 80 + worldId * 8 + levelId * 3;
    const baseGold = 40 + worldId * 5 + levelId * 2;
    
    const difficultyMultiplier = difficulty === "Hard" ? 1.5 : difficulty === "Nightmare" ? 2.0 : 1.0;
    
    const timeBonus = bestTime > 0 && bestTime < 10000 ? 1.2 : 1.0;
    
    const skipBonus = 1.1;
    
    return {
      experience: Math.floor(baseExp * difficultyMultiplier * timeBonus * skipBonus),
      gold: Math.floor(baseGold * difficultyMultiplier * timeBonus * skipBonus),
      items: [],
      fragments: []
    };
  }
  /**
   * Déterminer le type d'ennemi selon le levelId (helper)
   */
  private static determineEnemyType(levelId: number): "normal" | "elite" | "boss" {
    if (levelId % 10 === 0) return "boss";
    if (levelId % 5 === 0) return "elite";
    return "normal";
  }
}

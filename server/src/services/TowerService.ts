import { Types } from 'mongoose';
import Tower, { ITower, ITowerRun } from '../models/Tower';
import Player from '../models/Player';
import { BattleEngine } from './BattleEngine';
import { IPlayer, IHero, BattleResult, BattleReplay } from '../types';

export class TowerService {
  // Configuration des étages de la tour
  private static readonly FLOOR_SCALING = {
    BASE_HP: 1000,
    BASE_ATTACK: 100,
    BASE_DEFENSE: 50,
    HP_SCALING: 1.15,      // +15% HP par étage
    ATTACK_SCALING: 1.12,  // +12% Attack par étage
    DEFENSE_SCALING: 1.10  // +10% Defense par étage
  };

  // Récompenses par étage (tous les 5 étages)
  private static readonly REWARDS_PER_MILESTONE = {
    5: { gold: 1000, gems: 10 },
    10: { gold: 2000, gems: 25 },
    15: { gold: 3000, gems: 40 },
    20: { gold: 5000, gems: 60 },
    25: { gold: 7000, gems: 80 },
    30: { gold: 10000, gems: 100 }
  };

  /**
   * Démarre un nouveau run de tour pour un joueur
   */
  public static async startTowerRun(playerId: Types.ObjectId, serverId: string, teamHeroes: Types.ObjectId[]): Promise<{
    success: boolean;
    message: string;
    towerRun?: ITowerRun;
    error?: string;
  }> {
    try {
      console.log(`🗼 [TowerService] Démarrage run tour - Player: ${playerId}, Server: ${serverId}`);

      // Vérifier le joueur et ses héros
      const player = await Player.findOne({ _id: playerId, serverId }).populate('heroes');
      if (!player) {
        return { success: false, message: 'Joueur introuvable' };
      }

      // Valider l'équipe (exactement 3 héros)
      if (teamHeroes.length !== 3) {
        return { success: false, message: 'Une équipe de 3 héros est requise' };
      }

      // Vérifier que le joueur possède tous les héros
      const playerHeroIds = player.heroes.map(h => h._id.toString());
      const invalidHeroes = teamHeroes.filter(heroId => !playerHeroIds.includes(heroId.toString()));
      
      if (invalidHeroes.length > 0) {
        return { success: false, message: 'Héros non possédés détectés' };
      }

      // Trouver ou créer l'entrée Tower du joueur
      let tower = await Tower.findOne({ playerId, serverId });
      if (!tower) {
        tower = new Tower({
          playerId,
          serverId,
          highestFloor: 0,
          totalRuns: 0,
          bestRunFloors: 0,
          lastRunDate: new Date(),
          weeklyRuns: 0,
          weeklyReset: this.getWeeklyResetDate(),
          runs: []
        });
      }

      // Vérifier limite quotidienne (3 runs par jour)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayRuns = tower.runs.filter(run => {
        const runDate = new Date(run.startTime);
        runDate.setHours(0, 0, 0, 0);
        return runDate.getTime() === today.getTime();
      });

      if (todayRuns.length >= 3) {
        return { success: false, message: 'Limite quotidienne atteinte (3 runs/jour)' };
      }

      // Créer le nouveau run
      const newRun: ITowerRun = {
        runId: new Types.ObjectId(),
        startTime: new Date(),
        endTime: null,
        team: teamHeroes,
        startFloor: 1,
        currentFloor: 1,
        finalFloor: 0,
        isCompleted: false,
        rewards: {
          gold: 0,
          gems: 0,
          items: []
        },
        battles: []
      };

      // Ajouter le run et sauvegarder
      tower.runs.push(newRun);
      tower.totalRuns += 1;
      tower.lastRunDate = new Date();

      await tower.save();

      console.log(`✅ [TowerService] Run créé - RunId: ${newRun.runId}, Floor: ${newRun.currentFloor}`);
      
      return {
        success: true,
        message: 'Run de tour démarré avec succès',
        towerRun: newRun
      };

    } catch (error) {
      console.error('❌ [TowerService] Erreur startTowerRun:', error);
      return {
        success: false,
        message: 'Erreur serveur',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Combat d'un étage de la tour
   */
  public static async fightTowerFloor(playerId: Types.ObjectId, serverId: string, runId: Types.ObjectId): Promise<{
    success: boolean;
    message: string;
    battleResult?: BattleResult;
    floorRewards?: any;
    runCompleted?: boolean;
    error?: string;
  }> {
    try {
      console.log(`⚔️ [TowerService] Combat étage - Player: ${playerId}, RunId: ${runId}`);

      // Trouver la tour et le run
      const tower = await Tower.findOne({ playerId, serverId });
      if (!tower) {
        return { success: false, message: 'Aucune progression de tour trouvée' };
      }

      const currentRun = tower.runs.find(run => run.runId.equals(runId));
      if (!currentRun || currentRun.isCompleted) {
        return { success: false, message: 'Run invalide ou déjà terminé' };
      }

      // Récupérer le joueur et ses héros
      const player = await Player.findOne({ _id: playerId, serverId }).populate('heroes');
      if (!player) {
        return { success: false, message: 'Joueur introuvable' };
      }

      // Construire l'équipe du joueur
      const playerTeam = currentRun.team.map(heroId => {
        const hero = player.heroes.find(h => h._id.equals(heroId));
        if (!hero) throw new Error(`Héros ${heroId} non trouvé`);
        return hero;
      }) as IHero[];

      // Générer l'équipe ennemie pour l'étage actuel
      const enemyTeam = this.generateFloorEnemies(currentRun.currentFloor);

      // Simuler le combat
      const battleResult = await BattleEngine.simulateBattle(
        playerTeam,
        enemyTeam,
        'tower'
      );

      console.log(`🎲 [TowerService] Résultat combat étage ${currentRun.currentFloor}: ${battleResult.winner}`);

      // Enregistrer le combat dans le run
      currentRun.battles.push({
        floor: currentRun.currentFloor,
        enemyTeam: enemyTeam.map(e => e._id),
        result: battleResult.winner,
        replay: battleResult.replay
      });

      let floorRewards = null;
      let runCompleted = false;

      if (battleResult.winner === 'team1') {
        // Victoire - progression
        currentRun.currentFloor += 1;
        
        // Vérifier récompenses d'étape
        const milestone = currentRun.currentFloor - 1; // Étage terminé
        if (this.REWARDS_PER_MILESTONE[milestone]) {
          floorRewards = this.REWARDS_PER_MILESTONE[milestone];
          currentRun.rewards.gold += floorRewards.gold;
          currentRun.rewards.gems += floorRewards.gems;
          
          console.log(`🎁 [TowerService] Récompenses étage ${milestone}:`, floorRewards);
        }

        // Mettre à jour le record personnel
        if (milestone > tower.highestFloor) {
          tower.highestFloor = milestone;
          console.log(`🏆 [TowerService] Nouveau record - Étage ${milestone}`);
        }

      } else {
        // Défaite - fin du run
        currentRun.isCompleted = true;
        currentRun.endTime = new Date();
        currentRun.finalFloor = currentRun.currentFloor - 1; // Dernier étage réussi
        runCompleted = true;

        // Mettre à jour les statistiques
        if (currentRun.finalFloor > tower.bestRunFloors) {
          tower.bestRunFloors = currentRun.finalFloor;
        }

        // Distribuer les récompenses finales au joueur
        if (currentRun.rewards.gold > 0 || currentRun.rewards.gems > 0) {
          await Player.updateOne(
            { _id: playerId, serverId },
            {
              $inc: {
                'currencies.gold': currentRun.rewards.gold,
                'currencies.gems': currentRun.rewards.gems
              }
            }
          );
          
          console.log(`💰 [TowerService] Récompenses distribuées - Or: ${currentRun.rewards.gold}, Gemmes: ${currentRun.rewards.gems}`);
        }
      }

      await tower.save();

      return {
        success: true,
        message: battleResult.winner === 'team1' ? 
          `Victoire étage ${currentRun.currentFloor - 1}` : 
          `Défaite étage ${currentRun.currentFloor}`,
        battleResult,
        floorRewards,
        runCompleted
      };

    } catch (error) {
      console.error('❌ [TowerService] Erreur fightTowerFloor:', error);
      return {
        success: false,
        message: 'Erreur serveur',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Récupère les classements de la tour pour un serveur
   */
  public static async getTowerLeaderboard(serverId: string, limit: number = 50): Promise<{
    success: boolean;
    leaderboard?: Array<{
      rank: number;
      playerId: Types.ObjectId;
      playerName: string;
      highestFloor: number;
      totalRuns: number;
    }>;
    error?: string;
  }> {
    try {
      console.log(`🏅 [TowerService] Récupération classement serveur ${serverId}`);

      const towers = await Tower.find({ serverId })
        .populate({
          path: 'playerId',
          select: 'username',
          model: 'Player'
        })
        .sort({ highestFloor: -1, totalRuns: 1 })
        .limit(limit);

      const leaderboard = towers.map((tower, index) => ({
        rank: index + 1,
        playerId: tower.playerId._id,
        playerName: (tower.playerId as any).username,
        highestFloor: tower.highestFloor,
        totalRuns: tower.totalRuns
      }));

      return {
        success: true,
        leaderboard
      };

    } catch (error) {
      console.error('❌ [TowerService] Erreur getTowerLeaderboard:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Récupère la progression d'un joueur dans la tour
   */
  public static async getPlayerTowerProgress(playerId: Types.ObjectId, serverId: string): Promise<{
    success: boolean;
    tower?: ITower;
    currentRun?: ITowerRun;
    error?: string;
  }> {
    try {
      const tower = await Tower.findOne({ playerId, serverId });
      if (!tower) {
        return { success: true, tower: null };
      }

      // Trouver le run actuel (non terminé)
      const currentRun = tower.runs.find(run => !run.isCompleted);

      return {
        success: true,
        tower,
        currentRun
      };

    } catch (error) {
      console.error('❌ [TowerService] Erreur getPlayerTowerProgress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Génère les ennemis pour un étage donné
   */
  private static generateFloorEnemies(floor: number): IHero[] {
    const scaling = this.FLOOR_SCALING;
    
    // Calculer les stats selon l'étage
    const enemyHP = Math.floor(scaling.BASE_HP * Math.pow(scaling.HP_SCALING, floor - 1));
    const enemyAttack = Math.floor(scaling.BASE_ATTACK * Math.pow(scaling.ATTACK_SCALING, floor - 1));
    const enemyDefense = Math.floor(scaling.BASE_DEFENSE * Math.pow(scaling.DEFENSE_SCALING, floor - 1));

    // Éléments possibles selon l'étage
    const elements = ['Fire', 'Water', 'Electric', 'Wind'];
    if (floor >= 10) elements.push('Light', 'Dark');

    // Générer 3 ennemis avec des éléments différents
    const enemies: IHero[] = [];
    const usedElements = new Set<string>();

    for (let i = 0; i < 3; i++) {
      let element;
      do {
        element = elements[Math.floor(Math.random() * elements.length)];
      } while (usedElements.has(element) && usedElements.size < elements.length);
      
      usedElements.add(element);

      enemies.push({
        _id: new Types.ObjectId(),
        heroId: `tower_enemy_${floor}_${i + 1}`,
        name: `Tour Guardian ${floor}-${i + 1}`,
        element,
        rarity: floor >= 20 ? 'Legendary' : floor >= 10 ? 'Epic' : 'Rare',
        level: Math.min(Math.floor(floor / 2) + 1, 50),
        stars: Math.min(Math.floor(floor / 10) + 1, 6),
        stats: {
          hp: enemyHP,
          attack: enemyAttack,
          defense: enemyDefense,
          speed: 80 + Math.floor(floor * 0.5),
          critRate: Math.min(5 + Math.floor(floor * 0.2), 25),
          critDamage: 150 + Math.floor(floor * 0.3)
        },
        skills: {
          basic: {
            name: 'Tower Strike',
            description: 'Attaque basique',
            damage: 100,
            energyCost: 0,
            effects: []
          },
          ultimate: {
            name: 'Guardian Wrath',
            description: 'Attaque ultime puissante',
            damage: 200 + Math.floor(floor * 2),
            energyCost: 100,
            effects: []
          }
        },
        equipment: null,
        appearance: {
          sprite: 'tower_guardian',
          color: element.toLowerCase()
        },
        personality: {
          description: 'Gardien mystique de la tour',
          voiceLines: [`Étage ${floor}... Prouve ta valeur !`]
        },
        obtainMethods: ['tower']
      } as IHero);
    }

    console.log(`👹 [TowerService] Ennemis générés étage ${floor} - HP: ${enemyHP}, ATK: ${enemyAttack}, DEF: ${enemyDefense}`);
    return enemies;
  }

  /**
   * Calcule la date de reset hebdomadaire (lundi 00h00 UTC)
   */
  private static getWeeklyResetDate(): Date {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = dimanche, 1 = lundi
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    
    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
    nextMonday.setUTCHours(0, 0, 0, 0);
    
    return nextMonday;
  }
}

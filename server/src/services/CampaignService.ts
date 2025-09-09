import CampaignWorld, { ICampaignWorld, ILevelConfig, Elem } from "../models/CampaignWorld";
import CampaignProgress, { ICampaignProgress, ILevelStar } from "../models/CampaignProgress";
import Player from "../models/Player";
import { BattleService } from "./BattleService";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { WebSocketService } from "./WebSocketService";

export class CampaignService {

  // === RÉCUPÉRER TOUS LES MONDES DE LA CAMPAGNE ===
  public static async getAllWorlds() {
    try {
      console.log("🗺️ Récupération de tous les mondes de campagne");

      const worlds = await CampaignWorld.find({})
        .sort({ worldId: 1 })
        .select("worldId name description mapTheme levelCount minPlayerLevel recommendedPower elementBias");

      return {
        success: true,
        worlds: worlds.map(world => ({
          worldId: world.worldId,
          name: world.name,
          description: world.description,
          mapTheme: world.mapTheme,
          levelCount: world.levelCount,
          minPlayerLevel: world.minPlayerLevel,
          recommendedPower: world.recommendedPower,
          elementBias: world.elementBias,
          isLocked: false // Sera calculé dans getPlayerCampaignData
        })),
        totalWorlds: worlds.length
      };

    } catch (error: any) {
      console.error("❌ Erreur getAllWorlds:", error);
      throw error;
    }
  }

  // === RÉCUPÉRER LES DONNÉES DE CAMPAGNE POUR UN JOUEUR ===
  public static async getPlayerCampaignData(playerId: string, serverId: string) {
    try {
      console.log(`🎯 Récupération données campagne pour ${playerId} sur serveur ${serverId}`);

      // Récupérer le joueur
      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found on this server");
      }

      // Récupérer tous les mondes
      const worlds = await CampaignWorld.find({}).sort({ worldId: 1 });
      
      // Récupérer la progression du joueur pour tous les mondes
      const playerProgress = await CampaignProgress.find({ 
        playerId, 
        serverId 
      });

      // Construire les données enrichies
      const campaignData = worlds.map(world => {
        const worldProgress = playerProgress.find(p => p.worldId === world.worldId);
        
        // Déterminer si le monde est débloqué (basé sur le niveau joueur seulement)
        const isUnlocked = player.level >= world.minPlayerLevel;
        
        // Calculer les statistiques du monde
        const totalStars = worldProgress ? 
          worldProgress.starsByLevel.reduce((sum, level) => sum + level.stars, 0) : 0;
        const maxStars = world.levelCount * 3; // 3 étoiles max par niveau
        
        return {
          worldId: world.worldId,
          name: world.name,
          description: world.description,
          mapTheme: world.mapTheme,
          levelCount: world.levelCount,
          minPlayerLevel: world.minPlayerLevel,
          recommendedPower: world.recommendedPower,
          elementBias: world.elementBias,
          
          // Progression du joueur
          isUnlocked,
          highestLevelCleared: worldProgress?.highestLevelCleared || 0,
          totalStars,
          maxStars,
          starProgress: maxStars > 0 ? Math.round((totalStars / maxStars) * 100) : 0,
          
          // Niveau suivant disponible
          nextLevelAvailable: isUnlocked ? 
            Math.min(world.levelCount, (worldProgress?.highestLevelCleared || 0) + 1) : null,
          
          // Récompenses disponibles à récupérer
          hasUnclaimedRewards: false // TODO: Implémenter système de récompenses par étoiles
        };
      });

      // Statistiques globales du joueur
      const globalStats = {
        totalWorlds: worlds.length,
        unlockedWorlds: campaignData.filter(w => w.isUnlocked).length,
        totalStarsEarned: campaignData.reduce((sum, w) => sum + w.totalStars, 0),
        totalStarsAvailable: campaignData.reduce((sum, w) => sum + w.maxStars, 0),
        currentWorld: this.getCurrentWorld(campaignData),
        nextUnlock: this.getNextUnlock(worlds, player.level)
      };

      return {
        success: true,
        playerLevel: player.level,
        campaignData,
        globalStats
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerCampaignData:", error);
      throw error;
    }
  }

  // === RÉCUPÉRER LES DÉTAILS D'UN MONDE SPÉCIFIQUE ===
  public static async getWorldDetails(
    worldId: number, 
    playerId: string, 
    serverId: string
  ) {
    try {
      console.log(`🏰 Récupération détails monde ${worldId} pour ${playerId}`);

      // Récupérer le monde
      const world = await CampaignWorld.findOne({ worldId });
      if (!world) {
        throw new Error("World not found");
      }

      // Récupérer le joueur et sa progression
      const [player, worldProgress] = await Promise.all([
        Player.findOne({ _id: playerId, serverId }),
        CampaignProgress.findOne({ playerId, serverId, worldId })
      ]);

      if (!player) {
        throw new Error("Player not found on this server");
      }

      // Vérifier si le monde est débloqué (seulement niveau joueur)
      const isUnlocked = player.level >= world.minPlayerLevel;

      if (!isUnlocked) {
        return {
          success: false,
          message: "World is locked",
          requirements: {
            minPlayerLevel: world.minPlayerLevel,
            currentPlayerLevel: player.level
          }
        };
      }

      // Récupérer les difficultés disponibles pour ce joueur
      const availableDifficulties = await this.getAvailableDifficulties(playerId, serverId);

      // Enrichir les niveaux avec la progression
      const enrichedLevels = world.levels.map(level => {
        const levelStar = worldProgress?.starsByLevel.find(s => s.levelIndex === level.levelIndex);
        const isCleared = levelStar ? levelStar.stars > 0 : false;
        const isAvailable = level.levelIndex === 1 || 
          (worldProgress?.highestLevelCleared || 0) >= level.levelIndex - 1;

        return {
          levelIndex: level.levelIndex,
          name: level.name,
          enemyType: level.enemyType || this.determineEnemyType(level.levelIndex),
          enemyCount: level.enemyCount || this.determineEnemyCount(level.enemyType || this.determineEnemyType(level.levelIndex)),
          difficultyMultiplier: level.difficultyMultiplier || (1 + (level.levelIndex - 1) * 0.06),
          staminaCost: level.staminaCost || 6,
          rewards: level.rewards || this.generateDefaultRewards(worldId, level.levelIndex),
          modifiers: level.modifiers,
          
          // Progression du joueur
          isAvailable,
          isCleared,
          stars: levelStar?.stars || 0,
          bestTime: levelStar?.bestTimeMs || null,
          
          // Difficultés disponibles (identiques pour tous les niveaux)
          availableDifficulties
        };
      });

      return {
        success: true,
        world: {
          worldId: world.worldId,
          name: world.name,
          description: world.description,
          mapTheme: world.mapTheme,
          levelCount: world.levelCount,
          minPlayerLevel: world.minPlayerLevel,
          recommendedPower: world.recommendedPower,
          elementBias: world.elementBias,
          levels: enrichedLevels
        },
        playerProgress: {
          highestLevelCleared: worldProgress?.highestLevelCleared || 0,
          totalStars: worldProgress?.starsByLevel.reduce((sum, s) => sum + s.stars, 0) || 0,
          maxStars: world.levelCount * 3
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getWorldDetails:", error);
      throw error;
    }
  }

  // === DÉMARRER UN COMBAT DE CAMPAGNE ===
  public static async startCampaignBattle(
    playerId: string,
    serverId: string,
    worldId: number,
    levelIndex: number,
    difficulty: "Normal" | "Hard" | "Nightmare" = "Normal"
  ) {
    try {
      console.log(`⚔️ Combat campagne: Monde ${worldId}, Niveau ${levelIndex}, ${difficulty}`);

      // Récupérer le monde et le niveau
      const world = await CampaignWorld.findOne({ worldId });
      if (!world) {
        throw new Error("World not found");
      }

      const levelConfig = world.levels.find(l => l.levelIndex === levelIndex);
      if (!levelConfig) {
        throw new Error("Level not found");
      }

      // Vérifier les permissions du joueur
      const canPlay = await this.canPlayerPlayLevel(playerId, serverId, worldId, levelIndex, difficulty);
      if (!canPlay.allowed) {
        throw new Error(canPlay.reason);
      }

      // 🔥 NOTIFICATION WEBSOCKET : Combat démarré
      try {
        WebSocketService.notifyCampaignBattleStarted(playerId, {
          worldId,
          levelIndex,
          difficulty,
          worldName: world.name,
          levelName: levelConfig.name,
          enemyType: levelConfig.enemyType || this.determineEnemyType(levelIndex),
          estimatedDuration: 30000, // 30s estimé
          staminaCost: levelConfig.staminaCost || 6
        });
      } catch (wsError) {
        console.error('❌ Erreur notification battle started:', wsError);
      }

      // Démarrer le combat via BattleService
      const battleResult = await BattleService.startCampaignBattle(
        playerId,
        serverId,
        worldId,
        levelIndex,
        difficulty
      );

      // Variables pour les notifications
      let newLevelUnlocked = false;
      let newWorldUnlocked = false;
      let playerLevelUp = false;
      let newPlayerLevel = undefined;

      // Si victoire, mettre à jour la progression
      if (battleResult.result.victory) {
        const progressResult = await this.updatePlayerProgress(
          playerId,
          serverId,
          worldId,
          levelIndex,
          difficulty,
          battleResult.result
        );

        newLevelUnlocked = progressResult.newLevelUnlocked;
        newWorldUnlocked = progressResult.newWorldUnlocked;
        playerLevelUp = progressResult.playerLevelUp;
        newPlayerLevel = progressResult.newPlayerLevel;

        // Calculer les étoiles obtenues
        const starsEarned = this.calculateStarsEarned(battleResult.result, difficulty);

        // 🔥 NOTIFICATION WEBSOCKET : Combat terminé avec résultat complet
        try {
          WebSocketService.notifyCampaignBattleCompleted(playerId, {
            worldId,
            levelIndex,
            difficulty,
            victory: true,
            starsEarned,
            rewards: levelConfig.rewards || this.generateDefaultRewards(worldId, levelIndex),
            battleStats: {
              duration: battleResult.result.battleDuration || 30000,
              totalTurns: battleResult.result.totalTurns || 5,
              damageDealt: battleResult.result.stats?.totalDamageDealt || 1000,
              criticalHits: battleResult.result.stats?.criticalHits || 2
            },
            progression: {
              newLevelUnlocked,
              newWorldUnlocked,
              playerLevelUp,
              newPlayerLevel
            }
          });

          // Notifications spécialisées selon le contexte
          if (newLevelUnlocked) {
            const nextLevel = world.levels.find(l => l.levelIndex === levelIndex + 1);
            if (nextLevel) {
              WebSocketService.notifyCampaignLevelUnlocked(playerId, {
                worldId,
                levelIndex: levelIndex + 1,
                worldName: world.name,
                levelName: nextLevel.name,
                difficulty: "Normal",
                rewards: nextLevel.rewards || this.generateDefaultRewards(worldId, levelIndex + 1),
                isLastLevel: levelIndex + 1 === world.levelCount
              });
            }
          }

          if (newWorldUnlocked && newPlayerLevel) {
            const nextWorld = await CampaignWorld.findOne({ 
              minPlayerLevel: { $lte: newPlayerLevel },
              worldId: { $gt: worldId }
            }).sort({ worldId: 1 });

            if (nextWorld) {
              WebSocketService.notifyCampaignWorldUnlocked(playerId, {
                worldId: nextWorld.worldId,
                worldName: nextWorld.name,
                description: nextWorld.description,
                mapTheme: nextWorld.mapTheme,
                levelCount: nextWorld.levelCount,
                recommendedPower: nextWorld.recommendedPower,
                elementBias: nextWorld.elementBias,
                unlockedBy: {
                  playerLevel: newPlayerLevel,
                  previousWorld: worldId
                }
              });
            }
          }

          // Notification premier passage
          const isFirstClear = await this.isFirstClear(playerId, serverId, worldId, levelIndex, difficulty);
          if (isFirstClear) {
            WebSocketService.notifyCampaignFirstClearRewards(playerId, {
              worldId,
              levelIndex,
              difficulty,
              rewards: levelConfig.rewards || this.generateDefaultRewards(worldId, levelIndex),
              bonusRewards: starsEarned === 3 ? ["Perfect Clear Bonus"] : [],
              isSpecialLevel: levelIndex % 10 === 0 // Boss levels
            });
          }

          // Notification 3 étoiles parfaites
          if (starsEarned === 3) {
            const perfectCount = await this.getPerfectClearCount(playerId, serverId, worldId);
            WebSocketService.notifyCampaignPerfectClearRewards(playerId, {
              worldId,
              levelIndex,
              difficulty,
              perfectRewards: { gems: 10, bonus_materials: 5 },
              perfectCount,
              totalLevels: world.levelCount
            });
          }

        } catch (wsError) {
          console.error('❌ Erreur notifications battle completed:', wsError);
        }

        // Mettre à jour les missions et événements
        await Promise.all([
          MissionService.updateProgress(
            playerId,
            serverId,
            "battle_wins",
            1,
            {
              battleType: "campaign",
              victory: true,
              difficulty,
              world: worldId,
              level: levelIndex
            }
          ),
          EventService.updatePlayerProgress(
            playerId,
            serverId,
            "battle_wins",
            1,
            {
              battleType: "campaign",
              victory: true,
              difficulty,
              world: worldId,
              level: levelIndex
            }
          )
        ]);

      } else {
        // 🔥 NOTIFICATION WEBSOCKET : Défaite
        try {
          WebSocketService.notifyCampaignBattleCompleted(playerId, {
            worldId,
            levelIndex,
            difficulty,
            victory: false,
            starsEarned: 0,
            rewards: { experience: 0, gold: 0, items: [], fragments: [] },
            battleStats: {
              duration: battleResult.result.battleDuration || 30000,
              totalTurns: battleResult.result.totalTurns || 3,
              damageDealt: battleResult.result.stats?.totalDamageDealt || 500,
              criticalHits: battleResult.result.stats?.criticalHits || 0
            },
            progression: {
              newLevelUnlocked: false,
              newWorldUnlocked: false,
              playerLevelUp: false
            }
          });

          // Vérifier si le joueur a beaucoup d'échecs et suggérer des améliorations
          await this.checkForProgressBlocking(playerId, serverId, worldId, levelIndex, difficulty);

        } catch (wsError) {
          console.error('❌ Erreur notification defeat:', wsError);
        }
      }

      return {
        success: true,
        battleResult,
        worldId,
        levelIndex,
        difficulty
      };

    } catch (error: any) {
      console.error("❌ Erreur startCampaignBattle:", error);
      throw error;
    }
  }

  // === VÉRIFIER SI UN JOUEUR PEUT JOUER UN NIVEAU (NOUVELLE LOGIQUE) ===
  public static async canPlayerPlayLevel(
    playerId: string,
    serverId: string,
    worldId: number,
    levelIndex: number,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<{ allowed: boolean; reason?: string }> {
    
    try {
      // Récupérer le joueur et le monde
      const [player, world] = await Promise.all([
        Player.findOne({ _id: playerId, serverId }),
        CampaignWorld.findOne({ worldId })
      ]);

      if (!player) {
        return { allowed: false, reason: "Player not found" };
      }

      if (!world) {
        return { allowed: false, reason: "World not found" };
      }

      // Vérifier le niveau du joueur pour débloquer le monde
      if (player.level < world.minPlayerLevel) {
        return {
          allowed: false,
          reason: `Player level ${player.level} is too low. Required: ${world.minPlayerLevel}`
        };
      }

      // Vérifier que le niveau existe
      if (levelIndex < 1 || levelIndex > world.levelCount) {
        return {
          allowed: false,
          reason: `Level ${levelIndex} does not exist in world ${worldId}`
        };
      }

      // === NOUVELLE LOGIQUE DE DIFFICULTÉ ===
      
      // Pour Normal: progression séquentielle dans le monde
      if (difficulty === "Normal") {
        if (levelIndex > 1) {
          const worldProgress = await CampaignProgress.findOne({ playerId, serverId, worldId });
          const highestCleared = worldProgress?.highestLevelCleared || 0;
          if (levelIndex > highestCleared + 1) {
            return {
              allowed: false,
              reason: `Level ${levelIndex} is locked. Clear level ${highestCleared + 1} first`
            };
          }
        }
        return { allowed: true };
      }

      // Pour Hard: doit avoir terminé TOUTE la campagne en Normal
      if (difficulty === "Hard") {
        const hasCompletedCampaignNormal = await this.hasPlayerCompletedCampaign(playerId, serverId, "Normal");
        if (!hasCompletedCampaignNormal) {
          return {
            allowed: false,
            reason: "Must complete the entire campaign on Normal difficulty to unlock Hard mode"
          };
        }

        // ✅ CHANGEMENT: Peut jouer n'importe quel monde débloqué en Hard
        // Vérifier seulement la progression séquentielle dans ce monde en Hard
        if (levelIndex > 1) {
          const highestClearedHard = await this.getHighestClearedLevel(playerId, serverId, worldId, "Hard");
          if (levelIndex > highestClearedHard + 1) {
            return {
              allowed: false,
              reason: `Level ${levelIndex} (Hard) is locked. Clear level ${highestClearedHard + 1} on Hard first`
            };
          }
        }
        return { allowed: true };
      }

      // Pour Nightmare: doit avoir terminé TOUTE la campagne en Hard
      if (difficulty === "Nightmare") {
        const hasCompletedCampaignHard = await this.hasPlayerCompletedCampaign(playerId, serverId, "Hard");
        if (!hasCompletedCampaignHard) {
          return {
            allowed: false,
            reason: "Must complete the entire campaign on Hard difficulty to unlock Nightmare mode"
          };
        }

        // ✅ CHANGEMENT: Peut jouer n'importe quel monde débloqué en Nightmare
        // Vérifier seulement la progression séquentielle dans ce monde en Nightmare
        if (levelIndex > 1) {
          const highestClearedNightmare = await this.getHighestClearedLevel(playerId, serverId, worldId, "Nightmare");
          if (levelIndex > highestClearedNightmare + 1) {
            return {
              allowed: false,
              reason: `Level ${levelIndex} (Nightmare) is locked. Clear level ${highestClearedNightmare + 1} on Nightmare first`
            };
          }
        }
        return { allowed: true };
      }

      return { allowed: true };

    } catch (error: any) {
      console.error("❌ Erreur canPlayerPlayLevel:", error);
      return { allowed: false, reason: "Server error" };
    }
  }

  // === METTRE À JOUR LA PROGRESSION DU JOUEUR (utilise le nouveau modèle) ===
  private static async updatePlayerProgress(
    playerId: string,
    serverId: string,
    worldId: number,
    levelIndex: number,
    difficulty: string,
    battleResult: any
  ): Promise<{
    newLevelUnlocked: boolean;
    newWorldUnlocked: boolean;
    playerLevelUp: boolean;
    newPlayerLevel?: number;
  }> {
    try {
      // Récupérer le monde pour avoir levelCount
      const world = await CampaignWorld.findOne({ worldId });
      if (!world) {
        console.error(`Monde ${worldId} non trouvé`);
        return { newLevelUnlocked: false, newWorldUnlocked: false, playerLevelUp: false };
      }

      // Récupérer ou créer la progression du monde
      let worldProgress = await CampaignProgress.findOne({ playerId, serverId, worldId });
      
      if (!worldProgress) {
        worldProgress = new CampaignProgress({
          playerId,
          serverId,
          worldId,
          highestLevelCleared: 0,
          starsByLevel: [],
          progressByDifficulty: [
            { 
              difficulty: "Normal", 
              highestLevelCleared: 0, 
              starsByLevel: [], 
              isCompleted: false 
            }
          ],
          totalStarsEarned: 0,
          totalTimeSpent: 0
        });
      }

      // Calculer les étoiles obtenues
      const starsEarned = this.calculateStarsEarned(battleResult, difficulty);
      
      // Déterminer si un nouveau niveau sera débloqué
      const newLevelUnlocked = (difficulty === "Normal") && (levelIndex === (worldProgress.highestLevelCleared || 0) + 1) && (levelIndex < world.levelCount);
      
      // Mettre à jour la progression via la méthode du modèle
      (worldProgress as any).updateDifficultyProgress(
        difficulty as "Normal" | "Hard" | "Nightmare",
        levelIndex,
        starsEarned,
        battleResult.battleDuration,
        world.levelCount
      );

      // Mettre à jour le temps total passé
      (worldProgress as any).totalTimeSpent += battleResult.battleDuration;

      await worldProgress.save();
      
      // Variables de retour
      let newWorldUnlocked = false;
      let playerLevelUp = false;
      let newPlayerLevel = undefined;
      
      // Mettre à jour le niveau/monde du joueur SEULEMENT si c'est une progression en Normal
      if (difficulty === "Normal") {
        const player = await Player.findOne({ _id: playerId, serverId });
        if (player) {
          // ✅ CHANGEMENT: Mettre à jour le niveau joueur basé sur la progression Normal
          const calculatedPlayerLevel = Math.max(player.level, (worldId - 1) * 10 + levelIndex + 5);
          if (calculatedPlayerLevel > player.level) {
            const oldLevel = player.level;
            player.level = calculatedPlayerLevel;
            player.world = worldId;
            await player.save();
            
            playerLevelUp = true;
            newPlayerLevel = calculatedPlayerLevel;
            
            // Vérifier si de nouveaux mondes sont débloqués
            const nextWorld = await CampaignWorld.findOne({ 
              minPlayerLevel: { $lte: calculatedPlayerLevel, $gt: oldLevel }
            });
            if (nextWorld) {
              newWorldUnlocked = true;
            }
          }
        }
      }

      console.log(`📈 Progression mise à jour: Monde ${worldId}, Niveau ${levelIndex}, ${difficulty}, ${starsEarned} étoiles`);

      return {
        newLevelUnlocked,
        newWorldUnlocked,
        playerLevelUp,
        newPlayerLevel
      };

    } catch (error) {
      console.error("❌ Erreur updatePlayerProgress:", error);
      // Ne pas faire échouer le combat
      return { newLevelUnlocked: false, newWorldUnlocked: false, playerLevelUp: false };
    }
  }

  // === NOUVELLES MÉTHODES POUR WEBSOCKET ===

  // Vérifier si c'est un premier passage
  private static async isFirstClear(
    playerId: string,
    serverId: string,
    worldId: number,
    levelIndex: number,
    difficulty: string
  ): Promise<boolean> {
    try {
      const worldProgress = await CampaignProgress.findOne({ playerId, serverId, worldId });
      if (!worldProgress) return true;

      if (difficulty === "Normal") {
        const levelStar = worldProgress.starsByLevel.find(s => s.levelIndex === levelIndex);
        return !levelStar || levelStar.stars === 0;
      }

      // Pour Hard/Nightmare, utiliser le nouveau système
      const diffProgress = worldProgress.progressByDifficulty?.find(p => p.difficulty === difficulty);
      if (!diffProgress) return true;

      const levelStar = diffProgress.starsByLevel.find(s => s.levelIndex === levelIndex);
      return !levelStar || levelStar.stars === 0;

    } catch (error) {
      console.error("Erreur isFirstClear:", error);
      return true;
    }
  }

  // Obtenir le nombre de clears parfaits dans un monde
  private static async getPerfectClearCount(
    playerId: string,
    serverId: string,
    worldId: number
  ): Promise<number> {
    try {
      const worldProgress = await CampaignProgress.findOne({ playerId, serverId, worldId });
      if (!worldProgress) return 0;

      return worldProgress.starsByLevel.filter(s => s.stars === 3).length;

    } catch (error) {
      console.error("Erreur getPerfectClearCount:", error);
      return 0;
    }
  }

  // Vérifier si le joueur est bloqué et suggérer des améliorations
  private static async checkForProgressBlocking(
    playerId: string,
    serverId: string,
    worldId: number,
    levelIndex: number,
    difficulty: string
  ): Promise<void> {
    try {
      // Cette logique pourrait être plus sophistiquée en trackant les échecs
      // Pour l'instant, c'est une implémentation simple
      
      // Simuler détection de blocage (en production, vous pourriez tracker les échecs)
      const recentFailures = Math.floor(Math.random() * 5) + 1; // 1-5 échecs simulés
      
      if (recentFailures >= 3) {
        WebSocketService.notifyCampaignProgressBlocked(playerId, {
          worldId,
          levelIndex,
          difficulty,
          failureCount: recentFailures,
          blockedTime: recentFailures * 300000, // 5min par échec
          suggestions: [
            {
              type: 'level_heroes',
              description: 'Level up your heroes to increase combat power',
              cost: 5000,
              effectiveness: 85
            },
            {
              type: 'upgrade_equipment',
              description: 'Upgrade weapons and armor for better stats',
              cost: 10000,
              effectiveness: 75
            },
            {
              type: 'change_formation',
              description: 'Try a different team formation strategy',
              effectiveness: 60
            }
          ],
          canAutoResolve: false
        });
      }

    } catch (error) {
      console.error("Erreur checkForProgressBlocking:", error);
    }
  }

  // === MÉTHODES UTILITAIRES PRIVÉES ===

  // Déterminer le type d'ennemi par défaut
  private static determineEnemyType(levelIndex: number): "normal" | "elite" | "boss" {
    if (levelIndex % 10 === 0) return "boss";      // Niveaux 10, 20, 30 = boss
    if (levelIndex % 5 === 0) return "elite";      // Niveaux 5, 15, 25 = elite
    return "normal";
  }

  // Déterminer le nombre d'ennemis
  private static determineEnemyCount(enemyType: "normal" | "elite" | "boss"): number {
    switch (enemyType) {
      case "boss": return 1;
      case "elite": return 2;
      case "normal": return 3;
      default: return 3;
    }
  }

  // Générer les récompenses par défaut
  private static generateDefaultRewards(worldId: number, levelIndex: number) {
    const baseExp = 30 + (worldId - 1) * 10 + levelIndex * 2;
    const baseGold = 20 + (worldId - 1) * 5 + levelIndex * 1;
    
    return {
      experience: baseExp,
      gold: baseGold,
      items: [],
      fragments: []
    };
  }

  // ✅ NOUVELLE MÉTHODE: Obtenir les difficultés disponibles pour un joueur
  private static async getAvailableDifficulties(
    playerId: string,
    serverId: string
  ): Promise<("Normal" | "Hard" | "Nightmare")[]> {
    
    const difficulties: ("Normal" | "Hard" | "Nightmare")[] = ["Normal"];
    
    try {
      // Vérifier si le joueur a complété toute la campagne en Normal
      const hasCompletedNormal = await this.hasPlayerCompletedCampaign(playerId, serverId, "Normal");
      if (hasCompletedNormal) {
        difficulties.push("Hard");
      }
      
      // Vérifier si le joueur a complété toute la campagne en Hard
      const hasCompletedHard = await this.hasPlayerCompletedCampaign(playerId, serverId, "Hard");
      if (hasCompletedHard) {
        difficulties.push("Nightmare");
      }
      
    } catch (error) {
      console.error("Erreur getAvailableDifficulties:", error);
      // En cas d'erreur, retourner au moins Normal
    }
    
    return difficulties;
  }

  // === MÉTHODES PUBLIQUES POUR LES ROUTES ===
  
  // Vérifier si un joueur a terminé toute la campagne sur une difficulté (PUBLIC)
  public static async hasPlayerCompletedCampaign(
    playerId: string,
    serverId: string,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<boolean> {
    try {
      // Récupérer le nombre total de mondes
      const totalWorlds = await CampaignWorld.countDocuments({});
      if (totalWorlds === 0) return false;

      // Utiliser la méthode statique du modèle pour vérifier la complétion
      return await (CampaignProgress as any).hasPlayerCompletedAllWorlds(
        playerId, 
        serverId, 
        difficulty, 
        totalWorlds
      );

    } catch (error) {
      console.error("Erreur hasPlayerCompletedCampaign:", error);
      return false;
    }
  }

  // === MÉTHODES PRIVÉES POUR LA LOGIQUE INTERNE ===

  // Obtenir le plus haut niveau terminé sur une difficulté spécifique (utilise le nouveau modèle)
  private static async getHighestClearedLevel(
    playerId: string,
    serverId: string,
    worldId: number,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<number> {
    try {
      const worldProgress = await CampaignProgress.findOne({ playerId, serverId, worldId });
      
      if (!worldProgress) return 0;
      
      if (difficulty === "Normal") {
        return worldProgress.highestLevelCleared;
      }
      
      // Utiliser le nouveau système pour Hard/Nightmare
      return (worldProgress as any).getHighestLevelForDifficulty(difficulty);
      
    } catch (error) {
      console.error("Erreur getHighestClearedLevel:", error);
      return 0;
    }
  }

  // Calculer les étoiles obtenues
  private static calculateStarsEarned(battleResult: any, difficulty: string): number {
    let stars = 1; // Base: victoire = 1 étoile
    
    // Étoile bonus basée sur la performance
    if (battleResult.totalTurns <= 10) stars++; // Combat rapide
    if (battleResult.stats.criticalHits >= 3) stars++; // Beaucoup de critiques
    
    // Malus si trop long
    if (battleResult.totalTurns > 30) stars = Math.max(1, stars - 1);
    
    // Bonus difficulté
    if (difficulty === "Hard") stars = Math.min(3, stars + 1);
    if (difficulty === "Nightmare") stars = 3; // Nightmare donne toujours 3 étoiles
    
    return Math.max(1, Math.min(3, stars));
  }

  // Obtenir le monde actuel du joueur
  private static getCurrentWorld(campaignData: any[]): any {
    return campaignData.find(w => w.isUnlocked && w.highestLevelCleared < w.levelCount) || 
           campaignData[campaignData.length - 1];
  }

  // Obtenir le prochain déblocage
  private static getNextUnlock(worlds: ICampaignWorld[], playerLevel: number): any {
    for (const world of worlds) {
      if (playerLevel < world.minPlayerLevel) {
        return {
          worldId: world.worldId,
          name: world.name,
          requiredLevel: world.minPlayerLevel,
          levelsToGo: world.minPlayerLevel - playerLevel
        };
      }
    }
    return null;
  }

  // === MÉTHODES D'ADMINISTRATION ===

  // Créer un nouveau monde
  public static async createWorld(worldData: Partial<ICampaignWorld>) {
    try {
      const world = new CampaignWorld(worldData);
      await world.save();
      
      console.log(`🏰 Nouveau monde créé: ${world.name} (ID: ${world.worldId})`);
      
      return {
        success: true,
        message: "World created successfully",
        world: world.toObject()
      };
      
    } catch (error: any) {
      console.error("❌ Erreur createWorld:", error);
      throw error;
    }
  }

  // Obtenir les statistiques globales
  public static async getCampaignStats(serverId?: string) {
    try {
      const matchStage = serverId ? { serverId } : {};
      
      const stats = await CampaignProgress.aggregate([
        { $match: matchStage },
        { $group: {
          _id: "$worldId",
          playersInWorld: { $sum: 1 },
          averageProgress: { $avg: "$highestLevelCleared" },
          totalStars: { $sum: { $sum: "$starsByLevel.stars" } }
        }},
        { $sort: { _id: 1 } }
      ]);

      return {
        success: true,
        serverId: serverId || "ALL",
        worldStats: stats
      };

    } catch (error: any) {
      console.error("❌ Erreur getCampaignStats:", error);
      throw error;
    }
  }
}

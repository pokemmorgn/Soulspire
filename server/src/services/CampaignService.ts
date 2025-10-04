import CampaignWorld, { ICampaignWorld, ILevelConfig, Elem } from "../models/CampaignWorld";
import CampaignProgress, { ICampaignProgress, ILevelStar } from "../models/CampaignProgress";
import Player from "../models/Player";
import { BattleService } from "./BattleService";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";
import { WebSocketService } from "./WebSocketService";
import { achievementEmitter, AchievementEvent } from '../utils/AchievementEmitter';
export class CampaignService {

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
          isLocked: false
        })),
        totalWorlds: worlds.length
      };

    } catch (error: any) {
      console.error("❌ Erreur getAllWorlds:", error);
      throw error;
    }
  }

  public static async getPlayerCampaignData(playerId: string, serverId: string) {
    try {
      console.log(`🎯 Récupération données campagne pour ${playerId} sur serveur ${serverId}`);

      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        throw new Error("Player not found on this server");
      }

      const worlds = await CampaignWorld.find({}).sort({ worldId: 1 });
      const playerProgress = await CampaignProgress.find({ 
        playerId, 
        serverId 
      });

      const campaignData = worlds.map(world => {
        const worldProgress = playerProgress.find(p => p.worldId === world.worldId);
        const isUnlocked = player.level >= world.minPlayerLevel;
        const totalStars = worldProgress ? 
          worldProgress.starsByLevel.reduce((sum, level) => sum + level.stars, 0) : 0;
        const maxStars = world.levelCount * 3;
        
        return {
          worldId: world.worldId,
          name: world.name,
          description: world.description,
          mapTheme: world.mapTheme,
          levelCount: world.levelCount,
          minPlayerLevel: world.minPlayerLevel,
          recommendedPower: world.recommendedPower,
          elementBias: world.elementBias,
          isUnlocked,
          highestLevelCleared: worldProgress?.highestLevelCleared || 0,
          totalStars,
          maxStars,
          starProgress: maxStars > 0 ? Math.round((totalStars / maxStars) * 100) : 0,
          nextLevelAvailable: isUnlocked ? 
            Math.min(world.levelCount, (worldProgress?.highestLevelCleared || 0) + 1) : null,
          hasUnclaimedRewards: false
        };
      });

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

  public static async getWorldDetails(
    worldId: number, 
    playerId: string, 
    serverId: string
  ) {
    try {
      console.log(`🏰 Récupération détails monde ${worldId} pour ${playerId}`);

      const world = await CampaignWorld.findOne({ worldId });
      if (!world) {
        throw new Error("World not found");
      }

      const [player, worldProgress] = await Promise.all([
        Player.findOne({ _id: playerId, serverId }),
        CampaignProgress.findOne({ playerId, serverId, worldId })
      ]);

      if (!player) {
        throw new Error("Player not found on this server");
      }

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

      const availableDifficulties = await this.getAvailableDifficulties(playerId, serverId);

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
          isAvailable,
          isCleared,
          stars: levelStar?.stars || 0,
          bestTime: levelStar?.bestTimeMs || null,
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

  public static async startCampaignBattle(
    playerId: string,
    serverId: string,
    worldId: number,
    levelIndex: number,
    difficulty: "Normal" | "Hard" | "Nightmare" = "Normal"
  ) {
    try {
      console.log(`⚔️ Combat campagne: Monde ${worldId}, Niveau ${levelIndex}, ${difficulty}`);

      const world = await CampaignWorld.findOne({ worldId });
      if (!world) {
        throw new Error("World not found");
      }

      const levelConfig = world.levels.find(l => l.levelIndex === levelIndex);
      if (!levelConfig) {
        throw new Error("Level not found");
      }

      const canPlay = await this.canPlayerPlayLevel(playerId, serverId, worldId, levelIndex, difficulty);
      if (!canPlay.allowed) {
        throw new Error(canPlay.reason);
      }

      try {
        WebSocketService.notifyCampaignBattleStarted(playerId, {
          worldId,
          levelIndex,
          difficulty,
          worldName: world.name,
          levelName: levelConfig.name,
          enemyType: levelConfig.enemyType || this.determineEnemyType(levelIndex),
          estimatedDuration: 30000,
          staminaCost: levelConfig.staminaCost || 6
        });
      } catch (wsError) {
        console.error('❌ Erreur notification battle started:', wsError);
      }

      const battleResult = await BattleService.startCampaignBattle(
        playerId,
        serverId,
        worldId,
        levelIndex,
        difficulty
      );

      let newLevelUnlocked = false;
      let newWorldUnlocked = false;
      let playerLevelUp = false;
      let newPlayerLevel = undefined;

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

        const starsEarned = this.calculateStarsEarned(battleResult.result, difficulty);

        // ========================================
        // 🏆 ACHIEVEMENTS - Événements de bataille
        // ========================================
        if (battleResult.result.victory) {
          // Événement de victoire générique
          achievementEmitter.emit(AchievementEvent.BATTLE_WON, {
            playerId,
            serverId,
            value: 1,
            metadata: {
              battleType: 'campaign',
              worldId,
              levelIndex,
              difficulty,
              stars: this.calculateStarsEarned(battleResult.result, difficulty)
            }
          });
        
          // Événement de stage cleared
          achievementEmitter.emit(AchievementEvent.STAGE_CLEARED, {
            playerId,
            serverId,
            value: 1,
            metadata: {
              worldId,
              levelIndex,
              difficulty,
              stars: this.calculateStarsEarned(battleResult.result, difficulty)
            }
          });
        
          // Si c'est un boss (niveaux 10, 20, 30, etc.)
          const levelConfig = world.levels.find(l => l.levelIndex === levelIndex);
          if (levelConfig && this.determineEnemyType(levelIndex) === 'boss') {
            achievementEmitter.emit(AchievementEvent.BOSS_DEFEATED, {
              playerId,
              serverId,
              value: 1,
              metadata: {
                worldId,
                levelIndex,
                difficulty,
                bossType: 'campaign_boss'
              }
            });
          }
        
          // Si nouveau monde débloqué
          if (newWorldUnlocked && newPlayerLevel) {
            achievementEmitter.emit(AchievementEvent.WORLD_REACHED, {
              playerId,
              serverId,
              value: worldId + 1, // Le nouveau monde débloqué
              metadata: {
                previousWorld: worldId,
                playerLevel: newPlayerLevel,
                unlockedBy: 'campaign_completion'
              }
            });
          }
        
          // Si difficulté débloquée
          const isFirstClearNormal = difficulty === "Normal" && 
            await this.isFirstClear(playerId, serverId, worldId, levelIndex, difficulty);
          
          if (isFirstClearNormal && levelIndex === world.levelCount) {
            // Campagne complétée en Normal = déblocage Hard
            achievementEmitter.emit(AchievementEvent.DIFFICULTY_UNLOCKED, {
              playerId,
              serverId,
              value: 1,
              metadata: {
                difficulty: 'Hard',
                worldId,
                unlockedBy: 'normal_completion'
              }
            });
          }
        
          // Vérifier si c'est la complétion totale d'une difficulté
          if (levelIndex === world.levelCount) {
            achievementEmitter.emit(AchievementEvent.CAMPAIGN_COMPLETED, {
              playerId,
              serverId,
              value: 1,
              metadata: {
                difficulty,
                worldId,
                totalStars: await this.getPerfectClearCount(playerId, serverId, worldId)
              }
            });
          }
        
          // Victoire parfaite (3 étoiles)
          if (this.calculateStarsEarned(battleResult.result, difficulty) === 3) {
            achievementEmitter.emit(AchievementEvent.PERFECT_VICTORY, {
              playerId,
              serverId,
              value: 1,
              metadata: {
                worldId,
                levelIndex,
                difficulty,
                battleDuration: battleResult.result.battleDuration
              }
            });
          }
        }
        
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

          const isFirstClear = await this.isFirstClear(playerId, serverId, worldId, levelIndex, difficulty);
          if (isFirstClear) {
            WebSocketService.notifyCampaignFirstClearRewards(playerId, {
              worldId,
              levelIndex,
              difficulty,
              rewards: levelConfig.rewards || this.generateDefaultRewards(worldId, levelIndex),
              bonusRewards: starsEarned === 3 ? ["Perfect Clear Bonus"] : [],
              isSpecialLevel: levelIndex % 10 === 0
            });
          }

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
        try {
          await this.recordCampaignFailure(
            playerId,
            serverId,
            worldId,
            levelIndex,
            difficulty,
            battleResult.result
          );
        } catch (failureError) {
          console.error('❌ Erreur enregistrement échec:', failureError);
        }

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

          await this.checkForProgressBlockingEnhanced(playerId, serverId, worldId, levelIndex, difficulty);

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

  public static async canPlayerPlayLevel(
    playerId: string,
    serverId: string,
    worldId: number,
    levelIndex: number,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<{ allowed: boolean; reason?: string }> {
    
    try {
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

      if (player.level < world.minPlayerLevel) {
        return {
          allowed: false,
          reason: `Player level ${player.level} is too low. Required: ${world.minPlayerLevel}`
        };
      }

      if (levelIndex < 1 || levelIndex > world.levelCount) {
        return {
          allowed: false,
          reason: `Level ${levelIndex} does not exist in world ${worldId}`
        };
      }

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

      if (difficulty === "Hard") {
        const hasCompletedCampaignNormal = await this.hasPlayerCompletedCampaign(playerId, serverId, "Normal");
        if (!hasCompletedCampaignNormal) {
          return {
            allowed: false,
            reason: "Must complete the entire campaign on Normal difficulty to unlock Hard mode"
          };
        }

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

      if (difficulty === "Nightmare") {
        const hasCompletedCampaignHard = await this.hasPlayerCompletedCampaign(playerId, serverId, "Hard");
        if (!hasCompletedCampaignHard) {
          return {
            allowed: false,
            reason: "Must complete the entire campaign on Hard difficulty to unlock Nightmare mode"
          };
        }

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

  private static async recordCampaignFailure(
    playerId: string,
    serverId: string,
    worldId: number,
    levelIndex: number,
    difficulty: string,
    battleResult: any
  ): Promise<void> {
    try {
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
              isCompleted: false,
              failureHistory: [],
              consecutiveFailures: 0,
              totalFailures: 0
            }
          ],
          totalStarsEarned: 0,
          totalTimeSpent: 0,
          globalFailureStats: {
            totalFailures: 0,
            failuresByLevel: new Map(),
            worstLevel: null,
            isCurrentlyStuck: false
          }
        });
      }

      let failureReason: string | undefined;
      if (battleResult.battleDuration > 120000) {
        failureReason = 'timeout';
      } else if (battleResult.stats?.totalDamageDealt < 100) {
        failureReason = 'insufficient_damage';
      } else {
        failureReason = 'team_wiped';
      }

      const player = await Player.findOne({ _id: playerId, serverId }).select('heroes');
      let playerPower = 0;
      if (player && player.heroes) {
        playerPower = player.heroes
          .filter((h: any) => h.equipped)
          .reduce((sum: number, hero: any) => sum + (hero.level * hero.stars * 100), 0);
      }

      (worldProgress as any).recordFailure(
        levelIndex,
        difficulty as "Normal" | "Hard" | "Nightmare",
        failureReason,
        battleResult.battleDuration,
        playerPower
      );

      await worldProgress.save();
      
      console.log(`📊 Échec enregistré: ${playerId} sur ${worldId}-${levelIndex} (${difficulty}) - Raison: ${failureReason}`);

    } catch (error) {
      console.error('❌ Erreur recordCampaignFailure:', error);
    }
  }

  private static async checkForProgressBlockingEnhanced(
    playerId: string,
    serverId: string,
    worldId: number,
    levelIndex: number,
    difficulty: string
  ): Promise<void> {
    try {
      const worldProgress = await CampaignProgress.findOne({ playerId, serverId, worldId });
      if (!worldProgress) return;

      const stuckAnalysis = (worldProgress as any).getStuckAnalysis();
      
      if (stuckAnalysis.isStuck) {
        const stuckHours = stuckAnalysis.stuckDuration / (1000 * 60 * 60);
        const priority: 'low' | 'medium' | 'high' = 
          stuckHours > 24 ? 'high' : stuckHours > 6 ? 'medium' : 'low';

        const consecutiveFailures = (worldProgress as any).getConsecutiveFailures(levelIndex, difficulty);
        
        const enhancedSuggestions = stuckAnalysis.suggestions.map((suggestion: string, index: number) => ({
          type: index === 0 ? 'upgrade' : index === 1 ? 'formation' : 'strategy',
          description: suggestion,
          priority: index === 0 ? 'high' : 'medium',
          cost: index === 0 ? 5000 * Math.floor(stuckAnalysis.failureCount / 2) : undefined,
          effectiveness: Math.max(60, 90 - (stuckAnalysis.failureCount * 5))
        }));

        WebSocketService.notifyCampaignProgressBlocked(playerId, {
          worldId,
          levelIndex,
          difficulty,
          failureCount: stuckAnalysis.failureCount,
          blockedTime: stuckAnalysis.stuckDuration,
          suggestions: enhancedSuggestions,
          canAutoResolve: false
        });

        console.log(`⚠️ Joueur ${playerId} bloqué sur ${worldId}-${levelIndex} (${difficulty}): ${stuckAnalysis.failureCount} échecs, bloqué depuis ${Math.floor(stuckHours)}h`);
      }

      const recentFailures = (worldProgress as any).getConsecutiveFailures(levelIndex, difficulty);
      
      if (recentFailures >= 2 && !stuckAnalysis.isStuck) {
        WebSocketService.notifyCampaignSmartRecommendation(playerId, {
          type: 'retry_strategy',
          title: 'Multiple Defeats Detected',
          description: `You've failed ${recentFailures} times on this level. Consider adjusting your approach.`,
          actionSuggestion: 'Try upgrading heroes or changing team formation before the next attempt',
          currentContext: {
            worldId,
            levelIndex,
            difficulty,
            recentFailures
          },
          priority: 'medium'
        });
      }

    } catch (error) {
      console.error('❌ Erreur checkForProgressBlockingEnhanced:', error);
    }
  }

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
      const world = await CampaignWorld.findOne({ worldId });
      if (!world) {
        console.error(`Monde ${worldId} non trouvé`);
        return { newLevelUnlocked: false, newWorldUnlocked: false, playerLevelUp: false };
      }

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

      const starsEarned = this.calculateStarsEarned(battleResult, difficulty);
      const newLevelUnlocked = (difficulty === "Normal") && (levelIndex === (worldProgress.highestLevelCleared || 0) + 1) && (levelIndex < world.levelCount);
      
      (worldProgress as any).updateDifficultyProgress(
        difficulty as "Normal" | "Hard" | "Nightmare",
        levelIndex,
        starsEarned,
        battleResult.battleDuration,
        world.levelCount
      );

      (worldProgress as any).totalTimeSpent += battleResult.battleDuration;
      await worldProgress.save();
      
      let newWorldUnlocked = false;
      let playerLevelUp = false;
      let newPlayerLevel = undefined;
      
      if (difficulty === "Normal") {
        const player = await Player.findOne({ _id: playerId, serverId });
        if (player) {
          const calculatedPlayerLevel = Math.max(player.level, (worldId - 1) * 10 + levelIndex + 5);
          if (calculatedPlayerLevel > player.level) {
            const oldLevel = player.level;
            player.level = calculatedPlayerLevel;
            player.world = worldId;
            await player.save();
            
            playerLevelUp = true;
            newPlayerLevel = calculatedPlayerLevel;
            // 🏆 ACHIEVEMENT - Niveau joueur atteint
            if (playerLevelUp && newPlayerLevel) {
              achievementEmitter.emit(AchievementEvent.PLAYER_LEVEL_REACHED, {
                playerId,
                serverId,
                value: newPlayerLevel,
                metadata: {
                  previousLevel: player.level,
                  worldId,
                  levelIndex,
                  difficulty
                }
              });
            }
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
      return { newLevelUnlocked: false, newWorldUnlocked: false, playerLevelUp: false };
    }
  }

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

      const diffProgress = worldProgress.progressByDifficulty?.find(p => p.difficulty === difficulty);
      if (!diffProgress) return true;

      const levelStar = diffProgress.starsByLevel.find(s => s.levelIndex === levelIndex);
      return !levelStar || levelStar.stars === 0;

    } catch (error) {
      console.error("Erreur isFirstClear:", error);
      return true;
    }
  }

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

  private static determineEnemyType(levelIndex: number): "normal" | "elite" | "boss" {
    if (levelIndex % 10 === 0) return "boss";
    if (levelIndex % 5 === 0) return "elite";
    return "normal";
  }

  private static determineEnemyCount(enemyType: "normal" | "elite" | "boss"): number {
    switch (enemyType) {
      case "boss": return 1;
      case "elite": return 2;
      case "normal": return 3;
      default: return 3;
    }
  }

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

  private static async getAvailableDifficulties(
    playerId: string,
    serverId: string
  ): Promise<("Normal" | "Hard" | "Nightmare")[]> {
    
    const difficulties: ("Normal" | "Hard" | "Nightmare")[] = ["Normal"];
    
    try {
      const hasCompletedNormal = await this.hasPlayerCompletedCampaign(playerId, serverId, "Normal");
      if (hasCompletedNormal) {
        difficulties.push("Hard");
      }
      
      const hasCompletedHard = await this.hasPlayerCompletedCampaign(playerId, serverId, "Hard");
      if (hasCompletedHard) {
        difficulties.push("Nightmare");
      }
      
    } catch (error) {
      console.error("Erreur getAvailableDifficulties:", error);
    }
    
    return difficulties;
  }

  public static async hasPlayerCompletedCampaign(
    playerId: string,
    serverId: string,
    difficulty: "Normal" | "Hard" | "Nightmare"
  ): Promise<boolean> {
    try {
      const totalWorlds = await CampaignWorld.countDocuments({});
      if (totalWorlds === 0) return false;

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
      
      return (worldProgress as any).getHighestLevelForDifficulty(difficulty);
      
    } catch (error) {
      console.error("Erreur getHighestClearedLevel:", error);
      return 0;
    }
  }

  private static calculateStarsEarned(battleResult: any, difficulty: string): number {
    let stars = 1;
    
    if (battleResult.totalTurns <= 10) stars++;
    if (battleResult.stats.criticalHits >= 3) stars++;
    
    if (battleResult.totalTurns > 30) stars = Math.max(1, stars - 1);
    
    if (difficulty === "Hard") stars = Math.min(3, stars + 1);
    if (difficulty === "Nightmare") stars = 3;
    
    return Math.max(1, Math.min(3, stars));
  }

  private static getCurrentWorld(campaignData: any[]): any {
    return campaignData.find(w => w.isUnlocked && w.highestLevelCleared < w.levelCount) || 
           campaignData[campaignData.length - 1];
  }

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

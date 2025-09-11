import mongoose from 'mongoose';
import Account from '../../models/Account';
import Player from '../../models/Player';
import AuditLog from '../models/AuditLog';
import { AdminPermission } from '../types/adminTypes';

// Interfaces pour les métriques
interface IServerMetrics {
  uptime: number;
  totalPlayers: number;
  activePlayers24h: number;
  activePlayers7d: number;
  newPlayers24h: number;
  totalRevenue: number;
  averageSessionTime: number;
  errorRate: number;
}

interface IPlayerAnalytics {
  retention: {
    day1: number;
    day7: number;
    day30: number;
  };
  progression: {
    averageLevel: number;
    averageWorld: number;
    completionRate: number;
  };
  engagement: {
    dailyActiveUsers: number;
    averagePlaytime: number;
    sessionsPerUser: number;
  };
}

interface IEconomicAnalytics {
  revenue: {
    daily: number;
    weekly: number;
    monthly: number;
    total: number;
  };
  conversion: {
    totalUsers: number;
    payingUsers: number;
    conversionRate: number;
    averageRevenuePerUser: number;
    averageRevenuePerPayer: number;
  };
  purchases: {
    totalTransactions: number;
    mostPopularProducts: Array<{
      productId: string;
      productName: string;
      count: number;
      revenue: number;
    }>;
  };
}

interface IContentAnalytics {
  heroes: {
    mostCollected: Array<{
      heroId: string;
      count: number;
      percentage: number;
    }>;
    averageCollectionSize: number;
  };
  progression: {
    worldDistribution: Array<{
      world: number;
      playerCount: number;
      percentage: number;
    }>;
    difficultyDistribution: {
      Normal: number;
      Hard: number;
      Nightmare: number;
    };
  };
  features: {
    towerProgress: number;
    arenaParticipation: number;
    guildMembership: number;
  };
}

interface IDashboardData {
  overview: IServerMetrics;
  players: IPlayerAnalytics;
  economy: IEconomicAnalytics;
  content: IContentAnalytics;
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  lastUpdated: Date;
}

export class AnalyticsService {

  // ===== MÉTRIQUES SERVEUR =====

  /**
   * Obtenir les métriques globales du serveur
   */
  static async getServerMetrics(): Promise<IServerMetrics> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalAccounts,
        totalPlayers,
        activePlayers24h,
        activePlayers7d,
        newPlayers24h,
        revenueData,
        playtimeData,
        errorLogs
      ] = await Promise.all([
        Account.countDocuments({ accountStatus: 'active' }),
        Player.countDocuments(),
        Player.countDocuments({ lastSeenAt: { $gte: yesterday } }),
        Player.countDocuments({ lastSeenAt: { $gte: lastWeek } }),
        Player.countDocuments({ createdAt: { $gte: yesterday } }),
        Account.aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$totalPurchasesUSD' }
            }
          }
        ]),
        Player.aggregate([
          {
            $group: {
              _id: null,
              averagePlaytime: { $avg: '$playtimeMinutes' }
            }
          }
        ]),
        AuditLog.countDocuments({
          success: false,
          timestamp: { $gte: yesterday }
        })
      ]);

      const totalErrorLogs = await AuditLog.countDocuments({
        timestamp: { $gte: yesterday }
      });

      return {
        uptime: process.uptime(),
        totalPlayers,
        activePlayers24h,
        activePlayers7d,
        newPlayers24h,
        totalRevenue: revenueData[0]?.totalRevenue || 0,
        averageSessionTime: playtimeData[0]?.averagePlaytime || 0,
        errorRate: totalErrorLogs > 0 ? (errorLogs / totalErrorLogs) * 100 : 0
      };

    } catch (error) {
      console.error('Get server metrics error:', error);
      throw new Error('Failed to retrieve server metrics');
    }
  }

  // ===== ANALYTICS JOUEURS =====

  /**
   * Analyser les métriques des joueurs
   */
  static async getPlayerAnalytics(): Promise<IPlayerAnalytics> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Calculer la rétention
      const [
        newPlayersYesterday,
        newPlayersLastWeek,
        newPlayersLastMonth,
        activePlayersDay1,
        activePlayersDay7,
        activePlayersDay30,
        progressionData,
        engagementData
      ] = await Promise.all([
        Player.countDocuments({
          createdAt: {
            $gte: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
            $lt: yesterday
          }
        }),
        Player.countDocuments({
          createdAt: {
            $gte: new Date(lastWeek.getTime() - 24 * 60 * 60 * 1000),
            $lt: lastWeek
          }
        }),
        Player.countDocuments({
          createdAt: {
            $gte: new Date(lastMonth.getTime() - 24 * 60 * 60 * 1000),
            $lt: lastMonth
          }
        }),
        Player.countDocuments({
          createdAt: {
            $gte: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
            $lt: yesterday
          },
          lastSeenAt: { $gte: yesterday }
        }),
        Player.countDocuments({
          createdAt: {
            $gte: new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000),
            $lt: lastWeek
          },
          lastSeenAt: { $gte: yesterday }
        }),
        Player.countDocuments({
          createdAt: {
            $gte: new Date(lastMonth.getTime() - 30 * 24 * 60 * 60 * 1000),
            $lt: lastMonth
          },
          lastSeenAt: { $gte: lastWeek }
        }),
        // Données de progression
        Player.aggregate([
          {
            $group: {
              _id: null,
              averageLevel: { $avg: '$level' },
              averageWorld: { $avg: '$world' },
              totalPlayers: { $sum: 1 },
              completedTutorial: {
                $sum: { $cond: [{ $eq: ['$tutorialCompleted', true] }, 1, 0] }
              }
            }
          }
        ]),
        // Données d'engagement
        Player.aggregate([
          {
            $match: { lastSeenAt: { $gte: yesterday } }
          },
          {
            $group: {
              _id: null,
              dailyActiveUsers: { $sum: 1 },
              averagePlaytime: { $avg: '$playtimeMinutes' }
            }
          }
        ])
      ]);

      const progression = progressionData[0] || {
        averageLevel: 0,
        averageWorld: 0,
        totalPlayers: 1,
        completedTutorial: 0
      };

      const engagement = engagementData[0] || {
        dailyActiveUsers: 0,
        averagePlaytime: 0
      };

      return {
        retention: {
          day1: newPlayersYesterday > 0 ? (activePlayersDay1 / newPlayersYesterday) * 100 : 0,
          day7: newPlayersLastWeek > 0 ? (activePlayersDay7 / newPlayersLastWeek) * 100 : 0,
          day30: newPlayersLastMonth > 0 ? (activePlayersDay30 / newPlayersLastMonth) * 100 : 0
        },
        progression: {
          averageLevel: progression.averageLevel,
          averageWorld: progression.averageWorld,
          completionRate: progression.totalPlayers > 0 ? 
            (progression.completedTutorial / progression.totalPlayers) * 100 : 0
        },
        engagement: {
          dailyActiveUsers: engagement.dailyActiveUsers,
          averagePlaytime: engagement.averagePlaytime,
          sessionsPerUser: engagement.dailyActiveUsers > 0 ? 
            engagement.averagePlaytime / 60 : 0 // Estimation basique
        }
      };

    } catch (error) {
      console.error('Get player analytics error:', error);
      throw new Error('Failed to retrieve player analytics');
    }
  }

  // ===== ANALYTICS ÉCONOMIQUES =====

  /**
   * Analyser les métriques économiques
   */
  static async getEconomicAnalytics(): Promise<IEconomicAnalytics> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        dailyRevenue,
        weeklyRevenue,
        monthlyRevenue,
        totalRevenue,
        conversionData,
        popularProducts
      ] = await Promise.all([
        // Revenus quotidiens
        Account.aggregate([
          {
            $unwind: '$purchaseHistory'
          },
          {
            $match: {
              'purchaseHistory.purchaseDate': { $gte: yesterday },
              'purchaseHistory.status': 'completed'
            }
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$purchaseHistory.priceUSD' }
            }
          }
        ]),
        // Revenus hebdomadaires
        Account.aggregate([
          {
            $unwind: '$purchaseHistory'
          },
          {
            $match: {
              'purchaseHistory.purchaseDate': { $gte: lastWeek },
              'purchaseHistory.status': 'completed'
            }
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$purchaseHistory.priceUSD' }
            }
          }
        ]),
        // Revenus mensuels
        Account.aggregate([
          {
            $unwind: '$purchaseHistory'
          },
          {
            $match: {
              'purchaseHistory.purchaseDate': { $gte: lastMonth },
              'purchaseHistory.status': 'completed'
            }
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$purchaseHistory.priceUSD' }
            }
          }
        ]),
        // Revenus totaux et données de conversion
        Account.aggregate([
          {
            $group: {
              _id: null,
              totalUsers: { $sum: 1 },
              payingUsers: {
                $sum: { $cond: [{ $gt: ['$totalPurchasesUSD', 0] }, 1, 0] }
              },
              totalRevenue: { $sum: '$totalPurchasesUSD' },
              totalPurchases: { $sum: { $size: '$purchaseHistory' } }
            }
          }
        ]),
        // Données de conversion détaillées
        Account.find({ totalPurchasesUSD: { $gt: 0 } })
          .select('totalPurchasesUSD')
          .exec(),
        // Produits populaires
        Account.aggregate([
          {
            $unwind: '$purchaseHistory'
          },
          {
            $match: {
              'purchaseHistory.status': 'completed'
            }
          },
          {
            $group: {
              _id: {
                productId: '$purchaseHistory.productId',
                productName: '$purchaseHistory.productName'
              },
              count: { $sum: 1 },
              revenue: { $sum: '$purchaseHistory.priceUSD' }
            }
          },
          {
            $sort: { revenue: -1 }
          },
          {
            $limit: 10
          }
        ])
      ]);

      const totalStats = totalRevenue[0] || {
        totalUsers: 0,
        payingUsers: 0,
        totalRevenue: 0,
        totalPurchases: 0
      };

      const averageRevenuePerPayer = conversionData.length > 0 ?
        conversionData.reduce((sum, user) => sum + user.totalPurchasesUSD, 0) / conversionData.length : 0;

      return {
        revenue: {
          daily: dailyRevenue[0]?.revenue || 0,
          weekly: weeklyRevenue[0]?.revenue || 0,
          monthly: monthlyRevenue[0]?.revenue || 0,
          total: totalStats.totalRevenue
        },
        conversion: {
          totalUsers: totalStats.totalUsers,
          payingUsers: totalStats.payingUsers,
          conversionRate: totalStats.totalUsers > 0 ? 
            (totalStats.payingUsers / totalStats.totalUsers) * 100 : 0,
          averageRevenuePerUser: totalStats.totalUsers > 0 ? 
            totalStats.totalRevenue / totalStats.totalUsers : 0,
          averageRevenuePerPayer
        },
        purchases: {
          totalTransactions: totalStats.totalPurchases,
          mostPopularProducts: popularProducts.map((product: any) => ({
            productId: product._id.productId,
            productName: product._id.productName,
            count: product.count,
            revenue: product.revenue
          }))
        }
      };

    } catch (error) {
      console.error('Get economic analytics error:', error);
      throw new Error('Failed to retrieve economic analytics');
    }
  }

  // ===== ANALYTICS CONTENU =====

  /**
   * Analyser l'utilisation du contenu
   */
  static async getContentAnalytics(): Promise<IContentAnalytics> {
    try {
      const [
        heroStats,
        worldDistribution,
        difficultyStats,
        featureUsage
      ] = await Promise.all([
        // Statistiques des héros
        Player.aggregate([
          {
            $unwind: '$heroes'
          },
          {
            $group: {
              _id: '$heroes.heroId',
              count: { $sum: 1 }
            }
          },
          {
            $sort: { count: -1 }
          },
          {
            $limit: 20
          }
        ]),
        // Distribution par monde
        Player.aggregate([
          {
            $group: {
              _id: '$world',
              playerCount: { $sum: 1 }
            }
          },
          {
            $sort: { _id: 1 }
          }
        ]),
        // Distribution par difficulté
        Player.aggregate([
          {
            $group: {
              _id: '$difficulty',
              count: { $sum: 1 }
            }
          }
        ]),
        // Utilisation des fonctionnalités
        Player.aggregate([
          {
            $group: {
              _id: null,
              totalPlayers: { $sum: 1 },
              towerActive: {
                $sum: { $cond: [{ $gt: ['$towerProgress.highestFloor', 0] }, 1, 0] }
              },
              arenaActive: {
                $sum: { $cond: [{ $gt: ['$arenaProgress.seasonWins', 0] }, 1, 0] }
              },
              guildMembers: {
                $sum: { $cond: [{ $ne: ['$guildId', null] }, 1, 0] }
              },
              averageHeroes: { $avg: { $size: '$heroes' } }
            }
          }
        ])
      ]);

      const totalPlayers = await Player.countDocuments();
      const features = featureUsage[0] || {
        totalPlayers: 0,
        towerActive: 0,
        arenaActive: 0,
        guildMembers: 0,
        averageHeroes: 0
      };

      // Calculer les pourcentages pour les héros
      const heroStatsWithPercentage = heroStats.map((hero: any) => ({
        heroId: hero._id,
        count: hero.count,
        percentage: totalPlayers > 0 ? (hero.count / totalPlayers) * 100 : 0
      }));

      // Calculer les pourcentages pour les mondes
      const worldStatsWithPercentage = worldDistribution.map((world: any) => ({
        world: world._id,
        playerCount: world.playerCount,
        percentage: totalPlayers > 0 ? (world.playerCount / totalPlayers) * 100 : 0
      }));

      // Organiser les statistiques de difficulté
      const difficultyDistribution = {
        Normal: 0,
        Hard: 0,
        Nightmare: 0
      };

      difficultyStats.forEach((diff: any) => {
        if (diff._id in difficultyDistribution) {
          difficultyDistribution[diff._id as keyof typeof difficultyDistribution] = diff.count;
        }
      });

      return {
        heroes: {
          mostCollected: heroStatsWithPercentage,
          averageCollectionSize: features.averageHeroes
        },
        progression: {
          worldDistribution: worldStatsWithPercentage,
          difficultyDistribution
        },
        features: {
          towerProgress: features.totalPlayers > 0 ? 
            (features.towerActive / features.totalPlayers) * 100 : 0,
          arenaParticipation: features.totalPlayers > 0 ? 
            (features.arenaActive / features.totalPlayers) * 100 : 0,
          guildMembership: features.totalPlayers > 0 ? 
            (features.guildMembers / features.totalPlayers) * 100 : 0
        }
      };

    } catch (error) {
      console.error('Get content analytics error:', error);
      throw new Error('Failed to retrieve content analytics');
    }
  }

  // ===== DASHBOARD PRINCIPAL =====

  /**
   * Obtenir toutes les données du dashboard
   */
  static async getDashboardData(): Promise<IDashboardData> {
    try {
      const [
        serverMetrics,
        playerAnalytics,
        economicAnalytics,
        contentAnalytics,
        systemAlerts
      ] = await Promise.all([
        this.getServerMetrics(),
        this.getPlayerAnalytics(),
        this.getEconomicAnalytics(),
        this.getContentAnalytics(),
        this.generateSystemAlerts()
      ]);

      return {
        overview: serverMetrics,
        players: playerAnalytics,
        economy: economicAnalytics,
        content: contentAnalytics,
        alerts: systemAlerts,
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Get dashboard data error:', error);
      throw new Error('Failed to retrieve dashboard data');
    }
  }

  // ===== ALERTES SYSTÈME =====

  /**
   * Générer des alertes système automatiques
   */
  static async generateSystemAlerts(): Promise<Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>> {
    try {
      const alerts = [];
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // 1. Vérifier le taux d'erreur
      const [totalLogs, errorLogs] = await Promise.all([
        AuditLog.countDocuments({ timestamp: { $gte: yesterday } }),
        AuditLog.countDocuments({ 
          timestamp: { $gte: yesterday },
          success: false 
        })
      ]);

      if (totalLogs > 0) {
        const errorRate = (errorLogs / totalLogs) * 100;
        if (errorRate > 10) {
          alerts.push({
            type: 'error',
            message: `High error rate detected: ${errorRate.toFixed(1)}% in last 24h`,
            timestamp: now,
            severity: errorRate > 25 ? 'critical' : 'high'
          });
        }
      }

      // 2. Vérifier les joueurs actifs
      const activePlayers = await Player.countDocuments({
        lastSeenAt: { $gte: yesterday }
      });

      const totalPlayers = await Player.countDocuments();
      if (totalPlayers > 0) {
        const activeRate = (activePlayers / totalPlayers) * 100;
        if (activeRate < 10) {
          alerts.push({
            type: 'warning',
            message: `Low player activity: ${activeRate.toFixed(1)}% active in last 24h`,
            timestamp: now,
            severity: activeRate < 5 ? 'high' : 'medium'
          });
        }
      }

      // 3. Vérifier les revenus
      const recentRevenue = await Account.aggregate([
        {
          $unwind: '$purchaseHistory'
        },
        {
          $match: {
            'purchaseHistory.purchaseDate': { $gte: yesterday },
            'purchaseHistory.status': 'completed'
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$purchaseHistory.priceUSD' },
            transactions: { $sum: 1 }
          }
        }
      ]);

      if (recentRevenue.length === 0 || recentRevenue[0].revenue === 0) {
        alerts.push({
          type: 'info',
          message: 'No revenue generated in the last 24 hours',
          timestamp: now,
          severity: 'medium'
        });
      }

      // 4. Vérifier les échecs de connexion
      const failedLogins = await AuditLog.countDocuments({
        action: 'admin.failed_login',
        timestamp: { $gte: yesterday }
      });

      if (failedLogins > 10) {
        alerts.push({
          type: 'warning',
          message: `Multiple failed admin login attempts: ${failedLogins} in last 24h`,
          timestamp: now,
          severity: failedLogins > 50 ? 'critical' : 'medium'
        });
      }

      // 5. Vérifier l'utilisation mémoire
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
      
      if (memoryUsageMB > 512) {
        alerts.push({
          type: 'warning',
          message: `High memory usage: ${memoryUsageMB.toFixed(0)}MB`,
          timestamp: now,
          severity: memoryUsageMB > 1024 ? 'high' : 'medium'
        });
      }

      return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    } catch (error) {
      console.error('Generate system alerts error:', error);
      return [{
        type: 'error',
        message: 'Failed to generate system alerts',
        timestamp: new Date(),
        severity: 'medium'
      }];
    }
  }

  // ===== RAPPORTS SPÉCIALISÉS =====

  /**
   * Générer un rapport de rétention détaillé
   */
  static async getRetentionReport(days: number = 30): Promise<any> {
    try {
      const cohorts = [];
      const now = new Date();

      for (let i = 0; i < days; i++) {
        const cohortDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const nextDay = new Date(cohortDate.getTime() + 24 * 60 * 60 * 1000);

        const newPlayers = await Player.find({
          createdAt: {
            $gte: cohortDate,
            $lt: nextDay
          }
        }).select('playerId createdAt lastSeenAt').exec();

        if (newPlayers.length === 0) continue;

        const retentionData = {
          date: cohortDate,
          newPlayers: newPlayers.length,
          retention: {} as any
        };

        // Calculer la rétention pour chaque jour suivant
        for (let d = 1; d <= Math.min(30, days - i); d++) {
          const checkDate = new Date(cohortDate.getTime() + d * 24 * 60 * 60 * 1000);
          const activeCount = newPlayers.filter(player => 
            player.lastSeenAt && player.lastSeenAt >= checkDate
          ).length;
          
          retentionData.retention[`day${d}`] = {
            count: activeCount,
            percentage: (activeCount / newPlayers.length) * 100
          };
        }

        cohorts.push(retentionData);
      }

      return {
        cohorts: cohorts.reverse(), // Plus récent en premier
        generatedAt: now
      };

    } catch (error) {
      console.error('Get retention report error:', error);
      throw new Error('Failed to generate retention report');
    }
  }

  /**
   * Analyser les performances par serveur
   */
  static async getServerPerformance(): Promise<any> {
    try {
      const serverStats = await Player.aggregate([
        {
          $group: {
            _id: '$serverId',
            totalPlayers: { $sum: 1 },
            averageLevel: { $avg: '$level' },
            totalRevenue: { $sum: '$totalSpentUSDOnServer' },
            activePlayers: {
              $sum: {
                $cond: [
                  { 
                    $gte: ['$lastSeenAt', new Date(Date.now() - 24 * 60 * 60 * 1000)]
                  },
                  1,
                  0
                ]
              }
            },
            newPlayers: {
              $sum: {
                $cond: [
                  { 
                    $gte: ['$createdAt', new Date(Date.now() - 24 * 60 * 60 * 1000)]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $sort: { totalPlayers: -1 }
        }
      ]);

      return {
        servers: serverStats.map((server: any) => ({
          serverId: server._id,
          totalPlayers: server.totalPlayers,
          averageLevel: Math.round(server.averageLevel || 0),
          totalRevenue: server.totalRevenue || 0,
          activePlayers: server.activePlayers,
          newPlayers: server.newPlayers,
          activityRate: server.totalPlayers > 0 ? 
            (server.activePlayers / server.totalPlayers) * 100 : 0,
          arpu: server.totalPlayers > 0 ? 
            (server.totalRevenue / server.totalPlayers) : 0
        })),
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('Get server performance error:', error);
      throw new Error('Failed to analyze server performance');
    }
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Vérifier les permissions d'accès aux analytics
   */
  static async checkAnalyticsPermission(permission: AdminPermission): Promise<boolean> {
    const analyticsPermissions: AdminPermission[] = [
      'analytics.view',
      'analytics.export',
      'analytics.financial',
      '*'
    ];

    return analyticsPermissions.includes(permission);
  }

  /**
   * Obtenir un résumé rapide pour le header
   */
  static async getQuickStats(): Promise<{
    onlineAdmins: number;
    activePlayers: number;
    todayRevenue: number;
    systemHealth: 'good' | 'warning' | 'critical';
  }> {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [activePlayers, todayRevenue, errorRate] = await Promise.all([
        Player.countDocuments({ lastSeenAt: { $gte: yesterday } }),
        Account.aggregate([
          {
            $unwind: '$purchaseHistory'
          },
          {
            $match: {
              'purchaseHistory.purchaseDate': { $gte: yesterday },
              'purchaseHistory.status': 'completed'
            }
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$purchaseHistory.priceUSD' }
            }
          }
        ]),
        AuditLog.aggregate([
          {
            $match: { timestamp: { $gte: yesterday } }
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              errors: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } }
            }
          }
        ])
      ]);

      const errorStats = errorRate[0] || { total: 0, errors: 0 };
      const currentErrorRate = errorStats.total > 0 ? 
        (errorStats.errors / errorStats.total) * 100 : 0;

      let systemHealth: 'good' | 'warning' | 'critical' = 'good';
      if (currentErrorRate > 25) {
        systemHealth = 'critical';
      } else if (currentErrorRate > 10) {
        systemHealth = 'warning';
      }

      return {
        onlineAdmins: 0, // Sera mis à jour depuis le cache des sessions
        activePlayers,
        todayRevenue: todayRevenue[0]?.revenue || 0,
        systemHealth
      };

    } catch (error) {
      console.error('Get quick stats error:', error);
      return {
        onlineAdmins: 0,
        activePlayers: 0,
        todayRevenue: 0,
        systemHealth: 'critical'
      };
    }
  }

  /**
   * Exporter des données pour analyse externe
   */
  static async exportData(
    type: 'players' | 'revenue' | 'retention' | 'content',
    format: 'json' | 'csv',
    filters?: any
  ): Promise<{ data: any; filename: string }> {
    try {
      let data: any;
      let filename: string;

      switch (type) {
        case 'players':
          data = await Player.find(filters || {})
            .select('displayName level world totalSpentUSDOnServer createdAt lastSeenAt')
            .exec();
          filename = `players_export_${new Date().toISOString().split('T')[0]}.${format}`;
          break;

        case 'revenue':
          data = await Account.aggregate([
            {
              $unwind: '$purchaseHistory'
            },
            {
              $match: {
                'purchaseHistory.status': 'completed',
                ...(filters || {})
              }
            },
            {
              $project: {
                username: 1,
                productName: '$purchaseHistory.productName',
                priceUSD: '$purchaseHistory.priceUSD',
                purchaseDate: '$purchaseHistory.purchaseDate',
                platform: '$purchaseHistory.platform'
              }
            }
          ]);
          filename = `revenue_export_${new Date().toISOString().split('T')[0]}.${format}`;
          break;

        case 'retention':
          data = await this.getRetentionReport(30);
          filename = `retention_export_${new Date().toISOString().split('T')[0]}.${format}`;
          break;

        case 'content':
          data = await this.getContentAnalytics();
          filename = `content_export_${new Date().toISOString().split('T')[0]}.${format}`;
          break;

        default:
          throw new Error('Invalid export type');
      }

      // Conversion CSV si nécessaire
      if (format === 'csv' && Array.isArray(data)) {
        data = this.convertToCSV(data);
      }

      return { data, filename };

    } catch (error) {
      console.error('Export data error:', error);
      throw new Error('Failed to export data');
    }
  }

  /**
   * Convertir des données en format CSV
   */
  private static convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeader = headers.join(',');
    
    const csvRows = data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Échapper les virgules et guillemets
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );

    return [csvHeader, ...csvRows].join('\n');
  }

  /**
   * Obtenir les tendances sur une période
   */
  static async getTrends(days: number = 7): Promise<{
    playerGrowth: Array<{ date: string; count: number }>;
    revenueGrowth: Array<{ date: string; amount: number }>;
    engagementTrend: Array<{ date: string; activeUsers: number }>;
  }> {
    try {
      const trends = {
        playerGrowth: [],
        revenueGrowth: [],
        engagementTrend: []
      } as any;

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dateStr = date.toISOString().split('T')[0];

        // Croissance des joueurs
        const newPlayers = await Player.countDocuments({
          createdAt: {
            $gte: date,
            $lt: nextDate
          }
        });

        trends.playerGrowth.push({
          date: dateStr,
          count: newPlayers
        });

        // Croissance des revenus
        const dailyRevenue = await Account.aggregate([
          {
            $unwind: '$purchaseHistory'
          },
          {
            $match: {
              'purchaseHistory.purchaseDate': {
                $gte: date,
                $lt: nextDate
              },
              'purchaseHistory.status': 'completed'
            }
          },
          {
            $group: {
              _id: null,
              amount: { $sum: '$purchaseHistory.priceUSD' }
            }
          }
        ]);

        trends.revenueGrowth.push({
          date: dateStr,
          amount: dailyRevenue[0]?.amount || 0
        });

        // Tendance d'engagement
        const activeUsers = await Player.countDocuments({
          lastSeenAt: {
            $gte: date,
            $lt: nextDate
          }
        });

        trends.engagementTrend.push({
          date: dateStr,
          activeUsers
        });
      }

      return trends;

    } catch (error) {
      console.error('Get trends error:', error);
      throw new Error('Failed to retrieve trends data');
    }
  }

  /**
   * Analyser la santé du jeu (métriques clés)
   */
  static async getGameHealth(): Promise<{
    overallScore: number;
    metrics: {
      playerRetention: { score: number; status: string };
      monetization: { score: number; status: string };
      engagement: { score: number; status: string };
      technical: { score: number; status: string };
    };
    recommendations: string[];
  }> {
    try {
      const [
        playerAnalytics,
        economicAnalytics,
        serverMetrics
      ] = await Promise.all([
        this.getPlayerAnalytics(),
        this.getEconomicAnalytics(),
        this.getServerMetrics()
      ]);

      // Calculer les scores (0-100)
      const retentionScore = Math.min(100, playerAnalytics.retention.day1 * 2);
      const monetizationScore = Math.min(100, economicAnalytics.conversion.conversionRate * 10);
      const engagementScore = Math.min(100, (playerAnalytics.engagement.averagePlaytime / 60) * 10);
      const technicalScore = Math.max(0, 100 - serverMetrics.errorRate * 5);

      const overallScore = (retentionScore + monetizationScore + engagementScore + technicalScore) / 4;

      const getStatus = (score: number) => {
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Fair';
        return 'Poor';
      };

      const recommendations = [];
      if (retentionScore < 50) {
        recommendations.push('Improve new player onboarding and early game experience');
      }
      if (monetizationScore < 30) {
        recommendations.push('Review pricing strategy and offer more compelling purchase options');
      }
      if (engagementScore < 40) {
        recommendations.push('Add more engaging content and daily activities');
      }
      if (technicalScore < 70) {
        recommendations.push('Address technical issues affecting user experience');
      }

      return {
        overallScore: Math.round(overallScore),
        metrics: {
          playerRetention: { score: Math.round(retentionScore), status: getStatus(retentionScore) },
          monetization: { score: Math.round(monetizationScore), status: getStatus(monetizationScore) },
          engagement: { score: Math.round(engagementScore), status: getStatus(engagementScore) },
          technical: { score: Math.round(technicalScore), status: getStatus(technicalScore) }
        },
        recommendations
      };

    } catch (error) {
      console.error('Get game health error:', error);
      throw new Error('Failed to analyze game health');
    }
  }
}

export default AnalyticsService;

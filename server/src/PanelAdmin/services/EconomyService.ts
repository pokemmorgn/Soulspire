import mongoose from 'mongoose';
import Account from '../../models/Account';
import Player from '../../models/Player';
import AuditLog from '../models/AuditLog';
import { AdminRole, AdminPermission, AdminAction } from '../types/adminTypes';

// Interfaces pour l'économie
interface IEconomySnapshot {
  serverId: string;
  timestamp: Date;
  totalPlayers: number;
  currencies: {
    gold: {
      total: number;
      average: number;
      median: number;
      top1Percent: number;
      distribution: Array<{ range: string; count: number; percentage: number }>;
    };
    gems: {
      total: number;
      average: number;
      median: number;
      top1Percent: number;
      distribution: Array<{ range: string; count: number; percentage: number }>;
    };
    paidGems: {
      total: number;
      average: number;
      median: number;
      top1Percent: number;
    };
    tickets: {
      total: number;
      average: number;
      median: number;
    };
  };
  healthIndicators: {
    giniCoefficient: number; // Inégalité de distribution (0-1, 0=parfaitement égal)
    inflationRate: number; // Taux d'inflation estimé
    liquidityRatio: number; // Ratio de liquidité
    economyScore: number; // Score global de santé (0-100)
  };
}

interface IEconomyAnomaly {
  type: 'suspicious_wealth' | 'rapid_accumulation' | 'mass_transfer' | 'inflation_spike' | 'deflation_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  serverId: string;
  playerId?: string;
  playerName?: string;
  description: string;
  detectedAt: Date;
  data: any;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

interface IGlobalEconomyAction {
  serverId: string;
  action: 'distribute' | 'drain' | 'multiply' | 'tax' | 'compensate';
  currency: 'gold' | 'gems' | 'tickets';
  parameters: {
    amount?: number;
    percentage?: number;
    multiplier?: number;
    condition?: string; // Ex: "level >= 10", "vipLevel >= 3"
  };
  reason: string;
  affectedPlayersEstimate?: number;
}

interface ITransactionPattern {
  playerId: string;
  playerName: string;
  serverId: string;
  patterns: {
    rapidGoldGain: boolean;
    suspiciousGemsGain: boolean;
    unusualSpending: boolean;
    potentialBot: boolean;
    riskScore: number; // 0-100
  };
  recentTransactions: Array<{
    type: string;
    amount: number;
    currency: string;
    timestamp: Date;
    suspicious: boolean;
  }>;
}

export class EconomyService {

  // ===== SURVEILLANCE ÉCONOMIQUE =====

  /**
   * Obtenir un snapshot complet de l'économie d'un serveur
   */
  static async getEconomySnapshot(serverId: string): Promise<IEconomySnapshot> {
    try {
      const players = await Player.find({ serverId }).select('gold gems paidGems tickets level vipLevel');
      
      if (players.length === 0) {
        throw new Error('No players found for this server');
      }

      // Trier les données pour calculs statistiques
      const goldValues = players.map(p => p.gold).sort((a, b) => a - b);
      const gemsValues = players.map(p => p.gems).sort((a, b) => a - b);
      const paidGemsValues = players.map(p => p.paidGems).sort((a, b) => a - b);
      const ticketsValues = players.map(p => p.tickets).sort((a, b) => a - b);

      const snapshot: IEconomySnapshot = {
        serverId,
        timestamp: new Date(),
        totalPlayers: players.length,
        currencies: {
          gold: {
            total: goldValues.reduce((sum, val) => sum + val, 0),
            average: goldValues.reduce((sum, val) => sum + val, 0) / goldValues.length,
            median: this.calculateMedian(goldValues),
            top1Percent: this.calculateTop1Percent(goldValues),
            distribution: this.calculateDistribution(goldValues, [
              { min: 0, max: 10000, label: '0-10K' },
              { min: 10000, max: 50000, label: '10K-50K' },
              { min: 50000, max: 100000, label: '50K-100K' },
              { min: 100000, max: 500000, label: '100K-500K' },
              { min: 500000, max: Infinity, label: '500K+' }
            ])
          },
          gems: {
            total: gemsValues.reduce((sum, val) => sum + val, 0),
            average: gemsValues.reduce((sum, val) => sum + val, 0) / gemsValues.length,
            median: this.calculateMedian(gemsValues),
            top1Percent: this.calculateTop1Percent(gemsValues),
            distribution: this.calculateDistribution(gemsValues, [
              { min: 0, max: 1000, label: '0-1K' },
              { min: 1000, max: 5000, label: '1K-5K' },
              { min: 5000, max: 10000, label: '5K-10K' },
              { min: 10000, max: 50000, label: '10K-50K' },
              { min: 50000, max: Infinity, label: '50K+' }
            ])
          },
          paidGems: {
            total: paidGemsValues.reduce((sum, val) => sum + val, 0),
            average: paidGemsValues.reduce((sum, val) => sum + val, 0) / paidGemsValues.length,
            median: this.calculateMedian(paidGemsValues),
            top1Percent: this.calculateTop1Percent(paidGemsValues)
          },
          tickets: {
            total: ticketsValues.reduce((sum, val) => sum + val, 0),
            average: ticketsValues.reduce((sum, val) => sum + val, 0) / ticketsValues.length,
            median: this.calculateMedian(ticketsValues)
          }
        },
        healthIndicators: {
          giniCoefficient: this.calculateGiniCoefficient(goldValues),
          inflationRate: await this.estimateInflationRate(serverId),
          liquidityRatio: this.calculateLiquidityRatio(players),
          economyScore: 0 // Sera calculé après
        }
      };

      // Calculer le score global de santé économique
      snapshot.healthIndicators.economyScore = this.calculateEconomyHealthScore(snapshot);

      return snapshot;

    } catch (error) {
      console.error('Get economy snapshot error:', error);
      throw new Error('Failed to generate economy snapshot');
    }
  }

  /**
   * Détecter les anomalies économiques
   */
  static async detectEconomyAnomalies(serverId: string): Promise<IEconomyAnomaly[]> {
    try {
      const anomalies: IEconomyAnomaly[] = [];
      const players = await Player.find({ serverId });
      const now = new Date();

      // 1. Détecter les richesses suspectes
      const wealthThresholds = {
        gold: 10000000, // 10M d'or
        gems: 100000,   // 100K gems
        paidGems: 50000 // 50K paid gems
      };

      for (const player of players) {
        let suspiciousWealth = false;
        const suspiciousFields = [];

        if (player.gold > wealthThresholds.gold) {
          suspiciousFields.push(`gold: ${player.gold.toLocaleString()}`);
          suspiciousWealth = true;
        }
        if (player.gems > wealthThresholds.gems) {
          suspiciousFields.push(`gems: ${player.gems.toLocaleString()}`);
          suspiciousWealth = true;
        }
        if (player.paidGems > wealthThresholds.paidGems) {
          suspiciousFields.push(`paidGems: ${player.paidGems.toLocaleString()}`);
          suspiciousWealth = true;
        }

        if (suspiciousWealth) {
          anomalies.push({
            type: 'suspicious_wealth',
            severity: player.paidGems > wealthThresholds.paidGems ? 'critical' : 'high',
            serverId,
            playerId: player.playerId,
            playerName: player.displayName,
            description: `Player has suspicious wealth levels: ${suspiciousFields.join(', ')}`,
            detectedAt: now,
            data: {
              gold: player.gold,
              gems: player.gems,
              paidGems: player.paidGems,
              level: player.level,
              vipLevel: player.vipLevel
            },
            resolved: false
          });
        }
      }

      // 2. Détecter l'accumulation rapide (dernières 24h)
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentlyCreatedPlayers = players.filter(p => 
        (p as any).createdAt && (p as any).createdAt > yesterday
      );

      for (const player of recentlyCreatedPlayers) {
        const totalWealth = player.gold + (player.gems * 100) + (player.paidGems * 100);
        if (totalWealth > 1000000) { // 1M en valeur équivalente or
          anomalies.push({
            type: 'rapid_accumulation',
            severity: 'high',
            serverId,
            playerId: player.playerId,
            playerName: player.displayName,
            description: `New player accumulated significant wealth quickly: ${totalWealth.toLocaleString()} total value`,
            detectedAt: now,
            data: {
              accountAge: Math.floor((now.getTime() - (player as any).createdAt.getTime()) / (1000 * 60 * 60)),
              totalWealth,
              gold: player.gold,
              gems: player.gems,
              paidGems: player.paidGems
            },
            resolved: false
          });
        }
      }

      // 3. Détecter les ratios anormaux gems/paidGems
      for (const player of players) {
        if (player.paidGems > 0 && player.gems > player.paidGems * 50) {
          anomalies.push({
            type: 'suspicious_wealth',
            severity: 'medium',
            serverId,
            playerId: player.playerId,
            playerName: player.displayName,
            description: `Unusual gems to paidGems ratio: ${player.gems} gems vs ${player.paidGems} paid gems`,
            detectedAt: now,
            data: {
              gems: player.gems,
              paidGems: player.paidGems,
              ratio: player.paidGems > 0 ? player.gems / player.paidGems : 0
            },
            resolved: false
          });
        }
      }

      // 4. Analyser la distribution économique globale
      const snapshot = await this.getEconomySnapshot(serverId);
      
      // Détection d'inflation (coefficient de Gini trop élevé)
      if (snapshot.healthIndicators.giniCoefficient > 0.7) {
        anomalies.push({
          type: 'inflation_spike',
          severity: snapshot.healthIndicators.giniCoefficient > 0.85 ? 'critical' : 'high',
          serverId,
          description: `High wealth inequality detected (Gini: ${snapshot.healthIndicators.giniCoefficient.toFixed(3)})`,
          detectedAt: now,
          data: {
            giniCoefficient: snapshot.healthIndicators.giniCoefficient,
            top1PercentGold: snapshot.currencies.gold.top1Percent,
            averageGold: snapshot.currencies.gold.average,
            medianGold: snapshot.currencies.gold.median
          },
          resolved: false
        });
      }

      // Détection de déflation (économie trop restreinte)
      if (snapshot.currencies.gold.average < 1000 && snapshot.totalPlayers > 100) {
        anomalies.push({
          type: 'deflation_risk',
          severity: 'medium',
          serverId,
          description: `Low average gold suggests possible deflation (avg: ${snapshot.currencies.gold.average.toFixed(0)})`,
          detectedAt: now,
          data: {
            averageGold: snapshot.currencies.gold.average,
            totalPlayers: snapshot.totalPlayers,
            economyScore: snapshot.healthIndicators.economyScore
          },
          resolved: false
        });
      }

      return anomalies.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

    } catch (error) {
      console.error('Detect economy anomalies error:', error);
      throw new Error('Failed to detect economy anomalies');
    }
  }

  /**
   * Analyser les patterns de transaction suspects
   */
  static async analyzeTransactionPatterns(serverId: string, limit: number = 50): Promise<ITransactionPattern[]> {
    try {
      const players = await Player.find({ serverId })
        .sort({ lastSeenAt: -1 })
        .limit(limit);

      const patterns: ITransactionPattern[] = [];

      for (const player of players) {
        const riskFactors = {
          rapidGoldGain: false,
          suspiciousGemsGain: false,
          unusualSpending: false,
          potentialBot: false
        };

        let riskScore = 0;

        // Analyser la progression vs niveau
        const expectedGoldForLevel = player.level * 1000; // 1K or par niveau approximativement
        if (player.gold > expectedGoldForLevel * 10) {
          riskFactors.rapidGoldGain = true;
          riskScore += 25;
        }

        // Analyser les gems vs argent dépensé
        if (player.gems > 10000 && player.totalSpentUSDOnServer < 10) {
          riskFactors.suspiciousGemsGain = true;
          riskScore += 30;
        }

        // Détecter les patterns de bot
        if (player.totalBattlesFought > 1000 && 
            player.playtimeMinutes < 60 && 
            player.totalBattlesWon === player.totalBattlesFought) {
          riskFactors.potentialBot = true;
          riskScore += 40;
        }

        // Analyser les dépenses inhabituelles
        if (player.totalSpentUSDOnServer > 1000 && player.level < 10) {
          riskFactors.unusualSpending = true;
          riskScore += 20;
        }

        // Simuler des transactions récentes (dans un vrai système, ça viendrait de logs)
        const recentTransactions = this.generateMockTransactions(player, riskFactors);

        if (riskScore > 20) { // Seuil de détection
          patterns.push({
            playerId: player.playerId,
            playerName: player.displayName,
            serverId,
            patterns: {
              ...riskFactors,
              riskScore
            },
            recentTransactions
          });
        }
      }

      return patterns.sort((a, b) => b.patterns.riskScore - a.patterns.riskScore);

    } catch (error) {
      console.error('Analyze transaction patterns error:', error);
      throw new Error('Failed to analyze transaction patterns');
    }
  }

  // ===== INTERVENTIONS ÉCONOMIQUES =====

  /**
   * Exécuter une action économique globale
   */
  static async executeGlobalEconomyAction(
    action: IGlobalEconomyAction,
    adminId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    success: boolean;
    affectedPlayers: number;
    totalAmountChanged: number;
    message: string;
  }> {
    try {
      const admin = await Account.findOne({ accountId: adminId, adminEnabled: true });
      if (!admin || !admin.hasAdminPermission('economy.modify')) {
        throw new Error('Insufficient permissions for global economy actions');
      }

      let query: any = { serverId: action.serverId };
      
      // Appliquer les conditions si spécifiées
      if (action.parameters.condition) {
        query = { ...query, ...this.parseCondition(action.parameters.condition) };
      }

      const targetPlayers = await Player.find(query);
      let affectedPlayers = 0;
      let totalAmountChanged = 0;

      for (const player of targetPlayers) {
        const oldValue = player[action.currency];
        let newValue = oldValue;

        switch (action.action) {
          case 'distribute':
            if (action.parameters.amount) {
              newValue = oldValue + action.parameters.amount;
              totalAmountChanged += action.parameters.amount;
            }
            break;

          case 'drain':
            if (action.parameters.amount) {
              newValue = Math.max(0, oldValue - action.parameters.amount);
              totalAmountChanged += (oldValue - newValue);
            } else if (action.parameters.percentage) {
              const drainAmount = Math.floor(oldValue * (action.parameters.percentage / 100));
              newValue = oldValue - drainAmount;
              totalAmountChanged += drainAmount;
            }
            break;

          case 'multiply':
            if (action.parameters.multiplier) {
              newValue = Math.floor(oldValue * action.parameters.multiplier);
              totalAmountChanged += (newValue - oldValue);
            }
            break;

          case 'tax':
            if (action.parameters.percentage && oldValue > 10000) { // Taxer seulement les "riches"
              const taxAmount = Math.floor(oldValue * (action.parameters.percentage / 100));
              newValue = oldValue - taxAmount;
              totalAmountChanged += taxAmount;
            }
            break;

          case 'compensate':
            if (action.parameters.amount) {
              newValue = oldValue + action.parameters.amount;
              totalAmountChanged += action.parameters.amount;
            }
            break;
        }

        if (newValue !== oldValue) {
          player[action.currency] = newValue;
          await player.save();
          affectedPlayers++;
        }
      }

      // Logger l'action globale
      await AuditLog.createLog({
        adminId,
        adminUsername: admin.username,
        adminRole: admin.adminRole!,
        action: 'economy.modify_shop',
        resource: 'global_economy',
        resourceId: action.serverId,
        details: {
          additionalInfo: {
            action: action.action,
            currency: action.currency,
            parameters: action.parameters,
            reason: action.reason,
            affectedPlayers,
            totalAmountChanged,
            estimateMatched: action.affectedPlayersEstimate || 'not provided'
          }
        },
        ipAddress,
        userAgent,
        success: true,
        severity: 'critical'
      });

      return {
        success: true,
        affectedPlayers,
        totalAmountChanged,
        message: `Global ${action.action} completed: ${affectedPlayers} players affected, ${totalAmountChanged.toLocaleString()} ${action.currency} ${action.action === 'drain' || action.action === 'tax' ? 'removed' : 'added'}`
      };

    } catch (error) {
      console.error('Execute global economy action error:', error);
      throw new Error(`Failed to execute global economy action: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Créer une compensation de masse
   */
  static async createMassCompensation(
    serverId: string,
    compensation: {
      gold?: number;
      gems?: number;
      tickets?: number;
    },
    condition: string,
    reason: string,
    adminId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; details: any }> {
    try {
      const results = [];

      for (const [currency, amount] of Object.entries(compensation)) {
        if (amount && amount > 0) {
          const action: IGlobalEconomyAction = {
            serverId,
            action: 'compensate',
            currency: currency as 'gold' | 'gems' | 'tickets',
            parameters: { amount },
            reason: `Mass compensation: ${reason}`,
            affectedPlayersEstimate: 0
          };

          const result = await this.executeGlobalEconomyAction(
            action,
            adminId,
            ipAddress,
            userAgent
          );

          results.push({
            currency,
            amount,
            affectedPlayers: result.affectedPlayers,
            success: result.success
          });
        }
      }

      return {
        success: true,
        details: {
          serverId,
          compensations: results,
          reason,
          condition,
          timestamp: new Date()
        }
      };

    } catch (error) {
      console.error('Create mass compensation error:', error);
      throw new Error('Failed to create mass compensation');
    }
  }

  // ===== ANALYTICS ÉCONOMIQUES =====

  /**
   * Comparer l'économie entre serveurs
   */
  static async compareServerEconomies(): Promise<Array<{
    serverId: string;
    playerCount: number;
    economyScore: number;
    averageWealth: number;
    giniCoefficient: number;
    inflationRisk: 'low' | 'medium' | 'high';
    lastUpdated: Date;
  }>> {
    try {
      const servers = await Player.distinct('serverId');
      const comparisons = [];

      for (const serverId of servers) {
        try {
          const snapshot = await this.getEconomySnapshot(serverId);
          
          let inflationRisk: 'low' | 'medium' | 'high' = 'low';
          if (snapshot.healthIndicators.giniCoefficient > 0.6) inflationRisk = 'medium';
          if (snapshot.healthIndicators.giniCoefficient > 0.75) inflationRisk = 'high';

          comparisons.push({
            serverId,
            playerCount: snapshot.totalPlayers,
            economyScore: snapshot.healthIndicators.economyScore,
            averageWealth: snapshot.currencies.gold.average + (snapshot.currencies.gems.average * 10),
            giniCoefficient: snapshot.healthIndicators.giniCoefficient,
            inflationRisk,
            lastUpdated: snapshot.timestamp
          });
        } catch (error) {
          console.warn(`Failed to get snapshot for server ${serverId}:`, error);
        }
      }

      return comparisons.sort((a, b) => b.economyScore - a.economyScore);

    } catch (error) {
      console.error('Compare server economies error:', error);
      throw new Error('Failed to compare server economies');
    }
  }

  /**
   * Obtenir les tendances économiques
   */
  static async getEconomyTrends(serverId: string, days: number = 7): Promise<{
    trends: Array<{
      date: string;
      avgGold: number;
      avgGems: number;
      playerCount: number;
      economyScore: number;
    }>;
    projections: {
      nextWeekGold: number;
      nextWeekGems: number;
      trend: 'growing' | 'stable' | 'declining';
    };
  }> {
    try {
      // Pour l'instant, simuler des données de tendance
      // Dans un vrai système, ça viendrait d'une table de snapshots historiques
      const trends = [];
      const now = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const snapshot = await this.getEconomySnapshot(serverId);
        
        // Ajouter une variation simulée pour montrer l'évolution
        const dayVariation = 1 + (Math.random() - 0.5) * 0.1; // ±5% variation
        
        trends.push({
          date: date.toISOString().split('T')[0],
          avgGold: Math.floor(snapshot.currencies.gold.average * dayVariation),
          avgGems: Math.floor(snapshot.currencies.gems.average * dayVariation),
          playerCount: snapshot.totalPlayers,
          economyScore: snapshot.healthIndicators.economyScore
        });
      }

      // Calculer les projections basiques
      const lastWeek = trends.slice(-7);
      const goldTrend = lastWeek[lastWeek.length - 1].avgGold - lastWeek[0].avgGold;
      const gemsTrend = lastWeek[lastWeek.length - 1].avgGems - lastWeek[0].avgGems;
      
      let overallTrend: 'growing' | 'stable' | 'declining' = 'stable';
      if (goldTrend > 100 && gemsTrend > 10) overallTrend = 'growing';
      if (goldTrend < -100 && gemsTrend < -10) overallTrend = 'declining';

      return {
        trends,
        projections: {
          nextWeekGold: lastWeek[lastWeek.length - 1].avgGold + goldTrend,
          nextWeekGems: lastWeek[lastWeek.length - 1].avgGems + gemsTrend,
          trend: overallTrend
        }
      };

    } catch (error) {
      console.error('Get economy trends error:', error);
      throw new Error('Failed to get economy trends');
    }
  }

  // ===== MÉTHODES UTILITAIRES PRIVÉES =====

  private static calculateMedian(values: number[]): number {
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0 
      ? (values[mid - 1] + values[mid]) / 2 
      : values[mid];
  }

  private static calculateTop1Percent(values: number[]): number {
    const index = Math.floor(values.length * 0.99);
    return values[index] || 0;
  }

  private static calculateDistribution(
    values: number[], 
    ranges: Array<{ min: number; max: number; label: string }>
  ): Array<{ range: string; count: number; percentage: number }> {
    const total = values.length;
    return ranges.map(range => {
      const count = values.filter(v => v >= range.min && v < range.max).length;
      return {
        range: range.label,
        count,
        percentage: (count / total) * 100
      };
    });
  }

  private static calculateGiniCoefficient(values: number[]): number {
    const n = values.length;
    if (n === 0) return 0;

    const sortedValues = [...values].sort((a, b) => a - b);
    const mean = sortedValues.reduce((sum, val) => sum + val, 0) / n;
    
    if (mean === 0) return 0;

    let gini = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        gini += Math.abs(sortedValues[i] - sortedValues[j]);
      }
    }

    return gini / (2 * n * n * mean);
  }

  private static async estimateInflationRate(serverId: string): Promise<number> {
    // Simulation simple - dans un vrai système, comparer avec données historiques
    const snapshot = await this.getEconomySnapshot(serverId);
    const baseInflation = 0.02; // 2% de base
    
    // Plus d'inégalité = plus d'inflation
    const inequalityFactor = snapshot.healthIndicators.giniCoefficient * 0.05;
    
    return Math.min(baseInflation + inequalityFactor, 0.15); // Max 15%
  }

  private static calculateLiquidityRatio(players: any[]): number {
    const totalLiquid = players.reduce((sum, p) => sum + p.gold + p.gems, 0);
    const totalAssets = players.reduce((sum, p) => 
      sum + p.gold + p.gems + p.paidGems + (p.heroes.length * 1000), 0
    );
    
    return totalAssets > 0 ? totalLiquid / totalAssets : 0;
  }

  private static calculateEconomyHealthScore(snapshot: IEconomySnapshot): number {
    let score = 100;

    // Pénaliser l'inégalité excessive
    if (snapshot.healthIndicators.giniCoefficient > 0.5) {
      score -= (snapshot.healthIndicators.giniCoefficient - 0.5) * 100;
    }

    // Pénaliser l'inflation élevée
    if (snapshot.healthIndicators.inflationRate > 0.05) {
      score -= (snapshot.healthIndicators.inflationRate - 0.05) * 200;
    }

    // Pénaliser la faible liquidité
    if (snapshot.healthIndicators.liquidityRatio < 0.3) {
      score -= (0.3 - snapshot.healthIndicators.liquidityRatio) * 100;
    }

    // Bonus pour une distribution équilibrée
    if (snapshot.healthIndicators.giniCoefficient < 0.3) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private static parseCondition(condition: string): any {
    // Parser simple pour les conditions comme "level >= 10", "vipLevel >= 3"
    const query: any = {};
    
    if (condition.includes('level >=')) {
      const value = parseInt(condition.split('>=')[1].trim());
      query.level = { $gte: value };
    } else if (condition.includes('level <=')) {
      const value = parseInt(condition.split('<=')[1].trim());
      query.level = { $lte: value };
    } else if (condition.includes('vipLevel >=')) {
      const value = parseInt(condition.split('>=')[1].trim());
      query.vipLevel = { $gte: value };
    } else if (condition.includes('vipLevel <=')) {
      const value = parseInt(condition.split('<=')[1].trim());
      query.vipLevel = { $lte: value };
    } else if (condition.includes('gold >')) {
      const value = parseInt(condition.split('>')[1].trim());
      query.gold = { $gt: value };
    } else if (condition.includes('isNewPlayer')) {
      query.isNewPlayer = condition.includes('true');
    }
    
    return query;
  }

  private static generateMockTransactions(player: any, riskFactors: any): Array<{
    type: string;
    amount: number;
    currency: string;
    timestamp: Date;
    suspicious: boolean;
  }> {
    const transactions = [];
    const now = new Date();
    
    // Générer des transactions simulées basées sur les facteurs de risque
    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
      let suspicious = false;
      
      if (riskFactors.rapidGoldGain && Math.random() > 0.7) {
        transactions.push({
          type: 'gold_gain',
          amount: Math.floor(Math.random() * 100000) + 50000,
          currency: 'gold',
          timestamp,
          suspicious: true
        });
      } else if (riskFactors.suspiciousGemsGain && Math.random() > 0.8) {
        transactions.push({
          type: 'gems_gain',
          amount: Math.floor(Math.random() * 5000) + 1000,
          currency: 'gems',
          timestamp,
          suspicious: true
        });
      } else {
        // Transaction normale
        const types = ['battle_reward', 'quest_complete', 'shop_purchase', 'daily_bonus'];
        const type = types[Math.floor(Math.random() * types.length)];
        const currency = Math.random() > 0.7 ? 'gems' : 'gold';
        const amount = currency === 'gold' 
          ? Math.floor(Math.random() * 5000) + 100
          : Math.floor(Math.random() * 100) + 10;
          
        transactions.push({
          type,
          amount,
          currency,
          timestamp,
          suspicious: false
        });
      }
    }
    
    return transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // ===== MÉTHODES PUBLIQUES UTILITAIRES =====

  /**
   * Vérifier les permissions pour les actions économiques
   */
  static async checkEconomyPermission(
    adminId: string,
    action: 'view' | 'modify' | 'global_action' | 'compensate'
  ): Promise<boolean> {
    try {
      const admin = await Account.findOne({ accountId: adminId, adminEnabled: true });
      if (!admin || !admin.isAdmin()) {
        return false;
      }

      const permissionMap = {
        'view': 'economy.view',
        'modify': 'economy.modify',
        'global_action': 'economy.modify',
        'compensate': 'economy.modify'
      };

      return admin.hasAdminPermission(permissionMap[action] as AdminPermission);
    } catch (error) {
      console.error('Check economy permission error:', error);
      return false;
    }
  }

  /**
   * Obtenir un résumé rapide de l'économie
   */
  static async getEconomyQuickSummary(): Promise<{
    totalServers: number;
    healthyServers: number;
    serversWithAnomalies: number;
    globalPlayerCount: number;
    globalWealthDistribution: {
      totalGold: number;
      totalGems: number;
      totalPaidGems: number;
    };
    lastUpdated: Date;
  }> {
    try {
      const servers = await Player.distinct('serverId');
      let healthyServers = 0;
      let serversWithAnomalies = 0;
      let globalPlayerCount = 0;
      let totalGold = 0;
      let totalGems = 0;
      let totalPaidGems = 0;

      for (const serverId of servers) {
        try {
          const [snapshot, anomalies] = await Promise.all([
            this.getEconomySnapshot(serverId),
            this.detectEconomyAnomalies(serverId)
          ]);

          globalPlayerCount += snapshot.totalPlayers;
          totalGold += snapshot.currencies.gold.total;
          totalGems += snapshot.currencies.gems.total;
          totalPaidGems += snapshot.currencies.paidGems.total;

          if (anomalies.length === 0 && snapshot.healthIndicators.economyScore > 70) {
            healthyServers++;
          } else {
            serversWithAnomalies++;
          }
        } catch (error) {
          console.warn(`Failed to analyze server ${serverId}:`, error);
          serversWithAnomalies++;
        }
      }

      return {
        totalServers: servers.length,
        healthyServers,
        serversWithAnomalies,
        globalPlayerCount,
        globalWealthDistribution: {
          totalGold,
          totalGems,
          totalPaidGems
        },
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Get economy quick summary error:', error);
      throw new Error('Failed to get economy quick summary');
    }
  }

  /**
   * Simuler l'impact d'une action économique avant exécution
   */
  static async simulateEconomyAction(
    action: IGlobalEconomyAction
  ): Promise<{
    estimatedAffectedPlayers: number;
    estimatedImpact: {
      totalAmountChanged: number;
      averageChangePerPlayer: number;
      percentageOfPlayerbase: number;
    };
    riskAssessment: {
      level: 'low' | 'medium' | 'high' | 'critical';
      warnings: string[];
      recommendations: string[];
    };
  }> {
    try {
      let query: any = { serverId: action.serverId };
      
      if (action.parameters.condition) {
        query = { ...query, ...this.parseCondition(action.parameters.condition) };
      }

      const targetPlayers = await Player.find(query).select(action.currency);
      const totalPlayers = await Player.countDocuments({ serverId: action.serverId });

      let totalAmountChanged = 0;
      const warnings: string[] = [];
      const recommendations: string[] = [];

      // Calculer l'impact estimé
      for (const player of targetPlayers) {
        const currentValue = player[action.currency];
        
        switch (action.action) {
          case 'distribute':
            if (action.parameters.amount) {
              totalAmountChanged += action.parameters.amount;
            }
            break;
          case 'drain':
            if (action.parameters.amount) {
              totalAmountChanged += Math.min(currentValue, action.parameters.amount);
            } else if (action.parameters.percentage) {
              totalAmountChanged += Math.floor(currentValue * (action.parameters.percentage / 100));
            }
            break;
          case 'multiply':
            if (action.parameters.multiplier) {
              totalAmountChanged += Math.abs(currentValue * action.parameters.multiplier - currentValue);
            }
            break;
        }
      }

      // Évaluation des risques
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      const percentageAffected = (targetPlayers.length / totalPlayers) * 100;

      if (percentageAffected > 90) {
        riskLevel = 'high';
        warnings.push('Action affects more than 90% of players');
      }

      if (action.action === 'drain' && action.parameters.percentage && action.parameters.percentage > 50) {
        riskLevel = 'critical';
        warnings.push('Draining more than 50% of currency is very risky');
      }

      if (totalAmountChanged > 1000000 && action.currency === 'gold') {
        riskLevel = riskLevel === 'critical' ? 'critical' : 'high';
        warnings.push('Large amount of gold will be affected (>1M)');
      }

      if (action.action === 'multiply' && action.parameters.multiplier && action.parameters.multiplier > 2) {
        riskLevel = 'medium';
        warnings.push('High multiplication factor may cause inflation');
        recommendations.push('Consider monitoring economy health after action');
      }

      if (targetPlayers.length < 10) {
        recommendations.push('Very few players affected - consider if this is intended');
      }

      if (action.action === 'distribute' && !action.parameters.condition) {
        recommendations.push('Consider adding conditions to target specific player groups');
      }

      return {
        estimatedAffectedPlayers: targetPlayers.length,
        estimatedImpact: {
          totalAmountChanged,
          averageChangePerPlayer: targetPlayers.length > 0 ? totalAmountChanged / targetPlayers.length : 0,
          percentageOfPlayerbase: percentageAffected
        },
        riskAssessment: {
          level: riskLevel,
          warnings,
          recommendations
        }
      };

    } catch (error) {
      console.error('Simulate economy action error:', error);
      throw new Error('Failed to simulate economy action');
    }
  }
}

export default EconomyService;

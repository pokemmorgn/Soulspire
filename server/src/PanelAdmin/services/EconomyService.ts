import mongoose from 'mongoose';
import Account from '../../models/Account';
import Player from '../../models/Player';
import AuditLog from '../models/AuditLog';
import { AdminRole, AdminPermission } from '../types/adminTypes';

interface IEconomyAlert {
  type: 'currency_spike' | 'impossible_progress' | 'suspicious_purchases' | 'currency_manipulation' | 'progress_skip';
  severity: 'low' | 'medium' | 'high' | 'critical';
  accountId: string;
  username: string;
  serverId?: string;
  playerId?: string;
  details: any;
  timestamp: Date;
  autoAction?: 'flag' | 'suspend' | 'investigate';
}

interface IEconomyStats {
  totalCurrency: {
    gold: number;
    gems: number;
    paidGems: number;
    tickets: number;
  };
  circulation: {
    dailySpent: any;
    dailyEarned: any;
    inflation: number;
  };
  players: {
    f2p: number;
    spenders: number;
    whales: number;
    averageSpending: number;
  };
  alerts: {
    total: number;
    critical: number;
    recent: number;
  };
}

interface ICheaterDetection {
  accountId: string;
  username: string;
  serverId: string;
  suspicionLevel: number; // 0-100
  flags: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    evidence: any;
    timestamp: Date;
  }>;
  recommendations: string[];
}

export class EconomyService {

  static async getEconomyOverview(): Promise<IEconomyStats> {
    try {
      const [currencyStats, playerTypes, alertsData] = await Promise.all([
        this.getTotalCurrencyInCirculation(),
        this.getPlayerSpendingDistribution(),
        this.getRecentAlertsCount()
      ]);

      return {
        totalCurrency: currencyStats,
        circulation: await this.getCurrencyCirculation(),
        players: playerTypes,
        alerts: alertsData
      };
    } catch (error) {
      console.error('Get economy overview error:', error);
      throw new Error('Failed to get economy overview');
    }
  }

  static async detectCheaters(serverId?: string): Promise<ICheaterDetection[]> {
    try {
      const query = serverId ? { serverId } : {};
      const players = await Player.find(query).limit(1000);
      const cheaters: ICheaterDetection[] = [];

      for (const player of players) {
        const detection = await this.analyzePlayerForCheating(player);
        if (detection.suspicionLevel >= 60) {
          cheaters.push(detection);
        }
      }

      cheaters.sort((a, b) => b.suspicionLevel - a.suspicionLevel);
      return cheaters.slice(0, 50);
    } catch (error) {
      console.error('Detect cheaters error:', error);
      throw new Error('Failed to detect cheaters');
    }
  }

  static async flagSuspiciousActivity(): Promise<IEconomyAlert[]> {
    try {
      const alerts: IEconomyAlert[] = [];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [currencySpikes, progressAnomalies, purchaseAnomalies] = await Promise.all([
        this.detectCurrencySpikes(yesterday),
        this.detectProgressAnomalies(yesterday),
        this.detectPurchaseAnomalies(yesterday)
      ]);

      alerts.push(...currencySpikes, ...progressAnomalies, ...purchaseAnomalies);
      
      for (const alert of alerts.filter(a => a.severity === 'critical')) {
        await this.createEconomyAuditLog(alert);
      }

      return alerts.sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity));
    } catch (error) {
      console.error('Flag suspicious activity error:', error);
      return [];
    }
  }

  static async analyzePlayerEconomy(accountId: string): Promise<{
    account: any;
    characters: any[];
    economyHealth: {
      score: number;
      flags: string[];
      recommendations: string[];
    };
    spending: {
      total: number;
      byServer: any[];
      efficiency: number;
    };
    currency: {
      byServer: any[];
      totalValue: number;
      suspiciousTransactions: any[];
    };
  }> {
    try {
      const [account, characters] = await Promise.all([
        Account.findOne({ accountId }),
        Player.find({ accountId })
      ]);

      if (!account) throw new Error('Account not found');

      const economyHealth = await this.calculateEconomyHealth(account, characters);
      const spending = this.analyzeSpendingPatterns(account, characters);
      const currency = await this.analyzeCurrencyDistribution(characters);

      return {
        account: {
          accountId: account.accountId,
          username: account.username,
          totalSpentUSD: account.totalPurchasesUSD,
          accountAge: Math.floor((Date.now() - (account as any).createdAt.getTime()) / (1000 * 60 * 60 * 24))
        },
        characters: characters.map(char => ({
          serverId: char.serverId,
          level: char.level,
          vipLevel: char.vipLevel,
          currencies: {
            gold: char.gold,
            gems: char.gems,
            paidGems: char.paidGems,
            tickets: char.tickets
          },
          totalSpent: char.totalSpentUSDOnServer,
          progressionSpeed: this.calculateProgressionSpeed(char)
        })),
        economyHealth,
        spending,
        currency
      };
    } catch (error) {
      console.error('Analyze player economy error:', error);
      throw new Error('Failed to analyze player economy');
    }
  }

  static async getServerEconomyComparison(): Promise<any[]> {
    try {
      const serverStats = await Player.aggregate([
        {
          $group: {
            _id: '$serverId',
            playerCount: { $sum: 1 },
            avgLevel: { $avg: '$level' },
            avgGold: { $avg: '$gold' },
            avgGems: { $avg: '$gems' },
            totalSpent: { $sum: '$totalSpentUSDOnServer' },
            avgVip: { $avg: '$vipLevel' },
            whales: { $sum: { $cond: [{ $gt: ['$totalSpentUSDOnServer', 100] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return serverStats.map(server => ({
        serverId: server._id,
        playerCount: server.playerCount,
        averages: {
          level: Math.round(server.avgLevel),
          gold: Math.round(server.avgGold),
          gems: Math.round(server.avgGems),
          vipLevel: Math.round(server.avgVip * 10) / 10
        },
        economy: {
          totalSpent: server.totalSpent,
          arpu: server.playerCount > 0 ? server.totalSpent / server.playerCount : 0,
          whaleCount: server.whales,
          whalePercentage: server.playerCount > 0 ? (server.whales / server.playerCount) * 100 : 0
        },
        healthScore: this.calculateServerHealthScore(server)
      }));
    } catch (error) {
      console.error('Get server economy comparison error:', error);
      return [];
    }
  }

  static async correctEconomyIssue(
    type: 'currency_reset' | 'progress_rollback' | 'purchase_refund',
    targetId: string,
    adminId: string,
    reason: string,
    data: any
  ): Promise<{ success: boolean; message: string; changes: any }> {
    try {
      let result: any = { success: false, message: '', changes: {} };

      switch (type) {
        case 'currency_reset':
          result = await this.resetSuspiciousCurrency(targetId, data, adminId, reason);
          break;
        case 'progress_rollback':
          result = await this.rollbackProgress(targetId, data, adminId, reason);
          break;
        case 'purchase_refund':
          result = await this.refundPurchase(targetId, data, adminId, reason);
          break;
      }

      await this.createEconomyAuditLog({
        type: 'currency_manipulation',
        severity: 'high',
        accountId: targetId,
        username: 'system',
        details: { correctionType: type, reason, changes: result.changes },
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      console.error('Correct economy issue error:', error);
      throw new Error('Failed to correct economy issue');
    }
  }

  // DÉTECTION DE TRICHEURS
  private static async analyzePlayerForCheating(player: any): Promise<ICheaterDetection> {
    const flags: any[] = [];
    let suspicionLevel = 0;

    const account = await Account.findOne({ accountId: player.accountId });
    const accountAge = account ? Math.floor((Date.now() - (account as any).createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // Progression trop rapide
    const expectedLevel = Math.min(accountAge * 2, 50);
    if (player.level > expectedLevel * 2) {
      flags.push({
        type: 'rapid_progression',
        severity: 'high',
        description: `Level ${player.level} too high for account age (${accountAge} days)`,
        evidence: { level: player.level, accountAge, expected: expectedLevel },
        timestamp: new Date()
      });
      suspicionLevel += 25;
    }

    // Currency suspecte
    const expectedGold = player.level * 1000;
    if (player.gold > expectedGold * 10) {
      flags.push({
        type: 'excessive_currency',
        severity: 'critical',
        description: `Gold amount ${player.gold} extremely high for level ${player.level}`,
        evidence: { gold: player.gold, level: player.level, expected: expectedGold },
        timestamp: new Date()
      });
      suspicionLevel += 35;
    }

    // Gems sans achat
    if (player.gems > 10000 && player.totalSpentUSDOnServer === 0) {
      flags.push({
        type: 'suspicious_gems',
        severity: 'high',
        description: `High gem count (${player.gems}) with no purchases`,
        evidence: { gems: player.gems, totalSpent: player.totalSpentUSDOnServer },
        timestamp: new Date()
      });
      suspicionLevel += 20;
    }

    // Progression world impossible
    const maxPossibleWorld = Math.min(Math.floor(player.level / 5), 20);
    if (player.world > maxPossibleWorld + 3) {
      flags.push({
        type: 'impossible_world',
        severity: 'critical',
        description: `World ${player.world} impossible for level ${player.level}`,
        evidence: { world: player.world, level: player.level, maxPossible: maxPossibleWorld },
        timestamp: new Date()
      });
      suspicionLevel += 30;
    }

    // Héros collection suspecte
    if (player.heroes.length > player.level * 0.5 + 10) {
      flags.push({
        type: 'excessive_heroes',
        severity: 'medium',
        description: `Too many heroes (${player.heroes.length}) for level ${player.level}`,
        evidence: { heroCount: player.heroes.length, level: player.level },
        timestamp: new Date()
      });
      suspicionLevel += 15;
    }

    // VIP sans dépenses
    if (player.vipLevel > 5 && player.totalSpentUSDOnServer < player.vipLevel * 10) {
      flags.push({
        type: 'vip_without_spending',
        severity: 'high',
        description: `VIP ${player.vipLevel} with only $${player.totalSpentUSDOnServer} spent`,
        evidence: { vipLevel: player.vipLevel, totalSpent: player.totalSpentUSDOnServer },
        timestamp: new Date()
      });
      suspicionLevel += 25;
    }

    const recommendations = this.generateRecommendations(flags, suspicionLevel);

    return {
      accountId: player.accountId,
      username: account?.username || 'Unknown',
      serverId: player.serverId,
      suspicionLevel: Math.min(suspicionLevel, 100),
      flags,
      recommendations
    };
  }

  private static async detectCurrencySpikes(since: Date): Promise<IEconomyAlert[]> {
    const alerts: IEconomyAlert[] = [];
    
    const suspiciousPlayers = await Player.find({
      $or: [
        { gold: { $gt: 1000000 } },
        { gems: { $gt: 50000 } },
        { tickets: { $gt: 1000 } }
      ],
      lastSeenAt: { $gte: since }
    });

    for (const player of suspiciousPlayers) {
      const account = await Account.findOne({ accountId: player.accountId });
      if (!account) continue;

      alerts.push({
        type: 'currency_spike',
        severity: 'high',
        accountId: player.accountId,
        username: account.username,
        serverId: player.serverId,
        playerId: player.playerId,
        details: {
          gold: player.gold,
          gems: player.gems,
          tickets: player.tickets,
          level: player.level
        },
        timestamp: new Date(),
        autoAction: 'investigate'
      });
    }

    return alerts;
  }

  private static async detectProgressAnomalies(since: Date): Promise<IEconomyAlert[]> {
    const alerts: IEconomyAlert[] = [];
    
    const rapidProgressors = await Player.find({
      world: { $gt: 15 },
      level: { $lt: 50 },
      lastSeenAt: { $gte: since }
    });

    for (const player of rapidProgressors) {
      const account = await Account.findOne({ accountId: player.accountId });
      if (!account) continue;

      alerts.push({
        type: 'impossible_progress',
        severity: 'critical',
        accountId: player.accountId,
        username: account.username,
        serverId: player.serverId,
        details: {
          world: player.world,
          level: player.level,
          accountAge: Math.floor((Date.now() - (account as any).createdAt.getTime()) / (1000 * 60 * 60 * 24))
        },
        timestamp: new Date(),
        autoAction: 'suspend'
      });
    }

    return alerts;
  }

  private static async detectPurchaseAnomalies(since: Date): Promise<IEconomyAlert[]> {
    const alerts: IEconomyAlert[] = [];
    
    const suspiciousAccounts = await Account.find({
      totalPurchasesUSD: { $gt: 1000 },
      $expr: {
        $gt: [
          { $size: { $ifNull: ['$purchaseHistory', []] } },
          50
        ]
      }
    });

    for (const account of suspiciousAccounts) {
      const recentPurchases = account.purchaseHistory.filter(
        p => p.purchaseDate >= since && p.status === 'completed'
      );

      if (recentPurchases.length > 20) {
        alerts.push({
          type: 'suspicious_purchases',
          severity: 'medium',
          accountId: account.accountId,
          username: account.username,
          details: {
            recentPurchases: recentPurchases.length,
            totalSpent: account.totalPurchasesUSD,
            avgPurchaseAmount: recentPurchases.reduce((sum, p) => sum + p.priceUSD, 0) / recentPurchases.length
          },
          timestamp: new Date(),
          autoAction: 'flag'
        });
      }
    }

    return alerts;
  }

  // UTILITAIRES
  private static async getTotalCurrencyInCirculation(): Promise<any> {
    const result = await Player.aggregate([
      {
        $group: {
          _id: null,
          totalGold: { $sum: '$gold' },
          totalGems: { $sum: '$gems' },
          totalPaidGems: { $sum: '$paidGems' },
          totalTickets: { $sum: '$tickets' }
        }
      }
    ]);

    return result[0] || { totalGold: 0, totalGems: 0, totalPaidGems: 0, totalTickets: 0 };
  }

  private static async getCurrencyCirculation(): Promise<any> {
    return {
      dailySpent: { gold: 0, gems: 0, tickets: 0 },
      dailyEarned: { gold: 0, gems: 0, tickets: 0 },
      inflation: 0
    };
  }

  private static async getPlayerSpendingDistribution(): Promise<any> {
    const result = await Account.aggregate([
      {
        $group: {
          _id: null,
          f2p: { $sum: { $cond: [{ $eq: ['$totalPurchasesUSD', 0] }, 1, 0] } },
          spenders: { $sum: { $cond: [{ $and: [{ $gt: ['$totalPurchasesUSD', 0] }, { $lte: ['$totalPurchasesUSD', 100] }] }, 1, 0] } },
          whales: { $sum: { $cond: [{ $gt: ['$totalPurchasesUSD', 100] }, 1, 0] } },
          avgSpending: { $avg: '$totalPurchasesUSD' }
        }
      }
    ]);

    return result[0] || { f2p: 0, spenders: 0, whales: 0, avgSpending: 0 };
  }

  private static async getRecentAlertsCount(): Promise<any> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const total = await AuditLog.countDocuments({
      action: { $in: ['player.ban', 'economy.modify_shop'] },
      severity: { $in: ['high', 'critical'] }
    });

    return { total, critical: 0, recent: 0 };
  }

  private static calculateProgressionSpeed(player: any): number {
    const accountAge = Math.max(1, Math.floor((Date.now() - (player as any).createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    return player.level / accountAge;
  }

  private static async calculateEconomyHealth(account: any, characters: any[]): Promise<any> {
    let score = 100;
    const flags: string[] = [];
    const recommendations: string[] = [];

    const totalCurrency = characters.reduce((sum, char) => sum + char.gold + char.gems * 10, 0);
    const totalSpent = account.totalPurchasesUSD;

    if (totalCurrency > totalSpent * 1000 && totalSpent > 0) {
      score -= 20;
      flags.push('Currency to spending ratio suspicious');
      recommendations.push('Investigate currency sources');
    }

    return { score: Math.max(score, 0), flags, recommendations };
  }

  private static analyzeSpendingPatterns(account: any, characters: any[]): any {
    const total = account.totalPurchasesUSD;
    const byServer = characters.map(char => ({
      serverId: char.serverId,
      spent: char.totalSpentUSDOnServer
    }));

    return {
      total,
      byServer,
      efficiency: total > 0 ? characters.reduce((sum, char) => sum + char.level, 0) / total : 0
    };
  }

  private static async analyzeCurrencyDistribution(characters: any[]): Promise<any> {
    const byServer = characters.map(char => ({
      serverId: char.serverId,
      gold: char.gold,
      gems: char.gems,
      paidGems: char.paidGems,
      tickets: char.tickets
    }));

    const totalValue = characters.reduce((sum, char) => 
      sum + char.gold + (char.gems * 10) + (char.paidGems * 10) + (char.tickets * 100), 0
    );

    return {
      byServer,
      totalValue,
      suspiciousTransactions: []
    };
  }

  private static calculateServerHealthScore(serverData: any): number {
    let score = 100;
    
    if (serverData.avgLevel < 10) score -= 20;
    if (serverData.avgGold > 100000) score -= 15;
    if (serverData.whales / serverData.playerCount > 0.1) score -= 10;
    
    return Math.max(score, 0);
  }

  private static generateRecommendations(flags: any[], suspicionLevel: number): string[] {
    const recommendations: string[] = [];

    if (suspicionLevel >= 80) {
      recommendations.push('Immediate investigation required');
      recommendations.push('Consider temporary account suspension');
    } else if (suspicionLevel >= 60) {
      recommendations.push('Flag for manual review');
      recommendations.push('Monitor closely for 48 hours');
    } else if (suspicionLevel >= 40) {
      recommendations.push('Add to watchlist');
    }

    if (flags.some(f => f.type === 'excessive_currency')) {
      recommendations.push('Audit currency transaction history');
    }

    if (flags.some(f => f.type === 'impossible_world')) {
      recommendations.push('Check for client-side modifications');
    }

    return recommendations;
  }

  private static getSeverityWeight(severity: string): number {
    const weights = { low: 1, medium: 2, high: 3, critical: 4 };
    return weights[severity as keyof typeof weights] || 0;
  }

  private static async resetSuspiciousCurrency(playerId: string, data: any, adminId: string, reason: string): Promise<any> {
    const player = await Player.findOne({ playerId });
    if (!player) throw new Error('Player not found');

    const oldValues = {
      gold: player.gold,
      gems: player.gems,
      tickets: player.tickets
    };

    player.gold = Math.min(player.gold, data.maxGold || 50000);
    player.gems = Math.min(player.gems, data.maxGems || 5000);
    player.tickets = Math.min(player.tickets, data.maxTickets || 100);

    await player.save();

    return {
      success: true,
      message: 'Currency reset completed',
      changes: { oldValues, newValues: { gold: player.gold, gems: player.gems, tickets: player.tickets } }
    };
  }

  private static async rollbackProgress(playerId: string, data: any, adminId: string, reason: string): Promise<any> {
    const player = await Player.findOne({ playerId });
    if (!player) throw new Error('Player not found');

    const oldValues = {
      level: player.level,
      world: player.world,
      stage: player.stage
    };

    if (data.targetLevel) player.level = Math.min(player.level, data.targetLevel);
    if (data.targetWorld) player.world = Math.min(player.world, data.targetWorld);
    if (data.targetStage) player.stage = Math.min(player.stage, data.targetStage);

    await player.save();

    return {
      success: true,
      message: 'Progress rollback completed',
      changes: { oldValues, newValues: { level: player.level, world: player.world, stage: player.stage } }
    };
  }

  private static async refundPurchase(accountId: string, data: any, adminId: string, reason: string): Promise<any> {
    return {
      success: true,
      message: 'Refund processed (placeholder)',
      changes: { refundAmount: data.amount }
    };
  }

  private static async createEconomyAuditLog(alert: IEconomyAlert): Promise<void> {
    try {
      await AuditLog.createLog({
        adminId: 'system',
        adminUsername: 'economy_system',
        adminRole: 'super_admin',
        action: 'economy.view_transactions',
        resource: 'economy_alert',
        resourceId: alert.accountId,
        details: {
          additionalInfo: {
            alertType: alert.type,
            severity: alert.severity,
            autoAction: alert.autoAction,
            evidence: alert.details
          }
        },
        ipAddress: '127.0.0.1',
        userAgent: 'EconomyService',
        success: true,
        severity: alert.severity === 'critical' ? 'critical' : 'high'
      });
    } catch (error) {
      console.error('Create economy audit log error:', error);
    }
  }
}

export default EconomyService;

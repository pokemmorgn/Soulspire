import mongoose from 'mongoose';
import Account from '../../models/Account';
import Player from '../../models/Player';
import AuditLog from '../models/AuditLog';
import { AdminRole, AdminPermission, AdminAction } from '../types/adminTypes';

// Interfaces pour la gestion des joueurs
interface IPlayerSearchFilter {
  username?: string;
  email?: string;
  serverId?: string;
  level?: { min?: number; max?: number };
  vipLevel?: { min?: number; max?: number };
  totalSpent?: { min?: number; max?: number };
  lastSeenDays?: number; // Jours depuis dernière connexion
  accountStatus?: 'active' | 'suspended' | 'banned' | 'inactive';
  isNewPlayer?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface IPlayerDetails {
  // Informations du compte
  account: {
    accountId: string;
    username: string;
    email?: string;
    accountStatus: string;
    totalSpentUSD: number;
    accountAge: number;
    totalPlaytime: number;
    lastLogin: Date;
    serversPlayed: string[];
  };
  // Informations des personnages par serveur
  characters: Array<{
    serverId: string;
    playerId: string;
    displayName: string;
    level: number;
    world: number;
    stage: number;
    difficulty: string;
    vipLevel: number;
    currencies: {
      gold: number;
      gems: number;
      paidGems: number;
      tickets: number;
    };
    heroes: {
      total: number;
      equipped: number;
      powerScore: number;
    };
    progression: {
      campaignProgress: any;
      towerProgress: any;
      arenaProgress: any;
    };
    lastSeen: Date;
    playtime: number;
    totalSpentOnServer: number;
  }>;
}

interface ICurrencyModification {
  serverId: string;
  playerId: string;
  currency: 'gold' | 'gems' | 'paidGems' | 'tickets';
  amount: number;
  operation: 'add' | 'set' | 'subtract';
  reason: string;
}

interface IPlayerModeration {
  accountId: string;
  action: 'ban' | 'unban' | 'suspend' | 'warn' | 'reset_progress';
  reason: string;
  duration?: number; // en heures pour suspension
  serverId?: string; // pour actions spécifiques à un serveur
  additionalData?: any;
}

export class PlayerManagementService {

  // ===== RECHERCHE ET LISTING =====

  /**
   * Rechercher des joueurs avec filtres avancés
   */
  static async searchPlayers(filter: IPlayerSearchFilter): Promise<{
    players: any[];
    total: number;
    page: number;
    limit: number;
    stats: {
      totalPlayers: number;
      activePlayers: number;
      spendingPlayers: number;
      averageLevel: number;
    };
  }> {
    try {
      const page = filter.page || 1;
      const limit = Math.min(filter.limit || 20, 100);
      const skip = (page - 1) * limit;

      // Construction de la requête Account
      const accountQuery: any = {};
      if (filter.username) {
        accountQuery.username = { $regex: filter.username, $options: 'i' };
      }
      if (filter.email) {
        accountQuery.email = { $regex: filter.email, $options: 'i' };
      }
      if (filter.accountStatus) {
        accountQuery.accountStatus = filter.accountStatus;
      }
      if (filter.totalSpent) {
        accountQuery.totalPurchasesUSD = {};
        if (filter.totalSpent.min !== undefined) {
          accountQuery.totalPurchasesUSD.$gte = filter.totalSpent.min;
        }
        if (filter.totalSpent.max !== undefined) {
          accountQuery.totalPurchasesUSD.$lte = filter.totalSpent.max;
        }
      }
      if (filter.lastSeenDays) {
        const cutoff = new Date(Date.now() - filter.lastSeenDays * 24 * 60 * 60 * 1000);
        accountQuery.lastLoginAt = { $gte: cutoff };
      }

      // Pipeline d'agrégation pour combiner Account et Player
      const pipeline: any[] = [
        { $match: accountQuery },
        {
          $lookup: {
            from: 'players',
            localField: 'accountId',
            foreignField: 'accountId',
            as: 'characters'
          }
        }
      ];

      // Filtres spécifiques aux joueurs
      if (filter.serverId || filter.level || filter.vipLevel || filter.isNewPlayer !== undefined) {
        const playerMatch: any = {};
        
        if (filter.serverId) {
          playerMatch['characters.serverId'] = filter.serverId;
        }
        if (filter.level) {
          if (filter.level.min !== undefined) {
            playerMatch['characters.level'] = { $gte: filter.level.min };
          }
          if (filter.level.max !== undefined) {
            playerMatch['characters.level'] = { 
              ...playerMatch['characters.level'], 
              $lte: filter.level.max 
            };
          }
        }
        if (filter.vipLevel) {
          if (filter.vipLevel.min !== undefined) {
            playerMatch['characters.vipLevel'] = { $gte: filter.vipLevel.min };
          }
          if (filter.vipLevel.max !== undefined) {
            playerMatch['characters.vipLevel'] = { 
              ...playerMatch['characters.vipLevel'], 
              $lte: filter.vipLevel.max 
            };
          }
        }
        if (filter.isNewPlayer !== undefined) {
          playerMatch['characters.isNewPlayer'] = filter.isNewPlayer;
        }

        pipeline.push({ $match: playerMatch });
      }

      // Projection et formatage
      pipeline.push({
        $project: {
          accountId: 1,
          username: 1,
          email: 1,
          accountStatus: 1,
          totalPurchasesUSD: 1,
          lastLoginAt: 1,
          createdAt: 1,
          characters: {
            $map: {
              input: '$characters',
              as: 'char',
              in: {
                serverId: '$$char.serverId',
                playerId: '$$char.playerId',
                displayName: '$$char.displayName',
                level: '$$char.level',
                world: '$$char.world',
                vipLevel: '$$char.vipLevel',
                gold: '$$char.gold',
                gems: '$$char.gems',
                paidGems: '$$char.paidGems',
                lastSeenAt: '$$char.lastSeenAt',
                totalSpentUSDOnServer: '$$char.totalSpentUSDOnServer',
                heroCount: { $size: '$$char.heroes' },
                isNewPlayer: '$$char.isNewPlayer'
              }
            }
          }
        }
      });

      // Tri
      const sortField = filter.sortBy || 'lastLoginAt';
      const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;
      pipeline.push({ $sort: { [sortField]: sortOrder } });

      // Pagination
      pipeline.push({ $skip: skip }, { $limit: limit });

      const [results, totalResults, globalStats] = await Promise.all([
        Account.aggregate(pipeline),
        Account.aggregate([...pipeline.slice(0, -2), { $count: 'total' }]),
        this.getGlobalPlayerStats()
      ]);

      const total = totalResults[0]?.total || 0;

      return {
        players: results.map(this.formatPlayerSearchResult),
        total,
        page,
        limit,
        stats: globalStats
      };

    } catch (error) {
      console.error('Search players error:', error);
      throw new Error('Failed to search players');
    }
  }

  /**
   * Obtenir les détails complets d'un joueur
   */
  static async getPlayerDetails(accountId: string): Promise<IPlayerDetails | null> {
    try {
      const [account, characters] = await Promise.all([
        Account.findOne({ accountId }),
        Player.find({ accountId })
      ]);

      if (!account) {
        return null;
      }

      const playerDetails: IPlayerDetails = {
        account: {
          accountId: account.accountId,
          username: account.username,
          email: account.email,
          accountStatus: account.accountStatus,
          totalSpentUSD: account.totalPurchasesUSD,
          accountAge: (account as any).createdAt ? 
            Math.floor((Date.now() - (account as any).createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
          totalPlaytime: account.totalPlaytimeMinutes,
          lastLogin: account.lastLoginAt,
          serversPlayed: account.serverList
        },
        characters: characters.map(char => ({
          serverId: char.serverId,
          playerId: char.playerId,
          displayName: char.displayName,
          level: char.level,
          world: char.world,
          stage: char.stage,
          difficulty: char.difficulty,
          vipLevel: char.vipLevel,
          currencies: {
            gold: char.gold,
            gems: char.gems,
            paidGems: char.paidGems,
            tickets: char.tickets
          },
          heroes: {
            total: char.heroes.length,
            equipped: char.getEquippedHeroes().length,
            powerScore: char.calculatePowerScore()
          },
          progression: {
            campaignProgress: char.campaignProgress,
            towerProgress: char.towerProgress,
            arenaProgress: char.arenaProgress
          },
          lastSeen: char.lastSeenAt,
          playtime: char.playtimeMinutes,
          totalSpentOnServer: char.totalSpentUSDOnServer
        }))
      };

      return playerDetails;

    } catch (error) {
      console.error('Get player details error:', error);
      throw new Error('Failed to get player details');
    }
  }

  // ===== MODÉRATION DES JOUEURS =====

  /**
   * Modérer un joueur (ban, suspend, warn, etc.)
   */
  static async moderatePlayer(
    moderation: IPlayerModeration,
    moderatorId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const [account, moderator] = await Promise.all([
        Account.findOne({ accountId: moderation.accountId }),
        Account.findOne({ accountId: moderatorId, adminEnabled: true })
      ]);

      if (!account) {
        throw new Error('Player account not found');
      }

      if (!moderator || !moderator.isAdmin()) {
        throw new Error('Moderator not found or insufficient privileges');
      }

      let result: { success: boolean; message: string };
      let auditAction: AdminAction;
      let auditDetails: any = {
        targetAccount: account.username,
        reason: moderation.reason
      };

      switch (moderation.action) {
        case 'ban':
          account.accountStatus = 'banned';
          account.suspensionReason = moderation.reason;
          result = { success: true, message: `Account ${account.username} has been banned` };
          auditAction = 'player.ban';
          break;

        case 'unban':
          account.accountStatus = 'active';
          account.suspensionReason = undefined;
          account.suspensionExpiresAt = undefined;
          result = { success: true, message: `Account ${account.username} has been unbanned` };
          auditAction = 'player.unban';
          break;

        case 'suspend':
          if (!moderation.duration) {
            throw new Error('Suspension duration is required');
          }
          account.accountStatus = 'suspended';
          account.suspensionReason = moderation.reason;
          account.suspensionExpiresAt = new Date(Date.now() + moderation.duration * 60 * 60 * 1000);
          auditDetails.duration = moderation.duration;
          result = { 
            success: true, 
            message: `Account ${account.username} suspended for ${moderation.duration} hours` 
          };
          auditAction = 'player.ban'; // Utiliser l'action ban pour suspension
          break;

        case 'warn':
          // Pour l'instant, juste logger l'avertissement
          result = { success: true, message: `Warning issued to ${account.username}` };
          auditAction = 'player.view_details';
          break;

        case 'reset_progress':
          if (moderation.serverId) {
            // Réinitialiser un personnage spécifique
            const player = await Player.findOne({ 
              accountId: moderation.accountId, 
              serverId: moderation.serverId 
            });
            if (player) {
              await this.resetPlayerProgress(player, moderation.additionalData);
              auditDetails.serverId = moderation.serverId;
            }
          }
          result = { success: true, message: `Progress reset for ${account.username}` };
          auditAction = 'player.reset_account';
          break;

        default:
          throw new Error('Invalid moderation action');
      }

      await account.save();

      // Logger l'action de modération
      await AuditLog.createLog({
        adminId: moderatorId,
        adminUsername: moderator.username,
        adminRole: moderator.adminRole!,
        action: auditAction,
        resource: 'player_account',
        resourceId: moderation.accountId,
        details: { additionalInfo: auditDetails },
        ipAddress,
        userAgent,
        success: true,
        severity: moderation.action === 'ban' ? 'critical' : 'high'
      });

      return result;

    } catch (error) {
      console.error('Moderate player error:', error);
      throw new Error(`Failed to moderate player: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===== GESTION DES MONNAIES =====

  /**
   * Modifier les monnaies d'un joueur
   */
  static async modifyCurrency(
    modification: ICurrencyModification,
    adminId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; oldValue: number; newValue: number; message: string }> {
    try {
      const [player, admin] = await Promise.all([
        Player.findOne({ 
          playerId: modification.playerId, 
          serverId: modification.serverId 
        }),
        Account.findOne({ accountId: adminId, adminEnabled: true })
      ]);

      if (!player) {
        throw new Error('Player not found');
      }

      if (!admin || !admin.hasAdminPermission('economy.modify')) {
        throw new Error('Insufficient permissions to modify currency');
      }

      const oldValue = player[modification.currency];
      let newValue: number;

      switch (modification.operation) {
        case 'add':
          newValue = oldValue + modification.amount;
          player[modification.currency] = Math.max(0, newValue);
          break;

        case 'subtract':
          newValue = oldValue - modification.amount;
          player[modification.currency] = Math.max(0, newValue);
          break;

        case 'set':
          newValue = modification.amount;
          player[modification.currency] = Math.max(0, newValue);
          break;

        default:
          throw new Error('Invalid operation');
      }

      await player.save();

      // Logger la modification
      await AuditLog.createLog({
        adminId,
        adminUsername: admin.username,
        adminRole: admin.adminRole!,
        action: modification.operation === 'subtract' ? 'player.remove_currency' : 'player.add_currency',
        resource: 'player_currency',
        resourceId: modification.playerId,
        details: {
          additionalInfo: {
            serverId: modification.serverId,
            currency: modification.currency,
            operation: modification.operation,
            amount: modification.amount,
            oldValue,
            newValue: player[modification.currency],
            reason: modification.reason
          }
        },
        ipAddress,
        userAgent,
        success: true,
        severity: 'medium'
      });

      return {
        success: true,
        oldValue,
        newValue: player[modification.currency],
        message: `${modification.currency} ${modification.operation}ed successfully`
      };

    } catch (error) {
      console.error('Modify currency error:', error);
      throw new Error(`Failed to modify currency: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ajouter ou retirer des héros
   */
  static async modifyHeroes(
    playerId: string,
    serverId: string,
    operation: 'add' | 'remove',
    heroId: string,
    adminId: string,
    reason: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const [player, admin] = await Promise.all([
        Player.findOne({ playerId, serverId }),
        Account.findOne({ accountId: adminId, adminEnabled: true })
      ]);

      if (!player) {
        throw new Error('Player not found');
      }

      if (!admin || !admin.hasAdminPermission('heroes.manage')) {
        throw new Error('Insufficient permissions to modify heroes');
      }

      let result: { success: boolean; message: string };
      let auditAction: AdminAction;

      if (operation === 'add') {
        await player.addHero(heroId, 1, 1);
        result = { success: true, message: `Hero ${heroId} added successfully` };
        auditAction = 'player.add_hero';
      } else {
        await player.removeHero(heroId);
        result = { success: true, message: `Hero ${heroId} removed successfully` };
        auditAction = 'player.remove_hero';
      }

      // Logger l'action
      await AuditLog.createLog({
        adminId,
        adminUsername: admin.username,
        adminRole: admin.adminRole!,
        action: auditAction,
        resource: 'player_hero',
        resourceId: playerId,
        details: {
          additionalInfo: {
            serverId,
            heroId,
            operation,
            reason
          }
        },
        ipAddress,
        userAgent,
        success: true,
        severity: 'medium'
      });

      return result;

    } catch (error) {
      console.error('Modify heroes error:', error);
      throw new Error(`Failed to modify heroes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===== STATISTIQUES ET ANALYTICS =====

  /**
   * Obtenir des statistiques globales des joueurs
   */
  static async getGlobalPlayerStats(): Promise<{
    totalPlayers: number;
    activePlayers: number;
    spendingPlayers: number;
    averageLevel: number;
  }> {
    try {
      const [accountStats, playerStats] = await Promise.all([
        Account.aggregate([
          {
            $group: {
              _id: null,
              totalAccounts: { $sum: 1 },
              activeAccounts: {
                $sum: { $cond: [{ $eq: ['$accountStatus', 'active'] }, 1, 0] }
              },
              spendingAccounts: {
                $sum: { $cond: [{ $gt: ['$totalPurchasesUSD', 0] }, 1, 0] }
              }
            }
          }
        ]),
        Player.aggregate([
          {
            $group: {
              _id: null,
              totalPlayers: { $sum: 1 },
              averageLevel: { $avg: '$level' }
            }
          }
        ])
      ]);

      const accounts = accountStats[0] || {
        totalAccounts: 0,
        activeAccounts: 0,
        spendingAccounts: 0
      };

      const players = playerStats[0] || {
        totalPlayers: 0,
        averageLevel: 0
      };

      return {
        totalPlayers: players.totalPlayers,
        activePlayers: accounts.activeAccounts,
        spendingPlayers: accounts.spendingAccounts,
        averageLevel: Math.round(players.averageLevel || 0)
      };

    } catch (error) {
      console.error('Get global player stats error:', error);
      return {
        totalPlayers: 0,
        activePlayers: 0,
        spendingPlayers: 0,
        averageLevel: 0
      };
    }
  }

  /**
   * Obtenir les top joueurs par critère
   */
  static async getTopPlayers(
    criteria: 'level' | 'spending' | 'vip' | 'playtime',
    serverId?: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      let sortField: string;
      let collection: any;

      switch (criteria) {
        case 'level':
          collection = Player;
          sortField = 'level';
          break;
        case 'vip':
          collection = Player;
          sortField = 'vipLevel';
          break;
        case 'playtime':
          collection = Player;
          sortField = 'playtimeMinutes';
          break;
        case 'spending':
          collection = Account;
          sortField = 'totalPurchasesUSD';
          break;
        default:
          throw new Error('Invalid criteria');
      }

      const query = serverId && criteria !== 'spending' ? { serverId } : {};
      
      const results = await collection.find(query)
        .sort({ [sortField]: -1 })
        .limit(limit)
        .select(criteria === 'spending' ? 
          'username totalPurchasesUSD accountId' : 
          'displayName level vipLevel playtimeMinutes serverId accountId'
        )
        .exec();

      return results.map((item: any) => ({
        accountId: item.accountId,
        name: item.displayName || item.username,
        value: item[sortField],
        serverId: item.serverId,
        rank: results.indexOf(item) + 1
      }));

    } catch (error) {
      console.error('Get top players error:', error);
      return [];
    }
  }

  // ===== MÉTHODES UTILITAIRES PRIVÉES =====

  /**
   * Formater le résultat de recherche
   */
  private static formatPlayerSearchResult(result: any): any {
    return {
      accountId: result.accountId,
      username: result.username,
      email: result.email,
      accountStatus: result.accountStatus,
      totalSpentUSD: result.totalPurchasesUSD || 0,
      lastLogin: result.lastLoginAt,
      accountAge: result.createdAt ? 
        Math.floor((Date.now() - result.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      charactersCount: result.characters.length,
      characters: result.characters,
      summary: {
        highestLevel: Math.max(...result.characters.map((c: any) => c.level || 0), 0),
        totalSpentAllServers: result.characters.reduce((sum: number, c: any) => 
          sum + (c.totalSpentUSDOnServer || 0), 0),
        lastActivity: result.characters.length > 0 ? 
          new Date(Math.max(...result.characters.map((c: any) => 
            new Date(c.lastSeenAt || 0).getTime()))) : null
      }
    };
  }

  /**
   * Réinitialiser la progression d'un joueur
   */
  private static async resetPlayerProgress(player: any, options: any = {}): Promise<void> {
    if (options.resetLevel) {
      player.level = 1;
      player.experience = 0;
    }

    if (options.resetCampaign) {
      player.world = 1;
      player.stage = 1;
      player.difficulty = 'Normal';
      player.campaignProgress = {
        highestWorld: 1,
        highestStage: 1,
        starsEarned: 0
      };
    }

    if (options.resetCurrency) {
      player.gold = 1000;
      player.gems = 100;
      player.tickets = 5;
      // Ne pas toucher aux paidGems (argent réel)
    }

    if (options.resetHeroes) {
      player.heroes = [];
      player.totalHeroesCollected = 0;
    }

    if (options.resetTower) {
      player.towerProgress = {
        highestFloor: 0,
        lastResetDate: new Date()
      };
    }

    await player.save();
  }

  /**
   * Vérifier les permissions pour une action
   */
  static async checkPlayerManagementPermission(
    adminId: string,
    action: 'view' | 'moderate' | 'currency' | 'heroes' | 'delete'
  ): Promise<boolean> {
    try {
      const admin = await Account.findOne({ accountId: adminId, adminEnabled: true });
      if (!admin || !admin.isAdmin()) {
        return false;
      }

      const permissionMap = {
        'view': 'player.view',
        'moderate': 'player.moderate',
        'currency': 'economy.modify',
        'heroes': 'heroes.manage',
        'delete': 'player.delete'
      };

      return admin.hasAdminPermission(permissionMap[action] as AdminPermission);
    } catch (error) {
      console.error('Check player management permission error:', error);
      return false;
    }
  }
}

export default PlayerManagementService;

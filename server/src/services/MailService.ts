import Mail, { IMailAttachment } from "../models/Mail";
import Player from "../models/Player";
import { EventService } from "./EventService";
import { MissionService } from "./MissionService";

export interface SendMailOptions {
  title: string;
  content: string;
  category: "system" | "reward" | "event" | "maintenance" | "social" | "compensation";
  attachments?: IMailAttachment[];
  senderName?: string;
  expiresInDays?: number;
  priority?: "low" | "normal" | "high" | "urgent";
  scheduledAt?: Date;
}

export interface SendToServerOptions extends SendMailOptions {
  conditions?: {
    minLevel?: number;
    maxLevel?: number;
    vipLevel?: number;
    playerIds?: string[];
  };
}

export interface MailClaimResult {
  success: boolean;
  rewards?: {
    gold?: number;
    gems?: number;
    heroes?: any[];
    materials?: Record<string, number>;
    tickets?: number;
    items?: Record<string, number>;
  };
  error?: string;
  code?: string;
}

export interface MailListResult {
  success: boolean;
  mails?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  summary?: {
    unreadCount: number;
    claimableCount: number;
    totalCount: number;
  };
  error?: string;
}

export class MailService {

  public static async getPlayerMails(
    playerId: string,
    serverId: string,
    options: {
      page?: number;
      limit?: number;
      category?: string;
      unreadOnly?: boolean;
      hasAttachments?: boolean;
    } = {}
  ): Promise<MailListResult> {
    try {
      const { page = 1, limit = 20, category, unreadOnly = false, hasAttachments } = options;
      const offset = (page - 1) * limit;

      const [mails, unreadCount, claimableCount] = await Promise.all([
        (Mail as any).getPlayerMails(playerId, serverId, {
          limit: limit + offset,
          category,
          unreadOnly,
          hasAttachments
        }),
        (Mail as any).getUnreadCount(playerId, serverId),
        (Mail as any).getClaimableCount(playerId, serverId)
      ]);

      const paginatedMails = mails.slice(offset, offset + limit);
      const totalCount = await this.getTotalMailCount(playerId, serverId, { category, unreadOnly, hasAttachments });

      const enrichedMails = paginatedMails.map((mail: any) => ({
        _id: mail._id,
        title: mail.title,
        content: mail.content,
        category: mail.category,
        senderName: mail.senderName,
        hasAttachments: mail.hasAttachments,
        attachmentsSummary: mail.hasAttachments ? this.formatAttachmentsSummary(mail.attachments) : null,
        priority: mail.priority,
        sentAt: mail.sentAt,
        expiresAt: mail.expiresAt,
        isRead: !!mail.isRead,
        isClaimed: !!mail.isClaimed,
        canClaim: mail.hasAttachments && !mail.isClaimed && !this.isExpired(mail.expiresAt),
        timeRemaining: this.getTimeRemaining(mail.expiresAt)
      }));

      return {
        success: true,
        mails: enrichedMails,
        pagination: {
          page,
          limit,
          total: totalCount,
          hasMore: totalCount > page * limit
        },
        summary: {
          unreadCount,
          claimableCount,
          totalCount
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getPlayerMails:", error);
      return { success: false, error: error.message };
    }
  }

  public static async claimMail(
    playerId: string,
    serverId: string,
    mailId: string
  ): Promise<MailClaimResult> {
    try {
      const mail = await Mail.findOne({
        _id: mailId,
        serverId,
        status: "sent",
        expiresAt: { $gt: new Date() },
        $or: [
          { recipientId: playerId },
          { recipientType: "server" },
          { recipientType: "all_servers" }
        ]
      });

      if (!mail) {
        return { success: false, error: "Mail not found or expired", code: "MAIL_NOT_FOUND" };
      }

      if (!mail.hasAttachments) {
        return { success: false, error: "Mail has no attachments", code: "NO_ATTACHMENTS" };
      }

      if (mail.isClaimedBy(playerId)) {
        return { success: false, error: "Mail already claimed", code: "ALREADY_CLAIMED" };
      }

      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const rewards = await this.processAttachments(player, mail.attachments);
      
      await Promise.all([
        mail.markAsClaimed(playerId),
        player.save()
      ]);

      await this.updateProgressTracking(playerId, serverId, mail, rewards);

      console.log(`📧 Mail claimed by ${playerId}: ${mail.title}`);

      return {
        success: true,
        rewards
      };

    } catch (error: any) {
      console.error("❌ Erreur claimMail:", error);
      return { success: false, error: error.message, code: "CLAIM_FAILED" };
    }
  }

  public static async claimAllMails(
    playerId: string,
    serverId: string
  ): Promise<MailClaimResult> {
    try {
      const claimableMails = await Mail.find({
        serverId,
        status: "sent",
        hasAttachments: true,
        expiresAt: { $gt: new Date() },
        $or: [
          { recipientId: playerId },
          { recipientType: "server" },
          { recipientType: "all_servers" }
        ],
        [`claimedBy.${playerId}`]: { $exists: false }
      });

      if (claimableMails.length === 0) {
        return { success: false, error: "No claimable mails found", code: "NO_CLAIMABLE_MAILS" };
      }

      const player = await Player.findOne({ _id: playerId, serverId });
      if (!player) {
        return { success: false, error: "Player not found", code: "PLAYER_NOT_FOUND" };
      }

      const totalRewards = {
        gold: 0,
        gems: 0,
        heroes: [] as any[],
        materials: {} as Record<string, number>,
        tickets: 0,
        items: {} as Record<string, number>
      };

      for (const mail of claimableMails) {
        const rewards = await this.processAttachments(player, mail.attachments);
        this.mergeRewards(totalRewards, rewards);
        await mail.markAsClaimed(playerId);
      }

      await player.save();

      await this.updateProgressTracking(playerId, serverId, null, totalRewards, claimableMails.length);

      console.log(`📧 ${claimableMails.length} mails claimed by ${playerId}`);

      return {
        success: true,
        rewards: totalRewards
      };

    } catch (error: any) {
      console.error("❌ Erreur claimAllMails:", error);
      return { success: false, error: error.message, code: "CLAIM_ALL_FAILED" };
    }
  }

  public static async markAsRead(
    playerId: string,
    serverId: string,
    mailId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const mail = await Mail.findOne({
        _id: mailId,
        serverId,
        $or: [
          { recipientId: playerId },
          { recipientType: "server" },
          { recipientType: "all_servers" }
        ]
      });

      if (!mail) {
        return { success: false, error: "Mail not found" };
      }

      await mail.markAsRead(playerId);
      return { success: true };

    } catch (error: any) {
      console.error("❌ Erreur markAsRead:", error);
      return { success: false, error: error.message };
    }
  }

  public static async sendToPlayer(
    recipientId: string,
    serverId: string,
    options: SendMailOptions
  ): Promise<{ success: boolean; mailId?: string; error?: string }> {
    try {
      const mail = await (Mail as any).sendToPlayer(recipientId, serverId, options);
      
      console.log(`📧 Mail sent to player ${recipientId}: ${options.title}`);
      
      return { success: true, mailId: (mail._id as any).toString() };

    } catch (error: any) {
      console.error("❌ Erreur sendToPlayer:", error);
      return { success: false, error: error.message };
    }
  }

  public static async sendToServer(
    serverId: string,
    options: SendToServerOptions
  ): Promise<{ success: boolean; mailId?: string; error?: string }> {
    try {
      const mail = await (Mail as any).sendToServer(serverId, options);
      
      console.log(`📧 Mail sent to server ${serverId}: ${options.title}`);
      
      return { success: true, mailId: mail._id.toString() };

    } catch (error: any) {
      console.error("❌ Erreur sendToServer:", error);
      return { success: false, error: error.message };
    }
  }

  public static async sendToAllServers(
    options: SendMailOptions
  ): Promise<{ success: boolean; mailId?: string; error?: string }> {
    try {
      const mail = await (Mail as any).sendToAllServers(options);
      
      console.log(`📧 Mail sent to all servers: ${options.title}`);
      
      return { success: true, mailId: mail._id.toString() };

    } catch (error: any) {
      console.error("❌ Erreur sendToAllServers:", error);
      return { success: false, error: error.message };
    }
  }

  public static async sendRewardMail(
    recipientId: string,
    serverId: string,
    rewards: {
      gold?: number;
      gems?: number;
      heroes?: { heroId: string; rarity: string }[];
      materials?: Record<string, number>;
      tickets?: number;
    },
    reason: string,
    category: "reward" | "compensation" | "event" = "reward"
  ): Promise<{ success: boolean; mailId?: string; error?: string }> {
    try {
      const attachments: IMailAttachment[] = [];

      if (rewards.gold) {
        attachments.push({ type: "gold", quantity: rewards.gold });
      }
      if (rewards.gems) {
        attachments.push({ type: "gems", quantity: rewards.gems });
      }
      if (rewards.heroes) {
        rewards.heroes.forEach(hero => {
          attachments.push({
            type: "hero",
            itemId: hero.heroId,
            quantity: 1,
            rarity: hero.rarity as any
          });
        });
      }
      if (rewards.materials) {
        Object.entries(rewards.materials).forEach(([materialId, quantity]) => {
          attachments.push({
            type: "material",
            itemId: materialId,
            quantity
          });
        });
      }
      if (rewards.tickets) {
        attachments.push({ type: "ticket", quantity: rewards.tickets });
      }

      return await this.sendToPlayer(recipientId, serverId, {
        title: this.getRewardMailTitle(category, reason),
        content: this.getRewardMailContent(rewards, reason),
        category,
        attachments,
        senderName: "System",
        priority: "normal",
        expiresInDays: 7
      });

    } catch (error: any) {
      console.error("❌ Erreur sendRewardMail:", error);
      return { success: false, error: error.message };
    }
  }

  public static async getMailStats(serverId?: string) {
    try {
      const [stats, expiredCount] = await Promise.all([
        (Mail as any).getMailStats(serverId),
        Mail.countDocuments({ expiresAt: { $lt: new Date() } })
      ]);

      return {
        success: true,
        stats,
        expiredCount,
        summary: {
          totalMails: stats.reduce((sum: number, stat: any) => sum + stat.count, 0),
          avgAttachmentsPerMail: stats.reduce((sum: number, stat: any) => sum + stat.totalAttachments, 0) / Math.max(1, stats.reduce((sum: number, stat: any) => sum + stat.count, 0))
        }
      };

    } catch (error: any) {
      console.error("❌ Erreur getMailStats:", error);
      return { success: false, error: error.message };
    }
  }

  public static async cleanExpiredMails(): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const result = await (Mail as any).cleanExpiredMails();
      console.log(`🗑️ Cleaned ${result.deletedCount} expired mails`);
      
      return { success: true, deletedCount: result.deletedCount };

    } catch (error: any) {
      console.error("❌ Erreur cleanExpiredMails:", error);
      return { success: false, error: error.message };
    }
  }

  public static async scheduleMail(
    recipientType: "player" | "server" | "all_servers",
    recipientId: string | null,
    serverId: string,
    options: SendMailOptions & { scheduledAt: Date }
  ): Promise<{ success: boolean; mailId?: string; error?: string }> {
    try {
      const mailData = {
        serverId: recipientType === "all_servers" ? "ALL" : serverId,
        recipientType: recipientType === "player" ? "individual" : recipientType === "server" ? "server" : "all_servers",
        recipientId: recipientType === "player" ? recipientId : undefined,
        senderType: "system" as const,
        senderName: options.senderName || "System",
        title: options.title,
        content: options.content,
        category: options.category,
        attachments: options.attachments || [],
        hasAttachments: (options.attachments || []).length > 0,
        status: "scheduled" as const,
        priority: options.priority || "normal",
        scheduledAt: options.scheduledAt,
        expiresAt: new Date(options.scheduledAt.getTime() + (options.expiresInDays || 7) * 24 * 60 * 60 * 1000)
      };

      const mail = await Mail.create(mailData);
      
      console.log(`⏰ Mail scheduled for ${options.scheduledAt}: ${options.title}`);
      
      return { success: true, mailId: mail._id.toString() };

    } catch (error: any) {
      console.error("❌ Erreur scheduleMail:", error);
      return { success: false, error: error.message };
    }
  }

  public static async processScheduledMails(): Promise<{ success: boolean; processedCount?: number; error?: string }> {
    try {
      const scheduledMails = await Mail.find({
        status: "scheduled",
        scheduledAt: { $lte: new Date() }
      });

      let processedCount = 0;
      for (const mail of scheduledMails) {
        mail.status = "sent";
        mail.sentAt = new Date();
        await mail.save();
        processedCount++;
      }

      if (processedCount > 0) {
        console.log(`📧 Processed ${processedCount} scheduled mails`);
      }

      return { success: true, processedCount };

    } catch (error: any) {
      console.error("❌ Erreur processScheduledMails:", error);
      return { success: false, error: error.message };
    }
  }

  private static async processAttachments(player: any, attachments: IMailAttachment[]) {
    const rewards = {
      gold: 0,
      gems: 0,
      heroes: [] as any[],
      materials: {} as Record<string, number>,
      tickets: 0,
      items: {} as Record<string, number>
    };

    for (const attachment of attachments) {
      switch (attachment.type) {
        case "gold":
          player.gold += attachment.quantity;
          rewards.gold += attachment.quantity;
          break;

        case "gems":
          player.gems += attachment.quantity;
          rewards.gems += attachment.quantity;
          break;

        case "hero":
          if (attachment.itemId) {
            await player.addHero(attachment.itemId, 1, 1);
            rewards.heroes.push({ heroId: attachment.itemId, rarity: attachment.rarity });
          }
          break;

        case "material":
          if (attachment.itemId) {
            const current = player.materials.get(attachment.itemId) || 0;
            player.materials.set(attachment.itemId, current + attachment.quantity);
            rewards.materials[attachment.itemId] = (rewards.materials[attachment.itemId] || 0) + attachment.quantity;
          }
          break;

        case "ticket":
          player.tickets += attachment.quantity;
          rewards.tickets += attachment.quantity;
          break;

        case "item":
          if (attachment.itemId) {
            rewards.items[attachment.itemId] = (rewards.items[attachment.itemId] || 0) + attachment.quantity;
          }
          break;
      }
    }

    return rewards;
  }

  private static mergeRewards(total: any, rewards: any) {
    total.gold += rewards.gold;
    total.gems += rewards.gems;
    total.heroes.push(...rewards.heroes);
    total.tickets += rewards.tickets;

    Object.entries(rewards.materials).forEach(([key, value]) => {
      total.materials[key] = (total.materials[key] || 0) + (value as number);
    });

    Object.entries(rewards.items).forEach(([key, value]) => {
      total.items[key] = (total.items[key] || 0) + (value as number);
    });
  }

  private static formatAttachmentsSummary(attachments: IMailAttachment[]): string {
    return attachments.map(att => {
      switch (att.type) {
        case "gold": return `${att.quantity.toLocaleString()} Gold`;
        case "gems": return `${att.quantity} Gems`;
        case "hero": return `${att.rarity} Hero`;
        case "material": return `${att.quantity}x ${att.itemId}`;
        case "ticket": return `${att.quantity} Tickets`;
        default: return `${att.quantity}x ${att.itemId}`;
      }
    }).join(", ");
  }

  private static isExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  private static getTimeRemaining(expiresAt: Date): string {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  }

  private static async getTotalMailCount(
    playerId: string,
    serverId: string,
    filters: { category?: string; unreadOnly?: boolean; hasAttachments?: boolean }
  ): Promise<number> {
    const query: any = {
      serverId,
      status: "sent",
      expiresAt: { $gt: new Date() },
      $or: [
        { recipientId: playerId },
        { recipientType: "server" },
        { recipientType: "all_servers" }
      ]
    };

    if (filters.category) query.category = filters.category;
    if (filters.hasAttachments !== undefined) query.hasAttachments = filters.hasAttachments;
    if (filters.unreadOnly) query[`readBy.${playerId}`] = { $exists: false };

    return Mail.countDocuments(query);
  }

  private static getRewardMailTitle(category: string, reason: string): string {
    switch (category) {
      case "reward": return `🎁 Reward: ${reason}`;
      case "compensation": return `💰 Compensation: ${reason}`;
      case "event": return `🎉 Event Reward: ${reason}`;
      default: return `📦 ${reason}`;
    }
  }

  private static getRewardMailContent(rewards: any, reason: string): string {
    const items = [];
    if (rewards.gold) items.push(`${rewards.gold.toLocaleString()} Gold`);
    if (rewards.gems) items.push(`${rewards.gems} Gems`);
    if (rewards.heroes?.length) items.push(`${rewards.heroes.length} Hero(s)`);
    if (rewards.tickets) items.push(`${rewards.tickets} Tickets`);
    
    const materialCount = Object.keys(rewards.materials || {}).length;
    if (materialCount) items.push(`${materialCount} Material(s)`);

    return `${reason}\n\nRewards:\n${items.join(", ")}`;
  }

  private static async updateProgressTracking(
    playerId: string,
    serverId: string,
    mail: any | null,
    rewards: any,
    mailCount: number = 1
  ) {
    try {
      await Promise.all([
        MissionService.updateProgress(
          playerId,
          serverId,
          "heroes_owned",
          mailCount,
          { itemType: "mail_claim", category: mail?.category }
        ),
        EventService.updatePlayerProgress(
          playerId,
          serverId,
          "collect_items",
          mailCount,
          { itemType: "mail_reward", rewards }
        )
      ]);

    } catch (error) {
      console.error("⚠️ Erreur mise à jour progression mail:", error);
    }
  }
}

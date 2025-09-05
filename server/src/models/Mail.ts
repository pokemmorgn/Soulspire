import mongoose, { Document, Schema } from "mongoose";

export interface IMailAttachment {
  type: "gold" | "gems" | "hero" | "material" | "ticket" | "item";
  itemId?: string;
  quantity: number;
  rarity?: "Common" | "Rare" | "Epic" | "Legendary";
}

export interface IMailDocument extends Document {
  serverId: string;
  recipientId?: string;
  recipientType: "individual" | "server" | "all_servers" | "vip_level" | "level_range";
  
  senderType: "system" | "admin" | "event" | "guild" | "player";
  senderId?: string;
  senderName: string;
  
  title: string;
  content: string;
  category: "system" | "reward" | "event" | "maintenance" | "social" | "compensation";
  
  attachments: IMailAttachment[];
  hasAttachments: boolean;
  
  conditions?: {
    minLevel?: number;
    maxLevel?: number;
    vipLevel?: number;
    serverIds?: string[];
    playerIds?: string[];
  };
  
  status: "draft" | "sent" | "scheduled";
  priority: "low" | "normal" | "high" | "urgent";
  
  sentAt?: Date;
  scheduledAt?: Date;
  expiresAt: Date;
  
  readBy: Map<string, Date>;
  claimedBy: Map<string, Date>;
  
  metadata?: {
    eventId?: string;
    campaignId?: string;
    version?: string;
    tags?: string[];
  };

  isExpired(): boolean;
  isReadBy(playerId: string): boolean;
  isClaimedBy(playerId: string): boolean;
  canBeClaimedBy(playerId: string): boolean;
  markAsRead(playerId: string): Promise<void>;
  markAsClaimed(playerId: string): Promise<void>;
  getAttachmentsSummary(): string;
}

const mailAttachmentSchema = new Schema<IMailAttachment>({
  type: {
    type: String,
    enum: ["gold", "gems", "hero", "material", "ticket", "item"],
    required: true
  },
  itemId: {
    type: String,
    required: function(this: IMailAttachment) {
      return ["hero", "material", "item"].includes(this.type);
    }
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    max: 999999
  },
  rarity: {
    type: String,
    enum: ["Common", "Rare", "Epic", "Legendary"],
    required: function(this: IMailAttachment) {
      return this.type === "hero";
    }
  }
});

const mailSchema = new Schema<IMailDocument>({
  serverId: {
    type: String,
    required: true,
    match: /^S\d+$/,
    index: true
  },
  recipientId: {
    type: String,
    index: true,
    sparse: true
  },
  recipientType: {
    type: String,
    enum: ["individual", "server", "all_servers", "vip_level", "level_range"],
    required: true,
    index: true
  },
  
  senderType: {
    type: String,
    enum: ["system", "admin", "event", "guild", "player"],
    required: true,
    index: true
  },
  senderId: {
    type: String,
    sparse: true
  },
  senderName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  category: {
    type: String,
    enum: ["system", "reward", "event", "maintenance", "social", "compensation"],
    required: true,
    index: true
  },
  
  attachments: {
    type: [mailAttachmentSchema],
    default: []
  },
  hasAttachments: {
    type: Boolean,
    default: false
  },
  
  conditions: {
    minLevel: { type: Number, min: 1, max: 1000 },
    maxLevel: { type: Number, min: 1, max: 1000 },
    vipLevel: { type: Number, min: 0, max: 15 },
    serverIds: [{ type: String, match: /^S\d+$/ }],
    playerIds: [{ type: String }]
  },
  
  status: {
    type: String,
    enum: ["draft", "sent", "scheduled"],
    default: "draft",
    index: true
  },
  priority: {
    type: String,
    enum: ["low", "normal", "high", "urgent"],
    default: "normal"
  },
  
  sentAt: {
    type: Date,
    index: true
  },
  scheduledAt: {
    type: Date,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  
  readBy: {
    type: Map,
    of: Date,
    default: new Map()
  },
  claimedBy: {
    type: Map,
    of: Date,
    default: new Map()
  },
  
  metadata: {
    eventId: String,
    campaignId: String,
    version: String,
    tags: [String]
  }
}, {
  timestamps: true,
  collection: 'mails'
});

// Index composés pour optimiser les requêtes
mailSchema.index({ serverId: 1, recipientId: 1, sentAt: -1 });
mailSchema.index({ serverId: 1, recipientType: 1, status: 1 });
mailSchema.index({ category: 1, sentAt: -1 });
mailSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
mailSchema.index({ status: 1, scheduledAt: 1 });
mailSchema.index({ senderType: 1, senderId: 1, sentAt: -1 });

// Pre-save middleware
mailSchema.pre("save", function(next) {
  this.hasAttachments = this.attachments.length > 0;
  
  if (this.conditions?.minLevel && this.conditions?.maxLevel) {
    if (this.conditions.minLevel > this.conditions.maxLevel) {
      return next(new Error("minLevel cannot be greater than maxLevel"));
    }
  }
  
  if (this.status === "sent" && !this.sentAt) {
    this.sentAt = new Date();
  }
  
  next();
});

// Méthodes d'instance
mailSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt;
};

mailSchema.methods.isReadBy = function(playerId: string): boolean {
  return this.readBy.has(playerId);
};

mailSchema.methods.isClaimedBy = function(playerId: string): boolean {
  return this.claimedBy.has(playerId);
};

mailSchema.methods.canBeClaimedBy = function(playerId: string): boolean {
  return this.hasAttachments && 
         !this.isExpired() && 
         !this.isClaimedBy(playerId) &&
         this.status === "sent";
};

mailSchema.methods.markAsRead = function(playerId: string): Promise<void> {
  if (!this.isReadBy(playerId)) {
    this.readBy.set(playerId, new Date());
    return this.save();
  }
  return Promise.resolve();
};

mailSchema.methods.markAsClaimed = function(playerId: string): Promise<void> {
  if (this.canBeClaimedBy(playerId)) {
    this.claimedBy.set(playerId, new Date());
    if (!this.isReadBy(playerId)) {
      this.readBy.set(playerId, new Date());
    }
    return this.save();
  }
  return Promise.reject(new Error("Cannot claim this mail"));
};

mailSchema.methods.getAttachmentsSummary = function(): string {
  if (!this.hasAttachments) return "No attachments";
  
  const summary = this.attachments.map((att: IMailAttachment) => {
    switch (att.type) {
      case "gold":
        return `${att.quantity.toLocaleString()} Gold`;
      case "gems":
        return `${att.quantity} Gems`;
      case "hero":
        return `${att.rarity} Hero`;
      case "material":
        return `${att.quantity}x ${att.itemId}`;
      case "ticket":
        return `${att.quantity} Summon Tickets`;
      default:
        return `${att.quantity}x ${att.itemId}`;
    }
  });
  
  return summary.join(", ");
};

// Méthodes statiques
mailSchema.statics.getPlayerMails = function(
  playerId: string,
  serverId: string,
  options: {
    limit?: number;
    category?: string;
    unreadOnly?: boolean;
    hasAttachments?: boolean;
  } = {}
) {
  const { limit = 50, category, unreadOnly = false, hasAttachments } = options;
  
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
  
  if (category) {
    query.category = category;
  }
  
  if (hasAttachments !== undefined) {
    query.hasAttachments = hasAttachments;
  }
  
  const aggregationPipeline: any[] = [
    { $match: query },
    {
      $addFields: {
        isRead: { $ifNull: [{ $getField: { field: playerId, input: "$readBy" } }, null] },
        isClaimed: { $ifNull: [{ $getField: { field: playerId, input: "$claimedBy" } }, null] }
      }
    }
  ];
  
  if (unreadOnly) {
    aggregationPipeline.push({
      $match: { isRead: null }
    });
  }
  
  aggregationPipeline.push(
    { $sort: { priority: -1, sentAt: -1 } },
    { $limit: limit }
  );
  
  return this.aggregate(aggregationPipeline);
};

mailSchema.statics.getUnreadCount = function(playerId: string, serverId: string) {
  return this.countDocuments({
    serverId,
    status: "sent",
    expiresAt: { $gt: new Date() },
    $or: [
      { recipientId: playerId },
      { recipientType: "server" },
      { recipientType: "all_servers" }
    ],
    [`readBy.${playerId}`]: { $exists: false }
  });
};

mailSchema.statics.getClaimableCount = function(playerId: string, serverId: string) {
  return this.countDocuments({
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
};

mailSchema.statics.sendToPlayer = function(
  recipientId: string,
  serverId: string,
  mailData: {
    title: string;
    content: string;
    category: string;
    attachments?: IMailAttachment[];
    senderName?: string;
    expiresInDays?: number;
    priority?: string;
  }
) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (mailData.expiresInDays || 7));
  
  return this.create({
    serverId,
    recipientId,
    recipientType: "individual",
    senderType: "system",
    senderName: mailData.senderName || "System",
    title: mailData.title,
    content: mailData.content,
    category: mailData.category,
    attachments: mailData.attachments || [],
    hasAttachments: (mailData.attachments || []).length > 0,
    status: "sent",
    priority: mailData.priority || "normal",
    sentAt: new Date(),
    expiresAt
  });
};

mailSchema.statics.sendToServer = function(
  serverId: string,
  mailData: {
    title: string;
    content: string;
    category: string;
    attachments?: IMailAttachment[];
    senderName?: string;
    expiresInDays?: number;
    priority?: string;
    conditions?: any;
  }
) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (mailData.expiresInDays || 7));
  
  return this.create({
    serverId,
    recipientType: "server",
    senderType: "system",
    senderName: mailData.senderName || "System",
    title: mailData.title,
    content: mailData.content,
    category: mailData.category,
    attachments: mailData.attachments || [],
    hasAttachments: (mailData.attachments || []).length > 0,
    conditions: mailData.conditions,
    status: "sent",
    priority: mailData.priority || "normal",
    sentAt: new Date(),
    expiresAt
  });
};

mailSchema.statics.sendToAllServers = function(
  mailData: {
    title: string;
    content: string;
    category: string;
    attachments?: IMailAttachment[];
    senderName?: string;
    expiresInDays?: number;
    priority?: string;
  }
) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (mailData.expiresInDays || 7));
  
  return this.create({
    serverId: "ALL",
    recipientType: "all_servers",
    senderType: "system",
    senderName: mailData.senderName || "System",
    title: mailData.title,
    content: mailData.content,
    category: mailData.category,
    attachments: mailData.attachments || [],
    hasAttachments: (mailData.attachments || []).length > 0,
    status: "sent",
    priority: mailData.priority || "normal",
    sentAt: new Date(),
    expiresAt
  });
};

mailSchema.statics.cleanExpiredMails = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

mailSchema.statics.getMailStats = function(serverId?: string) {
  const matchQuery = serverId ? { serverId } : {};
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          category: "$category",
          status: "$status"
        },
        count: { $sum: 1 },
        totalAttachments: { $sum: { $size: "$attachments" } },
        avgReadRate: {
          $avg: {
            $cond: [
              { $gt: [{ $size: { $objectToArray: "$readBy" } }, 0] },
              { $divide: [{ $size: { $objectToArray: "$readBy" } }, 1] },
              0
            ]
          }
        }
      }
    },
    { $sort: { "_id.category": 1, "_id.status": 1 } }
  ]);
};

export default mongoose.model<IMailDocument>("Mail", mailSchema);

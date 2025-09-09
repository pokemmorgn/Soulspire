import mongoose, { Document, Schema } from "mongoose";
import { IdGenerator } from "../utils/idGenerator";
import { WebSocketService } from '../services/WebSocketService';

export interface IGuildMember {
  playerId: string;
  playerName: string;
  playerLevel: number;
  playerPower: number;
  role: "leader" | "officer" | "elite" | "member";
  joinedAt: Date;
  lastActiveAt: Date;
  contributionDaily: number;
  contributionWeekly: number;
  contributionTotal: number;
  position?: string;
}

export interface IGuildApplication {
  playerId: string;
  playerName: string;
  playerLevel: number;
  playerPower: number;
  message: string;
  appliedAt: Date;
  status: "pending" | "accepted" | "rejected";
}

export interface IGuildInvitation {
  playerId: string;
  playerName: string;
  invitedBy: string;
  invitedByName: string;
  invitedAt: Date;
  expiresAt: Date;
  status: "pending" | "accepted" | "declined" | "expired";
}

export interface IGuildActivityLog {
  type: "join" | "leave" | "kick" | "promote" | "demote" | "contribution" | "raid_start" | "raid_complete" | "level_up" | "settings_changed";
  playerId: string;
  playerName: string;
  targetPlayerId?: string;
  targetPlayerName?: string;
  details?: any;
  timestamp: Date;
}

export interface IGuildQuest {
  questId: string;
  questType: "daily" | "weekly" | "special";
  name: string;
  description: string;
  targetValue: number;
  currentProgress: number;
  isCompleted: boolean;
  completedAt?: Date;
  rewards: {
    guildExp: number;
    guildCoins: number;
    memberRewards: {
      gold: number;
      gems: number;
      materials?: Record<string, number>;
    };
  };
  contributors: Array<{
    playerId: string;
    playerName: string;
    contribution: number;
  }>;
  startDate: Date;
  endDate: Date;
}

export interface IGuildRaid {
  raidId: string;
  raidType: "guild_boss" | "territory_war" | "labyrinth";
  name: string;
  description: string;
  difficultyLevel: number;
  maxParticipants: number;
  currentParticipants: number;
  isActive: boolean;
  startTime: Date;
  endTime: Date;
  status: "preparing" | "active" | "completed" | "failed";
  participants: Array<{
    playerId: string;
    playerName: string;
    joinedAt: Date;
    contribution: number;
    damageDealt: number;
    isReady: boolean;
  }>;
  bossHealth: {
    current: number;
    max: number;
  };
  rewards: {
    guildCoins: number;
    guildExp: number;
    memberRewards: Array<{
      tier: "mvp" | "top_10" | "participant";
      requirements: any;
      rewards: {
        gold: number;
        gems: number;
        materials: Record<string, number>;
        exclusiveItems?: string[];
      };
    }>;
  };
  completedAt?: Date;
}

export interface IGuildStats {
  totalMembers: number;
  averageLevel: number;
  totalPower: number;
  averagePower: number;
  dailyActivity: number;
  weeklyContribution: number;
  monthlyContribution: number;
  raidsCompleted: number;
  questsCompleted: number;
  territoryRank?: number;
  seasonRank?: number;
}

export interface IGuildRewards {
  dailyRewards: {
    lastClaimTime: Date;
    claimedBy: string[];
    rewards: {
      gold: number;
      gems: number;
      guildCoins: number;
    };
  };
  weeklyRewards: {
    lastClaimTime: Date;
    claimedBy: string[];
    rewards: {
      gold: number;
      gems: number;
      guildCoins: number;
      materials: Record<string, number>;
    };
  };
  seasonRewards: {
    season: number;
    finalRank: number;
    rewards: any;
    distributed: boolean;
  };
}

export interface IGuild {
  _id?: string;
  guildId: string;
  serverId: string;
  name: string;
  tag: string;
  description: string;
  iconId: string;
  level: number;
  experience: number;
  experienceRequired: number;
  settings: {
    isPublic: boolean;
    autoAccept: boolean;
    minimumLevel: number;
    minimumPower: number;
    language: string;
    timezone: string;
    requiredActivity: "low" | "medium" | "high";
    autoKickInactiveMembers: boolean;
    inactivityThresholdDays: number;
  };
  members: IGuildMember[];
  maxMembers: number;
  memberCount: number;
  applications: IGuildApplication[];
  invitations: IGuildInvitation[];
  activityLogs: IGuildActivityLog[];
  currentQuests: IGuildQuest[];
  completedQuests: number;
  currentRaid?: IGuildRaid;
  raidHistory: IGuildRaid[];
  guildCoins: number;
  guildBank: {
    gold: number;
    materials: Record<string, number>;
    lastDonation: Date;
  };
  stats: IGuildStats;
  rewards: IGuildRewards;
  territory: {
    regionId?: string;
    regionName?: string;
    controlledSince?: Date;
    defenseWins: number;
    defenseTotal: number;
  };
  createdAt: Date;
  createdBy: string;
  lastActivityAt: Date;
  status: "active" | "inactive" | "disbanded";
  disbandedAt?: Date;
  disbandedBy?: string;
  disbandReason?: string;
}

export interface IGuildDocument extends Document, IGuild {
  _id: string;
  addMember(playerId: string, playerName: string, playerLevel: number, playerPower: number): Promise<IGuildDocument>;
  removeMember(playerId: string, reason?: string): Promise<IGuildDocument>;
  promoteMember(playerId: string, newRole: "officer" | "leader"): Promise<IGuildDocument>;
  demoteMember(playerId: string): Promise<IGuildDocument>;
  updateMemberActivity(playerId: string): Promise<IGuildDocument>;
  addApplication(playerId: string, playerName: string, playerLevel: number, playerPower: number, message: string): Promise<IGuildDocument>;
  processApplication(playerId: string, action: "accept" | "reject", processedBy: string): Promise<IGuildDocument>;
  inviteMember(playerId: string, playerName: string, invitedBy: string, invitedByName: string): Promise<IGuildDocument>;
  processInvitation(playerId: string, action: "accept" | "decline"): Promise<IGuildDocument>;
  addExperience(amount: number, source: string): Promise<{ leveledUp: boolean; newLevel: number }>;
  addContribution(playerId: string, amount: number, type: "daily" | "weekly"): Promise<IGuildDocument>;
  startQuest(questData: Partial<IGuildQuest>): Promise<IGuildDocument>;
  updateQuestProgress(questId: string, playerId: string, progress: number): Promise<IGuildDocument>;
  completeQuest(questId: string): Promise<IGuildDocument>;
  startRaid(raidData: Partial<IGuildRaid>): Promise<IGuildDocument>;
  joinRaid(raidId: string, playerId: string, playerName: string): Promise<IGuildDocument>;
  updateRaidProgress(raidId: string, playerId: string, damage: number): Promise<IGuildDocument>;
  completeRaid(raidId: string): Promise<IGuildDocument>;
  canJoin(playerLevel: number, playerPower: number): boolean;
  getMember(playerId: string): IGuildMember | null;
  getPlayerRole(playerId: string): string | null;
  isLeader(playerId: string): boolean;
  isOfficer(playerId: string): boolean;
  canManageMembers(playerId: string): boolean;
  updateStats(): Promise<IGuildDocument>;
  addActivityLog(logData: Partial<IGuildActivityLog>): Promise<IGuildDocument>;
  cleanupExpiredInvitations(): Promise<IGuildDocument>;
  resetDailyProgress(): Promise<IGuildDocument>;
  resetWeeklyProgress(): Promise<IGuildDocument>;
}

const guildMemberSchema = new Schema<IGuildMember>({
  playerId: { type: String, required: true },
  playerName: { type: String, required: true },
  playerLevel: { type: Number, required: true, min: 1 },
  playerPower: { type: Number, required: true, min: 0 },
  role: { type: String, enum: ["leader", "officer", "elite", "member"], default: "member" },
  joinedAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  contributionDaily: { type: Number, default: 0, min: 0 },
  contributionWeekly: { type: Number, default: 0, min: 0 },
  contributionTotal: { type: Number, default: 0, min: 0 },
  position: { type: String, maxlength: 20 }
}, { _id: false });

const guildApplicationSchema = new Schema<IGuildApplication>({
  playerId: { type: String, required: true },
  playerName: { type: String, required: true },
  playerLevel: { type: Number, required: true },
  playerPower: { type: Number, required: true },
  message: { type: String, maxlength: 200 },
  appliedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" }
}, { _id: false });

const guildInvitationSchema = new Schema<IGuildInvitation>({
  playerId: { type: String, required: true },
  playerName: { type: String, required: true },
  invitedBy: { type: String, required: true },
  invitedByName: { type: String, required: true },
  invitedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ["pending", "accepted", "declined", "expired"], default: "pending" }
}, { _id: false });

const guildActivityLogSchema = new Schema<IGuildActivityLog>({
  type: { 
    type: String, 
    enum: ["join", "leave", "kick", "promote", "demote", "contribution", "raid_start", "raid_complete", "level_up", "settings_changed"], 
    required: true 
  },
  playerId: { type: String, required: true },
  playerName: { type: String, required: true },
  targetPlayerId: { type: String },
  targetPlayerName: { type: String },
  details: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const guildQuestSchema = new Schema<IGuildQuest>({
  questId: { type: String, required: true, default: () => IdGenerator.generateEventId() },
  questType: { type: String, enum: ["daily", "weekly", "special"], required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  targetValue: { type: Number, required: true, min: 1 },
  currentProgress: { type: Number, default: 0, min: 0 },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
  rewards: {
    guildExp: { type: Number, required: true, min: 0 },
    guildCoins: { type: Number, required: true, min: 0 },
    memberRewards: {
      gold: { type: Number, default: 0 },
      gems: { type: Number, default: 0 },
      materials: { type: Map, of: Number, default: new Map() }
    }
  },
  contributors: [{
    playerId: { type: String, required: true },
    playerName: { type: String, required: true },
    contribution: { type: Number, required: true, min: 0 }
  }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true }
}, { _id: false });

const guildRaidSchema = new Schema<IGuildRaid>({
  raidId: { type: String, required: true, default: () => IdGenerator.generateEventId() },
  raidType: { type: String, enum: ["guild_boss", "territory_war", "labyrinth"], required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  difficultyLevel: { type: Number, required: true, min: 1 },
  maxParticipants: { type: Number, required: true, min: 1 },
  currentParticipants: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: false },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, enum: ["preparing", "active", "completed", "failed"], default: "preparing" },
  participants: [{
    playerId: { type: String, required: true },
    playerName: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    contribution: { type: Number, default: 0, min: 0 },
    damageDealt: { type: Number, default: 0, min: 0 },
    isReady: { type: Boolean, default: false }
  }],
  bossHealth: {
    current: { type: Number, required: true, min: 0 },
    max: { type: Number, required: true, min: 1 }
  },
  rewards: {
    guildCoins: { type: Number, required: true, min: 0 },
    guildExp: { type: Number, required: true, min: 0 },
    memberRewards: [{
      tier: { type: String, enum: ["mvp", "top_10", "participant"], required: true },
      requirements: { type: Schema.Types.Mixed },
      rewards: {
        gold: { type: Number, required: true, min: 0 },
        gems: { type: Number, required: true, min: 0 },
        materials: { type: Map, of: Number, default: new Map() },
        exclusiveItems: [{ type: String }]
      }
    }]
  },
  completedAt: { type: Date }
}, { _id: false });

const guildSchema = new Schema<IGuildDocument>({
  _id: {
    type: String,
    required: true,
    default: () => IdGenerator.generateGuildId()
  },
  guildId: {
    type: String,
    required: true,
    default: function () { return this._id; }
  },
  serverId: { type: String, required: true, match: /^S\d+$/ },
  name: { 
    type: String, 
    required: true, 
    trim: true, 
    minlength: 3, 
    maxlength: 20,
    match: /^[a-zA-Z0-9\s\-_]+$/
  },
  tag: { 
    type: String, 
    required: true, 
    trim: true, 
    minlength: 2, 
    maxlength: 5,
    uppercase: true,
    match: /^[A-Z0-9]+$/
  },
  description: { type: String, maxlength: 300, default: "" },
  iconId: { type: String, default: "default_guild_icon" },
  level: { type: Number, default: 1, min: 1, max: 100 },
  experience: { type: Number, default: 0, min: 0 },
  experienceRequired: { type: Number, default: 1000, min: 1 },
  settings: {
    isPublic: { type: Boolean, default: true },
    autoAccept: { type: Boolean, default: false },
    minimumLevel: { type: Number, default: 1, min: 1 },
    minimumPower: { type: Number, default: 0, min: 0 },
    language: { type: String, default: "en", enum: ["en", "fr", "es", "de", "ja", "ko", "zh"] },
    timezone: { type: String, default: "UTC" },
    requiredActivity: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    autoKickInactiveMembers: { type: Boolean, default: false },
    inactivityThresholdDays: { type: Number, default: 7, min: 3, max: 30 }
  },
  members: { type: [guildMemberSchema], default: [] },
  maxMembers: { type: Number, default: 30, min: 1, max: 50 },
  memberCount: { type: Number, default: 0, min: 0 },
  applications: { type: [guildApplicationSchema], default: [] },
  invitations: { type: [guildInvitationSchema], default: [] },
  activityLogs: { type: [guildActivityLogSchema], default: [] },
  currentQuests: { type: [guildQuestSchema], default: [] },
  completedQuests: { type: Number, default: 0, min: 0 },
  currentRaid: { type: guildRaidSchema, default: null },
  raidHistory: { type: [guildRaidSchema], default: [] },
  guildCoins: { type: Number, default: 0, min: 0 },
  guildBank: {
    gold: { type: Number, default: 0, min: 0 },
    materials: { type: Map, of: Number, default: new Map() },
    lastDonation: { type: Date, default: Date.now }
  },
  stats: {
    totalMembers: { type: Number, default: 0, min: 0 },
    averageLevel: { type: Number, default: 0, min: 0 },
    totalPower: { type: Number, default: 0, min: 0 },
    averagePower: { type: Number, default: 0, min: 0 },
    dailyActivity: { type: Number, default: 0, min: 0 },
    weeklyContribution: { type: Number, default: 0, min: 0 },
    monthlyContribution: { type: Number, default: 0, min: 0 },
    raidsCompleted: { type: Number, default: 0, min: 0 },
    questsCompleted: { type: Number, default: 0, min: 0 },
    territoryRank: { type: Number, min: 1 },
    seasonRank: { type: Number, min: 1 }
  },
  rewards: {
    dailyRewards: {
      lastClaimTime: { type: Date, default: Date.now },
      claimedBy: [{ type: String }],
      rewards: {
        gold: { type: Number, default: 1000 },
        gems: { type: Number, default: 50 },
        guildCoins: { type: Number, default: 100 }
      }
    },
    weeklyRewards: {
      lastClaimTime: { type: Date, default: Date.now },
      claimedBy: [{ type: String }],
      rewards: {
        gold: { type: Number, default: 10000 },
        gems: { type: Number, default: 500 },
        guildCoins: { type: Number, default: 1000 },
        materials: { type: Map, of: Number, default: new Map() }
      }
    },
    seasonRewards: {
      season: { type: Number, default: 1 },
      finalRank: { type: Number, default: 999999 },
      rewards: { type: Schema.Types.Mixed },
      distributed: { type: Boolean, default: false }
    }
  },
  territory: {
    regionId: { type: String },
    regionName: { type: String },
    controlledSince: { type: Date },
    defenseWins: { type: Number, default: 0, min: 0 },
    defenseTotal: { type: Number, default: 0, min: 0 }
  },
  createdBy: { type: String, required: true },
  lastActivityAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["active", "inactive", "disbanded"], default: "active" },
  disbandedAt: { type: Date },
  disbandedBy: { type: String },
  disbandReason: { type: String }
}, {
  timestamps: true,
  collection: 'guilds',
  _id: false
});

guildSchema.index({ _id: 1 }, { unique: true });
guildSchema.index({ guildId: 1 }, { unique: true });
guildSchema.index({ serverId: 1 });
guildSchema.index({ name: 1, serverId: 1 }, { unique: true });
guildSchema.index({ tag: 1, serverId: 1 }, { unique: true });
guildSchema.index({ level: -1, serverId: 1 });
guildSchema.index({ "stats.totalPower": -1, serverId: 1 });
guildSchema.index({ "members.playerId": 1 });
guildSchema.index({ "settings.isPublic": 1, "settings.autoAccept": 1 });
guildSchema.index({ lastActivityAt: -1 });
guildSchema.index({ status: 1 });

guildSchema.pre('save', function(next) {
  if (!this._id) {
    this._id = IdGenerator.generateGuildId();
  }
  if (!this.guildId || this.guildId !== this._id) {
    this.guildId = this._id;
  }
  this.memberCount = this.members.length;
  this.experienceRequired = this.level * 1000 + (this.level - 1) * 500;
  next();
});

guildSchema.statics.findByServer = function(serverId: string) {
  return this.find({ serverId, status: "active" });
};

guildSchema.statics.findPublicGuilds = function(serverId: string) {
  return this.find({ 
    serverId, 
    status: "active",
    "settings.isPublic": true,
    $expr: { $lt: ["$memberCount", "$maxMembers"] }
  });
};

guildSchema.statics.findByName = function(name: string, serverId: string) {
  return this.findOne({ name: new RegExp(`^${name}$`, 'i'), serverId });
};

guildSchema.statics.findByTag = function(tag: string, serverId: string) {
  return this.findOne({ tag: tag.toUpperCase(), serverId });
};

guildSchema.statics.getServerLeaderboard = function(serverId: string, type: string = "power", limit: number = 100) {
  const sortField = type === "level" ? "level" : 
                   type === "power" ? "stats.totalPower" :
                   type === "members" ? "memberCount" : "stats.totalPower";
  
  return this.find({ serverId, status: "active" })
    .sort({ [sortField]: -1 })
    .limit(limit)
    .select('name tag level stats.totalPower memberCount');
};

guildSchema.methods.addMember = function(playerId: string, playerName: string, playerLevel: number, playerPower: number) {
  if (this.memberCount >= this.maxMembers) {
    throw new Error("Guild is full");
  }
  if (this.getMember(playerId)) {
    throw new Error("Player is already a member");
  }
  
  const newMember: IGuildMember = {
    playerId,
    playerName,
    playerLevel,
    playerPower,
    role: "member",
    joinedAt: new Date(),
    lastActiveAt: new Date(),
    contributionDaily: 0,
    contributionWeekly: 0,
    contributionTotal: 0
  };
  
  this.members.push(newMember);
  this.addActivityLog({
    type: "join",
    playerId,
    playerName,
    timestamp: new Date()
  });
  return this.save();
};

guildSchema.methods.removeMember = function(playerId: string, reason: string = "left") {
  const memberIndex = this.members.findIndex((m: IGuildMember) => m.playerId === playerId);
  if (memberIndex === -1) {
    throw new Error("Player is not a member");
  }
  
  const member = this.members[memberIndex];
  this.members.splice(memberIndex, 1);
  
  this.addActivityLog({
    type: reason === "kicked" ? "kick" : "leave",
    playerId,
    playerName: member.playerName,
    timestamp: new Date()
  });
  
  return this.save();
};

guildSchema.methods.promoteMember = function(playerId: string, newRole: "officer" | "leader") {
  const member = this.getMember(playerId);
  if (!member) {
    throw new Error("Player is not a member");
  }
  
  const oldRole = member.role;
  member.role = newRole;
  
  this.addActivityLog({
    type: "promote",
    playerId,
    playerName: member.playerName,
    details: { from: oldRole, to: newRole },
    timestamp: new Date()
  });
  
  return this.save();
};

guildSchema.methods.demoteMember = function(playerId: string) {
  const member = this.getMember(playerId);
  if (!member) {
    throw new Error("Player is not a member");
  }
  
  const oldRole = member.role;
  member.role = "member";
  
  this.addActivityLog({
    type: "demote",
    playerId,
    playerName: member.playerName,
    details: { from: oldRole, to: "member" },
    timestamp: new Date()
  });
  
  return this.save();
};

guildSchema.methods.updateMemberActivity = function(playerId: string) {
  const member = this.getMember(playerId);
  if (member) {
    member.lastActiveAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

guildSchema.methods.addApplication = function(playerId: string, playerName: string, playerLevel: number, playerPower: number, message: string) {
  const existingApp = this.applications.find((app: IGuildApplication) => app.playerId === playerId && app.status === "pending");
  if (existingApp) {
    throw new Error("Application already exists");
  }
  
  const application: IGuildApplication = {
    playerId,
    playerName,
    playerLevel,
    playerPower,
    message,
    appliedAt: new Date(),
    status: "pending"
  };
  
  this.applications.push(application);
  
  if (this.settings.autoAccept && this.canJoin(playerLevel, playerPower)) {
    return this.processApplication(playerId, "accept", "system");
  }
  
  return this.save();
};

guildSchema.methods.processApplication = function(playerId: string, action: "accept" | "reject", processedBy: string) {
  const appIndex = this.applications.findIndex((app: IGuildApplication) => app.playerId === playerId && app.status === "pending");
  if (appIndex === -1) {
    throw new Error("Application not found");
  }
  
  const application = this.applications[appIndex];
  application.status = action;
  
  if (action === "accept") {
    this.addMember(application.playerId, application.playerName, application.playerLevel, application.playerPower);
  }
  
  this.applications = this.applications.filter((app: IGuildApplication) => app.playerId !== playerId || app.status === "pending");
  
  return this.save();
};

guildSchema.methods.inviteMember = function(playerId: string, playerName: string, invitedBy: string, invitedByName: string) {
  const existingInv = this.invitations.find((inv: IGuildInvitation) => inv.playerId === playerId && inv.status === "pending");
  if (existingInv) {
    throw new Error("Invitation already exists");
  }
  
  const invitation: IGuildInvitation = {
    playerId,
    playerName,
    invitedBy,
    invitedByName,
    invitedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "pending"
  };
  
  this.invitations.push(invitation);
  return this.save();
};

guildSchema.methods.processInvitation = function(playerId: string, action: "accept" | "decline") {
  const invIndex = this.invitations.findIndex((inv: IGuildInvitation) => inv.playerId === playerId && inv.status === "pending");
  if (invIndex === -1) {
    throw new Error("Invitation not found");
  }
  
  const invitation = this.invitations[invIndex];
  invitation.status = action;
  
  return this.save();
};

guildSchema.methods.addExperience = function(amount: number, source: string) {
  const oldLevel = this.level;
  this.experience += amount;
  
  let leveledUp = false;
  let newLevel = this.level;
  
  while (this.experience >= this.experienceRequired && this.level < 100) {
    this.experience -= this.experienceRequired;
    this.level += 1;
    newLevel = this.level;
    leveledUp = true;
    
    if (this.level % 10 === 0) {
      this.maxMembers = Math.min(50, this.maxMembers + 5);
    }
    
    this.experienceRequired = this.level * 1000 + (this.level - 1) * 500;
    
    this.addActivityLog({
      type: "level_up",
      playerId: "system",
      playerName: "System",
      details: { oldLevel, newLevel: this.level, source },
      timestamp: new Date()
    });
        // 🔥 NOUVEAU: Notifier montée de niveau via WebSocket
    if (typeof WebSocketService !== 'undefined' && WebSocketService.notifyGuildLevelUp) {
      WebSocketService.notifyGuildLevelUp(this._id, {
        oldLevel: oldLevel,
        newLevel: this.level,
        guildName: this.name,
        unlockedFeatures: this.level % 10 === 0 ? ['Max members increased'] : [],
        newMaxMembers: this.maxMembers,
        celebrationRewards: {
          guildCoins: this.level * 100,
          guildExp: 0
        }
      });
    }
  }
  
  return this.save().then(() => ({ leveledUp, newLevel }));
};

guildSchema.methods.addContribution = function(playerId: string, amount: number, type: "daily" | "weekly") {
  const member = this.getMember(playerId);
  if (member) {
    if (type === "daily") {
      member.contributionDaily += amount;
    } else {
      member.contributionWeekly += amount;
    }
    member.contributionTotal += amount;
    
    this.addActivityLog({
      type: "contribution",
      playerId,
      playerName: member.playerName,
      details: { amount, type },
      timestamp: new Date()
    });
  }
  return this.save();
};

guildSchema.methods.startQuest = function(questData: Partial<IGuildQuest>) {
  const quest: IGuildQuest = {
    questId: questData.questId || IdGenerator.generateEventId(),
    questType: questData.questType!,
    name: questData.name!,
    description: questData.description!,
    targetValue: questData.targetValue!,
    currentProgress: 0,
    isCompleted: false,
    rewards: questData.rewards!,
    contributors: [],
    startDate: questData.startDate || new Date(),
    endDate: questData.endDate || new Date(Date.now() + 24 * 60 * 60 * 1000)
  };
  
  this.currentQuests.push(quest);
  return this.save();
};

guildSchema.methods.updateQuestProgress = function(questId: string, playerId: string, progress: number) {
  const quest = this.currentQuests.find((q: IGuildQuest) => q.questId === questId);
  if (!quest || quest.isCompleted) {
    return this.save();
  }
  
  quest.currentProgress += progress;
  
  const contributor = quest.contributors.find((c: any) => c.playerId === playerId);
  const member = this.getMember(playerId);
  
  if (contributor) {
    contributor.contribution += progress;
  } else {
    quest.contributors.push({
      playerId,
      playerName: member?.playerName || "Unknown",
      contribution: progress
    });
  }
  
  if (quest.currentProgress >= quest.targetValue) {
    quest.isCompleted = true;
    quest.completedAt = new Date();
    this.completedQuests += 1;
    this.addExperience(quest.rewards.guildExp, `quest_${questId}`);
    this.guildCoins += quest.rewards.guildCoins;
  }
  
  return this.save();
};

guildSchema.methods.completeQuest = function(questId: string) {
  const questIndex = this.currentQuests.findIndex((q: IGuildQuest) => q.questId === questId);
  if (questIndex === -1) {
    throw new Error("Quest not found");
  }
  
  const quest = this.currentQuests[questIndex];
  quest.isCompleted = true;
  quest.completedAt = new Date();
  this.currentQuests.splice(questIndex, 1);
  
  return this.save();
};

guildSchema.methods.startRaid = function(raidData: Partial<IGuildRaid>) {
  if (this.currentRaid && this.currentRaid.status === "active") {
    throw new Error("Another raid is already active");
  }
  
  const raid: IGuildRaid = {
    raidId: raidData.raidId || IdGenerator.generateEventId(),
    raidType: raidData.raidType!,
    name: raidData.name!,
    description: raidData.description!,
    difficultyLevel: raidData.difficultyLevel!,
    maxParticipants: raidData.maxParticipants!,
    currentParticipants: 0,
    isActive: true,
    startTime: raidData.startTime!,
    endTime: raidData.endTime!,
    status: "preparing",
    participants: [],
    bossHealth: raidData.bossHealth!,
    rewards: raidData.rewards!
  };
  
  this.currentRaid = raid;
  
  this.addActivityLog({
    type: "raid_start",
    playerId: "system",
    playerName: "System",
    details: { raidType: raid.raidType, raidName: raid.name },
    timestamp: new Date()
  });
  
  return this.save();
};

guildSchema.methods.joinRaid = function(raidId: string, playerId: string, playerName: string) {
  if (!this.currentRaid || this.currentRaid.raidId !== raidId) {
    throw new Error("Raid not found");
  }
  
  if (this.currentRaid.currentParticipants >= this.currentRaid.maxParticipants) {
    throw new Error("Raid is full");
  }
  
  const alreadyJoined = this.currentRaid.participants.find((p: any) => p.playerId === playerId);
  if (alreadyJoined) {
    throw new Error("Player already joined");
  }
  
  this.currentRaid.participants.push({
    playerId,
    playerName,
    joinedAt: new Date(),
    contribution: 0,
    damageDealt: 0,
    isReady: false
  });
  
  this.currentRaid.currentParticipants += 1;
  
  return this.save();
};

guildSchema.methods.updateRaidProgress = function(raidId: string, playerId: string, damage: number) {
  if (!this.currentRaid || this.currentRaid.raidId !== raidId) {
    return this.save();
  }
  
  const participant = this.currentRaid.participants.find((p: any) => p.playerId === playerId);
  if (participant) {
    participant.damageDealt += damage;
    participant.contribution += damage;
    
    this.currentRaid.bossHealth.current = Math.max(0, this.currentRaid.bossHealth.current - damage);
    
    if (this.currentRaid.bossHealth.current <= 0) {
      this.currentRaid.status = "completed";
      this.currentRaid.completedAt = new Date();
      this.stats.raidsCompleted += 1;
      
      this.addActivityLog({
        type: "raid_complete",
        playerId: "system",
        playerName: "System",
        details: { raidName: this.currentRaid.name, participants: this.currentRaid.currentParticipants },
        timestamp: new Date()
      });
    }
  }
  
  return this.save();
};

guildSchema.methods.completeRaid = function(raidId: string) {
  if (!this.currentRaid || this.currentRaid.raidId !== raidId) {
    throw new Error("Raid not found");
  }
  
  this.currentRaid.status = "completed";
  this.currentRaid.completedAt = new Date();
  
  this.raidHistory.push(this.currentRaid);
  this.currentRaid = undefined;
  
  if (this.raidHistory.length > 20) {
    this.raidHistory = this.raidHistory.slice(-20);
  }
  
  return this.save();
};

guildSchema.methods.canJoin = function(playerLevel: number, playerPower: number) {
  return this.memberCount < this.maxMembers &&
         playerLevel >= this.settings.minimumLevel &&
         playerPower >= this.settings.minimumPower &&
         this.status === "active";
};

guildSchema.methods.getMember = function(playerId: string) {
  return this.members.find((m: IGuildMember) => m.playerId === playerId) || null;
};

guildSchema.methods.getPlayerRole = function(playerId: string) {
  const member = this.getMember(playerId);
  return member ? member.role : null;
};

guildSchema.methods.isLeader = function(playerId: string) {
  return this.getPlayerRole(playerId) === "leader";
};

guildSchema.methods.isOfficer = function(playerId: string) {
  const role = this.getPlayerRole(playerId);
  return role === "officer" || role === "leader";
};

guildSchema.methods.isEliteOrAbove = function(playerId: string) {
  const role = this.getPlayerRole(playerId);
  return role === "elite" || role === "officer" || role === "leader";
};

guildSchema.methods.canManageMembers = function(playerId: string) {
  return this.isOfficer(playerId);
};

guildSchema.methods.canInviteMembers = function(playerId: string) {
  return this.isEliteOrAbove(playerId);
};

// 🔥 NOUVELLE MÉTHODE: Peut démarrer des quêtes spéciales (Elite+)
guildSchema.methods.canStartSpecialQuests = function(playerId: string) {
  return this.isEliteOrAbove(playerId);
};

guildSchema.methods.addActivityLog = function(logData: Partial<IGuildActivityLog>) {
  this.activityLogs.push({
    type: logData.type!,
    playerId: logData.playerId!,
    playerName: logData.playerName!,
    targetPlayerId: logData.targetPlayerId,
    targetPlayerName: logData.targetPlayerName,
    details: logData.details,
    timestamp: logData.timestamp || new Date()
  });
  
  if (this.activityLogs.length > 100) {
    this.activityLogs = this.activityLogs.slice(-100);
  }
  
  return Promise.resolve(this);
};

guildSchema.methods.updateStats = function() {
  const members = this.members;
  
  this.stats.totalMembers = members.length;
  this.stats.averageLevel = members.length > 0 ? 
    Math.round(members.reduce((sum: number, m: IGuildMember) => sum + m.playerLevel, 0) / members.length) : 0;
  this.stats.totalPower = members.reduce((sum: number, m: IGuildMember) => sum + m.playerPower, 0);
  this.stats.averagePower = members.length > 0 ? 
    Math.round(this.stats.totalPower / members.length) : 0;
  
  return this.save();
};

guildSchema.methods.cleanupExpiredInvitations = function() {
  const now = new Date();
  this.invitations = this.invitations.filter((inv: IGuildInvitation) => {
    if (inv.status === "pending" && inv.expiresAt < now) {
      inv.status = "expired";
      return false;
    }
    return inv.status === "pending";
  });
  
  return this.save();
};

guildSchema.methods.resetDailyProgress = function() {
  this.members.forEach((member: IGuildMember) => {
    member.contributionDaily = 0;
  });
  
  this.rewards.dailyRewards.claimedBy = [];
  this.rewards.dailyRewards.lastClaimTime = new Date();
  
  return this.save();
};

guildSchema.methods.resetWeeklyProgress = function() {
  this.members.forEach((member: IGuildMember) => {
    member.contributionWeekly = 0;
  });
  
  this.rewards.weeklyRewards.claimedBy = [];
  this.rewards.weeklyRewards.lastClaimTime = new Date();
  
  this.currentQuests = this.currentQuests.filter((quest: IGuildQuest) => 
    !quest.isCompleted && quest.endDate > new Date()
  );
  
  return this.save();
};

export default mongoose.model<IGuildDocument>("Guild", guildSchema);

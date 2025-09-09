import Guild, { IGuildDocument } from "../../models/Guild";

export interface GuildSearchResult {
  guilds: Array<{
    guildId: string;
    name: string;
    tag: string;
    level: number;
    memberCount: number;
    maxMembers: number;
    isPublic: boolean;
    minimumLevel: number;
    minimumPower: number;
    language: string;
    description: string;
    totalPower: number;
    canJoin: boolean;
  }>;
  totalCount: number;
  page: number;
  limit: number;
}

export interface GuildLeaderboardEntry {
  guildId: string;
  name: string;
  tag: string;
  level: number;
  totalPower: number;
  memberCount: number;
  rank: number;
}

export interface ServerGuildStatistics {
  totalGuilds: number;
  activeGuilds: number;
  totalMembers: number;
  averageMembersPerGuild: number;
  averageGuildLevel: number;
  topGuildByPower: string;
  topGuildByLevel: string;
  topGuildByMembers: string;
}

export class GuildSearchService {

  static async searchGuilds(
    serverId: string,
    filters: {
      name?: string;
      tag?: string;
      minLevel?: number;
      maxLevel?: number;
      minMembers?: number;
      maxMembers?: number;
      minPower?: number;
      maxPower?: number;
      language?: string;
      hasSpace?: boolean;
      isPublic?: boolean;
    } = {},
    page: number = 1,
    limit: number = 20
  ): Promise<GuildSearchResult> {
    try {
      const query: any = { serverId, status: "active" };

      if (filters.name) {
        query.name = new RegExp(filters.name, 'i');
      }
      if (filters.tag) {
        query.tag = new RegExp(filters.tag.toUpperCase(), 'i');
      }
      if (filters.minLevel) {
        query.level = { ...query.level, $gte: filters.minLevel };
      }
      if (filters.maxLevel) {
        query.level = { ...query.level, $lte: filters.maxLevel };
      }
      if (filters.minMembers) {
        query.memberCount = { ...query.memberCount, $gte: filters.minMembers };
      }
      if (filters.maxMembers) {
        query.memberCount = { ...query.memberCount, $lte: filters.maxMembers };
      }
      if (filters.minPower) {
        query["stats.totalPower"] = { ...query["stats.totalPower"], $gte: filters.minPower };
      }
      if (filters.maxPower) {
        query["stats.totalPower"] = { ...query["stats.totalPower"], $lte: filters.maxPower };
      }
      if (filters.language) {
        query["settings.language"] = filters.language;
      }
      if (filters.isPublic !== undefined) {
        query["settings.isPublic"] = filters.isPublic;
      }
      if (filters.hasSpace) {
        query.$expr = { $lt: ["$memberCount", "$maxMembers"] };
      }

      const skip = (page - 1) * limit;
      const totalCount = await Guild.countDocuments(query);
      
      const guilds = await Guild.find(query)
        .select('name tag level memberCount maxMembers settings stats description')
        .sort({ level: -1, "stats.totalPower": -1, memberCount: -1 })
        .skip(skip)
        .limit(limit);

      const formattedGuilds = guilds.map(guild => ({
        guildId: guild._id,
        name: guild.name,
        tag: guild.tag,
        level: guild.level,
        memberCount: guild.memberCount,
        maxMembers: guild.maxMembers,
        isPublic: guild.settings.isPublic,
        minimumLevel: guild.settings.minimumLevel,
        minimumPower: guild.settings.minimumPower,
        language: guild.settings.language,
        description: guild.description,
        totalPower: guild.stats.totalPower,
        canJoin: guild.memberCount < guild.maxMembers && guild.settings.isPublic
      }));

      return {
        guilds: formattedGuilds,
        totalCount,
        page,
        limit
      };

    } catch (error) {
      console.error("❌ Error searching guilds:", error);
      return { guilds: [], totalCount: 0, page, limit };
    }
  }

  static async getGuildLeaderboard(
    serverId: string, 
    type: "level" | "power" | "members" = "power", 
    limit: number = 100
  ): Promise<GuildLeaderboardEntry[]> {
    try {
      let sortField: any;
      switch (type) {
        case "level":
          sortField = { level: -1, "stats.totalPower": -1 };
          break;
        case "power":
          sortField = { "stats.totalPower": -1, level: -1 };
          break;
        case "members":
          sortField = { memberCount: -1, level: -1 };
          break;
        default:
          sortField = { "stats.totalPower": -1, level: -1 };
      }

      const guilds = await Guild.find({ serverId, status: "active" })
        .select('name tag level stats.totalPower memberCount')
        .sort(sortField)
        .limit(limit);

      return guilds.map((guild, index) => ({
        guildId: guild._id,
        name: guild.name,
        tag: guild.tag,
        level: guild.level,
        totalPower: guild.stats?.totalPower || 0,
        memberCount: guild.memberCount,
        rank: index + 1
      }));

    } catch (error) {
      console.error("❌ Error getting guild leaderboard:", error);
      return [];
    }
  }

  static async getServerStatistics(serverId: string): Promise<ServerGuildStatistics> {
    try {
      const allGuilds = await Guild.find({ serverId });
      const activeGuilds = allGuilds.filter(g => g.status === "active");
      
      if (activeGuilds.length === 0) {
        return {
          totalGuilds: allGuilds.length,
          activeGuilds: 0,
          totalMembers: 0,
          averageMembersPerGuild: 0,
          averageGuildLevel: 0,
          topGuildByPower: "None",
          topGuildByLevel: "None",
          topGuildByMembers: "None"
        };
      }

      const totalMembers = activeGuilds.reduce((sum, guild) => sum + guild.memberCount, 0);
      const averageMembersPerGuild = Math.round(totalMembers / activeGuilds.length);
      const averageGuildLevel = Math.round(activeGuilds.reduce((sum, guild) => sum + guild.level, 0) / activeGuilds.length);
      
      const topByPower = activeGuilds.sort((a, b) => b.stats.totalPower - a.stats.totalPower)[0];
      const topByLevel = activeGuilds.sort((a, b) => b.level - a.level)[0];
      const topByMembers = activeGuilds.sort((a, b) => b.memberCount - a.memberCount)[0];

      return {
        totalGuilds: allGuilds.length,
        activeGuilds: activeGuilds.length,
        totalMembers,
        averageMembersPerGuild,
        averageGuildLevel,
        topGuildByPower: topByPower ? `${topByPower.name} [${topByPower.tag}]` : "None",
        topGuildByLevel: topByLevel ? `${topByLevel.name} [${topByLevel.tag}]` : "None",
        topGuildByMembers: topByMembers ? `${topByMembers.name} [${topByMembers.tag}]` : "None"
      };

    } catch (error) {
      console.error("❌ Error getting server statistics:", error);
      return {
        totalGuilds: 0,
        activeGuilds: 0,
        totalMembers: 0,
        averageMembersPerGuild: 0,
        averageGuildLevel: 0,
        topGuildByPower: "None",
        topGuildByLevel: "None",
        topGuildByMembers: "None"
      };
    }
  }

  static async getRecommendedGuilds(
    serverId: string,
    playerLevel: number,
    playerPower: number,
    language: string = "en",
    limit: number = 10
  ): Promise<GuildSearchResult["guilds"]> {
    try {
      const query = {
        serverId,
        status: "active",
        "settings.isPublic": true,
        "settings.minimumLevel": { $lte: playerLevel },
        "settings.minimumPower": { $lte: playerPower },
        $expr: { $lt: ["$memberCount", "$maxMembers"] }
      };

      const guilds = await Guild.find(query)
        .select('name tag level memberCount maxMembers settings stats description')
        .sort({ 
          "settings.language": language === "en" ? 1 : -1,
          level: -1, 
          "stats.totalPower": -1 
        })
        .limit(limit);

      return guilds.map(guild => ({
        guildId: guild._id,
        name: guild.name,
        tag: guild.tag,
        level: guild.level,
        memberCount: guild.memberCount,
        maxMembers: guild.maxMembers,
        isPublic: guild.settings.isPublic,
        minimumLevel: guild.settings.minimumLevel,
        minimumPower: guild.settings.minimumPower,
        language: guild.settings.language,
        description: guild.description,
        totalPower: guild.stats.totalPower,
        canJoin: true
      }));

    } catch (error) {
      console.error("❌ Error getting recommended guilds:", error);
      return [];
    }
  }

  static async getGuildsByActivity(
    serverId: string,
    activityType: "most_active" | "recruiting" | "high_level" | "beginner_friendly",
    limit: number = 20
  ): Promise<GuildSearchResult["guilds"]> {
    try {
      let query: any = { serverId, status: "active" };
      let sort: any = {};

      switch (activityType) {
        case "most_active":
          query["stats.dailyActivity"] = { $gte: 10 };
          sort = { "stats.dailyActivity": -1, level: -1 };
          break;
        
        case "recruiting":
          query["settings.isPublic"] = true;
          query.$expr = { $lt: ["$memberCount", { $multiply: ["$maxMembers", 0.8] }] };
          sort = { level: -1, "stats.totalPower": -1 };
          break;
        
        case "high_level":
          query.level = { $gte: 20 };
          query["settings.minimumLevel"] = { $gte: 50 };
          sort = { level: -1, "stats.totalPower": -1 };
          break;
        
        case "beginner_friendly":
          query["settings.minimumLevel"] = { $lte: 10 };
          query["settings.minimumPower"] = { $lte: 10000 };
          query["settings.isPublic"] = true;
          sort = { "settings.autoAccept": -1, level: -1 };
          break;
        
        default:
          sort = { level: -1 };
      }

      const guilds = await Guild.find(query)
        .select('name tag level memberCount maxMembers settings stats description')
        .sort(sort)
        .limit(limit);

      return guilds.map(guild => ({
        guildId: guild._id,
        name: guild.name,
        tag: guild.tag,
        level: guild.level,
        memberCount: guild.memberCount,
        maxMembers: guild.maxMembers,
        isPublic: guild.settings.isPublic,
        minimumLevel: guild.settings.minimumLevel,
        minimumPower: guild.settings.minimumPower,
        language: guild.settings.language,
        description: guild.description,
        totalPower: guild.stats.totalPower,
        canJoin: guild.memberCount < guild.maxMembers && guild.settings.isPublic
      }));

    } catch (error) {
      console.error("❌ Error getting guilds by activity:", error);
      return [];
    }
  }

  static async searchGuildsByName(serverId: string, searchTerm: string, limit: number = 10): Promise<GuildSearchResult["guilds"]> {
    try {
      const nameRegex = new RegExp(searchTerm, 'i');
      const tagRegex = new RegExp(searchTerm.toUpperCase(), 'i');

      const guilds = await Guild.find({
        serverId,
        status: "active",
        $or: [
          { name: nameRegex },
          { tag: tagRegex }
        ]
      })
      .select('name tag level memberCount maxMembers settings stats description')
      .sort({ level: -1, "stats.totalPower": -1 })
      .limit(limit);

      return guilds.map(guild => ({
        guildId: guild._id,
        name: guild.name,
        tag: guild.tag,
        level: guild.level,
        memberCount: guild.memberCount,
        maxMembers: guild.maxMembers,
        isPublic: guild.settings.isPublic,
        minimumLevel: guild.settings.minimumLevel,
        minimumPower: guild.settings.minimumPower,
        language: guild.settings.language,
        description: guild.description,
        totalPower: guild.stats.totalPower,
        canJoin: guild.memberCount < guild.maxMembers && guild.settings.isPublic
      }));

    } catch (error) {
      console.error("❌ Error searching guilds by name:", error);
      return [];
    }
  }

  static async getTopGuildsGlobal(limit: number = 50): Promise<Array<GuildLeaderboardEntry & { serverId: string }>> {
    try {
      const guilds = await Guild.find({ status: "active" })
        .select('name tag level stats.totalPower memberCount serverId')
        .sort({ "stats.totalPower": -1, level: -1 })
        .limit(limit);

      return guilds.map((guild, index) => ({
        guildId: guild._id,
        name: guild.name,
        tag: guild.tag,
        level: guild.level,
        totalPower: guild.stats?.totalPower || 0,
        memberCount: guild.memberCount,
        serverId: guild.serverId,
        rank: index + 1
      }));

    } catch (error) {
      console.error("❌ Error getting top guilds global:", error);
      return [];
    }
  }
}

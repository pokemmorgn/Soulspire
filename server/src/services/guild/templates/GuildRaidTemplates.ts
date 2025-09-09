export interface RaidTemplate {
  name: string;
  description: string;
  maxParticipants: number;
  baseBossHealth: number;
  duration: number; // en heures
  baseRewards: {
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
}

export const GUILD_BOSS_TEMPLATES: Record<string, RaidTemplate> = {
  ancient_dragon: {
    name: "Ancient Dragon",
    description: "Defeat the ancient fire dragon threatening the realm",
    maxParticipants: 20,
    baseBossHealth: 1000000,
    duration: 24,
    baseRewards: {
      guildCoins: 5000,
      guildExp: 10000,
      memberRewards: [
        {
          tier: "mvp",
          requirements: { topDamage: true },
          rewards: { 
            gold: 50000, 
            gems: 1000, 
            materials: { "dragon_scale": 10, "fire_essence": 5 },
            exclusiveItems: ["dragon_slayer_title"]
          }
        },
        {
          tier: "top_10",
          requirements: { topDamageRank: 10 },
          rewards: { 
            gold: 25000, 
            gems: 500, 
            materials: { "dragon_scale": 5, "fire_essence": 2 }
          }
        },
        {
          tier: "participant",
          requirements: { participated: true },
          rewards: { 
            gold: 10000, 
            gems: 200, 
            materials: { "dragon_scale": 2, "fire_essence": 1 }
          }
        }
      ]
    }
  },

  frost_titan: {
    name: "Frost Titan",
    description: "Challenge the colossal ice titan from the frozen wastes",
    maxParticipants: 25,
    baseBossHealth: 1500000,
    duration: 36,
    baseRewards: {
      guildCoins: 7500,
      guildExp: 15000,
      memberRewards: [
        {
          tier: "mvp",
          requirements: { topDamage: true },
          rewards: { 
            gold: 75000, 
            gems: 1500, 
            materials: { "titan_crystal": 15, "ice_shard": 8 },
            exclusiveItems: ["frost_champion_title"]
          }
        },
        {
          tier: "top_10",
          requirements: { topDamageRank: 10 },
          rewards: { 
            gold: 37500, 
            gems: 750, 
            materials: { "titan_crystal": 8, "ice_shard": 4 }
          }
        },
        {
          tier: "participant",
          requirements: { participated: true },
          rewards: { 
            gold: 15000, 
            gems: 300, 
            materials: { "titan_crystal": 3, "ice_shard": 2 }
          }
        }
      ]
    }
  },

  shadow_lord: {
    name: "Shadow Lord",
    description: "Banish the lord of shadows back to the void",
    maxParticipants: 15,
    baseBossHealth: 800000,
    duration: 18,
    baseRewards: {
      guildCoins: 4000,
      guildExp: 8000,
      memberRewards: [
        {
          tier: "mvp",
          requirements: { topDamage: true },
          rewards: { 
            gold: 40000, 
            gems: 800, 
            materials: { "void_fragment": 12, "shadow_essence": 6 },
            exclusiveItems: ["shadow_bane_title"]
          }
        },
        {
          tier: "top_10",
          requirements: { topDamageRank: 10 },
          rewards: { 
            gold: 20000, 
            gems: 400, 
            materials: { "void_fragment": 6, "shadow_essence": 3 }
          }
        },
        {
          tier: "participant",
          requirements: { participated: true },
          rewards: { 
            gold: 8000, 
            gems: 160, 
            materials: { "void_fragment": 2, "shadow_essence": 1 }
          }
        }
      ]
    }
  }
};

export const TERRITORY_WAR_TEMPLATES: Record<string, RaidTemplate> = {
  desert_stronghold: {
    name: "Desert Stronghold",
    description: "Conquer the fortified desert stronghold",
    maxParticipants: 30,
    baseBossHealth: 2000000,
    duration: 48,
    baseRewards: {
      guildCoins: 10000,
      guildExp: 20000,
      memberRewards: [
        {
          tier: "mvp",
          requirements: { topDamage: true },
          rewards: { 
            gold: 100000, 
            gems: 2000, 
            materials: { "territory_token": 25, "conquest_medal": 10 },
            exclusiveItems: ["desert_conqueror_title"]
          }
        },
        {
          tier: "top_10",
          requirements: { topDamageRank: 10 },
          rewards: { 
            gold: 50000, 
            gems: 1000, 
            materials: { "territory_token": 12, "conquest_medal": 5 }
          }
        },
        {
          tier: "participant",
          requirements: { participated: true },
          rewards: { 
            gold: 20000, 
            gems: 400, 
            materials: { "territory_token": 5, "conquest_medal": 2 }
          }
        }
      ]
    }
  },

  mountain_fortress: {
    name: "Mountain Fortress",
    description: "Storm the impregnable mountain fortress",
    maxParticipants: 35,
    baseBossHealth: 2500000,
    duration: 72,
    baseRewards: {
      guildCoins: 15000,
      guildExp: 30000,
      memberRewards: [
        {
          tier: "mvp",
          requirements: { topDamage: true },
          rewards: { 
            gold: 150000, 
            gems: 3000, 
            materials: { "territory_token": 40, "fortress_key": 15 },
            exclusiveItems: ["mountain_lord_title"]
          }
        },
        {
          tier: "top_10",
          requirements: { topDamageRank: 10 },
          rewards: { 
            gold: 75000, 
            gems: 1500, 
            materials: { "territory_token": 20, "fortress_key": 8 }
          }
        },
        {
          tier: "participant",
          requirements: { participated: true },
          rewards: { 
            gold: 30000, 
            gems: 600, 
            materials: { "territory_token": 8, "fortress_key": 3 }
          }
        }
      ]
    }
  },

  ocean_citadel: {
    name: "Ocean Citadel",
    description: "Assault the floating citadel on the high seas",
    maxParticipants: 25,
    baseBossHealth: 1800000,
    duration: 60,
    baseRewards: {
      guildCoins: 12000,
      guildExp: 25000,
      memberRewards: [
        {
          tier: "mvp",
          requirements: { topDamage: true },
          rewards: { 
            gold: 120000, 
            gems: 2400, 
            materials: { "territory_token": 30, "sea_crystal": 12 },
            exclusiveItems: ["sea_master_title"]
          }
        },
        {
          tier: "top_10",
          requirements: { topDamageRank: 10 },
          rewards: { 
            gold: 60000, 
            gems: 1200, 
            materials: { "territory_token": 15, "sea_crystal": 6 }
          }
        },
        {
          tier: "participant",
          requirements: { participated: true },
          rewards: { 
            gold: 24000, 
            gems: 480, 
            materials: { "territory_token": 6, "sea_crystal": 2 }
          }
        }
      ]
    }
  }
};

export const SPECIAL_EVENT_TEMPLATES: Record<string, RaidTemplate> = {
  world_boss_kraken: {
    name: "World Boss: Kraken",
    description: "Face the legendary kraken that threatens all guilds",
    maxParticipants: 50,
    baseBossHealth: 5000000,
    duration: 168, // 1 semaine
    baseRewards: {
      guildCoins: 25000,
      guildExp: 50000,
      memberRewards: [
        {
          tier: "mvp",
          requirements: { topDamage: true },
          rewards: { 
            gold: 250000, 
            gems: 5000, 
            materials: { "kraken_tentacle": 50, "legendary_pearl": 25 },
            exclusiveItems: ["kraken_slayer_title", "legendary_trident"]
          }
        },
        {
          tier: "top_10",
          requirements: { topDamageRank: 10 },
          rewards: { 
            gold: 125000, 
            gems: 2500, 
            materials: { "kraken_tentacle": 25, "legendary_pearl": 12 }
          }
        },
        {
          tier: "participant",
          requirements: { participated: true },
          rewards: { 
            gold: 50000, 
            gems: 1000, 
            materials: { "kraken_tentacle": 10, "legendary_pearl": 5 }
          }
        }
      ]
    }
  }
};

export function getRaidTemplate(raidType: "guild_boss" | "territory_war" | "special_event", templateId: string): RaidTemplate | null {
  switch (raidType) {
    case "guild_boss":
      return GUILD_BOSS_TEMPLATES[templateId] || null;
    case "territory_war":
      return TERRITORY_WAR_TEMPLATES[templateId] || null;
    case "special_event":
      return SPECIAL_EVENT_TEMPLATES[templateId] || null;
    default:
      return null;
  }
}

export function getAvailableRaidTemplates(raidType: "guild_boss" | "territory_war" | "special_event"): string[] {
  switch (raidType) {
    case "guild_boss":
      return Object.keys(GUILD_BOSS_TEMPLATES);
    case "territory_war":
      return Object.keys(TERRITORY_WAR_TEMPLATES);
    case "special_event":
      return Object.keys(SPECIAL_EVENT_TEMPLATES);
    default:
      return [];
  }
}

export function calculateRaidRewards(template: RaidTemplate, difficulty: number): RaidTemplate {
  return {
    ...template,
    baseBossHealth: template.baseBossHealth * difficulty,
    baseRewards: {
      guildCoins: template.baseRewards.guildCoins * difficulty,
      guildExp: template.baseRewards.guildExp * difficulty,
      memberRewards: template.baseRewards.memberRewards.map(reward => ({
        ...reward,
        rewards: {
          ...reward.rewards,
          gold: reward.rewards.gold * difficulty,
          gems: reward.rewards.gems * difficulty,
          materials: Object.fromEntries(
            Object.entries(reward.rewards.materials).map(([key, value]) => [key, value * difficulty])
          )
        }
      }))
    }
  };
}

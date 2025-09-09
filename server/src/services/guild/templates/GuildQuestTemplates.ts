export interface QuestTemplate {
  name: string;
  description: string;
  targetValue: number;
  rewards: {
    guildExp: number;
    guildCoins: number;
    memberRewards: {
      gold: number;
      gems: number;
      materials?: Record<string, number>;
    };
  };
}

export const DAILY_QUEST_TEMPLATES: Record<string, QuestTemplate> = {
  daily_contribution: {
    name: "Daily Contributions",
    description: "Contribute 50,000 gold to the guild bank",
    targetValue: 50000,
    rewards: {
      guildExp: 1000,
      guildCoins: 500,
      memberRewards: { gold: 2000, gems: 50 }
    }
  },

  daily_battles: {
    name: "Guild Battles",
    description: "Complete 100 battles as a guild",
    targetValue: 100,
    rewards: {
      guildExp: 800,
      guildCoins: 400,
      memberRewards: { gold: 1500, gems: 30 }
    }
  },

  daily_summons: {
    name: "Daily Summons",
    description: "Perform 50 hero summons across the guild",
    targetValue: 50,
    rewards: {
      guildExp: 1200,
      guildCoins: 600,
      memberRewards: { gold: 2500, gems: 75 }
    }
  },

  daily_tower: {
    name: "Tower Progress",
    description: "Clear 30 tower floors as a guild",
    targetValue: 30,
    rewards: {
      guildExp: 900,
      guildCoins: 450,
      memberRewards: { gold: 1800, gems: 40 }
    }
  },

  daily_campaign: {
    name: "Campaign Push",
    description: "Complete 200 campaign stages as a guild",
    targetValue: 200,
    rewards: {
      guildExp: 1100,
      guildCoins: 550,
      memberRewards: { gold: 2200, gems: 60 }
    }
  }
};

export const WEEKLY_QUEST_TEMPLATES: Record<string, QuestTemplate> = {
  weekly_power: {
    name: "Power Growth",
    description: "Increase total guild power by 500,000",
    targetValue: 500000,
    rewards: {
      guildExp: 5000,
      guildCoins: 2000,
      memberRewards: { gold: 10000, gems: 200 }
    }
  },

  weekly_heroes: {
    name: "Hero Collection",
    description: "Summon 300 new heroes across the guild",
    targetValue: 300,
    rewards: {
      guildExp: 6000,
      guildCoins: 2500,
      memberRewards: { gold: 12000, gems: 250 }
    }
  },

  weekly_ascension: {
    name: "Hero Ascension",
    description: "Ascend 50 heroes to higher tiers",
    targetValue: 50,
    rewards: {
      guildExp: 7000,
      guildCoins: 3000,
      memberRewards: { 
        gold: 15000, 
        gems: 300,
        materials: { "ascension_crystal": 5 }
      }
    }
  },

  weekly_arena: {
    name: "Arena Domination",
    description: "Win 500 arena battles as a guild",
    targetValue: 500,
    rewards: {
      guildExp: 4500,
      guildCoins: 1800,
      memberRewards: { gold: 9000, gems: 180 }
    }
  },

  weekly_equipment: {
    name: "Equipment Mastery",
    description: "Forge 100 pieces of equipment",
    targetValue: 100,
    rewards: {
      guildExp: 5500,
      guildCoins: 2200,
      memberRewards: { 
        gold: 11000, 
        gems: 220,
        materials: { "forge_stone": 10 }
      }
    }
  }
};

export const SPECIAL_QUEST_TEMPLATES: Record<string, QuestTemplate> = {
  special_legendary: {
    name: "Legendary Hunt",
    description: "Summon 10 legendary heroes as a guild",
    targetValue: 10,
    rewards: {
      guildExp: 10000,
      guildCoins: 5000,
      memberRewards: { 
        gold: 25000, 
        gems: 500,
        materials: { "legendary_essence": 3 }
      }
    }
  },

  special_raid_master: {
    name: "Raid Masters",
    description: "Complete 5 guild raids successfully",
    targetValue: 5,
    rewards: {
      guildExp: 15000,
      guildCoins: 7500,
      memberRewards: { 
        gold: 40000, 
        gems: 800,
        materials: { "raid_token": 20 }
      }
    }
  },

  special_unity: {
    name: "Guild Unity",
    description: "Have all members contribute on the same day",
    targetValue: 1,
    rewards: {
      guildExp: 8000,
      guildCoins: 4000,
      memberRewards: { 
        gold: 20000, 
        gems: 400,
        materials: { "unity_crystal": 1 }
      }
    }
  }
};

export function getQuestTemplate(questType: "daily" | "weekly" | "special", templateId: string): QuestTemplate | null {
  switch (questType) {
    case "daily":
      return DAILY_QUEST_TEMPLATES[templateId] || null;
    case "weekly":
      return WEEKLY_QUEST_TEMPLATES[templateId] || null;
    case "special":
      return SPECIAL_QUEST_TEMPLATES[templateId] || null;
    default:
      return null;
  }
}

export function getAvailableQuestTemplates(questType: "daily" | "weekly" | "special"): string[] {
  switch (questType) {
    case "daily":
      return Object.keys(DAILY_QUEST_TEMPLATES);
    case "weekly":
      return Object.keys(WEEKLY_QUEST_TEMPLATES);
    case "special":
      return Object.keys(SPECIAL_QUEST_TEMPLATES);
    default:
      return [];
  }
}

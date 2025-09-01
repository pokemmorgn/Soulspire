import mongoose from "mongoose";
import dotenv from "dotenv";
import { MissionTemplate } from "../models/Missions";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Templates de missions quotidiennes
const dailyMissionTemplates = [
  {
    missionId: "daily_login",
    name: "Daily Login",
    description: "Connect to the game today",
    type: "daily",
    category: "login",
    condition: {
      type: "login",
      targetValue: 1
    },
    rewards: [
      { type: "currency", quantity: 100, currencyType: "gold" },
      { type: "currency", quantity: 5, currencyType: "gems" }
    ],
    priority: 10,
    minPlayerLevel: 1,
    spawnWeight: 100 // Toujours présent
  },
  {
    missionId: "daily_campaign_battles",
    name: "Campaign Warrior",
    description: "Win 3 campaign battles",
    type: "daily",
    category: "battle",
    condition: {
      type: "battle_wins",
      targetValue: 3,
      battleConditions: {
        battleType: "campaign",
        winRequired: true
      }
    },
    rewards: [
      { type: "currency", quantity: 500, currencyType: "gold" },
      { type: "currency", quantity: 10, currencyType: "gems" }
    ],
    priority: 8,
    minPlayerLevel: 1,
    spawnWeight: 90
  },
  {
    missionId: "daily_tower_climb",
    name: "Tower Climber",
    description: "Clear 2 tower floors",
    type: "daily",
    category: "progression",
    condition: {
      type: "tower_floors",
      targetValue: 2
    },
    rewards: [
      { type: "currency", quantity: 300, currencyType: "gold" },
      { type: "material", quantity: 3, materialId: "enhancement_stone" }
    ],
    priority: 7,
    minPlayerLevel: 5,
    spawnWeight: 80
  },
  {
    missionId: "daily_gacha_summon",
    name: "Summon Heroes",
    description: "Perform 5 hero summons",
    type: "daily",
    category: "collection",
    condition: {
      type: "gacha_pulls",
      targetValue: 5
    },
    rewards: [
      { type: "currency", quantity: 200, currencyType: "gold" },
      { type: "currency", quantity: 1, currencyType: "tickets" }
    ],
    priority: 6,
    minPlayerLevel: 3,
    spawnWeight: 70
  },
  {
    missionId: "daily_gold_spending",
    name: "Big Spender",
    description: "Spend 2000 gold",
    type: "daily",
    category: "progression",
    condition: {
      type: "gold_spent",
      targetValue: 2000
    },
    rewards: [
      { type: "currency", quantity: 15, currencyType: "gems" },
      { type: "material", quantity: 2, materialId: "rare_crystal" }
    ],
    priority: 5,
    minPlayerLevel: 10,
    spawnWeight: 60
  },
  {
    missionId: "daily_arena_battles",
    name: "Arena Fighter",
    description: "Win 2 arena battles",
    type: "daily",
    category: "battle",
    condition: {
      type: "battle_wins",
      targetValue: 2,
      battleConditions: {
        battleType: "arena",
        winRequired: true
      }
    },
    rewards: [
      { type: "currency", quantity: 400, currencyType: "gold" },
      { type: "currency", quantity: 8, currencyType: "gems" }
    ],
    priority: 6,
    minPlayerLevel: 15,
    spawnWeight: 65
  }
];

// Templates de missions hebdomadaires
const weeklyMissionTemplates = [
  {
    missionId: "weekly_daily_missions",
    name: "Mission Master",
    description: "Complete 20 daily missions",
    type: "weekly",
    category: "progression",
    condition: {
      type: "daily_missions_completed",
      targetValue: 20
    },
    rewards: [
      { type: "currency", quantity: 2000, currencyType: "gold" },
      { type: "currency", quantity: 100, currencyType: "gems" },
      { type: "currency", quantity: 3, currencyType: "tickets" }
    ],
    priority: 9,
    minPlayerLevel: 1,
    spawnWeight: 95
  },
  {
    missionId: "weekly_tower_champion",
    name: "Tower Champion",
    description: "Reach tower floor 25",
    type: "weekly",
    category: "progression",
    condition: {
      type: "tower_floors",
      targetValue: 25
    },
    rewards: [
      { type: "currency", quantity: 1500, currencyType: "gold" },
      { type: "currency", quantity: 50, currencyType: "gems" },
      { type: "material", quantity: 10, materialId: "legendary_fragment" }
    ],
    priority: 8,
    minPlayerLevel: 10,
    spawnWeight: 80
  },
  {
    missionId: "weekly_battle_marathon",
    name: "Battle Marathon",
    description: "Win 50 battles of any type",
    type: "weekly",
    category: "battle",
    condition: {
      type: "battle_wins",
      targetValue: 50,
      battleConditions: {
        winRequired: true
      }
    },
    rewards: [
      { type: "currency", quantity: 3000, currencyType: "gold" },
      { type: "currency", quantity: 75, currencyType: "gems" },
      { type: "equipment", quantity: 1, equipmentData: { type: "Weapon", rarity: "Epic", level: 1 } }
    ],
    priority: 7,
    minPlayerLevel: 20,
    spawnWeight: 75
  },
  {
    missionId: "weekly_collector",
    name: "Hero Collector",
    description: "Perform 30 hero summons",
    type: "weekly",
    category: "collection",
    condition: {
      type: "gacha_pulls",
      targetValue: 30
    },
    rewards: [
      { type: "currency", quantity: 1000, currencyType: "gold" },
      { type: "currency", quantity: 200, currencyType: "gems" },
      { type: "fragment", quantity: 50, fragmentHeroId: "random_rare" }
    ],
    priority: 6,
    minPlayerLevel: 8,
    spawnWeight: 70
  }
];

// Templates d'accomplissements permanents
const achievementTemplates = [
  {
    missionId: "achievement_level_10",
    name: "Rising Star",
    description: "Reach player level 10",
    type: "achievement",
    category: "progression",
    condition: {
      type: "level_reached",
      targetValue: 10
    },
    rewards: [
      { type: "currency", quantity: 1000, currencyType: "gold" },
      { type: "currency", quantity: 50, currencyType: "gems" },
      { type: "title", quantity: 1, titleData: { titleId: "rising_star", name: "Rising Star", description: "Reached level 10" } }
    ],
    priority: 8,
    minPlayerLevel: 1,
    maxPlayerLevel: 9,
    spawnWeight: 100
  },
  {
    missionId: "achievement_level_25",
    name: "Experienced Fighter",
    description: "Reach player level 25",
    type: "achievement",
    category: "progression",
    condition: {
      type: "level_reached",
      targetValue: 25
    },
    rewards: [
      { type: "currency", quantity: 2500, currencyType: "gold" },
      { type: "currency", quantity: 150, currencyType: "gems" },
      { type: "hero", quantity: 1, heroId: "random_epic" }
    ],
    priority: 7,
    minPlayerLevel: 10,
    maxPlayerLevel: 24,
    spawnWeight: 100
  },
  {
    missionId: "achievement_level_50",
    name: "Veteran Warrior",
    description: "Reach player level 50",
    type: "achievement",
    category: "progression",
    condition: {
      type: "level_reached",
      targetValue: 50
    },
    rewards: [
      { type: "currency", quantity: 5000, currencyType: "gold" },
      { type: "currency", quantity: 500, currencyType: "gems" },
      { type: "hero", quantity: 1, heroId: "random_legendary" },
      { type: "title", quantity: 1, titleData: { titleId: "veteran_warrior", name: "Veteran Warrior", description: "Reached level 50" } }
    ],
    priority: 9,
    minPlayerLevel: 25,
    maxPlayerLevel: 49,
    spawnWeight: 100
  },
  {
    missionId: "achievement_heroes_10",
    name: "Hero Collector",
    description: "Own 10 different heroes",
    type: "achievement",
    category: "collection",
    condition: {
      type: "heroes_owned",
      targetValue: 10
    },
    rewards: [
      { type: "currency", quantity: 1500, currencyType: "gold" },
      { type: "currency", quantity: 100, currencyType: "gems" },
      { type: "currency", quantity: 5, currencyType: "tickets" }
    ],
    priority: 6,
    minPlayerLevel: 1,
    spawnWeight: 90
  },
  {
    missionId: "achievement_heroes_25",
    name: "Master Collector",
    description: "Own 25 different heroes",
    type: "achievement",
    category: "collection",
    condition: {
      type: "heroes_owned",
      targetValue: 25
    },
    rewards: [
      { type: "currency", quantity: 5000, currencyType: "gold" },
      { type: "currency", quantity: 300, currencyType: "gems" },
      { type: "hero", quantity: 1, heroId: "random_legendary" }
    ],
    priority: 8,
    minPlayerLevel: 20,
    spawnWeight: 100
  },
  {
    missionId: "achievement_tower_floor_50",
    name: "Tower Master",
    description: "Reach tower floor 50",
    type: "achievement",
    category: "progression",
    condition: {
      type: "tower_floors",
      targetValue: 50
    },
    rewards: [
      { type: "currency", quantity: 10000, currencyType: "gold" },
      { type: "currency", quantity: 500, currencyType: "gems" },
      { type: "title", quantity: 1, titleData: { titleId: "tower_master", name: "Tower Master", description: "Conquered 50 floors" } }
    ],
    priority: 9,
    minPlayerLevel: 15,
    spawnWeight: 100
  },
  {
    missionId: "achievement_battle_wins_100",
    name: "Battle Legend",
    description: "Win 100 battles total",
    type: "achievement",
    category: "battle",
    condition: {
      type: "battle_wins",
      targetValue: 100,
      battleConditions: {
        winRequired: true
      }
    },
    rewards: [
      { type: "currency", quantity: 3000, currencyType: "gold" },
      { type: "currency", quantity: 200, currencyType: "gems" },
      { type: "equipment", quantity: 1, equipmentData: { type: "Weapon", rarity: "Legendary", level: 1 } }
    ],
    priority: 7,
    minPlayerLevel: 10,
    spawnWeight: 85
  }
];

// Fonction principale de seed
const seedMissions = async (): Promise<void> => {
  try {
    console.log("🎯 === SEED DES MISSIONS ===\n");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connecté à MongoDB");

    // Supprimer les templates existants
    await MissionTemplate.deleteMany({});
    console.log("🗑️ Templates existants supprimés");

    let createdCount = 0;

    // Créer les missions quotidiennes
    console.log("\n📅 Création des missions quotidiennes...");
    for (const template of dailyMissionTemplates) {
      const mission = new MissionTemplate(template);
      await mission.save();
      console.log(`✅ ${template.name} (${template.missionId})`);
      createdCount++;
    }

    // Créer les missions hebdomadaires
    console.log("\n📆 Création des missions hebdomadaires...");
    for (const template of weeklyMissionTemplates) {
      const mission = new MissionTemplate(template);
      await mission.save();
      console.log(`✅ ${template.name} (${template.missionId})`);
      createdCount++;
    }

    // Créer les accomplissements
    console.log("\n🏆 Création des accomplissements...");
    for (const template of achievementTemplates) {
      const mission = new MissionTemplate(template);
      await mission.save();
      console.log(`✅ ${template.name} (${template.missionId})`);
      createdCount++;
    }

    // Statistiques finales
    console.log(`\n📊 === RÉSUMÉ DU SEED ===`);
    console.log(`Total créé: ${createdCount} templates`);
    console.log(`- Quotidiennes: ${dailyMissionTemplates.length}`);
    console.log(`- Hebdomadaires: ${weeklyMissionTemplates.length}`);
    console.log(`- Accomplissements: ${achievementTemplates.length}`);

    // Vérification en base
    const verification = await MissionTemplate.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log("\n✅ Vérification en base:");
    verification.forEach((stat: any) => {
      console.log(`   ${stat._id}: ${stat.count} templates`);
    });

    console.log("\n🎉 Seed des missions terminé avec succès !");
    console.log("Les joueurs peuvent maintenant recevoir des missions automatiquement !");

  } catch (error) {
    console.error("❌ Erreur lors du seed des missions:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Déconnecté de MongoDB");
  }
};

// Fonction pour créer des missions d'exemple spécifiques
export const createExampleMissions = async (): Promise<void> => {
  try {
    console.log("🎪 Création de missions d'exemple spéciales...");

    const specialMissions = [
      {
        missionId: "special_first_legendary",
        name: "First Legendary",
        description: "Obtain your first legendary hero",
        type: "achievement",
        category: "collection",
        condition: {
          type: "heroes_owned",
          targetValue: 1,
          heroConditions: {
            rarity: "Legendary"
          }
        },
        rewards: [
          { type: "currency", quantity: 10000, currencyType: "gold" },
          { type: "currency", quantity: 500, currencyType: "gems" },
          { type: "title", quantity: 1, titleData: { titleId: "legendary_hunter", name: "Legendary Hunter", description: "First legendary hero obtained" } }
        ],
        priority: 10,
        minPlayerLevel: 1,
        spawnWeight: 100
      },
      {
        missionId: "daily_hard_mode",
        name: "Challenge Seeker",
        description: "Win 1 battle on Hard difficulty",
        type: "daily",
        category: "battle",
        condition: {
          type: "battle_wins",
          targetValue: 1,
          battleConditions: {
            difficulty: "Hard",
            winRequired: true
          }
        },
        rewards: [
          { type: "currency", quantity: 800, currencyType: "gold" },
          { type: "currency", quantity: 25, currencyType: "gems" },
          { type: "material", quantity: 5, materialId: "rare_essence" }
        ],
        priority: 7,
        minPlayerLevel: 25,
        spawnWeight: 50
      },
      {
        missionId: "weekly_world_progress",
        name: "World Explorer",
        description: "Complete any world on Normal difficulty",
        type: "weekly",
        category: "progression",
        condition: {
          type: "battle_wins",
          targetValue: 10,
          battleConditions: {
            battleType: "campaign",
            difficulty: "Normal",
            minWorld: 1
          }
        },
        rewards: [
          { type: "currency", quantity: 2500, currencyType: "gold" },
          { type: "currency", quantity: 150, currencyType: "gems" },
          { type: "hero", quantity: 1, heroId: "random_epic" }
        ],
        priority: 8,
        minPlayerLevel: 15,
        spawnWeight: 80
      }
    ];

    for (const template of specialMissions) {
      const mission = new MissionTemplate(template);
      await mission.save();
      console.log(`✨ Mission spéciale créée: ${template.name}`);
    }

  } catch (error) {
    console.error("❌ Erreur création missions spéciales:", error);
    throw error;
  }
};

// Fonction d'aide pour l'utilisation
function showUsage() {
  console.log("\n🎯 === SCRIPT DE SEED DES MISSIONS ===");
  console.log("Ce script crée tous les templates de missions en base:");
  console.log("• 6 types de missions quotidiennes");
  console.log("• 4 types de missions hebdomadaires");
  console.log("• 7 accomplissements permanents");
  console.log("• Missions avec conditions et récompenses réalistes");
  console.log("\nLancement:");
  console.log("npx ts-node src/scripts/seedMissions.ts");
  console.log("");
}

// Exécuter le seed si ce fichier est appelé directement
if (require.main === module) {
  showUsage();
  seedMissions().then(() => process.exit(0));
}

export { seedMissions };

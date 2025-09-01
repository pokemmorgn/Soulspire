import mongoose from "mongoose";
import dotenv from "dotenv";
import Event from "../models/Events";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Utilitaire pour calculer les dates
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const addHours = (date: Date, hours: number): Date => {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
};

// Date de base pour les événements (maintenant)
const baseDate = new Date();

// === ÉVÉNEMENTS CROSS-SERVER ===
const crossServerEvents = [
  {
    eventId: "pvp_tournament_december_2024",
    name: "Cross-Server PvP Championship",
    description: "Battle players from all servers in the ultimate PvP tournament! Prove your strength across the realm!",
    type: "competition",
    category: "pvp",
    startTime: addDays(baseDate, 1), // Démarre demain
    endTime: addDays(baseDate, 8),   // Dure 7 jours
    timezone: "UTC",
    duration: 168, // 7 jours en heures
    
    serverConfig: {
      allowedServers: ["ALL"], // Tous les serveurs
      crossServerRanking: true,
      maxParticipants: 10000,
      participantsByServer: new Map()
    },
    
    requirements: [
      {
        type: "level",
        operator: "gte",
        value: 20,
        description: "Must be level 20 or higher"
      },
      {
        type: "heroes_owned",
        operator: "gte", 
        value: 5,
        description: "Must own at least 5 heroes"
      }
    ],
    
    objectives: [
      {
        objectiveId: "pvp_wins_10",
        type: "battle_wins",
        name: "Arena Warrior",
        description: "Win 10 arena battles",
        targetValue: 10,
        currentValue: 0,
        isCompleted: false,
        rewards: [
          {
            rewardId: "pvp_reward_1",
            type: "currency",
            name: "Arena Victory Bonus",
            description: "Gold and gems for arena victories",
            currencyData: { gold: 2000, gems: 100 }
          }
        ],
        battleConditions: {
          battleType: "arena",
          winRequired: true
        }
      },
      {
        objectiveId: "pvp_wins_25",
        type: "battle_wins", 
        name: "PvP Champion",
        description: "Win 25 arena battles",
        targetValue: 25,
        currentValue: 0,
        isCompleted: false,
        rewards: [
          {
            rewardId: "pvp_reward_2",
            type: "hero",
            name: "Champion's Hero",
            description: "Exclusive tournament hero",
            heroData: { heroId: "tournament_champion", level: 1, stars: 3, guaranteed: true }
          }
        ],
        battleConditions: {
          battleType: "arena",
          winRequired: true
        }
      }
    ],
    
    rankingRewards: [
      {
        rank: "1",
        rewards: [
          {
            rewardId: "rank_1_reward",
            type: "currency",
            name: "Grand Champion Prize",
            description: "Ultimate reward for 1st place",
            currencyData: { gold: 50000, gems: 2500, paidGems: 500 }
          },
          {
            rewardId: "rank_1_title",
            type: "title",
            name: "Cross-Server Champion",
            description: "Exclusive title for tournament winner",
            titleData: { titleId: "cross_server_champion", name: "⚔️ Cross-Server Champion", color: "#FFD700", duration: -1 }
          }
        ]
      },
      {
        rank: "2-5",
        rewards: [
          {
            rewardId: "rank_2_5_reward",
            type: "currency",
            name: "Elite Fighter Prize",
            description: "Top 5 reward",
            currencyData: { gold: 25000, gems: 1000, paidGems: 200 }
          }
        ]
      },
      {
        rank: "6-20",
        rewards: [
          {
            rewardId: "rank_6_20_reward",
            type: "currency",
            name: "Master Fighter Prize",
            description: "Top 20 reward",
            currencyData: { gold: 10000, gems: 500 }
          }
        ]
      },
      {
        rank: "21-100",
        rewards: [
          {
            rewardId: "rank_21_100_reward",
            type: "currency",
            name: "Veteran Fighter Prize", 
            description: "Top 100 reward",
            currencyData: { gold: 5000, gems: 200 }
          }
        ]
      }
    ],
    
    participants: [],
    status: "upcoming",
    isVisible: true,
    isAutoStart: true,
    bannerUrl: "https://example.com/pvp_tournament_banner.jpg",
    iconUrl: "https://example.com/pvp_tournament_icon.png",
    tags: ["pvp", "cross-server", "competition", "arena"],
    priority: 10,
    
    stats: {
      totalParticipants: 0,
      completedObjectives: 0,
      rewardsDistributed: 0,
      averagePoints: 0,
      topScore: 0
    }
  },
  
  {
    eventId: "tower_global_challenge_2024",
    name: "Global Tower Climbing Challenge",
    description: "Reach new heights in the tower! Compete with players from all servers to see who can climb the highest!",
    type: "competition",
    category: "pve",
    startTime: addDays(baseDate, 3),
    endTime: addDays(baseDate, 17), // 2 semaines
    timezone: "UTC", 
    duration: 336, // 14 jours
    
    serverConfig: {
      allowedServers: ["ALL"],
      crossServerRanking: true,
      maxParticipants: -1, // Illimité
      participantsByServer: new Map()
    },
    
    requirements: [
      {
        type: "level",
        operator: "gte",
        value: 10,
        description: "Must be level 10 or higher"
      }
    ],
    
    objectives: [
      {
        objectiveId: "tower_floor_20",
        type: "tower_floors",
        name: "Sky Walker",
        description: "Reach tower floor 20",
        targetValue: 20,
        currentValue: 0,
        isCompleted: false,
        rewards: [
          {
            rewardId: "tower_reward_1",
            type: "currency",
            name: "Climbing Bonus",
            description: "Reward for reaching floor 20",
            currencyData: { gold: 3000, gems: 150 }
          }
        ]
      },
      {
        objectiveId: "tower_floor_50", 
        type: "tower_floors",
        name: "Cloud Walker",
        description: "Reach tower floor 50",
        targetValue: 50,
        currentValue: 0,
        isCompleted: false,
        rewards: [
          {
            rewardId: "tower_reward_2",
            type: "equipment",
            name: "Sky Walker's Gear",
            description: "Special equipment for tower masters",
            equipmentData: { type: "Weapon", level: 10, stats: { atk: 200, def: 50, hp: 100 } }
          }
        ]
      },
      {
        objectiveId: "tower_floor_100",
        type: "tower_floors", 
        name: "Heaven Walker",
        description: "Reach the legendary floor 100",
        targetValue: 100,
        currentValue: 0,
        isCompleted: false,
        rewards: [
          {
            rewardId: "tower_reward_3",
            type: "hero",
            name: "Tower Guardian",
            description: "Legendary hero for tower masters",
            heroData: { heroId: "tower_guardian_legendary", level: 1, stars: 5, guaranteed: true }
          }
        ]
      }
    ],
    
    rankingRewards: [
      {
        rank: "1",
        rewards: [
          {
            rewardId: "tower_rank_1",
            type: "title",
            name: "Tower Conqueror",
            description: "Master of all towers",
            titleData: { titleId: "tower_conqueror", name: "🗼 Tower Conqueror", color: "#9932CC", duration: -1 }
          }
        ]
      }
    ],
    
    participants: [],
    status: "upcoming", 
    isVisible: true,
    isAutoStart: true,
    tags: ["tower", "pve", "cross-server", "climbing"],
    priority: 8,
    
    stats: {
      totalParticipants: 0,
      completedObjectives: 0,
      rewardsDistributed: 0,
      averagePoints: 0,
      topScore: 0
    }
  }
];

// === ÉVÉNEMENTS SERVEUR UNIQUE ===
const serverSpecificEvents = [
  {
    eventId: "s1_newbie_festival_2024",
    name: "Server Alpha Newbie Festival",
    description: "Welcome new players to Server Alpha! Special rewards and bonuses for beginners.",
    type: "special",
    category: "progression",
    startTime: addHours(baseDate, 6), // Dans 6h
    endTime: addDays(baseDate, 7),
    timezone: "UTC",
    duration: 162, // ~6.75 jours
    
    serverConfig: {
      allowedServers: ["S1"], // Seulement serveur S1
      crossServerRanking: false,
      maxParticipants: 1000,
      participantsByServer: new Map([["S1", 0]])
    },
    
    requirements: [
      {
        type: "level",
        operator: "lte", 
        value: 30,
        description: "Only for players level 30 or below"
      },
      {
        type: "server_age",
        operator: "lte",
        value: 14, // Compte créé il y a moins de 14 jours
        description: "Account must be less than 14 days old"
      }
    ],
    
    objectives: [
      {
        objectiveId: "newbie_login_7",
        type: "login_days",
        name: "Dedicated Newbie",
        description: "Login for 7 days during the event",
        targetValue: 7,
        currentValue: 0,
        isCompleted: false,
        rewards: [
          {
            rewardId: "newbie_login_reward",
            type: "hero",
            name: "Starter Champion",
            description: "Special hero for dedicated new players",
            heroData: { heroId: "starter_champion", level: 10, stars: 2, guaranteed: true }
          }
        ]
      },
      {
        objectiveId: "newbie_battles_10",
        type: "battle_wins",
        name: "Growing Strong",
        description: "Win 10 campaign battles",
        targetValue: 10,
        currentValue: 0,
        isCompleted: false,
        rewards: [
          {
            rewardId: "newbie_battle_reward",
            type: "currency",
            name: "Growth Bonus",
            description: "Resources to help you grow",
            currencyData: { gold: 10000, gems: 500, tickets: 10 }
          }
        ],
        battleConditions: {
          battleType: "campaign",
          winRequired: true
        }
      }
    ],
    
    rankingRewards: [],
    participants: [],
    status: "upcoming",
    isVisible: true,
    isAutoStart: true,
    tags: ["newbie", "server-specific", "s1", "beginner"],
    priority: 9,
    
    stats: {
      totalParticipants: 0,
      completedObjectives: 0,
      rewardsDistributed: 0,
      averagePoints: 0,
      topScore: 0
    }
  },
  
  {
    eventId: "s2_gacha_rate_up_2024",
    name: "Server Beta Legendary Rate Up",
    description: "Increased legendary drop rates for Server Beta players! Perfect time to summon!",
    type: "collection",
    category: "progression",
    startTime: addDays(baseDate, 2),
    endTime: addDays(baseDate, 5), // 3 jours
    timezone: "UTC",
    duration: 72,
    
    serverConfig: {
      allowedServers: ["S2"], // Seulement serveur S2
      crossServerRanking: false,
      maxParticipants: -1,
      participantsByServer: new Map([["S2", 0]])
    },
    
    requirements: [
      {
        type: "level",
        operator: "gte",
        value: 5,
        description: "Must be level 5 or higher"
      }
    ],
    
    objectives: [
      {
        objectiveId: "gacha_pulls_50",
        type: "gacha_pulls",
        name: "Lucky Summoner",
        description: "Perform 50 hero summons during rate up",
        targetValue: 50,
        currentValue: 0,
        isCompleted: false,
        rewards: [
          {
            rewardId: "gacha_milestone_reward",
            type: "currency",
            name: "Summoner's Bonus",
            description: "Extra resources for active summoning",
            currencyData: { gems: 500, tickets: 5 }
          }
        ]
      }
    ],
    
    rankingRewards: [
      {
        rank: "1-10",
        rewards: [
          {
            rewardId: "gacha_top_reward",
            type: "hero",
            name: "Gacha Master's Prize",
            description: "Exclusive reward for top summoners",
            heroData: { heroId: "gacha_master_exclusive", level: 1, stars: 4, guaranteed: true }
          }
        ]
      }
    ],
    
    participants: [],
    status: "upcoming",
    isVisible: true,
    isAutoStart: true,
    tags: ["gacha", "rate-up", "server-specific", "s2"],
    priority: 7,
    
    stats: {
      totalParticipants: 0,
      completedObjectives: 0,
      rewardsDistributed: 0,
      averagePoints: 0,
      topScore: 0
    }
  }
];

// === ÉVÉNEMENTS SAISONNIERS ===
const seasonalEvents = [
  {
    eventId: "halloween_candy_hunt_2024",
    name: "Halloween Candy Hunt",
    description: "Collect spooky candies by battling monsters! Trade them for exclusive Halloween rewards!",
    type: "collection",
    category: "seasonal",
    startTime: new Date("2024-10-25T00:00:00.000Z"), // Halloween period
    endTime: new Date("2024-11-02T23:59:59.000Z"),
    timezone: "UTC",
    duration: 192, // 8 jours
    
    serverConfig: {
      allowedServers: ["ALL"],
      crossServerRanking: true,
      maxParticipants: -1,
      participantsByServer: new Map()
    },
    
    requirements: [
      {
        type: "level",
        operator: "gte",
        value: 1,
        description: "All players welcome!"
      }
    ],
    
    objectives: [
      {
        objectiveId: "candy_collect_100",
        type: "collect_items",
        name: "Candy Collector",
        description: "Collect 100 Halloween candies",
        targetValue: 100,
        currentValue: 0,
        isCompleted: false,
        rewards: [
          {
            rewardId: "halloween_reward_1",
            type: "title",
            name: "Candy Hunter",
            description: "Halloween themed title",
            titleData: { titleId: "candy_hunter", name: "🎃 Candy Hunter", color: "#FF6600", duration: 365 }
          }
        ],
        collectConditions: {
          itemType: "material",
          specificIds: ["halloween_candy"]
        }
      },
      {
        objectiveId: "pumpkin_boss_defeat",
        type: "battle_wins",
        name: "Pumpkin King Slayer",
        description: "Defeat the Pumpkin King boss 5 times",
        targetValue: 5,
        currentValue: 0,
        isCompleted: false,
        rewards: [
          {
            rewardId: "halloween_reward_2",
            type: "hero",
            name: "Halloween Spirit",
            description: "Exclusive Halloween hero",
            heroData: { heroId: "halloween_spirit", level: 1, stars: 3, guaranteed: true }
          }
        ],
        battleConditions: {
          battleType: "campaign",
          enemyType: "boss"
        }
      }
    ],
    
    rankingRewards: [
      {
        rank: "1-100",
        rewards: [
          {
            rewardId: "halloween_top_reward",
            type: "avatar",
            name: "Spooky Avatar",
            description: "Exclusive Halloween avatar frame",
            titleData: { titleId: "spooky_avatar", name: "Spooky Frame", color: "#8B008B", duration: -1 }
          }
        ]
      }
    ],
    
    participants: [],
    status: "upcoming",
    isVisible: true,
    isAutoStart: true,
    bannerUrl: "https://example.com/halloween_banner.jpg",
    tags: ["halloween", "seasonal", "collection", "boss"],
    priority: 9,
    
    stats: {
      totalParticipants: 0,
      completedObjectives: 0,
      rewardsDistributed: 0,
      averagePoints: 0,
      topScore: 0
    }
  }
];

// Fonction principale de seed
const seedEvents = async (): Promise<void> => {
  try {
    console.log("🎪 === SEED DES ÉVÉNEMENTS ===\n");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connecté à MongoDB");

    // Supprimer les événements existants
    await Event.deleteMany({});
    console.log("🗑️ Événements existants supprimés");

    let createdCount = 0;

    // Créer les événements cross-server
    console.log("\n🌐 Création des événements cross-server...");
    for (const eventData of crossServerEvents) {
      const event = new Event(eventData);
      await event.save();
      console.log(`✅ ${eventData.name} (${eventData.eventId})`);
      console.log(`   📅 ${eventData.startTime.toISOString()} → ${eventData.endTime.toISOString()}`);
      console.log(`   🌍 Serveurs: ${eventData.serverConfig.allowedServers.join(", ")}`);
      createdCount++;
    }

    // Créer les événements serveur spécifique
    console.log("\n🏠 Création des événements serveur spécifique...");
    for (const eventData of serverSpecificEvents) {
      const event = new Event(eventData);
      await event.save();
      console.log(`✅ ${eventData.name} (${eventData.eventId})`);
      console.log(`   🏷️ Serveur: ${eventData.serverConfig.allowedServers.join(", ")}`);
      console.log(`   ⏰ Durée: ${eventData.duration}h`);
      createdCount++;
    }

    // Créer les événements saisonniers
    console.log("\n🎃 Création des événements saisonniers...");
    for (const eventData of seasonalEvents) {
      const event = new Event(eventData);
      await event.save();
      console.log(`✅ ${eventData.name} (${eventData.eventId})`);
      console.log(`   🎭 Catégorie: ${eventData.category}`);
      console.log(`   🏆 Objectifs: ${eventData.objectives.length}`);
      createdCount++;
    }

    // Statistiques finales
    console.log(`\n📊 === RÉSUMÉ DU SEED ===`);
    console.log(`Total créé: ${createdCount} événements`);
    console.log(`- Cross-server: ${crossServerEvents.length}`);
    console.log(`- Serveur spécifique: ${serverSpecificEvents.length}`);
    console.log(`- Saisonniers: ${seasonalEvents.length}`);

    // Vérification en base
    const verification = await Event.aggregate([
      { $group: { 
        _id: { type: "$type", category: "$category" }, 
        count: { $sum: 1 } 
      }},
      { $sort: { "_id.type": 1, "_id.category": 1 } }
    ]);

    console.log("\n✅ Vérification en base:");
    verification.forEach((stat: any) => {
      console.log(`   ${stat._id.type}/${stat._id.category}: ${stat.count} événements`);
    });

    console.log("\n🎉 Seed des événements terminé avec succès !");
    console.log("Les événements peuvent maintenant être consultés via /api/events/active");
    console.log("\n💡 Prochaines étapes:");
    console.log("- Utiliser POST /api/events/admin/{eventId}/start pour démarrer un événement");
    console.log("- Les joueurs peuvent rejoindre via POST /api/events/join");
    console.log("- Progression automatique via les autres services du jeu");

  } catch (error) {
    console.error("❌ Erreur lors du seed des événements:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Déconnecté de MongoDB");
  }
};

// Fonction pour créer des événements de test rapides
export const createTestEvents = async (): Promise<void> => {
  try {
    console.log("🧪 Création d'événements de test...");

    const testEvents = [
      {
        eventId: "test_quick_battle",
        name: "Quick Battle Test",
        description: "Fast battle event for testing",
        type: "battle",
        category: "pve",
        startTime: new Date(), // Maintenant
        endTime: addHours(new Date(), 2), // 2 heures
        timezone: "UTC",
        duration: 2,
        
        serverConfig: {
          allowedServers: ["S1"],
          crossServerRanking: false,
          maxParticipants: 100,
          participantsByServer: new Map([["S1", 0]])
        },
        
        requirements: [],
        
        objectives: [
          {
            objectiveId: "test_battle_5",
            type: "battle_wins", 
            name: "Quick Fighter",
            description: "Win 5 battles",
            targetValue: 5,
            currentValue: 0,
            isCompleted: false,
            rewards: [
              {
                rewardId: "test_reward",
                type: "currency",
                name: "Test Reward",
                description: "Quick test reward",
                currencyData: { gold: 1000, gems: 50 }
              }
            ]
          }
        ],
        
        rankingRewards: [],
        participants: [],
        status: "active", // Directement actif pour les tests
        isVisible: true,
        isAutoStart: true,
        tags: ["test", "quick"],
        priority: 1,
        
        stats: {
          totalParticipants: 0,
          completedObjectives: 0,
          rewardsDistributed: 0,
          averagePoints: 0,
          topScore: 0
        }
      }
    ];

    for (const eventData of testEvents) {
      const event = new Event(eventData);
      await event.save();
      console.log(`🧪 Événement de test créé: ${eventData.name}`);
    }

  } catch (error) {
    console.error("❌ Erreur création événements de test:", error);
    throw error;
  }
};

// Fonction d'aide pour l'utilisation
function showUsage() {
  console.log("\n🎪 === SCRIPT DE SEED DES ÉVÉNEMENTS ===");
  console.log("Ce script crée des événements d'exemple en base:");
  console.log("• 2 événements cross-server (PvP + Tour)");
  console.log("• 2 événements serveur spécifique (Newbie + Gacha)");
  console.log("• 1 événement saisonnier (Halloween)");
  console.log("• Événements avec objectifs multiples et récompenses de classement");
  console.log("\nLancement:");
  console.log("npx ts-node src/scripts/seedEvents.ts");
  console.log("");
}

// Exécuter le seed si ce fichier est appelé directement
if (require.main === module) {
  showUsage();
  seedEvents().then(() => process.exit(0));
}

export { seedEvents };

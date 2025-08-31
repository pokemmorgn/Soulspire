import mongoose from "mongoose";
import dotenv from "dotenv";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Vos héros du CSV uniquement
const heroesData = [
  {
    name: "Ignara",
    role: "DPS Ranged" as const,
    element: "Fire" as const,
    rarity: "Rare" as const,
    baseStats: { hp: 750, atk: 150, def: 62 },
    skill: {
      name: "Fire Magic",
      description: "Casts powerful fire spells",
      type: "Damage" as const
    }
  },
  {
    name: "Nereida",
    role: "Support" as const,
    element: "Water" as const,
    rarity: "Rare" as const,
    baseStats: { hp: 875, atk: 75, def: 100 },
    skill: {
      name: "Water Healing",
      description: "Heals allies with water magic",
      type: "Heal" as const
    }
  },
  {
    name: "Lyaria",
    role: "Support" as const,
    element: "Light" as const,
    rarity: "Rare" as const,
    baseStats: { hp: 875, atk: 75, def: 100 },
    skill: {
      name: "Divine Light",
      description: "Channels divine power to aid allies",
      type: "Heal" as const
    }
  },
  {
    name: "Kaelen",
    role: "DPS Melee" as const,
    element: "Wind" as const,
    rarity: "Rare" as const,
    baseStats: { hp: 1000, atk: 175, def: 87 },
    skill: {
      name: "Wind Strike",
      description: "Swift wind-powered attacks",
      type: "Damage" as const
    }
  },
  {
    name: "Zephyra",
    role: "DPS Ranged" as const,
    element: "Wind" as const,
    rarity: "Epic" as const,
    baseStats: { hp: 900, atk: 180, def: 75 },
    skill: {
      name: "Wind Arrow",
      description: "Powerful wind-enhanced archery",
      type: "Damage" as const
    }
  },
  {
    name: "Thorne",
    role: "Tank" as const,
    element: "Dark" as const,
    rarity: "Epic" as const,
    baseStats: { hp: 1800, atk: 120, def: 225 },
    skill: {
      name: "Shadow Defense",
      description: "Uses darkness to protect allies",
      type: "Buff" as const
    }
  },
  {
    name: "Vex",
    role: "DPS Melee" as const,
    element: "Dark" as const,
    rarity: "Epic" as const,
    baseStats: { hp: 1200, atk: 210, def: 105 },
    skill: {
      name: "Shadow Strike",
      description: "Deadly shadow-infused attacks",
      type: "Damage" as const
    }
  },
  {
    name: "Aurora",
    role: "Support" as const,
    element: "Light" as const,
    rarity: "Epic" as const,
    baseStats: { hp: 1050, atk: 90, def: 120 },
    skill: {
      name: "Aurora's Grace",
      description: "Powerful light-based support magic",
      type: "Buff" as const
    }
  },
  {
    name: "Stormbringer",
    role: "Tank" as const,
    element: "Electric" as const,
    rarity: "Legendary" as const,
    baseStats: { hp: 2400, atk: 160, def: 300 },
    skill: {
      name: "Thunder Guard",
      description: "Electric barrier that protects and counterattacks",
      type: "Control" as const
    }
  },
  {
    name: "Seraphine",
    role: "DPS Ranged" as const,
    element: "Wind" as const,
    rarity: "Legendary" as const,
    baseStats: { hp: 1200, atk: 240, def: 100 },
    skill: {
      name: "Tempest Shot",
      description: "Devastating wind-based ranged attacks",
      type: "AoE" as const
    }
  }
];

// Fonction de seed
const seedHeroes = async (): Promise<void> => {
  try {
    console.log("🌱 Starting hero seeding...");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Supprimer les héros existants
    await Hero.deleteMany({});
    console.log("🗑️ Cleared existing heroes");

    // Insérer vos héros
    for (const heroData of heroesData) {
      const hero = new Hero(heroData);
      await hero.save();
      console.log(`✅ Created hero: ${heroData.name} (${heroData.rarity} ${heroData.role})`);
    }

    console.log(`\n🎭 Successfully created ${heroesData.length} heroes`);

    // Statistiques
    const stats = {
      total: heroesData.length,
      byRarity: {} as Record<string, number>,
      byRole: {} as Record<string, number>,
      byElement: {} as Record<string, number>
    };

    heroesData.forEach(hero => {
      stats.byRarity[hero.rarity] = (stats.byRarity[hero.rarity] || 0) + 1;
      stats.byRole[hero.role] = (stats.byRole[hero.role] || 0) + 1;
      stats.byElement[hero.element] = (stats.byElement[hero.element] || 0) + 1;
    });

    console.log("\n📊 Hero Distribution:");
    console.log("By Rarity:", stats.byRarity);
    console.log("By Role:", stats.byRole);
    console.log("By Element:", stats.byElement);

    console.log("\n🎉 Hero seeding completed successfully!");
    
  } catch (error) {
    console.error("❌ Hero seeding failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Exécuter le seeding
if (require.main === module) {
  seedHeroes().then(() => process.exit(0));
}

export { seedHeroes };

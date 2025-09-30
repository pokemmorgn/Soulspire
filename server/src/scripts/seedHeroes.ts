import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import csvParser from "csv-parser";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// =====================
// Normalisation
// =====================
function normalizeRole(csvRole: string): "Tank" | "DPS Melee" | "DPS Ranged" | "Support" {
  const roleMap: Record<string, "Tank" | "DPS Melee" | "DPS Ranged" | "Support"> = {
    "Tank": "Tank",
    "Melee DPS": "DPS Melee",
    "Ranged DPS": "DPS Ranged",
    "Support": "Support"
  };
  return roleMap[csvRole?.trim()] || "Support";
}

function normalizeElement(csvElement: string): "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark" {
  const elementMap: Record<string, "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark"> = {
    "Fire": "Fire",
    "Water": "Water",
    "Wind": "Wind",
    "Electric": "Electric",
    "Light": "Light",
    "Shadow": "Dark", // CSV utilise Shadow
    "Dark": "Dark"
  };
  return elementMap[csvElement?.trim()] || "Fire";
}

// =====================
// Stats de base
// =====================
function calculateBaseStats(role: string, rarity: string) {
  const baseStatsByRole = {
    "Tank": { hp: 1200, atk: 80, def: 150 },
    "DPS Melee": { hp: 800, atk: 140, def: 70 },
    "DPS Ranged": { hp: 600, atk: 120, def: 50 },
    "Support": { hp: 700, atk: 60, def: 80 }
  };

  const rarityMultipliers = {
    "Common": 1.0,
    "Rare": 1.25,
    "Epic": 1.5,
    "Legendary": 2.0
  };

  const baseStats = baseStatsByRole[role as keyof typeof baseStatsByRole] || { hp: 100, atk: 10, def: 10 };
  const multiplier = rarityMultipliers[rarity as keyof typeof rarityMultipliers] || 1.0;

  return {
    hp: Math.floor(baseStats.hp * multiplier),
    atk: Math.floor(baseStats.atk * multiplier),
    def: Math.floor(baseStats.def * multiplier),
    crit: rarity === "Legendary" ? 15 : rarity === "Epic" ? 10 : 5,
    critDamage: rarity === "Legendary" ? 75 : rarity === "Epic" ? 60 : 50,
    critResist: 0,
    dodge: rarity === "Legendary" ? 15 : rarity === "Epic" ? 10 : 5,
    accuracy: 0,
    vitesse: role === "DPS Melee" ? 90 : role === "DPS Ranged" ? 85 : role === "Support" ? 80 : 70,
    moral: rarity === "Legendary" ? 100 : rarity === "Epic" ? 80 : rarity === "Rare" ? 65 : 50,
    reductionCooldown: rarity === "Legendary" ? 15 : rarity === "Epic" ? 10 : rarity === "Rare" ? 5 : 0,
    healthleech: 0,
    healingBonus: role === "Support" ? (rarity === "Legendary" ? 50 : 25) : 0,
    shieldBonus: role === "Tank" ? (rarity === "Legendary" ? 40 : 20) : 0,
    energyRegen: 10
  };
}

// =====================
// Seeding
// =====================
const seedHeroes = async () => {
  try {
    console.log("🌱 Starting hero seeding from CSV...");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    await Hero.deleteMany({});
    console.log("🗑️ Cleared existing heroes");

    const heroes: any[] = [];

    // chemin du CSV
    const filePath = path.join(__dirname, "../data/Persosgacha.csv");

    // Vérification existence fichier
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found at: ${filePath}`);
    }

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on("data", (row: any) => {
          const normalizedRole = normalizeRole(row.Role);
          const normalizedElement = normalizeElement(row.Element);
          const stats = calculateBaseStats(normalizedRole, row.Rarity);

          heroes.push({
            name: row.Name,
            rarity: row.Rarity,
            role: normalizedRole,
            element: normalizedElement,
            baseStats: stats,
            appearance: row.Appearance || "",
            personality: row.Personality || "",
            strengths: row.Strengths || "",
            weaknesses: row.Weaknesses || "",
          });
        })
        .on("end", resolve)
        .on("error", reject);
    });

    await Hero.insertMany(heroes);
    console.log(`✅ Inserted ${heroes.length} heroes from CSV`);

    console.log("\n🎉 Hero seeding completed successfully!");
  } catch (err) {
    console.error("❌ Hero seeding failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

if (require.main === module) {
  seedHeroes().then(() => process.exit(0));
}

export { seedHeroes };

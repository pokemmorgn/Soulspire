// server/src/scripts/seedMythicHeroes.ts

import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import csvParser from "csv-parser";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

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
    Fire: "Fire",
    Water: "Water",
    Wind: "Wind",
    Electric: "Electric",
    Light: "Light",
    Shadow: "Dark",
    Dark: "Dark"
  };
  return elementMap[csvElement?.trim()] || "Fire";
}

function normalizeRarity(csvRarity: string): "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" {
  const rarityMap: Record<string, "Common" | "Rare" | "Epic" | "Legendary" | "Mythic"> = {
    "Common": "Common",
    "Rare": "Rare",
    "Epic": "Epic",
    "Legendary": "Legendary",
    "Mythical": "Mythic",  // ✅ CSV utilise "Mythical"
    "Mythic": "Mythic"
  };
  return rarityMap[csvRarity?.trim()] || "Common";
}

// =====================
// Stats de base pour Mythiques
// =====================
function calculateMythicBaseStats(role: string): any {
  const baseStatsByRole = {
    "DPS Melee": {
      hp: 11000,
      atk: 2600,
      def: 1100,
      crit: 30,
      critDamage: 220,
      critResist: 12,
      dodge: 20,
      accuracy: 95,
      vitesse: 100,
      moral: 120,
      reductionCooldown: 20,
      healthleech: 12,
      healingBonus: 0,
      shieldBonus: 0,
      energyRegen: 18
    },
    "Support": {
      hp: 10000,
      atk: 1500,
      def: 1400,
      crit: 15,
      critDamage: 150,
      critResist: 20,
      dodge: 15,
      accuracy: 90,
      vitesse: 85,
      moral: 120,
      reductionCooldown: 20,
      healthleech: 5,
      healingBonus: 50,
      shieldBonus: 30,
      energyRegen: 20
    },
    "Tank": {
      hp: 14000,
      atk: 1800,
      def: 1800,
      crit: 10,
      critDamage: 150,
      critResist: 30,
      dodge: 15,
      accuracy: 90,
      vitesse: 75,
      moral: 120,
      reductionCooldown: 20,
      healthleech: 5,
      healingBonus: 20,
      shieldBonus: 50,
      energyRegen: 15
    },
    "DPS Ranged": {
      hp: 9000,
      atk: 2900,
      def: 950,
      crit: 40,
      critDamage: 280,
      critResist: 8,
      dodge: 30,
      accuracy: 100,
      vitesse: 110,
      moral: 120,
      reductionCooldown: 20,
      healthleech: 18,
      healingBonus: 0,
      shieldBonus: 0,
      energyRegen: 15
    }
  };

  return baseStatsByRole[role as keyof typeof baseStatsByRole] || baseStatsByRole["DPS Melee"];
}

// =====================
// Sorts custom pour Mythiques
// =====================
interface SpellData {
  id: string;
  level: number;
}
interface SpellSet {
  spell1?: SpellData;
  spell2?: SpellData;
  spell3?: SpellData;
  ultimate: SpellData;
  passive?: SpellData;
}

function getMythicCustomSpells(heroName: string): SpellSet {
  const customSpells: Record<string, SpellSet> = {
    "Kaorim (Lunar Form)": {
      spell1: { id: "shadow_strike", level: 5 },
      spell2: { id: "lunar_blade", level: 4 },
      spell3: { id: "void_step", level: 4 },
      ultimate: { id: "lunar_eclipse", level: 5 },
      passive: { id: "lunar_mastery_mythic", level: 5 }
    },
    "Kaorim (Solar Form)": {
      spell1: { id: "solar_heal", level: 5 },
      spell2: { id: "radiant_blessing", level: 4 },
      spell3: { id: "light_barrier", level: 4 },
      ultimate: { id: "solar_eclipse", level: 5 },
      passive: { id: "solar_mastery_mythic", level: 5 }
    }
  };

  return customSpells[heroName] || {
    spell1: { id: "mythic_strike", level: 5 },
    spell2: { id: "mythic_skill", level: 4 },
    spell3: { id: "mythic_special", level: 4 },
    ultimate: { id: "mythic_ultimate", level: 5 },
    passive: { id: "mythic_passive", level: 5 }
  };
}

// =====================
// Seeding
// =====================
const seedMythicHeroes = async () => {
  try {
    console.log("🔮 Starting Mythic Heroes seeding from CSV...");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Supprimer uniquement les héros Mythiques existants
    const deleteResult = await Hero.deleteMany({ rarity: "Mythic" });
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing Mythic heroes`);

    const mythicHeroes: any[] = [];
    const filePath = path.join(__dirname, "../data/Persosgacha.csv");

    // Lire le CSV et filtrer les Mythiques
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on("data", (row: any) => {
          const normalizedRarity = normalizeRarity(row.Rarity);
          
          // ✅ Filtrer uniquement les Mythiques
          if (normalizedRarity !== "Mythic") {
            return;
          }

          const normalizedRole = normalizeRole(row.Role);
          const normalizedElement = normalizeElement(row.Element);
          const stats = calculateMythicBaseStats(normalizedRole);
          const spells = getMythicCustomSpells(row.Name);

          mythicHeroes.push({
            name: row.Name,
            rarity: "Mythic",
            role: normalizedRole,
            element: normalizedElement,
            baseStats: stats,
            spells
          });

          console.log(`   ✅ Found Mythic: ${row.Name} (${normalizedElement} ${normalizedRole})`);
        })
        .on("end", resolve)
        .on("error", reject);
    });

    if (mythicHeroes.length === 0) {
      console.warn("⚠️  No Mythic heroes found in CSV!");
      return;
    }

    // Insérer les héros mythiques
    const inserted = await Hero.insertMany(mythicHeroes);
    console.log(`\n✅ Inserted ${inserted.length} Mythic heroes successfully!`);

    console.log("\n📋 Mythic Heroes created:");
    inserted.forEach((hero: any, index: number) => {
      console.log(`   ${index + 1}. ${hero.name} (${hero.element}) - ${hero.role}`);
      console.log(`      └─ HP: ${hero.baseStats.hp}, ATK: ${hero.baseStats.atk}, DEF: ${hero.baseStats.def}`);
    });

    console.log("\n🎉 Mythic Heroes seeding completed!");

  } catch (error: any) {
    console.error("❌ Mythic Heroes seeding failed:", error.message || error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

if (require.main === module) {
  seedMythicHeroes().then(() => process.exit(0));
}

export { seedMythicHeroes };

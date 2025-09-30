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

// =====================
// Stats de base
// =====================
function calculateBaseStats(role: string, rarity: string) {
  const baseStatsByRole = {
    Tank: { hp: 1200, atk: 80, def: 150 },
    "DPS Melee": { hp: 800, atk: 140, def: 70 },
    "DPS Ranged": { hp: 600, atk: 120, def: 50 },
    Support: { hp: 700, atk: 60, def: 80 }
  };

  const rarityMultipliers = {
    Common: 1.0,
    Rare: 1.25,
    Epic: 1.5,
    Legendary: 2.0
  };

  const baseStats =
    baseStatsByRole[role as keyof typeof baseStatsByRole] || { hp: 100, atk: 10, def: 10 };
  const multiplier =
    rarityMultipliers[rarity as keyof typeof rarityMultipliers] || 1.0;

  return {
    hp: Math.floor(baseStats.hp * multiplier),
    atk: Math.floor(baseStats.atk * multiplier),
    def: Math.floor(baseStats.def * multiplier),
    crit: rarity === "Legendary" ? 15 : rarity === "Epic" ? 10 : 5,
    critDamage: rarity === "Legendary" ? 75 : rarity === "Epic" ? 60 : 50,
    critResist: 0,
    dodge: rarity === "Legendary" ? 15 : rarity === "Epic" ? 10 : 5,
    accuracy: 0,
    vitesse:
      role === "DPS Melee"
        ? 90
        : role === "DPS Ranged"
        ? 85
        : role === "Support"
        ? 80
        : 70,
    moral:
      rarity === "Legendary"
        ? 100
        : rarity === "Epic"
        ? 80
        : rarity === "Rare"
        ? 65
        : 50,
    reductionCooldown:
      rarity === "Legendary" ? 15 : rarity === "Epic" ? 10 : rarity === "Rare" ? 5 : 0,
    healthleech: 0,
    healingBonus: role === "Support" ? (rarity === "Legendary" ? 50 : 25) : 0,
    shieldBonus: role === "Tank" ? (rarity === "Legendary" ? 40 : 20) : 0,
    energyRegen: 10
  };
}

// =====================
// Sorts custom
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

function getCustomSpells(heroName: string): SpellSet | null {
  const customSpells: Record<string, SpellSet> = {
    Ignara: {
      spell1: { id: "fireball", level: 2 },
      spell2: { id: "flame_burst", level: 1 },
      spell3: { id: "fire_shield", level: 1 },
      ultimate: { id: "inferno", level: 1 },
      passive: { id: "fire_mastery", level: 1 }
    },
    Nereida: {
      spell1: { id: "heal", level: 2 },
      spell2: { id: "water_barrier", level: 1 },
      spell3: { id: "cleanse", level: 1 },
      ultimate: { id: "tidal_wave", level: 1 },
      passive: { id: "water_mastery", level: 1 }
    },
    Lyaria: {
      spell1: { id: "divine_heal", level: 2 },
      spell2: { id: "blessing", level: 1 },
      spell3: { id: "purify", level: 1 },
      ultimate: { id: "divine_light", level: 1 },
      passive: { id: "light_mastery", level: 1 }
    },
    Kaelen: {
      spell1: { id: "wind_slash", level: 2 },
      spell2: { id: "dash_strike", level: 1 },
      spell3: { id: "whirlwind", level: 1 },
      ultimate: { id: "tornado", level: 1 },
      passive: { id: "wind_mastery", level: 1 }
    },
    Zephyra: {
      spell1: { id: "piercing_arrow", level: 3 },
      spell2: { id: "wind_arrow", level: 2 },
      spell3: { id: "arrow_rain", level: 2 },
      ultimate: { id: "storm_arrows", level: 2 },
      passive: { id: "archer_mastery", level: 2 }
    },
    Seliora: {
      spell1: { id: "shadow_bolt", level: 3 },
      spell2: { id: "curse", level: 2 },
      spell3: { id: "dark_bind", level: 2 },
      ultimate: { id: "shadow_realm", level: 2 },
      passive: { id: "dark_mastery", level: 2 }
    },
    Thalrik: {
      spell1: { id: "thunder_strike", level: 3 },
      spell2: { id: "taunt", level: 2 },
      spell3: { id: "electric_shield", level: 2 },
      ultimate: { id: "lightning_storm", level: 2 },
      passive: { id: "tank_mastery", level: 2 }
    },
    Drogath: {
      spell1: { id: "life_drain", level: 3 },
      spell2: { id: "bone_armor", level: 2 },
      spell3: { id: "fear", level: 2 },
      ultimate: { id: "undead_army", level: 2 },
      passive: { id: "undead_mastery", level: 2 }
    },
    Aureon: {
      spell1: { id: "holy_strike", level: 4 },
      spell2: { id: "divine_protection", level: 3 },
      spell3: { id: "radiance", level: 3 },
      ultimate: { id: "solar_flare", level: 3 },
      passive: { id: "guardian_aura", level: 3 }
    },
    Veyron: {
      spell1: { id: "dual_strike", level: 4 },
      spell2: { id: "wind_dance", level: 3 },
      spell3: { id: "phantom_slash", level: 3 },
      ultimate: { id: "blade_storm", level: 3 },
      passive: { id: "blade_mastery", level: 3 }
    },
    Pyra: {
      spell1: { id: "flame_heal", level: 4 },
      spell2: { id: "fire_buff", level: 3 },
      spell3: { id: "phoenix_blessing", level: 3 },
      ultimate: { id: "phoenix_rebirth", level: 3 },
      passive: { id: "phoenix_mastery", level: 3 }
    }
  };

  return customSpells[heroName] || null;
}

// =====================
// Génération générique
// =====================
function generateSpells(heroName: string, role: string, element: string, rarity: string): SpellSet {
  const customSpells = getCustomSpells(heroName);
  if (customSpells) return customSpells;

  const spellsByRole: Record<string, string[]> = {
    Tank: ["taunt", "shield_wall", "armor_up"],
    "DPS Melee": ["slash", "combo_strike", "berserker_rage"],
    "DPS Ranged": ["magic_missile", "precise_shot", "elemental_arrow"],
    Support: ["heal", "group_heal", "divine_blessing"]
  };

  const ultimatesByElement: Record<string, string> = {
    Fire: "fire_storm",
    Water: "tidal_wave",
    Wind: "tornado",
    Electric: "lightning_strike",
    Light: "divine_light",
    Dark: "shadow_realm"
  };

  const passivesByRarity: Record<string, string> = {
    Common: "basic_passive",
    Rare: "stat_boost",
    Epic: "elemental_mastery",
    Legendary: "legendary_aura"
  };

  const availableSpells = spellsByRole[role] || ["basic_attack"];
  const spellLevel = rarity === "Legendary" ? 3 : rarity === "Epic" ? 2 : 1;

  return {
    spell1: availableSpells[0] ? { id: availableSpells[0], level: spellLevel } : undefined,
    spell2: availableSpells[1] ? { id: availableSpells[1], level: Math.max(1, spellLevel - 1) } : undefined,
    spell3: availableSpells[2] ? { id: availableSpells[2], level: Math.max(1, spellLevel - 1) } : undefined,
    ultimate: {
      id: ultimatesByElement[element] || "basic_ultimate",
      level: spellLevel
    },
    passive: {
      id: passivesByRarity[rarity] || "basic_passive",
      level: spellLevel
    }
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
    const filePath = path.join(__dirname, "../data/Persosgacha.csv");

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on("data", (row: any) => {
          const normalizedRole = normalizeRole(row.Role);
          const normalizedElement = normalizeElement(row.Element);
          const stats = calculateBaseStats(normalizedRole, row.Rarity);
          const spells = generateSpells(row.Name, normalizedRole, normalizedElement, row.Rarity);

          heroes.push({
            name: row.Name,
            rarity: row.Rarity,
            role: normalizedRole,
            element: normalizedElement,
            baseStats: stats,
            spells,
            appearance: row.Appearance || "",
            personality: row.Personality || "",
            strengths: row.Strengths || "",
            weaknesses: row.Weaknesses || ""
          });
        })
        .on("end", resolve)
        .on("error", reject);
    });

    await Hero.insertMany(heroes);
    console.log(`✅ Inserted ${heroes.length} heroes from CSV`);

    const customCount = heroes.filter((h) => getCustomSpells(h.name) !== null).length;
    console.log(`\n🔮 Custom spells: ${customCount}/${heroes.length}`);
    console.log(`🔮 Generic spells: ${heroes.length - customCount}/${heroes.length}`);

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

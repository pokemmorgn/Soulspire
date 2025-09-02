import mongoose from "mongoose";
import dotenv from "dotenv";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Fonction pour calculer les stats selon le rôle et la rareté
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

  const baseStats = (baseStatsByRole as any)[role];
  const multiplier = (rarityMultipliers as any)[rarity];

  if (!baseStats) {
    console.error(\`Unknown role: \${role}\`);
    return { hp: 100, atk: 10, def: 10 };
  }

  if (!multiplier) {
    console.error(\`Unknown rarity: \${rarity}\`);
    return baseStats;
  }

  return {
    hp: Math.floor(baseStats.hp * multiplier),
    atk: Math.floor(baseStats.atk * multiplier),
    def: Math.floor(baseStats.def * multiplier)
  };
}

// Fonction pour générer les sorts selon le rôle et l'élément
function generateSpells(role: string, element: string, rarity: string) {
  const spellsByRole: Record<string, string[]> = {
    "Tank": ["taunt", "shield_wall", "armor_up"],
    "DPS Melee": ["slash", "combo_strike", "berserker_rage"],
    "DPS Ranged": ["power_shot", "multi_shot", "evasion"],
    "Support": ["heal", "group_heal", "divine_blessing"]
  };

  const ultimatesByElement: Record<string, string> = {
    "Fire": "fire_storm",
    "Water": "tidal_wave",
    "Wind": "tornado",
    "Electric": "lightning_strike",
    "Light": "divine_light",
    "Dark": "shadow_realm"
  };

  const passivesByRarity: Record<string, string> = {
    "Common": "veteran_instinct",
    "Rare": "stat_boost",
    "Epic": "elemental_mastery",
    "Legendary": "legendary_aura"
  };

  const availableSpells = spellsByRole[role] || ["basic_attack"];

  return {
    spell1: availableSpells[0] ? { id: availableSpells[0], level: 1 } : undefined,
    spell2: availableSpells[1] ? { id: availableSpells[1], level: 1 } : undefined,
    spell3: availableSpells[2] ? { id: availableSpells[2], level: 1 } : undefined,
    ultimate: { id: ultimatesByElement[element] || "basic_ultimate", level: 1 },
    passive: { id: passivesByRarity[rarity] || "basic_passive", level: 1 }
  };
}

const heroesData = [
  {
    heroId: "tynira",
    name: "Tynira",
    role: "Support" as const,
    element: "Electric" as const,
    rarity: "Common" as const
  },
  {
    heroId: "braknor",
    name: "Braknor",
    role: "DPS Ranged" as const,
    element: "Wind" as const,
    rarity: "Common" as const
  },
  {
    heroId: "nora",
    name: "Nora",
    role: "DPS Ranged" as const,
    element: "Water" as const,
    rarity: "Common" as const
  },
  {
    heroId: "halvar",
    name: "Halvar",
    role: "Tank" as const,
    element: "Wind" as const,
    rarity: "Common" as const
  },
  {
    heroId: "zeyra",
    name: "Zeyra",
    role: "DPS Melee" as const,
    element: "Electric" as const,
    rarity: "Common" as const
  },
  {
    heroId: "brakka",
    name: "Brakka",
    role: "Tank" as const,
    element: "Fire" as const,
    rarity: "Common" as const
  },
  {
    heroId: "korran",
    name: "Korran",
    role: "Tank" as const,
    element: "Fire" as const,
    rarity: "Rare" as const
  },
  {
    heroId: "sylvara",
    name: "Sylvara",
    role: "DPS Ranged" as const,
    element: "Wind" as const,
    rarity: "Rare" as const
  },
  {
    heroId: "nerya",
    name: "Nerya",
    role: "Tank" as const,
    element: "Water" as const,
    rarity: "Rare" as const
  },
  {
    heroId: "liora",
    name: "Liora",
    role: "DPS Ranged" as const,
    element: "Light" as const,
    rarity: "Rare" as const
  },
  {
    heroId: "ignara",
    name: "Ignara",
    role: "DPS Ranged" as const,
    element: "Fire" as const,
    rarity: "Rare" as const,
    customSpells: {
      spell1: { id: "fireball", level: 2 },
      spell2: { id: "flame_burst", level: 1 },
      spell3: { id: "fire_shield", level: 1 },
      ultimate: { id: "inferno", level: 1 },
      passive: { id: "fire_mastery", level: 1 }
    }
  },
  {
    heroId: "nereida",
    name: "Nereida",
    role: "Support" as const,
    element: "Water" as const,
    rarity: "Rare" as const,
    customSpells: {
      spell1: { id: "heal", level: 2 },
      spell2: { id: "water_barrier", level: 1 },
      spell3: { id: "cleanse", level: 1 },
      ultimate: { id: "tidal_wave", level: 1 },
      passive: { id: "water_mastery", level: 1 }
    }
  },
  {
    heroId: "lyaria",
    name: "Lyaria",
    role: "Support" as const,
    element: "Light" as const,
    rarity: "Rare" as const,
    customSpells: {
      spell1: { id: "divine_heal", level: 2 },
      spell2: { id: "blessing", level: 1 },
      spell3: { id: "purify", level: 1 },
      ultimate: { id: "divine_light", level: 1 },
      passive: { id: "light_mastery", level: 1 }
    }
  },
  {
    heroId: "kaelen",
    name: "Kaelen",
    role: "DPS Melee" as const,
    element: "Wind" as const,
    rarity: "Rare" as const,
    customSpells: {
      spell1: { id: "wind_slash", level: 2 },
      spell2: { id: "dash_strike", level: 1 },
      spell3: { id: "whirlwind", level: 1 },
      ultimate: { id: "tornado", level: 1 },
      passive: { id: "wind_mastery", level: 1 }
    }
  },
  {
    heroId: "karnok",
    name: "Karnok",
    role: "DPS Ranged" as const,
    element: "Fire" as const,
    rarity: "Epic" as const
  },
  {
    heroId: "grathul",
    name: "Grathul",
    role: "Tank" as const,
    element: "Fire" as const,
    rarity: "Epic" as const
  },
  {
    heroId: "raiken",
    name: "Raiken",
    role: "DPS Melee" as const,
    element: "Electric" as const,
    rarity: "Epic" as const
  },
  {
    heroId: "milia",
    name: "Milia",
    role: "Support" as const,
    element: "Electric" as const,
    rarity: "Epic" as const
  },
  {
    heroId: "zephyra",
    name: "Zephyra",
    role: "DPS Ranged" as const,
    element: "Wind" as const,
    rarity: "Epic" as const,
    customSpells: {
      spell1: { id: "piercing_arrow", level: 3 },
      spell2: { id: "wind_arrow", level: 2 },
      spell3: { id: "arrow_rain", level: 2 },
      ultimate: { id: "storm_arrows", level: 2 },
      passive: { id: "archer_mastery", level: 2 }
    }
  },
  {
    heroId: "seliora",
    name: "Seliora",
    role: "DPS Ranged" as const,
    element: "Dark" as const,
    rarity: "Epic" as const,
    customSpells: {
      spell1: { id: "shadow_bolt", level: 3 },
      spell2: { id: "curse", level: 2 },
      spell3: { id: "dark_bind", level: 2 },
      ultimate: { id: "shadow_realm", level: 2 },
      passive: { id: "dark_mastery", level: 2 }
    }
  },
  {
    heroId: "thalrik",
    name: "Thalrik",
    role: "Tank" as const,
    element: "Electric" as const,
    rarity: "Epic" as const,
    customSpells: {
      spell1: { id: "thunder_strike", level: 3 },
      spell2: { id: "taunt", level: 2 },
      spell3: { id: "electric_shield", level: 2 },
      ultimate: { id: "lightning_storm", level: 2 },
      passive: { id: "tank_mastery", level: 2 }
    }
  },
  {
    heroId: "drogath",
    name: "Drogath",
    role: "Tank" as const,
    element: "Dark" as const,
    rarity: "Epic" as const,
    customSpells: {
      spell1: { id: "life_drain", level: 3 },
      spell2: { id: "bone_armor", level: 2 },
      spell3: { id: "fear", level: 2 },
      ultimate: { id: "undead_army", level: 2 },
      passive: { id: "undead_mastery", level: 2 }
    }
  },
  {
    heroId: "aureon",
    name: "Aureon",
    role: "Tank" as const,
    element: "Light" as const,
    rarity: "Legendary" as const,
    customSpells: {
      spell1: { id: "holy_strike", level: 4 },
      spell2: { id: "divine_protection", level: 3 },
      spell3: { id: "radiance", level: 3 },
      ultimate: { id: "solar_flare", level: 3 },
      passive: { id: "guardian_aura", level: 3 }
    }
  },
  {
    heroId: "veyron",
    name: "Veyron",
    role: "DPS Melee" as const,
    element: "Wind" as const,
    rarity: "Legendary" as const,
    customSpells: {
      spell1: { id: "dual_strike", level: 4 },
      spell2: { id: "wind_dance", level: 3 },
      spell3: { id: "phantom_slash", level: 3 },
      ultimate: { id: "blade_storm", level: 3 },
      passive: { id: "blade_mastery", level: 3 }
    }
  },
  {
    heroId: "pyra",
    name: "Pyra",
    role: "Support" as const,
    element: "Fire" as const,
    rarity: "Legendary" as const,
    customSpells: {
      spell1: { id: "flame_heal", level: 4 },
      spell2: { id: "fire_buff", level: 3 },
      spell3: { id: "phoenix_blessing", level: 3 },
      ultimate: { id: "phoenix_rebirth", level: 3 },
      passive: { id: "phoenix_mastery", level: 3 }
    }
  },
  {
    heroId: "kaelis",
    name: "Kaelis",
    role: "DPS Melee" as const,
    element: "Water" as const,
    rarity: "Legendary" as const
  },
  {
    heroId: "voltrion",
    name: "Voltrion",
    role: "DPS Ranged" as const,
    element: "Electric" as const,
    rarity: "Legendary" as const
  },
  {
    heroId: "saryel",
    name: "Saryel",
    role: "DPS Melee" as const,
    element: "Fire" as const,
    rarity: "Legendary" as const
  },
  {
    heroId: "nyxara",
    name: "Nyxara",
    role: "Support" as const,
    element: "Dark" as const,
    rarity: "Legendary" as const
  },
  {
    heroId: "solayne",
    name: "Solayne",
    role: "DPS Ranged" as const,
    element: "Light" as const,
    rarity: "Legendary" as const
  },
  {
    heroId: "aleyra",
    name: "Aleyra",
    role: "DPS Ranged" as const,
    element: "Dark" as const,
    rarity: "Legendary" as const
  },
  {
    heroId: "voltragar",
    name: "Voltragar",
    role: "Tank" as const,
    element: "Electric" as const,
    rarity: "Legendary" as const
  },
] as const;


// Fonction de seed mise à jour
const seedHeroes = async (): Promise<void> => {
  try {
    console.log("🌱 Starting hero seeding with 32 heroes...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    await Hero.deleteMany({});
    console.log("🗑️ Cleared existing heroes");

    for (const heroData of heroesData) {
      const stats = calculateBaseStats(heroData.role, heroData.rarity);
      const spells = (heroData as any).customSpells || generateSpells(heroData.role, heroData.element, heroData.rarity);

      const hero = new Hero({
        heroId: heroData.heroId,
        name: heroData.name,
        role: heroData.role,
        element: heroData.element,
        rarity: heroData.rarity,
        baseStats: stats,
        spells
      });

      await hero.save();

      console.log(\`✅ Created: \${heroData.name} (\${heroData.rarity} \${heroData.role})\`);
    }

    const total = await Hero.countDocuments();
    console.log(\`\n🎭 Successfully created \${total} heroes\`);

  } catch (error) {
    console.error("❌ Hero seeding failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

if (require.main === module) {
  seedHeroes().then(() => process.exit(0));
}

export { seedHeroes };

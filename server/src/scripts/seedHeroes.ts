import mongoose from "mongoose";
import Papa from "papaparse";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Héros définis dans votre CSV
const csvHeroesData = [
  {
    name: "Ignara",
    rarity: "Rare",
    role: "DPS Ranged",
    element: "Fire",
    appearance: "Long fiery red hair, asymmetrical crimson & gold robe with tattered sleeves, floating grimoire with glowing runes.",
    personality: "Proud, determined, charismatic",
    strengths: "High magical damage, area control",
    weaknesses: "Low physical defense, mana dependent"
  },
  {
    name: "Nereida", 
    rarity: "Rare",
    role: "Support",
    element: "Water", 
    appearance: "Long flowing teal hair, elegant blue and white gown, floating water orbs around her.",
    personality: "Calm, nurturing, strategic",
    strengths: "Healing abilities, crowd control",
    weaknesses: "Low offensive power"
  },
  {
    name: "Lyaria",
    rarity: "Rare", 
    role: "Support",
    element: "Light",
    appearance: "Blonde hair, white and gold robes, staff topped with glowing crystal.",
    personality: "Gentle, wise, protective",
    strengths: "Divine magic, team buffs",
    weaknesses: "Vulnerable to dark magic"
  },
  {
    name: "Kaelen",
    rarity: "Rare",
    role: "DPS Melee", 
    element: "Wind",
    appearance: "Short silver hair, green armored tunic, dual swords.",
    personality: "Bold, agile, daring",
    strengths: "High speed, critical strikes",
    weaknesses: "Low defense, positioning dependent"
  },
  {
    name: "Zephyra",
    rarity: "Epic",
    role: "DPS Ranged",
    element: "Wind", 
    appearance: "Epic wind archer with long flowing blonde hair and piercing green eyes. Elegant emerald armor with leaf-like motifs. Massive dark green bow channels swirling wind energy.",
    personality: "Calm, focused, and perceptive",
    strengths: "Long range attacks, wind manipulation",
    weaknesses: "Requires positioning, weak in close combat"
  }
  // Les autres seront générés automatiquement
];

// Templates pour générer les héros restants
const heroTemplates = {
  // Templates par rôle et élément
  "Tank": {
    "Fire": [
      { name: "Pyrion", personality: "Stoic, protective, loyal", strengths: "High defense, fire immunity", weaknesses: "Slow movement, water vulnerability" },
      { name: "Blazeguard", personality: "Fierce, protective, honorable", strengths: "Damage reflection, intimidation", weaknesses: "Limited mobility" }
    ],
    "Water": [
      { name: "Aquarius", personality: "Calm, patient, reliable", strengths: "Self-healing, damage absorption", weaknesses: "Electric vulnerability" },
      { name: "Tideguard", personality: "Steady, protective, wise", strengths: "Area defense, crowd control", weaknesses: "Slow reactions" }
    ],
    "Wind": [
      { name: "Stormwall", personality: "Swift, decisive, brave", strengths: "Mobility, evasion", weaknesses: "Lower raw defense" }
    ],
    "Electric": [
      { name: "Voltshield", personality: "Energetic, reactive, bold", strengths: "Counter-attacks, stun resistance", weaknesses: "Water vulnerability" },
      { name: "Thunderguard", personality: "Intense, focused, protective", strengths: "Electric aura, paralysis immunity", weaknesses: "Unstable in water" }
    ],
    "Light": [
      { name: "Luminary", personality: "Noble, righteous, inspiring", strengths: "Divine protection, team inspiration", weaknesses: "Dark magic vulnerability" }
    ],
    "Dark": [
      { name: "Voidwarden", personality: "Mysterious, calculating, protective", strengths: "Shadow manipulation, fear resistance", weaknesses: "Light magic vulnerability" },
      { name: "Nightguard", personality: "Silent, vigilant, loyal", strengths: "Stealth, dark immunity", weaknesses: "Daylight weakness" }
    ]
  },
  
  "DPS Melee": {
    "Fire": [
      { name: "Inferno", personality: "Aggressive, passionate, impulsive", strengths: "Burning attacks, high damage", weaknesses: "Reckless, water weakness" },
      { name: "Emberstrike", personality: "Intense, focused, competitive", strengths: "Critical hits, fire combos", weaknesses: "Glass cannon build" }
    ],
    "Water": [
      { name: "Tsunami", personality: "Fluid, adaptable, persistent", strengths: "Flow combos, healing strikes", weaknesses: "Electric vulnerability" }
    ],
    "Wind": [
      { name: "Galeforce", personality: "Free-spirited, quick, unpredictable", strengths: "Speed attacks, mobility", weaknesses: "Fragile defense" }
    ],
    "Electric": [
      { name: "Stormstrike", personality: "Energetic, shocking, dynamic", strengths: "Chain lightning, paralysis", weaknesses: "Water vulnerability" },
      { name: "Voltblade", personality: "Electric, precise, overwhelming", strengths: "Electric infusion, stunning", weaknesses: "Grounding effects" }
    ],
    "Light": [
      { name: "Dawnbreaker", personality: "Righteous, pure, determined", strengths: "Holy damage, undead bane", weaknesses: "Dark corruption" }
    ],
    "Dark": [
      { name: "Shadowreaper", personality: "Ruthless, cunning, relentless", strengths: "Life drain, shadow steps", weaknesses: "Holy damage vulnerability" }
    ]
  },

  "DPS Ranged": {
    "Fire": [
      { name: "Flamecaster", personality: "Intellectual, explosive, ambitious", strengths: "Area spells, burn effects", weaknesses: "Mana dependent, fragile" }
    ],
    "Water": [
      { name: "Frostbow", personality: "Cool, calculating, precise", strengths: "Slow effects, piercing shots", weaknesses: "Fire vulnerability" },
      { name: "Glacial", personality: "Patient, methodical, cold", strengths: "Ice magic, crowd control", weaknesses: "Slow casting" }
    ],
    "Electric": [
      { name: "Sparkshot", personality: "Hyperactive, precise, shocking", strengths: "Chain attacks, stunning", weaknesses: "Water hazards" }
    ],
    "Light": [
      { name: "Radiance", personality: "Inspiring, pure, luminous", strengths: "Piercing light, healing shots", weaknesses: "Shadow manipulation" }
    ],
    "Dark": [
      { name: "Voidarcher", personality: "Mysterious, calculating, distant", strengths: "Darkness arrows, invisibility", weaknesses: "Light exposure" },
      { name: "Nightfall", personality: "Silent, deadly, patient", strengths: "Stealth attacks, poison arrows", weaknesses: "Daylight penalties" }
    ]
  },

  "Support": {
    "Fire": [
      { name: "Hearthkeeper", personality: "Warm, caring, passionate", strengths: "Warmth buffs, fire protection", weaknesses: "Water spells counter" },
      { name: "Emberhealer", personality: "Energetic, supportive, bright", strengths: "Regeneration aura, motivation", weaknesses: "Overheating in combat" }
    ],
    "Water": [
      { name: "Streamflow", personality: "Gentle, flowing, adaptable", strengths: "Cleansing, healing over time", weaknesses: "Electric disruption" }
    ],
    "Wind": [
      { name: "Zephyr", personality: "Light, uplifting, encouraging", strengths: "Speed buffs, mobility enhancement", weaknesses: "Lacks direct healing" },
      { name: "Breezecaller", personality: "Refreshing, optimistic, helpful", strengths: "Stamina recovery, movement", weaknesses: "Limited in enclosed spaces" }
    ],
    "Electric": [
      { name: "Sparkle", personality: "Energizing, enthusiastic, quick", strengths: "Energy restoration, haste", weaknesses: "Unstable in water" }
    ],
    "Dark": [
      { name: "Shadowmend", personality: "Mysterious, helpful, misunderstood", strengths: "Dark healing, stealth support", weaknesses: "Light-based dispelling" }
    ]
  }
};

// Fonction pour calculer les stats de base selon le rôle et la rareté
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

  const baseStats = baseStatsByRole[role as keyof typeof baseStatsByRole];
  const multiplier = rarityMultipliers[rarity as keyof typeof rarityMultipliers];

  return {
    hp: Math.floor(baseStats.hp * multiplier),
    atk: Math.floor(baseStats.atk * multiplier), 
    def: Math.floor(baseStats.def * multiplier)
  };
}

// Fonction pour générer une compétence selon le rôle
function generateSkill(role: string, element: string, heroName: string) {
  const skillTemplates = {
    "Tank": {
      types: ["Control", "Buff"],
      names: ["Guardian's Shield", "Fortress Stance", "Protective Aura", "Stalwart Defense"],
      descriptions: [
        "Increases defense and draws enemy attacks",
        "Reduces damage taken and reflects some back to attackers", 
        "Protects allies and increases team defense",
        "Becomes unmovable and gains damage immunity"
      ]
    },
    "DPS Melee": {
      types: ["Damage", "AoE"],
      names: ["Blade Storm", "Critical Strike", "Berserker Rage", "Crushing Blow"],
      descriptions: [
        "Unleashes a flurry of attacks on multiple enemies",
        "Deals massive damage with increased critical chance",
        "Increases attack speed and damage for a short time", 
        "Single devastating attack that ignores armor"
      ]
    },
    "DPS Ranged": {
      types: ["Damage", "AoE"], 
      names: ["Piercing Shot", "Elemental Blast", "Rain of Arrows", "Power Shot"],
      descriptions: [
        "Shoots through multiple enemies in a line",
        `Unleashes a powerful ${element.toLowerCase()} attack`,
        "Attacks all enemies with reduced damage",
        "Charges up for maximum damage on single target"
      ]
    },
    "Support": {
      types: ["Heal", "Buff"],
      names: ["Healing Light", "Divine Grace", "Restoration", "Blessing"],
      descriptions: [
        "Restores health to all allies",
        "Removes debuffs and grants temporary immunity", 
        "Heals over time and increases regeneration",
        "Buffs all ally stats for several turns"
      ]
    }
  };

  const template = skillTemplates[role as keyof typeof skillTemplates];
  const randomIndex = Math.floor(Math.random() * template.names.length);
  
  return {
    name: template.names[randomIndex],
    description: template.descriptions[randomIndex],
    type: template.types[Math.floor(Math.random() * template.types.length)] as "Heal" | "Buff" | "AoE" | "Control" | "Damage"
  };
}

// Fonction principale de génération des héros
function generateAllHeroes() {
  const allHeroes = [];
  
  // Ajouter les héros du CSV d'abord
  csvHeroesData.forEach(csvHero => {
    const stats = calculateBaseStats(csvHero.role, csvHero.rarity);
    const skill = generateSkill(csvHero.role, csvHero.element, csvHero.name);
    
    // Normaliser les noms de rôles pour correspondre au schéma
    let normalizedRole = csvHero.role;
    if (csvHero.role === "DPS Ranged") normalizedRole = "DPS Ranged";
    if (csvHero.role === "DPS Melee") normalizedRole = "DPS Melee"; 
    
    // Normaliser les éléments
    let normalizedElement = csvHero.element;
    if (csvHero.element === "Shadow") normalizedElement = "Dark";

    allHeroes.push({
      name: csvHero.name,
      role: normalizedRole,
      element: normalizedElement,
      rarity: csvHero.rarity,
      baseStats: stats,
      skill: skill,
      appearance: csvHero.appearance,
      personality: csvHero.personality,
      strengths: csvHero.strengths,
      weaknesses: csvHero.weaknesses
    });
  });

  // Distribution cible selon votre spec (40 héros total - 10 déjà définis = 30 à générer)
  const targetDistribution = {
    // Rareté (total 40)
    rarity: {
      "Common": 10,
      "Rare": 10,    // 4 déjà définis -> 6 à générer
      "Epic": 12,    // 4 déjà définis -> 8 à générer  
      "Legendary": 8 // 2 déjà définis -> 6 à générer
    },
    // Rôles (10 chacun)
    role: {
      "Tank": 10,        // 0 définis -> 10 à générer
      "DPS Melee": 10,   // 2 définis -> 8 à générer
      "DPS Ranged": 10,  // 3 définis -> 7 à générer
      "Support": 10      // 2 définis -> 8 à générer
    },
    // Éléments
    element: {
      "Fire": 7,     // 1 défini -> 6 à générer
      "Water": 7,    // 1 défini -> 6 à générer  
      "Wind": 7,     // 3 définis -> 4 à générer
      "Electric": 7, // 1 défini -> 6 à générer
      "Light": 6,    // 2 définis -> 4 à générer
      "Dark": 6      // 2 définis -> 4 à générer
    }
  };

  // Générer les héros manquants
  const elementsToGenerate = ["Fire", "Water", "Wind", "Electric", "Light", "Dark"];
  const rolesToGenerate = ["Tank", "DPS Melee", "DPS Ranged", "Support"];
  const raritiesToGenerate = ["Common", "Rare", "Epic", "Legendary"];

  let heroIndex = allHeroes.length;

  // Générer systématiquement pour équilibrer
  for (const rarity of raritiesToGenerate) {
    const currentCount = allHeroes.filter(h => h.rarity === rarity).length;
    const needed = targetDistribution.rarity[rarity] - currentCount;
    
    for (let i = 0; i < needed; i++) {
      // Choisir rôle et élément selon les besoins
      const availableRoles = rolesToGenerate.filter(role => {
        const currentRoleCount = allHeroes.filter(h => h.role === role).length;
        return currentRoleCount < targetDistribution.role[role];
      });
      
      const availableElements = elementsToGenerate.filter(element => {
        const currentElementCount = allHeroes.filter(h => h.element === element).length;
        return currentElementCount < targetDistribution.element[element];
      });

      if (availableRoles.length === 0 || availableElements.length === 0) continue;

      const selectedRole = availableRoles[Math.floor(Math.random() * availableRoles.length)];
      const selectedElement = availableElements[Math.floor(Math.random() * availableElements.length)];
      
      // Chercher un template approprié
      const templates = heroTemplates[selectedRole as keyof typeof heroTemplates]?.[selectedElement];
      if (templates && templates.length > 0) {
        const template = templates[Math.floor(Math.random() * templates.length)];
        const stats = calculateBaseStats(selectedRole, rarity);
        const skill = generateSkill(selectedRole, selectedElement, template.name);

        allHeroes.push({
          name: template.name,
          role: selectedRole,
          element: selectedElement, 
          rarity: rarity,
          baseStats: stats,
          skill: skill,
          appearance: `${template.name} is a ${rarity.toLowerCase()} ${selectedElement.toLowerCase()} ${selectedRole.toLowerCase()} hero.`,
          personality: template.personality,
          strengths: template.strengths,
          weaknesses: template.weaknesses
        });
      }
    }
  }

  return allHeroes;
}

// Fonction de seed principale
const seedHeroes = async (): Promise<void> => {
  try {
    console.log("🌱 Starting hero seeding...");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Supprimer les héros existants
    await Hero.deleteMany({});
    console.log("🗑️ Cleared existing heroes");

    // Générer tous les héros
    const allHeroes = generateAllHeroes();
    console.log(`🎭 Generated ${allHeroes.length} heroes`);

    // Insérer en base
    for (const heroData of allHeroes) {
      const hero = new Hero(heroData);
      await hero.save();
    }

    console.log("✅ All heroes saved to database");

    // Afficher les statistiques finales
    const stats = {
      total: allHeroes.length,
      byRarity: {} as any,
      byRole: {} as any, 
      byElement: {} as any
    };

    allHeroes.forEach(hero => {
      stats.byRarity[hero.rarity] = (stats.byRarity[hero.rarity] || 0) + 1;
      stats.byRole[hero.role] = (stats.byRole[hero.role] || 0) + 1;
      stats.byElement[hero.element] = (stats.byElement[hero.element] || 0) + 1;
    });

    console.log("\n📊 Final Hero Distribution:");
    console.log("Total Heroes:", stats.total);
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

// Exécuter le seeding si ce fichier est appelé directement
if (require.main === module) {
  seedHeroes().then(() => process.exit(0));
}

export { seedHeroes };

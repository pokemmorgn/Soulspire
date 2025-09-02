import mongoose from "mongoose";
import dotenv from "dotenv";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Fonction pour normaliser les noms de rôles (CSV vers modèle)
function normalizeRole(csvRole: string): "Tank" | "DPS Melee" | "DPS Ranged" | "Support" {
  const roleMap: Record<string, "Tank" | "DPS Melee" | "DPS Ranged" | "Support"> = {
    "Tank": "Tank",
    "Melee DPS": "DPS Melee", 
    "Ranged DPS": "DPS Ranged",
    "Support": "Support"
  };
  return roleMap[csvRole?.trim()] || "Support";
}

// Fonction pour normaliser les éléments (CSV vers modèle)
function normalizeElement(csvElement: string): "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark" {
  const elementMap: Record<string, "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark"> = {
    "Fire": "Fire",
    "Water": "Water", 
    "Wind": "Wind",
    "Electric": "Electric",
    "Light": "Light",
    "Shadow": "Dark", // CSV utilise "Shadow", modèle utilise "Dark"
    "Dark": "Dark"
  };
  return elementMap[csvElement?.trim()] || "Fire";
}

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

  const baseStats = baseStatsByRole[role as keyof typeof baseStatsByRole] || { hp: 100, atk: 10, def: 10 };
  const multiplier = rarityMultipliers[rarity as keyof typeof rarityMultipliers] || 1.0;

  return {
    hp: Math.floor(baseStats.hp * multiplier),
    atk: Math.floor(baseStats.atk * multiplier),
    def: Math.floor(baseStats.def * multiplier),
    // Stats secondaires par défaut
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

// Sorts spécifiques pour certains héros (basé sur votre ancien seedHeroes.ts)
function getCustomSpells(heroName: string): any | null {
  const customSpells: Record<string, any> = {
    "Ignara": {
      spell1: { id: "fireball", level: 2 },
      spell2: { id: "flame_burst", level: 1 },
      spell3: { id: "fire_shield", level: 1 },
      ultimate: { id: "inferno", level: 1 },
      passive: { id: "fire_mastery", level: 1 }
    },
    "Nereida": {
      spell1: { id: "heal", level: 2 },
      spell2: { id: "water_barrier", level: 1 },
      spell3: { id: "cleanse", level: 1 },
      ultimate: { id: "tidal_wave", level: 1 },
      passive: { id: "water_mastery", level: 1 }
    },
    "Lyaria": {
      spell1: { id: "divine_heal", level: 2 },
      spell2: { id: "blessing", level: 1 },
      spell3: { id: "purify", level: 1 },
      ultimate: { id: "divine_light", level: 1 },
      passive: { id: "light_mastery", level: 1 }
    },
    "Kaelen": {
      spell1: { id: "wind_slash", level: 2 },
      spell2: { id: "dash_strike", level: 1 },
      spell3: { id: "whirlwind", level: 1 },
      ultimate: { id: "tornado", level: 1 },
      passive: { id: "wind_mastery", level: 1 }
    },
    "Zephyra": {
      spell1: { id: "piercing_arrow", level: 3 },
      spell2: { id: "wind_arrow", level: 2 },
      spell3: { id: "arrow_rain", level: 2 },
      ultimate: { id: "storm_arrows", level: 2 },
      passive: { id: "archer_mastery", level: 2 }
    },
    "Seliora": {
      spell1: { id: "shadow_bolt", level: 3 },
      spell2: { id: "curse", level: 2 },
      spell3: { id: "dark_bind", level: 2 },
      ultimate: { id: "shadow_realm", level: 2 },
      passive: { id: "dark_mastery", level: 2 }
    },
    "Thalrik": {
      spell1: { id: "thunder_strike", level: 3 },
      spell2: { id: "taunt", level: 2 },
      spell3: { id: "electric_shield", level: 2 },
      ultimate: { id: "lightning_storm", level: 2 },
      passive: { id: "tank_mastery", level: 2 }
    },
    "Drogath": {
      spell1: { id: "life_drain", level: 3 },
      spell2: { id: "bone_armor", level: 2 },
      spell3: { id: "fear", level: 2 },
      ultimate: { id: "undead_army", level: 2 },
      passive: { id: "undead_mastery", level: 2 }
    },
    "Aureon": {
      spell1: { id: "holy_strike", level: 4 },
      spell2: { id: "divine_protection", level: 3 },
      spell3: { id: "radiance", level: 3 },
      ultimate: { id: "solar_flare", level: 3 },
      passive: { id: "guardian_aura", level: 3 }
    },
    "Veyron": {
      spell1: { id: "dual_strike", level: 4 },
      spell2: { id: "wind_dance", level: 3 },
      spell3: { id: "phantom_slash", level: 3 },
      ultimate: { id: "blade_storm", level: 3 },
      passive: { id: "blade_mastery", level: 3 }
    },
    "Pyra": {
      spell1: { id: "flame_heal", level: 4 },
      spell2: { id: "fire_buff", level: 3 },
      spell3: { id: "phoenix_blessing", level: 3 },
      ultimate: { id: "phoenix_rebirth", level: 3 },
      passive: { id: "phoenix_mastery", level: 3 }
    }
  };

  return customSpells[heroName] || null;
}

// Fonction pour générer les sorts selon le rôle et l'élément
function generateSpells(heroName: string, role: string, element: string, rarity: string) {
  // Vérifier d'abord si le héros a des sorts personnalisés
  const customSpells = getCustomSpells(heroName);
  if (customSpells) {
    return customSpells;
  }

  // Sinon, générer selon le système générique
  const spellsByRole: Record<string, string[]> = {
    "Tank": ["taunt", "shield_wall", "armor_up"],
    "DPS Melee": ["slash", "combo_strike", "berserker_rage"],
    "DPS Ranged": ["magic_missile", "precise_shot", "elemental_arrow"],
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
    "Common": "basic_passive",
    "Rare": "stat_boost",
    "Epic": "elemental_mastery",
    "Legendary": "legendary_aura"
  };

  const availableSpells = spellsByRole[role] || ["basic_attack"];
  const spellLevel = rarity === "Legendary" ? 3 : rarity === "Epic" ? 2 : 1;
  const passiveLevel = rarity === "Legendary" ? 3 : rarity === "Epic" ? 2 : 1;
  const ultimateLevel = rarity === "Legendary" ? 3 : rarity === "Epic" ? 2 : 1;
  
  return {
    spell1: availableSpells[0] ? { id: availableSpells[0], level: spellLevel } : undefined,
    spell2: availableSpells[1] ? { id: availableSpells[1], level: Math.max(1, spellLevel - 1) } : undefined,
    spell3: availableSpells[2] ? { id: availableSpells[2], level: Math.max(1, spellLevel - 1) } : undefined,
    ultimate: { 
      id: ultimatesByElement[element] || "basic_ultimate", 
      level: ultimateLevel
    },
    passive: {
      id: passivesByRarity[rarity] || "basic_passive",
      level: passiveLevel
    }
  };
}

// VOS 32 PERSONNAGES DU CSV - EXACTEMENT
const heroesData = [
  // === COMMON (6) ===
  { name: "Tynira", rarity: "Common", role: "Support", element: "Electric" },
  { name: "Braknor", rarity: "Common", role: "Ranged DPS", element: "Wind" },
  { name: "Nora", rarity: "Common", role: "Ranged DPS", element: "Water" },
  { name: "Halvar", rarity: "Common", role: "Tank", element: "Wind" },
  { name: "Zeyra", rarity: "Common", role: "Melee DPS", element: "Electric" },
  { name: "Cinder", rarity: "Common", role: "Melee DPS", element: "Fire" },

  // === RARE (8) ===
  { name: "Ignar", rarity: "Rare", role: "Tank", element: "Fire" },
  { name: "Kaelen", rarity: "Rare", role: "Melee DPS", element: "Wind" },
  { name: "Nereida", rarity: "Rare", role: "Support", element: "Water" },
  { name: "Theron", rarity: "Rare", role: "Ranged DPS", element: "Electric" },
  { name: "Lyaria", rarity: "Rare", role: "Support", element: "Light" },
  { name: "Korgrim", rarity: "Rare", role: "Tank", element: "Shadow" },
  { name: "Ignara", rarity: "Rare", role: "Ranged DPS", element: "Fire" },
  { name: "Mistral", rarity: "Rare", role: "Support", element: "Wind" },

  // === EPIC (8) ===
  { name: "Zephyra", rarity: "Epic", role: "Ranged DPS", element: "Wind" },
  { name: "Thalrik", rarity: "Epic", role: "Tank", element: "Electric" },
  { name: "Seliora", rarity: "Epic", role: "Ranged DPS", element: "Shadow" },
  { name: "Glacius", rarity: "Epic", role: "Tank", element: "Water" },
  { name: "Drogath", rarity: "Epic", role: "Tank", element: "Shadow" },
  { name: "Solara", rarity: "Epic", role: "Support", element: "Light" },
  { name: "Emberia", rarity: "Epic", role: "Melee DPS", element: "Fire" },
  { name: "Nereon", rarity: "Epic", role: "Support", element: "Water" },

  // === LEGENDARY (10) ===
  { name: "Aureon", rarity: "Legendary", role: "Tank", element: "Light" },
  { name: "Veyron", rarity: "Legendary", role: "Melee DPS", element: "Wind" },
  { name: "Pyra", rarity: "Legendary", role: "Support", element: "Fire" },
  { name: "Voidhar", rarity: "Legendary", role: "Ranged DPS", element: "Shadow" },
  { name: "Leviathan", rarity: "Legendary", role: "Tank", element: "Water" },
  { name: "Infernus", rarity: "Legendary", role: "Melee DPS", element: "Fire" },
  { name: "Celestine", rarity: "Legendary", role: "Support", element: "Light" },
  { name: "Stormking", rarity: "Legendary", role: "Ranged DPS", element: "Electric" },
  { name: "Tempest", rarity: "Legendary", role: "Melee DPS", element: "Electric" },
  { name: "Shadowmere", rarity: "Legendary", role: "Ranged DPS", element: "Shadow" }
];

// Fonction de seed
const seedHeroes = async (): Promise<void> => {
  try {
    console.log("🌱 Starting hero seeding with complete roster...");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Supprimer les héros existants
    await Hero.deleteMany({});
    console.log("🗑️ Cleared existing heroes");

    // Créer tous les héros avec le système de sorts
    for (const heroData of heroesData) {
      const normalizedRole = normalizeRole(heroData.role);
      const normalizedElement = normalizeElement(heroData.element);
      const stats = calculateBaseStats(normalizedRole, heroData.rarity);
      const spells = generateSpells(heroData.name, normalizedRole, normalizedElement, heroData.rarity);
      
      const hero = new Hero({
        name: heroData.name,
        role: normalizedRole,
        element: normalizedElement,
        rarity: heroData.rarity,
        baseStats: stats,
        spells: spells
      });
      
      await hero.save();
      
      // Indiquer si le héros a des sorts personnalisés ou génériques
      const isCustom = getCustomSpells(heroData.name) !== null;
      const spellType = isCustom ? "CUSTOM" : "GENERIC";
      
      console.log(`✅ Created: ${heroData.name} (${heroData.rarity} ${normalizedRole} - ${normalizedElement}) [${spellType}]`);
      console.log(`   🔮 Spells: ${Object.entries(spells).map(([slot, spell]) => 
        spell?.id ? `${slot}:${spell.id}(${spell.level})` : `${slot}:none`
      ).join(', ')}`);
    }

    // Statistiques finales
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

    console.log(`\n🎭 Successfully created ${heroesData.length} heroes`);
    console.log("\n📊 Final Distribution:");
    console.log("By Rarity:", stats.byRarity);
    console.log("By Role:", stats.byRole);
    console.log("By Element:", stats.byElement);

    // Compter les sorts personnalisés vs génériques
    const customCount = heroesData.filter(hero => getCustomSpells(hero.name) !== null).length;
    console.log(`\n🔮 Spell Distribution:`);
    console.log(`Custom spells: ${customCount}/${heroesData.length}`);
    console.log(`Generic spells: ${heroesData.length - customCount}/${heroesData.length}`);

    // Exemple de sorts pour vérification
    console.log("\n🎯 Spell System Examples:");
    const sampleHeroes = await Hero.find().limit(3);
    sampleHeroes.forEach(hero => {
      const isCustom = getCustomSpells(hero.name) !== null;
      console.log(`${hero.name} (${hero.rarity} ${hero.role}) [${isCustom ? 'CUSTOM' : 'GENERIC'}]:`);
      console.log(`  Ultimate: ${hero.spells.ultimate?.id} (level ${hero.spells.ultimate?.level})`);
      if (hero.spells.passive?.id) {
        console.log(`  Passive: ${hero.spells.passive.id} (level ${hero.spells.passive.level})`);
      }
    });

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

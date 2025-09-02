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
    "Rare": 1.25,
    "Epic": 1.5,
    "Legendary": 2.0
  };

  const baseStats = baseStatsByRole[role as keyof typeof baseStatsByRole];
  const multiplier = rarityMultipliers[rarity as keyof typeof rarityMultipliers];

  if (!baseStats) {
    console.error(`Unknown role: ${role}`);
    return { hp: 100, atk: 10, def: 10 };
  }

  if (!multiplier) {
    console.error(`Unknown rarity: ${rarity}`);
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
  // Sorts par rôle
  const spellsByRole: Record<string, string[]> = {
    "Tank": ["taunt", "shield_wall", "armor_up"],
    "DPS Melee": ["slash", "combo_strike", "berserker_rage"],
    "DPS Ranged": ["fireball", "ice_arrow", "lightning_bolt"],
    "Support": ["heal", "group_heal", "divine_blessing"]
  };

  // Ultimates par élément
  const ultimatesByElement: Record<string, string> = {
    "Fire": "fire_storm",
    "Water": "tidal_wave", 
    "Wind": "tornado",
    "Electric": "lightning_strike",
    "Light": "divine_light",
    "Dark": "shadow_realm"
  };

  // Passifs par rareté
  const passivesByRarity: Record<string, string> = {
    "Rare": "stat_boost",
    "Epic": "elemental_mastery",
    "Legendary": "legendary_aura"
  };

  const availableSpells = spellsByRole[role] || ["basic_attack"];
  
  return {
    spell1: availableSpells[0] ? { id: availableSpells[0], level: 1 } : undefined,
    spell2: availableSpells[1] ? { id: availableSpells[1], level: 1 } : undefined,
    spell3: availableSpells[2] ? { id: availableSpells[2], level: 1 } : undefined,
    ultimate: { 
      id: ultimatesByElement[element] || "basic_ultimate", 
      level: 1 
    },
    passive: {
      id: passivesByRarity[rarity] || "basic_passive",
      level: 1
    }
  };
}

// VOS 11 HÉROS AVEC SORTS PERSONNALISÉS
const heroesData = [
  {
    name: "Ignara",
    role: "DPS Ranged" as const,
    element: "Fire" as const,
    rarity: "Rare" as const,
    appearance: "Long fiery red hair, asymmetrical crimson & gold robe with tattered sleeves, floating grimoire with glowing runes.",
    personality: "Proud, determined, charismatic",
    strengths: "High single-target damage, persistent burn, synergy with tanks",
    weaknesses: "Fragile, vulnerable to melee and CC",
    // Sorts spécifiques pour Ignara
    customSpells: {
      spell1: { id: "fireball", level: 2 },
      spell2: { id: "flame_burst", level: 1 },
      spell3: { id: "fire_shield", level: 1 },
      ultimate: { id: "inferno", level: 1 },
      passive: { id: "fire_mastery", level: 1 }
    }
  },
  {
    name: "Nereida",
    role: "Support" as const,
    element: "Water" as const,
    rarity: "Rare" as const,
    appearance: "Long flowing teal hair, elegant blue and white gown, floating water orbs around her.",
    personality: "Calm, nurturing, strategic",
    strengths: "Heals allies, buffs, water-based effects",
    weaknesses: "Low defense",
    customSpells: {
      spell1: { id: "heal", level: 2 },
      spell2: { id: "water_barrier", level: 1 },
      spell3: { id: "cleanse", level: 1 },
      ultimate: { id: "tidal_wave", level: 1 },
      passive: { id: "water_mastery", level: 1 }
    }
  },
  {
    name: "Lyaria",
    role: "Support" as const,
    element: "Light" as const,
    rarity: "Rare" as const,
    appearance: "Blonde hair, white and gold robes, staff topped with glowing crystal.",
    personality: "Gentle, wise, protective",
    strengths: "Buffs allies, heals over time",
    weaknesses: "Fragile",
    customSpells: {
      spell1: { id: "divine_heal", level: 2 },
      spell2: { id: "blessing", level: 1 },
      spell3: { id: "purify", level: 1 },
      ultimate: { id: "divine_light", level: 1 },
      passive: { id: "light_mastery", level: 1 }
    }
  },
  {
    name: "Kaelen",
    role: "DPS Melee" as const,
    element: "Wind" as const,
    rarity: "Rare" as const,
    appearance: "Short silver hair, green armored tunic, dual swords.",
    personality: "Bold, agile, daring",
    strengths: "Fast melee attacks, combo skills",
    weaknesses: "Fragile",
    customSpells: {
      spell1: { id: "wind_slash", level: 2 },
      spell2: { id: "dash_strike", level: 1 },
      spell3: { id: "whirlwind", level: 1 },
      ultimate: { id: "tornado", level: 1 },
      passive: { id: "wind_mastery", level: 1 }
    }
  },
  {
    name: "Zephyra",
    role: "DPS Ranged" as const,
    element: "Wind" as const,
    rarity: "Epic" as const,
    appearance: "Epic wind archer with long flowing blonde hair and piercing green eyes. She wears elegant emerald armor with leaf-like motifs, blending agility and elegance. Her massive dark green bow channels swirling wind energy",
    personality: "Calm, focused, and perceptive",
    strengths: "Excellent long-range burst damage. Can reposition quickly with wind dashes. High crit rate and evasion.",
    weaknesses: "Relies on movement to survive. Weak to fast melee pressure.",
    customSpells: {
      spell1: { id: "piercing_arrow", level: 3 },
      spell2: { id: "wind_arrow", level: 2 },
      spell3: { id: "arrow_rain", level: 2 },
      ultimate: { id: "storm_arrows", level: 2 },
      passive: { id: "archer_mastery", level: 2 }
    }
  },
  {
    name: "Seliora",
    role: "DPS Ranged" as const,
    element: "Dark" as const,
    rarity: "Epic" as const,
    appearance: "Dark purple hair, black cloak with red accents, floating daggers orbiting her.",
    personality: "Cunning, mysterious",
    strengths: "High ranged damage, debuffs enemies",
    weaknesses: "Low HP",
    customSpells: {
      spell1: { id: "shadow_bolt", level: 3 },
      spell2: { id: "curse", level: 2 },
      spell3: { id: "dark_bind", level: 2 },
      ultimate: { id: "shadow_realm", level: 2 },
      passive: { id: "dark_mastery", level: 2 }
    }
  },
  {
    name: "Thalrik",
    role: "Tank" as const,
    element: "Electric" as const,
    rarity: "Epic" as const,
    appearance: "Muscular build, armored in yellow & silver, wielding massive hammer.",
    personality: "Bold, resilient, commanding",
    strengths: "Absorbs damage, stuns enemies",
    weaknesses: "Slow",
    customSpells: {
      spell1: { id: "thunder_strike", level: 3 },
      spell2: { id: "taunt", level: 2 },
      spell3: { id: "electric_shield", level: 2 },
      ultimate: { id: "lightning_storm", level: 2 },
      passive: { id: "tank_mastery", level: 2 }
    }
  },
  {
    name: "Drogath",
    role: "Tank" as const,
    element: "Dark" as const,
    rarity: "Epic" as const,
    appearance: "Towering skeletal warrior, black bone armor with violet runes, massive halberd and bone shield.",
    personality: "Silent, relentless, intimidating",
    strengths: "Immense durability, life-drain, disrupts enemy formations",
    weaknesses: "Very slow",
    customSpells: {
      spell1: { id: "life_drain", level: 3 },
      spell2: { id: "bone_armor", level: 2 },
      spell3: { id: "fear", level: 2 },
      ultimate: { id: "undead_army", level: 2 },
      passive: { id: "undead_mastery", level: 2 }
    }
  },
  {
    name: "Aureon",
    role: "Tank" as const,
    element: "Light" as const,
    rarity: "Legendary" as const,
    appearance: "Imposing warrior clad in massive golden and white armor adorned with intricate solar runes. His left hand wields a giant sun-shaped shield, while his right grips a long, gleaming spear.",
    personality: "Stoic, protective, and unwavering",
    strengths: "Exceptional damage absorption. Partial immunity to debuffs. Aura boosts defense and attack of nearby allies.",
    weaknesses: "Limited mobility. Slow movement and attack speed.",
    customSpells: {
      spell1: { id: "holy_strike", level: 4 },
      spell2: { id: "divine_protection", level: 3 },
      spell3: { id: "radiance", level: 3 },
      ultimate: { id: "solar_flare", level: 3 },
      passive: { id: "guardian_aura", level: 3 }
    }
  },
  {
    name: "Veyron",
    role: "DPS Melee" as const,
    element: "Wind" as const,
    rarity: "Legendary" as const,
    appearance: "Tall warrior with long silver-white hair tied by a leaf-like ornament, clad in elegant green and silver armor with angular patterns. Carries two curved swords.",
    personality: "Bold, daring, strategic",
    strengths: "Extremely fast melee combos, high single-target burst, strong mobility and repositioning tools",
    weaknesses: "Low defense, vulnerable to ranged pressure and crowd control",
    customSpells: {
      spell1: { id: "dual_strike", level: 4 },
      spell2: { id: "wind_dance", level: 3 },
      spell3: { id: "phantom_slash", level: 3 },
      ultimate: { id: "blade_storm", level: 3 },
      passive: { id: "blade_mastery", level: 3 }
    }
  },
  {
    name: "Pyra",
    role: "Support" as const,
    element: "Fire" as const,
    rarity: "Legendary" as const,
    appearance: "Tall, elegant woman with long dark red hair tied in a high flaming ponytail. She wears a red and black asymmetrical battle robe with glowing ember accents and flame motifs",
    personality: "Wise, composed, and quietly assertive",
    strengths: "Provides powerful buffs and healing over time. Enhances fire-element allies. Can mitigate damage with shield effects. Synergizes well in sustained fights",
    weaknesses: "Limited self-defense. Vulnerable to burst damage and silence effects",
    customSpells: {
      spell1: { id: "flame_heal", level: 4 },
      spell2: { id: "fire_buff", level: 3 },
      spell3: { id: "phoenix_blessing", level: 3 },
      ultimate: { id: "phoenix_rebirth", level: 3 },
      passive: { id: "phoenix_mastery", level: 3 }
    }
  }
];

// Fonction de seed mise à jour
const seedHeroes = async (): Promise<void> => {
  try {
    console.log("🌱 Starting hero seeding with spell system...");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Supprimer les héros existants
    await Hero.deleteMany({});
    console.log("🗑️ Cleared existing heroes");

    // Créer vos héros avec le nouveau système de sorts
    for (const heroData of heroesData) {
      const stats = calculateBaseStats(heroData.role, heroData.rarity);
      
      // Utiliser les sorts personnalisés ou générés
      const spells = heroData.customSpells || generateSpells(heroData.role, heroData.element, heroData.rarity);
      
      const hero = new Hero({
        name: heroData.name,
        role: heroData.role,
        element: heroData.element,
        rarity: heroData.rarity,
        baseStats: stats,
        // NOUVEAU : Système de sorts
        spells: spells
      });
      
      await hero.save();
      
      // Log des sorts assignés
      console.log(`✅ Created: ${heroData.name} (${heroData.rarity} ${heroData.role})`);
      console.log(`   🔮 Sorts: ${Object.keys(spells).map(key => 
        spells[key as keyof typeof spells]?.id || 'none'
      ).join(', ')}`);
    }

    console.log(`\n🎭 Successfully created ${heroesData.length} heroes with spells`);

    // Statistiques étendues
    const stats = {
      total: heroesData.length,
      byRarity: {} as Record<string, number>,
      byRole: {} as Record<string, number>,
      byElement: {} as Record<string, number>,
      withCustomSpells: 0,
      totalSpells: 0
    };

    heroesData.forEach(hero => {
      stats.byRarity[hero.rarity] = (stats.byRarity[hero.rarity] || 0) + 1;
      stats.byRole[hero.role] = (stats.byRole[hero.role] || 0) + 1;
      stats.byElement[hero.element] = (stats.byElement[hero.element] || 0) + 1;
      
      if (hero.customSpells) {
        stats.withCustomSpells++;
        stats.totalSpells += Object.keys(hero.customSpells).length;
      }
    });

    console.log("\n📊 Final Distribution:");
    console.log("By Rarity:", stats.byRarity);
    console.log("By Role:", stats.byRole);
    console.log("By Element:", stats.byElement);
    console.log(`🔮 Heroes with custom spells: ${stats.withCustomSpells}/${stats.total}`);
    console.log(`⚡ Total spells assigned: ${stats.totalSpells}`);

    // Afficher quelques exemples de sorts
    console.log("\n🎯 Spell Examples:");
    const exampleHero = await Hero.findOne({ name: "Ignara" });
    if (exampleHero) {
      console.log(`${exampleHero.name}:`);
      console.log(`  Ultimate: ${exampleHero.spells.ultimate?.id} (level ${exampleHero.spells.ultimate?.level})`);
      console.log(`  Spell1: ${exampleHero.spells.spell1?.id} (level ${exampleHero.spells.spell1?.level})`);
      console.log(`  Passive: ${exampleHero.spells.passive?.id} (level ${exampleHero.spells.passive?.level})`);
    }

    console.log("\n🎉 Hero seeding with spells completed successfully!");
    
  } catch (error) {
    console.error("❌ Hero seeding failed:", error);
    console.error("Stack trace:", error);
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

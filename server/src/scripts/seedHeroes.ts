import mongoose from "mongoose";
import dotenv from "dotenv";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Fonction pour calculer les stats selon le rôle et la rareté
function calculateBaseStats(role: string, rarity: string) {
  const baseStatsByRole = {
    "Tank": { hp: 1200, atk: 80, def: 150 },
    "Melee DPS": { hp: 800, atk: 140, def: 70 },
    "Ranged DPS": { hp: 600, atk: 120, def: 50 },
    "Support": { hp: 700, atk: 60, def: 80 }
  };

  const rarityMultipliers = {
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

// VOS 11 HÉROS UNIQUEMENT - AUCUN SORT
const heroesData = [
  {
    name: "Ignara",
    role: "DPS Ranged" as const,
    element: "Fire" as const,
    rarity: "Rare" as const,
    appearance: "Long fiery red hair, asymmetrical crimson & gold robe with tattered sleeves, floating grimoire with glowing runes.",
    personality: "Proud, determined, charismatic",
    strengths: "High single-target damage, persistent burn, synergy with tanks",
    weaknesses: "Fragile, vulnerable to melee and CC"
  },
  {
    name: "Nereida",
    role: "Support" as const,
    element: "Water" as const,
    rarity: "Rare" as const,
    appearance: "Long flowing teal hair, elegant blue and white gown, floating water orbs around her.",
    personality: "Calm, nurturing, strategic",
    strengths: "Heals allies, buffs, water-based effects",
    weaknesses: "Low defense"
  },
  {
    name: "Lyaria",
    role: "Support" as const,
    element: "Light" as const,
    rarity: "Rare" as const,
    appearance: "Blonde hair, white and gold robes, staff topped with glowing crystal.",
    personality: "Gentle, wise, protective",
    strengths: "Buffs allies, heals over time",
    weaknesses: "Fragile"
  },
  {
    name: "Kaelen",
    role: "DPS Melee" as const,
    element: "Wind" as const,
    rarity: "Rare" as const,
    appearance: "Short silver hair, green armored tunic, dual swords.",
    personality: "Bold, agile, daring",
    strengths: "Fast melee attacks, combo skills",
    weaknesses: "Fragile"
  },
  {
    name: "Zephyra",
    role: "DPS Ranged" as const,
    element: "Wind" as const,
    rarity: "Epic" as const,
    appearance: "Epic wind archer with long flowing blonde hair and piercing green eyes. She wears elegant emerald armor with leaf-like motifs, blending agility and elegance. Her massive dark green bow channels swirling wind energy",
    personality: "Calm, focused, and perceptive",
    strengths: "Excellent long-range burst damage. Can reposition quickly with wind dashes. High crit rate and evasion.",
    weaknesses: "Relies on movement to survive. Weak to fast melee pressure."
  },
  {
    name: "Seliora",
    role: "DPS Ranged" as const,
    element: "Dark" as const,
    rarity: "Epic" as const,
    appearance: "Dark purple hair, black cloak with red accents, floating daggers orbiting her.",
    personality: "Cunning, mysterious",
    strengths: "High ranged damage, debuffs enemies",
    weaknesses: "Low HP"
  },
  {
    name: "Thalrik",
    role: "Tank" as const,
    element: "Electric" as const,
    rarity: "Epic" as const,
    appearance: "Muscular build, armored in yellow & silver, wielding massive hammer.",
    personality: "Bold, resilient, commanding",
    strengths: "Absorbs damage, stuns enemies",
    weaknesses: "Slow"
  },
  {
    name: "Drogath",
    role: "Tank" as const,
    element: "Dark" as const,
    rarity: "Epic" as const,
    appearance: "Towering skeletal warrior, black bone armor with violet runes, massive halberd and bone shield.",
    personality: "Silent, relentless, intimidating",
    strengths: "Immense durability, life-drain, disrupts enemy formations",
    weaknesses: "Very slow"
  },
  {
    name: "Aureon",
    role: "Tank" as const,
    element: "Light" as const,
    rarity: "Legendary" as const,
    appearance: "Imposing warrior clad in massive golden and white armor adorned with intricate solar runes. His left hand wields a giant sun-shaped shield, while his right grips a long, gleaming spear.",
    personality: "Stoic, protective, and unwavering",
    strengths: "Exceptional damage absorption. Partial immunity to debuffs. Aura boosts defense and attack of nearby allies.",
    weaknesses: "Limited mobility. Slow movement and attack speed."
  },
  {
    name: "Veyron",
    role: "DPS Melee" as const,
    element: "Wind" as const,
    rarity: "Legendary" as const,
    appearance: "Tall warrior with long silver-white hair tied by a leaf-like ornament, clad in elegant green and silver armor with angular patterns. Carries two curved swords.",
    personality: "Bold, daring, strategic",
    strengths: "Extremely fast melee combos, high single-target burst, strong mobility and repositioning tools",
    weaknesses: "Low defense, vulnerable to ranged pressure and crowd control"
  },
  {
    name: "Pyra",
    role: "Support" as const,
    element: "Fire" as const,
    rarity: "Legendary" as const,
    appearance: "Tall, elegant woman with long dark red hair tied in a high flaming ponytail. She wears a red and black asymmetrical battle robe with glowing ember accents and flame motifs",
    personality: "Wise, composed, and quietly assertive",
    strengths: "Provides powerful buffs and healing over time. Enhances fire-element allies. Can mitigate damage with shield effects. Synergizes well in sustained fights",
    weaknesses: "Limited self-defense. Vulnerable to burst damage and silence effects"
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

    // Créer vos héros
    for (const heroData of heroesData) {
      // Normaliser les noms de rôles
      let normalizedRole = heroData.role;
      if (heroData.role === "DPS Ranged") normalizedRole = "DPS Ranged";
      if (heroData.role === "DPS Melee") normalizedRole = "DPS Melee";
      
      const stats = calculateBaseStats(normalizedRole, heroData.rarity);
      
      const hero = new Hero({
        name: heroData.name,
        role: normalizedRole,
        element: heroData.element,
        rarity: heroData.rarity,
        baseStats: stats,
        // COMPÉTENCE PLACEHOLDER (pas de vrai sort)
        skill: {
          name: "Placeholder Skill",
          description: "Skill not implemented yet",
          type: "Damage"
        }
      });
      
      await hero.save();
      console.log(`✅ Created: ${heroData.name} (${heroData.rarity} ${normalizedRole})`);
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

    console.log("\n📊 Final Distribution:");
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

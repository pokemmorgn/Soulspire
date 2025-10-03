// server/src/scripts/seedMonsters.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import csvParser from "csv-parser";
import Monster from "../models/Monster";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

/**
 * 👹 SEED DES MONSTRES
 * 
 * Lit Monsters.csv et génère automatiquement:
 * - Monstres Normal depuis le CSV
 * - Variantes Elite (stats améliorées)
 * - Variantes Boss (stats boss + mechanics)
 */

// =====================
// Normalisation
// =====================
function normalizeElement(csvType: string): "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark" {
  const elementMap: Record<string, "Fire" | "Water" | "Wind" | "Electric" | "Light" | "Dark"> = {
    Fire: "Fire",
    Water: "Water",
    Wind: "Wind",
    Electricity: "Electric",
    Electric: "Electric",
    Light: "Light",
    Shadow: "Dark",
    Dark: "Dark"
  };
  return elementMap[csvType?.trim()] || "Fire";
}

function normalizeRole(csvRole: string, csvATK: number, csvDEF: number): "Tank" | "DPS Melee" | "DPS Ranged" | "Support" {
  // Analyse intelligente basée sur les stats
  const role = csvRole?.toLowerCase().trim() || "";
  
  // Mots-clés dans le rôle CSV
  if (role.includes("tank") || role.includes("defensive") || role.includes("protector")) {
    return "Tank";
  }
  if (role.includes("support") || role.includes("healer") || role.includes("debuffer")) {
    return "Support";
  }
  if (role.includes("ranged") || role.includes("striker") || role.includes("harasser")) {
    return "DPS Ranged";
  }
  
  // Analyse des stats (ATK/DEF ratio)
  if (csvDEF > csvATK * 1.2) {
    return "Tank";
  }
  if (csvATK > csvDEF * 1.5) {
    return "DPS Melee";
  }
  
  // Défaut selon les stats
  return csvATK > csvDEF ? "DPS Melee" : "Tank";
}

function determineVisualTheme(name: string): string {
  const nameUpper = name.toUpperCase();
  
  // Thèmes selon les familles
  if (nameUpper.includes("SALAMANDER") || nameUpper.includes("SALAMENDER")) {
    return "beast";
  }
  if (nameUpper.includes("YETI")) {
    return "giant";
  }
  if (nameUpper.includes("DRAGON")) {
    return "dragon";
  }
  if (nameUpper.includes("SHADOW") || nameUpper.includes("DARK")) {
    return "shadow";
  }
  if (nameUpper.includes("UNDEAD") || nameUpper.includes("SKELETON") || nameUpper.includes("ZOMBIE")) {
    return "undead";
  }
  if (nameUpper.includes("DEMON")) {
    return "demon";
  }
  if (nameUpper.includes("GOLEM") || nameUpper.includes("CONSTRUCT")) {
    return "construct";
  }
  if (nameUpper.includes("ELEMENTAL")) {
    return "elemental";
  }
  
  // Défaut selon l'élément
  return "beast";
}

function determineRarity(monsterType: "normal" | "elite" | "boss"): "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" {
  if (monsterType === "boss") return "Legendary";
  if (monsterType === "elite") return "Epic";
  return "Rare"; // Monstres normaux en Rare pour être challenge
}

// =====================
// Stats de base
// =====================
function calculateMonsterStats(
  csvATK: number,
  csvDEF: number,
  csvSPD: number,
  role: string,
  monsterType: "normal" | "elite" | "boss"
) {
  // Multiplicateurs par type
  const typeMultipliers = {
    normal: 1.0,
    elite: 1.5,
    boss: 2.5
  };
  
  const multiplier = typeMultipliers[monsterType];
  
  // Calcul HP basé sur le rôle et DEF
  let baseHP = 500;
  if (role === "Tank") baseHP = 1000;
  if (role === "DPS Melee") baseHP = 700;
  if (role === "DPS Ranged") baseHP = 600;
  if (role === "Support") baseHP = 800;
  
  // Ajuster HP avec DEF
  baseHP += csvDEF * 8;
  
  return {
    hp: Math.floor(baseHP * multiplier),
    atk: Math.floor(csvATK * multiplier),
    def: Math.floor(csvDEF * multiplier),
    
    crit: monsterType === "boss" ? 15 : monsterType === "elite" ? 10 : 5,
    critDamage: monsterType === "boss" ? 75 : monsterType === "elite" ? 60 : 50,
    critResist: monsterType === "boss" ? 10 : 0,
    dodge: Math.min(20, Math.floor(csvSPD / 5)),
    accuracy: monsterType === "boss" ? 85 : 75,
    
    vitesse: csvSPD,
    moral: monsterType === "boss" ? 100 : monsterType === "elite" ? 80 : 60,
    reductionCooldown: monsterType === "boss" ? 15 : monsterType === "elite" ? 10 : 0,
    healthleech: monsterType === "boss" ? 10 : 0,
    
    healingBonus: role === "Support" ? (monsterType === "boss" ? 50 : 25) : 0,
    shieldBonus: role === "Tank" ? (monsterType === "boss" ? 40 : 20) : 0,
    energyRegen: 10
  };
}

// =====================
// Sorts
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

function generateMonsterSpells(
  element: string,
  role: string,
  monsterType: "normal" | "elite" | "boss"
): SpellSet {
  const spellLevel = monsterType === "boss" ? 3 : monsterType === "elite" ? 2 : 1;
  
  const spellsByRole: Record<string, string[]> = {
    Tank: ["taunt", "shield_wall", "armor_up"],
    "DPS Melee": ["claw_strike", "bite", "charge"],
    "DPS Ranged": ["spit_attack", "ranged_strike", "projectile"],
    Support: ["minor_heal", "buff_allies", "debuff_enemy"]
  };
  
  const ultimatesByElement: Record<string, string> = {
    Fire: "fire_storm",
    Water: "tidal_wave",
    Wind: "tornado",
    Electric: "lightning_strike",
    Light: "divine_light",
    Dark: "shadow_realm"
  };
  
  const availableSpells = spellsByRole[role] || ["basic_attack"];
  
  return {
    spell1: availableSpells[0] ? { id: availableSpells[0], level: spellLevel } : undefined,
    spell2: availableSpells[1] ? { id: availableSpells[1], level: Math.max(1, spellLevel - 1) } : undefined,
    spell3: availableSpells[2] ? { id: availableSpells[2], level: Math.max(1, spellLevel - 1) } : undefined,
    ultimate: {
      id: ultimatesByElement[element] || "basic_ultimate",
      level: spellLevel
    },
    passive: monsterType === "boss" ? {
      id: "boss_aura",
      level: spellLevel
    } : undefined
  };
}

// =====================
// Boss Mechanics
// =====================
function generateBossMechanics(name: string, element: string) {
  // Mechanics spéciales pour les boss
  const mechanics: any = {
    enrageAtHpPercent: 30,
    phaseTransitions: [66, 33],
    specialAbilities: [],
    immunities: [],
    weaknesses: []
  };
  
  // Capacités selon l'élément
  const abilitiesByElement: Record<string, string[]> = {
    Fire: ["fire_breath", "meteor_rain", "inferno_zone"],
    Water: ["tidal_surge", "water_prison", "healing_waters"],
    Wind: ["tornado_spin", "air_cutter", "wind_barrier"],
    Electric: ["chain_lightning", "thunder_storm", "static_field"],
    Light: ["blinding_flash", "holy_smite", "divine_shield"],
    Dark: ["shadow_cloak", "life_drain", "fear_aura"]
  };
  
  mechanics.specialAbilities = abilitiesByElement[element] || ["special_attack"];
  
  // Immunités selon l'élément
  if (element === "Fire") {
    mechanics.immunities = ["burn"];
    mechanics.weaknesses = ["water_damage"];
  } else if (element === "Water") {
    mechanics.immunities = ["freeze"];
    mechanics.weaknesses = ["electric_damage"];
  } else if (element === "Wind") {
    mechanics.immunities = ["knockback"];
    mechanics.weaknesses = ["electric_damage"];
  } else if (element === "Electric") {
    mechanics.immunities = ["stun"];
    mechanics.weaknesses = ["earth_damage"];
  } else if (element === "Light") {
    mechanics.immunities = ["blind"];
    mechanics.weaknesses = ["dark_damage"];
  } else if (element === "Dark") {
    mechanics.immunities = ["curse"];
    mechanics.weaknesses = ["light_damage"];
  }
  
  return mechanics;
}

// =====================
// Loot Tables
// =====================
function generateLoot(monsterType: "normal" | "elite" | "boss", element: string) {
  const lootByType = {
    normal: {
      guaranteed: {
        gold: { min: 10, max: 30 },
        experience: 20
      }
    },
    elite: {
      guaranteed: {
        gold: { min: 30, max: 80 },
        experience: 50
      }
    },
    boss: {
      guaranteed: {
        gold: { min: 100, max: 300 },
        experience: 150
      }
    }
  };
  
  return lootByType[monsterType];
}

// =====================
// World Tags (dans quels mondes apparaissent)
// =====================
function generateWorldTags(monsterType: "normal" | "elite" | "boss", familyName: string): number[] {
  // Salamanders: mondes 1-5 (début)
  if (familyName.includes("Salamander") || familyName.includes("Salamender")) {
    if (monsterType === "normal") return [1, 2, 3];
    if (monsterType === "elite") return [3, 4, 5];
    if (monsterType === "boss") return [5];
  }
  
  // Yetis: mondes 6-12 (mid-game)
  if (familyName.includes("Yeti")) {
    if (monsterType === "normal") return [6, 7, 8, 9];
    if (monsterType === "elite") return [9, 10, 11, 12];
    if (monsterType === "boss") return [10, 12];
  }
  
  // Défaut
  if (monsterType === "normal") return [1, 2, 3, 4, 5];
  if (monsterType === "elite") return [5, 6, 7, 8, 9, 10];
  return [10, 15, 20];
}

// =====================
// Création des variantes
// =====================
function createMonsterVariants(baseMonster: any): any[] {
  const variants: any[] = [];
  
  // 1. Normal (base)
  variants.push({
    ...baseMonster,
    monsterId: `MON_${baseMonster.name.toLowerCase().replace(/\s+/g, '_')}`,
    type: "normal"
  });
  
  // 2. Elite (stats améliorées)
  const eliteStats = calculateMonsterStats(
    baseMonster.csvATK,
    baseMonster.csvDEF,
    baseMonster.csvSPD,
    baseMonster.role,
    "elite"
  );
  
  variants.push({
    ...baseMonster,
    monsterId: `MON_${baseMonster.name.toLowerCase().replace(/\s+/g, '_')}_elite`,
    name: `Elite ${baseMonster.name}`,
    type: "elite",
    rarity: determineRarity("elite"),
    baseStats: eliteStats,
    spells: generateMonsterSpells(baseMonster.element, baseMonster.role, "elite"),
    loot: generateLoot("elite", baseMonster.element),
    worldTags: generateWorldTags("elite", baseMonster.name)
  });
  
  // 3. Boss (seulement pour certains - les plus forts)
  // Critère: ATK + DEF > 140
  if (baseMonster.csvATK + baseMonster.csvDEF > 140) {
    const bossStats = calculateMonsterStats(
      baseMonster.csvATK,
      baseMonster.csvDEF,
      baseMonster.csvSPD,
      baseMonster.role,
      "boss"
    );
    
    variants.push({
      ...baseMonster,
      monsterId: `BOSS_${baseMonster.name.toLowerCase().replace(/\s+/g, '_')}`,
      name: `Boss ${baseMonster.name}`,
      displayName: `${baseMonster.name} Lord`,
      type: "boss",
      rarity: determineRarity("boss"),
      baseStats: bossStats,
      spells: generateMonsterSpells(baseMonster.element, baseMonster.role, "boss"),
      bossMechanics: generateBossMechanics(baseMonster.name, baseMonster.element),
      loot: generateLoot("boss", baseMonster.element),
      worldTags: generateWorldTags("boss", baseMonster.name),
      isUnique: true
    });
  }
  
  return variants;
}

// =====================
// Seeding avec upsert
// =====================
const seedMonsters = async () => {
  try {
    console.log("👹 Starting monster seeding from CSV (with upsert)...");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const baseMonsters: any[] = [];
    const filePath = path.join(__dirname, "../data/Monsters.csv");

    // Lire le CSV
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on("data", (row: any) => {
          // Ignorer les lignes vides ou headers de famille (SALAMENDER, YETI)
          if (!row.Name || !row.ATK || !row.DEF || !row.SPD || row.Name.toUpperCase() === "SALAMENDER" || row.Name.toUpperCase() === "YETI") {
            return;
          }

          const element = normalizeElement(row.Type);
          const csvATK = parseInt(row.ATK) || 50;
          const csvDEF = parseInt(row.DEF) || 50;
          const csvSPD = parseInt(row.SPD) || 50;
          const role = normalizeRole(row.Role, csvATK, csvDEF);
          const visualTheme = determineVisualTheme(row.Name);
          const stats = calculateMonsterStats(csvATK, csvDEF, csvSPD, role, "normal");
          const spells = generateMonsterSpells(element, role, "normal");
          const loot = generateLoot("normal", element);
          const worldTags = generateWorldTags("normal", row.Name);

          baseMonsters.push({
            name: row.Name.trim(),
            displayName: row.Name.trim(),
            description: row.Description || "",
            element,
            role,
            rarity: determineRarity("normal"),
            visualTheme,
            baseStats: stats,
            spells,
            loot,
            worldTags,
            csvATK,
            csvDEF,
            csvSPD
          });
        })
        .on("end", resolve)
        .on("error", reject);
    });

    console.log(`📊 Found ${baseMonsters.length} base monsters in CSV`);

    // Générer toutes les variantes (normal, elite, boss)
    const allMonsters: any[] = [];
    baseMonsters.forEach(baseMonster => {
      const variants = createMonsterVariants(baseMonster);
      allMonsters.push(...variants);
    });

    console.log(`🔥 Generated ${allMonsters.length} total monsters (with variants)`);

    // ✅ UPSERT : Mise à jour ou insertion
    let insertedCount = 0;
    let updatedCount = 0;

    for (const monsterData of allMonsters) {
      // Nettoyer les champs CSV temporaires
      delete monsterData.csvATK;
      delete monsterData.csvDEF;
      delete monsterData.csvSPD;
      
      const existing = await Monster.findOne({ monsterId: monsterData.monsterId });

      if (existing) {
        // Mettre à jour
        await Monster.updateOne(
          { monsterId: monsterData.monsterId },
          { $set: monsterData }
        );
        updatedCount++;
        console.log(`   🔄 Updated: ${monsterData.name} (${monsterData.type})`);
      } else {
        // Insérer
        await Monster.create(monsterData);
        insertedCount++;
        console.log(`   ✅ Inserted: ${monsterData.name} (${monsterData.type})`);
      }
    }

    console.log(`\n📊 Seeding Summary:`);
    console.log(`   ✅ Inserted: ${insertedCount} monsters`);
    console.log(`   🔄 Updated: ${updatedCount} monsters`);
    console.log(`   📦 Total processed: ${allMonsters.length} monsters`);

    // Stats par type
    const typeCount: Record<string, number> = {};
    allMonsters.forEach(m => {
      typeCount[m.type] = (typeCount[m.type] || 0) + 1;
    });

    console.log(`\n👹 Monsters by type:`);
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    // Stats par élément
    const elementCount: Record<string, number> = {};
    allMonsters.forEach(m => {
      elementCount[m.element] = (elementCount[m.element] || 0) + 1;
    });

    console.log(`\n🔥 Monsters by element:`);
    Object.entries(elementCount).forEach(([element, count]) => {
      console.log(`   ${element}: ${count}`);
    });

    console.log("\n🎉 Monster seeding completed successfully!");
  } catch (err) {
    console.error("❌ Monster seeding failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

if (require.main === module) {
  seedMonsters().then(() => process.exit(0));
}

export { seedMonsters };

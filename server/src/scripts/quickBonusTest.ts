// server/src/scripts/quickBonusTest.ts
import { getElementBonus } from "../config/FormationBonusConfig";

console.log("🧪 TEST DES BONUS INDIVIDUELS PAR ÉLÉMENT\n");
console.log("=" .repeat(70));

// Scénario 1 : Formation 3 Fire + 2 Water
console.log("\n📋 SCÉNARIO 1: Formation 3 Fire + 2 Water\n");

const formation1 = { Fire: 3, Water: 2 };

console.log("Héros Fire dans cette formation:");
const fireBonus = getElementBonus("Fire", formation1.Fire);
console.log(`  → ${formation1.Fire}x Fire = +${fireBonus.hp}% stats (bonus standard)`);

console.log("\nHéros Water dans cette formation:");
const waterBonus = getElementBonus("Water", formation1.Water);
console.log(`  → ${formation1.Water}x Water = +${waterBonus.hp}% stats (bonus standard)`);

console.log("\nExemple concret:");
const baseStats = { hp: 5000, atk: 400, def: 200 };

const fireStats = {
  hp: Math.floor(baseStats.hp * (1 + fireBonus.hp / 100)),
  atk: Math.floor(baseStats.atk * (1 + fireBonus.atk / 100)),
  def: Math.floor(baseStats.def * (1 + fireBonus.def / 100))
};

const waterStats = {
  hp: Math.floor(baseStats.hp * (1 + waterBonus.hp / 100)),
  atk: Math.floor(baseStats.atk * (1 + waterBonus.atk / 100)),
  def: Math.floor(baseStats.def * (1 + waterBonus.def / 100))
};

console.log(`  Héros Fire: HP ${baseStats.hp} → ${fireStats.hp}, ATK ${baseStats.atk} → ${fireStats.atk}, DEF ${baseStats.def} → ${fireStats.def}`);
console.log(`  Héros Water: HP ${baseStats.hp} → ${waterStats.hp}, ATK ${baseStats.atk} → ${waterStats.atk}, DEF ${baseStats.def} → ${waterStats.def}`);

// Scénario 2 : Formation 5 Light (pure)
console.log("\n" + "=".repeat(70));
console.log("\n📋 SCÉNARIO 2: Formation 5 Light (pure rare)\n");

const formation2 = { Light: 5 };
const lightBonus = getElementBonus("Light", formation2.Light);

console.log(`Tous les héros Light dans cette formation:`);
console.log(`  → ${formation2.Light}x Light ⭐ RARE = +${lightBonus.hp}% stats`);

const lightStats = {
  hp: Math.floor(baseStats.hp * (1 + lightBonus.hp / 100)),
  atk: Math.floor(baseStats.atk * (1 + lightBonus.atk / 100)),
  def: Math.floor(baseStats.def * (1 + lightBonus.def / 100))
};

console.log(`  Stats: HP ${baseStats.hp} → ${lightStats.hp}, ATK ${baseStats.atk} → ${lightStats.atk}, DEF ${baseStats.def} → ${lightStats.def}`);

// Scénario 3 : Formation 2 Light + 3 Dark
console.log("\n" + "=".repeat(70));
console.log("\n📋 SCÉNARIO 3: Formation 2 Light + 3 Dark (rares mixés)\n");

const formation3 = { Light: 2, Dark: 3 };

const light2Bonus = getElementBonus("Light", formation3.Light);
const dark3Bonus = getElementBonus("Dark", formation3.Dark);

console.log(`Héros Light dans cette formation:`);
console.log(`  → ${formation3.Light}x Light ⭐ RARE = +${light2Bonus.hp}% stats`);

console.log(`\nHéros Dark dans cette formation:`);
console.log(`  → ${formation3.Dark}x Dark ⭐ RARE = +${dark3Bonus.hp}% stats`);

const light2Stats = {
  hp: Math.floor(baseStats.hp * (1 + light2Bonus.hp / 100)),
  atk: Math.floor(baseStats.atk * (1 + light2Bonus.atk / 100))
};

const dark3Stats = {
  hp: Math.floor(baseStats.hp * (1 + dark3Bonus.hp / 100)),
  atk: Math.floor(baseStats.atk * (1 + dark3Bonus.atk / 100))
};

console.log(`\n  Héros Light: HP ${baseStats.hp} → ${light2Stats.hp} (+${light2Bonus.hp}%)`);
console.log(`  Héros Dark: HP ${baseStats.hp} → ${dark3Stats.hp} (+${dark3Bonus.hp}%)`);

// Scénario 4 : Héros seul (pas de bonus)
console.log("\n" + "=".repeat(70));
console.log("\n📋 SCÉNARIO 4: Formation 1 Fire + 1 Water + 1 Wind + 1 Electric + 1 Light\n");

console.log("Aucun héros n'a de bonus (tous seuls de leur élément)");
console.log(`  Chaque héros garde ses stats de base: HP ${baseStats.hp}, ATK ${baseStats.atk}, DEF ${baseStats.def}`);

// Résumé
console.log("\n" + "=".repeat(70));
console.log("\n💡 RÉSUMÉ DU SYSTÈME:\n");
console.log("Chaque héros reçoit un bonus selon COMBIEN de héros du");
console.log("MÊME élément sont présents dans la formation.");
console.log("\n2 héros identiques = +5% (standard) ou +8% (rare)");
console.log("3 héros identiques = +10% (standard) ou +15% (rare)");
console.log("4 héros identiques = +15% (standard) ou +22% (rare)");
console.log("5 héros identiques = +25% (standard) ou +35% (rare)");
console.log("\nÉléments rares: Light, Dark");
console.log("\n" + "=".repeat(70) + "\n");

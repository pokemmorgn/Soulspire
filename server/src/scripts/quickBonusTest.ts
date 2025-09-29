// server/src/scripts/quickBonusTest.ts
import { calculateFormationSynergies } from "../config/FormationBonusConfig";

const testCases = [
  { name: "2 Fire", distribution: { Fire: 2 } },
  { name: "3 Light", distribution: { Light: 3 } },
  { name: "5 Water", distribution: { Water: 5 } },
  { name: "5 Dark", distribution: { Dark: 5 } },
  { name: "3 Fire + 2 Water", distribution: { Fire: 3, Water: 2 } }
];

console.log("🧪 Test rapide des bonus\n");

for (const test of testCases) {
  const result = calculateFormationSynergies(test.distribution);
  console.log(`${test.name}:`);
  console.log(`  Bonus: +${result.bonuses.hp}% HP, +${result.bonuses.atk}% ATK, +${result.bonuses.def}% DEF`);
  console.log(`  Détails:`, result.details);
  console.log();
}

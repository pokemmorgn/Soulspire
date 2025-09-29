// server/src/scripts/quickBonusTest.ts
import { calculateFormationSynergies } from "../config/FormationBonusConfig";

interface TestCase {
  name: string;
  distribution: Record<string, number>;
  expectedBonus?: number;
}

const testCases: TestCase[] = [
  // === Tests éléments standards ===
  { name: "2 Fire", distribution: { Fire: 2 }, expectedBonus: 5 },
  { name: "3 Water", distribution: { Water: 3 }, expectedBonus: 10 },
  { name: "4 Wind", distribution: { Wind: 4 }, expectedBonus: 15 },
  { name: "5 Electric (pure)", distribution: { Electric: 5 }, expectedBonus: 25 },
  
  // === Tests éléments rares (Light/Dark) ===
  { name: "2 Light", distribution: { Light: 2 }, expectedBonus: 8 },
  { name: "3 Dark", distribution: { Dark: 3 }, expectedBonus: 15 },
  { name: "5 Light (pure)", distribution: { Light: 5 }, expectedBonus: 35 },
  { name: "5 Dark (pure)", distribution: { Dark: 5 }, expectedBonus: 35 },
  
  // === Tests mixtes intéressants ===
  { name: "2 Light + 3 Dark (max Dark)", distribution: { Light: 2, Dark: 3 }, expectedBonus: 15 },
  { name: "3 Fire + 2 Water (max Fire)", distribution: { Fire: 3, Water: 2 }, expectedBonus: 10 },
  { name: "2 Light + 2 Dark + 1 Fire", distribution: { Light: 2, Dark: 2, Fire: 1 }, expectedBonus: 8 },
  { name: "1 de chaque (aucun bonus)", distribution: { Fire: 1, Water: 1, Wind: 1, Electric: 1, Light: 1 } },
  
  // === Tests edge cases ===
  { name: "4 Fire + 1 Light", distribution: { Fire: 4, Light: 1 }, expectedBonus: 15 },
  { name: "3 Light + 2 Fire (max Light rare)", distribution: { Light: 3, Fire: 2 }, expectedBonus: 15 }
];

console.log("🧪 TEST DES BONUS DE FORMATION\n");
console.log("=" .repeat(70));

let passedTests = 0;
let failedTests = 0;

for (const test of testCases) {
  const result = calculateFormationSynergies(test.distribution);
  const bonus = result.bonuses.hp; // hp, atk, def sont identiques
  
  console.log(`\n📋 ${test.name}`);
  console.log(`   Distribution:`, test.distribution);
  
  if (result.details.length > 0) {
    result.details.forEach(detail => {
      const rareMark = detail.isRare ? " ⭐ RARE" : "";
      console.log(`   → ${detail.count}x ${detail.element}${rareMark}: +${detail.bonus.hp}% stats`);
    });
    console.log(`   ✅ Bonus final appliqué: +${bonus}% toutes stats`);
  } else {
    console.log(`   ❌ Aucun bonus (besoin de 2+ héros du même élément)`);
  }
  
  // Vérification si attendu
  if (test.expectedBonus !== undefined) {
    if (bonus === test.expectedBonus) {
      console.log(`   ✓ Test RÉUSSI (attendu: ${test.expectedBonus}%)`);
      passedTests++;
    } else {
      console.log(`   ✗ Test ÉCHOUÉ (attendu: ${test.expectedBonus}%, obtenu: ${bonus}%)`);
      failedTests++;
    }
  }
}

console.log("\n" + "=".repeat(70));
console.log(`\n📊 RÉSULTAT: ${passedTests} réussis, ${failedTests} échoués\n`);

// Exemple concret avec calcul de stats
console.log("=" .repeat(70));
console.log("\n💡 EXEMPLE CONCRET:\n");

const exampleStats = {
  hp: 5000,
  atk: 400,
  def: 200
};

const exampleFormation = { Light: 3, Fire: 2 };
const exampleResult = calculateFormationSynergies(exampleFormation);
const exampleBonus = exampleResult.bonuses.hp;

console.log(`Formation: 3 Light + 2 Fire`);
console.log(`Bonus appliqué: +${exampleBonus}% (3 Light = rare)`);
console.log(`\nHéros avec stats de base:`);
console.log(`  HP ${exampleStats.hp} → ${Math.floor(exampleStats.hp * (1 + exampleBonus / 100))} (+${Math.floor(exampleStats.hp * exampleBonus / 100)})`);
console.log(`  ATK ${exampleStats.atk} → ${Math.floor(exampleStats.atk * (1 + exampleBonus / 100))} (+${Math.floor(exampleStats.atk * exampleBonus / 100)})`);
console.log(`  DEF ${exampleStats.def} → ${Math.floor(exampleStats.def * (1 + exampleBonus / 100))} (+${Math.floor(exampleStats.def * exampleBonus / 100)})`);

console.log("\n" + "=".repeat(70) + "\n");

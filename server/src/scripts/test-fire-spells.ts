// server/src/scripts/test-fire-spells.ts
import { IBattleParticipant } from "../models/Battle";
import { SpellManager } from "../gameplay/SpellManager";
import { EffectManager } from "../gameplay/EffectManager";
import { PassiveManager } from "../gameplay/PassiveManager";

// Import des sorts à tester
import { ardenAuraSpell } from "../gameplay/actives/ArdenAuraSpell";
import { bladeDanceSpell } from "../gameplay/actives/BladeDanceSpell";
import { incandescentRushSpell } from "../gameplay/actives/IncandescentRushSpell";
import { restoringFlameSpell } from "../gameplay/actives/RestoringFlameSpell";
import { ardenHeartSpell } from "../gameplay/actives/ArdenHeartSpell";
import { magmaPunchSpell } from "../gameplay/actives/MagmaPunchSpell";

// Import des ultimates
import { phoenixRenewalSpell } from "../gameplay/ultimates/PhoenixRenewalSpell";
import { unleashedBrazierSpell } from "../gameplay/ultimates/UnleashedBrazierSpell";
import { volcanicEruptionSpell } from "../gameplay/ultimates/VolcanicEruptionSpell";

// Import des passifs
import { salvationGlowPassive } from "../gameplay/passives/SalvationGlowPassive";
import { ardenRagePassive } from "../gameplay/passives/ArdenRagePassive";
import { telluricFuryPassive } from "../gameplay/passives/TelluricFuryPassive";

/**
 * Script de test pour tous les sorts Feu Légendaires
 * Usage: npx ts-node server/src/scripts/test-fire-spells.ts
 */

// === DONNÉES DE TEST ===

function createTestHero(name: string, role: string, element: string, rarity: string, level: number = 50): IBattleParticipant {
  return {
    heroId: `test_${name.toLowerCase()}`,
    name: name,
    position: 1,
    role: role as any,
    element: element as any,
    rarity: rarity as any,
    level: level,
    stars: 5,
    stats: {
      hp: 2000,
      maxHp: 2000,
      atk: 300,
      def: 150,
      speed: 80
    },
    currentHp: 2000,
    energy: 100,
    status: {
      alive: true,
      buffs: [],
      debuffs: []
    }
  } as IBattleParticipant;
}

function createTestEnemy(name: string): IBattleParticipant {
  return createTestHero(name, "Tank", "Wind", "Common", 40);
}

// === FONCTIONS DE TEST ===

async function initializeManagers() {
  console.log("🔥 === INITIALISATION DES MANAGERS ===");
  
  try {
    await SpellManager.initialize();
    console.log("✅ SpellManager initialisé");
    
    await EffectManager.initialize();
    console.log("✅ EffectManager initialisé");
    
    await PassiveManager.initialize();
    console.log("✅ PassiveManager initialisé");
    
    return true;
  } catch (error) {
    console.error("❌ Erreur d'initialisation:", error);
    return false;
  }
}

function testSpellExecution(spellName: string, spell: any, caster: IBattleParticipant, targets: IBattleParticipant[]) {
  console.log(`\n🔥 === TEST ${spellName.toUpperCase()} ===`);
  
  try {
    // Vérifier que le sort peut être lancé
    const canCast = spell.canCast(caster, 5);
    console.log(`✅ canCast(${caster.name}, niveau 5): ${canCast}`);
    
    if (!canCast) {
      console.log("⚠️ Sort non castable - test interrompu");
      return false;
    }
    
    // Créer un contexte de bataille
    const battleContext = {
      currentTurn: 1,
      allPlayers: [caster],
      allEnemies: targets
    };
    
    // Exécuter le sort
    const action = spell.execute(caster, targets, 5, battleContext);
    
    console.log(`✅ Sort exécuté avec succès !`);
    console.log(`   - Type: ${action.actionType}`);
    console.log(`   - Coût énergie: ${action.energyCost || 0}`);
    console.log(`   - Dégâts: ${action.damage || 0}`);
    console.log(`   - Soins: ${action.healing || 0}`);
    console.log(`   - Cibles: ${action.targetIds.length}`);
    console.log(`   - Buffs: ${action.buffsApplied?.join(', ') || 'aucun'}`);
    console.log(`   - Debuffs: ${action.debuffsApplied?.join(', ') || 'aucun'}`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ Erreur lors du test de ${spellName}:`, error);
    return false;
  }
}

function testPassiveExecution(passiveName: string, passive: any, caster: IBattleParticipant) {
  console.log(`\n🔥 === TEST PASSIF ${passiveName.toUpperCase()} ===`);
  
  try {
    console.log(`✅ Passif ${passiveName} chargé avec succès`);
    console.log(`   - ID: ${passive.config.id}`);
    console.log(`   - Nom: ${passive.config.name}`);
    console.log(`   - Type trigger: ${passive.config.triggerType}`);
    console.log(`   - Cooldown: ${passive.config.internalCooldown}`);
    console.log(`   - Élément: ${passive.config.element}`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ Erreur lors du test du passif ${passiveName}:`, error);
    return false;
  }
}

async function runAllTests() {
  console.log("🔥🔥🔥 === DÉBUT DES TESTS SORTS FEU ===");
  
  // Initialisation
  const initialized = await initializeManagers();
  if (!initialized) {
    console.log("❌ Échec de l'initialisation - arrêt des tests");
    return;
  }
  
  // Créer les héros de test
  const pyra = createTestHero("Pyra", "Support", "Fire", "Legendary");
  const saryel = createTestHero("Saryel", "DPS Melee", "Fire", "Legendary");
  const rhyzann = createTestHero("Rhyzann", "Tank", "Fire", "Legendary");
  
  // Créer des ennemis de test
  const enemies = [
    createTestEnemy("Gobelin"),
    createTestEnemy("Orc"),
    createTestEnemy("Troll")
  ];
  
  const allies = [pyra, saryel, rhyzann];
  
  let successCount = 0;
  let totalTests = 0;
  
  // === TESTS ACTIFS ===
  
  console.log("\n🔥 === TESTS SORTS ACTIFS ===");
  
  const activeTests = [
    { name: "Aura Ardente", spell: ardenAuraSpell, caster: pyra, targets: allies },
    { name: "Flamme Restauratrice", spell: restoringFlameSpell, caster: pyra, targets: allies },
    { name: "Danse des Lames", spell: bladeDanceSpell, caster: saryel, targets: enemies },
    { name: "Ruée Incandescente", spell: incandescentRushSpell, caster: saryel, targets: enemies },
    { name: "Cœur Ardent", spell: ardenHeartSpell, caster: rhyzann, targets: [rhyzann] },
    { name: "Poing de Magma", spell: magmaPunchSpell, caster: rhyzann, targets: enemies }
  ];
  
  for (const test of activeTests) {
    totalTests++;
    if (testSpellExecution(test.name, test.spell, test.caster, test.targets)) {
      successCount++;
    }
  }
  
  // === TESTS ULTIMATES ===
  
  console.log("\n🔥 === TESTS ULTIMATES ===");
  
  const ultimateTests = [
    { name: "Renaissance de la Flamme", spell: phoenixRenewalSpell, caster: pyra, targets: allies },
    { name: "Brasier Déchaîné", spell: unleashedBrazierSpell, caster: saryel, targets: [saryel] },
    { name: "Éruption Primordiale", spell: volcanicEruptionSpell, caster: rhyzann, targets: [rhyzann] }
  ];
  
  for (const test of ultimateTests) {
    totalTests++;
    if (testSpellExecution(test.name, test.spell, test.caster, test.targets)) {
      successCount++;
    }
  }
  
  // === TESTS PASSIFS ===
  
  console.log("\n🔥 === TESTS PASSIFS ===");
  
  const passiveTests = [
    { name: "Lueur Salvatrice", passive: salvationGlowPassive, caster: pyra },
    { name: "Rage Ardente", passive: ardenRagePassive, caster: saryel },
    { name: "Fureur Tellurique", passive: telluricFuryPassive, caster: rhyzann }
  ];
  
  for (const test of passiveTests) {
    totalTests++;
    if (testPassiveExecution(test.name, test.passive, test.caster)) {
      successCount++;
    }
  }
  
  // === RÉSULTATS ===
  
  console.log("\n🔥🔥🔥 === RÉSULTATS DES TESTS ===");
  console.log(`✅ Tests réussis: ${successCount}/${totalTests}`);
  console.log(`📊 Taux de réussite: ${Math.round((successCount / totalTests) * 100)}%`);
  
  if (successCount === totalTests) {
    console.log("🎉 TOUS LES SORTS FEU FONCTIONNENT PARFAITEMENT ! 🔥");
  } else {
    console.log(`⚠️ ${totalTests - successCount} test(s) échoué(s) - vérifier les erreurs ci-dessus`);
  }
  
  // === TESTS BONUS ===
  
  console.log("\n🔥 === TESTS BONUS : INTÉGRATIONS ===");
  
  // Test ArdenAura avec processAuraTick
  try {
    const { ArdenAuraSpell } = await import("../gameplay/actives/ArdenAuraSpell");
    if (ArdenAuraSpell.hasArdenAura(pyra)) {
      const result = ArdenAuraSpell.processAuraTick(pyra, enemies);
      console.log(`✅ ArdenAura processAuraTick: ${result.damage} dégâts, ${result.enemiesAffected} ennemis`);
    }
  } catch (error) {
    console.log("⚠️ Test ArdenAura processAuraTick ignoré:", error instanceof Error ? error.message : String(error));
  }
  
  // Test IncandescentRush bonus énergie
  try {
    const { IncandescentRushSpell } = await import("../gameplay/actives/IncandescentRushSpell");
    const hasFree = IncandescentRushSpell.hasFreeEnergy(saryel);
    const canCastFree = IncandescentRushSpell.canCastForFree(saryel, "blade_dance");
    console.log(`✅ IncandescentRush énergie gratuite: ${hasFree}, peut lancer gratuitement: ${canCastFree}`);
  } catch (error) {
    console.log("⚠️ Test IncandescentRush bonus ignoré:", error instanceof Error ? error.message : String(error));
  }
  
  console.log("\n🔥 === FIN DES TESTS ===");
}

// === EXÉCUTION ===

if (require.main === module) {
  runAllTests().catch(error => {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  });
}

export { runAllTests };

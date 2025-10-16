// server/scripts/test-fire-spells.ts
import { IBattleParticipant } from "../src/models/Battle";
import { EffectManager } from "../src/gameplay/EffectManager";
import { PassiveManager } from "../src/gameplay/PassiveManager";
import { SpellManager } from "../src/gameplay/SpellManager";

// Import des sorts à tester
import { phoenixRenewalSpell } from "../src/gameplay/ultimates/PhoenixRenewalSpell";
import { unleashedBrazierSpell } from "../src/gameplay/ultimates/UnleashedBrazierSpell";
import { volcanicEruptionSpell } from "../src/gameplay/ultimates/VolcanicEruptionSpell";

import { salvationGlowPassive } from "../src/gameplay/passives/SalvationGlowPassive";
import { ardenRagePassive } from "../src/gameplay/passives/ArdenRagePassive";
import { telluricFuryPassive } from "../src/gameplay/passives/TelluricFuryPassive";

import { restoringFlameSpell } from "../src/gameplay/actives/RestoringFlameSpell";
import { ardenAuraSpell } from "../src/gameplay/actives/ArdenAuraSpell";
import { ardenHeartSpell } from "../src/gameplay/actives/ArdenHeartSpell";
import { magmaPunchSpell } from "../src/gameplay/actives/MagmaPunchSpell";
import { bladeDanceSpell } from "../src/gameplay/actives/BladeDanceSpell";
import { incandescentRushSpell } from "../src/gameplay/actives/IncandescentRushSpell";

/**
 * Script de test pour valider tous les sorts Feu créés
 * Usage: npx ts-node server/scripts/test-fire-spells.ts
 */

// ===== DONNÉES DE TEST =====

function createTestHero(
  name: string, 
  role: "Tank" | "DPS Melee" | "DPS Ranged" | "Support",
  rarity: "Common" | "Rare" | "Epic" | "Legendary" = "Legendary",
  level: number = 50
): IBattleParticipant {
  const baseStats = {
    Tank: { hp: 2500, atk: 180, def: 200, speed: 70 },
    "DPS Melee": { hp: 1800, atk: 280, def: 120, speed: 120 },
    "DPS Ranged": { hp: 1600, atk: 260, def: 100, speed: 110 },
    Support: { hp: 1700, atk: 200, def: 140, speed: 90 }
  };
  
  const stats = baseStats[role];
  
  return {
    heroId: `${name.toLowerCase()}_test`,
    name,
    position: 1,
    role,
    element: "Fire",
    rarity,
    level,
    stars: 5,
    stats: {
      hp: stats.hp,
      maxHp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      speed: stats.speed
    },
    currentHp: stats.hp,
    energy: 100, // Pleine énergie pour tests
    status: {
      alive: true,
      buffs: [],
      debuffs: []
    }
  };
}

function createEnemyGroup(): IBattleParticipant[] {
  return [
    createTestHero("Enemy1", "Tank", "Rare", 45),
    createTestHero("Enemy2", "DPS Melee", "Epic", 47),
    createTestHero("Enemy3", "Support", "Rare", 46)
  ];
}

// ===== TESTS =====

async function initializeManagers() {
  console.log("🔥 === INITIALISATION DES MANAGERS ===");
  
  try {
    await EffectManager.initialize();
    console.log("✅ EffectManager initialisé");
    
    await PassiveManager.initialize();
    console.log("✅ PassiveManager initialisé");
    
    await SpellManager.initialize();
    console.log("✅ SpellManager initialisé");
    
  } catch (error) {
    console.error("❌ Erreur initialisation:", error);
    process.exit(1);
  }
}

function testSpellCreation() {
  console.log("\n🔥 === TEST CRÉATION DES SORTS ===");
  
  const spells = [
    { name: "Phoenix Renewal", spell: phoenixRenewalSpell },
    { name: "Unleashed Brazier", spell: unleashedBrazierSpell },
    { name: "Volcanic Eruption", spell: volcanicEruptionSpell },
    { name: "Restoring Flame", spell: restoringFlameSpell },
    { name: "Arden Aura", spell: ardenAuraSpell },
    { name: "Arden Heart", spell: ardenHeartSpell },
    { name: "Magma Punch", spell: magmaPunchSpell },
    { name: "Blade Dance", spell: bladeDanceSpell },
    { name: "Incandescent Rush", spell: incandescentRushSpell }
  ];
  
  const passives = [
    { name: "Salvation Glow", passive: salvationGlowPassive },
    { name: "Arden Rage", passive: ardenRagePassive },
    { name: "Telluric Fury", passive: telluricFuryPassive }
  ];
  
  console.log("📜 Sorts actifs/ultimates:");
  spells.forEach(({ name, spell }) => {
    console.log(`  ✅ ${name}: ${spell.config.id} (${spell.config.type})`);
  });
  
  console.log("⚡ Passifs:");
  passives.forEach(({ name, passive }) => {
    console.log(`  ✅ ${name}: ${passive.config.id} (${passive.config.triggerType})`);
  });
}

function testUltimateExecution() {
  console.log("\n🔥 === TEST EXÉCUTION ULTIMATES ===");
  
  // Test Phoenix Renewal (Pyra)
  console.log("\n🔥⭐ Test Phoenix Renewal (Pyra)");
  const pyra = createTestHero("Pyra", "Support");
  const allies = [pyra, createTestHero("Ally1", "Tank"), createTestHero("Ally2", "DPS Melee")];
  const enemies = createEnemyGroup();
  
  // Blesser les alliés pour tester les soins
  allies[1].currentHp = Math.floor(allies[1].currentHp * 0.6); // 40% manquants
  allies[2].currentHp = Math.floor(allies[2].currentHp * 0.3); // 70% manquants
  
  const battleContext = {
    currentTurn: 1,
    allPlayers: allies,
    allEnemies: enemies
  };
  
  try {
    const action = phoenixRenewalSpell.execute(pyra, allies, 5, battleContext);
    console.log(`  ✅ Phoenix Renewal exécuté: ${action.healing} soins, ${action.damage} dégâts`);
  } catch (error) {
    console.error(`  ❌ Erreur Phoenix Renewal:`, error);
  }
  
  // Test Unleashed Brazier (Saryel)
  console.log("\n🔥⚔️ Test Unleashed Brazier (Saryel)");
  const saryel = createTestHero("Saryel", "DPS Melee");
  
  try {
    const action = unleashedBrazierSpell.execute(saryel, [saryel], 5, battleContext);
    console.log(`  ✅ Unleashed Brazier exécuté: buffs appliqués = ${action.buffsApplied.length}`);
  } catch (error) {
    console.error(`  ❌ Erreur Unleashed Brazier:`, error);
  }
  
  // Test Volcanic Eruption (Rhyzann)
  console.log("\n🌋 Test Volcanic Eruption (Rhyzann)");
  const rhyzann = createTestHero("Rhyzann", "Tank");
  
  try {
    const action = volcanicEruptionSpell.execute(rhyzann, [rhyzann], 5, battleContext);
    console.log(`  ✅ Volcanic Eruption exécuté: buffs appliqués = ${action.buffsApplied.length}`);
  } catch (error) {
    console.error(`  ❌ Erreur Volcanic Eruption:`, error);
  }
}

function testActiveSpells() {
  console.log("\n🔥 === TEST SORTS ACTIFS ===");
  
  const pyra = createTestHero("Pyra", "Support");
  const saryel = createTestHero("Saryel", "DPS Melee");
  const rhyzann = createTestHero("Rhyzann", "Tank");
  const enemies = createEnemyGroup();
  
  const battleContext = {
    currentTurn: 1,
    allPlayers: [pyra, saryel, rhyzann],
    allEnemies: enemies
  };
  
  // Test Restoring Flame (Pyra)
  console.log("\n💚 Test Restoring Flame");
  try {
    const action = restoringFlameSpell.execute(pyra, [pyra, saryel, rhyzann], 3, battleContext);
    console.log(`  ✅ Restoring Flame: ${action.healing} soins, ${action.buffsApplied.length} buffs`);
  } catch (error) {
    console.error(`  ❌ Erreur Restoring Flame:`, error);
  }
  
  // Test Blade Dance (Saryel)
  console.log("\n⚔️ Test Blade Dance");
  try {
    const action = bladeDanceSpell.execute(saryel, enemies, 3, battleContext);
    console.log(`  ✅ Blade Dance: ${action.damage} dégâts, ${action.debuffsApplied.length} debuffs`);
  } catch (error) {
    console.error(`  ❌ Erreur Blade Dance:`, error);
  }
  
  // Test Magma Punch (Rhyzann)
  console.log("\n👊 Test Magma Punch");
  try {
    const action = magmaPunchSpell.execute(rhyzann, enemies, 3, battleContext);
    console.log(`  ✅ Magma Punch: ${action.damage} dégâts, ${action.buffsApplied.length} buffs`);
  } catch (error) {
    console.error(`  ❌ Erreur Magma Punch:`, error);
  }
}

function testPassives() {
  console.log("\n🔥 === TEST PASSIFS ===");
  
  const pyra = createTestHero("Pyra", "Support");
  const saryel = createTestHero("Saryel", "DPS Melee");
  const rhyzann = createTestHero("Rhyzann", "Tank");
  
  // Test Salvation Glow (déclenchement sous 30% HP)
  console.log("\n✨ Test Salvation Glow");
  const ally = createTestHero("Ally", "DPS Melee");
  ally.currentHp = Math.floor(ally.stats.maxHp * 0.25); // 25% HP
  
  try {
    const context = {
      currentTurn: 1,
      actor: pyra,
      target: ally,
      allAllies: [pyra, ally],
      allEnemies: []
    };
    
    const result = salvationGlowPassive.trigger(context, 3);
    console.log(`  ✅ Salvation Glow: triggered = ${result.triggered}`);
  } catch (error) {
    console.error(`  ❌ Erreur Salvation Glow:`, error);
  }
  
  // Test Arden Rage (déclenchement sur critique)
  console.log("\n⚡ Test Arden Rage");
  try {
    const context = {
      currentTurn: 1,
      actor: saryel,
      wasCritical: true,
      allAllies: [saryel],
      allEnemies: []
    };
    
    const result = ardenRagePassive.trigger(context, 3);
    console.log(`  ✅ Arden Rage: triggered = ${result.triggered}`);
  } catch (error) {
    console.error(`  ❌ Erreur Arden Rage:`, error);
  }
  
  // Test Telluric Fury (déclenchement sur dégâts)
  console.log("\n🌋 Test Telluric Fury");
  try {
    const context = {
      currentTurn: 1,
      actor: rhyzann,
      damageTaken: 150, // Dégâts suffisants
      wasCritical: false,
      allAllies: [rhyzann],
      allEnemies: []
    };
    
    const result = telluricFuryPassive.trigger(context, 3);
    console.log(`  ✅ Telluric Fury: triggered = ${result.triggered}`);
  } catch (error) {
    console.error(`  ❌ Erreur Telluric Fury:`, error);
  }
}

function testEffectIntegration() {
  console.log("\n🔥 === TEST INTÉGRATION EFFETS ===");
  
  const testHero = createTestHero("TestHero", "DPS Melee");
  (testHero as any).activeEffects = [];
  
  // Test application d'effets
  console.log("\n🔥 Test application effets");
  try {
    const burnResult = EffectManager.applyEffect("burn", testHero, testHero, 3, 1);
    console.log(`  ✅ Burn appliqué: ${burnResult?.message || 'OK'}`);
    
    const shieldResult = EffectManager.applyEffect("shield", testHero, testHero, 5);
    console.log(`  ✅ Shield appliqué: ${shieldResult?.message || 'OK'}`);
    
    const hasEffects = EffectManager.hasEffect(testHero, "burn") && EffectManager.hasEffect(testHero, "shield");
    console.log(`  ✅ Vérification effets: ${hasEffects ? 'OK' : 'ÉCHEC'}`);
    
  } catch (error) {
    console.error(`  ❌ Erreur effets:`, error);
  }
}

async function runAllTests() {
  console.log("🔥🧪 === TESTS DES SORTS FEU LÉGENDAIRES ===\n");
  
  try {
    await initializeManagers();
    testSpellCreation();
    testUltimateExecution();
    testActiveSpells();
    testPassives();
    testEffectIntegration();
    
    console.log("\n🎉 === TOUS LES TESTS TERMINÉS ===");
    console.log("✅ Si aucune erreur critique, tous les sorts Feu fonctionnent !");
    
  } catch (error) {
    console.error("\n💥 ERREUR CRITIQUE:", error);
    process.exit(1);
  }
}

// Exécution
if (require.main === module) {
  runAllTests();
}

export { runAllTests };

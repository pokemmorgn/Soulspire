// server/src/tests/test-passives.ts

import { PassiveManager } from '../gameplay/PassiveManager';
import { AutoPassiveLoader } from '../gameplay/AutoPassiveLoader';

async function testPassiveSystem() {
  console.log('🧪 Test du système de passifs...\n');
  
  // 1. Initialiser PassiveManager (qui utilise AutoPassiveLoader)
  await PassiveManager.initialize();
  
  console.log('\n📊 Statistiques :');
  const stats = PassiveManager.getStats();
  console.log('Total passifs :', stats.totalPassives);
  console.log('Par trigger type :', stats.passivesByTriggerType);
  console.log('Liste :', stats.passivesList);
  
  // 2. Vérifier qu'on peut récupérer Internal Brazier
  console.log('\n🔍 Test récupération Internal Brazier :');
  const brazier = PassiveManager.getPassive('internal_brazier');
  
  if (brazier) {
    console.log('✅ Internal Brazier trouvé !');
    console.log('   Nom :', brazier.config.name);
    console.log('   Trigger :', brazier.config.triggerType);
    console.log('   Cooldown :', brazier.config.internalCooldown, 'tours');
  } else {
    console.log('❌ Internal Brazier NOT FOUND !');
  }
  
  // 3. Diagnostique complet
  console.log('\n🔍 Diagnostique complet :');
  PassiveManager.diagnose();
}

// Lancer le test
testPassiveSystem().catch(console.error);

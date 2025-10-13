// server/src/tests/test-passive-in-combat.ts

import { BattleEngine } from '../services/BattleEngine';
import { IBattleParticipant } from '../models/Battle';
import { HeroSpells } from '../gameplay/SpellManager';

async function testPassiveInCombat() {
  console.log('🧪 Test du passif Internal Brazier en combat...\n');
  
  // 1. Créer Korran (Tank Fire avec Internal Brazier)
  const korran: IBattleParticipant = {
    heroId: 'korran_1',
    name: 'Korran',
    level: 10,
    rarity: 'Rare',
    element: 'Fire',
    role: 'Tank',
    position: 1,
    stars: 3, // ← AJOUTÉ
    currentHp: 1000,
    energy: 0,
    stats: {
      hp: 1000,
      maxHp: 1000,
      atk: 80,
      def: 120,
      speed: 70
    },
    status: {
      alive: true,
      buffs: [],
      debuffs: []
    }
  };
  
  // 2. Créer un ennemi DPS qui va taper fort
  const enemy: IBattleParticipant = {
    heroId: 'enemy_1',
    name: 'Enemy DPS',
    level: 10,
    rarity: 'Epic',
    element: 'Water',
    role: 'DPS Melee',
    position: 1,
    stars: 5, // ← AJOUTÉ
    currentHp: 800,
    energy: 0,
    stats: {
      hp: 800,
      maxHp: 800,
      atk: 200, // ATK élevée pour faire descendre Korran sous 50%
      def: 60,
      speed: 90
    },
    status: {
      alive: true,
      buffs: [],
      debuffs: []
    }
  };
  
  // 3. Configuration des sorts de Korran avec son passif
  const playerSpells = new Map<string, HeroSpells>();
  playerSpells.set('korran_1', {
    active1: { id: 'ember_bash', level: 5 },
    active2: { id: 'flame_shield', level: 5 },
    ultimate: { id: 'molten_fortress', level: 5 },
    passive: { id: 'internal_brazier', level: 5 } // ← Le passif !
  });
  
  // 4. Lancer le combat
  console.log('🔥 Démarrage du combat...\n');
  const battle = new BattleEngine(
    [korran],
    [enemy],
    playerSpells,
    undefined,
    { mode: 'auto', speed: 1 }
  );
  
  const result = battle.simulateBattle();
  
  // 5. Analyser le résultat
  console.log('\n📊 === RÉSULTAT DU COMBAT ===');
  console.log(`Victoire : ${result.victory ? 'JOUEUR' : 'ENNEMI'}`);
  console.log(`Tours : ${result.totalTurns}`);
  console.log(`Durée : ${result.battleDuration}ms`);
  
  // 6. Vérifier si le passif s'est déclenché
  const actions = battle.getActions();
  const passiveLogs: string[] = [];
  
  // Chercher dans les logs si le passif s'est déclenché
  // (Le déclenchement apparaît dans la console, pas dans les actions)
  
  console.log('\n⚡ Recherche de déclenchement du passif...');
  console.log('💡 Si tu vois "⚡ Passif déclenché: 🔥 Korran s\'embrase" dans les logs ci-dessus,');
  console.log('   alors le passif Internal Brazier fonctionne correctement !');
  
  // Vérifier l'état final de Korran
  const finalState = battle.getPlayerHeroesStatus();
  const korranState = finalState.find(h => h.heroId === 'korran_1');
  
  if (korranState) {
    console.log(`\n🛡️ État final de Korran :`);
    console.log(`   HP: ${korranState.currentHp}/${korranState.maxHp}`);
    console.log(`   Vivant: ${korranState.alive ? 'OUI' : 'NON'}`);
  }
}

// Lancer le test
testPassiveInCombat().catch(console.error);

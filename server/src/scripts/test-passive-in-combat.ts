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
  const passiveTriggers = actions.filter(a => 
    a.actorId === 'korran_1' && 
    (a as any).message?.includes('Brasier')
  );
  
  console.log(`\n⚡ Déclenchements du passif : ${passiveTriggers.length}`);
  
  if (passiveTriggers.length > 0) {
    console.log('✅ Le passif Internal Brazier s\'est bien déclenché !');
  } else {
    console.log('❌ Le passif ne s\'est PAS déclenché (Korran n\'est peut-être pas descendu sous 50% HP)');
  }
}

// Lancer le test
testPassiveInCombat().catch(console.error);

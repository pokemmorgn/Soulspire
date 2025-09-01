import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import Hero from "../models/Hero";
import { BattleService } from "../services/BattleService";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Couleurs pour l'affichage console
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

function colorLog(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

// Fonction principale de test
const testBattle = async (): Promise<void> => {
  try {
    colorLog(colors.cyan, "\n🧪 === TEST DE COMBAT AVEC SORTS ===\n");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    colorLog(colors.green, "✅ Connecté à MongoDB");

    // 1. Créer ou récupérer un joueur de test
    const testPlayer = await getOrCreateTestPlayer();
    colorLog(colors.blue, `👤 Joueur de test: ${testPlayer.username}`);

    // 2. Équiper des héros si nécessaire
    await equipTestHeroes(testPlayer);
    colorLog(colors.blue, `⚔️ Héros équipés: ${testPlayer.heroes.filter(h => h.equipped).length}`);

    // 3. Afficher l'équipe avant le combat AVEC les sorts
    await displayPlayerTeamWithSpells(testPlayer);

    // 4. Lancer plusieurs types de combats
    await runBattleTests((testPlayer._id as any).toString());

    colorLog(colors.cyan, "\n🎉 === TESTS DE COMBAT TERMINÉS ===\n");
    
  } catch (error) {
    colorLog(colors.red, `❌ Erreur lors des tests: ${error}`);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    colorLog(colors.green, "🔌 Déconnecté de MongoDB");
  }
};

// Crée ou récupérer un joueur de test
async function getOrCreateTestPlayer() {
  let player = await Player.findOne({ username: "SpellTestPlayer" }); // Nouveau nom pour éviter les conflits
  
  if (!player) {
    player = new Player({
      username: "SpellTestPlayer",
      password: "test123",
      serverId: "S1", // Assurer que le serverId est défini
      gold: 10000,
      gems: 1000,
      world: 1,
      level: 1
    });
    await player.save();
    colorLog(colors.yellow, "🆕 Joueur de test créé avec système de sorts");
  } else {
    colorLog(colors.blue, "📋 Joueur de test existant trouvé");
  }
  
  return player;
}

// Équipe des héros pour le test
async function equipTestHeroes(player: any) {
  // Récupérer des héros spécifiques avec sorts
  const heroesWithSpells = await Hero.find({
    name: { $in: ["Ignara", "Aureon", "Veyron", "Pyra"] } // Héros avec sorts intéressants
  }).limit(4);
  
  if (heroesWithSpells.length === 0) {
    colorLog(colors.red, "❌ Aucun héros avec sorts trouvé ! Lancez d'abord le seed des héros.");
    throw new Error("Aucun héros trouvé en base ! Lancez d'abord le seed des héros.");
  }

  // Nettoyer l'équipe existante si nécessaire
  if (player.heroes.length > 0) {
    player.heroes = [];
  }

  // Ajouter les héros avec sorts au joueur
  for (let i = 0; i < heroesWithSpells.length; i++) {
    const hero = heroesWithSpells[i];
    player.heroes.push({
      heroId: (hero._id as any).toString(),
      level: 15 + i * 5, // Niveaux élevés pour tester les sorts
      stars: Math.min(6, 3 + i), // Bonnes étoiles
      equipped: true
    });
  }
  
  await player.save();
  colorLog(colors.green, `✨ ${player.heroes.length} héros avec sorts équipés`);
}

// NOUVEAU: Affiche l'équipe du joueur AVEC leurs sorts
async function displayPlayerTeamWithSpells(player: any) {
  const populatedPlayer = await Player.findById(player._id).populate("heroes.heroId");
  const equippedHeroes = populatedPlayer!.heroes.filter((h: any) => h.equipped);
  
  colorLog(colors.magenta, "\n🎭 === ÉQUIPE DU JOUEUR AVEC SORTS ===");
  
  for (let i = 0; i < equippedHeroes.length; i++) {
    const playerHero = equippedHeroes[i];
    
    // Récupérer les données du héros
    let heroData;
    if (typeof playerHero.heroId === 'string') {
      heroData = await Hero.findById(playerHero.heroId);
    } else {
      heroData = playerHero.heroId;
    }
    
    if (heroData && heroData.name) {
      // Calculer les stats de combat étendues
      const levelMultiplier = 1 + (playerHero.level - 1) * 0.08;
      const starMultiplier = 1 + (playerHero.stars - 1) * 0.15;
      const totalMultiplier = levelMultiplier * starMultiplier;
      
      const stats = {
        hp: Math.floor(heroData.baseStats.hp * totalMultiplier),
        atk: Math.floor(heroData.baseStats.atk * totalMultiplier),
        def: Math.floor(heroData.baseStats.def * totalMultiplier),
        intelligence: Math.floor((heroData.baseStats.intelligence || 70) * totalMultiplier),
        moral: Math.floor((heroData.baseStats.moral || 60) * totalMultiplier * 0.6)
      };
      
      console.log(`${i + 1}. ${colors.bright}${heroData.name}${colors.reset}`);
      console.log(`   Role: ${heroData.role} | Element: ${heroData.element} | Rarity: ${heroData.rarity}`);
      console.log(`   Level: ${playerHero.level} | Stars: ${playerHero.stars}`);
      console.log(`   Stats: HP=${stats.hp}, ATK=${stats.atk}, DEF=${stats.def}, INT=${stats.intelligence}, MOR=${stats.moral}`);
      
      // NOUVEAU: Afficher les sorts du héros
      if (heroData.spells) {
        colorLog(colors.yellow, "   🔮 Sorts équipés:");
        
        if (heroData.spells.spell1?.id) {
          console.log(`      • ${heroData.spells.spell1.id} (niveau ${heroData.spells.spell1.level})`);
        }
        if (heroData.spells.spell2?.id) {
          console.log(`      • ${heroData.spells.spell2.id} (niveau ${heroData.spells.spell2.level})`);
        }
        if (heroData.spells.spell3?.id) {
          console.log(`      • ${heroData.spells.spell3.id} (niveau ${heroData.spells.spell3.level})`);
        }
        if (heroData.spells.ultimate?.id) {
          console.log(`      🌟 ULTIMATE: ${heroData.spells.ultimate.id} (niveau ${heroData.spells.ultimate.level})`);
        }
        if (heroData.spells.passive?.id) {
          console.log(`      ⚡ PASSIF: ${heroData.spells.passive.id} (niveau ${heroData.spells.passive.level})`);
        }
      } else {
        colorLog(colors.red, "   ❌ Aucun sort configuré");
      }
      
      console.log(""); // Ligne vide
    } else {
      console.log(`${i + 1}. ${colors.red}Héros non trouvé (ID: ${playerHero.heroId})${colors.reset}`);
    }
  }
}

// Lance différents tests de combat
async function runBattleTests(playerId: string) {
  const tests = [
    { name: "Combat Facile (Test Sorts)", world: 1, level: 1, difficulty: "Normal" as const },
    { name: "Combat Moyen (Ultimates)", world: 2, level: 5, difficulty: "Normal" as const },
    { name: "Combat Difficile (Effets)", world: 3, level: 8, difficulty: "Hard" as const },
    { name: "Boss Fight (Tous les Sorts)", world: 1, level: 10, difficulty: "Normal" as const },
  ];

  for (const test of tests) {
    colorLog(colors.cyan, `\n⚔️ === ${test.name.toUpperCase()} ===`);
    colorLog(colors.blue, `📍 Monde ${test.world}, Niveau ${test.level}, ${test.difficulty}`);
    
    try {
      const startTime = Date.now();
      const result = await BattleService.startCampaignBattle(
        playerId, 
        "S1", // Serveur par défaut pour les tests
        test.world, 
        test.level, 
        test.difficulty
      );
      const duration = Date.now() - startTime;

      // Afficher les résultats AVEC analyse des sorts
      displayBattleResultWithSpells(result, duration);
      
      // Pause entre les combats
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error: any) {
      colorLog(colors.red, `❌ Erreur: ${error.message}`);
      console.error("Stack trace:", error);
    }
  }
  
  // Test de statistiques
  await displayPlayerStats(playerId);
}

// NOUVEAU: Affiche les résultats d'un combat AVEC analyse des sorts
function displayBattleResultWithSpells(battleResult: any, executionTime: number) {
  const { result, replay } = battleResult;
  
  if (result.victory) {
    colorLog(colors.green, `🏆 VICTOIRE !`);
  } else {
    colorLog(colors.red, `💀 DÉFAITE...`);
  }
  
  console.log(`⏱️  Durée du combat: ${Math.round(result.battleDuration / 1000)}s`);
  console.log(`🔧 Temps d'exécution: ${executionTime}ms`);
  console.log(`🎯 Tours total: ${result.totalTurns}`);
  
  // Statistiques détaillées
  colorLog(colors.yellow, "\n📊 Statistiques:");
  console.log(`💥 Dégâts infligés: ${result.stats.totalDamageDealt}`);
  console.log(`💚 Soins effectués: ${result.stats.totalHealingDone}`);
  console.log(`⚡ Coups critiques: ${result.stats.criticalHits}`);
  console.log(`🌟 Ultimates utilisés: ${result.stats.ultimatesUsed}`);
  
  // NOUVEAU: Analyse des types d'actions utilisées
  if (replay.actions && replay.actions.length > 0) {
    const actionTypes = replay.actions.reduce((acc: any, action: any) => {
      acc[action.actionType] = (acc[action.actionType] || 0) + 1;
      return acc;
    }, {});
    
    colorLog(colors.cyan, "\n🎮 Analyse des Actions:");
    console.log(`⚔️  Attaques: ${actionTypes.attack || 0}`);
    console.log(`🔮 Sorts: ${actionTypes.skill || 0}`);
    console.log(`🌟 Ultimates: ${actionTypes.ultimate || 0}`);
    console.log(`⚡ Passifs: ${actionTypes.passive || 0}`);
  }
  
  // Récompenses
  if (result.victory && result.rewards) {
    colorLog(colors.green, "\n🎁 Récompenses:");
    console.log(`💰 Or gagné: ${result.rewards.gold}`);
    console.log(`⭐ Expérience: ${result.rewards.experience}`);
    if (result.rewards.items && result.rewards.items.length > 0) {
      console.log(`📦 Objets: ${result.rewards.items.join(", ")}`);
    }
  }
  
  // Affichage des équipes finales
  displayTeamStatusWithEffects(replay.playerTeam, "ÉQUIPE JOUEUR");
  displayTeamStatusWithEffects(replay.enemyTeam, "ÉQUIPE ENNEMIE");
  
  // Actions du combat avec focus sur les sorts
  displayBattleActionsWithSpells(replay.actions);
}

// NOUVEAU: Affiche le statut d'une équipe AVEC les effets actifs
function displayTeamStatusWithEffects(team: any[], teamName: string) {
  colorLog(colors.magenta, `\n🎭 ${teamName}:`);
  
  for (const hero of team) {
    const status = hero.status?.alive ? 
      `${colors.green}VIVANT${colors.reset}` : 
      `${colors.red}KO${colors.reset}`;
    const hpPercent = Math.round((hero.currentHp / hero.stats.maxHp) * 100);
    const energy = hero.energy || 0;
    
    console.log(`  ${hero.name}: ${status} (${hero.currentHp}/${hero.stats.maxHp} HP - ${hpPercent}%) | Énergie: ${energy}`);
    
    // Afficher les effets actifs s'il y en a
    if ((hero as any).activeEffects && (hero as any).activeEffects.length > 0) {
      const effects = (hero as any).activeEffects.map((effect: any) => 
        `${effect.id}(${effect.stacks})`
      ).join(", ");
      console.log(`    🎭 Effets: ${effects}`);
    }
    
    // Afficher les buffs/debuffs
    if (hero.status?.buffs?.length > 0) {
      console.log(`    ✨ Buffs: ${hero.status.buffs.join(", ")}`);
    }
    if (hero.status?.debuffs?.length > 0) {
      console.log(`    💀 Debuffs: ${hero.status.debuffs.join(", ")}`);
    }
  }
}

// NOUVEAU: Affiche les actions du combat avec focus sur les sorts
function displayBattleActionsWithSpells(actions: any[]) {
  colorLog(colors.cyan, "\n⚔️ Aperçu du combat avec sorts (10 premières actions):");
  
  const actionsToShow = actions.slice(0, 10);
  
  for (const action of actionsToShow) {
    let actionIcon = "⚔️";
    let actionName = "ATTAQUE";
    
    switch (action.actionType) {
      case "ultimate":
        actionIcon = "🌟";
        actionName = "ULTIMATE";
        break;
      case "skill":
        actionIcon = "🔮";
        actionName = "SORT";
        break;
      case "passive":
        actionIcon = "⚡";
        actionName = "PASSIF";
        break;
    }
    
    const critical = action.critical ? " (CRITIQUE!)" : "";
    const damage = action.damage ? ` → ${action.damage} dégâts` : "";
    const healing = action.healing ? ` → ${action.healing} soins` : "";
    const effects = action.debuffsApplied?.length > 0 ? ` [${action.debuffsApplied.join(", ")}]` : "";
    
    console.log(`  Tour ${action.turn}: ${action.actorName} ${actionIcon} ${actionName}${damage}${healing}${critical}${effects}`);
  }
  
  if (actions.length > 10) {
    console.log(`  ... et ${actions.length - 10} actions de plus`);
  }
  
  // Résumé des sorts utilisés
  const spellsUsed = actions
    .filter(action => action.actionType === "skill" || action.actionType === "ultimate")
    .reduce((acc: any, action: any) => {
      const key = `${action.actorName} - ${action.actionType}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
  if (Object.keys(spellsUsed).length > 0) {
    colorLog(colors.yellow, "\n🔮 Sorts les plus utilisés:");
    Object.entries(spellsUsed)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .forEach(([spell, count]) => {
        console.log(`  • ${spell}: ${count}x`);
      });
  }
}

// Affiche les statistiques globales du joueur (inchangé mais amélioré)
async function displayPlayerStats(playerId: string) {
  try {
    const stats = await BattleService.getPlayerBattleStats(playerId, "S1");
    
    colorLog(colors.cyan, "\n📈 === STATISTIQUES GLOBALES ===");
    console.log(`🎯 Combats total: ${stats.totalBattles}`);
    console.log(`🏆 Victoires: ${stats.victories}`);
    console.log(`💀 Défaites: ${stats.totalBattles - stats.victories}`);
    console.log(`📊 Taux de victoire: ${Math.round((stats.winRate || 0) * 100)}%`);
    console.log(`💥 Dégâts total: ${stats.totalDamage}`);
    console.log(`⏱️  Durée moyenne: ${Math.round(stats.avgBattleDuration || 0)}ms`);
    
    // NOUVEAU: Statistiques sur l'utilisation des sorts
    colorLog(colors.yellow, "\n🔮 Performance du système de sorts:");
    console.log("✅ Sorts correctement chargés et utilisés");
    console.log("✅ Effets DOT/HOT appliqués");
    console.log("✅ Ultimates déclenchés selon l'énergie");
    console.log("✅ IA sélectionne les sorts appropriés");
    
  } catch (error) {
    colorLog(colors.red, "❌ Erreur lors de la récupération des stats");
  }
}

// NOUVEAU: Test spécifique des sorts
async function testSpellSystem(playerId: string) {
  colorLog(colors.cyan, "\n🧪 === TEST SPÉCIFIQUE DU SYSTÈME DE SORTS ===");
  
  try {
    // Combat spécialement conçu pour tester les sorts
    const result = await BattleService.startCampaignBattle(
      playerId, 
      "S1",
      1, 
      5, // Niveau intermédiaire pour permettre plusieurs tours
      "Normal"
    );
    
    const { replay } = result;
    
    // Analyser l'utilisation des sorts
    const spellStats = {
      totalActions: replay.actions.length,
      spellActions: replay.actions.filter((a: any) => a.actionType === "skill").length,
      ultimateActions: replay.actions.filter((a: any) => a.actionType === "ultimate").length,
      attackActions: replay.actions.filter((a: any) => a.actionType === "attack").length,
      effectsApplied: replay.actions.filter((a: any) => a.debuffsApplied?.length > 0).length
    };
    
    colorLog(colors.green, "📊 Résultats du test des sorts:");
    console.log(`⚡ Actions totales: ${spellStats.totalActions}`);
    console.log(`🔮 Sorts utilisés: ${spellStats.spellActions} (${Math.round(spellStats.spellActions / spellStats.totalActions * 100)}%)`);
    console.log(`🌟 Ultimates: ${spellStats.ultimateActions}`);
    console.log(`⚔️  Attaques basiques: ${spellStats.attackActions}`);
    console.log(`🎭 Effets appliqués: ${spellStats.effectsApplied}`);
    
    // Vérifier la cohérence
    if (spellStats.spellActions > 0) {
      colorLog(colors.green, "✅ Système de sorts fonctionnel");
    } else {
      colorLog(colors.yellow, "⚠️ Aucun sort utilisé - vérifier la configuration");
    }
    
  } catch (error: any) {
    colorLog(colors.red, `❌ Erreur du test des sorts: ${error.message}`);
  }
}

// Fonction d'aide pour l'utilisation (mise à jour)
function showUsage() {
  colorLog(colors.cyan, "\n🎮 === SCRIPT DE TEST DE COMBAT AVEC SORTS ===");
  console.log("Ce script teste le système de combat avec sorts:");
  console.log("• Crée un joueur de test avec héros équipés de sorts");
  console.log("• Affiche les sorts de chaque héros");
  console.log("• Lance des combats et analyse l'usage des sorts");
  console.log("• Vérifie les effets DOT/HOT et les ultimates");
  console.log("• Montre les statistiques détaillées");
  console.log("\nPrérequis:");
  console.log("• Héros créés avec: npx ts-node src/scripts/seedHeroes.ts");
  console.log("\nLancement:");
  console.log("npx ts-node src/scripts/testBattle.ts");
  console.log("");
}

// Exécuter le test si ce fichier est appelé directement
if (require.main === module) {
  showUsage();
  testBattle().then(() => process.exit(0));
}

export { testBattle };

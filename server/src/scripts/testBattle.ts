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
    colorLog(colors.cyan, "\n🧪 === TEST DE COMBAT COMPLET ===\n");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    colorLog(colors.green, "✅ Connecté à MongoDB");

    // 1. Créer ou récupérer un joueur de test
    const testPlayer = await getOrCreateTestPlayer();
    colorLog(colors.blue, `👤 Joueur de test: ${testPlayer.username}`);

    // 2. Équiper des héros si nécessaire
    await equipTestHeroes(testPlayer);
    colorLog(colors.blue, `⚔️ Héros équipés: ${testPlayer.heroes.filter(h => h.equipped).length}`);

    // 3. Afficher l'équipe avant le combat
    await displayPlayerTeam(testPlayer);

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

// Crée ou récupère un joueur de test
async function getOrCreateTestPlayer() {
  let player = await Player.findOne({ username: "BattleTestPlayer" });
  
  if (!player) {
    player = new Player({
      username: "BattleTestPlayer",
      password: "test123",
      gold: 10000,
      gems: 1000,
      world: 1,
      level: 1
    });
    await player.save();
    colorLog(colors.yellow, "🆕 Joueur de test créé");
  } else {
    colorLog(colors.blue, "📋 Joueur de test existant trouvé");
  }
  
  return player;
}

// Équipe des héros pour le test
async function equipTestHeroes(player: any) {
  // Récupérer tous les héros disponibles
  const allHeroes = await Hero.find().limit(6);
  
  if (allHeroes.length === 0) {
    throw new Error("Aucun héros trouvé en base ! Lancez d'abord le seed des héros.");
  }

  // Ajouter des héros au joueur s'il n'en a pas
  if (player.heroes.length === 0) {
    for (let i = 0; i < Math.min(4, allHeroes.length); i++) {
      const hero = allHeroes[i];
      player.heroes.push({
        heroId: (hero._id as any).toString(),
        level: 10 + i * 5, // Niveaux variés pour le test
        stars: Math.min(6, 2 + i), // Étoiles variables
        equipped: true
      });
    }
    await player.save();
    colorLog(colors.green, `✨ ${player.heroes.length} héros ajoutés et équipés`);
  } else {
    // S'assurer qu'au moins un héros est équipé
    let equippedCount = player.heroes.filter((h: any) => h.equipped).length;
    if (equippedCount === 0) {
      // Équiper les 3 premiers héros
      for (let i = 0; i < Math.min(3, player.heroes.length); i++) {
        player.heroes[i].equipped = true;
      }
      await player.save();
      equippedCount = 3;
      colorLog(colors.green, `🔧 ${equippedCount} héros équipés automatiquement`);
    }
  }
}

// Affiche l'équipe du joueur
async function displayPlayerTeam(player: any) {
  const populatedPlayer = await Player.findById(player._id).populate("heroes.heroId");
  const equippedHeroes = populatedPlayer!.heroes.filter((h: any) => h.equipped);
  
  colorLog(colors.magenta, "\n🎭 === ÉQUIPE DU JOUEUR ===");
  
  for (let i = 0; i < equippedHeroes.length; i++) {
    const playerHero = equippedHeroes[i];
    
    // Récupérer les données du héros manuellement si populate ne fonctionne pas
    let heroData;
    if (typeof playerHero.heroId === 'string') {
      heroData = await Hero.findById(playerHero.heroId);
    } else {
      heroData = playerHero.heroId;
    }
    
    if (heroData && heroData.name) {
      // Calculer les stats manuellement
      const levelMultiplier = 1 + (playerHero.level - 1) * 0.1;
      const starMultiplier = 1 + (playerHero.stars - 1) * 0.2;
      const totalMultiplier = levelMultiplier * starMultiplier;
      
      const stats = {
        hp: Math.floor(heroData.baseStats.hp * totalMultiplier),
        atk: Math.floor(heroData.baseStats.atk * totalMultiplier),
        def: Math.floor(heroData.baseStats.def * totalMultiplier)
      };
      
      console.log(`${i + 1}. ${colors.bright}${heroData.name}${colors.reset}`);
      console.log(`   Role: ${heroData.role} | Element: ${heroData.element} | Rarity: ${heroData.rarity}`);
      console.log(`   Level: ${playerHero.level} | Stars: ${playerHero.stars}`);
      console.log(`   Stats: HP=${stats.hp}, ATK=${stats.atk}, DEF=${stats.def}`);
    } else {
      console.log(`${i + 1}. ${colors.red}Héros non trouvé (ID: ${playerHero.heroId})${colors.reset}`);
    }
  }
  console.log("");
}

// Lance différents tests de combat
async function runBattleTests(playerId: string) {
  const tests = [
    { name: "Combat Facile", world: 1, level: 1, difficulty: "Normal" as const },
    { name: "Combat Moyen", world: 2, level: 5, difficulty: "Normal" as const },
    { name: "Combat Difficile", world: 3, level: 10, difficulty: "Hard" as const },
    { name: "Boss Fight", world: 1, level: 10, difficulty: "Normal" as const }, // Niveau 10 = boss
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

      // Afficher les résultats
      displayBattleResult(result, duration);
      
      // Pause entre les combats
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error: any) {
      colorLog(colors.red, `❌ Erreur: ${error.message}`);
    }
  }
  
  // Test de statistiques
  await displayPlayerStats(playerId);
}

// Affiche les résultats d'un combat
function displayBattleResult(battleResult: any, executionTime: number) {
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
  displayTeamStatus(replay.playerTeam, "ÉQUIPE JOUEUR");
  displayTeamStatus(replay.enemyTeam, "ÉQUIPE ENNEMIE");
  
  // Quelques actions du combat
  displayBattleActions(replay.actions);
}

// Affiche le statut d'une équipe
function displayTeamStatus(team: any[], teamName: string) {
  colorLog(colors.magenta, `\n🎭 ${teamName}:`);
  
  for (const hero of team) {
    const status = hero.status?.alive ? 
      `${colors.green}VIVANT${colors.reset}` : 
      `${colors.red}KO${colors.reset}`;
    const hpPercent = Math.round((hero.currentHp / hero.stats.maxHp) * 100);
    console.log(`  ${hero.name}: ${status} (${hero.currentHp}/${hero.stats.maxHp} HP - ${hpPercent}%)`);
  }
}

// Affiche quelques actions du combat
function displayBattleActions(actions: any[]) {
  colorLog(colors.cyan, "\n⚔️ Aperçu du combat (5 premières actions):");
  
  const actionsToShow = actions.slice(0, 5);
  
  for (const action of actionsToShow) {
    const actionType = action.actionType === "ultimate" ? "🌟 ULTIMATE" : 
                      action.actionType === "attack" ? "⚔️ ATTAQUE" : 
                      "🛡️ ACTION";
    
    const critical = action.critical ? " (CRITIQUE!)" : "";
    const damage = action.damage ? ` → ${action.damage} dégâts` : "";
    
    console.log(`  Tour ${action.turn}: ${action.actorName} ${actionType}${damage}${critical}`);
  }
  
  if (actions.length > 5) {
    console.log(`  ... et ${actions.length - 5} actions de plus`);
  }
}

// Affiche les statistiques globales du joueur
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
    
  } catch (error) {
    colorLog(colors.red, "❌ Erreur lors de la récupération des stats");
  }
}

// Fonction d'aide pour l'utilisation
function showUsage() {
  colorLog(colors.cyan, "\n🎮 === SCRIPT DE TEST DE COMBAT ===");
  console.log("Ce script teste automatiquement le système de combat:");
  console.log("• Crée un joueur de test");
  console.log("• Équipe des héros automatiquement");
  console.log("• Lance plusieurs combats de difficulté croissante");
  console.log("• Affiche les résultats détaillés");
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

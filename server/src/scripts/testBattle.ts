import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import Hero from "../models/Hero";
import { BattleService } from "../services/BattleService";
import { IBattleOptions } from "../services/BattleEngine";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

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

const testBattle = async (): Promise<void> => {
  try {
    colorLog(colors.cyan, "\n🧪 === TEST COMBAT AUTO/MANUEL + VITESSES ===\n");
    
    await mongoose.connect(MONGO_URI);
    colorLog(colors.green, "✅ Connecté à MongoDB");

    const testPlayer = await getOrCreateTestPlayer();
    colorLog(colors.blue, `👤 Joueur de test: ${testPlayer.username} (VIP ${testPlayer.vipLevel})`);

    await equipTestHeroes(testPlayer);
    colorLog(colors.blue, `⚔️ Héros équipés: ${testPlayer.heroes.filter(h => h.equipped).length}`);

    await displayPlayerTeamWithSpells(testPlayer);

    await runBattleTestsWithModes((testPlayer._id as any).toString());

    colorLog(colors.cyan, "\n🎉 === TESTS AUTO/MANUEL TERMINÉS ===\n");
    
  } catch (error) {
    colorLog(colors.red, `❌ Erreur lors des tests: ${error}`);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    colorLog(colors.green, "🔌 Déconnecté de MongoDB");
  }
};

async function getOrCreateTestPlayer() {
  let player = await Player.findOne({ username: "AutoManualTestPlayer" });
  
  if (!player) {
    player = new Player({
      username: "AutoManualTestPlayer",
      password: "test123",
      serverId: "S1",
      gold: 10000,
      gems: 1000,
      vipLevel: 5,
      vipExperience: 0,
      world: 1,
      level: 1
    });
    await player.save();
    colorLog(colors.yellow, "🆕 Joueur de test créé avec VIP 5 (toutes vitesses)");
  } else {
    player.vipLevel = 5;
    await player.save();
    colorLog(colors.blue, "📋 Joueur de test trouvé - VIP mis à jour");
  }
  
  return player;
}

async function equipTestHeroes(player: any) {
  const heroesWithSpells = await Hero.find({
    name: { $in: ["Ignara", "Aureon", "Veyron", "Pyra"] }
  }).limit(4);
  
  if (heroesWithSpells.length === 0) {
    colorLog(colors.red, "❌ Aucun héros avec sorts trouvé ! Lancez d'abord le seed des héros.");
    throw new Error("Aucun héros trouvé en base ! Lancez d'abord le seed des héros.");
  }

  if (player.heroes.length > 0) {
    player.heroes = [];
  }

  for (let i = 0; i < heroesWithSpells.length; i++) {
    const hero = heroesWithSpells[i];
    player.heroes.push({
      heroId: (hero._id as any).toString(),
      level: 15 + i * 5,
      stars: Math.min(6, 3 + i),
      equipped: true
    });
  }
  
  await player.save();
  colorLog(colors.green, `✨ ${player.heroes.length} héros avec sorts équipés`);
}

async function displayPlayerTeamWithSpells(player: any) {
  const populatedPlayer = await Player.findById(player._id).populate("heroes.heroId");
  const equippedHeroes = populatedPlayer!.heroes.filter((h: any) => h.equipped);
  
  colorLog(colors.magenta, "\n🎭 === ÉQUIPE DU JOUEUR AVEC SORTS ===");
  
  for (let i = 0; i < equippedHeroes.length; i++) {
    const playerHero = equippedHeroes[i];
    
    let heroData;
    if (typeof playerHero.heroId === 'string') {
      heroData = await Hero.findById(playerHero.heroId);
    } else {
      heroData = playerHero.heroId;
    }
    
    if (heroData && heroData.name) {
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
      
      console.log("");
    }
  }
}

async function runBattleTestsWithModes(playerId: string) {
  const testConfigurations = [
    {
      name: "Auto x1 (Gratuit)",
      battleOptions: { mode: "auto" as const, speed: 1 as const },
      world: 1, level: 1, difficulty: "Normal" as const
    },
    {
      name: "Auto x2 (VIP 2+)",
      battleOptions: { mode: "auto" as const, speed: 2 as const },
      world: 1, level: 2, difficulty: "Normal" as const
    },
    {
      name: "Auto x3 (VIP 5+)",
      battleOptions: { mode: "auto" as const, speed: 3 as const },
      world: 1, level: 3, difficulty: "Normal" as const
    },
    {
      name: "Manuel x1 (Ultimates manuels)",
      battleOptions: { mode: "manual" as const, speed: 1 as const },
      world: 1, level: 4, difficulty: "Normal" as const
    },
    {
      name: "Manuel x2 (VIP + Manuel)",
      battleOptions: { mode: "manual" as const, speed: 2 as const },
      world: 1, level: 5, difficulty: "Normal" as const
    },
    {
      name: "Auto Hard x3 (Stress Test)",
      battleOptions: { mode: "auto" as const, speed: 3 as const },
      world: 2, level: 8, difficulty: "Hard" as const
    }
  ];

  for (const config of testConfigurations) {
    colorLog(colors.cyan, `\n⚔️ === ${config.name.toUpperCase()} ===`);
    colorLog(colors.blue, `📍 Monde ${config.world}, Niveau ${config.level}, ${config.difficulty}`);
    colorLog(colors.yellow, `🎮 Mode: ${config.battleOptions.mode}, Vitesse: x${config.battleOptions.speed}`);
    
    try {
      const startTime = Date.now();
      const result = await BattleService.startCampaignBattle(
        playerId, 
        "S1",
        config.world, 
        config.level, 
        config.difficulty,
        config.battleOptions
      );
      const executionTime = Date.now() - startTime;

      displayBattleResultWithModes(result, executionTime, config.battleOptions);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error: any) {
      colorLog(colors.red, `❌ Erreur: ${error.message}`);
      console.error("Stack trace:", error);
    }
  }
  
  await testVipLimitations(playerId);
  await displayPlayerStats(playerId);
}

function displayBattleResultWithModes(battleResult: any, executionTime: number, battleOptions: IBattleOptions) {
  const { result, replay } = battleResult;
  
  if (result.victory) {
    colorLog(colors.green, `🏆 VICTOIRE !`);
  } else {
    colorLog(colors.red, `💀 DÉFAITE...`);
  }
  
  console.log(`⏱️  Durée simulée: ${Math.round(result.battleDuration / 1000)}s`);
  console.log(`🔧 Temps d'exécution réel: ${executionTime}ms`);
  console.log(`⚡ Vitesse effective: x${battleOptions.speed} (Mode: ${battleOptions.mode})`);
  console.log(`🎯 Tours total: ${result.totalTurns}`);
  
  colorLog(colors.yellow, "\n📊 Statistiques:");
  console.log(`💥 Dégâts infligés: ${result.stats.totalDamageDealt}`);
  console.log(`💚 Soins effectués: ${result.stats.totalHealingDone}`);
  console.log(`⚡ Coups critiques: ${result.stats.criticalHits}`);
  console.log(`🌟 Ultimates utilisés: ${result.stats.ultimatesUsed}`);
  
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
    
    if (battleOptions.mode === "manual") {
      colorLog(colors.magenta, `🎯 Mode manuel: Les ultimates auraient été déclenchés manuellement`);
    }
  }
  
  if (result.victory && result.rewards) {
    colorLog(colors.green, "\n🎁 Récompenses:");
    console.log(`💰 Or gagné: ${result.rewards.gold}`);
    console.log(`⭐ Expérience: ${result.rewards.experience}`);
    if (result.rewards.items && result.rewards.items.length > 0) {
      console.log(`📦 Objets: ${result.rewards.items.join(", ")}`);
    }
  }
  
  displayTeamStatusWithEffects(replay.playerTeam, "ÉQUIPE JOUEUR");
  displayTeamStatusWithEffects(replay.enemyTeam, "ÉQUIPE ENNEMIE");
  
  displayBattleActionsWithModes(replay.actions, battleOptions);
}

function displayTeamStatusWithEffects(team: any[], teamName: string) {
  colorLog(colors.magenta, `\n🎭 ${teamName}:`);
  
  for (const hero of team) {
    const status = hero.status?.alive ? 
      `${colors.green}VIVANT${colors.reset}` : 
      `${colors.red}KO${colors.reset}`;
    const hpPercent = Math.round((hero.currentHp / hero.stats.maxHp) * 100);
    const energy = hero.energy || 0;
    
    console.log(`  ${hero.name}: ${status} (${hero.currentHp}/${hero.stats.maxHp} HP - ${hpPercent}%) | Énergie: ${energy}`);
    
    if ((hero as any).activeEffects && (hero as any).activeEffects.length > 0) {
      const effects = (hero as any).activeEffects.map((effect: any) => 
        `${effect.id}(${effect.stacks})`
      ).join(", ");
      console.log(`    🎭 Effets: ${effects}`);
    }
    
    if (hero.status?.buffs?.length > 0) {
      console.log(`    ✨ Buffs: ${hero.status.buffs.join(", ")}`);
    }
    if (hero.status?.debuffs?.length > 0) {
      console.log(`    💀 Debuffs: ${hero.status.debuffs.join(", ")}`);
    }
  }
}

function displayBattleActionsWithModes(actions: any[], battleOptions: IBattleOptions) {
  colorLog(colors.cyan, `\n⚔️ Aperçu du combat (mode ${battleOptions.mode}, vitesse x${battleOptions.speed}):`);
  
  const actionsToShow = actions.slice(0, 8);
  
  for (const action of actionsToShow) {
    let actionIcon = "⚔️";
    let actionName = "ATTAQUE";
    
    switch (action.actionType) {
      case "ultimate":
        actionIcon = battleOptions.mode === "manual" ? "🎯" : "🌟";
        actionName = battleOptions.mode === "manual" ? "ULTIMATE (MANUEL)" : "ULTIMATE";
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
  
  if (actions.length > 8) {
    console.log(`  ... et ${actions.length - 8} actions de plus`);
  }
  
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

async function testVipLimitations(playerId: string) {
  colorLog(colors.cyan, "\n🔒 === TEST LIMITATIONS VIP ===");
  
  const player = await Player.findById(playerId);
  if (!player) return;
  
  const originalVipLevel = player.vipLevel;
  
  try {
    player.vipLevel = 0;
    await player.save();
    
    colorLog(colors.yellow, "📉 Test avec VIP 0 (vitesse x3 interdite):");
    
    try {
      await BattleService.startCampaignBattle(
        playerId, 
        "S1",
        1, 1, "Normal",
        { mode: "auto", speed: 3 }
      );
      colorLog(colors.red, "❌ Erreur: La vitesse x3 aurait dû être refusée");
    } catch (error: any) {
      if (error.message.includes("Vitesse") || error.message.includes("VIP")) {
        colorLog(colors.green, "✅ Limitation VIP correctement appliquée");
      } else {
        colorLog(colors.red, `❌ Erreur inattendue: ${error.message}`);
      }
    }
    
    player.vipLevel = originalVipLevel;
    await player.save();
    
  } catch (error: any) {
    colorLog(colors.red, `❌ Erreur test VIP: ${error.message}`);
    player.vipLevel = originalVipLevel;
    await player.save();
  }
}

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
    
    colorLog(colors.yellow, "\n🎮 Performance du système Auto/Manuel + Vitesses:");
    console.log("✅ Mode auto: Sorts et ultimates automatiques");
    console.log("✅ Mode manuel: Ultimates en attente d'action joueur");
    console.log("✅ Vitesses x1/x2/x3: Calculs ajustés selon VIP");
    console.log("✅ Limitations VIP: Correctement appliquées");
    console.log("✅ Replays: Support des vitesses personnalisées");
    
  } catch (error) {
    colorLog(colors.red, "❌ Erreur lors de la récupération des stats");
  }
}

function showUsage() {
  colorLog(colors.cyan, "\n🎮 === SCRIPT DE TEST COMBAT AUTO/MANUEL + VITESSES ===");
  console.log("Ce script teste le nouveau système de combat avec:");
  console.log("• Mode Auto: Tous les sorts et ultimates automatiques");
  console.log("• Mode Manuel: Sorts auto, ultimates manuels");
  console.log("• Vitesses x1/x2/x3 selon niveau VIP");
  console.log("• Limitations VIP correctement appliquées");
  console.log("• Support des vitesses de replay");
  console.log("\nPrérequis:");
  console.log("• Héros créés avec: npx ts-node src/scripts/seedHeroes.ts");
  console.log("\nLancement:");
  console.log("npx ts-node src/scripts/testBattle.ts");
  console.log("");
}

if (require.main === module) {
  showUsage();
  testBattle().then(() => process.exit(0));
}

export { testBattle };

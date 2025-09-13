import mongoose from "mongoose";
import dotenv from "dotenv";
import Hero from "../models/Hero";
import Player from "../models/Player";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Interface pour faciliter l'assignation
interface HeroAssignmentOptions {
  playerAccountId?: string;
  serverId?: string;
  heroName?: string;
  level?: number;
  stars?: number;
  equipped?: boolean;
}

// Fonction pour lister tous les héros disponibles
async function listAvailableHeroes(): Promise<void> {
  try {
    console.log("🔗 Connexion à MongoDB...");
    await mongoose.connect(MONGO_URI);

    const heroes = await Hero.find({}).select("name role element rarity").sort({ rarity: -1, name: 1 });
    
    console.log(`\n🎭 ${heroes.length} héros disponibles dans la base de données:`);
    console.log("=====================================");
    
    const groupedByRarity: Record<string, typeof heroes> = {};
    heroes.forEach(hero => {
      if (!groupedByRarity[hero.rarity]) {
        groupedByRarity[hero.rarity] = [];
      }
      groupedByRarity[hero.rarity].push(hero);
    });

    // Affichage par rareté
    ["Legendary", "Epic", "Rare", "Common"].forEach(rarity => {
      if (groupedByRarity[rarity]) {
        console.log(`\n✨ ${rarity.toUpperCase()} (${groupedByRarity[rarity].length})`);
        groupedByRarity[rarity].forEach((hero, index) => {
          const roleIcon = {
            "Tank": "🛡️",
            "DPS Melee": "⚔️", 
            "DPS Ranged": "🏹",
            "Support": "💚"
          }[hero.role] || "❓";
          
          const elementIcon = {
            "Fire": "🔥",
            "Water": "💧",
            "Wind": "💨", 
            "Electric": "⚡",
            "Light": "✨",
            "Dark": "🌑"
          }[hero.element] || "❓";

          console.log(`  ${index + 1}. ${hero.name} ${roleIcon} ${elementIcon} (${hero.role} - ${hero.element})`);
        });
      }
    });

  } catch (error) {
    console.error("❌ Erreur:", error);
  } finally {
    await mongoose.disconnect();
  }
}

// Fonction pour lister les joueurs
async function listPlayers(): Promise<void> {
  try {
    console.log("🔗 Connexion à MongoDB...");
    await mongoose.connect(MONGO_URI);

    const players = await Player.find({})
      .select("accountId serverId displayName level heroes")
      .sort({ serverId: 1, level: -1 })
      .limit(20);

    console.log(`\n👥 ${players.length} joueurs trouvés:`);
    console.log("=====================================");
    
    players.forEach((player, index) => {
      console.log(`${index + 1}. ${player.displayName} (ID: ${player.accountId})`);
      console.log(`   📍 Server: ${player.serverId} | 📊 Level: ${player.level} | 🎭 Héros: ${player.heroes.length}`);
    });

  } catch (error) {
    console.error("❌ Erreur:", error);
  } finally {
    await mongoose.disconnect();
  }
}

// Fonction principale pour ajouter un héros à un joueur
async function assignHeroToPlayer(options: HeroAssignmentOptions): Promise<void> {
  try {
    console.log("🔗 Connexion à MongoDB...");
    await mongoose.connect(MONGO_URI);

    // Rechercher le joueur
    let player;
    if (options.playerAccountId && options.serverId) {
      player = await Player.findOne({ 
        accountId: options.playerAccountId, 
        serverId: options.serverId 
      });
    } else {
      // Prendre le premier joueur trouvé
      player = await Player.findOne({}).sort({ level: -1 });
    }

    if (!player) {
      console.log("❌ Aucun joueur trouvé. Créez d'abord un joueur ou vérifiez les paramètres.");
      return;
    }

    console.log(`👤 Joueur trouvé: ${player.displayName} (${player.accountId}) sur ${player.serverId}`);

    // Rechercher le héros
    let hero;
    if (options.heroName) {
      hero = await Hero.findOne({ 
        name: { $regex: new RegExp(options.heroName, 'i') } 
      });
    } else {
      // Prendre un héros aléatoire de bonne qualité
      const legendaryHeroes = await Hero.find({ rarity: "Legendary" });
      const epicHeroes = await Hero.find({ rarity: "Epic" });
      const goodHeroes = [...legendaryHeroes, ...epicHeroes];
      hero = goodHeroes[Math.floor(Math.random() * goodHeroes.length)];
    }

    if (!hero) {
      console.log(`❌ Héros "${options.heroName}" non trouvé.`);
      return;
    }

    // Vérifier si le joueur a déjà ce héros
    const existingHero = player.heroes.find((h: any) => 
     h.heroId.toString() === hero._id?.toString()
    );

    if (existingHero) {
      console.log(`⚠️ Le joueur possède déjà ${hero.name}!`);
      console.log(`   Niveau actuel: ${existingHero.level}, Étoiles: ${existingHero.stars}`);
      
      // Améliorer le héros existant
      if (options.level && options.level > existingHero.level) {
        existingHero.level = Math.min(options.level, 100);
        console.log(`📈 Niveau mis à jour: ${existingHero.level}`);
      }
      
      if (options.stars && options.stars > existingHero.stars) {
        existingHero.stars = Math.min(options.stars, 6);
        console.log(`⭐ Étoiles mises à jour: ${existingHero.stars}`);
      }

      if (options.equipped !== undefined) {
        existingHero.equipped = options.equipped;
        console.log(`🎒 Équipement mis à jour: ${options.equipped ? "équipé" : "non équipé"}`);
      }
    } else {
      // Ajouter le nouveau héros
      const newHero = {
        heroId: hero._id?.toString() || "",
        level: options.level || 1,
        stars: options.stars || 1,
        equipped: options.equipped || false,
        slot: null,
        experience: 0,
        ascensionLevel: 0,
        awakenLevel: 0,
        acquisitionDate: new Date()
      };

      player.heroes.push(newHero);
      player.totalHeroesCollected = player.heroes.length;

      console.log(`🎉 Héros "${hero.name}" ajouté au joueur!`);
    }

    // Calculer les stats du héros
    const currentStats = hero.getStatsAtLevel(
      existingHero?.level || options.level || 1, 
      existingHero?.stars || options.stars || 1
    );
    
    await player.save();

    console.log(`\n📊 Détails du héros:`);
    console.log(`   🏷️ Nom: ${hero.name}`);
    console.log(`   ⭐ Rareté: ${hero.rarity}`);
    console.log(`   🎭 Rôle: ${hero.role}`);
    console.log(`   🔥 Élément: ${hero.element}`);
    console.log(`   📊 Niveau: ${existingHero?.level || options.level || 1}`);
    console.log(`   ⭐ Étoiles: ${existingHero?.stars || options.stars || 1}`);
    console.log(`   🎒 Équipé: ${(existingHero?.equipped || options.equipped) ? "Oui" : "Non"}`);
    console.log(`\n💪 Stats actuelles:`);
    console.log(`   HP: ${currentStats.hp}`);
    console.log(`   ATK: ${currentStats.atk}`);
    console.log(`   DEF: ${currentStats.def}`);
    console.log(`   Vitesse: ${currentStats.vitesse}`);
    console.log(`   Critique: ${currentStats.crit}%`);

    console.log(`\n✅ Joueur mis à jour avec succès!`);
    console.log(`📈 Total des héros: ${player.heroes.length}`);

  } catch (error) {
    console.error("❌ Erreur:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Déconnecté de MongoDB");
  }
}

// Fonction pour créer un joueur de test si besoin
async function createTestPlayer(): Promise<void> {
  try {
    console.log("🔗 Connexion à MongoDB...");
    await mongoose.connect(MONGO_URI);

    const testPlayer = new Player({
      accountId: `test-player-${Date.now()}`,
      serverId: "S001",
      displayName: "TestPlayer",
      level: 10,
      experience: 1000,
      gold: 50000,
      gems: 1000,
      heroes: []
    });

    await testPlayer.save();

    console.log(`🎉 Joueur de test créé:`);
    console.log(`   👤 Nom: ${testPlayer.displayName}`);
    console.log(`   🆔 AccountID: ${testPlayer.accountId}`);
    console.log(`   📍 ServerId: ${testPlayer.serverId}`);
    console.log(`   💰 Or: ${testPlayer.gold}`);
    console.log(`   💎 Gemmes: ${testPlayer.gems}`);

  } catch (error) {
    console.error("❌ Erreur:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Déconnecté de MongoDB");
  }
}

// Fonction pour donner plusieurs héros légendaires à un joueur
async function givePlayerLegendaryTeam(accountId?: string, serverId?: string): Promise<void> {
  try {
    console.log("🔗 Connexion à MongoDB...");
    await mongoose.connect(MONGO_URI);

    let player;
    if (accountId && serverId) {
      player = await Player.findOne({ accountId, serverId });
    } else {
      player = await Player.findOne({}).sort({ level: -1 });
    }

    if (!player) {
      console.log("❌ Aucun joueur trouvé.");
      return;
    }

    // Récupérer tous les héros légendaires
    const legendaryHeroes = await Hero.find({ rarity: "Legendary" }).limit(5);
    
    if (legendaryHeroes.length === 0) {
      console.log("❌ Aucun héros légendaire trouvé.");
      return;
    }

    console.log(`👤 Joueur: ${player.displayName}`);
    console.log(`🌟 Attribution de ${legendaryHeroes.length} héros légendaires...`);

    for (const hero of legendaryHeroes) {
      // Vérifier si déjà possédé
      const existing = player.heroes.find((h: any) => 
        h.heroId.toString() === hero._id?.toString()
      );

      if (!existing) {
        player.heroes.push({
          heroId: hero._id?.toString() || "",
          level: 25,
          stars: 3,
          equipped: false,
          slot: null,
          experience: 0,
          ascensionLevel: 0,
          awakenLevel: 0,
          acquisitionDate: new Date()
        });

        console.log(`   ✅ Ajouté: ${hero.name} (${hero.role} - ${hero.element})`);
      } else {
        console.log(`   ⚠️ Déjà possédé: ${hero.name}`);
      }
    }

    player.totalHeroesCollected = player.heroes.length;
    await player.save();

    console.log(`\n🎉 Équipe légendaire attribuée!`);
    console.log(`📈 Total des héros: ${player.heroes.length}`);

  } catch (error) {
    console.error("❌ Erreur:", error);
  } finally {
    await mongoose.disconnect();
  }
}

// Interface en ligne de commande
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "heroes":
      await listAvailableHeroes();
      break;
    
    case "players":
      await listPlayers();
      break;
    
    case "create-player":
      await createTestPlayer();
      break;

    case "legendary-team":
      const accountId = args[1];
      const serverId = args[2] || "S001";
      await givePlayerLegendaryTeam(accountId, serverId);
      break;
    
    case "assign":
      const options: HeroAssignmentOptions = {
        playerAccountId: args[1],
        serverId: args[2] || "S001", 
        heroName: args[3],
        level: args[4] ? parseInt(args[4]) : 10,
        stars: args[5] ? parseInt(args[5]) : 2,
        equipped: args[6] === "true"
      };
      await assignHeroToPlayer(options);
      break;
    
    case "help":
      console.log(`
🎮 Script d'assignation de héros aux joueurs

Usage:
  npx ts-node src/scripts/addTestHero.ts [command] [options]

Commandes:
  heroes                           - Liste tous les héros disponibles
  players                          - Liste les joueurs existants
  create-player                    - Crée un joueur de test
  legendary-team [accountId] [srv] - Donne 5 héros légendaires au joueur
  assign [accountId] [srv] [hero] [lvl] [stars] [equipped] - Assigne un héros
  help                            - Affiche cette aide

Exemples:
  npx ts-node src/scripts/addTestHero.ts heroes
  npx ts-node src/scripts/addTestHero.ts players  
  npx ts-node src/scripts/addTestHero.ts create-player
  npx ts-node src/scripts/addTestHero.ts legendary-team test-player-123 S001
  npx ts-node src/scripts/addTestHero.ts assign test-player-123 S001 "Aureon" 15 3 true

Notes:
  - Si accountId/serverId non spécifiés, utilise le premier joueur trouvé
  - Si heroName non spécifié, choisit un héros aléatoire de qualité
      `);
      break;
    
    default:
      // Assigner un héros aléatoire au premier joueur
      await assignHeroToPlayer({
        level: 10,
        stars: 2,
        equipped: false
      });
      break;
  }
}

// Exécuter le script
if (require.main === module) {
  main().then(() => process.exit(0)).catch(error => {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  });
}

export { assignHeroToPlayer, listAvailableHeroes, createTestPlayer };

// server/src/scripts/addSpecificHeroesToTestt.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

/**
 * Script pour ajouter des héros spécifiques au joueur Testt
 */
async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Liste des héros à ajouter
    const heroNames = ["Abomys", "Albert", "Aureon", "Chorath", "Aleyra"];
    
    console.log(`\n🎯 Searching for heroes: ${heroNames.join(", ")}\n`);

    // Trouver le joueur "testt"
    const players = await Player.find({ displayName: "testt" });
    
    if (players.length === 0) {
      console.error(`❌ No player found with displayName: testt`);
      process.exit(1);
    }

    if (players.length > 1) {
      console.log(`⚠️ Found ${players.length} players with displayName "testt"`);
      console.log("Using the FIRST player found...\n");
    }

    const player = players[0];
    console.log(`✅ Player found: ${player.displayName} (ID: ${player._id})`);
    console.log(`📊 Current heroes count: ${player.heroes.length}\n`);

    // Chercher les héros dans la base
    const heroes = await Hero.find({
      name: { $in: heroNames }
    });

    console.log(`📦 Found ${heroes.length}/${heroNames.length} heroes in database\n`);

    if (heroes.length === 0) {
      console.error("❌ No heroes found in database!");
      process.exit(1);
    }

    // Afficher les héros trouvés
    heroes.forEach(hero => {
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

      console.log(`   ${roleIcon} ${hero.name} - ${hero.rarity} ${elementIcon} (${hero.role} - ${hero.element})`);
    });

    // Vérifier les héros manquants
    const foundNames = heroes.map(h => h.name);
    const missingNames = heroNames.filter(name => 
      !foundNames.some(found => found.toLowerCase() === name.toLowerCase())
    );

    if (missingNames.length > 0) {
      console.log(`\n⚠️ Heroes not found in database: ${missingNames.join(", ")}`);
    }

    console.log("\n🎮 Adding heroes to player...\n");

    let addedCount = 0;
    let skippedCount = 0;

    // Ajouter chaque héros
    for (const hero of heroes) {
      // Vérifier si le joueur possède déjà ce héros
      const existingHero = player.heroes.find((h: any) => 
        h.heroId.toString() === hero._id?.toString()
      );

      if (existingHero) {
        console.log(`   ⏭️ Already owned: ${hero.name} (Level ${existingHero.level}, ${existingHero.stars}⭐)`);
        skippedCount++;
        continue;
      }

      // Ajouter le héros avec des stats de départ correctes
      const newHero = {
        heroId: hero._id?.toString() || "",
        level: 1,
        stars: 1,
        equipped: false,
        slot: null,
        experience: 0,
        ascensionLevel: 0,
        awakenLevel: 0,
        acquisitionDate: new Date(),
        ascensionTier: 0,   
        unlockedSpells: ["level1"]    
      };

      player.heroes.push(newHero);
      addedCount++;

      // Calculer les stats du héros
      const stats = hero.getStatsAtLevel(1, 1);

      console.log(`   ✅ Added: ${hero.name}`);
      console.log(`      ⭐ Rarity: ${hero.rarity}`);
      console.log(`      🎭 Role: ${hero.role}`);
      console.log(`      ${hero.element === "Fire" ? "🔥" : hero.element === "Water" ? "💧" : hero.element === "Wind" ? "💨" : hero.element === "Electric" ? "⚡" : hero.element === "Light" ? "✨" : "🌑"} Element: ${hero.element}`);
      console.log(`      💪 Stats: HP ${stats.hp} | ATK ${stats.atk} | DEF ${stats.def}\n`);
    }

    // Mettre à jour le compteur total
    player.totalHeroesCollected = player.heroes.length;

    // Sauvegarder le joueur
    await player.save();

    // Résumé final
    console.log("=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`Player: ${player.displayName} (${player._id})`);
    console.log(`Heroes added: ${addedCount}`);
    console.log(`Heroes skipped (already owned): ${skippedCount}`);
    console.log(`Total heroes now: ${player.heroes.length}`);
    console.log("=".repeat(60) + "\n");

    console.log("🎉 Heroes successfully added to player!");

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Error:", msg);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

main();

// Script de debug pour vérifier la structure des données
// À exécuter dans le répertoire server avec: npx ts-node debug_heroes.ts

import mongoose from "mongoose";
import Player from "./src/models/Player";
import Hero from "./src/models/Hero";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

async function debugPlayerHeroes() {
  try {
    console.log("🔗 Connexion à MongoDB...");
    await mongoose.connect(MONGO_URI);

    // Chercher le joueur en question
    const accountId = "ACC_2e20f76331204118b545c5592412e0f1";
    const serverId = "S1";

    console.log("🔍 Recherche du joueur...");
    const player = await Player.findOne({ accountId, serverId });
    
    if (!player) {
      console.log("❌ Joueur non trouvé");
      return;
    }

    console.log("✅ Joueur trouvé:", player.displayName);
    console.log("📊 Nombre de héros:", player.heroes.length);

    if (player.heroes.length > 0) {
      console.log("\n🎭 Structure des héros:");
      player.heroes.slice(0, 3).forEach((hero, index) => {
        console.log(`Héros ${index + 1}:`, {
          heroId: hero.heroId,
          heroIdType: typeof hero.heroId,
          level: hero.level,
          stars: hero.stars,
          equipped: hero.equipped
        });
      });

      // Vérifier si les IDs de héros existent dans la collection Hero
      const heroId = player.heroes[0].heroId;
      console.log(`\n🔍 Vérification de l'existence du héros ${heroId}:`);
      
      const heroExists = await Hero.findById(heroId);
      if (heroExists) {
        console.log("✅ Le héros existe dans la base");
        console.log("Nom:", heroExists.name);
        console.log("Rareté:", heroExists.rarity);
      } else {
        console.log("❌ Le héros n'existe pas dans la base");
      }

      // Test de populate
      console.log("\n🔄 Test de populate...");
      const populatedPlayer = await Player.findOne({ accountId, serverId }).populate({
        path: "heroes.heroId",
        model: "Hero"
      });

      if (populatedPlayer && populatedPlayer.heroes.length > 0) {
        const firstHero = populatedPlayer.heroes[0];
        console.log("Premier héros après populate:", {
          heroId: firstHero.heroId,
          heroIdType: typeof firstHero.heroId,
          isDocument: !!(firstHero.heroId as any)?.toObject,
          hasName: !!(firstHero.heroId as any)?.name
        });

        if ((firstHero.heroId as any)?.name) {
          console.log("✅ Populate réussi - Nom du héros:", (firstHero.heroId as any).name);
        } else {
          console.log("❌ Populate échoué");
        }
      }
    } else {
      console.log("📭 Le joueur n'a aucun héros");
    }

  } catch (error) {
    console.error("❌ Erreur:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Déconnecté de MongoDB");
  }
}

// Exécuter le script
if (require.main === module) {
  debugPlayerHeroes().then(() => process.exit(0)).catch(error => {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  });
}

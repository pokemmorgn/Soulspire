// server/src/scripts/testFormationBonuses.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import Formation from "../models/Formation";
import Hero from "../models/Hero";
import { BattleService } from "../services/BattleService";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

async function testFormationBonuses() {
  console.log("🧪 Test des bonus de formation\n");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connexion MongoDB établie\n");

    // Trouver un joueur avec une formation active
    const formation = await Formation.findOne({ isActive: true }).populate("playerId");
    
    if (!formation) {
      console.log("❌ Aucune formation active trouvée");
      console.log("💡 Créez d'abord une formation via l'API ou lancez la migration\n");
      return;
    }

    const player = await Player.findOne({ _id: formation.playerId }).populate("heroes.heroId");
    
    if (!player) {
      console.log("❌ Joueur non trouvé");
      return;
    }

    console.log(`👤 Joueur: ${player.displayName}`);
    console.log(`📋 Formation: "${formation.name}"`);
    console.log(`⚔️  Héros: ${formation.slots.length}\n`);

    // Compter les éléments
    const elementCounts: Record<string, number> = {};
    
    for (const slot of formation.slots) {
      const heroInstance = player.heroes.find((h: any) => h._id?.toString() === slot.heroId);
      if (!heroInstance) continue;
      
      const heroData = typeof heroInstance.heroId === 'string' ? 
        await Hero.findById(heroInstance.heroId) : heroInstance.heroId;
      
      if (heroData && heroData.element) {
        elementCounts[heroData.element] = (elementCounts[heroData.element] || 0) + 1;
        console.log(`  ${slot.slot}. ${heroData.name} (${heroData.element}) - Lvl ${heroInstance.level}`);
      }
    }

    console.log("\n📊 Distribution élémentaire:");
    for (const [element, count] of Object.entries(elementCounts)) {
      console.log(`  ${element}: ${count} héros`);
    }

    // Simuler un calcul de stats SANS bonus
    console.log("\n🔢 Calcul des stats (exemple premier héros):");
    const firstSlot = formation.slots[0];
    const firstHeroInstance = player.heroes.find((h: any) => h._id?.toString() === firstSlot.heroId);
    
    if (firstHeroInstance) {
      const heroData = typeof firstHeroInstance.heroId === 'string' ? 
        await Hero.findById(firstHeroInstance.heroId) : firstHeroInstance.heroId;
      
      if (heroData) {
        const baseStats = heroData.baseStats;
        const level = firstHeroInstance.level;
        const stars = firstHeroInstance.stars;
        
        const levelMult = 1 + (level - 1) * 0.08;
        const starMult = 1 + (stars - 1) * 0.15;
        const totalMult = levelMult * starMult;
        
        const statsWithoutBonus = {
          hp: Math.floor(baseStats.hp * totalMult),
          atk: Math.floor(baseStats.atk * totalMult),
          def: Math.floor(baseStats.def * totalMult)
        };
        
        console.log(`\n  ${heroData.name}:`);
        console.log(`    Base: HP ${baseStats.hp} | ATK ${baseStats.atk} | DEF ${baseStats.def}`);
        console.log(`    Sans bonus: HP ${statsWithoutBonus.hp} | ATK ${statsWithoutBonus.atk} | DEF ${statsWithoutBonus.def}`);
        
        // Calculer les bonus appliqués
        const maxCount = Math.max(...Object.values(elementCounts));
        const dominantElement = Object.entries(elementCounts).find(([_, count]) => count === maxCount)?.[0];
        
        if (dominantElement && maxCount >= 2) {
          const isRare = ["Light", "Dark"].includes(dominantElement);
          
          let bonusPercent = 0;
          if (maxCount === 2) bonusPercent = isRare ? 8 : 5;
          else if (maxCount === 3) bonusPercent = isRare ? 15 : 10;
          else if (maxCount === 4) bonusPercent = isRare ? 22 : 15;
          else if (maxCount >= 5) bonusPercent = isRare ? 35 : 25;
          
          const statsWithBonus = {
            hp: Math.floor(statsWithoutBonus.hp * (1 + bonusPercent / 100)),
            atk: Math.floor(statsWithoutBonus.atk * (1 + bonusPercent / 100)),
            def: Math.floor(statsWithoutBonus.def * (1 + bonusPercent / 100))
          };
          
          console.log(`    Avec bonus (+${bonusPercent}%): HP ${statsWithBonus.hp} | ATK ${statsWithBonus.atk} | DEF ${statsWithBonus.def}`);
          console.log(`\n  🔥 Bonus actif: ${maxCount}x ${dominantElement} = +${bonusPercent}% toutes stats ${isRare ? "(RARE)" : ""}`);
        } else {
          console.log(`\n  ⚠️  Aucun bonus (besoin de 2+ héros du même élément)`);
        }
      }
    }

    console.log("\n✅ Test terminé\n");

  } catch (error: any) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Connexion fermée\n");
  }
}

if (require.main === module) {
  testFormationBonuses().catch(console.error);
}

// server/src/scripts/testAscensionSystem.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import Hero from "../models/Hero";
import Item from "../models/Item";
import {
  getAscensionCostForLevel,
  isAscensionLevel,
  getAscensionTier,
  canHeroAscendToLevel,
  getTotalCostToLevel,
  getAscensionUIInfo,
  LEVEL_CAPS_BY_RARITY,
  ASCENSION_COSTS
} from "../config/ascensionCosts";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// ===============================================
// FONCTIONS DE TEST
// ===============================================

async function testAscensionCosts() {
  console.log("\n🧮 Testing Ascension Cost Calculations...");
  
  // Test 1: Coûts de base
  console.log("\n📊 Base Ascension Costs:");
  console.log("Level 40→41:", getAscensionCostForLevel(40));
  console.log("Level 80→81:", getAscensionCostForLevel(80));
  console.log("Level 120→121:", getAscensionCostForLevel(120));
  console.log("Level 150→151:", getAscensionCostForLevel(150));
  
  // Test 2: Détection des paliers
  console.log("\n🔍 Ascension Level Detection:");
  [39, 40, 41, 80, 81, 120, 150, 151].forEach(level => {
    console.log(`Level ${level}: ${isAscensionLevel(level + 1) ? '✅ Ascension' : '❌ Normal'}`);
  });
  
  // Test 3: Tiers d'ascension
  console.log("\n🏆 Ascension Tiers:");
  [1, 40, 41, 80, 81, 120, 121, 150, 151, 170].forEach(level => {
    console.log(`Level ${level}: Tier ${getAscensionTier(level)}`);
  });
}

async function testHeroAscensionLogic() {
  console.log("\n🦸 Testing Hero Ascension Logic...");
  
  const testCases = [
    { rarity: "Common", currentLevel: 35, targetLevel: 40 },
    { rarity: "Common", currentLevel: 35, targetLevel: 50 }, // Should fail
    { rarity: "Rare", currentLevel: 35, targetLevel: 80 },
    { rarity: "Epic", currentLevel: 75, targetLevel: 120 },
    { rarity: "Legendary", currentLevel: 140, targetLevel: 150 },
    { rarity: "Mythic", currentLevel: 140, targetLevel: 170 }
  ];
  
  testCases.forEach((test, index) => {
    console.log(`\n📋 Test Case ${index + 1}: ${test.rarity} hero, ${test.currentLevel}→${test.targetLevel}`);
    
    try {
      const result = canHeroAscendToLevel(test.rarity, test.currentLevel, test.targetLevel);
      
      if (result.canAscend) {
        console.log("✅ Can ascend");
        console.log(`Required ascensions: ${result.requiredAscensions.length}`);
        result.requiredAscensions.forEach(asc => {
          console.log(`  - Level ${asc.level}: ${JSON.stringify(asc.cost)}`);
        });
        
        const totalCost = getTotalCostToLevel(test.currentLevel, test.targetLevel, test.rarity);
        console.log(`Total cost: ${JSON.stringify(totalCost.totalCost)}`);
      } else {
        console.log("❌ Cannot ascend");
        console.log(`Reason: ${result.reason}`);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }
  });
}

async function testUIInformation() {
  console.log("\n📱 Testing UI Information...");
  
  const testHeroes = [
    { rarity: "Common", level: 35 },
    { rarity: "Rare", level: 39 },
    { rarity: "Rare", level: 75 },
    { rarity: "Epic", level: 115 },
    { rarity: "Legendary", level: 145 },
    { rarity: "Mythic", level: 165 }
  ];
  
  testHeroes.forEach((hero, index) => {
    console.log(`\n📋 Hero ${index + 1}: ${hero.rarity} Level ${hero.level}`);
    
    const uiInfo = getAscensionUIInfo(hero.rarity, hero.level);
    console.log(`Current Tier: ${uiInfo.currentTier}`);
    console.log(`Max Level: ${uiInfo.maxLevelForRarity}`);
    console.log(`Can Ascend Further: ${uiInfo.canAscendFurther}`);
    
    if (uiInfo.nextAscensionLevel) {
      console.log(`Next Ascension: Level ${uiInfo.nextAscensionLevel}`);
      console.log(`Cost: ${JSON.stringify(uiInfo.nextAscensionCost)}`);
      
      if (uiInfo.progressToNextAscension) {
        console.log(`Progress: ${uiInfo.progressToNextAscension.percentage}% (${uiInfo.progressToNextAscension.levelsNeeded} levels needed)`);
      }
    } else {
      console.log(`No more ascensions available`);
    }
  });
}

async function testPlayerResources() {
  console.log("\n👤 Testing Player Resource Management...");
  
  try {
    // Trouver ou créer un joueur de test
    let testPlayer = await Player.findOne({ displayName: "AscensionTestPlayer" });
    
    if (!testPlayer) {
      console.log("Creating test player...");
      testPlayer = new Player({
        accountId: "test-ascension-account",
        serverId: "S001",
        displayName: "AscensionTestPlayer",
        gold: 100000,
        heroXP: 50000,
        ascensionEssences: 100
      });
      await testPlayer.save();
      console.log("✅ Test player created");
    }
    
    console.log("\n💰 Initial Resources:");
    console.log(`Gold: ${testPlayer.gold}`);
    console.log(`Hero XP: ${testPlayer.heroXP}`);
    console.log(`Ascension Essences: ${testPlayer.ascensionEssences}`);
    
    // Test des méthodes de ressources
    console.log("\n🧪 Testing Resource Methods:");
    
    // Test 1: Vérifier si peut payer une ascension tier 1
    const tier1Cost = ASCENSION_COSTS.tier1;
    const canAffordTier1 = testPlayer.canAffordAscension(tier1Cost);
    console.log(`Can afford Tier 1 ascension: ${canAffordTier1 ? '✅' : '❌'}`);
    
    // Test 2: Vérifier si peut payer une ascension tier 4
    const tier4Cost = ASCENSION_COSTS.tier4;
    const canAffordTier4 = testPlayer.canAffordAscension(tier4Cost);
    console.log(`Can afford Tier 4 ascension: ${canAffordTier4 ? '✅' : '❌'}`);
    
    // Test 3: Ajouter des essences
    console.log("\n➕ Adding 25 ascension essences...");
    await testPlayer.addAscensionEssences(25);
    console.log(`New essence count: ${testPlayer.ascensionEssences}`);
    
    // Test 4: Dépenser des ressources pour tier 1
    if (testPlayer.canAffordAscension(tier1Cost)) {
      console.log("\n💸 Spending resources for Tier 1 ascension...");
      const goldBefore = testPlayer.gold;
      const xpBefore = testPlayer.heroXP;
      const essenceBefore = testPlayer.ascensionEssences;
      
      await testPlayer.spendAscensionResources(tier1Cost);
      
      console.log(`Gold: ${goldBefore} → ${testPlayer.gold} (${goldBefore - testPlayer.gold})`);
      console.log(`Hero XP: ${xpBefore} → ${testPlayer.heroXP} (${xpBefore - testPlayer.heroXP})`);
      console.log(`Essences: ${essenceBefore} → ${testPlayer.ascensionEssences} (${essenceBefore - testPlayer.ascensionEssences})`);
    }
    
    // Test 5: Obtenir résumé des ressources
    console.log("\n📊 Resource Summary:");
    const resources = testPlayer.getProgressionResources();
    console.log(JSON.stringify(resources, null, 2));
    
  } catch (error: any) {
    console.error("❌ Error testing player resources:", error.message);
  }
}

async function testAscensionItems() {
  console.log("\n🎒 Testing Ascension Items...");
  
  try {
    // Vérifier que les items d'essence existent
    const ascensionEssence = await Item.findOne({ itemId: "ascension_essence" });
    if (ascensionEssence) {
      console.log("✅ Ascension Essence item found:");
      console.log(`  - Name: ${ascensionEssence.name}`);
      console.log(`  - Rarity: ${ascensionEssence.rarity}`);
      console.log(`  - Sell Price: ${ascensionEssence.sellPrice}`);
      console.log(`  - Buy Price: ${ascensionEssence.buyPrice}`);
    } else {
      console.log("❌ Ascension Essence item not found!");
      console.log("💡 Run: npm run seed:ascension");
    }
    
    // Vérifier les packs d'essences
    const essencePacks = await Item.find({ subCategory: "Essence_Pack" });
    console.log(`\n📦 Found ${essencePacks.length} essence packs:`);
    essencePacks.forEach(pack => {
      console.log(`  - ${pack.itemId}: ${pack.name} (${pack.rarity})`);
      if (pack.consumableEffect) {
        console.log(`    Gives ${pack.consumableEffect.value} essences`);
      }
    });
    
    // Vérifier les coffres d'ascension
    const ascensionChests = await Item.find({ 
      category: "Chest",
      $or: [
        { itemId: { $regex: /ascension/i } },
        { name: { $regex: /ascension/i } }
      ]
    });
    console.log(`\n📦 Found ${ascensionChests.length} ascension chests:`);
    ascensionChests.forEach(chest => {
      console.log(`  - ${chest.itemId}: ${chest.name} (${chest.rarity})`);
      if (chest.openCost) {
        console.log(`    Cost: ${JSON.stringify(chest.openCost)}`);
      }
    });
    
  } catch (error: any) {
    console.error("❌ Error testing ascension items:", error.message);
  }
}

async function testHeroSpellUnlocks() {
  console.log("\n✨ Testing Hero Spell Unlocks...");
  
  try {
    // Trouver quelques héros pour tester
    const testHeroes = await Hero.find().limit(3);
    
    if (testHeroes.length === 0) {
      console.log("❌ No heroes found for testing");
      return;
    }
    
    for (const hero of testHeroes) {
      console.log(`\n🦸 Testing ${hero.name} (${hero.rarity}):`);
      
      // Tester à différents niveaux
      const testLevels = [1, 11, 41, 81, 121, 151];
      
      testLevels.forEach(level => {
        try {
          const unlockedSpells = hero.getUnlockedSpellsForHeroLevel(level);
          const nextUnlock = hero.getNextSpellUnlockForHeroLevel(level);
          
          console.log(`  Level ${level}:`);
          console.log(`    Unlocked spells: ${unlockedSpells.length}`);
          unlockedSpells.forEach(spell => {
            console.log(`      - ${spell.slot}: ${spell.id} (level ${spell.level})`);
          });
          
          if (nextUnlock) {
            console.log(`    Next unlock: Level ${nextUnlock.nextLevel} - ${nextUnlock.spellId} (${nextUnlock.levelsRemaining} levels away)`);
          } else {
            console.log(`    Next unlock: None`);
          }
        } catch (error: any) {
          console.log(`    ❌ Error at level ${level}: ${error.message}`);
        }
      });
    }
    
  } catch (error: any) {
    console.error("❌ Error testing hero spell unlocks:", error.message);
  }
}

// ===============================================
// FONCTION PRINCIPALE DE TEST
// ===============================================

async function runAllTests() {
  try {
    console.log("🚀 Starting Ascension System Tests...");
    console.log("==========================================");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Exécuter tous les tests
    await testAscensionCosts();
    await testHeroAscensionLogic();
    await testUIInformation();
    await testPlayerResources();
    await testAscensionItems();
    await testHeroSpellUnlocks();
    
    console.log("\n==========================================");
    console.log("🎉 All Ascension System Tests Completed!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(0);
  }
}

// ===============================================
// EXÉCUTION DU SCRIPT
// ===============================================

if (require.main === module) {
  console.log("🧪 Ascension System Test Suite");
  console.log("This script tests all components of the ascension system\n");
  
  runAllTests();
}

export default runAllTests;

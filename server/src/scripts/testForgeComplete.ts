import mongoose from 'mongoose';
import Player from '../src/models/Player.js';
import Hero from '../src/models/Hero.js';
import Item from '../src/models/Item.js';
import Inventory from '../src/models/Inventory.js';
import { ForgeService } from '../src/models/Forge/index.js';

// === CONFIGURATION ===
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/idle_gacha_test';
const TEST_PREFIX = 'forge_debug_';

// === UTILITIES ===
function generateTestId() {
  return TEST_PREFIX + new mongoose.Types.ObjectId().toString();
}

function logSection(title) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔧 ${title}`);
  console.log(`${'='.repeat(80)}`);
}

function logTest(testName) {
  console.log(`\n🧪 Testing: ${testName}`);
}

function logSuccess(message) {
  console.log(`✅ PASSED: ${message}`);
}

function logError(message, error = null) {
  console.log(`❌ FAILED: ${message}`);
  if (error) {
    console.log(`   Error: ${error.message}`);
  }
}

function logInfo(message) {
  console.log(`   ${message}`);
}

// === DEBUG INVENTAIRE COMPLET ===
function debugInventory(inventory, title = "INVENTORY DEBUG") {
  logSection(title);
  
  console.log(`📦 Player: ${inventory.playerId}`);
  console.log(`💰 Currencies: ${inventory.gold}g, ${inventory.gems} gems, ${inventory.paidGems} paid gems`);
  console.log(`📊 Max Capacity: ${inventory.maxCapacity}`);
  
  // Debug de chaque catégorie de stockage
  const categories = [
    'weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories',
    'potions', 'scrolls', 'enhancementItems', 
    'enhancementMaterials', 'evolutionMaterials', 'craftingMaterials', 'awakeningMaterials',
    'artifacts'
  ];
  
  console.log(`\n📋 STORAGE BREAKDOWN:`);
  let totalItems = 0;
  
  categories.forEach(category => {
    const items = inventory.storage[category] || [];
    if (Array.isArray(items) && items.length > 0) {
      console.log(`\n  📁 ${category.toUpperCase()} (${items.length} items):`);
      items.forEach((item, index) => {
        console.log(`     [${index}] ${item.itemId} (qty: ${item.quantity || 1}, lvl: ${item.level || 1}, +${item.enhancement || 0}) ${item.isEquipped ? '⚔️' : '📦'}`);
      });
      totalItems += items.length;
    } else {
      console.log(`  📁 ${category.toUpperCase()}: EMPTY`);
    }
  });
  
  // Debug des Maps (fragments et monnaies spéciales)
  if (inventory.storage.heroFragments && inventory.storage.heroFragments.size > 0) {
    console.log(`\n  🧩 HERO FRAGMENTS (${inventory.storage.heroFragments.size} types):`);
    for (const [heroId, quantity] of inventory.storage.heroFragments.entries()) {
      console.log(`     ${heroId}: ${quantity}`);
    }
  }
  
  if (inventory.storage.specialCurrencies && inventory.storage.specialCurrencies.size > 0) {
    console.log(`\n  💎 SPECIAL CURRENCIES (${inventory.storage.specialCurrencies.size} types):`);
    for (const [currencyId, quantity] of inventory.storage.specialCurrencies.entries()) {
      console.log(`     ${currencyId}: ${quantity}`);
    }
  }
  
  console.log(`\n📊 TOTAL ITEMS: ${totalItems}`);
  console.log(`${'='.repeat(80)}`);
}

// === SETUP AVANCÉ ===
async function createAdvancedTestData() {
  logSection("CREATING ADVANCED TEST DATA");
  
  // 1. Créer un joueur riche
  const playerId = generateTestId();
  const player = new Player({
    _id: playerId,
    username: `test_forge_${Date.now()}`,
    level: 50,
    gold: 1000000,
    gems: 100000,
    paidGems: 50000,
    tickets: 1000
  });
  await player.save();
  logInfo(`✅ Player created: ${playerId}`);

  // 2. Créer des items de test complets
  const testItems = [
    // Équipement de test
    {
      itemId: 'debug_sword_common',
      name: 'Debug Common Sword',
      category: 'Equipment',
      subCategory: 'Weapon',
      rarity: 'Common',
      equipmentSlot: 'Weapon',
      baseStats: { atk: 100, hp: 50 },
      statsPerLevel: { atk: 10, hp: 5 },
      sellPrice: 100,
      levelRequirement: 1
    },
    {
      itemId: 'debug_sword_rare',
      name: 'Debug Rare Sword', 
      category: 'Equipment',
      subCategory: 'Weapon',
      rarity: 'Rare',
      equipmentSlot: 'Weapon',
      baseStats: { atk: 200, hp: 100 },
      statsPerLevel: { atk: 20, hp: 10 },
      sellPrice: 500,
      levelRequirement: 10
    },
    {
      itemId: 'debug_helmet_epic',
      name: 'Debug Epic Helmet',
      category: 'Equipment', 
      subCategory: 'Helmet',
      rarity: 'Epic',
      equipmentSlot: 'Helmet',
      baseStats: { hp: 300, def: 150 },
      statsPerLevel: { hp: 30, def: 15 },
      sellPrice: 2000,
      levelRequirement: 20
    },
    
    // Matériaux COMPLETS pour forge
    {
      itemId: 'enhancement_stone_basic',
      name: 'Basic Enhancement Stone',
      category: 'Material',
      subCategory: 'Enhancement',
      materialType: 'Enhancement',
      materialGrade: 'Basic',
      rarity: 'Common',
      sellPrice: 10
    },
    {
      itemId: 'enhancement_dust_basic',
      name: 'Basic Enhancement Dust',
      category: 'Material',
      subCategory: 'Enhancement', 
      materialType: 'Enhancement',
      materialGrade: 'Basic',
      rarity: 'Common',
      sellPrice: 5
    },
    {
      itemId: 'enhancement_dust_advanced',
      name: 'Advanced Enhancement Dust',
      category: 'Material',
      subCategory: 'Enhancement',
      materialType: 'Enhancement', 
      materialGrade: 'Advanced',
      rarity: 'Rare',
      sellPrice: 25
    },
    {
      itemId: 'enhancement_dust_master',
      name: 'Master Enhancement Dust',
      category: 'Material',
      subCategory: 'Enhancement',
      materialType: 'Enhancement',
      materialGrade: 'Master', 
      rarity: 'Epic',
      sellPrice: 100
    },
    
    // Matériaux pour Fusion
    {
      itemId: 'fusion_catalyst_basic',
      name: 'Basic Fusion Catalyst',
      category: 'Material',
      subCategory: 'Fusion',
      materialType: 'Crafting',
      materialGrade: 'Basic',
      rarity: 'Common', 
      sellPrice: 20
    },
    {
      itemId: 'silver_dust',
      name: 'Silver Dust',
      category: 'Material',
      subCategory: 'Fusion',
      materialType: 'Crafting',
      materialGrade: 'Basic',
      rarity: 'Common',
      sellPrice: 15
    },
    {
      itemId: 'gold_dust',
      name: 'Gold Dust',
      category: 'Material',
      subCategory: 'Fusion',
      materialType: 'Crafting',
      materialGrade: 'Advanced',
      rarity: 'Rare',
      sellPrice: 75
    },
    
    // Matériaux pour Tier Upgrade
    {
      itemId: 'tier_essence_basic',
      name: 'Basic Tier Essence',
      category: 'Material',
      subCategory: 'TierUpgrade',
      materialType: 'Evolution',
      materialGrade: 'Basic',
      rarity: 'Common',
      sellPrice: 30
    },
    {
      itemId: 'tier_essence_advanced', 
      name: 'Advanced Tier Essence',
      category: 'Material',
      subCategory: 'TierUpgrade',
      materialType: 'Evolution',
      materialGrade: 'Advanced',
      rarity: 'Rare',
      sellPrice: 150
    },
    {
      itemId: 'thread_silver',
      name: 'Silver Thread',
      category: 'Material',
      subCategory: 'TierUpgrade',
      materialType: 'Evolution',
      materialGrade: 'Basic',
      rarity: 'Rare',
      sellPrice: 50
    },
    
    // Matériaux pour Reforge
    {
      itemId: 'reforge_stone',
      name: 'Reforge Stone',
      category: 'Material',
      subCategory: 'Reforge',
      materialType: 'Crafting',
      materialGrade: 'Basic',
      rarity: 'Common',
      sellPrice: 25
    },
    {
      itemId: 'magic_dust',
      name: 'Magic Dust',
      category: 'Material',
      subCategory: 'Reforge',
      materialType: 'Crafting',
      materialGrade: 'Advanced',
      rarity: 'Rare',
      sellPrice: 100
    }
  ];

  // Créer tous les items
  for (const itemData of testItems) {
    await Item.findOneAndUpdate(
      { itemId: itemData.itemId },
      itemData,
      { upsert: true, new: true }
    );
  }
  logInfo(`✅ Created ${testItems.length} test items`);

  // 3. Créer l'inventaire et le remplir généreusement
  let inventory = await Inventory.findOne({ playerId });
  if (!inventory) {
    inventory = await Inventory.createForPlayer(playerId);
  }

  // Ajouter équipement
  const commonSword1 = await inventory.addItem('debug_sword_common', 1, 5);
  const commonSword2 = await inventory.addItem('debug_sword_common', 1, 3); 
  const commonSword3 = await inventory.addItem('debug_sword_common', 1, 1);
  const rareSword = await inventory.addItem('debug_sword_rare', 1, 10);
  const epicHelmet = await inventory.addItem('debug_helmet_epic', 1, 15);

  // REMPLIR GÉNÉREUSEMENT LES MATÉRIAUX
  const materialQuantities = [
    ['enhancement_stone_basic', 100],
    ['enhancement_dust_basic', 200],
    ['enhancement_dust_advanced', 50],
    ['enhancement_dust_master', 20],
    ['fusion_catalyst_basic', 50],
    ['silver_dust', 100],
    ['gold_dust', 30],
    ['tier_essence_basic', 80],
    ['tier_essence_advanced', 25],
    ['thread_silver', 15],
    ['reforge_stone', 60],
    ['magic_dust', 30]
  ];

  for (const [materialId, quantity] of materialQuantities) {
    await inventory.addItem(materialId, quantity, 1);
  }

  logInfo(`✅ Inventory loaded with equipment and ${materialQuantities.length} material types`);
  
  // DEBUG initial de l'inventaire
  debugInventory(inventory, "INITIAL TEST INVENTORY");
  
  return { player, inventory, testItems };
}

// === TESTS DÉTAILLÉS AVEC DEBUG ===
async function testForgeWithDebug() {
  logSection("FORGE SYSTEM TEST SUITE - WITH FULL DEBUG");
  
  const { player, inventory } = await createAdvancedTestData();
  const forgeService = new ForgeService(player._id);

  let results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  // Test 1: Status Global
  try {
    results.total++;
    logTest("Forge Status");
    
    const status = await forgeService.getForgeStatus();
    logInfo(`📊 Status OK - ${status.playerId}`);
    logInfo(`💰 Resources: ${status.playerResources.gold}g, ${status.playerResources.gems} gems`);
    logInfo(`📦 Inventory: ${status.inventory.reforgeableItems} reforge, ${status.inventory.enhanceableItems} enhance`);
    
    logSuccess("Forge Status");
    results.passed++;
  } catch (error) {
    logError("Forge Status", error);
    results.failed++;
    results.errors.push({ test: "Forge Status", error: error.message });
  }

  // Test 2: Reforge avec debug matériaux
  try {
    results.total++;
    logTest("Reforge with Material Debug");
    
    // Trouver un équipement à reforge
    const weapon = inventory.storage.weapons.find(w => !w.isEquipped);
    if (!weapon) throw new Error("No weapon found for reforge");
    
    logInfo(`🗡️ Using weapon: ${weapon.itemId} (${weapon.instanceId})`);
    
    // Debug matériaux AVANT reforge
    console.log("\n🔍 MATERIALS BEFORE REFORGE:");
    const materialsBefore = inventory.storage.enhancementMaterials || [];
    const craftingBefore = inventory.storage.craftingMaterials || [];
    console.log("Enhancement Materials:", materialsBefore.map(m => `${m.itemId}(${m.quantity})`).join(", "));
    console.log("Crafting Materials:", craftingBefore.map(m => `${m.itemId}(${m.quantity})`).join(", "));
    
    const preview = await forgeService.getReforgePreview(weapon.instanceId, ['atk']);
    logInfo(`🔮 Preview: cost ${preview.cost.gold}g, ${preview.cost.gems} gems`);
    if (preview.cost.materials) {
      console.log("Required materials:", preview.cost.materials);
    }
    
    const result = await forgeService.executeReforge(weapon.instanceId, ['atk']);
    if (result.success) {
      logInfo(`⚡ Reforge success: ${result.cost.gold}g spent`);
      logSuccess("Reforge with Material Debug");
      results.passed++;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    logError("Reforge with Material Debug", error);
    results.failed++;
    results.errors.push({ test: "Reforge", error: error.message });
  }

  // Test 3: Enhancement avec debug complet
  try {
    results.total++;
    logTest("Enhancement with Full Debug");
    
    const weapon = inventory.storage.weapons.find(w => !w.isEquipped && (w.enhancement || 0) < 5);
    if (!weapon) throw new Error("No enhanceable weapon found");
    
    logInfo(`⚔️ Using weapon: ${weapon.itemId} (${weapon.instanceId}), current +${weapon.enhancement || 0}`);
    
    // Debug matériaux AVANT enhancement
    console.log("\n🔍 ENHANCEMENT MATERIALS DEBUG:");
    debugInventory(await Inventory.findOne({ playerId: player._id }), "BEFORE ENHANCEMENT");
    
    const cost = await forgeService.getEnhancementCost(weapon.instanceId);
    logInfo(`💰 Enhancement cost: ${cost.gold}g, ${cost.gems} gems`);
    if (cost.materials) {
      console.log("Required materials:", cost.materials);
    }
    
    const result = await forgeService.executeEnhancement(weapon.instanceId);
    if (result.success) {
      const data = result.data;
      logInfo(`⚡ Enhancement success: +${data.previousLevel} → +${data.newLevel}`);
      logSuccess("Enhancement with Full Debug");
      results.passed++;
    } else {
      throw new Error(result.message);
    }
    
    // Debug APRÈS enhancement
    console.log("\n🔍 AFTER ENHANCEMENT:");
    debugInventory(await Inventory.findOne({ playerId: player._id }), "AFTER ENHANCEMENT");
    
  } catch (error) {
    logError("Enhancement with Full Debug", error);
    results.failed++;
    results.errors.push({ test: "Enhancement", error: error.message });
  }

  // Test 4: Fusion avec debug matériaux détaillé
  try {
    results.total++;
    logTest("Fusion with Detailed Material Debug");
    
    // S'assurer qu'on a 3 armes communes
    const commonWeapons = inventory.storage.weapons.filter(w => 
      !w.isEquipped && w.itemId === 'debug_sword_common'
    ).slice(0, 3);
    
    if (commonWeapons.length < 3) {
      throw new Error(`Need 3 common weapons, found ${commonWeapons.length}`);
    }
    
    const instanceIds = commonWeapons.map(w => w.instanceId);
    logInfo(`🔥 Fusion items: ${instanceIds.join(', ')}`);
    
    // DEBUG SUPER DÉTAILLÉ des matériaux
    console.log("\n🔍 SUPER DETAILED MATERIAL DEBUG BEFORE FUSION:");
    const currentInventory = await Inventory.findOne({ playerId: player._id });
    
    // Afficher TOUTES les catégories qui pourraient contenir des matériaux
    const allCategories = [
      'enhancementMaterials', 'evolutionMaterials', 'craftingMaterials', 
      'awakeningMaterials', 'enhancementItems', 'artifacts', 'scrolls', 'potions'
    ];
    
    allCategories.forEach(cat => {
      const items = currentInventory.storage[cat] || [];
      console.log(`\n  📁 ${cat}:`);
      if (items.length > 0) {
        items.forEach(item => {
          console.log(`    - ${item.itemId}: qty=${item.quantity || 1}`);
        });
      } else {
        console.log(`    (empty)`);
      }
    });
    
    // Tester le coût d'abord
    const cost = await forgeService.getFusionCost(instanceIds[0]);
    console.log("\n💰 FUSION COST BREAKDOWN:");
    console.log(`  Gold: ${cost.gold}`);
    console.log(`  Gems: ${cost.gems}`);
    if (cost.materials) {
      console.log(`  Materials required:`);
      for (const [matId, qty] of Object.entries(cost.materials)) {
        console.log(`    - ${matId}: ${qty}`);
      }
    }
    
    // Tentative de fusion
    const result = await forgeService.executeFusion(instanceIds);
    if (result.success) {
      logInfo(`🔥 Fusion success: created ${result.data.newRarity} item`);
      logSuccess("Fusion with Detailed Material Debug");
      results.passed++;
    } else {
      throw new Error(result.message);
    }
    
  } catch (error) {
    logError("Fusion with Detailed Material Debug", error);
    results.failed++;
    results.errors.push({ test: "Fusion", error: error.message });
  }

  // Test 5: Tier Upgrade avec debug ultra-détaillé
  try {
    results.total++;
    logTest("Tier Upgrade with Ultra Debug");
    
    const rareSword = inventory.storage.weapons.find(w => 
      w.itemId === 'debug_sword_rare' && !w.isEquipped
    );
    
    if (!rareSword) throw new Error("No rare sword found for tier upgrade");
    
    logInfo(`🏆 Using: ${rareSword.itemId} (T${rareSword.tier || 1})`);
    
    // DEBUG ULTRA-DÉTAILLÉ
    console.log("\n🔍 ULTRA DEBUG BEFORE TIER UPGRADE:");
    const preInventory = await Inventory.findOne({ playerId: player._id });
    
    // Analyser chaque matériau individuellement
    console.log("\n📊 MATERIAL ANALYSIS:");
    const materialAnalysis = {
      'tier_essence_basic': 0,
      'tier_essence_advanced': 0, 
      'enhancement_dust_basic': 0,
      'enhancement_dust_advanced': 0,
      'thread_silver': 0,
      'reforge_stone': 0,
      'magic_dust': 0
    };
    
    allCategories.forEach(cat => {
      const items = preInventory.storage[cat] || [];
      items.forEach(item => {
        if (materialAnalysis.hasOwnProperty(item.itemId)) {
          materialAnalysis[item.itemId] += (item.quantity || 1);
        }
      });
    });
    
    console.log("Material inventory:");
    for (const [matId, qty] of Object.entries(materialAnalysis)) {
      console.log(`  ${matId}: ${qty}`);
    }
    
    // Calculer coût tier upgrade
    const cost = await forgeService.getTierUpgradeCost(rareSword.instanceId);
    console.log("\n💰 TIER UPGRADE COST BREAKDOWN:");
    console.log(`  Gold: ${cost.gold}`);
    console.log(`  Gems: ${cost.gems}`);
    if (cost.materials) {
      console.log(`  Materials required:`);
      for (const [matId, qty] of Object.entries(cost.materials)) {
        console.log(`    - ${matId}: ${qty} (have: ${materialAnalysis[matId] || 0})`);
      }
    }
    
    const result = await forgeService.executeTierUpgrade(rareSword.instanceId);
    if (result.success) {
      logInfo(`🏆 Tier upgrade success: T${result.data.previousTier} → T${result.data.newTier}`);
      logSuccess("Tier Upgrade with Ultra Debug");
      results.passed++;
    } else {
      throw new Error(result.message);
    }
    
  } catch (error) {
    logError("Tier Upgrade with Ultra Debug", error);
    results.failed++;
    results.errors.push({ test: "Tier Upgrade", error: error.message });
  }

  // Résumé final avec debug final
  logSection("FINAL DEBUG & RESULTS");
  
  // Debug inventaire final
  const finalInventory = await Inventory.findOne({ playerId: player._id });
  debugInventory(finalInventory, "FINAL INVENTORY STATE");

  // Résultats
  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  
  console.log(`\n📊 RESULTS: ${results.passed}/${results.total} tests passed (${successRate}%)`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.failed > 0) {
    console.log(`\n🔍 ERROR DETAILS:`);
    results.errors.forEach((err, index) => {
      console.log(`  [${index + 1}] ${err.test}: ${err.error}`);
    });
  }
  
  const status = results.failed === 0 ? 
    "🎉 ALL TESTS PASSED!" : 
    results.passed > results.failed ? 
      "👍 MOSTLY GOOD - Some issues to address" :
      "⚠️ SIGNIFICANT ISSUES FOUND";
      
  console.log(`\n${status}`);
  
  return results;
}

// === NETTOYAGE ===
async function cleanup() {
  console.log('\n🧹 Cleaning up...');
  
  // Supprimer données de test
  await Player.deleteMany({ username: { $regex: /^test_forge_/ } });
  await Player.deleteMany({ _id: { $regex: new RegExp('^' + TEST_PREFIX) } });
  await Inventory.deleteMany({ playerId: { $regex: new RegExp('^' + TEST_PREFIX) } });
  await Item.deleteMany({ itemId: { $regex: /^debug_/ } });
  
  console.log('✅ Test data cleaned');
}

// === EXÉCUTION PRINCIPALE ===
async function main() {
  try {
    // Connexion à la base
    await mongoose.connect(MONGODB_URI);
    console.log('🔌 Connected to MongoDB');
    
    // Exécuter les tests avec debug
    const results = await testForgeWithDebug();
    
    return results;
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    throw error;
  } finally {
    // Nettoyage et déconnexion
    await cleanup();
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
    console.log('🎯 Test suite completed!');
  }
}

// Lancer si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default main;

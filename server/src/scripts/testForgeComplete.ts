import mongoose from 'mongoose';
import Player from '../models/Player';
import Item from '../models/Item';
import Inventory from '../models/Inventory';
import { ForgeService } from '../models/Forge/index';

// Version ultra-simplifiée sans tous les types stricts
async function quickForgeTest() {
  console.log('🔧 Quick Forge Test - Starting...');
  
  try {
    await mongoose.connect('mongodb://localhost:27017/idle_gacha_test');
    console.log('✅ Connected to MongoDB');

    // Créer un joueur de test simple
    const player = new Player({
      username: `test_${Date.now()}`,
      serverId: 'S1', 
      password: 'test123',
      level: 50,
      gold: 1000000,
      gems: 100000,
      paidGems: 50000
    });
    await player.save();
    console.log('✅ Test player created');

    // Créer quelques items de test
    const testSword = new Item({
      itemId: 'test_sword',
      name: 'Test Sword',
      category: 'Equipment',
      subCategory: 'Weapon', 
      rarity: 'Common',
      equipmentSlot: 'Weapon',
      baseStats: { atk: 100, hp: 50 },
      sellPrice: 100
    });
    await testSword.save();

    const testStone = new Item({
      itemId: 'enhancement_stone',
      name: 'Enhancement Stone',
      category: 'Material',
      subCategory: 'Enhancement',
      materialType: 'Enhancement',
      rarity: 'Common',
      sellPrice: 10
    });
    await testStone.save();
    console.log('✅ Test items created');

    // Créer inventaire
    const inventory = new Inventory({
      playerId: player._id,
      gold: 1000000,
      gems: 100000
    });
    await inventory.save();
    
    // Ajouter items manuellement
    const swordInstance = {
      itemId: 'test_sword',
      instanceId: new mongoose.Types.ObjectId().toString(),
      quantity: 1,
      level: 1,
      enhancement: 0,
      isEquipped: false,
      acquiredDate: new Date()
    };
    inventory.storage.weapons.push(swordInstance as any);
    
    const stoneInstance = {
      itemId: 'enhancement_stone', 
      instanceId: new mongoose.Types.ObjectId().toString(),
      quantity: 100,
      level: 1,
      enhancement: 0,
      isEquipped: false,
      acquiredDate: new Date()
    };
    inventory.storage.enhancementMaterials.push(stoneInstance as any);
    
    await inventory.save();
    console.log('✅ Inventory created with test items');

    // Test du service forge
    const forgeService = new ForgeService((player as any)._id.toString());
    
    // Test 1: Status
    const status = await forgeService.getForgeStatus();
    console.log(`✅ Forge Status: ${status.playerResources.gold}g available`);
    
    let testsPassed = 0;
    let testsFailed = 0;

    // Test 2: Enhancement
    try {
      const weapon = inventory.storage.weapons[0];
      const result = await forgeService.executeEnhancement(weapon.instanceId);
      if (result.success) {
        console.log('✅ Enhancement test PASSED');
        testsPassed++;
      } else {
        console.log(`❌ Enhancement test FAILED: ${result.message}`);
        testsFailed++;
      }
    } catch (error: any) {
      console.log(`❌ Enhancement test ERROR: ${error.message}`);
      testsFailed++;
    }

    // Test 3: Reforge
    try {
      const weapon = inventory.storage.weapons[1];
      const result = await forgeService.executeReforge(weapon.instanceId, ['atk']);
      if (result.success) {
        console.log('✅ Reforge test PASSED');
        testsPassed++;
      } else {
        console.log(`❌ Reforge test FAILED: ${result.message}`);
        testsFailed++;
      }
    } catch (error: any) {
      console.log(`❌ Reforge test ERROR: ${error.message}`);
      testsFailed++;
    }

    // Test 4: Tier Upgrade
    try {
      const weapon = inventory.storage.weapons[2];
      const result = await forgeService.executeTierUpgrade(weapon.instanceId);
      if (result.success) {
        console.log('✅ Tier Upgrade test PASSED');
        testsPassed++;
      } else {
        console.log(`❌ Tier Upgrade test FAILED: ${result.message}`);
        testsFailed++;
      }
    } catch (error: any) {
      console.log(`❌ Tier Upgrade test ERROR: ${error.message}`);
      testsFailed++;
    }

    // Test 5: Fusion (avec 3 épées identiques si possible)
    try {
      const allSwords = inventory.storage.weapons.filter((w: any) => w.itemId === 'test_sword');
      if (allSwords.length >= 3) {
        const swordIds = allSwords.slice(0, 3).map((w: any) => w.instanceId);
        const result = await forgeService.executeFusion(swordIds);
        if (result.success) {
          console.log('✅ Fusion test PASSED');
          testsPassed++;
        } else {
          console.log(`❌ Fusion test FAILED: ${result.message}`);
          testsFailed++;
        }
      } else {
        console.log('⚠️ Fusion test SKIPPED: Not enough identical items');
      }
    } catch (error: any) {
      console.log(`❌ Fusion test ERROR: ${error.message}`);
      testsFailed++;
    }

    // Résumé
    const total = testsPassed + testsFailed;
    const successRate = total > 0 ? ((testsPassed / total) * 100).toFixed(1) : '0';
    console.log(`\n🎯 RESULTS: ${testsPassed}/${total} tests passed (${successRate}%)`);
    
    if (testsFailed === 0) {
      console.log('🎉 ALL FORGE MODULES WORKING PERFECTLY!');
    } else {
      console.log('⚠️ Some modules need attention');
    }

    return testsFailed === 0;

  } catch (error: any) {
    console.error('💥 Test failed:', error.message);
    return false;
  } finally {
    // Nettoyage rapide
    await Player.deleteMany({ username: /^test_/ });
    await Item.deleteMany({ itemId: /^test_/ });
    await Inventory.deleteMany({});
    await mongoose.disconnect();
    console.log('🧹 Cleaned up and disconnected');
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  quickForgeTest();
}

export default quickForgeTest;

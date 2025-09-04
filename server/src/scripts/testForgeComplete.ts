import mongoose from 'mongoose';
import Player from '../models/Player';
import Item from '../models/Item';
import Inventory from '../models/Inventory';
import { ForgeService } from '../models/Forge/index';

async function testForgeComplete() {
  console.log('🔧 Testing Forge System...');
  
  try {
    await mongoose.connect('mongodb://localhost:27017/forge_test_clean');

    // Créer joueur de test
    const player = new Player({
      username: `test_${Date.now()}`,
      serverId: 'S1',
      password: 'test123',
      level: 50,
      gold: 1000000,
      gems: 100000
    });
    await player.save();

    // Créer items de test (upsert)
    const itemsData = [
      { itemId: 'test_sword', name: 'Test Sword', category: 'Equipment', subCategory: 'Weapon', rarity: 'Common', equipmentSlot: 'Weapon', baseStats: { atk: 100 }, sellPrice: 100 },
      { itemId: 'enhancement_stone', name: 'Enhancement Stone', category: 'Material', materialType: 'Enhancement', rarity: 'Common', sellPrice: 10 },
      { itemId: 'reforge_stone', name: 'Reforge Stone', category: 'Material', materialType: 'Crafting', rarity: 'Common', sellPrice: 25 },
      { itemId: 'magic_dust', name: 'Magic Dust', category: 'Material', materialType: 'Crafting', rarity: 'Rare', sellPrice: 100 },
      { itemId: 'fusion_stone', name: 'Fusion Stone', category: 'Material', materialType: 'Crafting', rarity: 'Common', sellPrice: 20 },
      { itemId: 'silver_dust', name: 'Silver Dust', category: 'Material', materialType: 'Crafting', rarity: 'Common', sellPrice: 15 },
      { itemId: 'tier_stone', name: 'Tier Stone', category: 'Material', materialType: 'Evolution', rarity: 'Common', sellPrice: 30 },
      { itemId: 'enhancement_dust', name: 'Enhancement Dust', category: 'Material', materialType: 'Evolution', rarity: 'Common', sellPrice: 10 }
    ];

    for (const item of itemsData) {
      await Item.findOneAndUpdate({ itemId: item.itemId }, item, { upsert: true });
    }

    // Créer inventaire avec équipement et matériaux
    const inventory = new Inventory({ playerId: player._id, gold: 1000000, gems: 100000 });
    
    // 3 épées pour tous les tests
    for (let i = 0; i < 3; i++) {
      inventory.storage.weapons.push({
        itemId: 'test_sword',
        instanceId: new mongoose.Types.ObjectId().toString(),
        quantity: 1,
        level: 5 - i,
        enhancement: 0,
        tier: 1,
        isEquipped: false,
        acquiredDate: new Date()
      } as any);
    }

    // Matériaux pour tous les modules
    const materials = [
      { itemId: 'enhancement_stone', quantity: 50, category: 'enhancementMaterials' },
      { itemId: 'reforge_stone', quantity: 30, category: 'craftingMaterials' },
      { itemId: 'magic_dust', quantity: 20, category: 'craftingMaterials' },
      { itemId: 'fusion_stone', quantity: 25, category: 'craftingMaterials' },
      { itemId: 'silver_dust', quantity: 50, category: 'craftingMaterials' },
      { itemId: 'tier_stone', quantity: 30, category: 'evolutionMaterials' },
      { itemId: 'enhancement_dust', quantity: 50, category: 'evolutionMaterials' }
    ];

    materials.forEach(mat => {
      (inventory.storage as any)[mat.category].push({
        itemId: mat.itemId,
        instanceId: new mongoose.Types.ObjectId().toString(),
        quantity: mat.quantity,
        level: 1,
        enhancement: 0,
        isEquipped: false,
        acquiredDate: new Date()
      });
    });

    await inventory.save();
    console.log('✅ Setup complete');

    // Tests
    const forgeService = new ForgeService((player as any)._id.toString());
    const weapons = inventory.storage.weapons;
    let passed = 0, total = 0;

    // Test Enhancement
    total++;
    try {
      const result = await forgeService.executeEnhancement(weapons[0].instanceId);
      if (result.success) {
        console.log('✅ Enhancement PASSED');
        passed++;
      } else {
        console.log(`❌ Enhancement FAILED: ${result.message}`);
      }
    } catch (e: any) {
      console.log(`❌ Enhancement ERROR: ${e.message}`);
    }

    // Test Reforge
    total++;
    try {
      const result = await forgeService.executeReforge(weapons[1].instanceId, ['atk']);
      if (result.success) {
        console.log('✅ Reforge PASSED');
        passed++;
      } else {
        console.log(`❌ Reforge FAILED: ${result.message}`);
      }
    } catch (e: any) {
      console.log(`❌ Reforge ERROR: ${e.message}`);
    }

    // Test Tier Upgrade
    total++;
    try {
      const result = await forgeService.executeTierUpgrade(weapons[2].instanceId);
      if (result.success) {
        console.log('✅ Tier Upgrade PASSED');
        passed++;
      } else {
        console.log(`❌ Tier Upgrade FAILED: ${result.message}`);
      }
    } catch (e: any) {
      console.log(`❌ Tier Upgrade ERROR: ${e.message}`);
    }

    // Test Fusion
    total++;
    try {
      const swordIds = weapons.map(w => w.instanceId);
      const result = await forgeService.executeFusion(swordIds);
      if (result.success) {
        console.log('✅ Fusion PASSED');
        passed++;
      } else {
        console.log(`❌ Fusion FAILED: ${result.message}`);
      }
    } catch (e: any) {
      console.log(`❌ Fusion ERROR: ${e.message}`);
    }

    // Résultats
    const rate = ((passed / total) * 100).toFixed(1);
    console.log(`\n🎯 RESULTS: ${passed}/${total} tests passed (${rate}%)`);
    
    if (passed === total) {
      console.log('🎉 ALL FORGE MODULES WORKING!');
      return true;
    } else {
      console.log('⚠️ Some modules need attention');
      return false;
    }

  } catch (error: any) {
    console.error('💥 Test failed:', error.message);
    return false;
  } finally {
    // Nettoyage
    await Player.deleteMany({ username: /^test_/ });
    await Item.deleteMany({ itemId: /^(test_|enhancement_|reforge_|magic_|fusion_|silver_|tier_)/ });
    await Inventory.deleteMany({});
    await mongoose.disconnect();
    console.log('🧹 Cleaned up');
  }
}

if (require.main === module) {
  testForgeComplete();
}

export default testForgeComplete;

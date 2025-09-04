import mongoose from 'mongoose';
import Player from '../models/Player';
import Item from '../models/Item';
import Inventory from '../models/Inventory';
import { ForgeService } from '../models/Forge/index';

async function testForgeMinimal() {
  console.log('🔧 Testing Forge - Minimal Version');
  
  try {
    // Connexion
    await mongoose.connect('mongodb://localhost:27017/forge_test_clean', {
      autoIndex: false // Ignore les warnings d'index
    });

    // Nettoyer d'abord
    await Player.deleteMany({});
    await Item.deleteMany({});  
    await Inventory.deleteMany({});

    // Créer joueur
    const player = await Player.create({
      username: `test_${Date.now()}`,
      serverId: 'S1',
      password: 'test123',
      level: 50,
      gold: 1000000,
      gems: 100000
    });

    // Créer épée de test
    const sword = await Item.create({
      itemId: 'test_sword',
      name: 'Test Sword', 
      category: 'Equipment',
      subCategory: 'Weapon',
      rarity: 'Common',
      equipmentSlot: 'Weapon',
      baseStats: { atk: 100, hp: 50 },
      sellPrice: 100
    });

    // Créer matériau
    const stone = await Item.create({
      itemId: 'enhancement_stone',
      name: 'Enhancement Stone',
      category: 'Material',
      subCategory: 'Enhancement', 
      materialType: 'Enhancement',
      rarity: 'Common',
      sellPrice: 10
    });

    // Créer inventaire MANUELLEMENT
    const inventoryData = {
      playerId: player._id,
      gold: 1000000,
      gems: 100000,
      storage: {
        weapons: [{
          itemId: 'test_sword',
          instanceId: new mongoose.Types.ObjectId().toString(),
          quantity: 1,
          level: 1, 
          enhancement: 0,
          isEquipped: false,
          acquiredDate: new Date()
        }],
        enhancementMaterials: [{
          itemId: 'enhancement_stone',
          instanceId: new mongoose.Types.ObjectId().toString(),
          quantity: 100,
          level: 1,
          enhancement: 0,
          isEquipped: false,
          acquiredDate: new Date()
        }],
        helmets: [],
        armors: [],
        boots: [],
        gloves: [],
        accessories: [],
        potions: [],
        scrolls: [],
        enhancementItems: [],
        evolutionMaterials: [],
        craftingMaterials: [],
        awakeningMaterials: [],
        heroFragments: new Map(),
        specialCurrencies: new Map(),
        artifacts: []
      }
    };

    const inventory = await Inventory.create(inventoryData);
    console.log('✅ Setup OK');

    // Test SEUL enhancement
    const forgeService = new ForgeService(player._id.toString());
    const weaponId = inventory.storage.weapons[0].instanceId;
    
    const result = await forgeService.executeEnhancement(weaponId);
    
    if (result.success) {
      console.log('✅ FORGE SYSTEM WORKS!');
      return true;
    } else {
      console.log(`❌ FAILED: ${result.message}`);
      return false;
    }

  } catch (error: any) {
    console.error('💥 ERROR:', error.message);
    return false;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Done');
  }
}

if (require.main === module) {
  testForgeMinimal();
}

export default testForgeMinimal;

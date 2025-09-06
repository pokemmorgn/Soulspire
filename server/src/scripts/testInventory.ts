import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import Inventory from "../models/Inventory";
import Item from "../models/Item";
import Hero from "../models/Hero";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// === COULEURS POUR LA CONSOLE ===
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (message: string, color: string = colors.reset) => {
  console.log(`${color}${message}${colors.reset}`);
};

// === FONCTIONS DE TEST ===
class InventoryTester {
  private testPlayerId: string = "";
  private testHeroId: string = "";
  private inventory: any = null;
  private player: any = null;

  async setup(): Promise<void> {
    log("🔧 Setting up test environment...", colors.cyan);
    
    // Connexion MongoDB
    await mongoose.connect(MONGO_URI);
    log("✅ Connected to MongoDB", colors.green);

    // Créer un joueur de test
    await this.createTestPlayer();
    await this.createTestHero();
    await this.createTestInventory();
  }

  async createTestPlayer(): Promise<void> {
    log("\n👤 Creating test player...", colors.yellow);
    
    // Supprimer le joueur de test s'il existe
    await Player.deleteMany({ username: "test_inventory_user" });
    
    const testPlayer = new Player({
      username: "test_inventory_user",
      email: "test.inventory@example.com",
      password: "hashedpassword123",
      gold: 10000,
      gems: 500,
      paidGems: 100,
      tickets: 10,
      level: 25,
      experience: 1250
    });
    
    await testPlayer.save();
    this.testPlayerId = (testPlayer._id as any).toString();
    this.player = testPlayer;
    
   log(`✅ Test player created: ${testPlayer.displayName} (ID: ${this.testPlayerId})`, colors.green);
  }

  async createTestHero(): Promise<void> {
    log("\n🦸 Creating test hero...", colors.yellow);
    
    // Vérifier qu'il y a des héros dans la base
    const heroCount = await Hero.countDocuments();
    if (heroCount === 0) {
      log("⚠️ No heroes found in database. Creating a test hero...", colors.yellow);
      
      const testHero = new Hero({
        name: "Test Warrior",
        role: "Tank",
        element: "Fire",
        rarity: "Common",
        baseStats: {
          hp: 500,
          atk: 100,
          def: 80,
          defMagique: 60,
          vitesse: 70,
          intelligence: 50,
          force: 120,
          moral: 60,
          reductionCooldown: 0
        },
        spells: {
          ultimate: {
            id: "fire_storm",
            level: 1
          }
        }
      });
      
      await testHero.save();
      this.testHeroId = (testHero._id as any).toString();
      
      // Ajouter le héros au joueur
      this.player.heroes.push({
        heroId: testHero._id,
        level: 1,
        stars: 1,
        equipped: false
      });
      await this.player.save();
      
      log(`✅ Test hero created: ${testHero.name}`, colors.green);
    } else {
      // Utiliser le premier héros existant
      const existingHero = await Hero.findOne();
      if (existingHero) {
        this.testHeroId = (existingHero._id as any).toString();
        
        // Ajouter le héros au joueur s'il ne l'a pas
        const hasHero = this.player.heroes.some((h: any) => h.heroId.toString() === this.testHeroId);
        if (!hasHero) {
          this.player.heroes.push({
            heroId: existingHero._id,
            level: 1,
            stars: 1,
            equipped: false
          });
          await this.player.save();
        }
        
        log(`✅ Using existing hero: ${existingHero.name}`, colors.green);
      }
    }
  }

  async createTestInventory(): Promise<void> {
    log("\n📦 Creating test inventory...", colors.yellow);
    
    // Supprimer l'inventaire de test s'il existe
    await Inventory.deleteMany({ playerId: this.testPlayerId });
    
    const testInventory = new Inventory({
      playerId: this.testPlayerId,
      gold: this.player.gold,
      gems: this.player.gems,
      paidGems: this.player.paidGems,
      tickets: this.player.tickets,
      maxCapacity: 100
    });
    
    await testInventory.save();
    this.inventory = testInventory;
    
    log(`✅ Test inventory created for player ${this.testPlayerId}`, colors.green);
  }

  async testAddItems(): Promise<void> {
    log("\n➕ Testing item addition...", colors.cyan);
    
    try {
      // Récupérer quelques objets de la base
      const items = await Item.find().limit(5);
      
      if (items.length === 0) {
        log("⚠️ No items found in database. Please run the seed script first.", colors.yellow);
        return;
      }
      
      for (const item of items) {
        const ownedItem = await this.inventory.addItem(item.itemId, 1, 1);
        log(`  ✅ Added: ${item.name} (${item.itemId}) - Instance: ${ownedItem.instanceId}`, colors.green);
      }
      
      // Ajouter plusieurs quantités d'un consommable
      const consumable = await Item.findOne({ category: "Consumable" });
      if (consumable) {
        const ownedItem = await this.inventory.addItem(consumable.itemId, 5, 1);
        log(`  ✅ Added 5x: ${consumable.name} - Instance: ${ownedItem.instanceId}`, colors.green);
      }
      
    } catch (error: any) {
      log(`  ❌ Error adding items: ${error.message}`, colors.red);
    }
  }

  async testEquipment(): Promise<void> {
    log("\n⚔️ Testing equipment system...", colors.cyan);
    
    try {
      // Trouver une arme dans l'inventaire
      const weapons = this.inventory.storage.weapons || [];
      
      if (weapons.length > 0) {
        const weapon = weapons[0];
        log(`  🗡️ Trying to equip: ${weapon.itemId} to hero ${this.testHeroId}`, colors.blue);
        
        const success = await this.inventory.equipItem(weapon.instanceId, this.testHeroId);
        
        if (success) {
          log(`  ✅ Equipment successful!`, colors.green);
          
          // Vérifier que l'objet est équipé
          const equippedItems = this.inventory.getEquippedItems(this.testHeroId);
          log(`  📊 Equipped items for hero: ${equippedItems.length}`, colors.blue);
          
          // Test de déséquipement
          const unequipSuccess = await this.inventory.unequipItem(weapon.instanceId);
          if (unequipSuccess) {
            log(`  ✅ Unequip successful!`, colors.green);
          } else {
            log(`  ❌ Unequip failed`, colors.red);
          }
        } else {
          log(`  ❌ Equipment failed`, colors.red);
        }
      } else {
        log(`  ⚠️ No weapons in inventory to test`, colors.yellow);
      }
      
    } catch (error: any) {
      log(`  ❌ Error testing equipment: ${error.message}`, colors.red);
    }
  }

  async testChests(): Promise<void> {
    log("\n🎁 Testing chest system...", colors.cyan);
    
    try {
      // Ajouter un coffre à l'inventaire
      const chest = await Item.findOne({ category: "Chest" });
      
      if (chest) {
        log(`  📦 Adding chest: ${chest.name}`, colors.blue);
        
        const chestItem = await this.inventory.addItem(chest.itemId, 1, 1);
        log(`  ✅ Chest added to inventory`, colors.green);
        
        // Aperçu du coffre
        const preview = chest.getChestPreview();
        log(`  👁️ Chest preview: ${preview.length} possible rewards`, colors.blue);
        
        // Ouvrir le coffre
        log(`  🔓 Opening chest...`, colors.yellow);
        const rewards = await chest.openChest(this.testPlayerId);
        
        log(`  🎉 Chest opened! Rewards received:`, colors.green);
        rewards.forEach((reward, index) => {
          log(`    ${index + 1}. ${reward.type}: ${reward.quantity} x ${reward.itemId || reward.currencyType || 'unknown'}`, colors.green);
        });
        
        // Supprimer le coffre de l'inventaire (simuler l'ouverture)
        await this.inventory.removeItem(chestItem.instanceId, 1);
        log(`  🗑️ Chest consumed after opening`, colors.blue);
        
      } else {
        log(`  ⚠️ No chests found in database`, colors.yellow);
      }
      
    } catch (error: any) {
      log(`  ❌ Error testing chests: ${error.message}`, colors.red);
    }
  }

  async testInventoryStats(): Promise<void> {
    log("\n📊 Testing inventory statistics...", colors.cyan);
    
    try {
      const stats = this.inventory.getInventoryStats();
      
      log(`  📈 Inventory Statistics:`, colors.blue);
      log(`    - Total Items: ${stats.totalItems}`, colors.reset);
      log(`    - Max Capacity: ${stats.maxCapacity}`, colors.reset);
      log(`    - Equipment Count: ${stats.equipmentCount}`, colors.reset);
      log(`    - Consumable Count: ${stats.consumableCount}`, colors.reset);
      log(`    - Material Count: ${stats.materialCount}`, colors.reset);
      log(`    - Equipped Items: ${stats.equippedItemsCount}`, colors.reset);
      log(`    - Max Level Equipment: ${stats.maxLevelEquipment}`, colors.reset);
      
    } catch (error: any) {
      log(`  ❌ Error getting stats: ${error.message}`, colors.red);
    }
  }

  async testCleanup(): Promise<void> {
    log("\n🧹 Testing cleanup system...", colors.cyan);
    
    try {
      const removedCount = await this.inventory.cleanupExpiredItems();
      log(`  ✅ Cleanup completed. Removed ${removedCount} expired items`, colors.green);
      
      const totalValue = this.inventory.calculateTotalValue();
      log(`  💰 Total inventory value: ${totalValue}`, colors.green);
      
    } catch (error: any) {
      log(`  ❌ Error during cleanup: ${error.message}`, colors.red);
    }
  }

  async testItemCategories(): Promise<void> {
    log("\n📂 Testing item categories...", colors.cyan);
    
    try {
      const categories = ["Equipment", "Consumable", "Material", "Chest"];
      
      for (const category of categories) {
        const items = this.inventory.getItemsByCategory(category);
        log(`  📁 ${category}: ${items.length} items`, colors.blue);
      }
      
    } catch (error: any) {
      log(`  ❌ Error testing categories: ${error.message}`, colors.red);
    }
  }

  async cleanup(): Promise<void> {
    log("\n🧹 Cleaning up test data...", colors.yellow);
    
    try {
      // Supprimer les données de test
      await Player.deleteMany({ username: "test_inventory_user" });
      await Inventory.deleteMany({ playerId: this.testPlayerId });
      await Hero.deleteMany({ name: "Test Warrior" });
      
      log("✅ Test data cleaned up", colors.green);
    } catch (error: any) {
      log(`❌ Error during cleanup: ${error.message}`, colors.red);
    }
  }

  async runAllTests(): Promise<void> {
    try {
      await this.setup();
      
      log("\n" + "=".repeat(50), colors.bright);
      log("🧪 STARTING INVENTORY SYSTEM TESTS", colors.bright);
      log("=".repeat(50), colors.bright);
      
      await this.testAddItems();
      await this.testEquipment();
      await this.testChests();
      await this.testInventoryStats();
      await this.testCleanup();
      await this.testItemCategories();
      
      log("\n" + "=".repeat(50), colors.bright);
      log("✅ ALL TESTS COMPLETED", colors.green);
      log("=".repeat(50), colors.bright);
      
    } catch (error: any) {
      log(`\n❌ TEST SUITE FAILED: ${error.message}`, colors.red);
      console.error(error);
    } finally {
      const shouldCleanup = !process.argv.includes('--keep-data');
      if (shouldCleanup) {
        await this.cleanup();
      } else {
        log("\n📝 Test data kept in database (--keep-data flag used)", colors.yellow);
      }
      
      await mongoose.connection.close();
      log("🔌 Database connection closed", colors.blue);
    }
  }
}

// === EXÉCUTION DES TESTS ===
const runTests = async (): Promise<void> => {
  const tester = new InventoryTester();
  await tester.runAllTests();
};

if (require.main === module) {
  log("🚀 Inventory System Test Suite", colors.bright);
  log("Arguments:", process.argv.slice(2).join(' '));
  log("Use --keep-data to keep test data after tests\n", colors.yellow);
  
  runTests().then(() => {
    process.exit(0);
  }).catch((error) => {
    log(`❌ Fatal error: ${error.message}`, colors.red);
    process.exit(1);
  });
}

export default InventoryTester;

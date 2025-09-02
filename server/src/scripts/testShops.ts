import mongoose from "mongoose";
import dotenv from "dotenv";
import Shop from "../models/Shop";
import Player from "../models/Player";
import Inventory from "../models/Inventory";
import Item from "../models/Item";

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

// === CLASSE DE TEST DES SHOPS ===
class ShopTester {
  private testPlayerId: string = "";
  private testPlayer: any = null;
  private inventory: any = null;

  async setup(): Promise<void> {
    log("🔧 Setting up shop test environment...", colors.cyan);
    
    // Connexion MongoDB
    await mongoose.connect(MONGO_URI);
    log("✅ Connected to MongoDB", colors.green);

    await this.createTestPlayer();
    await this.createTestInventory();
    await this.ensureItemsExist();
    await this.ensureShopsExist();
  }

  async createTestPlayer(): Promise<void> {
    log("\n👤 Creating test player...", colors.yellow);
    
    // Supprimer le joueur de test s'il existe
    await Player.deleteMany({ username: "test_shop_user" });
    
    const testPlayer = new Player({
      username: "test_shop_user",
      email: "test.shop@example.com", 
      password: "hashedpassword123",
      gold: 50000,
      gems: 2000,
      paidGems: 500,
      tickets: 100,
      level: 25,
      vipLevel: 2,
      experience: 2500
    });
    
    await testPlayer.save();
    this.testPlayerId = (testPlayer._id as any).toString();
    this.testPlayer = testPlayer;
    
    log(`✅ Test player created: ${testPlayer.username} (Level: ${testPlayer.level}, VIP: ${testPlayer.vipLevel})`, colors.green);
    log(`   💰 Resources: ${testPlayer.gold} gold, ${testPlayer.gems} gems, ${testPlayer.paidGems} paid gems`, colors.blue);
  }

  async createTestInventory(): Promise<void> {
    log("\n📦 Creating test inventory...", colors.yellow);
    
    await Inventory.deleteMany({ playerId: this.testPlayerId });
    
    const testInventory = new Inventory({
      playerId: this.testPlayerId,
      gold: this.testPlayer.gold,
      gems: this.testPlayer.gems,
      paidGems: this.testPlayer.paidGems,
      tickets: this.testPlayer.tickets,
      maxCapacity: 200
    });
    
    await testInventory.save();
    this.inventory = testInventory;
    
    log(`✅ Test inventory created`, colors.green);
  }

  async ensureItemsExist(): Promise<void> {
    log("\n🏷️ Ensuring items exist for shop tests...", colors.yellow);
    
    const itemCount = await Item.countDocuments();
    if (itemCount === 0) {
      log("⚠️ No items found. Please run the items seed script first.", colors.yellow);
      log("   Run: npx ts-node src/scripts/seedItems.ts", colors.blue);
      return;
    }
    
    log(`✅ Found ${itemCount} items in database`, colors.green);
  }

  async ensureShopsExist(): Promise<void> {
    log("\n🏪 Ensuring shops exist for tests...", colors.yellow);
    
    const shopCount = await Shop.countDocuments();
    if (shopCount === 0) {
      log("⚠️ No shops found. Creating basic shops...", colors.yellow);
      
      const shopTypes = ["General", "Arena", "Daily"];
      for (const shopType of shopTypes) {
        const shop = (Shop as any).createPredefinedShop(shopType);
        await shop.save();
        log(`   ✅ Created ${shopType} shop`, colors.green);
      }
    } else {
      log(`✅ Found ${shopCount} shops in database`, colors.green);
    }
  }

  async testShopAccess(): Promise<void> {
    log("\n🔐 Testing shop access permissions...", colors.cyan);
    
    try {
      const shops = await Shop.find({ isActive: true });
      
      for (const shop of shops) {
        const canAccess = await shop.canPlayerAccess(this.testPlayerId);
        const accessStatus = canAccess ? "✅ ALLOWED" : "❌ DENIED";
        const reason = !canAccess ? 
          `(Level: ${this.testPlayer.level}/${shop.levelRequirement}, VIP: ${this.testPlayer.vipLevel || 0}/${shop.vipLevelRequirement || 0})` : 
          "";
          
        log(`  ${accessStatus} ${shop.shopType} - ${shop.name} ${reason}`, canAccess ? colors.green : colors.red);
      }
    } catch (error: any) {
      log(`❌ Error testing shop access: ${error.message}`, colors.red);
    }
  }

  async testShopGeneration(): Promise<void> {
    log("\n🎲 Testing shop item generation...", colors.cyan);
    
    try {
      const shops = await Shop.find({ isActive: true });
      
      for (const shop of shops) {
        log(`\n  🏪 Testing ${shop.shopType} shop...`, colors.blue);
        
        const oldItemCount = shop.items.length;
        await shop.refreshShop();
        const newItemCount = shop.items.length;
        
        log(`    📊 Items: ${oldItemCount} → ${newItemCount}`, colors.green);
        
        // Analyser les objets générés
        const itemsByRarity: { [key: string]: number } = {};
        const itemsByType: { [key: string]: number } = {};
        
        shop.items.forEach(item => {
          itemsByRarity[item.rarity] = (itemsByRarity[item.rarity] || 0) + 1;
          itemsByType[item.type] = (itemsByType[item.type] || 0) + 1;
        });
        
        log(`    🏷️ By Rarity: ${Object.entries(itemsByRarity).map(([r, c]) => `${r}:${c}`).join(', ')}`, colors.blue);
        log(`    📦 By Type: ${Object.entries(itemsByType).map(([t, c]) => `${t}:${c}`).join(', ')}`, colors.blue);
        
        // Vérifier quelques objets en détail
        if (shop.items.length > 0) {
          const sampleItem = shop.items[0];
          log(`    🔍 Sample item: ${sampleItem.name} (${sampleItem.rarity}) - Cost: ${JSON.stringify(sampleItem.cost)}`, colors.blue);
        }
      }
    } catch (error: any) {
      log(`❌ Error testing shop generation: ${error.message}`, colors.red);
    }
  }

  async testPurchaseFlow(): Promise<void> {
    log("\n💰 Testing purchase flow...", colors.cyan);
    
    try {
      const generalShop = await Shop.findOne({ shopType: "General", isActive: true });
      
      if (!generalShop || generalShop.items.length === 0) {
        log("⚠️ No General shop or items available for purchase test", colors.yellow);
        return;
      }
      
      // Choisir un objet pas trop cher à acheter
      const affordableItem = generalShop.items.find(item => {
        const goldCost = item.cost.gold || 0;
        const gemsCost = item.cost.gems || 0;
        return goldCost <= this.testPlayer.gold && gemsCost <= this.testPlayer.gems;
      });
      
      if (!affordableItem) {
        log("⚠️ No affordable items found for purchase test", colors.yellow);
        return;
      }
      
      log(`\n  🛒 Attempting to purchase: ${affordableItem.name}`, colors.blue);
      log(`    💸 Cost: ${JSON.stringify(affordableItem.cost)}`, colors.blue);
      log(`    📦 Stock: ${affordableItem.currentStock}/${affordableItem.maxStock}`, colors.blue);
      
      // Vérifier si l'achat est possible
      const canPurchase = await generalShop.canPlayerPurchase(affordableItem.instanceId, this.testPlayerId);
      log(`    ✅ Can purchase: ${canPurchase.canPurchase} ${canPurchase.reason || ''}`, canPurchase.canPurchase ? colors.green : colors.red);
      
      if (!canPurchase.canPurchase) return;
      
      // Sauvegarder l'état avant achat
      const goldBefore = this.testPlayer.gold;
      const gemsBefore = this.testPlayer.gems;
      const inventoryBefore = this.inventory.getInventoryStats();
      
      // Simuler l'achat (logique simplifiée)
      const goldCost = affordableItem.cost.gold || 0;
      const gemsCost = affordableItem.cost.gems || 0;
      
      this.testPlayer.gold -= goldCost;
      this.testPlayer.gems -= gemsCost;
      
      if (affordableItem.content.itemId) {
        await this.inventory.addItem(affordableItem.content.itemId, affordableItem.content.quantity);
      }
      
      // Mettre à jour le stock
      if (affordableItem.maxStock !== -1) {
        affordableItem.currentStock -= 1;
      }
      
      // Ajouter à l'historique
      affordableItem.purchaseHistory.push({
        playerId: this.testPlayerId,
        quantity: 1,
        purchaseDate: new Date()
      });
      
      await Promise.all([
        this.testPlayer.save(),
        this.inventory.save(),
        generalShop.save()
      ]);
      
      const inventoryAfter = this.inventory.getInventoryStats();
      
      log(`\n  ✅ Purchase completed!`, colors.green);
      log(`    💰 Gold: ${goldBefore} → ${this.testPlayer.gold} (${goldBefore - this.testPlayer.gold} spent)`, colors.blue);
      log(`    💎 Gems: ${gemsBefore} → ${this.testPlayer.gems} (${gemsBefore - this.testPlayer.gems} spent)`, colors.blue);
      log(`    📦 Inventory: ${inventoryBefore.totalItems} → ${inventoryAfter.totalItems} items`, colors.blue);
      log(`    🏪 Item stock: ${affordableItem.currentStock + 1} → ${affordableItem.currentStock}`, colors.blue);
      
    } catch (error: any) {
      log(`❌ Error testing purchase flow: ${error.message}`, colors.red);
    }
  }

  async testShopRefresh(): Promise<void> {
    log("\n🔄 Testing shop manual refresh...", colors.cyan);
    
    try {
      const generalShop = await Shop.findOne({ shopType: "General", isActive: true });
      
      if (!generalShop) {
        log("⚠️ No General shop found for refresh test", colors.yellow);
        return;
      }
      
      const hasRefreshCost = generalShop.refreshCost && (generalShop.refreshCost.gold || generalShop.refreshCost.gems);
      
      if (!hasRefreshCost) {
        log("⚠️ General shop has no refresh cost configured", colors.yellow);
        return;
      }
      
      log(`  🔄 Refresh cost: ${JSON.stringify(generalShop.refreshCost)}`, colors.blue);
      
      const refreshCostGold = generalShop.refreshCost!.gold || 0;
      const refreshCostGems = generalShop.refreshCost!.gems || 0;
      
      if (this.testPlayer.gold < refreshCostGold || this.testPlayer.gems < refreshCostGems) {
        log("⚠️ Player doesn't have enough resources for refresh", colors.yellow);
        return;
      }
      
      const itemsBefore = [...generalShop.items];
      const goldBefore = this.testPlayer.gold;
      const gemsBefore = this.testPlayer.gems;
      
      // Effectuer le refresh
      this.testPlayer.gold -= refreshCostGold;
      this.testPlayer.gems -= refreshCostGems;
      await generalShop.refreshShop();
      await this.testPlayer.save();
      
      log(`  ✅ Shop refreshed successfully!`, colors.green);
      log(`    💰 Cost paid - Gold: ${goldBefore} → ${this.testPlayer.gold}, Gems: ${gemsBefore} → ${this.testPlayer.gems}`, colors.blue);
      log(`    📦 Items: ${itemsBefore.length} → ${generalShop.items.length}`, colors.blue);
      log(`    🔄 Items changed: ${itemsBefore.length !== generalShop.items.length || itemsBefore[0]?.instanceId !== generalShop.items[0]?.instanceId}`, colors.green);
      
    } catch (error: any) {
      log(`❌ Error testing shop refresh: ${error.message}`, colors.red);
    }
  }

  async testShopStats(): Promise<void> {
    log("\n📊 Testing shop statistics...", colors.cyan);
    
    try {
      const shops = await Shop.find({ isActive: true });
      
      log(`  📈 Shop Statistics Summary:`, colors.blue);
      
      for (const shop of shops) {
        const totalItems = shop.items.length;
        const featuredItems = shop.items.filter(item => item.isFeatured).length;
        const promotionalItems = shop.items.filter(item => item.isPromotional).length;
        const totalPurchases = shop.items.reduce((sum, item) => sum + item.purchaseHistory.length, 0);
        const totalRevenue = shop.items.reduce((sum, item) => {
          return sum + item.purchaseHistory.reduce((itemSum, purchase) => {
            return itemSum + (item.cost.gold || 0) * purchase.quantity;
          }, 0);
        }, 0);
        
        const nextReset = shop.nextResetTime ? Math.max(0, shop.nextResetTime.getTime() - Date.now()) : 0;
        const hoursUntilReset = Math.floor(nextReset / (1000 * 60 * 60));
        
        log(`\n    🏪 ${shop.shopType} (${shop.name}):`, colors.yellow);
        log(`      📦 Total Items: ${totalItems}`, colors.reset);
        log(`      ⭐ Featured: ${featuredItems}`, colors.reset);
        log(`      🎯 Promotional: ${promotionalItems}`, colors.reset);
        log(`      🛒 Total Purchases: ${totalPurchases}`, colors.reset);
        log(`      💰 Revenue (Gold): ${totalRevenue}`, colors.reset);
        log(`      ⏰ Next Reset: ${hoursUntilReset}h`, colors.reset);
        log(`      🔧 Refresh Cost: ${JSON.stringify(shop.refreshCost || 'None')}`, colors.reset);
      }
      
      // Statistiques globales
      const totalShops = shops.length;
      const totalActiveItems = shops.reduce((sum, shop) => sum + shop.items.length, 0);
      const totalGlobalPurchases = shops.reduce((sum, shop) => 
        sum + shop.items.reduce((shopSum, item) => shopSum + item.purchaseHistory.length, 0), 0);
      
      log(`\n  🌍 Global Statistics:`, colors.magenta);
      log(`    🏪 Active Shops: ${totalShops}`, colors.reset);
      log(`    📦 Total Items: ${totalActiveItems}`, colors.reset);
      log(`    🛒 Global Purchases: ${totalGlobalPurchases}`, colors.reset);
      log(`    📊 Average Items per Shop: ${(totalActiveItems / totalShops).toFixed(1)}`, colors.reset);
      
    } catch (error: any) {
      log(`❌ Error testing shop statistics: ${error.message}`, colors.red);
    }
  }

  async testPurchaseHistory(): Promise<void> {
    log("\n📜 Testing purchase history...", colors.cyan);
    
    try {
      const shops = await Shop.find({ isActive: true });
      let totalHistoryEntries = 0;
      
      for (const shop of shops) {
        const playerHistory = shop.getPlayerPurchaseHistory(this.testPlayerId);
        totalHistoryEntries += playerHistory.length;
        
        if (playerHistory.length > 0) {
          log(`  📝 ${shop.shopType} - ${playerHistory.length} purchases:`, colors.blue);
          playerHistory.slice(0, 3).forEach((purchase, index) => {
            log(`    ${index + 1}. ${purchase.itemName} x${purchase.quantity} on ${purchase.purchaseDate.toLocaleDateString()}`, colors.reset);
          });
          if (playerHistory.length > 3) {
            log(`    ... and ${playerHistory.length - 3} more`, colors.reset);
          }
        }
      }
      
      log(`\n  📊 Total purchase history entries: ${totalHistoryEntries}`, colors.green);
      
    } catch (error: any) {
      log(`❌ Error testing purchase history: ${error.message}`, colors.red);
    }
  }

  async cleanup(): Promise<void> {
    log("\n🧹 Cleaning up test data...", colors.yellow);
    
    try {
      const shouldCleanup = !process.argv.includes('--keep-data');
      if (shouldCleanup) {
        await Player.deleteMany({ username: "test_shop_user" });
        await Inventory.deleteMany({ playerId: this.testPlayerId });
        log("✅ Test data cleaned up", colors.green);
      } else {
        log("📝 Test data kept in database (--keep-data flag used)", colors.yellow);
      }
    } catch (error: any) {
      log(`❌ Error during cleanup: ${error.message}`, colors.red);
    }
  }

  async runAllTests(): Promise<void> {
    try {
      await this.setup();
      
      log("\n" + "=".repeat(60), colors.bright);
      log("🏪 STARTING SHOP SYSTEM TESTS", colors.bright);
      log("=".repeat(60), colors.bright);
      
      await this.testShopAccess();
      await this.testShopGeneration();
      await this.testPurchaseFlow();
      await this.testShopRefresh();
      await this.testShopStats();
      await this.testPurchaseHistory();
      
      log("\n" + "=".repeat(60), colors.bright);
      log("✅ ALL SHOP TESTS COMPLETED SUCCESSFULLY", colors.green);
      log("=".repeat(60), colors.bright);
      
    } catch (error: any) {
      log(`\n❌ SHOP TEST SUITE FAILED: ${error.message}`, colors.red);
      console.error(error);
    } finally {
      await this.cleanup();
      await mongoose.connection.close();
      log("🔌 Database connection closed", colors.blue);
    }
  }
}

// === EXÉCUTION DES TESTS ===
const runShopTests = async (): Promise<void> => {
  const tester = new ShopTester();
  await tester.runAllTests();
};

if (require.main === module) {
  log("🚀 Shop System Test Suite", colors.bright);
  log("Arguments:", process.argv.slice(2).join(' '));
  log("Use --keep-data to keep test data after tests\n", colors.yellow);
  
  runShopTests().then(() => {
    process.exit(0);
  }).catch((error) => {
    log(`❌ Fatal error: ${error.message}`, colors.red);
    process.exit(1);
  });
}

export default ShopTester;

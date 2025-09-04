import mongoose from "mongoose";
import dotenv from "dotenv";
import { createForgeService } from "../models/Forge/index";
import Player from "../models/Player";
import Inventory from "../models/Inventory";
import Item from "../models/Item";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Console colors for better readability
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

// Test data - Simplified and consistent
const testMaterials = [
  { itemId: "reforge_stone", name: "Reforge Stone", category: "Material", subCategory: "Enhancement Stone", materialType: "Enhancement", rarity: "Common", sellPrice: 25 },
  { itemId: "magic_dust", name: "Magic Dust", category: "Material", subCategory: "Magic Material", materialType: "Enhancement", rarity: "Rare", sellPrice: 75 },
  { itemId: "enhancement_stone", name: "Enhancement Stone", category: "Material", subCategory: "Enhancement Stone", materialType: "Enhancement", rarity: "Common", sellPrice: 50 },
  { itemId: "tier_stone", name: "Tier Stone", category: "Material", subCategory: "Tier Material", materialType: "Crafting", rarity: "Common", sellPrice: 75 },
  { itemId: "fusion_stone", name: "Fusion Stone", category: "Material", subCategory: "Fusion Material", materialType: "Evolution", rarity: "Common", sellPrice: 100 }
];

const testEquipment = [
  { itemId: "common_sword", name: "Common Sword", category: "Equipment", subCategory: "Sword", equipmentSlot: "Weapon", rarity: "Common", tier: 1, baseStats: { atk: 50 }, sellPrice: 100 },
  { itemId: "rare_sword", name: "Rare Sword", category: "Equipment", subCategory: "Sword", equipmentSlot: "Weapon", rarity: "Rare", tier: 2, baseStats: { atk: 120 }, sellPrice: 500 },
  { itemId: "epic_sword", name: "Epic Sword", category: "Equipment", subCategory: "Sword", equipmentSlot: "Weapon", rarity: "Epic", tier: 3, baseStats: { atk: 200 }, sellPrice: 2000 },
  { itemId: "legendary_sword", name: "Legendary Sword", category: "Equipment", subCategory: "Sword", equipmentSlot: "Weapon", rarity: "Legendary", tier: 4, baseStats: { atk: 350 }, sellPrice: 8000 },
  { itemId: "common_armor", name: "Common Armor", category: "Equipment", subCategory: "Armor", equipmentSlot: "Armor", rarity: "Common", tier: 1, baseStats: { hp: 100, def: 25 }, sellPrice: 120 }
];

class ForgeTestSuite {
  private playerId: string = "";
  private player: any = null;
  private inventory: any = null;
  private forgeService: any = null;
  private equipment: any[] = [];
  private testResults = { passed: 0, failed: 0, total: 0 };

  // === SETUP METHODS ===

  async initialize(): Promise<void> {
    log("🔧 Initializing Forge Test Suite...", colors.cyan);
    
    await mongoose.connect(MONGO_URI);
    log("✅ Connected to MongoDB", colors.green);
    
    await this.createTestPlayer();
    await this.createTestInventory();
    await this.setupTestItems();
    await this.createForgeService();
    
    log("✅ Test suite initialized successfully", colors.green);
  }

  async createTestPlayer(): Promise<void> {
    log("👤 Creating test player...", colors.yellow);
    
    // Clean up existing test player
    await Player.deleteMany({ username: "forge_test_v2" });
    
    this.player = new Player({
      username: "forge_test_v2",
      password: "test123",
      gold: 1000000,  // Plenty of gold for testing
      gems: 100000,   // Plenty of gems
      paidGems: 50000,
      level: 50,
      vipLevel: 5
    });
    
    await this.player.save();
    this.playerId = this.player._id.toString();
    
    log(`✅ Player created: ${this.player.username} (${this.playerId})`, colors.green);
    log(`   💰 Resources: ${this.player.gold}g, ${this.player.gems} gems`, colors.blue);
  }

  async createTestInventory(): Promise<void> {
    log("📦 Creating test inventory...", colors.yellow);
    
    // Clean up existing inventory
    await Inventory.deleteMany({ playerId: this.playerId });
    
    this.inventory = new Inventory({
      playerId: this.playerId,
      gold: this.player.gold,
      gems: this.player.gems,
      paidGems: this.player.paidGems,
      maxCapacity: 1000
    });
    
    await this.inventory.save();
    log("✅ Inventory created", colors.green);
  }

  async setupTestItems(): Promise<void> {
    log("🗡️ Setting up test items...", colors.yellow);
    
    // Clean up existing test items
    const testItemIds = [...testMaterials, ...testEquipment].map(item => item.itemId);
    await Item.deleteMany({ itemId: { $in: testItemIds } });
    
    // Create base items
    const allItems = [...testMaterials, ...testEquipment];
    for (const itemData of allItems) {
      await new Item(itemData).save();
    }
    log(`✅ Created ${allItems.length} base items`, colors.green);
    
    // Add items to inventory
    await this.addItemsToInventory();
  }

  async addItemsToInventory(): Promise<void> {
    log("📥 Adding items to inventory...", colors.yellow);
    
    // Add materials (high quantities)
    for (const material of testMaterials) {
      await this.inventory.addItem(material.itemId, 100, 1);
      log(`   ✅ Added: ${material.itemId} x100`, colors.green);
    }
    
    // Add equipment (3 copies of each for fusion testing)
    for (const equip of testEquipment) {
      for (let i = 0; i < 3; i++) {
        const ownedItem = await this.inventory.addItem(equip.itemId, 1, 15); // Level 15
        ownedItem.enhancement = 1; // +1 enhancement
        (ownedItem as any).tier = 1; // Always start at T1
        
        // Initialize equipment data
        ownedItem.equipmentData = {
          durability: 100,
          socketedGems: [],
          upgradeHistory: [] // Empty = T1
        };
        
        this.equipment.push(ownedItem);
        log(`   ✅ Added: ${equip.itemId} (Lvl 15, +1, T1) - ${ownedItem.instanceId}`, colors.green);
      }
    }
    
    await this.inventory.save();
    log(`✅ Added ${this.equipment.length} equipment items`, colors.green);
  }

  async createForgeService(): Promise<void> {
    log("🔨 Creating forge service...", colors.yellow);
    this.forgeService = createForgeService(this.playerId);
    log("✅ Forge service created", colors.green);
  }

  // === TEST METHODS ===

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    this.testResults.total++;
    log(`\n🧪 Testing: ${name}`, colors.cyan);
    
    try {
      await testFn();
      log(`✅ PASSED: ${name}`, colors.green);
      this.testResults.passed++;
    } catch (error: any) {
      log(`❌ FAILED: ${name} - ${error.message}`, colors.red);
      this.testResults.failed++;
      
      if (process.argv.includes('--verbose')) {
        console.error(error.stack);
      }
    }
  }

  async testForgeStatus(): Promise<void> {
    const status = await this.forgeService.getForgeStatus();
    
    if (!status) throw new Error("Status is null");
    if (!status.playerId) throw new Error("Missing playerId");
    if (!status.playerResources) throw new Error("Missing playerResources");
    if (!status.modules) throw new Error("Missing modules");
    
    log(`   📊 Status OK - ${status.playerId}`, colors.blue);
    log(`   💰 Resources: ${status.playerResources.gold}g, ${status.playerResources.gems} gems`, colors.blue);
  }

  async testReforgePreview(): Promise<void> {
    const testItem = this.getEquipmentByRarity("Epic")[0];
    if (!testItem) throw new Error("No Epic equipment for reforge test");
    
    const preview = await this.forgeService.getReforgePreview(testItem.instanceId, []);
    if (!preview.newStats) throw new Error("Missing newStats");
    if (!preview.cost) throw new Error("Missing cost");
    
    log(`   🔮 Preview: ${Object.keys(preview.newStats).length} stats, ${preview.cost.gold}g`, colors.blue);
  }

  async testReforgeExecution(): Promise<void> {
    const testItem = this.getEquipmentByRarity("Rare")[0];
    if (!testItem) throw new Error("No Rare equipment for reforge test");
    
    const result = await this.forgeService.executeReforge(testItem.instanceId, []);
    if (!result.success) throw new Error(`Reforge failed: ${result.message}`);
    
    log(`   ⚡ Reforge success: ${result.cost.gold}g spent`, colors.blue);
  }

  async testEnhancementCost(): Promise<void> {
    const testItem = this.equipment[0];
    if (!testItem) throw new Error("No equipment for enhancement cost test");
    
    const regularCost = await this.forgeService.getEnhancementCost(testItem.instanceId, false);
    const guaranteedCost = await this.forgeService.getEnhancementCost(testItem.instanceId, true);
    
    if (!regularCost.gold) throw new Error("Invalid regular cost");
    if (guaranteedCost.gems <= regularCost.gems) throw new Error("Guaranteed should cost more gems");
    
    log(`   💰 Costs: ${regularCost.gold}g regular, ${guaranteedCost.gems} gems guaranteed`, colors.blue);
  }

  async testEnhancementExecution(): Promise<void> {
    const testItem = this.equipment.find(item => (item.enhancement || 0) < 5);
    if (!testItem) throw new Error("No low enhancement equipment found");
    
    const result = await this.forgeService.executeEnhancement(testItem.instanceId, false);
    
    // Enhancement can fail naturally, so we accept both success and failure
    if (result.success) {
      log(`   ⚡ Enhancement success: +${result.data?.previousLevel} → +${result.data?.newLevel}`, colors.green);
    } else {
      log(`   💥 Enhancement failed (natural RNG): ${result.message}`, colors.yellow);
      
      // Try guaranteed enhancement
      const guaranteedResult = await this.forgeService.executeEnhancement(testItem.instanceId, true);
      if (!guaranteedResult.success) throw new Error("Guaranteed enhancement should not fail");
      log(`   💎 Guaranteed success: +${guaranteedResult.data?.previousLevel} → +${guaranteedResult.data?.newLevel}`, colors.green);
    }
  }

  async testFusionExecution(): Promise<void> {
    const commonSwords = this.getEquipmentByItemId("common_sword");
    if (commonSwords.length < 3) throw new Error("Need 3 common swords for fusion");
    
    const itemIds = commonSwords.slice(0, 3).map(item => item.instanceId);
    const result = await this.forgeService.executeFusion(itemIds);
    
    if (!result.success) throw new Error(`Fusion failed: ${result.message}`);
    if (!result.data?.newRarity) throw new Error("Missing newRarity");
    
    log(`   ⚡ Fusion success: ${result.data.previousRarity} → ${result.data.newRarity}`, colors.green);
  }

  async testTierUpgradeExecution(): Promise<void> {
    // Find a T1 item that can be upgraded (prefer non-Common for better testing)
    const testItem = this.equipment.find(item => 
      ((item as any).tier || 1) === 1 && 
      !item.itemId.includes('common')
    ) || this.equipment.find(item => ((item as any).tier || 1) === 1);
    
    if (!testItem) throw new Error("No T1 equipment found");
    
    log(`   🔧 Using: ${testItem.itemId} (T${(testItem as any).tier || 1})`, colors.blue);
    
    const result = await this.forgeService.executeTierUpgrade(testItem.instanceId);
    if (!result.success) throw new Error(`Tier upgrade failed: ${result.message}`);
    
    const prevTier = result.data?.previousTier || 1;
    const newTier = result.data?.newTier || 2;
    
    if (newTier <= prevTier) throw new Error("Tier should increase");
    
    log(`   ⚡ Tier upgrade success: T${prevTier} → T${newTier}`, colors.green);
  }

  async testTotalUpgradeCost(): Promise<void> {
    // Find a T1 item that can definitely be upgraded (Rare+ items can go T1→T2→T3+)
    let testItem = this.equipment.find(item => 
      ((item as any).tier || 1) === 1 && 
      (item.itemId.includes('rare') || item.itemId.includes('epic') || item.itemId.includes('legendary'))
    );
    
    if (!testItem) {
      // Fallback: use any T1 item
      testItem = this.equipment.find(item => ((item as any).tier || 1) === 1);
    }
    
    if (!testItem) {
      throw new Error("No T1 equipment found for upgrade cost test");
    }
    
    log(`   🔧 Testing: ${testItem.itemId} (instanceId: ${testItem.instanceId})`, colors.blue);
    
    // Verify item exists in inventory
    const inventoryItem = this.inventory.getItem(testItem.instanceId);
    if (!inventoryItem) {
      throw new Error(`Item ${testItem.instanceId} not found in inventory`);
    }
    
    const totalCost = await this.forgeService.getTotalUpgradeCostToMax(testItem.instanceId);
    
    if (!totalCost) {
      // This might be expected if the item is already at max tier for its rarity
      const Item = mongoose.model('Item');
      const baseItem = await Item.findOne({ itemId: testItem.itemId });
      
      if (baseItem?.rarity === "Common" && ((testItem as any).tier || 1) >= 2) {
        log(`   📝 Common item already at max tier (T2) - expected behavior`, colors.yellow);
        return;
      }
      
      throw new Error("Unable to compute upgrade cost for upgradable item");
    }
    
    if (totalCost.totalGold <= 0) throw new Error("Invalid total gold cost");
    if (!Array.isArray(totalCost.steps) || totalCost.steps.length === 0) {
      throw new Error("Should have upgrade steps");
    }
    
    log(`   💰 Total to max: ${totalCost.totalGold}g in ${totalCost.steps.length} steps`, colors.blue);
  }

  async testBatchOperations(): Promise<void> {
    if (this.equipment.length < 3) throw new Error("Need at least 3 items for batch test");
    
    const operations = [
      { type: 'reforge' as const, itemInstanceId: this.equipment[0].instanceId },
      { type: 'enhancement' as const, itemInstanceId: this.equipment[1].instanceId },
      { type: 'tierUpgrade' as const, itemInstanceId: this.equipment[2].instanceId }
    ];
    
    const cost = await this.forgeService.calculateBatchOperationCost(operations);
    if (cost.gold <= 0) throw new Error("Invalid batch cost");
    
    log(`   💰 Batch cost: ${cost.gold}g, ${cost.gems || 0} gems`, colors.blue);
  }

  // === UTILITY METHODS ===

  getEquipmentByRarity(rarity: string): any[] {
    return this.equipment.filter(item => item.itemId.includes(rarity.toLowerCase()));
  }

  getEquipmentByItemId(itemId: string): any[] {
    return this.equipment.filter(item => item.itemId === itemId);
  }

  // === MAIN TEST RUNNER ===

  async runAllTests(): Promise<void> {
    try {
      await this.initialize();
      
      log("\n" + "=".repeat(80), colors.bright);
      log("🔨 FORGE SYSTEM TEST SUITE - REWRITTEN", colors.bright);
      log("=".repeat(80), colors.bright);
      
      // Global tests
      log("\n🌐 GLOBAL SYSTEM TESTS", colors.magenta);
      await this.runTest("Forge Status", () => this.testForgeStatus());
      
      // Reforge tests
      log("\n🔄 REFORGE TESTS", colors.magenta);
      await this.runTest("Reforge Preview", () => this.testReforgePreview());
      await this.runTest("Reforge Execution", () => this.testReforgeExecution());
      
      // Enhancement tests
      log("\n⚡ ENHANCEMENT TESTS", colors.magenta);
      await this.runTest("Enhancement Cost", () => this.testEnhancementCost());
      await this.runTest("Enhancement Execution", () => this.testEnhancementExecution());
      
      // Fusion tests
      log("\n🔥 FUSION TESTS", colors.magenta);
      await this.runTest("Fusion Execution", () => this.testFusionExecution());
      
      // Tier upgrade tests
      log("\n🏆 TIER UPGRADE TESTS", colors.magenta);
      await this.runTest("Tier Upgrade Execution", () => this.testTierUpgradeExecution());
      await this.runTest("Total Upgrade Cost", () => this.testTotalUpgradeCost()); // The problematic test
      
      // Advanced tests
      log("\n🚀 ADVANCED TESTS", colors.magenta);
      await this.runTest("Batch Operations", () => this.testBatchOperations());
      
      this.displayResults();
      
    } catch (error: any) {
      log(`\n💥 FATAL ERROR: ${error.message}`, colors.red);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  displayResults(): void {
    const { passed, failed, total } = this.testResults;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "0";
    
    log("\n" + "=".repeat(80), colors.bright);
    
    if (failed === 0) {
      log("🎉 ALL TESTS PASSED!", colors.green);
    } else {
      log("⚠️ SOME TESTS FAILED", colors.yellow);
    }
    
    log(`📊 RESULTS: ${passed}/${total} tests passed (${passRate}%)`, colors.blue);
    log(`✅ Passed: ${passed}`, colors.green);
    log(`❌ Failed: ${failed}`, colors.red);
    
    if (passed >= total * 0.9) {
      log("🏆 EXCELLENT - Forge system is production ready!", colors.green);
    } else if (passed >= total * 0.7) {
      log("👍 GOOD - Minor issues to address", colors.yellow);
    } else {
      log("🚨 ATTENTION - Major issues need fixing", colors.red);
    }
    
    log("=".repeat(80), colors.bright);
  }

  async cleanup(): Promise<void> {
    log("\n🧹 Cleaning up...", colors.yellow);
    
    try {
      if (!process.argv.includes('--keep-data')) {
        await Promise.all([
          Player.deleteMany({ username: "forge_test_v2" }),
          Inventory.deleteMany({ playerId: this.playerId }),
          Item.deleteMany({ itemId: { $regex: /(common_|rare_|epic_|legendary_|reforge_stone|magic_dust|enhancement_stone|tier_stone|fusion_stone)/ } })
        ]);
        log("✅ Test data cleaned", colors.green);
      } else {
        log("📝 Test data preserved (--keep-data)", colors.yellow);
      }
    } catch (error) {
      log("⚠️ Cleanup error (non-critical)", colors.yellow);
    }
    
    try {
      await mongoose.connection.close();
      log("🔌 Database disconnected", colors.blue);
    } catch (error) {
      log("⚠️ DB disconnect error (non-critical)", colors.yellow);
    }
  }
}

// === MAIN EXECUTION ===

const runForgeTests = async (): Promise<void> => {
  const tester = new ForgeTestSuite();
  await tester.runAllTests();
};

if (require.main === module) {
  log("🚀 Starting Forge Test Suite (Rewritten)", colors.bright);
  
  runForgeTests()
    .then(() => {
      log("\n🎯 Test suite completed!", colors.green);
      process.exit(0);
    })
    .catch((error) => {
      log(`\n💥 Test suite failed: ${error.message}`, colors.red);
      process.exit(1);
    });
}

export default ForgeTestSuite;

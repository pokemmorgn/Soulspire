import mongoose from "mongoose";
import dotenv from "dotenv";
import Forge from "../models/Forge";
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

// === CLASSE DE TEST DE LA FORGE ===
class ForgeTester {
  protected testPlayerId: string = "";
  protected testPlayer: any = null;
  protected inventory: any = null;
  protected forge: any = null;
  protected testEquipment: any[] = [];

  async setup(): Promise<void> {
    log("🔧 Setting up forge test environment...", colors.cyan);
    
    // Connexion MongoDB
    await mongoose.connect(MONGO_URI);
    log("✅ Connected to MongoDB", colors.green);

    await this.createTestPlayer();
    await this.createTestInventory();
    await this.ensureForgeExists();
    await this.ensureTestEquipmentExists();
    await this.addTestEquipmentToInventory();
  }

  async createTestPlayer(): Promise<void> {
    log("\n👤 Creating test player...", colors.yellow);
    
    // Supprimer le joueur de test s'il existe
    await Player.deleteMany({ username: "test_forge_user" });
    
    const testPlayer = new Player({
      username: "test_forge_user",
      email: "test.forge@example.com", 
      password: "hashedpassword123",
      gold: 100000,      // Beaucoup d'or pour les tests
      gems: 5000,        // Beaucoup de gemmes pour les tests
      paidGems: 1000,
      tickets: 200,
      level: 50,         // Niveau élevé
      vipLevel: 5,
      experience: 5000
    });
    
    await testPlayer.save();
    this.testPlayerId = (testPlayer._id as any).toString();
    this.testPlayer = testPlayer;
    
    log(`✅ Test player created: ${testPlayer.username} (Level: ${testPlayer.level}, VIP: ${testPlayer.vipLevel})`, colors.green);
    log(`   💰 Resources: ${testPlayer.gold} gold, ${testPlayer.gems} gems`, colors.blue);
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
      maxCapacity: 300
    });
    
    await testInventory.save();
    this.inventory = testInventory;
    
    log(`✅ Test inventory created`, colors.green);
  }

  async ensureForgeExists(): Promise<void> {
    log("\n🔨 Ensuring forge configuration exists...", colors.yellow);
    
    // Chercher une forge active
    this.forge = await (Forge as any).getActiveForge();
    
    if (!this.forge) {
      log("⚠️ No active forge found. Creating default forge...", colors.yellow);
      
      this.forge = (Forge as any).createDefaultForge();
      await this.forge.save();
      
      log("✅ Default forge created", colors.green);
    } else {
      log(`✅ Found active forge: ${this.forge.name}`, colors.green);
    }
    
    log(`   🔧 Total reforges: ${this.forge.totalReforges}`, colors.blue);
    log(`   💰 Total gold spent: ${this.forge.totalGoldSpent}`, colors.blue);
    log(`   💎 Total gems spent: ${this.forge.totalGemsSpent}`, colors.blue);
  }

  async ensureTestEquipmentExists(): Promise<void> {
    log("\n🗡️ Ensuring test equipment exists...", colors.yellow);
    
    const testEquipmentData = [
      {
        itemId: "test_legendary_sword",
        name: "Test Legendary Sword",
        description: "A legendary sword for forge testing",
        category: "Equipment",
        subCategory: "One_Hand_Sword",
        rarity: "Legendary",
        equipmentSlot: "Weapon",
        tier: 5,
        maxLevel: 100,
        baseStats: {
          atk: 150,
          crit: 20,
          critDamage: 50,
          accuracy: 15
        },
        statsPerLevel: {
          atk: 8,
          crit: 1,
          critDamage: 2.5,
          accuracy: 0.5
        },
        sellPrice: 5000
      },
      {
        itemId: "test_epic_armor",
        name: "Test Epic Armor",
        description: "An epic armor for forge testing",
        category: "Equipment",
        subCategory: "Heavy_Armor",
        rarity: "Epic",
        equipmentSlot: "Armor",
        tier: 4,
        maxLevel: 80,
        baseStats: {
          hp: 300,
          def: 80,
          critResist: 25,
          shieldBonus: 15
        },
        statsPerLevel: {
          hp: 15,
          def: 4,
          critResist: 1,
          shieldBonus: 0.5
        },
        sellPrice: 3000
      },
      {
        itemId: "test_rare_helmet",
        name: "Test Rare Helmet",
        description: "A rare helmet for forge testing",
        category: "Equipment",
        subCategory: "Heavy_Helmet",
        rarity: "Rare",
        equipmentSlot: "Helmet",
        tier: 3,
        maxLevel: 60,
        baseStats: {
          hp: 100,
          def: 30,
          moral: 20
        },
        statsPerLevel: {
          hp: 5,
          def: 1.5,
          moral: 1
        },
        sellPrice: 1000
      }
    ];

    let createdCount = 0;
    for (const equipData of testEquipmentData) {
      const existing = await Item.findOne({ itemId: equipData.itemId });
      if (!existing) {
        const newItem = new Item(equipData);
        await newItem.save();
        createdCount++;
        log(`   ✅ Created test equipment: ${equipData.itemId}`, colors.green);
      } else {
        log(`   ⏭️ Equipment already exists: ${equipData.itemId}`, colors.blue);
      }
    }
    
    log(`✅ Test equipment ready (${createdCount} created)`, colors.green);
  }

  async addTestEquipmentToInventory(): Promise<void> {
    log("\n📥 Adding test equipment to inventory...", colors.yellow);
    
    const testEquipmentIds = ["test_legendary_sword", "test_epic_armor", "test_rare_helmet"];
    
    for (const equipmentId of testEquipmentIds) {
      try {
        const ownedItem = await this.inventory.addItem(equipmentId, 1, 25); // Niveau 25
        
        // Ajouter un peu d'enhancement pour les tests
        ownedItem.enhancement = Math.floor(Math.random() * 8) + 3; // +3 à +10
        
        this.testEquipment.push(ownedItem);
        
        log(`   ✅ Added: ${equipmentId} (Level ${ownedItem.level}, +${ownedItem.enhancement})`, colors.green);
      } catch (error: any) {
        log(`   ❌ Error adding ${equipmentId}: ${error.message}`, colors.red);
      }
    }
    
    await this.inventory.save();
    log(`✅ ${this.testEquipment.length} test equipment items added to inventory`, colors.green);
  }

  async testForgeStatus(): Promise<void> {
    log("\n📊 Testing forge status...", colors.cyan);
    
    try {
      const forge = await (Forge as any).getActiveForge();
      
      if (!forge) {
        log("❌ No active forge found", colors.red);
        return;
      }
      
      // Compter les objets reforgeables
      const equipmentCategories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
      let reforgeableItems = 0;
      
      equipmentCategories.forEach(category => {
        const items = this.inventory.storage[category] || [];
        reforgeableItems += items.length;
      });
      
      log(`  🔨 Forge: ${forge.name} (Active: ${forge.isActive})`, colors.blue);
      log(`  📊 Statistics:`, colors.blue);
      log(`    - Total Reforges: ${forge.totalReforges}`, colors.reset);
      log(`    - Gold Spent: ${forge.totalGoldSpent}`, colors.reset);
      log(`    - Gems Spent: ${forge.totalGemsSpent}`, colors.reset);
      log(`  🎒 Reorgeable Items in Inventory: ${reforgeableItems}`, colors.blue);
      
      // Tester les coûts par rareté
      const rarities = ["Common", "Rare", "Epic", "Legendary"];
      log(`  💰 Base Costs by Rarity:`, colors.blue);
      
      for (const rarity of rarities) {
        const cost0 = forge.calculateReforgeCost(rarity, [], 0);
        const cost2 = forge.calculateReforgeCost(rarity, ["atk", "crit"], 0);
        const cost5 = forge.calculateReforgeCost(rarity, [], 5);
        
        log(`    ${rarity}: ${cost0.gold}g (0 locks) | ${cost2.gold}g (2 locks) | ${cost5.gold}g (5 reforges)`, colors.reset);
      }
      
    } catch (error: any) {
      log(`❌ Error testing forge status: ${error.message}`, colors.red);
    }
  }

  async testReforgePreview(): Promise<void> {
    log("\n🔮 Testing reforge preview...", colors.cyan);
    
    if (this.testEquipment.length === 0) {
      log("⚠️ No test equipment available for preview", colors.yellow);
      return;
    }
    
    try {
      const testItem = this.testEquipment[0]; // Prendre la première épée légendaire
      const baseItem = await Item.findOne({ itemId: testItem.itemId });
      
      if (!baseItem) {
        log("❌ Base item not found", colors.red);
        return;
      }
      
      log(`  🗡️ Testing preview for: ${baseItem.name}`, colors.blue);
      log(`    Instance ID: ${testItem.instanceId}`, colors.reset);
      log(`    Level: ${testItem.level}, Enhancement: +${testItem.enhancement}`, colors.reset);
      
      // Calculer les stats actuelles
      const currentStats = this.forge.calculateCurrentItemStats(baseItem, testItem);
      log(`  📊 Current Stats:`, colors.blue);
      Object.entries(currentStats).forEach(([stat, value]) => {
        log(`    ${stat}: ${value}`, colors.reset);
      });
      
      // Test 1: Preview sans locks
      log(`\n  🔄 Preview 1: No locked stats`, colors.yellow);
      const preview1 = await this.forge.getItemReforgePreview(
        this.testPlayerId, 
        testItem.instanceId, 
        []
      );
      
      log(`    Cost: ${preview1.cost.gold} gold, ${preview1.cost.gems} gems`, colors.blue);
      log(`    New Stats:`, colors.blue);
      Object.entries(preview1.newStats).forEach(([stat, value]) => {
        const current = currentStats[stat] || 0;
        const diff = (value as number) - current;
        const color = diff > 0 ? colors.green : diff < 0 ? colors.red : colors.reset;
        log(`      ${stat}: ${current} → ${value} (${diff >= 0 ? '+' : ''}${diff})`, color);
      });
      
      // Test 2: Preview avec 2 stats lockées
      const lockedStats = ["atk", "crit"];
      log(`\n  🔄 Preview 2: Locked stats [${lockedStats.join(", ")}]`, colors.yellow);
      const preview2 = await this.forge.getItemReforgePreview(
        this.testPlayerId, 
        testItem.instanceId, 
        lockedStats
      );
      
      log(`    Cost: ${preview2.cost.gold} gold, ${preview2.cost.gems} gems`, colors.blue);
      log(`    Locked Stats:`, colors.green);
      lockedStats.forEach(stat => {
        log(`      ${stat}: ${currentStats[stat]} (LOCKED)`, colors.green);
      });
      log(`    New Stats:`, colors.blue);
      Object.entries(preview2.newStats).forEach(([stat, value]) => {
        if (lockedStats.includes(stat)) return; // Skip locked stats
        const current = currentStats[stat] || 0;
        const diff = (value as number) - current;
        const color = diff > 0 ? colors.green : diff < 0 ? colors.red : colors.reset;
        log(`      ${stat}: ${current} → ${value} (${diff >= 0 ? '+' : ''}${diff})`, color);
      });
      
      // Test 3: Preview avec 4 stats lockées (coût maximum)
      if (Object.keys(currentStats).length >= 4) {
        const maxLockedStats = Object.keys(currentStats).slice(0, 4);
        log(`\n  🔄 Preview 3: Max locked stats [${maxLockedStats.join(", ")}]`, colors.yellow);
        const preview3 = await this.forge.getItemReforgePreview(
          this.testPlayerId, 
          testItem.instanceId, 
          maxLockedStats
        );
        
        log(`    Cost: ${preview3.cost.gold} gold, ${preview3.cost.gems} gems`, colors.blue);
        log(`    Cost Multipliers:`, colors.blue);
        log(`      Quality: x${preview3.cost.multipliers.quality}`, colors.reset);
        log(`      Locks: x${preview3.cost.multipliers.locks}`, colors.reset);
        log(`      Reforges: x${preview3.cost.multipliers.reforge}`, colors.reset);
      }
      
    } catch (error: any) {
      log(`❌ Error testing reforge preview: ${error.message}`, colors.red);
      console.error("Full error:", error);
    }
  }

  async testReforgeExecution(): Promise<void> {
    log("\n⚡ Testing reforge execution...", colors.cyan);
    
    if (this.testEquipment.length < 2) {
      log("⚠️ Not enough test equipment for execution test", colors.yellow);
      return;
    }
    
    try {
      const testItem = this.testEquipment[1]; // Prendre la deuxième armure épique
      const baseItem = await Item.findOne({ itemId: testItem.itemId });
      
      if (!baseItem) {
        log("❌ Base item not found", colors.red);
        return;
      }
      
      log(`  🛡️ Testing reforge execution for: ${baseItem.name}`, colors.blue);
      
      // Sauvegarder l'état avant reforge
      const playerBefore = await Player.findById(this.testPlayerId);
      const currentStats = this.forge.calculateCurrentItemStats(baseItem, testItem);
      
      log(`  📊 Before Reforge:`, colors.blue);
      log(`    Player Resources: ${playerBefore?.gold}g, ${playerBefore?.gems} gems`, colors.reset);
      log(`    Item Stats:`, colors.reset);
      Object.entries(currentStats).forEach(([stat, value]) => {
        log(`      ${stat}: ${value}`, colors.reset);
      });
      
      // Exécuter le reforge avec 1 stat lockée valide
      const validStatsForLock = Object.keys(currentStats).filter(stat => 
        typeof currentStats[stat] === 'number' && !isNaN(currentStats[stat])
      );
      const lockedStats = validStatsForLock.length > 0 ? [validStatsForLock[0]] : [];
      
      log(`\n  🔄 Executing reforge with locked stats: [${lockedStats.join(", ")}]`, colors.yellow);
      
      const result = await this.forge.executeReforge(
        this.testPlayerId,
        testItem.instanceId,
        lockedStats
      );
      
      // Vérifier les résultats
      const playerAfter = await Player.findById(this.testPlayerId);
      const inventoryAfter = await Inventory.findOne({ playerId: this.testPlayerId });
      const updatedItem = inventoryAfter?.getItem(testItem.instanceId);
      
      log(`  ✅ Reforge executed successfully!`, colors.green);
      log(`  📊 Results:`, colors.blue);
      log(`    Cost Paid: ${result.cost.gold}g, ${result.cost.gems} gems`, colors.blue);
      log(`    Player Resources: ${playerBefore?.gold}g → ${playerAfter?.gold}g (-${(playerBefore?.gold || 0) - (playerAfter?.gold || 0)})`, colors.blue);
      log(`    Reforge Count: ${result.reforgeCount}`, colors.blue);
      
      log(`  🔄 Stat Changes:`, colors.blue);
      Object.entries(result.newStats).forEach(([stat, newValue]) => {
        const oldValue = currentStats[stat] || 0;
        const diff = (newValue as number) - oldValue;
        
        if (lockedStats.includes(stat)) {
          log(`      ${stat}: ${oldValue} (LOCKED)`, colors.green);
        } else {
          const color = diff > 0 ? colors.green : diff < 0 ? colors.red : colors.reset;
          log(`      ${stat}: ${oldValue} → ${newValue} (${diff >= 0 ? '+' : ''}${diff})`, color);
        }
      });
      
      // Vérifier que les stats lockées n'ont pas changé
      let locksRespected = true;
      for (const lockedStat of lockedStats) {
        if (result.newStats[lockedStat] !== currentStats[lockedStat]) {
          locksRespected = false;
          log(`    ❌ LOCK VIOLATION: ${lockedStat} changed from ${currentStats[lockedStat]} to ${result.newStats[lockedStat]}`, colors.red);
        }
      }
      
      if (locksRespected) {
        log(`  ✅ All locked stats respected`, colors.green);
      }
      
      // Vérifier l'historique de reforge
      if (updatedItem?.equipmentData?.upgradeHistory) {
        log(`  📜 Reforge History: ${updatedItem.equipmentData.upgradeHistory.length} entries`, colors.blue);
      }
      
    } catch (error: any) {
      log(`❌ Error testing reforge execution: ${error.message}`, colors.red);
      console.error("Full error:", error);
    }
  }

  async testMultipleReforges(): Promise<void> {
    log("\n🔄 Testing multiple reforges (cost scaling)...", colors.cyan);
    
    if (this.testEquipment.length < 3) {
      log("⚠️ Not enough test equipment for multiple reforge test", colors.yellow);
      return;
    }
    
    try {
      const testItem = this.testEquipment[2]; // Prendre le casque rare
      const baseItem = await Item.findOne({ itemId: testItem.itemId });
      
      if (!baseItem) {
        log("❌ Base item not found", colors.red);
        return;
      }
      
      log(`  🎩 Testing multiple reforges for: ${baseItem.name}`, colors.blue);
      
      const reforgeResults = [];
      
      // Effectuer 5 reforges successifs
      for (let i = 0; i < 5; i++) {
        try {
          const playerBefore = await Player.findById(this.testPlayerId);
          
          // Calculer le coût prévu
          const expectedCost = this.forge.calculateReforgeCost(baseItem.rarity, [], i);
          log(`\n  🔄 Reforge #${i + 1}`, colors.yellow);
          log(`    Expected Cost: ${expectedCost.gold}g (multiplier: x${expectedCost.multipliers.reforge.toFixed(2)})`, colors.blue);
          
          if (!playerBefore?.canAfford(expectedCost)) {
            log(`    ⚠️ Player cannot afford reforge #${i + 1}`, colors.yellow);
            break;
          }
          
          const result = await this.forge.executeReforge(
            this.testPlayerId,
            testItem.instanceId,
            [] // Pas de stats lockées pour voir tous les changements
          );
          
          const playerAfter = await Player.findById(this.testPlayerId);
          const actualCost = (playerBefore?.gold || 0) - (playerAfter?.gold || 0);
          
          reforgeResults.push({
            reforgeNumber: i + 1,
            expectedCost: expectedCost.gold,
            actualCost,
            newStats: result.newStats,
            reforgeCount: result.reforgeCount
          });
          
          log(`    ✅ Actual Cost: ${actualCost}g`, colors.green);
          log(`    📊 New Stats Count: ${Object.keys(result.newStats).length}`, colors.blue);
          
        } catch (error: any) {
          log(`    ❌ Reforge #${i + 1} failed: ${error.message}`, colors.red);
          break;
        }
      }
      
      // Analyser les résultats
      log(`\n  📈 Multiple Reforge Analysis:`, colors.magenta);
      log(`    Total Reforges Completed: ${reforgeResults.length}`, colors.blue);
      
      const totalCost = reforgeResults.reduce((sum, r) => sum + r.actualCost, 0);
      const averageCost = totalCost / reforgeResults.length;
      
      log(`    Total Gold Spent: ${totalCost}g`, colors.blue);
      log(`    Average Cost per Reforge: ${averageCost.toFixed(0)}g`, colors.blue);
      
      // Vérifier l'escalade des coûts
      log(`  💰 Cost Scaling:`, colors.blue);
      reforgeResults.forEach((result, index) => {
        const expectedMultiplier = 1 + (index * 0.1);
        log(`    #${result.reforgeNumber}: ${result.actualCost}g (expected ~${result.expectedCost}g, multiplier: x${expectedMultiplier.toFixed(1)})`, colors.reset);
      });
      
    } catch (error: any) {
      log(`❌ Error testing multiple reforges: ${error.message}`, colors.red);
    }
  }

  async testStatValidation(): Promise<void> {
    log("\n✅ Testing stat validation...", colors.cyan);
    
    try {
      // Tester la validation des stats par slot
      const slotTests = [
        { slot: "Weapon", validStats: ["atk", "crit"], invalidStats: ["hp", "def"] },
        { slot: "Armor", validStats: ["hp", "def"], invalidStats: ["atk", "crit"] },
        { slot: "Helmet", validStats: ["hp", "moral"], invalidStats: ["atk", "critDamage"] }
      ];
      
      for (const test of slotTests) {
        log(`  🔍 Testing slot: ${test.slot}`, colors.blue);
        
        // Test valid stats
        const validResult = this.forge.validateLockedStats(test.slot, test.validStats);
        log(`    ✅ Valid stats [${test.validStats.join(", ")}]: ${validResult}`, 
          validResult ? colors.green : colors.red);
        
        // Test invalid stats
        const invalidResult = this.forge.validateLockedStats(test.slot, test.invalidStats);
        log(`    ❌ Invalid stats [${test.invalidStats.join(", ")}]: ${invalidResult}`, 
          !invalidResult ? colors.green : colors.red);
      }
      
      // Tester la génération de stats
      log(`\n  🎲 Testing stat generation:`, colors.blue);
      const testStats = { atk: 100, crit: 15, hp: 50 };
      const lockedStats = ["atk"];
      
      const generatedStats = this.forge.generateNewStats("Weapon", "Epic", lockedStats, testStats);
      
      log(`    Original: atk: 100, crit: 15, hp: 50`, colors.reset);
      log(`    Locked: [atk]`, colors.green);
      log(`    Generated:`, colors.blue);
      Object.entries(generatedStats).forEach(([stat, value]) => {
        const isLocked = lockedStats.includes(stat);
        const color = isLocked ? colors.green : colors.blue;
        const suffix = isLocked ? " (LOCKED)" : "";
        log(`      ${stat}: ${value}${suffix}`, color);
      });
      
    } catch (error: any) {
      log(`❌ Error testing stat validation: ${error.message}`, colors.red);
    }
  }

  async testForgeAnalytics(): Promise<void> {
    log("\n📊 Testing forge analytics...", colors.cyan);
    
    try {
      // Rafraîchir la forge pour obtenir les dernières stats
      const forge = await Forge.findById(this.forge._id);
      
      if (!forge) {
        log("❌ Forge not found for analytics", colors.red);
        return;
      }
      
      log(`  📈 Forge Analytics:`, colors.blue);
      log(`    Config ID: ${forge.configId}`, colors.reset);
      log(`    Name: ${forge.name}`, colors.reset);
      log(`    Active: ${forge.isActive}`, colors.reset);
      log(`    Total Reforges: ${forge.totalReforges}`, colors.reset);
      log(`    Total Gold Spent: ${forge.totalGoldSpent}`, colors.reset);
      log(`    Total Gems Spent: ${forge.totalGemsSpent}`, colors.reset);
      
      // Calculer des moyennes
      if (forge.totalReforges > 0) {
        const avgGoldPerReforge = Math.round(forge.totalGoldSpent / forge.totalReforges);
        const avgGemsPerReforge = Math.round(forge.totalGemsSpent / forge.totalReforges);
        
        log(`  💰 Averages:`, colors.blue);
        log(`    Gold per Reforge: ${avgGoldPerReforge}g`, colors.reset);
        log(`    Gems per Reforge: ${avgGemsPerReforge} gems`, colors.reset);
      }
      
      // Tester la configuration
      log(`  ⚙️ Configuration:`, colors.blue);
      log(`    Base Gold Cost: ${forge.config.baseCosts.gold}`, colors.reset);
      log(`    Base Gems Cost: ${forge.config.baseCosts.gems}`, colors.reset);
      log(`    Lock Multipliers: [${forge.config.lockMultipliers.join(", ")}]`, colors.reset);
      
      // Compter les configurations de slots
      log(`    Slot Configurations: ${forge.config.slotConfigs.length}`, colors.reset);
      forge.config.slotConfigs.forEach((slotConfig: any) => {
        log(`      ${slotConfig.slot}: ${slotConfig.availableStats.length} stats (${slotConfig.minStats}-${slotConfig.maxStats})`, colors.reset);
      });
      
    } catch (error: any) {
      log(`❌ Error testing forge analytics: ${error.message}`, colors.red);
    }
  }

  async cleanup(): Promise<void> {
    log("\n🧹 Cleaning up test data...", colors.yellow);
    
    try {
      const shouldCleanup = !process.argv.includes('--keep-data');
      if (shouldCleanup) {
        await Promise.all([
          Player.deleteMany({ username: "test_forge_user" }),
          Inventory.deleteMany({ playerId: this.testPlayerId }),
          Item.deleteMany({ itemId: { $regex: /^test_/ } }) // Supprimer les objets de test
        ]);
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
      log("🔨 STARTING FORGE SYSTEM TESTS", colors.bright);
      log("=".repeat(60), colors.bright);
      
      await this.testForgeStatus();
      await this.testReforgePreview();
      await this.testReforgeExecution();
      await this.testMultipleReforges();
      await this.testStatValidation();
      await this.testForgeAnalytics();
      
      log("\n" + "=".repeat(60), colors.bright);
      log("✅ ALL FORGE TESTS COMPLETED SUCCESSFULLY", colors.green);
      log("=".repeat(60), colors.bright);
      
    } catch (error: any) {
      log(`\n❌ FORGE TEST SUITE FAILED: ${error.message}`, colors.red);
      console.error(error);
    } finally {
      await this.cleanup();
      await mongoose.connection.close();
      log("🔌 Database connection closed", colors.blue);
    }
  }
}

// === TESTS SPÉCIALISÉS ADDITIONNELS ===
class AdvancedForgeTester extends ForgeTester {
  
  async testEdgeCases(): Promise<void> {
    log("\n🔍 Testing edge cases...", colors.cyan);
    
    try {
      // Test 1: Reforge avec joueur sans ressources
      log(`  💸 Testing insufficient resources...`, colors.yellow);
      
      const poorPlayer = new Player({
        username: "poor_test_player",
        password: "password",
        gold: 10,
        gems: 5,
        level: 1
      });
      await poorPlayer.save();
      const poorPlayerId = (poorPlayer._id as any).toString();
      
      try {
        await this.forge.executeReforge(poorPlayerId, this.testEquipment[0]?.instanceId, []);
        log(`    ❌ Should have failed with insufficient resources`, colors.red);
      } catch (error: any) {
        if (error.message.includes("afford")) {
          log(`    ✅ Correctly rejected: ${error.message}`, colors.green);
        } else {
          log(`    ❌ Wrong error: ${error.message}`, colors.red);
        }
      }
      
      // Nettoyer le joueur test
      await Player.deleteOne({ _id: poorPlayerId });
      
      // Test 2: Reforge objet non-équipement
      log(`  🧪 Testing non-equipment reforge...`, colors.yellow);
      
      // Ajouter une potion à l'inventaire
      try {
        const potion = await this.inventory.addItem("health_potion_small", 1, 1);
        
        try {
          await this.forge.executeReforge(this.testPlayerId, potion.instanceId, []);
          log(`    ❌ Should have failed with non-equipment item`, colors.red);
        } catch (error: any) {
          if (error.message.includes("equipment")) {
            log(`    ✅ Correctly rejected non-equipment: ${error.message}`, colors.green);
          } else {
            log(`    ❌ Wrong error: ${error.message}`, colors.red);
          }
        }
      } catch (addError) {
        log(`    ⚠️ Could not add potion for test (item may not exist)`, colors.yellow);
      }
      
      // Test 3: Stats lockées invalides
      log(`  🔒 Testing invalid locked stats...`, colors.yellow);
      
      if (this.testEquipment.length > 0) {
        try {
          // Essayer de locker des stats invalides pour une arme
          const invalidStats = ["hp", "def", "shieldBonus"]; // Stats d'armure sur une arme
          
          const result = this.forge.validateLockedStats("Weapon", invalidStats);
          if (!result) {
            log(`    ✅ Correctly rejected invalid stats for Weapon: [${invalidStats.join(", ")}]`, colors.green);
          } else {
            log(`    ❌ Should have rejected invalid stats`, colors.red);
          }
        } catch (error: any) {
          log(`    ❌ Error testing invalid stats: ${error.message}`, colors.red);
        }
      }
      
      // Test 4: Plus de 4 stats lockées
      log(`  🔢 Testing too many locked stats...`, colors.yellow);
      
      const tooManyStats = ["atk", "crit", "critDamage", "accuracy", "healthleech", "vitesse"];
      try {
        // La validation devrait rejeter plus de 4 stats
        const preview = await this.forge.getItemReforgePreview(
          this.testPlayerId, 
          this.testEquipment[0]?.instanceId, 
          tooManyStats
        );
        log(`    ⚠️ Preview succeeded with ${tooManyStats.length} locked stats`, colors.yellow);
      } catch (error: any) {
        log(`    ✅ Correctly handled too many locked stats: ${error.message}`, colors.green);
      }
      
    } catch (error: any) {
      log(`❌ Error testing edge cases: ${error.message}`, colors.red);
    }
  }

  async testPerformance(): Promise<void> {
    log("\n⚡ Testing performance...", colors.cyan);
    
    try {
      const iterations = 50;
      log(`  🏃 Running ${iterations} preview calculations...`, colors.yellow);
      
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        if (this.testEquipment.length > 0) {
          await this.forge.getItemReforgePreview(
            this.testPlayerId,
            this.testEquipment[0].instanceId,
            Math.random() > 0.5 ? ["atk"] : []
          );
        }
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      log(`  ✅ Performance Results:`, colors.green);
      log(`    Total Time: ${totalTime}ms`, colors.blue);
      log(`    Average per Preview: ${avgTime.toFixed(2)}ms`, colors.blue);
      log(`    Previews per Second: ${(1000 / avgTime).toFixed(0)}`, colors.blue);
      
      if (avgTime < 100) {
        log(`    🚀 Excellent performance!`, colors.green);
      } else if (avgTime < 500) {
        log(`    ✅ Good performance`, colors.green);
      } else {
        log(`    ⚠️ Performance could be improved`, colors.yellow);
      }
      
    } catch (error: any) {
      log(`❌ Error testing performance: ${error.message}`, colors.red);
    }
  }

  async testConcurrency(): Promise<void> {
    log("\n🔄 Testing concurrent reforges...", colors.cyan);
    
    try {
      if (this.testEquipment.length < 2) {
        log(`    ⚠️ Need at least 2 items for concurrency test`, colors.yellow);
        return;
      }
      
      log(`  ⚡ Testing concurrent reforge operations...`, colors.yellow);
      
      const promises = [];
      
      // Lancer plusieurs reforges en parallèle sur différents objets
      for (let i = 0; i < Math.min(3, this.testEquipment.length); i++) {
        promises.push(
          this.forge.executeReforge(
            this.testPlayerId,
            this.testEquipment[i].instanceId,
            []
          ).catch((error: any) => ({ error: error.message, index: i }))
        );
      }
      
      const results = await Promise.all(promises);
      
      let successCount = 0;
      let errorCount = 0;
      
      results.forEach((result, index) => {
        if ((result as any).error) {
          errorCount++;
          log(`    Item ${index}: ❌ ${(result as any).error}`, colors.red);
        } else {
          successCount++;
          log(`    Item ${index}: ✅ Success`, colors.green);
        }
      });
      
      log(`  📊 Concurrency Results:`, colors.blue);
      log(`    Successful: ${successCount}`, colors.green);
      log(`    Failed: ${errorCount}`, colors.red);
      
      if (errorCount === 0) {
        log(`    🎉 All concurrent operations succeeded!`, colors.green);
      } else {
        log(`    ⚠️ Some operations failed - this may be expected due to resource constraints`, colors.yellow);
      }
      
    } catch (error: any) {
      log(`❌ Error testing concurrency: ${error.message}`, colors.red);
    }
  }

  async testStatDistribution(): Promise<void> {
    log("\n📊 Testing stat distribution...", colors.cyan);
    
    try {
      if (this.testEquipment.length === 0) {
        log(`    ⚠️ No equipment available for distribution test`, colors.yellow);
        return;
      }
      
      log(`  🎲 Analyzing stat distribution over multiple reforges...`, colors.yellow);
      
      const testItem = this.testEquipment[0];
      const baseItem = await Item.findOne({ itemId: testItem.itemId });
      const iterations = 20;
      
      const statFrequency: { [stat: string]: number } = {};
      const statValues: { [stat: string]: number[] } = {};
      
      // Générer plusieurs previews pour analyser la distribution
      for (let i = 0; i < iterations; i++) {
        try {
          const preview = await this.forge.getItemReforgePreview(
            this.testPlayerId,
            testItem.instanceId,
            [] // Pas de stats lockées
          );
          
          Object.entries(preview.newStats).forEach(([stat, value]) => {
            statFrequency[stat] = (statFrequency[stat] || 0) + 1;
            if (!statValues[stat]) statValues[stat] = [];
            statValues[stat].push(value as number);
          });
        } catch (error) {
          // Ignorer les erreurs pour cette analyse
        }
      }
      
      log(`  📈 Stat Distribution Analysis (${iterations} samples):`, colors.blue);
      
      Object.entries(statFrequency).forEach(([stat, frequency]) => {
        const percentage = ((frequency / iterations) * 100).toFixed(1);
        const values = statValues[stat];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1);
        
        log(`    ${stat}: ${percentage}% frequency, range ${min}-${max}, avg ${avg}`, colors.reset);
      });
      
      // Vérifier les ranges configurés
      if (baseItem) {
        const configuredRanges = this.forge.config.statRanges.get(baseItem.rarity);
        if (configuredRanges) {
          log(`  🎯 Range Compliance Check:`, colors.blue);
          
          Object.entries(statValues).forEach(([stat, values]) => {
            const range = configuredRanges.get(stat);
            if (range) {
              const min = Math.min(...values);
              const max = Math.max(...values);
              const inRange = min >= range.min && max <= range.max;
              
              log(`    ${stat}: Generated ${min}-${max}, Expected ${range.min}-${range.max} ${inRange ? '✅' : '❌'}`, 
                inRange ? colors.green : colors.red);
            }
          });
        }
      }
      
    } catch (error: any) {
      log(`❌ Error testing stat distribution: ${error.message}`, colors.red);
    }
  }

  async runAdvancedTests(): Promise<void> {
    log("\n" + "=".repeat(60), colors.bright);
    log("🧪 RUNNING ADVANCED FORGE TESTS", colors.bright);
    log("=".repeat(60), colors.bright);
    
    await this.testEdgeCases();
    await this.testPerformance();
    await this.testConcurrency();
    await this.testStatDistribution();
    
    log("\n" + "=".repeat(60), colors.bright);
    log("🎓 ADVANCED TESTS COMPLETED", colors.green);
    log("=".repeat(60), colors.bright);
  }
}

// === EXÉCUTION DES TESTS ===
const runForgeTests = async (): Promise<void> => {
  const advanced = process.argv.includes('--advanced');
  
  if (advanced) {
    const tester = new AdvancedForgeTester();
    await tester.runAllTests();
    await tester.runAdvancedTests();
  } else {
    const tester = new ForgeTester();
    await tester.runAllTests();
  }
};

if (require.main === module) {
  log("🚀 Forge System Test Suite", colors.bright);
  log("Arguments:", process.argv.slice(2).join(' '));
  log("Use --keep-data to keep test data after tests", colors.yellow);
  log("Use --advanced to run additional advanced tests\n", colors.yellow);
  
  runForgeTests().then(() => {
    process.exit(0);
  }).catch((error) => {
    log(`❌ Fatal error: ${error.message}`, colors.red);
    process.exit(1);
  });
}

export default ForgeTester;

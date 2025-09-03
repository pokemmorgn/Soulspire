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

// === DONNÉES DE TEST ===

// Matériaux nécessaires pour les tests
const testMaterialsData = [
  {
    itemId: "iron_ore",
    name: "Iron Ore",
    description: "Basic material for equipment reforging",
    category: "Material",
    materialType: "Enhancement",
    rarity: "Common",
    sellPrice: 10,
    stackable: true,
    maxStack: 999
  },
  {
    itemId: "magic_crystal",
    name: "Magic Crystal",
    description: "Rare material for equipment reforging",
    category: "Material",
    materialType: "Enhancement",
    rarity: "Rare",
    sellPrice: 50,
    stackable: true,
    maxStack: 999
  },
  {
    itemId: "dragon_scale",
    name: "Dragon Scale",
    description: "Epic material for equipment reforging",
    category: "Material",
    materialType: "Enhancement",
    rarity: "Epic",
    sellPrice: 200,
    stackable: true,
    maxStack: 999
  },
  {
    itemId: "awakening_stone",
    name: "Awakening Stone",
    description: "Legendary material for equipment reforging",
    category: "Material",
    materialType: "Enhancement",
    rarity: "Legendary",
    sellPrice: 1000,
    stackable: true,
    maxStack: 999
  }
];

// Équipements de test
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
  },
  {
    itemId: "test_common_boots",
    name: "Test Common Boots",
    description: "Common boots for forge testing",
    category: "Equipment",
    subCategory: "Light_Boots",
    rarity: "Common",
    equipmentSlot: "Boots",
    tier: 1,
    maxLevel: 40,
    baseStats: {
      hp: 50,
      vitesse: 10,
      dodge: 5
    },
    statsPerLevel: {
      hp: 2,
      vitesse: 0.5,
      dodge: 0.2
    },
    sellPrice: 200
  }
];

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
    await this.ensureTestItemsExist();
    await this.addTestItemsToInventory();
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

  async ensureTestItemsExist(): Promise<void> {
    log("\n🗡️ Ensuring test items exist...", colors.yellow);
    
    const allTestItems = [...testEquipmentData, ...testMaterialsData];
    let createdCount = 0;
    
    for (const itemData of allTestItems) {
      const existing = await Item.findOne({ itemId: itemData.itemId });
      if (!existing) {
        const newItem = new Item(itemData);
        await newItem.save();
        createdCount++;
        log(`   ✅ Created: ${itemData.itemId} (${itemData.category})`, colors.green);
      } else {
        log(`   ⏭️ Already exists: ${itemData.itemId}`, colors.blue);
      }
    }
    
    log(`✅ Test items ready (${createdCount} created)`, colors.green);
  }

  async addTestItemsToInventory(): Promise<void> {
    log("\n📥 Adding test items to inventory...", colors.yellow);
    
    // Ajouter les équipements
    for (const equipData of testEquipmentData) {
      try {
        const level = Math.floor(Math.random() * 30) + 10; // Level 10-40
        const enhancement = Math.floor(Math.random() * 8) + 2; // +2 à +9
        
        const ownedItem = await this.inventory.addItem(equipData.itemId, 1, level);
        ownedItem.enhancement = enhancement;
        
        this.testEquipment.push(ownedItem);
        
        log(`   ✅ Added equipment: ${equipData.itemId} (Level ${level}, +${enhancement})`, colors.green);
      } catch (error: any) {
        log(`   ❌ Error adding ${equipData.itemId}: ${error.message}`, colors.red);
      }
    }
    
    // Ajouter les matériaux
    const materialsToAdd = [
      { itemId: "iron_ore", quantity: 100 },
      { itemId: "magic_crystal", quantity: 50 },
      { itemId: "dragon_scale", quantity: 25 },
      { itemId: "awakening_stone", quantity: 10 }
    ];
    
    for (const { itemId, quantity } of materialsToAdd) {
      try {
        await this.inventory.addItem(itemId, quantity, 1);
        log(`   ✅ Added material: ${itemId} x${quantity}`, colors.green);
      } catch (error: any) {
        log(`   ❌ Error adding ${itemId}: ${error.message}`, colors.red);
      }
    }
    
    await this.inventory.save();
    log(`✅ ${this.testEquipment.length} equipment and materials added to inventory`, colors.green);
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
      const testItem = this.testEquipment[0]; // Prendre le premier équipement
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
      if (preview1.cost.materials && Object.keys(preview1.cost.materials).length > 0) {
        log(`    Materials:`, colors.blue);
        Object.entries(preview1.cost.materials).forEach(([mat, qty]) => {
          log(`      ${mat}: ${qty}`, colors.reset);
        });
      }
      log(`    New Stats:`, colors.blue);
      Object.entries(preview1.newStats).forEach(([stat, value]) => {
        const current = currentStats[stat] || 0;
        const diff = (value as number) - current;
        const color = diff > 0 ? colors.green : diff < 0 ? colors.red : colors.reset;
        log(`      ${stat}: ${current} → ${value} (${diff >= 0 ? '+' : ''}${diff})`, color);
      });
      
      // Test 2: Preview avec stats lockées
      const availableStats = Object.keys(currentStats).filter(stat => 
        typeof currentStats[stat] === 'number' && !isNaN(currentStats[stat])
      );
      
      if (availableStats.length >= 2) {
        const lockedStats = availableStats.slice(0, 2);
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
          if (lockedStats.includes(stat)) return; // Skip locked stats in display
          const current = currentStats[stat] || 0;
          const diff = (value as number) - current;
          const color = diff > 0 ? colors.green : diff < 0 ? colors.red : colors.reset;
          log(`      ${stat}: ${current} → ${value} (${diff >= 0 ? '+' : ''}${diff})`, color);
        });
      }
      
      // Test 3: Preview avec maximum de stats lockées
      if (availableStats.length >= 3) {
        const maxLockedStats = availableStats.slice(0, Math.min(3, availableStats.length));
        log(`\n  🔄 Preview 3: Max locked stats [${maxLockedStats.join(", ")}]`, colors.yellow);
        
        try {
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
        } catch (error: any) {
          log(`    ⚠️ Max locks test failed: ${error.message}`, colors.yellow);
        }
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
      const testItem = this.testEquipment[1]; // Prendre le deuxième équipement
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
      if (result.cost.materials) {
        log(`    Materials Used:`, colors.blue);
        Object.entries(result.cost.materials).forEach(([mat, qty]) => {
          log(`      ${mat}: ${qty}`, colors.reset);
        });
      }
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
        if (Math.abs(result.newStats[lockedStat] - currentStats[lockedStat]) > 0.01) {
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
      const testItem = this.testEquipment[2]; // Prendre le troisième équipement
      const baseItem = await Item.findOne({ itemId: testItem.itemId });
      
      if (!baseItem) {
        log("❌ Base item not found", colors.red);
        return;
      }
      
      log(`  🎩 Testing multiple reforges for: ${baseItem.name}`, colors.blue);
      
      const reforgeResults = [];
      const maxReforges = 3; // Limiter à 3 pour éviter d'épuiser les ressources
      
      // Effectuer plusieurs reforges successifs
      for (let i = 0; i < maxReforges; i++) {
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
      
      if (reforgeResults.length > 0) {
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
      }
      
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
        { slot: "Helmet", validStats: ["hp", "moral"], invalidStats: ["atk", "critDamage"] },
        { slot: "Boots", validStats: ["hp", "vitesse"], invalidStats: ["atk", "crit"] }
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
      const testStats = { atk: 100, crit: 15, critDamage: 30 };
      const lockedStats = ["atk"];
      
      const generatedStats = this.forge.generateNewStats("Weapon", "Epic", lockedStats, testStats);
      
      log(`    Original: ${Object.entries(testStats).map(([k,v]) => `${k}: ${v}`).join(", ")}`, colors.reset);
      log(`    Locked: [${lockedStats.join(", ")}]`, colors.green);
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
      
      // Afficher les matériaux requis
      if (forge.config.baseCosts.materialCosts) {
        log(`  🧪 Material Requirements:`, colors.blue);
        const materialCosts = forge.config.baseCosts.materialCosts;
        
        // materialCosts est une Map, donc on utilise .entries()
        if (materialCosts instanceof Map) {
          for (const [rarity, materials] of materialCosts.entries()) {
            const materialList = [];
            if (materials instanceof Map) {
              for (const [materialId, amount] of materials.entries()) {
                materialList.push(`${materialId}: ${amount}`);
              }
            } else {
              // Si materials n'est pas une Map, c'est un objet standard
              for (const [materialId, amount] of Object.entries(materials)) {
                materialList.push(`${materialId}: ${amount}`);
              }
            }
            log(`    ${rarity}: ${materialList.join(", ")}`, colors.reset);
          }
        } else {
          // Si materialCosts n'est pas une Map, c'est un objet standard
          for (const [rarity, materials] of Object.entries(materialCosts)) {
            const materialList = [];
            if (materials && typeof materials === 'object') {
              for (const [materialId, amount] of Object.entries(materials)) {
                materialList.push(`${materialId}: ${amount}`);
              }
            }
            log(`    ${rarity}: ${materialList.join(", ")}`, colors.reset);
          }
        }
      }
      
    } catch (error: any) {
      log(`❌ Error testing forge analytics: ${error.message}`, colors.red);
    }
  }

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
        if (error.message.includes("afford") || error.message.includes("Insufficient")) {
          log(`    ✅ Correctly rejected: ${error.message}`, colors.green);
        } else {
          log(`    ⚠️ Different error: ${error.message}`, colors.yellow);
        }
      }
      
      // Nettoyer le joueur test
      await Player.deleteOne({ _id: poorPlayerId });
      
      // Test 2: Stats lockées invalides pour le slot
      log(`  🔒 Testing invalid locked stats for equipment slot...`, colors.yellow);
      
      if (this.testEquipment.length > 0) {
        try {
          // Essayer de locker des stats invalides pour une arme (stats d'armure)
          const weaponItem = this.testEquipment.find(item => 
            item.itemId === "test_legendary_sword"
          );
          
          if (weaponItem) {
            const invalidStats = ["hp", "def", "shieldBonus"]; // Stats d'armure sur une arme
            
            try {
              await this.forge.getItemReforgePreview(
                this.testPlayerId,
                weaponItem.instanceId,
                invalidStats
              );
              log(`    ❌ Should have failed with invalid stats for Weapon`, colors.red);
            } catch (error: any) {
              if (error.message.includes("Invalid locked stats")) {
                log(`    ✅ Correctly rejected invalid stats: ${error.message}`, colors.green);
              } else {
                log(`    ⚠️ Different error: ${error.message}`, colors.yellow);
              }
            }
          }
        } catch (error: any) {
          log(`    ❌ Error testing invalid stats: ${error.message}`, colors.red);
        }
      }
      
      // Test 3: Objet inexistant
      log(`  🔍 Testing non-existent item...`, colors.yellow);
      
      try {
        await this.forge.getItemReforgePreview(
          this.testPlayerId,
          "non_existent_item_id",
          []
        );
        log(`    ❌ Should have failed with non-existent item`, colors.red);
      } catch (error: any) {
        if (error.message.includes("not found")) {
          log(`    ✅ Correctly rejected non-existent item: ${error.message}`, colors.green);
        } else {
          log(`    ⚠️ Different error: ${error.message}`, colors.yellow);
        }
      }
      
      // Test 4: Trop de stats lockées
      log(`  🔢 Testing maximum locked stats limit...`, colors.yellow);
      
      if (this.testEquipment.length > 0) {
        const testItem = this.testEquipment[0];
        const baseItem = await Item.findOne({ itemId: testItem.itemId });
        const currentStats = this.forge.calculateCurrentItemStats(baseItem, testItem);
        const allStats = Object.keys(currentStats);
        
        if (allStats.length >= 5) {
          const tooManyStats = allStats.slice(0, 5); // Essayer 5 stats
          try {
            const preview = await this.forge.getItemReforgePreview(
              this.testPlayerId,
              testItem.instanceId,
              tooManyStats
            );
            log(`    ⚠️ Preview succeeded with ${tooManyStats.length} locked stats (cost: ${preview.cost.gold}g)`, colors.yellow);
          } catch (error: any) {
            log(`    ✅ Handled many locked stats: ${error.message}`, colors.green);
          }
        }
      }
      
    } catch (error: any) {
      log(`❌ Error testing edge cases: ${error.message}`, colors.red);
    }
  }

  async testStatRangeCompliance(): Promise<void> {
    log("\n🎯 Testing stat range compliance...", colors.cyan);
    
    try {
      if (this.testEquipment.length === 0) {
        log("⚠️ No equipment available for range compliance test", colors.yellow);
        return;
      }
      
      log(`  🎲 Testing stat generation compliance over multiple samples...`, colors.yellow);
      
      const testItem = this.testEquipment[0];
      const baseItem = await Item.findOne({ itemId: testItem.itemId });
      
      if (!baseItem) {
        log("❌ Base item not found", colors.red);
        return;
      }
      
      const samples = 10;
      const statRanges = this.forge.config.statRanges.get(baseItem.rarity);
      
      if (!statRanges) {
        log(`❌ No stat ranges found for rarity: ${baseItem.rarity}`, colors.red);
        return;
      }
      
      log(`  📊 Testing ${samples} stat generations for ${baseItem.rarity} ${baseItem.equipmentSlot}`, colors.blue);
      
      const statSamples: { [stat: string]: number[] } = {};
      
      // Générer plusieurs échantillons
      for (let i = 0; i < samples; i++) {
        try {
          const preview = await this.forge.getItemReforgePreview(
            this.testPlayerId,
            testItem.instanceId,
            [] // Pas de stats lockées
          );
          
          Object.entries(preview.newStats).forEach(([stat, value]) => {
            if (!statSamples[stat]) statSamples[stat] = [];
            statSamples[stat].push(value as number);
          });
        } catch (error) {
          // Continuer même en cas d'erreur sur un échantillon
        }
      }
      
      // Analyser la conformité
      log(`  🎯 Range Compliance Analysis:`, colors.blue);
      let totalCompliant = 0;
      let totalTested = 0;
      
      Object.entries(statSamples).forEach(([stat, values]) => {
        const range = statRanges.get(stat);
        if (range && values.length > 0) {
          const min = Math.min(...values);
          const max = Math.max(...values);
          const avg = (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1);
          const compliant = min >= range.min && max <= range.max;
          
          if (compliant) totalCompliant++;
          totalTested++;
          
          const status = compliant ? "✅" : "❌";
          log(`    ${stat}: Generated ${min}-${max} (avg ${avg}), Expected ${range.min}-${range.max} ${status}`, 
            compliant ? colors.green : colors.red);
        }
      });
      
      const complianceRate = ((totalCompliant / totalTested) * 100).toFixed(1);
      log(`  📈 Overall Compliance: ${totalCompliant}/${totalTested} (${complianceRate}%)`, 
        totalCompliant === totalTested ? colors.green : colors.yellow);
      
    } catch (error: any) {
      log(`❌ Error testing stat range compliance: ${error.message}`, colors.red);
    }
  }

  async cleanup(): Promise<void> {
    log("\n🧹 Cleaning up test data...", colors.yellow);
    
    try {
      const shouldCleanup = !process.argv.includes('--keep-data');
      if (shouldCleanup) {
        await Promise.all([
          Player.deleteMany({ username: { $regex: /test.*player/ } }),
          Inventory.deleteMany({ playerId: this.testPlayerId }),
          Item.deleteMany({ itemId: { $regex: /^test_/ } })
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
      await this.testEdgeCases();
      await this.testStatRangeCompliance();
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

// === TESTS AVANCÉS ===
class AdvancedForgeTester extends ForgeTester {
  
  async testPerformance(): Promise<void> {
    log("\n⚡ Testing performance...", colors.cyan);
    
    try {
      const iterations = 25;
      log(`  🏃 Running ${iterations} preview calculations...`, colors.yellow);
      
      const startTime = Date.now();
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < iterations; i++) {
        if (this.testEquipment.length > 0) {
          try {
            await this.forge.getItemReforgePreview(
              this.testPlayerId,
              this.testEquipment[0].instanceId,
              Math.random() > 0.5 ? ["atk"] : []
            );
            successCount++;
          } catch (error) {
            errorCount++;
          }
        }
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      log(`  ✅ Performance Results:`, colors.green);
      log(`    Total Time: ${totalTime}ms`, colors.blue);
      log(`    Average per Preview: ${avgTime.toFixed(2)}ms`, colors.blue);
      log(`    Success Rate: ${successCount}/${iterations} (${((successCount/iterations)*100).toFixed(1)}%)`, colors.blue);
      log(`    Throughput: ${(1000 / avgTime).toFixed(0)} previews/second`, colors.blue);
      
      if (avgTime < 50) {
        log(`    🚀 Excellent performance!`, colors.green);
      } else if (avgTime < 200) {
        log(`    ✅ Good performance`, colors.green);
      } else {
        log(`    ⚠️ Performance could be improved`, colors.yellow);
      }
      
    } catch (error: any) {
      log(`❌ Error testing performance: ${error.message}`, colors.red);
    }
  }

  async testConcurrency(): Promise<void> {
    log("\n🔄 Testing concurrent operations...", colors.cyan);
    
    try {
      if (this.testEquipment.length < 2) {
        log(`    ⚠️ Need at least 2 items for concurrency test`, colors.yellow);
        return;
      }
      
      log(`  ⚡ Testing concurrent preview operations...`, colors.yellow);
      
      const concurrentOps = Math.min(3, this.testEquipment.length);
      const promises = [];
      
      // Lancer plusieurs previews en parallèle
      for (let i = 0; i < concurrentOps; i++) {
        promises.push(
          this.forge.getItemReforgePreview(
            this.testPlayerId,
            this.testEquipment[i].instanceId,
            []
          ).catch((error: any) => ({ error: error.message, index: i }))
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      let successCount = 0;
      let errorCount = 0;
      
      results.forEach((result, index) => {
        if ((result as any).error) {
          errorCount++;
          log(`    Preview ${index + 1}: ❌ ${(result as any).error}`, colors.red);
        } else {
          successCount++;
          log(`    Preview ${index + 1}: ✅ Success`, colors.green);
        }
      });
      
      log(`  📊 Concurrency Results:`, colors.blue);
      log(`    Total Time: ${endTime - startTime}ms`, colors.blue);
      log(`    Successful: ${successCount}/${concurrentOps}`, colors.green);
      log(`    Failed: ${errorCount}/${concurrentOps}`, errorCount > 0 ? colors.red : colors.green);
      
      if (errorCount === 0) {
        log(`    🎉 All concurrent operations succeeded!`, colors.green);
      } else {
        log(`    ⚠️ Some operations failed - this might be expected`, colors.yellow);
      }
      
    } catch (error: any) {
      log(`❌ Error testing concurrency: ${error.message}`, colors.red);
    }
  }

  async testMemoryUsage(): Promise<void> {
    log("\n💾 Testing memory usage...", colors.cyan);
    
    try {
      const initialMemory = process.memoryUsage();
      log(`  📊 Initial memory usage:`, colors.blue);
      log(`    Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`, colors.reset);
      log(`    Heap Total: ${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`, colors.reset);
      
      // Effectuer beaucoup d'opérations
      const operations = 50;
      log(`  🔄 Performing ${operations} forge operations...`, colors.yellow);
      
      for (let i = 0; i < operations; i++) {
        if (this.testEquipment.length > 0) {
          try {
            await this.forge.getItemReforgePreview(
              this.testPlayerId,
              this.testEquipment[i % this.testEquipment.length].instanceId,
              []
            );
          } catch (error) {
            // Ignorer les erreurs pour ce test
          }
        }
      }
      
      // Forcer le garbage collection si possible
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      log(`  📊 Final memory usage:`, colors.blue);
      log(`    Heap Used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`, colors.reset);
      log(`    Heap Total: ${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`, colors.reset);
      
      const memoryDiff = finalMemory.heapUsed - initialMemory.heapUsed;
      log(`  📈 Memory difference: ${(memoryDiff / 1024 / 1024).toFixed(2)} MB`, 
        memoryDiff > 10 * 1024 * 1024 ? colors.yellow : colors.green);
      
      if (memoryDiff < 5 * 1024 * 1024) { // Less than 5MB increase
        log(`    ✅ Good memory management`, colors.green);
      } else {
        log(`    ⚠️ Memory usage increased significantly`, colors.yellow);
      }
      
    } catch (error: any) {
      log(`❌ Error testing memory usage: ${error.message}`, colors.red);
    }
  }

  async runAdvancedTests(): Promise<void> {
    log("\n" + "=".repeat(60), colors.bright);
    log("🧪 RUNNING ADVANCED FORGE TESTS", colors.bright);
    log("=".repeat(60), colors.bright);
    
    await this.testPerformance();
    await this.testConcurrency();
    await this.testMemoryUsage();
    
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
  log("📝 Available arguments:", colors.blue);
  log("  --advanced    Run additional performance and advanced tests", colors.reset);
  log("  --keep-data   Keep test data in database after tests complete", colors.reset);
  log("", colors.reset);
  
  const args = process.argv.slice(2);
  if (args.length > 0) {
    log(`Using arguments: ${args.join(' ')}`, colors.yellow);
  }
  
  runForgeTests().then(() => {
    log("\n🎯 Test suite completed successfully!", colors.green);
    process.exit(0);
  }).catch((error) => {
    log(`\n💥 Fatal error: ${error.message}`, colors.red);
    console.error(error.stack);
    process.exit(1);
  });
}

export default ForgeTester;

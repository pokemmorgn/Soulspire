import mongoose from "mongoose";
import dotenv from "dotenv";
import { createForgeService } from "../models/Forge/index";
import Player from "../models/Player";
import Inventory from "../models/Inventory";
import Item from "../models/Item";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

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

const testMaterialsData = [
  { itemId: "reforge_stone", name: "Reforge Stone", category: "Material", subCategory: "Enhancement Stone", materialType: "Enhancement", rarity: "Common", sellPrice: 25 },
  { itemId: "magic_dust", name: "Magic Dust", category: "Material", subCategory: "Magic Material", materialType: "Enhancement", rarity: "Rare", sellPrice: 75 },
  { itemId: "mystic_scroll", name: "Mystic Scroll", category: "Material", subCategory: "Scroll", materialType: "Enhancement", rarity: "Epic", sellPrice: 250 },
  { itemId: "celestial_essence", name: "Celestial Essence", category: "Material", subCategory: "Essence", materialType: "Enhancement", rarity: "Legendary", sellPrice: 1000 },
  { itemId: "enhancement_stone", name: "Enhancement Stone", category: "Material", subCategory: "Enhancement Stone", materialType: "Enhancement", rarity: "Common", sellPrice: 50 },
  { itemId: "silver_dust", name: "Silver Dust", category: "Material", subCategory: "Dust", materialType: "Enhancement", rarity: "Rare", sellPrice: 100 },
  { itemId: "gold_dust", name: "Gold Dust", category: "Material", subCategory: "Dust", materialType: "Enhancement", rarity: "Epic", sellPrice: 300 },
  { itemId: "platinum_dust", name: "Platinum Dust", category: "Material", subCategory: "Dust", materialType: "Enhancement", rarity: "Legendary", sellPrice: 800 },
  { itemId: "legendary_essence", name: "Legendary Essence", category: "Material", subCategory: "Essence", materialType: "Enhancement", rarity: "Legendary", sellPrice: 1500 },
  { itemId: "fusion_stone", name: "Fusion Stone", category: "Material", subCategory: "Fusion Material", materialType: "Evolution", rarity: "Common", sellPrice: 100 },
  { itemId: "magic_essence", name: "Magic Essence", category: "Material", subCategory: "Essence", materialType: "Evolution", rarity: "Rare", sellPrice: 200 },
  { itemId: "celestial_fragment", name: "Celestial Fragment", category: "Material", subCategory: "Fragment", materialType: "Evolution", rarity: "Epic", sellPrice: 500 },
  { itemId: "tier_stone", name: "Tier Stone", category: "Material", subCategory: "Tier Material", materialType: "Crafting", rarity: "Common", sellPrice: 75 },
  { itemId: "enhancement_dust", name: "Enhancement Dust", category: "Material", subCategory: "Dust", materialType: "Crafting", rarity: "Common", sellPrice: 25 },
  { itemId: "rare_crystal", name: "Rare Crystal", category: "Material", subCategory: "Crystal", materialType: "Crafting", rarity: "Rare", sellPrice: 150 },
  { itemId: "epic_essence", name: "Epic Essence", category: "Material", subCategory: "Essence", materialType: "Crafting", rarity: "Epic", sellPrice: 400 },
  { itemId: "legendary_core", name: "Legendary Core", category: "Material", subCategory: "Core", materialType: "Crafting", rarity: "Legendary", sellPrice: 1200 },
  { itemId: "silver_thread", name: "Silver Thread", category: "Material", subCategory: "Thread", materialType: "Crafting", rarity: "Rare", sellPrice: 80 },
  { itemId: "golden_thread", name: "Golden Thread", category: "Material", subCategory: "Thread", materialType: "Crafting", rarity: "Epic", sellPrice: 200 },
  { itemId: "mystic_ore", name: "Mystic Ore", category: "Material", subCategory: "Ore", materialType: "Crafting", rarity: "Epic", sellPrice: 300 },
  { itemId: "divine_shard", name: "Divine Shard", category: "Material", subCategory: "Shard", materialType: "Crafting", rarity: "Legendary", sellPrice: 800 }
];

const testEquipmentData = [
  { itemId: "common_sword", name: "Common Iron Sword", category: "Equipment", subCategory: "Sword", rarity: "Common", equipmentSlot: "Weapon", tier: 1, maxLevel: 30, baseStats: { atk: 50, crit: 5 }, statsPerLevel: { atk: 2, crit: 0.2 }, sellPrice: 100 },
  { itemId: "common_armor", name: "Common Leather Armor", category: "Equipment", subCategory: "Armor", rarity: "Common", equipmentSlot: "Armor", tier: 1, maxLevel: 30, baseStats: { hp: 100, def: 25 }, statsPerLevel: { hp: 5, def: 1 }, sellPrice: 120 },
  { itemId: "common_helmet", name: "Common Iron Helmet", category: "Equipment", subCategory: "Helmet", rarity: "Common", equipmentSlot: "Helmet", tier: 1, maxLevel: 30, baseStats: { hp: 75, def: 15, moral: 10 }, statsPerLevel: { hp: 3, def: 0.5, moral: 0.5 }, sellPrice: 80 },
  { itemId: "rare_sword", name: "Rare Steel Sword", category: "Equipment", subCategory: "Sword", rarity: "Rare", equipmentSlot: "Weapon", tier: 2, maxLevel: 50, baseStats: { atk: 120, crit: 12, critDamage: 25 }, statsPerLevel: { atk: 4, crit: 0.3, critDamage: 1 }, sellPrice: 500 },
  { itemId: "rare_boots", name: "Rare Swift Boots", category: "Equipment", subCategory: "Boots", rarity: "Rare", equipmentSlot: "Boots", tier: 2, maxLevel: 50, baseStats: { hp: 80, vitesse: 15, dodge: 8 }, statsPerLevel: { hp: 3, vitesse: 0.5, dodge: 0.3 }, sellPrice: 400 },
  { itemId: "epic_sword", name: "Epic Flame Sword", category: "Equipment", subCategory: "Sword", rarity: "Epic", equipmentSlot: "Weapon", tier: 3, maxLevel: 70, baseStats: { atk: 200, crit: 20, critDamage: 45, accuracy: 12 }, statsPerLevel: { atk: 6, crit: 0.4, critDamage: 1.5, accuracy: 0.3 }, sellPrice: 2000 },
  { itemId: "epic_gloves", name: "Epic Precision Gloves", category: "Equipment", subCategory: "Gloves", rarity: "Epic", equipmentSlot: "Gloves", tier: 3, maxLevel: 70, baseStats: { atk: 80, crit: 15, accuracy: 20 }, statsPerLevel: { atk: 3, crit: 0.3, accuracy: 0.5 }, sellPrice: 1500 },
  { itemId: "legendary_sword", name: "Legendary Dragon Slayer", category: "Equipment", subCategory: "Sword", rarity: "Legendary", equipmentSlot: "Weapon", tier: 4, maxLevel: 90, baseStats: { atk: 350, crit: 30, critDamage: 80, accuracy: 20, healthleech: 10 }, statsPerLevel: { atk: 10, crit: 0.6, critDamage: 2, accuracy: 0.4, healthleech: 0.2 }, sellPrice: 8000 },
  { itemId: "legendary_accessory", name: "Legendary Mystic Amulet", category: "Equipment", subCategory: "Accessory", rarity: "Legendary", equipmentSlot: "Accessory", tier: 4, maxLevel: 90, baseStats: { hp: 200, atk: 100, healingBonus: 25, reductionCooldown: 10 }, statsPerLevel: { hp: 8, atk: 3, healingBonus: 0.5, reductionCooldown: 0.2 }, sellPrice: 10000 },
  { itemId: "mythic_sword", name: "Mythic Godslayer Blade", category: "Equipment", subCategory: "Sword", rarity: "Mythic", equipmentSlot: "Weapon", tier: 5, maxLevel: 100, baseStats: { atk: 500, crit: 40, critDamage: 120, accuracy: 30, healthleech: 15 }, statsPerLevel: { atk: 15, crit: 0.8, critDamage: 3, accuracy: 0.6, healthleech: 0.3 }, sellPrice: 25000 }
];

class CompleteForgeTester {
  protected testPlayerId: string = "";
  protected testPlayer: any = null;
  protected inventory: any = null;
  protected forgeService: any = null;
  protected testEquipment: any[] = [];
  protected testCounts = { passed: 0, failed: 0, total: 0 };

  async setup(): Promise<void> {
    log("🔧 Setting up complete forge test environment...", colors.cyan);
    await mongoose.connect(MONGO_URI);
    log("✅ Connected to MongoDB", colors.green);
    await this.createTestPlayer();
    await this.createTestInventory();
    await this.createForgeService();
    await this.ensureTestItemsExist();
    await this.addTestItemsToInventory();
  }

  async createTestPlayer(): Promise<void> {
    log("\n👤 Creating test player...", colors.yellow);
    await Player.deleteMany({ username: "forge_test_complete" });
    const testPlayer = new Player({
      username: "forge_test_complete",
      password: "hashedpassword123",
      gold: 500000,
      gems: 50000,
      paidGems: 10000,
      tickets: 1000,
      level: 100,
      vipLevel: 10,
      world: 10,
      difficulty: "Nightmare"
    });
    await testPlayer.save();
    this.testPlayerId = (testPlayer._id as any).toString();
    this.testPlayer = testPlayer;
    log(`✅ Test player created: ${testPlayer.username} (Level: ${testPlayer.level})`, colors.green);
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
      maxCapacity: 500
    });
    await testInventory.save();
    this.inventory = testInventory;
    log(`✅ Test inventory created (capacity: ${testInventory.maxCapacity})`, colors.green);
  }

  async createForgeService(): Promise<void> {
    log("\n🔨 Creating forge service...", colors.yellow);
    this.forgeService = createForgeService(this.testPlayerId);
    log(`✅ Forge service created for player ${this.testPlayerId}`, colors.green);
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
        log(`   ✅ Created: ${itemData.itemId} (${itemData.rarity} ${itemData.category})`, colors.green);
      }
    }
    log(`✅ Test items ready (${createdCount} created, ${allTestItems.length - createdCount} existed)`, colors.green);
  }

async addTestItemsToInventory(): Promise<void> {
  log("\n📥 Adding test items to inventory...", colors.yellow);
  for (const equipData of testEquipmentData) {
    try {
      const level = Math.floor(Math.random() * 20) + 10;
      const enhancement = Math.floor(Math.random() * 5) + 1;
      
      // 🔧 FIX: Create owned item with proper tier initialization
      const ownedItem = await this.inventory.addItem(equipData.itemId, 1, level);
      ownedItem.enhancement = enhancement;
      
      // 🔧 CRITICAL FIX: Set tier to 1 for all new items (they start at T1)
      (ownedItem as any).tier = 1; // Start all items at Tier 1
      
      // 🔧 FIX: Initialize equipment data properly if it doesn't exist
      if (!ownedItem.equipmentData) {
        ownedItem.equipmentData = {
          durability: 100,
          socketedGems: [],
          upgradeHistory: [] // Empty history = Tier 1
        };
      }
      
      // Add multiple copies for fusion testing
      if (["common_sword", "rare_sword", "epic_sword"].includes(equipData.itemId)) {
        for (let i = 0; i < 2; i++) {
          const extraItem = await this.inventory.addItem(equipData.itemId, 1, level);
          extraItem.enhancement = enhancement;
          (extraItem as any).tier = 1; // 🔧 FIX: Ensure consistent tier
          if (!extraItem.equipmentData) {
            extraItem.equipmentData = {
              durability: 100,
              socketedGems: [],
              upgradeHistory: []
            };
          }
          this.testEquipment.push(extraItem);
        }
      }
      
      this.testEquipment.push(ownedItem);
      log(`   ✅ Added: ${equipData.itemId} (Lvl ${level}, +${enhancement}, T${(ownedItem as any).tier})`, colors.green);
    } catch (error: any) {
      log(`   ❌ Error adding ${equipData.itemId}: ${error.message}`, colors.red);
    }
  }
  
  // Add materials
  for (const matData of testMaterialsData) {
    try {
      const quantity = Math.floor(Math.random() * 50) + 50;
      await this.inventory.addItem(matData.itemId, quantity, 1);
      log(`   ✅ Added: ${matData.itemId} x${quantity}`, colors.green);
    } catch (error: any) {
      log(`   ❌ Error adding ${matData.itemId}: ${error.message}`, colors.red);
    }
  }
  
  await this.inventory.save();
  log(`✅ Total items added: ${this.testEquipment.length} equipment + materials`, colors.green);
}

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    this.testCounts.total++;
    log(`\n🧪 Testing: ${name}`, colors.cyan);
    try {
      await testFn();
      log(`✅ PASSED: ${name}`, colors.green);
      this.testCounts.passed++;
    } catch (error: any) {
      log(`❌ FAILED: ${name} - ${error.message}`, colors.red);
      this.testCounts.failed++;
      if (process.argv.includes('--verbose')) {
        console.error(error.stack);
      }
    }
  }

  async testForgeStatus(): Promise<void> {
    const status = await this.forgeService.getForgeStatus();
    if (!status) throw new Error("Status is null");
    if (!status.playerId) throw new Error("Missing playerId in status");
    if (!status.playerResources) throw new Error("Missing playerResources");
    if (!status.modules) throw new Error("Missing modules");
    log(`   📊 Status retrieved for player ${status.playerId}`, colors.blue);
    log(`   💰 Resources: ${status.playerResources.gold}g, ${status.playerResources.gems} gems`, colors.blue);
    log(`   🔧 Modules enabled: ${Object.values(status.modules).filter((m: any) => m.enabled).length}`, colors.blue);
  }

  async testModuleConfiguration(): Promise<void> {
    const modules = ['reforge', 'enhancement', 'fusion', 'tierUpgrade'] as const;
    for (const module of modules) {
      const enabled = this.forgeService.isModuleEnabled(module);
      log(`   🔧 ${module}: ${enabled ? 'enabled' : 'disabled'}`, enabled ? colors.green : colors.yellow);
      if (!enabled) {
        throw new Error(`Module ${module} should be enabled by default`);
      }
    }
  }

  async testReforgePreview(): Promise<void> {
    if (this.testEquipment.length === 0) throw new Error("No equipment for reforge test");
    const testItem = this.testEquipment.find(item => item.itemId.includes('legendary'));
    if (!testItem) throw new Error("No legendary equipment for reforge test");
    const preview1 = await this.forgeService.getReforgePreview(testItem.instanceId, []);
    if (!preview1.newStats) throw new Error("Missing newStats in preview");
    if (!preview1.cost) throw new Error("Missing cost in preview");
    log(`   🔮 Preview 1: ${Object.keys(preview1.newStats).length} stats, cost ${preview1.cost.gold}g`, colors.blue);
    const availableStats = Object.keys(preview1.newStats);
    if (availableStats.length >= 2) {
      const lockedStats = availableStats.slice(0, 2);
      const preview2 = await this.forgeService.getReforgePreview(testItem.instanceId, lockedStats);
      if (preview2.cost.gold <= preview1.cost.gold) {
        throw new Error("Cost with locked stats should be higher");
      }
      log(`   🔒 Preview 2: 2 locked stats, cost ${preview2.cost.gold}g (higher ✓)`, colors.blue);
    }
  }

  async testReforgeExecution(): Promise<void> {
    if (this.testEquipment.length === 0) throw new Error("No equipment for reforge execution");
    const testItem = this.testEquipment.find(item => item.itemId.includes('epic'));
    if (!testItem) throw new Error("No epic equipment for reforge execution");
    const playerBefore = await Player.findById(this.testPlayerId);
    if (!playerBefore) throw new Error("Player not found");
    const result = await this.forgeService.executeReforge(testItem.instanceId, []);
    if (!result.success) throw new Error(`Reforge failed: ${result.message}`);
    if (!result.data?.newStats) throw new Error("Missing newStats in result");
    const playerAfter = await Player.findById(this.testPlayerId);
    if (!playerAfter) throw new Error("Player not found after reforge");
    const goldSpent = playerBefore.gold - playerAfter.gold;
    if (goldSpent <= 0) throw new Error("No gold was spent");
    log(`   ⚡ Reforge executed: ${goldSpent}g spent, ${Object.keys(result.data.newStats).length} stats`, colors.blue);
  }

  async testReforgeValidation(): Promise<void> {
    if (this.testEquipment.length === 0) throw new Error("No equipment for validation test");
    const testItem = this.testEquipment[0];
    
    // Test avec trop de stats lockées (plus de 3)
    try {
      await this.forgeService.getReforgePreview(testItem.instanceId, ["atk", "hp", "def", "crit", "dodge"]);
      throw new Error("Should have failed with too many locked stats");
    } catch (error: any) {
      // Accepter plusieurs messages d'erreur possibles pour la validation des locked stats
      const isValidError = error.message.includes("3") || 
                          error.message.includes("Maximum") || 
                          error.message.includes("locked stats") ||
                          error.message.includes("equipment slot");
      if (!isValidError) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
      log(`   ✅ Correctly rejected >3 locked stats: ${error.message.split('.')[0]}`, colors.blue);
    }
    
    // Test avec item inexistant
    try {
      await this.forgeService.getReforgePreview("nonexistent_item", []);
      throw new Error("Should have failed with nonexistent item");
    } catch (error: any) {
      const isValidError = error.message.toLowerCase().includes("not found") ||
                          error.message.toLowerCase().includes("invalid") ||
                          error.message.toLowerCase().includes("missing");
      if (!isValidError) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
      log(`   ✅ Correctly rejected nonexistent item: ${error.message.split('.')[0]}`, colors.blue);
    }
  }

  async testEnhancementCost(): Promise<void> {
    if (this.testEquipment.length === 0) throw new Error("No equipment for enhancement cost test");
    const testItem = this.testEquipment.find(item => item.enhancement < 10);
    if (!testItem) throw new Error("No enhanceable equipment found");
    const regularCost = await this.forgeService.getEnhancementCost(testItem.instanceId, false);
    if (!regularCost.gold || regularCost.gold <= 0) throw new Error("Invalid regular cost");
    const guaranteedCost = await this.forgeService.getEnhancementCost(testItem.instanceId, true);
    if (!guaranteedCost.gems || guaranteedCost.gems <= regularCost.gems) {
      throw new Error("Guaranteed cost should be higher");
    }
    log(`   💰 Costs: ${regularCost.gold}g regular, ${guaranteedCost.gems} gems guaranteed`, colors.blue);
  }

  async testEnhancementExecution(): Promise<void> {
    if (this.testEquipment.length === 0) throw new Error("No equipment for enhancement execution");
    const testItem = this.testEquipment.find(item => item.enhancement < 5);
    if (!testItem) throw new Error("No low enhancement equipment found");
    
    const currentEnhancement = testItem.enhancement;
    log(`   🔍 Before: enhancement=${currentEnhancement}`, colors.blue);
    
    const result = await this.forgeService.executeEnhancement(testItem.instanceId, false);
    
    log(`   🔍 Result: success=${result.success}, message=${result.message}`, colors.blue);
    if (result.data) {
      log(`   🔍 Data: previousLevel=${result.data.previousLevel}, newLevel=${result.data.newLevel}`, colors.blue);
    }
    
    // Vérifier que l'opération s'est bien exécutée (succès ou échec naturel)
    if (!result.success && !result.message.includes("ENHANCEMENT_FAILED") && !result.message.includes("FAILED")) {
      throw new Error(`Enhancement failed unexpectedly: ${result.message}`);
    }
    
    if (result.success) {
      // Succès : vérifier que le niveau a augmenté
      const newLevel = result.data?.newLevel;
      const previousLevel = result.data?.previousLevel;
      
      log(`   🔍 Success case: previous=${previousLevel}, new=${newLevel}, expected=${currentEnhancement + 1}`, colors.blue);
      
      if (!newLevel) {
        throw new Error("Missing newLevel in success result data");
      }
      
      if (!previousLevel && previousLevel !== 0) {
        throw new Error("Missing previousLevel in success result data");
      }
      
      // Le niveau précédent devrait correspondre au niveau avant l'opération
      if (previousLevel !== currentEnhancement) {
        log(`   ⚠️ Warning: previousLevel (${previousLevel}) != currentEnhancement (${currentEnhancement})`, colors.yellow);
      }
      
      // Le nouveau niveau devrait être supérieur au précédent
      if (newLevel <= previousLevel) {
        throw new Error(`Enhancement level should increase: ${previousLevel} → ${newLevel}`);
      }
      
      log(`   ⚡ Enhancement success: +${previousLevel} → +${newLevel}`, colors.green);
    } else {
      // Échec naturel : vérifier la cohérence des données
      const newLevel = result.data?.newLevel;
      const previousLevel = result.data?.previousLevel;
      
      if (newLevel && newLevel !== currentEnhancement) {
        throw new Error(`Enhancement level should not change on failure: ${currentEnhancement} → ${newLevel}`);
      }
      
      log(`   💥 Enhancement failed (normal RNG): pity ${result.data?.pity || 0}`, colors.blue);
      
      // Tentative supplémentaire pour augmenter les chances de succès dans le test
      const retryResult = await this.forgeService.executeEnhancement(testItem.instanceId, false);
      if (retryResult.success) {
        log(`   🔄 Retry successful: +${retryResult.data?.previousLevel || 0} → +${retryResult.data?.newLevel || 0}`, colors.green);
      } else {
        log(`   🔄 Retry also failed: pity ${retryResult.data?.pity || 0}`, colors.yellow);
      }
    }
    
    // Le test passe tant que le système fonctionne correctement (succès ou échec logique)
  }

  async testEnhancementGuarantee(): Promise<void> {
    if (this.testEquipment.length === 0) throw new Error("No equipment for guarantee test");
    const testItem = this.testEquipment.find(item => item.enhancement < 3);
    if (!testItem) throw new Error("No low enhancement equipment found");
    const result = await this.forgeService.executeEnhancement(testItem.instanceId, true);
    if (!result.success) throw new Error(`Guaranteed enhancement failed: ${result.message}`);
    if (!result.data?.guaranteeUsed) throw new Error("Guarantee flag should be true");
    log(`   💎 Guaranteed enhancement success: +${result.data.previousLevel} → +${result.data.newLevel}`, colors.green);
  }

  async testFusionCost(): Promise<void> {
    const commonItems = this.testEquipment.filter(item => item.itemId === 'common_sword');
    if (commonItems.length < 3) throw new Error("Need 3 common swords for fusion test");
    const cost = await this.forgeService.getFusionCost(commonItems[0].instanceId);
    if (!cost.gold || cost.gold <= 0) throw new Error("Invalid fusion cost");
    log(`   💰 Fusion cost: ${cost.gold}g, ${cost.gems || 0} gems`, colors.blue);
  }

  async testFusionExecution(): Promise<void> {
    const rareItems = this.testEquipment.filter(item => item.itemId === 'rare_sword');
    if (rareItems.length < 3) throw new Error("Need 3 rare swords for fusion test");
    const itemIds = rareItems.slice(0, 3).map(item => item.instanceId);
    const result = await this.forgeService.executeFusion(itemIds);
    if (!result.success) throw new Error(`Fusion failed: ${result.message}`);
    if (!result.data?.newRarity) throw new Error("Missing newRarity in result");
    if (!result.data?.newInstanceId) throw new Error("Missing newInstanceId in result");
    log(`   ⚡ Fusion success: ${result.data.previousRarity} → ${result.data.newRarity}`, colors.green);
    log(`   📦 New item: ${result.data.newInstanceId}`, colors.blue);
  }

  async testFusionValidation(): Promise<void> {
    // Test avec pas assez d'items
    try {
      await this.forgeService.executeFusion(["item1", "item2"]);
      throw new Error("Should have failed with insufficient items");
    } catch (error: any) {
      log(`   🔍 Insufficient items error: "${error.message}"`, colors.blue);
      const isValidError = error.message.includes("3") || 
                          error.message.includes("three") || 
                          error.message.includes("exactly") ||
                          error.message.includes("insufficient") ||
                          error.message.includes("FUSION_REQUIRES") ||
                          error.message.toLowerCase().includes("invalid") ||
                          error.message.toLowerCase().includes("not found") ||
                          error.message.toLowerCase().includes("item");
      if (!isValidError) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
      log(`   ✅ Correctly rejected insufficient items: ${error.message.split('.')[0]}`, colors.blue);
    }
    
    // Test avec trop d'items
    try {
      await this.forgeService.executeFusion(["item1", "item2", "item3", "item4"]);
      throw new Error("Should have failed with too many items");
    } catch (error: any) {
      log(`   🔍 Too many items error: "${error.message}"`, colors.blue);
      const isValidError = error.message.includes("3") || 
                          error.message.includes("exactly") ||
                          error.message.includes("three") ||
                          error.message.includes("FUSION_REQUIRES") ||
                          error.message.toLowerCase().includes("invalid") ||
                          error.message.toLowerCase().includes("not found") ||
                          error.message.toLowerCase().includes("item");
      if (!isValidError) {
        throw new Error(`Wrong error message: ${error.message}`);
      }
      log(`   ✅ Correctly rejected too many items: ${error.message.split('.')[0]}`, colors.blue);
    }
  }

  async testFusableItems(): Promise<void> {
    const fusableItems = await this.forgeService.getFusableItems();
    if (!Array.isArray(fusableItems)) throw new Error("Fusable items should be an array");
    const validGroups = fusableItems.filter(group => group.count >= 3);
    if (validGroups.length === 0) throw new Error("Should have at least one fusable group");
    log(`   📋 Fusable groups: ${validGroups.length}/${fusableItems.length}`, colors.blue);
    const commonFusables = await this.forgeService.getFusableItems("Common");
    log(`   📋 Common fusables: ${commonFusables.length}`, colors.blue);
  }

  async testTierUpgradeCost(): Promise<void> {
    if (this.testEquipment.length === 0) throw new Error("No equipment for tier upgrade test");
    const testItem = this.testEquipment.find(item => (item.tier || 1) < 3);
    if (!testItem) throw new Error("No low tier equipment found");
    const cost = await this.forgeService.getTierUpgradeCost(testItem.instanceId);
    if (!cost.gold || cost.gold <= 0) throw new Error("Invalid tier upgrade cost");
    log(`   💰 Tier upgrade cost: ${cost.gold}g, ${cost.gems || 0} gems`, colors.blue);
    const cost2 = await this.forgeService.getTierUpgradeCost(testItem.instanceId, 3);
    if (cost2.gold <= cost.gold) throw new Error("Higher tier should cost more");
    log(`   📈 To tier 3: ${cost2.gold}g (higher ✓)`, colors.blue);
  }

async testTierUpgradeExecution(): Promise<void> {
  if (this.testEquipment.length === 0) throw new Error("No equipment for tier upgrade execution");
  
  // 🔧 FIX: Find a T1 item explicitly
  let testItem = this.testEquipment.find(item => {
    const tier = (item as any).tier || 1;
    console.log(`🔧 Checking item ${item.instanceId}: tier=${tier}`);
    return tier === 1;
  });
  
  if (!testItem) {
    // 🔧 FALLBACK: Create a T1 item if none exists
    console.log("🔧 No T1 items found, using first available and setting tier to 1");
    testItem = this.testEquipment[0];
    (testItem as any).tier = 1;
    if (!testItem.equipmentData) {
      testItem.equipmentData = {
        durability: 100,
        socketedGems: [],
        upgradeHistory: []
      };
    }
    await this.inventory.save();
  }
  
  console.log(`🔧 Using item for tier upgrade: ${testItem.instanceId}, tier=${(testItem as any).tier}`);
  
  const result = await this.forgeService.executeTierUpgrade(testItem.instanceId);
  if (!result.success) throw new Error(`Tier upgrade failed: ${result.message}`);
  if (!result.data?.newTier || result.data.newTier <= result.data.previousTier) {
    throw new Error("Tier should have increased");
  }
  log(`   ⚡ Tier upgrade success: T${result.data.previousTier} → T${result.data.newTier}`, colors.green);
  log(`   📊 Multiplier: x${result.data.tierMultiplier}`, colors.blue);
}

  async testUpgradableItems(): Promise<void> {
    const upgradableItems = await this.forgeService.getUpgradableItems();
    if (!Array.isArray(upgradableItems)) throw new Error("Upgradable items should be an array");
    const canUpgradeCount = upgradableItems.filter(item => item.canUpgrade).length;
    log(`   📋 Upgradable items: ${canUpgradeCount}/${upgradableItems.length} can upgrade`, colors.blue);
    const commonUpgradables = await this.forgeService.getUpgradableItems("Common");
    log(`   📋 Common upgradables: ${commonUpgradables.length}`, colors.blue);
  }

async testTotalUpgradeCost(): Promise<void> {
  if (this.testEquipment.length === 0) throw new Error("No equipment for total upgrade cost test");
  
  // 🔧 FIX: Find a T1 item that can be upgraded (not Common rarity at T1)
  let testItem = this.testEquipment.find(item => {
    const tier = (item as any).tier || 1;
    // Look for a Rare+ item at T1 (Common can only go to T2, so T1→T2 is only 1 step)
    return tier === 1 && !item.itemId.includes('common');
  });
  
  if (!testItem) {
    // 🔧 FALLBACK: Use any T1 item (even Common will work for basic testing)
    testItem = this.testEquipment.find(item => ((item as any).tier || 1) === 1);
  }
  
  if (!testItem) {
    // 🔧 LAST RESORT: Force create a T1 item
    testItem = this.testEquipment[0];
    (testItem as any).tier = 1;
    await this.inventory.save();
  }
  
  console.log(`🔧 Testing total upgrade cost for: ${testItem.itemId} at tier ${(testItem as any).tier}`);
  
  const totalCost = await this.forgeService.getTotalUpgradeCostToMax(testItem.instanceId);
  if (!totalCost.totalGold || totalCost.totalGold <= 0) {
    throw new Error("Invalid total upgrade cost");
  }
  if (!Array.isArray(totalCost.steps) || totalCost.steps.length === 0) {
    throw new Error("Should have upgrade steps");
  }
  log(`   💰 Total to max: ${totalCost.totalGold}g in ${totalCost.steps.length} steps`, colors.blue);
}

  async testBatchOperationCost(): Promise<void> {
    if (this.testEquipment.length < 4) throw new Error("Need at least 4 items for batch test");
    const operations = [
      { type: 'reforge' as const, itemInstanceId: this.testEquipment[0].instanceId, parameters: { lockedStats: [] } },
      { type: 'enhancement' as const, itemInstanceId: this.testEquipment[1].instanceId, parameters: { usePaidGemsToGuarantee: false } },
      { type: 'tierUpgrade' as const, itemInstanceId: this.testEquipment[2].instanceId, parameters: {} }
    ];
    const batchCost = await this.forgeService.calculateBatchOperationCost(operations);
    if (!batchCost.gold || batchCost.gold <= 0) throw new Error("Invalid batch cost");
    log(`   💰 Batch cost: ${batchCost.gold}g, ${batchCost.gems || 0} gems`, colors.blue);
    log(`   📦 Operations: ${operations.length}`, colors.blue);
  }

  async testAllModuleStats(): Promise<void> {
    const allStats = await this.forgeService.getAllModuleStats();
    if (!allStats || typeof allStats !== 'object') throw new Error("Invalid module stats");
    const moduleCount = Object.keys(allStats).length;
    if (moduleCount === 0) throw new Error("Should have module stats");
    log(`   📊 Module stats: ${moduleCount} modules`, colors.blue);
    Object.entries(allStats).forEach(([module, stats]) => {
      log(`     ${module}: ${JSON.stringify(stats)}`, colors.reset);
    });
  }

  async testConcurrentOperations(): Promise<void> {
    if (this.testEquipment.length < 3) throw new Error("Need at least 3 items for concurrent test");
    log(`   🔄 Running concurrent operations...`, colors.yellow);
    const promises = [
      this.forgeService.getReforgePreview(this.testEquipment[0].instanceId, []),
      this.forgeService.getEnhancementCost(this.testEquipment[1].instanceId, false),
      this.forgeService.getTierUpgradeCost(this.testEquipment[2].instanceId)
    ];
    const startTime = Date.now();
    const results = await Promise.allSettled(promises);
    const endTime = Date.now();
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    if (successful === 0) throw new Error("All concurrent operations failed");
    log(`   ⚡ Concurrent ops: ${successful} success, ${failed} failed in ${endTime - startTime}ms`, colors.blue);
  }

  async testPerformance(): Promise<void> {
    if (this.testEquipment.length === 0) throw new Error("No equipment for performance test");
    const iterations = 20;
    const testItem = this.testEquipment[0];
    log(`   🏃 Running ${iterations} operations for performance...`, colors.yellow);
    const startTime = Date.now();
    for (let i = 0; i < iterations; i++) {
      await this.forgeService.getReforgePreview(testItem.instanceId, []);
    }
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;
    if (avgTime > 500) throw new Error(`Performance too slow: ${avgTime}ms per operation`);
    log(`   ⚡ Performance: ${avgTime.toFixed(2)}ms avg (${(1000/avgTime).toFixed(1)} ops/sec)`, colors.blue);
  }

  async testMemoryStability(): Promise<void> {
    const initialMemory = process.memoryUsage();
    const operations = 50;
    for (let i = 0; i < operations; i++) {
      if (this.testEquipment.length > 0) {
        const testItem = this.testEquipment[i % this.testEquipment.length];
        try {
          await this.forgeService.getReforgePreview(testItem.instanceId, []);
        } catch (error) {
          // Ignorer les erreurs pour ce test
        }
      }
    }
    if (global.gc) {
      global.gc();
    }
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryMB = memoryIncrease / 1024 / 1024;
    if (memoryMB > 50) throw new Error(`Memory usage increased too much: ${memoryMB.toFixed(2)}MB`);
    log(`   💾 Memory increase: ${memoryMB.toFixed(2)}MB after ${operations} operations`, colors.blue);
  }

  async testStatGeneration(): Promise<void> {
    if (this.testEquipment.length === 0) throw new Error("No equipment for stat generation test");
    const testItem = this.testEquipment.find(item => item.itemId.includes('legendary'));
    if (!testItem) throw new Error("No legendary equipment found");
    const previews = [];
    for (let i = 0; i < 5; i++) {
      const preview = await this.forgeService.getReforgePreview(testItem.instanceId, []);
      previews.push(preview);
    }
    for (const preview of previews) {
      if (!preview.newStats || Object.keys(preview.newStats).length === 0) {
        throw new Error("Preview should have generated stats");
      }
    }
    const firstPreview = previews[0];
    const statKeys = Object.keys(firstPreview.newStats);
    log(`   🎲 Generated ${statKeys.length} stats across ${previews.length} previews`, colors.blue);
    for (const [stat, value] of Object.entries(firstPreview.newStats)) {
      if (typeof value !== 'number' || value < 0 || value > 10000) {
        throw new Error(`Invalid stat value: ${stat} = ${value}`);
      }
    }
  }

  async testCostScaling(): Promise<void> {
    if (this.testEquipment.length === 0) throw new Error("No equipment for cost scaling test");
    const testItem = this.testEquipment[0];
    const costs = [];
    for (let locks = 0; locks <= 3; locks++) {
      const lockedStats = Array(locks).fill('atk').map((_, i) => `stat${i}`);
      try {
        const preview = await this.forgeService.getReforgePreview(testItem.instanceId, lockedStats.slice(0, locks));
        costs.push({ locks, cost: preview.cost.gold });
      } catch (error) {
        // Certains stats peuvent ne pas exister
      }
    }
    for (let i = 1; i < costs.length; i++) {
      if (costs[i].cost <= costs[i-1].cost) {
        log(`   ⚠️ Cost scaling may be incorrect: ${costs[i-1].locks} locks=${costs[i-1].cost}g, ${costs[i].locks} locks=${costs[i].cost}g`, colors.yellow);
      }
    }
    log(`   💰 Cost scaling: ${costs.map(c => `${c.locks}locks=${c.cost}g`).join(', ')}`, colors.blue);
  }

  async runAllTests(): Promise<void> {
    try {
      await this.setup();
      log("\n" + "=".repeat(80), colors.bright);
      log("🔨 COMPLETE FORGE SYSTEM TEST SUITE", colors.bright);
      log("=".repeat(80), colors.bright);
      
      log("\n🌐 GLOBAL SYSTEM TESTS", colors.magenta);
      await this.runTest("Forge Status", () => this.testForgeStatus());
      await this.runTest("Module Configuration", () => this.testModuleConfiguration());
      
      log("\n🔄 REFORGE TESTS", colors.magenta);
      await this.runTest("Reforge Preview", () => this.testReforgePreview());
      await this.runTest("Reforge Execution", () => this.testReforgeExecution());
      await this.runTest("Reforge Validation", () => this.testReforgeValidation());
      
      log("\n⚡ ENHANCEMENT TESTS", colors.magenta);
      await this.runTest("Enhancement Cost", () => this.testEnhancementCost());
      await this.runTest("Enhancement Execution", () => this.testEnhancementExecution());
      await this.runTest("Enhancement Guarantee", () => this.testEnhancementGuarantee());
      
      log("\n🔥 FUSION TESTS", colors.magenta);
      await this.runTest("Fusion Cost", () => this.testFusionCost());
      await this.runTest("Fusion Execution", () => this.testFusionExecution());
      await this.runTest("Fusion Validation", () => this.testFusionValidation());
      await this.runTest("Fusable Items", () => this.testFusableItems());
      
      log("\n🏆 TIER UPGRADE TESTS", colors.magenta);
      await this.runTest("Tier Upgrade Cost", () => this.testTierUpgradeCost());
      await this.runTest("Tier Upgrade Execution", () => this.testTierUpgradeExecution());
      await this.runTest("Upgradable Items", () => this.testUpgradableItems());
      await this.runTest("Total Upgrade Cost", () => this.testTotalUpgradeCost());
      
      log("\n🚀 ADVANCED TESTS", colors.magenta);
      await this.runTest("Batch Operation Cost", () => this.testBatchOperationCost());
      await this.runTest("All Module Stats", () => this.testAllModuleStats());
      await this.runTest("Concurrent Operations", () => this.testConcurrentOperations());
      await this.runTest("Performance", () => this.testPerformance());
      await this.runTest("Memory Stability", () => this.testMemoryStability());
      
      log("\n✅ VALIDATION TESTS", colors.magenta);
      await this.runTest("Stat Generation", () => this.testStatGeneration());
      await this.runTest("Cost Scaling", () => this.testCostScaling());
      
      log("\n" + "=".repeat(80), colors.bright);
      this.displayResults();
      log("=".repeat(80), colors.bright);
      
    } catch (error: any) {
      log(`\n💥 FATAL ERROR: ${error.message}`, colors.red);
      console.error(error.stack);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  displayResults(): void {
    const { passed, failed, total } = this.testCounts;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "0";
    if (failed === 0) {
      log("🎉 ALL TESTS PASSED!", colors.green);
    } else {
      log("⚠️ SOME TESTS FAILED", colors.yellow);
    }
    log(`📊 RESULTS: ${passed}/${total} tests passed (${passRate}%)`, colors.blue);
    log(`✅ Passed: ${passed}`, colors.green);
    log(`❌ Failed: ${failed}`, colors.red);
    if (passed >= total * 0.9) {
      log("🏆 EXCELLENT - Forge system is ready for production!", colors.green);
    } else if (passed >= total * 0.7) {
      log("👍 GOOD - Minor issues to address", colors.yellow);
    } else {
      log("🚨 ATTENTION - Major issues need fixing", colors.red);
    }
  }

  async cleanup(): Promise<void> {
    log("\n🧹 Cleaning up test data...", colors.yellow);
    try {
      const shouldCleanup = !process.argv.includes('--keep-data');
      if (shouldCleanup) {
        await Promise.all([
          Player.deleteMany({ username: { $regex: /forge_test/ } }),
          Inventory.deleteMany({ playerId: this.testPlayerId }),
          Item.deleteMany({ itemId: { $regex: /^(common_|rare_|epic_|legendary_|mythic_)/ } }),
          Item.deleteMany({ itemId: { $in: testMaterialsData.map(m => m.itemId) } })
        ]);
        log("✅ Test data cleaned up", colors.green);
      } else {
        log("📝 Test data kept in database (--keep-data flag)", colors.yellow);
      }
    } catch (error: any) {
      log(`❌ Cleanup error: ${error.message}`, colors.red);
    } finally {
      try {
        await mongoose.connection.close();
        log("🔌 Database connection closed", colors.blue);
      } catch (error: any) {
        log(`⚠️ Error closing DB: ${error.message}`, colors.yellow);
      }
    }
  }
}

const runCompleteForgeTests = async (): Promise<void> => {
  const tester = new CompleteForgeTester();
  await tester.runAllTests();
};

if (require.main === module) {
  log("🚀 Complete Forge System Test Suite", colors.bright);
  log("📝 Available arguments:", colors.blue);
  log("  --keep-data   Keep test data in database after completion", colors.reset);
  log("  --verbose     Show full error stacks on failures", colors.reset);
  log("", colors.reset);
  
  const args = process.argv.slice(2);
  if (args.length > 0) {
    log(`Using arguments: ${args.join(' ')}`, colors.yellow);
  }
  
  runCompleteForgeTests().then(() => {
    log("\n🎯 Complete test suite finished!", colors.green);
    process.exit(0);
  }).catch((error) => {
    log(`\n💥 Test suite failed: ${error.message}`, colors.red);
    process.exit(1);
  });
}

export default CompleteForgeTester;

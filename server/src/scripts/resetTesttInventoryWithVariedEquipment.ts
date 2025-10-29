import mongoose from "mongoose";
import dotenv from "dotenv";
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

/**
 * Script pour reset l'inventaire de testt et ajouter des équipements variés
 * PERMET LES DUPLICATAS : Si il n'y a pas assez d'items différents dans un slot,
 * le script ajoutera plusieurs fois le même item avec des stats différentes
 */
async function resetTesttInventoryWithVariedEquipment() {
  await mongoose.connect(MONGO_URI);
  log("✅ Connected to MongoDB", colors.green);

  try {
    // 1. TROUVER LE JOUEUR TESTT
    log("\n🔍 Searching for player 'testt'...", colors.cyan);
    
    const players = await Player.find({ displayName: "testt" });
    
    if (players.length === 0) {
      log("❌ No player found with displayName: testt", colors.red);
      process.exit(1);
    }

    if (players.length > 1) {
      log(`⚠️ Found ${players.length} players with displayName "testt"`, colors.yellow);
      players.forEach((p, i) => {
        log(`  ${i + 1}. ID: ${p._id}, DisplayName: ${p.displayName}`, colors.reset);
      });
      log("Using the FIRST player found...\n", colors.yellow);
    }

    const player = players[0];
    log(`✅ Player found: ${player.displayName} (ID: ${player._id})`, colors.green);

    // 2. SUPPRIMER L'INVENTAIRE EXISTANT
    log("\n🗑️ Deleting existing inventory...", colors.yellow);
    
    const deleteResult = await Inventory.deleteMany({ playerId: player._id });
    log(`✅ Deleted ${deleteResult.deletedCount} existing inventory records`, colors.green);

    // 3. CRÉER UN NOUVEL INVENTAIRE
    log("\n📦 Creating new inventory...", colors.cyan);
    
    const newInventory = new Inventory({
      playerId: player._id,
      serverId: player.serverId,
      gold: player.gold || 0,
      gems: player.gems || 0,
      paidGems: player.paidGems || 0,
      tickets: player.tickets || 0,
      maxCapacity: 500,
      storage: {
        weapons: [],
        helmets: [],
        armors: [],
        boots: [],
        gloves: [],
        accessories: [],
        potions: [],
        scrolls: [],
        enhancementItems: [],
        enhancementMaterials: [],
        evolutionMaterials: [],
        craftingMaterials: [],
        awakeningMaterials: [],
        heroFragments: new Map(),
        specialCurrencies: new Map(),
        artifacts: []
      }
    });

    await newInventory.save();
    log("✅ New inventory created successfully", colors.green);

    // 4. DÉFINIR LES SLOTS D'ÉQUIPEMENT
    const equipmentSlots = [
      { slot: "Weapon", category: "weapons", count: 5 },
      { slot: "Helmet", category: "helmets", count: 4 },
      { slot: "Armor", category: "armors", count: 5 },
      { slot: "Boots", category: "boots", count: 4 },
      { slot: "Gloves", category: "gloves", count: 4 },
      { slot: "Accessory", category: "accessories", count: 5 }
    ];

    log("\n⚔️ Adding varied equipment by slot...", colors.cyan);

    let totalAdded = 0;
    let totalErrors = 0;

    // 5. POUR CHAQUE SLOT, AJOUTER DES ÉQUIPEMENTS VARIÉS
    for (const slotConfig of equipmentSlots) {
      log(`\n📋 Processing ${slotConfig.slot} (target: ${slotConfig.count} items)...`, colors.blue);

      try {
        // Récupérer tous les équipements de ce slot
        const availableItems = await Item.find({
          category: "Equipment",
          equipmentSlot: slotConfig.slot
        }).sort({ rarity: 1, tier: 1 });

        if (availableItems.length === 0) {
          log(`  ⚠️ No ${slotConfig.slot} found in database`, colors.yellow);
          continue;
        }

        log(`  📊 Found ${availableItems.length} available ${slotConfig.slot}s`, colors.reset);

        // Sélectionner des items variés (différentes raretés et niveaux)
        const selectedItems = selectVariedItems(availableItems, slotConfig.count);

        for (let i = 0; i < selectedItems.length; i++) {
          const item = selectedItems[i];
          
          // Générer des stats variées pour chaque item
          const randomLevel = getRandomLevel(item.rarity);
          const randomEnhancement = getRandomEnhancement(item.rarity);

          try {
            const addedItem = await newInventory.addItem(item.itemId, 1, randomLevel);
            
            // Appliquer l'amélioration
            if (randomEnhancement > 0) {
              addedItem.enhancement = randomEnhancement;
            }

            // Calculer la puissance approximative
            const power = calculateApproximatePower(item, randomLevel, randomEnhancement);

            // Marquer si c'est un duplicata
            const isDuplicate = selectedItems.slice(0, i).some(prevItem => prevItem.itemId === item.itemId);
            const duplicateMarker = isDuplicate ? " [DUPLICATE]" : "";

            log(`    ✅ Added: ${item.name} (Lvl ${randomLevel}, +${randomEnhancement}, ~${power} power) - ${item.rarity}${duplicateMarker}`, colors.green);
            totalAdded++;

          } catch (addError) {
            log(`    ❌ Error adding ${item.itemId}: ${addError instanceof Error ? addError.message : String(addError)}`, colors.red);
            totalErrors++;
          }
        }

      } catch (slotError) {
        log(`  ❌ Error processing ${slotConfig.slot}: ${slotError instanceof Error ? slotError.message : String(slotError)}`, colors.red);
        totalErrors++;
      }
    }

    // 6. SAUVEGARDER L'INVENTAIRE
    await newInventory.save();
    log("\n💾 Inventory saved successfully!", colors.green);

    // 7. AFFICHER LE RÉSUMÉ
    log("\n" + "=".repeat(60), colors.bright);
    log("📊 RESET & EQUIPMENT GENERATION SUMMARY", colors.bright);
    log("=".repeat(60), colors.bright);
    log(`Player: ${player.displayName} (ID: ${player._id})`, colors.reset);
    log(`Equipment pieces added: ${totalAdded}`, colors.green);
    log(`Errors: ${totalErrors}`, totalErrors > 0 ? colors.red : colors.green);
    log(`Target slots processed: ${equipmentSlots.length}`, colors.reset);

    // Statistiques par slot
    log("\n📈 Equipment by slot:", colors.blue);
    for (const slotConfig of equipmentSlots) {
      const slotItems = newInventory.storage[slotConfig.category as keyof typeof newInventory.storage] as any[];
      log(`  ${slotConfig.slot}: ${slotItems?.length || 0}/${slotConfig.count} items`, colors.reset);
    }

    // Statistiques par rareté
    const rarityStats = await getRarityStatistics(newInventory);
    log("\n🏆 Equipment by rarity:", colors.magenta);
    Object.entries(rarityStats).forEach(([rarity, count]) => {
      if (count > 0) {
        log(`  ${rarity}: ${count} items`, colors.reset);
      }
    });

    log("=".repeat(60), colors.bright);
    log("🎉 Inventory reset and equipment generation completed!", colors.green);

  } catch (error) {
    log(`💥 Fatal error: ${error instanceof Error ? error.message : String(error)}`, colors.red);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log("🔌 Disconnected from MongoDB", colors.blue);
  }
}

/**
 * Sélectionner des items variés (différentes raretés, tiers, etc.)
 * PERMET LES DUPLICATAS pour avoir toujours le nombre demandé
 */
function selectVariedItems(items: any[], targetCount: number): any[] {
  const selected: any[] = [];

  if (items.length === 0) {
    return selected;
  }

  // 1. D'abord, essayer d'avoir une diversité de rareté
  const rarityGroups: { [rarity: string]: any[] } = {};
  items.forEach(item => {
    if (!rarityGroups[item.rarity]) {
      rarityGroups[item.rarity] = [];
    }
    rarityGroups[item.rarity].push(item);
  });

  const rarities = Object.keys(rarityGroups).sort((a, b) => {
    const rarityOrder = ["Common", "Rare", "Epic", "Legendary", "Mythic", "Ascended"];
    return rarityOrder.indexOf(a) - rarityOrder.indexOf(b);
  });

  // Ajouter au moins un item de chaque rareté disponible
  for (const rarity of rarities) {
    if (selected.length >= targetCount) break;
    
    const rarityItems = rarityGroups[rarity];
    const randomItem = rarityItems[Math.floor(Math.random() * rarityItems.length)];
    selected.push(randomItem);
  }

  // 2. Compléter avec des items aléatoires (PERMET LES DUPLICATAS)
  while (selected.length < targetCount) {
    const randomItem = items[Math.floor(Math.random() * items.length)];
    selected.push(randomItem);
  }

  return selected;
}

/**
 * Générer un niveau aléatoire selon la rareté
 */
function getRandomLevel(rarity: string): number {
  const levelRanges: { [rarity: string]: [number, number] } = {
    "Common": [1, 15],
    "Rare": [5, 25],
    "Epic": [10, 35],
    "Legendary": [20, 45],
    "Mythic": [30, 55],
    "Ascended": [40, 60]
  };

  const range = levelRanges[rarity] || [1, 20];
  return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
}

/**
 * Générer un niveau d'amélioration aléatoire selon la rareté
 */
function getRandomEnhancement(rarity: string): number {
  const enhancementChances: { [rarity: string]: number[] } = {
    "Common": [70, 20, 8, 2, 0, 0],     // Mostly +0 to +2
    "Rare": [40, 30, 20, 8, 2, 0],      // Mostly +0 to +3
    "Epic": [20, 25, 30, 20, 4, 1],     // Mostly +1 to +4
    "Legendary": [10, 15, 25, 30, 15, 5], // Mostly +2 to +5
    "Mythic": [5, 10, 20, 30, 25, 10],  // Mostly +3 to +5
    "Ascended": [0, 5, 15, 25, 35, 20]  // Mostly +4 to +5
  };

  const chances = enhancementChances[rarity] || enhancementChances["Common"];
  const random = Math.random() * 100;
  let cumulative = 0;

  for (let i = 0; i < chances.length; i++) {
    cumulative += chances[i];
    if (random <= cumulative) {
      return i;
    }
  }

  return 0;
}

/**
 * Calculer la puissance approximative d'un item
 */
function calculateApproximatePower(item: any, level: number, enhancement: number): number {
  let basePower = 0;

  // Stats de base
  if (item.baseStats) {
    basePower += (item.baseStats.atk || 0) * 1;
    basePower += (item.baseStats.def || 0) * 2;
    basePower += (item.baseStats.hp || 0) / 10;
  }

  // Multiplicateur de niveau
  const levelMultiplier = 1 + (level - 1) * 0.08;
  
  // Multiplicateur d'amélioration
  const enhancementMultiplier = 1 + enhancement * 0.2;

  // Multiplicateur de rareté
  const rarityMultipliers: { [rarity: string]: number } = {
    "Common": 1.0,
    "Rare": 1.4,
    "Epic": 1.8,
    "Legendary": 2.5,
    "Mythic": 3.5,
    "Ascended": 5.0
  };

  const rarityMultiplier = rarityMultipliers[item.rarity] || 1.0;

  return Math.round(basePower * levelMultiplier * enhancementMultiplier * rarityMultiplier);
}

/**
 * Obtenir les statistiques par rareté
 */
async function getRarityStatistics(inventory: any): Promise<{ [rarity: string]: number }> {
  const stats: { [rarity: string]: number } = {
    "Common": 0,
    "Rare": 0,
    "Epic": 0,
    "Legendary": 0,
    "Mythic": 0,
    "Ascended": 0
  };

  const allItemIds: string[] = [];
  
  // Collecter tous les itemIds
  const categories = ['weapons', 'helmets', 'armors', 'boots', 'gloves', 'accessories'];
  for (const category of categories) {
    const items = inventory.storage[category] || [];
    items.forEach((item: any) => allItemIds.push(item.itemId));
  }

  // Récupérer les raretés depuis la DB
  const items = await Item.find({ itemId: { $in: allItemIds } }).select('itemId rarity');
  const rarityMap = new Map(items.map(item => [item.itemId, item.rarity]));

  // Compter par rareté
  allItemIds.forEach(itemId => {
    const rarity = rarityMap.get(itemId);
    if (rarity && stats[rarity] !== undefined) {
      stats[rarity]++;
    }
  });

  return stats;
}

// === EXÉCUTION DU SCRIPT ===
if (require.main === module) {
  log("🚀 Reset Testt Inventory with Varied Equipment", colors.bright);
  log("This will DELETE the current inventory and add 4-5 pieces per equipment slot", colors.yellow);
  log("Each piece will have different stats and power levels\n", colors.yellow);
  
  resetTesttInventoryWithVariedEquipment()
    .then(() => process.exit(0))
    .catch((error) => {
      log(`💥 Fatal error: ${error.message}`, colors.red);
      process.exit(1);
    });
}

export default resetTesttInventoryWithVariedEquipment;

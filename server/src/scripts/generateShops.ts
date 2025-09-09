// server/src/scripts/generateShops.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import Shop from "../models/Shop";
import Item from "../models/Item";
import ItemGenerator from "../utils/ItemGenerator";
import { IdGenerator } from "../utils/idGenerator";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// === CONFIGURATION DES SHOPS ===
const SHOP_CONFIGS = {
  Daily: {
    name: "DAILY_SHOP_NAME",
    maxItems: 8,
    rarityWeights: { "Common": 60, "Rare": 35, "Epic": 5 },
    levelRange: [1, 15],
    tierRange: [1, 2],
    enhancementRange: [0, 2],
    priceMultiplier: { gold: 1.2, gems: 0.8 },
    stock: { min: 3, max: 8 },
    purchaseLimit: { min: 2, max: 5 }
  },
  Weekly: {
    name: "WEEKLY_SHOP_NAME", 
    maxItems: 8,
    rarityWeights: { "Rare": 50, "Epic": 40, "Legendary": 10 },
    levelRange: [10, 30],
    tierRange: [2, 4],
    enhancementRange: [1, 3],
    priceMultiplier: { gems: 1.0, paidGems: 0.9 },
    stock: { min: 2, max: 4 },
    purchaseLimit: { min: 1, max: 3 }
  },
  Monthly: {
    name: "MONTHLY_SHOP_NAME",
    maxItems: 8, 
    rarityWeights: { "Epic": 40, "Legendary": 60 },
    levelRange: [20, 50],
    tierRange: [3, 6],
    enhancementRange: [2, 5],
    priceMultiplier: { gems: 0.7, paidGems: 0.6 },
    stock: { min: 1, max: 2 },
    purchaseLimit: { min: 1, max: 1 }
  }
};

// === UTILITAIRES ===
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function weightedRandomRarity(weights: Record<string, number>): string {
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const [rarity, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) return rarity;
  }
  
  return Object.keys(weights)[0]; // Fallback
}

function calculateItemPrice(
  templateItem: any, 
  generatedItem: any, 
  multipliers: Record<string, number>
): Record<string, number> {
  const baseCost = templateItem.sellPrice || 100;
  const powerMultiplier = 1 + (generatedItem.generatedStats.powerScore / 1000) * 0.1;
  const rarityMultipliers: Record<string, number> = { "Common": 1, "Rare": 2, "Epic": 4, "Legendary": 8 };
  const rarityMultiplier = rarityMultipliers[templateItem.rarity] || 1;
  
  const finalCost = Math.round(baseCost * powerMultiplier * rarityMultiplier);
  
  const prices: Record<string, number> = {};
  
  // Distribution des prix selon la rareté
  if (templateItem.rarity === "Common") {
    prices.gold = Math.round(finalCost * (multipliers.gold || 1));
  } else if (templateItem.rarity === "Rare") {
    if (Math.random() < 0.7) {
      prices.gold = Math.round(finalCost * 1.5 * (multipliers.gold || 1));
    } else {
      prices.gems = Math.round(finalCost * 0.3 * (multipliers.gems || 1));
    }
  } else if (templateItem.rarity === "Epic") {
    if (Math.random() < 0.3) {
      prices.gold = Math.round(finalCost * 2 * (multipliers.gold || 1));
    } else {
      prices.gems = Math.round(finalCost * 0.5 * (multipliers.gems || 1));
    }
  } else { // Legendary
    if (Math.random() < 0.8) {
      prices.gems = Math.round(finalCost * 0.8 * (multipliers.gems || 1));
    } else {
      prices.paidGems = Math.round(finalCost * 0.1 * (multipliers.paidGems || 1));
    }
  }
  
  return prices;
}

// === GÉNÉRATION D'OBJETS POUR UN SHOP ===
async function generateShopItems(shopType: keyof typeof SHOP_CONFIGS): Promise<any[]> {
  const config = SHOP_CONFIGS[shopType];
  const generatedItems: any[] = [];
  
  // Récupérer tous les templates d'équipement
  const equipmentTemplates = await Item.find({ category: "Equipment" });
  
  if (equipmentTemplates.length === 0) {
    throw new Error("No equipment templates found in database");
  }
  
  console.log(`📦 Generating ${config.maxItems} items for ${shopType} shop...`);
  
  for (let i = 0; i < config.maxItems; i++) {
    try {
      // 1. Choisir la rareté selon les poids
      const targetRarity = weightedRandomRarity(config.rarityWeights);
      
      // 2. Filtrer les templates par rareté
      const templatesOfRarity = equipmentTemplates.filter(t => t.rarity === targetRarity);
      if (templatesOfRarity.length === 0) continue;
      
      // 3. Choisir un template aléatoire
      const template = templatesOfRarity[randomInt(0, templatesOfRarity.length - 1)];
      
      // 4. Paramètres de génération
      const level = randomInt(config.levelRange[0], config.levelRange[1]);
      const tier = randomInt(config.tierRange[0], config.tierRange[1]);
      const enhancementLevel = randomInt(config.enhancementRange[0], config.enhancementRange[1]);
      
      // 5. Générer l'objet avec ItemGenerator
      const generatedItem = await ItemGenerator.generateItemInstance(template.itemId, {
        level,
        tier,
        enhancementLevel,
        randomStatCount: randomInt(1, 3),
        factionAlignment: Math.random() < 0.3 ? ["Fire", "Water", "Wind", "Electric", "Light", "Dark"][randomInt(0, 5)] : undefined,
        seed: `${shopType}_${Date.now()}_${i}`
      });
      
      // 6. Calculer le prix
      const itemPrice = calculateItemPrice(template, generatedItem, config.priceMultiplier);
      
      // 7. Paramètres de stock et limite
      const maxStock = randomInt(config.stock.min, config.stock.max);
      const maxPurchasePerPlayer = randomInt(config.purchaseLimit.min, config.purchaseLimit.max);
      
      // 8. Créer l'objet shop
      const shopItem = {
        itemId: template.itemId,
        instanceId: IdGenerator.generateCompactUUID(),
        type: "Item" as const,
        name: `${template.name} +${enhancementLevel} (Lv.${level})`,
        description: `${template.description} - Tier ${tier}`,
        content: {
          itemId: generatedItem.itemId, // ID de l'instance générée
          quantity: 1,
          level,
          enhancement: enhancementLevel
        },
        cost: itemPrice,
        rarity: template.rarity,
        maxStock,
        currentStock: maxStock,
        maxPurchasePerPlayer,
        purchaseHistory: [],
        levelRequirement: Math.max(1, level - 5),
        isPromotional: Math.random() < 0.2, // 20% chance d'être promotionnel
        promotionalText: Math.random() < 0.2 ? "LIMITED_TIME_OFFER" : undefined,
        isFeatured: Math.random() < 0.1, // 10% chance d'être featured
        weight: 50 + (targetRarity === "Legendary" ? 30 : 0),
        tags: [
          shopType.toLowerCase(),
          `tier_${tier}`,
          `enhancement_${enhancementLevel}`,
          ...(generatedItem.factionAlignment ? [`faction_${generatedItem.factionAlignment.toLowerCase()}`] : [])
        ]
      };
      
      generatedItems.push(shopItem);
      console.log(`  ✅ Generated: ${shopItem.name} (${targetRarity}, Power: ${generatedItem.generatedStats.powerScore})`);
      
    } catch (error) {
      console.error(`  ❌ Error generating item ${i}:`, error);
    }
  }
  
  return generatedItems;
}

// === CRÉATION OU MISE À JOUR D'UN SHOP ===
async function createOrUpdateShop(shopType: keyof typeof SHOP_CONFIGS): Promise<void> {
  console.log(`\n🏪 Processing ${shopType} Shop...`);
  
  // Vérifier si le shop existe déjà
  let shop = await Shop.findOne({ shopType });
  
  if (shop) {
    console.log(`📝 Updating existing ${shopType} shop`);
    // Vider les objets actuels
    shop.items = [];
  } else {
    console.log(`🆕 Creating new ${shopType} shop`);
    // Créer un nouveau shop avec les paramètres prédéfinis
    shop = (Shop as any).createPredefinedShop(shopType);
  }
  
  if (!shop) {
    throw new Error(`Failed to create or find ${shopType} shop`);
  }
  
  // Générer les nouveaux objets
  const shopItems = await generateShopItems(shopType);
  
  // Ajouter les objets au shop
  shopItems.forEach(item => {
    shop!.addItem(item);
  });
  
  // Mettre à jour les timestamps
  shop.resetTime = new Date();
  shop.calculateNextResetTime();
  
  // Sauvegarder
  await shop.save();
  
  console.log(`✅ ${shopType} shop saved with ${shopItems.length} items`);
  console.log(`   Next reset: ${shop.nextResetTime.toLocaleString()}`);
  
  // Statistiques
  const rarityStats: Record<string, number> = {};
  shopItems.forEach(item => {
    rarityStats[item.rarity] = (rarityStats[item.rarity] || 0) + 1;
  });
  
  console.log(`   Rarity distribution:`, rarityStats);
}

// === SCRIPT PRINCIPAL ===
const generateAllShops = async (): Promise<void> => {
  try {
    console.log("🚀 Shop Generation Script");
    console.log("=========================");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Vérifier que nous avons des templates d'objets
    const itemCount = await Item.countDocuments({ category: "Equipment" });
    console.log(`📋 Found ${itemCount} equipment templates in database`);
    
    if (itemCount === 0) {
      throw new Error("No equipment templates found! Please run item migration first.");
    }
    
    // Générer chaque type de shop
    const shopTypes = ["Daily", "Weekly", "Monthly"] as const;
    
    for (const shopType of shopTypes) {
      await createOrUpdateShop(shopType);
    }
    
    // Statistiques finales
    const totalShops = await Shop.countDocuments({ isActive: true });
    console.log(`\n📊 Final Summary:`);
    console.log(`   - Active shops: ${totalShops}`);
    console.log(`   - Daily shop: 8 items (Common-Epic)`);
    console.log(`   - Weekly shop: 8 items (Rare-Legendary)`);
    console.log(`   - Monthly shop: 8 items (Epic-Legendary)`);
    
    console.log("🎉 Shop generation completed successfully!");
    
  } catch (error) {
    console.error("❌ Shop generation failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
    process.exit(0);
  }
};

// === SCRIPT DE RESET QUOTIDIEN ===
export const resetDailyShop = async (): Promise<void> => {
  try {
    console.log("🔄 Resetting Daily Shop...");
    await createOrUpdateShop("Daily");
    console.log("✅ Daily shop reset completed");
  } catch (error) {
    console.error("❌ Daily shop reset failed:", error);
    throw error;
  }
};

// === SCRIPT DE RESET HEBDOMADAIRE ===
export const resetWeeklyShop = async (): Promise<void> => {
  try {
    console.log("🔄 Resetting Weekly Shop...");
    await createOrUpdateShop("Weekly");
    console.log("✅ Weekly shop reset completed");
  } catch (error) {
    console.error("❌ Weekly shop reset failed:", error);
    throw error;
  }
};

// === SCRIPT DE RESET MENSUEL ===
export const resetMonthlyShop = async (): Promise<void> => {
  try {
    console.log("🔄 Resetting Monthly Shop...");
    await createOrUpdateShop("Monthly");
    console.log("✅ Monthly shop reset completed");
  } catch (error) {
    console.error("❌ Monthly shop reset failed:", error);
    throw error;
  }
};

// === EXÉCUTION DU SCRIPT ===
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case "daily":
      resetDailyShop();
      break;
    case "weekly":
      resetWeeklyShop();
      break;
    case "monthly":
      resetMonthlyShop();
      break;
    case "all":
    default:
      generateAllShops();
      break;
  }
}

export default generateAllShops;

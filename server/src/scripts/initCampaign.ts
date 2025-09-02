#!/usr/bin/env ts-node

// server/src/scripts/initCampaign.ts
// Script d'initialisation de la campagne (30 mondes)
// Usage: npm run init-campaign

import mongoose from "mongoose";
import dotenv from "dotenv";
import CampaignWorld, { ICampaignWorld, ILevelConfig, Elem } from "../models/CampaignWorld";

// Charger les variables d'environnement
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

class CampaignInitializer {

  // === INITIALISER TOUS LES MONDES DE CAMPAGNE ===
  public static async initializeAllWorlds(): Promise<void> {
    try {
      console.log("🌍 Initializing 30 campaign worlds...");

      // Vérifier si des mondes existent déjà
      const existingWorlds = await CampaignWorld.countDocuments({});
      if (existingWorlds > 0) {
        console.log(`ℹ️ ${existingWorlds} worlds already exist`);
        const response = await this.promptUser("Do you want to recreate all worlds? (y/N): ");
        if (response.toLowerCase() !== 'y') {
          console.log("⏭️ Skipping world initialization");
          return;
        }
        
        // Supprimer tous les mondes existants
        await CampaignWorld.deleteMany({});
        console.log("🗑️ Deleted existing worlds");
      }

      // Créer tous les 30 mondes
      const defaultWorlds = this.generateAllWorlds();
      
      let created = 0;
      for (const worldData of defaultWorlds) {
        await this.createSingleWorld(worldData);
        created++;
        
        // Progress indicator
        if (created % 5 === 0) {
          console.log(`📈 Progress: ${created}/30 worlds created`);
        }
      }

      console.log(`✅ Successfully initialized ${created} campaign worlds!`);
      console.log(`📊 Total levels across all worlds: ${defaultWorlds.reduce((sum, w) => sum + w.levelCount, 0)}`);

    } catch (error) {
      console.error("❌ Error initializing campaign worlds:", error);
      throw error;
    }
  }

  // === CRÉER UN MONDE UNIQUE ===
  private static async createSingleWorld(worldData: any): Promise<void> {
    try {
      // Générer tous les niveaux pour ce monde
      worldData.levels = this.generateLevelsForWorld(
        worldData.worldId, 
        worldData.levelCount, 
        worldData.elementBias,
        worldData.mapTheme
      );

      const world = new CampaignWorld(worldData);
      await world.save();

      console.log(`🏰 Created: ${world.name} (${world.levelCount} levels, min level ${world.minPlayerLevel})`);

    } catch (error) {
      console.error(`❌ Error creating world ${worldData.name}:`, error);
      throw error;
    }
  }

  // === GÉNÉRER LES 30 MONDES ===
  private static generateAllWorlds(): any[] {
    const worlds: any[] = [];
    
    const worldTemplates = [
      // Early Game (1-10)
      { name: "Green Plains", theme: "grasslands", element: ["Wind"], difficulty: "tutorial" },
      { name: "Whispering Woods", theme: "forest", element: ["Wind", "Water"], difficulty: "easy" },
      { name: "Rocky Hills", theme: "mountains", element: ["Electric"], difficulty: "easy" },
      { name: "Crystal Caves", theme: "caves", element: ["Water"], difficulty: "normal" },
      { name: "Burning Sands", theme: "desert", element: ["Fire"], difficulty: "normal" },
      { name: "Frozen Lake", theme: "ice", element: ["Water"], difficulty: "normal" },
      { name: "Lightning Peaks", theme: "storm", element: ["Electric"], difficulty: "challenging" },
      { name: "Shadow Valley", theme: "dark", element: ["Dark"], difficulty: "challenging" },
      { name: "Sunlit Temple", theme: "temple", element: ["Light"], difficulty: "challenging" },
      { name: "Mystic Gardens", theme: "enchanted", element: ["Wind", "Water"], difficulty: "hard" },
      
      // Mid Game (11-20)
      { name: "Molten Fortress", theme: "volcano", element: ["Fire"], difficulty: "hard" },
      { name: "Glacial Citadel", theme: "fortress", element: ["Water"], difficulty: "hard" },
      { name: "Storm Spire", theme: "tower", element: ["Electric"], difficulty: "very_hard" },
      { name: "Void Sanctum", theme: "void", element: ["Dark"], difficulty: "very_hard" },
      { name: "Radiant Cathedral", theme: "cathedral", element: ["Light"], difficulty: "very_hard" },
      { name: "Elemental Crossroads", theme: "crossroads", element: ["Fire", "Water"], difficulty: "extreme" },
      { name: "Chaos Wastes", theme: "wasteland", element: ["Dark", "Fire"], difficulty: "extreme" },
      { name: "Ethereal Realm", theme: "ethereal", element: ["Light", "Wind"], difficulty: "extreme" },
      { name: "Dragon's Lair", theme: "lair", element: ["Fire", "Electric"], difficulty: "nightmare" },
      { name: "Frozen Hell", theme: "hell", element: ["Water", "Dark"], difficulty: "nightmare" },
      
      // End Game (21-30)
      { name: "Celestial Observatory", theme: "space", element: ["Light", "Electric"], difficulty: "nightmare" },
      { name: "Abyssal Depths", theme: "abyss", element: ["Dark", "Water"], difficulty: "nightmare" },
      { name: "Primal Volcano", theme: "primal", element: ["Fire"], difficulty: "impossible" },
      { name: "Time Rifts", theme: "temporal", element: ["Wind", "Electric"], difficulty: "impossible" },
      { name: "Soul Forge", theme: "forge", element: ["Dark", "Fire"], difficulty: "impossible" },
      { name: "Heaven's Gate", theme: "heaven", element: ["Light"], difficulty: "impossible" },
      { name: "Elemental Nexus", theme: "nexus", element: ["Fire", "Water", "Wind", "Electric"], difficulty: "godlike" },
      { name: "Reality Break", theme: "reality", element: ["Light", "Dark"], difficulty: "godlike" },
      { name: "Genesis Core", theme: "core", element: ["Fire", "Water", "Wind", "Electric", "Light"], difficulty: "godlike" },
      { name: "Final Convergence", theme: "convergence", element: ["Fire", "Water", "Wind", "Electric", "Light", "Dark"], difficulty: "transcendent" }
    ];

    for (let worldId = 1; worldId <= 30; worldId++) {
      const template = worldTemplates[worldId - 1];
      const levelCount = 12 + (worldId * 2); // 14, 16, 18, 20, ..., 72
      const minPlayerLevel = this.calculateMinPlayerLevel(worldId);
      const recommendedPower = this.calculateRecommendedPower(worldId);

      worlds.push({
        worldId: worldId,
        name: template.name,
        description: this.generateWorldDescription(template.name, template.difficulty),
        mapTheme: template.theme,
        levelCount: levelCount,
        minPlayerLevel: minPlayerLevel,
        recommendedPower: recommendedPower,
        elementBias: template.element as Elem[]
      });
    }

    return worlds;
  }

  // === CALCULER LES PRÉREQUIS ===
  private static calculateMinPlayerLevel(worldId: number): number {
    if (worldId === 1) return 1;
    if (worldId <= 5) return (worldId - 1) * 8 + 1;      // 1, 9, 17, 25, 33
    if (worldId <= 10) return (worldId - 5) * 12 + 41;   // 41, 53, 65, 77, 89
    if (worldId <= 20) return (worldId - 10) * 8 + 101;  // 101, 109, 117... 181
    return (worldId - 20) * 12 + 189;                    // 189, 201, 213... 309
  }

  private static calculateRecommendedPower(worldId: number): number {
    const basePower = 500;
    const exponentialGrowth = Math.pow(1.35, worldId - 1);
    return Math.floor(basePower * exponentialGrowth);
  }

  // === GÉNÉRATION DES NIVEAUX ===
  private static generateLevelsForWorld(
    worldId: number,
    levelCount: number,
    elementBias?: Elem[],
    mapTheme?: string
  ): ILevelConfig[] {
    
    const levels: ILevelConfig[] = [];
    
    for (let i = 1; i <= levelCount; i++) {
      const level: ILevelConfig = {
        levelIndex: i,
        name: this.generateLevelName(worldId, i, levelCount, mapTheme),
        enemyType: this.determineEnemyType(i, levelCount),
        enemyCount: this.determineEnemyCount(i, levelCount),
        difficultyMultiplier: this.calculateLevelDifficulty(worldId, i, levelCount),
        staminaCost: this.calculateStaminaCost(worldId, i),
        rewards: this.generateLevelRewards(worldId, i),
        enemyPoolTags: this.generateEnemyTags(worldId, elementBias, mapTheme),
        modifiers: this.generateLevelModifiers(worldId, i, elementBias)
      };
      
      levels.push(level);
    }
    
    return levels;
  }

  // === MÉTHODES DE GÉNÉRATION DÉTAILLÉES ===

  // Générer nom de niveau
  private static generateLevelName(worldId: number, levelIndex: number, totalLevels: number, mapTheme?: string): string {
    const themeNames: { [key: string]: string[] } = {
      grasslands: ["Peaceful Meadow", "Rolling Hill", "Sunny Grove", "Fresh Stream", "Flower Field"],
      forest: ["Mystic Path", "Ancient Tree", "Hidden Glade", "Moss Cave", "Canopy Bridge"],
      desert: ["Burning Dune", "Mirage Oasis", "Sand Storm", "Scorched Ruins", "Lava Crater"],
      ice: ["Frozen Plain", "Ice Cave", "Eternal Blizzard", "Crystal Lake", "Glacier Peak"],
      mountains: ["Rocky Outcrop", "Mountain Pass", "High Summit", "Steep Cliff", "Stone Bridge"],
      volcano: ["Magma Chamber", "Lava Flow", "Fire Pit", "Molten Core", "Ash Cloud"],
      temple: ["Sacred Hall", "Prayer Room", "Divine Altar", "Holy Shrine", "Celestial Dome"],
      abyss: ["Dark Pit", "Cursed Cave", "Shadow Maze", "Evil Chasm", "Void Depths"],
      space: ["Stellar Field", "Cosmic Drift", "Nebula Gate", "Star Cluster", "Galaxy Core"],
      nexus: ["Convergence", "Fusion Point", "Elemental Mix", "Power Core", "Prime Source"]
    };

    const names = themeNames[mapTheme || "grasslands"] || ["Zone", "Area", "Region", "Sector", "District"];
    
    // Boss final
    if (levelIndex === totalLevels) {
      return `Final Boss Chamber`;
    }
    
    // Mini-boss (tous les quart du monde)
    const quarterMark = Math.ceil(totalLevels / 4);
    if (levelIndex % quarterMark === 0 && levelIndex !== totalLevels) {
      return `Elite Stronghold ${Math.ceil(levelIndex / quarterMark)}`;
    }
    
    // Niveaux normaux
    const nameIndex = (levelIndex - 1) % names.length;
    return `${names[nameIndex]} ${levelIndex}`;
  }

  // Déterminer type d'ennemi
  private static determineEnemyType(levelIndex: number, totalLevels: number): "normal" | "elite" | "boss" {
    if (levelIndex === totalLevels) return "boss";
    
    const quarterMark = Math.ceil(totalLevels / 4);
    if (levelIndex % quarterMark === 0) return "elite";
    
    return "normal";
  }

  // Nombre d'ennemis
  private static determineEnemyCount(levelIndex: number, totalLevels: number): number {
    const enemyType = this.determineEnemyType(levelIndex, totalLevels);
    
    switch (enemyType) {
      case "boss": return 1;
      case "elite": return 2;
      default: 
        // Plus d'ennemis dans les derniers niveaux
        if (levelIndex > totalLevels * 0.8) return 4;
        if (levelIndex > totalLevels * 0.5) return 3;
        return 3;
    }
  }

  // Difficulté du niveau
  private static calculateLevelDifficulty(worldId: number, levelIndex: number, totalLevels: number): number {
    const baseWorldDifficulty = 1 + (worldId - 1) * 0.15;
    const levelProgression = 1 + (levelIndex - 1) * 0.08;
    const lateGameBonus = worldId > 20 ? 1 + (worldId - 20) * 0.1 : 1;
    
    return Number((baseWorldDifficulty * levelProgression * lateGameBonus).toFixed(2));
  }

  // Coût en stamina
  private static calculateStaminaCost(worldId: number, levelIndex: number): number {
    const baseCost = 6;
    const worldBonus = Math.floor((worldId - 1) / 5);
    return baseCost + worldBonus;
  }

  // Récompenses du niveau
  private static generateLevelRewards(worldId: number, levelIndex: number): any {
    const baseExp = 30 + (worldId - 1) * 15 + levelIndex * 3;
    const baseGold = 25 + (worldId - 1) * 10 + levelIndex * 2;
    
    // Bonus pour les boss/élites
    let expMultiplier = 1;
    let goldMultiplier = 1;
    
    if (levelIndex % 5 === 0) { // Elite
      expMultiplier = 2;
      goldMultiplier = 1.8;
    }
    
    return {
      experience: Math.floor(baseExp * expMultiplier),
      gold: Math.floor(baseGold * goldMultiplier),
      items: levelIndex % 10 === 0 ? [`world_${worldId}_reward`] : [],
      fragments: levelIndex % 8 === 0 ? [{ heroId: "random", quantity: 5 }] : []
    };
  }

  // Tags d'ennemis
  private static generateEnemyTags(worldId: number, elementBias?: Elem[], mapTheme?: string): string[] {
    const tags: string[] = [];
    
    // Tags élémentaires
    if (elementBias) {
      elementBias.forEach(element => tags.push(element.toLowerCase()));
    }
    
    // Tags thématiques
    if (mapTheme) {
      tags.push(mapTheme);
    }
    
    // Tags de difficulté par monde
    if (worldId <= 10) tags.push("early_game");
    else if (worldId <= 20) tags.push("mid_game");
    else tags.push("end_game");
    
    return tags;
  }

  // Modificateurs de niveau
  private static generateLevelModifiers(worldId: number, levelIndex: number, elementBias?: Elem[]): any {
    const modifiers: any = {};
    
    // Aura élémentaire dans certains niveaux
    if (elementBias && elementBias.length > 0 && levelIndex % 3 === 0) {
      modifiers.elementalAura = elementBias[0];
    }
    
    // Bonus de stats dans les mondes avancés
    if (worldId > 15) {
      modifiers.atkBuffPct = 0.1 + (worldId - 15) * 0.02;
    }
    
    if (worldId > 20) {
      modifiers.defBuffPct = 0.05 + (worldId - 20) * 0.015;
    }
    
    return Object.keys(modifiers).length > 0 ? modifiers : undefined;
  }

  // === UTILITAIRES ===

  // Générer description du monde
  private static generateWorldDescription(name: string, difficulty: string): string {
    const difficultyDescriptions: { [key: string]: string } = {
      tutorial: "A peaceful realm perfect for learning the basics of combat.",
      easy: "Gentle landscapes with friendly creatures to test your growing skills.",
      normal: "Balanced challenges that require strategy and teamwork.",
      challenging: "Dangerous territories where only prepared heroes survive.",
      hard: "Hostile environments filled with powerful enemies and deadly traps.",
      very_hard: "Perilous realms where death awaits the unprepared at every turn.",
      extreme: "Nightmare landscapes that push even veteran heroes to their limits.",
      nightmare: "Hellish domains where only the strongest dare to venture.",
      impossible: "Legendary battlegrounds that defy mortal comprehension.",
      godlike: "Transcendent realms where reality itself bends to immense power.",
      transcendent: "The ultimate test of heroism where legends are forged in eternal glory."
    };

    const baseDescription = difficultyDescriptions[difficulty] || "An unknown realm awaiting exploration.";
    return `${name}: ${baseDescription}`;
  }

  // Prompt utilisateur (pour le mode interactif)
  private static async promptUser(question: string): Promise<string> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer: string) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  // === STATISTIQUES ===
  public static async showCampaignStats(): Promise<void> {
    try {
      const worlds = await CampaignWorld.find({}).sort({ worldId: 1 });
      
      console.log("\n📊 === CAMPAIGN STATISTICS ===");
      console.log(`Total Worlds: ${worlds.length}`);
      console.log(`Total Levels: ${worlds.reduce((sum, w) => sum + w.levelCount, 0)}`);
      console.log(`Level Range: ${worlds[0]?.levelCount} - ${worlds[worlds.length - 1]?.levelCount} per world`);
      console.log(`Player Level Range: ${worlds[0]?.minPlayerLevel} - ${worlds[worlds.length - 1]?.minPlayerLevel}`);
      
      console.log("\n🌍 Worlds Overview:");
      worlds.forEach((world, index) => {
        const progress = `World ${world.worldId}`.padEnd(8);
        const name = world.name.padEnd(25);
        const levels = `${world.levelCount} levels`.padEnd(12);
        const minLevel = `Min Lv.${world.minPlayerLevel}`.padEnd(10);
        const power = `${world.recommendedPower} power`;
        
        console.log(`${progress} ${name} ${levels} ${minLevel} ${power}`);
      });

    } catch (error) {
      console.error("❌ Error showing campaign stats:", error);
    }
  }
}

// === SCRIPT PRINCIPAL ===
async function main() {
  try {
    console.log("🚀 Campaign Initialization Script Starting...");
    
    // Connexion à MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Initialiser les mondes
    await CampaignInitializer.initializeAllWorlds();
    
    // Afficher les statistiques
    await CampaignInitializer.showCampaignStats();
    
    console.log("\n🎉 Campaign initialization completed successfully!");
    
  } catch (error) {
    console.error("❌ Campaign initialization failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("📁 Database connection closed");
    process.exit(0);
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  main();
}

export { CampaignInitializer };

import mongoose from "mongoose";
import dotenv from "dotenv";
import { AchievementService } from "../services/AchievementService";
import Achievement from "../models/Achievement";
import Player from "../models/Player";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

async function testAchievements() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Initialiser le système
    AchievementService.initialize();
    
    // Créer un achievement de test
    const testAchievement = await AchievementService.createAchievement({
      achievementId: "TEST_WORLD_3",
      name: "World Explorer",
      description: "Reach World 3",
      category: "progression",
      type: "milestone",
      rarity: "rare",
      criteria: [
        { type: "world_reached", target: 3, comparison: ">=" }
      ],
      rewards: {
        gold: 1000,
        gems: 100
      },
      isActive: true,
      scope: "server",
      serverId: "S1"
    });
    
    console.log("✅ Achievement créé:", testAchievement.name);
    
    // Simuler progression
    const player = await Player.findOne({ serverId: "S1" });
    if (player) {
      await AchievementService.updatePlayerProgress(
        player._id.toString(),
        "S1",
        "world_reached",
        3
      );
      
      console.log("✅ Progression mise à jour pour", player.displayName);
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testAchievements();

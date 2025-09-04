import mongoose from "mongoose";
import dotenv from "dotenv";
import Player from "../models/Player";
import Inventory from "../models/Inventory";
import Item from "../models/Item";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const username = process.argv[2] || "greg";
  const player = await Player.findOne({ username });
  if (!player) {
    console.error("Player not found:", username);
    process.exit(1);
  }

  let inventory = await Inventory.findOne({ playerId: player._id });
  if (!inventory) {
    inventory = new Inventory({ playerId: player._id, maxCapacity: 500 });
  }

  const items = await Item.find();
  for (const it of items) {
    try {
      // Utilise la méthode d'instance pour garder la logique existante (catégories, fragments, monnaies...)
      const owned = await inventory.addItem(it.itemId, 1, 1);
      console.log("Added", it.itemId, "->", owned.instanceId);
    } catch (err) {
      // TS: err peut être unknown — on transforme proprement en message
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Error adding", it.itemId, msg);
    }
  }

  try {
    await inventory.save();
    console.log("Finished adding items to", username);
  } catch (saveErr) {
    const msg = saveErr instanceof Error ? saveErr.message : String(saveErr);
    console.error("Error saving inventory:", msg);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Fatal error:", msg);
  process.exit(1);
});

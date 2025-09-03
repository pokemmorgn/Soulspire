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

  const username = process.argv[2] || "test";
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
      await inventory.addItem(it.itemId, 1, 1);
      console.log("Added", it.itemId);
    } catch (err) {
      console.error("Error adding", it.itemId, err.message || err);
    }
  }

  await inventory.save();
  console.log("Finished adding items to", username);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

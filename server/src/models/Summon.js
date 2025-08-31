const mongoose = require("mongoose");

const summonSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  heroesObtained: [{
    heroId: { type: mongoose.Schema.Types.ObjectId, ref: "Hero" },
    rarity: String
  }],
  type: { type: String, enum: ["Standard", "Limited", "Ticket"] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Summon", summonSchema);

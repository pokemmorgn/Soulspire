const mongoose = require("mongoose");

const heroSchema = new mongoose.Schema({
  name: String,
  role: { type: String, enum: ["Tank", "DPS Melee", "DPS Ranged", "Support"] },
  element: { type: String, enum: ["Fire", "Water", "Wind", "Electric", "Light", "Dark"] },
  rarity: { type: String, enum: ["Common", "Rare", "Epic", "Legendary"] },

  // Stats de base
  baseStats: {
    hp: Number,
    atk: Number,
    def: Number
  },

  // Compétence signature
  skill: {
    name: String,
    description: String,
    type: { type: String, enum: ["Heal", "Buff", "AoE", "Control", "Damage"] }
  }
});

module.exports = mongoose.model("Hero", heroSchema);

const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,

  // Monnaies
  gold: { type: Number, default: 1000 },
  gems: { type: Number, default: 100 },
  paidGems: { type: Number, default: 0 },

  // Progression campagne
  world: { type: Number, default: 1 },
  level: { type: Number, default: 1 },
  difficulty: { type: String, default: "Normal" }, // Normal / Hard / Nightmare

  // Héros possédés
  heroes: [{
    heroId: { type: mongoose.Schema.Types.ObjectId, ref: "Hero" },
    level: { type: Number, default: 1 },
    stars: { type: Number, default: 1 },
    equipped: { type: Boolean, default: false }
  }],

  // Inventaire intégré
  tickets: { type: Number, default: 0 },
  fragments: { type: Map, of: Number, default: {} },
  materials: { type: Map, of: Number, default: {} },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Player", playerSchema);

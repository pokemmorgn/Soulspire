const mongoose = require("mongoose");

const equipmentSchema = new mongoose.Schema({
  itemId: String, // identifiant unique de l’objet
  name: String,   // ex: "Épée enflammée"
  type: { type: String, enum: ["Weapon", "Armor", "Accessory"] }, // slot
  rarity: { type: String, enum: ["Common", "Rare", "Epic", "Legendary"] },
  level: { type: Number, default: 1 }, // amélioration
  stats: {
    atk: { type: Number, default: 0 },
    def: { type: Number, default: 0 },
    hp: { type: Number, default: 0 }
  },
  equippedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Player.heroes" } // héros qui porte l’équipement
});

const inventorySchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },

  // Monnaies et ressources
  gold: { type: Number, default: 0 },
  gems: { type: Number, default: 0 },
  paidGems: { type: Number, default: 0 },
  tickets: { type: Number, default: 0 },

  // Fragments et matériaux
  fragments: { type: Map, of: Number, default: {} }, // { heroId: quantité }
  materials: { type: Map, of: Number, default: {} }, // ex: { "evolutionStone": 20 }

  // Équipement possédé
  equipment: [equipmentSchema]
});

module.exports = mongoose.model("Inventory", inventorySchema);

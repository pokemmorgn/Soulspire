const express = require("express");
const router = express.Router();
const Player = require("../models/Player");
const authMiddleware = require("../middleware/authMiddleware");

// === GET INVENTAIRE ===
router.get("/", authMiddleware, async (req, res) => {
  try {
    const player = await Player.findById(req.userId).select("inventory");
    if (!player) return res.status(404).json({ error: "Joueur introuvable" });

    res.json(player.inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === AJOUT ITEM ===
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const { itemId, quantity } = req.body;
    if (!itemId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: "Paramètres invalides" });
    }

    const player = await Player.findById(req.userId);
    if (!player) return res.status(404).json({ error: "Joueur introuvable" });

    // Vérifie si l’item existe déjà
    const existingItem = player.inventory.find(i => i.itemId === itemId);
    if (existingItem) {
      existingItem.quantity += quantity; // incrémente
    } else {
      player.inventory.push({ itemId, quantity });
    }

    await player.save();
    res.json({ message: "Item ajouté", inventory: player.inventory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;

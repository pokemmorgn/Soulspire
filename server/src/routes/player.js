const express = require("express");
const router = express.Router();
const Player = require("../models/Player");
const authMiddleware = require("../middleware/authMiddleware");

// Récupération des infos joueur connecté
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const player = await Player.findById(req.userId).select("username gold gems heroes inventory");
    if (!player) return res.status(404).json({ error: "Joueur introuvable" });

    res.json(player);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;

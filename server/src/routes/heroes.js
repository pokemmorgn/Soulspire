const express = require("express");
const router = express.Router();
const Hero = require("../models/Hero");
const Player = require("../models/Player");
const authMiddleware = require("../middleware/authMiddleware");

// Catalogue global des héros
router.get("/list", async (req, res) => {
  try {
    const heroes = await Hero.find({});
    res.json(heroes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Liste des héros du joueur connecté
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const player = await Player.findById(req.user.id).populate("heroes.heroId");
    if (!player) return res.status(404).json({ error: "Joueur introuvable" });

    res.json(player.heroes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const Player = require("../models/Player");
const Hero = require("../models/Hero");
const Summon = require("../models/Summon");
const authMiddleware = require("../middleware/authMiddleware");

// Invocation
router.post("/pull", authMiddleware, async (req, res) => {
  try {
    const { type } = req.body;
    const player = await Player.findById(req.user.id);
    if (!player) return res.status(404).json({ error: "Joueur introuvable" });

    // Vérifier gems
    if (player.gems < 300) return res.status(400).json({ error: "Pas assez de gemmes" });
    player.gems -= 300;

    // Taux de drop
    const rand = Math.random() * 100;
    let rarity;
    if (rand < 50) rarity = "Common";
    else if (rand < 80) rarity = "Rare";
    else if (rand < 95) rarity = "Epic";
    else rarity = "Legendary";

    // Sélection d'un héros
    const heroes = await Hero.find({ rarity });
    if (!heroes.length) return res.status(500).json({ error: "Pas de héros dispo" });

    const hero = heroes[Math.floor(Math.random() * heroes.length)];

    // Ajout au joueur
    player.heroes.push({ heroId: hero._id, level: 1, stars: 1 });
    await player.save();

    // Log invocation
    const summon = new Summon({
      playerId: player._id,
      heroesObtained: [{ heroId: hero._id, rarity }],
      type
    });
    await summon.save();

    res.json({ message: "Invocation réussie", hero });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

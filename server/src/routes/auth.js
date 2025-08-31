const express = require("express");
const router = express.Router();
const Player = require("../models/Player");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Joi = require("joi");

// Schéma de validation (username + password)
const authSchema = Joi.object({
  username: Joi.string().min(3).max(20).required(),
  password: Joi.string().min(6).max(50).required(),
});

// Génération des tokens
function generateTokens(playerId) {
  const accessToken = jwt.sign(
    { id: playerId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" } // Access token expire vite
  );

  const refreshToken = jwt.sign(
    { id: playerId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" } // Refresh token dure 7 jours
  );

  return { accessToken, refreshToken };
}

// === REGISTER ===
router.post("/register", async (req, res) => {
  try {
    const { error } = authSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { username, password } = req.body;

    // Vérifie si nom déjà utilisé
    const existing = await Player.findOne({ username });
    if (existing) return res.status(400).json({ error: "Nom déjà pris" });

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    const player = new Player({ username, password: hashedPassword });
    await player.save();

    res.json({ message: "Inscription réussie" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === LOGIN ===
router.post("/login", async (req, res) => {
  try {
    const { error } = authSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { username, password } = req.body;

    const player = await Player.findOne({ username });
    if (!player) return res.status(404).json({ error: "Joueur introuvable" });

    // Vérif mot de passe
    const valid = await bcrypt.compare(password, player.password);
    if (!valid) return res.status(400).json({ error: "Mot de passe incorrect" });

    // Génère tokens
    const { accessToken, refreshToken } = generateTokens(player._id);

    res.json({
      message: "Connexion réussie",
      accessToken,
      refreshToken,
      playerId: player._id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === REFRESH TOKEN ===
router.post("/refresh", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: "Refresh token manquant" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const { accessToken, refreshToken } = generateTokens(decoded.id);
    res.json({ accessToken, refreshToken });
  } catch (err) {
    res.status(403).json({ error: "Refresh token invalide ou expiré" });
  }
});

module.exports = router;

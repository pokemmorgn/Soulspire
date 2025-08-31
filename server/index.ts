const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const playerRoutes = require("./routes/player");
const inventoryRoutes = require("./routes/inventory");
const heroesRoutes = require("./routes/heroes");
const gachaRoutes = require("./routes/gacha");

require("dotenv").config();

const app = express();

// Middlewares globaux
app.use(cors()); // autorise les appels depuis Unity/Web
app.use(express.json());

// Connexion DB
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/soulspireidle", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ Connecté à MongoDB"))
  .catch(err => console.error("❌ Erreur MongoDB:", err));

// Health check
app.get("/", (req, res) => res.send("API Soulspire Idle OK 🚀"));

// Routes
app.use("/auth", authRoutes);
app.use("/player", playerRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/heroes", heroesRoutes);
app.use("/gacha", gachaRoutes);

// Lancement serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API lancée sur http://localhost:${PORT}`));

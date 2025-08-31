import express, { Application, Request, Response } from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

// Import des routes
import authRoutes from "./routes/auth";
import playerRoutes from "./routes/player";
import inventoryRoutes from "./routes/inventory";
import heroesRoutes from "./routes/heroes";
import gachaRoutes from "./routes/gacha";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "";

// Middlewares
app.use(cors());
app.use(express.json());

// Connexion MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connecté"))
  .catch((err) => console.error("❌ Erreur connexion MongoDB:", err));

// Routes
app.use("/auth", authRoutes);
app.use("/player", playerRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/heroes", heroesRoutes);
app.use("/gacha", gachaRoutes);

// Health check
app.get("/", (req: Request, res: Response) => {
  res.send("API en ligne ✅");
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});

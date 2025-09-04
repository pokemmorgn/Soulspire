import express, { Application, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

// Import des routes
import authRoutes from "./routes/auth";
import playerRoutes from "./routes/player";
import inventoryRoutes from "./routes/inventory";
import heroesRoutes from "./routes/heroes";
import gachaRoutes from "./routes/gacha";
import shopRoutes from "./routes/shop";
import battleRoutes from "./routes/battle";
import serverMiddleware, { injectServerIdMiddleware } from "./middleware/serverMiddleware";
import authMiddleware from "./middleware/authMiddleware";
import touchLastSeen from "./middleware/touchLastSeen";
import serverRoutes from "./routes/servers";
import towerRoutes from "./routes/tower";
import eventsRoutes from "./routes/events";
import afkRouter from "./routes/afk";
import campaignRoutes from "./routes/campaign";
import itemsRoutes from "./routes/items";
import forgeRoutes from "./routes/forge";
import forgeReforgeRoutes from "./routes/forgeReforge";
import forgeEnhancementRoutes from "./routes/forgeEnhancement";
import forgeFusionRoutes from "./routes/forgeFusion";
import forgeTierUpgradeRoutes from "./routes/forgeTierUpgrade";

// Configuration de l'environnement
dotenv.config();

const app: Application = express();
const PORT: number = parseInt(process.env.PORT || "3000", 10);
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";
const NODE_ENV = process.env.NODE_ENV || "development";

// Configuration CORS
const corsOptions = {
  origin: NODE_ENV === "production" 
    ? ["https://your-unity-game-domain.com"] // Remplacez par votre domaine
    : ["http://localhost:3000", "http://127.0.0.1:3000"], // Dev et Unity local
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};

// Rate limiting pour prévenir les abus
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === "production" ? 100 : 1000, // Plus restrictif en production
  message: {
    error: "Too many requests from this IP, please try again later.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting spécial pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Maximum 10 tentatives de connexion par IP
  message: {
    error: "Too many authentication attempts, please try again later.",
    code: "AUTH_RATE_LIMIT_EXCEEDED"
  }
});

// Rate limiting spécial pour le gacha (anti-bot)
const gachaLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Maximum 30 pulls par minute
  message: {
    error: "Too many gacha pulls, please slow down.",
    code: "GACHA_RATE_LIMIT_EXCEEDED"
  }
});

// Middlewares globaux
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(injectServerIdMiddleware);
app.use(serverMiddleware);

// Application du rate limiting
app.use(limiter);

// Middleware de logging personnalisé
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);
  next();
});

// Middleware de gestion des erreurs globales
const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Global error handler:", err);
  
  // Erreurs de validation Mongoose
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((error: any) => error.message);
    return res.status(400).json({
      error: "Validation failed",
      details: messages,
      code: "VALIDATION_ERROR"
    });
  }
  
  // Erreurs de duplication MongoDB
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      error: `${field} already exists`,
      code: "DUPLICATE_ERROR"
    });
  }
  
  // Erreurs de cast MongoDB
  if (err.name === "CastError") {
    return res.status(400).json({
      error: "Invalid ID format",
      code: "INVALID_ID"
    });
  }
  
  // Erreur par défaut
  res.status(500).json({
    error: NODE_ENV === "production" 
      ? "Internal server error" 
      : err.message || "Something went wrong",
    code: "INTERNAL_ERROR"
  });
};

// Connexion MongoDB avec options optimisées
const connectDB = async (): Promise<void> => {
  try {
    const mongoOptions = {
      retryWrites: true,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(MONGO_URI, mongoOptions);
    console.log("✅ MongoDB connected successfully");
    
    // Événements de connexion MongoDB
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });
    
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected");
    });
    
    mongoose.connection.on("reconnected", () => {
      console.log("🔄 MongoDB reconnected");
    });
    
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
};

// Routes avec middlewares spécifiques
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/player", playerRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/heroes", heroesRoutes);
app.use("/api/gacha", gachaLimiter, gachaRoutes);
app.use('/api/shops', shopRoutes); 
app.use("/api/battle", battleRoutes);
app.use("/api/servers", serverRoutes);
app.use("/api/tower", towerRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/afk", authMiddleware, touchLastSeen, afkRouter);
app.use("/api/campaign", campaignRoutes);
app.use("/api/items", itemsRoutes);
app.use("/api/forge", forgeRoutes);
app.use("/api/forge/reforge", forgeReforgeRoutes);
app.use("/api/forge/enhancement", forgeEnhancementRoutes);
app.use("/api/forge/fusion", forgeFusionRoutes);
app.use("/api/forge/tier-upgrade", forgeTierUpgradeRoutes);
// Route de santé de l'API
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Unity Gacha Game API is running",
    version: "1.0.0",
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// Route de santé détaillée
app.get("/health", async (req: Request, res: Response) => {
  const healthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: "unknown",
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  };

  try {
    // Vérification de la connexion MongoDB
    const dbState = mongoose.connection.readyState;
    healthCheck.services.database = dbState === 1 ? "connected" : "disconnected";
    
    if (dbState !== 1) {
      healthCheck.status = "degraded";
    }

    res.json(healthCheck);
  } catch (err) {
    healthCheck.status = "unhealthy";
    healthCheck.services.database = "error";
    res.status(503).json(healthCheck);
  }
});

// Route pour les métriques (optionnel, pour monitoring)
app.get("/metrics", async (req: Request, res: Response) => {
  try {
    if (mongoose.connection.db) {
      const stats = await mongoose.connection.db.stats();
      const metrics = {
        database: {
          collections: stats.collections,
          dataSize: stats.dataSize,
          indexSize: stats.indexSize,
          storageSize: stats.storageSize
        },
        server: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          cpu: process.cpuUsage()
        }
      };
      res.json(metrics);
    } else {
      res.status(500).json({ error: "Database not connected" });
    }
  } catch (err) {
    res.status(500).json({ error: "Unable to retrieve metrics" });
  }
});

// Middleware pour les routes non trouvées
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
    code: "ROUTE_NOT_FOUND",
    path: req.originalUrl,
    method: req.method
  });
});

// Application du middleware de gestion d'erreurs
app.use(errorHandler);

// Fonction de démarrage du serveur
const startServer = async (): Promise<void> => {
  try {
    // Connexion à la base de données
    await connectDB();
    
    // Démarrage du serveur
const server = app.listen(PORT, "0.0.0.0", () => {
  const publicIP = process.env.SERVER_IP || "88.99.61.188";

  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${NODE_ENV}`);
  console.log(`📊 API Health: http://${publicIP}:${PORT}/health`);
});


    // Gestion gracieuse de l'arrêt
    const gracefulShutdown = (signal: string) => {
      console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        console.log("🔌 HTTP server closed");
        
        try {
          await mongoose.connection.close();
          console.log("🗄️ MongoDB connection closed");
          console.log("✅ Graceful shutdown completed");
          process.exit(0);
        } catch (err) {
          console.error("❌ Error during shutdown:", err);
          process.exit(1);
        }
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error("⚠️ Forcing shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    // Gestionnaires de signaux pour shutdown gracieux
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    
    // Gestionnaire d'erreurs non capturées
    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    });
    
    process.on("uncaughtException", (error) => {
      console.error("❌ Uncaught Exception:", error);
      process.exit(1);
    });
    
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Démarrage de l'application
if (require.main === module) {
  startServer();
}

export default app;

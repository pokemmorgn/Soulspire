import express, { Application, Request, Response, NextFunction } from "express";
import { createServer } from "http";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import path from "path";
import { setupAdminPanel, shutdownAdminPanel } from './serverAdmin';

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
import leaderboardRoutes from "./routes/leaderboard";
import heroFusionRoutes from "./routes/herofusion";
import mailRoutes from "./routes/mail";
import afkFarmingRoutes from "./routes/afkFarming";
import notificationRoutes from "./routes/notifications";
import tutorialRoutes from "./routes/tutorials";
import arenaRoutes from "./routes/arena";
import guildRoutes from "./routes/guild";

// Import des services
import { ShopService } from "./services/ShopService";
import { SchedulerService } from "./services/SchedulerService";
import { ArenaCache } from './services/arena/ArenaCache';
import { WebSocketService } from './services/WebSocketService';

// Panel Admin
import { panelConfig, validateEnvironment } from './PanelAdmin/config/panelConfig';

// Configuration de l'environnement
dotenv.config();

const app: Application = express();

// ===== CONFIGURATION SÉCURISÉE DU PROXY =====
const NODE_ENV = process.env.NODE_ENV || "development";

if (NODE_ENV === "production") {
  // En production, configuration spécifique pour les proxies connus
  // Ajustez ces valeurs selon votre infrastructure
  const trustedProxies = [
    'loopback', // 127.0.0.1/8, ::1/128
    'linklocal', // 169.254.0.0/16, fe80::/10
    'uniquelocal', // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7
    // Ajoutez ici les IP spécifiques de votre load balancer/proxy si nécessaire
    // '10.0.0.1', // Exemple d'IP de load balancer
  ];
  
  app.set('trust proxy', trustedProxies);
  console.log('✅ Proxy trust configured for production with specific trusted proxies');
} else {
  // En développement, configuration plus permissive mais sécurisée
  app.set('trust proxy', 'loopback');
  console.log('✅ Proxy trust configured for development (loopback only)');
}

const httpServer = createServer(app);
const PORT: number = parseInt(process.env.PORT || "3000", 10);
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/unity-gacha-game";

// Configuration CORS
const corsOptions = {
  origin: NODE_ENV === "production" 
    ? ["https://your-unity-game-domain.com"] // Remplacez par votre domaine
    : ["http://localhost:3000", "http://127.0.0.1:3000"], // Dev et Unity local
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};

// ===== FONCTION SÉCURISÉE POUR OBTENIR L'IP CLIENT =====
const getClientIP = (req: Request): string => {
  // Méthode sécurisée pour obtenir la vraie IP du client
  if (NODE_ENV === "production") {
    // En production, vérifier d'abord X-Forwarded-For puis X-Real-IP
    const forwardedFor = req.get('X-Forwarded-For');
    if (forwardedFor) {
      // Prendre la première IP de la liste (client original)
      const clientIP = forwardedFor.split(',')[0].trim();
      // Validation basique de l'IP
      const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      if (ipRegex.test(clientIP)) {
        return clientIP;
      }
    }
    
    const realIP = req.get('X-Real-IP');
    if (realIP) {
      return realIP;
    }
  }
  
  // Fallback vers req.ip (qui utilise trust proxy)
  return req.ip || req.socket.remoteAddress || 'unknown';
};

// ===== CONFIGURATION RATE LIMITING SÉCURISÉE =====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === "production" ? 100 : 1000,
  message: {
    error: "Too many requests from this IP, please try again later.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Utiliser notre fonction sécurisée pour obtenir l'IP
  keyGenerator: (req: Request) => {
    return getClientIP(req);
  },
  // Configuration supplémentaire pour la sécurité
  skip: (req: Request) => {
    // Optionnel: skip rate limiting pour certaines IP internes
    const ip = getClientIP(req);
    const internalIPs = ['127.0.0.1', '::1', 'localhost'];
    return NODE_ENV === "development" && internalIPs.includes(ip);
  }
});

// Rate limiting pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Maximum 10 tentatives de connexion par IP
  message: {
    error: "Too many authentication attempts, please try again later.",
    code: "AUTH_RATE_LIMIT_EXCEEDED"
  },
  keyGenerator: (req: Request) => getClientIP(req),
  // En cas de dépassement, bloquer plus longtemps
  onLimitReached: (req: Request) => {
    console.warn(`🚨 Auth rate limit exceeded for IP: ${getClientIP(req)}`);
  }
});

// Rate limiting spécial pour le gacha (anti-bot)
const gachaLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Maximum 30 pulls par minute
  message: {
    error: "Too many gacha pulls, please slow down.",
    code: "GACHA_RATE_LIMIT_EXCEEDED"
  },
  keyGenerator: (req: Request) => getClientIP(req)
});

// Nettoyage automatique toutes les 10 minutes
setInterval(() => {
  ArenaCache.performMaintenance();
}, 10 * 60 * 1000);

// Stats du cache toutes les heures (optionnel)
setInterval(() => {
  const stats = ArenaCache.getCacheStats();
  console.log(`📊 Cache Arena: ${stats.entries} entrées, ${stats.stats.hitRate}% hit rate`);
}, 60 * 60 * 1000);

// Middlewares globaux
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(injectServerIdMiddleware);
app.use(serverMiddleware);
// Application du rate limiting
app.use(limiter);

// Middleware de logging personnalisé avec IP sécurisée
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = getClientIP(req);
  
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
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/hero-fusion", heroFusionRoutes);
app.use("/api/mail", mailRoutes);
app.use("/api/afk-farming", afkFarmingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/tutorials", tutorialRoutes);
app.use("/api/arena", arenaRoutes);
app.use("/api/guilds", guildRoutes);

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

// Test de configuration
try {
  validateEnvironment();
  console.log('✅ Panel config loaded:', panelConfig.server.port);
} catch (error) {
  console.error('⚠️ Panel config error:', error);
}

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

// ===== ⚠️ IMPORTANT: LE CATCH-ALL 404 DOIT ÊTRE EN TOUT DERNIER =====
// Middleware pour les routes non trouvées (TOUJOURS EN DERNIER)
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

// Fonction de démarrage du serveur - VERSION COMPLÈTE AVEC INIT
const startServer = async (): Promise<void> => {
  try {
    // Connexion à la base de données
    await connectDB();
    
    // ===== 🔧 SETUP ADMIN PANEL AVANT TOUT LE RESTE =====
    console.log("🔧 Configuration du panel admin...");
    try {
      setupAdminPanel(app);
      console.log("✅ Panel admin configuré avec succès");
    } catch (error) {
      console.error("⚠️ Erreur configuration panel admin:", error);
      console.log("ℹ️ Le serveur continuera sans le panel admin");
    }
    
    // 🛒 INITIALISATION DES BOUTIQUES SYSTÈME
    console.log("🛒 Initialisation des boutiques système...");
    try {
      const shopResult = await ShopService.createPredefinedShops();
      if (shopResult.createdShops.length > 0) {
        console.log(`✅ ${shopResult.createdShops.length} boutiques créées: ${shopResult.createdShops.join(", ")}`);
      } else {
        console.log("✅ Toutes les boutiques système existent déjà");
      }
    } catch (error) {
      console.error("⚠️ Erreur initialisation boutiques:", error);
      // Continue quand même le démarrage - les boutiques peuvent être créées manuellement
    }
    
    // ⏰ DÉMARRAGE DES TÂCHES PROGRAMMÉES
    console.log("⏰ Démarrage des tâches automatiques...");
    try {
      SchedulerService.startAllSchedulers();
      console.log("✅ Tâches programmées actives (resets automatiques des boutiques)");
    } catch (error) {
      console.error("⚠️ Erreur démarrage scheduler:", error);
      console.log("ℹ️ Les boutiques devront être mises à jour manuellement");
    }
    
    // 🔥 Initialiser WebSocket AVANT de démarrer le serveur
    console.log("🔌 Initialisation WebSocket...");
    try {
      WebSocketService.initialize(httpServer);
      console.log("✅ WebSocket Server initialisé");
    } catch (error) {
      console.warn("⚠️ WebSocket indisponible:", error);
    }
    
    // Démarrage du serveur
    const server = httpServer.listen(PORT, "0.0.0.0", () => {
      const publicIP = process.env.SERVER_IP || "88.99.61.188";

      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${NODE_ENV}`);
      console.log(`🔒 Proxy trust: ${NODE_ENV === 'production' ? 'Production (secured)' : 'Development (loopback)'}`);
      console.log(`📊 API Health: http://${publicIP}:${PORT}/health`);
      console.log(`🔌 WebSocket available at ws://${publicIP}:${PORT}`);
      console.log(`👨‍💼 Admin Panel: http://${publicIP}:${PORT}/admin-panel/index.html`);
      console.log(`🔐 Admin API: http://${publicIP}:${PORT}/api/admin/health`);
      
      // Affichage du statut des services après démarrage
      setTimeout(async () => {
        try {
          const schedulerStatus = SchedulerService.getSchedulerStatus();
          const shopStats = await ShopService.getShopStats();
          
          console.log("📋 === STATUS DES SERVICES ===");
          console.log(`🛒 Boutiques actives: ${shopStats.stats.length} types`);
          console.log(`⏰ Tâches programmées: ${schedulerStatus.totalTasks} actives`);
          
          // Détail des boutiques
          shopStats.stats.forEach((stat: any) => {
            console.log(`   • ${stat.shopType}: ${stat.totalItems} objets`);
          });
          
          // Détail des tâches
          schedulerStatus.tasks.forEach((task: any) => {
            console.log(`   • ${task.name}: ${task.running ? "✅" : "❌"}`);
          });
          
          console.log("================================");
        } catch (error) {
          console.log("📋 Services initialisés (détails non disponibles)");
        }
      }, 2000);
    });

    // Gestion gracieuse de l'arrêt
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);
      
      // Arrêt des tâches programmées en premier
      try {
        console.log("⏹️ Arrêt des tâches programmées...");
        SchedulerService.stopAllSchedulers();
        console.log("✅ Tâches programmées arrêtées");
      } catch (error) {
        console.error("⚠️ Erreur arrêt scheduler:", error);
      }
      
      // 🔥 Arrêt WebSocket
      try {
        console.log("🔌 Fermeture WebSocket...");
        WebSocketService.close();
        console.log("✅ WebSocket fermé");
      } catch (error) {
        console.error("⚠️ Erreur fermeture WebSocket:", error);
      }
      
      // Arrêt du panel admin
      await shutdownAdminPanel();
      
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

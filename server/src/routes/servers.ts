import express, { Request, Response } from "express";
import Joi from "joi";
import { GameServer, CrossServerConfig } from "../models/Server";
import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// Schémas de validation
const createServerSchema = Joi.object({
  serverId: Joi.string().pattern(/^S\d+$/).required(),
  name: Joi.string().min(3).max(50).required(),
  region: Joi.string().valid("EU", "NA", "ASIA", "GLOBAL").required(),
  maxPlayers: Joi.number().min(100).max(50000).default(10000)
});

const updateServerSchema = Joi.object({
  name: Joi.string().min(3).max(50).optional(),
  status: Joi.string().valid("online", "maintenance", "offline").optional(),
  maxPlayers: Joi.number().min(100).max(50000).optional(),
  isNewPlayerAllowed: Joi.boolean().optional(),
  crossServerConfig: Joi.object({
    allowedServers: Joi.array().items(Joi.string().pattern(/^S\d+$/)).optional(),
    globalEvents: Joi.boolean().optional(),
    crossServerArena: Joi.boolean().optional(),
    crossServerGuilds: Joi.boolean().optional()
  }).optional()
});

const crossServerConfigSchema = Joi.object({
  configName: Joi.string().required(),
  globalRules: Joi.object({
    maxServersPerEvent: Joi.number().min(2).max(10).optional(),
    crossServerCooldown: Joi.number().min(1).max(168).optional(),
    maintenanceMode: Joi.boolean().optional()
  }).optional(),
  eventConfigs: Joi.array().items(
    Joi.object({
      eventType: Joi.string().valid("raid", "pvp", "tournament", "boss").required(),
      allowedServers: Joi.array().items(Joi.string().pattern(/^S\d+$/)).required(),
      minServerLevel: Joi.number().min(1).default(1),
      maxParticipants: Joi.number().min(10).default(100),
      rewardsMultiplier: Joi.number().min(0.5).max(3.0).default(1.0)
    })
  ).optional()
});

// === GET ALL SERVERS (Public) ===
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const region = req.query.region as string;
    const status = req.query.status as string;
    const availableOnly = req.query.availableOnly === "true";

    let filter: any = {};
    
    if (region) filter.region = region;
    if (status) filter.status = status;
    if (availableOnly) {
      filter.status = "online";
      filter.isNewPlayerAllowed = true;
      filter.$expr = { $lt: ["$currentPlayers", "$maxPlayers"] };
    }

    const servers = await GameServer.find(filter)
      .select("serverId name region status currentPlayers maxPlayers isNewPlayerAllowed launchDate")
      .sort({ serverId: 1 });

    res.json({
      message: "Servers list retrieved successfully",
      servers: servers.map(server => ({
        serverId: server.serverId,
        name: server.name,
        region: server.region,
        status: server.status,
        population: {
          current: server.currentPlayers,
          max: server.maxPlayers,
          percentage: Math.round((server.currentPlayers / server.maxPlayers) * 100)
        },
        isNewPlayerAllowed: server.isNewPlayerAllowed,
        launchDate: server.launchDate,
        canJoin: server.status === "online" && 
                server.isNewPlayerAllowed && 
                server.currentPlayers < server.maxPlayers
      }))
    });

  } catch (err) {
    console.error("Get servers error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_SERVERS_FAILED"
    });
  }
});

// === GET SERVER DETAILS ===
router.get("/:serverId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { serverId } = req.params;

    if (!serverId.match(/^S\d+$/)) {
      res.status(400).json({
        error: "Invalid server ID format. Expected: S1, S2, etc.",
        code: "INVALID_SERVER_ID"
      });
      return;
    }

    const server = await GameServer.findOne({ serverId });
    if (!server) {
      res.status(404).json({
        error: "Server not found",
        code: "SERVER_NOT_FOUND"
      });
      return;
    }

    res.json({
      message: "Server details retrieved successfully",
      server: {
        serverId: server.serverId,
        name: server.name,
        region: server.region,
        status: server.status,
        population: {
          current: server.currentPlayers,
          max: server.maxPlayers,
          percentage: Math.round((server.currentPlayers / server.maxPlayers) * 100)
        },
        isNewPlayerAllowed: server.isNewPlayerAllowed,
        launchDate: server.launchDate,
        lastMaintenance: server.lastMaintenance,
        version: server.version,
        crossServerConfig: server.crossServerConfig,
        economy: server.serverEconomy
      }
    });

  } catch (err) {
    console.error("Get server details error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_SERVER_DETAILS_FAILED"
    });
  }
});

// === CREATE NEW SERVER (Admin) ===
router.post("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    
    const { error } = createServerSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { serverId, name, region, maxPlayers } = req.body;

    // Vérifier que le serverId n'existe pas déjà
    const existingServer = await GameServer.findOne({ serverId });
    if (existingServer) {
      res.status(400).json({
        error: `Server ${serverId} already exists`,
        code: "SERVER_ALREADY_EXISTS"
      });
      return;
    }

    // Créer le nouveau serveur
    const newServer = new GameServer({
      serverId,
      name,
      region,
      maxPlayers,
      status: "online",
      isNewPlayerAllowed: true,
      crossServerConfig: {
        allowedServers: [],
        globalEvents: true,
        crossServerArena: false,
        crossServerGuilds: false
      },
      version: "1.0.0",
      serverEconomy: {
        totalGoldCirculation: 0,
        totalGemsSpent: 0,
        averagePlayerLevel: 1,
        topGuildName: ""
      }
    });

    await newServer.save();

    console.log(`✨ Nouveau serveur créé: ${serverId} (${name})`);

    res.status(201).json({
      message: "Server created successfully",
      server: {
        serverId: newServer.serverId,
        name: newServer.name,
        region: newServer.region,
        status: newServer.status,
        maxPlayers: newServer.maxPlayers
      }
    });

  } catch (err) {
    console.error("Create server error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "CREATE_SERVER_FAILED"
    });
  }
});

// === UPDATE SERVER CONFIG (Admin) ===
router.put("/:serverId", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    
    const { serverId } = req.params;
    const { error } = updateServerSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const server = await GameServer.findOne({ serverId });
    if (!server) {
      res.status(404).json({
        error: "Server not found",
        code: "SERVER_NOT_FOUND"
      });
      return;
    }

    // Mettre à jour les champs autorisés
    const updateFields = req.body;
    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] !== undefined) {
        (server as any)[key] = updateFields[key];
      }
    });

    // Logs pour maintenance
    if (updateFields.status === "maintenance") {
      server.lastMaintenance = new Date();
      console.log(`🔧 Serveur ${serverId} en maintenance`);
    }

    await server.save();

    res.json({
      message: "Server updated successfully",
      server: {
        serverId: server.serverId,
        name: server.name,
        status: server.status,
        crossServerConfig: server.crossServerConfig
      }
    });

  } catch (err) {
    console.error("Update server error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "UPDATE_SERVER_FAILED"
    });
  }
});

// === GET SERVER STATISTICS ===
router.get("/:serverId/stats", async (req: Request, res: Response): Promise<void> => {
  try {
    const { serverId } = req.params;

    const server = await GameServer.findOne({ serverId });
    if (!server) {
      res.status(404).json({
        error: "Server not found",
        code: "SERVER_NOT_FOUND"
      });
      return;
    }

    // TODO: Calculer des statistiques plus détaillées depuis la DB
    const stats = {
      population: {
        current: server.currentPlayers,
        max: server.maxPlayers,
        percentage: Math.round((server.currentPlayers / server.maxPlayers) * 100)
      },
      economy: server.serverEconomy,
      uptime: {
        launchedDays: Math.floor((Date.now() - server.launchDate.getTime()) / (1000 * 60 * 60 * 24)),
        lastMaintenance: server.lastMaintenance,
        status: server.status
      },
      crossServer: {
        allowedConnections: server.crossServerConfig.allowedServers.length,
        globalEventsEnabled: server.crossServerConfig.globalEvents,
        arenaEnabled: server.crossServerConfig.crossServerArena,
        guildsEnabled: server.crossServerConfig.crossServerGuilds
      }
    };

    res.json({
      message: "Server statistics retrieved successfully",
      serverId: server.serverId,
      stats
    });

  } catch (err) {
    console.error("Get server stats error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_SERVER_STATS_FAILED"
    });
  }
});

// === GET CROSS-SERVER CONFIGURATION ===
router.get("/config/cross-server", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    
    const config = await CrossServerConfig.findOne().sort({ createdAt: -1 });
    if (!config) {
      res.status(404).json({
        error: "Cross-server configuration not found",
        code: "CONFIG_NOT_FOUND"
      });
      return;
    }

    res.json({
      message: "Cross-server configuration retrieved successfully",
      config
    });

  } catch (err) {
    console.error("Get cross-server config error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_CROSS_SERVER_CONFIG_FAILED"
    });
  }
});

// === UPDATE CROSS-SERVER CONFIGURATION ===
router.put("/config/cross-server", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Ajouter vérification admin
    
    const { error } = crossServerConfigSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    let config = await CrossServerConfig.findOne({ configName: req.body.configName });
    
    if (!config) {
      // Créer nouvelle configuration
      config = new CrossServerConfig(req.body);
    } else {
      // Mettre à jour configuration existante
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          (config as any)[key] = req.body[key];
        }
      });
    }

    await config.save();

    console.log(`⚙️ Configuration cross-server mise à jour: ${config.configName}`);

    res.json({
      message: "Cross-server configuration updated successfully",
      config
    });

  } catch (err) {
    console.error("Update cross-server config error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "UPDATE_CROSS_SERVER_CONFIG_FAILED"
    });
  }
});

// === GET RECOMMENDED SERVER FOR NEW PLAYER ===
router.get("/recommend/new-player", async (req: Request, res: Response): Promise<void> => {
  try {
    const region = req.query.region as string || "GLOBAL";

    // Chercher des serveurs disponibles dans la région
    const availableServers = await GameServer.find({
      region: { $in: [region, "GLOBAL"] },
      status: "online",
      isNewPlayerAllowed: true,
      $expr: { $lt: ["$currentPlayers", { $multiply: ["$maxPlayers", 0.8] }] } // Max 80% de capacité
    }).sort({ currentPlayers: 1 }); // Prioriser les serveurs moins peuplés

    if (availableServers.length === 0) {
      res.status(503).json({
        error: "No servers available for new players in this region",
        code: "NO_AVAILABLE_SERVERS",
        suggestion: "Try a different region or check back later"
      });
      return;
    }

    const recommendedServer = availableServers[0];

    res.json({
      message: "Recommended server found",
      recommendation: {
        serverId: recommendedServer.serverId,
        name: recommendedServer.name,
        region: recommendedServer.region,
        population: {
          current: recommendedServer.currentPlayers,
          max: recommendedServer.maxPlayers,
          percentage: Math.round((recommendedServer.currentPlayers / recommendedServer.maxPlayers) * 100)
        },
        reason: "Less populated server for better experience"
      },
      alternatives: availableServers.slice(1, 4).map(server => ({
        serverId: server.serverId,
        name: server.name,
        population: Math.round((server.currentPlayers / server.maxPlayers) * 100)
      }))
    });

  } catch (err) {
    console.error("Get server recommendation error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_SERVER_RECOMMENDATION_FAILED"
    });
  }
});

export default router;

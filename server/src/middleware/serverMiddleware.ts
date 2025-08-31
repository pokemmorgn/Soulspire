import { Request, Response, NextFunction } from "express";
import { GameServer } from "../models/Server";
import Player from "../models/Player";

// Extension de l'interface Request pour inclure serverId
declare global {
  namespace Express {
    interface Request {
      serverId?: string;
      serverData?: any;
      allowCrossServer?: boolean;
    }
  }
}

// Middleware principal pour la sélection de serveur
const serverMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Pour certaines routes, pas besoin de serveur (auth globale, liste serveurs, etc.)
    const noServerRoutes = [
      "/api/auth",
      "/api/servers",
      "/api/health",
      "/",
      "/metrics"
    ];
    
    if (noServerRoutes.some(route => req.path.startsWith(route))) {
      next();
      return;
    }

    // Récupérer le serverId depuis les headers ou query params
    let serverId = req.headers["x-server-id"] as string || req.query.serverId as string;
    
    // Si pas de serverId spécifié et utilisateur authentifié, récupérer depuis le profil
    if (!serverId && req.userId) {
      const player = await Player.findById(req.userId).select("serverId");
      if (player && (player as any).serverId) {
        serverId = (player as any).serverId;
      }
    }
    
    // Si toujours pas de serverId, utiliser le serveur par défaut
    if (!serverId) {
      serverId = "S1"; // Serveur par défaut
      console.log(`⚠️ Aucun serverId spécifié, utilisation du défaut: ${serverId}`);
    }
    
    // Valider que le serveur existe et est accessible
    const serverData = await GameServer.getServerById(serverId);
    if (!serverData) {
      res.status(400).json({
        error: `Server ${serverId} not found or unavailable`,
        code: "SERVER_NOT_FOUND"
      });
      return;
    }
    
    // Vérifier le statut du serveur
    if (serverData.status === "offline") {
      res.status(503).json({
        error: `Server ${serverId} is currently offline`,
        code: "SERVER_OFFLINE"
      });
      return;
    }
    
    if (serverData.status === "maintenance") {
      // Permettre aux admins de continuer pendant la maintenance
      // TODO: Ajouter vérification admin
      console.log(`⚠️ Server ${serverId} en maintenance`);
    }
    
    // Injecter les informations serveur dans la requête
    req.serverId = serverId;
    req.serverData = serverData;
    
    // Log pour le développement
    if (process.env.NODE_ENV === "development") {
      console.log(`🌐 Requête ${req.method} ${req.path} sur serveur ${serverId}`);
    }
    
    next();
    
  } catch (error) {
    console.error("Server middleware error:", error);
    res.status(500).json({
      error: "Server selection failed",
      code: "SERVER_MIDDLEWARE_ERROR"
    });
  }
};

// Middleware pour vérifier les interactions cross-server
const crossServerMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Routes qui peuvent nécessiter du cross-server
    const crossServerRoutes = [
      "/api/battle/arena",
      "/api/events",
      "/api/guilds/cross",
      "/api/rankings/global"
    ];
    
    const needsCrossServer = crossServerRoutes.some(route => req.path.startsWith(route));
    
    if (!needsCrossServer) {
      next();
      return;
    }
    
    // Récupérer le serveur cible depuis les paramètres
    const targetServerId = req.body.targetServerId || req.query.targetServerId as string;
    
    if (targetServerId && targetServerId !== req.serverId) {
      // Vérifier si l'interaction cross-server est autorisée
      const sourceServer = req.serverData;
      const canInteract = sourceServer.canInteractWith(targetServerId);
      
      if (!canInteract) {
        res.status(403).json({
          error: `Cross-server interaction not allowed between ${req.serverId} and ${targetServerId}`,
          code: "CROSS_SERVER_FORBIDDEN"
        });
        return;
      }
      
      // Vérifier que le serveur cible existe
      const targetServer = await GameServer.getServerById(targetServerId);
      if (!targetServer || targetServer.status === "offline") {
        res.status(400).json({
          error: `Target server ${targetServerId} not available`,
          code: "TARGET_SERVER_UNAVAILABLE"
        });
        return;
      }
      
      req.allowCrossServer = true;
      console.log(`🔗 Cross-server autorisé: ${req.serverId} → ${targetServerId}`);
    }
    
    next();
    
  } catch (error) {
    console.error("Cross-server middleware error:", error);
    res.status(500).json({
      error: "Cross-server validation failed",
      code: "CROSS_SERVER_ERROR"
    });
  }
};

// Middleware pour injecter le serverId dans les requêtes de base de données
const injectServerIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Sauvegarder les méthodes originales pour les patcher
  const originalJson = res.json;
  const originalSend = res.send;
  
  // Patcher la réponse pour inclure le serverId
  res.json = function(data: any) {
    if (data && typeof data === "object" && req.serverId) {
      data._serverId = req.serverId;
    }
    return originalJson.call(this, data);
  };
  
  next();
};

// Utilitaire pour construire des filtres avec serverId
export const addServerFilter = (baseFilter: any, serverId: string): any => {
  return {
    ...baseFilter,
    serverId: serverId
  };
};

// Utilitaire pour créer des données avec serverId
export const addServerData = (data: any, serverId: string): any => {
  return {
    ...data,
    serverId: serverId
  };
};

// Middleware spécialisé pour vérifier la capacité du serveur
const serverCapacityMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Seulement pour les routes de création de compte/personnage
    const capacityRoutes = ["/api/auth/register"];
    
    if (!capacityRoutes.some(route => req.path.startsWith(route))) {
      next();
      return;
    }
    
    const server = req.serverData;
    
    if (!server.canAcceptNewPlayers()) {
      res.status(503).json({
        error: `Server ${req.serverId} is at capacity or not accepting new players`,
        code: "SERVER_AT_CAPACITY",
        suggestion: "Try a different server",
        alternativeServers: await GameServer.getAvailableServers(server.region)
          .then(servers => servers.map(s => ({ serverId: s.serverId, name: s.name })))
      });
      return;
    }
    
    next();
    
  } catch (error) {
    console.error("Server capacity middleware error:", error);
    next(); // Continuer en cas d'erreur pour ne pas bloquer
  }
};

// Fonction utilitaire pour obtenir la configuration du serveur actuel
export const getCurrentServerConfig = async (serverId: string) => {
  try {
    return await GameServer.getServerById(serverId);
  } catch (error) {
    console.error(`Error getting server config for ${serverId}:`, error);
    return null;
  }
};

// Fonction pour valider les permissions cross-server
export const validateCrossServerPermission = async (
  sourceServerId: string,
  targetServerId: string,
  action: "arena" | "guild" | "event" | "trade"
): Promise<boolean> => {
  try {
    const sourceServer = await GameServer.getServerById(sourceServerId);
    if (!sourceServer) return false;
    
    // Vérifier la configuration spécifique selon l'action
    switch (action) {
      case "arena":
        return sourceServer.crossServerConfig.crossServerArena && 
               sourceServer.canInteractWith(targetServerId);
      case "guild":
        return sourceServer.crossServerConfig.crossServerGuilds && 
               sourceServer.canInteractWith(targetServerId);
      case "event":
        return sourceServer.crossServerConfig.globalEvents && 
               sourceServer.canInteractWith(targetServerId);
      default:
        return sourceServer.canInteractWith(targetServerId);
    }
  } catch (error) {
    console.error("Error validating cross-server permission:", error);
    return false;
  }
};

// Export des middlewares
export default serverMiddleware;
export { 
  crossServerMiddleware,
  injectServerIdMiddleware,
  serverCapacityMiddleware
};

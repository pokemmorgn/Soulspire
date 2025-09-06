import { Request, Response, NextFunction } from "express";
import { FeatureUnlockService } from "../services/FeatureUnlockService";

/**
 * Middleware pour protéger les routes selon les déblocages de features
 * Usage: router.post("/summon", authMiddleware, requireFeature("gacha"), handler);
 */
export const requireFeature = (featureId: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Vérifier que le joueur est authentifié
      if (!req.playerId || !req.serverId) {
        res.status(401).json({ 
          error: "Authentication required for feature access",
          code: "AUTH_REQUIRED",
          featureId
        });
        return;
      }

      // Vérifier si la feature est débloquée
      console.log(`🔓 Checking feature access: ${featureId} for player ${req.playerId} on server ${req.serverId}`);
      
      await FeatureUnlockService.validateFeatureAccess(req.playerId, req.serverId, featureId);
      
      console.log(`✅ Feature ${featureId} access granted`);
      next();
      
    } catch (error: any) {
      console.log(`❌ Feature ${featureId} access denied: ${error.message}`);
      
      // Récupérer les détails de la feature pour une meilleure erreur
      const featureConfig = FeatureUnlockService.getFeatureConfig(featureId);
      
      res.status(403).json({
        error: error.message,
        code: "FEATURE_LOCKED",
        featureId,
        featureName: featureConfig?.name || "Unknown Feature",
        requirement: featureConfig?.condition.description || "Unknown requirement",
        category: featureConfig?.category || "unknown"
      });
    }
  };
};

/**
 * Middleware optionnel pour injecter les informations de features dans la requête
 * Utile pour les routes qui veulent connaître le statut des features sans bloquer
 */
export const injectFeatureInfo = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.playerId && req.serverId) {
        // Ajouter les features débloquées à la requête
        const unlockedFeatures = await FeatureUnlockService.getUnlockedFeatures(req.playerId, req.serverId);
        const nextUnlock = await FeatureUnlockService.getNextUnlock(req.playerId, req.serverId);
        
        // Injection dans l'objet Request pour utilisation dans les handlers
        (req as any).unlockedFeatures = unlockedFeatures.map(f => f.featureId);
        (req as any).nextUnlock = nextUnlock;
        
        console.log(`📊 Injected feature info for player ${req.playerId}: ${(req as any).unlockedFeatures.length} features unlocked`);
      }
      
      next();
      
    } catch (error: any) {
      console.warn(`⚠️ Failed to inject feature info: ${error.message}`);
      // Ne pas bloquer la requête en cas d'erreur
      next();
    }
  };
};

/**
 * Middleware pour vérifier plusieurs features à la fois
 * Usage: router.post("/complex", authMiddleware, requireMultipleFeatures(["gacha", "hero_upgrade"]), handler);
 */
export const requireMultipleFeatures = (featureIds: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.playerId || !req.serverId) {
        res.status(401).json({ 
          error: "Authentication required for feature access",
          code: "AUTH_REQUIRED",
          requiredFeatures: featureIds
        });
        return;
      }

      console.log(`🔓 Checking multiple features access: [${featureIds.join(", ")}] for player ${req.playerId}`);
      
      // Vérifier chaque feature
      const accessResults = await Promise.allSettled(
        featureIds.map(featureId => 
          FeatureUnlockService.validateFeatureAccess(req.playerId!, req.serverId!, featureId)
        )
      );
      
      // Identifier les features bloquées
      const blockedFeatures: string[] = [];
      accessResults.forEach((result, index) => {
        if (result.status === "rejected") {
          blockedFeatures.push(featureIds[index]);
        }
      });
      
      if (blockedFeatures.length > 0) {
        const blockedConfigs = blockedFeatures.map(id => FeatureUnlockService.getFeatureConfig(id));
        
        res.status(403).json({
          error: `Access denied. Required features not unlocked: ${blockedFeatures.join(", ")}`,
          code: "MULTIPLE_FEATURES_LOCKED",
          blockedFeatures,
          requirements: blockedConfigs.map(config => ({
            featureId: config?.featureId,
            name: config?.name,
            requirement: config?.condition.description
          }))
        });
        return;
      }
      
      console.log(`✅ All features [${featureIds.join(", ")}] access granted`);
      next();
      
    } catch (error: any) {
      console.error(`❌ Multiple features access check failed:`, error);
      
      res.status(500).json({
        error: "Failed to check feature access",
        code: "FEATURE_CHECK_FAILED",
        requiredFeatures: featureIds
      });
    }
  };
};

/**
 * Middleware pour features optionnelles - ne bloque pas mais ajoute des warnings
 * Usage: router.get("/shop", authMiddleware, warnIfFeatureLocked("shop_premium"), handler);
 */
export const warnIfFeatureLocked = (featureId: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.playerId && req.serverId) {
        const isUnlocked = await FeatureUnlockService.isFeatureUnlocked(req.playerId, req.serverId, featureId);
        
        if (!isUnlocked) {
          const featureConfig = FeatureUnlockService.getFeatureConfig(featureId);
          console.log(`⚠️ Player ${req.playerId} accessing route with locked feature: ${featureId}`);
          
          // Ajouter un warning dans la réponse (sera visible dans les logs ou le debug)
          (req as any).featureWarning = {
            featureId,
            featureName: featureConfig?.name,
            requirement: featureConfig?.condition.description,
            message: `Feature '${featureConfig?.name}' is not unlocked yet`
          };
        }
      }
      
      next();
      
    } catch (error: any) {
      console.warn(`⚠️ Feature warning check failed for ${featureId}:`, error.message);
      next(); // Continuer même en cas d'erreur
    }
  };
};

/**
 * Helper function pour vérifier une feature dans un handler sans middleware
 * Usage dans un handler: if (await checkFeatureInHandler(req, "gacha")) { ... }
 */
export const checkFeatureInHandler = async (req: Request, featureId: string): Promise<boolean> => {
  try {
    if (!req.playerId || !req.serverId) {
      return false;
    }
    
    return await FeatureUnlockService.isFeatureUnlocked(req.playerId, req.serverId, featureId);
    
  } catch (error) {
    console.error(`Error checking feature ${featureId} in handler:`, error);
    return false;
  }
};

// Export par défaut du middleware principal
export default requireFeature;

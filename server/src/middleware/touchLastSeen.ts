import { Request, Response, NextFunction } from "express";
import Player from "../models/Player";

/** Expose req.user.id et req.serverId au typage */
declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string };
    serverId?: string; // vient de ton injectServerIdMiddleware
  }
}

/**
 * Met à jour Player.lastSeenAt à chaque requête authentifiée.
 * - Scope par serveur (le Player est déjà scoped par { _id, serverId }).
 * - Pas de modification des timestamps Mongoose (createdAt/updatedAt) pour éviter le bruit.
 */
export const touchLastSeen = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const playerId = req.user?.id;
    if (!playerId) return next(); // non-auth : on ignore

    // Optionnel: si tu veux forcer la cohérence de serveur
    const query: any = { _id: playerId };
    if (req.serverId) query.serverId = req.serverId;

    await Player.updateOne(
      query,
      { $set: { lastSeenAt: new Date() } },
      // @ts-expect-error: some Mongoose versions ignore this option; harmless
      { timestamps: false }
    );
  } catch (err) {
    // On log mais on ne bloque pas la requête si ce "touch" échoue
    console.warn("touchLastSeen middleware warning:", err);
  } finally {
    next();
  }
};

export default touchLastSeen;

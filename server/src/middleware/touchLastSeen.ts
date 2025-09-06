import { Request, Response, NextFunction } from "express";
import Player from "../models/Player";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string };
    serverId?: string;
    playerId?: string; // AJOUT
  }
}

export const touchLastSeen = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    // CORRECTION: Utiliser req.playerId du nouveau middleware
    const playerId = req.playerId;
    if (!playerId) return next();

    // CORRECTION: Chercher par playerId au lieu de _id
    const query: any = { playerId: playerId };
    if (req.serverId) query.serverId = req.serverId;

    await Player.updateOne(
      query,
      { $set: { lastSeenAt: new Date() } },
      { timestamps: false }
    );
  } catch (err) {
    console.warn("touchLastSeen middleware warning:", err);
  } finally {
    next();
  }
};

export default touchLastSeen;

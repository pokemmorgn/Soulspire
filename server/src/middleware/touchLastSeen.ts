import { Request, Response, NextFunction } from "express";
import Player from "../models/Player";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string };
    serverId?: string;
  }
}

export const touchLastSeen = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const playerId = req.user?.id;
    if (!playerId) return next();

    const query: any = { _id: playerId };
    if (req.serverId) query.serverId = req.serverId;

    await Player.updateOne(
      query,
      { $set: { lastSeenAt: new Date() } },
      { timestamps: false } // OK si ta version de @types/mongoose le supporte
    );
  } catch (err) {
    console.warn("touchLastSeen middleware warning:", err);
  } finally {
    next();
  }
};

export default touchLastSeen;

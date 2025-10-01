// server/src/routes/mythic.routes.ts

import { Router, Request, Response } from "express";
import { MythicService } from "../services/MythicService";
import authMiddleware from "../middleware/authMiddleware";

const router = Router();

// ============================================================
// GET /api/mythic/status
// Obtenir l'état complet du système mythique pour un joueur
// ============================================================

router.get("/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId;
    const serverId = req.serverId;

    if (!playerId || !serverId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED"
      });
    }

    console.log(`📊 Getting mythic status for player ${playerId} on server ${serverId}`);

    const status = await MythicService.getMythicStatus(playerId, serverId);

    res.status(200).json({
      success: true,
      data: status
    });

  } catch (error: any) {
    console.error("❌ Error getting mythic status:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get mythic status"
    });
  }
});

// ============================================================
// POST /api/mythic/pull
// Effectuer un pull sur la bannière mythique
// Body: { bannerId: string, count: number }
// ============================================================

router.post("/pull", authMiddleware, async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId;
    const serverId = req.serverId;
    const { bannerId, count } = req.body;

    if (!playerId || !serverId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED"
      });
    }

    // Validation
    if (!bannerId || typeof bannerId !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid bannerId"
      });
    }

    if (!count || (count !== 1 && count !== 10)) {
      return res.status(400).json({
        success: false,
        error: "Invalid count. Must be 1 or 10."
      });
    }

    console.log(`🔮 Player ${playerId} pulling ${count}x on mythic banner ${bannerId}`);

    const result = await MythicService.performMythicPull(
      playerId,
      serverId,
      bannerId,
      count
    );

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error("❌ Error performing mythic pull:", error);
    
    // Erreurs spécifiques
    if (error.message.includes("Insufficient mythic scrolls")) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: "INSUFFICIENT_SCROLLS"
      });
    }

    if (error.message.includes("not found") || error.message.includes("not active")) {
      return res.status(404).json({
        success: false,
        error: error.message,
        code: "BANNER_NOT_FOUND"
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Failed to perform mythic pull"
    });
  }
});

// ============================================================
// GET /api/mythic/history
// Obtenir l'historique des héros mythiques obtenus
// ============================================================

router.get("/history", authMiddleware, async (req: Request, res: Response) => {
  try {
    const playerId = req.playerId;
    const serverId = req.serverId;

    if (!playerId || !serverId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED"
      });
    }

    console.log(`📜 Getting mythic history for player ${playerId}`);

    const history = await MythicService.getMythicHistory(playerId, serverId);

    res.status(200).json({
      success: true,
      data: {
        history,
        totalMythicsObtained: history.length
      }
    });

  } catch (error: any) {
    console.error("❌ Error getting mythic history:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get mythic history"
    });
  }
});

// ============================================================
// GET /api/mythic/banner
// Obtenir la bannière mythique active
// ============================================================

router.get("/banner", authMiddleware, async (req: Request, res: Response) => {
  try {
    const serverId = req.serverId;

    if (!serverId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED"
      });
    }

    console.log(`🔮 Getting active mythic banner for server ${serverId}`);

    const Banner = require("../models/Banner").default;

    const mythicBanner = await Banner.findOne({
      type: "Mythic",
      isActive: true,
      isVisible: true,
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() },
      $or: [
        { "serverConfig.allowedServers": serverId },
        { "serverConfig.allowedServers": "ALL" }
      ]
    });

    if (!mythicBanner) {
      return res.status(404).json({
        success: false,
        error: "No active mythic banner found",
        code: "BANNER_NOT_FOUND"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        bannerId: mythicBanner.bannerId,
        name: mythicBanner.name,
        type: mythicBanner.type,
        description: mythicBanner.description,
        rates: mythicBanner.rates,
        costs: mythicBanner.costs,
        pityConfig: mythicBanner.pityConfig,
        bannerImage: mythicBanner.bannerImage,
        iconImage: mythicBanner.iconImage,
        tags: mythicBanner.tags,
        endTime: mythicBanner.endTime,
        timeRemaining: Math.max(0, mythicBanner.endTime.getTime() - Date.now()),
        specialInfo: {
          scrollCost: {
            single: mythicBanner.costs.singlePull.mythicScrolls || 1,
            multi: mythicBanner.costs.multiPull.mythicScrolls || 10
          },
          pityThreshold: mythicBanner.pityConfig?.legendaryPity || 35,
          scrollEarnRate: "1 scroll per 80 Normal/Limited pulls"
        }
      }
    });

  } catch (error: any) {
    console.error("❌ Error getting mythic banner:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get mythic banner"
    });
  }
});

// ============================================================
// GET /api/mythic/info
// Obtenir les informations générales sur le système mythique
// ============================================================

router.get("/info", async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        systemName: "Mythic Summoning System",
        description: "The ultimate gacha system for endgame players",
        requirements: {
          scrollEarning: "Perform 80 pulls on Standard or Limited banners to earn 1 Mythic Scroll",
          scrollUse: "Use Mythic Scrolls to pull on the Eternal Mythic Summon banner"
        },
        rates: {
          mythic: "5%",
          legendary: "95%"
        },
        pity: {
          threshold: 35,
          description: "Guaranteed Mythic hero after 35 pulls without one"
        },
        features: [
          "Fused pull counter (Standard + Limited)",
          "Permanent scroll accumulation",
          "Exclusive Mythic heroes with unique passives",
          "Separate pity system from other banners"
        ]
      }
    });

  } catch (error: any) {
    console.error("❌ Error getting mythic info:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get mythic info"
    });
  }
});

export default router;

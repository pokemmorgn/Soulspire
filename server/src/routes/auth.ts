import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Joi from "joi";
import Account from "../models/Account";
import Player from "../models/Player";
import { LoginRequest, LoginResponse, AuthTokens, JWTPayload } from "../types/index";

const router = express.Router();

const authSchema = Joi.object({
  username: Joi.string().min(3).max(20).required().messages({
    'string.min': 'Username must be at least 3 characters long',
    'string.max': 'Username must be at most 20 characters long',
    'any.required': 'Username is required'
  }),
  password: Joi.string().min(6).max(50).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'string.max': 'Password must be at most 50 characters long',
    'any.required': 'Password is required'
  }),
  serverId: Joi.string().pattern(/^S\d+$/).optional().default("S1").messages({
    'string.pattern.base': 'Server ID must be in format S1, S2, etc.'
  })
});

const refreshTokenSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Refresh token is required'
  })
});

function generateTokens(accountId: string, playerId: string, serverId: string): AuthTokens {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!jwtSecret || !jwtRefreshSecret) {
    throw new Error("JWT secrets not configured");
  }

  const accessToken = jwt.sign(
    { 
      accountId, 
      playerId, 
      serverId,
      id: playerId
    },
    jwtSecret,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { 
      accountId, 
      playerId, 
      serverId,
      id: playerId
    },
    jwtRefreshSecret,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
}

// === REGISTER ===
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = authSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { username, password, serverId }: LoginRequest & { serverId: string } = req.body;

    const existingAccount = await Account.findOne({ username });
    if (existingAccount) {
      res.status(400).json({ 
        error: "Username already taken",
        code: "USERNAME_EXISTS"
      });
      return;
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const account = new Account({ 
      username, 
      password: hashedPassword 
    });
    await account.save();

    const player = new Player({
      accountId: account.accountId,
      serverId: serverId,
      displayName: username
    });
    await player.save();

    await account.addServerToList(serverId);

    res.status(201).json({ 
      message: "Registration successful",
      accountId: account.accountId,
      playerId: player.playerId,
      serverId: serverId
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "REGISTRATION_FAILED"
    });
  }
});

// === LOGIN ===
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = authSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { username, password, serverId }: LoginRequest & { serverId: string } = req.body;

    const account = await Account.findOne({ username });
    if (!account) {
      res.status(404).json({ 
        error: "Account not found",
        code: "ACCOUNT_NOT_FOUND"
      });
      return;
    }

    if (account.accountStatus === "banned") {
      res.status(403).json({ 
        error: "Account is banned",
        code: "ACCOUNT_BANNED"
      });
      return;
    }

    if (account.isSuspended()) {
      res.status(403).json({ 
        error: "Account is suspended",
        code: "ACCOUNT_SUSPENDED",
        suspensionExpiresAt: account.suspensionExpiresAt
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      res.status(400).json({ 
        error: "Invalid password",
        code: "INVALID_PASSWORD"
      });
      return;
    }

    let player = await Player.findOne({ accountId: account.accountId, serverId });
    
    if (!player) {
      player = new Player({
        accountId: account.accountId,
        serverId: serverId,
        displayName: account.username
      });
      await player.save();
      
      await account.addServerToList(serverId);
      console.log(`🎮 Nouveau player créé pour ${account.username} sur ${serverId}`);
    }

    await account.addLoginRecord(
      serverId, 
      "web",
      req.headers['user-agent'],
      req.ip
    );

    player.lastSeenAt = new Date();
    await player.save();

    const tokens = generateTokens(account.accountId, player.playerId, serverId);

    const response: LoginResponse = {
      message: "Login successful",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      playerId: player.playerId,
      accountId: account.accountId,
      serverId: serverId,
      playerInfo: {
        displayName: player.displayName,
        level: player.level,
        vipLevel: player.vipLevel,
        isNewPlayer: player.isNewPlayer
      }
    };

    res.json(response);
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "LOGIN_FAILED"
    });
  }
});

// === REFRESH TOKEN ===
router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = refreshTokenSchema.validate(req.body);
    if (error) {
      res.status(400).json({ 
        error: error.details[0].message,
        code: "VALIDATION_ERROR"
      });
      return;
    }

    const { token } = req.body;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!jwtRefreshSecret) {
      res.status(500).json({ 
        error: "Server configuration error",
        code: "SERVER_CONFIG_ERROR"
      });
      return;
    }

    const decoded = jwt.verify(token, jwtRefreshSecret) as any;
    
    const account = await Account.findOne({ accountId: decoded.accountId });
    if (!account || !decoded.accountId) {
      res.status(404).json({ 
        error: "Account not found",
        code: "ACCOUNT_NOT_FOUND"
      });
      return;
    }

    const player = await Player.findOne({ 
      playerId: decoded.playerId, 
      serverId: decoded.serverId 
    });
    if (!player || !decoded.playerId || !decoded.serverId) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    if (account.accountStatus === "banned" || account.isSuspended()) {
      res.status(403).json({ 
        error: "Account access denied",
        code: "ACCOUNT_ACCESS_DENIED"
      });
      return;
    }

    const tokens = generateTokens(decoded.accountId, decoded.playerId, decoded.serverId);
    
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ 
        error: "Invalid or expired refresh token",
        code: "REFRESH_TOKEN_INVALID"
      });
      return;
    }

    res.status(500).json({ 
      error: "Internal server error",
      code: "REFRESH_FAILED"
    });
  }
});

// === GET ACCOUNT INFO ===
router.get("/account", async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ 
        error: "Authorization required",
        code: "AUTH_REQUIRED"
      });
      return;
    }

    const token = authHeader.split(" ")[1];
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      res.status(500).json({ 
        error: "Server configuration error",
        code: "SERVER_CONFIG_ERROR"
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as any;

    const account = await Account.findOne({ accountId: decoded.accountId })
      .select('-password');

    if (!account || !decoded.accountId) {
      res.status(404).json({ 
        error: "Account not found",
        code: "ACCOUNT_NOT_FOUND"
      });
      return;
    }

    const players = await Player.find({ accountId: account.accountId })
      .select('serverId displayName level vipLevel lastSeenAt createdAt');

    res.json({
      message: "Account info retrieved successfully",
      account: {
        accountId: account.accountId,
        username: account.username,
        email: account.email,
        accountStatus: account.accountStatus,
        totalPlaytimeMinutes: account.totalPlaytimeMinutes,
        totalPurchasesUSD: account.totalPurchasesUSD,
        serverList: account.serverList,
        favoriteServerId: account.favoriteServerId,
        createdAt: (account as any).createdAt || new Date(),
        lastLoginAt: (account as any).lastLoginAt || new Date()
      },
      players: players.map(player => ({
        serverId: player.serverId,
        displayName: player.displayName,
        level: player.level,
        vipLevel: player.vipLevel,
        lastSeenAt: player.lastSeenAt,
        accountAge: (player as any).createdAt ? Math.floor((Date.now() - (player as any).createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0
      }))
    });
  } catch (err) {
    console.error("Get account info error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "GET_ACCOUNT_FAILED"
    });
  }
});

// === SWITCH SERVER ===
router.post("/switch-server", async (req: Request, res: Response): Promise<void> => {
  try {
    const { serverId } = req.body;
    
    if (!serverId || !/^S\d+$/.test(serverId)) {
      res.status(400).json({ 
        error: "Invalid server ID",
        code: "INVALID_SERVER_ID"
      });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ 
        error: "Authorization required",
        code: "AUTH_REQUIRED"
      });
      return;
    }

    const token = authHeader.split(" ")[1];
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      res.status(500).json({ 
        error: "Server configuration error",
        code: "SERVER_CONFIG_ERROR"
      });
      return;
    }
    
    const decoded = jwt.verify(token, jwtSecret) as any;

    const account = await Account.findOne({ accountId: decoded.accountId });
    if (!account || !decoded.accountId) {
      res.status(404).json({ 
        error: "Account not found",
        code: "ACCOUNT_NOT_FOUND"
      });
      return;
    }

    let player = await Player.findOne({ accountId: account.accountId, serverId });
    
    if (!player) {
      player = new Player({
        accountId: account.accountId,
        serverId: serverId,
        displayName: account.username
      });
      await player.save();
      
      await account.addServerToList(serverId);
      console.log(`🎮 Nouveau player créé pour ${account.username} sur ${serverId}`);
    }

    const tokens = generateTokens(account.accountId, player.playerId, serverId);

    res.json({
      message: "Server switched successfully",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      playerId: player.playerId,
      serverId: serverId,
      playerInfo: {
        displayName: player.displayName,
        level: player.level,
        vipLevel: player.vipLevel,
        isNewPlayer: player.isNewPlayer
      }
    });

  } catch (err) {
    console.error("Switch server error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      code: "SWITCH_SERVER_FAILED"
    });
  }
});

// === LOGOUT ===
router.post("/logout", (req: Request, res: Response): void => {
  res.json({ 
    message: "Logout successful. Please remove tokens from client storage."
  });
});

export default router;

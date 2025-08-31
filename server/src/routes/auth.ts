import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Joi from "joi";
import Player from "../models/Player";
import { LoginRequest, LoginResponse, AuthTokens, JWTPayload } from "../types/index";

const router = express.Router();

// Schémas de validation
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
  })
});

const refreshTokenSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Refresh token is required'
  })
});

// Génération des tokens
function generateTokens(playerId: string): AuthTokens {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!jwtSecret || !jwtRefreshSecret) {
    throw new Error("JWT secrets not configured");
  }

  const accessToken = jwt.sign(
    { id: playerId },
    jwtSecret,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { id: playerId },
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

    const { username, password }: LoginRequest = req.body;

    // Vérifie si le nom d'utilisateur existe déjà
    const existingPlayer = await Player.findOne({ username });
    if (existingPlayer) {
      res.status(400).json({ 
        error: "Username already taken",
        code: "USERNAME_EXISTS"
      });
      return;
    }

    // Hash du mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Création du joueur
    const player = new Player({ 
      username, 
      password: hashedPassword 
    });
    
    await player.save();

    res.status(201).json({ 
      message: "Registration successful",
      playerId: player._id
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

    const { username, password }: LoginRequest = req.body;

    const player = await Player.findOne({ username });
    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    // Vérification du mot de passe
    const isPasswordValid = await bcrypt.compare(password, player.password);
    if (!isPasswordValid) {
      res.status(400).json({ 
        error: "Invalid password",
        code: "INVALID_PASSWORD"
      });
      return;
    }

    // Génération des tokens
    const tokens = generateTokens(player._id.toString());

    const response: LoginResponse = {
      message: "Login successful",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      playerId: player._id.toString()
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

    const decoded = jwt.verify(token, jwtRefreshSecret) as JWTPayload;
    
    // Vérifier que le joueur existe toujours
    const player = await Player.findById(decoded.id);
    if (!player) {
      res.status(404).json({ 
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
      return;
    }

    const tokens = generateTokens(decoded.id);
    
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

// === LOGOUT (Optionnel - pour invalidation côté client) ===
router.post("/logout", (req: Request, res: Response): void => {
  // Dans une implémentation plus avancée, on pourrait maintenir une blacklist des tokens
  res.json({ 
    message: "Logout successful. Please remove tokens from client storage."
  });
});

export default router;

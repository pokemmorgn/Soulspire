const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization manquant" });
    }

    // Format attendu: "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ error: "Format Authorization invalide" });
    }

    const token = parts[1];
    if (!token) {
      return res.status(401).json({ error: "Token manquant" });
    }

    // Vérification du token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // On injecte directement l'ID joueur dans la requête
    req.userId = decoded.id;

    next();
  } catch (err) {
    return res.status(403).json({ error: "Token invalide ou expiré" });
  }
};

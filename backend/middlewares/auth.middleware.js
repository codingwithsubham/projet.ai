const authService = require("../services/auth.service");

const PUBLIC_ROUTE_KEYS = new Set(["POST:/auth/login"]);

const getRequestRouteKey = (req) => `${req.method.toUpperCase()}:${req.path}`;

const extractBearerToken = (authHeader = "") => {
  const value = String(authHeader || "").trim();
  if (!value.startsWith("Bearer ")) return "";
  return value.slice(7).trim();
};

const authenticateRequest = async (req, res, next) => {
  try {
    if (req.method === "OPTIONS") return next();
    if (PUBLIC_ROUTE_KEYS.has(getRequestRouteKey(req))) return next();

    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Missing Authorization Bearer token",
      });
    }

    const authResult = await authService.verifyToken(token);

    if (!authResult) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    req.user = authResult.user;
    req.auth = authResult.payload;
    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Authentication middleware failed",
      error: error.message,
    });
  }
};

module.exports = { authenticateRequest };
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
    req.userId = authResult.user._id || authResult.user.id;
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

/**
 * Middleware to require admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }
  return next();
};

/**
 * Middleware to require PM or admin role
 */
const requirePMOrAdmin = (req, res, next) => {
  if (!req.user || !['PM', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "PM or Admin access required"
    });
  }
  return next();
};

module.exports = { authenticateRequest, requireAdmin, requirePMOrAdmin };
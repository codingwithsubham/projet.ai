const { getActiveApiKeyFromCache } = require("../services/apiKeyCache.service");

const authenticateMcpRequest = (req, res, next) => {
  try {
    if (req.method === "OPTIONS") return next();

    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "Missing x-api-key header",
      });
    }

    const keyEntry = getActiveApiKeyFromCache(apiKey);

    if (!keyEntry) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: invalid API key",
      });
    }

    // Attach resolved project, role, and user (from assignedTo) to the request
    req.mcpAuth = {
      projectId: keyEntry.projectId,
      projectName: keyEntry.projectName || null,
      role: keyEntry.role,
      apiKeyId: keyEntry.id,
      apiKeyName: keyEntry.name,
      // User associated with this API key (for activity tracking)
      userId: keyEntry.assignedTo || null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "MCP authentication middleware failed",
      error: error.message,
    });
  }
};

module.exports = { authenticateMcpRequest };

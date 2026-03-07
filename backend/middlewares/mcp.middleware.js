const { mockAPIKeys } = require("../common/mockUsers");

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

    const keyEntry = mockAPIKeys.find((entry) => entry.key === apiKey);

    if (!keyEntry) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: invalid API key",
      });
    }

    // Attach resolved project and role to the request
    req.mcpAuth = {
      projectId: keyEntry.project,
      role: keyEntry.role,
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

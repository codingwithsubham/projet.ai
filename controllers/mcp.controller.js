const mcpService = require("../services/mcp.service");

const sseConnect = async (req, res) => {
  try {
    const mcpAuth = req.mcpAuth;

    // Create a project-scoped MCP server and SSE transport for this connection
    // Pass full auth context for activity tracking
    const mcpServer = mcpService.createMcpServerForProject(mcpAuth);
    // Use /api/mcp/sse for newer protocol (POST to same endpoint as SSE)
    const transport = new mcpService.SSEServerTransport("/api/mcp/sse", res);

    mcpService.registerTransport(transport);

    // Clean up when the client disconnects
    res.on("close", () => {
      mcpService.removeTransport(transport.sessionId);
    });

    await mcpServer.connect(transport);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to establish MCP SSE connection",
      error: error.message,
    });
  }
};

const handleMessage = async (req, res) => {
  try {
    const sessionId = req.query.sessionId;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "sessionId query parameter is required",
      });
    }

    const transport = mcpService.getTransport(sessionId);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "No active MCP connection found",
      });
    }

    await transport.handlePostMessage(req, res);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to handle MCP message",
      error: error.message,
    });
  }
};

// Handle POST to /sse (newer MCP protocol) - same as handleMessage but at /sse endpoint
const handleSseMessage = async (req, res) => {
  try {
    const sessionId = req.query.sessionId;

    // No sessionId means client is probing for Streamable HTTP transport
    // Return 404 to signal "use legacy SSE instead"
    if (!sessionId) {
      return res.status(404).json({
        success: false,
        message: "Use GET /sse to establish SSE connection first",
      });
    }

    const transport = mcpService.getTransport(sessionId);
    if (!transport) {
      return res.status(404).json({
        success: false,
        message: "No active MCP connection found",
      });
    }

    await transport.handlePostMessage(req, res);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to handle MCP message",
      error: error.message,
    });
  }
};

module.exports = { sseConnect, handleMessage, handleSseMessage };

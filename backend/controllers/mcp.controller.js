const mcpService = require("../services/mcp.service");

const sseConnect = async (req, res) => {
  try {
    const { projectId } = req.mcpAuth;

    // Create a project-scoped MCP server and SSE transport for this connection
    const mcpServer = mcpService.createMcpServerForProject(projectId);
    const transport = new mcpService.SSEServerTransport("/api/mcp/messages", res);

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

module.exports = { sseConnect, handleMessage };

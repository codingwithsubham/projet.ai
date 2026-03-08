const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { z } = require("zod");
const chatService = require("./chat.service");

/**
 * Create an MCP server instance scoped to a specific project.
 * Each SSE connection gets its own server so the tool knows which project to query.
 * Delegates to chatService → dev agent which uses RAG + GitHub MCP tools.
 */
const createMcpServerForProject = (projectId) => {
  const mcpServer = new McpServer({
    name: "KnowledgeHub",
    version: "1.0.0",
  });

  mcpServer.tool(
    "search_hub",
    "Queries the knowledge hub for project documents, SRS, user stories, epics, bugs and project information",
    { query: z.string().describe("The search query") },
    async ({ query }) => {
      const result = await chatService.sendChatMessageToDynamicAgent({
        projectId,
        message: query,
        agentType: "dev",
      });

      if (!result) {
        return {
          content: [{ type: "text", text: "Project not found" }],
        };
      }

      return {
        content: [{ type: "text", text: result.response }],
      };
    }
  );

  return mcpServer;
};

// Track active transports so POST /messages can be routed to the right connection
const transports = new Map();

const registerTransport = (transport) => {
  transports.set(transport.sessionId, transport);
};

const getTransport = (sessionId) => {
  return transports.get(sessionId) || null;
};

const removeTransport = (sessionId) => {
  transports.delete(sessionId);
};

module.exports = {
  createMcpServerForProject,
  SSEServerTransport,
  registerTransport,
  getTransport,
  removeTransport,
};

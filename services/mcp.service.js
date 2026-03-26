const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { z } = require("zod");
const chatService = require("./chat.service");
const activityLogService = require("./activityLog.service");

/**
 * Create an MCP server instance scoped to a specific project and user.
 * Each SSE connection gets its own server so the tool knows which project/user to query.
 * Delegates to chatService → dev agent which uses RAG + GitHub MCP tools.
 * 
 * @param {Object} mcpAuth - Authentication context from middleware
 * @param {string} mcpAuth.projectId - Project ID
 * @param {string} mcpAuth.userId - User ID (from assignedTo on API key)
 * @param {string} mcpAuth.apiKeyId - API Key ID
 * @param {string} mcpAuth.apiKeyName - API Key name
 * @param {string} mcpAuth.role - User role
 */
const createMcpServerForProject = (mcpAuth) => {
  const { projectId, userId, apiKeyId, role } = mcpAuth;
  
  const mcpServer = new McpServer({
    name: "KnowledgeHub",
    version: "1.0.0",
  });

  // Tool: search_hub - RAG search with activity logging
  mcpServer.tool(
    "search_hub",
    `ALWAYS use this tool FIRST for any question about the project, codebase, or documentation.
This tool searches the Knowledge Hub which contains indexed project codes, documents, SRS, user stories, epics, bugs, API specs, architecture docs, and source code.
The Knowledge Hub is the PRIMARY source of truth - it has been pre-indexed from project repositories and documents.
Only if this tool returns insufficient results should you consider other data sources.
This is a READ operation - execute immediately without asking for confirmation.`,
    { 
      query: z.string().describe("The search query - be specific and include relevant keywords"),
      context: z.object({
        currentFile: z.string().optional().describe("Current file being edited"),
        workspace: z.string().optional().describe("Workspace name"),
        branch: z.string().optional().describe("Git branch name"),
      }).optional().describe("Optional context from VS Code"),
    },
    async ({ query, context }) => {
      const startTime = Date.now();
      let status = "success";
      let errorMessage = null;
      let response = null;

      try {
        const result = await chatService.sendChatMessageToDynamicAgent({
          projectId,
          message: query,
          agentType: "dev",
        });

        if (!result) {
          response = "Project not found";
          status = "error";
          errorMessage = "Project not found";
        } else {
          response = result.response;
        }
      } catch (error) {
        status = "error";
        errorMessage = error.message;
        response = `Error: ${error.message}`;
      }

      const duration = Date.now() - startTime;

      // Log activity asynchronously (don't block response)
      activityLogService.logActivity({
        projectId,
        userId,
        apiKeyId,
        source: "mcp",
        agentType: "dev",
        prompt: query,
        response,
        context: context || {},
        toolsUsed: ["search_hub"],
        duration,
        status,
        errorMessage,
      }).catch(err => console.error("Failed to log MCP activity:", err));

      return {
        content: [{ type: "text", text: response }],
      };
    }
  );

  // Tool: get_my_activity - Get current user's recent activity
  mcpServer.tool(
    "get_my_activity",
    "Get your recent activity and what you were working on. Useful for recalling context or reviewing your progress.",
    {
      days: z.number().optional().default(7).describe("Number of days to look back (default: 7)"),
    },
    async ({ days }) => {
      if (!userId) {
        return {
          content: [{ type: "text", text: "No user associated with this API key. Ask your admin to assign you to this key." }],
        };
      }

      try {
        const result = await activityLogService.getActivitiesByUser(userId, projectId, {
          limit: 20,
          startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        });

        const summary = result.activities.map(a => 
          `- [${new Date(a.createdAt).toLocaleDateString()}] ${a.promptSummary || a.prompt.slice(0, 100)}`
        ).join("\n");

        return {
          content: [{ 
            type: "text", 
            text: `Your recent activity (last ${days} days):\n\n${summary || "No recent activity found."}\n\nTotal: ${result.total} interactions` 
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching activity: ${error.message}` }],
        };
      }
    }
  );

  // Tool: get_team_activity - Get team activity summary (for PMs and leads)
  mcpServer.tool(
    "get_team_activity",
    "Get a summary of what the team has been working on. Shows activity by team member.",
    {
      days: z.number().optional().default(7).describe("Number of days to look back (default: 7)"),
    },
    async ({ days }) => {
      // Only PM, admin, or lead roles can see team activity
      const allowedRoles = ["PM", "admin"];
      if (!allowedRoles.includes(role)) {
        return {
          content: [{ type: "text", text: "Access denied. Only PM and admin roles can view team activity." }],
        };
      }

      try {
        const summary = await activityLogService.getTeamActivitySummary(projectId, days);

        const teamSummary = summary.teamMembers.map(member => {
          const topics = member.topics.filter(t => t).slice(0, 5).join(", ") || "No topics";
          return `**${member.userName || "Unknown"}** (${member.totalActivities} interactions)\n  Topics: ${topics}\n  Last active: ${new Date(member.lastActivity).toLocaleDateString()}`;
        }).join("\n\n");

        return {
          content: [{ 
            type: "text", 
            text: `Team Activity Summary (last ${days} days):\n\n${teamSummary || "No team activity found."}\n\nTotal team interactions: ${summary.totalTeamActivities}` 
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching team activity: ${error.message}` }],
        };
      }
    }
  );

  // Tool: get_developer_context - Get specific developer's context (for handoff)
  mcpServer.tool(
    "get_developer_context",
    "Get what a specific developer has been working on. Useful for handoffs when someone is on leave.",
    {
      developerName: z.string().describe("Name of the developer (partial match supported)"),
      days: z.number().optional().default(7).describe("Number of days to look back (default: 7)"),
    },
    async ({ developerName, days }) => {
      try {
        const context = await activityLogService.getDeveloperActivityByName(projectId, developerName, days);

        if (context.error) {
          return {
            content: [{ type: "text", text: context.error }],
          };
        }

        const topics = context.topics.slice(0, 10).map(t => `- ${t}`).join("\n") || "No topics found";
        const files = context.filesWorkedOn.slice(0, 10).map(f => `- ${f}`).join("\n") || "No files tracked";
        const recentPrompts = context.recentPrompts.slice(0, 5).map(p => 
          `- [${new Date(p.createdAt).toLocaleDateString()}] ${p.summary || p.prompt.slice(0, 80)}`
        ).join("\n") || "No recent prompts";

        const response = `
**Handoff Context for ${context.developer?.name || developerName}**

Period: Last ${days} days (${context.totalActivities} total interactions)

**Topics worked on:**
${topics}

**Files touched:**
${files}

**Recent questions/tasks:**
${recentPrompts}
        `.trim();

        return {
          content: [{ type: "text", text: response }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching developer context: ${error.message}` }],
        };
      }
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

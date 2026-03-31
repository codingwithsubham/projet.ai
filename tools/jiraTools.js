const { MultiServerMCPClient } = require("@langchain/mcp-adapters");

// Jira tools allowed for PM agent (full access)
// Tool names from mcp-jira-cloud package
const PM_ALLOWED_JIRA_TOOLS = new Set([
  "jira_get_issue",
  "jira_create_issue",
  "jira_update_issue",
  "jira_search_issues",
  "jira_list_projects",
  "jira_get_project",
  "jira_list_sprints",
  "jira_get_sprint",
  "jira_create_sprint",
  "jira_get_board",
  "jira_list_boards",
  "jira_transition_issue",
  "jira_add_comment",
  "jira_get_transitions",
  "jira_get_issue_comments",
  "jira_get_statuses",
  "jira_assign_issue",
  "jira_get_issue_summary",
  "jira_search_issues_summary",
  "jira_get_my_open_issues",
]);

// Jira tools allowed for Dev agent (subset)
const DEV_ALLOWED_JIRA_TOOLS = new Set([
  "jira_get_issue",
  "jira_search_issues",
  "jira_list_sprints",
  "jira_get_sprint",
  "jira_get_board",
  "jira_list_boards",
  "jira_get_transitions",
  "jira_transition_issue",
  "jira_add_comment",
  "jira_get_issue_comments",
  "jira_get_statuses",
  "jira_get_issue_summary",
  "jira_get_my_open_issues",
]);

// Read-only Jira tools (no confirmation needed)
const JIRA_READ_ONLY_TOOLS = new Set([
  "jira_get_issue",
  "jira_search_issues",
  "jira_list_projects",
  "jira_get_project",
  "jira_list_sprints",
  "jira_get_sprint",
  "jira_get_board",
  "jira_list_boards",
  "jira_get_transitions",
  "jira_get_issue_comments",
  "jira_get_statuses",
  "jira_get_issue_summary",
  "jira_search_issues_summary",
  "jira_get_my_open_issues",
]);

const normalizeToolName = (name) =>
  String(name || "")
    .trim()
    .toLowerCase();

const isAllowedJiraTool = (tool, allowedSet) => {
  const normalizedName = normalizeToolName(tool?.name);
  if (!normalizedName) return false;
  // Match exact or partial (MCP servers may prefix tool names)
  if (allowedSet.has(normalizedName)) return true;
  return [...allowedSet].some((allowed) => normalizedName.includes(allowed));
};

const isJiraReadOnlyTool = (tool) => {
  const normalizedName = normalizeToolName(tool?.name);
  return JIRA_READ_ONLY_TOOLS.has(normalizedName) ||
    [...JIRA_READ_ONLY_TOOLS].some((allowed) => normalizedName.includes(allowed));
};

/**
 * Build Jira MCP client configuration from project board config
 * 
 * @param {Object} boardConfig - Project board config
 * @returns {Object} MCP server configuration for Jira
 */
const buildJiraMcpConfig = (boardConfig) => {
  const { jira } = boardConfig;
  if (!jira?.baseUrl || !jira?.email || !jira?.apiToken) {
    throw new Error("Jira configuration is incomplete. Required: baseUrl, email, apiToken.");
  }

  return {
    jira: {
      command: "npx",
      args: ["-y", "mcp-jira-cloud@latest"],
      env: {
        JIRA_BASE_URL: jira.baseUrl,
        JIRA_EMAIL: jira.email,
        JIRA_API_TOKEN: jira.apiToken,
      },
      transport: "stdio",
    },
  };
};

/**
 * Build Jira tools for PM agent
 * 
 * @param {Object} project - Project object
 * @returns {Promise<Array>} Array of Jira tools
 */
const buildJiraPmTools = async (project) => {
  const { boardConfig } = project;
  if (!boardConfig || boardConfig.platform !== "jira") {
    return [];
  }

  try {
    const mcpConfig = buildJiraMcpConfig(boardConfig);
    const mcpClient = new MultiServerMCPClient(mcpConfig);
    const allTools = await mcpClient.getTools();

    const filteredTools = allTools.filter((tool) =>
      isAllowedJiraTool(tool, PM_ALLOWED_JIRA_TOOLS)
    );

    console.log(`🔧 Jira PM tools: ${filteredTools.length} tools loaded`);
    return filteredTools;
  } catch (error) {
    console.error("❌ Failed to load Jira PM tools:", error.message);
    return [];
  }
};

/**
 * Build Jira tools for Dev agent
 * 
 * @param {Object} project - Project object
 * @param {Object} [options] - Options
 * @param {boolean} [options.readOnlyMode=false] - Only include read-only tools
 * @returns {Promise<Array>} Array of Jira tools
 */
const buildJiraDevTools = async (project, options = {}) => {
  const { readOnlyMode = false } = options;
  const { boardConfig } = project;
  if (!boardConfig || boardConfig.platform !== "jira") {
    return [];
  }

  try {
    const mcpConfig = buildJiraMcpConfig(boardConfig);
    const mcpClient = new MultiServerMCPClient(mcpConfig);
    const allTools = await mcpClient.getTools();

    let filteredTools = allTools.filter((tool) =>
      isAllowedJiraTool(tool, DEV_ALLOWED_JIRA_TOOLS)
    );

    if (readOnlyMode) {
      filteredTools = filteredTools.filter(isJiraReadOnlyTool);
      console.log(`🔧 Jira Dev tools: ${filteredTools.length} read-only tools loaded`);
    } else {
      console.log(`🔧 Jira Dev tools: ${filteredTools.length} tools loaded`);
    }

    return filteredTools;
  } catch (error) {
    console.error("❌ Failed to load Jira Dev tools:", error.message);
    return [];
  }
};

module.exports = {
  buildJiraPmTools,
  buildJiraDevTools,
  isJiraReadOnlyTool,
  JIRA_READ_ONLY_TOOLS,
  PM_ALLOWED_JIRA_TOOLS,
  DEV_ALLOWED_JIRA_TOOLS,
};

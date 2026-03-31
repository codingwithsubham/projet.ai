const { MultiServerMCPClient } = require("@langchain/mcp-adapters");

// GitHub tools allowed for PM agent (full access)
const PM_ALLOWED_GITHUB_TOOLS = new Set([
  "issue_read",
  "list_issues",
  "search_issues",
  "create_issue",
  "update_issue",
  "search_pull_requests",
  "list_pull_requests",
  "pull_request_read",
  "get_me",
  "create_branch",
  "list_branches",
  "create_pull_request",
  "push_files",
  "create_or_update_file",
  "get_file_contents",
  "get_commit",
  "list_commits",
]);

// GitHub tools allowed for Dev agent (subset — no create/update issue)
const DEV_ALLOWED_GITHUB_TOOLS = new Set([
  "issue_read",
  "list_issues",
  "search_issues",
  "search_pull_requests",
  "list_pull_requests",
  "pull_request_read",
  "get_me",
  "create_branch",
  "list_branches",
  "create_pull_request",
  "push_files",
  "create_or_update_file",
  "get_file_contents",
  "get_commit",
  "list_commits",
]);

// Read-only GitHub tools (no confirmation needed)
const GITHUB_READ_ONLY_TOOLS = new Set([
  "issue_read",
  "list_issues",
  "search_issues",
  "search_pull_requests",
  "list_pull_requests",
  "pull_request_read",
  "get_me",
  "list_branches",
  "get_file_contents",
  "get_commit",
  "list_commits",
]);

// GitHub issue-specific tools (excluded when Jira is the board platform)
const GITHUB_ISSUE_TOOLS = new Set([
  "issue_read",
  "list_issues",
  "search_issues",
  "create_issue",
  "update_issue",
]);

const normalizeToolName = (name) =>
  String(name || "")
    .trim()
    .toLowerCase();

const isAllowedGithubTool = (tool, allowedSet) => {
  const normalizedName = normalizeToolName(tool?.name);
  if (!normalizedName) return false;
  if (allowedSet.has(normalizedName)) return true;
  return [...allowedSet].some((allowed) => normalizedName.includes(allowed));
};

const isGithubReadOnlyTool = (tool) => {
  const normalizedName = normalizeToolName(tool?.name);
  return GITHUB_READ_ONLY_TOOLS.has(normalizedName);
};

/**
 * Build GitHub MCP client configuration from project PAT token
 *
 * @param {string} patToken - GitHub personal access token
 * @returns {Object} MCP server configuration for GitHub
 */
const buildGithubMcpConfig = (patToken) => {
  if (!patToken) {
    throw new Error("GitHub PAT token is required.");
  }

  return {
    github: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: patToken,
      },
      transport: "stdio",
    },
  };
};

/**
 * Build GitHub tools for PM agent
 *
 * @param {Object} project - Project object
 * @param {Object} [options] - Options
 * @param {boolean} [options.excludeIssueTools=false] - Exclude issue tools (when Jira is board)
 * @returns {Promise<Array>} Array of GitHub tools
 */
const buildGithubPmTools = async (project, options = {}) => {
  const { excludeIssueTools = false } = options;

  try {
    const mcpConfig = buildGithubMcpConfig(project.pat_token);
    const mcpClient = new MultiServerMCPClient(mcpConfig);
    const allTools = await mcpClient.getTools();

    let filteredTools = allTools.filter((tool) =>
      isAllowedGithubTool(tool, PM_ALLOWED_GITHUB_TOOLS)
    );

    if (excludeIssueTools) {
      filteredTools = filteredTools.filter(
        (tool) => !GITHUB_ISSUE_TOOLS.has(normalizeToolName(tool?.name))
      );
    }

    console.log(`🔧 GitHub PM tools: ${filteredTools.length} tools loaded`);
    return filteredTools;
  } catch (error) {
    console.error("❌ Failed to load GitHub PM tools:", error.message);
    return [];
  }
};

/**
 * Build GitHub tools for Dev agent
 *
 * @param {Object} project - Project object
 * @param {Object} [options] - Options
 * @param {boolean} [options.readOnlyMode=false] - Only include read-only tools
 * @param {boolean} [options.excludeIssueTools=false] - Exclude issue tools (when Jira is board)
 * @returns {Promise<Array>} Array of GitHub tools
 */
const buildGithubDevTools = async (project, options = {}) => {
  const { readOnlyMode = false, excludeIssueTools = false } = options;

  try {
    const mcpConfig = buildGithubMcpConfig(project.pat_token);
    const mcpClient = new MultiServerMCPClient(mcpConfig);
    const allTools = await mcpClient.getTools();

    let filteredTools = allTools.filter((tool) =>
      isAllowedGithubTool(tool, DEV_ALLOWED_GITHUB_TOOLS)
    );

    if (excludeIssueTools) {
      filteredTools = filteredTools.filter(
        (tool) => !GITHUB_ISSUE_TOOLS.has(normalizeToolName(tool?.name))
      );
    }

    if (readOnlyMode) {
      filteredTools = filteredTools.filter(isGithubReadOnlyTool);
      console.log(`🔧 GitHub Dev tools: ${filteredTools.length} read-only tools loaded`);
    } else {
      console.log(`🔧 GitHub Dev tools: ${filteredTools.length} tools loaded`);
    }

    return filteredTools;
  } catch (error) {
    console.error("❌ Failed to load GitHub Dev tools:", error.message);
    return [];
  }
};

module.exports = {
  buildGithubPmTools,
  buildGithubDevTools,
  isGithubReadOnlyTool,
  GITHUB_READ_ONLY_TOOLS,
  GITHUB_ISSUE_TOOLS,
  PM_ALLOWED_GITHUB_TOOLS,
  DEV_ALLOWED_GITHUB_TOOLS,
};

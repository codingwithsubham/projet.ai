const { MultiServerMCPClient } = require("@langchain/mcp-adapters");

// Dev agent can read issues/PRs and create branches, push files, and open PRs.
const DEV_ALLOWED_TOOL_EXACT = new Set([
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

const DEV_ALLOWED_TOOL_KEYWORDS = [
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
];

// Read-only tools (no confirmation needed)
const READ_ONLY_TOOLS = new Set([
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

const normalizeToolName = (name) =>
  String(name || "")
    .trim()
    .toLowerCase();

const isAllowedDevTool = (tool) => {
  const normalizedName = normalizeToolName(tool?.name);
  if (!normalizedName) return false;

  if (DEV_ALLOWED_TOOL_EXACT.has(normalizedName)) return true;

  return DEV_ALLOWED_TOOL_KEYWORDS.some((keyword) =>
    normalizedName.includes(keyword),
  );
};

const isReadOnlyTool = (tool) => {
  const normalizedName = normalizeToolName(tool?.name);
  return READ_ONLY_TOOLS.has(normalizedName);
};

/**
 * Build dev tools with optional filtering
 * 
 * @param {Object} project - Project object
 * @param {Object} [options] - Options
 * @param {boolean} [options.includeExternalTools=true] - Include GitHub/external tools
 * @param {boolean} [options.readOnlyMode=false] - Only include read-only tools
 * @returns {Promise<Array>} Array of tools
 */
const buildDevTools = async (project, options = {}) => {
  const { includeExternalTools = true, readOnlyMode = false } = options;

  // If external tools are disabled, return empty array
  // The agent will rely on RAG context only
  if (!includeExternalTools) {
    console.log("🔧 Dev tools: External tools disabled (RAG-first mode)");
    return [];
  }

  const mcpClient = new MultiServerMCPClient({
    github: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: project.pat_token,
      },
      transport: "stdio",
    },
  });

  // Initialize tools (e.g., GitHub) and shared feedback tool for Dev agent
  const githubTool = await mcpClient.getTools();
  let filteredDevTools = githubTool.filter(isAllowedDevTool);

  // In read-only mode, only include read operations
  if (readOnlyMode) {
    filteredDevTools = filteredDevTools.filter(isReadOnlyTool);
    console.log(`🔧 Dev tools: ${filteredDevTools.length} read-only tools loaded`);
  } else {
    console.log(`🔧 Dev tools: ${filteredDevTools.length} tools loaded`);
  }

  return [...filteredDevTools];
};

module.exports = { buildDevTools, isReadOnlyTool };

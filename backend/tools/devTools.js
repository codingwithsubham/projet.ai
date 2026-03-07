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

const buildDevTools = async (project) => {
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
  const filteredDevTools = githubTool.filter(isAllowedDevTool);

  return [...filteredDevTools];
};

module.exports = { buildDevTools };

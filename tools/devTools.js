const { buildGithubDevTools, isGithubReadOnlyTool } = require("./githubTools");
const { buildJiraDevTools } = require("./jiraTools");

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

  if (!includeExternalTools) {
    console.log("🔧 Dev tools: External tools disabled (RAG-first mode)");
    return [];
  }

  const boardPlatform = project.boardConfig?.platform || "github";
  const excludeIssueTools = boardPlatform === "jira";

  // Load GitHub tools (code tools always, issue tools only if GitHub is the board)
  const githubTools = await buildGithubDevTools(project, {
    readOnlyMode,
    excludeIssueTools,
  });

  // Load Jira board tools when Jira is the configured platform
  let boardTools = [];
  if (boardPlatform === "jira") {
    boardTools = await buildJiraDevTools(project, { readOnlyMode });
  }

  return [...githubTools, ...boardTools];
};

module.exports = { buildDevTools, isReadOnlyTool: isGithubReadOnlyTool };

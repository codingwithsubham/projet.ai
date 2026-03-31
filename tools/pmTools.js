const { createMarkdownReportTableTool } = require("./commonTools");
const { buildGithubPmTools } = require("./githubTools");
const { buildJiraPmTools } = require("./jiraTools");

const buildPmTools = async (project) => {
  const boardPlatform = project.boardConfig?.platform || "github";
  const excludeIssueTools = boardPlatform === "jira";

  // Load GitHub tools (code tools always, issue tools only if GitHub is the board)
  const githubTools = await buildGithubPmTools(project, { excludeIssueTools });

  // Load Jira board tools when Jira is the configured platform
  let boardTools = [];
  if (boardPlatform === "jira") {
    boardTools = await buildJiraPmTools(project);
  }

  const markdownReportTableTool = createMarkdownReportTableTool();

  return [...githubTools, ...boardTools, markdownReportTableTool];
};

module.exports = { buildPmTools };


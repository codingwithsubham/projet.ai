const { MultiServerMCPClient } = require("@langchain/mcp-adapters");

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

  return [...githubTool];
};

module.exports = { buildDevTools };

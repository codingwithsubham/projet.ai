const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");
const { buildDevTools } = require("../tools/devTools");
const { createMermaidChartTool, createMarkdownReportTableTool } = require("../tools/commonTools");
const { guardToolsForSingleExecution } = require("../helpers/toolExecutionGuard");

const dynamicDevAgent = async (project) => {
  const tools = await buildDevTools(project);
  const mermaidChartTool = createMermaidChartTool();
  const markdownTableTool = createMarkdownReportTableTool();
  const guardedTools = guardToolsForSingleExecution([...tools, mermaidChartTool, markdownTableTool]);

  const agent = createReactAgent({
    llm: llmAgent,
    tools: guardedTools,
  });
  return agent;
};

module.exports = { dynamicDevAgent };

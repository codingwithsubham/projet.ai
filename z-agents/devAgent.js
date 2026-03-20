const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { createLlmForProject } = require("../openai");
const { buildDevTools } = require("../tools/devTools");
const { createMermaidChartTool, createMarkdownReportTableTool } = require("../tools/commonTools");
const { guardToolsForSingleExecution } = require("../helpers/toolExecutionGuard");
const { checkpointer } = require("../orchestration/checkpointer.service");

const dynamicDevAgent = async (project) => {
  const llm = createLlmForProject(project);
  const tools = await buildDevTools(project);
  const mermaidChartTool = createMermaidChartTool();
  const markdownTableTool = createMarkdownReportTableTool();
  const guardedTools = guardToolsForSingleExecution([...tools, mermaidChartTool, markdownTableTool]);

  const agent = createReactAgent({
    llm,
    tools: guardedTools,
    checkpointSaver: checkpointer,
  });
  return agent;
};

module.exports = { dynamicDevAgent };

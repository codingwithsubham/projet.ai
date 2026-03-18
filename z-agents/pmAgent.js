const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");
const { buildPmTools } = require("../tools/pmTools");
const { createStoreHappyFeedbackTool, createMermaidChartTool, createMarkdownReportTableTool } = require("../tools/commonTools");
const { guardToolsForSingleExecution } = require("../helpers/toolExecutionGuard");

const dynamicPmAgent = async (project) => {
  const tools = await buildPmTools(project);
  const happyFeedbackTool = createStoreHappyFeedbackTool(project);
  const mermaidChartTool = createMermaidChartTool();
  const markdownTableTool = createMarkdownReportTableTool();
  const guardedTools = guardToolsForSingleExecution([
    ...tools,
    happyFeedbackTool,
    mermaidChartTool,
    markdownTableTool,
  ]);

  const agent = createReactAgent({
    llm: llmAgent,
    tools: guardedTools,
  });
  return agent;
};

module.exports = { dynamicPmAgent };

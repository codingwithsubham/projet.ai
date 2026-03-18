const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");
const { createStoreHappyFeedbackTool, createMermaidChartTool, createMarkdownReportTableTool } = require("../tools/commonTools");
const { guardToolsForSingleExecution } = require("../helpers/toolExecutionGuard");

const dynamicGeneralAgent = async (project) => {
  const happyFeedbackTool = createStoreHappyFeedbackTool(project);
  const mermaidChartTool = createMermaidChartTool();
  const markdownTableTool = createMarkdownReportTableTool();
  const guardedTools = guardToolsForSingleExecution([happyFeedbackTool, mermaidChartTool, markdownTableTool]);

  const agent = createReactAgent({
    llm: llmAgent,
    tools: guardedTools,
  });
  return agent;
};

module.exports = { dynamicGeneralAgent };

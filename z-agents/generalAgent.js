const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { createLlmForProject } = require("../openai");
const { createStoreHappyFeedbackTool, createMermaidChartTool, createMarkdownReportTableTool } = require("../tools/commonTools");
const { guardToolsForSingleExecution } = require("../helpers/toolExecutionGuard");
const { checkpointer } = require("../orchestration/checkpointer.service");

const dynamicGeneralAgent = async (project) => {
  const llm = createLlmForProject(project);
  const happyFeedbackTool = createStoreHappyFeedbackTool(project);
  const mermaidChartTool = createMermaidChartTool();
  const markdownTableTool = createMarkdownReportTableTool();
  const guardedTools = guardToolsForSingleExecution([happyFeedbackTool, mermaidChartTool, markdownTableTool]);

  const agent = createReactAgent({
    llm,
    tools: guardedTools,
    checkpointSaver: checkpointer,
  });
  return agent;
};

module.exports = { dynamicGeneralAgent };

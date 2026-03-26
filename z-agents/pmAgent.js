const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { createLlmForProject } = require("../openai");
const { buildPmTools } = require("../tools/pmTools");
const { createStoreHappyFeedbackTool, createMermaidChartTool, createMarkdownReportTableTool } = require("../tools/commonTools");
const { createGetDeveloperActivityTool, createGetTeamProgressTool, createGetHandoffContextTool } = require("../tools/activityTools");
const { guardToolsForSingleExecution } = require("../helpers/toolExecutionGuard");
const { checkpointer } = require("../orchestration/checkpointer.service");

const dynamicPmAgent = async (project) => {
  const llm = createLlmForProject(project);
  const tools = await buildPmTools(project);
  const happyFeedbackTool = createStoreHappyFeedbackTool(project);
  const mermaidChartTool = createMermaidChartTool();
  const markdownTableTool = createMarkdownReportTableTool();
  // Activity tools for team tracking and handoff
  const developerActivityTool = createGetDeveloperActivityTool(project);
  const teamProgressTool = createGetTeamProgressTool(project);
  const handoffContextTool = createGetHandoffContextTool(project);
  
  const guardedTools = guardToolsForSingleExecution([
    ...tools,
    happyFeedbackTool,
    mermaidChartTool,
    markdownTableTool,
    developerActivityTool,
    teamProgressTool,
    handoffContextTool,
  ]);

  const agent = createReactAgent({
    llm,
    tools: guardedTools,
    checkpointSaver: checkpointer,
  });
  return agent;
};

module.exports = { dynamicPmAgent };

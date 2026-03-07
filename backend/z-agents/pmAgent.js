const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");
const { buildPmTools } = require("../tools/pmTools");
const { createStoreHappyFeedbackTool } = require("../tools/commonTools");
const { guardToolsForSingleExecution } = require("../helpers/toolExecutionGuard");

const dynamicPmAgent = async (project) => {
  const tools = await buildPmTools(project);
  const happyFeedbackTool = createStoreHappyFeedbackTool(project);
  const guardedTools = guardToolsForSingleExecution([
    ...tools,
    happyFeedbackTool,
  ]);

  const agent = createReactAgent({
    llm: llmAgent,
    tools: guardedTools,
  });
  return agent;
};

module.exports = { dynamicPmAgent };

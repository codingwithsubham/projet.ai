const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");
const { createStoreHappyFeedbackTool } = require("../tools/commonTools");
const { guardToolsForSingleExecution } = require("../helpers/toolExecutionGuard");

const dynamicGeneralAgent = async (project) => {
  const happyFeedbackTool = createStoreHappyFeedbackTool(project);
  const guardedTools = guardToolsForSingleExecution([happyFeedbackTool]);

  const agent = createReactAgent({
    llm: llmAgent,
    tools: guardedTools,
  });
  return agent;
};

module.exports = { dynamicGeneralAgent };

const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");
const { buildDevTools } = require("../tools/devTools");
const { guardToolsForSingleExecution } = require("../helpers/toolExecutionGuard");

const dynamicDevAgent = async (project) => {
  const tools = await buildDevTools(project);
  const guardedTools = guardToolsForSingleExecution(tools);

  const agent = createReactAgent({
    llm: llmAgent,
    tools: guardedTools,
  });
  return agent;
};

module.exports = { dynamicDevAgent };

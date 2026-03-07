const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");
const { buildDevTools } = require("../tools/devTools");

const dynamicDevAgent = async (project) => {
  const tools = await buildDevTools(project);

  const agent = createReactAgent({
    llm: llmAgent,
    tools: [...tools],
  });
  return agent;
};

module.exports = { dynamicDevAgent };

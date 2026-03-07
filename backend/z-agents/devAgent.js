const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");

const dynamicDevAgent = async (project) => {

  const agent = createReactAgent({
    llm: llmAgent,
    tools: [],
  });
  return agent;
};

module.exports = { dynamicDevAgent };

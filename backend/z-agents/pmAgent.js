const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");

const pmAgent = createReactAgent({
  llm: llmAgent,
  tools: [
  ],
});

module.exports = { pmAgent };
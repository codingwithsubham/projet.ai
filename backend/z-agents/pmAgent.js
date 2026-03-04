const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");
const { buildPmTools } = require("../tools/pmTools");

const pmAgent = createReactAgent({
  llm: llmAgent,
  tools: buildPmTools(),
});

module.exports = { pmAgent };
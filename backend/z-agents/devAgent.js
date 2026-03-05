const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");
const { createStoreHappyFeedbackTool } = require("../tools/commonTools");
const { buildPmTools } = require("../tools/pmTools");

const dynamicDevAgent = async (project) => {
  const tools = await buildPmTools(project);
  const happyFeedbackTool = createStoreHappyFeedbackTool(project);

    const agent = createReactAgent({
      llm: llmAgent,
      tools: [ ...tools, happyFeedbackTool],
    });
    return agent;
};

module.exports = { dynamicDevAgent };

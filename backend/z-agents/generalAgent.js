const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");
const { createStoreHappyFeedbackTool } = require("../tools/commonTools");

const dynamicGeneralAgent = async (project) => {
  const happyFeedbackTool = createStoreHappyFeedbackTool(project);

    const agent = createReactAgent({
      llm: llmAgent,
      tools: [happyFeedbackTool],
    });
    return agent;
};

module.exports = { dynamicGeneralAgent };

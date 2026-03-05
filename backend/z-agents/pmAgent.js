const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { llmAgent } = require("../openai");
const { buildPmTools } = require("../tools/pmTools");
const { createStoreHappyFeedbackTool } = require("../tools/commonTools");

const dynamicPmAgent = async (project, type) => {
  const tools = await buildPmTools(project);
  const happyFeedbackTool = createStoreHappyFeedbackTool(project);

  if (type === "PM") {
    const agent = createReactAgent({
      llm: llmAgent,
      tools: [...tools, happyFeedbackTool],
    });
    return agent;
  } else {
    const agent = createReactAgent({
      llm: llmAgent,
      tools: [...tools, happyFeedbackTool],
    });
    return agent;
  }
};

module.exports = { dynamicPmAgent };

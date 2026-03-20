const { HuggingFaceInferenceEmbeddings } = require("@langchain/community/embeddings/hf");
const { ChatOpenAI } = require("@langchain/openai");

const embeddingsClient = () => {
  return new HuggingFaceInferenceEmbeddings({
    model: "sentence-transformers/all-MiniLM-L6-v2",
    apiKey: process.env.HF_API_KEY || "",
  });
};

// Create LLM dynamically based on project's API key and model
const createLlmForProject = (project) => {
  const apiKey = project?.openapikey;
  const model = project?.model;

  return new ChatOpenAI({
    model,
    apiKey,
    configuration: {
      baseURL: process.env.OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": "https://your-site.com",
        "X-Title": "agent-ai",
      },
    },
  });
};

// Fallback singleton for backward compatibility
const llmAgent = new ChatOpenAI({
  model: process.env.model,
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: process.env.OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://your-site.com",
      "X-Title": "agent-ai",
    },
  },
});

const agentParser = (response) => {
  const content = response?.messages[response?.messages?.length - 1]?.content;
  return content ?? null;
};

module.exports = {
  embeddingsClient,
  llmAgent,
  createLlmForProject,
  agentParser,
};

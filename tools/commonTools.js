const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { getPineconeIndex } = require("../config/pinecone");
const {
  LOW_SIGNAL_FEEDBACK,
  HAPPY_KEYWORDS,
  FEEDBACK_SCOPE,
} = require("../common/kb-constants");

const normalizeFeedback = (value = "") =>
  String(value).trim().toLowerCase().replace(/\s+/g, " ");

const isLowSignalFeedback = (value = "") => {
  const normalized = normalizeFeedback(value);
  return !normalized || LOW_SIGNAL_FEEDBACK.has(normalized);
};

const isClearlyHappyFeedback = (value = "") => {
  const normalized = normalizeFeedback(value);
  if (!normalized) return false;
  return HAPPY_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const buildHappyFeedbackRecordText = ({
  actualUserQuestion,
  llmFinalResponse,
  userFeedback,
}) => {
  return [
    "User Prompt (Actual Question):",
    actualUserQuestion,
    "",
    "LLM Final Response (Before Performing Any Action):",
    llmFinalResponse,
    "",
    "User Feedback:",
    userFeedback,
  ].join("\n");
};

const createStoreHappyFeedbackTool = (project) => {
  return tool(
    async ({ actualUserQuestion, llmFinalResponse, userFeedback }) => {
      const projectId = String(project?._id || "").trim();
      if (!projectId) {
        throw new Error(
          "Project id is required to store feedback in vector DB",
        );
      }

      if (
        isLowSignalFeedback(userFeedback) ||
        !isClearlyHappyFeedback(userFeedback)
      ) {
        return JSON.stringify({
          success: false,
          skipped: true,
          message:
            "Feedback skipped: only clearly happy/positive feedback is stored.",
        });
      }

      const text = buildHappyFeedbackRecordText({
        actualUserQuestion,
        llmFinalResponse,
        userFeedback,
      });

      const now = Date.now();
      const recordId = `${projectId}-feedback-${now}-${Math.random().toString(36).slice(2, 8)}`;
      const namespace = `project-${projectId}`;

      const index = getPineconeIndex();
      try {
        await index.namespace(namespace).upsertRecords({
          records: [
            {
              _id: recordId,
              text,
              projectId,
              scope: FEEDBACK_SCOPE,
              source: "pm-agent-happy-feedback",
              kind: "happy_feedback",
              createdAt: new Date(now).toISOString(),
            },
          ],
        });
      } catch (error) {
        console.log("Error storing happy feedback to Pinecone:", error);
        return JSON.stringify({
          success: false,
          message: "Error storing happy feedback in knowledge base",
          error: error.message,
        });
      }
      return JSON.stringify({
        success: true,
        message: "Happy feedback stored in knowledge base",
        recordId,
        namespace,
        scope: FEEDBACK_SCOPE,
      });
    },
    {
      name: "store_happy_feedback_to_kb",
      description:
        "Store user's happy feedback into vector knowledge base. Input must include the user's exact actual question, the LLM final response before any action, and user feedback.",
      schema: z.object({
        actualUserQuestion: z
          .string()
          .trim()
          .min(1)
          .describe(
            "User prompt as the exact actual question, not paraphrased.",
          ),
        llmFinalResponse: z
          .string()
          .trim()
          .min(1)
          .describe(
            "LLM final response given before performing any tool action.",
          ),
        userFeedback: z
          .string()
          .trim()
          .min(1)
          .describe("User's happy feedback message."),
      }),
    },
  );
};

module.exports = {
  createStoreHappyFeedbackTool,
};

const ChatSession = require("../models/ChatSessionModel");
const { queryVectors } = require("./embaddingHelpers");
const { AFFIRMATIVE_INPUTS } = require("../common/kb-constants");

const MAX_CONTEXT_CHUNKS = 6;
const MAX_CONTEXT_CHARS = 9000;
const MAX_PREVIOUS_CONVERSATIONS = 3;

// Utility function to convert various content formats to plain text for consistent processing
const toText = (content) => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.text) return part.text;
        return "";
      })
      .join("\n")
      .trim();
  }
  return String(content || "");
};

// Build the RAG context by querying Pinecone with the user's question and retrieving relevant chunks of information
const buildRagContext = async (project, query) => {
  console.log(`\n🔍 Building RAG context...`);

  try {
    const results = await queryVectors({
      projectId: String(project._id),
      query,
      topK: MAX_CONTEXT_CHUNKS,
    });

    if (!results.length) {
      console.log("⚠️ No RAG context found");
      return "";
    }

    const context = results
      .map((result, i) => {
        const source = result.metadata?.source || "unknown";
        const score = result.score?.toFixed(3) || "n/a";
        return `### Context ${i + 1} (score: ${score}, source: ${source})\n${result.content}`;
      })
      .join("\n\n")
      .slice(0, MAX_CONTEXT_CHARS);

    console.log(
      `✅ RAG context: ${context.length} chars from ${results.length} chunks`,
    );
    return context;
  } catch (err) {
    console.error("❌ RAG context error:", err.message);
    return "";
  }
};

// Build the user message by combining the RAG context and the user's question
const buildUserMessage = (ragContext, userQuestion) => {
  return [
    "Found Context:",
    ragContext || "No relevant context found.",
    "",
    "User Question:",
    userQuestion,
  ].join("\n");
};

const normalizeInput = (text = "") =>
  String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const isAffirmativeMessage = (text = "") => {
  const normalized = normalizeInput(text);
  if (!normalized) return false;
  if (AFFIRMATIVE_INPUTS.has(normalized)) return true;

  return /^(yes|ok|okay|sure|confirm|proceed)(\b|\s)/i.test(normalized);
};

const didAssistantAskForConfirmation = (messages = []) => {
  if (!Array.isArray(messages) || !messages.length) return false;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") continue;

    const content = normalizeInput(message?.content);
    if (!content) continue;

    return (
      content.includes("confirm") ||
      content.includes("proceed") ||
      content.includes("would you like") ||
      content.includes("shall i") ||
      content.includes("before pushing") ||
      content.includes("before proceeding")
    );
  }

  return false;
};

const buildExecutionDirective = ({
  recentChatMessages,
  currentUserMessage,
}) => {
  const hasConfirmationRequest =
    didAssistantAskForConfirmation(recentChatMessages);
  const userConfirmed = isAffirmativeMessage(currentUserMessage);

  if (hasConfirmationRequest && userConfirmed) {
    return [
      "Execution Directive:",
      "User has already provided confirmation for the pending action.",
      "Do NOT ask for confirmation again.",
      "Proceed to perform the action now, then share outcome and ask for feedback.",
    ].join("\n");
  }

  return [
    "Execution Directive:",
    "If action is needed and user has not yet confirmed, ask for confirmation first.",
  ].join("\n");
};

// Pull the recent user-assistant conversations to maintain context and continuity in the PM agent's responses
const buildRecentChatMessages = (
  chats = [],
  maxConversations = MAX_PREVIOUS_CONVERSATIONS,
) => {
  if (!Array.isArray(chats) || maxConversations <= 0) return [];

  return chats
    .filter((chat) => chat?.role === "user" || chat?.role === "assistant")
    .slice(-maxConversations * 2)
    .map((chat) => ({
      role: chat.role,
      content: toText(chat.content),
    }))
    .filter((chat) => chat.content);
};

const buildSessionTitle = (text = "") => {
  const clean = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!clean) return "New Chat";
  return clean.length > 60 ? `${clean.slice(0, 60)}...` : clean;
};

const getOrCreateSession = async ({ projectId, sessionId, agentType }) => {
  if (sessionId) {
    const existing = await ChatSession.findOne({
      _id: sessionId,
      project_id: projectId,
    });
    if (existing) return existing;
  }

  // check if no session id and agent type is dev, then create a session for dev agent and return if dev session already there
  if (!sessionId && agentType === "dev") {
    const existingDevSession = await ChatSession.findOne({
      project_id: projectId,
      agent_type: "dev",
    });
    if (existingDevSession) return existingDevSession;

    const newDevSession = await ChatSession.create({
      project_id: projectId,
      title: "[Dev] Agent Session",
      chats: [],
      agent_type: "dev",
    });
    return newDevSession;
  }

  return ChatSession.create({
    project_id: projectId,
    title: `[${agentType}] New Chat`,
    chats: [],
    agent_type: agentType,
  });
};

module.exports = {
  toText,
  buildRagContext,
  buildUserMessage,
  buildExecutionDirective,
  buildRecentChatMessages,
  buildSessionTitle,
  getOrCreateSession,
  MAX_CONTEXT_CHUNKS,
  MAX_CONTEXT_CHARS,
  MAX_PREVIOUS_CONVERSATIONS,
};

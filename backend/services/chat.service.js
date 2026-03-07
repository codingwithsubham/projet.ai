const ChatSession = require("../models/ChatSessionModel");
const projectService = require("./project.service");
const { queryVectors } = require("../helpers/embaddingHelpers");
const { agentParser } = require("../openai");
const {
  PM_SYSTEM_PROMPT,
  DEV_SYSTEM_PROMPT,
  SYSTEM_RULES,
} = require("../common/ai-constants");
const { createDynamicAgent } = require("../z-agents");
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

// Build the text to be stored in the knowledge base from happy feedback, including the user's original question, the LLM's final response, and the user's feedback
const buildSessionTitle = (text = "") => {
  const clean = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!clean) return "New Chat";
  return clean.length > 60 ? `${clean.slice(0, 60)}...` : clean;
};

// Determine if the user feedback is low signal (e.g., too short, vague, or neutral) and should be skipped for storage
const getOrCreateSession = async ({ projectId, sessionId }) => {
  if (sessionId) {
    const existing = await ChatSession.findOne({
      _id: sessionId,
      project_id: projectId,
    });
    if (existing) return existing;
  }

  const latest = await ChatSession.findOne({ project_id: projectId }).sort({
    updatedAt: -1,
  });
  if (latest) return latest;

  return ChatSession.create({
    project_id: projectId,
    title: "New Chat",
    chats: [],
  });
};

// Build the text to be stored in the knowledge base from happy feedback, including the user's original question, the LLM's final response, and the user's feedback
const sendChatMessageToDynamicAgent = async ({ projectId, message, sessionId, agentType = "general" }) => {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) throw new Error("message is required");

  const project = await projectService.getProjectById(projectId);
  if (!project) return null;

  const session = await getOrCreateSession({ projectId, sessionId });
  const recentChatMessages = buildRecentChatMessages(
    session?.chats,
    MAX_PREVIOUS_CONVERSATIONS,
  );
  const executionDirective = buildExecutionDirective({
    recentChatMessages,
    currentUserMessage: cleanMessage,
  });

  // Build RAG context from Pinecone
  const ragContext = await buildRagContext(project, cleanMessage);

  const promptByAgentType = {
    PM: PM_SYSTEM_PROMPT,
    dev: DEV_SYSTEM_PROMPT,
    general: PM_SYSTEM_PROMPT,
  };

  const selectedPrompt =
    promptByAgentType[agentType] || promptByAgentType.general;

  const systemPromptParts = [
    ...selectedPrompt,
    `- Project Name: ${project.name || "Untitled Project"}`,
    `- Repository: ${project.repolink || "No repository URL."}`,
  ];

  if (agentType === "PM") {
    systemPromptParts.push("System Rules:", ...SYSTEM_RULES);
  }

  const systemPrompt = systemPromptParts.join(" ");

  const userPrompt = [
    buildUserMessage(ragContext, cleanMessage),
    "",
    executionDirective,
  ].join("\n");

  const agent = await createDynamicAgent(project, agentType);
  const result = await agent.invoke({
    messages: [
      { role: "system", content: systemPrompt },
      ...recentChatMessages,
      { role: "user", content: userPrompt },
    ],
  });

  const parsed = agentParser(result);
  const assistantText = toText(
    parsed || result?.output || result?.content || "No response generated.",
  );

  session.chats.push({ role: "user", content: cleanMessage });
  session.chats.push({ role: "assistant", content: assistantText });

  if (!session.title || session.title === "New Chat") {
    session.title = buildSessionTitle(cleanMessage);
  }

  await session.save();

  return {
    projectId,
    sessionId: String(session._id),
    response: assistantText,
    chats: session.chats,
  };
};

// Build the text to be stored in the knowledge base from happy feedback, including the user's original question, the LLM's final response, and the user's feedback
const getChatHistory = async (projectId, sessionId) => {
  let session = null;

  if (sessionId) {
    session = await ChatSession.findOne({
      _id: sessionId,
      project_id: projectId,
    }).lean();
  } else {
    session = await ChatSession.findOne({ project_id: projectId })
      .sort({ updatedAt: -1 })
      .lean();
  }

  return {
    projectId,
    sessionId: session?._id ? String(session._id) : null,
    chats: session?.chats || [],
  };
};

// Build the text to be stored in the knowledge base from happy feedback, including the user's original question, the LLM's final response, and the user's feedback
const getChatSessions = async (projectId) => {
  const sessions = await ChatSession.find({ project_id: projectId })
    .sort({ updatedAt: -1 })
    .lean();

  return sessions.map((s) => ({
    _id: String(s._id),
    title: s.title || "New Chat",
    updatedAt: s.updatedAt,
  }));
};

// Build the text to be stored in the knowledge base from happy feedback, including the user's original question, the LLM's final response, and the user's feedback
const createChatSession = async (projectId, title = "New Chat") => {
  const session = await ChatSession.create({
    project_id: projectId,
    title,
    chats: [],
  });

  return {
    _id: String(session._id),
    title: session.title,
    updatedAt: session.updatedAt,
  };
};

module.exports = {
  sendChatMessageToDynamicAgent,
  getChatHistory,
  getChatSessions,
  createChatSession,
};

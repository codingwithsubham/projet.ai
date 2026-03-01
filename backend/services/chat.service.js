const ChatHistory = require("../models/ChatHistoryModel");
const ChatSession = require("../models/ChatSessionModel");
const projectService = require("./project.service");
const { queryVectors } = require("../helpers/embaddingHelpers");
const { pmAgent } = require("../z-agents/pmAgent");
const { agentParser } = require("../openai");

const MAX_CONTEXT_CHUNKS = 6;
const MAX_CONTEXT_CHARS = 9000;

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

/**
 * Build RAG context by querying Pinecone for relevant chunks
 */
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
    
    console.log(`✅ RAG context: ${context.length} chars from ${results.length} chunks`);
    return context;
  } catch (err) {
    console.error("❌ RAG context error:", err.message);
    return "";
  }
};

const buildSessionTitle = (text = "") => {
  const clean = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!clean) return "New Chat";
  return clean.length > 60 ? `${clean.slice(0, 60)}...` : clean;
};

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

const sendChatMessage = async ({ projectId, message, sessionId }) => {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) throw new Error("message is required");

  const project = await projectService.getProjectById(projectId);
  if (!project) return null;

  const session = await getOrCreateSession({ projectId, sessionId });
  
  // Build RAG context from Pinecone
  const ragContext = await buildRagContext(project, cleanMessage);

  const systemPrompt = [
    "You are a senior PM AI agent.",
    "Always answer in valid markdown.",
    "Use the provided RAG context as the primary source of truth.",
    "If context is insufficient, state assumptions clearly.",
  ].join(" ");

  const userPrompt = [
    `Project: ${project.name || "Untitled Project"}`,
    "",
    "RAG Context:",
    ragContext || "No relevant context found.",
    "",
    "User Question:",
    cleanMessage,
  ].join("\n");

  const result = await pmAgent.invoke({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const parsed = agentParser(result);
  const assistantText = toText(
    parsed || result?.output || result?.content || "No response generated."
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
  sendChatMessage,
  getChatHistory,
  getChatSessions,
  createChatSession,
};

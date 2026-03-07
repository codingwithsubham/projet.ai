const ChatSession = require("../models/ChatSessionModel");
const { coreOrchastrator } = require("./core-agent.service");
const {
  toText,
  buildRagContext,
  buildUserMessage,
  buildExecutionDirective,
  buildRecentChatMessages,
  buildSessionTitle,
  getOrCreateSession,
  MAX_PREVIOUS_CONVERSATIONS,
} = require("../helpers/chat.helpers");

// Build the text to be stored in the knowledge base from happy feedback, including the user's original question, the LLM's final response, and the user's feedback
const sendChatMessageToDynamicAgent = async ({ projectId, message, sessionId, agentType = "general" }) => {
  return await coreOrchastrator({ projectId, message, sessionId, agentType });
}

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
const createChatSession = async (projectId, title = "New Chat", agentType = "general") => {
  const session = await ChatSession.create({
    project_id: projectId,
    title,
    chats: [],
    agent_type: agentType,
  });

  return {
    _id: String(session._id),
    title: session.title,
    agentType: session.agent_type,
    updatedAt: session.updatedAt,
  };
};

module.exports = {
  sendChatMessageToDynamicAgent,
  getChatHistory,
  getChatSessions,
  createChatSession,
  getOrCreateSession,
  buildRecentChatMessages,
  buildUserMessage,
  buildRagContext,
  buildExecutionDirective,
  toText,
  buildSessionTitle,
};

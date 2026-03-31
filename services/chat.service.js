const ChatSession = require("../models/ChatSessionModel");
const {
  coreOrchastrator,
  coreOrchastratorStream,
  maybeStartAsyncImplementation,
} = require("../orchestration/core-agent.service");
const {
  toText,
  buildRagContext,
  buildUserMessage,
  buildExecutionDirective,
  buildRecentChatMessages,
  buildSessionTitle,
  getOrCreateSession,
} = require("../helpers/chat.helpers");

const isAdminUser = (user) => String(user?.role || "") === "admin";

const resolveAgentTypeFromRole = (role) => {
  const normalizedRole = String(role || "").trim();
  if (normalizedRole === "PM") return "PM";
  if (normalizedRole.toLowerCase() === "dev") return "dev";
  return "general";
};

const getRequesterContext = (requester = null) => ({
  userId: requester?.id || requester?._id || null,
  isAdmin: isAdminUser(requester),
  agentType: resolveAgentTypeFromRole(requester?.role),
});

const sendChatMessageToDynamicAgent = async ({
  projectId,
  message,
  sessionId,
  agentType = "general",
  requester = null,
}) => {
  try {
    const requesterContext = getRequesterContext(requester);
    const selectedAgentType = requester
      ? requesterContext.agentType
      : agentType;

    const asyncStartResult = await maybeStartAsyncImplementation({
      projectId,
      message,
      sessionId,
      agentType: selectedAgentType,
      userId: requesterContext.userId,
      isAdmin: requesterContext.isAdmin,
      requester,
    });

    if (asyncStartResult) {
      return asyncStartResult;
    }

    return await coreOrchastrator({
      projectId,
      message,
      sessionId,
      agentType: selectedAgentType,
      userId: requesterContext.userId,
      isAdmin: requesterContext.isAdmin,
      requester,
    });
  } catch (error) {
    console.log("Error in sendChatMessageToDynamicAgent:", error);
    throw error;
  }
};

const streamChatMessage = async function* ({
  projectId,
  message,
  sessionId,
  requester = null,
}) {
  const requesterContext = getRequesterContext(requester);
  const selectedAgentType = requester
    ? requesterContext.agentType
    : "general";

  // Check for async implementation first
  const asyncStartResult = await maybeStartAsyncImplementation({
    projectId,
    message,
    sessionId,
    agentType: selectedAgentType,
    userId: requesterContext.userId,
    isAdmin: requesterContext.isAdmin,
    requester,
  });

  if (asyncStartResult) {
    yield { type: "cached", data: asyncStartResult.response };
    yield {
      type: "done",
      data: {
        sessionId: asyncStartResult.sessionId,
        chats: asyncStartResult.chats,
        async: true,
      },
    };
    return;
  }

  yield* coreOrchastratorStream({
    projectId,
    message,
    sessionId,
    agentType: selectedAgentType,
    userId: requesterContext.userId,
    isAdmin: requesterContext.isAdmin,
    requester,
  });
};

// Build the text to be stored in the knowledge base from happy feedback, including the user's original question, the LLM's final response, and the user's feedback
const getChatHistory = async (projectId, sessionId, requester = null) => {
  const requesterContext = getRequesterContext(requester);
  const scopedFilter =
    !requesterContext.isAdmin && requesterContext.userId
      ? { user_id: requesterContext.userId }
      : {};

  let session = null;

  if (sessionId) {
    session = await ChatSession.findOne({
      _id: sessionId,
      project_id: projectId,
      ...scopedFilter,
    }).lean();
  } else {
    session = await ChatSession.findOne({
      project_id: projectId,
      ...scopedFilter,
    })
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
const getChatSessions = async (projectId, requester = null) => {
  const requesterContext = getRequesterContext(requester);
  const filter = { project_id: projectId };

  if (!requesterContext.isAdmin && requesterContext.userId) {
    filter.user_id = requesterContext.userId;
  }

  const sessions = await ChatSession.find(filter)
    .sort({ updatedAt: -1 })
    .lean();

  return sessions.map((s) => ({
    _id: String(s._id),
    title: s.title || "New Chat",
    agentType: s.agent_type || "general",
    userId: s.user_id ? String(s.user_id) : null,
    updatedAt: s.updatedAt,
  }));
};

// Build the text to be stored in the knowledge base from happy feedback, including the user's original question, the LLM's final response, and the user's feedback
const createChatSession = async (
  projectId,
  title = "New Chat",
  agentType = "general",
  requester = null,
) => {
  const requesterContext = getRequesterContext(requester);
  const selectedAgentType = requester ? requesterContext.agentType : agentType;

  const session = await ChatSession.create({
    project_id: projectId,
    title,
    chats: [],
    agent_type: selectedAgentType,
    ...(requesterContext.userId ? { user_id: requesterContext.userId } : {}),
  });

  return {
    _id: String(session._id),
    title: session.title,
    agentType: session.agent_type,
    userId: session.user_id ? String(session.user_id) : null,
    updatedAt: session.updatedAt,
  };
};

const deleteChatSession = async (projectId, sessionId, requester = null) => {
  const requesterContext = getRequesterContext(requester);
  const scopedFilter =
    !requesterContext.isAdmin && requesterContext.userId
      ? { user_id: requesterContext.userId }
      : {};

  const result = await ChatSession.deleteOne({
    _id: sessionId,
    project_id: projectId,
    ...scopedFilter,
  });

  return result.deletedCount > 0;
};

module.exports = {
  sendChatMessageToDynamicAgent,
  streamChatMessage,
  getChatHistory,
  getChatSessions,
  createChatSession,
  deleteChatSession,
  getOrCreateSession,
  buildRecentChatMessages,
  buildUserMessage,
  buildRagContext,
  buildExecutionDirective,
  toText,
  buildSessionTitle,
};

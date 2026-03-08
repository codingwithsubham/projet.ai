const ChatSession = require("../models/ChatSessionModel");
const {
  coreOrchastrator,
  isDevImplementationRequest,
  runAgentInBackground,
  validateIssueTypeForImplementation,
  extractIssueNumber,
} = require("./core-agent.service");
const projectService = require("./project.service");
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

    // For dev agent implementation requests, run in background and return immediately
    if (selectedAgentType === "dev") {
      const cleanMessage = String(message || "").trim();

      const session = await getOrCreateSession({
        projectId,
        sessionId,
        agentType: selectedAgentType,
        userId: requesterContext.userId,
        isAdmin: requesterContext.isAdmin,
      });

      const recentChats = session?.chats || [];

      if (isDevImplementationRequest(cleanMessage, recentChats)) {
        const project = await projectService.getProjectById(
          projectId,
          requester,
        );
        if (!project) return null;

        // Validate issue type before launching background implementation
        const issueNumber = extractIssueNumber(cleanMessage);
        if (issueNumber) {
          const validation = await validateIssueTypeForImplementation(
            project,
            issueNumber,
          );

          if (!validation.allowed) {
            session.chats.push({ role: "user", content: cleanMessage });
            session.chats.push({
              role: "assistant",
              content: validation.message,
            });

            if (!session.title || session.title === "New Chat") {
              session.title = buildSessionTitle(cleanMessage);
            }

            await session.save();

            return {
              projectId,
              sessionId: String(session._id),
              response: validation.message,
              chats: session.chats,
            };
          }
        }

        const asyncMessage =
          "🚀 **Implementation is in progress.** I'm creating a new branch, implementing the changes, and will raise a pull request. This may take a few minutes — check back shortly to see the results.";

        // Save user message and the async acknowledgment to the session
        session.chats.push({ role: "user", content: cleanMessage });
        session.chats.push({ role: "assistant", content: asyncMessage });

        if (!session.title || session.title === "New Chat") {
          session.title = buildSessionTitle(cleanMessage);
        }

        await session.save();

        // Fire the agent work in the background
        setImmediate(() => {
          runAgentInBackground({
            projectId,
            cleanMessage,
            session,
            project,
            agentType: selectedAgentType,
          });
        });

        return {
          projectId,
          sessionId: String(session._id),
          response: asyncMessage,
          chats: session.chats,
          async: true,
        };
      }
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

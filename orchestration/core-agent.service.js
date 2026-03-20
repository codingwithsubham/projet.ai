const projectService = require("../services/project.service");
const { agentParser } = require("../openai");
const { createDynamicAgent } = require("../z-agents");
const {
  getOrCreateSession,
  buildExecutionDirective,
  buildRagContext,
  buildUserMessage,
  toText,
  buildSessionTitle,
} = require("../helpers/chat.helpers");
const {
  buildSystemPrompt,
  resolveIntent,
} = require("../helpers/systemPromptBuilder");
const {
  DEFAULT_GRAPH_RECURSION_LIMIT,
  ASYNC_IMPLEMENTATION_ACK,
} = require("../common/constants");

const shouldRunAsyncImplementation = ({ agentType, message }) => {
  const normalizedAgentType = String(agentType || "").toLowerCase();
  if (normalizedAgentType !== "dev") return false;

  const intent = resolveIntent({ agentType: normalizedAgentType, message });
  return intent === "implementation";
};

const resolveGraphRecursionLimit = () => {
  const parsed = Number.parseInt(
    process.env.LANGGRAPH_RECURSION_LIMIT || "",
    10,
  );

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_GRAPH_RECURSION_LIMIT;
};

const maybeStartAsyncImplementation = async ({
  projectId,
  message,
  sessionId,
  agentType = "general",
  userId,
  isAdmin = false,
  requester = null,
}) => {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) return null;

  if (!shouldRunAsyncImplementation({ agentType, message: cleanMessage })) {
    return null;
  }

  const project = await projectService.getProjectById(projectId, requester);
  if (!project) return null;

  const session = await getOrCreateSession({
    projectId,
    sessionId,
    agentType,
    userId,
    isAdmin,
  });

  session.chats.push({ role: "user", content: cleanMessage });
  session.chats.push({ role: "assistant", content: ASYNC_IMPLEMENTATION_ACK });

  if (!session.title || session.title === "New Chat") {
    session.title = buildSessionTitle(cleanMessage);
  }

  await session.save();

  setImmediate(() => {
    runAgentInBackground({
      projectId,
      cleanMessage,
      sessionId: String(session._id),
      project,
      agentType,
      userId: session.user_id || userId || null,
      isAdmin,
    });
  });

  return {
    projectId,
    sessionId: String(session._id),
    response: ASYNC_IMPLEMENTATION_ACK,
    chats: session.chats,
    async: true,
  };
};

// Build the text to be stored in the knowledge base from happy feedback, including the user's original question, the LLM's final response, and the user's feedback
const coreOrchastrator = async ({
  projectId,
  message,
  sessionId,
  agentType = "general",
  userId,
  isAdmin = false,
  requester = null,
}) => {
  try {
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) throw new Error("message is required");

    const project = await projectService.getProjectById(projectId, requester);
    if (!project) return null;

    const session = await getOrCreateSession({
      projectId,
      sessionId,
      agentType,
      userId,
      isAdmin,
    });
    
    // Use session.chats for confirmation check (LangGraph handles full history via checkpointer)
    const executionDirective = buildExecutionDirective({
      recentChatMessages: session?.chats || [],
      currentUserMessage: cleanMessage,
    });

    // Build RAG context from Pinecone
    const ragContext = await buildRagContext(project, cleanMessage);

    const { systemPrompt } = buildSystemPrompt({
      agentType,
      message: cleanMessage,
      project,
    });

    const userPrompt = [
      buildUserMessage(ragContext, cleanMessage),
      "",
      executionDirective,
    ].join("\n");

    const agent = await createDynamicAgent(project, agentType);
    const result = await agent.invoke(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      {
        recursionLimit: resolveGraphRecursionLimit(),
        configurable: { thread_id: String(session._id) },
      },
    );

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
  } catch (error) {
    console.log("Error in coreOrchastrator:", error);
    throw error;
  }
};

// Run agent work in the background and save results to session when done.
// Called via setImmediate so the HTTP response can return immediately.
const runAgentInBackground = async ({
  projectId,
  cleanMessage,
  sessionId,
  project,
  agentType,
  userId = null,
  isAdmin = false,
}) => {
  try {
    console.log(`\n[Background] Starting agent for session ${sessionId}...`);

    const session = await getOrCreateSession({
      projectId,
      sessionId,
      agentType,
      userId,
      isAdmin,
    });

    const executionDirective = [
      "Execution Directive:",
      "Proceed immediately with implementation using available MCP tools.",
      "Do not block for extra confirmation.",
    ].join("\n");

    const ragContext = await buildRagContext(project, cleanMessage);

    const { systemPrompt } = buildSystemPrompt({
      agentType,
      message: cleanMessage,
      project,
    });

    const userPrompt = [
      buildUserMessage(ragContext, cleanMessage),
      "",
      executionDirective,
    ].join("\n");

    const agent = await createDynamicAgent(project, agentType);
    const result = await agent.invoke(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      {
        recursionLimit: resolveGraphRecursionLimit(),
        configurable: { thread_id: sessionId },
      },
    );

    const parsed = agentParser(result);
    const assistantText = toText(
      parsed || result?.output || result?.content || "No response generated.",
    );

    session.chats.push({
      role: "assistant",
      content: assistantText,
    });

    await session.save();

    console.log(`\n[Background] Agent completed for session ${sessionId}`);
  } catch (error) {
    console.error(
      `\n[Background] Agent error for session ${sessionId}:`,
      error,
    );

    // Save error message to session so user can see what happened
    try {
      const errorSession = await getOrCreateSession({
        projectId,
        sessionId,
        agentType,
        userId,
        isAdmin,
      });

      errorSession.chats.push({
        role: "assistant",
        content: `⚠️ Implementation encountered an error: ${error.message || "Unknown error"}. Please try again or check the repository manually.`,
      });

      await errorSession.save();
    } catch (saveError) {
      console.error(
        "[Background] Failed to save error message to session:",
        saveError,
      );
    }
  }
};

module.exports = {
  coreOrchastrator,
  maybeStartAsyncImplementation,
  runAgentInBackground,
};

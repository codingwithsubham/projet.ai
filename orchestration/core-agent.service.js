const projectService = require("../services/project.service");
const toolRouterService = require("../services/toolRouter.service");
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
const { classifyIntent } = require("../helpers/intentClassifier");
const { RAG_INTENTS } = require("../common/rag-constants");
const {
  DEFAULT_GRAPH_RECURSION_LIMIT,
  ASYNC_IMPLEMENTATION_ACK,
} = require("../common/constants");
const {
  getCachedResponse,
  cacheResponse,
} = require("../services/responseCache.service");

// ── Project object cache (60s TTL) ──
const projectCache = new Map();
const PROJECT_CACHE_TTL_MS = 60000;

const getCachedProject = async (projectId, requester) => {
  const cacheKey = String(projectId);
  const cached = projectCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.project;
  }
  const project = await projectService.getProjectById(projectId, requester);
  if (project) {
    projectCache.set(cacheKey, { project, expiresAt: Date.now() + PROJECT_CACHE_TTL_MS });
  }
  return project;
};

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

  const project = await getCachedProject(projectId, requester);
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
  const startTime = Date.now();
  
  try {
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) throw new Error("message is required");

    const project = await getCachedProject(projectId, requester);
    if (!project) return null;

    // ── Parallelize: session fetch + intent classification ──
    const [session, classification] = await Promise.all([
      getOrCreateSession({ projectId, sessionId, agentType, userId, isAdmin }),
      classifyIntent({
        query: cleanMessage,
        agentType,
        project,
        allowLLMFallback: true,
      }),
    ]);
    
    // Use session.chats for confirmation check (LangGraph handles full history via checkpointer)
    const executionDirective = buildExecutionDirective({
      recentChatMessages: session?.chats || [],
      currentUserMessage: cleanMessage,
    });

    console.log(`📋 Intent: ${classification.intent} (${classification.method}, confidence: ${classification.confidence})`);
    
    // ── Parallelize: cache check + tool routing (for dev) ──
    const [cachedResult, routingResult] = await Promise.all([
      getCachedResponse({
        project,
        query: cleanMessage,
        agentType,
        intent: classification.intent,
      }),
      agentType === "dev"
        ? toolRouterService.routeQuery({ project, query: cleanMessage, agentType })
        : Promise.resolve(null),
    ]);
    
    if (cachedResult) {
      const cacheDuration = Date.now() - startTime;
      console.log(`⚡ Cache HIT (${cachedResult.source}): ${cacheDuration}ms`);
      
      // Update session with cached response
      session.chats.push({ role: "user", content: cleanMessage });
      session.chats.push({ role: "assistant", content: cachedResult.response });
      
      if (!session.title || session.title === "New Chat") {
        session.title = buildSessionTitle(cleanMessage);
      }
      
      await session.save();
      
      return {
        projectId,
        sessionId: String(session._id),
        response: cachedResult.response,
        chats: session.chats,
        cached: true,
        cacheSource: cachedResult.source,
        cacheDuration,
      };
    }
    
    console.log(`🔄 Cache MISS - invoking agent...`);

    // === RAG-FIRST TOOL ROUTING ===
    // Determine if we should use external tools or rely on RAG
    let agentOptions = {};
    let routingDirective = "";

    if (routingResult) {
      // Configure agent based on routing decision
      agentOptions = {
        includeExternalTools: routingResult.useExternalTools,
        readOnlyMode: false, // Can enable for read-only queries
      };

      // Get directive to include in system prompt
      routingDirective = toolRouterService.getRoutingDirective(routingResult);
    }

    // Build system prompt with classified intent
    const { systemPrompt, promptMeta } = buildSystemPrompt({
      agentType,
      message: cleanMessage,
      project,
      forceIntent: classification.intent,
    });

    // Enhance system prompt with routing directive
    const enhancedSystemPrompt = routingDirective 
      ? `${systemPrompt}\n\n${routingDirective}`
      : systemPrompt;

    // ── Parallelize: RAG context build + agent creation ──
    const [ragContext, agent] = await Promise.all([
      buildRagContext(project, cleanMessage, {
        intent: classification.intent,
        prefetchedResults: routingResult?.ragResult?.rawResults || null,
      }),
      createDynamicAgent(project, agentType, agentOptions),
    ]);

    const userPrompt = [
      buildUserMessage(ragContext, cleanMessage),
      "",
      executionDirective,
    ].join("\n");

    // Wrap agent.invoke with a timeout to prevent runaway LLM loops
    const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS) || 45000;
    const agentPromise = agent.invoke(
      {
        messages: [
          { role: "system", content: enhancedSystemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      {
        recursionLimit: resolveGraphRecursionLimit(),
        configurable: { thread_id: String(session._id) },
      },
    );
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Agent timed out")), AGENT_TIMEOUT_MS),
    );
    let result;
    try {
      result = await Promise.race([agentPromise, timeoutPromise]);
    } catch (err) {
      if (err.message === "Agent timed out") {
        console.warn(`⏱️ Agent timed out after ${AGENT_TIMEOUT_MS}ms`);
        result = { messages: [{ content: "I'm sorry, this request took too long. Please try rephrasing your question or breaking it into smaller parts." }] };
      } else {
        throw err;
      }
    }

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
    
    // === CACHE STORE ===
    // Store response in cache for future similar queries (async, non-blocking)
    cacheResponse({
      project,
      query: cleanMessage,
      agentType,
      intent: classification.intent,
      response: assistantText,
    }).catch((err) => {
      console.warn("Cache store failed (non-blocking):", err.message);
    });
    
    const totalDuration = Date.now() - startTime;
    console.log(`✅ Agent response completed in ${totalDuration}ms`);

    return {
      projectId,
      sessionId: String(session._id),
      response: assistantText,
      chats: session.chats,
      cached: false,
      duration: totalDuration,
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

    // For async background tasks, we already know it's implementation intent
    // (validated by shouldRunAsyncImplementation before reaching here)
    const classifiedIntent = RAG_INTENTS.IMPLEMENTATION;

    // Build system prompt with implementation intent
    const { systemPrompt } = buildSystemPrompt({
      agentType,
      message: cleanMessage,
      project,
      forceIntent: classifiedIntent,
    });

    // Use implementation intent for async tasks (stricter threshold, more chunks)
    const ragContext = await buildRagContext(project, cleanMessage, {
      intent: classifiedIntent,
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

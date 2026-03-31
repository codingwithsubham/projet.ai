const ChatSession = require("../models/ChatSessionModel");
const { queryVectors } = require("./embaddingHelpers");
const { AFFIRMATIVE_INPUTS } = require("../common/kb-constants");

// Import modular constants
const {
  MAX_CONTEXT_CHUNKS,
  MAX_CONTEXT_CHARS,
  MAX_PREVIOUS_CONVERSATIONS,
  RAG_INTENTS,
  getThresholdForIntent,
  getChunksForIntent,
  RETRIEVAL_MODES,
  getRetrievalModeForIntent,
} = require("../common/rag-constants");

// Import repo detection utilities
const {
  detectRepoTagsFromQuery,
  buildRepoFilter,
} = require("./repoDetection");

// Re-export for backward compatibility
const { REPO_TAG_KEYWORDS } = require("../common/repo-tags");

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

// Build the RAG context by querying document vectors with the user's question and retrieving relevant chunks of information
// Options:
//   - intent: 'read' | 'write' | 'implementation' | 'general' - affects similarity threshold
//   - repoId: filter to specific repository
//   - repoTag: filter by repository tag (e.g., 'backend', 'frontend')
//   - autoDetectRepo: if true, automatically detect repo tags from query keywords (default: true)
const buildRagContext = async (project, query, options = {}) => {
  console.log(`\n🔍 Building RAG context...`);
  const { 
    intent = RAG_INTENTS.GENERAL, 
    repoId = null, 
    repoTag = null,
    autoDetectRepo = true,
    prefetchedResults = null,
  } = options;

  try {
    let results;

    if (prefetchedResults && prefetchedResults.length > 0) {
      console.log(`♻️ Reusing ${prefetchedResults.length} pre-fetched RAG chunks`);
      results = prefetchedResults;
    } else {
      // Build metadata filter using modular utility
      const { filter, detectedTags } = buildRepoFilter({
        query,
        repoId,
        repoTag,
        autoDetect: autoDetectRepo,
        repositories: project.repositories,
      });

      if (detectedTags.length > 0) {
        console.log(`🎯 Auto-detected repo tags: ${detectedTags.join(", ")}`);
      }

      const minScore = getThresholdForIntent(intent);
      const topK = getChunksForIntent(intent);
      const retrievalMode = getRetrievalModeForIntent(intent);
      console.log(`📊 Using ${intent} intent: threshold=${minScore}, chunks=${topK}, mode=${retrievalMode}`);

      results = await queryVectors({
        project,
        query,
        topK,
        filter,
        minScore,
        retrievalMode,
      });
    }

    if (!results.length) {
      console.log("⚠️ No RAG context found");
      return "";
    }

    const context = results
      .map((result, i) => {
        const source = result.metadata?.source || "unknown";
        const score = result.score?.toFixed(3) || "n/a";
        
        // Include repository metadata for multi-repo context
        const repoIdentifier = result.metadata?.repoIdentifier || "default";
        const repoTag = result.metadata?.repoTag || "unknown";
        const repoInfo = `[${repoIdentifier}:${repoTag}]`;
        
        return `### Context ${i + 1} ${repoInfo} (score: ${score}, source: ${source})\n${result.content}`;
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

const getOrCreateSession = async ({
  projectId,
  sessionId,
  agentType,
  userId,
  isAdmin = false,
}) => {
  const userScopedQuery = !isAdmin && userId ? { user_id: userId } : {};

  if (sessionId) {
    const existing = await ChatSession.findOne({
      _id: sessionId,
      project_id: projectId,
      ...userScopedQuery,
    });
    if (existing) return existing;
  }

  // check if no session id and agent type is dev, then create a session for dev agent and return if dev session already there
  if (!sessionId && agentType === "dev") {
    const existingDevSession = await ChatSession.findOne({
      project_id: projectId,
      agent_type: "dev",
      ...userScopedQuery,
    });
    if (existingDevSession) return existingDevSession;

    const newDevSession = await ChatSession.create({
      project_id: projectId,
      title: "[Dev] Agent Session",
      chats: [],
      agent_type: "dev",
      ...(userId ? { user_id: userId } : {}),
    });
    return newDevSession;
  }

  return ChatSession.create({
    project_id: projectId,
    title: `[${agentType}] New Chat`,
    chats: [],
    agent_type: agentType,
    ...(userId ? { user_id: userId } : {}),
  });
};

module.exports = {
  // Core utilities
  toText,
  buildRagContext,
  buildUserMessage,
  buildExecutionDirective,
  buildRecentChatMessages,
  buildSessionTitle,
  getOrCreateSession,
  
  // Re-exported for backward compatibility (prefer importing from source modules)
  detectRepoTagsFromQuery,     // from ./repoDetection
  REPO_TAG_KEYWORDS,           // from ../common/repo-tags
  RAG_INTENTS,                 // from ../common/rag-constants
  RETRIEVAL_MODES,             // from ../common/rag-constants
  MAX_CONTEXT_CHUNKS,          // from ../common/rag-constants
  MAX_CONTEXT_CHARS,           // from ../common/rag-constants
  MAX_PREVIOUS_CONVERSATIONS,  // from ../common/rag-constants
};

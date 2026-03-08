const projectService = require("./project.service");
const { agentParser } = require("../openai");
const {
  PM_SYSTEM_PROMPT,
  DEV_SYSTEM_PROMPT,
  SYSTEM_RULES,
} = require("../common/ai-constants");
const { createDynamicAgent } = require("../z-agents");
const {
  getOrCreateSession,
  buildRecentChatMessages,
  buildExecutionDirective,
  buildRagContext,
  buildUserMessage,
  toText,
  buildSessionTitle,
  MAX_PREVIOUS_CONVERSATIONS,
} = require("../helpers/chat.helpers");

const https = require("https");

const DEFAULT_GRAPH_RECURSION_LIMIT = 25;

// Issue types that are allowed for implementation
const ALLOWED_ISSUE_TYPES = ["[user story]", "[bug]"];
const BLOCKED_ISSUE_TYPES_LABELS = {
  "[epic]": "Epic",
  "[task]": "Task",
};

// Extract issue number from user message (e.g., "implement #40" or "implement issue 40")
const extractIssueNumber = (message) => {
  const normalized = String(message || "").trim();
  const match = normalized.match(/#(\d+)|issue\s+(\d+)|story\s+(\d+)|bug\s+(\d+)/i);
  if (match) return match[1] || match[2] || match[3] || match[4];
  return null;
};

// Parse owner/repo from a GitHub repolink URL
const parseOwnerRepo = (repolink) => {
  const cleaned = String(repolink || "").replace(/\.git$/, "").replace(/\/$/, "");
  const match = cleaned.match(/github\.com[\/:]([^\/]+)\/([^\/]+)/);
  if (match) return { owner: match[1], repo: match[2] };
  return null;
};

// Fetch issue title from GitHub REST API using PAT token
const fetchIssueTitle = (owner, repo, issueNumber, patToken) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issueNumber)}`,
      method: "GET",
      headers: {
        "User-Agent": "aidlc-dev-agent",
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${patToken}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.title || "");
          } catch {
            reject(new Error("Failed to parse GitHub response"));
          }
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}`));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
};

// Validate whether an issue type is allowed for implementation.
// Returns { allowed: true } or { allowed: false, message: "..." }
const validateIssueTypeForImplementation = async (project, issueNumber) => {
  try {
    const parsed = parseOwnerRepo(project.repolink);
    if (!parsed) return { allowed: true }; // Can't validate, let agent handle it

    const title = await fetchIssueTitle(
      parsed.owner,
      parsed.repo,
      issueNumber,
      project.pat_token,
    );

    const lowerTitle = String(title || "").toLowerCase();

    // Check if it's a blocked type
    for (const [prefix, label] of Object.entries(BLOCKED_ISSUE_TYPES_LABELS)) {
      if (lowerTitle.startsWith(prefix)) {
        return {
          allowed: false,
          message: `⚠️ **Cannot implement an ${label}.**\n\nThe issue **#${issueNumber}** is an **${label}** (\"${title}\"). Implementation can only be performed for **User Stories** and **Bugs**.\n\nPlease select a specific User Story or Bug under this ${label} and ask me to implement that instead.`,
        };
      }
    }

    // Check if it matches an allowed type
    const isAllowed = ALLOWED_ISSUE_TYPES.some((t) => lowerTitle.startsWith(t));
    if (!isAllowed && lowerTitle) {
      return {
        allowed: false,
        message: `⚠️ **Cannot implement this issue type.**\n\nThe issue **#${issueNumber}** (\"${title}\") does not appear to be a **User Story** or **Bug**. Implementation is only supported for issues prefixed with \`[User Story]\` or \`[Bug]\`.\n\nPlease select a valid User Story or Bug to implement.`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.warn("⚠️ Could not validate issue type, proceeding:", error.message);
    return { allowed: true }; // On error, let the agent proceed
  }
};

const IMPLEMENTATION_KEYWORDS = [
  "implement",
  "build",
  "develop",
  "code",
  "create the",
  "write the code",
  "scaffold",
  "set up",
  "setup",
  "work on",
  "start working",
  "begin implementation",
  "fix the bug",
  "fix issue",
  "resolve issue",
  "resolve the bug",
];

const isDevImplementationRequest = (message, recentChats = []) => {
  const normalizedMessage = String(message || "")
    .trim()
    .toLowerCase();
  if (!normalizedMessage) return false;

  // Direct implementation keywords in the user message
  const hasKeyword = IMPLEMENTATION_KEYWORDS.some((kw) =>
    normalizedMessage.includes(kw),
  );
  if (hasKeyword) return true;

  // Check if this is a confirmation ("yes") following a dev implementation discussion
  const isConfirmation = /^(yes|ok|okay|sure|confirm|proceed|go ahead|do it)/i.test(
    normalizedMessage,
  );
  if (isConfirmation && Array.isArray(recentChats) && recentChats.length > 0) {
    const lastAssistant = [...recentChats]
      .reverse()
      .find((c) => c?.role === "assistant");
    if (lastAssistant) {
      const lastContent = String(lastAssistant.content || "").toLowerCase();
      return (
        lastContent.includes("implement") ||
        lastContent.includes("pull request") ||
        lastContent.includes("branch") ||
        lastContent.includes("user story") ||
        lastContent.includes("acceptance criteria")
      );
    }
  }

  return false;
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
    const result = await agent.invoke(
      {
        messages: [
          { role: "system", content: systemPrompt },
          ...recentChatMessages,
          { role: "user", content: userPrompt },
        ],
      },
      {
        recursionLimit: resolveGraphRecursionLimit(),
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
  session,
  project,
  agentType,
}) => {
  try {
    console.log(
      `\n🔄 [Background] Starting dev agent for session ${session._id}...`,
    );

    const recentChatMessages = buildRecentChatMessages(
      session?.chats,
      MAX_PREVIOUS_CONVERSATIONS,
    );

    const executionDirective = [
      "Execution Directive:",
      "Proceed immediately with full implementation. Do NOT ask for confirmation.",
      "Create a new branch, implement the changes, and create a pull request.",
    ].join("\n");

    const ragContext = await buildRagContext(project, cleanMessage);

    const systemPromptParts = [
      ...DEV_SYSTEM_PROMPT,
      `- Project Name: ${project.name || "Untitled Project"}`,
      `- Repository: ${project.repolink || "No repository URL."}`,
    ];
    const systemPrompt = systemPromptParts.join(" ");

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
          ...recentChatMessages,
          { role: "user", content: userPrompt },
        ],
      },
      {
        recursionLimit: resolveGraphRecursionLimit(),
      },
    );

    const parsed = agentParser(result);
    const assistantText = toText(
      parsed || result?.output || result?.content || "No response generated.",
    );

    // Reload session to avoid stale writes
    const freshSession = await getOrCreateSession({
      projectId,
      sessionId: String(session._id),
      agentType,
      userId: session.user_id,
      isAdmin: false,
    });

    freshSession.chats.push({
      role: "assistant",
      content: assistantText,
    });

    await freshSession.save();

    console.log(
      `\n✅ [Background] Dev agent completed for session ${session._id}`,
    );
  } catch (error) {
    console.error(
      `\n❌ [Background] Dev agent error for session ${session._id}:`,
      error,
    );

    // Save error message to session so user can see what happened
    try {
      const errorSession = await getOrCreateSession({
        projectId,
        sessionId: String(session._id),
        agentType: "dev",
        userId: session.user_id,
        isAdmin: false,
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
  isDevImplementationRequest,
  runAgentInBackground,
  validateIssueTypeForImplementation,
  extractIssueNumber,
};

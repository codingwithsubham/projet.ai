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


// Build the text to be stored in the knowledge base from happy feedback, including the user's original question, the LLM's final response, and the user's feedback
const coreOrchastrator = async ({ projectId, message, sessionId, agentType = "general" }) => {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) throw new Error("message is required");

  const project = await projectService.getProjectById(projectId);
  if (!project) return null;

  const session = await getOrCreateSession({ projectId, sessionId, agentType });
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

module.exports = { coreOrchastrator };
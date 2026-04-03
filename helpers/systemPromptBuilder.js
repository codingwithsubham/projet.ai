const { RULE_PACKS } = require("../common/ai-constants");
const { RAG_INTENTS } = require("../common/rag-constants");
const { classifyIntentSync } = require("./intentClassifier");
const { 
  parseOwnerRepo, 
  buildRepositoryPromptSection,
  buildBoardPromptSection,
} = require("./repoPromptBuilder");

/**
 * Resolve intent for a query (sync version)
 * Uses the hybrid classifier's keyword-only mode for backward compatibility
 * 
 * @deprecated Use classifyIntent from intentClassifier for async + LLM fallback
 */
const resolveIntent = ({ agentType, message, forceIntent = null }) => {
  // If forceIntent provided, use it directly
  if (forceIntent) return forceIntent;

  // Use the new hybrid classifier (sync/keyword mode)
  const { intent } = classifyIntentSync(message, agentType);
  return intent;
};

const selectRuleLines = ({ agentType, intent, boardPlatform }) => {
  const normalizedAgentType = String(agentType || "").toLowerCase();
  const sharedBase = RULE_PACKS.shared.base;
  const sharedToolCycle = RULE_PACKS.shared.toolCycle;

  // Select platform-specific planning rules
  const getPlanningRules = () => {
    const base = RULE_PACKS.pm.planningRules;
    if (boardPlatform === "jira") {
      return [...base, ...RULE_PACKS.pm.planningRules_jira];
    }
    if (boardPlatform === "github") {
      return [...base, ...RULE_PACKS.pm.planningRules_github];
    }
    // Default to github rules for backward compatibility
    return [...base, ...RULE_PACKS.pm.planningRules_github];
  };

  if (normalizedAgentType === "general") {
    const generalLines = [
      ...RULE_PACKS.general.persona,
      ...sharedBase,
      ...sharedToolCycle,
    ];

    if (intent === "write") {
      return [...generalLines, ...RULE_PACKS.general.behaviorRules.slice(1, 3)];
    }

    if (intent === "read") {
      return [...generalLines, RULE_PACKS.general.behaviorRules[0]];
    }

    return [...generalLines, ...RULE_PACKS.general.behaviorRules];
  }

  if (normalizedAgentType === "pm") {
    const pmLines = [
      ...RULE_PACKS.pm.persona,
      ...sharedBase,
      ...RULE_PACKS.pm.formattingRules,
      ...sharedToolCycle,
      ...RULE_PACKS.pm.closeout,
      ...RULE_PACKS.pm.analyticsRules,
      ...RULE_PACKS.pm.reportingRules,
      ...RULE_PACKS.pm.riskRules,
      ...RULE_PACKS.pm.capacityRules,
      ...RULE_PACKS.pm.delegationRules,
    ];

    if (intent === "write") {
      return [
        ...pmLines,
        ...RULE_PACKS.pm.writeGuardrails,
        ...getPlanningRules(),
      ];
    }

    if (intent === "read") {
      return [...pmLines, ...RULE_PACKS.pm.writeGuardrails.slice(3, 5), ...getPlanningRules()];
    }

    return [...pmLines, ...RULE_PACKS.pm.writeGuardrails, ...getPlanningRules()];
  }

  const devBase = [...RULE_PACKS.dev.persona, ...sharedBase, ...sharedToolCycle];

  if (intent === "implementation") {
    return [...devBase, ...RULE_PACKS.dev.implementationRules];
  }

  if (intent === "read") {
    return [...devBase, ...RULE_PACKS.dev.readRules];
  }

  return [...devBase, ...RULE_PACKS.dev.readRules.slice(0, 2)];
};

const buildSystemPrompt = ({
  agentType,
  message,
  project,
  forceIntent = null,
  userId = null,
}) => {
  const resolvedAgentType = agentType;
  const intent = resolveIntent({
    agentType: resolvedAgentType,
    message,
    forceIntent,
  });

  const boardPlatform = project.boardConfig?.platform || "github";

  const lines = selectRuleLines({ agentType: resolvedAgentType, intent, boardPlatform });
  
  // Build system prompt with project info and repository section
  const systemPromptParts = [
    ...lines,
    `- Project Name: ${project.name || "Untitled Project"}`,
    ...buildRepositoryPromptSection(project),
    ...buildBoardPromptSection(project),
  ];

  // Add user context for delegation tools
  if (userId) {
    systemPromptParts.push("");
    systemPromptParts.push("=== USER CONTEXT ===");
    systemPromptParts.push(`- Current User ID: ${userId}`);
    systemPromptParts.push("Use this User ID when calling delegation tools (delegate_to_document_agent, etc.)");
  }

  return {
    systemPrompt: systemPromptParts.join("\n"),
    promptMeta: {
      agentType: resolvedAgentType,
      intent,
      selectedRuleCount: lines.length,
    },
  };
};

module.exports = {
  buildSystemPrompt,
  resolveIntent,
  parseOwnerRepo,
};

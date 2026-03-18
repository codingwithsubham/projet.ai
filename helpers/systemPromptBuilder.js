const { RULE_PACKS } = require("../common/ai-constants");

const READ_KEYWORDS = [
  "list",
  "show",
  "describe",
  "summarize",
  "summary",
  "get details",
  "fetch",
  "read",
  "status",
  "issues",
  "pull requests",
  "prs",
  "branches",
  "chart",
  "graph",
  "diagram",
  "visualize",
];

const WRITE_KEYWORDS = [
  "create",
  "update",
  "push",
  "generate",
  "add",
  "plan",
  "sprint",
  "milestone",
  "epic",
  "story",
  "bug",
  "task",
  "chart",
  "graph",
  "diagram",
  "visualize",
];

const IMPLEMENTATION_KEYWORDS = [
  "implement",
  "build",
  "develop",
  "write code",
  "fix",
  "resolve",
  "create pr",
  "open pr",
  "branch",
  "feature",
];

const containsAny = (text, keywords) =>
  keywords.some((keyword) => text.includes(keyword));

const parseOwnerRepo = (repolink) => {
  const cleaned = String(repolink || "").replace(/\.git$/, "").replace(/\/$/, "");
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/);
  if (match) return { owner: match[1], repo: match[2] };
  return null;
};

const resolveIntent = ({ agentType, message, forceIntent = null }) => {
  if (forceIntent) return forceIntent;

  const normalizedAgentType = String(agentType || "").toLowerCase();
  const normalized = String(message || "").toLowerCase();

  if (
    normalizedAgentType === "dev" &&
    containsAny(normalized, IMPLEMENTATION_KEYWORDS)
  ) {
    return "implementation";
  }

  if (containsAny(normalized, READ_KEYWORDS)) {
    return "read";
  }

  if (containsAny(normalized, WRITE_KEYWORDS)) {
    return "write";
  }

  return "general";
};

const selectRuleLines = ({ agentType, intent }) => {
  const normalizedAgentType = String(agentType || "").toLowerCase();
  const sharedBase = RULE_PACKS.shared.base;
  const sharedToolCycle = RULE_PACKS.shared.toolCycle;

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
    ];

    if (intent === "write") {
      return [
        ...pmLines,
        ...RULE_PACKS.pm.writeGuardrails,
        ...RULE_PACKS.pm.planningRules,
      ];
    }

    if (intent === "read") {
      return [...pmLines, ...RULE_PACKS.pm.writeGuardrails.slice(3, 5)];
    }

    return [...pmLines, ...RULE_PACKS.pm.writeGuardrails];
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
}) => {
  const resolvedAgentType = agentType;
  const intent = resolveIntent({
    agentType: resolvedAgentType,
    message,
    forceIntent,
  });

  const lines = selectRuleLines({ agentType: resolvedAgentType, intent });
  const systemPromptParts = [
    ...lines,
    `- Project Name: ${project.name || "Untitled Project"}`,
    `- Repository: ${project.repolink || "No repository URL."}`,
  ];

  const ownerRepo = parseOwnerRepo(project.repolink);
  if (ownerRepo) {
    systemPromptParts.push(
      `- GitHub Owner: ${ownerRepo.owner}`,
      `- GitHub Repo: ${ownerRepo.repo}`,
    );
  }

  return {
    systemPrompt: systemPromptParts.join(" "),
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

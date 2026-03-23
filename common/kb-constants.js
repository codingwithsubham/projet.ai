module.exports = {
  FEEDBACK_SCOPE: "feedback",
  LOW_SIGNAL_FEEDBACK: new Set([
    "ok",
    "okay",
    "k",
    "kk",
    "thanks",
    "thank you",
    "thx",
    "done",
    "noted",
  ]),
  HAPPY_KEYWORDS: [
    "great",
    "awesome",
    "perfect",
    "excellent",
    "helpful",
    "good",
    "nice",
    "love",
    "works",
    "working",
    "resolved",
    "thank",
  ],
  AFFIRMATIVE_INPUTS: new Set([
    "yes",
    "y",
    "yeah",
    "yep",
    "sure",
    "ok",
    "okay",
    "confirm",
    "proceed",
    "go ahead",
    "please proceed",
    "yes please",
    "yes let's push it to github",
  ]),
  
  /**
   * @deprecated Use INTENT_KEYWORDS from intent-constants.js instead.
   * These are kept for backward compatibility only.
   */
  READ_KEYWORDS: [
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
  ],
  
  /**
   * @deprecated Use INTENT_KEYWORDS from intent-constants.js instead.
   * These are kept for backward compatibility only.
   */
  WRITE_KEYWORDS: [
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
  ],
  
  /**
   * @deprecated Use INTENT_KEYWORDS from intent-constants.js instead.
   * These are kept for backward compatibility only.
   */
  IMPLEMENTATION_KEYWORDS: [
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
  ],
};

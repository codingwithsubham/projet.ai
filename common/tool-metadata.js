/**
 * Tool Metadata Configuration
 * 
 * Defines tool categories, operation types, and routing priorities.
 * Used by ToolRouterService to determine when to use local RAG vs external tools.
 */

// Tool categories
const TOOL_CATEGORY = {
  LOCAL_RAG: "local_rag",      // Uses indexed knowledge base
  EXTERNAL_READ: "external_read",  // External API read operations (GitHub, etc.)
  EXTERNAL_WRITE: "external_write", // External API write operations
  UTILITY: "utility",          // Local utilities (mermaid, markdown, etc.)
  ACTIVITY: "activity",        // Internal activity tracking
};

// Operation types (for confirmation handling)
const OPERATION_TYPE = {
  READ: "read",           // Read-only, no confirmation needed
  WRITE: "write",         // Creates/modifies data, may need confirmation
  DESTRUCTIVE: "destructive", // Deletes data, requires confirmation
};

// Tool metadata registry
// Higher priority = use first, lower priority = fallback
const TOOL_REGISTRY = {
  // === LOCAL RAG TOOLS (Priority 1 - Always try first) ===
  search_hub: {
    category: TOOL_CATEGORY.LOCAL_RAG,
    operation: OPERATION_TYPE.READ,
    priority: 1,
    autoExecute: true,
    description: "Search indexed knowledge base",
    ragEquivalent: true,
  },

  // === ACTIVITY TOOLS (Priority 1 - Internal, fast) ===
  get_my_activity: {
    category: TOOL_CATEGORY.ACTIVITY,
    operation: OPERATION_TYPE.READ,
    priority: 1,
    autoExecute: true,
    description: "Get user's own activity",
  },
  get_team_activity: {
    category: TOOL_CATEGORY.ACTIVITY,
    operation: OPERATION_TYPE.READ,
    priority: 1,
    autoExecute: true,
    description: "Get team activity summary",
  },
  get_developer_context: {
    category: TOOL_CATEGORY.ACTIVITY,
    operation: OPERATION_TYPE.READ,
    priority: 1,
    autoExecute: true,
    description: "Get developer handoff context",
  },
  getDeveloperActivity: {
    category: TOOL_CATEGORY.ACTIVITY,
    operation: OPERATION_TYPE.READ,
    priority: 1,
    autoExecute: true,
    description: "Get developer activity",
  },
  getHandoffContext: {
    category: TOOL_CATEGORY.ACTIVITY,
    operation: OPERATION_TYPE.READ,
    priority: 1,
    autoExecute: true,
    description: "Get handoff context for developer transition",
  },

  // === UTILITY TOOLS (Priority 1 - Local processing) ===
  generateMermaidChart: {
    category: TOOL_CATEGORY.UTILITY,
    operation: OPERATION_TYPE.READ,
    priority: 1,
    autoExecute: true,
    description: "Generate Mermaid diagram",
  },
  generateMarkdownTable: {
    category: TOOL_CATEGORY.UTILITY,
    operation: OPERATION_TYPE.READ,
    priority: 1,
    autoExecute: true,
    description: "Generate Markdown table",
  },

  // === EXTERNAL READ TOOLS (Priority 2 - Fallback when RAG insufficient) ===
  // GitHub read operations
  get_file_contents: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get file contents from GitHub",
    ragFallback: true,
    ragQueryHint: "file content code", // Used to check RAG first
  },
  list_issues: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "List GitHub issues",
    ragFallback: true,
    ragQueryHint: "issues bugs tasks",
  },
  issue_read: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Read specific GitHub issue",
    ragFallback: true,
  },
  search_issues: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Search GitHub issues",
    ragFallback: true,
    ragQueryHint: "issues bugs tasks",
  },
  list_pull_requests: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "List pull requests",
    ragFallback: true,
    ragQueryHint: "pull request PR merge",
  },
  search_pull_requests: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Search pull requests",
    ragFallback: true,
    ragQueryHint: "pull request PR merge",
  },
  pull_request_read: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Read specific pull request",
    ragFallback: true,
  },
  list_commits: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "List commits",
    ragFallback: true,
    ragQueryHint: "commits changes history",
  },
  get_commit: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get specific commit",
    ragFallback: true,
  },
  list_branches: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "List branches",
    ragFallback: true,
    ragQueryHint: "branch branches",
  },
  get_me: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get current GitHub user info",
  },

  // === JIRA READ TOOLS (Priority 2 - Board operations) ===
  jira_get_issue: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get a specific Jira issue",
    ragFallback: true,
    ragQueryHint: "issues bugs tasks",
  },
  jira_search_issues: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Search Jira issues with JQL",
    ragFallback: true,
    ragQueryHint: "issues bugs tasks epics stories",
  },
  jira_search_issues_summary: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Search Jira issues with minimal fields",
    ragFallback: true,
    ragQueryHint: "issues summary status",
  },
  jira_get_issue_summary: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get Jira issue summary and acceptance criteria",
    ragFallback: true,
  },
  jira_get_my_open_issues: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get current user open Jira issues",
  },
  jira_list_projects: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "List Jira projects",
  },
  jira_get_project: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get Jira project details",
  },
  jira_get_sprints: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "List sprints in a Jira board",
    ragFallback: true,
    ragQueryHint: "sprint iteration",
  },
  jira_get_sprint: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get Jira sprint details",
  },
  jira_get_board: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get Jira board details",
  },
  jira_get_boards: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "List Jira boards",
  },
  jira_get_board_configuration: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get Jira board configuration including columns and estimation",
  },
  jira_get_sprint_issues: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get all issues in a sprint",
    ragFallback: true,
    ragQueryHint: "sprint issues tasks stories",
  },
  jira_move_issues_to_sprint: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Move issues to a sprint",
  },
  jira_get_transitions: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get available transitions for a Jira issue",
  },
  jira_get_issue_comments: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get comments on a Jira issue",
  },
  jira_get_statuses: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    description: "Get Jira workflow statuses",
  },
  jira_assign_issue: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Assign or unassign a Jira issue",
  },

  // === JIRA WRITE TOOLS (Priority 3 - May need confirmation) ===
  jira_create_issue: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Create a Jira issue",
  },
  jira_update_issue: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Update a Jira issue",
  },
  jira_transition_issue: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Transition a Jira issue to a new status",
  },
  jira_add_comment: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Add a comment to a Jira issue",
  },
  jira_create_sprint: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Create a new Jira sprint",
  },
  jira_get_epics: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    ragFallback: true,
    description: "List epics for a Jira board",
  },
  jira_get_epic_issues: {
    category: TOOL_CATEGORY.EXTERNAL_READ,
    operation: OPERATION_TYPE.READ,
    priority: 2,
    autoExecute: true,
    ragFallback: true,
    description: "List issues under a Jira epic",
  },
  jira_move_issues_to_epic: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Move/link issues to a Jira epic",
  },
  jira_remove_issues_from_epic: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Remove issues from a Jira epic",
  },

  // === EXTERNAL WRITE TOOLS (Priority 3 - May need confirmation) ===
  create_branch: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Create a new branch",
  },
  create_pull_request: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Create a pull request",
  },
  push_files: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Push files to repository",
  },
  create_or_update_file: {
    category: TOOL_CATEGORY.EXTERNAL_WRITE,
    operation: OPERATION_TYPE.WRITE,
    priority: 3,
    autoExecute: false,
    requiresConfirmation: true,
    description: "Create or update a file in repository",
  },
};

// RAG sufficiency thresholds
const RAG_THRESHOLDS = {
  MIN_SCORE: 0.70,          // Minimum similarity score to consider RAG sufficient
  MIN_CHUNKS: 2,            // Minimum number of relevant chunks
  HIGH_CONFIDENCE: 0.85,    // High confidence - definitely use RAG
  PARTIAL_CONFIDENCE: 0.70, // Partial confidence - RAG + external if needed
};

// Query patterns that should prefer RAG over external tools
const RAG_PREFERRED_PATTERNS = [
  /auth(entication|orization)?/i,
  /flow|process|workflow/i,
  /architecture|structure|design/i,
  /how does|how do|explain/i,
  /what is|what are/i,
  /user stor(y|ies)/i,
  /requirement/i,
  /epic|feature/i,
  /document|spec|srs/i,
  /api|endpoint/i,
  /module|component|service/i,
  /function|method|class/i,
  /database|schema|model/i,
  /config(uration)?/i,
];

// Query patterns that should use external tools
const EXTERNAL_PREFERRED_PATTERNS = [
  /latest commit|recent commit/i,
  /current (issue|pr|pull request)/i,
  /open (issue|pr|pull request)/i,
  /who (created|authored|wrote)/i,
  /when was.*created/i,
  /branch (list|status)/i,
  /merge (status|conflict)/i,
  /real.?time|live|current/i,
  /jira (issue|board|sprint|backlog)/i,
  /sprint (status|progress|board)/i,
  /backlog|kanban|scrum board/i,
  /story point|velocity/i,
  /transition|workflow state/i,
];

/**
 * Get tool metadata by name
 */
const getToolMetadata = (toolName) => {
  const normalizedName = String(toolName || "").toLowerCase().trim();
  return TOOL_REGISTRY[normalizedName] || TOOL_REGISTRY[toolName] || null;
};

/**
 * Check if tool is a read operation
 */
const isReadOperation = (toolName) => {
  const meta = getToolMetadata(toolName);
  return meta?.operation === OPERATION_TYPE.READ;
};

/**
 * Check if tool should auto-execute without confirmation
 */
const shouldAutoExecute = (toolName) => {
  const meta = getToolMetadata(toolName);
  return meta?.autoExecute === true;
};

/**
 * Check if tool has a RAG fallback (should check RAG first)
 */
const hasRagFallback = (toolName) => {
  const meta = getToolMetadata(toolName);
  return meta?.ragFallback === true;
};

/**
 * Get tool priority
 */
const getToolPriority = (toolName) => {
  const meta = getToolMetadata(toolName);
  return meta?.priority || 99;
};

/**
 * Check if query pattern prefers RAG
 */
const queryPrefersRag = (query) => {
  const q = String(query || "").trim();
  return RAG_PREFERRED_PATTERNS.some(pattern => pattern.test(q));
};

/**
 * Check if query pattern prefers external tools
 */
const queryPrefersExternal = (query) => {
  const q = String(query || "").trim();
  return EXTERNAL_PREFERRED_PATTERNS.some(pattern => pattern.test(q));
};

/**
 * Get tools by category
 */
const getToolsByCategory = (category) => {
  return Object.entries(TOOL_REGISTRY)
    .filter(([_, meta]) => meta.category === category)
    .map(([name]) => name);
};

/**
 * Get all external tool names
 */
const getExternalToolNames = () => {
  return Object.entries(TOOL_REGISTRY)
    .filter(([_, meta]) => 
      meta.category === TOOL_CATEGORY.EXTERNAL_READ || 
      meta.category === TOOL_CATEGORY.EXTERNAL_WRITE
    )
    .map(([name]) => name);
};

module.exports = {
  TOOL_CATEGORY,
  OPERATION_TYPE,
  TOOL_REGISTRY,
  RAG_THRESHOLDS,
  RAG_PREFERRED_PATTERNS,
  EXTERNAL_PREFERRED_PATTERNS,
  getToolMetadata,
  isReadOperation,
  shouldAutoExecute,
  hasRagFallback,
  getToolPriority,
  queryPrefersRag,
  queryPrefersExternal,
  getToolsByCategory,
  getExternalToolNames,
};

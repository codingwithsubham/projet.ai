/**
 * PMO Analytics Constants
 *
 * Thresholds, weights, and configuration for sprint analytics,
 * blocker detection, and project health scoring.
 */

// --- Blocker Detection ---
const BLOCKER_THRESHOLDS = {
  STALE_DAYS: 3,               // Issue with no status change for N days → potential blocker
  UNASSIGNED_IN_SPRINT: true,  // Unassigned issues in active sprint flagged
  MAX_AGE_IN_PROGRESS: 5,      // Issue "In Progress" > N days without update → stale
};

// Jira statuses that indicate an issue is blocked or stuck
const BLOCKED_STATUS_KEYWORDS = [
  "blocked",
  "impediment",
  "on hold",
  "waiting",
  "pending",
];

// Jira statuses grouped by category for analytics
const STATUS_CATEGORIES = {
  TODO: ["to do", "open", "backlog", "new", "selected for development"],
  IN_PROGRESS: ["in progress", "in review", "in development", "code review", "testing", "in qa"],
  DONE: ["done", "closed", "resolved", "complete", "released"],
};

// --- Sprint Health Score ---
const HEALTH_SCORE_WEIGHTS = {
  VELOCITY_TREND: 0.30,   // Are we improving or declining?
  BLOCKER_COUNT: 0.25,    // How many blockers/stale issues?
  SCOPE_CHANGE: 0.25,     // Issues added/removed mid-sprint
  TIMELINE: 0.20,         // Points remaining vs days remaining
};

const HEALTH_LEVELS = {
  GREEN: { min: 75, label: "Healthy", emoji: "🟢" },
  YELLOW: { min: 50, label: "At Risk", emoji: "🟡" },
  RED: { min: 0, label: "Critical", emoji: "🔴" },
};

// --- Velocity ---
const VELOCITY_DEFAULTS = {
  SPRINT_COUNT: 3,                // Default number of sprints for velocity calculation
  MAX_SPRINT_COUNT: 10,           // Max sprints to look back
  STORY_POINT_FIELDS: [           // Common Jira custom field names for story points
    "story_points",
    "customfield_10016",
    "customfield_10028",
    "customfield_10014",
  ],
};

// --- Cycle Time ---
const CYCLE_TIME_DEFAULTS = {
  MAX_ISSUES: 50,                 // Max issues to analyze for cycle time
  IN_PROGRESS_STATUSES: STATUS_CATEGORIES.IN_PROGRESS,
  DONE_STATUSES: STATUS_CATEGORIES.DONE,
};

// --- GitHub Milestone Mapping ---
const GITHUB_STATE_MAP = {
  open: "TODO",
  closed: "DONE",
};

// --- Standup / Report Defaults ---
const REPORT_DEFAULTS = {
  STANDUP_HOURS: 24,              // Look back N hours for standup
  WEEKLY_DAYS: 7,                 // Look back N days for weekly report
  SPRINT_REVIEW_SPRINTS: 1,      // Number of sprints for sprint review
};

/**
 * Categorize a status string into TODO / IN_PROGRESS / DONE
 */
const categorizeStatus = (status) => {
  if (!status) return "TODO";
  const lower = String(status).toLowerCase().trim();

  for (const [category, keywords] of Object.entries(STATUS_CATEGORIES)) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return "TODO"; // Default unknown statuses to TODO
};

/**
 * Check if a status string indicates a blocked issue
 */
const isBlockedStatus = (status) => {
  if (!status) return false;
  const lower = String(status).toLowerCase().trim();
  return BLOCKED_STATUS_KEYWORDS.some((k) => lower.includes(k));
};

/**
 * Extract story points from Jira issue fields
 */
const extractStoryPoints = (issueFields) => {
  if (!issueFields) return 0;

  for (const field of VELOCITY_DEFAULTS.STORY_POINT_FIELDS) {
    const value = issueFields[field];
    if (value != null && !isNaN(Number(value))) {
      return Number(value);
    }
  }
  return 0;
};

/**
 * Calculate health level from a 0-100 score
 */
const getHealthLevel = (score) => {
  if (score >= HEALTH_LEVELS.GREEN.min) return HEALTH_LEVELS.GREEN;
  if (score >= HEALTH_LEVELS.YELLOW.min) return HEALTH_LEVELS.YELLOW;
  return HEALTH_LEVELS.RED;
};

module.exports = {
  BLOCKER_THRESHOLDS,
  BLOCKED_STATUS_KEYWORDS,
  STATUS_CATEGORIES,
  HEALTH_SCORE_WEIGHTS,
  HEALTH_LEVELS,
  VELOCITY_DEFAULTS,
  CYCLE_TIME_DEFAULTS,
  GITHUB_STATE_MAP,
  REPORT_DEFAULTS,
  categorizeStatus,
  isBlockedStatus,
  extractStoryPoints,
  getHealthLevel,
};

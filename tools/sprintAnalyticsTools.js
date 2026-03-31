const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const {
  VELOCITY_DEFAULTS,
  BLOCKER_THRESHOLDS,
  STATUS_CATEGORIES,
  HEALTH_SCORE_WEIGHTS,
  categorizeStatus,
  isBlockedStatus,
  extractStoryPoints,
  getHealthLevel,
} = require("../common/pmo-constants");
const { jiraFetch, resolveBoardId } = require("../utils/jiraApi");
const { githubFetch, parseOwnerRepo } = require("../utils/githubApi");

// ─── Tool 1: Sprint Velocity ─────────────────────────────────────────

const createSprintVelocityTool = (project) => {
  return tool(
    async ({ sprintCount }) => {
      const count = Math.min(sprintCount || VELOCITY_DEFAULTS.SPRINT_COUNT, VELOCITY_DEFAULTS.MAX_SPRINT_COUNT);
      const platform = project.boardConfig?.platform || "github";

      try {
        if (platform === "jira") {
          return await computeJiraVelocity(project.boardConfig, count);
        }
        return await computeGithubVelocity(project, count);
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "get_sprint_velocity",
      description:
        "Calculate sprint velocity (story points completed per sprint) over the last N sprints. Returns per-sprint breakdown, average velocity, and trend direction. Use this when the PM asks about velocity, throughput, or team capacity.",
      schema: z.object({
        sprintCount: z
          .number()
          .optional()
          .default(VELOCITY_DEFAULTS.SPRINT_COUNT)
          .describe(`Number of recent sprints to analyze (default: ${VELOCITY_DEFAULTS.SPRINT_COUNT}, max: ${VELOCITY_DEFAULTS.MAX_SPRINT_COUNT})`),
      }),
    }
  );
};

const computeJiraVelocity = async (boardConfig, sprintCount) => {
  const boardId = await resolveBoardId(boardConfig);

  // Fetch closed + active sprints
  const sprintsData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/board/${boardId}/sprint?state=closed,active&maxResults=${sprintCount + 5}`
  );

  const sprints = (sprintsData.values || [])
    .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))
    .slice(0, sprintCount);

  if (!sprints.length) {
    return JSON.stringify({ success: true, message: "No sprints found.", sprints: [], averageVelocity: 0 });
  }

  const sprintResults = [];

  for (const sprint of sprints) {
    const issuesData = await jiraFetch(
      boardConfig,
      `/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=200&fields=status,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
    );

    let committed = 0;
    let completed = 0;
    let totalIssues = 0;
    let doneIssues = 0;

    for (const issue of issuesData.issues || []) {
      const points = extractStoryPoints(issue.fields);
      const status = categorizeStatus(issue.fields?.status?.name);
      committed += points;
      totalIssues++;
      if (status === "DONE") {
        completed += points;
        doneIssues++;
      }
    }

    sprintResults.push({
      sprintName: sprint.name,
      sprintId: sprint.id,
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      committed,
      completed,
      completionRate: committed > 0 ? Math.round((completed / committed) * 100) : 0,
      totalIssues,
      doneIssues,
    });
  }

  const completedPoints = sprintResults.map((s) => s.completed);
  const averageVelocity = completedPoints.length
    ? Math.round(completedPoints.reduce((a, b) => a + b, 0) / completedPoints.length)
    : 0;

  // Trend: compare last sprint to average of previous ones
  let trend = "stable";
  if (completedPoints.length >= 2) {
    const latest = completedPoints[0];
    const previousAvg = completedPoints.slice(1).reduce((a, b) => a + b, 0) / (completedPoints.length - 1);
    if (latest > previousAvg * 1.1) trend = "improving";
    else if (latest < previousAvg * 0.9) trend = "declining";
  }

  return JSON.stringify({
    success: true,
    platform: "jira",
    sprintCount: sprintResults.length,
    sprints: sprintResults,
    averageVelocity,
    trend,
  });
};

const computeGithubVelocity = async (project, milestoneCount) => {
  const repoInfo = parseOwnerRepo(project.repolink || project.repositories?.[0]?.repolink);
  if (!repoInfo) {
    return JSON.stringify({ success: false, error: "No GitHub repository configured." });
  }

  const { owner, repo } = repoInfo;
  const milestones = await githubFetch(
    project.pat_token,
    `/repos/${owner}/${repo}/milestones?state=all&sort=due_on&direction=desc&per_page=${milestoneCount}`
  );

  if (!milestones.length) {
    return JSON.stringify({ success: true, message: "No milestones found.", sprints: [], averageVelocity: 0 });
  }

  const sprintResults = milestones.map((m) => ({
    sprintName: m.title,
    sprintId: m.number,
    state: m.state,
    dueDate: m.due_on,
    totalIssues: m.open_issues + m.closed_issues,
    doneIssues: m.closed_issues,
    completionRate: (m.open_issues + m.closed_issues) > 0
      ? Math.round((m.closed_issues / (m.open_issues + m.closed_issues)) * 100)
      : 0,
  }));

  const avgCompletion = sprintResults.length
    ? Math.round(sprintResults.reduce((a, s) => a + s.doneIssues, 0) / sprintResults.length)
    : 0;

  return JSON.stringify({
    success: true,
    platform: "github",
    sprintCount: sprintResults.length,
    sprints: sprintResults,
    averageVelocity: avgCompletion,
    note: "GitHub milestones do not have story points. Velocity is based on issue counts.",
  });
};

// ─── Tool 2: Burndown Data ───────────────────────────────────────────

const createBurndownDataTool = (project) => {
  return tool(
    async ({ sprintId }) => {
      const platform = project.boardConfig?.platform || "github";

      try {
        if (platform === "jira") {
          return await computeJiraBurndown(project.boardConfig, sprintId);
        }
        return await computeGithubBurndown(project, sprintId);
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "get_burndown_data",
      description:
        "Get burndown data for a sprint — story points or issue counts remaining over time. Returns daily data points suitable for a burndown chart. Use generate_mermaid_chart with chartType 'line' to visualize the result. If no sprintId is given, uses the active sprint.",
      schema: z.object({
        sprintId: z
          .string()
          .optional()
          .describe("Sprint ID or milestone number. If omitted, uses the currently active sprint."),
      }),
    }
  );
};

const computeJiraBurndown = async (boardConfig, sprintId) => {
  const boardId = await resolveBoardId(boardConfig);

  // If no sprintId, find the active sprint
  if (!sprintId) {
    const sprintsData = await jiraFetch(
      boardConfig,
      `/rest/agile/1.0/board/${boardId}/sprint?state=active`
    );
    const activeSprint = sprintsData.values?.[0];
    if (!activeSprint) {
      return JSON.stringify({ success: false, error: "No active sprint found." });
    }
    sprintId = String(activeSprint.id);
  }

  // Get sprint details
  const sprint = await jiraFetch(boardConfig, `/rest/agile/1.0/sprint/${sprintId}`);
  const startDate = sprint.startDate ? new Date(sprint.startDate) : null;
  const endDate = sprint.endDate ? new Date(sprint.endDate) : null;

  if (!startDate || !endDate) {
    return JSON.stringify({ success: false, error: "Sprint has no start/end dates." });
  }

  // Get all sprint issues
  const issuesData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/sprint/${sprintId}/issue?maxResults=200&fields=status,resolutiondate,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
  );

  const issues = issuesData.issues || [];
  let totalPoints = 0;
  const completions = []; // { date, points }

  for (const issue of issues) {
    const points = extractStoryPoints(issue.fields) || 1; // Default 1 if no estimates
    totalPoints += points;

    const status = categorizeStatus(issue.fields?.status?.name);
    if (status === "DONE") {
      const resolvedDate = issue.fields?.resolutiondate
        ? new Date(issue.fields.resolutiondate)
        : null;
      if (resolvedDate) {
        completions.push({ date: resolvedDate, points });
      }
    }
  }

  // Build daily burndown
  const burndown = [];
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  let remaining = totalPoints;
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + i);
    const dayStr = day.toISOString().split("T")[0];

    // Subtract points completed on or before this day
    const completedToday = completions
      .filter((c) => c.date.toISOString().split("T")[0] === dayStr)
      .reduce((sum, c) => sum + c.points, 0);

    remaining -= completedToday;

    // Only include data up to today
    if (day <= today) {
      burndown.push({ date: dayStr, remaining: Math.max(0, remaining) });
    }
  }

  // Ideal burndown line
  const idealBurndown = [];
  const pointsPerDay = totalPoints / Math.max(days - 1, 1);
  for (let i = 0; i < days; i++) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + i);
    idealBurndown.push({
      date: day.toISOString().split("T")[0],
      remaining: Math.max(0, Math.round(totalPoints - pointsPerDay * i)),
    });
  }

  return JSON.stringify({
    success: true,
    platform: "jira",
    sprintName: sprint.name,
    sprintId: sprint.id,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    totalPoints,
    totalIssues: issues.length,
    actual: burndown,
    ideal: idealBurndown,
    chartReady: {
      title: `Burndown: ${sprint.name}`,
      labels: burndown.map((d) => d.date),
      datasets: [
        { label: "Actual", values: burndown.map((d) => d.remaining) },
        {
          label: "Ideal",
          values: idealBurndown
            .filter((d) => burndown.some((b) => b.date === d.date))
            .map((d) => d.remaining),
        },
      ],
    },
  });
};

const computeGithubBurndown = async (project, milestoneNumber) => {
  const repoInfo = parseOwnerRepo(project.repolink || project.repositories?.[0]?.repolink);
  if (!repoInfo) {
    return JSON.stringify({ success: false, error: "No GitHub repository configured." });
  }

  const { owner, repo } = repoInfo;

  // Auto-discover active milestone if not specified
  if (!milestoneNumber) {
    const milestones = await githubFetch(
      project.pat_token,
      `/repos/${owner}/${repo}/milestones?state=open&sort=due_on&direction=asc&per_page=1`
    );
    if (!milestones.length) {
      return JSON.stringify({ success: false, error: "No open milestones found." });
    }
    milestoneNumber = String(milestones[0].number);
  }

  const milestone = await githubFetch(
    project.pat_token,
    `/repos/${owner}/${repo}/milestones/${milestoneNumber}`
  );

  const totalIssues = milestone.open_issues + milestone.closed_issues;

  // Get closed issues with their closed_at dates
  const closedIssues = await githubFetch(
    project.pat_token,
    `/repos/${owner}/${repo}/issues?milestone=${milestoneNumber}&state=closed&per_page=100&sort=updated&direction=asc`
  );

  const createdAt = new Date(milestone.created_at);
  const dueDate = milestone.due_on ? new Date(milestone.due_on) : new Date();
  const today = new Date();
  const endDate = dueDate < today ? dueDate : today;
  const days = Math.ceil((endDate - createdAt) / (1000 * 60 * 60 * 24)) + 1;

  const burndown = [];
  let remaining = totalIssues;

  for (let i = 0; i < days; i++) {
    const day = new Date(createdAt);
    day.setDate(day.getDate() + i);
    const dayStr = day.toISOString().split("T")[0];

    if (day > today) break;

    const closedToday = closedIssues.filter(
      (issue) => issue.closed_at && new Date(issue.closed_at).toISOString().split("T")[0] === dayStr
    ).length;

    remaining -= closedToday;
    burndown.push({ date: dayStr, remaining: Math.max(0, remaining) });
  }

  return JSON.stringify({
    success: true,
    platform: "github",
    milestoneName: milestone.title,
    milestoneNumber: milestone.number,
    totalIssues,
    actual: burndown,
    note: "GitHub milestones use issue counts (no story points).",
    chartReady: {
      title: `Burndown: ${milestone.title}`,
      labels: burndown.map((d) => d.date),
      datasets: [
        { label: "Remaining Issues", values: burndown.map((d) => d.remaining) },
      ],
    },
  });
};

// ─── Tool 3: Cycle Time ──────────────────────────────────────────────

const createCycleTimeTool = (project) => {
  return tool(
    async ({ days, issueType }) => {
      const platform = project.boardConfig?.platform || "github";

      try {
        if (platform === "jira") {
          return await computeJiraCycleTime(project.boardConfig, days, issueType);
        }
        return await computeGithubCycleTime(project, days);
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "get_cycle_time",
      description:
        "Calculate average cycle time — how many days issues take from 'In Progress' to 'Done'. Breaks down by issue type (Story, Bug, Task). Use this for process improvement discussions and sprint retrospectives.",
      schema: z.object({
        days: z
          .number()
          .optional()
          .default(30)
          .describe("Look back N days for resolved issues (default: 30)"),
        issueType: z
          .string()
          .optional()
          .describe("Filter by issue type (e.g., 'Story', 'Bug', 'Task'). Omit for all types."),
      }),
    }
  );
};

const computeJiraCycleTime = async (boardConfig, days, issueType) => {
  const projectKey = boardConfig.jira?.projectKey;
  if (!projectKey) {
    return JSON.stringify({ success: false, error: "No Jira project key configured." });
  }

  // Build JQL for recently resolved issues
  let jql = `project = "${projectKey}" AND resolved >= -${days}d`;
  if (issueType) {
    jql += ` AND issuetype = "${issueType}"`;
  }
  jql += " ORDER BY resolved DESC";

  // Try with changelog for accurate cycle time, fallback without it
  let searchData;
  try {
    searchData = await jiraFetch(
      boardConfig,
      `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=issuetype,created,resolutiondate,status&expand=changelog`
    );
  } catch (_) {
    // Fallback: fetch without changelog (will use created→resolved as cycle time)
    searchData = await jiraFetch(
      boardConfig,
      `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=issuetype,created,resolutiondate,status`
    );
  }

  const issues = searchData.issues || [];
  const cycleTimesByType = {};

  for (const issue of issues) {
    const type = issue.fields?.issuetype?.name || "Unknown";
    const resolutionDate = issue.fields?.resolutiondate ? new Date(issue.fields.resolutiondate) : null;
    if (!resolutionDate) continue;

    // Find when the issue first moved to "In Progress"
    let inProgressDate = null;
    const changelog = issue.changelog?.histories || [];

    for (const history of changelog) {
      for (const item of history.items || []) {
        if (item.field === "status") {
          const toStatus = (item.toString || "").toLowerCase();
          if (STATUS_CATEGORIES.IN_PROGRESS.some((s) => toStatus.includes(s))) {
            const changeDate = new Date(history.created);
            if (!inProgressDate || changeDate < inProgressDate) {
              inProgressDate = changeDate;
            }
          }
        }
      }
    }

    // If no "In Progress" transition found, use created date as fallback
    const startDate = inProgressDate || new Date(issue.fields.created);
    const cycleDays = Math.max(0, (resolutionDate - startDate) / (1000 * 60 * 60 * 24));

    if (!cycleTimesByType[type]) cycleTimesByType[type] = [];
    cycleTimesByType[type].push(Math.round(cycleDays * 10) / 10);
  }

  // Compute averages
  const breakdown = Object.entries(cycleTimesByType).map(([type, times]) => ({
    issueType: type,
    count: times.length,
    averageDays: Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10,
    minDays: Math.min(...times),
    maxDays: Math.max(...times),
    medianDays: times.sort((a, b) => a - b)[Math.floor(times.length / 2)],
  }));

  const allTimes = Object.values(cycleTimesByType).flat();
  const overallAvg = allTimes.length
    ? Math.round((allTimes.reduce((a, b) => a + b, 0) / allTimes.length) * 10) / 10
    : 0;

  return JSON.stringify({
    success: true,
    platform: "jira",
    period: `Last ${days} days`,
    totalIssuesAnalyzed: allTimes.length,
    overallAverageCycleDays: overallAvg,
    byIssueType: breakdown,
  });
};

const computeGithubCycleTime = async (project, days) => {
  const repoInfo = parseOwnerRepo(project.repolink || project.repositories?.[0]?.repolink);
  if (!repoInfo) {
    return JSON.stringify({ success: false, error: "No GitHub repository configured." });
  }

  const { owner, repo } = repoInfo;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const closedIssues = await githubFetch(
    project.pat_token,
    `/repos/${owner}/${repo}/issues?state=closed&since=${since.toISOString()}&per_page=50&sort=updated&direction=desc`
  );

  // Filter out pull requests (GitHub API returns PRs in issues endpoint)
  const issues = closedIssues.filter((i) => !i.pull_request);

  const cycleTimes = issues
    .filter((i) => i.closed_at)
    .map((i) => {
      const created = new Date(i.created_at);
      const closed = new Date(i.closed_at);
      return Math.round(((closed - created) / (1000 * 60 * 60 * 24)) * 10) / 10;
    });

  const overallAvg = cycleTimes.length
    ? Math.round((cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10) / 10
    : 0;

  return JSON.stringify({
    success: true,
    platform: "github",
    period: `Last ${days} days`,
    totalIssuesAnalyzed: cycleTimes.length,
    overallAverageCycleDays: overallAvg,
    note: "GitHub does not track 'In Progress' transitions. Cycle time is measured from issue creation to close.",
  });
};

// ─── Tool 4: Blocker Detection ────────────────────────────────────────

const createBlockerDetectionTool = (project) => {
  return tool(
    async ({ staleDays, includeUnassigned }) => {
      const platform = project.boardConfig?.platform || "github";

      try {
        if (platform === "jira") {
          return await detectJiraBlockers(project.boardConfig, staleDays, includeUnassigned);
        }
        return await detectGithubBlockers(project, staleDays, includeUnassigned);
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "detect_blockers",
      description:
        "Detect blocked or stale issues in the active sprint. Finds issues with no status change for N days, unassigned issues in active sprint, and issues explicitly marked as blocked. Use this proactively in team reports and sprint reviews.",
      schema: z.object({
        staleDays: z
          .number()
          .optional()
          .default(BLOCKER_THRESHOLDS.STALE_DAYS)
          .describe(`Days without status change to flag as stale (default: ${BLOCKER_THRESHOLDS.STALE_DAYS})`),
        includeUnassigned: z
          .boolean()
          .optional()
          .default(true)
          .describe("Include unassigned issues in active sprint as potential blockers"),
      }),
    }
  );
};

const detectJiraBlockers = async (boardConfig, staleDays, includeUnassigned) => {
  const boardId = await resolveBoardId(boardConfig);

  // Find active sprint
  const sprintsData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/board/${boardId}/sprint?state=active`
  );
  const activeSprint = sprintsData.values?.[0];
  if (!activeSprint) {
    return JSON.stringify({ success: true, message: "No active sprint found.", blockers: [] });
  }

  // Get sprint issues
  const issuesData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/sprint/${activeSprint.id}/issue?maxResults=200&fields=summary,status,assignee,updated,priority,issuetype,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
  );

  const now = new Date();
  const staleThreshold = new Date(now);
  staleThreshold.setDate(staleThreshold.getDate() - staleDays);

  const blockers = [];

  for (const issue of issuesData.issues || []) {
    const fields = issue.fields || {};
    const statusName = fields.status?.name || "";
    const category = categorizeStatus(statusName);
    const updatedAt = fields.updated ? new Date(fields.updated) : null;
    const assignee = fields.assignee?.displayName || null;
    const reasons = [];

    // Skip done issues
    if (category === "DONE") continue;

    // Check: explicitly blocked status
    if (isBlockedStatus(statusName)) {
      reasons.push("Status indicates blocked/on hold");
    }

    // Check: stale (no update for N days)
    if (updatedAt && updatedAt < staleThreshold) {
      const staleSince = Math.ceil((now - updatedAt) / (1000 * 60 * 60 * 24));
      reasons.push(`No update for ${staleSince} days`);
    }

    // Check: in progress too long
    if (category === "IN_PROGRESS" && updatedAt) {
      const daysInProgress = Math.ceil((now - updatedAt) / (1000 * 60 * 60 * 24));
      if (daysInProgress > BLOCKER_THRESHOLDS.MAX_AGE_IN_PROGRESS) {
        reasons.push(`In Progress for ${daysInProgress} days without update`);
      }
    }

    // Check: unassigned
    if (includeUnassigned && !assignee && category !== "TODO") {
      reasons.push("In Progress but unassigned");
    }

    if (reasons.length > 0) {
      blockers.push({
        key: issue.key,
        summary: fields.summary,
        status: statusName,
        assignee: assignee || "Unassigned",
        priority: fields.priority?.name || "None",
        issueType: fields.issuetype?.name || "Unknown",
        storyPoints: extractStoryPoints(fields),
        lastUpdated: fields.updated,
        reasons,
      });
    }
  }

  // Sort by severity (most reasons first, then by last updated)
  blockers.sort((a, b) => b.reasons.length - a.reasons.length);

  return JSON.stringify({
    success: true,
    platform: "jira",
    sprintName: activeSprint.name,
    sprintId: activeSprint.id,
    totalSprintIssues: (issuesData.issues || []).length,
    blockerCount: blockers.length,
    blockers,
    summary: blockers.length
      ? `Found ${blockers.length} blocked/stale issues in sprint "${activeSprint.name}".`
      : `No blockers detected in sprint "${activeSprint.name}". Sprint looks healthy.`,
  });
};

const detectGithubBlockers = async (project, staleDays, includeUnassigned) => {
  const repoInfo = parseOwnerRepo(project.repolink || project.repositories?.[0]?.repolink);
  if (!repoInfo) {
    return JSON.stringify({ success: false, error: "No GitHub repository configured." });
  }

  const { owner, repo } = repoInfo;

  // Get open issues
  const openIssues = await githubFetch(
    project.pat_token,
    `/repos/${owner}/${repo}/issues?state=open&per_page=100&sort=updated&direction=asc`
  );

  const issues = openIssues.filter((i) => !i.pull_request);
  const now = new Date();
  const staleThreshold = new Date(now);
  staleThreshold.setDate(staleThreshold.getDate() - staleDays);

  const blockers = [];

  for (const issue of issues) {
    const updatedAt = new Date(issue.updated_at);
    const assignee = issue.assignee?.login || null;
    const labels = (issue.labels || []).map((l) => l.name.toLowerCase());
    const reasons = [];

    // Check: labeled as blocked
    if (labels.some((l) => l.includes("block") || l.includes("impediment") || l.includes("on hold"))) {
      reasons.push("Labeled as blocked/on hold");
    }

    // Check: stale
    if (updatedAt < staleThreshold) {
      const staleSince = Math.ceil((now - updatedAt) / (1000 * 60 * 60 * 24));
      reasons.push(`No update for ${staleSince} days`);
    }

    // Check: unassigned
    if (includeUnassigned && !assignee) {
      reasons.push("Unassigned");
    }

    if (reasons.length > 0) {
      blockers.push({
        number: issue.number,
        title: issue.title,
        assignee: assignee || "Unassigned",
        labels: issue.labels.map((l) => l.name),
        lastUpdated: issue.updated_at,
        reasons,
      });
    }
  }

  blockers.sort((a, b) => b.reasons.length - a.reasons.length);

  return JSON.stringify({
    success: true,
    platform: "github",
    totalOpenIssues: issues.length,
    blockerCount: blockers.length,
    blockers,
    summary: blockers.length
      ? `Found ${blockers.length} blocked/stale open issues.`
      : "No blockers detected among open issues.",
  });
};

// ─── Tool 5: Sprint Health Score ──────────────────────────────────────

const createSprintHealthTool = (project) => {
  return tool(
    async () => {
      const platform = project.boardConfig?.platform || "github";

      try {
        if (platform === "jira") {
          return await computeJiraSprintHealth(project);
        }
        return JSON.stringify({
          success: true,
          message: "Sprint health scoring requires Jira with story points. For GitHub, use detect_blockers and get_sprint_velocity individually.",
        });
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "analyze_sprint_health",
      description:
        "Compute a composite sprint health score (0-100) for the active sprint. Factors: velocity trend (30%), blockers (25%), scope changes (25%), timeline vs remaining work (20%). Returns health level (Green/Yellow/Red) with actionable insights.",
      schema: z.object({}),
    }
  );
};

const computeJiraSprintHealth = async (project) => {
  const boardConfig = project.boardConfig;
  const boardId = await resolveBoardId(boardConfig);

  // 1. Get active sprint
  const sprintsData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/board/${boardId}/sprint?state=active`
  );
  const activeSprint = sprintsData.values?.[0];
  if (!activeSprint) {
    return JSON.stringify({ success: true, message: "No active sprint found." });
  }

  const startDate = activeSprint.startDate ? new Date(activeSprint.startDate) : null;
  const endDate = activeSprint.endDate ? new Date(activeSprint.endDate) : null;
  const now = new Date();

  // 2. Get sprint issues
  const issuesData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/sprint/${activeSprint.id}/issue?maxResults=200&fields=summary,status,assignee,updated,issuetype,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
  );

  const issues = issuesData.issues || [];
  let totalPoints = 0;
  let donePoints = 0;
  let blockerCount = 0;
  let inProgressCount = 0;
  let todoCount = 0;
  let doneCount = 0;

  const staleThreshold = new Date(now);
  staleThreshold.setDate(staleThreshold.getDate() - BLOCKER_THRESHOLDS.STALE_DAYS);

  for (const issue of issues) {
    const fields = issue.fields || {};
    const points = extractStoryPoints(fields) || 1;
    const statusName = fields.status?.name || "";
    const category = categorizeStatus(statusName);
    const updatedAt = fields.updated ? new Date(fields.updated) : null;

    totalPoints += points;

    if (category === "DONE") { donePoints += points; doneCount++; }
    else if (category === "IN_PROGRESS") { inProgressCount++; }
    else { todoCount++; }

    // Count blockers
    if (category !== "DONE") {
      if (isBlockedStatus(statusName)) blockerCount++;
      else if (updatedAt && updatedAt < staleThreshold) blockerCount++;
    }
  }

  // 3. Compute sub-scores

  // Timeline score: are we on track? (points remaining vs days remaining)
  let timelineScore = 100;
  if (startDate && endDate) {
    const totalDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(0, (now - startDate) / (1000 * 60 * 60 * 24));
    const timeProgress = Math.min(1, elapsedDays / totalDays);
    const pointsProgress = totalPoints > 0 ? donePoints / totalPoints : 0;

    // If we're 60% through time but only 30% through work → at risk
    const gap = timeProgress - pointsProgress;
    if (gap > 0.3) timelineScore = 20;
    else if (gap > 0.15) timelineScore = 50;
    else if (gap > 0) timelineScore = 75;
    else timelineScore = 100;
  }

  // Blocker score: fewer blockers = higher score
  const blockerRatio = issues.length > 0 ? blockerCount / issues.length : 0;
  const blockerScore = Math.max(0, Math.round(100 * (1 - blockerRatio * 3))); // 3x multiplier for severity

  // Velocity score: use previous velocity vs current pace
  // Simplified: based on completion rate vs expected rate
  let velocityScore = 75; // Default neutral
  if (startDate && endDate && totalPoints > 0) {
    const totalDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(1, (now - startDate) / (1000 * 60 * 60 * 24));
    const expectedRate = elapsedDays / totalDays;
    const actualRate = donePoints / totalPoints;
    const ratio = expectedRate > 0 ? actualRate / expectedRate : 1;

    if (ratio >= 0.9) velocityScore = 100;
    else if (ratio >= 0.7) velocityScore = 75;
    else if (ratio >= 0.5) velocityScore = 50;
    else velocityScore = 25;
  }

  // Scope score: based on ratio of todo items (proxy for scope — perfect data would need sprint start snapshot)
  const scopeScore = totalPoints > 0
    ? Math.max(0, Math.round(100 * (1 - (todoCount / issues.length) * 0.5)))
    : 75;

  // 4. Weighted composite score
  const healthScore = Math.round(
    velocityScore * HEALTH_SCORE_WEIGHTS.VELOCITY_TREND +
    blockerScore * HEALTH_SCORE_WEIGHTS.BLOCKER_COUNT +
    scopeScore * HEALTH_SCORE_WEIGHTS.SCOPE_CHANGE +
    timelineScore * HEALTH_SCORE_WEIGHTS.TIMELINE
  );

  const level = getHealthLevel(healthScore);

  // 5. Build insights
  const insights = [];
  if (timelineScore < 50) insights.push("Work pace is behind schedule — consider reducing sprint scope or re-prioritizing.");
  if (blockerCount > 0) insights.push(`${blockerCount} issue(s) are blocked or stale — review and unblock in standup.`);
  if (velocityScore < 50) insights.push("Velocity is lower than expected — check for impediments or capacity issues.");
  if (todoCount > doneCount && startDate && endDate) {
    const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
    const elapsed = (now - startDate) / (1000 * 60 * 60 * 24);
    if (elapsed / totalDays > 0.5) insights.push("More than half the sprint is over but most issues haven't started.");
  }
  if (!insights.length) insights.push("Sprint is on track. Keep up the momentum!");

  return JSON.stringify({
    success: true,
    platform: "jira",
    sprintName: activeSprint.name,
    healthScore,
    healthLevel: level.label,
    healthEmoji: level.emoji,
    breakdown: {
      velocityScore: { score: velocityScore, weight: `${HEALTH_SCORE_WEIGHTS.VELOCITY_TREND * 100}%` },
      blockerScore: { score: blockerScore, weight: `${HEALTH_SCORE_WEIGHTS.BLOCKER_COUNT * 100}%`, blockerCount },
      scopeScore: { score: scopeScore, weight: `${HEALTH_SCORE_WEIGHTS.SCOPE_CHANGE * 100}%` },
      timelineScore: { score: timelineScore, weight: `${HEALTH_SCORE_WEIGHTS.TIMELINE * 100}%` },
    },
    sprintStats: {
      totalPoints,
      donePoints,
      completionPercent: totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0,
      totalIssues: issues.length,
      doneCount,
      inProgressCount,
      todoCount,
      blockerCount,
    },
    insights,
  });
};

// ─── Exports ──────────────────────────────────────────────────────────

module.exports = {
  createSprintVelocityTool,
  createBurndownDataTool,
  createCycleTimeTool,
  createBlockerDetectionTool,
  createSprintHealthTool,
};

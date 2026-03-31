const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const {
  VELOCITY_DEFAULTS,
  BLOCKER_THRESHOLDS,
  STATUS_CATEGORIES,
  categorizeStatus,
  isBlockedStatus,
  extractStoryPoints,
  getHealthLevel,
} = require("../common/pmo-constants");
const { jiraFetch, resolveBoardId } = require("../utils/jiraApi");
const { githubFetch, parseOwnerRepo } = require("../utils/githubApi");

// ─── Helpers ──────────────────────────────────────────────────────────

const mdTable = (headers, rows) => {
  const header = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return [header, sep, body].join("\n");
};

const formatDate = (d) => (d ? new Date(d).toISOString().split("T")[0] : "N/A");

// ─── Tool 1: Scope Creep Detection ───────────────────────────────────

const createScopeCreepTool = (project) => {
  return tool(
    async ({ sprintId }) => {
      const platform = project.boardConfig?.platform || "github";

      try {
        if (platform === "jira") {
          return await detectJiraScopeCreep(project.boardConfig, sprintId);
        }
        return await detectGithubScopeCreep(project, sprintId);
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "detect_scope_creep",
      description:
        "Detect scope creep in the current or specified sprint. Compares issues added after sprint start vs original commitment. Shows added/removed counts, point impact, and lists late additions. Use when PM asks about 'scope creep', 'sprint changes', 'what was added', 'scope growth', or 'commitment vs actual'.",
      schema: z.object({
        sprintId: z
          .string()
          .optional()
          .describe("Jira sprint ID or GitHub milestone number. Omit for active sprint."),
      }),
    }
  );
};

const detectJiraScopeCreep = async (boardConfig, sprintId) => {
  const boardId = await resolveBoardId(boardConfig);

  // Get target sprint
  let sprint;
  if (sprintId) {
    sprint = await jiraFetch(boardConfig, `/rest/agile/1.0/sprint/${sprintId}`);
  } else {
    const active = await jiraFetch(boardConfig, `/rest/agile/1.0/board/${boardId}/sprint?state=active`);
    sprint = active.values?.[0];
  }

  if (!sprint) {
    return JSON.stringify({ success: true, report: "No active sprint found.", scopeCreep: false });
  }

  const sprintStartDate = sprint.startDate ? new Date(sprint.startDate) : null;
  if (!sprintStartDate) {
    return JSON.stringify({ success: true, report: "Sprint has no start date — cannot determine scope creep.", scopeCreep: false });
  }

  // Get all issues in the sprint
  const issuesData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=200&fields=summary,status,assignee,issuetype,created,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
  );
  const issues = issuesData.issues || [];

  const original = [];
  const addedAfterStart = [];

  for (const issue of issues) {
    const createdDate = new Date(issue.fields?.created);
    const points = extractStoryPoints(issue.fields) || 0;
    const entry = {
      key: issue.key,
      summary: (issue.fields?.summary || "").slice(0, 60),
      type: issue.fields?.issuetype?.name || "Unknown",
      status: issue.fields?.status?.name || "",
      assignee: issue.fields?.assignee?.displayName || "Unassigned",
      points,
      created: formatDate(createdDate),
    };

    // Issue created after sprint started = added mid-sprint
    if (createdDate > sprintStartDate) {
      addedAfterStart.push(entry);
    } else {
      original.push(entry);
    }
  }

  const originalPoints = original.reduce((sum, i) => sum + i.points, 0);
  const addedPoints = addedAfterStart.reduce((sum, i) => sum + i.points, 0);
  const creepPercentage = originalPoints > 0 ? Math.round((addedPoints / originalPoints) * 100) : 0;

  // Build report
  const sections = [];
  sections.push(`# 📐 Scope Creep Analysis: ${sprint.name}`);
  sections.push(`**Sprint Start:** ${formatDate(sprintStartDate)} | **Original Issues:** ${original.length} | **Added Mid-Sprint:** ${addedAfterStart.length}\n`);

  sections.push(mdTable(
    ["Metric", "Value"],
    [
      ["Original Commitment", `${original.length} issues (${originalPoints} pts)`],
      ["Added After Start", `${addedAfterStart.length} issues (${addedPoints} pts)`],
      ["Scope Growth", `${creepPercentage}%`],
      ["Current Total", `${issues.length} issues (${originalPoints + addedPoints} pts)`],
    ]
  ));
  sections.push("");

  if (addedAfterStart.length > 0) {
    sections.push("## 🆕 Issues Added Mid-Sprint");
    sections.push(mdTable(
      ["Issue", "Type", "Summary", "Points", "Added On"],
      addedAfterStart.map((i) => [i.key, i.type, i.summary, String(i.points), i.created])
    ));
    sections.push("");
  }

  // Risk assessment
  let riskLevel = "Low";
  if (creepPercentage > 30) riskLevel = "High";
  else if (creepPercentage > 15) riskLevel = "Medium";

  sections.push(`## ${riskLevel === "High" ? "🔴" : riskLevel === "Medium" ? "🟡" : "🟢"} Risk Level: ${riskLevel}`);
  if (riskLevel === "High") {
    sections.push(`Scope has grown by ${creepPercentage}% since sprint start. This significantly impacts delivery predictability. Consider removing lower priority items or carrying them to next sprint.`);
  } else if (riskLevel === "Medium") {
    sections.push(`Scope has grown by ${creepPercentage}%. Monitor closely and avoid adding more items.`);
  } else {
    sections.push(`Scope is stable. ${addedAfterStart.length > 0 ? `Only ${addedAfterStart.length} item(s) added post-start.` : "No items added after sprint start."}`);
  }

  return JSON.stringify({
    success: true,
    report: sections.join("\n"),
    stats: {
      originalIssues: original.length,
      originalPoints,
      addedIssues: addedAfterStart.length,
      addedPoints,
      creepPercentage,
      riskLevel,
    },
  });
};

const detectGithubScopeCreep = async (project, milestoneNumber) => {
  const repoInfo = parseOwnerRepo(project.repolink || project.repositories?.[0]?.repolink);
  if (!repoInfo) {
    return JSON.stringify({ success: false, error: "No GitHub repository configured." });
  }
  const { owner, repo } = repoInfo;

  // Get milestone
  let milestone;
  if (milestoneNumber) {
    milestone = await githubFetch(project.pat_token, `/repos/${owner}/${repo}/milestones/${milestoneNumber}`);
  } else {
    const open = await githubFetch(project.pat_token, `/repos/${owner}/${repo}/milestones?state=open&sort=due_on&direction=asc&per_page=1`);
    milestone = open[0];
  }

  if (!milestone) {
    return JSON.stringify({ success: true, report: "No milestone found.", scopeCreep: false });
  }

  const msCreatedDate = new Date(milestone.created_at);

  // Get all issues in milestone
  const allIssues = await githubFetch(
    project.pat_token,
    `/repos/${owner}/${repo}/issues?milestone=${milestone.number}&state=all&per_page=100`
  );
  const issues = allIssues.filter((i) => !i.pull_request);

  // Issues created well after milestone creation = scope creep
  const gracePeriodMs = 24 * 60 * 60 * 1000; // 1 day grace
  const addedLate = issues.filter((i) => new Date(i.created_at) > new Date(msCreatedDate.getTime() + gracePeriodMs));
  const original = issues.filter((i) => new Date(i.created_at) <= new Date(msCreatedDate.getTime() + gracePeriodMs));

  const creepPercentage = original.length > 0 ? Math.round((addedLate.length / original.length) * 100) : 0;
  let riskLevel = creepPercentage > 30 ? "High" : creepPercentage > 15 ? "Medium" : "Low";

  const sections = [];
  sections.push(`# 📐 Scope Creep Analysis: ${milestone.title}`);
  sections.push(mdTable(
    ["Metric", "Value"],
    [
      ["Original Issues", String(original.length)],
      ["Added Late", String(addedLate.length)],
      ["Scope Growth", `${creepPercentage}%`],
      ["Risk Level", riskLevel],
    ]
  ));

  if (addedLate.length > 0) {
    sections.push("\n## 🆕 Late Additions");
    sections.push(mdTable(
      ["Issue", "Summary", "Added On"],
      addedLate.slice(0, 15).map((i) => [`#${i.number}`, (i.title || "").slice(0, 50), formatDate(i.created_at)])
    ));
  }

  return JSON.stringify({
    success: true,
    report: sections.join("\n"),
    stats: { originalIssues: original.length, addedIssues: addedLate.length, creepPercentage, riskLevel },
    note: "GitHub milestones do not support story points. Stats are issue-count based.",
  });
};

// ─── Tool 2: Sprint Completion Prediction ─────────────────────────────

const createSprintPredictionTool = (project) => {
  return tool(
    async ({}) => {
      const platform = project.boardConfig?.platform || "github";

      try {
        if (platform === "jira") {
          return await predictJiraSprintCompletion(project.boardConfig);
        }
        return await predictGithubSprintCompletion(project);
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "predict_sprint_completion",
      description:
        "Predict whether the current sprint will finish on time. Uses historical velocity, remaining work, and days left to forecast completion probability. Use when PM asks 'will we finish on time', 'sprint forecast', 'can we deliver', 'completion prediction', or 'are we going to make it'.",
      schema: z.object({}),
    }
  );
};

const predictJiraSprintCompletion = async (boardConfig) => {
  const boardId = await resolveBoardId(boardConfig);

  // Get active sprint
  const activeData = await jiraFetch(boardConfig, `/rest/agile/1.0/board/${boardId}/sprint?state=active`);
  const sprint = activeData.values?.[0];
  if (!sprint) {
    return JSON.stringify({ success: true, report: "No active sprint found." });
  }

  // Get sprint issues
  const issuesData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=200&fields=summary,status,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
  );
  const issues = issuesData.issues || [];

  let totalPoints = 0, donePoints = 0, inProgressPoints = 0, todoPoints = 0;
  for (const issue of issues) {
    const pts = extractStoryPoints(issue.fields) || 0;
    const cat = categorizeStatus(issue.fields?.status?.name);
    totalPoints += pts;
    if (cat === "DONE") donePoints += pts;
    else if (cat === "IN_PROGRESS") inProgressPoints += pts;
    else todoPoints += pts;
  }

  const remainingPoints = totalPoints - donePoints;

  // Calculate time factors
  const now = new Date();
  const startDate = sprint.startDate ? new Date(sprint.startDate) : now;
  const endDate = sprint.endDate ? new Date(sprint.endDate) : null;

  const elapsedDays = Math.max(1, (now - startDate) / (1000 * 60 * 60 * 24));
  const totalDays = endDate ? Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24)) : 14;
  const daysRemaining = endDate ? Math.max(0, (endDate - now) / (1000 * 60 * 60 * 24)) : totalDays - elapsedDays;

  // Current velocity within this sprint
  const currentDailyRate = donePoints / elapsedDays;

  // Get historical velocity from last 3 closed sprints
  let historicalDailyRate = 0;
  try {
    const closedSprints = await jiraFetch(boardConfig, `/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=3`);
    const closedVelocities = [];

    for (const cs of (closedSprints.values || []).slice(0, 3)) {
      const csIssues = await jiraFetch(
        boardConfig,
        `/rest/agile/1.0/sprint/${cs.id}/issue?maxResults=200&fields=status,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
      );
      let csDone = 0;
      for (const issue of csIssues.issues || []) {
        if (categorizeStatus(issue.fields?.status?.name) === "DONE") {
          csDone += extractStoryPoints(issue.fields) || 0;
        }
      }
      const csDays = cs.startDate && cs.endDate
        ? Math.max(1, (new Date(cs.endDate) - new Date(cs.startDate)) / (1000 * 60 * 60 * 24))
        : 14;
      closedVelocities.push(csDone / csDays);
    }

    if (closedVelocities.length) {
      historicalDailyRate = closedVelocities.reduce((a, b) => a + b, 0) / closedVelocities.length;
    }
  } catch (_) {
    // Historical data unavailable — use current rate only
  }

  // Weighted prediction: 60% current sprint rate + 40% historical
  const predictedDailyRate = historicalDailyRate > 0
    ? currentDailyRate * 0.6 + historicalDailyRate * 0.4
    : currentDailyRate;

  const predictedCompletion = predictedDailyRate > 0
    ? Math.round(remainingPoints / predictedDailyRate * 10) / 10
    : Infinity;

  // Completion probability
  let probability;
  if (remainingPoints === 0) {
    probability = 100;
  } else if (predictedDailyRate <= 0) {
    probability = 0;
  } else {
    const ratio = daysRemaining / predictedCompletion;
    probability = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  }

  let forecast;
  if (probability >= 85) forecast = { label: "On Track", emoji: "🟢" };
  else if (probability >= 60) forecast = { label: "At Risk", emoji: "🟡" };
  else forecast = { label: "Off Track", emoji: "🔴" };

  // Build report
  const sections = [];
  sections.push(`# 🔮 Sprint Completion Forecast: ${sprint.name}`);
  sections.push(`**Prediction:** ${forecast.emoji} ${forecast.label} (${probability}% confidence)\n`);

  sections.push(mdTable(
    ["Metric", "Value"],
    [
      ["Total Committed", `${totalPoints} pts`],
      ["Completed", `${donePoints} pts`],
      ["In Progress", `${inProgressPoints} pts`],
      ["Remaining", `${remainingPoints} pts`],
      ["Days Elapsed", `${Math.round(elapsedDays * 10) / 10}`],
      ["Days Remaining", `${Math.round(daysRemaining * 10) / 10}`],
      ["Current Daily Rate", `${Math.round(currentDailyRate * 10) / 10} pts/day`],
      ["Historical Daily Rate", historicalDailyRate > 0 ? `${Math.round(historicalDailyRate * 10) / 10} pts/day` : "N/A"],
      ["Predicted Days to Complete", predictedCompletion === Infinity ? "∞" : `${predictedCompletion} days`],
    ]
  ));
  sections.push("");

  // Recommendations
  sections.push("## 💡 Recommendations");
  if (probability >= 85) {
    sections.push("- Team is on track to complete the sprint. Maintain current pace.");
    if (todoPoints === 0 && inProgressPoints <= donePoints * 0.2) {
      sections.push("- Consider pulling in stretch goals if backlog is available.");
    }
  } else if (probability >= 60) {
    sections.push("- Sprint is at risk. Consider the following:");
    sections.push(`  - ${remainingPoints} points remain with ${Math.round(daysRemaining)} days left.`);
    sections.push("  - Prioritize in-progress items to completion before starting new work.");
    sections.push("  - Review if any remaining items can be deferred to next sprint.");
  } else {
    sections.push("- Sprint is unlikely to complete on time. Immediate actions needed:");
    sections.push(`  - ${remainingPoints} points remain but only ${Math.round(daysRemaining)} days left.`);
    sections.push("  - Discuss scope reduction with stakeholders.");
    sections.push("  - Move lower-priority items back to backlog.");
    sections.push("  - Check for blockers preventing progress.");
  }

  return JSON.stringify({
    success: true,
    report: sections.join("\n"),
    stats: {
      totalPoints, donePoints, remainingPoints,
      daysRemaining: Math.round(daysRemaining * 10) / 10,
      currentDailyRate: Math.round(currentDailyRate * 10) / 10,
      predictedDailyRate: Math.round(predictedDailyRate * 10) / 10,
      predictedDaysToComplete: predictedCompletion,
      completionProbability: probability,
      forecast: forecast.label,
    },
  });
};

const predictGithubSprintCompletion = async (project) => {
  const repoInfo = parseOwnerRepo(project.repolink || project.repositories?.[0]?.repolink);
  if (!repoInfo) {
    return JSON.stringify({ success: false, error: "No GitHub repository configured." });
  }
  const { owner, repo } = repoInfo;

  const milestones = await githubFetch(project.pat_token, `/repos/${owner}/${repo}/milestones?state=open&sort=due_on&direction=asc&per_page=1`);
  const ms = milestones[0];
  if (!ms) {
    return JSON.stringify({ success: true, report: "No open milestone found." });
  }

  const total = ms.open_issues + ms.closed_issues;
  const closedRate = total > 0 ? ms.closed_issues / total : 0;

  const now = new Date();
  const created = new Date(ms.created_at);
  const dueDate = ms.due_on ? new Date(ms.due_on) : null;

  const elapsedDays = Math.max(1, (now - created) / (1000 * 60 * 60 * 24));
  const dailyCloseRate = ms.closed_issues / elapsedDays;
  const daysRemaining = dueDate ? Math.max(0, (dueDate - now) / (1000 * 60 * 60 * 24)) : 14;
  const predictedDays = dailyCloseRate > 0 ? Math.round(ms.open_issues / dailyCloseRate * 10) / 10 : Infinity;

  let probability = dailyCloseRate > 0 ? Math.min(100, Math.max(0, Math.round((daysRemaining / predictedDays) * 100))) : 0;
  if (ms.open_issues === 0) probability = 100;

  let forecast;
  if (probability >= 85) forecast = { label: "On Track", emoji: "🟢" };
  else if (probability >= 60) forecast = { label: "At Risk", emoji: "🟡" };
  else forecast = { label: "Off Track", emoji: "🔴" };

  const sections = [];
  sections.push(`# 🔮 Milestone Forecast: ${ms.title}`);
  sections.push(`**Prediction:** ${forecast.emoji} ${forecast.label} (${probability}% confidence)\n`);
  sections.push(mdTable(
    ["Metric", "Value"],
    [
      ["Total Issues", String(total)],
      ["Closed", String(ms.closed_issues)],
      ["Open", String(ms.open_issues)],
      ["Daily Close Rate", `${Math.round(dailyCloseRate * 10) / 10} issues/day`],
      ["Days Remaining", dueDate ? String(Math.round(daysRemaining)) : "No due date"],
      ["Predicted Days to Close All", predictedDays === Infinity ? "∞" : `${predictedDays}`],
    ]
  ));

  return JSON.stringify({
    success: true,
    report: sections.join("\n"),
    stats: { total, closed: ms.closed_issues, open: ms.open_issues, probability, forecast: forecast.label },
    note: "GitHub milestones do not support story points. Prediction is issue-count based.",
  });
};

// ─── Tool 3: Dependency Risk Detection ────────────────────────────────

const createDependencyRiskTool = (project) => {
  return tool(
    async ({}) => {
      const platform = project.boardConfig?.platform || "github";

      try {
        if (platform === "jira") {
          return await detectJiraDependencyRisks(project.boardConfig);
        }
        return await detectGithubDependencyRisks(project);
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "identify_dependency_risks",
      description:
        "Identify dependency risks in the active sprint. Finds blocked issues with linked dependencies, cross-epic dependencies, and unresolved blockers that threaten timelines. Use when PM asks about 'dependencies', 'dependency risks', 'what's blocking what', 'linked issues', or 'cross-team risks'.",
      schema: z.object({}),
    }
  );
};

const detectJiraDependencyRisks = async (boardConfig) => {
  const boardId = await resolveBoardId(boardConfig);

  // Get active sprint issues
  const activeData = await jiraFetch(boardConfig, `/rest/agile/1.0/board/${boardId}/sprint?state=active`);
  const sprint = activeData.values?.[0];
  if (!sprint) {
    return JSON.stringify({ success: true, report: "No active sprint found.", risks: [] });
  }

  const issuesData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=200&fields=summary,status,assignee,issuetype,issuelinks,priority,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
  );
  const issues = issuesData.issues || [];

  const risks = [];
  const blockedChains = [];

  for (const issue of issues) {
    const fields = issue.fields || {};
    const statusName = fields.status?.name || "";
    const cat = categorizeStatus(statusName);
    const links = fields.issuelinks || [];
    const points = extractStoryPoints(fields) || 0;

    for (const link of links) {
      const linkType = link.type?.name || "";
      const direction = link.outwardIssue ? "outward" : "inward";
      const linkedIssue = link.outwardIssue || link.inwardIssue;

      if (!linkedIssue) continue;

      const linkedStatus = linkedIssue.fields?.status?.name || "";
      const linkedCat = categorizeStatus(linkedStatus);

      // Risk: current issue is blocked by a linked issue that isn't done
      const isBlockedRelation = linkType.toLowerCase().includes("block") || linkType.toLowerCase().includes("depend");
      const inwardBlocking = direction === "inward" && isBlockedRelation && linkedCat !== "DONE";
      const outwardBlocked = direction === "outward" && isBlockedRelation && cat !== "DONE";

      if (inwardBlocking) {
        risks.push({
          issue: issue.key,
          summary: (fields.summary || "").slice(0, 50),
          status: statusName,
          points,
          blockedBy: linkedIssue.key,
          blockedByStatus: linkedStatus,
          linkType,
          severity: points >= 3 ? "High" : "Medium",
          reason: `Blocked by ${linkedIssue.key} (${linkedStatus})`,
        });
      }

      if (outwardBlocked && linkedCat !== "DONE") {
        blockedChains.push({
          blocker: issue.key,
          blockerStatus: statusName,
          blocks: linkedIssue.key,
          blocksStatus: linkedStatus,
          linkType,
        });
      }
    }

    // Also flag issues that are blocked by status but have no explicit link
    if (isBlockedStatus(statusName) && cat !== "DONE") {
      const alreadyTracked = risks.some((r) => r.issue === issue.key);
      if (!alreadyTracked) {
        risks.push({
          issue: issue.key,
          summary: (fields.summary || "").slice(0, 50),
          status: statusName,
          points,
          blockedBy: "—",
          blockedByStatus: "—",
          linkType: "Status",
          severity: points >= 3 ? "High" : "Medium",
          reason: `Status indicates blocked (${statusName})`,
        });
      }
    }
  }

  // Build report
  const sections = [];
  sections.push(`# 🔗 Dependency Risk Analysis: ${sprint.name}`);
  sections.push(`**Issues Analyzed:** ${issues.length} | **Risks Found:** ${risks.length} | **Dependency Chains:** ${blockedChains.length}\n`);

  if (risks.length === 0 && blockedChains.length === 0) {
    sections.push("## ✅ No Dependency Risks Detected\nAll sprint issues are progressing without dependency blockers.");
  } else {
    if (risks.length > 0) {
      const highRisks = risks.filter((r) => r.severity === "High");
      const medRisks = risks.filter((r) => r.severity === "Medium");

      sections.push(`## 🚨 Blocked Issues (${risks.length})`);
      if (highRisks.length > 0) {
        sections.push(`### 🔴 High Severity (${highRisks.length})`);
        sections.push(mdTable(
          ["Issue", "Summary", "Points", "Blocked By", "Blocker Status"],
          highRisks.map((r) => [r.issue, r.summary, String(r.points), r.blockedBy, r.blockedByStatus])
        ));
        sections.push("");
      }
      if (medRisks.length > 0) {
        sections.push(`### 🟡 Medium Severity (${medRisks.length})`);
        sections.push(mdTable(
          ["Issue", "Summary", "Points", "Blocked By", "Blocker Status"],
          medRisks.map((r) => [r.issue, r.summary, String(r.points), r.blockedBy, r.blockedByStatus])
        ));
        sections.push("");
      }

      const totalBlockedPoints = risks.reduce((sum, r) => sum + r.points, 0);
      sections.push(`**Total Points at Risk:** ${totalBlockedPoints} pts\n`);
    }

    if (blockedChains.length > 0) {
      sections.push(`## ⛓️ Dependency Chains (${blockedChains.length})`);
      sections.push(mdTable(
        ["Blocker", "Blocker Status", "Blocks", "Blocked Status", "Relationship"],
        blockedChains.map((c) => [c.blocker, c.blockerStatus, c.blocks, c.blocksStatus, c.linkType])
      ));
      sections.push("");
    }

    sections.push("## 💡 Recommendations");
    sections.push("- Review blockers in the next standup and assign owners for resolution.");
    if (risks.some((r) => r.severity === "High")) {
      sections.push("- High-severity blockers should be escalated immediately.");
    }
    sections.push("- Consider re-ordering sprint work to unblock dependent items first.");
  }

  return JSON.stringify({
    success: true,
    report: sections.join("\n"),
    stats: {
      totalIssues: issues.length,
      risksFound: risks.length,
      highSeverity: risks.filter((r) => r.severity === "High").length,
      mediumSeverity: risks.filter((r) => r.severity === "Medium").length,
      dependencyChains: blockedChains.length,
      totalPointsAtRisk: risks.reduce((sum, r) => sum + r.points, 0),
    },
  });
};

const detectGithubDependencyRisks = async (project) => {
  const repoInfo = parseOwnerRepo(project.repolink || project.repositories?.[0]?.repolink);
  if (!repoInfo) {
    return JSON.stringify({ success: false, error: "No GitHub repository configured." });
  }
  const { owner, repo } = repoInfo;

  // Get open issues, look for "blocked" labels or cross-references
  const openIssues = await githubFetch(
    project.pat_token,
    `/repos/${owner}/${repo}/issues?state=open&per_page=100&sort=updated&direction=desc`
  );
  const issues = openIssues.filter((i) => !i.pull_request);

  const risks = [];
  const blockedLabel = ["blocked", "blocker", "waiting", "on hold", "dependency"];

  for (const issue of issues) {
    const labels = (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name || "").toLowerCase());
    const isBlocked = labels.some((l) => blockedLabel.some((bl) => l.includes(bl)));

    if (isBlocked) {
      risks.push({
        number: issue.number,
        title: (issue.title || "").slice(0, 50),
        assignee: issue.assignee?.login || "Unassigned",
        labels: labels.join(", "),
        updated: formatDate(issue.updated_at),
      });
    }
  }

  const sections = [];
  sections.push(`# 🔗 Dependency Risk Analysis`);
  sections.push(`**Open Issues Scanned:** ${issues.length} | **Blocked/Dependency Issues:** ${risks.length}\n`);

  if (risks.length === 0) {
    sections.push("## ✅ No Dependency Risks Detected");
  } else {
    sections.push("## 🚨 Issues with Blocked/Dependency Labels");
    sections.push(mdTable(
      ["Issue", "Title", "Assignee", "Labels", "Last Updated"],
      risks.map((r) => [`#${r.number}`, r.title, r.assignee, r.labels, r.updated])
    ));
  }

  return JSON.stringify({
    success: true,
    report: sections.join("\n"),
    stats: { totalScanned: issues.length, risksFound: risks.length },
    note: "GitHub dependency detection is based on labels. For more accurate tracking, use issue links in Jira.",
  });
};

module.exports = {
  createScopeCreepTool,
  createSprintPredictionTool,
  createDependencyRiskTool,
};

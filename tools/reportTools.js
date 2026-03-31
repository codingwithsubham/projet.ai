const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const activityLogService = require("../services/activityLog.service");
const { jiraFetch, resolveBoardId } = require("../utils/jiraApi");
const { githubFetch, parseOwnerRepo } = require("../utils/githubApi");
const {
  REPORT_DEFAULTS,
  VELOCITY_DEFAULTS,
  BLOCKER_THRESHOLDS,
  categorizeStatus,
  isBlockedStatus,
  extractStoryPoints,
  getHealthLevel,
  HEALTH_SCORE_WEIGHTS,
} = require("../common/pmo-constants");

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Build a GFM markdown table from headers + rows.
 * Keeps reports self-contained without needing the Mermaid/table tools.
 */
const mdTable = (headers, rows) => {
  const header = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return [header, sep, body].join("\n");
};

const formatDate = (d) => (d ? new Date(d).toISOString().split("T")[0] : "N/A");

// ─── Jira sprint data fetchers (shared across reports) ────────────────

const getActiveSprintIssues = async (boardConfig) => {
  const boardId = await resolveBoardId(boardConfig);
  const sprintsData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/board/${boardId}/sprint?state=active`
  );
  const sprint = sprintsData.values?.[0];
  if (!sprint) return { sprint: null, issues: [] };

  const issuesData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=200&fields=summary,status,assignee,updated,priority,issuetype,resolutiondate,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
  );
  return { sprint, issues: issuesData.issues || [] };
};

const getRecentTransitions = async (boardConfig, hours) => {
  const projectKey = boardConfig.jira?.projectKey;
  if (!projectKey) return [];

  const since = new Date();
  since.setHours(since.getHours() - hours);
  const sinceStr = since.toISOString().split("T")[0];

  const jql = `project = "${projectKey}" AND updated >= "${sinceStr}" ORDER BY updated DESC`;

  // Try with changelog first, fallback without it
  try {
    const data = await jiraFetch(
      boardConfig,
      `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status,assignee,issuetype,updated&expand=changelog`
    );
    return data.issues || [];
  } catch (_) {
    // Fallback: fetch without changelog expansion
    try {
      const data = await jiraFetch(
        boardConfig,
        `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status,assignee,issuetype,updated`
      );
      return data.issues || [];
    } catch (err) {
      console.error("Failed to fetch recent Jira transitions:", err.message);
      return [];
    }
  }
};

// ─── Tool 1: Standup Digest ──────────────────────────────────────────

const createStandupDigestTool = (project) => {
  return tool(
    async ({ hours }) => {
      const projectId = String(project?._id || "").trim();
      if (!projectId) {
        return JSON.stringify({ success: false, error: "Project ID is required." });
      }

      const lookbackHours = hours || REPORT_DEFAULTS.STANDUP_HOURS;
      const platform = project.boardConfig?.platform || "github";

      try {
        // 1. Get team activity from activity logs
        const teamSummary = await activityLogService.getTeamActivitySummary(
          projectId,
          1 // 1 day
        );

        // 2. Get board-specific updates
        let boardUpdates = [];
        let blockers = [];

        if (platform === "jira") {
          // Section: Recent transitions (non-fatal if it fails)
          try {
            const recentIssues = await getRecentTransitions(project.boardConfig, lookbackHours);

            for (const issue of recentIssues) {
              const statusName = issue.fields?.status?.name || "";
              const assignee = issue.fields?.assignee?.displayName || "Unassigned";

              // Extract status change from changelog (may not be present in fallback mode)
              let previousStatus = null;
              const changelog = issue.changelog?.histories || [];
              for (const history of changelog) {
                const recentEnough = new Date(history.created) >= new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
                if (!recentEnough) continue;
                for (const item of history.items || []) {
                  if (item.field === "status") {
                    previousStatus = item.fromString;
                  }
                }
              }

              const update = {
                key: issue.key,
                summary: issue.fields?.summary || "",
                assignee,
                type: issue.fields?.issuetype?.name || "",
                currentStatus: statusName,
                previousStatus,
              };

              boardUpdates.push(update);

              // Flag blockers
              if (isBlockedStatus(statusName)) {
                blockers.push({ key: issue.key, summary: issue.fields?.summary, assignee, reason: "Blocked status" });
              }
            }
          } catch (err) {
            console.error("Standup: failed to fetch recent transitions:", err.message);
          }

          // Section: Stale issues in active sprint (non-fatal if it fails)
          try {
            const { sprint, issues: sprintIssues } = await getActiveSprintIssues(project.boardConfig);
            if (sprint) {
              const staleThreshold = new Date();
              staleThreshold.setDate(staleThreshold.getDate() - BLOCKER_THRESHOLDS.STALE_DAYS);

              for (const issue of sprintIssues) {
                const cat = categorizeStatus(issue.fields?.status?.name);
                const updatedAt = issue.fields?.updated ? new Date(issue.fields.updated) : null;
                if (cat !== "DONE" && updatedAt && updatedAt < staleThreshold) {
                  const already = blockers.find((b) => b.key === issue.key);
                  if (!already) {
                    blockers.push({
                      key: issue.key,
                      summary: issue.fields?.summary,
                      assignee: issue.fields?.assignee?.displayName || "Unassigned",
                      reason: `No update for ${Math.ceil((Date.now() - updatedAt) / (1000 * 60 * 60 * 24))} days`,
                    });
                  }
                }
              }
            }
          } catch (err) {
            console.error("Standup: failed to fetch active sprint issues:", err.message);
          }
        } else if (platform === "github") {
          const repoInfo = parseOwnerRepo(project.repolink || project.repositories?.[0]?.repolink);
          if (repoInfo) {
            const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
            const recentIssues = await githubFetch(
              project.pat_token,
              `/repos/${repoInfo.owner}/${repoInfo.repo}/issues?state=all&since=${since}&per_page=50&sort=updated&direction=desc`
            );
            for (const issue of recentIssues.filter((i) => !i.pull_request)) {
              boardUpdates.push({
                number: issue.number,
                summary: issue.title,
                assignee: issue.assignee?.login || "Unassigned",
                currentStatus: issue.state,
                labels: (issue.labels || []).map((l) => l.name),
              });
            }
          }
        }

        // 3. Build the report
        const sections = [];
        sections.push(`# 📋 Daily Standup Digest`);
        sections.push(`**Project:** ${project.name || "Untitled"} | **Date:** ${formatDate(new Date())} | **Period:** Last ${lookbackHours}h\n`);

        // Team activity section
        if (teamSummary.teamMembers?.length) {
          sections.push("## 👥 Team Activity");
          const teamRows = teamSummary.teamMembers.map((m) => [
            m.userName || "Unknown",
            String(m.totalActivities),
            (m.topics || []).filter(Boolean).slice(0, 3).join(", ") || "—",
            formatDate(m.lastActivity),
          ]);
          sections.push(mdTable(["Member", "Interactions", "Key Topics", "Last Active"], teamRows));
          sections.push("");
        }

        // Board updates section
        if (boardUpdates.length) {
          sections.push("## 📊 Board Updates");
          if (platform === "jira") {
            const transitioned = boardUpdates.filter((u) => u.previousStatus);
            if (transitioned.length) {
              const rows = transitioned.map((u) => [
                u.key,
                u.summary.slice(0, 50),
                u.assignee,
                `${u.previousStatus} → ${u.currentStatus}`,
              ]);
              sections.push(mdTable(["Issue", "Summary", "Assignee", "Status Change"], rows));
            } else {
              sections.push("No status transitions in the last " + lookbackHours + " hours.");
            }
          } else {
            const rows = boardUpdates.slice(0, 15).map((u) => [
              `#${u.number}`,
              u.summary.slice(0, 50),
              u.assignee,
              u.currentStatus,
            ]);
            sections.push(mdTable(["Issue", "Summary", "Assignee", "Status"], rows));
          }
          sections.push("");
        }

        // Blockers section
        if (blockers.length) {
          sections.push("## 🚨 Blockers & Risks");
          const blockerRows = blockers.map((b) => [
            b.key || `#${b.number || "?"}`,
            (b.summary || "").slice(0, 50),
            b.assignee,
            b.reason,
          ]);
          sections.push(mdTable(["Issue", "Summary", "Owner", "Reason"], blockerRows));
          sections.push("");
        } else {
          sections.push("## ✅ No Blockers Detected\n");
        }

        return JSON.stringify({
          success: true,
          report: sections.join("\n"),
          stats: {
            teamMembersActive: teamSummary.teamMembers?.length || 0,
            boardUpdates: boardUpdates.length,
            blockers: blockers.length,
          },
        });
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "generate_standup_digest",
      description:
        "Generate a daily standup digest report. Pulls team activity from the last 24 hours, recent board transitions (Jira/GitHub), and flags blockers. Returns a ready-to-share markdown report. Use when the PM asks for 'standup', 'daily update', 'morning briefing', or 'what did the team do yesterday'.",
      schema: z.object({
        hours: z
          .number()
          .optional()
          .default(REPORT_DEFAULTS.STANDUP_HOURS)
          .describe(`Look-back period in hours (default: ${REPORT_DEFAULTS.STANDUP_HOURS})`),
      }),
    }
  );
};

// ─── Tool 2: Sprint Review Report ────────────────────────────────────

const createSprintReviewReportTool = (project) => {
  return tool(
    async ({ sprintId }) => {
      const platform = project.boardConfig?.platform || "github";

      try {
        if (platform === "jira") {
          return await buildJiraSprintReview(project, sprintId);
        }
        return await buildGithubSprintReview(project, sprintId);
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "generate_sprint_review",
      description:
        "Generate a comprehensive sprint review report. Includes: sprint stats (committed vs completed points), velocity comparison with previous sprint, issue breakdown by status and type, blocker summary, and team contributions. Use when PM asks for 'sprint review', 'sprint summary', 'end of sprint report', or 'what did we deliver this sprint'.",
      schema: z.object({
        sprintId: z
          .string()
          .optional()
          .describe("Jira sprint ID or GitHub milestone number. Omit to use the active/most recent sprint."),
      }),
    }
  );
};

const buildJiraSprintReview = async (project, sprintId) => {
  const boardConfig = project.boardConfig;
  const boardId = await resolveBoardId(boardConfig);

  // Get target sprint (active or specified)
  let sprint;
  if (sprintId) {
    sprint = await jiraFetch(boardConfig, `/rest/agile/1.0/sprint/${sprintId}`);
  } else {
    // Try active first, then most recent closed
    const active = await jiraFetch(boardConfig, `/rest/agile/1.0/board/${boardId}/sprint?state=active`);
    sprint = active.values?.[0];
    if (!sprint) {
      const closed = await jiraFetch(boardConfig, `/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=1`);
      sprint = closed.values?.[0];
    }
  }

  if (!sprint) {
    return JSON.stringify({ success: true, report: "No sprint found to review." });
  }

  // Get sprint issues
  const issuesData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=200&fields=summary,status,assignee,issuetype,priority,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
  );
  const issues = issuesData.issues || [];

  // Compute stats
  let totalPoints = 0, donePoints = 0;
  let todoCount = 0, inProgressCount = 0, doneCount = 0;
  const byType = {};
  const byAssignee = {};
  const blockers = [];

  for (const issue of issues) {
    const fields = issue.fields || {};
    const points = extractStoryPoints(fields) || 0;
    const statusName = fields.status?.name || "";
    const cat = categorizeStatus(statusName);
    const type = fields.issuetype?.name || "Unknown";
    const assignee = fields.assignee?.displayName || "Unassigned";

    totalPoints += points;
    if (cat === "DONE") { donePoints += points; doneCount++; }
    else if (cat === "IN_PROGRESS") { inProgressCount++; }
    else { todoCount++; }

    // By type
    if (!byType[type]) byType[type] = { total: 0, done: 0, points: 0, donePoints: 0 };
    byType[type].total++;
    byType[type].points += points;
    if (cat === "DONE") { byType[type].done++; byType[type].donePoints += points; }

    // By assignee
    if (!byAssignee[assignee]) byAssignee[assignee] = { total: 0, done: 0, points: 0 };
    byAssignee[assignee].total++;
    if (cat === "DONE") { byAssignee[assignee].done++; byAssignee[assignee].points += points; }

    // Blockers
    if (cat !== "DONE" && isBlockedStatus(statusName)) {
      blockers.push({ key: issue.key, summary: fields.summary, assignee });
    }
  }

  const completionRate = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;

  // Get previous sprint for velocity comparison
  let previousVelocity = null;
  const closedSprints = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=5`
  );
  const prevSprints = (closedSprints.values || []).filter((s) => s.id !== sprint.id);
  if (prevSprints.length) {
    const prev = prevSprints[0];
    const prevIssues = await jiraFetch(
      boardConfig,
      `/rest/agile/1.0/sprint/${prev.id}/issue?maxResults=200&fields=status,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
    );
    let prevDone = 0;
    for (const issue of prevIssues.issues || []) {
      if (categorizeStatus(issue.fields?.status?.name) === "DONE") {
        prevDone += extractStoryPoints(issue.fields) || 0;
      }
    }
    previousVelocity = { sprintName: prev.name, points: prevDone };
  }

  // Build report
  const sections = [];
  sections.push(`# 🏁 Sprint Review: ${sprint.name}`);
  sections.push(`**State:** ${sprint.state} | **Start:** ${formatDate(sprint.startDate)} | **End:** ${formatDate(sprint.endDate)}\n`);

  // Summary stats
  sections.push("## 📊 Sprint Summary");
  sections.push(mdTable(
    ["Metric", "Value"],
    [
      ["Committed Points", String(totalPoints)],
      ["Completed Points", String(donePoints)],
      ["Completion Rate", `${completionRate}%`],
      ["Total Issues", String(issues.length)],
      ["Done", String(doneCount)],
      ["In Progress", String(inProgressCount)],
      ["To Do (Spillover)", String(todoCount)],
    ]
  ));
  sections.push("");

  // Velocity comparison
  if (previousVelocity) {
    const delta = donePoints - previousVelocity.points;
    const trend = delta > 0 ? "📈 Improving" : delta < 0 ? "📉 Declining" : "➡️ Stable";
    sections.push("## 🚀 Velocity Comparison");
    sections.push(mdTable(
      ["Sprint", "Points Completed", "Trend"],
      [
        [previousVelocity.sprintName, String(previousVelocity.points), ""],
        [sprint.name, String(donePoints), trend],
      ]
    ));
    sections.push("");
  }

  // By issue type
  sections.push("## 📋 By Issue Type");
  sections.push(mdTable(
    ["Type", "Total", "Done", "Points", "Done Points"],
    Object.entries(byType).map(([type, d]) => [
      type, String(d.total), String(d.done), String(d.points), String(d.donePoints),
    ])
  ));
  sections.push("");

  // By team member
  sections.push("## 👥 Team Contributions");
  sections.push(mdTable(
    ["Member", "Assigned", "Completed", "Points Delivered"],
    Object.entries(byAssignee)
      .sort((a, b) => b[1].points - a[1].points)
      .map(([name, d]) => [name, String(d.total), String(d.done), String(d.points)])
  ));
  sections.push("");

  // Blockers / spillover
  if (blockers.length) {
    sections.push("## 🚨 Blockers");
    sections.push(mdTable(
      ["Issue", "Summary", "Assignee"],
      blockers.map((b) => [b.key, (b.summary || "").slice(0, 50), b.assignee])
    ));
    sections.push("");
  }

  if (todoCount > 0 || inProgressCount > 0) {
    sections.push(`## ⚠️ Spillover: ${todoCount + inProgressCount} issue(s) not completed and may carry over to the next sprint.\n`);
  }

  return JSON.stringify({
    success: true,
    report: sections.join("\n"),
    stats: {
      totalPoints,
      donePoints,
      completionRate,
      totalIssues: issues.length,
      doneCount,
      inProgressCount,
      todoCount,
      blockerCount: blockers.length,
      previousVelocity: previousVelocity?.points || null,
    },
  });
};

const buildGithubSprintReview = async (project, milestoneNumber) => {
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
    if (!milestone) {
      const closed = await githubFetch(project.pat_token, `/repos/${owner}/${repo}/milestones?state=closed&sort=due_on&direction=desc&per_page=1`);
      milestone = closed[0];
    }
  }

  if (!milestone) {
    return JSON.stringify({ success: true, report: "No milestone found to review." });
  }

  const totalIssues = milestone.open_issues + milestone.closed_issues;
  const completionRate = totalIssues > 0 ? Math.round((milestone.closed_issues / totalIssues) * 100) : 0;

  // Get issue details
  const allIssues = await githubFetch(
    project.pat_token,
    `/repos/${owner}/${repo}/issues?milestone=${milestone.number}&state=all&per_page=100`
  );
  const issues = allIssues.filter((i) => !i.pull_request);

  // By assignee
  const byAssignee = {};
  for (const issue of issues) {
    const assignee = issue.assignee?.login || "Unassigned";
    if (!byAssignee[assignee]) byAssignee[assignee] = { total: 0, done: 0 };
    byAssignee[assignee].total++;
    if (issue.state === "closed") byAssignee[assignee].done++;
  }

  const sections = [];
  sections.push(`# 🏁 Sprint Review: ${milestone.title}`);
  sections.push(`**State:** ${milestone.state} | **Due:** ${formatDate(milestone.due_on)}\n`);

  sections.push("## 📊 Summary");
  sections.push(mdTable(
    ["Metric", "Value"],
    [
      ["Total Issues", String(totalIssues)],
      ["Closed", String(milestone.closed_issues)],
      ["Open (Spillover)", String(milestone.open_issues)],
      ["Completion Rate", `${completionRate}%`],
    ]
  ));
  sections.push("");

  sections.push("## 👥 Team Contributions");
  sections.push(mdTable(
    ["Member", "Assigned", "Completed"],
    Object.entries(byAssignee)
      .sort((a, b) => b[1].done - a[1].done)
      .map(([name, d]) => [name, String(d.total), String(d.done)])
  ));
  sections.push("");

  if (milestone.open_issues > 0) {
    sections.push(`## ⚠️ Spillover: ${milestone.open_issues} issue(s) still open.\n`);
  }

  return JSON.stringify({
    success: true,
    report: sections.join("\n"),
    stats: { totalIssues, closed: milestone.closed_issues, open: milestone.open_issues, completionRate },
    note: "GitHub milestones do not support story points. Stats are issue-count based.",
  });
};

// ─── Tool 3: Weekly Status Report ────────────────────────────────────

const createWeeklyStatusReportTool = (project) => {
  return tool(
    async ({ days }) => {
      const projectId = String(project?._id || "").trim();
      if (!projectId) {
        return JSON.stringify({ success: false, error: "Project ID is required." });
      }

      const lookbackDays = days || REPORT_DEFAULTS.WEEKLY_DAYS;
      const platform = project.boardConfig?.platform || "github";

      try {
        // 1. Team activity summary
        const teamSummary = await activityLogService.getTeamActivitySummary(projectId, lookbackDays);

        // 2. Sprint / board status
        let sprintSection = "";
        let accomplishments = [];
        let risks = [];

        if (platform === "jira") {
          try {
            const { sprint, issues } = await getActiveSprintIssues(project.boardConfig);

            if (sprint) {
              let totalPts = 0, donePts = 0;
              let todoC = 0, ipC = 0, doneC = 0;
              const staleThreshold = new Date();
              staleThreshold.setDate(staleThreshold.getDate() - BLOCKER_THRESHOLDS.STALE_DAYS);

              for (const issue of issues) {
                const pts = extractStoryPoints(issue.fields) || 0;
                const cat = categorizeStatus(issue.fields?.status?.name);
                totalPts += pts;
                if (cat === "DONE") { donePts += pts; doneC++; }
                else if (cat === "IN_PROGRESS") { ipC++; }
                else { todoC++; }

                // Completed items = accomplishments
                if (cat === "DONE") {
                  accomplishments.push(`${issue.key}: ${(issue.fields?.summary || "").slice(0, 60)}`);
                }

                // Blockers/stale = risks
                if (cat !== "DONE") {
                  const statusName = issue.fields?.status?.name || "";
                  const updatedAt = issue.fields?.updated ? new Date(issue.fields.updated) : null;
                  if (isBlockedStatus(statusName) || (updatedAt && updatedAt < staleThreshold)) {
                    risks.push(`${issue.key}: ${(issue.fields?.summary || "").slice(0, 60)} (${statusName})`);
                  }
                }
              }

              const rate = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;
              const startDate = sprint.startDate ? new Date(sprint.startDate) : null;
              const endDate = sprint.endDate ? new Date(sprint.endDate) : null;
              const now = new Date();
              const totalDays = startDate && endDate ? Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24)) : 0;
              const elapsed = startDate ? (now - startDate) / (1000 * 60 * 60 * 24) : 0;
              const daysRemaining = endDate ? Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))) : "?";

              // Health score
              const timeProgress = totalDays > 0 ? Math.min(1, elapsed / totalDays) : 0;
              const pointsProgress = totalPts > 0 ? donePts / totalPts : 0;
              const gap = timeProgress - pointsProgress;
              let healthScore = gap > 0.3 ? 30 : gap > 0.15 ? 60 : gap > 0 ? 80 : 95;
              if (risks.length > 2) healthScore = Math.min(healthScore, 50);
              const level = getHealthLevel(healthScore);

              sprintSection = [
                `## 🏃 Sprint: ${sprint.name}`,
                `**Health:** ${level.emoji} ${level.label} (${healthScore}/100) | **Days Remaining:** ${daysRemaining}\n`,
                mdTable(
                  ["Metric", "Value"],
                  [
                    ["Committed", `${totalPts} pts`],
                    ["Completed", `${donePts} pts (${rate}%)`],
                    ["Issues (Done / In Progress / To Do)", `${doneC} / ${ipC} / ${todoC}`],
                  ]
                ),
              ].join("\n");
            }
          } catch (err) {
            console.error("Weekly status: failed to fetch Jira sprint data:", err.message);
            sprintSection = "## 🏃 Sprint\n_Unable to fetch sprint data from Jira._\n";
          }
        } else if (platform === "github") {
          try {
            const repoInfo = parseOwnerRepo(project.repolink || project.repositories?.[0]?.repolink);
            if (repoInfo) {
              const milestones = await githubFetch(
                project.pat_token,
                `/repos/${repoInfo.owner}/${repoInfo.repo}/milestones?state=open&sort=due_on&direction=asc&per_page=1`
              );
              const ms = milestones[0];
              if (ms) {
                const total = ms.open_issues + ms.closed_issues;
                const rate = total > 0 ? Math.round((ms.closed_issues / total) * 100) : 0;
                sprintSection = [
                  `## 🏃 Milestone: ${ms.title}`,
                  mdTable(["Metric", "Value"], [
                    ["Total Issues", String(total)],
                    ["Closed", `${ms.closed_issues} (${rate}%)`],
                    ["Open", String(ms.open_issues)],
                  ]),
                ].join("\n");
              }
            }
          } catch (err) {
            console.error("Weekly status: failed to fetch GitHub milestone data:", err.message);
            sprintSection = "## 🏃 Milestone\n_Unable to fetch milestone data from GitHub._\n";
          }
        }

        // 3. Build report
        const sections = [];
        sections.push(`# 📊 Weekly Status Report`);
        sections.push(`**Project:** ${project.name || "Untitled"} | **Period:** Last ${lookbackDays} days | **Date:** ${formatDate(new Date())}\n`);

        if (sprintSection) {
          sections.push(sprintSection);
          sections.push("");
        }

        // Key accomplishments
        sections.push("## ✅ Key Accomplishments");
        if (accomplishments.length) {
          sections.push(accomplishments.slice(0, 10).map((a) => `- ${a}`).join("\n"));
        } else {
          sections.push("_No completed items tracked this period._");
        }
        sections.push("");

        // Risks & blockers
        sections.push("## ⚠️ Risks & Blockers");
        if (risks.length) {
          sections.push(risks.map((r) => `- 🔴 ${r}`).join("\n"));
        } else {
          sections.push("_No active blockers._");
        }
        sections.push("");

        // Team activity
        if (teamSummary.teamMembers?.length) {
          sections.push("## 👥 Team Activity");
          const rows = teamSummary.teamMembers.map((m) => [
            m.userName || "Unknown",
            String(m.totalActivities),
            (m.agents || []).join(", ") || "—",
            formatDate(m.lastActivity),
          ]);
          sections.push(mdTable(["Member", "Interactions", "Agents Used", "Last Active"], rows));
          sections.push("");
        }

        // Next week outlook
        sections.push("## 🔮 Next Week");
        sections.push("_AI-generated outlook based on current sprint state:_\n");
        if (risks.length > 2) {
          sections.push(`- ⚠️ ${risks.length} risks/blockers need immediate attention before next standup.`);
        }
        if (accomplishments.length > 5) {
          sections.push("- 👍 Strong delivery pace — team is on track.");
        }
        sections.push("- Review spillover items and re-prioritize for next sprint if needed.\n");

        return JSON.stringify({
          success: true,
          report: sections.join("\n"),
          stats: {
            teamMembers: teamSummary.teamMembers?.length || 0,
            totalInteractions: teamSummary.totalTeamActivities || 0,
            accomplishments: accomplishments.length,
            risks: risks.length,
          },
        });
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "generate_weekly_status",
      description:
        "Generate a weekly status report. Includes: sprint health with progress, key accomplishments (completed issues), risks and blockers, team activity summary, and next week outlook. Use when PM asks for 'weekly status', 'weekly report', 'status update for stakeholders', or 'project update'.",
      schema: z.object({
        days: z
          .number()
          .optional()
          .default(REPORT_DEFAULTS.WEEKLY_DAYS)
          .describe(`Look-back period in days (default: ${REPORT_DEFAULTS.WEEKLY_DAYS})`),
      }),
    }
  );
};

// ─── Exports ──────────────────────────────────────────────────────────

module.exports = {
  createStandupDigestTool,
  createSprintReviewReportTool,
  createWeeklyStatusReportTool,
};

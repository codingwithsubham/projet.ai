const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const {
  VELOCITY_DEFAULTS,
  BLOCKER_THRESHOLDS,
  STATUS_CATEGORIES,
  categorizeStatus,
  isBlockedStatus,
  extractStoryPoints,
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

// ─── Tool 1: Workload Distribution ────────────────────────────────────

const createWorkloadDistributionTool = (project) => {
  return tool(
    async ({}) => {
      const platform = project.boardConfig?.platform || "github";

      try {
        if (platform === "jira") {
          return await analyzeJiraWorkload(project.boardConfig);
        }
        return await analyzeGithubWorkload(project);
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "analyze_workload",
      description:
        "Analyze team workload distribution in the active sprint. Shows each member's assigned issues, story points, status breakdown, and flags overloaded or idle members. Use when PM asks about 'workload', 'team capacity', 'who is overloaded', 'resource allocation', 'work distribution', or 'team balance'.",
      schema: z.object({}),
    }
  );
};

const analyzeJiraWorkload = async (boardConfig) => {
  const boardId = await resolveBoardId(boardConfig);

  const activeData = await jiraFetch(boardConfig, `/rest/agile/1.0/board/${boardId}/sprint?state=active`);
  const sprint = activeData.values?.[0];
  if (!sprint) {
    return JSON.stringify({ success: true, report: "No active sprint found." });
  }

  const issuesData = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=200&fields=summary,status,assignee,issuetype,priority,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
  );
  const issues = issuesData.issues || [];

  // Aggregate by assignee
  const byAssignee = {};
  let unassignedCount = 0;
  let unassignedPoints = 0;

  for (const issue of issues) {
    const fields = issue.fields || {};
    const assignee = fields.assignee?.displayName || null;
    const points = extractStoryPoints(fields) || 0;
    const cat = categorizeStatus(fields.status?.name);

    if (!assignee) {
      unassignedCount++;
      unassignedPoints += points;
      continue;
    }

    if (!byAssignee[assignee]) {
      byAssignee[assignee] = {
        total: 0, points: 0,
        todo: 0, inProgress: 0, done: 0,
        todoPoints: 0, ipPoints: 0, donePoints: 0,
        blocked: 0,
        issues: [],
      };
    }

    const member = byAssignee[assignee];
    member.total++;
    member.points += points;

    if (cat === "DONE") { member.done++; member.donePoints += points; }
    else if (cat === "IN_PROGRESS") { member.inProgress++; member.ipPoints += points; }
    else { member.todo++; member.todoPoints += points; }

    if (isBlockedStatus(fields.status?.name)) member.blocked++;
  }

  const members = Object.entries(byAssignee)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.points - a.points);

  // Calculate averages for overload/idle detection
  const avgPoints = members.length > 0 ? members.reduce((s, m) => s + m.points, 0) / members.length : 0;
  const avgIssues = members.length > 0 ? members.reduce((s, m) => s + m.total, 0) / members.length : 0;

  const flags = [];
  for (const m of members) {
    if (m.points > avgPoints * 1.5 && m.points > 5) {
      flags.push({ name: m.name, flag: "🔴 Overloaded", reason: `${m.points} pts (avg: ${Math.round(avgPoints)})` });
    } else if (m.points < avgPoints * 0.5 && avgPoints > 3) {
      flags.push({ name: m.name, flag: "🟡 Underutilized", reason: `${m.points} pts (avg: ${Math.round(avgPoints)})` });
    }
    if (m.blocked > 0) {
      flags.push({ name: m.name, flag: "⚠️ Has Blockers", reason: `${m.blocked} blocked issue(s)` });
    }
    if (m.inProgress > 3) {
      flags.push({ name: m.name, flag: "🟡 Too Much WIP", reason: `${m.inProgress} items in progress (consider WIP limit)` });
    }
  }

  // Build report
  const sections = [];
  sections.push(`# 👥 Workload Distribution: ${sprint.name}`);
  sections.push(`**Team Size:** ${members.length} | **Total Issues:** ${issues.length} | **Total Points:** ${members.reduce((s, m) => s + m.points, 0) + unassignedPoints}\n`);

  sections.push("## 📊 Per-Member Breakdown");
  sections.push(mdTable(
    ["Member", "Issues", "Points", "Done", "In Progress", "To Do", "Completion %"],
    members.map((m) => [
      m.name,
      String(m.total),
      String(m.points),
      String(m.done),
      String(m.inProgress),
      String(m.todo),
      m.total > 0 ? `${Math.round((m.done / m.total) * 100)}%` : "—",
    ])
  ));
  sections.push("");

  if (unassignedCount > 0) {
    sections.push(`## ⚠️ Unassigned: ${unassignedCount} issues (${unassignedPoints} pts) — need assignment\n`);
  }

  if (flags.length > 0) {
    sections.push("## 🚩 Flags");
    sections.push(mdTable(
      ["Member", "Flag", "Details"],
      flags.map((f) => [f.name, f.flag, f.reason])
    ));
    sections.push("");
  }

  // Visualization-ready data
  const chartData = members.map((m) => ({ label: m.name.split(" ")[0], value: m.points }));

  return JSON.stringify({
    success: true,
    report: sections.join("\n"),
    chartReady: { type: "bar", title: "Points per Team Member", data: chartData },
    stats: {
      teamSize: members.length,
      totalIssues: issues.length,
      unassigned: unassignedCount,
      flags: flags.length,
      avgPointsPerMember: Math.round(avgPoints * 10) / 10,
    },
  });
};

const analyzeGithubWorkload = async (project) => {
  const repoInfo = parseOwnerRepo(project.repolink || project.repositories?.[0]?.repolink);
  if (!repoInfo) {
    return JSON.stringify({ success: false, error: "No GitHub repository configured." });
  }
  const { owner, repo } = repoInfo;

  // Get open issues
  const openIssues = await githubFetch(
    project.pat_token,
    `/repos/${owner}/${repo}/issues?state=open&per_page=100&sort=updated&direction=desc`
  );
  const issues = openIssues.filter((i) => !i.pull_request);

  const byAssignee = {};
  let unassigned = 0;

  for (const issue of issues) {
    const assignee = issue.assignee?.login;
    if (!assignee) { unassigned++; continue; }

    if (!byAssignee[assignee]) {
      byAssignee[assignee] = { total: 0, labels: new Set() };
    }
    byAssignee[assignee].total++;
    for (const label of (issue.labels || [])) {
      const name = typeof label === "string" ? label : label.name;
      if (name) byAssignee[assignee].labels.add(name);
    }
  }

  const members = Object.entries(byAssignee)
    .map(([name, data]) => ({ name, total: data.total, labels: [...data.labels].join(", ") }))
    .sort((a, b) => b.total - a.total);

  const avgIssues = members.length > 0 ? members.reduce((s, m) => s + m.total, 0) / members.length : 0;

  const sections = [];
  sections.push(`# 👥 Workload Distribution`);
  sections.push(`**Team Size:** ${members.length} | **Open Issues:** ${issues.length}\n`);

  sections.push(mdTable(
    ["Member", "Open Issues", "Labels"],
    members.map((m) => [m.name, String(m.total), m.labels || "—"])
  ));

  if (unassigned > 0) {
    sections.push(`\n## ⚠️ Unassigned: ${unassigned} issues need assignment`);
  }

  const flags = [];
  for (const m of members) {
    if (m.total > avgIssues * 1.5 && m.total > 5) flags.push(`🔴 ${m.name}: Overloaded (${m.total} issues, avg: ${Math.round(avgIssues)})`);
    else if (m.total < avgIssues * 0.5 && avgIssues > 3) flags.push(`🟡 ${m.name}: Underutilized (${m.total} issues, avg: ${Math.round(avgIssues)})`);
  }
  if (flags.length) {
    sections.push("\n## 🚩 Flags");
    sections.push(flags.map((f) => `- ${f}`).join("\n"));
  }

  return JSON.stringify({
    success: true,
    report: sections.join("\n"),
    stats: { teamSize: members.length, totalIssues: issues.length, unassigned, flags: flags.length },
    note: "GitHub does not support story points. Stats are issue-count based.",
  });
};

// ─── Tool 2: Team Utilization Trends ──────────────────────────────────

const createTeamUtilizationTool = (project) => {
  return tool(
    async ({ sprintCount }) => {
      const platform = project.boardConfig?.platform || "github";
      const count = Math.min(sprintCount || 3, 5);

      try {
        if (platform === "jira") {
          return await analyzeJiraUtilization(project.boardConfig, count);
        }
        return await analyzeGithubUtilization(project, count);
      } catch (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
    },
    {
      name: "analyze_team_utilization",
      description:
        "Analyze team utilization trends across recent sprints. Shows per-member throughput over time, identifies consistent contributors, rising/declining performers, and team velocity trends. Use when PM asks about 'team utilization', 'team trends', 'who is contributing', 'team performance over time', or 'capacity trend'.",
      schema: z.object({
        sprintCount: z
          .number()
          .optional()
          .default(3)
          .describe("Number of recent sprints to analyze (default: 3, max: 5)"),
      }),
    }
  );
};

const analyzeJiraUtilization = async (boardConfig, sprintCount) => {
  const boardId = await resolveBoardId(boardConfig);

  // Get recent sprints (active + closed)
  const sprints = [];
  
  const activeData = await jiraFetch(boardConfig, `/rest/agile/1.0/board/${boardId}/sprint?state=active`);
  if (activeData.values?.[0]) sprints.push(activeData.values[0]);

  const closedData = await jiraFetch(boardConfig, `/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=${sprintCount}`);
  sprints.push(...(closedData.values || []).slice(0, sprintCount - sprints.length));

  if (sprints.length === 0) {
    return JSON.stringify({ success: true, report: "No sprints found to analyze." });
  }

  // Collect per-member data across sprints
  const memberData = {}; // { memberName: [{ sprint, done, points }] }
  const sprintSummaries = [];

  for (const sprint of sprints) {
    const issuesData = await jiraFetch(
      boardConfig,
      `/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=200&fields=status,assignee,${VELOCITY_DEFAULTS.STORY_POINT_FIELDS.join(",")}`
    );

    let sprintTotal = 0, sprintDone = 0;

    for (const issue of issuesData.issues || []) {
      const assignee = issue.fields?.assignee?.displayName;
      if (!assignee) continue;

      const cat = categorizeStatus(issue.fields?.status?.name);
      const pts = extractStoryPoints(issue.fields) || 0;

      if (!memberData[assignee]) memberData[assignee] = [];

      // Find or create entry for this sprint
      let entry = memberData[assignee].find((e) => e.sprintId === sprint.id);
      if (!entry) {
        entry = { sprintId: sprint.id, sprintName: sprint.name, total: 0, done: 0, points: 0, donePoints: 0 };
        memberData[assignee].push(entry);
      }

      entry.total++;
      entry.points += pts;
      if (cat === "DONE") { entry.done++; entry.donePoints += pts; }

      sprintTotal += pts;
      if (cat === "DONE") sprintDone += pts;
    }

    sprintSummaries.push({ name: sprint.name, totalPoints: sprintTotal, donePoints: sprintDone });
  }

  // Compute member trends
  const memberTrends = Object.entries(memberData).map(([name, sprintEntries]) => {
    const totalDonePoints = sprintEntries.reduce((s, e) => s + e.donePoints, 0);
    const totalDone = sprintEntries.reduce((s, e) => s + e.done, 0);
    const sprintsActive = sprintEntries.length;
    const avgPointsPerSprint = sprintsActive > 0 ? Math.round(totalDonePoints / sprintsActive * 10) / 10 : 0;

    // Trend: compare first half vs second half
    let trend = "Stable";
    if (sprintEntries.length >= 2) {
      const mid = Math.floor(sprintEntries.length / 2);
      const firstHalf = sprintEntries.slice(0, mid).reduce((s, e) => s + e.donePoints, 0) / mid;
      const secondHalf = sprintEntries.slice(mid).reduce((s, e) => s + e.donePoints, 0) / (sprintEntries.length - mid);
      if (secondHalf > firstHalf * 1.2) trend = "📈 Rising";
      else if (secondHalf < firstHalf * 0.8) trend = "📉 Declining";
      else trend = "➡️ Stable";
    }

    return {
      name,
      sprintsActive,
      totalDone,
      totalDonePoints,
      avgPointsPerSprint,
      trend,
    };
  }).sort((a, b) => b.totalDonePoints - a.totalDonePoints);

  // Build report
  const sections = [];
  sections.push(`# 📈 Team Utilization Trends`);
  sections.push(`**Sprints Analyzed:** ${sprints.length} | **Team Members:** ${memberTrends.length}\n`);

  // Sprint-level velocity
  sections.push("## 🏃 Sprint Velocity Overview");
  sections.push(mdTable(
    ["Sprint", "Total Points", "Completed Points", "Completion %"],
    sprintSummaries.map((s) => [
      s.name,
      String(s.totalPoints),
      String(s.donePoints),
      s.totalPoints > 0 ? `${Math.round((s.donePoints / s.totalPoints) * 100)}%` : "—",
    ])
  ));
  sections.push("");

  // Per-member trends
  sections.push("## 👥 Member Utilization");
  sections.push(mdTable(
    ["Member", "Sprints Active", "Total Done", "Total Points", "Avg Pts/Sprint", "Trend"],
    memberTrends.map((m) => [
      m.name,
      String(m.sprintsActive),
      String(m.totalDone),
      String(m.totalDonePoints),
      String(m.avgPointsPerSprint),
      m.trend,
    ])
  ));
  sections.push("");

  // Insights
  sections.push("## 💡 Insights");
  const topContributor = memberTrends[0];
  if (topContributor) {
    sections.push(`- **Top contributor:** ${topContributor.name} with ${topContributor.totalDonePoints} points across ${topContributor.sprintsActive} sprint(s).`);
  }
  const rising = memberTrends.filter((m) => m.trend.includes("Rising"));
  if (rising.length) {
    sections.push(`- **Rising performers:** ${rising.map((m) => m.name).join(", ")} — increasing output over recent sprints.`);
  }
  const declining = memberTrends.filter((m) => m.trend.includes("Declining"));
  if (declining.length) {
    sections.push(`- **Declining output:** ${declining.map((m) => m.name).join(", ")} — may need support or have taken on non-sprint work.`);
  }

  // Chart data
  const chartData = memberTrends.slice(0, 10).map((m) => ({ label: m.name.split(" ")[0], value: m.avgPointsPerSprint }));

  return JSON.stringify({
    success: true,
    report: sections.join("\n"),
    chartReady: { type: "bar", title: "Avg Points/Sprint per Member", data: chartData },
    stats: {
      sprintsAnalyzed: sprints.length,
      teamSize: memberTrends.length,
      topContributor: topContributor?.name || "N/A",
      risingPerformers: rising.length,
      decliningPerformers: declining.length,
    },
  });
};

const analyzeGithubUtilization = async (project, sprintCount) => {
  const repoInfo = parseOwnerRepo(project.repolink || project.repositories?.[0]?.repolink);
  if (!repoInfo) {
    return JSON.stringify({ success: false, error: "No GitHub repository configured." });
  }
  const { owner, repo } = repoInfo;

  // Get recent closed + open milestones
  const closed = await githubFetch(project.pat_token, `/repos/${owner}/${repo}/milestones?state=closed&sort=due_on&direction=desc&per_page=${sprintCount}`);
  const open = await githubFetch(project.pat_token, `/repos/${owner}/${repo}/milestones?state=open&sort=due_on&direction=asc&per_page=1`);
  const milestones = [...(open || []), ...(closed || [])].slice(0, sprintCount);

  if (milestones.length === 0) {
    return JSON.stringify({ success: true, report: "No milestones found to analyze." });
  }

  const memberData = {};
  const msSummaries = [];

  for (const ms of milestones) {
    const allIssues = await githubFetch(
      project.pat_token,
      `/repos/${owner}/${repo}/issues?milestone=${ms.number}&state=all&per_page=100`
    );
    const issues = allIssues.filter((i) => !i.pull_request);

    let closed = 0;
    for (const issue of issues) {
      const assignee = issue.assignee?.login;
      if (!assignee) continue;

      if (!memberData[assignee]) memberData[assignee] = { total: 0, closed: 0, milestones: 0 };
      memberData[assignee].total++;
      if (issue.state === "closed") { memberData[assignee].closed++; closed++; }
    }

    // Track milestone participation
    for (const name of Object.keys(memberData)) {
      const participated = issues.some((i) => i.assignee?.login === name);
      if (participated) memberData[name].milestones = (memberData[name].milestones || 0) + 1;
    }

    msSummaries.push({ title: ms.title, total: issues.length, closed });
  }

  const members = Object.entries(memberData)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.closed - a.closed);

  const sections = [];
  sections.push(`# 📈 Team Utilization Trends`);
  sections.push(`**Milestones Analyzed:** ${milestones.length} | **Team Members:** ${members.length}\n`);

  sections.push("## 🏃 Milestone Overview");
  sections.push(mdTable(
    ["Milestone", "Total Issues", "Closed"],
    msSummaries.map((m) => [m.title, String(m.total), String(m.closed)])
  ));
  sections.push("");

  sections.push("## 👥 Member Utilization");
  sections.push(mdTable(
    ["Member", "Milestones Active", "Assigned", "Closed"],
    members.map((m) => [m.name, String(m.milestones || 1), String(m.total), String(m.closed)])
  ));

  return JSON.stringify({
    success: true,
    report: sections.join("\n"),
    stats: { milestonesAnalyzed: milestones.length, teamSize: members.length },
    note: "GitHub milestones do not support story points. Stats are issue-count based.",
  });
};

module.exports = {
  createWorkloadDistributionTool,
  createTeamUtilizationTool,
};

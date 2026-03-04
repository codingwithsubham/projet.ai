const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");

const safeArray = (arr = []) => (Array.isArray(arr) ? arr : []);

const buildPmTools = () => {
  const defineProjectCharter = new DynamicStructuredTool({
    name: "define_project_charter",
    description: "Create a concise project charter with goals, scope, constraints, and KPIs.",
    schema: z.object({
      projectName: z.string().min(1),
      objective: z.string().min(1),
      inScope: z.array(z.string()).default([]),
      outOfScope: z.array(z.string()).default([]),
      successMetrics: z.array(z.string()).default([]),
      constraints: z.array(z.string()).default([]),
    }),
    func: async (input) => {
      return [
        `# Project Charter: ${input.projectName}`,
        `## Objective\n${input.objective}`,
        `## In Scope\n${safeArray(input.inScope).map((x) => `- ${x}`).join("\n") || "- TBD"}`,
        `## Out of Scope\n${safeArray(input.outOfScope).map((x) => `- ${x}`).join("\n") || "- TBD"}`,
        `## Success Metrics\n${safeArray(input.successMetrics).map((x) => `- ${x}`).join("\n") || "- TBD"}`,
        `## Constraints\n${safeArray(input.constraints).map((x) => `- ${x}`).join("\n") || "- TBD"}`,
      ].join("\n\n");
    },
  });

  const createSprintPlan = new DynamicStructuredTool({
    name: "create_sprint_plan",
    description: "Generate a sprint plan from backlog items and team capacity.",
    schema: z.object({
      sprintName: z.string().min(1),
      capacityPoints: z.number().positive(),
      backlog: z.array(
        z.object({
          title: z.string().min(1),
          points: z.number().nonnegative(),
          priority: z.number().int().min(1).max(5).default(3),
        })
      ),
    }),
    func: async ({ sprintName, capacityPoints, backlog }) => {
      const sorted = [...backlog].sort((a, b) => a.priority - b.priority);
      const picked = [];
      let used = 0;
      for (const item of sorted) {
        if (used + item.points <= capacityPoints) {
          picked.push(item);
          used += item.points;
        }
      }

      return [
        `# Sprint Plan: ${sprintName}`,
        `- Capacity: ${capacityPoints} points`,
        `- Planned: ${used} points`,
        `- Remaining: ${Math.max(0, capacityPoints - used)} points`,
        `## Selected Work`,
        picked.length
          ? picked.map((i, idx) => `${idx + 1}. ${i.title} (${i.points} pts, P${i.priority})`).join("\n")
          : "- No items selected",
      ].join("\n");
    },
  });

  const prioritizeBacklogRice = new DynamicStructuredTool({
    name: "prioritize_backlog_rice",
    description: "Prioritize initiatives using RICE score = (Reach × Impact × Confidence) / Effort.",
    schema: z.object({
      items: z.array(
        z.object({
          title: z.string().min(1),
          reach: z.number().nonnegative(),
          impact: z.number().nonnegative(),
          confidence: z.number().min(0).max(1),
          effort: z.number().positive(),
        })
      ),
    }),
    func: async ({ items }) => {
      const scored = items
        .map((i) => ({
          ...i,
          score: (i.reach * i.impact * i.confidence) / i.effort,
        }))
        .sort((a, b) => b.score - a.score);

      return [
        `# Backlog Prioritization (RICE)`,
        `| Rank | Item | Score |`,
        `|---|---|---:|`,
        ...scored.map((i, idx) => `| ${idx + 1} | ${i.title} | ${i.score.toFixed(2)} |`),
      ].join("\n");
    },
  });

  const estimateStoryPoints = new DynamicStructuredTool({
    name: "estimate_story_points",
    description: "Estimate story points using complexity, uncertainty, and dependency load.",
    schema: z.object({
      complexity: z.number().min(1).max(5),
      uncertainty: z.number().min(1).max(5),
      dependencies: z.number().min(0).max(5),
    }),
    func: async ({ complexity, uncertainty, dependencies }) => {
      const raw = complexity * 1.4 + uncertainty * 1.2 + dependencies * 0.8;
      const fibonacci = [1, 2, 3, 5, 8, 13];
      const nearest = fibonacci.reduce((prev, curr) =>
        Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
      );

      return `Estimated story points: **${nearest}** (raw score: ${raw.toFixed(2)}).`;
    },
  });

  const buildRiskRegister = new DynamicStructuredTool({
    name: "build_risk_register",
    description: "Create risk register with severity and mitigation actions.",
    schema: z.object({
      risks: z.array(
        z.object({
          risk: z.string().min(1),
          probability: z.number().min(1).max(5),
          impact: z.number().min(1).max(5),
          mitigation: z.string().min(1),
          owner: z.string().min(1),
        })
      ),
    }),
    func: async ({ risks }) => {
      const rows = risks
        .map((r) => ({ ...r, score: r.probability * r.impact }))
        .sort((a, b) => b.score - a.score);

      return [
        `# Risk Register`,
        `| Risk | Prob | Impact | Score | Owner | Mitigation |`,
        `|---|---:|---:|---:|---|---|`,
        ...rows.map(
          (r) =>
            `| ${r.risk} | ${r.probability} | ${r.impact} | ${r.score} | ${r.owner} | ${r.mitigation} |`
        ),
      ].join("\n");
    },
  });

  const mapDependencies = new DynamicStructuredTool({
    name: "map_dependencies",
    description: "Generate dependency map and identify blocking chains.",
    schema: z.object({
      workItems: z.array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          dependsOn: z.array(z.string()).default([]),
        })
      ),
    }),
    func: async ({ workItems }) => {
      const blockers = workItems.filter((w) => safeArray(w.dependsOn).length > 0);
      return [
        `# Dependency Map`,
        ...workItems.map(
          (w) => `- **${w.id}** ${w.title} ${safeArray(w.dependsOn).length ? `← depends on: ${w.dependsOn.join(", ")}` : "(no dependencies)"}`
        ),
        ``,
        `## Blocking Items`,
        blockers.length ? blockers.map((b) => `- ${b.id}: ${b.title}`).join("\n") : "- None",
      ].join("\n");
    },
  });

  const createReleaseChecklist = new DynamicStructuredTool({
    name: "create_release_checklist",
    description: "Generate release readiness checklist for product launches.",
    schema: z.object({
      releaseName: z.string().min(1),
      environments: z.array(z.string()).default(["staging", "production"]),
      includeRollback: z.boolean().default(true),
    }),
    func: async ({ releaseName, environments, includeRollback }) => {
      const lines = [
        `# Release Checklist: ${releaseName}`,
        `## Pre-Release`,
        `- [ ] Scope freeze confirmed`,
        `- [ ] QA sign-off`,
        `- [ ] Security checks completed`,
        `- [ ] Observability dashboards ready`,
        `## Deployment`,
        ...safeArray(environments).map((e) => `- [ ] Deploy to ${e}`),
        `## Post-Release`,
        `- [ ] Smoke tests completed`,
        `- [ ] Error budget / incidents reviewed`,
        `- [ ] Stakeholders notified`,
      ];
      if (includeRollback) {
        lines.push(`## Rollback`, `- [ ] Rollback plan validated`, `- [ ] Data rollback strategy verified`);
      }
      return lines.join("\n");
    },
  });

  const draftStakeholderUpdate = new DynamicStructuredTool({
    name: "draft_stakeholder_update",
    description: "Draft a weekly stakeholder status update.",
    schema: z.object({
      period: z.string().min(1),
      achievements: z.array(z.string()).default([]),
      plannedNext: z.array(z.string()).default([]),
      blockers: z.array(z.string()).default([]),
      asks: z.array(z.string()).default([]),
    }),
    func: async ({ period, achievements, plannedNext, blockers, asks }) => {
      return [
        `# Stakeholder Update (${period})`,
        `## Achievements\n${safeArray(achievements).map((x) => `- ${x}`).join("\n") || "- None"}`,
        `## Next\n${safeArray(plannedNext).map((x) => `- ${x}`).join("\n") || "- None"}`,
        `## Risks / Blockers\n${safeArray(blockers).map((x) => `- ${x}`).join("\n") || "- None"}`,
        `## Decisions / Asks\n${safeArray(asks).map((x) => `- ${x}`).join("\n") || "- None"}`,
      ].join("\n\n");
    },
  });

  const createMeetingAgenda = new DynamicStructuredTool({
    name: "create_meeting_agenda",
    description: "Create a time-boxed meeting agenda with owners.",
    schema: z.object({
      meetingTitle: z.string().min(1),
      durationMinutes: z.number().positive(),
      topics: z.array(
        z.object({
          title: z.string().min(1),
          owner: z.string().min(1),
          minutes: z.number().positive(),
        })
      ),
    }),
    func: async ({ meetingTitle, durationMinutes, topics }) => {
      const used = topics.reduce((sum, t) => sum + t.minutes, 0);
      return [
        `# Agenda: ${meetingTitle}`,
        `- Total duration: ${durationMinutes} min`,
        `- Planned topics: ${used} min`,
        `- Buffer: ${Math.max(0, durationMinutes - used)} min`,
        `## Topics`,
        ...topics.map((t, i) => `${i + 1}. ${t.title} — ${t.owner} (${t.minutes} min)`),
      ].join("\n");
    },
  });

  const generateRetroSummary = new DynamicStructuredTool({
    name: "generate_retro_summary",
    description: "Generate sprint retrospective summary with action items.",
    schema: z.object({
      wentWell: z.array(z.string()).default([]),
      needsImprovement: z.array(z.string()).default([]),
      actions: z.array(z.object({ item: z.string().min(1), owner: z.string().min(1) })).default([]),
    }),
    func: async ({ wentWell, needsImprovement, actions }) => {
      return [
        `# Sprint Retrospective`,
        `## Went Well\n${safeArray(wentWell).map((x) => `- ${x}`).join("\n") || "- None"}`,
        `## Needs Improvement\n${safeArray(needsImprovement).map((x) => `- ${x}`).join("\n") || "- None"}`,
        `## Action Items`,
        safeArray(actions).length
          ? safeArray(actions).map((a) => `- ${a.item} (**Owner:** ${a.owner})`).join("\n")
          : "- None",
      ].join("\n\n");
    },
  });

  return [
    defineProjectCharter,
    createSprintPlan,
    prioritizeBacklogRice,
    estimateStoryPoints,
    buildRiskRegister,
    mapDependencies,
    createReleaseChecklist,
    draftStakeholderUpdate,
    createMeetingAgenda,
    generateRetroSummary,
  ];
};

module.exports = { buildPmTools };
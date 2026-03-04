export const PROMPTS = [
  {
    id: 1,
    tool: "define_project_charter",
    prompt:
      "Create a project charter for AI Contract Review Assistant. Objective: reduce legal review time by 40%. In scope: document upload, clause extraction, risk scoring. Out of scope: e-signature. Success metrics: review time, accuracy, adoption.",
  },
  {
    id: 2,
    tool: "create_sprint_plan",
    prompt:
      "Plan Sprint 7 with capacity 34 points. Backlog: Login hardening (8, P1), Dashboard filters (5, P2), Export PDF (8, P2), Audit logs (13, P1), Theme toggle (3, P4).",
  },
  {
    id: 3,
    tool: "prioritize_backlog_rice",
    prompt:
      "Prioritize these initiatives using RICE: Smart search (reach 800, impact 2.5, confidence 0.8, effort 8), Slack alerts (300, 1.8, 0.9, 3), Auto-tagging (600, 2.2, 0.7, 10).",
  },
  {
    id: 4,
    tool: "estimate_story_points",
    prompt:
      "Estimate story points for a feature with complexity 4, uncertainty 3, dependencies 2.",
  },
  {
    id: 5,
    tool: "build_risk_register",
    prompt:
      "Build a risk register: 1) API vendor downtime (prob 3 impact 5, mitigation multi-provider fallback, owner DevOps), 2) Scope creep (4,4, change-control board, owner PM), 3) Late QA cycles (3,4, shift-left testing, owner QA lead).",
  },
  {
    id: 6,
    tool: "map_dependencies",
    prompt:
      "Map dependencies for work items: FE-12 Dashboard UI depends on BE-7, DS-3; BE-7 Auth refactor depends on INF-2; INF-2 has no dependency; DS-3 depends on BE-7.",
  },
  {
    id: 7,
    tool: "create_release_checklist",
    prompt:
      "Create a release checklist for v2.3.0 with environments staging, preprod, production and include rollback.",
  },
  {
    id: 8,
    tool: "draft_stakeholder_update",
    prompt:
      "Draft stakeholder update for Week 10. Achievements: completed RBAC, reduced API latency 18%. Planned next: UAT, release prep. Blockers: legal signoff pending. Asks: approve extra QA bandwidth.",
  },
  {
    id: 9,
    tool: "create_meeting_agenda",
    prompt:
      "Create a 45-minute meeting agenda for Sprint Planning with topics: carryover review (PM, 10), capacity planning (EM, 10), backlog selection (Team, 20), risks (PM, 5).",
  },
  {
    id: 10,
    tool: "generate_retro_summary",
    prompt:
      "Generate retrospective summary: went well — faster code reviews, stable staging; needs improvement—test data setup, unclear acceptance criteria; actions—define AC template (PM), automate seed scripts (QA).",
  },
  {
    id: 11,
    tool: "combo_sprint_and_update",
    prompt:
      "Use a combination of tools: give me a sprint plan for 30 points, then produce a stakeholder update from that sprint plan.",
  },
  {
    id: 12,
    tool: "combo_risk_and_release",
    prompt:
      "For a new mobile release, first build a risk register, then create a release checklist, then summarize top 3 recommendations.",
  },
];

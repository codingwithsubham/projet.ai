const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const activityLogService = require("../services/activityLog.service");

/**
 * Tool for agents to query developer activity for handoff scenarios
 */
const createGetDeveloperActivityTool = (project) => {
  return tool(
    async ({ developerName, days, topic }) => {
      const projectId = String(project?._id || "").trim();
      if (!projectId) {
        return JSON.stringify({
          success: false,
          error: "Project ID is required",
        });
      }

      try {
        const context = await activityLogService.getDeveloperActivityByName(
          projectId,
          developerName,
          days || 7
        );

        if (context.error) {
          return JSON.stringify({
            success: false,
            error: context.error,
          });
        }

        // Filter by topic if provided
        let filteredPrompts = context.recentPrompts;
        if (topic) {
          const topicLower = topic.toLowerCase();
          filteredPrompts = context.recentPrompts.filter(
            (p) =>
              (p.summary && p.summary.toLowerCase().includes(topicLower)) ||
              (p.prompt && p.prompt.toLowerCase().includes(topicLower))
          );
        }

        return JSON.stringify({
          success: true,
          developer: context.developer,
          period: context.period,
          totalActivities: context.totalActivities,
          topics: context.topics,
          filesWorkedOn: context.filesWorkedOn,
          recentPrompts: filteredPrompts.map((p) => ({
            summary: p.summary,
            agentType: p.agentType,
            date: p.createdAt,
          })),
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error.message,
        });
      }
    },
    {
      name: "get_developer_activity",
      description:
        "Get what a specific developer has been working on. Use this for handoff scenarios when someone is on leave or you need to understand their recent work context. Returns topics, files, and recent prompts.",
      schema: z.object({
        developerName: z
          .string()
          .describe("Name of the developer (partial match supported)"),
        days: z
          .number()
          .optional()
          .default(7)
          .describe("Number of days to look back (default: 7)"),
        topic: z
          .string()
          .optional()
          .describe("Optional topic filter to narrow down results"),
      }),
    }
  );
};

/**
 * Tool for PM agents to get team progress overview
 */
const createGetTeamProgressTool = (project) => {
  return tool(
    async ({ days, groupBy }) => {
      const projectId = String(project?._id || "").trim();
      if (!projectId) {
        return JSON.stringify({
          success: false,
          error: "Project ID is required",
        });
      }

      try {
        const summary = await activityLogService.getTeamActivitySummary(
          projectId,
          days || 7
        );

        // Format for readability
        const teamData = summary.teamMembers.map((member) => ({
          name: member.userName || "Unknown",
          email: member.userEmail,
          totalInteractions: member.totalActivities,
          topics: member.topics.filter((t) => t).slice(0, 5),
          agentsUsed: member.agents,
          lastActive: member.lastActivity,
        }));

        // Group by agent if requested
        let groupedData = null;
        if (groupBy === "agent") {
          const byAgent = {};
          for (const member of summary.teamMembers) {
            for (const agent of member.agents) {
              if (!byAgent[agent]) byAgent[agent] = [];
              byAgent[agent].push(member.userName || "Unknown");
            }
          }
          groupedData = byAgent;
        }

        return JSON.stringify({
          success: true,
          period: summary.period,
          totalTeamInteractions: summary.totalTeamActivities,
          teamMembers: teamData,
          groupedByAgent: groupedData,
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error.message,
        });
      }
    },
    {
      name: "get_team_progress",
      description:
        "Get a summary of what the entire team has been working on. Shows activity breakdown by team member including topics, interactions, and which AI agents they used. Useful for sprint reviews and progress tracking.",
      schema: z.object({
        days: z
          .number()
          .optional()
          .default(7)
          .describe("Number of days to look back (default: 7)"),
        groupBy: z
          .enum(["member", "agent"])
          .optional()
          .default("member")
          .describe("How to group results: by team member or by agent type"),
      }),
    }
  );
};

/**
 * Tool for getting structured handoff context
 */
const createGetHandoffContextTool = (project) => {
  return tool(
    async ({ developerName, includeSummary }) => {
      const projectId = String(project?._id || "").trim();
      if (!projectId) {
        return JSON.stringify({
          success: false,
          error: "Project ID is required",
        });
      }

      try {
        const context = await activityLogService.getDeveloperActivityByName(
          projectId,
          developerName,
          14 // 2 weeks for handoff context
        );

        if (context.error) {
          return JSON.stringify({
            success: false,
            error: context.error,
          });
        }

        // Build structured handoff
        const handoff = {
          developer: context.developer,
          period: context.period,
          totalActivities: context.totalActivities,
          keyTopics: context.topics.slice(0, 10),
          filesInProgress: context.filesWorkedOn.slice(0, 15),
        };

        if (includeSummary !== false) {
          // Generate a brief summary
          const topTopics = context.topics.slice(0, 3);
          handoff.summary = topTopics.length
            ? `${context.developer?.name || developerName} was primarily working on: ${topTopics.join(", ")}. They had ${context.totalActivities} interactions in the last 2 weeks.`
            : `No significant activity found for ${developerName} in the last 2 weeks.`;

          // Include recent prompts for context
          handoff.recentTasks = context.recentPrompts.slice(0, 5).map((p) => ({
            task: p.summary || p.prompt.slice(0, 100),
            agent: p.agentType,
            when: p.createdAt,
          }));
        }

        return JSON.stringify({
          success: true,
          handoff,
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error.message,
        });
      }
    },
    {
      name: "get_handoff_context",
      description:
        "Get structured context for taking over another developer's work. Use when someone is on leave and you need to continue their tasks. Returns key topics, files in progress, and a summary of their recent work.",
      schema: z.object({
        developerName: z
          .string()
          .describe("Name of the developer whose work you're taking over"),
        includeSummary: z
          .boolean()
          .optional()
          .default(true)
          .describe("Include a generated summary of their work"),
      }),
    }
  );
};

module.exports = {
  createGetDeveloperActivityTool,
  createGetTeamProgressTool,
  createGetHandoffContextTool,
};

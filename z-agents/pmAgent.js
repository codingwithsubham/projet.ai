const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { createLlmForProject } = require("../openai");
const { buildPmTools } = require("../tools/pmTools");
const { createStoreHappyFeedbackTool, createMermaidChartTool, createMarkdownReportTableTool } = require("../tools/commonTools");
const { createGetDeveloperActivityTool, createGetTeamProgressTool, createGetHandoffContextTool } = require("../tools/activityTools");
const {
  createSprintVelocityTool,
  createBurndownDataTool,
  createCycleTimeTool,
  createBlockerDetectionTool,
  createSprintHealthTool,
} = require("../tools/sprintAnalyticsTools");
const {
  createStandupDigestTool,
  createSprintReviewReportTool,
  createWeeklyStatusReportTool,
} = require("../tools/reportTools");
const {
  createScopeCreepTool,
  createSprintPredictionTool,
  createDependencyRiskTool,
} = require("../tools/riskTools");
const {
  createWorkloadDistributionTool,
  createTeamUtilizationTool,
} = require("../tools/capacityTools");
const {
  createDelegateToDocumentAgentTool,
  createDelegateToPresentationAgentTool,
} = require("../tools/delegationTools");
const { guardToolsForSingleExecution } = require("../helpers/toolExecutionGuard");
const { checkpointer } = require("../orchestration/checkpointer.service");

const dynamicPmAgent = async (project, requester = null) => {
  const llm = createLlmForProject(project);
  const tools = await buildPmTools(project);
  const happyFeedbackTool = createStoreHappyFeedbackTool(project);
  const mermaidChartTool = createMermaidChartTool();
  const markdownTableTool = createMarkdownReportTableTool();
  // Activity tools for team tracking and handoff
  const developerActivityTool = createGetDeveloperActivityTool(project);
  const teamProgressTool = createGetTeamProgressTool(project);
  const handoffContextTool = createGetHandoffContextTool(project);
  // Sprint analytics tools
  const sprintVelocityTool = createSprintVelocityTool(project);
  const burndownDataTool = createBurndownDataTool(project);
  const cycleTimeTool = createCycleTimeTool(project);
  const blockerDetectionTool = createBlockerDetectionTool(project);
  const sprintHealthTool = createSprintHealthTool(project);
  // Report template tools
  const standupDigestTool = createStandupDigestTool(project);
  const sprintReviewTool = createSprintReviewReportTool(project);
  const weeklyStatusTool = createWeeklyStatusReportTool(project);
  // Risk intelligence tools
  const scopeCreepTool = createScopeCreepTool(project);
  const sprintPredictionTool = createSprintPredictionTool(project);
  const dependencyRiskTool = createDependencyRiskTool(project);
  // Capacity & utilization tools
  const workloadTool = createWorkloadDistributionTool(project);
  const utilizationTool = createTeamUtilizationTool(project);
  // Agent delegation tools - use requester to generate tokens on-demand for API calls
  const delegateDocTool = createDelegateToDocumentAgentTool(project, requester);
  const delegatePptTool = createDelegateToPresentationAgentTool(project, requester);
  
  const guardedTools = guardToolsForSingleExecution([
    ...tools,
    happyFeedbackTool,
    mermaidChartTool,
    markdownTableTool,
    developerActivityTool,
    teamProgressTool,
    handoffContextTool,
    sprintVelocityTool,
    burndownDataTool,
    cycleTimeTool,
    blockerDetectionTool,
    sprintHealthTool,
    standupDigestTool,
    sprintReviewTool,
    weeklyStatusTool,
    scopeCreepTool,
    sprintPredictionTool,
    dependencyRiskTool,
    workloadTool,
    utilizationTool,
    // Delegation tools
    delegateDocTool,
    delegatePptTool,
  ]);

  const agent = createReactAgent({
    llm,
    tools: guardedTools,
    checkpointSaver: checkpointer,
  });
  return agent;
};

module.exports = { dynamicPmAgent };

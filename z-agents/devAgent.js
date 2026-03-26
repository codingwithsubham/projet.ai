const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { createLlmForProject } = require("../openai");
const { buildDevTools } = require("../tools/devTools");
const { createMermaidChartTool, createMarkdownReportTableTool } = require("../tools/commonTools");
const { createGetDeveloperActivityTool, createGetHandoffContextTool } = require("../tools/activityTools");
const { guardToolsForSingleExecution } = require("../helpers/toolExecutionGuard");
const { checkpointer } = require("../orchestration/checkpointer.service");

/**
 * Create a dynamic dev agent with configurable tool access
 * 
 * @param {Object} project - Project object
 * @param {Object} [options] - Agent options
 * @param {boolean} [options.includeExternalTools=true] - Include GitHub/external tools
 * @param {boolean} [options.readOnlyMode=false] - Only include read-only external tools
 * @returns {Promise<Object>} LangGraph agent
 */
const dynamicDevAgent = async (project, options = {}) => {
  const { includeExternalTools = true, readOnlyMode = false } = options;

  const llm = createLlmForProject(project);
  
  // Build external tools based on options
  const tools = await buildDevTools(project, { includeExternalTools, readOnlyMode });
  
  // Utility tools (always included)
  const mermaidChartTool = createMermaidChartTool();
  const markdownTableTool = createMarkdownReportTableTool();
  
  // Activity tools for handoff scenarios (always included)
  const developerActivityTool = createGetDeveloperActivityTool(project);
  const handoffContextTool = createGetHandoffContextTool(project);
  
  const allTools = [
    ...tools, 
    mermaidChartTool, 
    markdownTableTool,
    developerActivityTool,
    handoffContextTool,
  ];

  const guardedTools = guardToolsForSingleExecution(allTools);

  if (!includeExternalTools) {
    console.log(`🤖 Dev Agent: RAG-first mode (${guardedTools.length} utility tools only)`);
  } else if (readOnlyMode) {
    console.log(`🤖 Dev Agent: Read-only mode (${guardedTools.length} tools)`);
  } else {
    console.log(`🤖 Dev Agent: Full mode (${guardedTools.length} tools)`);
  }

  const agent = createReactAgent({
    llm,
    tools: guardedTools,
    checkpointSaver: checkpointer,
  });
  return agent;
};

module.exports = { dynamicDevAgent };

/**
 * Tool Router Service
 * 
 * Enterprise-grade routing logic that determines when to use local RAG
 * vs external tools (GitHub, etc.). Implements RAG-first strategy.
 * 
 * Key Features:
 * - RAG sufficiency check before external tool invocation
 * - Tool filtering based on RAG coverage
 * - Query pattern analysis for optimal routing
 * - Confidence-based fallback logic
 */

const { queryVectors } = require("../helpers/embaddingHelpers");
const {
  RAG_THRESHOLDS,
  TOOL_CATEGORY,
  getToolMetadata,
  queryPrefersRag,
  queryPrefersExternal,
  getExternalToolNames,
  hasRagFallback,
} = require("../common/tool-metadata");
const { buildRepoFilter } = require("../helpers/repoDetection");

// Routing decision types
const ROUTING_DECISION = {
  RAG_ONLY: "rag_only",           // RAG is sufficient, skip external tools
  RAG_PREFERRED: "rag_preferred", // RAG has data but may need external supplement
  EXTERNAL_ALLOWED: "external_allowed", // RAG insufficient, allow external tools
  EXTERNAL_REQUIRED: "external_required", // Query type requires external (real-time data)
};

/**
 * Check if RAG has sufficient coverage for the query
 * 
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {string} options.query - User query
 * @param {Object} [options.filter] - Metadata filter
 * @returns {Promise<Object>} RAG sufficiency result
 */
const checkRagSufficiency = async ({ project, query, filter = {} }) => {
  const startTime = Date.now();
  
  try {
    // Quick RAG check with limited results
    const results = await queryVectors({
      project,
      query,
      topK: 10,
      filter,
      minScore: RAG_THRESHOLDS.MIN_SCORE - 0.1, // Slightly lower to catch edge cases
    });

    const duration = Date.now() - startTime;

    if (!results || results.length === 0) {
      return {
        sufficient: false,
        confidence: 0,
        reason: "No relevant content found in knowledge base",
        chunkCount: 0,
        avgScore: 0,
        maxScore: 0,
        duration,
      };
    }

    // Calculate metrics
    const scores = results.map(r => r.score || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const highQualityChunks = results.filter(r => r.score >= RAG_THRESHOLDS.MIN_SCORE).length;

    // Determine sufficiency
    let sufficient = false;
    let confidence = 0;
    let reason = "";

    if (maxScore >= RAG_THRESHOLDS.HIGH_CONFIDENCE && highQualityChunks >= RAG_THRESHOLDS.MIN_CHUNKS) {
      sufficient = true;
      confidence = maxScore;
      reason = "High-quality matches found in knowledge base";
    } else if (avgScore >= RAG_THRESHOLDS.PARTIAL_CONFIDENCE && highQualityChunks >= 1) {
      sufficient = true;
      confidence = avgScore;
      reason = "Sufficient content found in knowledge base";
    } else if (highQualityChunks >= RAG_THRESHOLDS.MIN_CHUNKS) {
      sufficient = true;
      confidence = avgScore;
      reason = "Multiple relevant chunks found";
    } else {
      sufficient = false;
      confidence = maxScore;
      reason = "Insufficient coverage in knowledge base";
    }

    return {
      sufficient,
      confidence,
      reason,
      chunkCount: results.length,
      highQualityChunks,
      avgScore,
      maxScore,
      duration,
      topResults: results.slice(0, 3).map(r => ({
        score: r.score,
        source: r.metadata?.source || "unknown",
        preview: (r.content || "").slice(0, 100),
      })),
    };
  } catch (error) {
    console.error("❌ RAG sufficiency check failed:", error.message);
    return {
      sufficient: false,
      confidence: 0,
      reason: `RAG check failed: ${error.message}`,
      chunkCount: 0,
      avgScore: 0,
      maxScore: 0,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
};

/**
 * Determine routing decision based on query and RAG sufficiency
 * 
 * @param {Object} options
 * @param {string} options.query - User query
 * @param {Object} options.ragResult - RAG sufficiency result
 * @returns {Object} Routing decision
 */
const determineRouting = ({ query, ragResult }) => {
  // Check if query explicitly requires external data
  if (queryPrefersExternal(query)) {
    return {
      decision: ROUTING_DECISION.EXTERNAL_REQUIRED,
      reason: "Query requests real-time or external data",
      useExternalTools: true,
      ragFirst: false,
    };
  }

  // Check if query prefers RAG
  const prefersRag = queryPrefersRag(query);

  // High confidence RAG result
  if (ragResult.sufficient && ragResult.confidence >= RAG_THRESHOLDS.HIGH_CONFIDENCE) {
    return {
      decision: ROUTING_DECISION.RAG_ONLY,
      reason: ragResult.reason,
      useExternalTools: false,
      ragFirst: true,
    };
  }

  // Sufficient RAG with preference
  if (ragResult.sufficient && prefersRag) {
    return {
      decision: ROUTING_DECISION.RAG_PREFERRED,
      reason: "Query pattern suggests RAG content is preferred",
      useExternalTools: false,
      ragFirst: true,
    };
  }

  // Partial RAG coverage
  if (ragResult.sufficient && ragResult.confidence >= RAG_THRESHOLDS.PARTIAL_CONFIDENCE) {
    return {
      decision: ROUTING_DECISION.RAG_PREFERRED,
      reason: ragResult.reason,
      useExternalTools: false, // Don't use external by default, but allow if explicitly needed
      ragFirst: true,
    };
  }

  // Insufficient RAG
  return {
    decision: ROUTING_DECISION.EXTERNAL_ALLOWED,
    reason: ragResult.reason || "Insufficient RAG coverage",
    useExternalTools: true,
    ragFirst: true, // Still try RAG first in the prompt
  };
};

/**
 * Main routing function - determines whether to use external tools
 * 
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {string} options.query - User query  
 * @param {string} [options.agentType] - Agent type (dev, PM, etc.)
 * @returns {Promise<Object>} Routing result with decision and tool filtering
 */
const routeQuery = async ({ project, query, agentType = "dev" }) => {
  console.log(`\n🔄 Tool Router: Analyzing query...`);
  
  // Build filter based on query (auto-detect repo tags)
  const { filter, detectedTags } = buildRepoFilter({
    query,
    autoDetect: true,
    repositories: project.repositories,
  });

  // Check RAG sufficiency
  const ragResult = await checkRagSufficiency({
    project,
    query,
    filter,
  });

  console.log(`📊 RAG Check: ${ragResult.chunkCount} chunks, max score: ${ragResult.maxScore?.toFixed(3)}, sufficient: ${ragResult.sufficient}`);

  // Determine routing
  const routing = determineRouting({ query, ragResult });
  
  console.log(`🎯 Routing Decision: ${routing.decision} - ${routing.reason}`);

  return {
    ...routing,
    ragResult,
    detectedTags,
    query,
    agentType,
  };
};

/**
 * Filter tools based on routing decision
 * Removes external tools when RAG is sufficient
 * 
 * @param {Array} tools - Array of tool objects
 * @param {Object} routingResult - Result from routeQuery
 * @returns {Array} Filtered tools
 */
const filterToolsByRouting = (tools, routingResult) => {
  if (!tools || !Array.isArray(tools)) return [];

  // If external tools are allowed, return all tools
  if (routingResult.useExternalTools) {
    console.log(`🔧 Tools: All ${tools.length} tools available (external allowed)`);
    return tools;
  }

  // Filter out external tools
  const externalToolNames = new Set(getExternalToolNames());
  
  const filteredTools = tools.filter(tool => {
    const toolName = (tool.name || "").toLowerCase();
    
    // Check if it's an external tool by name or metadata
    const meta = getToolMetadata(toolName);
    if (meta?.category === TOOL_CATEGORY.EXTERNAL_READ || 
        meta?.category === TOOL_CATEGORY.EXTERNAL_WRITE) {
      return false;
    }

    // Check against known external tool names
    if (externalToolNames.has(toolName)) {
      return false;
    }

    // Check for GitHub-related tools by pattern
    if (toolName.includes("github") || 
        toolName.includes("issue") || 
        toolName.includes("pull_request") ||
        toolName.includes("commit") ||
        toolName.includes("branch")) {
      return false;
    }

    return true;
  });

  console.log(`🔧 Tools: Filtered to ${filteredTools.length}/${tools.length} (external tools removed)`);
  return filteredTools;
};

/**
 * Get enhanced system prompt directive for RAG-first behavior
 * 
 * @param {Object} routingResult - Result from routeQuery
 * @returns {string} System prompt directive
 */
const getRoutingDirective = (routingResult) => {
  switch (routingResult.decision) {
    case ROUTING_DECISION.RAG_ONLY:
      return `
IMPORTANT: The knowledge base contains highly relevant information for this query.
Use the provided context from the knowledge base to answer.
Do NOT use external tools (GitHub, etc.) - the indexed data is sufficient and more reliable.
Provide a direct, comprehensive answer based on the knowledge base content.
`;

    case ROUTING_DECISION.RAG_PREFERRED:
      return `
IMPORTANT: The knowledge base contains relevant information for this query.
Prioritize using the provided RAG context to answer.
Only use external tools if the knowledge base information is clearly incomplete.
The knowledge base has been indexed from the project sources and should be preferred.
`;

    case ROUTING_DECISION.EXTERNAL_ALLOWED:
      return `
The knowledge base has limited coverage for this query.
You may use external tools (GitHub, etc.) to gather additional information.
Still check the provided context first - it may contain partial information.
`;

    case ROUTING_DECISION.EXTERNAL_REQUIRED:
      return `
This query requires real-time or external data.
Use appropriate external tools (GitHub, etc.) to fetch current information.
The knowledge base may not have the latest data for this type of query.
`;

    default:
      return "";
  }
};

/**
 * Create a routing-aware wrapper for tool invocation
 * Logs and tracks tool usage patterns
 * 
 * @param {Object} routingResult - Result from routeQuery
 * @returns {Function} Tool wrapper function
 */
const createToolWrapper = (routingResult) => {
  return (toolName, toolArgs, originalFn) => {
    const meta = getToolMetadata(toolName);
    
    // Log if external tool is being called despite RAG sufficiency
    if (!routingResult.useExternalTools && 
        (meta?.category === TOOL_CATEGORY.EXTERNAL_READ || 
         meta?.category === TOOL_CATEGORY.EXTERNAL_WRITE)) {
      console.warn(`⚠️ External tool '${toolName}' called despite RAG_ONLY routing`);
    }

    return originalFn(toolArgs);
  };
};

module.exports = {
  ROUTING_DECISION,
  checkRagSufficiency,
  determineRouting,
  routeQuery,
  filterToolsByRouting,
  getRoutingDirective,
  createToolWrapper,
};

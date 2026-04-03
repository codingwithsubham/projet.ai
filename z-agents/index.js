const { dynamicPmAgent } = require("./pmAgent");
const { dynamicGeneralAgent } = require("./generalAgent");
const { dynamicDevAgent } = require("./devAgent");

// Agent instance cache: avoids rebuilding LLM client + tools + graph per request
// Key: `${projectId}:${type}:${optionsHash}`, Value: { agent, createdAt }
const agentCache = new Map();
const AGENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const AGENT_CACHE_MAX_SIZE = 50;

/**
 * Create a dynamic agent based on type
 * Caches agent instances per (project, type, options) with 5-min TTL
 * 
 * @param {Object} project - Project object
 * @param {string} type - Agent type (PM, general, dev)
 * @param {Object} [options] - Agent options
 * @param {boolean} [options.includeExternalTools=true] - Include GitHub/external tools (dev agent only)
 * @param {boolean} [options.readOnlyMode=false] - Only read-only external tools (dev agent only)
 * @returns {Promise<Object>} LangGraph agent
 */
const createDynamicAgent = async (project, type, options = {}) => {
  const projectId = String(project._id);
  
  // PM agent with requester should not be cached (user-specific tools)
  const shouldSkipCache = type === "PM" && options.requester;
  
  const optionsKey = type === "dev" 
    ? `ext=${options.includeExternalTools !== false}&ro=${!!options.readOnlyMode}`
    : "default";
  const cacheKey = `${projectId}:${type}:${optionsKey}`;

  if (!shouldSkipCache) {
    const cached = agentCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`♻️ Reusing cached ${type} agent for project ${project.name}`);
      return cached.agent;
    }
  }

  let agent;
  if (type === "PM") {
    console.log(`\n🚀 Called: PM agent for project ${project.name}...`);
    agent = await dynamicPmAgent(project, options.requester);
  } else if (type === "general") {
    console.log(`\n🚀 Called: General agent for project ${project.name}...`);
    agent = await dynamicGeneralAgent(project);
  } else if (type === "dev") {
    console.log(`\n🚀 Called: Dev agent for project ${project.name}...`);
    agent = await dynamicDevAgent(project, options);
  } else {
    throw new Error(`Unknown agent type: ${type}`);
  }

  // Don't cache PM agents with requester (user-specific)
  if (!shouldSkipCache) {
    // Evict oldest entries if cache is full
    if (agentCache.size >= AGENT_CACHE_MAX_SIZE) {
      const oldestKey = agentCache.keys().next().value;
      agentCache.delete(oldestKey);
    }

    agentCache.set(cacheKey, {
      agent,
      expiresAt: Date.now() + AGENT_CACHE_TTL_MS,
    });
  }

  return agent;
};

module.exports = { createDynamicAgent };

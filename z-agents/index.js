const { dynamicPmAgent } = require("./pmAgent");
const { dynamicGeneralAgent } = require("./generalAgent");
const { dynamicDevAgent } = require("./devAgent");

/**
 * Create a dynamic agent based on type
 * 
 * @param {Object} project - Project object
 * @param {string} type - Agent type (PM, general, dev)
 * @param {Object} [options] - Agent options
 * @param {boolean} [options.includeExternalTools=true] - Include GitHub/external tools (dev agent only)
 * @param {boolean} [options.readOnlyMode=false] - Only read-only external tools (dev agent only)
 * @returns {Promise<Object>} LangGraph agent
 */
const createDynamicAgent = async (project, type, options = {}) => {
  if (type === "PM") {
    console.log(`\n🚀 Called: PM agent for project ${project.name}...`);
    return await dynamicPmAgent(project);
  } else if (type === "general") {
    console.log(`\n🚀 Called: General agent for project ${project.name}...`);
    return await dynamicGeneralAgent(project);
  } else if (type === "dev") {
    console.log(`\n🚀 Called: Dev agent for project ${project.name}...`);
    return await dynamicDevAgent(project, options);
  } else {
    throw new Error(`Unknown agent type: ${type}`);
  }
};

module.exports = { createDynamicAgent };

const { dynamicPmAgent } = require("./pmAgent");
const { dynamicGeneralAgent } = require("./generalAgent");
const { dynamicDevAgent } = require("./devAgent");

const createDynamicAgent = async (project, type) => {
  if (type === "PM") {
    console.log(`\n🚀 Called: PM agent for project ${project.name}...`);
    return await dynamicPmAgent(project);
  } else if (type === "general") {
    console.log(`\n🚀 Called: General agent for project ${project.name}...`);
    return await dynamicGeneralAgent(project);
  } else if (type === "dev") {
    console.log(`\n🚀 Called: Dev agent for project ${project.name}...`);
    return await dynamicDevAgent(project);
  } else {
    throw new Error(`Unknown agent type: ${type}`);
  }
};

module.exports = { createDynamicAgent };

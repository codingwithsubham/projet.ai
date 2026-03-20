const { MemorySaver } = require("@langchain/langgraph");

// Singleton checkpointer instance for all agents
// This maintains conversation state across agent invocations using thread_id
const checkpointer = new MemorySaver();

module.exports = { checkpointer };

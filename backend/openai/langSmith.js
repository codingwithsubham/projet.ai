const { Client } = require("langsmith");

// Initialize LangSmith client
const langsmithClient = new Client({
  apiUrl: process.env.LANGCHAIN_ENDPOINT,
  apiKey: process.env.LANGCHAIN_API_KEY,
});

// Verify LangSmith connection
async function verifyLangSmithConnection() {
  try {
    if (process.env.LANGCHAIN_TRACING_V2 === "true") {
      console.log("✅ LangSmith tracing enabled");
      console.log(`📊 Project: ${process.env.LANGCHAIN_PROJECT || "default"}`);
      return true;
    } else {
      console.log("⚠️ LangSmith tracing is disabled");
      return false;
    }
  } catch (error) {
    console.error("❌ LangSmith connection error:", error.message);
    return false;
  }
}

// Create a custom run for manual tracing
async function createRun(name, inputs, runType = "chain") {
  if (process.env.LANGCHAIN_TRACING_V2 !== "true") return null;

  try {
    const run = await langsmithClient.createRun({
      name,
      inputs,
      run_type: runType,
      project_name: process.env.LANGCHAIN_PROJECT,
    });
    return run;
  } catch (error) {
    console.error("Error creating LangSmith run:", error.message);
    return null;
  }
}

// Update a run with outputs
async function updateRun(runId, outputs, error = null) {
  if (!runId || process.env.LANGCHAIN_TRACING_V2 !== "true") return;

  try {
    await langsmithClient.updateRun(runId, {
      outputs,
      error: error ? error.message : undefined,
      end_time: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error updating LangSmith run:", err.message);
  }
}

module.exports = {
  langsmithClient,
  verifyLangSmithConnection,
  createRun,
  updateRun,
};
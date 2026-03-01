// Helper function to extract JSON from a string
const jsonMatch = (rawData) => {
  try {
    const jsonMatch = rawData.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      rawData = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Keep as string if not valid JSON
  }
  return rawData;
};

// Helper function to convert raw data to a string for display
const rawToString = (data) => {
  let jsonData = data;
  try {
    if (typeof data === "string") {
      // no change
    } else {
      jsonData = JSON.stringify(data, null, 2);
    }
  } catch (error) {
    console.log(
      "⚠️ rawToString: Failed to convert data to string, returning original data",
      error,
    );
  }
  return jsonData;
};

// Helper function to extract JSON from markdown code blocks
const matchJSONFromMarkdown = (str) => {
  return str.match(/```json\s*([\s\S]*?)\s*```/);
};

// Final response compiler
const compileResponseNode = async (state) => {
  console.log("📝 Compiling final response...");
  let finalResponse;

  if (state.error) {
    finalResponse = {
      status: "error",
      message: state.error.message || "An error occurred during processing.",
    };
    return { finalResponse: JSON.stringify(finalResponse) };
  }

  finalResponse = {
    status: "resolved",
    userQuery: state.query ? state.query : null,
    tableData: state.tableData ? state.tableData : null,
    chartData: state.chartData ? state.chartData : null,
    rawData: state.rawData ? state.rawData : null,
  };
  return { finalResponse };
};

// Conditional edge - check for errors
function shouldContinue(state) {
  if (state.error) {
    return "compile";
  }
  return "continue";
}

module.exports = {
  jsonMatch,
  rawToString,
  matchJSONFromMarkdown,
  compileResponseNode,
  shouldContinue,
};

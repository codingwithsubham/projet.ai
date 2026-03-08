const MIN_TOOL_CALLS_PER_RUN = 1;
const MAX_TOOL_CALLS_PER_RUN = 10;
const DEFAULT_TOOL_CALLS_PER_RUN = 8;

const clampNumber = (value, min, max) => {
  return Math.min(max, Math.max(min, value));
};

const stableStringify = (value) => {
  const seen = new WeakSet();

  const normalize = (input) => {
    if (input === null || typeof input !== "object") return input;
    if (seen.has(input)) return "[Circular]";
    seen.add(input);

    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }

    return Object.keys(input)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalize(input[key]);
        return acc;
      }, {});
  };

  try {
    return JSON.stringify(normalize(value));
  } catch (_error) {
    return String(value);
  }
};

const parseMaxToolCalls = () => {
  const parsed = Number.parseInt(process.env.AGENT_MAX_TOOL_CALLS || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TOOL_CALLS_PER_RUN;
  }

  return clampNumber(parsed, MIN_TOOL_CALLS_PER_RUN, MAX_TOOL_CALLS_PER_RUN);
};

const buildRepeatCallMessage = (toolName) => {
  return JSON.stringify({
    status: "skipped",
    reason: "tool_already_executed",
    tool: toolName,
    instruction:
      "This tool already completed once in the current agent run. Do not call it again; continue with final response using existing result.",
  });
};

const buildMaxCallMessage = (toolName, maxToolCalls) => {
  return JSON.stringify({
    status: "blocked",
    reason: "max_tool_calls_reached",
    tool: toolName,
    maxToolCalls,
    instruction:
      "Tool execution cap reached for this run. Stop calling tools and provide the best possible final response.",
  });
};

// Guard each tool so one successful execution per tool is allowed in a single run.
const guardToolsForSingleExecution = (tools = []) => {
  const maxToolCalls = parseMaxToolCalls();
  let totalToolCalls = 0;

  return tools.map((tool) => {
    if (!tool || typeof tool.invoke !== "function") {
      return tool;
    }

    if (tool.__singleExecutionGuardApplied) {
      return tool;
    }

    const toolName = String(tool.name || "unknown_tool");
    const originalInvoke = tool.invoke.bind(tool);
    let hasCompleted = false;
    const resultByInputFingerprint = new Map();

    Object.defineProperty(tool, "__singleExecutionGuardApplied", {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });

    tool.invoke = async (input, config) => {
      const fingerprint = stableStringify(input);

      if (resultByInputFingerprint.has(fingerprint)) {
        return resultByInputFingerprint.get(fingerprint);
      }

      if (hasCompleted) {
        return buildRepeatCallMessage(toolName);
      }

      if (totalToolCalls >= maxToolCalls) {
        return buildMaxCallMessage(toolName, maxToolCalls);
      }

      totalToolCalls += 1;

      const result = await originalInvoke(input, config);
      hasCompleted = true;
      resultByInputFingerprint.set(fingerprint, result);
      return result;
    };

    return tool;
  });
};

module.exports = {
  guardToolsForSingleExecution,
};

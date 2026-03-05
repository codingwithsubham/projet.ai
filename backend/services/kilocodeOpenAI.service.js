const kilocodeService = require("./kilocode.service");

const toText = (content) => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text" && part?.text) return String(part.text);
        if (part?.type === "input_text" && part?.text) return String(part.text);
        if (part?.value) return String(part.value);
        if (part?.content) return String(part.content);
        if (part?.text?.value) return String(part.text.value);
        if (part?.text) return String(part.text);
        return "";
      })
      .join("\n")
      .trim();
  }
  return String(content || "").trim();
};

const resolveProjectId = ({ body, model }) => {
  const fromBody =
    body?.projectId || body?.metadata?.projectId || body?.meta?.projectId;
  if (fromBody) return String(fromBody).trim();

  const modelText = String(model || "").trim();
  if (modelText.includes(":")) {
    const [, projectId] = modelText.split(":");
    if (projectId) return projectId.trim();
  }

  return (process.env.KILOCODE_DEFAULT_PROJECT_ID || "").trim();
};

const resolveModelId = (model) => {
  const value = String(model || "").trim();
  return value;
};

const stripEnvironmentDetails = (text) => {
  return String(text || "")
    .replace(/<environment_details>[\s\S]*?<\/environment_details>/gi, " ")
    .replace(/#\s*Current\s+Workspace\s+Directory[\s\S]*$/gi, " ")
    .trim();
};

const extractTaskTagContent = (text) => {
  const source = String(text || "");
  const matches = Array.from(source.matchAll(/<task>([\s\S]*?)<\/task>/gi));
  if (!matches.length) return "";

  const last = matches[matches.length - 1];
  return last?.[1] ? last[1].trim() : "";
};

const normalizeKiloUserPrompt = (rawText) => {
  const withoutEnv = stripEnvironmentDetails(rawText);
  const taskText = extractTaskTagContent(withoutEnv);
  const candidate = taskText || withoutEnv;

  return candidate
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const extractFeedbackTagContent = (text) => {
  const source = String(text || "");
  const matches = Array.from(
    source.matchAll(/<feedback>([\s\S]*?)<\/feedback>/gi),
  );
  if (!matches.length) return "";

  const last = matches[matches.length - 1];
  return last?.[1] ? last[1].trim() : "";
};

const isLowSignalText = (text) => {
  const clean = String(text || "")
    .trim()
    .toLowerCase();
  if (!clean) return true;

  const lowSignal = ["ok", "okay", "k", "thanks", "thank you", "done"];
  return lowSignal.includes(clean);
};

const extractUserMessage = (messages = []) => {
  if (!Array.isArray(messages)) return "";

  const isInternalLoopPrompt = (text) => {
    const clean = String(text || "")
      .trim()
      .toLowerCase();
    return (
      clean.startsWith("[error] you did not use a tool") ||
      clean.includes("did not use a tool in your previous response")
    );
  };

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role === "tool") {
      const feedback = extractFeedbackTagContent(toText(message.content));
      const normalizedFeedback = normalizeKiloUserPrompt(feedback);
      if (normalizedFeedback && !isLowSignalText(normalizedFeedback)) {
        return normalizedFeedback;
      }
      continue;
    }

    if (message?.role === "user") {
      const text = toText(message.content);
      if (isInternalLoopPrompt(text)) {
        continue;
      }

      const normalized = normalizeKiloUserPrompt(text);
      if (normalized && !isLowSignalText(normalized)) {
        return normalized;
      }
    }
  }
  return "";
};

const makeCompletionId = () => `chatcmpl_${Date.now()}`;

const buildNonStreamResponse = ({ model, text }) => ({
  id: makeCompletionId(),
  object: "chat.completion",
  created: Math.floor(Date.now() / 1000),
  model,
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: text,
      },
      finish_reason: "stop",
    },
  ],
});

const resolveAgentType = (model) => {
  return model.split("-")[1] || "general";
};

const listModels = (_req) => {
  const created = Math.floor(Date.now() / 1000);
  const agentType = _req?.keyData?.role || "default";
  const modelKey = _req?.keyData?.project || "default";
  const model = `aidlc-${agentType}-agent:${modelKey}`;
  const modelIds = [model];

  return {
    object: "list",
    data: modelIds.map((id) => ({
      id,
      object: "model",
      created,
      owned_by: "aidlc",
    })),
  };
};

const invokeCompletion = async ({ body }) => {
  const model = resolveModelId(body?.model);
  const projectId = resolveProjectId({ body, model });
  const agentType = resolveAgentType(model);
  const userMessage = extractUserMessage(body?.messages);
  const sessionId = "";

  const result = await kilocodeService.invokeAgentForKilocode({
    projectId,
    message: userMessage,
    sessionId,
    agentType,
    meta: {
      source: "kilocode-openai-compatible",
      requestModel: model,
      ...(body?.metadata || {}),
    },
  });

  return {
    model,
    projectId,
    sessionId,
    userMessage,
    result,
    agentType,
    response: result
      ? buildNonStreamResponse({ model, text: result.response })
      : null,
  };
};

const streamCompletion = async ({ body, onStart, onToken, onDone }) => {
  const model = resolveModelId(body?.model);
  const projectId = resolveProjectId({ body, model });
  const agentType = resolveAgentType(model);
  const userMessage = extractUserMessage(body?.messages);
  const sessionId = "";

  const result = await kilocodeService.streamAgentForKilocode({
    projectId,
    message: userMessage,
    sessionId,
    agentType,
    meta: {
      source: "kilocode-openai-compatible",
      requestModel: model,
      ...(body?.metadata || {}),
    },
    onStart,
    onToken,
    onDone,
  });

  return {
    model,
    projectId,
    agentType,
    sessionId,
    userMessage,
    result,
  };
};

module.exports = {
  resolveProjectId,
  resolveAgentType,
  extractUserMessage,
  listModels,
  invokeCompletion,
  streamCompletion,
};

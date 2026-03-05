const mongoose = require("mongoose");
const kilocodeOpenAIService = require("../services/kilocodeOpenAI.service");

const writeOpenAiError = (res, status, message, type = "invalid_request_error") => {
  return res.status(status).json({
    error: {
      message,
      type,
      code: null,
    },
  });
};

const pickCompletionTool = (tools = []) => {
  const normalized = tools
    .map((item) => item?.function?.name)
    .filter((name) => typeof name === "string" && name.trim());

  if (!normalized.length) return null;
  if (normalized.includes("attempt_completion")) return "attempt_completion";
  if (normalized.includes("final_answer")) return "final_answer";
  if (normalized.includes("ask_followup_question")) return "ask_followup_question";
  return normalized[0];
};

const buildToolArguments = (toolName, text) => {
  if (toolName === "attempt_completion" || toolName === "final_answer") {
    return JSON.stringify({ result: text });
  }
  if (toolName === "ask_followup_question") {
    return JSON.stringify({ question: text || "Could you share a bit more detail?" });
  }
  return JSON.stringify({ text });
};

const buildToolCallResponse = ({ model, toolName, text }) => ({
  id: `chatcmpl_${Date.now()}`,
  object: "chat.completion",
  created: Math.floor(Date.now() / 1000),
  model,
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: `call_${Date.now()}`,
            type: "function",
            function: {
              name: toolName,
              arguments: buildToolArguments(toolName, text),
            },
          },
        ],
      },
      finish_reason: "tool_calls",
    },
  ],
});

const streamToolCallResponse = ({ res, model, toolName, text }) => {
  const completionId = `chatcmpl_${Date.now()}`;
  const toolCallId = `call_${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  const writeChunk = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  writeChunk({
    id: completionId,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [
      {
        index: 0,
        delta: {
          role: "assistant",
          tool_calls: [
            {
              index: 0,
              id: toolCallId,
              type: "function",
              function: {
                name: toolName,
                arguments: "",
              },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  });

  writeChunk({
    id: completionId,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              index: 0,
              function: {
                arguments: buildToolArguments(toolName, text),
              },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  });

  writeChunk({
    id: completionId,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
  });

  res.write("data: [DONE]\n\n");
  return res.end();
};

const listModels = async (_req, res) => {
  return res.status(200).json(kilocodeOpenAIService.listModels(_req));
};

const createChatCompletion = async (req, res) => {
  try {
    const body = req.body || {};
    const messages = body.messages;

    const hasTools = Array.isArray(body.tools) && body.tools.length > 0;

    if (!Array.isArray(messages) || !messages.length) {
      return writeOpenAiError(res, 400, "messages is required and must be a non-empty array");
    }

    const projectId = kilocodeOpenAIService.resolveProjectId({ body, model: body.model });
    if (!projectId) {
      return writeOpenAiError(
        res,
        400,
        "projectId is required (send metadata.projectId or set KILOCODE_DEFAULT_PROJECT_ID)"
      );
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return writeOpenAiError(res, 400, "Invalid projectId");
    }

    const message = kilocodeOpenAIService.extractUserMessage(messages);
    if (!message) {
      return writeOpenAiError(res, 400, "At least one user message with text content is required");
    }

    const isStream = Boolean(body.stream);
    if (!isStream) {
      const completion = await kilocodeOpenAIService.invokeCompletion({ body });
      if (!completion.result) {
        return writeOpenAiError(res, 404, "Project not found", "not_found_error");
      }

      if (hasTools) {
        const selectedTool = pickCompletionTool(body.tools);
        if (selectedTool) {
          return res
            .status(200)
            .json(
              buildToolCallResponse({
                model: completion.model,
                toolName: selectedTool,
                text: completion.result.response,
              })
            );
        }
      }

      return res.status(200).json(completion.response);
    }

    if (hasTools) {
      const completion = await kilocodeOpenAIService.invokeCompletion({ body });
      if (!completion.result) {
        return writeOpenAiError(res, 404, "Project not found", "not_found_error");
      }

      const selectedTool = pickCompletionTool(body.tools);
      if (!selectedTool) {
        return writeOpenAiError(res, 400, "No callable tool found", "unsupported_feature");
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      return streamToolCallResponse({
        res,
        model: completion.model,
        toolName: selectedTool,
        text: completion.result.response,
      });
    }

    const completionId = `chatcmpl_${Date.now()}`;
    const model = String(body.model);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const writeChunk = (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const streamResult = await kilocodeOpenAIService.streamCompletion({
      body,
      onStart: () => {
        writeChunk({
          id: completionId,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
        });
      },
      onToken: ({ chunk }) => {
        writeChunk({
          id: completionId,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
        });
      },
      onDone: () => {
        writeChunk({
          id: completionId,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        });
      },
    });

    if (!streamResult.result) {
      writeChunk({
        error: {
          message: "Project not found",
          type: "not_found_error",
          code: null,
        },
      });
      res.write("data: [DONE]\n\n");
      return res.end();
    }

    res.write("data: [DONE]\n\n");
    return res.end();
  } catch (error) {
    if (!res.headersSent) {
      return writeOpenAiError(res, 500, "Failed to process completion", "server_error");
    }

    res.write(
      `data: ${JSON.stringify({
        error: {
          message: "Failed to process completion",
          type: "server_error",
          code: null,
        },
      })}\n\n`
    );
    res.write("data: [DONE]\n\n");
    return res.end();
  }
};

module.exports = { listModels, createChatCompletion };
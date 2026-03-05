const chatService = require("./chat.service");

const invokeAgentForKilocode = async ({ projectId, message, sessionId, meta }) => {
  const data = await chatService.sendChatMessageToPMAgent({ projectId, message, sessionId });
  if (!data) return null;

  return {
    channel: "kilocode",
    ...data,
    meta: {
      source: "kilocode-extension",
      timestamp: new Date().toISOString(),
      ...(meta || {}),
    },
  };
};

const streamAgentForKilocode = async ({
  projectId,
  message,
  sessionId,
  meta,
  onStart,
  onToken,
  onDone,
}) => {
  const result = await invokeAgentForKilocode({
    projectId,
    message,
    sessionId,
    meta,
  });

  if (!result) return null;

  if (typeof onStart === "function") {
    onStart({ sessionId: result.sessionId });
  }

  const text = String(result.response || "");
  const chunkSize = 80;
  for (let index = 0; index < text.length; index += chunkSize) {
    const chunk = text.slice(index, index + chunkSize);
    if (typeof onToken === "function" && chunk) {
      onToken({
        chunk,
        index: Math.floor(index / chunkSize),
      });
    }
  }

  if (typeof onDone === "function") {
    onDone({
      totalChars: text.length,
    });
  }

  return result;
};

module.exports = { invokeAgentForKilocode, streamAgentForKilocode };
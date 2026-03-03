const { z } = require("zod");

const KILOCODE_CONTRACT_VERSION = "2026-03-02";

const kilocodeMetaSchema = z.record(z.string(), z.unknown()).optional();

const kilocodeChatRequestSchema = z.object({
  projectId: z.string().trim().min(1, "projectId is required"),
  message: z.string().trim().min(1, "message is required"),
  sessionId: z.string().trim().min(1).optional(),
  requestId: z.string().trim().min(1).optional(),
  meta: kilocodeMetaSchema,
});

const normalizeKilocodeChatResponse = (result, requestId) => ({
  contractVersion: KILOCODE_CONTRACT_VERSION,
  channel: "kilocode",
  requestId: requestId || null,
  projectId: result.projectId,
  sessionId: result.sessionId,
  reply: result.response,
  chats: result.chats || [],
  meta: result.meta || {},
});

const kilocodeCapabilities = {
  contractVersion: KILOCODE_CONTRACT_VERSION,
  endpoints: {
    health: "/api/v1/kilocode/health",
    capabilities: "/api/v1/kilocode/capabilities",
    chat: "/api/v1/kilocode/agent/chat",
    chatStream: "/api/v1/kilocode/agent/chat/stream",
  },
  auth: {
    type: "api-key",
    headers: ["x-kilocode-key", "authorization: Bearer <key>"],
  },
  features: {
    streaming: true,
    streamingMode: "sse-chunked",
    chatHistoryIncluded: true,
  },
};

module.exports = {
  KILOCODE_CONTRACT_VERSION,
  kilocodeChatRequestSchema,
  normalizeKilocodeChatResponse,
  kilocodeCapabilities,
};
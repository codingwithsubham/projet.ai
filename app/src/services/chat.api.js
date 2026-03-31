import apiClient from "./apiClient";
import { getAuthToken } from "./auth.storage";

const API_BASE = process.env.REACT_APP_API_URL || "";

export const sendChatApi = async (projectId, message, sessionId) => {
  const response = await apiClient.post(`/chats/${projectId}`, { message, sessionId });
  return response.data;
};

/**
 * SSE streaming chat API using native fetch.
 * Calls onStatus / onToken / onCached / onDone / onError callbacks.
 */
export const streamChatApi = async (
  projectId,
  message,
  sessionId,
  { onStatus, onToken, onCached, onDone, onError, signal },
) => {
  const token = getAuthToken();
  const url = `${API_BASE}/api/v1/chats/${projectId}/stream`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, sessionId }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Stream request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const payload = trimmed.slice(6);
      if (payload === "[DONE]") return;

      try {
        const event = JSON.parse(payload);
        switch (event.type) {
          case "status":
            onStatus?.(event.data);
            break;
          case "token":
            onToken?.(event.data);
            break;
          case "cached":
            onCached?.(event.data);
            break;
          case "done":
            onDone?.(event.data);
            break;
          case "error":
            onError?.(event.data);
            break;
          default:
            break;
        }
      } catch (_) {
        // skip malformed JSON
      }
    }
  }
};

export const getChatHistoryApi = async (projectId, sessionId) => {
  const response = await apiClient.get(`/chats/${projectId}/history`, {
    params: sessionId ? { sessionId } : {},
  });
  return response.data;
};

export const getChatSessionsApi = async (projectId) => {
  const response = await apiClient.get(`/chats/${projectId}/sessions`);
  return response.data;
};

export const createChatSessionApi = async (projectId, title = "New Chat") => {
  const response = await apiClient.post(`/chats/${projectId}/sessions`, { title });
  return response.data;
};

export const deleteChatSessionApi = async (projectId, sessionId) => {
  const response = await apiClient.delete(`/chats/${projectId}/sessions/${sessionId}`);
  return response.data;
};
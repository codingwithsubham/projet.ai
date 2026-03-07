import apiClient from "./apiClient";

export const sendChatApi = async (projectId, message, sessionId) => {
  const response = await apiClient.post(`/chats/${projectId}`, { message, sessionId });
  return response.data;
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
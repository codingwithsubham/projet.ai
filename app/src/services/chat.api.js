import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

export const sendChatApi = async (projectId, message, sessionId) => {
  const response = await axios.post(`${API_BASE}/api/v1/chats/${projectId}`, { message, sessionId });
  return response.data;
};

export const getChatHistoryApi = async (projectId, sessionId) => {
  const response = await axios.get(`${API_BASE}/api/v1/chats/${projectId}/history`, {
    params: sessionId ? { sessionId } : {},
  });
  return response.data;
};

export const getChatSessionsApi = async (projectId) => {
  const response = await axios.get(`${API_BASE}/api/v1/chats/${projectId}/sessions`);
  return response.data;
};

export const createChatSessionApi = async (projectId, title = "New Chat") => {
  const response = await axios.post(`${API_BASE}/api/v1/chats/${projectId}/sessions`, { title });
  return response.data;
};
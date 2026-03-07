import apiClient from "./apiClient";

export const getApiKeysApi = async () => {
  const response = await apiClient.get("/api-keys");
  return response.data;
};

export const createApiKeyApi = async (payload) => {
  const response = await apiClient.post("/api-keys", payload);
  return response.data;
};

export const updateApiKeyApi = async (id, payload) => {
  const response = await apiClient.put(`/api-keys/${id}`, payload);
  return response.data;
};

export const revokeApiKeyApi = async (id) => {
  const response = await apiClient.patch(`/api-keys/${id}/revoke`);
  return response.data;
};

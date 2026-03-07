import apiClient from "./apiClient";

export const getUsersApi = async () => {
  const response = await apiClient.get("/users");
  return response.data;
};

export const createUserApi = async (payload) => {
  const response = await apiClient.post("/users", payload);
  return response.data;
};

export const updateUserApi = async (id, payload) => {
  const response = await apiClient.put(`/users/${id}`, payload);
  return response.data;
};

export const deleteUserApi = async (id) => {
  const response = await apiClient.delete(`/users/${id}`);
  return response.data;
};

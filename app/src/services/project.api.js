import apiClient from "./apiClient";

export const getProjectsApi = async () => {
  const response = await apiClient.get("/projects");
  return response.data;
};

export const getProjectByIdApi = async (id) => {
  const response = await apiClient.get(`/projects/${id}`);
  return response.data;
};

export const createProjectApi = async (payload) => {
  const response = await apiClient.post("/projects", payload);
  return response.data;
};

export const updateProjectApi = async (id, payload) => {
  const response = await apiClient.put(`/projects/${id}`, payload);
  return response.data;
};

export const deleteProjectApi = async (id) => {
  const response = await apiClient.delete(`/projects/${id}`);
  return response.data;
};

export const saveProjectRepoApi = async (id, repolink) => {
  const response = await apiClient.patch(`/projects/${id}/repo`, { repolink });
  return response.data;
};

export const saveProjectPatTokenApi = async (id, pat_token) => {
  const response = await apiClient.patch(`/projects/${id}/pat-token`, { pat_token });
  return response.data;
};
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

// ============ Repository Management APIs ============

export const getRepositoriesApi = async (projectId) => {
  const response = await apiClient.get(`/projects/${projectId}/repositories`);
  return response.data;
};

export const addRepositoryApi = async (projectId, repoData) => {
  const response = await apiClient.post(`/projects/${projectId}/repositories`, repoData);
  return response.data;
};

export const updateRepositoryApi = async (projectId, repoId, repoData) => {
  const response = await apiClient.put(`/projects/${projectId}/repositories/${repoId}`, repoData);
  return response.data;
};

export const deleteRepositoryApi = async (projectId, repoId) => {
  const response = await apiClient.delete(`/projects/${projectId}/repositories/${repoId}`);
  return response.data;
};

export const getRepositoryApi = async (projectId, repoId) => {
  const response = await apiClient.get(`/projects/${projectId}/repositories/${repoId}`);
  return response.data;
};

// ============ Board Configuration APIs ============

export const getBoardConfigApi = async (projectId) => {
  const response = await apiClient.get(`/projects/${projectId}/board-config`);
  return response.data;
};

export const saveBoardConfigApi = async (projectId, config) => {
  const response = await apiClient.patch(`/projects/${projectId}/board-config`, config);
  return response.data;
};
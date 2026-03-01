import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

export const getProjectsApi = async () => {
  const response = await axios.get(`${API_BASE}/api/v1/projects`);
  return response.data;
};

export const getProjectByIdApi = async (id) => {
  const response = await axios.get(`${API_BASE}/api/v1/projects/${id}`);
  return response.data;
};

export const createProjectApi = async (payload) => {
  const response = await axios.post(`${API_BASE}/api/v1/projects`, payload);
  return response.data;
};

export const updateProjectApi = async (id, payload) => {
  const response = await axios.put(`${API_BASE}/api/v1/projects/${id}`, payload);
  return response.data;
};

export const deleteProjectApi = async (id) => {
  const response = await axios.delete(`${API_BASE}/api/v1/projects/${id}`);
  return response.data;
};

export const saveProjectRepoApi = async (id, repolink) => {
  const response = await axios.patch(`${API_BASE}/api/v1/projects/${id}/repo`, { repolink });
  return response.data;
};

export const saveProjectPatTokenApi = async (id, pat_token) => {
  const response = await axios.patch(`${API_BASE}/api/v1/projects/${id}/pat-token`, { pat_token });
  return response.data;
};
import apiClient from "./apiClient";

export const uploadKnowledgeDocumentApi = async (formData) => {
  const response = await apiClient.post("/knowledgebase/documents", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getKnowledgeDocumentsByProjectApi = async (projectId) => {
  const response = await apiClient.get(`/knowledgebase/documents/project/${projectId}`);
  return response.data;
};

export const analyzeKnowledgeDocumentApi = async (docId) => {
  const response = await apiClient.post(`/knowledgebase/documents/${docId}/analyze`);
  return response.data;
};

export const analyzeKnowledgeRepositoryApi = async (projectId, repoId = null) => {
  const response = await apiClient.post(`/knowledgebase/projects/${projectId}/analyze-repo`, {
    repoId,
  });
  return response.data;
};

/**
 * Get sync status for a project (latest sync of given type)
 * @param {string} projectId 
 * @param {string} [type="codebase"] 
 */
export const getSyncStatusByProjectApi = async (projectId, type = "codebase") => {
  const response = await apiClient.get(`/knowledgebase/sync-status/project/${projectId}`, {
    params: { type },
  });
  return response.data;
};

/**
 * Get sync status by sync ID
 * @param {string} syncId 
 */
export const getSyncStatusByIdApi = async (syncId) => {
  const response = await apiClient.get(`/knowledgebase/sync-status/${syncId}`);
  return response.data;
};

/**
 * Get sync history for a project
 * @param {string} projectId 
 * @param {number} [limit=10] 
 */
export const getSyncHistoryApi = async (projectId, limit = 10) => {
  const response = await apiClient.get(`/knowledgebase/sync-history/project/${projectId}`, {
    params: { limit },
  });
  return response.data;
};
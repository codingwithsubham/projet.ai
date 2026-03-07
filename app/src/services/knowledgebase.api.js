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

export const analyzeKnowledgeRepositoryApi = async (projectId) => {
  const response = await apiClient.post(`/knowledgebase/projects/${projectId}/analyze-repo`);
  return response.data;
};
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

export const uploadKnowledgeDocumentApi = async (formData) => {
  const response = await axios.post(`${API_BASE}/api/v1/knowledgebase/documents`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getKnowledgeDocumentsByProjectApi = async (projectId) => {
  const response = await axios.get(
    `${API_BASE}/api/v1/knowledgebase/documents/project/${projectId}`
  );
  return response.data;
};

export const analyzeKnowledgeDocumentApi = async (docId) => {
  const response = await axios.post(`${API_BASE}/api/v1/knowledgebase/documents/${docId}/analyze`);
  return response.data;
};

export const analyzeKnowledgeRepositoryApi = async (projectId) => {
  const response = await axios.post(
    `${API_BASE}/api/v1/knowledgebase/projects/${projectId}/analyze-repo`
  );
  return response.data;
};
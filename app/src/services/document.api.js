import apiClient from "./apiClient";

export const createDocument = (payload) =>
  apiClient.post("/documents", payload);

export const getDocuments = () =>
  apiClient.get("/documents");

export const getDocumentById = (id) =>
  apiClient.get(`/documents/${id}`);

export const searchDocuments = (search, startDate, endDate) => {
  const params = {};
  if (search) params.search = search;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  return apiClient.get("/documents/search", { params });
};

export const deleteDocument = (id) =>
  apiClient.delete(`/documents/${id}`);

export default {
  createDocument,
  getDocuments,
  getDocumentById,
  searchDocuments,
  deleteDocument,
};

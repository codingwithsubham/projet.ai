import { useCallback, useEffect, useState } from "react";
import { getAuthUser } from "../services/auth.storage";
import * as documentAPI from "../services/document.api";

const initialForm = {
  name: "",
  prompt: "",
  projectId: "",
  description: "",
};

export const useDocument = () => {
  const currentUser = getAuthUser();
  const isPM = String(currentUser?.role || "") === "PM";
  const isAdmin = String(currentUser?.role || "") === "admin";

  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState(null);

  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedDocumentLoading, setSelectedDocumentLoading] = useState(false);

  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState({ startDate: null, endDate: null });

  const fetchDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const response = await documentAPI.getDocuments();
      const data = response.data || response;
      setDocuments(data.data || []);
    } catch (error) {
      setDocumentsError(error.message || "Failed to fetch documents");
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  const searchDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const response = await documentAPI.searchDocuments(
        searchTerm,
        filterDate.startDate,
        filterDate.endDate
      );
      const data = response.data || response;
      setDocuments(data.data || []);
    } catch (error) {
      setDocumentsError(error.message || "Failed to search documents");
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  }, [searchTerm, filterDate]);

  const getDocumentById = useCallback(async (id) => {
    setSelectedDocumentLoading(true);
    try {
      const response = await documentAPI.getDocumentById(id);
      const data = response.data || response;
      setSelectedDocument(data.data);
    } catch (error) {
      console.error("Failed to fetch document:", error);
      setSelectedDocument(null);
    } finally {
      setSelectedDocumentLoading(false);
    }
  }, []);

  const createDocument = useCallback(async (payload) => {
    setActionLoading(true);
    setFormErrors({});
    try {
      const response = await documentAPI.createDocument({
        name: payload.name,
        prompt: payload.prompt,
        projectId: payload.projectId,
        description: payload.description || "",
      });
      const data = response.data || response;

      if (data.success) {
        setFormData(initialForm);
        return { success: true, documentId: data.data?.documentId, message: data.message };
      }

      return { success: false, error: data.message || "Failed to create document" };
    } catch (error) {
      return { success: false, error: error.message || "An error occurred" };
    } finally {
      setActionLoading(false);
    }
  }, []);

  const deleteDocument = useCallback(async (id) => {
    setActionLoading(true);
    try {
      const response = await documentAPI.deleteDocument(id);
      const data = response.data || response;

      if (data.success) {
        await fetchDocuments();
        return { success: true };
      }

      return { success: false, error: data.message || "Failed to delete document" };
    } catch (error) {
      return { success: false, error: error.message || "An error occurred" };
    } finally {
      setActionLoading(false);
    }
  }, [fetchDocuments]);

  useEffect(() => {
    if (documents.length === 0 && (isPM || isAdmin)) {
      fetchDocuments();
    }
  }, []);

  return {
    documents,
    documentsLoading,
    documentsError,
    selectedDocument,
    selectedDocumentLoading,
    formData,
    formErrors,
    actionLoading,
    searchTerm,
    filterDate,

    setDocuments,
    setFormData,
    setFormErrors,
    setSearchTerm,
    setFilterDate,
    setSelectedDocument,

    fetchDocuments,
    searchDocuments,
    getDocumentById,
    createDocument,
    deleteDocument,

    isPM,
    isAdmin,
    canAccess: isPM || isAdmin,
  };
};

export default useDocument;

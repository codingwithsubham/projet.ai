import { useCallback, useEffect, useState } from "react";
import { useAppData } from "../context/AppDataContext";
import {
  uploadKnowledgeDocumentApi,
  getKnowledgeDocumentsByProjectApi,
  analyzeKnowledgeDocumentApi,
  analyzeKnowledgeRepositoryApi,
} from "../services/knowledgebase.api";

export const useKnowledgebase = (projectId) => {
  const { getProjectById, saveProjectRepo, saveProjectPatToken } = useAppData();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzingDocId, setAnalyzingDocId] = useState("");
  const [error, setError] = useState("");
  const [docLink, setDocLink] = useState("");

  const [uiMessage, setUiMessage] = useState(null);
  const [analyzePromptDoc, setAnalyzePromptDoc] = useState(null);

  const [repoLinkInput, setRepoLinkInput] = useState("");
  const [savedRepoLink, setSavedRepoLink] = useState("");
  const [repoLoading, setRepoLoading] = useState(false);

  const [patTokenInput, setPatTokenInput] = useState("");
  const [savedPatToken, setSavedPatToken] = useState("");
  const [patLoading, setPatLoading] = useState(false);
  const [isPatEditing, setIsPatEditing] = useState(false);

  const maskPat = useCallback((token = "") => {
    const val = String(token || "");
    if (!val) return "";
    if (val.length <= 8) return "********";
    return `${val.slice(0, 4)}********${val.slice(-4)}`;
  }, []);

  const fetchDocs = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError("");

    try {
      const res = await getKnowledgeDocumentsByProjectApi(projectId);
      setDocs(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadProjectRepo = useCallback(async () => {
    if (!projectId) return;

    const res = await getProjectById(projectId);
    if (!res?.ok) return;

    const existingRepo = res?.data?.repolink || "";
    const existingPat = res?.data?.pat_token || "";

    setSavedRepoLink(existingRepo);
    setRepoLinkInput(existingRepo);

    setSavedPatToken(existingPat);
    setPatTokenInput(existingPat ? maskPat(existingPat) : "");
    setIsPatEditing(false);
  }, [getProjectById, maskPat, projectId]);

  useEffect(() => {
    fetchDocs();
    loadProjectRepo();
  }, [fetchDocs, loadProjectRepo]);

  const saveRepoLink = useCallback(async () => {
    if (!projectId) return { ok: false, error: "Invalid project id" };
    if (!repoLinkInput.trim()) {
      setUiMessage({ type: "error", text: "Repository link is required" });
      return { ok: false };
    }

    setRepoLoading(true);
    const res = await saveProjectRepo(projectId, repoLinkInput.trim());
    setRepoLoading(false);

    if (!res.ok) {
      setUiMessage({ type: "error", text: res.error || "Failed to save repository link" });
      return res;
    }

    const link = res?.data?.repolink || repoLinkInput.trim();
    setSavedRepoLink(link);
    setRepoLinkInput(link);
    setUiMessage({ type: "success", text: "Repository link saved successfully" });
    return { ok: true, data: res.data };
  }, [projectId, repoLinkInput, saveProjectRepo]);

  const analyzeRepo = useCallback(async () => {
    if (!projectId) return { ok: false, error: "Invalid project id" };
    if (!savedRepoLink) {
      setUiMessage({ type: "error", text: "Save repository link first" });
      return { ok: false };
    }

    try {
      setRepoLoading(true);
      const res = await analyzeKnowledgeRepositoryApi(projectId);
      setUiMessage({
        type: "success",
        text: res?.message || "Repository analysis started",
      });
      return { ok: true, data: res?.data };
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || "Failed to analyze repository";
      setUiMessage({ type: "error", text: message });
      return { ok: false, error: message };
    } finally {
      setRepoLoading(false);
    }
  }, [projectId, savedRepoLink]);

  const analyzeDoc = useCallback(async (docId) => {
    try {
      setAnalyzingDocId(docId);
      const res = await analyzeKnowledgeDocumentApi(docId);
      const updated = res?.data;
      if (updated?._id) {
        setDocs((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err?.response?.data?.message || err?.message || "Analyze failed",
      };
    } finally {
      setAnalyzingDocId("");
    }
  }, []);

  const uploadFiles = useCallback(async (fileList) => {
    if (!projectId || !fileList?.length) return;
    setUploading(true);
    setError("");
    setUiMessage(null);

    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("document", file);
        formData.append("projectId", projectId);

        const res = await uploadKnowledgeDocumentApi(formData);
        const created = res?.data;
        if (created?._id) {
          setDocs((prev) => [created, ...prev]);
          setAnalyzePromptDoc(created); // show UI prompt instead of window.confirm
        }
      }

      setUiMessage({ type: "success", text: "Document uploaded successfully." });
      return { ok: true };
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Upload failed";
      setError(message);
      setUiMessage({ type: "error", text: message });
      return { ok: false, error: message };
    } finally {
      setUploading(false);
    }
  }, [projectId]);

  const analyzePromptNow = useCallback(async () => {
    if (!analyzePromptDoc?._id) return;
    const result = await analyzeDoc(analyzePromptDoc._id);

    if (result.ok) {
      setUiMessage({ type: "success", text: `"${analyzePromptDoc.fileName}" analyzed.` });
    } else {
      setUiMessage({ type: "error", text: result.error || "Analyze failed" });
    }

    setAnalyzePromptDoc(null);
  }, [analyzeDoc, analyzePromptDoc]);

  const analyzePromptLater = useCallback(() => {
    setAnalyzePromptDoc(null);
    setUiMessage({ type: "info", text: "You can analyze this document later from the list." });
  }, []);

  const onSubmitDocLink = useCallback(() => {
    if (!docLink.trim()) return;
    // UI feedback instead of window.alert
    setUiMessage({ type: "info", text: "Document link ingestion API will be added next." });
  }, [docLink]);

  const clearUiMessage = useCallback(() => setUiMessage(null), []);

  const startEditPat = useCallback(() => {
    setIsPatEditing(true);
    setPatTokenInput("");
  }, []);

  const savePatToken = useCallback(async () => {
    if (!projectId) return { ok: false, error: "Invalid project id" };
    if (!patTokenInput.trim()) {
      setUiMessage({ type: "error", text: "PAT token is required" });
      return { ok: false };
    }

    setPatLoading(true);
    const res = await saveProjectPatToken(projectId, patTokenInput.trim());
    setPatLoading(false);

    if (!res.ok) {
      setUiMessage({ type: "error", text: res.error || "Failed to save PAT token" });
      return res;
    }

    const saved = res?.data?.pat_token || patTokenInput.trim();
    setSavedPatToken(saved);
    setPatTokenInput(maskPat(saved));
    setIsPatEditing(false);
    setUiMessage({ type: "success", text: "PAT token saved successfully" });
    return { ok: true, data: res.data };
  }, [maskPat, patTokenInput, projectId, saveProjectPatToken]);

  return {
    docs,
    loading,
    uploading,
    analyzingDocId,
    error,
    docLink,
    setDocLink,
    fetchDocs,
    uploadFiles,
    analyzeDoc,
    onSubmitDocLink,

    // NEW exports
    uiMessage,
    clearUiMessage,
    analyzePromptDoc,
    analyzePromptNow,
    analyzePromptLater,
    repoLinkInput,
    setRepoLinkInput,
    savedRepoLink,
    repoLoading,
    saveRepoLink,
    analyzeRepo,

    // PAT token exports
    patTokenInput,
    setPatTokenInput,
    savedPatToken,
    patLoading,
    isPatEditing,
    startEditPat,
    savePatToken,
  };
};
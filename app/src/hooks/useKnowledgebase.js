import { useCallback, useEffect, useState, useRef } from "react";
import { useAppData } from "../context/AppDataContext";
import {
  uploadKnowledgeDocumentApi,
  getKnowledgeDocumentsByProjectApi,
  analyzeKnowledgeDocumentApi,
  analyzeKnowledgeRepositoryApi,
  getSyncStatusByIdApi,
  getSyncStatusByProjectApi,
} from "../services/knowledgebase.api";

export const useKnowledgebase = (projectId) => {
  const {
    getProjectById,
    saveProjectRepo,
    saveProjectPatToken,
    addRepository: addRepoToContext,
    updateRepository: updateRepoInContext,
    deleteRepository: deleteRepoFromContext,
  } = useAppData();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzingDocId, setAnalyzingDocId] = useState("");
  const [error, setError] = useState("");
  const [docLink, setDocLink] = useState("");

  const [uiMessage, setUiMessage] = useState(null);
  const [analyzePromptDoc, setAnalyzePromptDoc] = useState(null);

  // Legacy single repo support (backward compatibility)
  const [repoLinkInput, setRepoLinkInput] = useState("");
  const [savedRepoLink, setSavedRepoLink] = useState("");
  const [repoLoading, setRepoLoading] = useState(false);
  const [isRepoEditing, setIsRepoEditing] = useState(false);

  // Multi-repository support
  const [repositories, setRepositories] = useState([]);
  const [repoFormData, setRepoFormData] = useState({ identifier: "", repolink: "", tag: "backend" });
  const [editingRepoId, setEditingRepoId] = useState(null);
  const [repoActionLoading, setRepoActionLoading] = useState(false);
  const [analyzingRepoId, setAnalyzingRepoId] = useState(null);

  const [patTokenInput, setPatTokenInput] = useState("");
  const [savedPatToken, setSavedPatToken] = useState("");
  const [patLoading, setPatLoading] = useState(false);
  const [isPatEditing, setIsPatEditing] = useState(false);

  // Sync status state for async repository analysis
  const [syncStatus, setSyncStatus] = useState(null);
  const [repoSyncStatuses, setRepoSyncStatuses] = useState({});
  const pollIntervalRef = useRef(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

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
    const existingRepos = Array.isArray(res?.data?.repositories) ? res.data.repositories : [];

    setSavedRepoLink(existingRepo);
    setRepoLinkInput(existingRepo);
    setRepositories(existingRepos);

    setSavedPatToken(existingPat);
    setPatTokenInput(existingPat ? maskPat(existingPat) : "");
    setIsPatEditing(false);
  }, [getProjectById, maskPat, projectId]);

  // Load existing sync status on mount
  const loadSyncStatus = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await getSyncStatusByProjectApi(projectId, "codebase");
      const data = res?.data;
      
      if (data) {
        setSyncStatus({
          syncId: data.syncId,
          status: data.status,
          progress: data.progress || { currentStep: "", percentage: 0 },
          stats: data.stats,
          error: data.error,
        });

        // If sync is in progress, start polling
        if (data.status === "pending" || data.status === "in_progress") {
          setRepoLoading(true);
          pollIntervalRef.current = setInterval(async () => {
            try {
              const statusRes = await getSyncStatusByIdApi(data.syncId);
              const statusData = statusRes?.data;
              
              if (!statusData) return;

              setSyncStatus({
                syncId: statusData.syncId,
                status: statusData.status,
                progress: statusData.progress || { currentStep: "", percentage: 0 },
                stats: statusData.stats,
                error: statusData.error,
              });

              if (statusData.status === "completed" || statusData.status === "failed") {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
                setRepoLoading(false);

                if (statusData.status === "completed") {
                  const stats = statusData.stats || {};
                  setUiMessage({
                    type: "success",
                    text: `Repository sync completed! Indexed ${stats.totalChunks || 0} chunks from ${stats.totalFiles || 0} files.`,
                  });
                }
              }
            } catch (pollErr) {
              console.error("Polling error:", pollErr);
            }
          }, 2000);
        }
      }
    } catch (err) {
      // Ignore - no sync status exists yet
    }
  }, [projectId]);

  useEffect(() => {
    fetchDocs();
    loadProjectRepo();
    loadSyncStatus();
  }, [fetchDocs, loadProjectRepo, loadSyncStatus]);

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
    setIsRepoEditing(false);
    setUiMessage({ type: "success", text: "Repository link saved successfully" });
    return { ok: true, data: res.data };
  }, [projectId, repoLinkInput, saveProjectRepo]);

  const startEditRepo = useCallback(() => {
    setIsRepoEditing(true);
    setRepoLinkInput(savedRepoLink);
  }, [savedRepoLink]);

  const cancelEditRepo = useCallback(() => {
    setIsRepoEditing(false);
    setRepoLinkInput(savedRepoLink);
  }, [savedRepoLink]);

  const analyzeRepo = useCallback(async (repoId = null) => {
    if (!projectId) return { ok: false, error: "Invalid project id" };
    
    // For legacy single repo, check savedRepoLink
    // For multi-repo, repoId is required
    if (!repoId && !savedRepoLink) {
      setUiMessage({ type: "error", text: "Save repository link first" });
      return { ok: false };
    }

    // Stop any existing polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    try {
      if (repoId) {
        setAnalyzingRepoId(repoId);
      } else {
        setRepoLoading(true);
      }
      
      const res = await analyzeKnowledgeRepositoryApi(projectId, repoId);
      const syncId = res?.data?.syncId;
      
      if (!syncId) {
        setUiMessage({ type: "error", text: "Failed to start repository sync" });
        if (repoId) {
          setAnalyzingRepoId(null);
        } else {
          setRepoLoading(false);
        }
        return { ok: false };
      }

      // If already running, show message
      if (res?.data?.alreadyRunning) {
        setUiMessage({ type: "info", text: "A sync is already in progress" });
      } else {
        const repoName = res?.data?.identifier || "Repository";
        setUiMessage({ type: "info", text: `${repoName} sync started...` });
      }

      // Initialize sync status
      const newSyncStatus = {
        syncId,
        status: res?.data?.status || "pending",
        progress: { currentStep: "Starting...", percentage: 0 },
        repoId: repoId,
      };
      
      if (repoId) {
        setRepoSyncStatuses((prev) => ({ ...prev, [repoId]: newSyncStatus }));
      } else {
        setSyncStatus(newSyncStatus);
      }

      // Start polling for sync status
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await getSyncStatusByIdApi(syncId);
          const data = statusRes?.data;
          
          if (!data) return;

          const updatedStatus = {
            syncId: data.syncId,
            status: data.status,
            progress: data.progress || { currentStep: "", percentage: 0 },
            stats: data.stats,
            error: data.error,
            repoId: repoId,
          };

          if (repoId) {
            setRepoSyncStatuses((prev) => ({ ...prev, [repoId]: updatedStatus }));
          } else {
            setSyncStatus(updatedStatus);
          }

          // Stop polling on completion or failure
          if (data.status === "completed" || data.status === "failed") {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            
            if (repoId) {
              setAnalyzingRepoId(null);
            } else {
              setRepoLoading(false);
            }

            if (data.status === "completed") {
              const stats = data.stats || {};
              setUiMessage({
                type: "success",
                text: `Repository sync completed! Indexed ${stats.totalChunks || 0} chunks from ${stats.totalFiles || 0} files.`,
              });
            } else {
              setUiMessage({
                type: "error",
                text: data.error?.message || "Repository sync failed",
              });
            }
          }
        } catch (pollErr) {
          console.error("Polling error:", pollErr);
        }
      }, 2000); // Poll every 2 seconds

      return { ok: true, data: res?.data };
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || "Failed to analyze repository";
      setUiMessage({ type: "error", text: message });
      if (repoId) {
        setAnalyzingRepoId(null);
      } else {
        setRepoLoading(false);
      }
      return { ok: false, error: message };
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

  // ============ Multi-Repository Management Methods ============

  const resetRepoForm = useCallback(() => {
    setRepoFormData({ identifier: "", repolink: "", tag: "backend" });
    setEditingRepoId(null);
  }, []);

  const handleRepoFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setRepoFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const startEditRepository = useCallback((repo) => {
    setEditingRepoId(repo._id);
    setRepoFormData({
      identifier: repo.identifier || "",
      repolink: repo.repolink || "",
      tag: repo.tag || "backend",
    });
  }, []);

  const cancelEditRepository = useCallback(() => {
    resetRepoForm();
  }, [resetRepoForm]);

  const addRepository = useCallback(async () => {
    if (!projectId) return { ok: false, error: "Invalid project id" };
    
    const { identifier, repolink, tag } = repoFormData;
    if (!identifier?.trim() || !repolink?.trim()) {
      setUiMessage({ type: "error", text: "Identifier and repository link are required" });
      return { ok: false };
    }

    setRepoActionLoading(true);
    const res = await addRepoToContext(projectId, { identifier: identifier.trim(), repolink: repolink.trim(), tag });
    setRepoActionLoading(false);

    if (!res.ok) {
      setUiMessage({ type: "error", text: res.error || "Failed to add repository" });
      return res;
    }

    setRepositories(res.data || []);
    resetRepoForm();
    setUiMessage({ type: "success", text: "Repository added successfully" });
    return { ok: true, data: res.data };
  }, [projectId, repoFormData, addRepoToContext, resetRepoForm]);

  const updateRepositoryItem = useCallback(async () => {
    if (!projectId || !editingRepoId) return { ok: false, error: "Invalid project or repository id" };
    
    const { identifier, repolink, tag } = repoFormData;
    if (!identifier?.trim() || !repolink?.trim()) {
      setUiMessage({ type: "error", text: "Identifier and repository link are required" });
      return { ok: false };
    }

    setRepoActionLoading(true);
    const res = await updateRepoInContext(projectId, editingRepoId, { identifier: identifier.trim(), repolink: repolink.trim(), tag });
    setRepoActionLoading(false);

    if (!res.ok) {
      setUiMessage({ type: "error", text: res.error || "Failed to update repository" });
      return res;
    }

    setRepositories(res.data || []);
    resetRepoForm();
    setUiMessage({ type: "success", text: "Repository updated successfully" });
    return { ok: true, data: res.data };
  }, [projectId, editingRepoId, repoFormData, updateRepoInContext, resetRepoForm]);

  const deleteRepositoryItem = useCallback(async (repoId) => {
    if (!projectId || !repoId) return { ok: false, error: "Invalid project or repository id" };
    
    const confirmed = window.confirm("Are you sure you want to delete this repository?");
    if (!confirmed) return { ok: false };

    setRepoActionLoading(true);
    const res = await deleteRepoFromContext(projectId, repoId);
    setRepoActionLoading(false);

    if (!res.ok) {
      setUiMessage({ type: "error", text: res.error || "Failed to delete repository" });
      return res;
    }

    setRepositories(res.data || []);
    setUiMessage({ type: "success", text: "Repository deleted successfully" });
    return { ok: true, data: res.data };
  }, [projectId, deleteRepoFromContext]);

  const saveOrUpdateRepository = useCallback(async () => {
    if (editingRepoId) {
      return await updateRepositoryItem();
    }
    return await addRepository();
  }, [editingRepoId, updateRepositoryItem, addRepository]);

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
    isRepoEditing,
    startEditRepo,
    cancelEditRepo,

    // PAT token exports
    patTokenInput,
    setPatTokenInput,
    savedPatToken,
    patLoading,
    isPatEditing,
    startEditPat,
    savePatToken,

    // Sync status exports
    syncStatus,

    // Multi-repository exports
    repositories,
    repoFormData,
    handleRepoFormChange,
    editingRepoId,
    repoActionLoading,
    analyzingRepoId,
    repoSyncStatuses,
    startEditRepository,
    cancelEditRepository,
    saveOrUpdateRepository,
    deleteRepositoryItem,
    resetRepoForm,
  };
};
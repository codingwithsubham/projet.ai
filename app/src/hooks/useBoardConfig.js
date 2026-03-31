import { useCallback, useEffect, useState } from "react";
import { getBoardConfigApi, saveBoardConfigApi } from "../services/project.api";

const EMPTY_JIRA = { baseUrl: "", email: "", apiToken: "", projectKey: "" };

export const useBoardConfig = (projectId) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Saved config from server
  const [savedConfig, setSavedConfig] = useState(null);

  // Form state
  const [platform, setPlatform] = useState("none");
  const [jiraForm, setJiraForm] = useState({ ...EMPTY_JIRA });
  const [isEditing, setIsEditing] = useState(false);

  const clearMessages = useCallback(() => {
    setError("");
    setSuccessMsg("");
  }, []);

  // Load board config on mount
  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getBoardConfigApi(projectId);
        if (!cancelled && res.success) {
          const cfg = res.data;
          setSavedConfig(cfg);
          setPlatform(cfg.platform || "none");
          if (cfg.jira) {
            setJiraForm({
              baseUrl: cfg.jira.baseUrl || "",
              email: cfg.jira.email || "",
              apiToken: "", // Masked from server, user re-enters on edit
              projectKey: cfg.jira.projectKey || "",
            });
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load board config");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [projectId]);

  const handleJiraChange = useCallback((e) => {
    const { name, value } = e.target;
    setJiraForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const startEditing = useCallback(() => {
    setIsEditing(true);
    clearMessages();
    // Reset apiToken since it was masked
    if (savedConfig?.platform === "jira") {
      setJiraForm((prev) => ({ ...prev, apiToken: "" }));
    }
  }, [savedConfig, clearMessages]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    clearMessages();
    // Restore from saved
    if (savedConfig) {
      setPlatform(savedConfig.platform || "none");
      if (savedConfig.jira) {
        setJiraForm({
          baseUrl: savedConfig.jira.baseUrl || "",
          email: savedConfig.jira.email || "",
          apiToken: "",
          projectKey: savedConfig.jira.projectKey || "",
        });
      } else {
        setJiraForm({ ...EMPTY_JIRA });
      }
    }
  }, [savedConfig, clearMessages]);

  const saveConfig = useCallback(async () => {
    clearMessages();
    setSaving(true);
    try {
      const payload = { platform };
      if (platform === "jira") {
        payload.jira = { ...jiraForm };
      }

      const res = await saveBoardConfigApi(projectId, payload);
      if (res.success) {
        setSavedConfig(res.data);
        setIsEditing(false);
        setSuccessMsg("Board configuration saved successfully");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save board configuration");
    } finally {
      setSaving(false);
    }
  }, [projectId, platform, jiraForm, clearMessages]);

  const isSaved = Boolean(savedConfig && savedConfig.platform !== "none");

  return {
    loading,
    saving,
    error,
    successMsg,
    clearMessages,
    savedConfig,
    platform,
    setPlatform,
    jiraForm,
    handleJiraChange,
    isEditing,
    startEditing,
    cancelEditing,
    saveConfig,
    isSaved,
  };
};

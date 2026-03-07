import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "../context/AppDataContext";
import {
  createApiKeyApi,
  getApiKeysApi,
  revokeApiKeyApi,
  updateApiKeyApi,
} from "../services/apiKeys.api";

const initialForm = {
  name: "",
  projectId: "",
  role: "dev",
  expiresAt: "",
};

const formatDateTimeInput = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const getDefaultExpiryInput = () => {
  const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return formatDateTimeInput(oneWeekFromNow.toISOString());
};

const mapKeyToForm = (item) => ({
  name: item?.name || "",
  projectId: item?.projectId || "",
  role: item?.role || "dev",
  expiresAt: formatDateTimeInput(item?.expiresAt),
});

export const useApiKeys = () => {
  const { projects, fetchProjects } = useAppData();

  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [modal, setModal] = useState({ open: false, mode: "add", keyId: null });
  const [formData, setFormData] = useState({ ...initialForm, expiresAt: getDefaultExpiryInput() });
  const [formError, setFormError] = useState("");
  const [latestGeneratedKey, setLatestGeneratedKey] = useState("");

  const getErrorMessage = useCallback(
    (nextError, fallback) => nextError?.response?.data?.error || nextError?.response?.data?.message || nextError?.message || fallback,
    []
  );

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getApiKeysApi();
      setApiKeys(Array.isArray(response?.data) ? response.data : []);
      return { ok: true };
    } catch (nextError) {
      const message = getErrorMessage(nextError, "Failed to fetch API keys");
      setError(message);
      return { ok: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [getErrorMessage]);

  useEffect(() => {
    fetchApiKeys();
    if (!projects.length) fetchProjects();
  }, [fetchApiKeys, fetchProjects, projects.length]);

  const projectNameById = useMemo(() => {
    return projects.reduce((acc, project) => {
      acc[String(project._id)] = project.name;
      return acc;
    }, {});
  }, [projects]);

  const closeModal = useCallback(() => {
    setModal({ open: false, mode: "add", keyId: null });
    setFormData({ ...initialForm, expiresAt: getDefaultExpiryInput() });
    setFormError("");
  }, []);

  const openCreateModal = useCallback(() => {
    setModal({ open: true, mode: "add", keyId: null });
    setFormData({ ...initialForm, expiresAt: getDefaultExpiryInput() });
    setFormError("");
  }, []);

  const openEditModal = useCallback((id) => {
    const selected = apiKeys.find((item) => item.id === id);
    if (!selected) return;

    setModal({ open: true, mode: "edit", keyId: id });
    setFormData(mapKeyToForm(selected));
    setFormError("");
  }, [apiKeys]);

  const handleFormChange = useCallback((event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormError("");
  }, []);

  const validate = useCallback((data) => {
    if (!String(data.name || "").trim()) return "Key name is required";
    if (!String(data.projectId || "").trim()) return "Project is required";
    if (!String(data.role || "").trim()) return "Role is required";
    if (!String(data.expiresAt || "").trim()) return "Expiry date is required";
    return "";
  }, []);

  const submitApiKey = useCallback(async (event) => {
    event.preventDefault();

    const validationError = validate(formData);
    if (validationError) {
      setFormError(validationError);
      return { ok: false, error: validationError };
    }

    setActionLoading(true);

    const payload = {
      name: formData.name.trim(),
      projectId: formData.projectId,
      role: formData.role,
      expiresAt: new Date(formData.expiresAt).toISOString(),
    };

    try {
      if (modal.mode === "edit" && modal.keyId) {
        await updateApiKeyApi(modal.keyId, payload);
      } else {
        const created = await createApiKeyApi(payload);
        setLatestGeneratedKey(created?.data?.plainTextKey || "");
      }

      await fetchApiKeys();
      closeModal();
      return { ok: true };
    } catch (nextError) {
      const message = getErrorMessage(nextError, "Failed to save API key");
      setFormError(message);
      return { ok: false, error: message };
    } finally {
      setActionLoading(false);
    }
  }, [closeModal, fetchApiKeys, formData, getErrorMessage, modal.keyId, modal.mode, validate]);

  const revokeApiKey = useCallback(async (id) => {
    const approved = window.confirm("Revoke this API key? This action cannot be undone.");
    if (!approved) return { ok: false };

    setActionLoading(true);
    try {
      await revokeApiKeyApi(id);
      await fetchApiKeys();
      return { ok: true };
    } catch (nextError) {
      const message = getErrorMessage(nextError, "Failed to revoke API key");
      setError(message);
      return { ok: false, error: message };
    } finally {
      setActionLoading(false);
    }
  }, [fetchApiKeys, getErrorMessage]);

  const clearGeneratedKey = useCallback(() => {
    setLatestGeneratedKey("");
  }, []);

  return {
    apiKeys,
    projects,
    projectNameById,
    loading,
    error,
    actionLoading,
    modal,
    formData,
    formError,
    latestGeneratedKey,
    refreshApiKeys: fetchApiKeys,
    openCreateModal,
    openEditModal,
    closeModal,
    handleFormChange,
    submitApiKey,
    revokeApiKey,
    clearGeneratedKey,
  };
};

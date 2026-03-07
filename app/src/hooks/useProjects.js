import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "../context/AppDataContext";
import { getAuthUser } from "../services/auth.storage";

const initialForm = {
  name: "",
  description: "",
  model: "",
  openapikey: "",
  islangsmithEnabled: false,
  langsmithapikey: "",
  langsmithProject: "",
};

const mapProjectToForm = (project) => ({
  name: project?.name || "",
  description: project?.description || "",
  model: project?.model || "",
  openapikey: project?.openapikey || "",
  islangsmithEnabled: Boolean(project?.islangsmithEnabled),
  langsmithapikey: project?.langsmithapikey || "",
  langsmithProject: project?.langsmithProject || "",
});

export const useProjects = () => {
  const currentUser = getAuthUser();
  const isAdmin = String(currentUser?.role || "") === "admin";

  const {
    projects,
    projectsLoading,
    projectsError,
    fetchProjects,
    getProjectById,
    createProject,
    updateProjectById,
    deleteProjectById,
  } = useAppData();

  const [modal, setModal] = useState({ open: false, mode: "add", projectId: null });
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!projects.length) fetchProjects();
  }, [projects.length, fetchProjects]);

  const tableProjects = useMemo(() => projects, [projects]);

  const validate = useCallback((data) => {
    const errors = {};
    if (!data.name?.trim()) errors.name = "Project name is required";
    if (!data.description?.trim()) errors.description = "Description is required";
    if (!data.model?.trim()) errors.model = "Model is required";
    if (!data.openapikey?.trim()) errors.openapikey = "Open API key is required";
    return errors;
  }, []);

  const closeModal = useCallback(() => {
    setModal({ open: false, mode: "add", projectId: null });
    setFormData(initialForm);
    setFormErrors({});
  }, []);

  const openAddModal = useCallback(() => {
    if (!isAdmin) return;
    setModal({ open: true, mode: "add", projectId: null });
    setFormData(initialForm);
    setFormErrors({});
  }, [isAdmin]);

  const openEditModal = useCallback(async (id) => {
    if (!isAdmin) return;
    setActionLoading(true);
    const res = await getProjectById(id);
    setActionLoading(false);

    if (!res.ok) return;
    setFormData(mapProjectToForm(res.data));
    setModal({ open: true, mode: "edit", projectId: id });
  }, [getProjectById, isAdmin]);

  const handleFormChange = useCallback((e) => {
    const { name, value, checked, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }));
  }, []);

  const submitProject = useCallback(async (e) => {
    e.preventDefault();
    if (!isAdmin) return { ok: false, error: "Only admin can modify projects" };

    const errors = validate(formData);

    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return { ok: false };
    }

    setActionLoading(true);

    const result =
      modal.mode === "edit" && modal.projectId
        ? await updateProjectById(modal.projectId, formData)
        : await createProject(formData);

    setActionLoading(false);

    if (!result.ok) {
      setFormErrors((prev) => ({ ...prev, form: result.error || "Action failed" }));
      return result;
    }

    closeModal();
    return result;
  }, [closeModal, createProject, formData, isAdmin, modal.mode, modal.projectId, updateProjectById, validate]);

  const removeProject = useCallback(async (id) => {
    if (!isAdmin) return { ok: false, error: "Only admin can delete projects" };

    const approved = window.confirm("Delete this project?");
    if (!approved) return { ok: false };

    setActionLoading(true);
    const result = await deleteProjectById(id);
    setActionLoading(false);
    return result;
  }, [deleteProjectById, isAdmin]);

  return {
    tableProjects,
    projectsLoading,
    projectsError,
    actionLoading,
    modal,
    formData,
    formErrors,
    isAdmin,
    refreshProjects: fetchProjects,
    openAddModal,
    openEditModal,
    closeModal,
    handleFormChange,
    submitProject,
    removeProject,
  };
};
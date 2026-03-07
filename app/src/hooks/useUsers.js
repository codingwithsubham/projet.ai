import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "../context/AppDataContext";
import { USER_ROLES } from "../constants/userRoles";
import {
  createUserApi,
  deleteUserApi,
  getUsersApi,
  updateUserApi,
} from "../services/users.api";

const initialForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  role: "",
  projects: [],
};

const mapUserToForm = (user) => ({
  name: user?.name || "",
  username: user?.username || "",
  email: user?.email || "",
  password: "",
  role: user?.role || "",
  projects: Array.isArray(user?.projects) ? user.projects.map((id) => String(id)) : [],
});

export const useUsers = () => {
  const { projects, fetchProjects } = useAppData();

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [modal, setModal] = useState({ open: false, mode: "add", userId: null });
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});

  const getErrorMessage = useCallback(
    (error, fallback) => error?.response?.data?.message || error?.message || fallback,
    []
  );

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError("");

    try {
      const res = await getUsersApi();
      setUsers(Array.isArray(res?.data) ? res.data : []);
      return { ok: true };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to fetch users");
      setUsersError(message);
      return { ok: false, error: message };
    } finally {
      setUsersLoading(false);
    }
  }, [getErrorMessage]);

  useEffect(() => {
    fetchUsers();
    if (!projects.length) fetchProjects();
  }, [fetchProjects, fetchUsers, projects.length]);

  const projectNameById = useMemo(() => {
    return projects.reduce((acc, project) => {
      acc[String(project._id)] = project.name;
      return acc;
    }, {});
  }, [projects]);

  const validate = useCallback((data, mode) => {
    const errors = {};
    if (!data.name?.trim()) errors.name = "Name is required";
    if (!data.username?.trim()) errors.username = "Username is required";
    if (!data.email?.trim()) errors.email = "Email is required";
    if (!data.role?.trim()) errors.role = "Role is required";
    if (mode === "add" && !data.password?.trim()) errors.password = "Password is required";
    if (data.role && !USER_ROLES.includes(data.role)) {
      errors.role = "Please select a valid role";
    }
    return errors;
  }, []);

  const closeModal = useCallback(() => {
    setModal({ open: false, mode: "add", userId: null });
    setFormData(initialForm);
    setFormErrors({});
  }, []);

  const openAddModal = useCallback(() => {
    setModal({ open: true, mode: "add", userId: null });
    setFormData(initialForm);
    setFormErrors({});
  }, []);

  const openEditModal = useCallback((id) => {
    const user = users.find((item) => item.id === id);
    if (!user) return;

    setFormData(mapUserToForm(user));
    setFormErrors({});
    setModal({ open: true, mode: "edit", userId: id });
  }, [users]);

  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }));
  }, []);

  const toggleProject = useCallback((projectId) => {
    setFormData((prev) => {
      const id = String(projectId);
      const exists = prev.projects.includes(id);
      return {
        ...prev,
        projects: exists ? prev.projects.filter((item) => item !== id) : [...prev.projects, id],
      };
    });
  }, []);

  const submitUser = useCallback(async (e) => {
    e.preventDefault();

    const errors = validate(formData, modal.mode);
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return { ok: false, errors };
    }

    setActionLoading(true);

    const payload = {
      name: formData.name.trim(),
      username: formData.username.trim(),
      email: formData.email.trim(),
      role: formData.role,
      projects: formData.projects,
    };

    if (formData.password.trim()) {
      payload.password = formData.password.trim();
    }

    try {
      if (modal.mode === "edit" && modal.userId) {
        await updateUserApi(modal.userId, payload);
      } else {
        await createUserApi(payload);
      }

      await fetchUsers();
      closeModal();
      return { ok: true };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to save user");
      setFormErrors((prev) => ({ ...prev, form: message }));
      return { ok: false, error: message };
    } finally {
      setActionLoading(false);
    }
  }, [closeModal, fetchUsers, formData, getErrorMessage, modal.mode, modal.userId, validate]);

  const removeUser = useCallback(async (id) => {
    const approved = window.confirm("Delete this user?");
    if (!approved) return { ok: false };

    setActionLoading(true);
    try {
      await deleteUserApi(id);
      await fetchUsers();
      return { ok: true };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to delete user");
      setUsersError(message);
      return { ok: false, error: message };
    } finally {
      setActionLoading(false);
    }
  }, [fetchUsers, getErrorMessage]);

  return {
    users,
    projects,
    projectNameById,
    usersLoading,
    usersError,
    actionLoading,
    modal,
    formData,
    formErrors,
    refreshUsers: fetchUsers,
    openAddModal,
    openEditModal,
    closeModal,
    handleFormChange,
    toggleProject,
    submitUser,
    removeUser,
  };
};

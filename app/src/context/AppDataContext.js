import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  getProjectsApi,
  getProjectByIdApi,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi,
  saveProjectRepoApi,
  saveProjectPatTokenApi,
  getRepositoriesApi,
  addRepositoryApi,
  updateRepositoryApi,
  deleteRepositoryApi,
} from "../services/project.api";

const AppDataContext = createContext(null);

const upsertProject = (items, next) => {
  const idx = items.findIndex((p) => p._id === next._id);
  if (idx === -1) return [next, ...items];

  const copy = [...items];
  copy[idx] = next;
  return copy;
};

export const AppDataProvider = ({ children }) => {
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");

  const getErrorMessage = (error, fallback) =>
    error?.response?.data?.message || error?.message || fallback;

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError("");

    try {
      const res = await getProjectsApi();
      const nextProjects = Array.isArray(res?.data) ? res.data : [];
      setProjects(nextProjects);
      return { ok: true, data: nextProjects };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to fetch projects");
      setProjectsError(message);
      return { ok: false, error: message };
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const getProjectById = useCallback(async (id) => {
    try {
      const cached = projects.find((p) => p._id === id);
      if (cached) return { ok: true, data: cached };

      const res = await getProjectByIdApi(id);
      const project = res?.data;
      if (project?._id) setProjects((prev) => upsertProject(prev, project));
      return { ok: true, data: project };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to fetch project");
      setProjectsError(message);
      return { ok: false, error: message };
    }
  }, [projects]);

  const createProject = useCallback(async (payload) => {
    try {
      const res = await createProjectApi(payload);
      const created = res?.data;
      if (created?._id) setProjects((prev) => upsertProject(prev, created));
      return { ok: true, data: created };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to create project");
      setProjectsError(message);
      return { ok: false, error: message };
    }
  }, []);

  const updateProjectById = useCallback(async (id, payload) => {
    try {
      const res = await updateProjectApi(id, payload);
      const updated = res?.data;
      if (updated?._id) setProjects((prev) => upsertProject(prev, updated));
      return { ok: true, data: updated };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to update project");
      setProjectsError(message);
      return { ok: false, error: message };
    }
  }, []);

  const deleteProjectById = useCallback(async (id) => {
    try {
      await deleteProjectApi(id);
      setProjects((prev) => prev.filter((p) => p._id !== id));
      return { ok: true };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to delete project");
      setProjectsError(message);
      return { ok: false, error: message };
    }
  }, []);

  const saveProjectRepo = useCallback(async (id, repolink) => {
    try {
      const res = await saveProjectRepoApi(id, repolink);
      const updated = res?.data;
      if (updated?._id) setProjects((prev) => upsertProject(prev, updated));
      return { ok: true, data: updated };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to save repository link");
      setProjectsError(message);
      return { ok: false, error: message };
    }
  }, []);

  const saveProjectPatToken = useCallback(async (id, patToken) => {
    try {
      const res = await saveProjectPatTokenApi(id, patToken);
      const updated = res?.data;
      if (updated?._id) setProjects((prev) => upsertProject(prev, updated));
      return { ok: true, data: updated };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to save PAT token");
      setProjectsError(message);
      return { ok: false, error: message };
    }
  }, []);

  // ============ Repository Management Methods ============

  const getRepositories = useCallback(async (projectId) => {
    try {
      const res = await getRepositoriesApi(projectId);
      return { ok: true, data: Array.isArray(res?.data) ? res.data : [] };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to fetch repositories");
      return { ok: false, error: message };
    }
  }, []);

  const addRepository = useCallback(async (projectId, repoData) => {
    try {
      const res = await addRepositoryApi(projectId, repoData);
      const repositories = res?.data;
      // Update project in state with new repositories
      setProjects((prev) =>
        prev.map((p) => (p._id === projectId ? { ...p, repositories } : p))
      );
      return { ok: true, data: repositories };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to add repository");
      return { ok: false, error: message };
    }
  }, []);

  const updateRepository = useCallback(async (projectId, repoId, repoData) => {
    try {
      const res = await updateRepositoryApi(projectId, repoId, repoData);
      const repositories = res?.data;
      setProjects((prev) =>
        prev.map((p) => (p._id === projectId ? { ...p, repositories } : p))
      );
      return { ok: true, data: repositories };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to update repository");
      return { ok: false, error: message };
    }
  }, []);

  const deleteRepository = useCallback(async (projectId, repoId) => {
    try {
      const res = await deleteRepositoryApi(projectId, repoId);
      const repositories = res?.data;
      setProjects((prev) =>
        prev.map((p) => (p._id === projectId ? { ...p, repositories } : p))
      );
      return { ok: true, data: repositories };
    } catch (error) {
      const message = getErrorMessage(error, "Failed to delete repository");
      return { ok: false, error: message };
    }
  }, []);

  const value = useMemo(
    () => ({
      projects,
      projectsLoading,
      projectsError,
      fetchProjects,
      getProjectById,
      createProject,
      updateProjectById,
      deleteProjectById,
      saveProjectRepo,
      saveProjectPatToken,
      // Repository management
      getRepositories,
      addRepository,
      updateRepository,
      deleteRepository,
    }),
    [
      projects,
      projectsLoading,
      projectsError,
      fetchProjects,
      getProjectById,
      createProject,
      updateProjectById,
      deleteProjectById,
      saveProjectRepo,
      saveProjectPatToken,
      getRepositories,
      addRepository,
      updateRepository,
      deleteRepository,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return context;
};
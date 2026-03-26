import { useCallback, useEffect, useState } from "react";
import { useAppData } from "../context/AppDataContext";
import {
  getActivitiesApi,
  getProjectActivitiesApi,
  getTeamSummaryApi,
  getHandoffContextApi,
} from "../services/activity.api";
import { getUsersApi } from "../services/users.api";

export const useActivity = () => {
  const { projects, fetchProjects, currentUser } = useAppData();

  const [activities, setActivities] = useState([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [teamSummary, setTeamSummary] = useState(null);
  const [handoffContext, setHandoffContext] = useState(null);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    projectId: "",
    userId: "",
    source: "",
    agentType: "",
    days: 7,
  });

  const [pagination, setPagination] = useState({
    limit: 20,
    skip: 0,
  });

  const isAdmin = currentUser?.role === "admin";
  const isPM = currentUser?.role === "PM" || isAdmin;

  const getErrorMessage = useCallback(
    (err, fallback) =>
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      fallback,
    []
  );

  // Fetch users for filters and handoff selection
  const fetchUsers = useCallback(async () => {
    try {
      const res = await getUsersApi();
      setUsers(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  }, []);

  // Fetch activities based on filters
  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - filters.days);

      const params = {
        ...pagination,
        startDate: startDate.toISOString(),
        projectId: filters.projectId || undefined,
        userId: filters.userId || undefined,
        source: filters.source || undefined,
        agentType: filters.agentType || undefined,
      };

      let response;
      if (filters.projectId) {
        response = await getProjectActivitiesApi(filters.projectId, params);
      } else {
        response = await getActivitiesApi(params);
      }

      setActivities(response?.data?.activities || []);
      setTotalActivities(response?.data?.total || 0);
      return { ok: true };
    } catch (err) {
      const message = getErrorMessage(err, "Failed to fetch activities");
      setError(message);
      return { ok: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [filters, pagination, getErrorMessage]);

  // Fetch team summary for a project
  const fetchTeamSummary = useCallback(
    async (projectId, days = 7) => {
      if (!projectId) {
        setTeamSummary(null);
        return { ok: false, error: "Project ID required" };
      }

      setLoading(true);
      setError("");

      try {
        const response = await getTeamSummaryApi(projectId, days);
        setTeamSummary(response?.data || null);
        return { ok: true, data: response?.data };
      } catch (err) {
        const message = getErrorMessage(err, "Failed to fetch team summary");
        setError(message);
        return { ok: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [getErrorMessage]
  );

  // Fetch handoff context for a specific user
  const fetchHandoffContext = useCallback(
    async (projectId, userId, days = 14) => {
      if (!projectId || !userId) {
        setHandoffContext(null);
        return { ok: false, error: "Project and User ID required" };
      }

      setLoading(true);
      setError("");

      try {
        const response = await getHandoffContextApi(projectId, userId, days);
        setHandoffContext(response?.data || null);
        return { ok: true, data: response?.data };
      } catch (err) {
        const message = getErrorMessage(err, "Failed to fetch handoff context");
        setError(message);
        return { ok: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [getErrorMessage]
  );

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPagination((prev) => ({ ...prev, skip: 0 })); // Reset pagination on filter change
  }, []);

  // Pagination handlers
  const nextPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      skip: prev.skip + prev.limit,
    }));
  }, []);

  const prevPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      skip: Math.max(0, prev.skip - prev.limit),
    }));
  }, []);

  // Initialize
  useEffect(() => {
    if (!projects.length) fetchProjects();
    if (isAdmin) fetchUsers();
  }, [fetchProjects, fetchUsers, isAdmin, projects.length]);

  // Fetch activities when filters or pagination change
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return {
    // Data
    activities,
    totalActivities,
    teamSummary,
    handoffContext,
    users,
    projects,
    currentUser,

    // State
    loading,
    error,
    filters,
    pagination,

    // Permissions
    isAdmin,
    isPM,

    // Actions
    fetchActivities,
    fetchTeamSummary,
    fetchHandoffContext,
    updateFilters,
    nextPage,
    prevPage,
    clearHandoffContext: () => setHandoffContext(null),
  };
};

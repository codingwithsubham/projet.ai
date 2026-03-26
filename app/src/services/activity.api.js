import apiClient from "./apiClient";

/**
 * Get activities with filters
 * @param {Object} params - Query parameters
 * @param {string} [params.projectId] - Filter by project
 * @param {string} [params.userId] - Filter by user (admin only)
 * @param {string} [params.startDate] - Start date filter
 * @param {string} [params.endDate] - End date filter
 * @param {string} [params.source] - Filter by source (mcp, web_chat)
 * @param {string} [params.agentType] - Filter by agent type
 * @param {number} [params.limit] - Max results
 * @param {number} [params.skip] - Skip results
 */
export const getActivitiesApi = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, value);
    }
  });
  const response = await apiClient.get(`/activity?${query.toString()}`);
  return response.data;
};

/**
 * Get activities for a specific project
 */
export const getProjectActivitiesApi = async (projectId, params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, value);
    }
  });
  const response = await apiClient.get(`/activity/project/${projectId}?${query.toString()}`);
  return response.data;
};

/**
 * Get team activity summary for a project (admin/PM only)
 */
export const getTeamSummaryApi = async (projectId, days = 7) => {
  const response = await apiClient.get(`/activity/project/${projectId}/team?days=${days}`);
  return response.data;
};

/**
 * Get handoff context for a specific user
 */
export const getHandoffContextApi = async (projectId, userId, days = 7) => {
  const response = await apiClient.get(`/activity/project/${projectId}/handoff/${userId}?days=${days}`);
  return response.data;
};

/**
 * Get Copilot configuration for a project
 * @param {string} projectId - Project ID
 * @param {string} [format] - 'full', 'instructions', or 'mcp'
 */
export const getCopilotConfigApi = async (projectId, format = "full") => {
  const response = await apiClient.get(`/projects/${projectId}/copilot-config?format=${format}`);
  return response.data;
};

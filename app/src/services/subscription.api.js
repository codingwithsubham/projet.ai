import apiClient from "./apiClient";

// ==================== Marketplace APIs ====================

export const getMarketplaceAgents = (params = {}) =>
  apiClient.get("/marketplace/agents", { params });

export const getMarketplaceAgent = (slug) =>
  apiClient.get(`/marketplace/agents/${slug}`);

export const getMarketplaceCategories = () =>
  apiClient.get("/marketplace/categories");

export const getMarketplaceStats = () =>
  apiClient.get("/marketplace/stats");

// ==================== Subscription APIs ====================

export const getUserSubscriptions = () =>
  apiClient.get("/subscriptions");

export const getSidebarAgents = () =>
  apiClient.get("/subscriptions/sidebar");

export const getSubscriptionHistory = () =>
  apiClient.get("/subscriptions/history");

export const getSubscriptionStats = () =>
  apiClient.get("/subscriptions/stats");

export const checkSubscription = (slug) =>
  apiClient.get(`/subscriptions/check/${slug}`);

export const subscribeToAgent = (slug) =>
  apiClient.post(`/subscriptions/${slug}/subscribe`);

export const unsubscribeFromAgent = (slug) =>
  apiClient.post(`/subscriptions/${slug}/unsubscribe`);

export default {
  // Marketplace
  getMarketplaceAgents,
  getMarketplaceAgent,
  getMarketplaceCategories,
  getMarketplaceStats,
  // Subscriptions
  getUserSubscriptions,
  getSidebarAgents,
  getSubscriptionHistory,
  getSubscriptionStats,
  checkSubscription,
  subscribeToAgent,
  unsubscribeFromAgent,
};

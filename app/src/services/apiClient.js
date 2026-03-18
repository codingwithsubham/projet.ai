import axios from "axios";
import { clearAuthSession, getAuthToken } from "./auth.storage";

const API_BASE = process.env.REACT_APP_API_URL || "";

const apiClient = axios.create({
  baseURL: `${API_BASE}/api/v1`,
});

apiClient.interceptors.request.use((config) => {
  if (config?.skipAuth) return config;

  const token = getAuthToken();
  if (!token) {
    console.warn("⚠️ No token found in localStorage for request:", config.url);
    return config;
  }

  console.log("✅ Adding Authorization header to request:", config.url);

  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  };
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const shouldHandleUnauthorized =
      error?.response?.status === 401 && !error?.config?.skipAuth;

    if (shouldHandleUnauthorized) {
      clearAuthSession();
      // Force navigation to login when backend rejects an expired/invalid token.
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.assign("/");
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

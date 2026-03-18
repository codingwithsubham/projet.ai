import apiClient from "./apiClient";
import { getAuthToken } from "./auth.storage";

// Create a new presentation
export const createPresentation = (payload) => {
  const token = getAuthToken();
  console.log("📤 Creating presentation with token:", token ? "Present" : "MISSING");
  console.log("📤 Request payload:", payload);
  return apiClient
    .post("/presentations", payload)
    .then((response) => {
      console.log("✅ Presentation API response:", response);
      return response;
    })
    .catch((error) => {
      console.error("❌ Presentation API error:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message,
        data: error.response?.data,
      });
      throw error;
    });
};

// Get all presentations
export const getPresentations = () => {
  return apiClient.get("/presentations");
};

// Get a specific presentation
export const getPresentationById = (id) => {
  return apiClient.get(`/presentations/${id}`);
};

// Search presentations
export const searchPresentations = (search, startDate, endDate) => {
  const params = {};
  if (search) params.search = search;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  return apiClient.get("/presentations/search", { params });
};

// Delete a presentation
export const deletePresentation = (id) => {
  return apiClient.delete(`/presentations/${id}`);
};

// Poll for presentation status
export const pollPresentationStatus = (id, maxAttempts = 60, intervalMs = 1000) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await getPresentationById(id);
        const { data } = response;

        if (data?.status === "completed" || data?.status === "error") {
          resolve(data);
        } else if (attempts >= maxAttempts) {
          reject(new Error("Presentation generation timeout"));
        } else {
          attempts++;
          setTimeout(poll, intervalMs);
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
};

export default {
  createPresentation,
  getPresentations,
  getPresentationById,
  searchPresentations,
  deletePresentation,
  pollPresentationStatus,
};

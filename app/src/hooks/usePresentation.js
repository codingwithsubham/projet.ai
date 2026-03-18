import { useCallback, useEffect, useState } from "react";
import { getAuthUser } from "../services/auth.storage";
import * as presentationAPI from "../services/presentation.api";

const initialForm = {
  name: "",
  prompt: "",
  numberOfPages: 3,
  projectId: "",
  description: "",
};

export const usePresentation = () => {
  const currentUser = getAuthUser();
  const isPM = String(currentUser?.role || "") === "PM";
  const isAdmin = String(currentUser?.role || "") === "admin";

  const [presentations, setPresentations] = useState([]);
  const [presentationsLoading, setPresentationsLoading] = useState(false);
  const [presentationsError, setPresentationsError] = useState(null);

  const [selectedPresentation, setSelectedPresentation] = useState(null);
  const [selectedPresentationLoading, setSelectedPresentationLoading] = useState(false);

  const [modal, setModal] = useState({ open: false, mode: "create" });
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState({
    startDate: null,
    endDate: null,
  });

  // Fetch all presentations
  const fetchPresentations = useCallback(async () => {
    setPresentationsLoading(true);
    setPresentationsError(null);
    try {
      const response = await presentationAPI.getPresentations();
      const data = response.data || response;
      setPresentations(data.data || []);
    } catch (error) {
      setPresentationsError(error.message || "Failed to fetch presentations");
      setPresentations([]);
    } finally {
      setPresentationsLoading(false);
    }
  }, []);

  // Search presentations
  const searchPresentations = useCallback(async () => {
    setPresentationsLoading(true);
    setPresentationsError(null);
    try {
      const response = await presentationAPI.searchPresentations(
        searchTerm,
        filterDate.startDate,
        filterDate.endDate
      );
      const data = response.data || response;
      setPresentations(data.data || []);
    } catch (error) {
      setPresentationsError(error.message || "Failed to search presentations");
      setPresentations([]);
    } finally {
      setPresentationsLoading(false);
    }
  }, [searchTerm, filterDate]);

  // Get presentation by ID
  const getPresentationById = useCallback(async (id) => {
    setSelectedPresentationLoading(true);
    try {
      const response = await presentationAPI.getPresentationById(id);
      const data = response.data || response;
      setSelectedPresentation(data.data);
    } catch (error) {
      console.error("Failed to fetch presentation:", error);
      setSelectedPresentation(null);
    } finally {
      setSelectedPresentationLoading(false);
    }
  }, []);

  // Create presentation - returns immediately, redirects to listing
  const createPresentation = useCallback(async (payload) => {
    setActionLoading(true);
    setFormErrors({});
    try {
      const response = await presentationAPI.createPresentation({
        name: payload.name,
        prompt: payload.prompt,
        numberOfPages: parseInt(payload.numberOfPages),
        projectId: payload.projectId || undefined,
        description: payload.description || "",
      });
      const data = response.data || response;

      if (data.success) {
        // Reset form
        setFormData(initialForm);
        return {
          success: true,
          presentationId: data.data?.presentationId,
          message: data.message,
        };
      }

      return {
        success: false,
        error: data.message || "Failed to create presentation",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "An error occurred",
      };
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Delete presentation
  const deletePresentation = useCallback(async (id) => {
    setActionLoading(true);
    try {
      const response = await presentationAPI.deletePresentation(id);
      const data = response.data || response;

      if (data.success) {
        await fetchPresentations();
        return { success: true };
      }

      return {
        success: false,
        error: data.message || "Failed to delete presentation",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "An error occurred while deleting presentation",
      };
    } finally {
      setActionLoading(false);
    }
  }, [fetchPresentations]);

  // Initialize presentations on mount
  useEffect(() => {
    if (presentations.length === 0 && (isPM || isAdmin)) {
      fetchPresentations();
    }
  }, []);

  return {
    // State
    presentations,
    presentationsLoading,
    presentationsError,
    selectedPresentation,
    selectedPresentationLoading,
    modal,
    formData,
    formErrors,
    actionLoading,
    searchTerm,
    filterDate,

    // Setters
    setPresentations,
    setModal,
    setFormData,
    setFormErrors,
    setSearchTerm,
    setFilterDate,
    setSelectedPresentation,

    // Methods
    fetchPresentations,
    searchPresentations,
    getPresentationById,
    createPresentation,
    deletePresentation,

    // Permissions
    isPM,
    isAdmin,
    canAccess: isPM || isAdmin,
  };
};

export default usePresentation;

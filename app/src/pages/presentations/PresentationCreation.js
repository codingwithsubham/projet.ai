import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePresentation } from "../../hooks/usePresentation";
import { useProjects } from "../../hooks/useProjects";
import PresentationForm from "../../components/presentation/PresentationForm";

const PresentationCreation = () => {
  const navigate = useNavigate();
  const {
    formData,
    setFormData,
    formErrors,
    actionLoading,
    createPresentation,
    isPM,
    isAdmin,
  } = usePresentation();

  const { projects } = useProjects();
  const [errorMessage, setErrorMessage] = useState("");

  // Check if user has permission
  useEffect(() => {
    if (!isPM && !isAdmin) {
      navigate("/");
    }
  }, [isPM, isAdmin, navigate]);

  const handleFormSubmit = async (data) => {
    setErrorMessage("");

    try {
      const result = await createPresentation({
        name: data.name,
        prompt: data.prompt,
        numberOfPages: parseInt(data.numberOfPages),
        projectId: data.projectId || undefined,
        description: data.description || "",
      });

      if (result.success) {
        // Redirect to listing page immediately
        navigate("/presentations");
      } else {
        setErrorMessage(result.error || "Failed to create presentation");
      }
    } catch (error) {
      setErrorMessage(error.message || "An unexpected error occurred");
    }
  };

  const handleBackToLanding = () => {
    navigate("/presentations");
  };

  if (!isPM && !isAdmin) {
    return (
      <div className="access-denied">
        <p>Access denied. Only PM users can create presentations.</p>
      </div>
    );
  }

  return (
    <div className="presentation-creation">
      <div className="page-header">
        <button onClick={handleBackToLanding} className="btn-back">
          ← Back to Presentations
        </button>
        <h1>Create New Presentation</h1>
      </div>

      <div className="creation-container">
        <div className="form-wrapper">
          <h2>Presentation Details</h2>

          {errorMessage && (
            <div className="alert alert-danger">
              <p>{errorMessage}</p>
            </div>
          )}

          <PresentationForm
            formData={formData}
            setFormData={setFormData}
            formErrors={formErrors}
            isLoading={actionLoading}
            onSubmit={handleFormSubmit}
            projects={projects}
          />

          <div className="info-note">
            <small>
              After clicking Generate, you will be redirected to the presentations list. 
              The presentation will be generated in the background.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationCreation;

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useDocument from "../../hooks/useDocument";
import { useProjects } from "../../hooks/useProjects";
import DocumentForm from "../../components/document/DocumentForm";

const DocumentCreation = () => {
  const navigate = useNavigate();
  const { formData, setFormData, formErrors, actionLoading, createDocument, isPM, isAdmin } = useDocument();
  const { projects } = useProjects();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isPM && !isAdmin) navigate("/");
  }, [isPM, isAdmin, navigate]);

  const handleFormSubmit = async (data) => {
    setErrorMessage("");
    try {
      const result = await createDocument({
        name: data.name,
        prompt: data.prompt,
        projectId: data.projectId,
        description: data.description || "",
      });

      if (result.success) {
        navigate("/documents");
      } else {
        setErrorMessage(result.error || "Failed to create document");
      }
    } catch (error) {
      setErrorMessage(error.message || "An unexpected error occurred");
    }
  };

  if (!isPM && !isAdmin) {
    return <div className="access-denied"><p>Access denied.</p></div>;
  }

  return (
    <div className="presentation-creation">
      <div className="page-header">
        <button onClick={() => navigate("/documents")} className="btn-back">
          ← Back to Documents
        </button>
        <h1>Create New Document</h1>
      </div>

      <div className="creation-container">
        <div className="form-wrapper">
          <h2>Document Details</h2>

          {errorMessage && (
            <div className="alert alert-danger">
              <p>{errorMessage}</p>
            </div>
          )}

          <DocumentForm
            formData={formData}
            setFormData={setFormData}
            formErrors={formErrors}
            isLoading={actionLoading}
            onSubmit={handleFormSubmit}
            projects={projects}
          />

          <div className="info-note">
            <small>
              After clicking Generate, you will be redirected to the documents list.
              The document will be generated in the background.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentCreation;

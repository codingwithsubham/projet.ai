import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import usePresentation from "../../hooks/usePresentation";
import SlideViewer from "../../components/presentation/SlideViewer";
import { downloadPPTX } from "../../services/presentation.api";

const PresentationView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    selectedPresentation,
    selectedPresentationLoading,
    getPresentationById,
    isPM,
    isAdmin,
  } = usePresentation();

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [downloadingPPTX, setDownloadingPPTX] = useState(false);

  useEffect(() => {
    if (id) {
      getPresentationById(id);
    }
  }, [id, getPresentationById]);

  const handleDownloadPresentation = () => {
    if (!selectedPresentation?._id) return;

    let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${selectedPresentation.name}</title>
  <style>
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
    .slide { page-break-after: always; width: 960px; height: 720px; position: relative; }
  </style>
</head>
<body>
`;

    if (selectedPresentation.slides) {
      selectedPresentation.slides.forEach((slide) => {
        htmlContent += `<div class="slide">${slide.content}</div>`;
      });
    }

    htmlContent += `</body></html>`;

    const element = document.createElement("a");
    element.setAttribute("href", "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent));
    element.setAttribute("download", `${selectedPresentation.name}.html`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadPPTX = async () => {
    if (!selectedPresentation?._id || !selectedPresentation.slides?.length) return;
    setDownloadingPPTX(true);
    try {
      await downloadPPTX(selectedPresentation._id, selectedPresentation.name);
    } catch (error) {
      console.error("Failed to download PPTX:", error);
      alert("Failed to download PPTX. Please try again.");
    } finally {
      setDownloadingPPTX(false);
    }
  };

  const handleBackToLanding = () => {
    navigate("/presentations");
  };

  if (selectedPresentationLoading) {
    return (
      <div className="loading-state">
        <p>Loading presentation...</p>
      </div>
    );
  }

  if (!selectedPresentation) {
    return (
      <div className="error-state">
        <p>Presentation not found.</p>
        <button onClick={handleBackToLanding} className="btn btn-primary">
          Back to Presentations
        </button>
      </div>
    );
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="presentation-view">
      <div className="page-header">
        <button onClick={handleBackToLanding} className="btn-back">
          ← Back to Presentations
        </button>
        <h1>{selectedPresentation.name}</h1>
      </div>

      <div className="presentation-details-bar">
        <div className="detail">
          <span className="label">Total Slides:</span>
          <span className="value">{selectedPresentation.slides?.length || 0}</span>
        </div>
        <div className="detail">
          <span className="label">Created:</span>
          <span className="value">{formatDate(selectedPresentation.createdAt)}</span>
        </div>
        <div className="detail">
          <span className="label">Status:</span>
          <span className="value badge badge-success">{selectedPresentation.status}</span>
        </div>
      </div>

      {selectedPresentation.description && (
        <div className="presentation-description">
          <h3>Description</h3>
          <p>{selectedPresentation.description}</p>
        </div>
      )}

      {selectedPresentation.prompt && (
        <div className="presentation-prompt">
          <h3>Generation Prompt</h3>
          <p>{selectedPresentation.prompt}</p>
        </div>
      )}

      {/* Slide Viewer */}
      {selectedPresentation.slides && selectedPresentation.slides.length > 0 ? (
        <div className="presentation-viewer-section">
          <SlideViewer slides={selectedPresentation.slides} />
        </div>
      ) : (
        <div className="empty-viewer">
          <p>No slides available</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-buttons-footer">
        <button 
          onClick={handleDownloadPPTX} 
          className="btn btn-primary"
          disabled={downloadingPPTX}
        >
          {downloadingPPTX ? "⏳ Generating PPTX..." : "📥 Download as PPTX"}
        </button>
        <button onClick={handleDownloadPresentation} className="btn btn-secondary">
          📄 Download as HTML
        </button>
        <button onClick={handleBackToLanding} className="btn btn-secondary">
          Back to List
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this presentation? This action cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={() => setDeleteConfirm(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => {
                  // Add delete logic here
                  setDeleteConfirm(false);
                }}
                className="btn btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresentationView;

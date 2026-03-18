import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useDocument from "../../hooks/useDocument";

const DocumentView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    selectedDocument,
    selectedDocumentLoading,
    getDocumentById,
    isPM,
    isAdmin,
  } = useDocument();

  useEffect(() => {
    if (!isPM && !isAdmin) {
      navigate("/");
      return;
    }
    if (id) {
      getDocumentById(id);
    }
  }, [id, isPM, isAdmin, navigate, getDocumentById]);

  const handleDownload = () => {
    if (!selectedDocument?.content) return;
    const blob = new Blob([selectedDocument.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const element = document.createElement("a");
    element.href = url;
    element.download = `${selectedDocument.name}.md`;
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  const handleBack = () => {
    navigate("/documents");
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (selectedDocumentLoading) {
    return (
      <div className="loading-state">
        <p>Loading document...</p>
      </div>
    );
  }

  if (!selectedDocument) {
    return (
      <div className="error-state">
        <p>Document not found.</p>
        <button onClick={handleBack} className="btn btn-primary">
          Back to Documents
        </button>
      </div>
    );
  }

  return (
    <div className="presentation-view">
      <div className="page-header">
        <button onClick={handleBack} className="btn-back">
          ← Back to Documents
        </button>
        <h1>{selectedDocument.name}</h1>
      </div>

      <div className="presentation-details-bar">
        <div className="detail">
          <span className="label">Created:</span>
          <span className="value">{formatDate(selectedDocument.createdAt)}</span>
        </div>
        <div className="detail">
          <span className="label">Status:</span>
          <span className="value badge badge-success">{selectedDocument.status}</span>
        </div>
        {selectedDocument.generationTime && (
          <div className="detail">
            <span className="label">Generation Time:</span>
            <span className="value">{selectedDocument.generationTime}s</span>
          </div>
        )}
      </div>

      {selectedDocument.description && (
        <div className="presentation-description">
          <h3>Description</h3>
          <p>{selectedDocument.description}</p>
        </div>
      )}

      {selectedDocument.prompt && (
        <div className="presentation-prompt">
          <h3>Generation Prompt</h3>
          <p>{selectedDocument.prompt}</p>
        </div>
      )}

      {selectedDocument.content ? (
        <div className="document-content-viewer">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {selectedDocument.content}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="empty-viewer">
          <p>No content available yet.</p>
        </div>
      )}

      <div className="action-buttons-footer">
        <button onClick={handleDownload} className="btn btn-primary">
          📥 Download as Markdown
        </button>
        <button onClick={handleBack} className="btn btn-secondary">
          Back to List
        </button>
      </div>
    </div>
  );
};

export default DocumentView;

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useDocument from "../../hooks/useDocument";
import { uploadKnowledgeDocumentApi } from "../../services/knowledgebase.api";

const DocumentView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    selectedDocument,
    selectedDocumentLoading,
    actionLoading,
    getDocumentById,
    updateDocumentContent,
    markDocumentPublished,
    isPM,
    isAdmin,
  } = useDocument();

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [message, setMessage] = useState(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!isPM && !isAdmin) {
      navigate("/");
      return;
    }
    if (id) {
      getDocumentById(id);
    }
  }, [id, isPM, isAdmin, navigate, getDocumentById]);

  useEffect(() => {
    if (selectedDocument?.content) {
      setEditedContent(selectedDocument.content);
    }
  }, [selectedDocument?.content]);

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

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(selectedDocument?.content || "");
    setMessage(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(selectedDocument?.content || "");
    setMessage(null);
  };

  const handleSave = async () => {
    const result = await updateDocumentContent(id, editedContent);
    if (result.success) {
      setIsEditing(false);
      setMessage({ type: "success", text: "Document saved successfully!" });
    } else {
      setMessage({ type: "error", text: result.error || "Failed to save document" });
    }
  };

  const handlePublish = async () => {
    if (!selectedDocument?.content || !selectedDocument?.projectId) {
      setMessage({ type: "error", text: "Document has no content or project" });
      return;
    }

    setPublishing(true);
    setMessage(null);

    try {
      // Create markdown file from content
      const contentToPublish = isEditing ? editedContent : selectedDocument.content;
      const blob = new Blob([contentToPublish], { type: "text/markdown" });
      const file = new File([blob], `${selectedDocument.name}.md`, { type: "text/markdown" });

      // Create FormData and upload
      const formData = new FormData();
      formData.append("document", file);
      formData.append("projectId", selectedDocument.projectId._id || selectedDocument.projectId);

      const uploadRes = await uploadKnowledgeDocumentApi(formData);

      if (uploadRes.success && uploadRes.data?._id) {
        // Mark document as published
        const publishRes = await markDocumentPublished(id, uploadRes.data._id);
        
        if (publishRes.success) {
          setIsEditing(false);
          setMessage({ 
            type: "success", 
            text: "Document published to knowledgebase! You can now analyze it from the project's knowledgebase section." 
          });
        } else {
          setMessage({ type: "error", text: publishRes.error || "Failed to mark as published" });
        }
      } else {
        setMessage({ type: "error", text: uploadRes.message || "Failed to upload document" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to publish document" });
    } finally {
      setPublishing(false);
    }
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

  const isPublished = selectedDocument?.status === "published";

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

      {message && (
        <div className={`kb-message kb-message--${message.type}`}>
          <span>{message.text}</span>
          <button type="button" className="kb-message__close" onClick={() => setMessage(null)}>
            ✕
          </button>
        </div>
      )}

      <div className="presentation-details-bar">
        <div className="detail">
          <span className="label">Created:</span>
          <span className="value">{formatDate(selectedDocument.createdAt)}</span>
        </div>
        <div className="detail">
          <span className="label">Status:</span>
          <span className={`value badge ${isPublished ? "badge-info" : "badge-success"}`}>
            {selectedDocument.status}
          </span>
        </div>
        {selectedDocument.generationTime && (
          <div className="detail">
            <span className="label">Generation Time:</span>
            <span className="value">{selectedDocument.generationTime}s</span>
          </div>
        )}
        {isPublished && selectedDocument.publishedAt && (
          <div className="detail">
            <span className="label">Published:</span>
            <span className="value">{formatDate(selectedDocument.publishedAt)}</span>
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

      {isEditing ? (
        <div className="document-editor">
          <div className="document-editor__toolbar">
            <span className="document-editor__label">Editing Mode</span>
            <div className="document-editor__actions">
              <button 
                onClick={handleSave} 
                className="btn btn-primary btn-sm"
                disabled={actionLoading}
              >
                {actionLoading ? "Saving..." : "💾 Save"}
              </button>
              <button 
                onClick={handleCancelEdit} 
                className="btn btn-secondary btn-sm"
                disabled={actionLoading}
              >
                Cancel
              </button>
            </div>
          </div>
          <textarea
            className="document-editor__textarea"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            placeholder="Enter markdown content..."
          />
          <div className="document-editor__preview">
            <h4>Preview</h4>
            <div className="document-content-viewer">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {editedContent}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      ) : selectedDocument.content ? (
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
        {!isEditing && (
          <>
            <button onClick={handleEdit} className="btn btn-secondary">
              ✏️ Edit Document
            </button>
            <button onClick={handleDownload} className="btn btn-primary">
              📥 Download as Markdown
            </button>
            {!isPublished && selectedDocument.content && (
              <button 
                onClick={handlePublish} 
                className="btn btn-success"
                disabled={publishing}
              >
                {publishing ? "Publishing..." : "📤 Publish to Knowledgebase"}
              </button>
            )}
            {isPublished && (
              <span className="published-badge">✓ Published to Knowledgebase</span>
            )}
          </>
        )}
        <button onClick={handleBack} className="btn btn-outline">
          Back to List
        </button>
      </div>
    </div>
  );
};

export default DocumentView;

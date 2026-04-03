import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useDocument from "../../hooks/useDocument";
import { DOCUMENT_STATUS } from "../../constants/documentOptions";

const DocumentLanding = () => {
  const navigate = useNavigate();
  const {
    documents,
    documentsLoading,
    documentsError,
    searchTerm,
    setSearchTerm,
    filterDate,
    setFilterDate,
    searchDocuments,
    fetchDocuments,
    deleteDocument,
    actionLoading,
    isPM,
    isAdmin,
  } = useDocument();

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const refreshIntervalRef = useRef(null);

  // Auto-refresh while any document is generating
  useEffect(() => {
    const hasIncomplete = documents.some(
      (d) => d.status !== DOCUMENT_STATUS.COMPLETED && d.status !== DOCUMENT_STATUS.ERROR && d.status !== DOCUMENT_STATUS.PUBLISHED
    );

    if (hasIncomplete) {
      setIsAutoRefreshing(true);
      if (!refreshIntervalRef.current) {
        refreshIntervalRef.current = setInterval(() => fetchDocuments(), 5000);
      }
    } else {
      setIsAutoRefreshing(false);
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [documents, fetchDocuments]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim() === "") {
      fetchDocuments();
      return;
    }
    searchDocuments();
  };

  const handleDateChange = (field, value) => {
    setFilterDate((prev) => ({ ...prev, [field]: value }));
  };

  const handleDelete = async (id) => {
    const result = await deleteDocument(id);
    if (result.success) {
      setDeleteConfirm(null);
      fetchDocuments();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case DOCUMENT_STATUS.COMPLETED: return "badge-success";
      case DOCUMENT_STATUS.ERROR: return "badge-danger";
      case DOCUMENT_STATUS.PUBLISHED: return "badge-primary";
      default: return "badge-warning";
    }
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="presentation-landing">
      <div className="page-header">
        <h1>Documents</h1>
        <div className="header-actions">
          {isAutoRefreshing && (
            <span className="auto-refresh-indicator">⏳ Auto-refreshing...</span>
          )} {" "}
          {/* <button onClick={() => fetchDocuments()} className="dashboard-refresh-btn shade-1" disabled={documentsLoading}>
            {documentsLoading ? "Refreshing..." : "🔄 Refresh"}
          </button> */}
          <button onClick={() => navigate("/documents/create")} className="dashboard-refresh-btn">
            📄 Create New
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="search-filter-section">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search documents by name or description..."
            className="search-input"
          />
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>

        <div className="filter-controls">
          <div className="filter-group">
            <label>From Date:</label>
            <input type="date" value={filterDate.startDate || ""} onChange={(e) => handleDateChange("startDate", e.target.value)} />
          </div>
          <div className="filter-group">
            <label>To Date:</label>
            <input type="date" value={filterDate.endDate || ""} onChange={(e) => handleDateChange("endDate", e.target.value)} />
          </div>
          <button onClick={() => searchDocuments()} className="btn btn-secondary">Apply Filter</button>
          <button
            onClick={() => { setSearchTerm(""); setFilterDate({ startDate: null, endDate: null }); fetchDocuments(); }}
            className="btn btn-outline-secondary"
          >
            Reset
          </button>
        </div>
      </div>

      {documentsError && <div className="alert alert-danger"><p>{documentsError}</p></div>}
      {documentsLoading && <div className="loading-state"><p>Loading documents...</p></div>}

      {/* Table */}
      {!documentsLoading && documents.length > 0 && (
        <div className="presentations-table-wrapper">
          <table className="presentations-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc._id}>
                  <td className="name-cell"><strong>{doc.name}</strong></td>
                  <td className="description-cell">{doc.description || "-"}</td>
                  <td className="badge-status">
                    <span className={`badge ${getStatusBadgeClass(doc.status)}`}>{doc.status}</span>
                    {doc.status === DOCUMENT_STATUS.DRAFT && doc.statusMessage && (
                      <div className="status-message">{doc.statusMessage}</div>
                    )}
                  </td>
                  <td>{formatDate(doc.createdAt)}</td>
                  <td className="actions-cell">
                    {doc.status === DOCUMENT_STATUS.COMPLETED ? (
                      <button onClick={() => navigate(`/documents/${doc._id}`)} className="dashboard-refresh-btn">
                        View
                      </button>
                    ) : (
                      <span className="text-muted"></span>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(doc._id)}
                      className="dashboard-refresh-btn btn-danger"
                      disabled={actionLoading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!documentsLoading && documents.length === 0 && (
        <div className="empty-state">
          <h3>No documents yet</h3>
          <p>Create your first document by clicking the "Create New" button above.</p>
        </div>
      )}

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this document? This action cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-secondary" disabled={actionLoading}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn btn-danger" disabled={actionLoading}>
                {actionLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentLanding;

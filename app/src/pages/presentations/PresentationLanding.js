import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import usePresentation from "../../hooks/usePresentation";
import { PRESENTATION_STATUS } from "../../constants/presentationOptions";

const PresentationLanding = () => {
  const navigate = useNavigate();
  const {
    presentations,
    presentationsLoading,
    presentationsError,
    searchTerm,
    setSearchTerm,
    filterDate,
    setFilterDate,
    searchPresentations,
    fetchPresentations,
    deletePresentation,
    actionLoading,
    isPM,
    isAdmin,
  } = usePresentation();

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const refreshIntervalRef = useRef(null);

  // Auto-refresh while any presentation is not completed
  useEffect(() => {
    const hasIncomplete = presentations.some(
      (p) => p.status !== PRESENTATION_STATUS.COMPLETED && p.status !== PRESENTATION_STATUS.ERROR
    );

    if (hasIncomplete) {
      setIsAutoRefreshing(true);
      if (!refreshIntervalRef.current) {
        refreshIntervalRef.current = setInterval(() => {
          fetchPresentations();
        }, 5000);
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
  }, [presentations, fetchPresentations]);

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    if(searchTerm.trim() === "") {
      fetchPresentations();
      return;
    }
    searchPresentations();
  };

  // Handle date filter change
  const handleDateChange = (field, value) => {
    setFilterDate((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Apply date filter
  const handleApplyFilter = () => {
    searchPresentations();
  };

  // Handle delete
  const handleDelete = async (id) => {
    const result = await deletePresentation(id);
    if (result.success) {
      setDeleteConfirm(null);
      // Refresh list
      fetchPresentations();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  // Navigate to creation page
  const handleCreateNew = () => {
    navigate("/presentations/create");
  };

  // Navigate to edit/view presentation
  const handleViewPresentation = (id) => {
    navigate(`/presentations/${id}`);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case PRESENTATION_STATUS.COMPLETED:
        return "badge-success";
      case PRESENTATION_STATUS.ERROR:
        return "badge-danger";
      case PRESENTATION_STATUS.DRAFT:
      default:
        return "badge-warning";
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="presentation-landing">
      <div className="page-header">
        <h1>Presentations</h1>
        <div className="header-actions">
          {isAutoRefreshing && (
            <span className="auto-refresh-indicator">⏳ Auto-refreshing...</span>
          )} { " " }
          {/* <button onClick={() => fetchPresentations()} className="dashboard-refresh-btn shade-1" disabled={presentationsLoading}>
            {presentationsLoading ? "Refreshing..." : "🔄 Refresh"}
          </button> {" "} */}
          <button onClick={handleCreateNew} className="dashboard-refresh-btn">
            🎨 Create New
          </button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="search-filter-section">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search presentations by name or description..."
            className="search-input"
          />
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>

        {/* Date Filters */}
        <div className="filter-controls">
          <div className="filter-group">
            <label>From Date:</label>
            <input
              type="date"
              value={filterDate.startDate || ""}
              onChange={(e) => handleDateChange("startDate", e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>To Date:</label>
            <input
              type="date"
              value={filterDate.endDate || ""}
              onChange={(e) => handleDateChange("endDate", e.target.value)}
            />
          </div>

          <button onClick={handleApplyFilter} className="btn btn-secondary">
            Apply Filter
          </button>

          <button
            onClick={() => {
              setSearchTerm("");
              setFilterDate({ startDate: null, endDate: null });
              fetchPresentations();
            }}
            className="btn btn-outline-secondary"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Error Message */}
      {presentationsError && (
        <div className="alert alert-danger">
          <p>{presentationsError}</p>
        </div>
      )}

      {/* Loading State */}
      {presentationsLoading && (
        <div className="loading-state">
          <p>Loading presentations...</p>
        </div>
      )}

      {/* Presentations Table */}
      {!presentationsLoading && presentations.length > 0 && (
        <div className="presentations-table-wrapper">
          <table className="presentations-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Pages</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {presentations.map((presentation) => (
                <tr key={presentation._id}>
                  <td className="name-cell">
                    <strong>{presentation.name}</strong>
                  </td>
                  <td className="description-cell">
                    {presentation.status === PRESENTATION_STATUS.COMPLETED
                      ? (presentation.description || "Completed")
                      : (presentation.description || "-")}
                  </td>
                  <td className="center">{presentation.numberOfPages}</td>
                  <td className="badge-status">
                    <span className={`badge ${getStatusBadgeClass(presentation.status)}`}>
                      {presentation.status}
                    </span>
                    {presentation.status === PRESENTATION_STATUS.DRAFT && presentation.statusMessage && (
                      <div className="status-message">{presentation.statusMessage}</div>
                    )}
                  </td>
                  <td>{formatDate(presentation.createdAt)}</td>
                  <td className="actions-cell">
                    {presentation.status === PRESENTATION_STATUS.COMPLETED ? (
                      <button
                        onClick={() => handleViewPresentation(presentation._id)}
                        className="dashboard-refresh-btn"
                      >
                        View
                      </button>
                    ) : (
                      <span className="text-muted"></span>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(presentation._id)}
                      className="btn btn-sm btn-danger"
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

      {/* Empty State */}
      {!presentationsLoading && presentations.length === 0 && (
        <div className="empty-state">
          <h3>No presentations yet</h3>
          <p>Create your first presentation by clicking the "Create New Presentation" button above.</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this presentation? This action cannot be undone.</p>
            <div className="modal-actions">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="btn btn-danger"
                disabled={actionLoading}
              >
                {actionLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresentationLanding;

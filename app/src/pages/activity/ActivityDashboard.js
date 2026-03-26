import React, { useState } from "react";
import { useActivity } from "../../hooks/useActivity";
import HandoffPanel from "../../components/activity/HandoffPanel";

const prettyDateTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const sourceLabel = (source) => {
  if (source === "mcp") return "VS Code (MCP)";
  if (source === "web_chat") return "Web Chat";
  return source || "-";
};

const ActivityDashboard = () => {
  const {
    activities,
    totalActivities,
    users,
    projects,
    loading,
    error,
    filters,
    pagination,
    isAdmin,
    isPM,
    fetchActivities,
    fetchHandoffContext,
    updateFilters,
    nextPage,
    prevPage,
    handoffContext,
    clearHandoffContext,
  } = useActivity();

  const [expandedId, setExpandedId] = useState(null);
  const [showHandoff, setShowHandoff] = useState(false);
  const [handoffUserId, setHandoffUserId] = useState("");

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    updateFilters({ [name]: value });
  };

  const handleHandoffSelect = async () => {
    if (!filters.projectId || !handoffUserId) return;
    await fetchHandoffContext(filters.projectId, handoffUserId, 14);
    setShowHandoff(true);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const hasMore = pagination.skip + activities.length < totalActivities;
  const hasPrev = pagination.skip > 0;
  const currentPage = Math.floor(pagination.skip / pagination.limit) + 1;
  const totalPages = Math.ceil(totalActivities / pagination.limit);

  return (
    <section className="activity-page users-page">
      <div className="users-header">
        <div>
          <h1 className="users-title">Developer Activity</h1>
          <p className="users-subtitle">
            Track developer prompts and interactions for handoffs
          </p>
        </div>

        <div className="users-actions">
          <button
            type="button"
            className="projects-btn projects-btn--secondary"
            onClick={fetchActivities}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="activity-filters">
        <div className="activity-filter-row">
          <div className="activity-filter-group">
            <label htmlFor="projectId">Project</label>
            <select
              id="projectId"
              name="projectId"
              value={filters.projectId}
              onChange={handleFilterChange}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div className="activity-filter-group">
              <label htmlFor="userId">Developer</label>
              <select
                id="userId"
                name="userId"
                value={filters.userId}
                onChange={handleFilterChange}
              >
                <option value="">All Developers</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="activity-filter-group">
            <label htmlFor="source">Source</label>
            <select
              id="source"
              name="source"
              value={filters.source}
              onChange={handleFilterChange}
            >
              <option value="">All Sources</option>
              <option value="mcp">VS Code (MCP)</option>
              <option value="web_chat">Web Chat</option>
            </select>
          </div>

          <div className="activity-filter-group">
            <label htmlFor="agentType">Agent</label>
            <select
              id="agentType"
              name="agentType"
              value={filters.agentType}
              onChange={handleFilterChange}
            >
              <option value="">All Agents</option>
              <option value="dev">Dev</option>
              <option value="PM">PM</option>
              <option value="general">General</option>
            </select>
          </div>

          <div className="activity-filter-group">
            <label htmlFor="days">Period</label>
            <select
              id="days"
              name="days"
              value={filters.days}
              onChange={handleFilterChange}
            >
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>

        {/* Handoff Section */}
        {isPM && filters.projectId && (
          <div className="activity-handoff-section">
            <div className="activity-filter-group">
              <label htmlFor="handoffUser">Handoff Context</label>
              <select
                id="handoffUser"
                value={handoffUserId}
                onChange={(e) => setHandoffUserId(e.target.value)}
              >
                <option value="">Select developer...</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="projects-btn"
              onClick={handleHandoffSelect}
              disabled={!handoffUserId || loading}
            >
              Get Handoff Context
            </button>
          </div>
        )}
      </div>

      {error && <p className="projects-error">{error}</p>}

      {/* Activity Table */}
      <div className="projects-table-wrap">
        <table className="projects-table activity-table">
          <thead>
            <tr>
              <th style={{ width: 150 }}>Time</th>
              <th>Developer</th>
              <th>Prompt Summary</th>
              <th style={{ width: 120 }}>Source</th>
              <th style={{ width: 80 }}>Agent</th>
              <th style={{ width: 80 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="projects-empty">
                  Loading activities...
                </td>
              </tr>
            ) : activities.length === 0 ? (
              <tr>
                <td colSpan={6} className="projects-empty">
                  No activities found.
                </td>
              </tr>
            ) : (
              activities.map((item) => (
                <React.Fragment key={item.id}>
                  <tr
                    className={`activity-row ${expandedId === item.id ? "activity-row--expanded" : ""}`}
                    onClick={() => toggleExpand(item.id)}
                  >
                    <td>{prettyDateTime(item.createdAt)}</td>
                    <td>{item.userName || "-"}</td>
                    <td className="activity-summary">
                      {item.promptSummary || item.prompt?.slice(0, 80) || "-"}
                    </td>
                    <td>
                      <span className={`activity-source activity-source--${item.source}`}>
                        {sourceLabel(item.source)}
                      </span>
                    </td>
                    <td>{item.agentType}</td>
                    <td>
                      <span className={`activity-status activity-status--${item.status}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr className="activity-detail-row">
                      <td colSpan={6}>
                        <div className="activity-detail">
                          <div className="activity-detail-section">
                            <strong>Full Prompt:</strong>
                            <p>{item.prompt}</p>
                          </div>
                          {item.response && (
                            <div className="activity-detail-section">
                              <strong>Response{item.responseTruncated ? " (truncated)" : ""}:</strong>
                              <p>{item.response}</p>
                            </div>
                          )}
                          {item.context && Object.keys(item.context).some(k => item.context[k]) && (
                            <div className="activity-detail-section">
                              <strong>Context:</strong>
                              <ul>
                                {item.context.currentFile && <li>File: {item.context.currentFile}</li>}
                                {item.context.workspace && <li>Workspace: {item.context.workspace}</li>}
                                {item.context.branch && <li>Branch: {item.context.branch}</li>}
                              </ul>
                            </div>
                          )}
                          {item.duration && (
                            <div className="activity-detail-meta">
                              Duration: {item.duration}ms
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="activity-pagination">
        <span className="activity-pagination-info">
          Showing {activities.length} of {totalActivities} activities
          {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
        </span>
        <div className="activity-pagination-actions">
          <button
            type="button"
            className="projects-btn projects-btn--tiny projects-btn--secondary"
            onClick={prevPage}
            disabled={!hasPrev || loading}
          >
            Previous
          </button>
          <button
            type="button"
            className="projects-btn projects-btn--tiny projects-btn--secondary"
            onClick={nextPage}
            disabled={!hasMore || loading}
          >
            Next
          </button>
        </div>
      </div>

      {/* Handoff Panel Modal */}
      {showHandoff && handoffContext && (
        <HandoffPanel
          context={handoffContext}
          onClose={() => {
            setShowHandoff(false);
            clearHandoffContext();
          }}
        />
      )}
    </section>
  );
};

export default ActivityDashboard;

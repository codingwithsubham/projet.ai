import React from "react";
import { useApiKeys } from "../../hooks/useApiKeys";

const prettyDateTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const statusLabel = (item) => {
  if (item?.status === "revoked") return "Revoked";
  if (item?.status === "expired") return "Expired";
  return "Active";
};

const ApiKeys = () => {
  const {
    apiKeys,
    projects,
    projectNameById,
    loading,
    error,
    actionLoading,
    modal,
    formData,
    formError,
    latestGeneratedKey,
    refreshApiKeys,
    openCreateModal,
    openEditModal,
    closeModal,
    handleFormChange,
    submitApiKey,
    revokeApiKey,
    clearGeneratedKey,
  } = useApiKeys();

  return (
    <section className="api-keys-page users-page">
      <div className="users-header">
        <div>
          <h1 className="users-title">API Keys</h1>
          <p className="users-subtitle">Create, scope, expire, and revoke MCP API keys</p>
        </div>

        <div className="users-actions">
          <button type="button" className="projects-btn projects-btn--secondary" onClick={refreshApiKeys}>
            Refresh
          </button>
          <button type="button" className="projects-btn" onClick={openCreateModal}>
            Create Key
          </button>
        </div>
      </div>

      {latestGeneratedKey ? (
        <div className="api-keys-generated">
          <div>
            <strong>New API key (shown once):</strong>
            <code>{latestGeneratedKey}</code>
          </div>
          <div className="api-keys-generated__actions">
            <button
              type="button"
              className="projects-btn projects-btn--tiny"
              onClick={() => navigator.clipboard.writeText(latestGeneratedKey)}
            >
              Copy
            </button>
            <button
              type="button"
              className="projects-btn projects-btn--tiny projects-btn--secondary"
              onClick={clearGeneratedKey}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="projects-error">{error}</p> : null}

      <div className="projects-table-wrap">
        <table className="projects-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Key Preview</th>
              <th>Project</th>
              <th>Role</th>
              <th>Expiry</th>
              <th>Status</th>
              <th style={{ width: 170 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="projects-empty">Loading API keys...</td>
              </tr>
            ) : apiKeys.length === 0 ? (
              <tr>
                <td colSpan={7} className="projects-empty">No API keys found.</td>
              </tr>
            ) : (
              apiKeys.map((item) => {
                const isRevokedOrExpired = item.status === "revoked" || item.status === "expired";

                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td><code>{item.keyPreview}</code></td>
                    <td>{item.projectName || projectNameById[item.projectId] || "-"}</td>
                    <td>{item.role}</td>
                    <td>{prettyDateTime(item.expiresAt)}</td>
                    <td>
                      <span className={`api-keys-status api-keys-status--${item.status || "active"}`}>
                        {statusLabel(item)}
                      </span>
                    </td>
                    <td>
                      <div className="projects-row-actions">
                        <button
                          type="button"
                          className="projects-btn projects-btn--tiny projects-btn--secondary"
                          onClick={() => openEditModal(item.id)}
                          disabled={actionLoading}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="projects-btn projects-btn--tiny projects-btn--danger"
                          onClick={() => revokeApiKey(item.id)}
                          disabled={actionLoading || isRevokedOrExpired}
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modal.open ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-wrapper">
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>{modal.mode === "edit" ? "Edit API Key" : "Create API Key"}</h3>
                <button type="button" className="modal-close" onClick={closeModal}>X</button>
              </div>

              <form className="project-form" onSubmit={submitApiKey}>
                <label htmlFor="name">Key Name</label>
                <input id="name" name="name" value={formData.name} onChange={handleFormChange} />

                <label htmlFor="projectId">Project Scope</label>
                <select id="projectId" name="projectId" value={formData.projectId} onChange={handleFormChange}>
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>

                <label htmlFor="role">Role Scope</label>
                <select id="role" name="role" value={formData.role} onChange={handleFormChange}>
                  <option value="dev">dev</option>
                  <option value="QA">QA</option>
                  <option value="PM">PM</option>
                  <option value="BA">BA</option>
                  <option value="UX">UX</option>
                  <option value="Ops">Ops</option>
                </select>

                <label htmlFor="expiresAt">Expiry</label>
                <input
                  id="expiresAt"
                  name="expiresAt"
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={handleFormChange}
                />

                {formError ? <p className="form-error">{formError}</p> : null}

                <div className="modal-footer">
                  <button type="button" className="projects-btn projects-btn--secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="projects-btn" disabled={actionLoading}>
                    {actionLoading
                      ? "Saving..."
                      : modal.mode === "edit"
                        ? "Update API Key"
                        : "Create API Key"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default ApiKeys;

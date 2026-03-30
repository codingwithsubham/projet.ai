import React from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "../../hooks/useProjects";
import { MODEL_OPTIONS } from "../../constants/modelOptions";

const formatDate = (value) => {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString();
};

const maskKey = (key) => {
  if (!key) return "N/A";
  if (key.length <= 8) return "********";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
};

const Projects = () => {
  const navigate = useNavigate();
  const {
    tableProjects,
    projectsLoading,
    projectsError,
    actionLoading,
    isAdmin,
    modal,
    formData,
    formErrors,
    refreshProjects,
    openAddModal,
    openEditModal,
    closeModal,
    handleFormChange,
    submitProject,
    removeProject,
  } = useProjects();

  const openProjectPage = (id) => {
    navigate(`/projects/${id}`);
  };

  return (
    <section className="projects-page">
      <div className="projects-header">
        <div>
          <h1 className="projects-title">Projects</h1>
          <p className="projects-subtitle">Manage projects and configurations</p>
        </div>

        <div className="projects-actions">
          <button type="button" className="projects-btn projects-btn--secondary" onClick={refreshProjects}>
            Refresh
          </button>
          {isAdmin ? (
            <button type="button" className="projects-btn" onClick={openAddModal}>
              📜 Add Project
            </button>
          ) : null}
        </div>
      </div>

      {projectsError ? <p className="projects-error">{projectsError}</p> : null}

      <div className="projects-table-wrap">
        <table className="projects-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Model</th>
              <th>Description</th>
              <th>API Key</th>
              <th>Created</th>
              <th style={{ width: 210 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projectsLoading ? (
              <tr>
                <td colSpan={6} className="projects-empty">Loading projects...</td>
              </tr>
            ) : tableProjects.length === 0 ? (
              <tr>
                <td colSpan={6} className="projects-empty">No projects found.</td>
              </tr>
            ) : (
              tableProjects.map((project) => (
                <tr key={project._id}>
                  <td>
                    <button
                      type="button"
                      className="projects-link-btn"
                      onClick={() => openProjectPage(project._id)}
                    >
                      {project.name}
                    </button>
                  </td>
                  <td>{project.model}</td>
                  <td className="projects-desc-cell">{project.description}</td>
                  <td>{maskKey(project.openapikey)}</td>
                  <td>{formatDate(project.createdAt)}</td>
                  <td>
                    <div className="projects-row-actions">
                      <button
                        type="button"
                        className="projects-btn projects-btn--tiny"
                        onClick={() => openProjectPage(project._id)}
                        title="View Project"
                      >
                        View
                      </button>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="projects-btn projects-btn--tiny"
                          onClick={() => openEditModal(project._id)}
                        >
                          ⚙️
                        </button>
                      ) : null}
                      {isAdmin ? (
                        <button
                          type="button"
                          className="projects-btn projects-btn--tiny projects-btn--danger"
                          onClick={() => removeProject(project._id)}
                          disabled={actionLoading}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && modal.open && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-wrapper">
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{modal.mode === "edit" ? "Edit Project" : "Add Project"}</h3>
                <button type="button" className="modal-close" onClick={closeModal}>
                  ✕
                </button>
              </div>

              <form className="project-form" onSubmit={submitProject}>
                <label htmlFor="name">Project Name</label>
                <input id="name" name="name" value={formData.name} onChange={handleFormChange} />
                {formErrors.name && <p className="form-error">{formErrors.name}</p>}

                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" rows="3" value={formData.description} onChange={handleFormChange} />
                {formErrors.description && <p className="form-error">{formErrors.description}</p>}

                <label htmlFor="model">Model</label>
                <select
                  id="model"
                  name="model"
                  value={formData.model}
                  onChange={handleFormChange}
                >
                  <option value="">Select model</option>
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {formErrors.model && <p className="form-error">{formErrors.model}</p>}

                <label htmlFor="openapikey">Open API Key</label>
                <input id="openapikey" name="openapikey" value={formData.openapikey} onChange={handleFormChange} />
                {formErrors.openapikey && <p className="form-error">{formErrors.openapikey}</p>}

                <label className="remember">
                  <input
                    type="checkbox"
                    name="islangsmithEnabled"
                    checked={formData.islangsmithEnabled}
                    onChange={handleFormChange}
                  />
                  <span>Enable LangSmith</span>
                </label>

                <label htmlFor="langsmithapikey">LangSmith API Key</label>
                <input id="langsmithapikey" name="langsmithapikey" value={formData.langsmithapikey} onChange={handleFormChange} />

                <label htmlFor="langsmithProject">LangSmith Project</label>
                <input id="langsmithProject" name="langsmithProject" value={formData.langsmithProject} onChange={handleFormChange} />

                {formErrors.form && <p className="form-error">{formErrors.form}</p>}

                <div className="modal-footer">
                  <button type="button" className="projects-btn projects-btn--secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="projects-btn" disabled={actionLoading}>
                    {actionLoading ? "Saving..." : modal.mode === "edit" ? "Update Project" : "Create Project"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Projects;
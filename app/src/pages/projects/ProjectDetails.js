import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectDetails } from "../../hooks/useProjectDetails";
import { useDevKnowledgebase } from "../../hooks/useDevKnowledgebase";
import KnowledgebasePanel from "../../components/knowledgebase/KnowledgebasePanel";
import IDEConnectModal from "../../components/IDEConnectModal";

const ProjectDetails = () => {
  const navigate = useNavigate();
  const { id, project, loading, error, canAccessKnowledgebase } = useProjectDetails();
  const [showIDEModal, setShowIDEModal] = useState(false);

  // Read-only data for developer view
  const devKb = useDevKnowledgebase(canAccessKnowledgebase ? null : id);

  return (
    <section className="project-details-page">
      <div className="project-details-header">
        <div className="project-details-title-row">
          <button
            type="button"
            className="projects-btn projects-btn--secondary icon-btn"
            onClick={() => navigate("/projects")}
          >
            ❮
          </button>

          {loading ? (
            <h1 className="project-details-title">Loading project...</h1>
          ) : error ? (
            <h1 className="project-details-title">Project #{id}</h1>
          ) : (
            <h1 className="project-details-title">
              {project?.name || "Untitled Project"}
            </h1>
          )}
          <p className="project-details-desc">
            {error
              ? error
              : project?.description || "No description available."}
          </p>
        </div>
      </div>

      <div className="project-tab-content">
        {canAccessKnowledgebase ? (
          <KnowledgebasePanel projectId={id} />
        ) : (
          <div className="project-info-card">
            <div className="project-info-row">
              <span className="project-info-label">Model</span>
              <span className="project-info-value">{project?.model || "N/A"}</span>
            </div>
            <div className="project-info-row">
              <span className="project-info-label">Description</span>
              <span className="project-info-value">{project?.description || "No description."}</span>
            </div>
            <p className="kb-muted" style={{ marginTop: 12 }}>
              Use the <strong>💬 Chat</strong> menu in the sidebar to talk with the AI agent.
            </p>

            <div className="project-dev-actions">
              <button
                type="button"
                className="projects-btn projects-btn--primary"
                onClick={() => setShowIDEModal(true)}
              >
                🔌 Connect to Your IDE
              </button>
            </div>

            {/* Developer Read-Only: Repositories */}
            <div className="dev-readonly-section">
              <div className="dev-readonly-header">
                <h3>📦 Repositories</h3>
                <span className="dev-readonly-count">{devKb.repositories.length}</span>
              </div>

              {devKb.loading ? (
                <p className="kb-muted">Loading...</p>
              ) : devKb.repositories.length === 0 ? (
                <p className="kb-muted">No repositories linked to this project yet.</p>
              ) : (
                <div className="dev-readonly-list">
                  {devKb.repositories.map((repo) => (
                    <div key={repo._id} className="dev-readonly-item">
                      <div className="dev-readonly-item-info">
                        <span className="dev-readonly-identifier">{repo.identifier}</span>
                        <span className={`kb-multi-repo__tag kb-multi-repo__tag--${repo.tag}`}>
                          {repo.tag}
                        </span>
                      </div>
                      <a
                        href={repo.repolink}
                        target="_blank"
                        rel="noreferrer"
                        className="dev-readonly-link"
                      >
                        {repo.repolink}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Developer Read-Only: Documents */}
            <div className="dev-readonly-section">
              <div className="dev-readonly-header">
                <h3>📄 Documents</h3>
                <span className="dev-readonly-count">{devKb.docs.length}</span>
              </div>

              {devKb.loading ? (
                <p className="kb-muted">Loading...</p>
              ) : devKb.docs.length === 0 ? (
                <p className="kb-muted">No documents uploaded to this project yet.</p>
              ) : (
                <div className="dev-readonly-list">
                  {devKb.docs.map((doc) => (
                    <div key={doc._id} className="dev-readonly-item">
                      <a
                        href={doc.fileurl}
                        target="_blank"
                        rel="noreferrer"
                        className="dev-readonly-link"
                      >
                        {doc.fileName}
                      </a>
                      {doc.isAnalysized ? (
                        <span className="kb-badge">Analyzed</span>
                      ) : (
                        <span className="dev-readonly-badge-pending">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {devKb.error && <p className="projects-error">{devKb.error}</p>}
          </div>
        )}
      </div>

      <IDEConnectModal
        isOpen={showIDEModal}
        onClose={() => setShowIDEModal(false)}
        projectName={project?.name}
        projectId={id}
        apiKey={null}
      />
    </section>
  );
};

export default ProjectDetails;

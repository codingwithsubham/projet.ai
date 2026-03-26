import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectDetails } from "../../hooks/useProjectDetails";
import KnowledgebasePanel from "../../components/knowledgebase/KnowledgebasePanel";
import IDEConnectModal from "../../components/IDEConnectModal";

const ProjectDetails = () => {
  const navigate = useNavigate();
  const { id, project, loading, error, canAccessKnowledgebase } = useProjectDetails();
  const [showIDEModal, setShowIDEModal] = useState(false);

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

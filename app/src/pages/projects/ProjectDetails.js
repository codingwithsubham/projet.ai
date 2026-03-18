import React from "react";
import { useNavigate } from "react-router-dom";
import { useProjectDetails } from "../../hooks/useProjectDetails";
import KnowledgebasePanel from "../../components/knowledgebase/KnowledgebasePanel";

const ProjectDetails = () => {
  const navigate = useNavigate();
  const { id, project, loading, error, canAccessKnowledgebase } = useProjectDetails();

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
          </div>
        )}
      </div>
    </section>
  );
};

export default ProjectDetails;

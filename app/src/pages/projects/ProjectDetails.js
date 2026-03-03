import React from "react";
import { useNavigate } from "react-router-dom";
import { useProjectDetails } from "../../hooks/useProjectDetails";
import KnowledgebasePanel from "../../components/knowledgebase/KnowledgebasePanel";
import ChatPanel from "../../components/chat/ChatPanel";

const ProjectDetails = () => {
  const navigate = useNavigate();
  const { id, project, loading, error, tabs, activeTab, setActiveTab, isChatFullView, setIsChatFullView } =
    useProjectDetails();

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
        <div className="project-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`project-tab ${activeTab === tab.key ? "project-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="project-tab-content">
        {activeTab === "chat" ? (
          <div className="chat-wrapper">
            <div className="chat-full-view" onClick={() => setIsChatFullView(!isChatFullView)}>⛶</div>
            <ChatPanel projectId={id} />
          </div>
        ) : (
          <KnowledgebasePanel projectId={id} />
        )}
      </div>

      {
        isChatFullView && activeTab === "chat" && (
          <div className="chat-full-screen-overlay">
            <div className="chat-header">
              <h4>🚀 Pro-jet.ai</h4>
              <div className="chat-full-view-close" onClick={() => setIsChatFullView(!isChatFullView)}>✖</div>
            </div>
            <ChatPanel projectId={id} />
          </div>
        )
      }
    </section>
  );
};

export default ProjectDetails;

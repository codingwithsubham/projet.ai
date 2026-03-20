import React, { useEffect, useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import ChatPanel from "../../components/chat/ChatPanel";

const ChatPage = () => {
  const { projects, fetchProjects, projectsLoading } = useAppData();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isFullView, setIsFullView] = useState(false);

  useEffect(() => {
    if (!projects.length) {
      fetchProjects();
    }
  }, [fetchProjects, projects.length]);

  return (
    <section className="chat-page">
      {/* Floating project selector */}
      <div className="chat-page__floating-select">
        <select
          id="chat-project-select"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          <option value="">— Select Project —</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedProjectId && (
          <button
            type="button"
            className="chat-page__expand-btn"
            onClick={() => setIsFullView(true)}
            title="Full screen"
          >
            ⛶
          </button>
        )}
      </div>

      {projectsLoading ? (
        <p className="kb-muted">Loading projects...</p>
      ) : selectedProjectId ? (
        <div className="chat-page__panel">
          <ChatPanel projectId={selectedProjectId} />
        </div>
      ) : (
        <div className="chat-page__empty">
          <h1>🤖</h1>
          <p>Select a project to start chatting with the AI agent.</p>
        </div>
      )}

      {/* Full screen overlay */}
      {isFullView && selectedProjectId && (
        <div className="chat-full-screen-overlay">
          <div className="chat-header">
            <h4>🚀 Pro-jet.ai</h4>
            <div
              className="chat-full-view-close"
              onClick={() => setIsFullView(false)}
            >
              ✖
            </div>
          </div>
          <ChatPanel projectId={selectedProjectId} />
        </div>
      )}
    </section>
  );
};

export default ChatPage;

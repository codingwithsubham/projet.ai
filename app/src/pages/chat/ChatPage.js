import React, { useEffect, useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import ChatPanel from "../../components/chat/ChatPanel";

const ChatPage = () => {
  const { projects, fetchProjects, projectsLoading } = useAppData();
  const [selectedProjectId, setSelectedProjectId] = useState("");

  useEffect(() => {
    if (!projects.length) {
      fetchProjects();
    }
  }, [fetchProjects, projects.length]);

  // Auto-select first project
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  if (projectsLoading) {
    return (
      <section className="chat-page">
        <p className="kb-muted" style={{ margin: "auto" }}>Loading projects...</p>
      </section>
    );
  }

  return (
    <section className="chat-page">
      <ChatPanel
        projectId={selectedProjectId}
        projects={projects}
        onProjectChange={setSelectedProjectId}
      />
    </section>
  );
};

export default ChatPage;

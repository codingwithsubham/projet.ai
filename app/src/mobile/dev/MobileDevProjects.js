import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProjectsApi } from "../../services/project.api";
import {
  clearAuthSession,
  getAuthToken,
  getAuthUser,
} from "../../services/auth.storage";

const isDevUser = (user) => String(user?.role || "").toLowerCase() === "dev";

const MobileDevProjects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAuthToken();
    const user = getAuthUser();

    if (!token || !user || !isDevUser(user)) {
      clearAuthSession();
      navigate("/mob", { replace: true });
      return;
    }

    const run = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getProjectsApi();
        setProjects(Array.isArray(response?.data) ? response.data : []);
      } catch (nextError) {
        const message =
          nextError?.response?.data?.message ||
          nextError?.message ||
          "Failed to load projects";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [navigate]);

  const handleLogout = () => {
    clearAuthSession();
    navigate("/mob", { replace: true });
  };

  const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString();
  };

  return (
    <section className="mob-shell mob-shell--projects">
      <div className="mob-projects-nav">
        <div className="mob-projects-brand">
          <span className="mob-projects-brand__logo" aria-hidden="true">🚀</span>
          <div>
            <p className="mob-projects-brand__name">Pro-jet.ai</p>
            <p className="mob-projects-brand__tag">Developer Mobile</p>
          </div>
        </div>
        <button type="button" className="mob-projects-signout" onClick={handleLogout}>
          <span aria-hidden="true">➜]</span>
        </button>
      </div>

      <div className="mob-card mob-page-card mob-projects-card">
        <div className="mob-projects-header">
          <p className="mob-projects-eyebrow">Workspace</p>
          <h1 className="mob-projects-title">Projects</h1>
          <p className="mob-projects-subtitle">
            Select a project to open AI-assisted developer chat, context, and history.
          </p>
        </div>

        {loading ? <p className="mob-info">Loading projects...</p> : null}
        {error ? <p className="mob-error">{error}</p> : null}

        {!loading && !error && projects.length === 0 ? (
          <p className="mob-info">No assigned projects found.</p>
        ) : null}

        <div className="mob-projects-list">
          {projects.map((project) => (
            <button
              key={project._id}
              type="button"
              className="mob-project-card"
              onClick={() => navigate(`/mob/projects/${project._id}/chat`)}
            >
              <div className="mob-project-card__row">
                <span className="mob-project-card__title">{project.name || "Untitled Project"}</span>
                <span className="mob-project-card__chip">AI Ready</span>
              </div>

              <p className="mob-project-card__desc">
                {project.description || "No project description available yet."}
              </p>

              <div className="mob-project-card__meta">
                <span>
                  <strong>Model:</strong> {project.model || "default"}
                </span>
                <span>
                  <strong>Updated:</strong> {formatDate(project.updatedAt)}
                </span>
              </div>

              <span className="mob-project-card__cta">
                <span aria-hidden="true">💬</span>
                Open Developer Chat
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MobileDevProjects;

import React from "react";
import { useDashboard } from "../../hooks/useDashboard";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  const { summaryTiles, totalProjects, projectsLoading, projectsError, refreshProjects } =
    useDashboard();

    const openProjectPage = (id) => {
    navigate(`/projects/${id}`);
  };

  return (
    <section className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Latest 4 projects summary</p>
        </div>

        <div className="dashboard-actions">
          <span className="dashboard-count">Total Projects: {totalProjects}</span>
          <button
            type="button"
            className="dashboard-refresh-btn"
            onClick={refreshProjects}
            disabled={projectsLoading}
          >
            {projectsLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {projectsError ? <p className="dashboard-error">{projectsError}</p> : null}

      <div className="dashboard-grid">
        {summaryTiles.map((tile) => (
          <article
            key={tile.id}
            className={`project-tile ${tile.isEmpty ? "project-tile--empty" : ""}`}
          >
            <h3 className="project-tile__title projects-link-btn" onClick={() => openProjectPage(tile.id)}>
              {tile.name}</h3>
            <p className="project-tile__desc">{tile.description}</p>

            <div className="project-tile__meta">
              <span>
                <strong>Model:</strong> {tile.model}
              </span>
              <span>
                <strong>Created:</strong> {tile.createdAt}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Dashboard;
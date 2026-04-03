import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthUser } from "../services/auth.storage";
import { useSubscription } from "../context/SubscriptionContext";

const Sidebar = () => {
  const navigate = useNavigate();
  const user = getAuthUser();
  const isAdmin = String(user?.role || "") === "admin";
  const isPM = String(user?.role || "") === "PM";
  const isDev = String(user?.role || "") === "dev";
  const isBA = String(user?.role || "") === "BA";
  const isQA = String(user?.role || "") === "QA";

  const { sidebarAgents, loading: agentsLoading } = useSubscription();

  const onLogout = () => {
    clearAuthSession();
    navigate("/", { replace: true });
  };

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__top">
        <p className="app-sidebar__label">it's yours</p>
        <h3 className="app-sidebar__title">WORKSPACE</h3>

        <nav className="app-sidebar__nav">
          <NavLink to="/dashboard" className="app-sidebar__link">
            🏠 Dashboard
          </NavLink>
          <NavLink to="/chat" className="app-sidebar__link">
            💬 Talk to{" "}
            {isPM
              ? "PM"
              : isAdmin
                ? "General"
                : isDev
                  ? "Dev"
                  : isBA
                    ? "BA"
                    : isQA
                      ? "QA"
                      : "Your"}{" "}
            Agent
          </NavLink>
          <NavLink to="/projects" className="app-sidebar__link">
            📁 Projects
          </NavLink>

          {/* Dynamic agent links from subscriptions */}
          {!agentsLoading &&
            sidebarAgents.map((agent) => (
              <NavLink
                key={agent.slug}
                to={agent.route}
                className="app-sidebar__link"
              >
                {agent.icon} {agent.sidebarLabel}
              </NavLink>
            ))}

          {isPM || isAdmin ? (
            <NavLink to="/activity" className="app-sidebar__link">
              📈 Activity
            </NavLink>
          ) : null}

          <NavLink to="/marketplace" className="app-sidebar__link">
            🏪 Marketplace
          </NavLink>

          {isAdmin ? (
            <NavLink to="/users" className="app-sidebar__link">
              👥 Users
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/api-keys" className="app-sidebar__link">
              🔑 API Keys
            </NavLink>
          ) : null}
          <NavLink to="/settings" className="app-sidebar__link">
            ⚙️ Settings
          </NavLink>
        </nav>
      </div>

      <div className="app-sidebar__bottom">
        <button
          type="button"
          className="app-sidebar__logout"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

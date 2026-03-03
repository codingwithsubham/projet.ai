import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthUser } from "../services/auth.storage";

const Sidebar = () => {
  const navigate = useNavigate();
  const user = getAuthUser();

  const onLogout = () => {
    clearAuthSession();
    navigate("/", { replace: true });
  };

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__top">
        <p className="app-sidebar__label">Workspace</p>
        <h3 className="app-sidebar__title">Pro-jet.ai</h3>

        <nav className="app-sidebar__nav">
        <NavLink to="/dashboard" className="app-sidebar__link">
          🏠 Dashboard
        </NavLink>
        <NavLink to="/projects" className="app-sidebar__link">
          📁 Projects
        </NavLink>
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

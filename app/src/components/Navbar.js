import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthUser } from "../services/auth.storage";

const Navbar = () => {
  const navigate = useNavigate();
  const user = getAuthUser();

  return (
    <header className="app-navbar">
      <div className="app-navbar__brand">🚀 Pro-jet.ai</div>

      <nav className="app-navbar__links">
        <NavLink to="/dashboard" className="app-navbar__link">
          Dashboard
        </NavLink>
        <NavLink to="/projects" className="app-navbar__link">
          Projects
        </NavLink>
        <NavLink to="/settings" className="app-navbar__link">
          Settings
        </NavLink>
      </nav>

      <div className="app-navbar__right">
        <span className="app-navbar__user">{user?.name || user?.username}</span>
        <span className="app-navbar__icon">🤖</span>
      </div>
    </header>
  );
};

export default Navbar;
